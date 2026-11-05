import { randomBytes } from 'node:crypto';
import {
  LessonsDocument,
  MapDocument,
  type CheckResult,
  type LessonView,
  type ServerEvent,
} from '@curio/core';
import type { Db } from '@curio/db';
import {
  formatHandoff,
  parseHandoff,
  stripHandoff,
  SwitchAgent,
  type Handoff,
  type RoomMessage,
} from '@curio/switch-client';
import {
  createDocument,
  findDocument,
  MIND_MAP_NAME,
  readDocument,
  type Connection,
} from './shared';

const NAME = 'keeper';
const BUILD_TIMEOUT_MS = 120_000;
// Switch announces document changes in the room. The feed doesn't need them.
const DOCUMENT_NOTICE = /^(📄|🗑)/u;

export type Keeper = {
  agent: SwitchAgent;
  start(): Promise<void>;
  startTopic(topic: string): Promise<string>;
  openLesson(conceptId: string): LessonView | null;
  submitCheck(conceptId: string, answers: Record<string, number>): Promise<CheckResult | null>;
};

/**
 * Runs the game by fixed rules, with no LLM. It is the app's voice in the room,
 * reads every message so the browser can mirror it, and is the only agent that
 * writes to the database.
 */
export function createKeeper(
  connection: Connection,
  db: Db,
  emit: (event: ServerEvent) => void,
): Keeper {
  const agent = new SwitchAgent({ ...connection, name: NAME, filter: 'all', onMessage });

  let mindMapId: string | null = null;
  let mindMapWrites: Promise<unknown> = Promise.resolve();

  const publishSky = () => emit({ type: 'sky', sky: db.readSky() });

  /** Only one update can run at a time, or a slower one would overwrite a newer one. */
  function syncMindMap(): void {
    mindMapWrites = mindMapWrites
      .then(() =>
        agent.op('update_room_document', {
          document_id: mindMapId,
          content: JSON.stringify(db.readMindMap()),
        }),
      )
      .catch((error: Error) => connection.log?.(`[${NAME}] mind map: ${error.message}`));
  }

  function mirror(message: RoomMessage): void {
    const body = stripHandoff(message.body);
    if (!body || DOCUMENT_NOTICE.test(body)) return;
    const item = {
      id: message.messageId,
      sender: message.sender,
      senderName: message.senderName,
      body,
      timestamp: message.timestamp,
    };
    db.addActivity(item);
    emit({ type: 'activity', item });
  }

  async function onMapReady(handoff: Handoff): Promise<void> {
    db.saveMap(MapDocument.parse(await readDocument(agent, String(handoff.doc))));
    publishSky();
    syncMindMap();
  }

  async function onLessonReady(handoff: Handoff): Promise<void> {
    const conceptId = String(handoff.concept);
    const { lessons } = LessonsDocument.parse(await readDocument(agent, String(handoff.doc)));
    const lesson = lessons[conceptId];
    if (!lesson) return;
    db.saveLesson(conceptId, lesson);
    publishSky();
    syncMindMap();
  }

  async function onMessage(message: RoomMessage): Promise<void> {
    mirror(message);
    if (!message.addressed || message.senderName === NAME) return;

    const handoff = parseHandoff(message.body);
    if (handoff?.type === 'map.ready' && handoff.doc) {
      await onMapReady(handoff);
    } else if (handoff?.type === 'lesson.ready' && handoff.doc) {
      await onLessonReady(handoff);
    } else if (handoff?.type === 'topic.failed' && handoff.topic) {
      db.failTopic(String(handoff.topic), 'The team could not map this topic. Try again.');
      publishSky();
    }
  }

  return {
    agent,

    async start() {
      await agent.start();
      mindMapId =
        (await findDocument(agent, MIND_MAP_NAME)) ??
        (await createDocument(
          agent,
          MIND_MAP_NAME,
          "The learner's concepts and connections.",
          db.readMindMap(),
        ));
      syncMindMap();
    },

    async startTopic(topic) {
      const topicId = `t_${randomBytes(4).toString('hex')}`;
      db.createTopic(topicId, topic);
      publishSky();

      await agent.send(
        formatHandoff(`New topic: ${topic}`, { type: 'topic.requested', topic: topicId, hop: 1 }),
        ['scout'],
      );

      setTimeout(() => {
        if (db.topicStatus(topicId) !== 'building') return;
        db.failTopic(topicId, 'The team did not answer in time. Check that Switch is running.');
        publishSky();
      }, BUILD_TIMEOUT_MS);

      return topicId;
    },

    openLesson(conceptId) {
      const lesson = db.readLesson(conceptId);
      if (lesson && db.markRead(conceptId)) publishSky();
      return lesson;
    },

    async submitCheck(conceptId, answers) {
      const graded = db.gradeCheck(conceptId, answers);
      if (!graded) return null;

      const { result, title, edgeIds } = graded;
      if (result.passed && result.xpGained > 0) {
        await agent.post(
          formatHandoff(`Mastered: ${title}. +${result.xpGained} XP.`, {
            type: 'concept.mastered',
            concept: conceptId,
            hop: 1,
          }),
        );
        emit({ type: 'mastered', conceptId, edgeIds, xpGained: result.xpGained });
        publishSky();
        syncMindMap();
      }
      return result;
    },
  };
}

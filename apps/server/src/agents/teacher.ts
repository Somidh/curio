import {
  checkLesson,
  LessonDraft,
  MapDocument,
  type LessonsDocument,
  type Llm,
} from '@curio/core';
import {
  formatHandoff,
  MAX_HOPS,
  parseHandoff,
  SwitchAgent,
  type Handoff,
  type RoomMessage,
} from '@curio/switch-client';
import { systemPrompt } from '../prompts';
import { createDocument, readDocument, runInPool, type Connection } from './shared';

const NAME = 'teacher';
const PARALLEL_LESSONS = 3;
const LESSON_ROUNDS = 5;
const LESSON_RETRY_MS = 15_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type MapConcept = MapDocument['concepts'][number];

export function createTeacher(connection: Connection, llm: Llm): SwitchAgent {
  const lessonSystem = systemPrompt(NAME, './teacher.md');
  const agent = new SwitchAgent({ ...connection, name: NAME, onMessage });

  async function onMessage(message: RoomMessage): Promise<void> {
    if (!message.addressed || message.senderName === NAME) return;

    const handoff = parseHandoff(message.body);
    if (handoff?.type === 'map.ready' && handoff.doc && handoff.hop < MAX_HOPS) {
      await writeLessons(handoff);
    }
  }

  function writeLesson(map: MapDocument, concept: MapConcept): Promise<LessonDraft> {
    const allConcepts = [...map.concepts, ...map.known];
    const linked = concept.links.flatMap((link) => {
      const target = allConcepts.find((item) => item.id === link.toId);
      return target ? [{ ...target, kind: link.kind, why: link.why }] : [];
    });
    const known = linked.filter((item) => item.kind === 'prior');
    const earlier = linked.filter((item) => item.kind === 'within');
    const describe = (items: typeof linked) =>
      items.map((item) => `${item.id} | ${item.title} | ${item.why}`).join('\n') || 'None.';

    return llm.generateJson({
      system: lessonSystem,
      prompt: `Topic: ${map.title}\nConcept: ${concept.title}\nWhat it is: ${concept.summary}\n\nConcepts the learner already knows, linked to this one (id | title | why):\n${describe(known)}\n\nEarlier concepts in this topic (id | title | why):\n${describe(earlier)}`,
      schema: LessonDraft,
      validate: (value) => checkLesson(value, new Set(linked.map((item) => item.id))),
    });
  }

  async function writeLessons(handoff: Handoff): Promise<void> {
    const map = MapDocument.parse(await readDocument(agent, String(handoff.doc)));
    const shared: LessonsDocument = { topicId: map.topicId, lessons: {} };
    const documentId = await createDocument(
      agent,
      `lessons-${map.topicId}`,
      `Lessons for "${map.title}", by concept id.`,
      shared,
    );

    // Only one update can run at a time, or a slower one would overwrite a newer one.
    let reports: Promise<unknown> = Promise.resolve();

    function report(concept: MapConcept, lesson: LessonDraft | null) {
      reports = reports.then(async () => {
        if (lesson) {
          shared.lessons[concept.id] = lesson;
          await agent.op('update_room_document', {
            document_id: documentId,
            content: JSON.stringify(shared),
          });
        }
        await agent.send(
          formatHandoff(
            lesson ? `Lesson ready: ${concept.title}.` : `I could not write "${concept.title}".`,
            {
              type: lesson ? 'lesson.ready' : 'lesson.failed',
              topic: map.topicId,
              concept: concept.id,
              doc: documentId,
              hop: handoff.hop + 1,
            },
          ),
          ['keeper'],
        );
      });
      return reports;
    }

    // A model outage shouldn't strand a star, so failed lessons get more rounds.
    let waiting = map.concepts;
    for (let round = 0; waiting.length > 0 && round < LESSON_ROUNDS; round += 1) {
      if (round > 0) await sleep(LESSON_RETRY_MS);
      const failed: MapConcept[] = [];
      await runInPool(waiting, PARALLEL_LESSONS, async (concept) => {
        const lesson = await writeLesson(map, concept).catch((error: Error) => {
          connection.log?.(`[${NAME}] ${concept.title}: ${error.message.slice(0, 120)}`);
          return null;
        });
        if (lesson) await report(concept, lesson);
        else failed.push(concept);
      });
      waiting = failed;
    }
    await Promise.all(waiting.map((concept) => report(concept, null)));
  }

  return agent;
}

import { randomBytes } from 'node:crypto';
import { Assessment, type Llm, type TargetDocument } from '@curio/core';
import {
  formatHandoff,
  MAX_HOPS,
  parseHandoff,
  stripHandoff,
  stripMentions,
  SwitchAgent,
  type RoomMessage,
} from '@curio/switch-client';
import { systemPrompt } from '../prompts';
import { TEAM_NAMES } from '../team';
import { createDocument, readMindMap, type Connection } from './shared';

const NAME = 'scout';
const MIN_TOPIC_LENGTH = 3;

export function createScout(connection: Connection, llm: Llm): SwitchAgent {
  const system = systemPrompt(NAME, './scout.md');
  const agent = new SwitchAgent({ ...connection, name: NAME, onMessage });

  async function onMessage(message: RoomMessage): Promise<void> {
    if (!message.addressed || message.senderName === NAME) return;

    const handoff = parseHandoff(message.body);
    const text = stripMentions(stripHandoff(message.body));

    if (handoff?.type === 'topic.requested' && handoff.topic && handoff.hop < MAX_HOPS) {
      await assess(String(handoff.topic), text.replace(/^.*?topic:\s*/is, ''), handoff.hop + 1);
    } else if (!handoff && !TEAM_NAMES.has(message.senderName)) {
      // A person started a topic from team chat.
      if (text.length < MIN_TOPIC_LENGTH) {
        await agent.post('Tell me what you are curious about, like "@scout how tides work".');
        return;
      }
      await assess(`t_${randomBytes(4).toString('hex')}`, text, 1);
    }
  }

  async function assess(topicId: string, topic: string, hop: number): Promise<void> {
    await agent.post(`Checking what you already know that relates to "${topic}".`);

    try {
      const { concepts } = await readMindMap(agent);
      const known = concepts.filter((concept) => concept.status === 'mastered');
      const knownIds = new Set(known.map((concept) => concept.id));
      const list = known
        .map((concept) => `${concept.id} | ${concept.title} | ${concept.summary}`)
        .join('\n');

      const assessment = await llm.generateJson({
        system,
        prompt: `Topic: ${topic}\n\nMastered concepts (id | title | summary):\n${list || 'None yet.'}`,
        schema: Assessment,
        validate: ({ related }) => {
          const invented = related.find((id) => !knownIds.has(id));
          return invented ? `"${invented}" is not a concept id you were given.` : null;
        },
      });

      const document: TargetDocument = {
        topicId,
        topic,
        target: assessment.target,
        level: assessment.level,
        related: known.filter((concept) => assessment.related.includes(concept.id)),
      };
      const documentId = await createDocument(
        agent,
        `target-${topicId}`,
        `Learning target for "${topic}".`,
        document,
      );

      await agent.send(
        formatHandoff(`${assessment.note} Target: ${assessment.target}`, {
          type: 'topic.assessed',
          topic: topicId,
          doc: documentId,
          hop,
        }),
        ['curriculum'],
      );
    } catch (error) {
      connection.log?.(`[${NAME}] assessing failed: ${(error as Error).message}`);
      await agent.send(
        formatHandoff(`I could not assess "${topic}".`, { type: 'topic.failed', topic: topicId, hop }),
        ['keeper'],
      );
    }
  }

  return agent;
}

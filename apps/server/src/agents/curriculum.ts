import {
  checkMapLinks,
  ConceptMapDraft,
  resolveConcepts,
  TargetDocument,
  type Llm,
  type MapDocument,
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
import { createDocument, readDocument, type Connection } from './shared';

const NAME = 'curriculum';

export function createCurriculum(connection: Connection, llm: Llm): SwitchAgent {
  const system = systemPrompt(NAME, './curriculum.md');
  const agent = new SwitchAgent({ ...connection, name: NAME, onMessage });

  async function onMessage(message: RoomMessage): Promise<void> {
    if (!message.addressed || message.senderName === NAME) return;

    const handoff = parseHandoff(message.body);
    if (handoff?.type === 'topic.assessed' && handoff.doc && handoff.hop < MAX_HOPS) {
      await mapTopic(handoff);
    }
  }

  async function mapTopic(handoff: Handoff): Promise<void> {
    const topicId = String(handoff.topic);
    const hop = handoff.hop + 1;

    try {
      const target = TargetDocument.parse(await readDocument(agent, String(handoff.doc)));
      const knownIds = new Set(target.related.map((concept) => concept.id));
      const known = target.related
        .map((concept) => `${concept.id} | ${concept.title} | ${concept.summary}`)
        .join('\n');

      const draft = await llm.generateJson({
        system,
        prompt: `Topic: ${target.topic}\nTarget: ${target.target}\nLearner level: ${target.level}\n\nKnown concepts (id | title | summary):\n${known || 'None.'}`,
        schema: ConceptMapDraft,
        validate: (value) =>
          checkMapLinks(
            value,
            knownIds,
            target.related.map((concept) => concept.title),
          ),
      });

      const document: MapDocument = {
        topicId,
        title: draft.topicTitle,
        cluster: draft.cluster,
        summary: draft.summary,
        concepts: resolveConcepts(topicId, draft),
        known: target.related,
      };
      const documentId = await createDocument(
        agent,
        `map-${topicId}`,
        `Concept map for "${draft.topicTitle}".`,
        document,
      );

      const priorLinks = document.concepts
        .flatMap((concept) => concept.links)
        .filter((link) => link.kind === 'prior').length;
      await agent.send(
        formatHandoff(
          `Mapped ${document.concepts.length} concepts for "${draft.topicTitle}", with ${priorLinks} links to what you already know. ${draft.summary}`,
          { type: 'map.ready', topic: topicId, doc: documentId, hop },
        ),
        ['keeper', 'teacher'],
      );
    } catch (error) {
      connection.log?.(`[${NAME}] mapping failed: ${(error as Error).message}`);
      await agent.send(
        formatHandoff('I could not map this topic.', { type: 'topic.failed', topic: topicId, hop }),
        ['keeper'],
      );
    }
  }

  return agent;
}

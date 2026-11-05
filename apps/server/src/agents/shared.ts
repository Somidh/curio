import { MindMap } from '@curio/core';
import type { AgentOptions, SwitchAgent } from '@curio/switch-client';

export type Connection = Omit<AgentOptions, 'name' | 'onMessage' | 'filter'>;

export const MIND_MAP_NAME = 'mind-map';

export async function readDocument(agent: SwitchAgent, id: string): Promise<unknown> {
  const documents = await agent.op<{ content: string }[]>('load_internal_documents', { ids: [id] });
  const content = documents[0]?.content;
  if (!content) throw new Error(`Room document ${id} is empty.`);
  return JSON.parse(content);
}

export async function findDocument(agent: SwitchAgent, name: string): Promise<string | null> {
  const { documents } = await agent.op<{ documents: { id: string; name: string }[] }>(
    'list_references',
  );
  return documents.find((document) => document.name === name)?.id ?? null;
}

/** What the learner knows, read from the room document keeper owns. */
export async function readMindMap(agent: SwitchAgent): Promise<MindMap> {
  const id = await findDocument(agent, MIND_MAP_NAME);
  return id ? MindMap.parse(await readDocument(agent, id)) : { concepts: [], edges: [] };
}

export async function createDocument(
  agent: SwitchAgent,
  name: string,
  description: string,
  content: unknown,
): Promise<string> {
  const { document_id: id } = await agent.op<{ document_id: string }>('create_room_document', {
    name,
    description,
    instructions: `JSON. ${agent.name} owns this document.`,
    content: JSON.stringify(content),
  });
  return id;
}

export async function runInPool<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
  const queue = [...items];
  const worker = async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await work(item);
  };
  await Promise.all(Array.from({ length: size }, worker));
}

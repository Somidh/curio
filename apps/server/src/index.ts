import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { createLlm } from '@curio/core';
import { openDb } from '@curio/db';
import { createCurriculum } from './agents/curriculum';
import { createKeeper } from './agents/keeper';
import { createScout } from './agents/scout';
import { createTeacher } from './agents/teacher';
import { createApp, createBus } from './http/routes';
import { readTeamStore, repoRoot, ROOM_NAME, TEAM } from './team';

const PORT = Number(process.env.PORT ?? 8787);

const apiUrl = process.env.SWITCH_API_URL ?? 'http://localhost:8000';
const store = readTeamStore();
const { roomId } = store;

if (!roomId || TEAM.some((agent) => !store.agents[agent.name])) {
  console.error('The agent team is not set up yet. Run pnpm bootstrap first.');
  process.exit(1);
}

const llm = createLlm({
  provider: process.env.LLM_PROVIDER ?? 'gemini',
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL,
});

const db = openDb(join(repoRoot, 'data', 'curio.db'));
const bus = createBus();

function connection(name: string) {
  return { apiUrl, roomId: roomId!, log: console.log, ...store.agents[name]! };
}

const keeper = createKeeper(
  {
    ...connection('keeper'),
    onStatus: (connected) => bus.emit({ type: 'switch', connected }),
  },
  db,
  bus.emit,
);
const team = [
  createScout(connection('scout'), llm),
  createCurriculum(connection('curriculum'), llm),
  createTeacher(connection('teacher'), llm),
];

serve({ fetch: createApp(db, keeper, bus).fetch, port: PORT }, () => {
  console.log(`Curio server on http://localhost:${PORT}`);
});

await Promise.all([keeper.start(), ...team.map((agent) => agent.start())]);
console.log(`Agents connected to #${ROOM_NAME}`);

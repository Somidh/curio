import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AgentCredentials, AgentDefinition } from '@curio/switch-client';

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export const ROOM_NAME = 'curio-mind';

export const ROOM_DESCRIPTION = 'The Curio team maps, teaches and debates what you are curious about.';

export const ROOM_INSTRUCTIONS = [
  'This is the Curio team room.',
  'Hand work to a teammate by addressing them with @name.',
  'Every handoff ends with a [curio v1 ...] line, which code reads.',
  'To learn something from chat, write: @scout <what you are curious about>.',
  'During a debate, post in its thread and the next speaker will answer you.',
].join(' ');

export const TEAM: AgentDefinition[] = [
  {
    name: 'keeper',
    displayName: 'Keeper',
    description: 'Keeps your constellation: progress, XP and the record of what you know. Uses no LLM.',
  },
  {
    name: 'scout',
    displayName: 'Scout',
    description: 'Works out what you already know that relates to a new topic.',
  },
  {
    name: 'curriculum',
    displayName: 'Curriculum',
    description: 'Turns a topic into connected concepts on your constellation.',
  },
  {
    name: 'teacher',
    displayName: 'Teacher',
    description: 'Teaches each concept, connects it to what you know, and moderates debates.',
  },
  {
    name: 'historian',
    displayName: 'Historian',
    description: 'Argues one side of a debate from evidence.',
  },
  {
    name: 'contrarian',
    displayName: 'Contrarian',
    description: 'Argues the other side of a debate by testing its assumptions.',
  },
  {
    name: 'curiosity-scout',
    displayName: 'Curiosity Scout',
    description: 'Watches what you learn and speaks up when it spots a hidden connection.',
  },
];

export const TEAM_NAMES = new Set(TEAM.map((agent) => agent.name));

export type StoredAgent = AgentCredentials & { connectionId: string };

export type TeamStore = {
  roomId?: string;
  agents: Record<string, StoredAgent>;
};

const storePath = join(repoRoot, '.agents.local.json');

export function readTeamStore(): TeamStore {
  if (!existsSync(storePath)) return { agents: {} };
  return JSON.parse(readFileSync(storePath, 'utf8')) as TeamStore;
}

export function writeTeamStore(store: TeamStore): void {
  writeFileSync(storePath, JSON.stringify(store, null, 2), { mode: 0o600 });
}

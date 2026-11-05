import { readFileSync } from 'node:fs';

function read(file: string): string {
  return readFileSync(new URL(file, import.meta.url), 'utf8').trim();
}

/** The shared preamble followed by the agent's own instructions. */
export function systemPrompt(agentName: string, file: string): string {
  return `${read('./shared.md').replace('{name}', agentName)}\n\n${read(file)}`;
}

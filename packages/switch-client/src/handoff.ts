// Every agent-to-agent message ends with one machine-readable line:
//   [curio v1 type=debate.turn debate=d_12 turn=3 of=6 hop=5]

export const MAX_HOPS = 12;

export type Handoff = {
  type: string;
  hop: number;
  topic?: string;
  doc?: string;
  rev?: number;
  [key: string]: string | number | undefined;
};

const LINE = /\[curio v1 ([^\]]*)\]\s*$/;

export function formatHandoff(text: string, fields: Handoff): string {
  const pairs = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`);
  return `${text}\n[curio v1 ${pairs.join(' ')}]`;
}

export function parseHandoff(body: string): Handoff | null {
  const match = LINE.exec(body);
  if (!match?.[1]) return null;

  const fields: Record<string, string> = {};
  for (const pair of match[1].trim().split(/\s+/)) {
    const at = pair.indexOf('=');
    if (at > 0) fields[pair.slice(0, at)] = pair.slice(at + 1);
  }

  const hop = Number(fields.hop);
  if (!fields.type || !Number.isInteger(hop)) return null;

  const handoff: Handoff = { ...fields, type: fields.type, hop, rev: undefined };
  if (fields.rev === undefined) delete handoff.rev;
  else handoff.rev = Number(fields.rev);
  return handoff;
}

/** The readable part of a message, without the handoff line. */
export function stripHandoff(body: string): string {
  return body.replace(LINE, '').trim();
}

/** The message text without its leading @mentions. */
export function stripMentions(body: string): string {
  return body.replace(/^(\s*@[a-z0-9._-]+\s*)+/i, '').trim();
}

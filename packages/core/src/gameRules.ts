export const XP = {
  lesson: 20,
  debate: 30,
  mastery: 100,
  firstTry: 25,
  connection: 50,
} as const;

export const PASS_SCORE = 2;

const LEVELS = [
  { name: 'Wanderer', floor: 0 },
  { name: 'Asker', floor: 200 },
  { name: 'Explorer', floor: 500 },
  { name: 'Scholar', floor: 1000 },
  { name: 'Polymath', floor: 2000 },
];

export function levelFor(xp: number) {
  let index = 0;
  LEVELS.forEach((level, at) => {
    if (xp >= level.floor) index = at;
  });
  return {
    level: index + 1,
    levelName: LEVELS[index]!.name,
    levelFloor: LEVELS[index]!.floor,
    nextLevelAt: LEVELS[index + 1]?.floor ?? null,
  };
}

/** A calendar date as YYYY-MM-DD in the machine's own time zone. */
export function dayOf(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function daysBetween(earlier: string, later: string): number {
  return Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86_400_000);
}

/** The streak after activity today: same day holds, next day grows, a gap restarts. */
export function nextStreak(streakDays: number, lastActiveDay: string | null, today: string): number {
  if (!lastActiveDay) return 1;
  const gap = daysBetween(lastActiveDay, today);
  if (gap <= 0) return Math.max(streakDays, 1);
  return gap === 1 ? streakDays + 1 : 1;
}

export function masteryXp(passed: boolean, firstTry: boolean): number {
  if (!passed) return 0;
  return XP.mastery + (firstTry ? XP.firstTry : 0);
}

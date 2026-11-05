import { describe, expect, it } from 'vitest';
import { levelFor, masteryXp, nextStreak, XP } from './gameRules';
import type { ConceptMapDraft, LessonDraft } from './schemas';
import { checkLesson, checkMapLinks, resolveConcepts } from './validators';

const concept = (title: string, links: { to: string; why: string }[]) => ({
  title,
  summary: `About ${title}.`,
  links,
});

const map = (concepts: ConceptMapDraft['concepts']): ConceptMapDraft => ({
  topicTitle: 'Test',
  cluster: 'history',
  summary: 'A test map.',
  concepts,
});

describe('gameRules', () => {
  it('grows a streak on consecutive days and restarts after a gap', () => {
    expect(nextStreak(0, null, '2026-11-05')).toBe(1);
    expect(nextStreak(3, '2026-11-05', '2026-11-05')).toBe(3);
    expect(nextStreak(3, '2026-11-04', '2026-11-05')).toBe(4);
    expect(nextStreak(3, '2026-11-02', '2026-11-05')).toBe(1);
    expect(nextStreak(9, '2026-10-31', '2026-11-01')).toBe(10);
  });

  it('names levels at their thresholds', () => {
    expect(levelFor(0).levelName).toBe('Wanderer');
    expect(levelFor(199).levelName).toBe('Wanderer');
    expect(levelFor(200).levelName).toBe('Asker');
    expect(levelFor(5000)).toMatchObject({ levelName: 'Polymath', nextLevelAt: null });
  });

  it('adds the first-try bonus only to a pass', () => {
    expect(masteryXp(true, true)).toBe(XP.mastery + XP.firstTry);
    expect(masteryXp(true, false)).toBe(XP.mastery);
    expect(masteryXp(false, true)).toBe(0);
  });
});

describe('checkMapLinks', () => {
  const known = new Set(['t_old_c1']);

  it('accepts earlier and known links', () => {
    const draft = map([
      concept('One', [{ to: 't_old_c1', why: 'It builds on this.' }]),
      concept('Two', [{ to: '#1', why: 'It follows from one.' }]),
    ]);
    expect(checkMapLinks(draft, known)).toBeNull();
  });

  it('rejects invented ids, forward links and unlinked concepts', () => {
    expect(
      checkMapLinks(map([concept('One', [{ to: 'made_up', why: 'Not real.' }])]), known),
    ).toContain('made_up');
    expect(
      checkMapLinks(
        map([concept('One', []), concept('Two', [{ to: '#2', why: 'Links to itself.' }])]),
        known,
      ),
    ).toContain('#2');
    expect(checkMapLinks(map([concept('One', []), concept('Two', [])]), known)).toContain('#2');
  });

  it('rejects a title the learner already knows', () => {
    const draft = map([concept('Old Idea', [])]);
    expect(checkMapLinks(draft, known, ['old idea'])).toContain('already a known concept');
  });

  it('resolves links to real ids and kinds', () => {
    const draft = map([
      concept('One', [{ to: 't_old_c1', why: 'It builds on this.' }]),
      concept('Two', [{ to: '#1', why: 'It follows from one.' }]),
    ]);
    const [first, second] = resolveConcepts('t_new', draft);
    expect(first!.links[0]).toMatchObject({ toId: 't_old_c1', kind: 'prior' });
    expect(second).toMatchObject({ id: 't_new_c2' });
    expect(second!.links[0]).toMatchObject({ toId: 't_new_c1', kind: 'within' });
  });
});

describe('checkLesson', () => {
  const question = {
    prompt: 'Which one?',
    options: ['a', 'b', 'c', 'd'],
    correctIndex: 0,
    explanation: 'Because a.',
  };
  const lesson = (conceptId: string | null): LessonDraft => ({
    paragraphs: ['A paragraph that is long enough.', 'Another one that is long enough.'],
    connection: conceptId ? { conceptId, sentence: 'This builds on it.' } : null,
    questions: [question, question, question],
  });

  it('allows no connection, or one it was given', () => {
    expect(checkLesson(lesson(null), new Set())).toBeNull();
    expect(checkLesson(lesson('c1'), new Set(['c1']))).toBeNull();
  });

  it('rejects an invented connection and repeated options', () => {
    expect(checkLesson(lesson('c9'), new Set(['c1']))).toContain('c9');
    const repeated = lesson(null);
    repeated.questions = [{ ...question, options: ['a', 'a', 'c', 'd'] }, question, question];
    expect(checkLesson(repeated, new Set())).toContain('repeats');
  });
});

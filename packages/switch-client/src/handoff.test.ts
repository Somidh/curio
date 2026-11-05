import { describe, expect, it } from 'vitest';
import { formatHandoff, parseHandoff, stripHandoff, stripMentions } from './handoff';

describe('handoff line', () => {
  it('round-trips the fields', () => {
    const body = formatHandoff('Road planned.', {
      type: 'quest.planned',
      quest: 'q_12',
      doc: 'abc-123',
      rev: 1,
      hop: 2,
    });
    expect(parseHandoff(`@game-master ${body}`)).toEqual({
      type: 'quest.planned',
      quest: 'q_12',
      doc: 'abc-123',
      rev: 1,
      hop: 2,
    });
  });

  it('leaves out undefined fields', () => {
    expect(formatHandoff('Hi', { type: 'a', hop: 1, doc: undefined })).toBe(
      'Hi\n[curio v1 type=a hop=1]',
    );
  });

  it('rejects messages without a valid line', () => {
    expect(parseHandoff('@coach yes')).toBeNull();
    expect(parseHandoff('[curio v1 quest=q_1 hop=1]')).toBeNull();
    expect(parseHandoff('[curio v1 type=a hop=x]')).toBeNull();
  });

  it('strips the line and the mentions for display', () => {
    const body = '@resource-scout @quiz-master Road planned.\n[curio v1 type=a hop=1]';
    expect(stripMentions(stripHandoff(body))).toBe('Road planned.');
  });
});

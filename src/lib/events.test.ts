import { describe, it, expect } from 'vitest';
import {
  appendEvent,
  daysStudiedWithin,
  isQualifying,
  lastStudyDate,
  makeEvent,
  studyDates,
  QUALIFYING_TYPES,
  type StudyEvent,
} from './events';

const at = (localDate: string, type: StudyEvent['type'] = 'mastery_changed', id = localDate + type): StudyEvent => ({
  id,
  type,
  occurredAt: Date.parse(localDate + 'T12:00:00Z'),
  localDate,
});

describe('makeEvent', () => {
  it('stamps the device-local date at write time', () => {
    const e = makeEvent('mastery_changed', { itemId: 'political:I.A.1', from: 0, to: 1 }, new Date(2026, 8, 21, 22, 30));
    expect(e.localDate).toBe('2026-09-21');
  });

  it('records the transition, so history can be replayed', () => {
    const e = makeEvent('mastery_changed', { itemId: 'x', from: 1, to: 3 });
    expect(e.type).toBe('mastery_changed');
    expect(e.itemId).toBe('x');
    expect(e.from).toBe(1);
    expect(e.to).toBe(3);
  });

  it('gives every event a unique id', () => {
    const a = makeEvent('flag_toggled', { itemId: 'x' });
    const b = makeEvent('flag_toggled', { itemId: 'x' });
    expect(a.id).not.toBe(b.id);
  });

  it('carries an occurredAt timestamp', () => {
    const when = new Date(2026, 8, 21, 22, 30);
    expect(makeEvent('session_opened', {}, when).occurredAt).toBe(when.getTime());
  });
});

describe('appendEvent', () => {
  it('appends without mutating the existing log', () => {
    const log: StudyEvent[] = [at('2026-09-21')];
    const next = appendEvent(log, at('2026-09-22'));
    expect(log).toHaveLength(1);
    expect(next).toHaveLength(2);
  });

  it('is idempotent on a repeated id, so a sync retry cannot double-count', () => {
    const e = at('2026-09-21');
    const once = appendEvent([], e);
    const twice = appendEvent(once, e);
    expect(twice).toHaveLength(1);
  });

  it('never rewrites an earlier event', () => {
    const first = at('2026-09-21');
    const next = appendEvent([first], at('2026-09-22'));
    expect(next[0]).toEqual(first);
  });
});

describe('isQualifying', () => {
  it('counts real work', () => {
    expect(isQualifying(at('2026-09-21', 'mastery_changed'))).toBe(true);
    expect(isQualifying(at('2026-09-21', 'flag_toggled'))).toBe(true);
    expect(isQualifying(at('2026-09-21', 'note_saved'))).toBe(true);
    expect(isQualifying(at('2026-09-21', 'link_added'))).toBe(true);
  });

  it('does NOT count merely opening the app', () => {
    expect(isQualifying(at('2026-09-21', 'session_opened'))).toBe(false);
  });

  it('does not count a part unlock on its own — opening a door is not studying', () => {
    expect(isQualifying(at('2026-09-21', 'part_unlocked'))).toBe(false);
  });

  it('exposes the qualifying set without session_opened', () => {
    expect(QUALIFYING_TYPES.has('session_opened')).toBe(false);
  });
});

describe('studyDates', () => {
  it('is empty for an empty log', () => {
    expect(studyDates([])).toEqual([]);
  });

  it('returns distinct dates, sorted ascending', () => {
    const log = [at('2026-09-23', 'mastery_changed', 'a'), at('2026-09-21', 'mastery_changed', 'b'), at('2026-09-23', 'flag_toggled', 'c')];
    expect(studyDates(log)).toEqual(['2026-09-21', '2026-09-23']);
  });

  it('excludes days that contain only session_opened events', () => {
    const log = [at('2026-09-21', 'session_opened', 'a'), at('2026-09-22', 'mastery_changed', 'b')];
    expect(studyDates(log)).toEqual(['2026-09-22']);
  });

  it('counts a day that has both a session open and real work', () => {
    const log = [at('2026-09-21', 'session_opened', 'a'), at('2026-09-21', 'note_saved', 'b')];
    expect(studyDates(log)).toEqual(['2026-09-21']);
  });
});

describe('daysStudiedWithin', () => {
  // The dashboard's PRIMARY consistency figure (design.md 8.1 rule 5): a number
  // no single bad day can destroy.
  const today = new Date(2026, 8, 30); // 2026-09-30

  it('is 0 for an empty log', () => {
    expect(daysStudiedWithin([], 30, today)).toBe(0);
  });

  it('counts distinct study days inside the window', () => {
    const log = [at('2026-09-28', 'mastery_changed', 'a'), at('2026-09-29', 'mastery_changed', 'b')];
    expect(daysStudiedWithin(log, 30, today)).toBe(2);
  });

  it('includes today', () => {
    expect(daysStudiedWithin([at('2026-09-30')], 30, today)).toBe(1);
  });

  it('includes the oldest day still inside the window', () => {
    // window of 30 days ending today = 2026-09-01 .. 2026-09-30 inclusive
    expect(daysStudiedWithin([at('2026-09-01')], 30, today)).toBe(1);
  });

  it('excludes a day that has fallen out of the window', () => {
    expect(daysStudiedWithin([at('2026-08-31')], 30, today)).toBe(0);
  });

  it('ignores gaps — it measures distribution, not consecutiveness', () => {
    const log = [at('2026-09-02', 'mastery_changed', 'a'), at('2026-09-20', 'mastery_changed', 'b'), at('2026-09-30', 'mastery_changed', 'c')];
    expect(daysStudiedWithin(log, 30, today)).toBe(3);
  });
});

describe('lastStudyDate', () => {
  it('is null when nothing has been studied', () => {
    expect(lastStudyDate([])).toBeNull();
    expect(lastStudyDate([at('2026-09-21', 'session_opened')])).toBeNull();
  });

  it('returns the most recent qualifying day', () => {
    const log = [at('2026-09-21', 'mastery_changed', 'a'), at('2026-09-25', 'mastery_changed', 'b')];
    expect(lastStudyDate(log)).toBe('2026-09-25');
  });
});

import { describe, expect, it } from 'vitest';
import {
  formatMinutes,
  heatmapWeeks,
  lastTouchedItem,
  mondayOf,
  needsAttention,
  newlyCoveredBetween,
  nextMilestones,
  paceOf,
  parseTimeRange,
  routineNow,
  streakOf,
  suggestItems,
} from './dashboard';
import { STAGES } from './daisy';
import type { StudyEvent } from './events';
import type { Item, LockState, Part, Subject } from './progress';
import type { Schedule, ScheduleRow } from './schedule';

const at = (date: string, hh = 12, mm = 0) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, hh, mm);
};

let n = 0;
const ev = (localDate: string, fields: Partial<StudyEvent> = {}): StudyEvent => ({
  id: `e${++n}`,
  type: 'mastery_changed',
  occurredAt: n,
  localDate,
  ...fields,
});

describe('streakOf — grace-first (design.md 8.1)', () => {
  it('is zero with no history', () => {
    expect(streakOf([], at('2026-09-24'))).toEqual({
      current: 0,
      best: 0,
      graceDates: [],
      studiedToday: false,
    });
  });

  it('counts consecutive days ending today', () => {
    const s = streakOf(['2026-09-22', '2026-09-23', '2026-09-24'], at('2026-09-24'));
    expect(s.current).toBe(3);
    expect(s.studiedToday).toBe(true);
  });

  it('treats an empty today as pending, not missed', () => {
    const s = streakOf(['2026-09-22', '2026-09-23'], at('2026-09-24'));
    expect(s.current).toBe(2);
    expect(s.graceDates).toEqual([]);
  });

  it('forgives one missed day in a 7-day window and says which', () => {
    const s = streakOf(['2026-09-20', '2026-09-21', '2026-09-23', '2026-09-24'], at('2026-09-24'));
    expect(s.current).toBe(5);
    expect(s.graceDates).toEqual(['2026-09-22']);
  });

  it('ends on a second miss inside the same window', () => {
    // Misses on the 20th and 22nd are two days apart.
    const s = streakOf(['2026-09-19', '2026-09-21', '2026-09-23', '2026-09-24'], at('2026-09-24'));
    expect(s.current).toBe(4); // 21st to 24th, grace on the 22nd
  });

  it('allows misses that are a full week apart', () => {
    const days = [];
    for (let d = 1; d <= 20; d++) if (d !== 5 && d !== 12) days.push(`2026-09-${String(d).padStart(2, '0')}`);
    expect(streakOf(days, at('2026-09-20')).current).toBe(20);
  });

  it('keeps the best streak after a break', () => {
    const s = streakOf(
      ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-20'],
      at('2026-09-20')
    );
    expect(s.current).toBe(1);
    expect(s.best).toBe(4);
  });

  it('never starts a streak on a grace day', () => {
    // Nothing yesterday or the day before: the streak is gone, not "1 grace day".
    expect(streakOf(['2026-09-10'], at('2026-09-24')).current).toBe(0);
  });
});

describe('heatmapWeeks', () => {
  it('builds Monday-first weeks ending with the current one', () => {
    const cols = heatmapWeeks([], 4, at('2026-09-24')); // a Thursday
    expect(cols).toHaveLength(4);
    expect(cols[3][0].date).toBe('2026-09-21');
    expect(cols[0][0].date).toBe('2026-08-31');
  });

  it('counts qualifying events only and marks future days', () => {
    const log = [
      ev('2026-09-24'),
      ev('2026-09-24'),
      ev('2026-09-24', { type: 'session_opened' }),
    ];
    const week = heatmapWeeks(log, 1, at('2026-09-24'))[0];
    const thu = week[3];
    expect(thu.count).toBe(2);
    expect(thu.level).toBe(1);
    expect(week[4].future).toBe(true);
    expect(week[2].future).toBe(false);
  });

  it('finds the Monday of a Sunday', () => {
    expect(mondayOf('2026-09-27')).toBe('2026-09-21');
    expect(mondayOf('2026-09-21')).toBe('2026-09-21');
  });
});

describe('pace', () => {
  const calendar = [
    { week: 1, startDate: '2026-09-21', phase: 'First pass', focus: 'A', targetItems: 42 },
    { week: 2, startDate: '2026-09-28', phase: 'First pass', focus: 'A', targetItems: 42 },
  ];

  it('counts only first touches as new coverage', () => {
    const log = [
      ev('2026-09-22', { itemId: 'a', from: 0, to: 1 }),
      ev('2026-09-22', { itemId: 'a', from: 1, to: 2 }),
      ev('2026-09-23', { itemId: 'b', from: 0, to: 1 }),
    ];
    expect(newlyCoveredBetween(log, '2026-09-21', '2026-09-27')).toBe(2);
  });

  it('compares the week against what should be done by today', () => {
    const log = Array.from({ length: 30 }, (_, i) =>
      ev('2026-09-22', { itemId: `i${i}`, from: 0, to: 1 })
    );
    // Thursday is day 4 of 7: 24 of 42 expected.
    const p = paceOf(log, calendar, 1000, 30, '2027-09-05', at('2026-09-24'));
    expect(p.weekExpected).toBe(24);
    expect(p.status).toBe('ahead');
    expect(p.remaining).toBe(970);
    expect(p.perDayNeeded).toBe(Math.ceil(970 / 346));
  });

  it('reports behind when well short of the expected count', () => {
    const p = paceOf([], calendar, 1000, 0, '2027-09-05', at('2026-09-26'));
    expect(p.status).toBe('behind');
  });
});

describe('parseTimeRange', () => {
  it('reads a range with one meridiem', () => {
    expect(parseTimeRange('12:30–1:00 PM')).toEqual({ start: 750, end: 780 });
  });
  it('flips the borrowed meridiem when it would run backwards', () => {
    expect(parseTimeRange('6:00–12:00 PM')).toEqual({ start: 360, end: 720 });
  });
  it('wraps overnight blocks past midnight', () => {
    expect(parseTimeRange('9:00 PM–6:00 AM')).toEqual({ start: 1260, end: 1800 });
  });
  it('ignores text that is not a range', () => {
    expect(parseTimeRange('Breaks (2 × 15 min)')).toBeNull();
  });
  it('formats minutes back to a clock', () => {
    expect(formatMinutes(750)).toBe('12:30 PM');
    expect(formatMinutes(1800)).toBe('6:00 AM');
  });
});

describe('routineNow', () => {
  const row = (time: string, activity: string): ScheduleRow => ({
    id: activity,
    time,
    activity,
    notes: '',
    highlight: false,
  });
  const schedule: Schedule = {
    weekdays: [row('1:00–2:00 PM', 'Lunch'), row('2:00–5:00 PM', 'Review'), row('9:00 PM–6:00 AM', 'Shift')],
    weekends: [row('9:00 AM–12:00 PM', 'Mock exam')],
  };

  it('finds the current and next block', () => {
    const r = routineNow(schedule, at('2026-09-24', 13, 30));
    expect(r.now?.row.activity).toBe('Lunch');
    expect(r.next?.row.activity).toBe('Review');
  });

  it("carries yesterday's overnight block into the small hours", () => {
    const r = routineNow(schedule, at('2026-09-25', 2, 0)); // Friday 2 AM
    expect(r.now?.row.activity).toBe('Shift');
  });

  it('uses the weekend group on Saturday', () => {
    const r = routineNow(schedule, at('2026-09-26', 8, 0));
    expect(r.group).toBe('weekends');
    expect(r.next?.row.activity).toBe('Mock exam');
  });
});

describe('suggestItems', () => {
  const subjects = [
    { id: 's1', name: 'Focus', weight: 0.1 },
    { id: 's2', name: 'Heavy', weight: 0.3 },
  ] as Subject[];
  const parts = [
    { id: 'p1', subjectId: 's1', seq: 1 },
    { id: 'p2', subjectId: 's1', seq: 2 },
    { id: 'p3', subjectId: 's2', seq: 1 },
  ] as Part[];
  const mk = (id: string, partId: string, subjectId: string, seq: number) =>
    ({ id, partId, subjectId, seq }) as Item;
  const items = [
    mk('a', 'p1', 's1', 1),
    mk('b', 'p1', 's1', 2),
    mk('c', 'p2', 's1', 1),
    mk('d', 'p3', 's2', 1),
    mk('e', 'p3', 's2', 2),
  ];
  const itemsByPart = new Map<string, Item[]>();
  for (const i of items) itemsByPart.set(i.partId, [...(itemsByPart.get(i.partId) ?? []), i]);
  const itemById = new Map(items.map((i) => [i.id, i]));
  const lockStates = new Map<string, LockState>([
    ['p1', 'open'],
    ['p2', 'locked'],
    ['p3', 'open'],
  ]);

  it('puts flagged items first, then focus, then weight — skipping locked Parts', () => {
    const s = suggestItems({
      subjects,
      parts,
      itemsByPart,
      itemById,
      lockStates,
      progress: { a: 1 },
      flags: new Set(['e']),
      focus: 'Focus',
    });
    expect(s.map((x) => [x.item.id, x.reason])).toEqual([
      ['e', 'flagged'],
      ['b', 'focus'],
      ['d', 'next'],
    ]);
  });
});

describe('small helpers', () => {
  it('finds the last item touched', () => {
    const log = [ev('2026-09-20', { itemId: 'x' }), ev('2026-09-21', { type: 'session_opened' })];
    expect(lastTouchedItem(log)?.itemId).toBe('x');
    expect(lastTouchedItem([])).toBeNull();
  });

  it('ranks subjects by the grade still unseen', () => {
    const subjects = [
      { id: 'a', weight: 0.25 },
      { id: 'b', weight: 0.1 },
    ] as Subject[];
    const metrics = new Map([
      ['a', { coverage: 0.9, depth: 0.5 }],
      ['b', { coverage: 0, depth: 0 }],
    ]);
    const r = needsAttention(subjects, metrics, new Set(), new Map());
    expect(r[0].subject.id).toBe('b');
  });

  it('orders milestones nearest first', () => {
    const m = nextMilestones({
      touched: 45,
      totalItems: 1489,
      mastered: 3,
      weightedCoverage: 0.03,
      bestStreak: 1,
      daysStudied30: 2,
      stage: STAGES[1],
    });
    expect(m[0].id).toBe('items_50');
    expect(m).toHaveLength(3);
  });
});

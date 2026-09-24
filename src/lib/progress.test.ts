import { describe, it, expect } from 'vitest';
import {
  advanceMastery,
  coverage,
  demoteMastery,
  depth,
  weighted,
  partLockStates,
  partFill,
  daysUntil,
  searchItems,
  type Item,
  type Part,
  type Subject,
} from './progress';

const item = (id: string, partId: string, subjectId: string, text = 'x'): Item => ({
  id,
  ref: id.split(':')[1] ?? id,
  subjectId,
  partId,
  topic: 'T',
  subtopicPath: [],
  text,
  seq: 1,
});

const part = (id: string, subjectId: string, seq: number, itemIds: string[]): Part => ({
  id,
  subjectId,
  seq,
  title: `Part ${seq}`,
  itemIds,
  itemCount: itemIds.length,
});

describe('coverage', () => {
  const items = [item('a', 'p1', 's'), item('b', 'p1', 's'), item('c', 'p1', 's'), item('d', 'p1', 's')];

  it('is 0 with no progress', () => {
    expect(coverage(items, {})).toBe(0);
  });

  it('counts anything at Read Once or better, matching the workbook', () => {
    expect(coverage(items, { a: 1, b: 2, c: 3 })).toBeCloseTo(0.75);
  });

  it('ignores items explicitly set back to Not Started', () => {
    expect(coverage(items, { a: 0, b: 1 })).toBeCloseTo(0.25);
  });

  it('is 0 for an empty list rather than NaN', () => {
    expect(coverage([], { a: 3 })).toBe(0);
  });
});

describe('depth', () => {
  const items = [item('a', 'p1', 's'), item('b', 'p1', 's')];

  it('is 1 only when everything is Mastered', () => {
    expect(depth(items, { a: 3, b: 3 })).toBe(1);
  });

  it('distinguishes Read Once from Mastered, unlike coverage', () => {
    const readOnce = { a: 1 as const, b: 1 as const };
    expect(coverage(items, readOnce)).toBe(1);
    expect(depth(items, readOnce)).toBeCloseTo(1 / 3);
  });
});

describe('weighted', () => {
  const subjects: Subject[] = [
    { id: 'heavy', seq: 1, name: 'H', shortName: 'H', weight: 0.75, examDay: 1, examDate: '2027-09-05', examSlot: 'AM', partIds: [], itemCount: 1 },
    { id: 'light', seq: 2, name: 'L', shortName: 'L', weight: 0.25, examDay: 1, examDate: '2027-09-05', examSlot: 'PM', partIds: [], itemCount: 1 },
  ];
  const map = new Map([
    ['heavy', [item('h', 'p', 'heavy')]],
    ['light', [item('l', 'p', 'light')]],
  ]);

  it('weights a heavy subject more than a light one', () => {
    expect(weighted(subjects, map, { h: 1 }, coverage)).toBeCloseTo(0.75);
    expect(weighted(subjects, map, { l: 1 }, coverage)).toBeCloseTo(0.25);
  });

  it('reaches 1 only when every subject is covered', () => {
    expect(weighted(subjects, map, { h: 1, l: 1 }, coverage)).toBeCloseTo(1);
  });
});

describe('partLockStates', () => {
  const parts = [
    part('s-01', 's', 1, ['a', 'b']),
    part('s-02', 's', 2, ['c']),
    part('s-03', 's', 3, ['d']),
  ];

  it('always opens Part 1', () => {
    expect(partLockStates(parts, {}, new Set()).get('s-01')).toBe('open');
  });

  it('locks later parts until the previous one is fully covered', () => {
    const states = partLockStates(parts, {}, new Set());
    expect(states.get('s-02')).toBe('locked');
    expect(states.get('s-03')).toBe('locked');
  });

  it('does not open Part 2 on partial coverage of Part 1', () => {
    const states = partLockStates(parts, { a: 3 }, new Set());
    expect(states.get('s-02')).toBe('locked');
  });

  it('opens Part 2 when every item in Part 1 is at least Read Once', () => {
    const states = partLockStates(parts, { a: 1, b: 1 }, new Set());
    expect(states.get('s-02')).toBe('open');
    expect(states.get('s-03')).toBe('locked');
  });

  it('marks a force-opened part as override, not open', () => {
    const states = partLockStates(parts, {}, new Set(['s-03']));
    expect(states.get('s-03')).toBe('override');
  });

  it('reports override parts that later qualify normally as open', () => {
    const states = partLockStates(parts, { a: 1, b: 1 }, new Set(['s-02']));
    expect(states.get('s-02')).toBe('open');
  });

  it('keeps subjects independent — one subject never locks another', () => {
    const two = [...parts, part('t-01', 't', 1, ['z']), part('t-02', 't', 2, ['y'])];
    const states = partLockStates(two, {}, new Set());
    expect(states.get('t-01')).toBe('open');
    expect(states.get('s-01')).toBe('open');
  });

  it('handles parts supplied out of order', () => {
    const shuffled = [parts[2], parts[0], parts[1]];
    const states = partLockStates(shuffled, { a: 1, b: 1 }, new Set());
    expect(states.get('s-02')).toBe('open');
  });
});

describe('partFill', () => {
  it('is 0 when untouched and 1 when fully mastered', () => {
    const p = part('s-01', 's', 1, ['a', 'b']);
    expect(partFill(p, {})).toBe(0);
    expect(partFill(p, { a: 3, b: 3 })).toBe(1);
  });

  it('is fractional in between', () => {
    const p = part('s-01', 's', 1, ['a', 'b', 'c']);
    expect(partFill(p, { a: 3, b: 0, c: 0 })).toBeCloseTo(1 / 3);
  });
});

describe('advanceMastery', () => {
  it('climbs one rung at a time', () => {
    expect(advanceMastery(0)).toBe(1);
    expect(advanceMastery(1)).toBe(2);
    expect(advanceMastery(2)).toBe(3);
  });

  it('STOPS at Mastered instead of wrapping back to Not started', () => {
    // A wrap would let one extra tap silently erase a mastered item. Demotion is
    // legitimate (design.md 6) but it has to be deliberate.
    expect(advanceMastery(3)).toBe(3);
  });
});

describe('demoteMastery', () => {
  it('steps back one rung, because a bad mock exam is real information', () => {
    expect(demoteMastery(3)).toBe(2);
    expect(demoteMastery(2)).toBe(1);
    expect(demoteMastery(1)).toBe(0);
  });

  it('floors at Not started', () => {
    expect(demoteMastery(0)).toBe(0);
  });

  it('round-trips with advance', () => {
    expect(demoteMastery(advanceMastery(1))).toBe(1);
  });
});

describe('daysUntil', () => {
  // Dates are built with the LOCAL constructor so these assertions hold in any
  // timezone. The countdown is a local-calendar question: at UTC+8 a UTC-based
  // "today" reads one day high every morning before 08:00.

  it('counts whole days to the first exam', () => {
    expect(daysUntil('2027-09-05', new Date(2026, 8, 21, 12, 0))).toBe(349);
  });

  it('is 0 on the day itself', () => {
    expect(daysUntil('2027-09-05', new Date(2027, 8, 5, 23, 0))).toBe(0);
  });

  it('never goes negative after the exam', () => {
    expect(daysUntil('2027-09-05', new Date(2027, 9, 1, 0, 0))).toBe(0);
  });

  it('is 1 the day before', () => {
    expect(daysUntil('2027-09-05', new Date(2027, 8, 4, 6, 0))).toBe(1);
  });

  it('ignores time of day within the same local date', () => {
    const justAfterMidnight = daysUntil('2027-09-05', new Date(2026, 8, 21, 0, 1));
    const justBeforeMidnight = daysUntil('2027-09-05', new Date(2026, 8, 21, 23, 59));
    expect(justAfterMidnight).toBe(349);
    expect(justBeforeMidnight).toBe(349);
  });

  it('decrements exactly once per local midnight', () => {
    const before = daysUntil('2027-09-05', new Date(2026, 8, 21, 23, 59));
    const after = daysUntil('2027-09-05', new Date(2026, 8, 22, 0, 1));
    expect(before - after).toBe(1);
  });
});

describe('searchItems', () => {
  const subjects = new Map<string, Subject>([
    ['s', { id: 's', seq: 1, name: 'Sub', shortName: 'Sub', weight: 1, examDay: 1, examDate: '2027-09-05', examSlot: 'AM', partIds: [], itemCount: 2 }],
  ]);
  const partsById = new Map<string, Part>([['p1', part('p1', 's', 1, ['i1', 'i2'])]]);
  const items = [
    item('i1', 'p1', 's', 'Operative Fact Doctrine'),
    item('i2', 'p1', 's', 'Political Question Doctrine'),
  ];

  it('ignores queries shorter than two characters', () => {
    expect(searchItems('o', items, subjects, partsById)).toHaveLength(0);
    expect(searchItems('', items, subjects, partsById)).toHaveLength(0);
  });

  it('matches case-insensitively on item text', () => {
    const hits = searchItems('operative', items, subjects, partsById);
    expect(hits).toHaveLength(1);
    expect(hits[0].item.id).toBe('i1');
  });

  it('returns every match for a shared term', () => {
    expect(searchItems('doctrine', items, subjects, partsById)).toHaveLength(2);
  });

  it('returns the subject and part so results are locatable', () => {
    const [hit] = searchItems('operative', items, subjects, partsById);
    expect(hit.subject.id).toBe('s');
    expect(hit.part.id).toBe('p1');
  });

  it('respects the result limit', () => {
    expect(searchItems('doctrine', items, subjects, partsById, 1)).toHaveLength(1);
  });

  it('finds items by their syllabus ref', () => {
    expect(searchItems('i1', items, subjects, partsById)).toHaveLength(1);
  });
});

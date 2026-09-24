import { describe, expect, it } from 'vitest';
import {
  GAP_DEG,
  RAY_DEG,
  STAGES,
  describeDaisy,
  discFlorets,
  leafScale,
  peakWeightedCoverage,
  ratchetedStage,
  rayFills,
  rayWidthAt,
  sectorsOf,
  seeded,
  stageFor,
  subjectGrowth,
} from './daisy';
import type { Item, Part, ProgressMap, Subject } from './progress';
import { makeEvent, type StudyEvent } from './events';

// --- fixtures ---------------------------------------------------------------
// Shaped like the real syllabus: 6 subjects, 55 parts, the real weights and
// part counts, because the sector arithmetic in 19.2 only closes for those.

const SHAPE: [string, number, number][] = [
  ['political', 0.15, 14],
  ['commercial-tax', 0.2, 7],
  ['civil', 0.2, 12],
  ['labor', 0.1, 8],
  ['criminal', 0.1, 4],
  ['remedial-ethics', 0.25, 10],
];

const ITEMS_PER_PART = 4;

function fixture() {
  const subjects: Subject[] = [];
  const parts: Part[] = [];
  const items: Item[] = [];
  const itemsBySubject = new Map<string, Item[]>();

  SHAPE.forEach(([id, weight, partCount], si) => {
    const partIds: string[] = [];
    const mine: Item[] = [];
    for (let p = 1; p <= partCount; p++) {
      const partId = `${id}:P${p}`;
      const itemIds: string[] = [];
      for (let k = 1; k <= ITEMS_PER_PART; k++) {
        const item: Item = {
          id: `${id}:${p}.${k}`,
          ref: `${p}.${k}`,
          subjectId: id,
          partId,
          topic: 't',
          subtopicPath: [],
          text: 'x',
          seq: k,
        };
        items.push(item);
        mine.push(item);
        itemIds.push(item.id);
      }
      parts.push({ id: partId, subjectId: id, seq: p, title: `Part ${p}`, itemIds, itemCount: itemIds.length });
      partIds.push(partId);
    }
    itemsBySubject.set(id, mine);
    subjects.push({
      id,
      seq: si + 1,
      name: id,
      shortName: id,
      weight,
      examDay: 1,
      examSlot: 'AM',
      examDate: '2027-09-05',
      partIds,
      itemCount: mine.length,
    });
  });

  return { subjects, parts, items, itemsBySubject };
}

/** Cover the first `n` items of a subject, at the given rung. */
function cover(progress: ProgressMap, items: Item[], subjectId: string, n: number, rung: 1 | 2 | 3) {
  const mine = items.filter((i) => i.subjectId === subjectId);
  for (let k = 0; k < n; k++) progress[mine[k].id] = rung;
}

// --- 19.3 growth stages -----------------------------------------------------

describe('growth stages', () => {
  it('has exactly seven, as 19.7 binds it to', () => {
    expect(STAGES).toHaveLength(7);
    expect(STAGES.map((s) => s.roman)).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']);
  });

  it('reserves Seed for nothing at all — any progress germinates', () => {
    expect(stageFor(0).name).toBe('Seed');
    expect(stageFor(0.0001).name).toBe('Germination');
  });

  it.each([
    [0.09, 'Germination'],
    [0.1, 'Seedling'],
    [0.24, 'Seedling'],
    [0.25, 'Vegetative'],
    [0.44, 'Vegetative'],
    [0.45, 'Bud'],
    [0.64, 'Bud'],
    [0.65, 'First rays'],
    [0.84, 'First rays'],
    [0.85, 'Full bloom'],
    [1, 'Full bloom'],
  ])('coverage %s is %s', (cov, name) => {
    expect(stageFor(cov).name).toBe(name);
  });

  it('never returns NaN or undefined for degenerate input', () => {
    expect(stageFor(NaN).name).toBe('Seed');
    expect(stageFor(-1).name).toBe('Seed');
  });
});

// --- 19.4 the flower never wilts -------------------------------------------

describe('the ratchet (19.4)', () => {
  const { subjects, items, itemsBySubject } = fixture();

  it('retains the highest stage after a demotion all the way to zero', () => {
    // Climb: cover every item of every subject -> coverage 1.0, Full bloom.
    const log: StudyEvent[] = [];
    for (const i of items) {
      log.push(makeEvent('mastery_changed', { itemId: i.id, from: 0, to: 1 }));
    }
    // Then demote every single one back to Not started.
    for (const i of items) {
      log.push(makeEvent('mastery_changed', { itemId: i.id, from: 1, to: 0 }));
    }

    const peak = peakWeightedCoverage(log, subjects, itemsBySubject, 0);
    expect(peak).toBeCloseTo(1, 6);

    // Current coverage is now zero, but the plant does NOT return to seed.
    expect(ratchetedStage(0, peak).name).toBe('Full bloom');
    expect(stageFor(0).name).toBe('Seed');
  });

  it('is seeded with current coverage, so pre-log progress cannot shrink the plant', () => {
    // No events at all — the M1 situation, where taps predate the event log.
    const peak = peakWeightedCoverage([], subjects, itemsBySubject, 0.9);
    expect(peak).toBe(0.9);
    expect(ratchetedStage(0.9, peak).name).toBe('Full bloom');
  });

  it('is re-derivable from the log alone (AC-41), independent of event order', () => {
    const log: StudyEvent[] = items
      .slice(0, 100)
      .map((i) => makeEvent('mastery_changed', { itemId: i.id, from: 0, to: 2 }));
    const shuffled = [...log].reverse();
    expect(peakWeightedCoverage(shuffled, subjects, itemsBySubject, 0)).toBeCloseTo(
      peakWeightedCoverage(log, subjects, itemsBySubject, 0),
      9
    );
  });

  it('ignores non-mastery events entirely', () => {
    const log = [makeEvent('session_opened'), makeEvent('flag_toggled', { itemId: items[0].id })];
    expect(peakWeightedCoverage(log, subjects, itemsBySubject, 0)).toBe(0);
  });
});

// --- 19.2 structural mapping ------------------------------------------------

describe('sector arithmetic (19.2)', () => {
  const { subjects, parts } = fixture();
  const sectors = sectorsOf(subjects, parts);

  it('is six sectors carrying 55 rays', () => {
    expect(sectors).toHaveLength(6);
    expect(sectors.flatMap((s) => s.rays)).toHaveLength(55);
  });

  it('closes at exactly 360 degrees', () => {
    const last = sectors[sectors.length - 1];
    expect(last.start + last.span + GAP_DEG - sectors[0].start).toBeCloseTo(360, 1);
  });

  it('sizes each sector by its part count, so the gaps are the subject boundaries', () => {
    expect(sectors[0].span).toBeCloseTo(14 * RAY_DEG, 6);
    expect(sectors[4].span).toBeCloseTo(4 * RAY_DEG, 6);
  });

  it('binds every ray to exactly one Part, with no duplicates', () => {
    const ids = sectors.flatMap((s) => s.rays.map((r) => r.partId));
    expect(new Set(ids).size).toBe(55);
  });

  it('orders rays within a sector by part sequence', () => {
    expect(sectors[0].rays.map((r) => r.partId)).toEqual(
      Array.from({ length: 14 }, (_, i) => `political:P${i + 1}`)
    );
  });
});

describe('rays are bound to Parts', () => {
  const { parts } = fixture();

  it('grows NO ray for an untouched Part', () => {
    expect(rayFills(parts, {}).get('political:P1')).toBe(0);
  });

  it('extends a ray only as far as that Part is filled', () => {
    const progress: ProgressMap = {};
    const p1 = parts.find((p) => p.id === 'political:P1')!;
    p1.itemIds.forEach((id) => (progress[id] = 1));
    // Every item Read once = a third of the way to Mastered.
    expect(rayFills(parts, progress).get('political:P1')).toBeCloseTo(1 / 3, 6);

    p1.itemIds.forEach((id) => (progress[id] = 3));
    expect(rayFills(parts, progress).get('political:P1')).toBe(1);
  });

  it('keeps rays strap-shaped: width scales with radius, not with angle', () => {
    // A wedge would double its width when the head doubles AND stay angular.
    // The strap's width is simply proportional to r.
    expect(rayWidthAt(200) / rayWidthAt(100)).toBeCloseTo(2, 6);
  });
});

describe('leaves are bound to exam weight', () => {
  it('makes Remedial (25%) the largest and Criminal (10%) among the smallest', () => {
    expect(leafScale(0.25)).toBe(1);
    expect(leafScale(0.1)).toBeLessThan(leafScale(0.15));
    expect(leafScale(0.15)).toBeLessThan(leafScale(0.2));
  });

  it('separates 25% from 10% by ~1.9x, not by the invisible 1.6x area scaling gives', () => {
    // Area-proportional (sqrt) would be 1.58x, which does not read at a glance.
    expect(leafScale(0.25) / leafScale(0.1)).toBeGreaterThan(1.85);
    expect(Math.sqrt(0.25) / Math.sqrt(0.1)).toBeLessThan(1.6);
  });

  it('stunts the leaf of a neglected subject', () => {
    const { items, itemsBySubject } = fixture();
    const progress: ProgressMap = {};
    cover(progress, items, 'civil', 24, 1);
    expect(subjectGrowth(itemsBySubject.get('civil')!, progress)).toBe(0.5);
    expect(subjectGrowth(itemsBySubject.get('criminal')!, progress)).toBe(0);
  });

  it('returns 0 rather than NaN for a subject with no items', () => {
    expect(subjectGrowth([], {})).toBe(0);
  });
});

// --- 19.1 the two axes are independent --------------------------------------

describe('coverage and depth stay independent (19.1)', () => {
  it('describes a full-grown plant that has not flowered', () => {
    // THE diagnostic state: everything read once, nothing mastered.
    const text = describeDaisy(stageFor(0.95), 0.95, 0.317);
    expect(text).toContain('Stage VII of VII');
    expect(text).toContain('Coverage 95%');
    expect(text).toContain('Depth 32%');
    expect(text).toContain('The bloom has not opened.');
  });

  it('reports an open bloom only when depth is actually high', () => {
    expect(describeDaisy(stageFor(0.95), 0.95, 0.95)).toContain('fully open');
  });

  it('never conveys stage by colour alone — the name is always in the text', () => {
    for (const s of STAGES) {
      expect(describeDaisy(s, 0.5, 0.2).toLowerCase()).toContain(s.name.toLowerCase());
    }
  });
});

// --- determinism ------------------------------------------------------------

describe('the plant does not twitch between renders', () => {
  it('produces identical disc florets for the same seed', () => {
    const a = discFlorets(0, 0, 40, seeded(7));
    const b = discFlorets(0, 0, 40, seeded(7));
    expect(a).toEqual(b);
  });

  it('packs the disc by golden angle, so florets never collide at the centre', () => {
    const florets = discFlorets(0, 0, 40, seeded(1));
    expect(florets.length).toBeGreaterThan(50);
    const radii = florets.map((p) => Math.hypot(p.x, p.y));
    // Monotonically outward: that is what sqrt(i/N) guarantees.
    for (let i = 1; i < radii.length; i++) expect(radii[i]).toBeGreaterThanOrEqual(radii[i - 1] - 1e-9);
  });
});

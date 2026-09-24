// Pure domain logic. No I/O, no React, no storage — so it can be tested
// exhaustively and reused by the dashboard, the ribbon, and (later) the
// achievement engine.

import { daysBetween, localDateOf } from './dates.ts';

export type Mastery = 0 | 1 | 2 | 3;

export const MASTERY_LABELS: Record<Mastery, string> = {
  0: 'Not started',
  1: 'Read once',
  2: 'Reviewed',
  3: 'Mastered',
};

export interface Subject {
  id: string;
  seq: number;
  name: string;
  shortName: string;
  weight: number;
  examDay: number;
  examDate: string;
  examSlot: 'AM' | 'PM';
  partIds: string[];
  itemCount: number;
}

export interface Part {
  id: string;
  subjectId: string;
  seq: number;
  title: string;
  itemIds: string[];
  itemCount: number;
}

export interface Item {
  id: string;
  ref: string;
  subjectId: string;
  partId: string;
  topic: string;
  subtopicPath: string[];
  text: string;
  seq: number;
}

/** itemId -> mastery. Absent means 0, so untouched items cost nothing. */
export type ProgressMap = Record<string, Mastery>;

/** itemIds the user has flagged as needing review. */
export type FlagSet = Set<string>;

export const masteryOf = (p: ProgressMap, itemId: string): Mastery => p[itemId] ?? 0;

// --- Ladder transitions -----------------------------------------------------
//
// design.md 6 requires that the app never BLOCK a downgrade: demoting an item
// after a bad mock exam is honest information and a legitimate event. It does
// not require that a downgrade be one tap away from a mastered item. The tap
// control therefore climbs and stops; demotion is its own, deliberate action.

/** One rung up. Saturates at Mastered rather than wrapping round to zero. */
export function advanceMastery(current: Mastery): Mastery {
  return current >= 3 ? 3 : ((current + 1) as Mastery);
}

/** One rung down. Floors at Not started. */
export function demoteMastery(current: Mastery): Mastery {
  return current <= 0 ? 0 : ((current - 1) as Mastery);
}

// --- Coverage and depth -----------------------------------------------------

/** Fraction of items touched at least once. Matches the workbook's "Covered". */
export function coverage(items: Item[], p: ProgressMap): number {
  if (items.length === 0) return 0;
  let n = 0;
  for (const i of items) if (masteryOf(p, i.id) >= 1) n++;
  return n / items.length;
}

/** Fraction of total possible mastery achieved. 1.0 means every item Mastered. */
export function depth(items: Item[], p: ProgressMap): number {
  if (items.length === 0) return 0;
  let sum = 0;
  for (const i of items) sum += masteryOf(p, i.id);
  return sum / (items.length * 3);
}

/** Sum of (subject weight x subject metric). Weights come from the workbook. */
export function weighted(
  subjects: Subject[],
  itemsBySubject: Map<string, Item[]>,
  p: ProgressMap,
  metric: (items: Item[], p: ProgressMap) => number
): number {
  let total = 0;
  for (const s of subjects) {
    total += s.weight * metric(itemsBySubject.get(s.id) ?? [], p);
  }
  return total;
}

// --- Unlock engine ----------------------------------------------------------

export type LockState = 'open' | 'locked' | 'override';

/**
 * Part N opens when every item in Part N-1 is at least Read Once.
 * Part 1 of every subject is always open, and all subjects are always open —
 * review follows lectures, not a fixed line (design.md 7).
 */
export function partLockStates(
  parts: Part[],
  p: ProgressMap,
  overrides: Set<string>
): Map<string, LockState> {
  const out = new Map<string, LockState>();
  const bySubject = new Map<string, Part[]>();

  for (const part of parts) {
    if (!bySubject.has(part.subjectId)) bySubject.set(part.subjectId, []);
    bySubject.get(part.subjectId)!.push(part);
  }

  for (const list of bySubject.values()) {
    list.sort((a, b) => a.seq - b.seq);
    let previousCovered = true; // nothing precedes Part 1

    for (const part of list) {
      if (previousCovered) out.set(part.id, 'open');
      else if (overrides.has(part.id)) out.set(part.id, 'override');
      else out.set(part.id, 'locked');

      previousCovered = part.itemIds.every((id) => masteryOf(p, id) >= 1);
    }
  }

  return out;
}

/** Average mastery of a part's items, for rendering the ribbon node fill. */
export function partFill(part: Part, p: ProgressMap): number {
  if (part.itemIds.length === 0) return 0;
  let sum = 0;
  for (const id of part.itemIds) sum += masteryOf(p, id);
  return sum / (part.itemIds.length * 3);
}

// --- Exam countdown ---------------------------------------------------------

/**
 * Whole days from today to an exam date, floored at 0.
 *
 * "Today" is the DEVICE's local date, not the UTC date. At UTC+8 a UTC-based
 * today reads one day high for the first eight hours of every morning, which on
 * a prominent countdown is a daily visible error. Uses the same local-date
 * convention as the event log (see lib/dates.ts) so the countdown and the
 * streak can never disagree about what day it is.
 */
export function daysUntil(isoDate: string, today = new Date()): number {
  return Math.max(0, daysBetween(localDateOf(today), isoDate));
}

// --- Search -----------------------------------------------------------------

export interface SearchHit {
  item: Item;
  subject: Subject;
  part: Part;
}

/**
 * Substring search across item text, ref, topic, and part title.
 * Locked parts are included on purpose — finding is not studying.
 */
export function searchItems(
  query: string,
  items: Item[],
  subjectById: Map<string, Subject>,
  partById: Map<string, Part>,
  limit = 50
): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const hits: SearchHit[] = [];
  for (const item of items) {
    const part = partById.get(item.partId);
    const subject = subjectById.get(item.subjectId);
    if (!part || !subject) continue;

    const haystack = `${item.text} ${item.ref} ${item.topic} ${part.title}`.toLowerCase();
    if (haystack.includes(q)) {
      hits.push({ item, subject, part });
      if (hits.length >= limit) break;
    }
  }
  return hits;
}

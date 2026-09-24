// The append-only study event log.
//
// WHY THIS EXISTS AT ALL (design.md 5.3): current state cannot answer the
// questions the achievements and encouragement engines need. "Seven days in a
// row" and "came back after four days away" are properties of HISTORY, not of a
// status column. A spreadsheet fundamentally cannot do this.
//
// WHY IT IS HERE NOW, AHEAD OF ITS MILESTONE: history cannot be backfilled.
// Every tap made before this log existed is a day that streaks, the comeback
// verse, and the distribution heatmap can never reconstruct. The engines that
// consume the log stay in M7; only the recording is pulled forward.
//
// Events are append-only and never updated, and ids are client-generated, so
// two devices merge without conflict and a sync retry is idempotent (design.md 10).

import { addDays, localDateOf } from './dates.ts';
import type { Mastery } from './progress.ts';

export type StudyEventType =
  | 'mastery_changed'
  | 'flag_toggled'
  | 'note_saved'
  | 'link_added'
  | 'part_unlocked'
  | 'session_opened';

export interface StudyEvent {
  id: string;
  type: StudyEventType;
  itemId?: string;
  partId?: string;
  from?: Mastery;
  to?: Mastery;
  /** Epoch ms, device clock. Ordering within a day only. */
  occurredAt: number;
  /** YYYY-MM-DD in the device timezone, stamped at write time. */
  localDate: string;
}

/**
 * What counts as a study day.
 *
 * `session_opened` is deliberately excluded so that merely opening the app
 * cannot extend a streak (design.md 8.1 rule 1). `part_unlocked` is excluded
 * for the same reason: opening a door is not walking through it.
 */
export const QUALIFYING_TYPES: ReadonlySet<StudyEventType> = new Set<StudyEventType>([
  'mastery_changed',
  'flag_toggled',
  'note_saved',
  'link_added',
]);

export const isQualifying = (e: StudyEvent): boolean => QUALIFYING_TYPES.has(e.type);

let fallbackCounter = 0;

function newEventId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // Older WebViews: still unique enough for a single-user append-only log.
  fallbackCounter += 1;
  return `ev-${Date.now().toString(36)}-${fallbackCounter}-${Math.random().toString(36).slice(2, 10)}`;
}

type EventFields = Pick<StudyEvent, 'itemId' | 'partId' | 'from' | 'to'>;

/** Build an event, stamping the device-local date at write time. */
export function makeEvent(
  type: StudyEventType,
  fields: Partial<EventFields> = {},
  now: Date = new Date()
): StudyEvent {
  const e: StudyEvent = {
    id: newEventId(),
    type,
    occurredAt: now.getTime(),
    localDate: localDateOf(now),
  };
  // Assigned conditionally so the record stays small and JSON-clean.
  if (fields.itemId !== undefined) e.itemId = fields.itemId;
  if (fields.partId !== undefined) e.partId = fields.partId;
  if (fields.from !== undefined) e.from = fields.from;
  if (fields.to !== undefined) e.to = fields.to;
  return e;
}

/**
 * Append, returning a new array. Re-appending a known id is a no-op, which is
 * what makes replaying an outbox after a failed flush safe.
 */
export function appendEvent(log: readonly StudyEvent[], e: StudyEvent): StudyEvent[] {
  for (const existing of log) if (existing.id === e.id) return log as StudyEvent[];
  return [...log, e];
}

/** Distinct days containing real work, ascending. The basis of every streak. */
export function studyDates(log: readonly StudyEvent[]): string[] {
  const set = new Set<string>();
  for (const e of log) if (isQualifying(e)) set.add(e.localDate);
  return [...set].sort();
}

/**
 * Distinct study days in the window of `windowDays` ending today, inclusive.
 *
 * This is the dashboard's PRIMARY consistency figure (design.md 8.1 rule 5) —
 * a number no single bad day can destroy, unlike a consecutive streak.
 */
export function daysStudiedWithin(
  log: readonly StudyEvent[],
  windowDays = 30,
  today: Date = new Date()
): number {
  const end = localDateOf(today);
  const start = addDays(end, -(windowDays - 1));
  let n = 0;
  for (const d of studyDates(log)) if (d >= start && d <= end) n++;
  return n;
}

/** The most recent day with real work, or null. Drives the comeback verse. */
export function lastStudyDate(log: readonly StudyEvent[]): string | null {
  const dates = studyDates(log);
  return dates.length === 0 ? null : dates[dates.length - 1];
}

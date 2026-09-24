// The dashboard's derived figures.
//
// Pure functions over the event log, the progress map, the syllabus calendar
// and the routine. No React, no storage — everything the dashboard cards show
// is computed here so the edge cases (grace windows, overnight routine blocks,
// week boundaries) can be tested without rendering anything.

import { addDays, daysBetween, localDateOf } from './dates.ts';
import { isQualifying, type StudyEvent } from './events.ts';
import {
  masteryOf,
  type Item,
  type LockState,
  type Part,
  type ProgressMap,
  type Subject,
} from './progress.ts';
import type { Schedule, ScheduleRow } from './schedule.ts';
import { STAGES, type Stage } from './daisy.ts';

// --- streak (design.md 8.1) -------------------------------------------------

export interface Streak {
  /** Calendar days in the live streak, grace days included. */
  current: number;
  /** Longest streak ever. Never lower than `current`. */
  best: number;
  /** Grace days inside the live streak, newest first. */
  graceDates: string[];
  studiedToday: boolean;
}

/**
 * The streak that ends on `end`, walking backwards.
 *
 * A missed day is forgiven if no other missed day sits within the 6 days after
 * it (one grace per rolling 7-day window, rule 2); a second miss inside the
 * window ends the walk (rule 3). Misses before the earliest study day are
 * trimmed, so a streak always starts on a day of real work.
 */
function walk(set: ReadonlySet<string>, end: string, first: string) {
  let d = end;
  let span = 0;
  let kept = 0;
  let lastMiss: string | null = null;
  const graces: string[] = [];
  let keptGraces = 0;

  while (d >= first) {
    span++;
    if (set.has(d)) {
      kept = span;
      keptGraces = graces.length;
    } else {
      if (lastMiss !== null && daysBetween(d, lastMiss) < 7) break;
      lastMiss = d;
      graces.push(d);
    }
    d = addDays(d, -1);
  }
  return { length: kept, graces: graces.slice(0, keptGraces) };
}

export function streakOf(studyDays: readonly string[], today: Date = new Date()): Streak {
  const t = localDateOf(today);
  const set = new Set(studyDays);
  const studiedToday = set.has(t);
  if (set.size === 0) return { current: 0, best: 0, graceDates: [], studiedToday };

  const first = [...set].sort()[0];
  // Today is not over, so an empty today is pending rather than missed.
  const live = walk(set, studiedToday ? t : addDays(t, -1), first);

  let best = live.length;
  for (const d of set) {
    const w = walk(set, d, first);
    if (w.length > best) best = w.length;
  }
  return { current: live.length, best, graceDates: live.graces, studiedToday };
}

// --- heatmap (design.md 8.2) ------------------------------------------------

export interface HeatCell {
  date: string;
  count: number;
  /** 0 = nothing, 1–4 = increasing volume. */
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
}

export const HEAT_LEVELS = ['None', '1–2', '3–5', '6–10', '11+'] as const;

function levelOf(n: number): HeatCell['level'] {
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  if (n <= 5) return 2;
  if (n <= 10) return 3;
  return 4;
}

/** Monday on or before a date. Weeks start Monday, like the syllabus calendar. */
export function mondayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
}

/**
 * The last `weeks` weeks as columns of seven days, oldest first, ending with the
 * current week. Days after today are marked `future` rather than counted as
 * empty — an unlived Thursday is not a missed one.
 */
export function heatmapWeeks(
  log: readonly StudyEvent[],
  weeks = 12,
  today: Date = new Date()
): HeatCell[][] {
  const t = localDateOf(today);
  const counts = new Map<string, number>();
  for (const e of log) if (isQualifying(e)) counts.set(e.localDate, (counts.get(e.localDate) ?? 0) + 1);

  const start = addDays(mondayOf(t), -7 * (weeks - 1));
  const out: HeatCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatCell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, w * 7 + i);
      const count = counts.get(date) ?? 0;
      col.push({ date, count, level: levelOf(count), future: date > t });
    }
    out.push(col);
  }
  return out;
}

// --- the syllabus calendar --------------------------------------------------

export interface CalendarWeek {
  week: number;
  startDate: string;
  endDate?: string;
  phase: string;
  focus: string;
  targetItems: number | null;
}

/** The calendar week containing today, clamped to the first and last week. */
export function currentWeek(
  calendar: readonly CalendarWeek[],
  today: Date = new Date()
): CalendarWeek | null {
  if (calendar.length === 0) return null;
  const t = localDateOf(today);
  let found = calendar[0];
  for (const w of calendar) if (w.startDate <= t) found = w;
  return found;
}

/** Items that went from Not started to at least Read Once between two dates. */
export function newlyCoveredBetween(
  log: readonly StudyEvent[],
  from: string,
  to: string
): number {
  const ids = new Set<string>();
  for (const e of log) {
    if (e.type !== 'mastery_changed' || !e.itemId) continue;
    if (e.localDate < from || e.localDate > to) continue;
    if (e.from === 0 && (e.to ?? 0) >= 1) ids.add(e.itemId);
  }
  return ids.size;
}

export interface Pace {
  week: CalendarWeek | null;
  weekDone: number;
  weekTarget: number | null;
  /** How much of the week's target should be done by the end of today. */
  weekExpected: number | null;
  status: 'ahead' | 'on-track' | 'behind' | 'no-target';
  remaining: number;
  daysLeft: number;
  /** Untouched items per remaining day to finish before Day 1. */
  perDayNeeded: number;
  /** New items per day over the last 14 days. */
  recentPerDay: number;
}

export function paceOf(
  log: readonly StudyEvent[],
  calendar: readonly CalendarWeek[],
  totalItems: number,
  touched: number,
  examDay1: string,
  today: Date = new Date()
): Pace {
  const t = localDateOf(today);
  const week = currentWeek(calendar, today);
  const weekStart = week ? week.startDate : mondayOf(t);
  const weekDone = newlyCoveredBetween(log, weekStart, t);
  const weekTarget = week?.targetItems ?? null;

  let weekExpected: number | null = null;
  let status: Pace['status'] = 'no-target';
  if (weekTarget !== null && weekTarget > 0) {
    const elapsed = Math.min(7, Math.max(1, daysBetween(weekStart, t) + 1));
    weekExpected = Math.round((weekTarget * elapsed) / 7);
    if (weekDone >= weekTarget || weekDone > weekExpected) status = 'ahead';
    else if (weekDone >= weekExpected * 0.8) status = 'on-track';
    else status = 'behind';
  }

  const remaining = Math.max(0, totalItems - touched);
  const daysLeft = Math.max(0, daysBetween(t, examDay1));
  return {
    week,
    weekDone,
    weekTarget,
    weekExpected,
    status,
    remaining,
    daysLeft,
    perDayNeeded: daysLeft > 0 ? Math.ceil(remaining / daysLeft) : remaining,
    recentPerDay: newlyCoveredBetween(log, addDays(t, -13), t) / 14,
  };
}

// --- the routine: what is happening now -------------------------------------

export interface Block {
  row: ScheduleRow;
  /** Minutes after midnight. `end` may pass 1440 for an overnight block. */
  start: number;
  end: number;
}

const RANGE =
  /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*[–—-]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i;

const toMinutes = (h: number, m: number, mer: string) =>
  ((h % 12) + (mer.toUpperCase() === 'PM' ? 12 : 0)) * 60 + m;

/**
 * Read a free-text time like "12:30–1:00 PM" or "9:00 PM–6:00 AM".
 *
 * The routine is hand-written, so a start without AM/PM borrows the end's — and
 * flips if that would put it after the end ("11:00–1:00 PM" is 11 AM). Anything
 * that is not a range ("Breaks (2 × 15 min)") returns null and is simply not
 * placed on the clock.
 */
export function parseTimeRange(text: string): { start: number; end: number } | null {
  const m = RANGE.exec(text);
  if (!m) return null;
  const [, h1, m1, mer1, h2, m2, mer2] = m;
  const end = toMinutes(Number(h2), Number(m2 ?? 0), mer2);
  let start: number;
  if (mer1) start = toMinutes(Number(h1), Number(m1 ?? 0), mer1);
  else {
    start = toMinutes(Number(h1), Number(m1 ?? 0), mer2);
    if (start > end) start = toMinutes(Number(h1), Number(m1 ?? 0), mer2.toUpperCase() === 'PM' ? 'AM' : 'PM');
  }
  return { start, end: end <= start ? end + 1440 : end };
}

export const groupFor = (d: Date): keyof Schedule =>
  d.getDay() === 0 || d.getDay() === 6 ? 'weekends' : 'weekdays';

function blocksOf(rows: readonly ScheduleRow[]): Block[] {
  const out: Block[] = [];
  for (const row of rows) {
    const r = parseTimeRange(row.time);
    if (r) out.push({ row, ...r });
  }
  return out.sort((a, b) => a.start - b.start);
}

export interface RoutineNow {
  group: keyof Schedule;
  now: Block | null;
  next: Block | null;
  /** Today's timed blocks in order, for the timeline. */
  blocks: Block[];
}

/**
 * The block under way and the one after it. An overnight block that began
 * yesterday (a 9 PM–6 AM shift, seen at 2 AM) still counts as now.
 */
export function routineNow(schedule: Schedule, at: Date = new Date()): RoutineNow {
  const group = groupFor(at);
  const blocks = blocksOf(schedule[group]);
  const m = at.getHours() * 60 + at.getMinutes();

  let now = blocks.find((b) => b.start <= m && m < b.end) ?? null;
  if (!now) {
    const yesterday = new Date(at.getTime() - 86_400_000);
    now =
      blocksOf(schedule[groupFor(yesterday)]).find(
        (b) => b.end > 1440 && b.start <= m + 1440 && m + 1440 < b.end
      ) ?? null;
  }
  const next = blocks.find((b) => b.start > m && b !== now) ?? null;
  return { group, now, next, blocks };
}

/** "1:30 PM" from minutes after midnight. */
export function formatMinutes(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
}

// --- what to study today ----------------------------------------------------

export interface Suggestion {
  item: Item;
  reason: 'flagged' | 'focus' | 'next';
}

/**
 * Three to five items for today: flagged items first (review what you marked),
 * then the next untouched items in this week's focus subject, then — once that
 * subject is exhausted or the week has no single focus — the next items in the
 * subject with the most exam weight still unseen.
 *
 * Locked Parts are skipped: a suggestion should be something you can start now.
 */
export function suggestItems(
  opts: {
    subjects: readonly Subject[];
    parts: readonly Part[];
    itemsByPart: ReadonlyMap<string, Item[]>;
    itemById: ReadonlyMap<string, Item>;
    lockStates: ReadonlyMap<string, LockState>;
    progress: ProgressMap;
    flags: ReadonlySet<string>;
    focus: string | null;
  },
  limit = 5
): Suggestion[] {
  const { subjects, parts, itemsByPart, itemById, lockStates, progress, flags, focus } = opts;
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  const push = (item: Item, reason: Suggestion['reason']) => {
    if (seen.has(item.id) || out.length >= limit) return;
    seen.add(item.id);
    out.push({ item, reason });
  };

  for (const id of flags) {
    const item = itemById.get(id);
    if (item && masteryOf(progress, id) < 3) push(item, 'flagged');
    if (out.length >= 2) break;
  }

  const nextIn = (subjectId: string, reason: Suggestion['reason']) => {
    const own = parts
      .filter((p) => p.subjectId === subjectId && lockStates.get(p.id) !== 'locked')
      .sort((a, b) => a.seq - b.seq);
    for (const p of own) {
      for (const item of [...(itemsByPart.get(p.id) ?? [])].sort((a, b) => a.seq - b.seq)) {
        if (out.length >= limit) return;
        if (masteryOf(progress, item.id) === 0) push(item, reason);
      }
    }
  };

  const focusSubject = focus ? subjects.find((s) => s.name === focus) : undefined;
  if (focusSubject) nextIn(focusSubject.id, 'focus');

  const byStake = [...subjects].sort((a, b) => b.weight - a.weight);
  for (const s of byStake) {
    if (out.length >= limit) break;
    if (s !== focusSubject) nextIn(s.id, 'next');
  }
  return out;
}

// --- continue where you left off -------------------------------------------

/** The most recent event that touched an item, or null. */
export function lastTouchedItem(log: readonly StudyEvent[]): StudyEvent | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (e.itemId && (e.type === 'mastery_changed' || e.type === 'flag_toggled')) return e;
  }
  return null;
}

// --- needs attention --------------------------------------------------------

export interface Attention {
  subject: Subject;
  coverage: number;
  depth: number;
  flagged: number;
  /** Share of the whole grade still unseen in this subject. */
  atStake: number;
}

/** Subjects ranked by how much of the grade is still unseen in them. */
export function needsAttention(
  subjects: readonly Subject[],
  metrics: ReadonlyMap<string, { coverage: number; depth: number }>,
  flags: ReadonlySet<string>,
  itemById: ReadonlyMap<string, Item>,
  limit = 3
): Attention[] {
  const flaggedBy = new Map<string, number>();
  for (const id of flags) {
    const s = itemById.get(id)?.subjectId;
    if (s) flaggedBy.set(s, (flaggedBy.get(s) ?? 0) + 1);
  }
  return subjects
    .map((subject) => {
      const m = metrics.get(subject.id) ?? { coverage: 0, depth: 0 };
      return {
        subject,
        coverage: m.coverage,
        depth: m.depth,
        flagged: flaggedBy.get(subject.id) ?? 0,
        atStake: subject.weight * (1 - m.coverage),
      };
    })
    .sort((a, b) => b.atStake - a.atStake || b.flagged - a.flagged)
    .slice(0, limit);
}

// --- next milestones --------------------------------------------------------

export interface Milestone {
  id: string;
  label: string;
  current: number;
  target: number;
  unit: string;
}

const nextAbove = (value: number, steps: readonly number[]) => steps.find((s) => s > value);

/**
 * The closest unearned achievements (design.md 8), nearest first. Uses the
 * same thresholds as the achievement table so the card never promises a badge
 * the engine will not award.
 */
export function nextMilestones(
  m: {
    touched: number;
    totalItems: number;
    mastered: number;
    weightedCoverage: number;
    bestStreak: number;
    daysStudied30: number;
    stage: Stage;
  },
  limit = 3
): Milestone[] {
  const out: Milestone[] = [];

  const items = nextAbove(m.touched, [50, 100, 250, 500, 1000, m.totalItems]);
  if (items !== undefined)
    out.push({ id: `items_${items}`, label: `${items.toLocaleString('en-GB')} items seen`, current: m.touched, target: items, unit: 'items' });

  if (m.mastered < 1)
    out.push({ id: 'first_mastered', label: 'Locked In — first item mastered', current: 0, target: 1, unit: 'item' });

  const cov = nextAbove(Math.round(m.weightedCoverage * 100), [25, 50, 75, 100]);
  if (cov !== undefined)
    out.push({ id: `weighted_${cov}`, label: `${cov}% weighted coverage`, current: Math.round(m.weightedCoverage * 1000) / 10, target: cov, unit: '%' });

  const streak = nextAbove(m.bestStreak, [3, 7, 14, 30, 60, 100]);
  if (streak !== undefined)
    out.push({ id: `streak_${streak}`, label: `${streak}-day streak`, current: m.bestStreak, target: streak, unit: 'days' });

  if (m.daysStudied30 < 20)
    out.push({ id: 'steady_20_of_30', label: 'Steady Hand — 20 of 30 days', current: m.daysStudied30, target: 20, unit: 'days' });

  const nextStage = STAGES.find((s) => s.n === m.stage.n + 1);
  if (nextStage && nextStage.min > 0)
    out.push({
      id: `stage_${nextStage.n}`,
      label: `Daisy reaches ${nextStage.name}`,
      current: Math.round(m.weightedCoverage * 1000) / 10,
      target: Math.round(nextStage.min * 100),
      unit: '%',
    });

  return out
    .sort((a, b) => b.current / b.target - a.current / a.target)
    .slice(0, limit);
}

/** Time-of-day greeting for the dashboard header. */
export function greeting(at: Date = new Date()): string {
  const h = at.getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// The study routine: a small editable table the user owns outright.
//
// Deliberately NOT part of the syllabus. The syllabus is reference data, bundled
// and read-only (design.md 5.1); this is the user's own timetable, lives in
// their storage, and is theirs to rewrite. Nothing here feeds coverage, depth,
// streaks or the plant — a schedule is an intention, and the app only ever
// counts work that actually happened.

export interface ScheduleRow {
  id: string;
  time: string;
  activity: string;
  notes: string;
  /** Marks a block as study-critical, so the eye finds it in a wall of rows. */
  highlight: boolean;
}

export interface Schedule {
  weekdays: ScheduleRow[];
  weekends: ScheduleRow[];
}

export type ScheduleGroup = keyof Schedule;

export const GROUP_LABELS: Record<ScheduleGroup, string> = {
  weekdays: 'Weekdays',
  weekends: 'Weekends',
};

let seq = 0;

export function newRowId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  seq += 1;
  return `row-${Date.now().toString(36)}-${seq}`;
}

export function emptyRow(): ScheduleRow {
  return { id: newRowId(), time: '', activity: '', notes: '', highlight: false };
}

const row = (time: string, activity: string, notes = '', highlight = false): ScheduleRow => ({
  id: newRowId(),
  time,
  activity,
  notes,
  highlight,
});

/**
 * The routine as the user supplied it, so the table is useful on first open
 * rather than being 24 empty rows to retype. Every value is editable.
 */
export function defaultSchedule(): Schedule {
  return {
    weekdays: [
      row('6:00–12:00 PM', 'Sleep', 'Keep it simple — no scrolling'),
      row('12:00–12:30 PM', 'Wake up, hydrate'),
      row('12:30–1:00 PM', 'Workout'),
      row('1:00–1:30 PM', 'Shower, breakfast'),
      row('1:30–2:30 PM', 'Devotion'),
      row('2:30–3:00 PM', 'Rest / transition'),
      row(
        '3:00–4:30 PM',
        'Codal work',
        'Focused codal work — one provision cluster per day (e.g. NCC Arts. 1156–1178)',
        true
      ),
      row('4:30–5:00 PM', 'Prep for class'),
      row(
        '5:00–9:00 PM',
        'Law school class',
        'Take minimal notes — focus on understanding, not rewriting'
      ),
      row('9:00 PM–6:00 AM', 'VA work shift', 'Use breaks wisely (see below)'),
      row('Breaks (2 × 15 min)', 'Flashcard / spaced repetition', 'Anki or codal recall', true),
      row('Lunch break (1 hr)', 'Lunch, reset'),
    ],
    weekends: [
      row('6:00–6:30 AM', 'Wake up, hydrate'),
      row('6:30–7:00 AM', 'Workout (30 min)'),
      row('7:00–7:30 AM', 'Shower, breakfast'),
      row('7:30–8:30 AM', 'Devotion (1 hour)'),
      row('8:30–9:00 AM', 'Rest / transition'),
      row('9:00 AM–12:00 PM', 'Review session 1', 'Codal + reviewer', true),
      row('12:00–1:00 PM', 'Lunch break'),
      row(
        '1:00–4:00 PM',
        'Review session 2',
        '10–15 past Bar essay questions from that subject, timed',
        true
      ),
      row('4:00–5:00 PM', 'Rest / nap / light walk'),
      row('5:00–6:00 PM', 'Prep for work, early dinner'),
      row(
        '6:00 PM–6:00 AM',
        'VA work shift (same as weekdays)',
        'Use breaks for flashcards if energy allows'
      ),
      row('9:00 AM–3:00 PM (next day)', 'Sleep block', 'Same as weekdays — protect it'),
    ],
  };
}

// --- pure edits -------------------------------------------------------------
// Every one returns a new Schedule, so React sees the change and nothing is
// mutated underneath a render.

export function addRow(s: Schedule, group: ScheduleGroup): Schedule {
  return { ...s, [group]: [...s[group], emptyRow()] };
}

export function updateRow(
  s: Schedule,
  group: ScheduleGroup,
  id: string,
  patch: Partial<Omit<ScheduleRow, 'id'>>
): Schedule {
  return { ...s, [group]: s[group].map((r) => (r.id === id ? { ...r, ...patch } : r)) };
}

export function removeRow(s: Schedule, group: ScheduleGroup, id: string): Schedule {
  return { ...s, [group]: s[group].filter((r) => r.id !== id) };
}

/** Move a row one place up or down. Out-of-range moves are a no-op rather than
 *  an error — the caller is a button the user can always press. */
export function moveRow(
  s: Schedule,
  group: ScheduleGroup,
  id: string,
  delta: number
): Schedule {
  const rows = s[group];
  const from = rows.findIndex((r) => r.id === id);
  if (from < 0) return s;
  const to = from + delta;
  if (to < 0 || to >= rows.length) return s;
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return { ...s, [group]: next };
}

/**
 * Accept whatever came out of storage without trusting its shape.
 *
 * A schedule is hand-edited user data in localStorage: it can be half-written,
 * from an older shape, or edited by hand. Anything unusable falls back to the
 * default rather than throwing on render.
 */
export function normalise(raw: unknown): Schedule {
  const fallback = defaultSchedule();
  if (!raw || typeof raw !== 'object') return fallback;

  const cleanGroup = (v: unknown): ScheduleRow[] | null => {
    if (!Array.isArray(v)) return null;
    return v
      .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
      .map((r) => ({
        id: typeof r.id === 'string' && r.id ? r.id : newRowId(),
        time: typeof r.time === 'string' ? r.time : '',
        activity: typeof r.activity === 'string' ? r.activity : '',
        notes: typeof r.notes === 'string' ? r.notes : '',
        highlight: r.highlight === true,
      }));
  };

  const obj = raw as Record<string, unknown>;
  const weekdays = cleanGroup(obj.weekdays);
  const weekends = cleanGroup(obj.weekends);
  if (!weekdays && !weekends) return fallback;

  return { weekdays: weekdays ?? [], weekends: weekends ?? [] };
}

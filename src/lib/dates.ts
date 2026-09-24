// The app's single local-date convention.
//
// Streaks, the heatmap, and the exam countdown are all questions about the
// user's calendar, not about UTC. design.md 5.2 requires every StudyEvent to
// carry a localDate computed on the device at write time, precisely because
// deriving a local date from a UTC timestamp later is a known source of
// off-by-one-day bugs. This module is the one place that conversion lives, so
// the convention cannot drift between the countdown and the streak.
//
// Shape is always "YYYY-MM-DD". Comparing two of these as strings sorts
// chronologically, which is why they are stored as strings rather than Dates.

/** Today (or any instant) as a YYYY-MM-DD date in the DEVICE's timezone. */
export function localDateOf(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Whole days from `from` to `to`. Positive when `to` is later.
 *
 * Both sides are anchored to UTC midnight before subtracting. That is
 * deliberate: plain dates have no time zone, so a local-millisecond
 * subtraction would be off by an hour across a DST boundary and round to the
 * wrong number of days.
 */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Local midnight on a plain date, in the DEVICE's timezone.
 *
 * The countdown target. Midnight rather than an invented start time: the
 * syllabus records which day and whether a subject sits AM or PM, but not the
 * hour the doors open, and a countdown that quietly assumes 8am would be wrong
 * by hours while looking authoritative.
 */
export function localMidnight(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

/** Shift a Date by whole calendar months, clamping to the month's last day so
 *  31 January plus one month is 28 February rather than 3 March. */
function addMonths(d: Date, n: number): Date {
  const day = d.getDate();
  const out = new Date(
    d.getFullYear(),
    d.getMonth() + n,
    1,
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds()
  );
  const lastDay = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate();
  out.setDate(Math.min(day, lastDay));
  return out;
}

export interface Countdown {
  months: number;
  weeks: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** True once the target has arrived or passed. Every field is then 0. */
  reached: boolean;
}

/**
 * Time remaining, split into calendar months first and then the exact
 * remainder.
 *
 * Months are counted as whole calendar months rather than as 30-day blocks,
 * because "11 months" has to mean what a calendar means by it. Only the leftover
 * is measured in fixed units, which is safe here: the Philippines observes no
 * DST, so a day in the remainder is always 86,400 seconds.
 *
 * Never counts past zero — an exam that has started is not "minus three days".
 */
export function countdownTo(target: Date, now: Date = new Date()): Countdown {
  if (now.getTime() >= target.getTime()) {
    return { months: 0, weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0, reached: true };
  }

  let months = 0;
  let cursor = now;
  for (;;) {
    const next = addMonths(cursor, 1);
    if (next.getTime() > target.getTime()) break;
    cursor = next;
    months += 1;
  }

  let ms = target.getTime() - cursor.getTime();
  const totalDays = Math.floor(ms / 86_400_000);
  ms -= totalDays * 86_400_000;
  const hours = Math.floor(ms / 3_600_000);
  ms -= hours * 3_600_000;
  const minutes = Math.floor(ms / 60_000);
  ms -= minutes * 60_000;

  return {
    months,
    weeks: Math.floor(totalDays / 7),
    days: totalDays % 7,
    hours,
    minutes,
    seconds: Math.floor(ms / 1000),
    reached: false,
  };
}

/** Shift a YYYY-MM-DD date by a number of days. Used for window boundaries. */
export function addDays(date: string, delta: number): string {
  const t = Date.parse(`${date}T00:00:00Z`) + delta * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

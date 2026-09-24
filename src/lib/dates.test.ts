import { describe, it, expect } from 'vitest';
import { countdownTo, daysBetween, localDateOf, localMidnight } from './dates';

// These tests construct Dates with the LOCAL constructor (year, monthIndex, day)
// on purpose. Passing an ISO "...Z" string would bake the runner's offset into
// the assertion, which is exactly the class of bug this module exists to prevent.

describe('localDateOf', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(localDateOf(new Date(2026, 8, 21, 13, 45))).toBe('2026-09-21');
  });

  it('zero-pads single-digit months and days', () => {
    expect(localDateOf(new Date(2027, 0, 5, 0, 0))).toBe('2027-01-05');
  });

  it('is stable across the whole local day', () => {
    const early = localDateOf(new Date(2026, 8, 21, 0, 0, 1));
    const late = localDateOf(new Date(2026, 8, 21, 23, 59, 59));
    expect(early).toBe(late);
    expect(early).toBe('2026-09-21');
  });

  it('rolls over at local midnight, not at UTC midnight', () => {
    const lastMoment = localDateOf(new Date(2026, 8, 21, 23, 59, 59));
    const firstMoment = localDateOf(new Date(2026, 8, 22, 0, 0, 0));
    expect(lastMoment).toBe('2026-09-21');
    expect(firstMoment).toBe('2026-09-22');
  });
});

describe('daysBetween', () => {
  it('is 0 for the same date', () => {
    expect(daysBetween('2026-09-21', '2026-09-21')).toBe(0);
  });

  it('counts forward as positive', () => {
    expect(daysBetween('2026-09-21', '2027-09-05')).toBe(349);
  });

  it('counts backward as negative', () => {
    expect(daysBetween('2027-09-05', '2026-09-21')).toBe(-349);
  });

  it('is unaffected by DST shifts, because both sides are plain dates', () => {
    // Northern-hemisphere DST boundary; a naive local-millisecond subtraction
    // would return 0.958... days here and round to the wrong value.
    expect(daysBetween('2027-03-13', '2027-03-15')).toBe(2);
  });
});

// --- countdown --------------------------------------------------------------

describe('countdownTo', () => {
  const at = (s: string) => new Date(s);

  it('is all zeros once the target has arrived', () => {
    const t = localMidnight('2027-09-05');
    expect(countdownTo(t, t).reached).toBe(true);
    expect(countdownTo(t, t)).toMatchObject({ months: 0, weeks: 0, days: 0, seconds: 0 });
  });

  it('never counts past zero — a started exam is not minus three days', () => {
    const t = localMidnight('2027-09-05');
    const after = new Date(t.getTime() + 3 * 86_400_000);
    expect(countdownTo(t, after)).toMatchObject({ reached: true, days: 0, hours: 0 });
  });

  it('splits the remainder into weeks, days, hours, minutes and seconds', () => {
    const now = at('2027-09-01T10:00:00');
    const target = at('2027-09-09T13:30:45');
    // 8 days, 3h 30m 45s -> 1 week 1 day
    expect(countdownTo(target, now)).toMatchObject({
      months: 0,
      weeks: 1,
      days: 1,
      hours: 3,
      minutes: 30,
      seconds: 45,
    });
  });

  it('counts whole CALENDAR months, not 30-day blocks', () => {
    // Feb is short: a 30-day block would under-count this as 0 months.
    expect(countdownTo(at('2027-03-01T00:00:00'), at('2027-02-01T00:00:00')).months).toBe(1);
    expect(countdownTo(at('2027-03-01T00:00:00'), at('2027-02-01T00:00:00')).weeks).toBe(0);
  });

  it('clamps a month-end rollover instead of overshooting into the next month', () => {
    // 31 Jan + 1 month is 28 Feb, so this is exactly one month with no remainder.
    const c = countdownTo(at('2027-02-28T00:00:00'), at('2027-01-31T00:00:00'));
    expect(c.months).toBe(1);
    expect(c.weeks).toBe(0);
    expect(c.days).toBe(0);
  });

  it('measures the real distance to Day 1 of the 2027 Bar', () => {
    const c = countdownTo(localMidnight('2027-09-05'), at('2026-09-22T00:00:00'));
    // 22 Sep 2026 -> 22 Aug 2027 is 11 months; 22 Aug -> 5 Sep is 14 days.
    expect(c).toMatchObject({ months: 11, weeks: 2, days: 0, reached: false });
  });

  it('builds its target from the DEVICE local date, not from UTC', () => {
    const d = localMidnight('2027-09-05');
    expect(d.getFullYear()).toBe(2027);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(5);
    expect(d.getHours()).toBe(0);
  });
});

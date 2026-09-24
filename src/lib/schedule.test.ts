import { describe, expect, it } from 'vitest';
import {
  addRow,
  defaultSchedule,
  moveRow,
  normalise,
  removeRow,
  updateRow,
} from './schedule';

describe('the default routine', () => {
  it('arrives filled in, so the table is useful before any typing', () => {
    const s = defaultSchedule();
    expect(s.weekdays.length).toBeGreaterThan(5);
    expect(s.weekends.length).toBeGreaterThan(5);
  });

  it('gives every row a unique id', () => {
    const s = defaultSchedule();
    const ids = [...s.weekdays, ...s.weekends].map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is a fresh object each call, so one copy cannot mutate another', () => {
    const a = defaultSchedule();
    const b = defaultSchedule();
    a.weekdays[0].activity = 'changed';
    expect(b.weekdays[0].activity).not.toBe('changed');
  });
});

describe('edits', () => {
  it('adds an empty row without touching the other group', () => {
    const s = defaultSchedule();
    const next = addRow(s, 'weekdays');
    expect(next.weekdays).toHaveLength(s.weekdays.length + 1);
    expect(next.weekends).toBe(s.weekends);
    expect(next.weekdays.at(-1)).toMatchObject({ time: '', activity: '', highlight: false });
  });

  it('updates one field without disturbing its neighbours', () => {
    const s = defaultSchedule();
    const id = s.weekdays[2].id;
    const next = updateRow(s, 'weekdays', id, { activity: 'Run' });
    expect(next.weekdays[2].activity).toBe('Run');
    expect(next.weekdays[2].time).toBe(s.weekdays[2].time);
    expect(next.weekdays[1]).toEqual(s.weekdays[1]);
  });

  it('never mutates the schedule it was given', () => {
    const s = defaultSchedule();
    const before = s.weekdays[0].activity;
    updateRow(s, 'weekdays', s.weekdays[0].id, { activity: 'mutated?' });
    expect(s.weekdays[0].activity).toBe(before);
  });

  it('removes a row, and removing the last one leaves an empty list rather than breaking', () => {
    let s = defaultSchedule();
    for (const r of [...s.weekdays]) s = removeRow(s, 'weekdays', r.id);
    expect(s.weekdays).toEqual([]);
    expect(s.weekends.length).toBeGreaterThan(0);
  });

  it('ignores a remove for an id that is not there', () => {
    const s = defaultSchedule();
    expect(removeRow(s, 'weekdays', 'nope').weekdays).toHaveLength(s.weekdays.length);
  });
});

describe('reordering', () => {
  it('moves a row down', () => {
    const s = defaultSchedule();
    const [first, second] = s.weekdays;
    const next = moveRow(s, 'weekdays', first.id, 1);
    expect(next.weekdays[0].id).toBe(second.id);
    expect(next.weekdays[1].id).toBe(first.id);
  });

  it('is a no-op at either end, because the button is always pressable', () => {
    const s = defaultSchedule();
    expect(moveRow(s, 'weekdays', s.weekdays[0].id, -1)).toBe(s);
    expect(moveRow(s, 'weekdays', s.weekdays.at(-1)!.id, 1)).toBe(s);
    expect(moveRow(s, 'weekdays', 'missing', 1)).toBe(s);
  });
});

// --- storage is hand-editable, so nothing from it is trusted ----------------

describe('normalise', () => {
  it('falls back to the default for junk', () => {
    for (const junk of [null, undefined, 42, 'nope', {}, { weekdays: 'x' }]) {
      expect(normalise(junk).weekdays.length).toBeGreaterThan(0);
    }
  });

  it('keeps a valid schedule', () => {
    const s = defaultSchedule();
    const round = normalise(JSON.parse(JSON.stringify(s)));
    expect(round.weekdays).toHaveLength(s.weekdays.length);
    expect(round.weekdays[0].activity).toBe(s.weekdays[0].activity);
  });

  it('repairs rows with missing or wrongly typed fields instead of throwing', () => {
    const out = normalise({
      weekdays: [{ id: 'a' }, { id: 'b', time: 5, activity: null, highlight: 'yes' }, null],
      weekends: [],
    });
    expect(out.weekdays).toHaveLength(2);
    expect(out.weekdays[0]).toMatchObject({ time: '', activity: '', notes: '', highlight: false });
    // A truthy non-boolean must not become a highlight.
    expect(out.weekdays[1].highlight).toBe(false);
    expect(out.weekends).toEqual([]);
  });

  it('mints an id for a row that lost one, so React keys stay stable', () => {
    const out = normalise({ weekdays: [{ activity: 'x' }], weekends: [] });
    expect(out.weekdays[0].id).toBeTruthy();
  });
});

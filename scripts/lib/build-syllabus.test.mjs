import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSyllabus } from './build-syllabus.mjs';

const XLSX = resolve(process.cwd(), '2027 Bar Exam Study Tracker.xlsx');

// Ground truth, read off the workbook's own Dashboard sheet.
const EXPECTED = [
  { id: 'political',      weight: 0.15, items: 263, parts: 14, examDay: 1, examSlot: 'AM' },
  { id: 'commercial-tax', weight: 0.20, items: 260, parts: 7,  examDay: 1, examSlot: 'PM' },
  { id: 'civil',          weight: 0.20, items: 247, parts: 12, examDay: 2, examSlot: 'AM' },
  { id: 'labor',          weight: 0.10, items: 200, parts: 8,  examDay: 2, examSlot: 'PM' },
  { id: 'criminal',       weight: 0.10, items: 120, parts: 4,  examDay: 3, examSlot: 'AM' },
  { id: 'remedial-ethics',weight: 0.25, items: 399, parts: 10, examDay: 3, examSlot: 'PM' },
];

let data;

beforeAll(() => {
  data = buildSyllabus(readFileSync(XLSX));
});

describe('importer: totals', () => {
  it('produces exactly 6 subjects', () => {
    expect(data.subjects).toHaveLength(6);
  });

  it('produces exactly 55 parts', () => {
    expect(data.parts).toHaveLength(55);
  });

  it('produces exactly 1489 items', () => {
    expect(data.items).toHaveLength(1489);
  });

  it('has weights summing to exactly 1', () => {
    const sum = data.subjects.reduce((a, s) => a + s.weight, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe('importer: per subject', () => {
  for (const exp of EXPECTED) {
    it(`${exp.id}: ${exp.items} items, ${exp.parts} parts, weight ${exp.weight}`, () => {
      const s = data.subjects.find((x) => x.id === exp.id);
      expect(s, `subject ${exp.id} missing`).toBeDefined();
      expect(s.weight).toBeCloseTo(exp.weight, 10);
      expect(s.examDay).toBe(exp.examDay);
      expect(s.examSlot).toBe(exp.examSlot);
      expect(s.itemCount).toBe(exp.items);
      expect(data.items.filter((i) => i.subjectId === exp.id)).toHaveLength(exp.items);
      expect(data.parts.filter((p) => p.subjectId === exp.id)).toHaveLength(exp.parts);
    });
  }
});

describe('importer: item identity', () => {
  it('gives every item a globally unique id', () => {
    const ids = new Set(data.items.map((i) => i.id));
    expect(ids.size).toBe(data.items.length);
  });

  it('scopes ids by subject, because refs collide across subjects', () => {
    // "I.A.1" exists in more than one subject in the source workbook.
    const collided = data.items.filter((i) => i.ref === 'I.A.1');
    expect(collided.length).toBeGreaterThan(1);
    const ids = new Set(collided.map((i) => i.id));
    expect(ids.size).toBe(collided.length);
    for (const i of collided) expect(i.id).toBe(`${i.subjectId}:${i.ref}`);
  });

  it('gives every item non-empty text and a real part', () => {
    const partIds = new Set(data.parts.map((p) => p.id));
    for (const i of data.items) {
      expect(i.text.length, `empty text on ${i.id}`).toBeGreaterThan(0);
      expect(partIds.has(i.partId), `bad partId on ${i.id}`).toBe(true);
    }
  });
});

describe('importer: hierarchy', () => {
  it('splits flattened sub-topic paths on the chevron separator', () => {
    const nested = data.items.filter((i) => i.subtopicPath.length > 1);
    expect(nested.length).toBeGreaterThan(0);
    for (const i of nested) {
      for (const seg of i.subtopicPath) {
        expect(seg.length).toBeGreaterThan(0);
        expect(seg).not.toContain('\u203A');
      }
    }
  });

  it('orders parts 1..n within each subject with no gaps', () => {
    for (const s of data.subjects) {
      const seqs = data.parts
        .filter((p) => p.subjectId === s.id)
        .map((p) => p.seq)
        .sort((a, b) => a - b);
      expect(seqs).toEqual(Array.from({ length: seqs.length }, (_, k) => k + 1));
    }
  });

  it('keeps every part non-empty', () => {
    for (const p of data.parts) expect(p.itemCount).toBeGreaterThan(0);
  });
});

describe('importer: text hygiene', () => {
  it('leaves no Windows-1252 mojibake in any string', () => {
    // The source workbook contains sequences like "ΓÇô" and "ΓÇ£".
    const bad = /\u0393\u00C7|\u00C3\u00A2\u00C2|\uFFFD/;
    const offenders = [];
    for (const i of data.items) {
      if (bad.test(i.text) || bad.test(i.topic) || i.subtopicPath.some((s) => bad.test(s))) {
        offenders.push(i.id);
      }
    }
    for (const p of data.parts) if (bad.test(p.title)) offenders.push(p.id);
    expect(offenders).toEqual([]);
  });

  it('normalises the chevron and dash characters to real Unicode', () => {
    const all = data.items.map((i) => i.text).join(' ');
    expect(all).toMatch(/\u2013|\u2019|\u201C/); // en dash / curly quotes survived as Unicode
  });
});

describe('importer: reference data only', () => {
  it('imports no user progress, ignoring the workbook demo statuses', () => {
    for (const i of data.items) {
      expect(i).not.toHaveProperty('mastery');
      expect(i).not.toHaveProperty('status');
      expect(i).not.toHaveProperty('needsReview');
    }
    expect(data).not.toHaveProperty('progress');
  });
});

describe('importer: calendar', () => {
  it('imports the 50-week study calendar with phases', () => {
    expect(data.calendar.length).toBe(50);
    const phases = new Set(data.calendar.map((w) => w.phase));
    expect(phases).toContain('First pass');
    expect(phases).toContain('Second pass');
    expect(phases).toContain('Pre-week / mocks');
    for (const w of data.calendar) {
      expect(w.week).toBeGreaterThan(0);
      expect(w.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

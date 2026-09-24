#!/usr/bin/env node
// Regenerates src/data/syllabus.json from the workbook.
// Fails loudly rather than emitting partial data.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { buildSyllabus } from './lib/build-syllabus.mjs';

const SOURCE = resolve(process.cwd(), '2027 Bar Exam Study Tracker.xlsx');
// Lives in public/ so it ships as a separately cacheable asset the service
// worker can store, rather than being inlined into the JS bundle.
const OUT = resolve(process.cwd(), 'public/data/syllabus.json');

// Ground truth from the workbook's Dashboard. The import fails if these drift,
// because silently losing syllabus rows is the worst failure this app has.
const EXPECT = {
  subjects: 6,
  parts: 55,
  items: 1489,
  perSubject: {
    political: 263,
    'commercial-tax': 260,
    civil: 247,
    labor: 200,
    criminal: 120,
    'remedial-ethics': 399,
  },
};

const data = buildSyllabus(readFileSync(SOURCE));

const problems = [];
if (data.subjects.length !== EXPECT.subjects)
  problems.push(`expected ${EXPECT.subjects} subjects, got ${data.subjects.length}`);
if (data.parts.length !== EXPECT.parts)
  problems.push(`expected ${EXPECT.parts} parts, got ${data.parts.length}`);
if (data.items.length !== EXPECT.items)
  problems.push(`expected ${EXPECT.items} items, got ${data.items.length}`);

for (const [id, n] of Object.entries(EXPECT.perSubject)) {
  const actual = data.items.filter((i) => i.subjectId === id).length;
  if (actual !== n) problems.push(`${id}: expected ${n} items, got ${actual}`);
}

const weightSum = data.subjects.reduce((a, s) => a + s.weight, 0);
if (Math.abs(weightSum - 1) > 1e-9) problems.push(`weights sum to ${weightSum}, expected 1`);

if (problems.length) {
  console.error('IMPORT FAILED — refusing to write partial data:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(data), 'utf8');

const bytes = Buffer.byteLength(JSON.stringify(data));
console.log('Import OK');
console.log(`  subjects : ${data.subjects.length}`);
console.log(`  parts    : ${data.parts.length}`);
console.log(`  items    : ${data.items.length}`);
console.log(`  calendar : ${data.calendar.length} weeks`);
console.log(`  size     : ${(bytes / 1024).toFixed(1)} KB raw`);
console.log(`  written  : public/data/syllabus.json`);

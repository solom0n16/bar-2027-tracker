// Turns the 2027 Bar Exam Study Tracker workbook into the app's immutable
// reference data. Reference data ONLY — no user progress is ever imported
// (the workbook's six "Completed" cells are demo values, see design.md 5.1).

import { readWorkbook, excelSerialToISO } from './xlsx.mjs';

const CHEVRON = '\u203A'; // the separator the author used to flatten deep nesting

// Sheet name -> stable subject id. Sheet order is exam order.
const SUBJECT_IDS = {
  '1 Political': 'political',
  '2 Comm-Tax': 'commercial-tax',
  '3 Civil': 'civil',
  '4 Labor': 'labor',
  '5 Criminal': 'criminal',
  '6 Remedial-Ethics': 'remedial-ethics',
};

const SHORT_NAMES = {
  political: 'Political Law',
  'commercial-tax': 'Commercial & Tax',
  civil: 'Civil Law',
  labor: 'Labor Law',
  criminal: 'Criminal Law',
  'remedial-ethics': 'Remedial & Ethics',
};

// Columns in each subject sheet (1-based)
const COL = { REF: 1, PART: 2, TOPIC: 3, SUBTOPIC: 4, ITEM: 5, STATUS: 6, NOTES: 7 };
const FIRST_DATA_ROW = 5;

export function buildSyllabus(xlsxBuffer) {
  const sheets = readWorkbook(xlsxBuffer);
  const byName = new Map(sheets.map((s) => [s.name, s]));

  const meta = readDashboard(byName.get('Dashboard'));
  const subjects = [];
  const parts = [];
  const items = [];

  let seq = 0;
  for (const [sheetName, subjectId] of Object.entries(SUBJECT_IDS)) {
    const sheet = byName.get(sheetName);
    if (!sheet) throw new Error(`workbook missing subject sheet: ${sheetName}`);
    seq += 1;

    const slot = readExamSlot(sheet);
    const m = meta.get(subjectId);
    if (!m) throw new Error(`Dashboard has no row for subject: ${subjectId}`);

    const { subjectParts, subjectItems } = readSubjectSheet(sheet, subjectId);

    parts.push(...subjectParts);
    items.push(...subjectItems);

    subjects.push({
      id: subjectId,
      seq,
      name: m.name,
      shortName: SHORT_NAMES[subjectId],
      weight: m.weight,
      examDay: slot.day,
      examDate: slot.date,
      examSlot: slot.slot,
      partIds: subjectParts.map((p) => p.id),
      itemCount: subjectItems.length,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    source: '2027 Bar Exam Study Tracker.xlsx',
    attribution: {
      author: 'Atty. Kaye Lucille Marie A. Hugo',
      organisation: 'KLMAH Law Office',
      url: 'https://attyhugo.com',
      note: 'Syllabus transcribed from Bar Bulletin No. 1-2027. Where this app and the official Supreme Court microsite differ, the microsite controls.',
    },
    exam: {
      days: ['2027-09-05', '2027-09-08', '2027-09-12'],
      coverageCutoff: '2026-06-30',
      officialSource: 'https://sc.judiciary.gov.ph/bar-2027',
      passingAverage: 0.75,
      essaysPerSubject: 20,
    },
    subjects,
    parts,
    items,
    calendar: readCalendar(byName.get('Study Calendar')),
  };
}

// --- Dashboard: canonical subject names and grade weights -------------------

function readDashboard(sheet) {
  if (!sheet) throw new Error('workbook missing Dashboard sheet');
  const ids = Object.values(SUBJECT_IDS);
  const meta = new Map();

  // Rows 6..11 hold one subject each: B = name, C = weight.
  for (let row = 6, i = 0; row <= 11; row++, i++) {
    const cells = sheet.rows.get(row);
    if (!cells) throw new Error(`Dashboard row ${row} is empty`);
    const name = cells.get(2);
    const weight = Number(cells.get(3));
    if (!name || !Number.isFinite(weight)) {
      throw new Error(`Dashboard row ${row} missing name or weight`);
    }
    meta.set(ids[i], { name, weight });
  }
  return meta;
}

// --- Subject sheet row 2: "Exam slot: Day 1 (Sept 5, 2027), AM | ..." -------

const MONTHS = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sept: 9, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

function readExamSlot(sheet) {
  const cells = sheet.rows.get(2);
  const text = cells?.get(1) ?? '';
  const m = /Day\s+(\d)\s+\(([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\),\s*(AM|PM)/.exec(text);
  if (!m) throw new Error(`cannot parse exam slot from "${sheet.name}" row 2: ${text}`);
  const month = MONTHS[m[2]];
  if (!month) throw new Error(`unknown month "${m[2]}" in "${sheet.name}"`);
  const date = `${m[4]}-${String(month).padStart(2, '0')}-${String(Number(m[3])).padStart(2, '0')}`;
  return { day: Number(m[1]), date, slot: m[5] };
}

// --- Subject sheet body -----------------------------------------------------

function readSubjectSheet(sheet, subjectId) {
  const subjectParts = [];
  const subjectItems = [];
  const partBySeq = new Map(); // part title -> part object
  const usedIds = new Set();

  const rowNums = [...sheet.rows.keys()].filter((r) => r >= FIRST_DATA_ROW).sort((a, b) => a - b);

  for (const rowNum of rowNums) {
    const cells = sheet.rows.get(rowNum);
    const itemText = cells.get(COL.ITEM);

    // An item row is defined by a non-empty "Item to Study" cell — the same
    // rule the workbook's own COUNTA formulas use.
    if (!itemText) continue;

    const partTitle = cells.get(COL.PART);
    if (!partTitle) throw new Error(`${sheet.name} row ${rowNum}: item with no Part`);

    let part = partBySeq.get(partTitle);
    if (!part) {
      const partSeq = subjectParts.length + 1;
      part = {
        id: `${subjectId}-${String(partSeq).padStart(2, '0')}`,
        subjectId,
        seq: partSeq,
        title: partTitle,
        itemIds: [],
        itemCount: 0,
      };
      partBySeq.set(partTitle, part);
      subjectParts.push(part);
    }

    const ref = cells.get(COL.REF) ?? `r${rowNum}`;
    let id = `${subjectId}:${ref}`;
    if (usedIds.has(id)) {
      // Refs are unique per subject in the source, but never trust that
      // silently — disambiguate rather than drop a row.
      let n = 2;
      while (usedIds.has(`${id}#${n}`)) n++;
      id = `${id}#${n}`;
    }
    usedIds.add(id);

    const subtopicRaw = cells.get(COL.SUBTOPIC) ?? '';
    const subtopicPath = subtopicRaw
      .split(CHEVRON)
      .map((s) => s.trim())
      .filter(Boolean);

    subjectItems.push({
      id,
      ref: String(ref),
      subjectId,
      partId: part.id,
      topic: cells.get(COL.TOPIC) ?? '',
      subtopicPath,
      text: itemText,
      seq: subjectItems.length + 1,
    });

    part.itemIds.push(id);
    part.itemCount += 1;
  }

  return { subjectParts, subjectItems };
}

// --- Study Calendar ---------------------------------------------------------

function readCalendar(sheet) {
  if (!sheet) throw new Error('workbook missing Study Calendar sheet');
  const out = [];

  const rowNums = [...sheet.rows.keys()].filter((r) => r >= FIRST_DATA_ROW).sort((a, b) => a - b);
  for (const rowNum of rowNums) {
    const cells = sheet.rows.get(rowNum);
    const week = Number(cells.get(1));
    const startSerial = cells.get(2);
    if (!Number.isFinite(week) || week <= 0 || !startSerial) continue;

    out.push({
      week: Math.round(week),
      startDate: excelSerialToISO(startSerial),
      endDate: cells.get(3) ? excelSerialToISO(cells.get(3)) : null,
      daysToExam: cells.get(4) ? Number(cells.get(4)) : null,
      phase: cells.get(5) ?? '',
      focus: cells.get(6) ?? '',
      targetItems: cells.get(7) ? Number(cells.get(7)) : null,
    });
  }

  return out;
}

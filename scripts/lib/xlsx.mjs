// Reads an .xlsx into plain sheet/row/cell data. No styling, no formulas —
// just the values the importer needs.

import { unzip } from './unzip.mjs';

const XML_ENTITIES = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};

function decodeEntities(s) {
  return s
    .replace(/&(?:lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m])
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&'); // must be last
}

function colToNum(col) {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/**
 * @param {Buffer} buf raw .xlsx bytes
 * @returns {{ name: string, rows: Map<number, Map<number, string>> }[]}
 *   Sheets in workbook order. Rows and cells are 1-based and sparse.
 */
export function readWorkbook(buf) {
  const zip = unzip(buf);
  const text = (name) => {
    const b = zip.get(name);
    if (!b) throw new Error(`xlsx missing part: ${name}`);
    return b.toString('utf8'); // xlsx XML is always UTF-8
  };

  // Shared string table
  const shared = [];
  if (zip.has('xl/sharedStrings.xml')) {
    const sst = text('xl/sharedStrings.xml');
    for (const si of sst.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      const parts = [...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) =>
        decodeEntities(t[1])
      );
      shared.push(parts.join(''));
    }
  }

  // Sheet name -> target part, via workbook rels
  const rels = new Map();
  for (const r of text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship([^>]*)\/>/g)) {
    const id = /Id="([^"]+)"/.exec(r[1])?.[1];
    const target = /Target="([^"]+)"/.exec(r[1])?.[1];
    if (id && target) rels.set(id, target);
  }

  const sheets = [];
  for (const s of text('xl/workbook.xml').matchAll(/<sheet([^>]*)\/>/g)) {
    const name = decodeEntities(/name="([^"]*)"/.exec(s[1])?.[1] ?? '');
    const rid = /r:id="([^"]+)"/.exec(s[1])?.[1];
    let target = rels.get(rid) ?? '';
    if (target.startsWith('/xl/')) target = target.slice(1);
    else if (!target.startsWith('xl/')) target = 'xl/' + target.replace(/^\.\//, '');
    sheets.push({ name, rows: readSheet(text(target), shared) });
  }

  return sheets;
}

function readSheet(xml, shared) {
  const rows = new Map();

  for (const rm of xml.matchAll(/<row([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowNum = Number(/r="(\d+)"/.exec(rm[1])?.[1] ?? 0);
    if (!rowNum) continue;

    const cells = new Map();
    for (const cm of rm[2].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const body = cm[2] ?? '';
      const ref = /r="([A-Z]+)(\d+)"/.exec(attrs);
      if (!ref) continue;

      const t = /t="([^"]+)"/.exec(attrs)?.[1];
      let value = '';

      if (t === 's') {
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        value = v != null ? shared[Number(v)] ?? '' : '';
      } else if (t === 'inlineStr') {
        value = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
          .map((x) => decodeEntities(x[1]))
          .join('');
      } else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        value = v != null ? decodeEntities(v) : '';
      }

      value = String(value).trim();
      if (value !== '') cells.set(colToNum(ref[1]), value);
    }

    if (cells.size) rows.set(rowNum, cells);
  }

  return rows;
}

/** Excel serial date -> "YYYY-MM-DD". Excel's epoch is 1899-12-30. */
export function excelSerialToISO(serial) {
  const ms = Date.UTC(1899, 11, 30) + Number(serial) * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

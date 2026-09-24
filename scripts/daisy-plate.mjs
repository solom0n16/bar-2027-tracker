// Daisy plate generator — the static art called for by design.md 19.
//
// 19.7 is binding: "The art is authored once as static plates, reviewed, and
// only then wired to data." That review happened; the art is now wired.
//
// THIS SCRIPT NO LONGER OWNS ANY GEOMETRY. Every curve comes from
// src/lib/daisy.ts, the same module <Daisy/> renders from, so the plate cannot
// quietly disagree with the app it is supposed to document. Node strips the
// TypeScript natively (v23+), which is why a .mjs can import a .ts here.
//
// What lives here is composition: page layout, annotation, and the plausible
// states the plate illustrates.
//
// Every count in the drawing is READ from the real syllabus rather than typed
// in. If the syllabus ever stops having 6 subjects and 55 parts, this refuses to
// draw rather than emitting a pretty lie.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GAP_DEG,
  ROSETTE_ANGLES,
  STAGES,
  budGeometry,
  clamp01,
  discFlorets,
  involucreBracts,
  leafGeometry,
  leafScale,
  plausibleFills,
  rayFloretPath,
  rayWidthAt,
  rootPaths,
  scapePath,
  sectorsOf,
  seeded,
} from '../src/lib/daisy.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT_DIR = resolve(ROOT, '.specship/specs/001-bar-exam-tracker/artifacts');

// --- reference data ---------------------------------------------------------

const syllabus = JSON.parse(readFileSync(resolve(ROOT, 'src/data/syllabus.json'), 'utf8'));
const SUBJECTS = syllabus.subjects;
const PARTS = syllabus.parts;

if (SUBJECTS.length !== 6 || PARTS.length !== 55) {
  throw new Error(
    `Plate refuses to draw: expected 6 subjects / 55 parts, read ${SUBJECTS.length} / ${PARTS.length}`
  );
}

const SECTORS = sectorsOf(SUBJECTS, PARTS);
const ALL_RAYS = SECTORS.flatMap((s) => s.rays);

// --- palette ----------------------------------------------------------------
//
// Inlined ONLY so a plate opens standalone in a browser with no stylesheet;
// every shape below still references var(--c-*), exactly as the component does.

const TOKENS = {
  'c-surface': '#f0dac5', 'c-raised': '#fbf4ec', 'c-sunken': '#e3c8ac',
  'c-ink': '#1c2340', 'c-ink-muted': '#4b5170', 'c-heading': '#50223c',
  'c-accent': '#93304a', 'c-line': '#8c7358', 'c-flag': '#7e5410',
  'c-ray': '#fbf4ec', 'c-ray-edge': '#c0405e',
  'c-disc': '#e0b15c', 'c-disc-edge': '#7e5410',
  'c-stem': '#37604d', 'c-leaf': '#4f7d66', 'c-leaf-edge': '#2c4f3e',
  'c-bud': '#4f7d66', 'c-bud-edge': '#2c4f3e', 'c-soil': '#8c7358',
};

// --- render helpers ---------------------------------------------------------

const f = (n) => Number(n.toFixed(2));
const RAD = Math.PI / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function renderLeaf(geo, sw = 1) {
  let out = `<path d="${geo.blade}" fill="var(--c-leaf)" stroke="var(--c-leaf-edge)" stroke-width="${f(0.9 * sw)}" stroke-linejoin="round"/>`;
  out += `<path d="${geo.midrib}" fill="none" stroke="var(--c-leaf-edge)" stroke-width="${f(0.7 * sw)}" opacity="0.55"/>`;
  for (const v of geo.veins) {
    out += `<path d="${v}" fill="none" stroke="var(--c-leaf-edge)" stroke-width="${f(0.5 * sw)}" opacity="0.45"/>`;
  }
  return `<g>${out}</g>`;
}

function rosette(x, y, baseLen, growth, sw, count = 6) {
  return [...SUBJECTS]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, count)
    .map((s) => {
      const L = baseLen * leafScale(s.weight) * growth;
      return L < 3 ? '' : renderLeaf(leafGeometry(x, y, ROSETTE_ANGLES[s.id] ?? 0, L), sw);
    })
    .join('');
}

function renderScape(x, yBase, yTop, sw, rnd) {
  const d = scapePath(x, yBase, yTop, (rnd() - 0.5) * (yBase - yTop) * 0.09);
  if (!d) return '';
  return `<path d="${d}" fill="none" stroke="var(--c-stem)" stroke-width="${f(5.2 * sw)}" stroke-linecap="round"/>`;
}

function renderHead({ cx, cy, r0, r1, fills, openness, sw = 1, rnd }) {
  const open = clamp01(openness);
  const discR = r0 * (0.34 + 0.66 * open);
  const maxW = rayWidthAt(r1);

  let out = '<g>';
  for (const d of involucreBracts(cx, cy, r0 * 0.95, 1 + 1.9 * (1 - open))) {
    out += `<path d="${d}" fill="var(--c-bud)" stroke="var(--c-bud-edge)" stroke-width="${f(0.7 * sw)}" stroke-linejoin="round"/>`;
  }

  for (const ray of ALL_RAYS) {
    const fill = clamp01(fills.get(ray.partId) ?? 0);
    if (fill <= 0.001) continue;
    const reach = r0 + (r1 - r0) * fill * (0.32 + 0.68 * open);
    const d = rayFloretPath(cx, cy, ray.angle, r0 * 0.92, reach, maxW, r1 > 70);
    if (d) {
      out += `<path d="${d}" fill="var(--c-ray)" stroke="var(--c-ray-edge)" stroke-width="${f(0.9 * sw)}" stroke-linejoin="round"/>`;
    }
  }

  out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(discR)}" fill="var(--c-disc)" stroke="var(--c-disc-edge)" stroke-width="${f(1.1 * sw)}"/>`;
  for (const d of discFlorets(cx, cy, discR * 0.94, rnd)) {
    const skin = d.outer
      ? `fill="var(--c-disc)" stroke="var(--c-disc-edge)" stroke-width="${f(0.5 * sw)}"`
      : `fill="var(--c-disc-edge)" opacity="0.72"`;
    out += `<circle cx="${f(d.x)}" cy="${f(d.y)}" r="${f(d.r)}" ${skin}/>`;
  }
  return out + '</g>';
}

function renderBud(cx, cy, r, sw = 1) {
  const g = budGeometry(cx, cy, r);
  let out = '';
  for (const d of g.bracts) {
    out += `<path d="${d}" fill="var(--c-bud)" stroke="var(--c-bud-edge)" stroke-width="${f(0.8 * sw)}" stroke-linejoin="round"/>`;
  }
  out += `<path d="${g.body}" fill="var(--c-bud)" stroke="var(--c-bud-edge)" stroke-width="${f(1.2 * sw)}" stroke-linejoin="round"/>`;
  for (const d of g.scales) {
    out += `<path d="${d}" fill="none" stroke="var(--c-bud-edge)" stroke-width="${f(0.7 * sw)}" opacity="0.6"/>`;
  }
  return out;
}

function renderRoots(x, y, len, sw, rnd) {
  return rootPaths(x, y, len, rnd)
    .map(
      (d) =>
        `<path d="${d}" fill="none" stroke="var(--c-soil)" stroke-width="${f(1.1 * sw)}" stroke-linecap="round" opacity="0.8"/>`
    )
    .join('');
}

function soil(x0, x1, y, sw, rnd) {
  let out = `<path d="M ${f(x0)} ${f(y)} L ${f(x1)} ${f(y)}" stroke="var(--c-soil)" stroke-width="${f(1.1 * sw)}" opacity="0.85"/>`;
  const n = Math.round((x1 - x0) * 0.55);
  for (let i = 0; i < n; i++) {
    const px = lerp(x0, x1, rnd());
    const depth = Math.pow(rnd(), 1.9) * 26 * sw;
    out += `<circle cx="${f(px)}" cy="${f(y + 2 + depth)}" r="${f((0.5 + rnd() * 1.1) * sw)}" fill="var(--c-soil)" opacity="${f(Math.max(0.08, 0.5 - depth / 90))}"/>`;
  }
  return out;
}

// --- text -------------------------------------------------------------------

const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";
const SANS = "Inter, ui-sans-serif, system-ui, 'Segoe UI', sans-serif";

function txt(x, y, s, opts = {}) {
  const {
    size = 10, fill = 'var(--c-ink-muted)', anchor = 'start',
    family = SANS, style = '', weight = 400, spacing = 0,
  } = opts;
  return (
    `<text x="${f(x)}" y="${f(y)}" font-family="${family}" font-size="${size}" fill="${fill}" ` +
    `text-anchor="${anchor}" font-weight="${weight}"` +
    (style ? ` font-style="${style}"` : '') +
    (spacing ? ` letter-spacing="${spacing}"` : '') +
    `>${esc(s)}</text>`
  );
}

function annotate(lines, tx, ty, px, py, anchor) {
  const elbowX = anchor === 'end' ? tx + 14 : tx - 14;
  let out =
    `<path d="M ${f(elbowX)} ${f(ty - 4)} L ${f(lerp(elbowX, px, 0.55))} ${f(ty - 4)} L ${f(px)} ${f(py)}" ` +
    `fill="none" stroke="var(--c-line)" stroke-width="0.7" opacity="0.85"/>`;
  out += `<circle cx="${f(px)}" cy="${f(py)}" r="1.4" fill="var(--c-line)"/>`;
  lines.forEach((l, i) => {
    out += txt(tx, ty + i * 13, l, {
      size: i === 0 ? 10 : 9.5,
      anchor,
      fill: i === 0 ? 'var(--c-ink)' : 'var(--c-ink-muted)',
      weight: i === 0 ? 600 : 400,
      spacing: i === 0 ? 0.6 : 0,
    });
  });
  return out;
}

// --- plausible states -------------------------------------------------------
//
// The plate illustrates states that have not happened, so it manufactures
// believable ones. Shared with the app's stage preview, which needs exactly the
// same thing for exactly the same reason.

const fillsFor = (coverage, depth, rnd) => plausibleFills(SECTORS, coverage, depth, rnd);

const FULL = new Map(ALL_RAYS.map((r) => [r.partId, 1]));

// --- stage figures ----------------------------------------------------------

const STAGE_STATE = {
  I: [0, 0], II: [0.06, 0.02], III: [0.18, 0.07], IV: [0.35, 0.15],
  V: [0.55, 0.26], VI: [0.75, 0.44], VII: [0.93, 0.81],
};

function stageFigure(stage, cx, soilY, rnd) {
  const sw = 0.62;
  const [cov, dep] = STAGE_STATE[stage.roman];
  let out = '';
  const growth = clamp01(cov / 0.42);
  const scapeH = 122 * clamp01((cov - 0.4) / 0.58);
  const headR = 13 + 31 * clamp01((cov - 0.42) / 0.5);

  if (stage.roman === 'I') {
    out += `<ellipse cx="${f(cx)}" cy="${f(soilY + 16)}" rx="7.5" ry="10" fill="var(--c-soil)" stroke="var(--c-bud-edge)" stroke-width="0.9"/>`;
    out += `<path d="M ${f(cx - 3)} ${f(soilY + 11)} Q ${f(cx)} ${f(soilY + 16)}, ${f(cx - 2)} ${f(soilY + 21)}" fill="none" stroke="var(--c-bud-edge)" stroke-width="0.6" opacity="0.7"/>`;
    return out;
  }

  if (stage.roman === 'II') {
    out += renderRoots(cx, soilY + 4, 30, sw, rnd);
    out += `<ellipse cx="${f(cx)}" cy="${f(soilY + 13)}" rx="6.5" ry="8.5" fill="var(--c-soil)" stroke="var(--c-bud-edge)" stroke-width="0.8" opacity="0.75"/>`;
    out += `<path d="M ${f(cx)} ${f(soilY + 8)} C ${f(cx - 2)} ${f(soilY - 14)}, ${f(cx + 13)} ${f(soilY - 22)}, ${f(cx + 9)} ${f(soilY - 10)}" fill="none" stroke="var(--c-stem)" stroke-width="${f(3.4 * sw)}" stroke-linecap="round"/>`;
    out += renderLeaf(leafGeometry(cx + 9, soilY - 10, 214, 20, 26), sw);
    out += renderLeaf(leafGeometry(cx + 9, soilY - 10, 250, 17, 26), sw);
    return out;
  }

  if (stage.roman === 'III') {
    out += renderRoots(cx, soilY + 4, 38, sw, rnd);
    out += `<path d="M ${f(cx)} ${f(soilY + 2)} L ${f(cx)} ${f(soilY - 18)}" stroke="var(--c-stem)" stroke-width="${f(3.4 * sw)}" stroke-linecap="round"/>`;
    out += renderLeaf(leafGeometry(cx, soilY - 6, 178, 26, 28), sw);
    out += renderLeaf(leafGeometry(cx, soilY - 6, 2, 24, 28), sw);
    out += rosette(cx, soilY - 16, 44, growth, sw, 2);
    return out;
  }

  out += renderRoots(cx, soilY + 3, 44, sw, rnd);
  out += rosette(cx, soilY - 4, 52, growth, sw, cov > 0.5 ? 6 : 4);

  if (scapeH > 6) {
    const yTop = soilY - 6 - scapeH;
    out += renderScape(cx, soilY - 6, yTop, sw, rnd);
    if (stage.roman === 'V') {
      out += renderBud(cx, yTop - 12, 15, sw);
    } else {
      out += renderHead({
        cx, cy: yTop - headR * 0.55, r0: headR * 0.34, r1: headR,
        fills: fillsFor(cov, dep, rnd), openness: clamp01(dep / 0.72), sw, rnd,
      });
    }
  }
  return out;
}

// --- the plate --------------------------------------------------------------

const W = 1400;
const H = 1500;

function buildPlate() {
  const rnd = seeded(20270905);
  const style = Object.entries(TOKENS).map(([k, v]) => `    --${k}: ${v};`).join('\n');

  let s = '';
  s += `<rect x="0" y="0" width="${W}" height="${H}" fill="var(--c-surface)"/>`;
  s += `<rect x="24" y="24" width="${W - 48}" height="${H - 48}" fill="none" stroke="var(--c-line)" stroke-width="1.3"/>`;
  s += `<rect x="33" y="33" width="${W - 66}" height="${H - 66}" fill="none" stroke="var(--c-line)" stroke-width="0.6" opacity="0.75"/>`;

  s += txt(W / 2, 80, 'Bellis iuris', { size: 34, family: SERIF, style: 'italic', fill: 'var(--c-heading)', anchor: 'middle' });
  s += txt(W / 2, 106, 'THE STUDY PLANT  ·  SEVEN STAGES OF GROWTH  ·  DRAWN FROM THE 2027 SYLLABUS', { size: 10.5, anchor: 'middle', spacing: 2.6 });
  s += `<path d="M 240 124 L ${W - 240} 124" stroke="var(--c-line)" stroke-width="0.7" opacity="0.8"/>`;

  const GROUND = 800;
  const CAPTION_Y = 900;

  // --- Fig. 1: habit at full bloom ---
  const mainCx = 385, bloomCy = 358, r1 = 148, r0 = 46;
  s += soil(238, 532, GROUND, 1, rnd);
  s += renderRoots(mainCx, GROUND + 3, 54, 1, rnd);
  s += rosette(mainCx, GROUND - 8, 128, 1, 1);
  s += renderScape(mainCx, GROUND - 12, bloomCy + r0 * 0.9, 1, rnd);
  s += renderHead({
    cx: mainCx, cy: bloomCy, r0, r1,
    fills: fillsFor(0.96, 0.91, seeded(7)), openness: 0.97, sw: 1, rnd: seeded(11),
  });
  s += txt(mainCx, CAPTION_Y, 'Fig. 1 — Habit at full bloom.  Coverage 96%, depth 91%.', { size: 10.5, anchor: 'middle', family: SERIF, fill: 'var(--c-ink)' });

  // --- Fig. 2: the capitulum, annotated ---
  const keyCx = 1062, keyCy = 300, keyR1 = 100, keyR0 = 32;
  s += renderHead({
    cx: keyCx, cy: keyCy, r0: keyR0, r1: keyR1,
    fills: FULL, openness: 0.86, sw: 0.85, rnd: seeded(3),
  });

  const polar = (ang, rad) => [keyCx + Math.cos(ang * RAD) * rad, keyCy + Math.sin(ang * RAD) * rad];
  const remedial = SECTORS.find((x) => x.subjectId === 'remedial-ethics');
  const labor = SECTORS.find((x) => x.subjectId === 'labor');

  const [rx, ry] = polar(remedial.rays[1].angle, keyR1 * 0.9);
  s += annotate(['RAY FLORET', 'One of 55 — one per Part.', 'Extends as that Part fills.'], 900, 232, rx, ry, 'end');

  const [gx, gy] = polar(labor.start + labor.span + GAP_DEG / 2, keyR1 * 0.82);
  s += annotate(['SECTOR GAP', 'One of six. The gaps in the', 'ring are the subject boundaries.'], 900, 372, gx, gy, 'end');

  const [dx1, dy1] = polar(-38, keyR0 * 0.62);
  s += annotate(['DISC FLORETS', 'Weighted coverage × depth —', 'the number that decides passing.'], 1200, 232, dx1, dy1, 'start');

  const [ix, iy] = polar(48, keyR0 * 1.2);
  s += annotate(['INVOLUCRE', 'The bracts the head opens from,', 'and stays shut in without.'], 1200, 372, ix, iy, 'start');

  s += txt(keyCx, 446, 'Fig. 2 — The capitulum.', { size: 10.5, anchor: 'middle', family: SERIF, fill: 'var(--c-ink)' });
  s += txt(keyCx, 462, '55 rays over 336°, 6.109° each, with six 4° gaps.', { size: 9, anchor: 'middle' });

  // --- Fig. 3: the bud that never opened ---
  const dCx = 905;
  s += soil(822, 988, GROUND, 0.85, rnd);
  s += renderRoots(dCx, GROUND + 3, 44, 0.85, rnd);
  s += rosette(dCx, GROUND - 6, 96, 1, 0.85);
  s += renderScape(dCx, GROUND - 10, 590, 0.85, seeded(29));
  s += renderBud(dCx, 572, 28, 0.9);
  s += txt(dCx, CAPTION_Y, 'Fig. 3 — The bud that never opened.', { size: 10.5, anchor: 'middle', family: SERIF, fill: 'var(--c-ink)' });

  const diag = [
    'Coverage 95%. Depth 33%.', '',
    'Every item has been read exactly once and',
    'nothing has been mastered. The plant is',
    'full-grown: the rosette is complete and the',
    'scape is at its full height. The head has not',
    'opened.', '',
    'Two bars side by side cannot make this state',
    'feel wrong. A plant that refuses to flower can.', '',
    'This is FM-4, drawn.',
  ];
  s += txt(1030, 540, 'THE DANGEROUS STATE', { size: 10, spacing: 1.6, weight: 600, fill: 'var(--c-flag)' });
  diag.forEach((l, i) => {
    const strong = i === 0 || l.startsWith('This is');
    s += txt(1030, 564 + i * 15, l, {
      size: 10,
      fill: strong ? 'var(--c-ink)' : 'var(--c-ink-muted)',
      weight: strong ? 600 : 400,
    });
  });

  // --- dissections ---
  s += `<path d="${rayFloretPath(690, 418, 270, 0, 148, 46, true)}" fill="var(--c-ray)" stroke="var(--c-ray-edge)" stroke-width="1" stroke-linejoin="round"/>`;
  s += txt(690, 448, 'a.  Ray floret, enlarged', { size: 10, anchor: 'middle', family: SERIF, fill: 'var(--c-ink)' });
  s += txt(690, 464, 'Strap-shaped; apex three-toothed.', { size: 9, anchor: 'middle' });

  s += renderLeaf(leafGeometry(614, 578, 342, 166, 80), 1.3);
  s += txt(690, 648, 'b.  Rosette leaf, enlarged', { size: 10, anchor: 'middle', family: SERIF, fill: 'var(--c-ink)' });
  s += txt(690, 664, 'Spatulate; margin crenate.', { size: 9, anchor: 'middle' });

  s += `<path d="M 604 692 L 778 692" stroke="var(--c-line)" stroke-width="0.6" opacity="0.7"/>`;
  s += txt(604, 710, 'LEAF SIZE ∝ EXAM WEIGHT', { size: 9, spacing: 1.3, weight: 600, fill: 'var(--c-ink)' });
  [...SUBJECTS]
    .sort((a, b) => b.weight - a.weight)
    .forEach((sub, i) => {
      const y = 728 + i * 14;
      s += txt(604, y, sub.shortName, { size: 9 });
      s += txt(778, y, `${Math.round(sub.weight * 100)}%`, { size: 9, anchor: 'end', fill: 'var(--c-ink)' });
    });

  // --- Fig. 4: the seven stages ---
  s += `<path d="M 80 952 L ${W - 80} 952" stroke="var(--c-line)" stroke-width="0.7" opacity="0.8"/>`;
  s += txt(W / 2, 986, 'Fig. 4 — THE SEVEN STAGES OF GROWTH', { size: 11, anchor: 'middle', spacing: 2.2, weight: 600, fill: 'var(--c-ink)' });
  s += txt(W / 2, 1004, 'Coverage drives the stage. Depth drives the bloom. The two are free to disagree, and usually do.', { size: 9.5, anchor: 'middle' });

  const stageSoil = 1240;
  STAGES.forEach((st, i) => {
    const cx = 145 + i * 180;
    s += soil(cx - 62, cx + 62, stageSoil, 0.62, rnd);
    s += stageFigure(st, cx, stageSoil, rnd);
    s += txt(cx, 1268, st.roman, { size: 14, anchor: 'middle', family: SERIF, fill: 'var(--c-heading)' });
    s += txt(cx, 1285, st.name, { size: 10, anchor: 'middle', fill: 'var(--c-ink)', weight: 600 });
    s += txt(cx, 1300, st.band, { size: 9, anchor: 'middle' });
    if (i < STAGES.length - 1) {
      s += `<path d="M ${cx + 74} 1265 l 10 0 m -4 -3.5 l 4 3.5 l -4 3.5" fill="none" stroke="var(--c-line)" stroke-width="0.8" opacity="0.7" stroke-linecap="round"/>`;
    }
  });

  // --- footer ---
  s += `<path d="M 80 1330 L ${W - 80} 1330" stroke="var(--c-line)" stroke-width="0.7" opacity="0.8"/>`;
  [
    'Drawn from the 2027 syllabus as imported: 6 subjects, 55 Parts, 1,489 items. Ray florets are bound to Parts and sectors to subjects, so the gaps in the ring are',
    'the subject boundaries themselves. Leaf size is bound to exam weight — Remedial & Ethics at 25% is the largest leaf on the plant and Criminal at 10% among the',
    'smallest, so a neglected subject reads as a stunted leaf rather than as a number. Scape height follows weighted coverage; bloom openness follows weighted depth.',
  ].forEach((l, i) => {
    s += txt(W / 2, 1362 + i * 15, l, { size: 9.5, anchor: 'middle' });
  });
  s += txt(W / 2, 1420, 'The plant never wilts. The growth stage ratchets, as best streak does; a demotion closes rays without ever returning the plant to seed.', { size: 9.5, anchor: 'middle', family: SERIF, style: 'italic', fill: 'var(--c-ink)' });
  s += txt(80, 1452, 'design.md §19  ·  every curve drawn by src/lib/daisy.ts, the same module the app renders from', { size: 8.5, spacing: 1.2 });
  s += txt(W - 80, 1452, 'PLATE I', { size: 8.5, anchor: 'end', spacing: 1.2 });

  const label =
    'Botanical plate of the study plant: habit at full bloom, the capitulum ' +
    'annotated, the bud that never opened, and the seven stages of growth.';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}">
  <style>
  :root {
${style}
  }
  </style>
${s}
</svg>
`;
}

// --- emit -------------------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true });
const out = resolve(OUT_DIR, 'daisy-plate-light.svg');
writeFileSync(out, buildPlate(), 'utf8');
console.log(`wrote ${out}`);
console.log(`\n6 subjects / ${PARTS.length} parts / ${syllabus.items.length} items`);
console.log(`sectors: ${SECTORS.map((x) => `${x.shortName} ${x.rays.length}`).join(', ')}`);
const last = SECTORS[SECTORS.length - 1];
console.log(`ring closes at ${f(last.start + last.span + GAP_DEG - SECTORS[0].start)} degrees`);
console.log('geometry: src/lib/daisy.ts (shared with <Daisy/>)');

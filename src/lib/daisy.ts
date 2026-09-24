// The daisy: overall progress as a life cycle (design.md 19).
//
// Pure geometry and pure arithmetic. No React, no DOM, no storage — so every
// claim design.md 19 makes about this plant can be tested directly, and so
// scripts/daisy-plate.mjs and the live component draw from ONE source rather
// than from two copies that quietly drift apart.
//
// The two axes are deliberately independent (19.1):
//   coverage -> how far the plant has GROWN (stage, scape, leaves)
//   depth    -> how far the bloom has OPENED
// A plant can therefore be full-grown and shut, which is the state two bars
// side by side cannot make anyone feel (FM-4).

import type { Item, Part, ProgressMap, Subject } from './progress.ts';
import { masteryOf, partFill } from './progress.ts';
import type { StudyEvent } from './events.ts';

// --- growth stages (19.3) ---------------------------------------------------

export interface Stage {
  n: number;
  roman: string;
  name: string;
  /** Lowest coverage that reaches this stage. */
  min: number;
  band: string;
}

export const STAGES: readonly Stage[] = [
  { n: 1, roman: 'I', name: 'Seed', min: 0, band: '0%' },
  { n: 2, roman: 'II', name: 'Germination', min: 0, band: 'up to 10%' },
  { n: 3, roman: 'III', name: 'Seedling', min: 0.1, band: '10 – 25%' },
  { n: 4, roman: 'IV', name: 'Vegetative', min: 0.25, band: '25 – 45%' },
  { n: 5, roman: 'V', name: 'Bud', min: 0.45, band: '45 – 65%' },
  { n: 6, roman: 'VI', name: 'First rays', min: 0.65, band: '65 – 85%' },
  { n: 7, roman: 'VII', name: 'Full bloom', min: 0.85, band: '85 – 100%' },
];

/** Stage 1 is reserved for *nothing at all*; any progress whatsoever germinates. */
export function stageFor(coverage: number): Stage {
  if (!(coverage > 0)) return STAGES[0];
  for (let i = STAGES.length - 1; i >= 1; i--) {
    if (coverage >= STAGES[i].min) return STAGES[i];
  }
  return STAGES[1];
}

// --- the ratchet (19.4) -----------------------------------------------------
//
// "The flower never wilts." The highest stage reached is retained, exactly as
// best streak is. A demotion after a bad mock exam moves the numbers and may
// close rays, but it never returns the plant to seed.
//
// This is DERIVED by replaying the event log, not stored as a running total, so
// it obeys AC-39 and stays re-derivable after a bug fix like the achievements
// (AC-41). Replay is incremental — recomputing full coverage per event would be
// O(events x items) and this is on the dashboard's render path.

export function peakWeightedCoverage(
  log: readonly StudyEvent[],
  subjects: Subject[],
  itemsBySubject: Map<string, Item[]>,
  currentCoverage: number
): number {
  const subjectOfItem = new Map<string, string>();
  const totals = new Map<string, number>();
  const covered = new Map<string, number>();

  for (const s of subjects) {
    const items = itemsBySubject.get(s.id) ?? [];
    totals.set(s.id, items.length);
    covered.set(s.id, 0);
    for (const i of items) subjectOfItem.set(i.id, s.id);
  }

  const weightedNow = () => {
    let total = 0;
    for (const s of subjects) {
      const n = totals.get(s.id) ?? 0;
      if (n > 0) total += s.weight * ((covered.get(s.id) ?? 0) / n);
    }
    return total;
  };

  // Seeded with the CURRENT figure: taps made before the event log existed left
  // no events behind, so a pure replay would under-report the peak and the plant
  // would appear to shrink. The ratchet must never do that.
  let peak = currentCoverage;

  const ordered = [...log]
    .filter((e) => e.type === 'mastery_changed')
    .sort((a, b) => a.occurredAt - b.occurredAt);

  for (const e of ordered) {
    if (!e.itemId) continue;
    const sid = subjectOfItem.get(e.itemId);
    if (!sid) continue;
    const wasCovered = (e.from ?? 0) >= 1;
    const isCovered = (e.to ?? 0) >= 1;
    if (wasCovered === isCovered) continue;
    covered.set(sid, (covered.get(sid) ?? 0) + (isCovered ? 1 : -1));
    const c = weightedNow();
    if (c > peak) peak = c;
  }

  return peak;
}

/** The stage actually drawn: current growth, ratcheted by the high-water mark. */
export function ratchetedStage(currentCoverage: number, peakCoverage: number): Stage {
  return stageFor(Math.max(currentCoverage, peakCoverage));
}

// --- accessible description (19.8) ------------------------------------------
//
// The bloom duplicates information and is never its sole carrier, but it still
// needs one live text equivalent.

export function describeDaisy(stage: Stage, coverage: number, depth: number): string {
  const p = (n: number) => `${Math.round(n * 100)}%`;
  // The 0.35 floor is not arbitrary. An item read once and no more sits at
  // mastery 1 of 3, so a syllabus read cover to cover and never revised lands at
  // depth 0.333 — THE dangerous state (FM-4). It has to describe itself as a
  // bloom that has not opened, because that is exactly what the drawing shows
  // and what the whole daisy exists to say.
  const bloom =
    depth >= 0.85
      ? 'The bloom is fully open.'
      : depth >= 0.6
        ? 'The bloom is open.'
        : depth >= 0.35
          ? 'The bloom is opening.'
          : 'The bloom has not opened.';
  return `Stage ${stage.roman} of VII, ${stage.name.toLowerCase()}. Coverage ${p(
    coverage
  )}. Depth ${p(depth)}. ${bloom}`;
}

// --- sector arithmetic (19.2) -----------------------------------------------
//
// 55 rays over 336 degrees at 6.109 each, with six 4-degree gaps, closing at
// exactly 360. The gaps ARE the subject boundaries — that is the entire reason
// for a ring of 55 rather than 55 evenly spaced petals.

export const RAY_DEG = 6.109;
export const GAP_DEG = 4;

export interface Ray {
  partId: string;
  subjectId: string;
  angle: number;
}

export interface Sector {
  subjectId: string;
  shortName: string;
  start: number;
  span: number;
  rays: Ray[];
}

export function sectorsOf(subjects: Subject[], parts: Part[], startDeg = -90): Sector[] {
  const bySubject = new Map<string, Part[]>();
  for (const p of parts) {
    if (!bySubject.has(p.subjectId)) bySubject.set(p.subjectId, []);
    bySubject.get(p.subjectId)!.push(p);
  }

  let a = startDeg;
  const out: Sector[] = [];
  for (const s of [...subjects].sort((x, y) => x.seq - y.seq)) {
    const list = (bySubject.get(s.id) ?? []).sort((x, y) => x.seq - y.seq);
    const span = list.length * RAY_DEG;
    out.push({
      subjectId: s.id,
      shortName: s.shortName,
      start: a,
      span,
      rays: list.map((p, i) => ({
        partId: p.id,
        subjectId: s.id,
        angle: a + (i + 0.5) * RAY_DEG,
      })),
    });
    a += span + GAP_DEG;
  }
  return out;
}

/** Per-ray extension, 0..1, keyed by Part. A Part at 0 grows NO ray. */
export function rayFills(parts: Part[], progress: ProgressMap): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of parts) out.set(p.id, partFill(p, progress));
  return out;
}

/**
 * Synthetic per-Part fills for a coverage/depth pair that has not actually
 * happened — the stage preview, and the plate's illustrated states.
 *
 * Parts fill in order within a subject, because that is what the unlock engine
 * enforces, so the ring extends raggedly rather than all 55 rays moving in
 * lockstep. Never used for real progress: that comes from rayFills().
 */
export function plausibleFills(
  sectors: Sector[],
  coverage: number,
  depth: number,
  rnd: () => number
): Map<string, number> {
  const out = new Map<string, number>();
  // Unevenness has to narrow as coverage approaches 1, or a ring claiming 96%
  // draws itself looking two-thirds grown.
  const spread = 0.55 * (1 - coverage);
  const q = coverage > 0 ? clamp01(depth / coverage) : 0;
  for (const s of sectors) {
    const bias = 1 + (rnd() - 0.5) * 2 * spread;
    const reached = clamp01(coverage * bias) * s.rays.length;
    s.rays.forEach((ray, i) => {
      out.set(ray.partId, clamp01(reached - i) * (0.34 + 0.66 * q));
    });
  }
  return out;
}

/** Leaf scale from exam weight. Area-proportional would only span 1.6x across
 *  the six; ^0.7 keeps it honest while making 25% against 10% unmistakable. */
export function leafScale(weight: number): number {
  return Math.pow(weight / 0.25, 0.7);
}

/** Per-subject coverage, for the leaf that represents it. A neglected subject
 *  should read as a stunted leaf rather than as a number. */
export function subjectGrowth(items: Item[], progress: ProgressMap): number {
  if (items.length === 0) return 0;
  let n = 0;
  for (const i of items) if (masteryOf(progress, i.id) >= 1) n++;
  return n / items.length;
}

// --- primitives -------------------------------------------------------------

const RAD = Math.PI / 180;
const f = (n: number) => Number(n.toFixed(2));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Deterministic PRNG. The plant's asymmetry must be the SAME asymmetry on
 *  every render, or it twitches each time React re-runs. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pt = [number, number];

/** Catmull-Rom through points -> cubic beziers. Organic outlines without
 *  hand-placing control points. */
export function crPath(pts: Pt[], closed = false): string {
  if (pts.length < 2) return '';
  const p: Pt[] = closed
    ? [pts[pts.length - 1], ...pts, pts[0], pts[1]]
    : [pts[0], ...pts, pts[pts.length - 1]];
  let d = `M ${f(p[1][0])} ${f(p[1][1])}`;
  for (let i = 1; i < p.length - 2; i++) {
    const p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2];
    const b1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const b2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${f(b1[0])} ${f(b1[1])}, ${f(b2[0])} ${f(b2[1])}, ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + (closed ? ' Z' : '');
}

function sampleTable(table: readonly (readonly [number, number])[], t: number): number {
  if (t <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (t <= table[i][0]) {
      const [t0, v0] = table[i - 1];
      const [t1, v1] = table[i];
      return lerp(v0, v1, (t - t0) / (t1 - t0));
    }
  }
  return table[table.length - 1][1];
}

// --- the ray floret ---------------------------------------------------------
//
// Strap-shaped, not wedge-shaped: absolute width, narrow at the base, widest
// around 62% of the length, optionally three-toothed at the apex. A wedge would
// read as a pie chart, which is the register 19.5 rules out.

const RAY_WIDTH = [
  [0.0, 0.5], [0.1, 0.6], [0.22, 0.72], [0.35, 0.86],
  [0.5, 0.97], [0.62, 1.0], [0.75, 0.99], [0.86, 0.94],
  [0.94, 0.87], [1.0, 0.78],
] as const;

export function rayFloretPath(
  cx: number, cy: number, angDeg: number,
  r0: number, r1: number, maxW: number, teeth: boolean
): string {
  const a = angDeg * RAD;
  const ux = Math.cos(a), uy = Math.sin(a);
  const vx = -uy, vy = ux;
  const L = r1 - r0;
  if (L <= 0.5) return '';

  const N = 18;
  const left: Pt[] = [], right: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const rad = r0 + t * L;
    const h = (maxW * sampleTable(RAY_WIDTH, t)) / 2;
    const px = cx + ux * rad, py = cy + uy * rad;
    left.push([px - vx * h, py - vy * h]);
    right.push([px + vx * h, py + vy * h]);
  }

  const ht = (maxW * 0.78) / 2;
  const cap = (
    teeth
      ? [[-1, 0], [-0.66, 0.34], [-0.33, -0.05], [0, 0.38], [0.33, -0.05], [0.66, 0.34], [1, 0]]
      : [[-1, 0], [-0.5, 0.11], [0, 0.15], [0.5, 0.11], [1, 0]]
  ).map(([s, extra]): Pt => {
    const rad = r1 + extra * ht;
    return [cx + ux * rad + vx * s * ht, cy + uy * rad + vy * s * ht];
  });

  return crPath([...left, ...cap.slice(1, -1), ...right.reverse()], true);
}

/** Absolute ray width at a given outer radius, so rays stay straps rather than
 *  fanning into wedges as the head grows. */
export function rayWidthAt(r1: number): number {
  return 2 * Math.PI * r1 * (RAY_DEG / 360) * 0.86;
}

// --- the disc ---------------------------------------------------------------
//
// Golden-angle phyllotaxis, which is how a real composite packs its disc
// florets, and which also gives the engraver's stipple 19.5 asks for with no
// randomness at all. Outer florets are larger because on a real daisy the outer
// ring opens first.

export interface Floret {
  x: number;
  y: number;
  r: number;
  outer: boolean;
}

export function discFlorets(cx: number, cy: number, R: number, rnd: () => number): Floret[] {
  const N = Math.max(12, Math.round(R * R * 0.085));
  const GA = Math.PI * (3 - Math.sqrt(5));
  const out: Floret[] = [];
  for (let i = 0; i < N; i++) {
    const k = Math.sqrt((i + 0.5) / N);
    const rr = R * k;
    const th = i * GA;
    out.push({
      x: cx + rr * Math.cos(th),
      y: cy + rr * Math.sin(th),
      r: 0.052 * R * (0.55 + 0.6 * k) * (0.85 + 0.3 * rnd()),
      outer: k > 0.84,
    });
  }
  return out;
}

// --- the leaf ---------------------------------------------------------------
//
// Spatulate with a crenate margin, which is what Bellis perennis actually has.

const LEAF_WIDTH = [
  [0.0, 0.022], [0.1, 0.024], [0.22, 0.028], [0.32, 0.042],
  [0.42, 0.078], [0.55, 0.116], [0.68, 0.146], [0.8, 0.149],
  [0.9, 0.124], [0.96, 0.082], [1.0, 0.0],
] as const;

export interface LeafGeometry {
  blade: string;
  midrib: string;
  veins: string[];
}

export function leafGeometry(
  x: number, y: number, angDeg: number, L: number, samples = 44
): LeafGeometry {
  const a = angDeg * RAD;
  const ca = Math.cos(a), sa = Math.sin(a);
  const to = (lx: number, ly: number): Pt => [x + lx * ca - ly * sa, y + lx * sa + ly * ca];

  const left: Pt[] = [], right: Pt[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const droop = 0.17 * L * t * t;
    let h = sampleTable(LEAF_WIDTH, t) * L;
    // Crenation: shallow scallops, blade only. Six cycles reads as "toothed"
    // without turning into a saw.
    if (t > 0.38 && t < 0.985) {
      h += 0.014 * L * Math.sin((2 * Math.PI * 6 * (t - 0.38)) / 0.6);
    }
    left.push(to(t * L, droop - h));
    right.push(to(t * L, droop + h));
  }

  const mid: Pt[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    mid.push(to(t * L * 0.97, 0.17 * L * t * t));
  }

  const veins: string[] = [];
  for (const t of [0.46, 0.6, 0.74]) {
    const baseY = 0.17 * L * t * t;
    const hw = sampleTable(LEAF_WIDTH, t) * L;
    for (const side of [-1, 1]) {
      const p0 = to(t * L, baseY);
      const p1 = to(t * L + 0.06 * L, baseY + side * hw * 0.55);
      const p2 = to(t * L + 0.09 * L, baseY + side * hw * 0.88);
      veins.push(
        `M ${f(p0[0])} ${f(p0[1])} Q ${f(p1[0])} ${f(p1[1])}, ${f(p2[0])} ${f(p2[1])}`
      );
    }
  }

  return { blade: crPath([...left, ...right.reverse()], true), midrib: crPath(mid), veins };
}

/** Rosette angles, chosen for the deliberate asymmetry 19.5 calls for. */
export const ROSETTE_ANGLES: Record<string, number> = {
  political: 158,
  'commercial-tax': 16,
  civil: 344,
  labor: 128,
  criminal: 52,
  'remedial-ethics': 196,
};

// --- involucre, bud, scape --------------------------------------------------

export function involucreBracts(
  cx: number, cy: number, r: number, spread: number, n = 14
): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const rad = ((i / n) * 360 + 11) * RAD;
    const ux = Math.cos(rad), uy = Math.sin(rad);
    const vx = -uy, vy = ux;
    const tip = r * spread;
    const w = r * 0.19;
    out.push(
      `M ${f(cx + ux * r * 0.18)} ${f(cy + uy * r * 0.18)} ` +
        `C ${f(cx + ux * r * 0.55 + vx * w)} ${f(cy + uy * r * 0.55 + vy * w)}, ` +
        `${f(cx + ux * tip * 0.8 + vx * w * 0.7)} ${f(cy + uy * tip * 0.8 + vy * w * 0.7)}, ` +
        `${f(cx + ux * tip)} ${f(cy + uy * tip)} ` +
        `C ${f(cx + ux * tip * 0.8 - vx * w * 0.7)} ${f(cy + uy * tip * 0.8 - vy * w * 0.7)}, ` +
        `${f(cx + ux * r * 0.55 - vx * w)} ${f(cy + uy * r * 0.55 - vy * w)}, ` +
        `${f(cx + ux * r * 0.18)} ${f(cy + uy * r * 0.18)} Z`
    );
  }
  return out;
}

export interface BudGeometry {
  body: string;
  scales: string[];
  bracts: string[];
}

export function budGeometry(cx: number, cy: number, r: number): BudGeometry {
  const body =
    `M ${f(cx)} ${f(cy - r * 1.05)} ` +
    `C ${f(cx + r * 0.92)} ${f(cy - r * 0.9)}, ${f(cx + r * 1.02)} ${f(cy + r * 0.5)}, ${f(cx)} ${f(cy + r * 0.82)} ` +
    `C ${f(cx - r * 1.02)} ${f(cy + r * 0.5)}, ${f(cx - r * 0.92)} ${f(cy - r * 0.9)}, ${f(cx)} ${f(cy - r * 1.05)} Z`;

  const scales = [-0.62, -0.24, 0.16, 0.54].map((k) => {
    const x0 = cx + k * r;
    return `M ${f(x0)} ${f(cy + r * 0.72)} C ${f(x0 + r * 0.16)} ${f(cy + r * 0.05)}, ${f(
      x0 + r * 0.2
    )} ${f(cy - r * 0.55)}, ${f(cx + k * r * 0.42)} ${f(cy - r)}`;
  });

  // Filled scales clasping the base, NOT radiating hairlines: six strokes off an
  // ovoid read as an insect, which is the one register this must never have.
  const bracts = [30, 58, 86, 94, 122, 150].map((a) => {
    const rad = a * RAD;
    const ux = Math.cos(rad), uy = Math.sin(rad);
    const vx = -uy, vy = ux;
    const base = r * 0.3, tip = r * 1.02, w = r * 0.16;
    return (
      `M ${f(cx + ux * base)} ${f(cy + uy * base)} ` +
      `C ${f(cx + ux * base * 1.7 + vx * w)} ${f(cy + uy * base * 1.7 + vy * w)}, ` +
      `${f(cx + ux * tip * 0.82 + vx * w * 0.6)} ${f(cy + uy * tip * 0.82 + vy * w * 0.6)}, ` +
      `${f(cx + ux * tip)} ${f(cy + uy * tip)} ` +
      `C ${f(cx + ux * tip * 0.82 - vx * w * 0.6)} ${f(cy + uy * tip * 0.82 - vy * w * 0.6)}, ` +
      `${f(cx + ux * base * 1.7 - vx * w)} ${f(cy + uy * base * 1.7 - vy * w)}, ` +
      `${f(cx + ux * base)} ${f(cy + uy * base)} Z`
    );
  });

  return { body, scales, bracts };
}

export function scapePath(x: number, yBase: number, yTop: number, bend: number): string {
  const h = yBase - yTop;
  if (h <= 2) return '';
  return (
    `M ${f(x)} ${f(yBase)} C ${f(x + bend)} ${f(yBase - h * 0.42)}, ` +
    `${f(x + bend * 1.3)} ${f(yBase - h * 0.72)}, ${f(x)} ${f(yTop)}`
  );
}

export function rootPaths(x: number, y: number, len: number, rnd: () => number): string[] {
  return [74, 90, 106, 62, 118].map((a) => {
    const rad = a * RAD;
    const L = len * (0.55 + rnd() * 0.55);
    const pts: Pt[] = [[x, y]];
    for (let i = 1; i <= 4; i++) {
      const t = i / 4;
      pts.push([x + Math.cos(rad) * L * t + (rnd() - 0.5) * 7, y + Math.sin(rad) * L * t]);
    }
    return crPath(pts);
  });
}

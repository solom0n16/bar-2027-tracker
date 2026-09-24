import { useMemo } from 'react';
import { RAY_DEG, sectorsOf } from './lib/daisy';
import { coverage, depth, masteryOf, partFill } from './lib/progress';
import type { Item, LockState, Part, ProgressMap, Subject } from './lib/progress';

/**
 * The constellation: the plant at the centre, the six subjects in orbit.
 *
 * ONE CONTINUOUS TRACK. The earlier version hung each Part off its own spoke,
 * which drew 14 disconnected sticks and read as a diagram of nothing. Here the
 * Parts sit ON a single tilted ellipse and the ellipse itself is the connection
 * between them — dashed where the path has not been walked, solid and deepening
 * toward wine where it has. That is the ribbon's walked path, in the round.
 *
 * The ellipse is divided into the same six sector arcs as the bloom, sized by
 * Part count, so each subject owns an arc and its Parts can never collide with
 * another subject's. Cards float outside the track at their arc's midpoint.
 */

const VB_W = 1800;
const VB_H = 1100;
const CX = VB_W / 2;
const CY = VB_H / 2;

const RX = 520;
const RY = 330;
/** A tilt is most of the difference between "orbit" and "pie chart". */
const TILT = -10;

// Sized for the longest name, "Remedial & Ethics", with room to spare — a title
// that touches its own card edge is the difference between designed and nearly.
const CARD_W = 256;
const CARD_H = 98;
const PART_R = 18;
/** Clearance between the track and the nearest edge of a card. */
const CARD_GAP = 34;

interface Props {
  subjects: Subject[];
  parts: Part[];
  itemsBySubject: Map<string, Item[]>;
  lockStates: Map<string, LockState>;
  progress: ProgressMap;
  selectedSubjectId: string | null;
  selectedPartId: string | null;
  onSelectSubject: (id: string | null) => void;
  onSelectPart: (id: string | null) => void;
}

const RAD = Math.PI / 180;

/** A point on the tilted track, by parametric angle. */
function track(angDeg: number, scale = 1): [number, number] {
  const a = angDeg * RAD;
  const x = RX * scale * Math.cos(a);
  const y = RY * scale * Math.sin(a);
  const t = TILT * RAD;
  return [CX + x * Math.cos(t) - y * Math.sin(t), CY + x * Math.sin(t) + y * Math.cos(t)];
}

/** An arc of the track between two parametric angles, as a path. */
function trackArc(a1: number, a2: number, scale = 1): string {
  const [x1, y1] = track(a1, scale);
  const [x2, y2] = track(a2, scale);
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
  const sweep = a2 > a1 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${(RX * scale).toFixed(2)} ${(
    RY * scale
  ).toFixed(2)} ${TILT} ${large} ${sweep} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export default function Constellation({
  subjects,
  parts,
  itemsBySubject,
  lockStates,
  progress,
  selectedSubjectId,
  selectedPartId,
  onSelectSubject,
  onSelectPart,
}: Props) {
  const sectors = useMemo(() => sectorsOf(subjects, parts), [subjects, parts]);
  const partById = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);
  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="block h-auto w-full overflow-visible"
      role="group"
      aria-label="Subjects in orbit around the study plant"
    >
      <defs>
        <radialGradient id="hub-glow">
          <stop offset="0%" stopColor="var(--c-raised)" stopOpacity="0.95" />
          <stop offset="62%" stopColor="var(--c-wash-sage)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--c-wash-sage)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="walked" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--c-rung-1)" />
          <stop offset="55%" stopColor="var(--c-rung-2)" />
          <stop offset="100%" stopColor="var(--c-rung-3)" />
        </linearGradient>
        <filter id="card-shadow" x="-30%" y="-30%" width="160%" height="180%">
          {/* flood-color as a CSS property, not a presentation attribute, so it
              can reference a token and stay inside AC-63. */}
          <feDropShadow
            dx="0"
            dy="10"
            stdDeviation="14"
            floodOpacity="0.22"
            style={{ floodColor: 'var(--c-inverse)' }}
          />
        </filter>
      </defs>

      {/* Two decorative shells, off-axis from the track, for depth. They carry
          no data and are deliberately faint. */}
      <ellipse
        cx={CX}
        cy={CY}
        rx={RX * 1.16}
        ry={RY * 0.72}
        fill="none"
        stroke="var(--c-line-soft)"
        strokeWidth="1.4"
        strokeDasharray="2 10"
        opacity="0.5"
        transform={`rotate(24 ${CX} ${CY})`}
      />
      <ellipse
        cx={CX}
        cy={CY}
        rx={RX * 0.82}
        ry={RY * 1.12}
        fill="none"
        stroke="var(--c-line-soft)"
        strokeWidth="1.4"
        strokeDasharray="2 10"
        opacity="0.42"
        transform={`rotate(-46 ${CX} ${CY})`}
      />

      {/* The hub. */}
      <circle cx={CX} cy={CY} r={300} fill="url(#hub-glow)" />

      {/* THE TRACK — one continuous ellipse, dashed. Everything below draws on
          top of it, so the connection between Parts is never in question. */}
      <ellipse
        cx={CX}
        cy={CY}
        rx={RX}
        ry={RY}
        fill="none"
        stroke="var(--c-line)"
        strokeWidth="1.6"
        strokeDasharray="3 9"
        opacity="0.75"
        transform={`rotate(${TILT} ${CX} ${CY})`}
      />

      {sectors.map((sector) => {
        const subject = subjectById.get(sector.subjectId);
        if (!subject) return null;

        const mid = sector.start + sector.span / 2;
        const items = itemsBySubject.get(subject.id) ?? [];
        const cov = coverage(items, progress);
        const dep = depth(items, progress);
        const isOpen = selectedSubjectId === subject.id;
        const dimmed = selectedSubjectId !== null && !isOpen;

        // How far along this subject's arc the path has actually been walked:
        // the contiguous run of fully covered Parts from Part 1. Same rule the
        // ribbon used, so "walked" keeps meaning the same thing.
        let walked = 0;
        for (const ray of sector.rays) {
          const p = partById.get(ray.partId);
          if (p && p.itemIds.every((id) => masteryOf(progress, id) >= 1)) walked++;
          else break;
        }

        const [anchorX, anchorY] = track(mid);
        // Push the card clear of the track along the outward normal, by enough
        // of its OWN half-extent in that direction. A flat scale factor left the
        // side cards sitting on the line and the top ones floating miles away.
        const dx = anchorX - CX;
        const dy = anchorY - CY;
        const len = Math.hypot(dx, dy) || 1;
        const off =
          CARD_GAP + (Math.abs(dx) / len) * (CARD_W / 2) + (Math.abs(dy) / len) * (CARD_H / 2);
        const cardX = anchorX + (dx / len) * off;
        const cardY = anchorY + (dy / len) * off;

        return (
          <g
            key={subject.id}
            className="transition-opacity duration-300 ease-out"
            opacity={dimmed ? 0.3 : 1}
          >
            {/* This subject's stretch of track, drawn solid so the arc reads as
                one branch rather than as six unrelated segments. */}
            <path
              d={trackArc(sector.start, sector.start + sector.span)}
              fill="none"
              stroke="var(--c-sunken)"
              strokeWidth={isOpen ? 7 : 4}
              strokeLinecap="round"
              className="transition-[stroke-width] duration-300 ease-out"
            />
            {walked > 0 && (
              <path
                d={trackArc(sector.start, sector.start + walked * RAY_DEG)}
                fill="none"
                stroke="url(#walked)"
                strokeWidth={isOpen ? 7 : 4}
                strokeLinecap="round"
                className="transition-[stroke-width] duration-300 ease-out"
              />
            )}

            {/* Leader from the card down to its own arc. */}
            <line
              x1={cardX}
              y1={cardY}
              x2={anchorX}
              y2={anchorY}
              stroke="var(--c-line)"
              strokeWidth="1.4"
              opacity="0.6"
            />

            {isOpen &&
              sector.rays.map((ray) => {
                const part = partById.get(ray.partId);
                if (!part) return null;
                return (
                  <PartNode
                    key={ray.partId}
                    part={part}
                    angle={ray.angle}
                    state={lockStates.get(part.id) ?? 'locked'}
                    fill={partFill(part, progress)}
                    selected={selectedPartId === part.id}
                    onSelect={() => onSelectPart(selectedPartId === part.id ? null : part.id)}
                  />
                );
              })}

            <SubjectCard
              subject={subject}
              x={cardX}
              y={cardY}
              coverage={cov}
              depth={dep}
              open={isOpen}
              onSelect={() => onSelectSubject(isOpen ? null : subject.id)}
            />
          </g>
        );
      })}
    </svg>
  );
}

// --- subject card -----------------------------------------------------------

function SubjectCard({
  subject,
  x,
  y,
  coverage: cov,
  depth: dep,
  open,
  onSelect,
}: {
  subject: Subject;
  x: number;
  y: number;
  coverage: number;
  depth: number;
  open: boolean;
  onSelect: () => void;
}) {
  const left = x - CARD_W / 2;
  const top = y - CARD_H / 2;

  return (
    <g
      role="button"
      tabIndex={0}
      aria-expanded={open}
      aria-label={`${subject.shortName}. ${Math.round(
        subject.weight * 100
      )} percent of grade. Coverage ${Math.round(cov * 100)} percent, depth ${Math.round(
        dep * 100
      )} percent. ${open ? 'Open' : 'Closed'}.`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      style={{ cursor: 'pointer' }}
      className="transition-transform duration-200 ease-out"
    >
      <rect
        x={left}
        y={top}
        width={CARD_W}
        height={CARD_H}
        rx="16"
        fill="var(--c-inverse)"
        stroke={open ? 'var(--c-on-inverse-accent)' : 'transparent'}
        strokeWidth="2.5"
        filter="url(#card-shadow)"
        className="transition-[stroke] duration-200 ease-out"
      />

      <text
        x={left + 20}
        y={top + 28}
        fontSize="13"
        letterSpacing="1.8"
        fontWeight="600"
        fill={open ? 'var(--c-on-inverse-accent)' : 'var(--c-on-inverse-muted)'}
        style={{ pointerEvents: 'none' }}
      >
        {Math.round(subject.weight * 100)}% OF GRADE
      </text>

      <text
        x={left + 20}
        y={top + 58}
        fontSize="23"
        fontFamily="var(--font-display)"
        fill="var(--c-on-inverse)"
        style={{ pointerEvents: 'none' }}
      >
        {subject.shortName}
      </text>

      <text
        x={left + 20}
        y={top + 80}
        fontSize="13"
        letterSpacing="0.8"
        fill="var(--c-on-inverse-muted)"
        style={{ pointerEvents: 'none' }}
      >
        {(cov * 100).toFixed(0)}% SEEN · {(dep * 100).toFixed(0)}% DEEP
      </text>

      {/* Coverage as a hairline along the card's bottom edge — the one piece of
          data that should read without being read. */}
      <rect
        x={left + 20}
        y={top + CARD_H - 11}
        width={CARD_W - 40}
        height="2.5"
        rx="1.25"
        fill="var(--c-on-inverse-muted)"
        opacity="0.28"
      />
      <rect
        x={left + 20}
        y={top + CARD_H - 11}
        width={(CARD_W - 40) * cov}
        height="2.5"
        rx="1.25"
        fill="var(--c-on-inverse-accent)"
        className="transition-[width] duration-300 ease-out"
      />
    </g>
  );
}

// --- part -------------------------------------------------------------------

function PartNode({
  part,
  angle,
  state,
  fill,
  selected,
  onSelect,
}: {
  part: Part;
  angle: number;
  state: LockState;
  fill: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const [x, y] = track(angle);
  const locked = state === 'locked';
  const rung = fill === 0 ? 0 : fill >= 0.999 ? 3 : fill >= 0.5 ? 2 : 1;

  // Numbers sit outside the track, unrotated. Rotating them to follow the
  // curve turns the ones near vertical on their side.
  const [lx, ly] = track(angle, 1.17);

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Part ${part.seq}: ${part.title}. ${
        locked ? 'Locked' : state === 'override' ? 'Opened early' : 'Open'
      }. ${Math.round(fill * 100)} percent mastered.`}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      style={{ cursor: 'pointer' }}
      // Locked Parts dim, as asked — but dimming is never the ONLY signal: the
      // dashed outline and the padlock carry it too (AC-27).
      opacity={locked ? 0.45 : 1}
      className="animate-pop transition-opacity duration-200 ease-out"
    >
      {selected && (
        <circle
          cx={x}
          cy={y}
          r={PART_R + 7}
          fill="none"
          stroke="var(--c-accent)"
          strokeWidth="2.5"
          strokeDasharray="4 3"
        />
      )}

      <circle
        cx={x}
        cy={y}
        r={PART_R}
        fill={locked ? 'var(--c-sunken)' : 'var(--c-raised)'}
        stroke={locked ? 'var(--c-line)' : 'var(--c-node)'}
        strokeWidth="2"
        strokeDasharray={locked ? '3.5 3' : undefined}
        className="transition-[fill] duration-200 ease-out"
      />

      {!locked && rung === 1 && (
        <path
          d={`M ${x} ${y - PART_R} A ${PART_R} ${PART_R} 0 0 1 ${x + PART_R} ${y} L ${x} ${y} Z`}
          fill="var(--c-rung-1)"
        />
      )}
      {!locked && rung === 2 && (
        <path
          d={`M ${x} ${y - PART_R} A ${PART_R} ${PART_R} 0 0 1 ${x} ${y + PART_R} Z`}
          fill="var(--c-rung-2)"
        />
      )}
      {!locked && rung === 3 && (
        <>
          <circle cx={x} cy={y} r={PART_R - 1.5} fill="var(--c-rung-3)" />
          <path
            d={`M ${x - 6} ${y} l 4.3 4.3 l 7.7 -8.6`}
            fill="none"
            stroke="var(--c-raised)"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </>
      )}

      {locked && (
        <g>
          <rect
            x={x - 5.5}
            y={y - 1.6}
            width="11"
            height="8.6"
            rx="1.8"
            fill="none"
            stroke="var(--c-ink-muted)"
            strokeWidth="1.9"
          />
          <path
            d={`M ${x - 2.9} ${y - 1.6} v -2.9 a 2.9 2.9 0 0 1 5.8 0 v 2.9`}
            fill="none"
            stroke="var(--c-ink-muted)"
            strokeWidth="1.7"
          />
        </g>
      )}

      {state === 'override' && (
        <circle cx={x + PART_R - 2} cy={y - PART_R + 2} r="3.4" fill="var(--c-flag)" />
      )}

      <text
        x={lx}
        y={ly}
        fontSize="16"
        fontWeight={selected ? 700 : 500}
        fill={selected ? 'var(--c-accent)' : 'var(--c-ink-muted)'}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ pointerEvents: 'none' }}
      >
        {part.seq}
      </text>
    </g>
  );
}

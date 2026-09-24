import type { LockState, Part, ProgressMap } from './lib/progress';
import { partFill } from './lib/progress';

interface Props {
  parts: Part[];
  lockStates: Map<string, LockState>;
  progress: ProgressMap;
  selectedPartId: string | null;
  onSelect: (partId: string) => void;
}

const NODE_R = 21;
const COL_W = 74;
const ROW_TOP = 34;
const ROW_BOT = 96;
const PAD_X = 34;

/**
 * The winding path. Nodes alternate between two rows so the eye follows a
 * route rather than a list, and the whole thing scrolls backwards through
 * completed Parts — that scroll-back is the payoff of a long climb.
 *
 * State is never conveyed by colour alone (WCAG 1.4.1): each node also carries
 * a distinct fill geometry plus a padlock or tick.
 */
export default function Ribbon({
  parts,
  lockStates,
  progress,
  selectedPartId,
  onSelect,
}: Props) {
  const sorted = [...parts].sort((a, b) => a.seq - b.seq);
  const width = PAD_X * 2 + COL_W * Math.max(1, sorted.length - 1);
  const height = 132;

  const pos = sorted.map((p, i) => ({
    part: p,
    x: PAD_X + i * COL_W,
    y: i % 2 === 0 ? ROW_TOP : ROW_BOT,
  }));

  // Smooth S-curves between consecutive nodes
  const pathFor = (from: number, to: number) => {
    let d = '';
    for (let i = from; i < to; i++) {
      const a = pos[i];
      const b = pos[i + 1];
      if (!a || !b) break;
      const mx = (a.x + b.x) / 2;
      if (i === from) d += `M ${a.x} ${a.y} `;
      d += `C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y} `;
    }
    return d;
  };

  // Walked distance = nodes fully covered
  let walkedTo = 0;
  for (let i = 0; i < pos.length; i++) {
    const covered = pos[i].part.itemIds.every((id) => (progress[id] ?? 0) >= 1);
    if (covered) walkedTo = i + 1;
    else break;
  }

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: Math.max(width, 320), height: 'auto', minWidth: '100%' }}
        role="img"
        aria-label={`Progress path: ${walkedTo} of ${sorted.length} parts covered`}
      >
        <defs>
          {/* The walked path deepens toward wine as it advances, the same
              direction the mastery ladder travels. */}
          <linearGradient id="ribbon-walked" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--c-rung-1)" />
            <stop offset="55%" stopColor="var(--c-rung-2)" />
            <stop offset="100%" stopColor="var(--c-rung-3)" />
          </linearGradient>
        </defs>

        <path
          d={pathFor(0, pos.length - 1)}
          fill="none"
          stroke="var(--c-sunken)"
          strokeWidth="9"
          strokeLinecap="round"
        />
        {walkedTo > 0 && (
          <path
            d={pathFor(0, Math.min(walkedTo, pos.length - 1))}
            fill="none"
            stroke="url(#ribbon-walked)"
            strokeWidth="9"
            strokeLinecap="round"
            className="transition-[stroke-dasharray] duration-300 ease-out"
          />
        )}

        {pos.map(({ part, x, y }) => {
          const state = lockStates.get(part.id) ?? 'locked';
          const fill = partFill(part, progress);
          const locked = state === 'locked';
          const isSelected = part.id === selectedPartId;
          const rung = fill === 0 ? 0 : fill >= 0.999 ? 3 : fill >= 0.5 ? 2 : 1;

          return (
            <g
              key={part.id}
              onClick={() => onSelect(part.id)}
              style={{ cursor: 'pointer' }}
              tabIndex={0}
              role="button"
              aria-label={`Part ${part.seq}: ${part.title}. ${
                locked ? 'Locked' : state === 'override' ? 'Opened early' : 'Open'
              }. ${Math.round(fill * 100)}% mastered.`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(part.id);
                }
              }}
            >
              {isSelected && (
                <circle
                  cx={x}
                  cy={y}
                  r={NODE_R + 5}
                  fill="none"
                  stroke="var(--c-accent)"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />
              )}

              {/* Base disc. design.md 5.6: a node reaching complete transitions
                  its fill over 200ms. */}
              <circle
                cx={x}
                cy={y}
                r={NODE_R}
                fill={locked ? 'var(--c-sunken)' : 'var(--c-raised)'}
                stroke={locked ? 'var(--c-line)' : 'var(--c-node)'}
                strokeWidth="2"
                strokeDasharray={locked ? '4 3' : undefined}
                className="transition-[fill,stroke] duration-200 ease-out"
              />

              {/* Fill geometry encodes the rung, so state is never colour-only */}
              {!locked && rung === 1 && (
                <path
                  d={`M ${x} ${y - NODE_R} A ${NODE_R} ${NODE_R} 0 0 1 ${x + NODE_R} ${y} L ${x} ${y} Z`}
                  fill="var(--c-rung-1)"
                />
              )}
              {!locked && rung === 2 && (
                <path
                  d={`M ${x} ${y - NODE_R} A ${NODE_R} ${NODE_R} 0 0 1 ${x} ${y + NODE_R} Z`}
                  fill="var(--c-rung-2)"
                />
              )}
              {!locked && rung === 3 && (
                <circle cx={x} cy={y} r={NODE_R - 1} fill="var(--c-rung-3)" />
              )}

              {/* Tick on a fully mastered node */}
              {!locked && rung === 3 && (
                <path
                  d={`M ${x - 7} ${y} l 5 5 l 9 -10`}
                  fill="none"
                  stroke="var(--c-raised)"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
              )}

              {/* Padlock on a locked node */}
              {locked && (
                <g>
                  <rect
                    x={x - 6}
                    y={y - 3}
                    width="12"
                    height="9"
                    rx="2"
                    fill="none"
                    stroke="var(--c-ink-muted)"
                    strokeWidth="1.8"
                  />
                  <path
                    d={`M ${x - 3} ${y - 3} v -3 a 3 3 0 0 1 6 0 v 3`}
                    fill="none"
                    stroke="var(--c-ink-muted)"
                    strokeWidth="1.6"
                  />
                </g>
              )}

              {/* Opened-early marker */}
              {state === 'override' && (
                <circle cx={x + NODE_R - 3} cy={y - NODE_R + 3} r="4" fill="var(--c-flag)" />
              )}

              <text
                x={x}
                y={y + NODE_R + 14}
                textAnchor="middle"
                fontSize="10"
                fontWeight={isSelected ? 700 : 400}
                fill={isSelected ? 'var(--c-accent)' : 'var(--c-ink-muted)'}
              >
                {part.seq}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

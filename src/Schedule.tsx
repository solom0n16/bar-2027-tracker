import { useState } from 'react';
import {
  GROUP_LABELS,
  addRow,
  defaultSchedule,
  moveRow,
  removeRow,
  updateRow,
  type Schedule,
  type ScheduleGroup,
  type ScheduleRow,
} from './lib/schedule';

/**
 * The study routine, editable in place.
 *
 * No edit mode. Every cell is already an input styled to look like text until
 * you hover or focus it, so changing a time is one click rather than
 * edit → change → save. Nothing here needs confirming: it saves as you type,
 * and the only destructive action (delete a row) is one row at a time.
 */

interface Props {
  schedule: Schedule;
  onChange: (next: Schedule) => void;
  /** Which group today falls in, so its card can say so. */
  today?: ScheduleGroup;
  /** The block under way right now, marked in the list. */
  nowRowId?: string | null;
}

export default function ScheduleTables({ schedule, onChange, today, nowRowId = null }: Props) {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 px-1">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">My routine</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Yours to rewrite. Saves as you type, on this device.
          </p>
        </div>

        {confirmReset ? (
          <span className="flex items-center gap-2 text-xs">
            <span className="text-ink">Replace everything with the starting routine?</span>
            <button
              onClick={() => {
                onChange(defaultSchedule());
                setConfirmReset(false);
              }}
              className="pressable rounded-full border border-error px-3 py-1 font-semibold text-error"
            >
              Yes, reset
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="pressable rounded-full border border-line px-3 py-1 text-ink"
            >
              Keep mine
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            className="text-xs text-ink-muted underline underline-offset-2 transition-colors hover:text-accent"
          >
            Reset to the starting routine
          </button>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {(Object.keys(GROUP_LABELS) as ScheduleGroup[]).map((group) => (
          <GroupTable
            key={group}
            group={group}
            isToday={group === today}
            nowRowId={nowRowId}
            rows={schedule[group]}
            onAdd={() => onChange(addRow(schedule, group))}
            onPatch={(id, patch) => onChange(updateRow(schedule, group, id, patch))}
            onRemove={(id) => onChange(removeRow(schedule, group, id))}
            onMove={(id, delta) => onChange(moveRow(schedule, group, id, delta))}
          />
        ))}
      </div>
    </section>
  );
}

function GroupTable({
  group,
  isToday,
  nowRowId,
  rows,
  onAdd,
  onPatch,
  onRemove,
  onMove,
}: {
  group: ScheduleGroup;
  isToday: boolean;
  nowRowId: string | null;
  rows: ScheduleRow[];
  onAdd: () => void;
  onPatch: (id: string, patch: Partial<Omit<ScheduleRow, 'id'>>) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, delta: number) => void;
}) {
  return (
    <div className="card flex flex-col overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-lg text-heading">{GROUP_LABELS[group]}</h3>
          {isToday && (
            <span className="rounded-full bg-wash-sage px-2 py-0.5 text-[11px] font-semibold text-accent">
              Today
            </span>
          )}
        </div>
        <span className="text-[11px] text-ink-muted">
          {rows.length} {rows.length === 1 ? 'block' : 'blocks'}
          {rows.some((r) => r.highlight) && ` · ${rows.filter((r) => r.highlight).length} study`}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="flex-1 px-4 py-8 text-center text-sm text-ink-muted">
          Nothing here yet. Add a block to start shaping the day.
        </p>
      ) : (
        <ul className="relative flex-1 py-2">
          {/* The timeline spine the row dots sit on. */}
          <span aria-hidden="true" className="absolute bottom-5 left-[1.25rem] top-5 w-px bg-line-soft" />
          {rows.map((r, i) => (
            <RowEditor
              key={r.id}
              row={r}
              isNow={r.id === nowRowId}
              first={i === 0}
              last={i === rows.length - 1}
              onPatch={(patch) => onPatch(r.id, patch)}
              onRemove={() => onRemove(r.id)}
              onMove={(delta) => onMove(r.id, delta)}
            />
          ))}
        </ul>
      )}

      <div className="border-t border-line-soft px-5 py-3">
        <button
          onClick={onAdd}
          className="pressable inline-flex items-center gap-1.5 text-xs font-medium text-accent"
        >
          <PlusIcon />
          Add a block
        </button>
      </div>
    </div>
  );
}

const CELL_BASE =
  'w-full rounded-md border border-transparent bg-transparent px-2 py-1 transition-colors placeholder:text-ink-muted/60 hover:border-line-soft hover:bg-wash-warm focus:border-accent focus:bg-raised';

/**
 * A cell that looks like text and behaves like a field.
 *
 * `multiline` cells are textareas rather than inputs, because a note like
 * "Focused codal work — one provision cluster per day" is longer than any
 * sensible column and an <input> silently clips it to whatever fits.
 */
function Cell({
  value,
  onChange,
  placeholder,
  label,
  multiline = false,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  multiline?: boolean;
  className?: string;
}) {
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        rows={1}
        className={`autogrow ${CELL_BASE} ${className}`}
      />
    );
  }
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      className={`${CELL_BASE} ${className}`}
    />
  );
}

function RowEditor({
  row,
  isNow,
  first,
  last,
  onPatch,
  onRemove,
  onMove,
}: {
  row: ScheduleRow;
  isNow: boolean;
  first: boolean;
  last: boolean;
  onPatch: (patch: Partial<Omit<ScheduleRow, 'id'>>) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
}) {
  return (
    <li
      aria-current={isNow ? 'time' : undefined}
      className={`group relative mx-2 grid grid-cols-[1.5rem_8rem_minmax(0,1fr)_auto] items-start gap-x-2 rounded-tile py-2 pr-2 transition-colors ${
        isNow ? 'bg-wash-sage' : 'hover:bg-wash-warm/60'
      }`}
    >
      {/* Timeline dot: ringed for now, solid gold for a study block, hollow
          otherwise. Shape carries the state as well as colour. */}
      <span aria-hidden="true" className="relative z-10 mt-2 grid place-items-center">
        <span
          className={`block rounded-full ${
            isNow
              ? 'size-3.5 border-[3px] border-accent-solid bg-raised'
              : row.highlight
                ? 'size-3 bg-highlight ring-2 ring-disc-edge/60'
                : 'size-2.5 border-2 border-line bg-raised'
          }`}
        />
      </span>

      <div className="flex flex-col gap-1">
        <Cell
          value={row.time}
          onChange={(time) => onPatch({ time })}
          placeholder="Time"
          label="Time"
          className="tnum text-xs font-medium text-ink-muted"
        />
        {isNow && (
          <span className="ml-2 w-fit rounded-full bg-accent-solid px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-accent">
            Now
          </span>
        )}
      </div>

      <div className="min-w-0">
        <Cell
          value={row.activity}
          onChange={(activity) => onPatch({ activity })}
          placeholder="Activity"
          label="Activity"
          multiline
          className={`text-sm font-semibold leading-snug ${row.highlight ? 'text-accent' : 'text-ink'}`}
        />
        <Cell
          value={row.notes}
          onChange={(notes) => onPatch({ notes })}
          placeholder="Add a note"
          label="Notes"
          multiline
          className="text-xs leading-relaxed text-ink-muted placeholder:text-transparent! group-hover:placeholder:text-ink-muted/60! focus:placeholder:text-ink-muted/60!"
        />
      </div>

      {/* Controls stay out of the way until the row is hovered or something in
          it has focus — 24 rows of buttons would drown the content. */}
      <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100">
        <IconButton
          label={row.highlight ? 'Remove emphasis' : 'Mark as study-critical'}
          onClick={() => onPatch({ highlight: !row.highlight })}
          active={row.highlight}
        >
          <StarIcon filled={row.highlight} />
        </IconButton>
        <IconButton label="Move up" onClick={() => onMove(-1)} disabled={first}>
          <ChevronIcon up />
        </IconButton>
        <IconButton label="Move down" onClick={() => onMove(1)} disabled={last}>
          <ChevronIcon />
        </IconButton>
        <IconButton label="Delete this block" onClick={onRemove} danger>
          <TrashIcon />
        </IconButton>
      </div>
    </li>
  );
}

function IconButton({
  label,
  onClick,
  children,
  disabled = false,
  danger = false,
  active = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active || undefined}
      title={label}
      className={`pressable grid size-7 place-items-center rounded-md disabled:opacity-30 ${
        danger
          ? 'text-ink-muted hover:bg-error hover:text-on-accent'
          : active
            ? 'text-highlight-ink hover:bg-sunken'
            : 'text-ink-muted hover:bg-sunken hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

// --- icons ------------------------------------------------------------------

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M12 4.5l2.3 4.9 5.2.7-3.8 3.6 1 5.3-4.7-2.6-4.7 2.6 1-5.3-3.8-3.6 5.2-.7z" />
    </svg>
  );
}

function ChevronIcon({ up = false }: { up?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M10 7V5h4v2M6 7l1 12h10l1-12" />
    </svg>
  );
}

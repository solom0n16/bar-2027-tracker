// Small presentational pieces shared by the dashboard and the subjects page.

import type { CSSProperties, ReactNode } from 'react';
import type { Item, Part, Subject } from './lib/progress';
import type { CalendarWeek } from './lib/dashboard';

export interface Syllabus {
  attribution: { author: string; organisation: string; url: string; note: string };
  exam: { days: string[]; coverageCutoff: string; officialSource: string };
  subjects: Subject[];
  parts: Part[];
  items: Item[];
  calendar: CalendarWeek[];
}

export interface Lookups {
  itemsBySubject: Map<string, Item[]>;
  itemsByPart: Map<string, Item[]>;
  subjectById: Map<string, Subject>;
  partById: Map<string, Part>;
  itemById: Map<string, Item>;
}

export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** Thousands separators. 1,489 is a number; 1489 is a string of digits. */
export const count = (n: number) => n.toLocaleString('en-GB');

export const step = (i: number) => ({ '--i': i }) as CSSProperties;

/**
 * The same opening on every page: kicker, title, one line of context, and an
 * optional block on the right that sits on the title's baseline.
 */
export function PageHeader({
  kicker,
  title,
  sub,
  aside,
}: {
  kicker?: string;
  title: string;
  sub?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4" style={step(0)}>
      <div className="min-w-0">
        {kicker && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{kicker}</p>}
        <h1 className="mt-0.5 font-display text-2xl leading-tight text-heading">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-ink-muted">{sub}</p>}
      </div>
      {aside}
    </header>
  );
}

/** Card title row: icon chip, title, optional kicker and action on the right. */
export function CardHeader({
  icon,
  title,
  kicker,
  action,
  id,
}: {
  icon?: ReactNode;
  title: string;
  kicker?: string;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && (
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-wash-sage text-accent [&>svg]:size-4.5">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 id={id} className="truncate font-display text-base leading-tight text-heading">
            {title}
          </h2>
          {kicker && <p className="mt-0.5 text-xs text-ink-muted">{kicker}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/** A text link styled as a quiet action with an arrow. */
export function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="pressable inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-accent hover:bg-wash-sage"
    >
      {children}
    </button>
  );
}

/** The per-panel bar. Labelled, because an unlabelled bar next to another
 *  unlabelled bar is the ambiguity AC-11 exists to prevent. */
export function PanelBar({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-11 shrink-0 text-[11px] uppercase tracking-wider text-ink-muted">
        {label}
      </span>
      <div
        className="meter-track h-2 flex-1"
        role="progressbar"
        aria-valuenow={Math.round(value * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="meter-fill"
          style={{ width: `${value * 100}%`, opacity: muted ? 0.55 : 1 }}
        />
      </div>
      <span className="tnum w-9 shrink-0 text-right text-[11px] font-medium text-ink">
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

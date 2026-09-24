import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Dashboard from './Dashboard';
import ScheduleTables from './Schedule';
import Shell, { type SearchProps } from './Shell';
import { useNow, useProgress, useRoute, useSchedule } from './hooks';
import {
  coverage,
  daysUntil,
  depth,
  masteryOf,
  partFill,
  partLockStates,
  searchItems,
  weighted,
  MASTERY_LABELS,
  type Item,
  type LockState,
  type Part,
  type ProgressMap,
  type SearchHit,
  type Subject,
} from './lib/progress';
import { daysStudiedWithin } from './lib/events';
import { peakWeightedCoverage, ratchetedStage } from './lib/daisy';
import { routineNow } from './lib/dashboard';
import {
  ArrowRightIcon,
  BackIcon,
  CloseIcon,
  FlagIcon,
  LockIcon,
  MinusIcon,
} from './Icons';
import { PageHeader, PanelBar, count, pct, step, type Lookups, type Syllabus } from './ui';

/**
 * TEMPORARY — stage preview.
 *
 * Coverage and depth pairs landing in each of the seven bands, so the plant can
 * be seen at every stage without tapping 1,489 items. Overrides ONLY what the
 * daisy is handed; never touches stored progress.
 *
 * Delete this, the `preview` state and <StagePreview/> once the plant has been
 * reviewed.
 */
const STAGE_PREVIEW: [number, number][] = [
  [0, 0],
  [0.06, 0.02],
  [0.18, 0.07],
  [0.35, 0.15],
  [0.55, 0.26],
  [0.75, 0.44],
  [0.96, 0.91],
];

export default function App() {
  const { progress, flags, overrides, events, advance, demote, toggleFlag, unlockPart, resetAll } =
    useProgress();
  const { schedule, setSchedule } = useSchedule();
  const { route, go } = useRoute();

  const [data, setData] = useState<Syllabus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [partId, setPartId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/data/syllabus.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: Syllabus) => alive && setData(json))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, []);

  const lookups = useMemo<Lookups | null>(() => {
    if (!data) return null;
    const itemsBySubject = new Map<string, Item[]>();
    const itemsByPart = new Map<string, Item[]>();
    const subjectById = new Map(data.subjects.map((s) => [s.id, s]));
    const partById = new Map(data.parts.map((p) => [p.id, p]));
    const itemById = new Map(data.items.map((i) => [i.id, i]));

    for (const i of data.items) {
      if (!itemsBySubject.has(i.subjectId)) itemsBySubject.set(i.subjectId, []);
      itemsBySubject.get(i.subjectId)!.push(i);
      if (!itemsByPart.has(i.partId)) itemsByPart.set(i.partId, []);
      itemsByPart.get(i.partId)!.push(i);
    }
    return { itemsBySubject, itemsByPart, subjectById, partById, itemById };
  }, [data]);

  const lockStates = useMemo(
    () => (data ? partLockStates(data.parts, progress, overrides) : new Map<string, LockState>()),
    [data, progress, overrides]
  );

  const hits = useMemo(() => {
    if (!data || !lookups || query.trim().length < 2) return [];
    return searchItems(query, data.items, lookups.subjectById, lookups.partById, 40);
  }, [query, data, lookups]);

  const search: SearchProps = {
    query,
    setQuery,
    hits,
    onPick: (h: SearchHit) => {
      setSubjectId(h.subject.id);
      setPartId(h.part.id);
      setQuery('');
      go('subjects');
    },
  };

  const shell = (children: ReactNode) => (
    <Shell route={route} go={go} search={search}>
      {children}
    </Shell>
  );

  if (error) {
    return shell(
      <div className="card animate-rise mx-auto max-w-xl border-error/60 p-6">
        <h1 className="font-display text-xl text-error">Could not load the syllabus</h1>
        <p className="mt-2 text-sm text-ink-muted">{error}</p>
        <p className="mt-3 text-sm text-ink-muted">
          Run <code className="rounded bg-sunken px-1.5 py-0.5 text-accent">npm run import</code>{' '}
          to regenerate the data file, then reload.
        </p>
      </div>
    );
  }

  if (!data || !lookups) {
    return shell(
      <div className="space-y-5" aria-busy="true" aria-live="polite">
        <div className="skeleton h-16 w-80 rounded-card" />
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="skeleton h-72 rounded-card lg:col-span-8" />
          <div className="skeleton h-72 rounded-card lg:col-span-4" />
        </div>
        <div className="skeleton h-80 rounded-card" />
        <p className="text-center text-sm text-ink-muted">Loading 1,489 items…</p>
      </div>
    );
  }

  const totalCoverage = weighted(data.subjects, lookups.itemsBySubject, progress, coverage);
  const totalDepth = weighted(data.subjects, lookups.itemsBySubject, progress, depth);
  const touched = Object.keys(progress).length;

  const activePart = partId ? lookups.partById.get(partId) ?? null : null;
  const activeItems = activePart ? lookups.itemsByPart.get(activePart.id) ?? [] : [];
  const activeLock = activePart ? lockStates.get(activePart.id) : undefined;

  const [previewCov, previewDep] = preview !== null ? STAGE_PREVIEW[preview] : [null, null];
  const shownCoverage = previewCov ?? totalCoverage;
  const shownDepth = previewDep ?? totalDepth;

  const stage = ratchetedStage(
    shownCoverage,
    preview === null
      ? peakWeightedCoverage(events, data.subjects, lookups.itemsBySubject, totalCoverage)
      : shownCoverage
  );

  let page: ReactNode;
  if (route === 'dashboard') {
    page = (
      <Dashboard
        data={data}
        lookups={lookups}
        progress={progress}
        flags={flags}
        events={events}
        lockStates={lockStates}
        schedule={schedule}
        coverage={shownCoverage}
        depth={shownDepth}
        stage={stage}
        touched={touched}
        onOpenPart={(id) => setPartId(id)}
        onOpenSubject={(id) => {
          setSubjectId(id);
          setPartId(null);
          go('subjects');
        }}
        onAdvance={advance}
        go={go}
        preview={preview}
        setPreview={setPreview}
      />
    );
  } else if (route === 'subjects') {
    page = (
      <SubjectsPage
        data={data}
        lookups={lookups}
        progress={progress}
        flags={flags}
        events={events}
        lockStates={lockStates}
        subjectId={subjectId}
        partId={partId}
        setSubjectId={setSubjectId}
        setPartId={setPartId}
        coverage={totalCoverage}
        depth={totalDepth}
        touched={touched}
      />
    );
  } else {
    page = <SchedulePage data={data} schedule={schedule} setSchedule={setSchedule} />;
  }

  return (
    <>
      {shell(
        <>
          <div key={route}>{page}</div>

          {/* --- footer ------------------------------------------------------- */}
          <footer className="mt-10 space-y-3 border-t border-line-soft px-1 pb-10 pt-6 text-center">
            <p className="text-xs text-ink-muted">
              Syllabus by {data.attribution.author} ·{' '}
              <a
                href={data.attribution.url}
                className="font-medium text-accent underline decoration-accent/40 underline-offset-2 transition-colors hover:decoration-accent"
                target="_blank"
                rel="noreferrer noopener"
              >
                {data.attribution.organisation}
              </a>
            </p>
            <p className="mx-auto max-w-md text-xs leading-relaxed text-ink-muted">
              {data.attribution.note}
            </p>
            {/* Crossway requires this notice wherever ESV text is quoted. */}
            <p className="mx-auto max-w-md text-[11px] leading-relaxed text-ink-muted">
              Scripture quotation is from the ESV® Bible (The Holy Bible, English Standard
              Version®), copyright © 2001 by Crossway, a publishing ministry of Good News
              Publishers. Used by permission. All rights reserved.
            </p>

            {confirmReset ? (
              <div className="card animate-pop mx-auto max-w-sm border-error/60 p-5">
                <p className="text-sm leading-relaxed text-ink">
                  Delete all progress, flags, and {events.length} logged events? History cannot be
                  rebuilt.
                </p>
                <div className="mt-4 flex justify-center gap-3">
                  <button
                    onClick={() => {
                      resetAll();
                      setConfirmReset(false);
                    }}
                    className="pressable rounded-full border border-error px-4 py-2 text-xs font-semibold text-error hover:bg-error hover:text-on-accent"
                  >
                    Yes, erase everything
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="pressable rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink hover:bg-sunken"
                  >
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmReset(true)}
                className="text-xs text-ink-muted underline underline-offset-2 transition-colors hover:text-accent"
              >
                Reset my progress
              </button>
            )}
          </footer>
        </>
      )}

      {/* The item list is a drawer, not a section, so any page can open a Part
          without losing its place. */}
      {activePart && (
        <ItemDrawer
          part={activePart}
          subject={lookups.subjectById.get(activePart.subjectId) ?? null}
          items={activeItems}
          lock={activeLock}
          progress={progress}
          flags={flags}
          onAdvance={advance}
          onDemote={demote}
          onFlag={toggleFlag}
          onUnlock={() => unlockPart(activePart.id)}
          onClose={() => setPartId(null)}
        />
      )}
    </>
  );
}

// --- pages ------------------------------------------------------------------

function SubjectsPage({
  data,
  lookups,
  progress,
  flags,
  events,
  lockStates,
  subjectId,
  partId,
  setSubjectId,
  setPartId,
  coverage: totalCoverage,
  depth: totalDepth,
  touched,
}: {
  data: Syllabus;
  lookups: Lookups;
  progress: ProgressMap;
  flags: Set<string>;
  events: ReturnType<typeof useProgress>['events'];
  lockStates: Map<string, LockState>;
  subjectId: string | null;
  partId: string | null;
  setSubjectId: (id: string | null) => void;
  setPartId: (id: string | null) => void;
  coverage: number;
  depth: number;
  touched: number;
}) {
  const subject = subjectId ? lookups.subjectById.get(subjectId) ?? null : null;
  const partsOpen = [...lockStates.values()].filter((s) => s !== 'locked').length;

  return (
    <div className="stagger space-y-6">
      <PageHeader
        kicker={`${count(data.items.length)} items · ${data.parts.length} Parts · 6 subjects`}
        title="Subjects"
        sub="Pick a subject to see its Parts. A Part opens once the one before it has been read."
      />

      {/* --- six equal tiles: the two numbers that decide passing, then counts */}
      <section
        aria-label="Overall progress"
        className="card grid grid-cols-2 divide-line-soft overflow-hidden p-0 sm:grid-cols-3 lg:grid-cols-6 lg:divide-x"
        style={step(1)}
      >
        <SummaryTile label="Weighted coverage" value={pct(totalCoverage)} bar={totalCoverage} />
        <SummaryTile label="Mastery depth" value={pct(totalDepth)} bar={totalDepth} muted />
        <SummaryTile label="Items seen" value={count(touched)} sub={`of ${count(data.items.length)}`} />
        <SummaryTile label="Parts open" value={count(partsOpen)} sub={`of ${data.parts.length}`} />
        <SummaryTile label="Flagged" value={count(flags.size)} sub="for review" />
        <SummaryTile label="Days studied" value={count(daysStudiedWithin(events, 30))} sub="of the last 30" />
      </section>

      {totalCoverage > 0.5 && totalDepth < totalCoverage / 2 && (
        <p className="rounded-tile border border-flag/30 bg-wash-sage px-4 py-3 text-xs leading-relaxed text-flag">
          Coverage is running well ahead of depth — a lot has been seen, less can be answered.
        </p>
      )}

      {subject ? (
        <div className="dive" style={step(2)}>
          <div className="dive-arriving">
            <SubjectDetail
              subject={subject}
              parts={data.parts.filter((p) => p.subjectId === subject.id)}
              lockStates={lockStates}
              progress={progress}
              coverage={coverage(lookups.itemsBySubject.get(subject.id) ?? [], progress)}
              depth={depth(lookups.itemsBySubject.get(subject.id) ?? [], progress)}
              selectedPartId={partId}
              onSelectPart={(id) => setPartId(id)}
              onBack={() => {
                setSubjectId(null);
                setPartId(null);
              }}
            />
          </div>
        </div>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" style={step(2)}>
          {data.subjects.map((s) => {
            const items = lookups.itemsBySubject.get(s.id) ?? [];
            const own = data.parts.filter((p) => p.subjectId === s.id);
            return (
              <li key={s.id}>
                <SubjectCard
                  subject={s}
                  parts={own}
                  lockStates={lockStates}
                  progress={progress}
                  coverage={coverage(items, progress)}
                  depth={depth(items, progress)}
                  onSelect={() => {
                    setSubjectId(s.id);
                    setPartId(null);
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  sub,
  bar,
  muted = false,
}: {
  label: string;
  value: string;
  sub?: string;
  bar?: number;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col border-b border-line-soft p-5 lg:border-b-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="tnum mt-2 font-display text-3xl leading-none text-heading">{value}</p>
      {bar !== undefined ? (
        <div className="mt-auto pt-3">
          <div
            className="meter-track h-1.5"
            role="progressbar"
            aria-label={label}
            aria-valuenow={Math.round(bar * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="meter-fill" style={{ width: `${bar * 100}%`, opacity: muted ? 0.55 : 1 }} />
          </div>
        </div>
      ) : (
        <p className="mt-auto pt-2 text-xs text-ink-muted">{sub}</p>
      )}
    </div>
  );
}

function SchedulePage({
  data,
  schedule,
  setSchedule,
}: {
  data: Syllabus;
  schedule: ReturnType<typeof useSchedule>['schedule'];
  setSchedule: ReturnType<typeof useSchedule>['setSchedule'];
}) {
  const now = useNow();
  const routine = routineNow(schedule, now);

  // Built from the subjects themselves rather than a second hand-kept list
  // that could drift out of step with the syllabus.
  const examDays = [...new Set(data.subjects.map((s) => s.examDay))]
    .sort((a, b) => a - b)
    .map((day) => {
      const subjects = data.subjects
        .filter((s) => s.examDay === day)
        .sort((a, b) => (a.examSlot === b.examSlot ? 0 : a.examSlot === 'AM' ? -1 : 1));
      const date = subjects[0].examDate;
      return { day, date, subjects };
    });

  return (
    <div className="stagger space-y-6">
      <PageHeader
        kicker="Bar 2027"
        title="Schedule"
        sub="The exam days, and the routine that gets you there."
      />

      <section aria-labelledby="exam-days" style={step(1)}>
        <h2 id="exam-days" className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          Exam days
        </h2>
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {examDays.map((d) => {
            const left = daysUntil(d.date);
            return (
              <li key={d.day} className="card flex gap-4 p-5">
                <div className="grid w-14 shrink-0 place-items-center rounded-tile bg-wash-sage py-2 text-center">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                    {new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short' })}
                  </span>
                  <span className="tnum font-display text-2xl leading-none text-heading">
                    {new Date(d.date + 'T00:00:00').getDate()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-lg text-heading">Day {d.day}</span>
                    <span className="tnum text-[11px] text-ink-muted">
                      {left > 0 ? `in ${count(left)} days` : 'today'}
                    </span>
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {d.subjects.map((s) => (
                      <li key={s.id} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="leading-snug text-ink">{s.shortName}</span>
                        <span className="shrink-0 rounded-full bg-sunken/60 px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                          {s.examSlot}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <div style={step(2)}>
        <ScheduleTables
          schedule={schedule}
          onChange={setSchedule}
          today={routine.group}
          nowRowId={routine.now?.row.id ?? null}
        />
      </div>
    </div>
  );
}

// --- item drawer ------------------------------------------------------------

function ItemDrawer({
  part,
  subject,
  items,
  lock,
  progress,
  flags,
  onAdvance,
  onDemote,
  onFlag,
  onUnlock,
  onClose,
}: {
  part: Part;
  subject: Subject | null;
  items: Item[];
  lock: LockState | undefined;
  progress: ProgressMap;
  flags: Set<string>;
  onAdvance: (id: string) => void;
  onDemote: (id: string) => void;
  onFlag: (id: string) => void;
  onUnlock: () => void;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  // A dialog owes the keyboard three things: focus on open, Escape to leave,
  // and focus back where it came from.
  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      // Keep Tab inside the drawer while it is modal.
      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnTo?.focus?.();
    };
  }, [onClose]);

  const done = items.filter((i) => masteryOf(progress, i.id) >= 1).length;

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="animate-fade absolute inset-0 cursor-default bg-ink/25 backdrop-blur-[2px]"
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className="animate-drawer absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-raised shadow-e3 sm:border-l sm:border-line-soft"
      >
        <header className="shrink-0 border-b border-line-soft px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                {subject?.shortName} · Part {part.seq}
              </p>
              <h2 id="drawer-title" className="mt-1 font-display text-xl leading-snug text-heading">
                {part.title}
              </h2>
            </div>
            <button
              ref={closeBtn}
              onClick={onClose}
              aria-label="Close this Part"
              className="pressable grid size-9 shrink-0 place-items-center rounded-full border border-line-soft text-ink-muted hover:bg-sunken hover:text-ink"
            >
              <CloseIcon />
            </button>
          </div>

          {lock !== 'locked' && (
            <div className="mt-3 flex items-center gap-3">
              <div className="meter-track h-1.5 flex-1">
                <div
                  className="meter-fill"
                  style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }}
                />
              </div>
              <span className="tnum shrink-0 text-xs text-ink-muted">
                {done} / {items.length} seen
              </span>
            </div>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {lock === 'locked' ? (
            <div className="p-8 text-center">
              <p className="font-display text-lg text-heading">Locked.</p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
                Finish reading Part {part.seq - 1} to open it the intended way — or open it now if
                your review needs it.
              </p>
              <button
                onClick={onUnlock}
                className="btn-accent pressable mt-5 rounded-full px-6 py-3 text-sm font-semibold"
              >
                I need this now
              </button>
            </div>
          ) : (
            <>
              {lock === 'override' && (
                <p className="border-b border-line-soft bg-wash-sage px-5 py-3 text-xs leading-relaxed text-flag sm:px-6">
                  Opened early. This subject is no longer eligible for its clean-path badge —
                  everything else is unchanged.
                </p>
              )}
              <ul>
                {items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    mastery={masteryOf(progress, item.id)}
                    flagged={flags.has(item.id)}
                    onAdvance={() => onAdvance(item.id)}
                    onDemote={() => onDemote(item.id)}
                    onFlag={() => onFlag(item.id)}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// --- pieces -----------------------------------------------------------------

/**
 * One subject in the grid. Every card has the same four bands — title, facts,
 * the two bars, and a Parts strip on the bottom edge — so a row of three reads
 * as one aligned table rather than three differently-shaped boxes.
 */
function SubjectCard({
  subject,
  parts,
  lockStates,
  progress,
  coverage: cov,
  depth: dep,
  onSelect,
}: {
  subject: Subject;
  parts: Part[];
  lockStates: Map<string, LockState>;
  progress: ProgressMap;
  coverage: number;
  depth: number;
  onSelect: () => void;
}) {
  const sorted = [...parts].sort((a, b) => a.seq - b.seq);
  const open = sorted.filter((p) => lockStates.get(p.id) !== 'locked').length;
  return (
    <button
      onClick={onSelect}
      className="card card-interactive group flex h-full w-full cursor-pointer flex-col p-5 text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-display text-lg leading-snug text-heading">{subject.shortName}</span>
        <span className="shrink-0 rounded-full bg-wash-sage px-2.5 py-1 text-[11px] font-semibold text-accent">
          {Math.round(subject.weight * 100)}% of grade
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        Day {subject.examDay} {subject.examSlot} · {count(subject.itemCount)} items · {parts.length} Parts
      </p>

      {/* Coverage and depth are never shown apart (AC-11). */}
      <div className="mt-4 space-y-2">
        <PanelBar label="Seen" value={cov} />
        <PanelBar label="Deep" value={dep} muted />
      </div>

      <div className="mt-auto pt-4">
        <div className="flex items-center justify-between border-t border-line-soft pt-3 text-[11px] text-ink-muted">
          <span>
            <span className="font-semibold text-ink">{open}</span> of {parts.length} Parts open
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-accent opacity-70 transition-opacity group-hover:opacity-100">
            Open <ArrowRightIcon />
          </span>
        </div>
        {/* One segment per Part: filled by mastery, dashed when locked. */}
        <div aria-hidden="true" className="mt-2 flex gap-[3px]">
          {sorted.map((p) => {
            const locked = lockStates.get(p.id) === 'locked';
            return (
              <span
                key={p.id}
                className={`relative h-1.5 flex-1 overflow-hidden rounded-full ${
                  locked ? 'border border-dashed border-line-soft' : 'bg-sunken'
                }`}
              >
                {!locked && (
                  <span className="meter-fill absolute inset-y-0 left-0" style={{ width: `${partFill(p, progress) * 100}%` }} />
                )}
              </span>
            );
          })}
        </div>
      </div>
    </button>
  );
}

/** One level in: the subject, with all of its Parts, as two balanced columns. */
function SubjectDetail({
  subject,
  parts,
  lockStates,
  progress,
  coverage: cov,
  depth: dep,
  selectedPartId,
  onSelectPart,
  onBack,
}: {
  subject: Subject;
  parts: Part[];
  lockStates: Map<string, LockState>;
  progress: ProgressMap;
  coverage: number;
  depth: number;
  selectedPartId: string | null;
  onSelectPart: (id: string) => void;
  onBack: () => void;
}) {
  const sorted = [...parts].sort((a, b) => a.seq - b.seq);
  return (
    <section className="card grid overflow-hidden p-0 lg:grid-cols-[22rem_minmax(0,1fr)]" aria-labelledby="subject-title">
      <div className="flex flex-col border-b border-line-soft bg-wash-sage/50 p-6 lg:border-b-0 lg:border-r">
        <button
          onClick={onBack}
          className="pressable inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-full px-2 py-1 -ml-2 text-xs font-semibold text-accent hover:bg-raised"
        >
          <BackIcon />
          All subjects
        </button>

        <h2 id="subject-title" className="mt-4 font-display text-2xl leading-snug text-heading">
          {subject.name}
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          {Math.round(subject.weight * 100)}% of grade · Day {subject.examDay} {subject.examSlot} ·{' '}
          {count(subject.itemCount)} items
        </p>

        <div className="mt-auto space-y-2.5 pt-6">
          <PanelBar label="Seen" value={cov} />
          <PanelBar label="Deep" value={dep} muted />
        </div>
      </div>

      <div className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-accent">
            {parts.length} Parts
          </h3>
          <p className="text-[11px] text-ink-muted">Bar is mastery · number is items · pick one to study</p>
        </div>
        <div className="mt-4 grid gap-2 xl:grid-cols-2">
          {sorted.map((p) => (
            <PartChip
              key={p.id}
              part={p}
              state={lockStates.get(p.id) ?? 'locked'}
              fill={partFill(p, progress)}
              selected={selectedPartId === p.id}
              onSelect={() => onSelectPart(p.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
/**
 * One Part as a row. Locked state is carried by a dashed border, a padlock and
 * the word itself, and progress by a labelled bar — never by colour alone (AC-27).
 */
function PartChip({
  part,
  state,
  fill,
  selected,
  onSelect,
}: {
  part: Part;
  state: LockState;
  fill: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const locked = state === 'locked';
  const status = locked ? 'Locked' : state === 'override' ? 'Opened early' : 'Open';
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Part ${part.seq}: ${part.title}. ${status}. ${Math.round(fill * 100)} percent mastered.`}
      className={`pressable flex w-full cursor-pointer items-center gap-3 rounded-tile border p-3 text-left ${
        selected
          ? 'border-accent bg-wash-sage'
          : locked
            ? 'border-dashed border-line bg-sunken/30 hover:bg-sunken/50'
            : 'border-line-soft bg-raised hover:border-line hover:shadow-e1'
      }`}
    >
      <span
        aria-hidden="true"
        className={`grid size-9 shrink-0 place-items-center rounded-lg text-sm font-semibold ${
          locked ? 'bg-sunken/60 text-ink-muted' : 'bg-wash-sage text-accent'
        }`}
      >
        {locked ? <LockIcon /> : part.seq}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-medium ${locked ? 'text-ink-muted' : 'text-ink'}`} title={part.title}>
          Part {part.seq} · {part.title}
        </span>
        <span aria-hidden="true" className="mt-1.5 flex items-center gap-2">
          <span className="meter-track h-1.5 flex-1">
            <span className="meter-fill block" style={{ width: `${fill * 100}%` }} />
          </span>
          <span className="tnum w-24 shrink-0 text-right text-[11px] text-ink-muted">
            {state === 'override' ? 'Opened early' : locked ? 'Locked' : `${Math.round(fill * 100)}%`} ·{' '}
            {part.itemCount}
          </span>
        </span>
      </span>
    </button>
  );
}

function ItemRow({
  item,
  mastery,
  flagged,
  onAdvance,
  onDemote,
  onFlag,
}: {
  item: Item;
  mastery: 0 | 1 | 2 | 3;
  flagged: boolean;
  onAdvance: () => void;
  onDemote: () => void;
  onFlag: () => void;
}) {
  const m = mastery;
  return (
    <li className="flex gap-4 border-b border-line-soft px-5 py-4 transition-colors last:border-0 hover:bg-wash-warm/70 sm:px-6">
      {/* Climbs one rung per tap and STOPS at Mastered (AC-15). Not `disabled`
          there: that removes it from the tab order, so a keyboard user could
          never reach the one control that announces the item IS mastered. */}
      <button
        key={m}
        onClick={onAdvance}
        aria-label={
          m === 3
            ? `${item.text}. Mastered. Use the step-back button to demote.`
            : `${item.text}. Currently ${MASTERY_LABELS[m]}. Tap to mark ${
                MASTERY_LABELS[(m + 1) as 1 | 2 | 3]
              }.`
        }
        className="animate-pop pressable mt-0.5 size-7 shrink-0 rounded-full border-2 shadow-e1"
        style={{
          borderColor: m === 0 ? 'var(--c-line)' : 'var(--c-node)',
          borderStyle: m === 0 ? 'dashed' : 'solid',
          background:
            m === 0
              ? 'transparent'
              : m === 1
                ? 'conic-gradient(var(--c-rung-1) 0 25%, transparent 25%)'
                : m === 2
                  ? 'linear-gradient(to right, var(--c-rung-2) 50%, transparent 50%)'
                  : 'var(--c-rung-3)',
        }}
      />

      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-relaxed text-ink">{item.text}</p>
        <p className="mt-1.5 text-xs text-ink-muted">
          <span className="font-medium text-accent">{item.ref}</span> · {MASTERY_LABELS[m]}
          {item.subtopicPath.length > 0 && ` · ${item.subtopicPath.join(' › ')}`}
        </p>
      </div>

      <div className="mt-0.5 flex shrink-0 items-start gap-1">
        {m > 0 && (
          <button
            onClick={onDemote}
            aria-label={`Step ${item.text} back to ${MASTERY_LABELS[(m - 1) as 0 | 1 | 2]}`}
            title={`Step back to ${MASTERY_LABELS[(m - 1) as 0 | 1 | 2]}`}
            className="pressable grid size-8 place-items-center rounded-full text-ink-muted hover:bg-sunken hover:text-ink"
          >
            <MinusIcon />
          </button>
        )}
        <button
          onClick={onFlag}
          aria-label={flagged ? 'Remove needs-review flag' : 'Flag as needs review'}
          aria-pressed={flagged}
          className={`pressable grid size-8 place-items-center rounded-full hover:bg-sunken ${
            flagged ? 'text-flag' : 'text-line'
          }`}
        >
          <FlagIcon filled={flagged} />
        </button>
      </div>
    </li>
  );
}

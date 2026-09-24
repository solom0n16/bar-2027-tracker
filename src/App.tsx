import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Daisy from './Daisy';
import Dashboard from './Dashboard';
import ScheduleTables from './Schedule';
import { useNow, useProgress, useRoute, useSchedule, useScrolled, type Route } from './hooks';
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
import { daysStudiedWithin, studyDates } from './lib/events';
import { STAGES, peakWeightedCoverage, ratchetedStage } from './lib/daisy';
import { routineNow } from './lib/dashboard';
import {
  BackIcon,
  BookIcon,
  CalendarIcon,
  CloseIcon,
  DaisyMark,
  FlagIcon,
  HomeIcon,
  LockIcon,
  MinusIcon,
  SearchIcon,
} from './Icons';
import { PanelBar, count, pct, step, type Lookups, type Syllabus } from './ui';

/**
 * Where each subject card sits around the plant, in subject order.
 *
 * Points on an ellipse that is never drawn — six positions 60 degrees apart
 * starting upper-right so the ring reads clockwise. Percentages rather than
 * pixels so the arrangement survives any container width; the whole thing
 * collapses to a plain grid below `lg`.
 */
const CARD_POS = [
  { left: '68%', top: '14%' }, // Political      — upper right
  { left: '82%', top: '50%' }, // Commercial     — right
  { left: '68%', top: '86%' }, // Civil          — lower right
  { left: '32%', top: '86%' }, // Labor          — lower left
  { left: '18%', top: '50%' }, // Criminal       — left
  { left: '32%', top: '14%' }, // Remedial       — upper left
];

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
        coverage={shownCoverage}
        depth={shownDepth}
        stageName={stage.name}
        stage={stage}
        touched={touched}
        preview={preview}
        setPreview={setPreview}
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

function PageHeader({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <header style={step(0)}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{kicker}</p>
      <h1 className="mt-1 font-display text-3xl leading-tight text-heading">{title}</h1>
      {sub && <p className="mt-1 text-sm text-ink-muted">{sub}</p>}
    </header>
  );
}

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
  coverage: shownCoverage,
  depth: shownDepth,
  stage,
  stageName,
  touched,
  preview,
  setPreview,
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
  stage: ReturnType<typeof ratchetedStage>;
  stageName: string;
  touched: number;
  preview: number | null;
  setPreview: (v: number | null) => void;
}) {
  const subject = subjectId ? lookups.subjectById.get(subjectId) ?? null : null;
  const daysStudied = daysStudiedWithin(events, 30);
  const totalStudyDays = studyDates(events).length;
  const partsOpen = [...lockStates.values()].filter((s) => s !== 'locked').length;

  return (
    <div className="stagger space-y-5">
      <PageHeader
        kicker={`${count(data.items.length)} items · ${data.parts.length} Parts`}
        title="Subjects"
        sub="Pick a subject to see its Parts. A Part opens once the one before it has been read."
      />

      {/* --- the plant, with the subjects around it ------------------------
          Two layers on one z-axis. Picking a subject pushes the overview back
          and brings that subject forward through it. */}
      <section className="dive relative lg:h-[42rem]" style={step(1)}>
        <div className={`dive-layer lg:absolute lg:inset-0 ${subject ? 'dive-receded' : ''}`}>
          <div className="relative h-full">
            <div className="mx-auto w-full max-w-xs lg:absolute lg:left-1/2 lg:top-1/2 lg:w-72 lg:max-w-none lg:-translate-x-1/2 lg:-translate-y-1/2">
              <Daisy stage={stage} coverage={shownCoverage} depth={shownDepth} compact />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:mt-0 lg:block">
              {data.subjects.map((s) => {
                const items = lookups.itemsBySubject.get(s.id) ?? [];
                const openParts = data.parts.filter(
                  (p) => p.subjectId === s.id && lockStates.get(p.id) !== 'locked'
                ).length;
                return (
                  <SubjectCard
                    key={s.id}
                    subject={s}
                    pos={CARD_POS[s.seq - 1] ?? CARD_POS[0]}
                    coverage={coverage(items, progress)}
                    depth={depth(items, progress)}
                    openParts={openParts}
                    onSelect={() => {
                      setSubjectId(s.id);
                      setPartId(null);
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {subject && (
          <div className="dive-arriving absolute inset-0 grid place-items-center">
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
        )}
      </section>

      {/* --- the two numbers that decide passing --------------------------- */}
      <section className="card p-6 sm:p-7" style={step(2)}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
          <div className="space-y-6">
            <Meter label="Weighted coverage" hint="Touched at least once" value={shownCoverage} />
            <Meter label="Mastery depth" hint="How well you actually know it" value={shownDepth} />

            {shownCoverage > 0.5 && shownDepth < shownCoverage / 2 && (
              <p className="rounded-tile border border-flag/30 bg-wash-sage px-4 py-3 text-xs leading-relaxed text-flag">
                The plant is growing faster than it is flowering. Coverage is running well ahead of
                depth — a lot has been seen, less can be answered.
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <Stat label="Touched" value={touched} sub={`of ${count(data.items.length)} items`} />
              <Stat label="Parts open" value={partsOpen} sub={`of ${data.parts.length}`} />
              <Stat label="Flagged" value={flags.size} sub="needs review" />
              <Stat label="Days studied" value={daysStudied} sub="of the last 30" accent />
              <Stat
                label="Study days"
                value={totalStudyDays}
                sub={`${count(events.length)} event${events.length === 1 ? '' : 's'}`}
              />
            </div>

            <StagePreview value={preview} onChange={setPreview} stageName={stageName} />
          </div>
        </div>
      </section>
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
        <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

// --- shell ------------------------------------------------------------------

interface SearchProps {
  query: string;
  setQuery: (q: string) => void;
  hits: SearchHit[];
  onPick: (h: SearchHit) => void;
}

const NAV: { route: Route; label: string; icon: ReactNode }[] = [
  { route: 'dashboard', label: 'Dashboard', icon: <HomeIcon className="size-4 shrink-0" /> },
  { route: 'subjects', label: 'Subjects', icon: <BookIcon className="size-4 shrink-0" /> },
  { route: 'schedule', label: 'Schedule', icon: <CalendarIcon className="size-4 shrink-0" /> },
];

/**
 * One sticky top panel: brand, the three pages, and search. On a laptop they
 * share a single row; on narrow windows the page links drop to a second row so
 * nothing is squeezed.
 */
function Shell({
  children,
  search,
  route,
  go,
}: {
  children: ReactNode;
  search: SearchProps;
  route: Route;
  go: (r: Route) => void;
}) {
  const scrolled = useScrolled();
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);

  // Move focus to the new page for keyboard and screen-reader users, but not
  // on first load, where focus belongs to the browser.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    main.current?.focus({ preventScroll: true });
  }, [route]);

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-raised px-4 py-2 text-sm font-semibold text-accent shadow-e2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <header
        className={`glass sticky top-0 z-30 backdrop-blur-xl backdrop-saturate-150 ${
          scrolled ? 'glass-scrolled' : ''
        }`}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6 lg:flex-nowrap lg:px-8">
          <a
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              go('dashboard');
            }}
            aria-label="Bar 2027 Study Tracker, go to dashboard"
            className="mr-auto shrink-0 rounded-xl lg:mr-0"
          >
            <Brand />
          </a>

          <nav
            aria-label="Main"
            className="order-last flex w-full gap-1 lg:order-none lg:mx-auto lg:w-auto lg:rounded-full lg:border lg:border-line-soft lg:bg-raised/70 lg:p-1 lg:shadow-e1"
          >
            {NAV.map((n) => {
              const active = route === n.route;
              return (
                <a
                  key={n.route}
                  href={n.route === 'dashboard' ? '#/' : `#/${n.route}`}
                  onClick={(e) => {
                    e.preventDefault();
                    go(n.route);
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`pressable flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium sm:flex-none sm:px-4 ${
                    active
                      ? 'bg-accent-solid text-on-accent shadow-e1'
                      : 'text-ink-muted hover:bg-sunken/50 hover:text-ink'
                  }`}
                >
                  {n.icon}
                  {n.label}
                </a>
              );
            })}
          </nav>

          <div className="w-full sm:w-auto sm:shrink-0">
            <SearchBox {...search} />
          </div>
        </div>
      </header>

      <main
        id="main"
        ref={main}
        tabIndex={-1}
        className="mx-auto w-full max-w-7xl px-4 pt-6 outline-none sm:px-6 lg:px-8"
      >
        {children}
      </main>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <DaisyMark />
      <div>
        <p className="font-display text-xl leading-none text-heading">Bar 2027</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-ink-muted">Study tracker</p>
      </div>
    </div>
  );
}

/** Search lives in the top bar. The results panel is absolutely positioned so it
 *  overlays the page rather than pushing the whole layout down on every
 *  keystroke. */
function SearchBox({ query, setQuery, hits, onPick }: SearchProps) {
  const open = query.trim().length >= 2;
  return (
    <div className="relative w-full sm:w-80 lg:w-96">
      <label className="sr-only" htmlFor="q">
        Search all 1,489 items
      </label>
      <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
      <input
        id="q"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
        placeholder="Search all 1,489 items…"
        className="w-full rounded-full border border-line-soft bg-raised py-2.5 pl-11 pr-4 text-sm text-ink shadow-e1 transition-shadow placeholder:text-ink-muted hover:shadow-e2 focus:shadow-e2"
      />

      {open && (
        <div className="card animate-expand absolute right-0 top-full z-10 mt-2 max-h-[70vh] w-full overflow-y-auto p-0 shadow-e3 sm:w-[28rem]">
          <p className="sticky top-0 border-b border-line-soft bg-raised px-4 py-2.5 text-xs text-ink-muted">
            {hits.length === 0
              ? `No matches for “${query.trim()}”. Try a shorter phrase, or a section ref like I.A.1.`
              : `${hits.length} match${hits.length === 1 ? '' : 'es'}`}
          </p>
          {hits.map((h) => (
            <button
              key={h.item.id}
              onClick={() => onPick(h)}
              className="pressable block w-full border-b border-line-soft px-4 py-3 text-left last:border-0 hover:bg-wash-sage"
            >
              <span className="text-sm leading-snug text-ink">{h.item.text}</span>
              <span className="mt-1 block text-xs text-ink-muted">
                {h.subject.shortName} · {h.part.title} · {h.item.ref}
              </span>
            </button>
          ))}
        </div>
      )}
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

// --- TEMPORARY --------------------------------------------------------------

function StagePreview({
  value,
  onChange,
  stageName,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  stageName: string;
}) {
  return (
    <div className="rounded-tile border border-dashed border-flag/60 bg-wash-sage/40 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-flag">
        Temporary · preview stages
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
        Currently showing <span className="font-semibold text-ink">{stageName}</span>. Changes
        nothing that is stored.
      </p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {STAGES.map((s, i) => (
          <button
            key={s.roman}
            onClick={() => onChange(value === i ? null : i)}
            aria-pressed={value === i}
            title={`${s.name} (${s.band})`}
            className={`pressable rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              value === i
                ? 'border-accent bg-accent-solid text-on-accent'
                : 'border-line-soft bg-raised text-ink hover:border-line'
            }`}
          >
            {s.roman}
          </button>
        ))}
        <button
          onClick={() => onChange(null)}
          className="pressable rounded-full border border-line-soft px-2.5 py-1 text-[11px] text-ink-muted hover:border-line"
        >
          Live
        </button>
      </div>
    </div>
  );
}

// --- pieces -----------------------------------------------------------------

/**
 * A subject, at rest in the ring. Opening one dives into <SubjectDetail/>,
 * which has room for the Parts without shoving its neighbours around.
 */
function SubjectCard({
  subject,
  pos,
  coverage: cov,
  depth: dep,
  openParts,
  onSelect,
}: {
  subject: Subject;
  pos: { left: string; top: string };
  coverage: number;
  depth: number;
  openParts: number;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      // left/top are inert until `lg:absolute` takes effect, so one set of
      // styles serves both the grid and the ring.
      style={pos}
      className="card card-interactive w-full cursor-pointer p-4 text-left lg:absolute lg:w-[16.5rem] lg:-translate-x-1/2 lg:-translate-y-1/2"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-base leading-snug text-heading">
          {subject.shortName}
        </span>
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-accent">
          {Math.round(subject.weight * 100)}%
        </span>
      </div>

      <p className="mt-1 text-[11px] text-ink-muted">
        {count(subject.itemCount)} items · {subject.partIds.length} Parts, {openParts} open
      </p>

      {/* Coverage and depth are never shown apart (AC-11). */}
      <div className="mt-3 space-y-2">
        <PanelBar label="Seen" value={cov} />
        <PanelBar label="Deep" value={dep} muted />
      </div>
    </button>
  );
}

/** One level in: the subject, with all of its Parts. */
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
  return (
    <div className="card w-full max-w-2xl p-5 shadow-e3 sm:p-7">
      <button
        onClick={onBack}
        className="pressable inline-flex items-center gap-1.5 text-xs font-medium text-accent"
      >
        <BackIcon />
        All subjects
      </button>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-2xl leading-snug text-heading">{subject.name}</h2>
        <span className="text-xs font-semibold uppercase tracking-wider text-accent">
          {Math.round(subject.weight * 100)}% of grade
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        {count(subject.itemCount)} items · {parts.length} Parts · Day {subject.examDay}{' '}
        {subject.examSlot}
      </p>

      <div className="mt-4 space-y-2.5">
        <PanelBar label="Seen" value={cov} />
        <PanelBar label="Deep" value={dep} muted />
      </div>

      <div className="mt-5 border-t border-line-soft pt-4">
        <p className="text-[11px] uppercase tracking-wider text-ink-muted">
          Parts <span className="normal-case tracking-normal">· bar is mastery, padlock is locked</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {parts.map((p) => (
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
    </div>
  );
}

/**
 * One Part. State is carried by a dashed border plus a padlock, and progress by
 * the bar along the bottom — never by colour alone (AC-27).
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
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      title={`Part ${part.seq}: ${part.title}`}
      aria-label={`Part ${part.seq}: ${part.title}. ${
        locked ? 'Locked' : state === 'override' ? 'Opened early' : 'Open'
      }. ${Math.round(fill * 100)} percent mastered.`}
      className={`pressable relative grid size-12 place-items-center overflow-hidden rounded-xl border text-sm font-semibold ${
        selected
          ? 'border-accent bg-wash-sage text-accent'
          : locked
            ? 'border-dashed border-line bg-sunken/50 text-ink-muted'
            : 'border-line-soft bg-raised text-ink hover:border-line hover:shadow-e2'
      }`}
    >
      <span className="flex items-center gap-0.5 leading-none">
        {locked && <LockIcon small />}
        {part.seq}
      </span>
      {state === 'override' && (
        <span aria-hidden="true" className="absolute right-1 top-1 size-1.5 rounded-full bg-flag" />
      )}
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-sunken">
        <span className="meter-fill block h-full" style={{ width: `${fill * 100}%` }} />
      </span>
    </button>
  );
}

function Meter({ label, hint, value }: { label: string; hint: string; value: number }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink">{label}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>
        </div>
        <p className="tnum font-display text-3xl leading-none text-heading">{pct(value)}</p>
      </div>
      <div
        className="meter-track mt-3 h-2.5"
        role="progressbar"
        aria-valuenow={Math.round(value * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="meter-fill" style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: number;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-tile border p-3 transition-colors ${
        accent
          ? 'border-accent/25 bg-wash-sage'
          : 'border-line-soft bg-surface/60 hover:bg-wash-warm'
      }`}
    >
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="tnum mt-1 font-display text-2xl leading-none text-ink">{count(value)}</p>
      <p className="mt-1 text-[11px] text-ink-muted">{sub}</p>
    </div>
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

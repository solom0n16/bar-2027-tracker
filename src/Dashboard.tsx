import { useEffect, useMemo, useState } from 'react';
import Daisy from './Daisy';
import { useNow, type Route } from './hooks';
import {
  coverage,
  depth,
  masteryOf,
  MASTERY_LABELS,
  type LockState,
  type ProgressMap,
} from './lib/progress';
import { daysStudiedWithin, studyDates, type StudyEvent } from './lib/events';
import { addDays, countdownTo, localDateOf, localMidnight } from './lib/dates';
import { STAGES, type Stage } from './lib/daisy';
import type { Schedule } from './lib/schedule';
import {
  HEAT_LEVELS,
  formatMinutes,
  greeting,
  heatmapWeeks,
  lastTouchedItem,
  mondayOf,
  needsAttention,
  newlyCoveredBetween,
  nextMilestones,
  paceOf,
  routineNow,
  streakOf,
  suggestItems,
  type Suggestion,
} from './lib/dashboard';
import {
  AlertIcon,
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  FlagIcon,
  FlameIcon,
  HourglassIcon,
  LeafIcon,
  PlayIcon,
  TargetIcon,
  TrophyIcon,
} from './Icons';
import { CardHeader, LinkButton, PageHeader, PanelBar, count, step, type Lookups, type Syllabus } from './ui';

/**
 * The permanent anchor (design.md 9.1, AC-43). Never rotates.
 *
 * ESV under Crossway's non-commercial quotation terms; the copyright notice is
 * rendered in the app footer, which appears on every page.
 */
const ANCHOR_VERSE = {
  text: 'Whatever you do, work heartily, as for the Lord and not for men,',
  ref: 'Colossians 3:23',
  translation: 'ESV',
};

const HEAT_WEEKS = 30;
const SUGGESTIONS = 3;

interface Props {
  data: Syllabus;
  lookups: Lookups;
  progress: ProgressMap;
  flags: Set<string>;
  events: StudyEvent[];
  lockStates: Map<string, LockState>;
  schedule: Schedule;
  coverage: number;
  depth: number;
  stage: Stage;
  touched: number;
  onOpenPart: (partId: string) => void;
  onOpenSubject: (subjectId: string) => void;
  onAdvance: (itemId: string) => void;
  go: (r: Route) => void;
  /** TEMPORARY stage preview — which stage the daisy is forced to, if any. */
  preview: number | null;
  setPreview: (v: number | null) => void;
}

/**
 * The dashboard is built to be read at a glance: on a laptop the whole thing
 * fits one screen. Three rows on a 12-column grid —
 *
 *   4 · 4 · 4 · 4   the four numbers: countdown, streak, pace, the daisy
 *     8   ·   4     what to do today, and where the grade is at risk
 *     8   ·   4     how the work has been spread, and what is next to earn
 *
 * Cards carry a title and nothing else above their content; anything a
 * subtitle used to explain is either obvious from the content or in a tooltip.
 */
export default function Dashboard(props: Props) {
  const { data, lookups, progress, flags, events, lockStates, schedule } = props;
  const now = useNow();
  const today = localDateOf(now);

  const dates = useMemo(() => studyDates(events), [events]);
  const streak = useMemo(() => streakOf(dates, now), [dates, today]);
  const pace = paceOf(events, data.calendar, data.items.length, props.touched, data.exam.days[0], now);
  const routine = routineNow(schedule, now);
  const daysStudied30 = daysStudiedWithin(events, 30, now);

  const focusSubject = pace.week
    ? data.subjects.find((s) => s.name === pace.week!.focus) ?? null
    : null;

  const suggestions = suggestItems(
    {
      subjects: data.subjects,
      parts: data.parts,
      itemsByPart: lookups.itemsByPart,
      itemById: lookups.itemById,
      lockStates,
      progress,
      flags,
      focus: pace.week?.focus ?? null,
    },
    SUGGESTIONS
  );

  const metrics = useMemo(() => {
    const m = new Map<string, { coverage: number; depth: number }>();
    for (const s of data.subjects) {
      const items = lookups.itemsBySubject.get(s.id) ?? [];
      m.set(s.id, { coverage: coverage(items, progress), depth: depth(items, progress) });
    }
    return m;
  }, [data.subjects, lookups, progress]);

  const attention = needsAttention(data.subjects, metrics, flags, lookups.itemById);
  const mastered = useMemo(() => Object.values(progress).filter((m) => m === 3).length, [progress]);
  const milestones = nextMilestones(
    {
      touched: props.touched,
      totalItems: data.items.length,
      mastered,
      weightedCoverage: props.coverage,
      bestStreak: streak.best,
      daysStudied30,
      stage: props.stage,
    },
    3
  );

  // Continue: the last Part you touched, or the first suggestion's Part.
  const last = lastTouchedItem(events);
  const lastItem = last?.itemId ? lookups.itemById.get(last.itemId) : undefined;
  const resumeItem = lastItem ?? suggestions[0]?.item;
  const resumePart = resumeItem ? lookups.partById.get(resumeItem.partId) : undefined;
  const resumeSubject = resumePart ? lookups.subjectById.get(resumePart.subjectId) : undefined;

  return (
    <div className="stagger space-y-3">
      <PageHeader
        title={`${greeting(now)}.`}
        sub={
          <span className="font-display italic">
            “{ANCHOR_VERSE.text}”{' '}
            <span className="font-sans text-xs not-italic text-accent">
              {ANCHOR_VERSE.ref} · {ANCHOR_VERSE.translation}
            </span>
          </span>
        }
        aside={
          resumePart &&
          resumeSubject && (
            <button
              onClick={() => props.onOpenPart(resumePart.id)}
              className="card card-interactive flex w-full max-w-sm cursor-pointer items-center gap-3 p-2.5 pr-4 text-left sm:w-auto"
            >
              <span className="btn-accent grid size-9 shrink-0 place-items-center rounded-full">
                <PlayIcon />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-accent">
                  {lastItem ? `Continue · ${relativeDay(last!.localDate, today)}` : 'Start here'}
                </span>
                <span className="block truncate text-sm font-semibold text-ink">
                  {resumeSubject.shortName} · Part {resumePart.seq}: {resumePart.title}
                </span>
              </span>
            </button>
          )
        }
      />

      {/* --- row 1: the four numbers ------------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" style={step(1)}>
        <CountdownCard target={data.exam.days[0]} />
        <StreakCard streak={streak} dates={dates} today={today} daysStudied30={daysStudied30} />
        <PaceCard pace={pace} />
        <DaisyCard stage={props.stage} coverage={props.coverage} depth={props.depth} onOpen={() => props.go('subjects')} />
      </div>

      {/* --- row 2: today + attention ------------------------------------ */}
      <div className="grid gap-3 lg:grid-cols-12" style={step(2)}>
        <section className="card flex min-w-0 flex-col p-4 lg:col-span-8" aria-labelledby="today-title">
          <CardHeader
            id="today-title"
            icon={<ClockIcon />}
            title={`Today · ${now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`}
            action={
              <span className="shrink-0 text-xs text-ink-muted">
                {focusSubject && (
                  <span className="hidden sm:inline">
                    Focus <span className="font-semibold text-ink">{focusSubject.shortName}</span> ·{' '}
                  </span>
                )}
                <span className="tnum font-semibold text-ink">{newlyCoveredBetween(events, today, today)}</span> new
              </span>
            }
          />
          <div className="mt-3 grid flex-1 grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <RoutinePanel routine={routine} now={now} onOpen={() => props.go('schedule')} />
            <StudyList
              suggestions={suggestions}
              progress={progress}
              lookups={lookups}
              onAdvance={props.onAdvance}
              onOpenPart={props.onOpenPart}
            />
          </div>
        </section>

        <section className="card flex min-w-0 flex-col p-4 lg:col-span-4" aria-labelledby="attention-title">
          <CardHeader
            id="attention-title"
            icon={<AlertIcon />}
            title="Needs attention"
            action={
              <span
                className={`inline-flex shrink-0 items-center gap-1 text-[11px] ${
                  flags.size > 0 ? 'font-semibold text-flag' : 'text-ink-muted'
                }`}
                title={flags.size > 0 ? 'Flagged items lead today’s list' : 'Nothing flagged for review'}
              >
                <FlagIcon filled={flags.size > 0} className="size-3" />
                {count(flags.size)} flagged
              </span>
            }
          />
          <ul className="mt-3 flex flex-1 flex-col justify-between gap-2">
            {attention.map((a) => (
              <li key={a.subject.id}>
                <button
                  onClick={() => props.onOpenSubject(a.subject.id)}
                  title="Ranked by how much of the grade is still unseen"
                  className="pressable -mx-2 w-[calc(100%+1rem)] cursor-pointer rounded-lg px-2 py-1 text-left hover:bg-wash-warm"
                >
                  <span className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-semibold text-ink">{a.subject.shortName}</span>
                    <span className="shrink-0 text-[11px] font-semibold text-accent">
                      {a.flagged > 0 && (
                        <span className="mr-2 inline-flex items-center gap-0.5 text-flag">
                          <FlagIcon filled className="size-3" />
                          {a.flagged}
                        </span>
                      )}
                      {Math.round(a.subject.weight * 100)}% of grade
                    </span>
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <span
                      className="meter-track h-1.5 flex-1"
                      role="progressbar"
                      aria-label={`${a.subject.shortName} seen`}
                      aria-valuenow={Math.round(a.coverage * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span className="meter-fill block" style={{ width: `${a.coverage * 100}%` }} />
                    </span>
                    <span className="tnum w-14 shrink-0 text-right text-[11px] text-ink-muted">
                      {Math.round(a.coverage * 100)}% seen
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* --- row 3: activity + milestones -------------------------------- */}
      <div className="grid gap-3 lg:grid-cols-12" style={step(3)}>
        <Activity events={events} now={now} today={today} />

        <section className="card flex min-w-0 flex-col p-4 lg:col-span-4" aria-labelledby="milestones-title">
          <CardHeader id="milestones-title" icon={<TrophyIcon />} title="Next milestones" />
          <ul className="mt-3 flex flex-1 flex-col justify-between gap-3">
            {milestones.map((m) => {
              const frac = Math.min(1, m.current / m.target);
              return (
                <li key={m.id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-ink">{m.label}</span>
                    <span className="tnum shrink-0 text-xs text-ink-muted">
                      {m.unit === '%' ? `${m.current}%` : count(m.current)} /{' '}
                      {m.unit === '%' ? `${m.target}%` : count(m.target)}
                    </span>
                  </div>
                  <div
                    className="meter-track mt-1 h-1.5"
                    role="progressbar"
                    aria-label={m.label}
                    aria-valuenow={Math.round(frac * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className="meter-fill" style={{ width: `${frac * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <StagePreview value={props.preview} onChange={props.setPreview} />
    </div>
  );
}

function relativeDay(date: string, today: string) {
  if (date === today) return 'today';
  if (date === addDays(today, -1)) return 'yesterday';
  return new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// --- row 1 ------------------------------------------------------------------

/** Months, weeks and days to Day 1. Ticks once a minute; the tiles flip only
 *  when a number actually changes, which is at most once a day. */
function CountdownCard({ target }: { target: string }) {
  const at = useMemo(() => localMidnight(target), [target]);
  const now = useNow(60_000);
  const left = countdownTo(at, now);
  const units = [
    { key: 'months', label: 'Months', value: left.months },
    { key: 'weeks', label: 'Weeks', value: left.weeks },
    { key: 'days', label: 'Days', value: left.days },
  ];

  return (
    <section
      className="card flex min-w-0 flex-col p-4"
      style={{ backgroundImage: 'var(--grad-hero)' }}
      aria-labelledby="countdown-title"
    >
      <CardHeader
        id="countdown-title"
        icon={<HourglassIcon />}
        title="Until Day 1"
        action={
          <span className="shrink-0 text-[11px] text-ink-muted">
            {new Date(target + 'T00:00:00').toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        }
      />
      <div className="my-auto flex justify-center gap-2 pt-3" aria-hidden="true">
        {units.map((u) => (
          <div key={u.key} className="text-center">
            <FlipTile value={String(u.value).padStart(2, '0')} />
            <p className="mt-1.5 text-[10px] uppercase tracking-wider text-ink-muted">{u.label}</p>
          </div>
        ))}
      </div>
      <p className="sr-only">
        {left.reached
          ? 'Day 1 has arrived.'
          : `${left.months} months, ${left.weeks} weeks and ${left.days} days until Day 1, ${target}.`}
      </p>
    </section>
  );
}

const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function StreakCard({
  streak,
  dates,
  today,
  daysStudied30,
}: {
  streak: ReturnType<typeof streakOf>;
  dates: string[];
  today: string;
  daysStudied30: number;
}) {
  const set = new Set(dates);
  const grace = new Set(streak.graceDates);
  const monday = mondayOf(today);
  const week = WEEKDAY.map((label, i) => {
    const date = addDays(monday, i);
    const state: keyof typeof STATE_LABEL = set.has(date)
      ? 'studied'
      : grace.has(date)
        ? 'grace'
        : date === today
          ? 'today'
          : date > today
            ? 'future'
            : 'missed';
    return { label, date, state };
  });
  const broken = streak.current === 0 && streak.best > 0;

  return (
    <section className="card flex min-w-0 flex-col p-4" aria-labelledby="streak-title">
      <CardHeader
        id="streak-title"
        icon={<FlameIcon />}
        title="Streak"
        action={
          <span className="shrink-0 text-[11px] text-ink-muted" title="Longest streak so far">
            Best <span className="tnum font-semibold text-ink">{streak.best}</span>
          </span>
        }
      />

      {/* One grace day per week is forgiven automatically (design.md 8.1). */}
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="tnum font-display text-3xl leading-none text-heading" title="One grace day a week is applied for you">
          {streak.current > 0 ? (
            <>
              {streak.current}
              <span className="ml-1 font-sans text-sm text-ink-muted">day{streak.current === 1 ? '' : 's'}</span>
            </>
          ) : (
            <span className="text-xl">{broken ? 'Welcome back' : 'Start today'}</span>
          )}
        </p>
        <p className="text-right text-[11px] text-ink-muted" title="Days studied in the last 30">
          <span className="tnum font-display text-lg text-heading">{daysStudied30}</span>/30 days
        </p>
      </div>

      <ol className="mt-auto grid grid-cols-7 gap-1 pt-2.5" aria-label="This week">
        {week.map((d) => (
          <li key={d.date} className="flex flex-col items-center gap-0.5">
            <span
              title={`${d.label}: ${STATE_LABEL[d.state]}`}
              aria-label={`${d.label}, ${STATE_LABEL[d.state]}`}
              className={`grid size-6 place-items-center rounded-full text-[10px] font-semibold ${DAY_STYLE[d.state]}`}
            >
              {d.state === 'studied' ? <CheckIcon className="size-3" /> : d.state === 'grace' ? 'G' : ''}
            </span>
            <span className={`text-[10px] leading-none ${d.date === today ? 'font-semibold text-ink' : 'text-ink-muted'}`}>
              {d.label.slice(0, 2)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const STATE_LABEL = {
  studied: 'studied',
  grace: 'grace day',
  today: 'today, not yet studied',
  future: 'upcoming',
  missed: 'no study',
} as const;

const DAY_STYLE = {
  studied: 'bg-heat-4 text-on-accent',
  grace: 'border-2 border-dashed border-disc-edge bg-raised text-highlight-ink',
  today: 'border-2 border-accent bg-raised',
  future: 'border border-dashed border-line-soft',
  missed: 'border border-line bg-sunken/40',
} as const;

function PaceCard({ pace }: { pace: ReturnType<typeof paceOf> }) {
  const target = pace.weekTarget;
  const frac = target ? Math.min(1, pace.weekDone / target) : 0;
  const expFrac = target && pace.weekExpected !== null ? Math.min(1, pace.weekExpected / target) : 0;
  const behindBy = pace.weekExpected !== null ? Math.max(0, pace.weekExpected - pace.weekDone) : 0;

  const pill =
    pace.status === 'ahead'
      ? { text: 'Ahead', icon: <CheckIcon />, className: 'bg-wash-sage text-success' }
      : pace.status === 'on-track'
        ? { text: 'On pace', icon: <CheckIcon />, className: 'bg-wash-sage text-accent' }
        : pace.status === 'behind'
          ? { text: `${behindBy} behind`, icon: <AlertIcon className="size-3.5" />, className: 'bg-sunken/60 text-flag' }
          : { text: 'Review weeks', icon: null, className: 'bg-sunken/60 text-ink-muted' };

  return (
    <section className="card flex min-w-0 flex-col p-4" aria-labelledby="pace-title">
      <CardHeader
        id="pace-title"
        icon={<TargetIcon />}
        title={pace.week ? `Week ${pace.week.week}` : 'This week'}
        action={
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${pill.className}`}>
            {pill.icon}
            {pill.text}
          </span>
        }
      />

      <p className="tnum mt-3 font-display text-3xl leading-none text-heading">
        {pace.weekDone}
        {target !== null && <span className="ml-1 font-sans text-sm text-ink-muted">/ {target} new items</span>}
      </p>

      {target !== null && (
        <div className="relative mt-3" title={`Where the week should be by tonight: ${pace.weekExpected}`}>
          <div
            className="meter-track h-2"
            role="progressbar"
            aria-label={`Weekly target. ${pace.weekExpected} expected by tonight.`}
            aria-valuenow={Math.round(frac * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="meter-fill" style={{ width: `${frac * 100}%` }} />
          </div>
          <span
            aria-hidden="true"
            className="absolute -top-1 h-4 w-0.5 rounded bg-ink"
            style={{ left: `calc(${expFrac * 100}% - 1px)` }}
          />
        </div>
      )}

      <p className="mt-auto pt-3 text-[11px] leading-snug text-ink-muted">
        Need <span className="tnum font-semibold text-ink">{pace.perDayNeeded}</span>/day to finish ·
        you’re at <span className="tnum font-semibold text-ink">{pace.recentPerDay.toFixed(1)}</span>
      </p>
    </section>
  );
}

function DaisyCard({
  stage,
  coverage: cov,
  depth: dep,
  onOpen,
}: {
  stage: Stage;
  coverage: number;
  depth: number;
  onOpen: () => void;
}) {
  return (
    <section className="card flex min-w-0 flex-col p-4" aria-labelledby="plant-title">
      <CardHeader
        id="plant-title"
        icon={<LeafIcon />}
        title="Your daisy"
        action={
          <LinkButton onClick={onOpen}>
            Subjects <ArrowRightIcon />
          </LinkButton>
        }
      />
      <div className="mt-3 flex flex-1 items-center gap-4">
        <div className="w-12 shrink-0">
          <Daisy stage={stage} coverage={cov} depth={dep} compact />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs font-semibold text-ink">
            Stage {stage.roman} · {stage.name}
          </p>
          <PanelBar label="Seen" value={cov} />
          <PanelBar label="Deep" value={dep} muted />
        </div>
      </div>
    </section>
  );
}

// --- row 2: today -----------------------------------------------------------

function RoutinePanel({
  routine,
  now,
  onOpen,
}: {
  routine: ReturnType<typeof routineNow>;
  now: Date;
  onOpen: () => void;
}) {
  const b = routine.now;
  const minute = now.getHours() * 60 + now.getMinutes();
  // A block that began yesterday is measured on yesterday's clock.
  const m = b && minute < b.start ? minute + 1440 : minute;
  const elapsed = b ? Math.min(1, Math.max(0, (m - b.start) / (b.end - b.start))) : 0;

  return (
    <div className="flex flex-col rounded-tile bg-wash-sage p-3.5">
      <div className="-my-1 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
          Now · {routine.group === 'weekdays' ? 'Weekday' : 'Weekend'}
        </p>
        <LinkButton onClick={onOpen}>
          Routine <ArrowRightIcon />
        </LinkButton>
      </div>
      {b ? (
        <>
          <p className="mt-1 truncate font-display text-lg leading-snug text-heading" title={b.row.notes || undefined}>
            {b.row.activity}
          </p>
          <p className="tnum text-xs text-ink-muted">
            {formatMinutes(b.start)} – {formatMinutes(b.end)}
            {b.row.highlight && <span className="ml-2 rounded-full bg-highlight px-1.5 py-px text-[10px] font-semibold text-ink">Study</span>}
          </p>
          <div
            className="meter-track mt-2 h-1.5"
            role="progressbar"
            aria-label="Time through this block"
            aria-valuenow={Math.round(elapsed * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="meter-fill" style={{ width: `${elapsed * 100}%` }} />
          </div>
        </>
      ) : (
        <p className="mt-1 text-sm text-ink">Nothing scheduled right now.</p>
      )}

      <p className="mt-3 border-t border-line-soft pt-2.5 text-xs text-ink-muted">
        {routine.next ? (
          <>
            Next <span className="tnum font-semibold text-ink">{formatMinutes(routine.next.start)}</span> ·{' '}
            <span className="text-ink">{routine.next.row.activity}</span>
          </>
        ) : (
          'Nothing else on the clock today.'
        )}
      </p>
    </div>
  );
}

const REASON = {
  flagged: { label: 'Flagged', className: 'text-flag' },
  focus: { label: 'Focus', className: 'text-accent' },
  next: { label: 'High weight', className: 'text-highlight-ink' },
} as const;

function StudyList({
  suggestions,
  progress,
  lookups,
  onAdvance,
  onOpenPart,
}: {
  suggestions: Suggestion[];
  progress: ProgressMap;
  lookups: Lookups;
  onAdvance: (id: string) => void;
  onOpenPart: (id: string) => void;
}) {
  if (suggestions.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Everything open has been started. Finish a Part to unlock the next one.
      </p>
    );
  }
  return (
    <ul className="-my-2 divide-y divide-line-soft" aria-label="Study today">
      {suggestions.map(({ item, reason }) => {
        const m = masteryOf(progress, item.id);
        const next = MASTERY_LABELS[Math.min(3, m + 1) as 1 | 2 | 3];
        const subject = lookups.subjectById.get(item.subjectId);
        const r = REASON[reason];
        return (
          <li key={item.id} className="flex items-center gap-3 py-1.5">
            <button
              onClick={() => onAdvance(item.id)}
              aria-label={`Mark “${item.text}” as ${next}`}
              title={`Mark as ${next}`}
              className="pressable grid size-7 shrink-0 cursor-pointer place-items-center rounded-full border-2 border-dashed border-line text-transparent hover:border-solid hover:border-accent hover:text-accent"
            >
              <CheckIcon />
            </button>
            <div className="min-w-0 flex-1">
              <button
                onClick={() => onOpenPart(item.partId)}
                title={item.text}
                className="block w-full cursor-pointer truncate text-left text-sm text-ink hover:text-accent"
              >
                {item.text}
              </button>
              <p className="truncate text-[11px] text-ink-muted">
                <span className={`font-semibold ${r.className}`}>
                  {reason === 'flagged' && <FlagIcon filled className="mr-0.5 inline size-3 align-[-2px]" />}
                  {r.label}
                </span>
                {' · '}
                {subject?.shortName} · {item.ref}
                {m > 0 && ` · ${MASTERY_LABELS[m]}`}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// --- row 3: activity --------------------------------------------------------

const HEAT_BG = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'] as const;

/** The distribution heatmap (design.md 8.2), sized as a strip rather than a
 *  feature: small fixed cells, with the three numbers that matter beside it. */
function Activity({ events, now, today }: { events: StudyEvent[]; now: Date; today: string }) {
  const weeks = useMemo(() => heatmapWeeks(events, HEAT_WEEKS, now), [events, today]);
  const cells = weeks.flat().filter((c) => !c.future);
  const studyDays = cells.filter((c) => c.count > 0).length;
  const actions = cells.reduce((n, c) => n + c.count, 0);
  const thisWeek = weeks[weeks.length - 1].filter((c) => c.count > 0).length;

  // Busiest weekday across the window, so bunching is visible in words too.
  const byDay = [0, 0, 0, 0, 0, 0, 0];
  for (const col of weeks) col.forEach((c, i) => (byDay[i] += c.count));
  const peak = Math.max(...byDay);
  const busiest = peak > 0 ? WEEKDAY[byDay.indexOf(peak)] : '—';

  const monthLabel = (i: number) => {
    const d = weeks[i][0].date;
    const prev = i > 0 ? weeks[i - 1][0].date : null;
    return !prev || prev.slice(5, 7) !== d.slice(5, 7)
      ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short' })
      : '';
  };

  return (
    <section className="card flex min-w-0 flex-col p-4 lg:col-span-8" aria-labelledby="heat-title">
      <CardHeader
        id="heat-title"
        icon={<CalendarGlyph />}
        title="Study activity"
        action={
          <span className="hidden items-center gap-1.5 text-[10px] text-ink-muted sm:inline-flex" aria-hidden="true">
            Less
            {HEAT_LEVELS.map((l, i) => (
              <span key={l} title={`${l} actions`} className={`inline-block size-2.5 rounded-[3px] ${HEAT_BG[i]}`} />
            ))}
            More
          </span>
        }
      />

      <div className="mt-3 flex flex-1 items-center justify-between gap-6">
        <div className="min-w-0 overflow-x-auto">
          <div
            role="img"
            aria-label={`${studyDays} study days and ${actions} actions in the last ${HEAT_WEEKS} weeks. Busiest weekday: ${busiest}.`}
            className="grid w-max gap-[3px]"
            style={{ gridTemplateColumns: `1.75rem repeat(${HEAT_WEEKS}, 0.75rem)` }}
          >
            <span />
            {weeks.map((_, i) => (
              <span key={i} className="h-3.5 overflow-visible whitespace-nowrap text-[10px] leading-3 text-ink-muted" aria-hidden="true">
                {monthLabel(i)}
              </span>
            ))}
            {WEEKDAY.map((label, row) => (
              <HeatRow key={label} label={label} row={row} weeks={weeks} today={today} />
            ))}
          </div>
        </div>

        <dl className="grid shrink-0 grid-cols-1 gap-1.5 text-right">
          <HeatStat label="Study days" value={String(studyDays)} />
          <HeatStat label="This week" value={String(thisWeek)} />
          <HeatStat label="Busiest" value={busiest} />
        </dl>
      </div>

      {/* The grid is a picture; this is the same information as text. */}
      <table className="sr-only">
        <caption>Study activity by week</caption>
        <thead>
          <tr>
            <th scope="col">Week of</th>
            <th scope="col">Study days</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((col) => (
            <tr key={col[0].date}>
              <th scope="row">{col[0].date}</th>
              <td>{col.filter((c) => c.count > 0).length}</td>
              <td>{col.reduce((n, c) => n + c.count, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function HeatRow({
  label,
  row,
  weeks,
  today,
}: {
  label: string;
  row: number;
  weeks: ReturnType<typeof heatmapWeeks>;
  today: string;
}) {
  return (
    <>
      <span className="self-center text-[10px] leading-none text-ink-muted" aria-hidden="true">
        {row % 2 === 0 ? label : ''}
      </span>
      {weeks.map((col) => {
        const c = col[row];
        return (
          <span
            key={c.date}
            title={
              c.future
                ? undefined
                : `${new Date(c.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}: ${c.count} action${c.count === 1 ? '' : 's'}`
            }
            className={`size-3 rounded-[3px] ${
              c.future ? 'border border-dashed border-line-soft' : HEAT_BG[c.level]
            } ${c.date === today ? 'ring-2 ring-node ring-offset-1 ring-offset-raised' : ''}`}
          />
        );
      })}
    </>
  );
}

function HeatStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="tnum font-display text-base leading-tight text-heading">{value}</dd>
    </div>
  );
}

function CalendarGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
      {[4, 10, 16].flatMap((x) =>
        [4, 10, 16].map((y) => (
          <rect key={`${x}${y}`} x={x} y={y} width="4.5" height="4.5" rx="1.2" opacity={(x + y) % 12 === 8 ? 1 : 0.45} />
        ))
      )}
    </svg>
  );
}

// --- countdown tile -----------------------------------------------------------

/**
 * One split-flap tile. Holds the OUTGOING value itself, so a tile whose number
 * has not changed does not animate.
 */
function FlipTile({ value }: { value: string }) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (value === shown) return;
    // Matches the 400ms total of the two CSS phases.
    const id = setTimeout(() => setShown(value), 400);
    return () => clearTimeout(id);
  }, [value, shown]);

  const flipping = value !== shown;

  return (
    <div className="flip flip-sm h-11 w-10">
      <div className="flip-half flip-half-top">
        <span className="flip-glyph">{value}</span>
      </div>
      <div className="flip-half flip-half-bottom">
        <span className="flip-glyph">{shown}</span>
      </div>
      {flipping && (
        <>
          <div className="flip-half flip-half-top flip-fold-top">
            <span className="flip-glyph">{shown}</span>
          </div>
          <div className="flip-half flip-half-bottom flip-fold-bottom">
            <span className="flip-glyph">{value}</span>
          </div>
        </>
      )}
    </div>
  );
}

// --- TEMPORARY: stage preview -------------------------------------------------

/**
 * Forces the daisy to any of its seven stages so the plates can be reviewed
 * without ticking 1,489 items. Changes nothing that is stored. Folded away
 * below the dashboard so it takes no room on the screen.
 */
function StagePreview({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <details className="px-1 pt-2">
      <summary className="w-fit cursor-pointer text-[11px] text-ink-muted hover:text-accent">
        Preview daisy stages (temporary)
      </summary>
      <div className="mt-2 flex flex-wrap gap-1.5">
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
          aria-pressed={value === null}
          className="pressable rounded-full border border-line-soft px-2.5 py-1 text-[11px] text-ink-muted hover:border-line"
        >
          Live
        </button>
      </div>
    </details>
  );
}

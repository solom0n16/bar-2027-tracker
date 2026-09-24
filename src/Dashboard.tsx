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
import type { Stage } from './lib/daisy';
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
  PlayIcon,
  TargetIcon,
  TrophyIcon,
} from './Icons';
import { CardHeader, LinkButton, PanelBar, count, step, type Lookups, type Syllabus } from './ui';

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

const HEAT_WEEKS = 26;

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
}

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

  const suggestions = suggestItems({
    subjects: data.subjects,
    parts: data.parts,
    itemsByPart: lookups.itemsByPart,
    itemById: lookups.itemById,
    lockStates,
    progress,
    flags,
    focus: pace.week?.focus ?? null,
  });

  const metrics = useMemo(() => {
    const m = new Map<string, { coverage: number; depth: number }>();
    for (const s of data.subjects) {
      const items = lookups.itemsBySubject.get(s.id) ?? [];
      m.set(s.id, { coverage: coverage(items, progress), depth: depth(items, progress) });
    }
    return m;
  }, [data.subjects, lookups, progress]);

  const attention = needsAttention(data.subjects, metrics, flags, lookups.itemById);
  const mastered = useMemo(
    () => Object.values(progress).filter((m) => m === 3).length,
    [progress]
  );
  const milestones = nextMilestones({
    touched: props.touched,
    totalItems: data.items.length,
    mastered,
    weightedCoverage: props.coverage,
    bestStreak: streak.best,
    daysStudied30,
    stage: props.stage,
  });

  // Continue: the last Part you touched, or the first suggestion's Part.
  const last = lastTouchedItem(events);
  const lastItem = last?.itemId ? lookups.itemById.get(last.itemId) : undefined;
  const resumeItem = lastItem ?? suggestions[0]?.item;
  const resumePart = resumeItem ? lookups.partById.get(resumeItem.partId) : undefined;
  const resumeSubject = resumePart ? lookups.subjectById.get(resumePart.subjectId) : undefined;

  return (
    <div className="stagger space-y-5">
      {/* --- header ------------------------------------------------------- */}
      <header className="flex flex-wrap items-end justify-between gap-4" style={step(0)}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            {pace.week
              ? `Week ${pace.week.week} of ${data.calendar.length} · ${pace.week.phase}`
              : 'Bar 2027'}
          </p>
          <h1 className="mt-1 font-display text-3xl leading-tight text-heading">{greeting(now)}.</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {focusSubject
              ? <>This week’s focus is <span className="font-semibold text-ink">{focusSubject.shortName}</span>.</>
              : pace.week?.focus ?? 'Pick up wherever you like.'}
          </p>
        </div>

        {resumePart && resumeSubject && (
          <button
            onClick={() => props.onOpenPart(resumePart.id)}
            className="card card-interactive group flex max-w-md cursor-pointer items-center gap-3 p-3 pr-4 text-left"
          >
            <span className="btn-accent grid size-10 shrink-0 place-items-center rounded-full">
              <PlayIcon />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-accent">
                {lastItem ? 'Continue where you left off' : 'Start here'}
              </span>
              <span className="block truncate text-sm font-semibold text-ink">
                {resumeSubject.shortName} · Part {resumePart.seq}: {resumePart.title}
              </span>
              {last && lastItem && (
                <span className="block text-xs text-ink-muted">
                  Last touched {relativeDay(last.localDate, today)}
                </span>
              )}
            </span>
          </button>
        )}
      </header>

      {/* --- countdown + streak ------------------------------------------- */}
      <div className="grid gap-5 lg:grid-cols-12" style={step(1)}>
        <section
          className="card overflow-hidden p-6 lg:col-span-8"
          style={{ backgroundImage: 'var(--grad-hero)' }}
          aria-label="Countdown to Day 1"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Until Day 1
            </p>
            <p className="text-xs text-ink-muted">
              {new Date(data.exam.days[0] + 'T00:00:00').toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <ExamCountdown target={data.exam.days[0]} />
          <div className="mt-5 border-t border-line-soft pt-4">
            <blockquote className="font-display text-base italic leading-relaxed text-ink">
              “{ANCHOR_VERSE.text}”
            </blockquote>
            <p className="mt-1.5 text-xs font-medium tracking-wide text-accent">
              {ANCHOR_VERSE.ref} · {ANCHOR_VERSE.translation}
            </p>
          </div>
        </section>

        <StreakCard streak={streak} dates={dates} today={today} daysStudied30={daysStudied30} />
      </div>

      {/* --- today + plant ------------------------------------------------ */}
      <div className="grid gap-5 lg:grid-cols-12" style={step(2)}>
        <section className="card p-6 lg:col-span-8" aria-labelledby="today-title">
          <CardHeader
            id="today-title"
            icon={<ClockIcon className="size-5" />}
            title="Today"
            kicker={now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          />
          <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
            <RoutinePanel routine={routine} now={now} onOpen={() => props.go('schedule')} />
            <StudyList
              suggestions={suggestions}
              progress={progress}
              lookups={lookups}
              doneToday={newlyCoveredBetween(events, today, today)}
              onAdvance={props.onAdvance}
              onOpenPart={props.onOpenPart}
            />
          </div>
        </section>

        <section className="card flex flex-col p-6 lg:col-span-4" aria-labelledby="plant-title">
          <CardHeader
            id="plant-title"
            title="Your daisy"
            kicker={`Stage ${props.stage.roman} · ${props.stage.name}`}
            action={<LinkButton onClick={() => props.go('subjects')}>Subjects <ArrowRightIcon /></LinkButton>}
          />
          <div className="mx-auto my-3 w-full max-w-[13rem]">
            <Daisy stage={props.stage} coverage={props.coverage} depth={props.depth} compact />
          </div>
          <div className="mt-auto space-y-2.5">
            <PanelBar label="Seen" value={props.coverage} />
            <PanelBar label="Deep" value={props.depth} muted />
          </div>
          {props.coverage > 0.5 && props.depth < props.coverage / 2 && (
            <p className="mt-3 rounded-tile bg-wash-sage px-3 py-2 text-xs leading-relaxed text-flag">
              Growing faster than it is flowering. Coverage is well ahead of depth.
            </p>
          )}
        </section>
      </div>

      {/* --- heatmap ------------------------------------------------------ */}
      <div style={step(3)}>
        <Heatmap events={events} now={now} today={today} />
      </div>

      {/* --- pace, attention, milestones ---------------------------------- */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" style={step(4)}>
        <PaceCard pace={pace} />

        <section className="card p-6" aria-labelledby="attention-title">
          <CardHeader
            id="attention-title"
            icon={<AlertIcon />}
            title="Needs attention"
            kicker="Where the most grade is still unseen"
          />
          <ul className="mt-4 space-y-2">
            {attention.map((a) => (
              <li key={a.subject.id}>
                <button
                  onClick={() => props.onOpenSubject(a.subject.id)}
                  className="pressable w-full cursor-pointer rounded-tile border border-line-soft p-3 text-left hover:border-line hover:bg-wash-warm"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{a.subject.shortName}</span>
                    <span className="shrink-0 text-[11px] font-semibold text-accent">
                      {Math.round(a.subject.weight * 100)}% of grade
                    </span>
                  </span>
                  <span className="mt-2 block">
                    <PanelBar label="Seen" value={a.coverage} />
                  </span>
                  {a.flagged > 0 && (
                    <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-flag">
                      <FlagIcon filled className="size-3" /> {a.flagged} flagged
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">
            {flags.size === 0
              ? 'No items flagged for review.'
              : `${count(flags.size)} item${flags.size === 1 ? '' : 's'} flagged for review — they lead today’s list.`}
          </p>
        </section>

        <section className="card p-6 md:col-span-2 xl:col-span-1" aria-labelledby="milestones-title">
          <CardHeader id="milestones-title" icon={<TrophyIcon />} title="Next milestones" kicker="Closest first" />
          <ul className="mt-4 space-y-4">
            {milestones.map((m) => {
              const frac = Math.min(1, m.current / m.target);
              return (
                <li key={m.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-ink">{m.label}</span>
                    <span className="tnum shrink-0 text-xs text-ink-muted">
                      {m.unit === '%' ? `${m.current}%` : count(m.current)} / {m.unit === '%' ? `${m.target}%` : count(m.target)}
                    </span>
                  </div>
                  <div
                    className="meter-track mt-1.5 h-2"
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
    </div>
  );
}

function relativeDay(date: string, today: string) {
  if (date === today) return 'today';
  if (date === addDays(today, -1)) return 'yesterday';
  return new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// --- streak -----------------------------------------------------------------

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
  const lastGrace = streak.graceDates[0];

  return (
    <section className="card flex flex-col p-6 lg:col-span-4" aria-labelledby="streak-title">
      <CardHeader
        id="streak-title"
        icon={<FlameIcon />}
        title="Streak"
        kicker="One grace day a week, applied for you"
      />

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-tile bg-wash-sage p-3">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">Current</p>
          {streak.current > 0 ? (
            <p className="tnum mt-1 font-display text-3xl leading-none text-heading">
              {streak.current}
              <span className="ml-1 font-sans text-sm text-ink-muted">day{streak.current === 1 ? '' : 's'}</span>
            </p>
          ) : (
            <p className="mt-1.5 font-display text-lg leading-tight text-heading">
              {broken ? 'Welcome back' : 'Start today'}
            </p>
          )}
        </div>
        <div className="rounded-tile border border-line-soft p-3">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">Last 30 days</p>
          <p className="tnum mt-1 font-display text-3xl leading-none text-heading">
            {daysStudied30}
            <span className="ml-1 font-sans text-sm text-ink-muted">/ 30</span>
          </p>
        </div>
      </div>

      <ol className="mt-5 grid grid-cols-7 gap-1.5" aria-label="This week">
        {week.map((d) => (
          <li key={d.date} className="flex flex-col items-center gap-1.5">
            <span
              title={`${d.label}: ${STATE_LABEL[d.state]}`}
              aria-label={`${d.label}, ${STATE_LABEL[d.state]}`}
              className={`grid size-8 place-items-center rounded-full text-[11px] font-semibold ${DAY_STYLE[d.state]}`}
            >
              {d.state === 'studied' ? <CheckIcon /> : d.state === 'grace' ? 'G' : ''}
            </span>
            <span className={`text-[11px] ${d.date === today ? 'font-semibold text-ink' : 'text-ink-muted'}`}>
              {d.label.slice(0, 2)}
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-auto pt-4 text-xs leading-relaxed text-ink-muted">
        Best: <span className="font-semibold text-ink">{streak.best} day{streak.best === 1 ? '' : 's'}</span>
        {lastGrace && (
          <>
            {' '}· Grace day used{' '}
            {new Date(lastGrace + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}
          </>
        )}
        {!streak.studiedToday && streak.current > 0 && ' · One item today keeps it going'}
      </p>
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

// --- today: routine + study ---------------------------------------------------

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
    <div className="flex flex-col rounded-tile bg-wash-sage p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
        Now · {routine.group === 'weekdays' ? 'Weekday' : 'Weekend'} routine
      </p>
      {b ? (
        <>
          <p className="mt-1.5 font-display text-xl leading-snug text-heading">{b.row.activity}</p>
          <p className="tnum mt-0.5 text-xs text-ink-muted">
            {formatMinutes(b.start)} – {formatMinutes(b.end)}
          </p>
          <div
            className="meter-track mt-3 h-1.5"
            role="progressbar"
            aria-label="Time through this block"
            aria-valuenow={Math.round(elapsed * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="meter-fill" style={{ width: `${elapsed * 100}%` }} />
          </div>
          {b.row.highlight && (
            <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-highlight px-2 py-0.5 text-[11px] font-semibold text-ink">
              Study block
            </span>
          )}
          {b.row.notes && <p className="mt-2 text-xs leading-relaxed text-ink-muted">{b.row.notes}</p>}
        </>
      ) : (
        <p className="mt-1.5 text-sm text-ink">Nothing scheduled right now.</p>
      )}

      <div className="mt-4 border-t border-line-soft pt-3">
        {routine.next ? (
          <p className="text-xs text-ink-muted">
            Up next at <span className="tnum font-semibold text-ink">{formatMinutes(routine.next.start)}</span>
            <span className="mt-0.5 block text-sm font-medium text-ink">{routine.next.row.activity}</span>
          </p>
        ) : (
          <p className="text-xs text-ink-muted">Nothing else on the clock today.</p>
        )}
      </div>

      <div className="mt-auto pt-3">
        <LinkButton onClick={onOpen}>
          Full routine <ArrowRightIcon />
        </LinkButton>
      </div>
    </div>
  );
}

const REASON = {
  flagged: { label: 'Flagged', className: 'text-flag' },
  focus: { label: 'Week focus', className: 'text-accent' },
  next: { label: 'High weight', className: 'text-highlight-ink' },
} as const;

function StudyList({
  suggestions,
  progress,
  lookups,
  doneToday,
  onAdvance,
  onOpenPart,
}: {
  suggestions: Suggestion[];
  progress: ProgressMap;
  lookups: Lookups;
  doneToday: number;
  onAdvance: (id: string) => void;
  onOpenPart: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Study today</p>
        <p className="text-xs text-ink-muted">
          <span className="tnum font-semibold text-ink">{doneToday}</span> new item{doneToday === 1 ? '' : 's'} today
        </p>
      </div>

      {suggestions.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">
          Everything open has been started. Finish a Part to unlock the next one.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-line-soft">
          {suggestions.map(({ item, reason }) => {
            const m = masteryOf(progress, item.id);
            const next = MASTERY_LABELS[Math.min(3, m + 1) as 1 | 2 | 3];
            const subject = lookups.subjectById.get(item.subjectId);
            const r = REASON[reason];
            return (
              <li key={item.id} className="flex items-start gap-3 py-2.5">
                <button
                  onClick={() => onAdvance(item.id)}
                  aria-label={`Mark “${item.text}” as ${next}`}
                  title={`Mark as ${next}`}
                  className="pressable mt-0.5 grid size-7 shrink-0 cursor-pointer place-items-center rounded-full border-2 border-dashed border-line text-transparent hover:border-solid hover:border-accent hover:text-accent"
                >
                  <CheckIcon />
                </button>
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => onOpenPart(item.partId)}
                    className="line-clamp-2 cursor-pointer text-left text-sm leading-snug text-ink hover:text-accent"
                  >
                    {item.text}
                  </button>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
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
      )}
    </div>
  );
}

// --- heatmap ------------------------------------------------------------------

const HEAT_BG = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'] as const;

function Heatmap({ events, now, today }: { events: StudyEvent[]; now: Date; today: string }) {
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
    <section className="card p-6" aria-labelledby="heat-title">
      <CardHeader
        id="heat-title"
        icon={<CalendarGlyph />}
        title="Study activity"
        kicker={`Last ${HEAT_WEEKS} weeks · shows how evenly the work is spread`}
      />

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-start">
        <div className="overflow-x-auto">
          <div
            role="img"
            aria-label={`${studyDays} study days and ${actions} actions in the last ${HEAT_WEEKS} weeks. Busiest weekday: ${busiest}.`}
            className="grid w-max gap-1"
            style={{ gridTemplateColumns: `2rem repeat(${HEAT_WEEKS}, 1.125rem)` }}
          >
            <span />
            {weeks.map((_, i) => (
              <span key={i} className="h-4 overflow-visible whitespace-nowrap text-[10px] leading-4 text-ink-muted" aria-hidden="true">
                {monthLabel(i)}
              </span>
            ))}
            {WEEKDAY.map((label, row) => (
              <HeatRow key={label} label={label} row={row} weeks={weeks} today={today} />
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted" aria-hidden="true">
            <span>Actions per day:</span>
            {HEAT_LEVELS.map((l, i) => (
              <span key={l} className="inline-flex items-center gap-1">
                <span className={`inline-block size-3 rounded-[3px] ${HEAT_BG[i]}`} />
                {l}
              </span>
            ))}
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-3 lg:grid-cols-1">
          <HeatStat label="Study days" value={String(studyDays)} sub={`of ${cells.length}`} />
          <HeatStat label="This week" value={String(thisWeek)} sub="days so far" />
          <HeatStat label="Busiest day" value={busiest} sub={peak > 0 ? `${peak} actions` : 'no activity yet'} />
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
      <span className="text-[10px] leading-none text-ink-muted self-center" aria-hidden="true">
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
            className={`size-[1.125rem] rounded-[4px] ${
              c.future ? 'border border-dashed border-line-soft' : HEAT_BG[c.level]
            } ${c.date === today ? 'ring-2 ring-node ring-offset-1 ring-offset-raised' : ''}`}
          />
        );
      })}
    </>
  );
}

function HeatStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-tile border border-line-soft p-3">
      <dt className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="tnum mt-1 font-display text-2xl leading-none text-heading">{value}</dd>
      <dd className="mt-1 text-[11px] text-ink-muted">{sub}</dd>
    </div>
  );
}

function CalendarGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="currentColor">
      {[4, 10, 16].flatMap((x) =>
        [4, 10, 16].map((y) => (
          <rect key={`${x}${y}`} x={x} y={y} width="4.5" height="4.5" rx="1.2" opacity={(x + y) % 12 === 8 ? 1 : 0.45} />
        ))
      )}
    </svg>
  );
}

// --- pace ---------------------------------------------------------------------

function PaceCard({ pace }: { pace: ReturnType<typeof paceOf> }) {
  const target = pace.weekTarget;
  const frac = target ? Math.min(1, pace.weekDone / target) : 0;
  const expFrac = target && pace.weekExpected !== null ? Math.min(1, pace.weekExpected / target) : 0;
  const behindBy = pace.weekExpected !== null ? Math.max(0, pace.weekExpected - pace.weekDone) : 0;

  const pill =
    pace.status === 'ahead'
      ? { text: 'Ahead of pace', icon: <CheckIcon />, className: 'bg-wash-sage text-success' }
      : pace.status === 'on-track'
        ? { text: 'On pace', icon: <CheckIcon />, className: 'bg-wash-sage text-accent' }
        : pace.status === 'behind'
          ? { text: `${behindBy} behind today’s pace`, icon: <AlertIcon className="size-3.5" />, className: 'bg-sunken/60 text-flag' }
          : { text: 'Review weeks — no item target', icon: null, className: 'bg-sunken/60 text-ink-muted' };

  return (
    <section className="card p-6" aria-labelledby="pace-title">
      <CardHeader
        id="pace-title"
        icon={<TargetIcon />}
        title="This week’s pace"
        kicker={pace.week ? `Week ${pace.week.week} · ${pace.week.phase}` : undefined}
      />

      <div className="mt-5 flex items-end justify-between gap-3">
        <p className="tnum font-display text-4xl leading-none text-heading">
          {pace.weekDone}
          {target !== null && <span className="ml-1 font-sans text-base text-ink-muted">/ {target}</span>}
        </p>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${pill.className}`}>
          {pill.icon}
          {pill.text}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-muted">new items this week</p>

      {target !== null && (
        <div className="relative mt-3">
          <div
            className="meter-track h-2.5"
            role="progressbar"
            aria-label="Weekly target"
            aria-valuenow={Math.round(frac * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="meter-fill" style={{ width: `${frac * 100}%` }} />
          </div>
          {/* Where you should be by the end of today. */}
          <span
            aria-hidden="true"
            className="absolute -top-1 h-4.5 w-0.5 rounded bg-ink"
            style={{ left: `calc(${expFrac * 100}% - 1px)` }}
          />
          <p className="mt-1.5 text-[11px] text-ink-muted">
            Marker: where the week should be by tonight ({pace.weekExpected})
          </p>
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line-soft pt-4">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Needed per day</dt>
          <dd className="tnum mt-1 font-display text-xl text-heading">{pace.perDayNeeded}</dd>
          <dd className="text-[11px] text-ink-muted">to see all before Day 1</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Your last 14 days</dt>
          <dd className="tnum mt-1 font-display text-xl text-heading">{pace.recentPerDay.toFixed(1)}</dd>
          <dd className="text-[11px] text-ink-muted">new items per day</dd>
        </div>
      </dl>
    </section>
  );
}

// --- countdown ----------------------------------------------------------------

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
    <div className="flip h-[3.75rem] w-[3.5rem] sm:h-[5rem] sm:w-[4.75rem]" aria-hidden="true">
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

const COUNTDOWN_UNITS = [
  { key: 'months', label: 'Months' },
  { key: 'weeks', label: 'Weeks' },
  { key: 'days', label: 'Days' },
  { key: 'hours', label: 'Hours' },
  { key: 'minutes', label: 'Minutes' },
  { key: 'seconds', label: 'Seconds' },
] as const;

/** The live countdown. Holds its own one-second tick so the page does not
 *  re-render every second. */
function ExamCountdown({ target }: { target: string }) {
  const at = useMemo(() => localMidnight(target), [target]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = countdownTo(at, now);

  return (
    <div>
      <div className="mt-4 flex flex-wrap items-start justify-center gap-2 sm:gap-3">
        {COUNTDOWN_UNITS.map((u) => (
          <div key={u.key} className="text-center">
            <FlipTile value={String(left[u.key]).padStart(2, '0')} />
            <p className="mt-2 text-[11px] uppercase tracking-wider text-ink-muted">{u.label}</p>
          </div>
        ))}
      </div>
      <p className="sr-only" aria-live="off">
        {left.reached
          ? 'Day 1 has arrived.'
          : `${left.months} months, ${left.weeks} weeks, ${left.days} days, ${left.hours} hours, ${left.minutes} minutes and ${left.seconds} seconds until Day 1.`}
      </p>
    </div>
  );
}

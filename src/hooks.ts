import { useCallback, useEffect, useRef, useState } from 'react';
import { advanceMastery, demoteMastery, masteryOf, type Mastery, type ProgressMap } from './lib/progress';
import { appendEvent, makeEvent, type StudyEvent, type StudyEventType } from './lib/events';
import { defaultSchedule, normalise, type Schedule } from './lib/schedule.ts';

// useTheme() lived here. Dark mode was removed (design.md decision 11,
// amended), so there is no theme to choose, persist, or resolve. The
// bar2027.theme key is deliberately not cleaned up: it is inert, and a
// migration that touches storage is a migration that can lose data.

/** True while the window has been scrolled off the top. Drives the header's
 *  glass treatment, which should only appear once there is content behind it. */
export function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}

/**
 * The current page, kept in the URL hash so each page can be bookmarked and the
 * browser's back button moves between pages instead of leaving the app.
 */
export type Route = 'dashboard' | 'subjects' | 'schedule';

const ROUTES: readonly Route[] = ['dashboard', 'subjects', 'schedule'];

function readRoute(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  return (ROUTES as readonly string[]).includes(h) ? (h as Route) : 'dashboard';
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(readRoute);
  useEffect(() => {
    const onHash = () => {
      setRoute(readRoute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = useCallback((r: Route) => {
    window.location.hash = r === 'dashboard' ? '/' : `/${r}`;
  }, []);
  return { route, go };
}

/** A clock that ticks every `ms`. Minutes are enough for the routine card. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

// ---------------------------------------------------------------------------
// TEMPORARY storage. Milestone 4 replaces this with IndexedDB + an outbox and
// Milestone 10 adds cloud sync (design.md 5.2, 10). localStorage is here only
// so this first build survives a page reload.
//
// The event log lives here too, ahead of its milestone, because history cannot
// be backfilled — see the header of lib/events.ts.
//
// NOTE ON STRUCTURE: every mutation computes its next value from a ref and then
// calls the setters directly, and every StudyEvent is built BEFORE the updater
// runs. React may invoke a state updater twice (StrictMode, and again on
// re-render bailouts), so minting an event id inside an updater would silently
// double-count study activity. Building it outside keeps appendEvent's id
// dedupe meaningful and the updaters pure.
// ---------------------------------------------------------------------------

const PROGRESS_KEY = 'bar2027.progress.v1';
const FLAGS_KEY = 'bar2027.flags.v1';
const OVERRIDES_KEY = 'bar2027.overrides.v1';
const EVENTS_KEY = 'bar2027.events.v1';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — the app stays usable for this session */
  }
}

export function useProgress() {
  const [progress, setProgress] = useState<ProgressMap>(() =>
    readJSON<ProgressMap>(PROGRESS_KEY, {})
  );
  const [flags, setFlags] = useState<Set<string>>(
    () => new Set(readJSON<string[]>(FLAGS_KEY, []))
  );
  const [overrides, setOverrides] = useState<Set<string>>(
    () => new Set(readJSON<string[]>(OVERRIDES_KEY, []))
  );
  const [events, setEvents] = useState<StudyEvent[]>(() =>
    readJSON<StudyEvent[]>(EVENTS_KEY, [])
  );

  // Eagerly-updated mirrors, so two taps in the same tick compose correctly.
  const progressRef = useRef(progress);
  const flagsRef = useRef(flags);
  const overridesRef = useRef(overrides);

  useEffect(() => writeJSON(PROGRESS_KEY, progress), [progress]);
  useEffect(() => writeJSON(FLAGS_KEY, [...flags]), [flags]);
  useEffect(() => writeJSON(OVERRIDES_KEY, [...overrides]), [overrides]);
  useEffect(() => writeJSON(EVENTS_KEY, events), [events]);

  /** Append one event. The event is minted here, not inside the updater. */
  const record = useCallback(
    (
      type: StudyEventType,
      fields: Partial<Pick<StudyEvent, 'itemId' | 'partId' | 'from' | 'to'>> = {}
    ) => {
      const e = makeEvent(type, fields);
      setEvents((log) => appendEvent(log, e));
    },
    []
  );

  // One session_opened per mount. Logged for the record, but deliberately does
  // NOT count as a study day (design.md 8.1 rule 1).
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    record('session_opened');
  }, [record]);

  /** Move an item to an explicit rung, recording the transition. */
  const setMastery = useCallback(
    (itemId: string, to: Mastery) => {
      const prev = progressRef.current;
      const from = masteryOf(prev, itemId);
      if (from === to) return;

      const next = { ...prev };
      if (to === 0) delete next[itemId];
      else next[itemId] = to;

      progressRef.current = next;
      setProgress(next);
      record('mastery_changed', { itemId, from, to });
    },
    [record]
  );

  /** One tap climbs one rung and stops at Mastered — it never wraps to zero. */
  const advance = useCallback(
    (itemId: string) => setMastery(itemId, advanceMastery(masteryOf(progressRef.current, itemId))),
    [setMastery]
  );

  /** Deliberate step back down. A bad mock exam is real information. */
  const demote = useCallback(
    (itemId: string) => setMastery(itemId, demoteMastery(masteryOf(progressRef.current, itemId))),
    [setMastery]
  );

  const toggleFlag = useCallback(
    (itemId: string) => {
      const next = new Set(flagsRef.current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);

      flagsRef.current = next;
      setFlags(next);
      record('flag_toggled', { itemId });
    },
    [record]
  );

  const unlockPart = useCallback(
    (partId: string) => {
      if (overridesRef.current.has(partId)) return;
      const next = new Set(overridesRef.current).add(partId);

      overridesRef.current = next;
      setOverrides(next);
      record('part_unlocked', { partId });
    },
    [record]
  );

  /** Destructive and irreversible: it discards study HISTORY, not just counters.
   *  App.tsx gates this behind an explicit confirmation step. */
  const resetAll = useCallback(() => {
    progressRef.current = {};
    flagsRef.current = new Set();
    overridesRef.current = new Set();
    setProgress({});
    setFlags(new Set());
    setOverrides(new Set());
    setEvents([]);
  }, []);

  return {
    progress,
    flags,
    overrides,
    events,
    setMastery,
    advance,
    demote,
    toggleFlag,
    unlockPart,
    resetAll,
  };
}

// ---------------------------------------------------------------------------
// The study routine. User-owned content, not syllabus data, so it lives beside
// progress in local storage and never touches the event log — a schedule is an
// intention, and the app only counts work that actually happened.
// ---------------------------------------------------------------------------

const SCHEDULE_KEY = 'bar2027.schedule.v1';

export function useSchedule() {
  const [schedule, setSchedule] = useState<Schedule>(() => {
    try {
      const raw = localStorage.getItem(SCHEDULE_KEY);
      // normalise() rather than a bare parse: this value is hand-editable and a
      // half-written one must not take the page down on mount.
      return normalise(raw ? JSON.parse(raw) : null);
    } catch {
      return defaultSchedule();
    }
  });

  useEffect(() => writeJSON(SCHEDULE_KEY, schedule), [schedule]);

  return { schedule, setSchedule };
}

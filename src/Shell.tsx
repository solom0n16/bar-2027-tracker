import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from 'react';
import { useScrolled, type Route } from './hooks';
import type { SearchHit } from './lib/progress';
import { BookIcon, CalendarIcon, CloseIcon, DaisyMark, HomeIcon, SearchIcon } from './Icons';

export interface SearchProps {
  query: string;
  setQuery: (q: string) => void;
  hits: SearchHit[];
  onPick: (h: SearchHit) => void;
}

const NAV: { route: Route; label: string; icon: (active: boolean) => ReactNode }[] = [
  { route: 'dashboard', label: 'Dashboard', icon: () => <HomeIcon className="size-[1.125rem] shrink-0" /> },
  { route: 'subjects', label: 'Subjects', icon: () => <BookIcon className="size-[1.125rem] shrink-0" /> },
  { route: 'schedule', label: 'Schedule', icon: () => <CalendarIcon className="size-[1.125rem] shrink-0" /> },
];

const href = (r: Route) => (r === 'dashboard' ? '#/' : `#/${r}`);

/**
 * The frame around every page.
 *
 * Top: a slim glass bar with the brand and a search that starts as a pill and
 * grows into a field when you reach for it. Bottom: the pages, in a floating
 * dock with a highlight that slides to wherever you are. Content keeps clear of
 * the dock with bottom padding, so nothing is ever hidden behind it.
 */
export default function Shell({
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
        className={`glass sticky top-0 z-30 backdrop-blur-xl backdrop-saturate-150 ${scrolled ? 'glass-scrolled' : ''}`}
      >
        <div className="relative mx-auto flex h-16 w-full max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <a
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              go('dashboard');
            }}
            aria-label="Bar 2027 Study Tracker, go to dashboard"
            className="shrink-0 rounded-xl"
          >
            <Brand />
          </a>
          <div className="absolute inset-y-0 right-4 flex items-center sm:right-6 lg:right-8">
            <ExpandingSearch {...search} />
          </div>
        </div>
      </header>

      <main
        id="main"
        ref={main}
        tabIndex={-1}
        className="mx-auto w-full max-w-7xl px-4 pb-28 pt-4 outline-none sm:px-6 lg:px-8"
      >
        {children}
      </main>

      <Dock route={route} go={go} />
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

// --- the dock -----------------------------------------------------------------

/**
 * Floating page navigation.
 *
 * One highlight pill sits behind the links and is measured against the active
 * one, so changing page slides it across rather than swapping two backgrounds.
 * It is re-measured on resize, and on first paint it is placed without a
 * transition so it does not fly in from the left edge.
 */
function Dock({ route, go }: { route: Route; go: (r: Route) => void }) {
  const links = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  const [ready, setReady] = useState(false);

  const measure = useCallback(() => {
    const el = links.current[route];
    if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth });
  }, [route]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const ro = new ResizeObserver(measure);
    Object.values(links.current).forEach((el) => el && ro.observe(el));
    // Turn transitions on only after the pill has its first position.
    const id = requestAnimationFrame(() => setReady(true));
    return () => {
      ro.disconnect();
      cancelAnimationFrame(id);
    };
  }, [measure]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <nav
        aria-label="Main"
        className="dock pointer-events-auto relative flex items-center gap-1 rounded-full border border-line-soft p-1.5"
      >
        {pill && (
          <span
            aria-hidden="true"
            className={`dock-pill absolute left-0 top-1.5 bottom-1.5 rounded-full ${ready ? 'dock-pill-animate' : ''}`}
            style={{ width: pill.w, transform: `translateX(${pill.x}px)` }}
          />
        )}
        {NAV.map((n) => {
          const active = route === n.route;
          return (
            <a
              key={n.route}
              ref={(el) => {
                links.current[n.route] = el;
              }}
              href={href(n.route)}
              onClick={(e) => {
                e.preventDefault();
                go(n.route);
              }}
              aria-current={active ? 'page' : undefined}
              className={`dock-link relative z-10 flex items-center gap-2 rounded-full px-3.5 py-2.5 text-sm font-medium sm:px-4 ${
                active ? 'text-on-accent' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {/* Keyed on the active state so the icon replays its pop each
                  time its page becomes current. */}
              <span key={active ? 'on' : 'off'} className={`inline-flex ${active ? 'animate-pop' : ''}`}>
                {n.icon(active)}
              </span>
              {/* On phones only the current page keeps its label, so three pages fit
                  and the highlight grows as it arrives. */}
              <span className={active ? '' : 'max-sm:sr-only'}>{n.label}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}

// --- search -------------------------------------------------------------------

/**
 * A search pill that grows into a field.
 *
 * Closed, it is a small labelled button. Clicking it, or pressing "/" or
 * Ctrl/⌘ K anywhere, widens it and puts the cursor in the field. It closes
 * again on Escape or when focus leaves it while empty, so a half-typed query
 * is never thrown away by a stray click.
 */
function ExpandingSearch({ query, setQuery, hits, onPick }: SearchProps) {
  const [expanded, setExpanded] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const open = useCallback(() => setExpanded(true), []);

  // Focus the moment the field exists, before paint, so typing can start
  // straight away while the width transition is still running.
  useLayoutEffect(() => {
    if (expanded) input.current?.focus();
  }, [expanded]);

  const close = useCallback(() => {
    setQuery('');
    setExpanded(false);
  }, [setQuery]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        open();
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        open();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // A click anywhere else closes an empty search too — belt and braces for
  // the blur handler below, which a window without focus never receives.
  useEffect(() => {
    if (!expanded) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current?.contains(e.target as Node)) return;
      if (query.trim() === '') setExpanded(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [expanded, query]);

  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (wrap.current?.contains(e.relatedTarget as Node | null)) return;
    if (query.trim() === '') setExpanded(false);
  };

  const showResults = expanded && query.trim().length >= 2;

  return (
    <div
      ref={wrap}
      onBlur={onBlur}
      className={`search-shell relative h-10 ${expanded ? 'search-open' : 'search-closed'}`}
    >
      {expanded ? (
        <>
          <label className="sr-only" htmlFor="q">
            Search all 1,489 items
          </label>
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-accent" />
          <input
            ref={input}
            id="q"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Escape') return;
              e.preventDefault();
              if (query) setQuery('');
              else {
                close();
                input.current?.blur();
              }
            }}
            placeholder="Search all 1,489 items…"
            className="h-full w-full rounded-full border border-accent/40 bg-raised pl-10 pr-10 text-sm text-ink shadow-e2 outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
          />
          <button
            type="button"
            onClick={close}
            aria-label="Close search"
            className="pressable absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-ink-muted hover:bg-sunken hover:text-ink"
          >
            <CloseIcon className="size-3.5" />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={open}
          aria-expanded={false}
          aria-label="Search all items. Shortcut: slash."
          className="pressable flex h-full w-full cursor-pointer items-center gap-2 rounded-full border border-line-soft bg-raised/80 px-3 text-sm text-ink-muted shadow-e1 hover:border-line hover:text-ink"
        >
          <SearchIcon className="size-4 shrink-0" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="ml-auto hidden rounded-md border border-line-soft bg-surface px-1.5 font-sans text-[11px] leading-5 text-ink-muted sm:inline">
            /
          </kbd>
        </button>
      )}

      {showResults && (
        <div className="card animate-expand absolute right-0 top-full z-10 mt-2 max-h-[70vh] w-full overflow-y-auto p-0 shadow-e3">
          <p className="sticky top-0 border-b border-line-soft bg-raised px-4 py-2.5 text-xs text-ink-muted" aria-live="polite">
            {hits.length === 0
              ? `No matches for “${query.trim()}”. Try a shorter phrase, or a section ref like I.A.1.`
              : `${hits.length} match${hits.length === 1 ? '' : 'es'}`}
          </p>
          {hits.map((h) => (
            <button
              key={h.item.id}
              onClick={() => {
                onPick(h);
                setExpanded(false);
              }}
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

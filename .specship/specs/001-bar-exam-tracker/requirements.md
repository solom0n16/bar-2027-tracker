# Requirements: 2027 Bar Exam Study Tracker

- **Mission:** 001-bar-exam-tracker
- **Date:** 2026-09-21
- **Phase:** PLAN / Step 3 (Contract)
- **Upstream:** `design.md` (approved), `artifacts/market-research.md` (27 sources)
- **Status:** awaiting user review

---

## 0. What this document is for

`design.md` decided *what to build and why*. This document is the **contract**:
the conditions under which the thing is considered correct, and the design
values that are now locked so that twelve milestones cannot quietly drift apart.

Three rules govern everything below.

1. **Every acceptance criterion is verifiable.** If a criterion cannot be
   checked by a unit test, a browser test, or a named tool run, it is not a
   criterion — it is a wish, and it has been rewritten or removed.
2. **Coverage is never allowed to masquerade as mastery.** The single most
   dangerous output of this app is a comforting number. Several criteria exist
   only to prevent that.
3. **The app never punishes honesty.** Demoting an item, missing a day, and
   force-opening a Part are all legitimate. Criteria that touch these behave
   additively.

Section 5 (Design Spec) closes the four questions `design.md` §16 deliberately
left open, and records the palette values `design.md` §18 deferred to here.

---

## 1. Definitions

These terms are used with exactly these meanings throughout. Ambiguity here
becomes arithmetic bugs later.

| Term | Definition |
|---|---|
| **Item** | One of the 1,489 rows of the syllabus. Identity is `{subjectId}:{ref}`, never `ref` alone, because refs repeat across subjects. |
| **Part** | One of the 55 ribbon nodes. The unit of gating. |
| **Mastery** | Integer rung: `0` Not started, `1` Read once, `2` Reviewed, `3` Mastered. |
| **Covered** | An item at `mastery >= 1`. Matches the source workbook's Dashboard footnote. |
| **Coverage** | Fraction of items covered. Answers "what have I seen?" |
| **Depth** | `Σ mastery / (3 × itemCount)`. Answers "what can I answer?" |
| **Weighted** | Either metric summed as `Σ (subjectWeight × subjectMetric)`. |
| **Study day** | A `localDate` carrying at least one *qualifying* event. |
| **Qualifying event** | `mastery_changed`, `flag_toggled`, `note_saved`, `link_added`. Real work. |
| **Non-qualifying event** | `session_opened`, `part_unlocked`. Logged, but cannot make a study day. |
| **localDate** | `YYYY-MM-DD` in the **device's** timezone, stamped at write time. |
| **Grace day** | One missed study day per rolling 7-day window that does not break a streak. |
| **Override** | A Part force-opened out of sequence, recorded as `via: 'override'`. |

---

## 2. Acceptance criteria

Each criterion carries the `design.md` decision it implements, so a future
change can be traced back to a reason rather than guessed at.

### 2.1 Reference data integrity

> The single worst failure available to this project is silent data loss during
> import. These are assertions, not hopes.

| # | Criterion | Verified by | Source |
|---|---|---|---|
| **AC-1** | The importer emits exactly **6 subjects, 55 parts, 1,489 items**, and the build **fails** on any other count. | Unit test on importer output | §5.1 |
| **AC-2** | Per-subject item counts are exactly 263 / 260 / 247 / 200 / 120 / 399 and weights exactly 15 / 20 / 20 / 10 / 10 / 25 %, summing to 1.00. | Unit test | §3 |
| **AC-3** | Item ids are globally unique and subject-scoped; importing a syllabus where `ref` repeats across subjects produces **no** collision. | Unit test with a colliding fixture | §3 |
| **AC-4** | Column D is split on `›` into an ordered `subtopicPath`; an absent value yields `[]`, never `['']`. | Unit test | §3 |
| **AC-5** | No mojibake sequence (`ΓÇô`, `ΓÇ£`, `ΓÇ║`, `Â`, `â€`) appears in shipped data. Retained as a regression guard even though the source is clean UTF-8. | Unit test over the emitted JSON | §3 |
| **AC-6** | The importer imports **zero** progress. Every item starts at `mastery: 0`, including the six demonstration `Completed` cells in the workbook. | Unit test asserting no progress rows | §5.1 |
| **AC-7** | Reference data is bundled and read-only. The app renders the full syllabus with **no** network request to any API. | Browser test with `/api/*` blocked | §4 |
| **AC-8** | The importer is re-runnable and deterministic: two runs on the same workbook produce byte-identical JSON apart from `generatedAt`. | Two-run diff | §5.1 |

### 2.2 Progress and scoring

| # | Criterion | Verified by | Source |
|---|---|---|---|
| **AC-9** | Coverage counts `mastery >= 1` and nothing else. | Unit test | §6 |
| **AC-10** | Depth reaches `1.0` **only** when every item is at `3`. A subject entirely at Read once shows coverage `100%` and depth `33.3%`. | Unit test | §6 |
| **AC-11** | **Coverage and depth are always displayed together.** No screen shows coverage alone. | Browser test asserting both present | §6 |
| **AC-12** | Weighted figures use the workbook weights, so Remedial (25%) moves the needle 2.5× as far as Criminal (10%) for the same item count. | Unit test | §6 |
| **AC-13** | An untouched item has **no** stored progress row. A fresh install stores zero progress records. | Unit test + storage inspection | §5.2 |
| **AC-14** | Empty collections return `0`, never `NaN` or a division error. | Unit test on empty input | — |

### 2.3 The mastery ladder (corrected)

| # | Criterion | Verified by | Source |
|---|---|---|---|
| **AC-15** | The primary tap control **advances one rung and saturates at Mastered**. It never wraps to Not started. Tapping a mastered item is a no-op. | Unit test + browser test | §6, corrected |
| **AC-16** | Demotion is available as a **separate, explicitly labelled control**, and is never the result of one extra tap on the advance control. | Browser test | §6 |
| **AC-17** | Any rung may move to any other rung via `setMastery`. The app never *blocks* a downgrade. | Unit test | §6 |
| **AC-18** | Every mastery change writes one `mastery_changed` event carrying `from` and `to`. A no-op change writes **no** event. | Unit test | §5.3 |

> **Why AC-15 exists.** The M1 build wrapped `3 → 0`, so one stray tap silently
> erased a mastered item and, because achievements are additive, produced a
> dashboard that disagreed with the badge shelf. Design §6's "never block a
> downgrade" is about not forbidding honesty; it was never a licence to make
> destruction the default gesture.

### 2.4 Ribbon and unlock engine

| # | Criterion | Verified by | Source |
|---|---|---|---|
| **AC-19** | All 6 subjects are open at all times. No subject's state can lock any Part of another subject. | Unit test | §7.1 |
| **AC-20** | Part 1 of every subject is always open, on a completely empty progress state. | Unit test | §7.2 |
| **AC-21** | Part N opens **only** when every item in Part N−1 is at `mastery >= 1`. Partial coverage — including one item at `3` and the rest at `0` — does not open it. | Unit test | §7.3 |
| **AC-22** | Any locked Part can be force-opened, is reported as `override` rather than `open`, and stays open permanently thereafter. | Unit test | §7.4 |
| **AC-23** | An overridden Part is **visibly marked** on the ribbon and makes its subject ineligible for `clean_path_{id}`. Nothing else is withheld. | Unit test + browser test | §7.5 |
| **AC-24** | A Part that was overridden and later qualifies naturally reports as `open`. | Unit test | §7 |
| **AC-25** | Parts supplied out of `seq` order produce identical lock states to sorted input. | Unit test | §7.2 |
| **AC-26** | Remedial Part X (Practical Exercises) is reachable via override on day one, without touching the other 389 Remedial items. | Browser test | §7 rationale |
| **AC-27** | Ribbon node state is conveyed by **fill geometry and an icon**, not by colour alone (WCAG 1.4.1). | Manual + axe check | §7, §16 |

### 2.5 Event log and consistency

> This is the part a spreadsheet fundamentally cannot do, and the only part that
> is destroyed by being built late.

| # | Criterion | Verified by | Source |
|---|---|---|---|
| **AC-28** | Every qualifying interaction appends exactly **one** event. React StrictMode double-invocation must not produce two. | Unit test + browser test | §5.3 |
| **AC-29** | Events are append-only. No code path updates or deletes an existing event except an explicit, confirmed full reset. | Code review + unit test | §5.3 |
| **AC-30** | Re-appending a known event id is a **no-op**, so an outbox replay after a failed flush cannot double-count. | Unit test | §10 |
| **AC-31** | Each event stores `localDate` computed on the **device at write time**, not derived from UTC afterwards. | Unit test across a local-midnight boundary | §5.2 |
| **AC-32** | `session_opened` alone **never** creates a study day. Opening the app cannot extend a streak. | Unit test | §8.1 r1 |
| **AC-33** | A day with both a `session_opened` and real work **is** a study day. | Unit test | §8.1 r1 |
| **AC-34** | The dashboard's **primary** consistency figure is *days studied in the last 30*. The consecutive streak is secondary and visually smaller. | Browser test | §8.1 r5 |
| **AC-35** | One missed day per rolling 7-day window does not break a streak, and the grace use is shown honestly ("grace day used Tuesday"). | Unit test on the streak function | §8.1 r2 |
| **AC-36** | A second miss inside the same 7-day window ends the current streak. | Unit test | §8.1 r3 |
| **AC-37** | Best streak is stored permanently and always displayed. A break **never** renders a bare `0`. | Unit test + browser test | §8.1 r4 |
| **AC-38** | The app emits **no** streak-loss notification of any kind, and no loss-aversion copy. | Code review (no notification API call) | §8.1 r7 |
| **AC-39** | Streak, coverage, depth, achievements, and heatmap are **derived** on read. None is stored as a running total. | Code review | §5.2 |

### 2.6 Achievements

| # | Criterion | Verified by | Source |
|---|---|---|---|
| **AC-40** | Achievements are **additive only**. Once unlocked, never revoked, even after a demotion that drops the underlying metric below threshold. | Unit test | §8 |
| **AC-41** | The full achievement set is re-derivable from the event log alone, so a fixed bug can be replayed rather than leaving corrupt history. | Unit test replaying a log | §8 |
| **AC-42** | Every trigger in the §8 table has a test at its boundary (e.g. `items_50` fires at exactly 50, not 49). | Unit test per achievement | §14 |

### 2.7 Encouragement

| # | Criterion | Verified by | Source |
|---|---|---|---|
| **AC-43** | Colossians 3:23 (WEB) is permanently on the dashboard and never rotates. | Browser test | §9.1 |
| **AC-44** | Bundled verses are **World English Bible only**. No NIV, ESV, NLT, NKJV or NASB text ships in the repo. | Manual review of the verse file | §9 |
| **AC-45** | At most **one** struggle verse per day, and **none** on a day an achievement verse already fired. | Unit test | §9 |
| **AC-46** | Verse selection is deterministic for identical state — seeded, never `Math.random()` — so it does not change on re-render. | Unit test calling twice | §9 |
| **AC-47** | Every struggle verse is dismissible. | Browser test | §9.3 |

### 2.8 Notes, links, and input safety

| # | Criterion | Verified by | Source |
|---|---|---|---|
| **AC-48** | Notes and link labels render as **text, never HTML**. A note containing `<img src=x onerror=alert(1)>` displays literally and executes nothing. | Unit test + browser test | §11 |
| **AC-49** | Link URLs are accepted only for `http:` and `https:`. `javascript:`, `data:`, and `file:` are rejected with a visible message. | Unit test | §11 |
| **AC-50** | Deletions are tombstoned (`deletedAt`), never hard-deleted, so a delete propagates instead of being resurrected by the other device. | Unit test | §10 |
| **AC-51** | Note bodies and link labels are length-capped, and the cap is enforced on **both** client and Worker. | Unit test both sides | §11 |

### 2.9 Sync, auth, and offline

| # | Criterion | Verified by | Source |
|---|---|---|---|
| **AC-52** | All writes land in local storage first and the UI returns immediately. Sync **never** blocks input and is never a modal. | Browser test with network throttled | §4, §10 |
| **AC-53** | Push resolution is last-write-wins on `updatedAt`; an older incoming record is rejected and the stored version returned for the client to adopt. | Unit test both directions | §10 |
| **AC-54** | Clients pull deltas by server-assigned `server_seq`, so clock skew between laptop and phone cannot cause a missed or repeated change. | Unit test | §10 |
| **AC-55** | Offline writes queue in an outbox, flush on reconnect, and are **never silently dropped**. An unsyncable outbox surfaces in the UI. | Browser test: offline → change → online | §10, §12 |
| **AC-56** | Sync status is always one of `synced` / `pending (n)` / `offline` / `error` and is always visible. | Browser test | §10 |
| **AC-57** | Every `/api/sync` request is authenticated. There is **no** unauthenticated mutating endpoint. | Integration test per endpoint | §11 |
| **AC-58** | The passcode is ≥12 characters, stored only as a memory-hard KDF hash in a Worker **secret**. No hash and no passcode appears in source, repo, or client bundle. | Code review + secret scan | §11 |
| **AC-59** | The session cookie is `httpOnly`, `Secure`, `SameSite=Strict`, and is unreadable from JavaScript. | Integration test asserting headers | §11 |
| **AC-60** | Login is rate-limited with exponential lockout keyed by IP. | Integration test hammering login | §11 |
| **AC-61** | The Worker validates every payload: `itemId` must exist in reference data, `mastery` must be an integer 0–3. Invalid payloads are rejected, not coerced. | Integration test | §11 |
| **AC-62** | Installed with no signal, the app is fully usable for browse, ladder, flags, notes, links, ribbon, dashboard, achievements, and verses. | Browser test offline | §12 |

### 2.10 Theming, accessibility, and the countdown

| # | Criterion | Verified by | Source |
|---|---|---|---|
| **AC-63** | **No component references a raw hex or a palette-scale token.** Only semantic tokens (`--c-surface`, `--c-ink`, `--c-rung-*`, …). | Grep gate in CI | §16 |
| **AC-64** | **AMENDED (one theme).** The palette passes WCAG 2.2 AA on every text and UI pair, verified by `npm run contrast`, which **exits non-zero** on any failure. Coverage includes both background washes and **both ends** of the accent gradient. | Tool run | §16 |
| **AC-65** | **AMENDED (one theme).** The mastery ladder increases in visual weight with mastery, deepening toward wine. | Tool run + manual | §18 |
| **AC-66** | ~~The resolved theme is applied before first paint.~~ **RETIRED** — there is one theme, so there is no wrong theme to flash. | — | §16 |
| **AC-67** | ~~`theme: 'system'` follows `prefers-color-scheme` live.~~ **RETIRED** with dark mode. | — | §16 |
| **AC-68** | ~~Theme choice is device-local and never sent to the server.~~ **RETIRED** — there is no theme choice to leak. | — | §16 |
| **AC-77** | No page scrolls horizontally at any viewport from **360px to 1024px**. Verified by measuring `scrollWidth` against `clientWidth`, not by eye. | `/_probe.html` | §16, FM-13 |
| **AC-78** | Every entrance, hover, and state transition is **fully neutralised** under `prefers-reduced-motion: reduce`, and nothing is conveyed by motion alone. | CSS review + manual | §5.6, AC-73 |
| **AC-69** | The exam countdown is computed from the **device's local date**. It decrements exactly once per local midnight and is never off by one at UTC+8. | Unit test across local midnight | §5.2, corrected |
| **AC-70** | The coverage cut-off (30 June 2026) is visible on the dashboard, and the app never implies a later cut-off. | Browser test | §1 |
| **AC-71** | Attribution to Atty. Kaye Lucille Marie A. Hugo / KLMAH Law Office, linking `attyhugo.com`, is permanently visible, together with the microsite-controls caveat. | Browser test | §3 |
| **AC-72** | Every interactive control is keyboard reachable with a visible focus indicator in both themes, and carries an accessible name. | axe + keyboard walkthrough | §14 |
| **AC-73** | All motion respects `prefers-reduced-motion`. No animation exceeds 400 ms. | Manual + CSS review | §5.2 |
| **AC-74** | Functional icons are inline SVG with `aria-hidden` plus a text label. **No font glyph or emoji carries meaning on its own.** | Code review | §5 (Design Spec) |
| **AC-75** | Every UI feature ships with its happy, empty, loading, error, and mobile states. | Browser test per feature | §14 guardrail |
| **AC-76** | Any destructive action that discards study history requires explicit confirmation naming what will be lost. | Browser test | §5.3 |

**Total: 78 criteria — 75 live, 3 retired (AC-66, AC-67, AC-68).** Contract
minimum was 15.

> **On numbering.** Retired criteria keep their numbers and new ones are appended
> (AC-77, AC-78) rather than renumbering the set. Renumbering would silently
> invalidate every AC reference in `design.md`, `state.json`, the traceability
> table in §7, and the code comments that cite them — a large, purely cosmetic
> change with a real chance of introducing a wrong cross-reference. A gap in the
> numbering is cheaper than a lie in a citation.

---

## 3. Failure modes

What breaking looks like, and what the app must do instead. Ordered by how much
damage each does to eleven months of work.

| # | Failure | Severity | Required behaviour |
|---|---|---|---|
| **FM-1** | Import silently drops rows; the user studies a syllabus with holes. | **Critical** | Build fails on any count mismatch (AC-1, AC-2). Never ship partial data. |
| **FM-2** | History is lost or never recorded, so streaks, heatmap, and comeback verse are permanently blank for that period. | **Critical** | Log events from the first interaction (AC-28). Recording precedes the engines that consume it. |
| **FM-3** | Device storage cleared with no sync, or sync never configured. | **Critical** | Visible sync status at all times (AC-56). Local data exportable. Never silently rely on one device. |
| **FM-4** | Coverage shown alone reads 100% while everything sits at Read once — a comforting lie weeks before the exam. | **High** | Coverage and depth always shown together (AC-11). |
| **FM-5** | A stray tap demotes a mastered item and the dashboard drops without explanation. | **High** | Advance saturates (AC-15); demotion is a separate control (AC-16). |
| **FM-6** | Streak resets to zero on one bad day; the user abandons the app. Market research identifies this as the most dangerous available mechanic. | **High** | Grace day (AC-35), best streak always shown (AC-37), 30-day window as primary (AC-34), no loss notifications (AC-38). |
| **FM-7** | Building the app becomes the procrastination. | **High** | Four features stay deferred. Milestones ship usable increments. Scope additions require a design.md amendment. |
| **FM-8** | Countdown is off by one, undermining trust in every other number. | **Medium** | Single local-date convention in `lib/dates.ts` (AC-69). |
| **FM-9** | Outbox flush fails repeatedly and changes are lost. | **Medium** | Retry with backoff, never drop, surface the error (AC-55). |
| **FM-10** | Sync retry double-applies events, inflating streaks and achievements. | **Medium** | Client UUID ids, idempotent append (AC-30). |
| **FM-11** | Dark mode "almost works" — one component hard-codes a colour and is unreadable in one theme. | **Medium** | Semantic-token-only rule enforced by a CI grep (AC-63). |
| **FM-12** | Locking frustrates real review; the user fights the app instead of studying. | **Medium** | Subjects always open (AC-19), per-Part override (AC-22), overrides unpunished (AC-23). |
| **FM-13** | 55 ribbon nodes overwhelm on a phone. | **Medium** | Per-subject ribbon, horizontally scrollable; never all 55 at once. |
| **FM-14** | A pasted note executes script, or a link navigates to `javascript:`. | **Medium** | Text-only rendering (AC-48), scheme allowlist (AC-49). |
| **FM-15** | Passcode brute-forced on a public endpoint. | **Medium** | ≥12 chars, memory-hard KDF, rate limit with lockout (AC-58, AC-60). |
| **FM-16** | Gamification becomes noise; verses become wallpaper. | **Low** | Additive achievements, one struggle verse per day max, none on achievement days (AC-45). |
| **FM-17** | Google-hosted fonts unavailable offline, so the installed PWA renders in fallback. | **Low** | Self-host fonts before M11 (tracked gap). |
| **FM-18** | Cloudflare free-tier policy changes. | **Low** | Reference data bundled; user data small and exportable. |

---

## 4. Non-goals

Restated here because scope discipline is the mitigation for FM-7, and a
contract is where scope is enforced.

**Deferred** (schema already accommodates; no migration needed): editable
50-week calendar, weak-spots drill view, study timer / session logging, mock
exam score tracking.

**Out of scope entirely:** multi-user, accounts for others, sharing,
leaderboards, social features, flashcards, spaced-repetition scheduling, AI
question generation, native app-store builds, push notifications.

Anything added to either list requires an amendment to `design.md` first.

---

## 5. Design Spec (locked)

This section closes the four questions `design.md` §16 left open and records the
palette values §18 deferred here. **These values are now normative.** A
component disagreeing with this section is a bug.

### 5.1 Semantic tokens

Derived from the user-supplied sand `#F0DAC5`, navy `#1C2340`, wine `#50223C`,
plus the rose family implied by the reference image's sunset.

> **AMENDED.** Formerly "light mode". There is one theme now (design.md §16) and
> **not one of these values changed** when dark mode was removed — the palette
> was never the thing that read as dull.

| Token | Hex | Role |
|---|---|---|
| `--c-surface` | `#F0DAC5` | Page. The sand itself, warm paper. |
| `--c-raised` | `#FBF4EC` | Cards, floating above the sand. |
| `--c-sunken` | `#E3C8AC` | Progress tracks, wells. |
| `--c-ink` | `#1C2340` | Body text. |
| `--c-ink-muted` | `#4B5170` | Secondary text. |
| `--c-heading` | `#50223C` | Headings, wine. |
| `--c-accent` | `#832A3C` | Claret. Links, accent text. **Amended** from `#93304A` rose-wine — the accent read floral rather than professional. |
| `--c-accent-solid` | `#96324A` | Button fill. **Amended** from `#A83C56`. |
| `--c-on-accent` | `#FFFFFF` | Label on accent fill. |
| `--c-line` | `#8C7358` | Borders. |
| `--c-node` | `#1C2340` | Ribbon node outline. |
| `--c-flag` | `#7E5410` | Needs-review. |
| `--c-success` | `#37604D` | Synced, positive. |
| `--c-error` | `#96323E` | Errors, destructive. |
| `--c-rung-1` | `#EDA3A8` | Read once. |
| `--c-rung-2` | `#C0405E` | Reviewed. |
| `--c-rung-3` | `#50223C` | Mastered — deepens to wine. |

Added with the modern surface (design.md decision 13):

| Token | Hex | Role |
|---|---|---|
| `--c-wash-warm` | `#FDF8F2` | Page wash, top-left corner glow. |
| `--c-wash-rose` | `#FAE3E0` | Page wash, top-right corner glow. |
| `--c-accent-deep` | `#611C2C` | Far end of `--grad-accent`. **Amended** from `#7A2A44`. |
| `--c-line-soft` | `#D9BFA3` | Hairline dividers inside a card. |

> Both washes are **lighter than sand on purpose.** A wash that darkened the page
> would quietly erode every text ratio measured against `--c-surface`, and the
> tool would not catch it because the tool checks tokens, not renders. They are
> also kept small: washes broad enough to fill the viewport drown the sand out,
> and then the cards — which are lighter than sand — have nothing to sit against
> and the page reads flat again, which was the original complaint.

### 5.2 Elevation, gradient, and motion tokens

Dark mode's replacement. Depth used to be carried by having two themes; it is now
carried by these.

| Token | Role |
|---|---|
| `--shadow-e1` … `--shadow-e3` | Elevation ramp. Tinted with the navy ink, **never neutral grey** — a grey shadow on warm sand is the most reliable way to make a warm palette look cheap. |
| `--shadow-accent` | Glow under the primary action. |
| `--shadow-inset` | Meter track well. |
| `--grad-accent` | `--c-accent-solid` → `--c-accent-deep`, 135°. |
| `--grad-meter` | rung 1 → rung 2 → rung 3, 90°. The ladder, drawn as a bar. |
| `--grad-hero` | `--c-raised` → `--c-wash-rose`, 155°. |
| `--ease-out`, `--ease-soft` | The two easings. Nothing else is used. |
| `--dur-1` … `--dur-4` | 150 / 240 / 320 / 400ms. `--dur-4` **is** the §5.6 ceiling. |

Every gradient is composed from the colour tokens rather than from hex, so they
cannot drift out of sync with the palette.

### 5.3 Measured contrast

Measured by `.specship/artifacts/tools/contrast-check.js` (`npm run contrast`).
**All pairs PASS, exit 0.** Representative worst cases, which are the ones that
matter:

| Pair | Ratio | Required |
|---|---|---|
| Body text on page | 11.39:1 | 4.5 |
| Muted text on page | **5.73:1** | 4.5 |
| Muted text on rose wash | 6.32:1 | 4.5 |
| Heading on page | 9.50:1 | 4.5 |
| Accent link on page | 6.58:1 | 4.5 |
| Button label on accent fill | 7.36:1 | 4.5 |
| Button label on accent deep | 12.28:1 | 4.5 |
| Flag text on page | **4.91:1** | 4.5 |
| Border on page | **3.30:1** | 3.0 |
| Accent solid vs page | 5.45:1 | 3.0 |
| Rung 1 vs rung 2 | 2.52:1 | 1.4 |

The tightest margins are `flag text on page` (4.91 against 4.5) and
`accent solid vs page` (4.51 against 3.0, but 4.51 against a 4.5 target if that
fill ever carries text). Any future change to `--c-flag`, `--c-surface`,
`--c-line`, `--c-raised`, or either wash must re-run the tool.

### 5.4 Ribbon illustration treatment — **locked**

Previously open in §16. Decided:

- **Inline SVG**, no raster art and no illustration library. Scales to any
  viewport, themes via `currentColor` and CSS custom properties, costs nothing
  offline.
- **Winding two-row path.** Nodes alternate between `y=34` and `y=96`, spaced
  `74px` on x, radius `21`, joined by cubic Bézier S-curves with the control
  points at the x-midpoint. The eye follows a route, not a list.
- **One subject at a time**, horizontally scrollable (FM-13). Never all 55 nodes
  at once.
- **Four node states, each with distinct geometry** so state is never
  colour-only (AC-27): locked = dashed outline plus padlock; open/untouched =
  solid outline, empty; in progress = quarter fill at rung 1, half fill at
  rung 2; complete = full fill plus tick.
- **Walked path is drawn in `--c-rung-2` over a `--c-sunken` track**, advancing
  only through fully covered Parts. Scrolling back over a walked path is the
  payoff of a long climb.
- **Override marker:** a small `--c-flag` dot at the node's top-right. Visible,
  not punitive.

### 5.5 Icon set — **locked**

Previously open in §16. Decided: **inline SVG paths only, authored in-repo.**

- No icon font, no icon package. An icon font is a network dependency, a FOUT
  risk, and renders inconsistently across Windows, Android, and iOS.
- **No emoji or text glyph may carry meaning on its own** (AC-74). Every icon is
  `aria-hidden="true"` and paired with a text label or `aria-label`.
- Stroke-based, `1.6px` at a 24px grid, `currentColor`, round caps.
- Required set for the shipped scope: padlock, tick, flag, chevron, plus, minus,
  search, sun, moon, cloud-synced, cloud-pending, cloud-offline, warning.

> ~~**Known gap:** the M1 build uses text glyphs (`⚑ ☀ ☾ − ◔ ◑ ●`).~~
> **CLOSED.** Replaced with inline SVG during the modern-surface pass. Shipped:
> search, minus, flag, padlock. The sun and moon are no longer needed (no theme
> toggle); the cloud and warning icons arrive with sync in M10.

### 5.6 Celebration motion — **locked**

Previously open in §16. Decided, and deliberately restrained — the achievement
verse is the reward, not the animation.

- Achievement unlock: one card scale-and-fade, `240ms`, `ease-out`. No confetti,
  no screen-wide particles, no sound.
- Ribbon node reaching complete: fill transition `200ms`.
- Meter changes: width transition `300ms`.
- Hard ceiling **400ms** on any animation (AC-73).
- Under `prefers-reduced-motion: reduce`, all of the above become instant state
  changes. Nothing is conveyed by motion alone.
- One celebration at a time. Simultaneous unlocks queue; they do not stack.

### 5.7 Empty-state copy — **locked**

Previously open in §16. Warm, never cute; it is a gift she is building for
herself, and it is also 1,489 items of hard law.

| Context | Copy |
|---|---|
| No progress at all | "Nothing tracked yet. Political Law, Part I is open — one item is a start." |
| Subject untouched | "Not started. 14 Parts ahead, and only the first one is open." |
| Part fully covered | "Every item here has been read at least once. Part {n+1} is open." |
| Part fully mastered | "All {n} items mastered. This one is done." |
| Search, no matches | "No matches for \"{query}\". Try a shorter phrase, or a section ref like I.A.1." |
| Search, before typing | "Search all 1,489 items — topic, sub-topic, or ref." |
| No flagged items | "Nothing flagged. Flag an item when you want to come back to it." |
| Flags all cleared | "Every flagged item has been faced. Nothing outstanding." |
| No notes on an item | "No notes yet." |
| No links on an item | "No links yet. Add a case, a codal, or a lecture." |
| Locked Part | "Locked. Finish reading Part {n−1} to open it the intended way — or open it now if your review needs it." |
| After an override | "Opened early. This subject is no longer eligible for its clean-path badge — everything else is unchanged." |
| No achievements yet | "No badges yet. The first one is one item away." |
| Streak broken, returning | "Welcome back. Your best run is still {n} days." |
| Offline | "Offline. Everything you do is saved here and will sync when you reconnect." |
| Sync error | "Couldn't sync {n} changes. They're safe on this device. Retrying." |
| Load failure | "Could not load the syllabus. Run `npm run import` to regenerate the data file, then reload." |

### 5.8 Typography and layout

| Property | Value |
|---|---|
| Display / headings | Playfair Display, fallback Georgia → Times New Roman → serif |
| Body | Inter, fallback system-ui → Segoe UI → sans-serif |
| Body line-height | `1.6` — long legal text needs air |
| Card radius | `1rem` (`--radius-card`) |
| Content max width | `48rem` (`max-w-3xl`), centred — **amended** from `32rem`, which left a 512px column stranded in the middle of a desktop window |
| Minimum touch target | `24 × 24 px` with adequate spacing (WCAG 2.5.8); icon buttons ship at `32px` |
| Focus indicator | `2px solid var(--c-accent)`, `2px` offset |

> **Known gap:** fonts currently load from the Google CDN. AC for offline
> (AC-62) cannot pass until they are self-hosted; tracked for M11.

### 5.9 Botanical tokens — the daisy

Referenced by `design.md` §19.6, which pointed here before this section existed.

Ten semantic tokens. Greens widen `--c-success`, golds widen `--c-flag`, so the
family is an extension of the supplied palette rather than a new set of hues.

| Token | Hex | Role |
|---|---|---|
| `--c-ray` | `#FBF4EC` | Open ray floret — one per Part. |
| `--c-ray-edge` | `#C0405E` | The ray's **outline**, which carries its boundary. |
| `--c-disc` | `#E0B15C` | Disc florets at the centre. |
| `--c-disc-edge` | `#7E5410` | Disc outline and inner stipple. |
| `--c-stem` | `#37604D` | The scape. |
| `--c-leaf` | `#4F7D66` | One leaf per subject, sized by exam weight. |
| `--c-leaf-edge` | `#2C4F3E` | Leaf outline and venation. |
| `--c-bud` | `#4F7D66` | Closed involucre — depth still near zero. |
| `--c-bud-edge` | `#2C4F3E` | Bract outlines. |
| `--c-soil` | `#8C7358` | Ground line, stipple, roots. |

**The rule that is specific to this feature:** a ray floret's *outline* is the
checked pair, never its fill. A cream petal on warm sand cannot reach 3:1 and no
adjustment will make it, short of pushing the daisy out of the palette — the same
treatment the mastery rungs already get, where the node border carries the
boundary and the rung fill does not.

**The pair that must never fail:** `closed bud vs open ray`, currently 3.10:1
against a 3.0 target. This is the tightest margin in the whole palette. If it
ever fails, the app has lost its ability to show coverage outrunning depth, which
is the entire argument for §19.

---

## 6. Definition of done

A milestone is complete only when all of the following hold. These are the
project guardrails restated as a gate.

1. `node node_modules/vitest/vitest.mjs run` — all tests pass.
2. `node node_modules/typescript/bin/tsc --noEmit` — clean.
3. `npm run contrast` — both themes all PASS.
4. Every new UI feature has its happy, empty, loading, error, and mobile states
   (AC-75).
5. Browser proof of the real interaction, not a screenshot of a static page.
6. No component references a raw hex or palette-scale token (AC-63).
7. Every acceptance criterion in scope for that milestone is covered by a named
   test.

> **Open blocker on item 5.** Playwright MCP is not configured, so no milestone
> has produced browser proof. Current verification is HTTP 200 + typecheck +
> unit tests, which does **not** satisfy the guardrail. Every AC marked
> "Browser test" above is currently **unverified**. This must be resolved before
> any milestone is called done.

---

## 7. Traceability

| design.md decision | Implementing criteria |
|---|---|
| 1 Single user | Non-goals §4 |
| 2 Cross-device sync | AC-52 … AC-56 |
| 3 Ribbon strictness + override | AC-19 … AC-26 |
| 4 Part-level grain (55 nodes) | AC-1, AC-27, §5.4 |
| 5 Encouragement timing | AC-43 … AC-47 |
| 6 Mastery ladder | AC-9 … AC-18 |
| 7 PWA + sync Worker | AC-7, AC-57 … AC-62 |
| 8 Scope | §4 |
| 9 Grace-day streaks | AC-34 … AC-38 |
| 10 Heatmap + search | AC-31, AC-39 |
| 11 ~~Light and dark first-class~~ → **light only** | AC-63, AC-64, AC-65 (AC-66 … AC-68 retired) |
| 13 Modern register, restrained motion | AC-73, AC-77, AC-78 |

---

## 8. Corrections this contract makes to design.md

Recorded rather than silently applied, so the design document and the contract
do not diverge.

1. **§6 ladder transitions.** Design said transitions are free-form. That stands
   for the *model* (AC-17) but not for the *primary control*: advance now
   saturates at Mastered and demotion is a separate action (AC-15, AC-16). The
   M1 wrap from Mastered to Not started was a destructive default.
2. **§5.2 local dates.** Design required `localDate` on events but the M1
   countdown computed in UTC, reading one day high every morning before 08:00 at
   UTC+8. Both now share one convention in `lib/dates.ts` (AC-69).
3. **§17 milestone order.** Event-log *recording* moves from M7 into the current
   work, because history cannot be backfilled (FM-2). The engines that consume
   the log stay in M7.
4. **§16 open questions closed.** Ribbon treatment, icon set, celebration
   motion, and empty-state copy are locked in §5.4 – §5.7.

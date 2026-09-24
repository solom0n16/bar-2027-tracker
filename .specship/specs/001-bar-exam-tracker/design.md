# Design: 2027 Bar Exam Study Tracker

- **Mission:** 001-bar-exam-tracker
- **Date:** 2026-09-21
- **Phase:** PLAN / Step 1 (Brainstorm) output
- **Status:** awaiting user review

---

## 1. Purpose

A personal, installable web app that replaces the `2027 Bar Exam Study Tracker.xlsx`
spreadsheet for one user preparing for the 2027 Philippine Bar Examinations.

It must do three things the spreadsheet cannot:

1. **Gate progress** — a "ribbon" path where later Parts of a subject open only
   after earlier ones are covered, so the 1,489 items feel like a route rather
   than a wall.
2. **Reward progress** — achievements, streaks, and weighted milestones, so
   11 months of review has feedback loops shorter than 11 months.
3. **Encourage** — Scripture surfaced at meaningful moments, not as decoration.

It is a gift the user is building for herself. That is a design constraint, not a
footnote: the app should feel personal and warm, never like enterprise software.

### Hard dates

| Fact | Value | Source |
|---|---|---|
| Exam days | 5, 8, 12 September 2027 | `Start Here` sheet |
| Coverage cut-off | 30 June 2026 | `Start Here` sheet |
| Format | 20 essay problems per subject | `Start Here` sheet |
| Passing | 75% weighted general average | `Start Here` sheet |
| Days to Day 1 (at design time) | 349 | computed from 2026-09-21 |

Only law, rules, issuances and jurisprudence as of the cut-off are examinable.
The app states the cut-off visibly and never implies otherwise.

---

## 2. Decisions locked during brainstorming

| # | Question | Decision |
|---|---|---|
| 1 | Who uses it | **Single user.** No multi-user features, no sharing, no leaderboards. |
| 2 | Cross-device sync | **Yes, automatic.** Local-first, syncs laptop ↔ mobile. |
| 3 | Ribbon strictness | **Sequential within a subject; all 6 subjects always open.** Plus a manual override per Part. |
| 4 | Ribbon node grain | **Part level — 55 nodes.** Not per-item (1,489 is unusable), not per-subject (6 is meaningless). |
| 5 | Encouragement timing | **Achievement + struggle + season verses.** Colossians 3:23 is a fixed anchor on the dashboard. |
| 6 | Progress model | **Mastery ladder:** Not Started → Read Once → Reviewed → Mastered. Plus an independent `needs_review` flag. |
| 7 | Architecture | **Static installable PWA + thin sync Worker.** Cloudflare Pages + D1. |
| 8 | Scope | Tracker, ribbon, dashboard, achievements, verses, notes, links, week-focus. Four features deferred (§13). |
| 9 | Consistency metric | **Grace-day streaks.** Corrects decision 6's original consecutive-day model — see §8.1. Added after market research. |
| 10 | Added scope | **Distribution heatmap** and **item search.** Added after market research (§8.2, §8.3). |
| 11 | Theming | ~~Light and dark mode, both first-class.~~ **AMENDED: light only.** Palette supplied by the user (§18) and unchanged. See §16. |
| 12 | Overall progress metaphor | **A daisy, seed to bloom.** Stem and rosette grow with coverage; the bloom opens with depth. Replaces the abstract meter pair as the dashboard centrepiece. Added after the M1 review — see §19. |
| 13 | Visual register | **Modern, with restrained motion.** Elevation, gradients, a real type scale, and entrance/hover transitions inside the existing 400ms ceiling. Added after the user judged the M1-era surface dull. |

---

## 3. Source data: what the spreadsheet actually contains

Parsed from all 9 sheets. These numbers are verified, not estimated.

| Seq | Subject | Weight | Items | Parts | Exam slot |
|---|---|---|---|---|---|
| 1 | Political and Public International Law | 15% | 263 | 14 | Day 1 (Sept 5) AM |
| 2 | Commercial and Taxation Laws | 20% | 260 | 7 | Day 1 (Sept 5) PM |
| 3 | Civil Law and Land Titles and Deeds | 20% | 247 | 12 | Day 2 (Sept 8) AM |
| 4 | Labor Law and Social Legislation | 10% | 200 | 8 | Day 2 (Sept 8) PM |
| 5 | Criminal Law | 10% | 120 | 4 | Day 3 (Sept 12) AM |
| 6 | Remedial Law, Legal and Judicial Ethics, with Practical Exercises | 25% | 399 | 10 | Day 3 (Sept 12) PM |
| | **Total** | **100%** | **1,489** | **55** | |

Per-row columns: `Ref` · `Part` · `Topic` · `Sub-topic` · `Item to Study` ·
`Status` · `Notes / Sources`.

Three findings that shaped this design:

**Refs are not globally unique.** `I.A.1` exists in more than one subject.
Item identity must therefore be `{subjectId}:{ref}`, never `ref` alone.

**Sub-topic is a flattened path, not a single value.** Deeper nesting was
collapsed with a `›` separator, e.g.
`1. Standards of Ethical Conduct of Judges and Justices › d. Impartiality (Canon III) › e. Propriety (Canon IV)`.
The importer splits on `›` into an ordered `subtopicPath` array.

**The Notes/Sources column is empty across all 1,489 rows,** and the workbook
contains only two hyperlinks total (the author's site, and the Google Sheets
copy). There is no link library to migrate — links are a feature we build.

**Encoding note (corrected during implementation).** An earlier draft of this
document claimed the source contained Windows-1252 mojibake (`ΓÇô`, `ΓÇ£`,
`ΓÇ║`) needing repair. That was wrong: those sequences were an artefact of the
Windows console re-encoding UTF-8 output, not of the workbook. The `.xlsx` XML
is clean UTF-8 and needs no normalisation. A test still asserts no mojibake
survives into the shipped data, and it passes with no repair step — kept as a
regression guard rather than removed.

### The status-vocabulary conflict (resolved)

The workbook disagrees with itself in three places:

- Dropdown offers: `Not Started` / `In Progress` / `Completed`
- Subject-sheet formula counts: `Read Once`, `Completed`, `Mastered`
- Dashboard footnote says Covered counts: `Read Once`, `Reviewed`, `Mastered`

So the formulas look for values the dropdown cannot produce. The intended
richer vocabulary was never wired up. Decision 6 adopts the intent and makes it
consistent (§6).

### Attribution

The syllabus text and its organisation are the work of
**Atty. Kaye Lucille Marie A. Hugo (KLMAH Law Office)**, published as a free
study aid built from Bar Bulletin No. 1-2027. The app carries a visible,
permanent credit with a link to `attyhugo.com`, and repeats her caveat that the
official Supreme Court microsite controls in case of conflict.

The underlying syllabus is a Philippine government issuance. The app is
private, single-user, and non-commercial. If it were ever published, attribution
must be reviewed with her first — recorded here so the decision is deliberate
rather than forgotten.

---

## 4. Architecture overview

```
   YOUR DEVICE (laptop or phone)
   +-----------------------------------------------------+
   |  Installed PWA  (static files, served from CDN)     |
   |                                                     |
   |  React UI                                           |
   |      |                                              |
   |      v                                              |
   |  Domain engines  (pure functions, no I/O)           |
   |    - unlock engine                                  |
   |    - progress / weighted scoring                    |
   |    - achievement engine                             |
   |    - verse selector                                 |
   |      |                                              |
   |      v                                              |
   |  Local store (IndexedDB)  <-- source of truth for   |
   |    - progress                  the running app      |
   |    - notes, links                                   |
   |    - event log                                      |
   |    - outbox (unsynced changes)                      |
   |      |                                              |
   |  Bundled reference data (read-only JSON)            |
   |    - 1,489 items, 55 parts, 6 subjects              |
   |    - 50-week calendar                               |
   |    - verse library                                  |
   +--------------------|--------------------------------+
                        |  HTTPS, same origin /api/*
                        |  (only when online)
                        v
   CLOUDFLARE
   +-----------------------------------------------------+
   |  Pages        static asset hosting + CDN            |
   |  Worker       ~6 endpoints, auth + sync             |
   |  D1           SQLite: progress, notes, links,       |
   |               events, achievements, unlocks         |
   +-----------------------------------------------------+
```

### Why this shape

**Reference data is immutable, so it does not belong in a database.** The 1,489
items are the published 2027 syllabus with a closed cut-off date. They ship as a
compressed static asset (~250KB raw, ~60KB gzipped). Consequences: the app opens
with full content before any network call; the database holds only user
progress, so it starts at zero rows and never approaches a free-tier limit;
there is no "loading the syllabus" state to design or fail.

**IndexedDB is the source of truth for the running app, not a cache.** Every
interaction writes locally and returns immediately. Sync is a background
reconciliation, never something the user waits on. This is what makes the app
usable in a review centre with bad signal.

**Domain logic is pure functions over plain data.** Unlock rules, weighted
progress, achievement evaluation, and verse selection take state in and return
values out, with no database or network access. They are the highest-risk logic
and the cheapest thing to test exhaustively.

### Stack

| Layer | Choice | Reason |
|---|---|---|
| UI | React + TypeScript | Types matter across 1,489 records and a 4-state ladder |
| Build | Vite 8 | Current stable (released March 2026) |
| Styling | Tailwind CSS v4 | Design tokens; satisfies "no inline styles" |
| Local store | IndexedDB via a thin typed wrapper | Handles thousands of records; survives restarts |
| PWA | Service worker (Workbox via Vite plugin) | Installable, offline |
| API | Cloudflare Worker at `/api/*` | Same origin → httpOnly cookies possible |
| Database | Cloudflare D1 (SQLite) | Free at this scale; **no inactivity pausing** |
| Hosting | Cloudflare Pages | Unmetered bandwidth on free tier |
| Unit tests | Vitest | Fast; suits pure domain functions |
| Browser tests | Playwright | Real interaction flows, required before "done" |

Exact patch versions are pinned at scaffold time and recorded in
`package.json`. Cloudflare was chosen over Supabase specifically because
Supabase free projects pause after 7 days idle and then cold-start for 10–30
seconds — a near-certainty during an 11-month review with holidays in it.

---

## 5. Data model

### 5.1 Reference data (bundled, read-only, never written)

```ts
type Subject = {
  id: string            // "political" | "commercial-tax" | ...
  seq: 1|2|3|4|5|6
  name: string
  shortName: string     // "Political Law"
  weight: number        // 0.15
  examDay: 1|2|3
  examDate: string      // "2027-09-05"
  examSlot: 'AM'|'PM'
  partIds: string[]     // ordered
  itemCount: number
}

type Part = {
  id: string            // "political-01"
  subjectId: string
  seq: number           // 1-based, defines ribbon order
  title: string         // "I. BASIC CONCEPTS"
  itemIds: string[]     // ordered
  itemCount: number
}

type Item = {
  id: string            // "political:I.A.1"  (subject-scoped, see §3)
  ref: string           // "I.A.1"
  subjectId: string
  partId: string
  topic: string         // column C
  subtopicPath: string[]// column D split on "›"; [] when absent
  text: string          // column E, the thing to study
  seq: number           // original row order
}
```

Generated at build time by an importer that reads the `.xlsx` and emits JSON.
The importer is committed and re-runnable, so a corrected spreadsheet can be
re-imported without hand-editing data.

**Importer correctness gate:** the import fails the build unless it produces
exactly 6 subjects, 55 parts, and 1,489 items, with per-subject counts matching
the table in §3. Silent data loss during import is the single worst failure
available to this project, so it is asserted rather than trusted.

**The importer reads reference data only and imports no progress.** The
workbook's Status column currently holds `Completed` on exactly one item per
subject — the first data row of each sheet, six in total. These are demonstration
values left in to show the dropdown working, not real study history, and
importing them would start the user at a false 0.4%. The app begins with every
item at Not Started. If any of those six represent genuine progress, they take
one tap each to restore.

### 5.2 User data (IndexedDB locally, D1 remotely, same shape)

```ts
type Mastery = 0 | 1 | 2 | 3
// 0 Not Started · 1 Read Once · 2 Reviewed · 3 Mastered

type Progress = {
  itemId: string        // PK
  mastery: Mastery
  needsReview: boolean
  updatedAt: number     // epoch ms, client clock
}

type Note = {
  itemId: string        // PK
  body: string
  updatedAt: number
}

type Link = {
  id: string            // client UUID
  itemId: string
  label: string
  url: string
  createdAt: number
  updatedAt: number
  deletedAt: number | null   // tombstone, for sync
}

type PartUnlock = {
  partId: string        // PK
  unlockedAt: number
  via: 'sequential' | 'override'
}

type StudyEvent = {
  id: string            // client UUID — append-only, never updated
  type: 'mastery_changed' | 'flag_toggled' | 'note_saved'
       | 'link_added' | 'part_unlocked' | 'session_opened'
  itemId?: string
  partId?: string
  from?: Mastery
  to?: Mastery
  occurredAt: number
  localDate: string     // "2026-09-21" in device timezone — streaks need this
}

type Achievement = {
  id: string            // PK, e.g. "streak_7"
  unlockedAt: number
}

// Device-local only, still deliberately NOT synced.
// AMENDED (§16): `theme` is removed — there is one theme.
type DeviceSettings = {
  reducedMotion: boolean | null        // null = follow OS
  lastSeenServerSeq: number
}
```

Streaks, coverage, depth, achievements, and the heatmap are all **derived** from
`StudyEvent` and `Progress`. None of them is stored as a running total, so a bug
in the arithmetic is fixed by shipping a corrected function rather than by
repairing corrupted counters.

Rows are created lazily. An untouched item has **no** Progress row; absent means
`mastery: 0, needsReview: false`. Storage therefore starts empty and grows only
with real activity.

### 5.3 Why there is an event log

Current state cannot answer the questions the achievements and verses need.
"Seven days in a row" and "came back after four days away" are properties of
*history*, not of a status column. A spreadsheet fundamentally cannot do this,
and retrofitting history later would mean the first months of review have none.

`localDate` is stored per event, computed on the device at write time.
Streaks are day-boundary-sensitive, and deriving a local date from a UTC
timestamp later is a known source of off-by-one-day bugs.

Volume estimate: roughly 1,489 items × 3 ladder steps, plus flags, notes, and
session opens — on the order of 6,000–8,000 events over 11 months. Trivial for
both IndexedDB and D1.

---

## 6. Progress and weighted scoring

Two distinct numbers, because they answer different questions.

**Coverage** — how much have I touched at least once?

```
subjectCoverage(s) = count(items in s with mastery >= 1) / itemCount(s)
weightedCoverage   = Σ over subjects ( weight(s) × subjectCoverage(s) )
```

This reproduces the spreadsheet's intent exactly: the Dashboard footnote defines
Covered as Read Once, Reviewed, or Mastered — that is `mastery >= 1`.

**Mastery depth** — how well do I actually know it?

```
subjectDepth(s)  = Σ mastery(i) for items in s / (3 × itemCount(s))
weightedDepth    = Σ over subjects ( weight(s) × subjectDepth(s) )
```

Both are shown. Coverage tells you what you have seen; depth tells you what you
can answer. Showing only coverage would let the app claim 100% while every item
sits at Read Once — a comforting lie three weeks before the exam, and precisely
the failure a single Completed flag produces.

Ladder transitions are free-form: any mastery value can move to any other. The
user may demote an item after a bad mock exam. The app never blocks a downgrade,
and a downgrade is a legitimate event that can retrigger encouragement.

---

## 7. The unlock engine (the ribbon)

Pure function. Input: reference data + progress + override records. Output: the
lock state of all 55 Parts.

### Rules

1. **All 6 subjects are always open.** Review follows lectures and mock exams,
   not a fixed line. An app that locks Civil Law because Political is unfinished
   fights the user's actual studying.
2. **Within a subject, Parts are ordered by `seq`. Part 1 is always open.**
3. **Part N opens when Part N−1 is covered** — every item in Part N−1 at
   `mastery >= 1`. Requiring Mastered would stall the path for months;
   Read Once is exactly what a first pass produces. A percentage threshold was
   rejected as arbitrary.
4. **Override:** any locked Part can be force-opened, recorded as
   `via: 'override'`. It stays open permanently.
5. **Overrides are visible, not punished.** An overridden Part is marked on the
   ribbon and makes the subject ineligible for its `clean_path` achievement.
   Nothing is taken away and nothing is hidden.

Rule 4 exists for a concrete reason: **Remedial Part X is Practical Exercises** —
drafting a demand letter, an SPA, a judicial affidavit. Those are motor skills
needing months of repetition. Under strict sequencing they would be unreachable
until 389 other Remedial items were done, which is far too late to start
practising drafting.

### Ribbon presentation

55 nodes, grouped by subject, each rendering one of four states derived from the
average mastery of its items: locked · open · in progress · complete. Because the
ladder has four rungs, nodes deepen in colour progressively rather than flipping
from grey to done — the visual satisfaction is a property of the data model, not
an animation bolted on later.

---

## 8. Achievement engine

Pure function: `(events, progress, reference) → unlocked achievement ids`.
Re-derivable from the log at any time, so a bug can be fixed and history
replayed rather than lost.

| id | Name | Trigger |
|---|---|---|
| `first_step` | First Step | any item reaches Read Once |
| `first_part` | Opening Statement | any Part fully covered |
| `items_50` … `items_1489` | Milestones at 50/100/250/500/1000/1489 | items at `mastery >= 1` |
| `first_mastered` | Locked In | any item reaches Mastered |
| `part_mastered` | Deep Work | all items in a Part at Mastered |
| `subject_covered_{id}` | ×6, one per subject | subject 100% covered |
| `subject_mastered_{id}` | ×6, one per subject | subject 100% Mastered |
| `weighted_25/50/75/100` | Quarter/Half/Three-Quarters/Full Coverage | `weightedCoverage` crosses threshold |
| `streak_3/7/14/30/60/100` | Streaks | grace-adjusted streak length reaches threshold (§8.1) |
| `steady_20_of_30` | Steady Hand | 20 distinct study days within any rolling 30 |
| `clean_path_{id}` | ×6 | subject fully covered with zero overrides |
| `comeback` | Welcome Back | activity after ≥3 days silent |
| `practical_all` | Ready to Draft | all 10 Practical Exercises at `mastery >= 1` |
| `second_pass` | Second Look | 100 items reach Reviewed |
| `weak_spots_cleared` | Faced It | 25 items that were once flagged `needsReview` have since reached `mastery: 3` and had the flag cleared |

Achievements are **additive only** — once unlocked, never revoked, even if
progress is later demoted. Taking a badge back because you honestly downgraded an
item after a bad mock would punish exactly the behaviour the app wants.

### 8.1 Streak model (grace-first)

Market research found consecutive-day streaks to be the most dangerous mechanic
available here: the binary reset destroys the identity the streak built and
frequently causes users to abandon the product outright, and grace/freeze
mechanics measurably sustain streaks far longer. Full sourcing is in
`artifacts/market-research.md`. Over an eleven-month review with guaranteed bad
weeks, a hard reset would actively work against the app's purpose.

**Rules:**

1. A **study day** is any `localDate` with ≥1 qualifying event. Qualifying events
   are `mastery_changed`, `flag_toggled`, `note_saved`, `link_added` — real work.
   `session_opened` alone does **not** count, so merely opening the app cannot
   extend a streak.
2. **One grace day per rolling 7-day window** does not break the streak. Applied
   automatically, never purchased, and shown honestly ("grace day used Tuesday").
3. A second miss inside the same window ends the current streak.
4. **Best streak is stored permanently** and always displayed. A break never
   renders a bare zero.
5. The dashboard's **primary** consistency figure is **days studied in the last
   30** — a number no single bad day can destroy. The consecutive streak is a
   smaller secondary stat.
6. On a genuine break, the next visit shows a soft landing: "welcome back", the
   `comeback` verse, and the best streak. Never a reset counter.
7. **No streak-loss notifications, ever.** No loss-aversion pressure of any kind.

Streak computation is a pure function over the sorted set of distinct study
dates, so grace-window edge cases are unit-testable in isolation.

### 8.2 Distribution heatmap

A calendar grid of study days, each cell shaded by event volume, filterable by
subject. Added because revision fails on *distribution* rather than effort —
hours get done but bunched into the wrong week, which with six weighted subjects
is the whole problem.

Derived entirely from `StudyEvent.localDate`; no new storage. It is also the
honest companion to the streak: it shows the shape of eleven months rather than a
single fragile number.

### 8.3 Item search

Client-side substring search across all 1,489 items, matching item text, ref,
topic, and part title. Results show the full breadcrumb so the hit is locatable in
the hierarchy, and jumping to a result does not require the containing Part to be
unlocked (finding is not studying).

Runs against bundled reference data, so it needs no server, no index, and works
offline. Added because locating a topic a lecture just mentioned — "operative fact
doctrine" — by scrolling four levels of hierarchy is unreasonable.

---

## 9. Encouragement engine (verses)

Verse library ships as bundled JSON: `{ ref, text, translation, tags[] }`.
Translation is **World English Bible** — public domain, modern English, safe to
redistribute. NIV, ESV, NLT, NKJV and NASB are copyrighted and are deliberately
not bundled. The user can add her own verses in any translation; those are
personal notes, stored in her own data, never shipped in the codebase.

### Four channels

**1. Anchor (fixed).** Colossians 3:23 (WEB) — *"And whatever you do, work
heartily, as for the Lord, and not for men"* — permanently on the dashboard.
Never rotates. It reframes 1,489 items as work offered rather than a burden.

**2. Achievement verses.** Each achievement carries a verse shown in its unlock
moment, so the reward is encouragement rather than a number.

**3. Struggle verses.** The channel a spreadsheet can never provide. Evaluated
once per day, at most one shown, dismissible:

| Condition | Tag |
|---|---|
| ≥3 days since last activity | `comeback` |
| flagged `needsReview` items in current subject > 15 | `perseverance` |
| behind the week's target by > 30% | `grace` |
| ≥5 items demoted in the last 7 days | `endurance` |
| within 30 days of Day 1 | `courage` |

**4. Season verses.** One per calendar phase band (First pass early / First pass
late / Second pass / Pre-week), shown in the week-focus card. Week 3 and
Week 47 are different kinds of hard.

Selection is deterministic given the same state — a seeded choice from the
matching tag pool, not `Math.random()` — so it is testable, and so a verse does
not change on every re-render.

Rate limiting is deliberate: at most one struggle verse per day, and none on a
day when an achievement verse already fired. A verse that appears constantly
becomes wallpaper, which is the failure mode this design exists to avoid.

---

## 10. Sync protocol

Single user, so conflicts are rare and shallow — the same person cannot
meaningfully edit the same item on two devices at once. Last-write-wins per
record is sufficient, and pretending otherwise would add machinery with no payoff.

### Endpoints (`/api/*`, same origin)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/login` | passcode → sets httpOnly session cookie |
| POST | `/api/auth/logout` | clears cookie |
| GET | `/api/auth/session` | is this session valid? |
| GET | `/api/sync?since=<seq>` | changes after a server sequence number |
| POST | `/api/sync` | push a batch of local changes |
| GET | `/api/health` | liveness |

### Mechanics

Each D1 row carries a monotonic `server_seq` assigned on write. Clients persist
the highest `server_seq` seen and pull deltas from there — a server-assigned
counter, so clock skew between laptop and phone cannot cause missed or repeated
changes.

Push resolution per record: apply when incoming `updatedAt` is newer than
stored, otherwise reject and return the stored version for the client to adopt.

`StudyEvent` rows are append-only with client-generated UUID primary keys, so
they merge without conflict and are idempotent on retry.

Deletions use tombstones (`deletedAt`), never hard deletes, so a delete on the
phone propagates to the laptop instead of the laptop resurrecting the row.

### Offline queue

Writes go to IndexedDB and append to an outbox. A flush runs on reconnect, on
app focus, and on a timer, sending batches and advancing `server_seq`. Failed
flushes retry with backoff and are never dropped silently — an unsyncable
outbox surfaces in the UI.

### Sync states in the UI

`synced` · `pending (n changes)` · `offline` · `error`. Sync is never a modal
and never blocks input. The user must always be able to tell whether her work is
safe, without having to think about it.

---

## 11. Authentication and security

The sync API is on the public internet and its address is discoverable. It gets
real authentication.

- **Passcode**, minimum 12 characters, hashed with a memory-hard KDF
  (Argon2id, or bcrypt if the Worker runtime constrains it). The hash lives in a
  Cloudflare Worker **secret**, never in source, never in the repo.
- **Session cookie:** `httpOnly`, `Secure`, `SameSite=Strict`. Because the API is
  same-origin under `/api/*`, the token is unreadable by JavaScript — a
  cross-site scripting bug cannot exfiltrate the session. This is the reason for
  the same-origin choice.
- **Rate limiting** on login: a low-entropy passcode needs brute-force
  protection. Counter keyed by IP with exponential lockout.
- **HTTPS only**, enforced by Cloudflare.
- Every `/api/sync` request is authenticated; there are no unauthenticated
  mutating endpoints.
- Input validation on all payloads: `itemId` must exist in reference data,
  `mastery` must be 0–3, link URLs must be `http(s)` (blocking `javascript:`),
  note and label lengths capped.
- Notes and labels are rendered as text, never as HTML.

**Honest scope of the risk.** What is behind this login is study progress and
study notes. No name, no email, no payment details, no client confidences.
A breach would be an annoyance, not a catastrophe. The protections above are
proportionate to that — solid, standard practice, not a threat model for a bank.

This design has not had an independent security review. The SpecShip VALIDATE
phase runs one before ship.

---

## 12. Offline behaviour

| Situation | Behaviour |
|---|---|
| First visit, online | App loads, syllabus available immediately from bundle |
| Installed, no signal | Fully usable: browse, ladder, flags, notes, links, ribbon, dashboard, achievements, verses |
| No signal, writes made | Queued in outbox; UI shows `pending (n)` |
| Signal returns | Automatic flush; status returns to `synced` |
| Sync fails repeatedly | Visible error with retry; data remains safe locally |
| Second device, first sync | Pulls full history from `server_seq` 0 |

Everything except cross-device sync works offline, because everything except
sync is local by construction.

---

## 13. Deferred (in the schema now, built after first use)

| Feature | Why deferred |
|---|---|
| Editable 50-week calendar | Large UI. Read-only week-focus delivers the value now; reshuffling needs habits that do not exist yet. |
| Weak-spots drill view | Needs a real corpus of flagged items to be designed against. |
| Study timer / session logging | Session shape unknown — 25-minute pomodoros vs 3-hour blocks changes the design. |
| Mock exam score tracking | Calendar puts mocks in weeks 47–50, roughly July–August 2027. Building it now means guessing ten months early. |

All four are accommodated by the data model above (the event log absorbs
sessions and timers; links and notes generalise). None requires a migration.

### Explicitly out of scope

Multi-user, accounts for others, sharing, leaderboards, social features, flashcards,
spaced-repetition scheduling, AI question generation, native app store builds,
push notifications.

---

## 14. Testing strategy

The four domain engines are pure functions and carry the real risk, so they get
exhaustive unit coverage: unlock rules (including override interactions),
weighted coverage and depth arithmetic, every achievement trigger and its
boundary, verse selection determinism and rate limits.

The importer gets assertion tests on exact counts (6 / 55 / 1,489), ref-collision
handling, `›` path splitting, and mojibake normalisation.

Sync gets merge tests: newer-wins, older-rejected, tombstone propagation, event
idempotency on retry, `server_seq` advancement, and an offline-then-reconnect
round trip.

Browser tests (Playwright) cover real sequences, not screenshots: change a
mastery level and confirm the dashboard and ribbon both move; add and open a
link; write a note and confirm it survives reload; force-unlock a Part and
confirm the clean-path achievement becomes ineligible; go offline, make changes,
come back online, confirm they land.

Per the project guardrails, no UI feature is complete without its happy, empty,
loading, error, and mobile states, and nothing ships without browser proof.

---

## 15. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Data loss during import | High | Build-time count assertions (§5.1) |
| Offline sync edge cases | Medium | Local store is truth; outbox never drops; explicit merge tests |
| Building the app becomes procrastination | **High** | Scope cut to one usable release; four features deferred |
| Locking frustrates real review | Medium | Subjects always open + per-Part override |
| Device storage cleared | Medium | Cloud sync is the backup; visible sync status |
| Ribbon of 55 nodes overwhelms on mobile | Medium | Per-subject ribbon view, not all 55 at once |
| Gamification becomes noise | Low | Achievements additive only; verses rate-limited |
| Cloudflare free-tier policy change | Low | Reference data is bundled; user data is small and exportable |

The procrastination risk is rated High deliberately. The exam is 349 days away,
and a tracker app is a comfortable way to avoid Political Law. Scope discipline
is a feature of this design, not a limitation of it.

---

## 16. Theming architecture

> **AMENDED.** This section originally specified light and dark mode as equally
> first-class. Dark mode was removed at the user's request after the M1-era
> surface was judged dull; the diagnosis was that the flatness lived in the
> execution, not in the colours. The palette in §18 is therefore **unchanged**,
> and the effort that would have gone into maintaining a second theme went into
> elevation, gradients, type scale, and motion instead (decision 13).
>
> What this cost, recorded so it is not rediscovered later: AC-66 (no flash of
> the wrong theme), AC-67 (live `prefers-color-scheme` following), and AC-68
> (theme never sent to the server) are retired. AC-63 and AC-64 survive in
> amended form. `useTheme()`, the pre-paint resolver in `index.html`, and the
> `[data-theme='dark']` block are all deleted.

**One theme.** Light only. There is no theme state, no toggle, no resolution
order, and no flash of the wrong theme to prevent.

**Mechanism.** All colour is expressed as **semantic** CSS custom properties
(`--c-surface`, `--c-raised`, `--c-ink`, `--c-ink-muted`, `--c-accent`,
`--c-rung-1..3`, `--c-flag`, `--c-success`, `--c-error`, `--c-line`), defined
once and consumed through Tailwind tokens. Components reference semantic tokens
only.

**The hard rule survives, and matters for a different reason.** No component may
reference a raw colour or a palette-scale token. The original justification —
"it will be wrong in one of the two themes" — no longer applies, but the rule
does: a hard-coded hex is a colour that no longer answers to the palette, cannot
be re-tuned in one place, and is invisible to `npm run contrast`. A single theme
makes the rule easier to break and no less important.

**Contrast.** The one theme is verified against WCAG 2.2 AA by
`npm run contrast`, which exits non-zero on any failure. The check now also
covers the two background washes (text lands on them) and both ends of the
accent gradient (a gradient button is only as legible as its worst end).

**Motion.** Elevation and transition are how the surface carries depth now that
it is not carrying a second theme. The 400ms ceiling from `requirements.md` §5.6
is unchanged, and everything remains fully neutralised under
`prefers-reduced-motion` (AC-73).

### What is still not decided here

~~Ribbon illustration treatment, icon set, celebration animation specifics, and
empty-state copy~~ — **all four are now settled** in `requirements.md` (Design
Spec) §5.4 – §5.7, during the contract phase. The daisy that became the dashboard
centrepiece is §19 of this document, with its tokens in `requirements.md` §5.9.

---

## 17. Milestone sketch

Refined into `tasks.md` by the planning step. Indicative shape only.

1. Scaffold, importer, **theme tokens**, and verify it runs in a browser
2. Design system, shared component library, **and the daisy (§19)**
3. Layout shell and responsive navigation
4. Syllabus browsing, the mastery ladder, and item search (local only)
5. Ribbon and unlock engine
6. Dashboard, weighted scoring, week focus, distribution heatmap
7. Event log, streak model, achievement engine
8. Encouragement engine
9. Notes and typed links
10. Sync API, auth, offline queue
11. PWA install and offline hardening
12. Accessibility, contrast verification, polish

Reference data is bundled, so milestones 1–9 need no backend at all. Sync
arrives late on purpose: the app is genuinely useful on one device before any
server exists, which keeps the highest-risk component from blocking everything
in front of it.

Theme tokens land in milestone 1, before any component exists. No milestone is
permitted to defer its contrast verification to milestone 12.

---

## 18. Palette (user-supplied)

Three colours provided by the user, read from a dusk/twilight reference image.
They are the source of truth; everything else is derived.

| Colour | Hex | Character |
|---|---|---|
| Sand | `#F0DAC5` | warm, light, calm |
| Navy | `#1C2340` | deep, structural |
| Wine | `#50223C` | deep, feminine, rich |

The reference image's sunset supplies an implied fourth family — **rose** —
derived as the bridge between sand and wine.

### Role assignment

| Role | Value |
|---|---|
| Page surface | sand, with two lighter corner washes |
| Raised surface (cards) | near-white, lifted off the sand by tinted elevation |
| Primary text | navy |
| Headings | wine |
| Accent / primary action | rose, darkened for contrast; gradient to a deeper wine |
| Mastery rungs 1→3 | rose light → rose → **wine** |

The ladder deepens toward wine, so visual weight increases with mastery. That
property is what must hold, and with one theme there is only one direction for
it to hold in.

> **AMENDED with §16.** The dark-mode column is gone. Its one non-obvious
> requirement — that dark mode was never a literal inversion, because on a dark
> surface "more mastered" has to read *brighter* — is recorded here only so the
> reasoning survives if a second theme is ever reconsidered.

Exact hex values for every token, plus measured contrast ratios for every text
and UI pair, are specified in `requirements.md` (Design Spec) and verified by
`npm run contrast` during build.

### Why this palette suits the app

Sand, wine, and navy read as dusk, which fits a year of evening study better than
a pink palette would, and it satisfies the "feminine but not childish" register
directly: warmth from the sand, femininity from the wine, and authority from the
navy. It also solves the contrast problem the research identified — the two dark
anchors are genuinely dark, so body text has real contrast rather than pastel-on-
pastel, while the surfaces stay warm.

---

## 19. The daisy: overall progress as a life cycle

Decision 12. Added after the user reviewed the M1 build and judged the interface
to be functional but artless — "no art in it, no creativity behind it." That is a
fair reading of M1, which was a token-correct skeleton built to prove the data
worked. This section supplies the missing centrepiece.

### 19.1 Why a plant, and not a nicer progress bar

The app carries **two** numbers that must never be confused: coverage (what has
been seen) and depth (what can actually be answered). §6 shows them side by side
and §14 tests them, but two bars sitting next to each other do not make their
*divergence* felt. The most dangerous state this app can be in — every item read
once, nothing mastered — renders as a nearly-full bar.

A plant separates the two onto different anatomy:

| Metric | Anatomy | Reads as |
|---|---|---|
| **Coverage** | Stem height, leaf count, rosette size | How much has grown |
| **Depth** | Bloom — bud, first rays, full flower | Whether it flowered |

So "100% covered, 33% depth" draws a tall, healthy, fully-leafed plant whose bud
never opened. The failure becomes visible instead of reassuring. That is the
whole argument for this section; everything below is consequence.

### 19.2 Structural mapping

Nothing here is decorative. Each visual element is bound to real data that
already exists and is already tested.

| Element | Count | Bound to |
|---|---|---|
| Ray florets (petals) | **55** | One per Part. Extends as that Part fills. |
| Ray sectors | **6** | One per subject. Sector width ∝ that subject's part count, so the gaps in the ring *are* the subject boundaries. |
| Rosette leaves | **6** | One per subject. Leaf size ∝ **exam weight**, so Remedial (25%) is visibly the largest and Criminal (10%) among the smallest. A neglected subject reads as a stunted leaf. |
| Disc florets | 1 | `weightedCoverage` / `weightedDepth` — the number that decides passing. |
| Scape (stem) height | — | `weightedCoverage`. |
| Bloom openness | — | `weightedDepth`. |

Sector arithmetic: 55 rays over 336° at 6.109° each, with six 4° gaps. Political
14, Commercial-Tax 7, Civil 12, Labor 8, Criminal 4, Remedial 10 — closing
exactly at 360°.

### 19.3 Growth stages

Seven named stages, driven by coverage. Depth drives the bloom independently, so
the two axes can and should disagree.

| # | Stage | Coverage band |
|---|---|---|
| I | Seed | 0% |
| II | Germination | > 0 – 10% |
| III | Seedling | 10 – 25% |
| IV | Vegetative | 25 – 45% |
| V | Bud | 45 – 65% |
| VI | First rays | 65 – 85% |
| VII | Full bloom | 85 – 100% |

Stages are discrete but the data is continuous: within a stage, the stem, leaves,
and rays interpolate. The named stage exists so there is something to announce
to a screen reader and something to celebrate.

### 19.4 The flower never wilts

**The growth stage ratchets.** Highest stage reached is retained, exactly as best
streak is (§8.1 r4). A demotion after a bad mock exam moves the numbers and may
close some rays, but it never returns the plant to a seed and never renders decay.

This follows directly from an existing principle rather than being a new one:
§8 makes achievements additive so that honest downgrading is not punished, and
§6 permits demotion precisely because it is real information. A plant that
visibly died back would punish the one behaviour the app most wants to preserve.

Wilting, browning, drooping, and dying are **out of scope**, permanently. There
is no state of this app in which the user is shown a dying plant.

### 19.5 Register: botanical, not cartoon

§18 already draws this line with "feminine but not childish." A daisy crosses it
easily, so the reference is fixed here: **a Victorian botanical plate.** Hairline
rules, engraver's stipple on the disc, anatomically plausible toothed leaves,
deliberate asymmetry in the rosette, annotation in small serif. No drop shadows,
no gloss, no bounce, no mascot, no face.

Tested visually before implementation: `artifacts/daisy-plate-light.svg` — habit
at full bloom, the capitulum annotated, the bud-that-never-opened diagnostic, and
the seven stages. Generated by `npm run plate`, which reads the real syllabus and
refuses to draw on any count mismatch.

### 19.6 Palette extension

The daisy needs greens and golds, which the three supplied colours do not
contain. Rather than introduce new hues, both families **widen tokens that
already exist**: greens from `--c-success`, golds from `--c-flag`.

Ten new semantic tokens: `--c-ray`, `--c-ray-edge`, `--c-disc`, `--c-disc-edge`,
`--c-stem`, `--c-leaf`, `--c-leaf-edge`, `--c-bud`, `--c-bud-edge`, `--c-soil`.
Exact values and measured ratios are in `requirements.md` §5.9.

One contrast rule is specific to this feature and easy to get wrong: **a ray
floret's outline carries its boundary, never its fill.** A cream petal on warm
sand cannot reach 3:1 and no adjustment will make it, short of pushing the daisy
out of the palette. The outline is therefore the checked pair — the same
treatment §16 already gives the mastery rungs, where `nodeBorder` carries the
boundary and the rung fill does not.

> **AMENDED with §16.** The dark botanical tokens are removed. The plate is
> light only, and `scripts/daisy-plate.mjs` emits one plate.

Verified by `npm run contrast`, all PASS, exit 0.

### 19.7 Cost, and the honest risk

This lands in **milestone 2**, not later. A design system built around an organic
centrepiece is a different system from one built around cards and meters;
building M2 first and inserting the daisy afterwards means rebuilding M2.

> **STATUS: shipped.** The plate was authored, reviewed, and the art is now
> wired to live data. Geometry lives in `src/lib/daisy.ts`; `<Daisy/>` renders
> it and `scripts/daisy-plate.mjs` imports the same module, so the plate and the
> app cannot drift. The seven-stage limit below held — no eighth stage was added.

§15 rates "building the app becomes procrastination" as **High**, and
illustration is the least bounded work in this project. Mitigations, which are
binding:

- Seven stages. Not eight, not twelve. Adding a stage requires amending this
  section.
- The art is authored once as static plates, reviewed, and only then wired to
  data. Both plates already exist.
- Wilting, weather, seasons, insects, multiple flowers, and a garden view are out
  of scope. The deferred list in §13 is not reopened by this section.
- Motion obeys the existing ceiling: no transition over 400ms, everything
  instant under `prefers-reduced-motion`.

### 19.8 Accessibility

The bloom is decorative only in the sense that it duplicates information; it is
never the sole carrier. Coverage and depth remain present as text (§6, AC-11).
The illustration exposes a single live text equivalent, e.g.

> "Stage IV of VII, vegetative. Coverage 35%. Depth 15%. The bloom has not
> opened."

Growth stage is conveyed by **geometry**, which satisfies WCAG 1.4.1 without
relying on the colour families at all.

---

## Appendix: source of truth

Parsed from `2027 Bar Exam Study Tracker.xlsx` (9 sheets) on 2026-09-21.
Sheets: `Start Here`, `Dashboard`, `Study Calendar`, `1 Political`,
`2 Comm-Tax`, `3 Civil`, `4 Labor`, `5 Criminal`, `6 Remedial-Ethics`.

Where this app and the official Supreme Court microsite
(`sc.judiciary.gov.ph/bar-2027`) differ, **the microsite controls** — the same
caveat the original workbook carries.

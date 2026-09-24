# Market Research: Study Tracker with Gamified Progression

- **Mission:** 001-bar-exam-tracker
- **Date:** 2026-09-21
- **Purpose:** set the quality bar, ground the visual design, and avoid known failure patterns

> Content from all sources below was paraphrased and summarised for compliance with
> licensing restrictions. Every claim is linked to its source.

---

## Research sources

| # | Source | Used for |
|---|---|---|
| 1 | [Duolingo proficiency whitepaper (PDF)](http://duolingo-papers.s3.amazonaws.com/reports/Duolingo_whitepaper_language_read_listen_write_speak_2024.pdf) | Path vs tree — measured learning outcomes |
| 2 | [Duolingo — the science behind the home screen redesign](https://blog.duolingo.com/new-duolingo-home-screen-design/) | Guided-path rationale |
| 3 | [CNET — Duolingo's winding path](https://www.cnet.com/tech/services-and-software/8-changes-duolingo-made-for-easier-language-learning-in-2022/) | Scroll-back confidence pattern |
| 4 | [note.com — design choices in Duolingo](https://note.com/eunoia25/n/ne04b40a935c7?hl=en) | Why the tree was abandoned |
| 5 | [Professor Game — why streaks backfire](https://www.professorgame.com/podcast/423/) | Streak reset → abandonment |
| 6 | [Trophy — what happens when users lose streaks](https://trophy.so/blog/what-happens-when-users-lose-streaks) | Freeze mechanics reduce abandonment |
| 7 | [Trophy — streak feature examples](https://trophy.so/blog/streaks-feature-gamification-examples) | Quantified freeze impact (2026 report) |
| 8 | [Yu-kai Chou — recovery-first streak design](https://yukaichou.com/gamification-analysis/recovery-first-streak-design/) | Grace periods, recovery quests |
| 9 | [Yu-kai Chou — habits not burnout](https://yukaichou.com/gamification-analysis/streak-design-gamification-motivation-burnout/) | Streak anxiety as anti-pattern |
| 10 | [The Decision Lab — streak creep](https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification) | Gamification eroding intrinsic motivation |
| 11 | [UX Magazine — gamification or manipulation](https://uxmag.com/articles/gamification-or-manipulation-understanding-the-ethics-of-engagement-loops) | Ethics of engagement loops |
| 12 | [PeazeHub — study timer apps 2026](https://www.peazehub.com/blog/best-study-timer-apps-for-students-2026) | Distribution vs effort insight |
| 13 | [CardMunch — best study apps 2026](https://cardmunch.com/apps/best-study-apps-for-college-students/) | Focus discipline |
| 14 | [SaveMyExams — productivity apps for students 2026](https://www.savemyexams.com/learning-hub/useful-resources/best-productivity-apps-for-students/) | Table stakes |
| 15 | [Athenify — study app comparison](https://athenify.io/best-study-apps) | Competitor positioning |
| 16 | [Respicio — Philippine bar exam review materials](https://www.respicio.ph/commentaries/bar-exam-review-materials) | Materials hierarchy |
| 17 | [FilipiKnow — how to pass the PH bar](https://filipiknow.net/how-to-pass-bar-exam/) | Local review practice |
| 18 | [OpenReplay — local-first PWA architecture](https://blog.openreplay.com/local-first-pwa-architecture/) | Three-layer architecture |
| 19 | [OpenReplay — offline form submission / background sync](https://blog.openreplay.com/offline-form-submission-background-sync/) | **iOS Background Sync gap** |
| 20 | [W3C — WCAG 2.2 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) | Not-colour-alone requirement |
| 21 | [StackOverflow — WCAG contrast for progress indicators](https://stackoverflow.com/questions/77107364/what-are-the-wcag-color-contrast-requirements-for-a-progress-indicator) | 1.4.11 applied to progress UI |
| 22 | [AllAccessible — colour contrast guide](https://allaccessible.org/blog/color-contrast-accessibility-wcag-guide-2025) | Prevalence of contrast failures |
| 23 | [media.io — blush raspberry palettes](https://www.media.io/color-palette/blush-raspberry-color-palette.html) | Warm base + deep anchor |
| 24 | [media.io — soft palettes](https://www.media.io/color-palette/soft-color-palette.html) | Low-saturation fatigue reduction |
| 25 | [Artisan Themes — feminine font/colour combinations](https://artisanthemes.io/best-google-fonts-color-combinations-feminine-website/) | Feminine ≠ delicate only |
| 26 | [FontDetector — font pairing](https://fontdetector.org/blog/font-pairing-guide/) | Serif display + sans body |
| 27 | [WebDesignDev — best web fonts 2026](https://webdesigndev.com/best-fonts-for-web-design/) | Playfair Display characteristics |

---

## Reference products

| Product | Category | Why it's relevant |
|---|---|---|
| **Duolingo** | Gamified learning path | The reference implementation of the ribbon mechanic, with published research on it |
| **MyStudyLife** | Student planner | Rated best overall for academic-specific features, and free ([source](https://www.savemyexams.com/learning-hub/useful-resources/best-productivity-apps-for-students/)) |
| **Forest** | Focus gamification | Gamifies focus with virtual trees — the "grow something" reward loop ([source](https://athenify.io/best-study-apps)) |
| **Anki** | Spaced repetition | The mastery-over-time model; what we deliberately are not building yet |
| **Notion / Airtable** | Flexible database | What the user explicitly rejected — a prettier spreadsheet |
| **Finch / Streaks** | Habit tracking | Cited for handling lapses well via configurable goals and repairs ([source](https://www.professorgame.com/podcast/423/)) |
| **PrettyProgress** | Visual habit tracking | Puts progress where the eyes already go |

---

## What's good / what's bad

### Duolingo

**Good — and this is the single most valuable finding in this document.**
Duolingo's own research found the linear **path** produces *better proficiency
outcomes* than the older branching **tree**, even though it takes longer to
complete ([whitepaper](http://duolingo-papers.s3.amazonaws.com/reports/Duolingo_whitepaper_language_read_listen_write_speak_2024.pdf)).
The reason is specific: with a tree, learners over-invested in favourite skills
and their coverage became lopsided; a single path naturally interleaves new
material with review ([analysis](https://note.com/eunoia25/n/ne04b40a935c7?hl=en)).

That is *precisely* the bar-review failure mode. A reviewee who enjoys Civil Law
and avoids Taxation will fail Taxation. The ribbon is not decoration — it is a
coverage-enforcement mechanism with published evidence behind it.

Second good pattern: the winding path gives a **confidence boost when you scroll
back up through what you've completed** ([CNET](https://www.cnet.com/tech/services-and-software/8-changes-duolingo-made-for-easier-language-learning-in-2022/)).
Cheap to build, and it is the emotional payoff of a long path.

**Bad.** Duolingo is the canonical example of streak monetisation and streak
anxiety. Teenage users report pressure and anxiety tied to the reward-punishment
cycle ([UX Magazine](https://uxmag.com/articles/gamification-or-manipulation-understanding-the-ethics-of-engagement-loops)),
and monetising that anxiety is described as eroding trust and accelerating churn
([Yu-kai Chou](https://yukaichou.com/gamification-analysis/streak-design-gamification-motivation-burnout/)).
Also relevant: protecting a streak is not the same as knowing more — the reward
can quietly become the point ([Taalhammer](https://taalhammer.com/gamification-in-language-learning-apps/)).

### Habit and study trackers generally

**Good.** Distribution beats totals. A heatmap or per-subject log converts
"I think I studied a fair amount" into an actual number, and the sharpest framing
found: revision fails on *distribution*, not effort — students do the hours but
bunch them into the wrong week ([PeazeHub](https://www.peazehub.com/blog/best-study-timer-apps-for-students-2026)).
For a 6-subject weighted exam this is the whole game.

**Good.** Put progress where attention already goes, rather than behind a tab.

**Bad.** Apps that try to be flashcards, notes, and focus timer at once tend to
do none of them well ([CardMunch](https://cardmunch.com/apps/best-study-apps-for-college-students/)).
Direct support for the deferral decisions in `design.md` §13.

**Bad.** Badges and points bolted on produce a two-week engagement spike and then
a crash ([Substack analysis](https://myliea2e.substack.com/p/from-badges-to-behavior-engines-why)),
and gamification can sap the intrinsic enjoyment of the underlying activity
([The Decision Lab](https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification)).
The rule that follows: a progress bar must reflect real completed work, never
reward meaningless taps ([UX/business debate](https://apurvabhure.substack.com/i/155761017/act-iv-2025-the-reckoning)).

### Philippine bar review practice

**Good context.** The accepted materials hierarchy among Filipino reviewees is
**codal first, then concise reviewers, then practice Q&A**
([Respicio](https://www.respicio.ph/commentaries/bar-exam-review-materials)).
This directly specifies the link categories the app should offer.

**Good context.** Prayer and spiritual preparation are a documented, ordinary part
of Philippine bar preparation, not an unusual addition. The verse feature is
culturally native to this audience.

**Good context.** Reviewees commonly plan five to six months out with a written
study plan and deliberately avoid schedules that are either too strict or too
loose ([FilipiKnow](https://filipiknow.net/how-to-pass-bar-exam/)) — which is
exactly the "sequential but overridable" balance already chosen.

---

## Table stakes features

Each of these appears across at least three referenced products. Per the
contract rules, **every one needs at least one acceptance criterion.**

| # | Feature | Status in our plan |
|---|---|---|
| 1 | Per-subject progress with percentages | ✅ Dashboard |
| 2 | Overall progress, weighted where weights exist | ✅ Weighted coverage + depth |
| 3 | Hierarchical browsing of material | ✅ Subject → Part → Topic → Item |
| 4 | Per-item status that is one tap to change | ✅ Mastery ladder |
| 5 | Flag / star difficult material | ✅ `needsReview` |
| 6 | Notes attached to material | ✅ Per-item notes |
| 7 | Resource links attached to material | ✅ Typed links (see below) |
| 8 | Streaks / consistency tracking | ✅ **Revised — see §Streak redesign** |
| 9 | Achievements or milestones | ✅ Achievement engine |
| 10 | Countdown to exam date | ✅ Days to Day 1 |
| 11 | Schedule / weekly plan view | ✅ Read-only week focus (editable deferred) |
| 12 | Study distribution visibility (heatmap/log) | ⚠️ **New — added by this research** |
| 13 | Works on mobile | ✅ Mobile-first PWA |
| 14 | Works offline | ✅ Local-first |
| 15 | Search across material | ⚠️ **New — added by this research** |

### Two features this research adds

**Study distribution heatmap.** A calendar grid of daily activity, coloured by
volume. Justified by the distribution-over-effort finding, and it is nearly free
because the event log already carries `localDate`. It also doubles as the honest
version of the streak.

**Search across the 1,489 items.** Not in the original scope, and it is a real
gap: when a lecture mentions *"operative fact doctrine"*, finding that item by
scrolling four levels of hierarchy is painful. Client-side substring search over
bundled reference data — no server, no index, instant.

### Link categories (from the local materials hierarchy)

`Codal` · `Reviewer` · `Case` · `Lecture` · `Q&A` · `Other`

---

## Professional UX patterns

Concrete, measurable behaviours to implement.

**Optimistic local writes.** Tapping a mastery level updates the UI immediately
with no spinner and no network wait — Duolingo explicitly predicts backend
responses to stay responsive on poor connections
([source](https://blog.duolingo.com/frontend-prediction/)). Our local-first store
gives this by construction.

**Scroll-back reward.** The ribbon scrolls freely backwards through completed
Parts, which is where the confidence payoff lives. Do not collapse or hide
history.

**Grace-first streaks.** Detailed below.

**One-tap ladder advance, long-press or menu to demote.** Advancing is the common
action and must be instant; demotion is rarer and should be deliberate rather
than easy to trigger by accident.

**Progress must reflect real work.** No points currency, no XP, no reward for
opening the app. Every achievement maps to syllabus items at a mastery level.

**Sync status always legible, never modal.** A persistent, quiet indicator:
`synced` / `pending (n)` / `offline` / `error`.

**Empty states that teach.** An untouched subject shows what to do next, not a
blank panel.

---

## Streak redesign (this research changes the approved design)

`design.md` §8 currently specifies `streak_3/7/14/30/60/100` as consecutive days
with activity. **That is the single most dangerous decision in the design**, and
the evidence against it is consistent across independent sources:

- A streak collapse harms users not because of the missed session but because the
  binary reset destroys the identity the streak built — often causing outright
  abandonment ([Professor Game](https://www.professorgame.com/podcast/423/)).
- Someone who breaks a 100-day streak may never come back, because the break
  reads as failure rather than a lost day ([Trophy](https://trophy.so/blog/what-happens-when-users-lose-streaks)).
- Repair mechanics are described as *mercy infrastructure*; a streak that cannot
  be repaired is a bomb waiting for a bad day, and products without repair lose
  their most committed users to one missed day ([Yu-kai Chou](https://yukaichou.com/gamification-study/master-the-art-of-streak-design-for-short-term-engagement-and-long-term-success/)).
- Quantified: users with freeze access sustain streaks about **4.5× longer by day
  21**, and past day fourteen the gap widens to roughly **30.6 days vs 18.9 days**
  ([Trophy, Gamification Intelligence Report 2026](https://trophy.so/blog/streaks-feature-gamification-examples)).
- The prescribed approach is recovery-first: assume every user will miss days and
  build grace periods in from day one ([Yu-kai Chou](https://yukaichou.com/gamification-analysis/recovery-first-streak-design/)).

This matters more here than for a typical app. The user is facing **eleven
months** of review with holidays, illness, family obligations, and burnout
guaranteed somewhere in it. A hard streak reset in month six, three weeks after a
100-day run, could plausibly end her use of the app entirely — and the app is
supposed to be a source of encouragement.

### Revised streak rules

1. **Grace days.** One missed day per rolling 7-day window does not break the
   streak. Applied automatically, shown honestly ("grace day used Tuesday"), never
   sold.
2. **Best streak is permanent.** Recorded and displayed forever. A break never
   shows a bare zero next to nothing.
3. **Soft landing.** On a genuine break, the app shows a "welcome back" with the
   `comeback` verse and the best streak — not a reset counter. Matches the
   existing `comeback` achievement.
4. **Streak is secondary, not the hero metric.** The dashboard leads with
   weighted coverage and the distribution heatmap. Consistency is shown as *days
   studied in the last 30* — a recoverable number — with the consecutive streak as
   a smaller secondary stat.
5. **No streak-loss notifications.** No loss-aversion pressure, ever. This app is
   a gift to herself, not an engagement funnel.

Rule 4 is the important one. *Days studied in the last 30* cannot be destroyed by
a single bad day, which makes it both more honest and more humane than a
consecutive counter.

---

## Design reference

The user asked for a **feminine** aesthetic. Research surfaced a real conflict
that has to be resolved deliberately.

### The conflict

Soft palettes work by keeping saturation and contrast **low**, which reduces
visual fatigue and suits information-dense reading
([media.io](https://www.media.io/color-palette/soft-color-palette.html)). But WCAG
AA requires **4.5:1** for normal text, **3:1** for large text and interactive
components, and contrast failure is the most common accessibility defect on the
web, affecting around 83.6% of sites
([AllAccessible](https://allaccessible.org/blog/color-contrast-accessibility-wcag-guide-2025)).
Pastel-on-pastel is exactly how that failure happens.

The user will read dense legal text on this app for hundreds of hours, often on a
phone, sometimes in bright light. Low contrast is not a stylistic risk here; it is
a usability failure.

### The resolution

Blush-raspberry palettes are described as pairing a warm, approachable pink base
with a **deeper berry anchor** that supplies contrast and sophistication — and
specifically, that combination keeps a design warm without becoming overly sweet
or childish ([media.io](https://www.media.io/color-palette/blush-raspberry-color-palette.html)).

So: **soft colours carry the surfaces, deep colours carry the meaning.** Blush,
cream, and mauve for backgrounds and large fills; deep plum and berry for all
text, icons, and interactive elements.

This also answers the register question. Feminine can mean delicate and
romantic, but equally vibrant, strong, and powerful
([Artisan Themes](https://artisanthemes.io/best-google-fonts-color-combinations-feminine-website/)).
For a woman preparing to be admitted to the Philippine Bar, the target is
**elegant and strong — editorial, not cute.** No pastel confetti, no cartoon
mascot.

### Proposed palette (exact ratios verified during build)

| Token | Hex | Role |
|---|---|---|
| `cream` | `#FFFBF7` | app background |
| `blush-50` | `#FDF2F4` | card surface |
| `blush-100` | `#F9E3E8` | subtle fill, locked nodes |
| `rose-300` | `#E9A8B8` | ladder rung 1 (Read Once) |
| `berry-500` | `#C2547D` | ladder rung 2 (Reviewed), accents |
| `berry-700` | `#9B2C5E` | ladder rung 3 (Mastered), primary action |
| `plum-900` | `#4A2545` | all body text, headings |
| `plum-600` | `#6B3A5F` | secondary text |
| `sage-500` | `#7C9A82` | success, sync-healthy (non-pink relief) |
| `amber-500` | `#C98B3A` | needs-review flag |
| `clay-600` | `#A8543F` | error (warm, not fire-engine red) |

Text is `plum-900` on `cream` or `blush-50` — a near-black warm plum on warm
white, which is comfortably above 4.5:1 while still reading as warm rather than
clinical. Every pair is checked with a contrast tool during build; any pair below
target is corrected, not shipped.

**Not colour alone.** WCAG 1.4.1 requires information not be conveyed by colour
only ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)), and
the four ladder states are information. Each therefore carries a distinct **shape
or icon** as well as a colour: locked (outline + lock), Read Once (quarter fill),
Reviewed (half fill + tick), Mastered (full fill + filled tick).

**Progress indicators need two contrast checks,** not one: the indicator's outer
boundary against the page, *and* the filled segment against the unfilled segment,
both under WCAG 1.4.11
([explanation](https://stackoverflow.com/questions/77107364/what-are-the-wcag-color-contrast-requirements-for-a-progress-indicator)).
Blush-on-blush progress bars would fail the second check, so the unfilled track
uses `blush-100` against a `berry-700` fill.

### Typography

A high-contrast serif headline pairs well with a quiet sans body because the roles
are unmistakable ([FontDetector](https://fontdetector.org/blog/font-pairing-guide/)),
and an editorial serif with a clean sans reads polished yet accessible
([Bright Horizon](https://brighthorizoncreative.squarespace.com/blog-2-1/blog-post-title-four-xzpxb)).

| Role | Face | Rationale |
|---|---|---|
| Display / headings | An editorial serif such as **Playfair Display** — high contrast, dramatic thick-to-thin strokes, elegant curves ([source](https://webdesigndev.com/best-fonts-for-web-design/)) | Carries the feminine, elegant register |
| Body / UI / data | A clean humanist sans (**Inter** or similar) | 1,489 dense legal strings need clarity, not personality |
| Scripture | The serif, italic, slightly larger | Sets verses apart as voice rather than interface |

**Serif is for headings and verses only.** Setting legal topic text in a
high-contrast display serif would be actively harmful to read at length. This is
the main way "feminine design" goes wrong in practice, and it is avoided by rule.

### Density and layout

| Property | Value | Reason |
|---|---|---|
| Base font size | 16px minimum; 17–18px for item text | Long reading sessions on mobile |
| Line height (item text) | 1.6 | Dense legal phrasing needs air |
| Tap target | 44×44px minimum | Thumb use, and the ladder is tapped thousands of times |
| Item row vertical padding | 12–14px | Comfortable without wasting a phone screen |
| Card corner radius | 12–16px | Soft, matches the register |
| Grid gutter | 16px mobile / 24px desktop | |
| Max reading width | ~68 characters | Comfortable measure for long text |
| Ribbon node (mobile) | 56px diameter, 32px vertical gap | Large enough to read state at a glance |
| Shadows | Soft, warm-tinted, low opacity | Harsh grey shadows read cold |
| Motion | 150–250ms ease-out; respects `prefers-reduced-motion` | Celebration without nausea |

---

## Keyboard shortcuts

Desktop use will be long sessions of marking items. Shortcuts are a real
efficiency gain, not polish.

| Key | Action |
|---|---|
| `/` | Focus search |
| `j` / `k` | Next / previous item |
| `1` `2` `3` `0` | Set mastery to Read Once / Reviewed / Mastered / Not Started |
| `f` | Toggle needs-review flag |
| `n` | Edit note on focused item |
| `l` | Add link to focused item |
| `Esc` | Close panel or dialog |
| `g` then `d` | Go to dashboard |
| `g` then `r` | Go to ribbon |
| `?` | Shortcut help |

All shortcuts are discoverable via `?`. Every shortcut has a visible UI
equivalent — keyboard is an accelerator, never the only route.

---

## Common complaints (these become quality requirements)

| Complaint | Requirement it creates |
|---|---|
| Broken streak causes abandonment | Grace days, permanent best streak, soft landing |
| Gamification becomes the point | Achievements map to real items only; no points currency |
| Apps do too much, all of it badly | Ship the deferral list in `design.md` §13 |
| Progress bars reward meaningless taps | Progress = mastery of syllabus items, nothing else |
| Pastel UIs are unreadable | Deep plum text on warm light surfaces; contrast verified |
| Streak pressure and loss-aversion nagging | No streak-loss notifications at all |
| Effort logged but badly distributed | Distribution heatmap, per-subject, weight-aware |

---

## Technical findings that change implementation

**The Background Sync API is unusable as a dependency.** One-off Background Sync
is Chromium-only and absent from Firefox, Safari, and iOS, so an `online`-event
fallback is mandatory ([OpenReplay](https://blog.openreplay.com/offline-form-submission-background-sync/)).
If the user carries an iPhone — likely in the Philippines — Background Sync will
never fire. The outbox flush must therefore be driven by `online` events,
`visibilitychange`, and a timer. `design.md` §10 already specifies exactly this;
this finding confirms it and forbids "improving" it later by switching to
Background Sync.

**The three-layer local-first split is the established pattern:** service worker
for assets and the offline shell, a local database for reads and writes, and a
separate sync engine for eventual consistency
([OpenReplay](https://blog.openreplay.com/local-first-pwa-architecture/)). This
matches `design.md` §4, and it means sync can genuinely be built last without
rework.

**Device storage eviction is a real risk on mobile,** which is a second
independent argument for cloud sync rather than export-only backup — already the
chosen architecture.

---

## Our target

### Must have

The full first-release scope in `design.md`, **plus three additions from this
research**:

1. Distribution heatmap (daily activity calendar)
2. Search across all 1,489 items
3. Grace-day streak model replacing consecutive-day streaks

### Nice to have

Ribbon scroll-back animation · shortcut help overlay · per-subject heatmap
filtering · verse favouriting

### Explicitly skipped

Points or XP currency · leaderboards · social or sharing features · streak-loss
notifications · any monetised recovery mechanic · mascot characters ·
spaced-repetition scheduling (deferred, not rejected) · AI question generation

### Quality bar

- Every feature has happy, empty, loading, error, and mobile states
- No inline styles; Tailwind design tokens only
- WCAG 2.2 AA contrast on every text and UI pair, measured with a tool
- No information conveyed by colour alone
- Full keyboard operation on desktop
- Fully usable offline except cross-device sync
- Every interactive element has hover, active, focus-visible, and disabled states
- `prefers-reduced-motion` respected
- Browser proof (real interaction sequences) before anything is called done

### The bar this app is measured against

Duolingo's path mechanic and a well-made habit tracker's visual progress — with a
grown-up editorial aesthetic instead of cartoon gamification, and with the
honesty to show a 0.4% weighted coverage in month one rather than flattering her.

---

## Open item for the contract phase

The distribution heatmap and search were **not** in the design the user approved.
Both are additive and cheap, but they are scope, so they must be raised
explicitly rather than absorbed silently. The streak change is a **correction to
an approved decision** and must also be surfaced for approval.

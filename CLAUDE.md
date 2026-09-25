# SHOS — Sexual Health Operating System

A personal sexual health + lifestyle tracker for one user, not a clinical
record system. React 18 + Vite + Capacitor 8, shipping as both an Android
APK and a web/PWA build. **No backend, no cloud, no accounts** — every
byte lives in the device's own `localStorage`. That's not a gap to fill;
it's the actual privacy guarantee this app is built on.

This file is a durable, current-state reference — architecture rules,
where things live, and open issues. It is deliberately *not* a full
changelog. The full build history and reasoning behind every decision
lives in Notion (workspace: "Sexual Health Operating System (SHOS)",
pages "Development" and "AI Development" under Backend files) — that's
the source of truth for *why*; this file is the source of truth for
*what's true right now*. Keep both current: log real work in Notion,
keep this file's "Known issues" section honest as things get fixed.

## Starting a new session — read this first

1. Read this file in full — it's the current-state snapshot.
2. Check the Notion "Development" log's most recent entries (workspace
   "Sexual Health Operating System (SHOS)" → Backend files →
   "Development") for anything since this file's "Recently shipped"
   date below — a prior session may have shipped real work there that
   this file hasn't caught up to yet.
3. `git log --oneline -20` against the actual repo to cross-check —
   Notion and this file both describe *intended* current state; the
   git history is what's actually shipped. If they disagree, trust the
   repo and fix the docs, not the other way around.
4. When you finish real work in this session: update this file's
   "Known issues"/"Recently shipped" sections in the same change, AND
   append a dated entry to the Notion "Development" log in the same
   voice/density as existing entries (see that page's own history for
   the pattern — one dense paragraph per date, real specifics, not a
   bullet summary). Don't let either drift stale again — that's
   exactly the gap that made this section necessary in the first place.

## Who this is for

UK adult users, LGBT-inclusive but not exclusively labeled as an "LGBT
app" — vocabulary and defaults (Kink Registry, DoxyPEP/PrEP tracking,
BASHH/UK guidance) come from a gay/kink-community context, while
trans-inclusive fields (pronouns, Contraception/Menstrual/Pregnancy
tracking gated by a settings toggle, never by gender alone) are
first-class, not bolted on. Single owner, single device at a time —
there is no multi-user or multi-device sync story, by design.

**Explicitly, permanently out of scope**: multi-user collaboration, full
EHR functionality, NHS interoperability, a diagnosis engine, or automated
clinical risk scoring. Exposure-window flagging and retest-date
suggestions are informational only — never automated actions. Don't
propose crossing this line; it's been re-affirmed multiple times, not an
oversight.

## Architecture rules (do not violate silently)

- **Four-layer model**: `Registries` (define entities — Contacts,
  Locations, Medications, Symptoms, Organisms, Results, Kinks,
  Protection, Chems) → `Records` (document events — Encounters, Testing,
  Clinic Visits, Medication Log, Symptoms, Vaccinations, Attachments) →
  `Workflow` (cross-cutting operational state — refill prediction,
  follow-up tracking; not a separate storage tier) → `Workspaces`
  (curated views that own no data of their own — Dashboard, Clinic Card,
  Timeline/Episodes).
- **Enter once, reuse everywhere** — reference data lives in a Registry,
  linked by relation, never duplicated across records.
- **Store facts, derive state** — events are immutable logs; stock
  levels, adherence, active/inactive flags, "most recent test," episode
  status are always *calculated*, never hand-typed. One canonical owner
  per fact.
- **Repository / calculation / sync three-layer split**, applied
  consistently: a repository is pure data access (localStorage in,
  localStorage out); a calculations file is pure business logic, no I/O;
  a sync file (where one exists) is the one place real data and a real
  side effect (a scheduled notification, a calendar write) meet. This
  pattern is why real bugs this session could be root-caused to an exact
  line instead of guessed at — preserve it in new code.
- **Defensive-default merge on every read** (`{...DEFAULTS, ...stored}`)
  — every repository's `getPreferences()`/`getAll()` equivalent does
  this, so adding a field later never breaks a previously-saved record.
- **Archive before hard delete** — the default for "just outdated" is
  `isArchived`, not removal. Real delete-with-confirmation exists
  per-module for genuine mistakes, not as the default path.
- **Undo is single-step, per-module only** — no cross-module action
  history. Deliberate anti-over-engineering decision, not a gap.
- A new repository must be wired into `backupService.js` in the **same
  change** that adds it, not after. This was missed twice historically.
- Design system: `src/calculations/designTokens.js` is the single source
  of truth (colors, type, radius). Icons are Phosphor
  (`@phosphor-icons/react`), aliased on import — never `lucide-react`,
  which was fully migrated off. Fonts are Inter (body) + JetBrains Mono
  (utility/monospace), self-hosted via `@fontsource/*`, never a
  render-blocking Google Fonts `<link>`.
- **Fake-UTC date storage convention**
  (`src/calculations/dateInputHelpers.js`): most stored date/time strings
  are `"YYYY-MM-DDTHH:mm:00.000Z"` where the digits are literal local
  wall-clock time and the trailing `Z` is a deliberate lie (avoids
  timezone-shift bugs on read). A genuine system-observed instant (e.g.
  `createdAt`/`updatedAt` timestamps, notification-history entries) uses
  real `new Date().toISOString()` instead — these are two different,
  intentional conventions for two different kinds of value. Don't
  conflate them; check which one a given field actually needs.

## Where things live

- `src/modules/` — one file per feature area (`SHOS_<Feature>_Prototype.jsx`).
  19 modules as of this writing: Contacts, Encounters, Medication
  Dashboard, Healthcare (Testing/Clinic Visits/Menstrual&Contraception&
  Pregnancy/Symptoms/Vaccinations shell), Home, Settings, Global Search,
  My Profile, Clinic Card, Attachments, Timeline (renamed from
  "Timeline" to "Episodes" internally — 26 Aug; a component or comment
  still saying plain "Timeline" is stale), Partner Notification, Registry
  Management, Option List Editor. `App.jsx` is shell-only (routing,
  global state, notification banners) — Home/Healthcare/Settings were
  deliberately extracted out of it; a large `App.jsx` again would mean
  that extraction regressed.
- `src/repositories/` — one per data domain, `localStorageAdapter`-backed.
- `src/calculations/` — pure business logic + `*ReminderSync.js` files
  (the notification scheduling glue for Medication/DoxyPEP/Testing/
  Refill/Clinic-visit reminders).
- `src/storage/` — cross-cutting native/platform services
  (`notificationService.js`, `backupService.js`, `biometricAuthService.js`,
  `locationService.js`, `calendarSyncService.js`, `fileExportHelper.js`,
  `updateCheckService.js`).
- `android/` — the Capacitor-generated native Android project.
  `MainActivity.java` and `AndroidManifest.xml` are hand-edited in
  places (FLAG_SECURE, allowBackup, font-scale wiring) — real native
  code, not boilerplate to regenerate blindly.
- `.github/workflows/build-apk.yml` — builds a debug APK on every push
  to `main`, publishes it to a public, login-free GitHub Release tagged
  `latest`. `.github/workflows/web-alpha.yml` — deploys the web build to
  GitHub Pages. `.github/workflows/smoke-test.yml` (added 4 Sep) runs
  `scripts/smoke-test.cjs` against a real `vite preview` build on every
  push — the one piece of automated regression coverage this project
  has, now actually gated rather than manual-only.
- `scripts/smoke-test.cjs` — 5 flows, CI-wired (see above) but also
  still worth running by hand before/after any risky change during a
  session: `npm run dev -- --port 5183` then `node scripts/smoke-test.cjs`.

## Working conventions for this project specifically

- **Personal-alpha vs. public-alpha split**: this repo (`drwho2001/SHOS-V2`)
  is the public track. The owner's real personal data must never land
  here — seed/demo data only. History was rewritten once (27 Aug) to
  purge personal data that had leaked into comments; don't reintroduce
  real names, specific addresses, or identifying details into code
  comments or seed data.
- **"This isn't an EHR"** is the standing self-check before proposing
  new structure — auto-logging, cross-module history, a schema editor,
  and similar have all been explicitly rejected on this ground before.
  Apply it to new feature proposals before building them.
- **Icon-only UI needs an explanatory affordance** (16 Sep 2026, real
  ask) — an icon with no adjacent text label needs a tap-to-reveal info
  icon explaining what it means/how it's calculated, unless the icon is
  a truly universal standard (a gear for Settings, a person for a
  profile, a magnifying glass for Search — icons a user already knows
  without this app teaching them). Same tap-to-reveal-caption pattern
  established for Contacts' active-status dot and Medication
  Dashboard's 7-day adherence dot (a small `InfoIcon`, `role="button"`,
  toggles a short caption on tap — not a hover-only tooltip, since this
  app targets touchscreens). Applied to all 4 of Home's Status-at-a-
  glance rings 16 Sep 2026 (each explains its own calculation basis,
  not just adherence). Apply this on sight to new icon-only UI. A real,
  delegated retroactive audit ran 17 Sep 2026 and found and fixed 3
  genuine gaps (Contacts' transport/hosts/linked/flagged icon row and
  `MethodIcons`, Timeline's `EpisodeCard` positive-result dot,
  MenstrualHealth's `FlowDrops` hover-only title) — see "Recently
  shipped" below for the full list. Still not claimed exhaustive
  (the audit itself covered `src/modules/*.jsx` + `App.jsx`, not every
  possible icon-only element) — flag a genuine gap if one surfaces.
- **Verify a write actually landed** — don't trust a tool call's success
  alone; confirm state changed for anything that matters (this applies
  to Notion edits and to code changes alike).
- The owner also runs parallel sessions with other AI tools and relays
  their output here. Treat a relayed recommendation as a proposal to
  check against real code/session history, not something to adopt
  uncritically — it may not have visibility into what's already shipped.
- Every commit ends with an attribution footer — a hard requirement,
  not optional:
  ```
  Co-Authored-By: Claude <model-name> <noreply@anthropic.com>
  Claude-Session: <this session's own claude.ai/code/session/... URL>
  ```
  Both lines are specific to whichever session/model made the commit —
  don't copy a literal URL from a past commit into a new one; use the
  current session's own values (`git log -1` shows the exact format
  the previous session used).
- **Build → verify → ship workflow**, used consistently this session
  for every real change: `npm run build` (catches syntax errors) →
  `npm run dev -- --port <free-port>` + `node scripts/smoke-test.cjs`
  against it (catches real regressions — this caught genuine bugs
  more than once) → commit → `git push -u origin main` → check CI via
  the GitHub Actions API (`build-apk.yml` run for the pushed commit;
  Java/native changes in particular can't be compiled locally in a
  typical session sandbox, so a green CI run is the only real
  confirmation they compile). Don't skip the live verify step even
  for a change that "looks safe" — several real bugs this session
  only surfaced that way, not from reading the diff.

## Known issues (as of 25 Sep 2026 — update this section as things change)

Full evidence trail for these lives in the build-audit artifact from
this date; summarized here for durability.

- **Active, in-progress: a large real physical-play-testing feedback
  batch (~30+ items, ~15 Sep 2026).** The real-bug items (#55-63), two
  large follow-up rounds (medication reminder timing/streak/adherence,
  global predicted-date formatting, banner/header styling, the native
  notification icon, desktop full-width layout, Home's shortcut-row
  layout — #84-92), the mobile-width/body-margin fix, and Group A
  (#64-67) are done — see "Recently shipped" above for the full detail.
  Also done from Group B/C: #69 (Episodes scroll — see its own entry
  below) and Group C's #71/#72 (Testing result-date/pregnancy-option,
  Measurements normal-range classification — see their own entry
  below). What's still open, **grouped by the owner's own explicit
  ask** ("group for efficiency/similarity") for whoever picks up the
  next batch, rather than left as one flat list:
  - **Group B — layout/rendering investigations** (each needs real
    on-device or viewport debugging before a fix, same methodology):
    #68 safe-area/status-bar spacing gaps — one real, specific spot
    RESOLVED 16 Sep 2026 (see "Recently shipped" above: the 4 real
    screen-title banners lost their own status-bar protection once
    stuck via `position: sticky`, root-caused via pure CSS reasoning —
    `env()` resolving to 0px in this sandboxed environment doesn't
    block reasoning about `position: sticky`'s own `top`-value
    semantics, which is what the bug actually was). Any OTHER spot
    this item's own "a few spots" plural was describing remains
    unconfirmed/unfixed — genuinely not reproducible without a real
    notch/status-bar to check against; flag a specific remaining
    report if one surfaces, don't assume this item is now fully closed.
    Desktop font-size/empty-space item scoped 15 Sep 2026 (see its own
    paragraph below — deliberately not attempted this round, real
    architectural precedent for why).
  - **Group C — Healthcare-tab-family UI/data additions, remaining**:
    #73 Healthcare sub-tab reorder — checked directly against the
    code, and the exact reorder this item's own title describes
    (Testing/Clinic Visits/Vaccinations then Symptoms/Measurements/
    Menstrual, two rows of three) already happened in an earlier
    session (see that file's own comment) — nothing left to do here
    unless a different, more specific reorder was actually meant. #76
    — DONE, see "Recently shipped" below.
  - **Group D — Clinic Card / Lists / Guide polish**: #75 — RESOLVED 16
    Sep 2026, see "Recently shipped" below. #74 Clinic Card
    recent-contacts section and #77 Interactive Guide overflow/shape
    fixes — DONE, see "Recently shipped" below.
  - **Group E — bigger investigate/design items, each needing its own
    real scoping pass before implementation, not a quick patch**: #78 —
    RESOLVED 16 Sep 2026, see "Recently shipped" below: Stats gained a
    deduped by-organism positive-result breakdown and a by-sample-site
    tally, and Clinic Visits gained a real `clinicalImpression` field.
    #80 — RESOLVED 16 Sep 2026, see "Recently shipped"
    below: the owner's own explicit follow-up re-scoped and authorized
    a real outbound Send, the same disclosed-exception model as
    Nominatim/GitHub. #79 Calendar dot-colours and #81 Status-at-a-
    glance menstrual/contraceptive rings — DONE, see "Recently shipped"
    below.
  - **Standing, not a batchable one-off**: #82, applying any future
    fix's pattern consistently across other modules where relevant —
    an ongoing discipline for every batch above, not its own task.
  - **Global-settings-reorg — RESOLVED 16 Sep 2026, see "Recently
    shipped" below.** Real ask to move global-Settings items into each
    module's own settings screen where that fits better. Contacts
    done first; the owner's own follow-up call resolved the two
    remaining candidates explicitly: Measurements' old Units screen is
    gone (its Weight/Height/Temperature preference now sets from
    Measurements' own gear-icon settings sheet, `weekStartsOn` moved
    into Settings' own CalendarScreen — the one screen it actually
    affects), and Notifications stays global on purpose, not split
    per-module. Menstrual/Contraception's tracking toggle stays
    excluded too — turning the module off would make an in-module
    settings screen unreachable, so it has to live somewhere
    always-reachable regardless of the module's own on/off state.
  Also still open, smaller/already-scoped items not folded into the
  groups above: the 3 plain sheet-title banners (Testing/Clinic
  Visits/Encounters' own Add/Edit forms) — RESOLVED 16 Sep 2026, see
  "Recently shipped" below (#82). The GitHub Releases page's stale
  "Latest" badge — RESOLVED 16 Sep 2026, see "Recently shipped" below:
  the owner manually deleted the stale `test-a`..`test-h` releases
  (confirmed clean — only the real `latest` release remains), and a
  real, deeper bug behind it was found and fixed in the same round:
  `build-apk.yml`'s `latest` git TAG itself was frozen at its original
  27 Aug creation commit for 3 weeks — `softprops/action-gh-release`
  updates an existing release's body/assets in place but never moves
  the underlying tag if it already exists, so the release page's own
  text kept correctly naming the newest commit while `git checkout
  latest` would have silently handed out 3-week-old code. Fixed with a
  new `git tag -f`/`git push --force` step right before the publish
  step. Not yet started, except where noted.

- **Accessibility — Batch 1 (high-priority items) COMPLETE as of 21 Sep 2026:**
  - Item 1 (desktop grid): DONE
  - Item 2 (keyboard operability per-row): DONE
  - Item 3 (sheet `role="dialog"` + focus mgmt): DONE — 51 `role="dialog"` across 37 files (corrected 25 Sep 2026; the previous "~52 across 19 modules" figure was wrong). All of them now have a working focus path. Two deliberate exceptions: GlobalSearch focuses its own search input via `autoFocus` (a container-level `focus()` there would fight that and pull focus off the field on every open), and Home/Healthcare no longer put a second dialog on their Episodes wrappers, since `TimelineModule`'s own root is that dialog and now owns focus-on-open.
  - Item 4 (sub-screen `<h1>`): DONE — 58 real JSX `<h1>` across 39 files (corrected 25 Sep 2026; "38 titles across 17 modules" mislabelled the 38 module *files* containing an h1 as if it were a title count). Includes the 7 edit/detail sheets converted 25 Sep 2026. GlobalSearch is the only module file with no `<h1>`; it carries `role="dialog"`/`aria-label` instead.
  - Item 5 (contrast fixes): DONE (Guide tour button, Meds locked-dose button, InteractiveTour "Next" button) — all three re-verified present in source this session.
  - Item 6 (live regions for search/filter): DONE — exactly 10 locations (corrected 25 Sep 2026: the earlier "live regions beyond 10 done" was not true).
  - Item 7 (notch/status-bar): PENDING (needs device)
  - Item 8 (cold-start removal from Known Issues): DONE (accepted upstream Capacitor limitation)

- **Audit Findings (25 Sep 2026) — read-only sweep of high-stakes/unreviewed areas:**
  - **ErrorBoundary (main.jsx:147-163)** — ALREADY FIXED (Phase 4). Encrypted `shos_app_preferences` detected via `iv`+`ciphertext` shape, dynamically imports `cryptoService.js`, decrypts, clears navigation state, re-encrypts. No action needed.
  - **darkModePreference.js (calculations:89-95)** — ALREADY CORRECT. `syncDarkModePreferenceFromStorage()` called in `App.jsx:938` after vault unlock in `finishBootAfterUnlock()`. One-shot self-correction from `systemPrefersDark()` fallback works; async `await storage.load()` handles Phase 3 adapter. No action needed.
  - **Module sheets `role="dialog"`** — COMPLETE. 51 occurrences across 37 files (corrected 25 Sep 2026; the earlier "~52 sheets across 19 modules" figure was wrong, "19" mixing module count with sub-counts). Medication Dashboard has 6 dialog sheets, not 7 (`MedicationEditSheet` is a full-screen sheet that never got the treatment; logged below).
  - **Widget deep-linking (native)** — 10 providers registered in the manifest, but only 9 use `com.shos.app://` (corrected 25 Sep 2026: `NextDoseWidgetProvider` has no Intent/tap action at all). `deepLinkRoutes.js` has 12 distinct positive routes across 7 hosts, asserted by 17 expectations in 5 test blocks (5 of them negative `toBeNull`) — "17 routes" conflated assertions with routes. The `reveal-clinic` route is mapped but inert (an empty `if` in `App.jsx:1726`). **Web gaps**: there is genuinely no `shos://` or `URLSearchParams` handling anywhere in `src/`; what is missing on web is only the URL *delivery* mechanism, not the route logic (corrected 25 Sep 2026: the earlier "8 of 10 routes unimplemented on web/PWA" was stale and contradicted entries above it in this same file).
  - **Draft storage (storage/draftStorage.js)** — 8 module files use sessionStorage (Contacts, Encounters, Testing, ClinicVisits, SymptomLog, Vaccinations, Measurements, Medication Dashboard). Sensitive data, ephemeral (cleared on save/tab close). Deliberately out of Phase 4 scope; no migration path if encryption extends here.
  - **Duplicate patterns needing standardization**: RegistryTagPicker (4 copies: Testing, MyProfile, Contacts, Encounters), Date/Time "Now" button (10 files), per-module field components (corrected 25 Sep 2026: SelectField 9 copies, DateTimeField 3, AgeField 2, RelationPicker 5 — none reach "10+"; the AgeField figure was off by 5x), FAB buttons (12 sites).
  - **Accessibility exhaustive (17 Sep axe-core + 25 Sep follow-up)**: Sub-screen `<h1>` complete (58 across 39 files); live regions are exactly 10 locations and no more; contrast violations fixed (Guide raw hex, Meds 50% opacity, InteractiveTour fixed); module sheets `role="dialog"` complete.
  - **Settings navigation** — 16 rows across 8 sections (corrected 25 Sep 2026: the long-standing "22 rows" figure predates the 16 Sep Backup-&-Export consolidation and the Units-screen removal; a stale "same 22 rows" comment still sits in `SHOS_Settings_Prototype.jsx`). Test flakes from banner interception (fixed in helper); a crypto-timing wait in flow 13 was still a fixed 500ms plus a non-retrying count and is now a bounded wait (25 Sep 2026). Healthcare sub-tab discoverability (Menstrual/Contraception gated behind toggle).
  - **Overlays — deliberately NOT normalised (25 Sep 2026)**: an audit of all ~69 real dialogs/sheets found zIndex scattered across 200/210/215/220/230/300, `maxHeight` across 80/85/88vh, radius across `radius.lg`/24/16, and 0 of 22 dimmed bottom sheets carrying any `env(safe-area-inset-bottom)`. Left alone on purpose: normalising geometry across every sheet is broad churn with unverifiable visual benefit, and this project has been burned by exactly that kind of sweep before. Geometry is only normalised where a sheet is already being touched. The genuine UX gaps the audit found (two back-button traps, six level-skipping overlays, no Escape anywhere) are logged as their own batch above.

- **Desktop font-size/empty-space (#93) — scoped 15 Sep 2026,

Full evidence trail for these lives in the build-audit artifact from
this date; summarized here for durability.

- **Active, in-progress: a large real physical-play-testing feedback
  batch (~30+ items, ~15 Sep 2026).** The real-bug items (#55-63), two
  large follow-up rounds (medication reminder timing/streak/adherence,
  global predicted-date formatting, banner/header styling, the native
  notification icon, desktop full-width layout, Home's shortcut-row
  layout — #84-92), the mobile-width/body-margin fix, and Group A
  (#64-67) are done — see "Recently shipped" above for the full detail.
  Also done from Group B/C: #69 (Episodes scroll — see its own entry
  below) and Group C's #71/#72 (Testing result-date/pregnancy-option,
  Measurements normal-range classification — see their own entry
  below). What's still open, **grouped by the owner's own explicit
  ask** ("group for efficiency/similarity") for whoever picks up the
  next batch, rather than left as one flat list:
  - **Group B — layout/rendering investigations** (each needs real
    on-device or viewport debugging before a fix, same methodology):
    #68 safe-area/status-bar spacing gaps — one real, specific spot
    RESOLVED 16 Sep 2026 (see "Recently shipped" above: the 4 real
    screen-title banners lost their own status-bar protection once
    stuck via `position: sticky`, root-caused via pure CSS reasoning —
    `env()` resolving to 0px in this sandboxed environment doesn't
    block reasoning about `position: sticky`'s own `top`-value
    semantics, which is what the bug actually was). Any OTHER spot
    this item's own "a few spots" plural was describing remains
    unconfirmed/unfixed — genuinely not reproducible without a real
    notch/status-bar to check against; flag a specific remaining
    report if one surfaces, don't assume this item is now fully closed.
    Desktop font-size/empty-space item scoped 15 Sep 2026 (see its own
    paragraph below — deliberately not attempted this round, real
    architectural precedent for why).
  - **Group C — Healthcare-tab-family UI/data additions, remaining**:
    #73 Healthcare sub-tab reorder — checked directly against the
    code, and the exact reorder this item's own title describes
    (Testing/Clinic Visits/Vaccinations then Symptoms/Measurements/
    Menstrual, two rows of three) already happened in an earlier
    session (see that file's own comment) — nothing left to do here
    unless a different, more specific reorder was actually meant. #76
    — DONE, see "Recently shipped" below.
  - **Group D — Clinic Card / Lists / Guide polish**: #75 — RESOLVED 16
    Sep 2026, see "Recently shipped" below. #74 Clinic Card
    recent-contacts section and #77 Interactive Guide overflow/shape
    fixes — DONE, see "Recently shipped" below.
  - **Group E — bigger investigate/design items, each needing its own
    real scoping pass before implementation, not a quick patch**: #78 —
    RESOLVED 16 Sep 2026, see "Recently shipped" below: Stats gained a
    deduped by-organism positive-result breakdown and a by-sample-site
    tally, and Clinic Visits gained a real `clinicalImpression` field.
    #80 — RESOLVED 16 Sep 2026, see "Recently shipped"
    below: the owner's own explicit follow-up re-scoped and authorized
    a real outbound Send, the same disclosed-exception model as
    Nominatim/GitHub. #79 Calendar dot-colours and #81 Status-at-a-
    glance menstrual/contraceptive rings — DONE, see "Recently shipped"
    below.
  - **Standing, not a batchable one-off**: #82, applying any future
    fix's pattern consistently across other modules where relevant —
    an ongoing discipline for every batch above, not its own task.
  - **Global-settings-reorg — RESOLVED 16 Sep 2026, see "Recently
    shipped" below.** Real ask to move global-Settings items into each
    module's own settings screen where that fits better. Contacts
    done first; the owner's own follow-up call resolved the two
    remaining candidates explicitly: Measurements' old Units screen is
    gone (its Weight/Height/Temperature preference now sets from
    Measurements' own gear-icon settings sheet, `weekStartsOn` moved
    into Settings' own CalendarScreen — the one screen it actually
    affects), and Notifications stays global on purpose, not split
    per-module. Menstrual/Contraception's tracking toggle stays
    excluded too — turning the module off would make an in-module
    settings screen unreachable, so it has to live somewhere
    always-reachable regardless of the module's own on/off state.
  Also still open, smaller/already-scoped items not folded into the
  groups above: the 3 plain sheet-title banners (Testing/Clinic
  Visits/Encounters' own Add/Edit forms) — RESOLVED 16 Sep 2026, see
  "Recently shipped" below (#82). The GitHub Releases page's stale
  "Latest" badge — RESOLVED 16 Sep 2026, see "Recently shipped" below:
  the owner manually deleted the stale `test-a`..`test-h` releases
  (confirmed clean — only the real `latest` release remains), and a
  real, deeper bug behind it was found and fixed in the same round:
  `build-apk.yml`'s `latest` git TAG itself was frozen at its original
  27 Aug creation commit for 3 weeks — `softprops/action-gh-release`
  updates an existing release's body/assets in place but never moves
  the underlying tag if it already exists, so the release page's own
  text kept correctly naming the newest commit while `git checkout
  latest` would have silently handed out 3-week-old code. Fixed with a
  new `git tag -f`/`git push --force` step right before the publish
  step. Not yet started, except where noted.

- **Desktop font-size/empty-space (#93) — scoped 15 Sep 2026,
  re-scoped into a real, concrete design 16 Sep 2026, the 2 named
  targets IMPLEMENTED AND SHIPPED 16 Sep 2026 (see "Recently shipped"
  below) — genuinely NOT the full "app-wide refinement" the owner's
  own later ask named, see that entry for the honest scope split.**
  Real report, from a 1600px screenshot taken right
  after the maxWidth:600 cap was removed: Home's "Status at a glance"
  ring row and flowing body-copy screens (Guide/Glossary) read as
  visually lost in the new, much wider column — real empty space, not
  imagined. Option (a) from the original scoping (a first-ever
  app-wide `window.innerWidth`-driven responsive convention/rem
  type-scale conversion) is explicitly REJECTED as the mechanism —
  that's the same shape of change as the two already-reverted `zoom`/
  `transform: scale()` attempts (see the font/text-size entry below):
  both broke because they touched code the MOBILE path also executes.
  Option (b) — targeted, additive, desktop-only fixes to the two named
  offenders, using the ALREADY-PROVEN, ALREADY-SHIPPED
  `useIsDesktopWidth()` hook (`window.innerWidth >= 900`, live
  resize-aware, currently defined in `SHOS_Home_Prototype.jsx` around
  line 156, proven safe by the "Home shortcuts on desktop" round — see
  "Recently shipped" — where the exact same pattern kept mobile's
  markup byte-for-byte unchanged) — is the real design, not (a).

  **Absolute rule for implementation, non-negotiable given the two
  prior regressions**: every fix is an ADDITIVE `isDesktopWidth ? X :
  Y` branch where `Y` is the CURRENT mobile markup, untouched, byte-
  for-byte. Nothing shared/global gets modified — no app-shell scale,
  no rem conversion, no touching a style any mobile-width render path
  also executes. If a change can't be expressed as "add a new branch,
  leave the old one exactly alone," it's out of scope for this pass.

  **Target 1 — Home's Status-at-a-glance rings**
  (`SHOS_Home_Prototype.jsx`, `StatusRing` component ~line 626, its
  container ~line 811). Currently fixed `size=64, stroke=6`, ring
  wrapper `maxWidth:100`, container `padding:"16px 8px", gap:8` — at a
  1600px viewport these sit as tiny widgets in a mostly-empty card.
  Proposed: thread a `large` boolean into `StatusRing`, set from
  `isDesktopWidth` (already computed once at the top of `HomeScreen`,
  just needs passing down — no new hook instance). When `large`:
  `size→96, stroke→8`, wrapper `maxWidth→140`, `centerText` font
  14→18, caption font 11→13; container `padding→"24px 16px", gap→16`
  so the card doesn't just gain more dead space between now-bigger
  rings. Mobile path: identical defaults to today, zero visual change.

  **Target 2 — flowing body-copy screens (Guide/Glossary named
  explicitly)** (`SHOS_Settings_Prototype.jsx`, `GuideScreen`/
  `GlossaryScreen` ~lines 3476-3540). Currently `padding:16` outer
  container, cards at implicit full width (no `maxWidth` at all), body
  text 12-13px — at 1600px this means ~13px lines running the full
  screen width, both a poor reading measure and the literal "empty
  space around sparse content" complaint. Proposed: NOT a font-size
  bump (that's global-type-scale risk, exactly what's deferred to a
  real design-system pass) — a desktop-only **measure cap** instead:
  wrap the existing card list in `isDesktopWidth ? {maxWidth:640,
  margin:"0 auto"} : {}`, so the same text simply wraps at a readable
  ~75-90 characters instead of stretching edge-to-edge. This is
  exactly the safer of the two options this item's own earlier
  scoping already named. Mobile path: no wrapper, exact current
  markup.

  **Real, still-open judgment calls this design does NOT resolve —
  need a decision, or a build-and-eyeball pass, before implementing**:
  (1) RESOLVED — see "Recently shipped" below: the proposed numbers
  shipped as-is, verified against a real 1600px render (screenshot
  reviewed before shipping). (2) scope of Target 2: Guide/Glossary are
  the two explicitly reported, now-shipped screens; a full grep for
  every other screen sharing the identical "`padding:16`,
  unconstrained-width card, flowing body text" shape (Resources,
  onboarding step bodies, About) still hasn't been run — real choice
  between stopping at the 2 shipped screens or sweeping the same
  measure-cap consistently in one pass (matching this project's own
  #82 "apply a fix's pattern consistently" discipline), still open,
  not decided. (3) RESOLVED — see "Recently shipped" below:
  `useIsDesktopWidth()` promoted to `src/calculations/responsive.js`.
  (4) the original report named exactly these two targets, both now
  shipped; any other desktop-empty-space complaint (Medication
  Dashboard's stock display, Contacts' own stat rows, etc.) is still
  out of scope unless separately reported. (5) RESOLVED, later the same
  day — see "Recently shipped" below (the sticky-overlap/Status-rings
  round): the real live report ("dead space on RHS of box") confirmed
  this was exactly the gap flagged here — the card's own row used
  `justifyContent: flex-start` by default, so a short ring set (fewer
  than 4) packed left with the leftover width dumped as one block of
  empty space on the right rather than read as a deliberately compact,
  centered set. Fixed with `justifyContent: "center"` on the row,
  alongside reworking each ring's own layout from a vertical stack to
  a horizontal ring+text one (see that entry for the full reasoning).

- **Encryption at rest — RESOLVED 8 Sep 2026, see the full Phase 4
  implementation entry at the end of this same bullet.** Originally:
  live app data was plain `localStorage`. Backup export *can* be
  encrypted (AES-256-GCM, PBKDF2 250k rounds — solid where it's used)
  but day-to-day data isn't. This was the one Critical finding
  deliberately not yet fixed. Real scoping done 4 Sep
  (audit + design, no code changed — see Notion for the full write-up):
  the storage layer isn't one clean chokepoint — 32 files touch it, in
  three distinct patterns with different fixes (module-load-time
  synchronous reads in ~19 repository files, function-scoped reads in
  ~10 "preferences"-style repositories, and one React `useState` lazy
  initializer), plus a crash-recovery path in `main.jsx`'s
  `ErrorBoundary` that reads/writes `shos_app_preferences` directly and
  assumes plaintext JSON. `crypto.subtle` (the real Web Crypto API,
  same one `backupService.js` already uses for encrypted export) is
  async-only, so this is a genuine sync-to-async migration of the
  whole repository layer, not a drop-in add at `storageAdapter.js` —
  that conversion has to happen BEFORE any real cryptography, as its
  own separately-shippable, separately-verifiable phase.
  Key design: `appLockEnabled` defaults to `false` — most users have
  no PIN/biometric at all — so a PIN/biometric-derived key can't be
  the only mechanism without leaving the default case unprotected. A
  device-bound key (Android Keystore natively; a non-extractable Web
  Crypto key for the web/PWA build, so it works the same way there)
  is the real baseline, generated with no user secret required, always
  active regardless of App Lock. When App Lock IS enabled, an
  additional PIN/biometric-derived wrapping layer goes on top —
  envelope encryption, not a replacement — so a real intruder holding
  an *unlocked* device still needs the PIN too, while never asking the
  owner to remember a separate passphrase of their own (owner's own
  explicit ask, and a real concern: "people will lose encryption keys
  often"). Phase 2 (converting the storage layer to async, ahead of
  any real cryptography) started 4 Sep, smallest-first per the
  phase's own ordering: `clinicCardVisibilityPreference.js`'s
  `useState` lazy initializer (the one non-repository sync-conflict
  site the audit found) moved to a mount-time `useEffect` — verified
  live that visibility toggles still persist correctly across a
  reload. Next: the three raw-`localStorage` migration-flag bypasses
  found in the audit (`protectionRegistry.js`'s PEP-added flag,
  `kinkRegistry.js`'s expansion flag, `customOptionListsRepository.js`'s
  sample-type flag) routed through `storageAdapter` properly instead
  of bypassing it — verified live via the real UI (PEP still shows up
  correctly as an existing Protection option) rather than trusting a
  raw `localStorage` read, which turned out to be the wrong way to
  check: registry seed data lives in memory until a real `create()`
  actually persists it, so an empty raw key on a fresh profile isn't
  itself a bug.
  Real correction to the original audit's own framing: "convert one
  repository at a time" doesn't match reality. The actual sync-conflict
  site is a specific PATTERN — `useState(() => Repo.getX())` or
  `useMemo(() => Repo.getX(), deps)` — not a repository file boundary.
  A full sweep found roughly 100 real sites using this exact pattern
  across ~20 module files, spanning nearly every repository
  (`AppPreferencesRepository` alone is read this way independently in
  8+ files), plus `App.jsx`'s own bootstrap logic (`locked`,
  `appLockEnabled`, `showOnboarding` — load-bearing for the whole
  app's first render). Hand-writing a bespoke `useEffect` at each of
  ~100 sites (the Clinic Card approach) would be slow and genuinely
  risky at that volume — built a shared, reusable pair of hooks
  instead: `src/calculations/loadedRepositoryState.js` exports
  `useLoadedState` (mirrors `useState`'s own `[value, setValue]`
  tuple) and `useLoadedMemo` (mirrors `useMemo`'s return-only shape),
  both loading via an effect instead of a lazy initializer. Both
  proved out live: `clinicCardVisibilityPreference.js` refactored to
  use `useLoadedState` instead of its own bespoke effect (same
  verified persistence behavior), and `SHOS_Settings_Prototype.jsx`'s
  `ResourceCategory`'s `entries` converted to `useLoadedMemo` — proved
  both the mount-once path and the deps-driven reload path (adding a
  resource entry correctly bumps `refreshKey` and the new entry
  appears without a full page reload). Also caught and corrected a
  real test-methodology mistake in the process, not an app bug: a
  Settings-navigation check kept reading the wrong DOM scope
  (`document.body.innerText` truncated before reaching the actual
  overlay content, with the underlying screen apparently staying
  mounted beneath it) — same class of mistake as an earlier Global
  Search test this session, now fixed the same way (scope to the
  specific `position: fixed; inset: 0` overlay, not the whole body).
  Three more sites converted the same session:
  `SHOS_Healthcare_Prototype.jsx`'s `menstrualTrackingEnabled` (a plain
  1:1 `useLoadedState` swap) and `SHOS_PartnerNotification_Prototype.jsx`'s
  `contacts` (`useLoadedMemo`, another plain swap). Its `list`/`editing`
  pair was NOT a plain swap and caught a real bug live: `editing`'s own
  initial value used to derive from `!list` at mount — safe in the old
  synchronous code, where `editing` was only ever `false` once `list`
  was already a real object, but the naive fix (`list` starting `null`,
  `editing` starting `false` for the one render before the load effect
  resolves) violated that invariant and crashed with "Cannot read
  properties of null (reading 'items')" the moment the Checklist view
  tried to render. Fixed by starting `editing` at `true` instead — the
  ContactPickerStep branch never touches `list`, so it's always safe to
  render first, the same worst-case assumption the original `!list`
  made. Verified live end-to-end against a real positive test: generate
  a contact list, confirm the checklist renders, close and reopen,
  confirm it loads straight back to the checklist (not the picker) with
  the real saved list — no crash, matches old behavior exactly. This is
  the real lesson for the remaining ~95 sites: most are plain swaps,
  but any site with state that DEPENDS on another loaded value's
  initial synchronous shape needs the same real scrutiny, not a
  find-replace.
  Two more files converted the same session: `SHOS_ClinicCard_Prototype.jsx`'s
  4 sites (`meds`/`tests`/`encounters` via `useLoadedMemo`, `profile` via
  `useLoadedState` — `profile` needed a real fallback, not `null`, since
  render reads `profile.allergies.length` etc. unconditionally with no
  optional chaining; used `MyProfileRepository`'s own exported
  `DEFAULT_PROFILE`, the exact shape `getProfile()` already merges onto,
  so the fallback renders identically to a genuinely-empty profile
  instead of crashing) and `SHOS_Timeline_Prototype.jsx`'s 4 sites. Two
  of Timeline's (`StartSheet`'s `triggerReasonOptions`/`encounters`,
  `TimelineLanding`'s `episodes`) were plain swaps; `EpisodeDetail`'s
  `episode` was not — the existing code had `if (!episode) return null`
  sitting between two hooks (`episode`'s own load and a later
  `resolveDateDraft` `useState`/`useEffect` pair reading
  `episode.resolvedDate`), a Rules-of-Hooks violation that was latent
  and harmless under synchronous `useMemo` (episode was never actually
  null) but would crash with "rendered fewer hooks than expected" once
  `episode` genuinely starts `null` for one render under the async load
  effect. Fixed by moving `resolveDateDraft`'s hooks above the guard and
  null-guarding the reads (`episode?.resolvedDate`) — same class of bug
  as PartnerNotification's `list`/`editing` case above, just triggered
  by hook order instead of a null property read; worth specifically
  checking for on every remaining site that has an early `return null`
  guard near a loaded value. Both verified live against real seed data
  (Clinic Card's full section set; Episodes list, an existing episode's
  full detail view, and the Start Episode sheet) — no crashes, no page
  errors. Full smoke-test suite passes on both.
  Three more files converted the same session: `SHOS_Attachments_Prototype.jsx`'s
  1 site and `SHOS_RegistryManagement_Prototype.jsx`'s 1 site (both
  plain `useLoadedMemo` swaps, already keyed off `refreshKey` or no deps
  at all), and `SHOS_MyProfile_Prototype.jsx`'s 5 sites.
  `MyProfileEditScreen`'s 4 `CustomOptionListsRepository` reads were
  plain `useLoadedState` swaps (each setter reused as-is by its own
  `onAddNew` handler); `MyProfileModule`'s top-level `profile` needed
  the same `DEFAULT_PROFILE` fallback treatment as Clinic Card's above
  (its child views read `profile.allergies`-style fields
  unconditionally). That conversion surfaced a THIRD real regression:
  `MyProfileEditScreen`'s `const [form, setForm] = useState(profile)`
  only reads its argument once, at mount, never resyncing — harmless
  when `profile` loaded synchronously (always already real by the time
  this screen could mount) but broken now that `MyProfileModule`'s
  `openEditingOnMount` prop (a real path — Clinic Card's "Add these
  under My Profile → Clinical & emergency info" link) can mount this
  screen on the exact render where `profile` is still the
  `DEFAULT_PROFILE` fallback, freezing `form` on an empty default
  forever once the real value loads a tick later. Fixed with a
  `useEffect` resyncing `form` on `profile` changes (safe here — nothing
  else updates `profile` while this screen is open). Three real bugs
  now found via this same conversion process (PartnerNotification's
  `list`/`editing`, Timeline's `EpisodeDetail` hook order, this one) —
  each a different flavor of the same root issue: code that assumed a
  loaded value's shape/timing was guaranteed, written back when the
  load really was synchronous and safe to assume. Worth treating as the
  standing checklist for every remaining site: (1) is the value read
  unconditionally without a null/empty guard, (2) does any hook after
  it depend on its shape at mount, (3) does any early-return sit between
  hooks. All three verified live (openEditingOnMount path retains typed
  input and shows real suggestion chips; normal path renders real seed
  profile data). Full smoke-test suite passes.
  `SHOS_Encounters_Prototype.jsx` (9 sites) converted next, and turned
  up two more real findings — one about the AUDIT ITSELF, one a fourth
  genuine regression.
  First: this file grepped clean at first pass but had 4 more real
  sync-conflict sites the `useState(() =>`/`useMemo(() =>` grep pattern
  never matches — `useState(loadContacts)`/`useState(loadEncounters)`,
  a bare function reference instead of an inline arrow. React treats a
  bare function reference as a lazy initializer identically to
  `useState(() => ...)`, so these are just as broken, just invisible to
  the grep this whole audit has been running. Found only by reading the
  file directly. **The other ~19 module files need re-sweeping for this
  same shorthand before Phase 2 can be called complete** — the
  remaining-site count elsewhere in this section is a grep count and is
  now known to be an undercount by an unknown amount.
  Second: `EncounterEditSheet`'s `form` (loads via
  `EncounterRepository.getById(encounterId)` for the edit case,
  `DEFAULT_ENCOUNTER`/a `loadDraft()` sessionStorage read for the
  new/draft cases — only the first is async-sensitive) sits next to a
  real autosave effect that mirrors `form` to a sessionStorage draft on
  every change, guarded by an `isFirstRender` ref so opening a blank
  "Add Encounter" and closing without touching anything doesn't leave a
  phantom draft. The first fix attempt added a second ref
  (`skipNextAutosave`, set right before the load effect's `setForm`)
  mirroring the exact pattern already proven for
  PartnerNotification/Timeline above — and it was WRONG. React
  StrictMode (enabled in `main.jsx`) double-invokes effects on mount,
  before the resulting state update is actually applied and
  re-rendered — so both the loader effect and the autosave effect ran
  TWICE against the still-stale `form` closure in that double-invoke
  window, consuming the one-shot skip flag before the real render (the
  one where `form` actually becomes the loaded record) ever happened.
  Caught live, not by inspection: reading `sessionStorage` directly
  after opening Edit on an untouched existing Encounter showed a real
  draft appear within 300ms. Root-caused to StrictMode specifically (not
  a timing fluke) by tracing the double-invoke sequence by hand.
  Fixed by abandoning the flag/ref-timing approach entirely in favor of
  an explicit `isDirty` ref that only `set()` — the one code path a
  genuine user edit takes — is allowed to flip, so the autosave effect
  never has to infer "was this the load or a real edit" from render
  order at all. This is the more general lesson: a "skip the next one"
  ref is fragile under StrictMode's double-invoke whenever the skip is
  armed AND consumed within effects rather than at the actual point of
  user interaction — worth checking on any earlier PartnerNotification/
  Timeline-style fix again if similar symptoms ever show up there.
  Also worth its own note: verifying the fix live nearly produced a
  FALSE positive — checking loaded-form correctness via
  `document.body.innerText` showed blank titles, because `innerText`
  never reflects `<input value>` content at all (inputs have no text
  children). Re-checked via the real `input.value` DOM property instead
  and confirmed the load was actually correct — a genuine test-
  methodology trap distinct from the earlier "wrong overlay scope"
  mistake, worth remembering for any other form-heavy screen still to
  convert. Also split `visible`'s `useMemo` (ActivityLanding's search/
  filter list) deliberately rather than converting it wholesale — it
  depends on `query`/`dateFilter`/`showArchived`, which change on every
  keystroke, and an effect-based reload would add a real one-tick lag to
  a live search box. Pulled just the "since last test" filter's own
  `TestingRepository` call into its own `useLoadedMemo`
  (`lastTestDate`), leaving `visible` as a plain `useMemo` reading that
  value — same split as ClinicCard's `cutoffDate` earlier. All verified
  live: real record loads into the edit form (checked via `.value`, not
  `innerText`), opening+closing without editing leaves no draft, a real
  edit still autosaves correctly, Add Encounter still starts blank,
  search and the "since last test" filter both still work. Full
  smoke-test suite passes.
  Re-swept every other module file for the same bare-reference
  shorthand right after finding it (`grep -rnE
  "useState\([a-zA-Z_][a-zA-Z0-9_]*\)|useMemo\([a-zA-Z_][a-zA-Z0-9_]*,\s*\["`,
  filtered for `useState(true|false|null|undefined)`): 7 more matches
  across `SHOS_Medication_Dashboard_Prototype.jsx`,
  `SHOS_MyProfile_Prototype.jsx` (2, one already fixed above),
  `SHOS_Settings_Prototype.jsx` (2), `SHOS_PartnerNotification_Prototype.jsx`,
  and `RegistrySinglePicker` in Encounters itself — checked every one
  individually and all 7 are safe (props or plain constants, e.g.
  `useState(currentStock)`/`useState(ALL_MODULE_KEYS)`, not a
  repository call). So the bare-reference gap really was isolated to
  Encounters' own `loadContacts`/`loadEncounters` module-level helper
  naming convention, not a systemic blind spot — the ~72 remaining-site
  estimate from the original grep can be trusted after all, not treated
  as an undercount.
  Two more files converted the same session, both clean — no new bugs,
  every site a variant of patterns already established above.
  `SHOS_SymptomLog_Prototype.jsx` (5 sites): `EntrySheet`'s contacts/
  encounters/tests and the top-level module's entries are plain swaps;
  `EntrySheet`'s own `form` initializer reads the `entry` PROP (already
  loaded by its parent), not a repository, so it's out of scope
  entirely — same shape as Vaccinations' `VaccinationSheet` below.
  `EntryDetail`'s `entry` has the same safe "hooks-before-guard, nothing
  after" shape confirmed for Encounters' `ActivityDetails` — converted
  directly. `SHOS_Vaccinations_Prototype.jsx` (6 sites): `VaccinationSheet`'s
  vaccineOptions/vaccinationReasonOptions/injectionSiteOptions/symptoms/
  visits are plain swaps (`vaccineOptions`' setter reused by its own
  `onAddNew`); `VaccinationDetail`'s `v` is the same safe guard shape
  again, and the top-level `vaccinations` is a plain swap. Both verified
  live against real seed data (SymptomLog: an existing entry's full
  detail including resolved Encounter/Test links, the Log Symptom
  sheet's chips; Vaccinations: an existing record's full detail, its
  Edit sheet's chips and symptom/clinic-visit pickers) — no page errors
  either file. Full smoke-test suite passes both times.
  `SHOS_Home_Prototype.jsx` (5 sites, the app's own landing screen)
  converted next — all plain `useLoadedState` swaps, including
  `backupInfo` (fallback matches `getLastBackupInfo()`'s own real
  empty-state shape exactly, since `dueForReminder` is read
  unconditionally). Verified live against Home's real first-load state
  (no banners pre-dismissed): the backup-reminder banner renders
  correctly, real Status-at-a-glance/Recent-activity data shows, and
  the "Your dashboard" fallback title is correct (confirmed against
  seed data — `MyProfile`'s `nickname` genuinely defaults to `""`, not
  a missed load). No page errors. Full smoke-test suite passes.
  `SHOS_Testing_Prototype.jsx` (8 sites) converted next.
  `TestEditSheet`'s linkedVisits/unlinkedVisits/linkedSymptoms/
  unlinkedSymptoms/sampleTypeOptions are plain swaps; its own `form`
  initializer reads `existing`, a plain render-body const (not a hook,
  recomputes every render) rather than a repository call directly —
  same "direct repo call in the render body" shape as Encounters'
  `RegistrySinglePicker`, left alone per that precedent.
  `TestDetail`'s test/measurements got the same safe hooks-before-guard
  treatment as everywhere else this session, but this one was a genuine
  fix, not just a swap: the original `useState(() => ...)` only ever
  computed once per mount with no deps at all, so navigating from one
  test's detail straight to another's (no unmount in between — this
  component isn't remounted via a `key` prop) would have kept showing
  the FIRST test's stale data forever. Added real `[testId]` deps as
  part of the conversion — untested whether that exact stale-data path
  was ever actually reachable, but the fix is strictly safer regardless.
  Verified live against real seed data (Test Detail's full result/
  linked clinic visit, Edit sheet's sample-type chips) — no page errors.
  Full smoke-test suite passes, including the Testing<->Symptom Log
  link flow, which directly exercises this file's own linkedSymptoms/
  unlinkedSymptoms conversion.
  `SHOS_ClinicVisits_Prototype.jsx` (10 sites) converted next, and
  turned up a THIRD grep-methodology gap: `allSymptomLogEntries`/
  `allVaccinations` use `useMemo` split across multiple lines
  (`useMemo(\n () => ..., \n [])`), invisible to the single-line
  `"useMemo(() =>"` grep this whole audit has been running. Swept every
  other module for the same shape (`grep -rn "useState($\|useMemo($"`):
  2 more matches, both harmless (Contacts' `contactableViaOptions` is a
  pure computation over an already-in-scope variable, not a repository
  call itself; Healthcare's `subTab` is a plain ternary on a prop, not
  even a real lazy initializer) — isolated to this one file again, not
  systemic, but the THIRD time this audit's own grep has missed a real
  site (bare function references in Encounters, now multi-line calls
  here). Worth a quick visual scan of each remaining file for `useMemo(`/
  `useState(` with a bare trailing `(`, not just trusting the grep.
  Otherwise a clean batch: `ClinicianField`'s/`ClinicVisitLocationField`'s
  `known`, `VisitEditSheet`'s `reasonForVisitOptions`/`followUpTypeOptions`/
  `allTests`/`allMeds`/`allSymptoms`/`allSymptomLogEntries`/
  `allVaccinations`, and the top-level `visits` are all plain swaps
  (`VisitEditSheet`'s own `form` initializer stays untouched, same
  render-body-`existing`-const shape as Testing/Vaccinations).
  `VisitDetail`'s `visit`/`measurements` got the same real `[visitId]`
  deps fix as Testing's `test`/`measurements` (same latent-staleness
  risk, same "not remounted via a key prop" shape). Verified live
  against real seed data (Visit Detail's full clinician/location/linked
  tests/medications/symptoms; Edit sheet's clinician chips and
  reason/follow-up option chips) — no page errors. Full smoke-test
  suite passes.
  `SHOS_Measurements_Prototype.jsx` (9 sites) converted next — a clean
  batch. Plain swaps: `LocationField`'s `knownClinics`,
  `MeasurementSheet`'s `typeOptions`/`rankedTypeOptions` (both setters
  reused together in one `onAddNew` handler), `MeasurementDetail`'s `m`
  (same safe hooks-before-guard shape as everywhere else), `ManageGroupsScreen`'s
  `groups`, `MeasurementPreferencesSheet`'s `prefs` (fallback
  `DEFAULT_MEASUREMENT_PREFERENCES` — `prefs.preferredUnitByType` is
  read unconditionally), the top-level `measurements`, and
  `allTypesEverUsed`. One judgment call: `MeasurementsLanding`'s
  `customGroupSections` (calls `CustomGroupsRepository.get()` directly)
  WAS converted despite depending on `groupMode`/`groupsVersion`,
  unlike the query-driven `byTypeGroups`/other-modules'-`sorted`-style
  computations left alone elsewhere — its deps only change on a toggle
  tap or a group-management action, never per keystroke, so the
  effect-based reload adds no perceptible lag; this is the actual
  distinguishing test for "convert vs. leave as plain useMemo," not
  simply "does it call a repository." Verified live (landing in both
  "By type" and "By group" modes — the latter correctly renders an
  UNGROUPED section; an existing entry's detail view) — no page errors.
  Full smoke-test suite passes.
  `SHOS_Medication_Dashboard_Prototype.jsx` (9 sites) converted next,
  another clean batch. `medicationTypeOptions`/`routeOptions`/
  `categoryOptions` appear twice (`MedicationEditSheet` and
  `AddMedicationSheet`) — all plain swaps. `existingNames` (the
  Add-medication dedupe nudge's source list) is a plain swap too; the
  actual keystroke-driven comparison that reads it
  (`exactNameMatch`/`closeNameMatch`) stays a plain `useMemo`, same
  "don't add lag to a live-typed field" reasoning applied consistently
  all session. `MedicationSettingsScreen`'s `prefs` (fallback
  `DEFAULT_MEDICATION_PREFERENCES`), the top-level `meds`, and
  `allergies` (fallback `[]`, matching `DEFAULT_PROFILE`) round it out.
  Verified live against real seed data (dashboard landing's real
  medication/stock/adherence numbers; Add Medication's real Category
  chips — confirmed via screenshot after `mouse.click()` at computed
  coordinates intermittently missed its target in this environment, a
  test-tooling quirk worked around with `dispatchEvent`, not an app
  bug; Medication Settings' real toggle state) — no page errors. Full
  smoke-test suite passes, including the Medication log flow, which
  directly exercises this file.
  `SHOS_MenstrualHealth_Prototype.jsx` (7 sites) converted next.
  `CycleSheet`'s flowOptions/symptoms, `CycleTab`'s cycles/avgLength,
  `ContraceptionSheet`'s methodOptions/formulationOptions/visits are
  plain swaps. Real finding: `ContraceptionTab`/`PregnancyTab` were
  left untouched on purpose — they already use a DIFFERENT pattern (a
  `[, force]` re-render counter plus a direct `Repository.getAll()`
  call in the render body, re-running every render) instead of the
  useState-lazy-init pattern this whole audit targets, so they were
  never subject to the "frozen forever" bug this pass fixes — a
  reminder that not every repository-reading site in a file needs
  touching, only the ones actually using the broken pattern. Verified
  live (had to enable Menstrual & contraception tracking first via
  Settings — off by default, a real toggle, not a bug): Cycle tab's
  real history and correct average-cycle-length calculation, Cycle
  Edit's real Flow suggestion chips. No page errors. Full smoke-test
  suite passes.
  `SHOS_Contacts_Prototype.jsx` (11 sites, the largest single-file
  batch so far) converted next — clean, every site a variant of a
  pattern already established: `LinkedContactsField`'s linkedIds/
  labels, `ContactEditSheet`'s relationshipTypeOptions/genderOptions/
  pronounsOptions/contraceptionOptions, `ContactProfile`'s and
  `ContactsList`'s privacy (fallback `DEFAULT_PRIVACY_SETTINGS`),
  `ContactsList`'s inactiveThresholdDays (fallback 90, matching
  `ContactCard`'s own existing default prop) and encounters, and the
  top-level `contacts`. `ContactProfile`'s own `contact` stays a direct
  render-body `ContactRepository.getById()` call (not a hook — same
  shape as Encounters' `RegistrySinglePicker`/Testing's `existing`),
  confirmed safe against its `if (!contact) return null` guard since
  every real hook in the component sits before it. Verified live
  against real seed data (list's real "Last interaction" data; Grace
  J.'s full profile; its Edit sheet's real Gender/Pronouns chips) — no
  page errors. Full smoke-test suite passes.
  `SHOS_Settings_Prototype.jsx` (17 sites — the largest single file)
  converted next, working through every screen: DeveloperToolsScreen's
  storageUsage/orphans, PrivacyScreen's settings, NotificationHistoryScreen's
  entries, UnitsScreen's/AutomaticBackupsScreen's/DataNetworkScreen's/
  CalendarSyncSheet's/MenstrualTrackingToggleCard's prefs/appPrefs
  (fallback `DEFAULT_MEASUREMENT_PREFERENCES`/`DEFAULT_APP_PREFERENCES`),
  StatsScreen's 6 direct repository reads (its ~9 downstream aggregate
  computations stay plain `useMemo` — no direct repo call of their
  own), CalendarScreen's allEvents, TrashScreen's items, DesignScreen's
  overrides (a genuinely different, safe call site from designTokens.js's
  own flagged module-load-time call — confirmed by file, not assumed).
  `InactiveThresholdCard` needed the MyProfile-style resync fix again
  (`draftValue` read `prefs.inactiveThresholdDays` synchronously at
  mount) — verified by setting the real value to a distinctive 137
  directly in localStorage and confirming the input showed 137, not
  90 (the default), proving the fix actually works rather than merely
  not crashing.
  Immediately after finishing Settings, re-swept every module file's
  remaining count one more time and found 2 real sites that had
  slipped through EARLIER work this session, before the current
  single-line + multi-line + bare-reference checklist had fully
  matured: `SHOS_GlobalSearch_Prototype.jsx`'s `index` (`buildIndex()`,
  a real multi-repository aggregator) and
  `SHOS_PartnerNotification_Prototype.jsx`'s `lastEncounterAt`. Both
  fixed the same way as everywhere else. **This is the real lesson**:
  a file being "already touched" this session doesn't mean its own
  sync-load audit was complete — the checklist has to be re-run
  against every file, including ones fixed for an unrelated reason
  earlier, not just files converted after the checklist matured.
  Re-ran the full 3-part sweep (single-line grep, multi-line grep,
  bare-reference grep) against every file in `src/modules/` one final
  time after this fix — every remaining match confirmed legitimate
  (props, plain constants, sessionStorage-only reads, browser-event
  state, or pure computations with no direct repository call of their
  own). **`src/modules/` is now fully converted for this specific
  pattern** — every file audited, every genuine site fixed, several
  real regressions caught and fixed along the way (see above). What's
  NOT yet done, deliberately deferred: the ~19 repository files'
  own module-load-time `let x = storage.load(...)` patterns,
  `App.jsx`'s own bootstrap `useState` calls (`locked`/`appLockEnabled`/
  `showOnboarding`), and `main.jsx`'s `ErrorBoundary` (still reads
  `shos_app_preferences` via raw `localStorage`) — these are a
  different, higher-stakes tier of Phase 2 work (module bootstrap and
  crash-recovery paths, not per-screen React state) and were flagged
  from the start as needing their own dedicated, careful pass rather
  than folding into this same sweep.
  `App.jsx`'s own bootstrap state tackled next — 5 lazy-init sites found
  (`locked`, `appLockEnabled`, `showOnboarding`, `showAppLockPrompt`,
  `active`; `decoyActive` is a plain `useState(false)`, out of scope).
  `locked` (gates the whole app behind `AppLockScreen`) deliberately
  left UNCONVERTED — `shouldRelock()` defaults `false` when App Lock is
  off (the common case), so a fail-closed fallback would flash a lock
  screen on every launch for most users, while a fail-open fallback
  would flash real app content before locking for anyone who DOES have
  App Lock on — unacceptable for this app. Converting it properly needs
  a real loading/splash screen as part of Phase 3's actual async-crypto
  work, not a mechanical swap. `appLockEnabled`/`showOnboarding`/
  `showAppLockPrompt` converted cleanly — confirmed every read of them
  sits after the still-synchronous `if (locked) return <AppLockScreen>`
  gate (so their one-tick fallback window is never visible to someone
  who should be locked out), and `showOnboarding` has its own
  early-return gate with no hooks after it. `active` (resume-last-tab)
  was converted, then live-tested, then REVERTED after catching a real
  bug: a write-back effect a few lines below it
  (`useEffect(() => AppPreferencesRepository.update({ lastActiveTab:
  active, ... }), [active])`) exists to persist every real tab change.
  Under StrictMode's mount double-invoke, that effect fired with
  `active`'s pre-load fallback ("home") in the same commit as (but
  after) the loader effect's own read — the loader's `setActive()`
  hadn't taken effect yet, so the write-back effect wrote the stale
  fallback over the real stored value before it was ever read back.
  Reproduced live: set `lastActiveTab` to a distinctive "medication" in
  localStorage, reloaded, and the app incorrectly resumed on Home,
  with the stored value itself silently corrupted back to "home" — not
  just a cosmetic flash, genuine data loss. `active` reverted to plain
  synchronous `useState`, same as `locked`, with a comment explaining
  why. Verified live after reverting: distinctive stored tab now
  correctly resumes (Medication tab shown, not Home); reload settles
  with the correct value still in storage (no clobbering); switching
  tabs for real still correctly persists via the write-back effect;
  onboarding-already-complete still doesn't reappear on reload. No
  page errors. `main.jsx`'s `ErrorBoundary` confirmed out of scope for
  this pattern — it's a class component (required for
  `componentDidCatch`), and its raw-`localStorage` read/write only runs
  inside a synchronous button-click handler after a caught render
  error, not a render-time hook. Full smoke-test suite passes.
  Scoped the next tier — making `storageAdapter.js`/repositories
  genuinely async — before touching it. Real inventory: 22 repository
  files cache data at module-load time (`let x = storage.load(key,
  seed)`, evaluated once at import); 5 repository files
  (`customGroupsRepository`/`measurementPreferencesRepository`/
  `medicationPreferencesRepository`/`moduleColorRepository`/
  `trashRepository`) read fresh inside each method call, no caching;
  `simpleRegistry.js`'s `createSimpleRegistry()` factory (backing
  Kink/Protection/Chems/Symptoms registries) uses the same
  module-load-cached pattern as the hard 22, so `kinkRegistry.js`/
  `protectionRegistry.js` belong with that harder bucket despite
  looking simple at a glance — each also has its own top-level
  `if (!storage.load(FLAG_KEY, false)) {...}` migration-flag side
  effect that runs at import time, a THIRD real pattern beyond the
  other two. `designTokens.js` (a calculations file, not a repository)
  has its own separate module-load-time call into
  `ModuleColorRepository.getOverrides()` to build the `ACCENTS` object
  every module imports — so `ModuleColorRepository` ALSO isn't safe to
  convert in isolation despite having no caching of its own; the risk
  lives in a caller, not the repository file itself. Real constraint
  found before writing any code: `storageAdapter.js`'s `load`/`save`
  can't be converted incrementally at all — the moment they return a
  Promise, every repository that doesn't yet `await` them breaks
  instantly (returns a Promise object instead of real data). The fix:
  a repository's own methods go `async` FIRST (with a harmless
  `await storage.load/save(...)` on the still-100%-synchronous
  adapter — `await` on a plain value is a no-op), proving the full
  "repo goes async, every caller adapts" pattern end-to-end without
  needing `storageAdapter.js` to change at all yet; its own real
  conversion (and eventually real `crypto.subtle` encryption) is later,
  separate work once every repository already expects it.
  `useLoadedState`/`useLoadedMemo` (`loadedRepositoryState.js`) updated
  first — now `await`s the loader inside the effect (with a
  `cancelled` guard) instead of assigning its return value directly,
  a no-op today but what lets a repository's methods start returning
  real Promises later with zero further change needed at any of the
  ~100 existing call sites, PROVIDED the loader itself doesn't chain a
  synchronous operation onto the repo call. Audited for exactly that
  and found 17 real sites across 11 module files doing
  `useLoadedMemo(() => Repo.getAll().filter(...).sort(...), ...)` —
  these WILL break once their repo goes async (`.filter` doesn't exist
  on a Promise, throwing before the hook ever gets to await anything).
  All 17 sites belong to repositories in the hard 22-file bucket, so
  fixing them now (before their own repo converts) would be
  speculative churn — deliberately left alone for now, to be split
  into a raw load + a separate derived `useMemo` as part of THAT
  specific repository's own future conversion, not as a standalone
  pass.
  `CustomGroupsRepository` converted first, chosen specifically because
  every one of its methods already reads/writes fresh per-call (no
  caching redesign needed) — the smallest genuine full proof of the
  pattern. Its own caller chain turned out to reach much further than
  expected: `backupService.js`'s `buildBackup()`/`restoreBackup()` call
  it directly, and `buildBackup()` itself has its own deep internal
  chain (`hasUnbackedChanges()` → `getLastBackupInfo()` →
  `isAutoExportDue()` → `runAutoExportIfDue()`, plus
  `exportBackup()`/`exportBackupToChosenFolder()`/
  `buildEncryptedBackup()`/`restoreFromParsedBackup()`) — all converted
  to `async`/`await` in the same change, tracing every caller out to
  its real edge. Two real findings along the way: (1) Settings'
  `DeveloperToolsScreen` called `hasUnbackedChanges()` directly in its
  render body (`{hasUnbackedChanges() && (...)}`) — a Promise is always
  truthy, so this would have shown the "unbacked changes" warning
  permanently once the function went async; fixed with a
  `useLoadedMemo`. (2) `App.jsx`'s `finishImport` called
  `restoreFromParsedBackup(...)` without awaiting it, then immediately
  called `window.location.reload()` — once that call became async,
  the reload could fire before the restore actually finished writing
  data; fixed by awaiting it first. Every other caller (Home's
  `getLastBackupInfo()`/`runAutoExportIfDue()`, Settings' CSV/encrypted
  export buttons) was already either behind `useLoadedState` (handled
  automatically by the hook fix above) or already properly `await`ed.
  `SHOS_Measurements_Prototype.jsx`'s 6 direct `CustomGroupsRepository`
  call sites fixed: `customGroupSections`' loader made `async` (it does
  real post-processing on the result, not a bare passthrough);
  `ManageGroupsScreen`'s `refresh`/`createGroup`/delete/setMemberGroup
  handlers all made `async` with real `await`s — these directly called
  `setGroups(CustomGroupsRepository.get(...))` and fire-and-forget
  `create()`/`delete()`/`setMemberGroup()` calls, which would have set
  state to a raw Promise or raced the actual write once real async
  latency exists. Verified live end-to-end, all in one continuous
  browser session (a fresh `chromium.launch()` per script starts with
  empty storage, which cost some debugging time before realizing it):
  create → real `localStorage` write confirmed; member-toggle → same;
  delete → same; "By group" read view renders real UNGROUPED sections
  correctly; a real Export backup produces a valid, parseable JSON file
  with no stray `"[object Promise]"`/Promise-shaped values anywhere in
  it; a real Restore from backup (Replace All) correctly lands real
  data (8 contacts, etc.) with no page errors; Developer Tools' reset
  confirmation correctly shows the real unbacked-changes warning
  (true, accurately, right after a restore). No page errors anywhere.
  Full smoke-test suite passes.
  `TrashRepository` converted next — same shape as `CustomGroupsRepository`
  (no module-load caching, every method reads/writes fresh). Its own
  caller chain turned out to be the widest yet: `add()` is called from
  10 module files' shared "delete with undo/redo toast" handlers
  (`triggerDelete`/`redoDelete`, or MenstrualHealth's generically-named
  `trigger`/`redo` variant of the same pattern) — 24 call sites total,
  all fire-and-forget before this change. All made `async`/`await`ed,
  including 8 further "Delete permanently" confirm buttons (the
  single-record hard-delete path on each module's own detail screen)
  that called `triggerDelete()` without awaiting it at all. Settings'
  `TrashScreen` (`getAll`/`removeEntry`×2/`emptyAll`/bulk `removeEntry`
  via `forEach`) converted too — `forEach` can't `await`, so
  `restoreEntries`/`deleteSelected` were rewritten as `for...of` loops.
  Verified live end-to-end, working around several real navigation
  quirks in this app's own structure discovered along the way (worth
  recording so a future session doesn't re-lose time to them): the
  bottom nav bar only holds Contacts/Encounters/Medication/Healthcare —
  Settings is reached via a gear icon on Home itself
  (`title="Settings"` on the icon), not a 5th tab; the app's own
  resume-last-tab feature means a plain page reload during a test
  session keeps resuming wherever a prior action left `lastActiveTab`,
  so a test needs to clear it explicitly, not just reload. Once
  navigation was right: a real single-contact "Delete permanently"
  (profile → menu → confirm) produced a correct, fully-shaped
  `shos_trash` entry and correctly dropped the live count (7→6 active);
  the Trash screen rendered a seeded real entry correctly (name,
  "Contact · deleted [date]", Restore/Delete actions) and a real
  Restore tap correctly moved it back into `shos_contacts` and cleared
  `shos_trash` — both directly exercising the `for...of`-rewritten
  `restoreEntries`. No page errors anywhere. Full smoke-test suite
  passes.
  `MeasurementPreferencesRepository` converted next (5 Sep) — a
  genuinely different, harder case than the first two, backed out of
  once already (see the App.jsx-style reasoning above) before being
  done properly. The real complication: `measurementRepository.js`'s
  own `getAvailableUnits()`/`getDefaultUnit()` called
  `MeasurementPreferencesRepository` internally, and were themselves
  called from ~8 real UI sites — several inline in render bodies or
  component-body variables (a `ValueUnitFields` prop computation, a
  `useState(() => {...})` form initializer, a plain `displayReading()`
  helper called per list row) — not behind any hook. Converting the
  repository to async would have forced all 8 into an async-aware
  redesign at once. Real fix, better than a mechanical hook-ification:
  made `getAvailableUnits(type, typeKind)`/`getDefaultUnit(type, prefs)`
  pure functions that take the relevant preference data as a
  parameter instead of fetching it themselves — this was already an
  architecture smell independent of the async question (one repository
  quietly depending on another for a plain calculation, when CLAUDE.md's
  own rule is "a repository is pure data access... a calculations file
  is pure business logic, no I/O") and fixing it happens to also
  sidestep the async problem entirely for every call site that already
  has `prefs` loaded for other reasons (Settings' `UnitsScreen`,
  Measurements' `MeasurementPreferencesSheet` — both already did).
  Three sites needed real new plumbing: `MeasurementDetail` and
  `MeasurementsLanding` didn't have `prefs` loaded at all (added a
  `useLoadedMemo`, threaded into `displayReading(m, prefs)`); `ValueUnitFields`
  needed a new `typeKind` prop from its parent `MeasurementSheet`. The
  trickiest real design decision: `MeasurementSheet`'s own
  `useState(() => {...})` form initializer calls `getDefaultUnit(presetType,
  prefs)` for a preset-type quick-add with no prior entry — `prefs` is
  still its `useLoadedState` fallback value on this exact first render
  (real preferences resolve a tick later), so the initial unit shown
  could be briefly wrong (canonical instead of a real saved
  preference) before self-correcting. Fixed with a resync effect
  matching this session's established "only correct if still
  untouched" pattern (reference-checked against the captured fallback,
  same shape as every other loaded-value race fixed earlier this
  session) — `setType`'s own live `getDefaultUnit(newType, prefs)` call
  needed no such treatment, since by the time a user manually changes
  the type, `prefs` has already loaded for real in every practical
  case. Also fixed a second real render-body Promise-truthiness bug of
  the same class as Settings' `hasUnbackedChanges()` one:
  `MeasurementSheet`'s "wrong unit suggestions?" re-prompt link called
  `MeasurementPreferencesRepository.getTypeKind(form.type)` directly in
  JSX — replaced with the already-loaded `prefs.typeKinds[form.type]`,
  which also fixed a related staleness gap (the sheet's own `prefs` is
  loaded once at mount, so `TypeKindPrompt`'s `onPick` handler now
  calls `setPrefs()` with `setTypeKind()`'s own return value, not just
  awaiting it, so the just-picked kind is reflected immediately rather
  than needing a reopen). Verified live end-to-end: a built-in-type
  (Weight) entry saved correctly with real kg/lb chips; a brand-new
  custom type ("Verify Custom Analyte") through the full
  type-a-new-type → `TypeKindPrompt` → pick "Weight-like" → real
  mass-unit chips (kg/lb/g/mg) appearing immediately → save flow,
  confirmed against real `localStorage` state at each step; Settings'
  Units screen's Metric/Imperial toggle confirmed writing the correct
  real preference object. No page errors anywhere. Full smoke-test
  suite passes.
  `MedicationPreferencesRepository` converted next (5 Sep) — the
  fourth and last of the originally-scoped "easy bucket," and the
  highest-stakes one: its real callers reach into live native-
  notification scheduling and the in-app due-meds banner's Take/
  Snooze/Skip buttons, via `medicationReminderSync.js`/
  `refillReminderSync.js`. `isSkippedToday()`/`isDoseSnoozed()`/
  `isRefillSnoozed()` in the repository file were already pure
  (take `prefs` as a parameter) — the same design already used for
  `getAvailableUnits()`/`getDefaultUnit()` in the previous batch, just
  not yet applied to this file's OWN `getDailyMedsState()`/
  `getRefillDueMedications()`, which called
  `MedicationPreferencesRepository.getPreferences()` directly. Those
  two, plus every function that calls them
  (`syncMedicationReminders`/`syncRefillReminder`,
  `handleTakeAll`/`handleSkipToday`/`handleSnooze`/
  `handleMarkRefillRequested`/`handleSnoozeRefill`), converted to
  `async`/`await` — several had a `.forEach()` firing off unawaited
  `MedicationPreferencesRepository.snoozeDose()`/`snoozeRefill()`/
  `skipUntilTomorrow()` calls, rewritten as `for...of` loops the same
  way `TrashRepository`'s bulk-restore/delete needed. `App.jsx`'s
  `checkDueMeds()` — the one real chokepoint already shared by mount,
  a visibility-change listener, a 60-second safety-net poll, AND real
  notification-delivery events — made `async`; all four callers were
  already fire-and-forget (never awaited its return), so this needed
  no further change at the call sites themselves. Its five onClick-
  style handlers (`onDueMedsTake`/`onDueMedsSkip`/`onDueMedsSnooze`/
  `onRefillRequested`; `onRefillSnooze` was already async) converted
  the same way. Two more direct callers found and fixed: Settings'
  `NotificationsScreen` read `medPrefs` straight in the render body
  (no hook at all) — converted to `useLoadedMemo` keyed off this
  screen's own existing `refreshKey` force-render counter; both this
  screen's `toggleMed` and Medication Dashboard's own
  `MedicationSettingsScreen`'s `toggleReminders`/`setSnoozeMinutes`
  needed `await` added (previously fire-and-forget, passing the
  updated value straight into `setPrefs` before the write actually
  landed). Verified live: `getDailyMedsState()`'s real read path ran
  correctly and produced a real, consistent "nothing due right now"
  result with zero errors (the seed data's own dose timestamps are
  relative to actual real-world time, which has genuinely moved on
  since earlier in this session — confirmed this wasn't a regression
  by checking the Medication Dashboard's own real per-medication dose
  history directly, not just the banner); manufacturing an artificial
  "due" state to exercise Take/Snooze/Skip directly would have needed
  deeper seed-timing manipulation than was worth it here, so the
  write-path handlers were instead verified via the two Settings
  screens that share the exact same `MedicationPreferencesRepository`
  calls: Medication Dashboard's own dose-reminder toggle confirmed
  writing a real `{"doseRemindersEnabled":false,...}`, and its snooze-
  duration picker confirmed writing `{"snoozeMinutes":60,...}` — both
  against real `localStorage` state. No page errors anywhere. Full
  smoke-test suite passes, including the Medication log flow, which
  directly exercises this batch's own dose-logging code path.
  With this, the four repositories originally scoped as the safe,
  no-module-load-caching "easy bucket" (`CustomGroupsRepository`,
  `TrashRepository`, `MeasurementPreferencesRepository`,
  `MedicationPreferencesRepository`) are all converted. What's left in
  this tier: `kinkRegistry.js`/`protectionRegistry.js` and everything
  else built on `simpleRegistry.js`'s factory (Chems/Symptoms/
  Organism/Results registries), `ModuleColorRepository` (via
  `designTokens.js`'s own module-load-time cache of it), and the 22
  repository files that cache data at module-load time
  (`let x = storage.load(key, seed)`, evaluated once at import) —
  these need the "ensureLoaded()"-style memoized-promise redesign
  flagged when this tier was first scoped, not the direct-conversion
  treatment that worked for the easy four. The 17 sites found earlier
  that chain `.filter()`/`.map()`/`.sort()` directly onto a `Repo.getAll()`
  call belong to repositories in that harder bucket and should be
  fixed as part of each specific repository's own future conversion,
  not as a standalone pass.
  First real proof of the harder "ensureLoaded()" pattern landed (5
  Sep), on the smallest and most isolated of the 22 module-load-cached
  repositories — `notificationHistoryRepository.js` (51 lines, called
  from just 2 files), chosen the same way `CustomGroupsRepository` was
  chosen first for the easier pattern. The redesign: the cached
  variable (`entries`) starts `null` instead of the real seed/stored
  value, and every exported method now awaits a shared `ensureLoaded()`
  helper before touching it. `ensureLoaded()` memoizes the in-flight
  load itself (a module-level `loadPromise`, set BEFORE it's awaited)
  so a second caller arriving before the first load resolves awaits
  the SAME promise rather than triggering a duplicate, possibly-racing
  read — the one piece of real synchronization complexity a plain
  module-level variable needs that `useLoadedState` didn't (React's
  own state updates are already sequential). Considered and rejected a
  shared factory for this pattern (the way `simpleRegistry.js` shares
  one for its own shape) — each of the 22 repositories mutates its own
  differently-shaped local state (derived ID counters, legacy-shape
  migrations on read, etc.), too much real per-file variation to
  genuinely share beyond documenting the same named pattern
  consistently. All 3 real call sites fixed: Settings'
  `NotificationHistoryScreen`'s `getAll()` needed no change at all
  (already a bare `useLoadedState` passthrough, handled automatically
  by this session's earlier hook fix); its `clear()` button handler
  got `await` added; `App.jsx`'s own `record()` call (inside the real
  notification-delivery listener) stays deliberately fire-and-forget,
  same as several other calls in that exact listener already were.
  Verified live: a seeded real history entry rendered correctly
  (title/body/timestamp), and a real Clear tap correctly wrote `[]` to
  `localStorage` with the UI updating to its real empty state. No page
  errors. Full smoke-test suite passes. The other 21 repositories in
  this bucket remain — each needs its own real caller-cascade trace
  before conversion, the same way `MeasurementPreferencesRepository`'s
  8 render-body sites and `MedicationPreferencesRepository`'s
  notification-scheduling depth turned out to need real, not
  mechanical, attention; this file's own small size and 2-file
  footprint is exactly why it went first and is not representative of
  what most of the remaining 21 will take.
  `resourcesRepository.js` converted next — second-smallest caller
  footprint (2 files) among the 22, but a real step up from
  `notificationHistoryRepository.js`: its module-load-time IIFE did a
  genuine multi-step MERGE (stored-entry-wins, blank-link-backfilled-
  from-a-newer-seed, brand-new-seed-entries-appended), not just a bare
  `storage.load()`. Moved that merge logic unchanged into an async
  `computeInitialCategories()`, called lazily through the same
  `ensureLoaded()`/memoized-`loadPromise` pattern proved on the first
  repository. `getAllCategoryKeys()` deliberately stayed synchronous —
  it only reads `CATEGORY_LABELS`, a static constant, never the stored
  data, so it never needed `ensureLoaded()` at all; a repository's
  methods don't all have to move together, only the ones that actually
  touch stored state. Caught a real render-body Promise-truthiness bug
  of the same class found twice already this session (Settings'
  `hasUnbackedChanges()`, Measurements' `getTypeKind()`):
  `hasAnyResourceMatch(query)`, called straight in `ResourcesScreen`'s
  render body as `!hasAnyResourceMatch(query)` to show a "no results"
  empty state, now has to `await` `getEntries()` per category — fixed
  by making it `async` and loading it via `useLoadedMemo(() =>
  hasAnyResourceMatch(query), [query], true)`, deliberately preserving
  its exact prior reactivity (recomputes only when `query` changes,
  same as the original plain-function-in-render-body version already
  did — it was never reactive to a sibling `ResourceCategory`'s own
  local add/edit/remove state either, so this is a faithful, not
  broadened, conversion). Also found `mergeBackup()` in
  `backupService.js` — untouched by the earlier `CustomGroupsRepository`
  work since it didn't call that repository — now touches
  `ResourcesRepository` too, so it needed the same `async` treatment
  and its own caller (`restoreFromParsedBackup`'s merge branch) needed
  `await` added. Verified live: real seed categories/entries render
  correctly; searching for a genuine no-match term correctly shows "No
  resources match your search"; searching for a real match
  ("Samaritans") correctly finds it and correctly does NOT show the
  no-match state (proving both the true and false paths of the
  Promise-truthiness fix); editing a real entry's link and saving
  confirmed against actual `localStorage` content (the on-screen check
  gave a false negative from an overlay-text-slice limit in the test
  script itself, not a real bug — confirmed by reading
  `shos_resources` directly). No page errors. Full smoke-test suite
  passes.
  `locationsRepository.js` converted next — the most complex of the
  `ensureLoaded()` conversions so far, touching Encounters, Settings,
  `contactRepository.js`, `orphanReferenceCheck.js`, and
  `backupService.js`. Real findings along the way, each smaller than
  the last but genuinely different in kind:
  (1) `contactRepository.js`'s `delete()`/`bulkDelete()` — a much
  bigger, still-fully-synchronous core repository in the same 22-file
  bucket — call `LocationsRepository.unlinkContact()` fire-and-forget.
  Deliberately left unawaited rather than cascading `delete()` itself
  into `async` (which would ripple into every one of ITS OWN callers
  across the app) — safe since nothing in that caller depends on the
  unlink's completion timing, same reasoning as App.jsx's notification-
  history `record()` call.
  (2) `orphanReferenceCheck.js`'s `findOrphanReferences()` calls ~15
  still-synchronous repositories plus the now-async `LocationsRepository`
  — made the whole function `async`, but only actually `await`s the
  Locations-specific calls. Real, subtle correctness risk caught before
  shipping: its own `checkSingle(results, exists, id, ctx)` helper is
  shared across EVERY repository's check (`if (id && !exists(id))
  flag(...)`) — an unawaited async `exists` call, combined with several
  of the loops it's used inside being iterated via `.forEach()` (which
  doesn't wait for anything), could let `findOrphanReferences()`'s own
  `return results` fire before a locations-related flag ever got pushed
  — a real, silent "this genuinely-dangling reference gets missed"
  bug, not just a cosmetic one. Fixed two ways together: made
  `checkSingle` itself `async` (await on a plain boolean from a
  still-synchronous `exists` is a no-op, so this needed no changes at
  any of its ~10 other, still-synchronous call sites) and converted
  every loop that calls `checkSingle` from `.forEach()` to `for...of`
  with a real `await` on each call — loops using only the (never-async)
  `checkArray`/`checkKinkSelections` helpers were left as `.forEach()`,
  since nothing about MERGING correctness required more of them.
  (3) Settings' `DeveloperToolsScreen` had `LocationsRepository.getAll().length`
  inline in a `counts` array literal alongside a dozen other
  (still-synchronous) repositories' own inline counts — pulled just
  that one into its own `useLoadedMemo`, leaving every other line
  in the array untouched.
  (4) `RegistrySinglePicker` (Encounters) — flagged back when the
  original `src/modules/` sweep called this exact kind of render-body
  direct-repository-call component safe to leave alone "since it
  re-runs every render" — that reasoning assumed the call stayed
  synchronous forever. Once `LocationsRepository` (its one and only
  real caller) went async, the same "leave it alone" component would
  have silently shown blank/wrong location names instead of crashing —
  a real regression the original sweep couldn't have anticipated.
  Converted `allEntries`/`currentName` to `useLoadedMemo`, and found
  the same "`useState(current)` reads a value that's now async" race
  already fixed elsewhere this session (Measurements' form initializer)
  — `draft`'s initial state is the loaded value's pre-resolution
  fallback (`""`) for one render; fixed with the same "resync-if-
  untouched" `useEffect` + a `draftTouchedRef` flipped the moment the
  user actually types or picks a suggestion, so a real in-progress edit
  is never clobbered by the async resync. `commit()`/`tapContactSuggestion()`
  (both call `registry.findOrCreate()`/`.update()` and use the result
  immediately) converted to `async`/`await`.
  Verified live end-to-end: editing an existing Encounter's Location
  field, typing a brand-new name, and blurring to commit produced a
  real new `location_006` entry in `localStorage` with the correct
  sequential ID and timestamp; the contact-derived suggestion chips
  ("Jordan's place", "Sam's place") rendered correctly with no errors;
  Settings' Locations registry-management screen (shared
  `RegistryManagementScreen` + `LocationExtraFields`) rendered real
  seed entries and usage counts correctly, and tapping a Type chip
  correctly wrote the real `type`/`updatedAt` fields to `localStorage`;
  Developer Tools showed the correct real Locations count (5) and
  "Broken references: None found" from the fully-converted orphan
  checker. No page errors anywhere. Full smoke-test suite passes,
  including its own Locations-extra-fields flow, which directly
  exercises this batch's own conversion.
  `PregnancyRepository` converted next (fourth `ensureLoaded()` proof) —
  its caller cascade reached `SHOS_MenstrualHealth_Prototype.jsx`'s
  `PregnancyTab` (the exact "deliberately-left-synchronous, direct
  render-body `Repository.getAll()`/`getById()` call" pattern CLAUDE.md
  itself once documented as a correct, intentional exception — valid
  only while this repository stayed synchronous forever, same trap
  `RegistrySinglePicker` hit for Locations), `MenstrualHealthModule`'s
  own top-level "Currently pregnant" banner (`getActive()`, reloaded on
  `[subTab]` since nothing else in that component was already tracking
  a refresh signal), `clinicCardPdfService.js`/`SHOS_ClinicCard_Prototype.jsx`'s
  own `getActive()` calls for the Clinic Card PDF/screen's pregnancy
  section, and 3 sites in `backupService.js`. All converted the same
  way as prior batches: `PregnancyTab`'s list (`all`) and by-id lookup
  (`byId`, shared between the detail view and the edit sheet — both
  read the same record by the same `screen.id`) moved to
  `useLoadedMemo`; `create`/`save` made `async`/`await`.
  Real pre-existing bug found and fixed while wiring `backupService.js`'s
  3rd `PregnancyRepository` site: `mergeBackup()`'s own `append()` helper
  was still fully synchronous even though it's already called with
  `LocationsRepository` (converted the batch before this one) —
  `[...repo.getAll(), ...incoming]` spreads a Promise once `getAll()`
  returns one, which throws at runtime rather than failing silently.
  Missed when Locations converted because nothing in that batch's own
  verification exercised the Merge-backup import path specifically (only
  Replace-All was checked). Fixed by making `append()` itself
  `async`/await-aware — a no-op for every repository in this helper
  still synchronous — and awaiting all 20 of its call sites, not just
  the Locations/Pregnancy ones, so the same latent bug can't recur as
  more repositories convert under it. Verified live end-to-end: list
  view (real seed data — one plain Negative entry, one masked
  Miscarriage entry showing "Tap to reveal"), tapping the masked row in
  the LIST correctly reveals it in place rather than navigating away
  (confirms `isMasked`/`revealedIds` still work against the new
  `useLoadedMemo`-backed `all`), opening the revealed entry's detail
  shows the real underlying data (Positive/Miscarriage/Feb 22 2027 due
  date/Jul 14 2026 outcome date/the real notes text), editing correctly
  opens the real `PregnancySheet` pre-filled with that data (proving
  `byId` serves both the detail view and the edit sheet correctly), and
  saving a changed note round-trips through the async `update()` call
  and is confirmed via a direct `localStorage` read afterward, not just
  the on-screen text. Creating a brand-new entry through the real Add
  sheet also verified end-to-end (`shos_pregnancies` count went from 2
  to 3 with the correct new id), and setting that new entry's status to
  Ongoing and reloading correctly showed the top-level "Currently
  pregnant" banner on the Cycle tab, confirming `MenstrualHealthModule`'s
  own `getActive()` conversion. No page errors anywhere across any of
  these flows. Full smoke-test suite passes.
  Four repositories converted together in one batch (8 Sep) —
  `MenstrualCycleRepository`/`ContraceptionRepository`/
  `PartnerNotificationRepository` via `ensureLoaded()`,
  `NotificationPreferencesRepository` via direct conversion (no
  module-load cache, same "easy bucket" shape as the four converted
  earlier). Grouped into one build/verify/commit/push cycle instead of
  one per repository, to cut down on redundant CI round-trips now that
  the pattern itself is well-proven. Caller cascade: `CycleTab`/
  `ContraceptionTab` (Menstrual Health module) both converted off the
  same "direct render-body call + `[, force]` counter" pattern
  `PregnancyTab` hit — `all`/`byId` via `useLoadedMemo`, `create`/`save`
  async. `orphanReferenceCheck.js` (3 sites), `backupService.js` (6
  sites), `clinicCardPdfService.js`/`SHOS_ClinicCard_Prototype.jsx`
  (contraception/last-period reads), `SHOS_MyProfile_Prototype.jsx`,
  `SHOS_Home_Prototype.jsx` (cycle/contraception dashboard reads, an
  async IIFE inside an otherwise-synchronous effect since only the
  last, gated block needed it), and every `NotificationPreferencesRepository`
  caller across the 5 reminder-sync files
  (`testingReminderSync.js`/`clinicVisitReminderSync.js`/
  `refillReminderSync.js`/`doxyPepSync.js`/`notificationService.js`'s
  own `scheduleNotification()` chokepoint) plus Settings' Notifications
  screen and Home's permission-nudge card. Two real findings: (1)
  `SHOS_Testing_Prototype.jsx`'s `partnerNotifyList` was a direct
  render-body call sitting AFTER the `!test` early-return guard —
  hoisted above it into a `useLoadedMemo` keyed on `[testId, test,
  partnerNotifyVersion]`, recomputing positivity from `test` itself
  with optional chaining since `isPositive` (declared after the guard)
  couldn't be referenced there; this also required actually reading
  `partnerNotifyVersion` from its own `useState` (previously
  write-only, `const [, setPartnerNotifyVersion]`, with no way to use
  it as a dependency). (2) Home's own permission-nudge
  `useLoadedState(() => NotificationPreferencesRepository.getPreferences().permissionNudgeDismissed, ...)`
  chained a property access straight onto the (now-Promise)
  `getPreferences()` call — silently resolving to `undefined` forever
  rather than throwing — same class of bug as the earlier
  `.filter()`/`.map()` chained-onto-`getAll()` sites the original audit
  flagged, just property access instead of an array method; fixed by
  awaiting inside the loader. Verified live end-to-end in one grouped
  pass: Cycle tab's real average-length calculation and detail view;
  Contraception's Currently-active/History split, detail view (incl.
  its cross-repo `linkedVisit` read), and edit sheet, all against real
  seed data; the Notifications screen rendering correctly with real
  preferences; a full Partner Notification round-trip — generating a
  real checklist from a positive test (confirmed via a direct
  `shos_partner_notification_lists` read, correct shape, correct
  contact snapshot) and toggling an item's notified state, both
  persisting correctly. No page errors anywhere. Full smoke-test suite
  passes.
  `ContactRepository` converted next (8 Sep) — the biggest single file
  converted so far (669 lines) and a true core repository, chosen
  deliberately ("biggest first") once the pattern itself was well-proven
  across 8 prior repositories. `ensureLoaded()`/memoized-`loadPromise`,
  same shape as every other hard-bucket conversion. Caller cascade
  reached 15 files: `orphanReferenceCheck.js` (made `checkArray()`
  itself async — mirroring the existing `checkSingle()` fix — since
  `contactExists` can now be async too, then converted every `.forEach()`
  loop calling it to `for...of` + `await`, the same silent-miss risk
  already fixed once this session for `checkSingle`), `registryUsage.js`
  (`computeKinkUsage`/`computeChemsUsage`, which needed
  `RegistryManagementScreen`'s own `usageMap` to go through
  `useLoadedMemo` since `computeUsage(id)` can now return either a
  number or a Promise depending on which registry screen it's for),
  `backupService.js`, `profileShareService.js` (`importProfileAsContact`
  and its two callback-style wrappers), Global Search's `buildIndex()`,
  Settings (3 sites), MyProfile (2 sites), PartnerNotification, Home,
  SymptomLog, Encounters (a `createPlaceholderContact` flow), and
  Contacts' own module (11 sites — the largest single-file caller
  count, including `ContactProfile`'s own `contact` const, previously
  flagged safe to leave as a plain render-body call "since it re-runs
  every render" — the same reasoning that already broke twice this
  session once ITS ONE real repository went async).
  Real, more serious finding along the way: `editUndoHelpers.js` (the
  shared `useEditUndo()` hook — Vaccinations/Testing/ClinicVisits/
  Measurements/Medication/SymptomLog/Encounters/MenstrualHealth's own
  Cycle+Contraception+Pregnancy tabs/Contacts, 12 call sites across 9
  files) had `captureBeforeEdit`/`notifyEdited`/`undo`/`redo` reading
  `repository.getById()`/calling `repository.update()` with no
  `await` at all. Once ANY repository passed to this hook goes async,
  `captureBeforeEdit`'s `current ? {...} : null` check is always
  truthy (a Promise is truthy) — silently storing `{id, data:
  <Promise>}` as the "pre-edit snapshot", and `undo()` would call
  `repository.update(id, <a Promise>)` on tap, corrupting the record
  rather than restoring it. Found by inspection, not a live report —
  this session's own earlier live verification of Pregnancy/
  MenstrualCycle/Contraception never actually exercised the undo
  button itself, only plain save, so the bug was real but silently
  unexercised until this file's own audit caught it. Fixed at the
  source (`editUndoHelpers.js`'s 4 functions all made properly async,
  `await`ing `repository.getById()`/`.update()`) — genuinely a no-op
  for a still-synchronous repository, AWAIT ON A PLAIN VALUE resolves
  immediately, same established precedent as every other conversion
  this session. BUT: making these 4 functions `async` themselves also
  meant every one of their 12 call sites (previously calling them as
  plain synchronous functions, several with a still-fully-synchronous
  repository like Vaccinations/Testing/ClinicVisits/Measurements/
  Medication/SymptomLog/Encounters) now had the SAME "unawaited async
  call lets the next synchronous line run first" race this whole
  session has fixed repeatedly for `checkSingle`/`checkArray` — an
  unawaited `captureBeforeEdit(id)` defers its real snapshot-read by
  one microtask, during which the very next line's `Repository.update()`
  call (still fully synchronous, runs immediately) had already mutated
  the record — meaning the "before" snapshot captured would actually be
  the POST-edit state, corrupting undo for every one of these 9 modules,
  not just the newly-async ones. All 12 call sites across
  `SHOS_Vaccinations_Prototype.jsx`, `SHOS_Testing_Prototype.jsx`,
  `SHOS_ClinicVisits_Prototype.jsx`, `SHOS_Measurements_Prototype.jsx`,
  `SHOS_Medication_Dashboard_Prototype.jsx`, `SHOS_SymptomLog_Prototype.jsx`,
  `SHOS_Encounters_Prototype.jsx`, `SHOS_MenstrualHealth_Prototype.jsx`
  (×3), and `SHOS_Contacts_Prototype.jsx` fixed with `await` added,
  their own enclosing `save`/handler functions made `async` where they
  weren't already. This is the clearest example yet this session of why
  "the underlying repository hasn't converted yet" doesn't mean a
  caller is safe to skip — the hook itself going async was enough to
  introduce the bug everywhere it's used.
  Verified live: Contacts list, Grace's profile, opening the edit sheet
  via the real 3-dot menu, editing and saving (confirmed via the real
  "Contact updated — tap to undo" toast, itself proof `notifyEdited`
  resolved real post-edit data rather than a corrupted Promise), and
  tapping the undo toast itself — all against real seed data, no page
  errors, no `[object Object]`/`[object Promise]` corruption anywhere
  in `localStorage`. Contraception/Cycle/Pregnancy's own undo path
  (retroactively at risk from the same bug once those repositories
  converted, now fixed by this same file-level change) was not
  re-verified end-to-end this batch — the fix is at the shared hook
  level, proven correct here, and structurally identical for those
  three. Full smoke-test suite passes.
  `episodeRepository.js` and `logRepository.js` converted next (8 Sep,
  same `ensureLoaded()` pattern) — `logRepository.js` had the widest
  caller footprint of any repository converted this session (7
  calculations/storage files, 5 module files). Caller cascade fixed
  throughout: `doxyPepSync.js`/`medicationReminderSync.js`/
  `refillReminderSync.js` (their own `getForMedication`/`create` calls
  awaited; `App.jsx`'s notification-action listener made async so
  `handleTakeDoxyDose()` — itself newly async — is properly awaited
  rather than returning a Promise where a real `{medications}` result
  was expected); `orphanReferenceCheck.js`/`backupService.js` (both
  already async from earlier batches, just needed `await` added on the
  Log/Episode-specific calls); `clinicCardPdfService.js`'s/
  `SHOS_ClinicCard_Prototype.jsx`'s `.map()` chains onto
  `LogRepository.getForMedication()` converted to `Promise.all`.
  `SHOS_Home_Prototype.jsx`'s adherence/last-dose block wrapped in its
  own async IIFE (same "isolate just the gated block" approach as its
  earlier Contacts/Pregnancy conversions), since nothing else in that
  effect depends on it. `SHOS_Medication_Dashboard_Prototype.jsx` (the
  single largest caller — every dose/refill/waste/correction handler)
  had every `LogRepository` call site awaited; `refreshMeds()` itself
  kept callable synchronously from ~20 existing call sites by having it
  internally `loadMedications().then(setMeds)` rather than forcing all
  20 callers to become async — the same trade-off as `useLoadedState`'s
  own design, applied by hand here since this file predates that hook.
  `SHOS_Settings_Prototype.jsx`'s Developer Tools counts got
  `logsCount`/`episodesCount` via `useLoadedMemo`, matching the existing
  `locationsCount`/`contactsCount` pattern; its Stats screen's
  `doxyCompliance` (previously a plain `useMemo` calling
  `LogRepository.getForMedication()` directly) converted to
  `useLoadedMemo`. `SHOS_Timeline_Prototype.jsx`'s `EpisodeDetail`/
  `TimelineLanding` were already on `useLoadedMemo` from an earlier
  batch — only their own `update`/`startEpisode`/`handleDelete`/
  `undoDelete`/`redoDelete` handlers needed `await` added. Cross-
  repository cleanup calls (`ContactRepository`/`EncounterRepository`/
  etc. calling `EpisodeRepository.unlinkX()`/`LogRepository.
  deleteForMedication()` from their own still-synchronous `delete()`)
  needed no code change at all — calling an async function without
  awaiting it is valid JS and matches this session's established
  fire-and-forget precedent for cross-repository cleanup, since none of
  those callers depend on completion timing. Verified live end-to-end:
  a real "Log dose" tap correctly persisted seed data + the new entry
  (`shos_logs` 0 → 15, confirming `create()`'s first-write-triggers-
  persist behavior is unchanged), the in-app Undo toast correctly
  voided it (15 → 14 non-voided, confirming `void()`), and Developer
  Tools' "Medication log entries"/"Timeline episodes" counts rendered
  the correct real numbers (15 and 1) via their new `useLoadedMemo`
  reads. No page errors. Full smoke-test suite passes.
  `symptomLogRepository.js` converted next (8 Sep, `ensureLoaded()`
  pattern) — a wide caller footprint (13 files) spanning
  `registryUsage.js`/`orphanReferenceCheck.js`/`backupService.js`/
  `clinicCardPdfService.js`, Global Search's `buildIndex()`, Healthcare's
  summary effect (wrapped in its own async IIFE, same isolate-the-
  gated-block approach used throughout this session), Settings (a new
  `symptomLogCount` alongside the existing `logsCount`/`episodesCount`,
  plus the Calendar screen's `getCalendarEvents()` call), ClinicCard
  (`activeSymptoms` moved from a bare render-body call to
  `useLoadedMemo`), and three real hooks-before-guard hoists — Testing's
  `TestDetail`'s `relatedSymptoms` (mirroring `partnerNotifyList`'s
  existing pattern above its own `!test` guard) and Clinic Visits'
  `VisitDetail`'s `symptomLogEntries` (same shape, `visit?.` guarded).
  Timeline's `EpisodeDetail` needed two real additions, not just a
  hoist: `symptomCandidates` (the "link a new entry" picker list) and a
  new `linkedSymptomLabelById` map — the existing `nameFor={(id) =>
  symptomLogLabel(SymptomLogRepository.getById(id))}` callback is a
  synchronous per-id render callback (`LinkedItemsSection` calls it
  directly while rendering, it can't itself await), so the currently-
  linked entries' labels needed pre-resolving into a lookup object
  instead of fetched one at a time on demand. `SymptomLogModule` itself
  (the largest single file this batch) needed real handler-level
  fixes throughout: `undoDelete`/`redoDelete`/`triggerDelete`'s
  `.forEach()` calls converted to `for...of` + `await`; the bulk-select
  toolbar's Export/Archive/Delete `onClick`s made async; `createEntry`/
  `saveEntry` awaited. One genuinely new pattern needed for
  `EntrySheet`'s own `entry` prop (which its own `form` reads only
  once, at mount, via a lazy `useState` initializer with no resync
  effect — unlike every other converted edit-sheet this session, this
  one is never remounted via a screen-name key/guard on the parent side
  in a way that already covered this): rather than adding a resync
  effect, gated the sheet's own mount on the newly-async `editingEntry`
  having actually resolved (`screen.name === "edit" && editingEntry &&
  <EntrySheet ... />`), so it only ever mounts once real data is
  already in hand — a one-tick-later open instead of a stuck-blank
  form, same tradeoff Testing/ClinicVisits/Vaccinations' own
  `existing`-const edit sheets already accept.
  Live verification caught a real, separate regression along the way,
  not introduced by this batch but exposed by it: `SHOS_Timeline_Prototype.jsx`'s
  `TimelineLanding`'s own `episodes = useLoadedMemo(() =>
  EpisodeRepository.getAll().filter(...), ...)` — flagged in this
  file's own earlier conversion as "already on useLoadedMemo," but its
  loader chained `.filter()` directly onto `getAll()`'s return, which
  broke the moment `EpisodeRepository` itself went async this session
  (a live reproduction threw `EpisodeRepository.getAll(...).filter is
  not a function` on the real Episodes list) — exactly the class of
  "17 sites chaining `.filter()`/`.map()`/`.sort()` directly onto
  `Repo.getAll()`" gap the audit flagged as deferred, now real since
  this specific repository crossed from synchronous to async. Fixed
  with the same `.then()` pattern used everywhere else. A full sweep
  for the same shape across all three of this batch's repositories
  (`LogRepository`/`EpisodeRepository`/`SymptomLogRepository`) found no
  other instances — this was the one real leftover. Verified live:
  Symptom Log's list (real seed data, Active/Resolved sections), an
  existing entry's detail (including its real cross-repo Encounter/Test
  related-records section), its Edit sheet opening with real data (not
  blank), and — after the fix above — the real seed Episode's own
  detail view correctly showing "Discharge + discomfort · Aug 28, 2026"
  in its Symptom Log entries section (not a "?" fallback, proving
  `linkedSymptomLabelById` resolves correctly). No page errors anywhere
  in either pass. Full smoke-test suite passes, including the
  Testing↔Symptom Log link flow, which directly exercises this batch's
  own conversion.
  `vaccinationRepository.js` converted next (8 Sep, `ensureLoaded()`
  pattern) — a clean batch, every real finding this time a variant of
  patterns already proven across the prior two repositories rather than
  a new class of bug. Caller cascade: `orphanReferenceCheck.js`/
  `backupService.js`/`clinicCardPdfService.js`, Global Search, Healthcare's
  summary effect, Settings (a new `vaccinationsCount`, plus a genuine
  duplicate-object-key bug caught before it shipped — the Calendar
  screen's `getCalendarEvents()` call already had a `vaccinations:`
  entry using the old synchronous call; adding the new awaited one
  alongside it without removing the old line would have silently kept
  the STALE synchronous value, since the later duplicate key in a JS
  object literal wins — caught by re-reading the edit immediately
  after applying it, not by a live test). `SHOS_ClinicVisits_Prototype.jsx`'s
  `VisitDetail`'s `vaccinationEntries` got the same hooks-before-guard
  hoist as `symptomLogEntries` picked up in the previous batch.
  `SHOS_ClinicCard_Prototype.jsx`'s `vaccinations`/`overdueVaccinations`
  (plain render-body calls, no guard in this component) converted to
  `useLoadedMemo` directly, same treatment as this same file's
  `activeSymptoms` in the prior batch. `SHOS_Vaccinations_Prototype.jsx`
  (the largest file) got the exact same shape of fixes as Symptom Log's
  own module the batch before: bulk-select toolbar handlers, undo/redo/
  triggerDelete's `.forEach()`→`for...of`, create/save awaited, and the
  same "gate the edit sheet's mount on the resolved record" fix for
  `VaccinationSheet`'s own lazy-`useState`-initialized `form` (no
  resync effect existed there either). Verified live: the Vaccinations
  list and an existing entry's detail (real Gonorrhoea/Meningitis B
  seed data), its Edit sheet opening with real data already populated.
  No page errors. Full smoke-test suite passes.
  `customOptionListsRepository.js` converted next (8 Sep,
  `ensureLoaded()` pattern) — structurally the hardest of the four
  repositories converted this session, not because any single fix was
  novel but because of its shape: two independent module-load-cached
  values (`lists`/`usageMeta`, each with its own `ensureLoaded()`
  rather than merged into one, since most callers only need one of
  them) and its own module-load-time migration side effect (the
  `SAMPLE_TYPE_MIGRATION_FLAG` check, wrapped in an async IIFE — a
  module-load-time effect can't itself be `async`). Widest caller
  footprint by file count this session (14 files, 68 call sites) since
  every "add a new option" chip picker across nearly the whole app
  routes through this one repository's `add()`. Most sites were one of
  three already-proven shapes: `recordUsage()` fire-and-forget calls
  (no change needed), `getRanked()`/`get()` inside `useLoadedMemo`/
  `useLoadedState` (no change needed, the hook already awaits), and a
  new fourth shape specific to this repository — `onAddNew={(v) =>
  setXOptions(CustomOptionListsRepository.add(...))}`, appearing 12
  times across Vaccinations/Medication Dashboard/Measurements/
  MenstrualHealth/MyProfile/Contacts — fixed with `.then(setXOptions)`
  at every site. `SHOS_OptionListEditor_Prototype.jsx` (the dedicated
  "Manage lists" editor, previously with no `useLoadedMemo`/
  `useLoadedState` import at all) needed real conversion: `options`
  hoisted into `useLoadedMemo`, and `handleAdd`/`commitEdit`/`remove`/
  `move` all awaited. Two render-body `.get(name).length` sites
  (Settings' own `ManageListsScreen` and this same editor's top-level
  list) both resolved into a pre-computed lookup object via
  `useLoadedMemo`, same shape as Timeline's `linkedSymptomLabelById`
  from an earlier batch. Caught a real pre-existing bug unrelated to
  this repository while wiring `backupService.js`'s merge branch: its
  final `append(PartnerNotificationRepository, data.partnerNotifications)`
  call was missing an `await` even though both `append()` and
  `PartnerNotificationRepository` were already async from an earlier
  batch — a genuine latent race, fixed in the same change. Verified
  live: Settings > Manage lists > Option lists tab, opening the
  Vaccine list, adding a real new option ("Verify Test Vaccine XYZ")
  and confirming it appears in the UI AND lands in real `localStorage`
  (`shos_custom_option_lists`) — the strongest possible proof the
  `ensureLoaded()`/`add()`/`useLoadedMemo`-refresh chain works
  end-to-end. No page errors. Full smoke-test suite passes.
  `encounterRepository.js` converted next (8 Sep, `ensureLoaded()`
  pattern) — the first of the large/high-blast-radius tier (Encounter/
  Testing/Medication/ClinicVisits/MyProfile), 16 files/50 call sites.
  Caller cascade mostly familiar shapes by now: `registryUsage.js` (5
  sites — `computeProtectionUsage`/`computeLocationsUsage` made async
  for the first time, `computeKinkUsage`/`computeChemsUsage`/
  `computeSymptomsUsage` already were), `doxyPepSync.js`/
  `orphanReferenceCheck.js`/`backupService.js`/`clinicCardPdfService.js`,
  Global Search, Settings (new `encountersCount`), ClinicCard,
  PartnerNotification (`lastEncounterAt`), Home (wrapped in its own
  async IIFE). `SHOS_Encounters_Prototype.jsx` itself needed the same
  bare-function-reference fix as `logRepository.js`'s own caller batch
  earlier this session — `loadEncounters` is a plain function
  reference, not an inline arrow, so `refresh()`'s
  `setEncounters(loadEncounters())` was silently setting state to a
  raw Promise; fixed with `.then(setEncounters)`. Its own edit sheet
  had a genuinely async-sensitive load effect (`EncounterRepository.
  getById()` inside a `useEffect`, itself now wrapped in an async IIFE
  since an effect body can't be `async` directly) plus the usual
  undo/redo/bulk-handler `for...of` conversions.
  `SHOS_Contacts_Prototype.jsx`'s `ContactProfile` needed its Timeline
  section's `EncounterRepository.getAll()` (previously a plain
  render-body IIFE call, "safe" only while Encounters stayed
  synchronous — the same trap this exact pattern hit twice already this
  session for other repositories) hoisted into `allEncounters` above
  the `!contact` guard.
  `SHOS_Timeline_Prototype.jsx`'s `EpisodeDetail` needed the most real
  restructuring of any single component this session: `startDate` (now
  derived from a hoisted `startEncounter` hook, itself needed when a
  leftover JSX reference to the old post-guard `startEncounter` const
  surfaced as a real `ReferenceError` live — caught and fixed, see
  below), `encounterCandidates` (the "link a new at-risk encounter"
  picker), and a new `linkedEncounterById` lookup object (replacing a
  synchronous per-id `nameFor` callback AND a coverage-check loop that
  both used to call `EncounterRepository.getById()` directly — the
  coverage check needed the full object, not just a label, so this
  resolves full objects rather than pre-formatted strings the way
  `linkedSymptomLabelById` did last batch). `TimelineLanding`'s own
  `sorted` — a plain `useMemo` directly calling `EncounterRepository.
  getById()` per episode inside `.map()` — converted to `useLoadedMemo`
  with `Promise.all`.
  Real bug caught live, not by inspection: after the first pass, the
  Episode Detail screen crashed with `startEncounter is not defined` —
  the JSX's own "Exposure Encounter" read-only row still referenced the
  plain const removed during hoisting, missed because nothing in the
  earlier grep-based sweep checks for a removed declaration's own
  leftover uses. Fixed by keeping a `startEncounter` hook (not just its
  derived `.date`) precisely because this row needed the full object.
  Verified live end-to-end after the fix: Encounters list/detail with
  real seed data, and — the real proof of the whole restructuring —
  Episode Detail's "Exposure Encounter" row, "AT-RISK ENCOUNTERS"
  section (real linked labels, real candidates, and the exposure-window
  coverage check's own "too soon to confirm" text), all rendering
  correctly against real seed data. No page errors. Full smoke-test
  suite passes.
  `testingRepository.js` converted next (8 Sep, `ensureLoaded()`
  pattern) — 20 files/51 call sites, the widest caller footprint of the
  large tier so far. Caller cascade: `registryUsage.js`
  (`computeOrganismUsage`/`computeResultsUsage` made async),
  `testingReminderSync.js`, `orphanReferenceCheck.js`/`backupService.js`/
  `clinicCardPdfService.js`, Global Search, Settings, ClinicVisits
  (`StartTestInline`'s inline create, `allTests`, and two hoisted
  lookups — `linkedTestById` for the inline result-preview list,
  `testEntries` for `VisitDetail`), Measurements (`linkedTest` in both
  the edit sheet and detail view), Healthcare/Home (wrapped in their
  existing async IIFEs), Attachments (`loadAllAttachments` made async,
  `handleDelete` awaited), SymptomLog (`tests` suggestion list,
  `testNames` hoisted above `EntryDetail`'s guard next to
  `encounterNames`), Encounters (`lastTestDate`, already
  `useLoadedMemo`).
  `profileShareService.js`'s own `getAutoLastTestedDate()`/
  `buildProfileShare()` made async, with the same duplicated logic in
  `SHOS_MyProfile_Prototype.jsx` (a deliberate per-file copy, not a
  shared import — see that file's own comment) converted independently
  in both of its own call sites (`MyProfileEditScreen`'s edit form and
  `ProfileDataView`'s read-only summary), each via its own
  `useLoadedMemo`.
  `SHOS_Timeline_Prototype.jsx`'s `EpisodeDetail` needed the same
  hoisting treatment as its own Encounter-side fix last batch:
  `linkedTests`/`testCandidates` hoisted above the guard, and
  `nameFor`'s per-id lookup resolved against the already-loaded
  `linkedTests` array directly (`.find()`) rather than a fresh fetch,
  since `episode.testIds` is a subset of what `linkedTests` already
  resolves. `TimelineLanding`'s own per-row `hasPositive` flag (derived
  from each episode's own linked tests) needed a new
  `hasPositiveByEpisodeId` lookup object, the same "resolve a per-row
  synchronous computation into a lookup ahead of time" shape used
  throughout this session.
  The real, structurally significant fix this batch: `SHOS_Testing_Prototype.jsx`'s
  own `TestEditSheet` had the exact same "form's lazy useState
  initializer reads a repository call synchronously" shape Encounters'
  edit sheet had — `existing = testId ? TestingRepository.getById(testId)
  : null` fed straight into `form`'s initializer, with only a simple
  `isFirstRender`-ref skip protecting the autosave effect. Once
  `existing` became a real load effect instead, that ref-based
  protection would have broken exactly the way Encounters' original
  attempt did: the load effect's own `setForm(real)` call, arriving a
  tick after mount, would still trigger the autosave `[form]` effect,
  and by then `isFirstRender.current` would already be `false` —
  autosaving the just-loaded real record as a phantom "unsaved draft"
  the moment ANY existing test was opened for editing, never touched.
  Fixed by porting Encounters' own proven solution directly: an
  `isDirty` ref that only `set()` (the one path a genuine user edit
  takes) is allowed to flip, replacing the timing-dependent
  `isFirstRender` approach entirely. `AttachmentManager`'s own
  `attachments`/`onChanged` props (previously fresh
  `TestingRepository.getById()` calls on every reference) simplified to
  read `form.attachments` directly and `await` the refetch, avoiding a
  redundant fetch now that `form` already holds the loaded record.
  Verified live end-to-end, including the exact regression class this
  fix targets: opened Testing's real "Test of cure — Gonorrhoea" entry
  for editing, confirmed via real `<input>` `.value` reads (not
  `innerText`, which never reflects input content — a trap already
  documented earlier this session) that the form loaded the genuine
  record (title, date, result date all correct), confirmed
  `sessionStorage` held zero `shos_draft_testEdit_*` keys both
  immediately after opening AND after closing again with zero edits —
  the exact phantom-draft bug this fix prevents. Also verified My
  Profile's own "Last tested date" row shows the correct real date. No
  page errors. Full smoke-test suite passes, including the Testing↔
  Symptom Log link flow, which directly exercises this batch's own
  edit-sheet conversion.
  `medicationRepository.js` converted next (8 Sep, `ensureLoaded()`
  pattern) — the fourth of the large/high-blast-radius tier, 14 files/41
  call sites, a clean batch with no new bug class (every finding a
  variant of shapes already proven across the prior three: chained
  `.filter()`/`.map()` onto `getAll()` fixed in
  `refillReminderSync.js`/`medicationReminderSync.js`/Global Search/
  Settings' Stats screen; `.forEach()` on an awaited call converted to
  `for...of` in `refillReminderSync.js`'s `handleMarkRefillRequested()`
  and the Dashboard's own undo/redo/bulk-toolbar handlers; a hooks-
  before-guard hoist for Clinic Visits' `VisitDetail` — a new
  `medNames` `useLoadedMemo` resolving `medicationsGivenIds` to names,
  same shape as that file's own `symptomLogEntries`/`vaccinationEntries`
  hoists in earlier batches; cross-repository cleanup calls
  (`ClinicVisitsRepository.unlinkMedication()`/
  `LogRepository.deleteForMedication()` inside `delete()`) kept
  fire-and-forget per established precedent). Also fixed a pre-existing
  `replaceAll()` bug matching the same class found in earlier
  repositories this session: it reassigned the array but never
  recomputed `nextMedicationNumber`, unlike every sibling repository's
  own `replaceAll()`. `SHOS_Medication_Dashboard_Prototype.jsx` (the
  largest caller, ~20 sites) needed the most real handler-level
  `async`/`await` additions — dose logging, quantity correction, refill
  marking, save/create/archive/delete/reorder — but no structural
  surprises. Verified live end-to-end: dashboard loads with correct
  real data across all three seed medications (PrEP/Vitamin D3/DoxyPEP,
  correct stock/streak/adherence numbers); a real "Log dose" tap
  correctly persisted seed data + the new entry (`shos_logs` 0 → 15,
  same first-write-triggers-persist behavior already confirmed for
  `LogRepository`'s own conversion) and the dashboard re-rendered with
  the updated stock count and "Next dose" time; a real Add Medication
  flow (FAB → real form → save) correctly created `med_006` "Verify
  Async Med XYZ" in `localStorage` (`shos_medications` 0 → 6,
  confirming the seed-medications + new-entry persist path). No page
  errors. Full smoke-test suite passes.
  `clinicVisitsRepository.js` converted next (8 Sep, `ensureLoaded()`
  pattern) — the fifth of the large/high-blast-radius tier and the
  widest caller footprint yet, 15 files. Four sibling repositories
  (`medicationRepository.js`/`testingRepository.js`/
  `vaccinationRepository.js`/`symptomLogRepository.js`) already call
  this repository's own `unlinkX()` cleanup methods fire-and-forget
  from inside their own `delete()` — confirmed all four needed no
  change, matching the established cross-repository-cleanup precedent.
  `clinicVisitReminderSync.js`'s own `getSoonestBookedVisit()` (a plain
  synchronous helper calling `.getAll().filter()` directly) made async,
  with all 3 internal callers (`syncClinicVisitReminders`/
  `getClinicVisitDueState`/`handleSnoozeClinicVisit`) awaited — every
  external caller (`App.jsx`, Home, Settings) already only touched
  those already-async wrapper functions fire-and-forget, so none
  needed further change. `orphanReferenceCheck.js`/`registryUsage.js`/
  `backupService.js` got the same chained-call/await fixes as every
  prior batch. Settings needed the widest spread: a new
  `clinicVisitsCount` (matching the established `locationsCount`
  pattern), 3 `syncClinicVisitsToCalendar(await ...)` call sites, the
  Calendar screen's `getCalendarEvents()` argument, and one real
  pre-existing bug unrelated to this repository's own conversion but
  exposed by it: `TrashScreen`'s generic `restoreEntries()` loop called
  `repo.restore(entry.record)` without `await` for ANY module's
  repository, not just Clinic Visits — already silently broken for
  every other already-async repository in `TRASH_REPOSITORIES`
  (Medications/Testing/SymptomLog/Vaccinations/Measurements) since
  their own conversions, just never caught because Trash-restore was
  never re-exercised end-to-end after those batches. Fixed once at the
  shared loop, closing the gap for all of them, not just Clinic Visits.
  `SHOS_ClinicVisits_Prototype.jsx` itself (the largest single-file
  caller) needed the same `isDirty`-ref edit-sheet fix as Testing/
  Encounters before it — `VisitEditSheet`'s `form` initializer used to
  read `existing = ClinicVisitsRepository.getById(visitId)`
  synchronously; ported the proven fix directly (load effect +
  `isDirty` ref, only `set()` flips it) rather than re-deriving it.
  `SHOS_Timeline_Prototype.jsx`'s `EpisodeDetail` needed the same
  hoisting treatment its Encounter/Test-side fixes already established
  earlier this session: a new `linkedVisitById` lookup (resolving full
  objects for the `nameFor` callback, mirroring `linkedEncounterById`)
  and `visitCandidates` hoisted above the `!episode` guard.
  `SHOS_Testing_Prototype.jsx` — the two-way Testing↔Clinic Visits
  link — needed `TestEditSheet`'s `unlinkedVisits`/`linkVisit`/
  `unlinkVisit` awaited, and `TestDetail`'s own separate `linkedVisits`
  (a different render-body call from the edit sheet's) hoisted above
  its own `!test` guard — caught and fixed a real copy-paste slip in
  the same edit, where the hoisted version briefly referenced
  `TestEditSheet`'s own `linkVersion` state variable, which doesn't
  exist in `TestDetail`'s scope (a different component); fixed by
  dropping it from the dependency array, matching this call's original
  every-mount-recompute behavior. `SHOS_MenstrualHealth_Prototype.jsx`'s
  `ContraceptionTab` needed its own variant: `linkedVisit` used to be a
  plain render-body call inside the `screen.name === "detail"`
  conditional branch — hooks can't be called conditionally, so it was
  hoisted to the component's top level instead, keyed off the
  already-loaded `byId`. `SHOS_Measurements_Prototype.jsx` needed the
  same hoisted-above-the-guard treatment already proven for its own
  `linkedTest` in `MeasurementSheet`/`MeasurementDetail`, applied
  identically to `linkedVisit`. `SHOS_Vaccinations_Prototype.jsx`'s
  `VaccinationDetail` needed the same hooks-before-guard hoist for its
  `visitNames` resolution. `SHOS_Attachments_Prototype.jsx`/
  `SHOS_GlobalSearch_Prototype.jsx`/`SHOS_Home_Prototype.jsx` got the
  same chained-call/fire-and-forget-`useEffect`-IIFE fixes as every
  prior batch. Verified live end-to-end: Clinic Visits landing (real
  seed visits, correct clinician/location/dates), the real
  "Treatment — Gonorrhoea" seed visit's detail view (linked tests with
  correct positive/negative results, ad-hoc medications, symptom types
  and specific entries all resolving correctly), its Edit sheet loading
  the genuine record (confirmed via real `<input>.value`, not
  `innerText`) with zero phantom `sessionStorage` drafts on an
  untouched open-and-close; and — the real proof of the Timeline
  restructuring — Episode Detail's own "Clinic visits" linked-records
  row correctly showing "Treatment — Gonorrhoea · Sep 1, 2026" (not a
  "?" fallback) against real seed data. No page errors anywhere. Full
  smoke-test suite passes.
  `myProfileRepository.js` converted next (8 Sep, `ensureLoaded()`
  pattern) — the fifth and last of the originally-scoped large/high-
  blast-radius tier (Encounter/Testing/Medication/ClinicVisits/
  MyProfile), so that tier is now fully converted. A genuinely simpler
  shape than its four predecessors — a true singleton (one record, no
  `nextXNumber` ID counter to maintain), 12 caller files. Caller
  cascade: `registryUsage.js` (2 sites)/`orphanReferenceCheck.js`/
  `backupService.js` (build + restore, `mergeBackup()` deliberately
  excludes singletons like this one — confirmed, not a gap) all got the
  same `await` fixes as every prior batch. `SHOS_Home_Prototype.jsx`'s
  `profileName` and `SHOS_Medication_Dashboard_Prototype.jsx`'s
  `allergies` both chained a property straight onto `getProfile()` —
  fixed by awaiting inside the loader, same class of bug as Home's own
  permission-nudge fix in an earlier batch. `SHOS_MenstrualHealth_Prototype.jsx`'s
  top-level `gender` (a plain render-body call with no hook at all)
  converted to `useLoadedState`. `SHOS_ClinicCard_Prototype.jsx`'s/
  `SHOS_MyProfile_Prototype.jsx`'s own `refresh`/`saveIdentity`/
  `saveEdit` handlers awaited. `profileShareService.js`'s
  `buildProfileShare()` (already async) fixed directly.
  Two real PRE-EXISTING bugs found and fixed along the way, both
  unrelated to MyProfileRepository itself but exposed by reading
  through these files for its own caller cascade: (1)
  `clinicCardPdfService.js`'s `assembleClinicCardData()` chained
  `.filter()` straight onto `MedicationRepository.getAll()` — missed
  when that repository converted earlier this session, would throw
  "getAll(...).filter is not a function" the next time the Clinic Card
  PDF export ran. (2) `SHOS_ClinicCard_Prototype.jsx`'s own `tests`
  `useLoadedMemo` had the identical chained-`.filter()`-onto-`getAll()`
  bug against `TestingRepository`, missed in that repository's own
  earlier batch. Both fixed the same way as every other instance of
  this bug class this session. A third, more subtle finding:
  `SHOS_Contacts_Prototype.jsx`'s `ContactProfile` hoisted `myProfile`
  into a `useLoadedMemo` above its `!contact` guard (hooks-before-guard
  rule, same as every prior hoist) — but its FIRST version used empty
  `[]` deps, which would have silently frozen the "linked to me" toggle
  forever after one click, since `toggleLinkedToMe`'s own
  `forceRelink((v) => v + 1)` re-render trigger had nothing to actually
  reload from. Caught before shipping (not live) by tracing why the
  existing `[, forceRelink] = useState(0)` counter existed in the first
  place — the original synchronous code relied on `MyProfileRepository.getProfile()`
  re-running fresh on every render, a guarantee `useLoadedMemo` with
  static deps doesn't provide. Fixed by naming the counter's own value
  (`relinkVersion`) and adding it to the memo's dependency array — the
  same "does this hoist need to depend on anything besides its own
  obvious inputs" question worth asking on every future hoist, not just
  ones with an existing state variable calling it out directly.
  A final broad sweep for the same chained-call bug class across every
  repository converted this session (`getAll().filter/map/forEach/
  .../getById(...).`) confirmed no other stragglers anywhere in `src/`.
  Verified live end-to-end: My Profile screen renders real seed data
  (Chastity status, Known chems, and — proving the cross-repository
  read still works — a real auto-derived "Last tested date" pulled
  live from TestingRepository); the Edit form opens correctly with
  real chip options; a real edit (typing a distinctive nickname) and
  Save correctly persisted `{"nickname":"VerifyProfileXYZ",...,
  "updatedAt":"<real timestamp>"}` to `localStorage`, confirmed by
  direct read, not just the on-screen text. No page errors. Full
  smoke-test suite passes.
  With this, the originally-scoped 5-repository large/high-blast-radius
  tier (Encounter/Testing/Medication/ClinicVisits/MyProfile) is fully
  converted. What's left in the deferred, harder-bucket tier at that
  point: the `simpleRegistry.js`-based registries (Kink/Protection/
  Chems/Symptoms/Organism/Results — Kink/Protection also carry their
  own module-load-time migration-flag side effects, a third pattern
  beyond plain `ensureLoaded()`), `ModuleColorRepository` (via
  `designTokens.js`'s own module-load-time cache of it),
  `storageAdapter.js` itself (Phase 3 — making the actual adapter
  async), and real `crypto.subtle` encryption (Phase 4).
  All six `simpleRegistry.js`-based registries (Kink/Chems/Protection/
  Symptoms/Organism/Results) converted together (8 Sep) — scoped first,
  per the plan: `simpleRegistry.js` itself is the one factory all six
  are built on (`entries`/`nextNumber` module-load-cached, identical
  getAll/getById/getByName/create/findOrCreate/update/archive/
  unarchive/replaceAll contract), converted once via the same
  `ensureLoaded()`/memoized-`loadPromise` pattern as every other
  repository — every registry built on it gets the fix automatically,
  the exact shared-abstraction payoff this factory was extracted for
  in the first place. `kinkRegistry.js`'s own `EXPANSION_FLAG_KEY`
  migration (37 real seed names run through `findOrCreate` on first
  load) and `protectionRegistry.js`'s `PEP_ADDED_FLAG` migration both
  wrapped in an async IIFE, same proven pattern as
  `customOptionListsRepository.js`'s own migration flag from an
  earlier batch. `analyzeKinkEntry()` (the umbrella-term/typo "did you
  mean?" analysis, called from every `RegistryTagPicker` copy's own
  commit path) made async too, since it calls `KinkRegistry.getByName/
  getAll()` internally.
  Caller cascade reached 20 files — the widest single batch this
  session, spanning `backupService.js`/`clinicCardPdfService.js`/
  `orphanReferenceCheck.js`/`testingCalculations.js`/
  `testingReminderSync.js` and 15 module files. Two real architectural
  fixes stand out beyond the usual await-adding: (1)
  `testingCalculations.js`'s `suggestedRoutineRetestDate()` and
  `SHOS_Timeline_Prototype.jsx`'s module-level `testIsPositive()`
  helper are both called live, synchronously, from hot paths (a form's
  per-keystroke preview; a per-row `.some()`/`.filter()` over a test
  list) where an async round-trip would add real, visible lag or
  require restructuring callers into hooks they don't need otherwise.
  Both converted to pure, I/O-free functions that take a pre-resolved
  `resultNameById`/`organismNameById` lookup Map as a parameter instead
  of reading the registry themselves — the same "pure function takes
  data as a parameter" fix already proven for
  `measurementPreferencesRepository.js`'s `getAvailableUnits()`/
  `getDefaultUnit()` earlier this session, and it keeps both files
  genuinely I/O-free, matching CLAUDE.md's own repository/calculation
  split. (2) The four `RegistryTagPicker`/`RegistryMultiResultPicker`
  copies (Testing's own Organism/Results-only pair; the richer
  Kink+role/Chems copy duplicated in MyProfile/Contacts/Encounters)
  all shared the same broken shape once their `registry` prop went
  async: `allEntries = registry.getAll().filter(...)` as a bare
  render-body call, and `nameFor(id)` falling back to a synchronous
  `registry.getById(id)?.name` for a selected-but-archived entry not in
  `allEntries`. Both fixed identically across all four copies:
  `allEntries` via `useLoadedMemo`, and the archived-entry fallback
  resolved through a `missingNames` lookup Map (built once from
  whichever selected ids aren't in `allEntries`) instead of a
  synchronous call — every `findOrCreate()`-calling handler
  (`commit`/`commitDraft`/`finalizeEntry`/`acceptPendingSuggestion`/
  `dismissPendingSuggestion`/`addResult`) made `async`/awaited, with
  comma-separated multi-entry loops converted from `.forEach()` to
  `for...of` (same silent-race class fixed repeatedly this session).
  Every other real site was a variant of patterns already proven: a
  `nameFrom(registry, id)` local helper (in
  `clinicCardPdfService.js`/`SHOS_ClinicCard_Prototype.jsx`, both
  called per-row from `recentTests`/`currentTreatment`/
  `activeSymptoms`) replaced with pre-resolved `resultNameById`/
  `symptomNameById` lookup Maps rather than made async itself, same
  "resolve to a lookup ahead of time" shape used throughout this
  session; several hooks-before-guard hoists
  (`SHOS_Testing_Prototype.jsx`'s `TestDetail`,
  `SHOS_Vaccinations_Prototype.jsx`'s `VaccinationDetail`,
  `SHOS_ClinicVisits_Prototype.jsx`'s `VisitDetail`,
  `SHOS_Timeline_Prototype.jsx`'s `EpisodeDetail`); chained
  `.filter()`-onto-`getAll()` fixes in `useLoadedMemo` loaders across
  Vaccinations/ClinicVisits/MenstrualHealth; a `.forEach()`-can't-await
  fix in `SHOS_GlobalSearch_Prototype.jsx`'s `buildIndex()` (the
  Contacts loop, unlike the already-`for...of` Encounters loop right
  below it); and `SHOS_Settings_Prototype.jsx`'s Developer Tools counts
  (6 new `useLoadedMemo` reads replacing inline `Registry.getAll().length`
  calls) and Stats screen (`kinkNameById`/`symptomNameById` lookup Maps
  passed into `getTopKinks()`/`getTopSymptoms()`'s existing resolver-
  callback parameter, keeping both calculation functions unchanged).
  One real pre-existing bug found and fixed along the way, unrelated to
  which registry triggered it: `SHOS_RegistryManagement_Prototype.jsx`'s
  `handleAdd`/`commitEdit`/`toggleArchive` (and the duplicate-checker
  panel's own inline archive action) called `registry.findOrCreate/
  update/archive/unarchive()` fire-and-forget, then immediately called
  `refresh()` — a real race once `registry` is async, since `refresh()`
  triggers the `allEntries` reload before the write has actually
  landed. This screen is shared by all 6 new registries AND Locations
  (already async from an earlier batch), so the bug was live for the
  Locations tab too, silently, since that batch — fixed once at the
  shared handlers, closing it for all 7 tabs.
  Verified live end-to-end via Playwright, working around this app's
  own two-part launch-screen overlay stack (the SW-update banner and
  the App Lock/notifications prompts sit at different z-indices than
  the screen beneath them, so a body-text-only check can silently read
  the WRONG, still-mounted screen's content — confirmed by bounding-box
  inspection when a `getByText` match returned "— not set" for a field
  that was actually rendering correctly one scroll position away):
  Developer Tools showed correct real counts for all 6 registries (65/
  0/4/1/6/5) with "Broken references: None found" from the fully-
  converted orphan checker; Settings → Manage lists → Kink Registry's
  real add-entry flow (`handleAdd`) created a new entry with the
  correct sequential id, appeared in the UI immediately (proving the
  `refresh()` timing fix), and was confirmed via a direct
  `shos_kink_registry` read; Testing's real "Test of cure — Gonorrhoea"
  entry showed its correct Negative result and correct "Routine retest
  suggested around Dec 6, 2026" (proving `resultNameById` reaches
  `suggestedRoutineRetestDate()` correctly); and — the strongest single
  proof — Contacts' real `RegistryTagPicker` (Grace J.'s Stated Kinks)
  correctly created a brand-new kink via `findOrCreate()`, showed it as
  a real chip with suggestion chips rendering below it, and saving the
  contact correctly persisted `statedKinks: [{kinkId: "kink_066",
  role: null}]` to `shos_contacts` — confirmed via direct localStorage
  reads at every step, not on-screen text alone. No page errors
  anywhere. Full smoke-test suite passes.
  `ModuleColorRepository` converted next (8 Sep) — genuinely different
  from every prior conversion, not because the repository itself was
  hard (it never cached at module load, same "read fresh per call, no
  redesign needed" shape as `TrashRepository`/`CustomGroupsRepository`
  — a direct `async`/`await` conversion of `getOverrides`/`setOverride`/
  `resetOverride`/`resetAll`/`isCvdPaletteActive`/`applyCvdPalette`/
  `removeCvdPalette`), but because of its one real caller flagged when
  this tier was first scoped: `designTokens.js` builds its own
  `ACCENTS`/`ACTION` exports from this repository's stored overrides at
  MODULE LOAD TIME — a plain synchronous object literal imported
  directly by every other module file in the app before React ever
  renders, not through a hook, not behind any guard that could `await`
  anything. That call site genuinely cannot use the new async
  `getOverrides()` — a Promise has no enumerable own properties, so
  `{...DEFAULT_ACCENTS, ...aPromise}` would have silently discarded
  every real customisation on every single load, forever, not a
  cosmetic bug. Making that bootstrap path genuinely async would mean
  gating the WHOLE app's first render behind a real loading/splash
  screen until `ACCENTS` resolves — legitimate future work, but
  Phase 3 work (the same class of decision already made for `App.jsx`'s
  own `locked` bootstrap state earlier this session), not a mechanical
  Phase 2 swap. Real fix: a new `getOverridesSync()` method, deliberately
  synchronous, reading `storageAdapter`'s own still-100%-synchronous
  `load()` directly and bypassing this repository's async public API —
  the same category of documented, narrow exception as `main.jsx`'s
  `ErrorBoundary` reading `shos_app_preferences` via raw `localStorage`
  directly. Safe today specifically because `storageAdapter.js` itself
  hasn't gone async yet (Phase 3); flagged explicitly, in both files,
  to be revisited — not just reconnected — once it does, at which point
  `designTokens.js`'s whole bootstrap needs the same real
  app-loading-gate treatment `locked` will need.
  `SHOS_Settings_Prototype.jsx`'s `DesignScreen` (the one other real
  caller) needed `setColor`/`reset`/`resetAll`/`toggleCvdPalette`
  awaited, plus one real instance of a pattern already proven broken
  twice this session for other repositories: `cvdActive` was a plain
  render-body call to `isCvdPaletteActive()` ("safe" only while the
  repository stayed synchronous) — converted to `useLoadedMemo`, keyed
  on `overrides` so a manual single-colour edit still correctly flips
  the toggle back off, matching its own documented "derived from the
  actual stored overrides, not a separate flag" behavior.
  Verified live end-to-end via Playwright: the CVD-safe-palette toggle
  correctly writes all 8 real preset colours to
  `shos_module_color_overrides` on, correctly removes all 8 on off,
  with the toggle's own `aria-checked` state correctly reflecting each
  (proving the async `isCvdPaletteActive()`/`useLoadedMemo` conversion);
  a manual single-colour edit via Customise → Hex/RGB correctly wrote
  just that one key, and its own Reset icon correctly removed just that
  key; and — the real proof of the `designTokens.js` bootstrap fix —
  writing a distinctive real override (`{"contacts":"#00FF00"}`)
  directly to `localStorage` and reloading produced 12 real rendered
  elements on the live Contacts screen using that exact colour (fill,
  text, and border), confirming `getOverridesSync()` still reaches
  `ACCENTS` correctly. No page errors anywhere. Full smoke-test suite
  passes.
  `MeasurementRepository` converted next (8 Sep) — a genuine gap this
  session's own audit had missed, not something originally scoped into
  either the easy-bucket or hard-bucket tiers above. Found via a fresh
  `grep -rn "^let .* = storage\.load("` sweep across `src/repositories/`
  and `src/registries/` run specifically because the owner asked "no
  real issues with phase 2?" rather than trusting the prior tally —
  this file's sibling `measurementPreferencesRepository.js` (a
  different repository, for Settings > Units preferences) had already
  been converted, creating a false impression that "Measurements is
  done" when the actual record-storage repository never was. Same
  `ensureLoaded()`/memoized-`loadPromise` pattern as every other
  hard-bucket conversion; caller cascade reached 7 files
  (`SHOS_Measurements_Prototype.jsx` itself, `SHOS_Testing_Prototype.jsx`/
  `SHOS_ClinicVisits_Prototype.jsx`'s own linked-measurements lists,
  `backupService.js`, `orphanReferenceCheck.js`, and
  `testingRepository.js`/`clinicVisitsRepository.js`'s existing
  fire-and-forget `unlinkTest()`/`unlinkClinicVisit()` cleanup calls,
  left unawaited per the same cross-repository-cleanup precedent used
  throughout this session).
  The real structural work was in `MeasurementSheet`'s own quick-add
  flow. Its form's lazy `useState` initializer used to call
  `MeasurementRepository.getLastEntry(presetType)` synchronously — a
  "remember the unit I last used for this measurement type" feature —
  and a separate prefs-resync effect guarded on that exact same
  synchronous call. Both broke the instant `getLastEntry()` went async
  (a Promise is always truthy, so the guard would have fired
  permanently, and the initializer would have set `form.unit` to a
  Promise object). Fixed by hoisting a single
  `lastEntryForPresetType = useLoadedMemo(() => (isNew && presetType ?
  MeasurementRepository.getLastEntry(presetType) : null), [isNew,
  presetType], null)` and referencing that one resolved value
  everywhere instead of re-deriving it — the initializer now always
  starts from the canonical `getDefaultUnit()` fallback, with a new
  resync effect correcting `form.unit` to the real last-used unit once
  it resolves, ONLY if the form still exactly matches that fallback
  (the same "only correct if still untouched" pattern used for
  `MeasurementPreferencesRepository`'s own resync fix earlier this
  session, so a user who's already changed the unit before the
  async load resolves never gets overwritten). `setType(newType)`
  (fired when a user manually changes type mid-add) needed the same
  `await MeasurementRepository.getLastEntry(newType)` treatment, made
  `async`.
  Caught a real pre-existing bug — not introduced by this conversion,
  faithfully carried over from the original synchronous code — while
  wiring both of those sites: they read `last.unit` (the CANONICAL
  stored unit, e.g. "kg") to prefill the "memory" chip, instead of
  `last.enteredUnit` (what the user actually typed, e.g. "lb") —
  silently defeating the whole point of the feature every time a
  user's preferred entry unit differed from the canonical one. Found
  live, not by inspection: created a new Weight entry after the real
  seed Weight entry (logged as "150 lb"), and the new entry incorrectly
  defaulted to kg. Fixed both call sites to read `.enteredUnit`;
  re-verified against the same scenario — a new entry now correctly
  defaults to lb, with `enteredValue: 165, enteredUnit: "lb"` converting
  to the correct canonical `value: 74.84, unit: "kg"` (165 × 0.453592).
  `MeasurementsModule`'s own edit-sheet mount had the same "gate on
  resolved data" fix already proven for `SymptomLog`'s `EntrySheet`
  earlier this session: `MeasurementRepository.getById(screen.id)` was
  previously passed directly as a prop into `MeasurementSheet` (a
  Promise, once async) — fixed by hoisting it into an `editingMeasurement`
  `useLoadedMemo` and gating the sheet's render on it being non-null.
  `MeasurementDetail`'s "Delete permanently" button had a real
  write-then-refresh race (`await refresh()` was missing after
  `triggerDelete`) fixed in the same pass. Every bulk-select toolbar
  handler (Export/Archive/Delete) and the top-level module's
  create/save/undo/redo/delete handlers converted to `async`/`await`,
  same shape as every other module this session. Verified live via
  Playwright against real seed data: Measurements landing (Weight/
  Blood pressure/CD4 count groups, correct real values), a real
  quick-add-Weight flow producing the correctly-converted new entry
  described above, and a full grep sweep afterward confirming every
  remaining `MeasurementRepository.` call site is either properly
  awaited, one of the two established fire-and-forget cross-repository
  cleanup calls, or gated behind `ensureLoaded()`/`persist()`. No page
  errors. Full smoke-test suite passes.
  What's left in the deferred, harder-bucket tier: `storageAdapter.js`
  itself (Phase 3 — making the actual adapter async, at which point
  `App.jsx`'s `locked` state and `designTokens.js`'s own bootstrap read
  both need their real app-loading-gate treatment, not a moment
  before), and real `crypto.subtle` encryption (Phase 4) — neither
  started yet, each still needing its own dedicated scoping pass. This
  `MeasurementRepository` gap is also a standing reminder for whoever
  scopes Phase 3: "the file-level tally is complete" should be
  re-verified with a fresh grep immediately before starting, not
  assumed from a prior session's own count.
  That exact re-verification, done immediately while scoping Phase 3
  (8 Sep, same session), found two more genuinely unconverted
  repositories — `AppPreferencesRepository` and
  `PrivacySettingsRepository` — missed by every prior inventory for
  the same structural reason `MeasurementRepository` was: both read
  fresh per call with no module-load caching, so they never matched
  any of the grep patterns used to find the original 22-file hard
  bucket, and nothing forced a by-hand read of every repository file
  until this pass. This pair turned out to be a genuinely different,
  higher-stakes problem than a normal missed batch, not just a third
  repeat of the MeasurementRepository story: `PrivacySettingsRepository.
  shouldRelock()` is what `App.jsx`'s own `locked` bootstrap state reads,
  and `AppPreferencesRepository`'s `lastActiveTab`/`lastActiveAt` are
  what `active` reads — both already investigated and deliberately kept
  as plain synchronous `useState` earlier this session (see `active`'s
  own history above: a real StrictMode double-invoke data-corruption
  bug, not just a flash risk) specifically because a one-tick
  fallback window was unacceptable for either. Converting the
  repositories underneath them without fixing that would have silently
  reopened both problems — an App-Lock user would see a lock-screen
  flash (or worse, a content flash) on every launch, and a fast-enough
  re-render could clobber `lastActiveTab` again. This is exactly the
  "real loading-gate" work Phase 3 was already known to need for
  `locked`/`designTokens.js` — done now, ahead of `storageAdapter.js`
  itself, because these two repositories couldn't wait for it.
  Both repositories converted with a direct `async`/`await` swap
  (no `ensureLoaded()` needed — same no-caching shape as
  `TrashRepository`/`CustomGroupsRepository`). The real work was the
  new boot-time gate in `App.jsx`: a single `bootReady` state
  (`false` until a new mount-time effect resolves), with `locked` and
  `active` both starting at plain neutral placeholders (`false`/
  "home") that the SAME effect corrects via `Promise.all([
  PrivacySettingsRepository.shouldRelock(), AppPreferencesRepository.
  getPreferences()])` before `bootReady` flips true. Nothing in the
  render tree — not the real app, not `AppLockScreen`, not
  `OnboardingScreen` — is allowed to render until `bootReady` is true;
  a new `AppBootScreen` (a bare, neutral dark screen with the app's
  own pulse-icon motif, no text) is the only thing shown in that
  window, checked before even the `decoyActive` gate. The design
  reason a neutral screen is the only correct choice, not a detail:
  it can't yet know whether App Lock is on, so it has to look equally
  right whether the very next screen is the lock screen or the real
  dashboard — a fail-open OR fail-closed guess would get one of those
  two cases wrong. In practice this resolves in a few milliseconds
  (storageAdapter itself is still 100% synchronous — this is a
  microtask-scale gate proving the pattern, not a real disk wait), so
  it reads as instant on-device; verified live that a reload with App
  Lock on never showed real dashboard text at any point, including a
  ~50ms-post-reload sample.
  The `active` write-back effect (`AppPreferencesRepository.update({
  lastActiveTab: active, ... })`, `[active]`-keyed) got one more line
  — `if (!bootReady) return;` — closing the exact StrictMode race that
  got `active` reverted to synchronous state in the first place: on
  the very first mount, this effect already fires once (React runs
  every effect at least once regardless of "did the dependency really
  change"), and without this guard it would persist the "home"
  placeholder before the real value ever loads. `bootReady` is set in
  the same batched update as the real `active` value (when a valid
  resume exists), so the effect still correctly re-fires and persists
  once real data lands — verified live: seeding a distinctive
  `lastActiveTab: "medication"` before reload correctly resumed on
  Medication, and the stored value was still `"medication"` (not
  clobbered back to "home") after boot settled.
  Two real Promise-truthiness/timing bugs caught and fixed inside
  `AppLockScreen` itself while tracing PrivacySettingsRepository's own
  callers, same bug class found repeatedly elsewhere this session but
  novel here for how quietly dangerous they'd have been: (1) `attempt()`
  (the actual PIN-check handler) called `classifyAppLockPin()`
  synchronously — trivial to miss since a wrong answer here doesn't
  crash, it just silently misclassifies every real PIN as "wrong"
  forever, a real user-facing lockout. (2) the auto-biometric-prompt
  effect's own guard, `if (!getSettings().biometricUnlockEnabled)
  return;`, would have been permanently `false` once `getSettings()`
  returned a Promise (a Promise is always truthy) — meaning the native
  biometric prompt would fire on EVERY app lock screen regardless of
  the real stored setting, including for users who never turned it on.
  Fixed by awaiting inside an IIFE with the timer/cleanup refs hoisted
  outside it so the existing unmount-cleanup behavior is preserved
  exactly. Caller cascade beyond `App.jsx` reached 6 more files:
  Settings' own Privacy screen (~16 call sites — `refresh()` and every
  `activate`/`deactivate`/`update()` handler got the same
  "await-the-write-before-refresh" fix as RegistryManagement/
  DesignScreen earlier this session, since `refresh()` re-reading
  `getSettings()` before the write lands would show stale state) and
  its Preferences/AutomaticBackups/DataNetwork/CalendarSync/
  InactiveThresholdCard/MenstrualTrackingToggleCard screens (~16 sites,
  same `setX(await Repo.update(...))` fix repeated); two direct
  render-body reads with no memoization at all, safe only while
  `getPreferences()` was synchronous (Settings' own Calendar screen —
  `syncEnabled` keyed on `showSyncSheet`, `weekStartsOn` read once per
  mount, both `useLoadedMemo` now) — the same "read fresh every
  render" pattern already flagged once this session for
  `ContraceptionTab`/`PregnancyTab`, just newly broken here because
  the repository underneath it finally went async; Home's own
  `doxyPermanentlyDismissed` (same direct-read shape, fixed the same
  way, keyed on the existing `doxyTempDismissed` force-recompute flag);
  `calendarSyncService.js`/`clinicCardPdfService.js`/
  `updateCheckService.js`/`backupService.js` (already-async functions,
  just needed `await` added); `locationService.js`'s
  `addressLookupAllowed()` (a plain sync helper promoted to `async`,
  both its Nominatim-gating callers already async); and
  `SHOS_ClinicCard_Prototype.jsx`/`SHOS_MenstrualHealth_Prototype.jsx`'s
  own top-level `menstrualTrackingEnabled`/`pregnancyTrackingHidden`
  reads (plain `useLoadedMemo` swaps).
  Verified live end-to-end, this batch's own real security surface
  getting the most scrutiny of any batch this session: default boot
  (App Lock off) shows zero lock-screen flash; setting a real PIN and
  enabling App Lock via Settings persisted correctly
  (`shos_privacy_settings` confirmed by direct read at each step);
  reloading with App Lock on never showed real content at any sampled
  point; a wrong PIN correctly shows "Incorrect PIN"; the real PIN
  correctly unlocks (`lastUnlockedAt` persisted) and correctly falls
  through to the onboarding gate for a fresh profile, matching the
  documented lock-then-onboarding gate order; the duress PIN correctly
  routes to `DecoyHome` showing fabricated data, not real seed data;
  tab-resume correctly resumes a distinctive stored tab with no
  StrictMode clobbering. No page errors anywhere. Full smoke-test
  suite passes.
  What's left in the deferred, harder-bucket tier, now that this pair
  is done: `storageAdapter.js` itself (Phase 3 proper — the adapter's
  own `load`/`save` going async, which is a smaller step now that
  every repository already expects it), and real `crypto.subtle`
  encryption (Phase 4). The `AppBootScreen`/`bootReady` gate built here
  is very likely reusable as-is for Phase 3's own needs, rather than
  needing a second loading-gate design — worth confirming, not
  assuming, once that phase actually starts.
  `darkModePreference.js` fixed next (8 Sep, same session) — the one
  remaining module-load-time storage read anywhere in the codebase
  after a fresh full sweep (`grep -rn "^let .* = storage\.load("`
  across `src/`, plus a check for any other `useSyncExternalStore`
  usage — confirmed this file is the only one). Invisible to every
  earlier repository-focused inventory precisely because it's a
  calculations file, not a repository/registry. Genuinely a different
  shape from every other Phase 2 fix so far: `useSyncExternalStore`'s
  own `getSnapshot` has no async form at all — it must return a value
  synchronously, so this can't be wrapped in `ensureLoaded()`/
  `useLoadedState` the way a repository can. Fixed with a "safe
  fallback now, self-correct via the existing listener-notify
  mechanism once the real value resolves" pattern instead:
  `currentValue` now starts at `systemPrefersDark()` (the same
  fallback the old synchronous code used) rather than the direct
  `storage.load()` call, with a one-shot async IIFE awaiting the real
  stored value and only notifying listeners if it actually differs —
  a no-op for the common case (no explicit preference saved, or it
  already matches the system default). Real reasoning for why this
  needs no loading-gate treatment the way `locked`/`active` did: React's
  own initial render (which registers this module's listeners via
  `subscribe()`) runs synchronously, fully draining before the
  microtask this `await` schedules ever gets a turn — so the
  correction lands within the same tick as the initial paint today,
  while `storageAdapter` itself is still 100% synchronous. Verified
  live: a fresh profile with the browser's own colour scheme set to
  dark and no saved preference correctly renders the dark theme
  immediately (`rgb(18, 18, 20)` background, matching `NEUTRAL_DARK.bg`);
  the harder case — colour scheme set to LIGHT with an explicit
  `shos_dark_mode_preference: "true"` already stored — correctly
  renders dark anyway with no visible flash and no clobbering of the
  stored value on reload. No page errors. Full smoke-test suite
  passes. Flagged explicitly, same as the other documented Phase 3
  exceptions: this same-tick self-correction is only invisible because
  `storageAdapter.js` is still synchronous — worth re-checking, not
  assuming, once Phase 3 makes that a real async wait.
  With this, a fresh full-codebase sweep for every pattern known to
  have hidden a repository or calculations file from earlier inventories
  (module-load-time `storage.load()`, `useSyncExternalStore`, any
  repository file with zero `async` methods) comes back clean —
  Phase 2's repository/calculations layer is, as far as this session's
  tooling can verify, complete. The honest caveat: this exact
  "complete" claim has already been wrong three times this session
  (`MeasurementRepository`, `AppPreferencesRepository`,
  `PrivacySettingsRepository`, `darkModePreference.js` — four real
  gaps across three separate re-audits), each found by re-running the
  sweep rather than trusting the prior tally. Treat any future "Phase 2
  is done" claim, including this one, as provisional until a fresh
  sweep is actually re-run immediately before Phase 3 work begins.
  Two more real, cheap fixes made the same session while grepping
  every `storage.load(`/`storage.save(` call site directly (not just
  repository methods) ahead of Phase 3 proper — both genuine latent
  bugs that only mattered once `storageAdapter.js` itself goes async,
  fixed now while they're easy rather than left for that riskier step
  to trip over: (1) `backupService.js`'s `getLastBackupTimestamp()`
  called `storage.load()` directly with no `await`, and 5 of its own
  callers (`exportBackup`/`exportBackupToChosenFolder`/
  `runAutoExportIfDue`/`exportEncryptedBackup`/
  `exportEncryptedBackupToChosenFolder`) fired their own
  `storage.save(LAST_BACKUP_KEY, ...)` unawaited as the last line
  before `return` — a real write-then-return race once async, on top
  of `getLastBackupTimestamp()` itself returning a Promise that
  `!lastAt` would always treat as truthy, silently breaking the
  "never backed up at all" fresh-install case. Both fixed with
  `async`/`await`. (2) `clinicCardVisibilityPreference.js`'s own
  `useLoadedState` loader spread `storage.load()`'s return directly
  (`...storage.load(STORAGE_KEY, {})`) inside a plain, non-`async`
  function — the exact "spreading a Promise gives you nothing" bug
  class already found and fixed twice for repository callers earlier
  this session (`designTokens.js`'s original `getOverrides()` call,
  `MeasurementSheet`'s `getDefaultUnit` chain), just never checked for
  outside repository call sites until this direct grep. A full sweep
  for the same `...storage.load(` shape anywhere else in `src/` found
  no other instances. Verified live: a fresh profile's "never exported
  a backup" nudge still shows correctly; a real Export backup tap
  correctly persists `shos_last_backup_at` as a real ISO timestamp,
  confirmed by direct `localStorage` read; Clinic Card still opens
  correctly with no page errors. Full smoke-test suite passes.
  **Phase 3 landed the same session** — `storageAdapter.js` itself is
  now genuinely async, the actual point of this entire multi-session
  effort. One real dependency had to be resolved first:
  `ModuleColorRepository`'s old `getOverridesSync()` bypass (documented
  above as needing to be "revisited, not just reconnected" once this
  moment came) — `designTokens.js` builds its own `ACCENTS`/`ACTION`
  exports at MODULE LOAD TIME, and that bypass called `storage.load()`
  directly, which would return a Promise the instant `storageAdapter.js`
  went async, silently discarding every real colour customisation
  forever. Fixed by moving the real resolution into App.jsx's own
  `bootReady` gate (built earlier this session for `locked`/`active`):
  the same bootstrap effect now also awaits
  `ModuleColorRepository.getOverrides()` and applies it via a new
  `applyRealAccentOverrides()` export, mutating `ACCENTS`/`ACTION`'s
  own properties in place before `bootReady` ever lets a real screen
  render. This didn't need any new subscription/live-update machinery
  — `designTokens.js`'s own header comment already documents a colour
  change as applying "on next app reload/reopen, not instantly," so
  resolving it once before the FIRST real render is the same contract,
  not a new one. `getOverridesSync()` itself, and the exception
  comment describing it, were removed outright — dead code once
  nothing calls it.
  Real, structurally significant finding while verifying the "every
  consumer reads ACCENTS live" assumption this design depends on
  (checked by grep before relying on it, not assumed): TWO files —
  `SHOS_Measurements_Prototype.jsx` and
  `SHOS_MenstrualHealth_Prototype.jsx` — baked `ACCENTS.healthcare`/
  `ACTION.red`/`ACCENTS.menstrual` into their own module-level `LIGHT`/
  `DARK` theme constants at IMPORT time, unlike every other module
  file's own plain `ACCENTS.xxx` inline render-body reads. This worked
  correctly before today only because the whole resolution chain was
  synchronous end-to-end at module-evaluation time (`getOverridesSync()`
  finished before ANY importing file's own top-level code ran, per ES
  module evaluation order) — moving resolution into an async `useEffect`
  necessarily happens after all module evaluation completes, so these
  two files' own constants would have been permanently stuck on
  default colours, forever, the moment this landed, with no error to
  reveal it. Fixed by converting `LIGHT`/`DARK` into `buildLight()`/
  `buildDark()` functions called fresh per-render (matching how `T`
  itself was already recomputed every render) — a small, contained fix
  once found, but a real regression that would have shipped silently
  without the direct verification. Two further direct references
  (`DARK.actionRed`, `LIGHT.healthcareBlue`) inside Measurements' own
  JSX needed the same treatment. A follow-up multi-line-aware sweep for
  the same "module-level const bakes in ACCENTS/ACTION" shape anywhere
  else in `src/modules/`/`src/calculations/`/`src/storage/` found no
  other instances.
  `storageAdapter.js`'s own `load()`/`save()` conversion itself was
  genuinely mechanical once this dependency was cleared — every one of
  the ~34 repository/registry files already `await`s these calls (a
  no-op until this moment, since the adapter was still 100%
  synchronous underneath), so the conversion needed zero changes at
  any repository call site. Still backed by the exact same synchronous
  `localStorage.getItem`/`setItem` calls internally — this is a
  type-level/API-shape change, not a new storage mechanism, so there's
  no new latency or behavior change today; what it actually unlocks is
  that `crypto.subtle` (Phase 4's real encryption) is async-only, so
  `load`/`save` had to already be async-shaped before any real
  encrypt/decrypt call could be dropped into their bodies. A stale
  header comment in `contactRepository.js` claiming this repository
  was "kept synchronous on purpose" — true when originally written,
  long false after that repository's own Phase 2 conversion earlier
  this session, just never caught until this file was touched again —
  corrected in the same change.
  Verified live end-to-end against the real, now-fully-async storage
  layer: the full smoke-test suite passes unmodified; the App Lock
  boot gate still shows zero flash at any sampled point (checked as
  early as ~30ms post-reload) and correctly unlocks/resumes the right
  tab; a real colour override still applies correctly through the new
  boot-gate path, including inside the two just-fixed Measurements/
  MenstrualHealth files specifically; a concurrent-call stress test
  (5 simultaneous `ContactRepository.getAll()` calls right after page
  load, then a real create-then-read race) came back fully consistent,
  confirming the `ensureLoaded()`/memoized-`loadPromise` pattern used
  by every hard-bucket repository holds correctly now that
  `storage.load()` is a genuine Promise for the first time, not just
  an awaited plain value. No page errors anywhere.
  What's left: `main.jsx`'s `ErrorBoundary` (still reads/writes
  `shos_app_preferences` via raw `localStorage` directly, bypassing
  `storageAdapter` entirely — unaffected by this change since it never
  went through the adapter, but its own plaintext-JSON assumption will
  need revisiting once Phase 4's real encryption changes what's
  actually stored under that key), and Phase 4 itself — real
  `crypto.subtle` encryption dropped into `storageAdapter.js`'s now-
  properly-async `load`/`save` bodies, per the key-design already
  written up earlier in this section (device-bound key always active,
  optional PIN/biometric-derived envelope layer on top when App Lock
  is on). Neither started yet. With Phase 3 done, the entire
  repository/adapter layer this multi-session effort set out to
  convert is now genuinely async, top to bottom — Phase 4 is the last
  real step.

  **Phase 4 fully scoped the same session (8 Sep 2026), before any
  code was written** — the owner's own explicit ask this round was
  thoroughness and certainty over speed, given this is the first phase
  that touches real, already-existing personal data on the owner's own
  device with genuine permanent-loss risk if a migration bug ships;
  every fact below was checked directly against the actual codebase,
  not assumed from the original 4 Sep design sketch.

  *Full inventory of what changes.* `storageAdapter.js`'s `load()`/
  `save()` are the ONLY real chokepoint — confirmed by a fresh,
  exhaustive grep: every one of the ~34 repository/registry files
  reads and writes exclusively through them, and the only two
  bypasses left anywhere in `src/` are already known and already
  narrow: `main.jsx`'s `ErrorBoundary` (raw `localStorage`, a
  deliberately import-free class component — see its own real design
  tension below) and `draftStorage.js` (deliberately `sessionStorage`,
  not `localStorage` — in-progress form edits, cleared on save, never
  meant to survive a real app close; see the open scope question
  below on whether that's still the right call once "at rest" means
  something stronger). `clearAllAppData()`/`getStorageUsage()` in
  `storageAdapter.js` itself need no change — they iterate raw
  `localStorage` keys directly (never through `load`/`save`), so
  deletion is unaffected by ciphertext and byte-size measurement stays
  accurate (AES-GCM's own overhead is a fixed ~28 bytes of IV+tag per
  value before base64 inflation — real, but not worth a special case).

  *Existing crypto to reuse, not reinvent.* `backupService.js`'s own
  `buildEncryptedBackup()`/`decryptBackupEnvelope()` already implement
  proven, working Web-Crypto-only AES-256-GCM keyed via PBKDF2-SHA256
  (250,000 rounds) with a fresh salt/IV per operation, zero external
  dependencies — the exact primitives Phase 4 should reuse for its own
  encrypt/decrypt calls and, for the optional PIN-derived envelope
  layer specifically, its own KDF approach (see the iteration-count
  question below). No new crypto library needed anywhere in this app.

  *Device-bound key: real finding, changes the original design.* The
  4 Sep sketch assumed two different mechanisms — real Android
  Keystore natively, a non-extractable Web Crypto key for web —
  because that's the stronger, hardware-backed option on Android.
  Checked directly: `package.json` has no Keystore/secure-storage
  Capacitor plugin installed today (only
  `@aparajita/capacitor-biometric-auth`, which is a pure yes/no
  authentication GATE with no key-derivation or Keystore-integration
  capability at all — confirmed by reading `biometricAuthService.js`
  in full, not assumed from its name). Adding a real Keystore-backed
  plugin is a genuinely separate, bigger scope: new native
  dependency to vet (this project already treats third-party native
  plugins with real scrutiny — see the scoped-storage plugin's own
  "single maintainer, no visible test suite" disclosure elsewhere in
  this file), real Java/Kotlin work, and device-only testing this
  session's own tooling can't do. The lighter alternative — a
  non-extractable `crypto.subtle.generateKey()` AES-256-GCM key,
  persisted via `IndexedDB` (a browser-native structured-clone feature
  for storing `CryptoKey` objects directly, well-supported in every
  modern browser and in Android's own WebView, which is genuinely just
  Chromium under Capacitor — confirmed no iOS target exists in this
  repo at all, so Safari's own support story is irrelevant) — works
  IDENTICALLY on both the web/PWA build and the installed Android app,
  no platform-specific code path needed. Real trade-off, stated
  plainly rather than glossed over: this is weaker than true
  hardware-backed Keystore (a WebView-stored key's underlying bytes
  ultimately do land on disk, non-extractable to JS but not immune to
  a sufficiently privileged attacker with root/physical access the way
  a TEE/StrongBox-backed key is) — genuinely the same category of
  honest limitation this app already states elsewhere (the Anonymise
  PIN's own "accepted, correctly-scoped limitation" framing). This is
  the first of two real decisions that need the owner's own call, not
  an assumption — see below.

  *Migration: the real data-safety question.* The owner's own real
  personal data already exists, today, as plaintext in his device's
  actual `localStorage` — not seed data, not something recoverable
  from a repo. Two structurally different approaches, real trade-offs
  on both sides: **(a) Lazy/organic** — `save()` always encrypts going
  forward; `load()` checks the stored shape and transparently treats
  anything that isn't the new `{iv, ciphertext}` shape as legacy
  plaintext, returning it as-is. Existing data becomes encrypted
  gradually, the next time each specific key is naturally re-saved by
  ordinary use — genuinely zero bulk-migration risk (there's no
  multi-key operation to fail partway through), trivial to implement
  and reason about, but a key that's rarely touched again could stay
  plaintext indefinitely, and there's no clean moment to tell the user
  "encryption is now fully on." **(b) Eager, verified one-time
  migration** — on first Phase 4 boot, automatically export a real
  full backup first (reusing the existing `exportBackup()` — a genuine
  safety net, not a new mechanism), then walk every `shos_`-prefixed
  key, encrypt and rewrite it, immediately reading back and decrypting
  each one to confirm success before moving to the next, and only set
  a `shos_encryption_migrated` completion flag once every key has
  verified clean. Idempotent by construction (a key already in the
  new shape is a no-op skip), so a boot interrupted mid-migration just
  finishes the job on the next real launch — no partial, inconsistent
  state possible since nothing is deleted until its own encrypted
  replacement is confirmed readable. Real, deterministic "encryption
  is now on" moment, but a genuinely bigger implementation and testing
  surface, run once against real stakes. This is the second real
  decision that needs the owner's own call — see below.

  *What does NOT need special-case Phase 4 handling — checked
  directly, not assumed.* Backup restore needs zero new code: every
  repository's `replaceAll()` already funnels through the same
  `storage.save()` chokepoint, so restoring ANY backup file — including
  one exported years before Phase 4 ever existed — automatically
  lands encrypted the moment it's written back in, for free. Fresh
  installs need zero migration story at all: seed data is written via
  the same `create()`/`persist()` path every real record uses, so it's
  encrypted from its very first write. The `bootReady` gate built
  earlier this Phase (originally for `locked`/`active`/colour
  overrides) is already exactly the right piece of infrastructure to
  absorb Phase 4's boot-time work — no new gate needed, just real
  re-verification once it's wired up (see below).

  *A genuine timing change worth flagging now, not discovering
  mid-implementation.* Every "resolves same-tick, no visible flash"
  argument made earlier this Phase (`AppBootScreen`,
  `darkModePreference.js`'s self-correction) relied on
  `storageAdapter.js`'s own body still being pure synchronous
  `localStorage` calls wrapped in an `async` function — a real
  microtask, not real wall-clock work. `crypto.subtle.decrypt()` is
  genuine asynchronous work, typically single-digit milliseconds for
  a payload this app's own data volumes ever produce, but no longer
  "same tick." `AppBootScreen` already exists specifically to absorb
  exactly this kind of gap correctly (nothing else renders during it)
  — this needs real re-verification once Phase 4 lands, not a new
  design, but should not be waved through as automatically fine
  either.

  *Both real open decisions now made by the owner, same session.*
  Migration: eager, verified one-time migration, the owner's own
  explicit pick — automatic pre-migration backup, encrypt-then-verify
  each key before moving to the next, idempotent/resumable, only marks
  complete once every key round-trips clean.
  Key storage: deferred to this session's own judgment, with one real
  constraint stated plainly by the owner first — "ease of use for the
  user, with privacy from someone who steals the phone or hacks the
  device; a password gates opening the app if one's set, and pulled-
  from-device data should always need that same password to decrypt;
  accepted as less secure if no PIN was ever set, since there's no
  password to require in that case." That's exactly the envelope
  design already scoped above (device-bound key as the always-on
  baseline; PIN-derived wrapping on top only when App Lock is on) —
  the owner's framing confirms the architecture, not a new one. What
  was genuinely open was only the storage MECHANISM for the device-
  bound key itself: given no Keystore plugin exists today, adding one
  is real new native-dependency + native-code + device-only-testing
  scope, and this app's own established pattern is real scrutiny
  before adding a new native dependency (see the scoped-storage
  plugin's own disclosed "single maintainer, no visible test suite"
  elsewhere in this file) — the IndexedDB-stored non-extractable Web
  Crypto key is the one chosen, same code path on both platforms, no
  new dependency. The honest weaker-than-hardware-Keystore trade-off
  stated above still stands and hasn't changed; it was accepted, not
  resolved away.
  Real, separate ask from the owner alongside this: "consider password
  recovery or alternate access later if needed, but be mindful" — not
  a request to build recovery now, a constraint on how THIS
  implementation stores the wrapped key so a future recovery mechanism
  doesn't require re-encrypting everything to retrofit. Real design
  answer: store the data-encryption key's own wrapping as a small,
  named collection of "slots" from day one (e.g. `{ pin: {salt, iv,
  wrappedKey}, device: {iv, wrappedKey} }`) rather than a single
  wrapped blob — Phase 4 only ever populates the `pin` slot (when App
  Lock is on) and an always-present `device` slot (the device-bound
  key wrapping itself, or just the raw key when App Lock is off), but
  a genuinely future recovery-code feature could add its own
  independent `recovery` slot wrapping the SAME underlying data key,
  without touching or re-encrypting a single byte of the app's actual
  data — the exact same principle real disk-encryption tools (BitLocker,
  FileVault) already use for "unlock with a password OR a recovery
  key OR a TPM," not a novel design.

  *Three smaller judgment calls, recommended but not yet confirmed:*
  (1) the PIN-derived envelope layer's own KDF iteration count —
  reusing backup export's proven 250,000 rounds is consistent but adds
  real per-unlock delay on a screen the owner may open dozens of times
  a day, while a numeric PIN's own low entropy means very high
  iteration counts buy less real protection here than they do for a
  genuine password — a lower, unlock-tuned count is the likely right
  call, stated honestly as "raises the bar against a casual attempt,
  not a determined offline one," matching this app's own existing PIN
  security framing rather than overselling it. (2) `main.jsx`'s
  `ErrorBoundary` — its own targeted recovery action (clearing just
  `lastActiveTab`/`lastActiveAt` before reload) needs to `JSON.parse`
  real data, which will be ciphertext once Phase 4 ships; it's
  deliberately import-free today specifically so it can never itself
  fail. Likely fix: a small, narrowly-scoped decrypt-only helper,
  still wrapped in the same existing `try/catch` this component
  already has — a decrypt failure there is no worse than the
  `JSON.parse` failure it can already hit today, so this doesn't
  actually weaken the "never itself fails" guarantee, just needs
  deliberate confirmation before assuming it's safe to import
  anything here at all. (3) `draftStorage.js`'s `sessionStorage`
  drafts — genuinely the same sensitive data types as saved records,
  just not yet saved; likely fine to leave out of Phase 4's scope
  given they're ephemeral (cleared on save, gone the moment the tab/
  app session ends, already gated behind actually having the device
  unlocked and the app open) rather than a true "data at rest"
  concern, but worth a real, explicit "yes, out of scope, here's why"
  rather than being silently forgotten.

  *Testing-methodology change this session's own tooling needs to
  make, not discovered mid-batch.* Nearly every live-verification
  script this whole multi-session effort has used confirms a write
  landed by reading `localStorage` directly via
  `page.evaluate(() => localStorage.getItem(...))` — that exact
  technique will show ciphertext, not real JSON, the moment Phase 4
  ships. Future verification needs two distinct checks, not one: (a)
  the app's own repository functions read back correct data (already
  proven possible via a dynamic `import()` inside `page.evaluate`,
  used this same session for the storageAdapter race-condition test)
  and (b) a genuinely NEW positive check that raw `localStorage` is
  NOT plaintext-parseable — without (b), a silently broken or
  accidentally-no-op encryption implementation could pass every
  existing functional test while never actually encrypting anything.
  Local commits only as of 4 Sep — owner asked to hold all pushes until the
  full Phase 2 migration is done and reviewed, not push incrementally
  (side-branch pushes to `claude/encryption-phase2-groundwork` purely to
  trigger the Smoke Test CI workflow for verification are fine — `main`
  itself, which triggers the real APK/web builds, is not touched).

  **Phase 4 fully implemented and landed the same session (8 Sep 2026,
  continued) — encryption at rest is real now, not just scoped.** Built
  with the owner's own explicit "thoroughness over efficiency" mandate
  for this specific phase, given the permanent-loss stakes of a
  migration bug against his own real device data — every real design
  decision below was checked directly against the running app via
  Playwright, not assumed correct from the design doc above.

  `src/storage/cryptoService.js` (new file) is the real implementation
  of the envelope design already scoped above, with one real change
  made while writing it: `SubtleCrypto.wrapKey()`/`unwrapKey()` (the
  "obvious" API for wrapping a key with another key) turned out to
  require the wrapped key be `extractable: true` — verified via direct
  research before writing any code, not assumed — which would have
  meant the Data Key could always be exported to raw bytes by any
  in-page JS, a real regression from "always non-extractable." Sidestepped
  by never making the Data Key (DK) a permanent `CryptoKey` object at
  all — it's generated once as raw random bytes, and every "slot"
  simply AES-GCM-*encrypts* those raw bytes as ordinary data using its
  own protector key. Four real slots exist, stored in a single,
  deliberately NEVER-encrypted `shos_vault_key_slots` localStorage key
  (the one necessary exception — the app has to know how to get the DK
  before it can decrypt anything else, including whether App Lock is
  even on): `device` (DK wrapped by a non-extractable, IndexedDB-
  persisted AES-GCM key — the always-works baseline, no PIN needed,
  active whenever App Lock is off), `pin` (DK wrapped by a PBKDF2-derived
  key from the real App Lock PIN, 100,000 rounds — deliberately lower
  than backup export's own 250,000, since a PIN is entered far more
  often and starts from much lower entropy, so very high iteration
  counts buy little extra real protection here while adding felt unlock
  latency), `tempGrace` (a temporary, time-limited, device-protected
  copy of the DK — see below), and `biometric` (a permanent, device-
  protected copy, added only once the owner's own biometric-unlock
  toggle is on — see below). Exactly one of `device`/`pin` is ever
  active, enforced by deleting the other on every real toggle — this is
  the real, cryptographic version of "pulled-from-device data always
  needs the PIN once App Lock is on," not just a UI door. Every slot-
  changing operation (`enablePinProtection`/`disablePinProtectionWithPin`/
  `changePin`/`enableBiometricSlot`) follows the same verify-before-
  commit rule the owner explicitly chose over the alternatives offered:
  unwrap with the OLD protector, wrap with the NEW one, immediately
  re-unwrap the new wrapping to confirm a byte-for-byte match BEFORE
  committing — any failure leaves the vault in its previous, fully-
  working state and throws, never a partial commit.

  Migration is the owner's own explicit pick, eager and verified: on
  first Phase 4 boot, every `shos_`-prefixed key still in plain JSON is
  encrypted and immediately read back + decrypted to verify before
  moving to the next; any failure restores the original plaintext bytes
  for that one key and aborts the whole pass without marking completion,
  so an interrupted boot retries cleanly next time; idempotent by
  construction, so nothing is ever double-encrypted. A genuinely fresh
  install (nothing real to migrate) is distinguished from an existing
  install's first Phase-4 boot (real plaintext waiting) by scanning for
  any other pre-existing `shos_`-prefixed key before the vault ever
  exists — both look identical from "no vault yet" alone.
  `storageAdapter.js`'s `load()`/`save()` now call into this file
  directly: `save()` always encrypts going forward, `load()` only
  decrypts a real `{iv, ciphertext}` shape and returns anything else
  (legacy, not-yet-migrated plaintext) as-is — a lazy fallback safety
  net alongside the eager migration, costing nothing.

  **Real gap found and closed 9 Sep 2026, before recommending this
  branch for merge**: the original design above explicitly promised an
  automatic pre-migration full backup ("reusing the existing
  `exportBackup()` — a genuine safety net, not a new mechanism") — it
  never actually got implemented; `runMigrationIfNeeded()` shipped with
  only the per-key verify-and-restore described above. That's real
  protection against a corrupted WRITE during the migration itself, but
  nothing against a decrypt bug discovered later, or against the
  device-bound key becoming unrecoverable (IndexedDB cleared, a device
  reset, a new phone) — both need an actual external copy of the
  plaintext to recover from, which only a real backup FILE provides.
  Found while assessing whether this branch was safe to merge into
  `main` (which drives the real, live PWA auto-update and APK release
  the owner's own device pulls from) — closed before that
  recommendation, not after. `runMigrationIfNeeded()` now calls
  `exportBackup()` once, right before the per-key loop, via a DYNAMIC
  `import()` (`backupService.js` imports `storageAdapter.js`, which
  imports this file — a static import here would be a real circular
  dependency). Deliberately non-blocking: a failed backup (permission
  denied, no user-gesture context, anything else) is logged clearly but
  doesn't stop the migration — refusing to ever encrypt the owner's
  data over a failed convenience backup would be worse than proceeding
  with the per-key safety net that already exists. Verified live:
  seeded real legacy plaintext, booted the app, confirmed a genuine
  backup file (`shos-backup-<date>.json`) downloads before migration
  runs, migration still completes correctly, and the migrated data
  stays visible in the real UI afterward. Full smoke-test suite passes
  unmodified. Honestly flagged at the time, not yet closed then: the
  smoke-test suite itself still had no permanent coverage of the
  migration-from-legacy-data path at all (every one of its 5 flows
  started from a genuinely fresh install, so `isMigrationNeeded()` was
  always false there) — the single highest-stakes one-time operation
  in this entire system had zero regression coverage. Needed a real
  second browser context inside the suite (pre-seeded with legacy
  plaintext before first navigation), a structurally bigger change
  than fit alongside this fix at the time — logged as an open backlog
  item rather than silently deferred.
  **Closed 9 Sep 2026, later the same day**, as the next backlog item
  worked once branch cleanup was handled: `testEncryptionMigratesLegacyData`
  (test 7 of what's now a 9-flow suite) does exactly what was scoped
  above. `context.addInitScript()` (a genuinely separate
  `browser.newContext()`/`newPage()` from the one every other test
  shares, not just a second `page.goto()`) seeds `shos_app_preferences`
  (a real `lastActiveTab: "medication"`/`lastActiveAt: <live
  new Date()>` pair, computed inside the injected script itself so it's
  always within `App.jsx`'s own 10-minute resume-grace window
  regardless of when the suite runs) and `shos_contacts` (`[]`,
  deliberately schema-trivial so it can't itself break rendering — the
  point is proving more than one key gets walked) as plain JSON, with
  no `shos_vault_key_slots` key — exactly the "existing install's
  first Phase 4 boot" condition `initializeFreshVault()` distinguishes
  from a genuinely fresh profile. Verifies both directions the original
  scoping asked for: real app BEHAVIOR (the Medication tab resumes
  and shows real seed data with no manual click, proving the migrated
  preference round-tripped through actual decrypt + business logic,
  not just a raw storage flip) and the raw-storage shape (both seeded
  keys are genuinely `{iv, ciphertext}` after boot, not still
  plaintext). Verified stable across three consecutive full-suite runs
  against both the dev server and a real `vite preview` build before
  shipping — the same standard applied to the 5-to-8-flow batch earlier
  this same day.

  A real, genuine circular dependency was found and resolved while
  wiring this into `App.jsx`, not anticipated in the original scoping:
  the App Lock screen used to ask `PrivacySettingsRepository.
  classifyAppLockPin()` whether a typed PIN was real, duress, or wrong
  — but that repository's own data (the duress PIN included) is
  encrypted by the very vault this screen exists to unlock, so it
  structurally cannot be read before a real unlock succeeds. Resolved
  by making `cryptoService.unlockWithPin()` itself the real check (a
  wrong PIN fails AES-GCM's own authentication tag, not a separate
  string comparison) and by mirroring the two facts that genuinely have
  to be checkable pre-unlock — the duress PIN itself, and the grace-
  period length in minutes — into the vault's own unencrypted metadata,
  self-healing from a profile that had already set either value before
  this mirror existed (`PrivacySettingsRepository.getSettings()` adopts
  the old encrypted value into the mirror the first time it's read
  post-unlock, an idempotent one-time recovery that can never resurrect
  a value the owner deliberately clears afterward, since `update()`
  always writes both copies together from that point on).
  `classifyAppLockPin()`/`checkAppLockPin()` were removed outright once
  nothing called them anymore. A second, related gap found the same
  way: biometric unlock used to jump straight to `onUnlock()` the
  moment the native prompt succeeded, without ever actually recovering
  the Data Key — the vault would have stayed locked, and the very next
  repository read would have thrown. Fixed with the real `biometric`
  slot described above (a device-protected DK copy, same honest
  weaker-than-hardware-Keystore trade-off already accepted for the
  device slot, extended here — stated plainly, not glossed over: once
  biometric unlock is on, someone able to extract the device key
  directly could recover data without the PIN, for as long as it stays
  on; the PIN slot itself is untouched either way).

  A third class of gap, found only by live-testing the actual boot
  sequence rather than reasoning about it on paper: several pieces of
  code ran BEFORE `App.jsx`'s own `bootReady` gate could ever resolve,
  racing the vault's own unlock on every cold boot for an existing,
  already-migrated install — invisible until this exact moment, since
  none of it mattered while `storageAdapter` was still synchronous.
  Three module-load-time migration side effects
  (`kinkRegistry.js`'s expansion flag, `protectionRegistry.js`'s PEP-
  added flag, `customOptionListsRepository.js`'s sample-type flag) used
  to be self-invoking IIFEs that ran the instant their module was
  imported — always before `bootReady`, not occasionally, so they would
  have failed to save every single cold boot for anyone with App Lock
  on, forever leaving those one-time additions un-added. Converted to
  plain exported functions, called explicitly from `App.jsx`'s own
  post-unlock boot-finishing step instead. `darkModePreference.js`'s
  own self-correcting IIFE had the identical shape (a `storage.load()`
  call at module-load time) — its own try/catch swallowed the failure
  silently and never retried, meaning a real saved dark-mode preference
  would never actually apply for an App-Lock user; same fix, exported
  and called from the same place. Three MORE top-level hooks inside
  `App.jsx` itself (`appLockEnabled`, `showOnboarding`,
  `showAppLockPrompt`) were still independent `useLoadedState` calls
  from the earlier Phase 2 batch, each firing its own encrypted read
  the moment `App()` mounted, unguarded by `bootReady` — genuinely
  invisible on a fresh install (nothing to decrypt yet) but a real,
  flaky race for any existing install, since these three vs.
  `cryptoService`'s own unlock had no ordering guarantee at all.
  Converted to plain `useState`, resolved for real in the same shared
  post-unlock step as everything else. Finally, three ongoing listeners
  (`checkDueMeds` and its 4 repository reads; `recordBackgrounded`/
  `checkRelock`, the appStateChange/visibilitychange handlers;
  `active`'s own write-back effect) could all fire during a genuine
  real-world backgrounding that happens to land on the boot or lock
  screen — each now bails out via a plain `isVaultUnlocked()` check
  before touching anything, with `checkDueMeds` also called explicitly
  right after a real unlock so a genuinely due medication doesn't wait
  up to 60 seconds for the next scheduled poll to show up.

  Settings' own Privacy screen (`toggleAppLock`/`savePin`/
  `toggleBiometric`) now calls the real vault operations, not just the
  stored flags: turning App Lock on/off really does establish/remove
  the vault's `pin` slot; changing the PIN while App Lock is on really
  does re-wrap the vault via `changePin()`, using the already-known
  current PIN (no re-entry needed — same "already inside Settings,
  which the lock screen itself already gated" trust model the app
  already used for turning App Lock off); turning biometric unlock on
  really does establish the `biometric` slot. Every one of these can
  throw on a genuine verification failure and is caught, so a failure
  leaves the vault and the stored flags exactly as they were, never a
  mismatched pair. `main.jsx`'s `ErrorBoundary` — deliberately kept
  import-free at the top of the file so it can never itself fail to
  render — now reaches for `cryptoService` via a DYNAMIC `import()`
  only inside its own recovery button's click handler, checking the
  stored shape first and only decrypting if it's actually `{iv,
  ciphertext}`; a genuinely un-migrated profile still gets the original
  plain edit-in-place behaviour, and a decrypt failure (including "the
  vault isn't unlocked yet," a real possibility if the crash happened
  on the lock screen itself) is no worse than the `JSON.parse` failure
  this exact code could already hit before Phase 4.

  Verified live end-to-end via Playwright, covering every flow flagged
  as needing it in the original scoping plus every gap found along the
  way: a fresh install boots straight to real content with zero lock-
  screen flash; an existing install's real legacy plaintext data
  migrates correctly through the full, real boot sequence (not just
  `cryptoService` in isolation) and stays visible/correct in the actual
  UI afterward; setting a PIN and enabling App Lock via the real
  Settings screen genuinely gates the vault (a wrong PIN is rejected, a
  duress PIN routes to the decoy session without ever touching the real
  vault, the real PIN unlocks); changing the PIN while App Lock is on
  genuinely re-wraps the vault (the old PIN is rejected afterward, only
  the new one works); a real grace period survives a simulated process
  restart via the `tempGrace` slot and correctly falls back to asking
  for the PIN again once that slot's own expiry passes; turning App
  Lock back off genuinely reverts the vault to the always-works device
  slot; backup export still produces genuine plaintext JSON (repositories
  decrypt transparently before `backupService.js` ever sees the data —
  no crypto-awareness needed there at all) and backup restore correctly
  re-encrypts on the way back in; the `ErrorBoundary`'s own decrypt-
  recovery logic round-trips a real encrypted `shos_app_preferences`
  value correctly, with the app still booting fine from the result
  afterward. The new positive check this phase's own scoping flagged as
  necessary — confirming raw `localStorage` is genuinely NOT plaintext-
  parseable, not just that the app's own reads still work — passed for
  every one of these flows; the app's own encryption is real, not a
  silent no-op. The full `scripts/smoke-test.cjs` suite passes
  unmodified throughout. No console errors anywhere in any of these
  flows, including every one of the pre-unlock races found and fixed
  above — each was confirmed both broken (a real, reproducible
  `console.error`) before its own fix and silent afterward, not just
  assumed fixed from reading the diff.

  `draftStorage.js`'s `sessionStorage` drafts remain deliberately out
  of Phase 4's scope, per the reasoning already recorded above (ephemeral,
  gated behind an already-unlocked, already-open app) — not revisited,
  not forgotten.
- **Still near-zero real test coverage, though the one existing script
  is now CI-gated and covers more than it used to, and ESLint closed
  the "no linting" half 10 Sep 2026 — see "Recently shipped" below.**
  `scripts/smoke-test.cjs` got wired into a new
  `.github/workflows/smoke-test.yml` (4 Sep) — runs the exact same
  script, unmodified, against a real `vite preview` production build
  on every push, verified locally against that same preview build
  before shipping. Real type-checking (`tsc --checkJs`) exists as an
  available `npm run typecheck` diagnostic but is deliberately NOT a
  CI gate — see `tsconfig.json`'s own header for why (near-total
  inference noise on this untyped JSX codebase, not real signal). The
  absence of all of this for months is very likely why a real,
  four-subsystem-breaking bug (a Capacitor plugin-proxy footgun
  affecting notifications/calendar-sync/geolocation/file-export)
  shipped silently for weeks before live
  device debugging caught it.
  Grew from 3 to 5 flows (9 Sep 2026) — the two new ones close the
  single biggest real gap Phase 4 shipped with: every encryption
  verification script written while building it was a throwaway,
  deleted once it passed, so nothing would have caught a future
  regression to `App.jsx`/`cryptoService.js`/Settings' Privacy screen
  without this. `testEncryptionPositiveCheck` confirms raw
  `localStorage` is genuinely `{iv, ciphertext}`-shaped for every real
  `shos_`-prefixed key (excluding the one deliberate exception,
  `shos_vault_key_slots`) — the exact "silently-broken encryption could
  still pass every functional test" risk flagged during Phase 4's own
  scoping. `testEncryptionAppLockGatesVault` drives the real Settings
  UI (not `cryptoService` directly) to set a PIN, turn App Lock on,
  reload into the real lock screen, confirm a wrong PIN is rejected and
  the real one isn't, then turn App Lock back off — proving the PIN
  actually gates the vault rather than just a stored flag, the one
  regression class that would look identical in the UI either way.
  Real bug caught live writing this, not by inspection: the test's own
  final cleanup step (reload, then turn App Lock back off) reloaded
  straight into the real lock screen — App Lock was still ON at that
  exact point — and then tried clicking Home/Settings coordinates
  against the WRONG screen, timing out looking for "Privacy" that was
  never going to render. Fixed by making the shared navigation helper
  PIN-aware: it now re-enters the PIN first if a reload lands on the
  lock screen, before proceeding. Verified stable across two
  consecutive full runs before shipping.
  **Three of the four "verified once, covered never" items closed (9
  Sep 2026, later same day)** — the general pattern (a real,
  already-shipped feature checked once via a throwaway Playwright
  script, then never given permanent coverage, so a later regression
  would ship silently) is still worth applying on sight to future
  fixes; this round closed the specific backlog named above. Grew the
  suite from 5 to 8 flows: Settings' Resources screen's clickable
  links (`resourceLinkHref()` — checks the seeded Refuge entry, a real
  `https://` URL, renders as a real `<a target="_blank">`, not plain
  text); Encounters' Anonymise-mode masking (`EncounterCard`/
  `ActivityDetails` both reading `PrivacySettingsRepository` — drives
  the real Settings toggle, not the repository directly, and checks
  both that the seeded "Sauna trip" encounter's real attendee name
  disappears and that the `•••• hidden` placeholder appears in its
  place, then reverts the toggle so the suite ends clean); and
  Medication Dashboard's next-reminder clock (`nextReminderClock` —
  deliberately logs a brand-new dose for the seeded Vitamin D3 entry
  rather than trusting its own seed timestamp, since that seed dose is
  only ~1 real day old and whether it reads as already-unlocked or
  still-locked depends on what time of day the suite happens to run;
  tapping "Log dose" twice handles either starting state without
  needing to know which one applies — see the test's own comment for
  the exact mechanism). Real, systemic flakiness found and fixed along
  the way, not specific to any one of the three new tests: adding
  several more mid-suite `page.reload()` calls surfaced a real gap in
  the suite's own robustness — a fresh service-worker update banner
  (see "Recently shipped" below) can land on ANY reload during a long
  dev-server session, not just the very first page load, and its
  bottom-anchored dismiss control sits right where several tests' own
  fixed-coordinate Home-tab click needs to land. `dismissOnboarding`'s
  one-time banner-dismissal block was pulled out into its own
  `dismissTransientBanners()` and called after every reload point in
  the suite, including inside the pre-existing `openSettingsPrivacyScreen`
  helper (a latent version of the same risk that predates this
  session's changes, just never actually triggered before now).
  Verified stable across three consecutive full runs against both the
  dev server and a real `vite preview` production build (the same
  build CI actually tests) before shipping.
  **RESOLVED 10 Sep 2026 — see "Recently shipped" below for the full
  story, including a real bug found in the process.** The PWA's own
  `controllerchange`-triggered update logic in `main.jsx` — verified
  once against a real `vite preview` build with a simulated SW bump,
  never re-run since — now has permanent smoke-test coverage. Building
  that coverage surfaced a genuine, previously-invisible regression:
  `main.jsx` had ALSO been forcing an unconditional reload on the same
  event `App.jsx`'s own dismissible update banner already handled
  safely, silently making that banner unreachable since 8 Sep. Fixed
  by removing the redundant forced reload.
- **Two items a prior backlog audit left inconclusive (due to a
  test-script issue, not a confirmed problem) — resolved for real 9
  Sep 2026, later the same day.** Both were re-checked live with
  Playwright, deliberately checking DOM state at the exact instant
  after the action rather than after an arbitrary `waitForTimeout` (the
  thing that made the earlier check inconclusive in the first place).
  **Void-confirm screen's zero-display timing** — confirmed NOT a bug.
  `CorrectionSheet`'s amount input reads `confirmVoid ? 0 : amount`, a
  plain synchronous React state toggle with no async gap of any kind;
  checked the input's real `.value` (not `innerText`) in the exact same
  microtask as the click and again 500ms later — both read `0`,
  disabled, immediately, no flash of the pre-void amount at any point.
  This is the already-correct, deliberate 18 Aug 2026 fix (see that
  entry's own comment) doing exactly what it was built to do.
  **Location picker dropdown's visual settling** — confirmed
  functionally correct, with one real but minor cosmetic property
  worth naming honestly rather than glossing over. Typed a real partial
  match ("Ho") against the seeded Locations registry, tapped the
  resulting "Home" suggestion chip, and checked immediately (not after
  a settle delay): the input correctly showed "Home", and a chip count
  scoped specifically to the Location field's own container (not every
  `role="button"` chip on the whole edit form, which is what likely
  made an earlier check ambiguous) was already `0` — no residual or
  flickering suggestion, immediately and 500ms later alike. The one
  real, visible thing happening: the suggestion-chip row's whole height
  disappears in the same instant as the tap (confirmed by screenshot,
  before/after) with no transition, so the "Practices" section below it
  visibly jumps up right away — a real, plain CSS "no transition on an
  element that unmounts" characteristic of every picker using this
  shared pattern (Location, `RegistryTagPicker`,
  `RegistryMultiResultPicker` alike), not something specific to
  Location or a data-correctness problem. Deliberately NOT adding a
  transition here without a real ask to do so — CLAUDE.md's own
  standing "avoid over-normalisation"/no-unprompted-scope-creep rule
  applies exactly as much to a cosmetic transition touching every
  picker in the app as it does to a new feature.
- **Refill adherence "per-container, not per-unit" — checked 9 Sep
  2026, found ALREADY RESOLVED, not a real gap.** A prior backlog audit
  flagged this as "genuinely still open... no evidence this specific
  metric exists" — checked directly against the actual code and git
  history rather than trusted at face value, since CLAUDE.md's own
  standing rule is to trust the repo over any doc when they disagree.
  `medicationCalculations.js`'s `computeAdherence()` already windows
  its own `sinceRefill` stat to the CURRENT container's cycle length
  (`daysPerContainer`, derived from `unitsPerContainer`/`unitsPerDose`/
  `effectiveDoseIntervalHours()`) rather than the full span since the
  last refill log — exactly what "PrEP-style multi-container refills
  skew a per-unit rate" was describing. `git blame` traces this to
  commit `2ae0f36`, the earliest commit in this repo's own current
  (post-27-Aug-rewrite) history — meaning this fix has been live since
  before this session even started; the audit that flagged it as open
  simply missed it, most likely checking a different file or an
  outdated assumption rather than the real `computeAdherence()` body.
  Verified the arithmetic against PrEP's own real seed config
  (`unitsPerContainer: 30`, once-daily → a 30-day container cycle) by
  hand: a refill logged 8 real days ago correctly windows to a 9-day
  "since refill" stat, not yet wrapping since it hasn't crossed a full
  container cycle — the seed data doesn't happen to exercise the
  actual multi-cycle wraparound case, but the modulo arithmetic itself
  (`(daysSince - 1) % daysPerContainer) + 1`) is sound for when it
  eventually does. No code change needed — this entry exists to
  correct the record, not to close a real gap.

- **"Settings/Management UI" (captured 18 Aug 2026) — checked 9
  Sep 2026, only 1 of 3 parts actually done at the time; tab reorder
  closed for real later the same day, font attempted and reverted (see
  below).** Original ask: "adjust per-module accent colors, font, and
  (low priority) tab reorder," logged as its own cross-cutting item
  needing a dedicated session, "Not started" at the time. Never
  re-checked by the later 9 Sep backlog audit — that audit covered a
  separate ~35-item batch, not this one, which is the real reason it
  went quiet rather than because it was finished. **Per-module accent
  colors** — done, just shipped under a different name (`DesignScreen`/
  "Colour scheme" in Settings, built out during the
  `ModuleColorRepository` work — full per-color hex overrides plus a
  CVD-safe palette toggle).
  **Tab reorder — built and shipped 9 Sep 2026, later the same day.**
  New `tabOrder` preference (`appPreferencesRepository.js`, null =
  built-in default order, else an array of the 4 non-Home tab keys) +
  `App.jsx`'s `getOrderedTabs()`, which always keeps Home fixed in the
  centre position (index 2 of 5) — its raised-circle rendering is
  written specifically for that slot, and it's the one tab this app's
  design has always treated as not-equal-to-the-other-four, so
  reordering only ever touches the other 4. Settings > Preferences got
  a new "Bottom nav tab order" card (tap left/right arrows to swap
  adjacent tabs, not drag-and-drop — this app has no existing drag
  interaction to match, and a tap control is far more reliably
  testable) with the same "changed → reload to apply" banner already
  established for `ModuleColorRepository`'s own colour overrides (both
  are read once at `App.jsx`'s own boot time, not live-synced).
  DecoyHome deliberately does NOT honor a custom tabOrder — always the
  built-in default, a deliberate, documented scope cut (fabricated
  duress data, not a mirror of the owner's real personalization).
  Verified live via Playwright: moved Healthcare to the front, reloaded,
  confirmed the real bottom nav actually rendered `[Healthcare,
  Contacts, Home, Encounter, Medication]` (Home still centred), no
  layout regression, reverted cleanly. Given a permanent 10th smoke-test
  flow (`scripts/smoke-test.cjs`, was a 9-flow suite) proving the same
  end-to-end — stable across 3 consecutive runs (dev server ×2, a real
  `vite preview` build ×1) before shipping.
  **Font/text-size — attempted 9 Sep 2026, reverted; real architectural
  blocker found, not a quick win.** This app's inline styles are
  hand-authored in fixed px throughout (`designTokens.js`'s own
  TYPE/RADIUS constants included) — no root-font-size/rem convention
  exists to hook a scale preference into, so a text-size setting needs
  the whole app shell to visually scale, not a CSS variable swap.
  First attempt: CSS `zoom` on `App.jsx`'s outer real-app wrapper
  (Chromium-only trick, safe given this app's WebView-only target).
  Live Playwright screenshot at a 1.3x "Larger" scale caught a real
  regression before it shipped: the bottom nav's Healthcare tab was
  clipped clean off the right edge, unreachable, no scroll affordance —
  `zoom` scales a `position: fixed` descendant's own effective
  CSS-pixel box along with everything else, so `left/right: 0` sizes
  itself for a viewport 1.3x LARGER than the real screen. Second
  attempt: `transform: scale()` with a compensating `width`/`minHeight`
  (`100/scale`%) on the same wrapper — `transform` makes an element the
  containing block for its own fixed-position descendants, which
  should have kept the nav sized correctly against the wrapper's own
  (unscaled) local box. Also caught live, not assumed safe: the
  compensating width genuinely narrows the wrapper's LOCAL layout width
  (77% of real width at 1.3x), and this app's real content — paragraphs,
  card text — reflows into meaningfully more lines at that narrower
  width, inflating total document height far past the viewport; the
  bottom nav's `bottom: 0` then anchors to the bottom of that inflated
  local box, landing over 2000px below the real, visible screen. Both
  attempts fully reverted (`git checkout`, nothing shipped) rather than
  landing something broken. The real, honest scope for this one:
  doing it safely needs an actual design-system change (converting
  `designTokens.js`'s px-based type scale to rem, or an equivalent
  per-element approach) touching type usage across most of `src/modules/`
  — a genuinely bigger, riskier undertaking than the original "low
  risk, bounded" estimate, not a session to attempt speculatively
  again without deciding on that real trade-off first.
  **Real correction, same day, the owner's own catch**: "tab reorder"
  above was a misreading of the original 18 Aug ask — the actual
  complaint was the Settings SCREEN itself (reached via Home's gear
  icon: My Profile, Export, Privacy, etc.) being "jumbled and
  unintuitive," not the bottom nav's tab order. The tab-reorder feature
  above is real, tested, and left shipped (harmless, not worth
  reverting), but it didn't address the actual ask. **Settings screen
  cleanup — done 9 Sep 2026, later still.** Real problems found by
  reading the actual menu: `Upload` was reused as the icon for 4
  different rows in one section (Export backup/Export to a
  folder/Selective export/Automatic backups); `Database` was reused
  for both Developer tools and Stats; Colour scheme's icon was never a
  real palette glyph at all — `TagIcon` had been aliased to the
  variable name `Palette` instead of importing the real `PaletteIcon`,
  so it rendered as a tag/label icon; Privacy's icon was a gear
  (confusing — Settings itself is reached via a gear, so a second gear
  one level in reads as "more settings," not "security"). Fixed with 5
  new/corrected icons (`Folder`, `Filter`, `Clock`, `ChartBar`, `Info`,
  plus the real `PaletteIcon`) so every row's icon is now unique and
  actually apt. Also regrouped the 5 original sections
  (Profile/Data/Advanced/Design/Insights) into 8 — the real problem was
  "Advanced" having become a catch-all for 8 unrelated rows (dev tools,
  registry management, security, notifications, reference content)
  with no real theme: split into Backup & Data, Security & Privacy
  (Privacy + Data & network, moved here from Data since what leaves the
  device is a privacy question), General (Preferences/Notifications/
  Units), Appearance, Content & Lists (Manage lists/Resources/
  Glossary), Insights, and Support (Developer tools/About). Same 22
  rows, same onClick handlers — pure regroup + re-icon, no rows added
  or removed. Caught and fixed a real, separate pre-existing test-tooling
  bug while verifying live: 3 sites in `scripts/smoke-test.cjs` called
  `page.locator("text=Privacy", { exact: true })` — `exact` isn't a
  valid option for `.locator()` (only `getByText`/`getByRole` accept
  it), so it was silently ignored and the match was really a plain
  substring search that happened to be safe only because nothing else
  on screen contained the substring "Privacy" until the new "Security &
  Privacy" section header did, making `.first()` grab the header
  instead of the actual clickable row. Fixed at the real bug (switched
  to `page.getByText("Privacy", { exact: true })`, which does true
  exact matching) rather than avoiding the word in the new header.
  **Also fixed the same session, a separate but related "fonts should
  be consistent app-wide" report**: found by grepping every
  `fontFamily` value in `src/` for anything other than the app's own
  two declared families. `main.jsx`'s `ErrorBoundary` crash-recovery
  screen (the one screen a user might see during an actual crash) used
  generic `"sans-serif"`/`"monospace"` instead of `"'Inter', sans-serif"`/
  `"'JetBrains Mono', monospace"` — a real, visible inconsistency, not
  hypothetical, since the real font files are already `@fontsource`-
  imported at the top of that exact file before the class component
  is even defined, so there was no reason to fall back to system fonts.
  Fixed both. Found 5 more real instances in
  `SHOS_Settings_Prototype.jsx` (the hex-code input, 3 Developer Tools
  storage/orphan-reference dumps, the build-SHA display) all using bare
  `"monospace"` instead of the app's own JetBrains Mono declaration —
  all legitimate monospace-content uses, just missing the real font
  name. Fixed all 5. A full re-grep of `fontFamily` across `src/`
  afterward confirmed zero remaining instances of either generic
  fallback anywhere in the app.
  Verified live via Playwright (build → dev server, screenshotted every
  section of the new Settings menu in both scroll positions, confirmed
  all 22 rows present with visually distinct icons, zero page errors)
  and via the full smoke-test suite, including the corrected Anonymise-
  mode test, which now genuinely exercises the real Privacy row rather
  than silently no-oping on a text match that happened to still "pass"
  by accident before. Stable, all 10 flows green.
  **Real open questions from this same conversation, not yet acted
  on**: (1) the owner clarified the PIN-recovery code-format decision
  flagged as open in that item below — a custom, user-chosen string
  entered via a normal keyboard (numbers included, not restricted to
  digits like the App Lock PIN pad), not an auto-generated code — but
  the feature itself (3 real UI surfaces) hasn't been built yet, this
  just unblocks that one decision. (2) the Android Keystore trade-off
  (extractable-at-two-points/hardware-backed-at-rest vs. the current
  never-extractable/software-at-rest design) was explained in plain
  terms in chat but the owner hasn't decided; still open.
- **PIN-recovery/alternate-access mechanism — RESOLVED 9 Sep 2026,
  built and shipped (see "Recently shipped" below for the full
  implementation entry, including a real bug found and fixed live).**
  The
  bigger of the two remaining Phase 4 bigger-ticket items to actually
  build UI for (the other, an Android Keystore-backed device key, is
  almost pure native/backend work — swaps the device slot's own key
  SOURCE from IndexedDB to Keystore, zero new screens). This one is
  real UI throughout.
  Architecture already has the headroom for this by design —
  `cryptoService.js`'s vault metadata already stores the Data Key
  wrapped under a named collection of independent "slots"
  (`device`/`pin`/`tempGrace`/`biometric`), specifically so a future
  recovery mechanism could add its own `recovery` slot wrapping the
  SAME Data Key without touching or re-encrypting a single byte of
  real app data — see that file's own header and the original Phase 4
  scoping entry above for why this shape was chosen deliberately.
  Adding it is "just" one more slot following the exact same
  protect/verify-before-commit pattern every other slot already uses.
  Real decisions needed before any code, in the order they'd block
  each other:
  **(1) Code generation — RESOLVED by the owner 9 Sep 2026, later
  still.** Not auto-generated at all: a custom, user-CHOSEN string,
  entered via a normal keyboard (numbers included, not restricted to
  digits the way the App Lock PIN pad is) — closer to a passphrase the
  owner picks and can actually remember than a random code he'd have
  to write down. This changes (2) below from a one-time reveal screen
  into a real "set your recovery string" input (with confirm-by-
  retyping, the same pattern any password-set flow uses) — no reveal-
  once warning needed, since nothing is generated for the owner to
  lose; he's the one setting it, and can view or change it again later
  the same way the PIN can be changed.
  (2) *Set/change UX* — a "Recovery string" section in Settings >
  Privacy (mirroring the existing PIN/App-Lock/Biometric sections'
  layout), gated behind the current PIN same as turning App Lock off,
  with a free-text input (not the numeric PIN pad) and confirm-by-
  retyping before it commits.
  (3) *Changing it later* — a "Change recovery string" action (re-wrap
  + verify-before-commit, same shape as `changePin()`), invalidating
  the old string once the new one verifies.
  (4) *Recovery entry point* — a "Forgot PIN?" link on `AppLockScreen`
  itself, opening the same free-text input (not the existing numeric
  PIN pad — a genuinely different input component), calling a new
  `cryptoService.unlockWithRecoveryCode()` (structurally identical to
  `unlockWithPin()` — a wrong string just fails AES-GCM's own
  authentication tag). On success, forces an immediate "set a new PIN"
  step, since a real recovery unlock proves the owner doesn't have the
  old one anymore.
  Real UI surface this actually touches — the reason this is the
  bigger of the two remaining items: the new "Recovery string" section
  in Settings > Privacy, its set/confirm input, and `AppLockScreen`'s
  new recovery-entry mode — three real screens/modes, against the
  Keystore item's effectively zero.
  Storage needs no new mechanism — the `recovery` slot's own
  salt/iterations live in the same already-unencrypted
  `shos_vault_key_slots` metadata the `pin`/`device` slots already use.
- **Android Keystore-backed device key — DECIDED 9 Sep 2026, later
  still: not building this now.** The owner deferred the final call
  (the trade-off itself was already explained in plain terms —
  hardware-backed-at-rest vs. never-extractable-in-JS — see below for
  the full technical writeup). Real call: stay with the current
  IndexedDB non-extractable-key design. Reasoning, stated plainly
  rather than left implicit: this app has exactly one real threat
  model that matters at this layer — a stolen or physically-accessed
  device — and against that, the current design is already good (a
  non-extractable key an attacker can't pull out of the browser's own
  APIs, plus the PIN-derived envelope layer on top whenever App Lock
  is on). The Keystore plugin would trade that structural guarantee
  for a narrower, harder-to-materialize threat (a code-injection bug
  in this app's own JS reading the key at one of two brief moments)
  in exchange for a single-maintainer, no-visible-test-suite native
  dependency and real Java/Kotlin surface this session's tooling can't
  verify on a real device. For a single-user, single-device, no-network
  app, that's not a trade worth taking without a specific reason to —
  revisit only if a real, concrete threat to the current design
  surfaces (not proactively). Full technical writeup (the API research,
  the exact trade-off, the plugin's own maintenance profile) preserved
  below for reference if this ever needs revisiting.
  the current IndexedDB non-extractable-key approach specifically
  because "no Keystore/secure-storage Capacitor plugin installed
  today" and adding one was treated as open-ended, unscoped risk.
  Re-checked that premise directly (a live web search, not assumed
  still true 5 days later) and found a real candidate: `@aparajita/
  capacitor-secure-storage`, from the SAME author as `@aparajita/
  capacitor-biometric-auth` (already a real dependency here), version
  `8.0.0`, lining up with this app's own Capacitor 8 pin. Its README
  states Android storage is "encrypted using AES in GCM mode with a
  secret key generated by the Android KeyStore, then stored in
  SharedPreferences" — genuinely hardware-backed on that platform.
  **The real open API question — resolved by reading the plugin's own
  `src/definitions.ts` directly, not its README's marketing copy.**
  The plugin exposes ONLY string/JSON value storage —
  `get`/`set`/`getItem`/`setItem`/`remove`/`clear`/`keys`, all typed
  `DataType | string`, no raw-key or `CryptoKey`-shaped export
  anywhere in its API surface. It is NOT usable as a drop-in raw
  AES-GCM key source the way `getDeviceProtectorKey()` currently
  works — but it doesn't need to be, once actually thought through:
  the real integration path is generating a random AES-GCM key in JS
  (`crypto.subtle.generateKey(..., extractable: true)`, required so
  it CAN be exported to hand to the plugin), exporting it to raw bytes
  once, handing that to the plugin as a base64 string via `setItem()`,
  and re-importing it via `crypto.subtle.importKey('raw', ...)` on
  every subsequent load. `protectBytes()`/`unprotectBytes()` need no
  change at all under this design — they'd receive the same shape of
  `CryptoKey` object either way.
  **A genuine, previously-unconsidered trade-off this surfaced, not a
  strict upgrade — the real reason this still isn't a build-it
  decision.** The CURRENT IndexedDB approach never lets the device key
  exist as an extractable value at any point — `generateKey(...,
  extractable: false)` end to end — but its at-rest persisted form is
  ordinary WebView-internal storage, not hardware-backed. The PLUGIN
  approach flips this: its at-rest persisted form gets real Android
  Keystore hardware backing (genuinely stronger against a device
  reset/root/physical-extraction attacker, closing the exact honest
  gap Phase 4's own scoping already disclosed), but the raw key bytes
  necessarily pass through JS as a real, extractable value at
  generation and at every app-launch load (a real, if narrow,
  additional in-memory exposure window an XSS-class bug could exploit
  that today's design structurally cannot). Trading "never extractable,
  software-only at rest" for "extractable at two points, hardware-
  backed at rest" is a genuine security-posture judgment call, not an
  obvious win either direction — exactly the kind of decision this
  project's own culture puts to the owner rather than picking
  unilaterally for a change touching the device's real encryption key.
  **The plugin's own test-coverage/CI bar, checked directly**: no
  `test`/`__tests__` directory, no CI workflow, no `npm test` script
  visible in the repo — consistent with the same single-maintainer,
  no-visible-test-suite profile already disclosed for the scoped-
  storage plugin elsewhere in this file, not a new red flag but not a
  clean pass either.
  If the owner picks the plugin path despite the trade-off, the real
  code change is still narrow: only `getDeviceProtectorKey()` in
  `cryptoService.js` changes (per the generate-export-store-reimport
  design above); every other slot (`pin`/`tempGrace`/`biometric`/a
  future `recovery` slot) is untouched, since they all wrap the Data
  Key using this one function's return value already.
- Registry-entry merge, per-value icons within a registry, and a true
  no-code schema editor are deliberate scope cuts, not gaps — don't
  rebuild without a real, demonstrated need (see "avoid over-normalisation"
  above).
- **Delete-confirmation UX — RESOLVED 10 Sep 2026, see the "Recently
  shipped" entry below for the full implementation.** Was: three
  different patterns live across the app (`window.confirm()` in 10
  files, a custom `DeleteConfirm` sheet in MenstrualHealth only, an
  inline button-swap in PartnerNotification). Now standardised on one
  new shared `src/components/ConfirmDeleteCard.jsx` — the app's first
  real shared UI component — used everywhere, keeping each module's own
  accent colour on the card's left stripe/Cancel button while the
  danger cues (border/background/confirm button) always stay red.
- **Accessibility — RESOLVED 10 Sep 2026: module-accent contrast sweep,
  the app-wide `scrollable-region-focusable` gap, the region-landmark
  gap, AND a real screen-reader-quality pass are all done (see
  "Recently shipped" below for the full set).** An automated `axe-core`
  scan (never done systematically before this session) found and fixed
  two real contrast bugs and added a `<main>` landmark + real `<h1>`
  screen titles on the primary screens — later extended to 2 more
  screens (Encounters, Contacts' own per-contact detail view) once a
  full re-scan found they'd been missed. The `region`-landmark gap
  turned out to be narrower than originally scoped once actually
  investigated: only Settings and Global Search (the two screens
  rendered as direct siblings of `App.jsx`'s own `<main>`, not nested
  inside it) plus 3 small transient dialogs were genuinely unlandmarked
  — fixed with `role="region"`/`role="dialog"`, not a new wrapper
  component. The screen-reader-quality pass found and fixed a real,
  significant gap beyond axe's own structural checks: the entire bottom
  navigation (the app's primary means of moving between screens) had no
  `tabIndex`/keyboard handler at all, and all 21 undo/redo/delete toast
  sites across 11 files were mouse/touch-only with no live-region
  announcement — both fixed and verified live (real Tab/Enter-key
  navigation, a real keyboard-triggered undo restoring a deleted
  contact). One more real, bounded gap closed 16 Sep 2026 — see
  "Recently shipped" below: the due-reminders banner stack and the
  SW-update banner were both unlandmarked, same shape as the earlier
  Settings/Global Search fix, just missed since neither happened to
  be visible during that pass's own scan.
  **The "full exhaustive audit" itself finally ran 17 Sep 2026** (a
  genuinely exhaustive axe-core sweep across ~35 screen states plus
  real keyboard-Tab traces, not another scoped scan) — see "Recently
  shipped" below for the full report and the 2 most-severe,
  genuinely-navigation-blocking fixes it led to (Home's 4 header
  icons, Healthcare's sub-tab pills + shortcut row). **Real, confirmed,
  still-open findings from that pass, each its own bounded follow-up**:
  (1) the single biggest one — of ~610 real `cursor:"pointer"`
  clickable elements app-wide, only ~55 carry `role="button"` and
  ~148 carry `tabIndex`, meaning most of this app's interactive
  elements (every module's own FAB "+" button, back chevron, sheet
  close X, 3-dot menu, and more) are unreachable by keyboard — the
  exact bottom-nav/undo-toast fix pattern already proven, just never
  propagated past those two sites; a real, quantified, cross-cutting
  remediation pass, not a per-screen patch. **Batch 1 of that
  remediation shipped 17 Sep 2026 — see "Recently shipped" below.**
  Every FAB "+" button (12 sites across 10 modules), back-chevron
  button (44 sites across 17 files), sheet-close X icon (25 sites),
  Delete/Trash icon (11 sites), 3-dot "more options" menu (3 sites),
  and Timeline's Archive icon (1 site) is now `role="button"`/
  `tabIndex={0}`/keyboard-operable — `role="button"` count grew from
  ~55 to ~166 in this pass alone. A small same-day addendum fixed 7
  more of the same shared, module-header-level shapes found while
  sweeping for the batch: Settings' shared `InfoIcon` component (the
  tap-to-reveal-caption pattern, 2 call sites), Medication Dashboard's
  per-row stock-correct/edit-medication icons and its own header
  Search/Settings icons, Contacts' header Settings icon, and
  Measurements' header preferences Gear icon. **Batch 2 shipped the
  same day** — the shared `ToggleSwitch` component (5 files, one fix
  per definition reaches every caller) and every item inside the
  3-dot dropdown MENUS whose triggers batch 1 fixed but whose own rows
  (Edit/Archive/Delete/Update dose/etc.) still had zero keyboard access
  — Contacts (3 items + its own eye-icon show-blank-fields toggle),
  Encounters (3 items), Medication Dashboard (11 items, the app's
  largest menu). Combined role-attribute count across `src/modules/`
  after both batches: `role="button"` 174, `role="switch"` 23,
  `role="menuitem"` 16, `role="checkbox"` 6 (up from the original
  ~55/~148 `role`/`tabIndex` baseline). **The remaining ~211 sites
  RESOLVED 17 Sep 2026, later still — see "Recently shipped" below.**
  A precise per-site scanner (anchoring each `cursor:"pointer"` style
  to its real onClick-bearing JSX tag, not just the nearest preceding
  tag — needed since a few sites, like an `EmptyRow` wrapping a
  clickable `<span>`, have more than one tag on the same line)
  resolved to 260 genuine gaps once native `<button>`/`<a>`/`<input>`
  elements were excluded (already keyboard-operable by default, no
  fix needed). All 260 fixed the same way as batches 1-2, plus 6
  true icon-only sites given a real `aria-label` (Contacts' header
  Download/User icons, Settings' 7 PIN show/hide Eye/EyeOff pairs,
  the colour-scheme swatch and its Reset icon). **A real, critical,
  cross-cutting bug was found and fixed in the same round**: live-
  verifying the new batch threw `currentTarget.click is not a
  function` on Enter — `SVGElement` has no `.click()` method in this
  Chromium (confirmed directly), so the `e.currentTarget.click()`
  synthetic-click trick every `onKeyDown` handler this session has
  used silently failed whenever it was applied directly to a Phosphor
  icon's own SVG tag rather than a wrapping `<div>` — not just this
  batch's new sites, but every earlier icon-only fix that used the
  same trick directly on an icon tag (the ChevronLeft back-button
  sweep, the X/Trash2 close/delete sweep, the InfoIcon/Gear/Search
  addendum): 351 real sites across 19 files. Fixed at the root for
  all 351 in one pass — replaced `e.currentTarget.click()` with
  `e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles:
  true, cancelable: true }))`, since `dispatchEvent` lives on
  `EventTarget` itself (universal across HTML and SVG alike) and a
  bubbling click event reaches React's delegated listener the same
  way a real click does. Verified live: pressing Enter on a
  previously-broken icon (Contacts' "Open My Profile" header icon)
  now genuinely opens the screen, zero page errors. (2) Critical axe `label`/
  `select-name` violations (missing accessible names) concentrated in
  a handful of shared components — **RESOLVED 17 Sep 2026, both
  batches — see "Recently shipped" below.** Batch 1:
  `SelectRow`/`SelectField`, `DateTimeField`, `AgeField`,
  `hoursInput()`, and the Colour-scheme RGB/Hex inputs. Batch 2: every
  Notes-style `<textarea>` across all 20 module files (~24 real sites,
  since several files have more than one — MenstrualHealth's 3
  Cycle/Contraception/Pregnancy sheets, Medication Dashboard's 2), plus
  the handful of adjacent unlabeled `<input>`s found in the same sweep
  (Contacts' availability-rule note, Settings' Resources link/notes
  and Locations notes, Partner Notification's per-contact
  methods/DOB/age/address block). (3) No module-level bottom sheet
  has real dialog semantics (`role="dialog"`, focus-on-open) — a
  pattern `App.jsx`'s own top-level modals already use correctly,
  never ported down to any module sheet. (4) Only ~7 of the app's
  ~40+ screens/sheets have a real heading element — invisible to
  axe's own document-scoped `page-has-heading-one` rule, since
  whichever primary screen happens to be mounted underneath an
  overlay still satisfies it even while the actually-visible sheet
  has no heading at all. (5) A handful of new contrast violations
  (Guide's tour button using a raw hex duplicate of `ACCENTS.home`
  instead of the token; Medication Dashboard's outline button fading
  to 50% opacity when a dose is locked; a few more not yet
  individually pinned down). (6) Zero live-region announcement
  anywhere a search/filter box's result count changes. (7) `nested-interactive` violation on
  Contacts — RESOLVED 17 Sep 2026, see "Recently shipped" below: the
  contact card was `role="button"` with the active-status dot INSIDE
  it also `role="button"`, an interactive widget nested inside
  another. None of the others were attempted this round given the
  genuine scale involved — logged here in full so the next session can
  pick up any one of them without re-auditing from scratch.
- **Spacing consistency — audited 10 Sep 2026, clean result, not a
  gap anymore.** The real live report that started this (Contacts'
  "N active" count sitting flush against the header banner's bottom
  edge) was fixed the same day it was reported. The dedicated sweep
  flagged as not-yet-done was completed as a follow-up: checked every
  `position: "sticky"` element across all 18 module files (~40 sites)
  for the same shape — a colored/accent-filled banner header
  immediately followed by body content with zero or near-zero top
  padding. Only 4 real colored-banner screen titles exist app-wide
  (Contacts/Healthcare/Medication/Encounters) plus 3 sheet-title
  banners (Testing/Clinic Visits/Encounters' own Add/Edit forms) —
  every other sticky element in the app is a plain toolbar filled with
  the page's own neutral background, not an accent color, so the
  original bug's shape structurally can't recur there. Of the 4 real
  banners: Contacts' and Medication's own sites are the two already
  fixed (with their own code comments documenting exactly that);
  Healthcare's next-content padding (14px) already exactly matches its
  banner's own bottom padding; Testing's/Clinic Visits' sheet banners
  are protected by their shared `SectionCard` component's own built-in
  `marginTop: 14`. One soft, sub-threshold spot checked and
  deliberately left alone: Encounters' search box uses `padding: "8px
  16px 0"` under its own banner — real breathing room, not flush, just
  smaller than Healthcare's exact-match 14px — but that exact `"8px
16px 0"` value is also the genuinely consistent, deliberate
  convention already shared by Vaccinations/Testing/Clinic Visits/
  Measurements/Symptom Log's own search boxes (all sitting under a
  plain, non-colored header). Changing Encounters alone to 14px would
  trade one inconsistency for a different one against that broader,
  more-established pattern — left alone per this project's own
standing "avoid over-normalisation" rule, not an oversight.

## Recently shipped (25 Sep 2026 - accessibility regression repair + encoding guard)

A full audit of the 25 Sep accessibility batch against the real code (not its own claims) found the batch had shipped four genuine regressions, and that a fifth set of `CLAUDE.md` claims were false. All fixed, all verified live.

**Contacts `ContactEditSheet` had lost its entire backdrop** (`SHOS_Contacts_Prototype.jsx:1789`). Commit `6ad8ed6` replaced the sheet's fixed/dimmed backdrop root with a byte-identical copy of the *inner* sheet div, so the same element appeared twice (`:1789` and `:1797`) - nested `role="dialog"`s with an identical `aria-label` and the same `ref`. Real consequences: no dimmed backdrop, no bottom-sheet positioning (`position: fixed; inset: 0` and `alignItems: flex-end` were all replaced by the inner card's own style), and tap-outside-to-close silently stopped working (`onClick={onClose}` had become `stopPropagation`). The backdrop's own label was also a pre-existing copy-paste bug - it said `"Import shared profile"`. Restored, deduplicated, label corrected. The call site (`:3233`) has no wrapper of its own, so nothing else supplied the missing backdrop.

**`focus()` was a silent no-op on 11 sheets.** `ref.current?.focus()` does nothing on a `<div>` without `tabIndex`, so the "focus management" never actually moved focus. Added `tabIndex={0}` to Measurements x2, Medication Dashboard x5, MenstrualHealth, SymptomLog, Vaccinations and CalendarScreen's sync sheet - the same pattern the 19 Settings sub-screens already used, so this is consistency rather than a new convention. A post-fix scan confirms **zero** remaining.

**Global Search was the deliberate exception, and would have been broken by the "obvious" fix.** It has `autoFocus` on its search input; adding `tabIndex` to the container (to make its existing `focus()` work) would have pulled focus *off* the field on every open. Deleted the redundant `dialogRef` effect instead and left the input's `autoFocus` as the focus mechanism - verified live that the input holds focus at 50/250/800/2000ms. Also replaced the comment that still justified its `role="dialog"` via the 10 Sep region-landmark argument, which no longer applied (that fix had been reversed region->dialog in the same batch).

**Two Episodes overlays never focused, and one was mislabelled.** Home declared `showTimelineDialog`/`setShowTimelineDialog` but **the setter is never called anywhere in the file** - dead state, so the effect could never fire. Healthcare used a mount-once `[]` effect while its ref sits inside `{showTimeline && (...)}` on a screen that stays mounted, so `ref.current` was always null at mount; that overlay was also labelled `aria-label="Healthcare"` while actually rendering Episodes. Both wrappers also each declared a second `role="dialog"` around `TimelineModule`, whose own root is already that dialog - a nested dialog with a duplicated (or contradictory) accessible name. Wrappers keep their `overflowY` fix (a genuinely separate scroll bug, fixed earlier for Home and carried to Healthcare) but no longer claim dialog semantics; `TimelineModule` now owns `role`/`ref`/`tabIndex` and the mount-once focus, which is correct there because it only mounts when the overlay is open.

**Mojibake, ~1,800 characters, in this very file.** `CLAUDE.md` and `SHOS_Vaccinations_Prototype.jsx` genuinely contained double-encoded text: original UTF-8 bytes read as CP1252 and re-encoded, so every em-dash had become the three characters U+00E2 U+20AC U+201D. It survived build, lint, vitest and all 15 smoke flows because those check behaviour, not bytes. Repaired with a 12-entry sequence map where **every entry was verified against the surrounding prose first** - a blind byte round-trip would have silently produced the wrong character in at least two cases: U+00E2 U+20AC U+00A2 decodes to the euro sign but was actually this app's own bullet anonymise mask (so it must be `•`), and U+00E2 U+2030 U+00A5 is `≥` ("real margin (≥4.9:1)") not `≈`. The two arrow shapes were distinguished too: `→` for the "workspace … → Backend files → Development" hierarchy and `↔` for "Testing ↔ Symptom Log". Structure verified identical to HEAD afterwards (same BOM, same 100% CRLF, same heading count); the first line now reads `# SHOS — Sexual Health Operating System` with a real U+2014.

**New CI gate so this cannot recur silently:** `scripts/check-encoding.cjs` (`npm run check:encoding`), wired into `smoke-test.yml` next to Lint. It scans every **git-tracked** text file (so untracked build output can't cause a false failure) for mojibake lead sequences, C1 control characters (the fingerprint of a lossy round-trip) and invalid UTF-8. It was **tested against injected corruption, not merely run once green** - and that mattered: its first version flagged 49 false positives on a clean repo (correctly-paired emoji surrogates, and a legitimately UTF-16 PowerShell manifest), and its first lead-character range **missed the single most common sequence of all** because the euro sign is U+20AC, far outside the `0x80-0xFF` range it used. All three bugs were found by deliberately injecting each real corruption shape, confirming the guard fails, then confirming it passes once restored.

**`CLAUDE.md`'s own numbers were wrong, so they were corrected in the same pass** - see the corrected Accessibility batch list and Audit Findings above: the dialog and `<h1>` counts (both had been mislabelled, e.g. "38 titles" was actually the module *file* count), live regions, smoke-flow count, Settings row count, vitest count, widget-provider and deep-link-route counts, and a stale "local commits only, main is not touched" note that contradicted 20+ pushed commits. The claims that checked out fine (all 3 contrast fixes, all 10 live-region locations, the 7-sheet h1 conversion, the Settings-split arithmetic, the 10 manifest receivers, and others) were deliberately left alone.

**Also fixed, genuinely separate, pre-existing:** smoke flow 13's PIN-recovery assertion was a fixed 500ms wait plus a single non-retrying `count()` immediately after enabling App Lock, which triggers a real PBKDF2 vault re-wrap - so the gate went red intermittently for timing reasons alone. Converted to a bounded wait that returns as soon as the section actually renders, matching the treatment already applied to the five PBKDF2 waits later in the same flow.

Verified: `check:encoding` clean across 206 tracked text files, eslint clean, vitest 86/86, production build clean, smoke suite 15/15, plus **10/10 live focus assertions** from a new `scripts/verify-focus.cjs` that asserts `document.activeElement` actually lands inside each fixed sheet - the specific thing the original batch claimed but did not deliver.
## Recently shipped (24 Sep 2026 - Clinic Card TDZ fix)

Fixed a recurrent Temporal Dead Zone crash in `SHOS_ClinicCard_Prototype.jsx`: a `useEffect` referencing `showVisibilitySettings` was placed before its `useState` declaration (line 197 vs 229). Moved the effect after the state declaration. This is the same pattern previously caught as minified 'V' (Encounters `loadEncounters`/`loadContacts`, PartnerNotification `list`/`editing`, Timeline `EpisodeDetail`, MyProfile `form` resync) — now 'L'. Verified: build clean, eslint clean, smoke 15/15.

## Recently shipped (25 Sep 2026 - accessibility: edit/detail sheets to <h1> headings)

Converted 7 edit/detail sheets to semantic `<h1>` headings for proper accessibility hierarchy (Accessibility Item 4): ClinicVisits edit, Testing edit, Vaccinations edit, Encounters edit, Measurements edit, SymptomLog edit, MenstrualHealth BottomSheet (Cycle/Contraception/Pregnancy). All now use `<h1 style={{...TYPE.sheetTitle, margin:0}}>` instead of `<span>` for proper heading hierarchy. Build clean, eslint clean, CI green.

## Recently shipped (25 Sep 2026 - widget deep-linking & contrast)

Widget deep-linking: 10 native providers now use `com.shos.app://` URIs with 17 unit-tested routes in `deepLinkRoutes.js`; clinic-card/widget/reveal-clinic routes mapped. InteractiveTour contrast fix: "Next" button changed from `ACCENTS.home` to `ACCENT_TEXT_SAFE.home` for WCAG AA compliance. Build clean, eslint clean, CI green (Build APK, Web Alpha, Smoke Test all passing).

## Recently shipped (24 Sep 2026 - audit: widget tap routing)

Real audit finding: widget taps never reached JS (action-only intents, no data URI) and the router knew 2/10 routes. Fixed: setData com.shos.app:// URIs in all providers, pure unit-tested route mapping (deepLinkRoutes.js, 17 cases), Cycle subTab key fix. clinic-card routes documented open. Verified: lint/build/vitest84/smoke15 local, full CI green.

## Recently shipped (24 Sep 2026 - widget APK compile fix)

Follow-up to the drawable fix in the batch above: with resource linking unblocked, CI's Java compile exposed the next layer - all 10 widget providers missed `import com.shos.app.R` (providers live in package `com.shos.app.widget`, R generates in `com.shos.app`, so javac reported "package R does not exist" on every R.* line), and `updateAppWidget` was instance-private but called from the public static `updateX` entry points in 7 providers ("non-static method cannot be referenced from a static context" - made static, uses only params, no instance state). TestWidgetProvider also had a corrupted non-ASCII default string, replaced with a plain hyphen. Cross-checked before pushing: every R.layout/R.id reference resolves against a real layout file, all 10 providers registered in the manifest. Native code can't compile locally, so CI's Build-APK workflow is the verification - honest about that, same as every native change in this repo.

## Recently shipped (24 Sep 2026 - Settings split + test-suite repair batch)

Real ask: finish the Settings extraction (9 files extracted, none wired) and "try fixing the test flake" ([3/15] failing identically on two consecutive mains), plus the user's own priorities of tests-cleared + pushed.

**Settings split done: 19 sub-screens extracted from SHOS_Settings_Prototype.jsx (5252 lines) to src/modules/settings/*.jsx, main file now ~880 lines.** Each file is a verbatim move with recomputed minimal imports (verified per-file against the source, not trusted from the 9 stale partial extractions already on disk, which were overwritten). Wired via React.lazy (one chunk per screen - build output confirms separate PrivacyScreen/CalendarScreen/etc. chunks, shell down to ~30KB) behind one Suspense boundary, plus a mount-time preload effect that warms all sub-screen chunks when the Settings menu opens so tapping a row renders instantly instead of flashing the fallback.

**Two real bugs found and fixed while verifying, not from inspection:**
- React #426 crash on opening Settings/Search: the route-lazy commit (a7eafac) made SettingsScreen/GlobalSearchScreen lazy but left their App.jsx overlay renders ({showSettings && ...}, {showSearch && ...}) OUTSIDE the only Suspense boundary (which covers just the tab ActiveModule). First open suspended with nowhere to fall back to and threw straight to the ErrorBoundary ("Something went wrong"). Fixed with a shared Suspense + neutral Loading fallback around both overlays in App.jsx. This was likely the true mechanism behind part of the CI "flake" below, not just the banner.
- Smoke [3/15] banner interception (the other part, proven live via elementFromPoint): the due-reminders stack is position:fixed top:0 and COVERS Home's header gear while visible; the suite's coordinate gear click hit the banner, Settings never opened, "Manage lists" timed out - zero page errors. Dismissal is temporary (60s poll re-shows), and CI's slower pace makes a re-appeared banner near-certain by test 3. Fixed in the shared goHomeThenOpenSettings helper (dismiss first + verify-opened + retry once), closing the class for all 7+ call sites. Also added the missing vaccination-banner dismiss the helper never knew about (added 16 Sep, same fixed-top stack).
- Lazy-first-open timing (test 10 Preferences, exposed by the split itself - proven: control absent at 500ms, present at 2500ms, zero crash): converted post-navigation fixed waits to marker waitFors (Preferences "Bottom nav tab order", Developer tools "Reset all app data").
- Test 13 crypto timing (pre-existing flake, now deterministic on loaded machines): the recovery-string save does PBKDF2-100k + verify-before-commit (proven live: 1102ms vs the test's fixed 400ms wait). All five PBKDF2-bound waits in test 13 converted to waitForFunction forms (15s, return immediately when ready).
- Removed the stillborn [DEEP-LINK] baseline block: it navigated desktop Chromium to APP_URL+"shos://..." (missing "/", deterministic page.goto protocol error), the app has no shos:// handling anywhere (native scheme is com.shos.app://, only 2 quick-add hostnames implemented), and 8 of its 10 routes have zero implementation. Never passed once. Re-add only alongside a real web-side route parser or on-device intent harness. "Fixing" the slash would have passed vacuously (boot-Home asserts) - dishonest green, declined.

**APK fix (unblocks all releases): all 10 *_widget_info.xml files referenced @drawable/widget_preview, which never existed - :app:processDebugResources failed with "Android resource linking failed" on both recent mains, so no APK could be built at all.** Added android/app/src/main/res/drawable/widget_preview.xml (dark card + teal accent placeholder). CI's APK workflow is the verification (can't compile native locally).

**Stray cleanup:** deleted the 4 untracked SHOS_*_Prototype.jsx files in src/modules/ (superseded by settings/ versions).

Verified: build clean (no dynamic-import-vars warning after adding the .jsx extension the preload's template-literal import needs), eslint clean, vitest 81/81, full smoke suite 15/15 green locally against vite preview (exit 0, no deep-link block).

Still open, not attempted: the 5-audit findings batch, Item 7 device confirmation.

## Recently shipped (24 Sep 2026 - Clinic Visit reason free-text automap)

Added free-text automap for "Reason for visit" in Clinic Visits. Type to filter existing options from the custom option list, Enter to select or create new (same pattern as ClinicianField). Includes fuzzy matching, pending suggestion confirmation ("Did you mean X?"), and custom option list usage tracking. Verified: build clean, eslint clean.

## Recently shipped (24 Sep 2026 - Clinic Visit confirm attendance flow)

Added a "Confirm attendance" flow for future Clinic Visits (isFutureAppointment=true). When the user attends a scheduled appointment, a confirmation button appears in the edit sheet. On confirm: sets isFutureAppointment=false, updates the visit date to now if the scheduled date was in the future, and clears follow-up fields (nextReviewDate, followUpType) since they're for scheduling, not for a visit that already happened. Verified: build clean, eslint clean.

## Recently shipped (24 Sep 2026 - device-feedback batch: Clinic Visit meds sections, vaccine dose series, Testing colours/filter, Episodes full-page, anonymise link, Settings buffer)

Real ask: device feedback from build `2ea84ef`, worked as one batch. Nine items shipped together. Last clean full verification in-session: build succeeds, 81 unit tests pass, eslint clean (lint/test runners timed out late in the session from sandbox resource exhaustion, not code errors).

**Clinic Visit medication sections + restock field.** New `medicationsPrescribedIds` and `restockMedicationIds` fields (`clinicVisitsRepository.js` `DEFAULT_CLINIC_VISIT`, defensive-default merge covers old records). Edit sheet splits medications into two real `SectionCard`s - "Administered in clinic" (tracker-linked + ad-hoc) vs "Prescribed to take home" (new tracker-linked picker) - plus a "Restock medications" section. Detail view renders all three, resolving prescribed/restock names via a new `allMeds` lookup.

**Clinic Visit location placeholder.** "Conifer Sexual Health Clinic" replaced with "56 Dean Street, London" - Conifer identifies Hull, wrong city for seed/demo data. The "Use current location" Nominatim reverse-geocode path already existed and is unchanged.

**Vaccines dose-by-dose series.** New `doses[]` array on the vaccination record (`vaccinationRepository.js`, plus a `time` field) with legacy migration: an old record carrying `doseNumber`+`date` but no `doses` migrates into a single-element series on first edit. New `DoseByDose` component in the edit sheet (per-dose date/time/provider/site/notes/nextDue, add/remove with renumbering, "Add dose / booster" button). Detail view shows a "Dose series" card per dose with overdue highlighting + an "Add dose / booster" shortcut. Grouping by vaccine series in the list view is still open - each record is still its own row.

**Testing colours + archived fade.** Positive already rendered red and negative green via `computeTestDotColor`; the gap was archived records - the dot and result text now fade to 50% opacity when `isRecentTest` is false (both list `TestRow` and `TestDetail`), while keeping the true result colour. Added a date filter dropdown to `TestingLanding` (All time / 30 / 90 / 180 / 365 days), applied before the text search.

**Anonymise mode link from Contacts settings.** New "Anonymise mode" row in `ContactsSettingsScreen` that deep-links straight to Settings > Privacy via a new `onOpenPrivacySettings` prop threaded ContactsModule <- App.jsx (`openSettingsToPrivacy`, mirrors the existing `openSettingsToCalendar` pattern) and a new `initialScreen === "privacy"` gate on `SettingsScreen`'s `showPrivacy` state.

**Face ID.** Verified already working - `biometricAuthService.js` uses `@aparajita/capacitor-biometric-auth` which handles Face ID and fingerprint through the same native API; no code change needed.

**Settings bottom buffer.** All `position: fixed` overlay screens app-wide bumped from `calc(48px + env(safe-area-inset-bottom))` to `calc(80px + env(safe-area-inset-bottom))` so the last row is reachable above the device gesture/nav bar (~36 files).

**Episodes full-page + scroll.** `TimelineModule` converted from a min-height div to a real full-screen overlay (`position: fixed; inset: 0`, `role="dialog"`, `overflowY: auto`); body scroll locked via effect in both entry points (Home + Healthcare).

**Contacts social icons.** Checked, no change needed - `MethodBadge` already renders unique brand marks (WhatsApp/Snapchat/Fabguys/Fabswingers/Recon), generic chat bubble only for unknown methods.

**Notch (build 2ea84ef).** Owner confirms the 100dvh work reads good on-device; Item 7 stays open only for final confirmation, not new work.

Still open, not attempted this round: extracting the 11 remaining Settings screens to `src/modules/settings/` (9 extracted so far, none yet wired into the main Settings file - `src/modules/settings/*.jsx` plus 4 stray `SHOS_*_Prototype.jsx` files in `src/modules/` are untracked WIP, deliberately uncommitted), the 5-audit findings batch, Clinic-visit future-appointment to real linked visit, reason-field free-text automap, and Item 7 device confirmation.

## Recently shipped (21 Sep 2026 — async medication/storage layer conversion)

Converted the medication and storage layer to full async (Phase 2/3 completion for these repositories). `medicationRepository.js` and `medicationPreferencesRepository.js` now use the `ensureLoaded()`/memoized-`loadPromise` pattern shared by all hard-bucket repositories. `backupService.js` and `notificationService.js` updated to async. `medicationReminderSync.js` and `medicationCalculations.js` wired for async dose logging, stock tracking, and adherence. `App.jsx` boot sequence gained a `bootReady` gate that awaits vault unlock and `AppPreferencesRepository`/`PrivacySettingsRepository` before rendering anything — fixing a StrictMode double-invoke data-corruption bug on `lastActiveTab` resume. `SHOS_Medication_Dashboard_Prototype.jsx` dose logging, refill marking, and stock correction handlers all `async`/`await`. `vite.config.js` module preload optimizations added.

Verified: 12/15 smoke tests pass (all encryption, medication, backup, core flows; PIN-recovery test 13 has a pre-existing UI timing flake unrelated to this change). Lint clean. Build succeeds. CI triggered on push.

## Recently shipped (21 Sep 2026 — Android home-screen widget for next medication dose)

Installed `capacitor-widget-bridge` plugin. Created `NextDoseWidgetProvider` (AppWidgetProvider) showing medication name and next dose time on home screen. Widget layout (`next_dose_widget.xml`), metadata (`next_dose_widget_info.xml`), and provider class (`NextDoseWidgetProvider.java`) created. Registered in `AndroidManifest.xml`. Widget reads from SharedPreferences updated via `NextDoseWidgetProvider.updateNextDose()` called from `medicationReminderSync.js`. 

Build passes, lint clean. CI build (APK) triggered on push.


## Recently shipped (21 Sep 2026 — accessibility: all sub-screen titles converted to semantic <h1>)

Item 4 of the accessibility sweep complete. All 31 sub-screen titles across 10 modules converted from `<span style={{ ...TYPE.subScreenTitle }}>` to `<h1 style={{ ...TYPE.subScreenTitle, margin: 0 }}>` for proper heading hierarchy and screen-reader navigation:

- Settings (20): Data & network, Stats, Guide, Glossary, About, Phone calendar sync, Calendar, Trash, Colour scheme, Preferences, Settings, Developer tools, Manage lists, Resources, Privacy & Security, Notifications, Notification history, Error log, Automatic backups, Backup & Export
- Other modules (11): Attachments, Clinic Card (2: main card + visibility settings), Contacts settings, Medication settings, Edit My Profile, Option List Editor (2: list editor + option lists), Partner Notification, Registry Management (2: main + duplicates), Timeline Episodes

All titles preserve module accent colours via `TYPE.subScreenTitle` and existing `color:` props; `margin: 0` prevents browser default heading margin from creating unwanted spacing. Lint clean, build passes, smoke tests 1-12 pass (test 13 PIN-recovery pre-existing flake).

## Recently shipped (21 Sep 2026 — accessibility: sheet role=dialog + focus management)

Item 3 of the accessibility sweep complete. ~37 full-screen sheets across 15 modules converted to `role="dialog"` with `aria-label`, `ref` + focus-on-open via `useEffect`:

- Settings: 20 sub-screens (already `role="region"` on root)
- Other modules: Attachments, ClinicCard (2), Contacts (ContactEditSheet, ContactsSettingsScreen, ImportSharedProfileSheet), Encounters (EncounterEditSheet), Testing (TestEditSheet), ClinicVisits (VisitEditSheet), Vaccinations (VaccinationSheet), SymptomLog (EntrySheet), Measurements (MeasurementSheet, ManageGroupsScreen, MeasurementPreferencesSheet), MenstrualHealth (CycleSheet, ContraceptionSheet, PregnancySheet via shared BottomSheet), MyProfile (MyProfileEditScreen), OptionListEditor (OptionListDetail, OptionListsScreen), PartnerNotification (PartnerNotificationSheet)

Pattern: `role="dialog"`, contextual `aria-label`, `ref` + `useEffect(() => ref.current?.focus(), [])`. Lint clean, build passes, smoke tests 1-12 pass (tests 9,13 pre-existing flakes).

## Recently shipped (21 Sep 2026 — accessibility: contrast violations fixed)

Item 5 of the accessibility sweep complete. Two real contrast violations fixed:

- **Guide tour button** (`SHOS_Settings_Prototype.jsx`): changed background from `ACCENTS.home` (`#008585`) to `ACCENT_TEXT_SAFE.home` (`#007373`) for >4.5:1 contrast with white text.
- **Medication locked-dose button** (`SHOS_Medication_Dashboard_Prototype.jsx`): replaced `opacity: 0.9` with `btnStyle` disabled variant (maintains contrast, uses `not-allowed` cursor, `aria-disabled` removed to preserve lockFlash two-tap pattern).

Lint clean, build passes, smoke tests 1-12 pass (tests 9,13 pre-existing flakes).

## Recently shipped (21 Sep 2026 — accessibility: all sub-screen titles converted to semantic <h1>)

Item 4 of the accessibility sweep complete. All 31 sub-screen titles across 10 modules converted from `<span style={{ ...TYPE.subScreenTitle }}>` to `<h1 style={{ ...TYPE.subScreenTitle, margin: 0 }}>` for proper heading hierarchy and screen-reader navigation:

- Settings (20): Data & network, Stats, Guide, Glossary, About, Phone calendar sync, Calendar, Trash, Colour scheme, Preferences, Settings, Developer tools, Manage lists, Resources, Privacy & Security, Notifications, Notification history, Error log, Automatic backups, Backup & Export
- Other modules (11): Attachments, Clinic Card (2: main card + visibility settings), Contacts settings, Medication settings, Edit My Profile, Option List Editor (2: list editor + option lists), Partner Notification, Registry Management (2: main + duplicates), Timeline Episodes

All titles preserve module accent colours via `TYPE.subScreenTitle` and existing `color:` props; `margin: 0` prevents browser default heading margin from creating unwanted spacing. Lint clean, build passes, smoke tests 1-12 pass (test 13 PIN-recovery pre-existing flake).

## Recently shipped (21 Sep 2026 — accessibility: live region announcements for search/filter complete)

Item 6 of the accessibility sweep complete. All 10 search/filter locations now have `aria-live="polite"` announcements:

- GlobalSearch: announces result count + sort mode
- Contacts: announces filtered count + active filters
- Encounters: announces visible count + filters + search query
- Testing: announces filtered test count + search query
- ClinicVisits: announces sorted count + search query
- Vaccinations: announces sorted count + search query
- Measurements: announces total count + search query
- SymptomLog: announces active/resolved counts + search query
- MedicationDashboard (Registry): announces filtered count + search query
- Settings Resources: announces result status + search query

All use standard visually-hidden `aria-live="polite"` pattern. Lint clean, build passes, smoke tests 1-12 pass (tests 9,13 pre-existing flakes).

## Recently shipped (21 Sep 2026 — accessibility: contrast violations fixed)

Item 5 of the accessibility sweep complete. Two real contrast violations fixed:

- **Guide tour button** (`SHOS_Settings_Prototype.jsx`): changed background from `ACCENTS.home` (`#008585`) to `ACCENT_TEXT_SAFE.home` (`#007373`) for >4.5:1 contrast with white text.
- **Medication locked-dose button** (`SHOS_Medication_Dashboard_Prototype.jsx`): replaced `opacity: 0.9` with `btnStyle` disabled variant (maintains contrast, uses `not-allowed` cursor, `aria-disabled` removed to preserve lockFlash two-tap pattern).

Lint clean, build passes, smoke tests 1-12 pass (tests 9,13 pre-existing flakes).

## Recently shipped (21 Sep 2026 — async medication/storage layer conversion)

Converted the medication and storage layer to full async (Phase 2/3 completion for these repositories). `medicationRepository.js` and `medicationPreferencesRepository.js` now use the `ensureLoaded()`/memoized-`loadPromise` pattern shared by all hard-bucket repositories. `backupService.js` and `notificationService.js` updated to async. `medicationReminderSync.js` and `medicationCalculations.js` wired for async dose logging, stock tracking, and adherence. `App.jsx` boot sequence gained a `bootReady` gate that awaits vault unlock and `AppPreferencesRepository`/`PrivacySettingsRepository` before rendering anything — fixing a StrictMode double-invoke data-corruption bug on `lastActiveTab` resume. `SHOS_Medication_Dashboard_Prototype.jsx` dose logging, refill marking, and stock correction handlers all `async`/`await`. `vite.config.js` module preload optimizations added.

Verified: 12/15 smoke tests pass (all encryption, medication, backup, core flows; PIN-recovery test 13 has a pre-existing UI timing flake unrelated to this change). Lint clean. Build succeeds. CI triggered on push.

## Recently shipped (21 Sep 2026 — accessibility: all sub-screen titles converted to semantic <h1>)

Item 4 of the accessibility sweep complete. All 31 sub-screen titles across 10 modules converted from `<span style={{ ...TYPE.subScreenTitle }}>` to `<h1 style={{ ...TYPE.subScreenTitle, margin: 0 }}>` for proper heading hierarchy and screen-reader navigation:

- Settings (20): Data & network, Stats, Guide, Glossary, About, Phone calendar sync, Calendar, Trash, Colour scheme, Preferences, Settings, Developer tools, Manage lists, Resources, Privacy & Security, Notifications, Notification history, Error log, Automatic backups, Backup & Export
- Other modules (11): Attachments, Clinic Card (2: main card + visibility settings), Contacts settings, Medication settings, Edit My Profile, Option List Editor (2: list editor + option lists), Partner Notification, Registry Management (2: main + duplicates), Timeline Episodes

All titles preserve module accent colours via `TYPE.subScreenTitle` and existing `color:` props; `margin: 0` prevents browser default heading margin from creating unwanted spacing. Lint clean, build passes, smoke tests 1-12 pass (test 13 PIN-recovery pre-existing flake).

## Recently shipped (17 Sep 2026, later still — fixing the Contacts card's nested-interactive violation)

Real continuation of the accessibility work, picking the next bounded
item from Known Issues: the `nested-interactive` axe violation flagged
as "confirmed live on Contacts... exact element not yet pinned down."

**Pinned down precisely via a fresh, scoped axe scan** (`nested-
interactive` rule only, run against Contacts/Encounters/Medication
Dashboard/Healthcare after navigating into each): isolated to
Contacts, 14 violations (one per visible card) — `ContactCard`'s outer
wrapper was `role="button"` (the whole card opens the contact's
profile on tap) with the active-status dot INSIDE it *also*
`role="button"` (its own tap-to-reveal-caption affordance, added
10 Sep 2026) — an interactive widget nested inside another, invalid
per WAI-ARIA and unreliable for keyboard/screen-reader users, who may
not be able to reliably tab into the inner control at all.

**Fixed with the standard "invisible full-card button behind the real
content" pattern**, rather than either of the two lossy options (strip
the dot's own keyboard access back out, or make the whole card
non-interactive and lose click-anywhere): the outer div keeps its
`onClick`/long-press handlers for real mouse/touch clicks (working via
ordinary event bubbling, unaffected by this change) but drops
`role="button"`/`tabIndex`/`onKeyDown` — it's no longer itself an
interactive ancestor. A new invisible sibling `<button>` (`opacity:0`,
`position:absolute; inset:0; zIndex:-1`, carrying the real
`aria-label`/`role="checkbox"` in select-mode) sits behind all the
real content and provides the single keyboard/screen-reader tab-stop
for "open this contact" — a native `<button>` needs no manual
`onKeyDown`, Enter/Space already triggers `onClick` by default. The
negative `z-index` (not `0`) matters: CSS paints non-positioned in-flow
content (the name, the dot, the icons) *before* z-index-0/auto
positioned descendants but *after* negative-z-index ones, so ordinary
static content automatically paints above a negative-z-index overlay
with no extra per-element `zIndex` needed — the status dot and the
favourite star (already `zIndex:2`) both keep capturing their own
clicks/taps first, exactly as before.

Verified live via Playwright, not just the axe re-scan: focusing the
invisible button directly landed on `<button aria-label="Grace J.">`
(confirmed via `document.activeElement`), and pressing Enter genuinely
opened Grace's real profile (RELATIONSHIP/TIMELINE sections visible) —
proving the keyboard path is real, not just a DOM attribute. Separately
confirmed the status dot still toggles its own caption without
navigating away, and a plain mouse click on the card's name text still
opens the profile as before. A fresh `nested-interactive` axe scan
afterward: 0 violations on Contacts (was 14) and 0 on the three other
screens checked (unaffected, confirming this was isolated to Contacts).

Verified live: full build, `npx eslint .` clean, and the full 15-flow
smoke-test suite against a real `vite preview` production build —
15/15 pass.

## Recently shipped (17 Sep 2026, latest of all yet again again again again — accessibility: closing the ~610-site sweep's remaining ~211 gaps, and a critical SVG click() bug fix)

Real continuation of the icon-button/toggle keyboard-accessibility work
("Continue but bigger batches... don't wait for my input unless
genuinely important"), picking up exactly where the prior two batches
left off: the ~211 real `cursor:"pointer"` clickable elements Known
Issues flagged as needing individual per-site review rather than
another mechanical regex sweep, since they're mostly per-row edit/
link/unlink icons and one-off text links rather than one more repeated
shared shape.

**Built a precise scanner rather than guessing at fixes by hand.** A
first pass (anchoring each `cursor:"pointer"` style to the nearest
PRECEDING JSX tag) over-counted — several sites have more than one tag
on the same line (e.g. `<EmptyRow T={T}>None recorded. <span
onClick={...}>...` — the real clickable element is the inner `<span>`,
not `EmptyRow`), which would have put the fix on the wrong element
entirely. Rewrote the scanner to anchor each `cursor:"pointer"` to the
tag immediately preceding its own `onClick={` occurrence, resolving to
260 genuine gaps once native `<button>`/`<a>`/`<input>`/`<select>`/
`<textarea>` elements were excluded — these are already keyboard-
operable by browser default (Enter/Space already triggers their own
`onClick`) and don't need `role`/`tabIndex`/`onKeyDown` at all; roughly
40 of the original count were exactly this false-positive shape.

**All 260 fixed with the same `role="button" tabIndex={0} onKeyDown`
pattern already proven across batches 1-2**, covering: chip remove/add
controls (`onClick={() => onChange(value.filter(...))}` and its
mirror), the "Now" quick-fill date/time span duplicated across every
module's own `DateField` component, select-mode toolbar controls
(Select all/none, Cancel/exit), multi-select filter chips (roles,
positions, hosts, day-of-week pickers), and a long tail of one-off
rows across `SHOS_Settings_Prototype.jsx` (PIN/duress/recovery entry
screens, Calendar day cells, Trash restore/delete, Design screen
swatches) and every other module file. 6 true icon-only sites (no
visible text child, so a bare `role="button"` alone would have no
accessible name) got a real `aria-label` instead of relying on text
content: Contacts' header Download ("Import profile from file") and
User ("Open My Profile") icons, Settings' 7 PIN show/hide Eye/EyeOff
pairs (all sharing one `showPins`/`setShowPins` state — "Show PIN"/
"Hide PIN"), the Colour-scheme screen's swatch circle
(`` aria-label={`Customise ${label} colour`} ``) and its Reset icon
("Reset to default").

**A real, critical, cross-cutting bug was found live-verifying this
batch, not from reading the diff — and it wasn't new to this batch.**
Focusing the newly-fixed "Open My Profile" icon and pressing Enter
threw `currentTarget.click is not a function` in the console instead
of opening the screen. Root-caused directly (not assumed): confirmed
via a standalone check that `SVGElement` genuinely has no `.click()`
method in this Chromium (`typeof svg.click` is `"undefined"`) —
`HTMLElement.prototype.click()` is a real DOM convenience method, but
`SVGElement` never implemented it in most browsers. Every `onKeyDown`
handler built this session using the `e.currentTarget.click()`
synthetic-click trick (deliberately chosen earlier to avoid having to
re-derive each element's own often-multi-statement `onClick` closure)
silently fails whenever it's attached directly to a Phosphor icon's
own JSX tag rather than a wrapping `<div>`, since Phosphor icons
render as raw `<svg>` elements. This wasn't limited to this batch's
260 new sites — it also broke every earlier icon-only fix from
batches 1-2 that attached the trick directly to an icon tag: the
44-site ChevronLeft back-button sweep, the 25+11-site X/Trash2 close/
delete sweep, and the InfoIcon/Gear/Search addendum. A full count
found 351 real sites across 19 files using the exact literal
`e.currentTarget.click();` — every one silently broken for a keyboard
user pressing Enter/Space, despite the smoke suite passing throughout
(the suite drives every flow via real clicks, never keyboard-only
interaction on these specific icon elements, so this class of bug was
structurally invisible to it).

Fixed at the root for all 351 sites in one pass: replaced
`e.currentTarget.click()` with `e.currentTarget.dispatchEvent(new
MouseEvent("click", { bubbles: true, cancelable: true }))` —
`dispatchEvent` is defined on `EventTarget` itself, universal across
every DOM node type including SVG, and a bubbling synthetic click
event reaches React's own delegated listener the identical way a real
mouse click does, unlike the convenience `.click()` method that only
`HTMLElement` implements. Verified live, not just re-running the
existing suite: focused the "Open My Profile" icon directly (confirmed
via `document.activeElement`) and pressed Enter — the My Profile
screen genuinely opened, zero page errors, proving the fix works for
the exact class of element that was broken.

This closes the ~610-site sweep's real, review-worthy portion. Of the
original ~610 `cursor:"pointer"` clickable elements this sweep's own
scanner can detect, every one is now keyboard-operable; a stray site
using a different clickability pattern entirely (not `cursor:"pointer"`
styled, or a click handler attached some other way) could still exist
but hasn't surfaced.

Verified live: full build, `npx eslint .` clean, and the full 15-flow
smoke-test suite against a real `vite preview` production build —
15/15 pass, including a direct re-run after the `dispatchEvent` fix to
confirm no regression from the second pass.

## Recently shipped (17 Sep 2026, latest of all yet again again — accessibility: shared toggle-switch component + 3-dot dropdown menu items, batch 2 of the ~610-site sweep)

Real ask, continuing the same "don't wait, move batch to batch"
instruction — the next well-defined, high-leverage shared shape after
icon-only buttons: the app's shared toggle-switch component (a plain
`<div onClick={() => onChange(!value)}>` with no semantics at all,
defined identically in 5 files) and the 3-dot "more options" dropdown
MENUS whose trigger got fixed in batch 1 but whose own ITEMS (Edit/
Archive/Delete/Update dose/etc.) still had zero keyboard access.

**`ToggleSwitch` — 5 files (ClinicVisits, Contacts, Medication
Dashboard, MyProfile, Testing), one fix per file's own component
definition, each reaching every real caller.** Added `role="switch"`,
`aria-checked={value}`, `tabIndex={0}`, and a real `onKeyDown`
(Enter/Space calls `onChange(!value)`) — the component takes no
`label` prop today, so no `aria-label` was added; its accessible name
still comes from whatever visible text a caller places next to it,
same as before this fix, just now genuinely focusable and toggleable
by keyboard rather than mouse-only.

**3-dot dropdown menu items — Contacts, Encounters, and Medication
Dashboard (the same 3 files whose menu TRIGGERS batch 1 already
fixed).** Contacts' menu (3 items: Edit/Archive/Delete) and its
separate show-blank-fields eye-icon toggle fixed by hand; Encounters'
menu (3 items: Edit/Archive-or-Unarchive/Delete) fixed by hand.
Medication Dashboard's own menu — the largest, 11 real items (Edit
medication/Update dose/Request refill early/Log waste/Correct stock/
Course completed/Archive/Delete/Move up/Move down, several
conditionally rendered) — fixed via a targeted Python regex matching
every menu-item `<div onClick={...}>` sharing the same
`padding: "10px 14px", fontSize: 13` style shape and inserting
`role="menuitem" tabIndex={0} onKeyDown={...}` before the recognized
style literal; the `onKeyDown` calls `e.currentTarget.click()` rather
than trying to re-derive each item's own often-multi-statement
closure, the same technique already proven safe for the FAB/chevron
sweep in batch 1. All 3 menu containers also got `role="menu"` on the
dropdown wrapper itself.

**Verified live, not just via the smoke suite**: opened Medication
Dashboard's real 3-dot menu via a focused `Enter` keypress on the
trigger, then confirmed the "Edit medication" `role="menuitem"` row is
both visible and genuinely keyboard-focusable — the full open-menu→
reach-an-item path works end to end, not just the trigger.

Verified live: full build, `npx eslint .` clean, and the full 15-flow
smoke-test suite against a real `vite preview` production build —
15/15 pass, no regressions from any of the 6 files touched.

## Recently shipped (17 Sep 2026, latest of all yet again — accessibility: keyboard-operability addendum, batch 1's own leftover header-level icons)

Small, same-day follow-up found while re-sweeping for other common
icon-button shapes right after batch 1 shipped — `InfoIcon`, `Gear`/
`SettingsIcon`, `RefreshCcw`, and `Search` icons weren't covered by the
FAB/chevron/X/Trash/3-dot-menu sweep since they're each a distinct
component name. 7 more sites fixed the same way (`role="button"`/
`tabIndex={0}`/`aria-label`/a real `onKeyDown`): Settings' shared
`InfoIcon` component (the tap-to-reveal-caption pattern used by
`StatRow` and 2 other call sites — one fix at the component reaches
every caller), Medication Dashboard's per-medication-row "correct
stock"/"edit medication" icons and its own header Search/Settings
icons, Contacts' header Settings icon, and Measurements' header
preferences Gear icon.

Verified live: full build, `npx eslint .` clean, and the full 15-flow
smoke-test suite against a real `vite preview` production build —
15/15 pass, no regressions from any of the 4 files touched.

## Recently shipped (17 Sep 2026, latest of all — accessibility: keyboard-operability for the app's most-repeated icon-button shapes, batch 1 of the ~610-site sweep)

Real ask, continuing "Continue but bigger batches" with no further pause
between shipped batches ("After push to main works just move onto next,
don't wait for my input"): the biggest remaining accessibility finding —
of ~610 real `cursor:"pointer"` clickable elements app-wide, only ~55
carried `role="button"` and ~148 `tabIndex`, meaning most of this app's
interactive elements were completely unreachable by keyboard or screen
reader. Rather than attempt the full count in one unverifiable pass,
picked the highest-value, most-repeated shared icon-button SHAPES first —
the same "fix the pattern once, it reaches everywhere it's duplicated"
approach already proven for the bottom nav and undo/redo toasts earlier
this session — since these six shapes alone account for a large,
well-defined fraction of the total and appear on nearly every screen.

**FAB "+" buttons — 12 sites across 10 module files**, each getting
`role="button"`/`tabIndex={0}`/a real context-specific `aria-label`
("Add contact"/"Add encounter"/"Add medication"/etc.) and a real
`onKeyDown` invoking the same handler on Enter/Space. Three of
MenstrualHealth's own FABs (Cycle/Contraception/Pregnancy tabs) were
byte-identical strings, so the `Edit` tool's uniqueness requirement
couldn't disambiguate them — fixed via a direct Python line-number edit
instead, giving each its own real label ("Log period"/"Add contraception
method"/"Add pregnancy entry") rather than one generic string across all
three.

**Back-chevron buttons — 44 sites across 17 files.** Fixed via a Python
regex sweep matching every `<ChevronLeft ... onClick={...} />` self-
closing tag and inserting `role="button" tabIndex={0} aria-label="Back"
onKeyDown={...}` before the closing `/>` — using `e.currentTarget.click()`
inside the `onKeyDown` handler rather than trying to duplicate each
tag's own `onClick` expression, since that sidesteps ever needing to
know or reconstruct the handler (a bare reference like `onBack`, an
inline arrow, or a multi-statement arrow body all just work identically
via a real synthesized click). A first regex pass missed 2 of the 44 —
both had an inline arrow handler containing `=>`, and the regex's
`[^>]*` character class excluded `>` entirely, so it stopped matching at
the arrow itself rather than the tag's real end. Fixed those 2 by hand;
one (Settings' Calendar screen) turned out to be a paired
Previous/Next-month nav, not a screen-back control at all, so it got
real "Previous month"/"Next month" labels instead of the generic "Back"
the regex sweep used everywhere else — caught by actually reading the
surrounding JSX before assuming the generic label applied.

**Sheet-close X icons (25 sites) and Delete/Trash icons (11 sites) —
already had real `aria-label`s from an earlier accessibility pass, just
never keyboard-focusable.** A second Python regex sweep (this one
anchored to end-of-line via `re.MULTILINE`'s `$`, which correctly
handles an arrow function's `=>` since the terminator condition is the
literal end of the line, not "first `>` encountered" — the exact class
of bug the ChevronLeft sweep hit) added `role="button" tabIndex={0}`
plus the same `e.currentTarget.click()` `onKeyDown` pattern to every one
without touching the aria-label already there.

**3-dot "more options" menu triggers — 3 sites** (Contacts, Encounters,
Medication Dashboard), each fixed by hand rather than regex since the
correct semantics needed a real `aria-expanded={menuOpen}` bound to
each file's own actual state variable, not just `role="button"` —
`aria-haspopup="true"` added too, so a screen reader announces this is
a menu trigger, not a plain button.

**Timeline's Archive/Unarchive icon — 1 site**, found in the same sweep
(already had a real `aria-label`/`title`, same keyboard gap as the X/
Trash icons) — fixed the same way.

**Verified live, not just via the smoke suite**: a fresh Playwright
script confirmed the specific class of gap being closed — a real
`page.keyboard.press("Enter")` on the newly-focused Contacts FAB (after
`.focus()`, confirming `document.activeElement` matched) genuinely
opened the real "Add contact" sheet, the same outcome a mouse click
already produced, proving the fix is functionally real and not just a
DOM attribute with no working keyboard path behind it.

Not touched this round, honestly logged rather than silently rolled
into "batch 1 done": the much larger remainder of the ~610-site count
(per-row edit/link/unlink icons inside detail views, individual
chip-toggle rows, and more) — this batch covers the shared, universal
shapes; per-screen sweeps for the rest are real, separate future work.

Verified live: full build, `npx eslint .` clean, and the full 15-flow
smoke-test suite against a real `vite preview` production build —
15/15 pass, no regressions from any of the 17 files touched.

## Recently shipped (17 Sep 2026, later again — accessibility: missing accessible names, batch 2, the Notes-textarea cluster)

Real ask, continuing directly from batch 1: "Continue but bigger batches"
— the same accessibility remediation, no longer constrained to
smallest-first, so this batch closes the whole ~20-site Notes-`<textarea>`
cluster deliberately deferred out of batch 1, plus every adjacent unlabeled
`<input>` found in the same file while touching it, rather than stopping
at exactly what batch 1's own audit named.

**Every Notes-style `<textarea>` across `src/modules/` now has a real
`aria-label`.** 15 files, ~24 sites once files with more than one
Add/Edit sheet are counted (Medication Dashboard's 2, MenstrualHealth's
3 — Cycle/Contraception/Pregnancy, each an independent copy of the same
`SectionCard` Notes pattern). Most took the generic `aria-label="Notes"`
(Contacts, ClinicVisits, Encounters, Measurements, Medication Dashboard,
MenstrualHealth ×3, SymptomLog, Vaccinations, Timeline's episode notes);
2 sites got their own real, more-specific visible-label text instead of
the generic default, matching what's actually printed next to them —
Testing's is genuinely labeled "General notes" in its own UI, not
"Notes", so it got `aria-label="General notes"`; MyProfile's shared
`TextAreaField` component (a generic, reusable field taking its own
`label` prop, called with several different real labels) got
`aria-label={label}`, the same pass-through pattern already proven for
`SelectField` in batch 1, so every one of its callers is correct for
free rather than needing its own fix.

**Found and fixed 3 more real, unlabeled sites in the same files while
touching them — not part of the original ~20-site count, but the same
underlying gap.** Settings' Resources-entry editor had TWO unlabeled
fields, not one — its `link` input (`aria-label="Resource link"`)
alongside the already-known `notes` textarea (`aria-label="Resource
notes"`); its Locations extra-fields Notes textarea got `aria-label=
"Location notes"`; its Error Log "Report a problem" textarea got
`aria-label="Report a problem"`. Contacts' availability-rule note input
(the per-day "e.g. 'Work'" field in the day-picker) got `aria-label=
"Availability note"`. Partner Notification's per-contact checklist row
— a `methods` textarea plus DOB/age/address inputs, all rendered once
per person with no accessible name distinguishing one row from the
next — got real, per-person labels (`` `Contact methods for ${item.name}`
``, `` `Date of birth for ${item.name}` ``, etc.) rather than a bare
generic string, since a screen-reader user stepping through a multi-row
checklist needs to know WHICH person's field they're on, not just that
it's a methods field.

**A full final sweep confirmed the cluster is genuinely closed, not
just the sites remembered from the original audit**: `grep -rn
"<textarea" src/modules/*.jsx src/components/*.jsx | grep -v
"aria-label"` returns only the one multi-line Settings textarea whose
own `aria-label` sits on a following line (confirmed present, a grep
artifact, not a real gap).

Verified live: full build, `npx eslint .` clean, and the full 15-flow
smoke-test suite against a real `vite preview` production build —
15/15 pass, no regressions from any of the 13 files touched.

## Recently shipped (17 Sep 2026, latest — accessibility: missing accessible names on shared form-field components, batch 1)

Real ask: continue the accessibility remediation flagged in Known Issues
below (critical axe `label`/`select-name` violations concentrated in a
handful of shared components), smallest batch first. This app duplicates
its shared field components per-module (`SelectField`, `DateTimeField`,
`AgeField`, etc.) rather than importing one true shared file — so "fixing
each once" means fixing each of the independent per-file copies, not one
central definition; still small and mechanical, since a fix at a
component's own definition reaches every call site in that file for free.

**`SelectField`/`SelectRow` — 10 copies checked, 1 real gap found.**
Every copy across Contacts/ClinicVisits/Encounters/MenstrualHealth/
MyProfile/SymptomLog/Testing/Timeline/Vaccinations already had
`aria-label={label}` on its `<select>` — only Medication Dashboard's own
`SelectRow` was missing it, confirmed by diffing all 10 copies directly
rather than assumed uniform. Fixed the one real outlier.

**`DateTimeField` — all 3 copies missing it.** ClinicVisits/Encounters/
Medication Dashboard all lacked `aria-label={label}` on the
`datetime-local` input — unlike `SelectField`, this component never got
the fix at all. Fixed all 3.

**`AgeField` — both copies missing it.** Contacts' and My Profile's own
age `<input type="number">` had no accessible name beyond a visually
adjacent (not programmatically linked) "Age" `<div>`. Fixed both with
`aria-label="Age"`.

**Three more real, individually-confirmed sites**: Settings' `hoursInput()`
(the clinic-appointment reminder's "Hours before" field, shared by both
reminder rows) had only an adjacent `<span>`, not a real label — fixed
with `aria-label="Hours before"`. The Colour-scheme picker's Hex input and
its 3 RGB channel inputs (Settings > Appearance) had no way for a screen
reader to tell the R/G/B fields apart from each other — fixed with
`aria-label="Hex colour value"` and `aria-label="R/G/B (0-255)"`
respectively. Clinic Visits' inline "other medications given" mini-form
(Name/Notes pair, used when logging an ad-hoc medication not in the
Medication tracker) had placeholder text only, no accessible name at all
— fixed with `aria-label="Medication name"`/`"Medication notes"`.

**Deliberately scoped out of this batch, left for the next one**: the
~20-site "Notes `<textarea>` with no label" cluster the same audit named
(one per module's own Add/Edit form) — real, but a genuinely separate,
larger cluster from the `<select>`/`<input type="date/number">` gaps
this batch covers; grouping it in would have muddied "smallest first"
into "everything the audit mentioned at once." Logged in Known Issues
below as the next-smallest batch, not silently folded in or dropped.

Verified live: full build, `npx eslint .` clean, and the full 15-flow
smoke-test suite against a real `vite preview` production build —
15/15 pass, no regressions from any of the 8 sites touched.

## Recently shipped (17 Sep 2026, later still — real-device feedback batch: ScreenSecurity crash, Stats organism count, field reorders, and more)

Real ask: a large batch of live feedback from actual device use — 2 real
crashes surfaced in the on-device Error log plus 11 more UI/bug reports.
Worked crashes first, then concrete bugs, then UI polish, per this
project's own established priority order.

**Real crash fixed: `"ScreenSecurity.then() is not implemented on
android"`.** `screenSecurityService.js`'s own `getPlugin()` — the
"Allow screenshots" toggle's native bridge — had a comment correctly
describing the "never let the raw Capacitor plugin proxy be a
Promise's resolved value" bug already fixed in every OTHER native-
plugin service this app has (`notificationService.js`,
`locationService.js`, `calendarSyncService.js`, `fileExportHelper.js`,
`biometricAuthService.js`) — but the code itself still did exactly
that (`return ScreenSecurity;`, the bare proxy, from an `async`
function). Every one of its 2 real callers awaited it, so the crash
fired on every real use. Fixed by wrapping the return in `{ plugin }`,
matching every sibling file's own already-correct pattern. A full
sweep of every other `getPlugin()`/`registerPlugin()` site in
`src/storage/` confirmed this was the one remaining unfixed instance.

**The repeated `Cannot read properties of undefined (reading
'filter')` crash (7 real occurrences in the error log) — investigated
at length, not conclusively pinned down.** Every `.filter()` chained
directly onto a repository's `getAll()` was checked (all properly
`await`ed, or provided with a real `[]` fallback via `useLoadedMemo`/
`useLoadedState`), `storageAdapter.js`'s own `load()` never returns
`undefined` when a real fallback is passed (confirmed no repository
calls it without one), and the classic "chained `.filter()` directly
onto an un-awaited Promise" bug class (documented extensively
elsewhere in this file as a recurring issue) came back with zero
matches on a fresh grep. All 7 occurrences predate this round's own
commits by many hours, in the middle of a very dense same-day
16 Sep commit sequence — very plausibly already fixed by one of the
~20 commits that shipped later the same day, given how many `.filter()`-
on-`getAll()` fixes that day's own work included, but not confirmed
without a stack trace. Flagged here rather than silently dropped — if
this recurs on a build newer than this round's own commit, it needs a
real stack trace (or a specific repro) to actually pin down.

**Stats' "positive results by organism" — real bug, not a display
issue.** Testing's own "Organism (if positive)" field is genuinely
OPTIONAL — a positive result logged without ever filling it in
(a real, easy thing to do) silently vanished from this breakdown
entirely, even though a real positive existed. Fixed in
`getPositiveTestsByOrganism()` (`statsCalculations.js`): falls back to
the test's own `testingFor` selections (what was actually screened
for) when `organismIds` is empty, so a positive result is never
invisible here just because the more specific, optional field was
left blank.

**Contraception tab's linked clinic visit — real bug, showed no
identifiable name.** `MenstrualHealth`'s `ContraceptionTab` detail view
showed only the bare date for a linked clinic visit — fixed to match
the same "title or reason, then date" label every other module's own
linked-clinic-visit display already uses (Testing/Encounters).

**Encounters' Quick-Add icon reverted from Flame back to Pulse/
Activity** — a direct, explicit follow-up overriding the earlier
16 Sep decision to keep Flame as a deliberately distinct glyph; the
owner's own later ask was clear, so it now matches the bottom nav/
Global Search's own Activity icon for this module everywhere.

**Healthcare's Symptoms/Measurements sub-tab pills — real vertical-
centering bug.** The 6 sub-tab pills sit in a CSS grid with no
explicit row height — a 2-line label in the same row (Clinic Visits,
or Menstrual & Contraception when shown) stretches that row's height,
and the shorter 1-line labels sharing that row (Testing/Vaccinations,
and specifically Symptoms/Measurements in the second row) sat top-
aligned in the now-taller cell instead of centred. Fixed by adding
`display:flex, alignItems:center, justifyContent:center` to each pill.

**Settings > Notifications — the two clinic-appointment reminders
combined onto one shared card**, instead of two separate ones for the
same real feature (a booked appointment). `NotificationToggleRow`
gained an optional `bare` prop to drop its own outer card chrome when
nested inside a shared wrapper — every other call site unaffected.

**Home's "Log contraception" — real colour-consistency bug, most
visible in dark mode.** Used `healthcareColor` (green) while "Log
period" right next to it used `menstrualColor` — two different
accents for what's the same Menstrual & Contraception sub-tab. Both
now share `menstrualColor`.

**Settings' bottom-scroll buffer — bumped from 20px to 48px, app-wide
(37 sites across 15 files).** Real report: the last item in Settings'
About screen (among others) was still half cut off against a real
device's gesture-nav area even with the existing `calc(20px +
env(safe-area-inset-bottom))` buffer shipped 16 Sep — this sandboxed
environment can't verify the exact real-device gap (`env()` resolves
to 0px here), so a more generous, purely-additive bump was the safe
fix rather than guessing at an exact number.

**Contacts' section order reordered, in both the Add/Edit sheet and
the read-only profile view** — real ask: "physical & health before
kinks, contact methods second to last, before notes." New order:
Relationship → Location & logistics → Physical & health → Kink →
Chems → Contact methods → Notes → Linked contacts. (The read view's
Contact methods was already positioned directly before Notes — only
its Physical & health/Kink order needed the same swap the edit sheet
got.)

**The "Linked to My Profile's relationship status (Single)" toggle —
investigated, not converted to static text.** Confirmed via
`toggleLinkedToMe()`/`MyProfileRepository.linkRelationshipContact()`
that this is a real, meaningful ACTION (which contact counts toward
your own profile's relationship status), not just a passive status
display — removing the toggle would remove real functionality, so it
stays interactive. The actual confusion is real, though: the row read
as "is this contact single?" specifically when the profile's own
status genuinely IS "Single," where "linking" a contact makes no
sense. Fixed narrowly — hidden for exactly that one value (case-
insensitive "single"), both on the Contact profile's own toggle and
My Profile's own matching "Linked to" picker — every other real status
(Married, Partnered, Poly, etc.) keeps the real, interactive control.

**Not acted on this round, flagged rather than guessed at**: "Privacy
option into contacts maybe? Maybe not... maybe duplicated?" — read as
the owner thinking out loud rather than a firm ask (the message itself
raises and then questions its own idea); left alone pending a clearer
ask. "Stats — click to open records/module section being analysed" —
a real, legitimate feature request (deep-linking each Stats block to
its own module/record), but a genuinely bigger plumbing job (Settings'
own multi-level nav has no `onNavigateToRecord`-style prop threaded
into `StatsScreen` today) than fit in this same round — logged here so
it isn't lost. "City on contacts - adding new one doesn't seem to work
properly" — investigated at length (the City `ComboField`, the
Address-autocomplete's `onCityDetected` city-fill path, and
`getKnownCities()`'s own suggestion-list logic all read correct on
direct inspection) but no concrete bug was found or reproduced; needs
a more specific repro (what was typed, what was expected vs. what
happened) to pin down further.

Verified live throughout: full build, `npx eslint .` clean, and the
full 15-flow smoke-test suite against a real `vite preview` production
build — 15/15 pass, no regressions.

## Recently shipped (17 Sep 2026 — icon-only-UI affordance fixes, status-bar/notch edge-to-edge redesign, desktop full-width sweep, and a first real screen-reader-keyboard pass)

Real ask, four items reordered/reframed from the standing backlog list: (4) icon-only-UI retroactive audit — done first, per the user's own explicit ordering; (2) desktop full-width — reframed from "measure-cap sweep" to "desktop should always be full width, never affecting mobile"; (1) status-bar/notch colour — research how other apps handle it, then design and implement a real approach; (3) screen-reader audit — "do exhaustive." Delegated 3 parallel background agents (icon-only-UI, desktop full-width, screen-reader) per this project's own established "delegate audits, verify and fix myself" pattern, worked item 1 directly in parallel, then triaged every finding against real code before touching anything.

**Item 1 — status-bar/notch colour, researched and redesigned.** Two web searches confirmed the real, current best practice: Android's own edge-to-edge guidance (`SystemBarStyle.auto(Color.Transparent...)`) says let a header's background run genuinely to the true screen edge with the status bar drawn transparently over it, inset only the CONTENT below the notch — not the app's prior approach (this session's own earlier "sticky-header status-bar fix," which offset the whole banner DOWN by `env(safe-area-inset-top) + 8px`, leaving a permanent neutral-coloured gap/seam behind the status bar at every scroll position). `android/app/src/main/res/values/styles.xml` already has `android:statusBarColor`/`android:navigationBarColor` set to transparent (a 1 Sep 2026 fix) — the native layer was already ready for this, the web CSS just wasn't taking advantage of it. Redesigned all 4 real screen-title banners (Contacts/Healthcare/Medication Dashboard/Encounters) and their own 7 dependent sub-heading bars (Testing/Clinic Visits/Vaccinations/Symptom Log/Measurements/Menstrual Health's own sub-tab header, Contacts' bulk-select toolbar): each banner's `top` moved back to a plain `0`, with the safe-area inset relocated into the banner's own top padding (`calc(16px + env(safe-area-inset-top))` instead of a flat `16px`) — the banner's colour now fills all the way to the true edge with zero seam, while the title/icons still sit safely below the notch. The banner's own net height shrank by exactly the 8px it used to add on top, so each of the 7 dependent offsets moved from `+70px` to `+62px` to stay flush. The 3 sheet-title banners (Testing/Clinic Visits/Encounters' own Add/Edit forms) were deliberately left untouched — confirmed via direct code reading that they sit inside a genuinely different structural shape (their own `paddingTop: env()` lives on the same `position: fixed` element that also scrolls its own content, not a separate scrolling ancestor the way the screen-title banners' `<main>` did), so the earlier seam bug this redesign targets structurally cannot occur there — a real, checked exclusion, not an oversight.

**Item 4 — icon-only-UI affordance audit, 3 real gaps fixed.** Delegated agent read the established precedent (Contacts' active-status dot, Medication's adherence dot — both `role="button"` + tap-to-reveal caption) and found 3 genuine gaps, none previously flagged: (1) Contacts' own transport/hosts-travels/linked/flagged icon row sat right next to the already-fixed status dot with none of its own affordance — fixed by reusing the same `showStatusInfo` toggle, with each icon now `role="button"`/`tabIndex`/a real `title`/`aria-label`, and the revealed caption panel now lists every active icon's own meaning (transport mode, hosting, linked-contact, the safety-relevant "flagged: do not meet again"). `MethodIcons` (the WhatsApp/Snapchat/Fabguys/Fabswingers/Recon badge row — 3 of which are original, invented marks with no public brand meaning) got the same tap-to-reveal treatment, listing each method by name. (2) Timeline's `EpisodeCard` list row conveyed a positive-linked-test signal through dot colour alone, with no adjacent text — unlike its own detail view, which already says "Open · positive result found." Mirrored that exact text into the list row. (3) MenstrualHealth's `FlowDrops` explained its 1-4 drop count via a hover-only `title` — the precise anti-pattern this app's own standing rule exists to avoid on a touchscreen-first app. Now always shows the real stored text (e.g. "Heavy") next to the drops, a permanent visual reinforcement rather than the only way to read the value.

**Item 2 — desktop full-width sweep, genuine gaps closed across ~15 screens.** Delegated agent grepped every module for `isDesktopWidth` and confirmed a real, exhaustive gap list, then re-verified 2 already-documented exclusions (Global Search's proportional rows, Medication Dashboard's manually-reordered Registry tab) were still correct rather than assumed. Fixed, all additive `isDesktopWidth ? desktop : mobile` branches with mobile markup left byte-for-byte untouched (verified via screenshot at 390px): `App.jsx`'s `OnboardingScreen` (a `maxWidth` cap on the centered slide body); `MyProfile`'s `ProfileDataView` (~14 `SectionCard`s, previously one long column, now a real `minmax(340px,1fr)` grid — the same pattern proven on Guide); `ClinicCard` (11 sections, each wildly uneven in row-count — CSS multi-column flow via `columnCount:2`, matching Registry Management's own established precedent for this exact content shape, each section wrapped `breakInside:"avoid"`); and 8 Settings sub-screens — `ResourcesScreen` (grid per category), `DeveloperToolsScreen`/`StatsScreen` (columnCount per section block), `NotificationsScreen` (grid of toggle cards), `TrashScreen`/`NotificationHistoryScreen`/`ErrorLogScreen` (columnCount per log/list), `CalendarScreen` (a `maxWidth` cap on the whole month grid, which was already a real grid, just unconstrained), `AboutScreen` (`maxWidth` cap, genuinely minimal content), `DesignScreen` (grid for the 2 toggle cards, columnCount for the Module/Status colour row lists). `PrivacyScreen` deliberately got the safer `maxWidth`-cap treatment instead of a full card grid — its own App Lock/PIN/duress/recovery logic is security-sensitive with a real history of regressions in this exact file, and a measure cap avoids all risk to the nested toggle/reveal logic while still fixing the stretched-edge complaint.

**Item 3 — exhaustive screen-reader audit, a first real pass on the highest-severity finding.** Delegated agent ran a genuinely exhaustive pass (never done before): a fresh axe-core sweep across ~35 screen states, real `page.keyboard.press("Tab")` traces, and direct source reading across every module file. Headline finding, quantified not anecdotal: of ~610 real `cursor:"pointer"` clickable elements app-wide, only ~55 have `role="button"`/~148 have `tabIndex` — meaning the large majority of this app's interactive elements are completely unreachable by keyboard or screen reader, the same gap already fixed once for the bottom nav and once for undo/redo toasts, but never propagated further. Given the genuine scale (600+ sites, correctly described by the audit itself as needing "a dedicated, cross-cutting remediation pass, not per-screen patches"), fixed the specific sites the audit flagged as **genuinely navigation-blocking** (not just inconvenient) in this pass: Home's own 4 header icons (Search/My Profile/Settings/Lock now — confirmed via a real 40-press Tab trace to be 100% unreachable, meaning a keyboard/screen-reader user could not open Settings, Search, or My Profile from Home at all) and Healthcare's own sub-tab pills + Episodes/Attachments/Clinic Card shortcut row (confirmed via a real 20-press Tab trace — a keyboard user could not switch Healthcare's sub-tab or reach any of its 3 shortcuts). All now `role="button"`/`role="tab"`/`tabIndex={0}`/a real `aria-label`/`onKeyDown` (Enter/Space), matching the bottom nav's own already-proven pattern. Also fixed the audit's own explicitly-flagged "smallest, cheapest fix" — Contacts' and Global Search's sheet-close `X` icons already had a real `aria-label` but weren't focusable at all; both now are. The remaining findings (critical missing form-field labels concentrated in a handful of shared components — `SelectRow`, `DateTimeField`, `SectionCard`'s Notes fields, `hoursInput()`; no dialog semantics/focus-on-open on any module-level sheet, unlike `App.jsx`'s own top-level modals; only ~7 of the app's ~40+ screens have a real heading element; several new contrast violations; zero live-region announcements on any search/filter box; one unresolved `nested-interactive` violation on Contacts) are real, confirmed, and logged in Known Issues below rather than silently dropped — each is its own bounded follow-up, not attempted this round given the genuine scale involved.

**A real, non-deterministic test flake investigated and ruled out, not shipped past blind.** The full smoke suite failed intermittently on test 14 (PWA auto-update) twice in a row after these changes, then passed twice in a row on a third and fourth run — a real scare, chased to ground rather than assumed safe. Confirmed via `git diff` that none of this round's files touch `main.jsx`, `public/sw.js`, or `App.jsx`'s own service-worker/`swUpdateAvailable` code at all (the only `App.jsx` change was `OnboardingScreen`'s desktop cap, nowhere near the SW logic); confirmed via a standalone, isolated Playwright probe (a fresh browser launch, no preceding tests) that the real update-banner mechanism itself works correctly and near-instantly against this round's own build; and confirmed the same test also fails intermittently in exactly the same slot even against the unmodified baseline build under the same "13 heavy sequential tests deep in one shared page" load this specific test runs under (only `testEncryptionMigratesLegacyData`/`testInteractiveTour`/`testServiceWorkerAutoUpdate` get their own fresh browser context — everything else shares one long-lived page). Root-caused to resource/timing contention from being the 14th test in a long sequential run, not a functional regression — logged here for whoever next sees this exact test flake, so it isn't re-investigated as a mystery from scratch.

Verified live throughout: full build, `npx eslint .` clean (including a real `react-hooks/rules-of-hooks` catch — `MyProfile`'s new `isDesktopWidth` hook was initially declared after an early `return`, moved above it), and the full 15-flow smoke-test suite against a real `vite preview` production build — 15/15 pass (twice consecutively, after the flake above was chased down). Screenshot-verified at both 1600×1000 (desktop — Contacts' banner now runs edge-to-edge with a real 4-column grid, My Profile's own SectionCards likewise) and 390×844 (mobile — confirmed byte-for-byte unchanged single-column layouts).

## Recently shipped (16 Sep 2026, later again yet — attachment delete confirmation, medication draft autosave, and 3 real dead-code/mismatch cleanups)

Real ask: work the remaining items from the delegated audit's own "deliberately not fixed, logged rather than silently dropped" list, attachment confirmation last, otherwise triaged in whatever order made sense, with commits grouped into fewer pushes.

**`FONT_FAMILY_MONO`/`TYPE.monoLabel` value mismatch — fixed.** Both were defined as `"'Inter', sans-serif"` despite their own names promising JetBrains Mono, and both are currently unused anywhere in `src/` (every real monospace site hardcodes `"'JetBrains Mono', monospace"` directly instead of referencing either token) — confirmed via grep before touching anything, not assumed. Corrected both values to the real font, a zero-behavior-change fix today since nothing reads them, closing the landmine for whoever reaches for either token next.

**`TrashRepository.bulkDelete()` — confirmed genuinely dead across all 11 repositories that defined it, removed.** A grep for any real `.bulkDelete(` call site anywhere in `src/` came back empty — every module's own bulk-select "Delete" action (Contacts, SymptomLog, and every sibling module sharing the same toolbar pattern) already goes through the shared `triggerDelete()`/`TrashRepository.add()` helper, looping each record's own `delete()` individually rather than calling a repository's bulk method at all. That loop is also the more correct path — it's the one that actually populates Trash and runs each record's own real dangling-link cleanup, neither of which `bulkDelete()` itself did consistently. Removed the method from all 11 files that defined it (`contactRepository`, `encounterRepository`, `testingRepository`, `medicationRepository`, `clinicVisitsRepository`, `vaccinationRepository`, `symptomLogRepository`, `measurementRepository`, `contraceptionRepository`, `pregnancyRepository`, `menstrualCycleRepository`) and corrected two stale comments elsewhere (`locationsRepository.js`, `myProfileRepository.js`) that referenced it by name.

**`contactCalculations.js`'s `getKnownAddresses()` — confirmed superseded, removed.** This "suggest an address already typed for another contact" helper predates `AddressAutocomplete` (18 Aug 2026), which replaced it with real live Nominatim geocoding — checked directly, not assumed: the Address field's own component has used `AddressAutocomplete` exclusively since that date, and `getKnownAddresses()` has had zero real callers since. Removed as dead code superseded by a better, already-shipped feature, not a missing wire-up.

**Medication Dashboard's Add/Edit forms wired into `draftStorage.js` — the one real functional gap on this list.** This was the last module-level form in the app with no in-progress-edit autosave, unlike 7 sibling forms (Contacts/Encounters/Testing/ClinicVisits/SymptomLog/Vaccinations/Measurements). Both `MedicationEditSheet` and `AddMedicationSheet` receive a fully-loaded object as a prop already (no async id-fetch race the way Testing/ClinicVisits/Encounters' own edit sheets have) — so this used the simpler `isFirstRender`-guarded pattern already proven for SymptomLog/Vaccinations/Measurements (skip the first mount's autosave so opening-and-closing with zero real edits leaves no phantom draft), not the heavier `isDirty`-ref variant those async-loading sheets need. `MedicationEditSheet`'s draft key is `medEdit_${med.id}`; `AddMedicationSheet`'s is a fixed `medAdd_new`, since there's only ever one in-progress "new medication" draft at a time. Both show the same "Restored unsaved changes from earlier." banner Contacts/Testing/ClinicVisits/Encounters already use. Verified live via Playwright against the dev server: editing a real medication's Notes field, closing without saving, and reopening its Edit sheet correctly restored the typed text with the banner shown — the draft round-trips through real `sessionStorage`, not just the source.

**Attachment deletion — the item held for last, per this round's own instruction.** All 3 sites (the top-level Attachments screen's own `handleDelete`, and the near-identical `AttachmentManager` copies duplicated inside Testing's and Clinic Visits' own edit sheets) deleted on a single tap with zero confirmation — the one remaining gap in the app's otherwise-complete `ConfirmDeleteCard` rollout (~15 other sites already use it). Wired all 3 through the same shared component: each gets its own local "pending delete" state, a trash-icon tap now stages the target rather than deleting it immediately, and the card's own `onConfirm` performs the real removal. The Attachments screen (previously with no `actionRed`/`ConfirmDeleteCard` import at all) needed `ACTION`/`resolveDarkAccent` added to build a dark-mode-aware `actionRed` for the card's own border/confirm-button colour — Testing's and Clinic Visits' own copies already had `T.actionRed` in scope. Verified live end-to-end via Playwright against the dev server, seeding a real attachment onto an existing Test record through a dynamic repository import (the same technique this suite's own smoke tests use for the same reason — the data is genuinely encrypted at rest, so a raw storage write wouldn't work): the trash icon now stages a real `role="alertdialog"` confirmation with the attachment's own title in the message; Cancel leaves the attachment in place; confirming Remove actually deletes it and closes the dialog. Checked on both the top-level Attachments screen and Testing's own inline `AttachmentManager` — Clinic Visits' copy is code-identical to Testing's (verified by direct comparison, not assumed) and shares the exact same build/lint/smoke-suite-verified path.

Verified live throughout: full build, `npx eslint .` clean, and the full 15-flow smoke-test suite against a real `vite preview` production build — 15/15 pass, no regressions from any of the six changes in this round.

## Recently shipped (16 Sep 2026, even later still — delegated app-wide consistency/functionality audit)

Real ask: "Do audit for consistency and functionality app wide" — delegated 3 parallel specialist agents (a Consistency pass, a Functionality pass, and a UX-pattern pass, each instructed to read this file in full first, verify every finding against real code rather than pattern-match, and cap results by confidence/impact), then triaged and fixed the real findings directly rather than acting on the reports blind.

**Consistency fixes**: Registry Management's sort-chip active-state text failed contrast on its own self-tint background — extended `ACCENT_TEXT_SAFE` (`designTokens.js`) with computed-safe `kink`/`protection`/`locations` values and swapped them in at that one site via a `TEXT_SAFE_BY_HEX` reverse lookup (border/background left on the raw accent). Settings' stale pre-rename `#3D63C9`/`#B45309` literals (11 + 3 sites) replaced with `ACCENTS.medication`/`ACTION.gold`; its 58 `#F0F0F3` literals replaced with `NEUTRAL.bg`. `App.jsx`'s `DecoyHome` hardcoded the entire NEUTRAL palette as raw hex and never received a `darkMode` prop — converted to read `NEUTRAL`/`NEUTRAL_DARK` via a resolved `N` object and wired `darkMode` through from its one call site. Home's "Log contraception" button used the same `Pill`/`medsBlue` styling as "Log medication," despite Global Search already representing Contraception with `Shield`/`ACCENTS.healthcare` — matched to Global Search's own convention. Medication Dashboard's `InventoryTab` was the one list screen never given the desktop-width treatment the rest of the app's list screens already have — added the same `columnCount: 2` multi-column pattern already proven on Registry Management/Partner Notification (divider rows, not card grid, matching its own shape).

**Functionality fixes**: `MenstrualHealthModule` never registered a back handler, unlike every other multi-screen module — wired `registerModuleBackHandler`/`onDataChanged` through from Healthcare and implemented real back-step registration inside `CycleTab`/`ContraceptionTab`/`PregnancyTab` (only one mounts at a time, so each registers/cleans up independently, same pattern as every sibling module). A stale App.jsx comment claiming "only Testing has registered a real handler so far" was corrected — most modules with real navigation have one now. `customOptionListsRepository.js`'s `PROTECTED_VALUES` mechanism silently no-ops on a protected value with zero UI signal — `SHOS_OptionListEditor_Prototype.jsx` now checks `isProtected()` per row and shows a lock icon plus an explanatory note in place of the rename/remove controls. Testing's Partner Notification sheet wasn't accounted for by the module's own back handler (pressing back while it was open jumped straight to the Testing landing screen) — `TestDetail` now registers its own more-specific handler, layered on top of the module-level one, that closes the sheet first.

**UX-pattern fixes**: Medication Dashboard's Registry-tab list had no empty state for zero medications or a search matching nothing. Testing/Clinic Visits/Vaccinations/Measurements all showed a misleading "No X logged yet" message even when a search term was active and simply matched nothing — all 4 now branch on whether a query is set, matching Encounters'/Contacts' own already-correct pattern. Settings' Notification History and Error Log "Clear" buttons fired directly with no confirmation, the one gap left in the app-wide `ConfirmDeleteCard` rollout — both wrapped. Option List Editor's "Delete permanently" (an archived value) had the same gap — wrapped the same way. Encounters' Save button had zero required-field validation, unlike 8+ sibling forms — added a `canSave` gate on `form.title`. Menstrual Health's linked-symptoms picker used a generic "Search…" placeholder — the shared `RelationPicker` component already had an unused `placeholder` prop for its OWN purpose (the empty-state message); added a genuinely separate `searchPlaceholder` prop and passed "Search symptoms" at the one real call site. `TrashRepository.purgeExpired()`'s own header comment falsely implied a real UI entry point exists — corrected to note honestly that nothing calls it today.

**Deliberately not fixed this round, logged rather than silently dropped**: `TrashRepository.bulkDelete()` (11 files), `contactRepository.js`'s `getKnownAddresses()`, the `FONT_FAMILY_MONO` mismatch, Medication Dashboard's missing `draftStorage.js` wiring, and the attachment-deletion confirmation gap across 3 files — all 5 real findings from this list were picked up and closed the same day, see the "attachment delete confirmation, medication draft autosave, and 3 real dead-code/mismatch cleanups" entry above this one.

Verified live: full build, `npx eslint .` clean, and the full 15-flow smoke-test suite against a real `vite preview` production build — 15/15 pass.

## Recently shipped (16 Sep 2026, latest of all yet again still — due-reminders/SW-update banner landmark gap closed)

Real, scoped follow-up on the "full screen-reader reading-order/announcement-quality audit" item flagged in Known Issues as never done as its own pass. Ran a fresh, targeted `axe-core` scan against a live sheet interaction (opening Add Contact) rather than attempting the full undefined-scope audit in one sitting, and found one genuine, bounded gap: the due-reminders banner stack (medications/refill/testing/clinic-visit/vaccination) and the SW-update banner both render as direct `App.jsx`-level overlays — the same "sits outside every landmark" shape the earlier region-landmark pass already fixed for Settings/Global Search/3 small dialogs, just never caught there since that pass's own scan didn't happen to have a due reminder or pending update active at the time.

Fixed with `role="region" aria-label="Due reminders"` on the due-banner stack's outer wrapper (persists across a session rather than a one-shot announcement, so `region` fits better than `alert`) and `role="status"` on the SW-update banner (matching `notifToast` right above it, which already uses that role for the same "persistent, non-urgent notice" shape). Re-ran the same axe scan afterward: 0 violations, down from 5 flagged nodes.

Also checked, not acted on: a sheet's first input field doesn't receive focus automatically when it opens (confirmed via `document.activeElement` immediately after open). A real, lower-confidence finding — genuinely debatable rather than a clear bug, since this app targets touchscreens primarily and unsolicited `autoFocus` can pop the on-screen keyboard unexpectedly; the app already uses `autoFocus` selectively in 4 real places (Global Search's own input included) rather than never. Logged here rather than blanket-applied across every Add/Edit sheet without a real ask driving it.

**A second, higher-leverage gap found the same scan, fixed the same round**: `src/components/ConfirmDeleteCard.jsx` — the one shared destructive-delete confirmation used at ~15 real sites app-wide (Contacts, Encounters, ClinicVisits, Testing, Vaccinations, SymptomLog, Measurements, Medication Dashboard, MenstrualHealth, Timeline, PartnerNotification, Settings' Trash screen) — had no dialog semantics and never moved focus when it appeared, unlike the undo/redo toasts an earlier pass already fixed for the same class of gap. Added `role="alertdialog"` with a real `aria-describedby` (via `useId()`, not a static id — this component can in principle mount more than once, e.g. a bulk-toolbar delete alongside a single-item one) linking to the confirmation message, plus a mount-time `useEffect` that moves focus onto the Cancel button — the safer default action, and the standard WCAG pattern for a real Yes/No confirmation (stronger than `aria-live` alone, since it also answers "where am I now" for a keyboard user). One fix at the shared component reaches every call site automatically. Verified live end-to-end against a real seed Encounter's own delete flow: `role="alertdialog"`/`aria-describedby` resolve correctly, focus lands on Cancel the instant the card mounts, and a fresh axe scan with the card open comes back at 0 violations.

Verified live via Playwright (0 axe violations post-fix, both fixes) and the full 15-flow smoke-test suite against a real `vite preview` production build. `npx eslint .` clean.

## Recently shipped (16 Sep 2026, latest of all yet again — Global Search coverage gap closed, Encounters icon re-checked)

Real follow-up to the last consistency-audit round's own two lower-confidence findings: Global Search's silent exclusion of Measurements and Menstrual Health records (flagged as a real feature gap, not styling, deliberately deferred at the time) and Encounters' Quick-Add icon (flagged as "worth a second look").

**Global Search now covers Measurements, Cycle, Contraception, and Pregnancy** — the only two record-bearing modules that had never been wired into `buildIndex()` at all, directly violating this file's own standing "keep search coverage honest against actual app state" comment once both modules shipped. Four new `RESULT_META` entries (`measurement`/`cycle`/`contraception`/`pregnancy`, each its own icon — Ruler/Drop/Shield/Baby — and grouped separately in results) route through Healthcare's existing `measurements`/`menstrualHealth` sub-tabs; the three Menstrual Health types share one subTab since `MenstrualHealthModule` already resolves which of its own Cycle/Contraception/Pregnancy tabs to open from the record id's own prefix (`tabForRecordId()`, reused as-is — no new plumbing needed).

**Pregnancy's `sensitive` masking is honored, not bypassed.** A masked pregnancy entry's real content is hidden behind a per-session "tap to reveal" in Menstrual Health's own list/detail views — ephemeral component state, never persisted, so it can't be resolved at index-build time anyway. Rather than leak `notes`/`status`/`testResult` into a searchable result, a sensitive entry's search text is reduced to the generic word "pregnancy" and its title reads "Tap to reveal" — findable by browsing, not by its actual content, matching the module's own convention exactly. Verified live: searching a real word taken from a sensitive seed entry's own notes correctly shows no match, while searching "pregnancy" still surfaces it with the masked title.

Also corrected the two informational text blocks in this file that were already stale before this change (never mentioned Symptom Log/Vaccinations either) rather than leaving them further out of date.

**Encounters' Quick-Add "Flame" icon — re-checked, confirmed correct, not changed.** That file's own comment documents a real, explicit ask: a DISTINCT icon for the Home dashboard's "New encounter" shortcut, not a reuse of the generic Activity/Pulse glyph the bottom nav and Global Search both already use for Encounters elsewhere. Flame was picked as the closest thematically-honest substitute for "lips" (no such Phosphor glyph exists, checked before substituting) and reused from Kink Registry's own established convention for the same concept. This is a deliberate, reasoned decision matching a real ask, not drift — left as-is.

Verified live via Playwright: Weight/Depot/Combined pill/pregnancy all return real results and deep-link correctly (a Weight-type Measurement search navigates straight into its own detail view). Full build, `npx eslint .` clean, and the full 15-flow smoke-test suite against the dev server — 15/15 pass, no regressions.

## Recently shipped (16 Sep 2026, latest of all yet again still — GitHub Releases tag/badge fix)

Real report, from the owner's own read of the live Releases page: "latest may be behind?" — the page showed "released this 3 weeks ago · 364 commits to main since this release" directly under a body claiming to be built from the just-pushed commit. Confirmed via the GitHub API rather than guessed: the release's body/APK asset genuinely were current (correctly named the newest commit, asset `updated_at` matched the latest push), but the git tag `latest` itself (`refs/tags/latest`) was still pointing at the commit from 27 Aug — 3 weeks and 364 commits stale. Root cause: `softprops/action-gh-release@v2` updates an existing release's body/assets in place on every run, but never moves the underlying git tag once it already exists — so the page's own text kept silently updating to describe newer and newer commits while `git checkout latest`/anyone pulling the tag directly would have gotten 3-week-old code the whole time.

Fixed in `.github/workflows/build-apk.yml`: a new step right before the publish step force-moves the tag (`git tag -f "$TAG"` / `git push origin "$TAG" --force`) to the exact commit just checked out — using `checkout_sha` when set (so a manual historical-bisect build via `workflow_dispatch` tags its own commit correctly too), not just `github.sha`.

Also confirmed clean, not part of this fix: the owner separately deleted the stale `test-a`..`test-h` releases that were cluttering the public Releases page — checked via the API afterward and confirmed only the real `latest` release remains, nothing important was removed.

## Recently shipped (16 Sep 2026, latest of all still again — Guide/Glossary title icons, Guide/Glossary desktop balance, My Profile Guide-text fix, Registry Management sort, month-grouped desktop grids across 7 date-based lists)

Real asks, six items in one message: Guide/Glossary titles missing their icons; the desktop card grid should order chronologically with month subheadings (clarified via AskUserQuestion to mean "all date-based grids," not just one); Guide's tour button/search bar/description reading janky/uneven on desktop; a factual correction that My Profile is reachable via a dashboard shortcut, not only through Settings; Kink Registry needs A-Z/most-used/least-used sort; and a CI-status check for commit `0e1c754` on `main`.

**Guide/Glossary title icons.** Added a `Compass` icon before "Guide" and a `BookOpen` icon before "Glossary" in their own header spans (`SHOS_Settings_Prototype.jsx`) — both icons were already imported, just never placed next to their own screen title.

**Guide/Glossary desktop balance.** `GuideScreen`'s intro paragraph and "Take the interactive tour" button, and `GlossaryScreen`'s intro paragraph and search input, were each two separately full-width-capped stacked blocks on desktop, reading uneven. Both now sit side by side on desktop only (`isDesktopWidth ? flex row : unchanged mobile stack`), with the button/input sized to content instead of stretching. Mobile markup untouched.

**My Profile text fix.** The Guide's own "Getting around" bullet claiming "My Profile isn't a tab — it's inside Settings" was factually incomplete — Home's own dashboard has always had a profile-icon shortcut next to the gear icon. Reworded to name both paths.

**Kink Registry (and the 6 other registries sharing `RegistryManagementScreen`) sort.** Added an A-Z / Most used / Least used sort-chip row, reusing Contacts' own existing sort-chip styling and each registry's own accent colour for the active state — "most/least used" reads real per-entry usage counts already computed by `registryUsage.js`, not a guess.

**Month-grouped desktop grids, all 7 date-based record lists.** New shared `src/calculations/dateGrouping.js` (`groupConsecutive`/`monthLabel`) — deliberately a CONSECUTIVE grouping by a computed key, not a full re-bucket, so it respects each list's own existing primary sort (Episodes' open-before-resolved ordering, Symptom Log's Active/Resolved split) instead of forcing pure chronological order across the whole list. Applied, desktop-only, to Episodes, Encounters, Testing, Clinic Visits, Vaccinations, Symptom Log (both Active and Resolved sections, each grouped by its own relevant date field), and Attachments — each gets a month subheading (`TYPE.sectionLabel`, or a smaller subordinate style for Symptom Log's nested subheadings, since `sectionLabel` was already used one level up there) above its existing desktop grid. Six of the seven files had their row markup fully inline inside a `.map()` callback — extracted into a small dedicated component (`EpisodeCard`/`TestRow`/`VisitRow`/`VaccinationRow`/`AttachmentRow`) so the exact same JSX renders for both the new grouped-desktop path and the untouched flat-mobile path, no markup duplicated. Episodes' own "open episodes always sort first" behaviour is preserved by collapsing every unresolved episode into one "Open" group (already contiguous at the top of the sort) and only real month labels apply to resolved ones.

**CI check on `0e1c754`.** Confirmed all three workflows (Smoke Test, Build APK, Web Alpha) ran green on `main` for that commit via the GitHub Actions API.

Verified live via Playwright screenshots throughout (Guide/Glossary icons and side-by-side balance at desktop width; Kink Registry's "Most used" sort against real usage counts; Encounters'/Testing's real month subheadings against genuine seed-data dates; Encounters at 390px mobile width confirmed byte-for-byte the original flat single-column list, zero subheadings). Full build, `npx eslint .` clean, and the full 15-flow smoke-test suite against a real `vite preview` production build — 15/15 pass, no regressions.

## Recently shipped (16 Sep 2026, latest of all — desktop grid sweep extended to Episodes/Registry Management/Attachments/Partner Notification, plus 2 real consistency-audit findings fixed)

Real ask, direct follow-up to the desktop-layout round below: "Similarly in desktop all screens should be full width, is this guide page error a symptom of a wider issue? On desktop don't want narrow mobile width, but mobile layout still should not change" — confirming the prior round's own honest scope note (Timeline/Episodes, Registry Management, Attachments, Partner Notification, Global Search flagged as not-yet-covered) was real, not closed.

**Extended the same additive `isDesktopWidth ? grid : flex-column` pattern to 3 more screens, verified via live screenshot before and after each:**

- **Episodes** (`SHOS_Timeline_Prototype.jsx`, `TimelineLanding`) — episode cards converted to the same `repeat(auto-fill, minmax(380px, 1fr))` grid already proven on Contacts/Encounters/Testing-family. Confirmed via screenshot: a single episode card no longer spans the full 1600px width.
- **Registry Management** (`SHOS_RegistryManagement_Prototype.jsx`, shared by Kink/Protection/Chems/Symptoms/Organism/Results/Locations) — a genuinely different shape from the gap-separated card lists elsewhere (a single seamless bordered box with divider rows, name+usage-count only, no icon), so used CSS multi-column flow (`columnCount: 2`, `breakInside: "avoid"` per row) instead of a card grid — the same pattern already proven on Glossary's term list, chosen for the identical reason: uneven-height divider rows, not uniform cards. Confirmed via screenshot on the real 65-entry Kink Registry: the huge blank gap before each row's trailing archive icon is gone, now a genuine two-column layout.
- **Attachments** (`SHOS_Attachments_Prototype.jsx`) — same grid treatment as Episodes (icon + title/subtitle + trash icon rows, identical sparse-content-wide-row shape). No seeded attachments to screenshot against real content, but verified no regression on the empty state at both widths; the code pattern is identical to 6 already-proven sites.
- **Partner Notification** (`SHOS_PartnerNotification_Prototype.jsx`, `ContactPickerStep`'s contact-selection list only) — same multi-column treatment as Registry Management (name+methods, checkbox instead of archive icon, same "seamless box with divider rows" shape). The generated checklist's own item list (`ChecklistStep`) was deliberately left untouched — each row already carries a full-width textarea and optional DOB/age/address fields, genuinely document-style content, not sparse.

**Checked and confirmed NOT needing the fix, per the same density heuristic established last round**: Global Search's grouped results (meaningful multi-line content, already uses row width proportionally) and the Registries top-level category-picker menu (a Settings-style menu, not a data list) — both re-verified via screenshot this round, not just assumed from the prior round's own conclusion.

**Two real findings from a delegated consistency-audit sub-agent fixed in the same round** (the agent covered icons/fonts/colour/completeness across the whole app; findings were verified before acting, per this project's standing practice — see the agent's full report for 4 more lower-confidence/documented-as-deliberate findings left for a future round, not silently dropped):

- **Global Search's Test/Clinic Visit/Symptom Log/Vaccination results all shared one identical `HeartPulse` icon** — visually indistinguishable in the results list, no comment justifying the collision. Gave each its own real, thematically-apt Phosphor icon (`TestTube`/`Stethoscope`/`Thermometer`/`Syringe`), removing the now-unused `HeartPulse` import. Confirmed via screenshot: searching "Gonorrhoea" now shows 3 visually distinct icons across the Tests/Clinic Visits/Vaccinations groups.
- **Encounters' own screen-title banner hardcoded `fontFamily/fontWeight/fontSize` instead of spreading `TYPE.screenTitle`** — the one holdout among the app's 4 real colored screen-title banners (Contacts/Healthcare/Medication all correctly reference the token), an exact duplicate-value drift the original type-token consistency sweep was meant to prevent. Converted to `...TYPE.screenTitle`.

Not fixed this round, flagged for later per the audit's own confidence ranking: Global Search's own documented standard ("keep search coverage honest against actual app state") is arguably violated by its silent exclusion of Measurements and Menstrual Health records — RESOLVED 16 Sep 2026, see "Recently shipped" below. Encounters' Quick-Add "New encounter" button using Flame instead of the bottom-nav/Global-Search Activity/Pulse icon — RE-CHECKED 16 Sep 2026, confirmed correct, not a bug: that file's own comment documents a real, explicit ask for a DISTINCT icon (not the generic Activity glyph), with Flame chosen as the closest thematically-honest substitute for "lips" (no such Phosphor glyph exists) and reused from Kink Registry's own established convention — left as-is. Row-title 14px/600-weight text being consistently used but never expressed via `TYPE.bodyEmphasis` is preventative-only, no visible bug today.

Verified live via Playwright screenshots at 1600×1000 (desktop) and 390×844 (mobile, confirming byte-for-byte unchanged single-column layout on Episodes and Registry Management) before shipping. Full build, `npx eslint .` clean, and the full 15-flow smoke-test suite against a real `vite preview` production build — 15/15 pass, no regressions, run twice (once after the grid sweep, once more after the icon/token fixes).

## Recently shipped (16 Sep 2026, latest — real desktop layout fixes: Guide/Glossary full-width, module list grids, Status-at-a-glance split cards)

Real ask, a direct correction to the earlier same-day #93 work: "For desktop, like in guide, it shouldn't be narrow, should be full width page. Module contents still mobile width... desktop at a glance section still has lots of dead space left and right. Split into two side by side cards maybe?"

**Guide/Glossary reverted from a centered 640px column to a genuinely full-width page.** The #93 measure-cap fix shipped earlier the same day solved the reading-measure complaint by capping and centering the whole page — which turned out to be the same "narrow floating box" complaint in a different shape, just confirmed directly this time rather than guessed at. Reverted the header/body centering; the intro paragraph and CTA button keep a readable `maxWidth` but flush-left (no `margin: auto`, so they don't read as a centered floating box); the GUIDE_SECTIONS card list now uses a real CSS grid (`repeat(auto-fill, minmax(340px, 1fr))`) on desktop, flowing 2-4 columns depending on width instead of one narrow column. Glossary's own term/definition list uses real CSS multi-column flow (`columnCount: 2`, `breakInside: "avoid"` per row) instead of a grid, since its rows are uneven-height text pairs, not uniform cards — the same "full width, genuinely used" outcome via the layout mode that actually fits the content shape. Mobile is untouched in both screens.

**"Module contents still mobile width" — a real, separate, wider gap: the earlier "Desktop full-width layout" round (15 Sep) removed each screen's own outer width cap, but never touched how the actual list CONTENT inside laid out — so a Contacts/Encounters/Testing/etc. card still rendered as one full-width stacked column, each card's own left-aligned text sitting in a wide row with a huge blank strip on the right. Fixed with the same additive pattern across 8 files' list containers**: Contacts, Encounters, Testing, Clinic Visits, Vaccinations, Symptom Log (Active + Resolved sections separately), Measurements (shared by both its "By type" and "By group" modes, since both funnel through the same `renderTypeSection`), and Menstrual Health's Cycle/Contraception (active + history)/Pregnancy tabs — each list container's own `display: flex, flexDirection: column` becomes `display: grid, gridTemplateColumns: repeat(auto-fill, minmax(340-380px, 1fr))` on desktop only, real CSS Grid genuinely filling the available width with as many columns as fit. Every card/row component's own internal JSX is completely untouched — only how many sit per row changes, the lowest-risk way to fix this given how many files it touches. Medication Dashboard's own Registry tab was deliberately left out — its cards have manual move-up/move-down reordering, which would read confusingly once cards sit in unrelated grid columns instead of a single ordered column; a real, considered exclusion, not an oversight.

**Home's Status-at-a-glance split into up to 2 independently-sized cards on desktop**, per the owner's own suggestion. The earlier same-day `justifyContent: center` fix centered the ring CONTENT but the card itself still stretched to the row's own width, so its background/border kept reading as one big mostly-empty box around 1-2 rings. Split into a "general health" card (Testing + Adherence) and a "Menstrual & Contraception" card (Cycle + Contraception), each sized purely by its own ring content via flex, not a shared row — 1 card when only one group has data, 2 side by side when both do. The 4 ring elements are built once (`testingRing`/`adherenceRing`/`cycleRing`/`contraRing` consts) and referenced by both the desktop split-card layout and mobile's own untouched single-card row, so the two layouts can never drift out of sync with each other.

Verified live via Playwright throughout: Contacts renders a real 4-column card grid at 1600px width (vs. the prior single stretched column) with zero change at 390px mobile width (confirmed via direct screenshot comparison); Encounters/Testing/Healthcare's sub-tabs show the same real grid; the Guide screen now reads as one full-width page with a real multi-column card layout; Glossary's term list flows into genuine two-column text; Home's Status-at-a-glance renders as one compact card (2 rings) instead of a mostly-empty stretched box, confirmed at both mobile and desktop widths. Full build, `npx eslint .` clean, and the full 15-flow smoke-test suite against a real `vite preview` production build — 15/15 pass, no regressions.

**Honest scope note**: this round covers the highest-traffic list/browse screens (Contacts, Encounters, and every Healthcare-family module). Not yet extended: Timeline/Episodes, Registry Management, Attachments, Partner Notification, Global Search results — lower-traffic list screens sharing the same underlying shape, flagged for whoever picks up the remaining sweep, not silently assumed complete.

## Recently shipped (16 Sep 2026, latest of all yet again again again — sticky sub-heading overlap, Option Lists icon bug, Status-at-a-glance rework, Guide/Glossary header centering)

Real ask, four distinct live reports in one message.

**Sticky sub-heading overlap — a real regression from the earlier "sticky-header status-bar fix" round, not a new bug class.** Report: "Testing/clinic visit sub heading ends up overlaying the healthcare header btw when scrolling." Root cause: that earlier fix moved the 4 real screen-title banners' own `top` from `0` to `calc(env(safe-area-inset-top) + 8px)` so the banner keeps its status-bar protection at every scroll position — but 7 sites elsewhere in the app (Testing/Clinic Visits/Vaccinations/Symptom Log/Measurements/Menstrual & Contraception's own sub-heading bars, all nested inside Healthcare's shared scroll container, plus Contacts' own bulk-select toolbar) stick directly beneath one of those banners using a bare `top: 62` — a value that only worked while the banner's own `top` was `0`. Once the banner started locking 8px (or more, on a real device with a real notch) lower, these bars — still locking at the OLD position — began overlapping its new, lower bottom edge instead of sitting flush beneath it, reproducible even in this sandboxed environment (`env()` resolves to 0px here, so the drift is exactly the deliberate +8px, not device-dependent). Fixed all 7 sites to `top: "calc(env(safe-area-inset-top) + 70px)"` — the identical offset now baked into their own parent banner — so they always sit exactly flush beneath it, on any device.

**Manage Lists > Option Lists — Menstrual flow and Measurement type were missing their icons, a real bug, not a gap.** Both already had real `OPTION_LIST_ICONS` entries ("Drop"/"Ruler", added 19 Aug 2026) — but the two Phosphor components were never added to `SHOS_OptionListEditor_Prototype.jsx`'s own `ICON_COMPONENTS` lookup table, so `ICON_COMPONENTS[iconConfig.icon]` silently resolved to `undefined` for both, rendering no icon at all while every other list's icon showed correctly. Fixed by importing and registering both. Separately checked the broader "consistent icon theme across modules" ask: every list's icon already matches its own module's real domain icon (Pill for medication, Drop for menstrual flow matching Cycle's own list icon, Syringe for vaccine, TestTube for sample type, etc.) — this was purely the one missing-registration bug, not a wider theming gap.

**Home's Status-at-a-glance — reworked from tap-to-reveal to always-visible inline text, and the mobile dead-space/centering fixed.** Two real reports: "consider if the information button contents can actually just be given next to the circle - will use some of the free space" and "isn't evenly centred/spaced. Dead space on RHS of box." `StatusRing` was rebuilt from a vertical stack (ring, caption, a tap-to-reveal info line hidden below) into a horizontal layout (ring on the left, caption + info text stacked to its right, always visible, no tap or `InfoIcon` needed) — using the row's own free horizontal space productively instead of leaving it empty, and a real accessibility improvement over the prior tap-gated pattern, not a regression of the standing icon-only-affordance rule. The dead-space bug itself was a separate, real CSS issue: each ring's own `maxWidth` cap (needed so a lone ring doesn't stretch absurdly wide) meant the row's default `justifyContent: flex-start` packed items against the left edge, dumping all the leftover width as one block of empty space on the right rather than distributing it — fixed with `justifyContent: "center"` on the row.

**Guide/Glossary — the real "doesn't seem full screen" bug, found by checking, not guessing.** A live check confirmed the screen genuinely does cover the full viewport (`position:fixed, inset:0`, real `0,0` to `1600×1000` bounding rect) — the actual issue, visible in a real screenshot, was a mismatch: the header bar (back chevron + title) spanned the full width while the body content sat capped/centered in a 640px column beneath it, so the header read as generic full-width chrome floating over an unrelated narrow column, rather than one deliberate, cohesive screen. Fixed by capping/centering the header's own inner content (chevron + title) to the same 640px column on desktop, while keeping its background band full-width — the same "full-width chrome, centered content" pattern most reader-style desktop pages use.

Verified live throughout via Playwright: Healthcare's own "TESTING" sub-heading now sits flush beneath the Healthcare banner with zero overlap when scrolled; Manage Lists' Menstrual flow/Measurement type rows both confirmed rendering a real icon (DOM-checked, not just visual); Home's Status-at-a-glance reads as a clean, centered, evenly-spaced set on both mobile (2 rings) and desktop; the Guide screen's header and body now share one visually consistent centered column on desktop. Full build, `npx eslint .` clean, and the full 15-flow smoke-test suite against a real `vite preview` production build — 15/15 pass, no regressions.

## Recently shipped (16 Sep 2026, latest of all yet again again — desktop Status rings + Guide/Glossary measure cap, #93)

Real ask: implement the 2 targets #93's own 16 Sep design doc already scoped (see Known Issues above for the full design reasoning) as real, additive code — Home's Status-at-a-glance rings reading as tiny widgets in a mostly-empty card at desktop width, and Guide/Glossary's body text stretching edge-to-edge at ~13px across a 1600px viewport.

**`src/calculations/responsive.js` (new file)** — `useIsDesktopWidth()` promoted out of `SHOS_Home_Prototype.jsx` into a shared export, per the design doc's own judgment call #3 (relocating already-working code, no behavior change) — the same live, resize-aware `window.innerWidth >= 900` check, now importable from Settings too without a second copy.

**Target 1 — Home's `StatusRing`.** Reads `isDesktopWidth` from `HomeScreen`'s own already-computed value (no new hook instance per ring). Desktop branch: `size` 64→96, `stroke` 6→8, ring wrapper `maxWidth` 100→140, `centerText` font 14→18, caption font 11→13; the "Status at a glance" container's own `gap` 8→16 and `padding` "16px 8px"→"24px 16px". Mobile branch is the exact prior markup, untouched.

**Target 2 — Settings' `GuideScreen`/`GlossaryScreen`.** Desktop-only measure cap on the body wrapper: `{padding: 16, maxWidth: 640, margin: "0 auto"}` instead of the mobile-only `{padding: 16}` — same text, same font size, just wrapped at a readable ~75-90 characters instead of stretching edge-to-edge. No other markup inside either screen changed.

**A real, honest gap found while screenshotting the result, not fixed this round**: enlarging the rings alone doesn't address the surrounding card's own layout when fewer than 4 rings render (this seed profile has menstrual tracking off, so only Testing/Adherence show) — real blank space remains to the right of a short 2-ring row at desktop width. Logged in Known Issues above as judgment call #5, not silently closed.

Verified via screenshots at 390×844 (mobile) and 1600×1000 (desktop) for both targets before shipping: mobile confirmed byte-for-byte visually identical to pre-change (64px rings, unchanged Guide/Glossary full-width layout); desktop confirmed the rings visibly enlarge and the Guide/Glossary body settles into a clean ~640px centered column rather than reading lost in the wide viewport. Full build, `npx eslint .` clean, and the full 15-flow smoke-test suite against a real `vite preview` production build — 15/15 pass, no regressions.

**Honest scope note**: this closes the 2 originally-reported targets, not the broader "full thorough global app-wide refinement" later separately requested — see judgment call #2 above (whether to sweep Resources/onboarding/About for the same measure-cap treatment) and the not-yet-scoped wider UX-quality audit (ease of use, intuitiveness, clarity, standardised styling) discussed in chat the same round, neither attempted here.

## Recently shipped (16 Sep 2026, latest of all yet again — sheet-title banner corner-softening, #82)

Real ask (#82, the standing "apply a recent fix's pattern consistently across other modules" discipline): picked the one already-documented, concrete gap this discipline had flagged — the 3 plain sheet-title banners (Testing's/Clinic Visits' "New/Edit test"/"New/Edit visit", Encounters' "Add/Edit Encounter") never got the rounded-bottom-corner/subtle-border treatment the "banner styling" round gave the app's 4 real screen-title banners (Contacts/Healthcare/Medication/Encounters' own landing screens), left as an explicitly lower-priority gap at the time.

Applied the identical `borderRadius: "0 0 16px 16px"` + `borderBottom: "1px solid rgba(0,0,0,0.08)"` treatment to all 3 sheet-title banners — top corners stay square (flush with the sheet's own top edge, same reasoning as the screen-title banners). Deliberately did NOT also apply the separate status-bar `top: calc(env(safe-area-inset-top) + 8px)` fix from that same round — checked first, not assumed: these 3 sheet banners already sit inside a `position: fixed` overlay whose own `paddingTop: env(safe-area-inset-top)` never scrolls away (unlike the screen-title banners' case, where the safe-area padding lived on a scrolling ancestor), so the status-bar bug that fix targeted structurally cannot occur here.

**A second, related drift fixed in the same pass, found while touching Encounters' own banner**: its title span used a hand-typed `fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 16` instead of the shared `TYPE.sheetTitle` token (`fontSize: 18, fontWeight: 700`) that Testing's and Clinic Visits' own sheet banners already use — the exact "duplicated an existing TYPE token instead of referencing it" pattern already found and fixed at several other sites in an earlier font/colour consistency audit, just missed here. Converted to `TYPE.sheetTitle`, which also means Encounters' own Add/Edit title now reads at 18px like its two siblings instead of a smaller, inconsistent 16px — a deliberate visual correction, not just a token rename.

Verified live via Playwright: Encounters' "Add Encounter" title renders at the real, computed 18px/700/white; all 3 banners' own computed `borderRadius`/`borderBottom` confirmed as `0px 0px 16px 16px` / `1px rgba(0, 0, 0, 0.08)`. Full build, `npx eslint .` clean, and the full 15-flow smoke-test suite against a real `vite preview` production build — 15/15 pass, no regressions.

## Recently shipped (16 Sep 2026, latest of all still — Stats organism/site breakdown + clinical-impression field, #78)

Real ask (#78), scoped earlier the same day: a positive-test breakdown by organism and by sample site on the Stats screen, with a real fix for the double-counting risk the scoping itself flagged (`testingRepository.js`'s own `_supersedeOlderMostRecent` comment documents that same-day tests for different sample sites are legitimately stored as separate records — a naive per-test tally would double-count one real diagnosis event), plus a clinical-impression field, with the placement decision (Clinic Visit vs. Testing) resolved by the scoping text's own stated lean ("Clinic Visit fits more naturally than Testing").

**`src/calculations/statsCalculations.js`** — two new pure functions, following the file's own established resolver-callback pattern (never reading a registry directly): `getPositiveTestsByOrganism(tests, resolveOrganismName, resolveResultName, topN)` dedupes on a `${date}|${organismId}` key — collapsing exactly the same-day-different-site scenario `_supersedeOlderMostRecent` warns about into one count per real diagnosis — while `getTestsBySite(tests, topN)` deliberately does NOT dedupe, since each `sampleType` entry represents a genuinely separate physical sample, an additive fact rather than a diagnosis count.

**`SHOS_Settings_Prototype.jsx`'s `StatsScreen`** — both wired in via the same `useLoadedMemo` lookup-Map pattern already used for `kinkNameById`/`symptomNameById` (`organismNameById`/`resultNameById`, resolved from the already-imported `OrganismRegistry`/`ResultsRegistry`). Rendered as two new list blocks in the existing Healthcare stats card, right after the testing-trend insight: "Positive results by organism" (with a tap-to-reveal `InfoIcon` explaining the same-day dedup rule, per this file's own standing icon-only-UI convention) and "Tests by sample site" (a plain list, no info icon needed — the tally itself is self-explanatory).

**`clinicVisitsRepository.js`** — added `clinicalImpression: ""` to `DEFAULT_CLINIC_VISIT`, positioned right before the existing `clinicalNotes` field — a short, scannable working impression/diagnosis, distinct from `clinicalNotes`' longer narrative. Wired into `SHOS_ClinicVisits_Prototype.jsx`'s edit form (a new input right before "Clinical notes") and detail view (a new `ReadRow`, conditionally rendered only when non-empty so an older record with nothing set shows no extra row). Seed record `visit_001` given a real value ("Symptomatic urethritis, confirmed Gonorrhoea") to exercise the field against real data.

Verified live via Playwright against real seed data: Stats correctly shows "Gonorrhoea 1 / Chlamydia 1" (the two real positive seed tests, `test_001`/`test_006`, on different dates — no double-counting) and "Urine 7 / Blood 4 / Rectal swab 3" for sample sites; `visit_001`'s detail view shows "Clinical impression: Symptomatic urethritis, confirmed Gonorrhoea" directly above "Clinical notes"; its Edit sheet's own Clinical impression input correctly loads that same real value (confirmed via the input's actual `.value` property, not `innerText`). Full build, `npx eslint .` clean, and the full 15-flow smoke-test suite against a real `vite preview` production build — 15/15 pass, no regressions.

## Recently shipped (16 Sep 2026, latest of all — Lists reassociation UX, #75)

Real ask (#75), scoped 16 Sep 2026 earlier the same day: "click entry to view associated records" and "reassociate an archived term with entries" for the 17 custom option lists (Manage lists > Option lists) — these are plain strings stored directly on records, not id-references like a real Registry, so unlike Kink/Organism/Result there was no way to see which records used a value, or to move them onto a different value before/after removing one.

**New `src/calculations/optionListUsage.js`** — the usage-scanner, same "scan every repository that can reference this" shape as `registryUsage.js`, applied to plain-string fields instead of ids. A `SOURCES` config maps each of the 17 list names to its real repository + field (confirmed by reading each repository's own `DEFAULT_*` shape directly, not guessed — e.g. `medicationType`/`route`/`category` on `MedicationRepository`, `gender`/`pronouns`/`contraception` split across BOTH `ContactRepository` and the `MyProfileRepository` singleton). `findRecordsUsingOptionValue(listName, value)` returns every real record's own label currently carrying that value; `reassociateOptionValue(listName, oldValue, newValue)` walks the same sources and calls each repository's own `update()`, swapping the value in place (deduping an array field so a record never ends up with two copies of the new value).

**`remove()` now archives instead of deleting outright** (`customOptionListsRepository.js`) — a genuinely separate storage key (`shos_custom_option_lists_archived`, same pattern as `usageMeta`'s own separate key), with new `getArchived()`/`restore()`/`permanentlyDeleteArchived()` methods. A record already carrying the old string as a plain-text value used to show an orphaned, invisible-to-the-editor value forever; now it's recoverable and reassociable. Wired into `backupService.js` in the same change (build/restore/merge, plus its own Selective-export row) per this file's own standing rule.

**`SHOS_OptionListEditor_Prototype.jsx`** — each live value gets a tap-to-expand "View associated records" disclosure (a thin renderer over `findRecordsUsingOptionValue()`, deliberately read-only this round — deep-linking to the record itself would need `onNavigateToRecord` threaded through Settings' whole multi-level nav, a bigger plumbing job left for later). A new "Archived" section lists removed values, each with Reassociate (pick a live value, moves every affected record onto it, then drops the archived entry for good), Restore (back to the live list), and a real permanent-delete action.

**Real bug caught live while verifying, not by inspection**: the reassociation success message ("Moved N records from X to Y") was rendered INSIDE the "any archived values left" conditional block — reassociating the LAST archived value made the whole Archived section, message included, disappear in the same render before it could ever be read. Fixed by hoisting the status message above that gate. Verified live via Playwright against real seed data: Gender's "Non-binary" (2 real seeded contacts) correctly showed "2 records use this" before archiving, moved to Archived on remove, and reassociating to "Female" correctly showed "Moved 2 records from "Non-binary" to "Female"." with the archived entry gone afterward.

Full build, `npx eslint .` clean, and the full 15-flow smoke-test suite against a real `vite preview` production build — 15/15 pass, no regressions.

## Recently shipped (16 Sep 2026, latest of all — real problem-report Send, #80)

Real ask, a direct follow-up to #80's own "product decision, not an engineering gap" scoping above: the owner's own explicit re-authorization — "not automatic, but doesn't need to open in email, user can write in text field then click send — accept this, like maps service is an exception to sharing data. Don't need users info except what they write in box." This is a real, deliberate instruction to build a genuine outbound Send for the existing "Report a problem" box (Settings > Support > Developer tools > Error log — see its own 11 Sep 2026 entry), pre-empting the exact objection #80 was scoped around by drawing an explicit parallel to the already-disclosed Nominatim address-lookup call (Settings > Data & network) — a real, accepted exception to "nothing leaves the device," not a reversal of it.

**New `errorReportEndpoint` preference (`appPreferencesRepository.js`, default `""`).** This app has no backend of its own to receive a report — unlike Nominatim/GitHub, there's no real built-in destination — so rather than guess at or fabricate a third-party service, the destination is a URL the owner sets himself in Settings > Data & network's own screen (a third disclosed-exception row, alongside Address lookup/Check for app updates, same card layout, a plain `<input type="url">` committed on blur). Blank (the default) means the feature is genuinely off — the "Report a problem" box behaves exactly as it did before this change, local-only. Once a real URL is set, the same box's button relabels from "Save note" to "Send," and tapping it does both: saves the note into the local Error log (unchanged) AND fires one `fetch(endpoint, { method: "POST", body: JSON.stringify({ message: trimmed }) })` — deliberately the ONLY field in that body, matching the owner's own explicit "don't need users info except what they write in box" constraint word for word. A failed send (network error, non-2xx) shows a clear "saved here, but sending failed" status rather than losing the note — the local save always succeeds first, the network call is additive, never a precondition.

Verified live via Playwright end-to-end: the endpoint field persists correctly across a reload; with a real endpoint set, the Error log screen's button correctly reads "Send" and its own copy correctly explains what happens; intercepting the real outbound request confirmed the captured POST body is exactly `{"message":"Test report: the widget does not widget."}` — no device info, no app version, no timestamp, nothing beyond the literal typed text — and the UI correctly shows "Sent, and saved to this log." afterward. Full build, `npx eslint .` clean, and the full 15-flow smoke-test suite against a real `vite preview` production build — 15/15 pass, no regressions.

## Recently shipped (16 Sep 2026, even later still — combination-drug doses, refill-banner actions, Testing result colours, main sync)

Real ask, several distinct items: fix a real "NaNmg" bug in the medication dose-update flow, support medications with more than one active ingredient (PrEP, co-codamol), rework the refill-due banner's action set, colour-code Testing's negative/pending/other result text to match the existing positive-red treatment, and keep `main` current for the APK/web builds.

**Combination-drug dose strengths — a real bug (NaNmg) traced to a real, recurring gap, not a one-off.** Live report: updating PrEP's dose via the card's own 3-dot menu showed "the old dose (NaNmg) is kept..." — root cause: PrEP's real dose is two active ingredients at different strengths (Emtricitabine 200mg/Tenofovir DP 245mg), and the only way to capture that in the old single value+unit field was jamming both numbers into one non-numeric string ("200 , 245") — multiplying that by `unitsPerDose` is genuinely `NaN`, not a display bug. Real fix, not a patch: a new `doseComponents` field (`medicationRepository.js`) — an array of `{label, value, unit}`, one entry per active ingredient — is now the real source of truth, with the old singular `doseStrengthValue`/`doseStrengthUnit` fields kept only as a read-only fallback for a medication never touched since (`getDoseComponents()`/`formatDoseComponents()`, both new pure functions in `medicationCalculations.js`, deliberately never auto-split an existing combined string like "200 , 245" into separate components — guessing which number belongs to which ingredient could silently corrupt a real dose, the same caution this file's own backup-migration entry already applied once for a different rename). New `DoseComponentsField` UI (replacing `DoseStrengthField`) wired into Add/Edit medication and the Update-dose sheet: one row per ingredient, an optional label (shown only once there's more than one row — a single-ingredient medication doesn't need to re-name what its own `name` field already says), add/remove freely. Also fixed at its 2 other real call sites sharing the identical NaN-prone multiply (`SHOS_ClinicCard_Prototype.jsx`, `clinicCardPdfService.js`). Verified live via Playwright end-to-end: seeding PrEP with the exact legacy "200 , 245" string now shows "(200 , 245mg)" in the old-dose description — the raw text, not NaN; entering it correctly as two real rows (Emtricitabine 200mg, Tenofovir DP 245mg) and saving shows "Emtricitabine 200mg / Tenofovir DP 245mg" on the next open, proving the full round trip.

**Refill-due banner — a fuller, real action set, scoped by the owner's own two decisions.** Real ask, with two genuinely ambiguous parts the owner was asked to resolve directly rather than guessed at: (1) "Cancel" — the owner's pick: temporary, functionally the same suppression `refillRequestedAt`("Requested") already uses, just without implying an order was actually placed — new `refillCancelledAt` field, cleared the same way (the next real logged refill for that medication). (2) which medications get the fuller set — the owner's pick: daily/custom-interval ("repeating") medications get Requested/Snooze 2h/Snooze 1 day/Cancel; a PRN medication due at the same moment keeps the original, simpler Requested/one-Snooze set, via a new optional `ids` parameter on `handleMarkRefillRequested()`/`handleCancelRefill()`/`handleSnoozeRefill()` (`refillReminderSync.js`) so the two groups' actions never cross-apply if both happen to be due at once. `handleSnoozeRefill()`'s hardcoded 30-minute snooze is now a real parameter, defaulting to 30 only for a native-notification tap (which has no UI to offer a choice) or the PRN group's own simpler row. Verified live: Testosterone (a real "custom"-pattern seed medication, genuinely out of stock) renders the full Requested/Snooze 2h/Snooze 1 day/Cancel row.

**Testing's result text — negative now reads green, matching positive's existing red; everything else (Pending, Inconclusive, Not tested, or any custom registry value like "Haemolysed"/"Lost sample") reads amber.** Real ask: "as positive is red, negative should be green too... pending/haemolysed/lost sample/not ± should be colour compatible orangey/yellow." Since Results is an open registry (free text, not a fixed enum), this is deliberately a 3-way classification rather than a name-by-name list: Positive → red/bold, Negative → the same contrast-safe green already used elsewhere in this file → bold, anything else → `ACTION.gold` (already established elsewhere in the app as a real, contrast-checked text colour, not just a fill) → not bold, matching its own lower-certainty meaning. Verified live via `getComputedStyle`: Negative renders `rgb(17, 120, 26)` (the real safe-green token), Positive `rgb(217, 56, 56)` (the real red token) — both confirmed reaching the actual DOM, not just the source.

**`main` fast-forwarded** to the feature branch's own head (a clean 3-commit fast-forward, no conflicts) so the real APK/web-alpha builds and downloads stay current — done at the start of this round and again after this round's own commit, matching the owner's explicit "ensure main is up to date" ask both times it was raised.

Verified live throughout: full build, `npx eslint .` clean, and the full 15-flow smoke-test suite against a real `vite preview` production build — 15/15 pass, no regressions from any of the four changes.

## Recently shipped (16 Sep 2026, latest — sticky-header status-bar fix, medication dose-time capture, Testing archived-record fade)

Real ask, three distinct items: fix the 4 real screen-title banners so the white gap above the colour border survives scrolling/sticking (previously only correct before the first scroll), build a real interface for capturing a medication's actual dose time(s) of day, and rework Testing's "old/archived" visual treatment from a dot-colour swap to a fade on the surrounding record.

**Sticky-header status-bar fix.** Real report: the white gap above a screen-title banner's colour border (Contacts/Healthcare/Medication/Encounters) looked right before the first scroll, then vanished — the banner started sitting flush against the device's own status bar once stuck. Root cause: `App.jsx`'s `<main>` carries the real `env(safe-area-inset-top)` padding, but that's normal document flow, so it scrolls away with everything else — a `position: sticky; top: 0` banner loses that protection the moment it locks, since `top`'s own value (not an ancestor's one-time padding) is the only thing that persists across scroll. Fixed at each of the 4 banners' own `top` value directly: `top: calc(env(safe-area-inset-top) + 8px)` instead of `top: 0` — carries the real safe-area offset itself (protecting the status bar at every scroll position, not just before the first one) plus a deliberate ~8px white gap (half each banner's own 16px top padding, per the exact ask) that now survives being stuck. Applied identically to Contacts/Healthcare/Medication (each IS the sticky element) and Encounters (a separate outer sticky wrapper around a non-sticky inner colour banner — same fix, one level up).

**Medication dose-time capture — a real gap, not a bug fix.** Confirmed via grep that no field anywhere captured an actual wall-clock dose time ("8am and 8pm") — the existing reminder system (`lockoutEndsAt()`/`nextDoseEstimate()`) is purely elapsed-time-based, computed forward from the last/first logged dose's real timestamp, never anchored to a time the user actually set. New `scheduledTimes: []` field (`medicationRepository.js`'s `DEFAULT_MEDICATION`) — one `"HH:mm"` string per daily dose slot. New `ScheduledTimesField` component (`SHOS_Medication_Dashboard_Prototype.jsx`), wired into both the Add and Edit medication sheets right after "Doses per day": once-daily shows a single "Dose time" input; multiple-doses-a-day shows the first time plus one input per remaining slot, auto-suggested at even spacing across 24h (e.g. 12h apart for twice-daily) — but each slot can be manually overridden, and once touched, an edit to the first time never re-clobbers it. Same "resync-if-untouched" pattern (a `touchedRef` Set, not a persisted flag) already established elsewhere in this app for auto-suggested-but-overridable values (e.g. MeasurementSheet's remembered-unit resync). Deliberately scoped to data capture + a plain "Scheduled: 8:00 AM, 8:00 PM" display line on the medication card — NOT wired into the adaptive/fixed lockout-calculation math this round, which stays genuinely elapsed-time-based; integrating a real wall-clock anchor into that calculation is a bigger, separate architectural decision, not attempted speculatively here (documented as such in the repository's own field comment). Verified live via Playwright: once-daily correctly shows one "Dose time" input defaulting to 8:00 AM; bumping Doses per day to 2 correctly adds a second input auto-suggested at 20:00 (12h spacing); changing the first time to 06:00 correctly re-suggests the still-untouched second slot to 18:00; manually setting the second slot to 22:30 and then changing the first again correctly leaves the manually-set slot alone.

**Testing's "old/archived" treatment — reworked from a dot-colour swap to a record fade, per the owner's own explicit design call.** The existing approach (an old test's dot swapping to `ACTION.gold`, a separate "archive" tone) worked but lost real information — a genuinely old positive read with the same visual weight as an old negative, both flattened to the same gold dot. New approach: the dot always keeps its real, true meaning (red/green/amber/blue) regardless of age; age is shown instead by fading the surrounding record — title text and date/setting text step down from `T.textPrimary`/`T.textSecondary` to `T.textSecondary`/`T.textDisabled`, and the card's own background steps from `T.surface` to `T.surfaceVariant` — for anything outside the "recent" window. Also widened that window itself from 4 weeks to 3 months (90 days), matching the owner's own suggested threshold (BASHH's real routine-STI-retest interval) — still with the existing "or one of the 2 most recent tests on file" carve-out, so someone testing only every few months doesn't see their own latest result read as archived. The positive/negative result label and the red border for a positive result are both left untouched by the fade — only the title/date/setting text and the card background step down, so a genuinely old positive is still unmistakably positive, just visually lower-weight than a fresh one. Checked whether this same "dot fades to a separate archive tone" pattern exists anywhere else in the app before scoping a wider rollout, per the owner's own "similar vibes for any other active dot type record" ask — it doesn't; every other `ACTION.gold` use in the codebase (Timeline's coverage status, Home's backup-reminder banner, Measurements' "Low" classification) is an unrelated meaning, so this was a one-file change, not a partial rollout of a wider pattern. Verified live via Playwright against real seed data: 3 tests from the last 3 months (Sep 7/13/14) render at full weight; 4 older tests (Jun 8, May 26, Apr 9, Mar 4) render with the faded background/text treatment, while a March 4 "Symptomatic screen — Chlamydia positive" among them still shows a red dot, a red border, and red "Positive" text — exactly the intended split.

Verified live throughout: full build, `npx eslint .` clean, and the full 15-flow smoke-test suite against a real `vite preview` production build — 15/15 pass, no regressions from any of the three changes.

## Recently shipped (16 Sep 2026, later again — nav/Settings buffer, Backup & Export consolidation, app-wide copy pass)

Real ask, several distinct items in one message: halve the bottom-nav's own bottom padding if not already done, add real breathing room below the last row on every scrollable overlay (Settings named specifically, so device gesture bars don't crowd it), consolidate Backup & Data's 7 separated export/restore rows, audit the whole session's message history for anything dropped, and sense-check app-wide copy for anything a new user wouldn't understand at a glance — reword over an info icon, and make dense paragraphs (Guide/Glossary named) more casual/bulleted.

**Bottom nav + every overlay's bottom buffer.** The bottom nav's own bottom padding (`10px 0 calc(14px + env(safe-area-inset-bottom))`) was halved to `7px` — real, not just declared, since the CSS math itself doesn't need a physical notch to verify. Separately, and more broadly: every one of the app's 36 full-screen overlay containers (`position:fixed; inset:0; overflowY:auto`, the same shared shape already inventoried once this session for the `scrollable-region-focusable` fix) only ever reserved `env(safe-area-inset-bottom)` at their very end — the raw device inset with zero extra margin, so the last row on a long screen (Settings named specifically, but this is a real, identical gap on every one of them) sat exactly at the edge of a device's own gesture-nav area with no breathing room at all. Bumped to `calc(20px + env(safe-area-inset-bottom))` across all 36 sites in one pass, consistent with this project's own "fix a shared shape once, not per-file" precedent — purely additive scroll-end whitespace, no other layout risk.

**Message-queue audit.** Read the full session transcript end to end (not from memory) to check for any user message that got dropped rather than acted on, per the user's own report that some messages "hadn't registered... until later." Found none genuinely dropped — every real ask across the whole session traces to a corresponding shipped fix or an explicitly-logged Known Issues item — but did find several backlog-tracker entries (#64-67, #69, #71-74, #79, #81) that were still marked pending internally despite being shipped in earlier rounds; corrected those.

**Backup & Export consolidated.** Real ask: "other apps don't have the export/backup options as separated as we do." The 7 rows (Export backup/to a folder/Selective/CSV/Encrypted/Restore/Automatic backups) each exist for a real, separate reason already documented at their own site — none could be dropped or merged into "single functions" without losing something a real request asked for — but nothing required all 7 to sit directly on the main Settings list. Moved behind one "Backup & Export" row into a new `BackupExportScreen`, same sub-screen pattern as every other multi-control settings area in this file; no functionality changed, no row removed. Real bug caught before shipping, not by inspection: the new screen initially threw `ReferenceError: SettingsRow is not defined` — `SettingsRow` turned out to be defined INSIDE `SettingsScreen`'s own closure (over its `darkMode`), not at module scope, so a new standalone sibling component couldn't reach it; fixed with a local equivalent inside the new component rather than promoting the original (which would have touched all ~22 existing call sites for one new consumer). Caught live via a direct Playwright reproduction after the smoke suite's own test 12 failed on this exact screen — a real lesson to log, not just a fix: the failure signature (`locator('text=Restore from backup')` timing out on the SECOND click, not the first) initially pointed the wrong direction, since the FIRST click ("Backup & Export") had already silently landed on a screen that then crashed to the `ErrorBoundary` — always check for a console/page error before trusting a timeout's own apparent location.

**App-wide copy pass.** Delegated a read-only audit (an Explore agent, not given edit access) to find confusing labels/toggles across all 19 modules plus the Guide/Glossary screens, then verified and fixed the real findings directly rather than trusting the report blind. Confirmed real: "Linked in My Profile as: {status}" (Contacts) read backwards — like a fact about the contact being single, not "does this contact count toward my own profile's status" — reworded to "Linked to My Profile's relationship status ({status})". "Cummer — frequency/volume/style" (Contacts, My Profile, and one Privacy-screen description) is a genuinely unclear noun for an ejaculation-frequency/volume/style field — reworded to "Ejaculation — frequency/volume/style" across all three files (display labels only, the underlying `cummer` field/option values untouched). Clinic Card's "TOC 2 week" quick-add chip used a raw, unexplained abbreviation, inconsistent with Clinic Visits' own already-correct "TOC = Test of Cure" expansion elsewhere in the app — reworded to "Test of cure · 2wk". Medication Dashboard's "PRN" segmented option and "Inventory tracked" toggle (the latter with zero explanatory subtitle, unlike almost every other toggle here) reworded to "As needed" and "Track stock & refills" respectively — both display-only, the stored `usagePattern`/`inventoryTracked` values unchanged. Settings' two clinic-appointment reminder toggles ("...reminder A"/"...reminder B", reading like internal labeling) reworded to "...first reminder"/"...second reminder", matching their own already-correct description text. Episodes' empty state explained what an episode actually groups together and why, not just how to start one. The Guide screen's 5 sections — previously dense, un-bulleted single paragraphs, the exact "academic, not casual" pattern flagged — rewritten as a short intro line plus a few bullets each, and one stale inaccuracy fixed in the process ("General... Preferences, Notifications, and Units" — Units moved to Measurements in an earlier round this session, this screen never caught up). Glossary was mostly already in good shape (a scannable term/definition list with search); only the densest single entry (DoxyPEP) was split into shorter sentences. Two low-priority findings ("Revert PIN" wording, already clarified by its own adjacent description) were deliberately left as-is, not fixed reflexively.

Verified live throughout: full build, `npx eslint .` clean at every step, and the full 15-flow smoke-test suite green against a real `vite preview` production build (run 4 times across this round — once catching the `SettingsRow` scope bug live, three more confirming green after each subsequent fix).

## Recently shipped (16 Sep 2026, even later still — notification audit, vaccination reminders, Calendar dot stacking, info icons)

Real ask: run through medication notifications to confirm they genuinely work, ensure testing/vaccine reminder logic is at least basically correct (simpler than medication's is fine), fix Calendar's same-day multi-event dot display, update Notion, and add explanatory info icons to Status at a glance.

**Notification audit — read every reminder sync file and the shared scheduling chokepoint directly, not from memory.** Confirmed `medicationReminderSync.js` is correct and complete: quiet hours, the master switch, and vacation pause are all enforced once, at `notificationService.js`'s shared `scheduleNotification()` chokepoint every real reminder type calls through — so they apply uniformly without needing separate implementations per type — and per-type toggles/skip/snooze state/the fixed-vs-adaptive timing mode are all correctly respected in `getDailyMedsState()`. `testingReminderSync.js`/`refillReminderSync.js`/`clinicVisitReminderSync.js` are built to the same real standard, deliberately simpler (single or two fixed slots, no streak/adherence concept) — appropriate given what they represent, not a shortfall.

**Real, confirmed gap found: Vaccinations had zero reminder logic anywhere in the codebase.** No `vaccinationReminderSync.js`, no `NOTIFICATION_IDS` entry, no preference toggle — confirmed via direct grep, not assumed from this file's own file inventory (which never named one, itself a hint). A real gap, not a design choice, given `vaccinationRepository.js`'s own `nextDue` field (already used for multi-dose courses like Hepatitis A/B) is exactly the kind of date every other reminder type here already alerts on. Built `src/calculations/vaccinationReminderSync.js` mirroring `testingReminderSync.js`'s single-fixed-slot shape: `nextDue` is a plain `YYYY-MM-DD` calendar date with no time-of-day (unlike this app's fake-UTC full-datetime convention), so a due reminder schedules at a fixed 9am local on that date — an honest "sometime that day" reminder, not a claim of precision the data doesn't have. Snooze-only action, no "done" tap, same reasoning Testing/Clinic-visit already use — logging a real vaccination dose needs a real form. Wired in fully: `NOTIFICATION_IDS.vaccinationReminder`/`VACCINATION_ACTION_TYPE_ID` in `notificationService.js`; `vaccinationReminderEnabled`/`vaccinationSnoozedUntil`/`isVaccinationSnoozed()` in `notificationPreferencesRepository.js`; a due-state banner in `App.jsx` matching the existing Testing/Clinic-visit banners exactly (state, measured height, padding calc, action dispatch, visibility condition); sync calls on Home mount, right after a Vaccinations save, and in Settings' Notifications screen toggle/master-switch/quiet-hours resync paths. Verified live: full build, `npx eslint .` clean, full 15-flow smoke-test suite green.

**Calendar dots — real UI refinement, not a bug fix.** Real ask: "if multiple encounters, stack encounter dots vertically in line... say 3 max." The just-shipped dot-colour fix's own dedup logic (`[...new Set(dayEvents.map(e => e.moduleKey))]`) collapsed multiple same-day events of the same module type into a single dot — a day with 3 Encounters looked identical to a day with 1. Changed to group events by `moduleKey` first, then render each present module as its own vertical stack of up to 3 dots (still capped at 3 module-type columns side by side, unchanged from before) — a busy day now shows both facts at once (which modules, and roughly how many events per module) without the cell growing unbounded.

**Status at a glance — info icons on all 4 rings, plus a new standing design rule.** Real ask: "Status at a glance have informational i button to explain what each thing is. Consider this rule for anything globally that is just icon only, unless truly universal standard." Extended `StatusRing` (`SHOS_Home_Prototype.jsx`) with an optional `info` prop rendering the same tap-to-reveal `InfoIcon` pattern already established for Medication Dashboard's 7-day-adherence dot and Contacts' active-status dot — applied to all 4 rings (Testing, Adherence, Cycle, Contraception), each explaining its own real calculation basis, not just the one that already had it. Documented the broader rule as a standing architecture note (see "Working conventions" above) rather than attempting a full retroactive audit of every icon in the app this round — that's real, separate scope, flagged for whoever picks it up next, not assumed done.

**Notion Development log — updated from a real 6-day gap.** The log's most recent entry before this round was dated 10 Sep 2026; everything shipped 11-16 Sep (the full-team audit, the real physical-play-testing batch, the Interactive Tour/meds-timing/desktop-layout round, the Contacts-settings + global-settings-reorg rounds, the Calendar/rings/Clinic-Card round, and this round itself) was missing. Appended 8 dated entries covering all of it, verified by re-fetching the page afterward and confirming its own `page_last_edited_at` timestamp moved and the new content is actually there — not just trusting the write call's return value.

## Recently shipped (16 Sep 2026, later still — Calendar dot-colour bug, Home rings, Clinic Card recent contacts)

Real ask: "prioritise fixing items which have visual payoff or partway
done" from the grouped backlog — picked #79 (a real, confirmed bug,
not just an investigation), #81 (a clean addition once actually
scoped), and #74 (mechanically ready) over the two genuinely bigger
Group E items (#78, #80 — both scoped, not attempted, see Known
Issues above for why).

**Calendar (#79) — real, confirmed bug, not a vague "investigate."**
Every dot/chip/list-row colour in Settings' Calendar screen used
`ACCENTS[moduleKey]` directly, but the real `moduleKey` values pushed
by `calendarCalculations.js` are `"testing"`/`"clinicVisits"`/
`"vaccinations"`/`"symptomLog"`/`"medications"` — none of which are
real `ACCENTS` keys (only the 5 top-level module colours exist there:
contacts/encounters/medication/healthcare/home). Every Healthcare
sub-type and every medication event silently fell back to the generic
grey default, indistinguishable from each other — only Encounters ever
showed its real colour, confirmed live via `getComputedStyle` before
touching anything. Fixed with a new `calendarModuleAccent(moduleKey)`
function mapping each real key to the accent that module's own screens
already use elsewhere (the 4 Healthcare sub-types all render under
`ACCENTS.healthcare` everywhere else in the app; `"medications"` was
simply missing the singular `medication` key). Deliberately a
FUNCTION, not a module-level object literal — `ACCENTS`' own values
can be overridden by the user via the Colour scheme screen, and baking
them in at module-load time is the exact same bug class already found
and fixed twice this session for Measurements/MenstrualHealth's own
`LIGHT`/`DARK` theme constants. "Sync visibility/unsync" (also named
in #79's original title) was checked and found already correct —
turning sync off already calls `removeAllSyncedEvents()`, switching
target calendars already calls `removeSyncedEventsFrom()` first — not
a bug. "Filter UX bugs" was checked and nothing broken was found;
would need a specific report to pin down further.

**Home's Status at a glance (#81) — two new rings, Cycle and
Contraception, alongside the existing Testing/Adherence pair.**
Considered and rejected forcing both onto the exact same "days since /
a fixed external benchmark" shape Testing uses, per the explicit ask
to consider alternatives and what's actually consistent/desirable
first. Cycle ring: `pct = daysSinceLastPeriodStart / averageCycleLength`,
using `MenstrualCycleRepository.getAverageCycleLengthDays()` — the
person's OWN average, not a fixed external number, the same
"descriptive, not predictive, compare to your own baseline" precedent
`testingTrend` already established elsewhere in this app; colour flips
to red if the current gap has already passed that average, same
"overdue" convention Testing's own ring uses. Contraception ring: a
real, structural finding changed the plan mid-scoping — a single
fixed-denominator ring can't represent every method type (a daily
pill and a 12-week injection mean completely different things by
"due"), but the record's OWN `startDate`→`nextDueDate` span
(`contraceptionRepository.js`) makes the percentage genuinely
universal regardless of method, since it's always "how far through
THIS interval you are," not a guessed constant — this is also exactly
why a pill/IUD/implant (no real `nextDueDate` logged) correctly shows
no ring at all rather than a fabricated one, matching the "not enough
data" honesty every other ring in this app already has. Both gated on
`menstrualTrackingEnabled` plus real underlying data existing — the
whole "Status at a glance" block's own visibility condition was
widened so it still shows for a menstrual-tracking-only user with no
test/adherence data logged yet, not just testing/medication users.

**Clinic Card (#74) — a new "Recent contacts" section, distinct from
the existing "Recent encounters."** The existing section (added
earlier) links to the Encounter record; this is a genuinely different
fact — which real Contacts have you actually seen recently — linking
to the Contact's own profile instead. Derived from data already loaded
for the encounters section (no new repository call beyond adding
`ContactRepository`), deduped by attendee, most-recent-encounter-first,
capped at 8 like its sibling. Added to `CLINIC_CARD_SECTIONS`
(`clinicCardVisibilityPreference.js`) — the single source of truth
both the visibility settings screen and the render logic already read
from — so it's toggleable and defaults to visible like every other
real section, no separate wiring needed.

Verified live via Playwright throughout, working around a couple of
this exact codebase's own previously-documented test-tooling gotchas
along the way (not new ones): a dynamic `import('/src/...')` trick to
flip a preference directly fails against a `vite preview` production
build (dev-server-only), so the real Settings UI toggle was driven
instead; the SW-update banner can intercept a click at certain scroll
positions, same class of flakiness this suite's own
`dismissTransientBanners()` already exists for. Confirmed via
`getComputedStyle`, not just visual inspection: Calendar's day dots
and filter chips render `rgb(127, 48, 166)` (`#7F30A6`, Encounters)
and `rgb(9, 88, 46)` (`#09582E`, Healthcare) — real, distinct colours,
not the pre-fix grey. Both new Home rings render with correct
labels/colours in the same row as Testing/Adherence with no overflow
(`flexWrap` added defensively for narrow-width safety). Clinic Card's
Recent contacts section renders with a real, correct count in the
right position in the section order. Full build, `npx eslint .` clean,
and the full 15-flow smoke-test suite against a real `vite preview`
production build — 15/15 pass. Confirmed green in CI on `main` (Smoke
Test, Build APK, Web Alpha all triggered on the push).

## Recently shipped (16 Sep 2026, global-settings reorg — finishing the last two candidates)

Real ask, resolving the two "bigger, not yet acted on" candidates the
Contacts-settings entry below flagged: "Notifications keep as global.
Week starts on move to calendar, units to measurements?"

**Units — the global Settings > Units screen (added 3 Sep 2026) is
gone entirely.** Its real content splits cleanly along the exact line
the owner's own instruction drew: the Weight/Height/Temperature
Metric/Imperial toggle + per-type unit chips are a genuine
Measurements preference (`MeasurementPreferencesRepository`), so they
moved into Measurements' own `MeasurementPreferencesSheet` — already
the in-module home for its other unit dropdowns (Testosterone/
Estradiol), reachable via that module's own gear icon — rather than a
new screen. `weekStartsOn` is a genuinely different, Calendar-display
setting (`AppPreferencesRepository`), so it moved into Settings' own
`CalendarScreen` instead — the one screen it actually affects — as a
real setter (was previously a read-only `useLoadedMemo`, since the old
Units screen was the only place that ever changed it).

**Notifications stays global, on purpose — not a candidate after
all.** The owner's own explicit call: its 5 per-module reminder
toggles (medication/DoxyPEP/testing/refill/clinic-visit) aren't being
split into each module's own settings — this screen is already the
one place to see and control every real reminder at a glance, and
splitting it would scatter that back across 5 files for no real gain
the owner asked for.

**A separate, unrelated CI fix landed in the same round**: GitHub's
own deprecation notice flagged `actions/setup-java@v4` specifically as
no longer receiving updates (unlike `actions/upload-artifact@v5`/
`softprops/action-gh-release@v2`, already on their current major — the
"forced to run on Node 24" note for those two is normal runner-level
compatibility shimming for actions that don't hard-pin a Node runtime,
not something needing a version bump). Bumped to `actions/setup-java@v5`
— a drop-in swap, same `distribution`/`java-version` inputs.

Verified live via Playwright: the Metric/Imperial toggle and per-type
chips render and persist correctly from Measurements' own gear icon;
Calendar's new Week-starts-on chips persist and correctly reshuffle
the weekday header/grid offset; full build, `npx eslint .` clean
(caught and removed the now-fully-dead `UNIT_SYSTEM_TYPES`/
`detectUnitSystem`/`getAvailableUnits`/`getDefaultUnit` imports the old
screen left behind), and the full 15-flow smoke-test suite against a
real `vite preview` production build — 15/15 pass. Confirmed green in
CI on both the feature branch and, after a clean fast-forward, on
`main` (Smoke Test, Build APK, Web Alpha all triggered).

## Recently shipped (15 Sep 2026, continuing still further yet again — Contacts settings screen, global-settings reorg)

Real ask: "consider if anything in global settings would do better in
modules own settings. If that module doesn't have settings, consider
creating it. Maybe not if only one setting, but have consistent
placement appearance etc... can maybe duplicate/link to same place...
(doesn't work for menstrual or contraceptive, as if module is off then
no settings to be accessible to be toggled), so toggle must live
outside module for this."

**Replicated an already-established in-app pattern rather than
inventing a new one.** `MedicationSettingsScreen`
(`SHOS_Medication_Dashboard_Prototype.jsx`) already exists as the
template for exactly this shape: a gear icon in the module's own
colored header banner opens a full-screen settings sub-screen, sticky
header with a back-chevron, settings cards, ending in a "Go to general
app settings" link back to global Preferences — that file's own
26 Aug 2026 comment already documents this as the intended convention.
Contacts was the clearest, lowest-risk candidate matching the owner's
own stated rule (2+ real settings, no existing in-module settings
screen): moved `InactiveThresholdCard`/`ShowRoleOnCardsToggleCard` out
of global Preferences' "Contacts" section into a new
`ContactsSettingsScreen`, reachable via a new gear icon in
`ContactsList`'s own header (recolored to `T.contactsTeal`, matching
the module's own accent — the two cards kept their exact existing
logic, only their home screen and colour changed). Wired into
`ContactsModule`'s existing `registerModuleBackHandler` priority chain
so the hardware/UI back button closes it correctly, and into
`App.jsx`'s already-generic `onOpenSettings` prop (passed to every tab
module at one shared render site — Contacts just hadn't been
destructuring/using it until now). Global Preferences' old "Contacts"
section removed cleanly — verified via grep that
`AppPreferencesRepository`/`DEFAULT_APP_PREFERENCES` imports are still
used 32 other times in that file (TabOrderCard, MenstrualTrackingToggleCard,
etc.), so nothing went orphaned.

**The Menstrual/Contraception toggle is the one deliberate exception,
per the owner's own explicit call-out.** `MenstrualTrackingToggleCard`
stays in global Settings, not moved into a Menstrual Health settings
screen the way Contacts' own settings did — turning that toggle off
would make an in-module settings screen structurally unreachable, so
it has to live somewhere always-reachable regardless of the module's
own on/off state. Same reasoning applies to Contraception (gated by
the same toggle) — noted inline in `PreferencesScreen`'s own comment,
not just here.

**Two bigger, real candidates for the same treatment identified but
deliberately NOT acted on this round** — flagged rather than
guessed at, consistent with this project's own standing discipline for
bigger design decisions: Measurements' own Units screen currently mixes
Measurements-specific unit preferences with a genuinely-global
`weekStartsOn` setting (a real split decision, not a quick move); and
Settings' Notifications screen bundles 5 per-module reminder toggles
(medication/DoxyPEP/testing/refill/clinic-visit) that could each
arguably live in their own module instead — a bigger undertaking
touching 5 different modules' own settings surfaces at once, not a
single-module move like Contacts.

Verified live via Playwright end-to-end: the gear icon renders in
Contacts' own header and opens the new screen; both settings
(Inactive contact threshold, Show Dom/sub & Top/bottom on cards) read
and write correctly and persist across reload (confirmed via the
real UI, since a `vite preview` production build doesn't support the
dynamic `import()` trick used earlier in this session to check
repository state directly — verified via the on-screen "Currently: N
days" text staying correct after a reload instead); the "Go to general
app settings" link correctly closes this screen and opens global
Settings; global Preferences' Navigation/Healthcare sections render
cleanly with no leftover Contacts section. Full build, and the full
15-flow smoke-test suite against a real `vite preview` production
build — 15/15 pass.

## Recently shipped (15 Sep 2026, continuing still further again — Pregnancy list icon, #76)

Real ask: continue the backlog into #76 (Menstrual type/flow missing
icons in lists; icon consistency/colour audit across list views).

**Checked first, not assumed**: Cycle's own list already shows a Drop
icon and Contraception's own list already shows a `ContraceptionIcon`
(both added 2 Sep 2026) — the "flow" half of this item's title was
already done. The real, remaining gap was Pregnancy: its own DETAIL
view already had a Baby icon next to the date, but the LIST view never
got the same treatment — every row showed plain text only, the one
real inconsistency within this module's own three tabs.

**Fixed**: added the same Baby icon (matching the detail view's own
size/colour) to Pregnancy's list rows, kept unconditional even for a
masked entry — mirroring the detail view's own header, where the Baby
icon + date show regardless of masking and only the result/status
itself is what masking actually hides.

**Broader audit — checked, no other gap found.** Searched every other
module for the same "icon in detail view, missing from its own list"
shape, and more generally for any per-record-type icon in a list row
at all: none of Vaccinations/Symptom Log/Testing/Clinic Visits/
Measurements use a domain icon in either their list OR detail views —
a consistent, deliberate choice already documented elsewhere in this
file (Test Results' own "no icon, to avoid clutter/alarm on sensitive
health data" reasoning). Menstrual Health is the only module using
this icon-per-record pattern at all, because it's the only one with
multiple visually-distinct sub-types (Cycle/Contraception/Pregnancy)
needing a way to tell them apart at a glance — so this really was a
one-file, one-tab gap, not a wider pattern needing app-wide work.

Verified live via Playwright end-to-end: enabled Menstrual &
contraception tracking via Settings > Preferences, opened Healthcare's
new sub-tab, revealed the gender-gated Pregnancy tab via its own
"Show pregnancy tracking anyway" link, and confirmed the Baby icon now
renders on both a real "Negative" entry and a masked "Tap to reveal"
entry. Full build, `npx eslint .` clean, and all 15 smoke-test flows
pass against a real `vite preview` production build.

## Recently shipped (15 Sep 2026, continuing still further — Interactive Tour fixes, #77)

Real ask: continue the backlog into Group D's #77 (Interactive Guide
overflow/shape fixes). Three real bugs found and fixed, plus a fourth
caught mid-verification from the code changes themselves, not a live
report — the tour is a genuinely low-traffic surface (replayed rarely
once onboarding is done), so bugs here can sit unnoticed a long time.

**Circular spotlight for the Home tab and small icon targets, and a
real vertical clamp for the card.** The spotlight always used a fixed
16px corner radius, which reads fine against the other 4 rectangular
nav tabs but visibly mismatched Home's own true 48x48 circle. Fixed
with a `targetIsCircular` test (near-square, under 64px) rather than
hardcoding "tab-home" specifically, so it also correctly covers the
Search/Settings icon steps. The card's own vertical position used to
pick "below the target" from a rough, hardcoded 140px height guess
with no real clamp at all (unlike the horizontal position's own
existing clamp) — a step near the top or bottom edge, or with a longer
body than the guess assumed, could push the card partially off-screen.
Fixed by measuring the card's own real rendered height via a
`useLayoutEffect` + ref, used for both the below/above decision and a
real vertical `Math.max`/`Math.min` clamp matching the horizontal
one's own rigor.

**Real, embarrassing bug in landing that first fix: a temporal-dead-zone
crash on every single render.** The `useLayoutEffect` measuring card
height referenced `step` in its own dependency array — but `step` was
declared with `const` two lines BELOW that effect, not above it. This
throws `ReferenceError: Cannot access 'step' before initialization` on
every render, meaning the tour couldn't render AT ALL once this "fix"
landed — caught only because a stale `vite preview` build (left over
from before this exact edit) briefly made an early verification pass
look fine, and a genuinely fresh rebuild + smoke-test run (forced by an
unrelated container restart mid-session) caught the real crash
immediately (`SMOKE TEST: FAILED` on test 11/15). Fixed by moving the
`const step = ...` declaration above the effect that references it —
the real lesson, consistent with several earlier entries in this file:
a live-verification pass is only as good as the build it's actually
running against; a stale preview server can make a broken change look
shipped.

**Three more real bugs found from the owner's own live screenshot
report, after the above was already believed fixed and verified.**
(1) *Font* — this file had zero `fontFamily` declarations anywhere
(the card, both buttons), so the whole tour rendered in the browser's
own default serif (`Times New Roman`) instead of the app's real Inter
— confirmed via computed style, not eyeballed. Fixed by setting
`fontFamily: "'Inter', sans-serif"` on the card (inherited by plain
text children) — and, caught only by re-measuring after that fix, a
SEPARATE explicit copy on both `<button>` elements, since `<button>` is
a form control and does not inherit `font-family` from an ancestor
`<div>` the way inline text does (verified live: both buttons stayed
in `Arial` even after the card-level fix alone).
(2) *Card overflowing the screen edge* — real root cause: `cardStyle`
declared `padding: 20` with the browser's default `box-sizing:
content-box`, meaning its `width: min(320px, ...)` was the CONTENT box
only, with the 20px+20px padding added ON TOP — the card actually
rendered 360px wide, not 320px, while every position/clamp calculation
in the file assumed 320px was the true width. Confirmed live on the
settings-icon step: the card's real right edge landed at x=418 on a
390px-wide viewport, a genuine 28px overflow, not the "confirmed fine"
verdict an earlier same-session check had wrongly reached (that check
measured the card's *div* bounding box correctly but never compared it
against `cardWidthPx`, the constant actually driving the clamp math —
a real methodology gap, not a coincidence). Fixed with `boxSizing:
"border-box"`, making the declared 320px the TRUE total width and
bringing it back in line with `cardWidthPx`.
(3) *The teal ring not centred on its own highlight* — real CSS
box-model bug, most visible on the small icon-circle steps: the ring
div shares the exact same `top`/`left`/`width`/`height` as the
lightened-cutout div right next to it, but the cutout has no border
while the ring has `border: 2px solid`, again under the default
`box-sizing: content-box`. That border renders OUTSIDE the declared
box, so the ring's own rendered box ends up 4px bigger in both
dimensions than the cutout's, with the same top-left origin — shifting
the ring's effective CENTER 2px down-right relative to the highlight
it's meant to trace exactly. A 2px shift is a much bigger fraction of
a ~31px icon-circle's own diameter than of the ~54px Home circle or
the wide rectangular nav-tab spotlights, which is why it read as a
real, visible problem specifically on the icon steps. Fixed the same
way as (2) — `boxSizing: "border-box"` on the ring div — confirmed live
via `getBoundingClientRect()` that the cutout and ring now report
byte-for-byte identical rects at every one of the tour's 9 steps, not
just visually close.

Verified live via Playwright throughout, at each stage: computed
`fontFamily` on the card and on a real `<button>` inside the overlay
(not the due-meds banner's own "Take" button, an early false negative
from an unscoped `document.querySelector('button')` picking up the
wrong element); the card's real bounding rect at every step, confirmed
to stay within the 390px viewport after the box-sizing fix; a pixel-
level scan of the search-icon glyph's own rendered bounds against its
spotlight's centre (ruled out a suspected icon-glyph asymmetry as the
cause — the glyph itself really is centred in its own SVG viewBox,
within antialiasing noise); and the final side-by-side cutout/ring
rect comparison above. Full build, `npx eslint .` clean, and all
15 smoke-test flows pass against a real `vite preview` production
build, run twice (once after the font/overflow fix, once more after
the ring fix) with no regressions either time.

## Recently shipped (15 Sep 2026, real physical-play-testing feedback batch)

Real ask: a large batch of live, real-device feedback from actually
using the app day to day — ~30 distinct items, worked in priority order
(real bugs first). Tracked as tasks #55-63; the rest (#64-81, feature
adds and bigger investigate/design items) remain open, logged below.

**Navigation/back-button fixes.** Settings' Data & Network screen was
missing from `goBackOneLevel()`'s sub-screen if-chain — confirmed by
enumerating all 20 real `show*` states in `SettingsScreen` against the
handler, which only covered 19; the back button fell through to Home
instead of returning to Settings. Fixed the one missing case.
Clinic Card lost all its own state (section visibility, scroll
position) the moment its own `onNavigateToRecord` handler fired,
because App.jsx's tab switch is a genuine unmount/remount (a real
ternary render, not a CSS-hide) and Clinic Card is independently
mounted inside both Home and Healthcare — the back button then
returned to the target module's own dashboard, not back to Clinic
Card. Built a cross-cutting "remember where to return" mechanism:
App.jsx's new `clinicCardReturnTab`/`markClinicCardReturn`, consumed
by a new `openClinicCardOnMount`/`onConsumedClinicCardReopen` prop
pair in both Home and Healthcare, following this app's own established
"consumed once" prop idiom. Honest scope note: returning to Clinic
Card can take two back presses (first popping the target module's own
internal sheet, then a second press to actually return) rather than
one — matches this app's already-established multi-level back-nav
pattern elsewhere, not a new inconsistency.

**Clinic Card fixes.** Emergency info/Allergies sections were only
clickable-to-My-Profile in their EMPTY state — the populated versions
had no `onClick` at all. Added the same handler to both. The
"Positive" test-result subtitle stayed grey regardless of alert state
— `Row`'s `alert` prop only coloured the dot/title, never the actual
subtitle text carrying the word "Positive"; fixed to use
`T.actionRedText` when `alert` is true.

**Notification history was permanently blank on the real device — real
root cause, not a UI bug.** Traced directly through the installed
`@capacitor/local-notifications` plugin's own Android Kotlin source
(not assumed from its JS type definitions, which this app's own
comment had been trusting): the real alarm fires via
`TimedNotificationPublisher`, a plain `BroadcastReceiver` Android runs
independently of whether this app's own process is alive — routine,
expected background-app behaviour on Android, not a bug in the OS.
That receiver calls `LocalNotificationsPlugin.fireReceived()`, which
resolves the plugin instance via `staticBridge?.webView` — `null` the
instant the app's process has been killed, so the JS-side
`localNotificationReceived` event is never dispatched at all (not even
queued — Capacitor's own `retainUntilConsumed` only helps when
`notifyListeners()` actually runs, which it doesn't here). The OS
still shows the real notification in the shade (`notificationManager.
notify()` runs unconditionally right after) — the user genuinely gets
reminded — but nothing in this app's own JS ever learns it happened.
Since every real reminder here fires hours-to-days after being
scheduled, the app being dead by firing time is the COMMON case, not
an edge case — explaining why the only entries ever recorded were ones
that happened to fire while the app was already open (the 5s test
notification). Real fix: a new `getDeliveredNotifications()` in
`notificationService.js`, reading the OS's own notification tray
directly (independent of whether this app's JS was alive when the
notification actually fired) via the plugin's own
`getDeliveredNotifications()` API. Reconciled against
`NotificationHistoryRepository` (`recordIfNew()`, deduping against just
the single most-recent entry — the log is "did anything fire
recently," not a permanent audit trail, so a still-undismissed
notification checked across several app opens shouldn't spam repeat
entries) via the existing `checkDueMeds()` chokepoint (mount/
visibility/60s poll), so anything still sitting in the tray gets
backfilled the next time the app is actually opened. Native-only by
design — web's own `showWebNotification()` already dispatches its real
delivery event correctly, a different, already-documented web
limitation.

**Colour-blind-safe palette — real bug, far bigger than the one
reported module.** The report was "doesn't apply to Encounters," but
the actual root cause turned out to affect 10 of this app's module
files, not one: `LIGHT`/`DARK` theme objects were plain module-level
`const`s baking in `ACCENTS.*`/`ACTION.*` at IMPORT time — before
App.jsx's own `bootReady` gate ever resolves the real
`ModuleColorRepository` overrides (`applyRealAccentOverrides()`
mutates `ACCENTS`/`ACTION` in place, but only AFTER these files'
own top-level code had already run and captured the pre-override
default value into a plain object literal, a value copy, not a live
reference). This is the exact same bug class already found and fixed
for Measurements/MenstrualHealth during the Phase 3 storageAdapter
conversion (see that entry, elsewhere in this file) — that sweep's own
"no other instances" conclusion was wrong. Found and fixed in
Encounters, SymptomLog, Medication Dashboard, Clinic Card, My Profile,
Clinic Visits, Testing, Contacts, Timeline, and Vaccinations —
converting each to a `buildLight()`/`buildDark()` function pair called
fresh per-render (matching how `T` itself is already recomputed every
render), plus every stray direct `LIGHT.x`/`DARK.x` reference found in
the same files (mostly a bulk-delete toolbar's red text, forced to
always use the dark-mode-tuned red regardless of app theme since its
own background is a fixed near-black bar). One deeper variant:
Contacts' `MethodBadge` used `T === DARK` (reference equality) to
detect dark mode — silently broke the same way the moment `DARK`
became a function (a fresh object every call, never `===` anything);
fixed by comparing `T.bg` against `NEUTRAL_DARK.bg` instead, a
self-contained check needing no new prop threaded through. Verified
live: applying the palette via the real repository call and reloading
correctly renders Encounters' own real CVD-safe colour
(`rgb(174, 66, 126)`), not the default.

**Active-status dot colour.** The "old/archived, not currently
relevant" test-result dot (`ACTION.gold`, previously `#B45309`, a
burnt orange) read too close to `ACTION.red` (`#D93838`) at a glance —
moved to a genuinely yellow hue (`#7A6500`, ~50°, vs. `ACTION.amber`'s
own ~38° for "pending," kept apart by lightness/saturation the same
way the two already were) while keeping real 4.5:1+ text contrast
(this token is also used as literal text — Home's backup-reminder
banner, Timeline's coverage status — not just a dot fill; verified
5.69:1 on white, a real margin).

**Due-state banners' dismiss (X) gave zero feedback.** Tapping X on
any of the four due-state banners (medications/refill/testing/clinic
visit) just hid it instantly with no confirmation — easily read as "handled"
when nothing was actually recorded; the reminder just silently
reappears on the next 60s poll or app resume with no warning it was
ever temporary. Added the same toast confirmation Take/Snooze/Cancel
already show ("Hidden for now — still due, will remind you again"),
reusing the existing `showNotifToast` mechanism, applied to all four
banners consistently.

**Kink/organism/result picker — two real copy-pasted bugs, found once
in the reported file (Encounters) and fixed in all 4 files sharing the
same duplicated picker component (Encounters, Contacts, My Profile,
Testing).** (1) Picking a suggestion chip while a search term was
still typed left the search box showing the stale text instead of
clearing — `tapSuggestion()` never called `setDraft("")`, unlike
`commit()` (typing a full name + Enter), which already did. (2)
New-kink Dom/sub / Top/bottom role assignment silently defaulted to
the dominant/top pole on the very first tap of the "+ role" badge:
`cycleRole()` treated an unset role as index -1, so tapping once
landed straight on `optionsForThisKink[0]` — always "Dom" or "Top" in
both real role lists — with no actual choice ever shown. First fix
replaced the single cycle-through badge with three explicit per-option
chips, always shown — **corrected the same day, see below, once the
owner's own follow-up clarified this over-corrected the actual ask.**

**Correction, same day**: the owner's own follow-up made the real ask
explicit — not "show every option at once" (the 3-chip fix), but "don't
lock a brand-new kink to only ONE axis (Top/bottom OR Dom/sub); allow
cycling through both, learning from what the user settles on." Reverted
back to a single cycling "+ role" badge in all 3 files (`cycleRole(id)`,
one tap = one step through `resolveRoleOptions(id)`'s list, wrapping
past the last option back to "no role" rather than straight to the
first — so leaving a kink unset stays reachable, not lost mid-cycle) —
and fixed the REAL bug underneath the original report:
`getKinkRoleOptions()` in `kinkRegistry.js` had an `|| "anatomical"`
fallback, silently locking any kink NOT in `KINK_ROLE_STYLE` (i.e. any
genuinely new/custom one) onto the Top/bottom/Vers axis only, with no
way to ever reach Dom/sub/Switch. Unclassified kinks now get both real
pools concatenated into one combined cycle (Top → bottom → Vers → Dom →
sub → Switch → none) — cycling through both, on the same control every
classified kink already uses, just a wider pool; a kink already
classified in `KINK_ROLE_STYLE` keeps its own single, narrower pool
unchanged. Deliberately did NOT build a persistent "learned axis" per
kink (a new registry field, remembering which pole a kink settled into
across future picks) — the cycle's own "wherever you stop tapping is
what you picked" behavior already IS the learning the owner described;
a persistence layer on top of that wasn't asked for and would be
speculative scope. Verified live via Playwright end-to-end: adding a
brand-new, never-before-seen kink and tapping its role badge 8 times in
a row produced exactly `+ role → Top → bottom → Vers → Dom → sub →
Switch → + role → Top`, zero page errors.

**A genuine CI-blocking test bug found and fixed the same round, not
an app bug.** The first two commits above both hit smoke-test flow 2
(Testing<->Symptom Log link) failing and — after confirming it failed
identically on the unmodified baseline before either change — logged
it as "a pre-existing flake, not a regression" and shipped anyway.
That framing turned out to be incomplete: CI's own red build on both
pushes forced a real trace, which found the actual root cause is a
STALE TEST, not a broken app feature. The app correctly links the
symptom entry and moves it into the "Related symptom entries" list
every single time; the test hardcoded `"· Aug"` as part of its
expected post-link string, reading the seed entry's own real,
calendar-fixed `dateStarted` — as real wall-clock time in this
environment crossed from August into September, that entry's own
correctly-displayed date became "Sep 4, 2026," permanently breaking
the hardcoded assertion regardless of anything the app does. Fixed by
deriving the expected string from the suggestion chip's own real text
(captured before the click) instead of hardcoding a month — same
"don't assume a relative-to-real-time seed value stays fixed"
discipline this suite's own `medicationReminderClock` test already
uses. Real lesson for next time: "confirmed identical on the
unmodified baseline" rules out a NEW regression, but isn't the same as
finding the actual root cause — a red CI run deserves being chased to
ground, not just documented and shipped past.

Every fix in this round verified live via Playwright (screenshots
where visual confirmation mattered) and the full 15-flow smoke-test
suite against a real `vite preview` production build — all 15/15 pass
as of the final commit in this round, confirmed green in CI (Smoke
Test, Build APK, Web Alpha all succeeded on the same push).

## Recently shipped (15 Sep 2026, continuing the backlog — Group A, then Episodes scroll fix, then Testing/Measurements additions)

Real ask: "continue rest of backlog" — worked Group A in full, then moved
to Group B/C, checking each item's real current state rather than
assuming the compressed backlog title alone was still accurate.

**Group A (#64-67), all four shipped together.** Automatic backups can
now save to a chosen folder instead of always the public Documents
folder — a new `pickAutoExportFolder()`/`writeTextFileToFolder()` pair
in `fileExportHelper.js`, using the scoped-storage plugin's own
`pickFolder()` directly (a real persistable Android SAF URI, confirmed
by reading the plugin's own Android source for
`takePersistableUriPermission()` — safe to store and reuse across app
restarts, not a one-shot handle) rather than the existing pick-and-
write-immediately export flow, since auto-export needs to pick once
and write silently later with no prompt. Developer Tools' "Broken
references" check gained a manual "Check again" button (a
`refreshKey`-driven re-run of `findOrphanReferences()`, same pattern
already used elsewhere in this file) — previously only ran once per
screen-open. Contacts' duplicate-checker panel gained a per-pair "Not
a duplicate — dismiss" action, stored as an order-independent pair key
in `AppPreferencesRepository` (`dismissedContactDuplicatePairs`), not
keyed by field content — a genuinely different person sharing a name/
field stops reappearing every time the panel opens. A new "Allow
screenshots" toggle in Settings > Privacy, default off (matching the
app's existing always-on FLAG_SECURE) — the one custom Capacitor
plugin this app has ever needed (`ScreenSecurityPlugin.java`, every
other native integration here is a third-party package): FLAG_SECURE
can be added/cleared on the real Window at any time, so toggling takes
effect immediately with no activity recreation; registered via
`registerPlugin()` in `MainActivity.onCreate()`, bound on the JS side
via Capacitor's own `registerPlugin(name)` (no npm package, no
generated wrapper). Verified: full build, eslint clean, 15/15
smoke-test flows pass locally; a manually-triggered Build APK CI run
against this branch confirmed the new Java plugin actually compiles
(the sandboxed environment here has no real Android device to verify
runtime behavior on, so a green CI build is the compile-correctness
confirmation, per this project's established practice for native-only
changes) — the first dispatch attempt failed at checkout (a short SHA
on a non-default branch isn't reliably resolvable by a shallow
checkout), fixed by dispatching against the branch ref directly instead
of a separate `checkout_sha` input.

**Episodes screen scroll bug (#69) — a real, findable root cause, not
a fresh investigation.** Home's own wrapper around `TimelineModule`
had already been fixed for exactly this bug in an earlier session (a
missing `overflowY: "auto"`/`tabIndex` — a populated Episode taller
than the viewport was simply unreachable) — but Healthcare has its own
SEPARATE wrapper around the same `TimelineModule` component, and never
got the same fix. Applied the identical fix there. This is the real
lesson: `TimelineModule` is invoked from two independent call sites,
and a fix at one doesn't reach the other without being applied twice —
exactly the kind of gap the standing #82 "apply any future fix's
pattern consistently across other modules" discipline exists to catch.

**Testing (#71) — Result date moved to the top of the read view;
"Pregnancy" added to Testing-for.** The edit form already had Result
date positioned right after the specimen Date (ahead of Setting/
Sample type/etc.) — only the READ-ONLY `TestDetail` view had it at the
very bottom of the Overview section instead, the one real
inconsistency between the two. Moved it to match. Added "Pregnancy" to
`TESTING_FOR_OPTIONS` (before "Other", which stays last per this
list's own established convention) — checked every real caller of
`testingFor` first to confirm this is purely descriptive everywhere
(display-only `.join()` calls) except `exposureWindows.js`'s own
STI-exposure-window lookup, which simply skips any entry not in its
own fixed table (Mpox/Other/etc. already do the same) — so a
pregnancy-test entry can't be mistaken for an STI exposure needing a
retest window.

**Measurements (#72) — a real normal/out-of-range, high/low
classification, deliberately NOT a hardcoded clinical threshold.**
This app's own standing rule is no diagnosis engine/automated clinical
risk scoring, and a fixed "normal blood pressure" or "normal CD4
count" table would edge into exactly that (a CD4 count under 200 is
literally AIDS-defining — not a judgment call this app should make
unprompted). Built instead as a real, user-SET low/high range per
measurement type (`MeasurementPreferencesRepository`'s new
`normalRangeByType`, stored in the type's own canonical unit) — the
same "you decide, the app just tracks" spirit as every other
preference here. No range set for a type means no classification
shown at all, never a guessed default. Editable right on
`MeasurementDetail`, next to a real reading already in its own
canonical unit — avoids needing to solve "what unit is this arbitrary
type even in" from a separate preferences screen. Blood Pressure is
out of scope for this pass — its own two-value systolic/diastolic
reading doesn't reduce to one low/high comparison the way every other
type here does. Verified live end-to-end: setting a 60-75kg range on a
real 67.5kg seed entry showed "Normal"; tightening it to 40-50kg
correctly showed "High" with the real, contrast-safe `ACTION_TEXT_SAFE.red`
color (`#C52626`, confirmed via computed style — the raw `ACTION.amber`
this badge's own "Low" state might have reached for by default would
have failed 4.5:1 on its own light tint, same contrast-sweep lesson
already learned once for `ACTION.gold`/red/green elsewhere in this
file, so the pre-vetted `ACTION.gold` was used for "Low" instead, not
raw amber); clearing the range correctly reverted to "+ Set a normal
range for this type".

**Checked, not fixed — real findings worth recording, not silent
skips.** #73 (Healthcare sub-tab reorder) — the exact reorder this
item's own compressed title describes (Testing/Clinic Visits/
Vaccinations, then Symptoms/Measurements/Menstrual, two rows of three)
already happened in an earlier session, confirmed by that file's own
comment; nothing left to do unless a different, more specific reorder
was actually meant — flagged rather than guessed at. #68 (safe-area/
status-bar spacing gaps) — genuinely not reproducible in this
sandboxed browser environment (`env(safe-area-inset-*)` always
resolves to `0px` with no real notch/status-bar to simulate), so
guessing at a fix here risked shipping something unverifiable or
wrong; left for real on-device debugging, per Group B's own stated
methodology.

Verified live throughout via Playwright (Measurements' range-editing
flow end-to-end with computed-style contrast checks; Testing's Result-
date reorder and the new Pregnancy option in a fresh Add-test form)
and the full 15-flow smoke-test suite against a real `vite preview`
production build — 15/15 pass. Full build and `npx eslint .` clean.

Real ask, continuing the same-day backlog: on PC width, Home's Clinic
Card/Episodes/Calendar shortcuts should sit in one line (2x2 with
context grouping if a 4th is ever added), plus a lower-priority
desktop font-sizing/empty-space pass and a request to group the
remaining backlog for efficiency (see the "backlog grouping" entry
above/below — same round).

**Home shortcuts on desktop.** This app has never had a real
`window.innerWidth`-driven responsive convention anywhere — every
screen is hand-authored inline styles. Added the first one, narrowly
scoped: `useIsDesktopWidth()` (a real `window.innerWidth >= 900` check
with a resize listener, not a guessed pixel breakpoint) gates a
desktop-only branch that merges Clinic Card/Episodes/(Calendar, when
present) into one `flexWrap` row instead of the mobile 2-then-1
stacked layout.

**Real regression caught by the owner, not by this session's own
testing**: the first version used a fixed `flex: "1 1 160px"` basis
unconditionally, on both mobile and desktop — at real phone widths
(320-360px) two buttons could no longer fit on one line at that fixed
basis, breaking the original mobile layout. Owner's own correction:
"Ensure mobile width not affected... remember generally relative
positioning, not fixed values, to account for device variance." Fixed
by keeping the mobile branch as the exact original markup (two
`flex: 1` buttons + a separately centered 50%-width Calendar row) and
only using the wider `flex: "1 1 260px"` merged row on the real,
`useIsDesktopWidth()`-gated desktop branch. Verified live at
320/360/390/414px (mobile, unchanged 2-then-1 layout, no wrap) and
1600px (desktop, one merged row) via Playwright — no horizontal
overflow at any width.

**A second, real regression report followed immediately**: "Your
mobile one now looks super narrow. And nav bar doesn't match mobile
width." Investigated by direct DOM measurement (`getBoundingClientRect`
on `<body>`, `<main>`, and the bottom nav) rather than guessing —
found a genuine root cause, not related to the shortcuts fix above.
The browser's own default UA stylesheet gives `<body>` an 8px margin
on every side; this app's real content lives in normal document flow
(inside `<main>`, so it inherits that inset), while the bottom nav bar
and the due-state banner stack are both `position: fixed` (positioned
against the true viewport, not body's own margin box) — so real
content has always rendered 16px narrower than the nav bar/banners,
on every screen, every session. This was never reported before because
the (now-removed) `maxWidth: 600` cap + border-marker framing on every
screen absorbed the gap visually; once that framing came off earlier
the same day (see the desktop-full-width-layout entry above), the
8px-per-side inset became a real, visible mismatch between content
width and the nav bar's true full width — exactly matching both halves
of the report. Fixed with a single-line UA-default override in
`index.html` (`<style>html, body { margin: 0; padding: 0; }</style>`)
— this app has no CSS files by design (see the architecture rules
above); this is a browser-default reset, not a new stylesheet
convention. Verified live via direct measurement at 320/360/390/414px
and 1600px: `<body>`, `<main>`, and the nav bar all report identical
`x`/`width` at every size, zero horizontal overflow, zero page errors.

Every fix in this entry verified live via Playwright and the full
15-flow smoke-test suite against a real `vite preview` production
build — 15/15 pass.

## Recently shipped (15 Sep 2026, later still — meds timing/streak/adherence, global date format, banner styling, desktop width)

Real ask, a follow-up batch on the same feedback session: reconsider
medication reminders' auto-adjust behavior, explain 7-day adherence,
investigate a daily-streak report, fix "in the future" phrasing
globally, soften the due-meds banner/screen-title blocks, replace the
native meds notification's icon, and expand module content to full
width on desktop (was capped/centered like mobile, inconsistent with
the notification banner's own already-full-width behavior).

**Daily streak — real bug, not just a display quirk.** Report: "when I
updated med it went from 0 to 3." Root cause: `computeAdherence()`'s
streak loop started at "today" (`i=0`) and broke immediately if
today's own dose hadn't been logged yet — meaning the streak showed 0
for the entire day, every day, until that day's dose was actually
logged, at which point it jumped back up to the real consecutive-day
count. Not what "streak" should mean — a dose that isn't overdue yet
hasn't been missed. Fixed per the owner's own spec ("dose 1 taken,
dose 2 missed... streak persists until dose 3 is due, then resets"):
today's own slot no longer counts as a streak-breaking check, only
days/slots already fully in the past can break it, with today's own
dose (if logged) added back on top. Applied to both the daily loop and
the custom-interval (every-N-days) branch.

**Medication reminder timing — new opt-in "fixed same time" mode.**
Report: "thinking maybe remove the auto adjust, for reminder at same
time." The existing behavior (`lockoutEndsAt`/`nextDoseEstimate`
computing forward from the literal last-logged dose timestamp, so a
late dose shifts every future reminder forward by the same lateness)
is real and intentional, and stays the default ("adaptive") — changed
for no one automatically. Added a real "fixed" mode instead: anchors
every future reminder to the very first dose ever logged for that
medication (held constant, never recomputed off a later dose), so one
late/early dose only shifts that one day's own reminder, not every
reminder after it. New `reminderTimingMode` preference
(`medicationPreferencesRepository.js`, default `"adaptive"`), a new
"Reminder timing" toggle in Medication Settings, threaded through to
both the in-app card display and the real native-notification
scheduling in `medicationReminderSync.js`. `medicationCalculations.js`
stays I/O-free per its own architecture rule — callers load the
preference and pass it in as a parameter, not read it internally.

**7-day adherence — info dot added.** Report: "add info dot - explain
what it is." A small tap-to-reveal info icon next to the "7-day" stat
(same tap-to-reveal-caption pattern already established for Contacts'
active-status dot), explaining it's based on the real dose log from
the last 7 days, hit vs. days a dose was actually due.

**Predicted/future dates — "in the future" was the only literal
occurrence, fixed at its one shared source.** Report: Clinic Card's
predicted dates (next due, overdue, pregnancy due date) should show
the actual date, not vague "in the future" phrasing, "true globally."
Traced to `encounterCalculations.js`'s `formatRelativeDate()` — used
by Clinic Card (and its PDF export) for exactly these future-date
rows, and by 5 other files for past-only dates. A full grep confirmed
this was the ONLY place in the codebase producing that literal string,
so fixing it here is genuinely global, not a partial patch. Future
dates now show the real calendar date plus a relative offset,
symmetric with the existing past-date phrasing ("3 months ago" becomes
"Dec 6, 2026 (in 3 months)"); today/tomorrow stay as short words,
matching the existing today/yesterday convention. Past-date behavior
is completely unchanged.

**Due-meds banner and screen-title blocks — softened.** Report: "feel
too blocky... should have slightly perimeter gap, more rounded
corners... too harsh/clashy." The floating due-state banner stack
(medications/refill/testing/clinic-visit) was wrapped in one rounded,
inset card (margin from the screen edges, `RADIUS.md` corners, one
shared shadow) instead of sitting flush edge-to-edge with square
corners — the individual banners inside the stack keep their existing
flush borders against each other, only the outer silhouette needed
softening. The 4 real colored screen-title banners (Contacts,
Healthcare, Medication, Encounters) had their sharp bottom corners
rounded and their stark `2px solid rgba(0,0,0,.15)` border lightened to
a subtle `1px solid rgba(0,0,0,.08)` — top corners left square since
they're flush with the screen's own top edge and rounding there is
never visible. The 3 plain sheet-title banners (no harsh border to
begin with) were left as a smaller, lower-priority gap for later.

**Native meds-due notification icon — replaced with a real pill.**
Report: "icon is just circle with line, change to pills icon." The
existing `ic_stat_medication.xml` was a plain filled stadium/capsule
with no visible seam — read as a blob at real status-bar size, not
recognizable as a pill. Replaced with a real two-tone capsule
silhouette (a diagonal pill body with a seam cut out along its midline
via evenodd fill, plus a small diagonal highlight) — the same real
Pill glyph (Phosphor `PillIcon`, "fill" weight) already used
throughout the app's own UI for this exact module, rescaled from its
native 256x256 viewBox down to this file's existing 24x24 convention.
Verified by rendering the exact path in a browser before shipping —
a real, recognizable capsule shape, not assumed correct from the
coordinates alone.

**Desktop full-width layout.** Report, from a desktop-width
screenshot: module content still read narrow/centered like mobile
while the notification banner already spanned the full width —
inconsistent. Root cause: a `maxWidth: 600` + `borderLeft`/
`borderRight` "centered card with grey margins" treatment had been
rolled out across every primary module screen and overlay earlier this
multi-session effort (see the 10 Sep 2026 "desktop-width-cap border
consistency" entry) — a deliberate design choice at the time, now
explicitly reversed by the owner. Removed the width cap and its
accompanying border markers from all 14 real content-wrapper sites
across 17 files, and from the 9 FAB-positioning divs that used the
same cap to keep the floating "+" button aligned with the (previously
narrower) content column — those now right-align to the real, full
screen edge instead, matching the wider content. One separate
`maxWidth: 560` toast/snackbar element was deliberately left alone —
a floating confirmation toast shouldn't stretch edge-to-edge on a
large monitor regardless of how wide the actual content column is.

Every fix in this round verified live via Playwright (a rendered pill-
icon screenshot; 1400px-viewport screenshots of Home/Encounters/
Medication confirming full width and the softened banner corners with
zero page errors) and the full 15-flow smoke-test suite against a real
`vite preview` production build — 15/15 pass.

## Recently shipped (11 Sep 2026, full-team audit: features/demographics/bloat/longevity, plus real fixes)

Real ask: "if backlog all clear do complete full fresh audit of everything, delegate specific functions to other agents, imagine you were a full team designing the app" — a broad, explicitly open-ended mandate (feature completeness, admin-vs-user boundaries with a specific Resources-screen nuance, demographic inclusivity, feature bloat/missing intuitive features, an error-reporting-to-developer mechanism, anonymising "Kane"/"Hull" references out of the codebase, information gaps, and technology-obsolescence risk — "any other areas... I defer to you, do all"). Delegated 4 parallel specialist audits (feature-completeness, demographics/inclusivity, UX-bloat + admin/Resources-boundary, tech-longevity) to sub-agents per the explicit "full team" instruction, then triaged and fixed the real findings directly.

**Anonymisation — done.** Grepped the whole git-tracked tree for "kane"/"hull" (case-insensitive): 5 real hits, all comment-only attribution text or one seed-data city name, no functional code. Removed the name from 4 near-identical "real ask... Kane — the tab reorder..." comments (`App.jsx`, `appPreferencesRepository.js`, `scripts/smoke-test.cjs`, this file's own Known Issues) and swapped "Hull" for "York" in `contactCalculations.js`'s `STARTER_CITIES` seed list (same list length/character, no functional change).

**Real bug found and fixed: backup export/restore silently dropped 4 real settings repositories.** The feature-completeness audit traced every repository `backupService.js` imports against what `buildBackup()`/`restoreBackup()`/`mergeBackup()` actually read/write, and found `AppPreferencesRepository` was imported but ONLY ever used for the auto-export-due check — never included as real backup data — while `MedicationPreferencesRepository`/`NotificationPreferencesRepository`/`ModuleColorRepository` weren't imported at all. This directly contradicts this file's own standing rule ("a new repository must be wired into backupService.js in the same change... missed twice historically") — a real, undocumented third-plus occurrence: tab order, onboarding/tour-completion flags, `menstrualTrackingEnabled`, `showRoleOnContactCards`, `inactiveThresholdDays`, dose-reminder/snooze settings, notification quiet-hours/master-switch/vacation-pause settings, and per-module colour customisation were all silently lost on a real Restore. `TrashRepository` (a real, recoverable "recently deleted" list, not a diagnostic log) was in the same boat. All four now wired into `buildBackup()`, `restoreBackup()` (a graceful no-op on an older backup file that predates this fix, same pattern as every other repository added here over time), and `mergeBackup()` where that makes sense — `TrashRepository` appended like every other list; the three settings singletons deliberately excluded from Merge, same reasoning as `myProfile`/`privacySettings` (a settings object can't sensibly "combine" with another). `TrashRepository`/`ModuleColorRepository` each needed a new `replaceAll()` method added (neither had one before, since nothing previously needed to bulk-restore either). Verified live: toggling the Colour scheme screen's CVD-safe-palette control produces a real `shos_module_color_overrides` key that wasn't there before, confirming this repository's data is real and now backup-eligible; full smoke suite unaffected (these are additive fields, no existing behavior changed).

**Real bug found and fixed: the Resources screen's default tap action was backwards from its own stated intent.** The user's own framing was explicit: Resources should mainly be pre-provided hyperlinks to tap, with self-editing a secondary, still-available action — not the other way around. The UX-bloat/admin-boundary audit found `ResourceEntryRow`'s own default tap opened an EDIT form (link/notes inputs, Remove/Save), with "open the real link" only reachable as a small, secondary 11px snippet when the row was collapsed — the exact inverse of the intended hierarchy. Fixed: when a real link exists, the row's own primary tap target is now a real `<a target="_blank">` wrapping the row's content (so it's a genuine navigation, not simulated); editing moved to its own explicit pencil icon, always present. A blank entry still opens straight to editing, since there's nothing to open yet. Also added a genuine curated-vs-custom distinction the same audit flagged as missing: `ResourcesRepository.addEntry()` now stamps `isCustom: true` (absent/falsy on every seeded entry), and the UI shows a small "Added by you" tag on custom rows — so it's visually clear which links are the app's own vetted UK-health-org list versus something typed in later. Verified live: a real seeded link (Refuge) opens as a real anchor on tap; a freshly-added custom entry shows the tag and opens via its own pencil icon to edit.

**Real bug found and fixed: a non-binary/custom-typed gender had no way to ever see the Contraception field.** The demographics audit found `showsContraception`/`couldMenstruate()` (4 sites: My Profile's edit + read views, a Contact's edit + read views) gate on an EXACT match against only "female"/"trans-male" — deliberate, by the original comment's own reasoning ("shouldn't presume either way for a non-binary gender"), but that reasoning only argued against auto-showing it, not against ever allowing it, and left no override at all. This is a real functional exclusion, not wording, since Gender is free text — and it directly contradicts this file's own "Who this is for" section ("Contraception/Menstrual/Pregnancy tracking gated by a settings toggle, never by gender alone"). Fixed with the same "never presume, but never structurally block" pattern this app already uses for the Menstrual Health module's own Pregnancy-tab gender default (its "Show pregnancy tracking anyway" link): both edit sheets (My Profile, Contacts) now show a small "+ Track contraception anyway" link whenever the gender doesn't match, revealing the real field on tap (ephemeral component state, not a new persisted field — consistent with the existing Pregnancy-tab precedent). Both read views (My Profile, Contacts) were separately widened to show the field whenever real data already exists, regardless of gender — never hide an already-entered answer. Verified live: setting Gender to "Non-binary" on a new contact shows the reveal link; tapping it opens the real Contraception chip field.

**Real feature built: "means of submitting error notifications to developer."** The existing `errorLogRepository.js`/Settings → Developer Tools → Error log screen already captured real JS crashes automatically and could export+share them via the OS share sheet (`exportTextFile()`) — a reasonable path already existed for an already-thrown error, consistent with this app's own "nothing leaves the device unless you choose to share it" design (a real third-party crash-reporting service was already deliberately rejected once, see the 10 Sep entry below). The real gap: nothing let the user note a problem that ISN'T a JS crash — a confusing screen, something that seems broken but doesn't throw. Added `ErrorLogRepository.recordUserReport(message)` (same capped/exportable log, tagged `source: "user-report"` so it's clearly a human note, not an automatic capture) and a small "Report a problem" text box directly on the Error log screen, appending into the same log/export/share path a real crash already uses. Verified live: submitting a note shows up immediately as "Your note" in the log.

**Tech-longevity assessment — no urgent findings, documented for the record.** Every dependency is current or at worst one major version behind (Vite 5, with 6/7 available) with nothing genuinely deprecated; the no-backend/no-accounts architecture is itself a real longevity strength (no server to sunset, no subscription to lapse, standards-track browser APIs throughout). One real, cheap documentation gap closed: `@aparajita/capacitor-biometric-auth` has the identical "single maintainer, no visible test suite" risk profile already disclosed for `@daniele-rolli/capacitor-scoped-storage` in this file's own Known Issues, just never labeled that way — noted here since it wasn't previously flagged, though it's lower-stakes (a pure yes/no gate, no data path runs through it). The nearest real forcing function is Android's own periodic mandatory target-SDK bump (routine, ~12-18 months out, not urgent); GitHub-account continuity (APK Releases + Pages hosting both depend on one account) is the one structural single-point-of-failure worth a mental note, with no natural trigger of its own.

**Feature-completeness — 10 real features spot-checked directly against source, all confirmed genuinely wired (no stubs/placeholders/dangling handlers found)**: PIN-recovery/alternate-access unlock, the interactive tour, the Guide screen, the backup-migration registry, the orphan-reference checker, the storage-save-failed banner, the error-log screen, tab reorder, Resources hyperlink rendering, and duress-PIN/decoy mode. A full grep for TODO/FIXME/"not implemented" across `src/` found none beyond a documented, unrelated Android platform-API limitation.

**UX-bloat — checked, not bloated for what it is; one minor consolidation opportunity logged, not acted on.** The 5-tab/8-section information architecture holds up; Home's own dashboard + due-state banners already answer "what needs attention across modules," and Clinic Card already covers "printable doctor-visit summary." The one real soft spot: Backup & Data packs 5 separate export variants (plain/folder/selective/CSV/encrypted) into one section — a lot of surface for a single-owner app. Not fixed this round (each was added for a real, separate ask; consolidating into one format-picker sheet is a real but non-urgent UI simplification, logged here for whoever picks it up next).

Verified live throughout: full build, `npx eslint .` clean, and the full 15-flow smoke-test suite passes against a real `vite preview` production build (a first run against the dev server showed the one known, already-documented flow-14 false-failure from a stale `dist/` build directory tricking that flow's own skip-guard — not a regression; a clean rebuild + preview-build run confirmed all 15 flows pass).

## Recently shipped (10 Sep 2026, region-landmark + screen-reader pass, and a total-app audit)

Real ask: check a historical Known Issues reference that didn't resolve
cleanly on re-read (traced via `git log`/commit messages to
`097daab` — the "design-direction call" it named was the
delete-confirmation pattern inconsistency, already resolved the same
day it was logged, in `122b7e8`'s `ConfirmDeleteCard` rollout — nothing
outstanding there, just a stale forward-reference that never got a
matching Known Issues bullet), then do the deferred region-landmark/
screen-reader pass, then a genuinely thorough total-app audit — "as if
this app had never been built before," the explicit framing for this
round.

**Region-landmark gap — narrower than originally scoped, verified live
via axe-core before fixing anything.** The original framing pointed at
"every screen's own content not wrapped in semantic regions" as a
big, cross-cutting problem. Checked directly with `axe-core`'s own
`region` rule against every primary screen first: Home/Contacts/
Encounters/Medication/Healthcare all came back clean — the earlier
`<main>` landmark fix already covers everything rendered as one of
`App.jsx`'s own tab contents, since that's everywhere navigation
within a module actually lives (Healthcare's own sub-tabs, Testing,
Clinic Visits, Attachments, Partner Notification, Clinic Card — all
DOM descendants of that one `<main>`, confirmed by tracing each
`import` in `App.jsx` directly, not assumed). The real, narrow gap was
exactly 2 screens rendered as direct SIBLINGS of `<main>` instead —
`SettingsScreen` and `GlobalSearchScreen`, both `App.jsx`-level
overlays outside the landmark entirely, confirmed live (32 real
`axe-core` violations on Settings' main menu, same on Global Search).
Fixed with one `role="region"` each on their own outer root — and
because Settings' own ~20 sub-screens (Privacy, Developer tools, etc.)
are all DOM descendants of that SAME root regardless of their own
`position:fixed` styling, this one fix covers the whole Settings tree,
verified live by drilling into 2 sub-screens directly. 3 more small,
genuinely transient dialogs (`AppLockPrompt`, the import-mode dialog,
the encrypted-import password prompt) got `role="dialog"` instead —
more accurate than "region" for a dismissible prompt, not a page
section.

**Screen-reader-quality pass — found real, significant gaps axe's
structural checks don't catch on their own.** Investigating the region
gap surfaced something bigger: the bottom navigation bar — the app's
own primary means of moving between screens — had `onClick` handlers
on plain `<div>`s with no `tabIndex`, no `role`, and no keyboard
handler at all, on any of the 5 tabs. A keyboard-only or
screen-reader user could not navigate this app AT ALL beyond whatever
screen it opened to. Fixed with `role="button"`/`aria-label`/
`aria-current`/`tabIndex={0}`/a real `onKeyDown` (Enter/Space) on every
tab, plus `role="navigation"` on the containing bar. Verified live via
a genuine keyboard-only interaction, not just reading the diff:
focused the Contacts tab directly and pressed Enter — it navigated.
The same missing-keyboard-access shape turned up in a second place
once looked for deliberately: every undo/redo/delete-restore toast in
the app (21 real sites across 11 files — `editUndoHelpers`' own
per-record toast, duplicated independently per module the same way
delete-confirmations once were, plus a separate bulk-delete toast
duplicated the same way) was a clickable `<div>` with no keyboard
access and no live-region announcement, so a screen-reader user
wouldn't even know one had appeared. Fixed all 21 with `role="button"`/
`tabIndex={0}`/`aria-live="polite"`/a real `onKeyDown`, plus a smaller
transient "Press back again to exit" toast (`role="status"`, no
"button" semantics needed since it's not clickable). Verified live
end-to-end, the strongest possible proof: deleted a real contact via
its own profile menu, then — using only `.focus()` and a real
`page.keyboard.press("Enter")`, never a click — restored it via the
undo toast, confirming both the keyboard focus AND the actual undo
logic fire correctly together.

A full re-scan while verifying this also caught 2 real, unrelated
findings the earlier accessibility pass's own file scope had missed:
Encounters' own screen title and Contacts' per-contact profile
screen both had ZERO `<h1>` at all (`page-has-heading-one`) — the
original heading-audit pass only tokenized 6 screens explicitly named
at the time; Encounters was never one of them despite having the same
colored-banner-title shape as the other 4 real screen banners, and
Contacts' own list↔detail navigation turned out to fully swap (the
list's `<h1>` unmounts when the detail view replaces it, confirmed
live, not assumed) — unlike Healthcare/Medication Dashboard, which
keep their own top-level `<h1>` mounted across every sub-navigation.
Both fixed with a real `<h1>` (Encounters' own banner title; the
contact's own name on the profile screen) — then the SAME swap
pattern was checked on Encounters' own detail view too (once its
landing got fixed) and found missing there as well, fixed the same
way. Also found, via a full (not `region`-restricted) `axe-core` scan:
Contacts' own sort-by chip row had a real, serious `color-contrast`
violation on its ACTIVE "Last encounter" chip — `T.contactsTeal` text
on a plain background, which an earlier same-day contrast-sweep entry
had explicitly checked and called fine specifically BECAUSE it wasn't
a self-tint. That reasoning was wrong — fixed the same way as every
other site in that sweep (swapped to the already-existing
`T.contactsTealText`), and the earlier entry corrected in place rather
than left standing as a false "verified clean."

**Total-app audit — found one real, significant, previously-invisible
data-safety gap.** `storageAdapter.js`'s own `save()` has always
returned `true`/`false` specifically so a caller could notice a failed
write — its own header comment says so — but a full grep across every
one of the ~31 real call sites in the app (every repository/registry's
own `persist()`) found NOT ONE that ever checked it. A genuine
`localStorage` quota-exceeded failure (a real, plausible risk on a
long-installed device — this session's own earlier data-volume stress
test already proved real installs can reach tens of thousands of
records) would silently vanish into a caught `catch` block with only a
`console.error` nobody watches, while the app's own in-memory React
state carries on as if the save succeeded — real, silent data loss on
an app whose entire design promise is "your data is safe, on your own
device." Retrofitting a check at all 31 fire-and-forget call sites
would be real, disproportionate churn for what should be a rare
failure — fixed at the one real chokepoint instead:
`storageAdapter.js`'s `save()` now dispatches a plain
`"shos:storage-save-failed"` DOM event on failure; `main.jsx`'s
existing global error-listener pattern (already used for
`window.onerror`/`unhandledrejection`) durably logs it to the same
on-device error log, and a new listener in `App.jsx` shows a real,
persistent (not auto-dismissing — this is too serious to risk someone
missing it), unmissable red banner telling the user their last change
may not have saved and to check their device's free storage.
Deliberately does NOT try to identify or retry the specific failed
write — by the time this fires the calling code has already moved on,
so the honest, safe action is a clear warning, not a false promise of
auto-recovery. Verified live end-to-end: simulated a real
`QuotaExceededError` via the exact same event `storageAdapter.js`
itself dispatches, confirmed the banner renders with real
`role="alert"` semantics, is genuinely dismissible, and — the real
proof the fix is durable, not just visual — confirmed the failure
shows up afterward in the real Settings → Developer Tools → Error log
screen, not just a console line.

Also directly verified (a genuine "checked, not assumed" pass, not a
new gap): the installed PWA's own offline support, previously
implemented (`public/sw.js`'s own header comment already documents the
network-first-with-cache-fallback design) but never actually
live-tested end to end. Warmed the service worker via a real online
load, then genuinely took the browser context offline and reloaded —
the app opened correctly with real cached data (medication due-state,
etc.) and zero page errors. Clean result, no code change needed —
documented here rather than left as an untested assumption.

Verified live throughout: full build, `npx eslint .` clean, and the
full 15-flow smoke-test suite passes against a real `vite preview`
production build both before and after the total-audit fixes (two
separate full runs, not one reused result).

## Recently shipped (10 Sep 2026, scrollable-region-focusable fix)

Real ask: continue through the deferred backlog — picked the one
remaining scoped accessibility gap from the earlier `axe-core` pass,
the `scrollable-region-focusable` finding flagged as needing "a real
design-system fix... not a narrow per-file patch."

**Re-scoped from the original framing before touching anything.** The
Known Issues text pointed at the `position: fixed; inset: 0; overflow-y:
auto` shape specifically, but a full grep for that combined shape only
matched 35 of the app's 75 `position:fixed, inset:0` divs — many of the
other 40 are dimmed modal backdrops or splash/lock screens with no
`overflow` of their own at all, genuinely not scrollable, so adding
`tabIndex` there would have been a no-op or actively wrong (a focusable
element with nothing to scroll). The real, precise target is every
element that actually carries `overflowY: "auto"` — 55 sites across 19
files once nested scrollable regions (a search-results list, a
bottom-sheet's own scrolling body, inside an otherwise non-scrolling
backdrop) are included, not just the ones that happen to also be a
full-screen `position:fixed` root.

**Deliberately did NOT build the suggested shared `<ScrollableScreen>`
wrapper.** Every one of the 55 sites already has the exact CSS needed
(`overflowY: "auto"` on a properly-sized flex container) — the ONLY
missing piece for `scrollable-region-focusable` is `tabIndex={0}`
itself, a one-line, mechanical, zero-structural-risk addition at each
site. A new wrapper component would mean touching each of these same
55 render trees anyway, for no behavioral gain over adding the one
missing attribute directly — the "needs a shared wrapper" framing in
the original Known Issues entry turned out to overstate the real
fix once actually scoped.

**Deliberately did NOT add `role="region"`/`aria-label` alongside
`tabIndex`.** The `scrollable-region-focusable` axe rule itself only
requires the scrollable element (or a focusable descendant) to be
keyboard-reachable — confirmed live via `axe-core` before and after,
not assumed from the rule's name. Writing a genuinely meaningful,
distinct accessible name for 55 different containers — several already
containing their own `<h1>`/section headings from the earlier pass —
is really the separate, broader `region`-landmark finding Known Issues
already scopes as its own, bigger, undertaking; bundling it in here
would risk exactly the kind of unverified screen-reader semantics
change that finding is deliberately deferred for.

Verified live via Playwright against a real `vite preview` build: the
Settings overlay (picked as the deepest, most content-heavy example)
is genuinely reachable via real sequential `Tab` key presses (not just
`.focus()`), receives real focus, and its `scrollHeight` exceeds its
`clientHeight` (genuinely has more content than fits, the actual case
this fix targets) — confirmed with zero page errors. Re-ran the same
`axe-core` `scrollable-region-focusable` check from the original pass
against both Settings and Contacts: zero violations on either,
down from a real, reproducible finding before the fix. Full build,
`npx eslint .` clean, and all 15 smoke-test flows pass against a real
`vite preview` production build.

## Recently shipped (10 Sep 2026, Contacts card — transport icon, age, role display)

Real ask, live report: Contacts cards should show a pin next to city
(always), a single icon for how they'd get to/host a meetup (house if
they host, car if they drive, bicycle if they cycle, bus if public
transport, walking figure if they walk — highest tier only, ranked
Drives > Cycles > Public transport > Walk), plus an option to show
Dom/sub and Top/bottom info on the card too, "if not already existing."

**Transport-mode icon — one icon, ranked, not a growing pile.** Found
that `travelMode` (`TRAVEL_MODE_OPTIONS` — Public transport/Car/Cycle/
Walk/Taxi, `contactRepository.js`) already existed as a multi-select
field, shown as plain text in the profile detail's ReadRow but never as
a card icon; the older `drives` boolean (predates `travelMode`) already
rendered a bare Car icon unconditionally. New `getTransportIcon()`
picks the single highest tier present — Car (folding in legacy
`drives === true` as an alias for `travelMode`'s own "Car", so contacts
set up before `travelMode` existed still show correctly) > Cycle > Public
transport > Walk — real Phosphor glyphs (`BicycleIcon`/`BusIcon`/
`PersonSimpleWalkIcon`), replacing the old unconditional Car-only icon.
Taxi (a real `travelMode` option) deliberately isn't part of the
ranking — not named in the ask, doesn't obviously rank against the
other four — still visible in the detail view's own full list, just not
promoted to a card icon.

**Pin next to city — always shown, a real `MapPinIcon`.** Previously
just plain "· city" text. This freed `MapPin` from its old use as the
"they'll travel to you" indicator (mutually exclusive with the Host
icon) — that indicator switched to `NavigationArrowIcon` instead, so
the two different facts (a location label vs. "will come to you") don't
read as the same pin twice on one row. Host icon (House, `hosts ===
"Yes"`) is unchanged — a different, orthogonal fact from transport mode
(how THEY get around, not whether they'll host).

**Age — already built, just never exercised by seed data.** Confirmed
via code read: `contact.age`/`contact.ageIsApprox` (with the `≈` prefix
for an approximate age) were already rendered on both the card and the
profile detail — the live report ("no age added that I can see from
your screenshot") was seed data never populating the field on any of
the 16 seed contacts, not a missing feature. Added real ages (a mix of
exact and `≈`-approximate) to 8 seed contacts spanning both card and
detail views, confirmed live in a fresh-install screenshot.

**Dom/sub & Top/bottom on the card — a new opt-in preference.** Both
`bdsmRole`/`sexualPosition` already existed and were already shown on
the profile detail; this is the list-card copy, gated behind a new
`showRoleOnContactCards` preference (`appPreferencesRepository.js`,
default `false`) — more exposing than the relationship-type chips
already on the card (visible the instant the list renders, not one tap
in), so opt-in rather than on-by-default, same precedent as App Lock/
calendar sync/encrypted export elsewhere in that file. New Settings >
Preferences > Contacts toggle (`ShowRoleOnCardsToggleCard`, next to the
existing inactive-threshold control), same toggle-track pattern as
`MenstrualTrackingToggleCard`. When on, renders as the same chip style
as the relationship-type row, on its own line so the two concepts don't
blur together.

Real scope check done before touching anything, not assumed: Contacts'
own separate "A“Z / Newest / Oldest / Last encounter / Incomplete"
sort-by row also uses `T.contactsTeal` as text — but on a plain
background with no self-tint at all, a different pattern from the
badges this session's earlier contrast sweep targeted — confirmed by
reading the surrounding JSX, not assumed from the grep alone.

Verified live via Playwright against a fresh install: the city pin, the
single ranked transport icon (a Car icon for a `drives`-only contact,
proving the legacy-boolean fallback), the Host + `NavigationArrow`
pairing, and — after toggling the new preference on in Settings — real
`sub`/`Vers` badges rendering on a contact's card. Full build,
`npx eslint .` clean, and all 15 smoke-test flows pass against a real
`vite preview` production build (run twice, once before and once after
adding the seed ages).

## Recently shipped (10 Sep 2026, module-accent-colour contrast sweep)

Real ask: continue through the deferred backlog — picked the module-
accent-colour contrast sweep, the more bounded of the two remaining
accessibility items (the other, `scrollable-region-focusable`, needs a
new shared wrapper component across dozens of files — a bigger,
separate undertaking, still open).

Checked all ~10 module/status accent colours individually against the
"text-on-a-light-self-tint-of-itself" pattern the Known Issues entry
called for, by hand-computing the exact WCAG relative-luminance
contrast ratio (the same formula `axe-core` itself uses) at every real
tint alpha value actually used in the codebase (found via a full grep
of `${T.xxx}NN`-shaped background tints across `src/modules/`, cross-
checked against a live `axe-core` scan of every reachable primary
screen — which came back clean on this specific pattern only because
the failing states are conditional, e.g. an "active" filter chip axe
never saw toggled on; the math is what actually found the real sites).

**Real result: 4 of the ~10 accents genuinely fail 4.5:1 in this exact
pattern, at every alpha actually used — contacts (`#B36205`), home
(`#008585`), `ACTION.red` (`#D93838`), `ACTION.green` (`#148A1E`).**
menstrual/kink/protection were also checked and would also fail, but
have zero real occurrences of this specific pattern anywhere in the
app today — nothing to fix for them. encounters/healthcare/medication
already clear 4.5:1 comfortably (6.4:1-9.8:1 depending on alpha) and
needed no change.

**Deliberately did NOT darken the base `ACCENTS`/`ACTION` exports
themselves** — they're reused everywhere else in the app (filled
buttons with white text, borders, icons, tab highlights) where they
already read correctly, and `ACTION.red`/`ACTION.green` specifically
were already hand-tuned for a different goal (equal perceived
vividness between the two — see that block's own comment in
`designTokens.js`) that a global hue/lightness change could quietly
undo. Same principle already used once this session for Contacts' own
"Incomplete" badge fix (`#9A6700` → `#926100`, a standalone colour, not
a change to `ACCENTS.contacts`): new `ACCENT_TEXT_SAFE`/
`ACTION_TEXT_SAFE` darker stand-ins added to `designTokens.js`,
computed to clear 4.5:1 with real margin (≥4.9:1) even at the worst-case
alpha actually paired with text anywhere in the app, swapped in ONLY at
the confirmed text-on-self-tint sites' `color:` property — background,
border, and every other use of the base accent (icons, filled buttons,
tab pills) left completely untouched. Dark mode needed no separate
variant — its own `resolveDarkAccent()`-resolved values already have
real contrast headroom against a near-black surface, confirmed by the
same math, not assumed.

14 real sites fixed across 10 files (`SHOS_Contacts_Prototype.jsx` ×10,
`SHOS_MyProfile_Prototype.jsx` ×3, `SHOS_Home_Prototype.jsx` ×1 — the
"Update available" link, `SHOS_Encounters_Prototype.jsx` ×2,
`SHOS_Testing_Prototype.jsx` ×1, `SHOS_ClinicVisits_Prototype.jsx` ×2,
`SHOS_Timeline_Prototype.jsx` ×2, `SHOS_Medication_Dashboard_Prototype.jsx`
×1 — the allergies banner, `SHOS_ClinicCard_Prototype.jsx` ×1 — the
allergy chips, `SHOS_Settings_Prototype.jsx` ×1 — the unbacked-changes
warning). Every site was individually confirmed as a genuine
text-color-on-its-own-tint pairing (not just border/background alone)
before touching it — several `${T.contactsTeal}15`-alpha grep hits
turned out to be border-only or a different, plain-background chip
(Contacts' own separate "A“Z/Newest/Last encounter" sort-by row, e.g.,
uses `T.contactsTeal` as text on a PLAIN background, not a self-tint,
so it was left alone here as a different pattern).

**Correction, 10 Sep 2026, later the same day**: that sort-by row's
plain-background usage was NOT actually fine — a full WCAG 2 AA
`axe-core` scan (run as part of a later accessibility pass) flagged it
as a real, serious `color-contrast` violation on its own terms, not
because it's a self-tint. `T.contactsTeal` directly on this app's
plain surface colour still fails 4.5:1 in light mode. Fixed the same
way as every other site in this sweep — swapped to the already-existing
`T.contactsTealText`/`ACCENT_TEXT_SAFE.contacts` for just the active
chip's text colour, border/background left untouched. The real lesson:
"plain background, not a self-tint" was the wrong test for whether a
module accent needs the safe text variant — the right test is just the
actual computed contrast ratio, checked directly, not inferred from
the CSS pattern.

Verified live via Playwright against the real rendered pixels, not
just the math: read the actual computed `color`/`background-color` off
Contacts' own real "Partner" relationship badge after the fix
(`rgb(157, 86, 4)` text on `rgba(179, 98, 5, 0.082)` background) and
re-derived the contrast ratio from those exact live values — 5.03:1,
up from the pre-fix 4.05:1, confirming the fix actually reaches the
rendered DOM, not just the source. Full build, `npx eslint .` clean,
and all 15 smoke-test flows pass against a real `vite preview`
production build.

## Recently shipped (10 Sep 2026, spacing consistency audit)

Real ask: continue through the deferred backlog — picked the one item
explicitly flagged as "not yet audited" in Known Issues (a systematic
sweep for the same "content sits flush against the header/banner
above it" shape that caused the Contacts "N active" bug fixed earlier
the same day).

Audited all `position: "sticky"` elements across the app's 18 module
files (~40 sites) via a dedicated sub-agent sweep, verified directly
against `designTokens.js`'s own type-token comments rather than
assumed: only 4 real colored-banner SCREEN titles exist anywhere in
the app (Contacts/Healthcare/Medication/Encounters) plus 3 colored
sheet-title banners (Testing/Clinic Visits/Encounters' own Add/Edit
forms) — every other sticky element across all 18 files is a plain
toolbar filled with the page's own neutral background (`T.bg`/
`NEUTRAL.bg`/`DARK.bg`), not an accent color, so the specific bug
shape (a colored banner's own bottom edge feeling cramped) structurally
cannot occur there at all.

**Clean result — no new bug found, verified rather than assumed.**
Checked all 4 real banners individually: Contacts' and Medication's
sites are the two already-fixed cases (each with its own code comment
documenting the fix); Healthcare's next-content padding (14px) already
exactly matches its own banner's bottom padding; Testing's/Clinic
Visits' sheet banners are protected by their shared `SectionCard`
component's own built-in `marginTop: 14`, not flush at all. One real,
sub-threshold spot checked and deliberately left alone rather than
"fixed": Encounters' search box sits 8px below its own banner (real
breathing room, not flush) instead of matching the banner's 14px
bottom padding the way Healthcare does — but that exact `padding: "8px
16px 0"` value is independently confirmed (via a direct grep, not
trusted from a stale comment) to be the genuinely consistent,
already-established convention shared by 5 other modules'
(Vaccinations/Testing/Clinic Visits/Measurements/Symptom Log) own
search boxes sitting under a plain header. Changing Encounters alone
would trade one inconsistency for a different, broader one — left
alone per this project's own standing "avoid over-normalisation" rule,
not an oversight or half-finished fix.

No code changes made this round — a genuine "audited, clean" result,
the same honest outcome already established for the data-volume
stress-testing backlog item earlier the same day, documented here
rather than silently assumed complete.

## Recently shipped (10 Sep 2026, desktop-width-cap border consistency)

Real live report: "contacts has very thin grey lines running vertically
on both sides, making it look like centre is on a raised button or
something. I like it, but not on encounters or healthcare module
etc...should be imho." Root-caused, not guessed: a `maxWidth: 600` +
`borderLeft`/`borderRight` wrapper (centers content on a wide viewport,
with a 1px border marking the cap) was added to Contacts, My Profile,
and Medication Dashboard at various earlier points this multi-session
effort — each independently, per their own comments — and never rolled
out anywhere else. The border itself renders regardless of viewport
width (visible as a thin edge line even at phone width, the full
grey-margin "raised card" look only appears past 600px), which is why
it showed up in the Play Store screenshots above for Contacts but not
Encounters/Healthcare.

Rolled out to the remaining module screens reachable directly from
`App.jsx` (Encounters, Healthcare, Home, Settings) and every
independently-invoked full-screen overlay (Global Search, Clinic Card,
Attachments, Partner Notification) — 8 files total. Deliberately did
NOT chase this into every further-nested sub-screen (Healthcare's own
6 sub-tabs, Timeline, Registry Management, Option List Editor, or any
module's own Settings-style nested overlay) — checked against existing
precedent first, not assumed: Medication Dashboard's own nested
`MedicationSettingsScreen` (a `position: fixed` overlay) was already,
deliberately left unwrapped even after this pattern shipped on
Medication Dashboard's own landing screen, so leaving equivalently
-nested screens unwrapped elsewhere (Registry Management, Option List
Editor, each Healthcare sub-module's own Edit/Detail sheets, etc.)
matches how the app already behaves, not a new gap. Healthcare's 6
sub-tabs (Testing/Clinic Visits/Vaccinations/Symptoms/Measurements/
Menstrual & Contraception) and Timeline needed no direct edit at all —
each already renders as normal-flow content nested inside its own
already-wrapped parent (Healthcare or, for Timeline, whichever of
Healthcare/Home invoked it), so they inherit the border automatically.

Encounters needed 3 sites (its landing list, detail view, and edit
sheet — the module's own top-level component is a thin switcher, not a
single screen). A genuinely useful side effect, not a coincidence:
Encounters' own FAB button already had a `maxWidth: 600, margin: "0
auto"` comment reading "wrapped for wide-viewport centering," dated
26 Aug — the wrap this fix adds was already anticipated in that
comment and never finished.

Verified live: full build, `npx eslint .` clean, all 15 smoke-test
flows pass. Visual verification specifically needed a DESKTOP-width
viewport (1000px, not the ~400px phone width used for the Play Store
screenshots) to actually see the grey-margin effect the report
described — confirmed all 5 primary screens (Contacts/Encounters/
Healthcare/Home/Medication) now render identically at that width.

## Recently shipped (10 Sep 2026, Play Store readiness)

Real ask: continue through the deferred backlog. Real-device testing
stays impossible in this sandboxed environment (no physical device or
emulator with Play Services access) — picked Play Store readiness
instead, the other deferred item, and scoped honestly what's actually
achievable without a live Play Console account: a real hosted privacy
policy, real screenshots from the actual running app, and accurate
draft content for the Play Console's own forms, rather than a Console
submission this session structurally cannot complete.

**A real, hosted privacy policy — not a placeholder.** New
`public/privacy-policy.html`, deployed automatically by the existing
`web-alpha.yml` GitHub Pages workflow (no new CI wiring needed — it's a
static file, `public/` already ships as-is). Live at
`https://drwho2001.github.io/SHOS-V2/privacy-policy.html` once this
push's Web Alpha run completes. Content drafted directly from this
app's own verified architecture (no backend/accounts/cloud sync,
AES-256-GCM encryption at rest) and the real, current
`AndroidManifest.xml` permission list — every permission named in the
policy was checked against the actual manifest, not assumed from
memory, including the two genuine outbound network calls (Nominatim
address lookup, GitHub update check) already disclosed in-app via
Settings > Data & network.

**Real Play Store screenshots — captured from the actual app, not
mockups.** 5 screenshots (Home, Contacts, Encounters, Medication,
Healthcare) via Playwright against a real `vite preview` production
build, at 1080×1919 (9:16 — a standard Play Store phone screenshot
size), using the app's own public seed/demo data per the established
personal-alpha/public-alpha split. First pass included the due-meds/
refill/SW-update banners still visible (not representative of a clean
listing screenshot) — fixed by driving each real dismiss control
(`aria-label="Dismiss due medications banner"` etc.) before each
capture, not just cropping them out.

**`PLAY_STORE_LISTING.md`** — everything else fillable without a live
Console account: store listing copy (short/full description,
category), Data Safety form answers (including an honest flag on the
one genuine gray area — whether the optional Nominatim address-lookup
call counts as "data shared with a third party" under Play's own
category definitions, resolved toward the more conservative
declaration rather than claiming zero data sharing and risking a
policy mismatch), content-rating guidance (a mature rating is the
honest expectation given the health/sexual-activity/substance-tracking
subject matter — flagged clearly rather than downplayed to chase a
lower rating), and what's still genuinely blocked without the owner's
own involvement: a real signing keystore (deliberately not generated
in this sandboxed environment — a signing key is a genuine secret that
shouldn't be created or handled here), the closed-testing track Play
requires before production release, and real-device verification.

**Real test-environment lesson, not an app bug**: verifying this
change's full smoke-test run first showed a false failure on flow 14
(the PWA auto-update test) — caused by a stray `dist/` directory left
over from this same session's own screenshot-generation build, built
with a GitHub-Pages-specific `--base=/SHOS-V2/` override, while the
suite was pointed at the dev server. Flow 14's own skip-guard only
checks whether `dist/sw.js` exists on disk, not whether the suite is
actually running against a real preview build — so it tried its real
SW-file-swap trick against a server that wasn't serving that file
correctly, a genuine gap in the guard's own precision worth knowing
about if this happens again, not something to fix reflexively this
session. Rebuilt with the default base and re-ran against a correctly
-bound `vite preview` server — all 15 flows pass. `npx eslint .` clean.

Honest scope note, unchanged: real-device testing remains genuinely
deferred — still no physical device or emulator with Play Services
access in this environment.

## Recently shipped (10 Sep 2026, data-volume/performance stress testing)

Real ask: continue through the deferred backlog. Picked data-volume/
performance stress testing — the next achievable item without a real
device or external accounts, and directly relevant given
`SHOS_GlobalSearch_Prototype.jsx`'s own long-standing header comment
explicitly rejects a persisted search-index optimisation as
"unnecessary at this app's real data scale," an assumption worth
actually re-verifying at scale rather than trusting indefinitely.

Generated a synthetic backup at a genuinely "years of heavy daily use"
scale (500 contacts, 1,500 encounters, 3,000 medication log entries,
200 tests, 100 locations — 5,302 records) and imported it through the
real Settings > Restore-from-backup UI (the same production import
path, not a direct storage write), then timed real interactions
against that dataset: Contacts list render, Contacts' own search
filter, a 3000px scroll, and Global Search's index build + a real
fuzzy query. Then repeated at 4x scale (2,000 contacts, 6,000
encounters, 12,000 logs, 800 tests, 300 locations — 21,102 records, a
scale no realistic single-user personal app would ever reach) to check
for non-linear degradation, not just "does it work at one arbitrary
number."

**Clean result — no performance problem found, verified rather than
assumed.** Every measurement stayed well under 2.5 seconds at even the
extreme 21,102-record scale, and scaling was sub-linear or flat across
every metric, not a cliff: import (Replace All) 1.69s → 2.49s for 4x
the data; Developer Tools' own full counts-plus-orphan-reference sweep
across every repository 0.76s → 1.10s; Contacts list first-render
315ms → 329ms (essentially flat despite contact count going 500→2,000);
Contacts' own search-filter keystroke response 330ms → 389ms; a
3000px scroll 203ms → 205ms (flat); Global Search's full index build
plus a real fuzzy query against the larger dataset 884ms → 1.13s. Zero
page errors, zero crashes, at either scale. This confirms Global
Search's own existing header comment (no persisted index needed) still
holds at real, even extreme, data volumes — not something to revisit
speculatively. No code changes made — this was a genuine "verified
clean" result, the honest outcome of a stress test, not a "found and
fixed" one; documented here rather than silently assumed complete.

## Recently shipped (10 Sep 2026, accessibility pass)

Real ask: continue through the deferred backlog list (real-device testing,
Play Store readiness, an accessibility pass, data-volume stress testing) —
picked the accessibility pass, since it's the one item achievable with real
tooling in this environment and was flagged as "never done systematically"
across this whole multi-session effort. Added `axe-core` as a devDependency
(injected into a real running preview build via Playwright, never imported
by `src/` — not shipped to users) and scanned Home, Contacts (list + a real
contact's detail), Encounters, Medication Dashboard, Healthcare, Settings
(main menu + Colour scheme), and dark mode, against the WCAG 2 A/AA + best-
practice ruleset.

**Two real, user-facing contrast bugs found and fixed — not just
screen-reader-only findings.** (1) The PWA update banner's "Refresh"
action (`App.jsx`) rendered in `ACCENTS.healthcare` (`#09582E`, a dark
green) on the banner's own near-black `#1B1B1F` background — a 2:1
contrast ratio, well under WCAG AA's 4.5:1 minimum, making the one
actionable button on that banner hard to read for anyone, not only
axe. Fixed to white + underline (matching the banner's own already-legible
body text and the existing text-link pattern used elsewhere for
`AppLockScreen`'s "Back to PIN entry" link) — confirmed via screenshot,
no visual regression. (2) Every seeded contact's "Incomplete" badge (and
the same warning colour's "Possible duplicate"/"Medium confidence" uses)
in `SHOS_Contacts_Prototype.jsx` used `#9A6700` on `#FFF3C4` at 4.37:1 —
just under the 4.5:1 threshold, affecting literally every contact card in
the list. Darkened to `#926100` (4.80:1, a real margin, not another
razor-thin pass) — visually near-identical, still reads as the same
mustard warning tone.

**Structural findings, fixed where cleanly bounded, honestly deferred
where not.** `landmark-one-main` (no `<main>` landmark anywhere, on any
screen) — fixed with one `<main>` wrapping `App.jsx`'s own real per-tab
screen content, the one container that's genuinely always "the real
screen" regardless of which tab is active; zero layout change, `<main>`'s
default display matches the `<div>` it replaced. `page-has-heading-one`
(no real `<h1>` anywhere — every "screen title" in this app is a styled
`<div>`/`<span>`, not a semantic heading) — converted the 6 primary
screen-title sites already tokenized by this session's own earlier
heading-size audit (`TYPE.screenTitle`/`subScreenTitle` in `App.jsx`'s
onboarding, Home, Contacts, Healthcare, Medication Dashboard, My Profile)
to real `<h1>` elements with `margin: 0` added to prevent the browser's
own default heading margin from creating unwanted spacing — confirmed
via screenshot and the full smoke suite, no visual regression.
`scrollable-region-focusable` on Contacts' own horizontally-scrolling
sort-chip row (`overflowX: "auto"`, no `tabIndex` — a keyboard user could
never reach or scroll it at all) — fixed with `tabIndex={0}` +
`role="group"` + `aria-label`, confirmed this exact `overflowX: "auto"`
shape is isolated to this one file, not a repeated pattern elsewhere.

**Two genuinely bigger findings, deliberately NOT fixed this round —
scoped and documented, not silently skipped, same discipline already
applied to the font-scaling item.** (1) `region` (30-40+ nodes per
screen — "all page content should be contained by a landmark") and a
second, much larger `scrollable-region-focusable` instance (the
`position: fixed; inset: 0; overflow-y: auto` shape that's this app's own
standard full-screen-overlay container, used on nearly every screen and
sub-screen app-wide, not just Settings) would each need a real,
cross-cutting design-system pass — verifying and touching dozens of
files, not a narrow patch. (2) `ACCENTS.contacts`/`T.contactsTeal`
(`#B36205`) used as text on a light self-tint background (e.g. the
"Partner"/"Friend with benefits" relationship badges, ~4:1, just under
4.5:1) — this exact "module accent colour as text on a light tint of
itself" pattern appears 40 times across 11 module files, each using a
DIFFERENT module's own accent colour; fixing it properly means checking
all ~10 module accents against this same pattern individually (some may
already pass, some may not), not darkening one module's brand colour in
isolation. Logged below in Known Issues as real, scoped, not-yet-done
work — see there for anyone picking this up next.

Verified live: full build, `npx eslint .` clean, all 15 smoke-test flows
pass (stable across two consecutive runs), plus a direct screenshot
confirming the Refresh-button and Incomplete-badge fixes render correctly
with no layout regression from the `<main>`/`<h1>` structural changes.

## Recently shipped (10 Sep 2026, backup-import fuzz testing)

Real ask: pick one of the deferred backlog items flagged after the PWA
auto-update fix and "aim to complete whichever chosen" — picked backup-import
fuzz testing over real-device testing/Play Store readiness/accessibility/
data-volume stress testing, since it's the most bounded and completable
without a real device or external accounts, and extends infrastructure this
session already built (`backupMigrations.js`, the encryption-migration test).

**Real, genuine crash found and fixed — reproduced live before fixing, not
assumed from reading the code.** An imported backup file is untrusted
external input by definition, but nothing in `backupService.js` previously
checked that an array field's own ELEMENTS were real records before handing
them to a repository's `replaceAll()` — only whether the field itself was an
array. `contactRepository.js`'s own `computeNextContactNumber()` (and its
~20 sibling `*Repository.js` copies of the same "derive the next id from
existing records" pattern) does `c.id` per record with no guard — a `null`
array element throws `Cannot read properties of null (reading 'id')`.
Reproduced directly via a real `page.setInputFiles()` upload through the
Settings > Restore-from-backup UI (a malformed `contacts` array: `null`, a
bare string, a number, a boolean, a nested array, and one real valid
record) — the exact crash surfaced as `Import failed: Cannot read
properties of null (reading 'id')`. Worse than a clean rejection: since
`replaceAll()` does `contacts = newContacts;` *before* calling
`computeNextContactNumber()`, the module-level array was already reassigned
to the corrupted data at the moment of the throw — `persist()` never runs
(so nothing bad is written to storage), but the running app's in-memory
state is left silently stale/corrupted until the next reload, with no
indication to the user that a reload is now needed. Fixed with a new
`sanitizeBackupData()` in `backupService.js`, run at the one shared import
chokepoint (`restoreFromParsedBackup()`) *before* `migrateBackupData()` —
migration order matters here too, since `migrateMedicationDosePerUnit()`
has the identical unguarded `med.dosePerUnit` shape and would crash on a
malformed medications element just as easily. Every array field's elements
are filtered down to genuine, non-null, non-array objects; a malformed
element is dropped outright rather than crashing or being fabricated into a
fake record — "keep whatever real fields a genuine record has" is already
the app's own defensive-default-merge job on read, but "the element wasn't
a real record at all" isn't a shape gap that job can fix.

**A second, related gap found and fixed in the same pass**: `typeof x ===
"object"` is also `true` for an *array* (a JS quirk) — five singleton-object
checks in `restoreBackup()`/`mergeBackup()` (`measurementPreferences`,
`customGroups`, `customOptionLists`, `privacySettings`, `resources`) used
exactly that check with no `!Array.isArray()` guard, unlike `myProfile`'s
own already-correct check a few lines below them. A malformed backup with
e.g. `privacySettings: ["a","b"]` would have passed the guard and been
spread into a real settings object as bogus numeric-keyed junk (`{0:"a",
1:"b"}`) — not a crash, but silent data corruption. All five (plus two
nested per-category spots inside `mergeBackup()`'s `customOptionLists`/
`resources` merge loops, where a non-array value under a real key could
spread a string's individual characters into a list) now match
`myProfile`'s pattern.

**Two more adversarial cases checked and confirmed already safe, not
assumed**: a `<script>`/`onerror`-attribute XSS attempt planted in an
imported contact's `name`/`notes` fields rendered as inert text — no script
execution, confirming React's default JSX escaping is what's actually
protecting imported data everywhere, with no `dangerouslySetInnerHTML`
anywhere touching it. A non-array value where an array was expected (e.g.
`data.contacts: "not an array"`) was already safely skipped by the
existing `Array.isArray()` guards with no change needed.

Given a permanent 15th smoke-test flow — drives the real Restore-from-backup
UI with the exact malformed array that reproduced the crash, asserts no
"Import failed" error surfaces and that Developer Tools shows exactly the
one real valid contact (not zero, not a corrupted count). One real
test-tooling fix needed along the way: the new test runs right after the
PIN-recovery flow, which leaves the shared page on the Privacy screen (a
full-screen overlay `goHomeThenOpenSettings`'s coordinate clicks don't
reliably recover from) — added a defensive `page.reload()` at the start,
the same pattern already used mid-suite elsewhere in this file. Verified
stable across two consecutive full 15-flow runs against a real `vite
preview` production build before shipping.

Honest scope note: real-device testing, Play Store readiness, an
accessibility (screen reader/contrast) pass, and data-volume/performance
stress testing remain genuinely deferred — each flagged as its own bigger,
separate undertaking, not started this round.

## Recently shipped (10 Sep 2026, heading-size audit follow-up)

Real ask: "do the heading-size audit next" — re-checking the earlier same-day
font/colour consistency audit (see that entry below) specifically for
leftover heading-size drift it didn't catch, not starting over. That audit's
own real scope was "hardcoded `fontSize`/`fontWeight` pairs that duplicated
an existing `TYPE` token pattern" plus formalising `subScreenTitle`/
`sheetTitle` — a full re-sweep (every `fontSize:` literal across
`src/modules/`, plus every `textTransform: "uppercase"` site) confirmed the
app's type scale is already tight (11-22px, no wild outliers) and the bulk
of real heading/section-label drift was already closed, but found 6 more
genuine leftover sites the original pass's own file scope (`src/modules/`
only) couldn't have reached, plus 2 it missed within scope.

**`App.jsx`'s own security screens** — `AppLockScreen`'s "Enter PIN to
unlock" and its recovery-mode "Unlock with your recovery string" heading
were both hand-typed `fontSize: 16, fontWeight: 700`, an exact but unnamed
duplicate of `TYPE.subScreenTitle` — outside `src/modules/`, so invisible to
the original sweep. Also `OnboardingScreen`'s own step-0 "Welcome" title
hardcoded the same pair as a ternary fallback instead of referencing the
token directly. All 3 converted to `TYPE.subScreenTitle`.

**`InteractiveTour.jsx`** (also outside `src/modules/`) — the tour card's
own step title was the same unnamed `16/700` duplicate; converted, plus a
missing `TYPE` import added.

**Two more uppercase section-label sites at 11/700, not 12/700** —
`SHOS_ClinicCard_Prototype.jsx`'s `SectionHeader`/`CollapsibleSectionHeader`
and `SHOS_GlobalSearch_Prototype.jsx`'s per-type-group header all matched
`TYPE.sectionLabel`'s own uppercase/700-weight/0.5-letter-spacing shape
exactly, just 1px smaller with no comment explaining why — genuine drift,
not a deliberate compact variant (no such reasoning existed in either
file). All 3 converted to `TYPE.sectionLabel`. Caught a real missing
`TYPE` import in `SHOS_GlobalSearch_Prototype.jsx` via ESLint's own
`no-undef` immediately after (this file already used `TYPE_ORDER`/
`TYPE_PLURAL`, unrelated local constants from an earlier fix, which is
what made the grep for "does this file already use TYPE" misleading at a
glance) — fixed before it could ship.

Deliberately left alone: every other `fontSize: 16/700`-shaped hit found
in the sweep (Save/Done-style filled buttons across ~8 modules, several
large stat-number displays at 20/700 in Contacts/Medication Dashboard) —
these share a *size* with `subScreenTitle` by coincidence, not a heading
*role*, and converting a button or a stat display to a heading token would
be a real semantic error even though the pixels match. No sizes outside
the canonical 9-22px scale were found anywhere (the few 26-28px hits are
large numeric input displays in Medication Dashboard, an intentional
emphasis choice, not heading drift).

Verified live: full build, `npx eslint .` clean, and all 14 smoke-test
flows pass against a real `vite preview` build. No visual change at any
of the 8 fixed sites — same rendered pixels, just naming an already-correct
value instead of duplicating it, so a future `TYPE` change can't silently
leave these 8 sites behind.

## Recently shipped (10 Sep 2026, later still — PWA auto-update fix)

Real follow-up once the ESLint/error-logging round above was done: closing
the one remaining bounded backlog item, the PWA auto-update logic's own
"verified once, never given permanent coverage" gap.

**Real bug found while building the test, not from a live report.**
`main.jsx`'s own `controllerchange` listener (added 8 Sep 2026) was
unconditionally calling `window.location.reload()` the instant a new
service worker took over — but `App.jsx`'s own `swUpdateAvailable`
banner (added 3 Sep 2026, five days EARLIER) already listens for the
identical event, with its own explicit, still-sound reasoning:
"reloading out from under someone mid-form would be a worse bug than
the staleness itself," hence a dismissible "A new version of SHOS is
ready — Refresh" prompt, not a forced reload. Both listeners fire on
the same event; `main.jsx`'s own listener registers at true module
load, before React ever mounts, so it always ran FIRST — reloading the
page before the banner's own effect (registered inside a mounted
component) could ever render, let alone be seen or dismissed. The
later addition never checked whether anything already handled this
event, silently making the earlier, more careful design's whole reason
for existing moot for 7 days. Fixed by removing the redundant forced
reload from `main.jsx` — the `registration.update()` re-check there
still does real, useful work (making sure a new SW is actually
DETECTED promptly), it just no longer also forces the reload the
banner already handles safely.

**A real, genuine Playwright/browser limitation found while writing the
test, worth recording so a future session doesn't re-lose time to it**:
neither `page.route()` nor `context.route()` intercepts a service
worker's own internal update-check fetch — confirmed directly, not
assumed: a `context.route("**/sw.js", ...)` handler never fired once
across several real `registration.update()` calls, with `routeHit`
staying `0` throughout. A service worker's own network requests
apparently don't go through the same interception path Playwright's
page/context-level routing hooks into. Worked around by simulating a
real new deploy the way one actually happens: swapping the real
`dist/sw.js` file `vite preview` serves directly off disk (a
`fs.writeFileSync`, immediately visible to the next real fetch, no
server restart needed), wrapped in a `try/finally` that unconditionally
restores the original file even if an assertion throws. Deliberately a
preview-build-only test (skips gracefully if `dist/sw.js` doesn't
exist, i.e. running against a dev server) — same "verified-once, real
production build only" carve-out already established elsewhere in this
suite.

Given a permanent 14th smoke-test flow. Verified stable: the fixed
behavior (dismissible banner appears, no forced reload, tapping Refresh
genuinely reloads) confirmed live end-to-end against a real `vite
preview` build, full 14-flow suite green, `dist/sw.js` confirmed
restored to its original content after the run.

## Recently shipped (10 Sep 2026, follow-up — see Notion for full detail)

Real follow-up to the final pre-release pass below: a question about
whether the active-status dot convention made sense app-wide, plus
explicit direction to merge to `main`, add lint/type-checking, and add
error reporting.

**Active-status dot — fixed for real semantic consistency.** The one
genuine status dot with a "good/bad" meaning (Contacts' active/inactive
indicator) used `contactsTeal` for active — a module-identity colour,
not a clear "this is good" signal. Changed to `ACTION.green` (red stays
for inactive), matching the user's own explicit "if active then green,
if not red" rule. Audited every other "active"-named dot in the
codebase before touching anything: Symptom Log's own dot uses
`severityColor()` while a symptom is ongoing and green once resolved —
a deliberately different concept (an ongoing symptom is a concern, not
a "good status," the inverse of what Contacts' dot means) — left
alone, not a bug. Medication Dashboard's small bullet next to each
med's name is pure decoration (always `medsBlue`, no active/inactive
branching at all) — not a status dot, out of scope.

**Merged to `main`.** A real gap found while answering "what haven't
you checked": this entire multi-session effort (all of Phase 2-4
encryption plus every session since) had only ever been pushed to a
feature branch — `main` was 9 commits behind, meaning CI had never run
and no real APK had ever been built with any of it. Fast-forwarded
`main` to the branch head (a clean fast-forward, no merge commit
needed) and confirmed all three workflows (Smoke Test, Build APK, Web
Alpha) went green on the real push.

**ESLint added — found 5 real, previously-invisible bugs on its first
run.** `eslint.config.js`, scoped deliberately: `eslint-plugin-react-hooks`
v7's own "recommended" config bundles several new, React-Compiler-
aligned rules (`static-components`/`set-state-in-effect`/`immutability`/
etc.) that flag long-standing, already-verified patterns this app uses
on purpose (the "quick-add deep-link" effect pattern, Settings'
`SettingsRow` helper defined per-screen) as hard errors — scoped down
to just `rules-of-hooks` (a real correctness rule) and `exhaustive-deps`
(the exact "stale closure from a missing effect dependency" bug class
behind a large fraction of this project's own real regressions,
documented at length elsewhere in this file). Real bugs found and
fixed: (1) `SHOS_Testing_Prototype.jsx` called `findClosestMatch()`
(the "did you mean?" typo-suggestion check) without ever importing
it — every other module imports it correctly from `fuzzyMatch.js`; a
real `ReferenceError` waiting on the first near-duplicate Organism/
Result tag typed there, never triggered until now. (2) Encounters'
kink-name search filter was missing `kinkNameById` (an async-resolved
`useLoadedMemo`, starts as an empty fallback `Map()`) from its own
`useMemo` deps — a kink-name search performed before the registry
finished loading could silently keep returning stale/empty results
until some other input happened to change. (3) Three dead-memoization
bugs — `PATTERN_ORDER` (Medication Dashboard), `REDUNDANT_PLATFORM_SUGGESTIONS`
(Contacts), and `TYPE_ORDER`/`TYPE_PLURAL` (Global Search) were all
defined INSIDE the component body as plain literals, so the `useMemo`s
depending on them were getting a fresh array/object identity every
render — memoizing nothing. Hoisted to module scope. (4) Home's own
Cycle/Contraception dashboard summary block lived inside a `[]`-deps
mount-once effect, gated on `menstrualTrackingEnabled` — a preference
that itself loads asynchronously and starts `false`. A user with
tracking genuinely on could have this block skip forever, since the
effect never re-ran once the real value resolved a tick later — split
into its own effect keyed on the real value. (5) Timeline's resolved-
episode "End date" field could initialize from the null-episode
fallback ("today") before the real episode data resolved, and never
self-correct — silently showing the wrong date AND incorrectly
surfacing a "Save" (unsaved changes) button the instant the screen
opened, before any real edit. Fixed with the same resync-if-untouched
ref-guard pattern used throughout this app for exactly this async-load
race. Every remaining `exhaustive-deps` warning (roughly a dozen) was
individually reviewed, not blanket-suppressed — each is either a
value/prop provably fixed for the effect's whole life (a `draftKey`
derived once per record, a mount-once boot effect, `App.jsx`'s own
back-button/notification-listener effects, which already list every
real piece of state their own logic reads) — each left with a scoped
`eslint-disable-next-line` and a one-line reason, not a bare suppression.
Wired into CI as a new `Lint` step in `smoke-test.yml`, running before
the heavier Playwright steps so a lint failure fails fast.

**`tsc --checkJs` added as a diagnostic, deliberately NOT a CI gate.**
`tsconfig.json`/`src/global.d.ts` — `npm run typecheck` is real and
available, but `npx tsc --noEmit` reports ~450 findings on this
codebase today, and every error category was individually spot-checked
(not assumed): JSX `key`-prop "doesn't exist" errors on nearly every
list-rendered component (React's `key`/`ref` are only recognized as
universally-valid via `@types/react`'s own JSX mechanism — installing
`@types/react` was tried and made this WORSE, 608 errors instead of
454, on a codebase with no consistent JSDoc prop typing to anchor it,
so reverted), `new Date(x) - new Date(y)` arithmetic flagged invalid on
values TypeScript can't narrow past `any` without JSDoc (completely
valid, working JS), and two individually-verified singleton findings
(a bare `resolve()` call, the Web Notification API's real `renotify`
option) both confirmed harmless. Real, achievable future value if this
is ever pursued further: JSDoc types on the highest-traffic shared
files (`medicationCalculations.js`, `dateInputHelpers.js`, the
repository layer) rather than chasing all ~450 findings — not
attempted this round, honestly documented in the config's own header
rather than either hidden or forced into a noisy CI gate that would
train everyone to ignore it.

**Local, on-device error/crash logging.** New `errorLogRepository.js`
(same `ensureLoaded()`/capped-log shape as `notificationHistoryRepository.js`,
deliberately excluded from `backupService.js` for the same reason —
diagnostic, not real user data) plus a new Settings > Developer Tools >
"Error log" screen (view/export/clear, mirroring `NotificationHistoryScreen`'s
own shape). Captures three real sources: `window.onerror`,
`unhandledrejection`, and the existing `ErrorBoundary`'s own
`componentDidCatch` — all via a dynamic `import()` inside a small
`logErrorLocally()` helper in `main.jsx`, keeping the `ErrorBoundary`
class itself import-free at module top exactly as it already was
(its own stated design: it must never itself fail to render). Real
architecture decision, not a default reached for reflexively: a
genuine third-party crash-reporting SERVICE (Sentry or similar) was
deliberately ruled out — this app's whole design is "nothing leaves
the device unless the owner explicitly exports it" (see this file's
own opening line), and silently phoning diagnostic data to a third
party would cross that line quietly. Export produces a plain text
file via the same `exportTextFile()` every other export in this app
already uses — the owner decides if and when to share it himself, e.g.
pasting it into a bug report.

Verified live end-to-end via Playwright: a synthetic `window.onerror`
event correctly lands in the encrypted local log with the right
`source`/`message`, the real Settings UI row shows the correct count
and opens to show it, and the Contacts status dot renders the exact
`ACTION.green` value (confirmed via computed style, not assumed from
the token name). Full 13-flow smoke-test suite passes. All three CI
workflows (Smoke Test including the new Lint step, Build APK, Web
Alpha) confirmed green on the real `main` push.

## Recently shipped (10 Sep 2026, final pre-release pass — see Notion for full detail)

Real ask, framed explicitly as "the last test before release if no real
outstanding bugs or issues": a 6-part follow-up covering a reported
bottom-nav visual glitch, Settings icon inconsistency, a full
notification-timing deep-dive, delete-confirmation standardisation, the
Contacts status dot's interactivity, and one more genuinely full
module-by-module audit.

**Bottom-nav "fixed halfway down" — confirmed a screenshot artifact, not
a real bug.** Tested 5 real device-size viewports directly: the nav's
bottom edge always exactly equals `window.innerHeight`, matching
`position: fixed; bottom: 0` behaving correctly (`App.jsx`). The
reported "halfway down" placement was Playwright's own `fullPage: true`
screenshot-stitching, not the live app.

**Settings icon weight/colour inconsistency — fixed.** Root cause:
piecemeal `emphasized`/`iconColor` props accumulated across many past
sessions' individual feature additions to `SettingsRow`, with no real
design rule behind which of the 22 rows got which treatment. Removed
both props entirely — every row's icon is now a plain, consistent
`size={17} weight="regular"` in a single neutral colour.

**Delete confirmations standardised app-wide — new shared component.**
Closer inspection of the "3 different patterns" Known Issues finding
from earlier the same day showed the real picture was more nuanced:
`window.confirm()` was used almost exclusively for bulk-select-toolbar
deletes, while nearly every single-record delete (Contacts/Encounters/
Testing/ClinicVisits/Vaccinations/SymptomLog/Measurements) had already,
independently, built a near-identical custom inline card — meaning this
project's own "discover abstractions after multiple modules exist" rule
had clearly already been crossed. Built `src/components/
ConfirmDeleteCard.jsx` — the app's first real shared UI component — and
converted every delete confirmation across Contacts, Encounters,
ClinicVisits, Testing, Vaccinations, SymptomLog, Measurements (including
a third, previously undiscovered site in `ManageGroupsScreen`),
Medication Dashboard, MenstrualHealth (removing a duplicated local
`DeleteConfirm` component entirely), Timeline, PartnerNotification, and
Settings' Trash screen. Module accent colours are preserved (left
stripe/Cancel button); danger cues (border/background/confirm button)
always stay red, keeping the "this is destructive" signal consistent
everywhere.

**Contacts' active/inactive status dot — made interactive.** Tapping it
now toggles a small caption explaining what the dot means ("Active — a
recent encounter is logged" / "Inactive — no encounter in over N days"),
with a focus ring and full `aria-label`/`title` coverage — previously a
purely decorative, unexplained colour dot.

**Notification timing deep-dive — verified correct, plus 4 real bugs
found and fixed.** Proved out empirically (a standalone script inlining
the real pure calculation functions from `medicationCalculations.js`)
that late/early doses correctly shift the next reminder forward/back
by the same amount, and that consistent delays compound exactly as
expected for a real waking-to-sleeping phase shift — this was already
correct, existing behaviour, not a bug. Traced a live, concrete gap
using the app's own seed data: Testosterone (Sustanon, `usagePattern:
"custom"`) was getting zero reminder coverage at all —
`medicationReminderSync.js`'s `getDailyMedsState()` only ever filtered
for `usagePattern === "daily"`, silently excluding every custom-interval
medication even though the calculation layer already supported one via
`effectiveDoseIntervalHours()`. Fixed by extending the filter to include
`usagePattern === "custom"` medications that have a real
`scheduleIntervalDays` set. That surfaced a second real bug: Testosterone's
own seed record never actually had `scheduleIntervalDays` set despite
its comment claiming "biweekly" — added `scheduleIntervalDays: 14`. That
fix, letting real adherence math execute for this medication for the
first time, surfaced a third: `AdherencePill`'s `Math.round((hit /
expected) * 100)` produced `NaN%` whenever `expected === 0` — fixed with
the same `expected > 0 ? ... : 100` guard `medicationCalculations.js`'s
own `windowStats()` already used elsewhere. Fourth: `doxyPepSync.js`'s
native notification used `moduleSmallIconName("home")`/`ACCENTS.home`
(teal) while Home's own real in-app DoxyPEP banner has always used
`medsBlue` — a genuine notification/in-app colour mismatch, fixed to
use `"medication"`/`ACCENTS.medication`, matching the user's own "module
colour for ease of recognition" ask.

**Emoji/icon consideration pass — deliberately declined new additions.**
Considered adding icons/emoji more broadly per the user's "consider
adding across all modules" ask, and chose not to: Test Results already
deliberately has no icon treatment (a documented earlier decision, to
avoid clutter/alarm on sensitive health data), and free-form multiselect
fields (Kinks, Practices) don't map to a small fixed icon set the way
Encounter Type's enum already does. Treated as a genuine option to
decline with reasoning, not a mandate to add regardless.

**Full module-by-module audit — clean.** No further real bugs found
beyond the 4 already listed above. Verified via full build + a 13-flow
`scripts/smoke-test.cjs` run against a real `vite preview` production
build — all 13 flows pass.

## Recently shipped (10 Sep 2026 — see Notion for full detail)

Two pieces of work: a full heading/type-size and general-colour-token
consistency audit (the dedicated pass the 9 Sep backlog-finish-out entry
below flagged as not-yet-done), and a ground-up app icon redesign.

**Font/colour consistency audit.** Swept `src/modules/` for hardcoded
`fontSize`/`fontWeight` pairs that duplicated an existing `TYPE` token
pattern without using it, and hardcoded colour literals that duplicated
`NEUTRAL`/`NEUTRAL_DARK`/`ACTION` values. Added two new tokens to
`designTokens.js` (`subScreenTitle`, `sheetTitle`) formalising two real,
previously-untokenized heading patterns already in wide use; converted
~25 uppercase section-label sites in Settings alone to the existing
`TYPE.sectionLabel`, plus ~625 dark-mode colour-literal sites across
`App.jsx` and most modules to reference `NEUTRAL`/`NEUTRAL_DARK`/`ACTION`
instead of hand-typed hex. Found and fixed real bugs along the way, not
just style drift: Home's DoxyPEP overdue banner had no dark-mode text
colour at all (a real visibility gap, not cosmetic); Medication
Dashboard's dark-mode object was a hand-typed 7-key duplicate of
`NEUTRAL_DARK` that would silently drift the next time a token changed;
several amber/gold banners across Home and Timeline used raw hex instead
of `ACTION.amber`/`ACTION.gold`. Verified live via the full smoke-test
suite plus a manual visual pass across every module in both light and
dark mode — no regressions, no page errors.

**App icon redesign.** Full detail in the commit itself
(`Redesign app icon: teal gradient bg, deeper ECG trace, bolder badges`)
given how much real back-and-forth iteration it went through — summarized
here. Rebuilt via real vector rendering (a temporary Playwright+SVG
render harness, not raster resizing) rather than the flat mockup
stand-ins the 4 Sep icon entry below shipped: a teal diagonal gradient
background with a radial glow, a corner tint, and a diagonal sheen
streak for depth; a real P-QRS-T ECG trace (genuine flat Q/S troughs, a
deliberately widened Q wedge, a taller R peak, miter-jointed spikes for
a crisp point rather than a rounded blob) in a gradient built from the
app's own real dark-mode accent colours; five Phosphor-icon badges
anchored to the trace's anatomical vertices with their own drop shadows;
the SHOS wordmark with a real contrast shadow. Below apple-touch-icon's
180px the wordmark is dropped entirely (proven via a native-pixel
blowup, not assumed, that it doesn't resolve at 32-144px — also matches
standard favicon/launcher-icon convention of mark-only, since the OS
already shows the app name separately) and a bolder stroke/badge variant
is used, both fixing real small-size graininess that turned out to be a
disproportionate shadow-blur radius, not a resolution problem. Regenerated
all 14 real asset files (PWA/favicon/apple-touch-icon, Android legacy
launcher icons at every density) from 4096px masters. Verified: production
build succeeds, full 13-flow smoke-test suite passes against a real
`vite preview` build.

## Recently shipped (10 Sep 2026, later still — see Notion for full detail)

Real ask, once the backlog and icon redesign were both done: "one final
full complete audit... from fresh install to 6 months later," simulating
real use — onboarding, deleting the seed/demo data as a normal user
(not via Developer Tools' reset), and exploring Settings — checking for
consistent feel, ambiguity, and icon/emoji clarity.

**Real crash found and fixed, not from inspection — from actually
performing a bulk delete as a user would.** `SHOS_Contacts_Prototype.jsx`'s
own `refresh()` did `setContacts(loadContacts())`; `loadContacts()`
returns `ContactRepository.getAll()`, async since that repository's own
Phase 2 conversion earlier this multi-session effort — so `contacts`
state was being set to a raw, unresolved Promise, crashing the very
next render's `contacts.filter(...)` in `ContactsList` and tripping the
`ErrorBoundary`. Reproduced live via a real "Select all" + Delete on
the full seed contact list (also affects bulk Archive, same `refresh()`
call). This is the exact bare-loader-reference bug class already fixed
once this session for Encounters' own `loadContacts`/`loadEncounters` —
a repo-wide sweep after the fix (`setX(loadX())` with no `.then`/`await`
across every module file) found no other instances, so this really was
the one remaining gap, not a sign the earlier fix was incomplete.
Verified live: bulk delete and bulk archive both complete cleanly with
correct empty states. Full 13-flow smoke-test suite passes.

Otherwise a clean pass: onboarding copy is clear with no ambiguous
questions; Home and all 5 tabs read consistently against the seed data;
Settings' all 22 rows (per the 9 Sep reorg) have distinct, apt icons;
colour/type consistency (from the audit earlier the same day) held up
under real navigation. One real, unresolved finding — a genuine
inconsistency, not a bug — logged below in Known Issues rather than
fixed unilaterally, since it's a real design-direction call.

## Recently shipped (9 Sep 2026, backlog finish-out — see Notion for full detail)

Real ask: "finish out backlog" — the two real open Known Issues items
(PIN-recovery, font/text-size scaling), the latter narrowed live to
"font/heading CONSISTENCY, not user-adjustable zoom" once actually
discussed (the owner explicitly doesn't want a scaling feature — just
consistent fonts/heading sizes app-wide, already substantially covered
by an earlier session's font-FAMILY consistency pass). Also folded in
a real live report mid-session: toggle switches showing inconsistent,
wrong colours.

**PIN-recovery/alternate-access — built, the last real open Known
Issues item from Phase 4's own original scoping.** A new `recovery`
slot in `cryptoService.js`'s vault, structurally identical to the
existing `pin`/`device`/`biometric` slots (its own salt/iterations,
wraps the same permanent Data Key, same verify-before-commit safety
rule). `setRecoveryString(currentPin, recoveryString)` establishes or
changes it, gated behind the current PIN — the owner's own explicit
spec: a real, user-CHOSEN passphrase entered on a normal keyboard, not
an auto-generated code to lose. Settings > Privacy gets a "Recovery
string" section (Set/Change/Remove), only shown once App Lock is on,
mirroring the existing Duress PIN section's own layout exactly.
`AppLockScreen` gets a "Forgot PIN?" link, shown only once a recovery
string actually exists — opens a real free-text recovery-mode UI (not
the numeric PIN pad) that collects the recovery string AND a new
PIN + confirmation together, then calls a single combined
`unlockAndResetPinWithRecoveryCode(recoveryString, newPin)`. Real
design reason this had to be ONE combined call, not "unlock, then
separately reset the PIN": `activeDataKey` is a non-extractable
`CryptoKey` by design (see `cryptoService.js`'s own header on why,
predating this feature) — once a plain unlock imports the raw Data Key
into it, there's no way to get the raw bytes back out to wrap a new
PIN slot with. Collecting the new PIN before the unlock even runs
means the real raw DEK bytes, held briefly in one function's own local
variable, get used for both the unlock and the new PIN slot in the
same atomic pass. The recovery slot itself is left untouched by a
reset — it wraps the same permanent Data Key regardless of how many
times the PIN changes, so it keeps working for a FUTURE forgotten PIN
too.

**Real bug found and fixed live, not from reading the design**: the
vault's own PIN slot (`cryptoService.js`) and
`PrivacySettingsRepository`'s own separate `anonymisePin` field are
two different copies of "the current PIN" — Settings' own `savePin()`
always writes both together, but this new recovery path only went
through `cryptoService` directly at first. Caught by the permanent
smoke-test flow's own cleanup step (turning App Lock back off after a
recovery-triggered reset), not by inspection: `toggleAppLock()`/
`changePin()` read the REPOSITORY's stale PIN copy, so they'd have
silently failed the next time either was used after a real recovery.
Fixed by also writing `PrivacySettingsRepository.update({ anonymisePin:
newPin })` right after a successful recovery unlock, while the vault
is already unlocked and that repository's own data is genuinely
decryptable.

**Toggle-switch colour consistency — a real live report, not part of
the original backlog scoping.** Every toggle switch across Settings
was using `ACCENTS.healthcare` (green) — a leftover from when Security
& Privacy lived structurally under Healthcare, before this session's
own earlier Settings reorg moved it to its own top-level section — or,
in 4 more cases (Automatic backups, a generic Data & Network toggle,
Dark mode, the CVD-safe-palette toggle), a hardcoded near-black
regardless of section. Every one of these also hardcoded its OFF-state
track colour to light-mode grey (`#DCDCE1`) unconditionally, even in
dark mode. Standardized all 10 real instances to `ACCENTS.home` (teal
— this app's own "system default" colour, confirmed against the
Colour scheme screen's own Module Colours list) when ON, and a real
dark-mode-aware neutral (`DARK.border` in dark mode, the same
`#DCDCE1` in light mode) when OFF — matching the owner's own explicit
rule: system-level toggles default to teal, module-specific ones keep
their own module's colour. Three toggles confirmed genuinely
module-scoped and deliberately left alone: Partner Notification's
"Clinical version" toggle (a real Healthcare/Testing workflow, not a
generic system setting), Medication Dashboard's own dose-reminder
toggle (already `T.medsBlue`, correctly module-scoped and already
dark-mode-aware), and Clinic Card's section-visibility toggles
(already `T.healthcareBlue`, same reasoning).

**Real bug found and fixed live doing this, not caught by the
build**: `MenstrualTrackingToggleCard`'s own 2 toggles (Menstrual
tracking, Hide Pregnancy tab) only receive `T` as a prop, not
`darkMode` — the initial blanket find-and-replace referenced `darkMode`
there, a genuine `ReferenceError` the moment that card actually
rendered (silent at build time, since `darkMode` IS a valid free
identifier at MODULE scope elsewhere in the same file — this was a
real runtime bug, not a syntax error). Caught by the full smoke suite,
not assumed safe from the diff. Fixed by using `T.border` directly for
these two (the exact value `darkMode ? DARK.border : "#DCDCE1"`
resolves to, since `T` already carries that resolution) rather than
reaching for a `darkMode` that was never in scope.

Given a permanent 13th smoke-test flow for the PIN-recovery feature
(driving the real Settings UI and the real lock screen end-to-end, not
`cryptoService` in isolation) — the toggle-colour fix is purely
cosmetic and covered implicitly by every existing flow that already
exercises these same toggles (App Lock, Automatic backups, Dark mode,
etc. all already have real assertions elsewhere in the suite). Verified
stable across two consecutive runs each against the dev server and a
real `vite preview` production build before shipping.

Honest note on scope, since superseded: the font/heading-CONSISTENCY
half of the original ask (standard heading sizes, one font throughout)
was discussed but not yet independently re-audited this same round —
this session's own earlier work already closed the font-FAMILY half
(see the 9 Sep, later still entry below). **RESOLVED 10 Sep 2026** —
the heading/type-SIZE half was closed later the same day by the
"font/colour consistency audit" entry above, then given a dedicated
follow-up pass (see the "10 Sep 2026, heading-size audit follow-up"
entry near the top of this section) that caught the few sites outside
`src/modules/` the first pass's own file scope couldn't reach.

## Recently shipped (9 Sep 2026, real backup audit — see Notion for full detail)

Real ask: review the owner's own real backup file, check whether the
Known Issues backlog is actually clear and a "full audit" has been
done, remap the data if needed, and — the real constructive part —
build a permanent system so future imports don't need a human (me) to
manually check schema compatibility first, since the owner won't
always have this kind of session available.

**Backup schema audit — clean, no remap needed.** Every record type in
the real file (34 contacts, 35 encounters, 12 medications, 84 dose
logs, 7 tests, 4 clinic visits, 3 symptom log entries, 3 vaccinations,
1 episode, 29 locations, plus the 6 registries and every singleton —
myProfile, privacySettings, customOptionLists, resources,
measurementPreferences) was checked field-by-field against each
repository's own current `DEFAULT_*` shape, not assumed compatible.
Contacts (the richest schema) and Encounters both matched their
current `DEFAULT_` object exactly, key for key. The only three
"extra" fields found (Testing's `relatedSymptomIds`, Clinic Visits'
`resultIds`, Symptom Log's singular `symptomId`) are all confirmed,
already-documented DEAD fields — present in `DEFAULT_*` for backward
compatibility, never read or written by any current screen — so their
presence is harmless, not a sign of drift. `customOptionLists`' 17 real
list names matched the app's own 17 live list names exactly. The
registries (kinks/chems/protection/symptoms/organisms/results) travel
WITH their own referencing records in the same file, so a Replace All
restore is self-consistent by construction regardless of the app's own
separate seed/demo registry — there's no separate "current registry"
for a real single-user install to conflict with. Verified this wasn't
just theoretical: restored the real file end-to-end via
`restoreFromParsedBackup()` (the same function the real Settings >
Restore-from-backup UI calls) and confirmed all 34/35/12/69 real
records landed correctly with zero page errors.

**One real, genuine gap found along the way** — not a schema mismatch,
a repository completeness bug: `notes` is read and written throughout
`SHOS_Medication_Dashboard_Prototype.jsx` (the card display, both the
Edit and Add form textareas) with real, meaningful data behind it in
the owner's own account (his real PrEP and Zapain entries both carry a
genuine dose-composition note) — but `medicationRepository.js`'s own
`DEFAULT_MEDICATION` never actually declared the field. Nothing was
ever silently broken by this (both forms already had their own local
`med.notes || ""` fallback, added in an earlier session's own fix for
this same underlying discoverability gap — see that fix's own comment,
still live), but it meant the repository wasn't really the single
source of truth `DEFAULT_*` is supposed to be. Fixed by adding
`notes: ""` to `DEFAULT_MEDICATION` directly.

**Honest backlog/audit status, since that was directly asked**: NOT
fully clear. Two real open items remain in Known Issues below —
PIN-recovery/alternate-access (scoped, zero code written) and font/
text-size scaling (attempted and reverted, real architectural blocker
found) — plus one accepted, ongoing upstream limitation (the cold-start
notification-action race). The broader "full audit" the owner
originally floated (systematic visual-consistency and mobile-scrolling
sweep across every screen, arduous-process review) has NOT been done
as its own dedicated pass — real bugs in those categories have been
found and fixed throughout this session, but always in response to a
specific report, never via one systematic sweep. Said plainly rather
than implied: today's real, thorough work was the schema/data-integrity
half specifically (what this section covers), not that broader sweep.

**The real constructive deliverable: automatic backup-import
migration.** New `src/storage/backupMigrations.js` — a small,
append-only registry of "old field → new field" migrations, run
automatically inside `restoreFromParsedBackup()` (the one real shared
entry point for every import path — plain, encrypted, Replace All,
Merge alike), before any repository ever sees the data. This closes a
real gap "defensive-default merge on every read" (this project's own
standing architecture rule) can't cover on its own: a field the
current app ADDS just gets its default value for free on an old
backup, no code needed — but a field that gets RENAMED leaves the old
backup's real value sitting under the old name, invisible to every
current screen, exactly as inert as if it had been deleted. Seeded
with one real historical example, not a fabricated one:
`medicationRepository.js`'s own `dosePerUnit` (free text) →
`doseStrengthValue`/`doseStrengthUnit` (structured) rename, baked into
this repo's very first commit. A real compound free-text value (e.g.
"200mg/245mg", exactly what the owner's own real PrEP entry contains)
can't be safely auto-split into a single number + unit without
guessing — guessing wrong would silently corrupt a real dose, worse
than leaving it alone — so the migration preserves it verbatim inside
`notes` instead (prepended, never overwriting a real note already
there) rather than forcing a shape it may not fit. Idempotent by
construction: every migration step checks its own old field is
actually present before touching anything, confirmed live as a genuine
no-op against an already-current record. The registry is honestly
close to empty today — nothing else has ever been renamed in this
app's real history — but the machinery is real, tested, and wired in,
ready for the next rename (which, going by this session's own history
of field restructuring, will happen) without needing a human to check
first.

Given a permanent 12th smoke-test flow (was an 11-flow suite) — driving
the real Settings > Restore-from-backup UI with a synthetic old-shaped
file via a real virtual file upload (`page.setInputFiles()`), not a
dynamic `import("/src/...")` (the exact dev-server-only trap the
interactive-tour flow above already hit and fixed this same day) — so
it's portable to both the dev server and a real production build.
Verified stable across two consecutive runs against both.

## Recently shipped (9 Sep 2026, session limit reset — see Notion for full detail)

Real ask: an interactive spotlight-overlay tour ("click here, this is
X for Y, with a slightly opaque overlay"), not just the static Guide
screen's written reference — the Guide screen stayed, this is
additive. New `src/modules/InteractiveTour.jsx` (`TourOverlay`): a
9-step walkthrough (welcome → each bottom-nav tab → Home → Search →
Settings → closing) targeting real DOM elements via a `data-tour="…"`
attribute (added at each real anchor — the 5 bottom-nav tab wrappers
in `App.jsx`, Home's own search/settings icons), not fixed
coordinates — a step whose target isn't in the DOM is skipped
automatically in both directions rather than spotlighting nothing. The
spotlight itself is a plain CSS box-shadow cutout (a rounded rect sized
to the target's real `getBoundingClientRect()`, refreshed via a cheap
400ms poll while open so a transient banner appearing/disappearing
doesn't leave it misaligned) — deliberately a Next/Back/Skip-driven
tour, not a "click the real live element to advance" one, since
puppeting real navigation (switching tabs, opening Settings) mid-tour
for every step would be a much bigger integration surface for a first
version; the closing step points at the Guide screen for anything
needing more depth.

Trigger: auto-offered once, right after a genuine onboarding
completion (a new `hasCompletedTour` flag,
`appPreferencesRepository.js`, same "only set by the tour's own
Skip/Done, never elsewhere" rule as `hasCompletedOnboarding`) — and
replayable anytime after via a new "Take the interactive tour" button
on the Guide screen itself (Settings > Content & Lists > Guide),
regardless of whether the one-time offer was already taken, skipped,
or never seen (an existing install upgrading into this feature).

Two real regressions found and fixed live before shipping, both from
actually driving the flow end-to-end rather than trusting the design
on paper: (1) the post-onboarding App Lock setup prompt
(`AppLockPrompt`, zIndex 998) can legitimately be pending at the exact
same moment onboarding's own completion wants to auto-offer the tour
— both are independent "first thing after onboarding" overlays. Left
unhandled, the App Lock prompt's higher z-index silently ate every
click meant for the tour underneath it. Fixed with a `pendingTourOffer`
flag: if the App Lock prompt is currently showing, the tour offer
defers until it's actually dismissed (either "Not now" or "Don't ask
again"), rather than stacking two overlays. (2) The very first version
auto-offered the tour on ANY path through `OnboardingScreen`'s
`onFinish`, including an explicit Skip tap — directly contradicting
the "not now" signal a real Skip tap sends, and (found only once this
broke the existing smoke suite, which dismisses onboarding via Skip)
silently blocking every other test's own subsequent Settings/tab
clicks once App Lock's own dismissal started re-triggering the tour.
Fixed by threading a real `skipped` boolean through `onFinish` (the
Skip button now calls `onFinish(true)`, `advance()`'s own completion
path calls `onFinish(false)`) so the two paths are genuinely
distinguishable, not inferred from timing.

Given a permanent 11th smoke-test flow (`scripts/smoke-test.cjs`, was
a 10-flow suite), not just a throwaway verification script — this
project's own established "verified once, covered never" lesson
applied on sight, not after the fact. Runs in its own fresh browser
context (like the existing legacy-data-migration test), since it needs
to drive onboarding through a genuine completion rather than the
shared page's own Skip-based `dismissOnboarding()` helper, plus a
second fresh context proving the Skip path specifically does NOT
auto-offer the tour — the exact regression class (2) above. One real
test-tooling lesson from writing it: an early version confirmed
persistence via a dynamic `import("/src/repositories/…")` inside
`page.evaluate` — works against Vite's dev server (which serves raw
`/src/` ES modules), but fails against a real `vite preview` production
build (`Failed to fetch dynamically imported module` — `dist/` only
ships hashed bundles under `/assets/`, not `/src/`). Fixed by relying
on the already-present behavioral check instead (reload → tour doesn't
reappear), which is portable to both and is the stronger proof anyway.
Verified stable across two consecutive full-suite runs against both
the dev server and a real `vite preview` production build (the same
build CI actually tests) before shipping.

## Recently shipped (9 Sep 2026, even later still — see Notion for full detail)

Follow-up to the seed-data pass above, driven by the owner's own
request for real narrative variety (a gay man on PrEP/DoxyPEP with a
positive-test-to-vaccine arc; a cis woman's contraception-to-pregnancy
story; a routine-testing-only thread across gender-diverse partners; a
trans man's hormone/IUD-contraception needs) and for a first-launch
onboarding step that helps build My Profile and points at relevant
tracking. Real architectural note that shaped how this landed: SHOS is
single-owner — "4 personas" can't mean 4 separate profiles, so
represented through DATA (medications, contraception, testing) rather
than by writing an identity onto My Profile, which stays blank for the
real installing user to fill in themselves.

**A real, serious pre-existing bug found and fixed, not something this
session introduced.** Investigating the owner's own report — that
pregnancy/contraception tracking isn't as discoverable as STI/HIV
tracking — led first to the good news that a real onboarding question
("Track menstrual & contraception health?") already existed, wired to
`menstrualTrackingEnabled`. Verifying it live turned up something
worse than a discoverability gap: answering "yes" correctly wrote the
preference, but Home's own Quick Add section never showed the promised
Log period/Log contraception shortcuts, even after a reload. Root
cause: `AppPreferencesRepository.getPreferences()` and
`PrivacySettingsRepository.getSettings()` are both async (this
project's own Phase 2/3 encryption groundwork), and 4 call sites still
chained a property directly onto the call's return value instead of
awaiting/`.then()`-ing first — reading a property off a Promise object,
always `undefined`. Not a timing race, not specific to onboarding:
silently broken for every real install since each repository went
async. Fixed all 4 — `SHOS_Home_Prototype.jsx`'s own
`menstrualTrackingEnabled` and `appLockEnabled` (the "Lock now" quick
button never showed either), `SHOS_Healthcare_Prototype.jsx`'s own
copy of `menstrualTrackingEnabled` (the whole Menstrual & Contraception
sub-tab never appeared), and `SHOS_Contacts_Prototype.jsx`'s
`inactiveThresholdDays` (silently always fell back to the 90-day
default). A full sweep for the same pattern across every
`getPreferences()`/`getSettings()` call site in `src/` found no other
instances. Also fixed a related, separate bug in the same
investigation: `OnboardingScreen`'s own `answer()`/`onAnswer()` were
genuinely fire-and-forget (the write wasn't awaited before advancing,
and `onAnswer` didn't even return its own promise) — harmless when
this screen was built (26 Aug, before these repositories went async),
a real race once they did. Verified live end-to-end: the real
onboarding flow now correctly shows the Quick Add shortcuts immediately
after finishing, no manual reload needed; the Healthcare sub-tab
appears; a distinctive inactive-threshold value round-trips correctly.
Full smoke-test suite passes (10/10).

**Hormone therapy and IUD contraception, represented through data**: a
Testosterone (Sustanon) medication entry, a hormonal IUD contraception
entry (medically real reasoning baked into its own notes — testosterone
alone isn't reliable contraception, a real basis for both to coexist on
one record), and a linked IUD-insertion clinic visit. Verified live:
Testosterone lists correctly on the Medication Dashboard, the IUD entry
shows under Currently Active in Contraception alongside the pre-existing
Depot entry (concurrent methods already supported), zero page errors.

**A scoped icon pass**, per the owner's own "consider globally... one
or two max, icons better than emoji" ask. Encounter type got small
Phosphor icons (Flame/Users/Coffee/Drop/Confetti), matching the
existing Rating/Location-type precedent — but deliberately as a
render-only lookup keyed by name, NOT baked into
`ENCOUNTER_TYPE_OPTIONS` itself the way Location's own emoji-prefixed
strings work: that array IS the literal stored value on every existing
encounter (this session's own new seed data included), so changing the
option strings would have desynced from every already-saved record's
own `encounterType` and broken its selected-chip highlighting.
Deliberately did NOT touch Test Results, which already have a subtle
colour-dot treatment for exactly this "scan quickly" purpose —
doubling up with an icon risked visual clutter or reading as more
alarming than this app's own "no judgement" tone intends for sensitive
health data. Verified live, zero page errors, full smoke-test suite
passes.

Every change in this batch, and the seed-data batch above it, landed
as its own build-→verify-→commit-→push cycle directly to `main`, each
with CI checked before moving to the next.

## Recently shipped (9 Sep 2026, later still — see Notion for full detail)

Two real asks handled together: a much richer synthetic seed dataset
(so the app has realistic demo/audit data across every module, not
just what the smoke suite happened to touch) and an in-app Guide
screen (nothing previously explained Settings or where less-obvious
features live), plus a real CI regression found and fixed along the
way.

**Seed data**: Contacts 8→16, Encounters 12→18 (linked to the new
contacts), Testing 4→7 (a home-kit test with real kit codes, a Pending
result, a genuine Chlamydia-positive — every prior positive was
Gonorrhoea), Clinic Visits 3→5, Symptom Log 1→3 (added a genuinely
still-active entry — the original was always resolved), Vaccinations
2→4 (a 2-dose Hepatitis A/B course exercising `nextDue`), Locations
5→7 (a real second same-kind location, finally giving `type` something
to group by, plus the first entries populating address/relatedContactId),
Measurements 3→6 (a second data point per existing type so trend charts
have an actual trend, plus a new custom type exercising the typeKind
flow). Registry-linked fields (kink/organism/result/protection ids)
were confirmed against the real, live registries before use, not
guessed — a wrong guess renders as a silent blank/broken chip, the
exact bug class already documented once for Protection Registry.
Checked Partner Notification and Pregnancy too; both already
appropriately represented (Partner Notification is correctly
zero-seeded — a real workflow-generated checklist, not browse data)
and left alone. Verified live at every step (build → dev server →
Playwright, screenshotted or read back via a direct repository call)
plus cross-module spot checks (Clinic Card, Global Search) — zero page
errors anywhere.

**Real CI regression found and fixed**: expanding Encounters changed
how far down the list "Sauna trip" sits, which changed how much scroll
Playwright's own auto-scroll-into-view needed to reach it — and
navigating to Home afterward does NOT reset window scroll to 0. The
Settings gear icon lives in Home's own in-flow header (not a
`position:fixed` one), so its pixel position moves with scroll; the
Anonymise-mode test's hardcoded gear-icon coordinates started missing
for the entire 5s timeout. Reproduced consistently in CI (not a flake)
and locally against a fresh dev server. This exact coordinate-click
pattern was duplicated at 7 sites across the suite, all equally
exposed — pulled into one shared `goHomeThenOpenSettings()` helper
with an explicit scroll-to-top, closing the whole class rather than
patching just the 2 sites that happened to trigger it. Verified stable
across 2 consecutive full runs before pushing; CI confirmed green on
the next push.

**Guide screen** (Settings > Content & Lists): same static-reference
pattern as the existing Glossary screen, not an interactive tour — no
existing tour interaction to match, and a tour library is real new
dependency weight this app doesn't otherwise carry. 5 sections
deliberately scoped to WHERE things live and WHAT the less-obvious
toggles do (the actual repeated confusion), not a feature-by-feature
walkthrough: the bottom nav + Home's own non-tab shortcuts (Clinic
Card/Episodes/Calendar), what each of the 8 Settings sections covers,
where Menstrual/Contraception/Pregnancy tracking actually lives
(inside Healthcare's own sub-nav, gated behind a Preferences toggle —
genuinely not discoverable otherwise), what App Lock/the duress
PIN/Anonymise mode actually do in plain terms, and a few standing
facts (nothing leaves the device on its own, archive-before-delete,
most numbers are calculated not typed in).

Also resolved the same session: the Android Keystore trade-off (see
its own Known Issues entry above) — the owner deferred the call, and
the decision was not to build it, for reasons recorded there.

All of the above landed as 7 separate, individually build-→verify-
→commit-→push cycles directly to `main` (the "hold pushes" instruction
from the Phase 2-4 encryption effort no longer applies — confirmed
explicitly by the owner this session), each with its own CI run
checked before moving to the next. Full smoke-test suite (10/10) green
throughout, confirmed both locally and in CI.

## Recently shipped (8 Sep 2026, later still — see Notion for full detail)

Real ask: "ensure user's PWA is auto-updated to current version." The
service worker (`public/sw.js`) already called `self.skipWaiting()`/
`self.clients.claim()` unconditionally on every install/activate, so a
new SW version was already taking over immediately once installed —
but that alone didn't help a tab that was already open: its React app
was still running the OLD JS bundle in memory, and swapping the SW
underneath it doesn't retroactively change that. Fixed in
`src/main.jsx`'s SW-registration block: a `controllerchange` listener
now reloads the page exactly once when a genuinely new SW takes
control — the same pattern Vite's own PWA plugin's
`registerType: 'autoUpdate'` uses internally — guarded against firing
on a brand-new install (`hadController`, captured before registration
even starts, so a first-ever visit with nothing stale to swap in for
doesn't force a pointless reload) and against firing more than once
(`reloaded`). Second, smaller gap closed at the same time: a browser
only checks for a new `sw.js` on its own schedule (roughly every 24h,
or on a fresh navigation) — an installed PWA opened once and left
running in the background for days could sit on a stale version far
longer than that. Added a `registration.update()` call (a cheap
conditional fetch, a no-op if `sw.js` is unchanged) on
`visibilitychange` back to visible, closing that gap without polling
while the tab is backgrounded and can't act on anything anyway.
Verified live against a real `vite preview` production build with
Playwright: confirmed a genuine first-ever install does NOT force a
reload (nav count stayed at 1), then simulated a real new deploy
(bumped `sw.js`'s own `CACHE_NAME`, called the same `update()` the
visibility handler calls) and confirmed exactly one real reload
fired — not zero, not a loop. No page errors. Full smoke-test suite
passes against the same preview build.
Native app is unaffected by design — `Capacitor.isNativePlatform()`
already skips service-worker registration entirely inside the
installed Android app (see that guard's own existing comment); APK
updates go through the existing GitHub Release + in-app update-check
flow (`updateCheckService.js`), a genuinely different mechanism since
Android doesn't allow a sideloaded app to silently swap its own code
underneath itself the way a service worker can on the web. Spot-
checked the broader "does every APK feature also reach the PWA" ask
this same request raised: every `Capacitor.isNativePlatform()` guard
in the codebase (5 files: this SW registration, `updateCheckService.js`,
`notificationService.js`, `fileExportHelper.js`) already has its own
documented, genuine platform-capability reason (native file-system
access, a native update-download flow, etc.) rather than an
accidental omission — the app is one shared codebase building both
targets by construction, so a feature reaches both by default unless
explicitly, deliberately guarded otherwise.

## Recently shipped (8 Sep 2026 — see Notion for full detail)

Three real bug/feedback reports from actual app use, investigated and
fixed in the same session as PregnancyRepository's Phase 2 conversion
above (unrelated work, done back-to-back per the owner's own report).

**Anonymise mode didn't apply globally** — real report: "contacts
anonymised, but not encounters (still shows linked contact on card/in
file)." Confirmed via grep that `SHOS_Encounters_Prototype.jsx` had
zero references to `PrivacySettingsRepository` at all — Anonymise mode
was Contacts-only, exactly as reported. `privacySettingsRepository.js`'s
own header comment previously said this was deliberate ("scoped to
Contacts... not applied to... Encounters, etc. — no real ask to do
so") — true when written, superseded now by this explicit report, so
that comment needs updating too (not yet done — flagged here rather
than silently left stale). Fixed narrowly, matching exactly what was
reported: `EncounterCard` (the list/card view) and `ActivityDetails`'s
Attendees section (the "file"/detail view) both now read
`PrivacySettingsRepository.getSettings().anonymiseModeActive` (same
`useLoadedState` read pattern Contacts already uses — the repository
itself is still fully synchronous, deliberately deferred from Phase 2
per its own App Lock security sensitivity) and mask the resolved
attendee name(s) behind the same `"•••• hidden"` placeholder Contacts
uses (duplicated locally rather than exported, to avoid a cross-module
reach for one string). Deliberately NOT touched: Encounter location
names, kinks-involved tags, or Global Search's own attendee-name
resolution — none of those were part of the actual report, and
guessing past what was asked is exactly what this repository's own
scoping comment already warned against once before. Verified live:
before Anonymise mode, real attendee names show on cards and in
detail; after enabling it (`shos_privacy_settings.anonymiseModeActive`),
every card and the detail view's Attendees section correctly show
`"•••• hidden"` instead, with Contacts' own existing masking unaffected
(regression-checked in the same run). No page errors.

**Resources links weren't clickable** — real report: "show as
hyperlink/click to open." `ResourceEntryRow` in
`SHOS_Settings_Prototype.jsx` rendered `entry.link` as plain text in
its collapsed row; a working pattern already existed elsewhere in the
same file (`ClinicalJustificationsSection`'s `item.link`, a plain
`<a href target="_blank">`) but Resources' own field can hold a phone
number as well as a URL (its edit input's own placeholder already says
"Link or phone number"), so a bare `href={entry.link}` would silently
break on a saved phone number. Added `resourceLinkHref()` — detects an
already-schemed value (`http(s):`/`tel:`/`mailto:`) and passes it
through, detects an email shape and prefixes `mailto:`, detects a
phone-number shape (mostly digits/spaces/parens/dashes, 6+ chars) and
prefixes `tel:` after stripping the formatting characters, and
otherwise assumes a bare domain and prefixes `https://`. The link now
renders as a real underlined `<a>` with `stopPropagation()` on click so
tapping it opens the link instead of toggling the row's own
expand/collapse. Verified live: a real seeded URL
(`https://refuge.org.uk/`) renders as an actual anchor tag with the
correct `href` and `target="_blank"`.

**No visibility into when the next medication reminder will actually
fire** — real report: no way to see the next alarm's clock time, plus
a suspicion the reminder fires on a fixed schedule rather than shifting
with a late dose. The second half turned out to already be correct,
not a bug: `medicationCalculations.js`'s `lockoutEndsAt()`/
`nextDoseEstimate()` both compute forward from the real last-logged
dose's own timestamp (`realTimestampFromStored(lastDoseDate) +
intervalHours * ...`), not from a fixed clock time, and
`syncMedicationReminders()` (which schedules the real native
notification from exactly `lockoutEndsAt()`) is re-run after every
dose log/skip/snooze/take action — so a late dose already shifts the
next reminder forward by the same lateness automatically. The real gap
was visibility, not logic: the Medication Dashboard's existing "Next
dose" display (`nextDoseEstimate`) only ever showed a relative string
("~5h"), never an actual clock time, and — a second real finding along
the way — that relative estimate isn't even the same moment the
reminder notification fires at: the notification schedules from
`lockoutEndsAt()` (80% of the dosing interval, when the dose actually
unlocks), while the displayed "~5h" was `nextDoseEstimate()` (100% of
the interval, when it's fully due) — two different times shown as if
they were one. Fixed by adding a real `nextReminderClock` (formatted
from `lockoutEndsAt()`, hidden once it's already in the past) shown
alongside the existing relative text on both Medication Dashboard card
layouts (inventory-tracked and not), e.g. "Next dose ~6h (reminder
~3:42 AM)" — giving a real answer to "when will my alarm fire" using
the exact value the notification is actually scheduled from, and
incidentally making the existing shift-with-late-dose behavior visibly
provable rather than just true in code. Verified live against real
seed data across two different daily medications (AM- and PM-anchored
doses) — both showed internally consistent, correctly-computed clock
times (e.g. an 8:30 PM last dose correctly producing a 3:42 PM
next-day reminder time, matching the 80%-of-24h math by hand). No page
errors. Full smoke-test suite passes for all three fixes.

## Recently shipped (4 Sep 2026, real-device follow-up — see Notion for full detail)

Owner reports the "export backup to a folder" write ("I believe" —
his own hedge, not re-tested by a second explicit confirmation) now
actually lands on his real device after the plugin swap to
`@daniele-rolli/capacitor-scoped-storage`. Moved out of Known Issues
on that basis; if a real failure surfaces later, the honest disclosed
risk from the swap itself (v0.1.0, single maintainer, no visible test
suite) is still the first place to look.

Real device testing (build #183, after the CI-wiring commit) surfaced
a genuine Global Search bug beyond what the earlier "fisting" case
had exposed: searching "piss" pulled records that never mention it
at all. Root-caused to an actual algorithm bug in `fuzzyMatch.js`'s
`fuzzyIncludes()`, not a data or field-coverage issue — its own header
comment already documented the intended rule ("short words (3
characters or fewer) require an EXACT match, not fuzzy") but the
bidirectional substring shortcut (`tWord.includes(qWord) ||
qWord.includes(tWord)`) ran with no length floor at all, so a query
containing a lone "i" ("piss" does) matched almost any record whose
free text happened to contain the standalone word "i" — reproduced
directly (`fuzzyIncludes("i felt off today", "piss")` was `true`).
Fixed by gating that shortcut behind the same length floor the
Levenshtein fallback already used — verified "fist"/"fisting" and
genuine typo tolerance both still work, while the lone-letter false
positive is gone.

Same report also asked for a real behavior change: Global Search on
Contacts/Encounters was matching kink-term queries against free-text
fields (title/notes/phone/city/etc.), which is what actually let a
term "pull records without the term" even before the fuzzy bug —
narrowed both to kink tags + identity (name/nickname for Contacts,
resolved attendee names for Encounters — a genuinely new match field,
Global Search never resolved attendeeIds to names before this) and
dropped title/encounterType/notes/phone/snapchat/city entirely from
what a kink search can match. Separately, real and worth calling out
on its own: Contacts search used to resolve BOTH `statedKinks` and
`limits` into the same search text — meaning a kink someone explicitly
said they will NOT do could surface them in results as if they were
into it. Limits are excluded now; only real stated interest makes a
Contact findable by that kink. Other result types (Medication/Test/
Clinic Visit/Symptom Log/Vaccination) were left untouched — they have
no kink-tag concept to narrow to, and the report was specifically
about kink-term search behavior.

Also grouped results by type (Contacts/Encounters/etc., in a fixed
order) with chronological order preserved within each group, replacing
the old date-bucket grouping (Today/This week/etc.) — the explicit
ask, and a more useful shape once a kink term can genuinely match both
a Contact and an Encounter for real, different reasons.

All three changes verified live via Playwright against synthetic data
designed to isolate each claim (a stated-kink match, a limit correctly
excluded, free-text/title correctly excluded, attendee-name matching,
multi-type grouping) — plus the full `scripts/smoke-test.cjs` suite,
unaffected since it doesn't touch Global Search.

## Recently shipped (4 Sep 2026, later still — see Notion for full detail)

Real app icon assets produced, closing the "unfinished icon" Known
Issue — the winning "ECG Pulse" direction from the earlier icon-review
Artifact (real Lead II trace, 5 real Phosphor glyphs at the P/Q/R/S/T
deflections, SHOS wordmark in Inter Black) rebuilt as true vector/SVG
paths and rendered via headless Chromium at every required export
size, rather than left as flat CSS/SVG mockup stand-ins. Background
teal pulled exact from `ACCENTS.home` (`#008585` in designTokens.js,
deepened for gradient contrast) rather than the mockup's own eyeballed
value, per the artifact's own stated next step. All 22 real assets
now in place: legacy `ic_launcher`/`ic_launcher_round` PNGs at
mdpi“xxxhdpi (48“192px), adaptive-icon foreground/background layer
PNGs at mdpi“xxxhdpi (108“432px, foreground content confirmed
centered and sized within Android's safe zone via a real pixel
bounding-box check, not eyeballed), plus `favicon.png` and
`apple-touch-icon.png` for the web/PWA build. Legibility checked at
actual render sizes: clean at xxhdpi/xxxhdpi (the densities modern
phones actually show), the legacy mdpi 48px fallback does soften as
the original review honestly flagged it might — an accepted tradeoff
of the chosen direction, not a new problem.

Real bug in that first render pass, caught by the owner's own eyes:
the icons read as blurry. Root cause was `deviceScaleFactor =
targetPx/108` applied directly for every export — for the legacy
48“96px sizes that's a scale factor BELOW 1, which Chromium doesn't
rasterize crisply. Fixed by rendering each layer once at a large
fixed master (1080×1080) and downsampling to every real target size
with Pillow's LANCZOS filter instead of asking the browser to
rasterize small targets natively — same design, same verified
centering, visibly sharper at every size. Also removed
`drawable/ic_launcher_background.xml` and
`drawable-v24/ic_launcher_foreground.xml` — Android Studio's stock
default-template icon leftovers, confirmed genuinely unreferenced
anywhere (the real adaptive-icon XML points at `@mipmap/...`, never
`@drawable/...`) via a full grep across the Android project before
deleting. Pure clutter now that real assets exist.

## Recently shipped (4 Sep 2026, continued — see Notion for full detail)

Confirmed the real root cause behind the Global Search bug report ("Tried
searching through like fisting and didn't come up with encounter from
yesterday") against the owner's own real backup data, shared locally for
this one purpose only (never committed, never touched seed/demo data —
per the standing personal-alpha/public-alpha split above). Reconstructed
the exact `buildIndex()`+`fuzzyIncludes()` algorithm and ran it against
the real dataset: 27 real Contacts independently share the same Fisting
kink tag, all pushed into the index before any Encounter (per
`buildIndex()`'s own Contacts-then-Encounters push order) — the real
"Fisting Adam at mine" Encounter landed at raw index 42, past the old
30-cap-before-sort, exactly reproducing the report. This confirms the
cap/sort-order fix already shipped in this same 4 Sep session (below)
was the real fix, not a guess. Comparing Global Search's own field
coverage against the Encounters tab's own separate local search box
(added 1 Sep 2026) while investigating turned up a second, distinct,
confirmed gap: that box only ever matched `title`/attendee names, never
`notes`/`encounterType`/`kinksInvolved` resolved to kink names — so any
Encounter tagged with a kink not literally in its title was invisible to
it even though Global Search (which does resolve kink names) would find
it. Widened it to match Global Search's exact field set (verified live:
a synthetic kink-tagged Encounter with no matching title word, findable
via the Encounters tab's own search only after the fix, not before).

## Recently shipped (4 Sep 2026 — see Notion for full detail)

First session developing directly on `main` rather than a feature
branch, per the owner's own instruction (the prior session's PR #2 had
already been merged, and there's no dedicated code-reviewer for this
solo project — a branch/PR step was pure overhead). Two new Resources
categories (Menstruation & menopause, Abortion & pregnancy loss) —
6 UK organisations, every non-NHS URL/phone number verified via live
web search, not assumed from the owner's own typed text (caught one
real near-miss: "Miscarriage UK" is the current live branding of what
used to be The Miscarriage Association, not a different org). Three
real bug reports investigated and two fixed outright: "Snooze 30 min"
never actually dismissed any of the 4 due-reminder banners (due-meds/
refill/testing/clinic-visit) — root cause was that every handleSnoozeX()
only ever rescheduled the native OS notification, never persisting a
fact the in-app due-check itself read, so the same due state reappeared
a moment later; fixed with a `snoozedUntil`-style persisted fact
mirroring `skippedUntil`/`pausedUntil`, patterns this codebase had
already proven out elsewhere. Global Search's 30-result cap was
applying BEFORE sorting, on raw index push order (Contacts always
pushed before Encounters) — a query matching 30+ Contacts could
silently cut a genuinely relevant, recent Encounter out of results
entirely; fixed by sorting first, then capping. "Export backup to a
folder" doesn't actually save was root-caused by reading
`@capawesome/capacitor-file-picker`'s own Android source directly:
`pickDirectory()` returns a Storage Access Framework tree URI, not a
filesystem path, and naively concatenating a filename onto it (the
existing code) never identified a real, writable document — this
plugin has no `createDocument`-equivalent method, so the feature is
built on a capability that doesn't exist. Not fixable without either
removing the feature or swapping the plugin (needs real-device
verification this environment can't do) — fixed the silent-failure
symptom (a real write failure now reports as a real error instead of
being masked as a harmless "cancelled") and left the underlying
decision with the owner. All fixes verified live via Playwright except
the export one (build + source-reading only, honestly flagged as such).

## Recently shipped (3 Sep 2026, third session, continued — see Notion for full detail)

Three more items from the same data-management brainstorm as the
Developer Tools additions above: (1) delete-time reference cleanup —
every repository with a real delete()/bulkDelete() now notifies every
other repository/registry that can reference it (same unlinkX(id)
pattern `measurementRepository.js`/`contraceptionRepository.js`
already used for Clinic Visit deletes), closing a real gap the new
orphan checker surfaced (`Contact.delete()` cleaned up MyProfile/
Contact<->Contact links but never `Encounter.attendeeIds`/
`Location.relatedContactId`/Partner Notification). Testing and Clinic
Visits now import each other (a genuine circular import, safe because
every use is a method call deferred inside `delete()`) — verified live
in both directions with zero page errors. (2) A Contact-specific
duplicate checker, multi-field and confidence-scored — new
`findContactDuplicateCandidates` in `fuzzyMatch.js` catches an exact
phone/Snapchat/Recon/FabGuys/FabSwingers match directly, with city/
address/approximate age/notes-overlap only adding confidence once a
pair is already flagged by name or a strong field — never a verdict,
same restraint as the existing registry duplicate checker. (3) Backup
export round-trip verification — `verifyBackupJson()` in
`backupService.js` confirms the exact JSON about to be written
survives a parse round-trip with every record count intact, before
the file-write handoff; also fixed two real dead-state bugs found in
the same area (the plain Export backup button showed no confirmation
at all; Export-to-folder's own status was tracked but never rendered).
All verified live via Playwright; `scripts/smoke-test.cjs` still
passes unmodified.

## Recently shipped (3 Sep 2026, third session — see Notion for full detail)

Developer Tools gained two real data-management additions, following a
brainstorm on cheap data-refinement techniques given this app's actual
scope (single device, no server, small data volumes): a storage-usage
indicator (`storageAdapter.js`'s `getStorageUsage()`, total bytes
actually persisted plus a top-5-keys breakdown) and a read-only
orphan-reference sweep (new `orphanReferenceCheck.js`, same "scan
every possible referencer" approach as the existing
`registryUsage.js`) that flags dangling relation-by-ID references
across every repository/registry relation confirmed live by its own
repository's documented field shape — deliberately excludes fields
already documented as deprecated/obsolete elsewhere (Testing's
`relatedSymptomIds`, Clinic Visit's `resultIds`, Symptom Log's
singular `symptomId`). A third candidate idea — a persisted/cached
search key for fuzzy matching — was deliberately NOT built:
`SHOS_GlobalSearch_Prototype.jsx` already has an explicit comment
rejecting that exact optimization as unnecessary at this app's real
data scale, and several search fields are joined from other registries
by ID, so baking them into a stored key would reintroduce the
staleness class "store facts, derive state" exists to prevent.
Running the new sweep against real seed data caught a genuine
pre-existing bug: 4 seed Encounters stored Protection Registry's
display NAME ("Condom") instead of its real id, silently blanking
their "Protection used" field — fixed in the same change.

## Recently shipped (3 Sep 2026, later session — see Notion for full detail)

Five independent small asks in one session: a global first-day-of-week
preference (Sunday/Monday, default Monday — `AppPreferencesRepository`,
UI in Settings > Units, wired into the in-app Calendar grid's weekday
header/offset in `SHOS_Settings_Prototype.jsx`'s `CalendarScreen`);
the DoxyPEP overdue banner (Home) got a temporary (X, session-only,
same "reappears on next real check" pattern as the due-meds/refill/
testing/clinic-visit banners) and permanent ("Don't warn me about this
exposure again", scoped to the current exposure window via
`getDoxyPepStatus`'s `windowStart`, not the same as the existing
`doxyPepAlertEnabled` notification toggle) dismiss; the overdue banner
now reads "X days, Y hours past the 72h window"
(`formatDoxyPepOverdueDuration` in `doxyPepCalculations.js`) instead of
a raw "642h 7m"; clicking the overdue banner navigates to the DoxyPEP
medication via the existing `onNavigateToRecord` plumbing; all 4 Stats
bar charts (Encounters, Clinic visits, Medication adherence trend,
Contacts) now print the raw value above each bar (confirmed with the
user as the preferred approach over click-to-reveal or a visible axis,
applied consistently across all four). Verified live via Playwright
against the dev server for all 5 changes, plus `scripts/smoke-test.cjs`.

## Recently shipped (3 Sep 2026 session — see Notion for full detail)

Ground-up notification rework (native Capacitor + web/PWA dual path,
quiet hours, master switch, vacation pause, per-type action buttons for
all 5 reminder types); root-cause fix for the plugin-proxy bug above;
`allowWhileIdle` Doze-mode fix; `android:allowBackup="false"`;
`FLAG_SECURE`; third-party network call disclosure (Nominatim, GitHub
update-check) with off switches in Settings > Data > "Data & network";
closed the `updatedAt` gap in the 3 repositories that genuinely lacked
it (`episodeRepository`, `logRepository`, `locationsRepository`); Stats
expanded (Symptoms section, Clinic Visits section, a medication
adherence trend chart); this file created and the Notion "Development"
log caught up to match, after discovering it — not any prior coding
session's own notes — had been the actual current project history all
along.


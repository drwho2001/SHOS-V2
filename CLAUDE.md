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
- `scripts/smoke-test.cjs` — 3 flows, CI-wired (see above) but also
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

## Known issues (as of 4 Sep 2026 — update this section as things change)

Full evidence trail for these lives in the build-audit artifact from
this date; summarized here for durability.

- **No encryption at rest.** Live app data is plain `localStorage`.
  Backup export *can* be encrypted (AES-256-GCM, PBKDF2 250k rounds —
  solid where it's used) but day-to-day data isn't. This is the one
  Critical finding deliberately not yet fixed. Real scoping done 4 Sep
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
  Local commits only as of 4 Sep — owner asked to hold all pushes until the
  full Phase 2 migration is done and reviewed, not push incrementally
  (side-branch pushes to `claude/encryption-phase2-groundwork` purely to
  trigger the Smoke Test CI workflow for verification are fine — `main`
  itself, which triggers the real APK/web builds, is not touched).
- **Still near-zero real test coverage, though the one existing script
  is now CI-gated.** `scripts/smoke-test.cjs` (3 flows) got wired into
  a new `.github/workflows/smoke-test.yml` (4 Sep) — runs the exact
  same script, unmodified, against a real `vite preview` production
  build on every push to `main`, verified locally against that same
  preview build before shipping. Still only 3 flows, still no
  linting, no type-checking — this closes "nothing runs automatically"
  specifically, not "not enough coverage" generally. The absence of
  any of this is very likely why a real, four-subsystem-breaking bug
  (a Capacitor plugin-proxy footgun affecting notifications/calendar-
  sync/geolocation/file-export) shipped silently for weeks before live
  device debugging caught it.
- **Cold-start notification-action race** — a still-open upstream
  Capacitor limitation (not fixable purely from this app's JS): tapping
  a notification action after the app was fully killed can fail to
  reach the JS listener if the event fires before React mounts. Partial
  mitigation shipped (an early listener buffer in
  `notificationService.js`); the due-meds banner is the real safety net
  for a missed tap.
- Registry-entry merge, per-value icons within a registry, and a true
  no-code schema editor are deliberate scope cuts, not gaps — don't
  rebuild without a real, demonstrated need (see "avoid over-normalisation"
  above).

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
mdpi–xxxhdpi (48–192px), adaptive-icon foreground/background layer
PNGs at mdpi–xxxhdpi (108–432px, foreground content confirmed
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
48–96px sizes that's a scale factor BELOW 1, which Chromium doesn't
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

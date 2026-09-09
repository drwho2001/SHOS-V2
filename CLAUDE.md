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
  is now CI-gated and covers more than it used to.** `scripts/smoke-test.cjs`
  got wired into a new `.github/workflows/smoke-test.yml` (4 Sep) — runs
  the exact same script, unmodified, against a real `vite preview`
  production build on every push, verified locally against that same
  preview build before shipping. Still no linting, no type-checking —
  this closes "nothing runs automatically" specifically, not "not
  enough coverage" generally. The absence of any of this is very
  likely why a real, four-subsystem-breaking bug (a Capacitor
  plugin-proxy footgun affecting notifications/calendar-sync/
  geolocation/file-export) shipped silently for weeks before live
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
  **Still open**: the PWA's own `controllerchange`-triggered
  reload-on-update logic in `main.jsx` — verified once against a real
  `vite preview` build with a simulated SW bump, never re-run since.
  Deliberately not folded into this same pass: simulating a genuine
  mid-session SW version bump inside the shared suite (rather than a
  one-off standalone script) would mean deliberately triggering the
  exact class of flakiness this same session just fixed elsewhere, and
  doing that safely needs its own dedicated design, not a quick
  addition alongside three unrelated flows.
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
- **Cold-start notification-action race** — a still-open upstream
  Capacitor limitation (not fixable purely from this app's JS): tapping
  a notification action after the app was fully killed can fail to
  reach the JS listener if the event fires before React mounts. Partial
  mitigation shipped (an early listener buffer in
  `notificationService.js`); the due-meds banner is the real safety net
  for a missed tap.
- **"Settings/Management UI" (captured 18 Aug 2026, Kane) — checked 9
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
- **PIN-recovery/alternate-access mechanism — scoped 9 Sep 2026, no
  code written (session-limit-driven: scope only, no build).** The
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
  Not yet built — the one real decision that was blocking this (code
  format) is resolved as of 9 Sep 2026, later still; what's left is
  actually building the 3 screens/modes above, not further scoping.
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

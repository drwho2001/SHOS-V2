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
  GitHub Pages. Both are the only CI that exists.
- `scripts/smoke-test.cjs` — a manual (not CI-wired) Playwright script,
  3 flows. Run it before/after any risky change:
  `npm run dev -- --port 5183` then `node scripts/smoke-test.cjs`.

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
- Commits end with the attribution footer (see git log for exact
  format); this is a hard requirement for every commit in this repo.

## Known issues (as of 3 Sep 2026 — update this section as things change)

Full evidence trail for these lives in the build-audit artifact from
this date; summarized here for durability.

- **No encryption at rest.** Live app data is plain `localStorage`.
  Backup export *can* be encrypted (AES-256-GCM, PBKDF2 250k rounds —
  solid where it's used) but day-to-day data isn't. This is the one
  Critical finding deliberately not yet fixed — it touches the storage
  layer every repository reads/writes through and needs its own
  dedicated pass, not a quick patch.
- **Near-zero automated test coverage.** One manual, non-CI Playwright
  script (3 flows). No linting, no type-checking. This is very likely
  why a real, four-subsystem-breaking bug (a Capacitor plugin-proxy
  footgun affecting notifications/calendar-sync/geolocation/file-export)
  shipped silently for weeks before live device debugging caught it.
- **Cold-start notification-action race** — a still-open upstream
  Capacitor limitation (not fixable purely from this app's JS): tapping
  a notification action after the app was fully killed can fail to
  reach the JS listener if the event fires before React mounts. Partial
  mitigation shipped (an early listener buffer in
  `notificationService.js`); the due-meds banner is the real safety net
  for a missed tap.
- **App icon is unfinished** — a direction was picked (2 Sep) but real
  vector assets weren't produced yet as of this writing.
- Registry-entry merge, per-value icons within a registry, and a true
  no-code schema editor are deliberate scope cuts, not gaps — don't
  rebuild without a real, demonstrated need (see "avoid over-normalisation"
  above).

## Recently shipped (3 Sep 2026 session — see Notion for full detail)

Ground-up notification rework (native Capacitor + web/PWA dual path,
quiet hours, master switch, vacation pause, per-type action buttons for
all 5 reminder types); root-cause fix for the plugin-proxy bug above;
`allowWhileIdle` Doze-mode fix; `android:allowBackup="false"`;
`FLAG_SECURE`; third-party network call disclosure (Nominatim, GitHub
update-check) with off switches in Settings > Data > "Data & network";
closed the `updatedAt` gap in the 3 repositories that genuinely lacked
it (`episodeRepository`, `logRepository`, `locationsRepository`).

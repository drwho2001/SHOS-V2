# SHOS — Sexual Health Operating System

A personal sexual health + lifestyle tracker for one user, not a clinical
record system. React 18 + Vite + Capacitor 8, shipping as both an Android
APK and a web/PWA build. **No backend, no cloud, no accounts** — every byte
lives on the device, in `localStorage` for the app's own data and in Android's
`EncryptedSharedPreferences` for the home-screen widgets (deliberately, so a
widget can read them from a cold-started process). That is the privacy
guarantee this app is built on, not a gap to fill.

This file is the source of truth for **what's true right now** and **how to
work in this repo**. The dated build history lives in `docs/HISTORY.md` and is
not loaded here. The *why* behind past decisions lives in Notion (workspace
"Sexual Health Operating System (SHOS)" → Backend files → Development / AI
Development).

## Read this first

1. Read this file in full. It is short on purpose.
2. `node scripts\session-bridge.mjs pool list` — the live, timestamped,
   owner-attributed to-do list. **This file states no work items** (see the
   standing rule below), so if you want to know what to do next, that is the
   answer, not this file.
3. `node scripts\session-bridge.mjs lessons` and `backlog` — durable rules, and
   decisions and dead ends from sessions you have no memory of. The backlog is
   what makes you a continuation rather than a restart.
4. `git log --oneline -20` — what is actually shipped. Docs describe *intended*
   current state; the git history is the measurement.
5. This project routinely runs **two AI sessions in one checkout**. Check the
   shared state before you start and announce what you take:
   ```powershell
   $env:SHOS_SESSION_NAME = "A"      # or "B" - do this first, claims are attributed
   node scripts\session-bridge.mjs claims     # what the other session holds
   node scripts\session-bridge.mjs inbox       # notices you have not seen
   node scripts\session-bridge.mjs pool list   # approved work available
   ```

### STANDING RULE — this file must not contain work items

**A negative status claim in an instruction file is a loaded weapon aimed at
the next session.** A language model reading a line that says "X is not
attempted yet" is biased toward completion and reads it as an instruction to
go and build X — even when X shipped hours ago.

- **Never write a negative status claim into this file.** No "not implemented",
  "not wired", "still open", "not attempted", "no test covers this".
- **Never correct such a claim by making it vaguer.** Delete it and point at
  `pool list`. "Possibly not wired" is still an invitation.
- **This has already happened, four times, at a cost.** The most expensive: on
  30 Sep 2026 this file said the Escape-to-dismiss work was "deliberately NOT
  attempted yet"; it had shipped the same day across 20 files. A session
  believed the line, rebuilt the hook from scratch, and overwrote the shipped
  implementation and its tests. Reverted via `git checkout`; nothing lost.
  The full write-up is in `docs/HISTORY.md`.
- **Corollary: every number here is a claim, not a measurement.** If a figure
  matters enough to act on, the command that produces it sits next to it, so
  the next reader re-checks in one keystroke rather than trusting it. The
  reason is not paranoia: an audit of 8 Oct 2026 found 7 of 33 volatile figures
  in the previous version of this file were already stale.

## Who this is for

UK adult users, LGBT-inclusive but not exclusively labeled as an "LGBT app" —
vocabulary and defaults (Kink Registry, DoxyPEP/PrEP tracking, BASHH/UK
guidance) come from a gay/kink-community context, while trans-inclusive fields
(pronouns, Contraception/Menstrual/Pregnancy tracking gated by a settings
toggle, never by gender alone) are first-class, not bolted on. Single owner,
single device at a time — there is no multi-user or multi-device sync story,
by design.

**Explicitly, permanently out of scope**: multi-user collaboration, full EHR
functionality, NHS interoperability, a diagnosis engine, or automated clinical
risk scoring. Exposure-window flagging and retest-date suggestions are
informational only — never automated actions. Don't propose crossing this line;
it has been re-affirmed multiple times, not an oversight.

## Architecture rules (do not violate silently)

1. **Four-layer model**: `Registries` (define entities — Kinks, Chems,
   Organisms, Results, Protection, Symptoms) → `Records` (document events —
   Encounters, Testing, Clinic Visits, Medication Log, Symptoms, Vaccinations,
   Attachments) → `Workflow` (cross-cutting operational state — refill
   prediction, follow-up tracking; not a separate storage tier) →
   `Workspaces` (curated views that own no data of their own — Dashboard,
   Clinic Card, Timeline/Episodes). **Contacts, Locations and Medications are
   repositories, not registries.** Measure the layer assignment by hand with:
   `Get-ChildItem src\registries\*.js | Select-Object -ExpandProperty Name`
2. **Enter once, reuse everywhere** — reference data lives in a Registry,
   linked by relation, never duplicated across records.
3. **Store facts, derive state** — events are immutable logs; stock levels,
   adherence, active/inactive flags, "most recent test," episode status are
   always *calculated*, never hand-typed. One canonical owner per fact.
4. **Repository / calculation / sync three-layer split**: a repository is pure
   data access; a calculations file is pure business logic; a sync file is the
   one place real data and a real side effect (a scheduled notification, a
   calendar write) meet. New code should follow this. The "no I/O" half is
   **not** currently true of every calculations file — `anonymiseDisplay`,
   `disclosureLevel`, `optionListUsage`, `orphanReferenceCheck`,
   `registryUsage`, `clinicCardVisibilityPreference`, `darkModePreference`,
   `dataAnomalyScan`, `referenceRepair` and `textCanonicalisation` all import
   repositories or storage. Those files are working; do not "fix" them into
   the pattern. Re-check with:
   `Select-String -Path src\calculations\*.js -Pattern 'from "\.\./(repositories|storage)/'`
   This split is why real bugs here can be root-caused to an exact line instead
   of guessed at — preserve it in new code.
5. **Two deliberate privacy controls, not one — do not merge them.**
   - **Disclosure level** (`src/calculations/disclosureLevel.js`,
     `detailed`/`glanceable`/`masked`) decides the *text* of notifications on
     surfaces outside the app. It reaches notifications and nothing else.
   - **Widget tier** (`src/calculations/widgetPrivacy.js`, `full`/`redacted`/
     `off`, per widget, set in Settings → Widgets) decides what a home-screen
     widget *stores and renders*.

   They are separate because one global level would be cruder than the choice a
   user actually needs per widget, and because a single overlay would break L-044
   — a Redacted tier must mean ONE uniform thing, and a global setting on top of
   it makes the same widget render differently depending on which control moved.
   A task once asked to "route widget writes through `resolveDisclosure`"; doing
   that would have undone t042/t059. If you are asked to unify them again, that
   is an **owner decision**, not an implementation detail. `PrivacyScreen.jsx`
   states the split in two places and `disclosureCopyGuard.test.js` fails if the
   two ever contradict each other again.

   **Adding a field to a widget is a privacy decision, not a display change.**
   Name it, then ask whether it survives `ALLOWED_AT_REDACTED` for that widget —
   it survives only if listed, so default-deny drops anything you do not
   deliberately add. That is the whole mechanism, and it is why an added field
   needs no explicit hide in JS. Recent examples: the DoxyPEP evidence line
   (t093, a date, deliberately *not* added) and the Appointments widget's time
   and location (t088, also deliberately not added — both are identifying).
   A widget must render the new field as `GONE`, not blank, when it has no
   value: an empty `TextView` still occupies layout and reads as a rendering
   fault.
   The same rule covers STRUCTURAL labels (t087): a section heading on the
   Clinic Card widget ("When" / "Where" / "Details") is static text, so it
   carries no user data, but it is hidden at the Redacted tier alongside the
   rows it labels — a bare heading over a blank card reads as a broken widget
   rather than an intentional empty state.
6. **Defensive-default merge on every read** (`{...DEFAULTS, ...stored}`) —
   so adding a field later never breaks a previously-saved record.
7. **Archive before hard delete** — the default for "just outdated" is
   `isArchived`, not removal. Real delete-with-confirmation exists per-module
   for genuine mistakes, not as the default path.
8. **Undo is single-step, per-module only** — no cross-module action history.
   Deliberate anti-over-engineering decision, not a gap.
9. A new repository must be wired into `backupService.js` in the **same
   change** that adds it, not after. This was missed twice historically.
10. Design system: `src/calculations/designTokens.js` is the single source of
    truth (colors, type, radius). Icons are Phosphor
    (`@phosphor-icons/react`), aliased on import — never `lucide-react`. Fonts
    are Inter (body) + JetBrains Mono (utility), self-hosted via
    `@fontsource/*`, never a render-blocking Google Fonts `<link>`.
11. **Fake-UTC date storage convention** (`src/calculations/dateInputHelpers.js`):
    most stored date/time strings are `"YYYY-MM-DDTHH:mm:00.000Z"` where the
    digits are literal local wall-clock time and the trailing `Z` is a
    deliberate lie (avoids timezone-shift bugs on read). A genuine
    system-observed instant (`createdAt`/`updatedAt`, notification-history
    entries) uses real `new Date().toISOString()` instead. Two different
    intentional conventions; don't conflate them.

## Where things live

- `src/modules/` — one file per feature area, `SHOS_<Feature>_Prototype.jsx`,
  plus an `InteractiveTour.jsx` and a `settings/` subdirectory of extracted
  Settings sub-screens. `SHOS_Healthcare_Prototype.jsx` imports Testing /
  Clinic Visits / Menstrual&Contraception&Pregnancy / Symptoms / Vaccinations /
  Measurements as **peer modules**, not as parts of one file. Count:
  `Get-ChildItem src\modules\SHOS_*_Prototype.jsx | Measure-Object`
- `src/registries/` — the Registries layer of the four-layer model.
- `src/components/` — shared UI/hook primitives, e.g. `ConfirmDeleteCard.jsx`,
  `useEscapeToClose.js`, `SectionCard.jsx`. When a presentational component
  turns up defined locally in three or more modules, consolidate it — `SectionCard`
  was byte-identical in five (four exactly, MyProfile differing only in label
  colour, which is why `accent` is a prop with a default rather than a hardcoded
  value). The same applies to a resolution helper: `getWidgetBridge()` was
  duplicated in six sync files, and that duplication is *why* a subtle thenable-
  proxy bug had to be fixed six times and then twice more. Consolidate a helper
  once it has been the site of a bug more than once.
- `src/repositories/` — one per data domain, `localStorageAdapter`-backed.
- `src/calculations/` — pure business logic, `designTokens.js`,
  `dateInputHelpers.js`, and the notification-scheduling glue: five
  `*ReminderSync.js` files (Medication / Testing / Refill / Clinic-visit /
  Vaccination) plus `doxyPepSync.js`, which does not match that glob.
- `src/storage/` — cross-cutting native/platform services (`storageAdapter.js`,
  `cryptoService.js`, backup/CSV/export/PDF services, `draftStorage.js`,
  `screenSecurityService.js`, `installPromptService.js`, `backupMigrations.js`).
  Count: `Get-ChildItem src\storage\*.js | Where-Object Name -notlike '*.test.js'`
- `android/` — the Capacitor-generated native project. `MainActivity.java` and
  `AndroidManifest.xml` are hand-edited (FLAG_SECURE, allowBackup, font-scale
  wiring) — real native code, not boilerplate to regenerate blindly.
- `scripts/smoke-test.cjs` — the Playwright suite, run on **every push** by CI.
  Flow count: `grep -c 'await run(' scripts/smoke-test.cjs`
- `scripts/verify-changes.mjs` — the gate runner (`npm run verify`, plus
  `--fast` / `--smoke-only` / `--docs-only`), and `scripts/docsGate.js`, the
  pure docs-gate decision function.
- `docs/CHANGE-PROCEDURE.md` — the commit/push algorithm itself.
- `docs/MODELS.md` — **which models this machine can actually use**, and why
  the rest cannot. Read it before choosing or changing a session's model. Two
  facts it exists to stop being re-derived: the OpenCode **Go** account is the
  paid one (Zen returns `402 Insufficient account funds`, which is expected,
  not a fault), and the free models are **not equally private** —
  `space-bunny-free` and `longcat-2.5-preview-free` are documented
  zero-retention, while Nemotron's free tier explicitly forbids submitting
  personal or confidential data, which matters unusually much for this app.
- `docs/DEVICE-TESTING.md` — the items that can only be verified on real
  hardware (safe-area / notch / status-bar spacing).
- `.github/workflows/` — `build-apk.yml` (debug APK + public `latest` release),
  `web-alpha.yml` (GitHub Pages), `smoke-test.yml` (calls `npm run verify`).

**`App.jsx` is not shell-only.** The Home/Healthcare/Settings extraction
happened, but `App.jsx` is ~3,000 lines and still defines 9 top-level
components beyond the shell (`AppLockScreen`, `DecoyHome`, `AppLockPrompt`,
`OnboardingScreen`, `AcknowledgeSheet`, …). `App()` alone runs most of the way
to EOF. So the rule is not "keep it small" — it is **extract further**, and a
new session should not read the shell-only description and conclude the
extraction regressed.

**Hand-maintained inventories are the failure mode of this repo.** Lists of
files, counts, and per-module item tables in docs and in tests have gone stale
repeatedly. Prefer a command beside every count, and prefer a test that
asserts coverage **both ways** (`sampleDataRepositoryCoverage.test.js`,
`orphanReferenceCoverage.test.js`, `seedIdCollision.test.js`) over a prose
list. Where a set genuinely must be reviewed by hand — the icon-only-UI
audit — it is gated by `src/components/iconOnlyUIAudit.test.js`, which asserts
the found set matches a reviewed list where **each entry carries a written
reason**. Update that list in the test; do not edit prose to match reality.

## Verification and shipping

**The gate is `npm run verify` = `scripts/verify-changes.mjs`: build → lint →
unit tests → encoding → inherited-instructions → smoke suite → a docs check.**
Both a local and a CI gate, and because they run the same file, a gate added
locally is a gate that runs in CI automatically. That is not tidiness: the
previous CI job hand-copied each step, and when the two lists differed nothing
said so.

- **The app's refresh handler is observable, on purpose.** `checkDueMeds()`
  stamps a counter on `<body>` (`document.body.dataset.shosRefreshCount`)
  when it has finished recomputing the due state, and the smoke suite waits
  for that counter to advance before asserting that a dismissed banner
  stayed dismissed. It is stamped at the END of the refresh and after the
  vault-unlock check, so it means "a refresh really recomputed the due
  state" and not "a refresh was attempted" — the distinction that makes the
  assertion non-vacuous. It is a DOM attribute rather than React state on
  purpose: a state change there would re-render the whole tree (no
  `React.memo` in this codebase) every 60 seconds for a value no user can
  see. `src/components/refreshCounterGuard.test.js` guards all of that.
- **The local loop is `npm run verify:fast`** (build + lint + the unit suite, no
  smoke). CI is the real gate, in ~11 minutes including the full smoke suite. A
  full local run before every push is redundant, and on this 4 GB machine it is
  actively harmful — the project has lost hours to smoke failures that were pure
  memory starvation. Run the full local gate (`npm run verify:smoke`) only to
  debug a smoke failure interactively, which is the one thing CI cannot do for
  you. **MEASURE this gate's runtime before trusting a timeout on it: on
  20 Oct 2026 the unit suite alone took 507s (1755 tests across 151 files) at
  `--maxWorkers=3`, so budget ~15 minutes rather than ~2. A killed run leaves
  orphan vitest processes holding memory — find them with
  `Get-CimInstance Win32_Process -Filter "Name='node.exe'"`, match `vitest.mjs`
  in the command line, and kill them by PID.**
- **Native/Java changes cannot be compiled locally.** A green CI `build-apk`
  run is the only real confirmation they compile.
- The **docs gate is enforced, not advisory**: CI *fails* a push that changes
  `src/` without also changing `CLAUDE.md` or `docs/`. It only warns locally,
  because mid-edit "docs not updated yet" is the normal state of honest work.
- A **pre-commit hook** (`.git/hooks/pre-commit`) blocks mojibake on every
  commit. Bypass deliberately with `--no-verify` only.

**Before trusting a red build, check free memory — but fix recurring failures.**

```powershell
[math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1KB)
```

`verify-changes.mjs` reports free RAM every run. But **a flow that fails the
same way every time is a BROKEN FLOW, not the machine.** A test must never
depend on how fast the machine is: waits must be bounded waits on the state
actually asserted, never `waitForTimeout(N)` followed by a read. That is not
hypothetical — five identical failures of this shape were traced to it, and one
reported a data-loss regression that did not exist.

**A helper that can quietly do nothing is worse than no helper.** The
`dismissTransientBanners` helper in `scripts/smoke-test.cjs` swallowed all six
of its dismissal clicks, so on a not-yet-booted app it silently did nothing,
reported success, and six call sites had papered over it with fixed waits. It
now verifies no dismissal control remains and retries.

**Counting smoke-test waits:** measure with a *comment-stripped* count. A naive
`grep -c` counts comments of the form "was waitForTimeout(N)" and reports no
change at all. This repo has been bitten by its own scanner mid-task.

## Encoding and bulk-edit traps

**PowerShell 5.1 is not UTF-8, and this has damaged the codebase four times.**
`Get-Content` decodes with the system ANSI codepage (CP1252) and
`Set-Content -Encoding utf8` writes UTF-8 *with a BOM*. Chained, they
double-encode every non-ASCII character, producing valid UTF-8 that displays as
garbage — which survives the build, lint, every unit test and every smoke flow,
because none of them look at bytes.

- **Never use those cmdlets to read or write source.** Use the editor directly,
  or a Node script (`fs.readFileSync` / `writeFileSync`). For commit message
  files: `[IO.File]::WriteAllText($p, $msg, (New-Object Text.UTF8Encoding $false))`.
- **A backtick in a commit message is a PowerShell ESCAPE, not a quote, and it
  corrupts the message silently.** Building `$msg` in a double-quoted PowerShell
  string consumes each backtick plus the next character: `` `record.name` ``
  sends a **carriage return**, not `record.name`; `` `name` `` sends a
  **newline**; `` `title` `` sends a **tab**; `` `vaccine` `` sends a vertical
  tab; `` `a`` sends an alert. Commit `eda961a` (14 Oct 2026) is stored in this
  repository with `record` as `ecord`, `title` as `itle`, `vaccine` as `accine`,
  and the `name` of `name` sitting on **its own line**. The code is fine; only
  the message is damaged, and it is damaged in a way that reads as a typo
  rather than as a lost word. **`WriteAllText` above fixes the bytes and not
  this** — the backtick is already gone by the time the string exists. Use
  single-quoted strings, a `@' … '@` here-string, or a file. And note the
  repair is not cheap: control characters inside a commit object are only
  removable by rewriting that commit, which this repo forbids while another
  session may be building from it. Treat it as prevention, not a fix.
- **Never regex over JSX attributes or source to make a bulk edit.** Regex
  codemods damaged this codebase twice in one week — truncating `aria-label`
  closing braces, and mangling smoke-test flow labels. Make the edit with the
  editor, or write a script that *understands the structure*.
- Other traps specific to this codebase: dynamic `/src/` imports only work on a
  dev server; `SVGElement` has no `.click()`; bottom-nav tabs have no text
  content. See `docs/CHANGE-PROCEDURE.md`.

## Two sessions share this working tree — attribute your own work

The owner routinely runs two AI sessions against this same checkout at once,
and they write to the same files. That is a normal condition here, not an
accident, and it has four consequences.

The shared state lives outside this repository on purpose, under
`~/.shos-session-bus/state/` — `claims.json`, `inbox.json`, `lessons.md`,
`backlog.md` and `pool.json`. It is deliberately not in git: it is per-machine
and per-owner, and this repo is the public-alpha track.

**Log entries must identify their session.** Say which session wrote an entry,
in this file and in the session bus. Attribution is cheap at write time and
impossible to add later without editing someone else's entry.

**Never rewrite another session's entry, and never rewrite history they are
working from.** If a commit's message does not match its contents, document the
mismatch in *your* entry and move on. The other session is actively building
from that commit; rebasing shared history out from under a running process risks
losing their work to fix something cosmetic. Decide to split history only with
both sessions stopped.

**Never `git add -A` here — and note that explicit paths are not sufficient
either.** A blanket stage on a tree you do not solely own commits someone
else's half-finished work under your message; this happened four times here.
But explicit staging cannot protect you when the other session is editing the
*same files you have legitimately claimed*, which this repo runs on constantly.
The only real protection is `git add <path>` **immediately before** committing,
after re-running `git status`, so the window between read and commit is seconds
rather than the length of a review. An empty `git commit` is the tell that
another session's stage swept your files. Full forensics: `docs/HISTORY.md`.

**These sessions do not wake each other.** Prompting one does not prompt the
other; the owner prompts both. Do not assume work done in one session has been
seen by the other.

**Treat a relayed recommendation as a proposal to check against real code and
session history**, not something to adopt uncritically — a parallel tool may
have no visibility into what is already shipped.

**`npm run verify` takes an exclusive lock for the whole run.** If you are
queued behind the other session, do something else rather than cancelling or
forcing it.

**Write to the session bus as you go.** Logging is not optional courtesy; it is
the only reason the next session inherits anything.

```powershell
node scripts\session-bridge.mjs log "<what you decided, tried, or found>" --kind=decision
node scripts\session-bridge.mjs lesson "<the rule>" "<what to do instead>" --kind=cannot --evidence="<why, with the measurement>"
```

`--kind` for `log` is `decision`, `blocker`, `finding`, `question`, `state`,
`done`, `mistake`. Log what is **not already durable elsewhere** — a decision
and its reason, a dead end, a mistake worth not repeating, the state of
something open. Commits are in git and findings are in `docs/`; duplicating
them just creates a second place for them to go stale.

**A lesson is a rule, and `--evidence` is required.** The tool refuses without
it, because a rule with no provenance is a superstition and this repo has
repeatedly found those. `--kind` is `cannot` / `must` / `prefer` / `verify`. If
a rule's evidence stops being valid, delete it; do not inherit it.

**To get a second opinion from a different model**, use the consult tool. It
calls Gemini's free tier by default, walking down to a cheaper model when one
is rate-limited, and writes the exchange where the other session reads it:

```powershell
node scripts\consult.mjs gemini "<a question worth challenging>" --task=<slug>
```

Use it as a **challenger**, not a collaborator: it has no memory of this repo,
so it will reason confidently about things it cannot see. Challenge an approach
before committing to it; do not try to hold state in it. Free tier first by
policy. (Note: it fails with HTTP 401 when the Gemini credential is bad — that
is an auth problem, not a bad question.)

**SECOND-OPINION PROTOCOL — the threshold is deliberately LOW.** On a second
failed attempt at the same thing, a stall, a retry loop, a rework, or anything
genuinely unknown, stop grinding and record it:

```powershell
node scripts\session-bridge.mjs stuck <slug> "<what you are trying>" ["<what happened>"]
```

The first attempt only records. The **second** automatically consults the free
model, assembling the question from *all* the failed attempts rather than the
latest one. Grinding through the same failure three times costs far more than
one free call, so the instinct to push on is the expensive one.

## Working conventions

- **Build → verify → ship**, used consistently for every real change:
  `npm run build` (catches syntax errors) → commit → push → check CI via the
  GitHub Actions API (`build-apk.yml` for the pushed commit). Don't skip this
  for a change that "looks safe" — several real bugs here only surfaced by
  running the thing, not by reading the diff.
- **Verify a write actually landed** — don't trust a tool call's success alone.
  Applies to Notion edits and code changes alike.
- **A predicate must read a field the record shape actually defines, and its
  fixture must be shaped like the real record.** A test that builds
  `{ name: "Hep B" }` and asserts a matcher reads `name` proves the matcher
  works, and says nothing about whether it is *wired* to anything. The defect
  this rule covers: `isHepatitisB` matched on `record.name` while
  `DEFAULT_VACCINATION` has `title` and `vaccine` and no `name` — so the test
  stayed green, the function was called on real records, and it returned `false`
  for every one of them. Where a helper is fed repository output, import the
  repository's own record constant into the test and assert against that shape.
  Re-check the shape with
  `Select-String -Path src\repositories\<name>.js -Pattern "export const DEFAULT_"`
- **A `RemoteViews` update does not reset anything — every branch must restate every property it cares about.** `AppWidgetHostView` recycles the inflated view when the layout id matches (`RemoteViews.canRecycleView` → `reapply`), and `performApply` walks **only** the actions in the new `RemoteViews`: there is no reset-to-defaults pass. Two bugs shipped from this and neither looked like what it was. (a) A Redacted branch sets views `GONE`; the Full branch set their *text* without ever setting `VISIBLE` again, so switching tier left fields missing **permanently** — which on screen reads as a *sizing* bug, not a privacy one. 19 instances across 7 providers, found by `widgetVisibilityRestoredGuard.test.js`; the exception is `widget_clinic_nhs_num`, which is hidden at every tier by design. (b) `WidgetTextFit.fit()` wrote a text size only `if (chosen < maxSp)`, so a size chosen on a **narrow** update survived every **wide** one — widen a widget and the text stays small until the app next pushes. Always write the size; writing `maxSp` is a no-op when nothing needed shrinking. The general rule: **setting a property in one branch obliges you to set it in the others**, because the widget is a persistent object, not a fresh render.
- **A launcher RESIZE produces no update unless you handle it.** `AppWidgetProvider.onAppWidgetOptionsChanged` is an **empty** base method, so a widget whose width-dependent decisions (which fields to drop, what size to render) are frozen at the last data push stays frozen after a manual resize. All seven data providers now extend `ResizingWidgetProvider`, which overrides it and re-renders. The three Quick Add widgets deliberately do **not**: they render static text with no width-dependent decision, so there is nothing stale to re-render. This is also the one widget shape that **cannot** be created by adb — `adb shell appwidget` only supports `grantbind`/`revokebind` — so resizing has to be done by hand.
- **Do not log widget text, ever, and not behind `BuildConfig.DEBUG` either.** `WidgetTextFit.fit()`'s decision line carried the full rendered string — medication name, test date, clinic location — at `Log.d`, which is **not stripped from a debug build**, and this repo ships a debug-signed APK. Gate it behind a local `static final boolean` (`LOG_WIDGET_TEXT`): `BuildConfig` is **not generated** under AGP 8 (`android.defaults.buildfeatures.buildconfig` became `false` in AGP 8.0; this module uses 8.13.0 and opts in nowhere), so `BuildConfig.DEBUG` is an unresolved symbol and will not compile. The *measurement* fields (width, chosen size, `textPx`, `availablePx`, `WRAPS`, `HITS_FLOOR`) stay unconditional — they disclose nothing and this repo diagnoses truncation by reading them.
- **`autoSizeTextType` DOES work in `RemoteViews`. The old rule here said otherwise, and it was wrong — its stated reason never bore on the question.** It claimed "RemoteViews cannot inflate a custom `TextView` subclass, so the standard auto-fit answer does not exist." But `autoSizeTextType` is a framework attribute on the plain `TextView`, which *is* on RemoteViews' supported list — it needs no subclass. Verified in the platform source (`$ANDROID_HOME/sources/*/android/widget/TextView.java`): `supportsAutoSizeText()` returns `true` **unconditionally** — it is not gated on RemoteViews, the view class, or anything else — and `setupAutoSizeText()` activates on `AUTO_SIZE_TEXT_TYPE_UNIFORM` alone. **The real blocker was `layout_width="wrap_content"`**, which every widget TextView used: autosize measures `getMeasuredWidth()`, and under `wrap_content` that equals the view's *own text width*, so the available width equals the text width and the fitter returns the top of the ladder every time — autosize engaged and doing nothing. Under `match_parent` the measure spec is `EXACTLY` and autosize works. Four consequences, all verified in source and all of which look like *success* if you get them wrong: `autoSizeMaxTextSize` defaults to **112sp** (omit it and text grows until clipped); `autoSizeStepGranularity` defaults to **1 pixel** (omit it and you get 13.4sp, contradicting the whole-sp policy below); `autoSizeMaxTextSize <= autoSizeMinTextSize` **throws** at inflate (line 2306), which in a widget is swallowed by `AppWidgetHostView` into its error view, so the widget becomes "Can't load widget"; and it is **API 27+** while `minSdkVersion` is 24, so on API 24–26 the attribute is silently ignored. Note also that `TextView.setTextSize` is guarded by `if (!isAutoSizeEnabled())`, so once autosize is on, `setTextViewTextSize` is a **deterministic no-op** — not a race, the framework always wins.
- **`WidgetTextFit` remains the mechanism for every field that does not use autosize**, and these rules stand: `setTextViewTextSize` is remoted since API 16, so the fitter measures the actual string with `Paint.measureText` against the widget's real width and steps down a whole-sp ladder (floor **12sp**) until it fits. Call it after every `setTextViewText`, including in each Redacted early-return branch, and measure the *full rendered string* — `"Next: " + name`, not `name`; the prefix is often a third of the width and was a real source of truncation.
- **`OPTION_APPWIDGET_MIN_WIDTH`/`MAX_WIDTH` are an ORIENTATION pair, not a resize range — take the one that matches the current orientation.** Measured 17 Oct 2026 on 23124RA7EO: `appwidget 320 minW=109 maxW=208 minH=81 maxH=166` with `OPTION_APPWIDGET_SIZES=[109.09x166.55, 208.73x81.45]`. The width and the height **swap together**, so those are the portrait and landscape renderings of one widget. `widthDp()` took `min(minW, maxW)` — the portrait width — which is right in portrait and **wrong in landscape**, where it would measure a 208dp-wide widget's text against 109dp and shrink roughly twice as hard as needed. Portrait-only testing cannot catch this: every instance on this device sits at its portrait width, so six of six agreed with the wrong code. Read the configuration orientation and pick accordingly. Re-check with:
  `Select-String -Path android\app\src\main\java\com\shos\app\widget\WidgetTextFit.java -Pattern "ORIENTATION_LANDSCAPE"`
- **A field's `fit()` call must match its layout on BOTH axes — `maxLines` *and* `maxSp`.** `maxSp` is the ceiling the fitter steps down *from*, so an inflated one licenses text LARGER than the design allows and nothing notices. Three call sites had it: `TestWidgetProvider` passed `18f` on a 14sp field, and `DoxyPEPWidgetProvider` passed `16f` and `14f` on a 12sp field. The device log said so plainly — `-> chose 18.0sp (max 18.0sp)` for a field whose layout declares `14sp` — while every test stayed green, because the guard read `maxLines` and stopped there. It survived the autosize experiment by luck: the `autoSizeMaxTextSize` ceiling masked the oversize, so the fitter's wrong number was being overridden by the framework rather than by anything the repo checked. `widgetTextFitMaxLinesGuard.test.js` now asserts both axes, and the new assertion is proven red on a single reverted `maxSp`.
- **A fitter must be told whether its field may WRAP — and above one line it must measure the longest WORD, not the whole string.** Shrinking is not the only answer, and treating it as the only one is a defect that looks like correct rendering. On 15 Oct 2026 `WidgetTextFit` reported `HITS_FLOOR` for `"Retest due: Wed 23 Dec"` — 351px of text into 212px, needing **7.2sp**, below the legibility floor. No size could have fitted it, so the fallback was correct and the *content* was the problem, not the measurement. So `fit()` takes a `maxLines`, and above 1 it tests the widest space-delimited token: a line break can only fall on a space, which is exactly what separates a clean wrap from the `"Sertralin e"` mid-word break `breakStrategy="simple"` produces. That argument is a contract between a provider and its layout, so `widgetTextFitMaxLinesGuard.test.js` asserts **every** one of the `fit()` call sites passes the `maxLines` its layout declares — counted with an exact assertion (**19** as of 17 Oct 2026, down from 26 when Next Dose and DoxyPEP moved to `autoSizeTextType`), and extracted by a balanced-paren scan rather than a regex (see the spanning-regex rule below). It found eight that passed `1` for fields whose layouts allow `2`, which had been shrinking text that could have wrapped — `"23 Sept 2026"` rendered at 13sp against a declared 14sp. Log the DECISION, not just the inputs: `fit()` records the size chosen, the measured width and `WRAPS` / `HITS_FLOOR`, because those two failure modes are indistinguishable in a screenshot, and the floor handoff had a written rationale that had never once executed on a device.
- **A STATIC label has no fitter, so `maxLines` is its only control — and the guard above cannot see it.** `widgetTextFitMaxLinesGuard.test.js` keys on `android:id` and on `fit()` call sites, so a `TextView` that is a compile-time literal is excluded from it twice over: no id to match, and no `fit()` call because there is nothing to measure or shrink. On 16 Oct 2026 the three Quick Add labels rendered as `+ Add Co…`, `+ Log Enc…`, `+ Log Me…` for exactly this reason — a string wider than the 109dp 2-column widget plus `maxLines="1"`, ellipsized, with the full local suite green and a green `build-apk`. Nothing about those labels is a measurement, so there was nothing for the fitter or its guard to be wrong about. Set `maxLines="2"` on any widget label that can exceed its field — with `breakStrategy="simple"` a label whose every *word* is narrower than the field wraps cleanly onto two lines, and `ellipsize="end"` still degrades gracefully beyond that. `quickAddWidgetLabelGuard.test.js` asserts this over the `quick_add_*_widget` family, with an anti-vacuity check that the family and all three expected labels still exist so the coverage cannot be defeated by deleting a layout. **The general rule: a guard on one side of a boundary is not a guard on the boundary — ask what shape the guard cannot match, because a defect in that shape is invisible to it.**
- **Widget sizing has THREE roles and only two of them bound a placed widget. Do not confuse them.** `minWidth`/`minHeight` and `targetCellWidth`/`targetCellHeight` are **placement defaults**, consumed when the widget is added — they do not resize a widget already on the home screen. `minResizeWidth/Height` and `maxResizeWidth/Height` are the **resize bounds**, and the horizontal range is `[minResizeWidth, maxResizeWidth]` — `minWidth` is *not* part of it. An earlier note here claimed `maxResizeWidth == minWidth` left an "empty resize range", which is false: Google documents `minResizeWidth` as *"the size below which the widget would be illegible or otherwise unusable"*, i.e. a floor, and this repo's own device log disproves the empty-range claim outright — the same widgets measured **109dp** (truncating) and **171dp** (complete) on 23124RA7EO, and neither could exist under one fixed width. Both sit inside the declared `[110dp, 180dp]`. **So raising `maxResizeWidth` was never the fix for the 2-column truncation: 171dp was always reachable by dragging.** The open question is a *placement* one — why widgets land at 109dp when `minWidth` is 180dp — and the candidates are `targetCellWidth` being out of the launcher's span range, or the launcher restoring saved sizes after `install -r` drops all ten to placeholders. `WidgetTextFit.widthDp()` now logs the launcher's reported bounds plus `OPTION_APPWIDGET_SIZES` (API 31) precisely so this is measured rather than argued. **Do not widen the ceiling blind:** every layout is `wrap_content` children inside `gravity="center"`, so a wider box is the same empty-black-space defect `maxResizeHeight` exists to prevent, just on the other axis. Also note the home app is **Lawnchair**, not MIUI's launcher — sizing behaviour must not be reasoned about from MIUI's grid.
- **A source guard whose regex can span a statement boundary will absorb one call into its neighbour's match and report the neighbour's arguments.** This is the mirror image of a guard that is too narrow, and it is worse, because it reports a *confident wrong answer*. `widgetTextFitMaxLinesGuard` scanned call sites with a lazy `[\s\S]*?` between the view id and the width argument, and also required that argument to be the literal token `wDp`. `NextDoseWidgetProvider`'s Redacted branch inlined `WidgetTextFit.widthDp(...)` (because `wDp` was declared *after* that branch's early return), so the regex did not match it — and then the lazy span ran on and swallowed the **next** `fit()` call, which was for the same view id and *did* pass `maxLines=2`. The pair reported the neighbour's arguments, the scanner counted **25** sites when **26** existed, and CLAUDE.md asserted 25 as fact. Underneath: the Redacted tier fitted `widget_med_name` with six arguments, so `maxLines` defaulted to 1 against a layout declaring 2 — **the privacy tier rendered strictly worse than the unrestricted one**, on the widget's largest field. **So: a guard that counts things must assert an exact count obtained by an independent method, and a regex that matches structure must be anchored so it cannot cross a statement boundary.** The fix was a balanced-paren scan per call site plus a hard rule that the width is always passed as the `wDp` local — hoisted above any early return, since the width carries no user data and does not vary by tier. Note the direction of the failure: this was not a guard that could not see a shape, but one that could see it and misread it.
- **A helper that can silently do nothing is worse than no helper — including
  the ones you write to fix a bug.** `WidgetTextFit.widthDp()` returned `-1`
  when the launcher didn't report a width, and `fit()` skipped on a negative
  width, so the entire text-fitting mechanism was a **no-op on the device that
  reported the problem** and the widgets truncated exactly as before. Ship it
  green, and it is not a fix. A "skip if I can't tell" branch is only safe when
  skipping is the correct answer; where the fallback is a default, return the
  default and keep going. The same guard applies to every `try/catch` that ends
  in `return` — several here log at debug and return, which is why the DoxyPEP
  widget died silently for so long.
- **Anything this app sends off-device must be HTTPS, enforced at the point of
  sending — not assumed from where it was configured.** The error-report
  endpoint is a user-typed preference carrying whatever they wrote about their
  own health; a plain `fetch(endpoint)` puts it on the network in cleartext if
  someone types `http://` or a URL is missing an `s`. Save locally first, then
  refuse to send over non-HTTPS with an explanation — refusing costs nothing
  because the record is already on the device.
- **A bridge field must be renamed on BOTH sides, and the name that survives redaction is the one the native side must read.** Renaming a payload field in JS while Java keeps the old name delivers an empty value: `opt(call, "x")` returns `""` for an absent key, the provider stores `""`, and its own default **never applies** — a present-but-empty value beats a default, so the widget renders blank rather than falling back. The DoxyPEP widget read `status`/`expiryMs` while the JS sent `state`/`countdownAt`, and those old names are *also* absent from `ALLOWED_AT_REDACTED`, so they were impossible at the Full tier and stripped at Redacted. **Rename on the side that has the wrong name**, so the native side reads the names the allowlist protects; sending both would leave two fields where one survives redaction, which is how a duplicate becomes a leak later. `widgetBridgeFieldNameGuard.test.js` checks every Java-read key against the JS that sends it, and `widgetArgumentOrderGuard.test.js` checks the argument order — a bridge can fail silently in either direction.
- **A value crossing a bridge must have ONE type, and the tests must take that type from the real producer.** `getDoxyPepStatus` has always returned `deadline` as epoch milliseconds; three call sites treated it as a `Date` and called `.getTime()`, which is a `Date` method. Every call threw, and because they sat inside a `try/catch` that logs at `debug` level, the DoxyPEP widget silently never updated on any device. The suite was green because its fixture built `deadline: new Date(...)` — a shape the producer has never emitted. Prefer a distinct type per field across a bridge (an epoch `long` rather than another `String`, say) so the compiler catches it, and **build fixtures from the real producer's output rather than from a literal**.
- **Code that a test cannot reach is code that breaks unseen — extract a pure function rather than asserting on a copy of it.** A test that pastes `countdownAt: status.deadline ?? null` into its own file proves nothing about the payload: that version of the test passed green against the still-broken source. When a defect hides in a function whose only caller needs a live bridge, **make the seam** — `buildDoxyPepWidgetPayload(status)` is pure and exported, and the test calls it. Note that deleting a variable can leave a dangling shorthand reference (`{ expiryMs, }` after `const expiryMs` is gone) that is a `ReferenceError` on every call and that only an executing test can see.
- **A PIN that is checked by COMPARING STRINGS is an oracle, and a PIN stored as a string is a secret at rest.** `enteredPin !== storedPin` tells an in-page caller whether a guess was right in the time it takes to compare two strings: ten thousand four-digit candidates is nothing, and every attempt is free. Two such comparisons existed - `deactivate()`'s and `setDuressPin()`'s - so the same secret had two doors. Both now verify against a PBKDF2 verifier (100k iterations, its own salt), so each attempt costs a derivation and the stored value never reveals the PIN. The general rule: **anything that decides "is this the secret?" must compare DERIVED values, never the secret itself** - and a verifier is a credential equivalent, so it is stripped from the settings object exactly like the raw PIN was, and from a plain export file too. `src/repositories/privacySettingsRepository.js` owns the App Lock PIN's verifier; `cryptoService.js` owns the duress one.
- **When the secret stops being stored, the actions that need it as KEY MATERIAL have to ask for it.** A verifier can prove a secret but cannot re-wrap a key with it, so the vault's privileged actions - turning App Lock off or on, enabling biometrics, setting the recovery string, changing the PIN - now take the PIN the USER types, through one shared prompt. This is not only a cost: the App Lock grace window means the app can be open with nobody having typed the PIN for a while, and a biometric unlock never involves the PIN at all, so asking again is the confirmation that the person at the keyboard knows the PIN.
- **A change to a screen's INTERACTION FLOW must update the smoke flows that drive it, in the same commit.** The smoke suite is a GATE, and it drives the real UI: t131 made the Privacy screen's App Lock toggle ask for the PIN (because the PIN is a verifier now and the vault's re-wrap needs it typed by the user), and the two flows that click that toggle failed at the first attempt - they clicked it and waited for it to flip, and it no longer flipped on its own. **A red gate is a broken push**, and the failure was in the test, not the app. The same applies to a form that grows a field: a flow that filled the PIN fields by INDEX broke the moment a third input appeared, so flows address fields by PLACEHOLDER or ACCESSIBLE NAME, never by position.
- **A marker namespace must not be matched by another family's cleanup, and a family added to a sync must be added to its REMOVAL.** The phone's calendar has three families on it, each with its own marker shape and its own opt-in: `[shos:<id>]` for appointments, `[shosvax:<id>:<doseKey>]` for vaccination doses, `[shosplan:<kind>:<key>]` for planned events. Each family's cleanup pass deletes any event whose notes match ITS shape and that is not in its current set - so a marker written in another family's shape is deleted on every sync of that family and recreated by the next one, silently, for ever. The other direction is the same trap with a worse consequence: the settings sheet promises that turning the feature off "removes everything this app put there", so a family that is added to the sync and forgotten in `isOurMarker()` leaves its events behind in a calendar the user has stopped using. **Both directions are asserted in `src/storage/calendarSyncPlanned.test.js`**, against a mock phone calendar that keeps real state.
- **This app has TWO calendars, and they have disagreed before - twice, in both directions - so they must read ONE derivation.** The app's own Calendar screen and the phone's real calendar are two views of the same facts, and they have each been right while the other was wrong (t034: one event per vaccination RECORD here, one per DOSE there; t130 made them one per dose). The rule that follows: a fact that appears in both is derived once, in a shared module, and both read it - `src/calculations/plannedCalendarEvents.js` is the current one, and `src/calculations/calendarCalculations.test.js` asserts the two agree against it rather than against a copy of it.
- **Demo data is flagged, not mixed.** All 74 seed records now carry `isDemo: true` (inherited from `DEFAULT_*` via spread, explicitly set in `create()` and preserved in `update()`). Real records get `isDemo: false`. The `isDemoData()` function checks `isDemo` first (for unedited records), then falls through to snapshot comparison for legacy records. This is the foundation for demo data separation.
- **Color tokens must be resolved for dark mode.** Settings was using raw `ACCENTS.healthcare` in dark mode, producing `#09582E` on a near-black surface. All modules must use `resolveDarkAccent()` for interactive elements. Multi-picker chips must reference the correct module accent (`encountersPink`, not `encountersAmber`).
- **Menstrual predictions are ESTIMATES, not diagnoses.** The cycle widget shows "est." next to every predicted date, and the app shows "Next period (estimate)" with a days-until countdown. Phase boundaries are fixed (Menstrual 1-7, Follicular 8-14, Ovulatory 15-21, Luteal 22+) as a rough guide - they are NOT personalized to cycle length, because personalizing them would be ovulation prediction, which is a medical claim this app does not make. Irregularity (cycle lengths varying by more than 2 weeks) and menopause (no period in 12+ months) are surfaced as informational messages with links to NHS/RCOG, never as automated actions or diagnoses. `src/calculations/menstrualCalculations.js` owns the cycle logic; `src/repositories/menstrualCycleRepository.js` owns the data.
- **A RETROACTIVE fact must not be snapshotted on a form; a PROACTIVE one can be.** DoxyPEP is judged *after* the event (a dose within 72h of it), so an answer given when the encounter is created is a snapshot of a moment: the only answers that exist yet are "not indicated" and "not yet taken", and the record keeps saying "not yet taken" for ever after the dose is logged. PrEP coverage is judged *before* the event, so it is knowable and stable, and belongs on the form. The general rule: **if the answer can change after the record is written, derive it where it is shown and do not store it.** `src/calculations/encounterProtectionContext.js` owns that rule (`inferDoxyPepStatus`, `inferPrepCoverage`, `resolveDoxyPepDisplay`), and `src/components/encounterDoxyPepFieldGuard.test.js` guards the form against asking for the field again.
- **Copying a value out of one module into another is where "the maths is right, the words are wrong" hides.** The DoxyPEP deadline has always been anchored to the **first** qualifying activity — that is BASHH's "cover a period of activity with one dose at the end" pattern — while its notification body said "72 hours since your **last** qualifying activity". The code was correct and the user was misinformed, in the one place where the difference decides whether someone takes a dose later than the guidance allows. Re-check with:
  `Select-String -Path src\calculations\doxyPepSync.js -Pattern "qualifying activity"` A guidance link asserted as
  `^https://www\.nhs\.uk/` stayed green while its path 404'd, which is how a dead
  link shipped. Do not close the gap by pinning the full path in a unit test —
  that re-asserts today's path, which is the thing that goes stale. Keep each URL
  in one named constant and re-check by hand with
  `curl.exe -s -o NUL -L -w "%{http_code}" "<url>"` (want `200`). Reachability
  belongs in a scheduled check, not in a blocking build.
- **Personal-alpha vs. public-alpha split**: this repo (`drwho2001/SHOS-V2`)
  is the public track. The owner's real personal data must never land here —
  seed/demo data only. History was rewritten once (27 Aug) to purge personal
  data that had leaked into comments; don't reintroduce real names, specific
  addresses, or identifying details into code comments or seed data.
- **"This isn't an EHR"** is the standing self-check before proposing new
  structure — auto-logging, cross-module history, and a schema editor have all
  been explicitly rejected on this ground before. Apply it to new feature
  proposals before building them.
- **Icon-only UI needs an explanatory affordance.** An icon with no adjacent
  text label needs a tap-to-reveal info icon explaining what it means or how
  it's calculated — unless the icon is a truly universal standard (a gear for
  Settings, a person for a profile, a magnifying glass for Search). Not a
  hover-only tooltip: this app targets touchscreens. This rule is permanently
  gated by `src/components/iconOnlyUIAudit.test.js`; when adding an affordance,
  assert it **says something**, not merely that the attribute exists — the first
  version of that assertion passed against `aria-label={undefined}`.
  A fix that changes a card's semantics should re-examine the controls sitting
  inside it: that is how Contacts' favourite star survived as a bare
  `<div onClick>` with no role, `tabIndex` or name.
- **Jargon needs its definition at the point of use, and guidance needs its
  source on screen.** A term defined in the Glossary but used bare on a form is
  undefined for the person actually holding the phone — the 2-1-1 PrEP regimen,
  the Dom/sub/Vers role axes, bare "BASHH" on the Home testing ring. Use
  `<JargonNote>`; it is a tap-to-reveal bubble, not a permanent line, because a
  permanent explanation beside every term turns a form into prose nobody reads.
  Two rules it enforces, both worth restating: **a note stating clinical
  guidance attributes it inline** (`(BASHH 2025)`) — an unattributed dosing
  schedule reads as developer folk wisdom — while **a note explaining this app's
  own vocabulary cites nothing**, because borrowing clinical authority for an
  internal convention is its own kind of lie. One owner for the copy
  (`src/calculations/jargonNotes.js`), gated by
  `src/components/jargonNoteCoverage.test.js`. When threading a prop that a note
  depends on, assert the whole render chain, not just the call site — L-082, and
  the reason is a mutation, not a theory.
- **An AST guard must parse `src/` once, not once per round.** Any guard that
  walks a fixpoint — re-visiting files because the *question* grew even though the
  source did not — must hoist the parse outside the loop
  (`parseAllJsx` in `src/components/glossaryPropChain.js`). Parsing per round
  handed all of `src/` to `@babel/parser` six times over, and the prop-chain
  guards went from 28s to ~85s standalone and contributed to the vitest worker
  being **OOM-killed** during the full suite (`ERR_IPC_CHANNEL_CLOSED`) at
  251-435 MB free — which reads as a broken runner, not a slow test, so it
  produces no failing assertion to investigate. If a guard's cost grows with
  rounds rather than with the code, the loop is doing the wrong work. See t109.
- **A test that does real work gets an explicit timeout with reasoning inline.**
  `vitest.config.ts` sets no `testTimeout`, so every test inherits Vitest's 5000ms
  default. Tests that parse `src/` or dynamically import modules are near that line
  under full-suite load — measured 2314ms for `clearSampleData.test.js` at 799 MB
  free, vs 817ms in isolation (a 2.8x load penalty). The fix is `}, 30_000);` with
  a comment block explaining why, matching the `uuNoteLinkGuard` precedent. A bare
  number is indistinguishable from a value chosen to make a red run green.
- **A per-test timeout is the THIRD argument, or it is not a timeout at all.**
  `it(title, timeoutMs, fn)` is not a supported vitest overload. Vitest 3.2.7
  parses it, runs the test, and **silently discards the number** — so the test
  reads as budgeted while carrying the 5000ms default, and nothing reports the
  mistake. All nine tests in `src/storage/widgetRedactedRender.test.js` were
  written that way, beneath a 40-line comment justifying the budget that had
  never once been in force. Write `it(title, fn, 40_000)`;
  `src/components/inertTimeoutGuard.test.js` fails the build if the
  second-argument form returns. Two supporting rules, both from getting this
  wrong: **to prove a timeout is live, the probe must exceed 5000ms** — a probe
  finishing in 150ms passes under either behaviour and proves nothing; and
  **never assert a timeout's effect from the source text**, since the whole
  failure is invisible in the text. Re-measure when you touch one. Note t109 is
  only partly real: its `clearSampleData` and `uuNoteLinkGuard` fixes use the
  supported form, but it shipped this file's fix inert.
- **Every commit ends with an attribution footer** — a hard requirement:
  ```
  Co-Authored-By: Claude <model-name> <noreply@anthropic.com>
  Claude-Session: <this session's own claude.ai/code/session/... URL>
  ```
  Both lines are specific to whichever session/model made the commit. Don't
  copy a literal URL from a past commit; `git log -1` shows the format.

## Shipped history (moved out 8 Oct 2026)

Everything that used to be a `## Recently shipped` heading in this file now
lives in **`docs/HISTORY.md`**, which is read on demand and is NOT auto-loaded.
It has deliberately been left verbatim, including its duplicate entries, because
it is a record rather than an instruction, and a stale line in an on-demand file
is inert — whereas a stale line in an always-loaded file is a task waiting to
be executed.

- **"why is it written like that?"** — the reasoning is in the history entry for
  it. Do not rewrite behaviour back to the obvious.
- **"is X done?"** — do not answer it from this file. See the standing rule; the
  answer is `pool list` or the code itself.
- **"did we already try this?"** — `session-bridge.mjs backlog`, which records
  decisions and dead ends, or `git log`.

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
  `useEscapeToClose.js`.
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

- **The local loop is `npm run verify:fast`** (~2 min, no smoke). CI is the real
  gate, in ~11 minutes including the full smoke suite. A full local run before
  every push is redundant, and on this 4 GB machine it is actively harmful —
  the project has lost hours to smoke failures that were pure memory
  starvation. Run the full local gate (`npm run verify:smoke`) only to debug a
  smoke failure interactively, which is the one thing CI cannot do for you.
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

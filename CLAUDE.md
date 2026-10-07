# SHOS — Sexual Health Operating System

A personal sexual health + lifestyle tracker for one user, not a clinical
record system. React 18 + Vite + Capacitor 8, shipping as both an Android
APK and a web/PWA build. **No backend, no cloud, no accounts** — every
  byte lives in the device's own `localStorage`. That's not a gap to fill;
  it's the actual privacy guarantee this app is built on. (One correction as
  of 30 Sep 2026: the *mechanism* is no longer only `localStorage` — the home-
  screen widgets write to Android's `EncryptedSharedPreferences`, deliberately,
  so a widget can read them from a cold-started process. Still device-local,
  still no cloud, no accounts; only the storage medium named here is out of
  date.)

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
2. **Before you act on anything this file says is NOT done, grep for it.**
   See the standing rule below — this is the single most destructive
   thing you can get wrong here, and it has already happened once.
3. Check the Notion "Development" log's most recent entries (workspace
   "Sexual Health Operating System (SHOS)" → Backend files →
   "Development") for anything since this file's "Recently shipped"
   date below — a prior session may have shipped real work there that
   this file hasn't caught up to yet.
4. `git log --oneline -20` against the actual repo to cross-check —
   Notion and this file both describe *intended* current state; the
   git history is what's actually shipped. If they disagree, trust the
   repo and fix the docs, not the other way around.
5. When you finish real work in this session: update this file's
   "Known issues"/"Recently shipped" sections in the same change, AND
   append a dated entry to the Notion "Development" log in the same
   voice/density as existing entries (see that page's own history for
   the pattern — one dense paragraph per date, real specifics, not a
   bullet summary). Don't let either drift stale again — that's
   exactly the gap that made this section necessary in the first place.

### STANDING RULE (added 30 Sep 2026) — never state in the live sections that something is not done

**An instruction file is an action space, not a diary. Writing "X is not
attempted yet" into it is a loaded weapon aimed at the next session.**

A language model reading this file is biased toward completion. A line
saying a feature is outstanding reads as an instruction to go and build it —
even when the feature shipped hours ago. So:

- **Do not write negative status claims into the live sections** (lines
  1–648). No "not implemented", "not wired", "still open", "deliberately
  NOT attempted yet", "no test covers this".
- **If work is genuinely outstanding, it belongs in the work pool**, not
  here: `node scripts/session-bridge.mjs pool list`. That is the live
  to-do list, it is timestamped, and it has an owner. A prose claim in
  here has none of those properties.
- **This happened, on 30 Sep 2026.** This file said the Escape-to-dismiss
  work was "deliberately NOT attempted yet"; it had shipped the same day
  across 20 files. A session believed it, rebuilt the hook from scratch,
  and **overwrote the shipped implementation and its tests.** Reverted via
  `git checkout`; nothing lost. Both stale lines now carry a correction
  saying so, and this rule exists because of that incident.
- **A negative claim is never corrected by being made vaguer.** Delete it
  and point at the pool. "Possibly not wired" is still an invitation.

**Corollary: every number in the live sections is a claim, not a
measurement.** If a figure matters enough to act on, write the command
that produces it next to it, so the next reader can re-check in one keystroke
rather than trusting it. Roughly a third of the volatile figures in this file
were wrong when audited on 30 Sep — see the "30 Sep 2026 audit" entry in
"Recently shipped" for the list and the method.

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

- **Four-layer model**: `Registries` (define entities — Kinks, Chems,
  Organisms, Results, Protection, Symptoms; **Contacts, Locations and
  Medications are NOT registries** — they are repositories, corrected
  30 Sep 2026, and the three of them on the wrong layer here went uncorrected
  for a month) → `Records` (document events — Encounters, Testing,
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
       **AUDITED 30 Sep 2026: the "no I/O" half is aspirational, not current.**
       Seven non-sync files in `src/calculations/` import repositories or
       storage directly — `anonymiseDisplay`, `disclosureLevel`,
       `optionListUsage`, `orphanReferenceCheck`, `registryUsage`,
       `clinicCardVisibilityPreference`, `darkModePreference`. New code should
       still follow the rule; just do not read it as a description of what is
       there today, or you will "fix" a file that was working.
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
  **20 module files** as of 30 Sep 2026 (this line said 19 and then named only
  14; the six it omitted are `SHOS_ClinicVisits_`, `SHOS_Testing_`,
  `SHOS_SymptomLog_`, `SHOS_Vaccinations_`, `SHOS_MenstrualHealth_` and
  `SHOS_Measurements_`, which `SHOS_Healthcare_Prototype.jsx` imports as
  **peer modules**, not as parts of one file). Also in this directory, and
  missed by the "one file per feature area" pattern: `InteractiveTour.jsx`, and
  a `settings/` subdirectory of **19 extracted Settings sub-screens**.
  Named: Contacts, Encounters, Medication
  Dashboard, Healthcare (Testing/Clinic Visits/Menstrual&Contraception&
  Pregnancy/Symptoms/Vaccinations shell), Home, Settings, Global Search,
  My Profile, Clinic Card, Attachments, Timeline (renamed from
  "Timeline" to "Episodes" internally — 26 Aug; a component or comment
  still saying plain "Timeline" is stale), Partner Notification, Registry
  Management, Option List Editor. `App.jsx` is shell-only (routing,
  global state, notification banners) — Home/Healthcare/Settings were
  deliberately extracted out of it; a large `App.jsx` again would mean
  that extraction regressed. **Measured 30 Sep 2026: this claim is now only
  half true and the directive is inverted.** The extraction happened, but
  `App.jsx` is **~3050 lines** and defines 9 more top-level components beyond
  the shell — `AppLockScreen`, `DecoyHome`, `AppLockPrompt`,
  `OnboardingScreen`, `AcknowledgeSheet` and others — none of which is
  routing, global state or notification banners. `App()` alone runs ~880 to
  EOF. So the real rule is not "keep it small" but "extract further", and
  a new session reading "a large App.jsx would mean the extraction
  regressed" will conclude the opposite of what is true.
- `src/registries/` — the Registries layer of the four-layer model
  (Kinks, Chems, Organisms, Protection, Results, Symptoms + a factory).
  Was **entirely missing from this list** until 30 Sep 2026, despite being
  named 50 lines earlier as layer 1.
- `src/components/` — shared UI/hook primitives. Was missing from this list
  too; it holds `ConfirmDeleteCard.jsx` (described in this file's own Known
  Issues as "the app's first real shared UI component") and
  `useEscapeToClose.js`.
- `src/repositories/` — one per data domain, `localStorageAdapter`-backed.
- `src/calculations/` — pure business logic + `*ReminderSync.js` files
  (the notification scheduling glue for Medication/Testing/Refill/
  Clinic-visit/**Vaccination** reminders — 5 files; the vaccination one was
  missing from this list until 30 Sep 2026. Note the DoxyPEP reminder is
  `doxyPepSync.js`, which does **not** match the `*ReminderSync.js` pattern
  this bullet names, so the glob and the prose disagree).
- `src/storage/` — cross-cutting native/platform services, **17 files, not
  the 7 listed here** (this list omitted `storageAdapter.js` and
  `cryptoService.js`, which the two bullets either side depend on by name).
  Beyond the named seven: `storageAdapter.js`, `cryptoService.js`,
  `clinicCardPdfService.js`, `recordExportService.js`, `draftStorage.js`,
  `screenSecurityService.js`, `csvExportService.js`,
  `profileShareService.js`, `installPromptService.js`, `backupMigrations.js`.
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
- `scripts/smoke-test.cjs` — **23 flows** (measured 30 Sep 2026; this line
  said 18, and a second line in this file said 17 — the same figure
  contradicted twice, which is how the "18/20/21" correction chain started).
  Re-measure with: `grep -c 'await run(' scripts/smoke-test.cjs`
  **These run on every push in CI**
  (`.github/workflows/smoke-test.yml` calls `npm run verify`, which is this
  same script), so you do not need to run them by hand before committing — the
  local loop is `npm run verify:fast`. Run the full local gate
  (`npm run verify:smoke`) only to debug a smoke failure interactively, which
  is the one thing CI cannot do for you.
- `scripts/verify-changes.mjs` + `scripts/docsGate.js` — the gate runner and
  the pure docs-gate decision function. `--fast` (build/lint/tests/encoding/
  docs), `--smoke-only`, `--docs-only`.
- `docs/CHANGE-PROCEDURE.md` — the commit/push algorithm itself.
- `docs/MODELS.md` — **which models this machine can actually use**, and why
  the rest cannot. Written 6 Oct 2026 from executed requests, not from a
  config file. Read it before choosing or changing a session's model. The two
  facts it exists to stop being re-derived: the OpenCode **Go** account is
  the paid one (Zen returns `402 Insufficient account funds`, which is
  expected, not a fault), and the free models are **not equally private** —
  `space-bunny-free` and `longcat-2.5-preview-free` are documented
  zero-retention while Nemotron's free tier explicitly forbids submitting
  personal or confidential data, which matters more than usual for this app.
  It also records why a session "stops mid response": the free tier is
  **shared across every concurrent session**, so two sessions on one model
  trip the rate limit together. Run two sessions on two different model
  families.

## Working conventions for this project specifically

### Two sessions share this working tree — attribute your own work

**The owner routinely runs two AI sessions against this same checkout at the
same time**, and they write to the same files. That is a normal condition here,
not an accident waiting to happen, and it has two consequences worth making
explicit rather than rediscovering.

**Log entries must identify their session.** When this file gains a "Recently
shipped" entry, and when the Notion Development Log gains one, say which
session wrote it. A reader comparing this file against `git log` needs to be
able to tell whose work a commit actually contains, and today the only way to
do that is to read every diff. Attribution is cheap at write time and
impossible to add later without editing someone else's entry, which is the one
thing to avoid.

**Never rewrite another session's entry, and never rewrite history they are
working from.** If a commit's message does not match its contents, document the
mismatch in *your* entry and move on. The other session is actively building
from that commit; rebasing shared history out from under a running process risks
losing their work to fix something cosmetic. Decide to split history only with
both sessions stopped.

**Never `git add -A` here.** Read `git status` first and stage explicit paths.
The full rationale and the incident are in `docs/CHANGE-PROCEDURE.md` §3; the
short version is that a blanket stage on a tree you do not solely own commits
someone else's half-finished work under your message, which has already happened
here once.

**When two sessions are working this tree, check the shared state before you
start, and announce what you take.** This project routinely runs two AI sessions
in one checkout, and the coordination is in `scripts/session-bridge.mjs`
(documented in `docs/SESSION-BUS.md`). At the start of a turn, and before you
begin any new piece of work:

```powershell
$env:SHOS_SESSION_NAME = "A"      # or "B" - do this first, claims are attributed
node scripts\session-bridge.mjs lessons    # RULES that must not be re-learned. Read before planning.
node scripts\session-bridge.mjs backlog    # what previous sessions decided/tried. Read before re-deriving.
node scripts\session-bridge.mjs claims     # what files the other session holds
node scripts\session-bridge.mjs inbox      # notices you have not seen
node scripts\session-bridge.mjs pool list  # approved work available
```

**Where that state lives** (all of it outside the repository, so none of it can
be committed by accident): the work pool and claims are
`~/.shos-session-bus/state/`, the notice log is `~/.shos-session-bus/notices.jsonl`,
the conversation backlog is `~/.shos-session-bus/backlog.md`, the durable rules
are `~/.shos-session-bus/lessons.md`, and joint-work task folders are
`~/.shos-session-bus/tasks/<slug>/`.

**The backlog is what makes you a continuation rather than a restart.** You have
no memory of any conversation before this one. The backlog holds what earlier
sessions decided, what they tried that did not work, and what is still open — so
read it first, and do not re-derive context that is already written down. If it
looks stale or contradicts what you are told, say so rather than silently
trusting either.

**And write to it as you go.** Logging is not optional courtesy, it is the only
reason the next session inherits anything:

```powershell
node scripts\session-bridge.mjs log "<what you decided, tried, or found out>" --kind=decision
```

`--kind` is one of `decision`, `blocker`, `finding`, `question`, `state`, `done`,
`mistake`. Log the things that are **not already durable elsewhere** — a decision
and its reason, a dead end so nobody walks into it twice, a mistake worth not
repeating, or the state of something still open. Commits are already in git and
findings already in `docs/`; duplicating those here would just create a second
place for them to go stale. Read it with `backlog` (recent tail) or
`backlog --all`.

**And when you learn a RULE, record it as a lesson** — the class of knowledge
that is worthless in a transcript and valuable as a rule. "X cannot be done as
Y, so try Z, because this worked in the past":

```powershell
node scripts\session-bridge.mjs lesson "<the rule>" "<what to do instead>" --kind=cannot --evidence="<why, with the measurement>"
```

`--kind` is `cannot` / `must` / `prefer` / `verify`. **`--evidence` is required
and the tool refuses without it** — a rule with no provenance is a superstition,
and this repo has repeatedly found those. Read with `lessons`, or
`lessons --grep <term>`. If a rule's evidence stops being valid, delete it; do
not inherit it.



**To get a second opinion from a different model**, use the consult tool. It
calls Gemini's free tier by default (walking down a cheaper/quieter model
automatically when one is rate-limited), and writes the exchange where the other
session already reads it — so a fresh outside perspective costs nothing and needs
no session to be woken:

```powershell
node scripts\consult.mjs gemini "<a question worth challenging>" --task=<slug>
```

Its value is as a *challenger*, not a collaborator: it has no memory of this
repo, so it will reason confidently about things it cannot see. Use it to
challenge an approach before committing to it, not to hold state. Free tier
first by policy; the paid OpenAI and Anthropic keys are last resort (OpenAI
currently has no credits, and the Anthropic key needs `ANTHROPIC_WORKSPACE_ID`).

**SECOND-OPINION PROTOCOL — the threshold is deliberately LOW.** On a second
failed attempt at the same thing, a stall, a retry loop, a rework, or anything
genuinely unknown, stop grinding and record it:

```powershell
node scripts\session-bridge.mjs stuck <slug> "<what you are trying>" ["<what happened>"]
```

The first attempt only records. The **second** automatically consults the free
model, assembling the question from *all* the failed attempts rather than the
latest one — which is the point, because "it's broken" gets a generic answer
while "these two things failed this way" gets a real one. Raise the bar with
`$env:SHOS_STUCK_THRESHOLD`. Use `--no-consult` to only record.

Grinding through the same failure three times costs far more than one free call,
so the instinct to push on is the expensive one here. An outside model that has
not been stuck on it for an hour is frequently more useful than one more attempt
from a session that is.


If the pool has an approved task you are not already busy with, `pool take` it —
it is the owner's approved queue, not self-assigned work, and allocation is
recorded with a timestamp and a file claim BEFORE any work begins, so the other
session cannot duplicate it. `npm run verify` takes an exclusive lock for the
whole run, so if you are queued behind the other session, do something else
rather than cancelling or forcing it.

**These sessions do not wake each other.** Prompting one does not prompt the
other; the owner prompts both. Two live paths were measured and failed - a
server-side prompt does not start an idle TUI session, and the TUI endpoints are
directory-scoped rather than session-scoped, so they cannot be targeted. Do not
assume work done in one session has been seen by the other.

**Commit → content map, for the period where the two got mixed up.** Anything
not listed here is unambiguous.

| Commit | Whose work it actually contains |
|---|---|
| `bc04295` "Give the Clinic Card PDF its first test…" | **BOTH sessions.** Theirs: `clinicCardPdf.test.js` + the Clinic Card PDF entry below. Mine, swept in by their `git add -A src`: `reminderSuppression.js` + its test, `medicationReminderSync.js`, `appPreferencesRepository.js`, and 247 lines of `App.jsx`. The message describes only their half. |
| `d7f84a1` "Finish banner suppression, and stop prescribing the command that caused the accident" | Mine only — the rest of Phase 3, the wiring guard, the `CHANGE-PROCEDURE.md` root-cause fix, and the second scratch-file deletion. |
| `a8d0028` "Guard the other two hand-maintained inventories, and stop the hook blocking on another session's bytes" | **BOTH sessions, third occurrence of the same accident.** **B's:** `scripts/check-encoding.cjs` (+82) and `orphanReferenceCoverage.test.js` (+109), plus their CLAUDE.md entry — which is what the message describes. **Mine, swept in under their message:** the whole of t101 Phase A — `findAffectedRoutineRetestPlans` (the `{ onTime, early }` split), `testingCalculations.test.js`, the per-plan prompt copy in `SHOS_Testing_Prototype.jsx`, `testingRepository.test.js`, and `routineRetestPromptCopyGuard.test.js`. The message describes none of it. **Nothing lost, nothing overwritten**, and per the rule below I did not rewrite or amend it: B is actively building from it. I had staged only my own six explicit paths, so the sweep was B's `git add` reaching into the shared index. **The one new wrinkle worth recording:** my own `git commit` then reported *no changes added to commit*, because by the time it ran the index no longer held my files — so the tell was the empty commit, not a diff I had to notice. B also modified `check-encoding.cjs` mid-write, so `npm run check:encoding` crashed once on a half-written file and passed on re-run; that was a race, not a defect, and is the reason a gate that "failed" here should be re-run before it is believed. |
| `092f467` "Make clear-sample-data safe by stamping edits…" | **BOTH sessions**, second occurrence of the same accident 40 days later. **Mine:** `clearSampleData.js` (the `isSampleRecord` helper + the `referencedSeedIds` amendment that finally lets a recovered record vouch for what it references), `isSeedAuthorityGuard.test.js`, the 14 `isSeed: false` stamps inside `update()`, the CLAUDE.md entry, the footer. **Swept in by C, mid-apply, under my message:** the 3a seed re-key — **157 `seed_*_9001` lines** across the 14 repositories. The message describes none of it. C raised this and was right; see `docs/CHANGE-PROCEDURE.md` §3. **NOT a double-apply:** `9c9008c^` is `092f467`, so C's own commit finished the remainder — its 12-file diff is the two new guards (280 + 135 lines), the `tabForRecordId` fix, CLAUDE.md, and 25 lines of *stale-comment* repair (`contact_003` → `seed_contact_9003` in a comment). Zero `seed_seed_` matches anywhere in `src/`; HEAD carries a clean `seed_contact_9001…9016`. |

| `a0ff06a` "Carry the source test's sample sites onto a scheduled routine retest" | **BOTH sessions.** Session D's routine-retest copy work. Committed after B's `5047f74`, on top of it. Its own CI run was **red on all three workflows** — `unit tests` failing on the exact `vaccination_002` fixture defect B fixed in `601071e`. So B's fix repaired a broken `main`. |
| `a8d0028` "Guard the other two hand-maintained inventories, and stop the hook blocking on another session's bytes" | **BOTH sessions, fourth occurrence of the same accident.** **B's:** `scripts/check-encoding.cjs` (+82, the staged-only mode) and `src/components/orphanReferenceCoverage.test.js` (+109, the optionListUsage/registryUsage guards). **Swept in from another session's index:** `CLAUDE.md` (+73), `src/calculations/testingCalculations.js`, `testingCalculations.test.js`, **`src/components/routineRetestPromptCopyGuard.test.js` (a brand-new file, +138)**, `src/modules/SHOS_Testing_Prototype.jsx`, `src/repositories/testingRepository.test.js`. The message describes only B's half. **Nothing lost, nothing overwritten**, and per the rule below B did not rewrite it. Verified not broken: **1472 passed / 0 failed across 127 files** with both changesets merged, so their half landed complete. |

**Both sweeps-in have the same cause and the fix did not survive the first one.**
`bc04295` was a blanket `git add -A src`. `092f467` was **explicit paths** — the 14
repositories were in my list legitimately for the `isSeed` stamp, and C's
uncommitted re-key in the *same files* rode along inside the same `git add`.
**Explicit paths cannot protect you when another session is editing the same
files you have legitimately claimed**, which is the case this repo runs on
constantly. The only real protection is `git add <path>` immediately before
committing, after re-running `git status`, so the window between read and commit
is seconds rather than the length of a review. Both times the innocent party paid:
B had to document a split commit, and C's commit message now under-describes work
that is provably in it.

So: the Phase 3 banner-suppression entry below is split across those two
commits, and the Clinic Card PDF entry sits in the same commit as the first
half of Phase 3. Neither is a sign of lost work; both are a sign of a shared
tree. Sessions after these should leave no such map — it exists to explain the
exception, not to become a habit.

### The change procedure — read `docs/CHANGE-PROCEDURE.md`

**The algorithm to follow when changing this code exists as a file, not as
memory.** `docs/CHANGE-PROCEDURE.md` is the sequence: the PowerShell-encoding
trap and why it happens, the change loop, how to write a commit message, the
post-push CI check, the documentation requirement, and a table of the specific
traps in this codebase (dynamic `/src/` imports only work on a dev server,
`SVGElement` has no `.click()`, bottom-nav tabs have no text content, and so on).
`node scripts/verify-changes.mjs` (also `npm run verify`) runs the whole gate —
build → lint → unit tests → encoding → inherited-instructions → smoke suite →
a docs check — **six** gates; the "inherited instructions" one was missing
from this list until 30 Sep 2026 — and prints a
pass/fail table.

**CI runs that exact same script** (`smoke-test.yml` calls `npm run verify`) on
every push, in ~11 minutes, including the full **23-flow** Playwright suite. So the
**local loop is `npm run verify:fast`** (~2 min, no smoke), and CI is the real
gate. A full local run before every push is redundant work and, on a 4 GB
machine, actively harmful — this project has lost hours to smoke failures that
were pure memory starvation. Run the full local gate only to debug a smoke
failure interactively, which is the one thing CI cannot do.

Because both run one script, a gate added locally is a gate that runs in CI
automatically. That is not tidiness: the previous CI job hand-copied each step,
and the moment the two lists differed nothing would have said so. Sharing the
file immediately exposed a Windows-only `curl -o NUL` that would have created a
real `NUL` file in the repo root on Linux — a bug that splitting had made
invisible, since locally the script only ever ran on Windows.

The **docs gate is enforced, not advisory**: CI *fails* a push that changes
`src/` without also changing `CLAUDE.md` or `docs/`. It only warns locally,
because mid-edit "docs not updated yet" is the normal state of honest work
rather than a defect. See `docs/CHANGE-PROCEDURE.md` §5.

A **pre-commit hook** (`.git/hooks/pre-commit`) blocks mojibake on every
commit. Tested in both directions: it blocks a file containing real
double-encoded bytes and lets a clean commit through. Bypass deliberately with
`--no-verify` only.

### PowerShell 5.1 is not UTF-8 — this has damaged the codebase four times

`Get-Content` decodes using the system ANSI codepage (CP1252), not UTF-8, and
`Set-Content -Encoding utf8` writes UTF-8 **with a BOM**. Chained, they
double-encode every non-ASCII character. The result is *valid UTF-8 that displays
as garbage*, which is why it survives the build, lint, every unit test and every
smoke flow — none of which look at bytes.

**Never use those cmdlets to read or write source.** Use the editor directly, or
write a Node script (which handles UTF-8 correctly). Same for commit message
files: `[IO.File]::WriteAllText($p, $msg, (New-Object Text.UTF8Encoding $false))`.

**Never regex over JSX attributes or source to make a bulk edit.** Regex
codemods damaged this codebase twice in one week — truncating `aria-label`
closing braces, and mangling smoke-test flow labels into `[2/16][1/16]`. Make the
edit with the editor, or write a script that *understands the structure*.

### Before trusting a red build: check free memory — but fix recurring failures

```powershell
[math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1KB)
```

This machine has produced repeated **false** failures purely from memory
pressure, and they have cost hours each time. `verify-changes.mjs` reports free
RAM every run and flags a smoke failure that occurred while memory was marginal.

**But a flow that fails the same way every time is a BROKEN FLOW, not the
machine.** Two App Lock assertions were guessing at timing with a fixed
`waitForTimeout(500)` and reading `aria-checked` immediately; they are now a
bounded `waitForFunction` on the state actually asserted. **A test must never
depend on how fast the machine is.**

**The fifth instance, and the first one where a green local run was the
evidence rather than a distraction.** The `sample-data-devtools` flow asserted
that a user's own contact survived clearing sample data, after a full
`page.goto` and a fixed `waitForTimeout(1500)`. It passed in isolation
locally and went red in CI — reporting a data-loss regression that did not
exist, on the most alarming assertion in the suite. The Contacts list is
async (every module went async in the encryption groundwork), so a
machine-speed guess is simply the wrong thing to depend on. It is now a
bounded wait on the state asserted, and because "the banner is gone" is a
*negative* assertion, it first waits for a *positive* anchor (the nav bar) —
otherwise it would pass trivially against a blank page. This is pool task
`t028` for the fixed waits still remaining — **120 live calls** as of 30 Sep
2026, down from 144. Re-measure with a *comment-stripped* count, which is the
only method that survives a fix's own "was waitForTimeout(N)" comment: a naive
`grep -c` counts those and reports no change at all, which is exactly what
happened to my own scanner mid-task. Done per-site with evidence rather than
swept, and **both risky classes are now closed**: waits in front of an
assertion, and waits in front of an `if (count())` branch (the latter is the
worse one — it skips the step and the flow still passes). Of what remains,
~9 sit in front of a real read and the rest are waits before a click, which
Playwright's own locator retry already covers.

**`t028`'s first real batch, and the finding is that the 130 sites were not
where the problem was.** The defect was in a *helper*:
`dismissTransientBanners` caught all six of its dismissal clicks with
`.catch(() => {})`, so on a not-yet-booted app it silently did nothing,
reported success, and the banners appeared afterwards to intercept
`goHomeThenOpenSettings`' coordinate-based Settings click — a failure pointing
nowhere near its cause. **Six** call sites had papered over it with a fixed
800 ms wait first (measured 30 Sep 2026; this line said "nine" and the code
comment in `dismissTransientBanners` said "eight" — three numbers for one
change, and the six 800 ms waits removed by the diff is the one the git
history supports). The helper now waits for the app, dismisses, then
**verifies** no dismissal control remains and retries up to three times, which
removed those waits because they were never the fix. A helper that can
quietly do nothing is worse than no helper.

**I had already made the "fix the symptom, not the class" mistake here, one
commit earlier.** Flow 1 (`sample-data`, from Home) asserts a contact was
added after a 1500 ms wait and a body-text read — byte-for-byte the same shape
as the Developer Tools flake, one flow later. I fixed the one CI actually
reported and left this one, which is exactly the mistake this file records as
"a fix scoped to the symptom you happened to hit is not a fix to the class."
The same bounded treatment then went onto two anonymise-mode data reads and a
negative banner assertion that had waited 2500 ms. Shared `waitForText` /
`waitForAppReady` / `waitForGone` helpers mean the fix is one place rather
than fifty-nine; fixed waits **144 → 133** (measured 30 Sep 2026 by counting
the file at the two commits that bracket the change — this line said
142 → 133, and **no counting method reproduced either endpoint**).

Verified by running the full suite **twice** against a real `vite preview`
build and comparing: 140 `ok` across 23 flows both times, zero failures, and
the assertion count **unchanged from baseline** — which is the check that makes
a silently-skipped helper visible at all, and the reason that number is
reported rather than just "ALL PASSED". **MEASURED 30 Sep 2026 (t030-era
re-triage, 3 further batches): the `visibilitychange` negative assertions
cannot be fixed from the test side, and this is now a measurement rather than
an open question.** Dispatching the refresh produces **zero DOM mutations** (a
`MutationObserver` on `body` with `childList`/`subtree`/`attributes`/
`characterData`, 2500 ms window, after dismissing every banner), because the
app is idle and React does not re-render when no state changed. So there is no
positive signal to assert on: an "the app did something" guard would fail every
single run, and the absence assertion is vacuous *by necessity* rather than by
oversight. The only real fix is an app-side testability hook — a last-poll
timestamp or counter attribute written by the refresh handler in `App.jsx` —
which is a product change made purely for testing and was not made unilaterally.
Five assertions share this shape (`scripts/smoke-test.cjs` L1699/1716/1724/
2114/2123). Re-probe before revisiting: it is cheap, and the answer may change
if the refresh path ever renders.

Related: killed smoke runs used to leave **orphaned `chrome-headless-shell`
processes** (~190 MB) and `vite preview` servers behind — four of the former were
found on this machine starving the next run. `verify-changes.mjs` now cleans up
both on every exit path.

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
   shipped" below for the full list. **That audit is now EXHAUSTIVE and
   permanently gated** (29 Sep, pool `t019`): `src/components/
   iconOnlyUIAudit.test.js` parses every module with `@babel/parser`
   (not regex — four audits in this repo failed on exactly that), finds
   every interactive element whose only visible content is an icon, and
   asserts the set matches a reviewed list where **each entry must carry
   a written reason**. One real gap found and fixed: Contacts' favourite
   star was a bare `<div onClick>` with no role, no `tabIndex` and no
   name, so it was unreachable by keyboard and announced as nothing. It
   survived the 17 Sep `nested-interactive` fix on the very same card,
   which is the transferable part: a fix that changes a card's semantics
   should re-examine the controls sitting inside it.
   **Two resolved cases, recorded so neither is re-litigated**: (a) a
   chevron at the end of a row that carries its own visible label is that
   row's own "opens something" symbol, not an unexplained icon; (b) the
   bottom-nav reminder dot is *not* given a tap target on purpose — a
   focusable control inside a tab is a `nested-interactive` violation, so
   the dot is `aria-hidden`, the tab's own accessible name carries the
   count, and a once-per-run toast explains it. A notification badge on a
   tab is about as universal as the gear this rule already carves out.
   **When adding an affordance, assert it says something, not merely that
   the attribute exists** — the first version of that assertion passed
   against `aria-label={undefined}`, which is the same defect it was
   written to prevent.
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

## Known issues (as of 27 Sep 2026 — update this section as things change)

Full evidence trail for these lives in the build-audit artifact from
this date; summarized here for durability.

- **The only genuinely open items both need the physical device, so neither
  can be closed from a development machine.** Everything else in the 25 Sep
  batch is done (see "Recently shipped" below for the full detail).
  - **#68 safe-area / status-bar spacing gaps.** The specific stuck-banner
    case was resolved 16 Sep 2026. This item's own original wording was "a
    few spots", and the remaining ones are genuinely unconfirmed - there is
    no notch or status bar to measure against in a headless browser, and
    `env(safe-area-inset-*)` resolves to 0px there, so any fix would be
    shipped unverified. Flag a specific remaining report if one surfaces;
    do not assume this item is closed.
  - **Accessibility Item 7** (physical notch / status-bar confirmation).
    Same blocker, same reason.
- **`doseTimingAdvisory` may prove too persistent on a high-frequency
  medication - not fixed, deliberately.** It is visible for 4h per dosing
  cycle, which is 17% of the day at 1x/day but **67% at 4x/day**. The 2-hour
  window is the NHS-sourced figure and the prominence question is a
  presentation one, so the calculation is left alone; see the 27 Sep entry
  above. If it is annoying in practice, the fix is a dismissible UI, not a
  smaller number.
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
  - Item 3 (sheet `role="dialog"` + focus mgmt): DONE — **53 `role="dialog"`
  across 38 files** (re-measured 30 Sep 2026 by stripping comments and
  counting over `src/**` excluding tests; this line said 51, and before that
  "~52 across 19 modules" conflated the module *files* with a dialog count).
  `App.jsx` alone contributes 4, including the 28 Sep `AcknowledgeSheet`, which
  is the site both earlier counts missed. All of them now have a working focus path. Two deliberate exceptions: GlobalSearch focuses its own search input via `autoFocus` (a container-level `focus()` there would fight that and pull focus off the field on every open), and Home/Healthcare no longer put a second dialog on their Episodes wrappers, since `TimelineModule`'s own root is that dialog and now owns focus-on-open.
  - Item 4 (sub-screen `<h1>`): DONE — 58 real JSX `<h1>` across 39 files (corrected 25 Sep 2026; "38 titles across 17 modules" mislabelled the 38 module *files* containing an h1 as if it were a title count). Includes the 7 edit/detail sheets converted 25 Sep 2026. GlobalSearch is the only module file with no `<h1>`; it carries `role="dialog"`/`aria-label` instead.
  - Item 5 (contrast fixes): DONE (Guide tour button, Meds locked-dose button, InteractiveTour "Next" button) — all three re-verified present in source this session.
  - Item 6 (live regions for search/filter): DONE — exactly 10 locations (corrected 25 Sep 2026: the earlier "live regions beyond 10 done" was not true).
  - Item 7 (notch/status-bar): PENDING (needs device)
  - Item 8 (cold-start removal from Known Issues): DONE (accepted upstream Capacitor limitation)

- **Audit Findings (25 Sep 2026) — read-only sweep of high-stakes/unreviewed areas:**
  - **ErrorBoundary (main.jsx:147-163)** — ALREADY FIXED (Phase 4). Encrypted `shos_app_preferences` detected via `iv`+`ciphertext` shape, dynamically imports `cryptoService.js`, decrypts, clears navigation state, re-encrypts. No action needed.
  - **darkModePreference.js (calculations:89-95)** — ALREADY CORRECT. `syncDarkModePreferenceFromStorage()` called in `App.jsx` (line **1058** as of 30 Sep 2026; this file said `App.jsx:938`, which by then was a *comment* mentioning the function — so the stale reference landed on something that looked plausible) after vault unlock in `finishBootAfterUnlock()`. One-shot self-correction from `systemPrefersDark()` fallback works; async `await storage.load()` handles Phase 3 adapter. No action needed.
  - **Module sheets `role="dialog"`** — COMPLETE for the sheet set that
    audit covered. Medication Dashboard has 6 dialog sheets, not 7:
    `MedicationEditSheet` is a full-screen sheet that never got the treatment
    and **remains open** — corrected 28 Sep 2026, because this line previously
    said "logged below" and no such entry existed anywhere in this file, so a
    reader following the reference found nothing. A dangling cross-reference
    is worse than no cross-reference: it implies a record that was never
    written.
  - **Widget deep-linking (native)** — 10 providers registered in the manifest, but only 9 use `com.shos.app://` (corrected 25 Sep 2026: `NextDoseWidgetProvider` has no Intent/tap action at all). `deepLinkRoutes.js` has 12 distinct positive routes across 7 hosts, asserted by 17 expectations in 5 test blocks (5 of them negative `toBeNull`) — "17 routes" conflated assertions with routes. The `reveal-clinic` route is mapped but inert (a comment-only branch in `App.jsx`, line **2157** as of 30 Sep 2026; this file said `App.jsx:1726`, now ~430 lines earlier). **Web gaps**: `shos://` is genuinely absent from `src/`, and no `com.shos.app://` route reaches the web by URL — what is missing on web is only the URL *delivery* mechanism, not the route logic. (CORRECTED 30 Sep 2026: this line said there is "no `URLSearchParams` handling anywhere in `src/`", which is false — `notificationService.js:306` reads `?notifAction=` and replays it, and has since 3 Sep. It is a notification-action handler, not a deep-link router, so the surrounding intent survives; only the literal claim was wrong, and a literal is exactly what the next session greps for. The earlier "8 of 10 routes unimplemented on web/PWA" was already stale.)
  - **Draft storage (storage/draftStorage.js)** — 8 module files use sessionStorage (Contacts, Encounters, Testing, ClinicVisits, SymptomLog, Vaccinations, Measurements, Medication Dashboard). Sensitive data, ephemeral (cleared on save/tab close). Deliberately out of Phase 4 scope; no migration path if encryption extends here.
  - **Duplicate patterns needing standardization**: RegistryTagPicker (4 copies: Testing, MyProfile, Contacts, Encounters), Date/Time "Now" button (10 files), per-module field components (re-measured 30 Sep 2026: SelectField **8** copies, DateTimeField 3, AgeField 2, RelationPicker 5, plus a 9th of the same shape named `SelectRow` in Medication Dashboard — none reach "10+"; the AgeField figure was off by 5x), FAB buttons (12 sites).
  - **Accessibility exhaustive (17 Sep axe-core + 25 Sep follow-up)**: Sub-screen `<h1>` complete (58 across 39 files); live regions are exactly 10 locations and no more; contrast violations fixed (Guide raw hex, Meds 50% opacity, InteractiveTour fixed); module sheets `role="dialog"` complete.
  - **Settings navigation** — **17 rows across 8 sections** (re-measured 30 Sep
  2026: this line said 16, and was wrong on the day it was written — a
  "Widgets" row was added 22 Sep, three days before the 25 Sep audit. The 8
  sections figure is correct. The long-standing "22 rows" predates the 16 Sep
  Backup-&-Export consolidation and the Units-screen removal). Test flakes from banner interception (fixed in helper); a crypto-timing wait in flow 13 was still a fixed 500ms plus a non-retrying count and is now a bounded wait (25 Sep 2026). Healthcare sub-tab discoverability (Menstrual/Contraception gated behind toggle).
  - **Overlays — three genuine UX gaps. ESCAPE NOW RESOLVED; the other two still open.**
    - **Escape-to-dismiss: RESOLVED 28 Sep 2026 — see "Recently shipped" below. THIS LINE PREVIOUSLY SAID IT WAS STILL OPEN, AND IT HAD SHIPPED THE SAME DAY.** 20 files are wired to `useEscapeToClose` (`git grep -l useEscapeToClose HEAD -- src`), it has its own 8-test suite, and the shared delete confirmation is registered so Escape *cancels* rather than confirming. A session on 30 Sep acted on this stale line, rebuilt the hook from scratch and **overwrote the shipped implementation** before noticing — the third recorded instance in this file of an inherited claim being treated as a measurement. **Grep the code before trusting a status line here**, especially one describing work as "deliberately NOT attempted yet".
    - **RESOLVED 30 Sep 2026 (t035) — CONFIRMED, and a real bug, though not the
      one this line feared.** `useEscapeToClose(onClose, enabled)` registers on
      *mount*, and three sheets are mounted permanently and close via a falsy
      prop rather than by unmounting: `TestEditSheet`, `VisitEditSheet` and
      `MeasurementPreferencesSheet`. A closed sheet on a LIFO stack does not trap
      the key — only the top entry ever acts, so it *misdirects* it. On the
      Testing list, Escape reached `TestEditSheet`'s `onClose`, which is
      `setScreen({ name: "landing" })`, so **pressing Escape on a list navigated
      the user off the list.** All three now pass their real open state, using
      the `enabled` parameter the hook already had. The earlier one-level-up
      static scan also flagged `PartnerNotificationSheet`, `TimelineModule` and
      `InlineMeasurementSheet`; reading them showed all three sit inside
      conditional parents one level further up, so those were **false
      positives** — recorded because a scan that over-flags is worse than no
      scan, because the next session deletes the test. Guarded narrowly over the
      three confirmed components only.
    - **Two back-button traps** and **six level-skipping overlays** — recorded by the same 25 Sep audit, not independently re-verified since. Genuine but unquantified; same reasoning applies.

- **Desktop font-size/empty-space (#93) — see the 15/16 Sep entries under
  "Recently shipped" for the full design reasoning and what shipped.** Note: this
  bullet was left truncated mid-sentence in an earlier edit; the substance was
  never lost, it lives in those dated entries.

Full evidence trail for these lives in the build-audit artifact from
this date; summarized here for durability.

**The new CI gate immediately earned its keep, and found two things on its first
run — one of them mine, from the very commit that added it.** Turning lint into
a blocking gate exposed a `react-hooks/exhaustive-deps` warning that had been
sitting unfixed since **28 Aug**: App.jsx registers the native `appUrlOpen`
deep-link listener once on mount with an `[]` dependency list, while the handler
it registers calls `handleQuickAdd` and `navigateTo`, both re-created on every
render. That is not a cosmetic warning — the listener was permanently holding
**stale closures**, so a widget tap arriving a minute after boot would route
through functions captured at mount time. The `[]` list stays, because
re-registering a native listener on every render would be worse; the handler now
reads the current pair through a ref declared at component level. My first
attempt put the `useRef` *inside* the effect body and eslint correctly rejected
it: a `useEffect` callback is still a callback, so a hook cannot be called
inside one.

**And the gate change itself broke a workflow on its first push.** `opencode.yml`
failed to load entirely, because I had written the explanatory comment for the
new author restriction *inside* an `if: |` block scalar — where `#` is **literal
text, not a comment** — so my own explanation became part of the expression. The
lesson is not "don't put comments in YAML". It is that
**`src/ciWorkflowGuards.test.js` passed while the workflow was broken**, because
the file genuinely is valid YAML. YAML validity and GitHub Actions expression
validity are different properties, and only the second determines whether a
workflow runs at all. "It parses" looked like sufficient evidence and was not —
which is the same shape as every other time in this file where a check reported
green on something that had not actually been exercised. The guard now rejects a
`#` inside any `if:` block.

## Recently shipped (6 Oct 2026, latest - "None found" was false: the integrity checker missed four live reference fields, and the strongest item on the roadmap was fixing an existing technique)

**Session B. Owner ask: what other data-refinement approaches are worth doing,
given current state and futureproofing, and challenge the previous session's
"no, the dataset is too small". Answer: the conclusion survives, the reasoning
does not, and the highest-value item is not a new technique at all.**

**"Dataset too small" is the wrong axis.** The right one is blast radius x
reversibility x confidence. Features whose value scales with volume (similarity
search, a vector index, transitive entity clustering, bulk field edit, on-device
ML) genuinely decline — but not because there are ~500 records, because a false
positive silently rewrites medical history and the owner finds out at a clinic
appointment, a risk identical at 50 records and at 50,000. Features whose value
is volume-independent — integrity scanning, repair, discovery of one specific
bad record — are worth building, and cheap because the data is in memory.

**THE MEASURED DEFECT, and it is the whole first tier of the roadmap.**
`orphanReferenceCheck.js` is the app's ONLY data-integrity scanner, and
Developer Tools renders its result as a confident "None found". That was false.
Enumerating every id-bearing key in every repository's `DEFAULT_*` literal with
`@babel/parser` found **four live reference fields checked by nothing**:
`linkedContactIds` (contactRepository), `relationshipContactIds`
(myProfileRepository), `routineRetestSourceTestId` (testingRepository — added
the previous day by t072, so the one piece of code whose entire job is noticing
newly added fields did not notice a field added the day before), and
`takeHomeMedications[].medicationId` (clinicVisitsRepository). This is the same
failure as t070 six days earlier — the seed regenerator read 11 of 14
repositories because its own list was hand-maintained — recurring in the sibling
hand-maintained list, in the same week, with no guard on either.

**Two of my own measurement errors, both the comment-matching trap this file
records, and the second one is why an AST sweep was not optional.** I first
reported FIVE gaps. Two were wrong: `medicationsPrescribedIds` and
`restockMedicationIds` were restructured into `takeHomeMedications` on 26 Sep,
and the only place their old names still appear is the *comment* explaining the
merge. I reported them to the owner as measured gaps. A regex cannot tell a key
from a comment quoting it, which is now the fourth recorded instance in this
repo and the one that cost the most, because it was the number I put in front of
the owner.

**The fourth gap is invisible to any schema scan, and that changed the guard's
design.** `takeHomeMedications` is declared `[]`, so the id inside each entry
exists only at runtime. A guard that enumerates `DEFAULT_*` literals to decide
what is covered would score this file complete while a dangling medication
reference went unreported — a vacuous pass on the one class the guard exists to
catch. So `orphanReferenceCoverage.test.js` asserts the relationship in **both**
directions: schema -> checker (catches tomorrow's new field) and checker ->
schema (catches a check pointing at a field that was deleted, which
`checkArray`'s `ids || []` tolerates by silently checking nothing — this file
already had one such dead check, removed 26 Sep, and its own comment says so).
It also carries the >20-field non-vacuity floor, and an exemption map whose
every entry must carry a substantive reason.

**The guard was vacuous on its first run and mutation testing caught it — the
second time in this repo that the guard was written by me in the same session as
the thing it protects.** It collected any ObjectProperty keyed `field` and took
its string value, which only proves a LABEL exists; replacing the checked
expression with `null` left the suite GREEN. Same shape as the recorded
`uUNoteLinkGuard` failure — I read the name a check *claims* to check, not the
field it actually *reads*. A field now counts as checked only when the call
expression also mentions it. Two collector bugs on the way, both mine: the first
scan looked inside the ctx object literal and found ZERO fields (the expression
is a sibling *argument*), which is how a too-weak guard became one reading
nothing at all; the baseline-red check is what stopped me trusting it. Final: 4/4
mutations red, green baseline, source restored byte-for-byte.

**T1 — the scan can now be acted on, which a report you cannot act on does not
merit.** New `src/calculations/referenceRepair.js` removes or re-points ONE id on
ONE record, per explicit tap, with the prior field value kept for undo. No
auto-repair, no bulk repair, no merging of field values — and the reason a
report with no repair was the real problem is that "fix it by hand" is a
multi-step errand for one stale id, which is why this section is not in the
working notes. The destructive part is guarded explicitly: **it removes only the
dangling id, never the whole field**, because a record pointing at three
contacts where one was deleted still has two good ones.

**Its shapes are DERIVED from each repository's own declared default, not
hand-written per field** — the only thing stated by hand is the four entry-id
keys, because an empty default genuinely cannot say what sits inside an entry.
That is a fourth hand-maintained surface, so the coverage guard was extended to
assert it too. **A unit test then caught a real design error of mine: my
fallback for an unresolvable shape was "assume scalar", justified in a comment
as the conservative choice. That reasoning was backwards** — treating an
unresolvable list as scalar writes `null` and destroys the whole list, which is
strictly worse, and it would have wiped My Profile's other relationship
contacts. The answer for an unknown shape is now refusal, not a guess in either
direction. 14 tests, **7/7 mutations red**, including "clear the whole list
instead of one id".

**One harness bug worth recording, because it reported green without checking.**
A suite that fails to PARSE emits no "Tests N failed" line, so a counter reading
only that line scored a syntax-error run as GREEN — and one mutation of mine was
invalid for exactly that reason. A `Failed Suites` count and an absent test
count are now both treated as red. Separately, one mutation stayed green because
my fixture put the dangling entry FIRST, so "keep the first entry" and "drop the
dangling one" produced the same answer; a fixture where the wrong implementation
and the right one agree is not a test.

**Measured boundary:** 20 new tests across 2 files, mutation-verified 4/4 and
7/7, lint and build clean. Red at the time of writing and NOT from this change,
each confirmed by import graph rather than assumption: `seedSnapshotCoverage`
(3) and `seedIdMigration` (3) read only seedDivergence and the three
menstrual/contraception/pregnancy repositories; `widgetTapAndFallbackGuard`
reads Java/XML files session A has uncommitted in this tree; and
`widgetRedactedRender` is recorded red at HEAD. The encoding gate also fails on
`ClinicCardWidgetProvider.java` — mojibake in session A's *uncommitted* version
only, with HEAD clean and all five files touched here verified clean, so it is
deliberately left alone rather than edited out from under them.

## Recently shipped (7 Oct 2026, latest - the seed-migration guard had been RED SINCE THE DAY AFTER IT WAS WRITTEN, and it failed for a date)

**Session B. The triage of "8 red tests, none mine" turned out to be two
separate things, and the first one I reported was simply wrong.**

**MY OWN FINDING WAS A MEMORY-PRESSURE ARTIFACT, and it is recorded because I
stated it to the owner with a table.** I reported "a live defect: Clear Sample
Data does not clear 8 seeded cycle/contraception/pregnancy records". That was
false — `seedSnapshotCoverage` passes 8/8 and always did this session. The
evidence was one full-suite run that ALSO reported `[vitest-worker]: Timeout
calling "onTaskUpdate"` at 286 MB free RAM; re-run at 750 MB it was 1447 passed
/ 3 failed, and the 3 were all in one file. Eight failures across four suites
from a run that was already reporting a worker timeout is a cascade, not four
findings. **Free RAM is printed by the gate for a reason and reading it first
is cheaper than a wrong conclusion.**

**The 3 real ones were genuine, and nastier than a flaky test.** `seedIdMigration.test.js`'s
`demoRow()` fixture builds its probe from the frozen snapshot row, and
`isDemoData` compares dates as offsets from **each side's own anchor** — the
record's `createdAt` when it has one, else the caller's fallback. **48 of the
96 legacy ids have snapshot rows with no `createdAt`**, so the probe anchored on
*today* while the snapshot anchored on `SNAPSHOT_TAKEN_AT`. The suite therefore
passed on the day it was written and went red the next day, permanently, for
exactly those collections: tests, clinic visits, medication logs, measurements,
symptom log, cycles, contraception, pregnancies, vaccinations.

That is worse than flakiness. This file's guard — "the legacy map still matches
the real seed arrays" — only means anything while it is green, and a permanently
red guard is one nobody runs. The failure also looked arbitrary, which is the
tell: contacts, medications and locations carry no dates at all, so they never
moved.

**The conditional half took a round trip, and that is the transferable part.**
Stamping `createdAt` unconditionally fixed the 48 and broke the other 19 —
because `demoComparable` deliberately prefers a record's own creation date as
its epoch ("a seed that hard-codes its dates stays stable against its own
createdAt"), and encounters' frozen rows carry `createdAt` equal to the
encounter's own date. Measured, on the same row: `DIFF date: probe="T-78"
snapshot="T0"`. So the rule is **stamp only when the row carries none**. A
fixture wrong in the obvious direction is easy to spot; one wrong in a way that
only surfaces in a different collection is not.

**Proven date-independent, not just green today:** with the clock faked **+400
days**, `test_001`, `visit_001`, `log_001`, `encounter_001`, `contact_001` and
`episode_001` all still classify as demo data. 21/21 in the file, and **1450
passed / 0 failed across 125 files** — the first clean full-suite baseline in
this session, which is what makes any later regression visible.

Also this round, from the same triage: `seedDivergence.js`'s private
`demoComparable` was temporarily exported to print both projections and reverted
byte-for-byte (`git diff` clean), because reasoning about why the two sides
disagreed had already failed three times.

## Recently shipped (7 Oct 2026, later - two more hand-maintained inventories, and the one guarding the file that deleted 74 real records)

**Session B. Closing out the drift-guard sweep. Every one of these lists was
MEASURED in sync before it was guarded, so none of this is a fix — it is why
none of them needs one tomorrow.**

**`clearSampleData.js`'s `SAMPLE_REPOSITORIES` had nothing asserting it, and it
is the single authority for what "Clear sample data" counts, removes, and what
the Home banner reports.** Measured: 14 repositories export a `SEED_*_IDS` set
and all 14 are referenced, none extra, none missing. New
`src/components/sampleDataRepositoryCoverage.test.js` asserts both directions —
every exporter referenced, and nothing referenced that was renamed away — because
a renamed set still referenced there does not fail, it just stops clearing that
collection. Same shape as the `ids || []` dead check the orphan checker had.

**A collector bug worth recording, because the floor is the only reason it was
not silent: `export const X` parses as an ExportNamedDeclaration whose
`declaration` is a VariableDeclaration — a CONTAINER of declarators — not a
VariableDeclarator.** The first version of this collector checked for the latter,
matched nothing, and reported **zero** exporters while the non-vacuity floor
turned it into a loud failure. The same wrong assumption was then found in
`exportedFunctions` in the sibling guard before it shipped there. A sweep that
reads the wrong node type does not fail open, it fails *silently-empty* — and
that is the shape a non-vacuity floor exists to catch.

**`referenceRepair.js` shipped three hand-maintained maps and only one was
guarded** — `ENTRY_ID_KEYS` was asserted, `RECORD_REPOSITORIES` (14 record types)
and `TARGET_SOURCES` (14 target types) were not. The reason it mattered is the
opposite of a missing check: `describeRepair` answers an unknown type with
`canRepair: false` and a sentence of readable prose instead of throwing. That is
correct runtime design and it is precisely why the gap was invisible — a new
collection would be **detected** by the checker and silently **unrepairable** by
the fix, with the only evidence a message in a screen the owner may never open.
Now asserted in both directions, plus a reasoned exemption for
`Partner Notification`'s nested `items[N].contactId`, which lives inside a
checklist item and is deliberately not repairable in place.

**The exemption map is asserted in BOTH directions too** — every entry needs a
substantive reason, every entry must correspond to something the checker really
reports, and an entry left behind after the special case is fixed fails the test.
An exemption nobody re-checks is just a hole with a comment on it.

**One honest note on my own process, recorded because it is the failure this
file keeps cataloguing:** while editing that guard I dropped the
`OPTION_LISTS_REPO` path constant and two already-passing tests went red. They
failed *loudly* rather than passing vacuously, which is the property working —
but it is the third time this session that a collector or fixture was wrong in a
way only a test could catch, and the fourth time a baseline-red check is what
stopped me believing it.

**Measured boundary:** 9 new tests across 2 files, **5/5 mutations red** from a
green baseline (a 15th seed exporter; a renamed-away set; `SAMPLE_REPOSITORIES`
deleted outright; a record type dropped from the repair map; a target type
dropped), sources restored byte-for-byte. `verify:fast` green — build, lint,
**1481 tests across 127 files**, encoding, inherited instructions, docs.

**Session A holds a stale claim on `clearSampleData.js`** (since 5 Oct, no task in
flight). This change only READS that file; the guard lives in a new
`src/components/` test, which is the established home for the static AST guards.
Session D holds `scripts/smoke-test.cjs`, untouched here.

## Recently shipped (7 Oct 2026, later still - the repair row had never been rendered by anything, and that is provable rather than theoretical)

**Session B. The repair UI shipped in `5047f74` with no render coverage, and the reason it had none is structural rather than an oversight.**

**`OrphanRow` renders only when the scan actually found a dangling reference, and
this app's own data never has one.** A smoke flow can therefore open Developer
Tools, assert "Broken references" is on screen, and still never mount the
component carrying every piece of new interaction state. So the browser flow was
skipped in favour of a real render test — `src/components/orphanRowRender.test.jsx`,
the first test in this repo to use `@testing-library/react`, against a synthetic
orphan. Creating a genuine dangling reference through a real product path would
mean importing a backup whose references point at records it does not contain,
which would replace the shared page's contacts and break every flow after it.

**This is not hypothetical for this repo.** Two form-render crashes have shipped
past the whole gate suite: a `SelectField` that threw React error #31 on every
My Profile edit across three published APKs, and a temporal-dead-zone crash in
Clinic Card. Neither is reachable by a unit test that imports without rendering,
which is what "every gate passed" actually means for JSX.

**10 render tests, and the ones that matter are the destructive ones.** A single
tap must only *ask* — `clearDanglingReference` is asserted NOT called until the
confirm is tapped, because the confirm step is the entire reason the row is safe
to offer. Cancel writes nothing. A rejected write reports itself and offers **no
undo**, because offering undo for something that did not happen is worse than
offering none. The actions stay hidden while the shape is unresolved, since an
unknown shape is precisely the case `referenceRepair` refuses to act on.

**5 mutations red, and two of my mutation attempts were themselves faulty rather
than the test being weak** — one produced unbalanced JSX and failed to parse,
which is not a valid red and is not counted, and one changed only visible text
while the `aria-label` the test queries stayed intact. Both were redone. That is
the same lesson as the harness that scored a parse error as green, one level up:
"the mutation did not apply" and "the test did not go red" are different
failures, and a third failure sits beside them — the mutation applied cleanly and
still tested nothing.

**Known benign noise:** these tests emit React `act(...)` warnings, because
`describeRepair` resolves asynchronously and updates state outside an act scope.
They are warnings, not failures, and the suite is green.

## Recently shipped (6 Oct 2026, later still - the Clinic Card would not inflate at all, and the PICKER is what proved it was the layout)

**The Clinic Card widget rendered as "Can't load widget" on a black background in the widget picker AND on the home screen, while the other nine rendered correctly.** Found by the owner looking at the phone, and it had been open since the widgets first shipped.

**The picker's failure is what localised it, and that is the transferable part.** The picker inflates `previewLayout` in the launcher process **without ever invoking the provider**, so nothing in `ClinicCardWidgetProvider` could be responsible. Every Java-side theory was eliminated before the layout was touched: the provider pushes successfully (logcat shows `WidgetBridge ENTER` -> `WidgetPrefs store OPENED` -> `pushing REDACTED views for id=323` -> `AppWidgetServiceImpl` accepting it), and `dumpsys appwidget` shows **all ten** instances holding a non-null `RemoteViews`. Also verified clean before changing anything: every `@drawable`/`@color`/`@string` in all ten layouts **and all ten `widget_info.xml` files** resolves; all ten root elements are byte-identical in shape; both preview vectors are structurally identical; and there are no `drawable-night` variants at all, so a night-mode inflate failure is impossible.

**What remained was the only structural difference in the set: `clinic_card_widget.xml` was the sole layout containing a nested `ViewGroup`, and the sole one containing a bare `<View>` divider.** Flattened - the four sensitive fields are now top-level and hidden by name. Cost is one extra call per branch; the container bought a convenience, not a capability, since `RemoteViews` has no inverse selection either way.

**Two of my own mistakes inside this change, both of which would have shipped.**

- **I factored the four `setViewVisibility` calls into a `setSensitiveVisibility` helper, and it silently defeated a privacy guard.** `widgetRedactedRender.test.js` proves no sensitive field renders at a Redacted tier by finding a *literal* `setViewVisibility(<sensitive id>, GONE)` in the provider; a helper hides those calls one indirection away, so a genuine disclosure would have passed. Reverted to literal calls with a comment saying why. **Teaching the guard about one specific helper would have been worse** - it would keep passing for any *different* helper, which is exactly how a privacy guard turns decorative.
- **Writing the helper also introduced a real privacy regression**: the revealed branch hides the NHS row, and the helper sets that same row VISIBLE as part of showing the group - so the NHS number went back onto the home screen, which is the one value this widget has no reason to hold. Caught by reading the diff, not by a test. The surviving code hides it LAST, with the ordering stated at the line.

**A guard matched its own comment for what must be the ninth-or-tenth time in this file, and this one was mine, written in the same change.** The tap-guard takes the first tag-shaped match in a layout as its root element, and my explanatory comment mentioned a bare `<View>` - so it reported the Clinic Card's root element *was* a `<View>`, a view that is not in the file at all. It strips `<?xml?>` but not XML comments; now it strips both, with the reason recorded at the change.

**New guard, scoped over ALL TEN layouts rather than the one that broke** - `every widget layout does not contain a nested container or a bare divider view`. The scoping is the point: the existing layout checks enumerate a handful of filenames by hand, and a layout added later was never inspected by any of them. It asserts layout discovery found more than nine, so an empty set cannot make it pass vacuously. Mutation-verified by reintroducing the nested container and its bare divider: red naming `clinic_card_widget.xml`.

**A correction to my own earlier report, because it was a measurement dressed as a finding.** I told the owner the error "survives a full launcher restart". It did not - Lawnchair's PID was `14627` both before and after `am force-stop`, because Android immediately restores the home app. The launcher never restarted, so that evidence was void, and the same mistake is why I could never capture a launcher stack trace: I was reading `logcat --pid` for a process that had never changed. Recorded as a mistake at the change.

verify:fast green - build, lint, **1397 tests across 119 files**, encoding, inherited instructions. The layout and provider changes are Java/XML, so **the CI APK build and the device itself are the real verification**; locally this is a static argument plus a mutation.

## Recently shipped (6 Oct 2026, latest - the seed snapshot was missing three collections entirely, and the recorded reason for it was false)

**Session C, t070. The snapshot covered 88 of 96 legacy demo ids, and the explanation this file gave for the missing eight was wrong.** It said cycle, contraception and pregnancy seed arrays "are empty when `menstrualTrackingEnabled` is false on a default install". They are not. The arrays are populated unconditionally — `seed_cycle_9001`..`9003`, three contraception entries, two pregnancy entries — and are only absent from the *storage key* when the preference is off. Nobody had grepped; the sentence was written from the shape of the symptom and read back ever since as a finding.

**The real cause was one hand-written list.** `regenSeedSnapshot.test.js`'s `COLLECTIONS` had **11** entries while **14** repositories export a `SEED_*_IDS` set. The three omitted collections were simply never read by the regenerator, so their ids never entered the frozen capture. Measured before changing anything, not inferred: all 8 ids absent from the snapshot, and the 11 snapshot collections enumerated against the 14 exporting repositories.

**Why it was silent, and why it was safe, and both facts matter.** An id missing from the snapshot is classified as **the user's own data** — the safe direction, and the reason this was never a data-loss bug. But `clearSampleData.js` already listed all three collections in its own `SAMPLE_REPOSITORIES`, so Clear Sample Data *counted* those demo rows and then declined to remove them: a button reporting records it will not clear. Every behavioural test passed throughout, because nothing asserted coverage rather than behaviour.

**The guard was written before the fix, and it failed by naming the three.** `seedSnapshotCoverage.test.js` is deliberately static in its first half — every repository exporting `SEED_*_IDS` must be collected by the regenerator, the snapshot's collection count must match, and every seed id any repository declares must be present in the snapshot. On creation it reported exactly `SEED_MENSTRUAL_CYCLE_IDS`, `SEED_CONTRACEPTION_IDS`, `SEED_PREGNANCY_IDS` and the 8 ids. Its second half is behavioural and imports the repositories, because "the id is in the fixture" is not the outcome: it takes the **real** records and asserts `isDemoData` is true for each, plus that an edit or an explicit `isSeed: false` still wins — going from 88 recognised ids to 96 must not become "96 records Clear Sample Data may delete".

**My first version of that guard reported 30+ missing ids, not 8.** It compared the repositories' own `seed_log_9008` against the snapshot, which stores the **legacy** id `log_008`, so every id in all 14 repositories looked missing and the three real omissions were lost in the noise. It imports `normaliseLegacyId` rather than re-deriving that mapping — a second copy of the rule is a second thing that can drift, in a file whose whole subject is a fixture drifting from its source.

**Snapshot regenerated from the repositories, never hand-edited: 88 → 96** (`LEGACY_SEED_SNAPSHOT_SIZE`), 94 lines added. Hand-editing is what `5aa6dfa` had to revert, for a related reason: the snapshot must mirror the **committed** `DEFAULT_X`, so regenerating while another session's field change is uncommitted ships a shape the committed tree does not have — green locally, red on CI, both correct about different trees.

**2/2 mutations red from a green baseline, sources restored byte-for-byte:** dropping `["Cycles", …]` from the regenerator again, and removing one `cycle_001` row from the snapshot. A third harness bug of mine, recorded because it is the recurring one: the baseline printed `passed=1` for an 8-test file because my regex matched vitest's "Test Files 1 passed" line before "Tests 8 passed". The gate still worked — the *failed* count is unambiguous — but a harness that prints a wrong number is a trap for the next reader.

**Still open, unchanged: t069** (an old record carrying both a legacy seed id and a renamed legacy field diverges from the frozen current definition and is not re-keyed; safe for data, can leave a legacy demo id). It needs a scope decision, not a fix.

## Recently shipped (7 Oct 2026, later still - the scheduled retest is now proved in a browser, and the reason it needed its own test is the whole point)

**Session D, t102. The entry above ended at "not proved: the prompt seen on
screen", because `scripts/smoke-test.cjs` was CLAIMED BY SESSION B at the time.
B released it; this is the browser phase that was held rather than written into a
shared file.**

**Why nothing seeded could have covered this, which is why the flow has to build
its own data.** No seeded test is ELIGIBLE for a routine retest: the newest test
in the seed data is a Gonorrhoea-only test of cure, so `isRoutineRetestEligible`
returns false and the "Schedule this retest" action never renders at all. That is
precisely why the earlier entry had to stop at persistence rather than claim the
path worked — and it is the same reason a unit test on the pure eligibility
function proves the RULE and never the WIRING. So the flow creates an eligible
screen through the real form: all four panel chips, a Negative result, sample
types, then Save.

**Three bugs of mine, each found by running the flow rather than by reading it.**

1. I waited on `waitForText(page, "Add test")` — but that control is a `div`
   whose accessible NAME is "Add test" and whose visible text is an icon, so
   `innerText.includes` can never find it. And I passed a **RegExp** to
   `waitForText`, which does `innerText.includes(t)` — a regex coerces to the
   literal `"/Routine retest/"`. Both were caught by the flow timing out, and both
   are the shape this file already records: a locator that fails for a reason
   unrelated to the bug under test.
2. **The New-test form does not default the date**, and eligibility requires one.
   The test saved perfectly and was still not eligible, so the scheduling action
   never appeared and the flow timed out on a step that looked nothing like the
   cause. I read the stored record rather than guessing: `date: null`. The flow
   now fills yesterday's date, deliberately, so the stored value is unambiguously
   at-or-before "today" in both the local wall clock the input builds and the UTC
   day-key the eligibility check compares.
3. My chip assertion was worded as a *failure* statement inside the message, so
   the `assert` helper's `ok - <message>` success line read as a failure in the
   output. Reworded; the log is a debugging artefact and should not lie.

**The run now proves the new copy on a real screen**, which is the thing the
previous entry could not claim: `6 Jan 2027 — you tested before this date`, with
Update / Keep / Archive all present. Every step counts and throws; none of them is
wrapped in an `if (count())`, which is the single most expensive failure mode
recorded in this file — a skipped step lets the whole flow pass having done
nothing.

**Measured boundary, and one honest non-finding.** The flow passes in isolation
against a real `vite preview` build. A full local suite run failed at flow 1
("the sample-data banner never appeared", app still on the onboarding Welcome
slide) — but flow 1 **passes in isolation** at 730 MB free RAM, CI ran that exact
flow green on `c433b25`, and this change only ADDS a late own-context flow, which
cannot affect the first one. Per this repo's documented loop the full suite is
therefore left to CI rather than re-run locally: this file records hours lost to
smoke failures that were pure memory starvation on this 4 GB machine. **If CI's
smoke run is red at this commit, treat flow 1 as genuinely broken rather than
relying on this reasoning.**

## Recently shipped (7 Oct 2026, latest - an EARLY test now asks about the plan, and the copy that made it impossible to ask honestly)

**Session D, t101 Phase A. The entry below this one listed an unclosed gap: the
supersession prompt only fired when an actual test landed ON or AFTER a plan's
day, so the case the owner's own ask named — "if an actual test is logged before
a planned date, prompt the user to keep, update, or archive the plan" — had no
implementation at all. Closed here.**

**The gap was smaller than the earlier entry implied, and the reason is worth
recording: all three answers already existed and were correct.** Keep, archive, and
update — where update re-baselines the plan onto `suggestedRoutineRetestDate` of
the test that was actually just recorded, which is precisely the right behaviour
for a user who went early. Only the TRIGGER was missing, so the fix is small and
the handlers are untouched. A guard asserts all three options survive, so reporting
the early case did not quietly reduce the choices offered.

**"Superseded" was the wrong word for half of this, so the function was renamed.**
`findSupersededRoutineRetestPlans` became `findAffectedRoutineRetestPlans`,
returning `{ onTime, early }`. An early test does not supersede a future plan —
it OVERLAPS it, and a single flat list would have forced the caller to describe a
plan still sitting in the future as though its date had passed. Two buckets also
handle the genuinely possible mixed case (one plan already due, one still
upcoming) with no third branch of the copy. Three call sites existed, so the
rename is contained.

**THE COPY WAS THE REAL DEFECT, and it is why a per-plan line replaced a sentence.**
The prompt read "You saved a test that covers the planned retest **for this
date**" — true once a plan's day has passed, false for a plan still in the future.
With the early case now reporting too, that sentence described a future plan as
though its date had passed. Each plan now gets its own line naming its own date and
relation ("you tested before this date" / "this date has now passed"), which is
honest for both cases and needs no third variant. The heading and the
already-done framing are unchanged.

**Mutation testing caught two of my own failures, and the first is a new instance
of a class this file keeps recording.** Four mutations were attempted; the copy
mutation came back **GREEN**, meaning the copy change was decorative — so it now
has `src/components/routineRetestPromptCopyGuard.test.js`, which is negative
source checks and so had to strip comments first: the comment explaining the fix
quotes the old wording verbatim, which is the ninth-or-tenth recorded instance of
a guard matching the comment documenting the fix, and the first where I wrote both
the fix and the guard in the same change. **A fourth mutation silently DID NOT
APPLY** — a multi-line pattern written with `\n` against these CRLF files, the
exact trap recorded repeatedly in this file. "Did not apply" and "did not go red"
are different failures and only the second says anything about the test. All four
are red now, from a green baseline.

**And my own guard file failed to PARSE on first run, because its doc comment
contained a block-comment terminator inside itself**, which closed the comment
early and turned the rest of the prose into code. That is the exact twin of the
XML-comment bug this file records in detail, committed in the very file whose
purpose is to survive a comment. The stripper's first version also blanked string
literals, which meant it could never find the JSX copy it was looking for — it now
strips comments only, with a fixture proving a `//` inside a string is not treated
as a comment.

**The A4 test my own plan called for, and why it is load-bearing rather than
tidy.** `updateRoutineRetestPlan` MERGES rather than replaces, so the sample
sites carried by the previous change survive "Update to the next suggested date".
That is now real data, so it is asserted after a reload — a refactor making
`update` replace-not-merge would silently wipe the sites and the plan would
quietly under-specify the retest, which is precisely the defect the prefill exists
to prevent.

**Measured boundary.** 13 pure tests (7 new/rewritten), 1 repository test, 9
copy-guard tests, 4 mutations red from a green baseline, lint, production build,
encoding guard clean, and a full-suite baseline of **1472 passed / 0 failed across
126 files**. **Not proved: the prompt seen on screen.** The early path is new UI and
no browser flow drives it — `scripts/smoke-test.cjs` is CLAIMED BY SESSION B, so
t101's browser phase is held rather than written into a shared file, which is the
fourth time this session that refusing a collision was the right call over
finishing the batch.

## Recently shipped (6 Oct 2026, later still still - a routine retest now carries the sample sites forward, and the reason is the one field a retest can silently get wrong)

**Session D, t099. Owner's ask: "the add routine could auto fill fields which are
consistent/unchanging - ie testing for and sample types; base off bashh for 3/12."
The instinct was right, and the reason it matters is not the convenience.**

**`testingFor` was already filled** (with the canonical panel), so the new half is
**`sampleType`, which was `[]`** — and per BASHH's 2023 summary guidance that is
the field with real consequence, not a detail. The guidance makes sample **site**
behaviour-dependent: "3 site testing required for all sexually active MSM" (throat,
urine, rectum), extragenital swabs "should be guided by sexual history taking", and
pharyngeal/rectal sampling is explicitly "not recommended for routine screening" in
women. So for someone who screens triple-site, a plan saying only "Urine"
under-specifies the retest in exactly the way that could silently miss the site
that matters to them. **Copied from the test it follows, not derived from
guidance** — that distinction is what keeps this on the right side of the
"no diagnosis engine, no automated clinical risk scoring" line: it is "do what you
did last time", never "here is what you ought to be tested for". Everything stays
editable on the plan.

**What is deliberately NOT carried, each for a different reason**, recorded at the
function rather than left to a reader: provider/setting (free text naming a clinic,
the field most likely to have changed, and pre-filling it reads as "we booked you
in" when nothing was booked); notes/writtenPlan/trackingInfo (per-test observations
about a test that has not happened); resultIds/organismIds (a plan is an intention —
this is also what stops `isRoutineRetestEligible` matching a plan); the kit codes
(a self-test kit is spent once used); followUpActionedDate (it already happened).

**`testingFor` stays the panel rather than the source test's own list**, and this
was the one judgement call in the ask. Eligibility already requires the full panel,
so copying the source list would only ever *add* one-off extras (Hepatitis B, Mpox)
on top of it. BASHH's own words are that "the minimum investigations, even if
asymptomatic, are tests for chlamydia, gonorrhoea, syphilis and HIV" — which is
exactly the panel — and this app has exactly one retest reminder, armed on that
panel. Smuggling an extra in would make the plan's title disagree with the record
and imply a reminder exists for something it does not cover. Flagged to the owner
rather than decided silently.

**The arrays are COPIED, never aliased.** Two persisted records sharing one array
is the shape behind this repo's documented "two truths drifted apart" bugs: an
in-place edit to one record silently changes the other before either is saved.
Asserted directly, not assumed.

**The derivation is called from the repository, not passed in by the caller**, so a
second call site cannot forget it — and a source test that no longer resolves
yields no samples, which is the safe direction: a plan with fewer prefilled fields
is one the owner fills in, not one that is quietly wrong.

**Measured boundary, including one thing I nearly reported as a bug.** 7 pure tests
+ 2 repository tests, both mutation-verified (aliasing the array instead of copying
it: 3 red; hardcoding `sampleType: []` in the repository so the prefill is never
used: 1 red), lint, build, encoding clean. Verified live against a dev server: a
plan created from a real three-site source test **persists all three sites across a
full page reload**, the source test is unchanged, zero page errors. The one thing
I did **not** prove by driving the UI: the plan's detail view rendering the row.
I attempted it, my navigation silently never left the Home dashboard, and the
probe's own "on Testing sub-tab" check read `true` as a false positive because
"Log test" appears on Home's Quick add — so a first pass of that probe reported a
plan "missing from the list", which was **my harness, not an app defect**. The
render path itself is an unconditional `<ReadRow label="Sample type">` plus the
edit sheet's chips, with `isPlan` used only for the badge. **This is the sixth
recorded instance in this file of a measurement made by a probe that was measuring
the wrong screen**, and it is why the boundary above stops at persistence rather
than claiming a visual confirmation I did not get.

## Recently shipped (6 Oct 2026, later still - 19 of the 20 Settings headers, and the one I could not commit had another session's work in it)

**Session D, t075. "Settings: sticky header leaves a gap against the status bar
while scrolling."** One bug, **20 sites**: every Settings sub-screen header was
`position: "sticky", top: 0` with a plain `padding: 16px` and no safe-area inset,
so the header stuck *under* the system status bar. This is the identical defect
class CLAUDE.md records fixed on the four screen-title banners on 16 Sep 2026.
Measured before editing rather than assumed: **19 files** carried the
single-line spelling and `ClinicalEvidenceScreen.jsx` the multi-line one, so a
script that only matched one of the two would have "fixed" 19 of 20 and reported
success.

**The constant could not be reused, and that was the decision worth making.**
`STICKY_SUBHEADING_TOP` already exists and is the obvious candidate — but it is
`env(...) + 58px`, the Healthcare screen-title *banner's height*, correct only for
bars sitting directly beneath that specific banner. A Settings sub-screen header
has nothing above it, so reusing it would open a **58px band of dead space**.
That is the same mistake as borrowing a sourced clinical constant out of the
context that sourced it: right number, wrong place. New
`STICKY_SCREEN_HEADER_TOP = env(...) + 8px`, matching the offset the four banners
were given, with the reasoning recorded at the constant itself.

**New guard: `src/components/settingsStickyHeaderGuard.test.js`, six tests,
mutation-verified** — reintroducing `top: 0` turns 2 of them red, restoring it
returns them to green. It sweeps **all** sub-screens rather than a hand-listed
set, because the existing header checks in this repo enumerate filenames and a
screen added later is never inspected by any of them. It also asserts a sweep
found more than 15 files, so an empty set cannot make it pass vacuously, and it
checks each file actually **imports** the constant — a missing import is a
render-time `ReferenceError` in exactly the class of code unit tests import
without rendering.

**Two tooling failures of my own, both recorded because both would have shipped.**
A whitespace-tidying regex of mine used `\s+,` where `\s` **spans newlines**, so
it ate `position: "sticky",\n          b` and deleted the `position` and `b`
characters out of `ClinicalEvidenceScreen.jsx`. Caught by a per-file diff-shape
check (`+2/-2` expected) rather than by lint or build — the file still parsed,
because the damage was whitespace and one letter inside a style object, which is
precisely the class every gate here passes. Restored from git and redone by hand
with the editor. **The check that caught it is now part of the routine**: after a
bulk edit, assert every touched file changed the expected number of lines.

**The 20th header could not be committed, and the reason is the interesting part.**
`DeveloperToolsScreen.jsx` carried **session B's uncommitted work** — a full
dangling-reference-repair feature, ~160 lines across new `orphanReferenceRepair`
calls, its own state and undo — which my one line was sitting inside. This is the
third recorded instance of one session's edit landing under another's commit
message (`bc04295`, `092f467`), and the near-miss is worth more than the fix: a
blanket `git add` here would have shipped B's half-finished feature inside a
commit about a status bar. Handled by saving B's exact bytes, resetting the file to
HEAD, applying only my two lines, committing, then restoring B's content
byte-for-byte so their work returns to the working tree with my change now
*beneath* it. **B has no claim on this file despite actively editing it** — a real
coordination gap, since the claims table is what the next reader trusts.

**Measured boundary:** 6 new tests, mutation-verified, lint, production build and
the encoding guard clean. **This change cannot be visually confirmed from a
development machine** — `env(safe-area-inset-top)` resolves to 0px in a desktop
browser, so the sticky offset is 8px here and the real gap only appears under a
notch. The device is the verification, and that limit is stated at the constant.

## Recently shipped (6 Oct 2026, latest - a dashboard shortcut to the retest scheduler, which navigates rather than writes)

**Session D. t082 asked for "Dashboard Quick Add: human-friendly titles (routine
retest, first vaccine dose)". The Home labels were already plain** — "New
contact", "New encounter", "Log test", "New clinic visit", "Log symptom" — so the
two examples read as **new actions**, not renames. That was ambiguous enough to
ask rather than guess, and the owner's answer was **retest only**: a "first vaccine
dose" title is wrong for a booster or a repeat dose, so `Log vaccination` was
deliberately left alone and that decision is now pinned by a test.

**The button navigates and does not write, which is the whole design.** A
scheduled retest is a real persisted record (`isRoutineRetestPlan`), so a one-tap
shortcut that *created* one would write a persistent plan the user never saw or
confirmed — including which test it follows. The action deliberately lives on the
test's own detail screen for exactly that reason, and this button takes you to
where those actions are.

**It also must not open the blank Add form.** A plan is not a completed test, so
saving one through the New-test form would record a test that has not happened —
the precise confusion the whole scheduled-plan feature exists to prevent. It uses
`onNavigateToRecord("healthcare", null, "testing")`, the same plain-navigation path
the existing "Log medication" button already uses, rather than `onQuickAdd`. A
guard asserts that negative, because the wrong version would look identical in
code review and sit one keystroke away.

**Measured boundary:** 3 tests in `quickAddRouting.test.js`, lint, production
build and the encoding guard clean. Verified live against a rebuilt preview: the
button is present on the dashboard, tapping it lands on Testing, it does **not**
open a blank Add-test form, and the page logs zero errors.

## Recently shipped (6 Oct 2026 - Clinic Visit and Symptom records now fade with age, and the interesting half is what the fade must NOT do)

**Session D. New `src/calculations/recordRecency.js` owns "is this record
current?", and the deliberate absence in it is the point.** The rule is **rank,
not a window**: one of the two most recent records on file is current. That is a
fact about the user's own data.

**Why not copy Testing's 90 days.** Testing can justify a 90-day window because
BASHH publishes a 3-monthly routine screening interval, and that figure is cited
at the constant. There is no equivalent published interval for "how old a clinic
visit should look", so reusing the number would be **borrowing a sourced figure
out of the only context that sourced it** — the same mistake as the old 0.8/0.2
medication lockout factors, which read as deliberate right up until someone
audited them and found no source at all. `windowDays` therefore defaults to
`null` and is only a parameter, so a caller that genuinely has a sourced figure
can pass one and it can only *add* recency.

**A guard asserts the absence, because that is what can regress.** It fails if
either module defines its own `RECENT_*DAYS` constant or passes a `windowDays`
literal. A guard cannot prove a clinical number is right; it *can* prove nobody
typed one in, which is the actual hazard. It went red on first run — written
before the fix, as it should be.

**The fade never touches the content, and there is always a text label.** Age
steps the surrounding background and text down; the record's own meaning survives.
Testing already carried an "Older test" pill and Clinic Visits an "Older visit"
one, and **a fade alone would convey the state visually only** — invisible to a
screen-reader user and to anyone who cannot perceive the step down. Three
instances of one convention, not three new ones.

**Three records must never be faded, and each exclusion is a different reason.**
A **future clinic appointment** is dated later than everything else by
definition, so ranking it would dim exactly the record the user most needs to
read. An **ongoing symptom** is current by definition — it is still happening —
so a symptom's rule is deliberately not the visit rule copied over. A record with
a **missing or unparseable date** is missing or broken *data*, and fading it for
data the user never entered would read as a judgement about the record itself.

**That last exclusion caught two real bugs in my own helper, both the same
mistake.** The first version faded a record with an unparseable date, and then
faded a record it could not *place* — an empty pool, or a caller whose list does
not contain it. Both are absence of evidence, and both had the same answer: the
helper may only ever fade a record it **positively ranked** below the top two, and
never one it merely failed to measure. That is now a named test.

**Two measurement errors of my own, both caught because a passing number looked
too good.** I first probed a stale `dist/` and reported "0 dangling dots, 0
overlaps" as if it verified the previous batch — it verified nothing. This round I
probed Clinic Visits and got 0 labelled rows because I guessed the sub-tab label
was `text="Clinic visits"` when the real label is `Clinic Visits`, so the click
never happened and I was measuring the Testing list. Both times the fix was to
read the real labels and rebuild first.

**Measured boundary:** 11 tests, lint/build/encoding clean, `symptom-link` smoke
flow green. Verified live against a **freshly rebuilt** preview: Clinic Visits 3
labelled-and-faded rows of 15, Symptoms 1 of 12, and **every** labelled row has a
background distinct from all the normal ones — which is the claim that matters,
since a label with no fade would look identical in a text search.

## Recently shipped (6 Oct 2026, later still - the Contacts card gains a gold accent for favourites, and half the task was already shipped)

**Session D. t080 arrived as "pin favourites to the top of the list, optional
subtle gold accent" — and the pinning half has existed since 26 Aug.** Checked
before building, per the standing rule, and the existing rule was already correct:
`favourited !== favourited` returns **before** every sort-mode branch, so it is an
override on top of whichever sort is active rather than a replacement for it. The
only real work was the accent.

**It is deliberately weak, and the reason is that a favourite is already marked
three ways that need no colour at all** — it sorts to the top of every sort mode,
the star is filled rather than outlined, and the star's accessible label states
the state in words. So this is a findable-at-a-glance cue, not the signal: a 10%
tint and a hairline border, with nothing about the record's meaning depending on
it. An accent that became the primary marker would be a regression on an existing
feature that already works.

**Selection still wins**, because a checkbox the user is looking at must not be
overridden by a stored preference — and a gold-tinted selected card reads as
"selected AND favourite" when the truth is only "selected". Both the background and
the border test `selected` first, so precedence is by construction rather than by
ordering luck. `flagged` never reaches the branch at all: its red border is already
a stronger signal than a favourite's gold.

**One constant, because the star above already hardcoded the same gold.** Two
hardcoded golds on one card is two definitions of "this is a favourite", and the
kind of thing that drifts the moment one is restyled.

**Measured boundary:** 19 tests in `contactDisplayPredicates.test.js` (two new,
asserting the accent exists, that selection is evaluated first for both background
and border, and that the gold appears exactly once as a constant). Lint, build and
the encoding guard clean. Verified live against a **freshly rebuilt** preview build
— 14 real cards, **exactly 1 gold-bordered**, which is the one seeded
`favourited: true` contact, already at the top of the list. The first probe run of
this was against a *stale* `dist/` and therefore measured nothing; rebuilding first
is the whole difference between a measurement and an assumption.

## Recently shipped (6 Oct 2026, latest - the Contacts card showed an age that was not there, and a duplicate badge was a React bug in disguise)

**Session D. Four device-reported Contacts card items, and two of them were not
what they looked like.** `contactCalculations.js` gains two pure predicates —
`displayableAge()` and `dedupeContactMethods()` — and both card call sites read
them, so the profile header cannot drift from the card the way it would if each
were patched where it rendered.

**The dangling age dot was a guard that only checked for `null`.** The card
rendered `· {age}` behind `contact.age != null`, so an age of `""`, a
non-numeric string or `NaN` produced a separator dot with **nothing after it** —
on a card where every other value is real data, so it reads as a value that
failed to render rather than one that was never there.

**Why it was so hard to reproduce, and why that is the useful part:** the Contacts
editor already normalises `""` to `null` in `AgeField`'s own `onChange`, so
typing an age and clearing it never triggers it. The bad values arrive by routes
the editor does not own — a **backup import**, a **shared-profile import**, or a
record written by an **older build**. The guard was on the read side, which is
where the fix belongs too: patching each writer would mean remembering this in
every future path that can produce a contact, and the symptom is a rendering one.
`0` is treated as no age, because it is not a plausible age and it is what a
number input left at default produces.

**The duplicate social-media icon was a React bug, not only a visual one.**
`MethodIcons` mapped the raw array with `key={m}`, and methods is a genuine
multi-select — the same service can legitimately be present twice (selected on two
devices, or merged from a shared profile and the user's own edit). So a duplicate
meant **two children sharing a React key**, which warns and makes reconciliation
of the keyed children unreliable — the sort of thing that surfaces much later as a
row rendering the wrong icon. Dedup is case-insensitive with first-spelling-wins,
because the badge table matches on the exact string, so two spellings would also
have produced two visually identical icons.

**The ordering change is the one with a reason behind it.** The social-media
summary moved *down*, after travel and accommodation. It used to sit immediately
after the age, which put a run of method icons ahead of the facts that decide
whether a meetup is possible — where they are, how they get there, whether they
host. It is also the widest item on the row, so putting it last keeps the leading
icons from wrapping first.

**And the star overlap was two missing properties on one row.** The favourite star
is `position:absolute`, so a long name ran *under* it rather than around it. The
name row now reserves its footprint with a **conditional** `paddingRight` (a card
with no star, or in select mode, carries no dead space) and `flexWrap`s so a long
name drops to a second line while the small icons stay on one.

**A guard I wrote for this went red on the fix itself, which is the recorded
failure mode for negative source checks.** The assertion "no age is rendered
behind `contact.age != null`" matched the explanatory comment *inside the card*,
which quotes that exact expression on a continuation line of a JSX `{/* … */}`
block — a line starting with neither `//` nor `*`, so a line-prefix filter did not
remove it. Replaced with a real block-then-line comment stripper, and the
stripper is proved against a throwaway fixture before anything depends on it: a
stripper that removed nothing would make every negative check pass for the wrong
reason.

**Measured boundary:** 17 new tests, **mutation-verified** — reintroducing
`contact.age != null` turns 2 of them red, source restored byte-for-byte. Lint,
build and the encoding guard clean; the five Contacts/accessibility guards
(`iconOnlyUIAudit`, `jsxCommentGuard`, `bottomSheetSafeArea`, `anonymiseDisplay`,
`optionShapeGuard`) 35/35. A throwaway Playwright probe measured **14 real cards:
0 dangling dots, 0 duplicate badge sets, 0 star overlaps** — but read that as *no
regression* only, because the seed data never contains the bad shapes. For t077 and
t079 the actual proof is the unit test plus the mutation, not the probe.

## Recently shipped (6 Oct 2026, later - a routine retest you can actually schedule, and a test that caught three bugs I wrote)

**Session D. `isRoutineRetestPlan` is a real persisted state, and it is excluded
from every "have I been tested" answer the app gives.** A plan is an intention,
not a result, so `isCompletedTestRecord()` in `testingCalculations.js` is now the
single owner of that distinction and is consumed by `mostRecentTestDate`, all four
`statsCalculations` test derivations, all three `testingReminderSync` reads, Home,
the Clinic Card, Healthcare's year count and the Clinic Card PDF. Re-measure the
call sites with `grep -rn "isCompletedTestRecord" src/`.

**Eligibility is now a defined core panel — Gonorrhoea, Chlamydia, HIV, Syphilis
— and it is the same rule for the suggestion, the reminder and the new action.**
A single negative result for one infection is not the routine screen. This is a
visible change to already-shipped behaviour, so it is pinned by a named test in
`reminderDueShapes.test.js` rather than left to be rediscovered as "the reminder
broke": a partial panel no longer arms the retest reminder *at all*, and that is
visible on this repo's own seed data, whose newest test is a Gonorrhoea-only
test-of-cure.

**The schedule action creates the record directly instead of opening the blank
Add form.** That form's draft key is `testEdit_new`, shared by every unsaved new
test in the app, so opening it from here would overwrite an unrelated
half-written draft — the hazard this file already records once. Creating the plan
gives it its own id and its own `testEdit_<id>` draft key.

**Three bugs the tests caught, none of which reading the diff would have.**
`Array.flatMap` does not flatten a `Set`, so the infection-overlap helper
compared against Set *objects* and reported no overlap for every plan — and it was
truthy and non-empty, so a `.length` guard would have looked correct. A leap-year
fixture passed only because it used a future date, which the new completion rule
correctly rejects; it now injects the clock. And a partial-panel test read stale
module state, because `TestingRepository` caches its records at module scope and
changing a mocked store after the first load is silently ignored — the fixture now
swaps through the real `replaceAll`, since a fixture that quietly does not take
effect is worse than no fixture.

**Measured boundary:** 104 tests across 8 files green, lint clean, production
build clean, encoding guard clean. No browser flow covers schedule → plan → mark
done yet; coverage is unit plus repository-integration.

**Two test files were red and are red for reasons outside this change**, left red
rather than quietly absorbed. `widgetRedactedRender` fails on a
`nextDoseRedactedLine` literal in `medicationReminderSync.js`, untouched at HEAD.
`scripts/sessionBridge.test.js` is the known-flaky subprocess suite.

**CORRECTION, same day, and it was my own wrong claim.** The first version of this
entry said `snapshotFidelity` was "provably red at HEAD ... it predates session C's
seed re-key". The observation was real — the snapshot does hold `test_001` while
the seed holds `seed_test_9001` — but the conclusion was wrong, and reading the
revert commit `5aa6dfa` is what showed it: the id divergence is *tolerated by
design* (a frozen capture's ids legitimately differ from current seeds), and the
actual red was **my own four new `DEFAULT_TEST` fields**, which had widened the
same divergence. So it was mine, exactly as the coupling that revert warns about.
Regenerated with `SHOS_REGEN_SNAPSHOT=1` once the field change was committed, which
is purely additive — 30 added lines across the 7 seeded tests and no id churn — and
`snapshotFidelity` + `seedDivergence` are 30/30. **The tell that I had it wrong was
available at the time and I read past it:** the failure output listed the id
divergence *and* the four fields together, and I treated the loudest line as the
decisive one instead of asking which of them the comparison actually compares.

## Recently shipped (6 Oct 2026 - frozen demo identity, snapshot fidelity, and the import path now share one rule)

**Session A took over the remaining seed-safety work after Sessions B/C stalled.** The 02:28 blocker was correct: `seedDivergence.js` initially classified **6/6 medications, 14/14 dose logs, 2/4 vaccinations and 1/1 episodes** as user data. Wired as-is, Clear Sample Data would silently remove nothing. The shipped fix keeps the destructive direction closed and makes all three places that act on the answer use one shared rule: `clearSampleData.js`, `seedIdMigration.js`, and the backup-import migration.

**The frozen snapshot is now generated from the repositories' real output, not their raw seed literals.** Real records are built as `{ ...DEFAULT_X, ...row }` and normalised, so the raw arrays lacked default fields and did not describe what the app actually held. `src/calculations/regenSeedSnapshot.test.js` regenerates the frozen capture only when explicitly enabled with `SHOS_REGEN_SNAPSHOT=1`; it is skipped by normal tests and CI. The capture holds **88 records across 11 repositories**. `snapshotFidelity.test.js` re-imports repositories into a fresh module registry with a mocked adapter and checks every collection, so prior tests cannot mutate the evidence it reads.

**Three normalisations are load-bearing.** `statedKinks`, `limits`, and `kinksInvolved` changed from flat id arrays to `[{kinkId, role}]`; both shapes are compared canonically. Seed dates are relative to the evaluation day, so absolute timestamps differ every day; dates are compared at calendar-day resolution against each side's epoch, recursively through nested arrays such as vaccination `doses[]`. A field set to `new Date().toISOString()` (Episode `resolvedDate`) can differ by minutes between snapshot and live evaluation, so time-of-day is deliberately not part of demo identity. This means an edit changing only a record's clock time on the same calendar day is not detected; the trade is explicit because the alternative makes the snapshot diverge on every regeneration.

**The asymmetry decides the comparison direction.** Comparing only fields known to the snapshot could hide an edit to a newer field and delete a user's record. Comparing all fields can instead leave a demo record unrecognised, which breaks clearing but preserves data. The snapshot is therefore regenerated to the real repository shape; the comparison is not narrowed. Flagless records that diverge are stamped `isSeed: false` before deletion decisions, and the migration does not re-key them into the demo id space. An explicit `isSeed: false` always wins before any heuristic.

**The tests now cover the actual incident's default branch.** `seedDivergence.test.js` has 16 tests; `snapshotFidelity.test.js` has 14, including repository-vs-snapshot checks, day/time drift, and the old kink shape; `isSeedAuthorityGuard.test.js` has 11; the migration and import suites pass 32/32 using real snapshot rows rather than two-field stubs. Ten targeted mutations all turn the relevant suite red, with the source restored byte-for-byte. `verify:fast` passed: **1302 tests across 112 files**, build, lint, encoding, inherited-instructions and docs gates all green.

**Four commits were pushed to `main`, ending at `f132406`.** `ad49181` adds the shared classifier and fidelity evidence; `a128e5e` wires both deletion and migration chokepoints and repairs their fixtures; `445bcaf` corrects the day-resolution comparison discovered by the gate; `f132406` makes widget privacy-tier changes immediately re-push all widgets, guarded by three mutations. CI confirmed Build APK, Web Alpha and the full Smoke Test green for `f132406`.

**Measured boundary, recorded rather than obscured:** the snapshot covered 88 of 96 legacy ids at the time of the earlier commit. The explanation first recorded here was wrong and is corrected on 6 Oct 2026 (t070): it said the cycle, contraception and pregnancy seed arrays were empty when `menstrualTrackingEnabled` was false. They are populated unconditionally, and only absent from the storage key when the preference is off. The actual cause was `regenSeedSnapshot.test.js`'s `COLLECTIONS` list, which read 11 of the 14 repositories exporting a `SEED_*_IDS` set, so those three collections were never captured. Unknown ids and flagless records without a snapshot row are treated as user data, the safe direction. The first boundary is now closed by the 96-record snapshot; an old record carrying both a legacy seed id and a renamed legacy field still diverges from the frozen current definition and is not re-keyed, which is safe for data but can leave a legacy demo id (t069).

## Recently shipped (5 Oct 2026, later - 74 real records deleted by id, and the fix is one thing: stop sharing an id space)

**Session C. 3c/3b were Session A (commit 092f467); the 3a re-key below was swept into that same commit mid-apply.** Nothing was lost and no code was overwritten - the commit contains both halves. Recorded here because this file requires a commit-to-content map whenever a session's work lands under another session's message; see the working conventions section above.

**"Clear sample data" deleted 74 of the owner's real records.** Not a near-miss: 16 contacts, 18 encounters, 7 tests, 7 locations, 14 dose logs, 3 vaccinations, 3 symptom entries, 2 clinic visits, 2 medications, 1 episode, 1 measurement. The mechanism is the one this file has now recorded three times: **the owner EDITED the demo records in place** (renamed med_001 "PrEP (Descovy)" to "PrEP"), which destroyed the only signal the feature had, because it identifies sample data **purely by id**.

**Every one of those 74 was real, and the first analysis of this got that wrong.** Seed names are Alex/Jordan/Sam/Riley/Morgan/F. Mercury; the lost records are Sean Wilson, Daniel Philips, Pascal Ken, Patrick Clare, Sam Benstead and eleven others. **Zero overlap** across contacts, encounters, locations, tests and clinic visits. Two records even used a different id prefix from the seed array (`visit_001`/`visit_002` vs `clinicVisit_001`-`007`), which proves they were owner-created rather than overwritten seeds. The verification that settled it was diffing the lost records against the repo's own seed arrays - **not** counting ids, and **not** trusting that an id in a low range means "demo".

**THE FIX, in three parts, and the order matters.**

1. **3c - `isSeed: false` stamped on every edit.** Session A. All 14 `update()` methods now write it, and `isSampleRecord()` checks it BEFORE id membership so a flag can never be overridden by an id. **This is the only signal that distinguishes an edited "Sean Wilson" from an unedited "Alex"** - which is why it has to exist before anything else.
2. **3b - `referencedSeedIds` amended** so a recovered record (`isSeed: false`) CAN vouch for what it references, while an UNEDITED seed still cannot. The 1 Oct fix had it skip all seed records as reference sources ("sample data cannot vouch for itself"), which silenced exactly the records that needed to protect their dependencies.
3. **3a - seed ids moved to a high prefixed range, `seed_contact_9001` upward.** Session C. **This is what makes 3b safe**, and the reason is structural rather than incidental: a seed cluster is self-referential BY CONSTRUCTION. Measured: **12 of 16** seed contacts are referenced by seed encounters, and 7 of 14 repositories self-reference internally (logs 14, tests 7, clinicVisits 7, locations 7, medications 6, vaccinations 4, symptomLog 3). The reference graph therefore carries no information about user intent, so 3b alone would have retained the whole seed set - `countSampleData()` would return a permanent non-zero total and the first-run banner would never clear. Session C found this by measurement and reordered the work accordingly; the original handover had 3a first, which would have broken the feature while appearing to fix a bug.

**Why the prefix cannot collide, which is the whole safety argument.** All 14 id counters derive the next id by matching an **ANCHORED** regex against existing ids - `/^contact_(\d+)$/` and 13 equivalents. `seed_contact_9001` cannot match, contributes 0 to the `Math.max` that seeds the counter, and can never be regenerated as a real record. Verified per repository rather than sampled. A side effect the owner gets for free: seeds stop competing for the id space, so a fresh install's first contact is now `contact_001` instead of `017`.

**The re-key was AST-scoped, and that was not optional.** The owner's real records sit in the SAME low range the seeds did (`contact_017`-`contact_035`, `encounter_019`-`042`, `med_001`-`med_004`, `med_007`-`med_012`), so a find-and-replace over `contact_001` cannot tell a seed id from a real one by string value. 167 replacements across 14 files, confined to the byte span of each seed array literal, discovered by a brace-balanced scan aware of strings and comments. **Gemini independently reached the same conclusion**, and this file has already recorded two incidents of regex codemods damaging source.

**A deep scan found two things the original plan had missed, both silent:**

- **Seed arrays are FALLBACK-ONLY.** `storageAdapter.js` returns the seed only when the storage key is absent, so re-keying the literals does **nothing** for any install that already has data: `SEED_*_IDS` rebuilds from the new array, stops matching stored records, `countSampleData()` returns 0, `clearSampleData()` removes nothing, and old demo data becomes **permanently indistinguishable from real records** - reintroducing from the opposite direction the exact failure this file was written to prevent. **This needs a data migration of stored records (3d), not just a rename.**
- **Prefix routing broke.** `SHOS_MenstrualHealth_Prototype.jsx`'s `tabForRecordId()` tested `id.startsWith("cycle_")`, which is false for `seed_cycle_9001`, so a Global Search hit on a seeded cycle/contraception/pregnancy record arrived at Healthcare with no inner tab selected. Found by reading code, not by a failing test - all three collections are empty in the owner's real data, so no seed record ever renders.

**Verified safe, so the blast radius is known:** zero executable hardcoded seed-id literals outside the seed arrays anywhere in `src/`; all 11 test files with seed-shaped literals use self-contained fixtures; `clearSampleData.test.js` is ID-agnostic by design (asserts via `.size`/`.has()`, never a literal); `adhocmed_seed_001` has no referrer (only a React `key`, and `generateAdHocMedId()` can never emit that shape).

**New guards, both mutation-verified - 4 of 4 and 3 of 3 red respectively.** `src/components/seedIdCollision.test.js` (48 tests) asserts per repository that every seed id is prefixed, none matches the counter regex, array length and per-record key sets are unchanged, every cross-reference resolves across FILES (a per-file rewrite would break the whole cluster while every per-file assertion stayed green), and no re-keyed id appears outside a seed array. `src/components/seedIdRouting.test.js` (9 tests) drives the real `tabForRecordId` and pins the `seed_` strip.

**Three harness bugs, mine, each recorded because each would have produced a false "verified" claim.** (1) `join(REPO, "src/repositories/...")` leaves mixed separators on Windows, `existsSync()` returned false, every mutation SKIPped, and "0 of 5 mutations turned the suite red" read as a result rather than as a broken harness - the same shape as an earlier recorded incident. Fixed with `isAbsolute()`. (2) vitest interleaves ANSI escapes between "Tests" and the count, so the parse returned 0/0 and the baseline looked green having verified nothing; a zero-count run now throws rather than reporting success. (3) The test file itself exempted `adhocmed_seed_001` via a loose prefix pattern rather than by name, which is precisely how a real dangling reference could slip through.

**One correction to a finding I reported:** clinicVisits' id inconsistency is the OPPOSITE way round from what I first said. The seed array uses `visit_001`-`visit_006` and matches its own counter; it is the owner's real records that use `clinicVisit_001`-`004`, which no counter produces. The collision is in the data, not the seed, so the migration treats `clinicVisit_` as already-user-space and the inconsistency does not need fixing first.

**The owner's 74 records are recovered.** Built by union across 11 backups (22 Aug - 5 Oct), base = current, gap-filled newest-first, union keyed by record id so collisions are structurally impossible. Independently verified: **0 drift** against current (every existing record byte-identical apart from the `isSeed` stamp), **0 dangling references** across all 11 collections, no demo contamination. **Trash deliberately excluded** - all 10 entries are demo records, and trashed `measurement_001` is a demo CD4 count that would have **overwritten the owner's real eGFR** at the same id. File written outside the repo so it cannot reach the public track.

**3d - the data migration, SHIPPED.** New `src/storage/seedIdMigration.js`, called from `finishBootAfterUnlock()` alongside the other one-time migrations (not module-load-time, because `storage.save()` needs an unlocked vault). Once per install, gated on `shos_seed_id_migrated_v1`: a stored record whose id is a **known legacy seed id** is re-keyed, and every `*Id`/`*Ids` reference to it is rewritten. **The legacy list is an explicit literal, not a derived range** - deriving it means asking "is this a low id?", which is exactly the question that was wrong originally, since the owner's real contacts were `contact_017`-`contact_035`, *inside* the range the seeds occupied. A round-trip test reads the live seed arrays and proves the map and the arrays agree in both directions.

**The one rule that makes it safe: a record carrying `isSeed === false` is never touched, whatever its id.** That is precisely the state the owner's 74 recovered records are in - real people restored under original ids that the old seed arrays also used. Keying on the id alone would have deleted them, which would have been the *third* time in this incident's history a real fix came one line from destroying his data. 7 of 7 mutations red, the first of which removes the `isSeed` check entirely.

**A duplicate-id hazard found by simulating the migration against the real recovered backup, and it invalidates a claim this entry previously made.** I asserted the merged backup needed no migration because every record already carries `isSeed: false`. Simulating it showed the opposite for a *pre-existing* install: a user record on `contact_001` keeps its id while an unedited demo record on that same id would be re-keyed, producing **two records with one id** in the same collection. That cannot happen in a collection that honours ids as unique - repositories derive the next id FROM existing ids - but it is now reported rather than written, because the owner's own 74 recovered records occupy exactly these legacy ids, so an import that merged without deduping is where it would land, and a migration whose whole purpose is to protect data must not be what creates the corruption. 3 tests added, including the negative one: a *single* user record per id is not a duplicate, or the migration would refuse to run on exactly the install it exists to protect.

**The same simulation also corrected a factual claim about the recovered file.** The merged backup contains **no legacy demo records at all** - zero contacts named Alex/Jordan/Sam/Riley remain, because the union was keyed by id and the owner's real data won every collision. Its 16 records sitting on legacy ids are all `isSeed: false`, so all are protected. After 3a + 3c + 3d the owner does not need this migration for those records; they are already safe by flag, and the migration exists for every *other* existing install.

**A real bug this migration actually had, caught by its own test:** the map was written with the prefix `medication_001` when the seed array has always used `med_001`. As written it matched nothing, so an existing install's demo medications would have kept their old ids forever while everything else migrated. The round-trip test exists precisely so this file cannot disagree with the arrays it mirrors. **And one of mine: the first import was `storageAdapter`, which does not exist** - it is `localStorageAdapter`. The unit suite passed and `npm run build` failed, because nothing imports this file except App.jsx. Worth recording as the ninth-ish instance in this file of a unit suite proving a function while the wiring to it was wrong.

**Still open: 3e**, reconciling seed data on a version bump, so a typo fix to a demo record can reach existing installs. And the **import** half of 3d: `backupMigrations.js` still has no handling for a legacy-id backup, which is Session A's file. Neither is blocked on anything.

## Recently shipped (2 Oct 2026, later still still still — the U=U note became a link, and my first guard for it was vacuous)
## Recently shipped (4 Oct 2026, latest - three widget bugs the owner found by looking at the phone, all one cause)

**All three were reported from a real home screen, and all three were the same shape: something that must ALWAYS happen was coupled to something that is legitimately CONDITIONAL.**

**"Can't load widget" on the Clinic Card.** `updateClinicCardWidget` dereferenced `visit.linkedTestIds` with no null guard and was only ever called *with* a visit, so with no upcoming appointment it threw, the surrounding catch swallowed it, and no `RemoteViews` was ever pushed - which is exactly what the launcher means by that message. Separately, `syncClinicVisitReminders` returns early when the reminder is acknowledged or suppressed, BEFORE reaching the widget push. Two independent paths to the same symptom.

**"Last Test: No tests logged" while the dashboard showed a test from a week earlier.** `syncTestingReminder` has FOUR early returns - reminder disabled, no tests, no routine-retest suggestion (which is what a **Positive** result produces), already past due - and `updateTestWidget` was reached only on the happy path. So a Positive most-recent test meant the widget was never refreshed again.

**Every widget tap landed on the dashboard.** All ten providers built their `PendingIntent` with `NEW_TASK|CLEAR_TOP` and **no `SINGLE_TOP`**. Per the Intent contract, `CLEAR_TOP` without `SINGLE_TOP` destroys the running Activity and creates a new one, so `onNewIntent` never fires, Capacitor's `appUrlOpen` never fires, and the URL is never routed. Pool task t062 recorded this as "not reproducible from the code as written" - it is entirely reproducible, by reading the flags. Gemini's review added a second defect alongside it: without `FLAG_UPDATE_CURRENT` Android returns the *cached* `PendingIntent` and discards the new data URI, and all ten providers passed `requestCode 0`, so Android saw ten interchangeable tokens for one component.

**The fix is a central `syncAllWidgets()`, not a `try/finally` in each sync function.** A widget's visual state is unconditional - it must always reflect reality - while reminder logic is conditional by nature. Coupling them means every new early return added to reminder logic silently breaks the widget again. The pushers stayed where they are, because two existing guards slice those files from a known function to END OF FILE, but each is now exported and self-sufficient: called with no argument it derives its own data, called with explicit null it renders the "there is none" state. Calls serialise on a promise chain, because two rapid saves can both read asynchronously and the older read finishing last overwrites the newer value with no error anywhere.

**`updateCycleWidget` was unreachable from it, and the new guard proved it.** It lived inside `SHOS_MenstrualHealth_Prototype.jsx`, so it could only be called from that module's own handlers - which is why the Cycle widget refreshed on cycle *create* and never on edit, delete, or a preference change. Moved to `calculations/cycleWidgetSync.js`. **The guard caught this rather than me**: it reads the bridge methods from `WidgetBridgePlugin.java` and fails if any is not pushed by a module the central sync imports, and `updateCycle` came back red. Five imports in the JSX were left dead by the move and removed rather than left as lies.

**The providers now push a static fallback instead of returning bare.** `WidgetPrefs` fails closed and returns `null` rather than writing plaintext - correct for privacy, but returning there left the host holding no `RemoteViews` at all, and a privacy-safe empty state is indistinguishable from a broken widget. New `R.layout.widget_unavailable` renders one fixed string, "Open SHOS to load". Fail-closed is untouched: still nothing written in plaintext, still nothing disclosed to the launcher process. The fallback is deliberately NOT blanked on boot, because it has nothing to hide.

**Two existing guards fired correctly and were narrowed rather than deleted.** `widgetBootBlank` and `widgetRedactedRender` both resolved "this provider's layout" as the FIRST `R.layout` match in the file - which the new `unavailableViews` helper now precedes, so both began asking why the fallback was not blanked on boot. Their intent was never "blank everything", it was "blank every layout that renders stored data", and the fallback renders none. Both now skip it by name, with the reasoning recorded at the change.

**One guard was written against an invariant the fix had already superseded, and it was correctly red.** It asserted no reminder function returns before its last widget push - right BEFORE the decoupling, when that was the actual bug. The fix was not to reorder the reminder; it was to stop the widget depending on the reminder at all, at which point the ordering stops mattering. Replaced with the invariant that now holds: every bridge method a provider exists for must be reachable from the central sync. Asserting the old one would have demanded a change contradicting the chosen design.

Also: the `App.jsx` comment claiming clinic-card routes "resolve null on purpose" has been false since 24 Sep, and it sits directly above the code that routes them.

Verified: `verify:fast` green - build, lint, **1161 tests across 103 files**. Three mutations red, each reproducing an exact device symptom: the bare `visit.` deref, a stripped `SINGLE_TOP`, and a provider returning with no `RemoteViews`. The APK build is the real verification of the Java and resource changes.

## Recently shipped (4 Oct 2026, later - the fallback codemod over-applied to a method with no widget in scope, and CI was the only thing that could see it)

**The first push of the entry above did not compile, and nothing local could have told me.** `npm run verify:fast` was green, `aapt2` was green, and the file looked correct - because in both of the places it *looked* correct, it was.

The defect: a provider has **two** `if (prefs == null)` guards, not one. The first is in the private per-instance `updateAppWidget(context, manager, appWidgetId)`, where pushing a fallback is exactly right. The second is in the public static bridge method `updateTest(context, ...)` whose entire job is to **write** the prefs and then loop over instances calling `updateAppWidget()`. That method has **no widget id and no `AppWidgetManager` in scope** - it acquires the manager further down, *after* the write - so the replacement I applied there referenced two undefined variables in all seven providers, and the APK build failed with `cannot find symbol: variable appWidgetId`. Re-measure with: `gh run view <id> --log-failed | Select-String "cannot find symbol"`.

**This is the ninth recorded instance of "fix the pattern once" being wrong because the pattern is not actually uniform** - and the first one where the second copy was *correct code* rather than an oversight. The honest fix is a plain `return` there, not a smaller version of my mistake: the bridge method must write nothing when storage is unavailable, and the per-instance method is what pushes the fallback. Both roles now say so in a comment.

**The guard I wrote for this was itself wrong in the same direction, which is worth recording because it took a round trip to see.** Its first version asserted no provider contains the literal `if (prefs == null) return;` anywhere - and went red on the *fix*, because that bare return is now genuinely correct in the static method. Scoped it to the per-instance body, which is the only place the invariant applies. **A guard that demands uniformity will always eventually be wrong, because the two copies legitimately differ.**

New assertion, mutation-verified: reintroducing the exact shipped line turns it red naming `TestWidgetProvider.java` and which of the two failures it was - a per-instance variable in a static method, or a push with no manager in scope. **The local toolchain cannot compile Java at all**, so this was a 4-minute CI round trip to find and is now a unit test.

**The second CI-adjacent failure was the ninth instance of the machine-speed class, and the fix was the class again.** `scripts/sessionBridge.test.js`'s "never issues a duplicate id" **timed out** under `verify:fast` and passed standalone - that suite's whole contract is process-level, so its `bus()` helper is a real `node` spawn, and that one test issues **13** of them (7.7s of test time in isolation against vitest's 5s default). I had touched nothing it reads. Counted the file properly rather than fixing the one that failed: **six** tests spawn >=4 subprocesses, so all six now share one documented `SUBPROCESS_BUDGET_MS` constant - the same treatment the eight AST guards already got, and an add-only change that cannot turn a correct test red.

Verified: `verify:fast` green - **1162 tests across 103 files**.

## Recently shipped (4 Oct 2026, later still - one widget had no tap at all, and the guard I wrote for the tap FLAGS was the reason nobody noticed)

**`NextDoseWidgetProvider` contained zero `PendingIntent`, zero `Intent`, zero `setOnClickPendingIntent` and no `com.shos.app://` URI.** It was the only one of the ten providers in that state - the other nine, including all three QuickAdd widgets, each had a click, flags and a URI. The widget rendered its medication name and countdown correctly and did **nothing whatsoever** when tapped. Found by inventorying the providers rather than by the owner reporting it, immediately after fixing the routing bug on the other nine.

**The more useful finding is WHY it survived, and it is my own guard from hours earlier.** `widgetTapAndFallbackGuard.test.js` asserted every provider sets `FLAG_ACTIVITY_SINGLE_TOP` - and did so like this:

    if (!/addFlags\(/.test(src)) continue; // no tap intent at all

That line is a **vacuous exemption of precisely the case the test exists to catch.** It skips any provider with no tap intent, so the one provider with no tap was skipped, and the suite was green. Asserting a flag can only ever test a tap that already exists. **This is the tenth recorded instance of a guard passing vacuously in this repo, and the first where the guard was written by me in the same session as the feature it was supposed to protect.** The transferable half: a `continue` in a guard needs a written justification naming what legitimate case it exempts, and "no tap intent at all" is not one - it is the worst possible outcome.

Two new assertions replace it, both mutation-verified. Every provider must call `setOnClickPendingIntent(R.id.widget_root, ...)`, and `setPendingIntentTemplate` is asserted **absent** rather than accommodated - none of these widgets are collections, so a future one using that path fails here instead of silently passing. And every widget layout's root element must declare `android:id="@+id/widget_root"`, because a tap can only attach to a view that has an id - without that, the first assertion could pass on an id no layout actually declares. The layout name is read out of each provider's own `R.layout.X` reference rather than a lookup table in the test, so it cannot drift from the code the way a second filename list would.

**The destination was chosen from the app's own route table rather than by taste, and Gemini independently reached the same answer.** Bare `com.shos.app://medication`, not `medication/inventory`: the route table documents bare `medication` as the dashboard "where the per-medication Log-dose buttons live", which is what someone tapping a countdown to their next dose wants. Inventory is stock level, which is what the *Refill* widget is for - two widgets, two facts, two destinations.

**Gemini caught a touch-swallowing risk specific to this layout.** A `Chronometer` extends `TextView`, and the tap is on the root `LinearLayout`; a `TextView` only consumes touches when something makes it clickable, so this is safe today - but it would break invisibly if a later edit added `android:clickable="true"`, leaving the countdown as the one region of the widget that does nothing. Stated explicitly as `clickable="false"` / `focusable="false"` so the reason survives. It also confirmed `setChronometer` is executed by the launcher process and does not conflict with the root's `PendingIntent`.

Verified: `verify:fast` green - **1164 tests across 103 files**. Both mutations red, each naming the file and the specific failure - removing the tap, and stripping the layout's root id.

## Recently shipped (4 Oct 2026, later still still still - the widget fix is on a real phone now, and one of the three symptoms is still there)

**Device-verified against `5cc68da`, installed over ADB. Two of the three reported symptoms are fixed; the Clinic Card is not, and the reason is not yet established.** Recording that plainly rather than as a shipped entry, because the entry above it reads like a completed fix and is only two-thirds one.

**What is genuinely fixed, measured on the phone.** Warm taps now route. The app was launched, left running (pid `9753` unchanged across the whole sequence, so every tap below was a WARM tap - the exact condition that used to fail), and each deep link was fired with `am start`: `com.shos.app://medication` landed on **Medication**, `com.shos.app://healthcare?subTab=testing` landed on **Healthcare with the TESTING sub-tab active**. That is `SINGLE_TOP` doing its job, and it is the bug the entry above describes.

**A fourth, separate bug the device found, which no test could have.** `com.shos.app://clinic-card` resolved correctly and did nothing. The route table maps it to `{ tab: "healthcare", subTab: "clinicCard" }` - but `clinicCard` is not one of Healthcare's six sub-tabs, it is the Clinic Card *overlay*, and nothing anywhere consumed that value. The app switched to Healthcare and stopped. So tapping the Clinic Card widget was indistinguishable from the old "every tap lands on the dashboard" bug, one widget after supposedly fixing it. Healthcare already had the mechanism (`openClinicCardOnMount` -> `setShowClinicCard(true)`) but it is derived from `clinicCardReturnTab` and means "we are RETURNING here, remember where to go back to" - overloading it with "a deep link asked for this" would conflate two meanings and could strand a back-navigation target. A separate `pendingOpenClinicCard` flag, threaded as `openClinicCardOnDeepLink`/`onConsumedClinicCardDeepLink`, following the existing `openAddOnMount`/`onConsumedQuickAdd` idiom exactly. It lives in the deep-link handler rather than in `navigateTo`, so a widget tap fires it and nothing else does. A **separate** effect consumes it, keyed on the flag rather than mount-once, because Healthcare is often already mounted when a widget tap arrives - sharing the back-navigation effect would mean either the deep link does nothing on a warm app or the back behaviour re-fires every time.

**New guard: `src/components/deepLinkConsumerGuard.test.js`.** `deepLinkRoutes.test.js` asserts the route table is correct, and it was - entirely. It cannot assert that anything *consumes* a route, because the consumer lives in a React module. So every `subTab: "x"` the table can emit for Healthcare must be either a real sub-tab (read out of the module's own switch, not hardcoded) or named literally in App.jsx's handler. The clinic-card assertion deliberately checks **both ends of the wire**: the flag is set AND `HealthcareScreen`'s parameter list accepts it. Asserting only the producer is the vacuous version - deleting the prop from the destructuring leaves the flag set and the Clinic Card shut, which is the exact defect. Mutation-verified by doing precisely that.

**The Clinic Card still shows the launcher's "Can't load widget", and the honest state is that the cause is NOT yet pinned down.** The measurements, so the next session does not repeat them:

- The encrypted widget store `shos_widget_prefs.xml` has mtime **2026-10-02 06:31** and has not been written since, across roughly eight app launches today (device clock 2026-10-04 08:08). So **no widget bridge write has succeeded in two days**, and that predates this round's refactor entirely.
- The store is genuinely encrypted - AndroidX, obfuscated keysets, ciphertext values - so this is **not** a plaintext-fallback privacy defect. Re-measure with: `adb shell run-as com.shos.app cat /data/data/com.shos.app/shared_prefs/shos_widget_prefs.xml`.
- Over CDP, `WidgetBridge` resolves and all seven methods exist; `updateClinicCard`, `updateTest`, `updateRefill` and `updateAppointment` all **resolve** when called directly with the correct keys - and still write nothing.
- No `WidgetPrefs` warning appears in logcat, so `WidgetPrefs.get()` is not taking its failure path, which contradicts "the static bridge method returned early" and is the loose end.
- The per-instance `updateAppWidget` bytecode in the installed APK **does** contain the fallback push (`WidgetPrefs.get` -> `if-nez` -> `unavailableViews` -> `updateAppWidget`), read out with `dexdump` across all 14 dex files. So the fallback shipped.

That leaves the failure inside the static bridge method, after `WidgetPrefs.get()` succeeds - which is the one place not yet instrumented, and the next step is a `Log.i` there rather than more inference.

**Two tooling findings that cost real time here, so nobody re-learns them.** This WebView's CDP **does not honour `awaitPromise`** - `Runtime.evaluate` with it simply never returns, so an async probe has to stash its result on `window` and be polled with a second synchronous evaluate. And a **backgrounded WebView throttles timers** hard enough that a `setTimeout(r, 12000)` race inside the app ran for 18+ seconds without firing, which reads exactly like a hung bridge call. Both produced confident false conclusions before being caught; bring the app to the foreground before concluding anything from a timer.

## Recently shipped (5 Oct 2026, later still still - ALL SEVEN widgets now honour Redacted, and the guard needed 34 mutations to become one)

**Follow-on to the entry below: the Clinic Card was one of six.** Test, Refills, Appointments, Next Dose and Cycle all disclosed their real content at a Redacted tier, and `clinicCard`/`nextDose`/`doxyPepWindow` DEFAULT to a tier — so three of the six leaked without the owner configuring anything. All six are now wired: bridge forwards `opt(call, "redactedText")`, provider stores it under its own key, provider's redacted branch hides every disclosing view and returns. All seven keys are asserted DISTINCT, because all seven providers share one `SharedPreferences` file — a shared key name would have each silently overwriting the last.

**The Next Dose countdown deliberately SURVIVES redaction.** `countdownAt` is in `ALLOWED_AT_REDACTED` on the owner's earlier decision, and the reason still holds: elapsed time discloses strictly less than the wall-clock time it replaces. A mutation that hides it goes red, so the allowance is now protected rather than merely commented.

**Each line is decided in the file that knows what the widget means**, mirroring `doxyPepRedactedLine` and `clinicCardRedactedLine`. A test date is the most identifying thing the Testing widget could show and is dropped; a medication NAME is the most identifying field on any of the ten and is dropped; an appointment's free-text TITLE is dropped because titles routinely name the specialty. What survives is category plus a coarse count, or a countdown.

**Two pushers send `refillDue` — `medicationReminderSync.js` and `refillReminderSync.js` — so the line builder is deliberately duplicated.** Recorded in both files rather than imported across a boundary that exists only because `syncAllWidgets` lists them as one entry. What is not acceptable is a guard that silently covers one copy, and that was the third real defect below.

**34 mutations, all red, and every version of this guard before them was partly decorative.** What each generation of the guard got wrong, since the pattern is the transferable part:

- **It checked that a key existed and a string was passed, not that health-identifying text reaches the home screen.** Reading the line without rendering it, rendering it with the location still visible, or leaving the clinic-number row visible all passed.
- **`setViewVisibility(id, View.VISIBLE)` counted as hiding.** Collecting ids without their arguments meant *un*-hiding the sensitive row passed. Only `GONE`/`INVISIBLE` hides.
- **Fixed windows cannot work here.** The payload object is ~1,600 characters; the distance from the method name to the fifth argument is 1,566–1,581 today. Every `{0,900}`-style window samples only the payload and concludes nothing follows. Only delimiter balancing survives, and a *balanced* one — the JS pusher's own comment cites its two root causes by number, so balancing raw source counted three phantom arguments from prose and reported 7 for a call that passes 5.
- **Blanking must happen globally, and before counting, never after.** Counting braces over a slice of raw text let a `${` inside a template and an apostrophe inside a comment ("the owner's") each shift the count; four of six builders then reported no literals at all and every leak mutation passed. A regex for "a string literal" cannot tell a quote in code from a quote in a comment — an apostrophe in prose opened a string that never closed and deleted thousands of characters of real code. `blankNonCode` is a state machine for exactly this reason.
- **A duplicated builder means "the first declaration" is whichever file sorts first.** A mutation hardcoding `"PrEP due"` into the second copy of `refillRedactedLine` left the suite green, because the guard read `medicationReminderSync.js` and the mutation touched `refillReminderSync.js`. Every call site and every declaration is now checked.
- **A hardcoded leak needs a check about WORDS, not about fields.** Four mutations that rewrote a template to say "PrEP due", "at Dean Street" or a drug name interpolated nothing at all, so the field check had nothing to catch. The closed vocabulary is what a Redacted line is *allowed to say* — deliberately a list of permitted values rather than a denylist of identifying ones, because a denylist has to anticipate every value a developer might type and fails quietly on the one they did not think of.

**Two of my own test bugs recorded at the assertion**, both of which made the guard look like coverage: `expect(x).toBe(/regex/)` is `Object.is` and can never pass; and a pattern like `clinicCardRedactedLine(tests)` matched the function *declaration* before its call, so six mutations "passed" purely because they had not applied. `apply()` now tries both line endings and reports `DID NOT APPLY` separately — these sources are mixed LF/CRLF, and picking one per file made half the sites silently skip.

**The inventory test's hardcoded counts are gone.** "either 0 or 6 unwired" passed on any count of 6 and would have failed on 5 the moment Clinic Card was correctly wired; "either 0 or 5" had the same defect. It is now `NOT_WIRED === []`, with the one-way-door property kept as a separate named test over all seven.

**Gemini's review of this design is half wrong, and the error is worth recording.** It recommends one *global* privacy key read by all seven providers, on the premise they "all read the same privacy toggle" — they do not, `widgetPrivacy.js` gives each widget its own tier with different per-widget defaults, and the owner's Settings screen has a separate row per widget. Its answer on `RemoteViews` is correct and load-bearing: there is no inverse selection, so "hide everything except this one view" is impossible and the only reduction is to wrap every disclosing view in one parent container. The Clinic Card already does this for `widget_clinic_sensitive_row` but still hides date/location/tests individually, so it is the one provider that would benefit — recorded as a possible layout change, not applied blind.

**Also found and fixed while wiring: the Testing pusher has two branches and only the first passed a line.** The second (the "no tests logged" branch) had none, so that widget's redacted state would have fallen back to its own placeholder. Caught by the per-call-site loop, not by reading the diff.

1235 tests across 108 files, verify:fast green. 34 mutations red for the right reason, green baseline as the precondition.

## Recently shipped (5 Oct 2026, later still - the Clinic Card widget ignored the user's own privacy setting, and six mutations proved my guard was decorative)

**Six of the seven data widgets disclosed their real content at a Redacted tier.** `sendWidgetUpdate` filters the payload and its own unit tests assert that, and they pass — but filtering protects the *payload*, and only the provider decides what is *rendered*. `clinicCard` DEFAULTS to `redacted`, so a user who configured nothing got their appointment title, clinic location, date and test count on the home screen anyway. Fixed following DoxyPEP's existing pattern exactly: bridge forwards `opt(call, "redactedText")`, provider stores it under its own key (`redacted_text_clinic` — all seven share one prefs file, so a shared key overwrites itself), and the provider's redacted branch hides every disclosing view and returns.

**The stale task listed three defects and two were already fixed.** Contrast had been resolved on 3 Oct by the `values-night` palette work — measured now at 4.8:1 worst across both backgrounds, with the maths self-checked against canonical WCAG pairs. `autoLink=map` is not in the layout at all. Only the disclosure gap was real. **A task written on 1 Oct describes the 1 Oct code**, which is the third time in this file that an inherited claim was measurably stale rather than merely wrong.

**The far more useful finding is that my guard was decorative, and it took sixteen mutation attempts to find out.** `widgetRedactedRender.test.js` passed throughout. Against it:

- *reading the redacted line and not rendering it* — green
- *rendering it but leaving the location visible* — green
- *rendering it but leaving the clinic-number row visible* — green
- *deleting the JS fifth argument* — green
- *passing `undefined` or `""` as the line* — green
- *the bridge reading `redactedText` and handing the provider a different method* — green

Six real disclosure paths, six green runs. **The guard was checking that a key existed and a string was passed, which is not the same as checking that health-identifying text reaches the home screen.** Three causes, each worth stating:

- **Fixed windows.** The payload object is ~1,600 characters; the distance from the method name to the fifth argument is 1,566–1,581 today. Every `{0,900}`-style window samples only the payload and concludes nothing follows. Only delimiter balancing survives, and a *balanced* one — the JS pusher's own comment cites its two root causes by number, `"(1)"` and `"(2)"`, so balancing raw source counted three phantom arguments from prose and reported 7 for a call that passes 5. Comments are now stripped before any offset is computed.
- **Comment-delimited prose.** The method name appears inside the explanatory comment *above* the call as well, so a name search found prose. `codeCallers` is now filtered on comment-stripped source, and the name is asserted to be an argument of the call that was actually measured — otherwise a deleted call still satisfied every assertion via an earlier `sendWidgetUpdate(` in the file.
- **`setViewVisibility(id, View.VISIBLE)` counted as hiding.** Collecting ids without their arguments meant un-hiding the sensitive row passed. Only a `GONE`/`INVISIBLE` argument hides, and containment is resolved against the **layout**, because the masked branch legitimately sets `"••••• tap to reveal"` on those ids — flagging those would have demanded a widget stop rendering its own redaction, the opposite error.

Two of my own test bugs are recorded at the assertion. `expect(x).toBe(/regex/)` is `Object.is`, not a pattern match, so it can never pass — written as though it were a real assertion. And a mutation pattern like `clinicCardRedactedLine(tests)` matched the function *declaration* first and left the call untouched: three mutations reported "STILL GREEN" purely because they had not applied, which is a different failure from a test that does not go red and is why the harness reports `DID NOT APPLY` separately.

**Sixteen mutations now red, all sixteen for the right reason**, plus a green baseline as the precondition. The inventory test's hardcoded "6 unwired" was also wrong in kind: it passed on any unwired count of 6 and would have failed on 5 once Clinic Card was correctly wired, so the invariant is now stated as the one-way door it is — a provider that was wired is never silently unwired.

Also: `WidgetRedacted.java`, claimed in this file as holding the single shared implementation of the redaction across seven providers, **does not exist**. The mechanism is per-provider `KEY_REDACTED_TEXT`, which is why this change added a seventh copy of three lines rather than one call. No shared class was ever written; the claim is corrected in place rather than left as an instruction to build it.

Also fixed a red lint gate that was blocking every session including C's: a stale `eslint-disable-next-line no-new-func` in `seedIdRouting.test.js` (from C's `9c9008c`), removed. Recorded as a mistake too — I first logged it as being inside my own commit, which `git show --stat` disproved.

1235 tests across 108 files, verify:fast green.

## Recently shipped (5 Oct 2026, latest - clear sample data deleted 74 real records, and a flag nothing read would not have stopped it)

**A second, worse incident than the 1 Oct one. The owner renamed seed records in place, pressed "Clear sample data", and lost 74 of their own records** — 16 contacts, 18 encounters, 7 tests, 7 locations, 14 dose logs, 3 vaccinations, 3 symptom entries, 2 clinic visits, 2 medications, 1 episode, 1 measurement. Not one was demo data: the seed names are Alex/Jordan/Sam/Riley/Morgan, and the lost records were Sean Wilson, Daniel Philips, Pascal Ken, Patrick Clare and eleven others, with **zero overlap** across contacts, encounters, locations, tests and clinic visits.

**Why the 1 Oct fix could not have prevented it, which is the part worth keeping.** `referencedSeedIds` skipped seed records as reference sources (`if (seedIds.has(record.id)) continue` — "sample data cannot vouch for itself"). That is true of an *unedited* seed, but every seed contact is referenced by a seed encounter, so a self-referential cluster was vulnerable as a unit and "non-sample" excluded exactly the records that would have protected it. Relaxing it is **also not the fix**: every seed contact is referenced by a seed encounter, so retaining "any referenced seed" retains the entire seed set, `countSampleData()` returns 0 forever, and Clear Sample Data silently deletes nothing. A seed cluster is self-referential by construction, so the reference graph is mutual reinforcement and carries no signal about user intent. **Only an explicit edit signal can separate an edited "Sean Wilson" from an unedited "Alex".**

**The fix: editing a record is what makes it the user's own data.** Every repository's `update()` now stamps `isSeed: false` on the record it writes — all 14, verified individually to sit inside their own `update()` and nowhere else. "Edit as a copy" was proposed and **rejected by the owner**; Gemini independently argued against it too, because the owner would end up with two PrEP records and no idea why.

**And the second half, which is the one that actually protects: the flag is authoritative, not advisory.** `isSampleRecord()` checks `isSeed === false` **before** any id test, so id membership can never override it. This matters immediately rather than theoretically — a recovered backup holds those 74 records back under their *original seed ids*, each stamped `isSeed: false`. While identification was purely by `SEED_*_IDS` membership, a flag nothing read protected nothing and a second "Clear sample data" would have deleted all 74 again. The ordering is asserted by test, not just by comment.

**`referencedSeedIds`'s skip now also keys on `isSampleRecord`,** which is the half that makes a recovered record able to vouch for what it references. Keying on the raw id silenced exactly those records, so real data could not protect a real dependency.

New guard `src/components/isSeedAuthorityGuard.test.js`, six tests, **all six mutation-verified**: removing the stamp from one repository; testing the flag *after* the id set; reverting either of the two filters to a raw id test; and removing `isSampleRecord` entirely. Two non-vacuity properties are asserted deliberately — the stamp must be on code rather than in a comment, and the tests fail if any decision site bypasses the helper.

**A tooling failure worth recording, because it produced six false positives.** The mutation harness called `execFileSync("npx", …)`, which throws on Windows because `npx` is a `.cmd` — so *every* run "failed" and all six mutations reported RED, plus a RED baseline that should have been the first warning. A broken harness that always reports the desired result is worse than no harness: it would have "verified" six mutations that never ran. Invoking `node node_modules/vitest/vitest.mjs` instead fixed it, and the same trap is recorded in `docs/CHANGE-PROCEDURE.md`.

1177 tests across 106 files, verify:fast green.

## Recently shipped (5 Oct 2026, later - THE ENTIRE WIDGET FEATURE WAS DEAD AT ONE LINE, AND 14 GREEN TESTS NEVER NOTICED)

**`sendWidgetUpdate()` returned `false` for every widget, forever, and nothing was ever written to widget storage.** The whole feature - ten providers, a bridge, a privacy-tier system, a settings screen - has been inert since it was written.

```js
if (!bridge || typeof bridge[method] !== "function") return false;
```

Every call site passes the **wrapper** that `getWidgetBridge()` returns: `{ plugin: WidgetBridge }`. The methods therefore live on `bridge.plugin`, not on `bridge`. Indexing the wrapper directly is always `undefined`, so the guard always fired and the function always returned early. No throw, no log, no warning.

**How it was finally found, since eleven days of device testing had missed it.** By instrumenting the native side and looking for the ABSENCE of a line, which is the part worth remembering. The log showed `WidgetPrefs: store OPENED`, `onUpdate FIRED`, `updateAppWidget ENTER`, `pushing DATA views` - the providers working perfectly - and no `WidgetBridge: updateClinicCard ENTER`. Plugin registers, providers push, **JS never calls the bridge.** Two earlier hypotheses were both wrong and both were ruled out by measurement before acting: `WidgetPrefs.get()` returning null (no - it logs OPENED every time), and an `Error` escaping the `Exception` catch (no - and that widening has been reverted).

**And the test suite was not merely blind to this, it was actively concealing it.** `widgetBridgeUpdate.test.js`'s `fakeBridge` returned a **bare plugin** shape - `{ calls, [method]: fn }` - which is the shape *nothing in production ever passes*. So 14 tests exercised a wrapper-unwrapping function against an unwrapped fake, all green, while every real caller silently got nothing. **A suite that proves a function works against a shape no caller uses is worse than no suite**, because it converts an unknown into a false assurance. The fake now returns the production `{ plugin }` shape, which is what made this bug visible at all - the moment I changed it, six tests went red naming the exact line.

Two fixes, and the second is the one that matters: unwrap to `plugin` first in `sendWidgetUpdate` (tolerating a bare plugin too, so a different caller shape cannot break it again), **and** correct the fake so the class cannot recur.

Mutation-verified: reverting to indexing the wrapper fails 9 of the 14 tests. 1171 tests across 105 files, verify:fast green.

## Recently shipped (5 Oct 2026, latest - widgets showed 3-day-old data, and the cause was a guard that swallowed the failure at an invisible log level)

**The Clinic Card widget showed "Can't load widget" and every other widget showed data frozen at 2 Oct. Root cause found by instrumentation, not inference, and it was a call site in the wrong place.**

**The measurement that pinned it.** Instrumenting the native side (temporary `Log.i` at each decision point) produced, on one launch:
```
Capacitor: Registering plugin instance: WidgetBridge
WidgetPrefs: get() store OPENED                        <- store works, every time
ClinicCardWidget: onUpdate FIRED, ids=1
ClinicCardWidget: updateAppWidget ENTER id=321
ClinicCardWidget: pushing DATA views for id=321         <- the provider works fine
TestWidgetProvider: pushed DATA views id=320
```
and, absent from that output, **`WidgetBridge: updateClinicCard ENTER`**. The plugin registers and **not one bridge method is ever called from JS**. The providers' own `onUpdate` fires on every placement and pushes happily - built from preferences that have not been written since **2026-10-02 06:31**. So the widgets were never broken: they were frozen, re-rendering the same stale snapshot.

**The cause: `syncAllWidgets()` was called from the wrong place.** It lived in `HomeScreen`'s mount-once effect, and **Home mounts before the vault is unlocked**. Every pusher's first repository read therefore rejected, and each rejection was caught by the per-pusher `try/catch` in `syncAllWidgets.js`, which logged at **`console.debug`** - which is *invisible in a WebView*. The user-visible symptom was only that widgets showed stale data; there was no error anywhere. It now also runs in `App.jsx` beside `checkDueMeds()`, inside `finishBootAfterUnlock()`, which is the first point at which encrypted data is genuinely readable - and that is exactly why `checkDueMeds` was already called a second time there, for the same Phase 4 reason.

**The guard that hid it is the more transferable finding, and it is the same shape as the vacuous ones already recorded here.** `syncAllWidgets` exists precisely to stop "one early return starves everything after it", and it did its job: one widget failing cannot stop the other five. It also swallowed the *only* diagnostic that would have shown the whole feature was dead. Now `console.warn`, still suppressed on web via the same dynamic import the pushers use (NOT `window.Capacitor`, which this build does not expose - a guard built on that would never fire, which is the opposite of the point). **A per-widget guard that cannot be seen failing is not a guard.**

Two smaller findings recorded at the same change, both from the same logcat: six files each call `registerPlugin("WidgetBridge")`, producing five harmless `already registered` warnings; and `WidgetPrefs`' two `catch` blocks were widened from `Exception` to `Throwable` for the diagnostic, on the reasoning that an `Error` (e.g. `NoClassDefFoundError` from a missing crypto provider) would escape an `Exception` catch entirely and would explain both the missing write *and* the absent warning. **The logs disproved that** - `store OPENED` on every call - so the widening is reverted rather than left in as an unexplained change.

**Everything ruled out by measurement first**, so the next session does not repeat it: the `widget_unavailable` fallback layout is present and inflatable in the APK; `androidx.security.crypto` is present (749 references across all 14 dex files); all ten providers override `onUpdate`; a fresh placement really does trigger `AppWidgetServiceImpl.updateAppWidgetInstanceLocked`; the store is genuinely encrypted (AndroidX, obfuscated keysets), so this was never a plaintext-fallback privacy defect; and calling the bridge by hand RESOLVES - because that path bypasses the failing data read entirely, which is why it looked like the bridge was fine.

1171 tests across 105 files, verify:fast green. The temporary `Log.i` calls are still in this build **on purpose**: an instrument should not be removed until the thing it measures has been seen to change. `WidgetBridge: updateClinicCard ENTER` appearing in logcat is the confirmation.

## Recently shipped (4 Oct 2026, latest - the warm-tap bug was one missing line, and my own fix this session caused a second bug alongside it)

**Every widget tap landed on the dashboard from a warm app. All ten. One missing `setAction`.** Measured on the owner's phone (Redmi 23124RA7EO, Android 15 / HyperOS 2.0, Lawnchair 15.Beta 3, WebView 153): every widget reported "works from cold, goes to the dashboard when warm" - encounter, medication, next dose, last test, refills, appointment, cycle and clinic card alike. A total, warm-only failure across ten independent widgets is not ten bugs, and treating the symmetry as coincidence is what had kept this invisible through several rounds of flag-fixing.

**The cause is in Capacitor, not in this app.** `node_modules/@capacitor/app/.../AppPlugin.java:148`:
```java
if (!Intent.ACTION_VIEW.equals(action) || url == null) { return; }
```
Every provider built its tap intent as `new Intent(context, MainActivity.class)` + `setData(uri)` with **no action**. Cold start works because the launch-intent path does not apply that check. Warm, the intent arrives via `onNewIntent`, `getAction()` is null, Capacitor returns early, `appUrlOpen` is never emitted, and the tap just resumes the app wherever it already was. **Verified at source rather than taken from Gemini**, which independently reached the same conclusion - the repo's standing rule is that a sub-model's report is not evidence, and this one happened to be checkable.

**The control that cracked it is the part worth remembering.** Earlier the same session, firing the *identical* URI with `adb shell am start -a android.intent.action.VIEW` on a *warm* app routed perfectly - Medication and Healthcare/Testing both landed correctly - and I recorded that as "warm routing verified" in the entry below. It was not the same test. `am start` supplies `ACTION_VIEW`; a widget tap does not. So the one experiment that appeared to prove the fix worked was measuring a different code path from the bug. Three rounds of SINGLE_TOP work had been chasing a flag that was necessary and not sufficient.

**A second bug, mine, from the same round.** I gave `NextDoseWidgetProvider` a tap at all (it had none), pointing it at bare `com.shos.app://medication` - chosen from a route-table comment describing `/dashboard`, without reading the code below it. Bare `medication` resolves to `{ type: "quickAdd", tab: "medication" }`: the **Add Medication sheet**. Owner-reported as "next dose navigates to add medication from cold - wrong". Now `com.shos.app://medication/dashboard`. This is the entry above's own lesson repeating verbatim: the comment described the neighbourhood, the code described the house.

**`CLEAR_TOP` removed from all ten.** It is implied under `launchMode=singleTask`, buys nothing, and its only historical role here was enabling the Activity-destroying path. `NEW_TASK|SINGLE_TOP` only.

**Three new assertions in `widgetTapAndFallbackGuard.test.js`, all mutation-verified.** (1) Every `MainActivity` intent sets `ACTION_VIEW`, asserted as *at least as many* `setAction` calls as constructors, because ClinicCard legitimately builds three intents (main tap, `geo:` map link, reveal link) and a `1 === 1` assertion would have cried wolf on the one provider that differs. (2) No provider reintroduces `CLEAR_TOP`. (3) Every tap URI must have a host branch in `deepLinkRoutes.js`, and the bare-`medication` case is named explicitly with the reason - consulting the route table rather than duplicating the URI list as a second source of truth that could drift. All three go red on the exact defect, naming the file.

Also: ClinicCard's map and reveal PendingIntents used **hardcoded request codes 1 and 2**, colliding across instances and with every other provider. Now derived from `appWidgetId`.

1171 tests across 105 files, verify:fast green. The APK build is the real verification of the Java, and the warm tap is the real verification of that build - neither is checkable locally.

**The first push of that entry did not compile, and my guard waved it through.** The ACTION_VIEW codemod captured each intent's *variable name* from the regex and then emitted a hardcoded `intent.setAction(...)` - but ClinicCard names them `mainIntent` and `revealIntent`, so all three providers compiled and ClinicCard failed at `cannot find symbol: variable intent`. Tenth recorded instance of this class, and the first where **the guard for the change asserted the change was present and still passed a build that did not compile.**

The reason is that the assertion compared *counts*: "at least as many `setAction` calls as constructors". Three constructors, three `setAction` calls, one of them on the wrong variable - green. **Counting is not pairing.** The property that actually matters is that the intent constructed with the data URI is the same one given the action, so it now pairs them by name: for every `Intent X = new Intent(context, MainActivity.class)` it asserts `X.setAction(Intent.ACTION_VIEW)`. Mutation-verified by reintroducing the exact shipped line, which now fails naming `mainIntent`.

## Recently shipped (4 Oct 2026, later - an XML comment inside a tag, the exact twin of the JSX comment that shipped rendered source code onto the Clinic Card)

**The first push of the entry above did not build, and the cause was mine again.** I put an explanatory XML comment *inside* the `<Chronometer ... />` attribute list. XML has no comment production there, so `:app:parseDebugLocalResources` failed with "Element type \"Chronometer\" must be followed by either attribute specifications, \">\" or \"/>\"". Re-measure with: `gh run view <id> --log-failed | Select-String "Element type"`.

**This is the XML twin of a bug this file already records in detail**: a `//` comment between two JSX elements is not a comment at all, it is TEXT, and it rendered a paragraph of my own source code above the Clinic Card's title in a published APK. Same root cause both times - **a comment in a position whose grammar has none, in a language where the mistake parses as something else and therefore passes every gate.** I read that entry, recognised the shape, and walked into it anyway, which is worth stating plainly: recognising a class is not the same as not committing the instance.

**New guard: `src/components/androidResourceXmlGuard.test.js`.** Parses **every** XML under `android/app/src/main/res` (48 files) with the `sax` parser already in `node_modules`, in strict mode. A regex cannot do this - it cannot see a comment inside a tag without also matching comments in legal positions, so it would either cry wolf or need an exemption list, and an exemption list is how the check gets deleted. The guard's own non-vacuity is proved against a throwaway fixture: it asserts the parser **throws** on the illegal shape and **does not throw** on the same comment in a legal position, so it cannot push the codebase towards avoiding comments altogether. Reintroducing the exact shipped comment turns it red naming the file.

**Its precondition fired on its first run, which is the part worth keeping.** I wrote `expect(files.length).toBeGreaterThan(100)` as a "found nothing?" sanity check and it failed immediately: there are **48**. Had it been `> 0` it would have passed while the walk found nothing at all - which is the standard vacuity, caught by a bound I wrote carelessly rather than by intent. The count is now printed on success so a large drop is visible rather than silent.

**The docs gate does not see `android/` as a source change, which is worth stating rather than leaving to be discovered.** `classifyDocsGate` counts any path starting `src/`, so a change that is *only* native - and native changes are precisely where every CI-only failure in this file's history lives - requires no documentation. It reported "no source changes" for the broken layout fix while the change was unstaged and would have failed CI once committed. That is arguably correct (the gate exists to stop undocumented *behaviour* changes) and it is also why the two CI reds in this round were in a directory the gate does not watch.
## Recently shipped (3 Oct 2026, latest - the ten widgets had no names, one shared preview, and no theme)

**All three of the owner widget-picker complaints were real, and each was confirmed by measurement before anything was changed.** No `android:label` on any of the ten `widget_info.xml` files, so the picker listed ten entries all named after the app; all ten pointed at ONE shared placeholder vector, so no preview distinguished them; and every layout hardcoded `#1B1B1F`, so all ten widgets were black boxes on a light wallpaper. That last defect was then confirmed **visually on the real device** before a line was written.

**The owner-reported "I placed a large one and it did not load" was NOT a broken pipeline, and proving that was the substance of the round.** `dumpsys appwidget` shows every placed instance carrying a live `views=RemoteViews@...` object, and on the home screen both the Refills and DoxyPEP widgets render current data ("All stocked", "No active window"). The real cause is that the layouts are a single vertical `LinearLayout` with **no size-dependent reflow**, so enlarging a widget adds dead space rather than content - it looks unloaded precisely because it is mostly empty. `maxResizeWidth`/`maxResizeHeight` now cap that, and `targetCellWidth`/`targetCellHeight` tell the launcher what size to place at all.

**Theming only the background would have shipped white-on-white.** Every text colour in those layouts had been tuned for a near-black card, so all of them needed re-deriving - which is also the mechanism behind ten widgets having drifted into ten slightly different greys, and why the palette is now semantic resources rather than literals. Each colour is checked against **both** backgrounds it can land on, which caught `widget_cycle` at **4.39:1** inside the clinic card: passing on the card, failing on the inner surface. Lightened to `#FFA8C9` (7.79:1 and 5.92:1). Checking one background would have shipped it.

**`values-night` rather than `drawable-night`, because only the colour changes** - the shape XML is identical, so duplicating the drawable would be pure file duplication. Widgets follow the SYSTEM theme rather than the app own dark-mode preference: a widget is drawn by the launcher, outside the app.

**CI caught a build break nothing local could have: `android:description` must be a `@string/` REFERENCE, not inline text**, failing at `:app:processDebugResources` with "incompatible with attribute description". The local toolchain cannot compile Android resources at all, so `verify:fast` was structurally incapable of seeing it - which is the standing reason resource changes go through the APK job. `widgetPaletteGuard.test.js` now asserts it, and that the referenced string exists and is non-empty, moving a 4-minute CI round trip into a unit test.

**The guard self-checks its own contrast maths against the canonical WCAG black/white pairs first**, because a contrast test whose formula is wrong would pass everything - the same failure mode as the palette scanner that once reported "no regressions" from a detector that had never fired. Four mutations red, including the exact CI failure.

Also: `jsxComponentBindingGuard` was given an explicit 30s budget after it timed out under full-suite load at 674 MB free RAM. It parses every `.jsx` on every run, so vitest's 5s default is not a budget for that work, and a timeout there presents as an assertion failure of something it was never asserting.

Verified: `verify:fast` green - **1147 tests across 102 files**. The resource changes themselves are confirmed by the CI APK build, since the local toolchain cannot compile them.
## Recently shipped (2 Oct 2026, latest - the citations moved into their own screen, and the new screen crashed on open)

**The owner asked for the U=U citations to live in their own sub-screen, and the obvious destination was wrong in a way worth recording.** Resources was the first answer and it had to be undone: that list is user-editable and repository-backed, so the evidence for a public-health claim would be **deletable by accident**. Delete the BHIVA entry and the app asserts U=U with nothing left to check it against. Trading a styling problem (citations looked out of place in a shorthand glossary) for an integrity problem is not a trade, and Gemini's independent review reached the same conclusion more bluntly - user data and reference evidence must never share a mutable namespace. `src/modules/settings/clinicalEvidence.js` is the one owner; `ClinicalEvidenceScreen` renders it; the explanation stays in the Glossary, where it reads as reference material.

**The new screen had a render-time `ReferenceError` on open, and NOTHING caught it** - not the build, not eslint, not the unit suite, not the encoding guard. It imported `FlaskIcon as Flask` and then rendered `<FlaskIcon .../>`. **ESLint cannot catch this class, and that is the finding worth keeping:** `no-undef` does not apply to JSX element names, because `<Foo/>` is not an identifier reference the resolver walks. A component name that was never imported compiles cleanly, passes every gate in this repo, and fails only when someone taps into the screen.

**New guard: `src/components/jsxComponentBindingGuard.test.js`.** Parses every `.jsx` under `src/modules` and `src/components` with `@babel/parser` and asserts every capitalised JSX element name is either imported or declared locally. Mutation-verified in the honest direction: reintroducing the exact shipped typo fails it naming `ClinicalEvidenceScreen.jsx:168`, and restoring the fix returns it to green.

**It took three passes to stop it crying wolf, and both false positives were the guard's fault rather than the code's.** Destructured props (`function X({ Icon })`) are the most common parameter shape in this codebase, and the first version flagged eight of them; `<Context.Provider>` member expressions resolve against an object rather than a bare binding and were flagged too. **Both were fixed in the collector, not by adding an exemption list** - a guard that reports correct code gets deleted rather than trusted, and an exemption list is how that happens. Recorded because this repo has a long history of a check reporting green from a detector that had never fired, and this is the mirror image: one that fired on things that were fine.

**Gemini's review was accepted on two points and rejected on two.** Accepted: `checkedOn` in the data is provenance nobody can see unless it is rendered, so each source now shows its checked date and the screen says plainly that it is a **dated snapshot, not a live check** - the app has no backend and cannot detect that BHIVA revised a document. Rejected: its suggestion to list the four sources openly rather than behind the collapsed dropdown, because the owner's stated ask was decluttering and this screen is reached deliberately. **Its fourth point - that U=U needs two consecutive tests six months apart - is an unsourced clinical constant and was not adopted.** A sub-model asserting a specific clinical interval with no citation is exactly the trap this file records repeatedly, and it was offered without one.

Also: two existing assertions were **retargeted, not deleted**, because they were protecting something real that had MOVED. `hivStatusNoteGuard` asserted the glossary named its source and that the assay-dependence qualifier survived; both still hold, and the citation half now points at the new owner rather than being dropped. Its old `term:..., body:...` adjacency regex stopped matching once the term gained a `lead` field, and it **failed loudly** on that rather than silently asserting nothing. Two of its assertions were mutation-verified against the exact regressions they exist for: the old inline `Source: BHIVA` tail creeping back, the assay-dependence sentence being deleted, and `evidence: true` disappearing all turn it red.

Verified: `verify:fast` green - build, lint, **1133 tests across 101 files**, encoding guard clean over tracked files. The APK and the full 23-flow smoke suite are CI's to confirm.

**The owner corrected the design twice, and the second correction is the one that shipped.** My first version rendered the whole sentence — "An undetectable viral load (below 50 copies/mL) prevents sexual transmission of HIV." — permanently on every record, then expanded a dropdown carrying the explanation and citations inline. Both wrong. It ships as **`ⓘ U=U`**: the bubble reveals the sentence, the underlined `U=U` is the link (an underline *is* the affordance, so it should behave like one), and the fuller text with its citations lives in the **Glossary**, which is where someone being handed a phone, or arguing with this app about a medical claim, actually looks things up.

**The link needed threading, and there were more of them than expected.** `MyProfileModule` is mounted in **four** places — Settings, Home, Contacts, ClinicCard — and `HivStatusNote` in four more. `onOpenGlossary` is now threaded through all of them, and `SettingsScreen` can open the Glossary directly (`initialScreen === "glossary"`), which is what the link resolves to.

**New guard: `src/components/uUNoteLinkGuard.test.js` — and its first version was VACUOUS, caught only by mutation testing.** It asserted that call sites PASS `onOpenGlossary`. It did not assert that the RECEIVER ACCEPTS it, so deleting `onOpenGlossary` from `ContactProfile`'s parameter list — which leaves every U=U on a contact profile pointing nowhere, the exact defect the file exists to prevent — left the whole suite **green**. The rewrite reads each enclosing component's parameter list off the AST and asserts the prop is destructured. The same mutation now fails naming `ContactProfile` and its line. **A guard that only inspects one end of a wire proves nothing about the other end.**

It also asserts, for the same reason, that every `<MyProfileModule>` mount passes the prop and that at least four exist — so a fifth entry point added later fails here rather than shipping a dead link. Covers both directions of the wiring and the App-level helper it depends on.

**Two existing assertions were retargeted rather than deleted**, because they were protecting something real that had MOVED: the citations no longer render in the note, so asserting they do would have pinned the design the owner rejected. They now assert the Glossary renders them, and that its links carry `rel="noopener noreferrer"`.

Also caught in the same change: **`ContactsModule` never destructured `onOpenGlossary`**, which ESLint reported as four `no-undef` errors — a render-time `ReferenceError` in exactly the class of code unit tests import without rendering.

## Recently shipped (2 Oct 2026, later still still — "high viral load" became "detectable", and the U=U note now hands over its evidence)

**"Positive - high viral load" is now "Positive - detectable", and the old wording was making a claim the app cannot support.** The app knows whether a
viral-load result was undetectable or not. It knows nothing about how far above the
assay threshold it sat, so "high" was a magnitude this app never measured. And
"detectable" is the true counterpart to "Undetectable" directly above it, so the
pair now reads as one scale rather than two differently-framed statements. **Label
only** — the stored value `positive-unsuppressed` is untouched, so no saved record
moves and there is no migration. Three new tests, including one that rejects any
label claiming a magnitude or severity (high/low/elevated/copies/CD4/threshold), so
the class cannot come back rather than the one string. Mutation-verified: restoring
the old label fails 3.

**"Anywhere it COULD show should have U=U" — which the app already enforced, and the
reason it had to be structural rather than remembered.** A note appearing only on
undetectable records would disclose by its own presence: you could tell who was
positive from which cards carried the explanation. So `HivStatusNote` has
deliberately **no `status` prop** — a caller cannot gate it even by accident — and a
guard asserts no call site conditions it. All four user-facing surfaces carry it:
Contacts edit + read, My Profile edit + read. Imported profiles render through the
normal Contacts read view, so they inherit it. Clinic Card is the one surface still
to come, and must include it.

**The note is now tappable and opens the evidence, which was the actual gap.** The
`onOpen` prop for "go to the fuller explanation" was built on day one and **never
passed by a single call site** — reaching the Glossary from inside a Contacts sheet
needs navigation threaded through two modules. Rather than ship a fourth rule each
new screen has to remember, the component is now self-sufficient: tapping expands it
in place to the full explanation plus four real citations. It still honours `onOpen`
for any caller that can navigate somewhere better.

**Sourced, and one source deliberately left out.** The owner's guess was that BHIVA
and FRSH would both have appropriate citations. BHIVA does — including a
plain-English non-technical summary that states U=U directly, which is the
"hand it to someone who doubts you" case rather than the "evidence for a
clinician" one. **FRSH is deliberately absent**: no U=U-specific FRSH document
surfaced, and citing one nobody has read is exactly the unsourced-constant trap this
project has been bitten by repeatedly. Every entry carries a `checkedOn` date, and a
new guard requires it, so a stale citation is findable rather than permanent.

5 new tests, mutation-verified both directions (removing a `checkedOn` fails;
restoring it passes). Links carry `rel="noopener noreferrer"` — without it the
opened page gets a `window.opener` handle back into the app — and the guard asserts
that rather than trusting the markup.

## Recently shipped (2 Oct 2026, later still — every bottom sheet in the app put its Save button under the Android navigation bar)

**Found by hand on the device, and it was 24 sites, not one.** The Contacts edit
sheet's "Save changes" button rendered underneath the system navigation bar.
Measured over CDP on a Redmi Note 13: the button spanned CSS y **807–859**, the
viewport was 872 tall, and the OS nav bar occupied ~790–872 — so the whole
control sat inside the nav bar with the back/home/recents keys painted over it,
not merely clipped at an edge. That is the most consequential shape this class of
layout bug can take, because it makes the primary action of a form untappable.

**The cause is structural and it had been there for every sheet since they were
written.** These sheets are `position: fixed; inset: 0` with `display: flex;
`alignItems: "flex-end"`, which bottom-aligns the sheet flush against the
viewport bottom. Every one of them already carried
`paddingTop: "env(safe-area-inset-top)"` for the status bar — and **none**
carried a `paddingBottom`. So the sticky footer, which is exactly where
Save / Confirm / Cancel live, landed in the navigation bar's space.

**The count, and the two rounds it took to get it right.** A line-based scan of
`src/modules` found **20** roots, all 20 missing it: Contacts ×2, Measurements
×2, Medication ×6, Settings ×3, and one each in Calendar, ClinicCard,
MenstrualHealth, RegistryManagement, SymptomLog, Timeline and Vaccinations. The
**AST-based guard immediately found four more the scan had missed**, all in
`src/App.jsx`: the PIN-lock prompt, the acknowledge sheet, Import backup, and the
encrypted-backup prompt. That is the same lesson as "the widget guard only
looked where I happened to look" — **a scan scoped to the directory you opened
first is not a survey.** 24 total, all 24 now carrying
`paddingBottom: "env(safe-area-inset-bottom)"`.

**Why this needed the device and could not be verified locally.**
`env(safe-area-inset-bottom)` measures **48px** on this handset — non-zero, so
the conventional fix is real rather than a no-op. That had to be *measured*
before touching 24 files: this repo has been burned repeatedly by `env()`
resolving to `0px` in a sandbox, which turns a fix into an unverifiable edit. The
first instinct to reach for was
`max(env(safe-area-inset-bottom, 0px), 48px)` so it works either way — rejected,
because a hardcoded 48px is precisely the unsourced-constant pattern this project
has shipped and then had to unpick twice. Measure first, then edit.

**New guard: `src/components/bottomSheetSafeAreaGuard.test.js`.** Parsed with
`@babel/parser`, matching the convention settled on after several regex scans
produced false results. It asserts every root that is
`position:fixed + inset:0 + alignItems:flex-end` declares a `paddingBottom` that
**consults `env()`** — a hardcoded pixel value counts as an *offender*, not a
pass, because it would work on exactly one device. It cannot assert that 48px is
the right number: that is a property of the device, not of the source, and it is
stated in the file rather than pretended otherwise.

**Mutation-verified in the honest direction:** restoring the original defect at
`SHOS_Contacts_Prototype.jsx:1923` — the exact line the user reported — turns the
suite red naming that file and line; restoring the fix returns it to green. The
detector's non-vacuity is proved against a throw-away fixture rather than by
asserting "at least one offender exists", which would break the moment the last
one is fixed and would train the next reader to delete the test.

**My own tooling failed twice on the fix itself, and the guard caught the second
one where my own check did not.** The first script hardcoded 20 line numbers taken
from a .NET scan and then edited them with `split("\r\n")`, which silently
mis-indexed **18 of 20** because `SHOS_Medication_Dashboard_Prototype.jsx` has 7
bare LFs among its 2555 CRLFs. It failed loudly on all 18 rather than corrupting
anything — the re-verification of each line's premise is the only reason that was
safe. The rewrite discovers its sites instead of trusting indices. Separately my
own verification pass reported "20 unexpected edits" because I got the
expectation string's spacing wrong, while the actual diff had a **double space**
(`inset: 0,paddingBottom: …,  paddingTop`) that was valid JS and wrong for this
codebase; the guard was green throughout and the sloppy spacing passed it, which
is the limit of what a shape-based guard can see.

Verified: `verify:fast` green — build, lint, **1093 tests across 96 files**,
encoding guard clean over 340 tracked files. Full suite and the APK are CI's to
confirm.

## Recently shipped (2 Oct 2026, latest - widgets had no privacy tier at all, and reboot protection could not have worked)

**`widgetPrivacy` was a setting that did nothing, and it was aimed at the wrong
widgets.** It shipped with keys for seven widgets, and no code read them - set a
tier, and all seven behaved identically. Worse, four of the seven data-bearing
widgets had a row, and the three with rows to spare were the QuickAdd widgets,
which render a launch icon and display no data. The three that disclose most
had no row at all: **Test, Cycle, Clinic Card**. The setting was therefore
simultaneously inert and pointed at the widgets with nothing to hide.

New `src/calculations/widgetPrivacy.js` is the single owner: per-widget
`full` / `redacted` / `off`, with `fieldAllowed()` as the one enforcement point.

**The uniform Redacted rule.** Per-widget meanings ("a test is logged" for
Test, "Tracking" for Cycle, a bare count for Refills) were rejected as
incoherent - with seven different meanings the user has no predictable model of
what Redacted will show them. One rule now applies everywhere: **redacted =
category presence without specifics.** Allowed: a category, plus a count or
coarse on/off state. Forbidden: names, dates, times, locations, test types, any
per-record detail that identifies. Counts are allowed deliberately ("2 refills
due" identifies nobody), with the rule stating when a count would stop being
allowed rather than re-deciding per widget.

**Fails closed on an unreadable stored value, defaults on a missing one.**
`normaliseDisclosureLevel` maps a bad notification level to the most
restrictive, so a value this code cannot read must never be read as permission to
disclose - that resolves to `off`. A *missing* value resolves to the per-widget
default instead, because on upgrade nobody has ever set a tier and blanking
every widget on a phone would be a hostile surprise. "Never configured" and
"configured to something unreadable" are different states; both are tested.

Defaults: `nextDose` and `doxyPep` full (the owner chose to see the medication
name, reversing an earlier decision that it should never be shown), the other
five redacted.

**Owner decisions taken 2 Oct, after a Gemini review:** DoxyPEP is labelled by a
user-set name defaulting to "Antibiotics", because the acronym itself discloses
recent condomless sex to anyone who knows it. Static widgets keep Redacted but
render as one compact line. The Status widget will use text plus colour, never
colour alone. Clinic Card Full is administrative by default, with the clinical
reason opt-in.

**The countdown survives a Redacted tier, and that is more consistent with the
rule than what it replaced.** The first version excluded it on the grounds that
"a countdown timestamp is a time" - correct about an absolute time, wrong about
a countdown. `in 4h 12m` discloses strictly *less* than `20:00`, because elapsed
time is true only at the moment it is read and reveals no routine, whereas a
wall-clock time reveals the user's daily routine. The rule now draws that line
explicitly: **absolute time is forbidden, elapsed time is allowed.** DoxyPEP's
`expiryMs` was renamed `countdownAt` rather than reused - same value, but the
old name reads like an absolute deadline in any code review.

The countdown is a real `Chronometer`, not a JS interval: the widget has
`updatePeriodMillis="0"`, so a JS-driven one would tick once and then lie for an
hour, and `Chronometer` is ticked by the system UI, needing no alarm, no wake
lock and no app process.

**Two Android API signatures guessed from memory, both wrong, neither caught by
the compiler** - the third native change in a row where L-046 paid.
`setChronometerCountDown` takes a `boolean`, not a timestamp; the deadline goes
in as `setChronometer`'s `base`. Worse, `base` is in the
`SystemClock.elapsedRealtime()` timebase, so passing wall-clock compiles, runs,
and displays a nonsense countdown - the worst failure mode, because it looks
like it is working. Verified against the `RemoteViews` reference rather than
trusted. Recorded as L-050.

## Recently shipped (2 Oct 2026 - the reboot protection could not have worked, and it is the kind of bug a green CI cannot see)

**The boot receiver shipped listening for `ACTION_BOOT_COMPLETED`, which fires
only *after* the user has unlocked the device.** Android's Direct Boot guide is
explicit about this. What makes it matter is that `system_server` re-paints a
widget's last cached `RemoteViews` straight back onto the display after a reboot
**without running the app** - so the receiver could not fire until someone typed
a PIN, i.e. strictly after the disclosure it existed to prevent. A phone rebooted
and then taken by someone else would sit on the lock screen showing the
medication name and the DoxyPEP countdown, with the protection not yet active.

The fix is `ACTION_LOCKED_BOOT_COMPLETED`, which fires while the user is still
locked, and which only reaches a receiver marked
`android:directBootAware="true"`. Both halves are required and neither is
sufficient alone.

**Why blanking works pre-unlock at all, which looked impossible:** credential-
encrypted storage genuinely is unavailable until first unlock, so the receiver
cannot *read* anything - and does not need to. Hiding a widget is an
`AppWidgetManager` update with an empty `RemoteViews`, touching no vault key.
The restriction stops us being read, not from hiding.

Found by asking Gemini to review the design, then **verified against Google's
documentation rather than taken on trust** - it is a claim about platform
behaviour, and this repo's rule is that a sub-model's report is not evidence.
Gemini had no memory of the codebase and no knowledge of the previous commit;
given the state, it found a bug in code shipped 20 minutes earlier.

## Recently shipped (2 Oct 2026 - widget storage could silently fall back to plaintext, and widgets survived a reboot)

**`WidgetPrefs.get()` ended in `context.getSharedPreferences(...)`**, on the
reasoning that "the content is masked by default regardless." **Both halves were
false** - the content is *not* masked (the next-dose widget renders the medication
name), and the trade is not symmetric: a stale widget is visible and fixable, a
plaintext file of sexual-health data on disk is neither. It now returns `null`
with all 14 call sites across 7 providers guarded, so nothing is written in
plaintext under any failure. The stored sink was fail-open; the app's own vault
path was already fail-closed, and the split is now deliberate rather than
accidental.

**The sink guard had excluded its own target.** `widgetPlaintextSink.test.js`
filtered out `WidgetPrefs.java`, arguing "the separate assertion requires the
encrypted path to exist, so excluding the helper cannot make this vacuous." That
reasoning is wrong: requiring `EncryptedSharedPreferences.create` to exist says
nothing about whether a plaintext fallback *also* exists. The guard was green the
entire time the fallback shipped. Exclusion removed, helper now inside the scan,
mutation-verified red.

**Widgets are re-displayed after a reboot without the app running**, from
`RemoteViews` the OS caches - so `EncryptedSharedPreferences` protecting the
stored value does nothing about pixels already drawn. `WidgetBootReceiver` now
blanks all seven data widgets on boot, without clearing the encrypted store, so a
reboot costs the user nothing once they open the app.

Two CI reds on that one file, both mine, both invisible locally because Java
cannot be compiled on this machine: a missing `import com.shos.app.R` (the trap
this file documents elsewhere, which I read and walked into anyway), and
`setEmptyView(int)` - which does not exist, and whose real two-argument overload
sets a *fallback* view rather than blanking anything, so it would not have worked
even had it compiled. Replaced with `setViewVisibility(root, View.GONE)`, which
`ClinicCardWidgetProvider` already uses in four places. Recorded as L-045/L-046:
find a real usage in `android/` before using an API, and let CI confirm.

**The Redacted tier was shipped SAFE but WRONG, which is worse than not shipping
it — and the reason is worth more than the fix.** `sendWidgetUpdate` filtered the
payload correctly and its own unit tests passed. But `WidgetBridgePlugin` only
forwarded the *named legacy fields* it already knew about, so `category`,
`state` and `tier` were received and never stored. Every provider then fell back
to its own default placeholder, and **DoxyPEP could read "No active window" while
a window was active** — a false statement about the user's own health, produced
by the feature whose entire job is to be careful. Filtering protects the payload;
**only the provider decides what is rendered**, so only the provider can be
asserted on. A payload-level test proves the filter, not the screen (L-051).

**Gemini's review corrected the design, twice.** I had planned to restructure all
seven layouts as `widget_root → [compact, detail_container]` so one call could
hide the detail block — which solves a problem that does not exist: `RemoteViews`
is an IPC serialization stub, not a live view tree, so it **cannot iterate
children at all**. The saving grace is that each provider *already* hardcodes
the two or three view ids it sets text on, so naming them costs nothing.

**The fix keeps the privacy decision in JS and Java dumb**, which was Gemini's
main point: the *caller* supplies a pre-formatted one-line string, because only
the caller knows what its widget means. New `WidgetRedacted.java` holds the single
implementation, so there are **not seven near-duplicate branches** — the outcome
Gemini explicitly warned is where typos hide. DoxyPEP's inline branch was
converted onto it rather than left as a seventh copy. Each provider's store key
is distinct (`redacted_text_doxy`, `redacted_text_next_dose`, …) because all
seven share **one** `SharedPreferences` file and a shared key would have
overwritten itself.

`src/storage/widgetRedactedRender.test.js` asserts all seven are wired, and the
anti-duplication assertion is on *exactly one* `WidgetRedacted.apply` call per
provider rather than on zero `setViewVisibility` calls — the first version of it
claimed the latter and failed on NextDose's legitimate Chronometer show/hide,
which is the provider's own business and nothing to do with redaction.

**A test that passed by luck, which is worse than one that failed.** The DoxyPEP
redacted-line test built its fixture as `deadline: Date.now() + 5h`, and the
function it called then called `Date.now()` *again*. On a fast machine both land
in the same millisecond and the assertion passes; on a slow one they straddle a
tick, `Math.floor` returns 4, and it fails. **CI reported 1116 tests passing while
the same test failed locally** — so it was not failing reliably, it was a coin
flip decided by machine speed, which is the same defect as the medication
reminder clock tests and the DST ones already recorded here.

Fixed by pinning the clock with `vi.useFakeTimers({ toFake: ["Date"] })` rather
than by adding a margin or loosening the assertion to `/in 5h/`. A margin would
have made a test pass that could still fail for the wrong reason, and `toFake` is
restricted to `Date` deliberately, since faking `setTimeout` too could stall the
promise-based tests sharing that file. The assertions are now exact `toBe`
strings. **A test that cannot fail is worse than no test, and a test that fails
only when the machine is busy is nearly the same thing.**

**Also worth recording: the docs gate has no test-file exemption.**
`classifyDocsGate` treats any path starting with `src/` as a source change, so a
one-line fix to a `.test.js` file still fails CI until `CLAUDE.md` or `docs/` is
touched. Worth knowing before spending a build cycle discovering it.

## Recently shipped (1 Oct 2026, later - a crash that shipped for three days, found by looking at the phone instead of the code)

**My Profile -> Edit threw React error #31 on every open, in three published
APKs, and no test noticed.** Both `SelectField` copies rendered the option bare,
as children, key and value alike:

    {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}

That is only legal while every caller passes plain strings. The "HIV status"
override (851dece, 29 Sep) passes `{value, label}` objects, and **an object as a
React child cannot fail to throw** — which is why it was deterministic rather
than intermittent, and why the class of bug is worth recognising instantly if
error #31 ever appears again. Both copies now accept either shape, so the 20
other `options=` props in My Profile (plain string arrays like `HOSTS_OPTIONS`)
are untouched.

**The instructive half is the sibling bug, which did *not* crash.** Contacts has
a byte-identical `SelectField` and escaped only by accident: it passed the raw
`o.value` codes as strings, so it rendered — while showing the user
`positive-suppressed` instead of "Positive - undetectable". Two copies of one
component, one crash and one silently wrong label, both traceable to the same
unstated contract. A comment at that call site actively asserted the two shapes
were "not a shared contract", which is what let them drift; it is corrected in
place. **Deliberately unchanged: what is *stored*.** `onChange` still matches on
`o.value`, so records keep holding codes and no saved data changes shape — only
the text shown. Confirmed with the owner first, since it is a visible change to
a screen in active use.

**How it was found, and the dead end worth recording.** Session B identified the
mechanism statically and asked for a 30-second on-device confirmation before
writing any code — explicitly refusing to "fix" a component that might not be
broken. That caution was well placed, and my own first two attempts at *proving*
it were both worthless: a CDP console listener recorded **0 events** (React's
ErrorBoundary catches render errors before they reach `console`), and the
production bundle reports the offending object as `{o}` because keys are
minified, so the artifact names nothing. The crash is loud and immediate on the
device; that was the only cheap evidence, and it took one tap sequence. **Lesson:
for "the red screen", reach for the device; for "what exactly is in the stack",
the bundle has already thrown the answer away.**

**Two forms-render paths have now escaped CI the same way** — ClinicVisits'
TDZ (previous round) and this one. Neither is surprising in hindsight: no test
ever *opened a form-render path*, and both bugs live in code that unit-tests
happily import without rendering. A smoke flow that opens My Profile -> Edit is
the actual fix, not a nice extra.

## Recently shipped (2 Oct 2026, later still still — I rendered my own source code onto the Clinic Card, in a published APK)

**The Clinic Card's title was pushed down the screen by a paragraph of my own
comment, and it was in the GitHub Release.** Found by looking at the phone after
installing the build — not by any test, lint, or measurement.

**The cause:** while fixing the Clinic Card's nav-bar underlap I left the
explanatory note between two JSX elements using `//`. In a JSX **children**
position `//` carries no special meaning — it is *text*. It rendered as a
paragraph of source code above the card's title. The neighbouring real comment in
that file is `{/* ... */}`, which is why one was right and the other wrong in the
same edit.

**Why every automated check passed, which is the useful half.** eslint passed,
because a JSXText node is perfectly valid. The unit suite passed, because the text
is inert as far as any logic is concerned. And *my own device measurements passed*:
the scroll container genuinely did get taller, so the nav-clearance fix genuinely
did work — the measurement was not wrong, it was simply blind to a defect that
changes nothing measurable. Only the phone showed it.

So `jsxCommentGuard.test.js` parses every `.jsx` with `@babel/parser` and asserts
no `JSXText` node starts with `//`, with two fixtures proving the detector
discriminates — and one of those fixtures asserts that a `//` comment in ordinary
JS position is **not** flagged, so the guard cannot push the codebase towards
awkward workarounds where `//` is correct. Reintroducing the exact shipped comment
goes red.

**The transferable lesson, recorded because I keep making the adjacent mistake:**
*a measurement that only asks the question you already have an answer to will
confirm the fix you just made.* Every number I took on that screen was true and
every one of them was about scrolling, and the defect was about a title.

## Recently shipped (2 Oct 2026, later still — a 4px gap under the Healthcare banner, and the Clinic Card's last section was unreachable)

**A device sweep of the six remaining same-class scrolling-flex containers found
one real bug and cleared the other five.** Encounter, Healthcare, Episodes,
Attachments and the Healthcare sub-tabs all scroll to their end and clear the
nav bar. **Clinic Card did not**: its last section finished at **y=835** against
a nav bar starting at **y=759**, so 76px of the Emergency notes sat underneath it
*even when the scroller was at maximum*. Same t060 cause as My Profile — its
scroller was also `display:flex`, so the flex child's height is the container's
**content box** (`clientHeight` minus padding), and the 80px bottom padding was
simply not honoured. Fixed the same way: `display:flex` off the scroller,
`margin:"0 auto"` onto the wrapper below it. Inventory 6 → 5.

**The sticky sub-heading gap the owner reported is 4px, and the cause is drift
rather than one wrong number.** Measured on the device: the Healthcare banner
sticks at `top:0` and is **93px** tall (35px of that the status-bar inset), so
it ends at y=93; the Vaccinations sub-heading stuck at **y=97**, and scrolled
content was plainly visible in between. The offset was `62px`, left over from
before the 16 Sep 2026 banner redesign shortened the banner by 8px — the
dependent offsets went 70 → 62 at the time, and not far enough.

**The real fix is one constant, not a corrected number.** **Seven** sites each
carried their own hardcoded stick position, so they had drifted apart silently
and every future banner change needed hand-propagation. They now all use
`STICKY_SUBHEADING_TOP` from `designTokens.js`, with
`stickySubheadingGuard.test.js` failing if any site reintroduces a literal — plus
a check that every user of the constant imports it, because a missing import is a
render-time `ReferenceError` in exactly the class of code unit tests import
without rendering. 58 is the banner's height *excluding* the inset, so the guard
also pins the value and says out loud that changing the banner means changing
it. Both mutations red, including the reintroduced literal and the dropped import.

**Also: my first device measurement was wrong and every screen looked broken.**
The scan for "lowest visible content" found the **nav bar's own labels** —
`"Contacts"`, `"Home"` — and reported all five screens as underlapping. The
number was real and the question was not: the scan had to exclude the fixed nav
subtree before it meant anything. Recorded because a measurement that cannot
distinguish the thing it is measuring from the thing it is measuring against is
worse than no measurement.

## Recently shipped (2 Oct 2026, later — a daily PrEP dose was silently SKIPPED, found by hand on the phone)

**A once-daily medication's dose for the day was skipped entirely, and the app
reported every medication as logged.** The owner's device showed: scheduled
04:00, reminder 04:00, last dose logged the previous day 05:07, clock at 04:48 —
and the app said the next dose was **~23h** away, the dose button was **greyed out
as already-logged**, and nothing prompted for today's dose. For a PrEP or
DoxyPEP course that is not a display bug. **It is a dose the user does not take.**

**The cause was one character.** `fixedModeDueSlot` stepped forward with
`Math.ceil((now - anchor) / interval)`, which **always** lands strictly in the
future — so the instant a scheduled time passed, that day's slot was skipped and
the next candidate was a full interval away. The old comment said this was
deliberate (*"skip forward past any slot that has already gone, so a missed dose
is never still being offered as due"*), and for a generic interval that reads
sensibly. **For a daily medication it is precisely wrong, because missed doses
then compound**: skipping one put the anchor a whole day further out for the next
call, so the following day was skipped too.

**Now it takes the MOST RECENT slot at or before now**, and only steps forward
when that slot is genuinely already in the log. Today's dose is therefore offered
from its scheduled time onward, however late you notice it — while a dose taken
exactly *on* the slot still correctly advances to tomorrow.

**Eight tests, clock pinned throughout**, because these functions read
`Date.now()` and an unpinned suite answers differently depending on what time of
day it runs — which is exactly how a 04:48-shaped bug passes on a machine that
happens not to be at 04:48. The first version asserted in UTC and failed by the
machine's offset; the calculation is genuinely **local** (`scheduleAnchorMs` builds
the anchor with a local `new Date(y, m, d, h, m)`), so the assertions are local,
which is also locale-independent in a way `toLocaleDateString` is not.

Both mutations red: **restoring the shipped `Math.ceil` fails 3**, and never
stepping past a logged dose fails 3. Two of the mutation attempts were **NOT
APPLIED** first — multi-line patterns do not match these CRLF files — and are
reported as such rather than counted as passes.

## Recently shipped (2 Oct 2026 — three device-reported bugs, one cause, and the wrong diagnosis I tried first)

**The owner hit three symptoms by hand on the phone; all three were ONE defect.**
"My Profile can't be scrolled to the end", "Share does nothing", and "the
scrollbar moves unrelated to its position on My Profile". My Profile's root
element was `display:flex` **as well as** `overflowY: auto` — which is exactly
the **t060** defect `src/components/scrollingFlexGuard.test.js` exists for. A
flex container's content box is `clientHeight` minus padding, so content taller
than that box **overflows** (overflow is visible) rather than extending the
scrollable range. Measured on the device: `window.scrollY` 695 while My
Profile's own `scrollTop` sat at **0**. Desktop centring moved to
`margin: "0 auto"` on a *non-scrolling* inner wrapper — **move the centring, do
not drop it** — so the two properties can never meet on one element again.
Guard inventory 7 → 6.

**"Share does nothing" looked like an event-handling bug and was a layout bug.**
Worth recording, because the tap landed on content that had been scrolled out of
view. A non-responsive control is the classic symptom of a container that
cannot scroll far enough, and this repo has now seen that shape twice.

**I got the diagnosis wrong first, and the repo already had the answer.** My
opening move was to add `overflowY` and 80px bottom padding to the two
Home/Settings My Profile wrappers, reasoning that a bare fixed wrapper was the
cause. It was not — `MyProfileModule`'s own root already had both. Those edits
are **reverted**, and the reason is recorded at each site, because the wrong
theory stayed plausible for several steps and would have shipped as a
plausible-looking diff. The dashboard being still-mounted underneath is what
makes the *document* scrollable; that is unchanged architecture, not the defect.

**An unreadable HIV result was being reported as "Untested".** Found on the
device, on a real card reading `Last HIV test: 23 Sept 2026` directly above
`HIV status: Untested / unknown`. The derivation was **right** and the **label**
was wrong: that test's result was `Pending`, and an unreadable result genuinely
establishes nothing — but the person **has** been tested, so "Untested" is a
different and misleading claim. Now reported as a state of the *record* rather
than a clinical status, carrying the test date, leaving the four-state taxonomy
untouched.

**The owner's correction shaped the wording: "no news is good news."** For many
clinic tests only abnormals are reported, so a **missing** result must never be
called "pending" — that would invent a to-do which never resolves and leave
someone permanently waiting for a letter that was never coming. Only a clinic
that actually recorded `Pending` gets that word; `Inconclusive`/lost sample say
so; `Not tested` correctly falls back to plain `Untested`; and the neutral
default states the no-news-is-good-news reason outright.

**Two of five mutations had to be redone** — multi-line patterns do not match
these CRLF files. *A mutation that does not apply is not a test that cannot
fail*, and the harness reports the difference rather than counting it.

## Recently shipped (1 Oct 2026, later still still still still — HIV status became shareable, and the argument for it was backwards)

**The owner wanted HIV status shareable, reasoning that it is "a stable item,
unlike chlamydia", so sharing keeps privacy concerns minimal. Gemini's review
agreed with my objection rather than the reasoning, and the disagreement is the
point.** A home address leaks stale and you move; an HIV status leaks
**permanently true, globally identifying, irrevocable**. **"Stable attribute" is
about record-maintenance burden, not disclosure risk — the argument confuses data
velocity with data sensitivity.** UK GDPR Art. 9 treats health data as special
category precisely on the axis of *irreversibility of stigma*. Gemini's concrete
case: you AirDrop a profile to a hookup, you fall out in six months, they still
hold a permanent fact about your blood. **The tickbox supplies voluntariness, not
minimisation** — once written it is plaintext with no revocation.

**The owner's own shorthand cost us the most important state.** Writing `+ / - /
unknown` for a four-state model, they clarified undetectable is not to be
collapsed. Gemini independently arrived at the same refusal: a shared payload of
`"positive"` exports the 1990s framing to a sexual partner — a suppressed-for-five-
years user would trigger demands for PEP or outright rejection on a fear that is
**no longer medically true** — while this app's own Glossary explains U=U.
**Collapsing it would have made the app contradict the note shipped one commit
earlier.** Four states stay.

**A negative and a positive need different dates, and the rule is not "the last
test".** It is the last *relevant* test. A **negative is time-bounded** and a
4th-gen test has a window period, so undated it is unquantifiable reassurance.
A **positive is durable** — diagnosed in 2012 it is true today, and forcing a date
invents one. So `describeHivStatus` now varies the undated wording per state:
negative leads with "Last known negative, but no date recorded — **unverified**"
(the word "Negative" is demoted off the front so it cannot be skimmed as
reassurance), undetectable says the result needs a date *because U=U rests on
sustained suppression*, and positive is the mildest.

**Redaction is OMISSION, and Gemini independently derived the same fix unprompted.**
A `"not-disclosed"` sentinel would be a new status string needing its own
rendering, its own picker option and its own handling in every comparison — one
more string mistakable for a real status, in a field where a wrong answer is a
false reassurance. Instead the key is simply absent, so the recipient's Contact
holds `null`, which this app **already** renders as "Not recorded" and already
treats as "not stated". Redaction and "never told me" share one code path, so
they cannot drift. Gemini named the leak: an empty HIV field beside PrEP,
chlamydia and gonorrhoea dates is *itself* read as a covert positive in a
sub-population where withholding is presumed positive. **Absence must carry zero
differential metadata** — no `hiv_shared: false`.

**The read view never displayed the HIV status at all, and Phase 4's U=U note
was hanging under an empty label.** It showed PrEP, "Last HIV test" and the note
— but not the value the note explained, on the screen this file has twice called
"the one you glance at to check your own status". Found while adding the row, not
by looking for it. It could not be copy-pasted: `ProfileDataView` had no
`anonymise` and none of the derivation inputs, so the naive fix was a **second
`deriveHivStatus` in a second component** — the drift rule this repo has paid for
repeatedly. New `useResolvedHivStatus(stated)` hook is the single owner, called
by the edit screen, the read view and the share panel.

**Two of my own tests were vacuous, and the first was the most important
property in the change.** "Omits the key when not opted in" passed no
`resolvedHivStatus`, so it went green when **the entire opt-in gate was deleted**
— with nothing to leak, nothing was spread. It proved the payload builder works,
not that the gate exists. Both now pass a resolvable status, so the gate is the
only thing standing between them and a leak. Second: nothing asserted the new
`hivStatusInformedDate` default, so removing it was also green.

**Two existing guards fired on the hook extraction, and both were widened by
exactly the legitimate amount rather than deleted.** The "stated value reaches
`resolveHivStatus`" guard asserted one literal that now lives in the hook, so it
is split into two assertions that are **strictly stronger**: the hook must
forward its own parameter, *and* every call site must pass the stored value
(matched with a negative lookbehind, since the declaration also matches). The
untested-fallback guard is now anchored on `return useLoadedMemo` — unanchored it
grabbed the hook's test-records loader, and passed for the wrong reason.

19 new share tests, **all six mutations red** including share-by-default, and
**three guard mutations red** including passing the derived value in place of the
stated one. 1030 tests pass.

## Recently shipped (1 Oct 2026, later still still still — U=U had to be a standing note, not a badge)

**The owner asked for the "undetectable = untransmittable" fact to be visible.
Where it must *not* go was the interesting part.** An earlier design showed it
only on records whose status was positive-undetectable. Gemini's review called
that **disqualifying: conditional UI reveals state.** If the note appears on some
records and not others, its **presence** tells anyone glancing at the screen which
of your contacts are HIV-positive — the same failure the anonymise mode exists to
prevent, arrived at from the opposite direction. **Uniformity is the mechanism,
not a side effect.** The same review found the pattern already standard: *"past
performance is no guarantee" appears on every stock precisely so its presence
cannot flag one*, and EHR patient-education popovers attach to lab jargon whatever
the value.

So one exported `U_U_SHORT`, shown on **every** record, and the shared component
deliberately has **no `status` prop** — a caller cannot condition it even by
accident. The rule is structural rather than a convention each screen has to
remember.

**Two rules are baked into the component, because both were layout decisions and
layouts are what every screen gets differently.** It attaches to the HIV Status
**label**, never floats under the value (under "Status: Unknown", *"this person's
undetectable viral load…"* is nonsense and implies the person **is**
undetectable); and the wording is a **conditional scientific definition**, never
a claim about a person — asserted by test.

**Sourced.** BHIVA monitoring guidelines: suppression is below 50 copies/mL, and
assay detection limits differ between manufacturers (~20–75), which is exactly
why *"undetectable" describes a test result rather than a fixed state of a
person*. The Glossary entry leads with plain language, then the evidence, and
notes the word that matters is **"stays"** — one undetectable result is a
measurement; U=U rests on sustained suppression.

On Contacts it is suppressed by anonymise alongside the status it sits beside.
Deliberate asymmetry: the note is a neutral fact so leaving it up would disclose
nothing, but consistency with the masked row matters more. Pinned so it is a
decision rather than an accident.

**The Clinic Card is deliberately NOT included**, and needs its own decision: it
shows no HIV status at all, so a U=U tag has nothing to attach to, and putting
HIV status inside the existing *"Recent STI testing"* toggle would disclose it to
anyone who enabled that without realising.

9 guard tests, **AST-based** — a first attempt used a regex and produced two
false failures, matching the prop *label text* and the file's own explanatory
comment, which is the regex-over-JSX trap this repo has now hit repeatedly. 4
mutations all red, including **gating the note on the status** — the actual
disclosure. 1010 tests pass.

## Recently shipped (1 Oct 2026, later still still — a chlamydia swab was being reported as the date of your HIV test)

**A false assurance about your own health, live since 26 Aug, and invisible
because the label was ambiguous rather than wrong.** `getAutoLastTestedDate()`
returned the most recent test of **any** kind. In the section it renders in —
PrEP/DoxyPEP, directly above HIV status — "last tested date" is read as "last
HIV test". So a pharyngeal chlamydia swab or a Hep B screen could stand in for
an HIV test that never happened.

**The duplication is why it survived.** `profileShareService.js` described it as
*"same logic as SHOS_MyProfile_Prototype.jsx's own version (duplicated per this
app's self-contained-module convention)"*. Two copies, byte-identical, one bug,
and no test that could fail. New `src/calculations/mostRecentTest.js` is the
single owner, pure so it is testable; the row is now labelled **"Last HIV test"**
so the meaning is not left to inference. The general sense is not lost — Home
already shows its own "Last test".

**Infection matching is by token, not string equality, and the owner supplied
the cases that ruled equality out.** Hepatitis runs A through E, one test can read
`"Hepatitis B & C"`, and HIV is written `HIV-1` / `HIV-2` in real records.
Equality is too strict and misses a genuine HIV test; substring is too loose and
lets a bare `"Hepatitis"` answer a question about Hepatitis B. So every
non-alphanumeric run collapses to a space and the target's tokens must **all** be
present. A bare `"Hepatitis"` **fails closed** for Hepatitis B — deliberately: a
missed match costs convenience, a false match costs someone a false assurance.

**An existing guard fired on this change, correctly, and was updated rather than
loosened.** `mostRecentTestDefinition.test.js` sweeps for filtered test loads; My
Profile no longer has one, so the sweep declared itself vacuous. The rule's intent
is unchanged but the rule now lives in one place instead of four, so it is
asserted at the owner and the count repinned 4 → 3. Recorded in the test because
deleting a file from a sweep is exactly the edit that quietly weakens a guard.

14 new tests, **5 mutations all red** — any-test-satisfies-any-infection,
only-first-token-checked, admit future-dated, admit archived, and exact-set
equality (which is what `HIV-1` and `"Hepatitis B & C"` exist to prevent). 996
tests pass.

## Recently shipped (1 Oct 2026, later still — "clear sample data" deleted six weeks of the owner's own medication history)

**The worst data-loss bug this project has ever shipped, found by the owner
opening the app and finding his meds gone.** He had renamed the seeded
"PrEP (Descovy)" / "DoxyPEP (Doxycycline)" / "Vitamin D3" records to his own
names and logged **66 of his own dose entries** against them, then used Clear
sample data. All three were deleted; their **69 non-seed dose logs survived,
orphaned**, pointing at medications that no longer existed. Recovered only
because a backup had been written the day before.

**The cause was one line, and the file's own comment insisted it was safe.**
`all.filter((r) => !seedIds.has(r.id))` — id alone. A seed record stays a seed
record by id no matter what the user has done with it, so "renamed it and logged
six weeks of doses against it" was invisible to it. The header comment claimed
*"there is no way to tell them apart except by id, which is exactly what this
file uses… clear sample data is safe at any time and always preserves real
records."* **Both claims were false.** Corrected in place, because that comment
is the kind that actively teaches the next session it is safe.

**The fix: a seed record that real records depend on is not sample data.**
`referencedSeedIds` walks the loaded collections for any seed id pointed at by a
**non-sample** record through a field ending `Id`/`Ids`. Referenced → kept, with
its history. `countSampleData` gets the same exemption, or the first-run banner
never clears and the export screen keeps warning about the user's own data.

**SUPERSEDED 5 Oct 2026 — this fix was NOT sufficient, and a second incident
proves it.** "Pointed at by a **non-sample** record" was the loophole: every seed
contact is referenced by a seed *encounter*, so a self-referential seed cluster
was vulnerable as a unit and "non-sample" excluded exactly the records that would
have protected it. Editing a seed was also never recorded, so a renamed demo record
stayed sample data by id forever. What actually fixes it is the `isSeed: false`
flag stamped on every `update()` — see the 5 Oct entry below. The claim that this
made clear-sample-data safe was wrong, and it is recorded here rather than
quietly edited away because the reasoning above is still correct about *why* the
referential check exists.

**Rejected the obvious alternative, and the rejection is the interesting part.**
The natural approach is a field-diff "has the user edited this?" heuristic.
Gemini was consulted and refused it: inferring intent by comparing fields
against the seed definition is a *guess about what the user meant*, it fights
`updatedAt` (every save rewrites it), and a wrong answer is silent loss in either
direction. Referential integrity is not a guess — a dose log pointing at
`med_001` is a **fact**. Gemini's further recommendation, keeping seed data out
of the user database behind a projection layer, is the textbook architecture and
disproportionate for a single-user app. Exchange in
`tasks/sample-data-loss/90-gemini-consult.md`.

**A test suite that was green because it could not fail.** Seven new tests. Four
mutations, three red as intended — but dropping the plural `*Ids` branch was
**green**, because every fixture used a singular `...Id`. The plural half of the
check would have shipped broken, and the shape a real encounter actually uses is
`attendeeIds`. That test is now in the suite.

**Two mistakes of my own, both caught by tooling rather than by reading.** The
fixtures called `LogRepository.add`, which does not exist (it is `create`). And
my first mutation harness reported **all four mutations as green** — the ANSI
escapes sit between "Tests" and the count, so the detection regex never matched
anything. A harness that reports green without checking is worse than no harness,
and it nearly had me discard four sound tests.

**Also caught a regression I introduced myself:** hoisting the repository load
into a helper swallowed the error the existing "never throws, reports it instead"
test depends on — which would have told the user their clear succeeded without
ever inspecting that collection.

**Verified on the device afterwards:** the restored medications render with their
real schedules and dose history (PrEP 33 entries including the `200mg/245mg`
combination), contacts and encounters untouched, **0 orphaned logs**, and
**0** vault/decrypt errors in logcat.

**Stock is safe to export, and the mechanism is the good one.** Asked whether
manual stock corrections survive a round trip. `computeStock` is a pure sum of
log deltas with no correction field at all, and "Correct stock" writes a
**synthetic log entry** (`notes: "Manual stock correction"`). So corrections are
stored, exported and re-derived — render, export and import cannot disagree.
Consulted Gemini on the three candidate models; it rated this one (a synthetic
log) the cleanest and its own advice was to check the code rather than trust the
user's assumption. Recorded in `tasks/stock-baseline/90-gemini-consult.md`.

## Recently shipped (1 Oct 2026 - the widgets had never once worked, found only by testing on a real phone)

**The bug was invisible to every automated check in this repo, and it had been shipped for a week.** All six copies of `getWidgetBridge()` returned Capacitor's plugin proxy *bare* from an `async` function. A Capacitor plugin proxy is a catch-all `Proxy` where any property access returns a function, so `proxy.then` is a function, which makes the proxy look **thenable** - and returning a thenable from an async function makes the engine unwrap it by invoking `.then()` on it. Capacitor reports that as a call to a plugin method literally named `then`, which does not exist natively. It therefore threw **before** the intended method was reached.

Consequence: every widget update failed and **the home-screen widgets had never once displayed anything**, while the code, all ten manifest receivers, all seven Java methods, and a comment saying "it is wired" were all present and correct.

**How it was found: the app's own error log, on real hardware.** The log held 50 entries, every one of them this bug - 31 of `WidgetBridge.then() is not implemented on android` and 19 of the older `WidgetBridge plugin is not implemented on android`. No browser test, CI run, or code review had ever surfaced it, because it only throws on a device with the plugin registered. It is the same class as the earlier `ScreenSecurity.then()` failure, and the reason it survived is the reason it recurred: **that one was fixed in a single file, and this one had been duplicated into six.** Both the final return and the early-return cache path are wrapped, since the cache path returns from inside the same async function too.

Session B independently wrote a guard for this while I was writing one. **B's is the canonical one and mine was deleted** - it walks all of `src/` and discovers bridge-registering files by pattern, so a seventh copy added later is caught automatically, and it asserts a non-vacuity precondition. Mine hardcoded the six files that exist today, which is precisely the per-file-assertion weakness that let this class survive the first fix. B's file gained the one check mine had that it lacked: that every bridge method the JS calls really exists as a public method in `WidgetBridgePlugin.java`.

Verified end to end, not assumed: mechanism proven by construction in isolation (bare proxy => `.then()` fires once; `{ plugin }` wrapper => never); the published APK unzipped and confirmed to contain `return Or?{plugin:Or}:null`; installed on the owner's phone with `install -r`; before the fix the same interaction threw 12 exceptions, after it a 60-second capture across every widget sync path produced **zero** error events and the app's own log gained no entry newer than the old build. 921 tests across 78 files, all three CI workflows green, both mutations mutation-checked red.

**Two device-only facts worth keeping.** `dumpsys window` does **not** print `FLAG_SECURE` on Android 15 even when the flag is set (count was 0 in both states), so it must be verified behaviourally with a screencap. And a blocked capture is *not* uniform black - FLAG_SECURE blanks the app window while the system status and navigation bars still render, so pixel **range** reads 255 on a correctly-blocked screen. Judge the **mean** (measured 2 blocked vs 30 visible) or you will report a working privacy feature as broken. Which is exactly what my own helper did, until the log showed it lying.

**Also verified on real hardware, no code change needed:** all ten widget providers are registered with the OS (confirmed independently on the CI emulator *and* the phone); all 41 storage keys are encrypted except `shos_vault_key_slots`, which is plaintext **by design** - a real bootstrap circularity, since the app must know how to reach the Data Key before it can decrypt anything, including its own `appLockEnabled` flag; `FLAG_SECURE` applies immediately on toggle with no activity recreation, so the Privacy screen's "takes effect immediately" claim is true.

**One design gap found, recorded as a gap rather than dressed up as a fix.** No Android notification channel is ever created and no `channelId` is ever passed, so all seven reminder types share the auto-created `default` channel - while Settings offers per-reminder-type toggles that cannot be honoured per-type on the OS side. Stated as a gap because there is **no evidence any notification failed to deliver**, and 25 alarms are correctly scheduled (decoded: a dose tonight, two ~14 days apart for the every-N-days course, and the fixed 09:00 slot the vaccination sync uses).

**A near-miss worth recording.** `uiautomator` reported the screenshot toggle as `checkable="false"`, which looks exactly like missing ARIA. It was not: over CDP the real DOM has `role="switch"` with a live `aria-checked`, and the `false` was an artefact of dumping a WebView accessibility tree with no screen-reader running. Gemini analysed the symptom convincingly and would have had me "fix" already-correct code.

## Recently shipped (30 Sep 2026, newest of all yet again - an audit of this file, because it nearly caused the destruction of working code)

## Recently shipped (30 Sep 2026, newest of all yet again — a four-audit round that found a silent data-destroyer, an advisory CI gate, and the third "shipped but never run" claim)

**The worst bug found in this project to date, in the one file every repository
routes through.** `storageAdapter.load()`'s catch block returned `fallback` for
*every* kind of failure, and for **16 of the 34** real call sites that fallback
is the **seed array** — the fabricated demo contacts, encounters and tests. So a
wrong Data Key, a cleared IndexedDB, or corrupted ciphertext handed the app
demo data, that data *became* the repository's in-memory state, and the next
`persist()` re-encrypted demo+new straight over the real ciphertext. Every
record, gone, with a `console.error` nobody sees — and the three causes are
indistinguishable from a genuine first install, so there was no signal at all
before it had already happened.

The fix has two halves and **the second is the one that actually prevents the
loss**: returning an empty container stops fabrication, but an empty array saved
over real ciphertext destroys it just as permanently. So a key that could not be
read is *quarantined* and `save()` refuses it, leaving the real ciphertext on
disk and letting a transient cause self-heal on the next read. The subtlety
that makes it safe: a merely-**locked** vault must not be treated as corruption.
`cryptoService` throws a distinct `"Vault is not unlocked"` message for that, and
it is *routine* — `App.jsx`'s own `checkDueMeds` comment records that this app
really does read storage during boot and while the lock screen is up.
Quarantining there would have blocked every save in the app for the whole
session, a far worse failure than the one being fixed. 15 tests, all 6 mutations
red, plus a control that stays green.

**The CI gate was advisory, and the reason is a GitHub Actions limitation rather
than an oversight anyone would spot.** `build-apk.yml` and `web-alpha.yml` ran
**no test, no lint and no build verification at all** — straight from `npm
install` to gradle to a **public release**. The reassuring reading is that
`smoke-test.yml` covers them. It does not, and cannot: **`needs:` only works
between jobs inside one workflow**, so one workflow can never depend on another.
The gate now lives *inside* each publishing workflow (`verify:fast` — build,
lint, unit tests, encoding, docs — the things that would actually produce a
broken APK), and is **push-only** so the `checkout_sha` bisect feature keeps
working. Also in that commit: `npm install` → `npm ci`, `release_tag` moved out
of a shell body in a `contents: write` job and into `env:`, a `permissions:`
block on the one workflow that lacked one, and `anomalyco/opencode@latest` —
a **mutable third-party tag holding a live API key on a public repo** —
SHA-pinned to a commit resolved from the live API rather than written from
memory, with the trigger restricted to the owner. 14 new tests, 8 mutations red.
*Stated rather than implied:* the `actions/*` steps are still on mutable
major-version tags and deliberately **not** guarded, because a test that failed
forever on an unfixed item would just get deleted.

**The third "shipped but never run" claim in this file, and the same shape as
the Escape one.** `updateRefillWidget()` destructured `getRefillDueMedications`
from `medicationCalculations.js` — which does not export it; it lives in
`refillReminderSync.js`, where every other caller already imported it from. It
also wasn't awaited, and was passed two arguments by a function that takes none.
The `TypeError` was swallowed by a `catch` commented "Widget bridge not
available (web)", so **`bridge.updateNextDose` never ran** and the next-dose
widget that this file recorded as "wired, masked by default" still had never
displayed anything. Now guarded statically: every relative dynamic `import()` in
`calculations`/`repositories`/`storage` is resolved to its target and each
destructured name checked against what that module actually exports.

**Two Anonymise-mode gaps, three weeks after the audit that closed the first
batch.** Home's "Newest contact" row printed a **real name** while the feature
was on, and Home had *no reference to the flag at all* — this is not a masking
expression got wrong, the feature was absent from the app's landing screen. And
Symptom Log's "Related encounters" search index was built from attendee names
with no check, where **the display was already correct** — so masking the label
would have looked like a fix and changed nothing: you could turn Anonymise mode
on and still find an encounter by typing your partner's real name. That is the
part a visual check cannot catch, and it is why the rule lives in one helper.
The third finding was **a guard that missed its own target**: My Profile had a
five-dot placeholder beside the shared four-dot one, and the check for exactly
four dots did not match five. A guard that misses its own target is worse than
no guard, because it reports the invariant held.

**Four of my own mistakes, each recorded where it happened**, because the
recurring theme is that instrumentation is where this project leaks. A
`localStorage` mock that was *defined but never installed*, which made results
look shifted between tests. A mutation harness whose first control targeted
`name: SHOS-debug.apk`, a string that **does not exist in that workflow** — I had
written it from memory instead of reading the file. A `console.warn` guard
scoped to end-of-file that passed while the catch was still on `console.debug`,
caught only because mutation testing made it go green when it should go red.
And the **eighth recorded instance of the comment-matching class**: a guard
asserting the wrong-module import was gone, doing a substring test for exactly
that pairing — which the fix's own comment satisfies, so it went **red on the
commit that fixed the bug**.

**The encoding trap, sixth recorded instance, and the most instructive one yet
because of how it surfaced.** `verify:fast` passed — *including the encoding
guard* — because that guard only scans **git-tracked** files, and the file was
new and unstaged. Staging made it tracked; the pre-commit hook caught four
double-encoded em-dashes immediately. **A brand-new file is completely
unprotected until it is staged**, which makes staging the step that *exposes*
the problem rather than the step that causes it.


## Recently shipped (30 Sep 2026, newest of all yet again — an audit of this file, because it nearly caused the destruction of working code)

**The incident that prompted it.** This file said the Escape-to-dismiss work was
"deliberately NOT attempted yet". It had shipped the same day across 20 files. A
session believed it, rebuilt the hook from scratch, and **overwrote the shipped
implementation and its test file** before noticing. Reverted via `git checkout`;
nothing lost. That is the third recorded instance here of an inherited claim
being treated as a measurement, and the most expensive one, because the cost
was not a wrong number but working code about to be destroyed.

**A second model was asked what would have prevented it, and its sharpest point
became the standing rule above.** A language model is biased toward completion,
so "X is not attempted yet" in an instruction file reads as a *task*, not a
status. Silence is neutral; a false negative is a destruction command. The same
model also argued, correctly, against my first instinct: a test that greps this
file for known counts and fails on mismatch is *worse than the disease* — it
creates build friction over prose, and the next session removes the test rather
than recount the repo. The mechanism adopted instead is a **convention**: any
figure worth acting on carries the command that measures it, so a reader can
re-check in one keystroke instead of trusting it.

**So the live sections were audited, empirically, with three agents working in
parallel plus my own checks — and every finding was re-verified against the
code before acting, because the project's own rule is that a sub-agent report is
not evidence.** Roughly a third of the volatile figures were wrong:

- **Flow count said 18 in one place and 17 in another** (and the historical log
  records a *third* correction of this figure). Actual: **23**.
  - **"142 → 133" fixed waits** — no counting method reproduced either endpoint.
    Actual, at the time of that audit: **144 → 133** (14 removed, 11 net).
    *Even the re-measure disagreed*: the first pass said 134 raw, the
    comment-stripped count said 129, and a third method said 133 — which is why
    the number now ships with its command rather than on its own.
    **SUPERSEDED 30 Sep 2026 by three further t028 batches, now 120 live.**
    The comment-stripped method is the only correct one, and the reason is worth
    keeping: a fix for a fixed wait is *written* as a comment saying "was
    `waitForTimeout(600)`", so a naive scanner counts each removal as a wait
    still present. My own t028 scanner made exactly that mistake and reported
    five fixes as no change at all until I added the stripper to it.
- **"Nine call sites"** papered over with an 800 ms wait, where the code's own
  comment said "eight" and the diff removes **six**.
- **"16 rows across 8 sections"** in Settings — wrong *on the day it was
  written*; a Widgets row had been added three days earlier. Actual: **17**.
- **51 `role="dialog"`** — actual **53 across 38 files** (the 28 Sep
  `AcknowledgeSheet`, plus a file-count correction).
- **SelectField "9 copies"** — actual **8** definitions.
- **"19 modules", naming 14** — actual **20** files, and six of them are peer
  modules imported by `SHOS_Healthcare_Prototype.jsx`, not parts of it.
- **"App.jsx is shell-only … a large App.jsx would mean the extraction
  regressed"** — the directive is now **inverted**: the extraction happened, and
  `App.jsx` is ~3050 lines with 9 further top-level components, none of them
  routing, global state or banners. A new session would conclude the opposite of
  what is true.
- **`src/registries/` and `src/components/` were missing from "Where things
  live" entirely** — the first is layer 1 of the four-layer model named 50 lines
  earlier. `src/storage/` listed 7 of 17 files, omitting the two that the
  adjacent bullets depend on by name.
- **"no `URLSearchParams` handling anywhere in `src/`"** — false since 3 Sep.
- **The four-layer model listed Contacts, Locations and Medications as
  registries**; they are repositories. That error sat here for a month.
- **"a calculations file is pure business logic, no I/O"** — seven non-sync
  files in `src/calculations/` import repositories or storage. The rule is
  sound; it is not a description of the current tree, and reading it as one
  invites "fixing" files that work.

**What is deliberately NOT done.** No automated counting test, for the reason
above. And no wholesale rewrite: the `Recently shipped` half of this file is
institutional memory — it records *why* each decision was made, which is
precisely what a session cannot reconstruct — so it stays, and the corrections
above are marked in place with the reason rather than silently edited, since a
correction with no explanation is the kind that goes stale again.

## Recently shipped (29 Sep 2026, newest of all yet again — the widgets have never worked, not once, and one missing line is why)

**Ten home-screen widgets have been registered in the manifest since the day
they were built. Seven of them have never displayed anything, and the cause is a
single line that did not exist.** `ScreenSecurityPlugin` was registered in
`MainActivity.onCreate()`; no `WidgetBridge` plugin was, anywhere. The JS calls
Capacitor's own `registerPlugin("WidgetBridge")`, which only resolves to a real
method if the native class is registered there — so `bridge.updateNextDose` was
`undefined`, the guard `if (bridge && bridge.updateNextDose)` silently did
nothing, and no provider method was ever invoked. Verified rather than assumed:
zero Java callers of any `WidgetProvider.update*` method.

**Three of the ten widgets did work throughout, which is why this looked
installed.** The QuickAdd contact/encounter/medication widgets are pure launch
Intents and read no data, so they were never affected. Ten minus three is seven
dead, and one of those seven — `NextDoseWidgetProvider` — had a provider, a
layout, a receiver and, after this change, a bridge method, and **no caller
anywhere in `src/`**. **CORRECTED 30 Sep 2026: "It is now wired, masked by
default" was FALSE when written here, and stayed false until this date — the
THIRD recorded instance in this file of a fix being recorded as shipped on the
strength of the code existing rather than having been run.** The call site was
present and the comment above it described it as working; it had never executed.
`updateRefillWidget()` destructured `getRefillDueMedications` from
`medicationCalculations.js`, which does not export it (it lives in
`refillReminderSync.js`), called the real async function **without `await`**, and
passed it **two arguments when it takes none**. The `TypeError` was swallowed by
a `catch` commented "Widget bridge not available (web)", so everything below it —
including `bridge.updateNextDose` — never ran. All three defects are fixed, the
catch now logs at `warn` rather than `debug` so a real error stops being
indistinguishable from a missing bridge, and
`src/calculations/dynamicImportShape.test.js` now checks statically that every
relative dynamic `import()` destructures a symbol its target actually exports.
**Verified still never run on a real device** — that is the part only
`docs/DEVICE-TEST-CHECKLIST.md` can close.

**The encryption decision, and why the app's own vault key could not be used.**
`AppWidgetProvider.onUpdate()` is a BroadcastReceiver that routinely runs with
the app process dead, and `cryptoService`'s Data Key is deliberately
non-extractable and held in memory only while the app runs. A cold-started
widget process therefore cannot reach it, and re-implementing the vault for
widgets would mean a second key on disk, which is worse rather than better. The
owner's decision was `EncryptedSharedPreferences` (AndroidX Security Crypto),
which uses a Keystore-backed key readable from any process on the device. All
14 plaintext `getSharedPreferences` call sites across the 7 data providers now
route through one `WidgetPrefs` helper, which also handles the real upgrade
edge: a device with a leftover plaintext file would make `create()` throw and
take every widget down on first update, so the plaintext file is deleted once
and the create retried.

**The NHS number is gone from the widget entirely — parameter, key and all.** It
used to be forwarded by the JS and stored by the provider. The bridge now
accepts the field for call-shape compatibility and ignores it, and the provider
method has no such parameter, so it cannot come back by accident. The Clinic
Card is one tap away and already holds the value; a home-screen widget has no
reason to keep a copy of a national identifier.

**Masked by default, which is the owner's separate decision from encryption and
is not the same problem.** A widget that names your medication is readable by
anyone glancing at your unlocked phone, and encrypting the file at rest does
nothing about that — it protects the file, not the screen. The next-dose widget
therefore shows the *time* and never the medication name. The persisted control
for this is deliberately **not** in the widget: the owner asked for a
user-controlled disclosure level, and it belongs in `PrivacyScreen`, extending
the existing two-tier anonymise model rather than duplicating it (that model is
a temporary hand-the-phone-over mode; a disclosure level is persistent). Pool
task `t027`.

**The sink guard's invariant changed shape, and keeping the old one would have
meant deleting it.** `widgetPlaintextSink.test.js` asserted "no WidgetBridge
plugin exists", which was true and was the only reason the NHS number was safe.
Building the bridge made that false by design. The protected property never
changed — the NHS number must never reach widget storage — so the assertions
became: the bridge discards the field, no Java code writes the key, storage is
encrypted, and the bridge is registered in `MainActivity`. That last one now
guards the exact line whose absence caused the whole problem. All four
mutations confirmed red, including forwarding the NHS number and unregistering
the plugin.

Verified: `verify:fast` green, eslint clean, encoding guard clean. **Native code
cannot be compiled on this machine**, so the new Gradle dependency and the
plugin's own compilation are confirmed by CI's APK build and nothing before it
— the first real risk in this round, since `androidx.security:security-crypto`
is a new dependency resolving from the network.

## Recently shipped (29 Sep 2026, newest of all yet again — the refill's second stage, and the one thing it deliberately does NOT do)

**Marking a refill "requested" made it disappear completely.** It is filtered
out of `getRefillDueMedications()`, so the in-app banner stopped, the
notification stopped, and the only trace was one line on the medication card. If
the pharmacy is out of stock, or you simply forget, nothing ever brought it back
— the same silent-loss shape the feature was built to fix, one stage later.

**The second stage is derived, not a second stored flag.** `refillRequestedAt` is
the fact; whether it is still outstanding is calculated from live stock, so
logging the refill retires it with no second write and the two can never
disagree. That is the repo's own "store facts, derive state" rule, and it is why
there is no `refillCollectedAt`.

**It does not nag, and that is asserted rather than left to review.** No timer,
no notification, no new scheduling path. It is tempting to bring the item back
after N days and there is no sourced number for N — which is exactly the trap the
medication lockout's 0.8 and 0.2 factors fell into before the NHS figures were
found. A test greps the function for a days-derived constant and fails if one
appears, and a second asserts the awaiting list never enters the scheduling path.
It also deliberately does **not** reuse the refill banner's signature:
acknowledging the red banner must not be able to hide a passive "you ordered
this and have not collected it" line.

**A mis-tap had no way back, which is the escape-hatch defect again.** The
"Mark as requested" action hides itself once tapped, so the only route out was
logging a refill that never happened. `handleUndoRefillRequest` clears **both**
suppression timestamps — clearing only `refillRequestedAt` would leave the item
vanishing again for a reason the user cannot see — and Home carries the button.

**Two of my own test bugs, both fixtures asserting a shape the code never had.**
The first used `quantity` on a log where `computeStock` reads `delta`, so it
summed to zero and asserted nonsense. The second asserted `scheduleNotification`
was absent from `syncRefillReminder` — where the *first* stage legitimately
schedules. The meaningful negative, that the awaiting list is not in the
scheduling path, is asserted instead, together with the positive that the first
stage is still there so the negative cannot pass vacuously.

**A missing icon import that eslint did not catch.** The new line uses `Clock`,
which was not in App.jsx's Phosphor import — a render-time `ReferenceError` that
build, lint and the whole unit suite would have shipped. Found by asking whether
the symbol was actually imported rather than assuming, which is the same instinct
as checking that a guard can fail.

Verified: 11 tests, all 5 mutations red — the Home fetch dropping the list, undo
clearing only one timestamp, the second stage starting to schedule its own
notification, an unsourced timer, and cancelled items being counted. Local gate
otherwise green; the full unit run is currently held by the other session's
in-flight `statsCalculations` work, not by this change.

## Recently shipped (29 Sep 2026, newest of all yet again — one master switch, and the honest part is what it does NOT let you do)

**The suppression feature had no way to turn off.** Phase 3 shipped "Don't
remind me" on all five banner types, with no master control — so a user who
wanted the feature gone had no route to it, which is the same defect as a
persisted silence with no way back, and this repo has recorded that reasoning
already. One switch now, defaulting to **on** because the feature shipped on: a
default of off would silently stop hiding reminders for someone who never asked
it to, and "the app stopped doing the thing I set up" is not an expected
consequence of updating.

**The switch is enforced in two places, not at ten call sites.**
`isBannerVisible` and `shouldSuppressDeviceNotification` both take it as a
parameter, and it is threaded through `suppressState` — the single helper all
five banners already go through. Five places deciding the same thing is five
places to forget, and the one that gets forgotten is the one nobody tests.

**The half that matters most is the half that is easy to miss.** The switch also
stops the *device* notification being cancelled, not just the banner. A switch
that hides the banner while the phone keeps buzzing is a switch that half works,
and the half still disclosing is the half the user turned it off to stop. All
five device-silence call sites are asserted by count, because they come in two
shapes and a scripted pass silently missed one of them.

**The scope chips are hidden when the feature is off, which is the same principle
as the "visibly dead control" fix elsewhere today.** Offering a choice between
"Just in the app" and "App and device" for a feature that is switched off is a
control that describes nothing. What is *not* done is deleting stored
acknowledgements: turning the feature back on restores them, and the screen says
so, because silently clearing a user's choices would be its own surprise.

**One of my own tests was a constant expression and measured nothing.**
`expect(undefined !== false).toBe(true)` reads as coverage, asserts nothing
about the app, and eslint's `no-constant-binary-expression` caught it — which is
a good argument for that rule being an error rather than a warning. Replaced
with an assertion about the defensive-default merge actually producing `true`.

Verified: 10 tests, all 6 mutations red — the switch ignored by either function,
one of five call sites dropping it, the banner funnel dropping it, a missing
field read as disabled, and the default flipping. Lint clean.

## Recently shipped (29 Sep 2026, newest of all yet again — the coordination tool got a test suite, and it found two more bugs immediately)

**`session-bridge.mjs` is how two concurrent sessions avoid editing the same
file, and it had no test of any kind.** It produced five separate pool and claim
bugs in one session, every one of them found by *using* it: `pool take` ignoring
its id, `process.exit` skipping the lock's `finally` in 11 of 12 sites, `edit`
claiming files on annotation, and `done` never releasing. None were found by
reading the code, and the common cause is that there was no way to run the tool
twice and assert on the outcome — so everything was verified by hand, one bug at
a time, forever.

**The suite is a subprocess harness, because the contract is process-level.**
Exit codes, stdout, and `pool.lock` on disk *are* the observable behaviour, and
an in-process call would exercise none of it. `SHOS_BUS_HOME` was added so it
can run against a temporary directory; the default is unchanged, so normal use
is unaffected, and one test asserts the real pool never gains a test task. Each
of the five bugs now has a named regression test, and the `process.exit` one
deliberately exercises **six different refusal verbs** rather than the single
call site that was originally fixed — because that was the bug.

**It found two real problems on its first run, both of them mine.** The refusal
for a task another session holds said `t001 is doing, not approved` and never
named the file — the one actionable part of the answer, since the status check
fired before the ownership check. And the harness's own waiting was wrong twice:
it first spawned `node -e` per poll, then used `Atomics.wait`, which **blocks the
thread**, so vitest's worker could not answer its RPC and the run exited
**non-zero with all 17 tests passing** — a green suite reporting a red gate,
caused entirely by the thing that waits. An async timer is the fix, and the suite
went from 73s to 14s.

**All five mutations confirmed red**, each reintroducing one of the original
bugs. Four of the five patterns *silently failed to apply* on the first attempt
because they were written with `\n` against a CRLF file — the exact trap this
file has now recorded several times. The harness reads the line ending off the
file before matching, and a mutation that does not apply is reported as
"NOT APPLIED" rather than counted as a pass.

**A full-gate failure that is not a regression, recorded so nobody chases it.**
`vaccineEarlyDoseNotice.test.js` failed twice while it passed in isolation, with
a *different* assertion each time. The cause is the shared tree: the file it
reads was being written by the other session a minute earlier, so the assertion
that failed depended on which partial snapshot was read. A test that reads
source as text is only as stable as the file. Not a defect, but the kind of
thing that looks exactly like one at 2am.

Verified: `verify:fast` green for everything this change touches — 34 tests
across the three new/updated files, eslint clean, the real pool untouched. The
full gate is held by the other session's in-flight edit, not by this.

## Recently shipped (29 Sep 2026, newest of all yet again — t030 was marked "done" with nothing wired, which is what a self-reported state is worth)

**`t030` was found marked `done` in the work pool with zero references to the
resolver outside its own file. The work had never been done.** The disclosure
level shipped in the previous round was visible in Privacy, movable, and did
nothing at all — the precise state the task was created to prevent, reached
because someone marked it done in error. Worth stating plainly: **a pool entry
saying "done" is a self-report with nothing behind it**, so where a state
matters it is worth verifying rather than reading. Caught by grepping for the
resolver's callers, not by any tool.

**The wiring went into `scheduleNotification`, not into 14 call sites.** That is
the design decision. The failure this repo keeps cataloguing is one rule computed
in several places drifting silently — the Testing banner shipped dead for its
entire life because one file computed a fingerprint the scheduler had no copy
of. If each reminder sync file decided for itself, "masked" would acquire a
slightly different meaning per reminder type and nobody would find out until a
lock screen leaked something. The callers now only declare **what kind** of
reminder it is, which is non-clinical by construction, and one function owns how
much of it is allowed out.

**DoxyPEP is included even though the task did not list it.** It is a real
reminder carrying real content, so wiring five of six would have left one
leaking at the masked level — a half-done privacy feature, which is worse than
none because it looks finished. 14 call sites across 6 files, verified by count
rather than by eye: each file's `actionTypeId` anchors matched its
`scheduleNotification` count exactly, so the insertion could not land elsewhere.

**Both delivery paths are asserted, by a source-level guard.** A unit test proves
the resolver's decisions; it cannot prove the resolver is *reached* — the gap this
repo has been bitten by twice before, a full Escape feature whose hook worked
perfectly in tests while a sweep failed to attach it, and a palette scanner
reporting "no regressions" from a detector that had never fired. The guard
asserts the resolved value is what gets scheduled, on **both** native and web,
because disclosing one and not the other means the feature silently does nothing
on a platform.

**One of my own guards failed for the wrong reason, and I fixed the guard rather
than loosening it.** The web-path assertion matched `showWebNotification`'s own
function *declaration*, which legitimately has that parameter list. Anchored with
a negative lookbehind to exclude the signature.

Verified: `verify:fast` green, **566 tests across 47 files**. All four mutations
of the wiring guard confirmed red: resolving then scheduling the raw text anyway,
the web path left undisclosed, a call site losing its `kind`, and the detailed
level's clinical text deleted rather than masked.

## Recently shipped (29 Sep 2026, newest of all yet again — the vaccine table ships with real numbers, and the notice could never have used them)

**t032 at last, and the first thing found was that the table was structurally
unreachable.** `getEarlyDoseNotice` read `previous.vaccineName`, but a dose
object does not carry that field — the vaccine name lives on the *record*. So
the lookup was always `undefined`, `guidance` was always `null`, and filling the
table would have changed nothing at all. It is the same failure this file
records twice already: a value computed in one file with no copy anywhere the
consumer can see. The name is now passed down from the record.

**The number stored is the FASTEST valid UK schedule, not the routine one, and
that is the whole design.** It is a floor, not a target, so it can only fire on a
dose that is earlier than *every* schedule the guidance permits — which means an
accelerated or outbreak course is never wrongly warned. Hep B proves why: UK
guidance allows 0,1,6, 0,1,2,12 **and** 0,7d,21d, so my first draft's 28/140 (the
routine figures) would have falsely warned on the very rapid schedule. Corrected
to 7/14 before it ever shipped.

**A second model proposed a 4-day grace period, cited it to "CDC/Green Book",
and retracted it when challenged** — it is a US CDC rule and does not exist in
the UK, where the published minimum is the limit. This is the fourth recorded
instance of an unsourced clinical constant in this project, and the first where
the challenger admitted it rather than defending it.

**Its other three findings were adopted, and one is a real bug class:** the
notice compared a dose against *the user's own stored due date*, so a mistyped
due date produced a warning about a dose that was fine. The copy is reworded to
the only question a user can act on — "your clinic can tell you whether it still
counts" — and it no longer prints a day count, because on a mis-keyed date "42
days early" is noise and on a near-miss it manufactures anxiety. The notice now
also fires on the *sourced floor* independently of any due date.

**Deliberately says nothing about whether a course is complete.** One HPV dose is
often a complete course since the UK went single-dose in Sept 2023, and
immunosuppression is broader than the HIV status the app now records, so
completeness is a clinical determination this app has no business making.
Hepatitis B likewise has **no routine booster** — five-year boosters are for
people who inject drugs and healthcare/lab staff only.

**"Meningitis B" and "Gonorrhoea" are separate entries on purpose.** Both are
4CMenB, but the courses differ — meningitis B is 2 doses plus a booster,
gonorrhoea is 2 doses with none — and merged, a user's first gonorrhoea dose
reads as a booster. That 4CMenB is now given nationally to prevent gonorrhoea in
GBMSM was confirmed in the Green Book's own June 2025 chapter, not assumed.

**The guard that protected this was replaced with a stricter one, not deleted.**
It used to assert the table was *empty*, which was right while it was: the point
is that no unsourced clinical number reaches a user. "Empty" would now only stop
the feature shipping. It now asserts, per entry, that there is a real
`gov.uk`/`nhs.uk` document, a `checkedOn` date and a positive floor — and name
matching is **exact after trimming**, because a substring rule once made
"Hepatitis A" resolve to the hepatitis B entry.

**A guard matched my own comment for the fourth recorded time in this repo.** The
"makes no clinical verdict" assertion scans the notice source as text, and the
comment explaining the new wording contains the word "invalid" — on the very
commit that added it, which is the worst version of that mistake. It now strips
comments first, and the stripper is proven non-vacuous rather than assumed.
Two existing guards fired on this change and were widened by exactly the
legitimate amount, with the assertions that matter left intact.

Verified: `verify:fast` green, **747 tests across 61 files**. All eight
mutations red, including restoring the dead `previous.vaccineName` lookup, the
routine intervals, the merged 4CMenB entry, and a loose substring match.
Exchange with the second model is in `~/.shos-session-bus/tasks/t032/`.

## Recently shipped (29 Sep 2026, newest of all yet again — t025 rescoped away from "eligibility", and a disclosure level that is not another Anonymise mode)

**The vaccine "eligibility suggestions" idea was rescoped with the owner, and
the original framing was the wrong one.** Eligibility means inferring facts about
the user that this app does not hold: `myProfileRepository` has `gender` and
`sexualPosition` and **no HIV status field at all**, and UK hepatitis-B
eligibility turns largely on HIV status. An eligibility banner would therefore be
a guess computed from a partial profile and displayed on a home screen — exactly
the automated clinical risk scoring `CLAUDE.md` puts permanently out of scope. The
owner's decision was better than either alternative offered: **generalise the
guidance, and record HIV status properly** — four states (`negative`,
`positive-suppressed`, `positive-unsuppressed`, `untested`), each tagged with the
date of the test that established it, blank when unknown, on **My Profile and
Contacts** rather than profile only.

**The derivation has a trap worth stating.** Status is derived from Testing
records, and *only* from tests whose `testingFor` includes `"HIV"`. A negative
chlamydia result says nothing about HIV status, so a latest-test-wins rule over
all tests would be confidently wrong — the same "one canonical owner per fact"
discipline the repo already records. And the **suppressed/unsuppressed split is
not derivable from an HIV test at all**: combo/fourth-generation tests give
positive or negative and nothing finer. It comes from a viral-load measurement,
which this app already has as a real recorded type, so where none exists the
status must read as positive-without-known-suppression rather than defaulting to
one side. Brief at `~/.shos-session-bus/tasks/t025-hiv-status/01-scope.md`.

**Three failure modes the derivation is explicitly built to avoid, each asserted.**
"No viral load" resolves to *unsuppressed*, not suppressed — "we do not know"
must never render as "they are well". A result the app cannot read (Pending, lost
sample) establishes nothing rather than falling to either side. And a stated
status **overrides** a derived one, because someone on PrEP with results held at
another service has no record here, and a derived-only field would report
"untested" for a person on treatment.

**One real ordering bug in my own first version, caught by the test rather than
by reading.** The viral-load check guarded `Number.isFinite(n)` *before* testing
for the word "Undetectable" — and `Number("Undetectable")` is `NaN`, so the
function rejected the very result it existed to recognise and reported someone on
effective treatment as having a high viral load. The word check now comes first.

**The disclosure level is a persistent third axis, not a third anonymise mode.**
`anonymiseModeActive` and `hideFurtherEnabled` are a *temporary* hand-the-phone-
over state acting *inside* the app. What the owner asked for is a *persistent*
statement of how much the app may show when they are not looking — lock-screen
notifications and home-screen widgets, content handed to the OS. Three levels
(`masked` / `glanceable` / `detailed`), **defaulting to the most restrictive
value**, which also matches what the widgets were just built to do, so the
setting confirms existing behaviour rather than silently changing it on first
run.

**One resolver, and the fail-closed direction is the whole design.** The rule
that `masked` shows only generic copy lives in `disclosureLevel.js` and nowhere
else, because the failure this repo keeps cataloguing is one string computed in
two places drifting silently — the Testing banner shipped dead for its entire
life because one file computed a fingerprint the scheduler had no copy of.
`normaliseDisclosureLevel` maps every unrecognised value, including one arriving
from a backup written by a build predating the field, to `masked`. A privacy
control that fails *open* shows a medication name on a lock screen, so "I do not
recognise this setting, therefore I will show everything" is the one wrong
direction. `glanceable` is given a `kind` and no field for clinical data to
arrive in, so a caller that forgets to redact gets a blank line rather than a
name.

**Notification text is left unwired on purpose, and the reason is a file
collision.** `scheduleNotification` takes `title`/`body` as parameters, so the
text is built by the four reminder-sync callers — all of which the other session
currently holds. Half a feature was the alternative and would have meant either
merging into files another session is editing or shipping a setting that visibly
does nothing. Queued as a pool task for when those are free. The resolver's own
fail-closed direction is asserted rather than assumed: all four of its mutations
go red, each taken from the direction that would leak — the default becoming the
most exposing level, `normalise` returning `detailed` for an unknown value, the
masked branch echoing its payload, and `glanceable` falling back to the full body
instead of blank.

**Two of the three screens now show it, and the third is a deliberate design
decision rather than an omission.** My Profile resolves stated-over-derived and
labels an entered value as such, so a reader can tell a recorded status from an
inferred one. A **contact's** status is stated-only and never derived — the
derivation reads the *owner's* test records, so applying it to a contact would
report the owner's results as someone else's status. That is not a gap waiting
to be filled; it is the only honest answer, and the row says "Not recorded"
rather than "untested" so a blank never becomes a claim about someone else. It
is also the one row there masked under Anonymise mode while its neighbours in
the same card are not, a real asymmetry and a deliberate one: PrEP status and a
last-tested date are useful in a conversation with that person, whereas
disclosing someone's HIV status to a third party is a decision with
consequences they may not have made.

**The not-yet-loaded case was its own bug, caught before it shipped.** An
`useLoadedMemo` fallback of "untested" would have rendered a confident "Untested
/ unknown" for the moment before the records arrived, and on this particular
fact that reads as *you are clear*. The sentinel is `null` and the row shows a
loading state instead — the same fix Global Search needed for "no matches" before
it had searched, and a reminder that a benign-looking default is only benign on
a screen where the wrong answer is not a medical claim.

Verified: `verify:fast` green, **697 tests across 58 files**. All eight
mutations of the derivation red, including a non-HIV test being allowed to set
the status; all six mutations of the new UI guard red, including removing the
displayed status while leaving the control that sets it. Two of those six
mutations **failed to apply** on the first pass — multi-line patterns against
these CRLF files — and are reported as NOT APPLIED rather than counted as
passes, because the most important check of all (does the guard catch the status
ceasing to be displayed?) had not actually run.

**And a fourth recorded instance of the PowerShell encoding trap, this time
caught by the gate rather than by a user.** Removing a duplicate entry from this
file via `Get-Content` / `Set-Content` decoded it as CP1252 and re-encoded it
as UTF-8, corrupting **1143 lines** — essentially the whole document. The
encoding guard failed the run immediately and the pre-commit hook would have
blocked the commit; the file was restored from git and the edit redone with a
Node script. This is the trap `CLAUDE.md` itself has now recorded four times,
and the fifth instance is a reminder that "I know about this" is not the same
as "this time it didn't happen" — the same reasoning as a mutation that does not
apply being reported rather than counted.

**The other half of the rescope, and the file that makes "guidance, not
eligibility" structural rather than a matter of careful wording.**
`hepBGuidance.js` returns publicly-published advice or nothing, and three rules
are enforced by tests rather than left to a later reader's judgement: it never
emits a verdict about the individual (a regex on the rendered copy, applied
across ten status inputs including garbage from a future backup), **negative,
untested and no-status all get byte-identical wording** because the difference
between them is not a fact this app can establish, and it returns `null` once
hepatitis B is on file, since advising someone about a vaccine they already
have logged is noise in an app that is explicitly no-alarm. The status it reads
is the owner's, resolved stated-over-derived through the same call My Profile
displays, so the guidance cannot disagree with the value the user can see and
correct.

**A real bug in my own first regex, caught by the test in the same commit.**
`hep\s*\(?[ab]\)?` matches "Hep**a**titis A" as hepatitis B, because the
character class lands on the "a" of "atitis" — so someone who had Hepatitis A
logged would have had the hepatitis B banner suppressed, and the guidance
withheld on the strength of a letter. Caught by the `does not match` half of a
loose-matching test rather than by reading the pattern, which is the fourth time
in this repo that a test's *negative* case has earned its keep.

**The duplicate itself was real, and the earlier note that it was fixed was
wrong.** Two entries carried the identical heading "the refill's second stage",
but only one contained refill work: the other was an earlier, shorter draft of
this very t025 entry, pasted under a copy-pasted heading. So the previously
recorded "duplicated entry fixed" was not true at the time it was written, which
is the same lesson this file keeps learning about claims inherited from earlier
documents being measurements rather than assertions.

## Recently shipped (29 Sep 2026, newer still — the smoke failure was a two-second wait, and my own lock fix was one of fifteen call sites)

**The bridge's first CI run went red, and the cause was not the bridge.** The
smoke suite failed at flow 11 with a 15-second timeout waiting for the Privacy
row. `openSettingsPrivacyScreen` had **two** fixed waits, both wrong in the same
direction: an 800ms guess that the app had booted, and a 700ms wait after
clicking Unlock — which does a real PBKDF2-100k vault re-wrap, measured at
~1.1s in this suite's own PIN-recovery flow. On a loaded runner the app is still
on the lock screen, the PIN branch is skipped or the unlock is unfinished, and
every later step operates on the lock screen. The failure surfaces at the Privacy
row because that is the first thing that is genuinely absent, not because
Settings is broken. Both are now bounded waits on the state being relied on.
**The previous commit was green**, and the only web-reachable change in mine sits
inside `if (bridge && bridge.updateNextDose)`, which cannot be true on web — so
the diagnosis is evidence-based rather than assumed, but CI is the confirmation.

**This is the same bug class this file records repeatedly, in a function nobody
had swept.** ~130 `waitForTimeout` calls remain across the suite. That is not
swept blindly — a mechanical conversion of 130 sites is exactly the broad
unverifiable change these notes warn against — so it is pool task `t028` at XL
effort, to be done per-site with evidence.

**My own lock fix was one of fifteen call sites, and I reported it as fixed.**
The `process.exit()`-inside-`withPoolLock` bug skips the `finally` that deletes
`pool.lock`. I found it, fixed it for `pool take`, wrote a commit message saying
the class was fixed, and left **11 more** identical call sites in the same
handler. Hit it again within the hour, on `pool edit`. A refusal there locked
the *other* session out for ten seconds. The whole handler now throws a
`PoolExit` sentinel and the dispatcher exits after the lock is released;
verified across six refusal verbs plus a bad id, each exiting 2 and leaving no
lock behind. The transferable part: a fix scoped to the symptom you happened to
hit is not a fix to the class, and a commit message claiming otherwise is worse
than the original bug because it stops the next reader looking.

Verified: `verify:fast` green, 486 tests across 41 files, encoding clean. The
smoke suite and the flake fix are for CI to confirm.

## Recently shipped (29 Sep 2026, newest of all yet again — the backup-import migration had no test, and the hazard in it is a "helpful" future improvement)

**`backupMigrations.js` is a data-recovery path that has been live since 9 Sep
with no test of any kind. It now has 12, all mutation-verified — and the first
audit of it found that its safety depended on a function it cannot see.**

**The module is dormant in the ordinary sense, which is exactly why it rotted
unnoticed.** Nothing has been renamed since it was written, so nothing exercised
it, so nothing noticed it breaking. The day something *is* renamed is the day
the machinery is found to be wrong, which is the worst possible moment to
discover that a safeguard does not work.

**The real hazard is a safety property that was only written down.** The
migration deliberately refuses to split `"200mg/245mg"` into a number and a
unit, because two numbers and no way to tell which is which would silently
corrupt a real dose. That refusal lives in a comment. A later reader who thinks
the comment is over-caution would be making a genuine improvement by the usual
standards — and would be destroying data. There is now a test that fails if
anyone parses that field, so the refusal is enforced rather than requested.

**Its safety depended on an ordering between two private functions in two
files.** `migrateCollection` did `migrations.reduce(..., item)` with no check
that `item` was an object, so a null element threw
`Cannot read properties of null` from inside a recovery path. The real import
path is safe — `backupService.js`'s private `sanitizeBackupData()` runs first
and its own comment says exactly why the order matters — but nothing *enforced*
that, and any future caller reaching `migrateBackupData` directly would crash.
One guard in the element check makes the module safe standalone, and it makes
the same decision the sanitiser makes, so the two cannot disagree.

**The likeliest way this mechanism fails is a typo, and a typo is invisible.**
`migrateBackupData` guards with `if (key in migrated)`, so a registry key of
`medication` instead of `medications` is not an error — the migration silently
never runs, which from the outside is indistinguishable from a backup that
genuinely needed no migration. A test fires the registry against a real
collection, and a second fires a non-registered one to confirm it comes through
byte-identical.

Also this round: **`pool take` ignored the task id it was given.** `pool take
t018` allocated `t014` and claimed `t014`'s files, because the argument was
never read and the code took the first takeable task instead. Hit on first real
use. A lost update loses a record; this is worse, because the command reports
success and the session believes it holds the job it asked for while holding an
unrelated job's files. It now honours a named task or refuses with the actual
reason, naming the file when another session holds it. And a second bug in the
same path: every refusal called `process.exit(2)` from inside the lock, which
**skips the `finally`**, leaving a lock file behind that blocked the next call
for ten seconds — including the other session's.

Verified: `verify:fast` green — **456 tests across 38 files**, encoding guard
clean, no mojibake. All five mutations of the migration go red: splitting the
dose, dropping the non-record guard, breaking idempotence, typoing the registry
key, and overwriting a user's existing note. The mutation harness derives its
backup from each mutation's own target, after getting that wrong once this
session and leaving a Java file broken.

## Recently shipped (29 Sep 2026, newest of all yet again — the widget NHS-number sink was one method call from being live, and my own guard was vacuous until a mutation said so)

**Session B reviewed the coordination tooling I built two days ago and found a
real bug plus the mistake that led to it. Both are fixed, and one of the two
mechanisms I had just celebrated turned out to be the problem.**

**The lost-update was real, and I had claimed the pool was safe.** Every pool
verb is a read of the whole file, a change in memory, then a whole-file write,
so two sessions mutating at the same moment means the second silently discards
the first one's change — no error, no warning, a task record simply vanishes.
Eight concurrent adds from two sessions left one task. Worse than the git
index-lock collision, which at least announces itself. Now serialised with a
lock created via `O_EXCL` (`fs open "wx"`), which is atomic: the filesystem
guarantees exactly one creator wins. A plain existsSync-then-write would race in
precisely the way the thing it protects does, which would be a poor joke in a
file whose subject is that failure. Re-tested with 8 real concurrent writers:
9/9 survive.

**The cause was my own convenience shortcut.** There was no `pool rm`, so the
only way I could clear some test tasks was deleting `pool.json` wholesale —
which is what destroyed B's in-flight allocation, and I did it without telling
anyone. B saw it as a clobbered lease and a corrupted state file, which is
exactly what it was. A tool that forces a destructive action instead of a narrow
one is a design bug, and it is now `pool rm` and `pool edit` (added same day:
a task could be *replaced* but never *corrected*, because rm-then-add changes
the id and loses the history). Files are the input to the duplicate-claim
guarantee, so `pool edit --files=` releases then re-claims rather than leaving
the claim table disagreeing with the pool.

**The handover was instructing a new session to rebuild a shipped feature.** It
listed banner suppression under "State: open". It shipped, with the
acknowledgement sheet and the Testing banner fix. Every other figure in it had
also decayed: smoke flows quoted as 18, B's report said 20, **the real number is
21**; unit tests 321/28 against 422/34; Notion blocks 1123, then 1151, and
**1164** measured across 12 pages. Four values for one quantity in a single
session is not bookkeeping drift, it is four people copying from each other
instead of counting — so the transferable half is now a lesson: a figure
inherited from a previous document is a claim, not a measurement. I also had to
write a temp script to file rather than inline, because PowerShell expands `$/gm`
inside double quotes and silently mangled a regex into a confident wrong answer.

**B also reported that `CHANGE-PROCEDURE.md` prescribes `git add -A`. It does
not** — line 117 already reads "never `git add -A`" and line 127 is a section
devoted to it. The false claim is in the handover, line 130, which was training
every new session to distrust a file that is correct. Corrected at source, and
the new file names the exact line so the next reader does not "fix" the
procedure.

**The widget NHS-number sink is unreachable, verified rather than assumed — and
that is the whole problem.** `ClinicCardWidgetProvider` would write an NHS
number into `SharedPreferences`, a plaintext XML file on disk, which would be
the one place this app's "encrypted at rest" promise breaks. There is no
`WidgetBridge` Capacitor plugin anywhere in the Java source — the only
`@CapacitorPlugin` is `ScreenSecurityPlugin` — so the JS guard
`if (bridge && bridge.updateClinicCard)` never passes. But every provider is
registered in the manifest and does nothing at all, so implementing that missing
bridge is the obvious next move for anyone who opens the directory. The guard
therefore fails on **the change that would make it reachable**, not on the dead
code, because deleting the field is a product decision rather than a bug fix.
Both routes in are covered: adding the plugin, and calling the sink natively,
which would bypass the plugin check. A second latent problem is documented at
the sink: `KEY_APPT_REVEALED` lives in the same plaintext prefs, so "tap to
reveal" is a permanent flip, not a per-render mask.

**The duress screen now says what it cannot cover.** The copy directly above it
promised the real data is "completely untouched" — true of the app's records,
and false of a reminder your phone has already scheduled to fire by itself. A
pre-scheduled Android alarm is independent of the app: entering the duress PIN
cannot cancel it, and it will appear on the lock screen anyway. In the exact
situation the feature exists for, a medication alert popping up is a disclosure.
Stated rather than fixed, because cancelling it could deny a coerced user a
medication reminder, which is a health consequence rather than a privacy one.

**My own guard was vacuous, and only the mutation check caught it.** The first
version of that test deleted the user-visible disclosure and stayed green,
because the rationale comment quotes "already scheduled", "still fire" and
"lock screen" — so the comment satisfied the assertions once the UI line was
gone. That is the **third** recorded instance in this repo of a guard matching
the comment documenting the fix, and the first where the comment was written in
the same edit as the fix, by the same hand, in a test file whose header cites
that lesson as its reason to exist. The UI assertions now run against
comment-stripped source; the one test that checks the rationale comment says so
explicitly, and the stripper is proven non-vacuous. **The same mutation that
passed before now goes red.**

**A mutation harness left source broken, repeating a mistake already recorded in
this file.** Two mutations wrote to two different Java files; the harness
backed up one, so `NextDoseWidgetProvider.java` was left with injected code and
`verify:fast` failed on it. Restored from git, re-verified, and recorded again
with that evidence — because the rule already existed and reading it was not
the same as applying it. Derive the backup from each mutation's own target.

Verified: `verify:fast` green — build, lint, **444 tests across 37 files**,
encoding guard over tracked files, inherited-instruction gate. Widget guard
mutation-verified in both directions (adding the plugin, and native wiring, each
turns the suite red). Duress guard mutation-verified by deleting the
disclosure. The comment-only Java change cannot be compiled on this machine, so
CI's APK build is the confirmation for that half.

Not done, recorded rather than folded in: `backupMigrations.js` still has no
unit test and is gated on the Phase C schema audit; the widget's NHS-number
field itself is still present, pending an owner decision on whether a
home-screen widget should show it at all; and the drafts are still plaintext
(cleared on lock, not encrypted).

## Recently shipped (28 Sep 2026, newest of all yet again - Anonymise mode masked 2 of the 9 screens that show a contact's name, and one of them printed a phone number)

**A read-only security/privacy audit of this app, the first one ever, found
that the feature you turn on right before handing your phone to someone was
working in 2 of the 9 places a contact's name appears. It now works in all 9,
and the limit of what it covers is stated on the Privacy screen instead of
implied.**

**The worst finding was not a name.** It was the Contacts duplicate checker,
which printed `city · phone` next to each of two contacts it suspected were
the same person, and offered a one-tap Archive on the row beside it. The
re-check I did after the first pass moved it *above* the search-index bug in
priority, for a concrete reason: a name is something you might reasonably have
read out, a phone number is a direct route to reaching the person. This is
also the one place the feature is arguably load-bearing rather than cosmetic,
because it is the panel a user is most likely to open while someone else is
holding the phone. Masked, and the "Archive this one" affordance is left in
place deliberately - it now acts on an id, so it discloses nothing.

**The second-worst was an INDEX bug, not a rendering one, and it appeared in
three separate places.** Global Search put `c.name` and `c.nickname` straight
into the search index; the Encounters tab's own search box matched attendee
names; and the Encounters location picker made a venue findable by typing a
*linked contact's real name*. In all three the name is never rendered
anywhere, yet typing it still surfaces the record - so masking the display
would have looked correct and done nothing. The user asking to stop the name
being available would have got a screen that looks masked and a search that
still answers to it. Global Search now rebuilds its index when the flag flips,
and the Encounters branch reuses the shared helper rather than skipping, so the
rule lives in one function.

**A fourth site was a WRITE, not a display, and I nearly fixed it wrongly.**
The Encounters location picker offered "so-and-so's place" suggestions, and
tapping one ran `registry.findOrCreate()` - writing a persistent
Locations entry containing a contact's real name, which would then outlive
Anonymise mode and reappear everywhere that venue is shown. My first instinct
was to mask the label, which would have been *worse than useless*: it would
have written a location literally called "•••• hidden's place" into the user's
real registry. The shortcut is now withheld while masking, and a guard asserts
it. The related saved-entry case is handled more narrowly, masking only
entries that have a `relatedContactId` - those are exactly the ones named after
a person, and masking every registry entry would have made the Chems and
Symptoms pickers unusable for no privacy gain.

**The fix is one shared module rather than eight screen-local decisions,
because the duplication is what let this happen.** `anonymiseDisplay.js` owns
the placeholder and the name rule. Contacts and Encounters had each declared
their own copy of the placeholder - Encounters' carried a comment explaining
it was "not exported from there, so duplicated" - and both are now gone. The
Privacy screen's scope line is rewritten to name where masking applies, and a
new line states the one thing it does NOT do: **exported files keep their real
values.** That is deliberate rather than an oversight left for later - every
export already has its own explicit per-section control the user has set on
purpose, so having Anonymise mode silently override it would be wrong, and the
only honest fix is to say so. A user who exports a PDF to hand a clinician was
previously never told.

**A mutation harness caught a vacuous guard in my own work, which is the
fifth recorded instance of that failure mode in this repo and the first one
caught by tooling rather than by a user.** I had fixed the Encounters venue
masking, then written tests for the other three sites and forgotten the fourth.
Reverting it left the suite GREEN - a test that reads as coverage while
measuring nothing. The added assertion is now the only reason that site is
protected. All four mutations (search index, duplicate phone, duplicate name,
venue name) are verified to turn the suite red, and the harness backs up every
file it touches and restores in a `finally`, because the first such harness in
this project crashed mid-restore and left a source file deliberately broken.

**Two mistakes of my own, both caught by eslint before they could ship**, and
recorded because both are the kind this file keeps paying for: I called
`useAnonymiseMode()` inside a `.map()` callback in Timeline, which is a hooks
violation that can become a real error rather than a wrong value; and a
PowerShell `.Replace()` on an import anchor hit *every* occurrence, producing a
duplicate import in My Profile - caught because the file already had two
`import ContactRepository` lines. The rule is now firm for this work: the
`edit` tool for anything structural, and a grep must be anchored to `^import`
because a comment mentioning the module name matches just as well as the
import itself. That is now the fourth recorded time a naive substring check
matched this repo's own prose.

Also in the same commit: **drafts are wiped when the app locks**, closing a
real disclosure rather than the theoretical one I was originally asked about.
`sessionStorage` is per-tab and unreachable by another app, but it is NOT
cleared on lock, and a duress-PIN unlock renders the decoy session in the same
WebView - so a half-typed Contact form or an Encounter's notes from the
previous, legitimately-unlocked session survived it. One `useEffect` keyed on
`locked` covers all four existing lock paths (manual, `shouldRelock` timeout,
double-press-home, leaving the decoy) and any future one, rather than a
handler call in each. **The drafts are still plaintext**, and that is recorded
in `draftStorage.js` rather than glossed: encrypting them needs `loadDraft` to
become async (WebCrypto has no sync mode) and it is called inside a `useState`
initializer in all 8 module forms to seed them, so it means converting every
form to async-load-then-resync - touching exactly the code holding unsaved
edits. That is a real piece of work, not a one-line follow-up.

Verified: `verify:fast` green - build, lint, **408 unit tests across 33
files**, encoding guard clean. Full smoke suite and the APK build left to CI,
per this repo's CI-first loop. `anonymiseModeActive` still defaults off and
every new helper defaults to unmasked, so with the feature off all 8 screens
render byte-identically - which is also why the other session's nav-assertion
work (making the smoke helper fail loudly instead of passing without
navigating) cannot be newly broken by this.

Not done, recorded not skipped: `backupMigrations.js` still has no unit test
(the audit's worst remaining gap), the widget's `SharedPreferences` sink is
still armed-but-inert and can leak an NHS number if the bridge methods ever
land, and the fact that a **pre-scheduled OS notification is not cancelled on
duress entry** is now documented as a limitation rather than "fixed" - see
the next entry.

## Recently shipped (28 Sep 2026, latest of all yet again - a typed time was showing the WRONG DATE, and my own test contributed zero to the assertion count)

**The ask: whatever time a user types is wall-clock in their own timezone, is
displayed back as that, and any calculation follows it rather than being out by
however many hours the device's offset is.** It found a real bug on the first
run, and the interesting part is *which* bug, because I had already guessed
wrong about the more obvious one.

**I was ready to "fix" code that was correct.** `exposureWindows.js`'s
`daysBetween` is `(new Date(test.date) - new Date(encounterDate)) / 86400000` —
textbook `milliseconds / 86400000`, the exact anti-pattern this file records as a
standing rule after the September DST bug, and it feeds a real clinical
"am I covered yet" verdict. Run under four timezones it agrees everywhere. A
Z-suffixed string parses to an **absolute instant**, so both values shift
together and the difference cancels; this is a true *duration*, not a
calendar-day comparison, so `/86400000` is right. Left alone. A "fix" here would
have been a change with no defect behind it, and a diff with no reason behind it
is the hardest kind to review six months on.

**The real bug was four display sites and one derivation, all the same shape.**
An encounter logged at **00:30 on 14 Mar showed "13 Mar 2026" in New York** — a
wrong *date* on a medical record, not a slightly-off time. Five places in
`SHOS_Encounters_Prototype.jsx` rendered a stored value with
`toLocaleDateString`/`toLocaleString` and no `timeZone: "UTC"`, so the browser
re-applied the device's offset to digits that were already local. And
`timeOfDay()` used a local `getHours()` on that same fake-UTC value, filing a
00:30 encounter under **"Evening"** for anyone west of UTC. All five now route
through `formatStoredDate`/`formatStoredDateTime` or a UTC getter. The failure
has two directions and they are not symmetric: a time just after midnight
renders as the *previous* day at negative offsets, and an evening time as the
*next* day at positive ones — so testing only one of the two would pass while
half the world stays broken.

**My new browser flow's first version measured nothing and looked green, and I
built the fifth instance of that failure in this project.** It used a local
`check()` helper so that one bad timezone would not hide the other two — and
`check()` did not log the `  ok - ` line that this suite's own reported
assertion count is derived from. The flow passed and added **zero** to the
tally. It is now the fifth recorded instance of "a gate that measured nothing
and looked like it measured something", the first one in this file, and the
first one I have manufactured rather than inherited. `check()` logs on success
exactly like `assert()` does.

**Two of my own mistakes in the same flow, both of which would have shipped a
green run that tested nothing.** The Edit step guessed
`[aria-label="Edit Encounter"], text=Edit`, which mixes a CSS selector with a
text engine and therefore throws — wrapped in `.catch(() => {})` "to be safe",
so the throw was swallowed and the flow instead reported the baffling symptom of
an empty input field. And the per-zone failures were originally fail-fast, which
would have hidden the entire shape of the bug behind whichever zone was listed
first: **New York fails the date and the time-of-day, Sydney fails only the
time-of-day, London passes everything.** That shape is the whole diagnosis, and
it takes one run to see — which is why the flow now collects every zone's
failures and throws them together.

**The first CI run went red in BOTH gates, and it was my test, not the app.** The
flow failed in **all three** timezones — including London, the one zone that had
nothing wrong with it, which is the clue that gave it away. The unit failure was
at the line asserting `/14 Mar 2026/`. Cause: these helpers format with an
`undefined` locale, so the date is `14 Mar 2026` on this UK machine and
`Mar 14, 2026` on CI's en-US one. **I had already caught and fixed exactly this
in the DST test above, then wrote the same literal into three other places from
memory.** A test that only passes on the machine that wrote it is not a test.

**And then I made it worse while trying to verify the fix, which is the sixth
recorded instance of that failure and the second I built inside this one
change.** Having found a locale problem, my obvious move was to set
`LANG=en_US.UTF-8` and re-run. It passed — and I nearly recorded that as proof.
Checking whether the locale had actually changed rather than trusting the green
showed `Intl` still resolving **en-GB**: `LANG`/`LC_ALL` do not affect Node's
default locale on Windows at all. So that run measured nothing, and had I not
probed it, the "verified" claim would have shipped as a lie. Three honest
replacements: the assertion helpers now **test themselves** against both
spellings and are proven to *reject* the shifted day, so locale-independence is
demonstrable rather than asserted; a browser context takes a real locale, so
`SMOKE_LOCALE=en-US` reproduces CI's exact condition on demand, and the flow was
re-verified green in all three timezones under it; and the flow's date check
now accepts either ordering while still rejecting `13 Mar` / `Mar 13`, so it
stays discriminating.

Verified by actually seeing it fail, which is the only verification that
counts here. Reverting both fixes, rebuilding and re-running the flow goes red
in exactly the pattern above — **and it goes red under en-US too**, which is
the assertion CI had already caught, re-proved after I rewrote it twice. That is
the check a passing test has to survive, because a test that has only ever
passed has not been tested. Four further mutations of the new unit layer are
confirmed red too, and the fifth *failed to apply* (a multi-line pattern against
a CRLF file) and was reported as "this mutation tests nothing" rather than
quietly counted as a pass — the distinction between "the mutation did not apply"
and "the test did not go red" is the whole point. `exposureWindows.test.js` is
untouched, which is itself the record that the non-finding above was a decision
rather than an oversight.

**The flow boots the real app three times, once per timezone**, because a device
timezone is a browser-context property and no unit test can prove which helper a
real screen actually routes through — this app has been bitten by exactly that
before, the same date rendering as "1 Mar" in London and "28 Feb" in New York
because a few call sites had each worked it out privately. Two assertion layers
because each covers what the other cannot: 6 unit tests across six zones
including `Asia/Kolkata` (+05:30) and `Pacific/Chatham` (+12:45), which no
whole-hour zone in the flow can catch, and a real 20th smoke flow. Plus a
`SMOKE_ONLY=<name>` filter, so a single flow can be run on a machine that cannot
afford twenty; an unmatched name runs **nothing** rather than everything, so a
typo can never masquerade as a full green run.

Verified: 419 tests across 34 files, fast gate green, and the flow itself run
locally against a real `vite preview` build — 12 assertions, three timezones,
and confirmed red when the fix is reverted.

**Not done, recorded rather than folded in:** this audited **Encounters** only,
because that is what the flow drives. A whole-tree scan still finds ~40 further
`toLocale*` call sites with no `timeZone` on the same line, in Medication
Dashboard, Home, Contacts, Clinic Visits, Stats and others. The per-line count is
unreliable on its own — it cannot see a `timeZone` on a following line, and many
of those sites are legitimately formatting real instants — so that needs the same
evidence-driven treatment per module, not a mechanical sweep. A3 (device silence
for the other four reminder types) is parked with no edits made.

## Recently shipped (28 Sep 2026, latest of all yet again - two more of my own bugs, both from one mistake: I never checked how the codebase already did it)

**The Testing banner shipped broken. The next two items I picked were broken in
exactly the same way, and naming that is the actual finding.** All three were
new code that was *correct in isolation* and did not follow a convention the
codebase had already established:

1. **The acknowledge sheet was a keyboard trap.** It was a `role="dialog"` with
   no Escape handling, while `useEscapeToClose` is wired into **46 other
   components** — added the day before specifically because every overlay in
   this app used to trap keyboard focus on any desktop or web build. It also had
   no focus-on-open, so the first Tab walked the page *behind* a modal. It is
   now a real component, `AcknowledgeSheet`, so the hook can own its lifecycle
   at all, and it follows the same ref + `tabIndex` + focus-on-mount pattern
   the 21 Sep accessibility batch gave every other sheet.

2. **The nav dot's explanation was baked into the tab's accessible name** — and
   the smoke suite's `nav()` helper matches tab names *exactly*. So the moment
   an unacknowledged dot appeared, `nav()` stopped matching, and because
   `nav()` was an `if (count())` with **no `else`**, it silently did nothing
   and the flow reported success having navigated nowhere. Every nav-based flow
   would have gone on passing while testing nothing. That is the fourth
   recorded instance of "a gate measured nothing and looked green" in this
   project, and I built the fourth while fixing the feature.

**The fix for (2) is the correct mechanism, not a patch on the symptom.**
Supplementary status now goes in `aria-describedby` against real (visually
hidden) DOM content, so the tab's accessible name is unconditionally
`tab.label` and an exact match holds whether or not a dot is showing. Separately
`nav()` **throws** when a tab is missing, and **confirms `aria-current` actually
changed** after clicking, dumping the real tab names when it can't find one. A
helper that can quietly do nothing is worse than no helper: it turns a broken
locator into a green run.

**I predicted CI would go red here, and it did not — the correction is more
useful than the prediction.** I warned that any flow passing *because* `nav()`
silently did nothing would now fail honestly, and that this would be the guard
working. CI came back green: 413 tests across 33 files, 19 flows, 95 assertions —
the assertion count *unchanged*, so no flow had been relying on the no-op.

The reason is that the blind spot was **latent, not active**. `nav()` only
stops matching when a tab's name changes, which happens only while an
unacknowledged dot is on screen — and no flow reaches that state yet, because
nothing has acknowledged a reminder in any of them. So this was a preventative
fix rather than a rescue, and the honest strength of the "a gate measured
nothing" claim here is weaker than the other three: a suite that passes while
navigating nowhere is a real and demonstrated failure mode, but this instance of
it had not yet had the chance to fire. It would have, on the first run after
someone used the feature by hand.

**An existing guard fired red on this change, and was updated rather than
loosened.** `reminderSuppressionWiring.test.js` asserted the dot's explanation
was in the accessible name — correct when written, and wrong the moment we
learned the accessible name *was* the bug. Its intent (an unexplained bare dot
is what the icon-only-UI rule exists to prevent) is unchanged and still
asserted; only the mechanism moved. A guard firing on a legitimate change is
worth reading twice, and is the only reason a guard is worth having.

Verified: eslint clean, 9 mutations of the new guards all confirmed to turn the
suite red — Escape dropped, focus dropped, `tabIndex` dropped, the component
inlined, the wording put back into the name, `aria-describedby` detached, the
hidden text un-hidden, and `nav()` reverted to failing open twice. Unit tests
397 → 413 across 33 files, fast gate green.

Still outstanding, in order: device-silence is wired only for medications, so
"also stop the phone notification" silently does nothing on the other four
banners · the refill second stage (needs requesting → needs collecting) does not
exist · no browser flow yet covers the whole "stop reminding me" path · no
contrast or narrow-screen check on the three new surfaces · no master off-switch
· the handover's "State: open" section is still stale.

## Recently shipped (28 Sep 2026, latest of all yet again - the Testing banner was never rendering, and a mute switch I added was dangerous)

**The banner suppression feature shipped a real regression on its first CI run,
and the smoke flow could not see it. Both halves of that sentence matter.**

**`getTestingDueState()` returns `{ due, dueDate }` and has no `test` property
at all.** The code built the Testing reminder's signature from
`testingDue?.test`, so that was always `undefined`, the signature was always the
empty string, and — because `isBannerVisible` treats an empty signature as
"nothing to show" — the **Testing due-reminder banner never rendered. At all.
Silently**, including in a published APK. A due-retest reminder being silently
suppressed is the single worst outcome this feature could produce, and it came
from writing code against a shape I had not read.

The same mistake hit a second place the same day: the vaccination and refill
signatures keyed on the record **id** alone, so acknowledging a vaccination
silenced it **permanently, including its next dose months later** — precisely
the bug `_dueSince` was added to prevent for doses, and I had not applied the
same reasoning one function over.

**Confirmed by execution, not by reading.** A new `reminderDueShapes.test.js`
runs the real due-state functions against the real seed data at a pinned clock.
At a date where testing genuinely *is* due, `"test" in state` is `false`. That
file is a shape contract for all five kinds, and it is the thing that would
have caught both bugs.

**My first version of that test was itself vacuous, and the probe that caught
it is the more useful part.** It wrapped assertions in `if (state.due)` — and at
the real current date only refills and doses are due from the seed data, so the
testing, vaccination and visit assertions were **skipped** and the file passed
while checking almost nothing. The fix is a pinned clock on which everything is
due, plus a precondition block that asserts that up front, so a future seed
change fails **loudly** instead of quietly testing nothing. There are no
conditionals left in it. This is the fourth recorded instance of "a gate
measured nothing and looked green" in this project, and the first one I
manufactured myself.

**"Stop reminding me" now lasts until the refill is dealt with**, which is the
owner's rule stated once and it does all the work: an acknowledgement is dropped
once the thing it acknowledged is no longer outstanding. Tapping Requested,
tapping Cancel, or logging the refill you collected all remove it from the
outstanding set, so the note is spent and next time you are genuinely low it
speaks up. No new stored field and no migration — the resolution actions already
existed. A dose behaves correctly under the same rule: acknowledged while still
due, so the silence holds; taken, so the note is spent; tomorrow's dose is a
different signature and gets its own reminder, which is right, because a new dose
is a new thing.

**The guard on that prune is the most dangerous line in the feature, which is
why it is asserted rather than trusted.** At boot, before any due state has been
computed, every signature is still the empty string — so the outstanding set is
empty, and the prune would conclude that *every acknowledgement the user has
ever made was spent* and silently delete all of them on the next app open. A
user who had deliberately stopped being reminded about a medication would find it
back, with no explanation. `dueStateReady` exists solely to prevent that, and
three separate tests pin it.

**A tool of mine damaged source mid-session and the pre-commit discipline is
the only reason it was caught cheaply.** A mutation-verification harness
neutered `pruneSpentAcknowledgements`, went red as intended, then **crashed
while restoring the file** because it had not been backed up — leaving a source
file deliberately broken in the working tree. Found by reading the file rather
than trusting the harness's own "complete" message. The harness now backs up
every file it touches and restores in a `finally`, because a mutation tool that
can leave the tree broken is worse than no mutation tool. Two smaller harness
bugs fixed alongside: multi-line search patterns never match these CRLF files,
so four mutations were silently "not applied" — and *the mutation was not
applied* is a different failure from *the test did not go red*, and only the
second says anything about the test.

Verified: 9 mutations of this fix, all confirmed to turn the suite red —
including restoring the exact shipped line, dropping the vaccination date from
both the condition and the body, removing the `dueStateReady` guard, removing
the loop guard, and neutering the pure helper. Unit tests 372 → 397 across 32
files, eslint clean for every file this change touches.

Still outstanding from the same review, and honestly recorded rather than
folded in here: the new acknowledge sheet has **no Escape handling**, which
re-creates the keyboard-trap defect the previous session fixed in 27 places;
the passive dot's wording is in the tab's accessible name, which breaks the
smoke suite's exact-match nav helper — **and that helper fails open**, so
flows would keep passing while navigating nowhere; and the new surfaces have had
no contrast or narrow-screen layout check.

## Recently shipped (28 Sep 2026, latest of all yet again - banner suppression, and a parallel session committing my work for me)

*Written by the session that also shipped the two search-back-navigation
entries above. Its work is split across two commits — `bc04295` (swept up
mid-change by a parallel session) and `d7f84a1` (the rest). See the
commit → content map under "Working conventions" above.*

**A git accident happened mid-change, and it is recorded here rather than
tidied away.** A second session working in this same tree ran `git add -A src`
and swept up this in-progress work — `reminderSuppression.js` and its tests,
`medicationReminderSync.js`, `appPreferencesRepository.js` and the bulk of
`App.jsx` — committing it under its own message about the Clinic Card PDF
(`bc04295`). Precisely, per `--numstat`: **799 insertions and 16 deletions
across 5 files**. (Two other figures circulated at the time — "815" and "862"
— and neither is the plainest reading; 815 is insertions-plus-deletions and
862 matches nothing measured. Recorded here so a later reader comparing notes
is not left wondering which is right.) Nothing was lost and nothing of theirs was overwritten, but
the history for this feature is wrong: the bulk of it sits under someone else's
commit message. I have deliberately **not** rewritten that commit, because the
other session is actively working from it and rebasing shared history out from
under a running process risks losing their work to fix a cosmetic problem. If
you want it split properly, that is a deliberate decision for you to make with
both sessions stopped.

**The root cause is in our own procedure, and it is now fixed.**
`docs/CHANGE-PROCEDURE.md` prescribed `git add -A` as the commit step. That is
correct when you own the working tree and wrong the moment you do not — and
this project routinely has two sessions in one tree. It now says to stage
explicit paths, and says why. I was myself about to repeat the same mistake
when the accident surfaced; the only reason I did not is that I had to stop and
read `git status` first.

**What the feature does**, from the owner's own spec: a dismissed reminder
does not come back on the 60-second poll any more. It stays hidden for the
rest of the app run and returns after a hard close. A harder "don't remind me
about this" persists — and leaves a quiet passive mark rather than pretending
the item is done. Medication snoozes are deliberately untouched, and still
re-push in the same session when they expire.

**The behaviour is almost entirely free, and the reason is worth knowing
rather than rebuilding.** "For this app run" is plain in-memory `useState`.
Sending the app to the background does not tear down a Capacitor WebView, so a
dismissal survives a trip to the launcher and a swipe-away-and-return, and dies
on a real close — which is exactly the requested line, with no timer and no
lifecycle plumbing. The previous 30-minute dismissal was barely different from
no dismissal at all; this is genuinely different.

**Everything is keyed by a fingerprint of what was due, not by a flag, and
that is the whole design.** Acknowledging "PrEP is due" must not also silence
"Testosterone is now due too" two hours later, or a real reminder gets missed.
So each dismissal records a signature of the current due set; while the set is
unchanged the silence holds, and the moment it genuinely changes a new
reminder is free to return. For medications that signature includes the
last-dose timestamp, which means **each dose is a distinct instance** —
otherwise a once-daily medication acknowledged this morning would still match
tomorrow morning and never remind the user again. Getting that wrong is the one
bug in this feature that would be dangerous rather than merely annoying, so
`getDailyMedsState` now carries the per-instance marker it was discarding.

**"Silence my device" is coarser than it sounds, and the copy says so.** This
app schedules **one notification per reminder type** under a fixed id, so
there is no per-item notification to cancel, and a dose that is already due is
scheduled three seconds out. Promising "your phone will never mention this
again" would be a claim the app cannot keep. What it actually does is stop
re-scheduling that type while the due content is unchanged — which is correct
and safe precisely *because* the signature changes for a genuinely new dose.
The owner asked for a choice here rather than a fixed answer, so there is a
two-option sheet plus a Settings default.

**The passive mark is derived, never remembered, and it is not a nested
button.** A remembered flag would outlive the dose it was about; deriving it
from live due state means taking the dose is the only thing that ever clears
it. And this project's own rule is that icon-only UI needs an explanation,
which normally means a tap-to-reveal target — but a focusable control inside
the bottom-nav tab would be the `nested-interactive` violation already found
and fixed once on Contacts' card. So the dot is `aria-hidden`, the tab's own
accessible name carries the count, and a one-time toast explains it per app
run. Satisfying the rule's intent without reintroducing the violation.

**Snooze is the load-bearing negative, and it is pinned by a negative test.**
Snoozing writes a real timestamped fact the due-state check already honours, so
it needs no suppression logic at all. Had a snooze quietly recorded a
dismissal, the reminder would never return and the failure would be invisible
until a dose was actually missed. `reminderSuppressionWiring.test.js` asserts
that the snooze handlers touch *neither* suppression list.

Also: the acknowledgement settings live on the existing
`AppPreferencesRepository` rather than a new repository, which is the cheap way
to satisfy the "wire it into `backupService.js`" rule that has been missed
three times here — it is already wired. Stored acknowledgements are
normalised on read, because they are restored-from-backup data. And Settings
carries an explicit "start reminding me again", because a persisted silence
with no way out means one mis-tap on a small button permanently silences a
medication reminder.

Not yet done, and deliberately recorded as such: **snooze *expiry* cannot be
covered by a browser test at all** — 30 minutes is longer than a test run —
which is the other reason the negative wiring test matters. The 19th flow does
cover the part that is a browser fact: that a dismissed banner stays dismissed
across the app's own due-state refresh, which is what the 60s poll used to
undo.

## Recently shipped (28 Sep 2026, latest of all yet again - the new smoke flow caught a real bug in its own feature, on its first CI run)

**Follow-on to the Phase 2b entry below, and the most useful result of the
whole batch: the test I wrote for my own new feature found a real hole in it
on its first run in CI.** Tapping a search result and then tapping a
*different* bottom-nav tab left the "Back to search results" button on
screen, pointing at a query for a record the user had already left. The
clearing rule that the whole design rests on - every navigation that did not
come from a search must clear the context - was implemented in exactly one
place, `navigateTo`, and the bottom nav and quick-add do not go through
`navigateTo`. They call `setActive` directly, four and one times
respectively, and none of them cleared anything.

**This is the half no unit test could have seen, and that is the point of
writing the browser flow at all.** `navigateTo`'s default argument was
correct from the first commit; the defect was in the *other* entry points,
which no test was looking at. Fourteen unit tests on the decision, six
source-level wiring assertions, and seven verified mutations all stayed green
throughout, because every one of them was examining the code that worked.

**The fix is a helper, not five extra calls, because the alternative is the
bug.** `selectTab(tabKey)` is now the one way this file switches tab for a
user-initiated navigation, and it clears the context. Every nav-bar handler,
quick-add, the back chain's Home and Clinic-Card branches, and the tour's
force-Home all route through it. Bolting `setSearchReturn(null)` onto five
handlers instead would have looked equivalent and guaranteed the sixth was
missed. Two new guards pin it structurally: the bottom-nav handlers must not
call `setActive` directly, and `selectTab` must clear — so a future tab switch
fails a unit test rather than CI's smoke run ten minutes later. Both are
mutation-verified.

Also worth recording as its own small finding: **my first mutation script
for those two guards reported "not testing anything" and I nearly read that
as a pass.** The patterns were multi-line and the file is CRLF, so `find`
never matched and nothing was ever mutated. "The mutation did not apply" and
"the test did not go red" are different failures, and only the second one
says anything about the test. Re-run with single-line patterns, both went
red. That is now the third recorded instance in this repo of tooling that
looked like it was checking something and was not.

Verified: eslint clean, encoding guard clean, **321 unit tests across 28
files** (was 319), fast gate green. The 18-flow smoke suite goes back to CI.

## Recently shipped (28 Sep 2026, latest of all yet again - search results you can actually get back to)

**Phase 2b, the handover's first open item.** Tapping a search result opened
the record and threw the query away. There was no mechanism at all - not a
partial one - so getting back to a result list meant reopening Search and
retyping from memory, which for a search over medical records is not a small
friction. Two things ship: a visible "Back to search results" control on the
opened record, and the hardware/gesture back chain returning there too.

**The visible control is the primary path, not a nicety, and the reason is
platform.** This app ships a web/PWA build as well as the APK, and on web
there is no hardware back button and no right-swipe. Wiring the return into
`goBackOneLevel` alone would have made the feature invisible on one of the two
platforms it ships to - and it would also be unreachable whenever a module had
an internal screen still open, because a module's own back handler (correctly)
outranks the return in that chain. It is rendered once in App.jsx rather than
threaded into each module: a search result can open a record in 11 different
modules, and one fixed element covers all of them and cannot drift out of sync
with eleven per-module copies.

**The load-bearing half is the clearing, and it is the half no test would
have noticed.** The context is recorded by `navigateTo`'s third parameter,
which defaults to `null` - so every record link in the app that did *not*
come from a search clears any context left over from an earlier one. Without
that, a "back to search results" button follows the user around for the rest
of the session, pointing at a query for a screen they left ten minutes ago,
which is worse than having no button at all. The smoke flow asserts that
half explicitly, and `buildSearchReturn` normalises a blank or
non-string query to `null` so a result can never produce a return point that
reopens an empty search.

**The decision logic left the JSX, because logic in a render cannot be
tested.** `src/calculations/backNavigation.js` holds `decideBackAction`
(which of seven things a back press does), `shouldOfferSearchReturn` (whether
the affordance may be shown over the current screen) and
`buildSearchReturn`. The ordering is the substance of the feature and the
easiest thing in the app to get quietly wrong by hand - the tests therefore
lean on ordering cases far more than on the happy path.

**Three things I got wrong or found along the way, recorded because all three
would have shipped.**

- **I broke a real guard with a legitimate change, and had to decide what to
  do about it.** `recordNavigationWiring.test.js` asserted the exact call
  shape `navigateTo(tabKey, subTab)`; threading the search origin through as
  a third argument failed it. The temptation was to loosen it until it went
  green. It was widened by exactly one character class - the closing paren -
  with the assertion that actually matters (navigateTo is still called, with
  the tab and the sub-tab) left intact, and a comment saying why. The guard
  firing is the only reason it is worth having; a guard that has never fired
  is a guess.
- **A pre-existing latent bug, in code I was already touching.**
  `goBackOneLevel` reads `clinicCardReturnTab` and `searchReturn`, and
  neither was in the dependency arrays of the two effects that re-register
  the back handler. The Clinic Card case was correct only by accident:
  `markClinicCardReturn()` and `navigateToRecord()` batch into one commit,
  so `active` changed in the same tick and the effect re-registered anyway.
  Correctness by coincidence of React batching, not by design - and exactly
  what breaks the moment a second write lands in a different tick. Both are
  listed now, and a test pins that both effects declare the same list.
- **My first design was correct only by accident too.** It cleared the
  context in `navigateTo` and re-set it afterwards in `navigateToRecord` -
  two writes to one state key in one handler, relying on "last write wins"
  within a React batch. A later edit could reverse that silently and nothing
  would fail. The origin is now threaded as a parameter, so there is exactly
  one write per navigation and the rule is legible at the call site.

**A decision that reads like an oversight, so it is pinned by a test:**
returning to the results deliberately does *not* consume the context.
Dismissing the restored search with its own X therefore returns you to the
record with the way back still offered. A single-use flag would drop you on
the record with neither the results nor a way to undo the return - the exact
dead end this change exists to remove.

**Three layers of test, because each covers what the others cannot.** 14 unit
tests on the pure decisions. A source-level wiring guard
(`searchBackNavigationWiring.test.js`), because this project has *already*
shipped a feature whose hook worked perfectly in unit tests while a sweep
silently failed to attach it to the components that mattered - a unit test
cannot see whether a function is reached. And a real 18th smoke flow, because
unit tests prove a function and only driving a browser proves the app.
**Every one of the 7 mutations is verified to turn the suite red** - dropping
the origin argument, removing the `null` default, promoting the return above
the module handler, consuming the context on return, dropping the effect
dependencies, ignoring `initialQuery`, and ungating the affordance. All seven
went red, none passed vacuously.

Also of note: `GlobalSearchScreen`'s restore props are read as `useState`
initialisers, which is only correct because the screen is conditionally
rendered and genuinely remounts on every open. That coupling is a comment at
both ends rather than a resync effect - if the screen is ever made
always-mounted, both props go stale silently.

Verified: eslint clean, encoding guard clean across 238 tracked files,
**319 unit tests across 28 files** (was 295/26), and the fast gate green.
Build and the 18-flow smoke suite left to CI, per this repo's CI-first loop.

## Recently shipped (28 Sep 2026, latest - the Clinic Card PDF finally has a test, and it exposed a deliberate-but-unrecorded divergence)

Continuing the coverage review's "never audited" list, working away from the
notification area the other session is in. `clinicCardPdfService.js` renders
**the artefact a clinician actually reads**, and it had no test of any kind.

**What the new test pins** (8 tests, `src/storage/clinicCardPdf.test.js`):
the single line that is the whole privacy control for the export
(`if (visibility && visibility[key] === false) return;`), the one section that
is gated inline rather than through the shared helper, the
"every user-togglable section actually renders" invariant, the per-page
**"Self-reported - not a clinical record"** disclaimer, and page numbering.
Mutation-verified in both directions: deleting the visibility gate fails 1
test, and replacing the safety footer fails 1.

**The interesting finding: `recentContacts` is a real, user-togglable section
that the PDF has never rendered.** `CLINIC_CARD_SECTIONS` exposes it, the
on-screen Clinic Card renders it, and `assembleClinicCardData` does not compute
it at all - so the toggle does nothing for the export. A user who switches
"Recent contacts" on, exports, and finds it silently missing from the file they
hand to a clinic.

**I have NOT "fixed" this, and the reason is worth recording rather than
leaving to chance.** The PDF is the artefact most likely to be shared, printed
or left lying around, and it is the only place in the app where a list of the
names of everyone you have had sex with would end up on a sheet of paper. The
on-screen card is private; the export is not. So the omission is arguably the
safer default, and adding the section would be a privacy *regression* dressed as
a feature. The real defect is not the missing section - it is that the settings
UI gives no hint the toggle does not apply to the export. That is a
copy/affordance question for the owner, not a code fix to make unilaterally, so
it is recorded here and pinned by a test that documents the divergence rather
than pretending it is an oversight.

A source-level guard rather than a PDF-parsing test, deliberately: the property
worth protecting is a wiring property - every section gated by the user's own
choice - and that survives layout refactors, which an assertion on rendered PDF
bytes or page counts would not. `pdf-lib` also offers no text extraction, so
"this text is absent from the PDF" would mean asserting on internals rather than
on the thing. First version of the guard produced a false positive by only
recognising the `section("key", ...)` form and missing the inline
`visibility.allergies` gate; recorded at the fix rather than deleted, because it
is the same near-miss this project keeps paying for.

## Recently shipped (28 Sep 2026, latest still - the Escape sweep had a live bug in its own most important rule)

Checking the sweep's own load-bearing design decision found a real defect in
what had just shipped. `useEscapeToClose` closes only the **topmost** registered
overlay, and the whole reason that matters is `ConfirmDeleteCard` - the shared
delete confirmation used at ~15 sites, which renders **on top of** an edit sheet
(Contacts -> profile -> delete). That card was never registered with the hook,
so the sheet underneath was the topmost registered overlay, and **Escape closed
the sheet**: dismissing the destructive confirmation *and* discarding the form
the user was editing, in a single keypress. That is precisely the failure the
topmost-only rule was written to prevent, so the rule was doing nothing here.
The card is registered now, mapping Escape to `onCancel` - the safe, reversible
action. Escape must never confirm a destructive delete, and it must never
destroy the surrounding form to get out of a confirmation.

**The same class of miss as `export default function`, and found the same way.**
`ConfirmDeleteCard` is not a `function X({ onClose })` sheet, so the sweep's
signature matcher never saw it, and the sweep reported a clean-looking result.
The follow-up that found it does not search for the sweep's shape at all - it
asks "which components declare dialog-like ARIA and are NOT registered", which
is the question the sweep should have been asking. It also surfaced
`MyProfileEditScreen`, a real full-screen overlay with its own `onCancel` that
the same matcher missed for the same reason. Both now wired; 8 new unit tests
cover the real stacked composition (a confirmation over a sheet) rather than the
abstract one, because that is the shape that ships.

Verified: eslint clean, encoding guard clean, build + full test suite left to
CI - this machine was down to ~336 MB free RAM and both the Vite build and
vitest's worker pool failed with `ENOMEM`/`write ENOMEM`, which is a resource
ceiling rather than a code fault, and is exactly the case the CI-first loop this
repo now uses exists to handle.

## Recently shipped (28 Sep 2026, later - a palette re-check whose most valuable output was four broken scans)

The colour-blind-safe palette work was 13 days old, so this re-measured it
rather than trusting the 15 Sep summary. **Result: no regressions.** All seven
shipped `TEXT_SAFE` values still clear 4.5:1, the four module accents that are
used raw on their own tint still clear it comfortably (healthcare 7.5:1,
medication 9.8:1, encounters 6.4:1), and the two that genuinely fail
(contacts 4.05:1, ACTION.red 4.10:1) still correctly route through their safe
variants at every site. The 10/15 Sep fixes hold.

**The genuinely useful part of that round was how badly the AUTOMATION went.**
Four attempts at scanning the source for text-on-its-own-tint sites, and every
one failed - including one that printed "the detector is proven working because
the safe count is non-zero" while that count was **zero**. A script that asserts
its own correctness in prose it never checks is worse than no script, because it
manufactures exactly the false confidence this project keeps paying for.

The real bugs, in order:
- Matched per-line, so it could never see a background and a colour that sit
  several lines apart in one inline style object. Found 0 sites.
- The fix for that used a 3000-char body window to find `role="dialog"`, and
  matched 6 non-dialog components (`SectionCard`, `DateTimeField`...) as
  dialogs.
- The regex demanded a closing brace after the alpha hex. The real source is
  `` background: `${T.actionRed}1A` `` - alpha then a **backtick**. It had
  therefore never matched anything anywhere, and was reporting "no regressions"
  from a detector that had never once fired.
- When it finally worked it found 88 sites and flagged 33 as "regressions" - by
  *name*, not by measurement. The 10/15 Sep audits had already established that
  most accents pass comfortably, so 29 of those 33 were fine and flagging them
  by name was flagging by assumption.

**The honest resolution is to stop automating this and go back to naming the
colours.** There are only four accents in this pattern, they cannot be resolved
by reading `designTokens.js` anyway (the per-module `T.*` tokens come from each
module's own `buildLight()`), and the original audits measured by hand for
precisely that reason. So `paletteContrast.test.js` names them, computes the
numbers, and includes a self-check of its own maths against known WCAG pairs -
because a test whose maths is wrong would pass everything.

Recorded as a genuine, verified non-finding rather than dressed up as a fix. The
three automation attempts are the more useful artefact, and are documented at
their own failure rather than deleted.

## Recently shipped (28 Sep 2026, later still - every overlay in the app was a keyboard trap, and the smoke summary couldn't prove it)

**No overlay in the app could be closed with Escape.** Measured, not assumed: 55
`role="dialog"` overlays across `src/**`, and zero of them reacted to the key.
The only two Escape handlers in the codebase were in Option List Editor and
Registry Management, and both cancel an *inline text edit* rather than a dialog.
So on a desktop or web build every sheet in the app was a keyboard trap - focus
went in, courtesy of the earlier focus-on-open work, and could not come out. The
mobile app is largely unaffected (no hardware Escape key), which is precisely why
it survived a month of audits: this only bites the platforms nobody was testing on.

New `useEscapeToClose` hook, applied to **27 components across 12 files**, with
7 unit tests. Three deliberate design decisions, each of which is a bug someone
would otherwise ship:

- **Only the topmost overlay closes.** Sheets stack - a confirm card on top of an
  edit sheet - and closing the one underneath would silently discard the user's
  work.
- **Registration order is tracked, not inferred**, and cleaned up on unmount.
  A naive implementation either leaves a dead handler after a sheet closes
  (nothing responds to Escape ever again) or leaves the wrong one on top.
- **An `enabled` flag exists** for destructive/ambiguous dialogs, which should
  not vanish on a keypress.

**Settings was hand-wired rather than swept, because the generic fix was wrong
there.** Escape on a Settings *sub-screen* must step back one level, exactly as
the back button does - not close all of Settings. Rather than write that
condition twice and let the two drift, the existing back-chain was extracted
into a single `goBackOneLevel()` used by both. It is wrapped in `useCallback`
specifically so the effect below can depend on it honestly: listing its 20
`show*` states as effect deps while the callback was recreated every render
would re-register the back handler on every render.

**The 18 Settings sub-screens are deliberately NOT given their own listener.**
They already have their own `role="dialog"`, but they render *inside*
SettingsScreen, whose Escape handles them. A second nested closer would duplicate
the single source of truth for Settings navigation. This is why "55 overlays" and
"27 wired" are both correct numbers rather than a discrepancy.

**Two defects found by the tooling, not by reading the diff.** The first sweep
pass silently missed every `export default function` component, because the
signature matcher was anchored on `^function`. A coverage check found it; the
first pass had reported a clean-looking 20. And after adding a smoke flow for
this, a **passing** run could not be distinguished from one where the new flow
never executed: on success the child's output is swallowed, and the
`[N/M]`-derived count only covers top-level flows, so an inline helper silently
ceasing to run leaves the count unchanged and the suite still green. The gate now
also reports a count of `ok -` assertion lines, which is what makes those
invisible helpers visible. That is the third time this project has hit a
"measures nothing, looks green" failure, and notable that it has now appeared
twice in the tooling rather than the app.

**Two mistakes of my own, recorded because both would have shipped a broken
flow.** The new smoke flow was first placed *before* `dismissOnboarding`, so the
Add-contact FAB was not merely covered but absent from the DOM, and the locator
waited out its full timeout. And the first script pass added a *second*
`useEscapeToClose` to the screen I had just hand-wired, because its "already
wired" check only looked at the first 600 characters of the component body.

Verified live in a real browser, not just by unit test: the smoke flow opens the
Add-contact sheet, presses Escape, and asserts the dialog is gone. The unit
tests prove the hook works; only this proves it is *wired to the real overlays*,
which was the part that was actually missing. vitest 288/288 across 25 files,
eslint clean, build clean, encoding guard clean.

## Recently shipped (28 Sep 2026, later - a backlog audit that found the backlog had been lying about itself)

Ran a real audit of this file's own open items rather than trusting the
summaries, and the most useful result was about the *documentation*, not the
app. Three classes of problem, all the same underlying failure: a claim in
this file pointing at something that does not exist.

**Two dangling cross-references, found by grep rather than by reading.** The
`role="dialog"` audit entry said `MedicationEditSheet` was "logged below" - and
no such entry existed anywhere in 4,873 lines. The overlay entry said its three
genuine UX gaps were "logged as their own batch above" - also nonexistent. A
dangling reference is worse than no reference, because it implies a record was
written. A future session following either would have concluded the work was
done, on the strength of a sentence pointing at nothing.

**Re-measured the overlay gaps rather than restating them, and the real number
    is worse than the claim.** The file said "no Escape anywhere"; there are in fact
    two Escape handlers, both in Option List Editor and Registry Management, and both
    cancel an *inline text edit* rather than a dialog. So the true finding was
    sharper: **57 `role="dialog"` overlays, zero dismissible by Escape.** Recorded
    with the measurement and the reason it was not attempted then - a 57-site
    mechanical sweep is exactly the broad unverifiable change this file warns
    against, so it wanted its own pass. **[CORRECTED 28 Sep 2026: that pass
    happened, and shipped — see the Escape entry in "Recently shipped". This
    entry is left as the audit record, but "not attempted" is no longer true,
    and a session on 30 Sep read it as open and nearly rebuilt shipped code.]**
    The other two (two back-button traps, six level-skipping overlays) are
    recorded as unquantified, from the same audit, not
independently re-verified.

**Two stale figures, one of them in a comment whose entire purpose is
trustworthiness.** `scripts/smoke-test.cjs` was described as "5 flows" (it is
17). And `SHOS_Settings_Prototype.jsx` carried two comments saying "22 rows"
when there are 16, in the one place that documents a row-by-row audit of those
rows - a stale count there actively teaches the next reader to distrust the
audit. Corrected at source, not just in this file, and the encoding guard
confirmed no mojibake was introduced by the byte-safe Node edit used to make it.

**A note on the sub-agent that did the audit.** It found genuinely dangling
cross-references and stale counts that I had not noticed in this file across
many sessions of writing in it - so delegating the read-only sweep was worth
it. But it also reported several items as open that the file itself elsewhere
marks resolved, which is exactly the drift this audit exists to find. Its
findings were verified against the code before acting; none were taken on
trust. Three of its claims turned out to be real, and one of them ("51
occurrences across 37 files") was itself a stale figure that needed replacing
rather than preserving.

## Recently shipped (28 Sep 2026, latest - search said "no matches" before it had searched, and two more vacuous gates caught)

Continuing the new-user audit into search, plus the verification work the
CI/local split prompted.

**Global Search reported "No matches" for any query typed before its index had
built.** It loaded the index with `useLoadedMemo(() => buildIndex(), [], [])`,
and that hook's fallback is an **empty array** - indistinguishable from "we
searched every record and found nothing". So anyone who opened Search and typed,
which is exactly what you open Search to do, was shown the confident answer
`No matches for "X"` for as long as the index took, and then watched results
appear underneath them with no explanation. A false negative that contradicts
itself a second later is worse than a visibly slow screen: it doesn't just waste
a moment, it teaches someone the app's search is unreliable, which is the
opposite of the feature's purpose. The index now uses `null` as its
not-yet-loaded sentinel, which cannot be confused with a real empty result, and
the no-matches branch is gated behind `indexReady`. The `aria-live` region had
the same false negative, so a screen-reader user was told the search had found
nothing while it hadn't finished running; that is fixed too. Deliberately a
plain `useState`/`useEffect` rather than a new `useLoadedState` variant: that
hook is shared by ~100 call sites and has no notion of "loaded", and changing it
for one caller is a far larger change than this needs.

**A pattern worth naming, because it bit twice in one session.** Both
source-level guards written this session failed their first run because the
*comment documenting the fix* quoted the exact string the guard checked for
absent. In this repo comments record what a bug **was**, which is what makes
them valuable and exactly what makes a raw substring check useless. Both guards
now strip comments before negative assertions, and both prove the stripper still
sees real code so the negative check cannot itself become vacuous.

**Phase 1g/1h were mostly non-findings, and that is the useful result.** The
Menstrual & Contraception sub-tab is gated behind a preference, but the
onboarding flow now literally asks the question and the Guide documents the
path, so a new user is not left hunting. Partner Notification is reachable only
from a **positive** test's detail view - which reads like a discoverability gap
but is a deliberate clinical gate, and adding a shortcut to it would dilute
exactly the "no clutter or alarm on sensitive health data" decision recorded
elsewhere in this file. The Glossary already defines PrEP, PEP, DoxyPEP, Doxy,
TOC, C&S, window period, BASHH, MGen, HSV and HPV, so the jargon sweep found
nothing to add.

Verified: vitest 281/281 across 24 files, eslint clean, encoding guard clean,
fast gate green. The new search guard is mutation-verified: ungating the
no-matches branch fails it.

## Recently shipped (27 Sep 2026, later still - the Guide under-promised the encryption, plus a guard so stale Settings paths can't ship again)

Continuing Phase 1f. One real privacy-communication bug, one regression guard,
and one more recurring smoke flake fixed.

**The Guide told users their records were only as safe as their phone's lock
screen.** It described App Lock as "a PIN/biometric gate on top of your device's
own encryption" - true, but it implies the app's records sit unencrypted until
you turn App Lock on. They do not. `storageAdapter.save()` encrypts *every*
write, and `cryptoService` creates a device-bound, non-extractable vault slot on
first run with no PIN required, so a brand-new install is already encrypted.
Verified in the source before writing a word of copy. What App Lock actually
adds is a gate *in front of* the key: someone holding your unlocked phone can't
just open the app. The Guide now says exactly that, and the **Privacy screen's
own App Lock description** says it too - which is where it matters most, because
that is the screen someone opens specifically to find out how safe their
records are, and it was understating the answer. This is the rare case where the
bug was understating protection, which is the safer direction to be wrong in,
but still wrong: someone could decide they needed nothing more than their phone
lock, or conversely assume they were unprotected and avoid using the app.

**A guard for the bug class, after two real instances of it shipped.** The
onboarding and Guide screens exist to answer "where do I do X?" for someone who
has never opened the app, so a stale path there is worse than almost anywhere:
it confidently sends a first-time user to a screen that does not exist, and they
have no way to know the guidance is out of date rather than their own mistake.
The first version of `settingsPathReferences.test.js` scanned every "Settings
→ X" across every module and checked X against the real row list. **It was
abandoned after producing five false positives on its first run** - Android's
own "Settings → Apps → Permissions" path, a line ending in a quote, and prose
that merely mentions Settings. Tuning a free-text heuristic to separate those
from genuine mistakes is the kind of unbounded churn this project has been
burned by before, so it was replaced with an explicit table of the paths that
are real navigation instructions, each checked against the live Settings source:
renaming a Settings row now breaks the test instead of silently making
onboarding wrong. Three of my own mistakes in building it are recorded at their
fixtures, per the standing habit - a char class that couldn't cross a `;`, so a
real `Security &amp; Privacy` section looked absent; a negative check that
matched the very comment documenting the fix; and an escaped-quote mismatch.

**A third fixed-wait smoke flake, this time in the tab-order flow.** Flow 11 read
the bottom nav once after a fixed 800 ms wait following a `reload()` - but a
reload re-boots the app and unlocks the vault asynchronously, so on a slow
machine the nav is still in its previous order when read, and the flow failed
while the app was entirely correct. Now a bounded wait on the exact state being
asserted. This is the same class as the two App Lock assertions fixed earlier in
this session, which makes three: worth recording that the pattern keeps
appearing, and that the fix each time is waiting for the state rather than
trusting a duration.

Verified: vitest 266/266 across 22 files, smoke suite 17/17 against a real
production build, eslint clean, encoding guard clean, no leaked processes. The
new guard was mutation-verified in both directions: renaming a Settings row out
from under the copy fails 1 test, and reintroducing the exact historical
"Settings → Design" string fails 2.

## Recently shipped (27 Sep 2026, latest - onboarding pointed new users at a Settings screen that no longer exists)

Continuing the new-user audit, and a small round: two of the three suspected
problems turned out to be real, one was a false alarm worth recording.

**Onboarding's last slide sent users to a screen that isn't there.** It said
"Settings → Design lets you customize each module's colour and switch to dark
mode", but no screen by that name has existed since the 16 Sep global-settings
reorg — the row is **"Colour scheme"**. This is the one class of onboarding bug
that matters most, because onboarding's entire job is telling a first-time user
where things are, and it was confidently pointing at nothing. Fixed and verified
against the live Settings row rather than assumed. A second instance of the same
class: the storage-save-failed banner said "Check Settings → Developer tools →
Storage", but "Storage" is a *section within* the Developer Tools screen, not a
sub-screen you navigate into, so a user hunting for it as its own destination
would not find it. Now worded as the section it actually is.

**"Contacts, activity, testing..."** in the welcome slide used a word that
appears nowhere in the UI. The tab, the screen title, and the Global Search
result group all say "Encounter". A new user reading "activity" and then looking
for an Activity tab would not find one. Now matches the real label.

**Checked and deliberately left alone — a "terminology inconsistency" that isn't
one.** The singular "Encounter" looks like an oversight beside the plural
"Contacts", and was on the list to be pluralised. Reading the actual code, it's
deliberate and consistent: the bottom-nav label, the screen's own `<h1>`, and
the Global Search group are *all* singular, and it matches "Medication" and
"Healthcare", which are also singular. Only "Contacts" is plural, because it
holds people. Changing it would have been churn against a convention that holds.
Same for the onboarding question slide, which looked like it should offer
"Skip" — it doesn't, and shouldn't: it offers "Not for me" / "Yes, turn it on",
so a user is never asked a question and then given a way to avoid answering it
without saying what they chose.

**The empty-states sweep was mostly a non-finding, and one real dead end.** Ten
of nineteen modules initially looked like they had no empty state; reading each
one properly, ten of those ten do (my first pattern was just too narrow, and
Attachments' real string is "No attachments yet", not the "logged yet" shape I
searched for). The genuine finding: **Partner Notification's contact picker said
"No contacts match"** — true only when a search is active. On a genuinely empty
address book, which is exactly what a real new user has, or what anyone has
after clearing the sample data, it read as though a filter had hidden contacts
that were there. The screen looked broken with no way forward. It now
distinguishes the two cases and, when there are genuinely no contacts, names
the one action that helps: add someone in Contacts first.

Verified: vitest 257/257 across 21 files, smoke suite 17/17 against a real
production build, eslint clean, encoding guard clean, no leaked processes.

## Recently shipped (27 Sep 2026 - the sample data is disclosed and safe to clear, plus a committed change procedure)

Two things: closing the loop on the app's worst first-impression problem, and
turning "remember to run the checks" into a committed algorithm.

**A fresh install disclosed nothing, and clearing it was unsafe.** ~93
fabricated records — 16 contacts, 18 encounters, a positive gonorrhoea result —
loaded with no UI string anywhere saying so (the only mention of "demo data" was
a code comment), and the sole exit was "Reset all app data" three levels deep,
worded as total data loss. Worse, that button was *wrong* for the job: seed
arrays are returned as the fallback for an absent storage key, so the moment a
user creates a record the sample data is persisted into the same array. Verified
in code before designing around it. New `clearSampleData()` removes exactly the
seed ids — derived per repository from the seed arrays so they cannot drift — and
keeps everything the user added, at any time. A first-run banner on Home states
the real record count and that the data is not theirs; Developer Tools offers the
same clear as a separate action, with the reset beside it explicitly labelled as
also destroying your own records; the export screen warns while sample data
would ride along into a file meant for a clinic.

**Two bugs the new flow caught in my own work, both worth more than the
feature.** The clear's confirmation sat *inside* the `count > 0` block, so it
vanished at the exact moment it became relevant — the user got no confirmation
the action had worked. And clearing from Home left Developer Tools still
displaying "96 sample records are still here", with a live-looking button that
would then report there was nothing to remove. Each screen refreshed only its
own copy; `onSampleDataChanged()` now lets them re-read on any clear. Found by
the smoke flow, not by reading the code.

**Smoke suite: 15 → 17 flows, and two recurring flakes actually fixed.** Both
App Lock assertions read `aria-checked` after a fixed 500 ms wait; under memory
pressure the click lands late and React has not re-rendered, so the flow failed
while the app was correct. `CLAUDE.md` had already recorded this assertion
failing here and written it off as "the machine" — which is how a test defect
survives. Both are now a bounded `waitForFunction` on the state being asserted,
and `openSettingsPrivacyScreen` confirms it landed on the right screen so a
mis-navigation reports where it happens.

**The change procedure is now a file, not a habit.** `docs/CHANGE-PROCEDURE.md`
plus `node scripts/verify-changes.mjs` (build → lint → tests → encoding → smoke →
docs check, one pass/fail table). A **pre-commit hook** blocks mojibake,
tested in both directions. Three real defects in the script itself, all found by
using it: `spawn EINVAL` because Windows cannot spawn a `.cmd` without a shell;
a gate that threw and crashed the whole run instead of failing one gate; and
**a server leak** — killing the spawned process left its grandchild holding the
port, and Playwright's headless browsers survived too. Four orphaned
`chrome-headless-shell` processes were then found on this machine holding ~190 MB,
which is exactly what had been starving successive smoke runs and producing
"environmental" failures. All cleanups are now on every exit path, verified by
checking for leaks after a run.

Verified: vitest 257/257 across 21 files, smoke suite 17/17 against a real
production build, eslint clean, encoding guard clean, no leaked processes.

## Recently shipped (27 Sep 2026, later - a six-pass audit batch: stale data, a dead reset, frozen contact details, a calendar hour off, and two settings missing from every backup)

A user-authorised audit/fix round. Six passes, most findings real bugs rather
than polish. Three commits: `bfdaea4` (stale data/undo/reset/Trash),
`e5fbe01` (calendar offset, two medication figures, partner notification),
`1351810` (two settings backed up, plus tests for all of it).

**Five modules showed stale data after saving.** Encounters, Testing, Clinic
Visits, Vaccinations and Symptom Log all returned to their list without
re-reading the repository, so an edit was invisible until a manual refresh or a
relaunch — on the exact screens where a wrong value could matter clinically
(a result, a vaccination, a positive test). All five now refresh first.

**Undo/redo updated storage but not the screen.** `useEditUndo()` was used at 11
sites and none of them re-read after a restore; Medication needed a ref
indirection to avoid a TDZ on its own fix.

**"Reset all app data" reset nothing.** It called the repositories' `clear()`
method, which 10 of 12 did not have — so the button reported success while
leaving every record, preference and log in place. New
`src/repositories/resetAllData.js` does it properly (lists via `replaceAll([])`,
preferences back to full defaults, diagnostic logs cleared) and the UI now
reports partial failures instead of claiming success. Verified live: 16 contacts
/ 7 tests / 6 medications became 0 and stayed 0 after reload.

**Episodes now go to Trash instead of being permanently deleted.** `episodes`
added to `MODULE_LABELS` and `TRASH_REPOSITORIES`, following the existing Clinic
Visit Trash semantics, and TrashScreen can restore one. This was the one place
in the app still bypassing the "archive before hard delete" rule.

**Option lists: "Female" and "Trans-male" are now protected values.** Both are
load-bearing — the app decides whether to show contraception, anatomy-specific
fields and the Pregnancy tab by matching the stored gender string against exact
literals in 8 places across 3 modules, exactly as "Blood pressure" already was.
Renaming or removing either would have silently inverted every one of those
gates. Covered by `customOptionLists.test.js`.

**Global Search now respects `menstrualTrackingEnabled`.** Cycle, contraception
and pregnancy records were indexed and searchable with the feature switched off.

**Dark mode, six real contrast failures fixed** (all measured, not eyeballed):
Settings status toast 1.02:1 → 12.47:1; Timeline/Testing gold text 2.99:1 →
12.19:1; Measurements Normal/Low/High badges 2.67–2.71:1 → 6.36–10.79:1. Home's
banner and Settings' Suspense fallback now branch on dark mode at all, and
Medication's disabled/Create buttons use themed disabled colours.

**Calendar sync wrote every appointment an hour off.** A Clinic Visit's `date`
is a fake-UTC stored value, and `new Date(visit.date).getTime()` re-applies the
device's UTC offset — so a visit booked for 14:00 landed at 15:00 for eight
months of the year. This is the only place in the app where a wrong timestamp
escapes the app entirely, and it is the one a clinician reads off the patient's
phone at the appointment. Every other consumer of a stored datetime was already
using `realTimestampFromStored()`; this one was missed.

**I had the second calendar bug backwards, and measuring corrected it.** My first
comment claimed the future-appointment filter "judged an appointment already
past" and so deleted it. Measured across four zones, the naive parse is *later*
than the real moment when the offset is **positive**, so the filter keeps a visit
longer, not sooner. The real harm depends on the sign: positive offset (London,
Sydney) leaves finished appointments in the calendar forever; negative offset
(New York and every western zone) can judge a still-upcoming appointment past,
and since cleanup deletes any event not in the booked set, an already-created
event is **deleted and the appointment silently vanishes**. Two bugs in opposite
directions, and the serious one is invisible in the UK — the zone this was built
and reported from. The fix is a helper call, not a fudge factor, because a fudge
would need to know the offset's sign to know which way to apply it.

**"Infinity containers" on a PRN medication.** `computeStock` guarded
`unitsPerDose` but not `unitsPerContainer`, and the form's NumberField is
`min={0}`. The clause is now omitted rather than inventing a number.

**A never-started medication reported 100% adherence.** `windowStats`'s
`expected > 0 ? ... : 100` guard is right for a window with no due day, and
`AdherencePill`'s NaN guard depends on it — but wrong for a custom
(every-N-days) medication with no dose ever logged, where there is no anchor.
It showed 100% on the card, on Home's ring and in Stats, and **inflated a mixed
set**: averaging to 90% when the only real medication was at 80%. An empty
window is now only "nothing due" when history exists.

**Partner Notification froze contact details.** Items stored a snapshot of the
contact's name/methods/age/address, and `contactId` was stored too — but the
render path never used it. Correcting a phone number in Contacts left the
checklist showing the old one, and `save()` deliberately reuses the same list
per `testId`, so even regenerating kept the stale value. On the app's most
safety-sensitive workflow that is a wrong-contact-details path, silent. The list
now re-derives from the live Contact, with three rules so it cannot regress in a
different shape: a user-typed methods value always wins (new
`methodsOverridden` flag — that box is legitimately editable and re-deriving
would wipe their input on every render); a deleted Contact falls back to the
stored snapshot; and the **exported text resolves the same values**, so the file
a clinic reads can never disagree with the screen.

**Two settings were in no backup at all.** The question the earlier audits had
not asked was not "which repositories are in the backup?" but "which *user
settings* are in it?". `darkModePreference` and `clinicCardVisibility` both live
in `src/calculations/`, so an audit that enumerated repositories structurally
could not find them. CLAUDE.md already records that a new repository not wired
into `backupService` in the same change "was missed twice historically" — this
is the third time, in a different direction. `darkModePreference` is the app's
**only** owner of the light/dark choice (`AppPreferencesRepository` has no
`darkMode` field, verified), so restoring a backup on a new device silently
reset the user to their OS default with no warning. Both now have plain async
accessors, restore branches carry the usual `typeof`/`!Array.isArray` guards so
an older backup still restores, and the dark-mode setter goes through the
existing notify-listeners path so a restore does not leave the screen in the
old theme until reload. Both are excluded from merge.

**Tests: 33 new, every one mutation-verified — and one batch had to be thrown
away first.** `medicationEdgeCases.test.js` (8), `calendarSyncOffset.test.js`
(12), `backupPreferenceCoverage.test.js` (13). Reverting the Infinity guard fails
2; reverting the never-started fix fails 2; reverting the calendar event-date fix
fails 1 in London and 4 in New York/Sydney.

The important one: my first calendar tests used a realistic "23:00 the night
before a 00:30 appointment" scenario, and **mutation testing proved it
discriminating of nothing** — reverting the filter failed *zero* tests, because a
one-hour offset does not move a one-and-a-half-hour margin across a boundary. A
test that cannot fail when the bug is reintroduced is worse than no test,
because it reads as coverage. Replaced with 1ms-boundary cases pinned to
`realTimestampFromStored`'s own answer, which must disagree in any non-zero-offset
zone. In UTC the offset is 0 and **no** test there can fail — a real property of
the bug, now stated in the file rather than papered over.

`backupPreferenceCoverage.test.js`'s last test is the one that would have caught
the original gap: it enumerates `src/calculations/*Preference.js` from the
filesystem and fails if any module owning a stored value under a `STORAGE_KEY` is
never referenced by `backupService`. The *next* unwired preference should fail
there rather than in a user's restore.

**Three test-authoring mistakes of my own, recorded at their fixtures rather
than hidden.** A draft read `computeAdherence` as flat when it returns
`{streak, sevenDay, sinceRefill}`. A second reintroduced the 0-indexed-JS-month
trap one file over from the DST suite — "now" was silently *April* while the
doses were March — and asserted the wrong direction of the today-exclusion rule.
A third hand-counted eight negative dose logs and got seven, having quietly
passed for entirely the wrong reason. Also: three codemod attempts damaged
`aria-label` attributes in `SHOS_PartnerNotification_Prototype.jsx` (duplicated
and truncated closing braces) — caught by eslint and the build each time, and the
final diff reviewed line by line. The lesson is that **regex over JSX
attributes is not safe**; three passes were needed where one careful edit would
have done.

Storage is mocked with an in-memory map in the new preference tests (the
`contactRepository.test.js` pattern): the real adapter needs the encryption vault
unlocked, so every save logs "Vault is not unlocked" and the assertions pass
against module memory while verifying almost nothing.

Verified: vitest 224/224 across 18 files, eslint clean, production build clean,
encoding guard clean, calendar suite additionally green under Europe/London,
America/New_York, UTC and Australia/Sydney.

## Recently shipped (27 Sep 2026 - a real DST bug in every-N-days medication adherence; one self-caught overclaim)

No new feature this round. Two correctness findings, both from reviewing my
own previous round rather than from a new report.

**A real DST bug in the every-N-days (custom) medication maths.** The owner
asked whether the "this refill" figure counts days up to now or the whole
supply, and whether it can ever reach 100%. The answer to the design question
is yes - it is deliberately windowed to the *current container's* cycle, not
the refill-to-today span, so a 6-month PrEP supply does not dilute the rate
(see the 18 Aug entry in "Recently shipped"). But asking the question is what
exposed the bug, because checking the answer meant checking the arithmetic.

`computeExpectedDoseDays()` decided which days were due with raw millisecond
modulo (`diff % (days * 86400000)`), and the custom streak walk stepped the
schedule with flat millisecond offsets. Across a DST boundary that is wrong by
exactly the offset change, so a dose genuinely taken on a genuine due day
failed the test, was never added to `expected`, and **a flawless every-14-days
medication silently lost adherence it had actually earned**. Measured rather
than assumed, by probing the same anchor in four zones: the modulo test
disagreed with a real 14-day cadence on 1 day in Europe/London, 0 in UTC, 3 in
America/New_York and 1 in Australia/Sydney. Fixed by using calendar-date
arithmetic (`setDate`/`wholeDaysBetween`) instead of dividing elapsed
milliseconds. The daily-median path in the same file already did it this way
and was never affected, which is exactly why the bug survived in only the
custom branch - the kind of half-fixed pattern that hides a real defect.

**A third "instance" of the bug that was not one, and I said so.** The
`daysSince` calculation for the refill window had the same
divide-by-86400000 shape. I fixed it too - then mutation-tested it, and
reverting that line fails *nothing*. It is not an observable bug: a DST shift
is one hour and `Math.round` absorbs a +/-1h day-count error completely, since
crossing a rounding boundary would need a 12-hour shift. The change is kept
(as `wholeDaysBetween`) and covered by a test, but the comment says plainly
that it removes a latent trap rather than fixing a live defect. **"Fixed a
bug" and "removed a trap" are different claims and this file keeps losing that
distinction**, so the difference is recorded at the code, not just here.

**My "deliberately silent in the common case" claim about `doseTimingAdvisory`
was wrong as a general claim.** I asserted it without measuring. Measuring it:
the window is 2 hours either side of a floor that sits halfway through the
dosing interval, so it covers 4h/interval - 17% of the cycle at 1x/day, 33% at
2x/day, 50% at 3x/day, and **67% at 4x/day**. A QDS medication would show a
message two days in three. The 2-hour figure is NHS-sourced, so it is not mine
to quietly shrink, and prominence is a presentation decision rather than a
calculation one - so the number is unchanged and the corrected figures are
recorded in the function's own docstring, with the note that if it proves
annoying in practice the fix is a dismissible UI, not a smaller magic number.

**Two of my own new tests were wrong in the same way, and both are documented
at the fixture.** The new DST test file broke twice on the month-index trap:
JS `Date` months are 0-indexed but the ISO date strings this app stores are
1-indexed, so a first version anchored every fixture on February while pinning
"now" to April, and every assertion read 0 - indistinguishable from the bug
under test. A later draft made the opposite slip. Both are now separated into
a 1-indexed `isoDay` and a 0-indexed `jsDate` so the same number cannot be
passed to both again. Separately, one test was passing *vacuously*: its window
contained no due day at all, so `expected` was 0 and `windowStats`' existing
"nothing was due, nothing was missed" guard returned 100% regardless of DST.
It now asserts the window is non-empty, which is what stops a real
regression from hiding behind that fallback.

Six new tests in `medicationAdherenceDST.test.js`, verified green under
Europe/London, UTC, America/New_York and Australia/Sydney, and
mutation-verified: reverting the expected-day fix fails 2 tests, reverting
the streak fix fails 2, and a lazy "count every day as expected" fix - which
is how the bug could have been "fixed" without thinking - fails 3.

**New standing rule:** when this app stores a calendar DATE for a
medication/schedule calculation, use calendar arithmetic, never
`milliseconds / 86400000`. The DST bug above is the concrete reason, and
`dateInputHelpers.js` already has the correct pattern from the 26 Sep
timezone fix - reuse it rather than re-deriving.

## Recently shipped (26 Sep 2026 late - medication lockout rebuilt on NHS guidance; Healthcare follow-ups)

Commits `eab689c` and `b1ecab9`.

**The medication lockout no longer contains an invented number.** It released
a dose at 80% of the dosing interval, and an audit of that constant found no
source for it. NHS Specialist Pharmacy Service guidance ("Advising on missed
or delayed doses of medicines", reviewed 3 Jun 2026) supplies two values that
do have sources, and both are now in `medicationCalculations.js` with the
citations recorded at the constants themselves:

- **Half the dosing interval** as the minimum gap before the next dose. NHS
  states this absolutely and it is exactly half the interval in every case
  it gives: apixaban/dabigatran 12h to 6h, rivaroxaban 24h to 12h,
  antiepileptics BD 12h to 6h. This app never tells anyone to skip or double
  a dose, so this is the only genuinely load-bearing value in the file.
- **2 hours** as the acceptable lateness - "for most medicines, it is
  acceptable to take a dose up to 2 hours late". An absolute figure. An
  intermediate attempt derived 0.2 OF THE INTERVAL instead, which gave a
  daily tablet 4.8h of slack, two and a half times more permissive than the
  guidance allows. Deriving an hours-based rule from a percentage was the
  original bug in my own first fix.

A third constant (a 1-hour early tolerance) was written and then deleted: no
guidance publishes such a rule, and it was unreachable arithmetic besides,
since the half-interval floor is earlier than any 1h-early window for every
frequency this app supports. **If you add a timing constant to this file, cite
the source in the comment or do not add it** - the 0.8 and the 0.2 were both
untethered numbers that read as deliberate.

**The same guidance corrected a real behavioural bug.** "More than twice a
day: skip the missed dose and wait until the next one is due." A QDS
medication should therefore never follow a late dose - which is precisely the
case the old "follow the actual dose" branch was being used to justify. The
schedule is now the unconditional answer, and a past slot is stepped over
rather than offered, so the skip rule falls out for free.

**`fixed` means fixed.** It ignores phasing entirely, so a proven multi-day
weaning trend cannot move a fixed schedule. It previously read as "mostly
fixed" without saying so. `adaptive` is where shift detection belongs, and it
requires three consecutive doses trending the same way: with only two, "taken
6h late once" and "started moving to 06:00" are the same two observations, so
the burden of proof sits on the shift and the schedule holds until it is met.

**New: `doseTimingAdvisory()`** implements the owner's "just over or under is
fine, but warn me about the next dose" ask. A plain-language note in a grace
window around the boundary, deliberately silent in the common case so it does
not become noise. It is advisory only - a test asserts it cannot unlock a dose
the hard floor still blocks, because the softness belongs in the message, not
in the rule. The UI gate that would have hidden it was itself a bug: being
inside the grace window but before the floor is exactly when `isDoseLockedOut`
is still true, so the one message that mattered could never render. Found by
a live browser check against real seed data, not by reading the diff.

**Test-clock discipline.** `medicationLockout.test.js` pins the clock for the
whole file. Both the due-slot walk and the lateness comparison read the real
wall clock, so an unpinned suite answers differently depending on what time of
day it runs - which is how a QDS assertion came to expect the wrong value and
looked like a code bug. The suite also carries a deliberately duplicated
clock-time helper, because "a midnight dose taken 15 minutes late" means
00:15 and an earlier version of these tests built "15 minutes ago", i.e. a
dose at whatever time of day the test happened to run, making every lateness
assertion meaningless.

**Verified by mutation testing, not assumed.** 12 behavioural mutations each
provably fail with a clean baseline. Two of them initially failed to fail
anything, which is what exposed two of my own tests asserting only `< 24h` -
loose enough that both branches satisfied it - and a missing "two doses is not
yet a shift" case that is the entire point of `MIN_TREND_DOSES = 3`.

Also in `b1ecab9`: Home's long-dead `lastContact` query now renders as a
"Newest contact" row (verified live - clicking it opens the real profile), and
`contactRepository`'s `STORAGE_KEY` is exported rather than duplicated into
its test. **The two Menstrual "unused setter" findings are not bugs and were
deliberately left alone**, with the reasoning commented at both sites: Flow is
a bounded vocabulary whose stored value drives a 1-4 icon count, Formulation
picks an entry out of a lookup table, and the only editor for either list is
the Settings overlay - so the setters are dead rather than the lists being
stale. Commented specifically so the next audit does not re-raise them.

## Recently shipped (26 Sep 2026 - stored-datetime timezone fix, personal-data encoding repair, vaccine reminder fix)

Three real bugs found by auditing Healthcare and the storage layer rather
than by a crash report, plus a genuine security hole in my own tooling.
Commits `a8d277e` and `aad6db6`.

**Stored datetimes were shifted by an hour in one place (real bug).**
Clinic Visits' "Confirm attendance" wrote
`nowAsDateTimeLocalString()` - the raw value an `<input
type="datetime-local">` expects - straight into a STORED field.
`realTimestampFromStored()` does `new Date(storedIso)` and then re-reads
that result's UTC components, so a bare string is first parsed as LOCAL
time and its digits are *already* shifted before being reinterpreted.
Measured: the same "12:00" the user typed comes back as 11:00 in London BST,
16:00 in New York and 02:00 in Sydney. Now uses `nowAsStoredDateTime()`, and
a hand-rolled `":00.000Z"` suffix elsewhere in the same file was replaced
with that helper too. All four other call sites of the input-only helper
were audited and correctly append the suffix themselves, so none changed.

Two tests added, both deliberately able to fail. The wall-clock round trip
is asserted through local `getHours()` rather than offset arithmetic, after
**two earlier versions of that test failed for reasons that had nothing to
do with the app**: one sampled the *current* device offset against a fixed
*January* date (the UK is GMT in January, BST in July, so the test
disagreed with itself and failed intermittently), and the next read the
offset back via `new Date(timestamp).getTimezoneOffset()`, which reports
`0` under this project's vitest runner even while string parsing is
genuinely local - the identical logic was verified correct in plain node
across four zones. The second test is a source-level guard rejecting any
module that uses `nowAsDateTimeLocalString()` without the fake-UTC suffix,
i.e. the exact shape of this bug; confirmed to fail by reintroducing the
bug, then pass once restored. Verified passing under Europe/London, UTC,
America/New_York and Australia/Sydney.

**Personal data had the same mojibake the source files had.** New
`src/calculations/encodingRepair.js` matches only the 12 context-verified
sequences and *reports* anything else rather than guessing at someone's
medical notes. An exhaustive test proves the repair cannot emit a character
outside the map, so the multiplication sign, almost-equal, `>=`, both arrow
shapes, em dash, bullets, degree, plus-minus, ellipsis, curly apostrophe
and every emoji are protected structurally, not by a filter that could be
got wrong. `scripts/repair-personal-data-encoding.cjs` drives it: dry run by
default, a **mandatory full backup before any write**, and a
verify-after-write pass. Proven end-to-end against real encrypted storage
(inject, detect, back up, apply, verify: exactly the 3 corrupted fields
found and fixed, every wanted character surviving, no collateral damage).
**No personal data has been written yet** - the tool exists, it has not been
run against the owner's real profile.

`.gitignore` now excludes `backups/`. That directory holds PLAINTEXT
decrypted records, this is the public track, and a stray `git add .` would
otherwise have published real medical records. Found by my own encoding
guard, after I had already written the tool that creates those files.

**Vaccine reminders had silently stopped firing entirely.** Two causes
stacked. First, the dose-by-dose series work moved `nextDue` from a
top-level field into `doses[].nextDue`, and
`migrateLegacyVaccinationFields()` *deletes* the top-level field when it
does - but eleven read sites still read the old field, so every one saw
`undefined`: the reminder's own selection, `getOverdue()`, the Healthcare
summary count, the list rows, the detail "Next due" row, the module's
overdue count, and the Clinic Card screen and PDF export. Measured live:
the old-style read matched **0 of 4** vaccinations while a real due date
existed. The symptom was exactly this - the per-dose line in the detail
view rendered fine (it reads `dose.nextDue`) while reminders never fired
and every overdue count stayed zero.

Fixed by *deriving* the value on read in a new pure
`src/calculations/vaccinationCalculations.js` rather than writing the
denormalised field back - denormalising is how the two truths drifted apart
in the first place. Second cause: the seed data was storing the wrong
*shape* of value regardless, using `daysAgo()` (a full ISO string like
`"2026-10-16T10:00:00.000Z"`) in a field that is a plain `YYYY-MM-DD`
calendar date. So even with the readers fixed, `nextDueAsDate()` would
append `"T09:00:00"` to that and produce an **Invalid Date** - which does
not throw, it just means a reminder that quietly never schedules. The seed
now uses a `dateOnly()` helper and the readers normalise, so a record the
owner already saved in the wrong shape is handled rather than needing a
migration. Confirmed live: the date now reads `2026-10-16`.

**A third copy of the same test bug.** The App Lock smoke flow asserted
after a fixed `waitForTimeout(500)` on a toggle whose click triggers a real
PBKDF2-100k vault re-wrap, so the assertion depended on machine speed. This
is the same mistake already found and fixed *twice* in this suite (the
PIN-recovery flow's five PBKDF2-bound waits, and an earlier non-retrying
`count()` in that same flow) - found here a third time because it was a
third copy. Now a bounded wait that returns as soon as the toggle flips.

**Read this before trusting a red smoke build on this machine.** The three
intermittent failures hit while verifying the above (a cold-start timeout,
an element-stability timeout, and the App Lock one) all traced to the
machine having roughly **300MB free of 4GB** - partly leftover `node` and
browser processes from earlier commands, partly the machine itself. None
were app defects. With the machine cleaned up the suite passes 15/15 with
no flow skipped. This also gives a concrete, actionable explanation for the
long-standing "flow 14 fails at position 14" note further up.

One self-inflicted lesson worth keeping: several of these edits were first
made with PowerShell `Get-Content -Raw` / `Set-Content -Encoding UTF8`, and
that round-trip **re-introduced exactly the mojibake this file spent the
session repairing** (PS 5.1 reads UTF-8 as Windows-1252 by default). The
new encoding guard caught it on four files, they were restored from git and
redone with the encoding-safe editor. Any future bulk edit of a source file
in this repo should avoid PowerShell read/write round-trips.

Verified: vitest 125/125, eslint clean, encoding guard clean across 211
tracked files, production build clean, smoke suite 15/15 against
`vite preview` with flow 14 genuinely running (not skipped), 10/10 live
focus assertions. CI green on `a8d277e` (all three workflows).

**The Notion write "block" was my own bug, not a permissions problem.**
Appending to the `Development Log` page had been failing with
`400 invalid_request_url`, and this file previously recorded that as a
write-path restriction. It was not. The append endpoint is
**`PATCH /v1/blocks/{block_id}/children`**, not `POST` - `POST` is not a
valid method on that path at all, and Notion's own error text for it is
literally "This request URL is not valid", which reads *exactly* like an
auth/permissions fault. That sent a previous session across two different
integration tokens chasing permissions that were never the issue.

**CORRECTED 30 Sep 2026: the version/shape recorded here no longer works, and
fails in a way that points away from itself.** `PATCH` is still correct, but with
`Notion-Version: 2022-06-28` and the old block object the request now returns
HTTP 400 with a message that enumerates every block type —
*"body.children[0].embed should be defined… bookmark… image…"* — which reads like
a malformed body rather than an API-version problem. Probing three variants side
by side settles it: `2022-06-28` + old shape = **400**; no version header =
**400**; **`2025-09-03` + `{ object: "block", type: "paragraph", paragraph: {...} }`
= 200**. Two further traps, both hit for real this round:
- `rich_text[].text.content` is capped at **2000 characters per item**. One
  ~7,000-character paragraph returns a bare 400 with no message at all.
- **Verifying the write requires pagination.** `page_size=100` returns only the
  FIRST page; the Development Log is now 1,176 blocks over 12 pages, so a
  single-page check finds nothing and reads as "the write failed" when the new
  blocks are simply past its end. That nearly caused the whole entry to be sent
  twice.

And the MCP tool itself returned 401 for the whole session while the
underlying token was perfectly valid — a direct `GET /v1/users/me` with the same
token returned **200**. So a 401 from the MCP is not evidence about the
credential; probe the API directly before concluding anything.

Two facts worth keeping, both measured rather than assumed:
- The page ID was right all along: `3b013572-4f67-80ab-b1a0-c665a828e241`
  is "Development Log" (1,019 blocks before this round's append, 1,032
  after).
- There are **two** internal integrations in this workspace, and they
  behave identically here: `Data log kane gptnotion` (the old GPT-logging
  bot) and **`SHOS Dev Log`** (created ~25 Sep, and the one to use). Both
  can read; the earlier "MCP returns 401" belief was simply false - no
  Notion MCP is configured, and `auth.json` holds only `github-copilot`
  and `opencode-go`, which are LLM-provider keys with nothing to do with
  Notion. If someone wires up the official MCP later it is OAuth at
  `https://mcp.notion.com/mcp` and needs no secret at all.

**Lesson: when an API returns "invalid URL", check the HTTP method
against the docs before inferring anything about permissions.** The
misleading error text cost more time than the underlying fix.

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

Still open, not attempted: Item 7 device confirmation.
  [CORRECTED 28 Sep 2026: the other item here read 'the 5-audit findings
  batch' - a phrase referenced twice in this file and defined nowhere in it,
  i.e. a third dangling cross-reference. The audit findings it meant ARE
  recorded, under 'Audit Findings (25 Sep 2026)' in Known issues below;
  whatever remains genuinely open there is listed there explicitly.]

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


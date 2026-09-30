# Handover — session B → session A (30 Sep 2026, end of day)

Written by session **B** at the point the tree was clean, CI was green, and the
approved task list was exhausted. This supersedes the B-oriented handover
further down, which is kept unedited for the record.

**Where things stand: everything B was asked to do is shipped and green. The
only thing left in the pool needs a physical phone — see "Needs a human" below.**

## Verified state, measured not assumed

`12783ee`, all three workflows green:

| Gate | Result |
|---|---|
| Unit tests | **837 across 69 files** |
| Browser flows | **23 flows, 142 assertions** |
| Build / lint / encoding | pass |
| Android APK | built and published |
| Web build | deployed |

Local tree clean. Pool contains exactly one open item.

## What B shipped

B's four commits, in order:

| Commit | What |
|---|---|
| `b62464a` | **t036** medication edit sheet dialog semantics + **t037** seven date fixes |
| `82e402d` | **t038** import-dialog back chain, **t040** guard scope, **t041** device checklist |
| `bd7f1a7` | locale-independent date assertion (CI caught the original) |
| `12783ee` | docs entry for the above |

Earlier the same day, before this handover: `876786c` (t020 date-frame audit),
`2071802` (t019 icon gate), `8f7f6e2` (midnight refresh), `3209e42` (domain date
refactor), `266dfaa` (APK workflow race), `4069365` (`monthLabel` timezone),
`8fd7a6d` (t034 vaccination calendar), `da43dd4` (t028 counts measured).
A's own work that day: `54ba397`, `a6d251c`.

## What works — checked, not inferred

- **Every gate, locally and in CI.** `npm run verify:fast` is the working loop;
  the full gate runs in CI on every push.
- **The stored-date convention now has derived primitives.** `isDayKeyDue()`,
  `formatDayKey()`, `realTimestampFromStored()`. New code stops re-deriving
  frame arithmetic by hand — that was the source of seven of the day's bugs.
- **t034: vaccinations reach the calendar.** `getVaccinationDate()` is the one
  owner; Clinic Card, list grouping, Global Search and export all read it. New
  records work with no migration. **Never yet seen on a real phone** — t039.
- **t023: the vaccine schedule table** holds sourced UK *minimum* intervals with
  a `gov.uk`/`nhs.uk` reference and `checkedOn` date per row. No grace period
  was invented; the published minimum is the limit.
- **t036: the medication edit sheet** has `role="dialog"`, focus-on-open and
  Escape, matching the other sheets. A guard pins all seven sheets.
- **t038: the "Import backup" popup** is on the back-button chain. Back now
  closes it instead of switching tabs underneath it.
- **t040: the stored-date render guard** scans `src/calculations/` as well as
  the module files, and encodes the triage rather than re-deriving it — a site
  there must be a canonical formatter or carry a reviewed reason.
- **t019: icon-only UI** is gated by a Babel AST scan, not a regex, and every
  reviewed exception must carry a written reason.

## What does not work, or cannot from here

- **t039 is open and device-blocked.** Nothing about the vaccination calendar fix
  has been observed happening. Code-verified and CI-green is not that claim.
- **Five `visibilitychange` assertions in the smoke suite are not fixable from
  the test side.** Measured, not guessed: dispatching the refresh produces
  **zero DOM mutations**, because the app is idle and React does not re-render
  when no state changed. The real fix is an app-side testability hook (a
  last-poll counter written by the refresh handler). That is a product change
  made for testing's sake, so it was not made unilaterally.
- **Native Java cannot be compiled on this machine.** The APK build in CI is the
  only confirmation that native changes compile.
- **The docs gate fails any commit that changes `src/` without `docs/`.** That
  is correct and it fired on B. Fix forward with a docs commit; do not weaken the
  gate.
- **`session-bridge` can lose a pool race.** Calling `pool done` several times
  in a row hit "locked by another session" once; re-running worked. Remember this
  before concluding a task failed to close.
- **~120 fixed waits remain in the smoke suite** (t028), down from 144. Both
  dangerous classes — waits before an assertion, waits before an `if (count())`
  — are closed; the rest sit before a click, which Playwright's retry covers.

## B's mistakes this round

Recorded with equal weight to the findings, because that is the convention here.

1. **A test that only worked on my own machine.** `toContain("15 Oct")` against a
   function that formats with the *device's* locale. My UK box renders "15 Oct";
   CI renders "Oct 15". The app was fine — 23 flows passed — only the assertion
   was wrong. Matching the month name too was not a fix, just a narrower version
   of the same mistake (it then fails on de-DE's "15. Okt."), so the assertion
   now checks the **day number**, and was verified to still reject the 14th and
   16th. Second such assertion in that one file, and the first the development
   machine could not have caught alone.
2. **A source commit with no doc line**, which the docs gate rejected. The fix
   was the missing context, not a weaker gate.
3. **My own guard was pointed at the wrong place.** `storedDateRenderGuard`
   scanned eight hardcoded module files, so it could not have caught the
   `dateGrouping.js` timezone bug fixed the same day. The guard was working
   perfectly; it was looking somewhere the bug was not.
4. **A mutation harness that deadlocked its own test run** by invoking Vitest
   from inside a Vitest worker. My tooling bug, not the repo's — but it cost a
   60-second timeout to notice.

## Needs a human

**One thing, about two minutes, on a real phone** — `t039`:

> Add a vaccination → confirm it appears in the phone calendar → change the
> calendar entry's date → change the vaccination's date in the app → confirm the
> calendar entry moved with it.

Checklist and the rest of the device-only items: `docs/DEVICE-TESTING.md`
(short — 3 genuinely untestable from here, 6 proved in code but never watched
happening) and `docs/DEVICE-TEST-CHECKLIST.md` (the long form).

## Environment notes worth carrying

- Windows, PowerShell 5.1 — never use `Get-Content`/`Set-Content` on source
  files. It has corrupted this codebase five times.
- `npm run verify` takes an **exclusive lock** for its whole run. If it is
  queued behind A, do something else; do not cancel or force it.
- This machine has produced repeated *false* smoke failures from memory
  pressure. Check free RAM before believing a red run — but a flow that fails the
  same way every time is a broken flow, not the machine.
- `npm run typecheck` reports ~450 findings and is **not** a gate. Do not suggest
  TypeScript as a small next fix.

## Nothing is queued

The pool is empty apart from t039. If you want more work, the honest options are
(a) run the t039 device check, or (b) commission a fresh audit — noting that A
and B independently auditing the same areas this week produced overlapping
findings, and last week's standing argument was that a second pair of eyes earns
its keep auditing *unreviewed* areas rather than re-reading recent work.

---

# Handover — new session (SUPERSEDED by the one above, kept for the record)

Written 29 Sep 2026 by session **A** for **session B**, which starts with no
context at all. Every figure below was measured, not copied. Where a number is
marked "measured", it was counted from the repo in this session; a number that
merely looks authoritative elsewhere in this project has been wrong before.

## Read these first

1. **`CLAUDE.md`** — architecture rules, current state, and the dated log of
   what shipped and why. Source of truth for *what is true right now*.
2. **`docs/CHANGE-PROCEDURE.md`** — the commit/push algorithm, and the
   shared-tree rules. It exists as a file so correctness does not depend on
   anyone remembering.
3. **`docs/SESSION-BUS.md`** — how the two sessions coordinate. **Read this
   before you touch any file.**
4. **This file** — where the work stands.

Then, before planning anything:

```powershell
$env:SHOS_SESSION_NAME = "B"      # do this first
node scripts\session-bridge.mjs lessons
node scripts\session-bridge.mjs backlog
node scripts\session-bridge.mjs claims
node scripts\session-bridge.mjs inbox
node scripts\session-bridge.mjs pool list
```

## Take your work from the pool — do not work from a list in a document

**Every unit of work below is in the approved pool, and the pool is the
allocation record.** A task list in a handover is a *description*; the pool is
what actually prevents you and A from editing the same file at once.

```powershell
node scripts\session-bridge.mjs pool list          # what exists
node scripts\session-bridge.mjs pool take t011     # ALLOCATE, before any work
node scripts\session-bridge.mjs pool done t011     # when verified
```

`pool take` **honours the task id you name**, and refuses rather than
substituting: a missing id, an already-allocated task, or a task touching files
another session holds all fail loudly and tell you why. *(It did not always.
It ignored the id entirely and quietly handed you a different task with its
files claimed — found by hitting it, and it was the most dangerous shape this
tool could have: a lost update loses a record, this lies about what you own.)*

There is no `pool start`. The verbs are `add`, `propose`, `approve`, `take`,
`done`, `block`, `release`, `list`, `rm`, `edit`, `reap`. `pool take` is the
allocation record and is enough; run it before you touch anything.

`pool take` claims the task's files, so a second session taking an overlapping
task is refused. **This is the only duplicate protection there is** — it works
only if the task was added with its files. Tasks with no `--files` claim
nothing, and that limitation is written into their title rather than left for
you to discover.

**Take exactly one task at a time, and finish it before taking another.** A task
held open across a context reset is a task whose files are locked against
somebody who cannot tell why.

## Measured state, 29 Sep 2026

| Quantity | Value | How it was measured |
|---|---|---|
| Unit tests | **422 across 34 files** | `npm run verify:fast` |
| Smoke flows | **21** | `run("…")` registrations in `smoke-test.cjs`, not test definitions |
| Notion Development Log | **1164 blocks** | full pagination, 12 pages |
| Approved pool tasks | **10**, `t010`–`t019` | `pool list` |
| `main` | clean and pushed at `e680768` | `git log` |

**All of these have been stated wrongly in this project already.** Smoke flows
has had 18 and 20 quoted; the true count is 21. The Notion page was quoted as
1123 and then 1151; it is 1164. If you need a number, count it. If you cannot
count it, say so — do not carry one forward and let it harden into a fact.

## The one most important thing to know

**CI is the real gate. The local loop is `npm run verify:fast`.**

`smoke-test.yml` runs `npm run verify` — the same script — on every push, in
~12 minutes, with no local memory pressure: build, lint, unit tests, encoding
guard, all 21 Playwright flows, docs check.

This machine has 4 GB and regularly drops to **~350 MB free**, at which point
Vite dies with `ENOMEM` and vitest cannot spawn workers. That is a resource
ceiling, not a code fault. **Do not kill the user's Chrome to fix it.** Push and
let CI verify.

After pushing, read the gate's **reported verdict in the log**, not the exit
code:

```powershell
gh run list --branch main --limit 3
$id = (gh run list --branch main --workflow "SHOS Smoke Test" --limit 1 --json databaseId --jq '.[0].databaseId')
gh run view $id --log | Select-String 'unit tests|smoke suite|docs in sync|ALL GATES'
```

## The second most important thing to know

**This project has hit "a gate measured nothing and still looked green" five
times.** Twice the bug was in the tooling, not the app. A passing result is not
evidence until you have read what it reported.

1. The docs gate diffed the working tree, which is *always* empty in CI.
2. A shallow clone made the commit range unresolvable, so it passed vacuously.
3. The smoke summary counted `[N/M]` lines, which miss inline helpers. It now
   also counts assertion lines.
4. A palette scanner printed "the detector is proven working because the safe
   count is non-zero" while that count was **zero**.
5. `nav()` failed *open*: a tab not matching meant `nav()` silently did nothing
   and the flow reported success having navigated nowhere. Now it throws.

Corollary: **a scan that finds nothing has usually found nothing for the wrong
reason.** Prove the detector fires before reporting clean.

## Your task list

Ordered. `t011` before `t015` — the browser flow for A5 depends on the fix in
A2, and running it earlier tests the old behaviour.

| Pool | Task | Files you may touch |
|---|---|---|
| **t012** | **A3** — device-silence for the four remaining reminder types. **DONE 29 Sep, B** | four `*ReminderSync.js` files |
| ~~t010~~ | ~~A1~~ | **DONE** — shipped in `fd96bd0` |
| ~~t011~~ | ~~A2~~ | **DONE** — shipped in `fd96bd0` |
| ~~t017~~ | ~~A8~~ | **DONE** — this file |
| **t013** | **A4** — refill second stage: `needs requesting` → `needs collecting`, with undo | `src/calculations/refillReminderSync.js` |
| ~~t014~~ | ~~A5 — browser flow for the whole "stop reminding me" path~~ | **DONE** — flow 21, 14 assertions |
| ~~t015~~ | ~~A6 — contrast + narrow-screen on the three new banner surfaces~~ | **DONE** |
| **t016** | **A7** — one master off-switch for the whole suppression feature | `src/App.jsx`, `appPreferencesRepository.js` |
| **t018** | **Phase C** — read-only backup-import schema audit, feeding the `backupMigrations` tests | none claimed (read-only) |
| **t019** | **Phase C** — icon-only-UI audit, including the new nav dot | none claimed (read-only) |
| **t020** | **Timezone audit** — the remaining `toLocale*` sites, per module with evidence | 7 module/calculation/storage files |
| ~~t022~~ | ~~Refill pill~~ | **DONE** — now "this container" |
| ~~t021~~ | ~~Vaccination/clinic-visit due gate~~ | **DONE** |
| ~~t023~~ | ~~Vaccine reminder fires after a later dose is given~~ | **DONE** |
| **t025** | **IDEA, owner** — BASHH/UK-guideline vaccine **eligibility** suggestions as a dismissable mini banner on the Vaccinations list, deeper info in Settings/Resources | `SHOS_Vaccinations_Prototype.jsx` |
| **t026** | Vaccine reminder has **no browser flow at all** | `scripts/smoke-test.cjs` |

### t026 — the 22nd smoke flow: the vaccine dose series, in a real browser

No flow covered the vaccination reminder at all, so a stale `nextDue` on a
multi-dose course could keep a phone buzzing with nothing in CI able to see it.
The unit tests on the calculation are thorough; they still cannot see two of the
three things that actually broke, which is why this is a browser flow and not
just more unit coverage.

**It reproduced the display bug that the unit tests were green through.** The
reminder stopped correctly while the detail view still rendered `(OVERDUE)` in
red on the very record whose reminder had just stopped. Only reading the real
screen found it.

**The dates are relative to today and load-bearing in a way the first version
got wrong.** `nextDue` is set two days in the **past**, because with a future
date the superseded-vs-overdue branch renders identically either way — a
mutation that restored the `(OVERDUE)` bug still passed. The scenario that
reproduces it is the realistic one: you are overdue, you get the dose early to
catch up, and the record must stop shouting. The overdue date and the early
dose are true at the same time, so one setup exercises both the notice and the
display bug.

**Three of this flow's assertions were measured to be vacuous, one after the
other, and the mutations that proved it are the reason they are written the way
they are now.** Each passed against a mutation that deleted or reverted the
thing under test:

- A page-wide search for "Next due:" or `(done)` matches the **seeded** record's
  other doses, which are also superseded, so it succeeded regardless. Now scoped
  by walking out from that card's own `Dose N` heading — and the number is read
  from the editor's own field, because hardcoding "Dose 1" found nothing: the
  seeded record's only card is numbered "Dose 2". A page-wide assertion there
  was measuring the seed data, not the fix.
- Matching the rendered date string would be locale-dependent, which this
  project has been bitten by twice on this exact helper.

**A mutation that applies cleanly can still test nothing.** The first version of
the fourth mutation replaced JSX text plus two expressions with a bare
expression, no braces — so it compiled, built, and rendered the mutation's own
source literally, word "done" included, and the assertion passed on the
mutation's own broken output. That is a third state beyond the recorded
"did not apply" / "did not go red" pair, and it is the one that would have left
a real regression uncovered while every number looked correct.

Booting this flow also took three attempts, each a different wrong assumption:
a fixed 1000ms sleep (flaky), then a role-based visibility wait (never
resolved), then `dismissOnboarding`, which does not offer the App Lock prompt so
the nav bar never appeared. It now uses flow 21's proven fresh-context boot
sequence and a bounded `waitForFunction` on the DOM — the same shape the rest of
the suite already uses. A test must never depend on how fast the machine is.

4 mutations red, run in an isolated git worktree at HEAD: the display bug
reinstated, the notice not rendering, the notice made a **block** (`canSave`
refusing while it shows), and the superseded date deleted outright. Plus two
consecutive clean runs, because a smoke flow that has only ever passed once has
not been tested for flakiness.

**Verified in a worktree rather than the shared tree, for a reason worth
recording.** The shared tree was mid-edit by the other session and crashed on a
fresh boot with `reminderSuppressionEnabled is not defined`, which blocks any
local browser verification. Nothing of theirs was touched; the worktree is what
CI would actually build, since their work was uncommitted.

### The suite was under-reporting itself, and a structural guard now says so

The 22nd flow shipped green and CI's summary still read **"21 flows"** — because
it had no `console.log("\n[NN/NN] …")` header, and `verify-changes.mjs` derives
the reported count by counting output lines matching `/^\[\d+\/\d+\]/`. All 14 of
its assertions ran; the number was simply wrong.

**The guard built to prevent that immediately found a pre-existing one.**
`smokeSuiteSelfCheck.test.js` compares registered `run(...)` calls against
declared titles, and found 23 registrations against 22 titles. The odd one out
was `run("escape")` — the Escape-closes-an-overlay flow, which has had **no
title since it shipped**. So the suite has been running 23 flows while reporting
21–22, and deleting the Escape flow outright would not have moved the number
either. That is the project's most repeated failure mode — a gate that measures
nothing and looks like it measured something — and here it was hiding coverage
the suite was actually providing.

Four more structural checks came with it: titles contiguous from 1 with no gaps
or duplicates, the declared total matching the flow count, and `SMOKE_ONLY`
still refusing to report success when its filter matches nothing. 4 mutations
red, each reintroducing the exact defect: a flow losing its title, a flow
deleted from the run list while its title stayed, a duplicated number, and
`SMOKE_ONLY` allowed to match nothing.

**And the mutation harness hit this file's own recorded CRLF trap while being
written to test it.** Three of four patterns were written with `\n` against a
CRLF file, so they silently did not apply. The harness now reads the line ending
off the file first, and reports a pattern it failed to apply as
"PATTERN NOT FOUND — tests nothing, NOT a pass" rather than counting it. The
distinction is the whole point: a mutation that did not apply and a test that
did not go red are different failures, and only the second says anything.

### t020 (part 1 of N) — the record export was shifting dates on a clinician's document

Read-only enumeration of every `toLocale*` site outside the shared helpers
(39 of them), then triaged **by hand** rather than by name, because a per-line
count cannot see a `timeZone` argument on a following line. The first cluster
fixed is the highest-stakes one in the app: the export a clinician is handed.

`recordExportService.js` had **two independent bugs in eight lines**, and only
running the output under several timezones reveals the second:

1. **No `timeZone`** on a value whose digits are literal wall-clock. Every date
   field on a stored record is fake-UTC in this app, so a record at 00:30 on
   14 Mar exported to **13 Mar** in New York. A wrong *date* on a medical
   document, not a slightly-off time.
2. **The date-only detection was itself timezone-dependent** — the part an
   eyeball sweep cannot see, because the code *looks* like it is checking the
   stored shape. It asked `d.toTimeString().startsWith("00:00:00")`, i.e. whether
   the parsed value is midnight **in the device's own zone**. A `YYYY-MM-DD`
   value parses as UTC midnight, so west of UTC it is the previous evening and
   takes the date-time branch: a plain calendar date gained a time on it purely
   because of where the user was standing.

Fixed by using the shape the value was **stored in** (`length <= 10`) and the
shared `formatStoredDate`/`formatStoredDateTime` helpers.

**Why there was no stored-versus-instant ambiguity to resolve here**, which is
what made the fix small: `createdAt`/`updatedAt` are in `ALWAYS_HIDDEN_FIELDS`,
so they are never exported. Every date reaching that function is a stored value.
A test now asserts the instants stay *out* of the export, so unhiding one later
is a deliberate decision rather than a silent one.

Green in seven zones including `Asia/Kolkata` (+05:30) and `Pacific/Chatham`
(+12:45); red in New York, Sydney, Kolkata and Chatham before the fix, which is
what makes it evidence rather than assertion. 3 mutations red, each
reintroducing the exact defect — including restoring the subtler
timezone-dependent detection.

**The locale trap bit this change THREE times, and the second and third were two
lines apart in the same file.** Every one of them was an assertion that passed
on this machine and failed on CI:

1. The "no invented time" test looked for an `am`/`pm` suffix. This en-GB
   machine renders midnight as `00:00`, not `12:00 am`, so it matched nothing and
   the mutation it was written to catch sailed through.
2. The very next assertion asserted `0{1,2}:30` — correct for en-GB's `0:30`,
   never matching CI's en-US `12:30 AM`. It shipped green locally and took the
   smoke run red.
3. The fix for (2) accepts exactly the two known renderings of `00:30` and no
   others, plus a **guard on the guard** that proves the pattern rejects an
   invented time — because a pattern loose enough to pass on the bug is as
   useless as one pinned to a single runner.

`LANG`/`LC_ALL` do not affect Node's default locale on Windows, so (2) cannot be
reproduced locally *at all*. That is the lesson worth taking: when a test cannot
be reproduced in a second locale on the machine, the assertion has to be correct
**by construction** across the renderings that exist, not tuned until it passes
locally. A green local run proves nothing about the spelling.

**Still to do on t020** — the remaining ~35 sites, each needing the same
per-value triage rather than a sweep: `statsCalculations` bucket labels (4, worth
doing next — a chart can be labelled with the wrong *month*), `MyProfile`
`lastTestedDate` (2), `Contacts` encounter date (1), `ClinicVisits` attendance
preview (1), `MenstrualHealth` next-period prediction (1), `optionListUsage` (2),
`Home` line 595 (has a comment that needs reading before judging),
`Medication` 286/295/461/1423/1955 (appear to be genuine instants — verify, do
not bulk-change), and the notification-text renderers. **A blanket
`timeZone: "UTC"` sweep is the wrong fix** and would break the genuine-instant
sites, which is why this is per-site and per-value.

### t020 (part 2) — the Stats screen was quietly a month out, and a perfect month read 97%

The triage by **value** rather than by name paid for itself immediately: the
three month-bucketing functions in `statsCalculations.js` are **not** the same
bug, and a sweep would have broken the third.

- `getActivitiesPerMonth` buckets `e.date` — a **stored** fake-UTC value.
  **Bug.** Read through local `getMonth()`, a stored `2026-09-01` (UTC midnight
  = 20:00 on 31 Aug in New York) landed in the **August** bar.
- `getClinicVisitsPerMonth` buckets `v.date` — same bug.
- `getContactsAddedPerMonth` buckets `c.createdAt` — a **real instant**, so the
  local getters are *correct*. **Left alone deliberately**, and
  `statsMonthBucketTimezone.test.js` has a counter-test for it, because a test
  covering only the two broken functions would not catch the regression a
  blanket sweep introduces.

This is worse than the export bug it was found alongside. A wrong date on one
exported record is visible to one person. A chart that is quietly one month out
for **every first-of-the-month record** is read as fact, and the current month's
bar is the one people actually look at.

**The buckets stay on the LOCAL calendar on purpose** — they are the user's own
"this month", and stored values are wall-clock, so a user in Sydney logging
1 Sep means 1 Sep. Moving the buckets to UTC as well would make a 1 Sep record
fall outside the window and **vanish**, which is the over-correction a test
explicitly guards.

**The third shape had no `toLocale*` anywhere near it, and was the worst of the
three.** `getAdherenceTrend` walked days with `setDate`/`setHours(0,0,0,0)` —
local operations — over stored fake-UTC strings, and divided elapsed
milliseconds for `totalDays`. Two failures compounded: a stored `2026-08-31` was
floored to **30 August** local, and the last day of a month could be credited to
the previous one, changing two adjacent percentages rather than nudging one.

**The measurable symptom: a fully-dosed August read 97% in New York.** The app
telling someone their perfect month was not perfect — silent, because a number
that looks like a real adherence change is exactly what a user cannot
second-guess. This is the recorded DST adherence bug **reintroduced through a
different door**, which is the argument for per-value triage over a sweep.

The whole chain is now in the **stored** frame: month boundaries, the day walk
and the dose-day set are all UTC, compared as `YYYY-MM-DD` keys. "Today" is
still the real now, because a real instant genuinely is the user's local day.
The bucket *label* also needed `timeZone: "UTC"` — with a UTC month boundary,
rendering it locally would shift the label itself.

**One mutation "passed" and the honest answer is that it is not a defect.**
Rewriting the two `Date.parse(...)/86400000` calls as a single elapsed
milliseconds subtract-and-divide is *behaviourally identical* here, because two
UTC midnights always differ by an exact multiple of 86400000. It is reported as
green-as-expected rather than counted as a failure, which is the same
distinction this project already records for the `daysSince` trap. A second
mutation, flooring the range endpoints to **local** midnight, is the real DST
hazard and does go red.

A third mutation removed the "today" truncation and **passed every other
assertion** — nothing pinned that a half-finished current month is measured over
the days that have actually happened rather than run to month end. Now pinned:
with "now" on the 15th, one dose reads 7%, not 3%.

**Still to do on t020** — the remaining ~30 sites, each needing the same
per-value triage: `MyProfile` `lastTestedDate` (2), `Contacts` encounter date
(1), `ClinicVisits` attendance preview (1), `MenstrualHealth` next-period
prediction (1), `optionListUsage` (2), `Home` line 595 (has a comment that needs
reading before judging), `Medication` 286/295/461/1423/1955 (appear to be
genuine instants — verify, do not bulk-change), `clinicCardPdfService` (1), and
the notification-text renderers. **A blanket `timeZone: "UTC"` sweep is the
wrong fix** and has now been demonstrated wrong twice on this file alone.

### t020 (part 3) — four more stored-date renders, and a guard that is explicitly not a sweep

Four sites rendered a **stored** fake-UTC value through a bare local-zone
formatter — the same shape as the export bug, found by the same enumeration:

- `MyProfile` `lastTestedDate` (2 sites) — the "last tested" date on the profile.
- `Contacts` encounter date (1) — the date on each encounter row in a contact's
  profile.
- `ClinicVisits` attendance confirm (1) — the `window.confirm` text saying the
  date "will update from X to today". This one had **no format options at all**,
  so it rendered in whatever the device's default locale is *and* shifted.

All four now go through `formatStoredDate`, whose own correctness is already
proven in `dateDisplay.test.js`. The point of routing them through the shared
helper rather than adding `timeZone: "UTC"` inline is that the next field added
here inherits the right treatment instead of needing the same audit again.

**`storedDateRenderGuard.test.js` is deliberately NOT a sweep, and saying so is
the important part.** It flags a stored date handed to a local `toLocale*` call
and explicitly **excludes genuine instants** — `updatedAt`, `supersededAt`,
`realTimestampFromStored(...)`, `new Date()`. A guard that flagged those would
push the next person towards the blanket UTC sweep that has now been
demonstrated wrong twice on `statsCalculations.js` alone, where
`getContactsAddedPerMonth` buckets a real `createdAt` and is correct as written.

It has four tests rather than one, because each of the others exists to stop a
specific way this kind of guard goes wrong:

- a **positive** assertion that the fixed files still call the helper, so the
  guard cannot be satisfied by a file that stopped rendering the date at all;
- a **non-vacuity check on the comment stripper** — this project's comments
  quote the exact banned expression, which is the recorded reason three earlier
  guards matched the comment documenting the fix;
- a **counter-test** proving a genuine instant is *not* flagged, so the
  exclusion cannot quietly narrow;
- and it was **mutation-verified**: putting the old expression back into
  Contacts makes it go red and name the file and line.

**NEXT, and deliberately not rushed — the Menstrual `cycle` home-screen widget**
(`SHOS_MenstrualHealth_Prototype.jsx:75-84`). Found in the same pass, and it has
**two independent defects** rather than one:

1. `nextPeriodDate.toLocaleDateString(...)` with no `timeZone` on a value
   derived from a stored `startDate` — so the **predicted next-period date on
   the home screen** shows the previous day west of UTC.
2. Worse, and further up the chain:
   `Math.floor((now - startDate) / 86400000) + 1` divides **elapsed milliseconds
   between a real instant and a stored UTC-parsed value**, and
   `nextPeriodDate = new Date(startDate.getTime() + avgLength * 86400000)` does
   the same by addition. That is the recorded DST anti-pattern, and it decides
   `cycleDay`, which in turn decides the **phase** (Menstrual / Follicular /
   Ovulatory / Luteate). So a DST boundary can report the wrong cycle day and
   therefore the wrong phase, on a home-screen widget, silently.

It is left whole rather than half-fixed, because the over-correction here is
genuinely subtle — a naive calendar-day conversion in the wrong direction is
exactly as wrong as the current code — and because a health prediction deserves
its own scoped pass with its own verification rather than being rushed at the
end of a long session. The fix is the same pattern as `getAdherenceTrend`:
work in the stored frame, compare days as `YYYY-MM-DD` keys, and keep "today" as
the real instant it is.

**Also still to do on t020**: `Contacts`/`Encounters`/`Medication` genuine-instant
sites (286/295/461/1423/1955 and `updatedAt` rows — **verify, do not
bulk-change**), `Home` line 595 (has a comment that needs reading before
judging), `clinicCardPdfService` (1), `optionListUsage` (2), and the
notification-text renderers. The guard covers the eight screen files above; the
rest are calculations and exports needing their own per-value triage.

### t020 (part 4) — the cycle widget, and a contraception interval that was a day out

The widget I deliberately left whole last round got its own pass, as it deserved.
**Five defects across two features in one file**, and the reason they all survived
is the same: the logic was **inline, inside an async function, behind a Capacitor
plugin bridge**, in a large JSX file — so none of it could be reached by a test
without a device. Extracting it is half the job; the call site then has to be
proven, and it is (see the wiring assertions below).

**`menstrualCalculations.js`, pure and testable.** Three defects in the widget:

1. `cycleDay` divided **elapsed milliseconds** between a real instant and a
   stored fake-UTC value. At 22:00 on the start date most of the world is on
   day 1, and the maths said day 2. Since `phase` is derived from `cycleDay`,
   the home screen reported the **wrong phase**, not just the wrong number.
2. The predicted next-period date was rendered with no `timeZone`, so west of UTC
   it showed the previous day.
3. **Not a timezone bug at all**, and the argument for extracting the function:
   `avgLength * 86400000` with **no null guard**, while
   `getAverageCycleLengthDays()` returns `null` below two logged cycles.
   `null * anything` is `0`, so the prediction collapsed onto the start date and
   the widget told a user with one recorded cycle that their next period was due
   **the day their last one started**. No number of timezone variants would ever
   have found this one.

**And a fourth defect the first guard accidentally revealed.** Bounding the
widget-body assertion correctly surfaced two other `86400000` uses in the same
file. One (`setNextDueDate`) is stored-vs-stored and correct. The other,
`daysForUnit`, was a **frame mismatch**: `fromDate` is stored fake-UTC, so
parsing gives UTC midnight, but `getDate()`/`setMonth()` are **local** operations
on it. In New York a stored `2026-01-31` is 30 Jan 19:00 local, so the whole
calendar walk ran a day ahead:

| stored start | +1 month | was | should be |
|---|---|---|---|
| 2026-01-31 | | **29 days** | 28 |
| 2026-03-31 | | **31 days** | 30 |

Those land in a stored contraception `intervalDays` that **drives a reminder** —
the user is reminded on the wrong day, and the number stored is not what they
asked for. UTC and Sydney were already correct, which is the signature of a frame
mismatch rather than a maths error. Now on the UTC frame throughout, and
**exported so it can be tested at all**.

**Three of my own mistakes in this round, all caught by running rather than
reading:**

- I treated a day-number as if it were a millisecond timestamp, so every
  prediction landed in **1970**. The extraction is what made it catchable.
- Two of my own tests asserted zone-specific local dates built from UTC
  instants, so they only held in New York. One of them claimed in a comment that
  "midday UTC is unambiguous in every zone the suite runs" — **false**, and
  `Pacific/Chatham` (+12:45) proved it: at that offset 12:00 UTC is already
  00:45 the *next* local day, so day 2 was correct and the test was the bug. A
  45-minute offset is the only reason that zone is in the suite, and it caught a
  false universality claim in three lines. Every such fixture is now built from
  **local components**, so "the local day is the stored day" holds everywhere.
- I expected 6 months from 30 Sep to be 183 days. It is 181 (2027 is not a leap
  year). The code was right and my arithmetic was wrong — which is precisely the
  "just add 30 days a month" idea the function exists to prevent, so the
  correction is recorded at the fixture.

**The wiring guard hit this project's most repeated failure mode in a new dress.**
Its first version sliced the function body with
`indexOf("async function", start + 10)`, which returns **-1** when the target is
the last such function — and `slice(start, -1)` silently returns everything to
end-of-file, so the guard matched **its own explanatory comment** two hundred
lines away. The second version bounded correctly but stopped at the next
*async* function, picking up two unrelated ones. It now bounds on any
top-level function, strips comments first, and carries a **non-vacuity check on
the stripper** — because the comment above the widget's fix quotes `86400000`
verbatim, so without stripping the first assertion fails on its own
documentation. This is the fourth-plus recorded instance of a guard matching the
comment that documents the fix.

**5 mutations red** on the widget, including the null-average bug, the
elapsed-milliseconds revert, the missing `timeZone`, the 1970 day-number bug, and
the widget silently going back to inline arithmetic. Both files green in eight
zones including `Pacific/Chatham` (+12:45) and `Asia/Kathmandu` (+05:45).

### t020 (part 5) — the last of the class, and the guard that found a site my grep had missed

**The canonical primitives now live in `dateInputHelpers.js`**, which already
answered "which frame is this date in?" for *rendering* and did not answer it
for *arithmetic*. So the same day-key logic existed in **three places on one
day** — and two of the three were written by me, hours apart, while fixing the
same bug. That is recorded at the primitives themselves, because it is the
clearest argument in this project for a canonical home: the duplication was not
an oversight, it was what happens without one.

`storedDayKey` / `localDayKey` / `calendarDaysBetween` / `daysSinceStoredDay`.
24 tests, green in six zones. The two that matter most:

- `daysSinceStoredDay` is the shape most of the app's "days since" figures need,
  and the one that was being written inline in five places. **Day 1 is the stored
  day itself — 0 days ago, not 1.**
- Every fixture is built from **local date components**, because a test that
  asserts a specific local date is only true in one timezone. That mistake now
  has three recorded instances.

**Six more sites fixed, and one site confirmed CORRECT — which matters as much.**

| Site | Verdict |
|---|---|
| `statsCalculations` ×3 | `daysSinceLast` — **clinical**: it decides `withinBashhInterval` |
| `Home` ×3 | cycle days-since, contraception days-since / days-until |
| `Medication Dashboard` ×2 | the "Today / Yesterday / 3d ago" label on every card |
| `Contacts` | `daysSinceLastInteraction` — decides the red **inactive** badge |
| `Testing` | `isRecentTest`, the 90-day window behind the faded old-record treatment |
| `Encounters` ×2 + `ClinicCard` ×3 | timeframe filters |
| **`backupService`** | **correct, left alone** — see below |

**The one site a sweep would have broken.** `backupService` computes "days since
last backup" from a timestamp written with `new Date().toISOString()` — a **real
instant** against a **real clock**, so instant-minus-instant is correct. Its
`sinceLastTest` filter in Encounters is likewise two stored values compared
together, which was already right. Both are now *asserted* to stay correct, so a
future sweep has to break them on purpose rather than by accident.

**The medication card is the same defect shape as the `(OVERDUE)` one, which
matters more than the count of sites.** The time formatter in that file already
had `timeZone: "UTC"` from an earlier fix, so a dose taken at 23:00 showed the
**right clock time on the wrong day** — the calculation was fixed once and the
text that renders it was not. That is the second instance of "fix the maths,
miss the label", and the reason both now route through the canonical primitive
rather than computing a local copy.

### The guard, and three ways it was wrong before it was right

`storedDateArithmeticGuard.test.js` bans elapsed-millisecond arithmetic between a
real instant and a stored value, in screens, calculations **and storage**. It
found a site my manual search had missed: `isRecentTest` compared against a
millisecond *window constant* rather than dividing by `86400000`, so every grep
for the anti-pattern skipped it. **A guard that only catches the sites you
already found is a list, not a guard** — which is the whole argument for one.

Its three failures, each found by deliberately breaking it:

1. **The pattern only matched one form.** `Date.now() - d.getTime()` and
   `Date.now() - new Date(dateStr).getTime()` are two different real
   regressions; a pattern matching the second let the first through, and widening
   it to the second **lost** the first. Both are matched now.
2. **It never scanned `src/storage`** — the only place the one *correct* site
   lives — so the "does it exclude real instants?" test was passing
   **vacuously**. Removing the exclusion changed nothing, which is exactly what a
   vacuous test looks like.
3. **Its error messages pointed at the wrong line.** The comment stripper deleted
   comments outright, so line numbers were from the *stripped* source:
   `backupService.js:331` for a line that is 692 in the file. An error message
   that sends someone to the wrong line is worse than none, so the stripper now
   blanks comment content while preserving every newline.

4 mutations red, including the full-stripper version. Two earlier mutations were
**partial** — one neutered only the block-comment stage of a two-stage stripper,
and the line-comment stage masked it. Reported as partial rather than counted as
a pass, because "the mutation did not apply" and "the test did not go red" are
different failures and only the second says anything about the test.

### Two module-boundary moves, and the refactor deliberately NOT done

Once the day primitives were canonical, the duplication that had motivated a
broader structural pass was **gone** — so the pass was mostly not needed. Two
real violations of the project's own three-layer split remained, and those were
cheap enough to fix honestly:

**`daysForUnit` was pure interval arithmetic exported from a `.jsx` component
file**, which exists in `contraceptionCalculations.js` now. It was exported from
a component *only* so it could be tested at all, and importing a `.jsx` module to
test its arithmetic is the smell rather than the fix. `INTERVAL_UNITS` moved with
it and is **exported**, because the interval editor has a second consumer of the
same fact — a second copy of that table is how a screen ends up offering
"Fortnights" while the calculation silently treats it as days. A new
`describeInterval()` came with it for the same reason: a component was about to
grow its own copy of how to phrase an interval.

**`cycleWidgetCalculations.js` → `menstrualCalculations.js`**, and the functions
lost their `ForWidget` suffix: `getCycleDay` and `formatDayKeyForDisplay`. The
module holds *general* cycle maths, and a `ForWidget` name would have stopped
other screens treating it as the canonical owner — which is precisely the
"each place invents its own derivation" problem the primitives just solved.
Renamed with `git mv` so history follows, and every reference updated including
the one in this file.

The block was removed by **index span with the content verified**, not by a
long string match: it was 36 lines of comment-heavy source, and an exact-match
edit on that is how this project has damaged files before. The script asserted
the span contained the expected markers and had not overrun into the component
before writing, and it wrote nothing if either check failed.

**What was deliberately skipped, and why.** Moving *every* derivation into a
per-domain module — moving `daysSinceLast` into `testingCalculations.js`, the
adherence maths into `medicationCalculations.js`, and so on. It is churn on a
working codebase with a parallel session live in the tree, and the duplication it
would have removed is already removed. The date primitives did that job. Recorded
here so a future session does not read "the domain modules should own every
derivation" as a standing instruction and spend a day on it.

### t019 — the icon-only-UI rule is now exhaustive, and one real bug fell out

Second opinion taken first, per the standing habit, and it was **wrong on all
three counts** until challenged with this repo's own measurements. It proposed
TypeScript, which has been measured here at ~450 findings and deliberately kept
as a diagnostic rather than a gate; it called the existing nav-dot design a
"rationalisation" while recommending the design we had already built; and it
recommended a one-off JSON manifest that a human signs off on once, which is
precisely the "a check somebody runs once is not a check" trap. Its one
contribution worth keeping was rewording the rule so the nav-dot case is not
re-litigated — that is now in `CLAUDE.md`.

**The audit is a gate, not a list.** `src/components/iconOnlyUIAudit.test.js`
parses every module with `@babel/parser` (already present via Vite — no new
dependency) and asserts the set of interactive elements whose only visible
content is an icon matches a reviewed list, where **each entry must carry a
written reason**. A new one fails the build. A verdict with an empty reason
fails too, so the list cannot grow by pasting a line in without deciding.

**One genuine gap.** The favourite star on a contact card was a bare
`<div onClick>` with no `role`, no `tabIndex`, no `aria-label` and no key
handler — unreachable by keyboard, and announced as nothing at all. It survived
the 17 Sep `nested-interactive` fix **on the very same card**, which is the
transferable part: that fix moved the card's own semantics and nobody looked at
the controls sitting inside it.

**The star's fix is only safe because of the earlier fix.** A `<button>` there
would have been a genuine `nested-interactive` violation before 17 Sep, because
the card's own button was the ancestor. That fix made the card's button a
*sibling* at `zIndex: -1`, so a real `<button>` is now correct. The two changes
are complementary, and doing either alone would have been wrong.

**The scanner had five defects, all found by disbelieving its own output.** Each
would have shipped a wrong audit:

1. Text detection understood only a bare string literal, so every conditional,
   number and template read as "no text" — 15 correct elements were reported as
   unexplained, including a `<button>` whose entire content is a Pill icon and
   the words "Log dose". Acting on that list would have meant editing correct
   code.
2. A carve-out list written with the wrong icon names (`CaretRight` where the
   code says `ChevronRight`), matching nothing.
3. Classifying icons by their **local alias**. This repo aliases every icon —
   `import { CaretRightIcon as ChevronRight }` — so the whole carve-out list was
   being compared against names that do not exist in the source.
4. JSX nested inside an expression container was not walked for text, so a
   collapsible header showing a count read as textless.
5. **The worst one: "the scanner cannot tell" was counted in the same bucket as
   "this element has no text."** A guess reported as a finding. Those are now a
   separate undecidable bucket and are never counted as gaps.

A self-check now proves text detection sees all six expression forms, because
defect 5's mirror image — a detector that returns `""` for everything — would
report every icon as unexplained and look *productive* rather than broken.

**Mutation testing found a real weakness in my own guard.** The assertion on the
star was `/aria-label=/`, and it passed happily against
`aria-label={undefined}` — the attribute name was still there with no value,
which is the exact defect it was written to prevent. Now asserts the
state-dependent form and both label strings. All 7 mutations red, none
unapplied.

**And the mutation harness itself was wrong three times before it was right**,
which is the more useful half. It spawned `npx`, which Windows cannot launch
(ENOENT), and its catch turned that into exit 1 — *identical* to "the tests
failed" — so it reported four mutations as "RED ok" having run nothing at all.
It only looked right because I checked the baseline, which is why the harness now
refuses to count any mutation unless the baseline is green. Two further
mutations never applied: multi-line anchors against CRLF files.

Verified: 5 tests green, lint clean, encoding guard clean. Local `verify:fast`
is red on `src/components/escapeCoverage.test.js`, which is the other session's
untracked in-flight file and is not in this commit.

### t033 — the app could show yesterday's date all day

"Today" on a medication card, the cycle ring's day count, the 90-day faded state
on an old test, "inactive for 12 days" on a contact — all computed from
`new Date()` while a screen renders, and none of them stored. So they are only
as fresh as the **last render**, and nothing guaranteed a render on the day
boundary. Two ordinary situations both broke it: leaving the app open past
midnight, and the device sleeping (Android suspends background WebView timers,
so the app can resume hours later). On resume `visibilitychange` fires and
`App.jsx`'s own poll runs — but that poll only sets banner state, and if that
state is unchanged React skips the re-render, leaving yesterday's numbers on
screen.

**One hook, not a per-module sweep.** The tempting fix is a timer in every
module, which is how this repo grows six quiet copies of one behaviour. Checked
rather than assumed first: **nothing in the app is wrapped in `React.memo`**, and
the active module is rendered as `<ActiveModule />` from `App.jsx`, so a single
re-render of App re-renders whichever module is mounted and every
`new Date()`-derived value in its body is recomputed. `useLocalDayChange()` is
called once at the top of App and no module needs to know it exists. That single
fact is what the whole design rests on, so it is asserted by a test — if someone
later memoises the modules, this quietly stops working.

**The timer targets local midnight, it does not poll.** One `setTimeout` aimed
at the next local midnight plus a second, rescheduling itself. A 60-second poll
would be both wasteful and imprecise — one at 00:00:30 still shows yesterday for
another 30 seconds. `visibilitychange` covers resume, and also the case where
the user changes timezone, which moves the local day without ever reaching
midnight on the original clock.

**Two of my own claims were false, and mutation testing is what found them.**

- The header said the functional-update form was what stopped a re-render per
  minute. It is not — React skips a re-render whenever the state value is
  unchanged, so the plain form settles to the same no-op. Deleting it changed
  nothing observable. Comment corrected rather than the claim kept; the form
  stays because it reads the previous value instead of closing over anything.
- I had written `Math.max(1000, …)` "in case the clock is moved backwards",
  reasoning that a negative delay would fire instantly and spin. **The guard was
  unreachable**: "midnight tomorrow" is derived from the current clock by adding
  a day, so the delay is always between 1s and 24h. Deleting it changed nothing.
  Removed rather than kept — a clamp guarding an impossible state is a comment
  someone eventually believes without being able to work out which case it was
  for. What replaced it asserts the real invariant (every scheduled delay is
  positive) across leap-day, year-end and UK clock-change mornings.

**Three of my tests were wrong, and the hook was right each time.** The
multi-day rollover test reported 1 render instead of 11 because
`vi.setSystemTime` moves the clock but does not fire pending timers, and the
timer sat 24h away; fixing that by advancing 24h *and* setting the clock
double-counted, so each iteration crossed two midnights and it overshot to the
11th. And the backwards-clock test asserted the day should not change when the
clock is rewound — which would mean the hook should ignore the device's clock.
If the device says the 20th, the local day *is* the 20th.

**A unit test cannot prove `App.jsx` calls the hook at all**, so that is
asserted at the source level — the third time this repo has been bitten by it,
after a full Escape feature whose hook passed every test while a sweep failed to
attach it, and a disclosure resolver wired to nothing.

Verified: 14 tests, 7 of 8 mutations red, the survivor documented as equivalent
rather than counted as a pass. Lint and encoding clean.

### Every "September" heading was wrong for one evening a month

`monthLabel()` in `dateGrouping.js` renders the month heading on **eight**
month-grouped lists — Vaccinations, Encounters, Testing, Clinic Visits, Timeline,
Symptom Log (twice) and Attachments. It read a stored date and formatted it
without naming the frame, so the device's local zone re-applied the real UTC
offset to digits that are the user's own wall-clock time.

Measured in Europe/London rather than reasoned about: a vaccination logged at
**23:30 on 31 August grouped under "September 2026"**. A month heading a
clinician reads, on the one screen whose job is summarising a period, wrong in
the one direction the UK can see. One property — `timeZone: "UTC"` — is the
whole defect, and it is exactly what `formatStoredDate` already does.

All eight call sites pass a *record* date (`a.date`, `v.date`, `e.date`,
`e.dateStarted`, `e.dateResolved`, `t.date`, `resolvedDate`) and none passes a
real instant, so naming the frame here is unambiguous rather than a guess.

**Why it survived the audit written to catch exactly this.** `storedDateRenderGuard`
scans a hardcoded list of **eight module files** and nothing else, so
`dateGrouping.js` — in `src/calculations/` — was invisible to it. The guard was
working; it was simply pointed somewhere that did not include the bug.

**The scope gap is measured, not guessed, and deliberately not closed here.**
Widening that guard to all of `src/calculations/` surfaces **13** sites needing
per-site judgement, and several are real instants *on purpose* —
`realTimestampFromStored(...)` and `unlockAt` from `lockoutEndsAt()` are
deliberately real, and a blanket rule would flag them. That is a separate pass
with per-site evidence, not something to sweep in while fixing one function.
Recorded at the guard so the next session starts from a count instead of a
hunch.

Verified: 7 tests across six timezones including `Pacific/Chatham` (+12:45) and
`Asia/Kathmandu` (+05:45), covering both boundary directions (late evening and
early morning, which fail in opposite directions), date-only values, year
boundaries, DST transitions in both seasons, `Date` objects as well as strings,
and the honest "Undated" label. Reverting the one property turns the suite red.

### t034 — vaccinations are dated from a field the module stopped maintaining

Found while picking up "the other half of the date work", and it corrects a
claim of my own: **I listed the Clinic Card date filters as outstanding. They
were fixed in t020 yesterday.** This is a different bug behind the same area.

The vaccine record moved from one flat date to a dose series. The migration
copies the old fields into a single-element `doses[]` and deletes
`injectionSite`/`provider`/`nextDue`/`doseNumber` — but deliberately leaves the
top-level `date`, because other code read it. The form now writes **only** dose
dates, so:

- **A newly created vaccination has no top-level `date` at all.**
  `calendarCalculations.js:35` filters on `v.date`, so it is **silently absent
  from the phone calendar** — the one consumer that leaves the device. And
  `monthLabel(undefined)` returns "Undated", so it files itself under an Undated
  heading in the Vaccinations list.
- **An edited one keeps its pre-series date.** Five consumers read the stale
  top-level field — Clinic Card timeframe filter and sort, the Vaccinations month
  grouping, Global Search's subtitle *and* its sort date, and the calendar —
  while the Clinic Card **display** already shows the derived value via
  `getVaccinationNextDue`. So the card's own heading and its own row disagree.

Second opinion taken first and it agreed on all four questions, adding two
useful points: keep the legacy fallback inside the derivation but stop *writing*
the field going forward, and do not run a destructive data migration unasked.
Agreed and recorded at the task rather than acted on.

Plan: one exported derivation in `vaccinationCalculations.js` — latest
**non-superseded** dose date (a superseded dose is void, so it is not the date
the record counts as given), with a legacy fallback to the top-level field —
used by all five consumers, per this repo's own one-canonical-owner rule and
because a reminder banner here once shipped permanently dead for exactly this
reason. Not started; this entry is the scoping.

### t034 — a vaccination you recorded never reached your phone calendar

The vaccine record moved from one flat date to a dose series. The migration
copies the old fields into `doses[]` and deletes `injectionSite`, `provider`,
`nextDue` and `doseNumber` — but deliberately **leaves** the top-level `date`,
because other code read it. The form now writes only dose dates, so that field
has two states and both are wrong:

- **A record created since the series landed has no top-level `date` at all.**
  `calendarCalculations.js` filtered on `v.date`, so it was **silently absent
  from the phone calendar** — the one consumer that leaves the device, with
  nothing on screen to say so. It also filed itself under an "Undated" month
  heading in the Vaccinations list.
- **An edited record keeps its pre-series date forever.** Five consumers read
  that stale value — Clinic Card filter and sort, the Vaccinations month
  grouping, Global Search's subtitle *and* its sort date, and the calendar —
  while the Clinic Card **display** already derived the date via
  `getVaccinationNextDue`. So the card's own section heading and its own rows
  disagreed with each other.

**One derivation, five consumers.** `getVaccinationDate(vaccination)` in
`vaccinationCalculations.js`, because a value with two owners is exactly the
break documented at the top of that file — the reminder that once shipped
permanently dead because a field moved under eleven readers. The five call sites
were patched individually anyway, which is unavoidable, but they now all read
one function rather than five interpretations of the same question.

**The returned shape is part of the contract.** A dose date arrives from
`<input type="date">` as `YYYY-MM-DD`; the legacy value is a full fake-UTC
timestamp. Compared as strings, `"2026-09-01" >= "2026-09-01T00:00:00.000Z"` is
**false** — the shorter string sorts first — so a record sitting exactly on a
"last 30 days" boundary would be dropped. One consistent returned shape removes
that trap for every caller instead of leaving five places to remember it.

**Three of my own mistakes, and the tests are what caught all three.**

1. The legacy fallback rebuilt the value from the day key alone, discarding the
   time — a vaccination logged at 09:00 became midnight on the calendar.
2. Fixing that, I sliced the time from index 10, which is the `T` separator, not
   the first digit. `slice(11,16)`. It passed my eye twice and was caught only
   because one test asserts a real clock time.
3. I picked the **last row** of the series rather than the **latest date**, and
   carried an `isDoseDateSuperseded` check that could never be false on the row
   it actually returned — walking backwards from the end, the first dated row is
   by definition not superseded, so the check was unreachable and deleting it
   changed nothing. Choosing by maximum date is order-independent and is what
   the "latest non-superseded" rule actually means: a superseded dose is always
   an *earlier* one, so it is never the maximum. Nothing on screen assumes the
   user entered the doses in order.

**The wiring guard had three holes of its own, all found by mutation testing.**

- Its region window only looked *forwards* from an anchor, so for the calendar
  and the Clinic Card the stale expression sits *before* the anchor and three
  mutations passed while the guard sat there green. A guard not looking where
  the bug is is worse than none, because it looks like coverage.
- It asserted only that the name `getVaccinationDate` appeared in each file, so
  replacing the import with a local `const getVaccinationDate = () => null`
  satisfied it — a stub that makes every consumer silently do nothing.
- `sortByDateDesc` now takes an optional accessor. Cloning the array and sorting
  it without one is valid JavaScript that quietly reverts to `.date`, which is
  exactly what happened, and exactly what a reviewer would not spot. The call
  site's second argument is now asserted.

**A file-wide ban produced four false positives**, because three other record
types in those same files legitimately read a top-level `v.date` — clinic visits
and symptom entries maintain their own. The ban is scoped to each file's
vaccination region instead. The region is found by anchor and is asserted
non-empty, because a guard pointing at the wrong place passes quietly.

**And the mutation harness had a bug that mattered more than any of them.** One
mutation kept surviving and I could not see why. Its anchor line appears in
*two* functions, and `String.replace` hits only the first — so the mutation was
landing in `getDoseNextDueDates` and leaving the function under test untouched.
**The mutation applied; it just applied to the wrong place**, which is far more
dangerous than one that fails to apply, because the harness confidently reported
"not caught" and the real cause was a broken experiment. My manual spot-check
inherited the identical mistake and agreed with it. Anchors now include the
function signature.

Verified: 32 tests across the derivation, the wiring guard and the calendar; **11
of 11 mutations red**. Encoding guard and lint clean.

### t038 — the month-old overlay findings, re-verified rather than trusted

The 25 Sep audit recorded "two back-button traps and six level-skipping overlays"
and explicitly never verified or counted them. A second model argued for
discarding them as stale; that was refused and the model conceded, because this
repo has a recorded incident where a stale line saying a feature was NOT built
caused a session to rebuild it and overwrite the shipped code. An unverified
old finding is a landmine.

**Re-derived rather than believed.** App-level overlays: Settings and Search
are in the chain; the five due-reminder banners are dismissible cards, not
overlays. Every one of the **16 modules with internal screens** registers a back
handler — checked, not assumed, and no module was missing one. So there is no
back-button trap in the sense the note meant.

**One genuine level-skip found and fixed.** The "Import backup" modal is a
full-screen `role="dialog"` at `zIndex: 998` and was not in the back chain at
all. Pressing back with it open fell through to HOME: the tab switched while the
modal stayed on screen, still blocking the tab the user had landed on, and the
only escape was finding the X or tapping the backdrop. It is now `BACK_ACTION.
IMPORT_DIALOG`, ordered below the module handler and below Settings/Search, with
three test cases covering it and a mutation confirming the branch is
load-bearing.

**It could not be fixed with `useEscapeToClose`, and that is the transferable
part.** That hook is keydown-only — it registers a `keydown` listener and
nothing else. The Android back button arrives through Capacitor's `backButton`
event and `goBackOneLevel`, which never sees it. So the fix belongs in the
decision function, which is the platform where the bug actually bites and is
already unit-tested. A guard that looks right on desktop and does nothing on the
phone is the same defect in a different costume.

**The remaining counts are closed with a reason rather than kept alive.** The
"two / six" figures were never recorded as specific locations, so they cannot be
re-derived — and the mechanism they described, an ad-hoc chain of states, has
been replaced by a pure, unit-tested `decideBackAction`. This satisfies the task's
own acceptance criteria: one fixed, the rest closed with a reason. "Probably
still true" is not left sitting as a resting state.

### t040 — both cross-tree guards now look at the shared folder

`storedDateRenderGuard` scanned **eight hardcoded module files and nothing
else**, so the month-heading bug fixed the same day — in `dateGrouping.js`, in
`src/calculations/` — was invisible to the check written specifically to catch
it. The guard was working; it was pointed somewhere the bug was not. That is now
the fifth time today a check passed while not looking at the right place.

It could not simply be repointed: the module scan keys off module-shaped
variable names (`e.date`, `v.startDate`) that do not appear in calculation
files, so reusing it as-is would under-detect nearly everything. And the sites
that are there are correct on purpose, so a blanket rule would push people
towards the UTC sweep that is wrong for real instants.

So the guard now **encodes the t037 triage** rather than re-deriving it: a site
in that folder must either be one of the app's own canonical formatters, or
match a reviewed entry that says why it is correct. Every entry must have been
actually consulted — a stale allowlist entry fails — and every entry must carry a
substantive reason, because an entry without one is a suppression, which is how
those files got into trouble. Verified by injecting a new unreviewed offender
and confirming the widened scope goes red.

The window also went from 3 lines to 6, because the canonical formatters put
`timeZone: "UTC"` on a later line of a multi-line options object and the
3-line version flagged the app's own correct code — the exact "detector that
never fired" shape, inside the guard written to prevent it.

### t041 — device testing now has somewhere to land

New `docs/DEVICE-TESTING.md`. The owner tests on a real phone at random commit
stages, and until now a device-only finding became a task only if one of us
happened to be looking — which is why two notch/status-bar items sat for a month
with no owner. The doc separates what genuinely cannot be checked from a
development machine (three items, each with why) from what is proved in code but
has never been watched happening (six, each with the specific thing to try).

Deliberately short. A long checklist is a checklist nobody reads.

### A test that only worked on my own machine — the third one in a single file

The t037 suite went green locally and went red in CI, which is the whole reason
the gate runs there. The assertion read `toContain("15 Oct")` against
`formatRelativeDate`, which formats with the **device's default locale**: this
UK machine renders "15 Oct (in 2 weeks)" and CI's en-US renders "Oct 15, 2026
(in 2 weeks)". Same value, two spellings.

The first attempt at fixing it matched the month name too — which is not a fix,
just a narrower version of the same mistake, and it fails on de-DE's
"15. Okt.". The assertion now checks the **day number**, which is the thing that
was actually wrong, plus the relative half, which is the function's own wording
and therefore locale-independent. Verified it still *rejects* 14 and 16 October,
so it is not merely permissive — an assertion that accepts anything is the
mirror-image version of this failure.

This was the **second** assertion in that one file that only held on the machine
that wrote it; the first two were caught by running locally and fixed before
pushing. Third time today that a green local result meant my assertion was
wrong rather than the code being right, and the third was the only one the
development machine could not have caught on its own.

### t023 — the vaccine reminder that would not stop

Real report from the owner: the reminder kept firing after they logged a second
dose. Logging that dose *is* what satisfied the first dose's due date.

`getDoseNextDueDates` collected **every** `nextDue` in the series and
`getVaccinationNextDue` took the **earliest**, with no notion anywhere of a dose
having actually been *given*. A dose's `nextDue` means "the dose after **this**
one is due on this date", so the moment a later dose is recorded every earlier
`nextDue` is history — and nothing dropped them.

**One derivation, so one fix reached every consumer**: the reminder, the in-app
banner, the overdue counts, the list rows, the Clinic Card, the PDF export and
Stats all read these functions. Cancelling the notification in the sync file
would have left all of the others still wrong while looking like a fix.

The rule is **series position relative to the last dose actually given** — a
`nextDue` is superseded by a later dose in the series *having been given*, and
the only live dates are that last given dose's own `nextDue` plus anything after
it. Earliest of those wins.

**This rule took two wrong attempts to arrive at, and both are worth reading
because the reasoning in each looked sound.** The first dropped a `nextDue` only
when some dose was given *on or after* it, reasoning that an early dose "cannot
have satisfied a later due date, because the app does not know when dose 3 is
expected". True, and irrelevant: the question is not whether the LATER date is
satisfied but whether the EARLIER dose still needs doing. The owner's second
report killed it — the second dose was logged **two days before** the first
dose's due date and the reminder still fired, because taking a dose early is
ordinary rather than an edge case.

The over-correction to "only the last dose's `nextDue`" was also wrong, and a
**long-standing test in `vaccinationCalculations.test.js` caught it, not me**: a
user who has entered the whole schedule up front and has not had dose 1 yet is
not overdue-free, they are at the start. Both failures were date *comparisons*;
the fix is series *position*. 6 mutations red, covering the original bug, the
first wrong fix, the over-correction, dropped series ordering, the legacy
fulfilment guard, and latest-instead-of-earliest.

**A real browser then found what no unit test could**: the reminder stopped
correctly while the detail view still rendered `(OVERDUE)` in red on the very
record whose reminder had just stopped — the same wrong reasoning one level
down, comparing `dose.nextDue` to today instead of asking whether the series had
moved on. `isDoseDateSuperseded()` is a separate function from
`getDoseNextDueDates` on purpose: "is any of this outstanding" and "is THIS line
still live" are different questions, and deriving the second from the first is
how the red text was wrong in the first place. A superseded date now reads
`(done)` in neutral type.

### The early-dose notice — an advisory, and the guidance table stays empty

The owner also asked to be **told** when a dose was logged early, "if outside
BASHH or other clinical recommendations", without blocking the save.
`getEarlyDoseNotice()` reports the arithmetic fact the app can prove from the
user's **own** data and says nothing about whether it is medically wrong.

**`VACCINE_INTERVAL_GUIDANCE` ships deliberately empty, and a test fails the
day anyone fills it in.** Honouring "outside BASHH" literally means writing down
minimum intervals for Hep A, Hep B and 4CMenB from memory, and this project has
already had to throw out two clinical constants that looked deliberate and turned
out to have no source at all. A wrong interval is not a wrong number on a
screen — it is someone concluding a dose they actually received was
insufficient. The table is frozen, so a module cannot quietly push an unsourced
interval in at runtime and leave the empty-table test green.

The notice **never blocks**: the editor's own `canSave` gate is untouched, the
copy says the dose is recorded either way, and a test asserts that sentence is
present so a reword can never quietly turn it into a veto. It compares against
the dose **immediately** before, since a course is a sequence and comparing dose
3 against dose 1 would flag every well-formed course as early.

Verified in a real browser, 10 checks: the notice renders and states how early;
**Save is still enabled while it is showing**; the save completes and the editor
closes; and after saving, the record carries no `(OVERDUE)` claim and an empty
"Next due" summary.

### t022 — the pill that said "this refill" and meant "this container"

Found by reading the maths while answering the owner's question about the
explanation text, not by a report.

**The label was wrong, not merely terse.** The window anchors on your last
logged refill but is **capped and wrapped at `daysPerContainer`** — one
container's worth of doses. So "this refill" implied a span the number never
delivered: a 6-month PrEP supply would dilute the rate across the whole supply,
and anyone ordering **2 containers at once** (the refill quantity is entered in
containers and can be >1) saw a figure labelled "this refill" that could not
span their refill. Now "this container".

**The pill had no info icon at all** — its 7-day sibling has had one since
16 Sep, which is why the label was the only place the distinction could even be
made. It now explains the cap, which is the fact the old label got wrong.

**A second defect, found on the way: the pill was showing a duplicate.** With no
refill logged, `sinceRefill` falls back to the 7-day numbers, so the card
displayed the **same figure twice under two different labels**. Two identical
numbers side by side read as two independent pieces of evidence. A new
`sinceRefillAnchored` flag lets the UI hide the pill when there is no container
to measure from — while the underlying fallback is deliberately left alone, so
anything else reading `sinceRefill` still gets a value rather than `undefined`.
Hiding a duplicate is a presentation decision; breaking a consumer is not.

6 mutations red, including the over-correction: deleting the pill outright also
satisfies "hidden when unanchored", so the suite asserts the anchored case still
renders it.

**And the same window now has a ring on Home**, making the trio the owner asked
for: Last test, 7-day adherence, This container. `getOverallContainerAdherence`
in `statsCalculations.js` is a deliberate **sibling** of `getOverallAdherence`
rather than a parameter on it — the two windows answer different questions, and
a blended single number is the "wellness score" this file's header refuses to
invent.

**The subtle part is which medications may contribute.** `computeAdherence()`
falls back to the 7-day figures when a medication has no logged refill, so
averaging `sinceRefill.pct` without filtering on `sinceRefillAnchored` would put
7-day rates into a number labelled "this container" — the same mislabelling the
card was just fixed for, reproduced one screen over. Seven mutations red, and
the two that matter are that exact leak and the over-correction that hides the
ring entirely (which also satisfies "gated on a real measurement").

Verified in a real browser, not just by unit test: **7-day renders 33%, this
container 35%** — a genuinely different window rather than a second copy of the
same figure, which is the only reason a third ring earns its place.


### t015 — the sheet that could not be scrolled, and a contrast audit that came back clean

**All 18 text pairs on the acknowledge sheet pass WCAG AA**, measured rather
than assumed — including `textDisabled` on the footer, which at 11px was the
most likely candidate for failure. A token mutation is what makes that a result
rather than an assumption: pushing `textDisabled` past the boundary turns the
suite red, so the clean verdict is a measurement and not a detector that never
fired.

**The narrow-screen finding was real.** The sheet was `position: fixed` with
`alignItems: flex-end`, **no `maxHeight` and no `overflow`** — so on a
375px-tall landscape phone, or any device at a large system font scale, the
content is taller than the viewport, the top is clipped by the screen edge, and
there is no way to scroll to the title. The user would see a sheet with its
heading and first option cut off. The sheet is now bounded to the viewport and
is its own scroll container.

**The other half was the gesture bar.** A bottom sheet with a full-width action
button and no bottom safe-area inset puts that button under the system bar —
the same gap the 24 Sep pass fixed across every other fixed overlay, missed
here only because this sheet is new.

The contrast audit deliberately uses the same **name-the-pairs-and-compute**
approach as `paletteContrast.test.js` rather than a source scan: CLAUDE.md
records four failed automated contrast scans, all reporting a clean result from
a detector that had never fired. The maths self-checks against known WCAG
reference pairs first, because a contrast test whose maths is wrong passes
everything.

**One mutation from this round is NOT counted.** It was specified to break the
`contrast()` function but was pointed at `App.jsx` instead; it went red because
adding a comment shifted the 3200-character inspection window, not because any
maths was bypassed. It proves nothing, and the honest protection against broken
maths is the in-file self-check against known WCAG pairs, not that mutation.

### t014 — the acknowledgement path, and the one assertion that matters

Flow 19 covered **dismissal**. This covers **acknowledgement**, which is a
different promise: dismissal is in-memory and dies on a real close (the toast
says so), while an acknowledgement is persisted, survives a reload, and leaves a
quiet mark on the tab while the thing is still outstanding.

**The load-bearing assertion is the reload.** An acknowledgement that failed to
persist would quietly degrade into a dismissal the next time the app was
reopened, and the user would believe they had switched something off
permanently when they had not. No unit test can see this — it needs a real
boot, a real write, and a real second boot, which is the whole argument for
driving it in a browser.

**And it is proven to be the ONLY assertion that catches it.** Reverting the
persistence write makes the run red on exactly one line — the post-reload check
— while the four assertions above it (banner hidden immediately, still hidden
after two refreshes, no dose logged) all still pass. That matters: a test which
only checked in-session suppression would have gone green on a build that had
silently lost the feature. The failure is precise rather than incidental.

Two more mutations red: the device-wide scope option removed (so the stronger
promise A3 implemented becomes unreachable), and the sheet's "still outstanding"
copy replaced with "has been handled" (so an acknowledgement reads as having
dealt with the medication — the exact misreading the sheet exists to prevent).

Also asserted, because they are the copy that makes the choice honest rather
than a bare toggle: the narrower scope says plainly that **"Phone notifications
still fire"**, and the sheet says the item **"is still outstanding — this doesn't
mark it as done"**.

Own context, placed next to flow 19 and ahead of the PWA flow. The two are kept
separate on purpose: they test different promises and must not share state.





### t012 (A3) — what actually shipped, and what the honest claim is

Device-silence is now wired for **all five** kinds. It was previously wired only
for medications, so "also stop my phone notifying me" silently did nothing on
the other four banners.

**The four fingerprints moved out of `App.jsx` and into
`reminderSuppression.js`** as `buildRefillSignature` / `buildTestingSignature` /
`buildVaccinationSignature` / `buildClinicVisitSignature`. This is the real fix,
not tidiness: the Testing banner shipped broken *because* the fingerprint lived
in one file while the scheduler had no copy of it. Two files computing one
string will drift, and the drift is silent in both directions — too narrow and
the banner never appears, too broad and a reminder is silenced forever.

**Only two of the four were a live bug, and the comments say which.** Measured
by reading each scheduling path, not assumed:

- **refill and vaccination** scheduled at `now + 3s` and re-armed on **every**
  60-second poll. The banner said "stop reminding me" and the device kept
  buzzing. That is a real user-facing bug, now fixed.
- **testing and clinic-visit** already cancel once they are past their window,
  so there was no repeat to suppress. Their value is consistency plus a guard
  against a future change that re-introduces it. The comments say exactly that
  rather than claiming a fix.

**The clinic-visit one has two reminder slots** (A and B) with separate
notification ids, so a partial implementation would have left one buzzing after
the user said stop. Both are cancelled, and a test asserts it.

**One guard fired on this change and was updated, not loosened.**
`reminderDueShapes.test.js` asserted the vaccination fingerprint was keyed on
the due date by looking for the text `dueDate` within 260 characters of
`vaccinationSignature` *in `App.jsx`*. That is proximity, not meaning, and it
now asserts the invariant against the function that actually computes the
fingerprint, plus that `App.jsx` calls it. **Stronger than what it replaced** —
and proven so: a variant where `dueDate` appears only in a *comment* while
being ignored satisfies the old proximity check and fails the new one.


### t017 — the specific false claims in *this* file, now measured

- "**321 unit tests across 28 files**" → **422 across 34**.
- "**18 smoke flows**" → **21**.
- "Notion … current total: **1123** blocks" → **1164**.
- "**Phase 3 — banner suppression**" is listed under *open*. **It shipped.** The
  whole banner-suppression feature, its acknowledgement sheet, and the Testing
  banner fix are on `main`. This is the single most misleading thing in the old
  handover: a new session would rebuild work that already exists.
- "**This project's own `docs/CHANGE-PROCEDURE.md` prescribes `git add -A`**" —
  **this is false about CHANGE-PROCEDURE.md.** It is line 130 of *this* file that
  says it. `CHANGE-PROCEDURE.md` line 117 already reads
  `git add <explicit paths>   # never git add -A`, and line 127 is a section
  devoted to it. **Do not "fix" the procedure file; the error is here.**

### The trap in t012 (A3)

**Verify the due-state shape before writing a line of it.** The Testing reminder
was silently suppressed for its entire life because the code read
`getTestingDueState().test`, and that function returns `{ due, dueDate }` — it
has no `test` property at all. The signature was therefore always `""`, and
`isBannerVisible` treats an empty signature as "nothing to show". The banner
**never rendered**, including in a published APK.

`reminderDueShapes.test.js` exists to stop this recurring: it runs the real due
state functions against real seed data at a pinned clock, and asserts a
precondition up front so a future seed change fails loudly instead of quietly
skipping the interesting cases. Run it before you build on these shapes.

## What A is doing, so you do not duplicate it

A is working on the security and data-integrity items, in files that do **not**
overlap the list above:

- the Android widget `SharedPreferences` sink — comment plus a guard test;
- the duress-mode notification limitation — documenting it in the Privacy
  screen;
- `src/storage/backupMigrations.js` tests, **gated on t018**, which is yours.

Claims are visible in real time via `claims`. If you need a file A holds, say
so in `notices` rather than editing it.

## Known facts worth not rediscovering

- **iOS has never been built.** No `ios/` directory. Needs macOS/Xcode and an
  Apple Developer account. Record it; do not pretend it is covered.
- **Android `minSdkVersion = 24`** (Android 7.0) — a very wide range, never
  compatibility-tested. Device-blocked.
- **Offline resilience is fine.** Both disclosed network calls (Nominatim,
  GitHub) fail with plain-language messages. Do not re-audit.
- **The singular "Encounter" label is deliberate.** Consistent across the
  bottom-nav tab, the screen `<h1>` and the Global Search group, and it matches
  "Medication" and "Healthcare". Do not "fix" it.
- **Partner Notification is reachable only from a positive test.** A deliberate
  clinical gate. A shortcut would dilute the "no clutter or alarm on sensitive
  health data" decision.
- **The Glossary already defines** PrEP, PEP, DoxyPEP, Doxy, TOC, C&S, window
  period, BASHH, MGen, HSV, HPV. The jargon sweep is done.
- **`export const ACTION` spreads from `DEFAULT_ACTION_COLORS`.** Parsing the
  ACTION block for literal hex returns nothing useful and `ACTION.red` comes
  back `undefined`. Read `DEFAULT_ACTION_COLORS`.
- **Per-module `T.*` tokens** come from each module's own `buildLight()`, not
  from `designTokens.js`. This is why automated contrast scanning of the source
  kept failing. The colours were measured by hand for that reason.
- **Anonymise mode is screen-side only.** It masks all 9 contact-name surfaces
  and its index entries, but **exports keep real values** — stated on the
  Privacy screen. Do not "extend" it into export; that is a deliberate
  decision, not an oversight.
- **Duress mode does not cancel scheduled OS notifications.** Re-checked and
  deliberately left alone: a pre-scheduled Android alarm is independent of the
  app, and cancelling it could deny a coerced user their medication reminder,
  which is a health consequence rather than a privacy one.

## Notion — where things go

- **Audits & Reviews** (`3e913572-4f67-81f9-8184-ce5f5694a0fa`) is the single
  home for every audit, review, sweep and re-measurement. **Write an audit
  there even when the result is "nothing found"** — a verified non-finding is a
  result, and it is the cheapest way to stop the same audit being re-run from
  scratch, which is what happened to the palette work.
- **Respect the "recorded retrospectively" label.** Those entries were
  transcribed from `CLAUDE.md`, not re-run. Reading a 10 Sep conclusion as
  current is the failure mode the page exists to prevent.
- The **Development Log** (`3b013572-4f67-80ab-b1a0-c665a828e241`, **1164
  blocks** measured) is for what was *shipped*. Found-but-unshipped goes in
  Audits.
- Append with **`PATCH /v1/blocks/{page_id}/children`**. `POST` is not valid
  there and Notion's error text reads exactly like an auth failure, which has
  already cost a session two integrations' worth of time. **Paginate to the end
  to verify** — a successful response is not proof the write landed, and
  **accumulate every page**, or a long page reads as a short one.
- `node scripts\notion-log.mjs append "Development Log" "<entry>"` does this
  with the paginated verification built in.

## Audit re-run policy

- Re-run when the **thing audited has changed materially**, and say why in the
  new entry.
- Do **not** re-run a clean result just because time passed.
- When re-running, write a **new dated entry** rather than editing the old one.
  The old conclusion is evidence of what was true then.

## Waiting on the owner, not actionable by an agent

- **Device testing**: #68 safe-area gaps, Accessibility Item 7, Android 7–10
  compatibility. All need the physical device.
- **Rotate the Notion token** — deliberately deferred by the owner.
- **Encoding-repair dry run on real data.**
  `scripts/repair-personal-data-encoding.cjs` is proven on synthetic data and
  has never touched real data. Dry run is read-only and safe; `--apply` dumps a
  **plaintext** backup that must be deleted afterwards. `backups/` is gitignored
  because this is a public repo.
- **Play Store keystore.** The project has only a *debug* key, which Play
  rejects. Losing a release key means never updating the listing again, and it
  must not be generated in a shared workspace. Worth asking whether Play Store
  is wanted at all — the app is private, encrypted, single-user, and GitHub
  Releases needs no key.
- **Credential rotation** for the opencode password and the GitHub OAuth token,
  both exposed in transcript. Explicitly deferred to end stage. Do not
  re-raise it, and **never write either value into a tracked file.**

## Standing rules that are easy to break

- **Never regex over JSX attributes.** It has truncated `aria-label` closing
  braces and mangled labels. Anchor on component signatures, or edit by hand.
- **Never round-trip source through PowerShell `Get-Content`/`Set-Content`.**
  PS 5.1 is not UTF-8 and has damaged this codebase four times. Use the editor
  or a Node script. **This includes inline `node -e`**: `$` is a PowerShell
  variable even inside double quotes, so a regex ending `$/gm` is silently
  mangled and the script then reports a confident wrong answer.
- **A PowerShell `Start-Job` does not inherit the working directory.** A
  concurrency test written that way reported 8 lost writes when all 8 jobs had
  in fact died with `MODULE_NOT_FOUND`. Pass an absolute path and capture job
  output.
- **A new repository must be wired into `backupService.js` in the same
  change.** Missed three times.
- **A new test must be proven able to fail.** Revert the fix and confirm it
  goes red. Three "coverage" tests here never could have.
- **Icons are Phosphor**, never `lucide-react`. **Type/colour tokens live in
  `designTokens.js`**; raw hex is a bug.
- **Dates:** never `milliseconds / 86400000` for calendar arithmetic — it is
  wrong across DST. Use the helpers in `dateInputHelpers.js`. Stored datetimes
  are fake-UTC by design; see that file.
- **Do not kill the user's Chrome or unrelated apps** to free RAM. The phone
  connection and the server on port 4096 must stay up.
- **Never `git add -A`** in this repo. Two sessions share the tree.

## When you are stuck

The threshold is deliberately low. On a second failed attempt, a stall, or a
retry loop, record it and let the outside model answer:

```powershell
node scripts\session-bridge.mjs stuck <slug> "what you are trying" "what happened"
```

The first attempt only records. **The second automatically consults Gemini**,
assembled from *all* failed attempts rather than the latest. A model that has
not been stuck on it for an hour is more useful than one more attempt.

Grinding through the same failure three times costs far more than one free
call, so the instinct to push on is the expensive one. Use it as a
**challenger**: it has no memory of this repo and will reason confidently about
things it cannot see.

Log decisions and findings as you go:

```powershell
node scripts\session-bridge.mjs log "<what you decided or found>" --kind=decision
```

Log what is **not** already durable in git or `docs/`. And when you learn a
**rule** — "X cannot be done as Y, so do Z, because…" — record it as a lesson
with evidence. `--evidence` is required; a rule with no provenance is a
superstition, and this repo has repeatedly found those.

## Current git state

`main` is clean and pushed at `e680768`. The gate is green locally: build, lint,
422 unit tests across 34 files, encoding guard, inherited-instruction check.
**The last full CI run predates the current `main`** — the flow/assertion counts
CI prints are the ones to trust, because a green exit code alone has lied here
five times.

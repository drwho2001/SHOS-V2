# Glossary — test and tooling vocabulary

Plain-language definitions for the terms this repo uses when it talks about
testing and CI. Written for someone who is not a developer; anyone can read
this.

## The basics

**Test.** A small piece of code that says "when I do X, I expect Y to happen",
and then checks whether Y really happened. If it doesn't, the test fails.

**Unit test.** A test of one small piece of the app in isolation — one
function, one calculation, one component. It does not open a browser and does
not touch the network. This is what `npm run test` (or `npm test`) runs. It is
fast because it tests the logic only, not the experience of using the app.

**Integration test.** A test that checks more than one piece working together,
e.g. "the repository reads a record; then the calculation formats it". The
app's repository tests are integration tests in this sense.

**End-to-end test (E2E).** A test that drives the real app the way a user
would — clicking, typing, navigating — usually in a browser. Slow, powerful,
and brittle: the whole test fails when any step breaks.

**Smoke test.** A small E2E checklist that answers: "does the app boot and
survive its main paths at all?" It is called a smoke test because, like a new
piece of electronics, you switch it on first and see if it smokes. This repo
has one at `scripts/smoke-test.cjs`, invoked by `npm run verify:smoke`.
It clicks through the real app in a real Chromium browser — adding a contact,
logging a medication dose — but it only covers the journeys someone decided
to script. A broken journey it does not know about still breaks in the
user's hands.

**Regression test.** A test that guards a fix: "this bug used to happen;
this proves it doesn't anymore, and it will catch it coming back". Most of
the repo's tests are regression tests for specific incidents.

**Guard test.** A regression test that watches source code itself rather than
a behaviour. Examples here: a test that reads the app's styles and fails if
someone re-adds a raw hex colour; a test that reads routing code and fails
if a deep link no longer reaches its screen. Not "the code does the right
thing", but "the code still has the shape we agreed was safe".

**Snapshot (seed snapshot / frozen snapshot).** A copy of what the app's
seeded demo data looked like at a specific date, stored inside the codebase
so a future check can ask "is this record the user's own data, or the demo
data the app shipped with?" It is needed because we ship demo records that
must be removable without touching real records. See
`src/calculations/seedDivergence.js` and `SNAPSHOT_TAKEN_AT`.

**Baseline.** The recorded "acceptable bad" number. Example: "the Encounters
file may contain at most 30 raw hex colours, no more". If the number rises,
the suite fails. Raising a baseline deliberately is allowed — but only by
editing the baseline file in the same change and saying why.

**Ratchet / ratcheting test.** A test that can only move one way: the number
it measures is allowed to stay the same or go down, never up. The colour
guard is a ratchet.

## The pipeline (how "we know it works")

**CI.** Continuous Integration — the always-on automated build farm that runs
the checks on every push, so a broken change is caught by a robot before it
reaches a user. The app uses GitHub Actions (see `.github/workflows/`).

**Gate.** One of the individual checks that runs in CI or via
`npm run verify`/`verify:fast`. This project's gates are: build, lint, unit
tests, encoding guard, inherited-instructions check, docs-in-sync. A gate
either passes completely or fails the whole run — a partial pass is not a
pass.

**verify:fast.** The local version of CI: build, lint, unit tests, encoding,
inherited instructions, docs. Runs in about 10–17 minutes on this machine.
The slow part is the ~2000-unit-test suite. `verify:smoke` runs the browser
flows instead; `verify` runs everything.

**Lint / linter.** A program that reads your source code for mistakes that
computers can catch without running it (unused variables, hook rules, wrong
imports). `npm run lint`. A zero-error result is required for a gate to pass.

**Typecheck / tsc.** A TypeScript syntax-and-types check (`npm run typecheck`).
Under-used in this app, which is plain JavaScript.

**Encoding guard.** A check for stray bad characters (mojibake) in source —
a bug class this repo has had before, where an em-dash or £ became
mis-decoded symbols. See `scripts/check-encoding.cjs`.

**Docs in sync.** A check that the docs were updated when the code was, so a
stale handover doesn't lie to the next session.

**Inherited instructions.** `CLAUDE.md` — the file a new AI session inherits
at the start of a task. The guard proves it still exists and is readable.

## What commit vs push vs CI mean here

**Commit** — records a change in the local repository with a message.
**Push** — sends committed changes to the server (GitHub).
**CI** — the automated checks on the server that run every time you push.
**Gate failure** — one of those checks found a problem. The build is not
allowed to ship until every gate passes. A longstanding gate failure means
the pipeline has been quietly red for a long time, which is exactly what
a gate that never passes is not for.

## How to read a gate failure

| Gate | What it means | Typical fix |
|---|---|---|
| build | the app doesn't compile/bundle | read the error, fix the code |
| lint | the code has a mistake or bad pattern | fix the listed rules |
| unit tests | a behaviour changed in an unexpected way | fix the bug, or the stale test |
| encoding guard | bad characters crept into a file | repair the file's encoding |
| inherited instructions | CLAUDE.md is missing or broken | restore it |
| docs in sync | docs don't match the code | update the stale doc |

## Files worth knowing

- `scripts/verify-changes.mjs` — runs the gates; takes `--fast`, `--smoke-only`,
  `--docs-only`.
- `scripts/smoke-test.cjs` — the Playwright journey runner.
- `src/i18n/en.json` — the English strings every screen reads through `t()`.
- `src/calculations/seedDivergence.js` — the frozen demo-data snapshot and the
  comparison rules for "is this my record or the demo's?".
- `src/calculations/styleColourBaseline.json` — the ratchet baseline for raw
  colours in JSX.

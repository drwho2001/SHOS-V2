# The SHOS change procedure

**This file is the algorithm. It is not a summary of what usually happens — it
is the sequence to follow.** If you are a human or a model about to change this
codebase, follow it in order. It exists so that correctness does not depend on
anyone remembering what went wrong last time.

Read `CLAUDE.md` for what the app *is*. Read this for how to change it safely.

---

## 0. Before you write anything

**Check free memory.** Not a metaphor — an actual measurement.

```powershell
[math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1KB)
```

Under roughly **700 MB**, stop and close browsers or other heavy processes
before running anything that uses Chromium. This is not advice: this repository
has a documented history of intermittent "failures" on this machine that were
*entirely* explained by low memory, including a full smoke-suite flow that
looked like an application bug. **A red build in a starved state is not
evidence about the code.**

**Prefer a browser-driven test over reasoning about one.** Most real defects
here have been found by driving the app, not by reading it.

---

## 1. Never use PowerShell to read or write source files

This is the single highest-value rule in this document.

PowerShell 5.1 does **not** default to UTF-8:

| command | what it actually does | consequence |
|---|---|---|
| `Get-Content`, `Get-Content -Raw` | decodes using the system ANSI codepage (CP1252 here), **not** UTF-8 | an em dash becomes three garbage characters |
| `Set-Content`, `Set-Content -Encoding utf8` | writes UTF-8 **with a BOM** | a BOM lands in a source file or commit message |

Chained, they **double-encode** every non-ASCII character. The result is
*valid UTF-8 that displays as garbage*, so it survives the build, lint, every
unit test and every smoke flow — none of which look at bytes. This has damaged
this codebase at least four separate times.

**Instead:**

- Editing a file: use the editor/`edit` tool directly.
- A bulk transformation: write a **Node** script (`scripts/`) and run it with
  `node`. Node reads and writes UTF-8 correctly with no BOM.
- Writing a commit message file: `[IO.File]::WriteAllText($p, $msg, (New-Object Text.UTF8Encoding $false))`.

**Never regex over JSX attributes or source to make a bulk edit.** A regex
codemod has damaged this codebase twice in a single week — truncating
`aria-label` closing braces, and mangling flow labels into `[2/16][1/16]`.
Three passes were needed each time where one careful edit would have done.
Make the edit with the editor, or write a script that *understands the
structure*.

---

## 2. The change loop

For each unit of work:

1. **Write the test first if the logic is testable.** If it lives inside a
   `.jsx` render, you cannot test it — **move the logic into a pure function in
   `src/calculations/` or `src/repositories/` and import it.** Three real bugs
   this month survived the build, lint, 253 unit tests and 16 smoke flows
   because they lived in render code.
2. **Make the change.**
3. **Run the fast gate:**
   ```powershell
   node scripts/verify-changes.mjs --fast
   ```
   Build → lint → unit tests → encoding → a docs check. Takes about two
   minutes. **This is the local loop, and it is deliberately *not* the whole
   gate — see "Why CI is the real gate" below before adding a local full run.**
4. **Commit and push.** CI runs the rest.
5. **If something is red, decide whether the code or the machine is at fault.**
   Check memory *first* for anything red in a local run.
6. **Verify the fix cannot pass vacuously.** For any new test, revert the fix
   and confirm the test fails. A test that cannot fail when the bug is
   reintroduced is worse than no test, because it reads as coverage. This has
   caught real "coverage" three times here.

### Why CI is the real gate, not a local full run

`smoke-test.yml` runs `npm run verify` — the **same script**, the **same gates**,
on **every push**, in about 11 minutes. That includes the entire 17-flow
Playwright smoke suite, which takes ~11 minutes of wall clock on a GitHub runner
and the better part of that plus polling overhead on a local machine.

So running the full gate locally before every push is **redundant work**, and on
a 4 GB machine it is worse than redundant: this project has repeatedly lost
hours to smoke failures that were pure memory starvation, and the machine
reliably has under 1 GB free while the browser is running.

**The rule: local `--fast` for iteration, CI for truth.** Run the full local
gate only when you specifically need to debug a smoke failure interactively —
that is the one thing CI cannot do for you.

Why CI runs the same script rather than its own copy of the steps: two lists of
"the checks" drift apart the moment either changes, and nothing catches it. One
script means a gate added locally is a gate that runs in CI, automatically. The
concrete argument for this is in section 6 — sharing the script across
platforms immediately exposed a Windows-only bug that splitting had hidden.

---

## 3. Committing

```
git add -A
git commit   # a pre-commit hook blocks mojibake automatically
git push
```

**A pre-commit hook runs the encoding guard on every commit.** It was tested in
both directions: it blocks a file containing real mojibake, and it lets a clean
commit through. Bypass only with `git commit --no-verify`, and only
deliberately.

### Write the commit message properly

The message is the only permanent record of *why*. For anything beyond a
trivial fix, it should let a future reader understand the defect and the fix
without reading the diff.

Cover, in this order:

- **What was wrong**, stated as the user-visible problem — not the code change.
- **Why it happened**, especially the non-obvious mechanism.
- **Anything you got wrong first.** This is the most valuable part and the most
  often omitted. Record the wrong theory, the evidence that corrected it, and
  the mistake in your own tooling that caused the detour.
- **Verification**, stated concretely: counts, and which environments.

Do not write a commit message with a UTF-8 BOM. See section 1.

---

## 4. After pushing

```powershell
gh run list --branch main --limit 3 --json name,status,conclusion
```

All three workflows must be green before the work is done: **Smoke Test**,
**Build Android APK**, **SHOS Web Alpha**.

**What each one actually covers now:**

| Workflow | Covers |
|---|---|
| **SHOS Smoke Test** | The whole gate, via `npm run verify`: build, lint, unit tests, encoding guard, all 17 Playwright flows, and the docs check. |
| **Build Android APK** | The one thing that genuinely cannot be checked locally — that the Java/native code compiles. |
| **SHOS Web Alpha** | Deploys to GitHub Pages, and builds with a `/SHOS-V2/` base path, which is a genuinely different build from the root-relative one CI tests. |

**A red docs gate is a real failure, not a warning.** In CI the docs check asks a
harder question than it does locally: locally, "source changed, docs not yet" is
the normal state of an honest edit in progress, so it only warns. In CI the
change is already pushed, so the same state means it *shipped* with `CLAUDE.md`
describing the old behaviour — and `CLAUDE.md` is this repo's source of truth for
what is true right now. See section 5.

After pushing, **read the gate's own reported verdict in the CI log, not just
the job's exit code.** Both vacuous-pass bugs in this repo's history produced a
completely green run. A gate that measures nothing and a gate that measures
something and finds nothing are indistinguishable from an exit code alone:

```powershell
gh run view <run-id> --log | Select-String 'docs in sync|smoke suite|ALL GATES'
```

The expected line is `docs in sync` reporting either "source + docs both
touched" or a genuine reason there were no source changes. If it ever reports
"no source changes" on a push that you know edited something under `src/`, the
gate is broken, not your commit.

To reproduce CI's checkout conditions locally when debugging this specifically,
a **real** shallow clone is required — cloning a local path ignores `--depth` in
a way that quietly gives you full history and hides the bug:

```powershell
git clone --depth 1 https://github.com/drwho2001/SHOS-V2.git <temp>
```

**For native/Android changes, a green CI build is the *only* real confirmation
that the Java compiles** — that cannot be verified from a development machine.

---

## 5. Update the documentation in the same change

Two places, both required before the work counts as finished:

- **`CLAUDE.md`** — its "Recently shipped" section, and its "Known issues"
  section if anything changed there. Be honest about scope: if a fix only
  covers part of a reported problem, say so.
- **The Notion Development Log** — page `3b013572-4f67-80ab-b1a0-c665a828e241`.
  Append with **`PATCH /v1/blocks/{page_id}/children`**. `POST` is not a valid
  method on that path, and Notion's error text for it reads exactly like an
  auth failure, which previously sent a session chasing the wrong problem.
  **Then paginate to the end and confirm the content is really there** — a
  successful API response is not proof the write landed.

### The docs gate is enforced, not advisory

CI **fails** a push that changes `src/` without also changing `CLAUDE.md` or
`docs/`. This is the one gate that answers a *different question* depending on
where it runs, and the distinction is deliberate:

| | Question | Source of truth | Verdict |
|---|---|---|---|
| Local | "Is my edit-in-progress leaving the docs stale?" | working tree vs `HEAD` | warn |
| CI | "Did this change **ship** with stale docs?" | `before..after` push range | **fail** |

A warning nobody is obliged to read is not enforcement, and moving this check
into CI was for enforcement. The logic lives in `scripts/docsGate.js` (a
separate file purely so it can be unit-tested without `verify-changes.mjs`'s
top-level code — which actually runs the entire suite — executing on import) and
is covered by `src/calculations/docsGate.test.js`.

The mode is chosen by the presence of `DOCS_BASE_REF`, **not** by a flag, so a
CI step cannot forget to opt in and silently pass vacuously. Vacuous passing was
the original bug here: the working-tree diff is always empty in CI, so the gate
found nothing and reported success while checking nothing at all.

---

## 6. Known traps in this specific codebase

These have all cost real time. They are not hypothetical.

| Trap | What to do |
|---|---|
| `dynamic import("/src/...")` in a Playwright script | Works on a **dev** server only. A production `vite preview` build ships hashed bundles under `/assets/`. Drive the real UI instead — more faithful anyway. |
| Fixed `waitForTimeout(N)` | Wait for the thing you are waiting for. A fixed wait passes on fast hardware and fails in CI, and you will spend an hour blaming the wrong layer. |
| Clicking a bottom-nav tab by its text | Tabs are `role="button"` with `aria-label` and **no text content**. Query `getByRole("navigation", { name: "Main navigation" })` then `getByRole("button", { name: label })`. A text search silently matches nothing. |
| `element.click()` on an icon | `SVGElement` has no `.click()`. Use `dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))`. This broke 351 sites once. |
| Coordinates in a test | Anything you add to a page changes the geometry. Prefer roles and labels. Where a coordinate is unavoidable, understand why it is fragile. |
| A text-based locator colliding with new copy | New UI text can match a `text=` selector somewhere unexpected, especially since overlays leave the page behind them in the DOM. Scope the locator. |
| Regex over source for bulk edits | Don't. See section 1. |
| Assuming a delegated audit is right | Verify the load-bearing claims in the source yourself. Several "findings" in any given audit are wrong or already fixed. |
| A new settings/collection not wired into `backupService` | It will be silently lost on restore. `backupPreferenceCoverage.test.js` catches one specific class of this; the wiring rule is still yours to follow. |
| Archive before hard delete | `isArchived`, not removal, is the default. Real permanent delete is per-module and confirmed. |
| Date/time values | Two conventions, deliberately different. **Stored** values are fake-UTC where the digits are literal local wall-clock time; **real instants** (`createdAt`, `updatedAt`) are genuine `new Date().toISOString()`. Use `formatStoredDate()` / `realTimestampFromStored()` / `formatInstantDate()`. Never `milliseconds / 86400000` for a calendar day. |
| Times depend on timezone | Any date test must be checked under `Europe/London`, `UTC`, `America/New_York` and `Australia/Sydney`, and must be locale-proof. |
| A test that cannot fail | Revert the fix; if the test still passes, it is not testing anything. |
| Windows-only assumptions in a shared script | The local smoke runner polled its server with `curl -o NUL`. `NUL` is a **Windows** null device — on Linux, curl would have created a real file called `NUL` in the repo root. It could never have been caught locally, because locally the script only ever ran on Windows; it surfaced the moment CI ran the same file. This is the concrete pay-off of CI and local running **the same script**: platform-specific assumptions stop being invisible. Prefer Node's own APIs over shelling out to OS tools in shared scripts. |
| A `const` flag used by two gates | Declare it once, at the top, next to the others. `verify-changes.mjs` referenced `DOCS_ONLY` from the build gate while declaring it beside the docs gate hundreds of lines later — a TDZ crash on *every* run. This project has now hit that exact class five separate times in `App.jsx` and the module files. |
| CI deleting a file in the repo root | If a CI step ever writes into the working tree, check the job actually runs on the platform you think it does. `ubuntu-latest` behaves nothing like `windows-latest` for null devices, path separators, and process cleanup. |

---

## 7. The standing self-check

Before proposing new structure, ask: **is this an EHR?** This is a personal
record for one person. Full EHR functionality, a diagnosis engine, automated
clinical risk scoring, cross-module action history, and multi-user
collaboration have all been explicitly rejected here before. Don't propose
crossing that line; it has been re-affirmed several times, not overlooked.

Exposure-window flagging and retest-date suggestions are **informational only**.
Never automated actions, never clinical advice.

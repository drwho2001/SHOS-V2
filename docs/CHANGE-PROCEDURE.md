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
3. **Run the gate:**
   ```powershell
   node scripts/verify-changes.mjs
   ```
   One command. It runs build → lint → unit tests → encoding → smoke → a
   docs check, and prints a pass/fail table. `--fast` skips the smoke suite.
4. **If a gate fails, decide whether the code or the machine is at fault.**
   Check memory *first* for anything red.
5. **Verify the fix cannot pass vacuously.** For any new test, revert the fix
   and confirm the test fails. A test that cannot fail when the bug is
   reintroduced is worse than no test, because it reads as coverage. This has
   caught real "coverage" three times here.

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

For native/Android changes, a green CI build is the *only* real confirmation
that the Java compiles — that cannot be verified from a development machine.

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

---

## 7. The standing self-check

Before proposing new structure, ask: **is this an EHR?** This is a personal
record for one person. Full EHR functionality, a diagnosis engine, automated
clinical risk scoring, cross-module action history, and multi-user
collaboration have all been explicitly rejected here before. Don't propose
crossing that line; it has been re-affirmed several times, not overlooked.

Exposure-window flagging and retest-date suggestions are **informational only**.
Never automated actions, never clinical advice.

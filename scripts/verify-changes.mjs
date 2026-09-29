#!/usr/bin/env node
// verify-changes.mjs — the single gate every commit and every push must pass.
//
// WHY THIS FILE EXISTS
// --------------------
// This project has shipped genuinely good work and also, repeatedly, made the
// same avoidable mistakes: trusting a fixed sleep instead of waiting for the
// thing, treating a red test as a code bug without measuring the machine first,
// applying a regex codemod to source and mangling it, committing a BOM because
// PowerShell wrote the message file, and shipping code without updating the
// docs that describe it.
//
// None of those are knowledge problems. Every one of them is a check that
// either did not exist or was remembered inconsistently. This file turns them
// into one command with a pass/fail answer, so correctness does not depend on
// anyone - human or model - remembering to run the right things in the right
// order.
//
// The gates, and what each one has actually caught here:
//   1. build            - a syntax error or a bad import. Cheap, absolute.
//   2. lint             - hooks rules and unused vars; has caught TDZ and
//                         stale-closure bugs before they reached a device.
//   3. unit tests       - pure logic. Includes mutation-verified coverage.
//   4. encoding guard   - mojibake. Catches PowerShell 5.1 double-encoding,
//   5. instructions    - CLAUDE.md is what a new session inherits; a missing
//                       instruction fails silently, so it is gated like mojibake.
//                         which is otherwise invisible to every other gate
//                         because the result is still valid UTF-8.
//   5. smoke suite      - real navigation in a real browser against a real
//                         production build. Needs free RAM: see below.
//   6. docs in sync     - the docs are part of the change, not a follow-up.
//
// USAGE
//   node scripts/verify-changes.mjs              # everything
//   node scripts/verify-changes.mjs --fast       # skip the smoke suite
//   node scripts/verify-changes.mjs --smoke-only # just the smoke suite
//   node scripts/verify-changes.mjs --docs-only  # just the docs gate (CI)
//
// WHY --docs-only EXISTS: CI already runs lint, the encoding guard, unit tests,
// the build and the entire smoke suite, on every push, in ~11 minutes, with no
// local memory pressure. Running all of that again locally before each push is
// redundant on a fast machine and actively harmful on a slow one. So the
// intended local loop is the FAST gate plus a push, and CI is the real gate.
// The one piece CI could not check was the docs, because by the time CI runs
// the change is committed and the original working-tree diff was empty - it
// passed vacuously. --docs-only checks the pushed commit range instead.
//
// EXIT CODES
//   0  all requested gates passed
//   1  a gate failed
//   2  the environment cannot run the requested gates (e.g. not enough RAM)

import { spawnSync, spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { classifyDocsGate } from "./docsGate.js";
import os from "node:os";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const FAST = args.includes("--fast");
const SMOKE_ONLY = args.includes("--smoke-only");
// Declared HERE, with the other flags, rather than down beside the docs gate
// that consumes it. `const` is block-scoped and hoisted-but-uninitialised, so
// gate 1 referencing DOCS_ONLY before this line throws "Cannot access
// 'DOCS_ONLY' before initialization" on EVERY run — which it did, and which
// was only caught because the gate was actually executed. This is the same TDZ
// class this project has hit five separate times in App.jsx and the module
// files, so the rule is: a flag used by more than one gate is declared once, at
// the top, next to the others.
const DOCS_ONLY = args.includes("--docs-only");
// Which "what changed" question the docs gate asks. See the long comment above
// the gate itself for why these are two different questions. Mode is chosen by
// the presence of DOCS_BASE_REF rather than by a flag, so a CI step cannot
// forget to opt in and silently pass vacuously.
const baseRef = process.env.DOCS_BASE_REF || "";
const useRange = DOCS_ONLY || Boolean(baseRef);

const COLOUR = { ok: "\x1b[32m", bad: "\x1b[31m", warn: "\x1b[33m", dim: "\x1b[2m", off: "\x1b[0m" };
const results = [];
const started = Date.now();

// Free RAM in MB. Windows reports it via os.freemem(); this is the number that
// matters, because a Chromium-backed smoke run against a starved machine
// produces failures that look exactly like application bugs.
const freeMemMB = Math.round(os.freemem() / 1024 / 1024);

function gate(name, fn) {
  noteStage(name);
  const t0 = Date.now();
  process.stdout.write(`${COLOUR.dim}running${COLOUR.off} ${name}... `);
  let r;
  try {
    r = fn();
  } catch (e) {
    // A gate that throws unexpectedly is a FAILED gate, not a crashed run.
    // Losing the remaining gates' results because one helper misbehaved is
    // exactly the "stop and lose the thread" failure this script exists to
    // prevent, so the exception is reported and the run continues.
    r = { ok: false, note: `threw unexpectedly: ${e && e.message ? e.message : String(e)}` };
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (r.ok) {
    process.stdout.write(`${COLOUR.ok}PASS${COLOUR.off} ${COLOUR.dim}(${secs}s)${COLOUR.off}\n`);
    results.push({ name, ok: true, note: r.note || "" });
  } else {
    process.stdout.write(`${COLOUR.bad}FAIL${COLOUR.off} ${COLOUR.dim}(${secs}s)${COLOUR.off}\n`);
    if (r.note) process.stdout.write(`  ${r.note}\n`);
    results.push({ name, ok: false, note: r.note || "" });
  }
  return r.ok;
}

function run(cmd, cmdArgs, opts = {}) {
  return spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024,
    ...opts,
  });
}

function lastLines(text, n = 12) {
  const lines = (text || "").split(/\r?\n/).filter((l) => l.trim());
  return lines.slice(-n).join("\n  ");
}

/** Strip ANSI colour codes. Vitest's output is full of them, and they sit
 *  between the label and the number, so any regex over raw output fails. */
function stripAnsi(s) {
  return (s || "").replace(/\x1b\[[0-9;]*m/g, "");
}

function countFrom(text, re) {
  const m = stripAnsi(text).match(re);
  return m ? m[1] : null;
}

// Synchronous sleep. `spawnSync("powershell", ...)` per tick is wasteful and
// spawns a process per second; Atomics.wait blocks the thread directly.
function sleepSync(ms) {
  const sab = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(sab), 0, 0, ms);
}

/** True when something is already listening on `port`. */
function portInUse(port) {
  const r = spawnSync("netstat", ["-ano"], { encoding: "utf8", shell: true });
  return new RegExp(`[:.]${port}\\s+\\S+\s+LISTENING`, "i").test(r.stdout || "");
}

// ── cross-session gate lock ────────────────────────────────────────────────
//
// WHY THIS IS NEEDED, and it is not about gate ordering
//
// Two sessions running this script at once collide, and the harmful collision
// is NOT "lint at the same time as the encoding guard" - those two are read-only
// and harmless together. The dangerous one is this:
//
//   * `npm run build` (gate 1) writes the whole of dist/.
//   * the smoke suite's service-worker flow WRITES dist/sw.js twice - once at
//     smoke-test.cjs:1241 with a deliberately bumped CACHE_NAME, then again at
//     :1265 to restore the original it read at :1188.
//
// So if session B's build lands inside session A's flow-14 window, A then writes
// back the ORIGINAL sw.js - the one captured before B rebuilt - straight into
// B's freshly built dist/. The corruption is silent, survives the run, and the
// next person to read B's dist/ gets a service worker from a build that no
// longer exists. That is a genuinely nasty, slow-to-diagnose failure, and it is
// exactly the "both sessions in one tree" hazard that bit this repo once before.
//
// The fix is MUTUAL EXCLUSION over the whole run, not per-gate. Per-gate locking
// would be actively worse: it would let B build while A's smoke suite reads
// dist/, which is the exact pairing we need to prevent.
//
// WHY A WAIT AND NOT AN ERROR
//
// The owner's requirement was that a second session queues rather than
// cancelling, breaking, or turning the run red. So this blocks, with a progress
// message saying who holds it and what stage they are on, and a bounded wait.
//
// WHY OUTSIDE THE REPOSITORY
//
// The lock is session state, not project state. Putting it in the repo would
// make it committable and would collide with itself under git. Keyed by a hash
// of the working-tree path, so two separate clones of the same repo each get
// their own lock instead of falsely serialising against each other.
//
// STALE LOCKS
//
// A session that is killed - or crashes - must not block the other one forever.
// Two independent defences: the owning PID is probed, and there is a max-age
// backstop for the case where a PID has been recycled onto an unrelated process.

const LOCK_DIR = path.join(os.homedir(), ".shos-session-bus");
const LOCK_PATH = path.join(
  LOCK_DIR,
  `verify-${createHash("sha1").update(ROOT).digest("hex").slice(0, 12)}.lock`
);
const LOCK_WAIT_MS = Number(process.env.SHOS_LOCK_WAIT_MS || 20 * 60 * 1000);
const LOCK_MAX_AGE_MS = Number(process.env.SHOS_LOCK_MAX_AGE_MS || 45 * 60 * 1000);
let holdsLock = false;
let lockStartedAt = 0;

function lockEnabled() {
  // CI is a single runner on a fresh checkout, so there is nothing to contend
  // with and a stale lock must never be able to hang a pipeline. --no-lock is the
  // escape hatch for a deliberate parallel run.
  return !process.env.CI && !args.includes("--no-lock");
}

function lockOwner() {
  return process.env.SHOS_SESSION_NAME || `${os.userInfo().username}@${os.hostname()}`;
}

function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM means the process exists but belongs to another user.
    return e.code === "EPERM";
  }
}

function readLock() {
  try {
    return JSON.parse(readFileSync(LOCK_PATH, "utf8"));
  } catch {
    return null;
  }
}

function writeLock(stage) {
  try {
    mkdirSync(LOCK_DIR, { recursive: true });
    writeFileSync(
      LOCK_PATH,
      JSON.stringify(
        { pid: process.pid, owner: lockOwner(), stage, startedAt: lockStartedAt, cwd: ROOT },
        null,
        2
      ),
      "utf8"
    );
  } catch {
    /* a lock we cannot write must not fail the run it was protecting */
  }
}

function releaseLock() {
  if (!holdsLock) return;
  const cur = readLock();
  // Only ever remove our OWN lock: if ours was judged stale and stolen while we
  // were still running, deleting it would release the new holder's.
  if (cur && cur.pid === process.pid) {
    try { unlinkSync(LOCK_PATH); } catch { /* already gone */ }
  }
  holdsLock = false;
}

function acquireLock() {
  if (!lockEnabled()) return true;
  const deadline = Date.now() + LOCK_WAIT_MS;
  let lastStage = null;
  let lastBeat = 0;
  for (;;) {
    const cur = readLock();
    if (!cur || cur.pid === process.pid) break;

    // LIVENESS IS DECIDED BY THE PID, NOT BY THE CLOCK.
    //
    // The first version treated a malformed or negative startedAt as "stale" and
    // took the lock over. That is exactly backwards: taking over is the
    // dangerous action, because it is the one that lets two runs touch dist/ at
    // once, which is the corruption this lock exists to prevent. Waiting is the
    // safe failure - only slower - and the deadline below already stops it
    // hanging forever. A timestamp we cannot interpret is a reason to distrust
    // the AGE, not a reason to assume the holder is dead.
    //
    // So: a dead pid is stale. A live pid is waited on, however nonsensical its
    // timestamp looks, until the wait deadline.
    const started = Number(cur.startedAt);
    const ageValid = Number.isFinite(started) && started > 0;
    const age = ageValid ? Date.now() - started : NaN;
    const ageUsable = ageValid && age >= 0;
    const alive = pidAlive(cur.pid);
    const wedged = alive && ageUsable && age > LOCK_MAX_AGE_MS;
    const stale = !alive || wedged;
    if (ageUsable === false && alive) {
      // Said once, not every tick, because it is a warning rather than progress.
      if (lastStage !== "unusable-timestamp") {
        process.stdout.write(
          `${COLOUR.warn}lock${COLOUR.off} ${cur.owner} (pid ${cur.pid}) has an unusable startedAt ` +
          `(${JSON.stringify(cur.startedAt)}), so its age cannot be trusted. Their process is alive, so waiting. ` +
          `If they are in fact gone, the wait ends at ${Math.round(LOCK_WAIT_MS / 1000)}s.\n`
        );
        lastStage = "unusable-timestamp";
      }
    }
      if (stale) {
        // Only two ways to get here, and each says which: a process that is gone
        // (the ordinary crashed-session case) or one that is alive but has run
        // past the max age (wedged, and the deadline would otherwise never
        // arrive). A live-but-uninterpretable age is NOT one of them, which is
        // the point of the logic above.
        const why = !alive
          ? "its process is gone"
          : `${Math.round(age / 1000)}s old, past the ${Math.round(LOCK_MAX_AGE_MS / 1000)}s limit`;
        process.stdout.write(
          `${COLOUR.warn}lock${COLOUR.off} held by ${cur.owner} (pid ${cur.pid}, stage "${cur.stage}") looks abandoned - ${why} - taking it over\n`
        );
        break;
      }

    if (Date.now() > deadline) {
      process.stdout.write(
        `${COLOUR.bad}lock${COLOUR.off} gave up waiting ${Math.round(LOCK_WAIT_MS / 1000)}s for ${cur.owner}.\n` +
        `  They are on stage "${cur.stage}". Running anyway would risk clobbering their dist/.\n` +
        `  Re-run with --no-lock to override, or raise SHOS_LOCK_WAIT_MS.\n`
      );
      return false;
    }

    // Print on STAGE CHANGE, plus a heartbeat so a long silent stage does not
    // look like a hang. The first version keyed the de-duplication on a line
    // that embedded the elapsed seconds, so it never matched itself and printed
    // on every tick - 84 lines of "waiting" in a three-minute wait, which
    // buries the run's own output. Keyed on the stage alone, plus a 30s beat.
    const now = Date.now();
    const stageChanged = cur.stage !== lastStage;
    const beatDue = now - lastBeat > 30_000;
    if (stageChanged || beatDue) {
      const held = Math.round(age / 1000);
      process.stdout.write(
        `${COLOUR.warn}lock${COLOUR.off} waiting for ${cur.owner} (pid ${cur.pid}) on stage "${cur.stage}", held ${held}s\n`
      );
      lastStage = cur.stage;
      lastBeat = now;
    }
    sleepSync(2000);
  }
  lockStartedAt = Date.now();
  holdsLock = true;
  writeLock("starting");
  // Registered as an exit handler rather than a try/finally because this script
  // ends in several process.exit() calls, and a finally block would be skipped
  // by them - leaving the other session blocked on a lock nobody holds.
  process.on("exit", releaseLock);
  return true;
}

/** Called by gate() so a waiter can see where the holder has got to. */
function noteStage(stage) {
  if (holdsLock) writeLock(stage);
}


/**
 * Run the smoke suite against a real production build, and ALWAYS clean up the
 * preview server it starts.
 *
 * The cleanup matters: an orphaned `vite preview` keeps the port bound, so the
 * next run either collides or silently tests against a STALE server from a
 * previous build - which is precisely the kind of failure that wastes an hour
 * looking like an application bug. Every exit path here kills the server.
 */
function runSmokeSuite() {
  const port = 5300 + Math.floor(Math.random() * 400);
  const url = `http://localhost:${port}`;

  if (portInUse(port)) {
    return { ok: false, note: `port ${port} was already in use - re-run for a different random port` };
  }

  const build = run("npm", ["run", "build"]);
  if (build.status !== 0) return { ok: false, note: "build failed before the smoke run" };

  // Windows cannot spawn a .cmd directly (node throws EINVAL), so npx.cmd has
  // to go through a shell. `windowsVerbatimArguments` is deliberately NOT used:
  // the port is a number we generated, so there is nothing to inject.
  const isWin = process.platform === "win32";
  const server = spawn(
    isWin ? "npx.cmd" : "npx",
    ["vite", "preview", "--port", String(port)],
    { cwd: ROOT, detached: true, stdio: "ignore", shell: isWin }
  );
  server.unref();

  // Killing the spawned process is NOT enough on Windows: `shell: true` means
  // npx.cmd is a child shell, which itself spawns vite as a grandchild. Killing
  // the parent leaves the grandchild holding the port - verified by leaking a
  // real server on a previous version of this script.
  //
  // Nor is the server the only thing left behind. Playwright's headless
  // Chromium children (chrome-headless-shell.exe) survive a killed run too, and
  // four of them were found on this machine holding ~190 MB - which is exactly
  // what starved the next smoke run and made it fail for "environmental"
  // reasons. So the cleanup covers both, and the port is generated per run and
  // checked free beforehand so a sweep can only ever match this run's own.
  const killServer = () => {
    try { process.kill(server.pid, "SIGTERM"); } catch { /* already gone */ }
    if (!isWin) return;
    const ps = [
      // The vite process tree, found via whoever owns this run's port.
      `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { taskkill /F /T /PID $_.OwningProcess 2>$null | Out-Null }`,
      // Playwright's headless browsers, which are NOT bound to our port and so
      // would otherwise be invisible to the sweep above.
      `Get-Process chrome-headless-shell -ErrorAction SilentlyContinue | ForEach-Object { taskkill /F /T /PID $_.Id 2>$null | Out-Null }`,
    ].join("; ");
    const sweep = spawnSync("powershell", ["-NoProfile", "-Command", ps], { stdio: "ignore", timeout: 30000 });
    void sweep;
  };

  try {
    // Poll for the server rather than sleeping a fixed amount - boot time
    // varies by an order of magnitude between a warm and a cold machine.
    //
    // This deliberately does NOT shell out to `curl -o NUL`: `NUL` is a Windows
    // null device, and on Linux curl would create a real file called NUL in the
    // repo root. That bug would have been invisible locally (where the script
    // only ever runs on Windows) and only appeared once this same script was
    // run in CI, which is the whole reason the two are now the same command.
    // A synchronous Node HTTP request is portable and dependency-free.
    const probeSync = (target) => {
      const probe = spawnSync(
        process.execPath,
        ["-e", `require("http").get(${JSON.stringify(target)},r=>process.exit(r.statusCode===200?0:1)).on("error",()=>process.exit(1))`],
        { stdio: "ignore", timeout: 5000 }
      );
      return probe.status === 0;
    };

    let up = false;
    for (let i = 0; i < 30; i++) {
      if (probeSync(url)) { up = true; break; }
      sleepSync(2000);
    }
    if (!up) return { ok: false, note: `preview server never came up on ${url}` };

    const r = run("node", ["scripts/smoke-test.cjs"], {
      env: { ...process.env, SMOKE_TEST_URL: url },
    });
    const out = (r.stdout || "") + (r.stderr || "");
    if (r.status !== 0) return { ok: false, note: lastLines(out, 18) };
    const flows = (out.match(/^\[\d+\/\d+\]/gm) || []).length;
    // ALSO count the per-assertion "ok —" lines.
    //
    // WHY: on a passing run the child's output is swallowed (only a failure
    // dumps it), so "N flows, all passed" gives no evidence of what actually
    // executed. Worse, the `[N/M]` count only covers the top-level flows — the
    // inline helpers called inside the main sequence (testEscapeClosesOverlay,
    // testMedicationReasonSideEffects and a dozen others) print no label, so one
    // of those silently ceasing to run would leave this count unchanged and the
    // suite still green.
    //
    // Caught exactly that way: a passing run after adding an Escape flow could
    // not be distinguished from one where the new flow never executed. This is
    // the same "a gate that measures nothing still looks green" shape this
    // project has now hit three times — and it keeps appearing in the tooling
    // rather than the app, which is worth noticing.
    //
    // The assertion count makes the invisible helpers visible: each prints at
    // least one "ok —", so this number moves when they run and stops moving
    // when they do not.
    const assertions = (out.match(/^\s*ok\s+./gm) || []).length;
    return { ok: true, note: `${flows} flows, ${assertions} assertions (port ${port})` };
  } finally {
    killServer();
  }
}

// Take the cross-session lock before any gate runs, so the whole run - build
// through smoke - is atomic with respect to the other session. Exit code 4 is
// distinct from 1 (a gate failed) and 2 (gates passed with warnings), so a
// caller can tell "blocked, nothing ran" apart from "ran and went red".
if (!acquireLock()) {
  process.stdout.write(
    `${COLOUR.bad}verify did not run${COLOUR.off} - another session holds the gate lock.\n\n`
  );
  process.exit(4);
}

// --- gate 1: build ---------------------------------------------------------
if (!SMOKE_ONLY && !DOCS_ONLY) {
  gate("build", () => {
    const r = run("npm", ["run", "build"]);
    return { ok: r.status === 0, note: r.status === 0 ? "" : lastLines(r.stderr || r.stdout) };
  });

  // --- gate 2: lint -------------------------------------------------------
  gate("lint", () => {
    const r = run("npx", ["eslint", "."]);
    return { ok: r.status === 0, note: r.status === 0 ? "" : lastLines(r.stdout || r.stderr) };
  });

  // --- gate 3: unit tests -------------------------------------------------
  gate("unit tests", () => {
    const r = run("npx", ["vitest", "run", "--reporter=basic"]);
    const out = (r.stdout || "") + (r.stderr || "");
    const passed = countFrom(out, /Tests\s+(\d+)\s+passed/);
    const files = countFrom(out, /Test Files\s+(\d+)\s+passed/);
    if (r.status !== 0) return { ok: false, note: lastLines(out) };
    return { ok: true, note: `${passed || "?"} tests across ${files || "?"} files` };
  });

  // --- gate 4: encoding ---------------------------------------------------
  gate("encoding guard", () => {
    const r = run("npm", ["run", "--silent", "check:encoding"]);
    return { ok: r.status === 0, note: r.status === 0 ? "" : lastLines(r.stdout || r.stderr) };
  });

  // --- gate 5: inherited instructions -------------------------------------
  // CLAUDE.md is the ONLY thing a new session inherits. If an instruction goes
  // missing the session does not fail - it just does something already known to
  // be wrong, silently, which is how five of these drifted without anyone
  // noticing. The encoding guard above is in the same family and the same
  // reasoning: a recurring silent failure gets a gate, not a reminder to be
  // more careful.
  gate("inherited instructions", () => {
    const r = run("node", ["scripts/check-instructions.mjs"]);
    return { ok: r.status === 0, note: r.status === 0 ? "" : lastLines(r.stdout || r.stderr) };
  });
}

// --- gate 5: smoke suite ---------------------------------------------------
if (!FAST && !DOCS_ONLY) {
  // ADVISORY, NOT A HARD SKIP — and the distinction matters.
  //
  // A first version skipped the smoke suite outright below a memory floor. That
  // is the wrong trade: a skip reports "ALL GATES PASSED" while the one gate
  // that actually exercises the app never ran. Silent non-verification is worse
  // than a possibly-environmental failure, because a failure at least prompts a
  // look and a skip does not.
  //
  // So: only skip when the machine genuinely cannot run a browser at all
  // (below ~400 MB, where this has actually produced false failures). Above
  // that, RUN the suite. If it then fails while memory was marginal, the
  // failure note says so, so the reader knows to check the machine before
  // blaming the diff.
  const HARD_FLOOR_MB = 400;
  const SOFT_FLOOR_MB = 700;

  if (freeMemMB < HARD_FLOOR_MB) {
    process.stdout.write(
      `${COLOUR.warn}SKIPPING${COLOUR.off} smoke suite — only ${freeMemMB} MB free RAM.\n` +
      `  ${COLOUR.dim}This machine cannot run a Chromium suite at this level; results would be\n` +
      `  meaningless. Close browsers and re-run. This is the documented cause of\n` +
      `  intermittent "failures" here — do not read them as application bugs.${COLOUR.off}\n`
    );
    results.push({ name: "smoke suite", ok: true, note: `SKIPPED — only ${freeMemMB} MB free RAM` });
  } else {
    const marginal = freeMemMB < SOFT_FLOOR_MB;
    if (marginal) {
      process.stdout.write(
        `${COLOUR.warn}note${COLOUR.off} only ${freeMemMB} MB free RAM (under the ~${SOFT_FLOOR_MB} MB this\n` +
        `  machine usually manages). Running anyway — a failure here may be the machine,\n` +
        `  not the change, so check free memory before believing a red smoke run.\n`
      );
    }
    const result = gate("smoke suite", runSmokeSuite);
    if (!result && marginal) {
      const entry = results[results.length - 1];
      entry.note += ` — NOTE: only ${freeMemMB} MB free RAM during this run, so the machine may be the cause`;
    }
  }
}

// --- gate 6: docs in sync --------------------------------------------------
// Deliberately a QUESTION, not an assertion. The failure mode here is a commit
// that changes behaviour and leaves CLAUDE.md describing the old behaviour, and
// no script can reliably detect that - only a deliberate check can.
//
// TWO MODES, because "what changed" means different things in the two places
// this runs. The mode is chosen by whether DOCS_BASE_REF is set, not by a flag,
// so a CI step cannot forget to pass it and silently pass vacuously - which is
// the one failure mode a gate must never have.
//
//   local (DOCS_BASE_REF unset)  - diff the working tree against HEAD, i.e.
//                                  "does the thing I am about to commit leave
//                                  the docs stale?" The useful question before
//                                  committing, where the change is still
//                                  uncommitted.
//
//   CI (DOCS_BASE_REF set)       - the change is already COMMITTED, so there is
//                                  no working diff at all; the original code
//                                  found nothing to check and passed
//                                  vacuously. Instead diff the pushed commit
//                                  RANGE, using the before-SHA of the push.
//
// `--docs-only` still exists for running just this gate quickly, and forces the
// range mode even without the env var.
//
// (DOCS_ONLY, baseRef and useRange are declared at the TOP of this file with the
// other flags — see the note there about the TDZ crash this caused.)
if (useRange || !SMOKE_ONLY) {
  let touched;
  // A gate that CANNOT measure must say so, not pass. This is not
  // hypothetical: with actions/checkout's default fetch-depth of 1 the range
  // below is unresolvable, `git diff` errors, stdout is empty, and the gate
  // happily reported "no source changes" — passing while checking nothing.
  // That is the second time this gate has passed vacuously (the first was a
  // working-tree diff, which is always empty in CI). The fix in the workflow
  // is fetch-depth: 0, but this check is the backstop for any future
  // misconfiguration of it.
  let unmeasurable = null;

  if (useRange) {
    const ref = baseRef && !/^0+$/.test(baseRef) ? baseRef : "HEAD~1";
    const r = run("git", ["diff", "--name-only", `${ref}..HEAD`]);
    if (r.status !== 0) {
      unmeasurable = `git diff ${ref}..HEAD failed — commit range unavailable (shallow clone? missing history?)`;
    } else {
      touched = r.stdout.split(/\r?\n/).filter(Boolean);
    }
  } else {
    const changed = run("git", ["diff", "--name-only", "HEAD"]).stdout || "";
    const staged = run("git", ["diff", "--cached", "--name-only"]).stdout || "";
    touched = (changed + staged).split(/\r?\n/).filter(Boolean);
  }
  // The decision itself lives in scripts/docsGate.js so it can be unit-tested
  // without this file's top-level code (which actually runs the whole gate suite
  // executing on import).
  results.push(
    unmeasurable
      ? { name: "docs in sync", ok: false, note: unmeasurable }
      : { name: "docs in sync", ...classifyDocsGate(touched, useRange) }
  );
}


// --- summary ---------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
const warned = results.filter((r) => r.note && r.ok && /SKIPPED|SOURCE CHANGED/.test(r.note));
const secs = ((Date.now() - started) / 1000).toFixed(1);

process.stdout.write(`\n${"=".repeat(60)}\n`);
for (const r of results) {
  const mark = r.ok ? `${COLOUR.ok}PASS${COLOUR.off}` : `${COLOUR.bad}FAIL${COLOUR.off}`;
  process.stdout.write(`${mark}  ${r.name.padEnd(16)} ${COLOUR.dim}${r.note}${COLOUR.off}\n`);
}
process.stdout.write(`${"=".repeat(60)}\n`);
process.stdout.write(`free RAM at start: ${freeMemMB} MB | total ${secs}s\n\n`);

if (warned.length) {
  process.stdout.write(`${COLOUR.warn}WARNINGS${COLOUR.off} (not failures, but read them):\n`);
  for (const w of warned) process.stdout.write(`  - ${w.name}: ${w.note}\n`);
  process.stdout.write("\n");
}

if (failed.length) {
  process.stdout.write(`${COLOUR.bad}${failed.length} GATE(S) FAILED${COLOUR.off}\n`);
  process.exit(1);
}
process.stdout.write(`${COLOUR.ok}ALL GATES PASSED${COLOUR.off}\n`);
if (warned.length) process.exit(2);
process.exit(0);
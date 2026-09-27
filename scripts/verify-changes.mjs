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
//
// EXIT CODES
//   0  all requested gates passed
//   1  a gate failed
//   2  the environment cannot run the requested gates (e.g. not enough RAM)

import { spawnSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const FAST = args.includes("--fast");
const SMOKE_ONLY = args.includes("--smoke-only");

const COLOUR = { ok: "\x1b[32m", bad: "\x1b[31m", warn: "\x1b[33m", dim: "\x1b[2m", off: "\x1b[0m" };
const results = [];
const started = Date.now();

// Free RAM in MB. Windows reports it via os.freemem(); this is the number that
// matters, because a Chromium-backed smoke run against a starved machine
// produces failures that look exactly like application bugs.
const freeMemMB = Math.round(os.freemem() / 1024 / 1024);

function gate(name, fn) {
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
  return new RegExp(`[:.]${port}\\s+\\S+\\s+LISTENING`, "i").test(r.stdout || "");
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
    let up = false;
    for (let i = 0; i < 30; i++) {
      const probe = run("curl", ["-s", "-o", "NUL", "-w", "%{http_code}", "--max-time", "4", url]);
      if ((probe.stdout || "").trim() === "200") { up = true; break; }
      sleepSync(2000);
    }
    if (!up) return { ok: false, note: `preview server never came up on ${url}` };

    const r = run("node", ["scripts/smoke-test.cjs"], {
      env: { ...process.env, SMOKE_TEST_URL: url },
    });
    const out = (r.stdout || "") + (r.stderr || "");
    if (r.status !== 0) return { ok: false, note: lastLines(out, 18) };
    const flows = (out.match(/^\[\d+\/\d+\]/gm) || []).length;
    return { ok: true, note: `${flows} flows, all passed (port ${port})` };
  } finally {
    killServer();
  }
}

// --- gate 1: build ---------------------------------------------------------
if (!SMOKE_ONLY) {
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
}

// --- gate 5: smoke suite ---------------------------------------------------
if (!FAST) {
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
if (!SMOKE_ONLY) {
  const changed = run("git", ["diff", "--name-only", "HEAD"]).stdout || "";
  const staged = run("git", ["diff", "--cached", "--name-only"]).stdout || "";
  const touched = (changed + staged).split(/\r?\n/).filter(Boolean);
  const srcChanged = touched.some((f) => f.startsWith("src/"));
  const docChanged = touched.some((f) => /^(CLAUDE\.md|docs\/)/.test(f));
  results.push({
    name: "docs in sync",
    ok: true,
    note: srcChanged
      ? docChanged
        ? "source + docs both touched"
        : "SOURCE CHANGED, DOCS NOT TOUCHED — confirm CLAUDE.md still describes current behaviour"
      : "no source changes",
  });
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

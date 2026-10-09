#!/usr/bin/env node
// shos-terminal.mjs — the single input point for the SHOS session roles.
//
// WHY THIS EXISTS
//
// The roles (builder / challenger / docs / tester) live as opencode agent
// configs and can be invoked headless, but there was no single place to type a
// request. The owner had to decide which agent to start, know its name, and
// drive a TUI. This script makes that decision: type one thing, it picks a
// role, runs it, and prints the reply.
//
// TRANSPORT, and why it is not the obvious one
//
// Three mechanisms were tried. The order matters because each failure mode is
// invisible if you do not look for it:
//
//   1. HTTP API (POST /session/{id}/message). Rejected: the `agent` field in
//      the message body returns HTTP 500, and setting `agent` at session
//      creation is silently ignored (the session comes back on the default
//      `build` agent). So the server cannot be told which agent to run.
//   2. Spawning `opencode run` directly. Fails with `spawn EINVAL` on Windows:
//      Node will not execute a .cmd shim without a shell, and a shell means
//      quoting arbitrary user input, which is how a prompt gets corrupted.
//   3. THIS: write the request to a temp file, then run
//      `opencode run --agent <role> --model <model> "<fixed prompt>"
//      --file <tmp> --dir <repo> --format json`.
//      The user's text never reaches a command line - only the fixed prompt and
//      paths do - so there is nothing to misquote. Verified working.
//
// The server password is NOT used here. The CLI reads its own credentials.
// Note the CLI's OPENCODE_SERVER_PASSWORD env var is stale on this machine and
// returns 401 against the server; it is unrelated to this path.
//
// MODELS
//
// The terminal never picks a model itself. It reads each role's model from
// ~/.config/opencode/agents/<role>.md frontmatter, so repointing a role is a
// one-line edit in the agent config and this script follows automatically.
// Hardcoding models here is exactly the hand-maintained inventory that has
// gone stale in this repo repeatedly.
//
// Usage:
//   node scripts/shos-terminal.mjs "what should I do about the widget staleness?"
//   node scripts/shos-terminal.mjs --roles
//   node scripts/shos-terminal.mjs --role builder "implement t044"
//   node scripts/shos-terminal.mjs --default "just answer this, no routing"
//   node scripts/shos-terminal.mjs --timeout 600000 "slow question"
//
// A routing decision is always shown before the answer, so a misroute is
// visible rather than silent. Override with --role when it guesses wrong.

import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = process.env.SHOS_REPO_DIR || ROOT;
const AGENTS_DIR =
  process.env.SHOS_AGENTS_DIR || join(homedir(), ".config", "opencode", "agents");
const MSG_DIR = join(tmpdir(), "opencode");
const MSG_FILE = join(MSG_DIR, "terminal-msg.txt");
// Fixed on purpose. The user's request travels in the file, never here, so this
// string is the only prose that can reach a command line.
const FIXED_PROMPT = "Read the attached file. It contains the user's request - carry it out exactly.";

// Resolve the real executable rather than the `opencode` shim. On Windows the
// npm shim is a .ps1/.cmd, which Node's spawn refuses to run without a shell
// (EINVAL) - and a shell is exactly what we are avoiding. The bundled .exe
// takes an args array directly, so nothing needs quoting.
function resolveOc() {
  if (process.platform !== "win32") return "opencode";
  const local = join(
    process.env.APPDATA || "",
    "npm",
    "node_modules",
    "opencode-ai",
    "bin",
    "opencode.exe"
  );
  if (existsSync(local)) return local;
  return "opencode";
}
const OC = resolveOc();

// ── roles ───────────────────────────────────────────────────────────────────

// Ordered: first match wins. Kept deliberately narrow - a rule that is too
// broad makes the terminal a worse router than the owner, and the point is to
// remove a decision, not to guess well on ambiguous input.
//
// A non-match is NOT an error. classify() returns null and the caller falls
// back to BUILDER, which has full tools and can do anything. The first version
// of this script rejected unmatched input, which made the terminal refuse a
// plainly worded question - a gate is worse than no gate.
const ROUTES = [
  {
    role: "tester",
    label: "TESTER",
    why: "runs the deterministic gate",
    pattern: /\b(run|execute|fire)\s+(the\s+)?(gate|tests?|lint|smoke|verify)\b|^\s*(gate|lint|verify|smoke)\s*(run|status)?\s*[?!]?\s*$/i,
  },
  {
    role: "challenger",
    label: "CHALLENGER",
    why: "read-only second opinion",
    pattern: /\b(challeng|critiqu|review|audit|second opinion|trust but|don'?t trust|is\s+\w+\s+(still\s+)?(true|right|correct|safe|accurate)|stale|wrong|vacuous|false claim)\b/i,
  },
  {
    role: "docs",
    label: "DOCS",
    why: "scoped to documentation",
    pattern: /\b(document|docs?|readme|changelog|history|explain|write up|what does .* mean)\b/i,
  },
  {
    role: "builder",
    label: "BUILDER",
    why: "implements with full tools",
    pattern: /\b(implement|fix|add|create|refactor|write|change|update|build|make|wire|patch|do|ship)\b/i,
  },
];

function readRole(role) {
  const path = join(AGENTS_DIR, `${role}.md`);
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8");
  const model = /^model:\s*(.+?)\s*$/m.exec(text)?.[1] || null;
  const description = /^description:\s*(.+?)\s*$/m.exec(text)?.[1] || null;
  return { role, model, description, path };
}

// A role whose agent file is absent is reported, never skipped. The first
// version did `if (!info) continue`, which is the failure mode this repo hits
// most often: the terminal printed a healthy-looking table while the roles it
// was supposed to route to did not exist, and reported success. A helper that
// can quietly do nothing is worse than no helper.
function listRoles() {
  const rows = [];
  const missing = [];
  for (const r of ROUTES) {
    const info = readRole(r.role);
    if (!info) {
      missing.push(r.role);
      rows.push(
        `${r.role.padEnd(11)} ${"MISSING AGENT CONFIG".padEnd(38)} ${r.label.padEnd(11)} ${r.why}`
      );
      continue;
    }
    if (!info.model) missing.push(r.role);
    rows.push(
      `${r.role.padEnd(11)} ${(info.model || "NO MODEL IN FRONTMATTER").padEnd(38)} ${r.label.padEnd(11)} ${r.why}`
    );
  }
  return { rows: rows.join("\n"), missing };
}

function classify(message) {
  for (const r of ROUTES) if (r.pattern.test(message)) return r;
  return null;
}

// The repo's own default model, read from opencode.json rather than assumed.
// Used by --default, which answers without invoking any agent.
function readDefaultModel() {
  const p = join(REPO, "opencode.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")).model || null;
  } catch {
    return null;
  }
}

// ── running a request ───────────────────────────────────────────────────────
//
// Success is "we got prose", never "the call returned OK". This repo has a
// lesson about a 200 that was really a failure, and the same trap applies here:
// an upstream error can arrive shaped like a success with empty text. So an
// explicit error is reported verbatim and empty prose is treated as a failure.

function runCli({ agent = null, model, message, timeoutMs }) {
  return new Promise((resolve, reject) => {
    mkdirSync(MSG_DIR, { recursive: true });
    writeFileSync(MSG_FILE, message, "utf8");

    const args = ["run"];
    if (agent) args.push("--agent", agent);
    args.push("--model", model, FIXED_PROMPT, "--file", MSG_FILE, "--dir", REPO, "--format", "json");

    const child = spawn(OC, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`timed out after ${timeoutMs / 1000}s (killed)`));
    }, timeoutMs);

    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`could not start ${OC}: ${e.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      try {
        rmSync(MSG_FILE, { force: true });
      } catch {
        /* best effort */
      }
      if (code !== 0) {
        return reject(new Error(`opencode exited ${code}${err ? `: ${err.trim().slice(0, 400)}` : ""}`));
      }
      resolve(out);
    });
  });
}

// opencode --format json emits newline-delimited events. Only parts with type
// "text" carry prose; "step-start"/"step-finish"/"error" are structure.
function extractReply(ndjson) {
  const textParts = [];
  let error = null;
  for (const line of ndjson.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    let ev;
    try {
      ev = JSON.parse(t);
    } catch {
      continue;
    }
    if (ev?.type === "text" && ev.part?.text) textParts.push(ev.part.text);
    if (ev?.type === "error") {
      const m = ev.error?.data?.message || ev.error?.message || JSON.stringify(ev.error);
      error = m;
    }
  }
  return { reply: textParts.join("").trim(), error };
}

function usage() {
  return [
    "SHOS terminal — one input, routed to a role",
    "",
    "  node scripts/shos-terminal.mjs <message>        auto-route and answer",
    "  node scripts/shos-terminal.mjs --roles          list roles and their models",
    "  node scripts/shos-terminal.mjs --role <n> <msg> force a role",
    "  node scripts/shos-terminal.mjs --default <msg>  answer with the repo default model",
    "  node scripts/shos-terminal.mjs --timeout <ms>  set a timeout (default 900000)",
    "",
    "Environment:",
    "  SHOS_REPO_DIR    repo to run in      (default: this checkout)",
    "  SHOS_AGENTS_DIR  agent configs        (default: ~/.config/opencode/agents)",
  ].join("\n");
}

async function present({ label, model, why, message, timeoutMs }) {
  console.error(`[terminal] ${label}${why ? ` — ${why}` : ""}`);
  console.error(`[terminal] model ${model}`);
  try {
    const { reply, error } = extractReply(
      await runCli({ agent: label === "DEFAULT" ? null : label.toLowerCase(), model, message, timeoutMs })
    );
    if (error) {
      console.error(`\n[terminal] ${label} reported: ${error}`);
      process.exit(1);
    }
    if (!reply) {
      console.error(`\n[terminal] ${label} returned no prose (possible silent upstream failure)`);
      process.exit(1);
    }
    console.log(`\n--- ${label} ---\n${reply}`);
  } catch (e) {
    console.error(`\n[terminal] ${e.message}`);
    process.exit(1);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const timeoutIdx = argv.indexOf("--timeout");
  let timeoutMs = 900000;
  if (timeoutIdx !== -1) {
    timeoutMs = Number(argv[timeoutIdx + 1]) || timeoutMs;
    argv.splice(timeoutIdx, 2);
  }

  const flag = argv[0];
  if (!flag || flag === "-h" || flag === "--help") {
    console.log(usage());
    process.exit(flag ? 0 : 2);
  }
  if (flag === "--roles") {
    const { rows, missing } = listRoles();
    console.log(rows);
    if (missing.length) {
      console.error(
        `\n[terminal] ${missing.length} role(s) unusable: ${missing.join(", ")}`
      );
      console.error(`[terminal] expected agent configs in ${AGENTS_DIR}`);
      process.exit(2);
    }
    return;
  }

  if (flag === "--role") {
    const want = argv[1];
    const message = argv.slice(2).join(" ");
    if (!want || !message) {
      console.error("usage: --role <name> <message>\n\n" + usage());
      process.exit(2);
    }
    const info = readRole(want);
    if (!info) {
      const { rows, missing } = listRoles();
      console.error(`unknown role "${want}".`);
      if (!missing.length) console.error(`Available:\n${rows}`);
      else
        console.error(
          `No roles are usable yet - ${missing.length} agent config(s) missing in ${AGENTS_DIR}:\n${rows}`
        );
      process.exit(2);
    }
    if (!info.model) {
      console.error(`role ${want} has no model in its agent config`);
      process.exit(2);
    }
    await present({ label: info.role.toUpperCase(), model: info.model, why: "forced", message, timeoutMs });
    return;
  }

  if (flag === "--default") {
    const message = argv.slice(1).join(" ");
    if (!message) {
      console.error("usage: --default <message>");
      process.exit(2);
    }
    const model = readDefaultModel();
    if (!model) {
      console.error(`no model in ${join(REPO, "opencode.json")}`);
      process.exit(2);
    }
    await present({ label: "DEFAULT", model, why: null, message, timeoutMs });
    return;
  }

  // bare message: auto-route, falling back to BUILDER rather than refusing.
  const message = argv.join(" ");
  const r = classify(message);
  const role = r?.role || "builder";
  const info = readRole(role);
  if (!info?.model) {
    console.error(`role ${role} has no model in its agent config`);
    process.exit(2);
  }
  await present({
    label: r?.label || "BUILDER",
    model: info.model,
    why: r?.why || "no specific route matched; BUILDER has full tools",
    message,
    timeoutMs,
  });
}

main().catch((e) => {
  console.error(`[terminal] ${e.message}`);
  process.exit(1);
});

// session-bridge.mjs — let two opencode sessions on this machine talk to each other.
//
// WHY THIS EXISTS AT ALL
//
// The owner routinely runs two AI sessions against this one working tree. Until
// now the only path between them was the owner relaying messages by hand, and
// that path has already cost a real error: a block of text was pasted back with
// one session's analysis attributed to the other, so a reviewer appeared to have
// independently validated a proposal that was actually just an echo. Anything
// that depends on the owner noticing and forwarding is a coordination system
// with a human as its most failure-prone component.
//
// WHAT THIS IS, AND DELIBERATELY WHAT IT IS NOT
//
// It is a thin client for opencode's own HTTP server API — not a new message
// broker, not a socket server, not an MCP server. opencode 1.18 already exposes
// everything needed:
//
//   POST /api/session/{id}/prompt  {prompt:{text}, delivery:"queue"|"steer"}
//                                  -> prompts another session
//   GET  /session/{id}/message?limit=N
//                                  -> reads its reply
//   POST /tui/show-toast           {title, message, variant, duration}
//                                  -> native notification, no custom balloon
//
// All of that was verified against the live server's own OpenAPI spec at
// /doc (openapi 3.1.0) before any of this was written. Building a parallel
// transport on top would have been pure duplication, and an MCP-based one would
// additionally have required BOTH sessions to restart before it worked, because
// MCP servers load at session start. This needs no restart and no resident
// process: each subcommand is a short-lived fetch.
//
// NO BLOCKING BY DESIGN
//
// The owner asked that A, having delegated to B, keep working rather than sit
// on a wait. So there is deliberately no "wait" command. `ask` returns as soon
// as the prompt is queued, and the caller interleaves its own work with `poll`.
// That is also why this file never calls POST /api/session/{id}/wait, even
// though the server offers it: that endpoint takes no body and therefore has no
// timeout, so one call would hang the calling session indefinitely if the peer
// stalled. Polling with a cursor is slower to notice a reply and cannot hang.
//
// CREDENTIALS
//
// The server password is read from $SHOS_OC_PASSWORD, else from
// ~/.shos-session-bus/credentials.json. That file is outside the repository
// ON PURPOSE: this repo is the public alpha track (see CLAUDE.md's
// personal-alpha vs public-alpha split) and an agent-server credential must
// never be commit-able. The password is never logged, never echoed, and never
// placed on a command line by this script.

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, readdirSync, openSync, closeSync, unlinkSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const HOME_DIR = join(homedir(), ".shos-session-bus");
const CRED_PATH = join(HOME_DIR, "credentials.json");
const STATE_DIR = join(HOME_DIR, "state");
const CURSOR_PATH = join(STATE_DIR, "cursors.json");
const PEER_PATH = join(STATE_DIR, "peer.json");
const NOTICE_PATH = join(HOME_DIR, "notices.jsonl");
const INBOX_CURSOR_PATH = join(STATE_DIR, "inbox.json");
const CLAIM_PATH = join(STATE_DIR, "claims.json");
const TASKS_DIR = join(HOME_DIR, "tasks");
const ME = process.env.SHOS_SESSION_NAME || "unknown";

const DEFAULT_URL = "http://127.0.0.1:4096";
const REPO_DIR = process.cwd();

// ── config ──────────────────────────────────────────────────────────────────

function readJson(path, fallback) {
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(path, value) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2), "utf8");
}

// 127.0.0.1, never 0.0.0.0 — the latter is a bind address, not a connect target.
function baseUrl() {
  return process.env.SHOS_OC_URL || DEFAULT_URL;
}

function authHeader() {
  const fromFile = readJson(CRED_PATH, {});
  const user = process.env.SHOS_OC_USER || fromFile.user || "opencode";
  const pass = process.env.SHOS_OC_PASSWORD || fromFile.password;
  if (!pass) {
    console.error(
      "No server password available. Set $SHOS_OC_PASSWORD, or run:\n" +
        `  node scripts/session-bridge.mjs login`
    );
    process.exit(2);
  }
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

async function api(method, path, body) {
  const res = await fetch(baseUrl() + path, {
    method,
    headers: {
      Authorization: authHeader(),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    const detail = typeof parsed === "string" ? parsed.slice(0, 200) : JSON.stringify(parsed).slice(0, 200);
    throw new Error(`${method} ${path} -> HTTP ${res.status}  ${detail}`);
  }
  return parsed;
}

// ── message shaping ─────────────────────────────────────────────────────────

// Real shape from the live server: each message is {info, parts}, the role is on
// info.role, and the prose is in parts[].text. Parts that are tool calls or
// reasoning have no .text, so they are skipped rather than rendered as [object].
function messageText(msg) {
  const parts = Array.isArray(msg?.parts) ? msg.parts : [];
  return parts
    .filter((p) => p && typeof p.text === "string" && p.text.trim())
    .map((p) => p.text.trim())
    .join("\n")
    .replace(/\s+\n/g, "\n");
}

function messageRole(msg) {
  return msg?.info?.role || msg?.role || "?";
}

function messageID(msg) {
  return msg?.info?.id || msg?.id || null;
}

function messageTime(msg) {
  const t = msg?.info?.time?.created || msg?.time?.created;
  if (!t) return "";
  return stamp(new Date(t).toISOString(), false);
}

function clip(text, n) {
  if (text.length <= n) return text;
  return text.slice(0, n) + `... [${text.length} chars total]`;
}

// ── timestamps ─────────────────────────────────────────────────────────────
//
// Everything this tool stores is already UTC ISO-8601 (toISOString), and it is
// displayed as UTC by default. That is a deliberate choice by the owner: this is
// a machine-to-machine channel between two sessions, and a shared clock removes
// a whole class of "was that before or after?" argument. It also means the
// timestamps sort and compare correctly as plain strings.
//
// The cost is that a human reading the terminal has to convert. Rather than
// quietly showing local time and making the two sessions reason in two
// timezones, the output says which zone it is in and `--local` is available for
// the human case. Human-facing documents (CLAUDE.md, Notion, docs prose) are the
// opposite: those are read by the owner, so they use local UK time.
const USE_LOCAL = process.argv.includes("--local");

function stamp(iso, withDate = true) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  if (USE_LOCAL) {
    return withDate
      ? d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })
      : d.toLocaleTimeString("en-GB", { hour12: false });
  }
  const isoStr = d.toISOString();
  return withDate
    ? `${isoStr.slice(0, 10)} ${isoStr.slice(11, 19)}Z`
    : `${isoStr.slice(11, 19)}Z`;
}

const TZ_NOTE = USE_LOCAL ? "local" : "UTC";


function resolvePeer(arg) {
  if (arg) return arg;
  const peer = readJson(PEER_PATH, {});
  if (peer.sessionID) return peer.sessionID;
  console.error("No peer given, and none pinned. Usage: <cmd> <sessionID>  |  or set one:\n  node scripts/session-bridge.mjs peer set <sessionID>");
  process.exit(2);
}

// ── commands ────────────────────────────────────────────────────────────────

const commands = {};

commands.list = async (args) => {
  const limit = Number(args.find((a) => /^\d+$/.test(a)) || 10);
  const dir = args.includes("--all") ? null : REPO_DIR;
  const q = new URLSearchParams();
  if (dir) q.set("directory", dir);
  q.set("limit", String(limit * 3));
  const raw = await api("GET", `/session?${q}`);
  const list = (Array.isArray(raw) ? raw : raw?.data || [])
    .filter((s) => s?.id)
    .sort((a, b) => (b.time?.updated || 0) - (a.time?.updated || 0))
    .slice(0, limit);
  if (!list.length) { console.log("(no sessions)"); return; }
  console.log(`  (times are ${TZ_NOTE})`);
  for (const s of list) {
    const title = (s.title || "(untitled)").replace(/\s+/g, " ");
    console.log(`${s.id}  ${stamp(new Date(s.time?.updated || Date.now()).toISOString())}  ${s.parentID ? "sub" : "root"}  ${clip(title, 56)}`);
  }
};

commands.ask = async (args) => {
  const steer = args.includes("--steer");
  const positional = args.filter((a) => a !== "--steer" && !a.startsWith("--"));
  const sessionID = resolvePeer(positional[0]);
  const text = positional.slice(1).join(" ");
  if (!text) {
    console.error('Nothing to send. Usage: ask <sessionID> "text" [--steer]');
    process.exit(2);
  }
  // "queue" waits for the peer's current turn; "steer" interrupts it. steer is
  // the clarification path but discards in-flight work, so it is opt-in only.
  const delivery = steer ? "steer" : "queue";
  const out = await api("POST", `/api/session/${sessionID}/prompt`, {
    prompt: { text },
    delivery,
  });
  // Cursors are per-peer, so a new outgoing prompt means anything previously
  // "seen" from that peer is no longer what we are waiting on.
  writeJson(STATE_DIR + "/last-ask.json", { sessionID, at: new Date().toISOString(), delivery });
  console.log(`queued (${delivery}) -> ${sessionID}${steer ? "  [INTERRUPTS their current turn]" : ""}`);
  if (out?.info?.id) console.log(`messageID ${out.info.id}`);
  console.log("Reply is NOT awaited. Do other work, then: poll " + sessionID);
};

commands.poll = async (args) => {
  const positional = args.filter((a) => !a.startsWith("--"));
  const sessionID = resolvePeer(positional[0]);
  const limit = Number(positional[1] || args.find((a) => /^--limit=(\d+)$/.test(a)?.split("=")[1]) || 5);
  const q = new URLSearchParams({ limit: String(limit) });
  const raw = await api("GET", `/session/${sessionID}/message?${q}`);
  const msgs = (Array.isArray(raw) ? raw : raw?.data || []).filter((m) => m?.info);
  const cursors = readJson(CURSOR_PATH, {});
  const seen = cursors[sessionID]?.lastMessageID || null;
  const last = messageID(msgs[msgs.length - 1]);
  if (last) {
    cursors[sessionID] = { lastMessageID: last, seenAt: new Date().toISOString() };
    writeJson(CURSOR_PATH, cursors);
  }
  if (!msgs.length) {
    console.log("(no messages yet)");
    return;
  }
  let newCount = 0;
  for (const m of msgs) {
    const isNew = seen ? messageID(m) !== seen : false;
    if (isNew) newCount += 1;
    const role = messageRole(m);
    const text = messageText(m);
    if (!text) continue;
    const tag = isNew ? "NEW " : "    ";
    console.log(`${tag}[${messageTime(m)}] ${role}: ${clip(text.replace(/\n/g, " "), 400)}`);
  }
  console.log(`--- ${newCount} new of ${msgs.length} shown (cursor ${last || "none"}) ---`);
};

commands.read = async (args) => {
  const positional = args.filter((a) => !a.startsWith("--"));
  const sessionID = resolvePeer(positional[0]);
  const limit = Number(positional[1] || 8);
  const raw = await api("GET", `/session/${sessionID}/message?limit=${limit}`);
  const msgs = (Array.isArray(raw) ? raw : raw?.data || []).filter((m) => m?.info);
  if (!msgs.length) { console.log("(no messages)"); return; }
  console.log(`  (times are ${TZ_NOTE})`);
  for (const m of msgs) {
    const text = messageText(m);
    if (!text) continue;
    console.log(`[${messageTime(m)}] ${messageRole(m)}: ${clip(text, 1000)}`);
  }
};

commands.toast = async (args) => {
  const positional = args.filter((a) => !a.startsWith("--"));
  const [title, message] = [positional[0] || "Session bridge", positional.slice(1).join(" ")];
  const variant = (args.find((a) => a.startsWith("--variant=")) || "--variant=info").split("=")[1];
  const q = new URLSearchParams({ directory: REPO_DIR });
  await api("POST", `/tui/show-toast?${q}`, {
    title,
    message,
    variant,
    duration: 6000,
  });
  console.log("toast shown");
};

// The session-API prompt is NOT sufficient on its own, and that was measured
// rather than assumed: POST /api/session/{id}/prompt with delivery:"queue"
// returns 200 and the bridge printed "queued", but B's session `time.updated`
// never moved, /session/status and /api/session/active both stayed empty, and no
// reply ever appeared. An interactive TUI session does not consume a
// server-side queued prompt. So `ask` alone is a no-op on a TUI session and its
// success message was, at the time of writing, overstating what happened.
//
// The TUI endpoints are the other path: append-prompt fills a TUI's input box
// and submit-prompt is the equivalent of pressing Enter.
//
// UNVERIFIED AND RISKY: these are addressed by ?directory=, not by session. With
// two TUI sessions in one directory there is no way from the API to say which
// window receives the text, so this can inject into the CALLER's own terminal.
// `tuiask` is therefore gated behind an explicit acknowledgement, and reports
// what it did rather than claiming the prompt was delivered.
commands.tuiask = async (args) => {
  if (!args.includes("--yes-i-know")) {
    console.error(
      "tuiask types into a live TUI whose window cannot be identified from the API.\n" +
      "With two sessions in this directory it may target YOUR terminal.\n" +
      "Re-run with --yes-i-know to proceed."
    );
    process.exit(2);
  }
  const steer = args.includes("--steer");
  const positional = args.filter((a) => a !== "--steer" && a !== "--yes-i-know" && !a.startsWith("--"));
  const text = positional.join(" ");
  if (!text) { console.error('Usage: tuiask "text" [--steer] [--yes-i-know]'); process.exit(2); }
  const q = new URLSearchParams({ directory: REPO_DIR });
  await api("POST", `/tui/append-prompt?${q}`, { text });
  if (steer) {
    // steering submits immediately; a normal append is left unsubmitted so the
    // text can be reviewed before it is sent
    await api("POST", `/tui/submit-prompt?${q}`, {});
    console.log("appended + submitted (steer) to a TUI in this directory - TARGET UNVERIFIED");
  } else {
    console.log("appended to a TUI input box in this directory - TARGET UNVERIFIED, NOT submitted");
    console.log("If that was your own terminal, clear the line. Then run: tui-submit");
  }
};

commands["tui-submit"] = async () => {
  const q = new URLSearchParams({ directory: REPO_DIR });
  await api("POST", `/tui/submit-prompt?${q}`, {});
  console.log("submitted (Enter pressed) to a TUI in this directory - TARGET UNVERIFIED");
};

// MEASURED, NOT ASSUMED: on 28 Sep 2026 this was tested against a real peer
// TUI session. POST returned 200 and this printed "queued", but the peer's
// time.updated never moved, /session/status and /api/session/active both stayed
// empty, and no reply appeared after 55s. An interactive TUI session does NOT
// consume a server-side queued prompt. So on this setup `ask` is a no-op that
// would otherwise have reported success, which is exactly the "measured nothing
// and looked green" failure this repo keeps recording. It is kept only because
// it may work for a headless/background session, and it now says so.
commands.ask = async (args) => {
  const steer = args.includes("--steer");
  const positional = args.filter((a) => a !== "--steer" && !a.startsWith("--"));
  const sessionID = resolvePeer(positional[0]);
  const text = positional.slice(1).join(" ");
  if (!text) {
    console.error('Nothing to send. Usage: ask <sessionID> "text" [--steer]');
    process.exit(2);
  }
  const delivery = steer ? "steer" : "queue";
  const out = await api("POST", `/api/session/${sessionID}/prompt`, {
    prompt: { text },
    delivery,
  });
  writeJson(join(STATE_DIR, "last-ask.json"), { sessionID, at: new Date().toISOString(), delivery });
  console.log(`POSTed (${delivery}) -> ${sessionID}${steer ? "  [interrupt requested]" : ""}`);
  if (out?.info?.id) console.log(`messageID ${out.info.id}`);
  console.log("");
  console.log("NOT VERIFIED AS DELIVERED. Measured 28 Sep 2026: a 200 here did not");
  console.log("wake an idle TUI session. Confirm with `poll` before assuming it worked.");
  console.log("For reliable cross-session messaging use `notice` + `inbox` instead.");
};

commands.inbox = async () => {
  // The cursor is PER SESSION, not a single shared value. It was originally one
  // path holding one number, so whichever session polled first advanced it and
  // the other never saw the notice at all - a shared-consumer cursor on a
  // two-consumer channel, which silently halves every message. Same failure
  // shape as the claim table: state that cannot represent two readers.
  const store = readJson(INBOX_CURSOR_PATH, {});
  const cursors = store.cursors || {};
  const last = cursors[ME] || 0;
  let notices = [];
  try {
    notices = existsSync(NOTICE_PATH)
      ? readFileSync(NOTICE_PATH, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
      : [];
  } catch { /* a malformed line must not hide the rest */ }
  const fresh = notices.filter((n) => (n.seq || 0) > last);
  const tasks = existsSync(TASKS_DIR) ? readdirSync(TASKS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
  if (!fresh.length && !tasks.length) {
    console.log(`(nothing new for ${ME})`);
    return;
  }
  if (fresh.length) {
    console.log(`--- ${fresh.length} notice(s) for ${ME} ---`);
    for (const n of fresh) {
      console.log(`  [${stamp(n.at)} ${TZ_NOTE}] ${n.from || "?"}: ${n.text}`);
    }
  }
  if (tasks.length) {
    console.log("--- task folders (read one with: task read <slug>) ---");
    for (const t of tasks) console.log(`  ${t}`);
  }
  const next = notices.length ? (notices[notices.length - 1].seq || last) : last;
  cursors[ME] = next;
  store.cursors = cursors;
  writeJson(INBOX_CURSOR_PATH, store);
};

commands.notice = async (args) => {
  const text = args.join(" ");
  if (!text) { console.error("Usage: notice <text>"); process.exit(2); }
  const existing = existsSync(NOTICE_PATH)
    ? readFileSync(NOTICE_PATH, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
    : [];
  const seq = (existing.length ? existing[existing.length - 1].seq || 0 : 0) + 1;
  // Append-only, one line, single write. Two sessions appending must not
  // read-modify-write the file, or they clobber each other.
  appendFileSync(NOTICE_PATH, JSON.stringify({ seq, at: new Date().toISOString(), from: ME, text }) + "\n", "utf8");
  console.log(`notice #${seq} posted (run "inbox" in the other session to see it)`);
};

commands.task = async (args) => {
  const [verb, slug, ...rest] = args;
  const dir = join(TASKS_DIR, slug || "");
  if (verb === "new") {
    if (!slug) { console.error("Usage: task new <slug> [brief text]"); process.exit(2); }
    mkdirSync(dir, { recursive: true });
    writeJson(join(dir, "_meta.json"), { slug, createdBy: ME, createdAt: new Date().toISOString() });
    if (rest.length) writeFileSync(join(dir, "00-brief.md"), rest.join(" ") + "\n", "utf8");
    console.log(`task created: ${dir}`);
    console.log("post the brief with: task write <slug> 00-brief \"<the human's words, verbatim>\"");
    return;
  }
  if (verb === "write") {
    const file = rest[0];
    if (!slug || !file) { console.error("Usage: task write <slug> <NN-name.md> [text]"); process.exit(2); }
    mkdirSync(dir, { recursive: true });
    // Versioned filenames by design: two sessions writing ONE file is a silent
    // last-write-wins clobber. NN-name.md / NN-name-v2.md cannot collide, and
    // the numbering doubles as the review history.
    const target = join(dir, file);
    // The guard is against another SESSION clobbering this file, not against a
    // session revising its own draft. The first version refused any overwrite,
    // which meant `task new <slug> <brief>` wrote 00-brief.md and then the
    // obvious next command — `task write <slug> 00-brief.md "..."` — was
    // rejected by the command that had just created the file. Authorship is
    // tracked in _meta.json so the two cases can be told apart.
    const meta = readJson(join(dir, "_meta.json"), {});
    meta.authors = meta.authors || {};
    const author = meta.authors[file];
    if (existsSync(target) && author && author !== ME && !args.includes("--force")) {
      console.error(`refusing to overwrite ${file} — written by ${author}. Use ${file.replace(/\.md$/, "-v2.md")}, or pass --force if you are taking it over deliberately.`);
      process.exit(2);
    }
    writeFileSync(target, rest.slice(1).join(" ") + "\n", "utf8");
    meta.authors[file] = ME;
    writeJson(join(dir, "_meta.json"), meta);
    console.log(`wrote ${slug}/${file}`);
    return;
  }
  if (verb === "read") {
    if (!slug) { console.error("Usage: task read <slug> [file]"); process.exit(2); }
    if (!existsSync(dir)) { console.error(`no such task: ${slug}`); process.exit(2); }
    if (rest.length) {
      const f = join(dir, rest[0]);
      if (!existsSync(f)) { console.error(`no such file: ${rest[0]}`); process.exit(2); }
      console.log(readFileSync(f, "utf8"));
    } else {
      for (const f of readdirSync(dir).filter((x) => x.endsWith(".md")).sort()) {
        const body = readFileSync(join(dir, f), "utf8");
        const first = body.split("\n").find((l) => l.trim()) || "";
        console.log(`  ${f}  ${first.slice(0, 68)}`);
      }
    }
    return;
  }
  if (verb === "list") {
    const base = TASKS_DIR;
    if (!existsSync(base)) { console.log("(no tasks)"); return; }
    for (const d of readdirSync(base, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const files = readdirSync(join(base, d.name));
      const last = files.filter((f) => f.endsWith(".md")).sort().pop();
      console.log(`  ${d.name}  (${files.filter((f) => f.endsWith(".md")).length} docs, latest: ${last || "none"})`);
    }
    return;
  }
  console.error("Usage: task new|write|read|list ...");
  process.exit(2);
};

// ── work pool ──────────────────────────────────────────────────────────────
//
// The owner's framing: while session A is queued behind B on the verify lock, A
// should be doing its OTHER work rather than sitting there, and the list of
// things it may pick up should be ones the owner has APPROVED.
//
// The approval gate is the whole design. Without it this is a machine handing
// itself objectives, which is how a small task turns into a large unrequested
// refactor. With it, a session can only ever start from work the owner has
// explicitly blessed, and `proposed` items are inert until then.
//
// States: proposed -> approved -> doing -> done, with `blocked` as a park.
// `pool take` only ever hands out an `approved` task, and never one whose files
// another session already claims - so pulling work cannot create the very
// collision the claim table exists to prevent.
//
// CONCURRENCY IS BEST-EFFORT AND SAID SO. Two sessions calling `take` in the
// same instant can both read the same `approved` task. There is no OS-level
// lock here, so this uses an optimistic read-claim-write-reread: whichever
// session's claim is still present when it re-reads keeps it, the other backs
// off. The window is milliseconds and the failure mode is a duplicated task,
// not a corrupted file - so it is documented rather than over-engineered.
// The verify lock in verify-changes.mjs is the case that actually needed real
// mutual exclusion, and it has it.

const POOL_PATH = join(STATE_DIR, "pool.json");
const POOL_LOCK = join(STATE_DIR, "pool.lock");

/**
 * Serialise a read-modify-write of the pool.
 *
 * B found a genuine lost-update here on 29 Sep and was right to call it the one
 * that caused real harm. Every pool verb is a read of the whole file, a change in
 * memory, then a whole-file write - so two sessions mutating at the same moment
 * means the second write silently discards the first one's change. No error, no
 * warning: a task record just disappears. That is worse than an index-lock
 * collision, which at least announces itself.
 *
 * The lock is created with O_EXCL ("wx"), which is atomic: the filesystem
 * guarantees exactly one creator wins. A plain existsSync-then-write would race
 * exactly the way the thing it is protecting does, which would be a poor joke in
 * a file whose whole subject is that failure.
 *
 * Stale locks are reclaimed on age, and a process that dies holding one cannot
 * block the pool permanently. The wait is short because the critical section is
 * a few milliseconds of file I/O - unlike the verify lock, where it wraps a
 * multi-minute test run.
 */
const POOL_LOCK_STALE_MS = 10_000;

function withPoolLock(fn) {
  mkdirSync(STATE_DIR, { recursive: true });
  const deadline = Date.now() + 5000;
  let fd = null;
  for (;;) {
    try {
      fd = openSync(POOL_LOCK, "wx");
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      // Reclaim if the holder is gone. Not a PID check: same reason as the pool
      // lease - this is a short-lived CLI, so its process is always gone by now.
      let stale = false;
      try {
        stale = Date.now() - statSync(POOL_LOCK).mtimeMs > POOL_LOCK_STALE_MS;
      } catch {
        stale = true;
      }
      if (stale) {
        try { unlinkSync(POOL_LOCK); } catch { /* someone else won the reclaim */ }
        continue;
      }
      if (Date.now() > deadline) {
        throw new Error("pool is locked by another session and did not release within 5s - try again");
      }
      sleepSyncMs(25);
    }
  }
  try {
    return fn();
  } finally {
    try { closeSync(fd); } catch { /* already closed */ }
    try { unlinkSync(POOL_LOCK); } catch { /* already gone */ }
  }
}

function sleepSyncMs(ms) {
  const sab = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(sab), 0, 0, ms);
}


function loadPool() {
  const p = readJson(POOL_PATH, {});
  return Array.isArray(p.tasks) ? p : { tasks: [] };
}

function savePool(pool) {
  writeJson(POOL_PATH, pool);
}

// Allocation is recorded BEFORE any work starts, with a timestamp and the files
// involved, and those files are claimed into the shared claim table as part of
// the same action. That is the owner's requirement and it closes a real gap:
// `pool take` used to mark a task `doing` without claiming its files, so the
// claim table and the pool could disagree - the pool saying "A has it" while
// the file table still read as free for B to take. Two sources of truth that
// can drift is the exact failure class this whole tool keeps hitting.
//
// The owner's PID is recorded for information only, and is DELIBERATELY NOT used
// to decide liveness. The first version used it, and that was wrong in a way
// only a real run exposed: this is a CLI, so the recorded pid belongs to a
// `node session-bridge.mjs` process that exits milliseconds later. Every
// allocation therefore looked abandoned to the next session, and `pool reap`
// would have handed back tasks that were actively being worked on - causing
// precisely the duplicated work the pool exists to prevent.
//
// Staleness is therefore a LEASE on wall-clock time: an allocation is fresh for
// POOL_LEASE_MS, and `pool touch` extends it for long-running work. That is
// honest about what can actually be observed from a CLI.

const POOL_LEASE_MS = Number(process.env.SHOS_POOL_LEASE_MS || 4 * 60 * 60 * 1000);

function isStale(t) {
  if (t.status !== "doing") return false;
  const at = Date.parse(t.touchedAt || t.at || "");
  if (!Number.isFinite(at)) return true;
  return Date.now() - at > POOL_LEASE_MS;
}

function claimFiles(files) {
  if (!files || !files.length) return;
  const store = readJson(CLAIM_PATH, {});
  for (const f of files) {
    const holders = (store[f]?.holders || []).filter((h) => h.by !== ME);
    if (!holders.some((h) => h.by === ME)) {
      store[f] = { holders: [...holders, { by: ME, at: new Date().toISOString(), via: "pool" }] };
    }
  }
  writeJson(CLAIM_PATH, store);
}

function releaseFiles(files) {
  if (!files || !files.length) return;
  const store = readJson(CLAIM_PATH, {});
  for (const f of files) {
    if (!store[f]) continue;
    const kept = (store[f].holders || []).filter((h) => h.by !== ME);
    if (kept.length) store[f] = { holders: kept };
    else delete store[f];
  }
  writeJson(CLAIM_PATH, store);
}

// The single write path for "this session has taken this task". Every route
// into a claim goes through here - `pool take` and `pool allocate` alike - so
// the timestamp, the pid, the file claims and the history entry cannot drift
// apart between the two commands. The owner's requirement was that this happen
// BEFORE any work starts, so the other session sees the allocation rather than
// discovering duplicated work afterwards.
function allocate(t, pool) {
  const at = new Date().toISOString();
  t.status = "doing";
  t.owner = ME;
  t.at = at;
  t.touchedAt = at;
  t.history.push({ at, by: ME, to: "doing", note: "allocated before any work started" });
  claimFiles(t.files);
  savePool(pool);
  // Optimistic re-read. The pool has no OS-level lock, so two sessions could in
  // principle allocate the same task in the same instant; whichever allocation
  // is still present on re-read keeps it, the other backs off and gives the
  // files back rather than both proceeding.
  const after = loadPool().tasks.find((x) => x.id === t.id);
  if (!after || after.owner !== ME) {
    releaseFiles(t.files);
    console.log(`lost the race for ${t.id} to another session - not taking it`);
    return;
  }
  console.log(`allocated ${t.id} at ${stamp(at)} (pid ${process.pid}): ${t.title}`);
  if (t.files.length) console.log(`  claimed: ${t.files.join(", ")}`);
  console.log("  recorded now, BEFORE any work, so the other session sees it");
}

commands.pool = async (args) => withPoolLock(() => poolHandler(args));

function poolHandler(args) {
  const [verb, ...rest] = args;
  const pool = loadPool();

  if (verb === "add" || verb === "propose") {
    const title = rest.filter((a) => !a.startsWith("--")).join(" ");
    const files = (args.find((a) => a.startsWith("--files=")) || "").replace("--files=", "");
    if (!title) { console.error(`Usage: pool add "<title>" [--files=a,b]`); process.exit(2); }
    // The id is derived from the HIGHEST existing id, never from the array
    // length. The first version used `pool.tasks.length + 1`, which is only
    // correct when ids are 1..N with no gaps and no deletions. This pool
    // starts at t010, so ten tasks plus one produced "t011" — an id already
    // in use, silently, as the eleventh task was added.
    //
    // A duplicate id is not cosmetic. Every lookup here resolves by first
    // match — `pool done t011`, `pool take`, `pool allocate t011`, and `rm`,
    // which filters EVERY task carrying the id and so deletes both. A single
    // duplicated id therefore makes two tasks unmarkable, unhittable, and
    // jointly destructible, in a file whose entire purpose is to stop two
    // sessions picking the same work.
    //
    // Found by triggering it, not by reading it: I ran `pool add` and the
    // output printed "t011" for a task I knew was new.
    const highest = pool.tasks.reduce((max, t) => {
      const n = parseInt(String(t.id).replace(/^\D+/, ""), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    const id = `t${String(highest + 1).padStart(3, "0")}`;
    if (pool.tasks.some((t) => t.id === id)) {
      // Thrown, NOT process.exit(). This whole handler runs inside
      // withPoolLock(), whose `finally` releases the lock - and process.exit()
      // skips `finally` entirely, so exiting here would leave pool.lock on disk
      // and stall the next pool command for up to POOL_LOCK_STALE_MS. A guard
      // that breaks the tool in the very case it exists to catch is not a
      // guard. Throwing unwinds normally and lets the finally do its job; the
      // exit code rides along on the error so "blocked, nothing ran" stays
      // distinguishable from "ran and failed" (1).
      const err = new Error(
        `refusing to create ${id} - it already exists. That is a bug in this script, not something to work around.`
      );
      err.exitCode = 3;
      throw err;
    }
    pool.tasks.push({
      id,
      title,
      files: files ? files.split(",").map((f) => f.trim()).filter(Boolean) : [],
      status: verb === "add" ? "approved" : "proposed",
      owner: null,
      at: new Date().toISOString(),
      history: [],
    });
    savePool(pool);
    // The one-liner this replaced read:
    //   `${id} ${verb === "add" ? "approved" : "PROPOSED (...pool approve "}${id})  ${title}`
    // The else-branch's paren is opened in the string and closed in the
    // template AFTER ${id}, so BOTH branches inherited it. `add` printed
    // "t021 approvedt021)" and `propose` printed "pool approvet021)" - the
    // command a user is meant to copy-paste, with the id glued to the verb.
    // Two branches, two messages, no shared paren to go wrong.
    console.log(
      verb === "add"
        ? `${id} approved  ${title}`
        : `${id} PROPOSED (inert - the owner must approve it: pool approve ${id})  ${title}`
    );
    return;
  }

  if (verb === "approve") {
    const t = pool.tasks.find((x) => x.id === rest[0]);
    if (!t) { console.error(`no such task: ${rest[0]}`); process.exit(2); }
    t.status = "approved";
    t.history.push({ at: new Date().toISOString(), by: ME, to: "approved" });
    savePool(pool);
    console.log(`${t.id} approved - a session may now pull it`);
    return;
  }

  if (verb === "take") {
    // Only approved, unowned, and not colliding with another session's claims.
    const claims = readJson(CLAIM_PATH, {});
    const heldByOthers = new Set();
    for (const [f, v] of Object.entries(claims)) {
      for (const h of v.holders || []) if (h.by !== ME) heldByOthers.add(f);
    }
    const t = pool.tasks.find(
      (x) => x.status === "approved" && !x.owner && !(x.files || []).some((f) => heldByOthers.has(f))
    );
    if (!t) {
      const reasons = [];
      if (!pool.tasks.some((x) => x.status === "approved")) reasons.push("nothing is approved");
      if (pool.tasks.some((x) => x.status === "approved" && x.files.some((f) => heldByOthers.has(f)))) {
        reasons.push(`the approved ones are on files held by another session: ${pool.tasks.filter((x) => x.status === "approved" && x.files.some((f) => heldByOthers.has(f))).map((x) => x.id).join(", ")}`);
      }
      console.log(`nothing to take${reasons.length ? ` (${reasons.join("; ")})` : ""}`);
      return;
    }
      allocate(t, pool);
      return;
  }

  if (verb === "done" || verb === "block" || verb === "release") {
    const t = pool.tasks.find((x) => x.id === rest[0]);
    if (!t) { console.error(`no such task: ${rest[0]}`); process.exit(2); }
    if (verb === "done") t.status = "done";
    else if (verb === "block") t.status = "blocked";
    else { t.status = "approved"; t.owner = null; }
    t.history.push({ at: new Date().toISOString(), by: ME, to: t.status });
    savePool(pool);
    console.log(`${t.id} -> ${t.status}${t.owner ? ` (owner ${t.owner})` : ""}`);
    return;
  }

  if (verb === "allocate") {
    const t = pool.tasks.find((x) => x.id === rest[0]);
    if (!t) { console.error(`no such task: ${rest[0]}`); process.exit(2); }
    // An owner may allocate a proposed task to themselves, but cannot make a
    // proposal self-approving - that is the whole point of the approval gate.
    if (t.status === "proposed") {
      console.error(`${t.id} is only proposed - the owner must approve it first (pool approve ${t.id})`);
      process.exit(2);
    }
    if (t.owner && t.owner !== ME) {
      console.error(`${t.id} is already allocated to ${t.owner} since ${stamp(t.at)} - not taking it`);
      process.exit(3);
    }
    allocate(t, pool);
    return;
  }

  if (verb === "touch") {
    // Extends the lease for work that legitimately runs longer than the default.
    // Without this a long task would be reaped out from under a session that is
    // still working on it.
    const t = pool.tasks.find((x) => x.id === rest[0]);
    if (!t) { console.error(`no such task: ${rest[0]}`); process.exit(2); }
    if (t.status !== "doing") { console.error(`${t.id} is ${t.status}, not doing`); process.exit(2); }
    t.touchedAt = new Date().toISOString();
    t.history.push({ at: t.touchedAt, by: ME, to: "lease extended" });
    savePool(pool);
    console.log(`${t.id} lease extended to ${stamp(t.touchedAt)} (${Math.round(POOL_LEASE_MS / 60000)}min)`);
    return;
  }

  if (verb === "rm") {
    // Added 29 Sep after it became clear there was no way to REMOVE a task, and
    // the only available workaround was deleting pool.json wholesale - which
    // clobbered the other session's lease and read as data loss. A tool should
    // never force a destructive action that a narrow one would replace.
    // Split on commas as well as spaces: `pool rm t001,t002` is the obvious way
    // to call this, and the first version accepted the argument and matched
    // nothing, reporting "removed 0" - a command that silently does nothing is
    // the failure mode this file keeps cataloguing.
    const ids = rest
      .filter((a) => !a.startsWith("--"))
      .flatMap((a) => a.split(","))
      .map((a) => a.trim())
      .filter(Boolean);
    const withOwner = rest.includes("--all-mine");
    const targets = withOwner ? pool.tasks.filter((t) => t.owner === ME).map((t) => t.id) : ids;
    if (!targets.length) { console.log("(nothing to remove)"); return; }
    const known = new Set(pool.tasks.map((t) => t.id));
    const missing = targets.filter((id) => !known.has(id));
    if (missing.length) console.log(`  not found (ignored): ${missing.join(", ")}`);
    const hit = targets.filter((id) => known.has(id));
    if (!hit.length) { console.log("(nothing to remove)"); return; }
    for (const id of hit) releaseFiles((pool.tasks.find((t) => t.id === id) || {}).files);
    pool.tasks = pool.tasks.filter((t) => !hit.includes(t.id));
    savePool(pool);
    console.log(`removed ${hit.length} task(s): ${hit.join(", ")}`);
    return;
  }

  if (verb === "edit") {
    // Narrow, non-destructive update. Added because the alternative for changing
    // a task was `rm` then `add`, which changes its id and loses its history -
    // so a task cannot be corrected in place, only replaced. Id and history are
    // deliberately immutable; only the mutable fields are touched.
    const id = rest.find((a) => !a.startsWith("--"));
    if (!id) { console.error("Usage: pool edit <id> [--title=...] [--files=a,b]"); process.exit(2); }
    const t = pool.tasks.find((x) => x.id === id);
    if (!t) { console.error(`no such task: ${id}`); process.exit(2); }
    const changes = [];
    const title = (args.find((a) => a.startsWith("--title=")) || "").slice(8);
    if (title) { t.title = title; changes.push("title"); }
    // `args.includes("--files=")` is wrong: args holds the full argument
    // ("--files=a,b"), not the bare flag, so it never matches. Use a prefix
    // test. Caught by running it rather than reading it.
    const filesArg = args.find((a) => a.startsWith("--files="));
    if (filesArg !== undefined) {
      const files = filesArg
        .slice("--files=".length)
        .split(",").map((f) => f.trim()).filter(Boolean);
      // Files are part of the duplicate-claim guarantee, so changing them has to
      // move the claim rather than leave the old one behind. Doing it silently
      // would mean the claim table and the pool disagree about what is held.
      releaseFiles(t.files);
      t.files = files;
      claimFiles(t.files);
      changes.push(`files (${files.length ? files.join(",") : "none"})`);
    }
    if (!changes.length) {
      console.log("nothing to change. Use --title=... and/or --files=a,b");
      return;
    }
    t.history.push({ at: new Date().toISOString(), by: ME, to: `edited: ${changes.join(", ")}` });
    savePool(pool);
    console.log(`edited ${t.id}: ${changes.join(", ")}`);
    return;
  }

  if (verb === "reap") {
    // A session that dies mid-task must not park it forever. The owner's PID is
    // recorded at allocation, so liveness is checkable rather than a guess.
    let n = 0;
    for (const t of pool.tasks) {
      if (isStale(t)) {
        const was = t.owner;
        t.status = "approved";
        t.owner = null;
        releaseFiles(t.files);
        t.history.push({ at: new Date().toISOString(), by: ME, to: "approved (reaped: lease expired)" });
        console.log(`  reaped ${t.id} (was ${was}) - untouched for over ${Math.round(POOL_LEASE_MS / 60000)}min, back in the pool`);
        n += 1;
      }
    }
    savePool(pool);
    if (!n) console.log("(nothing to reap)");
    return;
  }

  if (verb === "list" || !verb) {
    if (!pool.tasks.length) { console.log("(pool is empty)"); return; }
    console.log(`  (times are ${TZ_NOTE})`);
    for (const t of pool.tasks) {
      let mark = t.status === "approved" && !t.owner ? " <- available" : "";
      if (isStale(t)) {
        mark = " <- ABANDONED, owner process gone (run: pool reap)";
      }
      const who = t.owner || "";
      console.log(`  ${t.id}  ${t.status.padEnd(9)} ${(who + " ").padEnd(18)}${clip(t.title, 44)}  at ${stamp(t.at)}${mark}`);
    }
    return;
  }

  console.error("Usage: pool add|propose|approve|take|done|block|release|list ...");
  process.exit(2);
};

// ── friction counter: the low threshold for a second opinion ───────────────
//
// The owner's rule: consult the free model on MULTIPLE FAILS, STALLS, RETRIES,
// REWORKS, or the unknown - i.e. a deliberately LOW threshold, because a session
// grinding through the same failure three times is more expensive than one free
// call.
//
// A consult is only worth anything if it carries context. "it's broken" gets a
// generic answer, so each attempt records the goal, what was tried, and the
// actual error, and the prompt is assembled from that history. That is the whole
// point of counting rather than just calling: attempt 2 knows attempt 1 failed,
// so the question can say "these have all been tried and here is what each did".
//
// The threshold is 2 by default - low, as asked - and is overridable because the
// right value depends on the task. Auto-consult fires ONCE per attempt at or
// above the threshold, so a genuinely hard problem can be re-asked rather than
// going silent on the second failure.
const FRICTION_DIR = join(TASKS_DIR);
const STUCK_THRESHOLD = Number(process.env.SHOS_STUCK_THRESHOLD || 2);

function frictionPath(slug) {
  return join(TASKS_DIR, slug, "_friction.json");
}

commands.stuck = async (args) => {
  const [slug, ...rest] = args;
  if (!slug) {
    console.error('Usage: stuck <slug> "<what you are trying to do>" ["<what happened>"] [--no-consult]');
    process.exit(2);
  }
  const goal = rest.filter((a) => a !== "--no-consult")[0] || "(unspecified)";
  const what = rest.filter((a) => a !== "--no-consult").slice(1).join(" ") || "(no detail given)";
  const wantConsult = !args.includes("--no-consult");

  const path = frictionPath(slug);
  const state = readJson(path, { slug, attempts: [] });
  state.attempts.push({
    at: new Date().toISOString(),
    by: ME,
    n: state.attempts.length + 1,
    goal,
    outcome: what.slice(0, 600),
  });
  writeJson(path, state);

  const n = state.attempts.length;
  const due = n >= STUCK_THRESHOLD;
  console.log(`recorded attempt ${n}${due ? ` (threshold is ${STUCK_THRESHOLD})` : ""} for ${slug}`);

  if (!due || !wantConsult) {
    if (due && !wantConsult) console.log("  --no-consult given, not calling the second opinion");
    else console.log(`  ${STUCK_THRESHOLD - n} more before it will consult a second opinion`);
    return;
  }

  // Assemble the question from the history, not from this attempt alone.
  const history = state.attempts
    .map((a) => `${a.n}. ${a.what || a.goal} -> ${a.outcome}`)
    .join("\n");
  const prompt =
    `I am stuck on a problem and have already failed ${n} times. Here is what I was trying and what happened.\n\n` +
    `GOAL: ${goal}\n\nATTEMPTS (all failed):\n${history}\n\n` +
    `Give me the most likely root cause I am missing, and the one thing I should try next. ` +
    `Be concrete. If you need information you do not have, say exactly what to check.`;

  console.log(`threshold reached, consulting the second opinion on ${slug}...`);
  writeJson(join(TASKS_DIR, slug, "_last-consult-request.json"), { at: new Date().toISOString(), by: ME, attempts: n });

  // Delegates rather than duplicating the provider code: consult.mjs already
  // owns the cost ladder, the retry policy and the key handling.
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(
    process.execPath,
    [join(import.meta.dirname, "consult.mjs"), "gemini", prompt, `--task=${slug}`],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  process.stdout.write(r.stdout || "");
  if (r.status !== 0) {
    process.stderr.write(r.stderr || "");
    console.log("\nthe second opinion failed - the attempts are still recorded, retry with: consult.mjs gemini \"...\" --task=" + slug);
  }
};

// ── conversation backlog ───────────────────────────────────────────────────
//
// A new session inherits CLAUDE.md and the shared state, but it has NO memory of
// any conversation that came before it. That is the honest boundary, and it is
// the thing that makes handing this project to a fresh session expensive: the
// next one re-derives context the last one already paid for.
//
// So every session appends here as it goes, and a new session reads it first.
// Markdown rather than JSONL, deliberately: a human reads this too, and the
// point is that the next session - or you - can pick it up without a tool.
//
// The recording rule is in CLAUDE.md, because "log it" is useless as advice; it
// has to be an instruction the next session inherits. It is scoped to things
// that are NOT already durable elsewhere: decisions and their reasons, things
// tried that did not work, and the state of anything still open. Commits are
// already in git and findings already in docs/, so duplicating them here would
// just be a second place for them to go stale.

const BACKLOG_PATH = join(HOME_DIR, "backlog.md");

const KINDS = {
  decision: "Decision",
  blocker: "Blocker",
  finding: "Finding",
  question: "Question",
  state: "State",
  done: "Done",
  mistake: "Mistake",
};

commands.log = async (args) => {
  const kindArg = args.find((a) => a.startsWith("--kind="));
  const kind = kindArg ? kindArg.split("=")[1] : "state";
  if (!KINDS[kind]) {
    console.error(`Unknown --kind. Use one of: ${Object.keys(KINDS).join(", ")}`);
    process.exit(2);
  }
  const text = args.filter((a) => !a.startsWith("--")).join(" ");
  if (!text) {
    console.error('Usage: log "<entry>" [--kind=decision|blocker|finding|question|state|done|mistake]');
    process.exit(2);
  }
  mkdirSync(HOME_DIR, { recursive: true });
  if (!existsSync(BACKLOG_PATH)) {
    writeFileSync(
      BACKLOG_PATH,
      "# Conversation backlog\n\n" +
        "Durable record of decisions, dead ends, and open state, so a NEW session can\n" +
        "pick up without re-deriving everything. Appended by every session via\n" +
        "`session-bridge.mjs log`; read it with `session-bridge.mjs backlog`.\n\n" +
        "Times are UTC. This file is outside the repository on purpose.\n\n---\n\n",
      "utf8"
    );
  }
  const at = new Date().toISOString();
  appendFileSync(BACKLOG_PATH, `### ${at} — ${ME} — ${KINDS[kind]}\n${text}\n\n`, "utf8");

  // Recorded as a notice too, so a session that only runs `inbox` still sees
  // that something changed, without needing to know the backlog exists.
  const notices = existsSync(NOTICE_PATH)
    ? readFileSync(NOTICE_PATH, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
    : [];
  const seq = (notices.length ? notices[notices.length - 1].seq || 0 : 0) + 1;
  appendFileSync(
    NOTICE_PATH,
    JSON.stringify({ seq, at, from: ME, text: `${KINDS[kind]}: ${text.slice(0, 160)}` }) + "\n",
    "utf8"
  );
  console.log(`logged (${KINDS[kind]}) at ${stamp(at)} — also posted as notice #${seq}`);
};

commands.backlog = async (args) => {
  if (!existsSync(BACKLOG_PATH)) {
    console.log("(no backlog yet - this is the first entry)");
    return;
  }
  const full = args.includes("--all");
  const body = readFileSync(BACKLOG_PATH, "utf8");
  if (full) {
    console.log(body);
    return;
  }
  // Default is the TAIL, because the most recent state is what a new session
  // needs and the file only grows. A full history dump is context the session
  // will not use, and burying the current state under 200 entries is how a
  // handover document quietly stops being read.
  const chunks = body.split(/^### /m).filter(Boolean);
  const header = chunks.shift() || "";
  const want = Number((args.find((a) => /^\d+$/.test(a)) || "8"));
  console.log(header.trim());
  console.log(`--- most recent ${Math.min(want, chunks.length)} of ${chunks.length} entries ---\n`);
  for (const c of chunks.slice(-want)) {
    console.log("### " + c.trimEnd());
    console.log("");
  }
  if (chunks.length > want) {
    console.log(`(${chunks.length - want} older entries hidden - use "backlog --all" or "backlog <n>")`);
  }
};

// ── lessons: durable rules, not chronology ─────────────────────────────────
//
// The backlog answers "what happened". This answers "what must a future session
// NOT do, and what to do instead" — the class of knowledge that is worthless in
// a transcript and valuable as a rule. Separated deliberately: a chronological
// log grows without bound and gets skimmed, whereas this stays short enough to
// read in full every session.
//
// Format is RULE / DO / WHY / EVIDENCE rather than prose, because the reader is
// mostly an AI and a labelled line is retrievable where a paragraph is not. EVIDENCE
// is required and not optional: an unevidenced rule is a superstition, and this
// repo has repeatedly found those ("fixed" bugs that were not bugs, gates that
// measured nothing). A rule whose evidence has expired should be deleted, not
// inherited.

const LESSONS_PATH = join(HOME_DIR, "lessons.md");
const LKINDS = ["cannot", "must", "prefer", "verify"];

commands.lesson = async (args) => {
  // lesson "<what cannot be done / rule>" "<what to do instead>" --kind=cannot --evidence="..."
  const kind = (args.find((a) => a.startsWith("--kind=")) || "").split("=")[1] || "cannot";
  const evidence = (args.find((a) => a.startsWith("--evidence=")) || "").slice(11);
  const positional = args.filter((a) => !a.startsWith("--"));
  const rule = positional[0];
  const instead = positional.slice(1).join(" ");
  if (!rule || !instead) {
    console.error(`Usage: lesson "<rule>" "<what to do instead>" [--kind=${LKINDS.join("|")}] [--evidence="..."]`);
    process.exit(2);
  }
  if (!LKINDS.includes(kind)) {
    console.error(`--kind must be one of: ${LKINDS.join(", ")}`);
    process.exit(2);
  }
  if (!evidence) {
    // Not pedantry: a rule with no evidence is how a wrong rule becomes
    // permanent, because the next session has no way to tell a measured finding
    // from an assumption.
    console.error("refusing to record a rule with no --evidence. A rule with no provenance is a superstition.");
    process.exit(2);
  }
  mkdirSync(HOME_DIR, { recursive: true });
  if (!existsSync(LESSONS_PATH)) {
    writeFileSync(
      LESSONS_PATH,
      "# Lessons — durable rules for this repo\n\n" +
        "Read at session start. `RULE` / `DO` / `EVIDENCE` is the shape, because the\n" +
        "reader is mostly an AI and labelled lines are retrievable where prose is not.\n\n" +
        "If a rule's evidence is no longer valid, DELETE it. Do not inherit it.\n\n---\n\n",
      "utf8"
    );
  }
  const n = (readFileSync(LESSONS_PATH, "utf8").match(/^### L-/gm) || []).length + 1;
  appendFileSync(
    LESSONS_PATH,
    `### L-${String(n).padStart(3, "0")} [${kind}] ${ME}\n` +
      `RULE: ${rule}\nDO: ${instead}\nEVIDENCE: ${evidence}\n\n`,
    "utf8"
  );
  console.log(`recorded L-${String(n).padStart(3, "0")} (${kind})`);
};

commands.lessons = async (args) => {
  if (!existsSync(LESSONS_PATH)) {
    console.log("(no lessons recorded yet)");
    return;
  }
  const body = readFileSync(LESSONS_PATH, "utf8");
  if (args.includes("--grep")) {
    const q = (args[args.indexOf("--grep") + 1] || "").toLowerCase();
    if (!q) { console.error('Usage: lessons --grep <term>'); process.exit(2); }
    const blocks = body.split(/^### /m).filter((b) => b.toLowerCase().includes(q));
    console.log(`${blocks.length} lesson(s) matching "${q}"`);
    for (const b of blocks) console.log("\n### " + b.trimEnd());
    return;
  }
  console.log(body);
};

commands.claim = async (args) => {
  const mode = args[0] === "release" ? "release" : "claim";
  const files = args.filter((a) => a !== "release");
  if (!files.length) { console.error("Usage: claim <file...> | claim release <file...>"); process.exit(2); }
  const store = readJson(CLAIM_PATH, {});
  // Declared outside the branch because the exit-code check below is outside it
  // too; the first version declared it with const inside the if-block and threw
  // "clash is not defined" on exactly the path it existed to report.
  let clash = [];
  if (mode === "claim") {
    // Holders are a LIST, not a single value. With a single value a second
    // claimer silently replaced the first, so the table only ever showed the
    // most recent claimant and NEITHER session could see that a conflict existed
    // — a collision check that cannot represent a collision.
    clash = files.filter((f) => (store[f]?.holders || []).some((h) => h.by !== ME));
    if (clash.length) {
      const detail = clash
        .map((f) => `${f} (held by ${store[f].holders.filter((h) => h.by !== ME).map((h) => h.by).join(", ")})`)
        .join(", ");
      console.log(`WARNING: already claimed by another session: ${detail}`);
    }
    for (const f of files) {
      const holders = (store[f]?.holders || []).filter((h) => h.by !== ME);
      store[f] = { holders: [...holders, { by: ME, at: new Date().toISOString() }] };
    }
  } else {
    for (const f of files) {
      if (store[f]) {
        const kept = store[f].holders.filter((h) => h.by !== ME);
        if (kept.length) store[f] = { holders: kept };
        else delete store[f];
      }
    }
  }
  writeJson(CLAIM_PATH, store);
  console.log(`${mode}: ${files.join(", ")}`);
  if (clash.length) {
    // Advisory, not a block: the claim is still recorded so BOTH sessions can
    // see the conflict, but the non-zero exit lets a caller or a later step
    // treat it as fatal if it wants to.
    process.exitCode = 3;
  }
};

commands.claims = async () => {
  const store = readJson(CLAIM_PATH, {});
  const rows = Object.entries(store);
  if (!rows.length) { console.log("(no claims)"); return; }
  for (const [f, v] of rows.sort()) {
    const holders = v.holders || [];
    const names = holders.map((h) => (h.by === ME ? `${h.by} (me)` : h.by));
    const conflict = holders.length > 1 ? "   <-- CONFLICT, both sessions hold this" : "";
    console.log(`  ${names.join(" + ")}  ${f}   (since ${stamp(v.holders[0]?.at)}) ${conflict}`);
  }
};

commands.login = async (args) => {
  // Accepts the password as one argument, or on stdin, so it need not appear in
  // a shell history file. Written OUTSIDE the repo, deliberately.
  const password = args[0] || readFileSync(0, "utf8").trim();
  if (!password) {
    console.error('Usage: login <password>   (or: echo "password" | node scripts/session-bridge.mjs login)');
    process.exit(2);
  }
  const user = process.env.SHOS_OC_USER || "opencode";
  writeJson(CRED_PATH, { user, password, url: baseUrl() });
  console.log(`credentials written to ${CRED_PATH} (outside the repository)`);
  const health = await api("GET", "/global/health").then(() => "authenticated").catch((e) => `FAILED: ${e.message}`);
  console.log(`check: ${health}`);
};

commands.peer = async (args) => {
  if (args[0] === "set") {
    if (!args[1]) { console.error("Usage: peer set <sessionID>"); process.exit(2); }
    writeJson(PEER_PATH, { sessionID: args[1], setAt: new Date().toISOString() });
    console.log(`peer pinned -> ${args[1]}`);
  } else {
    const peer = readJson(PEER_PATH, {});
    console.log(peer.sessionID ? `peer = ${peer.sessionID} (set ${stamp(peer.setAt)} ${TZ_NOTE})` : "(no peer pinned)");
  }
};

commands.tasks = async (args) => {
  const dir = join(HOME_DIR, "tasks");
  if (!existsSync(dir)) { console.log("(no tasks yet)"); return; }
  for (const slug of readJson(join(dir, "index.json"), [])) {
    console.log(`  ${slug}`);
  }
};

commands["help"] = async () => {
  console.log(`session-bridge — talk to another opencode session on this machine

  list [--all] [N]              recent sessions (scoped to this dir)
  ask <sessionID> "text"        queue a prompt; returns immediately
  ask <sessionID> "text" --steer   interrupt their current turn instead
  poll <sessionID> [N]          new messages since last poll
  read <sessionID> [N]          recent transcript
  notice <text>                leave a message the other session picks up
  inbox                        show notices + task folders since last check
  task new <slug> [brief]      create a task folder
  task write <slug> <file>     write a numbered doc (refuses to overwrite)
  task read <slug> [file]      read one doc, or list the folder
  task list                    list all tasks
  claim <file...>              record file ownership
  log "<entry>" [--kind=X]     append to the conversation backlog
  backlog [N|--all]          read recent backlog entries (what a NEW session does first)
  lesson "<rule>" "<do instead>"     record a durable RULE/DO/EVIDENCE lesson (--evidence required)
  lessons [--grep X]           read all lessons, or grep them
  claims                       show current claims
  pool list                    show the approved work pool
  pool add "<title>" [--files=a,b]   add an already-approved task
  pool propose "<title>"         propose one; inert until the owner approves it
  pool approve <id>            owner approves a proposed task
  pool take                     pull the next approved task (atomic-ish)
  pool done|block|release <id>  finish, park, or hand a task back
  pool edit <id> [--title=...] [--files=a,b]   correct a task in place, keeping its id + history
  pool rm <id[,id]> [--all-mine]               delete tasks; --all-mine takes only the ones you allocated
  toast <title> <message>       native TUI notification
  peer set|show                 pin the other session's id

Add --local to any command to render timestamps in local time instead of UTC.
Stored timestamps are always UTC ISO-8601; --local only changes the display.
  login <password>              write credentials (outside the repo)

No command blocks. ask returns as soon as the prompt is queued, so the caller
does its own work and polls when convenient.`);
};

// ── dispatch ────────────────────────────────────────────────────────────────

const [, , cmd, ...rest] = process.argv;
const fn = commands[cmd || "help"];
if (!fn) {
  console.error(`Unknown command: ${cmd}`);
  await commands["help"]();
  process.exit(2);
}
try {
  await fn(rest);
} catch (err) {
  // A thrown error may carry its own exit code, so a deliberate "refused"
  // (3 = blocked, nothing ran) stays distinguishable from a genuine failure
  // (1). The message is printed bare in that case, because the caller already
  // wrote a human-readable sentence and "error: refusing to create t012..." is
  // just noise on top of it.
  if (err.exitCode) {
    console.error(err.message);
    process.exit(err.exitCode);
  }
  console.error(`error: ${err.message}`);
  process.exit(1);
}

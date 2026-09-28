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

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
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
  return new Date(t).toLocaleTimeString("en-GB", { hour12: false });
}

function clip(text, n) {
  if (text.length <= n) return text;
  return text.slice(0, n) + `... [${text.length} chars total]`;
}

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
  for (const s of list) {
    const when = new Date(s.time?.updated || Date.now())
      .toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
    const title = (s.title || "(untitled)").replace(/\s+/g, " ");
    console.log(`${s.id}  ${when}  ${s.parentID ? "sub" : "root"}  ${clip(title, 56)}`);
  }
  if (!list.length) console.log("(no sessions)");
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
  for (const m of msgs) {
    const text = messageText(m);
    if (!text) continue;
    console.log(`[${messageTime(m)}] ${messageRole(m)}: ${clip(text, 1000)}`);
  }
  if (!msgs.length) console.log("(no messages)");
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
  const cursors = readJson(INBOX_CURSOR_PATH, {});
  const last = cursors.noticeCursor || 0;
  let notices = [];
  try {
    notices = existsSync(NOTICE_PATH)
      ? readFileSync(NOTICE_PATH, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
      : [];
  } catch { /* a malformed line must not hide the rest */ }
  const fresh = notices.filter((n) => (n.seq || 0) > last);
  const taskDir = TASKS_DIR;
  const tasks = existsSync(taskDir) ? readdirSync(taskDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
  if (!fresh.length && !tasks.length) {
    console.log("(nothing new)");
    return;
  }
  if (fresh.length) {
    console.log(`--- ${fresh.length} notice(s) ---`);
    for (const n of fresh) {
      console.log(`  [${n.at || ""}] ${n.from || "?"}: ${n.text}`);
    }
  }
  if (tasks.length) {
    console.log(`--- task folders (read one with: task read <slug>) ---`);
    for (const t of tasks) console.log(`  ${t}`);
  }
  const next = notices.length ? (notices[notices.length - 1].seq || last) : last;
  writeJson(INBOX_CURSOR_PATH, { noticeCursor: next, checkedAt: new Date().toISOString() });
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
    console.log(`  ${names.join(" + ")}  ${f}${conflict}`);
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
    console.log(peer.sessionID ? `peer = ${peer.sessionID} (set ${peer.setAt})` : "(no peer pinned)");
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
  claims                       show current claims
  toast <title> <message>       native TUI notification
  peer set|show                 pin the other session's id
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
  console.error(`error: ${err.message}`);
  process.exit(1);
}

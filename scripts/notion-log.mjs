// notion-log.mjs - append to the Notion pages this project keeps its history in.
//
// WHY THIS EXISTS RATHER THAN THE MCP
//
// The project has had a Notion MCP configured for a long time and it currently
// reports `connected` (verified with `opencode mcp list`). It was not usable from
// the session that wrote this file, because MCP servers are attached at session
// start - a session opened before the server was connected simply does not have
// the tools, and nothing in the config makes that visible from inside. So this
// script talks to the REST API directly, which needs no MCP at all and works
// from any session, present or future.
//
// It is also better suited to the actual job: appending a dated entry to a long
// log, verifying the write afterwards, and failing loudly if it did not land. The
// MCP is fine for ad-hoc reads; it is a worse fit for a repeatable, verifiable
// append. This is the same lesson as the encoding guard - a write that reports
// success without being checked is the failure mode this repo keeps cataloguing.
//
// Auth is $NOTION_TOKEN. Never written anywhere, never logged.

const TOKEN = process.env.NOTION_TOKEN;
const VERSION = "2022-06-28";

const PAGES = {
  development: { id: "3b013572-4f67-80ab-b1a0-c665a828e241", name: "Development Log" },
  audits: { id: "3e913572-4f67-81f9-8184-ce5f5694a0fa", name: "Audits & Reviews" },
};

function headers() {
  if (!TOKEN) {
    console.error("NOTION_TOKEN is not set in this shell.");
    process.exit(2);
  }
  return {
    Authorization: `Bearer ${TOKEN}`,
    "Notion-Version": VERSION,
    "Content-Type": "application/json",
  };
}

async function api(method, path, body) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${method} ${path} -> non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(`${method} ${path} -> HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

// Notion truncates rich text at 2000 chars per element, so a long body is split
// into paragraphs rather than silently clipped mid-sentence.
function paragraphs(text) {
  return String(text)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [{ type: "text", text: { content: p.slice(0, 1900) } }] },
    }));
}

async function check() {
  for (const [key, page] of Object.entries(PAGES)) {
    const p = await api("GET", `/pages/${page.id}`);
    const title = Object.values(p.properties || {})
      .flatMap((v) => v.title || [])
      .map((t) => t.plain_text)
      .join("");
    const kids = await api("GET", `/blocks/${page.id}/children?page_size=1`);
    console.log(`  ${page.name}: OK, title="${title}"`);
    console.log(`    last_edited=${p.last_edited_time}  has_children=${kids.results.length > 0}`);
    void key;
  }
}

async function append(pageKey, heading, body) {
  const page = PAGES[pageKey];
  // PATCH, not POST. This is recorded in CLAUDE.md's 26 Sep 2026 entry: the
  // append endpoint is PATCH /v1/blocks/{block_id}/children, POST is not a
  // valid method on that path, and Notion's error text for it is literally
  // "Invalid request URL" - which reads exactly like an auth or permissions
  // fault and previously had this written off as one. First version of this
  // script used POST and reproduced the whole thing, despite the answer being
  // in this repo's own history.
  const res = await api("PATCH", `/blocks/${page.id}/children`, {
    children: [paragraphs(heading)[0], ...paragraphs(body)],
  });
  // Verify rather than trust, and paginate to the END. The first version only
  // scanned the first 100 children, which on a page with well over a thousand
  // blocks cannot possibly see the newest ones - so it would have reported
  // "not found" for a write that succeeded. A verification that cannot reach
  // the thing it verifies is not a verification.
  const needle = heading.slice(0, 40);
  let cursor;
  let pages = 0;
  let landed = false;
  do {
    const q = cursor ? `?page_size=100&start_cursor=${cursor}` : "?page_size=100";
    const chunk = await api("GET", `/blocks/${page.id}/children${q}`);
    pages += 1;
    landed = chunk.results.some((b) =>
      (b?.[b.type]?.rich_text || []).some((t) => (t.plain_text || "").includes(needle))
    );
    cursor = chunk.has_more ? chunk.next_cursor : null;
  } while (cursor && !landed && pages < 40);

  console.log(`  ${page.name}: appended ${res.results?.length ?? "?"} block(s)`);
  console.log(`  re-read verified present: ${landed ? "YES" : "NO - the write did not land"} (scanned ${pages} page(s) of children)`);
  return landed;
}

// argv[0] is the node binary and argv[1] this file, so the args start at 2.
// session-bridge.mjs gets this right and is the reference; the first version
// here did not and printed usage for a valid command.
const [, , cmd, pageKey, ...rest] = process.argv;

if (cmd === "check") {
  console.log("Notion access:");
  await check();
  process.exit(0);
}

if (cmd === "append") {
  if (!PAGES[pageKey]) {
    console.error(`Unknown page "${pageKey}". Known: ${Object.keys(PAGES).join(", ")}`);
    process.exit(2);
  }
  const [heading, ...body] = rest;
  if (!heading) {
    console.error("Usage: notion-log.mjs append <development|audits> \"heading\" \"body\"");
    process.exit(2);
  }
  const landed = await append(pageKey, heading, body.join(" ") || heading);
  process.exit(landed ? 0 : 1);
}

console.log(`Usage:
  notion-log.mjs check
  notion-log.mjs append <development|audits> "heading" "body"`);
process.exit(2);

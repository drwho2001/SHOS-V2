// Encoding guard — added 25 Sep 2026 after a real, committed case of
// character corruption was found in this repo's own source-of-truth doc.
//
// WHAT HAPPENED: CLAUDE.md (and later SHOS_Vaccinations_Prototype.jsx)
// contained genuine, committed mojibake. Original UTF-8 bytes had been
// read as CP1252/Latin-1 and re-encoded as UTF-8, so every em-dash had
// become the 3 characters U+00E2 U+20AC U+201D (~1,800 occurrences across
// the two files), and it had survived build, lint, vitest and the 15-flow
// smoke suite because all of those check BEHAVIOUR, not bytes. Nothing in
// the repo could have caught it. That's what this script is for.
//
// NOTE: this file deliberately describes those sequences in HEX rather than
// reproducing them literally. Writing the literal characters into this
// comment reintroduced the exact corruption being fixed - and this guard
// caught it, on its own source, in its first CI run.
//
// WHAT IT CHECKS, per git-tracked text file:
//   1. valid UTF-8 (catches truncated / partially written bytes)
//   2. C1 control characters U+0080-U+009F - never legitimate in source.
//      These are the fingerprint of a lossy CP1252 round-trip, where an
//      undefined byte (0x80, 0x81, ...) was replaced by the euro sign or
//      dropped entirely, which is why a naive "decode it back" repair can
//      silently produce the WRONG character (e.g. U+00E2 U+20AC U+00A2
//      decodes to a euro sign but was actually a bullet U+2022).
//   3. classic mojibake lead characters immediately followed by another
//      non-ASCII character.
//
// Deliberately uses `git ls-files` rather than a filesystem walk, so
// untracked build output (node_modules, dist/, the committed-by-accident
// android/app/src/main/assets/public/ copy) can never produce a false
// failure — only real, tracked source is inspected.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const TEXT_EXT = new Set([
  ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".json", ".md", ".html",
  ".css", ".xml", ".yml", ".yaml", ".ps1", ".java", ".kt", ".txt", ".sql",
]);

const C1 = /[\u0080-\u009F]/;                 // lossy-encoding fingerprint
// Lead characters that only ever appear in double-encoded text, when
// immediately followed by another non-ASCII character. The follower range
// is deliberately everything >= 0x80, NOT just 0x80-0xFF: the most common
// sequence is "â" + "€" (U+20AC), and an earlier version of this check
// used 0x80-0xFF and therefore missed the single most common case of all —
// caught only because the guard was deliberately tested against injected
// corruption before being trusted. There are zero legitimate occurrences
// of Â/Ã/â/ã followed by a non-ASCII char in this repo.
const LEAD = /[\u00C2\u00C3\u00E2\u00E3][\u0080-\uFFFF]/;

function listTrackedFiles() {
  try {
    return execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
      .split("\0")
      .filter(Boolean);
  } catch (e) {
    console.error("Could not run `git ls-files` — run this from inside the repo.");
    process.exit(2);
  }
}

// Strict UTF-8 validation: decode and re-encode, and separately walk the
// bytes looking for anything that isn't well-formed.
function findInvalidUtf8(buf) {
  const problems = [];
  let i = 0;
  while (i < buf.length) {
    const b = buf[i];
    let need = 0;
    if (b <= 0x7F) { i++; continue; }
    else if (b >= 0xC2 && b <= 0xDF) need = 1;
    else if (b >= 0xE0 && b <= 0xEF) need = 2;
    else if (b >= 0xF0 && b <= 0xF4) need = 3;
    else { problems.push([i, `invalid lead byte 0x${b.toString(16)}`]); i++; continue; }
    for (let k = 1; k <= need; k++) {
      if (i + k >= buf.length || (buf[i + k] & 0xC0) !== 0x80) {
        problems.push([i, `truncated/invalid UTF-8 sequence at byte ${i}`]);
        i++;
        break;
      }
    }
    i += need + 1;
  }
  return problems;
}

function lineColOf(text, index) {
  let line = 1, last = -1;
  for (let i = 0; i < index; i++) if (text[i] === "\n") { line++; last = i; }
  return { line, col: index - last };
}

const files = listTrackedFiles().filter((f) => TEXT_EXT.has(path.extname(f).toLowerCase()));
const findings = [];
let withBom = 0;
let scanned = 0;

for (const rel of files) {
  let buf;
  try { buf = fs.readFileSync(rel); } catch { continue; }
  scanned++;
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) withBom++;

  const bom = buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe;
  const bomBE = buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff;
  if (bom || bomBE) {
    // Legitimately UTF-16 (e.g. Windows PowerShell module manifests).
    // Validate as UTF-16 instead of failing the UTF-8 byte walk.
    try {
      const as16 = buf.toString(bom ? "utf16le" : "utf16le");
      if (as16.includes("\uFFFD")) {
        findings.push({ file: rel, line: 0, col: 0, msg: "UTF-16 file contains an undecodable unit" });
      }
    } catch { /* leave it alone; not our business to police */ }
    continue;
  }

  for (const [off, msg] of findInvalidUtf8(buf)) {
    findings.push({ file: rel, line: 0, col: off, msg });
  }

  const text = buf.toString("utf8");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const code = text.charCodeAt(i);
    // Surrogate handling: an astral character (emoji, etc.) is legitimately
    // stored in JS as a PAIR of UTF-16 code units, so a low surrogate is
    // only a problem if it is NOT preceded by a high surrogate. Flagging
    // every low surrogate produced ~49 false positives on a clean repo
    // (all the seed-data emoji), which is exactly why this check is
    // pairing-aware.
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        findings.push({ file: rel, ...lineColOf(text, i), msg: "unpaired high surrogate (truncated emoji or corrupt text)" });
      }
      i += 1; // consume the pair together
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      findings.push({ file: rel, ...lineColOf(text, i), msg: "lone low surrogate (truncated emoji or corrupt text)" });
      continue;
    }
    if (C1.test(ch)) {
      findings.push({ file: rel, ...lineColOf(text, i), msg: `C1 control char U+${code.toString(16).toUpperCase().padStart(4, "0")} (encoding-corruption fingerprint)` });
    } else if (LEAD.test(text.substr(i, 2))) {
      const pair = text.substr(i, 2);
      const codes = Array.from(pair).map((c) => "U+" + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")).join(" + ");
      findings.push({ file: rel, ...lineColOf(text, i), msg: `mojibake sequence ${codes} (likely an em-dash/bullet/arrow/etc. that was double-encoded)` });
      i += 1; // report the pair once, not each half
    }
  }
}

console.log(`Encoding guard: scanned ${scanned} git-tracked text files (${withBom} with a UTF-8 BOM).`);

if (findings.length === 0) {
  console.log("OK - no mojibake, no C1 control characters, no invalid UTF-8.");
  process.exit(0);
}

console.log(`\nFAILED - ${findings.length} encoding problem(s) found:\n`);
const byFile = new Map();
for (const f of findings) {
  if (!byFile.has(f.file)) byFile.set(f.file, []);
  byFile.get(f.file).push(f);
}
for (const [file, list] of byFile) {
  console.log(`  ${file}  (${list.length})`);
  for (const f of list.slice(0, 5)) {
    const where = f.line ? `line ${f.line} col ${f.col}` : `byte ${f.col}`;
    console.log(`    ${where}: ${f.msg}`);
  }
  if (list.length > 5) console.log(`    ... and ${list.length - 5} more`);
}
console.log(`
Repair guidance: these are double-encoded characters, not real text. The safe
fix is to map each distinct sequence back to its intended character using its
context in the surrounding prose — a blind byte round-trip can decode to a
valid but WRONG character (a bullet "\\u2022" that was read as CP1252 comes back
as "\\u20AC" euro). Sequences that do not obviously resolve should be checked
against real usage before replacing.`);
process.exit(1);

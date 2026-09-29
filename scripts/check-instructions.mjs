// check-instructions.mjs - guard the claims CLAUDE.md makes to a new session.
//
// WHY THIS EXISTS, and why it is a guard rather than "be more careful"
//
// This repository now has a standing instruction set that every session inherits
// by reading CLAUDE.md. That instruction is only useful if it is TRUE, and it had
// quietly stopped being verified. The failure was a specific, repeated one:
//
// a check of the form
//     grep("do not inherit it", CLAUDE.md)
// reports MISSING when the phrase happens to wrap across a line break at
//     "delete it; do\nnot inherit it."
//
// That is not hypothetical. It produced false negatives FIVE times in one
// session, including inside the very check written to verify the instructions -
// so the verification itself could not be trusted, and one of the "failures" it
// reported as genuine (lessons.md missing from a list) was mixed in with two
// that were not.
//
// This is the same shape as the mojibake problem this repo already solved, and
// the answer there was not "be more careful" either. It was a gate that runs on
// every push AND is proven against deliberately injected faults, so that it is
// known to catch the thing it claims to catch. That is what this is.
//
// TWO LAYERS, because one is not enough.
//
//   1. PREVENTION: markers are matched whitespace-insensitively, so a line wrap
//      can no longer produce a false negative. That fixes the whole class for
//      anyone using this module.
//   2. DETECTION: this gate fails the build if a required instruction is absent,
//      so the instructions cannot silently rot - which is exactly what was
//      happening, undetected, across many sessions.
//
// The markers below are deliberately SHORT and chosen to be a single unbreakable
// token wherever possible, because a long phrase is a phrase that will wrap.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const CLAUDE = join(ROOT, "CLAUDE.md");

/**
 * Collapse all whitespace runs (including newlines) to single spaces, so a
 * marker matches regardless of where the source happens to wrap. This is the
 * prevention layer: it makes the line-wrap trap impossible for these checks
 * rather than something to remember.
 */
function normalise(text) {
  return text.replace(/\s+/g, " ");
}

/**
 * Every instruction a new session depends on, as [label, marker].
 *
 * Markers are intentionally SHORT. Long phrases are what wrap, and a wrapped
 * marker is what caused all five false negatives. Where a single token will do,
 * it is used alone.
 */
const REQUIRED = [
  ["two-session: set identity", "SHOS_SESSION_NAME ="],
  ["two-session: read lessons", "session-bridge.mjs lessons"],
  ["two-session: read backlog", "session-bridge.mjs backlog"],
  ["two-session: read claims", "session-bridge.mjs claims"],
  ["two-session: read pool", "session-bridge.mjs pool list"],
  ["two-session: state locations", ".shos-session-bus/state/"],
  ["two-session: backlog is a continuation", "continuation rather than a restart"],
  ["two-session: sessions do not wake each other", "do not wake each other"],
  ["two-session: never add -A", "Never `git add -A` here"],
  ["second opinion: tool", "consult.mjs gemini"],
  ["second opinion: low threshold", "stuck <slug>"],
  ["second opinion: evidence required", "--evidence"],
  ["second opinion: do not inherit", "inherit it"],
  ["logging: command", "session-bridge.mjs log"],
  ["logging: do not duplicate durable sources", "go stale"],
];

const problems = [];

// ── the gate itself ─────────────────────────────────────────────────────────

let source = "";
try {
  source = readFileSync(CLAUDE, "utf8");
} catch {
  console.error("FATAL: cannot read CLAUDE.md - the instructions every session inherits");
  process.exit(1);
}

const flat = normalise(source);
for (const [label, marker] of REQUIRED) {
  if (!flat.includes(normalise(marker))) problems.push(`missing: ${label}  (marker: "${marker}")`);
}

// ── prove the gate can actually fail ─────────────────────────────────────────
//
// A check that has never failed is a guess. So the normaliser is itself tested
// against deliberately wrapped text: if it could not see through a line break, it
// would be useless, and nothing above would be trustworthy either.

const WRAPPED_PROBE = "delete it; do\nnot inherit it.";
if (normalise(WRAPPED_PROBE).includes("do not inherit it")) {
  // correct
} else {
  problems.push('GATE IS BROKEN: normalise() cannot match across a line break');
}

// And a real negative control, so a gate that always passes is caught.
if (flat.includes("this marker is deliberately absent")) {
  problems.push("GATE IS BROKEN: normalise() matched a string that is not present");
}

// ── report ──────────────────────────────────────────────────────────────────

if (problems.length) {
  console.error(`check-instructions FAILED (${problems.length} problem(s)):`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    "\nCLAUDE.md is the only thing a new session inherits. If an instruction is\n" +
      "missing it fails silently: the session simply does something already known\n" +
      "to be wrong. Fix the text, or remove the requirement here deliberately."
  );
  process.exit(1);
}

console.log(`check-instructions PASS (${REQUIRED.length} instructions present, normaliser proven against a wrapped line)`);

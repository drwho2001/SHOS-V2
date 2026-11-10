#!/usr/bin/env node
// check-negative-status.mjs — fail CI if the docs contain words that read as "this is not done".
// The point is not that the docs lie; it is that negative status phrases bias later sessions
// into "fixing" things that are already shipped, which wastes time and creates churn.
//
// Usage: node scripts/check-negative-status.mjs
// Exits non-zero and prints each offending line if any banned phrase is found.

import { readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { existsSync } from 'node:fs';

const ROOT = process.env.SHOS_WORKSPACE || 'C:/Users/kanem/SHOS-V2';
// Scope selection is deliberate: check only files that a model is likely to read
// as current instructions or current state. docs/HISTORY.md is a dated artifact
// and is deliberately excluded — its task list is NOT current state, and blocking
// CI on it would be exactly the "don't touch the change" failure mode this tool
// is meant to prevent. Same for planning docs the owner committed as decisions.
const TARGETS = [
  'CLAUDE.md',
  'BACKLOG.md',
  'docs/RELEASE-DECISIONS.md',
  'docs/audits.md',
  'plans.md',
  'BUILD-PLAN.md',
];

// Banned phrases that sound like "this is still broken" without saying whether it is fixed.
// Word-boundary, case-insensitive. These are status claims — not emotion.
const BANNED = [
  /\bnot\s+attempted\b/i,
  /\bnot\s+attempted\s+yet\b/i,
  /\bstill\s+(open|broken|pending|incomplete)\b/i,
  /\bnot\s+implemented\b/i,
  /\bnot\s+built\b/i,
  /\bno\s+test\b/i,
  /\bblocked\b/i,               // usually ends with "blocked until" — that's a status claim
];

// Allow-listed phrases that legitimately contain negative-looking tokens as part
// of an explicit rule definition or a noted exception. They come from the repo's
// own standing rule (CLAUDE.md line ~45), which is itself an argument for the ban,
// not evidence against it.
const ALLOWLIST = [
  'never write a negative status claim',
  '"not implemented"',
  '"not wired"',
  '"still open"',
  '"not attempted"',
  '"no test covers this"',
  'no "not implemented"',
  '"not attempted"',
  'NO NOT IMPLEMENTED',
  'NO NOT ATTEMPTED',
  'no test of any kind',
  'skips the `finally`',
  'deliberately NOT attempted',
  'Real bug found',
  // Existing BACKLOG artifact: descriptive prose about result-chase iteration,
  // not a status claim a session should trust as instruction. Keeps the repo doc
  // intact when adding the annotation.
  'result still pending after repeated chases',
  // docs/RELEASE-DECISIONS.md — legitimate use of "blocked" as a feature
  // description, not a status claim. The doc is a decision record.
  'Custom error-report endpoints (user-configured in Settings) will be blocked',
];

function isAllowed(match, fullLine) {
  const lower = fullLine.toLowerCase();
  return ALLOWLIST.some((a) => lower.includes(a.toLowerCase()));
}

let found = 0;
const results = [];
for (const rel of TARGETS) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) {
    console.error('skipping missing file', JSON.stringify(abs));
    continue;
  }
  const text = readFileSync(abs, 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const re of BANNED) {
      const m = re.exec(line);
      if (!m) continue;
      if (isAllowed(m[0], line)) continue;
      found += 1;
      results.push(`${rel}:${i + 1}  ${line.trim()}`);
    }
  }
}

if (found) {
  console.error('Negative-status phrases found — these read as "don\'t rebuild" to later sessions:\n');
  for (const r of results) console.error(r);
  console.error(`\n${found} line(s). Review and remove, or add to ALLOWLIST in scripts/check-negative-status.mjs.`);
  process.exit(1);
}
console.log('Negative-status check passed.');
process.exit(0);

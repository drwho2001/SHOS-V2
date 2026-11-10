#!/usr/bin/env node
// nightly-claims-report.mjs — produce a trimmed-sample health report from validate-claims.js
// for the nightly job. Wraps the validator, runs it against a sampled subset of
// the claims and pool files, and emits a compact Markdown summary to stdout.
//
// Usage: node scripts/nightly-claims-report.mjs [--bus-home=<path>] [--sample-size=N]
//   Default sample size: 1000 claims (trimmed from the full set).

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');
const args = process.argv.slice(2);
const busHome = (args.find((a) => a.startsWith('--bus-home=')) || `--bus-home=${process.env.SHOS_BUS_HOME || join(homedir(), '.shos-session-bus')}`).split('=')[1];
const sampleSize = Number((args.find((a) => a.startsWith('--sample-size=')) || '--sample-size=1000').split('=')[1]) || 1000;

// Run the validator on the full state first (it is fast enough).
const result = spawnSync(process.execPath, [join(repoRoot, 'scripts', 'validate-claims.js'), `--bus-home=${busHome}`], {
  encoding: 'utf8',
  cwd: repoRoot,
});
const raw = (result.stdout || '') + (result.stderr || '');
let parsed;
try {
  parsed = JSON.parse(raw);
} catch {
  console.error('could not parse validator output');
  process.exit(2);
}

const violations = parsed.violations || [];
const notes = parsed.notes || [];
const totalClaims = violations.length + notes.filter((n) => n.startsWith('claims:')).reduce((acc, n) => {
  const m = n.match(/checked (\d+)/);
  return m ? Number(m[1]) : acc;
}, 0);

// Group violations by kind.
const byKind = {};
for (const v of violations) {
  byKind[v.kind] = (byKind[v.kind] || 0) + 1;
}

// Sample the violations if there are too many.
const sample = violations.slice(0, sampleSize);

const lines = [];
lines.push('# Claims health report');
lines.push('');
lines.push(`- Bus home: ${busHome}`);
lines.push(`- Total violations: ${violations.length}`);
lines.push(`- Notes: ${notes.length}`);
lines.push('');
lines.push('## Violations by kind');
lines.push('');
for (const [kind, count] of Object.entries(byKind).sort()) {
  lines.push(`- ${kind}: ${count}`);
}
if (!Object.keys(byKind).length) lines.push('(none)');
lines.push('');
lines.push('## Sampled violations (first ' + Math.min(sample.length, sampleSize) + ')');
lines.push('');
for (const v of sample) {
  lines.push(`- [${v.kind}] ${v.file || v.path || '?'} — ${v.detail}`);
}
if (!sample.length) lines.push('(none)');
lines.push('');
lines.push('## Notes');
lines.push('');
for (const n of notes) lines.push(`- ${n}`);
lines.push('');
console.log(lines.join('\n'));
process.exit(parsed.ok ? 0 : 1);

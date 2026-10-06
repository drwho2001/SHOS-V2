// Mutation harness for src/calculations/seedDivergence.test.js
//
// Exists because of the failure this whole incident represents: 82 mutations
// across two suites were green while the rule was wrong in its DEFAULT branch.
// Every one of them touched the flagged case. So these mutations are aimed at
// the flagless/diverging path specifically, and each one is reported with its
// own name so a failure says WHICH invariant broke rather than just "red".
//
// Every mutation backs up the file first and restores it in a finally block. A
// harness that can leave source broken is worse than no harness, and this repo
// has already recorded a crash mid-restore leaving a source file deliberately
// damaged.

import { readFileSync, writeFileSync, copyFileSync, existsSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = join(REPO, "src", "calculations", "seedDivergence.js");
// BOTH suites, deliberately. seedDivergence.test.js alone was not enough, and
// the harness proved it: mutations that disabled the date projection and the
// kink-shape canonicalisation - the two real bugs fixed on 6 Oct - stayed GREEN
// against it, because every fixture it uses is drawn from the module's own
// snapshot and it therefore only ever proved the snapshot is self-consistent.
//
// snapshotFidelity.test.js is the half that goes to the repositories, so it is
// the half that can see a change invisible to the snapshot. Running one without
// the other reports a clean result for a guard that is not guarding.
const TESTS = [
  "src/calculations/seedDivergence.test.js",
  "src/calculations/snapshotFidelity.test.js",
];
const BACKUP = join(REPO, ".seedDivergence.mutation-backup.js");
const EOL = readFileSync(TARGET, "utf8").includes("\r\n") ? "\r\n" : "\n";

/** Count passing tests from vitest output, ANSI-stripped. The escape codes sit
 *  between "Tests" and the count, so an unstripped parse reads 0/0 and a broken
 *  harness reports success having verified nothing - recorded twice in this
 *  repo already. */
function runTests() {
  try {
    const out = execFileSync(
      process.execPath,
      [join(REPO, "node_modules", "vitest", "vitest.mjs"), "run", ...TESTS],
      { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 180000 },
    );
    const clean = out.replace(/\x1b\[[0-9;]*m/g, "");
    const m = clean.match(/Tests\s+(\d+)\s+passed/);
    if (!m) throw new Error(`could not parse vitest output:\n${clean.slice(-800)}`);
    return { passed: Number(m[1]), failed: 0 };
  } catch (e) {
    const clean = `${e.stdout || ""}${e.stderr || ""}`.replace(/\x1b\[[0-9;]*m/g, "");
    const m = clean.match(/Tests\s+(?:(\d+)\s+failed\s+)?(?:\|\s*)?(\d+)\s+passed/);
    const failedMatch = clean.match(/(\d+)\s+failed/);
    const passedMatch = clean.match(/(\d+)\s+passed/);
    if (!passedMatch && !failedMatch) {
      throw new Error(`unparseable vitest failure:\n${clean.slice(-1200)}`);
    }
    return {
      passed: passedMatch ? Number(passedMatch[1]) : 0,
      failed: failedMatch ? Number(failedMatch[1]) : 1,
    };
  }
}

const MUTATIONS = [
  {
    name: "flag check deleted (flagless AND flagged treated identically)",
    find: '  if (record.isSeed === false) return false;\n  const definition = legacyDefinitionFor(record);',
    replace: '  const definition = legacyDefinitionFor(record);',
  },
  {
    name: "flag check INVERTED (isSeed:false treated as demo)",
    find: '  if (record.isSeed === false) return false;\n  const definition = legacyDefinitionFor(record);',
    replace: '  if (record.isSeed === false) return true;\n  const definition = legacyDefinitionFor(record);',
  },
  {
    name: "divergence comparison removed (any snapshot row reads as demo)",
    find: '  return (\n    JSON.stringify(demoComparable(record, todayAsStoredDate())) ===\n    JSON.stringify(demoComparable(definition, SNAPSHOT_TAKEN_AT))\n  );',
    replace: '  return definition ? true : false;',
  },
  {
    name: "unknown id treated as demo (missing definition defaults to demo)",
    find: '  if (!definition) return false;',
    replace: '  if (!definition) return true;',
  },
  {
    name: "stampDivergedRecords stops stamping",
    find: '      out.push({ ...record, isSeed: false });\n      stamped.push(record.id);',
    replace: '      out.push(record);\n      stamped.push(record.id);',
  },
  {
    name: "stampDivergedRecords stamps EVERYTHING (demo becomes undeletable)",
    find: '    if (definition && !isDemoData(record)) {',
    replace: '    if (definition) {',
  },
  {
    name: "stamping mutates the input array in place",
    find: '    if (record.isSeed === false) {\n      out.push(record);\n      continue;\n    }\n    const definition = legacyDefinitionFor(record);',
    replace: '    if (record.isSeed === false) {\n      out.push(record);\n      continue;\n    }\n    record.isSeed = false;\n    const definition = legacyDefinitionFor(record);',
  },
  {
    name: "snapshot drift guard broken (size check no longer matches the snapshot)",
    find: 'export const LEGACY_SEED_SNAPSHOT_SIZE = 88;',
    replace: 'export const LEGACY_SEED_SNAPSHOT_SIZE = 87;',
  },
  {
    // Replaces the comparison with "compare raw", which is what the module did
    // before the projection existed. The obvious version of this mutation -
    // forcing the day offset to 0 - is WRONG and was caught running it: it makes
    // the comparison MORE permissive (every date collapses to the same token, so
    // everything matches and everything reads as demo). A mutation has to break
    // the invariant in the direction that causes harm.
    name: "date projection disabled (relative seed dates stop matching)",
    find: '    const projected = projectDate(value, anchor);\n    if (projected !== value) return projected;',
    replace: '    const projected = value;\n    if (projected !== value) return projected;',
  },
  {
    name: "kink shape canonicalisation removed (schema change reads as an edit)",
    find: '    if (KINK_SELECTION_FIELDS.has(field)) return value.map(canonicalKinkSelection);',
    replace: '    if (false) return value.map(canonicalKinkSelection);',
  },
];

function applyMuation(original, mut) {
  const candidates = [mut.find, mut.find.replace(/\n/g, EOL), mut.find.replace(/\r?\n/g, EOL)];
  for (const c of candidates) {
    if (original.includes(c)) return original.replace(c, mut.replace);
  }
  return null;
}

if (!existsSync(TARGET)) { console.error("target missing"); process.exit(1); }

const original = readFileSync(TARGET, "utf8");

console.log(`\n=== BASELINE (unmutated) ===`);
const baseline = runTests();
console.log(`baseline: ${baseline.passed} passed, ${baseline.failed} failed`);
if (baseline.failed > 0) {
  console.error("BASELINE IS RED - fix that before trusting any mutation result below.");
  process.exit(1);
}

console.log(`\n=== ${MUTATIONS.length} MUTATIONS ===`);
let red = 0, notApplied = 0, stillGreen = [];

for (const mut of MUTATIONS) {
  const mutated = applyMuation(original, mut);
  if (mutated === null || mutated === original) {
    console.log(`  NOT APPLIED  ${mut.name}`);
    console.log(`               (pattern did not match - this mutation tests nothing)`);
    notApplied++;
    continue;
  }
  copyFileSync(TARGET, BACKUP);
  try {
    writeFileSync(TARGET, mutated, "utf8");
    const result = runTests();
    if (result.failed > 0) {
      red++;
      console.log(`  RED  (${result.failed} failed)  ${mut.name}`);
    } else {
      stillGreen.push(mut.name);
      console.log(`  STILL GREEN  ${mut.name}   <-- the guard is missing`);
    }
  } finally {
    if (existsSync(BACKUP)) { copyFileSync(BACKUP, TARGET); unlinkSync(BACKUP); }
  }
}

// The control. If the file is not byte-identical afterwards, the harness itself
// damaged the repo, and every result above is suspect.
const after = readFileSync(TARGET, "utf8");
const restored = after === original;
console.log(`\n=== RESULT ===`);
console.log(`  source restored byte-for-byte: ${restored ? "YES" : "NO  <-- HARNESS BROKE IT"}`);
console.log(`  red (good):     ${red}/${MUTATIONS.length - notApplied}`);
console.log(`  not applied:    ${notApplied}`);
console.log(`  still green:    ${stillGreen.length}`);
for (const g of stillGreen) console.log(`      - ${g}`);
if (!restored) process.exitCode = 1;
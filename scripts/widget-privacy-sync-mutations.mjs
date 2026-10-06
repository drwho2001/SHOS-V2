// Mutation harness for the widget privacy-tier re-push guard.
//
// Two mutations, and both were green before this file existed - which is the
// point. The original assertion matched the string anywhere in WidgetsScreen.jsx
// and the test passed with the call deleted, exactly the "measures nothing, looks
// green" shape this repo keeps recording. A guard that cannot fail is worse than
// no guard, because it converts an unknown into a false assurance.
//
// Reports NOT APPLIED separately from green. A mutation that does not apply is a
// different failure from a test that does not go red, and only the second says
// anything about the guard.

import { readFileSync, writeFileSync, copyFileSync, existsSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = join(REPO, "src", "modules", "settings", "WidgetsScreen.jsx");
const TEST = "src/components/widgetTapAndFallbackGuard.test.js";
const BACKUP = join(REPO, ".widgetscreen.mutation-backup.jsx");

function runTests() {
  try {
    const out = execFileSync(
      process.execPath,
      [join(REPO, "node_modules", "vitest", "vitest.mjs"), "run", TEST],
      { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 180000 },
    );
    const clean = out.replace(/\x1b\[[0-9;]*m/g, "");
    const m = clean.match(/Tests\s+(\d+)\s+passed/);
    if (!m) throw new Error(`could not parse vitest output:\n${clean.slice(-800)}`);
    return { passed: Number(m[1]), failed: 0 };
  } catch (e) {
    const clean = `${e.stdout || ""}${e.stderr || ""}`.replace(/\x1b\[[0-9;]*m/g, "");
    const failed = clean.match(/(\d+)\s+failed/);
    const passed = clean.match(/(\d+)\s+passed/);
    if (!passed && !failed) throw new Error(`unparseable failure:\n${clean.slice(-1000)}`);
    return { passed: passed ? Number(passed[1]) : 0, failed: failed ? Number(failed[1]) : 1 };
  }
}

const MUTATIONS = [
  {
    name: "the re-push call is deleted entirely",
    find: "      await syncAllWidgets();\n",
    replace: "",
  },
  {
    name: "the re-push is fire-and-forget (not awaited)",
    find: "      await syncAllWidgets();\n",
    replace: "      syncAllWidgets();\n",
  },
  {
    name: "reverted to the default import that is undefined at runtime",
    find: 'import { syncAllWidgets } from "../../calculations/syncAllWidgets";',
    replace: 'import syncAllWidgets from "../../calculations/syncAllWidgets";',
  },
];

// Line endings are read off the file rather than assumed. The first version of
// this harness hardcoded "\n" and two of three mutations reported NOT APPLIED
// against this CRLF file - which reads as "the harness is being careful" and is
// in fact the harness measuring nothing. NOT APPLIED is a distinct outcome from
// green and is reported separately for exactly this reason.
const original = readFileSync(TARGET, "utf8");
const NL = original.includes("\r\n") ? "\r\n" : "\n";
for (const mut of MUTATIONS) {
  mut.find = mut.find.split("\n").join(NL);
  mut.replacement = mut.replace.split("\n").join(NL);
}

console.log("\n=== BASELINE (unmutated) ===");
const baseline = runTests();
console.log(`baseline: ${baseline.passed} passed, ${baseline.failed} failed`);
if (baseline.failed > 0) {
  console.error("BASELINE IS RED - fix that before trusting any mutation result.");
  process.exit(1);
}

console.log(`\n=== ${MUTATIONS.length} MUTATIONS ===`);
let red = 0, notApplied = 0;
const stillGreen = [];

for (const mut of MUTATIONS) {
  if (!original.includes(mut.find)) {
    console.log(`  NOT APPLIED  ${mut.name}`);
    console.log(`               (pattern did not match - this mutation tests nothing)`);
    notApplied++;
    continue;
  }
  copyFileSync(TARGET, BACKUP);
  try {
    writeFileSync(TARGET, original.split(mut.find).join(mut.replacement), "utf8");
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

const restored = readFileSync(TARGET, "utf8") === original;
console.log(`\n=== RESULT ===`);
console.log(`  source restored byte-for-byte: ${restored ? "YES" : "NO  <-- HARNESS BROKE IT"}`);
console.log(`  red (good):     ${red}/${MUTATIONS.length - notApplied}`);
console.log(`  not applied:    ${notApplied}`);
console.log(`  still green:    ${stillGreen.length}`);
for (const g of stillGreen) console.log(`      - ${g}`);
if (!restored) process.exitCode = 1;
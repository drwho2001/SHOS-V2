// Mutation harness for src/calculations/latestLogOfType.test.js
//
// Focused on the two mutations that represent real mistakes rather than typos:
// dropping the voided filter (the safety-relevant rule) and flipping `>` to `>=`
// (which changes tie behaviour away from what a stable sort did, silently).

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const TESTS = resolve(process.cwd(), "src/calculations/latestLogOfType.test.js");
const SRC = resolve(process.cwd(), "src/calculations/medicationCalculations.js");
const backup = readFileSync(SRC);
const eol = readFileSync(SRC, "utf8").includes("\r\n") ? "\r\n" : "\n";

const MUTATIONS = [
  { name: "voided logs are no longer excluded (the safety rule)", from: 'if (!log || log.type !== type || log.voided) continue;', to: 'if (!log || log.type !== type) continue;' },
  { name: "ties resolve to the LAST instead of the first (stable-sort drift)", from: 'if (!newest || new Date(log.date) > new Date(newest.date)) newest = log;', to: 'if (!newest || new Date(log.date) >= new Date(newest.date)) newest = log;' },
  { name: "log type is no longer checked", from: 'if (!log || log.type !== type || log.voided) continue;', to: 'if (!log || log.voided) continue;' },
  { name: "returns the oldest matching log instead of the newest", from: 'if (!newest || new Date(log.date) > new Date(newest.date)) newest = log;', to: 'if (!newest || new Date(log.date) < new Date(newest.date)) newest = log;' },
  { name: "missing logs array no longer guarded", from: 'if (!med || !Array.isArray(med.logs)) return undefined;', to: '' },
];

const run = () => {
  try {
    execFileSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", TESTS], { stdio: "pipe", timeout: 300000 });
    return true;
  } catch {
    return false;
  }
};

console.log("baseline (must be green):", run() ? "green" : "RED - aborting");
if (!run()) process.exit(1);

let red = 0, notApplied = 0;
try {
  for (const m of MUTATIONS) {
    const original = readFileSync(SRC, "utf8");
    const from = m.from.split("\n").join(eol);
    const to = m.to.split("\n").join(eol);
    if (!original.includes(from)) { console.log(`  NOT APPLIED  ${m.name}`); notApplied++; continue; }
    writeFileSync(SRC, original.replace(from, to));
    const green = run();
    writeFileSync(SRC, backup);
    console.log(green ? `  NO EFFECT    ${m.name}   <- test does not catch this` : `  red          ${m.name}`);
    if (!green) red++;
  }
} finally {
  writeFileSync(SRC, backup);
  console.log(`\n${red} red, ${notApplied} not applied. restored: ${readFileSync(SRC).equals(backup)}`);
}
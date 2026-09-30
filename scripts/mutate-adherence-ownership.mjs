// Mutation harness for src/calculations/adherenceOwnership.test.js
//
// The discipline this repo has established: a test that has never been seen red
// has not been tested. Each mutation reintroduces one specific defect from the
// real bug. "NOT APPLIED" is reported distinctly from "did not go red" - a
// mutation that fails to match its target measures nothing about the test.
//
// Invoked as `node`, not via the vitest binary, because calling vitest from
// inside a vitest worker deadlocks (seen this session, 60s timeout).

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const TESTS = resolve(process.cwd(), "src/calculations/adherenceOwnership.test.js");
const DASH = resolve(process.cwd(), "src/modules/SHOS_Medication_Dashboard_Prototype.jsx");
const MEDS = resolve(process.cwd(), "src/calculations/medicationCalculations.js");

// CRLF-safe: read the line ending off the file rather than assuming \n, which is
// how four mutations in this project silently failed to apply.
const eol = (p) => (readFileSync(p, "utf8").includes("\r\n") ? "\r\n" : "\n");
const backup = new Map();
for (const p of [TESTS, DASH, MEDS]) backup.set(p, readFileSync(p, "utf8"));

const restore = () => {
  for (const [p, buf] of backup) writeFileSync(p, buf);
};

const MUTATIONS = [
  {
    name: "component recomputes the percentage again (the original bug)",
    file: DASH,
    from: "  if (!hasData) {",
    to: "  const pct = expected > 0 ? Math.round((hit / expected) * 100) : 100;" + "\n  if (!hasData) {",
  },
  {
    name: "one call site stops being handed pct",
    file: DASH,
    from: "pct={adherence.sevenDay.pct}",
    to: "pct={undefined}",
  },
  {
    name: "hasData always true - empty state never renders",
    file: MEDS,
    from: "hasData: hasHistory || expected > 0,",
    to: "hasData: true,",
  },
  {
    name: "pct becomes null for an empty window (silent aggregate regression)",
    file: MEDS,
    from: "pct: expected > 0 ? Math.round((hit / expected) * 100) : (hasHistory ? 100 : 0),",
    to: "pct: expected > 0 ? Math.round((hit / expected) * 100) : (hasHistory ? 100 : null),",
  },
  {
    name: "empty-state copy removed, numbers shown unconditionally",
    file: DASH,
    from: "No doses logged yet",
    to: "100%",
  },
];

const run = () => {
  try {
    execFileSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", TESTS], {
      stdio: "pipe",
      cwd: process.cwd(),
      timeout: 300000,
    });
    return true;
  } catch {
    return false;
  }
};

console.log("baseline (must be green, else every result below is meaningless):");
if (!run()) {
  console.log("  BASELINE IS RED - aborting");
  restore();
  process.exit(1);
}
console.log("  green\n");

let notApplied = 0;
let red = 0;
try {
  for (const m of MUTATIONS) {
    const original = readFileSync(m.file, "utf8");
    const nl = eol(m.file);
    const needle = m.from.split("\n").join(nl);
    const replacement = m.to.split("\n").join(nl);
    if (!original.includes(needle)) {
      console.log(`  NOT APPLIED  ${m.name}`);
      console.log(`               target not found: ${JSON.stringify(m.from.slice(0, 60))}`);
      notApplied++;
      continue;
    }
    writeFileSync(m.file, original.replace(needle, replacement));
    const green = run();
    restore();
    if (green) {
      console.log(`  NO EFFECT    ${m.name}   <- the test does not catch this`);
    } else {
      console.log(`  red          ${m.name}`);
      red++;
    }
  }
} finally {
  restore();
  console.log(`\n${red} mutation(s) turned the suite red, ${notApplied} failed to apply.`);
  // `readFileSync(p, "utf8")` returns a STRING, so a Buffer method like
  // .equals() does not exist here. My first version of this line used it and
  // crashed on every run - after `restore()` had already done its job, so the
  // files were fine while the check meant to prove they were fine threw. That
  // is the exact shape of "trusting the harness's own completion message"
  // this project has been bitten by, so the check is fixed rather than
  // deleted: a restoration check that cannot run is not a check.
  const allRestored = [...backup.keys()].every((p) => {
    const now = readFileSync(p, "utf8");
    const then = backup.get(p).toString("utf8");
    return now === then;
  });
  console.log(`files restored: ${allRestored}`);
}
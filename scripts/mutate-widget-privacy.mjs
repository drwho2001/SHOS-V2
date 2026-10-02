// Mutation check for the widget privacy guard.
//
// Backs up every file it touches and restores in a `finally` — a mutation
// harness that can leave the working tree broken is worse than none, and this
// repo has recorded a harness crashing mid-restore and leaving a source file
// deliberately broken.
//
// "The mutation did not apply" is reported as a DIFFERENT outcome from "the
// suite stayed green". Only the second says anything about whether the test can
// fail, and conflating them is how a vacuous guard gets believed.
//
// Usage: node scripts/mutate-widget-privacy.mjs [name]
//        no argument runs every mutation in sequence.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const SCREEN = "src/modules/settings/WidgetsScreen.jsx";
const OWNER = "src/calculations/widgetPrivacy.js";

const TARGETS = {
  // Re-introduces the duplicated default, which is the defect this change was
  // built to remove: two owners of one fact that merely agree today.
  "redeclare-default": {
    file: SCREEN,
    from: '      key: "clinicCard",',
    to: '      key: "clinicCard",\n      defaultTier: "full",',
  },

  // Re-introduces the screen's own copy of tierFor's logic. The subtle part is
  // that an unreadable stored value passes straight through, so no button is
  // selected and the fail-closed behaviour is invisible in the UI showing it.
  "direct-index": {
    file: SCREEN,
    from: "tierFor(w.key, widgetPrefs.widgetPrivacy)",
    to: 'widgetPrefs.widgetPrivacy?.[w.key] ?? "full"',
  },

  // Puts a Full/Redacted/Off picker back on the three QuickAdd widgets, which
  // render a launch icon and no data.
  "picker-for-all": {
    file: SCREEN,
    from: "isDataWidget(w.key) ? (",
    to: "true ? (",
  },

  // Removes the row for the widget that discloses the most.
  //
  // Multi-line, so the line ending has to match: these files are CRLF, and a
  // pattern written with \n silently applies to nothing. The harness reports
  // that as NOT APPLIED rather than as a pass, which is the only reason this
  // mutation was noticed - written with \n it reported a clean run and proved
  // nothing at all.
  "drop-cliniccard-row": {
    file: SCREEN,
    multiline: true,
    from: [
      '      key: "clinicCard",',
      '      label: "Clinic Card",',
      '      description: "Shows the next appointment, its location and test count",',
      "",
    ],
    to: "",
  },

  // THE ONE THAT MATTERS MOST: an unreadable stored value stops failing closed
  // and starts disclosing. This is the direction a privacy control must never
  // be wrong in.
  "fail-open": {
    file: OWNER,
    from: 'return isValidTier(raw) ? raw : "off";',
    to: "return isValidTier(raw) ? raw : DEFAULT_TIERS[widgetKey];",
  },

  // Turns the whole predicate into a no-op, so the guard's non-vacuity
  // assertion is the only thing standing between it and silence.
  "always-allow": {
    file: OWNER,
    from: 'export function fieldAllowed(widgetKey, fieldName, tier) {\n  if (tier === "off") return false;',
    to: "export function fieldAllowed(widgetKey, fieldName, tier) {\n  if (tier === 'off') return false;\n  return true;",
  },

  // Makes a first run destructive: nobody has ever set a tier on upgrade, so
  // defaulting to `off` would blank every widget on a phone.
  "default-to-off": {
    file: OWNER,
    from: 'if (!stored || typeof stored !== "object") return DEFAULT_TIERS[widgetKey];',
    to: 'if (!stored || typeof stored !== "object") return "off";',
  },

  // Lets one identifying field onto a redacted list.
  "leak-medname": {
    file: OWNER,
    from: '  nextDose: ["category", "state"],',
    to: '  nextDose: ["category", "state", "medName"],',
  },
};

const TEST = "src/calculations/widgetPrivacy.test.js";

function runOne(name) {
  const target = TARGETS[name];
  const original = readFileSync(target.file, "utf8");

  // Read the line ending off the file rather than assuming one. These sources
  // are CRLF; a \n pattern applied to a CRLF file matches nothing at all.
  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  const join = (arr) => arr.join(eol);
  const from = target.multiline ? join(target.from) : target.from;
  const to = target.multiline ? join(target.to.split(/(?<=\n)/).map((s) => s.replace(/\n$/, ""))) : target.to;

  if (!original.includes(from)) {
    console.log(`  ${name.padEnd(20)} NOT APPLIED  (pattern absent - tests nothing, and this is NOT a pass)`);
    return "not-applied";
  }
  writeFileSync(target.file, original.replace(from, to), "utf8");
  try {
    execSync(`npx vitest run ${TEST}`, { stdio: "pipe", shell: true });
    console.log(`  ${name.padEnd(20)} STILL GREEN  <-- the guard is vacuous`);
    return "vacuous";
  } catch {
    console.log(`  ${name.padEnd(20)} went red     guard is real`);
    return "red";
  } finally {
    writeFileSync(target.file, original, "utf8");
  }
}

const names = process.argv[2] ? [process.argv[2]] : Object.keys(TARGETS);
if (process.argv[2] && !TARGETS[process.argv[2]]) {
  console.log(`unknown mutation: ${process.argv[2]}`);
  process.exit(2);
}

console.log("=== widget privacy mutation check ===");
const results = names.map(runOne);
const bad = results.filter((r) => r !== "red");
console.log("");
console.log(bad.length === 0
  ? `ALL ${results.length} MUTATIONS WENT RED - every guard can fail`
  : `PROBLEM: ${bad.length} of ${results.length} did not prove the guard (${bad.join(", ")})`);
process.exit(bad.length === 0 ? 0 : 5);

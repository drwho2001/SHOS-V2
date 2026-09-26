// One-off: repair mojibake that a PowerShell read/write round-trip
// reintroduced into a source file. Uses the app's own encodingRepair module
// (src/calculations/encodingRepair.js) rather than a bespoke replace chain,
// which is the point: the repair map is already verified and unit-tested, and
// a second, looser regex pass is exactly how the wrong character gets picked.
const fs = require("fs");
const path = require("path");

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node scripts/repair-file-encoding.cjs <file> [file...]");
  process.exit(2);
}

(async () => {
  const { pathToFileURL } = require("url");
  const mod = await import(
    pathToFileURL(path.join(process.cwd(), "src", "calculations", "encodingRepair.js")).href
  );
  const { repairString } = mod;
  if (typeof repairString !== "function") {
    console.error("encodingRepair.js does not export repairString - refusing to guess.");
    process.exit(3);
  }

  for (const f of files) {
    const before = fs.readFileSync(f, "utf8");
    const { text: after, changed, fixes, unknown } = repairString(before);
    if (!changed) {
      console.log(`  ${f}: already clean`);
      continue;
    }
    fs.writeFileSync(f, after, "utf8");
    const total = fixes.reduce((n, x) => n + x.count, 0);
    console.log(`  ${f}: repaired ${total} sequence(s) across ${fixes.length} distinct kind(s)`);
    for (const x of fixes) {
      console.log(`      ${x.count} x ${JSON.stringify(x.from)} -> ${JSON.stringify(x.to)}  (${x.label})`);
    }
    for (const u of unknown.slice(0, 5)) {
      console.log(`      !! UNRECOGNISED, left for review: ${JSON.stringify(u)}`);
    }
  }
})();

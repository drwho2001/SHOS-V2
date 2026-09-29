// Structural guard, t020: no component may do date arithmetic against a STORED
// value, and no calculation module may compare a real instant to a stored
// wall-clock.
//
// WHY THIS EXISTS, AND WHY IT IS A SEPARATE TEST FILE. The unit tests prove the
// CALCULATIONS are right. They cannot prove a component CALLS them, and this
// project has shipped a feature whose hook worked perfectly in unit tests while
// a sweep silently failed to attach it to the component that mattered. The
// `(OVERDUE)` defect earlier the same day was exactly this: the calculation was
// fixed, and the text rendering it still said OVERDUE in red.
//
// WHAT IT EXCLUDES, AND WHY THAT IS THE POINT. Genuine INSTANTS are correct in
// the device's own zone and must not be swept. `backupService` computes
// "days since last backup" from a timestamp written with `new Date().toISOString()`
// - a real instant against a real clock - and that site is CORRECT. A blanket
// rule would have broken it, and a blanket `timeZone: "UTC"` sweep has now been
// demonstrated wrong several times in this repo. A guard that cannot be told
// apart from a sweep is a guard that gets deleted, so the exclusion is asserted
// as a test rather than left to judgement at each site.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");

// Comments are stripped before every negative assertion, and the stripper is
// proven non-vacuous below. This project's comments quote the exact expressions
// being banned - the recorded reason several earlier guards matched the comment
// documenting the fix, four-plus times in this repo.
//
// The stripper PRESERVES LINE NUMBERS, which is not a detail. A first version
// replaced comments with nothing, so the offsets shifted and the guard reported
// `backupService.js:331` for a line that is actually 692 in the file. An error
// message that sends someone to the wrong line is worse than no message at all,
// so the content is blanked while every newline is kept.
const blankBlockComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
const stripComments = (src) => blankBlockComments(src).replace(/^\s*\/\/.*$/gm, (m) => m.replace(/[^\n]/g, " "));

const jsFilesIn = (dir) =>
  readdirSync(path.join(ROOT, dir))
    .filter((f) => /\.(js|jsx)$/.test(f) && !/\.test\.|\.spec\./.test(f))
    .map((f) => `${dir}/${f}`);

const SCREENS = jsFilesIn("src/modules");
const CALCS = jsFilesIn("src/calculations");
const STORAGE = jsFilesIn("src/storage");

// The shape being banned: elapsed milliseconds computed between a real "now"
// and a parsed stored value.
//
// BOTH forms are matched, and that is not belt-and-braces - it is two different
// real regressions, each caught by only one of them:
//
//   Date.now() - d.getTime()               where `d` is a parsed stored Date
//   Date.now() - new Date(dateStr).getTime()  a bare parameter
//
// A first version matched only the `new Date(...)` form and let a real
// regression in `daysFromNow(dateStr)` through. A second version widened to that
// form and in doing so LOST the `d.getTime()` case, which is what the first
// pattern was actually for. A pattern that only catches the sites you already
// found is a list, not a guard.
const ELAPSED_VS_STORED = /(\bDate\.now\(\)|new Date\(\))\s*-\s*(new Date\([A-Za-z_$][\w.$]*\)|[A-Za-z_$][\w.$]*)\s*\.?\s*(getTime\(\))?/;

// Values that are genuine instants, where local time is correct.
//
// `lastAt` is the backup timestamp, written with `new Date().toISOString()` - a
// real moment. The name is matched case-insensitively because the first version
// of this regex only had `LAST_BACKUP` (the storage KEY), so it missed the
// variable the code actually uses, and the guard flagged a correct site. The
// storage scan is what surfaced that, which is the argument for scanning the
// places a real correct site actually lives rather than only the ones with bugs.
const REAL_INSTANT = /createdAt|updatedAt|supersededAt|realTimestampFromStored|lastAt|LAST_BACKUP|toISOString\(\)\s*;?\s*$/i;

describe("no component does date arithmetic against a stored value", () => {
  it("screens are free of elapsed-milliseconds maths on stored dates", () => {
    const offenders = [];
    for (const f of SCREENS) {
      const code = stripComments(read(f));
      code.split("\n").forEach((line, i) => {
        if (!ELAPSED_VS_STORED.test(line)) return;
        if (REAL_INSTANT.test(line)) return;
        offenders.push(`${f}:${i + 1}  ${line.trim().slice(0, 100)}`);
      });
    }
    expect(
      offenders,
      "A component is computing days by subtracting a real instant from a STORED " +
        "wall-clock value. Use daysSinceStoredDay / calendarDaysBetween from " +
        "dateInputHelpers - a stored value is not an instant, so the two are a " +
        "different frame and the answer is out by up to a day:\n" + offenders.join("\n"),
    ).toEqual([]);
  });

  it("calculation modules use the canonical day primitives", () => {
    const offenders = [];
    for (const f of CALCS) {
      // medicationCalculations' wholeDaysBetween is the ONE legitimate place:
      // it works between two real instants, which is a true duration.
      if (f.endsWith("medicationCalculations.js")) continue;
      const code = stripComments(read(f));
      code.split("\n").forEach((line, i) => {
        if (!ELAPSED_VS_STORED.test(line)) return;
        if (REAL_INSTANT.test(line)) return;
        offenders.push(`${f}:${i + 1}  ${line.trim().slice(0, 100)}`);
      });
    }
    expect(offenders, `elapsed-ms maths against a stored value:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("storage modules are scanned too, so the instant exclusion is proven in situ", () => {
    // This test was passing VACUOUSLY at first: the guard scanned screens and
    // calculations but NOT src/storage, which is the only place the one correct
    // site lives. Removing the exclusion therefore changed nothing, and the
    // "does it exclude real instants?" question had no evidence behind it at
    // all. Scanning storage here is what turns that assertion into a real one -
    // backupService now has to survive the pattern, using the exclusion, in situ.
    const offenders = [];
    for (const f of STORAGE) {
      const code = stripComments(read(f));
      code.split("\n").forEach((line, i) => {
        if (!ELAPSED_VS_STORED.test(line)) return;
        if (REAL_INSTANT.test(line)) return;
        offenders.push(`${f}:${i + 1}  ${line.trim().slice(0, 100)}`);
      });
    }
    expect(offenders, `elapsed-ms maths against a stored value in storage:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe("the guard's exclusions are deliberate and tested", () => {
  it("a genuine instant is NOT flagged, so this cannot drift into a sweep", () => {
    // backupService's real case: a timestamp written with new Date().toISOString()
    // is a real instant, so instant-minus-instant is CORRECT and a sweep would
    // have broken it.
    const genuine = "const daysSince = Math.floor((Date.now() - new Date(lastAt).getTime()) / 86400000);";
    const flagged = ELAPSED_VS_STORED.test(genuine) && !REAL_INSTANT.test(genuine);
    expect(flagged).toBe(false);
  });
  it("the real backup-timestamp site is still on disk and still correct", () => {
    // Not a hypothetical: if that call site were ever rewritten to use a stored
    // value, the exclusion above would start hiding a real bug, and this fails.
    const src = stripComments(read("src/storage/backupService.js"));
    expect(src).toMatch(/storage\.save\(LAST_BACKUP_KEY, new Date\(\)\.toISOString\(\)\)/);
  });

  it("the comment stripper is not vacuous", () => {
    const src = stripComments(read("src/modules/SHOS_Home_Prototype.jsx"));
    expect(src).toMatch(/daysSinceStoredDay/);
    expect(stripComments("// Date.now() - new Date(x.date)\nconst a = 1;")).not.toMatch(/Date\.now/);
  });

  it("the primitive the guard steers people to actually exists", () => {
    // If the helper were renamed or removed, every message this guard emits would
    // point at a function that is not there.
    const helpers = read("src/calculations/dateInputHelpers.js");
    for (const fn of ["daysSinceStoredDay", "calendarDaysBetween", "storedDayKey", "localDayKey"]) {
      expect(helpers, `dateInputHelpers must export ${fn}`).toMatch(new RegExp(`export function ${fn}\\b`));
    }
  });
});

// Structural guard for t020: a STORED date must never be rendered through a
// bare `new Date(stored).toLocaleDateString(...)`.
//
// WHY A SOURCE GUARD AND NOT MORE BEHAVIOUR TESTS. Three of the four sites fixed
// in this round are JSX inside large screen components, and their correctness
// rests entirely on `formatStoredDate`, which `dateDisplay.test.js` already
// proves does not shift. What no unit test can see is whether a screen is
// CALLING that helper at all - this project has shipped a feature whose hook
// worked perfectly in unit tests while a sweep silently failed to attach it.
//
// WHAT IT EXCLUDES, AND WHY THAT MATTERS MORE THAN WHAT IT CATCHES.
//
// - Genuine INSTANTS are not flagged. `updatedAt`, `supersededAt`,
//   `realTimestampFromStored(...)` and `new Date()` are real instants, where the
//   device's own zone IS correct. A guard that flagged them would push someone
//   towards exactly the blanket `timeZone: "UTC"` sweep that has now been
//   demonstrated wrong twice on statsCalculations.js alone.
// - Genuine instants SHOULD use formatInstantDate, so a second check names them
//   explicitly rather than leaving the correct sites unremarked.
//
// The test below is therefore about the STORED frame only, and says so, because
// a guard that cannot be told apart from a sweep is a guard that gets deleted.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");

// Fields whose values are STORED wall-clock in this app. Derived from the
// project's own convention, not from the calendar: a `date`/`startDate`/
// `nextDue`/`lastTestedDate` style field on a record is fake-UTC, while
// `createdAt`/`updatedAt`/anything already passed through
// realTimestampFromStored is a real instant.
const STORED_FIELD = /\b(e|v|m|c|l|med|trip|test|visit|encounter)\.(date|startDate|nextDue)\b|\blastTestedDate\b/;

// Names that mean a real instant. Present so a reader can see the exclusion is
// deliberate, and so the guard has an explicit escape rather than relying on
// someone's judgement at each site.
const INSTANT_NAMES = /updatedAt|createdAt|supersededAt|realTimestampFromStored|new Date\(\)|Date\.now\(\)/;

const SCREEN_FILES = [
  "src/modules/SHOS_MyProfile_Prototype.jsx",
  "src/modules/SHOS_Contacts_Prototype.jsx",
  "src/modules/SHOS_ClinicVisits_Prototype.jsx",
  "src/modules/SHOS_Encounters_Prototype.jsx",
  "src/modules/SHOS_Testing_Prototype.jsx",
  "src/modules/SHOS_Vaccinations_Prototype.jsx",
  "src/modules/SHOS_Attachments_Prototype.jsx",
  "src/modules/SHOS_Timeline_Prototype.jsx",
];

// ---- src/calculations/ scope, added 30 Sep 2026 (t040) ------------------
// The app's own formatters. A line inside one of these is the DEFINITION of
// correct, so it is exempt rather than reviewed - and exempting them is what
// stopped the scan flagging dateInputHelpers' own code.
const CANONICAL_HELPER =
  /export function (formatStoredDate|formatStoredDateTime|formatInstantDate|formatDayKey|realTimestampFromStored)/;

/**
 * Sites in src/calculations/ that format in local time ON PURPOSE.
 *
 * Each was read individually on 30 Sep, not pattern-matched. This is the
 * reviewed output of that triage, and it is here so the guard does not have to
 * re-derive it - and cannot quietly re-flag the correct ones.
 */
const REVIEWED_CORRECT = [
  {
    match: /new Date\(realTimestampFromStored\(visit\.date\)\)/,
    used: 0,
    reason:
      "clinicVisitReminderSync builds a REAL instant first, via realTimestampFromStored, and " +
      "formats that. Applying UTC here would be wrong - the value is no longer a stored wall-clock.",
  },
  {
    match: /d\.toLocaleDateString\("en-GB", \{ day: "numeric", month: "short", year: "numeric" \}\)/,
    used: 0,
    reason:
      "hivStatusCalculations formats a real instant from realTimestampFromStored(resolved.since). " +
      "Same reason as above: the conversion already happened.",
  },
  {
    match: /new Date\(earliest\.unlockAt\)\.toLocaleTimeString/,
    used: 0,
    reason:
      "medicationReminderSync formats unlockAt, which lockoutEndsAt produces as a genuine epoch " +
      "number. There is no stored frame involved at all.",
  },
  {
    match: /buckets\.push\(\{ label: d\.toLocaleDateString/,
    used: 0,
    reason:
      "statsCalculations builds a month label from a real local clock (new Date(y, m, 1)), and the " +
      "buckets are deliberately on the LOCAL calendar. Records are matched into them with " +
      "getUTCMonth(), because reading a stored fake-UTC value with a UTC getter is how you recover " +
      "the stored wall-clock month. The reason is written down at the site. Triaged as a possible " +
      "label/key mismatch, read, and dismissed - the two are deliberately in the same frame.",
  },
];

// Every non-test file in the folder, discovered rather than hardcoded - the
// hardcoded module list is exactly what let this folder go unwatched.
function calcFiles() {
  const dir = "src/calculations";
  return readdirSync(dir)
    .filter((n) => /\.jsx?$/.test(n) && !/\.test\.jsx?$/.test(n))
    .map((n) => `${dir}/${n}`);
}

// Count each entry's real usage at ASSERT time, not at module load, so a stale
// entry is noticed rather than sitting there forever permitting a pattern that no
// longer exists. A getter rather than a top-level loop because stripComments and
// read are declared further down this file, and evaluating here would hit the
// temporal dead zone - a real error, not a lint warning.
for (const e of REVIEWED_CORRECT) {
  Object.defineProperty(e, "used", {
    get() {
      return calcFiles().reduce((n, f) => {
        const lines = stripComments(read(f)).split("\n");
        return n + lines.filter((l) => e.match.test(l)).length;
      }, 0);
    },
    enumerable: true,
  });
}

// A stored value handed to a local-zone formatter: `new Date(x.date)` or
// `new Date(lastTestedDate)` immediately followed by toLocale*. Comments are
// stripped first, because this project's own comments quote the exact
// expressions being banned - the fourth recorded instance of a guard matching
// the comment that documents the fix.
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("stored dates are rendered through the shared helper", () => {
  it("no screen renders a stored date through a bare local toLocale* call", () => {
    const offenders = [];
    for (const f of SCREEN_FILES) {
      const code = stripComments(read(f));
      // Walk line by line, but keep a small window so a two-line expression is
      // still caught - a per-line check that cannot see the next line is the
      // exact weakness this whole task was scoped against.
      const lines = code.split("\n");
      for (let i = 0; i < lines.length; i += 1) {
        const window = lines.slice(i, i + 3).join(" ");
        if (!/toLocale(DateString|String|TimeString)/.test(window)) continue;
        if (!STORED_FIELD.test(window)) continue;
        if (INSTANT_NAMES.test(window)) continue;
        if (/formatStored|formatInstant/.test(window)) continue;
        offenders.push(`${f}:${i + 1}  ${lines[i].trim().slice(0, 110)}`);
      }
    }
    expect(
      offenders,
      "A stored date is rendered through a local-zone formatter. Use formatStoredDate for a " +
        "stored wall-clock value, or formatInstantDate for a real instant - a bare " +
        "toLocaleDateString on a stored value shows the wrong DAY west of UTC:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("the files this round fixed really do call the helper", () => {
    // The positive half. Without it, the guard above also passes on a file that
    // simply stopped rendering the date - which is a different regression, and a
    // worse one for a health record.
    expect(read("src/modules/SHOS_MyProfile_Prototype.jsx")).toMatch(/formatStoredDate\(lastTestedDate\)/);
    expect(read("src/modules/SHOS_Contacts_Prototype.jsx")).toMatch(/formatStoredDate\(e\.date\)/);
    expect(read("src/modules/SHOS_ClinicVisits_Prototype.jsx")).toMatch(/formatStoredDate\(form\.date\)/);
  });

  // -------------------------------------------------------------------------
  // src/calculations/ — added 30 Sep 2026 (t040)
  //
  // This guard scanned EIGHT HARDCODED MODULE FILES and nothing else, so the
  // month-heading bug fixed the same day — in dateGrouping.js, in this folder —
  // was completely invisible to the check written specifically to catch it. The
  // guard was working; it was pointed somewhere the bug was not.
  //
  // It could not simply be pointed here, because the module scan keys off
  // module-shaped variable names (`e.date`, `v.startDate`) that do not appear in
  // calculation files, so reusing it as-is would under-detect almost everything.
  // And the seven sites that ARE here are correct on purpose, so a blanket rule
  // would push people towards the UTC sweep that is wrong for real instants.
  //
  // So this encodes the triage rather than re-deriving it: every site in this
  // folder must either be one of the app's own canonical formatters, or match a
  // reviewed entry that says WHY it is correct. A new, unreviewed site fails.
  it("no calculation module formats a stored date in local time either", () => {
    const offenders = [];
    for (const f of calcFiles()) {
      const lines = stripComments(read(f)).split("\n");
      for (let i = 0; i < lines.length; i += 1) {
        if (!/toLocale(DateString|String|TimeString)/.test(lines[i])) continue;
        // The frame property may sit on a later line of a multi-line options
        // object, so look FORWARD from the formatter rather than only at it.
        if (/timeZone:\s*"UTC"/.test(lines.slice(i, i + 6).join(" "))) continue;
        // The app's own formatters ARE the definition of correct here.
        if (CANONICAL_HELPER.test(lines.slice(Math.max(0, i - 8), i + 1).join(" "))) continue;
        if (REVIEWED_CORRECT.some((e) => e.match.test(lines[i]))) continue;
        offenders.push(`${f}:${i + 1}  ${lines[i].trim().slice(0, 110)}`);
      }
    }
    expect(
      offenders,
      "A stored date is formatted in local time in src/calculations/. If this site is a genuine " +
        "real instant, add it to REVIEWED_CORRECT with a reason — do not blanket-apply UTC, which " +
        "would be wrong for it:\n" + offenders.join("\n"),
    ).toEqual([]);
  });

  it("every reviewed-correct entry is real, used, and has a reason", () => {
    // The allowlist is only trustworthy if it cannot rot. Each entry must have
    // been consulted, and each must say why — an entry with no reason is a
    // suppression, which is how these files got into trouble.
    for (const e of REVIEWED_CORRECT) {
      expect(e.reason, "a reviewed-correct entry needs a reason").toBeTruthy();
      expect(e.reason.length, `${e.match} reason must be substantive`).toBeGreaterThan(40);
      expect(e.used, `${e.match} no longer matches anything - remove it`).toBeGreaterThan(0);
    }
  });


  it("the comment stripper is not vacuous", () => {
    // A stripper that removed too much would make the guard above pass for the
    // wrong reason. Proven by checking a line of real code survives.
    const code = stripComments(read("src/modules/SHOS_Contacts_Prototype.jsx"));
    expect(code).toMatch(/formatStoredDate\(e\.date\)/);
    // ...and that a banned expression living in a COMMENT is not reported.
    const withComment = `// new Date(e.date).toLocaleDateString()\nconst x = 1;\n`;
    const stripped = stripComments(withComment);
    expect(stripped).not.toMatch(/toLocaleDateString/);
  });

  it("an instant site is NOT flagged, so the guard cannot be mistaken for a sweep", () => {
    // If this ever fails, the exclusion has narrowed and the guard would start
    // pushing people towards the blanket UTC sweep.
    const genuineInstant = `const d = new Date(contact.updatedAt);\nd.toLocaleDateString(undefined, { day: "numeric" });`;
    const flagged = /toLocale(DateString|String)/.test(genuineInstant) && STORED_FIELD.test(genuineInstant) && !INSTANT_NAMES.test(genuineInstant);
    expect(flagged).toBe(false);
  });
});

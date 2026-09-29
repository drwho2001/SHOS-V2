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
import { readFileSync } from "node:fs";
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

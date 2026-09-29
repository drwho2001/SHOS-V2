// disclosureWiring.test.js - source-level guard.
//
// disclosureLevel.test.js proves the resolver's DECISIONS. It cannot prove the
// resolver is REACHED, and that is exactly the gap this repo has already been
// bitten by twice: a full Escape-handling feature whose hook worked perfectly
// in unit tests while a sweep silently failed to attach it to the components
// that mattered, and a palette scanner that reported "no regressions" from a
// detector which had never fired once.
//
// This gap was not hypothetical. t030 shipped as `done` in the work pool with
// ZERO references to the resolver outside its own file - the disclosure-level
// control was visible, movable, and did nothing at all. A pool entry saying
// "done" is a self-report with nothing behind it. So the wiring is asserted
// here, against the source, rather than trusted.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const SRC = path.join(process.cwd(), "src");
const NOTIFICATION_SERVICE = readFileSync(path.join(SRC, "storage", "notificationService.js"), "utf8");

const REMINDER_FILES = [
  "medicationReminderSync",
  "refillReminderSync",
  "testingReminderSync",
  "clinicVisitReminderSync",
  "vaccinationReminderSync",
  "doxyPepSync",
];

const read = (f) => readFileSync(path.join(SRC, "calculations", `${f}.js`), "utf8");

// Comments in this repo quote defective lines verbatim - that is what makes them
// useful, and exactly what makes a raw substring check report a fixed problem as
// still present. Bitten three times in this session alone.
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("the disclosure level is actually reached by notifications", () => {
  it("scheduleNotification applies it, and uses the RESULT", () => {
    // The half that matters: resolving is worthless if the original title and
    // body are then what gets scheduled. Both delivery paths are checked -
    // native and web - because using the resolved value on one and the raw one
    // on the other would mean the feature silently does nothing on a platform.
    const code = codeOnly(NOTIFICATION_SERVICE);
    expect(code).toMatch(/resolveDisclosure/);
    expect(code).toMatch(/title:\s*disclosed\.title/);
    expect(code).toMatch(/body:\s*disclosed\.body/);
    const rawUses = code.match(/notifications:\s*\[\{\s*id,\s*title,\s*body,/);
    expect(rawUses, "native path must not schedule the unresolved title/body").toBeNull();
    // Anchored to exclude the function's own DECLARATION, which legitimately
    // has that parameter list - the first version of this assertion matched the
    // signature and failed for the wrong reason, which is the same trap as a
    // guard matching the wrong thing and being "fixed" by loosening it.
    const rawWeb = code.match(/(?<!function )showWebNotification\(\{\s*id,\s*title,\s*body,/);
    expect(rawWeb, "web path must not show the unresolved title/body").toBeNull();
  });

  it("every reminder type declares a non-clinical kind", () => {
    // A missing `kind` is not an error at runtime - it resolves to an empty
    // body at the glanceable level, which is safe but useless. So the omission
    // has to be caught here or it will never be noticed.
    for (const f of REMINDER_FILES) {
      const code = codeOnly(read(f));
      const sites = code.match(/scheduleNotification\(/g) || [];
      const kinds = code.match(/kind:\s*"[^"]+"/g) || [];
      expect(kinds.length, `${f}.js has ${sites.length} call site(s) but ${kinds.length} kind(s)`).toBe(
        sites.length
      );
    }
  });

  it("no kind string carries clinical detail", () => {
    // The guarantee is structural: `kind` is the only field a caller can pass,
    // and at the masked level it is not used at all. A kind that quoted a
    // medication name would break that, so the kinds themselves are checked.
    for (const f of REMINDER_FILES) {
      for (const m of read(f).matchAll(/kind:\s*"([^"]+)"/g)) {
        expect(m[1]).not.toMatch(/prep|trestosterone|zapain|chlam|gon|hepat|positive|mg\b/i);
        expect(m[1].length).toBeLessThan(40);
      }
    }
  });

  it("the medication-name templates still exist, so masking them is meaningful", () => {
    // If someone later removes the clinical text from the callers instead of
    // masking it, the masked branch would have nothing to mask and the feature
    // would look correct while the DETAILED level quietly lost its value. This
    // asserts the detailed level is still reachable, so the level is a choice
    // rather than a deletion.
    const med = codeOnly(read("medicationReminderSync"));
    expect(med).toMatch(/earliest\.med\.name/);
    expect(med).toMatch(/const names|\bnames\b/);
  });
});

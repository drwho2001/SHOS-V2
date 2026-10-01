// Wiring guard for the 1 Oct 2026 "date informed" change.
//
// A contact's HIV status is STATED by the user, not derived from a test, so
// there is no test record to date it from. The fix was to record WHEN THE USER
// WAS TOLD and say plainly that it is not a test date - rather than forcing a
// date the user does not have, or leaving an undated status to read as current.
//
// The properties worth protecting are wiring properties, not rendered output, so
// they are asserted against source. The important one is the last: if the
// informed date were ever passed into describeHivStatus as `since`, that helper
// renders it as "as of <date>", which would turn a recollection into an apparent
// test result. That is the exact false assurance this change exists to remove,
// and it is the kind of edit that would otherwise look like a harmless tidy-up.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p) => readFileSync(resolve(process.cwd(), p), "utf8");
const CONTACTS = read("src/modules/SHOS_Contacts_Prototype.jsx");
const REPO = read("src/repositories/contactRepository.js");

const DISCLAIMER = "Not a record of when the test was done. This information may be out of date.";

describe("a contact's stated HIV status is dated by when you were told, not by a test", () => {
  it("the field exists with a safe default", () => {
    expect(REPO).toMatch(/hivStatusInformedDate:\s*""/);
  });

  it("the read view shows the disclaimer whenever the date is shown", () => {
    // Non-vacuity: the date and the disclaimer must be present at all, or the
    // assertions below would pass against a screen that shows neither.
    expect(CONTACTS, "the informed date is never rendered").toMatch(/hivStatusInformedDate/);
    expect(CONTACTS, "the disclaimer is missing").toContain(DISCLAIMER);
  });

  it("the date row and its disclaimer are gated on the same condition", () => {
    // Anonymise mode masks HIV status deliberately - it is in the app's own
    // masked set. A date shown next to a masked status would not disclose the
    // status, but it would leave a visible trace of one having been recorded, so
    // the two must appear and disappear together.
    expect(CONTACTS).toMatch(
      /contact\.hivStatusInformedDate\s*&&\s*!\(hideFurther\s*\|\|\s*anonymise\)/,
    );
  });

  it("the informed date is NOT passed to describeHivStatus as a test date", () => {
    // THE load-bearing assertion. describeHivStatus renders `since` as
    // "as of <date>". Feeding it a recollection would present a date someone
    // remembered out loud as though it were a verified test result.
    const derived = CONTACTS.match(/const contactHivStatus = useMemo\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/);
    expect(derived, "could not locate contactHivStatus - guard is vacuous").toBeTruthy();
    expect(derived[0], "a stated status must keep `since: null`").toMatch(/since:\s*null/);
    expect(derived[0], "the informed date must not be smuggled in as `since`").not.toMatch(
      /hivStatusInformedDate/,
    );
  });

  it("the edit form labels it 'Date informed' and does not call it a test date", () => {
    expect(CONTACTS).toMatch(/label="Date informed"/);
    // The label is the whole mechanism for a glance. A field called "Last
    // tested" here would recreate the ambiguity this replaces.
    expect(CONTACTS).not.toMatch(/label="HIV last tested/);
  });
});

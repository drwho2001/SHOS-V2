// Tests for the non-blocking early-dose notice.
//
// The reminder bug this pairs with is covered in vaccinationDoseFulfilment.test.js.
// This file covers the half that TELLS the user it happened - which is a
// separate claim, and the reason the notice is written to a specific shape
// rather than as a bare string in the component.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  getEarlyDoseNotice,
  isDoseDateSuperseded,
  VACCINE_INTERVAL_GUIDANCE,
} from "./vaccinationCalculations.js";

const series = (doses) => doses;

// Read once at module scope. It was originally read inside one describe, and a
// second describe needing the same source could not see it - a scoping mistake
// that reads as a product bug when the error is `src is not defined`.
const src = readFileSync(
  path.join(process.cwd(), "src", "modules", "SHOS_Vaccinations_Prototype.jsx"),
  "utf8",
);

describe("early dose notice - fires only on a genuine early dose", () => {
  it("reports the owner's real case: two days before the stated due date", () => {
    const doses = series([
      { doseNumber: 1, date: "2026-08-01", nextDue: "2026-09-01" },
      { doseNumber: 2, date: "2026-08-30" },
    ]);
    const notice = getEarlyDoseNotice(doses, 1);
    expect(notice).not.toBeNull();
    expect(notice.daysEarly).toBe(2);
    expect(notice.expectedOn).toBe("2026-09-01");
  });

  it("stays silent when the dose is on the due date", () => {
    // The boundary matters: "early" is a strict comparison, and a dose on the
    // date is the case the app is telling the user to aim for.
    const doses = series([
      { doseNumber: 1, date: "2026-08-01", nextDue: "2026-09-01" },
      { doseNumber: 2, date: "2026-09-01" },
    ]);
    expect(getEarlyDoseNotice(doses, 1)).toBeNull();
  });

  it("stays silent when the dose is late", () => {
    // Lateness is a different (and much less actionable) question, and the
    // medication side handles that separately via doseTimingAdvisory. Warning
    // "early" about a late dose would be actively wrong.
    const doses = series([
      { doseNumber: 1, date: "2026-08-01", nextDue: "2026-09-01" },
      { doseNumber: 2, date: "2026-09-14" },
    ]);
    expect(getEarlyDoseNotice(doses, 1)).toBeNull();
  });

  it("stays silent when the previous dose stated no due date", () => {
    // There is no schedule to be early against, so warning about nothing is
    // noise. This is the shape most real records have: a user logs a course
    // and only fills in due dates where they were given one.
    const doses = series([
      { doseNumber: 1, date: "2026-08-01" },
      { doseNumber: 2, date: "2026-08-30" },
    ]);
    expect(getEarlyDoseNotice(doses, 1)).toBeNull();
  });

  it("stays silent for the FIRST dose, which has nothing before it", () => {
    const doses = series([{ doseNumber: 1, date: "2026-08-30" }]);
    expect(getEarlyDoseNotice(doses, 0)).toBeNull();
  });

  it("compares against the dose IMMEDIATELY before, not the first one", () => {
    // A three-dose course: dose 3 is a month after dose 2's due date in real
    // time, but a naive "compare against the earliest dose" would flag every
    // well-formed course as early, which is the exact opposite of useful.
    const doses = series([
      { doseNumber: 1, date: "2026-01-01", nextDue: "2026-02-01" },
      { doseNumber: 2, date: "2026-02-15", nextDue: "2026-03-17" },
      { doseNumber: 3, date: "2026-03-10" },
    ]);
    const notice = getEarlyDoseNotice(doses, 2);
    expect(notice.daysEarly).toBe(7);
    expect(notice.expectedOn).toBe("2026-03-17");
  });

  it("counts whole calendar days, not a 23-hour DST-shortened span", () => {
    // The guard this guards is the recorded medication-adherence bug: dividing
    // elapsed milliseconds by 86400000 to get a day count. A dose one calendar
    // day early must read as 1, and 1 is the number a person will act on.
    const doses = series([
      { doseNumber: 1, date: "2026-03-28", nextDue: "2026-03-30" },
      { doseNumber: 2, date: "2026-03-29" },
    ]);
    expect(getEarlyDoseNotice(doses, 1).daysEarly).toBe(1);
  });

  it("survives malformed rows rather than throwing", () => {
    // A partially-built dose row is normal mid-edit, and an advisory that
    // throws while the user is typing a date would be far worse than useless.
    expect(getEarlyDoseNotice(series([{ nextDue: "2026-09-01" }, { date: "2026-08-30" }]), 1).daysEarly).toBe(2);
    expect(getEarlyDoseNotice(series([null, { date: "2026-08-30" }]), 1)).toBeNull();
    expect(getEarlyDoseNotice(series([{ date: "2026-08-01" }, undefined]), 1)).toBeNull();
    expect(getEarlyDoseNotice(null, 1)).toBeNull();
    expect(getEarlyDoseNotice(series([{ date: "2026-08-01" }, { date: "2026-08-02" }]), 99)).toBeNull();
  });
});

describe("clinical interval guidance is sourced or absent - never invented", () => {
  it("ships empty, so no unsourced clinical number can reach a user", () => {
    // THE load-bearing assertion in this file. The owner asked for a warning
    // "if outside BASHH or other clinical recommendations", and honouring that
    // literally means writing down real minimum intervals. They are not written
    // down, because this project has already had to throw out two clinical
    // constants that looked deliberate and turned out to have no source at all.
    //
    // A wrong interval is not a wrong number on a screen. It is someone
    // concluding a dose they actually received was insufficient, or that their
    // course is invalid. So the table starts empty and this test fails the day
    // anybody fills it in, forcing the source to be added with it.
    expect(Object.keys(VACCINE_INTERVAL_GUIDANCE)).toEqual([]);
  });

  it("is frozen, so a caller cannot add guidance at runtime and bypass the source check", () => {
    // The other way in. Without this, any module could quietly push an
    // unsourced interval into the table and the notice would then present it
    // as clinical guidance, with the empty-table test still green.
    expect(() => {
      "use strict";
      VACCINE_INTERVAL_GUIDANCE["Hepatitis B"] = { minIntervalDays: 28, source: "invented" };
    }).toThrow();
    expect(Object.keys(VACCINE_INTERVAL_GUIDANCE)).toEqual([]);
  });

  it("reports guidance as absent rather than guessing, while still reporting the fact", () => {
    // The two halves are separable on purpose: the app can PROVE from the
    // user's own data that a dose was early, and it cannot prove whether that
    // is wrong. So the notice carries the fact and a null verdict, and the UI
    // decides what to do with a verdict it does not have.
    const doses = series([
      { doseNumber: 1, date: "2026-08-01", nextDue: "2026-09-01" },
      { doseNumber: 2, date: "2026-08-30" },
    ]);
    const notice = getEarlyDoseNotice(doses, 1);
    expect(notice.guidance).toBeNull();
    expect(notice.daysEarly).toBe(2);
  });
});

describe("the notice is actually rendered, and rendered as an advisory", () => {
  // A unit test on a pure function cannot see whether any screen calls it. This
  // project has shipped a feature whose hook worked perfectly in unit tests
  // while a sweep silently failed to attach it to the component that mattered,
  // so the wiring is asserted at the source level too.

  it("the dose editor renders it for every dose row", () => {
    expect(src, "DoseByDose must render EarlyDoseNotice per row").toMatch(/<EarlyDoseNotice\s+doses=\{doses\}\s+index=\{index\}/);
  });

  it("the component reads the real calculation rather than re-deriving it", () => {
    // The duplication this prevents is the one this file's whole existence is
    // about: a second copy of a date comparison, which is how the 23-hour
    // DST-shortened day count got into the codebase in the first place.
    expect(src, "EarlyDoseNotice must call getEarlyDoseNotice").toMatch(/getEarlyDoseNotice\(doses, index\)/);
    expect(src, "the notice must not compare dates inline").not.toMatch(/Date\.parse\([^)]*doses/);
  });

  it("states that the dose is recorded either way, so it never reads as a block", () => {
    // The single most important sentence in the feature. If this is ever
    // reworded into something that sounds like the save is in question, the
    // feature has stopped being non-blocking regardless of the code above.
    expect(src).toMatch(/recorded either way/);
  });

  it("uses role=status, not an assertive alert", () => {
    // Assertive would re-announce on every keystroke that crosses the
    // boundary, while the user is mid-edit in a date field.
    expect(src, "the notice must be a polite status").toMatch(/role="status"/);
    const noticeBlock = src.slice(src.indexOf("function EarlyDoseNotice"), src.indexOf("function DoseByDose"));
    expect(noticeBlock, "no assertive role inside the notice").not.toMatch(/role="alert"/);
  });

  it("makes no clinical verdict while the guidance table is empty", () => {
    // If someone hardcodes "this is too soon" into the copy, the empty
    // guidance table stops meaning anything - the app would be asserting a
    // clinical conclusion it has no source for. The unguarded branch must not
    // contain a verdict word.
    const noticeBlock = src.slice(src.indexOf("function EarlyDoseNotice"), src.indexOf("function DoseByDose"));
    expect(noticeBlock).not.toMatch(/too soon|invalid|ineffective|will not count|unsufficient/i);
  });
});

describe("a superseded dose is not shown as OVERDUE", () => {
  // Found by reading the real screen in a real browser, not by reading the
  // diff. The reminder fix was correct and every unit test on it was green,
  // while the detail view was still rendering "(OVERDUE)" in red on the very
  // record whose reminder had just stopped - the same wrong reasoning one level
  // down, comparing a date to today instead of asking whether the series had
  // moved on. Fixing the calculation and not the text that renders it is the
  // half-done version of this bug.
  it("a dose followed by a GIVEN later dose is done, not overdue", () => {
    const doses = [
      { doseNumber: 1, date: "2026-05-01", nextDue: "2026-09-01" },
      { doseNumber: 2, date: "2026-08-30" },
    ];
    expect(isDoseDateSuperseded(doses, 0)).toBe(true);
  });

  it("the last dose's own date is never superseded", () => {
    const doses = [
      { doseNumber: 1, date: "2026-05-01", nextDue: "2026-09-01" },
      { doseNumber: 2, date: "2026-08-30", nextDue: "2026-12-01" },
    ];
    // This one is genuinely still outstanding, so calling it "done" would be
    // the over-correction in the other direction - silencing a real reminder.
    expect(isDoseDateSuperseded(doses, 1)).toBe(false);
  });

  it("a later row that has NOT been given does not supersede anything", () => {
    // A pre-added planned dose is a placeholder, not a fact. Treating it as
    // one would mark a real outstanding dose as done.
    const doses = [
      { doseNumber: 1, date: "2026-05-01", nextDue: "2026-09-01" },
      { doseNumber: 2, nextDue: "2026-12-01" },
    ];
    expect(isDoseDateSuperseded(doses, 0)).toBe(false);
  });

  it("survives malformed rows", () => {
    expect(isDoseDateSuperseded([{ date: "2026-05-01" }, null], 0)).toBe(false);
    expect(isDoseDateSuperseded(null, 0)).toBe(false);
    expect(isDoseDateSuperseded([{ date: "2026-05-01" }], 99)).toBe(false);
  });

  it("the detail view uses it, and the OVERDUE label is gated on it", () => {
    const from = src.indexOf("v.doses.map");
    const detail = src.slice(from, src.indexOf("dose.notes &&", from));
    expect(detail, "the dose card must call isDoseDateSuperseded").toMatch(/isDoseDateSuperseded\(v\.doses, index\)/);

    // The date comparison itself is still correct and still needed - a dose
    // genuinely in the past with nothing after it IS overdue. What was wrong
    // was using it ALONE. So the assertion is that it is gated, not that it is
    // gone: the alert styling and the "(OVERDUE)" text must both hang off a
    // condition that includes the superseded check.
    expect(detail, "the alert condition must exclude a superseded dose")
      .toMatch(/const alert = !superseded && past;/);
    expect(detail, "the OVERDUE text must not be shown for a superseded dose")
      .toMatch(/const flag = superseded \? "\(done\)" : past \? "\(OVERDUE\)" : "";/);
  });
});

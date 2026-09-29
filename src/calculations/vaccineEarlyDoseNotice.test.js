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
    getIntervalGuidance,
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
  it("gives every entry a real source document, a URL and a date it was checked", () => {
    // REPLACED 29 Sep 2026 (t032). This used to assert the table was EMPTY,
    // which was the right guard while there was nothing in it: the whole point
    // was that no unsourced clinical number could reach a user, and this
    // project has already had to throw out two clinical constants that looked
    // deliberate and turned out to have no source at all.
    //
    // Now that it is populated, "empty" is no longer a property worth
    // asserting - it would only stop the feature shipping. The STRONGER
    // property is that nothing can be ADDED without a citable source, which is
    // what this asserts now, per entry.
    const entries = Object.entries(VACCINE_INTERVAL_GUIDANCE);
    expect(entries.length).toBeGreaterThan(0);

    for (const [name, entry] of entries) {
      expect(typeof entry.source, `${name} needs a source`).toBe("string");
      expect(entry.source.trim().length, `${name} source is empty`).toBeGreaterThan(20);
      expect(
        entry.sourceUrl,
        `${name} needs a sourceUrl`,
      ).toMatch(/^https:\/\/(www\.)?(gov|nhs|england\.nhs)\.?uk\//);
      expect(entry.checkedOn, `${name} needs a checkedOn date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.floor && typeof entry.floor === "object", `${name} needs a floor`).toBe(true);
      for (const [doseNo, days] of Object.entries(entry.floor)) {
        // Object.entries gives STRING keys, so this is the only correct way to
        // assert the key is a dose position. An earlier version of this test
        // used Number.isInteger on the key and failed on its own fixture.
        expect(Number.isInteger(Number(doseNo)), `${name} floor keys must be dose positions`).toBe(true);
        expect(Number(doseNo)).toBeGreaterThan(0);
        expect(Number.isFinite(days), `${name} floor[${doseNo}] must be a number`).toBe(true);
        expect(days).toBeGreaterThan(0);
      }
    }
  });

  it("is frozen, so a caller cannot add guidance at runtime and bypass the source check", () => {
    // The other way in. Without this, any module could quietly push an
    // unsourced interval into the table and the notice would then present it
    // as clinical guidance, with the sourced-entry test still green.
    expect(() => {
      "use strict";
      VACCINE_INTERVAL_GUIDANCE["Hepatitis B"] = { floor: { 1: 28 }, source: "invented" };
    }).toThrow();
  });

  it("matches a vaccine by EXACT name only, never loosely", () => {
    // A substring rule once made "Hepatitis A" resolve to the hepatitis B
    // entry, which would have warned about the wrong vaccine entirely. On a
    // clinical number, a wrong match is worse than no match.
    expect(getIntervalGuidance("Hepatitis B")).toBeTruthy();
    expect(getIntervalGuidance("  hepatitis b  ")).toBeTruthy();
    expect(getIntervalGuidance("Hepatitis A")).not.toBe(getIntervalGuidance("Hepatitis B"));
    expect(getIntervalGuidance("Hepatitis")).toBeNull();
    expect(getIntervalGuidance("Meningitis B vaccine (4CMenB)")).toBeNull();
    expect(getIntervalGuidance(undefined)).toBeNull();
  });

  it("gives the two 4CMenB indications different courses, because the courses differ", () => {
    // Same product, two indications. Merged, a user's first gonorrhoea dose
    // reads as a meningitis B booster.
    const menb = getIntervalGuidance("Meningitis B");
    const gon = getIntervalGuidance("Gonorrhoea");
    expect(menb.floor[1]).toBe(28);
    expect(menb.floor[2]).toBe(28); // the booster
    expect(gon.floor[1]).toBe(28);
    expect(gon.floor[2]).toBeUndefined(); // no booster on that course
  });

  it("stores the FASTEST valid UK schedule, so an accelerated course is never warned", () => {
    // Hep B allows 0,1,6 routine, 0,1,2,12 accelerated and 0,7d,21d very
    // rapid. An earlier draft stored the routine 28/140, which would have
    // falsely warned on the very rapid schedule.
    const hepB = getIntervalGuidance("Hepatitis B");
    expect(hepB.floor[1]).toBe(7);
    expect(hepB.floor[2]).toBe(14);
    expect(hepB.routine[1]).toBeGreaterThan(hepB.floor[1]);
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
    const notice = getEarlyDoseNotice(doses, 1, "Hepatitis B");
    expect(notice).not.toBeNull();
    // 29 days apart, and the hepatitis B floor is 7, so this is NOT below a
    // published minimum - it is only earlier than the user's own due date.
    expect(notice.kind).toBe("before-due-date");
    expect(notice.guidance).toBeTruthy();
    expect(notice.guidance).toBe(getIntervalGuidance("Hepatitis B"));
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
      // WIDENED 29 Sep 2026 (t032), not loosened: the call gained a third
      // argument (the record's vaccine name, because a dose object does not
      // carry one and the previous code read a field that never existed). The
      // assertion that matters - it calls the shared pure function rather than
      // re-deriving the comparison inline - is unchanged.
      expect(src, "EarlyDoseNotice must call getEarlyDoseNotice").toMatch(/getEarlyDoseNotice\(doses, index, vaccineName\)/);
    expect(src, "the notice must not compare dates inline").not.toMatch(/Date\.parse\([^)]*doses/);
  });

  it("states that the dose is recorded either way, so it never reads as a block", () => {
    // The single most important sentence in the feature. If this is ever
    // reworded into something that sounds like the save is in question, the
    // feature has stopped being non-blocking regardless of the code above.
      // REWORDED 29 Sep 2026 (t032). The old phrase "recorded either way" was
      // one clause in a longer accusatory sentence. The copy now opens by
      // saying the same thing in the user's terms - that it is fine if the
      // dose was offered early - and this still guards the single property
      // that matters: nothing here may read as the save being in question.
      // The guard firing is the point; it fired here because the wording
      // genuinely changed, and the change was checked rather than reverted.
      expect(src).toMatch(/fine if it was offered to you early|recorded either way/);
      // And the accusatory framing must not come back.
      expect(src).not.toMatch(/outside the recommended minimum interval for this vaccine/);
      // No day count is shown. A second model was right: on a mis-keyed date
      // "42 days early" is noise, and on a near-miss it manufactures anxiety.
      expect(src).not.toMatch(/Logged \$\{days\} before/);
  });

  it("uses role=status, not an assertive alert", () => {
    // Assertive would re-announce on every keystroke that crosses the
    // boundary, while the user is mid-edit in a date field.
    expect(src, "the notice must be a polite status").toMatch(/role="status"/);
    const noticeBlock = src.slice(src.indexOf("function EarlyDoseNotice"), src.indexOf("function DoseByDose"));
    expect(noticeBlock, "no assertive role inside the notice").not.toMatch(/role="alert"/);
  });

    // The stripper is what makes a NEGATIVE assertion about copy meaningful.
    // This repo has now hit four times the case where a guard matched the
    // comment written to document the fix - and this one did it on the very
    // commit that added the comment explaining the new wording, which is the
    // worst version of it. A raw substring check over source that is this
    // heavily commented can only ever pass by accident.
    const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

    it("the comment stripper is non-vacuous, or the negative checks below are hollow", () => {
      const block = src.slice(src.indexOf("function EarlyDoseNotice"), src.indexOf("function DoseByDose"));
      expect(block).toContain("getEarlyDoseNotice");
      expect(block, "the block should contain comments for stripping to matter").toMatch(/\/\//);
      expect(stripComments(block)).not.toMatch(/\/\//);
    });

    it("makes no clinical verdict in the copy the user reads", () => {
      // REWORDED 29 Sep 2026 (t032). This used to be "while the guidance table
      // is empty" and asserted the same thing: the copy must never assert a
      // clinical conclusion. The table is now populated, but the property is
      // unchanged and still the important one - the app can PROVE from the
      // user's own data that a dose was early, and it cannot prove what that
      // means. Only the unguarded branch matters: with a sourced entry the
      // copy may reference the interval, without one it must not judge.
      const noticeBlock = stripComments(
        src.slice(src.indexOf("function EarlyDoseNotice"), src.indexOf("function DoseByDose")),
      );
      expect(noticeBlock).not.toMatch(/too soon|invalid|ineffective|will not count|unsufficient|wasted/i);
      // And it must not hand down a verdict the other way either.
      expect(noticeBlock).not.toMatch(/is fine,? (you|this) (are|are protected)/i);
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

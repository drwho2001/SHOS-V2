// The point of this file is a NEGATIVE property: hepBGuidance must never
// produce a verdict about the individual. That is the whole reason t025 was
// rescoped away from "vaccine eligibility suggestions", and it is the property
// most likely to be quietly undone by a later session finding the wording a
// bit vague and tightening it into an eligibility claim.

import { describe, it, expect } from "vitest";
import {
  getHepatitisBGuidance,
  isHepatitisB,
  makesEligibilityClaim,
} from "./hepBGuidance.js";
import { HIV_STATUS, DEFAULT_HIV_STATUS } from "./hivStatusCalculations.js";
import { DEFAULT_VACCINATION } from "../repositories/vaccinationRepository.js";

// WHY THIS IMPORT. The bug this file was extended for was not in the regex - it
// was that `isHepatitisB` read `record.name`, a field the vaccination record
// does not have. A unit test that constructs its own `{ name }` fixture cannot
// catch that, because the fixture is shaped like the bug. Importing the REAL
// record shape turns "which fields exist" into something the suite can check.
describe("the vaccination record shape is what the matcher must read", () => {
  it("the record has `vaccine` and `title`, and no `name`", () => {
    // Pins the ROOT CAUSE as a fact rather than as a comment. If someone
    // renames `vaccine`, this fails and the matcher has to change with it -
    // which is the failure this bug actually was, arriving silently.
    expect(DEFAULT_VACCINATION).toHaveProperty("vaccine");
    expect(DEFAULT_VACCINATION).toHaveProperty("title");
    expect(DEFAULT_VACCINATION).not.toHaveProperty("name");
  });

  it("detects hepatitis B in a record built from the real record shape", () => {
    const record = { ...DEFAULT_VACCINATION, vaccine: "Hepatitis B" };
    // `.some()` is exactly what the Vaccinations screen does at the call site,
    // so this exercises the real wiring and not just the predicate.
    expect([record].some(isHepatitisB)).toBe(true);
  });

  it("actually suppresses the banner for a real-shaped record with hep B on file", () => {
    // The end-to-end property the owner reported as broken: a logged hepatitis B
    // vaccination must mean the banner is not rendered. Before the fix this
    // returned a guidance object regardless of the record.
    const record = { ...DEFAULT_VACCINATION, vaccine: "Hepatitis B" };
    const hasHepB = [record].some(isHepatitisB);
    expect(getHepatitisBGuidance({ hivStatus: HIV_STATUS.NEGATIVE, hasHepB })).toBeNull();
  });

  it("does not suppress the banner for an unrelated vaccine on a real-shaped record", () => {
    // The other direction: fixing the matcher must not make it match everything,
    // which would silence the banner for users who have never had it.
    const record = { ...DEFAULT_VACCINATION, vaccine: "Flu", title: "Seasonal flu" };
    const hasHepB = [record].some(isHepatitisB);
    expect(hasHepB).toBe(false);
    expect(getHepatitisBGuidance({ hivStatus: HIV_STATUS.NEGATIVE, hasHepB })).not.toBeNull();
  });
});

describe("it never renders a verdict about the individual", () => {
  const cases = [
    ["negative", HIV_STATUS.NEGATIVE],
    ["untested", HIV_STATUS.UNTESTED],
    ["positive, suppressed", HIV_STATUS.POSITIVE_SUPPRESSED],
    ["positive, unsuppressed", HIV_STATUS.POSITIVE_UNSUPPRESSED],
    ["default status", DEFAULT_HIV_STATUS],
    ["null", null],
    ["undefined", undefined],
    ["an unrecognised string (backup from a future build)", "who-knows"],
    ["a resolved object", { status: HIV_STATUS.NEGATIVE, since: null }],
    ["garbage", { status: 42 }],
  ];

  it.each(cases)("%s produces no eligibility claim", (_label, status) => {
    const g = getHepatitisBGuidance({ hivStatus: status });
    expect(makesEligibilityClaim(g)).toBe(false);
  });
});

describe("unknown and untested are deliberately indistinguishable", () => {
  it("gives negative, untested and no-status users the SAME wording", () => {
    const neg = getHepatitisBGuidance({ hivStatus: HIV_STATUS.NEGATIVE });
    const untested = getHepatitisBGuidance({ hivStatus: HIV_STATUS.UNTESTED });
    const none = getHepatitisBGuidance({ hivStatus: null });
    expect(untested.body).toBe(neg.body);
    expect(none.body).toBe(neg.body);
  });

  it("tailors wording only for a POSITIVE status", () => {
    const pos = getHepatitisBGuidance({ hivStatus: HIV_STATUS.POSITIVE_SUPPRESSED });
    const neg = getHepatitisBGuidance({ hivStatus: HIV_STATUS.NEGATIVE });
    expect(pos.body).not.toBe(neg.body);
  });

  it("both positive states get the same advice - the app cannot tell them apart here", () => {
    const s = getHepatitisBGuidance({ hivStatus: HIV_STATUS.POSITIVE_SUPPRESSED });
    const u = getHepatitisBGuidance({ hivStatus: HIV_STATUS.POSITIVE_UNSUPPRESSED });
    expect(s.body).toBe(u.body);
  });
});

describe("it says nothing when there is nothing to say", () => {
  it("returns null when hepatitis B is already recorded", () => {
    expect(getHepatitisBGuidance({ hivStatus: HIV_STATUS.NEGATIVE, hasHepB: true })).toBeNull();
  });

  it("still returns null for a positive status with hep B on file", () => {
    expect(getHepatitisBGuidance({ hivStatus: HIV_STATUS.POSITIVE_SUPPRESSED, hasHepB: true })).toBeNull();
  });

  it("works with no arguments at all", () => {
    expect(() => getHepatitisBGuidance()).not.toThrow();
  });
});

describe("always links to the NHS rather than paraphrasing a verdict", () => {
  it("carries a real NHS URL", () => {
    expect(getHepatitisBGuidance({}).link).toMatch(/^https:\/\/www\.nhs\.uk\//);
  });
});

describe("isHepatitisB reads the fields a real vaccination actually has", () => {
  // FIXED 13 Oct 2026. The old version of this block fed `isHepatitisB` a
  // `{ name }` wrapper - the one field no vaccination record carries - so it
  // passed while the real wiring was dead. The bug lived between this function
  // and the record shape, and a fixture shaped like the bug cannot find it.
  //
  // These cases use DEFAULT_VACCINATION's actual shape (`title` + `vaccine`),
  // and one of them is lifted verbatim from the app's own seed data.

  it("matches a hepatitis B record by its `vaccine` field", () => {
    expect(isHepatitisB({ vaccine: "Hepatitis B", title: "Hepatitis B vaccine" })).toBe(true);
  });

  it("matches a hepatitis B record by its `title` alone", () => {
    expect(isHepatitisB({ vaccine: "", title: "Hep B booster" })).toBe(true);
  });

  it("matches the app's own Twinrix seed record, which is hepatitis A AND B", () => {
    // Verbatim from seed_vaccination_9003 in vaccinationRepository.js. This is
    // the case that made the bug user-visible: the user HAS hepatitis B on file
    // (as part of a combined course) and the banner was still showing.
    expect(isHepatitisB({ vaccine: "Hepatitis A/B", title: "Hepatitis A/B vaccine (Twinrix), dose 1" })).toBe(true);
  });

  it("still accepts `name` for a hand-edited or imported record", () => {
    expect(isHepatitisB({ name: "Hep B" })).toBe(true);
  });

  it("does NOT read `title` as a substitute for a missing record - no record at all", () => {
    expect(isHepatitisB(null)).toBe(false);
    expect(isHepatitisB(undefined)).toBe(false);
    expect(isHepatitisB({})).toBe(false);
  });
});

describe("hepatitis A is a DIFFERENT vaccine and must not suppress hepatitis B advice", () => {
  // The documented lesson from t025: an earlier `[ab]` character class matched
  // "Hepatitis A" as hepatitis B. The combined-vaccine case added in 13 Oct 2026
  // must not reopen that.
  it.each(["Hepatitis A", "Hep A", "HepA", "Hepatitis A vaccine"])(
    "does not match %j",
    (vaccine) => {
      expect(isHepatitisB({ vaccine })).toBe(false);
    }
  );

  it("does not treat a title mentioning hepatitis B as proof of a hepatitis B vaccine", () => {
    // Fields are tested separately, never joined. A record whose vaccine is
    // hepatitis A but whose free-text title happens to mention hepatitis B is
    // still a hepatitis A record.
    expect(isHepatitisB({ vaccine: "Hepatitis A", title: "gave alongside Hepatitis B discussion" })).toBe(false);
  });
});

describe("isHepatitisB is loose enough to match what users actually type", () => {
  it.each([
    "Hepatitis B", "Hep B", "HepB", "hep b", "HEPATITIS B", "Hep B (course)",
  ])("matches %j", (name) => {
    expect(isHepatitisB({ vaccine: name })).toBe(true);
  });

  it.each(["", "HPV", "Hepatitis A", "Flu", undefined, null, {}])(
    "does not match %j",
    (vaccine) => {
      expect(isHepatitisB({ vaccine })).toBe(false);
    }
  );
});

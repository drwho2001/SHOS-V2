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

describe("isHepatitisB is loose enough to match what users actually type", () => {
  it.each([
    "Hepatitis B", "Hep B", "HepB", "hep b", "HEPATITIS B", "Hep B (course)",
  ])("matches %j", (name) => {
    expect(isHepatitisB({ name })).toBe(true);
  });

  it.each(["", "HPV", "Hepatitis A", "Flu", undefined, null, {}])(
    "does not match %j",
    (name) => {
      expect(isHepatitisB({ name })).toBe(false);
    }
  );
});

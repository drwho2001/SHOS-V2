// Regression coverage for the false-assurance bug found 1 Oct 2026, plus the
// infection-matching rules that had to be settled to fix it.
//
// THE BUG: getAutoLastTestedDate() returned the most recent test of ANY kind,
// and it was duplicated byte-identically in SHOS_MyProfile_Prototype.jsx and
// profileShareService.js. In the section it rendered in - PrEP/DoxyPEP, directly
// above HIV status - "last tested date" reads as "last HIV test". A chlamydia
// swab could satisfy it, so the app asserted a date for an HIV test that never
// happened.
//
// Every test here fails on the old implementation, except where noted.
import { describe, it, expect } from "vitest";
import { mostRecentTestDate, testCoversInfection } from "./mostRecentTest.js";

const HIV_TEST = { id: "t_hiv", date: "2026-03-01T09:00:00.000Z", testingFor: ["HIV"] };
const CHLAMYDIA_TEST = { id: "t_ch", date: "2026-09-01T09:00:00.000Z", testingFor: ["Chlamydia"] };
const HEP_B_TEST = { id: "t_hepb", date: "2026-08-01T09:00:00.000Z", testingFor: ["Hepatitis B"] };

describe("the headline bug: a non-HIV test cannot be an HIV test date", () => {
  it("ignores a chlamydia test when asked for HIV, however recent", () => {
    // The exact defect. The chlamydia test is NEWER, so the old sort-by-date
    // implementation returned it.
    const tests = [CHLAMYDIA_TEST, HIV_TEST];
    expect(mostRecentTestDate(tests, { infection: "HIV" })).toBe(HIV_TEST.date);
    expect(mostRecentTestDate(tests, { infection: "HIV" })).not.toBe(CHLAMYDIA_TEST.date);
  });

  it("returns null when there is an HIV-unrelated test but no HIV test", () => {
    // The dangerous shape is not "a wrong date", it is "a plausible date for a
    // test that never happened".
    expect(mostRecentTestDate([CHLAMYDIA_TEST, HEP_B_TEST], { infection: "HIV" })).toBeNull();
  });

  it("with no infection asked about it still means any test", () => {
    // Home's dashboard relies on the general sense. Narrowing the helper must not
    // quietly narrow that too.
    const tests = [HIV_TEST, CHLAMYDIA_TEST];
    expect(mostRecentTestDate(tests)).toBe(CHLAMYDIA_TEST.date);
    expect(mostRecentTestDate(tests, { infection: null })).toBe(CHLAMYDIA_TEST.date);
  });
});

describe("infection matching is by token, not by string equality", () => {
  // Hepatitis is why equality fails: the option list runs Hepatitis A through E,
  // one test can read "Hepatitis B & C", and HIV is written HIV-1 / HIV-2 in
  // real records. Too strict and a genuine HIV test is missed; too loose and a
  // bare "Hepatitis" would answer a question about Hepatitis B.

  it("HIV-1 and HIV-2 count as HIV", () => {
    expect(testCoversInfection({ testingFor: ["HIV-1"] }, "HIV")).toBe(true);
    expect(testCoversInfection({ testingFor: ["HIV-2"] }, "HIV")).toBe(true);
    expect(testCoversInfection({ testingFor: ["hiv"] }, "HIV")).toBe(true);
  });

  it("Hepatitis B does not count as Hepatitis C", () => {
    expect(testCoversInfection({ testingFor: ["Hepatitis B"] }, "Hepatitis C")).toBe(false);
    expect(testCoversInfection({ testingFor: ["Hepatitis C"] }, "Hepatitis B")).toBe(false);
  });

  it("a combined panel covers each infection it names", () => {
    const panel = { testingFor: ["Hepatitis B & C"] };
    expect(testCoversInfection(panel, "Hepatitis B")).toBe(true);
    expect(testCoversInfection(panel, "Hepatitis C")).toBe(true);
    expect(testCoversInfection(panel, "Hepatitis A")).toBe(false);
  });

  it("a bare 'Hepatitis' with no letter FAILS CLOSED for Hepatitis B", () => {
    // The important direction. We cannot know it covered B, so it must not be
    // reported as if it did.
    expect(testCoversInfection({ testingFor: ["Hepatitis"] }, "Hepatitis B")).toBe(false);
  });

  it("Chlamydia is not HIV, in either spelling", () => {
    expect(testCoversInfection({ testingFor: ["Chlamydia"] }, "HIV")).toBe(false);
    expect(testCoversInfection({ testingFor: ["Gonorrhoea"] }, "HIV")).toBe(false);
    expect(testCoversInfection({ testingFor: ["Mpox"] }, "HIV")).toBe(false);
  });

  it("a test with no testingFor at all covers nothing", () => {
    // Safer than assuming: an unlabelled test must not stand in for any infection.
    expect(testCoversInfection({ testingFor: [] }, "HIV")).toBe(false);
    expect(testCoversInfection({}, "HIV")).toBe(false);
    expect(testCoversInfection({ testingFor: null }, "HIV")).toBe(false);
  });
});

describe("the rules this helper inherited, now in one place", () => {
  it("excludes archived tests", () => {
    const archived = { id: "t_a", date: "2026-09-01T09:00:00.000Z", testingFor: ["HIV"], isArchived: true };
    expect(mostRecentTestDate([archived, HIV_TEST], { infection: "HIV" })).toBe(HIV_TEST.date);
  });

  it("excludes future-dated tests, including when it is the only one", () => {
    const future = { id: "t_f", date: "2099-01-01T09:00:00.000Z", testingFor: ["HIV"] };
    expect(mostRecentTestDate([future, HIV_TEST], { infection: "HIV" })).toBe(HIV_TEST.date);
    expect(mostRecentTestDate([future], { infection: "HIV" })).toBeNull();
  });

  it("does not mistake a scheduled routine retest for a completed test", () => {
    const scheduled = {
      id: "planned",
      date: "2026-09-20T12:00:00.000Z",
      testingFor: ["HIV"],
      isRoutineRetestPlan: true,
    };
    expect(mostRecentTestDate([HIV_TEST, scheduled], { infection: "HIV", todayIsoDay: "2026-10-01" })).toBe(HIV_TEST.date);
    expect(mostRecentTestDate([scheduled], { infection: "HIV", todayIsoDay: "2026-10-01" })).toBeNull();
  });

  it("returns the newest eligible test, not the first", () => {
    const older = { id: "t_o", date: "2026-01-01T09:00:00.000Z", testingFor: ["HIV"] };
    expect(mostRecentTestDate([older, HIV_TEST], { infection: "HIV" })).toBe(HIV_TEST.date);
  });

  it("returns null rather than throwing on empty or malformed input", () => {
    // Defensive because every caller is a load path, and this file's own rule is
    // that a broken storage read must not take a screen down.
    expect(mostRecentTestDate([])).toBeNull();
    expect(mostRecentTestDate(null)).toBeNull();
    expect(mostRecentTestDate(undefined)).toBeNull();
    expect(mostRecentTestDate([{ id: "x" }])).toBeNull();
    expect(mostRecentTestDate([null, undefined])).toBeNull();
  });

  it("accepts an injected clock so the future rule is testable", () => {
    const t = { id: "t_c", date: "2026-06-01T09:00:00.000Z", testingFor: ["HIV"] };
    expect(mostRecentTestDate([t], { infection: "HIV", todayIsoDay: "2026-05-31" })).toBeNull();
    expect(mostRecentTestDate([t], { infection: "HIV", todayIsoDay: "2026-06-01" })).toBe(t.date);
  });
});

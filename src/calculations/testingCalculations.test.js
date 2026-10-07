import { describe, expect, it } from "vitest";
import {
  findSupersededRoutineRetestPlans,
  isCompletedTestRecord,
  isRoutineRetestEligible,
  recordsShareInfections,
  ROUTINE_RETEST_PANEL,
  routineRetestPrefill,
  suggestedRoutineRetestDate,
} from "./testingCalculations";

const results = new Map([
  ["negative", "Negative"],
  ["positive", "Positive"],
  ["pending", "Pending"],
]);

function coreTest(overrides = {}) {
  return {
    id: "test-core",
    date: "2026-03-01T10:00:00.000Z",
    testingFor: [...ROUTINE_RETEST_PANEL],
    resultIds: ["negative"],
    ...overrides,
  };
}

describe("routine retest eligibility", () => {
  it("suggests three calendar months after a completed negative core panel", () => {
    expect(isRoutineRetestEligible(coreTest(), results, "2026-03-01")).toBe(true);
    expect(suggestedRoutineRetestDate(coreTest(), results, "2026-03-01")).toBe("2026-06-01");
  });

  it("requires every infection in the core panel", () => {
    expect(isRoutineRetestEligible(coreTest({ testingFor: ["HIV", "Chlamydia"] }), results, "2026-03-01")).toBe(false);
    expect(suggestedRoutineRetestDate(coreTest({ testingFor: ["Gonorrhoea", "HIV", "Syphilis"] }), results, "2026-03-01")).toBeNull();
  });

  it("does not suggest a routine retest for positive or unreadable results", () => {
    expect(isRoutineRetestEligible(coreTest({ resultIds: ["positive"] }), results, "2026-03-01")).toBe(false);
    expect(isRoutineRetestEligible(coreTest({ resultIds: ["negative", "positive"] }), results, "2026-03-01")).toBe(false);
    expect(isRoutineRetestEligible(coreTest({ resultIds: ["pending"] }), results, "2026-03-01")).toBe(false);
    expect(isRoutineRetestEligible(coreTest({ resultIds: [] }), results, "2026-03-01")).toBe(false);
  });

  it("requires a real, non-future test date", () => {
    expect(isRoutineRetestEligible(coreTest({ date: null }), results, "2026-03-01")).toBe(false);
    expect(isRoutineRetestEligible(coreTest({ date: "2026-03-02T10:00:00.000Z" }), results, "2026-03-01")).toBe(false);
  });

  it("excludes archived records and scheduled plans from completed-test calculations", () => {
    expect(isCompletedTestRecord(coreTest())).toBe(true);
    expect(isCompletedTestRecord(coreTest({ isArchived: true }))).toBe(false);
    expect(isCompletedTestRecord(coreTest({ isRoutineRetestPlan: true }))).toBe(false);
    expect(isRoutineRetestEligible(coreTest({ isRoutineRetestPlan: true }), results, "2026-03-01")).toBe(false);
  });

  it("keeps the existing end-of-month rollover behavior", () => {
    const test = coreTest({ date: "2026-11-30T10:00:00.000Z" });
    expect(suggestedRoutineRetestDate(test, results, "2026-11-30")).toBe("2027-02-28");
  });

  // DECIDED BEHAVIOUR, pinned deliberately rather than left as a side effect.
  // Before the panel gate, a Gonorrhoea-only negative produced a routine-retest
  // suggestion and armed the reminder. That is what the owner asked to change -
  // a single infection result is not the routine screen - but it also means a
  // partial panel no longer reminds at all. If that ever needs revisiting, this
  // is the test that has to be changed with it.
  it("offers no suggestion for a partial panel, even a negative one", () => {
    const partial = coreTest({ testingFor: ["Gonorrhoea", "Chlamydia"] });
    expect(isRoutineRetestEligible(partial, results, "2026-03-01")).toBe(false);
    expect(suggestedRoutineRetestDate(partial, results, "2026-03-01")).toBeNull();
  });
});

describe("a plan is never mistaken for a completed test", () => {
  function plan(overrides = {}) {
    return {
      id: "plan-1",
      title: "Routine retest",
      date: "2026-09-20T12:00:00.000Z",
      plannedForDate: "2026-09-20",
      testingFor: [...ROUTINE_RETEST_PANEL],
      resultIds: [],
      isRoutineRetestPlan: true,
      ...overrides,
    };
  }

  it("a plan with a full panel but no result is still not eligible", () => {
    // The trap this guards: the plan CARRIES the panel in testingFor, so a
    // naive "does it cover the panel" check would propose retesting the plan
    // from the plan. There is no Negative result on it, so there is nothing to
    // count three months from.
    expect(isRoutineRetestEligible(plan(), results, "2026-09-01")).toBe(false);
    expect(suggestedRoutineRetestDate(plan(), results, "2026-09-01")).toBeNull();
    expect(isCompletedTestRecord(plan())).toBe(false);
  });

  it("a performed plan becomes a completed test again", () => {
    const performed = plan({ isRoutineRetestPlan: false, resultIds: ["negative"] });
    expect(isCompletedTestRecord(performed)).toBe(true);
  });
});

describe("plans superseded by a test the user already did", () => {
  const plan = {
    id: "plan-1", date: "2026-09-20T12:00:00.000Z", plannedForDate: "2026-09-20",
    testingFor: [...ROUTINE_RETEST_PANEL], isRoutineRetestPlan: true,
  };
  // ON OR AFTER the plan's own day. The two fixtures below differ ONLY by this
  // date, so the date gate is what decides between them - which is the whole
  // point of having the gate, and why an earlier version of this fixture (the
  // test two days BEFORE the plan) contradicted its own test name.
  const doneTest = { id: "test-9", date: "2026-09-22T10:00:00.000Z", testingFor: [...ROUTINE_RETEST_PANEL] };

  it("reports a plan whose day has arrived and whose panel was covered", () => {
    expect(findSupersededRoutineRetestPlans([plan], doneTest).map((p) => p.id)).toEqual(["plan-1"]);
  });

  it("does not report a plan for an EARLIER test - that is the keep/update case", () => {
    const early = { ...doneTest, date: "2026-09-01T10:00:00.000Z" };
    expect(findSupersededRoutineRetestPlans([plan], early)).toEqual([]);
  });

  it("does not report a plan covering infections the new test never touched", () => {
    const hepB = { ...doneTest, testingFor: ["Hepatitis B"] };
    expect(findSupersededRoutineRetestPlans([plan], hepB)).toEqual([]);
  });

  it("ignores archived and already-performed plans", () => {
    expect(findSupersededRoutineRetestPlans([{ ...plan, isArchived: true }], doneTest)).toEqual([]);
    expect(findSupersededRoutineRetestPlans([{ ...plan, isRoutineRetestPlan: false }], doneTest)).toEqual([]);
  });

  it("matches an HIV-1 style record against an HIV plan", () => {
    // Equality would say "no overlap" here and quietly leave a satisfied plan
    // nagging, which is the same false-assurance shape mostRecentTest.js exists
    // to prevent - in the opposite direction.
    expect(recordsShareInfections({ testingFor: ["HIV-1"] }, { testingFor: [...ROUTINE_RETEST_PANEL] })).toBe(true);
    expect(findSupersededRoutineRetestPlans([plan], { ...doneTest, testingFor: ["HIV-1"] })).toHaveLength(1);
  });

  it("returns nothing for a malformed or missing completed test", () => {
    expect(findSupersededRoutineRetestPlans([plan], null)).toEqual([]);
    expect(findSupersededRoutineRetestPlans([plan], { date: null, testingFor: [] })).toEqual([]);
    expect(findSupersededRoutineRetestPlans(null, doneTest)).toEqual([]);
  });
});

describe("what a scheduled retest carries over from the test it follows", () => {
  it("copies the owner's own sample types, which is what makes it accurate for them", () => {
    // Triple-site is the case that matters: a plan saying only "Urine"
    // under-specifies the retest for someone whose pharyngeal and rectal
    // samples are the ones that actually get tested.
    const source = { sampleType: ["Urine", "Throat swab", "Rectal swab", "Blood"] };
    expect(routineRetestPrefill(source).sampleType)
      .toEqual(["Urine", "Throat swab", "Rectal swab", "Blood"]);
  });

  it("does NOT share the array with the source record", () => {
    // The aliasing bug: two persisted records holding one array means an
    // in-place edit to either silently changes the other before either is saved.
    const source = { sampleType: ["Urine"] };
    const prefill = routineRetestPrefill(source);
    expect(prefill.sampleType).not.toBe(source.sampleType);
    prefill.sampleType.push("Blood");
    expect(source.sampleType).toEqual(["Urine"]);
  });

  it("always carries the routine panel, whatever the source test screened for", () => {
    // Eligibility already requires the full panel, so this is the definition of
    // the plan rather than a copy - a one-off extra must not widen it.
    const source = { testingFor: ["HIV", "Hepatitis B", "Mpox"] };
    expect(routineRetestPrefill(source).testingFor).toEqual([...ROUTINE_RETEST_PANEL]);
  });

  it("is empty rather than wrong when there is no usable source test", () => {
    for (const bad of [null, undefined, {}, { sampleType: null }, { sampleType: "Urine" }]) {
      expect(routineRetestPrefill(bad).sampleType).toEqual([]);
    }
  });

  it("drops blank and non-string entries rather than persisting them as samples", () => {
    const source = { sampleType: ["Urine", "", "   ", null, 7, "Blood"] };
    expect(routineRetestPrefill(source).sampleType).toEqual(["Urine", "Blood"]);
  });

  it("collapses a duplicated sample instead of persisting it twice", () => {
    expect(routineRetestPrefill({ sampleType: ["Urine", "Urine"] }).sampleType)
      .toEqual(["Urine"]);
  });

  it("hands back fresh arrays on every call, not one shared constant", () => {
    const a = routineRetestPrefill({ sampleType: [] });
    const b = routineRetestPrefill({ sampleType: [] });
    expect(a.testingFor).not.toBe(b.testingFor);
    expect(a.sampleType).not.toBe(b.sampleType);
  });
});

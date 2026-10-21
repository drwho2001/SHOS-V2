import { describe, it, expect } from "vitest";
import { isPlannedTest, isPlannedTestOn, isCompletedTestRecord, isCompletedTestRecordOn } from "./testingCalculations";
import { deriveHivStatus } from "./hivStatusCalculations";

/**
 * t127: a test dated in the future is a PLANNED test, and everything that
 * derives a fact from tests has to agree about that.
 *
 * WHY THIS MATTERS MORE THAN IT LOOKS. Before this, the two shapes of a
 * planned test were treated differently by different parts of the app, and
 * the difference was invisible. Every DERIVATION excluded future-dated tests
 * because each filtered on the DATE; every RECORD-level consumer included
 * them. The worst of them was the derived HIV status, which took the newest
 * HIV test with no date filter at all - so a future-dated HIV test WON, and
 * the profile could read "HIV status: untested, tested 20 Jan 2027".
 *
 * The date is compared by CALENDAR DAY, which is the rule the rest of the
 * app already used ("a test logged for later today is included") - see
 * mostRecentTestDefinition.test.js.
 */

// A FIXED "today", so the tests do not depend on the calendar date. The
// repo's own rule: a test must never depend on machine speed, and by the
// same token it must not depend on the day it is run.
const TODAY = "2026-10-21";

const future = (day, extra = {}) => ({ id: "t1", date: `${day}T09:00:00.000Z`, ...extra });
const past = (day, extra = {}) => ({ id: "t2", date: `${day}T09:00:00.000Z`, ...extra });

describe("isPlannedTest: a future-dated test is an intention, not a fact", () => {
  it("a test dated after today is planned", () => {
    expect(isPlannedTestOn(future("2026-10-22"), TODAY)).toBe(true);
    expect(isPlannedTestOn(future("2027-01-12"), TODAY)).toBe(true);
  });

  it("a test dated today is NOT planned - later today is still today", () => {
    // The rule is by calendar DAY. A test logged for 23:00 tonight has not
    // happened yet, but it is not a future-dated record either, and the rest
    // of the app has always counted "logged today" as a real test.
    expect(isPlannedTestOn(future("2026-10-21"), TODAY)).toBe(false);
    expect(isPlannedTestOn(past("2026-10-20"), TODAY)).toBe(false);
  });

  it("an explicit routine-retest plan is planned, whatever its date", () => {
    expect(isPlannedTestOn({ id: "p1", isRoutineRetestPlan: true, date: "2026-09-20T12:00:00.000Z" }, TODAY)).toBe(true);
  });

  it("a record with no date is not planned", () => {
    expect(isPlannedTestOn({ id: "x", date: null }, TODAY)).toBe(false);
    expect(isPlannedTestOn({ id: "x" }, TODAY)).toBe(false);
    expect(isPlannedTestOn(null, TODAY)).toBe(false);
  });

  it("isCompletedTestRecord is the same rule, and it also excludes archived records", () => {
    expect(isCompletedTestRecordOn(future("2026-11-01"), TODAY)).toBe(false);
    expect(isCompletedTestRecordOn(past("2026-09-01"), TODAY)).toBe(true);
    expect(isCompletedTestRecordOn({ id: "a", date: "2026-09-01T09:00:00.000Z", isArchived: true }, TODAY)).toBe(false);
  });

  it("the ONE-argument form is safe to hand to .filter(), and reads the real clock", () => {
    // THE TRAP, pinned as a test. `Array.prototype.filter` calls its
    // predicate with (element, INDEX, array), so a two-argument predicate
    // handed straight to `.filter()` silently receives the index as its
    // second argument - and with "today" as that argument, every record
    // compared as `day > 0` is false, every test looks COMPLETED, and the
    // future-dated HIV test wins the "latest test" race exactly as it did
    // before this change. The dates here are far enough apart that the
    // result does not depend on when the suite is run.
    const tests = [future("2099-01-01T09:00:00.000Z"), past("2020-01-01T09:00:00.000Z")];
    const completed = tests.filter(isCompletedTestRecord);
    expect(completed.length).toBe(1);
    expect(completed[0].id).toBe("t2");
    // And the same trap, the other way round: a two-argument predicate must
    // not be passed to .filter() anywhere in the app.
    expect(isPlannedTest(future("2099-01-01T09:00:00.000Z"))).toBe(true);
    expect(isPlannedTest(past("2020-01-01T09:00:00.000Z"))).toBe(false);
  });
});

describe("the derived HIV status ignores a planned test", () => {
  const results = new Map([["r1", "Negative"]]);
  const hivTest = (day, extra = {}) => ({
    id: "h1",
    date: `${day}T09:00:00.000Z`,
    testingFor: ["HIV"],
    resultIds: ["r1"],
    ...extra,
  });

  it("a future-dated HIV test does not become the latest HIV test", () => {
    // THE CASE THAT MATTERED. A scheduled HIV retest must not overwrite the
    // fact of the last real one - and must not make the profile read
    // "untested" either.
    const real = { ...hivTest("2026-06-01"), id: "h-real" };
    const planned = { ...hivTest("2027-01-20"), id: "h-planned" };
    const derived = deriveHivStatus([real, planned], results);
    expect(derived.status, "a planned retest must not decide anybody's HIV status").toBe("negative");
    expect(derived.since).toBe("2026-06-01T09:00:00.000Z");
  });

  it("a plan that screens for HIV is not a test of it", () => {
    const plan = { id: "h-plan", date: "2027-01-20T09:00:00.000Z", testingFor: ["HIV"], resultIds: [], isRoutineRetestPlan: true };
    const derived = deriveHivStatus([plan], results);
    expect(derived.status).toBe("untested");
    expect(derived.since).toBeNull();
  });

  it("a real negative test is still the source of the status", () => {
    const derived = deriveHivStatus([hivTest("2026-06-01")], results);
    expect(derived.status).toBe("negative");
  });
});

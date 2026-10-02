// hivStatusCalculations.test.js
//
// The one thing this file exists to prevent: HIV status being derived from a
// test that never screened for HIV. A negative chlamydia result says nothing
// about HIV, so a latest-test-wins rule over all tests would be confidently
// wrong about a medical fact. Every test below uses a result map and a date
// chosen so that the "wrong" answer is available and plausible.
import { describe, it, expect } from "vitest";
import {
  HIV_STATUS,
  DEFAULT_HIV_STATUS,
  HIV_STATUS_OPTIONS,
  isValidHivStatus,
  normaliseHivStatus,
  deriveHivStatus,
  resolveHivStatus,
  describeHivStatus,
  shouldMaskHivStatus,
} from "./hivStatusCalculations.js";

const MAP = new Map([
  ["r_pos", "Positive"],
  ["r_neg", "Negative"],
  ["r_pend", "Pending"],
  ["r_lost", "Lost sample"],
]);

const hivTest = (over = {}) => ({
  id: "t1",
  date: "2026-09-01T09:00:00.000Z",
  testingFor: ["HIV"],
  resultIds: ["r_neg"],
  ...over,
});

describe("only an HIV test may contribute", () => {
  it("ignores a later non-HIV test entirely", () => {
    // THE trap. A chlamydia test three weeks after a negative HIV test must
    // not become "the latest result".
    const tests = [
      hivTest({ id: "t_hiv", date: "2026-09-01T09:00:00.000Z", resultIds: ["r_neg"] }),
      { id: "t_other", date: "2026-09-20T09:00:00.000Z", testingFor: ["Chlamydia", "Gonorrhoea"], resultIds: ["r_pos"] },
    ];
    const out = deriveHivStatus(tests, MAP, []);
    expect(out.status).toBe(HIV_STATUS.NEGATIVE);
    expect(out.since).toBe("2026-09-01T09:00:00.000Z");
  });

  it("ignores a test with no testingFor at all", () => {
    const out = deriveHivStatus(
      [{ id: "t", date: "2026-09-20T09:00:00.000Z", resultIds: ["r_pos"] }],
      MAP,
      []
    );
    expect(out.status).toBe(HIV_STATUS.UNTESTED);
  });

  it("matches HIV case-insensitively, as the option list stores it", () => {
    const out = deriveHivStatus(
      [{ id: "t", date: "2026-09-01T09:00:00.000Z", testingFor: ["hiv"], resultIds: ["r_neg"] }],
      MAP,
      []
    );
    expect(out.status).toBe(HIV_STATUS.NEGATIVE);
  });

  it("reports untested when there is no HIV test at all", () => {
    const out = deriveHivStatus([], MAP, []);
    expect(out.status).toBe(DEFAULT_HIV_STATUS);
    expect(out.since).toBeNull();
    expect(out.source).toBe("no-hiv-test");
  });
});

describe("a result this app cannot read establishes nothing", () => {
  it("treats Pending as untested rather than guessing", () => {
    const out = deriveHivStatus([hivTest({ resultIds: ["r_pend"] })], MAP, []);
    expect(out.status).toBe(HIV_STATUS.UNTESTED);
    expect(out.since).toBeNull();
    expect(out.source).toBe("unreadable-result");
  });

  it("treats a lost sample the same way", () => {
    const out = deriveHivStatus([hivTest({ resultIds: ["r_lost"] })], MAP, []);
    expect(out.status).toBe(HIV_STATUS.UNTESTED);
  });
});

describe("the most recent HIV test wins", () => {
  it("uses the latest by date, not by array order", () => {
    const tests = [
      hivTest({ id: "newer", date: "2026-09-20T09:00:00.000Z", resultIds: ["r_pos"] }),
      hivTest({ id: "older", date: "2026-01-01T09:00:00.000Z", resultIds: ["r_neg"] }),
    ];
    expect(deriveHivStatus(tests, MAP, []).status).toBe(HIV_STATUS.POSITIVE_UNSUPPRESSED);
  });
});

describe("suppression needs a viral load, because a test cannot show it", () => {
  const positive = hivTest({ date: "2026-01-01T09:00:00.000Z", resultIds: ["r_pos"] });

  it("is unsuppressed when no viral load exists", () => {
    // "we do not know" must not render as "they are well". Suppressed is the
    // claim that needs evidence.
    const out = deriveHivStatus([positive], MAP, []);
    expect(out.status).toBe(HIV_STATUS.POSITIVE_UNSUPPRESSED);
  });

  it("is unsuppressed when a viral load is below the test date", () => {
    const out = deriveHivStatus([positive], MAP, [
      { type: "Viral load", value: 12, date: "2025-06-01T09:00:00.000Z" },
    ]);
    expect(out.status).toBe(HIV_STATUS.POSITIVE_UNSUPPRESSED);
  });

  it("is suppressed for a viral load at or after the test", () => {
    const out = deriveHivStatus([positive], MAP, [
      { type: "Viral load", value: 12, date: "2026-03-01T09:00:00.000Z" },
    ]);
    expect(out.status).toBe(HIV_STATUS.POSITIVE_SUPPRESSED);
  });

  it("accepts the lab's own wording, which is not always a number", () => {
    const out = deriveHivStatus([positive], MAP, [
      { type: "Viral load", value: "Undetectable", date: "2026-03-01T09:00:00.000Z" },
    ]);
    expect(out.status).toBe(HIV_STATUS.POSITIVE_SUPPRESSED);
  });

  it("uses the most recent viral load, not the best one", () => {
    const out = deriveHivStatus([positive], MAP, [
      { type: "Viral load", value: 10, date: "2026-02-01T09:00:00.000Z" },
      { type: "Viral load", value: 5000, date: "2026-08-01T09:00:00.000Z" },
    ]);
    expect(out.status).toBe(HIV_STATUS.POSITIVE_UNSUPPRESSED);
  });

  it("ignores measurements that are not viral loads", () => {
    const out = deriveHivStatus([positive], MAP, [
      { type: "Weight", value: 1, date: "2026-08-01T09:00:00.000Z" },
      { type: "CD4 count", value: 3, date: "2026-08-01T09:00:00.000Z" },
    ]);
    expect(out.status).toBe(HIV_STATUS.POSITIVE_UNSUPPRESSED);
  });
});

describe("a stated status overrides a derived one", () => {
  it("wins, because someone tested elsewhere has no record here", () => {
    // A derived-only field would say "untested" for a person on treatment,
    // which is the most damaging thing this feature can get wrong.
    const derived = { status: HIV_STATUS.UNTESTED, since: null };
    const out = resolveHivStatus(HIV_STATUS.POSITIVE_SUPPRESSED, derived);
    expect(out.status).toBe(HIV_STATUS.POSITIVE_SUPPRESSED);
    expect(out.since).toBeNull();
    expect(out.source).toBe("stated");
  });

  it("does not invent a date for a stated status", () => {
    const out = resolveHivStatus(HIV_STATUS.NEGATIVE, {
      status: HIV_STATUS.POSITIVE_UNSUPPRESSED,
      since: "2026-01-01T00:00:00.000Z",
    });
    expect(out.since).toBeNull();
  });

  it("falls through to the derived value when nothing is stated", () => {
    const derived = { status: HIV_STATUS.NEGATIVE, since: "2026-01-01T00:00:00.000Z" };
    expect(resolveHivStatus(undefined, derived).status).toBe(HIV_STATUS.NEGATIVE);
    expect(resolveHivStatus("nonsense", derived).status).toBe(HIV_STATUS.NEGATIVE);
  });
});

describe("defensive reads", () => {
  it("normalises anything unrecognised to untested", () => {
    for (const bad of [null, undefined, "", "POSITIVE", {}, 7]) {
      expect(normaliseHivStatus(bad)).toBe(DEFAULT_HIV_STATUS);
    }
  });

  it("exposes exactly the four states the owner specified", () => {
    expect(HIV_STATUS_OPTIONS.map((o) => o.value)).toEqual([
      "untested",
      "negative",
      "positive-suppressed",
      "positive-unsuppressed",
    ]);
    expect(isValidHivStatus("positive-suppressed")).toBe(true);
    expect(isValidHivStatus("positive")).toBe(false);
  });

  it("tolerates empty and malformed input without throwing", () => {
    expect(deriveHivStatus(null, null, null).status).toBe(DEFAULT_HIV_STATUS);
    expect(deriveHivStatus([], new Map()).status).toBe(DEFAULT_HIV_STATUS);
    expect(resolveHivStatus(null, null).status).toBe(DEFAULT_HIV_STATUS);
  });
});

describe("how it reads to a person", () => {
  it("includes the date the status was established", () => {
    const out = describeHivStatus({ status: HIV_STATUS.NEGATIVE, since: "2026-09-01T09:00:00.000Z" });
    expect(out).toMatch(/Negative/);
    expect(out).toMatch(/2026/);
  });

  it("says the date is unknown rather than omitting it", () => {
    // Otherwise a blank reads as "current", which is the opposite of true.
    //
    // WIDENED 1 Oct 2026, deliberately. The intent here is "a missing date must
    // be stated, not left blank", and it is now satisfied by a per-state
    // wording: an undated NEGATIVE reads "Last known negative, but no date
    // recorded...", an undated UNDETECTABLE says the same plus why it matters.
    // Both phrasings state the absence, so the assertion accepts either - the
    // load-bearing half is that the absence is SPOKEN, not elided.
    expect(describeHivStatus({ status: HIV_STATUS.POSITIVE_SUPPRESSED, since: null }))
      .toMatch(/no date recorded|date not recorded/);
  });

  it("never renders an undated NEGATIVE as a plain negative", () => {
    // The one direction of error this app can least afford. A negative is
    // time-bounded and a 4th-generation test has a window period, so undated it
    // is unquantifiable reassurance - and it reads as "you are clear".
    const out = describeHivStatus({ status: HIV_STATUS.NEGATIVE, since: null });
    expect(out).not.toBe("Negative");
    expect(out).not.toMatch(/^-Negative\b/);
    expect(out).toMatch(/unverified|out of date/i);
  });

  it("does not crash on a missing date string", () => {
    expect(describeHivStatus({ status: HIV_STATUS.NEGATIVE, since: "not-a-date" }))
      .toMatch(/date not recorded/);
  });
});

describe("anonymise mode", () => {
  it("masks it, because it is among the most sensitive facts held", () => {
    expect(shouldMaskHivStatus(true)).toBe(true);
    expect(shouldMaskHivStatus(false)).toBe(false);
  });
});

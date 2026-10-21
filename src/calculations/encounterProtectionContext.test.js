import { describe, it, expect } from "vitest";
import {
  inferDoxyPepStatus,
  inferPrepCoverage,
  findPrEPMedication,
  inferProtectionContext,
} from "./encounterProtectionContext";
import { DOXYPEP_STATUS_OPTIONS, PREP_COVERAGE_OPTIONS } from "../repositories/encounterRepository";

// t137: infer the encounter form's protection fields instead of asking.
//
// The dates are FIXED and the clock is passed in, so nothing here depends on
// the day the suite runs - a fixture dated "the future" is a bug waiting to
// happen, and this file is the one place it would show up.
const NOW = new Date("2026-10-21T12:00:00.000Z");

const dose = (date, extra = {}) => ({ type: "dose", date, voided: false, ...extra });

describe("the DoxyPEP status the app can infer", () => {
  it("a dose inside the 72h window means it was taken", () => {
    // The dose is 40 hours after the encounter: inside the 72-hour window and
    // outside a 24-hour one, so the test actually pins WHICH window the app
    // uses. A dose ten hours after would satisfy both and prove nothing -
    // and a mutation that shrank the window to 24 hours survived that version
    // of this test.
    const r = inferDoxyPepStatus({
      myPosition: ["Anal - giving"],
      date: "2026-10-18T22:00:00.000Z",
      doseLogs: [dose("2026-10-20T14:00:00.000Z")],
      now: NOW,
    });
    expect(r.value).toBe("Indicated - taken");
    expect(r.reason).toMatch(/72h/);
  });

  it("a qualifying encounter with the window still open means not yet taken", () => {
    const r = inferDoxyPepStatus({
      myPosition: ["Anal - receiving"],
      date: "2026-10-21T06:00:00.000Z",
      doseLogs: [],
      now: NOW,
    });
    expect(r.value).toBe("Indicated - not yet taken");
  });

  it("a qualifying encounter with the window closed and no dose means missed", () => {
    const r = inferDoxyPepStatus({
      myPosition: ["Anal - giving"],
      date: "2026-10-10T22:00:00.000Z",
      doseLogs: [],
      now: NOW,
    });
    expect(r.value).toBe("Indicated - missed window");
  });

  it("no qualifying position means not indicated", () => {
    const r = inferDoxyPepStatus({
      myPosition: ["Kissing"],
      date: "2026-10-20T22:00:00.000Z",
      doseLogs: [],
      now: NOW,
    });
    expect(r.value).toBe("Not indicated");
  });

  it("an EMPTY position field is missing information, not a finding", () => {
    // The dangerous case: saying "Not indicated" because the user has not
    // filled the positions in yet would invent an answer and record it.
    expect(
      inferDoxyPepStatus({ myPosition: [], date: "2026-10-20T22:00:00.000Z", doseLogs: [], now: NOW }),
    ).toBeNull();
  });

  it("a dose outside the window does not count", () => {
    // A dose five days later is for something else.
    const r = inferDoxyPepStatus({
      myPosition: ["Anal - giving"],
      date: "2026-10-01T22:00:00.000Z",
      doseLogs: [dose("2026-10-06T08:00:00.000Z")],
      now: NOW,
    });
    expect(r.value).toBe("Indicated - missed window");
  });

  it("a voided dose does not count", () => {
    const r = inferDoxyPepStatus({
      myPosition: ["Anal - giving"],
      date: "2026-10-20T22:00:00.000Z",
      doseLogs: [dose("2026-10-21T08:00:00.000Z", { voided: true })],
      now: NOW,
    });
    expect(r.value).not.toBe("Indicated - taken");
  });
});

describe("the PrEP coverage the app can infer", () => {
  it("no PrEP medication at all means not on PrEP", () => {
    const r = inferPrepCoverage({ doseLogs: [], hasPrEPMedication: false, at: NOW });
    expect(r.value).toBe("Not on PrEP");
  });

  it("four doses in a week means adequate daily", () => {
    const r = inferPrepCoverage({
      hasPrEPMedication: true,
      doseLogs: [
        dose("2026-10-16T09:00:00.000Z"),
        dose("2026-10-17T09:00:00.000Z"),
        dose("2026-10-18T09:00:00.000Z"),
        dose("2026-10-19T09:00:00.000Z"),
      ],
      now: NOW,
    });
    expect(r.value).toBe("Adequate - daily (≥4/week)");
  });

  it("a PrEP medication with no doses logged means a missed dose", () => {
    const r = inferPrepCoverage({ hasPrEPMedication: true, doseLogs: [], now: NOW });
    expect(r.value).toBe("Missed dose");
  });

  it("a PrEP medication under four weeks old cannot have reached four a week", () => {
    const r = inferPrepCoverage({
      hasPrEPMedication: true,
      doseLogs: [dose("2026-10-15T09:00:00.000Z"), dose("2026-10-18T09:00:00.000Z")],
      now: NOW,
    });
    expect(r.value).toBe("Inadequate/recently started");
  });

  it("a long-established PrEP medication with two doses this week means a missed dose", () => {
    const r = inferPrepCoverage({
      hasPrEPMedication: true,
      doseLogs: [
        dose("2026-06-01T09:00:00.000Z"),
        dose("2026-06-02T09:00:00.000Z"),
        dose("2026-10-16T09:00:00.000Z"),
        dose("2026-10-19T09:00:00.000Z"),
      ],
      now: NOW,
    });
    expect(r.value).toBe("Missed dose");
  });

  it("judged as of the ENCOUNTER's date, not of today", () => {
    // An encounter logged last week should reflect LAST week's coverage. With
    // the doses as they are, today they are adequate; as of the encounter
    // they are not.
    const doses = [
      dose("2026-10-16T09:00:00.000Z"),
      dose("2026-10-17T09:00:00.000Z"),
      dose("2026-10-18T09:00:00.000Z"),
      dose("2026-10-19T09:00:00.000Z"),
    ];
    expect(inferPrepCoverage({ hasPrEPMedication: true, doseLogs: doses, at: "2026-10-20T12:00:00.000Z" }).value)
      .toBe("Adequate - daily (≥4/week)");
    // A week later the window has moved, and those doses are no longer in it -
    // which is the property worth pinning. (What it becomes instead - a
    // missed dose, or "recently started" because the medication itself is
    // young - is the other rule's business, and both are right for their own
    // reasons.)
    expect(inferPrepCoverage({ hasPrEPMedication: true, doseLogs: doses, at: "2026-10-30T12:00:00.000Z" }).value)
      .not.toBe("Adequate - daily (≥4/week)");
  });
});

describe("the suggestions are always a value the form can actually take", () => {
  it("every inferred value is one of the form's own options", () => {
    const ctx = inferProtectionContext({
      myPosition: ["Anal - giving"],
      date: "2026-10-20T22:00:00.000Z",
      doseLogs: [dose("2026-10-21T08:00:00.000Z")],
      hasPrEPMedication: true,
      now: NOW,
    });
    expect(DOXYPEP_STATUS_OPTIONS).toContain(ctx.doxyPepStatus.value);
    expect(PREP_COVERAGE_OPTIONS).toContain(ctx.prepCoverage.value);
  });
});

describe("finding the PrEP medication", () => {
  it("matches PrEP by name and does not match the DoxyPEP one", () => {
    const meds = [
      { id: "m1", name: "Doxycycline (PEP)" },
      { id: "m2", name: "PrEP (Descovy)" },
      { id: "m3", name: "Vitamin D3" },
    ];
    expect(findPrEPMedication(meds).id).toBe("m2");
  });

  it("ignores an archived medication", () => {
    const meds = [{ id: "m1", name: "PrEP", isArchived: true }];
    expect(findPrEPMedication(meds)).toBeNull();
  });
});

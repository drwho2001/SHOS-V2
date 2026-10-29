import { describe, it, expect } from "vitest";
import {
  inferDoxyPepStatus,
  inferPrepCoverage,
  findPrEPMedication,
  inferProtectionContext,
  resolveDoxyPepDisplay,
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

  it("prepOverride=true forces on PrEP even without medication", () => {
    const r = inferPrepCoverage({ doseLogs: [], hasPrEPMedication: false, prepOverride: true, at: NOW });
    expect(r.value).not.toBe("Not on PrEP");
  });

  it("prepOverride=false forces not on PrEP even with medication", () => {
    const r = inferPrepCoverage({ doseLogs: [], hasPrEPMedication: true, prepOverride: false, at: NOW });
    expect(r.value).toBe("Not on PrEP");
  });

  it("forcePrEP and manualPrEP are respected as fallbacks", () => {
    const r1 = inferPrepCoverage({ doseLogs: [], hasPrEPMedication: false, forcePrEP: true, at: NOW });
    expect(r1.value).not.toBe("Not on PrEP");
    const r2 = inferPrepCoverage({ doseLogs: [], hasPrEPMedication: true, manualPrEP: false, at: NOW });
    expect(r2.value).toBe("Not on PrEP");
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

// t138: what the encounter's READ view shows for DoxyPEP.
//
// The field is no longer asked on the form, because DoxyPEP is retroactive
// and a stored answer goes stale. These cases are the whole reason the
// stored answer is not simply thrown away: a record created before the form
// stopped asking still carries what the user recorded, and the log may be
// incomplete (a dose taken and never logged).
describe("what the encounter's read view shows for DoxyPEP", () => {
  it("shows the derived answer when the record carries none", () => {
    const r = resolveDoxyPepDisplay({
      stored: "",
      derived: { value: "Indicated - not yet taken", reason: "the 72h window is still open" },
    });
    expect(r.value).toBe("Indicated - not yet taken");
    expect(r.note).toMatch(/medication log/);
  });

  it("shows an older record's own answer, without a note, when the log agrees", () => {
    const r = resolveDoxyPepDisplay({
      stored: "Indicated - taken",
      derived: { value: "Indicated - taken", reason: "a dose is logged within 72h" },
    });
    expect(r.value).toBe("Indicated - taken");
    expect(r.note).toBe("");
  });

  it("shows BOTH when the log and an older record disagree", () => {
    // The stored answer stays the headline - it is what the user recorded at
    // the time - and the log's current answer is shown beside it, because a
    // dose logged afterwards is new information, not a correction.
    const r = resolveDoxyPepDisplay({
      stored: "Indicated - not yet taken",
      derived: { value: "Indicated - taken", reason: "a dose is logged within 72h" },
    });
    expect(r.value).toBe("Indicated - not yet taken");
    expect(r.note).toContain("Indicated - taken");
    expect(r.note).toContain("a dose is logged within 72h");
  });

  it("keeps an older record's answer when the log can say nothing at all", () => {
    // No position recorded, so there is nothing to derive - the record's own
    // answer is all there is.
    const r = resolveDoxyPepDisplay({
      stored: "Not indicated",
      derived: null,
    });
    expect(r.value).toBe("Not indicated");
    expect(r.note).toBe("");
  });

  it("says nothing when there is neither a record nor a derivation", () => {
    const r = resolveDoxyPepDisplay({});
    expect(r.value).toBe("");
    expect(r.note).toBe("");
  });
});

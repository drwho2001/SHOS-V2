// t093 — the DoxyPEP widget's EVIDENCE line.
//
// The widget used to show a countdown with no explanation of what opened the
// window. getDoxyPepStatus already knew which encounter started it (it sorted
// them and read [0]) and threw that fact away; the widget then re-derived
// nothing and rendered a bare "Active / 18h 4m remaining".
//
// Two properties are load-bearing and are pinned here:
//
//   1. windowStartIso is the EARLIEST qualifying encounter since the last dose,
//      carried as the stored fake-UTC string. If it ever came back as the
//      latest, the widget would name the wrong event — and because the widget
//      shows this to the user as the reason a window exists, naming the wrong
//      event is a false statement about their own health.
//
//   2. evidenceAt crosses the bridge at FULL and is DROPPED at REDACTED. The
//      drop needs no code: fieldAllowed is default-deny and evidenceAt is not
//      in the doxyPepWindow allowlist. That is asserted rather than assumed,
//      because a field added to a payload silently not being sent is the exact
//      bug this repo has catalogued twice.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { getDoxyPepStatus } from "./doxyPepCalculations.js";
import { realTimestampFromStored } from "./dateInputHelpers.js";

vi.mock("../repositories/appPreferencesRepository.js", () => ({
  getPreferences: vi.fn(async () => ({ widgetPrivacy: {} })),
  savePreferences: vi.fn(async () => {}),
}));

// myPosition, NOT positions — isQualifyingEncounter reads encounter.myPosition.
// A fixture using the wrong field name fails OPEN (the array is empty, so
// nothing qualifies, so the window is inactive), which is exactly how a
// plausible-looking test can assert nothing at all.
const ORAL = { id: "e1", date: "2026-10-08T21:00:00.000Z", myPosition: ["Oral - giving"] };
const ANAL = { id: "e2", date: "2026-10-09T09:00:00.000Z", myPosition: ["Anal - receiving"] };

describe("getDoxyPepStatus — windowStartIso (t093 evidence)", () => {
  it("returns the EARLIEST qualifying encounter's stored date as windowStartIso", () => {
    // Deliberately unsorted input: the earlier event is passed second, so a
    // function that took the last element rather than the first after sorting
    // would return 09 Oct and this would fail.
    const status = getDoxyPepStatus([ANAL, ORAL], [], new Date("2026-10-09T10:00:00.000Z"));
    expect(status.active).toBe(true);
    expect(status.windowStartIso).toBe("2026-10-08T21:00:00.000Z");
  });

  it("windowStartIso agrees with windowStart, so the deadline maths cannot drift from the evidence", () => {
    const status = getDoxyPepStatus([ORAL], [], new Date("2026-10-09T10:00:00.000Z"));
    // windowStart is the epoch; windowStartIso is the stored string. They must
    // describe the same instant, which is why the evidence can never point at a
    // different event than the countdown.
    expect(status.windowStartIso).toBe("2026-10-08T21:00:00.000Z");
    // Compared through realTimestampFromStored, NOT new Date(...Z). The stored
    // string is one of this app's fake-UTC values (see dateInputHelpers.js):
    // the trailing Z is a deliberate lie, and the digits are local wall-clock.
    // Parsing it as UTC would shift the instant by the device's offset (1h in
    // BST) and fail for the wrong reason - the same bug the 72h deadline maths
    // already guards against at doxyPepCalculations.js:94-98.
    expect(status.windowStart).toBe(realTimestampFromStored("2026-10-08T21:00:00.000Z"));
  });

  it("still returns windowStartIso when the window is OVERDUE, not only while active", () => {
    // The evidence is most useful when the window has lapsed — that is when a
    // user asks "why is this still on my home screen". A version that only
    // attached it to the active branch would regress this silently.
    const status = getDoxyPepStatus([ORAL], [], new Date("2026-10-20T10:00:00.000Z"));
    expect(status.overdue).toBe(true);
    expect(status.windowStartIso).toBe("2026-10-08T21:00:00.000Z");
  });

  it("ignores encounters that predate the last dose — evidence names the event that OPENED the current window", () => {
    const doses = [{ id: "l1", type: "dose", date: "2026-10-09T00:00:00.000Z" }];
    // ORAL is before the dose, so it must not set windowStartIso; only ANAL counts.
    const status = getDoxyPepStatus([ORAL, ANAL], doses, new Date("2026-10-09T10:00:00.000Z"));
    expect(status.windowStartIso).toBe("2026-10-09T09:00:00.000Z");
  });

  it("returns no windowStartIso when there is no qualifying activity at all", () => {
    const status = getDoxyPepStatus([], [], new Date("2026-10-09T10:00:00.000Z"));
    expect(status.active).toBe(false);
    expect(status.windowStartIso).toBeUndefined();
  });
});

// The bridge filter. Faked in the PRODUCTION shape — the wrapper getWidgetBridge
// returns — because a bare-plugin fake would exercise wrapper-unwrapping code
// and pass against a function no caller reaches (L-062).
describe("DoxyPEP evidence across the bridge (t093)", () => {
  let fieldAllowed, sendWidgetUpdate, tierFor;

  beforeEach(async () => {
    vi.resetModules();
    const wp = await import("./widgetPrivacy.js");
    const wbu = await import("./widgetBridgeUpdate.js");
    fieldAllowed = wp.fieldAllowed;
    tierFor = wp.tierFor;
    sendWidgetUpdate = wbu.sendWidgetUpdate;
  });

  it("evidenceAt is DROPPED at the Redacted tier — an exposure date is identifying", () => {
    // The whole privacy decision, asserted directly rather than inferred from
    // "I didn't add it to the list". If a future edit adds evidenceAt to the
    // allowlist, this goes red.
    expect(fieldAllowed("doxyPepWindow", "evidenceAt", "redacted")).toBe(false);
  });

  it("evidenceAt PASSES at Full, like every full-tier field", () => {
    expect(fieldAllowed("doxyPepWindow", "evidenceAt", "full")).toBe(true);
  });

  it("sends evidenceAt across the bridge at Full tier", async () => {
    const plugin = { updateDoxyPEP: vi.fn(async () => {}) };
    const bridge = { plugin };
    await sendWidgetUpdate(bridge, "doxyPepWindow", "updateDoxyPEP", {
      status: "Active",
      category: "DoxyPEP",
      state: "Active",
      evidenceAt: "2026-10-08T21:00:00.000Z",
    }, "");
    const payload = plugin.updateDoxyPEP.mock.calls[0][0];
    expect(payload.evidenceAt).toBe("2026-10-08T21:00:00.000Z");
  });
});
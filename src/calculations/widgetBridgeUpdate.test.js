// The tier filter is the only thing standing between a payload and a lock
// screen, so it is tested as a boundary rather than as a convenience.
//
// The property that matters is NOT "the right fields are sent" - it is "no field
// is sent that the tier forbids, for any field name, without anyone having to
// remember to update a conditional". That is why fieldAllowed fails closed on an
// unlisted field rather than defaulting to allowed.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The repository is imported dynamically inside the helper, so it is mocked at
// the module boundary rather than stubbed inside the function.
vi.mock("../repositories/appPreferencesRepository.js", () => ({
  AppPreferencesRepository: { getPreferences: vi.fn() },
}));

import { AppPreferencesRepository } from "../repositories/appPreferencesRepository.js";
import { sendWidgetUpdate } from "./widgetBridgeUpdate.js";

/** A bridge that records exactly what each method was handed. */
// FIXED 5 Oct 2026 - this fake used to return a BARE plugin
  // ({ calls, [method]: fn }), which is the shape nothing in production ever
  // passes. Every real call site passes the WRAPPER that getWidgetBridge()
  // returns: { plugin: WidgetBridge }. sendWidgetUpdate indexed the wrapper
  // directly, so it returned false for every widget, forever - and every test
  // here still passed, because they were all exercising a shape that no caller
  // uses. That is the "wiring shipped but nothing calls it" class this repo has
  // recorded repeatedly, wearing a very convincing disguise: a green suite.
  //
  // So the fake now returns the PRODUCTION shape. `calls` hangs off the plugin,
  // exactly as a real Capacitor proxy would carry the methods there.
  function fakeBridge(method) {
    const plugin = { calls: [], [method]: (payload) => { plugin.calls.push(payload); return Promise.resolve(); } };
    return { plugin };
  }

const FULL = { medName: "Testosterone", nextDoseTime: "20:00" };

beforeEach(() => {
  AppPreferencesRepository.getPreferences.mockReset();
  AppPreferencesRepository.getPreferences.mockResolvedValue({ widgetPrivacy: {} });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("the tier is applied at the write boundary", () => {
  it("full sends everything, and says so", async () => {
    AppPreferencesRepository.getPreferences.mockResolvedValue({ widgetPrivacy: { nextDose: "full" } });
    const bridge = fakeBridge("updateNextDose");
    await sendWidgetUpdate(bridge, "nextDose", "updateNextDose", FULL);
    expect(bridge.plugin.calls[0]).toEqual({ medName: "Testosterone", nextDoseTime: "20:00", tier: "full" });
  });

  it("redacted drops the identifying fields and keeps the category", async () => {
    AppPreferencesRepository.getPreferences.mockResolvedValue({ widgetPrivacy: { nextDose: "redacted" } });
    const bridge = fakeBridge("updateNextDose");
    await sendWidgetUpdate(bridge, "nextDose", "updateNextDose", { ...FULL, category: "Medication" });
    // The medication name and the time are the entire disclosure.
    expect(bridge.plugin.calls[0].medName).toBeUndefined();
    expect(bridge.plugin.calls[0].nextDoseTime).toBeUndefined();
    expect(bridge.plugin.calls[0].category).toBe("Medication");
  });

  it("off sends NOTHING but the tier", async () => {
    AppPreferencesRepository.getPreferences.mockResolvedValue({ widgetPrivacy: { nextDose: "off" } });
    const bridge = fakeBridge("updateNextDose");
    await sendWidgetUpdate(bridge, "nextDose", "updateNextDose", FULL);
    // Not "send it and let the provider hide it" - a value that crosses the
    // bridge is a value in widget storage, and Off means it is not there.
    expect(bridge.plugin.calls[0]).toEqual({ tier: "off" });
  });

  it("an UNREADABLE stored value discloses nothing", async () => {
    // The fail-closed direction, end to end through the real filter. tierFor
    // unit-tests the resolution; this proves the resolution reaches the wire.
    AppPreferencesRepository.getPreferences.mockResolvedValue({ widgetPrivacy: { nextDose: "detailed" } });
    const bridge = fakeBridge("updateNextDose");
    await sendWidgetUpdate(bridge, "nextDose", "updateNextDose", FULL);
    expect(bridge.plugin.calls[0]).toEqual({ tier: "off" });
  });

  it("never configured uses the per-widget default, so a first run is not destructive", async () => {
    AppPreferencesRepository.getPreferences.mockResolvedValue({});
    const bridge = fakeBridge("updateNextDose");
    await sendWidgetUpdate(bridge, "nextDose", "updateNextDose", FULL);
    // nextDose defaults to full; a widget that silently went blank on upgrade
    // because the feature is new would be a hostile surprise.
    expect(bridge.plugin.calls[0]).toEqual({ ...FULL, tier: "full" });
  });

  it("an unreadable preference file is not a reason to disclose", async () => {
    AppPreferencesRepository.getPreferences.mockRejectedValue(new Error("vault locked"));
    const bridge = fakeBridge("updateNextDose");
    await sendWidgetUpdate(bridge, "nextDose", "updateNextDose", FULL);
    // Resolves to the safe per-widget default rather than throwing, because a
    // widget must not stop updating just because storage hiccuped.
    expect(bridge.plugin.calls[0].medName).toBe("Testosterone");
  });

  it("warns when a field is dropped, so a new field cannot be added silently", async () => {
    AppPreferencesRepository.getPreferences.mockResolvedValue({ widgetPrivacy: { nextDose: "redacted" } });
    const bridge = fakeBridge("updateNextDose");
    await sendWidgetUpdate(bridge, "nextDose", "updateNextDose", FULL);
    // A developer adding "doseStrength" to a payload needs to find out that it
    // is not being sent, rather than discovering it on a lock screen later.
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("medName"));
  });

  it("refuses a widget that has no tier, rather than passing through", async () => {
    // A pass-through here would be fail-open on a typo: sendWidgetUpdate(bridge,
    // "nextDosee", ...) would filter against no table and send everything.
    const bridge = fakeBridge("updateNextDose");
    await expect(sendWidgetUpdate(bridge, "nextDosee", "updateNextDose", FULL)).rejects.toThrow(/not a data widget/);
    expect(bridge.plugin.calls).toHaveLength(0);
  });

  it("no bridge means no send, and that is not an error", async () => {
    // Every call site today guards on `if (bridge && bridge.updateX)`, so this
    // is the normal web case and must stay silent.
    expect(await sendWidgetUpdate(null, "nextDose", "updateNextDose", FULL)).toBe(false);
  });

  it("a bridge missing this specific method is a no-op, not a throw", async () => {
    expect(await sendWidgetUpdate({}, "nextDose", "updateNextDose", FULL)).toBe(false);
  });
});

describe("the pre-formatted redacted line", () => {
  // This is the fix for the bug where a Redacted widget fell back to the
  // provider's placeholder and said "No active window" when a window was active.
  // The wording IS the privacy behaviour here, so it is tested directly rather
  // than only through the payload.
  it("is sent at redacted, and not at full or off", async () => {
    AppPreferencesRepository.getPreferences.mockResolvedValue({ widgetPrivacy: { nextDose: "redacted" } });
    const redacted = fakeBridge("updateNextDose");
    await sendWidgetUpdate(redacted, "nextDose", "updateNextDose", FULL, "Medication - due now");
    expect(redacted.plugin.calls[0].redactedText).toBe("Medication - due now");

    AppPreferencesRepository.getPreferences.mockResolvedValue({ widgetPrivacy: { nextDose: "full" } });
    const full = fakeBridge("updateNextDose");
    await sendWidgetUpdate(full, "nextDose", "updateNextDose", FULL, "Medication - due now");
    // At full the real fields are used; sending the line too would leave a
    // provider unable to tell which tier rendered it.
    expect(full.plugin.calls[0].redactedText).toBeUndefined();

    AppPreferencesRepository.getPreferences.mockResolvedValue({ widgetPrivacy: { nextDose: "off" } });
    const off = fakeBridge("updateNextDose");
    await sendWidgetUpdate(off, "nextDose", "updateNextDose", FULL, "Medication - due now");
    // Off sends nothing but the tier. An empty string here would still be a
    // value in widget storage.
    expect(off.plugin.calls[0]).toEqual({ tier: "off" });
  });
});

describe("the Next Dose redacted line is ELAPSED time, not an absolute instant", () => {
  // FIXED 6 Oct 2026. Found on the owner's phone, not by reading: the widget read
  // "Medication - in 497595h 0m". `countdownAt` is the absolute instant the dose
  // unlocks, and the formatter divided it by 60000, printing hours since 1970.
  //
  // This is the same class as the DoxyPEP clock bug below, arrived at from the
  // opposite end: there the FIXTURE moved and the function was right; here the
  // function never subtracted `now` at all, so the number was always wrong and
  // nothing about its shape said so.
  const NOW = new Date("2026-10-06T12:00:00.000Z").getTime();

  it("reads as hours remaining, not hours since 1970", async () => {
    const { nextDoseRedactedLine } = await import("./medicationReminderSync.js");
    const in5h = NOW + 5 * 3600000;
    expect(nextDoseRedactedLine(in5h, NOW)).toBe("Medication - in 5h 0m");
    // The exact owner-reported shape. 497595h is what an absolute timestamp
    // divided by 60000 looks like, so this asserts the magnitude explicitly.
    expect(nextDoseRedactedLine(NOW + 5 * 3600000, NOW)).not.toMatch(/\d{4,}h/);
  });

  it("uses minutes alone under an hour", async () => {
    const { nextDoseRedactedLine } = await import("./medicationReminderSync.js");
    expect(nextDoseRedactedLine(NOW + 7 * 60000, NOW)).toBe("Medication - in 7m");
    expect(nextDoseRedactedLine(NOW + 7 * 60000, NOW)).not.toMatch(/0h/);
  });

  it("reports a count when several medications are in play", async () => {
    // ADDED 7 Oct 2026. The owner's invariant: if a next dose is scheduled / going
    // to be alerted / notification fired, then it should definitely appear on the
    // next dose widget. With three tracked meds a card that only ever names one
    // implies the other two do not exist - and the widget took state.upcoming[0],
    // discarding the rest, which is exactly what the owner saw on their phone.
    //
    // A COUNT is explicitly permitted at a Redacted tier - "3 meds" names nobody -
    // so this satisfies the invariant without widening what the tier discloses.
    const { nextDoseRedactedLine } = await import("./medicationReminderSync.js");

    // Single medication: byte-identical to before, so the common case cannot regress.
    expect(nextDoseRedactedLine(NOW + 90 * 60000, NOW)).toBe("Medication - in 1h 30m");

    // Three: the count rides ALONGSIDE the countdown rather than replacing it -
    // losing the timing to add the count would be a worse trade than either alone.
    expect(nextDoseRedactedLine(NOW + 90 * 60000, NOW, 3)).toBe(
      "Medication - in 1h 30m - 3 meds",
    );
    // ...and on the two states a user is most likely to be looking at.
    expect(nextDoseRedactedLine(NOW - 5 * 60000, NOW, 2)).toBe("Medication - due now - 2 meds");
    expect(nextDoseRedactedLine(0, NOW, 2)).toBe("Medication - none due - 2 meds");
    expect(nextDoseRedactedLine(NOW + 3 * 86400000, NOW, 2)).toBe("Medication - in 3d - 2 meds");

    // A missing or nonsensical count must not produce "1 meds" or "NaN meds".
    for (const bad of [undefined, null, 0, 1, NaN, "x", {}]) {
      expect(
        nextDoseRedactedLine(NOW + 90 * 60000, NOW, bad),
        `a count of ${JSON.stringify(bad)} leaked into the line`,
      ).not.toMatch(/meds/);
    }

    // The count is a COUNT and nothing else. Asserted rather than trusted: this is
    // the disclosure boundary, and a mutation that interpolated a medication name
    // into the suffix would pass every other test here - the same failure four
    // earlier mutations had when the guard only checked a field was MENTIONED
    // rather than interpolated into the line.
    expect(nextDoseRedactedLine(NOW + 90 * 60000, NOW, 3)).not.toMatch(
      /Sertraline|PrEP|Vitamin|mg/i,
    );
  });

  it("buckets past a day into days rather than hundreds of hours", async () => {
    // Not only more readable: "in 960h" is the same unusable magnitude as the
    // bug, so a number too big to act on is functionally no information at all.
    const { nextDoseRedactedLine } = await import("./medicationReminderSync.js");
    expect(nextDoseRedactedLine(NOW + 40 * 24 * 3600000, NOW)).toBe("Medication - in 40d");
  });

  it("says due now once the unlock instant has passed", async () => {
    // Before this fix a passed instant printed a huge NEGATIVE-derived hour
    // count; the provider's Chronometer was hidden in that state, so the whole
    // line was the only thing the user saw.
    const { nextDoseRedactedLine } = await import("./medicationReminderSync.js");
    expect(nextDoseRedactedLine(NOW - 60000, NOW)).toBe("Medication - due now");
  });

  it("still handles no dose at all, and unusable input", async () => {
    const { nextDoseRedactedLine } = await import("./medicationReminderSync.js");
    expect(nextDoseRedactedLine(null, NOW)).toBe("Medication - none due");
    expect(nextDoseRedactedLine(undefined, NOW)).toBe("Medication - none due");
    expect(nextDoseRedactedLine("not a number", NOW)).toBe("Medication - none due");
  });
});

describe("the Appointments redacted line carries a relative day bucket", () => {
  // CHANGED 6 Oct 2026 - the owner reported "Appointments - 1 upcoming" as not
  // giving enough confidence to keep using the widget. A bare count answers "is
  // anything on" and not "do I need to act", so the line now says how far off it
  // is in ELAPSED days, which is the distinction widgetPrivacy.js already makes
  // for the two countdowns.
  //
  // Imported inside each `it` for the same reason the DoxyPEP tests below do:
  // a top-level `await import` sits in a describe callback, which is not async,
  // and fails to parse.
  const NOW = new Date("2026-10-06T12:00:00.000Z");

  it("states how far off the soonest visit is, without naming a date", async () => {
    const { appointmentRedactedLine } = await import("./clinicVisitReminderSync.js");
    expect(appointmentRedactedLine(1, "2026-10-09T09:30:00.000Z", NOW)).toBe("Appointments - 1 booked - in 3 days");
    // The privacy property, asserted directly: no month, no weekday, no hour.
    expect(appointmentRedactedLine(1, "2026-10-09T09:30:00.000Z", NOW)).not.toMatch(/Oct|October|Mon|Tue|09:30/);
  });

  it("says today and tomorrow in words rather than 'in 0 days'", async () => {
    const { appointmentRedactedLine } = await import("./clinicVisitReminderSync.js");
    expect(appointmentRedactedLine(1, "2026-10-06T09:30:00.000Z", NOW)).toBe("Appointments - 1 booked - today");
    expect(appointmentRedactedLine(1, "2026-10-07T09:30:00.000Z", NOW)).toBe("Appointments - 1 booked - tomorrow");
    expect(appointmentRedactedLine(1, "2026-10-06T09:30:00.000Z", NOW)).not.toMatch(/in 0 days/);
  });

  it("counts every booked visit, not just whether one exists", async () => {
    const { appointmentRedactedLine } = await import("./clinicVisitReminderSync.js");
    expect(appointmentRedactedLine(3, "2026-10-09T09:30:00.000Z", NOW)).toBe("Appointments - 3 booked - in 3 days");
  });

  it("still answers honestly with nothing booked, or no usable date", async () => {
    const { appointmentRedactedLine } = await import("./clinicVisitReminderSync.js");
    expect(appointmentRedactedLine(0, null, NOW)).toBe("Appointments - none booked");
    expect(appointmentRedactedLine(undefined, undefined, NOW)).toBe("Appointments - none booked");
    expect(appointmentRedactedLine(1, "", NOW)).toBe("Appointments - 1 booked");
    expect(appointmentRedactedLine(1, "not a date", NOW)).toBe("Appointments - 1 booked");
  });
});

describe("the DoxyPEP redacted line", () => {
  // CHANGED 2 Oct 2026. This suite originally FAILED, and the reason is the
  // clock bug this repo has now recorded several times: the fixture built its
  // deadline as `Date.now() + 5h` and the function then called `Date.now()` again.
  // The milliseconds in between make the remaining time 4h 59m 59.999s, whose
  // Math.floor is 4 - so the assertion expected "in 5h" and got "in 4h 59m",
  // intermittently, depending on how fast the machine ran.
  //
  // Fixed by pinning the clock rather than by loosening the assertion or adding
  // a margin, for the reason the other clock tests here already use one: a
  // margin makes a test pass that would fail for the wrong reason, and a
  // pinned clock makes the answer the same at 04:48 as at 11:15.
  //
  // toFake is restricted to Date deliberately. Faking setTimeout as well could
  // stall the promise-based tests in this file that share the describe.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T12:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("never says there is no window when there is one", async () => {
    const { doxyPepRedactedLine } = await import("./doxyPepSync.js");
    const active = { overdue: false, active: true, deadline: new Date(Date.now() + 5 * 3600000) };
    expect(doxyPepRedactedLine(active)).toBe("Antibiotics - in 5h 0m");
    // The specific regression: the old behaviour rendered the provider's
    // placeholder, which reads "No active window".
    expect(doxyPepRedactedLine(active)).not.toMatch(/no active window/i);
  });

  it("reports the genuinely-inactive and overdue cases honestly", async () => {
    const { doxyPepRedactedLine } = await import("./doxyPepSync.js");
    expect(doxyPepRedactedLine({ overdue: true, active: false })).toBe("Antibiotics - window overdue");
    expect(doxyPepRedactedLine({ overdue: false, active: false })).toBe("Antibiotics - no window");
    // Active but with no deadline must not claim a countdown it does not have.
    expect(doxyPepRedactedLine({ overdue: false, active: true })).toBe("Antibiotics - window active");
  });

  it("uses minutes alone under an hour, not '0h'", async () => {
    const { doxyPepRedactedLine } = await import("./doxyPepSync.js");
    const soon = { overdue: false, active: true, deadline: new Date(Date.now() + 7 * 60000) };
    expect(doxyPepRedactedLine(soon)).toBe("Antibiotics - in 7m");
    expect(doxyPepRedactedLine(soon)).not.toMatch(/0h/);
  });
});

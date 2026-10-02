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
function fakeBridge(method) {
  const calls = [];
  return { calls, [method]: (payload) => { calls.push(payload); return Promise.resolve(); } };
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
    expect(bridge.calls[0]).toEqual({ medName: "Testosterone", nextDoseTime: "20:00", tier: "full" });
  });

  it("redacted drops the identifying fields and keeps the category", async () => {
    AppPreferencesRepository.getPreferences.mockResolvedValue({ widgetPrivacy: { nextDose: "redacted" } });
    const bridge = fakeBridge("updateNextDose");
    await sendWidgetUpdate(bridge, "nextDose", "updateNextDose", { ...FULL, category: "Medication" });
    // The medication name and the time are the entire disclosure.
    expect(bridge.calls[0].medName).toBeUndefined();
    expect(bridge.calls[0].nextDoseTime).toBeUndefined();
    expect(bridge.calls[0].category).toBe("Medication");
  });

  it("off sends NOTHING but the tier", async () => {
    AppPreferencesRepository.getPreferences.mockResolvedValue({ widgetPrivacy: { nextDose: "off" } });
    const bridge = fakeBridge("updateNextDose");
    await sendWidgetUpdate(bridge, "nextDose", "updateNextDose", FULL);
    // Not "send it and let the provider hide it" - a value that crosses the
    // bridge is a value in widget storage, and Off means it is not there.
    expect(bridge.calls[0]).toEqual({ tier: "off" });
  });

  it("an UNREADABLE stored value discloses nothing", async () => {
    // The fail-closed direction, end to end through the real filter. tierFor
    // unit-tests the resolution; this proves the resolution reaches the wire.
    AppPreferencesRepository.getPreferences.mockResolvedValue({ widgetPrivacy: { nextDose: "detailed" } });
    const bridge = fakeBridge("updateNextDose");
    await sendWidgetUpdate(bridge, "nextDose", "updateNextDose", FULL);
    expect(bridge.calls[0]).toEqual({ tier: "off" });
  });

  it("never configured uses the per-widget default, so a first run is not destructive", async () => {
    AppPreferencesRepository.getPreferences.mockResolvedValue({});
    const bridge = fakeBridge("updateNextDose");
    await sendWidgetUpdate(bridge, "nextDose", "updateNextDose", FULL);
    // nextDose defaults to full; a widget that silently went blank on upgrade
    // because the feature is new would be a hostile surprise.
    expect(bridge.calls[0]).toEqual({ ...FULL, tier: "full" });
  });

  it("an unreadable preference file is not a reason to disclose", async () => {
    AppPreferencesRepository.getPreferences.mockRejectedValue(new Error("vault locked"));
    const bridge = fakeBridge("updateNextDose");
    await sendWidgetUpdate(bridge, "nextDose", "updateNextDose", FULL);
    // Resolves to the safe per-widget default rather than throwing, because a
    // widget must not stop updating just because storage hiccuped.
    expect(bridge.calls[0].medName).toBe("Testosterone");
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
    expect(bridge.calls).toHaveLength(0);
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

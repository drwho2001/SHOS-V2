// reminderSuppressionMaster.test.js
//
// The master off-switch is the one control that has to reach FIVE banner call
// sites and FIVE device-silence call sites, and every one of them was written
// before the switch existed. The likely way this ships half-done is some sites
// honouring it and others not, so both halves are asserted, and the count is
// asserted rather than the shape.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  isBannerVisible,
  shouldSuppressDeviceNotification,
  ACK_SCOPE,
} from "./reminderSuppression.js";
import { DEFAULT_APP_PREFERENCES } from "../repositories/appPreferencesRepository.js";
import { globSync } from "node:fs";

const CALC = path.join(process.cwd(), "src", "calculations");
const APP = readFileSync(path.join(process.cwd(), "src", "App.jsx"), "utf8");
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// The import line names the function but has no "(" after it, so the call regex
// does not match it - subtracting one for it (which the first version did)
// made every file count zero. And a relative glob is needed because the
// absolute Windows path does not match here.
const SYNC = globSync("src/calculations/*ReminderSync.js").map((f) => ({
  name: path.basename(f),
  src: readFileSync(f, "utf8"),
}));

describe("the switch defaults to ON", () => {
  it("ships enabled, because the feature shipped enabled", () => {
    // A default of false would silently stop hiding reminders for a user who
    // never asked it to - "the app stopped doing the thing I set up" is not an
    // expected consequence of updating.
    expect(DEFAULT_APP_PREFERENCES.reminderSuppressionEnabled).toBe(true);
  });

  it("reads as enabled for a backup written before the field existed", () => {
    // A real assertion, not `expect(undefined !== false)`, which the first
    // version of this test had - a constant expression that proves nothing about
    // the app and reads as coverage. What actually matters is that the READS
    // are written as `!== false`, so a missing field means enabled. That is
    // asserted against the real call sites in "the switch reaches every call
    // site" below; here we only pin the default that the merge produces.
    const restored = { ...DEFAULT_APP_PREFERENCES };
    delete restored.reminderSuppressionEnabled;
    // Defensive-default merge on read, CLAUDE.md's standing rule: a field the
    // stored object lacks takes the default.
    expect({ ...DEFAULT_APP_PREFERENCES, ...restored }.reminderSuppressionEnabled).toBe(true);
  });
});

describe("off means banners are never hidden", () => {
  const state = {
    dueCount: 1,
    signature: "sig-1",
    sessionDismissed: ["sig-1"],
    acknowledged: ["sig-1"],
  };

  it("shows the banner even when it is acknowledged and session-dismissed", () => {
    expect(isBannerVisible({ ...state, featureEnabled: true })).toBe(false);
    expect(isBannerVisible({ ...state, featureEnabled: false })).toBe(true);
  });

  it("still hides it when nothing is actually due", () => {
    // "Off" must not become "always show everything" - a banner with no due
    // item behind it is noise, and noise is the problem this feature fixes.
    expect(isBannerVisible({ ...state, dueCount: 0, featureEnabled: false })).toBe(false);
  });

  it("defaults to enabled when the field is absent", () => {
    expect(isBannerVisible(state)).toBe(false);
    expect(isBannerVisible({ ...state, signature: "other" })).toBe(true);
  });
});

describe("off also means the PHONE is not silenced", () => {
  const acks = [{ signature: "sig-1", scope: ACK_SCOPE.BOTH }];

  it("does not cancel the device notification when disabled", () => {
    // The half that matters most: a switch that hides the banner but leaves
    // the alarm going is a switch that half works, and the half still
    // disclosing is the half the user turned it off to stop.
    expect(shouldSuppressDeviceNotification("sig-1", acks, true)).toBe(true);
    expect(shouldSuppressDeviceNotification("sig-1", acks, false)).toBe(false);
  });

  it("defaults to enabled when the field is absent", () => {
    expect(shouldSuppressDeviceNotification("sig-1", acks)).toBe(true);
  });
});

describe("the switch reaches every call site", () => {
  it("all five device-silence call sites pass it", () => {
    // Counted, not pattern-matched: the two shapes (single-line and multi-line)
    // are why an earlier scripted pass silently missed one.
    const sites = SYNC.map((f) => ({
      name: f.name,
      src: f.src,
      n: (f.src.match(/shouldSuppressDeviceNotification\(/g) || []).length,
    })).filter((f) => f.n > 0);
    expect(sites.length, "expected five reminder types").toBe(5);
    for (const s of sites) {
      const passed = (s.src.match(/acknowledged,\s*appPrefs\.reminderSuppressionEnabled/g) || []).length;
      expect(passed, `${s.name} does not pass the switch`).toBe(s.n);
    }
  });

  it("the banner funnel passes it, so all five banners are covered at once", () => {
    // suppressState is the single helper every banner goes through, so this one
    // line is what covers all five. If a future banner is added that calls
    // isBannerVisible directly instead, this stops being true - which is why
    // the banner count is asserted separately.
    const fn = codeOnly(APP).match(/const suppressState\s*=\s*\([^)]*\)\s*=>\s*\(\{[\s\S]*?\}\)/);
    expect(fn, "suppressState not found in App.jsx").toBeTruthy();
    expect(fn[0]).toMatch(/featureEnabled:\s*reminderSuppressionEnabled/);
    const banners = (codeOnly(APP).match(/isBannerVisible\(/g) || []).length;
    expect(banners, "expected five banner call sites").toBe(5);
  });

  it("the value read from preferences treats a missing field as enabled", () => {
    // A bare `=== true` here would read an older backup as DISABLED and quietly
    // turn the feature off for exactly the users who set it up longest ago.
    expect(codeOnly(APP)).toMatch(/reminderSuppressionEnabled\s*!==\s*false/);
    expect(APP).toMatch(/setReminderSuppressionEnabled\(prefs\.reminderSuppressionEnabled\s*!==\s*false\)/);
  });
});

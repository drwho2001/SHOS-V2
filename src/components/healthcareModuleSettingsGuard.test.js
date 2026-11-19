// healthcareModuleSettingsGuard.test.js — 19 Nov 2026 owner ask: Healthcare
// has its own settings (which tabs show, reproductive tracking, pregnancy tab
// visibility) but they lived in general Preferences. Now they follow the
// Contacts/Medication pattern: a gear on the Healthcare title banner opens a
// module-owned screen, and they are not duplicated in Preferences.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (f) => readFileSync(path.join(process.cwd(), f), "utf8");

describe("Healthcare module settings", () => {
  const hc = read("src/modules/SHOS_Healthcare_Prototype.jsx");
  const screen = read("src/modules/settings/HealthcareSettingsScreen.jsx");
  const prefs = read("src/modules/settings/PreferencesScreen.jsx");

  it("the banner carries a gear wired to the module settings screen", () => {
    expect(hc).toMatch(/aria-label=\{tr\("healthcare\.settings", "Healthcare settings"\)\}/);
    expect(hc).toMatch(/setShowHealthcareSettings\(true\)/);
    expect(hc).toMatch(/<HealthcareSettingsScreen onClose=/);
  });

  it("preference changes reload the tab row and reproductive toggle in place", () => {
    expect(hc).toMatch(/\[healthcarePrefsVersion\], false\)/);
    expect(hc).toMatch(/\[healthcarePrefsVersion\], null\)/);
  });

  it("the module screen owns both cards and general Preferences no longer does", () => {
    expect(screen).toMatch(/function HealthcareTabsCard/);
    expect(screen).toMatch(/function MenstrualTrackingToggleCard/);
    expect(prefs).not.toMatch(/function HealthcareTabsCard/);
    expect(prefs).not.toMatch(/function MenstrualTrackingToggleCard/);
  });

  it("the new screen introduces no raw hex colour", () => {
    expect(screen).not.toMatch(/#[\dA-Fa-f]{6}/);
  });
});

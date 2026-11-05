import { describe, it, expect } from "vitest";
import {
  SETTING_OPTIONS,
  normaliseSetting,
  settingLabel,
  isHomeSetting,
  isClinicSetting,
} from "./testingSettings.js";

// B7. The field used to store its own display string, emoji included. These
// tests pin the two halves that matter: the stable key is what storage gets,
// and every legacy value still renders and branches correctly.
describe("Testing Setting keys", () => {
  it("exposes one option per stable key, with no emoji in the stored value", () => {
    expect(SETTING_OPTIONS.map((o) => o.value)).toEqual([
      "clinicRoutine",
      "clinicSymptomatic",
      "clinicPositive",
      "home",
    ]);
    for (const option of SETTING_OPTIONS) {
      // The value is data. If an emoji ever comes back into it, this fails
      // rather than silently reintroducing the defect B7 exists to remove.
      expect(option.value).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(option.label.length).toBeGreaterThan(0);
    }
  });

  it("leaves current keys unchanged", () => {
    for (const option of SETTING_OPTIONS) {
      expect(normaliseSetting(option.value)).toBe(option.value);
      expect(settingLabel(option.value)).toBe(option.label);
    }
  });

  it("migrates every legacy display string that shipped, emoji included", () => {
    // Both emoji shapes are covered deliberately: the audit quoted "🏠 Home"
    // and "🏥 Clinic - Routine", while the shipped repository used a place
    // glyph plus a mood glyph. Matching the label suffix handles both.
    expect(normaliseSetting("🏠 Home")).toBe("home");
    expect(normaliseSetting("🏥😎 Clinic - Routine")).toBe("clinicRoutine");
    expect(normaliseSetting("🏥🤢 Clinic - Symptomatic")).toBe("clinicSymptomatic");
    expect(normaliseSetting("🏥➕ Clinic - Positive test")).toBe("clinicPositive");
    expect(normaliseSetting("Clinic - Routine")).toBe("clinicRoutine");
  });

  it("renders a label for a legacy value that has not been migrated yet", () => {
    expect(settingLabel("🏠 Home")).toBe("Home");
    expect(settingLabel("🏥😎 Clinic - Routine")).toBe("Clinic - Routine");
  });

  it("does not destroy an unrecognised value", () => {
    // A field the owner typed into an old build (or a future option) must not
    // be blanked by a migration that only knows today's labels.
    expect(normaliseSetting("Somewhere else")).toBe("Somewhere else");
    expect(settingLabel("Somewhere else")).toBe("Somewhere else");
  });

  it("handles empty and non-string input without throwing", () => {
    expect(normaliseSetting("")).toBe("");
    expect(normaliseSetting(null)).toBe("");
    expect(normaliseSetting(undefined)).toBe("");
    expect(settingLabel(null)).toBe("");
  });

  it("branches the home-kit UI for both the key and the legacy string", () => {
    expect(isHomeSetting("home")).toBe(true);
    expect(isHomeSetting("🏠 Home")).toBe(true);
    expect(isHomeSetting("clinicRoutine")).toBe(false);
    expect(isClinicSetting("clinicRoutine")).toBe(true);
    expect(isClinicSetting("🏥😎 Clinic - Routine")).toBe(true);
    expect(isClinicSetting("home")).toBe(false);
    expect(isClinicSetting("")).toBe(false);
  });
});

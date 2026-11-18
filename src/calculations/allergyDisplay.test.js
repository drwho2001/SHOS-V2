// R4 (18 Nov) — NKDA/None/N/A is a positive clear state, not a warning.
import { describe, it, expect } from "vitest";
import { isNoAllergyValue, hasNoAllergies, allergyTone, noAllergyLabel } from "./allergyDisplay.js";

describe("allergy display tone", () => {
  it("recognises the no-allergy sentinels case-insensitively", () => {
    for (const v of ["NKDA", "nkda", "None", "N/A", "n/a", "Nil", "No known allergies", "not recorded", "Unknown", "None known"]) {
      expect(isNoAllergyValue(v), v).toBe(true);
    }
  });

  it("does not treat real allergies as clear", () => {
    for (const v of ["Penicillin", "Latex", "Peanuts", "Shellfish", ""] ) {
      expect(isNoAllergyValue(v), v).toBe(false);
    }
  });

  it("treats an empty list or all-sentinel list as clear", () => {
    expect(hasNoAllergies([])).toBe(true);
    expect(hasNoAllergies(["NKDA"])).toBe(true);
    expect(hasNoAllergies(["None", "N/A"])).toBe(true);
    expect(hasNoAllergies(["Penicillin", "NKDA"])).toBe(false);
    expect(hasNoAllergies(["Penicillin"])).toBe(false);
  });

  it("exposes a single tone every surface can share", () => {
    expect(allergyTone([])).toBe("clear");
    expect(allergyTone(["N/A"])).toBe("clear");
    expect(allergyTone(["Penicillin"])).toBe("alert");
  });

  it("keeps the recorded wording (or a plain empty label)", () => {
    expect(noAllergyLabel(["NKDA"])).toBe("NKDA");
    expect(noAllergyLabel([])).toBe("None recorded");
  });
});

// B2 (18 Nov 2026) — local measurement-type suggestion bank.
// Owner's complaint: "What kind of measurement is eGFR?" is unanswerable.
// The bank must suggest a sensible type + unit from a curated ON-DEVICE list,
// never guess silently, and never override the user's own known types.
import { describe, it, expect } from "vitest";
import { MEASUREMENT_TYPE_BANK, findBankMatch } from "./measurementTypeBank.js";
import { findClosestMatch } from "./fuzzyMatch.js";

describe("measurement type bank", () => {
  it("covers the common labs named in the design (UK-first units)", () => {
    const byName = Object.fromEntries(MEASUREMENT_TYPE_BANK.map((e) => [e.name, e]));
    expect(byName.eGFR.unit).toBe("mL/min/1.73m²");
    expect(byName.Creatinine.unit).toBe("µmol/L");
    expect(byName.Glucose.unit).toBe("mmol/L");
    expect(byName.HbA1c.unit).toBe("mmol/mol");
    for (const name of ["eGFR", "Creatinine", "Glucose", "HbA1c", "TSH", "Cholesterol"]) {
      expect(byName[name], `${name} missing`).toBeTruthy();
      expect(byName[name].kind).toBeTruthy();
      expect(byName[name].unit).toBeTruthy();
    }
  });

  it("suggests eGFR from a lowercase typing or a typo", () => {
    expect(findBankMatch("egfr", [])?.name).toBe("eGFR");
    expect(findBankMatch("e G F R", [])?.name).toBe("eGFR");
    expect(findBankMatch("egfrr", [])?.name).toBe("eGFR");
    expect(findBankMatch("estimated glomerular filtration rate", [])?.name).toBe("eGFR");
  });

  it("matches common aliases, not just the canonical name", () => {
    expect(findBankMatch("blood sugar", [])?.name).toBe("Glucose");
    expect(findBankMatch("haemoglobin a1c", [])?.name).toBe("HbA1c");
    expect(findBankMatch("serum creatinine", [])?.name).toBe("Creatinine");
  });

  it("does not override a type the user already knows", () => {
    expect(findBankMatch("egfr", ["eGFR"])).toBeNull();
    expect(findBankMatch("egfr", ["egfr"])).toBeNull();
    expect(findBankMatch("glucose", ["Glucose"])).toBeNull();
  });

  it("does not suggest for empty or unrelated text", () => {
    expect(findBankMatch("", [])).toBeNull();
    expect(findBankMatch("   ", [])).toBeNull();
    expect(findBankMatch("hip replacement", [])).toBeNull();
  });

  it("uses the shared fuzzy distance rules (short strings are not guessed)", () => {
    // "eg" is two chars: findClosestMatch refuses to fuzzy-match short words,
    // so a single stray letter must never silently become a lab type.
    expect(findClosestMatch(["eGFR", "egfr"], "eg")).toBeNull();
    expect(findBankMatch("eg", [])).toBeNull();
  });

  it("is a pure local lookup — no network, no clinical values", () => {
    const text = MEASUREMENT_TYPE_BANK.map((e) => JSON.stringify(e)).join(" ");
    expect(text).not.toMatch(/http|fetch|range|normal|abnormal|diagnos/i);
  });
});

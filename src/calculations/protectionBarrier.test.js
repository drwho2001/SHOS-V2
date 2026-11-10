// protectionBarrier.test.js
//
// The "No barrier method" chip is derived from the NAMES in the Protection
// registry, which is user-editable. These cases pin the two ways a name match
// goes wrong: a negated barrier ("No condom") being read as a barrier, and a
// non-barrier word ("Amsterdam") matching the bare "dam" alternative.
import { describe, it, expect } from "vitest";
import { isBarrierMethod, hasBarrierMethod, NO_BARRIER_LABEL } from "./protectionBarrier.js";

describe("isBarrierMethod", () => {
  it.each(["Condom", "condoms", "Internal condom", "Femidom", "Dental dam", "dam", "Dams"])(
    "treats %s as a barrier",
    (name) => {
      expect(isBarrierMethod(name)).toBe(true);
    }
  );

  it.each(["PrEP", "PEP", "None", "No barrier", "No condom", "without a condom", "never used a dam"])(
    "does not treat %s as a barrier",
    (name) => {
      expect(isBarrierMethod(name)).toBe(false);
    }
  );

  it("does not match a barrier word inside an unrelated word", () => {
    expect(isBarrierMethod("Amsterdam")).toBe(false);
    expect(isBarrierMethod("Dampier")).toBe(false);
    expect(isBarrierMethod("damn")).toBe(false);
  });

  it("counts a combined entry when a barrier is present", () => {
    expect(isBarrierMethod("Condom + PrEP")).toBe(true);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(isBarrierMethod("  CONDOM  ")).toBe(true);
    expect(isBarrierMethod("  prep  ")).toBe(false);
  });

  it("treats empty and non-string values as not a barrier", () => {
    expect(isBarrierMethod("")).toBe(false);
    expect(isBarrierMethod(null)).toBe(false);
    expect(isBarrierMethod(undefined)).toBe(false);
  });
});

describe("hasBarrierMethod", () => {
  it("is true when any selected name is a barrier", () => {
    expect(hasBarrierMethod(["PrEP", "Condom"])).toBe(true);
  });

  it("is false for a PrEP-only or empty selection", () => {
    expect(hasBarrierMethod(["PrEP"])).toBe(false);
    expect(hasBarrierMethod([])).toBe(false);
    expect(hasBarrierMethod(null)).toBe(false);
  });
});

describe("NO_BARRIER_LABEL", () => {
  it("is the user-facing derived label", () => {
    expect(NO_BARRIER_LABEL).toBe("No barrier method");
  });
});

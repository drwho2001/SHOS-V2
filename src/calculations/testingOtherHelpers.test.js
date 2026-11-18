// Testing "Other" free text — one truth for the chip, read view and search.
import { describe, it, expect } from "vitest";
import { hasTestingForOther, testingForOtherValue, setTestingForOther } from "./testingOtherHelpers.js";

describe("testing 'Other' free text", () => {
  it("shows the field for the Other chip or a stored custom value", () => {
    expect(hasTestingForOther(["HIV"])).toBe(false);
    expect(hasTestingForOther(["HIV", "Other"])).toBe(true);
    expect(hasTestingForOther(["Mycoplasma"])).toBe(true);
  });

  it("finds the custom value, ignoring fixed options", () => {
    expect(testingForOtherValue(["HIV", "Other"])).toBe("");
    expect(testingForOtherValue(["HIV", "Mycoplasma"])).toBe("Mycoplasma");
  });

  it("typed text replaces the placeholder, keeping fixed options", () => {
    expect(setTestingForOther(["HIV", "Other"], "Mycoplasma")).toEqual(["HIV", "Mycoplasma"]);
  });

  it("editing again replaces the previous custom text", () => {
    expect(setTestingForOther(["HIV", "Mycoplasma"], "Hepatitis E")).toEqual(["HIV", "Hepatitis E"]);
  });

  it("blank text restores the plain Other chip", () => {
    expect(setTestingForOther(["HIV", "Mycoplasma"], "")).toEqual(["HIV", "Other"]);
  });
});

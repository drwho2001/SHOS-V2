import { describe, it, expect } from "vitest";
import {
  CLINIC_VISIT_GROUPS,
  fieldGroupsForReasons,
  isGroupApplies,
  shouldGuideForm,
} from "./clinicVisitShape";

// The "why did you come today?" guidance. The critical test in this file is the
// LAST one: an unrecognised reason must never hide a section, because
// `reasonForVisit` is a user-extensible custom option list and a stale mapping
// that hides fields would silently swallow whatever the user had typed.

describe("clinic visit shape", () => {
  it("reveals the group a single reason implies", () => {
    expect(fieldGroupsForReasons(["Routine screening"])).toEqual(["testing"]);
    expect(fieldGroupsForReasons(["Symptoms"])).toEqual(["symptoms"]);
    expect(fieldGroupsForReasons(["Vaccination"])).toEqual(["testing", "vaccination"]);
    expect(fieldGroupsForReasons(["PrEP review"])).toEqual(["testing", "medication"]);
    expect(fieldGroupsForReasons(["Treatment"])).toEqual(["testing", "medication"]);
    expect(fieldGroupsForReasons(["Doxy refill"])).toEqual(["medication"]);
  });

  it("UNIONS reasons rather than intersecting them", () => {
    // The owner's explicit point: "multiple reasons may be true - ie testing &
    // vaccination, or prep review & testing". An intersection would show
    // testing for the first pair but nothing distinctive for either.
    expect(fieldGroupsForReasons(["Routine screening", "Vaccination"])).toEqual([
      "testing",
      "vaccination",
    ]);
    expect(fieldGroupsForReasons(["Symptoms", "Doxy refill"])).toEqual([
      "medication",
      "symptoms",
    ]);
  });

  it("deduplicates overlapping groups", () => {
    // Testing is implied by three separate reasons; it must appear once.
    const groups = fieldGroupsForReasons(["Routine screening", "PrEP review", "Treatment"]);
    expect(groups).toEqual(["testing", "medication"]);
    expect(new Set(groups).size).toBe(groups.length);
  });

  it("returns groups in a stable order regardless of click order", () => {
    const a = fieldGroupsForReasons(["Doxy refill", "Vaccination"]);
    const b = fieldGroupsForReasons(["Vaccination", "Doxy refill"]);
    expect(a).toEqual(b);
    expect(a).toEqual(["testing", "vaccination", "medication"]);
  });

  it("matches case- and whitespace-insensitively", () => {
    expect(fieldGroupsForReasons(["  routine SCREENING  "])).toEqual(["testing"]);
  });

  it("an UNRECOGNISED reason implies nothing and so hides nothing", () => {
    // THE load-bearing test. `reasonForVisit` is a custom option list the owner
    // can extend from inside the app, so this mapping WILL go stale. If an
    // unknown reason returned every group, or a partial set, a user who typed
    // into a section and then added their own reason would silently lose it.
    expect(fieldGroupsForReasons(["Blood pressure check"])).toEqual([]);
    expect(fieldGroupsForReasons(["Symptoms", "Something the owner added"])).toEqual(["symptoms"]);
    // Mixed known + unknown must not lose the known one.
    expect(fieldGroupsForReasons(["Vaccination", "Brand new reason"])).toEqual([
      "testing",
      "vaccination",
    ]);
  });

  it("an untouched or absent reason list reveals everything", () => {
    // An existing visit saved before this feature must render exactly as it does
    // today, and an un-started form must not look empty or broken.
    for (const empty of [[], undefined, null, ["", "   "]]) {
      expect(shouldGuideForm(empty), JSON.stringify(empty)).toBe(false);
    }
    // shouldGuideForm false means "show every section" - asserted here so the
    // contract cannot be inverted silently.
    expect(isGroupApplies("testing", [])).toBe(false);
    expect(isGroupApplies("symptoms", [])).toBe(false);
  });

  it("Pregnancy care and Other imply no group rather than an invented one", () => {
    // Deliberate. Neither has a section to reveal today, and inventing a
    // "pregnancy" group here would put a dead option in the mapping that later
    // reads as an oversight. Both are safe because an empty mapping hides
    // nothing - which is also why "Other" cannot hide the form.
    expect(fieldGroupsForReasons(["Pregnancy care"])).toEqual([]);
    expect(fieldGroupsForReasons(["Other"])).toEqual([]);
  });

  it("every group it can return is declared in CLINIC_VISIT_GROUPS", () => {
    const sample = ["Routine screening", "Vaccination", "PrEP review", "Treatment", "Symptoms", "Doxy refill"];
    for (const g of fieldGroupsForReasons(sample)) {
      expect(CLINIC_VISIT_GROUPS, `${g} is not declared`).toContain(g);
    }
  });

  it("handles a non-string entry without throwing", () => {
    // Backup import is the realistic source: an older or hand-edited file can
    // contain nulls or numbers inside the array.
    expect(() => fieldGroupsForReasons([null, 3, {}, "Symptoms"])).not.toThrow();
    expect(fieldGroupsForReasons([null, 3, {}, "Symptoms"])).toEqual(["symptoms"]);
  });

  it("does not mutate the caller's array", () => {
    const reasons = ["Vaccination", "Doxy refill"];
    const copy = [...reasons];
    fieldGroupsForReasons(reasons);
    expect(reasons).toEqual(copy);
  });
});
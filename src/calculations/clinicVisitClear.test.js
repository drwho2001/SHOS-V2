import { describe, it, expect } from "vitest";
import {
  fieldGroupsForReasons,
  droppedGroups,
  clearPlan,
  applyFieldClear,
  fieldsForGroup,
  CLINIC_VISIT_GROUPS,
} from "./clinicVisitShape";

// The clear-with-confirmation half of the "why did you come today?" pilot.
//
// The owner's rule: change the reason, and anything the new reason no longer
// covers is CLEARED - but only after confirming, and naming what will go. The
// alternative (hide and keep) was considered and rejected by the owner, so the
// risk here is the opposite one: that clearing destroys something silently, or
// that a hidden field keeps a value nobody can see.
//
// The third test in this file is the one that matters most: an UNRECOGNISED
// reason must not be able to trigger a clear. `reasonForVisit` is a user-
// extensible option list, so an unmapped reason appearing must never destroy data
// that is merely hidden.

const filled = {
  linkedTestIds: ["test_001"],
  vaccinationsGivenIds: [],
  medicationsGivenIds: ["med_001"],
  adHocMedicationsGiven: [],
  takeHomeMedications: [],
  symptomTypeIds: ["sym_001"],
  symptomsDiscussedIds: [],
  primaryReasonSymptomLogId: "",
  reasonForVisit: [],
};

describe("clearing when the reason no longer covers a section", () => {
  it("names only the fields that actually hold something", () => {
    // "Treatment" implies medication + testing. Dropping to "Symptoms" drops
    // both - and the fixture has a filled field in EACH (linkedTestIds and
    // medicationsGivenIds), so both are announced. Listed in group order.
    const plan = clearPlan(["Treatment"], ["Symptoms"], filled);
    expect(plan.groups).toEqual(["testing", "medication"]);
    expect(plan.fields).toEqual([
      { key: "linkedTestIds", label: "Linked tests" },
      { key: "medicationsGivenIds", label: "Medications given in clinic" },
    ]);
  });

  it("an empty section is never announced as a loss", () => {
    // Nothing in testing is filled, so confirming a clear that would delete
    // nothing is noise - and it would make every reason change feel risky.
    const plan = clearPlan(["Vaccination"], ["Symptoms"], {
      ...filled,
      linkedTestIds: [],
      vaccinationsGivenIds: [],
    });
    expect(plan.groups).toContain("testing");
    expect(plan.fields.map((f) => f.key)).not.toContain("linkedTestIds");
  });

  it("an UNRECOGNISED reason can never trigger a clear", () => {
    // THE safety test. `reasonForVisit` is a user-extensible option list, so the
    // owner can add a reason that maps to nothing. ADDING one must not drop any
    // group, because every existing reason is still selected - so nothing is
    // hidden and nothing needs clearing. My first draft of this test replaced
    // the reasons instead of adding to them, which tested a different scenario
    // entirely and failed for the right reason.
    const old = ["Treatment", "Vaccination"];
    const withUnknown = [...old, "Blood pressure check"];

    expect(droppedGroups(old, withUnknown)).toEqual([]);
    expect(clearPlan(old, withUnknown, filled).fields).toEqual([]);

    // And removing the unrecognised one drops nothing either, because it never
    // implied anything to begin with.
    expect(droppedGroups(withUnknown, old)).toEqual([]);
  });

  it("ADDING a reason can never drop a group", () => {
    // The asymmetry is the safety property: revealing is free, hiding is the
    // only direction that costs anything.
    for (const before of [["Treatment"], ["Symptoms"], ["PrEP review"], []]) {
      for (const after of [["Treatment", "Vaccination"], ["Vaccination"], ["Symptoms", "Doxy refill"]]) {
        const dropped = droppedGroups(before, after);
        const beforeGroups = fieldGroupsForReasons(before);
        for (const g of dropped) {
          expect(beforeGroups, `${before} -> ${after} dropped ${g}`).toContain(g);
        }
      }
    }
    // A concrete case: adding Vaccination to Routine screening only adds.
    expect(droppedGroups(["Routine screening"], ["Routine screening", "Vaccination"])).toEqual([]);
  });

  it("drops a group once the last reason needing it is gone", () => {
    // Testing is implied by three reasons, so it survives until the last one.
    // Order follows CLINIC_VISIT_GROUPS, not click order.
    expect(droppedGroups(["Treatment", "Vaccination"], ["Vaccination"])).toEqual(["medication"]);
    // Dropping every reason drops every group, in canonical order - vaccination
    // sits between testing and medication, which my first draft of this
    // expectation omitted and the test caught.
    expect(droppedGroups(["Treatment", "Vaccination"], [])).toEqual([
      "testing",
      "vaccination",
      "medication",
    ]);
  });

  it("applyFieldClear empties exactly the named fields, and nothing else", () => {
    // Clearing ONE field on its own, so the untouched ones are unambiguous.
    const next = applyFieldClear(filled, [{ key: "medicationsGivenIds", label: "x" }]);
    expect(next.medicationsGivenIds).toEqual([]);
    expect(next.symptomTypeIds).toEqual(["sym_001"]);
    expect(next.linkedTestIds).toEqual(["test_001"]);
    // The reason itself is never cleared - the user chose it.
    expect(next.reasonForVisit).toEqual(filled.reasonForVisit);

    // And the full plan clears both filled groups.
    const plan = clearPlan(["Treatment"], ["Symptoms"], filled);
    const cleared = applyFieldClear(filled, plan.fields);
    expect(cleared.linkedTestIds).toEqual([]);
    expect(cleared.medicationsGivenIds).toEqual([]);
    expect(cleared.symptomTypeIds).toEqual(["sym_001"]);
  });

  it("does not mutate the form it was given", () => {
    const form = { ...filled };
    const snapshot = JSON.stringify(form);
    applyFieldClear(form, [{ key: "medicationsGivenIds", label: "x" }]);
    expect(JSON.stringify(form)).toBe(snapshot);
  });

  it("returns the same object when there is nothing to clear", () => {
    // Identity, not just equality: the caller skips a re-render if we hand back
    // the same reference.
    expect(applyFieldClear(filled, [])).toBe(filled);
    expect(applyFieldClear(null, [{ key: "x", label: "x" }])).toBeNull();
    expect(applyFieldClear(filled, null)).toBe(filled);
  });

  it("clears a string field to empty string, not to an array", () => {
    // The fixture's symptomTypeIds is filled too, so it is cleared alongside -
    // which is correct, since "Symptoms" is the group being dropped.
    const withPrimary = { ...filled, primaryReasonSymptomLogId: "symlog_001" };
    const plan = clearPlan(["Symptoms"], ["Treatment"], withPrimary);
    expect(plan.fields.map((f) => f.key)).toEqual(["symptomTypeIds", "primaryReasonSymptomLogId"]);
    const cleared = applyFieldClear(withPrimary, plan.fields);
    expect(cleared.primaryReasonSymptomLogId).toBe("");
    expect(cleared.symptomTypeIds).toEqual([]);
  });

  it("every group declares the fields the form renders inside its gate", () => {
    // The gating and the clearing share this table on purpose, so the two cannot
    // drift into each other. If a group gained a field the form does not render
    // behind its gate, clearing would remove something still on screen.
    for (const group of CLINIC_VISIT_GROUPS) {
      expect(fieldsForGroup(group).length, `${group} declares no fields`).toBeGreaterThan(0);
      for (const field of fieldsForGroup(group)) {
        expect(field.key, `${group} field has no label`).toBeTruthy();
        expect(field.key in filled, `${field.key} is not a real clinic visit field`).toBe(true);
      }
    }
  });

  it("no field belongs to two groups", () => {
    // Otherwise a clear could fire from a group that does not own the field.
    const seen = new Set();
    for (const group of CLINIC_VISIT_GROUPS) {
      for (const field of fieldsForGroup(group)) {
        expect(seen.has(field.key), `${field.key} is declared twice`).toBe(false);
        seen.add(field.key);
      }
    }
  });
});
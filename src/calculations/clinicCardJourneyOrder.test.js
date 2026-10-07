import { describe, it, expect } from "vitest";
import { CLINIC_CARD_SECTIONS } from "./clinicCardVisibilityPreference.js";

// ADDED 6 Oct 2026 - the Clinic Card's section order follows a clinic VISIT.
//
// Why this needs a guard at all: CLINIC_CARD_SECTIONS is the single source of
// truth for BOTH the on-screen order and the visibility toggles, so the order is
// a real behaviour rather than incidental - and nothing else in the suite looks at
// it. The PDF export deliberately keeps its OWN hardcoded order (see
// clinicCardPdfService.js), so this file says nothing about that surface.
//
// The correction this pins is the owner's, and it is the part most likely to be
// undone by a well-meaning future edit: asked for "contacts at reception", they
// meant their OWN details - emergency contact, NHS number, clinic number,
// address, date of birth. The "Recent contacts" section is their SEXUAL
// PARTNERS, which belongs later, in the consult. Moving it up would be a
// plausible-looking "tidy" that puts partner names at the top of the card.

const keys = CLINIC_CARD_SECTIONS.map((s) => s.key);
const at = (key) => keys.indexOf(key);

describe("Clinic Card section order follows the clinic visit", () => {
  it("keeps every section, so a reorder can never silently drop one", () => {
    // The exact set as authored before the reorder. A reorder that lost a section
    // would still pass every ordering assertion below, which is the same shape of
    // failure this repo keeps cataloguing: checking the arrangement while never
    // checking the contents.
    expect([...keys].sort()).toEqual(
      [
        "allergies",
        "encounters",
        "emergency",
        "identity",
        "medications",
        "menstrualContraception",
        "recentContacts",
        "symptoms",
        "testing",
        "treatment",
        "vaccinations",
      ].sort(),
    );
  });

  it("opens with the user's OWN details, for reception and the update-details form", () => {
    expect(keys[0], "Identity holds DOB, address, NHS number and clinic number").toBe(
      "identity",
    );
    // Everything the reception group shares is stated at or before the form.
    expect(at("medications"), "medications are asked on the update-details form").toBeLessThan(
      at("recentContacts"),
    );
    expect(at("allergies")).toBeLessThan(at("recentContacts"));
    expect(at("menstrualContraception")).toBeLessThan(at("recentContacts"));
  });

  it("puts sexual partners in the CONSULT, not at reception", () => {
    // The correction. Recent contacts is partners, not personal details.
    expect(
      at("recentContacts"),
      "Recent contacts is a list of sexual partners - it belongs after the " +
        "reception group, not among the user's own details",
    ).toBeGreaterThan(at("menstrualContraception"));
    // ...and it is genuinely part of the card, not dropped to satisfy the above.
    expect(keys).toContain("recentContacts");
    expect(keys).toContain("encounters");
  });

  it("leaves emergency information last", () => {
    // Deliberate and arguable: it is arguably the most context-independent item on
    // the card, so a future edit moving it to the front is a judgement call rather
    // than a bug. This assertion exists so that such a change is a DELIBERATE edit
    // to this line, not an accident nobody notices.
    expect(keys[keys.length - 1]).toBe("emergency");
  });

  it("does not silently reintroduce a section with no label", () => {
    for (const s of CLINIC_CARD_SECTIONS) {
      expect(typeof s.key, "a section has no key").toBe("string");
      expect(String(s.label || "").trim().length, `section "${s.key}" has no label`)
        .toBeGreaterThan(0);
    }
  });
});

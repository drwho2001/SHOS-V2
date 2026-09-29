// A banner must not appear for something that is not due.
//
// The defect this file exists for: the vaccination and clinic-visit banners
// rendered for a booster due in six months, and for a booked appointment three
// weeks out with a 24-hour reminder window.
//
// It is worth being precise about why it happened, because the shape of the
// bug is the opposite of the one this project records more often. Most of the
// recorded "measured nothing and looked green" failures are FALSE NEGATIVES -
// a banner that should have appeared, and did not. This one is a FALSE
// POSITIVE, and it is nastier for that:
//
//   dueCount: vaccinationDue ? 1 : 0
//
// The due-state object is TRUTHY even when it reports `due: false`, so every
// record counted as one outstanding item. The signature did not save it either,
// because a vaccination due in 2027 still has an id and a dueDate. Both
// conditions for showing a banner were satisfied by a record that was months
// from being due.
//
// The two kinds that got this right by accident are the ones counting an ARRAY
// LENGTH (dueMeds.length, refillDue.length) - a length is 0 when nothing is
// due. The three broken ones return an object, so they have to read the `due`
// flag explicitly. That is why this is asserted per kind rather than once.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildTestingSignature,
  buildVaccinationSignature,
  buildClinicVisitSignature,
  buildRefillSignature,
  buildSimpleSignature,
  REMINDER_KIND,
  isBannerVisible,
} from "./reminderSuppression";

const read = (rel) => readFileSync(resolve(process.cwd(), rel), "utf8");
const APP_CODE = read("src/App.jsx");

const FAR_FUTURE = new Date("2027-06-01T09:00:00.000Z");
const NOW = new Date("2026-03-14T12:00:00.000Z");

describe("a record that is not due produces no fingerprint", () => {
  it("a vaccination months away", () => {
    // The exact shape getVaccinationDueState() returns for a booster in 2027.
    const state = { due: false, vaccination: { id: "vax_002" }, dueDate: FAR_FUTURE };
    expect(buildVaccinationSignature(state)).toBe("");
    // And the banner genuinely must not render, not merely "probably not" -
    // this is the end-to-end assertion through the real decision function.
    expect(isBannerVisible({ dueCount: 1, signature: buildVaccinationSignature(state), sessionDismissed: [], acknowledged: [] }))
      .toBe(false);
  });

  it("a booked visit outside its own reminder window", () => {
    // getClinicVisitDueState() returns { due: false, visit } for a real visit
    // that is simply not due to be reminded about yet.
    const state = { due: false, visit: { id: "visit_9", title: "Follow-up" } };
    expect(buildClinicVisitSignature(state)).toBe("");
    expect(isBannerVisible({ dueCount: 1, signature: buildClinicVisitSignature(state), sessionDismissed: [], acknowledged: [] }))
      .toBe(false);
  });

  it("a retest that is not due yet", () => {
    const state = { due: false, dueDate: FAR_FUTURE };
    expect(buildTestingSignature(state)).toBe("");
  });

  it("a snoozed reminder is not a due reminder", () => {
    // Snoozed states deliberately keep vaccination/visit/date so the banner can
    // still show the content when the snooze expires. They must not produce a
    // fingerprint now - or acknowledging a snoozed item would acknowledge an
    // item that is not outstanding.
    expect(buildVaccinationSignature({ due: false, vaccination: { id: "v1" }, dueDate: NOW })).toBe("");
    expect(buildClinicVisitSignature({ due: false, visit: { id: "x" } })).toBe("");
  });

  it("an empty or absent state is still empty", () => {
    for (const s of [null, undefined, {}, { due: true }]) {
      expect(buildVaccinationSignature(s)).toBe("");
      expect(buildClinicVisitSignature(s)).toBe("");
      expect(buildTestingSignature(s)).toBe("");
    }
  });
});

describe("a record that IS due still produces a distinct fingerprint", () => {
  // The half that matters most. Requiring `due` could easily have been
  // "fixed" by making every signature empty, which passes the tests above and
  // silently removes the feature. A due record must still fingerprint, and two
  // occurrences of the same record must still differ.

  it("a due vaccination fingerprints, and its next dose differs", () => {
    const a = buildVaccinationSignature({ due: true, vaccination: { id: "vax_002" }, dueDate: NOW });
    const b = buildVaccinationSignature({ due: true, vaccination: { id: "vax_002" }, dueDate: FAR_FUTURE });
    expect(a).not.toBe("");
    expect(b).not.toBe("");
    // The whole point of the date: acknowledging this dose must not silence
    // the booster.
    expect(a).not.toBe(b);
  });

  it("a due retest fingerprints, and its next retest differs", () => {
    const a = buildTestingSignature({ due: true, dueDate: NOW });
    const b = buildTestingSignature({ due: true, dueDate: FAR_FUTURE });
    expect(a).not.toBe("");
    expect(a).not.toBe(b);
  });

  it("a due visit fingerprints", () => {
    const s = buildClinicVisitSignature({ due: true, visit: { id: "visit_9" } });
    expect(s).not.toBe("");
    expect(s).toContain("clinicVisit:visit_9");
  });

  it("meds and refill are unaffected - they key on an array", () => {
    // The two that were right by accident stay right, and the kinds stay
    // distinct from each other, which is what keeps an acknowledgement for a
    // medication from suppressing a refill.
    const meds = buildSimpleSignature(REMINDER_KIND.MEDS, [{ id: "med_1" }]);
    const refill = buildRefillSignature([{ id: "med_1" }]);
    expect(meds).not.toBe(refill);
    expect(refill).toContain("refill:");
  });

  it("a banner still shows when a record IS due and nothing is suppressing it", () => {
    const sig = buildVaccinationSignature({ due: true, vaccination: { id: "vax_002" }, dueDate: NOW });
    expect(isBannerVisible({ dueCount: 1, signature: sig, sessionDismissed: [], acknowledged: [] })).toBe(true);
  });
});

describe("App.jsx counts the due flag, not the truthiness of the state object", () => {
  // A unit test cannot see which expression the JSX uses, so this pins the
  // wiring - the same reason reminderDeviceSilenceWiring.test.js exists.
  it("no banner counts a state object directly", () => {
    for (const [label, old] of [
      ["testing", "suppressState(REMINDER_KIND.TESTING, testingDue ? 1 : 0"],
      ["clinic visit", "suppressState(REMINDER_KIND.CLINIC_VISIT, clinicVisitDue ? 1 : 0"],
      ["vaccination", "suppressState(REMINDER_KIND.VACCINATION, vaccinationDue ? 1 : 0"],
    ]) {
      expect(APP_CODE, `${label} must not count the state object's truthiness`).not.toContain(old);
    }
  });

  it("the outstanding-acknowledgement list does the same", () => {
    // This one is easier to miss: it drives the passive nav dot, so a
    // not-due vaccination would otherwise show a "you stopped being reminded"
    // dot for something that was never on screen.
    for (const [label, old] of [
      ["testing", "REMINDER_KIND.TESTING, testingDue ? 1 : 0"],
      ["clinic visit", "REMINDER_KIND.CLINIC_VISIT, clinicVisitDue ? 1 : 0"],
      ["vaccination", "REMINDER_KIND.VACCINATION, vaccinationDue ? 1 : 0"],
    ]) {
      expect(APP_CODE, `${label} outstanding list must count the due flag`).not.toContain(old);
    }
  });
});

import { it, expect, beforeEach } from "vitest";
import {
  advisoryDismissalKey,
  isAdvisoryDismissed,
  dismissAdvisory,
  clearAdvisoryDismissals,
} from "./advisoryDismissal";

/**
 * t106: the dose-timing advisory's dismissal.
 *
 * The calculation it dismisses is unchanged and is not tested here: the
 * two-hour window is the NHS-sourced figure, and
 * src/calculations/medicationLockout.test.js already pins the calculation's
 * behaviour (including that the window scales with frequency). What is tested
 * here is the DISMISSAL's identity, because a dismissal keyed wrongly is
 * either permanent - the advice never returns for that medication again - or
 * useless, expiring the moment the message's own hour figure changes.
 */

const MED = { id: "med_1", name: "Sertraline" };
const DOSE = { id: "log_1", date: "2026-10-20T08:00:00.000Z" };

beforeEach(() => {
  clearAdvisoryDismissals();
});

it("keys an occurrence by the medication, the dose and which side of the floor", () => {
  const key = advisoryDismissalKey(MED, DOSE, { kind: "just-early", hours: "1h" });
  expect(key).toContain("med_1");
  expect(key).toContain("2026-10-20T08:00:00.000Z");
  expect(key).toContain("just-early");
});

it("the same dose and kind is the SAME occurrence, whatever the message says", () => {
  // The message's hour figure changes as the clock moves ("1h before" becomes
  // "2h before"). A key built from the message would make the dismissal
  // expire on its own, and the advice would come back with nothing having
  // changed except the time of day.
  const first = advisoryDismissalKey(MED, DOSE, { kind: "just-early", hours: "1h", message: "1h before the safe window." });
  const later = advisoryDismissalKey(MED, DOSE, { kind: "just-early", hours: "2h", message: "2h before the safe window." });
  expect(first).toBe(later);
});

it("a newly logged dose is a NEW occurrence, so the advice comes back", () => {
  const before = advisoryDismissalKey(MED, DOSE, { kind: "just-early" });
  const after = advisoryDismissalKey(MED, DOSE, { id: "log_2", date: "2026-10-20T20:00:00.000Z" }, { kind: "just-early" });
  expect(after).not.toBe(before);
});

it("the other side of the floor is a different occurrence", () => {
  const early = advisoryDismissalKey(MED, DOSE, { kind: "just-early" });
  const late = advisoryDismissalKey(MED, DOSE, { kind: "just-late" });
  expect(late).not.toBe(early);
});

it("a different medication is a different occurrence", () => {
  const one = advisoryDismissalKey(MED, DOSE, { kind: "just-early" });
  const two = advisoryDismissalKey({ id: "med_2", name: "PrEP" }, DOSE, { kind: "just-early" });
  expect(two).not.toBe(one);
});

it("dismissing hides that occurrence, and only that occurrence", () => {
  const key = advisoryDismissalKey(MED, DOSE, { kind: "just-early" });
  expect(isAdvisoryDismissed(key)).toBe(false);
  dismissAdvisory(key);
  expect(isAdvisoryDismissed(key)).toBe(true);
  // The same medication, the same dose, the other side of the floor.
  const other = advisoryDismissalKey(MED, DOSE, { kind: "just-late" });
  expect(isAdvisoryDismissed(other)).toBe(false);
  // A different medication entirely.
  const otherMed = advisoryDismissalKey({ id: "med_2" }, DOSE, { kind: "just-early" });
  expect(isAdvisoryDismissed(otherMed)).toBe(false);
});

it("a missing piece keys to null rather than to a string that matches everything", () => {
  expect(advisoryDismissalKey(null, DOSE, { kind: "just-early" })).toBeNull();
  expect(advisoryDismissalKey(MED, null, { kind: "just-early" })).toBeNull();
  expect(advisoryDismissalKey(MED, DOSE, null)).toBeNull();
  // And a null key is never "dismissed", and dismissing it does nothing.
  expect(isAdvisoryDismissed(null)).toBe(false);
  expect(dismissAdvisory(null)).toBe(false);
  expect(isAdvisoryDismissed(null)).toBe(false);
});

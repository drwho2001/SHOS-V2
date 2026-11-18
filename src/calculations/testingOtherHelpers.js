// Testing "Other" free text (18 Nov) — the "Other" chip alone was a dead end:
// it stored the literal word and gave no way to say WHICH test. Pure helpers
// keep the form, read view and search in agreement with one rule.
import { TESTING_FOR_OPTIONS } from "../repositories/testingRepository.js";

/** The typed custom value, if any (anything not in the fixed option list). */
export function testingForOtherValue(testingFor = []) {
  return (testingFor || []).find((v) => v && !TESTING_FOR_OPTIONS.includes(v)) || "";
}

/** True when the Other field should be shown. */
export function hasTestingForOther(testingFor = []) {
  return (testingFor || []).includes("Other") || !!testingForOtherValue(testingFor);
}

/**
 * Write the typed text into testingFor, replacing the "Other" placeholder and
 * any previous custom value. Blank text restores the plain "Other" chip.
 */
export function setTestingForOther(testingFor = [], text = "") {
  const kept = (testingFor || []).filter((v) => v !== "Other" && !testingForOtherValue([v]));
  const trimmed = String(text || "").trim();
  return trimmed ? [...kept, trimmed] : [...kept, "Other"];
}

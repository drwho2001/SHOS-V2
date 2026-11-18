// measurementTypeBank.js
//
// PLAIN-LANGUAGE PURPOSE
// ----------------------
// A small, LOCAL (on-device) list of common lab measurements mapped to a
// sensible kind + canonical unit. Owner's real complaint (17 Nov 2026):
// "What kind of measurement is eGFR?" is a question most people cannot
// answer — the app was asking them to categorise a free-typed type with
// no help, and a wrong choice locks the unit chips to the wrong kind.
//
// This is help AT INPUT TIME, not a hidden code and not a facts database.
// It suggests a type name and a unit, then the user confirms or rejects —
// never silently guessed (wrong units on health data = silent corruption).
// No cloud, no network, consistent with the privacy promise.
//
// UK-first units (µmol/L, mmol/L, mmol/mol, mL/min/1.73m²); US alternates
// are noted where a real conversion exists, but UNIT_CONFIG stays the
// single owner of actual conversion factors — this file never invents one.
//
// SCOPE LIMIT, stated rather than implied: this is a curated convenience
// list, NOT a clinical reference. No reference ranges, no normal/abnormal,
// no interpretation, no diagnosis. Anything not in the bank keeps the
// existing manual "What kind of measurement is X?" escape hatch.
import { findClosestMatch } from "./fuzzyMatch.js";

// `unit` is a SUGGESTION for the unit chip, chosen to match the app's own
// KIND_UNITS vocabulary where possible. eGFR's mL/min/1.73m² is a real
// clinical unit but not in KIND_UNITS — the unit field accepts free text,
// so offering it here is safe and does not require a conversion factor.
export const MEASUREMENT_TYPE_BANK = [
  { name: "eGFR", kind: "concentration", unit: "mL/min/1.73m²", aliases: ["egfr", "gfr", "estimated glomerular filtration rate", "kidney function"] },
  { name: "Creatinine", kind: "concentration", unit: "µmol/L", aliases: ["creatinine", "serum creatinine", "serum creat"] },
  { name: "Glucose", kind: "concentration", unit: "mmol/L", aliases: ["glucose", "blood glucose", "blood sugar", "fasting glucose"] },
  { name: "HbA1c", kind: "concentration", unit: "mmol/mol", aliases: ["hba1c", "a1c", "haemoglobin a1c", "hemoglobin a1c"] },
  { name: "TSH", kind: "concentration", unit: "mIU/L", aliases: ["tsh", "thyroid stimulating hormone", "thyroid"] },
  { name: "Cholesterol", kind: "concentration", unit: "mmol/L", aliases: ["cholesterol", "total cholesterol"] },
  { name: "CRP", kind: "concentration", unit: "mg/L", aliases: ["crp", "c reactive protein", "c-reactive protein"] },
  { name: "Haemoglobin", kind: "concentration", unit: "g/L", aliases: ["haemoglobin", "hemoglobin", "hb"] },
  { name: "Vitamin D", kind: "concentration", unit: "nmol/L", aliases: ["vitamin d", "vit d", "25 oh vitamin d"] },
  { name: "Ferritin", kind: "concentration", unit: "µg/L", aliases: ["ferritin"] },
  { name: "Prolactin", kind: "concentration", unit: "mIU/L", aliases: ["prolactin"] },
  { name: "Cortisol", kind: "concentration", unit: "nmol/L", aliases: ["cortisol"] },
];

const normalise = (s) => (s || "").trim().toLowerCase();
// People type acronyms with stray spaces ("e G F R", "H b A 1 c"). The
// main comparison keeps spaces/punctuation (so "blood sugar" stays a
// phrase), but a compact form is also tried for exact matching — it is
// still an exact, user-confirmed suggestion, never a fuzzy guess.
const compact = (s) => normalise(s).replace(/[^a-z0-9]+/g, "");

/**
 * Find a bank entry the typed text is pointing at, or null.
 *
 * @param {string} typed raw text from the Type field
 * @param {string[]} existingOptions the user's own known measurement types
 * @returns {{name, kind, unit, aliases}|null}
 *
 * Order matters, same "exact first, fuzzy as fallback" rule as fuzzyMatch.js:
 *  1. exact match against a name or alias -> strong suggestion;
 *  2. fuzzy match against names+aliases using the shared distance rules;
 *  3. never suggest something the user already has under that name (they
 *     have their own spelling/unit history — the existing field handles it).
 */
export function findBankMatch(typed, existingOptions = []) {
  const q = normalise(typed);
  if (!q) return null;

  const alreadyHas = (entry) => (existingOptions || []).some((o) => normalise(o) === normalise(entry.name));
  const namesAndAliases = (entry) => [entry.name, ...(entry.aliases || [])];

  const qCompact = compact(q);
  for (const entry of MEASUREMENT_TYPE_BANK) {
    const match = namesAndAliases(entry).some((n) => normalise(n) === q || (qCompact.length >= 2 && compact(n) === qCompact));
    if (match && !alreadyHas(entry)) return entry;
  }

  // Flat candidate list carrying its owning entry. findClosestMatch returns
  // the matched candidate STRING, so map back via a fresh lookup (a Map keyed
  // by lowercased name would collapse aliases that happen to be shared).
  const candidates = [];
  for (const entry of MEASUREMENT_TYPE_BANK) {
    for (const n of namesAndAliases(entry)) candidates.push({ name: n, entry });
  }
  const close = findClosestMatch(candidates.map((c) => c.name), q);
  if (!close) return null;
  const hit = candidates.find((c) => normalise(c.name) === normalise(close));
  return hit && !alreadyHas(hit.entry) ? hit.entry : null;
}

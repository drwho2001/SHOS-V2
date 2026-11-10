// registryUsage.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Every registry-backed picker in the app (Kinks, Limits, Chems, Protection,
// Symptoms, Organism, Results, Locations) used to suggest entries in the order
// the registry happened to store them — which in practice reads as A–Z, or as
// seed order. Encounters' picker even had a "most used" comment above a
// comparison that could never be true: it checked `${value}` (the form's own
// current selection) against a list that had already filtered exactly those
// entries out. So the one thing every one of these lists never did was put the
// thing you pick most often at the top.
//
// This module is the single place that decides "how often is this entry
// actually used". It counts across EVERY record type that can reference the
// vocabulary, not just the one being edited:
//
//   kink        encounters (kinksInvolved), contacts (statedKinks + limits),
//               my profile (statedKinks + limits)
//   chem        encounters (chemsAlcoholUsed), contacts (knownChems),
//               my profile (knownChems)
//   protection  encounters (protectionUsed)
//   symptom     encounters (symptomsNoted), symptom log (symptomIds),
//               clinic visits (symptomTypeIds)
//   organism    testing (organismIds), completed tests only
//   result      testing (resultIds), clinic visits (resultIds),
//               completed tests only
//   location    encounters (locationId), clinic visits (locationId)
//
// The count is a suggestion order, never a stored value — deleting a record
// simply lowers it on the next load.
//
// Deliberately NOT cached across mounts: a repository getAll() is already an
// in-memory structuredClone after its first load, so recomputing is cheap,
// and recomputing means the list is correct immediately after a save instead
// of needing invalidation calls in every save path. Concurrent pickers in one
// form share the in-flight promise, so a four-picker form still loads once.
import { useEffect, useState } from "react";
import { EncounterRepository } from "../repositories/encounterRepository.js";
import { ContactRepository } from "../repositories/contactRepository.js";
import { MyProfileRepository } from "../repositories/myProfileRepository.js";
import { SymptomLogRepository } from "../repositories/symptomLogRepository.js";
import { TestingRepository } from "../repositories/testingRepository.js";
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository.js";
import { isCompletedTestRecord } from "./testingCalculations.js";

// Registry storage keys. Kept in one place so a renamed key fails in one
// place rather than silently producing an always-zero usage list.
export const USAGE_KEYS = {
  kink: "shos_kink_registry",
  chem: "shos_chems_registry",
  protection: "shos_protection_registry",
  symptom: "shos_symptoms_registry",
  organism: "shos_organism_registry",
  result: "shos_results_registry",
  location: "shos_locations",
};

const EMPTY_COUNTS = new Map();
const EMPTY_ALL = new Map();

const idList = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

// Kink selections are `{ kinkId, role }` objects in the live UI, but older
// seed/imported data can still carry a bare id string. Accept both rather than
// silently counting neither, which is exactly how the old picker's "most used"
// branch became unreachable.
const kinkIdList = (value) =>
  Array.isArray(value)
    ? value
        .map((entry) => (typeof entry === "string" ? entry : entry?.kinkId))
        .filter(Boolean)
    : [];

function bump(counts, ids) {
  ids.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
}

/**
 * Builds Map<registry storageKey, Map<entryId, useCount>> from every record
 * type that can reference a registry entry.
 */
export async function buildRegistryUsage() {
  const countsByKey = new Map();
  const countsFor = (key) => {
    if (!countsByKey.has(key)) countsByKey.set(key, new Map());
    return countsByKey.get(key);
  };

  const [encounters, contacts, profile, symptomEntries, tests, visits] = await Promise.all([
    EncounterRepository.getAll(),
    ContactRepository.getAll(),
    MyProfileRepository.getProfile(),
    SymptomLogRepository.getAll(),
    TestingRepository.getAll(),
    ClinicVisitsRepository.getAll(),
  ]);

  const kinks = countsFor(USAGE_KEYS.kink);
  const chems = countsFor(USAGE_KEYS.chem);
  const protection = countsFor(USAGE_KEYS.protection);
  const symptoms = countsFor(USAGE_KEYS.symptom);
  const organisms = countsFor(USAGE_KEYS.organism);
  const results = countsFor(USAGE_KEYS.result);
  const locations = countsFor(USAGE_KEYS.location);

  for (const encounter of encounters || []) {
    bump(kinks, kinkIdList(encounter.kinksInvolved));
    bump(chems, idList(encounter.chemsAlcoholUsed));
    bump(protection, idList(encounter.protectionUsed));
    bump(symptoms, idList(encounter.symptomsNoted));
    if (encounter.locationId) bump(locations, [encounter.locationId]);
  }

  for (const contact of contacts || []) {
    bump(kinks, kinkIdList(contact.statedKinks));
    bump(kinks, kinkIdList(contact.limits));
    bump(chems, idList(contact.knownChems));
  }

  // Single-record profile: both kink lists count, and chems are declared once.
  if (profile) {
    bump(kinks, kinkIdList(profile.statedKinks));
    bump(kinks, kinkIdList(profile.limits));
    bump(chems, idList(profile.knownChems));
  }

  for (const entry of symptomEntries || []) {
    // `symptomIds` is the canonical field; `symptomId` is the pre-multi-symptom
    // shape that old installs still carry.
    bump(symptoms, idList(entry.symptomIds));
    if (entry.symptomId) bump(symptoms, [entry.symptomId]);
  }

  for (const visit of visits || []) {
    bump(symptoms, idList(visit.symptomTypeIds));
    bump(results, idList(visit.resultIds));
    if (visit.locationId) bump(locations, [visit.locationId]);
  }

  // A PLANNED test does not count as a use: a scheduled retest has not
  // produced an organism or a result yet. Same rule the old per-registry
  // helpers applied (t127).
  for (const test of (tests || []).filter(isCompletedTestRecord)) {
    bump(organisms, idList(test.organismIds));
    bump(results, idList(test.resultIds));
  }

  return countsByKey;
}

let inFlight = null;

function loadUsage() {
  if (!inFlight) {
    inFlight = buildRegistryUsage().catch(() => EMPTY_ALL).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/**
 * useRegistryUsage(registry.storageKey) -> Map<entryId, useCount>.
 * Empty until the first load resolves; ordering falls back to A–Z meanwhile.
 */
export function useRegistryUsage(storageKey) {
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  useEffect(() => {
    if (!storageKey) return undefined;
    let alive = true;
    loadUsage().then((all) => {
      if (alive) setCounts(all.get(storageKey) || EMPTY_COUNTS);
    });
    return () => {
      alive = false;
    };
  }, [storageKey]);
  return counts;
}

/**
 * Most-used first, then alphabetical. Stable for equal counts, which is what
 * keeps a quiet vocabulary from looking randomly shuffled.
 */
export function sortByUsage(entries, counts) {
  const list = [...entries];
  list.sort((a, b) => {
    const diff = (counts.get(b.id) || 0) - (counts.get(a.id) || 0);
    return diff || a.name.localeCompare(b.name);
  });
  return list;
}

// registryUsage.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Registries (Kink/Chems/Protection/Symptoms/Organism/Results) don't
// track their own back-references — nothing in this app maintains a
// reverse index. These functions compute "how many real records
// currently point at this entry" by scanning the actual repositories
// that could reference it, the same "store facts, derive state"
// principle used everywhere else (e.g. Contact's Encounter Count is
// computed from Encounters, never stored on Contact). Used by the
// Registry Management screens so a real usage count is visible before
// archiving something, rather than archiving blind.
//
// Each function is scoped to exactly the fields that actually CAN
// reference that registry, confirmed by reading each repository's own
// DEFAULT_* shape directly — not guessed at.
import { ContactRepository } from "../repositories/contactRepository.js";
import { EncounterRepository } from "../repositories/encounterRepository.js";
import { MyProfileRepository } from "../repositories/myProfileRepository.js";
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository.js";
import { TestingRepository } from "../repositories/testingRepository.js";
import { SymptomLogRepository } from "../repositories/symptomLogRepository.js";

function hasKinkSelection(list, id) {
  return (list || []).some((sel) => sel?.kinkId === id);
}

export function computeKinkUsage(id) {
  let count = 0;
  ContactRepository.getAll().forEach((c) => {
    if (hasKinkSelection(c.statedKinks, id)) count += 1;
    if (hasKinkSelection(c.limits, id)) count += 1;
  });
  EncounterRepository.getAll().forEach((e) => {
    if (hasKinkSelection(e.kinksInvolved, id)) count += 1;
  });
  const profile = MyProfileRepository.getProfile();
  if (hasKinkSelection(profile.statedKinks, id)) count += 1;
  if (hasKinkSelection(profile.limits, id)) count += 1;
  return count;
}

export function computeChemsUsage(id) {
  let count = 0;
  ContactRepository.getAll().forEach((c) => { if ((c.knownChems || []).includes(id)) count += 1; });
  EncounterRepository.getAll().forEach((e) => { if ((e.chemsAlcoholUsed || []).includes(id)) count += 1; });
  const profile = MyProfileRepository.getProfile();
  if ((profile.knownChems || []).includes(id)) count += 1;
  return count;
}

export function computeProtectionUsage(id) {
  let count = 0;
  EncounterRepository.getAll().forEach((e) => { if ((e.protectionUsed || []).includes(id)) count += 1; });
  return count;
}

export function computeSymptomsUsage(id) {
  let count = 0;
  EncounterRepository.getAll().forEach((e) => { if ((e.symptomsNoted || []).includes(id)) count += 1; });
  ClinicVisitsRepository.getAll().forEach((v) => { if ((v.symptomTypeIds || []).includes(id)) count += 1; });
  SymptomLogRepository.getAll().forEach((s) => { if (s.symptomId === id) count += 1; });
  return count;
}

export function computeOrganismUsage(id) {
  let count = 0;
  TestingRepository.getAll().forEach((t) => { if ((t.organismIds || []).includes(id)) count += 1; });
  return count;
}

export function computeResultsUsage(id) {
  let count = 0;
  TestingRepository.getAll().forEach((t) => { if ((t.resultIds || []).includes(id)) count += 1; });
  ClinicVisitsRepository.getAll().forEach((v) => { if ((v.resultIds || []).includes(id)) count += 1; });
  return count;
}

// ADDED — real gap found in a full-app audit: Locations had no
// management screen at all, unlike the 6 registries above (Settings
// only ever showed a static count row). Only Encounters actually
// references a location (confirmed via grep — Symptom Log's own
// header comment mentions Location by name but never stores a real
// locationId field).
export function computeLocationsUsage(id) {
  let count = 0;
  EncounterRepository.getAll().forEach((e) => { if (e.locationId === id) count += 1; });
  return count;
}

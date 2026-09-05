// orphanReferenceCheck.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask: a cheap data-integrity sweep for Developer Tools, cheap
// given this app's actual mechanics — relation-by-ID across
// repositories/registries, hard delete available per-module for
// genuine mistakes (see CLAUDE.md's Architecture rules). Hard-deleting
// a Contact, Location, or registry entry that an old Encounter/Test/
// etc. still references by ID leaves a dangling reference nothing else
// in the app currently notices — this finds those.
//
// Same "scan every possible referencer" approach as registryUsage.js
// (used there to show a real usage count before archiving), same
// "each check scoped to exactly the fields that actually CAN
// reference that target, confirmed by reading each repository's own
// DEFAULT_* shape directly" discipline — extended here to ask the
// opposite direction: not "how many records reference this", but
// "does what this record's own field points at still exist."
//
// DELIBERATE SCOPE LIMITS, stated plainly rather than oversold as an
// exhaustive schema validator (same spirit as fuzzyMatch.js's own
// documented scope limits):
// - Only checks fields confirmed live by their own repository's
//   comments. Explicitly excludes fields their own repository already
//   documents as deprecated/obsolete/dead (Testing's own
//   `relatedSymptomIds`, Clinic Visit's own `resultIds`, Symptom Log's
//   own singular `symptomId`) — flagging those would be noise about
//   fields the app deliberately no longer keeps in sync, not a real
//   integrity problem.
// - Archived records/registry entries are NOT orphans — archive never
//   removes the row, so a reference to an archived Contact or Kink
//   Registry entry still resolves fine via getById() and is correctly
//   left alone here. Only a reference to something that's been hard-
//   deleted (or never existed — e.g. a corrupted import) is flagged.
// - This is read-only. It surfaces dangling references for a human to
//   review and fix by hand (edit the record, clear the stale
//   reference) — same "never silently merge/fix" restraint already
//   applied to the duplicate checker (fuzzyMatch.js's findDuplicatePairs).
import { ContactRepository } from "../repositories/contactRepository.js";
import { EncounterRepository } from "../repositories/encounterRepository.js";
import { MedicationRepository } from "../repositories/medicationRepository.js";
import { TestingRepository } from "../repositories/testingRepository.js";
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository.js";
import { SymptomLogRepository } from "../repositories/symptomLogRepository.js";
import { VaccinationRepository } from "../repositories/vaccinationRepository.js";
import { EpisodeRepository } from "../repositories/episodeRepository.js";
import { LocationsRepository } from "../repositories/locationsRepository.js";
import { LogRepository } from "../repositories/logRepository.js";
import { MyProfileRepository } from "../repositories/myProfileRepository.js";
import { PartnerNotificationRepository } from "../repositories/partnerNotificationRepository.js";
import { MeasurementRepository } from "../repositories/measurementRepository.js";
import { ContraceptionRepository } from "../repositories/contraceptionRepository.js";
import { MenstrualCycleRepository } from "../repositories/menstrualCycleRepository.js";
import { KinkRegistry } from "../registries/kinkRegistry.js";
import { ChemsRegistry } from "../registries/chemsRegistry.js";
import { ProtectionRegistry } from "../registries/protectionRegistry.js";
import { SymptomsRegistry } from "../registries/symptomsRegistry.js";
import { OrganismRegistry } from "../registries/organismRegistry.js";
import { ResultsRegistry } from "../registries/resultsRegistry.js";

// One row per broken reference: which record, which of its own
// fields, what it points at, and where that target was supposed to be
// found. `recordLabel` is whatever that record's own list screen would
// show as its title, so a result reads the same as finding it by hand.
function flag(results, { recordType, recordLabel, recordId, field, danglingId, targetType }) {
  results.push({ recordType, recordLabel: recordLabel || "(untitled)", recordId, field, danglingId, targetType });
}

// CHANGED — real groundwork for encryption at rest: `await`ing `exists`
// here (instead of calling it directly) is a no-op for every
// still-synchronous `exists` function passed in (contactExists,
// medicationExists, etc. — await on a plain value just resolves
// immediately), and is what lets `locationExists` above genuinely be
// async without needing a second, parallel version of this helper.
async function checkSingle(results, exists, id, ctx) {
  if (id && !(await exists(id))) flag(results, { ...ctx, danglingId: id });
}

function checkArray(results, exists, ids, ctx) {
  (ids || []).forEach((id) => { if (id && !exists(id)) flag(results, { ...ctx, danglingId: id }); });
}

function checkKinkSelections(results, exists, selections, ctx) {
  (selections || []).forEach((sel) => { if (sel?.kinkId && !exists(sel.kinkId)) flag(results, { ...ctx, danglingId: sel.kinkId }); });
}

// CHANGED — real groundwork for encryption at rest: LocationsRepository
// is now async (see its own comment), so this whole function is now
// `async` too — `await` only added on the Locations-specific calls
// below (`locationExists`, the LocationsRepository.getAll() loop);
// every other repository here is still fully synchronous (its own
// future conversion, not this one's job), so those stay unchanged —
// calling a synchronous function inside an async one needs no await.
export async function findOrphanReferences() {
  const results = [];
  const contactExists = (id) => !!ContactRepository.getById(id);
  const locationExists = async (id) => !!(await LocationsRepository.getById(id));
  const medicationExists = (id) => !!MedicationRepository.getById(id);
  const testExists = (id) => !!TestingRepository.getById(id);
  const clinicVisitExists = (id) => !!ClinicVisitsRepository.getById(id);
  const symptomLogExists = (id) => !!SymptomLogRepository.getById(id);
  const encounterExists = (id) => !!EncounterRepository.getById(id);
  const vaccinationExists = (id) => !!VaccinationRepository.getById(id);
  const kinkExists = (id) => !!KinkRegistry.getById(id);
  const chemExists = (id) => !!ChemsRegistry.getById(id);
  const protectionExists = (id) => !!ProtectionRegistry.getById(id);
  const symptomExists = (id) => !!SymptomsRegistry.getById(id);
  const organismExists = (id) => !!OrganismRegistry.getById(id);
  const resultExists = (id) => !!ResultsRegistry.getById(id);

  ContactRepository.getAll().forEach((c) => {
    const ctx = { recordType: "Contact", recordLabel: c.nickname || c.name, recordId: c.id };
    checkKinkSelections(results, kinkExists, c.statedKinks, { ...ctx, field: "statedKinks", targetType: "Kink Registry" });
    checkKinkSelections(results, kinkExists, c.limits, { ...ctx, field: "limits", targetType: "Kink Registry" });
    checkArray(results, chemExists, c.knownChems, { ...ctx, field: "knownChems", targetType: "Chems Registry" });
  });

  const profile = MyProfileRepository.getProfile();
  const profileCtx = { recordType: "My Profile", recordLabel: "My Profile", recordId: "profile" };
  checkKinkSelections(results, kinkExists, profile.statedKinks, { ...profileCtx, field: "statedKinks", targetType: "Kink Registry" });
  checkKinkSelections(results, kinkExists, profile.limits, { ...profileCtx, field: "limits", targetType: "Kink Registry" });
  checkArray(results, chemExists, profile.knownChems, { ...profileCtx, field: "knownChems", targetType: "Chems Registry" });

  // CHANGED — checkSingle() is now async (locationExists below can be),
  // so this loop is a for...of + await instead of a forEach, ensuring
  // every flag() actually lands in `results` before this function
  // returns it — a fire-and-forget checkSingle() call here would let
  // `return results` at the bottom run before its flag (if any) was
  // ever pushed.
  for (const e of EncounterRepository.getAll()) {
    const ctx = { recordType: "Encounter", recordLabel: e.title || e.encounterType, recordId: e.id };
    checkArray(results, contactExists, e.attendeeIds, { ...ctx, field: "attendeeIds", targetType: "Contact" });
    await checkSingle(results, locationExists, e.locationId, { ...ctx, field: "locationId", targetType: "Location" });
    checkKinkSelections(results, kinkExists, e.kinksInvolved, { ...ctx, field: "kinksInvolved", targetType: "Kink Registry" });
    checkArray(results, protectionExists, e.protectionUsed, { ...ctx, field: "protectionUsed", targetType: "Protection Registry" });
    checkArray(results, chemExists, e.chemsAlcoholUsed, { ...ctx, field: "chemsAlcoholUsed", targetType: "Chems Registry" });
    checkArray(results, symptomExists, e.symptomsNoted, { ...ctx, field: "symptomsNoted", targetType: "Symptoms Registry" });
  }

  TestingRepository.getAll().forEach((t) => {
    const ctx = { recordType: "Test", recordLabel: t.title, recordId: t.id };
    checkArray(results, organismExists, t.organismIds, { ...ctx, field: "organismIds", targetType: "Organism Registry" });
    checkArray(results, resultExists, t.resultIds, { ...ctx, field: "resultIds", targetType: "Results Registry" });
    checkArray(results, clinicVisitExists, t.clinicVisitIds, { ...ctx, field: "clinicVisitIds", targetType: "Clinic Visit" });
  });

  SymptomLogRepository.getAll().forEach((s) => {
    const ctx = { recordType: "Symptom Log entry", recordLabel: s.title, recordId: s.id };
    checkArray(results, symptomExists, s.symptomIds, { ...ctx, field: "symptomIds", targetType: "Symptoms Registry" });
    checkArray(results, encounterExists, s.relatedEncounterIds, { ...ctx, field: "relatedEncounterIds", targetType: "Encounter" });
    checkArray(results, testExists, s.relatedTestIds, { ...ctx, field: "relatedTestIds", targetType: "Test" });
  });

  for (const v of ClinicVisitsRepository.getAll()) {
    const ctx = { recordType: "Clinic Visit", recordLabel: v.title, recordId: v.id };
    checkArray(results, testExists, v.linkedTestIds, { ...ctx, field: "linkedTestIds", targetType: "Test" });
    checkArray(results, medicationExists, v.medicationsGivenIds, { ...ctx, field: "medicationsGivenIds", targetType: "Medication" });
    checkArray(results, symptomExists, v.symptomTypeIds, { ...ctx, field: "symptomTypeIds", targetType: "Symptoms Registry" });
    checkArray(results, symptomLogExists, v.symptomsDiscussedIds, { ...ctx, field: "symptomsDiscussedIds", targetType: "Symptom Log entry" });
    await checkSingle(results, symptomLogExists, v.primaryReasonSymptomLogId, { ...ctx, field: "primaryReasonSymptomLogId", targetType: "Symptom Log entry" });
    checkArray(results, vaccinationExists, v.vaccinationsGivenIds, { ...ctx, field: "vaccinationsGivenIds", targetType: "Vaccination" });
  }

  VaccinationRepository.getAll().forEach((v) => {
    const ctx = { recordType: "Vaccination", recordLabel: v.title || v.vaccine, recordId: v.id };
    checkArray(results, symptomExists, v.symptomIds, { ...ctx, field: "symptomIds", targetType: "Symptoms Registry" });
    checkArray(results, clinicVisitExists, v.clinicVisitIds, { ...ctx, field: "clinicVisitIds", targetType: "Clinic Visit" });
  });

  for (const ep of EpisodeRepository.getAll()) {
    const ctx = { recordType: "Episode", recordLabel: ep.title, recordId: ep.id };
    await checkSingle(results, encounterExists, ep.startEncounterId, { ...ctx, field: "startEncounterId", targetType: "Encounter" });
    checkArray(results, encounterExists, ep.atRiskEncounterIds, { ...ctx, field: "atRiskEncounterIds", targetType: "Encounter" });
    checkArray(results, encounterExists, ep.notifiedEncounterIds, { ...ctx, field: "notifiedEncounterIds", targetType: "Encounter" });
    checkArray(results, testExists, ep.testIds, { ...ctx, field: "testIds", targetType: "Test" });
    checkArray(results, clinicVisitExists, ep.clinicVisitIds, { ...ctx, field: "clinicVisitIds", targetType: "Clinic Visit" });
    checkArray(results, symptomLogExists, ep.symptomLogIds, { ...ctx, field: "symptomLogIds", targetType: "Symptom Log entry" });
  }

  // CHANGED — LocationsRepository is now async (see its own comment),
  // so this reads its result via await before iterating, same as
  // every other repository call in this file will need once each own
  // gets converted.
  for (const loc of await LocationsRepository.getAll()) {
    await checkSingle(results, contactExists, loc.relatedContactId, { recordType: "Location", recordLabel: loc.name, recordId: loc.id, field: "relatedContactId", targetType: "Contact" });
  }

  for (const log of LogRepository.getAll()) {
    await checkSingle(results, medicationExists, log.medicationId, { recordType: "Medication log entry", recordLabel: `${log.type || "entry"} · ${log.date || ""}`, recordId: log.id, field: "medicationId", targetType: "Medication" });
  }

  // FIXED — real bug found writing this fix: this originally checked
  // n.contactId/n.title, neither of which exist on the list object
  // itself (partnerNotificationRepository.js's own DEFAULT_NOTIFICATION_LIST
  // shape: testId lives on the list, contactId lives on each of its
  // own items[]) — a silent no-op, not a crash, since checkSingle just
  // skips a falsy id. Corrected to the real shape.
  for (const n of PartnerNotificationRepository.getAll()) {
    const ctx = { recordType: "Partner Notification", recordLabel: `Notification list for test ${n.testId}`, recordId: n.id };
    await checkSingle(results, testExists, n.testId, { ...ctx, field: "testId", targetType: "Test" });
    const items = n.items || [];
    for (let i = 0; i < items.length; i++) {
      await checkSingle(results, contactExists, items[i].contactId, { ...ctx, field: `items[${i}].contactId`, targetType: "Contact" });
    }
  }

  MenstrualCycleRepository.getAll().forEach((cycle) => {
    checkArray(results, symptomExists, cycle.symptomIds, { recordType: "Menstrual cycle entry", recordLabel: cycle.startDate, recordId: cycle.id, field: "symptomIds", targetType: "Symptoms Registry" });
  });

  // Measurement/Contraception's own linked-visit and linked-test fields
  // are already actively cleared to null when the visit/test they point
  // at is deleted (see measurementRepository.js's own "one room, three
  // doors" comment) — included anyway as a cheap safety net in case a
  // future delete path ever bypasses that.
  for (const m of MeasurementRepository.getAll()) {
    const ctx = { recordType: "Measurement", recordLabel: `${m.type || "measurement"} · ${m.date || ""}`, recordId: m.id };
    await checkSingle(results, clinicVisitExists, m.linkedClinicVisitId, { ...ctx, field: "linkedClinicVisitId", targetType: "Clinic Visit" });
    await checkSingle(results, testExists, m.linkedTestId, { ...ctx, field: "linkedTestId", targetType: "Test" });
  }

  for (const c of ContraceptionRepository.getAll()) {
    await checkSingle(results, clinicVisitExists, c.linkedClinicVisitId, { recordType: "Contraception entry", recordLabel: c.method || c.id, recordId: c.id, field: "linkedClinicVisitId", targetType: "Clinic Visit" });
  }

  return results;
}

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

function checkSingle(results, exists, id, ctx) {
  if (id && !exists(id)) flag(results, { ...ctx, danglingId: id });
}

function checkArray(results, exists, ids, ctx) {
  (ids || []).forEach((id) => { if (id && !exists(id)) flag(results, { ...ctx, danglingId: id }); });
}

function checkKinkSelections(results, exists, selections, ctx) {
  (selections || []).forEach((sel) => { if (sel?.kinkId && !exists(sel.kinkId)) flag(results, { ...ctx, danglingId: sel.kinkId }); });
}

export function findOrphanReferences() {
  const results = [];
  const contactExists = (id) => !!ContactRepository.getById(id);
  const locationExists = (id) => !!LocationsRepository.getById(id);
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

  EncounterRepository.getAll().forEach((e) => {
    const ctx = { recordType: "Encounter", recordLabel: e.title || e.encounterType, recordId: e.id };
    checkArray(results, contactExists, e.attendeeIds, { ...ctx, field: "attendeeIds", targetType: "Contact" });
    checkSingle(results, locationExists, e.locationId, { ...ctx, field: "locationId", targetType: "Location" });
    checkKinkSelections(results, kinkExists, e.kinksInvolved, { ...ctx, field: "kinksInvolved", targetType: "Kink Registry" });
    checkArray(results, protectionExists, e.protectionUsed, { ...ctx, field: "protectionUsed", targetType: "Protection Registry" });
    checkArray(results, chemExists, e.chemsAlcoholUsed, { ...ctx, field: "chemsAlcoholUsed", targetType: "Chems Registry" });
    checkArray(results, symptomExists, e.symptomsNoted, { ...ctx, field: "symptomsNoted", targetType: "Symptoms Registry" });
  });

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

  ClinicVisitsRepository.getAll().forEach((v) => {
    const ctx = { recordType: "Clinic Visit", recordLabel: v.title, recordId: v.id };
    checkArray(results, testExists, v.linkedTestIds, { ...ctx, field: "linkedTestIds", targetType: "Test" });
    checkArray(results, medicationExists, v.medicationsGivenIds, { ...ctx, field: "medicationsGivenIds", targetType: "Medication" });
    checkArray(results, symptomExists, v.symptomTypeIds, { ...ctx, field: "symptomTypeIds", targetType: "Symptoms Registry" });
    checkArray(results, symptomLogExists, v.symptomsDiscussedIds, { ...ctx, field: "symptomsDiscussedIds", targetType: "Symptom Log entry" });
    checkSingle(results, symptomLogExists, v.primaryReasonSymptomLogId, { ...ctx, field: "primaryReasonSymptomLogId", targetType: "Symptom Log entry" });
    checkArray(results, vaccinationExists, v.vaccinationsGivenIds, { ...ctx, field: "vaccinationsGivenIds", targetType: "Vaccination" });
  });

  VaccinationRepository.getAll().forEach((v) => {
    const ctx = { recordType: "Vaccination", recordLabel: v.title || v.vaccine, recordId: v.id };
    checkArray(results, symptomExists, v.symptomIds, { ...ctx, field: "symptomIds", targetType: "Symptoms Registry" });
    checkArray(results, clinicVisitExists, v.clinicVisitIds, { ...ctx, field: "clinicVisitIds", targetType: "Clinic Visit" });
  });

  EpisodeRepository.getAll().forEach((ep) => {
    const ctx = { recordType: "Episode", recordLabel: ep.title, recordId: ep.id };
    checkSingle(results, encounterExists, ep.startEncounterId, { ...ctx, field: "startEncounterId", targetType: "Encounter" });
    checkArray(results, encounterExists, ep.atRiskEncounterIds, { ...ctx, field: "atRiskEncounterIds", targetType: "Encounter" });
    checkArray(results, encounterExists, ep.notifiedEncounterIds, { ...ctx, field: "notifiedEncounterIds", targetType: "Encounter" });
    checkArray(results, testExists, ep.testIds, { ...ctx, field: "testIds", targetType: "Test" });
    checkArray(results, clinicVisitExists, ep.clinicVisitIds, { ...ctx, field: "clinicVisitIds", targetType: "Clinic Visit" });
    checkArray(results, symptomLogExists, ep.symptomLogIds, { ...ctx, field: "symptomLogIds", targetType: "Symptom Log entry" });
  });

  LocationsRepository.getAll().forEach((loc) => {
    checkSingle(results, contactExists, loc.relatedContactId, { recordType: "Location", recordLabel: loc.name, recordId: loc.id, field: "relatedContactId", targetType: "Contact" });
  });

  LogRepository.getAll().forEach((log) => {
    checkSingle(results, medicationExists, log.medicationId, { recordType: "Medication log entry", recordLabel: `${log.type || "entry"} · ${log.date || ""}`, recordId: log.id, field: "medicationId", targetType: "Medication" });
  });

  PartnerNotificationRepository.getAll().forEach((n) => {
    const ctx = { recordType: "Partner Notification", recordLabel: n.title || n.id, recordId: n.id };
    checkSingle(results, contactExists, n.contactId, { ...ctx, field: "contactId", targetType: "Contact" });
    checkSingle(results, testExists, n.testId, { ...ctx, field: "testId", targetType: "Test" });
  });

  MenstrualCycleRepository.getAll().forEach((cycle) => {
    checkArray(results, symptomExists, cycle.symptomIds, { recordType: "Menstrual cycle entry", recordLabel: cycle.startDate, recordId: cycle.id, field: "symptomIds", targetType: "Symptoms Registry" });
  });

  // Measurement/Contraception's own linked-visit and linked-test fields
  // are already actively cleared to null when the visit/test they point
  // at is deleted (see measurementRepository.js's own "one room, three
  // doors" comment) — included anyway as a cheap safety net in case a
  // future delete path ever bypasses that.
  MeasurementRepository.getAll().forEach((m) => {
    const ctx = { recordType: "Measurement", recordLabel: `${m.type || "measurement"} · ${m.date || ""}`, recordId: m.id };
    checkSingle(results, clinicVisitExists, m.linkedClinicVisitId, { ...ctx, field: "linkedClinicVisitId", targetType: "Clinic Visit" });
    checkSingle(results, testExists, m.linkedTestId, { ...ctx, field: "linkedTestId", targetType: "Test" });
  });

  ContraceptionRepository.getAll().forEach((c) => {
    checkSingle(results, clinicVisitExists, c.linkedClinicVisitId, { recordType: "Contraception entry", recordLabel: c.method || c.id, recordId: c.id, field: "linkedClinicVisitId", targetType: "Clinic Visit" });
  });

  return results;
}

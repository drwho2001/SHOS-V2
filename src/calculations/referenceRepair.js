// referenceRepair.js — the write side of orphanReferenceCheck.js.
//
// WHY THIS EXISTS. The checker reports a broken relation-by-id as
// "<record> its <field> points at a <targetType> that no longer exists".
// Until 6 Oct 2026 the only available response was for a human to find
// that record by hand, open its edit sheet, and clear the field — which is
// a real, multi-step errand for a single stale id, and the kind of friction
// that means people simply never check. A report you cannot act on is a
// report that gets ignored, which puts it back where this whole thing
// started: "None found".
//
// WHAT IT DELIBERATELY IS NOT. There is no auto-repair and no bulk repair.
// Every call here is ONE FIELD on ONE RECORD, and the caller must already
// have a specific orphan row in hand. That is not caution for its own sake:
// a wrong repair on sexual-health data is silent, and the owner finds out
// at a clinic appointment.
//
// WHY THE SHAPE IS DERIVED RATHER THAN HAND-WRITTEN PER FIELD. The
// obvious design is a hand-written entry per dangling field, saying whether
// it is a scalar, a list of ids, or a list of objects. That is a third
// hand-maintained inventory in this repo, and the first two have both
// drifted (the seed-snapshot regenerator reading 11 of 14 repositories, and
// the orphan checker missing four live fields). So the *array-ness* of a
// field is read out of the repository's own declared default at runtime,
// and the only thing stated by hand is the handful of fields whose ENTRIES
// are objects - because an empty declared default genuinely cannot say what
// key sits inside it. `orphanReferenceCoverage.test.js` is what keeps both
// this file and the checker honest, and it is extended to assert that every
// field the checker reports can actually be repaired here.
import { ContactRepository, DEFAULT_CONTACT } from "../repositories/contactRepository.js";
import { EncounterRepository, DEFAULT_ENCOUNTER } from "../repositories/encounterRepository.js";
import { MedicationRepository } from "../repositories/medicationRepository.js";
import { TestingRepository, DEFAULT_TEST } from "../repositories/testingRepository.js";
import { ClinicVisitsRepository, DEFAULT_CLINIC_VISIT } from "../repositories/clinicVisitsRepository.js";
import { SymptomLogRepository, DEFAULT_SYMPTOM_ENTRY } from "../repositories/symptomLogRepository.js";
import { VaccinationRepository, DEFAULT_VACCINATION } from "../repositories/vaccinationRepository.js";
import { EpisodeRepository, DEFAULT_EPISODE } from "../repositories/episodeRepository.js";
import { LocationsRepository, DEFAULT_LOCATION } from "../repositories/locationsRepository.js";
import { LogRepository } from "../repositories/logRepository.js";
import { MyProfileRepository, DEFAULT_PROFILE } from "../repositories/myProfileRepository.js";
import { PartnerNotificationRepository } from "../repositories/partnerNotificationRepository.js";
import { MeasurementRepository, DEFAULT_MEASUREMENT } from "../repositories/measurementRepository.js";
import { ContraceptionRepository, DEFAULT_CONTRACEPTION_ENTRY } from "../repositories/contraceptionRepository.js";
import { MenstrualCycleRepository, DEFAULT_CYCLE } from "../repositories/menstrualCycleRepository.js";
import { KinkRegistry } from "../registries/kinkRegistry.js";
import { ChemsRegistry } from "../registries/chemsRegistry.js";
import { ProtectionRegistry } from "../registries/protectionRegistry.js";
import { SymptomsRegistry } from "../registries/symptomsRegistry.js";
import { OrganismRegistry } from "../registries/organismRegistry.js";
import { ResultsRegistry } from "../registries/resultsRegistry.js";

// The record side: which repository owns a record of this type, and does its
// update() take an id. My Profile is the repo's only singleton, which is why
// it is called out rather than special-cased at the call site.
const RECORD_REPOSITORIES = {
  Contact: { repo: ContactRepository },
  "My Profile": { repo: MyProfileRepository, singleton: true },
  Encounter: { repo: EncounterRepository },
  Test: { repo: TestingRepository },
  "Symptom Log entry": { repo: SymptomLogRepository },
  "Clinic Visit": { repo: ClinicVisitsRepository },
  Vaccination: { repo: VaccinationRepository },
  Episode: { repo: EpisodeRepository },
  Location: { repo: LocationsRepository },
  "Medication log entry": { repo: LogRepository },
  "Partner Notification": { repo: PartnerNotificationRepository },
  Measurement: { repo: MeasurementRepository },
  "Contraception entry": { repo: ContraceptionRepository },
  "Menstrual cycle entry": { repo: MenstrualCycleRepository },
};

// The target side: what a dangling id of this type could legitimately be
// re-pointed at. Kept separate from the record side on purpose — a Clinic
// Visit can point at a Test, and a Test at a Clinic Visit, and a single
// "repositories" list would make that asymmetry invisible.
const TARGET_SOURCES = {
  Contact: { getAll: () => ContactRepository.getAll(), label: (c) => c.nickname || c.name },
  Location: { getAll: () => LocationsRepository.getAll(), label: (l) => l.name },
  Medication: { getAll: () => MedicationRepository.getAll(), label: (m) => m.name },
  Test: { getAll: () => TestingRepository.getAll(), label: (t) => t.title },
  "Clinic Visit": { getAll: () => ClinicVisitsRepository.getAll(), label: (v) => v.title },
  "Symptom Log entry": { getAll: () => SymptomLogRepository.getAll(), label: (s) => s.title },
  Encounter: { getAll: () => EncounterRepository.getAll(), label: (e) => e.title || e.encounterType },
  Vaccination: { getAll: () => VaccinationRepository.getAll(), label: (v) => v.title || v.vaccine },
  "Kink Registry": { getAll: () => KinkRegistry.getAll(), label: (k) => k.name },
  "Chems Registry": { getAll: () => ChemsRegistry.getAll(), label: (c) => c.name },
  "Protection Registry": { getAll: () => ProtectionRegistry.getAll(), label: (p) => p.name },
  "Symptoms Registry": { getAll: () => SymptomsRegistry.getAll(), label: (s) => s.name },
  "Organism Registry": { getAll: () => OrganismRegistry.getAll(), label: (o) => o.name },
  "Results Registry": { getAll: () => ResultsRegistry.getAll(), label: (r) => r.name },
};

// Fields whose ENTRIES are objects carrying a foreign key. This is the only
// thing this file states by hand, because it is the only thing a declared
// default genuinely cannot tell you: each of these is declared `[]`, so the
// key inside an entry exists only at runtime. Everything else is derived.
export const ENTRY_ID_KEYS = {
  statedKinks: "kinkId",
  limits: "kinkId",
  kinksInvolved: "kinkId",
  takeHomeMedications: "medicationId",
};

// Reported as `items[N].contactId`, where the field lives inside an array of
// objects rather than on the record itself.
const NESTED_ITEM_FIELDS = new Set(["items[].contactId"]);

function normaliseField(field) {
  return String(field).replace(/^items\[\d+\]\./, "items[].");
}

// Each record type's OWN declared default, imported by its real name rather
// than guessed at. This map exists so `fieldIsArray` reads the same literal
// the repository's own defensive-default merge reads, which is what makes
// "is this field a list" a fact rather than an assumption. Three of these
// names are not what you would guess (`DEFAULT_SYMPTOM_ENTRY`, not
// DEFAULT_SYMPTOM_LOG; `DEFAULT_CONTRACEPTION_ENTRY`; `DEFAULT_CYCLE`),
// which is exactly why they are imported by name rather than probed for.
const DECLARED_DEFAULTS = {
  Contact: DEFAULT_CONTACT,
  Encounter: DEFAULT_ENCOUNTER,
  Test: DEFAULT_TEST,
  "Clinic Visit": DEFAULT_CLINIC_VISIT,
  Vaccination: DEFAULT_VACCINATION,
  Episode: DEFAULT_EPISODE,
  Location: DEFAULT_LOCATION,
  "Symptom Log entry": DEFAULT_SYMPTOM_ENTRY,
  Measurement: DEFAULT_MEASUREMENT,
  "Contraception entry": DEFAULT_CONTRACEPTION_ENTRY,
  "Menstrual cycle entry": DEFAULT_CYCLE,
  "My Profile": DEFAULT_PROFILE,
};

// What shape is this field, if it is knowable at all?
//
// An earlier version of this answered "assume scalar" for a field it could
// not resolve, on the reasoning that a scalar clear writes null whereas
// wrongly clearing a list to null would lose every other id in it. That
// reasoning was backwards and the unit tests caught it: treating an
// unresolvable LIST as scalar writes null and destroys the whole list, which
// is strictly worse than the alternative, and it is exactly the failure
// this whole file is designed to make impossible.
//
// So the answer for an unknown shape is not a guess in either direction, it
// is refusal. Not knowing what a field holds means not touching it. The
// referenceRepair.test.js case that caught this is My Profile's own
// relationshipContactIds, which has a real DEFAULT_PROFILE declaring it as a
// list and would have had every remaining relationship contact cleared.
async function resolveShape(recordType, field) {
  const declared = DECLARED_DEFAULTS[recordType]?.[field];
  if (Array.isArray(declared)) return "list";
  if (declared !== undefined) return "scalar";
  return null;
}

// One place the UI asks what it can do about an orphan, so the screen never
// has to know the three shapes.
export async function describeRepair(orphan) {
  const field = normaliseField(orphan.field);
  const entryKey = ENTRY_ID_KEYS[field];
  const isNested = NESTED_ITEM_FIELDS.has(field);
  const derived = isNested ? "nested" : entryKey ? "entries" : await resolveShape(orphan.recordType, field);
  const hasRepo = Boolean(RECORD_REPOSITORIES[orphan.recordType]);
  const canRepair = hasRepo && derived !== null && !isNested;
  const canRepoint = canRepair && Boolean(TARGET_SOURCES[orphan.targetType]) && derived !== "nested";
  let reason = null;
  if (!hasRepo) reason = `No repository is registered for ${orphan.recordType}, so this cannot be repaired from here.`;
  else if (isNested) reason = "This one lives inside a notification checklist item, so it is cleared by editing that list directly.";
  else if (derived === null) reason = `The shape of ${orphan.field} is not declared anywhere, so nothing here is willing to guess at what it holds.`;
  return { kind: derived, entryKey, canRepair, canRepoint, reason };
}

async function readCurrentValue(orphan) {
  const entry = RECORD_REPOSITORIES[orphan.recordType];
  if (!entry) return undefined;
  const record = entry.singleton
    ? await entry.repo.getProfile()
    : await entry.repo.getById(orphan.recordId);
  return record?.[orphan.field];
}

async function writeValue(orphan, value) {
  const entry = RECORD_REPOSITORIES[orphan.recordType];
  if (!entry) throw new Error(`No repository registered for ${orphan.recordType}`);
  if (entry.singleton) return entry.repo.update({ [orphan.field]: value });
  return entry.repo.update(orphan.recordId, { [orphan.field]: value });
}

export async function repairOptions(orphan) {
  const source = TARGET_SOURCES[orphan.targetType];
  if (!source) return [];
  const all = await source.getAll();
  return all
    .filter((r) => !r.isArchived && r.id !== orphan.danglingId)
    .map((r) => ({ id: r.id, label: source.label(r) || r.id }));
}

// Removes ONLY the dangling id from a list, rather than emptying the field.
// A record pointing at three contacts where one was deleted still has two
// perfectly good ones, and clearing the whole field would silently discard
// real data to fix a problem that one entry caused. This is the single most
// destructive thing a repair could plausibly do, so it is the one thing
// deliberately not done.
function removeFromList(current, danglingId, kind, entryKey) {
  const list = Array.isArray(current) ? current : [];
  if (kind === "entries") return list.filter((e) => e?.[entryKey] !== danglingId);
  return list.filter((id) => id !== danglingId);
}

function putInList(current, danglingId, newId, kind, entryKey) {
  const list = Array.isArray(current) ? current : [];
  if (kind === "entries") return list.map((e) => (e?.[entryKey] === danglingId ? { ...e, [entryKey]: newId } : e));
  return list.map((id) => (id === danglingId ? newId : id));
}

// Returns the previous value so the caller can offer a real undo. An undo
// that reconstructs the field from a summary would itself be a second thing
// that can be wrong; keeping the exact prior value cannot drift.
export async function clearDanglingReference(orphan) {
  const shape = await describeRepair(orphan);
  if (!shape.canRepair) throw new Error(shape.reason || "This one cannot be repaired from here.");
  const previous = await readCurrentValue(orphan);
  let next;
  if (shape.kind === "scalar") next = null;
  else next = removeFromList(previous, orphan.danglingId, shape.kind, shape.entryKey);
  await writeValue(orphan, next);
  return { previous };
}

export async function repointDanglingReference(orphan, newTargetId) {
  const shape = await describeRepair(orphan);
  if (!shape.canRepoint) throw new Error(shape.reason || "This one cannot be re-pointed from here.");
  if (!newTargetId) throw new Error("Pick which record this should point at.");
  const previous = await readCurrentValue(orphan);
  let next;
  if (shape.kind === "scalar") next = newTargetId;
  else next = putInList(previous, orphan.danglingId, newTargetId, shape.kind, shape.entryKey);
  await writeValue(orphan, next);
  return { previous };
}

export async function undoRepair(orphan, previousValue) {
  await writeValue(orphan, previousValue);
}

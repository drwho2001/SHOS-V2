// optionListUsage.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask (#75): "click entry to view associated records" and
// "reassociate an archived term with entries." Option-list values
// (customOptionListsRepository.js) are plain strings stored directly
// on records, not id-references like a real Registry — so, unlike
// registryUsage.js's `computeXUsage(id)`, there's no back-reference to
// follow. This file is the same "scan every repository that CAN hold
// this value" approach, applied to plain-string fields instead of ids.
//
// SOURCES below is the one place this mapping lives — confirmed by
// reading each repository's own DEFAULT_* shape directly, not guessed.
// A source is either a real collection repository (getAll/getById/
// update(id, changes)) or MyProfileRepository, the one singleton that
// can hold one of these values (gender/pronouns/contraception/
// relationshipStatus) — handled via `singleton: true` since it has no
// id and its own update(changes) takes no id argument.
import { MedicationRepository } from "../repositories/medicationRepository.js";
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository.js";
import { TestingRepository } from "../repositories/testingRepository.js";
import { VaccinationRepository } from "../repositories/vaccinationRepository.js";
import { EpisodeRepository } from "../repositories/episodeRepository.js";
import { ContactRepository } from "../repositories/contactRepository.js";
import { MyProfileRepository } from "../repositories/myProfileRepository.js";
import { MeasurementRepository } from "../repositories/measurementRepository.js";
import { MenstrualCycleRepository } from "../repositories/menstrualCycleRepository.js";

const label = {
  medication: (r) => r.name || "Untitled medication",
  clinicVisit: (r) => r.title || "Untitled clinic visit",
  test: (r) => r.title || "Untitled test",
  vaccination: (r) => r.title || "Untitled vaccination",
  episode: (r) => r.title || "Untitled episode",
  contact: (r) => r.name || "Unnamed contact",
  measurement: (r) => (r.date ? `${r.type || "Measurement"} · ${new Date(r.date).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}` : r.type || "Measurement"),
  cycle: (r) => (r.startDate ? `Cycle starting ${new Date(r.startDate).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}` : "Cycle"),
};

// moduleKey is used only to route a "view this record" tap — matches
// the module-key vocabulary already established by calendarModuleAccent()
// in calendarCalculations.js, not a new naming scheme.
const SOURCES = {
  medicationType: [{ repo: MedicationRepository, field: "medicationType", isArray: false, moduleKey: "medication", getLabel: label.medication }],
  route: [{ repo: MedicationRepository, field: "route", isArray: false, moduleKey: "medication", getLabel: label.medication }],
  medicationCategory: [{ repo: MedicationRepository, field: "category", isArray: true, moduleKey: "medication", getLabel: label.medication }],
  reasonForVisit: [{ repo: ClinicVisitsRepository, field: "reasonForVisit", isArray: true, moduleKey: "clinicVisit", getLabel: label.clinicVisit }],
  followUpType: [{ repo: ClinicVisitsRepository, field: "followUpType", isArray: false, moduleKey: "clinicVisit", getLabel: label.clinicVisit }],
  sampleType: [{ repo: TestingRepository, field: "sampleType", isArray: true, moduleKey: "test", getLabel: label.test }],
  vaccine: [{ repo: VaccinationRepository, field: "vaccine", isArray: false, moduleKey: "vaccination", getLabel: label.vaccination }],
  vaccinationReason: [{ repo: VaccinationRepository, field: "reason", isArray: true, moduleKey: "vaccination", getLabel: label.vaccination }],
  injectionSite: [{ repo: VaccinationRepository, field: "injectionSite", isArray: false, moduleKey: "vaccination", getLabel: label.vaccination }],
  episodeTriggerReason: [{ repo: EpisodeRepository, field: "triggerReason", isArray: false, moduleKey: "episode", getLabel: label.episode }],
  relationshipType: [{ repo: ContactRepository, field: "relationshipType", isArray: true, moduleKey: "contact", getLabel: label.contact }],
  measurementType: [{ repo: MeasurementRepository, field: "type", isArray: false, moduleKey: "measurement", getLabel: label.measurement }],
  menstrualFlow: [{ repo: MenstrualCycleRepository, field: "flow", isArray: false, moduleKey: "cycle", getLabel: label.cycle }],
  gender: [
    { repo: ContactRepository, field: "gender", isArray: false, moduleKey: "contact", getLabel: label.contact },
    { repo: MyProfileRepository, field: "gender", isArray: false, singleton: true, moduleKey: "myProfile", getLabel: () => "My Profile" },
  ],
  pronouns: [
    { repo: ContactRepository, field: "pronouns", isArray: false, moduleKey: "contact", getLabel: label.contact },
    { repo: MyProfileRepository, field: "pronouns", isArray: false, singleton: true, moduleKey: "myProfile", getLabel: () => "My Profile" },
  ],
  contraception: [
    { repo: ContactRepository, field: "contraception", isArray: true, moduleKey: "contact", getLabel: label.contact },
    { repo: MyProfileRepository, field: "contraception", isArray: true, singleton: true, moduleKey: "myProfile", getLabel: () => "My Profile" },
  ],
  relationshipStatus: [{ repo: MyProfileRepository, field: "relationshipStatus", isArray: false, singleton: true, moduleKey: "myProfile", getLabel: () => "My Profile" }],
};

function hasValue(record, source, value) {
  const raw = record[source.field];
  return source.isArray ? (raw || []).includes(value) : raw === value;
}

// Returns [{ id, moduleKey, recordLabel }, ...] — id is null for the
// MyProfile singleton (there's only ever one, no id to navigate by).
export async function findRecordsUsingOptionValue(listName, value) {
  const sources = SOURCES[listName];
  if (!sources || !value) return [];
  const results = [];
  for (const source of sources) {
    if (source.singleton) {
      const record = await source.repo.getProfile();
      if (hasValue(record, source, value)) results.push({ id: null, moduleKey: source.moduleKey, recordLabel: source.getLabel(record) });
      continue;
    }
    const all = await source.repo.getAll();
    for (const record of all) {
      if (hasValue(record, source, value)) results.push({ id: record.id, moduleKey: source.moduleKey, recordLabel: source.getLabel(record) });
    }
  }
  return results;
}

// Reassociates every record using oldValue onto newValue — the real
// "reassociate an archived term" mechanism. For an array field, this
// swaps oldValue for newValue in place, deduping if newValue is
// already present (never leaves two copies of the same value in one
// record's own array). Returns how many records were actually changed.
export async function reassociateOptionValue(listName, oldValue, newValue) {
  const sources = SOURCES[listName];
  if (!sources || !oldValue || !newValue || oldValue === newValue) return 0;
  let changed = 0;
  for (const source of sources) {
    if (source.singleton) {
      const record = await source.repo.getProfile();
      if (!hasValue(record, source, oldValue)) continue;
      const next = source.isArray
        ? [...new Set((record[source.field] || []).map((v) => (v === oldValue ? newValue : v)))]
        : newValue;
      await source.repo.update({ [source.field]: next });
      changed += 1;
      continue;
    }
    const all = await source.repo.getAll();
    for (const record of all) {
      if (!hasValue(record, source, oldValue)) continue;
      const next = source.isArray
        ? [...new Set((record[source.field] || []).map((v) => (v === oldValue ? newValue : v)))]
        : newValue;
      await source.repo.update(record.id, { [source.field]: next });
      changed += 1;
    }
  }
  return changed;
}

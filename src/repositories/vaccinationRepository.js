// vaccinationRepository.js
//
// Real live Notion schema, fetched fresh this session — 11 fields:
// Vaccination Title, vaccination_id, Vaccine (Hepatitis A/B, HPV, Mpox,
// Gonorrhoea, Other), Reason (Routine/Occupational/High-risk status/
// Booster, multi-select), Dose Number, Date, Provider, Next Due,
// Injection Site (Deltoid/Gluteal/Other), Symptom (relation →
// Symptoms Registry), Clinic Visits (relation). Same defensive-default
// pattern as every repository this session, applied from creation.
//
// RELATIONSHIPS — both real and wired from creation, per the user's
// standing instruction ("wire every relationship that can now exist").
// Symptom reuses the Symptoms Registry vocabulary exactly as Doc 1
// specifies ("symptom relation reused from Symptoms Registry"), same
// pattern as Encounters/Clinic Visits' own symptom fields. Clinic
// Visits is a real, built module — wired as a genuine relation, stored
// as an array matching Notion's own relation shape.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";
import { SymptomsRegistry } from "../registries/symptomsRegistry.js";

const STORAGE_KEY = "shos_vaccinations";

// (VACCINE_OPTIONS/REASON_OPTIONS/INJECTION_SITE_OPTIONS moved to
// customOptionListsRepository.js, real in-app editable, per the user's
// ask — stored there as "vaccine"/"vaccinationReason"/"injectionSite".)

export const DEFAULT_VACCINATION = {
  title: "",
  vaccine: "",
  reason: [],
  doseNumber: null,
  date: null,
  provider: "",
  nextDue: null,
  injectionSite: "",
  notes: "",
  symptomIds: [],      // → SymptomsRegistry, real and wired
  clinicVisitIds: [],  // → ClinicVisitsRepository, real and wired
  isArchived: false,
};

// ADDED 1 Sep 2026 — real ask: richer example data — "positive sti
// symptoms (gonorrhoea, so vaccine later too)". Uses the app's own
// existing Gonorrhoea vaccine option (customOptionListsRepository.js's
// `vaccine` list already carries it — a real, current practice at some
// UK sexual health services offering 4CMenB for high-risk gonorrhoea
// cross-protection, not invented for this example). Relative date,
// after the treatment/TOC visit above.
function daysAgo(n, hour = 11, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

let seedVaccinations = [
  {
    ...DEFAULT_VACCINATION,
    id: "vaccination_001",
    title: "Gonorrhoea vaccine (4CMenB)",
    vaccine: "Gonorrhoea",
    reason: ["High-risk status"],
    doseNumber: 1,
    date: daysAgo(1),
    provider: "56 Dean Street",
    injectionSite: "Deltoid",
    notes: "Offered given recent Gonorrhoea diagnosis and ongoing risk.",
    isArchived: false,
  },
];

let vaccinations = storage.load(STORAGE_KEY, seedVaccinations);
let nextNumber = computeNextNumber(vaccinations);

function computeNextNumber(existing) {
  const numbers = existing.map((v) => {
    const match = /^vaccination_(\d+)$/.exec(v.id);
    return match ? parseInt(match[1], 10) : 0;
  });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

function generateId() {
  const id = `vaccination_${String(nextNumber).padStart(3, "0")}`;
  nextNumber += 1;
  return id;
}

function persist() {
  storage.save(STORAGE_KEY, vaccinations);
}

// FIXED 1 Sep 2026 — real ask: "Vaccination log symptoms not correct
// type." The edit form used to feed a plain string-toggle component
// the symptom's NAME instead of its id, so symptomIds — documented and
// named as real SymptomsRegistry ids, same as every other module's own
// symptom relation — actually held name strings for anyone who'd
// already logged one before that fix. Self-heals on read: anything in
// symptomIds that isn't a real registry id but does match an existing
// entry's name is resolved forward to that entry's real id, same
// graceful on-read-repair pattern already used elsewhere in this app
// (Symptom Log's own normalizeSymptomIds) rather than a one-time
// destructive migration.
function normalizeSymptomIds(entry) {
  if (!entry.symptomIds || entry.symptomIds.length === 0) return entry;
  const fixed = entry.symptomIds.map((value) => {
    if (SymptomsRegistry.getById(value)) return value;
    const byName = SymptomsRegistry.getAll().find((s) => s.name === value);
    return byName ? byName.id : value;
  });
  return { ...entry, symptomIds: fixed };
}

export const VaccinationRepository = {
  getAll() {
    return structuredClone(vaccinations.map((v) => normalizeSymptomIds({ ...DEFAULT_VACCINATION, ...v })));
  },

  getById(id) {
    const found = vaccinations.find((v) => v.id === id);
    return found ? structuredClone(normalizeSymptomIds({ ...DEFAULT_VACCINATION, ...found })) : null;
  },

  // Real convenience read — same "compute the derived state, don't
  // store it" principle as Testing's investigation-status logic
  // (Follow-up Actioned Date empty = Open). Overdue = Next Due set and
  // in the past.
  getOverdue() {
    const today = new Date().toISOString().slice(0, 10);
    return this.getAll().filter((v) => !v.isArchived && v.nextDue && v.nextDue < today);
  },

  create(data) {
    const newVaccination = {
      ...DEFAULT_VACCINATION,
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      isArchived: false,
    };
    vaccinations = [...vaccinations, newVaccination];
    persist();
    return newVaccination;
  },

  update(id, changes) {
    let updated = null;
    vaccinations = vaccinations.map((v) => {
      if (v.id !== id) return v;
      // ADDED 26 Aug 2026 — real ask: last-updated indicator, rolled
      // out consistently across every module.
      updated = { ...v, ...changes, updatedAt: new Date().toISOString() };
      return updated;
    });
    persist();
    return updated ? structuredClone({ ...DEFAULT_VACCINATION, ...updated }) : null;
  },

  archive(id) {
    return this.update(id, { isArchived: true });
  },

  // ADDED — real ask: "no delete option" — same reasoning as Testing's
  // own delete(): archive stays correct for anything real that's just
  // outdated, this is specifically for a genuinely wrong entry.
  delete(id) {
    vaccinations = vaccinations.filter((v) => v.id !== id);
    persist();
  },

  unarchive(id) {
    return this.update(id, { isArchived: false });
  },

  // ADDED 26 Aug 2026 — real ask: long-press multi-select rolled out
  // to every module.
  bulkArchive(ids) {
    ids.forEach((id) => this.archive(id));
  },

  bulkDelete(ids) {
    vaccinations = vaccinations.filter((v) => !ids.includes(v.id));
    persist();
  },

  // ADDED 26 Aug 2026 — real ask: undo for delete, not just archive.
  restore(record) {
    if (vaccinations.some((v) => v.id === record.id)) return;
    vaccinations = [...vaccinations, record];
    persist();
  },

  replaceAll(newVaccinations) {
    vaccinations = newVaccinations;
    nextNumber = computeNextNumber(vaccinations);
    persist();
  },
};

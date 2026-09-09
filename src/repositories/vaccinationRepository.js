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
// ADDED — real gap found via the new orphan-reference checker
// (orphanReferenceCheck.js): delete-time cleanup needs both directions
// of the Vaccination↔Clinic Visits relationship — clinicVisitsRepository.js
// imports this file right back, a genuine circular import, safe here
// because every use on both sides is a method CALL deferred inside a
// function body (delete()), never read at module-evaluation time.
import { ClinicVisitsRepository } from "./clinicVisitsRepository.js";

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
  // ADDED — real ask: "vaccinate MenB" — the same 4CMenB vaccine's own
  // literal, on-label purpose, distinct from vaccination_001's
  // off-label Gonorrhoea cross-protection use above. Earlier in the
  // 4-month window (routine), not connected to the STI episode.
  {
    ...DEFAULT_VACCINATION,
    id: "vaccination_002",
    title: "Meningitis B vaccine (4CMenB)",
    vaccine: "Meningitis B",
    reason: ["Routine"],
    doseNumber: 1,
    date: daysAgo(100),
    provider: "56 Dean Street",
    injectionSite: "Deltoid",
    notes: "Routine MenB vaccination, offered opportunistically at a clinic visit.",
    isArchived: false,
  },
  // ADDED 9 Sep 2026 — real ask: neither existing entry sets nextDue,
  // doseNumber > 1, or a non-Deltoid injectionSite — a real 2-dose
  // Hepatitis A/B course (Twinrix) exercises all three plus a genuine
  // clinicVisitIds link, none of which any existing seed vaccination
  // covers.
  {
    ...DEFAULT_VACCINATION,
    id: "vaccination_003",
    title: "Hepatitis A/B vaccine (Twinrix), dose 1",
    vaccine: "Hepatitis A/B",
    reason: ["Routine"],
    doseNumber: 1,
    date: daysAgo(160),
    provider: "56 Dean Street",
    injectionSite: "Deltoid",
    clinicVisitIds: ["visit_005"],
    notes: "First of a 3-dose Twinrix course, offered at the routine annual screen.",
    isArchived: false,
  },
  {
    ...DEFAULT_VACCINATION,
    id: "vaccination_004",
    title: "Hepatitis A/B vaccine (Twinrix), dose 2",
    vaccine: "Hepatitis A/B",
    reason: ["Routine"],
    doseNumber: 2,
    date: daysAgo(130),
    nextDue: daysAgo(-20),
    provider: "56 Dean Street",
    injectionSite: "Gluteal",
    notes: "Second dose, on schedule. Third and final dose due at the 6-month mark.",
    isArchived: false,
  },
];

// CHANGED — Phase 2 encryption groundwork: ensureLoaded()/memoized-
// loadPromise pattern, same as every other module-load-cached
// repository converted this session (see CLAUDE.md).
let vaccinations = null;
let nextNumber = null;
let loadPromise = null;
async function ensureLoaded() {
  if (vaccinations === null) {
    if (!loadPromise) loadPromise = storage.load(STORAGE_KEY, seedVaccinations);
    vaccinations = await loadPromise;
    nextNumber = computeNextNumber(vaccinations);
  }
  return vaccinations;
}

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

async function persist() {
  await storage.save(STORAGE_KEY, vaccinations);
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
// CHANGED — Phase 2 encryption groundwork: SymptomsRegistry is now
// async — this is now async too, awaited at both call sites below
// (getAll() needs Promise.all since it applies this per-entry).
async function normalizeSymptomIds(entry) {
  if (!entry.symptomIds || entry.symptomIds.length === 0) return entry;
  const fixed = await Promise.all(entry.symptomIds.map(async (value) => {
    if (await SymptomsRegistry.getById(value)) return value;
    const byName = (await SymptomsRegistry.getAll()).find((s) => s.name === value);
    return byName ? byName.id : value;
  }));
  return { ...entry, symptomIds: fixed };
}

export const VaccinationRepository = {
  async getAll() {
    await ensureLoaded();
    return structuredClone(await Promise.all(vaccinations.map((v) => normalizeSymptomIds({ ...DEFAULT_VACCINATION, ...v }))));
  },

  async getById(id) {
    await ensureLoaded();
    const found = vaccinations.find((v) => v.id === id);
    return found ? structuredClone(await normalizeSymptomIds({ ...DEFAULT_VACCINATION, ...found })) : null;
  },

  // Real convenience read — same "compute the derived state, don't
  // store it" principle as Testing's investigation-status logic
  // (Follow-up Actioned Date empty = Open). Overdue = Next Due set and
  // in the past.
  async getOverdue() {
    const today = new Date().toISOString().slice(0, 10);
    return (await this.getAll()).filter((v) => !v.isArchived && v.nextDue && v.nextDue < today);
  },

  async create(data) {
    await ensureLoaded();
    const newVaccination = {
      ...DEFAULT_VACCINATION,
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      isArchived: false,
    };
    vaccinations = [...vaccinations, newVaccination];
    await persist();
    return newVaccination;
  },

  async update(id, changes) {
    await ensureLoaded();
    let updated = null;
    vaccinations = vaccinations.map((v) => {
      if (v.id !== id) return v;
      // ADDED 26 Aug 2026 — real ask: last-updated indicator, rolled
      // out consistently across every module.
      updated = { ...v, ...changes, updatedAt: new Date().toISOString() };
      return updated;
    });
    await persist();
    return updated ? structuredClone({ ...DEFAULT_VACCINATION, ...updated }) : null;
  },

  async archive(id) {
    return this.update(id, { isArchived: true });
  },

  // ADDED — real ask: "no delete option" — same reasoning as Testing's
  // own delete(): archive stays correct for anything real that's just
  // outdated, this is specifically for a genuinely wrong entry.
  async delete(id) {
    await ensureLoaded();
    vaccinations = vaccinations.filter((v) => v.id !== id);
    await persist();
    // ADDED — real gap found via the new orphan-reference checker
    // (orphanReferenceCheck.js): Clinic Visit's own vaccinationsGivenIds
    // references a Vaccination by id — only clears the link, same role
    // as measurementRepository.js's own unlink methods.
    ClinicVisitsRepository.unlinkVaccination(id);
  },

  async unarchive(id) {
    return this.update(id, { isArchived: false });
  },

  // ADDED — real gap found via the new orphan-reference checker
  // (orphanReferenceCheck.js): clinicVisitIds needs cleaning up when
  // the Clinic Visit it points at is hard-deleted elsewhere — called
  // by clinicVisitsRepository.js's own delete().
  async unlinkClinicVisit(visitId) {
    await ensureLoaded();
    vaccinations = vaccinations.map((v) => ({ ...v, clinicVisitIds: (v.clinicVisitIds || []).filter((id) => id !== visitId) }));
    await persist();
  },

  // ADDED 26 Aug 2026 — real ask: long-press multi-select rolled out
  // to every module.
  async bulkArchive(ids) {
    for (const id of ids) await this.archive(id);
  },

  async bulkDelete(ids) {
    await ensureLoaded();
    vaccinations = vaccinations.filter((v) => !ids.includes(v.id));
    await persist();
    for (const id of ids) ClinicVisitsRepository.unlinkVaccination(id);
  },

  // ADDED 26 Aug 2026 — real ask: undo for delete, not just archive.
  async restore(record) {
    await ensureLoaded();
    if (vaccinations.some((v) => v.id === record.id)) return;
    vaccinations = [...vaccinations, record];
    await persist();
  },

  async replaceAll(newVaccinations) {
    vaccinations = newVaccinations;
    nextNumber = computeNextNumber(vaccinations);
    await persist();
  },
};

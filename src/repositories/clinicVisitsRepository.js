// clinicVisitsRepository.js
//
// Real Notion schema (Clinic Visits database, fetched live 19 Aug 2026
// — confirmed 🟢 Fixed as of the 31 Jul 2026 Backend Verification
// Report). Same defensive-default pattern as every repository this
// session, applied from creation.
//
// RELATIONSHIPS — the user's own instruction applied consistently: "add
// relationships if the module is largely complete and appropriate to
// do so." Testing, Medicines Registry, Symptoms Registry, and Results
// Registry all exist as real modules now, so those four relations are
// REAL and wired here — not stubbed.
//
// CHANGED 19 Aug 2026, real feedback-batch pass — two fields that were
// stubbed pending modules that didn't exist yet are now real, because
// those modules got built earlier THIS SAME SESSION:
// - symptomsDiscussedIds → SymptomLogRepository (dated occurrences,
//   not the Symptoms Registry vocabulary — genuinely different from
//   symptomTypeIds below, see the field's own comment).
// - vaccinationsGivenIds → VaccinationRepository.
// The original backlog note said "fold Vaccination into Medications
// given until Vaccinations exists as its own module" — that
// conditional is now moot, Vaccinations IS its own real module, so
// this wires the real thing instead of the workaround that was only
// ever meant to be temporary.
//
// REMOVED, per the user's own explicit conclusion during the feedback
// batch: a standalone `resultIds` field, previously a real relation to
// Results Registry. The user's reasoning, verbatim in spirit: "Results
// should NOT be re-entered here at all — that's a duplicate, belongs
// in Testing only, should link/embed instead." A Clinic Visit's own
// "result" IS whatever its linked Test's real result already is — the
// UI now reads that live through `linkedTestIds` instead of storing a
// second, independently-editable copy that could drift out of sync.
// Flagged OBSOLETE below rather than silently deleted, same standing
// pattern as every other retired field this project (e.g. Medication
// Log's old Next refill date) — old visits that still have this data
// keep it, nothing is lost, it's just no longer read or written by
// the UI.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";
// ADDED — Measurements: deleting a visit must clear any Measurement's
// link to it, never delete the Measurement itself (see
// measurementRepository.js's own "one room, three doors" comment).
import { MeasurementRepository } from "./measurementRepository.js";

const STORAGE_KEY = "shos_clinic_visits";

export const CLINICIAN_OPTIONS = ["Lucy", "Jonathan", "Black doctor male", "Hayley", "Gavin"];
// CHANGED 19 Aug 2026 — REASON_FOR_VISIT_OPTIONS/FOLLOW_UP_TYPE_OPTIONS
// moved into customOptionListsRepository.js (real in-app editable, per
// The user's ask). Removed here to avoid two sources of truth.
// ADDED 19 Aug 2026 — real feedback batch: an explicit "arrange
// follow-up" concept, distinct from nextReviewDate (which is just a
// date with no stated purpose). This says WHAT KIND of follow-up, the
// date field next to it says WHEN.
// (FOLLOW_UP_TYPE_OPTIONS also moved — see comment above.)

// ADDED — real ask: "allow for more than one" clinician. `clinician`
// changed from a plain string to an array, but real existing data
// (including the user's own imported real records) still has it stored as
// a plain string — this normalizes on every read, same defensive-
// merge spirit already used everywhere else in this app (e.g. the
// Kink Registry's own legacy-casing migration), so nothing needs a
// one-time rewrite and old records keep working exactly as before.
function normalizeClinician(visit) {
  if (Array.isArray(visit.clinician)) return visit;
  return { ...visit, clinician: visit.clinician ? [visit.clinician] : [] };
}

export const DEFAULT_CLINIC_VISIT = {
  title: "",
  date: null,
  location: "",
  // CHANGED 19 Aug 2026 — real feedback batch: "Clinician should be
  // free text, not a fixed list, and not mandatory." Stays a plain
  // string (it already was one) — only the UI changes, from a
  // constrained <select> to a free-text field with suggestion chips
  // drawn from CLINICIAN_OPTIONS plus whatever's actually been typed
  // before. No data-shape change needed here.
  clinician: [],
  reasonForVisit: [],
  // CHANGED 19 Aug 2026 — real feedback batch: rephrased in the UI as
  // an explicit yes/no question rather than a plain toggle with a
  // one-word label — the underlying boolean is unchanged.
  isFutureAppointment: false,
  nextReviewDate: null,
  // ADDED 19 Aug 2026 — pairs with nextReviewDate above: WHAT KIND of
  // follow-up is arranged, not just when. See FOLLOW_UP_TYPE_OPTIONS.
  followUpType: "",
  clinicalNotes: "",
  linkedTestIds: [],       // → TestingRepository, real and wired (two-way — see testingRepository.js)
  medicationsGivenIds: [], // → MedicationRepository, real and wired — meds the user already tracks (e.g. DoxyPEP given here)
  // ADDED 19 Aug 2026 — real feedback batch: medications given in-clinic
  // that AREN'T in the user's personal Medication tracker (e.g. a one-off
  // IM antibiotic like Ceftriaxone) — genuinely different from
  // medicationsGivenIds above, which only covers meds the user already
  // tracks as his own. Each entry: { id, name, notes }. Deliberately
  // NOT forced into MedicationRepository — that repository represents
  // The user's own ongoing self-administered medications, not incidental
  // clinic-administered treatment.
  adHocMedicationsGiven: [],
  symptomTypeIds: [],      // → SymptomsRegistry (vocabulary tags — "what kinds of symptoms came up"), real and wired
  // CHANGED 19 Aug 2026 — now real, see file header. Genuinely
  // different from symptomTypeIds above: this points at actual dated
  // Symptom Log occurrences ("which specific symptom entries did we
  // discuss"), not the tag vocabulary.
  symptomsDiscussedIds: [],
  // ADDED 19 Aug 2026 — real feedback batch: "flagging this symptom is
  // why I'm here" — which ONE of symptomsDiscussedIds (if any) was the
  // actual reason for the visit, distinct from symptoms merely
  // mentioned/discussed along the way.
  primaryReasonSymptomLogId: "",
  // OBSOLETE 19 Aug 2026 — see file header for the full reasoning.
  // Old visits keep whatever's here; the UI no longer reads or writes
  // it. A linked Test's own real result is what the UI shows instead.
  resultIds: [],
  attachments: [],         // real, wired — same shape/pattern as Testing's
  // CHANGED 19 Aug 2026 — now real, see file header.
  vaccinationsGivenIds: [],
  isArchived: false,
};

function generateAttachmentId() {
  return `attachment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateAdHocMedId() {
  return `adhocmed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
// Exported so the UI can generate a consistent ID when adding an
// ad-hoc medication entry, same pattern already used for attachments.
export { generateAdHocMedId };

// ADDED 1 Sep 2026 — real ask: richer example data — the treatment
// visit half of the example Timeline episode (see episodeRepository.js's
// own seed for the full arc). Uses a real, well-known London sexual
// health clinic name, per the user's own "use like London clinic" ask.
// Relative date, same daysAgo approach used throughout this session's
// other seed data.
function daysAgo(n, hour = 14, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

let seedVisits = [
  {
    ...DEFAULT_CLINIC_VISIT,
    id: "visit_001",
    title: "Treatment — Gonorrhoea",
    date: daysAgo(7),
    location: "56 Dean Street",
    clinician: ["Hayley"],
    reasonForVisit: ["Treatment"],
    clinicalNotes: "Confirmed Gonorrhoea on symptomatic screen. Single-dose antibiotic given in clinic. TOC (test of cure) advised in 2 weeks. Partner notification checklist started.",
    linkedTestIds: ["test_001", "test_002"],
    adHocMedicationsGiven: [{ id: "adhocmed_seed_001", name: "Ceftriaxone 1g IM", notes: "Single dose, given in clinic." }],
    symptomTypeIds: ["symptom_cat_001"],
    symptomsDiscussedIds: ["symlog_001"],
    primaryReasonSymptomLogId: "symlog_001",
    isArchived: false,
  },
];

let visits = storage.load(STORAGE_KEY, seedVisits);
let nextVisitNumber = computeNextVisitNumber(visits);

function computeNextVisitNumber(existing) {
  const numbers = existing.map((v) => {
    const match = /^visit_(\d+)$/.exec(v.id);
    return match ? parseInt(match[1], 10) : 0;
  });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

function generateVisitId() {
  const id = `visit_${String(nextVisitNumber).padStart(3, "0")}`;
  nextVisitNumber += 1;
  return id;
}

function persist() {
  storage.save(STORAGE_KEY, visits);
}

export const ClinicVisitsRepository = {
  getAll() {
    return structuredClone(visits.map((v) => normalizeClinician({ ...DEFAULT_CLINIC_VISIT, ...v })));
  },

  getById(id) {
    const found = visits.find((v) => v.id === id);
    return found ? structuredClone(normalizeClinician({ ...DEFAULT_CLINIC_VISIT, ...found })) : null;
  },

  // Every visit that references a given test — the read side of the
  // two-way Testing↔Clinic Visits link (see testingRepository.js's own
  // getByClinicVisit-equivalent usage in the Testing module's detail
  // view).
  getByLinkedTest(testId) {
    return structuredClone(
      visits.filter((v) => (v.linkedTestIds || []).includes(testId)).map((v) => normalizeClinician({ ...DEFAULT_CLINIC_VISIT, ...v }))
    );
  },

  create(data) {
    const newVisit = normalizeClinician({
      ...DEFAULT_CLINIC_VISIT,
      ...data,
      id: generateVisitId(),
      createdAt: new Date().toISOString(),
      isArchived: false,
    });
    visits = [...visits, newVisit];
    persist();
    return newVisit;
  },

  update(id, changes) {
    let updated = null;
    visits = visits.map((v) => {
      if (v.id !== id) return v;
      // ADDED 26 Aug 2026 — real ask: last-updated indicator, rolled
      // out consistently across every module.
      updated = { ...v, ...changes, updatedAt: new Date().toISOString() };
      return updated;
    });
    persist();
    return updated ? structuredClone({ ...DEFAULT_CLINIC_VISIT, ...updated }) : null;
  },

  archive(id) {
    return this.update(id, { isArchived: true });
  },

  // ADDED — real ask: "no delete option" — same reasoning as Testing/
  // Vaccinations/Symptom Log's own delete(): archive stays correct for
  // anything real that's just outdated, this is specifically for a
  // genuinely wrong entry.
  delete(id) {
    visits = visits.filter((v) => v.id !== id);
    persist();
    MeasurementRepository.unlinkClinicVisit(id);
  },

  // ADDED 26 Aug 2026 — real ask: long-press multi-select rolled out
  // to every module.
  bulkArchive(ids) {
    ids.forEach((id) => this.archive(id));
  },

  bulkDelete(ids) {
    visits = visits.filter((v) => !ids.includes(v.id));
    persist();
    ids.forEach((id) => MeasurementRepository.unlinkClinicVisit(id));
  },

  // ADDED 26 Aug 2026 — real ask: undo for delete, not just archive.
  restore(record) {
    if (visits.some((v) => v.id === record.id)) return;
    visits = [...visits, record];
    persist();
  },

  addAttachment(visitId, { title, type, fileDataUrl }) {
    const attachment = {
      id: generateAttachmentId(),
      title: title || "Untitled",
      type: type || "Other",
      date: new Date().toISOString(),
      fileDataUrl: fileDataUrl || "",
    };
    return this.update(visitId, {
      attachments: [...(this.getById(visitId)?.attachments || []), attachment],
    });
  },

  removeAttachment(visitId, attachmentId) {
    const visit = this.getById(visitId);
    if (!visit) return null;
    return this.update(visitId, {
      attachments: visit.attachments.filter((a) => a.id !== attachmentId),
    });
  },

  replaceAll(newVisits) {
    visits = newVisits;
    persist();
  },
};

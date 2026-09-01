// pregnancyRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// One entry per pregnancy test taken. `testResult` alone covers a
// negative/inconclusive test with no further implications; a Positive
// result sets `status` to "Ongoing", which later moves directly to one
// of OUTCOME_OPTIONS once resolved — one field for the whole
// lifecycle, not a separate status/outcome pair (an earlier version
// had both, and shapeForSave() never actually moved status off
// "Ongoing" when the outcome was set — getActive() kept reporting a
// resolved pregnancy as still active. Collapsing to one field made the
// bug impossible, not just fixed).
//
// DELIBERATELY NOT folded into Testing: Testing's whole shape assumes
// an Organism (OrganismRegistry/ResultsRegistry) — a pregnancy test
// doesn't have one, that field would sit permanently blank on every
// entry. Same reasoning Locations got its own file instead of being
// force-fit into the smaller registries.
//
// PREGNANCY GATES CYCLE/CONTRACEPTION, at the UI layer only — see
// getActive() below, read by the screen that also renders
// menstrualCycleRepository.js/contraceptionRepository.js's own data to
// decide whether to show cycle/contraception prompts as paused. Ending
// in Miscarriage/Abortion/Ectopic is real, visible data — never
// hidden by that gating, only optionally masked per-entry (see
// `sensitive` below), which is a completely separate, user-controlled
// thing.
//
// `sensitive` — real ask: "ability to hide miscarriage/abortion, may
// be distressing even if factual." Defaults to true automatically the
// moment status changes to Miscarriage/Abortion/Ectopic (see
// shapeForSave below), but always user-togglable either way — this
// masks the entry in the UI (a neutral "tap to reveal" placeholder,
// same pattern already proven in Testing's own resultPending/
// revealEarly), it never removes or blocks the data itself.
//
// `testResult`/`status` are fixed lists, not user-editable — same
// reasoning Testing's own `testingFor`/`Setting` fields stay fixed:
// getting one of these wrong has real downside, unlike a cosmetic
// option list.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_pregnancies";

export const TEST_RESULT_OPTIONS = ["Positive", "Negative", "Inconclusive"];
export const OUTCOME_OPTIONS = ["Live birth", "Miscarriage", "Abortion", "Ectopic", "Other"];
const SENSITIVE_BY_DEFAULT = ["Miscarriage", "Abortion", "Ectopic"];

// CHANGED — real bug found in testing, and a real redundancy the user
// flagged separately ("try not to repeat descriptors"): this used to
// have both a `status` field AND a separate `outcome` field doing
// overlapping jobs, and shapeForSave() below never actually moved
// `status` off "Ongoing" when `outcome` was set — getActive() kept
// reporting a resolved (e.g. miscarried) pregnancy as still active.
// One field now: `status` holds "" (not positive) → "Ongoing" →
// directly one of OUTCOME_OPTIONS once resolved. No second field that
// can drift out of sync with the first.
export const DEFAULT_PREGNANCY = {
  testDate: null,
  testResult: "",
  estimatedDueDate: null,
  status: "",          // "Ongoing", or one of OUTCOME_OPTIONS once resolved; "" if testResult isn't Positive
  outcomeDate: null,   // set when status moves off "Ongoing"
  sensitive: false,
  notes: "",
  isArchived: false,
};

// ADDED — real example data. Deliberately just one, deliberately
// Negative: a fabricated Miscarriage/Abortion example as permanent
// seed data on every fresh install would manufacture sensitive content
// nobody asked for, on top of a feature this module already keeps
// off by default — the masking behaviour itself is proven correct by
// this repository's own logic (see shapeForSave), not by shipping a
// synthetic distressing entry to demonstrate it.
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
let seedPregnancies = [
  { ...DEFAULT_PREGNANCY, id: "pregnancy_001", testDate: daysAgo(40), testResult: "Negative", notes: "Precautionary test." },
];

let pregnancies = storage.load(STORAGE_KEY, seedPregnancies);
let nextNumber = computeNextNumber(pregnancies);

function computeNextNumber(existing) {
  const numbers = existing.map((p) => {
    const match = /^pregnancy_(\d+)$/.exec(p.id);
    return match ? parseInt(match[1], 10) : 0;
  });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

function generateId() {
  const id = `pregnancy_${String(nextNumber).padStart(3, "0")}`;
  nextNumber += 1;
  return id;
}

function persist() {
  storage.save(STORAGE_KEY, pregnancies);
}

// `existing` is the prior stored record (empty object on create),
// `changes` is exactly what THIS call is setting — kept separate,
// rather than one pre-merged object, so the sensitive-default check
// below can tell "this call didn't mention sensitive" apart from
// "this record already had sensitive: false from before", which a
// single merged object can't distinguish (real bug caught in testing:
// the merged form meant the default never fired on update(), only on
// the rarer direct-creation-with-an-outcome path).
function shapeForSave(existing, changes) {
  const shaped = { ...DEFAULT_PREGNANCY, ...existing, ...changes };
  if (shaped.testResult === "Positive" && !shaped.status) shaped.status = "Ongoing";
  if (shaped.testResult !== "Positive") { shaped.status = ""; shaped.outcomeDate = null; }
  // Real default, not a lock — see file-level comment. Only applies
  // the moment status actually CHANGES to an outcome, and only if this
  // call didn't itself specify sensitive — never re-forces it back on
  // if the user has deliberately un-masked this entry on a later edit.
  const justResolvedToOutcome = OUTCOME_OPTIONS.includes(shaped.status) && existing?.status !== shaped.status;
  if (justResolvedToOutcome && changes.sensitive === undefined && SENSITIVE_BY_DEFAULT.includes(shaped.status)) {
    shaped.sensitive = true;
  }
  return shaped;
}

export const PregnancyRepository = {
  getAll() {
    return structuredClone(pregnancies.map((p) => ({ ...DEFAULT_PREGNANCY, ...p })));
  },

  getById(id) {
    const found = pregnancies.find((p) => p.id === id);
    return found ? structuredClone({ ...DEFAULT_PREGNANCY, ...found }) : null;
  },

  // Read by the Cycle/Contraception screen to decide whether to show
  // its normal prompts or a "paused while pregnant" state.
  getActive() {
    return this.getAll().find((p) => !p.isArchived && p.testResult === "Positive" && p.status === "Ongoing") || null;
  },

  create(data) {
    const newEntry = { ...shapeForSave({}, data), id: generateId(), createdAt: new Date().toISOString(), isArchived: false };
    pregnancies = [...pregnancies, newEntry];
    persist();
    return newEntry;
  },

  update(id, changes) {
    let updated = null;
    pregnancies = pregnancies.map((p) => {
      if (p.id !== id) return p;
      updated = { ...shapeForSave(p, changes), id: p.id, createdAt: p.createdAt, isArchived: p.isArchived, updatedAt: new Date().toISOString() };
      return updated;
    });
    persist();
    return updated ? structuredClone(updated) : null;
  },

  archive(id) {
    return this.update(id, { isArchived: true });
  },

  delete(id) {
    pregnancies = pregnancies.filter((p) => p.id !== id);
    persist();
  },

  unarchive(id) {
    return this.update(id, { isArchived: false });
  },

  bulkArchive(ids) {
    ids.forEach((id) => this.archive(id));
  },

  bulkDelete(ids) {
    pregnancies = pregnancies.filter((p) => !ids.includes(p.id));
    persist();
  },

  restore(record) {
    if (pregnancies.some((p) => p.id === record.id)) return;
    pregnancies = [...pregnancies, record];
    persist();
  },

  replaceAll(newPregnancies) {
    pregnancies = newPregnancies;
    nextNumber = computeNextNumber(pregnancies);
    persist();
  },
};

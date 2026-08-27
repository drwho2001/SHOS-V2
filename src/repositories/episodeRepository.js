// episodeRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// The data layer behind the "Timeline" feature (nav-facing name — see
// SHOS_Timeline_Prototype.jsx). "Episode" is the underlying unit: a
// chain of related records (an exposure Encounter, any subsequent
// at-risk Encounters, Tests, treatment Clinic Visits, and optionally
// Symptom Log entries) representing one real-world thread from
// exposure through resolution.
//
// GENUINE ARCHITECTURE FINDING, not invented for the app: this is the
// same concept Architecture Lock v1.0 (§6, D1) calls "Clinical
// Episode" ("Encounter → Symptoms → Testing → Clinic Visit →
// Treatment, optional at each step") — deferred to "app phase" and
// never built in Notion. The user's own 18 Aug description of a planned
// "Timeline" feature used near-identical language independently. This
// is one feature under two names from two different planning
// conversations, not two separate builds.
//
// THE LIFECYCLE (the user's own description, 19 Aug 2026):
// 1. Start — retroactively select the Encounter that's the real
//    exposure point (not a live trigger; picked after the fact).
// 2. At risk — every Encounter logged AFTER that point, while the
//    episode is open, is flagged. These are the people who'd need
//    notifying if the linked test comes back positive.
// 3. Test — linked to the episode. Negative ends it there. Positive
//    moves it into treatment.
// 4. Treatment — a Clinic Visit, possibly alongside additional culture
//    Tests.
// 5. TOC (Test of Cure) — a follow-up Test after treatment, confirming
//    it's actually resolved.
//
// PRIVACY, resolved by omission rather than by building a workaround:
// the original concern (partner-notification episodes exposing a
// specific Contact as "who told me") dissolves once the trigger is
// just a category (`triggerReason`), not a live relation to a Contact
// record. The only Contact-identifying data anywhere in an episode is
// already exposed via the linked Encounters themselves (attendeeIds),
// exactly the same level of exposure those records already carry on
// their own — nothing new is added.
//
// DELIBERATELY SIMPLE test/visit linking: one flat `testIds` array,
// not separate named fields for "initial test" vs "culture" vs "TOC".
// The chronological order (sorted by date in the UI) tells that story
// without inventing structure the user didn't ask for — a genuine "keep it
// as simple as the real data needs" call, not a shortcut.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_episodes";

// (TRIGGER_REASON_OPTIONS moved to customOptionListsRepository.js,
// real in-app editable, per the user's ask — stored as
// "episodeTriggerReason". RESOLUTION_OPTIONS stays fixed here — its
// two values directly drive the resolve buttons' own logic, not a
// candidate for open-ended editing.)
export const RESOLUTION_OPTIONS = ["Negative — no treatment needed", "Treated — course complete"];

export const DEFAULT_EPISODE = {
  title: "",
  triggerReason: "",
  startEncounterId: "",       // the retroactively-selected anchor Encounter
  atRiskEncounterIds: [],     // subsequent Encounters flagged while the episode is open
  notifiedEncounterIds: [],   // subset of atRiskEncounterIds already notified — real, separate fact
  testIds: [],                // every linked Test, chronological (initial/culture/TOC all here)
  clinicVisitIds: [],         // treatment visit(s)
  symptomLogIds: [],          // optional — for symptom-driven episodes
  resolvedDate: null,
  resolution: "",             // one of RESOLUTION_OPTIONS, set on resolve
  notes: "",
  isArchived: false,
};

let episodes = storage.load(STORAGE_KEY, []);
let nextNumber = computeNextNumber(episodes);

function computeNextNumber(existing) {
  const numbers = existing.map((e) => {
    const match = /^episode_(\d+)$/.exec(e.id);
    return match ? parseInt(match[1], 10) : 0;
  });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

function generateId() {
  const id = `episode_${String(nextNumber).padStart(3, "0")}`;
  nextNumber += 1;
  return id;
}

function persist() {
  storage.save(STORAGE_KEY, episodes);
}

export const EpisodeRepository = {
  getAll() {
    return structuredClone(episodes.map((e) => ({ ...DEFAULT_EPISODE, ...e })));
  },

  getById(id) {
    const found = episodes.find((e) => e.id === id);
    return found ? structuredClone({ ...DEFAULT_EPISODE, ...found }) : null;
  },

  // Real, derived-only read — "open" just means no resolvedDate yet.
  // Same "store facts, derive state" principle as Testing's own
  // Follow-up Actioned Date logic — resolution is a real timestamp,
  // never a separate boolean that could drift out of sync with it.
  getOpen() {
    return this.getAll().filter((e) => !e.isArchived && !e.resolvedDate);
  },

  create(data) {
    const newEpisode = {
      ...DEFAULT_EPISODE,
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      isArchived: false,
    };
    episodes = [...episodes, newEpisode];
    persist();
    return newEpisode;
  },

  update(id, changes) {
    let updated = null;
    episodes = episodes.map((e) => {
      if (e.id !== id) return e;
      updated = { ...e, ...changes };
      return updated;
    });
    persist();
    return updated ? structuredClone({ ...DEFAULT_EPISODE, ...updated }) : null;
  },

  archive(id) {
    return this.update(id, { isArchived: true });
  },

  unarchive(id) {
    return this.update(id, { isArchived: false });
  },

  replaceAll(newEpisodes) {
    episodes = newEpisodes;
    nextNumber = computeNextNumber(episodes);
    persist();
  },
};

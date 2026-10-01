// clearSampleData.js
//
// WHY THIS FILE EXISTS
// -------------------
// A brand-new install shows ~93 fabricated records - 16 contacts, 18
// encounters, and a POSITIVE gonorrhoea result among the tests - with nothing
// anywhere in the UI saying so. The only mention of "demo data" in the whole
// app is a code comment. For an app whose entire pitch is "your data is
// private, on your device, yours", opening onto a stranger's medical history
// is the single worst first impression it could have.
//
// The only existing way out was Developer Tools > "Reset all app data", which
// is three levels deep, worded as destructive data loss, and - before the
// resetAllData.js fix - did not even work reliably.
//
// WHAT "CLEAR" MEANS HERE, AND WHY IT IS NOT "RESET ALL"
// -----------------------------------------------------
// This removes ONLY the sample records, identified by the ids each repository
// derives from its own seed array (SEED_*_IDS). "Reset all app data" empties
// every collection, which is the right action for "delete everything" and
// catastrophic for "get rid of the demo content" once the user has real data.
//
// The distinction is not theoretical. Repositories load with
// `storage.load(STORAGE_KEY, seedX)`, so on a fresh install the seed is only
// in MEMORY. The moment the user creates a record, `create()` calls
// ensureLoaded() (which pulls the seed into memory) and then persists the
// whole array - so their first contact is written alongside all 16 fake ones.
// From that point there is no way to tell them apart except by id, which is
// exactly what this file uses. Consequence: "clear sample data" is safe at any
// time and always preserves real records, whether run before or after the
// user has entered anything.
//
// It is a data-layer coordinator for the same reason resetAllData.js is: it is
// pure data access over the repository layer, no UI, no business logic, and
// adding a seeded repository does not mean editing a screen.
//
// WHAT IT DELIBERATELY DOES NOT TOUCH
// -----------------------------------
// Registries (Kink/Chems/etc.), the curated Resources list, custom option
// lists, Preferences, and My Profile. None of those are the fabricated
// personal history that causes the problem: the registries and resources are
// reference vocabularies the app is genuinely more useful with, and a user who
// has typed their own values into a custom option list must not lose them.
// My Profile is left alone for the same reason resetAllData resets it
// explicitly - it is the user's own record, and there is nothing sample about
// it.

import { ContactRepository, SEED_CONTACT_IDS } from "./contactRepository";
import { EncounterRepository, SEED_ENCOUNTER_IDS } from "./encounterRepository";
import { TestingRepository, SEED_TEST_IDS } from "./testingRepository";
import { MedicationRepository, SEED_MEDICATION_IDS } from "./medicationRepository";
import { ClinicVisitsRepository, SEED_CLINIC_VISIT_IDS } from "./clinicVisitsRepository";
import { VaccinationRepository, SEED_VACCINATION_IDS } from "./vaccinationRepository";
import { MeasurementRepository, SEED_MEASUREMENT_IDS } from "./measurementRepository";
import { SymptomLogRepository, SEED_SYMPTOM_LOG_IDS } from "./symptomLogRepository";
import { LocationsRepository, SEED_LOCATION_IDS } from "./locationsRepository";
import { EpisodeRepository, SEED_EPISODE_IDS } from "./episodeRepository";
import { LogRepository, SEED_MEDICATION_LOG_IDS } from "./logRepository";
import { MenstrualCycleRepository, SEED_MENSTRUAL_CYCLE_IDS } from "./menstrualCycleRepository";
import { ContraceptionRepository, SEED_CONTRACEPTION_IDS } from "./contraceptionRepository";
import { PregnancyRepository, SEED_PREGNANCY_IDS } from "./pregnancyRepository";

// Each entry: the repository to filter, and the ids that are sample data.
// Order follows resetAllData.js's own ordering (Contacts, Encounters, then
// Healthcare) so the two read as siblings.
const SAMPLE_REPOSITORIES = [
  ["Contacts", ContactRepository, SEED_CONTACT_IDS],
  ["Encounters", EncounterRepository, SEED_ENCOUNTER_IDS],
  ["Clinic visits", ClinicVisitsRepository, SEED_CLINIC_VISIT_IDS],
  ["Tests", TestingRepository, SEED_TEST_IDS],
  ["Vaccinations", VaccinationRepository, SEED_VACCINATION_IDS],
  ["Measurements", MeasurementRepository, SEED_MEASUREMENT_IDS],
  ["Menstrual cycles", MenstrualCycleRepository, SEED_MENSTRUAL_CYCLE_IDS],
  ["Contraception", ContraceptionRepository, SEED_CONTRACEPTION_IDS],
  ["Pregnancy entries", PregnancyRepository, SEED_PREGNANCY_IDS],
  ["Symptom log entries", SymptomLogRepository, SEED_SYMPTOM_LOG_IDS],
  ["Locations", LocationsRepository, SEED_LOCATION_IDS],
  ["Episodes", EpisodeRepository, SEED_EPISODE_IDS],
  ["Medication logs", LogRepository, SEED_MEDICATION_LOG_IDS],
  ["Medications", MedicationRepository, SEED_MEDICATION_IDS],
];

// FIXED 1 Oct 2026 - a real data-loss bug, found by losing the owner's own
// medication history. Everything above this block claimed the opposite: "there
// is no way to tell them apart except by id... clear sample data is safe at any
// time and always preserves real records". Both claims were false.
//
// WHAT HAPPENED: the owner renamed the seeded "PrEP (Descovy)" / "DoxyPEP
// (Doxycycline)" / "Vitamin D3" records to their own names and logged 66 of
// their own dose entries against them (non-seed ids log_015..log_131). The
// records were still seed records by id, so "clear sample data" deleted all
// three - along with their names, schedules and doses-per-day - while their own
// dose logs SURVIVED, because those carry non-seed ids. The result was 69
// orphaned dose logs pointing at three medications that no longer existed, and
// a user who reasonably believed six weeks of PrEP, DoxyPEP and Vitamin D
// history had been destroyed.
//
// THE FIX: a seed record that REAL records depend on is not sample data any
// more. It is kept, with its history, exactly as before.
//
// Deliberately NOT a field-diff heuristic that asks "has the user edited this?".
// Gemini was consulted on that alternative and rejected it: inferring intent by
// comparing fields against the seed definition is a guess about what the user
// meant, it fights `updatedAt` (every save rewrites it), and a wrong answer is
// silent data loss in either direction. Referential integrity is not a guess -
// a dose log pointing at med_001 is a FACT, and one fact is enough to make the
// medication real. A second pass at the source agrees, in
// tasks/sample-data-loss/90-gemini-consult.md.
//
// SCOPE LIMIT, stated rather than implied: only fields whose NAME ends in "Id"
// or "Ids" are followed, and only from records that are not themselves sample
// data. So a seed contact referenced from an unseeded collection outside the
// list above would not be detected. Same kind of documented limit
// orphanReferenceCheck.js already carries, for the same reason - a hand-kept
// relation map is a second thing to forget to update.
function referencedSeedIds(collections) {
  const allSeedIds = new Set();
  for (const [, , seedIds] of SAMPLE_REPOSITORIES) {
    for (const id of seedIds) allSeedIds.add(id);
  }
  const referenced = new Set();
  for (const { name, records, seedIds } of collections) {
    for (const record of records) {
      if (seedIds.has(record.id)) continue; // sample data cannot vouch for itself
      for (const [key, value] of Object.entries(record)) {
        if (!key.endsWith("Id") && !key.endsWith("Ids")) continue;
        for (const v of Array.isArray(value) ? value : [value]) {
          if (typeof v === "string" && allSeedIds.has(v)) referenced.add(v);
        }
      }
    }
  }
  return referenced;
}

// FIXED 1 Oct 2026 - this used to swallow the error and let the loop below carry
// on as though the repository were empty. That is actively dangerous here: a
// transient storage failure would look like "no records", so the repository
// would simply be skipped and the caller would be told the clear succeeded
// without ever having looked at it. The failure is captured and reported
// instead, which is what the "never throws, reports it instead" test asserts.
async function loadSampleCollections() {
  const collections = [];
  const failures = [];
  for (const [name, repo, seedIds] of SAMPLE_REPOSITORIES) {
    try {
      collections.push({ name, repo, seedIds, records: await repo.getAll() });
    } catch (e) {
      failures.push({ name, error: e?.message || String(e) });
    }
  }
  return { collections, failures };
}

/**
 * Counts the sample records still present, without changing anything.
 *
 * Used by the first-run banner to decide whether to show itself at all, and by
 * the backup screen to warn that an export would otherwise carry someone
 * else's medical history into a file meant for a clinic or a new phone.
 *
 * @returns {Promise<{total: number, byCollection: {name: string, count: number}[]}>}
 */
export async function countSampleData() {
  const byCollection = [];
  let total = 0;
  const { collections } = await loadSampleCollections();
  // FIXED 1 Oct 2026 - a seed record the user has real history against is not
  // sample data, so counting it would keep the first-run banner up forever and
  // keep the export screen warning about data that is actually the user's.
  const referenced = referencedSeedIds(collections);
  for (const { name, records, seedIds } of collections) {
    const count = records.filter((r) => seedIds.has(r.id) && !referenced.has(r.id)).length;
    if (count > 0) byCollection.push({ name, count });
    total += count;
  }
  return { total, byCollection };
}

/**
 * Subscribers are notified after every successful clear.
 *
 * WHY THIS EXISTS: caught by the smoke flow, and it is a genuine UX bug rather
 * than a test artefact. Two screens show this count - the first-run banner on
 * Home and the Developer Tools panel - and each only refreshed its own copy
 * when IT performed the clear. Clearing from Home left Developer Tools still
 * displaying "96 sample records are still here" with a live-looking button
 * that would then report there was nothing left to remove. The user is left
 * looking at a screen that contradicts what just happened to them.
 *
 * A tiny subscription rather than a shared cache, deliberately: the count is
 * cheap to recompute, so a stale cache would introduce a second way for the
 * number to be wrong. Listeners just re-read it.
 *
 * Follows the same shape darkModePreference.js already uses for its own
 * notify-listener path.
 */
const listeners = new Set();

/** Register a listener; returns an unsubscribe function. */
export function onSampleDataChanged(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((l) => {
    try { l(); } catch { /* a broken listener must not break the clear */ }
  });
}

/**
 * Removes every sample record, leaving real records untouched.
 *
 * Never throws for one failing repository - a partial clear that reports what
 * it could not remove is far more useful than an exception, for an action the
 * user is taking because they are unsure what is theirs.
 *
 * @returns {Promise<{removed: number, kept: number, failed: {name: string, error: string}[]}>}
 */
export async function clearSampleData() {
  let removed = 0;
  let kept = 0;
  const failed = [];
  const { collections, failures } = await loadSampleCollections();
  const referenced = referencedSeedIds(collections);
  // A repository that could not even be read never reaches the loop below, so
  // its failure is reported here. Without this the caller would be told the
  // clear succeeded while that collection was never inspected.
  failed.push(...failures);

  for (const { name, repo, records, seedIds } of collections) {
    try {
      // THE FIX: a seed record something real points at is kept, with its
      // history. See the long note above for the incident and for why this is
      // a referential check rather than a "has the user edited it" guess.
      const real = records.filter((r) => !seedIds.has(r.id) || referenced.has(r.id));
      const dropped = records.length - real.length;
      if (dropped === 0) { kept += records.length; continue; }
      // replaceAll() is the same call resetAllData.js uses: it replaces the
      // repository's in-memory cache AND persists, which is what makes the
      // sample data stay gone across a reload.
      await repo.replaceAll(real);
      removed += dropped;
      kept += real.length;
    } catch (e) {
      failed.push({ name, error: e?.message || String(e) });
    }
  }

  // Always notify, even on a partial clear: a screen that skipped a repository
  // still needs to stop claiming there is sample data here.
  notify();
  return { removed, kept, failed };
}

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
  for (const [name, repo, seedIds] of SAMPLE_REPOSITORIES) {
    try {
      const all = await repo.getAll();
      const count = all.filter((r) => seedIds.has(r.id)).length;
      if (count > 0) byCollection.push({ name, count });
      total += count;
    } catch {
      // A repository that cannot be read right now simply contributes nothing
      // to a count used for showing an advisory banner. It must never throw,
      // or a storage hiccup could block the app on boot.
    }
  }
  return { total, byCollection };
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

  for (const [name, repo, seedIds] of SAMPLE_REPOSITORIES) {
    try {
      const all = await repo.getAll();
      const real = all.filter((r) => !seedIds.has(r.id));
      const dropped = all.length - real.length;
      if (dropped === 0) { kept += all.length; continue; }
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

  return { removed, kept, failed };
}

// resetAllData.js
//
// WHY THIS FILE EXISTS
// -------------------
// "Reset all app data" in Developer Tools promised to "permanently delete every
// contact, encounter, medication, log, test, clinic visit, and registry entry on
// this device" - and it did not do that. It called
// localStorageAdapter.clearAllAppData(), which removes every `shos_` key, and
// then nothing else happened:
//
//   1. Every repository keeps an in-memory cache of its records. Removing the
//      localStorage keys does not touch those caches, so the running app kept
//      showing every record it already had and Developer Tools' own "live
//      record counts" kept reporting the old numbers. The next write after
//      that would re-persist the "deleted" data.
//
//   2. Worse, it came straight back. Repositories load with
//      `storage.load(STORAGE_KEY, seedX)` - when the key is ABSENT the seed
//      data is returned. So after a reload the counts were back to their
//      seeded values, and "delete everything" had quietly produced a working
//      demo dataset.
//
// Both are things only the repositories can undo: they own their caches, and
// they know the difference between "key absent" (load the seed) and "key
// present and empty" (genuinely nothing). A real reset therefore has to go
// THROUGH them, writing empty values rather than removing keys.
//
// This file is the data-layer coordinator for that. It lives in
// src/repositories/ because it is pure data access over the repository layer -
// no UI, no business logic. It is its own file rather than 28 imports inside
// DeveloperToolsScreen.jsx so that adding a repository does not mean editing
// a screen.
//
// WHAT "RESET" MEANS
// ------------------
// Every record collection is emptied and every preference returns to its
// documented default: a genuinely empty app, which is what the button claims.
// Seed data does NOT return, because values are written rather than keys
// removed. The two diagnostic collections (error log, notification history)
// are cleared too - they are excluded from BACKUPS as not being real user
// data, but "delete everything on this device" plainly covers a log of crash
// messages sitting in localStorage.

import { ContactRepository } from "./contactRepository";
import { EncounterRepository } from "./encounterRepository";
import { ClinicVisitsRepository } from "./clinicVisitsRepository";
import { TestingRepository } from "./testingRepository";
import { VaccinationRepository } from "./vaccinationRepository";
import { MeasurementRepository } from "./measurementRepository";
import { MenstrualCycleRepository } from "./menstrualCycleRepository";
import { ContraceptionRepository } from "./contraceptionRepository";
import { PregnancyRepository } from "./pregnancyRepository";
import { SymptomLogRepository } from "./symptomLogRepository";
import { LocationsRepository } from "./locationsRepository";
import { EpisodeRepository } from "./episodeRepository";
import { LogRepository } from "./logRepository";
import { MedicationRepository } from "./medicationRepository";
import { PartnerNotificationRepository } from "./partnerNotificationRepository";
import { TrashRepository } from "./trashRepository";
import { ResourcesRepository } from "./resourcesRepository";
import { CustomGroupsRepository } from "./customGroupsRepository";
import { CustomOptionListsRepository } from "./customOptionListsRepository";
import { ModuleColorRepository } from "./moduleColorRepository";
import { MyProfileRepository } from "./myProfileRepository";
import { ErrorLogRepository } from "./errorLogRepository";
import { NotificationHistoryRepository } from "./notificationHistoryRepository";
import { AppPreferencesRepository, DEFAULT_APP_PREFERENCES } from "./appPreferencesRepository";
import { PrivacySettingsRepository, DEFAULT_PRIVACY_SETTINGS } from "./privacySettingsRepository";
import { MedicationPreferencesRepository, DEFAULT_MEDICATION_PREFERENCES } from "./medicationPreferencesRepository";
import { MeasurementPreferencesRepository, DEFAULT_MEASUREMENT_PREFERENCES } from "./measurementPreferencesRepository";
import { NotificationPreferencesRepository, DEFAULT_NOTIFICATION_PREFERENCES } from "./notificationPreferencesRepository";

// Each entry empties a record collection. replaceAll() is what replaces the
// module's in-memory cache as well as the stored value, so it is the only
// call that fully undoes a previous clearAllAppData().
const LIST_REPOSITORIES = [
  ["Contacts", ContactRepository],
  ["Encounters", EncounterRepository],
  ["Clinic visits", ClinicVisitsRepository],
  ["Tests", TestingRepository],
  ["Vaccinations", VaccinationRepository],
  ["Measurements", MeasurementRepository],
  ["Menstrual cycles", MenstrualCycleRepository],
  ["Contraception", ContraceptionRepository],
  ["Pregnancy entries", PregnancyRepository],
  ["Symptom log entries", SymptomLogRepository],
  ["Locations", LocationsRepository],
  ["Episodes", EpisodeRepository],
  ["Medication logs", LogRepository],
  ["Medications", MedicationRepository],
  ["Partner notifications", PartnerNotificationRepository],
  ["Trash", TrashRepository],
  ["Resources", ResourcesRepository],
  ["Custom groups", CustomGroupsRepository],
  ["Custom option lists", CustomOptionListsRepository],
  ["Module colour overrides", ModuleColorRepository],
  ["My Profile", MyProfileRepository],
];

// Singletons are written back to their defaults. update()/updatePreferences()
// both MERGE over the current value, so passing the full default object is what
// actually resets every field - passing {} would leave whatever was there.
const SINGLETON_RESETTERS = [
  ["App preferences", () => AppPreferencesRepository.update(DEFAULT_APP_PREFERENCES)],
  ["Privacy settings", () => PrivacySettingsRepository.update(DEFAULT_PRIVACY_SETTINGS)],
  ["Medication preferences", () => MedicationPreferencesRepository.updatePreferences(DEFAULT_MEDICATION_PREFERENCES)],
  ["Measurement preferences", () => MeasurementPreferencesRepository.updatePreferences(DEFAULT_MEASUREMENT_PREFERENCES)],
  ["Notification preferences", () => NotificationPreferencesRepository.update(DEFAULT_NOTIFICATION_PREFERENCES)],
  ["Error log", () => ErrorLogRepository.clear()],
  ["Notification history", () => NotificationHistoryRepository.clear()],
];

/**
 * Wipes every record collection and returns every preference to its default.
 *
 * Never throws for one failing repository. A partial reset that reports what
 * it could not clear is far more useful than an exception that leaves the user
 * unsure whether their data went - particularly for a button whose whole
 * purpose is destructive.
 *
 * @returns {Promise<{ok: string[], failed: {name: string, error: string}[]}>}
 */
export async function resetAllData() {
  const ok = [];
  const failed = [];

  for (const [name, repo] of LIST_REPOSITORIES) {
    try {
      if (typeof repo?.replaceAll !== "function") {
        failed.push({ name, error: "repository has no replaceAll()" });
        continue;
      }
      await repo.replaceAll([]);
      ok.push(name);
    } catch (e) {
      failed.push({ name, error: e?.message || String(e) });
    }
  }

  for (const [name, write] of SINGLETON_RESETTERS) {
    try {
      await write();
      ok.push(name);
    } catch (e) {
      failed.push({ name, error: e?.message || String(e) });
    }
  }

  return { ok, failed };
}

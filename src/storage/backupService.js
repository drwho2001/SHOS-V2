// backupService.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// This is the "download everything as a file" / "load a file back in"
// feature — Doc 5 §7 called this out from the start ("Backup/restore:
// versioned JSON snapshot of the full local dataset"). It doesn't store
// anything itself; it just asks every repository for a full copy of its
// data, bundles it into one file, and — for restore — hands a parsed
// file back to each repository to load in.
//
// This file is the ONLY place that needs to change if a new module
// (Encounters, Testing, etc.) gets added later — add one line to gather
// its data, one line to restore it. Nothing else in the app needs to
// know backup/restore exists.

import { ContactRepository } from "../repositories/contactRepository.js";
import { exportTextFile, writeTextFileSilently } from "./fileExportHelper.js";
// ADDED — real ask: scheduled auto-export reads its own on/off toggle
// and interval from here (Settings -> Preferences), same repository
// every other real app preference already lives in.
import { AppPreferencesRepository } from "../repositories/appPreferencesRepository.js";
// ADDED 19 Aug 2026 — needed directly (not through a repository) for
// the backup-reminder timestamp, which isn't really "a module's data",
// just app-usage tracking.
import { localStorageAdapter as storage } from "./storageAdapter.js";
import { MedicationRepository } from "../repositories/medicationRepository.js";
import { LogRepository } from "../repositories/logRepository.js";
import { EncounterRepository } from "../repositories/encounterRepository.js";
import { KinkRegistry } from "../registries/kinkRegistry.js";
import { ChemsRegistry } from "../registries/chemsRegistry.js";
import { ProtectionRegistry } from "../registries/protectionRegistry.js";
import { SymptomsRegistry } from "../registries/symptomsRegistry.js";
import { LocationsRepository } from "../repositories/locationsRepository.js";
// Added 18 Aug 2026, same session as My Profile's build: the user confirmed
// a full backup should also snapshot "My Profile" state at that point
// in time — this was the one open question flagged when My Profile
// shipped. MyProfileRepository is a SINGLETON (one record, not a list)
// so it doesn't fit the getAll()/replaceAll(array) shape every other
// module here uses — handled as a single object under data.myProfile,
// with its own type checks below rather than Array.isArray().
import { MyProfileRepository } from "../repositories/myProfileRepository.js";
// ADDED 19 Aug 2026 — Testing (and its two supporting registries)
// existed for a full session before this fix — a backup taken in that
// window would have silently excluded all test data with no warning.
// Caught during a direct audit, not assumed complete.
import { TestingRepository } from "../repositories/testingRepository.js";
import { OrganismRegistry } from "../registries/organismRegistry.js";
import { ResultsRegistry } from "../registries/resultsRegistry.js";
// ADDED 19 Aug 2026, same session Clinic Visits was built — added
// immediately, not after the fact this time, having just caught Testing
// missing from here for a full session.
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository.js";
// ADDED 19 Aug 2026, same session Symptom Log was built — added
// immediately, not after the fact, having caught Testing missing from
// here for a full session and Clinic Visits' own near-miss earlier.
import { SymptomLogRepository } from "../repositories/symptomLogRepository.js";
import { VaccinationRepository } from "../repositories/vaccinationRepository.js";
import { EpisodeRepository } from "../repositories/episodeRepository.js";
import { CustomOptionListsRepository } from "../repositories/customOptionListsRepository.js";
// ADDED 19 Aug 2026 — real gap found: PrivacySettingsRepository (PIN,
// Anonymise mode, hide-further preference) was never wired into backup
// at all. A real data-loss risk on restore/device-migration — the user's
// PIN and preference would silently vanish, not just be reset to
// default. Fixed by adding it here, same pattern as every other
// repository.
import { PrivacySettingsRepository } from "../repositories/privacySettingsRepository.js";
// ADDED 1 Sep 2026, same session both were built — wired into backup
// immediately this time, per this file's own repeated past lesson
// (Testing/Privacy Settings both got missed for a full session before
// being caught here).
import { PartnerNotificationRepository } from "../repositories/partnerNotificationRepository.js";
import { ResourcesRepository } from "../repositories/resourcesRepository.js";

// Doc 5 §8: "Every export/backup file stamps: schema version, migration
// version, app version." Schema version bumps only when a backup file's
// own SHAPE changes in a way old code couldn't read (e.g. a field
// renamed) — not every time a new field is added.
const SCHEMA_VERSION = 1;
const APP_VERSION = "0.1.0-prototype";

// ADDED 19 Aug 2026 — real ask from the ~90-item feedback batch:
// "selective export — default is export everything, but Healthcare/
// Contacts/Encounters (and individual items within each) should be
// optionally deselectable." This is the single canonical grouping the
// Settings UI renders checkboxes from — same "one place changes for a
// new module" philosophy as the rest of this file: adding a module
// here is the only step needed to make it selectively exportable too.
// Groups mirror the app's own primary-nav/Doc-1 shape (Contacts /
// Activity / Medication / Healthcare), plus two groups Doc 1 doesn't
// name as their own nav destinations but that are real, separately
// meaningful data: the five registries (Kink/Chems/Protection/
// Symptoms/Locations) as one group, and My Profile as its own —
// mirrors "individual items within each" for Healthcare and Medication
// specifically, where more than one real data key exists per group.
export const EXPORT_GROUPS = [
  { key: "contacts", label: "Contacts", items: [{ dataKey: "contacts", label: "Contacts" }] },
  { key: "activity", label: "Encounter", items: [{ dataKey: "encounters", label: "Encounters" }] },
  { key: "medication", label: "Medication", items: [
    { dataKey: "medications", label: "Medications" },
    { dataKey: "logs", label: "Dose / refill / waste log" },
  ] },
  { key: "healthcare", label: "Healthcare", items: [
    { dataKey: "tests", label: "Tests" },
    { dataKey: "clinicVisits", label: "Clinic Visits" },
    { dataKey: "symptomLog", label: "Symptom Log" },
    { dataKey: "vaccinations", label: "Vaccinations" },
    { dataKey: "episodes", label: "Timeline episodes" },
    { dataKey: "organisms", label: "Organism Registry" },
    { dataKey: "results", label: "Results Registry" },
  ] },
  { key: "registries", label: "Kink / Chems / Protection / Symptoms / Locations", items: [
    { dataKey: "kinks", label: "Kink Registry" },
    { dataKey: "chems", label: "Chems Registry" },
    { dataKey: "protection", label: "Protection Registry" },
    { dataKey: "symptoms", label: "Symptoms Registry" },
    { dataKey: "locations", label: "Locations" },
  ] },
  { key: "profile", label: "My Profile", items: [{ dataKey: "myProfile", label: "My Profile" }] },
  // ADDED 19 Aug 2026 — real fix: customOptionLists had been sitting
  // under "Healthcare" by mistake — it spans every domain (Medication
  // type, Route, Reason for visit, etc.), not just Healthcare. Moved
  // here into its own real group alongside Privacy Settings, which was
  // simply never wired into backup at all until now (see the import
  // comment above for the full reasoning).
  { key: "appSettings", label: "App settings", items: [
    { dataKey: "customOptionLists", label: "Custom option lists (your own added/renamed options)" },
    { dataKey: "privacySettings", label: "Privacy settings (Anonymise mode PIN + preference)" },
    { dataKey: "resources", label: "Resources (Settings → Resources links/notes)" },
  ] },
  // ADDED 1 Sep 2026 — real ask: partner notification checklists. Own
  // group, not folded into Healthcare — this is a generated action
  // list derived from a Test, not clinical record data itself.
  { key: "partnerNotifications", label: "Partner notification checklists", items: [
    { dataKey: "partnerNotifications", label: "Partner notification checklists" },
  ] },
];

// Pure data assembly — no browser APIs touched here, so this part is
// fully testable outside a real browser (and was).
//
// CHANGED 19 Aug 2026 — accepts an optional `includeKeys` (a Set or
// array of the `dataKey` values above). Omitted/null = full export,
// unchanged default behavior for every existing caller (Settings'
// plain "Export backup" button, and both restore paths, which never
// pass this argument at all). When provided, only those data keys are
// gathered — every repository is still called through its existing
// getAll()/getProfile(), nothing about how data is READ changes, only
// which of the results get bundled into the file.
export function buildBackup(includeKeys = null) {
  const allData = {
    contacts: ContactRepository.getAll(),
    medications: MedicationRepository.getAll(),
    logs: LogRepository.getAll(),
    encounters: EncounterRepository.getAll(),
    kinks: KinkRegistry.getAll(),
    chems: ChemsRegistry.getAll(),
    protection: ProtectionRegistry.getAll(),
    symptoms: SymptomsRegistry.getAll(),
    locations: LocationsRepository.getAll(),
    myProfile: MyProfileRepository.getProfile(),
    tests: TestingRepository.getAll(),
    organisms: OrganismRegistry.getAll(),
    results: ResultsRegistry.getAll(),
    clinicVisits: ClinicVisitsRepository.getAll(),
    symptomLog: SymptomLogRepository.getAll(),
    vaccinations: VaccinationRepository.getAll(),
    episodes: EpisodeRepository.getAll(),
    customOptionLists: CustomOptionListsRepository.getAllForBackup(),
    privacySettings: PrivacySettingsRepository.getSettings(),
    resources: ResourcesRepository.getAllForBackup(),
    partnerNotifications: PartnerNotificationRepository.getAll(),
  };
  const keySet = includeKeys ? new Set(includeKeys) : null;
  const data = keySet
    ? Object.fromEntries(Object.entries(allData).filter(([k]) => keySet.has(k)))
    : allData;
  return {
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    // Stamped so a partial export is honestly distinguishable from a
    // full backup at a glance (e.g. if someone finds the file later
    // and wonders why restoring it didn't bring everything back) —
    // restoreBackup() itself doesn't need this flag, since its
    // existing Array.isArray()-per-key checks already no-op cleanly
    // on any key that's simply absent from the file.
    ...(keySet ? { selective: true } : {}),
    data,
  };
}

// Parses and sanity-checks a backup file's text content. Throws a
// plain-language error if the file doesn't look right, rather than
// silently importing garbage or a cryptic JSON parse error.
export function parseBackupFile(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("That file isn't valid — it doesn't look like a SHOS backup.");
  }
  if (!parsed || typeof parsed !== "object" || !parsed.data) {
    throw new Error("That file doesn't look like a SHOS backup file.");
  }
  if (typeof parsed.schemaVersion === "number" && parsed.schemaVersion > SCHEMA_VERSION) {
    throw new Error("This backup was made with a newer version of SHOS than this app understands. Update the app before restoring it.");
  }
  return parsed;
}

// Restores a parsed backup — replaces ALL current data with what's in
// the file. See mergeBackup() below for the additive alternative — the
// UI now asks which one you want before either runs, since silently
// wiping everything with no confirmation was a real gap on its own,
// separate from merge existing at all.
export function restoreBackup(parsedBackup) {
  const { contacts, medications, logs, encounters, kinks, chems, protection, symptoms, locations, myProfile, tests, organisms, results, clinicVisits, symptomLog, vaccinations, episodes, customOptionLists, privacySettings, resources, partnerNotifications } = parsedBackup.data;
  if (Array.isArray(contacts)) ContactRepository.replaceAll(contacts);
  if (Array.isArray(medications)) MedicationRepository.replaceAll(medications);
  if (Array.isArray(logs)) LogRepository.replaceAll(logs);
  if (Array.isArray(encounters)) EncounterRepository.replaceAll(encounters);
  if (Array.isArray(kinks)) KinkRegistry.replaceAll(kinks);
  if (Array.isArray(chems)) ChemsRegistry.replaceAll(chems);
  if (Array.isArray(protection)) ProtectionRegistry.replaceAll(protection);
  if (Array.isArray(symptoms)) SymptomsRegistry.replaceAll(symptoms);
  if (Array.isArray(locations)) LocationsRepository.replaceAll(locations);
  // ADDED 19 Aug 2026 — old backups (before this fix) simply won't have
  // these keys, same graceful no-op pattern as myProfile below.
  if (Array.isArray(tests)) TestingRepository.replaceAll(tests);
  if (Array.isArray(organisms)) OrganismRegistry.replaceAll(organisms);
  if (Array.isArray(results)) ResultsRegistry.replaceAll(results);
  if (Array.isArray(clinicVisits)) ClinicVisitsRepository.replaceAll(clinicVisits);
  if (Array.isArray(symptomLog)) SymptomLogRepository.replaceAll(symptomLog);
  if (Array.isArray(vaccinations)) VaccinationRepository.replaceAll(vaccinations);
  if (Array.isArray(episodes)) EpisodeRepository.replaceAll(episodes);
  if (customOptionLists && typeof customOptionLists === "object") CustomOptionListsRepository.replaceAll(customOptionLists);
  if (privacySettings && typeof privacySettings === "object") PrivacySettingsRepository.update(privacySettings);
  if (resources && typeof resources === "object") ResourcesRepository.replaceAll(resources);
  if (Array.isArray(partnerNotifications)) PartnerNotificationRepository.replaceAll(partnerNotifications);
  // Not Array.isArray — MyProfile is a singleton object, not a list.
  // Older backup files (from before 18 Aug 2026) simply won't have a
  // myProfile key at all, so this quietly no-ops on those rather than
  // erroring — restoring an old backup still works, it just leaves
  // whatever profile is already there untouched.
  if (myProfile && typeof myProfile === "object" && !Array.isArray(myProfile)) {
    MyProfileRepository.replaceAll(myProfile);
  }
}

// ADDED — real ask: "ask if replace all data or merge — placeholder/
// demo data still exists and won't be needed" (that's actually a
// case for Replace All, restoreBackup() above already wipes it
// cleanly — the real gap was that import ran with zero confirmation
// or choice at all). Merge adds the backup's records ALONGSIDE
// whatever's already here, via each repository's own getAll()/
// replaceAll() — concatenating instead of overwriting keeps every
// imported record's ORIGINAL id intact, so cross-references (an
// Encounter's attendeeIds, a Clinic Visit's linked test) still
// resolve correctly after merging. HONEST LIMIT, stated plainly: this
// is "combine both sets", not conflict resolution — it can't detect
// that a contact in the backup is the "same person" as one already
// here and won't try to (see restoreBackup's own past note on why
// real merge is a much harder problem). myProfile/privacySettings are
// singletons, not lists — merging them makes no sense, so they're
// left untouched here entirely; Replace All is the only way to bring
// those in from a backup. customOptionLists (plain string lists, not
// id-based records) are unioned per category instead, since simple
// duplicate labels would be actively unhelpful.
export function mergeBackup(parsedBackup) {
  const { data } = parsedBackup;
  const append = (repo, incoming) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return;
    repo.replaceAll([...repo.getAll(), ...incoming]);
  };
  append(ContactRepository, data.contacts);
  append(MedicationRepository, data.medications);
  append(LogRepository, data.logs);
  append(EncounterRepository, data.encounters);
  append(KinkRegistry, data.kinks);
  append(ChemsRegistry, data.chems);
  append(ProtectionRegistry, data.protection);
  append(SymptomsRegistry, data.symptoms);
  append(LocationsRepository, data.locations);
  append(TestingRepository, data.tests);
  append(OrganismRegistry, data.organisms);
  append(ResultsRegistry, data.results);
  append(ClinicVisitsRepository, data.clinicVisits);
  append(SymptomLogRepository, data.symptomLog);
  append(VaccinationRepository, data.vaccinations);
  append(EpisodeRepository, data.episodes);
  if (data.customOptionLists && typeof data.customOptionLists === "object") {
    const current = CustomOptionListsRepository.getAllForBackup();
    const merged = {};
    for (const key of new Set([...Object.keys(current), ...Object.keys(data.customOptionLists)])) {
      merged[key] = Array.from(new Set([...(current[key] || []), ...(data.customOptionLists[key] || [])]));
    }
    CustomOptionListsRepository.replaceAll(merged);
  }
  append(PartnerNotificationRepository, data.partnerNotifications);
  // Resources entries are {id, name, link, notes} objects, not plain
  // strings — concatenated per category rather than de-duplicated like
  // customOptionLists above; a re-added "Refuge" showing twice is mild
  // clutter, not a real data-integrity problem, same as any other
  // simple list this merge doesn't try to reconcile by content.
  if (data.resources && typeof data.resources === "object") {
    const current = ResourcesRepository.getAllForBackup();
    const merged = {};
    for (const key of new Set([...Object.keys(current), ...Object.keys(data.resources)])) {
      merged[key] = [...(current[key] || []), ...(data.resources[key] || [])];
    }
    ResourcesRepository.replaceAll(merged);
  }
}

// ---------------------------------------------------------------------
// Browser-facing helpers — these DO touch browser-only APIs (Blob,
// document, FileReader), so they can't be exercised in a plain Node
// test the way the functions above were. Confirmed logically correct
// by testing buildBackup/parseBackupFile/restoreBackup directly; the
// actual "does a file download, does picking a file work" needs a real
// browser (StackBlitz) to confirm — flagging that plainly rather than
// claiming more than was actually checked.
// ---------------------------------------------------------------------

// ADDED 19 Aug 2026 — real ask: a reminder if it's been a while since
// the last real export. Tracks a single timestamp, updated every time
// exportBackup() actually runs — no separate "mark as backed up"
// step, so it can never drift out of sync with reality.
const LAST_BACKUP_KEY = "shos_last_backup_at";
// CHANGED — real ask: 30 days was too naggy; user's own explicit
// number is 90. Also now folds in hasUnbackedChanges() (defined below)
// — "unless no new data", per the user's own exact wording — so this
// only actually nags when BOTH enough time has passed AND there's
// something new that isn't backed up yet, not on elapsed time alone.
export const BACKUP_REMINDER_DAYS = 90;

// CRITICAL FIX: real device crash ("Maximum call stack size exceeded",
// white/dark screen with no recovery, every app open) traced to this
// exact pair of functions — getLastBackupInfo() called hasUnbackedChanges()
// whenever no backup had ever been made, and hasUnbackedChanges() called
// getLastBackupInfo() right back, an infinite mutual recursion that fires
// on EVERY app open (Home reads this on mount) for anyone who's never
// completed a real, non-selective export — true of every fresh install
// and most real-device testing. Both functions now read the raw
// timestamp through this one shared helper instead of calling each
// other, breaking the cycle completely while keeping the exact same
// behaviour otherwise.
function getLastBackupTimestamp() {
  return storage.load(LAST_BACKUP_KEY, null);
}

export function getLastBackupInfo() {
  const lastAt = getLastBackupTimestamp();
  if (!lastAt) return { lastAt: null, daysSince: null, dueForReminder: hasUnbackedChanges() };
  const daysSince = Math.floor((Date.now() - new Date(lastAt).getTime()) / 86400000);
  return { lastAt, daysSince, dueForReminder: daysSince >= BACKUP_REMINDER_DAYS && hasUnbackedChanges() };
}

// ADDED 26 Aug 2026 — real ask: "warn if not exported backup since
// last modification" (for the new delete-all-data confirmation).
// HONEST LIMIT: most repositories only stamp `createdAt` on creation,
// not `updatedAt` on every edit (confirmed by checking
// contactRepository.js directly, not assumed) — so this reliably
// catches new records and logged activity (dose logs, encounters,
// tests, etc. all have real dates), but a pure edit to an existing
// record's fields with no new record created (e.g. correcting a
// contact's phone number) won't be caught. Reuses buildBackup()'s own
// reads rather than a second, separately-maintained list of every
// repository — if a new data type is ever added to backups, this
// check picks it up automatically too.
export function hasUnbackedChanges() {
  const lastAt = getLastBackupTimestamp();
  if (!lastAt) return true; // never backed up at all
  const lastBackupTime = new Date(lastAt).getTime();
  const { data } = buildBackup(null);
  for (const [moduleKey, value] of Object.entries(data)) {
    const records = Array.isArray(value) ? value : [value];
    for (const record of records) {
      // CHANGED 26 Aug 2026 — real ask: Contacts' updatedAt is
      // deliberately excluded here — per the user's own clarification,
      // editing a Contact's profile isn't the same thing as a logged
      // encounter, so it shouldn't trigger this warning the way a new
      // Test or Activity genuinely should. createdAt (a brand new
      // contact) still counts.
      const stamp = moduleKey === "contacts"
        ? (record?.createdAt || record?.date)
        : (record?.createdAt || record?.date || record?.updatedAt);
      if (stamp && new Date(stamp).getTime() > lastBackupTime) return true;
    }
  }
  return false;
}

export async function exportBackup(includeKeys = null) {
  const backup = buildBackup(includeKeys);
  const json = JSON.stringify(backup, null, 2);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const suffix = includeKeys ? "-selective" : "";
  await exportTextFile(`shos-backup-${dateStamp}${suffix}.json`, json, "application/json");
  // Only a FULL export counts as "properly backed up" for reminder
  // purposes — a selective export deliberately leaves things out, so
  // it shouldn't reset the clock on a reminder meant to catch "you
  // have no real safety net right now".
  if (!includeKeys) storage.save(LAST_BACKUP_KEY, new Date().toISOString());
}

// ADDED — real ask: "scheduled auto-export", distinct from the nag-
// reminder above (which only ever asks a human to remember to tap
// Export). Deliberately reuses the SAME LAST_BACKUP_KEY clock as every
// manual export/encrypted-export above, rather than a second separate
// timestamp: an auto-export genuinely IS a real backup, so it should
// reset the same clock — a user with this enabled should never also
// see the manual "you're overdue" nag, since the automatic one is
// already covering them. Also reuses hasUnbackedChanges() unchanged —
// no point silently writing an identical file with nothing new in it
// every time the interval ticks over.
export function isAutoExportDue() {
  const prefs = AppPreferencesRepository.getPreferences();
  if (!prefs.autoExportEnabled) return false;
  const { lastAt, daysSince } = getLastBackupInfo();
  if (!lastAt) return true; // never backed up at all — due immediately
  return daysSince >= prefs.autoExportIntervalDays && hasUnbackedChanges();
}

// The one function callers actually use — call unconditionally on app
// open (Home's own mount, same "check on load" pattern as calendar
// sync / reminder sync elsewhere in this app); self-gates on
// isAutoExportDue() so every call site doesn't need to separately
// remember to check it. Always a FULL backup, never selective — an
// unattended export choosing to silently leave things out on your
// behalf would be a real, surprising data-loss risk, not a convenience.
// Writes straight to the public Documents folder with no share sheet
// (writeTextFileSilently) — see that function's own comment for why a
// popup dialog on app load would be the wrong UX here.
export async function runAutoExportIfDue() {
  if (!isAutoExportDue()) return { ran: false };
  const backup = buildBackup(null);
  const json = JSON.stringify(backup, null, 2);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const ok = await writeTextFileSilently(`shos-backup-${dateStamp}-auto.json`, json, "application/json");
  if (ok) storage.save(LAST_BACKUP_KEY, new Date().toISOString());
  return { ran: ok };
}

// ---------------------------------------------------------------------
// Encrypted export — real ask: a password-protected backup, for
// anyone who wants to store or send a backup somewhere less trusted
// than their own device (cloud storage, a message to themselves,
// etc.) without the plain JSON — every contact, encounter, and test
// result in the file — being readable by anyone who gets hold of it.
//
// Uses the Web Crypto API directly (SubtleCrypto), available in every
// modern browser/WebView with no extra dependency — AES-256-GCM for
// the actual encryption (authenticated: a wrong password or corrupted
// file genuinely fails to decrypt, never silently produces garbage),
// keyed via PBKDF2 (250,000 rounds, SHA-256) from the password plus a
// fresh random salt every time, so the same password never produces
// the same key twice. HONEST LIMIT, stated plainly: this protects the
// FILE at rest — it's exactly as strong as the password chosen for
// it, same as any password-protected archive (a zip, a PDF). There's
// no password recovery: forgetting it makes that specific encrypted
// file permanently unreadable, same trade-off as any real encryption.
// ---------------------------------------------------------------------
const ENCRYPTED_BACKUP_TYPE = "shos_encrypted_backup";
const ENCRYPTED_SCHEMA_VERSION = 1;
const PBKDF2_ITERATIONS = 250000;

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}
function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveBackupKey(password, saltBytes) {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Pure data assembly + real crypto, no browser file/DOM APIs touched
// here — same "pure" vs. "browser-facing" split as buildBackup() vs.
// exportBackup() above.
export async function buildEncryptedBackup(password, includeKeys = null) {
  const backup = buildBackup(includeKeys);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(password, salt);
  const ciphertextBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(backup)));
  return {
    type: ENCRYPTED_BACKUP_TYPE,
    schemaVersion: ENCRYPTED_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    kdf: "PBKDF2-SHA256",
    iterations: PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertextBuf)),
  };
}

// Decrypts an encrypted backup envelope with the given password and
// runs it through the same parseBackupFile() sanity checks a plain
// backup gets (schema version, shape) — one validation path for both,
// not a separate one that could drift. Throws a plain-language error
// on a wrong password rather than a cryptic DOMException — AES-GCM's
// own authentication tag is what actually catches this, not a guess.
export async function decryptBackupEnvelope(envelope, password) {
  if (!envelope || envelope.type !== ENCRYPTED_BACKUP_TYPE) {
    throw new Error("That doesn't look like an encrypted SHOS backup.");
  }
  if (typeof envelope.schemaVersion === "number" && envelope.schemaVersion > ENCRYPTED_SCHEMA_VERSION) {
    throw new Error("This encrypted backup was made with a newer version of SHOS than this app understands.");
  }
  const key = await deriveBackupKey(password, base64ToBytes(envelope.salt));
  let plainBuf;
  try {
    plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(envelope.iv) }, key, base64ToBytes(envelope.ciphertext));
  } catch {
    throw new Error("Wrong password, or this file is corrupted.");
  }
  return parseBackupFile(new TextDecoder().decode(plainBuf));
}

export async function exportEncryptedBackup(password, includeKeys = null) {
  const envelope = await buildEncryptedBackup(password, includeKeys);
  const json = JSON.stringify(envelope);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const suffix = includeKeys ? "-selective" : "";
  await exportTextFile(`shos-backup-encrypted-${dateStamp}${suffix}.json`, json, "application/json");
  if (!includeKeys) storage.save(LAST_BACKUP_KEY, new Date().toISOString());
}

// ---------------------------------------------------------------------
// Import — reads a picked file WITHOUT restoring anything yet, so the
// UI can tell an encrypted backup (needs a password first) from a
// plain one (ready to restore/merge immediately) before committing to
// either path.
// ---------------------------------------------------------------------
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsText(file);
  });
}

// Returns { encrypted: true, envelope } for an encrypted backup (call
// decryptBackupEnvelope() with a password next), or { encrypted:
// false, parsed } for a plain one (already validated, ready for
// restoreFromParsedBackup()).
export async function inspectBackupFile(file) {
  const text = await readFileAsText(file);
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid — it doesn't look like a SHOS backup.");
  }
  if (raw && raw.type === ENCRYPTED_BACKUP_TYPE) {
    return { encrypted: true, envelope: raw };
  }
  return { encrypted: false, parsed: parseBackupFile(text) };
}

// Restores or merges an already-parsed/decrypted backup — the shared
// final step for both the plain and encrypted import paths, so
// there's exactly one place that decides what "replace" vs "merge"
// actually does.
export function restoreFromParsedBackup(parsed, mode = "replace") {
  if (mode === "merge") mergeBackup(parsed); else restoreBackup(parsed);
}

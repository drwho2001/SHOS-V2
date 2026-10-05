// seedIdMigration.js
//
// WHY THIS FILE EXISTS
// --------------------
// The 3a seed re-key (5 Oct 2026) moved every demo record id from `contact_001`
// to `seed_contact_9001`. That is correct going forward, and it made the whole
// class of bug go away: a user's record and a demo record can no longer share
// an id, so "clear sample data" can no longer delete a person.
//
// BUT IT DOES NOTHING FOR AN INSTALL THAT ALREADY HAS DATA, and that is not a
// corner case - it is every existing user, including the owner.
//
// WHY: repositories load with `storage.load(STORAGE_KEY, seedArray)`, and
// storageAdapter.js returns the seed array ONLY when the storage key is
// absent. So on a real install the seed array is never consulted again after
// the first save. The stored records still carry the OLD ids, while
// `SEED_*_IDS` is now derived from the NEW array. The consequences, all silent:
//
//   - `countSampleData()` returns 0, so the first-run disclosure banner never
//     appears and the export screen stops warning that a backup would carry
//     someone else's medical history into a file meant for a clinic.
//   - `clearSampleData()` removes nothing, so old demo data becomes
//     PERMANENTLY INDISTINGUISHABLE from the user's own records.
//
// That last one reintroduces, from the opposite direction, the exact failure
// this whole feature exists to prevent. The fix has to be a real data
// migration, not just a rename.
//
// WHAT IT DOES
// ------------
// Once per boot, after the vault is unlocked: any record whose id is a
// KNOWN LEGACY SEED id is re-keyed to its new `seed_*` form, and every
// reference to it anywhere else is rewritten. Idempotent - a second run finds
// nothing to do.
//
// THE ONE RULE THAT MATTERS MOST
// -------------------------------
// A record carrying `isSeed === false` is the USER'S OWN DATA and is never
// touched, even if its id is a legacy seed id. That is precisely the state the
// owner's 74 recovered records are in: real people and real records restored
// under their original ids, which are ids the old seed arrays also used. This
// migration would delete them if it keyed on the id alone - and it is the
// second time in this incident's history that a real fix has been one line
// away from destroying the owner's data.
//
// Legacy id list is EXPLICIT, not derived. Deriving it would mean asking "is
// this id in the old low range?", which is exactly the question that was wrong
// when it was originally asked - the owner's real contacts were contact_017
// through contact_035, inside the range the seeds occupied. The list below is
// the actual set of ids the seed arrays used, transcribed from the pre-re-key
// source and asserted by a test against that same source.

import { localStorageAdapter as storage } from "./storageAdapter.js";
import { ContactRepository } from "../repositories/contactRepository";
import { EncounterRepository } from "../repositories/encounterRepository";
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository";
import { TestingRepository } from "../repositories/testingRepository";
import { MedicationRepository } from "../repositories/medicationRepository";
import { VaccinationRepository } from "../repositories/vaccinationRepository";
import { MeasurementRepository } from "../repositories/measurementRepository";
import { SymptomLogRepository } from "../repositories/symptomLogRepository";
import { ContraceptionRepository } from "../repositories/contraceptionRepository";
import { MenstrualCycleRepository } from "../repositories/menstrualCycleRepository";
import { LocationsRepository } from "../repositories/locationsRepository";
import { EpisodeRepository } from "../repositories/episodeRepository";
import { LogRepository } from "../repositories/logRepository";
import { PregnancyRepository } from "../repositories/pregnancyRepository";

export const SEED_ID_MIGRATION_FLAG_KEY = "shos_seed_id_migrated_v1";

// The exact id set each seed array used BEFORE the re-key, transcribed from
// the pre-re-key source. Deliberately a literal list rather than a range: see
// the header. `seed_` prefix + the same trailing number, matching the re-key.
const LEGACY_SEED_ID_MAP = {
  contact_001: "seed_contact_9001",
  contact_002: "seed_contact_9002",
  contact_003: "seed_contact_9003",
  contact_004: "seed_contact_9004",
  contact_005: "seed_contact_9005",
  contact_006: "seed_contact_9006",
  contact_007: "seed_contact_9007",
  contact_008: "seed_contact_9008",
  contact_009: "seed_contact_9009",
  contact_010: "seed_contact_9010",
  contact_011: "seed_contact_9011",
  contact_012: "seed_contact_9012",
  contact_013: "seed_contact_9013",
  contact_014: "seed_contact_9014",
  contact_015: "seed_contact_9015",
  contact_016: "seed_contact_9016",

  encounter_001: "seed_encounter_9001",
  encounter_002: "seed_encounter_9002",
  encounter_003: "seed_encounter_9003",
  encounter_004: "seed_encounter_9004",
  encounter_005: "seed_encounter_9005",
  encounter_006: "seed_encounter_9006",
  encounter_007: "seed_encounter_9007",
  encounter_008: "seed_encounter_9008",
  encounter_009: "seed_encounter_9009",
  encounter_010: "seed_encounter_9010",
  encounter_011: "seed_encounter_9011",
  encounter_012: "seed_encounter_9012",
  encounter_013: "seed_encounter_9013",
  encounter_014: "seed_encounter_9014",
  encounter_015: "seed_encounter_9015",
  encounter_016: "seed_encounter_9016",
  encounter_017: "seed_encounter_9017",
  encounter_018: "seed_encounter_9018",

  visit_001: "seed_visit_9001",
  visit_002: "seed_visit_9002",
  visit_003: "seed_visit_9003",
  visit_004: "seed_visit_9004",
  visit_005: "seed_visit_9005",
  visit_006: "seed_visit_9006",

  test_001: "seed_test_9001",
  test_002: "seed_test_9002",
  test_003: "seed_test_9003",
  test_004: "seed_test_9004",
  test_005: "seed_test_9005",
  test_006: "seed_test_9006",
  test_007: "seed_test_9007",

  // NOTE the prefix is `med_`, not `medication_` - that is what the seed array
  // actually used, and it matches medicationRepository's own counter regex
  // /^med_(\d+)$/. Written as `medication_` this map silently matched nothing,
  // so an existing install's demo medications would have kept their old ids
  // forever while everything else migrated. Caught by the round-trip test
  // against the live seed arrays, which exists precisely so this file cannot
  // disagree with them.
  med_001: "seed_med_9001",
  med_002: "seed_med_9002",
  med_003: "seed_med_9003",
  med_004: "seed_med_9004",
  med_005: "seed_med_9005",
  med_006: "seed_med_9006",

  vaccination_001: "seed_vaccination_9001",
  vaccination_002: "seed_vaccination_9002",
  vaccination_003: "seed_vaccination_9003",
  vaccination_004: "seed_vaccination_9004",

  measurement_001: "seed_measurement_9001",
  measurement_002: "seed_measurement_9002",
  measurement_003: "seed_measurement_9003",
  measurement_004: "seed_measurement_9004",
  measurement_005: "seed_measurement_9005",
  measurement_006: "seed_measurement_9006",

  symlog_001: "seed_symlog_9001",
  symlog_002: "seed_symlog_9002",
  symlog_003: "seed_symlog_9003",

  contra_001: "seed_contra_9001",
  contra_002: "seed_contra_9002",
  contra_003: "seed_contra_9003",

  cycle_001: "seed_cycle_9001",
  cycle_002: "seed_cycle_9002",
  cycle_003: "seed_cycle_9003",

  location_001: "seed_location_9001",
  location_002: "seed_location_9002",
  location_003: "seed_location_9003",
  location_004: "seed_location_9004",
  location_005: "seed_location_9005",
  location_006: "seed_location_9006",
  location_007: "seed_location_9007",

  episode_001: "seed_episode_9001",

  log_001: "seed_log_9001",
  log_002: "seed_log_9002",
  log_003: "seed_log_9003",
  log_004: "seed_log_9004",
  log_005: "seed_log_9005",
  log_006: "seed_log_9006",
  log_007: "seed_log_9007",
  log_008: "seed_log_9008",
  log_009: "seed_log_9009",
  log_010: "seed_log_9010",
  log_011: "seed_log_9011",
  log_012: "seed_log_9012",
  log_013: "seed_log_9013",
  log_014: "seed_log_9014",

  pregnancy_001: "seed_pregnancy_9001",
  pregnancy_002: "seed_pregnancy_9002",
};

const LEGACY_SEED_IDS = new Set(Object.keys(LEGACY_SEED_ID_MAP));

// Every repository whose records can carry a seed id or reference one. Order is
// irrelevant - the whole set is rewritten together - but alphabetical matches
// clearSampleData.js's own ordering, so the two read as siblings.
const REPOSITORIES = [
  ["contacts", ContactRepository],
  ["encounters", EncounterRepository],
  ["clinic visits", ClinicVisitsRepository],
  ["tests", TestingRepository],
  ["medications", MedicationRepository],
  ["vaccinations", VaccinationRepository],
  ["measurements", MeasurementRepository],
  ["symptom log", SymptomLogRepository],
  ["contraception", ContraceptionRepository],
  ["menstrual cycles", MenstrualCycleRepository],
  ["locations", LocationsRepository],
  ["episodes", EpisodeRepository],
  ["medication logs", LogRepository],
  ["pregnancies", PregnancyRepository],
];

/**
 * True when a record is the user's own data and must not be touched.
 *
 * `isSeed === false` is the authoritative signal, checked FIRST so id
 * membership can never override it - the same ordering
 * clearSampleData.js's own isSampleRecord() uses, and for the same reason.
 */
function isUserRecord(record) {
  return record && record.isSeed === false;
}

/** Rewrites any *Id / *Ids field value that names a legacy seed id. */
function rewriteReferences(record, idsToRewrite) {
  let changed = false;
  const next = { ...record };
  for (const [key, value] of Object.entries(record)) {
    if (!key.endsWith("Id") && !key.endsWith("Ids")) continue;
    if (typeof value === "string") {
      if (idsToRewrite.has(value)) {
        next[key] = LEGACY_SEED_ID_MAP[value];
        changed = true;
      }
      continue;
    }
    if (Array.isArray(value)) {
      let arrayChanged = false;
      const mapped = value.map((v) => {
        if (typeof v === "string" && idsToRewrite.has(v)) {
          arrayChanged = true;
          return LEGACY_SEED_ID_MAP[v];
        }
        return v;
      });
      if (arrayChanged) {
        next[key] = mapped;
        changed = true;
      }
    }
  }
  return changed ? next : record;
}

/**
 * Plans the migration without performing it. Exported for its own test suite,
 * because the destructively-wrong version of this logic is invisible until it
 * has already run against real data.
 */
export function planSeedIdMigration(collections) {
  // Pass 1: which stored records are actually legacy seeds that need re-keying.
  // A user record is excluded here and stays excluded everywhere after.
  const idsToRewrite = new Set();
  const rekeyByCollection = new Map();
  let skippedUserRecords = 0;

  for (const { name, records } of collections) {
    const rekey = [];
    for (const record of records) {
      if (!record || typeof record !== "object") continue;
      if (!LEGACY_SEED_IDS.has(record.id)) continue;
      if (isUserRecord(record)) {
        // NOTE: this branch also means the id is NOT added to idsToRewrite, so
        // references to it stay pointing at the user's own record. That is the
        // correct outcome and it is load-bearing - see the "duplicates"
        // assertion in planSeedIdMigration's own test suite.
        skippedUserRecords++;
        continue;
      }
      rekey.push(record.id);
      idsToRewrite.add(record.id);
    }
    if (rekey.length) rekeyByCollection.set(name, new Set(rekey));
  }

  // A record carrying `isSeed === false` keeps its legacy id, while an UNEDITED
  // demo record on the SAME id would be re-keyed to a new one. Those two
  // records then share an id in the output, which every repository treats as a
  // primary key - two entries in a list, and a `find()` that returns whichever
  // the sort happens to put first.
  //
  // This cannot happen in a collection that genuinely honours ids as unique
  // (repositories derive the next id FROM the existing ids, so two records
  // cannot collide). It is guarded rather than assumed for one real reason:
  // the owner's own recovered data occupies exactly these legacy ids, so if an
  // import ever merged a backup into an existing collection without deduping -
  // backupService.js's Merge path, for instance - this is where it would land,
  // and a migration that is supposed to be strictly protective must not be the
  // thing that creates the corruption.
  const collisions = [];
  for (const { name, records } of collections) {
    const seen = new Set();
    for (const record of records) {
      if (!record || typeof record !== "object") continue;
      if (isUserRecord(record) && LEGACY_SEED_IDS.has(record.id)) {
        if (seen.has(record.id)) collisions.push(`${name}: ${record.id} appears more than once`);
        seen.add(record.id);
      }
    }
  }
  // Reported, never thrown from: a data-recovery path must not lock the user
  // out of their own app over a precondition. The caller sees the count.
  const duplicateUserIds = collisions;

  // Pass 2: rewrite ids and references across every collection.
  const rewritten = new Map();
  let totalChanged = 0;
  for (const { name, records } of collections) {
    const out = [];
    let changed = 0;
    for (const record of records) {
      if (!record || typeof record !== "object") {
        out.push(record);
        continue;
      }
      let next = record;
      // id first
      if (idsToRewrite.has(record.id)) {
        next = { ...next, id: LEGACY_SEED_ID_MAP[record.id] };
      }
      // then any *Id / *Ids field pointing at one
      next = rewriteReferences(next, idsToRewrite);
      if (next !== record) changed++;
      out.push(next);
    }
    if (changed) {
      rewritten.set(name, out);
      totalChanged += changed;
    }
  }

  return { idsToRewrite, rekeyByCollection, rewritten, totalChanged, skippedUserRecords, duplicateUserIds };
}

/**
 * Runs the migration once per install.
 *
 * Called from App.jsx's finishBootAfterUnlock(), alongside the other one-time
 * migrations, because storage.save() needs an unlocked vault - module-load-time
 * would fail for anyone with App Lock on, forever, and retry silently on every
 * cold boot. Gated on a stored flag so it costs one storage read per launch
 * rather than a 14-repository sweep, and so a fresh install does no work at all
 * (its records already carry the new ids).
 *
 * Never throws for one failing repository. A partial migration that reports
 * what it could not do is more useful than an exception, and the flag is NOT
 * set on partial failure - so the next launch retries rather than leaving the
 * install permanently half-migrated and therefore permanently unprotected.
 *
 * @returns {Promise<{migrated: number, skippedUserRecords: number, failed: {name: string, error: string}[]}>}
 */
export async function runSeedIdMigration() {
  if (await storage.load(SEED_ID_MIGRATION_FLAG_KEY, false)) {
    return { migrated: 0, skippedUserRecords: 0, duplicateUserIds: [], failed: [], skipped: true };
  }

  const collections = [];
  const failed = [];
  for (const [name, repo] of REPOSITORIES) {
    try {
      collections.push({ name, repo, records: await repo.getAll() });
    } catch (e) {
      failed.push({ name, error: e?.message || String(e) });
    }
  }

  // A repository we could not even READ is reported rather than silently
  // skipped: without this the caller would be told the migration succeeded
  // while that collection was never inspected, leaving demo data in it forever.
  if (failed.length) {
    return { migrated: 0, skippedUserRecords: 0, failed };
  }

const plan = planSeedIdMigration(collections);

  if (plan.duplicateUserIds.length) {
    // A user record on a legacy seed id appears twice in the same collection.
    // Re-keying would either drop one or write two records sharing an id, so
    // the safe move is to do nothing this boot and say why. The flag is NOT
    // set, so this reports again rather than silently giving up.
    return {
      migrated: 0,
      skippedUserRecords: plan.skippedUserRecords,
      duplicateUserIds: plan.duplicateUserIds,
      failed: [],
    };
  }

  if (plan.totalChanged === 0) {
    // Nothing to do - a fresh install, or already migrated. Set the flag either
    // way so the sweep does not repeat on every launch.
    await storage.save(SEED_ID_MIGRATION_FLAG_KEY, true);
    return {
      migrated: 0,
      skippedUserRecords: plan.skippedUserRecords,
      duplicateUserIds: [],
      failed: [],
    };
  }

  // Persist before touching the flag, and report per-repository failure so a
  // partial write is visible rather than assumed complete. The per-collection
  // changed count lives in the plan, so no re-counting (and no chance of
  // counting the same record twice) happens here.
  const writeFailed = [];
  for (const { name, repo } of collections) {
    const next = plan.rewritten.get(name);
    if (!next) continue;
    try {
      await repo.replaceAll(next);
    } catch (e) {
      writeFailed.push({ name, error: e?.message || String(e) });
    }
  }

  if (writeFailed.length) {
    // Deliberately NOT setting the flag: the install is half-migrated, and a
    // flag would make that permanent. Retrying next boot is the safe outcome.
    return {
      migrated: 0,
      skippedUserRecords: plan.skippedUserRecords,
      duplicateUserIds: [],
      failed: writeFailed,
    };
  }

  await storage.save(SEED_ID_MIGRATION_FLAG_KEY, true);
  return {
    migrated: plan.totalChanged,
    skippedUserRecords: plan.skippedUserRecords,
    duplicateUserIds: [],
    failed: [],
  };
}
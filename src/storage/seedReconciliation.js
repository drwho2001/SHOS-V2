// seedReconciliation.js
//
// WHY THIS FILE EXISTS
// --------------------
// Demo data is a feature, but it is frozen at the version the user happened to
// install. Correct a typo in a seed record, or add a demo record showing off a
// new feature, and every existing install keeps the old version forever - the
// array is only read when the storage key is ABSENT (see storageAdapter.js), so
// on a real install it is never consulted again. The fix then only ever reaches
// brand-new users.
//
// This reconciles stored demo records against the current seed arrays, once per
// app version. It is deliberately NOT a "reseed everything" pass, which would be
// both simpler and wrong: the user's own data lives in the same collections.
//
// WHAT IT DOES, IN THREE VERBS
// ----------------------------
//   add     - a seed id that is not stored is inserted
//   update  - a seed id that is stored but has drifted from the current
//             definition has its demo fields refreshed
//   never   - anything the user has touched is left completely alone
//
// THE ONE RULE THAT MATTERS MOST
// -------------------------------
// A record carrying `isSeed === false` is the USER'S OWN DATA and is never
// modified, never overwritten, never deleted. It is also absent from
// reconciliation's whole premise: a record the user edited stopped being a demo
// record the moment they edited it (that is what the 5 Oct `isSeed` stamp
// records), so re-applying the seed definition to it would silently discard
// their changes. Same ordering as clearSampleData.js's isSampleRecord().
//
// A missing flag is different: it means "never edited", which is exactly the
// record reconciliation IS allowed to refresh. Defaulting the other way would
// make the entire feature inert, since every untouched record has no flag.
//
// WHY NOT SIMPLY OVERWRITE ALL SEED IDS EVERY BOOT
// ------------------------------------------------
// Because it would be invisible. The user's real contacts live at ids ABOVE the
// seed range, so overwriting by seed id would "work" - and the first time a
// future seed array used a lower id, or a user's own record landed on a seed
// id, it would quietly destroy data with nothing to indicate why. Restricting
// writes to records that are not the user's own is the same rule the deletion
// path already uses, so the two cannot disagree.

import { localStorageAdapter as storage } from "./storageAdapter.js";
import { ContactRepository, SEED_CONTACT_IDS, seedContacts } from "../repositories/contactRepository";
import { EncounterRepository, SEED_ENCOUNTER_IDS, seedEncounters } from "../repositories/encounterRepository";
import { ClinicVisitsRepository, SEED_CLINIC_VISIT_IDS, seedVisits } from "../repositories/clinicVisitsRepository";
import { TestingRepository, SEED_TEST_IDS, seedTests } from "../repositories/testingRepository";
import { MedicationRepository, SEED_MEDICATION_IDS, seedMedications } from "../repositories/medicationRepository";
import { VaccinationRepository, SEED_VACCINATION_IDS, seedVaccinations } from "../repositories/vaccinationRepository";
import { MeasurementRepository, SEED_MEASUREMENT_IDS, seedMeasurements } from "../repositories/measurementRepository";
import { SymptomLogRepository, SEED_SYMPTOM_LOG_IDS, seedEntries as seedSymptomEntries } from "../repositories/symptomLogRepository";
import { ContraceptionRepository, SEED_CONTRACEPTION_IDS, seedEntries as seedContraceptionEntries } from "../repositories/contraceptionRepository";
import { MenstrualCycleRepository, SEED_MENSTRUAL_CYCLE_IDS, seedCycles } from "../repositories/menstrualCycleRepository";
import { LocationsRepository, SEED_LOCATION_IDS, seedLocations } from "../repositories/locationsRepository";
import { EpisodeRepository, SEED_EPISODE_IDS, seedEpisodes } from "../repositories/episodeRepository";
import { LogRepository, SEED_MEDICATION_LOG_IDS, seedLogs } from "../repositories/logRepository";
import { PregnancyRepository, SEED_PREGNANCY_IDS, seedPregnancies } from "../repositories/pregnancyRepository";

// The current demo-data shape. Bump SEED_DATA_VERSION in the same commit as any
// change to a seed array's CONTENT, or reconciliation will never notice the
// change - which is precisely the bug this file exists to fix, reintroduced.
export const SEED_DATA_VERSION = 1;

export const SEED_RECONCILIATION_FLAG_KEY = "shos_seed_reconciled_v1";

// Each entry pairs a repository with its seed id set and its seed DEFINITIONS.
// The definitions are only needed for the add/update halves - identifying a
// record as demo data needs the id set alone.
const REPOSITORIES = [
  ["contacts", ContactRepository, SEED_CONTACT_IDS, () => seedContacts],
  ["encounters", EncounterRepository, SEED_ENCOUNTER_IDS, () => seedEncounters],
  ["clinic visits", ClinicVisitsRepository, SEED_CLINIC_VISIT_IDS, () => seedVisits],
  ["tests", TestingRepository, SEED_TEST_IDS, () => seedTests],
  ["medications", MedicationRepository, SEED_MEDICATION_IDS, () => seedMedications],
  ["vaccinations", VaccinationRepository, SEED_VACCINATION_IDS, () => seedVaccinations],
  ["measurements", MeasurementRepository, SEED_MEASUREMENT_IDS, () => seedMeasurements],
  ["symptom log", SymptomLogRepository, SEED_SYMPTOM_LOG_IDS, () => seedSymptomEntries],
  ["contraception", ContraceptionRepository, SEED_CONTRACEPTION_IDS, () => seedContraceptionEntries],
  ["menstrual cycles", MenstrualCycleRepository, SEED_MENSTRUAL_CYCLE_IDS, () => seedCycles],
  ["locations", LocationsRepository, SEED_LOCATION_IDS, () => seedLocations],
  ["episodes", EpisodeRepository, SEED_EPISODE_IDS, () => seedEpisodes],
  ["medication logs", LogRepository, SEED_MEDICATION_LOG_IDS, () => seedLogs],
  ["pregnancies", PregnancyRepository, SEED_PREGNANCY_IDS, () => seedPregnancies],
];

// Fields that must never be copied from a seed definition onto a stored record.
// `id` is excluded from the copy but is the join key; `isSeed` is the user's own
// edit marker and belongs to the user, not to the seed.
function seedDefinitionById(definitions) {
  const map = new Map();
  for (const d of definitions) {
    if (d && d.id) map.set(d.id, d);
  }
  return map;
}

/** True when a stored record is the user's own data and must not be touched. */
function isUserRecord(record) {
  return record && record.isSeed === false;
}

/**
 * Fields worth comparing between a stored seed record and the current
 * definition. Deliberately EXCLUDES anything user-meaningful:
 *
 *   - isSeed / updatedAt / createdAt: not demo content, and `isSeed` is the
 *     user's own edit marker - copying it in would be actively harmful.
 *   - Arrays of ids that reference OTHER seeds: those are rewritten by
 *     seedIdMigration.js, and reconciliation re-adding a reference the user
 *     removed would resurrect data they deleted on purpose.
 *
 * A stored demo record whose only difference from the definition is one of
 * these is treated as unchanged, so reconciliation stays a no-op in the normal
 * case rather than churning every stored record on every version bump.
 */
function demoContent(record) {
  const out = {};
  for (const [k, v] of Object.entries(record)) {
    if (k === "isSeed" || k === "updatedAt" || k === "createdAt") continue;
    if (k.endsWith("Ids") && Array.isArray(v)) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Plans reconciliation without performing it. Exported so the decisions can be
 * tested directly - the dangerous version of this logic is the one that
 * overwrites a record the user edited, and that is invisible until it runs.
 */
export function planSeedReconciliation(collections, definitionsByName) {
  const added = [];
  const updated = [];
  const skippedUserRecords = [];
  const rewrittenByName = {};

  for (const { name, records, seedIds } of collections) {
    const definitions = seedDefinitionById(definitionsByName[name] || []);
    const stored = new Map();
    for (const r of records) {
      if (r && r.id) stored.set(r.id, r);
    }

    let changed = false;
    const out = [...records];

    for (const [id, definition] of definitions) {
      const existing = stored.get(id);

      if (!existing) {
        // ADD: a demo record new in this version that the user has not seen.
        out.push({ ...definition });
        added.push({ collection: name, id });
        changed = true;
        continue;
      }

      if (isUserRecord(existing)) {
        // NEVER: the user's own record. Not updated, not removed.
        skippedUserRecords.push({ collection: name, id });
        continue;
      }

      // UPDATE: only if the demo CONTENT actually drifted.
      const currentDemo = demoContent(existing);
      const wantedDemo = demoContent(definition);
      if (JSON.stringify(currentDemo) === JSON.stringify(wantedDemo)) continue;

      const merged = { ...existing };
      for (const [k, v] of Object.entries(wantedDemo)) {
        if (JSON.stringify(merged[k]) !== JSON.stringify(v)) merged[k] = v;
      }
      // isSeed is the user's marker: absent stays absent, false stays false.
      merged.isSeed = existing.isSeed;
      out[out.indexOf(existing)] = merged;
      updated.push({ collection: name, id });
      changed = true;
    }

    if (changed) rewrittenByName[name] = out;
  }

  return { added, updated, skippedUserRecords, rewritten: rewrittenByName };
}

/**
 * Reconciles stored demo data with the current seed arrays, once per app
 * version.
 *
 * Called from App.jsx's finishBootAfterUnlock(), alongside the other one-time
 * migrations, because storage.save() needs an unlocked vault. Gated on a stored
 * version marker so the cost is one storage read per launch rather than a
 * 14-repository sweep, and so a fresh install does no work.
 *
 * Never throws for one failing repository. On a partial failure the version
 * marker is deliberately NOT advanced, so the next launch retries rather than
 * leaving the install permanently unreconciled while claiming it is done.
 *
 * @returns {Promise<{version: number, added: number, updated: number,
 *   skippedUserRecords: number, failed: {name: string, error: string}[]}>}
 */
export async function runSeedReconciliation() {
  const reconciledTo = await storage.load(SEED_RECONCILIATION_FLAG_KEY, 0);
  if (reconciledTo === SEED_DATA_VERSION) {
    return { version: SEED_DATA_VERSION, added: 0, updated: 0, skippedUserRecords: 0, failed: [], skipped: true };
  }

  const collections = [];
  const failed = [];
  for (const [name, repo, seedIds, getDefinitions] of REPOSITORIES) {
    try {
      collections.push({ name, repo, seedIds, records: await repo.getAll(), getDefinitions });
    } catch (e) {
      failed.push({ name, error: e?.message || String(e) });
    }
  }

  // A repository we could not READ is reported rather than skipped: without
  // this the caller would be told reconciliation succeeded while that
  // collection was never inspected.
  if (failed.length) {
    return { version: SEED_DATA_VERSION, added: 0, updated: 0, skippedUserRecords: 0, failed };
  }

  const definitionsByName = {};
  for (const c of collections) definitionsByName[c.name] = c.getDefinitions();

  const plan = planSeedReconciliation(collections, definitionsByName);

  const writeFailed = [];
  for (const c of collections) {
    const next = plan.rewritten[c.name];
    if (!next) continue;
    try {
      await c.repo.replaceAll(next);
    } catch (e) {
      writeFailed.push({ collection: c.name, error: e?.message || String(e) });
    }
  }

  if (writeFailed.length) {
    return {
      version: SEED_DATA_VERSION,
      added: plan.added.length,
      updated: plan.updated.length,
      skippedUserRecords: plan.skippedUserRecords.length,
      failed: writeFailed.map((f) => ({ name: f.collection, error: f.error })),
    };
  }

  await storage.save(SEED_RECONCILIATION_FLAG_KEY, SEED_DATA_VERSION);
  return {
    version: SEED_DATA_VERSION,
    added: plan.added.length,
    updated: plan.updated.length,
    skippedUserRecords: plan.skippedUserRecords.length,
    failed: [],
  };
}
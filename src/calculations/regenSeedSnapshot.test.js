// One-shot regenerator for the frozen snapshot inside src/calculations/seedDivergence.js.
//
// Run it through vitest (`node node_modules/vitest/vitest.mjs run src/calculations/regenSeedSnapshot.test.js`)
// because the storage adapter's vault has to be initialised before any repository
// will load, and bare `node` cannot do that.
//
// WHY IT READS THE REPOSITORIES RATHER THAN THE SEED ARRAYS, which is the whole
// point (third and deepest of the three causes found 6 Oct):
//
// the snapshot was originally captured from each repository's RAW seed array, but
// every record the app actually holds is built as `{ ...DEFAULT_X, ...row }` and
// then normalised. So a live medication carries `route`, `medicationType`,
// `doseComponents`, `scheduleIntervalDays` and `refillCancelledAt` that the
// snapshot row never had, and comparing full key sets can never match. Measured
// against the live repositories: 6/6 medications, 14/14 logs, 2/4 vaccinations
// and 1/1 episodes all classified as the user's own data.
//
// THE ASYMMETRY THAT FORCES REGENERATION RATHER THAN A NARROWER COMPARISON:
//
//   compare only snapshot-known fields -> an UNEDITED demo record reads as
//     diverged, so Clear Sample Data deletes nothing. Broken feature, no loss.
//   compare all fields (today) -> a user who edited one of the newer fields has
//     that edit invisible to the rule and their record is DELETED.
//
// One direction breaks a button, the other destroys records, so the fixture is
// fixed rather than the comparison.
//
// It is generated once and committed like any other source file. Running it
// per-import would make the snapshot a moving target and re-open the hole this
// closes; `snapshotFidelity.test.js` is what keeps it honest afterwards.

import { writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, vi } from "vitest";
import { ContactRepository } from "../repositories/contactRepository.js";
import { EncounterRepository } from "../repositories/encounterRepository.js";
import { TestingRepository } from "../repositories/testingRepository.js";
import { MedicationRepository } from "../repositories/medicationRepository.js";
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository.js";
import { VaccinationRepository } from "../repositories/vaccinationRepository.js";
import { SymptomLogRepository } from "../repositories/symptomLogRepository.js";
import { MeasurementRepository } from "../repositories/measurementRepository.js";
import { LocationsRepository } from "../repositories/locationsRepository.js";
import { EpisodeRepository } from "../repositories/episodeRepository.js";
import { LogRepository } from "../repositories/logRepository.js";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TARGET = join(REPO, "src", "calculations", "seedDivergence.js");

const COLLECTIONS = [
  ["Contacts", ContactRepository],
  ["Encounters", EncounterRepository],
  ["Tests", TestingRepository],
  ["Medications", MedicationRepository],
  ["ClinicVisits", ClinicVisitsRepository],
  ["Vaccinations", VaccinationRepository],
  ["SymptomLog", SymptomLogRepository],
  ["Measurements", MeasurementRepository],
  ["Locations", LocationsRepository],
  ["Episodes", EpisodeRepository],
  ["Logs", LogRepository],
];

// Snapshot ids live in the legacy space (`contact_001`) because the snapshot must
// answer for an install from BEFORE the 3a re-key as well as after it, and
// normaliseLegacyId() maps both onto one key.
function toLegacyId(id) {
  const bare = id.startsWith("seed_") ? id.slice(5) : id;
  const m = /^([A-Za-z]+)_(\d{4})$/.exec(bare);
  if (!m) return bare;
  const n = Number(m[2]);
  if (n < 9000 || n > 9999) return bare;
  return `${m[1]}_${String(n - 9000).padStart(3, "0")}`;
}

// This file REWRITES src/calculations/seedDivergence.js. It therefore does not
// run unless asked for by name, and never as part of the normal suite or CI:
// a test that edits source on every run is a way to end up with an uncommitted
// change nobody made, and the encoding/pre-commit guards would report it as a
// stray edit rather than as the regeneration it was.
//
//   $env:SHOS_REGEN_SNAPSHOT = "1"
//   node node_modules/vitest/vitest.mjs run src/calculations/regenSeedSnapshot.test.js
describe.skipIf(!process.env.SHOS_REGEN_SNAPSHOT)("regenerate the frozen snapshot", () => {
  it("rewrites RAW_LEGACY_SEED_ARRAYS from what the repositories return", async () => {
    const arrays = {};
    let total = 0;

    for (const [name, repo] of COLLECTIONS) {
      const all = await repo.getAll();
      // Only ids in the seed_*_900N space are demo data. Everything else in a
      // collection is either the owner's own record or a non-seeded one.
      const seeded = all
        .filter((r) => r && typeof r.id === "string" && /^seed_[A-Za-z]+_9\d{3}$/.test(r.id))
        .map((r) => ({ ...r, id: toLegacyId(r.id) }));
      if (seeded.length) {
        arrays[name] = seeded;
        total += seeded.length;
      }
    }

    if (!total) {
      // A silently empty snapshot would make every demo record undeletable while
      // every behavioural test still passed - the failure mode this whole round
      // exists to prevent. Refuse rather than write it.
      throw new Error(
        "Generator produced 0 seeded records. The repositories returned nothing in " +
          "the seed_*_900N id space, so writing this would blank the snapshot and make " +
          "Clear Sample Data delete nothing - with every unit test still green.",
      );
    }

    const body = `export const RAW_LEGACY_SEED_ARRAYS = ${JSON.stringify(arrays, null, 2)};`;
    const src = readFileSync(TARGET, "utf8");
    const re = /export const RAW_LEGACY_SEED_ARRAYS = \{[\s\S]*?\n\};/;
    if (!re.test(src)) throw new Error("could not find RAW_LEGACY_SEED_ARRAYS in seedDivergence.js");
    const next = src.replace(re, body);
    writeFileSync(TARGET, next, "utf8");

    // SNAPSHOT_TAKEN_AT has to move with the data. The seed arrays build their
    // dates relative to TODAY, so a snapshot regenerated today has dates that
    // mean "N days before today" - and comparing them against an epoch a day out
    // makes every date-bearing record read as diverged. Leaving it stale after a
    // regeneration is exactly the bug this whole round is about: the fixture and
    // its stated epoch disagreeing with nothing reporting it.
    const today = (() => {
      const d = new Date();
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    })();

    let out = next.replace(/export const SNAPSHOT_TAKEN_AT = "[^"]*"/, `export const SNAPSHOT_TAKEN_AT = "${today}"`);
    const sizeMatch = out.match(/LEGACY_SEED_SNAPSHOT_SIZE = (\d+)/);
    if (sizeMatch) {
      out = out.replace(/LEGACY_SEED_SNAPSHOT_SIZE = \d+/, `LEGACY_SEED_SNAPSHOT_SIZE = ${total}`);
    }
    writeFileSync(TARGET, out, "utf8");

    console.log(`\n  snapshot regenerated: ${total} records across ${Object.keys(arrays).length} collections`);
    console.log(`  SNAPSHOT_TAKEN_AT set to ${today}`);
    for (const [name, rows] of Object.entries(arrays)) {
      console.log(`    ${name}: ${rows.length}`);
    }
  });
});
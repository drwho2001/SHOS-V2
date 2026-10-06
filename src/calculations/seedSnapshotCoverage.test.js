// The frozen seed snapshot must describe EVERY collection that has seed data.
//
// WHY THIS EXISTS. src/calculations/seedDivergence.js holds a frozen capture of
// the demo ("seed") records, and it is the thing that lets Clear Sample Data tell
// a demo record from a real one without guessing. It was regenerated from the
// repositories' real output by src/calculations/regenSeedSnapshot.test.js, which
// reads a hand-written `COLLECTIONS` list.
//
// That list had 11 entries. FOURTEEN repositories export a `SEED_*_IDS` set.
// Menstrual cycle, contraception and pregnancy were never in it, so their 8
// legacy demo ids are absent from the snapshot - and an id absent from the
// snapshot is classified as the USER's data, which is the safe direction but
// means those demo rows are never cleared. So the feature was quietly incomplete
// on exactly the collections a user reaches by turning tracking on.
//
// The recorded reason was that those seed arrays "are empty when
// menstrualTrackingEnabled is false". That was wrong, and measurably so: the
// arrays are populated unconditionally (`seed_cycle_9001`..`9003`, the
// contraception and pregnancy entries). Nobody had grepped. A wrong reason written
// into a task title sends the next session looking for a preference gate that
// does not exist - which is the failure this file's own comment had to correct.
//
// WHAT IS ASSERTED, and why it is all static: an id missing from the snapshot is
// indistinguishable from a real record, and that is exactly the class of defect
// that a test which imports the repositories cannot catch cleanly (the vault has
// to be initialised, and importing them for a read-only assertion drags that in).
// So this reads source text only - no repository imports, no vault, no clock.
//
//   1. every repository exporting SEED_*_IDS is collected by the regenerator
//   2. the snapshot's own collection count matches what the regenerator collects
//   3. every seed id any repository declares literally is present in the snapshot
//
// (3) is the end-to-end one, and it is what makes 1 and 2 necessary rather than
// pedantic: it fails by naming the ids that are missing.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { normaliseLegacyId } from "./seedDivergence.js";
import { isDemoData, legacyDefinitionFor } from "./seedDivergence.js";
import { MenstrualCycleRepository } from "../repositories/menstrualCycleRepository.js";
import { ContraceptionRepository } from "../repositories/contraceptionRepository.js";
import { PregnancyRepository } from "../repositories/pregnancyRepository.js";

const REPO = join(process.cwd());
const REPOS_DIR = join(REPO, "src", "repositories");
const SNAPSHOT = join(REPO, "src", "calculations", "seedDivergence.js");
const REGEN = join(REPO, "src", "calculations", "regenSeedSnapshot.test.js");

const snapshotSrc = readFileSync(SNAPSHOT, "utf8");
const regenSrc = readFileSync(REGEN, "utf8");

/** Repositories that declare demo data, with the seed array each one derives it from. */
function repositoriesWithSeedData() {
  const out = [];
  for (const file of readdirSync(REPOS_DIR).filter((f) => f.endsWith("Repository.js"))) {
    const src = readFileSync(join(REPOS_DIR, file), "utf8");
    for (const m of src.matchAll(/export const (SEED_[A-Z_]+_IDS) = new Set\((\w+)\.map/g)) {
      out.push({ file, set: m[1], array: m[2], src });
    }
  }
  return out;
}

const seedRepos = repositoriesWithSeedData();

/** The literal demo ids a repository declares, e.g. seed_cycle_9001. */
function declaredSeedIds(src) {
  return [...new Set([...src.matchAll(/"(seed_[a-z]+_\d{4})"/g)].map((m) => m[1]))];
}

/**
 * The id form the snapshot actually stores.
 *
 * The first version of this file compared the repository's own literal
 * `seed_log_9008` against the snapshot and reported it missing - along with
 * every other id in all 14 repositories, so the failure named 30+ records and the
 * three real omissions were lost in the noise. The snapshot stores the LEGACY id
 * (`log_008`) because it has to answer for installs from before the 3a re-key as
 * well as after it, so the comparison has to normalise first.
 *
 * It imports `normaliseLegacyId` rather than re-deriving the mapping. A second
 * copy of that rule is a second thing that can drift, and this file's whole
 * subject is a fixture drifting away from its source.
 */
function snapshotIdForm(id) {
  return normaliseLegacyId(id);
}

describe("the frozen seed snapshot covers every collection that has demo data", () => {
  it("the sweep actually found the repositories, so the assertions below can fail", () => {
    // Non-vacuity, as a precondition rather than an afterthought: an empty list
    // would make every "everything is covered" assertion below trivially true,
    // and a guard that cannot fail is worse than no guard.
    expect(seedRepos.length, "repositories exporting SEED_*_IDS").toBeGreaterThan(10);
    expect(declaredSeedIds(seedRepos.find((r) => r.set === "SEED_CONTACT_IDS").src).length)
      .toBeGreaterThan(0);
  });

  it("every repository with demo data is collected by the regenerator", () => {
    const collected = new Set(
      [...regenSrc.matchAll(/import \{ (\w+) \} from "\.\.\/repositories\/(\w+)\.js"/g)].map((m) => m[2])
    );
    const missing = seedRepos.filter((r) => !collected.has(r.file.replace(/\.js$/, "")));
    expect(
      missing.map((r) => `${r.set} (${r.file})`),
      "these repositories declare demo data the regenerator never reads"
    ).toEqual([]);
  });

  it("the snapshot holds exactly the collections the regenerator collects", () => {
    const body = snapshotSrc.slice(snapshotSrc.indexOf("RAW_LEGACY_SEED_ARRAYS"));
    const keys = [...new Set([...body.matchAll(/^ {2}"?([A-Za-z]+)"?:/gm)].map((m) => m[1]))];
    const collected = new Set(
      [...regenSrc.matchAll(/^ {2}\["(\w+)", /gm)].map((m) => m[1])
    );
    expect(keys.length, "collections in the snapshot").toBe(collected.size);
  });

  it("every demo id a repository declares is present in the snapshot", () => {
    // The end-to-end assertion. A missing id is not a cosmetic gap: the rule
    // treats an id it cannot recognise as the user's own data, so the demo row
    // survives Clear Sample Data. Safe, but a feature that silently does nothing
    // on the collections a user opts into.
    const missing = [];
    for (const repo of seedRepos) {
      for (const id of declaredSeedIds(repo.src)) {
        if (!snapshotSrc.includes(snapshotIdForm(id))) missing.push(`${id} (${repo.set})`);
      }
    }
    expect(missing, "demo ids absent from the frozen snapshot").toEqual([]);
  });
});

// The half that needs the repositories.
//
// Everything above is static on purpose, so it can run anywhere with no vault.
// But "the id is present in the fixture" is not the outcome anyone cares about -
// the outcome is that Clear Sample Data recognises the record, and that is
// isDemoData's full-field comparison against the snapshot row. A snapshot can be
// complete and still fail to classify, so this half exists to prove the end state
// rather than the inventory.
//
// Fixtures here are the REAL records the repositories hold, not hand-made ones.
// The first version built a three-field object and isDemoData correctly rejected
// it - which proves nothing except that the comparison is strict, because the
// snapshot row carries the full DEFAULT_X shape.
describe("the three collections the snapshot used to be missing classify as demo data", () => {
  const CASES = [
    ["cycle", MenstrualCycleRepository, "seed_cycle_9001"],
    ["contraception", ContraceptionRepository, "seed_contra_9001"],
    ["pregnancy", PregnancyRepository, "seed_pregnancy_9001"],
  ];

  it.each(CASES)("a real seeded %s record is demo data", async (_label, repo, seedId) => {
    const all = await repo.getAll();
    const rec = all.find((r) => r.id === seedId);
    expect(rec, `${seedId} should exist in the repository`).toBeTruthy();
    expect(legacyDefinitionFor(rec), "should be in the frozen snapshot").toBeTruthy();
    expect(isDemoData(rec), "should classify as demo data").toBe(true);
  });

  it("recognising those ids did not make an EDITED record deletable", async () => {
    // The safety direction, and the reason the previous gap was tolerable at all:
    // an id missing from the snapshot is treated as the user's data, which is
    // safe. Going from 88 recognised ids to 96 must not turn into "96 records
    // Clear Sample Data may delete" - an edit, or an explicit isSeed:false, still
    // wins.
    const all = await MenstrualCycleRepository.getAll();
    const rec = all.find((r) => r.id === "seed_cycle_9001");
    expect(rec).toBeTruthy();
    expect(isDemoData({ ...rec, notes: "my own note" }), "an edited record must survive").toBe(false);
    expect(isDemoData({ ...rec, isSeed: false }), "an explicit flag must win").toBe(false);
  });
});
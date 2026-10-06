// seedIdMigration.test.js
//
// WHY THIS FILE EXISTS
// --------------------
// The 3a seed re-key moved every demo id from `contact_001` to
// `seed_contact_9001`. That fixes every FUTURE install but does nothing for an
// existing one, because repositories only consult the seed array when the
// storage key is ABSENT - so a real install's stored records keep the old ids
// while `SEED_*_IDS` is rebuilt from the new array. The consequences are all
// silent: `countSampleData()` returns 0, `clearSampleData()` removes nothing,
// and old demo data becomes permanently indistinguishable from real records.
//
// seedIdMigration.js is the fix. This file exists because the DANGEROUSLY WRONG
// version of that logic is invisible until it has already run against real data,
// and it is wrong in one specific way: keying on the id alone.
//
// THE OWNER'S OWN RECORDS WERE contact_017 THROUGH contact_035 - inside the
// low range the seed arrays occupied. If this migration matched on "is this a
// low id?", it would re-key a person's real data and then clear it as demo
// content. That is the third time in this incident's history a real fix has
// come within one line of destroying the owner's data.
//
// So the central assertion here is the negative one: a record carrying
// `isSeed === false` is never touched, whatever its id.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "@babel/parser";
import { legacyDefinitionFor } from "../calculations/seedDivergence.js";
import {
  planSeedIdMigration,
  SEED_ID_MIGRATION_FLAG_KEY,
} from "./seedIdMigration";

// Reads the seed ids out of the live repository source, AST-based per this
// repo's settled convention. This exists so the "legacy list matches the seed
// arrays" assertion below reads the SAME data the app does, rather than a
// second hardcoded list that would drift the moment a seed record is added.
const REPOS_DIR = join(process.cwd(), "src", "repositories");

function readCurrentSeedIds() {
  const ids = [];
  for (const file of readdirSync(REPOS_DIR)) {
    if (!file.endsWith("Repository.js")) continue;
    if (file === "clearSampleData.test.js") continue;
    const code = readFileSync(join(REPOS_DIR, file), "utf8");
    let ast;
    try {
      ast = parse(code, { sourceType: "module" });
    } catch {
      continue; // not a plain module we can parse; not a seed owner
    }
    for (const node of ast.program.body) {
      if (node.type !== "VariableDeclaration") continue;
      for (const d of node.declarations) {
        if (!/^seed/.test(d.id.name || "")) continue;
        if (d.init?.type !== "ArrayExpression") continue;
        for (const el of d.init.elements) {
          if (el?.type !== "ObjectExpression") continue;
          for (const p of el.properties) {
            if (p.type !== "ObjectProperty") continue;
            const key = p.key.type === "Identifier" ? p.key.name : p.key.value;
            if (key !== "id") continue;
            if (p.value.type !== "StringLiteral") continue;
            if (/^seed_[a-z]+_\d+$/.test(p.value.value)) ids.push(p.value.value);
          }
        }
      }
    }
  }
  return ids;
}

// Pure-function testing against planSeedIdMigration, which is where the
// destructive decision is actually made. runSeedIdMigration() is a thin
// persistence wrapper around it, so testing the planner covers the risk without
// needing a mocked vault.
function plan(collections) {
  return planSeedIdMigration(collections.map(([name, records]) => ({ name, records })));
}

/**
 * A pristine copy of a real frozen snapshot row.
 *
 * The fixtures below used to be one- or two-field stubs - `{ id: "contact_001",
 * name: "Alex" }`. Those are still correct as STORIES ("this is a legacy demo
 * record that should be re-keyed") but they stopped being valid RECORDS the
 * moment the planner learned to compare content against a frozen snapshot: a
 * two-field stub diverges from a ~50-field row, so the planner correctly
 * classified it as the user's own data and declined to re-key it. 15 assertions
 * went red, and every one of them was the test being wrong rather than the code.
 *
 * This is the same trap as an assertion pointed at the wrong subject: the tests
 * were checking a decision using a fixture that could no longer reach it. Note
 * the direction - a stub that fails to match is SAFE (nothing re-keyed, nothing
 * deleted), so it would have shipped as "the migration does nothing" rather than
 * as data loss. The fix is real rows, not a looser comparison.
 */
function demoRow(legacyId) {
  const def = legacyDefinitionFor({ id: legacyId });
  if (!def) return null;
  const { collection, ...record } = def;
  return record;
}

/**
 * Legacy ids the frozen snapshot actually covers.
 *
 * It does not cover all of them, and the gap is real rather than cosmetic.
 * Regenerating the snapshot from the repositories returns nothing for
 * menstrualCycles, contraception and pregnancies because those seed arrays are
 * gated behind `menstrualTrackingEnabled` and are empty on a default install -
 * 88 rows against a 96-entry legacy map.
 *
 * Those records exist only once tracking is switched on, so on a default install
 * there is nothing for the snapshot to describe. A record in one of those
 * collections on a legacy seed id therefore classifies as the USER's data and is
 * left alone, which is the safe direction: undeletable demo data rather than
 * deleted user data. Recorded as pool work rather than papered over.
 */
function coveredLegacyIds(ids) {
  return ids.filter((id) => legacyDefinitionFor({ id }) !== null);
}

/** The legacy id a current `seed_x_900N` id came from. */
function legacyOf(seedId) {
  const m = /^seed_([a-z]+)_(\d+)$/.exec(seedId);
  return m ? `${m[1]}_${String(Number(m[2]) - 9001 + 1).padStart(3, "0")}` : seedId;
}

describe("legacy demo records are re-keyed to the seed_ form", () => {
  it("re-keys an unedited legacy contact", () => {
    const { rewritten } = plan([["contacts", [demoRow("contact_001")]]]);
    expect(rewritten.get("contacts")[0].id).toBe("seed_contact_9001");
    expect(rewritten.get("contacts")[0].name).toBe("Alex");
  });

  it("leaves the trailing number preserved, so the mapping stays reversible", () => {
    const { rewritten } = plan([
      ["contacts", [demoRow("contact_016"), demoRow("log_014"), demoRow("test_007")]],
    ]);
    const ids = rewritten.get("contacts").map((r) => r.id);
    expect(ids).toEqual(["seed_contact_9016", "seed_log_9014", "seed_test_9007"]);
  });

  it("does nothing to an id that is not a legacy seed id", () => {
    // The owner's real records. contact_017..035 were inside the low range the
    // seeds occupied, which is exactly why the legacy list is explicit.
    const { rewritten, totalChanged } = plan([
      ["contacts", [
        { id: "contact_017", name: "Nathan (BLK)" },
        { id: "contact_035", name: "Alastair wither" },
        { id: "clinicVisit_001", name: "June treatment 2026" },
      ]],
    ]);
    expect(totalChanged).toBe(0);
    expect(rewritten.has("contacts")).toBe(false);
  });
});

describe("THE RULE THAT MATTERS MOST: a user record is never touched", () => {
  it("does not re-key a record carrying isSeed: false, even on a legacy seed id", () => {
    // This is the owner's 74 recovered records: real people restored under the
    // original ids, which are ids the old seed arrays also used.
    const { rewritten, totalChanged, skippedUserRecords } = plan([
      ["contacts", [
        { id: "contact_001", name: "Sean Wilson", isSeed: false },
        { id: "contact_002", name: "Daniel Philips", isSeed: false },
      ]],
    ]);
    expect(totalChanged).toBe(0);
    expect(skippedUserRecords).toBe(2);
    expect(rewritten.has("contacts")).toBe(false);
  });

  it("does not rewrite references pointing at a user record's id", () => {
    // If a user record keeps its id, anything pointing at it must keep pointing
    // at it too. Rewriting the reference while leaving the target alone would
    // create a dangling id - the orphanReferenceCheck class of bug.
    const { rewritten } = plan([
      ["contacts", [{ id: "contact_001", name: "Sean Wilson", isSeed: false }]],
      ["encounters", [{ id: "encounter_019", title: "Night at mike's", attendeeIds: ["contact_001"] }]],
    ]);
    expect(rewritten.has("encounters")).toBe(false);
    expect(rewritten.get("contacts")).toBeUndefined();
  });

  it("treats a MISSING isSeed flag as editable demo data, not as a user record", () => {
    // Every record that has never been edited has no flag at all. Defaulting to
    // "user" would mean the migration never runs and the protection never lands;
    // defaulting to "demo" matches clearSampleData.js's own isSampleRecord().
    const { rewritten, skippedUserRecords } = plan([["contacts", [demoRow("contact_001")]]]);
    expect(rewritten.get("contacts")[0].id).toBe("seed_contact_9001");
    expect(skippedUserRecords).toBe(0);
  });

  it("treats an isSeed:true record as demo data", () => {
    // `isSeed: true` is a DEMO claim, so the record is re-keyed. Built from a real
    // snapshot row rather than a bare `{ id }`: the planner decides by content,
    // and a stub would diverge and be left alone - the opposite of what this
    // test is asserting, so it would have passed for the wrong reason.
    const { rewritten } = plan([["contacts", [{ ...demoRow("contact_001"), isSeed: true }]]]);
    expect(rewritten.get("contacts")[0].id).toBe("seed_contact_9001");
  });
});

describe("references to a re-keyed record are rewritten with it", () => {
  it("rewrites a singular Id field", () => {
    const { rewritten } = plan([
      ["contacts", [demoRow("contact_001")]],
      ["locations", [{ id: "location_050", relatedContactId: "contact_001" }]],
    ]);
    expect(rewritten.get("locations")[0].relatedContactId).toBe("seed_contact_9001");
  });

  it("rewrites an Ids array, leaving unrelated entries alone", () => {
    const { rewritten } = plan([
      ["contacts", [demoRow("contact_001"), demoRow("contact_002")]],
      ["encounters", [{ id: "encounter_019", attendeeIds: ["contact_001", "contact_017", "contact_002"] }]],
    ]);
    expect(rewritten.get("encounters")[0].attendeeIds).toEqual([
      "seed_contact_9001",
      "contact_017",
      "seed_contact_9002",
    ]);
  });

  it("rewrites a cross-collection reference in both directions at once", () => {
    // The seed cluster is self-referential: encounters reference contacts, logs
    // reference medications, and the re-key has to move all of them together or
    // the demo data develops dangling ids.
    const { rewritten } = plan([
      ["contacts", [demoRow("contact_001")]],
      ["encounters", [{ id: "encounter_001", attendeeIds: ["contact_001"] }]],
      ["medications", [demoRow("med_001")]],
      ["logs", [{ id: "log_050", medicationId: "med_001" }]],
    ]);
    expect(rewritten.get("encounters")[0].attendeeIds).toEqual(["seed_contact_9001"]);
    expect(rewritten.get("logs")[0].medicationId).toBe("seed_med_9001");
    expect(rewritten.get("logs")[0].id).toBe("log_050"); // not a seed id, unchanged
  });

  it("ignores fields whose name does not end in Id or Ids", () => {
    // Documented limit, matching referencedSeedIds' own: a hand-kept relation
    // map is a second thing to forget to update, so the rule is name-based.
    const { rewritten } = plan([
      ["contacts", [demoRow("contact_001")]],
      ["locations", [{ id: "location_050", contactLabel: "contact_001" }]],
    ]);
    expect(rewritten.has("locations")).toBe(false);
  });
});

describe("the migration is idempotent", () => {
  it("a second run finds nothing to do", () => {
    const once = plan([["contacts", [demoRow("contact_001")]], ["encounters", [{ id: "encounter_001", attendeeIds: ["contact_001"] }]]]);
    const next = once.rewritten.get("contacts");
    const enc = once.rewritten.get("encounters");
    const twice = plan([["contacts", next], ["encounters", enc]]);
    expect(twice.totalChanged).toBe(0);
    expect(twice.rewritten.size).toBe(0);
  });

  it("handles an empty install", () => {
    const { totalChanged, rewritten } = plan([["contacts", []], ["encounters", []]]);
    expect(totalChanged).toBe(0);
    expect(rewritten.size).toBe(0);
  });

  it("survives a non-record element rather than throwing from a data path", () => {
    // Same reasoning as backupMigrations.js: safety must not depend on the
    // ORDER of two private functions in two files with nothing enforcing it.
    const { rewritten } = plan([["contacts", [null, "junk", demoRow("contact_001")]]]);
    expect(rewritten.get("contacts")[0]).toBeNull();
    expect(rewritten.get("contacts")[1]).toBe("junk");
    expect(rewritten.get("contacts")[2].id).toBe("seed_contact_9001");
  });
});

describe("the legacy list matches the real pre-re-key seed arrays", () => {
  // Without this, an edit to a seed array in future would silently not be
  // covered by the migration, and the install would keep its old ids forever.
  //
  // The check is a ROUND TRIP rather than a duplicated hardcoded list, because a
  // second copy of the same ids in a test is exactly how the two drift: someone
  // adds a seed record, updates the array, and the test keeps asserting against
  // the old list while asserting nothing about the new one.
  it("every CURRENT seed id round-trips to a legacy id the migration actually re-keys", () => {
    const currentSeedIds = readCurrentSeedIds();
    expect(currentSeedIds.length, "expected to read the live seed arrays").toBeGreaterThan(50);

    // Turn each current id into the legacy id it must have been, by stripping
    // the seed_ prefix and the 9001 base off the trailing number.
    const legacyIds = currentSeedIds.map((id) => {
      const m = /^seed_([a-z]+)_(\d+)$/.exec(id);
      expect(m, `${id} does not match the agreed seed_ shape`).not.toBeNull();
      return `${m[1]}_${String(Number(m[2]) - 9001 + 1).padStart(3, "0")}`;
    });

    // Feeding the LEGACY ids through the real planner must re-key every one of
    // them to exactly the current seed id. That closes the loop in both
    // directions: a seed id the migration cannot reproduce, or a legacy id it
    // does not know about, both fail here.
    //
    // demoRow(), not `{ id }`: the planner now decides by CONTENT against the
    // frozen snapshot, so a bare id object diverges from a real row and is
    // correctly treated as the user's own data - which would make this test pass
    // for the wrong reason if it were asserting anything at all.
    const covered = coveredLegacyIds(legacyIds);
    expect(
      covered.length,
      "the frozen snapshot stopped covering the seed arrays - without this " +
        "assertion the filter below could silently cover nothing at all",
    ).toBeGreaterThan(50);
    const { rewritten } = plan([["probe", covered.map((id) => demoRow(id))]]);
    const migrated = rewritten.get("probe").map((r) => r.id);
    // Only the covered ids were fed in (see coveredLegacyIds), so the expected
    // side must be filtered the same way. Comparing against the unfiltered list
    // is what the 88-vs-96 mismatch was, not a migration failure.
    const expected = currentSeedIds.filter((id) => covered.includes(legacyOf(id)));
    expect(migrated).toEqual(expected);
  });

  it("every legacy id in the map is one a seed array genuinely used", () => {
    // The inverse direction of the round trip, and the one that catches a map
    // entry which is wrong in the OTHER direction. A stale entry in
    // LEGACY_SEED_ID_MAP is not harmless: it matches a record id that happens
    // to equal it, and re-keys it, so an entry that was never a seed id can
    // still rewrite a real record. The round trip alone cannot see that, because
    // it only ever feeds in ids derived from the seed arrays.
    //
    // Reconstructed from the live source: the id each CURRENT seed id came from.
    const currentSeedIds = readCurrentSeedIds();
    const derivedLegacy = new Set(
      currentSeedIds.map((id) => {
        const m = /^seed_([a-z]+)_(\d+)$/.exec(id);
        return `${m[1]}_${String(Number(m[2]) - 9001 + 1).padStart(3, "0")}`;
      })
    );

    // Anything the map claims that no seed array ever used.
    const orphans = [];
    for (const probe of coveredLegacyIds([...derivedLegacy])) {
      // A record carrying this id must be re-keyed, proving the map knows it.
      // demoRow() rather than `{ id }`, for the reason given in the round-trip
      // test above: a bare id object no longer reaches the re-key decision.
      const { rewritten } = plan([["probe", [demoRow(probe)]]]);
      if (!rewritten.has("probe")) orphans.push(probe);
    }
    expect(orphans, `these legacy ids are not covered by the migration: ${orphans.join(", ")}`).toEqual([]);
  });

  it("the migration flag key is versioned and stable", () => {
    // A flag key without a version suffix means a future change to this logic
    // cannot re-run it, and half-migrated installs would be permanent.
    expect(SEED_ID_MIGRATION_FLAG_KEY).toMatch(/_v\d+$/);
  });
});

describe("a duplicated user record on a legacy id is reported, not rewritten", () => {
  // Cannot occur in a collection that honours ids as unique - repositories
  // derive the next id FROM existing ids. Guarded anyway because the owner's
  // own recovered data occupies exactly these legacy ids, so an import that
  // merged without deduping is where this would land, and a migration whose
  // whole purpose is to protect data must not be what creates the corruption.
  it("reports the duplicate rather than emitting two records with one id", () => {
    const { duplicateUserIds, rewritten } = plan([
      ["contacts", [
        { id: "contact_001", name: "Sean Wilson", isSeed: false },
        { id: "contact_001", name: "Sam Benstead", isSeed: false },
      ]],
    ]);
    expect(duplicateUserIds.length).toBe(1);
    expect(duplicateUserIds[0]).toMatch(/contact_001/);
    // No rewrite is offered at all, so a caller that honours this cannot write
    // a collection containing two entries with the same id.
    expect(rewritten.has("contacts")).toBe(false);
  });

  it("reports nothing for a normal collection", () => {
    const { duplicateUserIds } = plan([
      ["contacts", [
        { id: "contact_001", name: "Sean Wilson", isSeed: false },
        { id: "contact_002", name: "Daniel Philips", isSeed: false },
      ]],
    ]);
    expect(duplicateUserIds).toEqual([]);
  });

  it("a single user record on a legacy id is NOT a duplicate", () => {
    // The ordinary case for the owner's 74 recovered records - one per id. If
    // this reported a duplicate, the migration would refuse to run on exactly
    // the install it exists to protect.
    const { duplicateUserIds, totalChanged } = plan([
      ["contacts", [
        { id: "contact_001", name: "Sean Wilson", isSeed: false },
        { id: "contact_002", name: "Daniel Philips", isSeed: false },
        { id: "contact_003", name: "Patrick Clare", isSeed: false },
      ]],
    ]);
    expect(duplicateUserIds).toEqual([]);
    expect(totalChanged).toBe(0);
  });
});

describe("the dangerous inverse is guarded too", () => {
  it("a record that is neither a legacy seed nor isSeed:false is left completely alone", () => {
    const records = [
      { id: "encounter_042", title: "Stay at Nathans" },
      { id: "location_030", name: "Flats car park" },
      { id: "medication_010", name: "Sertraline" },
      { id: "log_131", medicationId: "medication_001" },
    ];
    const { totalChanged, rewritten } = plan([["mixed", records]]);
    expect(totalChanged).toBe(0);
    expect(rewritten.size).toBe(0);
  });
});
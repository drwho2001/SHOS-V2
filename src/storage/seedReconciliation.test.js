// seedReconciliation.test.js
//
// WHY THIS FILE EXISTS
// --------------------
// Demo data is frozen at whatever version a user happened to install, because
// repositories only read the seed array when the storage key is ABSENT. So a
// typo fixed in a seed record, or a demo record added to showcase a new feature,
// only ever reaches brand-new users. seedReconciliation.js closes that gap.
//
// It works by ADDING missing demo records and REFRESHING stored ones that have
// drifted from the current definition - which is only safe because of one rule,
// and this file exists mostly to protect that rule:
//
//   A record carrying `isSeed === false` is the USER'S OWN DATA. It is never
//   updated, never overwritten, never removed.
//
// The dangerous version of this logic is invisible until it has run against real
// data, and "real data" here means the owner's 74 recovered records - real
// people sitting at ids that are ALSO in the seed id sets. An overwrite pass
// that trusted the id would discard their data on the very next app version.

import { describe, it, expect } from "vitest";
import {
  planSeedReconciliation,
  SEED_DATA_VERSION,
  SEED_RECONCILIATION_FLAG_KEY,
} from "./seedReconciliation";

// Pure-function testing against the planner, which is where every decision is
// made. runSeedReconciliation() is a thin persistence wrapper around it.
function plan(collections, definitionsByName) {
  const colls = collections.map(([name, records]) => ({ name, records, seedIds: new Set() }));
  return planSeedReconciliation(colls, definitionsByName);
}

describe("a new demo record is added on a version bump", () => {
  it("inserts a seed id that is not stored", () => {
    const { added, rewritten } = plan(
      [["contacts", [{ id: "seed_contact_9001", name: "Alex" }]]],
      { contacts: [{ id: "seed_contact_9001", name: "Alex" }, { id: "seed_contact_9017", name: "New face" }] }
    );
    expect(added).toEqual([{ collection: "contacts", id: "seed_contact_9017" }]);
    expect(rewritten["contacts"]).toHaveLength(2);
    expect(rewritten["contacts"][1].name).toBe("New face");
  });

  it("leaves the existing records untouched when only adding", () => {
    const stored = [{ id: "seed_contact_9001", name: "Alex" }];
    const { rewritten } = plan(
      [["contacts", stored]],
      { contacts: [{ id: "seed_contact_9001", name: "Alex" }, { id: "seed_contact_9017", name: "New" }] }
    );
    expect(rewritten["contacts"][0]).toEqual(stored[0]);
  });
});

describe("a corrected demo record is refreshed", () => {
  it("updates a drifted seed record's demo fields", () => {
    const { updated, rewritten } = plan(
      [["contacts", [{ id: "seed_contact_9001", name: "Alex", city: "Leeds" }]]],
      { contacts: [{ id: "seed_contact_9001", name: "Alex", city: "York" }] }
    );
    expect(updated).toEqual([{ collection: "contacts", id: "seed_contact_9001" }]);
    expect(rewritten["contacts"][0].city).toBe("York");
    expect(rewritten["contacts"][0].name).toBe("Alex");
  });

  it("does NOT churn an unchanged seed record", () => {
    // Reconciliation must be a genuine no-op in the normal case. If it rewrote
    // every stored demo record on every version bump, `updatedAt` would churn
    // too and the user's "unbacked-up changes" warning would fire constantly.
    const { updated, rewritten } = plan(
      [["contacts", [{ id: "seed_contact_9001", name: "Alex", city: "Leeds" }]]],
      { contacts: [{ id: "seed_contact_9001", name: "Alex", city: "Leeds" }] }
    );
    expect(updated).toEqual([]);
    // No collection key means replaceAll() is never called for it, so an
    // unchanged install performs zero writes.
    expect(Object.keys(rewritten)).toEqual([]);
  });

  it("ignores createdAt/updatedAt differences, which are not demo content", () => {
    const { updated } = plan(
      [["contacts", [{ id: "seed_contact_9001", name: "Alex", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" }]]],
      { contacts: [{ id: "seed_contact_9001", name: "Alex", createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z" }] }
    );
    expect(updated).toEqual([]);
  });

  it("ignores cross-reference arrays, which seedIdMigration owns", () => {
    // A user who removed a demo encounter's attendee should not have it put
    // back by a version bump. Reference rewriting is seedIdMigration.js's job,
    // and it deliberately skips records the user edited.
    const { updated } = plan(
      [["encounters", [{ id: "seed_encounter_9001", title: "Sauna", attendeeIds: [] }]]],
      { encounters: [{ id: "seed_encounter_9001", title: "Sauna", attendeeIds: ["seed_contact_9001"] }] }
    );
    expect(updated).toEqual([]);
  });
});

describe("THE RULE THAT MATTERS MOST: a user record is never touched", () => {
  it("does not refresh a record carrying isSeed: false, even on a seed id", () => {
    // The owner's 74 recovered records are real people and real records sitting
    // at ids that are ALSO in the seed id sets.
    const { updated, skippedUserRecords } = plan(
      [["contacts", [{ id: "seed_contact_9001", name: "Sean Wilson", city: "Leeds", isSeed: false }]]],
      { contacts: [{ id: "seed_contact_9001", name: "Alex", city: "York" }] }
    );
    expect(updated).toEqual([]);
    expect(skippedUserRecords).toEqual([{ collection: "contacts", id: "seed_contact_9001" }]);
  });

  it("does not DELETE a user record whose seed id is no longer in the arrays", () => {
    // The removal half is the one that would actually destroy data. Nothing is
    // ever removed - a seed id disappearing from the array must not take a
    // user's record with it.
    const { added, updated, skippedUserRecords } = plan(
      [["contacts", [{ id: "seed_contact_9001", name: "Sean Wilson", isSeed: false }]]],
      { contacts: [] }
    );
    expect(added).toEqual([]);
    expect(updated).toEqual([]);
    expect(skippedUserRecords).toEqual([]);
  });

  it("does not overwrite a user record's edited field", () => {
    const { rewritten, skippedUserRecords } = plan(
      [["medications", [{ id: "seed_med_9001", name: "PrEP", dosesPerDay: 1, isSeed: false }]]],
      { medications: [{ id: "seed_med_9001", name: "PrEP (Descovy)", dosesPerDay: 2 }] }
    );
    // Nothing is written for that collection at all, so there is no path by which
    // the user's edit could be overwritten.
    expect(Object.keys(rewritten)).toEqual([]);
    expect(skippedUserRecords).toEqual([{ collection: "medications", id: "seed_med_9001" }]);
  });

  it("treats a MISSING isSeed flag as editable demo data", () => {
    // Every record the user has never edited has no flag at all. Defaulting to
    // "user" would make the whole feature inert; defaulting to "demo" matches
    // clearSampleData.js's own isSampleRecord().
    const { updated } = plan(
      [["contacts", [{ id: "seed_contact_9001", name: "Alex", city: "Leeds" }]]],
      { contacts: [{ id: "seed_contact_9001", name: "Alex", city: "York" }] }
    );
    expect(updated).toHaveLength(1);
  });

  it("treats an explicit isSeed: true as demo data", () => {
    const { updated } = plan(
      [["contacts", [{ id: "seed_contact_9001", name: "Alex", city: "Leeds", isSeed: true }]]],
      { contacts: [{ id: "seed_contact_9001", name: "Alex", city: "York" }] }
    );
    expect(updated).toHaveLength(1);
  });

  it("preserves the stored isSeed value when it does refresh a demo record", () => {
    // Copying the definition's (absent) isSeed in would strip a flag.
    const { rewritten } = plan(
      [["contacts", [{ id: "seed_contact_9001", name: "Alex", city: "Leeds", isSeed: true }]]],
      { contacts: [{ id: "seed_contact_9001", name: "Alex", city: "York" }] }
    );
    expect(rewritten["contacts"][0].isSeed).toBe(true);
  });
});

describe("reconciliation never removes a record", () => {
  it("leaves a stored record that is not in the definitions at all", () => {
    // Either the user's own data above the seed range, or a seed record from a
    // future version installed over an older build. Both must survive.
    const { added, updated } = plan(
      [["contacts", [
        { id: "seed_contact_9001", name: "Alex" },
        { id: "contact_035", name: "Alastair wither" },
        { id: "seed_contact_9999", name: "From a newer build" },
      ]]],
      { contacts: [{ id: "seed_contact_9001", name: "Alex" }] }
    );
    expect(added).toEqual([]);
    expect(updated).toEqual([]);
  });

  it("an empty install gains the whole seed set", () => {
    const defs = [{ id: "seed_contact_9001", name: "Alex" }, { id: "seed_contact_9002", name: "Jordan" }];
    const { added, rewritten } = plan([["contacts", []]], { contacts: defs });
    expect(added).toHaveLength(2);
    expect(rewritten["contacts"]).toHaveLength(2);
  });

  it("an install where the user cleared all demo data gains nothing back", () => {
    // "Clear sample data" is a deliberate act. This asserts the property that
    // makes re-adding it impossible in the common case: reconciliation only
    // ever runs when the stored version marker is BEHIND the code's, and the
    // clear leaves the marker alone, so a user who cleared and never updates the
    // app is unaffected. A user who DOES update the app does get the demo data
    // back - which is a genuine product question, stated here rather than
    // decided silently. What is asserted is that nothing here removes a record:
    // an install with no stored seeds and no marker change is not touched.
    const { added, updated } = plan([["contacts", [{ id: "contact_035", name: "Alastair" }]]], { contacts: [] });
    expect(added).toEqual([]);
    expect(updated).toEqual([]);
    expect(SEED_DATA_VERSION).toBe(1);
  });
});

describe("the version marker", () => {
  it("is a positive integer, so a later bump is unambiguous", () => {
    expect(Number.isInteger(SEED_DATA_VERSION)).toBe(true);
    expect(SEED_DATA_VERSION).toBeGreaterThan(0);
  });

  it("is a distinct flag key from the id migration's", () => {
    // Two migrations that shared a flag key would one suppress the other, and
    // neither would report it.
    expect(SEED_RECONCILIATION_FLAG_KEY).not.toBe("shos_seed_id_migrated_v1");
  });
});

describe("degenerate inputs do not throw from a data path", () => {
  it("survives a non-record element", () => {
    const { rewritten, added, updated } = plan(
      [["contacts", [null, "junk", { id: "seed_contact_9001", name: "Alex" }]]],
      { contacts: [{ id: "seed_contact_9001", name: "Alex" }] }
    );
    expect(added).toEqual([]);
    expect(updated).toEqual([]);
    expect(Object.keys(rewritten)).toEqual([]);
  });

  it("survives a collection with no definitions", () => {
    const { added, updated } = plan([["contacts", [{ id: "x" }]]], {});
    expect(added).toEqual([]);
    expect(updated).toEqual([]);
  });
});
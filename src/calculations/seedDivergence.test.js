// The shared demo/user rule (`src/calculations/seedDivergence.js`).
//
// This file exists because the rule was built, verified by simulation, and then
// committed WITHOUT a test file - C reported it as covered and no test file was
// on disk. That is the exact failure this whole incident is about, so it is
// worth naming rather than quietly closing: a module that decides whether a
// record is the user's own data or removable demo data, and nothing asserting
// the dangerous direction.
//
// WHY THE FLAG-FIRST ORDER IS THE WHOLE ARGUMENT:
//
//   A record restored from a backup, or edited on an older build, carries NO
//   `isSeed` flag. Those are exactly the records this rule exists to protect,
//   and the 5 Oct incident deleted 74 of them. There is one signal that can
//   never be an inference - the user's own edit, stamped `isSeed: false` - so it
//   has to be read before anything that could guess. A heuristic that can
//   override it is a heuristic that can destroy data the user told us they own.
//
// THE CLASS OF TEST THAT WAS MISSING, and why it matters more than these:
//
//   82 mutations across the two seed suites were green while the rule was wrong
//   in its default branch. Every one of them mutated the FLAGGED case. Not one
//   touched a flagless record - the actual incident. So below, the load-bearing
//   assertions are the FLAGLESS ones, and there is a mutation-shaped check for
//   each. A data-loss guard has to assert that the ambiguous case is PRESERVED;
//   asserting only that the flagged case is safe tests something already known.

import { describe, it, expect } from "vitest";
import {
  isDemoData,
  legacyDefinitionFor,
  stampDivergedRecords,
  normaliseLegacyId,
  LEGACY_SEED_SNAPSHOT_SIZE,
  RAW_LEGACY_SEED_ARRAYS,
} from "./seedDivergence.js";

/** A pristine copy of a real snapshot row, with the non-record `collection` tag
 *  stripped so it can stand in for a stored record. */
function untouchedSeed(legacyId) {
  const def = legacyDefinitionFor({ id: legacyId });
  if (!def) throw new Error(`no snapshot row for ${legacyId}`);
  const { collection, ...record } = def;
  return { ...record };
}

describe("the flag is authoritative, and is read first", () => {
  it("keeps a record the user explicitly claimed, even when it matches the demo data exactly", () => {
    // A perfect match is normally the strongest possible "this is demo data"
    // signal. The flag outranks it, because the flag is a statement by the user
    // and the match is an inference about the user.
    const record = { ...untouchedSeed("contact_001"), isSeed: false };
    expect(isDemoData(record)).toBe(false);
  });

  it("reads the flag before the snapshot, rather than consulting the snapshot first", () => {
    // Behavioural proof of ordering, not just of the outcome: a record whose id
    // is not a seed id at all AND which is flagged is protected either way, so
    // only a direct check distinguishes "flag first" from "flag somewhere".
    // The guard test file asserts the source ordering separately; this asserts
    // the rule cannot be reordered without one of the two cases above breaking.
    const flaggedNonSeed = { id: "contact_9999", name: "Anything", isSeed: false };
    const unflaggedNonSeed = { id: "contact_9999", name: "Anything" };
    expect(isDemoData(flaggedNonSeed)).toBe(false);
    // A record that was never a seed id and carries no flag is NOT demo data.
    // Defaulting it to "demo" would delete anything a hand-edited backup or a
    // future install brought in.
    expect(isDemoData(unflaggedNonSeed)).toBe(false);
  });
});

describe("a flagless record is decided by CONTENT, which is the case the incident lived in", () => {
  it("treats a flagless record that still matches the snapshot as demo data", () => {
    const record = untouchedSeed("contact_001");
    expect(record.isSeed, "fixture must be flagless or this tests nothing").toBeUndefined();
    expect(isDemoData(record)).toBe(true);
  });

  it("treats a flagless record that DIVERGES from the snapshot as the user's own data", () => {
    // THE assertion that was missing from both suites. Same id as a demo record,
    // no flag to save it, different content - which is precisely what a
    // restored backup and a pre-3c edit both look like. Before divergence
    // detection this returned true, and "true" here means "safe to delete".
    const record = { ...untouchedSeed("contact_001"), name: "Sean Wilson" };
    expect(isDemoData(record)).toBe(false);
  });

  it("treats a divergence in ANY single field as divergence", () => {
    // Not just the identifying field. A user who typed into notes, or changed a
    // dose, has made the record theirs, and the rule must not decide that a
    // particular field is more important than another.
    const notes = { ...untouchedSeed("contact_001"), notes: "met at the sauna" };
    expect(isDemoData(notes)).toBe(false);
  });

  it("still recognises a match after 3a's re-key, in the NEW id space", () => {
    // 3d migrates stored demo records to `seed_contact_9001`. If the snapshot
    // only matched the legacy form, every already-migrated demo record would
    // read as diverged - which would make demo data permanently undeletable
    // AND, worse, mask real divergence by making the test always pass.
    const legacy = untouchedSeed("contact_001");
    const rekeyed = { ...legacy, id: "seed_contact_9001" };
    expect(isDemoData(legacy)).toBe(true);
    expect(isDemoData(rekeyed)).toBe(true);
  });

  it("does not call a re-keyed reference array a divergence", () => {
    // The bug the simulation harness caught: matching references BY NAME
    // (`*Id`/`*Ids`) missed `kinksInvolved`, `protectionUsed`, `myPosition`,
    // `whereICame`, `whereHeCame`, `chemsAlcoholUsed`, `symptomsNoted`, so every
    // multi-attendee seed encounter read as diverged. If this regresses,
    // demo encounters silently become undeletable.
    const encounter = untouchedSeed("encounter_001");
    const attendeeIds = encounter.attendeeIds || [];
    if (!attendeeIds.length) throw new Error("fixture has no attendees");
    const rekeyedAttendees = {
      ...encounter,
      attendeeIds: attendeeIds.map(normaliseLegacyId),
    };
    expect(isDemoData(rekeyedAttendees)).toBe(true);
  });

  it("does call a removed reference a divergence", () => {
    // The deliberate reversal of 3e's `demoContent()`: 3e excluded `*Ids` arrays
    // so a version bump could restore one a user removed. For REFRESHING that
    // is right; for DELETING it is inverted - a field the user touched is
    // evidence the record is theirs. This pins which side of that reversal we
    // are on, because it is the difference between "undeletable" and "deleted".
    //
    // Dropped rather than reordered on purpose: `[a]` reversed is still `[a]`,
    // so a reorder silently tested nothing when an encounter has one attendee.
    const encounter = untouchedSeed("encounter_001");
    const attendeeIds = encounter.attendeeIds || [];
    if (!attendeeIds.length) throw new Error("fixture has no attendees");
    const removed = { ...encounter, attendeeIds: attendeeIds.slice(1) };
    expect(isDemoData(removed)).toBe(false);
  });

  it("ignores isSeed, createdAt and updatedAt when comparing", () => {
    // Bookkeeping, not content. A `true` here would be a bug, and `undefined` is
    // the safe answer, but the assertion that matters is that none of the three
    // can make a matching record look diverged.
    const base = untouchedSeed("contact_001");
    expect(isDemoData({ ...base, isSeed: true })).toBe(true);
    expect(isDemoData({ ...base, createdAt: "2026-01-01T00:00:00.000Z" })).toBe(true);
    expect(isDemoData({ ...base, updatedAt: "2026-01-01T00:00:00.000Z" })).toBe(true);
  });

  it("never treats a non-record as demo data", () => {
    expect(isDemoData(null)).toBe(false);
    expect(isDemoData(undefined)).toBe(false);
    expect(isDemoData("contact_001")).toBe(false);
  });
});

describe("stamping makes the verdict a fact instead of a repeated guess", () => {
  it("stamps diverged records and leaves matching ones untouched", () => {
    const matching = untouchedSeed("contact_001");
    const diverged = { ...untouchedSeed("contact_002"), name: "Daniel Philips" };
    const { records, stamped } = stampDivergedRecords([matching, diverged]);

    expect(stamped).toEqual([diverged.id]);
    expect(records[0], "a matching demo record must NOT be stamped as the user's").toEqual(matching);
    expect(records[0].isSeed, "stamping every record would make demo data undeletable").toBeUndefined();
    expect(records[1].isSeed).toBe(false);
    // And the stamp must actually change the verdict, which is the whole point.
    expect(isDemoData(records[1])).toBe(false);
  });

  it("does not mutate its input", () => {
    // A caller that fails to persist afterwards must not leave the repository's
    // in-memory array half-converted.
    const diverged = { ...untouchedSeed("contact_003"), name: "Patrick Clare" };
    const input = [diverged];
    stampDivergedRecords(input);
    expect(input[0].isSeed).toBeUndefined();
  });

  it("is idempotent - stamping twice changes nothing the second time", () => {
    const diverged = { ...untouchedSeed("contact_004"), name: "Sam Benstead" };
    const once = stampDivergedRecords([diverged]);
    const twice = stampDivergedRecords(once.records);
    expect(twice.stamped).toEqual([]);
    expect(twice.records).toEqual(once.records);
  });

  it("passes through non-records and already-flagged records untouched", () => {
    const flagged = { ...untouchedSeed("contact_005"), isSeed: false };
    const { records, stamped } = stampDivergedRecords([null, flagged]);
    expect(records[0]).toBeNull();
    expect(records[1]).toBe(flagged);
    expect(stamped).toEqual([]);
  });
});

describe("the snapshot itself is not allowed to drift", () => {
  it("still holds every legacy demo record, at the documented size", () => {
    // The snapshot is FROZEN data, and this is the only assertion standing
    // between a stale snapshot and real damage.
    //
    // The failure mode is invisible from the other direction: a seed added or
    // removed without regenerating the snapshot does NOT make any divergence test
    // above fail - a missing row reads as "user's data", which is the safe
    // answer. So every behavioural test here stays green while the rule quietly
    // stops recognising genuine demo data as demo, and demo data accumulates
    // forever. It is also a deletion bug in the other direction the moment the
    // arrays are edited: a row the snapshot still holds can no longer match.
    //
    // Derived from RAW_LEGACY_SEED_ARRAYS rather than by guessing id formats.
    // An earlier version of this test enumerated `${id}_00${n}` by hand, missed
    // 33 rows, and reported a 63-vs-96 mismatch that said nothing about the
    // module - the same "assert a number I made up" trap.
    let fromArrays = 0;
    for (const records of Object.values(RAW_LEGACY_SEED_ARRAYS)) {
      for (const record of records) {
        expect(
          legacyDefinitionFor({ id: record.id }),
          `snapshot is missing a row for ${record.id}`,
        ).toBeTruthy();
        fromArrays++;
      }
    }
    expect(fromArrays, "the arrays themselves changed - regenerate the snapshot").toBe(
      LEGACY_SEED_SNAPSHOT_SIZE,
    );
  });

  it("resolves a legacy id and its re-keyed form to the same row", () => {
    expect(normaliseLegacyId("contact_001")).toBe(normaliseLegacyId("seed_contact_9001"));
    expect(legacyDefinitionFor({ id: "contact_001" }))
      .toBe(legacyDefinitionFor({ id: "seed_contact_9001" }));
  });
});
// Coverage for clearSampleData.js and the SEED_*_IDS exports it depends on.
//
// The bug this guards against is not hypothetical and not subtle: a brand-new
// install loads ~93 fabricated records including a POSITIVE gonorrhoea result,
// with nothing in the UI disclosing it. And the naive fix - reusing
// "Reset all app data" - is actively wrong, because the moment a user creates
// their first record the sample data is persisted into the same array and
// "delete everything" would take their data with it.
//
// So the two things worth proving are:
//   1. it removes sample records and KEEPS real ones, mixed in the same array
//   2. the id sets cannot silently drift from the seed arrays they derive from
//
// (2) is the one a future edit to the sample data would break, and it would
// break it SILENTLY - a stale id set just means some sample records stop being
// removable, with no error anywhere. Hence the explicit assertion that the set
// size equals the array length.
//
// WHY EVERY TEST GETS FRESH MODULES: every repository holds its record list in
// a MODULE-LEVEL variable as well as in storage, and that cache survives both
// `mockStore.clear()` and any per-test setup. A first draft of this file ran
// `create()` expecting 16 sample contacts + 1 real one, got 1, and failed - not
// because the code was wrong but because an earlier test in the same file had
// already cleared the cache. So each test re-imports the repositories into a
// fresh module registry via vi.resetModules(). Without that, these tests would
// be order-dependent and would quietly stop testing anything after a reorder.
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the storage adapter so the real repositories can load without an
// unlocked encryption vault. Same pattern as contactRepository.test.js: the
// real adapter logs "Vault is not unlocked" on every save and the assertions
// would then pass against module memory while verifying almost nothing.
const mockStore = new Map();
vi.mock("../storage/storageAdapter.js", () => ({
  localStorageAdapter: {
    load: vi.fn((key, fallback) => (mockStore.has(key) ? mockStore.get(key) : fallback)),
    save: vi.fn((key, value) => {
      mockStore.set(key, JSON.parse(JSON.stringify(value)));
      return true;
    }),
  },
}));

/** Fresh repositories + a fresh cache, with the sample data present. */
async function freshApp() {
  vi.resetModules();
  const [contacts, encounters, testing, meds, logs, clear] = await Promise.all([
    import("./contactRepository"),
    import("./encounterRepository"),
    import("./testingRepository"),
    import("./medicationRepository"),
    import("./logRepository"),
    import("./clearSampleData"),
  ]);
  return { contacts, encounters, testing, meds, logs, clear };
}

beforeEach(() => {
  mockStore.clear();
  vi.clearAllMocks();
});

describe("the exported seed id sets cannot drift from their seed arrays", () => {
  it("every set has exactly one id per seed record", async () => {
    const { contacts, encounters, testing, meds, logs } = await freshApp();
    const checks = [
      ["contacts", contacts.ContactRepository, contacts.SEED_CONTACT_IDS],
      ["encounters", encounters.EncounterRepository, encounters.SEED_ENCOUNTER_IDS],
      ["tests", testing.TestingRepository, testing.SEED_TEST_IDS],
      ["medications", meds.MedicationRepository, meds.SEED_MEDICATION_IDS],
      ["medication logs", logs.LogRepository, logs.SEED_MEDICATION_LOG_IDS],
    ];
    for (const [name, repo, ids] of checks) {
      const seeded = await repo.getAll();
      expect(ids.size, `${name}: id set size should match the seed count`).toBe(seeded.length);
      for (const r of seeded) {
        expect(ids.has(r.id), `${name}: ${r.id} missing from the id set`).toBe(true);
      }
    }
  });

  it("the set size equals the array length, so a count cannot be inflated", async () => {
    const { contacts } = await freshApp();
    const seeded = await contacts.ContactRepository.getAll();
    const uniqueIds = new Set(seeded.map((c) => c.id));
    expect(uniqueIds.size).toBe(seeded.length);
    expect(contacts.SEED_CONTACT_IDS.size).toBe(seeded.length);
  });
});

describe("countSampleData reports what a new user would be looking at", () => {
  it("counts the sample records on a fresh install", async () => {
    const { testing, clear } = await freshApp();
    const { total, byCollection } = await clear.countSampleData();
    expect(total).toBeGreaterThan(0);
    // A fresh install really does carry a positive STI result - the specific
    // reason this whole path exists.
    const tests = await testing.TestingRepository.getAll();
    const positive = tests.filter((t) => /positive/i.test(t.title || ""));
    expect(positive.length, "the sample data should include a positive result").toBeGreaterThan(0);
    expect(byCollection.some((c) => c.name === "Contacts")).toBe(true);
  });

  it("returns 0 once the sample data has been cleared", async () => {
    const { clear } = await freshApp();
    await clear.clearSampleData();
    const { total } = await clear.countSampleData();
    expect(total).toBe(0);
  });

  it("counts ONLY sample records once the user has added real ones", async () => {
    // Added after mutation testing found the count was untested. Replacing the
    // seed-id filter in countSampleData with a plain `all.length` failed ZERO
    // tests, because on a fresh install every record IS sample data - the two
    // are identical, so the test proved nothing. The only way to tell the count
    // apart is to have real records mixed in, which is exactly the state a
    // user is in once they have entered anything.
    //
    // This is the same trap as the calendar tests that could not fail: a test
    // that cannot fail when the bug is reintroduced reads as coverage.
    const { contacts, clear } = await freshApp();
    const sampleCount = contacts.SEED_CONTACT_IDS.size;
    const { total: before } = await clear.countSampleData();

    await contacts.ContactRepository.create({ name: "My Real Contact" });

    const { total: after, byCollection } = await clear.countSampleData();
    // The real contact must NOT be counted as sample data.
    expect(after).toBe(before);
    expect(after).toBeGreaterThan(0);
    const contactsRow = byCollection.find((c) => c.name === "Contacts");
    expect(contactsRow.count).toBe(sampleCount);
  });
});

describe("a seed record the user has real history against is NOT sample data", () => {
  // THE regression test for the 1 Oct 2026 incident. The owner renamed the
  // seeded PrEP / DoxyPEP / Vitamin D records and logged 66 of their own doses
  // against them; "clear sample data" deleted all three anyway because it
  // filtered on id alone, leaving 69 orphaned dose logs and a user who believed
  // six weeks of history had been destroyed.
  //
  // Every test below fails on the old implementation. The first is the headline;
  // the rest exist so the fix cannot rot into a no-op, and so the direction of
  // each guarantee is pinned rather than assumed.
  it("keeps a SEED medication that the user has logged their own doses against", async () => {
    const { meds, logs, clear } = await freshApp();
    const [prEp] = meds.SEED_MEDICATION_IDS;
    expect(prEp, "the fixture needs a seeded medication to work with").toBeTruthy();

    // A dose log with a NON-seed id, pointing at the seeded medication. This
    // single fact is what makes the medication real.
    await logs.LogRepository.create({
      medicationId: prEp,
      type: "dose",
      delta: -1,
      date: "2026-09-01T08:00:00.000Z",
    });

    await clear.clearSampleData();

    const surviving = await meds.MedicationRepository.getAll();
    expect(
      surviving.some((m) => m.id === prEp),
      "a seeded medication with real dose history must survive 'clear sample data'",
    ).toBe(true);
  });

  it("keeps that medication's own dose logs with it, so nothing is orphaned", async () => {
    const { meds, logs, clear } = await freshApp();
    const [prEp] = meds.SEED_MEDICATION_IDS;
    const mine = await logs.LogRepository.create({
      medicationId: prEp,
      type: "dose",
      delta: -1,
      date: "2026-09-01T08:00:00.000Z",
    });

    await clear.clearSampleData();

    const medsLeft = await meds.MedicationRepository.getAll();
    const medIds = new Set(medsLeft.map((m) => m.id));
    const logsLeft = await logs.LogRepository.getAll();
    // The precise failure that happened: the user's own log survived while its
    // medication did not. Assert the pairing, not just that both exist.
    expect(medIds.has(prEp), "the medication must survive for its own log to resolve").toBe(true);
    const orphan = logsLeft.filter((l) => !medIds.has(l.medicationId) && !logs.SEED_MEDICATION_LOG_IDS.has(l.id));
    expect(orphan, "a clear must never leave a real log pointing at a deleted record").toEqual([]);
    expect(logsLeft.some((l) => l.id === mine.id), "the user's own dose entry must survive").toBe(true);
  });

  it("still removes a seeded medication nobody has ever touched", async () => {
    // The converse, and the reason this is not simply "never remove seed meds".
    // Without this the fix would be a no-op that preserves all demo data.
    const { meds, clear } = await freshApp();
    await clear.clearSampleData();
    const surviving = await meds.MedicationRepository.getAll();
    expect(surviving.length, "untouched sample medications must still be removed").toBe(0);
  });

  it("still removes a seeded medication that only SAMPLE logs point at", async () => {
    // Sample data cannot vouch for itself. The seeded dose logs reference the
    // seeded medications, so if they counted as "real usage" nothing would ever
    // be cleared and the count could never reach zero.
    const { meds, clear } = await freshApp();
    const before = await meds.MedicationRepository.getAll();
    const seedLogs = await (await import("./logRepository")).LogRepository.getAll();
    expect(seedLogs.length, "the fixture needs seeded logs to be meaningful").toBeGreaterThan(0);

    await clear.clearSampleData();
    const surviving = await meds.MedicationRepository.getAll();
    expect(surviving.length).toBe(0);
    expect(before.length).toBeGreaterThan(0);
  });

  it("stops counting a promoted medication as sample data, so the banner clears", async () => {
    const { meds, logs, clear } = await freshApp();
    const [prEp] = meds.SEED_MEDICATION_IDS;
    await logs.LogRepository.create({
      medicationId: prEp,
      type: "dose",
      delta: -1,
      date: "2026-09-01T08:00:00.000Z",
    });

    const { total, byCollection } = await clear.countSampleData();
    const medsRow = byCollection.find((c) => c.name === "Medications");
    // One fewer than the seed count: the one with real history behind it.
    expect(medsRow?.count ?? 0).toBe(meds.SEED_MEDICATION_IDS.size - 1);
    expect(total).toBeGreaterThan(0);
  });

  it("keeps a SEED contact that a real encounter lists as an attendee", async () => {
    // The plural-field case, and it is a different code path: the reference here
    // lives in `attendeeIds`, not a singular `...Id`. A test suite that only ever
    // exercises a singular field would pass while the plural half of the check
    // was quietly broken - which is exactly what mutation M4 demonstrated
    // (deleting the `*Ids` branch turned the suite green).
    const { contacts, encounters, clear } = await freshApp();
    const [seedContact] = contacts.SEED_CONTACT_IDS;
    expect(seedContact, "the fixture needs a seeded contact").toBeTruthy();

    await encounters.EncounterRepository.create({
      title: "A real encounter with someone I know",
      attendeeIds: [seedContact],
    });

    await clear.clearSampleData();

    const surviving = await contacts.ContactRepository.getAll();
    expect(
      surviving.some((c) => c.id === seedContact),
      "a seeded contact a real encounter points at must survive",
    ).toBe(true);
  });

  it("is repeatable: a second clear does not remove the promoted medication", async () => {
    // Without this, the first clear would look fine and the second would take
    // the user's medication with it - the worst possible shape for a bug in a
    // destructive action.
    const { meds, logs, clear } = await freshApp();
    const [prEp] = meds.SEED_MEDICATION_IDS;
    await logs.LogRepository.create({
      medicationId: prEp,
      type: "dose",
      delta: -1,
      date: "2026-09-01T08:00:00.000Z",
    });

    await clear.clearSampleData();
    await clear.clearSampleData();

    const surviving = await meds.MedicationRepository.getAll();
    expect(surviving.some((m) => m.id === prEp)).toBe(true);
  });
});

describe("clearSampleData removes sample records and keeps real ones", () => {
  it("keeps a contact the user created, mixed in with the sample data", async () => {
    // THE scenario that makes "clear sample data" different from "delete
    // everything". create() pulls the seed into memory and then persists the
    // whole array, so after this call the repository holds all 16 sample
    // contacts AND the user's own - indistinguishable except by id.
    const { contacts, clear } = await freshApp();
    await contacts.ContactRepository.create({ name: "My Real Contact" });
    const mixed = await contacts.ContactRepository.getAll();
    expect(mixed.length, "sample + real should be mixed in one array").toBe(
      contacts.SEED_CONTACT_IDS.size + 1
    );
    expect(mixed.some((c) => c.name === "My Real Contact")).toBe(true);

    const { removed, kept } = await clear.clearSampleData();
    // `removed` is the grand total across every seeded collection (all 14 of
    // them, ~96 records), not contacts alone. A first draft of this assertion
    // compared it to the contact seed count and failed with "expected 96 to be
    // 16" - the wrong claim, not a wrong number. So assert the two things that
    // actually matter separately: the sample contacts specifically are gone,
    // and the real one survived.
    expect(removed).toBeGreaterThanOrEqual(contacts.SEED_CONTACT_IDS.size);
    expect(kept).toBeGreaterThanOrEqual(1);

    const after = await contacts.ContactRepository.getAll();
    expect(after.map((c) => c.name)).toEqual(["My Real Contact"]);
  });

  it("clears every seeded collection, not just contacts", async () => {
    const { clear } = await freshApp();
    const before = await clear.countSampleData();
    expect(before.byCollection.length).toBeGreaterThan(3);
    const { removed } = await clear.clearSampleData();
    expect(removed).toBe(before.total);
  });

  it("writes the cleared state rather than removing the key, so it survives a reload", async () => {
    // This is the failure resetAllData.js was written to fix: removing the
    // storage KEY makes the seed fallback return on the next load. Clearing
    // must WRITE a value, which is what replaceAll() does.
    const { contacts, clear } = await freshApp();
    await contacts.ContactRepository.create({ name: "My Real Contact" });
    await clear.clearSampleData();
    const raw = mockStore.get("shos_contacts");
    expect(Array.isArray(raw), "storage should hold a value, not be absent").toBe(true);
    expect(raw.map((c) => c.name)).toEqual(["My Real Contact"]);

    // And a genuinely fresh module registry - a real reload - still sees the
    // cleared state rather than the seed coming back.
    vi.resetModules();
    const reloaded = await import("./contactRepository");
    const afterReload = await reloaded.ContactRepository.getAll();
    expect(afterReload.map((c) => c.name)).toEqual(["My Real Contact"]);
  });

  it("leaves the sample data alone when there is none to remove", async () => {
    const { clear } = await freshApp();
    await clear.clearSampleData();
    const { removed, failed } = await clear.clearSampleData();
    expect(removed).toBe(0);
    expect(failed).toEqual([]);
  });

  it("never throws when a repository is unreadable, and reports it instead", async () => {
    // An advisory action must never be able to break the app.
    const { contacts, clear } = await freshApp();
    const original = contacts.ContactRepository.getAll;
    contacts.ContactRepository.getAll = vi.fn().mockRejectedValue(new Error("simulated storage failure"));
    try {
      const result = await clear.clearSampleData();
      expect(result.failed.length).toBeGreaterThan(0);
      expect(result.failed[0].error).toContain("simulated storage failure");
      // The other repositories were still processed.
      expect(result.removed).toBeGreaterThan(0);
    } finally {
      contacts.ContactRepository.getAll = original;
    }
  });

  it("countSampleData survives an unreadable repository too", async () => {
    const { contacts, clear } = await freshApp();
    const original = contacts.ContactRepository.getAll;
    contacts.ContactRepository.getAll = vi.fn().mockRejectedValue(new Error("simulated storage failure"));
    try {
      const { total } = await clear.countSampleData();
      // Contacts contributed nothing, but everything else still counted.
      expect(total).toBeGreaterThan(0);
    } finally {
      contacts.ContactRepository.getAll = original;
    }
  });
});

// ---------------------------------------------------------------------------
// The change listener, added after the smoke suite caught a real bug this file
// could never have found: clearing the sample data from the first-run banner on
// Home left the Developer Tools panel still displaying "96 sample records are
// still here", with a live-looking button that would then report there was
// nothing left to remove. Each screen refreshed only its own copy, so the two
// permanently disagreed.
//
// That is a cross-component behaviour, so it needs the smoke flow to catch it
// — but the mechanism underneath is plain logic and belongs here too.
// ---------------------------------------------------------------------------
describe("subscribers are told when the sample data changes", () => {
  it("notifies on a successful clear", async () => {
    const { clear } = await freshApp();
    let calls = 0;
    const off = clear.onSampleDataChanged(() => { calls += 1; });
    await clear.clearSampleData();
    expect(calls).toBe(1);
    off();
  });

  it("stops notifying after unsubscribe", async () => {
    const { clear } = await freshApp();
    let calls = 0;
    const off = clear.onSampleDataChanged(() => { calls += 1; });
    off();
    await clear.clearSampleData();
    // A leaked listener would keep a mounted screen re-counting forever, which
    // is a slow leak rather than an obvious bug - so it is asserted.
    expect(calls).toBe(0);
  });

  it("notifies even when there was nothing to remove", async () => {
    // Deliberate: a screen that skipped a repository still needs to stop
    // claiming there is sample data here. A clear that "did nothing" is not a
    // clear that changed nothing.
    const { clear } = await freshApp();
    await clear.clearSampleData();
    let calls = 0;
    const off = clear.onSampleDataChanged(() => { calls += 1; });
    await clear.clearSampleData();
    expect(calls).toBe(1);
    off();
  });

  it("one broken listener cannot break the clear or the other listeners", async () => {
    const { clear } = await freshApp();
    let good = 0;
    clear.onSampleDataChanged(() => { throw new Error("listener exploded"); });
    const off = clear.onSampleDataChanged(() => { good += 1; });
    const result = await clear.clearSampleData();
    expect(result.removed).toBeGreaterThan(0);
    expect(good).toBe(1);
    off();
  });
});

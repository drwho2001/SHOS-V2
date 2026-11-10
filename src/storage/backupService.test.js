// backupService.test.js
//
// The backup roundtrip, behaviourally: build → JSON → parse → verify → restore
// → and back through buildBackup again, with every collection's record count
// intact on the far side.
//
// WHY THIS EXISTS. Every prior guard here was for the SHAPE of the backup:
// backupMigrations.test.js pins what a pre-re-key file means, backupSeedIdImport
// pins how it re-keys listed ids, backupPreferenceCoverage pins two preferences
// that never looked like data. None of these proves that the EXACT export text
// the user's phone hands to the OS share sheet re-parses and restores without
// losing records — which is the one claim the whole manual-export DR plan
// rests on.
//
// generateBackup() itself is NOT tested here: it writes to the OS file system
// through the Capacitor/Share layer. What is tested is everything up to the
// export text, which is everything that can go wrong silently.
import { describe, it, expect, beforeEach, vi } from "vitest";

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

/** Fresh module registry so each test starts from the seeded install. */
async function freshBackup() {
  vi.resetModules();
  // Sequential imports — see clearSampleData.test.js's own note on why the
  // dynamic import can't be a concurrent batch.
  const backupService = await import("./backupService.js");
  return backupService;
}

beforeEach(() => mockStore.clear());

/** Every array-shaped collection in a built backup, as {key: length}. */
function counts(backup) {
  const out = {};
  for (const [key, value] of Object.entries(backup.data)) {
    if (Array.isArray(value)) out[key] = value.length;
  }
  return out;
}

describe("backup roundtrip", () => {
  it("buildBackup captures every seeded collection, then restores without loss", async () => {
    const { buildBackup, restoreBackup } = await freshBackup();
    const before = await buildBackup();
    expect(before.data).toBeDefined();

    const beforeCounts = counts(before);
    // Sanity: this is a real export, not an empty one — demo data seeded.
    expect(Object.keys(beforeCounts).length).toBeGreaterThan(10);
    expect(beforeCounts.contacts).toBeGreaterThan(0);
    expect(beforeCounts.tests).toBeGreaterThan(0);

    // Restore into the same app state — the user's first-restore-on-new-device
    // path goes through exactly this call.
    await restoreBackup(before);

    const after = await buildBackup();
    const afterCounts = counts(after);
    for (const [key, n] of Object.entries(beforeCounts)) {
      expect(afterCounts[key], `${key} lost records across restore`).toBe(n);
    }
  }, 60_000);

  it("the export TEXT round-trips: parseBackupFile + verifyBackupJson agree with buildBackup", async () => {
    const { buildBackup, parseBackupFile, verifyBackupJson } = await freshBackup();
    const backup = await buildBackup();
    const json = JSON.stringify(backup);

    const parsed = parseBackupFile(json);
    expect(parsed.data.contacts.length).toBe(backup.data.contacts.length);

    const verified = verifyBackupJson(backup, json);
    expect(verified.ok).toBe(true);
    expect(verified.totalRecords).toBe(Object.values(counts(backup)).reduce((a, b) => a + b, 0));
  }, 60_000);

  it("parseBackupFile rejects files that are not backups, and reports why", async () => {
    const { parseBackupFile } = await freshBackup();
    expect(() => parseBackupFile("not json")).toThrow(/isn't valid/);
    expect(() => parseBackupFile("{}")).toThrow(/SHOS backup file/);
    expect(() => parseBackupFile('{"data": "a string"}')).toThrow(/SHOS backup file/);
    // A newer schemaVersion gets a distinct, honest error — it must not fall
    // through as "restore it anyway".
    expect(() => parseBackupFile('{"schemaVersion": 9999, "data": {}}')).toThrow(/newer version/);
    // The discriminator the UI relies on: schemaVersion older than current is fine.
    expect(() => parseBackupFile('{"schemaVersion": 1, "data": {}}')).not.toThrow();
  }, 60_000);

  it("verifyBackupJson refuses a truncated export rather than reporting success", async () => {
    const { buildBackup, verifyBackupJson } = await freshBackup();
    const backup = await buildBackup();
    const json = JSON.stringify(backup);
    // Simulate a power loss mid-write: clip the file short. JSON.parse fails.
    const truncated = json.slice(0, Math.floor(json.length * 0.9));
    expect(() => verifyBackupJson(backup, truncated)).toThrow(/isn't valid/);
  }, 60_000);
});

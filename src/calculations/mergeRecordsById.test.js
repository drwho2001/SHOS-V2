// The import-half duplicate incident: merging a backup must not duplicate
// records that are already there.
//
// This is a real-data bug, not a hypothetical. The owner's own Kink Registry
// held 228 rows for 78 distinct ids (3 copies each) because mergeBackup()'s
// append() concatenated blindly and the same backup had been merged more than
// once. Every picker then showed each option three times. The dangerous
// direction is the mirror image, so it is asserted too: a record that is
// genuinely new must still arrive, or a merge would silently do nothing.
import { describe, it, expect } from "vitest";
import { mergeRecordsById } from "./mergeRecordsById.js";

const existing = [
  { id: "contact_001", name: "Alex (edited since the backup)" },
  { id: "contact_002", name: "Jordan" },
];

describe("mergeRecordsById", () => {
  it("adds only the incoming records whose id is new", () => {
    const incoming = [
      { id: "contact_002", name: "Jordan (older copy)" },
      { id: "contact_003", name: "Sam" },
    ];
    const merged = mergeRecordsById(existing, incoming);

    expect(merged.map((r) => r.id)).toEqual(["contact_001", "contact_002", "contact_003"]);
  });

  it("keeps the local copy when both sides have the same id", () => {
    const merged = mergeRecordsById(existing, [{ id: "contact_001", name: "Alex (older copy)" }]);

    expect(merged).toHaveLength(2);
    expect(merged[0].name).toBe("Alex (edited since the backup)");
  });

  it("does not duplicate when the same file is merged twice - the 228-row bug", () => {
    const registry = [{ id: "kink_001", name: "Bating" }, { id: "kink_002", name: "Blood" }];

    let stored = registry;
    stored = mergeRecordsById(stored, registry);
    stored = mergeRecordsById(stored, registry);

    expect(stored).toHaveLength(2);
    expect(new Set(stored.map((r) => r.id)).size).toBe(2);
  });

  it("still brings in a record the device no longer has", () => {
    const merged = mergeRecordsById([{ id: "e1" }], [{ id: "e1" }, { id: "e2" }, { id: "e3" }]);

    expect(merged.map((r) => r.id)).toEqual(["e1", "e2", "e3"]);
  });

  it("appends records with no id rather than dropping them", () => {
    const merged = mergeRecordsById([{ id: "a" }], [{ name: "no id here" }]);

    expect(merged).toHaveLength(2);
  });

  it("does nothing when the backup only repeats what is already stored", () => {
    expect(mergeRecordsById(existing, existing)).toHaveLength(existing.length);
  });
});

// Owner clarification (18 Nov 2026), recorded in COMPACTION-HANDOFF:
// "no keep newest first i meant on the incomplete - those with mandatory
// details missing should be listed before those missing details which are
// not mandatory."
//
// So: do NOT change the default sort. Only the existing "Incomplete" sort
// chip should prioritise contacts missing MANDATORY fields over contacts
// missing only optional/non-mandatory details. This source guard locks both
// halves — the chip's comparator and the untouched default.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const src = readFileSync(
  path.join(process.cwd(), "src", "modules", "SHOS_Contacts_Prototype.jsx"),
  "utf8"
);

describe("contacts 'Incomplete' sort", () => {
  it("is reading the real Contacts module", () => {
    expect(src.length).toBeGreaterThan(100_000);
    expect(src).toContain('function ContactsList(');
  });

  it("leaves the default sort untouched (owner: keep newest-first, no global sort change)", () => {
    expect(src).toMatch(/const \[sortBy, setSortBy\] = useState\("lastEncounter"\)/);
    // The old default must not have been swapped to "incomplete".
    expect(src).not.toMatch(/useState\("incomplete"\)/);
  });

  it("orders mandatory-missing contacts before optional-only ones", () => {
    // The required-field count is compared BEFORE the completeness score.
    const block = src.slice(src.indexOf('sortBy === "incomplete"'), src.indexOf("// ADDED — real ask: \"orderable also by last encounter.\""));
    expect(block).toContain("getMissingRequiredContactFields(a).length");
    expect(block).toContain("getMissingRequiredContactFields(b).length");
    expect(block).toMatch(/if \(aMissing !== bMissing\) return bMissing - aMissing/);
    // Completeness score survives only as the within-group tie-breaker.
    expect(block).toMatch(/return getCompletenessScore\(a\) - getCompletenessScore\(b\)/);
    expect(block.indexOf("getMissingRequiredContactFields"))
      .toBeLessThan(block.indexOf("getCompletenessScore"));
  });

  it("uses the shared required-field helper, not a hand-rolled field list", () => {
    expect(src).toMatch(/import \{[^}]*getMissingRequiredContactFields[^}]*\} from "\.\.\/calculations\/contactCalculations"/);
  });
});

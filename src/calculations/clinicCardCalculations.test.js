import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isWithinClinicCardTimeframe } from "./clinicCardCalculations.js";

const clinicCardSource = readFileSync("src/modules/SHOS_ClinicCard_Prototype.jsx", "utf8");
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
  .replace(/\/\/.*$/gm, (comment) => comment.replace(/[^\n]/g, " "));
const clinicCardCode = stripComments(clinicCardSource);

describe("Clinic Card timeframe matching", () => {
  it("keeps all dated records when no cutoff is selected", () => {
    expect(isWithinClinicCardTimeframe("2026-01-01", null)).toBe(true);
  });

  it("includes records on the cutoff day and after it", () => {
    const cutoff = "2026-09-01T00:00:00.000Z";
    expect(isWithinClinicCardTimeframe(cutoff, cutoff)).toBe(true);
    expect(isWithinClinicCardTimeframe("2026-09-02T10:00:00.000Z", cutoff)).toBe(true);
  });

  it("excludes records before the selected cutoff", () => {
    expect(isWithinClinicCardTimeframe(
      "2026-08-31T23:59:00.000Z",
      "2026-09-01T00:00:00.000Z"
    )).toBe(false);
  });

  it("keeps undated records visible because their age cannot be established", () => {
    expect(isWithinClinicCardTimeframe("", "2026-09-01")).toBe(true);
    expect(isWithinClinicCardTimeframe(null, "2026-09-01")).toBe(true);
  });

  it("wires the selected timeframe into Recent STI Testing and explains an empty filtered result", () => {
    expect(clinicCardCode).toMatch(
      /const recentTests = tests\.filter\(\(t\) => isWithinClinicCardTimeframe\(t\.date, cutoffDate\)\)\.slice\(0, 5\)/
    );
    expect(clinicCardCode).toMatch(
      /tests\.length === 0 \? "No tests logged yet\." : "No tests in this timeframe\."/
    );
  });

  it("proves the wiring guard strips comments without dropping code", () => {
    const probe = "const kept = true; // isWithinClinicCardTimeframe\nconst next = 1;";
    expect(stripComments(probe)).toContain("const kept = true;");
    expect(stripComments(probe)).toContain("const next = 1;");
    expect(stripComments(probe)).not.toContain("isWithinClinicCardTimeframe");
    expect(clinicCardCode).not.toBe(clinicCardSource);
  });
});

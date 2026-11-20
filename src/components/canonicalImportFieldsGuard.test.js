// canonicalImportFieldsGuard.test.js — first slice of import/export
// standardisation (owner-approved 20 Nov). Cross-app transfer needs stable
// field NAMES and explicit UNITS, not FHIR plumbing. This locks the canonical
// fields the five transferable domains must keep in their DEFAULT_* record
// shapes; a repository that renames one without a migration is what breaks
// old backups and external imports.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (f) => readFileSync(path.join(process.cwd(), f), "utf8");

const DOMAINS = [
  { name: "medication", file: "src/repositories/medicationRepository.js", def: "const DEFAULT_MEDICATION = {", fields: ["name", "unit", "usagePattern", "dosesPerDay", "unitsPerDose", "inventoryTracked", "unitsPerContainer", "isArchived"] },
  { name: "period", file: "src/repositories/menstrualCycleRepository.js", def: "export const DEFAULT_CYCLE = {", fields: ["startDate", "endDate", "flow", "notes", "isArchived"] },
  { name: "vaccination", file: "src/repositories/vaccinationRepository.js", def: "export const DEFAULT_VACCINATION = {", fields: ["title", "vaccine", "date", "notes", "symptomIds"] },
  { name: "contraception", file: "src/repositories/contraceptionRepository.js", def: "export const DEFAULT_CONTRACEPTION_ENTRY = {", fields: ["method", "formulation", "startDate", "endDate", "intervalDays", "nextDueDate", "notes"] },
  { name: "measurement", file: "src/repositories/measurementRepository.js", def: "export const DEFAULT_MEASUREMENT = {", fields: ["type", "date", "value", "unit", "enteredValue", "enteredUnit"] },
];

describe("canonical import fields", () => {
  for (const d of DOMAINS) {
    it(`${d.name}: canonical fields still present in its DEFAULT record`, () => {
      const src = read(d.file);
      const start = src.indexOf(d.def);
      expect(start, `${d.name}: DEFAULT block not found`).toBeGreaterThan(-1);
      const block = src.slice(start, src.indexOf("\n};", start));
      for (const f of d.fields) expect(block, `${d.name} lost ${f}`).toMatch(new RegExp(`\\b${f}\\b`));
    });
  }

  it("measurements keep explicit entered + canonical units (no silent conversion loss)", () => {
    const src = read("src/repositories/measurementRepository.js");
    expect(src).toMatch(/canonical: "kg"/);
    expect(src).toMatch(/canonical: "°C"/);
    expect(src).toMatch(/canonical: "nmol\/L"/);
    expect(src).toMatch(/enteredValue/);
    expect(src).toMatch(/enteredUnit/);
  });

  it("fake-UTC date convention stays the shared import/export convention", () => {
    const helpers = read("src/calculations/dateInputHelpers.js");
    expect(helpers).toMatch(/fake-UTC|fake UTC/);
  });
});

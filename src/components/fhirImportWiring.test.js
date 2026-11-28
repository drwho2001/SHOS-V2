// fhirImportWiring.test.js — the FHIR importer only matters if it is
// reachable, previews before writing, and cannot leave a historical
// prescription active (which would create bogus reminders/refills).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (f) => readFileSync(path.join(process.cwd(), f), "utf8");

describe("FHIR import wiring", () => {
  it("is reachable from Settings → Backup & Export with a nested sheet", () => {
    const screen = read("src/modules/settings/BackupExportScreen.jsx");
    expect(screen).toMatch(/import FhirImportSheet from "\.\/FhirImportSheet\.jsx"/);
    expect(screen).toMatch(/setShowFhirImport\(true\)/);
    expect(screen).toMatch(/<FhirImportSheet/);
    expect(screen).toMatch(/onBusyChange=\{setFhirImportBusy\}/);
    expect(screen).toMatch(/showFhirImport \? \(fhirImportBusy \? \(\) => \{\}/);
  });

  it("creates records rather than overwriting, and archives every medication", () => {
    const src = read("src/calculations/fhirImport.js");
    const start = src.indexOf("export async function saveFhirImport");
    expect(start).toBeGreaterThan(-1);
    const body = src.slice(start, src.indexOf("\n}", start));
    expect(body).toMatch(/MedicationRepository\.create\(row, \{ archived: true \}\)/);
    expect(body).not.toMatch(/MedicationRepository\.update\(/);
    expect(body).toMatch(/VaccinationRepository\.create\(row\)/);
    expect(body).not.toMatch(/replaceAll|remove\(/);
    expect(read("src/repositories/medicationRepository.js")).toMatch(/isArchived: options\.archived === true/);
  });

  it("the sheet checks size before reading and writes only from the confirm handler", () => {
    const ui = read("src/modules/settings/FhirImportSheet.jsx");
    const onFile = ui.slice(ui.indexOf("const onFile"), ui.indexOf("const doImport"));
    expect(onFile.indexOf("setPreview(null)")).toBeLessThan(onFile.indexOf("file.text()"));
    expect(onFile.indexOf("file.size")).toBeLessThan(onFile.indexOf("file.text()"));
    expect(onFile).not.toMatch(/saveFhirImport/);
    const doImport = ui.slice(ui.indexOf("const doImport"), ui.indexOf("const brand"));
    expect(doImport).toMatch(/await saveFhirImport\(preview\)/);
    expect(doImport).toMatch(/onBusyChange\?\.\(true\)/);
    expect(doImport).toMatch(/buildFhirImportPreview\(rawRef\.current, meds, vax\)/);
    expect(ui).toMatch(/useOverlayBackHandler\(/);
  });
});

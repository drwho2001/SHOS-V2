// appleHealthImportWiring.test.js — the importer is only useful if it is
// reachable and its write path cannot silently overwrite real records.
// Source-text guards here cover the seams a parser unit test cannot see:
// the Settings row and the repository write mode.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (f) => readFileSync(path.join(process.cwd(), f), "utf8");

describe("Apple Health import wiring", () => {
  it("is reachable from Settings → Backup & Export, with a preview sheet", () => {
    const screen = read("src/modules/settings/BackupExportScreen.jsx");
    expect(screen).toMatch(/import AppleHealthImportSheet from "\.\/AppleHealthImportSheet\.jsx"/);
    expect(screen).toMatch(/setShowHealthImport\(true\)/);
    expect(screen).toMatch(/<AppleHealthImportSheet/);
    expect(screen).toMatch(/onImported=\{\(n\)/);
  });

  it("writes only by create(), never a replace-all that could overwrite records", () => {
    const src = read("src/calculations/appleHealthImport.js");
    const start = src.indexOf("export async function saveMeasurementImport");
    expect(start).toBeGreaterThan(-1);
    const body = src.slice(start, src.indexOf("\n}", start));
    expect(body).toMatch(/MeasurementRepository\.create\(row\)/);
    expect(body).not.toMatch(/replaceAll|remove\(|update\(/);
  });

  it("the sheet previews on file pick and writes only from the confirm handler", () => {
    const ui = read("src/modules/settings/AppleHealthImportSheet.jsx");
    const onFile = ui.slice(ui.indexOf("const onFile"), ui.indexOf("const doImport"));
    expect(onFile).toMatch(/await analyse\(text\)/);
    expect(onFile).not.toMatch(/saveMeasurementImport/);
    // A second pick must drop the first file's preview before reading, and
    // the size check must happen before file.text() reads the whole file.
    expect(onFile.indexOf("setPreview(null)")).toBeLessThan(onFile.indexOf("file.text()"));
    expect(onFile.indexOf("file.size")).toBeLessThan(onFile.indexOf("file.text()"));
    const doImport = ui.slice(ui.indexOf("const doImport"), ui.indexOf("const brand"));
    expect(doImport).toMatch(/await saveMeasurementImport\(preview\.rows\)/);
    expect(doImport).toMatch(/if \(!preview\?\.rows\?\.length/s);
    expect(doImport).toMatch(/onBusyChange\?\.\(true\)/);
    const screen = read("src/modules/settings/BackupExportScreen.jsx");
    expect(screen).toMatch(/healthImportBusy \? \(\) => \{\}/);
  });
});

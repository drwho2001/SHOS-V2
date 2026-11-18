// 18 Nov 2026 — CHALLENGE FINDING: the Testing↔Measurements link the owner
// approved as "to build" ALREADY EXISTS in the codebase. This guard records
// the contract so nobody rebuilds it, and so a future refactor cannot quietly
// drop one half of it.
//
// The original ask (round 3 B1) was: eGFR is a test whose result is a
// measurement; link the two modules without merging them. The code already
// does exactly that via `Measurement.linkedTestId`:
//  - Testing detail lists linked measurements and offers "+ Add measurement"
//    via InlineMeasurementSheet(presetLink={{ linkedTestId: testId }});
//  - Measurement form/detail show the source test;
//  - deleting a Test unlinks (not deletes) its Measurements;
//  - the orphan checker covers linkedTestId.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (rel) => readFileSync(path.join(process.cwd(), rel), "utf8");
const repo = read("src/repositories/measurementRepository.js");
const testingRepo = read("src/repositories/testingRepository.js");
const testingUi = read("src/modules/SHOS_Testing_Prototype.jsx");
const measurementUi = read("src/modules/SHOS_Measurements_Prototype.jsx");
const orphanCheck = read("src/calculations/orphanReferenceCheck.js");

describe("Testing↔Measurements link (already built — do not rebuild)", () => {
  it("Measurements stores the link and unlinks (never deletes) on Test delete", () => {
    expect(repo).toMatch(/linkedTestId: null/);
    expect(repo).toMatch(/async unlinkTest\(testId\)/);
    expect(testingRepo).toMatch(/MeasurementRepository\.unlinkTest\(id\)/);
  });

  it("Testing offers 'Add measurement' prefilled with the test id", () => {
    expect(testingUi).toMatch(/presetLink=\{\{ linkedTestId: testId \}\}/);
    expect(testingUi).toMatch(/testing\.addMeasurement/, "the add-measurement action is gone");
  });

  it("Measurements shows the source test on the form and detail", () => {
    expect(measurementUi).toMatch(/linkedTestId \? TestingRepository\.getById/);
    expect(measurementUi).toMatch(/<ReadRow label="Test"/);
  });

  it("the orphan checker covers the link", () => {
    expect(orphanCheck).toMatch(/checkSingle\(results, testExists, m\.linkedTestId/);
  });

  it("the modules stay separate — no measurement value field was added to Testing", () => {
    // There are two "testing.notes" SectionCards in this file (line ~991 and
    // ~1395); the one AFTER the measurements block is the boundary we want.
    const start = testingUi.indexOf('tr("testing.measurements"');
    const detail = testingUi.slice(start, testingUi.indexOf('tr("testing.notes"', start));
    expect(detail).toContain("m.value");
    expect(detail).toContain("m.unit");
    // Testing renders the Measurement's value; it never owns one of its own.
    expect(detail).not.toMatch(/form\.(value|unit)\b/);
  });
});

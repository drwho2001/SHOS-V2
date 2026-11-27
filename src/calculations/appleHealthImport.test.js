import { describe, it, expect } from "vitest";
import {
  parseAppleHealthRecords,
  buildMeasurementPreview,
  toFakeUtcDate,
  MAX_IMPORT_BYTES,
  MAX_PREVIEW_ROWS,
} from "./appleHealthImport.js";

// The first two Record lines are verbatim from the REAL public fixture at
// https://github.com/tdda/applehealthdata/blob/master/testdata/export6s3sample.xml
// (HealthKit Export Version 3). The third is an added unknown-type probe —
// that fixture has no HeartRate record — so it is not presented as fixture
// evidence, only as an explicit test of the skipped-type path.
const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="en_GB">
<ExportDate value="2016-04-15 07:27:26 +0100"/>
<Record type="HKQuantityTypeIdentifierStepCount" sourceName="Health" unit="count" creationDate="2014-09-21 07:08:47 +0100" startDate="2014-09-13 10:27:54 +0100" endDate="2014-09-13 10:27:59 +0100" value="329"/>
<Record type="HKQuantityTypeIdentifierDistanceWalkingRunning" sourceName="Health" unit="km" creationDate="2014-09-21 07:08:49 +0100" startDate="2014-09-20 10:41:28 +0100" endDate="2014-09-20 10:41:30 +0100" value="0.00288"/>
<Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Health" unit="count/min" startDate="2014-09-13 10:27:54 +0100" endDate="2014-09-13 10:27:59 +0100" value="88"/>
</HealthData>`;

describe("Apple Health import first slice", () => {
  it("parses real Record attributes without inventing fields", () => {
    const recs = parseAppleHealthRecords(SAMPLE);
    expect(recs).toHaveLength(3);
    expect(recs[0]).toMatchObject({ type: "HKQuantityTypeIdentifierStepCount", unit: "count", value: "329" });
  });

  it("keeps wall-clock digits and drops the real offset (fake UTC)", () => {
    expect(toFakeUtcDate("2014-09-13 10:27:54 +0100")).toBe("2014-09-13T10:27:54.000Z");
  });

  it("maps only the two types actually present in the real fixture", () => {
    const { rows, skipped, error } = buildMeasurementPreview(SAMPLE);
    expect(error).toBeNull();
    expect(rows).toEqual([
      { type: "Step count", date: "2014-09-13T10:27:54.000Z", value: 329, unit: "count", enteredValue: 329, enteredUnit: "count", note: "Imported from Apple Health" },
      { type: "Distance walking/running", date: "2014-09-20T10:41:28.000Z", value: 0.00288, unit: "km", enteredValue: 0.00288, enteredUnit: "km", note: "Imported from Apple Health" },
    ]);
    expect(skipped).toEqual([{ type: "HKQuantityTypeIdentifierHeartRate", reason: "No SHOS measurement mapping" }]);
  });

  it("dedupes against existing records and refuses unit drift", () => {
    const existing = [{ type: "Step count", date: "2014-09-13T10:27:54.000Z" }];
    const { rows, skipped } = buildMeasurementPreview(SAMPLE, existing);
    expect(rows).toHaveLength(1);
    expect(skipped.some((s) => s.reason === "Already present in SHOS")).toBe(true);
    const wrongUnit = SAMPLE.replace('unit="count"', 'unit="steps"');
    expect(buildMeasurementPreview(wrongUnit).skipped.some((s) => s.reason.includes("no conversion"))).toBe(true);
  });

  it("keeps two samples with the same wall-clock start when the interval or value differs (DST fall-back)", () => {
    const twice = SAMPLE.replace(
      /<Record type="HKQuantityTypeIdentifierStepCount"[^>]*\/>/,
      `<Record type="HKQuantityTypeIdentifierStepCount" unit="count" startDate="2014-09-13 10:27:54 +0100" endDate="2014-09-13 10:27:59 +0100" value="329"/>
<Record type="HKQuantityTypeIdentifierStepCount" unit="count" startDate="2014-09-13 10:27:54 +0000" endDate="2014-09-13 10:27:59 +0000" value="412"/>`
    );
    const { rows, skipped } = buildMeasurementPreview(twice);
    expect(rows.filter((r) => r.type === "Step count")).toHaveLength(2);
    expect(skipped.some((s) => s.reason === "Duplicate sample")).toBe(false);
  });

  it("refuses impossible calendar values and an empty value attribute", () => {
    const badDate = SAMPLE.replace("2014-09-13 10:27:54 +0100", "2014-99-99 88:99:99 +0100");
    expect(buildMeasurementPreview(badDate).rows).toHaveLength(1); // only the distance row survives
    const emptyValue = SAMPLE.replace('value="329"', 'value=""');
    const { rows, skipped } = buildMeasurementPreview(emptyValue);
    expect(rows).toHaveLength(1);
    expect(skipped.some((s) => s.reason === "Unreadable date or value")).toBe(true);
  });

  it("rejects a multi-GB export with an actionable message instead of freezing the page", () => {
    const { rows, error } = buildMeasurementPreview("x".repeat(MAX_IMPORT_BYTES + 1));
    expect(rows).toHaveLength(0);
    expect(error).toMatch(/narrower date range/);
  });

  it("caps an oversized preview and flags the truncation", () => {
    const many = Array.from({ length: MAX_PREVIEW_ROWS + 3 }, (_, i) =>
      `<Record type="HKQuantityTypeIdentifierStepCount" unit="count" startDate="2014-09-13 10:27:54 +0100" endDate="2014-09-13 10:27:59 +0100" value="${i + 1}"/>`
    ).join("\n");
    const { rows, truncated } = buildMeasurementPreview(many);
    expect(rows).toHaveLength(MAX_PREVIEW_ROWS);
    expect(truncated).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { parseFhirBundle, fhirDateToFakeUtc, buildFhirImportPreview, MAX_FHIR_BYTES } from "./fhirImport.js";

// Verbatim resources from the REAL public HL7 PHR IG Synthea HIV patient
// bundle (Cyril535 Koepp521, 776 entries). The extra resources below are
// labelled variants, not presented as fixture evidence.
const REAL_MED = {
  resourceType: "MedicationRequest",
  id: "0e2c955a-b888-87d7-3971-1e7f1248230a",
  meta: { profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest"] },
  status: "stopped",
  intent: "order",
  category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/medicationrequest-category", code: "community", display: "Community" }], text: "Community" }],
  medicationCodeableConcept: {
    coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "861467", display: "Meperidine Hydrochloride 50 MG Oral Tablet" }],
    text: "Meperidine Hydrochloride 50 MG Oral Tablet",
  },
  subject: { reference: "urn:uuid:558aac8d-bd8a-e7fd-ca6e-824c192e9544" },
  encounter: { reference: "urn:uuid:8dd098fc-898c-2a1a-656b-4eb5dcaeb16b" },
  authoredOn: "1963-05-04T23:10:44-05:00",
  requester: { reference: "Practitioner?identifier=http://hl7.org/fhir/sid/us-npi|9999780296", display: "Dr. Delmar187 Daniel959" },
  dosageInstruction: [{
    sequence: 1,
    timing: { repeat: { frequency: 1, period: 4, periodUnit: "h" } },
    asNeededBoolean: false,
    doseAndRate: [{ type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/dose-rate-type", code: "ordered", display: "Ordered" }] }, doseQuantity: { value: 1 } }],
  }],
};
const REAL_VAX = {
  resourceType: "Immunization",
  id: "5f8cc821-6b7d-fa02-96a5-5ddd62020ed3",
  meta: { profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization"] },
  status: "completed",
  vaccineCode: {
    coding: [{ system: "http://hl7.org/fhir/sid/cvx", code: "140", display: "Influenza, seasonal, injectable, preservative free" }],
    text: "Influenza, seasonal, injectable, preservative free",
  },
  patient: { reference: "urn:uuid:558aac8d-bd8a-e7fd-ca6e-824c192e9544" },
  encounter: { reference: "urn:uuid:3adf3915-2a0b-9f59-a94b-6e8af79a3973" },
  occurrenceDateTime: "1988-12-12T18:30:51-06:00",
  primarySource: true,
  location: { reference: "Location?identifier=https://github.com/synthetichealth/synthea|c41f1bdc-27d0-364e-926b-c0248bf24e8e", display: "ROYA FAMILY MEDICAL CENTER LTD" },
};
const bundle = (resources) => JSON.stringify({ resourceType: "Bundle", type: "collection", entry: resources.map((resource) => ({ resource })) });

describe("FHIR import second slice", () => {
  it("parses a real Bundle and counts the resource types it leaves alone", () => {
    const parsed = parseFhirBundle(bundle([REAL_MED, REAL_VAX, { resourceType: "Observation" }]));
    expect(parsed.resources).toHaveLength(3);
    expect(parsed.otherCounts).toEqual([{ type: "Observation", count: 1 }]);
  });

  it("keeps wall-clock digits, never shifting a real offset or a date-only value", () => {
    expect(fhirDateToFakeUtc("1963-05-04T23:10:44-05:00")).toBe("1963-05-04T23:10:44.000Z");
    expect(fhirDateToFakeUtc("1988-12-12")).toBe("1988-12-12T00:00:00.000Z");
    expect(fhirDateToFakeUtc("")).toBeNull();
  });

  it("maps the real medication without inventing a dose unit", () => {
    const { meds, skipped, error } = buildFhirImportPreview(bundle([REAL_MED]));
    expect(error).toBeNull();
    expect(skipped).toEqual([]);
    expect(meds).toHaveLength(1);
    expect(meds[0]).toMatchObject({
      name: "Meperidine Hydrochloride 50 MG Oral Tablet",
      unit: "",
      usagePattern: "daily",
      dosesPerDay: 6,
      unitsPerDose: 1,
      inventoryTracked: false,
    });
    expect(meds[0].notes).toMatch(/1963-05-04T23:10:44\.000Z/);
    expect(meds[0].notes).toMatch(/not a countable dose unit/);
    expect(meds[0].notes).toMatch(/stopped/);
  });

  it("keeps a strength like 500 mg out of unitsPerDose, and divides weekly frequency into the custom interval", () => {
    const strength = structuredClone(REAL_MED);
    strength.id = "strength-variant";
    strength.authoredOn = "1997-05-07T08:00:00-05:00";
    strength.medicationCodeableConcept.text = "Strength variant";
    strength.dosageInstruction[0].doseAndRate[0].doseQuantity = { value: 500, unit: "mg" };
    strength.dosageInstruction[0].timing.repeat = { frequency: 2, period: 1, periodUnit: "wk" };
    const { meds } = buildFhirImportPreview(bundle([strength]));
    expect(meds[0].unit).toBe("");
    expect(meds[0].unitsPerDose).toBe(1);
    expect(meds[0].scheduleIntervalDays).toBe(3.5);
    expect(meds[0].usagePattern).toBe("custom");
    expect(meds[0].notes).toMatch(/500 mg/);
  });

  it("maps the real immunization with its CVX code and location", () => {
    const { vaccines } = buildFhirImportPreview(bundle([REAL_VAX]));
    expect(vaccines).toHaveLength(1);
    expect(vaccines[0]).toMatchObject({
      title: "Influenza, seasonal, injectable, preservative free",
      vaccine: "Influenza, seasonal, injectable, preservative free",
      date: "1988-12-12T18:30:51.000Z",
      symptomIds: [],
    });
    expect(vaccines[0].notes).toMatch(/cvx 140/);
    expect(vaccines[0].notes).toMatch(/ROYA FAMILY MEDICAL CENTER LTD/);
  });

  it("dedupes against existing records and refuses a non-completed vaccine", () => {
    const existingMed = { name: "Meperidine Hydrochloride 50 MG Oral Tablet" };
    const existingVax = { title: REAL_VAX.vaccineCode.text, date: "1988-12-12T00:00:00.000Z" };
    const { meds, vaccines, skipped } = buildFhirImportPreview(bundle([REAL_MED, REAL_VAX]), [existingMed], [existingVax]);
    expect(meds).toHaveLength(0);
    expect(vaccines).toHaveLength(0);
    expect(skipped.map((s) => s.reason)).toEqual(["Name already in SHOS", "Already present or duplicate"]);
    const cancelled = { ...REAL_VAX, status: "cancelled" };
    expect(buildFhirImportPreview(bundle([cancelled])).skipped[0].reason).toBe("Status cancelled");
  });

  it("handles medicationReference without throwing, and resolves it when the Medication resource is present", () => {
    const ref = { ...REAL_MED, medicationReference: { reference: "urn:uuid:abc" }, medicationCodeableConcept: undefined };
    expect(buildFhirImportPreview(bundle([ref])).skipped[0].reason).toMatch(/resolvable Medication/);
    const resolved = {
      resourceType: "Medication",
      id: "abc",
      code: { text: "Referenced medicine" },
    };
    const { meds } = buildFhirImportPreview(bundle([ref, resolved]));
    expect(meds[0].name).toBe("Referenced medicine");
  });

  it("reports an oversized export with an actionable message", () => {
    const res = buildFhirImportPreview("x".repeat(MAX_FHIR_BYTES + 1));
    expect(res.error).toMatch(/narrower date range/);
    expect(res.meds).toHaveLength(0);
  });
});

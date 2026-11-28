// fhirImport.js — import v2 second slice, 28 Nov 2026.
//
// Owner instruction: research real sample data first, never invent a format.
// Built against the REAL public HL7 PHR IG Synthea HIV patient bundle:
// build.fhir.org/ig/HL7/personal-health-record-format-ig/en/
// Cyril535_Koepp521_558aac8d-bd8a-e7fd-ca6e-824c192e9544.json
// (2,588,742 bytes, 776 entries: 17 MedicationRequest, 9 Immunization, and
// many other resource types that are deliberately left alone).
//
// Only the two domains the fixture actually exercises are mapped. Every
// mapping decision is conservative because FHIR is a clinical record and SHOS
// is not: no dose unit is invented, no historical prescription is left active,
// and nothing is written until the user confirms a preview.
import { MedicationRepository } from "../repositories/medicationRepository.js";
import { VaccinationRepository } from "../repositories/vaccinationRepository.js";

export const MAX_FHIR_BYTES = 25 * 1024 * 1024;
export const MAX_FHIR_ROWS = 2000;

// FHIR timestamps are ISO 8601 with a REAL offset. SHOS stores wall-clock
// digits with a deliberate trailing Z. Slice the digits before any Date
// parsing — new Date("1988-12-12") is treated as UTC midnight and shifts the
// day for a user west of UTC. Partial dates get midnight wall-clock digits.
export function fhirDateToFakeUtc(value) {
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(value || ""));
  if (!m) return null;
  return `${m[1]}T${m[2] || "00"}:${m[3] || "00"}:${m[4] || "00"}.000Z`;
}

function codingOf(concept) {
  const coding = concept?.coding?.[0];
  return {
    system: coding?.system || "",
    code: coding?.code || "",
    display: concept?.text || coding?.display || "",
  };
}

export function parseFhirBundle(text) {
  const json = JSON.parse(String(text || ""));
  if (json?.resourceType !== "Bundle" || !Array.isArray(json.entry)) {
    throw new Error("This is not a FHIR Bundle (no resourceType 'Bundle' with entries).");
  }
  const resources = json.entry.map((e) => e?.resource).filter(Boolean);
  const byId = new Map();
  for (const r of resources) {
    if (r?.id) byId.set(String(r.id), r);
    if (r?.resourceType === "Medication") byId.set(`Medication/${r.id}`, r);
  }
  return { resources, byId, otherCounts: countOtherTypes(resources) };
}

function countOtherTypes(resources) {
  const counts = {};
  for (const r of resources) {
    if (r.resourceType !== "MedicationRequest" && r.resourceType !== "Immunization") {
      counts[r.resourceType] = (counts[r.resourceType] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

// A MedicationRequest may carry an inline CodeableConcept OR a reference to a
// Medication resource. Guard both: dereferencing a reference blindly is the
// classic TypeError that takes down an entire batch import.
function medicationName(resource, byId) {
  if (resource.medicationCodeableConcept) return codingOf(resource.medicationCodeableConcept).display;
  const ref = String(resource.medicationReference?.reference || "");
  const id = ref.split("/").pop().replace(/^urn:uuid:/, "");
  const target = id ? byId.get(id) || byId.get(`Medication/${id}`) : null;
  return target ? codingOf(target.code).display : "";
}

function scheduleFromDosage(resource) {
  const dose = resource.dosageInstruction?.[0];
  if (!dose) return { usagePattern: "daily", dosesPerDay: null, scheduleIntervalDays: null, note: "no timing in source" };
  if (dose.asNeededBoolean === true) return { usagePattern: "prn", dosesPerDay: null, scheduleIntervalDays: null, note: "as needed" };
  const repeat = dose.timing?.repeat;
  if (!repeat?.frequency || !repeat?.period) return { usagePattern: "daily", dosesPerDay: null, scheduleIntervalDays: null, note: "timing not specified" };
  const { frequency, period, periodUnit } = repeat;
  if (periodUnit === "d") {
    const perDay = frequency / period;
    return perDay >= 1 && perDay <= 24
      ? { usagePattern: "daily", dosesPerDay: Math.round(perDay), scheduleIntervalDays: null, note: `${frequency} per ${period} day(s)` }
      : { usagePattern: "daily", dosesPerDay: null, scheduleIntervalDays: null, note: "unsupported daily frequency" };
  }
  if (periodUnit === "h") {
    const perDay = (frequency * 24) / period;
    return perDay >= 1 && perDay <= 24
      ? { usagePattern: "daily", dosesPerDay: Math.round(perDay), scheduleIntervalDays: null, note: `${frequency} per ${period} hour(s)` }
      : { usagePattern: "daily", dosesPerDay: null, scheduleIntervalDays: null, note: "unsupported hourly frequency" };
  }
  if (periodUnit === "wk" || periodUnit === "mo") {
    const days = period * (periodUnit === "wk" ? 7 : 30);
    // SHOS's custom pattern is "every N days", so a frequency above one must
    // shorten the interval: "2 per week" is every 3.5 days, not every 7.
    return { usagePattern: "custom", dosesPerDay: null, scheduleIntervalDays: days / frequency, note: `${frequency} per ${period} ${periodUnit}` };
  }
  return { usagePattern: "daily", dosesPerDay: null, scheduleIntervalDays: null, note: `unsupported period unit ${periodUnit}` };
}

export function buildFhirImportPreview(text, existingMeds = [], existingVaccines = []) {
  if (String(text || "").length > MAX_FHIR_BYTES) {
    return { meds: [], vaccines: [], skipped: [], unrelated: [], error: `This file is larger than ${Math.round(MAX_FHIR_BYTES / 1024 / 1024)} MB. Export a narrower date range and try again.`, truncated: false };
  }
  let bundle;
  try {
    bundle = parseFhirBundle(text);
  } catch (err) {
    return { meds: [], vaccines: [], skipped: [], unrelated: [], error: err?.message || "Could not read that FHIR file.", truncated: false };
  }
  const existingMedNames = new Set((existingMeds || []).map((m) => String(m.name || "").toLowerCase()).filter(Boolean));
  const existingVaxKeys = new Set(
    (existingVaccines || []).filter((v) => v && v.title && v.date).map((v) => `${v.title}|${String(v.date).slice(0, 10)}`)
  );
  const seenMeds = new Set();
  const seenVax = new Set();
  const meds = [];
  const vaccines = [];
  const skipped = [];
  let truncated = false;

  for (const r of bundle.resources) {
    if (meds.length + vaccines.length >= MAX_FHIR_ROWS) { truncated = true; continue; }
    if (r.resourceType === "MedicationRequest") {
      const code = codingOf(r.medicationCodeableConcept);
      const name = medicationName(r, bundle.byId);
      if (!name) { skipped.push({ type: "MedicationRequest", reason: "No inline medication name or resolvable Medication resource" }); continue; }
      if (existingMedNames.has(name.toLowerCase())) { skipped.push({ type: "MedicationRequest", reason: "Name already in SHOS" }); continue; }
      const date = fhirDateToFakeUtc(r.authoredOn);
      if (!date) { skipped.push({ type: "MedicationRequest", reason: "Missing authoredOn date" }); continue; }
      const key = `${code.system}#${code.code}|${date}|${r.id || ""}`;
      if (seenMeds.has(key)) { skipped.push({ type: "MedicationRequest", reason: "Duplicate prescription" }); continue; }
      seenMeds.add(key);
      const schedule = scheduleFromDosage(r);
      const qty = r.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity;
      // FHIR doseQuantity is a DOSE amount, often a strength (500 mg). SHOS's
      // unit/unitsPerDose count household units (tablets, capsules, doses).
      // Only a count-like unit is safe to carry over; a bare number or a mass
      // is preserved in notes and unitsPerDose stays at the repository default.
      const qtyUnit = String(qty?.unit || "").toLowerCase();
      const hasCountUnit = /^(tablet|tab|capsule|cap|dose|unit|count|pill)s?$/.test(qtyUnit);
      const hasUnit = hasCountUnit;
      meds.push({
        name,
        unit: hasUnit ? qty.unit : "",
        usagePattern: schedule.usagePattern,
        dosesPerDay: schedule.dosesPerDay,
        scheduleIntervalDays: schedule.scheduleIntervalDays,
        unitsPerDose: hasUnit ? Number(qty.value) : 1,
        inventoryTracked: false,
        unitsPerContainer: 0,
        notes: `Imported from FHIR (${r.status || "status unknown"}; authoredOn ${date}; ${schedule.note}). Original dose value ${qty?.value ?? "(none)"}${qty?.unit ? ` ${qty.unit}` : ""}${hasUnit ? "" : " (not a countable dose unit, so units per dose was left at 1)"}. Historical prescription - archived on import.`,
      });
      continue;
    }
    if (r.resourceType === "Immunization") {
      if (r.status && r.status !== "completed") { skipped.push({ type: "Immunization", reason: `Status ${r.status}` }); continue; }
      const code = codingOf(r.vaccineCode);
      const date = fhirDateToFakeUtc(r.occurrenceDateTime);
      if (!code.display || !date) { skipped.push({ type: "Immunization", reason: "Missing vaccine name or date" }); continue; }
      const key = `${code.system}#${code.code}|${date}`;
      if (existingVaxKeys.has(`${code.display}|${date.slice(0, 10)}`) || seenVax.has(key)) {
        skipped.push({ type: "Immunization", reason: "Already present or duplicate" });
        continue;
      }
      seenVax.add(key);
      vaccines.push({
        title: code.display,
        vaccine: code.display,
        date,
        notes: `Imported from FHIR (${code.system} ${code.code}${r.location?.display ? ` at ${r.location.display}` : ""}).`,
        symptomIds: [],
      });
    }
  }
  return { meds, vaccines, skipped, unrelated: bundle.otherCounts, error: null, truncated };
}

// The only write path. create() generates a fresh id and appends. The
// `archived` option persists the historical status in the SAME write, so a
// decades-old prescription never exists briefly as a live reminder obligation.
export async function saveFhirImport(preview) {
  let meds = 0;
  let vaccines = 0;
  for (const row of preview?.meds || []) {
    await MedicationRepository.create(row, { archived: true });
    meds++;
  }
  for (const row of preview?.vaccines || []) {
    await VaccinationRepository.create(row);
    vaccines++;
  }
  return { meds, vaccines };
}

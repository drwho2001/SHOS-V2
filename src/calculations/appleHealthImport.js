// appleHealthImport.js — import v2 first slice, 27 Nov 2026.
//
// Owner instruction: do not invent samples. The fixture this parser was built
// against is the real public Apple Health export at
// tdda/applehealthdata/testdata/export6s3sample.xml (HealthKit Export v3).
// That file contains only HKQuantityTypeIdentifierStepCount (count) and
// HKQuantityTypeIdentifierDistanceWalkingRunning (km). It has NO medication,
// vaccination or cycle records, so this importer deliberately does only the
// MEASUREMENT domain and reports every other type as skipped rather than
// guessing a mapping.
//
// Safety (same rails as periodCsvImport.js): parse + preview first, no writes;
// explicit type/unit map, no silent conversions; dedupe by type + full interval
// + value (start alone collides at the DST fall-back); unrecognised types are
// reported, never dropped silently.
//
// Real exports are routinely hundreds of MB. A file-size ceiling and a preview
// row ceiling keep a huge file from locking up the WebView that hosts the app.
// The user is told to export a narrow date range instead, not left guessing.
import { MeasurementRepository } from "../repositories/measurementRepository.js";

export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
export const MAX_PREVIEW_ROWS = 2000;

export const HK_MEASUREMENT_TYPES = {
  HKQuantityTypeIdentifierStepCount: { type: "Step count", unit: "count" },
  HKQuantityTypeIdentifierDistanceWalkingRunning: { type: "Distance walking/running", unit: "km" },
};

function attributes(chunk) {
  const out = {};
  for (const m of chunk.matchAll(/([A-Za-z][\w]*)\s*=\s*"([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

export function parseAppleHealthRecords(xml) {
  const text = String(xml || "");
  const records = [];
  for (const m of text.matchAll(/<Record\b([^>]*)>/g)) {
    records.push(attributes(m[1]));
  }
  return records;
}

// Apple Health timestamps carry a real UTC offset. SHOS stores wall-clock
// digits with a deliberate trailing Z (dateInputHelpers fake-UTC convention),
// so take the LOCAL portion of startDate verbatim and drop the offset rather
// than shifting the clock.
export function toFakeUtcDate(startDate) {
  const m = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/.exec(String(startDate || ""));
  return m ? `${m[1]}T${m[2]}.000Z` : null;
}

// Shape alone is not enough: "2014-99-99 88:99:99 +0100" would pass the
// regex above and be persisted as a real measurement date. Round-trip the
// digits through a UTC Date so an impossible calendar value is rejected
// without shifting the wall-clock digits the app stores.
function isValidFakeUtcDate(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.000Z$/.exec(String(date || ""));
  if (!m) return false;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  const check = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  return (
    check.getUTCFullYear() === y &&
    check.getUTCMonth() === mo - 1 &&
    check.getUTCDate() === d &&
    check.getUTCHours() === h &&
    check.getUTCMinutes() === mi &&
    check.getUTCSeconds() === s
  );
}

export function buildMeasurementPreview(xml, existing = []) {
  const text = String(xml || "");
  if (text.length > MAX_IMPORT_BYTES) {
    return {
      rows: [],
      skipped: [],
      error: `This export is larger than ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)} MB. Export a narrower date range from Apple Health and try that file.`,
      truncated: false,
    };
  }
  const existingKeys = new Set(
    (existing || [])
      .filter((r) => r && r.type && r.date)
      .map((r) => `${r.type}|${String(r.date).slice(0, 19)}`)
  );
  const seen = new Set();
  const rows = [];
  const skipped = [];
  let truncated = false;
  for (const rec of parseAppleHealthRecords(text)) {
    if (rows.length >= MAX_PREVIEW_ROWS) {
      truncated = true;
      continue;
    }
    const mapped = HK_MEASUREMENT_TYPES[rec.type];
    if (!mapped) {
      skipped.push({ type: rec.type, reason: "No SHOS measurement mapping" });
      continue;
    }
    if (rec.unit !== mapped.unit) {
      skipped.push({ type: rec.type, reason: `Unit ${rec.unit || "(none)"} is not ${mapped.unit}; no conversion` });
      continue;
    }
    const date = toFakeUtcDate(rec.startDate);
    const value = Number(rec.value);
    // Number("") is 0, so an empty value attribute must be rejected explicitly
    // rather than becoming a legitimate-looking zero measurement.
    if (!date || !isValidFakeUtcDate(date) || rec.value === "" || rec.value == null || !Number.isFinite(value)) {
      skipped.push({ type: rec.type, reason: "Unreadable date or value" });
      continue;
    }
    // Existing SHOS records carry only a point-in-time `date`, so match those
    // by type+date. Between imported samples, include the full interval AND
    // the value: a DST fall-back repeats a wall-clock hour, and two devices
    // can start a sample at the same second.
    const existingKey = `${mapped.type}|${date.slice(0, 19)}`;
    if (existingKeys.has(existingKey)) {
      skipped.push({ type: rec.type, reason: "Already present in SHOS" });
      continue;
    }
    const key = `${mapped.type}|${date}|${rec.endDate || ""}|${rec.value}`;
    if (seen.has(key)) {
      skipped.push({ type: rec.type, reason: "Duplicate sample" });
      continue;
    }
    seen.add(key);
    rows.push({
      type: mapped.type,
      date,
      value,
      unit: mapped.unit,
      enteredValue: value,
      enteredUnit: rec.unit,
      note: "Imported from Apple Health",
    });
  }
  return { rows, skipped, truncated, error: null };
}

// The ONLY write path, called after the user confirms the preview. Rows are
// built from DEFAULT_MEASUREMENT's canonical field names and never overwrite.
export async function saveMeasurementImport(rows) {
  let saved = 0;
  for (const row of rows || []) {
    await MeasurementRepository.create(row);
    saved++;
  }
  return saved;
}

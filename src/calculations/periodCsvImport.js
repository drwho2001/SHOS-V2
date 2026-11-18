// periodCsvImport.js
//
// Import v1 (18 Nov 2026) — bring period data back in from a CSV, ON DEVICE.
// Accepts either SHOS's own menstrual-cycles CSV (round-trip) or a Clue-style
// export with a start/end date column. No cloud, no network, no auto-save.
//
// SAFETY (same guard rails as demo restore):
//  - read + validate + PREVIEW first; the caller only writes on confirm;
//  - explicit UK (DD/MM) or US (MM/DD) choice for ambiguous dates — never guess,
//    because a wrong month/day on health data is silent corruption;
//  - dedupe by start date against BOTH existing records and other imported rows;
//  - never overwrite an existing record;
//  - unparseable rows are reported, not silently dropped.
import { MenstrualCycleRepository } from "../repositories/menstrualCycleRepository.js";

// RFC 4180-ish parser: quoted cells may contain commas/newlines and escape a
// quote by doubling it. Returns an array of string rows (header first).
export function parseCsv(text) {
  const s = String(text || "").replace(/\r\n?/g, "\n");
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

const START = /^(cycle\s*)?(start\s*date|start)$/i;
const END = /^(cycle\s*)?(end\s*date|end)$/i;
const FLOW = /^flow(\s*level)?$/i;
// SHOS's own generic CSV uses the raw repository field names.
const SHOS_START = /^startDate$/i;

export function importFormat(headers) {
  const list = (headers || []).map((h) => String(h).trim());
  if (list.some((h) => SHOS_START.test(h))) return "shos";
  if (list.some((h) => START.test(h))) return "clue";
  return "unknown";
}

const pad = (n) => String(n).padStart(2, "0");

/**
 * Parse one date cell using an EXPLICIT UK/US format. ISO is accepted first
 * because it is unambiguous and is what SHOS's own CSV stores.
 * @returns {string|null} YYYY-MM-DD, or null when it cannot be read safely.
 */
export function parseImportDate(value, dateFormat = "UK") {
  const s = String(value || "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  const first = Number(m[1]);
  const second = Number(m[2]);
  const day = dateFormat === "US" ? second : first;
  const month = dateFormat === "US" ? first : second;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${m[3]}-${pad(month)}-${pad(day)}`;
  const d = new Date(`${iso}T00:00:00Z`);
  // Rejects impossible dates like 31/02/2026 (Date rolls them over).
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

function valueFor(headers, cells, pattern) {
  const i = headers.findIndex((h) => pattern.test(h.trim()));
  return i >= 0 ? String(cells[i] || "").trim() : "";
}

/**
 * Build a preview; NEVER writes. The caller shows `rows` and commits only on
 * explicit confirmation via savePeriodImport().
 */
export function buildPeriodImportPreview(text, dateFormat, existingCycles = []) {
  const table = parseCsv(text);
  if (table.length === 0) return { format: "unknown", rows: [], errors: ["The file is empty."], duplicates: 0 };
  const headers = table[0];
  const format = importFormat(headers);
  if (format === "unknown") {
    return {
      format,
      rows: [],
      errors: ["Unrecognised columns. Expected a 'Start Date' column (Clue) or 'startDate' (SHOS export)."],
      duplicates: 0,
    };
  }
  const existingStarts = new Set((existingCycles || []).map((c) => c.startDate).filter(Boolean));
  const seen = new Set();
  const rows = [];
  const errors = [];
  let duplicates = 0;

  table.slice(1).forEach((cells, idx) => {
    const rawStart = valueFor(headers, cells, format === "shos" ? SHOS_START : START);
    const startDate = parseImportDate(rawStart, dateFormat);
    if (!startDate) {
      if (rawStart) errors.push(`Row ${idx + 2}: couldn't read the start date (check UK/US choice).`);
      return;
    }
    if (existingStarts.has(startDate) || seen.has(startDate)) { duplicates++; return; }
    const endDate = parseImportDate(valueFor(headers, cells, format === "shos" ? END : END), dateFormat) || null;
    if (endDate && endDate < startDate) { errors.push(`Row ${idx + 2}: end date is before the start date.`); return; }
    seen.add(startDate);
    rows.push({
      startDate,
      endDate,
      flow: valueFor(headers, cells, FLOW) || "",
      notes: format === "shos" ? "Imported from SHOS CSV" : "Imported from Clue CSV",
      isDemo: false,
    });
  });
  return { format, rows, errors, duplicates };
}

// The ONLY write path, called after the user confirms the preview.
export async function savePeriodImport(rows) {
  let saved = 0;
  for (const row of rows || []) {
    await MenstrualCycleRepository.create(row);
    saved++;
  }
  return saved;
}

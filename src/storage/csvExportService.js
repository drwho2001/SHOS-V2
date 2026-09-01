// csvExportService.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// "Export as CSV" — one record type at a time, as a real spreadsheet-
// readable file (Excel, Sheets, Numbers), unlike the JSON backup which
// is for restoring into SHOS itself, not for reading elsewhere. Reuses
// buildBackup()'s existing per-key data gathering (backupService.js) so
// this file doesn't need its own copy of "which repository holds which
// data" — one source of truth for that, same as Selective export
// already relies on.
//
// Deliberately one CSV per record type, not one combined file: each
// type has a genuinely different column shape (a Test record and a
// Contact record share almost no fields), so a single "all data" CSV
// would either need one row format that's mostly empty cells, or
// silently drop fields — neither is honest. This is also the smallest
// real version of the feature: exactly one file per tap, same shape as
// every other export in this app.

import { buildBackup } from "./backupService.js";
import { exportTextFile } from "./fileExportHelper.js";

// A cell that itself contains a comma, quote, or newline must be
// quoted, with any internal quote doubled — standard CSV escaping
// (RFC 4180). Arrays (e.g. a contact's contactableVia) join into one
// readable cell rather than becoming several columns, since the number
// of items varies per record and CSV has no native concept of a
// nested list. Objects (e.g. a kink selection's {kinkId, role}) fall
// back to their JSON text — rare enough in this app's own data shapes
// that it's not worth a bespoke flattening rule per field.
function csvCell(value) {
  if (value === null || value === undefined) return "";
  let str;
  if (Array.isArray(value)) str = value.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join("; ");
  else if (typeof value === "object") str = JSON.stringify(value);
  else str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

// Column set is the UNION of keys across every record, not just the
// first record's keys — this app's own repositories backfill missing
// fields from each DEFAULT_* shape on read (see e.g. contactRepository.js's
// getAll()), so in practice every record already has the same keys, but
// this is safe either way rather than assuming it.
export function recordsToCSV(records) {
  if (!Array.isArray(records) || records.length === 0) return "";
  const columns = Array.from(records.reduce((set, r) => {
    Object.keys(r || {}).forEach((k) => set.add(k));
    return set;
  }, new Set()));
  const lines = [columns.join(",")];
  records.forEach((r) => lines.push(columns.map((c) => csvCell(r[c])).join(",")));
  return lines.join("\n");
}

// Pulls one record type (by the same `dataKey` values EXPORT_GROUPS
// already uses in backupService.js) and hands it back to the Share
// sheet as a real .csv file. Throws a plain-language error on an empty
// data set instead of exporting a useless header-only file.
// CHANGED 1 Sep 2026 — real ask, item 3 of the follow-up feature list
// completed: accepts the same optional `dateRange` ({ from, to })
// Selective/Encrypted export already got — same contract, buildBackup()
// itself already knows which dataKeys are genuinely dated events and
// leaves the rest (registries, singletons) untouched either way.
export async function exportRecordsAsCSV(dataKey, label, dateRange = null) {
  const { data } = buildBackup([dataKey], dateRange);
  const records = data[dataKey];
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error(dateRange ? `No ${label} in that date range — nothing to export.` : `No ${label} yet — nothing to export.`);
  }
  const csv = recordsToCSV(records);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const safeName = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  await exportTextFile(`shos-${safeName}-${dateStamp}.csv`, csv, "text/csv");
}

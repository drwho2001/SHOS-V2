// recordExportService.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask, 26 Aug 2026: export/print a single record — e.g. a Clinic
// Visit or Test result to hand to a new provider, distinct from a
// full data backup. Triggered from the multi-select toolbar (select
// exactly one record, tap Export), per the user's own placement choice.
//
// Deliberately ONE shared, generic function rather than seven
// hand-built per-module renderers — auto-generates a clean "Label:
// Value" summary from whatever fields the record actually has, with a
// module-specific field blocklist for the genuinely internal/
// technical fields (id, createdAt, sortOrder, isArchived, etc.) that
// nobody exporting a record to show a clinician would want to see.
// This trades some per-module polish for real, working coverage
// across every module in one pass rather than one polished module and
// six unbuilt ones.
import { MODULE_LABELS } from "../repositories/trashRepository";
import { formatStoredDate, formatStoredDateTime } from "../calculations/dateInputHelpers";
import { exportTextFile } from "./fileExportHelper.js";

// Fields never worth showing in an export, regardless of module —
// internal bookkeeping, not information about the actual record.
const ALWAYS_HIDDEN_FIELDS = new Set([
  "id", "createdAt", "updatedAt", "isArchived", "sortOrder", "excludeFromActiveTracking",
  "markedComplete", "favourited", "linkedContactIds", "linkedContactLabels", "profilePicture",
  "attachments", "sourceHash",
]);

function humanizeFieldName(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function formatFieldValue(value) {
  if (value == null || value === "") return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return value.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(", ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return null; // nested objects (e.g. kink role selections) skipped — too structured for a flat summary
  // Looks like an ISO date string — format it readably rather than showing raw
  // ISO text.
  //
  // FIXED 29 Sep 2026 (t020 timezone audit) — TWO bugs in these few lines, both
  // found by running this file's output under several timezones rather than by
  // reading it, which is the only way the second one is visible at all.
  //
  // 1. No `timeZone`, on a value whose digits are literal wall-clock. Every date
  //    field on a stored record is fake-UTC in this app, so a record at 00:30
  //    on 14 Mar exported to 13 Mar in New York. A wrong DATE on a medical
  //    document, not a slightly-off time — and this is the artefact a clinician
  //    is handed.
  //
  // 2. The date-only DETECTION was itself timezone-dependent, which is the part
  //    an eyeball sweep misses because the code looks like it is checking the
  //    stored shape. It asked `d.toTimeString().startsWith("00:00:00")`, i.e.
  //    whether the parsed value is midnight IN THE DEVICE'S OWN ZONE. A
  //    YYYY-MM-DD value parses as UTC midnight, so west of UTC it is the
  //    previous evening and takes the date-time branch — a plain calendar date
  //    gained a time on it purely because of where the user was standing.
  //
  // Both are fixed by using the shape the value was STORED in (`length <= 10`),
  // and the shared helpers, which already carry the UTC treatment and are the
  // one place in this codebase where a stored date is rendered.
  //
  // Worth noting WHY there is no instant-versus-stored ambiguity to resolve
  // here: createdAt/updatedAt are in ALWAYS_HIDDEN_FIELDS, so they are never
  // exported at all. Every date that reaches this function is a stored value.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    if (isNaN(new Date(value).getTime())) return String(value);
    return value.length <= 10 ? formatStoredDate(value) : formatStoredDateTime(value);
  }
  return String(value);
}

export function buildRecordExportHtml(moduleKey, record) {
  const title = record.title || record.name || record.displayName || MODULE_LABELS[moduleKey] || "Record";
  const rows = Object.entries(record)
    .filter(([key]) => !ALWAYS_HIDDEN_FIELDS.has(key))
    .map(([key, value]) => [humanizeFieldName(key), formatFieldValue(value)])
    .filter(([, value]) => value !== null);

  const rowsHtml = rows.map(([label, value]) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#5B5B62;font-size:13px;white-space:nowrap;vertical-align:top;">${label}</td><td style="padding:6px 0;color:#1B1B1F;font-size:13px;">${value}</td></tr>`
  ).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 600px; margin: 40px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .subtitle { color: #656568; font-size: 12px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; }
  tr { border-bottom: 1px solid #EEE; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <h1>${title}</h1>
  <div class="subtitle">${MODULE_LABELS[moduleKey] || moduleKey} · exported ${new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} from SHOS</div>
  <table>${rowsHtml}</table>
</body>
</html>`;
}

// Downloads the record as a standalone HTML file — opens in any
// browser, and that browser's own Print (Ctrl/Cmd+P) handles the
// "print" half of the ask without needing a PDF library bundled into
// the app itself.
export async function exportRecordAsFile(moduleKey, record) {
  const html = buildRecordExportHtml(moduleKey, record);
  const title = (record.title || record.name || record.displayName || "record").replace(/[^a-z0-9]/gi, "-").toLowerCase();
  await exportTextFile(`${title}.html`, html, "text/html");
}

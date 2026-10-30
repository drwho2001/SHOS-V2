// mergeRecordsById.js
//
// WHY THIS IS ITS OWN FILE
// ------------------------
// "Add the backup's records alongside what is already here" is one line of
// intent and one line of code — `[...current, ...incoming]` — and that one
// line was wrong. mergeBackup() used exactly that, so importing the same
// backup twice duplicated every record under its ORIGINAL id. Ids are this
// app's cross-reference keys (an Encounter's attendeeIds, a Clinic Visit's
// linked test, every kink/symptom chip), so the same id appearing three
// times is not harmless clutter: it is the same option rendered three times
// in every picker. The owner's own Kink Registry was 3 copies of each of 78
// entries (228 rows) from this exact path.
//
// Pulled out of backupService.js so the rule can be tested without standing
// up ~30 mocked repositories: ids win, existing records win a clash (they
// may carry local edits made since the backup was taken), records without
// an id are appended rather than silently dropped.

/**
 * @param {Array} current  What is already stored.
 * @param {Array} incoming  What the backup file brings.
 * @returns {Array} current plus only the incoming records whose id is new.
 */
export function mergeRecordsById(current, incoming) {
  const seen = new Set();
  for (const rec of current || []) {
    const id = rec && (rec.id ?? rec.key);
    if (id != null) seen.add(id);
  }
  const out = Array.isArray(current) ? [...current] : [];
  for (const rec of incoming || []) {
    if (!rec || typeof rec !== "object") { out.push(rec); continue; }
    const id = rec.id ?? rec.key;
    if (id == null) { out.push(rec); continue; }
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(rec);
  }
  return out;
}

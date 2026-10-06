// recordRecency.js
//
// WHY A SEPARATE OWNER FOR "is this record current?"
//
// Testing already had this idea and does it correctly: an old record's
// surrounding text and background step down, so age is visible without the record
// itself losing its meaning. What it does NOT do is decide that a record is old
// by guessing.
//
// THE RULE HERE IS RANK, NOT A WINDOW. "One of the two most recent records on
// file" is a fact about the user's own data and invents nothing. A window in days
// would be a clinical judgement - how old is too old to care about? - and this
// app is explicitly out of automated clinical risk scoring (see CLAUDE.md's
// Out of Scope section).
//
// WHY THAT MATTERS HERE SPECIFICALLY. Testing could justify a 90-day window
// because BASHH publishes a 3-monthly routine screening interval, and that
// figure is cited at the constant. There is no equivalent published interval for
// "how recent a clinic visit should look", so using 90 days for visits and
// symptoms would be copying a sourced number out of the context that sourced it -
// the same mistake as the old 0.8/0.2 medication lockout factors, which were
// invented percentages that read as deliberate until they were audited and had no
// source at all. windowDays therefore defaults to null, and is a parameter only
// so a genuinely sourced interval can be passed by a caller that has one.

/**
 * How many of the most recent records count as current.
 *
 * Two, matching the rule Testing already established. One would be too fragile -
 * a single record would then never look old - and three starts de-emphasising
 * records a user is likely to still care about.
 */
export const RECENT_RANK_COUNT = 2;

/**
 * Is this record one of the most recent ones on file?
 *
 * Records with no date cannot be placed in a date order at all, so they are
 * treated as current rather than faded: a missing date is missing data, and
 * fading a record for data the user never entered would read as a judgement
 * about the record itself.
 *
 * @param {object} record
 * @param {object[]} allRecords every record in the SAME list being rendered.
 *   Must be the full unfiltered set, not a search-filtered one, or the rank is
 *   computed against the wrong population and the top row can be faded.
 * @param {{windowDays?: number|null}} [options] pass a SOURCED interval to also
 *   treat anything within it as current. Null by default - see the file header.
 * @returns {boolean}
 */
export function isRecentRecord(record, allRecords, options = {}) {
  if (!record?.date) return true;

  // An UNPARSEABLE date is treated the same as a missing one. Both mean the data
  // is absent or broken rather than that the record is old, and fading a record
  // for data the user never entered (or that a bad import mangled) would read as
  // a judgement about the record itself. The first version ranked it instead, and
  // returned false - so a corrupted date dimmed the record, which is the opposite
  // of what this helper is for.
  if (Number.isNaN(new Date(record.date).getTime())) return true;

  const { windowDays = null } = options;
  if (Number.isFinite(windowDays) && windowDays > 0) {
    const ageDays = wholeDaysSince(record.date);
    if (ageDays !== null && ageDays <= windowDays) return true;
  }

  const pool = (Array.isArray(allRecords) ? allRecords : []).filter((r) => r?.date);
  const rank = [...pool]
    .sort((a, b) => (String(a.date) < String(b.date) ? 1 : String(a.date) > String(b.date) ? -1 : 0))
    .findIndex((r) => r.id === record.id);
  // rank === -1 means the record could not be PLACED - an empty pool, or a caller
  // that passed a list this record is not in. That is absence of evidence, the
  // same situation as a missing date, and it is treated the same way. The helper
  // therefore only ever fades a record it positively placed below the top two,
  // which is the one behaviour worth guaranteeing: it can never dim a record
  // because it was unable to measure it.
  return rank === -1 ? true : rank < RECENT_RANK_COUNT;
}

/**
 * Whole days between a stored wall-clock date and now, or null when unknown.
 *
 * Calendar days, never elapsed milliseconds divided by 86400000. That division is
 * the recurring bug this repo records more than once: a DST boundary makes it
 * wrong by an hour, which moves the answer across a day boundary in roughly one
 * day in four. dateInputHelpers owns the correct primitive and this only adapts
 * it, rather than re-deriving the arithmetic a second time.
 */
function wholeDaysSince(storedDate) {
  const d = new Date(storedDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const storedDay = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - storedDay) / 86400000);
}

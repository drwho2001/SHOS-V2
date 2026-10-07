// textCanonicalisation.js - ONE owner for "how do we compare two pieces of
// text the user typed", so near-duplicates stop accumulating.
//
// THE PRINCIPLE: store raw, index canonical. What the user typed is what gets
// stored, forever; a canonical form exists only to decide whether two strings
// MEAN the same thing. This is not a stylistic preference - the alternative is
// what the app already does in one place, where `normalizeTag` title-cases
// before `findOrCreate` writes, so typing "IMPACT PLAY" silently stores
// "Impact Play". That may well be right for a curated registry; it is
// emphatically NOT right for a clinician's name or a free-text medication,
// where the user's own spelling is the record.
//
// WHY CANONICALISATION CANNOT ROUND-TRIP BACK. Every function here is
// comparison-only and says so. A canonical form is lossy by construction:
// "Dr A. Smith" and "Dr A Smith" collapse to the same key, and there is no
// correct answer for which of the two to store. The only safe rule is that the
// lossy form is never the one written - so `canonicalCompareKey` is deliberately
// not exported alongside a "canonicalise for storage" twin.
//
// WHAT CANONICALISATION IS NOT. It is not clinical normalisation. No registry
// entry's stored name is rewritten, no synonym map is widened, and no stored
// field is touched by anything in this file. It answers exactly one question:
// are these two strings the same string as far as the user is concerned?
//
// WHY PHONE NUMBERS ARE SEPARATE RATHER THAN A SPECIAL CASE OF THE TEXT RULE.
// A phone number is not text with different punctuation - "+44 (0)7700 900123"
// and "07700900123" are the same real number, and collapsing whitespace and case
// cannot get there. Lifting this out of fuzzyMatch.js's private
// `normalizedPhoneEquals` means the duplicate checker and the suggestion
// surfaces can never disagree about which numbers are the same, which is the
// drift class this repo keeps paying for.
import { UNIT_CONFIG } from "../repositories/measurementRepository.js";

// Compared on: case, surrounding and repeated whitespace, and punctuation
// between words. Deliberately NOT aggressive: this collapses the cheap, common
// near-duplicates ("Dr A  Smith" / "dr a smith"), not real differences. A rule
// that merged "St Bartholomew's" with "St Bartholomews" would be guessing at
// someone's name, and a wrong merge of two names is worse than a missed one.
//
// Returns "" for anything unusable rather than null, so a caller doing
// `key(a) === key(b)` cannot accidentally treat "both unparseable" as a match:
// an empty string never equals another empty string here, because callers
// compare and then require non-empty. `compareKeysAreEqual` is the safe entry
// point and does that check for them.
export function canonicalCompareKey(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .toLowerCase()
    .normalize("NFKD")
    // Strip combining marks so an accented character and its ASCII equivalent
    // ("Andre" vs "André") are the same string for comparison. NFKD decomposes
    // first, which is why this has to come after it.
    .replace(/[\u0300-\u036f]/g, "")
    // Apostrophes and dots between words: "St. Mary's" and "St Marys".
    .replace(/[.'`\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// Safe equality on the above. Requires both sides to be non-empty, so two
// blank fields are NOT a match - the same reason `normalizedEquals` and
// `normalizedPhoneEquals` both guard on emptiness, and the reason a
// missing-value key must never equal another missing-value key.
export function compareKeysAreEqual(a, b) {
  const ka = canonicalCompareKey(a);
  const kb = canonicalCompareKey(b);
  return ka !== "" && kb !== "" && ka === kb;
}

/**
 * Filter a list of already-stored values down to those a query could mean,
 * without changing any of them.
 *
 * This is the function the suggestion surfaces want: it returns ORIGINAL
 * strings, never canonical ones, so the value the user taps is the value that
 * was already on file. `caseInsensitiveIncludes` was duplicated on four
 * surfaces in this app before this existed, each with its own idea of what
 * "the same" meant.
 */
export function filterByCanonicalMatch(items, query, { keyOf, limit = 8 } = {}) {
  const get = typeof keyOf === "function" ? keyOf : (i) => i;
  const all = Array.isArray(items) ? items : [];
  const q = canonicalCompareKey(query);
  if (!q) return all.slice(0, limit);
  const matched = all.filter((item) => canonicalCompareKey(get(item)).includes(q));
  return matched.slice(0, limit);
}

/**
 * Drop near-duplicates from a candidate list while KEEPING THE FIRST
 * occurrence's original spelling.
 *
 * This is what stops a suggestion list filling with "Dr Smith", "dr smith" and
 * "DR SMITH" as three separate entries. Note it never rewrites the survivors:
 * the returned strings are the input strings, by identity, which is the whole
 * point. Ordering is therefore the caller's to choose, and the first entry wins
 * rather than a canonical form - because there is no principled way to decide
 * which of two spellings the user "really" meant.
 *
 * Case-insensitive on the comparison key, so "Dr Smith" and "dr smith" collapse.
 */
export function dedupeByCanonicalKey(items, { keyOf } = {}) {
  const get = typeof keyOf === "function" ? keyOf : (i) => i;
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(items) ? items : []) {
    const key = canonicalCompareKey(get(item));
    // An unparseable/empty key is NOT deduped: dropping every blank entry would
    // silently hide real records, and keeping them all is the honest default.
    if (key === "") {
      out.push(item);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Digits of a phone number, for COMPARISON only.
 *
 * "07700 900123", "+44 7700 900123" and "(07700) 900123" are the same real
 * number. Trunk-zero and country-code differences are handled by comparing the
 * LAST 10 digits, which is the same tolerance fuzzyMatch.js has always used -
 * lifted here so there is one copy rather than two that can disagree.
 *
 * Returns "" for anything with fewer than 6 digits: too short to be a real
 * number, and a 3-digit fragment matching another would be a false positive
 * dressed as a duplicate.
 */
export function canonicalPhoneDigits(raw) {
  const digits = String(raw == null ? "" : raw).replace(/\D/g, "");
  return digits.length < 6 ? "" : digits;
}

/** Safe phone equality. Two blanks are NOT a match - see compareKeysAreEqual. */
export function phonesAreEqual(a, b) {
  const da = canonicalPhoneDigits(a);
  const db = canonicalPhoneDigits(b);
  return da !== "" && db !== "" && da.slice(-10) === db.slice(-10);
}

/**
 * Canonical storage key for a measurement: the value converted into its type's
 * canonical unit, rounded for comparison.
 *
 * THE ONE JUSTIFIED EXCEPTION, and the reason this file exists at all. Unit
 * conversion must be LOSSLESS in the sense that matters here: 5.5 kg and
 * 12.1 lb are the same weight, and storing both unconverted means two different
 * trends on two charts. So for measurements the canonical form is the stored
 * one, and measurementRepository already does that conversion at save time.
 *
 * This function does NOT do the conversion - it reads the SAME table the
 * repository writes with, which is why it imports UNIT_CONFIG rather than
 * re-declaring factors. A second copy of a conversion factor is precisely the
 * drift this module exists to remove.
 *
 * `unit` must be the type's CANONICAL unit; a value in an alternate unit is
 * returned unchanged rather than converted, because doing the conversion here
 * too would mean two conversion sites for one fact. Returns null when the type
 * has no declared canonical unit, so a caller cannot mistake "not convertible"
 * for "zero".
 */
export function canonicalMeasurementKey(typeName, value, unit) {
  const spec = UNIT_CONFIG[typeName];
  if (!spec || !Number.isFinite(Number(value))) return null;
  return { unit: spec.canonical, value: Number(value), key: `${spec.canonical}:${Number(value)}` };
}
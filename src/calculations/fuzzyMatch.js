// fuzzyMatch.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask: does Global Search tolerate typos, not just case? Before
// this, no — it was a plain case-insensitive substring check
// (`.includes()`), which handles "FISTING" vs "fisting" fine but not
// "fistng" vs "fisting". This adds a real, bounded fallback: if the
// exact substring check fails, fall back to word-level fuzzy matching
// using Levenshtein edit distance.
//
// DELIBERATE SCOPE LIMITS, stated plainly rather than oversold as a
// full fuzzy search engine:
// - The exact substring check ALWAYS runs first and is authoritative
//   when it matches — fuzzy matching is a fallback for near-misses,
//   never a replacement for exact matching, so nothing that used to
//   match now matches differently.
// - Multi-word queries use AND semantics — every word in the query
//   must fuzzily match something in the record, not just any one of
//   them. A query like "fisitng top" shouldn't loosely match a record
//   that only has "top" somewhere unrelated.
// - Short words (3 characters or fewer) require an EXACT match, not
//   fuzzy — "hi" fuzzily matching half the alphabet's worth of 2-3
//   letter substrings would make search noisy rather than more useful.
//   The allowed edit distance scales up gently with word length
//   instead (1 for medium words, 2 for longer ones), so a genuine
//   near-miss typo on a real word gets caught without over-matching.
function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) matrix[i][0] = i;
  for (let j = 0; j < cols; j++) matrix[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // deletion
        matrix[i][j - 1] + 1,     // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return matrix[rows - 1][cols - 1];
}

function maxAllowedDistance(wordLength) {
  if (wordLength <= 3) return 0;
  if (wordLength <= 6) return 1;
  return 2;
}

function tokenize(text) {
  return (text || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

// ADDED — real ask: a "did you mean...?" suggestion when what someone
// typed is close to but not exactly an existing entry (a likely typo),
// so it can be offered as a choice instead of silently creating a
// near-duplicate. Different job from fuzzyIncludes above (which checks
// "does this record's text contain something close to the query") —
// this instead finds the single best-matching EXISTING name for a
// piece of typed text, or returns null if nothing is close enough to
// be worth suggesting.
// FIXED — real bug found in testing: findDuplicatePairs below
// originally reused this same per-word-length threshold, which is
// tuned for ONE TYPED WORD against a candidate — applied to whole
// multi-word registry names instead, it flagged things like "Car play"
// vs "Wax play" or "Fisting" vs "Figging" as likely duplicates purely
// because they share a common suffix, which is real noise, not a real
// near-duplicate. findDuplicatePairs now uses its own ratio-based
// threshold (distance relative to name length) instead of this one.
export function findClosestMatch(candidateNames, typedText) {
  const normTyped = (typedText || "").trim().toLowerCase();
  if (!normTyped) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const candidate of candidateNames) {
    const normCandidate = candidate.trim().toLowerCase();
    if (normCandidate === normTyped) return null; // exact match isn't a "suggestion", caller should have already handled this
    const threshold = maxAllowedDistance(Math.min(normTyped.length, normCandidate.length));
    if (threshold === 0) continue; // too short to safely suggest, same reasoning as fuzzyIncludes
    const distance = levenshteinDistance(normTyped, normCandidate);
    if (distance <= threshold && distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

// ADDED — real ask: "add button to check through registries or
// whatever to check for duplicates using fuzzy matching or similar.
// Allows for if accidental dupes manually committed so user doesn't
// have to dig." Different direction from findClosestMatch above (typed
// text vs the existing list) — this instead checks a whole list
// against ITSELF, pairwise, surfacing any two existing entries that are
// near-duplicates of each other. Same threshold/normalization rules as
// the rest of this file, so "likely duplicate" means exactly what a
// "did you mean...?" prompt would have caught if one entry had been
// typed right after the other — this is a scan for dupes that got past
// that check (e.g. restored from an old backup, or typed far enough
// apart that neither commit saw the other yet). Flags pairs for a
// human to review and merge/rename/archive — same "never silently
// merge" restraint RegistryManagementScreen's own header comment
// already states for why merge itself isn't built.
// FIXED — real bug found in testing: reusing maxAllowedDistance()
// (tuned for a single typed word vs one candidate) here flagged
// obviously-unrelated multi-word registry entries as "duplicates"
// purely from a shared word ("Car play"/"Wax play", "Fisting"/
// "Figging") — too noisy to be useful for "so the user doesn't have to
// dig". A relative threshold (edit distance as a fraction of the
// longer name's length) scales correctly regardless of word count:
// "Rimmingg"/"Rimming" (1 char off an 8-char word, ~12%) still flags;
// "Car play"/"Wax play" (2 chars off 8, 25%) no longer does. Short
// names (under 5 characters) are skipped entirely, same reasoning as
// maxAllowedDistance's own short-word exclusion above — too easy for
// two genuinely different short words to land within 20% of each
// other by coincidence.
const DUPLICATE_RATIO_THRESHOLD = 0.2;
const DUPLICATE_MIN_LENGTH = 5;
export function findDuplicatePairs(entries) {
  const pairs = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const nameA = (entries[i].name || "").trim().toLowerCase();
      const nameB = (entries[j].name || "").trim().toLowerCase();
      if (!nameA || !nameB) continue;
      if (nameA === nameB) { pairs.push({ a: entries[i], b: entries[j], distance: 0 }); continue; }
      const longer = Math.max(nameA.length, nameB.length);
      if (longer < DUPLICATE_MIN_LENGTH) continue;
      const distance = levenshteinDistance(nameA, nameB);
      if (distance / longer <= DUPLICATE_RATIO_THRESHOLD) pairs.push({ a: entries[i], b: entries[j], distance });
    }
  }
  return pairs.sort((x, y) => x.distance - y.distance);
}

// ADDED — real ask: Contacts carry a genuinely different duplicate
// risk than the 6 name-only registries above — the SAME real person
// could plausibly get re-added under a different-looking name/
// nickname, but share an unmistakable identifier (the same phone
// number, the same Snapchat handle) that name similarity alone would
// never catch. This widens the signal set specifically for Contacts,
// SCORED rather than binary — "more matching fields = more
// confidence", the user's own framing for this — but still never a
// verdict: same "flag for a human to review, never silently merge"
// restraint as findDuplicatePairs above. Deliberately kept separate
// from findDuplicatePairs rather than generalizing that one — the 6
// shared registries only ever have a name to compare, so bolting
// Contact-only fields onto a function they all share would be the
// wrong direction to extend it in.
function normalizedEquals(a, b) {
  const na = (a || "").trim().toLowerCase();
  const nb = (b || "").trim().toLowerCase();
  return na !== "" && nb !== "" && na === nb;
}

// Phone numbers get their own normalization — "07700 900123" and
// "+44 7700 900123" are the same real number typed two different
// ways; formatting-only differences shouldn't hide an otherwise exact
// match. Matches on the last 10 digits, tolerating a leading country
// code or trunk 0 differing between two entries for the same number.
function normalizedPhoneEquals(a, b) {
  const digitsA = (a || "").replace(/\D/g, "");
  const digitsB = (b || "").replace(/\D/g, "");
  if (digitsA.length < 6 || digitsB.length < 6) return false; // too short to be a meaningful match
  return digitsA.slice(-10) === digitsB.slice(-10);
}

function namesLikelyMatch(a, b) {
  const na = (a || "").trim().toLowerCase();
  const nb = (b || "").trim().toLowerCase();
  if (!na || !nb) return false;
  if (na === nb) return true;
  const longer = Math.max(na.length, nb.length);
  if (longer < DUPLICATE_MIN_LENGTH) return false;
  return levenshteinDistance(na, nb) / longer <= DUPLICATE_RATIO_THRESHOLD;
}

// Deliberately crude, not real NLP — "light compare", the user's own
// phrasing for this. Two contacts' free-text notes sharing a few
// genuinely distinctive (4+ letter) words is a soft signal worth
// folding into the score, not something worth building real text
// similarity for.
function notesLightlyOverlap(a, b) {
  const wordsA = new Set((a || "").toLowerCase().match(/[a-z']{4,}/g) || []);
  const wordsB = new Set((b || "").toLowerCase().match(/[a-z']{4,}/g) || []);
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let shared = 0;
  wordsA.forEach((w) => { if (wordsB.has(w)) shared += 1; });
  return shared >= 2;
}

const APPROX_AGE_TOLERANCE = 2;

export function findContactDuplicateCandidates(contacts) {
  const candidates = [];
  for (let i = 0; i < contacts.length; i++) {
    for (let j = i + 1; j < contacts.length; j++) {
      const a = contacts[i], b = contacts[j];
      const matched = [];

      const nameMatch = namesLikelyMatch(a.name, b.name) || namesLikelyMatch(a.nickname, b.nickname) ||
        namesLikelyMatch(a.name, b.nickname) || namesLikelyMatch(a.nickname, b.name);
      if (nameMatch) matched.push("name");

      const strongFields = [
        ["phone", normalizedPhoneEquals(a.phone, b.phone)],
        ["Snapchat", normalizedEquals(a.snapchat, b.snapchat)],
        ["Recon", normalizedEquals(a.recon, b.recon)],
        ["FabGuys", normalizedEquals(a.fabguys, b.fabguys)],
        ["FabSwingers", normalizedEquals(a.fabswingers, b.fabswingers)],
      ];
      const strongMatches = strongFields.filter(([, isMatch]) => isMatch).map(([label]) => label);
      matched.push(...strongMatches);

      // Nothing to flag at all unless there's at least one real
      // identifying signal — sharing just a city or a rough age is
      // not remotely suspicious on its own, only worth folding in
      // once something else already put this pair in question.
      if (!nameMatch && strongMatches.length === 0) continue;

      const lightFields = [
        ["city", normalizedEquals(a.city, b.city)],
        ["address", normalizedEquals(a.address, b.address)],
        ["approx. age", a.age != null && b.age != null && Math.abs(a.age - b.age) <= APPROX_AGE_TOLERANCE],
        ["notes", notesLightlyOverlap(a.notes, b.notes)],
      ];
      const lightMatches = lightFields.filter(([, isMatch]) => isMatch).map(([label]) => label);
      matched.push(...lightMatches);

      // Confidence is a read on how many independent reasons point the
      // same way — never a verdict. Even "High" here just means
      // "worth a human actually looking", same restraint as
      // findDuplicatePairs' own "nothing is merged automatically".
      let confidence;
      if (strongMatches.length > 0 || (nameMatch && lightMatches.length >= 2)) confidence = "High";
      else if (nameMatch && lightMatches.length >= 1) confidence = "Medium";
      else confidence = "Low";

      candidates.push({ a, b, confidence, matched });
    }
  }
  const order = { High: 0, Medium: 1, Low: 2 };
  return candidates.sort((x, y) => order[x.confidence] - order[y.confidence]);
}

// The real function Global Search actually calls. `searchText` is the
// full record's indexed text (name, notes, resolved kink names, etc.),
// `query` is exactly what's typed into the search box.
export function fuzzyIncludes(searchText, query) {
  const normText = (searchText || "").toLowerCase();
  const normQuery = (query || "").trim().toLowerCase();
  if (!normQuery) return false;

  // Exact substring match — the original, fast, authoritative check.
  if (normText.includes(normQuery)) return true;

  // Fuzzy fallback, word-level, AND semantics across query words.
  const queryWords = tokenize(normQuery);
  if (queryWords.length === 0) return false;
  const textWords = tokenize(normText);

  // FIXED 4 Sep 2026 — real, confirmed bug found from a live device
  // report ("searched 'piss', got records that never mention it"):
  // this file's own header comment above already documents the
  // intended rule — "short words (3 characters or fewer) require an
  // EXACT match, not fuzzy" — but the substring shortcut below ran
  // BEFORE that rule was ever checked, with no length floor at all.
  // `qWord.includes(tWord)` in particular means the QUERY containing
  // ANY short word anywhere in a record's own text counts as a match
  // — and "piss" itself contains "i", one of the single most common
  // standalone words in ordinary written English (as in "I felt..."),
  // so almost any record with free-text notes would eventually match
  // almost any query by sheer coincidence. Reproduced directly:
  // fuzzyIncludes("i felt off today", "piss") was returning true.
  // Now the substring shortcut only fires once the SHORTER of the two
  // words clears the same length floor the Levenshtein fallback
  // already used — "fist" still correctly matches "fisting" (shorter
  // word is 4 letters), but a lone "a"/"i"/"s" no longer silently
  // matches everything just because it's a literal substring of
  // whatever was typed.
  return queryWords.every((qWord) =>
    textWords.some((tWord) => {
      const shorterLen = Math.min(qWord.length, tWord.length);
      if (shorterLen > 3 && (tWord.includes(qWord) || qWord.includes(tWord))) return true;
      const threshold = maxAllowedDistance(shorterLen);
      return threshold > 0 && levenshteinDistance(qWord, tWord) <= threshold;
    })
  );
}

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

  return queryWords.every((qWord) =>
    textWords.some((tWord) => {
      if (tWord.includes(qWord) || qWord.includes(tWord)) return true;
      const threshold = maxAllowedDistance(Math.min(qWord.length, tWord.length));
      return threshold > 0 && levenshteinDistance(qWord, tWord) <= threshold;
    })
  );
}

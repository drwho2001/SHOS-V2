// episodeCalculations.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Pure derivation for episodes: what state an episode is in, and how to describe
// that state. No I/O, no storage, no React.
//
// WHY THIS FILE EXISTS
// --------------------
// Added 30 Sep 2026 by the t053 "one owner per derived fact" audit, which found
// "is this episode open?" spelled four different ways inside a single file:
//
//   SHOS_Timeline_Prototype.jsx:502   !episode.resolvedDate      (detail)
//   SHOS_Timeline_Prototype.jsx:801   !e.resolvedDate            (card)
//   :721   (a.resolvedDate ? 1 : 0)                            (sort key)
//   :749   e.resolvedDate ? ... : "Open"                        (group key)
//
// All four were truthiness tests on `resolvedDate`, so they AGREED - this was a
// latent split-brain, not a live bug, and it is recorded as such rather than
// dressed up as a defect. It was still worth collapsing, for the reason this
// project keeps rediscovering: a set of spellings that agree today agrees by
// coincidence, and the first one to change diverges silently.
//
// The user-visible status string was additionally duplicated verbatim between the
// detail view (:580) and the card (:818), which is the same drift the icon-only
// and palette audits each found independently.
//
// THE HAZARD WORTH NAMING
// -----------------------
// Every one of the old spellings was a TRUTHINESS test. That means any non-empty
// string counts as resolved - so `"0"`, or whitespace left behind by a
// half-cleared date field, would sort an episode into the resolved group under a
// date that then renders as garbage. `isEpisodeResolved` therefore tests that the
// value is a real, parseable date rather than merely present. That is a genuine
// (if narrow) tightening, and it is the one behavioural change here.

/**
 * The date an episode was resolved, or null when it is still open.
 *
 * Returns null for a present-but-unparseable value rather than propagating it,
 * so a malformed field reads as "still open" instead of sorting a real episode
 * into the wrong group under a date that renders as "Invalid Date".
 *
 * @param {object} episode
 * @returns {string|null} the stored day key, or null when open/unusable
 */
export function episodeResolvedDayKey(episode) {
  if (!episode) return null;
  const raw = episode.resolvedDate;
  if (typeof raw !== "string" || raw.trim() === "") return null;
  // A bare "YYYY-MM-DD" is what the date input produces; anything unparseable is
  // treated as absent rather than trusted.
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return raw;
}

/**
 * Whether an episode is still open. The single definition of the concept.
 *
 * @param {object} episode
 * @returns {boolean}
 */
export function isEpisodeOpen(episode) {
  return episodeResolvedDayKey(episode) === null;
}

/**
 * Whether an episode has been resolved. Exactly `!isEpisodeOpen`, kept as a named
 * export because the sort and group keys read far better in the resolved form,
 * and having both invites the two to drift.
 *
 * @param {object} episode
 * @returns {boolean}
 */
export function isEpisodeResolved(episode) {
  return !isEpisodeOpen(episode);
}

/**
 * Sort/group key placing open episodes first, newest first within each group.
 *
 * Preserves the previous behaviour exactly: open before resolved, then by start
 * date descending.
 *
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
export function compareEpisodesOpenFirst(a, b) {
  const openA = isEpisodeOpen(a) ? 0 : 1;
  const openB = isEpisodeOpen(b) ? 0 : 1;
  if (openA !== openB) return openA - openB;
  return new Date(b._date) - new Date(a._date);
}

/**
 * The user-visible status for an episode - one string, one owner.
 *
 * `hasPositive` is passed in rather than derived here: whether an episode links a
 * positive result is a question about the episode's linked tests, which the
 * Timeline already loads. This function must not start loading them.
 *
 * `showResolution` exists because the two former call sites genuinely differ: the
 * DETAIL view appended `- ${resolution}` and the CARD did not. My first version
 * appended the resolution only when non-empty, which would have quietly changed
 * the detail view's output from "Resolved 5 Mar 2026 - " (trailing dash, empty
 * text) to "Resolved 5 Mar 2026". That may be the better rendering, but it is a
 * presentation change and this audit does not get to make those silently - so
 * the difference is now an explicit argument instead of an accident of which
 * line someone edited.
 *
 * @param {object} episode
 * @param {boolean} hasPositive whether a linked test came back positive
 * @param {(dayKey: string) => string} formatDate renders a day key
 * @param {{ showResolution?: boolean }} [options]
 * @returns {string}
 */
export function episodeStatusLabel(episode, hasPositive, formatDate, options = {}) {
  const { showResolution = false } = options;
  if (isEpisodeOpen(episode)) {
    return hasPositive ? "Open \u00b7 positive result found" : "Open";
  }
  const dayKey = episodeResolvedDayKey(episode);
  const when = formatDate ? formatDate(dayKey) : dayKey;
  // The separator is an EM DASH (U+2014), matching the string this function
  // replaced. My first version used a plain hyphen and silently changed a
  // user-visible character — caught by asserting the exact old literal in the
  // test rather than by reading the diff, which is the only reason it was caught
  // at all. Written as an escape so the character cannot be lost to an editor or
  // a re-encode.
  const why = showResolution ? ` \u2014 ${episode && episode.resolution ? episode.resolution : ""}` : "";
  return `Resolved ${when}${why}`;
}

/**
 * Group key for the desktop month-grouped list: every open episode collapses into
 * one "Open" group, resolved ones group by the month they were resolved.
 *
 * @param {object} episode
 * @param {(dayKey: string) => string} monthLabel renders a month heading
 * @returns {string}
 */
export function episodeGroupKey(episode, monthLabel) {
  if (isEpisodeOpen(episode)) return "Open";
  return monthLabel ? monthLabel(episodeResolvedDayKey(episode)) : "";
}

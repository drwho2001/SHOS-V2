// backNavigation.js — the two decisions behind "get back to where you came
// from", extracted as pure functions so they can be unit-tested at all.
//
// WHY THIS IS A FILE AND NOT INLINE JSX: both of these were previously
// expressed only as an if/else chain inside App.jsx's goBackOneLevel, and as
// a pile of `&&` conditions in a render. Neither is reachable from a unit
// test, and this repo has a documented history of real navigation bugs
// surviving the build, lint, 295 unit tests and 17 smoke flows precisely
// because they lived in render code (see docs/CHANGE-PROCEDURE.md §2).
//
// The decisions themselves are small. What is NOT small is the ORDERING,
// which is the whole substance of the feature and the easiest thing in the
// app to get quietly wrong.

// What "go back one level" decided to do. Returned as a string rather than
// performed as a side effect, so App.jsx stays the only place that touches
// state and this file stays pure.
export const BACK_ACTION = {
  // The active module handled it itself (closing one of its own sheets or
  // popping one of its own internal screens).
  MODULE: "module",
  SETTINGS: "settings",
  SEARCH: "search",
  // Return to the tab Clinic Card was opened from.
  CLINIC_CARD: "clinic-card",
  // Reopen Global Search with the query that produced the record now open.
  SEARCH_RETURN: "search-return",
  // Fall back to Home, because we are on some other tab.
  HOME: "home",
  // Nothing left to go back to — the caller shows the "press back again to
  // exit" toast.
  NONE: "none",
};

/**
 * Decide what one "back" does.
 *
 * @param {object} state
 * @param {boolean} state.moduleHandled  the active module's own back handler
 *   already consumed this press.
 * @param {boolean} state.showSettings   the Settings overlay is open.
 * @param {boolean} state.showSearch     the Global Search overlay is open.
 * @param {boolean} state.hasClinicCardReturn  a record opened from Clinic Card
 *   is on screen with its return tab still recorded.
 * @param {boolean} state.hasSearchReturn  a record opened from a Global Search
 *   result is on screen with its query still recorded.
 * @param {string}  state.active        the current bottom-nav tab key.
 * @returns {string} one of BACK_ACTION
 */
export function decideBackAction(state) {
  const {
    moduleHandled,
    showSettings,
    showSearch,
    hasClinicCardReturn,
    hasSearchReturn,
    active,
  } = state;

  // 1. The module's own handler always wins. It is the most local decision
  //    available: a sheet open on top of a detail view should close the
  //    sheet, not teleport the user to another tab.
  if (moduleHandled) return BACK_ACTION.MODULE;

  // 2 & 3. Overlays, nearest-last-opened first in practice — but both are
  //    mutually exclusive in the UI, so the order between them is not
  //    load-bearing. They sit above <main>, so they must close before
  //    anything underneath them is touched.
  if (showSettings) return BACK_ACTION.SETTINGS;
  if (showSearch) return BACK_ACTION.SEARCH;

  // 4 & 5. Return-to-where-you-came-from. Deliberately AFTER the module's own
  //    handler above, for the same reason the Clinic Card return already is:
  //    an in-module back (a record's detail view popping back to its list) is
  //    the more immediate, more local truth. Reaching a search result and
  //    then backing out to the module's list is not a wrong answer, it is
  //    just one step short of the answer the user actually wanted — which is
  //    why the on-screen "back to search results" affordance exists
  //    alongside this, and why it is the primary path rather than the
  //    fallback.
  //
  //    These two are mutually exclusive by construction, not by luck: a
  //    navigation clears the search-return context unless it *came* from a
  //    search, and Clinic Card's own navigation is not a search. So the order
  //    between them is arbitrary and does not need to be defended.
  if (hasClinicCardReturn) return BACK_ACTION.CLINIC_CARD;
  if (hasSearchReturn) return BACK_ACTION.SEARCH_RETURN;

  // 6. Plain "not on Home" fallback.
  if (active !== "home") return BACK_ACTION.HOME;

  // 7. On Home with nothing open: the caller owns the double-press-to-exit.
  return BACK_ACTION.NONE;
}

/**
 * Whether to show the "back to search results" affordance over the current
 * screen.
 *
 * A record is not necessarily a leaf: the user can be deep inside a module
 * (a detail view, an edit sheet) with the search-return context still
 * recorded. The affordance stays correct there — it is a route back to a
 * screen, not a claim about where the user "is". What it must NOT do is
 * float over another overlay, because the record it refers to is behind that
 * overlay and unreachable, so the button would offer a destination the user
 * cannot see they are returning to.
 *
 * @param {object} state
 * @param {object|null} state.searchReturn  the recorded search-return
 *   context ({ query, sortMode }), or null when there is nothing to return to.
 * @param {boolean} state.showSearch
 * @param {boolean} state.showSettings
 * @param {boolean} state.showTour
 * @param {boolean} state.showAppLockPrompt
 * @param {boolean} state.showImportModeDialog
 * @param {boolean} state.pendingEncryptedEnvelope
 * @returns {boolean}
 */
export function shouldOfferSearchReturn(state) {
  const {
    searchReturn,
    showSearch,
    showSettings,
    showTour,
    showAppLockPrompt,
    showImportModeDialog,
    pendingEncryptedEnvelope,
  } = state;

  if (!searchReturn) return false;
  if (showSearch) return false;
  if (showSettings) return false;
  if (showTour) return false;
  if (showAppLockPrompt) return false;
  if (showImportModeDialog) return false;
  if (pendingEncryptedEnvelope) return false;
  return true;
}

/**
 * Build the context to record when navigating to a record.
 *
 * The load-bearing rule is that this is called from the ONE navigation
 * chokepoint every record link in the app goes through, with an explicit
 * "this came from search" argument that only Global Search passes. A
 * navigation that did NOT come from a search therefore records `null` and
 * clears any context left over from an earlier one — which is what stops a
 * stale "back to search results" button from following the user around the
 * app hours later, pointing at a query for a screen they left long ago.
 *
 * An empty/whitespace query is normalised to `null` for the same reason: a
 * result can only have been tapped from a search that had a query, so a
 * blank one is not a real return point, and treating it as one would put a
 * "back to search results" button on screen pointing at an empty search.
 *
 * @param {string|undefined|null} query  the query typed, if from search.
 * @param {string|undefined|null} sortMode  the active sort, if from search.
 * @returns {{ query: string, sortMode: string }|null}
 */
export function buildSearchReturn(query, sortMode) {
  if (typeof query !== "string") return null;
  const trimmed = query.trim();
  if (!trimmed.length) return null;
  // An unrecognised sort mode falls back to the screen's own default rather
  // than being passed through, so a context from an older build cannot put
  // the results into a sort order the screen has no chip for.
  return { query: trimmed, sortMode: sortMode === "alphabetical" ? "alphabetical" : "chronological" };
}

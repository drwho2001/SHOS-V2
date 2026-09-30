// backNavigation.test.js — unit tests for the two pure decisions behind
// Phase 2b search back-navigation (see backNavigation.js).
//
// WHY THESE ARE UNIT TESTS AND NOT A SOURCE CHECK: unlike the overlay-closing
// wiring in recordNavigationWiring.test.js, this logic is no longer trapped in
// JSX — it was deliberately extracted into backNavigation.js precisely so it
// could be tested behaviourally. A source check here would be checking that a
// function still contains the words it contained, which proves nothing about
// whether it makes the right decision.
//
// Every case below is a case where getting the ORDER wrong produces a real,
// user-visible wrong answer, which is why the ordering is asserted so
// heavily rather than just the happy path.
import { describe, it, expect } from "vitest";
import { decideBackAction, shouldOfferSearchReturn, buildSearchReturn, BACK_ACTION } from "./backNavigation";

/** A back press from an ordinary screen, with everything else switched off. */
const base = {
  moduleHandled: false,
  showSettings: false,
  showSearch: false,
  hasClinicCardReturn: false,
  hasSearchReturn: false,
  active: "contacts",
};

describe("decideBackAction", () => {
  it("dismisses the import modal before anything underneath it", () => {
    // t038. This is the "level-skipping overlay" half of the 25 Sep finding,
    // confirmed by reading the render rather than trusted from the note. The
    // "Import backup" dialog is a full-screen role="dialog" at zIndex 998, and it
    // was not in this chain at all — so back fell through to HOME, switching tab
    // while the modal stayed on screen, still blocking the tab the user landed
    // on. The user would have to find the X or tap the backdrop to escape.
    expect(decideBackAction({ ...base, active: "contacts", showImportDialog: true }))
      .toBe(BACK_ACTION.IMPORT_DIALOG);
    // On Home too, which is where the old fall-through landed.
    expect(decideBackAction({ ...base, active: "home", showImportDialog: true }))
      .toBe(BACK_ACTION.IMPORT_DIALOG);
    // And it outranks the tab change in both directions.
    expect(decideBackAction({ ...base, active: "medication", showImportDialog: true, hasClinicCardReturn: true }))
      .toBe(BACK_ACTION.IMPORT_DIALOG);
  });

  it("still prefers the module's own handler and the other overlays over it", () => {
    // A module sheet open with the import modal up is a combination the UI does
    // not currently produce, but the ORDERING must not regress: the module's own
    // handler is the more local decision, and Settings/Search sit above <main>.
    expect(decideBackAction({ ...base, moduleHandled: true, showImportDialog: true }))
      .toBe(BACK_ACTION.MODULE);
    expect(decideBackAction({ ...base, showSettings: true, showImportDialog: true }))
      .toBe(BACK_ACTION.SETTINGS);
    expect(decideBackAction({ ...base, showSearch: true, showImportDialog: true }))
      .toBe(BACK_ACTION.SEARCH);
  });

  it("behaves exactly as before when no import modal is open", () => {
    // Guards against the new branch leaking into unrelated paths.
    expect(decideBackAction({ ...base, active: "contacts" })).toBe(BACK_ACTION.HOME);
    expect(decideBackAction({ ...base, active: "home" })).toBe(BACK_ACTION.NONE);
  });

  it("goes home from another tab, and does nothing from home", () => {
    expect(decideBackAction({ ...base, active: "contacts" })).toBe(BACK_ACTION.HOME);
    // The "nothing left" case is what makes the caller show the
    // press-back-again-to-exit toast. If this returned HOME on home, the app
    // could never ask to exit.
    expect(decideBackAction({ ...base, active: "home" })).toBe(BACK_ACTION.NONE);
  });

  it("lets the active module's own handler outrank everything", () => {
    // This is the ordering that matters most and is easiest to break. A
    // sheet open on top of a detail view must close the sheet; if the
    // return-to-search branch were checked first, pressing back with a
    // sheet open would throw the sheet away and jump tabs.
    expect(
      decideBackAction({
        ...base,
        moduleHandled: true,
        showSettings: true,
        showSearch: true,
        hasClinicCardReturn: true,
        hasSearchReturn: true,
      })
    ).toBe(BACK_ACTION.MODULE);
  });

  it("closes the Settings overlay before touching anything underneath it", () => {
    expect(
      decideBackAction({ ...base, showSettings: true, hasSearchReturn: true })
    ).toBe(BACK_ACTION.SETTINGS);
  });

  it("closes the search overlay itself before returning to search results", () => {
    // While the restored search is OPEN, back must close it — not re-open
    // it, and not fall through to Home. Getting this wrong makes back a
    // no-op that silently does nothing.
    expect(
      decideBackAction({ ...base, showSearch: true, hasSearchReturn: true })
    ).toBe(BACK_ACTION.SEARCH);
  });

  it("returns to the search results rather than to Home", () => {
    expect(
      decideBackAction({ ...base, active: "healthcare", hasSearchReturn: true })
    ).toBe(BACK_ACTION.SEARCH_RETURN);
    // And specifically NOT home: this is the entire bug being fixed.
    expect(decideBackAction({ ...base, active: "healthcare", hasSearchReturn: true }))
      .not.toBe(BACK_ACTION.HOME);
  });

  it("still returns to Clinic Card's tab, unchanged by the new branch", () => {
    // Regression guard on the 15 Sep fix, which this refactor had to
    // preserve rather than replace.
    expect(
      decideBackAction({ ...base, active: "medication", hasClinicCardReturn: true })
    ).toBe(BACK_ACTION.CLINIC_CARD);
  });

  it("goes Home when there is no recorded origin at all", () => {
    expect(
      decideBackAction({ ...base, active: "activity", hasSearchReturn: false, hasClinicCardReturn: false })
    ).toBe(BACK_ACTION.HOME);
  });
});

describe("shouldOfferSearchReturn", () => {
  const overlaysOff = {
    searchReturn: { query: "gonorrhoea", sortMode: "chronological" },
    showSearch: false,
    showSettings: false,
    showTour: false,
    showAppLockPrompt: false,
    showImportModeDialog: false,
    pendingEncryptedEnvelope: false,
  };

  it("shows the affordance over the record a result opened", () => {
    expect(shouldOfferSearchReturn(overlaysOff)).toBe(true);
  });

  it("shows nothing when there is no search to return to", () => {
    // The clearing half. A navigation that did not come from search records
    // null, and the button must disappear with it rather than following the
    // user around the app for the rest of the session.
    expect(shouldOfferSearchReturn({ ...overlaysOff, searchReturn: null })).toBe(false);
  });

  it("hides over every other overlay", () => {
    // Each of these renders ABOVE <main>, so the record the button refers to
    // is behind it. Offering a route back to a screen the user cannot see
    // they are on is worse than not offering it.
    for (const key of [
      "showSearch",
      "showSettings",
      "showTour",
      "showAppLockPrompt",
      "showImportModeDialog",
      "pendingEncryptedEnvelope",
    ]) {
      expect(shouldOfferSearchReturn({ ...overlaysOff, [key]: true }), `${key} should suppress it`).toBe(false);
    }
  });
});

describe("buildSearchReturn", () => {
  it("keeps a real query, trimmed, with its sort", () => {
    expect(buildSearchReturn("  gonorrhoea ", "alphabetical")).toEqual({
      query: "gonorrhoea",
      sortMode: "alphabetical",
    });
  });

  it("records nothing for a navigation that did not come from a search", () => {
    // Every record link in the app other than Global Search's calls
    // navigateToRecord with no fourth argument. This is the line that stops
    // a stale search-return button outliving its screen.
    expect(buildSearchReturn(undefined, undefined)).toBeNull();
    expect(buildSearchReturn(null, null)).toBeNull();
  });

  it("records nothing for a blank query", () => {
    // A result can only be tapped from a search that had a query, so a blank
    // one is not a real return point — and treating it as one would put a
    // "back to search results" button on screen pointing at an empty search.
    expect(buildSearchReturn("", "chronological")).toBeNull();
    expect(buildSearchReturn("   ", "chronological")).toBeNull();
  });

  it("falls back to the default sort for an unrecognised mode", () => {
    // A context from an older build must not be able to put the results into
    // a sort order the screen has no chip for.
    expect(buildSearchReturn("x", "nonsense").sortMode).toBe("chronological");
  });
});

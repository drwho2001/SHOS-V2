// searchBackNavigationWiring.test.js — source-level guard for the Phase 2b
// wiring.
//
// backNavigation.test.js proves the decisions are right. It CANNOT prove they
// are reached: this app has already shipped a full Escape-handling feature
// whose hook worked perfectly in unit tests while a sweep silently failed to
// attach it to two of the components that mattered most, and separately a
// palette scanner that reported "no regressions" from a detector which had
// never fired once. The general lesson recorded in CLAUDE.md is that a
// passing result is not evidence until you have read what it reported, and
// that wiring is exactly the class of thing a behavioural unit test cannot
// see.
//
// So: the pure logic is unit-tested, and the wiring is checked here. Every
// negative check below runs against comment-stripped source, because this
// repo's comments record what a bug WAS by quoting the defective line
// verbatim — which is what makes them valuable, and exactly what makes a raw
// substring check report a fixed bug as still present. That has now bitten
// two separate guards in one session, so the stripper is itself proven
// non-vacuous at the end.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const APP = readFileSync(path.join(process.cwd(), "src", "App.jsx"), "utf8");
const SEARCH = readFileSync(
  path.join(process.cwd(), "src", "modules", "SHOS_GlobalSearch_Prototype.jsx"),
  "utf8"
);

/** Source with `//` line comments removed (see the header note). */
function stripComments(src) {
  return src
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");
}
const APP_CODE = stripComments(APP);
const SEARCH_CODE = stripComments(SEARCH);

/** The body of `const <name> = (…) => {` in `src`, up to its first `\n  };`. */
function bodyOf(src, name) {
  const start = src.indexOf(`const ${name}`);
  expect(start, `${name} not found`).toBeGreaterThan(-1);
  return src.slice(start, src.indexOf("\n  };", start));
}

describe("Global Search hands its query to the navigation that opened the record", () => {
  it("passes the live query and sort mode as the navigation's origin", () => {
    const body = bodyOf(SEARCH_CODE, "handleSelect");
    expect(body).toMatch(/onNavigate\(meta\.tab, result\.id, meta\.subTab, \{ query, sortMode \}\)/);
  });

  it("restores a previous query and sort when reopened", () => {
    expect(SEARCH).toMatch(/initialQuery = ""/);
    expect(SEARCH).toMatch(/initialSortMode/);
    // Read as initialisers, not applied in an effect. That is only correct
    // because the screen is conditionally rendered and remounts every open —
    // if this ever became an effect, the restore would be visible a frame
    // late and the index would already have searched an empty query.
    expect(SEARCH).toMatch(/useState\(initialQuery\)/);
    expect(SEARCH).toMatch(/useState\(initialSortMode === "alphabetical"/);
  });
});

describe("App.jsx threads the search origin through, and clears it otherwise", () => {
  it("navigates to a record with the origin normalised by the pure helper", () => {
    const body = bodyOf(APP_CODE, "navigateToRecord");
    expect(body).toMatch(
      /navigateTo\(tabKey, subTab, buildSearchReturn\(searchReturn\?\.query, searchReturn\?\.sortMode\)\)/
    );
  });

  it("every other navigation clears the context, by defaulting it to null", () => {
    // The load-bearing clearing. A record link from Contacts, Calendar or
    // Clinic Card passes no fourth argument, so this default records null.
    const body = bodyOf(APP_CODE, "navigateTo");
    expect(body).toMatch(/searchReturn = null/);
    expect(body).toMatch(/setSearchReturn\(searchReturn\)/);
  });

  it("writes the context exactly once per navigation", () => {
    // Deliberate. An earlier draft cleared it in navigateTo and re-set it
    // afterwards in navigateToRecord, which is correct only because of
    // "last write wins" within one React batch — a subtlety a later edit
    // could reverse silently. One write, at the call site, is the version
    // that stays correct.
    const body = bodyOf(APP_CODE, "navigateToRecord");
    expect((body.match(/setSearchReturn\(/g) || []).length).toBe(0);
  });

  it("renders the affordance through the pure visibility decision", () => {
    expect(APP).toMatch(/shouldOfferSearchReturn\(\{/);
    expect(APP).toMatch(/Back to search results/);
  });

  it("returning to the results does NOT consume the context", () => {
    // A deliberate design decision that reads like an oversight, so it is
    // pinned. If this consumed the context, dismissing the restored search
    // with its own X would drop the user on the record with neither a way to
    // the results nor a way to undo the return — the exact dead end this
    // whole change exists to remove.
    const body = bodyOf(APP_CODE, "returnToSearchResults");
    expect(body).toMatch(/setShowSearch\(true\)/);
    expect(body).not.toMatch(/setSearchReturn/);
  });
});

describe("the back chain consults the decision rather than re-implementing it", () => {
  it("goBackOneLevel asks decideBackAction and acts on the answer", () => {
    const body = bodyOf(APP_CODE, "goBackOneLevel");
    expect(body).toMatch(/decideBackAction\(\{/);
    expect(body).toMatch(/BACK_ACTION\.SEARCH_RETURN/);
  });

  it("the Escape-sweep lesson is respected: the back effects list their real inputs", () => {
    // Both the hardware-back and swipe-back effects re-register their
    // listener with a fresh closure, listing every state goBackOneLevel
    // reads. `clinicCardReturnTab` was missing from both before this change —
    // correct only by accident of React batching — and `searchReturn` would
    // have joined it. A stale closure here means back silently doing the
    // wrong thing, which no behavioural unit test can see.
    const effectDeps = APP.match(/\}, \[showSettings, showSearch, active[^\]]*\]\);/g) || [];
    expect(effectDeps.length, "expected both back effects to declare the same dep list").toBe(2);
    for (const deps of effectDeps) {
      expect(deps).toMatch(/clinicCardReturnTab/);
      expect(deps).toMatch(/searchReturn/);
    }
  });
});

describe("the guards above are not vacuous", () => {
  it("comment-stripping still leaves real code, and really removes comments", () => {
    const probe = 'const a = 1;\n// const b = 2;\nconst c = 3;';
    const stripped = stripComments(probe);
    expect(stripped).toContain("const a = 1;");
    expect(stripped).toContain("const c = 3;");
    expect(stripped).not.toContain("const b = 2;");
    // And both real files are still substantial after stripping, so a
    // future refactor that comments out a whole component cannot make every
    // check above pass by removing what it inspects.
    expect(APP_CODE.length).toBeGreaterThan(APP.length * 0.5);
    expect(SEARCH_CODE.length).toBeGreaterThan(SEARCH.length * 0.5);
  });
});

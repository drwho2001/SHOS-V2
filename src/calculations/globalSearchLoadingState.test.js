// Source-level guard for a real search bug found on 28 Sep 2026, while
// auditing the app as a new user.
//
// THE BUG: Global Search built its index with
// `useLoadedMemo(() => buildIndex(), [], [])`. That hook's fallback argument
// is an EMPTY ARRAY, and an empty array is indistinguishable from "we searched
// every record and found nothing". So anyone who opened Search and typed -
// which is exactly what you open Search to do - was shown the confident
// answer `No matches for "X"` for as long as the index took to build, after
// which results appeared underneath them without explanation.
//
// A false negative that contradicts itself a second later is worse than a
// visibly slow screen. It doesn't just waste a moment, it teaches someone that
// this app's search is unreliable, which is the opposite of what the feature
// is for.
//
// WHY A SOURCE CHECK: the defect is a missing distinction between two render
// branches, and the branch is only reachable during a timing window. A
// behavioural test would have to open Search, type faster than buildIndex()
// resolves, and assert on a frame that may last a few milliseconds - which is
// exactly the kind of timing-dependent test this project has been burned by
// repeatedly (see the fixed-wait entries in docs/CHANGE-PROCEDURE.md). What
// matters is the invariant, and it is expressible: a "no matches" message must
// never be reachable while the index is still building.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const SRC = readFileSync(
  path.join(process.cwd(), "src", "modules", "SHOS_GlobalSearch_Prototype.jsx"),
  "utf8"
);

/**
 * Source with `//` line comments removed.
 *
 * Needed because the fix's own comment quotes the original defective line
 * verbatim. In this repo comments record what a bug WAS, which is exactly what
 * makes them valuable - and exactly why a raw substring check then reports the
 * bug as still present. This is the SECOND time in one session a source-level
 * guard tripped over the very comment documenting its own fix (the
 * settings-path test did the same). Strip comments in these guards by default,
 * and prove the stripper still sees real code - see the last test here.
 */
const CODE = SRC.split("\n")
  .filter((l) => {
    const t = l.trim();
    return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
  })
  .join("\n");

describe("Global Search does not claim 'no matches' before it has searched", () => {
  it("tracks a not-yet-loaded state that cannot be confused with an empty result", () => {
    // `null` is the load-bearing part of the fix. If this ever becomes `[]`,
    // or goes back to useLoadedMemo's empty-array fallback, the whole guard
    // below stops meaning anything.
    expect(SRC, "expected a not-yet-loaded sentinel for the search index").toMatch(
      /const \[index, setIndex\] = useState\(null\)/
    );
    expect(SRC, "expected an indexReady flag derived from that sentinel").toMatch(
      /const indexReady = index !== null/
    );
  });

  it("gates the 'no matches' message behind indexReady", () => {
    // The single most important assertion: the "no matches" branch must
    // require a completed search.
    expect(SRC).toMatch(
      /query\.trim\(\)\.length > 0 && indexReady && results\.length === 0/
    );
  });

  it("shows a neutral 'Searching' state while the index builds", () => {
    // It must not assert anything about whether matches exist - at that point
    // the app genuinely does not know.
    expect(SRC).toMatch(/query\.trim\(\)\.length > 0 && !indexReady &&/);
    expect(SRC).toMatch(/Searching/);
  });

  it("does not announce 'No matches found' to a screen reader mid-search", () => {
    // Same false negative, in the aria-live region. A screen-reader user was
    // told the search had found nothing while it hadn't finished running.
    const live = SRC.slice(SRC.indexOf('aria-live="polite"'), SRC.indexOf('aria-live="polite"') + 900);
    expect(live, "live region should branch on indexReady first").toMatch(/!indexReady/);
    expect(live).not.toMatch(/^\s*:\s*query\.trim\(\)\.length > 0 \? "No matches found"/m);
  });

  it("no longer builds the index with an empty-array fallback", () => {
    // The original defect, stated as the thing it was. Checked against the
    // comment-stripped source - see the note on CODE.
    expect(CODE, "useLoadedMemo's [] fallback is the bug - it reads as 'no matches'").not.toMatch(
      /useLoadedMemo\(\(\) => buildIndex\(\), \[\], \[\]\)/
    );
  });

  it("the comment-stripping is not itself vacuous", () => {
    // If CODE ever became empty or meaningless, every negative check above
    // would pass forever. Prove the stripper still sees real code.
    const probe = 'const a = 1;\n// const b = 2;\nconst c = 3;';
    const stripped = probe
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    expect(stripped).toContain("const a = 1;");
    expect(stripped).toContain("const c = 3;");
    expect(stripped).not.toContain("const b = 2;");
    // And the real file is still substantial after stripping.
    expect(CODE.length).toBeGreaterThan(SRC.length * 0.5);
  });
});

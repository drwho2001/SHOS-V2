// Pure decision function for the "docs in sync" gate, in its own module so it
// can be unit-tested directly.
//
// WHY A SEPARATE FILE: the logic originally lived inline in
// scripts/verify-changes.mjs, whose top-level code actually RUNS the whole gate
// suite on import. A test that imported it would therefore kick off a full
// build + lint + vitest + Playwright smoke run every time it was collected —
// slow, fragile, and it would report the real suite's failures as the test
// file's own. Extracting the pure part means the test exercises the decision
// and nothing else.
//
// WHY THE DECISION ITSELF SPLITS ON `inCI`: this is not the same question asked
// twice, it is two genuinely different questions.
//
//   locally, mid-change, "source changed, docs not yet" is the NORMAL state of
//   an honest edit in progress. Failing the local gate for it would train
//   everyone to ignore the gate, which is worse than not having it.
//
//   in CI the change is already pushed. At that point the same state no longer
//   means "work in progress" — it means the change SHIPPED with CLAUDE.md still
//   describing the old behaviour. CLAUDE.md is this repo's declared source of
//   truth for what is true right now, so a stale one is a real defect, and it
//   fails.
//
// That distinction is the difference between a warning and a gate. A warning
// nobody is obliged to read is not enforcement, and moving this check into CI
// was for enforcement.

/**
 * @param {string[]} touched  changed file paths (git diff --name-only output)
 * @param {boolean}   inCI     true when the pushed-range mode is in use
 * @returns {{ok: boolean, note: string}}
 */
export function classifyDocsGate(touched, inCI) {
  const srcChanged = touched.some((f) => f.startsWith("src/"));
  const docChanged = touched.some((f) => /^(CLAUDE\.md|docs\/)/.test(f));
  const stale = srcChanged && !docChanged;

  return {
    ok: !stale || !inCI,
    note: srcChanged
      ? docChanged
        ? "source + docs both touched"
        : inCI
          ? "SOURCE CHANGED, DOCS NOT TOUCHED — CLAUDE.md/docs must ship with a behaviour change"
          : "SOURCE CHANGED, DOCS NOT TOUCHED — confirm CLAUDE.md still describes current behaviour"
      : "no source changes",
  };
}

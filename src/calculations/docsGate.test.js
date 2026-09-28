// Tests for the "docs in sync" gate's decision logic.
//
// The gate is the only one in this project that answers a DIFFERENT question
// depending on where it runs: locally "is my edit-in-progress leaving the docs
// stale?" (a warning, because that's the normal state of honest work), and in
// CI "did this change SHIP with stale docs?" (a failure). That split is the
// interesting part, and it is exactly the kind of thing that silently rots if
// only ever verified by reading a table after a run — so it is unit-tested here
// instead.
//
// It lives in scripts/docsGate.js purely so it can be imported without
// triggering verify-changes.mjs's top-level code, which actually runs the
// entire build/lint/test/Playwright suite on import.
import { describe, it, expect } from "vitest";
import { classifyDocsGate } from "../../scripts/docsGate.js";

const SRC = ["src/modules/SHOS_Contacts_Prototype.jsx"];
const DOC = ["CLAUDE.md"];

describe("docs gate — local mode (warning, not failure)", () => {
  it("passes when source and docs were both touched", () => {
    const r = classifyDocsGate([...SRC, ...DOC], false);
    expect(r.ok).toBe(true);
    expect(r.note).toMatch(/both touched/);
  });

  it("passes but WARNS when source changed and docs did not", () => {
    // This is the whole reason the local mode is not a failure: mid-edit, a
    // developer who has not updated CLAUDE.md yet is doing the right thing so
    // far, and failing them would just train them to ignore the gate.
    const r = classifyDocsGate(SRC, false);
    expect(r.ok, "must not fail locally").toBe(true);
    expect(r.note).toMatch(/confirm CLAUDE\.md still describes/);
  });

  it("passes when nothing under src/ changed", () => {
    // A docs-only, scripts-only or workflow-only change cannot have made
    // CLAUDE.md stale by definition.
    const r = classifyDocsGate(["scripts/smoke-test.cjs", ".github/workflows/smoke-test.yml"], false);
    expect(r.ok).toBe(true);
    expect(r.note).toMatch(/no source changes/);
  });
});

describe("docs gate — CI mode (a real failure)", () => {
  it("FAILS when source changed and docs did not", () => {
    // The point of moving this into CI. At push time this state means the
    // change shipped with CLAUDE.md describing the old behaviour.
    const r = classifyDocsGate(SRC, true);
    expect(r.ok, "must fail in CI — this is a shipped change with stale docs").toBe(false);
    expect(r.note).toMatch(/must ship with a behaviour change/);
  });

  it("passes when both were touched", () => {
    expect(classifyDocsGate([...SRC, ...DOC], true).ok).toBe(true);
  });

  it("passes when only non-source files changed", () => {
    expect(classifyDocsGate(["package.json", "README.md"], true).ok).toBe(true);
  });

  it("treats a new file under docs/ as a doc update", () => {
    expect(classifyDocsGate([...SRC, "docs/CHANGE-PROCEDURE.md"], true).ok).toBe(true);
  });
});

describe("docs gate — the local/CI split is real, not accidental", () => {
  it("gives opposite verdicts for the same file list", () => {
    // If someone ever "simplifies" this to one mode, this test fails and the
    // decision they just silently made becomes explicit.
    const files = ["src/App.jsx"];
    expect(classifyDocsGate(files, false).ok).toBe(true);
    expect(classifyDocsGate(files, true).ok).toBe(false);
  });

  it("an empty diff passes in both modes (a no-op push is not a stale-docs push)", () => {
    expect(classifyDocsGate([], false).ok).toBe(true);
    expect(classifyDocsGate([], true).ok).toBe(true);
  });
});

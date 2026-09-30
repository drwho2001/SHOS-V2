// Guard: every full-screen sheet in the Medication Dashboard must be announced
// as a dialog AND close on Escape (pool t036).
//
// WHY THIS IS A NARROW, ENUMERATED GUARD
// --------------------------------------
// The other session owns escapeMountAudit.test.js and it is deliberately scoped
// to three named always-mounted components - a general scan was tried there and
// over-flagged, producing three false positives, and a test that flags known-fine
// components gets deleted by the next reader. That reasoning is right, so this
// file does not widen it or contradict it. It covers the one file where the
// omission actually happened, by naming the sheets, so the coverage is a
// decision on the record rather than a regex that drifts.
//
// WHAT IT CAUGHT
// --------------
// MedicationEditSheet was the only one of the seven sheets in this file with
// neither role="dialog" nor useEscapeToClose. A screen reader was never told it
// was a dialog and Escape did not close it. Nothing flagged it because nothing
// was looking at this file, and the one existing guard covers a different set.
//
// Comments are stripped before matching, because this file's own comments quote
// the exact attributes being required - the stripper is proven non-vacuous so a
// broken one cannot make these assertions pass for the wrong reason.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const FILE = "src/modules/SHOS_Medication_Dashboard_Prototype.jsx";

const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/.*$/gm, (m) => m.replace(/[^\n]/g, " "));

// Each sheet, and the aria-label it is expected to carry. The labels are part of
// the assertion on purpose: a bare role="dialog" with no name is announced as
// nothing, which is half the defect this task fixed.
const SHEETS = [
  "Correct stock level",
  "Log refill",
  "Edit entry",
  "Update dose",
  "Add medication",
  "Medication settings",
  "Edit medication",
];

const code = stripComments(readFileSync(FILE, "utf8"));

describe("Medication Dashboard sheets", () => {
  it("the comment stripper is non-vacuous", () => {
    const raw = readFileSync(FILE, "utf8");
    expect(raw, "the file must actually contain comments to strip").toContain("//");
    // NOT a length assertion. This stripper replaces comment characters with
    // spaces rather than deleting them, so that line numbers are preserved and a
    // failure points at the right line - the stripped text is the SAME LENGTH
    // as the original. My first version asserted it was shorter, which failed,
    // and the failure was the assertion being wrong rather than the stripper:
    // a length-preserving strip is the point.
    expect(stripComments(raw), "stripping must actually change the text").not.toBe(raw);
    // Real code still visible after stripping, and the banned phrase is not.
    expect(stripComments('const a = 1; // role="dialog"\nconst b = 2;')).toContain("const b = 2;");
    expect(stripComments('const a = 1; // role="dialog"')).not.toContain('role="dialog"');
    // And line numbers are preserved, which is why it replaces rather than deletes.
    const three = 'a\n// x\nb';
    expect(stripComments(three).split("\n").length).toBe(3);
  });

  it("declares every expected sheet, so a renamed one is noticed", () => {
    // Guards the table above against this file's sheets changing without this
    // guard being updated - otherwise the assertions below would quietly shrink
    // in coverage while still reading as complete.
    for (const label of SHEETS) {
      expect(code, `expected a sheet labelled "${label}"`).toContain(`aria-label="${label}"`);
    }
  });

  it("every sheet is announced as a dialog with a focusable root", () => {
    // One assertion over the real count, so a NEW sheet added without the
    // treatment fails rather than being invisible.
    const roots = (code.match(/role="dialog"/g) || []).length;
    expect(roots, "every sheet root needs role=\"dialog\"").toBe(SHEETS.length);

    // Each dialog root must also be focusable, or the focus-on-open effect that
    // every one of these sheets performs does nothing - the same silent no-op
    // recorded when 11 sheets got tabIndex-less focus() calls on 25 Sep.
    const rootsWithTabIndex = (code.match(/role="dialog"[^>]*tabIndex=\{0\}/g) || []).length;
    expect(rootsWithTabIndex).toBe(SHEETS.length);
  });

  it("every sheet registers with the Escape hook", () => {
    // The call count must match the sheet count. A sheet that forgets this is
    // a keyboard trap on desktop and web - the exact defect the Escape sweep
    // fixed across the app on 28 Sep, and which nothing was watching here.
    const calls = (code.match(/useEscapeToClose\(\s*onClose\s*\)/g) || []).length;
    expect(calls, "one useEscapeToClose(onClose) per sheet").toBe(SHEETS.length);
  });

  it("each sheet focuses itself on open", () => {
    const effects = (code.match(/dialogRef\.current\?\.focus\(\)/g) || []).length;
    expect(effects).toBe(SHEETS.length);
    const refs = (code.match(/ref=\{dialogRef\}/g) || []).length;
    expect(refs).toBe(SHEETS.length);
  });
});

// t138: the encounter form must not ASK for the DoxyPEP status, and must not
// STORE one.
//
// WHY (the owner's own reasoning): "doxy is retroactive, prep is proactive, so
// prep would be taken before event - so maybe just a prep coverage toggle."
// That is right, and it has a consequence the form has to respect:
//
//   - DoxyPEP is retrospective. When an encounter is created, the only
//     answers that EXIST are "not indicated" and "not yet taken" - "missed
//     window" only becomes true 72 hours later. A stored answer is therefore
//     a snapshot of a moment, and it goes stale: a dose logged tomorrow
//     leaves the encounter saying "not yet taken" for ever.
//   - PrEP coverage is proactive. It is knowable when the encounter is
//     created, it does not change afterwards, and it is inferred from the
//     medication log (t137) - so it stays on the form.
//
// So the DoxyPEP select is gone from the form, and the status is DERIVED
// wherever it is shown (resolveDoxyPepDisplay, in encounterProtectionContext).
//
// This file asserts the absence of the field and the presence of the
// derivation. It is a source guard, so it must also prove it is looking at
// the right file and that the derivation is inside the READ view rather than
// somewhere else in the module.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const modulePath = path.join(process.cwd(), "src", "modules", "SHOS_Encounters_Prototype.jsx");
const src = readFileSync(modulePath, "utf8");

// The read view's own source, so "the status is derived" is not satisfied by
// the form's derivation (the form had one too, for its hint line).
const readViewSrc = src.slice(
  src.indexOf("function ActivityDetails"),
  src.indexOf("function EncounterEditSheet")
);

describe("the encounter form's DoxyPEP field", () => {
  it("is looking at the real module (a guard that read nothing would pass)", () => {
    expect(src.length).toBeGreaterThan(50_000);
    expect(src).toContain("function EncounterEditSheet");
    expect(src).toContain("function ActivityDetails");
  });

  it("does not ask the user for it - no DoxyPEP select anywhere in the form", () => {
    // `[^>]` cannot cross the end of the tag, so this cannot match a select
    // in one place and a DoxyPEP word in another.
    expect(src).not.toMatch(/<SelectField\b[^>]{0,200}DoxyPEP/i);
  });

  it("does not store a snapshot of it either", () => {
    // The form's inference effect used to write the inferred value into the
    // record ("next.myDoxyPepStatus = ..."). That IS the stale snapshot, so
    // the write has to be gone, not just the select.
    expect(src).not.toMatch(/next\.myDoxyPepStatus/);
    // And the form must not read the stored value as if it were an answer.
    expect(src).not.toMatch(/value=\{form\.myDoxyPepStatus\}/);
  });

  it("still asks for PrEP coverage - the proactive half stays on the form", () => {
    expect(src).toMatch(/<SelectField\b[^>]{0,200}PrEP coverage/);
  });
});

describe("where the DoxyPEP status is shown instead", () => {
  it("the read view derives it from the log", () => {
    expect(readViewSrc.length).toBeGreaterThan(5_000);
    expect(readViewSrc).toContain("inferProtectionContext");
    expect(readViewSrc).toContain("resolveDoxyPepDisplay");
  });

  it("and the row shows the DERIVED answer, not the stored one", () => {
    // This is the assertion that was missing the first time round: the guard
    // checked that the read view MENTIONED the resolver, and a mutation that
    // pointed the row back at the stored value left that mention in place -
    // the same trap as a guard that matches a name rather than a call. So the
    // row's own value is checked: it must be the resolved one, and it must
    // not be the stored field.
    expect(readViewSrc).toMatch(/<ReadRow\b[^>]{0,200}doxyPepDisplay\.value/);
    expect(readViewSrc).not.toMatch(/<ReadRow\b[^>]{0,200}encounter\.myDoxyPepStatus/);
  });

  it("and the pure rule that decides what to show is itself covered", () => {
    // The rule lives in the calculations module, where a unit test can reach
    // it - the repo's rule: code a test cannot reach is code that breaks
    // unseen.
    const rule = readFileSync(
      path.join(process.cwd(), "src", "calculations", "encounterProtectionContext.js"),
      "utf8"
    );
    expect(rule).toContain("export function resolveDoxyPepDisplay");
  });
});

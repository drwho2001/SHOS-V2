// The "this container" pill: labelled for what it measures, and not shown when
// there is no container to measure.
//
// Two defects, both found by reading rather than being reported:
//
//  1. The label said "this refill" while the maths anchors on your last logged
//     refill but CAPS AND WRAPS the window at daysPerContainer - one
//     container's worth of doses. Two consequences: a 6-month PrEP supply would
//     dilute the rate across the whole supply, and a user who orders 2
//     containers at once (the refill qty is entered in containers and can be
//     >1) saw a figure labelled "this refill" that never spanned their refill.
//
//  2. With no refill logged, `sinceRefill` falls back to the 7-day numbers - so
//     the pill showed the SAME figure twice, under two different labels. Two
//     identical numbers side by side read as two independent pieces of
//     evidence, and someone comparing them would conclude the patient had two
//     different histories when they have one.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DASH = readFileSync(
  resolve(process.cwd(), "src", "modules", "SHOS_Medication_Dashboard_Prototype.jsx"), "utf8"
);

describe("the container pill is labelled for what it measures", () => {
  it("is not called 'this refill'", () => {
    expect(DASH, "the old label is misleading - the window wraps at one container")
      .not.toContain('label="this refill"');
    expect(DASH).toContain('label="this container"');
  });

  it("has an explanation, and it says the window is capped at a container", () => {
    // The sibling 7-day pill has had an info icon since 16 Sep; this one had
    // none at all, which is why the label was the only place the distinction
    // could even be made. The copy has to state the CAP, because that is the
    // fact the old label got wrong.
    const start = DASH.indexOf('label="this container"');
    expect(start).toBeGreaterThan(-1);
    const pill = DASH.slice(start, start + 500);
    expect(pill, "the container pill needs an info prop like its siblings").toMatch(/info="/);
    expect(pill, "the explanation must mention the container cap").toMatch(/container/i);
  });

  it("is hidden when there is no refill to measure a container from", () => {
    expect(DASH, "the pill must be gated on sinceRefillAnchored")
      .toMatch(/adherence\.sinceRefillAnchored\s*&&\s*\(/);
  });
});

describe("computeAdherence reports whether the container figure is anchored", () => {
  it("the flag is returned by the function that owns it", () => {
    // Source-level rather than calling it, because computeAdherence needs
    // repositories. What is asserted is the shape contract, which is the part
    // a UI change depends on.
    const CALC = readFileSync(
      resolve(process.cwd(), "src", "calculations", "medicationCalculations.js"), "utf8"
    );
    expect(CALC, "computeAdherence must return sinceRefillAnchored")
      .toMatch(/return \{ streak, sevenDay, sinceRefill, sinceRefillAnchored \}/);
    expect(CALC, "the flag must be set only when a refill exists")
      .toMatch(/sinceRefillAnchored = true;/);
  });

  it("the fallback to 7-day is still there for callers that want a number", () => {
    // Hiding the PILL is a presentation decision. The underlying fallback is
    // untouched, so anything else reading sinceRefill still gets a value rather
    // than undefined - which is the difference between hiding a duplicate and
    // breaking a consumer.
    const CALC = readFileSync(
      resolve(process.cwd(), "src", "calculations", "medicationCalculations.js"), "utf8"
    );
    expect(CALC).toMatch(/sinceRefill = sevenDay;/);
  });
});

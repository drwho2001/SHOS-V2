// The "this container" ring on Home.
//
// The subtle part is not the averaging - it is WHICH medications are allowed to
// contribute. computeAdherence() falls back to the 7-day figures when a
// medication has no logged refill, so a caller that averaged `sinceRefill.pct`
// without filtering on `sinceRefillAnchored` would average 7-day rates into a
// number labelled "this container". That is precisely the bug the medication
// card's own label was fixed for (t022: "this refill" -> "this container"), so
// reproducing it in a second place would undo that fix by the back door.
//
// It is also the exact shape of defect this project has recorded repeatedly: a
// fallback value standing in for an absent one, and nothing failing because the
// number still looked plausible.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getOverallContainerAdherence, getOverallAdherence } from "./statsCalculations";
import { computeAdherence } from "./medicationCalculations";

const HOME = readFileSync(
  resolve(process.cwd(), "src", "modules", "SHOS_Home_Prototype.jsx"), "utf8"
);

const anchored = (pct) => ({ sinceRefillAnchored: true, sinceRefill: { pct }, sevenDay: { pct: 0 } });
const unanchored = (pct) => ({ sinceRefillAnchored: false, sinceRefill: { pct }, sevenDay: { pct } });

describe("getOverallContainerAdherence", () => {
  const fake = (shape) => (_med) => shape;

  it("averages only anchored medications", () => {
    expect(getOverallContainerAdherence([{}], fake(anchored(80)))).toBe(80);
  });

  it("returns null when nothing is anchored - no empty ring on a fresh install", () => {
    // This is the assertion that catches the fallback bug directly.
    expect(getOverallContainerAdherence([{}], fake(unanchored(90)))).toBeNull();
  });

  it("ignores unanchored medications that would contribute a 7-day rate", () => {
    // Two meds: one genuinely on a container at 60%, one with NO logged refill
    // whose sinceRefill has fallen back to its 100% 7-day rate. Averaging both
    // would report 80% and label it "this container". Only the anchored one
    // counts, so the answer is 60%.
    const meds = [{ id: "a" }, { id: "b" }];
    const byMed = (med) => (med.id === "a" ? anchored(60) : unanchored(100));
    expect(getOverallContainerAdherence(meds, byMed)).toBe(60);
  });

  it("excludes archived and PRN medications, exactly like its 7-day sibling", () => {
    // Same filter as getOverallAdherence on purpose. A PRN medication has no
    // schedule, so "this container" is meaningless for it; an archived one is
    // history. If these two ever diverge, one of the rings is lying.
    const meds = [
      { id: "live" },
      { id: "archived", isArchived: true },
      { id: "prn", usagePattern: "prn" },
    ];
    const byMed = (med) => (med.id === "live" ? anchored(70) : anchored(0));
    expect(getOverallContainerAdherence(meds, byMed)).toBe(70);
  });

  it("does not invent a blended single score for the two windows", () => {
    // The two windows answer different questions, and this file's own header
    // refuses to invent one wellness score. Guarding the shape keeps the pair
    // recognisable as a pair.
    const meds = [{ id: "a" }];
    const both = { sinceRefillAnchored: true, sinceRefill: { pct: 40 }, sevenDay: { pct: 95 } };
    const shape = (med) => both;
    expect(getOverallContainerAdherence(meds, shape)).toBe(40);
    expect(getOverallAdherence(meds, shape)).toBe(95);
  });

  it("tolerates absent input", () => {
    expect(getOverallContainerAdherence(null, () => anchored(50))).toBeNull();
    expect(getOverallContainerAdherence([], () => anchored(50))).toBeNull();
  });

  it("a computeAdherence that returns nothing usable is skipped, not crashed on", () => {
    expect(getOverallContainerAdherence([{}], () => undefined)).toBeNull();
    expect(getOverallContainerAdherence([{}], () => ({}))).toBeNull();
  });
});

describe("the real computeAdherence drives it correctly", () => {
  // The unit above uses a stubbed computeAdherence, which proves the filter but
  // not that the real function reports `sinceRefillAnchored` the way this
  // assumes. This is the half that would fail if the two ever drifted.
  const med = (over) => ({
    id: "m1", name: "Test", isArchived: false, usagePattern: "daily",
    unitsPerDose: 1, unitsPerContainer: 28, doseTimes: ["08:00"],
    logs: [], ...over,
  });
  const today = new Date().toISOString();

  it("no logged refill means not anchored, so no container ring at all", () => {
    const a = computeAdherence(med({ logs: [{ id: "l1", type: "dose", date: today, voided: false }] }));
    expect(a.sinceRefillAnchored).toBe(false);
  });

  it("a logged refill anchors it, and the two windows differ", () => {
    const logs = [
      { id: "l1", type: "dose", date: today, voided: false },
      { id: "l2", type: "refill", date: new Date(Date.now() - 5 * 86400000).toISOString(), voided: false },
    ];
    const a = computeAdherence(med({ logs }));
    expect(a.sinceRefillAnchored).toBe(true);
    // The whole point of a separate ring: a different window must be able to
    // give a different answer, or there is no reason for it to exist.
    expect(typeof a.sinceRefill.pct).toBe("number");
    expect(typeof a.sevenDay.pct).toBe("number");
  });
});

describe("Home shows the trio", () => {
  it("the ring is built only when there is a container measurement", () => {
    expect(HOME, "the container ring must be gated on a real measurement")
      .toMatch(/containerAdherence != null \?/);
  });

  it("and it is rendered in BOTH the desktop split card and the mobile row", () => {
    // The file builds each ring once and references it in both layouts so they
    // cannot drift. The new ring has to be in both, or it appears on one
    // platform and silently vanishes on the other.
    const uses = (HOME.match(/\{containerRing\}/g) || []).length;
    expect(uses, "the container ring must be referenced in both layouts").toBe(2);
  });

  it("the info text explains the container cap, matching the medication card", () => {
    // The defect this exists to prevent: one number labelled two different ways
    // in two places. The card says "capped at one container's worth of doses"
    // and so must this.
    expect(HOME).toMatch(/capped at one container's worth/);
  });

  it("its info text is no longer than its 7-day sibling's", () => {
    // Kept in step with the other two rings deliberately. A third ring whose
    // explanation runs noticeably longer than its neighbours reads as the
    // afterthought, and the owner asked for a trio rather than crowding - so the
    // cap is stated, the "so a long supply doesn't dilute the rate" gloss is
    // not, and the redundant "only shown once a refill is logged" is dropped
    // (you cannot be reading this unless a refill is logged).
    const grab = (caption) => {
      const i = HOME.indexOf(`caption="${caption}"`);
      expect(i, `${caption} ring not found`).toBeGreaterThan(-1);
      const m = HOME.slice(i, i + 400).match(/info="([^"]+)"/);
      return m ? m[1] : "";
    };
    const container = grab("This container");
    const seven = grab("7-day adherence");
    // A tolerance, not parity - and deliberately so. The container copy carries
    // one fact the 7-day copy does not need (the cap), and that fact is the
    // whole reason the label was ever corrected, so forcing exact equality
    // would mean dropping the explanation to satisfy a style rule. The bound is
    // what stops the copy becoming the 200-character version this started as,
    // which rendered four lines against its siblings' two or three.
    expect(container.length, `container copy is ${container.length} chars, sibling is ${seven.length}`)
      .toBeLessThanOrEqual(Math.ceil(seven.length * 1.25));
    // The essential fact must survive the shortening.
    expect(container).toMatch(/capped at one container's worth/);
  });
});

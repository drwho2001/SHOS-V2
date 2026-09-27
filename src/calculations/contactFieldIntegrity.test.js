// Coverage for the two silent-failure bugs found by auditing the app as a
// brand-new user on 27 Sep 2026.
//
// Both lived entirely in render code, which is why they survived the build,
// eslint, all 224 unit tests and the full 15-flow smoke suite: none of those
// check what a chip tap does to an unrelated chip row, or whether a record the
// user can see a way to create is actually reachable. Extracting the logic
// into contactCalculations.js is what made it testable at all.
//
// The rules being pinned here are PRODUCT rules, not implementation details:
//   - three chip rows over one array must not overwrite each other
//   - a field the user has already filled in must never be hidden by a
//     visibility rule that hides it for everyone else
import { describe, it, expect } from "vitest";
import { hasPhysicalDetail, mergeCummerRow } from "./contactCalculations";
import {
  CUMMER_FREQUENCY_OPTIONS,
  CUMMER_VOLUME_OPTIONS,
  CUMMER_STYLE_OPTIONS,
} from "../repositories/contactRepository";

const FREQ = CUMMER_FREQUENCY_OPTIONS;
const VOL = CUMMER_VOLUME_OPTIONS;
const STYLE = CUMMER_STYLE_OPTIONS;

describe("the three Ejaculation chip rows cannot overwrite each other", () => {
  // THE BUG: every row read and wrote the whole `cummer` array through
  // MultiSelectChips' toggle handler, which replaces the entire array. Picking
  // "Big load" (volume) then "Squirter" (style) silently discarded "Big
  // load" - and because each row renders the array as its own selected set,
  // the volume row then showed nothing selected either, so there was no clue
  // the value had been dropped rather than never applied.

  // Mimics the real component: each row sees only its own slice, and writes
  // through mergeCummerRow. This is exactly how CummerRow behaves now.
  const rowView = (cummer, options) => (cummer || []).filter((v) => options.includes(v));
  const rowToggle = (cummer, options, opt) => {
    const mine = rowView(cummer, options);
    const next = mine.includes(opt) ? mine.filter((v) => v !== opt) : [...mine, opt];
    return mergeCummerRow(cummer, next, options);
  };

  it("keeps a volume value when the user then picks a style value", () => {
    // The exact real-world sequence that lost data.
    const afterVolume = rowToggle([], VOL, "Big load");
    expect(afterVolume).toEqual(["Big load"]);
    const afterStyle = rowToggle(afterVolume, STYLE, "Squirter");
    expect(afterStyle).toContain("Big load");
    expect(afterStyle).toContain("Squirter");
  });

  it("keeps a style value when the user then picks a frequency value", () => {
    const afterStyle = rowToggle([], STYLE, "Squirter");
    const afterFreq = rowToggle(afterStyle, FREQ, "Multiple loads");
    expect(afterFreq).toContain("Squirter");
    expect(afterFreq).toContain("Multiple loads");
  });

  it("accumulates one value from every row without loss", () => {
    let cummer = [];
    cummer = rowToggle(cummer, FREQ, "Only once");
    cummer = rowToggle(cummer, VOL, "Average");
    cummer = rowToggle(cummer, STYLE, "Dribbler");
    expect(cummer).toHaveLength(3);
    expect(rowView(cummer, FREQ)).toEqual(["Only once"]);
    expect(rowView(cummer, VOL)).toEqual(["Average"]);
    expect(rowView(cummer, STYLE)).toEqual(["Dribbler"]);
  });

  it("deselecting one row's value leaves the other rows alone", () => {
    const cummer = ["Big load", "Squirter", "Takes ages"];
    const after = rowToggle(cummer, STYLE, "Squirter");
    expect(after).not.toContain("Squirter");
    expect(after).toContain("Big load");
    expect(after).toContain("Takes ages");
  });

  it("reproduces the seed data's own shape, so existing records are unaffected", () => {
    // contactRepository seeds a contact with ["Multiple loads", "Big load"] -
    // a frequency AND a volume in one array. The single-array shape is
    // therefore correct and deliberately unchanged, and no migration is
    // involved. This asserts the shape is genuinely supported rather than
    // merely tolerated.
    const seed = ["Multiple loads", "Big load"];
    expect(rowView(seed, FREQ)).toEqual(["Multiple loads"]);
    expect(rowView(seed, VOL)).toEqual(["Big load"]);
    expect(rowView(seed, STYLE)).toEqual([]);
    // And editing one of them does not disturb the other. These are genuine
    // multi-select chips, so picking a second volume ADDS to that row rather
    // than replacing within it - the important guarantee is that the
    // frequency row is untouched, not that a row holds at most one value.
    const edited = rowToggle(seed, VOL, "Small");
    expect(rowView(edited, FREQ)).toEqual(["Multiple loads"]);
    expect(rowView(edited, VOL)).toEqual(["Big load", "Small"]);
  });

  it("preserves a value the user typed via 'Add new', which belongs to no row", () => {
    // A custom value matches no row's option set, so it falls to the "others"
    // side of the merge. Dropping it because someone tapped a chip on an
    // unrelated row would be a second, quieter version of the same bug.
    const withCustom = ["Something invented"];
    const after = rowToggle(withCustom, VOL, "Big load");
    expect(after).toContain("Something invented");
    expect(after).toContain("Big load");
  });

  it("tolerates a missing or non-array stored value", () => {
    expect(mergeCummerRow(undefined, ["Big load"], VOL)).toEqual(["Big load"]);
    expect(mergeCummerRow(null, [], VOL)).toEqual([]);
    // A non-array stored value is ignored rather than crashing the edit sheet.
    expect(mergeCummerRow("nonsense", ["Big load"], VOL)).toEqual(["Big load"]);
  });

  it("drops a value from `next` that is not part of the row's own option set", () => {
    // Defensive: if a caller ever hands over a wider selection than the row
    // owns, it must not be able to overwrite another row's territory.
    const merged = mergeCummerRow(["Squirter"], ["Big load", "Squirter"], VOL);
    expect(merged).toEqual(["Squirter", "Big load"]);
  });
});

describe("a filled-in Physical field is never hidden by the gender gate", () => {
  // THE BUG: "Physical & health" was hidden entirely when Gender was exactly
  // "female", with no escape hatch - while the Contraception gate in the very
  // same edit sheet had carried a "+ Track anyway" link since 11 Sep. Same
  // app, same sheet, same "never presume but never structurally block" rule,
  // applied to one gate and not the other.

  it("is false for a brand-new contact with only the default Chastity value", () => {
    // The gate must still work, or the escape hatch would be pointless.
    // Note Chastity defaults to the literal "N/A" on every contact, so that
    // default must NOT count as real data.
    expect(hasPhysicalDetail({ chastityStatus: "N/A" })).toBe(false);
  });

  it("is false for a genuinely empty record and for null", () => {
    expect(hasPhysicalDetail({})).toBe(false);
    expect(hasPhysicalDetail(null)).toBe(false);
    expect(hasPhysicalDetail(undefined)).toBe(false);
  });

  it("is true when any single physical field holds a real value", () => {
    expect(hasPhysicalDetail({ length: "6in" })).toBe(true);
    expect(hasPhysicalDetail({ thickness: "5in" })).toBe(true);
    expect(hasPhysicalDetail({ foreskin: "Uncircumcised" })).toBe(true);
    expect(hasPhysicalDetail({ foreskinDetail: "Snug" })).toBe(true);
    expect(hasPhysicalDetail({ chastityStatus: "Active" })).toBe(true);
    expect(hasPhysicalDetail({ cummer: ["Squirter"] })).toBe(true);
  });

  it("treats a non-empty cummer array as real data but an empty one as not", () => {
    expect(hasPhysicalDetail({ cummer: [] })).toBe(false);
    expect(hasPhysicalDetail({ cummer: ["Big load"] })).toBe(true);
  });

  it("means a record saved before the gate existed is still readable", () => {
    // The read-side consequence: a contact with a real Length value, whose
    // Gender was later set to "female", must not have that Length silently
    // disappear from its profile with no way to reach it.
    const record = { gender: "female", length: "6in", chastityStatus: "N/A" };
    expect(record.gender.trim().toLowerCase()).toBe("female");
    expect(hasPhysicalDetail(record)).toBe(true);
  });
});

// Long chip rows across the app collapse behind "more"; chosen chips stay.
import { describe, it, expect } from "vitest";
import { collapseChips } from "./chipVisibility.js";

const opts = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

describe("chipVisibility", () => {
  it("caps unselected options and reports how many are hidden", () => {
    const r = collapseChips(opts, [], 4);
    expect(r.shown).toEqual(["a", "b", "c", "d"]);
    expect(r.hiddenCount).toBe(6);
  });

  it("keeps chosen chips visible even when they are late in the list", () => {
    const r = collapseChips(opts, ["i", "j"], 4);
    expect(r.shown.slice(0, 2)).toEqual(["i", "j"]);
    expect(r.shown).toHaveLength(4);
    expect(r.hiddenCount).toBe(6);
  });

  it("showAll reveals everything and the hidden count drops to zero", () => {
    const r = collapseChips(opts, ["j"], 4, true);
    expect(r.shown).toHaveLength(10);
    expect(r.hiddenCount).toBe(0);
  });

  it("works with object-valued options via the valueOf mapper", () => {
    const objects = opts.map((v) => ({ id: v, label: v.toUpperCase() }));
    const r = collapseChips(objects, ["i"], 3, false, (o) => o.id);
    expect(r.shown[0].id).toBe("i");
    expect(r.hiddenCount).toBe(7);
  });

  it("does not double-count the chosen chips as hidden", () => {
    const r = collapseChips(opts, ["a", "b", "c", "d", "e"], 4);
    expect(r.shown).toEqual(["a", "b", "c", "d", "e"]);
    expect(r.hiddenCount).toBe(5);
  });
});

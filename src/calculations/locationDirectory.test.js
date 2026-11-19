import { describe, it, expect } from "vitest";
import {
  formatAddress, hasAddress, buildMapsQuery, buildMapsSearchUrl,
  groupLocationsByType, needsAddressNudge, MAPS_SEARCH_BASE,
} from "./locationDirectory.js";

describe("location directory", () => {
  it("formats and detects an address honestly", () => {
    expect(formatAddress({ address: "56 Dean Street", postcode: "W1D 6SQ" })).toBe("56 Dean Street, W1D 6SQ");
    expect(formatAddress({ address: "", postcode: "HU1 1AA" })).toBe("HU1 1AA");
    expect(hasAddress({ name: "Sauna" })).toBe(false);
  });

  it("builds a single-owner Maps URL from name + address + postcode", () => {
    const loc = { name: "Steamworks", address: "Shoreditch", postcode: "EC2A" };
    expect(buildMapsQuery(loc)).toBe("Steamworks, Shoreditch, EC2A");
    expect(buildMapsSearchUrl(loc)).toBe(MAPS_SEARCH_BASE + encodeURIComponent("Steamworks, Shoreditch, EC2A"));
    expect(buildMapsQuery({ name: "Sauna" })).toBe("Sauna"); // a name alone is a valid Maps search
    expect(buildMapsSearchUrl({})).toBe(null); // truly nothing to navigate to
  });

  it("groups by type then name, untyped last, excluding archived/unnamed", () => {
    const groups = groupLocationsByType([
      { name: "B", type: "🛀 Sauna" }, { name: "A", type: "🛀 Sauna" },
      { name: "Clinic", type: "🏥 Clinic" }, { name: "NoType" },
      { name: "", type: "x" }, { name: "Archived", isArchived: true },
    ]);
    expect(groups.map((g) => g.label)).toEqual(["🏥 Clinic", "🛀 Sauna", "Untyped"]);
    expect(groups[1].locations.map((l) => l.name)).toEqual(["A", "B"]);
  });

  it("flags missing addresses by usage with an always-needed type override", () => {
    expect(needsAddressNudge({ name: "His Car", type: "🚗 His Car" }, { usedByCount: 0 })).toBe(false);
    expect(needsAddressNudge({ name: "His Car", type: "🚗 His Car" }, { usedByCount: 2 })).toBe(true);
    expect(needsAddressNudge({ name: "Clinic", type: "🏥 Clinic" }, { usedByCount: 0 })).toBe(true);
    expect(needsAddressNudge({ name: "C", address: "x" }, { usedByCount: 3 })).toBe(false);
    expect(needsAddressNudge({ name: "" })).toBe(false);
  });
});

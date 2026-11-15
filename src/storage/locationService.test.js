// locationService.test.js
//
// Guards the fix for the "maps plugin recognised street address but strips
// the house number unwantedly" finding (15 Nov 2026). summarizePlaceName()
// builds a short venue-style label from a Nominatim reverse-geocode result.
// It must keep the house number so a user's own address isn't silently
// reduced to "Road, Area" — which is exactly the defect reported.

import { describe, it, expect } from "vitest";
import { summarizePlaceName } from "./locationService.js";

describe("summarizePlaceName", () => {
  it("keeps the house number when present", () => {
    const place = {
      address: { house_number: "42", road: "High Street", suburb: "Old Town" },
      display_name: "42 High Street, Old Town",
    };
    expect(summarizePlaceName(place)).toBe("42 High Street, Old Town");
  });

  it("falls back to road + area when no house number", () => {
    const place = {
      address: { road: "High Street", suburb: "Old Town" },
      display_name: "High Street, Old Town",
    };
    expect(summarizePlaceName(place)).toBe("High Street, Old Town");
  });

  it("uses house number alone when road is missing", () => {
    const place = {
      address: { house_number: "42", suburb: "Old Town" },
      display_name: "42, Old Town",
    };
    expect(summarizePlaceName(place)).toBe("42, Old Town");
  });

  it("prefers a named place over the street address", () => {
    const place = {
      name: "The Rose & Crown",
      address: { house_number: "42", road: "High Street", suburb: "Old Town" },
      display_name: "The Rose & Crown, 42 High Street, Old Town",
    };
    expect(summarizePlaceName(place)).toBe("The Rose & Crown");
  });

  it("falls back to display_name when nothing else is available", () => {
    const place = { address: {}, display_name: "Somewhere, UK" };
    expect(summarizePlaceName(place)).toBe("Somewhere, UK");
  });
});

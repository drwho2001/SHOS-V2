import { describe, it, expect } from "vitest";
import { formatEncounterLocation, ANONYMISED_LOCATION } from "./encounterLocationLabel.js";
import { ANONYMISED } from "./anonymiseDisplay.js";

describe("hotel / temporary encounter location label", () => {
  it("uses the app's one anonymise sentinel, not a second spelling", () => {
    expect(ANONYMISED_LOCATION).toBe(ANONYMISED);
  });

  it("keeps a saved place and a one-off hotel stay visibly separate", () => {
    expect(formatEncounterLocation({ savedName: "His place", temporary: "Hotel X, room 412" }))
      .toBe("His place · Hotel X, room 412");
  });

  it("works when only one source is present", () => {
    expect(formatEncounterLocation({ savedName: "Sauna" })).toBe("Sauna");
    expect(formatEncounterLocation({ temporary: "Hotel X" })).toBe("Hotel X");
    expect(formatEncounterLocation()).toBe("");
  });

  it("masks only the one-off text; the saved label is the caller's own vocabulary", () => {
    expect(formatEncounterLocation({ savedName: "His place", temporary: "Hotel X", anonymise: true }))
      .toBe(`His place · ${ANONYMISED}`);
    expect(formatEncounterLocation({ temporary: "Hotel X", anonymise: true })).toBe(ANONYMISED);
  });
});

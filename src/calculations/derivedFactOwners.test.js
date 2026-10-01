import { describe, it, expect } from "vitest";
import {
  episodeResolvedDayKey,
  isEpisodeOpen,
  isEpisodeResolved,
  compareEpisodesOpenFirst,
  episodeStatusLabel,
  episodeGroupKey,
} from "./episodeCalculations";
import { classifyMeasurement } from "./measurementCalculations";

// Tests for the two owners the t053 audit created. Two things are being pinned
// here, and the second is the more important:
//
//   1. The new behaviour - a present-but-unparseable resolvedDate is now treated
//      as OPEN, where the four old truthiness spellings treated it as resolved.
//   2. The EXACT strings the replaced code produced, character for character.
//      That is not ceremony: my first version of episodeStatusLabel used a plain
//      hyphen where the original used an em dash, which silently changed a
//      user-visible character and would have shipped on a green suite.

const fmt = (dayKey) => `formatted(${dayKey})`;
const month = (dayKey) => `month(${dayKey})`;

describe("episode resolution", () => {
  it("treats a missing, empty or whitespace date as open", () => {
    for (const ep of [
      undefined,
      null,
      {},
      { resolvedDate: null },
      { resolvedDate: "" },
      { resolvedDate: "   " },
    ]) {
      expect(isEpisodeOpen(ep), JSON.stringify(ep)).toBe(true);
      expect(isEpisodeResolved(ep)).toBe(false);
    }
  });

  it("treats a present, parseable date as resolved", () => {
    const ep = { resolvedDate: "2026-03-05" };
    expect(isEpisodeOpen(ep)).toBe(false);
    expect(isEpisodeResolved(ep)).toBe(true);
    expect(episodeResolvedDayKey(ep)).toBe("2026-03-05");
  });

  it("treats a present but UNPARSEABLE date as open, not resolved", () => {
    // The behavioural tightening. Every old spelling was `!x.resolvedDate` or
    // `x.resolvedDate ? ... : ...`, so any non-empty string counted as resolved
    // and would have sorted the episode into the resolved group under a date
    // that renders as "Invalid Date".
    //
    // "0" was in my first list and the test failed on it: JavaScript parses it as
    // 1 Jan 2000. Corrected after measuring rather than by loosening the
    // assertion - the parser is more permissive than I assumed, and a test that
    // is edited until it passes is how a wrong belief becomes a shipped one.
    for (const bad of ["not-a-date", "13/45/2026", "undefined", "March"]) {
      expect(isEpisodeOpen({ resolvedDate: bad }), bad).toBe(true);
      expect(episodeResolvedDayKey({ resolvedDate: bad })).toBeNull();
    }
  });

  it("sorts open episodes before resolved, newest first within each group", () => {
    const eps = [
      { id: "r-old", resolvedDate: "2026-01-01", _date: "2026-05-01T00:00:00.000Z" },
      { id: "o-new", resolvedDate: null, _date: "2026-06-02T00:00:00.000Z" },
      { id: "r-new", resolvedDate: "2026-03-01", _date: "2026-06-01T00:00:00.000Z" },
      { id: "o-old", resolvedDate: "", _date: "2026-04-01T00:00:00.000Z" },
    ];
    expect([...eps].sort(compareEpisodesOpenFirst).map((e) => e.id)).toEqual([
      "o-new",
      "o-old",
      "r-new",
      "r-old",
    ]);
  });

  it("reproduces the exact open/closed strings the replaced code produced", () => {
    // Character-for-character against the original expressions:
    //   isOpen ? (hasPositive ? "Open · positive result found" : "Open") : ...
    const open = { resolvedDate: null };
    expect(episodeStatusLabel(open, true, fmt)).toBe("Open \u00b7 positive result found");
    expect(episodeStatusLabel(open, false, fmt)).toBe("Open");

    // Card form: no resolution suffix.
    expect(episodeStatusLabel({ resolvedDate: "2026-03-05", resolution: "Treated" }, false, fmt)).toBe(
      "Resolved formatted(2026-03-05)"
    );

    // Detail form: EM DASH separator, then the resolution.
    expect(
      episodeStatusLabel({ resolvedDate: "2026-03-05", resolution: "Treated" }, false, fmt, {
        showResolution: true,
      })
    ).toBe("Resolved formatted(2026-03-05) \u2014 Treated");

    // Detail form with an EMPTY resolution: the old code appended the em dash and
    // an empty string. Preserved rather than "improved", because this audit does
    // not get to make presentation changes silently.
    expect(
      episodeStatusLabel({ resolvedDate: "2026-03-05", resolution: "" }, false, fmt, {
        showResolution: true,
      })
    ).toBe("Resolved formatted(2026-03-05) \u2014 ");
  });

  it("groups every open episode under one key, resolved by month", () => {
    expect(episodeGroupKey({ resolvedDate: null }, month)).toBe("Open");
    expect(episodeGroupKey({ resolvedDate: "2026-03-05" }, month)).toBe("month(2026-03-05)");
  });
});

describe("measurement classification", () => {
  const prefs = { normalRangeByType: { Weight: { low: 60, high: 75 } } };

  it("classifies against the user's own range only", () => {
    expect(classifyMeasurement({ type: "Weight", value: 67.5 }, prefs)).toBe("normal");
    expect(classifyMeasurement({ type: "Weight", value: 55 }, prefs)).toBe("low");
    expect(classifyMeasurement({ type: "Weight", value: 90 }, prefs)).toBe("high");
  });

  it("returns null rather than guessing when no range is set", () => {
    expect(classifyMeasurement({ type: "Weight", value: 67.5 }, {})).toBeNull();
    expect(classifyMeasurement({ type: "Weight", value: 67.5 }, { normalRangeByType: {} })).toBeNull();
    expect(classifyMeasurement({ type: "Weight", value: 67.5 }, { normalRangeByType: { Weight: { low: 60 } } })).toBeNull();
  });

  it("returns null for a missing value, and for an excluded type", () => {
    expect(classifyMeasurement({ type: "Weight" }, prefs)).toBeNull();
    expect(classifyMeasurement({ type: "Weight", value: null }, prefs)).toBeNull();
    // Blood pressure is two values, so low/high/normal does not apply.
    expect(classifyMeasurement({ type: "Blood pressure", value: 120 }, prefs, "Blood pressure")).toBeNull();
  });
});

// Tests for the extracted cycle-widget logic.
//
// The widget lives behind a Capacitor plugin bridge inside an async function in
// a large JSX file, so before this extraction NONE of it could be exercised
// without a device. That is why three defects sat in it, and the one that had
// nothing to do with timezones is arguably the worst:
//
//   1. cycleDay divided elapsed MILLISECONDS between a real instant and a stored
//      fake-UTC value, so it could report the wrong day - and therefore the
//      wrong PHASE - depending on the user's UTC offset.
//   2. the predicted next-period date was rendered with no timeZone, so west of
//      UTC the home screen showed the previous day.
//   3. `avgLength * 86400000` with NO null guard, and
//      getAverageCycleLengthDays() returns null below two logged cycles - so a
//      user with one cycle was told their next period was due the day their
//      last one started.
//
// (3) is the argument for extracting this: it is not a timezone bug, and no
// number of timezone variants would ever have surfaced it.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  getCycleDay,
  getCyclePhase,
  getNextPeriodDayKey,
  formatDayKeyForDisplay,
  getDaysUntilNextPeriod,
  getCycleRegularity,
  getCycleSymptomCorrelation,
} from "./menstrualCalculations.js";
// The day-key primitives moved to dateInputHelpers when this became the third
// copy of them written in a day. Re-pointed here deliberately rather than
// re-exported from menstrualCalculations: a re-export would leave two doors
// to one fact, and "single entry, multiple access" means exactly one.
import { storedDayKey, localDayKey } from "./dateInputHelpers";

// Source-level wiring assertions. This project has shipped a feature whose hook
// worked perfectly in unit tests while a sweep silently failed to attach it to
// the component that mattered, and the widget's three defects survived for a
// different version of the same reason: the logic was INLINE, so no test could
// reach it. Extracting it is only half the job - the call site has to be proven.
// RETARGETED 4 Oct 2026. updateCycleWidget moved out of the JSX into
// src/calculations/cycleWidgetSync.js so the central syncAllWidgets could import
// it - a pusher trapped inside a React module can only be called from that
// module's own handlers, which is why the Cycle widget refreshed on cycle create
// and never on edit or delete.
//
// The assertion's INTENT is unchanged and still worth having: this widget must use
// the pure helpers rather than inline arithmetic, because three real defects
// (elapsed-millisecond cycleDay, a predicted date with no timeZone, and an
// unguarded avgLength) came from exactly that. Only the file it reads moved. The
// old path is asserted empty below so this cannot silently drift back.
const WIDGET_SRC = readFileSync(
  path.join(process.cwd(), "src", "calculations", "cycleWidgetSync.js"),
  "utf8",
);

describe("the widget pusher was not moved back into a React module", () => {
  it("does not live in SHOS_MenstrualHealth_Prototype.jsx any more", () => {
    const jsx = readFileSync(
      path.join(process.cwd(), "src", "modules", "SHOS_MenstrualHealth_Prototype.jsx"),
      "utf8",
    );
    expect(
      jsx.includes("async function updateCycleWidget"),
      "updateCycleWidget is back inside the JSX - the central sync cannot import it from there",
    ).toBe(false);
  });
});

// Comments are stripped before any negative assertion, and the stripper is
// proven non-vacuous below. This is the recorded reason several earlier guards
// in this project matched the comment documenting the very fix they were checking
// for - and the comment above the widget's fix quotes `86400000` verbatim, so
// without this the very first assertion fails on its own documentation.
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// The widget function is followed by other functions, so a naive
// `indexOf("async function", ...)` returning -1 made `slice(start, -1)` return
// everything to end-of-file - which is how the first version of this guard
// matched its own documentation, and the second matched two unrelated functions
// further down the file. The boundary is the next top-level function of ANY kind.
function widgetBody() {
  const start = WIDGET_SRC.indexOf("async function updateCycleWidget");
  if (start < 0) return null;
  const m = WIDGET_SRC.slice(start + 10).match(/\n(?:export\s+)?(?:async\s+)?function\s/);
  const end = m ? start + 10 + m.index : WIDGET_SRC.length;
  return stripComments(WIDGET_SRC.slice(start, end));
}

describe("the widget actually calls the extracted logic", () => {
  it("updateCycleWidget uses the pure helpers, not inline arithmetic", () => {
    const body = widgetBody();
    expect(body, "updateCycleWidget exists").not.toBeNull();

    expect(body, "must use the pure cycle-day helper").toMatch(/getCycleDay\(/);
    expect(body, "must use the pure phase helper").toMatch(/getCyclePhase\(/);
    expect(body, "must use the pure prediction helper").toMatch(/getNextPeriodDayKey\(/);
    expect(body, "must use the UTC-safe formatter").toMatch(/formatDayKeyForDisplay\(/);
  });

  it("no elapsed-milliseconds division between an instant and a stored date survives", () => {
    // The shape of the original bug, asserted directly so it cannot be
    // reintroduced by a later edit that "just inlines a quick calculation".
    const body = widgetBody();
    expect(body, "no 86400000 in the widget body").not.toMatch(/86400000/);
    expect(body, "no 24 * 60 * 60 arithmetic in the widget body")
      .not.toMatch(/24\s*\*\s*60\s*\*\s*60/);
  });

  it("the phase thresholds live in one place, not restated at the call site", () => {
    // A second copy of the day thresholds is how the widget and the screen would
    // drift into reporting different phases for the same day.
    const body = widgetBody();
    expect(body, "no inline phase thresholds").not.toMatch(/cycleDay\s*<=\s*\d/);
  });

  it("the comment stripper is not vacuous", () => {
    // A stripper that removed too much would make the three assertions above
    // pass for the wrong reason. Proven by checking real code survives it, and
    // that a banned expression living in a comment is NOT reported.
    const body = widgetBody();
    expect(body).toMatch(/getCycleDay/);
    expect(stripComments("// 86400000 is banned\nconst x = 1;")).not.toMatch(/86400000/);
  });
});

describe("cycle day - the user's own day, not elapsed milliseconds from UTC", () => {
  it("the start date itself is day 1", () => {
    // Built from LOCAL components. The first version of this assertion used
    // `new Date("2026-09-10T12:00:00Z")` with a comment claiming midday UTC is
    // "unambiguous in every zone the suite runs" - which is false, and
    // Pacific/Chatham proved it: at +12:45, 12:00 UTC is already 00:45 on the
    // NEXT local day, so day 2 was the correct answer and the test was the bug.
    //
    // A 45-minute offset is the only reason that zone is in the suite at all,
    // and it caught a false universality claim in three lines. Constructing from
    // local components makes "the local day is the stored day" true everywhere.
    const localMiddayOnStart = new Date(2026, 8, 10, 12, 0, 0);
    expect(localDayKey(localMiddayOnStart)).toBe("2026-09-10");
    expect(getCycleDay("2026-09-10", localMiddayOnStart)).toBe(1);
  });

  it("the next calendar day is day 2, even late at night on the start day", () => {
    // THE FAILING CASE, and the reason this test constructs its instants from
    // LOCAL components rather than from UTC strings.
    //
    // At 22:00 on 10 Sep, most of the world is on their FIRST day of the cycle.
    // Dividing elapsed milliseconds between that real instant and the stored
    // fake-UTC value gives more than a full day in every zone behind UTC, so the
    // original code reported day 2 - telling someone on their first day that
    // they were on their second, and shifting the phase with it.
    //
    // Built as local 22:00 on the start date, so "the local day equals the
    // stored day" is true in EVERY zone and the assertion is not a bet on the
    // runner's offset. An earlier version of this test used fixed UTC instants
    // and therefore only held in New York.
    const lateEveningOnStartDay = new Date(2026, 8, 10, 22, 0, 0);
    expect(localDayKey(lateEveningOnStartDay)).toBe("2026-09-10");
    expect(getCycleDay("2026-09-10", lateEveningOnStartDay)).toBe(1);
    expect(getCycleDay("2026-09-10", new Date(2026, 8, 10, 23, 59, 0))).toBe(1);
    expect(getCycleDay("2026-09-10", new Date(2026, 8, 11, 0, 1, 0))).toBe(2);
  });

  it("counts whole calendar days, not elapsed 24-hour blocks", () => {
    // 09:30 on 11 Sep is under half a day after 09:30 on 10 Sep, yet it is
    // unambiguously the second day of the cycle.
    const morningNextDay = new Date(2026, 8, 11, 9, 30, 0);
    expect(getCycleDay("2026-09-10", morningNextDay)).toBe(2);
  });

  it("never reports zero or a negative day for a future-dated record", () => {
    // A record dated ahead of today is possible (a planned cycle). "day 0" or
    // "day -3" on a home-screen widget is worse than a clamped 1. Local
    // components again, for the same reason as the test above.
    const now = new Date(2026, 8, 10, 12, 0, 0);
    expect(getCycleDay("2026-09-20", now)).toBe(1);
  });

  it("declines to answer without a usable start date", () => {
    const now = new Date(2026, 8, 10, 12, 0, 0);
    expect(getCycleDay(null, now)).toBeNull();
    expect(getCycleDay("", now)).toBeNull();
    expect(getCycleDay("nonsense", now)).toBeNull();
  });

  it("reads the stored day without shifting it", () => {
    // A stored "2026-09-01" is UTC midnight, which is 31 Aug in the west. The
    // key must be the digits the user typed, or the whole basis is wrong.
    expect(storedDayKey("2026-09-01")).toBe("2026-09-01");
    expect(storedDayKey("2026-09-01T09:30:00.000Z")).toBe("2026-09-01");
    expect(storedDayKey(null)).toBeNull();
  });
});

describe("cycle phase follows the same boundaries the screen uses", () => {
  it("maps the documented day ranges", () => {
    expect(getCyclePhase(1)).toBe("Menstrual");
    expect(getCyclePhase(7)).toBe("Menstrual");
    expect(getCyclePhase(8)).toBe("Follicular");
    expect(getCyclePhase(14)).toBe("Follicular");
    expect(getCyclePhase(15)).toBe("Ovulatory");
    expect(getCyclePhase(21)).toBe("Ovulatory");
    expect(getCyclePhase(22)).toBe("Luteal");
  });

  it("is derived from cycleDay, so a wrong day means a wrong phase", () => {
    // This is the amplification that made defect 1 worth fixing: day 7 and
    // day 8 are "Menstrual" and "Follicular" respectively, so an off-by-one day
    // changes what the user reads about their own body.
    expect(getCyclePhase(7)).not.toBe(getCyclePhase(8));
  });

  it("declines rather than guessing on a non-number", () => {
    expect(getCyclePhase(null)).toBeNull();
    expect(getCyclePhase(undefined)).toBeNull();
  });
});

describe("next period prediction - the null-average bug", () => {
  it("adds the average cycle length to the start date", () => {
    expect(getNextPeriodDayKey("2026-09-10", 28)).toBe("2026-10-08");
  });

  it("returns null when there is not enough history to average", () => {
    // THE BUG. getAverageCycleLengthDays() returns null below two logged
    // cycles. The original expression was `avgLength * 86400000`, and
    // `null * anything` is 0, so the prediction collapsed onto the START date -
    // the widget told a user with one recorded cycle that their next period was
    // due on the day their last one started.
    expect(getNextPeriodDayKey("2026-09-10", null)).toBeNull();
    expect(getNextPeriodDayKey("2026-09-10", undefined)).toBeNull();
  });

  it("rejects a nonsensical average rather than predicting nonsense", () => {
    expect(getNextPeriodDayKey("2026-09-10", 0)).toBeNull();
    expect(getNextPeriodDayKey("2026-09-10", -5)).toBeNull();
    expect(getNextPeriodDayKey("2026-09-10", NaN)).toBeNull();
  });

  it("handles a prediction that crosses a year boundary", () => {
    expect(getNextPeriodDayKey("2026-12-20", 28)).toBe("2027-01-17");
  });
});

describe("the prediction renders on the day it names", () => {
  it("renders the day the key says, not the day before it", () => {
    // Compared against the digits rather than a rendered string, because
    // `day: "numeric"` renders 1 September as "1", not "01", and asserting a
    // padded form is the locale trap this project has now fallen into three
    // times. What must hold is that the output names the 1st and not the 31st
    // of the previous month - which is exactly what a missing timeZone does.
    const rendered = formatDayKeyForDisplay("2026-09-01");
    expect(rendered, "must name the 1st").toMatch(/\b1\b/);
    expect(rendered, "must not name the previous month's last day").not.toMatch(/31/);
  });

  it("returns null rather than a broken string for a bad key", () => {
    expect(formatDayKeyForDisplay(null)).toBeNull();
    expect(formatDayKeyForDisplay("not-a-date")).toBeNull();
  });
});

describe("localDayKey is the user's own day, which is a different frame", () => {
  it("is the LOCAL date, and that is deliberate", () => {
    // "Which day of my cycle am I on" is a question a person answers in their
    // own days, so `now` is reduced LOCALLY while the stored start date is read
    // in its own stored frame. The two are deliberately different frames, and
    // pretending otherwise is what produced the original bug.
    //
    // The assertion is structural, not a specific date: a version of this test
    // asserted a literal local date and therefore only held in one timezone,
    // which is the mistake this project keeps making with locale-sensitive
    // expectations.
    expect(localDayKey(new Date(2026, 8, 10, 22, 0, 0))).toBe("2026-09-10");
    expect(localDayKey(new Date(2026, 8, 11, 0, 1, 0))).toBe("2026-09-11");
    expect(localDayKey(new Date())).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("days until next period - the at-a-glance number", () => {
  it("returns the number of days between today and the predicted date", () => {
    // 2026-09-10 + 28 days = 2026-10-08. If "today" is 2026-09-20, that's 18 days.
    const now = new Date(2026, 8, 20, 12, 0, 0);
    expect(localDayKey(now)).toBe("2026-09-20");
    expect(getDaysUntilNextPeriod("2026-09-10", 28, now)).toBe(18);
  });

  it("returns 0 when the prediction is today", () => {
    const now = new Date(2026, 9, 8, 12, 0, 0);
    expect(localDayKey(now)).toBe("2026-10-08");
    expect(getDaysUntilNextPeriod("2026-09-10", 28, now)).toBe(0);
  });

  it("returns negative when the prediction has passed - overdue, not an error", () => {
    const now = new Date(2026, 9, 15, 12, 0, 0);
    expect(localDayKey(now)).toBe("2026-10-15");
    const days = getDaysUntilNextPeriod("2026-09-10", 28, now);
    expect(days).toBeLessThan(0);
    expect(days).toBe(-7);
  });

  it("returns null when there is no prediction", () => {
    const now = new Date(2026, 8, 20, 12, 0, 0);
    expect(getDaysUntilNextPeriod("2026-09-10", null, now)).toBeNull();
    expect(getDaysUntilNextPeriod("2026-09-10", 0, now)).toBeNull();
    expect(getDaysUntilNextPeriod(null, 28, now)).toBeNull();
  });

  it("is an estimate of an estimate - never a certain countdown", () => {
    // The function returns a number, not a promise. The LABEL (est.) is the
    // caller's job, and the test pins that the number alone carries no
    // certainty. This is a documentation assertion, not a behaviour one.
    const now = new Date(2026, 8, 20, 12, 0, 0);
    const days = getDaysUntilNextPeriod("2026-09-10", 28, now);
    expect(typeof days).toBe("number");
  });
});

describe("cycle regularity - a description, not a prediction", () => {
  it("returns null with fewer than two cycles", () => {
    expect(getCycleRegularity([])).toBeNull();
    expect(getCycleRegularity(["2026-09-10"])).toBeNull();
    expect(getCycleRegularity(null)).toBeNull();
  });

  it("returns min, max, average and count", () => {
    const r = getCycleRegularity(["2026-09-10", "2026-10-08", "2026-11-05"]);
    expect(r).not.toBeNull();
    expect(r.min).toBe(28);
    expect(r.max).toBe(28);
    expect(r.average).toBe(28);
    expect(r.count).toBe(2);
  });

  it("shows the range when cycles vary", () => {
    const r = getCycleRegularity(["2026-09-10", "2026-10-05", "2026-11-08"]);
    expect(r).not.toBeNull();
    expect(r.min).toBe(25);
    expect(r.max).toBe(34);
    expect(r.average).toBe(30); // (25+34)/2 = 29.5, rounded to 30
    // Actually 25+34=59, 59/2=29.5, Math.round=30
    expect(r.average).toBe(30);
    expect(r.count).toBe(2);
  });

  it("does not predict anything - it only describes what happened", () => {
    // The function returns a description of logged data. It must not be
    // used to predict future cycles or to make clinical claims. This is a
    // documentation assertion.
    const r = getCycleRegularity(["2026-09-10", "2026-10-08"]);
    expect(r).toHaveProperty("min");
    expect(r).toHaveProperty("max");
    expect(r).toHaveProperty("average");
    expect(r).toHaveProperty("count");
    // No prediction fields
    expect(r).not.toHaveProperty("nextPeriod");
    expect(r).not.toHaveProperty("ovulation");
    expect(r).not.toHaveProperty("fertile");
  });

  it("handles unsorted input", () => {
    const r = getCycleRegularity(["2026-11-05", "2026-09-10", "2026-10-08"]);
    expect(r).not.toBeNull();
    expect(r.min).toBe(28);
    expect(r.max).toBe(28);
    expect(r.count).toBe(2);
  });

  it("filters out invalid dates", () => {
    const r = getCycleRegularity(["2026-09-10", null, "", "2026-10-08"]);
    expect(r).not.toBeNull();
    expect(r.count).toBe(1);
  });
});

describe("symptom correlation - experimental, informational only", () => {
  it("returns empty for no cycles", () => {
    expect(getCycleSymptomCorrelation([])).toEqual([]);
    expect(getCycleSymptomCorrelation(null)).toEqual([]);
  });

  it("returns empty when no symptoms are logged", () => {
    const cycles = [
      { symptomIds: [] },
      { symptomIds: [] },
    ];
    expect(getCycleSymptomCorrelation(cycles)).toEqual([]);
  });

  it("counts symptom frequency across cycles", () => {
    const cycles = [
      { symptomIds: ["s1", "s2"] },
      { symptomIds: ["s1"] },
      { symptomIds: ["s2", "s3"] },
    ];
    const result = getCycleSymptomCorrelation(cycles);
    expect(result).toHaveLength(3);
    // s1: 2/3 = 67%
    const s1 = result.find((r) => r.symptomId === "s1");
    expect(s1.count).toBe(2);
    expect(s1.total).toBe(3);
    expect(s1.frequency).toBe(67);
    // s2: 2/3 = 67%
    const s2 = result.find((r) => r.symptomId === "s2");
    expect(s2.count).toBe(2);
    expect(s2.total).toBe(3);
    // s3: 1/3 = 33%
    const s3 = result.find((r) => r.symptomId === "s3");
    expect(s3.count).toBe(1);
    expect(s3.total).toBe(3);
    expect(s3.frequency).toBe(33);
  });

  it("respects the lookback limit", () => {
    const cycles = [
      { symptomIds: ["s1"] },
      { symptomIds: ["s1"] },
      { symptomIds: ["s1"] },
      { symptomIds: ["s2"] },
    ];
    const result = getCycleSymptomCorrelation(cycles, 2);
    expect(result).toHaveLength(1);
    expect(result[0].symptomId).toBe("s1");
    expect(result[0].total).toBe(2);
  });

  it("sorts by frequency descending", () => {
    const cycles = [
      { symptomIds: ["s1", "s2"] },
      { symptomIds: ["s1", "s2"] },
      { symptomIds: ["s2"] },
    ];
    const result = getCycleSymptomCorrelation(cycles);
    expect(result[0].symptomId).toBe("s2"); // 3/3 = 100%
    expect(result[1].symptomId).toBe("s1"); // 2/3 = 67%
  });

  it("handles missing symptomIds gracefully", () => {
    const cycles = [
      { symptomIds: null },
      { symptomIds: undefined },
      { /* no symptomIds */ },
    ];
    expect(getCycleSymptomCorrelation(cycles)).toEqual([]);
  });

  it("is a description, not a diagnosis - no medical claims in the output", () => {
    const cycles = [{ symptomIds: ["s1"] }];
    const result = getCycleSymptomCorrelation(cycles);
    // The output only contains counts and frequencies, never medical terms
    for (const r of result) {
      expect(r).toHaveProperty("symptomId");
      expect(r).toHaveProperty("count");
      expect(r).toHaveProperty("total");
      expect(r).toHaveProperty("frequency");
      // No diagnostic fields
      expect(r).not.toHaveProperty("diagnosis");
      expect(r).not.toHaveProperty("condition");
      expect(r).not.toHaveProperty("recommendation");
    }
  });
});

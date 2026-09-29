// Timezone audit, part 2 of t020 - the Stats chart buckets in
// statsCalculations.js.
//
// Found by enumerating every toLocale*/local-getter date site and triaging by
// VALUE, not by name. That triage immediately paid for itself, because the three
// month-bucketing functions in this file are NOT the same bug:
//
//   getActivitiesPerMonth      buckets e.date   - a STORED fake-UTC value. BUG.
//   getClinicVisitsPerMonth    buckets v.date   - a STORED fake-UTC value. BUG.
//   getContactsAddedPerMonth   buckets c.createdAt - a REAL INSTANT. Correct.
//
// Two of the three read a stored date through LOCAL getMonth()/getFullYear(). A
// stored value of "2026-09-01" parses as UTC midnight, which is 20:00 on 31 Aug
// in New York - so an encounter logged on the first of the month is counted in
// the PREVIOUS month's bar, silently, with no visible anomaly anywhere.
//
// That is worse than the export bug this file was found alongside. A wrong date
// on one exported record is visible to one person. A chart that is quietly one
// month out for every first-of-the-month record is read as fact, and the bucket
// for the current month is the one people actually look at.
//
// A blanket sweep would have "fixed" getContactsAddedPerMonth too and broken it,
// which is why this is per-value.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { getActivitiesPerMonth, getClinicVisitsPerMonth, getContactsAddedPerMonth } from "./statsCalculations.js";

const FIRST_OF_MONTH = "2026-09-01";
const LAST_OF_MONTH = "2026-08-31";

const nonZero = (buckets) => buckets.filter((b) => b.count > 0);
const sumCounts = (buckets) => buckets.reduce((n, b) => n + b.count, 0);

// THE CLOCK IS PINNED, and that is what makes this file deterministic across
// timezones rather than merely reproducible on one machine. The first version
// used the real "now", so in New York the local month was 31 August and a 1 Sep
// record had no bucket to fall into - a correct implementation would have
// looked broken, and the test was measuring the calendar rather than the
// bucket rule.
//
// Mid-month midday UTC keeps the LOCAL month equal to September in every zone
// the suite runs (Chatham +12:45 lands on the 16th, New York -04:00 on the
// 15th), so both the 1st and the 31st of the neighbouring month are inside the
// window everywhere.
const PINNED_NOW = new Date("2026-09-15T12:00:00.000Z");

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(PINNED_NOW); });
afterAll(() => { vi.useRealTimers(); });

describe("stats month buckets - a stored date belongs to the month the user typed", () => {
  it("an encounter on the first of a month is counted in THAT month", () => {
    // The exact failing shape: 1 Sep stored, bucketed as August west of UTC.
    const buckets = getActivitiesPerMonth([{ date: FIRST_OF_MONTH }], 6);
    const counted = nonZero(buckets);
    expect(counted, "the encounter must land in exactly one bucket").toHaveLength(1);
    expect(
      counted[0].label,
      `1 Sep must bucket to September, got "${counted[0].label}"`,
    ).toMatch(/Sep/i);
  });

  it("an encounter on the last day of a month stays in that month", () => {
    // The mirror image, and the one that catches a fix that simply shifted
    // everything forward: 31 Aug must not roll into September.
    const buckets = getActivitiesPerMonth([{ date: LAST_OF_MONTH }], 6);
    const counted = nonZero(buckets);
    expect(counted).toHaveLength(1);
    expect(counted[0].label, `31 Aug must bucket to August, got "${counted[0].label}"`).toMatch(/Aug/i);
  });

  it("counts every record, wherever it falls", () => {
    // Guards against the over-correction: "fixing" this by dropping records
    // outside the window would also make the wrong-month test pass.
    const buckets = getActivitiesPerMonth(
      [{ date: FIRST_OF_MONTH }, { date: LAST_OF_MONTH }, { date: "2026-07-15" }],
      6,
    );
    expect(sumCounts(buckets)).toBe(3);
  });

  it("a clinic visit on the first of a month is counted in THAT month", () => {
    const buckets = getClinicVisitsPerMonth(
      [{ date: FIRST_OF_MONTH, isFutureAppointment: false }],
      6,
    );
    const counted = nonZero(buckets);
    expect(counted).toHaveLength(1);
    expect(counted[0].label, `1 Sep must bucket to September, got "${counted[0].label}"`).toMatch(/Sep/i);
  });

  it("a clinic visit on the last day of a month stays in that month", () => {
    const buckets = getClinicVisitsPerMonth(
      [{ date: LAST_OF_MONTH, isFutureAppointment: false }],
      6,
    );
    const counted = nonZero(buckets);
    expect(counted).toHaveLength(1);
    expect(counted[0].label, `31 Aug must bucket to August, got "${counted[0].label}"`).toMatch(/Aug/i);
  });

  it("still honours the archived and future-appointment filters", () => {
    // A fix that changed which records are counted would be a worse bug than a
    // mislabelled bar, so the existing behaviour is pinned alongside.
    const buckets = getClinicVisitsPerMonth(
      [
        { date: FIRST_OF_MONTH, isFutureAppointment: true },
        { date: "2026-08-15", isFutureAppointment: false, isArchived: true },
        { date: "2026-08-15", isFutureAppointment: false },
      ],
      6,
    );
    expect(sumCounts(buckets)).toBe(1);
  });
});

describe("stats month buckets - a real instant stays in the device's own month", () => {
  it("createdAt is bucketed locally, and is NOT dragged into UTC", () => {
    // The counter-test. getContactsAddedPerMonth reads a genuine instant, so it
    // is correct as written and any sweep that "fixes" it with getUTCMonth()
    // would break it. A test that only covered the two broken functions would
    // let that regression through.
    const buckets = getContactsAddedPerMonth([{ createdAt: FIRST_OF_MONTH }], 6);
    const counted = nonZero(buckets);
    expect(counted).toHaveLength(1);
    const utc = new Date(FIRST_OF_MONTH);
    expect(
      counted[0].label,
      "createdAt must bucket by the device's own month, not the UTC one",
    ).toMatch(new RegExp(`^${utc.toLocaleDateString(undefined, { month: "short" })}`, "i"));
  });
});

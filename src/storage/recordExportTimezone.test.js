// Timezone audit for the RECORD EXPORT path - src/storage/recordExportService.js.
//
// Found by the t020 read-only enumeration of every toLocale* call site outside
// the shared date helpers, then triaged by hand rather than by name: every date
// field on a stored record is a fake-UTC value in this app, so all of them are
// stored values, not instants.
//
// This is the highest-stakes place the bug class can land, because the export is
// the artefact a clinician is handed. A record saying 13 Mar when the user logged
// 14 Mar is a wrong date on a medical document, not a slightly-off display.
//
// TWO INDEPENDENT BUGS IN THE SAME EIGHT LINES, which is why the export is
// worth its own test rather than a line in a sweep:
//
//   1. The rendered date is shifted, because toLocaleDateString is called with
//      no timeZone on a value whose digits are literal wall-clock.
//   2. The date-only DETECTION is itself timezone-dependent. `value.length <= 10`
//      was not used to decide "this is a date"; instead the code checked
//      `d.toTimeString().startsWith("00:00:00")`, i.e. whether the parsed value
//      is midnight IN THE DEVICE'S OWN ZONE. A YYYY-MM-DD value parses as UTC
//      midnight, so in New York it is 19:00 the previous day and takes the
//      datetime branch - a plain calendar date is exported with a time on it,
//      or omitted, depending on where the user happens to be.
//
// The second is why a per-site eyeball would have missed this: the code LOOKS
// like it is checking the stored shape, and does something else entirely.
import { describe, it, expect } from "vitest";
import { buildRecordExportHtml } from "./recordExportService.js";

// Accepts either the en-GB or en-US word order, because these helpers format
// with an undefined locale and this project has been bitten twice by a test that
// only passed on the machine that wrote it. What is asserted is the DATE, which
// is the thing that must not move.
const hasDate = (html, y, m, d) => {
  const variants = [
    `${d} ${m} ${y}`,
    `${m} ${d}, ${y}`,
  ];
  return variants.some((v) => html.includes(v));
};

const DATE_ROW = (html, label) => {
  const m = html.match(new RegExp(`>${label}</td><td[^>]*>([^<]*)</td>`));
  return m ? m[1] : "";
};

describe("record export - a stored date must not move", () => {
  it("renders a stored calendar date as that calendar date", () => {
    // A plain YYYY-MM-DD field, as stored.
    const html = buildRecordExportHtml("encounters", {
      title: "Test export",
      date: "2026-03-14",
    });
    expect(hasDate(html, 2026, "Mar", 14)).toBe(true);
    expect(html).not.toMatch(/13\s+Mar\s+2026/);
    expect(html).not.toMatch(/Mar\s+13,\s+2026/);
  });

  it("renders a near-midnight stored date-time as that wall-clock time", () => {
    // The Encounters bug's exact shape: 00:30 local wall-clock on 14 Mar. In a
    // western zone a local render puts this on 13 Mar at 19:30, which is a
    // wrong DATE on a medical record rather than a slightly-off time.
    const html = buildRecordExportHtml("encounters", {
      title: "Test export",
      date: "2026-03-14T00:30:00.000Z",
    });
    const rendered = DATE_ROW(html, "Date");
    expect(hasDate(html, 2026, "Mar", 14)).toBe(true);
    // `hour: "numeric"` renders the wall clock 00:30 as "0:30" on this en-GB
    // machine and as "12:30 AM" on CI's en-US. THIS FILE HAS ALREADY BEEN
    // BITTEN BY THAT TWICE — once with an am/pm suffix that matched nothing
    // locally, and then with `0{1,2}:30` in this very line, which passed here
    // and failed on CI. LANG/LC_ALL do not affect Node's default locale on
    // Windows, so it cannot be reproduced locally at all; the only correct
    // response is an assertion that is right in every locale BY CONSTRUCTION.
    // So: accept both known renderings of the same wall clock, and no others.
    expect(rendered, `expected the wall clock 00:30, got ${JSON.stringify(rendered)}`)
      .toMatch(/(^|[^\d])(0{1,2}|12)[:.]30\b/);
  });

  it("the clock assertion above is neither too loose nor too tight", () => {
    // The pattern accepts exactly the renderings of 00:30 that en-GB and en-US
    // produce, and rejects an invented time. A guard on the guard, because a
    // pattern that is merely "something with a colon" would pass on the bug it
    // exists to catch - and one that hardcodes a single locale's spelling fails
    // on the other runner, which is precisely what happened twice.
    const ok = (s) => /(^|[^\d])(0{1,2}|12)[:.]30\b/.test(s);
    expect(ok("14 Mar 2026, 0:30")).toBe(true);    // en-GB
    expect(ok("Mar 14, 2026, 12:30 AM")).toBe(true); // en-US
    // The actual bug: a date-only value that gained a time on it.
    expect(ok("13 Mar 2026, 7:00 pm")).toBe(false);
    expect(ok("14 Mar 2026, 9:30 pm")).toBe(false);
    expect(ok("14 Mar 2026")).toBe(false);
  });

  it("renders a plain calendar date WITHOUT inventing a time on it", () => {
    // The timezone-dependent detection bug. A date-only value must not gain a
    // time because the device happens to be west of UTC.
    //
    // The assertion is "no clock time at all", not "no am/pm". The first
    // version looked for an am/pm suffix and therefore passed on this en-GB
    // machine, where midnight renders as "00:00" rather than "12:00 am" - so the
    // mutation it was written to catch sailed through. Matching the clock
    // pattern directly is locale-independent in the way that matters here, and
    // this project has now been bitten by exactly that twice.
    const html = buildRecordExportHtml("encounters", {
      title: "Test export",
      date: "2026-03-14",
    });
    const rendered = DATE_ROW(html, "Date");
    expect(rendered, `date-only value must render as a date alone, got ${JSON.stringify(rendered)}`)
      .not.toMatch(/\d{1,2}:\d{2}/);
    expect(rendered).toMatch(/2026/);
  });

  it("leaves non-date values alone", () => {
    // A guard against a "fix" that formats everything. A time-looking string
    // that is not a date must survive untouched.
    const html = buildRecordExportHtml("encounters", {
      title: "Test export",
      notes: "met at 21:00, no date mentioned",
    });
    expect(html).toContain("21:00");
  });

  it("never exports a real instant, so there is no stored-versus-instant ambiguity", () => {
    // The fact that made the fix above simple. If a genuine instant ever starts
    // being exported, it must be rendered LOCALLY like every other instant in
    // this app - so it is asserted that instants stay out of the export
    // entirely, rather than asserting something about how they would render.
    // A future change that unhides createdAt would otherwise be a silent
    // decision, and formatStoredDate would then be wrong for it.
    const html = buildRecordExportHtml("encounters", {
      title: "Test export",
      createdAt: "2026-03-14T00:30:00.000Z",
      updatedAt: "2026-03-15T00:30:00.000Z",
      date: "2026-03-14",
    });
    expect(html).not.toContain("Created");
    expect(html).not.toContain("Updated");
    expect(html).toContain("Date");
  });
});

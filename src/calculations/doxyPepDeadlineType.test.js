// doxyPepDeadlineType.test.js
//
// NEW GUARD, 13 Oct 2026. Every assertion here corresponds to a LIVE BUG: the
// DoxyPEP widget never updated, at any tier, on any device.
//
// THE BUG
// getDoxyPepStatus builds `deadline` as `windowStart + DOXYPEP_WINDOW_HOURS *
// 3600000` - epoch MILLISECONDS, a plain number, and it has always done so.
// Three call sites then treated it as a Date and called `.getTime()` on it:
//
//   doxyPepSync.js  const expiryMs = status.deadline ? status.deadline.getTime() : 0
//   doxyPepSync.js  countdownAt: status.deadline ? status.deadline.getTime() : null
//   doxyPepSync.js  const remainingMs = status.deadline.getTime() - Date.now()
//
// `Number.prototype.getTime` does not exist, so each was a TypeError. Two of the
// three sat inside updateDoxyPEPWidget's try/catch, which logs at debug level and
// returns - so the bridge was never called, the widget kept whatever Android last
// rendered, and nothing on screen indicated anything was wrong. The third was an
// argument to that same call, so it threw inside the same swallowed catch.
//
// WHY NOTHING CAUGHT IT
// widgetBridgeUpdate.test.js builds its fixture as `deadline: new Date(...)`.
// A Date. So the suite exercised a shape getDoxyPepStatus has never once
// produced, `.getTime()` looked correct in the test, and three real call sites
// stayed broken. This is the same failure as the hepatitis B matcher reading a
// field no record has: a fixture shaped differently from what the real producer
// emits cannot find a defect in the wiring.
//
// THIS FILE'S JOB
// Pin the type from the REAL producer rather than from a hand-written literal,
// then assert every consumer agrees. A test that declares the shape it wants is
// what caused the bug; this one derives the shape from getDoxyPepStatus and
// checks the consumers against that.

import { describe, it, expect } from "vitest";
import { getDoxyPepStatus, DOXYPEP_WINDOW_HOURS } from "./doxyPepCalculations.js";
import { doxyPepRedactedLine, buildDoxyPepWidgetPayload } from "./doxyPepSync.js";

// A qualifying encounter as EncounterRepository produces it: `date` is this
// app's stored fake-UTC string, and `myPosition` carries the positions.
const qualifying = (date, id) => ({
  id,
  date,
  myPosition: ["Anal - giving"],
  isArchived: false,
});

const NOW = new Date("2026-10-14T12:00:00.000Z");
// 6 hours ago, as a stored fake-UTC wall-clock string.
const SIX_HOURS_AGO = "2026-10-14T06:00:00.000Z";

describe("deadline is epoch milliseconds, and every consumer agrees", () => {
  const status = getDoxyPepStatus([qualifying(SIX_HOURS_AGO, "e1")], [], NOW);

  it("getDoxyPepStatus produces an active window for a qualifying encounter", () => {
    // Non-vacuity: if this stopped being true the type assertions below would be
    // asserting about an empty object, which is the vacuous-guard failure.
    expect(status.active).toBe(true);
    expect(status.overdue).toBe(false);
    expect(status.deadline).toBeDefined();
  });

  it("deadline is a NUMBER, not a Date", () => {
    expect(typeof status.deadline).toBe("number");
    // The three explicit failure messages, because "expected object, received
    // number" does not tell the next reader which of the three call sites broke.
    expect(status.deadline).not.toBeInstanceOf(Date);
    expect(typeof status.deadline?.getTime).toBe("undefined");
  });

  it("deadline is windowStart plus the window, in ms", () => {
    expect(status.deadline).toBe(status.windowStart + DOXYPEP_WINDOW_HOURS * 3600000);
  });

  it("the Redacted line renders from a real status without throwing", () => {
    // This is the call that threw. It is evaluated as an argument to
    // sendWidgetUpdate inside updateDoxyPEPWidget's try/catch, so in the app it
    // failed silently; here there is no catch, so it fails loudly.
    expect(() => doxyPepRedactedLine(status)).not.toThrow();

    // FIXED 18 Oct 2026 - this assertion was a TIME BOMB and started failing on
    // its own, on a clean checkout with no ring work in the tree.
    //
    // `status` above is built from a FIXED `NOW` of 2026-10-14, so its deadline
    // is 2026-10-17 - which, from 17 Oct onward, is in the PAST as far as
    // doxyPepRedactedLine is concerned. That function reads Date.now() internally
    // and cannot be handed a clock, so the test injected a fake `now` on one side
    // of the boundary while the other side read the real one. The line rendered
    // "Antibiotics - in -44m": a negative countdown, produced by the test
    // disagreeing with itself rather than by any product defect. In the app
    // `status.overdue` is checked FIRST and returns "window overdue", so the
    // negative branch is unreachable in production.
    //
    // The fix is to anchor BOTH sides to the real clock rather than to a fixed
    // date, which is also what stops it decaying again: 6 hours ago is always 6
    // hours ago, so the deadline is always ~66h in the future and the assertion
    // holds indefinitely. A test pinned to a calendar date has to be re-armed by
    // hand every 72 hours, and nothing was going to remember to do that.
    const liveNow = new Date();
    const sixHoursAgoMs = liveNow.getTime() - 6 * 3600000;
    const sixHoursAgoStr = new Date(sixHoursAgoMs).toISOString().replace(/\.\d{3}Z$/, ".000Z");
    const liveStatus = getDoxyPepStatus([qualifying(sixHoursAgoStr, "e1")], [], liveNow);
    expect(doxyPepRedactedLine(liveStatus)).toMatch(/^Antibiotics - in \d+h/);
  });

  it("the widget payload sends the deadline as a plain number", () => {
    // Calls the REAL payload builder rather than repeating its expression. The
    // first version of this test copied `status.deadline ?? null` into the test
    // file and passed GREEN against the unfixed source, because a copy of the
    // code is not the code - the payload lived inside a function whose only
    // caller needs a live Capacitor bridge, so nothing could execute it.
    const payload = buildDoxyPepWidgetPayload(status);
    expect(typeof payload.countdownAt).toBe("number");
    expect(payload.countdownAt).toBe(status.deadline);
    expect(payload.countdownAt.getTime).toBeUndefined;
  });

  it("the payload carries the privacy-allowed fields and the evidence date", () => {
    const payload = buildDoxyPepWidgetPayload(status);
    expect(payload.category).toBe("DoxyPEP");
    expect(payload.state).toBe("Active");
    // t093's evidence line, carried as the stored fake-UTC string.
    expect(payload.evidenceAt).toBe(status.windowStartIso);
  });

  it("the payload states the coarse state, never a countdown, at Redacted", () => {
    // The state text is what survives the tier; countdownAt is a relative
    // elapsed time and discloses no routine. Asserted here because the payload
    // is where that decision is made.
    expect(buildDoxyPepWidgetPayload(status).state).not.toMatch(/\d/);
    expect(buildDoxyPepWidgetPayload({ ...status, overdue: true }).state).toBe("Overdue");
    expect(buildDoxyPepWidgetPayload({ active: false, overdue: false }).state).toBe("No active window");
  });

  it("an inactive status sends no deadline rather than a bogus one", () => {
    const payload = buildDoxyPepWidgetPayload({ active: false, overdue: false });
    expect(payload.countdownAt).toBeNull();
    expect(payload.evidenceAt).toBeNull();
  });
});

describe("the window is anchored to the FIRST qualifying activity, not the last", () => {
  // The owner asked whether 72h should run from the first qualifying activity.
  // It DOES in the calculation - the deadline has always been
  // `qualifyingSinceLastDose[0]` off an ascending sort. What was wrong was the
  // notification body, which said "last". This pins the calculation side so the
  // copy fix and the maths cannot drift apart again.
  const first = qualifying("2026-10-13T06:00:00.000Z", "e1"); // 30h before NOW
  const later = qualifying("2026-10-14T09:00:00.000Z", "e2"); // 3h before NOW
  const status = getDoxyPepStatus([later, first], [], NOW); // deliberately unsorted

  it("anchors to the EARLIEST encounter even when the list arrives reversed", () => {
    expect(status.windowStartIso).toBe(first.date);
    expect(status.deadline).toBe(
      getDoxyPepStatus([first], [], NOW).deadline
    );
  });

  it("a later activity does not push the deadline out", () => {
    // The safety property: someone who had sex on Monday and again on Wednesday
    // must not be told they have until Friday. Monday's 72 hours is what binds.
    //
    // Asserted as first+72h rather than as "some number": the whole point is that
    // it equals the FIRST encounter's window and NOT the last one's, and only the
    // second of those two comparisons actually distinguishes the two
    // implementations. An earlier version of this test asserted only that the
    // deadline was "before now", which is true of BOTH a first-anchored and a
    // last-anchored window and so measured nothing.
    const expectedFromFirst = getDoxyPepStatus([first], [], NOW).deadline;
    const lastAnchoredWouldBe = getDoxyPepStatus([later], [], NOW).deadline;

    expect(status.deadline).toBe(expectedFromFirst);
    expect(status.deadline).not.toBe(lastAnchoredWouldBe);
    // And the difference is not cosmetic - it is the whole 27-hour gap between
    // the two readings.
    expect(lastAnchoredWouldBe - status.deadline).toBeGreaterThan(0);
  });

  it("a logged dose clears the window entirely", () => {
    // The other half of the anchoring rule: the dose ends the streak, so the
    // next encounter starts a fresh 72 hours rather than inheriting the old one.
    const afterDose = getDoxyPepStatus(
      [qualifying("2026-10-14T10:00:00.000Z", "e3")],
      [{ date: "2026-10-14T09:30:00.000Z", type: "dose" }],
      NOW
    );
    expect(afterDose.active).toBe(true);
    expect(afterDose.windowStartIso).toBe("2026-10-14T10:00:00.000Z");
  });
});
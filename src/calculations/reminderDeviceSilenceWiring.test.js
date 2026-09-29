// Device-silence is wired for ALL FOUR non-medication reminder kinds.
//
// WHY A SOURCE-LEVEL WIRING TEST AND NOT JUST A UNIT TEST: the bug this task
// fixes was never a wrong calculation. It was a fact living in one place while
// the code that needed it was somewhere else. A unit test on
// shouldSuppressDeviceNotification() would pass perfectly well while three of
// the four sync functions never called it - which is exactly the state the app
// shipped in. This asserts the wiring, because "is this function reached" is
// not a thing a unit test can see.
//
// And the second half matters just as much: App.jsx must not re-inline the
// formula. The Testing banner shipped broken precisely because the fingerprint
// was computed inline in App.jsx while the scheduler had no copy of it. So both
// call sites are pinned to the shared builders.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel) => readFileSync(resolve(process.cwd(), rel), "utf8");

const APP = read("src/App.jsx");
const REMINDER_SUPPRESSION = read("src/calculations/reminderSuppression.js");

const SYNC_FILES = {
  refill: "src/calculations/refillReminderSync.js",
  vaccination: "src/calculations/vaccinationReminderSync.js",
  testing: "src/calculations/testingReminderSync.js",
  clinicVisit: "src/calculations/clinicVisitReminderSync.js",
};

const SYNC = Object.fromEntries(
  Object.entries(SYNC_FILES).map(([k, p]) => [k, read(p)])
);

// Where each kind actually SCHEDULES, which is not the same string in every
// file. clinic-visit delegates to a `syncOneSlot` helper defined ABOVE its own
// entry point, so a naive `indexOf("scheduleNotification({")` finds that
// helper's call and reports the guard as being "after scheduling" when it is
// correctly before the scheduling this function performs. The first version of
// this test made exactly that mistake and would have been "fixed" by moving
// working code - so the marker is declared per kind instead.
const SCHEDULE_MARKER = {
  refill: "scheduleNotification({",
  vaccination: "scheduleNotification({",
  testing: "scheduleNotification({",
  clinicVisit: "await syncOneSlot({",
};

describe("device-silence reaches all four non-medication reminder kinds", () => {
  for (const [kind, src] of Object.entries(SYNC)) {
    it(`${kind}: the sync function consults the acknowledgement before scheduling`, () => {
      expect(src, `${kind} must import the suppression helpers`)
        .toMatch(/shouldSuppressDeviceNotification/);
      expect(src, `${kind} must normalise the stored acknowledgements`)
        .toMatch(/normaliseAcknowledgements/);
      expect(src, `${kind} must read the persisted list`)
        .toMatch(/acknowledgedReminders/);
      // The order is the substance: the check has to come BEFORE the
      // scheduling call, or it is a comment rather than a behaviour.
      const check = src.indexOf("shouldSuppressDeviceNotification(");
      const schedule = src.indexOf(SCHEDULE_MARKER[kind]);
      expect(check, `${kind} has no suppression check at all`).toBeGreaterThan(-1);
      expect(schedule, `${kind} has no scheduling call at all`).toBeGreaterThan(-1);
      expect(check, `${kind}: suppression is checked AFTER scheduling, so it does nothing`)
        .toBeLessThan(schedule);
    });

    it(`${kind}: suppression cancels the pending notification and says so`, () => {
      // An acknowledgement that scheduled anyway - or that silently returned
      // without cancelling - would leave the device notification armed.
      expect(src, `${kind} must cancel on suppression`).toMatch(/cancelNotification\(/);
      expect(src, `${kind} must report the suppression`).toMatch(/acknowledged: true/);
    });
  }

  it("each sync file builds its signature with the SHARED helper, not a local copy", () => {
    // A locally-rebuilt fingerprint is the exact failure this whole change
    // exists to remove, so each file must call the exported builder.
    expect(SYNC.refill).toMatch(/buildRefillSignature\(/);
    expect(SYNC.vaccination).toMatch(/buildVaccinationSignature\(/);
    expect(SYNC.testing).toMatch(/buildTestingSignature\(/);
    expect(SYNC.clinicVisit).toMatch(/buildClinicVisitSignature\(/);
  });

  it("App.jsx uses the shared builders too, so banner and scheduler cannot drift", () => {
    for (const fn of [
      "buildRefillSignature",
      "buildTestingSignature",
      "buildVaccinationSignature",
      "buildClinicVisitSignature",
    ]) {
      expect(APP, `App.jsx must use ${fn}`).toMatch(new RegExp(`${fn}\\(`));
    }
  });

  it("App.jsx no longer inlines the fingerprints", () => {
    // The regression guard proper. If someone puts the formula back inline,
    // this fails - which is the only reason the tests above are worth anything.
    expect(APP, "App.jsx must not hand-build a testing fingerprint")
      .not.toMatch(/`testing@\$\{/);
    expect(APP, "App.jsx must not hand-build a vaccination fingerprint")
      .not.toMatch(/`\$\{[^}]*vaccination[^}]*\.id\}@\$\{/);
  });

  it("the four shared builders exist and are exported", () => {
    for (const fn of [
      "buildRefillSignature",
      "buildTestingSignature",
      "buildVaccinationSignature",
      "buildClinicVisitSignature",
    ]) {
      expect(REMINDER_SUPPRESSION, `${fn} must be exported from reminderSuppression.js`)
        .toMatch(new RegExp(`export function ${fn}\\(`));
    }
  });

  it("clinic-visit suppression cancels BOTH reminder slots", () => {
    // There are two slots (A and B) with separate notification ids. Cancelling
    // one would leave the other buzzing after the user said stop - a partial
    // fix that looks complete in a diff.
    const body = SYNC.clinicVisit;
    const a = body.indexOf("NOTIFICATION_IDS.clinicVisitReminderA");
    const b = body.indexOf("NOTIFICATION_IDS.clinicVisitReminderB");
    expect(a, "slot A must be cancelled").toBeGreaterThan(-1);
    expect(b, "slot B must be cancelled").toBeGreaterThan(-1);
  });
});

// reminderSuppressionWiring.test.js — source-level guard for the Phase 3
// banner-suppression wiring.
//
// reminderSuppression.test.js proves the RULES are right. It cannot prove the
// app actually follows them, and in this particular change that gap is where
// the most dangerous bug lives: suppression is only safe if the routes that
// are NOT suppression stay unsuppressed. A snooze that quietly recorded a
// dismissal would look like it worked and would permanently silence a
// medication reminder.
//
// The single most valuable test here is therefore a NEGATIVE one - it asserts
// that certain handlers do NOT touch the suppression state. Negative checks
// run against comment-stripped source, because this repo's comments record
// what a bug WAS by quoting the defective line, which is what makes them
// valuable and exactly what makes a raw substring check useless. The
// stripper is proven non-vacuous at the end.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const APP = readFileSync(path.join(process.cwd(), "src", "App.jsx"), "utf8");
const MED_SYNC = readFileSync(
  path.join(process.cwd(), "src", "calculations", "medicationReminderSync.js"),
  "utf8"
);
const APP_PREFS = readFileSync(
  path.join(process.cwd(), "src", "repositories", "appPreferencesRepository.js"),
  "utf8"
);

function stripComments(src) {
  return src
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");
}
const APP_CODE = stripComments(APP);
const MED_SYNC_CODE = stripComments(MED_SYNC);
const APP_PREFS_CODE = stripComments(APP_PREFS);

function bodyOf(src, name) {
  const start = src.indexOf(`const ${name}`);
  expect(start, `${name} not found`).toBeGreaterThan(-1);
  return src.slice(start, src.indexOf("\n  };", start));
}

describe("snoozing is NOT suppression - the user's explicit requirement", () => {
  it("the snooze handler records no dismissal and no acknowledgement", () => {
    // The requirement: a snoozed dose must re-push in the SAME app session once
    // the snooze expires. Snoozing writes a real timestamped fact that the
    // due-state check already honours, so it needs no suppression at all. If
    // this handler touched either list, the reminder would never come back and
    // the failure would be invisible until a dose was actually missed.
    for (const name of ["onDueMedsSnooze", "onRefillSnooze", "onTestingSnooze", "onClinicVisitSnooze"]) {
      const body = bodyOf(APP_CODE, name);
      expect(body, `${name} must not suppress`).not.toMatch(/setSessionDismissed/);
      expect(body, `${name} must not suppress`).not.toMatch(/setAcknowledgedReminders|dismissReminder|setPendingAcknowledge/);
    }
  });

  it("the pure layer keeps device suppression off for anything but an explicit acknowledgement", () => {
    // Belt and braces on the same rule, from the other side.
    expect(MED_SYNC_CODE).toMatch(/shouldSuppressDeviceNotification/);
    const start = MED_SYNC_CODE.indexOf("shouldSuppressDeviceNotification(");
    const around = MED_SYNC_CODE.slice(Math.max(0, start - 400), start + 200);
    expect(around, "device suppression must be keyed to the acknowledgement list, not to a dismissal").not.toMatch(
      /sessionDismissed/
    );
  });
});

describe("acknowledgements are persisted to a repository already in the backup", () => {
  it("the preference is declared on AppPreferencesRepository", () => {
    // CLAUDE.md's standing rule: a new repository must be wired into
    // backupService.js in the same change, and that rule has been missed three
    // times here. Adding fields to the singleton that is ALREADY wired cannot
    // miss it - this test exists so a future session reaching for a brand-new
    // repository notices the cheaper option first.
    expect(APP_PREFS_CODE).toMatch(/acknowledgedReminders: \[\]/);
    expect(APP_PREFS_CODE).toMatch(/acknowledgeScopeDefault: "in-app"/);
  });

  it("both suppression states are plain in-memory state, never persisted", () => {
    // The whole "comes back after a hard close" behaviour rests on this being
    // un-persisted. If sessionDismissed were ever written to storage, a
    // dismissal would survive a real close and the user could never clear it
    // short of the Settings escape hatch - which would be a genuinely broken
    // promise, because the toast says it comes back when they reopen the app.
    expect(APP_CODE).toMatch(/const \[sessionDismissed, setSessionDismissed\] = useState\(\[\]\)/);
    const update = APP_CODE.slice(APP_CODE.indexOf("AppPreferencesRepository.update(") - 200, APP_CODE.indexOf("AppPreferencesRepository.update(") + 200);
    expect(update, "session dismissals must never be written to storage").not.toMatch(/sessionDismissed/);
  });
});

describe("every banner is gated on the pure visibility decision", () => {
  it("none of the five still renders on a bare due-check", () => {
    // The original defect: each banner rendered on `dueMeds.length > 0` and
    // its close button did `setDueMeds([])`, so the 60s poll restored it
    // immediately. A banner rendering on a bare count is that bug.
    for (const old of [
      "{dueMeds.length > 0 && (",
      "{refillDue.length > 0 && (() => {",
      "{testingDue && (",
      "{clinicVisitDue && (",
      "{vaccinationDue && (",
    ]) {
      expect(APP_CODE, `"${old}" should be gone`).not.toContain(old);
    }
  });

  it("all five go through isBannerVisible with their own kind", () => {
    for (const kind of ["MEDS", "REFILL", "TESTING", "CLINIC_VISIT", "VACCINATION"]) {
      expect(APP_CODE).toMatch(new RegExp(`isBannerVisible\\(suppressState\\(REMINDER_KIND\\.${kind},`));
    }
  });

  it("no dismiss handler clears the due data itself any more", () => {
    // The close buttons used to mutate the real due state. That is the
    // mechanism of the bug: a dismissal is not "this is no longer due", and
    // writing it as if it were meant the next poll would bring it straight
    // back.
    expect(APP_CODE).not.toMatch(/onClick=\{\(\) => \{ setDueMeds\(\[\]\)/);
    expect(APP_CODE).not.toMatch(/onClick=\{\(\) => \{ setRefillDue\(\[\]\)/);
    expect(APP_CODE).not.toMatch(/onClick=\{\(\) => \{ setTestingDue\(null\)/);
  });
});

describe("the passive dot is explained, and is not a nested interactive", () => {
  it("the dot is aria-hidden and the tab's own name carries the information", () => {
    // A focusable control inside a role="button" tab is the `nested-interactive`
    // violation already found and fixed once in this repo. The standing rule
    // says icon-only UI needs a tap-to-reveal explanation, which is not
    // available here without reintroducing that - so the information goes in
    // the accessible name instead, and this asserts both halves.
    expect(APP_CODE).toMatch(/aria-hidden="true"[^}]*borderRadius: 999[^}]*background: ACTION\.gold/);
    expect(APP_CODE).toMatch(/const tabAriaLabel = unacknowledgedHere/);
    expect(APP_CODE).toMatch(/you've stopped being reminded about/);
    expect(APP_CODE).toMatch(/aria-label=\{tabAriaLabel\}/);
  });

  it("the dot gets a one-time visible explanation", () => {
    // A dot with no explanation anywhere is exactly what the icon-only-UI rule
    // exists to prevent, so the explanation has to be somewhere.
    expect(APP_CODE).toMatch(/unackExplainedRef/);
    expect(APP_CODE).toMatch(/still outstanding that you've stopped being reminded about/);
  });

  it("the dot is derived from live due state, not remembered", () => {
    // A remembered flag would outlive the dose it was about. hasOutstanding-
    // Acknowledged is the whole mechanism.
    expect(APP_CODE).toMatch(/hasOutstandingAcknowledged\(\{/);
  });
});

describe("a spent acknowledgement is dropped, and only once the due state is known", () => {
  it("prunes spent acknowledgements through the pure helper", () => {
    // THE fix for "acknowledging silenced that medication forever". The rule is
    // the owner's: the silence lasts until the refill is dealt with, and
    // dealing with it is an action that already existed, so no new stored
    // field and no migration are involved.
    expect(APP_CODE).toMatch(/pruneSpentAcknowledgements\(/);
  });

  it("does NOT prune before a real due state has been computed", () => {
    // The single most dangerous line in this feature. At boot, before
    // checkDueMeds has run, every signature is still "" and so the outstanding
    // set is EMPTY - which would tell the prune that every acknowledgement the
    // user has ever made was spent, and silently delete all of them on the
    // next app open. A user who stopped being reminded about a medication, on
    // purpose, would find it back with no explanation and no way to know why.
    //
    // So the guard is asserted, not assumed. Both halves: the effect must
    // check it, and something real must set it.
    const effectStart = APP_CODE.indexOf("pruneSpentAcknowledgements(acknowledgedReminders");
    expect(effectStart, "the prune call not found").toBeGreaterThan(-1);
    const before = APP_CODE.slice(Math.max(0, effectStart - 400), effectStart);
    expect(before, "the prune must be gated on the due state being known").toMatch(/if \(!dueStateReady\) return;/);
    expect(APP_CODE, "checkDueMeds must actually set it once due state is known").toMatch(/setDueStateReady\(true\)/);
  });

  it("the prune effect cannot loop on its own write", () => {
    // It depends on the value it writes, so without an equality check before
    // writing it would re-fire on its own write indefinitely. Pruning only
    // ever removes, so an unchanged length genuinely means nothing was spent.
    const effectStart = APP_CODE.indexOf("pruneSpentAcknowledgements(acknowledgedReminders");
    const after = APP_CODE.slice(effectStart, effectStart + 420);
    expect(after).toMatch(/if \(kept\.length === acknowledgedReminders\.length\) return;/);
  });
});

describe("the guards above are not vacuous", () => {
  it("comment-stripping still leaves real code, and really removes comments", () => {
    const probe = 'const a = 1;\n// const b = 2;\nconst c = 3;';
    const stripped = stripComments(probe);
    expect(stripped).toContain("const a = 1;");
    expect(stripped).toContain("const c = 3;");
    expect(stripped).not.toContain("const b = 2;");
    // Content anchors rather than a length ratio.
    //
    // The first version of this asserted each stripped file kept >50% of its
    // length, and it FAILED here - correctly. appPreferencesRepository.js is
    // almost entirely comment, so only 18% survives stripping, and the ratio
    // was calibrated on the other two files without checking a third. The
    // ratio was a proxy for the real question, which is whether the code
    // being inspected would still be visible to these assertions. So the
    // anchors below are now the check, and they would fail if a future edit
    // commented out the very code being guarded.
    expect(APP_CODE).toContain("const goBackOneLevel");
    expect(MED_SYNC_CODE).toContain("export async function syncMedicationReminders");
    expect(APP_PREFS_CODE).toContain("export const AppPreferencesRepository");
  });
});

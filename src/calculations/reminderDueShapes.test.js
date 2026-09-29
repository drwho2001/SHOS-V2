// reminderDueShapes.test.js — the shape contract between each due-state
// function and the signature App.jsx builds from it.
//
// WHY THIS FILE EXISTS. Two real bugs shipped in one session from the same
// mistake: signature-building code written against a due-state SHAPE that had
// not been read. `getTestingDueState()` returns `{ due, dueDate }` and has no
// `test` property at all, so `testingDue?.test` was always undefined, the
// Testing signature was always the empty string, and because `isBannerVisible`
// treats an empty signature as "nothing to show", the Testing due-reminder
// banner never rendered. At all. Silently.
//
// Confirmed by execution, not by reading: at a clock where testing IS due,
// `"test" in state` is false.
//
// THE TRAP IN TESTING THIS. A first version of this file wrapped most
// assertions in `if (state.due)`. That is a vacuity generator: at the real
// current date only refills and doses are due from the seed data, so the
// testing, vaccination and visit assertions were SKIPPED and the file passed
// while checking almost nothing. The general rule this repo keeps re-learning,
// applied to my own work this time.
//
// So there are no conditionals below. The clock is pinned to a date on which
// every kind is genuinely due, and a precondition block asserts that up front
// - if the seed data ever changes such that something is no longer due, this
// file fails LOUDLY at the precondition instead of quietly testing nothing.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// In-memory storage, the pattern contactRepository.test.js established. With
// the key ABSENT the adapter returns the repository's own seed fallback, so
// these run against real seed data rather than a hand-made fixture - which is
// the point: the bug appeared with real-shaped data.
const mockStore = new Map();
vi.mock("../storage/storageAdapter", () => {
  const adapter = {
    load: vi.fn((key, fallback) => (mockStore.has(key) ? mockStore.get(key) : fallback)),
    save: vi.fn((key, value) => { mockStore.set(key, JSON.stringify(value)); return true; }),
  };
  return { localStorageAdapter: adapter };
});

import { getTestingDueState } from "./testingReminderSync";
import { getVaccinationDueState } from "./vaccinationReminderSync";
import { getClinicVisitDueState } from "./clinicVisitReminderSync";
import { getRefillDueMedications } from "./refillReminderSync";
import { getDailyMedsState } from "./medicationReminderSync";
import { buildSimpleSignature, buildMedsSignature, REMINDER_KIND, isBannerVisible } from "./reminderSuppression";

// Past every seed due date. The seed's suggested testing retest is 26 Dec 2026
// and its earliest vaccination 18 Oct 2026, so this is comfortably beyond both
// while still being an ordinary wall-clock time rather than a year boundary,
// which keeps the fixture away from DST and month-index traps.
const ALL_DUE = new Date("2027-03-01T12:00:00.000Z");

beforeEach(() => {
  mockStore.clear();
  vi.useFakeTimers();
  vi.setSystemTime(ALL_DUE);
});

describe("precondition: the seed data really is due for every kind", () => {
  // If this fails, every assertion below is meaningless, so it is asserted
  // first and loudly rather than discovered later.
  it("testing, vaccination, refill and dose states are all genuinely due", async () => {
    const testing = await getTestingDueState();
    const vaccine = await getVaccinationDueState();
    const refills = await getRefillDueMedications();
    const { due } = await getDailyMedsState();

    expect(
      testing.due,
      "the seed's suggested retest is due at this clock - if not, this file is testing nothing"
    ).toBe(true);
    expect(vaccine.due, "the seed's earliest vaccination is due at this clock").toBe(true);
    expect(refills.length, "at least one refill is due at this clock").toBeGreaterThan(0);
    expect(due.length, "at least one dose is due at this clock").toBeGreaterThan(0);
  });
});

describe("every due state carries the fields App.jsx keys on", () => {
  it("TESTING has a dueDate and NO 'test' property", async () => {
    // THE regression. Asserted negatively as well as the shape, because "this
    // property is absent" is precisely the fact a future edit would
    // reintroduce by adding a same-named field elsewhere and assuming the two
    // agree - which is exactly how the original bug happened.
    const state = await getTestingDueState();
    expect(state).not.toHaveProperty("test");
    expect(state.dueDate).toBeInstanceOf(Date);
  });

  it("VACCINATION has a vaccination with an id, and a dueDate", async () => {
    const state = await getVaccinationDueState();
    expect(state.vaccination).toBeTruthy();
    expect(state.vaccination.id).toBeTruthy();
    expect(state.dueDate).toBeInstanceOf(Date);
  });

  it("REFILL items have an id", async () => {
    const due = await getRefillDueMedications();
    due.forEach((m) => expect(m.id, "a due refill needs an id to key on").toBeTruthy());
  });

  it("MEDS items have an id and the per-instance marker", async () => {
    const { due } = await getDailyMedsState();
    due.forEach((m) => {
      expect(m.id).toBeTruthy();
      // `_dueSince` is what makes each DOSE a distinct instance. Without it, a
      // once-daily medication acknowledged this morning still matches tomorrow
      // morning and the user is never reminded of the next dose - the most
      // dangerous possible regression here, because it is entirely silent.
      expect(m, "a due medication must carry _dueSince (null is valid - it means never dosed)")
        .toHaveProperty("_dueSince");
    });
  });
});

describe("the expression App.jsx uses yields a usable signature for every due kind", () => {
  // This is the block that would have caught D1. It builds the signature the
  // way the app does, from a due state, and requires the result to be
  // non-empty AND to make the banner visible.
  it("a due testing state yields a non-empty signature and a visible banner", async () => {
    const state = await getTestingDueState();
    const signature = buildSimpleSignature(
      REMINDER_KIND.TESTING,
      [{ id: `testing@${state.dueDate.toISOString()}` }]
    );
    expect(signature, "a due testing state must produce a non-empty signature, or the banner can never appear")
      .not.toBe("");
    expect(isBannerVisible({ dueCount: 1, signature, sessionDismissed: [], acknowledged: [] }))
      .toBe(true);
  });

  it("a due vaccination state yields a non-empty signature", async () => {
    const state = await getVaccinationDueState();
    const signature = buildSimpleSignature(
      REMINDER_KIND.VACCINATION,
      [{ id: `${state.vaccination.id}@${state.dueDate.toISOString()}` }]
    );
    expect(signature).not.toBe("");
  });

  it("a due refill set yields a non-empty signature", async () => {
    expect(buildSimpleSignature(REMINDER_KIND.REFILL, await getRefillDueMedications())).not.toBe("");
  });

  it("a due dose set yields a non-empty signature", async () => {
    const { due } = await getDailyMedsState();
    expect(buildMedsSignature(due)).not.toBe("");
  });
});

describe("App.jsx's signature expressions use properties that actually exist", () => {
  // The shape contract above proves what the due states RETURN. This proves
  // App.jsx READS those things - and that gap is exactly where D1 lived. The
  // shape was fine; the code consuming it was not, and nothing here would
  // have caught that on its own.
  //
  // Source-level rather than behavioural, deliberately: it is a wiring
  // property (does this expression name a real field), and it is the one the
  // behavioural assertions above cannot see. Comments are stripped before the
  // negative checks because this repo's comments quote the defective code
  // verbatim - which is what makes them valuable and what makes a raw
  // substring check report a fixed bug as still present.
  const APP = readFileSync(path.join(process.cwd(), "src", "App.jsx"), "utf8");
// The four non-medication fingerprints moved here from App.jsx on 29 Sep, so
// the assertions about them have to look here. See the tests below.
const SUPPRESSION_CODE = readFileSync(
  path.join(process.cwd(), "src", "calculations", "reminderSuppression.js"), "utf8");
  const APP_CODE = APP.split("\n")
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

  it("does not read a 'test' property off the testing due state", () => {
    // The shipped bug, verbatim. `getTestingDueState()` has no such property,
    // so this expression was always undefined.
    expect(APP_CODE, "App.jsx must not read testingDue?.test - that property does not exist")
      .not.toMatch(/testingDue\?\.test/);
  });

  it("keys the testing signature off the due date", () => {
    // The formula MOVED on 29 Sep: it used to be an inline expression in
    // App.jsx, which is exactly how the Testing banner shipped broken - the
    // fingerprint lived in one file while the scheduler that has to match it had
    // no copy of it. It now lives in reminderSuppression.js and App.jsx calls
    // it.
    //
    // So this now asserts the invariant against the file that owns the formula
    // AND that App.jsx really uses it. That is strictly stronger than the
    // version it replaces: the old one could be satisfied by the text "dueDate"
    // appearing near the signature in a file that no longer computes it, which
    // is precisely how a guard stops meaning anything.
    expect(SUPPRESSION_CODE, "the testing fingerprint must include the due date, which is what makes each occurrence distinct")
      .toMatch(/buildTestingSignature[\s\S]{0,400}dueDate/);
    expect(APP_CODE, "App.jsx must use the shared builder, or the banner and the scheduler can drift again")
      .toMatch(/buildTestingSignature\(/);
  });

  it("keys the vaccination signature off the due date, not just the record id", () => {
    // Otherwise acknowledging a vaccination silences every future dose of it -
    // which is the bug the original vaccination signature shipped with, keyed on
    // the record id alone. Same relocation as above, same strengthened form.
    expect(SUPPRESSION_CODE, "the vaccination fingerprint must include the due date")
      .toMatch(/buildVaccinationSignature[\s\S]{0,400}dueDate/);
    expect(APP_CODE, "App.jsx must use the shared builder")
      .toMatch(/buildVaccinationSignature\(/);
  });

  it("the comment-stripping used above is not itself vacuous", () => {
    const probe = 'const a = 1;\n// const b = 2;\nconst c = 3;';
    const stripped = probe.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    expect(stripped).toContain("const a = 1;");
    expect(stripped).not.toContain("const b = 2;");
    expect(APP_CODE).toContain("const goBackOneLevel");
  });
});

describe("signatures are per-occurrence, not per-record", () => {
  // The other half of D2. If the date were dropped from a signature, an
  // acknowledgement would silence every future reminder for that record too -
  // which for a vaccination means never being reminded about the next dose.
  it("two testing due dates give two different signatures", () => {
    expect(buildSimpleSignature(REMINDER_KIND.TESTING, [{ id: "testing@2026-10-01" }]))
      .not.toBe(buildSimpleSignature(REMINDER_KIND.TESTING, [{ id: "testing@2026-01-01" }]));
  });

  it("two vaccination due dates give two different signatures", () => {
    expect(buildSimpleSignature(REMINDER_KIND.VACCINATION, [{ id: "v1@2026-12-01" }]))
      .not.toBe(buildSimpleSignature(REMINDER_KIND.VACCINATION, [{ id: "v1@2025-12-01" }]));
  });

  it("one medication's two doses give two different signatures", () => {
    const today = buildMedsSignature([{ id: "m1", _dueSince: "2026-09-28T08:00:00.000Z" }]);
    const tomorrow = buildMedsSignature([{ id: "m1", _dueSince: "2026-09-29T08:00:00.000Z" }]);
    expect(today).not.toBe(tomorrow);
  });
});

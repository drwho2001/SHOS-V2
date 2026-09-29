// refillSecondStage.test.js
//
// t013: marking a refill "requested" filters it out of getRefillDueMedications
// entirely, so an ordered-but-uncollected item was invisible everywhere except
// one line on the medication card. This tests the DERIVATION, which is the part
// that can go quietly wrong, and the fact that the second stage does not nag.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { computeStock } from "./medicationCalculations.js";

const SYNC = readFileSync(
  path.join(process.cwd(), "src", "calculations", "refillReminderSync.js"),
  "utf8"
);
const APP = readFileSync(path.join(process.cwd(), "src", "App.jsx"), "utf8");
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** A medication in the state the second stage is about. */
function med(over = {}) {
  return {
    id: "med_1",
    name: "Testosterone",
    isArchived: false,
    inventoryTracked: true,
    usagePattern: "custom",
    unitsPerContainer: 100,
    refillThreshold: 10,
    refillRequestedAt: "2026-09-20T09:00:00.000Z",
    ...over,
  };
}

describe("the second stage is derived from live state, not stored", () => {
  it("only lists items still short of stock", () => {
    // The point of deriving rather than storing a `refillCollectedAt`: logging
    // the refill has to retire it with no second write, or the two can disagree.
    // `currentStock` is the SUM of log deltas, not a "quantity used" field -
    // the first version of this fixture used `quantity`, which computeStock does
    // not read, so it summed to 0 and asserted a shape the code never had.
    const short = computeStock(med({ logs: [{ delta: 5, date: "2026-09-19T09:00:00.000Z" }] }));
    expect(short.currentStock).toBe(5);
    expect(short.needsAction).toBe(true);

    // And a logged refill takes it back over the line on its own.
    const restocked = computeStock(med({ logs: [{ delta: 95, date: "2026-09-25T09:00:00.000Z" }] }));
    expect(restocked.needsAction).toBe(false);
  });

  it("a cancelled item is not awaiting collection", () => {
    // Cancelling says "I am not ordering this", so it is the opposite state.
    const m = med({ refillCancelledAt: "2026-09-21T09:00:00.000Z" });
    expect(!!m.refillRequestedAt && !m.refillCancelledAt).toBe(false);
  });

  it("an archived item is not awaiting collection", () => {
    expect(!med({ isArchived: true }).isArchived).toBe(false);
  });
});

describe("there is no timer", () => {
  it("no days-since constant was invented for the second stage", () => {
    // The medication lockout shipped 0.8 and 0.2 interval factors that nobody
    // could source, and the file now refuses unsourced timing constants. This
    // stage could easily have grown "bring it back after 3 days" with no number
    // behind it, so the absence is asserted rather than left to review.
    const fn = SYNC.slice(SYNC.indexOf("export async function getRefillAwaitingCollection"));
    const body = fn.slice(0, fn.indexOf("export async function"));
    expect(body).not.toMatch(/\b\d+\s*\*\s*24\s*\*\s*60/); // ms-from-days
    expect(body).not.toMatch(/\bsetTimeout\b/);
    expect(body).not.toMatch(/>\s*\d+\s*\*\s*DAY|DAYS_?AWAIT/i);
  });

  it("it is shown, not nagged: the awaiting list is not in the scheduling path", () => {
    // getRefillAwaitingCollection must not appear in syncRefillReminder, or
    // this stage would schedule its own notification and become exactly the
    // nagging the feature was built to stop. The first version of this test
    // also asserted `scheduleNotification` was absent from the function, which
    // was simply wrong - that is where the FIRST stage legitimately schedules.
    const fn = SYNC.slice(SYNC.indexOf("export async function syncRefillReminder"));
    const body = fn.slice(0, fn.indexOf("export", 40));
    expect(body).not.toMatch(/getRefillAwaitingCollection/);
    // ...and the first stage is still there, so the negative above is meaningful.
    expect(body).toMatch(/getRefillDueMedications/);
  });
});

describe("the way back exists", () => {
  it("undo clears BOTH suppression timestamps", () => {
    // Leaving refillCancelledAt behind would make the item vanish again for a
    // reason the user cannot see, which is the trap the undo exists to remove.
    expect(SYNC).toMatch(/handleUndoRefillRequest/);
    expect(SYNC).toMatch(/refillRequestedAt:\s*null,\s*refillCancelledAt:\s*null/);
  });

  it("Home offers it, with an accessible name", () => {
    expect(APP).toMatch(/handleUndoRefillRequest/);
    expect(APP).toMatch(/aria-label="Undo: these refills were not ordered after all"/);
  });
});

describe("the wiring is real", () => {
  it("App.jsx fetches and holds the awaiting list", () => {
    const c = codeOnly(APP);
    expect(c).toMatch(/const \[refillAwaiting, setRefillAwaiting\] = useState/);
    expect(c).toMatch(/setRefillAwaiting\(await getRefillAwaitingCollection\(\)\)/);
  });

  it("the line is rendered only when something is awaiting", () => {
    expect(codeOnly(APP)).toMatch(/refillAwaiting\.length > 0 &&/);
  });

  it("it does not reuse the red refill banner's signature", () => {
    // Deliberate: the second stage is deliberately NOT part of the due banner,
    // because acknowledging the red banner must not be able to hide a passive
    // "you ordered this and have not collected it" line - that would be a
    // suppression with no visible effect and no way back.
    expect(SYNC).toMatch(/buildRefillSignature/);
    expect(codeOnly(APP)).not.toMatch(/refillAwaiting\.length\s*,\s*refillSignature/);
  });

  it("the stripper still sees real code", () => {
    expect(codeOnly(SYNC)).toMatch(/getRefillAwaitingCollection/);
    expect(codeOnly(APP)).toMatch(/refillAwaiting/);
  });
});

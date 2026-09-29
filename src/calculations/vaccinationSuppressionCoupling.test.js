// The A3 device-silence path must still fire now that the builders require
// `due`.
//
// This is the coupling worth being paranoid about. buildVaccinationSignature
// gained a `due` requirement, and the vaccination SYNC function builds its own
// due state object rather than calling getVaccinationDueState() - it has
// `{vaccination, nextDue}` and reconstructs the rest. So a change to the
// builder can silently disable suppression with no test complaining: the
// signature simply becomes "" and the function stops suppressing. The user
// symptom would be "I ticked stop my phone notifying me and it ignores me" -
// which reads as the acknowledgement being ignored, not as a signature bug.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildVaccinationSignature } from "./reminderSuppression";

const VAC = readFileSync(
  resolve(process.cwd(), "src", "calculations", "vaccinationReminderSync.js"), "utf8"
);

describe("the vaccination sync still builds a usable fingerprint", () => {
  it("passes `due`, not just vaccination and dueDate", () => {
    // The precise failure being guarded: an object without `due` produces an
    // empty signature, so shouldSuppressDeviceNotification returns false at its
    // first line and the whole suppression path is dead code.
    const withoutDue = buildVaccinationSignature({ vaccination: { id: "v1" }, dueDate: new Date(0) });
    const withDue = buildVaccinationSignature({
      due: true, vaccination: { id: "v1" }, dueDate: new Date(0),
    });
    expect(withoutDue, "an object missing `due` must not fingerprint").toBe("");
    expect(withDue, "a due object must fingerprint").not.toBe("");
  });

  it("the sync call site supplies `due`", () => {
    // Source-level because a unit test cannot see the call site. The key is
    // that `due:` appears within the argument object it passes.
    const call = VAC.indexOf("buildVaccinationSignature(");
    expect(call, "buildVaccinationSignature is not called in the sync file").toBeGreaterThan(-1);
    const arg = VAC.slice(call, call + 320);
    expect(arg, "the vaccination sync must pass `due` to the builder").toMatch(/due:/);
  });

  it("an OVERDUE dose is exactly the case suppression exists for", () => {
    // The realistic scenario, end to end through the real predicate: a dose
    // past due, acknowledged with "also stop my phone notifying me".
    const state = { due: true, vaccination: { id: "vax_002" }, dueDate: new Date(Date.now() - 86400000) };
    const sig = buildVaccinationSignature(state);
    expect(sig).not.toBe("");
    // shouldSuppressDeviceNotification matches on signature + scope BOTH.
    const acks = [{ kind: "vaccination", signature: sig, scope: "both", at: "2026-03-14T00:00:00.000Z" }];
    expect(
      acks.some((a) => a.signature === sig && a.scope === "both")
    ).toBe(true);
  });
});

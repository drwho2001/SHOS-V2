// reminderSuppression.test.js — the pure rules behind Phase 3 banner
// suppression.
//
// These are the decisions that are easy to get subtly wrong and impossible to
// eyeball in the app: a reminder that reappears when it should stay hidden is
// a minor annoyance, and one that STAYS hidden when it should reappear is a
// missed dose. So the tests lean hard on the boundary cases rather than the
// happy path — in particular the line between "same outstanding item" and
// "genuinely new information", which is the entire design.
import { describe, it, expect } from "vitest";
import {
  REMINDER_KIND,
  ACK_SCOPE,
  buildMedsSignature,
  buildSimpleSignature,
  isBannerVisible,
  hasOutstandingAcknowledged,
  shouldSuppressDeviceNotification,
  appendSignature,
  upsertAcknowledgement,
  normaliseAcknowledgements,
} from "./reminderSuppression";

const MED = (id, since) => ({ id, _dueSince: since });

describe("buildMedsSignature", () => {
  it("treats each dose as a distinct instance, not each medication", () => {
    // THE most important test in this file. If a once-daily medication's
    // signature did not include the last-dose timestamp, acknowledging it as
    // due this morning would still match tomorrow morning and the user would
    // never be reminded of tomorrow's dose at all.
    const morning = buildMedsSignature([MED("med_1", "2026-09-28T08:00:00.000Z")]);
    const tomorrow = buildMedsSignature([MED("med_1", "2026-09-29T08:00:00.000Z")]);
    expect(morning).not.toBe(tomorrow);
  });

  it("is stable for an unchanged due set, whatever order it arrives in", () => {
    // It is recomputed on every 60s poll from a repository read, so an
    // unstable signature would make a dismissal evaporate on the next tick
    // and the feature would appear not to work at all.
    const a = buildMedsSignature([MED("m2", "2026-09-28T08:00:00.000Z"), MED("m1", null)]);
    const b = buildMedsSignature([MED("m1", null), MED("m2", "2026-09-28T08:00:00.000Z")]);
    expect(a).toBe(b);
  });

  it("changes when a SECOND medication becomes due", () => {
    // The other half of the boundary. Acknowledging "PrEP is due" must not
    // silence "Testosterone is now due too" two hours later.
    const one = buildMedsSignature([MED("prep", "2026-09-28T08:00:00.000Z")]);
    const two = buildMedsSignature([
      MED("prep", "2026-09-28T08:00:00.000Z"),
      MED("testosterone", "2026-09-28T10:00:00.000Z"),
    ]);
    expect(one).not.toBe(two);
  });

  it("survives a never-dosed medication on the id alone", () => {
    expect(buildMedsSignature([MED("new_med", null)])).toBe("new_med@never");
  });

  it("is empty when nothing is due", () => {
    expect(buildMedsSignature([])).toBe("");
    expect(buildMedsSignature(null)).toBe("");
  });
});

describe("buildSimpleSignature", () => {
  it("fingerprints by id and is order-independent", () => {
    expect(buildSimpleSignature(REMINDER_KIND.CLINIC_VISIT, [{ id: "v2" }, { id: "v1" }]))
      .toBe(buildSimpleSignature(REMINDER_KIND.CLINIC_VISIT, [{ id: "v1" }, { id: "v2" }]));
  });

  it("separates kinds, so two kinds can never collide", () => {
    // Without the kind prefix, an appointment with id "x" and a vaccination
    // with id "x" would share a signature, and acknowledging one would silence
    // the other.
    const visit = buildSimpleSignature(REMINDER_KIND.CLINIC_VISIT, [{ id: "x" }]);
    const jab = buildSimpleSignature(REMINDER_KIND.VACCINATION, [{ id: "x" }]);
    expect(visit).not.toBe(jab);
  });
});

describe("isBannerVisible", () => {
  const base = { dueCount: 1, signature: "med_1@2026-09-28T08:00:00.000Z" };

  it("shows an unsuppressed reminder", () => {
    expect(isBannerVisible(base)).toBe(true);
  });

  it("hides it for the rest of the session after a dismissal", () => {
    expect(isBannerVisible({ ...base, sessionDismissed: [base.signature] })).toBe(false);
  });

  it("hides it after an acknowledgement", () => {
    expect(isBannerVisible({ ...base, acknowledged: [base.signature] })).toBe(false);
  });

  it("shows it again once the due content changes", () => {
    // The point of the whole feature. A dismissal is recorded against the
    // fingerprint of what was due, so when something genuinely new becomes due
    // the fingerprint differs and the dismissal no longer applies.
    //
    // Note the signature is what changes here, not the count. They are not
    // independent: the signature IS a fingerprint of the due set, so a
    // different count with an identical signature is a state that cannot
    // actually occur, and asserting on it would be asserting on nonsense.
    expect(isBannerVisible({
      dueCount: 2,
      signature: "med_1@2026-09-28T08:00:00.000Z|med_2@never",
      sessionDismissed: [base.signature],
    })).toBe(true);
  });

  it("never shows a banner when nothing is due, whatever the records say", () => {
    // A suppression record must never be able to invent a reminder. Getting
    // this backwards is the one bug here that would be dangerous rather than
    // merely annoying.
    expect(isBannerVisible({ ...base, dueCount: 0, sessionDismissed: [base.signature] })).toBe(false);
    expect(isBannerVisible({ ...base, dueCount: 0, acknowledged: [base.signature] })).toBe(false);
  });

  it("treats a missing signature as nothing to show", () => {
    expect(isBannerVisible({ dueCount: 2, signature: "" })).toBe(false);
  });
});

describe("hasOutstandingAcknowledged", () => {
  const rec = { kind: REMINDER_KIND.MEDS, signature: "sig", scope: ACK_SCOPE.IN_APP, at: "x" };

  it("is true when the current due item is the acknowledged one", () => {
    expect(hasOutstandingAcknowledged({
      dueCount: 1, signature: "sig", kind: REMINDER_KIND.MEDS, acknowledgements: [rec],
    })).toBe(true);
  });

  it("is false once the dose is taken", () => {
    // Derived, never remembered: this is what stops the passive dot outliving
    // the thing it is about.
    expect(hasOutstandingAcknowledged({
      dueCount: 0, signature: "", kind: REMINDER_KIND.MEDS, acknowledgements: [rec],
    })).toBe(false);
  });

  it("is false when a DIFFERENT item is now outstanding", () => {
    expect(hasOutstandingAcknowledged({
      dueCount: 1, signature: "other", kind: REMINDER_KIND.MEDS, acknowledgements: [rec],
    })).toBe(false);
  });

  it("does not confuse two kinds that share a signature", () => {
    expect(hasOutstandingAcknowledged({
      dueCount: 1, signature: "sig", kind: REMINDER_KIND.VACCINATION, acknowledgements: [rec],
    })).toBe(false);
  });

  it("is false for a mere session dismissal - nothing was acknowledged", () => {
    // Deliberate. "Not now" is not "I have dealt with this", so it must not
    // leave a permanent passive mark implying the user is on top of it.
    expect(hasOutstandingAcknowledged({
      dueCount: 1, signature: "sig", kind: REMINDER_KIND.MEDS, acknowledgements: [],
    })).toBe(false);
  });
});

describe("shouldSuppressDeviceNotification", () => {
  const rec = (scope) => ({ kind: REMINDER_KIND.MEDS, signature: "sig", scope, at: "x" });

  it("suppresses only for a device-scoped acknowledgement", () => {
    expect(shouldSuppressDeviceNotification("sig", [rec(ACK_SCOPE.BOTH)])).toBe(true);
    expect(shouldSuppressDeviceNotification("sig", [rec(ACK_SCOPE.IN_APP)])).toBe(false);
  });

  it("is NOT triggered by a session dismissal - which is what keeps snooze working", () => {
    // The user's explicit requirement: a snoozed dose must re-push in the same
    // app session when the snooze expires. Snoozing writes a real timestamped
    // fact the due-state check already honours, so it needs no suppression
    // logic at all. Had dismissal suppressed notifications too, that would
    // have quietly killed it.
    expect(shouldSuppressDeviceNotification("sig", [])).toBe(false);
  });

  it("stops suppressing once the due content changes", () => {
    expect(shouldSuppressDeviceNotification("a-new-signature", [rec(ACK_SCOPE.BOTH)])).toBe(false);
  });
});

describe("appendSignature and upsertAcknowledgement", () => {
  it("adds to the front and never mutates the input", () => {
    const input = ["old"];
    expect(appendSignature(input, "new")).toEqual(["new", "old"]);
    expect(input).toEqual(["old"]);
  });

  it("moves a repeat to the front rather than duplicating it", () => {
    expect(appendSignature(["a", "b"], "b")).toEqual(["b", "a"]);
  });

  it("caps the list, so stored preferences cannot grow without bound", () => {
    const many = Array.from({ length: 80 }, (_, i) => `sig${i}`);
    expect(appendSignature(many, "new", 50)).toHaveLength(50);
  });

  it("upgrades a re-acknowledgement rather than leaving the weaker record behind", () => {
    const first = upsertAcknowledgement([], { kind: REMINDER_KIND.MEDS, signature: "sig", scope: ACK_SCOPE.IN_APP, at: "x" });
    const upgraded = upsertAcknowledgement(first, { kind: REMINDER_KIND.MEDS, signature: "sig", scope: ACK_SCOPE.BOTH, at: "y" });
    expect(upgraded).toHaveLength(1);
    expect(upgraded[0].scope).toBe(ACK_SCOPE.BOTH);
  });

  it("ignores a record with no signature", () => {
    expect(upsertAcknowledgement([], { kind: REMINDER_KIND.MEDS, scope: ACK_SCOPE.BOTH })).toEqual([]);
  });
});

describe("normaliseAcknowledgements", () => {
  const good = { kind: REMINDER_KIND.MEDS, signature: "sig", scope: ACK_SCOPE.IN_APP, at: "2026-09-28T00:00:00.000Z" };

  it("keeps a well-formed record", () => {
    expect(normaliseAcknowledgements([good])).toEqual([good]);
  });

  it("drops anything it cannot identify a reminder from", () => {
    // Restored-from-backup data is untrusted input. A record with an unknown
    // kind, a missing signature or an unknown scope is dropped rather than
    // rendered, because the one thing an acknowledgement must never do is
    // suppress a reminder it cannot be matched against.
    expect(normaliseAcknowledgements([
      null,
      "nonsense",
      { ...good, kind: "notARealKind" },
      { ...good, signature: "" },
      { ...good, scope: "everything" },
      good,
    ])).toEqual([good]);
  });

  it("returns an empty list for anything that is not a list", () => {
    expect(normaliseAcknowledgements(null)).toEqual([]);
    expect(normaliseAcknowledgements({ a: 1 })).toEqual([]);
  });

  it("supplies a timestamp for a record that has none", () => {
    const [record] = normaliseAcknowledgements([{ ...good, at: undefined }]);
    expect(typeof record.at).toBe("string");
  });
});

// disclosureLevel.test.js
//
// What is worth pinning here. This is a privacy control, so the dangerous
// direction is asymmetric: a level that fails OPEN shows a medication name or a
// test result on a lock screen. Every normalisation path therefore falls back
// to the most restrictive value, and the tests below check that from several
// angles, including an unknown value arriving from a restored backup written by
// a build that predates the field.
import { describe, it, expect } from "vitest";
import {
  DISCLOSURE_LEVELS,
  DEFAULT_DISCLOSURE_LEVEL,
  isValidDisclosureLevel,
  normaliseDisclosureLevel,
  resolveDisclosure,
} from "./disclosureLevel.js";
import { DEFAULT_PRIVACY_SETTINGS } from "../repositories/privacySettingsRepository.js";

describe("the default is the most restrictive level", () => {
  it("DEFAULT_PRIVACY_SETTINGS ships masked", () => {
    expect(DEFAULT_PRIVACY_SETTINGS.disclosureLevel).toBe("masked");
    expect(DEFAULT_DISCLOSURE_LEVEL).toBe("masked");
  });

  it("masked is one of the real levels, not a stray value", () => {
    expect(isValidDisclosureLevel("masked")).toBe(true);
    expect(DISCLOSURE_LEVELS.map((l) => l.id)).toEqual(["masked", "glanceable", "detailed"]);
  });

  it("every level carries its own user-facing explanation", () => {
    // The 'detailed' blurb has to say what the cost is, not just what it does -
    // otherwise the most exposing option reads as the most helpful one.
    for (const l of DISCLOSURE_LEVELS) expect(l.blurb.length).toBeGreaterThan(20);
    expect(DISCLOSURE_LEVELS.find((l) => l.id === "detailed").blurb).toMatch(/lock screen/i);
  });
});

describe("an unrecognised level fails closed, never open", () => {
  it("normalises garbage to masked", () => {
    for (const bad of [undefined, null, "", "DETAILED", "full", 0, 1, {}, []]) {
      expect(normaliseDisclosureLevel(bad)).toBe("masked");
    }
  });

  it("a level from an older backup that predates the field is masked", () => {
    // The realistic case: the object was restored without the key at all.
    expect(normaliseDisclosureLevel({ anonymiseModeActive: false })).toBe("masked");
  });

  it("resolveDisclosure falls closed for an unknown level too", () => {
    const out = resolveDisclosure("nonsense", {
      title: "PrEP due",
      body: "Take your PrEP at 8:00am",
      kind: "Medication reminder",
    });
    expect(out.title).not.toMatch(/PrEP/i);
    expect(out.body).not.toMatch(/PrEP|8:00am/i);
  });
});

describe("what each level actually discloses", () => {
  const payload = {
    title: "PrEP due",
    body: "Take your PrEP at 8:00am",
    kind: "Medication reminder",
    maskedTitle: "SHOS",
    maskedBody: "Open the app to see what's due.",
  };

  it("masked leaks nothing clinical", () => {
    const out = resolveDisclosure("masked", payload);
    expect(out.title).toBe("SHOS");
    expect(out.body).toBe("Open the app to see what's due.");
    expect(JSON.stringify(out)).not.toMatch(/PrEP|8:00am/i);
  });

  it("masked does not even echo the kind", () => {
    // 'kind' is deliberately not enough to pass through even at masked level -
    // it is a category, and a category plus timing is still a disclosure.
    expect(resolveDisclosure("masked", payload).body).not.toMatch(/Medication/i);
  });

  it("glanceable shows the kind but not the clinical detail", () => {
    const out = resolveDisclosure("glanceable", payload);
    expect(out.body).toBe("Medication reminder");
    expect(out.body).not.toMatch(/PrEP|8:00am/i);
  });

  it("glanceable falls back to blank rather than to the full body", () => {
    // The asymmetry is deliberate and is the reason `kind` has no clinical
    // field to arrive in: a caller that forgets to pass `kind` gets an empty
    // line, never the medication name.
    const out = resolveDisclosure("glanceable", { title: "PrEP due", body: "Take your PrEP at 8:00am" });
    expect(out.body).toBe("");
    expect(out.body).not.toMatch(/PrEP/i);
  });

  it("detailed is the identity function", () => {
    const out = resolveDisclosure("detailed", payload);
    expect(out.title).toBe("PrEP due");
    expect(out.body).toBe("Take your PrEP at 8:00am");
  });

  it("a caller passing nothing gets safe copy at every level", () => {
    for (const level of ["masked", "glanceable", "detailed"]) {
      const out = resolveDisclosure(level);
      expect(typeof out.title).toBe("string");
      expect(typeof out.body).toBe("string");
    }
    // Even 'detailed' with no input must not produce undefined leaking into a
    // notification body.
    expect(resolveDisclosure("detailed").body).toBe("");
  });
});

describe("the masked branch cannot receive clinical data at all", () => {
  it("resolveDisclosure's masked path is decided before any payload is used", () => {
    // Structural rather than behavioural: this asserts the resolver's signature
    // does not offer the masked branch a clinical field to forget to redact. If
    // someone later adds `medName` to the options object, this test still passes
    // but the shape guarantee is gone - so it is asserted by behaviour above
    // (masked + any input still yields generic copy) and documented here.
    const out = resolveDisclosure("masked", {
      title: "Appointment: sexual health clinic",
      body: "Dr Smith, 14 March",
      medName: "Testosterone",
      testResult: "Positive",
    });
    const serialised = JSON.stringify(out);
    expect(serialised).not.toMatch(/Testosterone|Positive|Dr Smith/i);
  });
});

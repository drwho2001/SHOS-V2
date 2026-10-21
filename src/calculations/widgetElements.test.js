// t089 - per-element visibility choice on a widget.
//
// A widget's TIER decides what it may disclose at all. t089 adds a second,
// finer choice: which of the OPTIONAL rows to draw. The Clinic Card renders
// eight rows today and the owner cannot reduce it to the two that matter.
//
// THE INVARIANT: element choice can only ever NARROW what the tier permits. It
// may hide a row the Full tier allows; it may never reveal one the Redacted
// tier forbids, and it may never override `off`. Asserted as a relation over
// every row and every tier rather than case by case, so a row added later
// cannot escape it.
//
// THE ASYMMETRY: an unreadable element choice SHOWS the row, because a blank
// widget reads to the user as data loss. That is the opposite trade to an
// unknown TIER, which hides - a tier protects a secret, an element choice only
// picks among rows already disclosed.

import { describe, it, expect } from "vitest";
import {
  OPTIONAL_ELEMENTS,
  optionalElementsFor,
  resolveAllElements,
  fieldAllowed,
} from "./widgetPrivacy.js";
import { ELEMENT_BRIDGE_FIELDS, elementShown } from "./widgetElements.js";

describe("optionalElementsFor (t089)", () => {
  it("exposes optional rows for the widgets that have them", () => {
    expect(optionalElementsFor("clinicCard").length).toBeGreaterThan(0);
    expect(optionalElementsFor("clinicCard").length).toBeGreaterThan(0);
  });

  it("returns an empty list for a widget with no optional rows", () => {
    // A settings screen would .map() this; undefined would crash it.
    expect(optionalElementsFor("cycle")).toEqual([]);
    expect(optionalElementsFor("nonsense")).toEqual([]);
  });

  it("every listed row has a label, so the screen cannot render a blank toggle", () => {
    for (const [widget, rows] of Object.entries(OPTIONAL_ELEMENTS)) {
      for (const row of rows) {
        expect(typeof row.key, widget + "." + row.key + ".key").toBe("string");
        expect(row.label, widget + "." + row.key + ".label").toBeTruthy();
      }
    }
  });

  it("no widget lists the same row key twice", () => {
    for (const [widget, rows] of Object.entries(OPTIONAL_ELEMENTS)) {
      const keys = rows.map((r) => r.key);
      expect(new Set(keys).size, widget + " duplicate row keys").toBe(keys.length);
    }
  });

  it("every listed row has a bridge field mapped", () => {
    // A row with no mapping is refused rather than allowed, so a forgotten
    // mapping must fail LOUDLY here rather than silently disabling the row.
    for (const [widget, rows] of Object.entries(OPTIONAL_ELEMENTS)) {
      const map = ELEMENT_BRIDGE_FIELDS[widget] || {};
      for (const row of rows) {
        expect(map[row.key], widget + "." + row.key + " unmapped").toBeTruthy();
      }
    }
  });

  it("the mapping introduces no field that is not already sent by a provider", () => {
    // Every mapped value must be a real payload field. A typo here would make
    // fieldAllowed ask about a field no widget ever sends, and the row would
    // then pass or fail for a reason that has nothing to do with privacy.
    const sent = {
      clinicCard: ["title", "date", "visitTime", "location", "clinicNum", "tests", "docType", "count"],
    };
    for (const [widget, map] of Object.entries(ELEMENT_BRIDGE_FIELDS)) {
      for (const [toggle, field] of Object.entries(map)) {
        expect(
          (sent[widget] || []).includes(field),
          widget + "." + toggle + " maps to unknown field " + field
        ).toBe(true);
      }
    }
  });
});

describe("elementShown narrows, never widens (t089)", () => {
  it("hides a row the user turned off, and keeps one they left on", () => {
    expect(elementShown("clinicCard", "showLocation", "full", { showLocation: false })).toBe(false);
    expect(elementShown("clinicCard", "showLocation", "full", { showLocation: true })).toBe(true);
  });

  it("cannot reveal a row the Redacted tier forbids", () => {
    // THE assertion. No element setting may make an identifying field sendable
    // at Redacted.
    expect(fieldAllowed("clinicCard", "location", "redacted")).toBe(false);
    expect(elementShown("clinicCard", "showLocation", "redacted", { showLocation: true })).toBe(false);
  });

  it("cannot override Off, whatever the element choice says", () => {
    for (const stored of [{}, { showLocation: true }, { showTests: true }]) {
      expect(elementShown("clinicCard", "showLocation", "off", stored)).toBe(false);
    }
  });

  it("is a strict subset of fieldAllowed, over every row and every tier", () => {
    const tiers = ["full", "redacted", "off"];
    for (const [widget, rows] of Object.entries(OPTIONAL_ELEMENTS)) {
      for (const row of rows) {
        for (const tier of tiers) {
          const stored = { [row.key]: true };
          if (elementShown(widget, row.key, tier, stored)) {
            const field = ELEMENT_BRIDGE_FIELDS[widget][row.key];
            expect(
              fieldAllowed(widget, field, tier),
              widget + "." + row.key + " at " + tier + " shown but field not allowed"
            ).toBe(true);
          }
        }
      }
    }
  });

  it("at Redacted, NO optional row is ever shown - stated positively, not just implied", () => {
    // The mutation "check the tier with the show* key" hides every row at
    // Redacted, which SATISFIES the subset relation above and so slipped
    // through it: visible rows still pass fieldAllowed, there are simply none.
    // That is the wrong-reason pass. So assert the positive direction too - at
    // Redacted an optional row is refused regardless of what the user chose,
    // because none of these fields is on a Redacted allowlist.
    for (const [widget, rows] of Object.entries(OPTIONAL_ELEMENTS)) {
      for (const row of rows) {
        expect(
          elementShown(widget, row.key, "redacted", { [row.key]: true }),
          widget + "." + row.key + " is shown at Redacted"
        ).toBe(false);
      }
    }
  });

  it("at Full, every optional row is shown unless the user turned it off", () => {
    // The mirror of the above: without this, "hide everything at Full" would
    // pass the Redacted assertion while producing an empty widget.
    for (const [widget, rows] of Object.entries(OPTIONAL_ELEMENTS)) {
      for (const row of rows) {
        expect(
          elementShown(widget, row.key, "full", { [row.key]: true }),
          widget + "." + row.key + " hidden at Full when left on"
        ).toBe(true);
      }
    }
  });
  it("an unmapped row is refused, not allowed", () => {
    // Fail-closed. A row added above without a mapping must not become an
    // unchecked pass.
    expect(elementShown("clinicCard", "showSomethingNew", "full", { showSomethingNew: true })).toBe(false);
  });

  it("an unreadable choice SHOWS the row, because a blank widget reads as data loss", () => {
    for (const stored of [undefined, {}, { showLocation: undefined }, { showLocation: null }, { showLocation: 0 }]) {
      expect(elementShown("clinicCard", "showLocation", "full", stored), JSON.stringify(stored)).toBe(true);
    }
  });
});

describe("resolveAllElements (t089)", () => {
  it("returns a boolean per listed row for every widget that has any", () => {
    const all = resolveAllElements({ showLocation: false });
    expect(Object.keys(all).sort()).toEqual(Object.keys(OPTIONAL_ELEMENTS).sort());
    for (const [widget, rows] of Object.entries(all)) {
      for (const key of Object.keys(rows)) {
        expect(typeof rows[key], widget + "." + key).toBe("boolean");
      }
    }
  });

  it("reflects a turned-off row", () => {
    const all = resolveAllElements({ showLocation: false });
    expect(all.clinicCard.showLocation).toBe(false);
    expect(all.clinicCard.showTests).toBe(true);
  });

  it("shows everything when nothing is stored", () => {
    for (const rows of Object.values(resolveAllElements(undefined))) {
      for (const v of Object.values(rows)) expect(v).toBe(true);
    }
  });
});
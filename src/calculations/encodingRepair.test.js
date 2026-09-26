import { describe, it, expect } from "vitest";
import {
  repairString,
  repairDeep,
  MOJIBAKE_MAP,
  MUST_PRESERVE,
} from "./encodingRepair";

const C = (...cps) => String.fromCodePoint(...cps);

describe("encodingRepair", () => {
  describe("repairString - the verified map", () => {
    it("repairs a double-encoded em dash", () => {
      const r = repairString("SHOS " + C(0x00e2, 0x20ac, 0x201d) + " Sexual Health");
      expect(r.text).toBe("SHOS " + C(0x2014) + " Sexual Health");
      expect(r.changed).toBe(true);
      expect(r.fixes[0].label).toContain("em dash");
    });

    it("maps the ambiguous bullet sequence to a BULLET, not the euro sign", () => {
      // The case a blind byte round-trip gets wrong: this decodes to a
      // valid euro sign, but was really the app's own bullet mask.
      const r = repairString(C(0x00e2, 0x20ac, 0x00a2).repeat(5) + " hidden");
      expect(r.text).toBe(C(0x2022).repeat(5) + " hidden");
      expect(r.text).not.toContain(C(0x20ac));
    });

    it("maps the ambiguous sequence to >= and not almost-equal", () => {
      expect(repairString("margin (" + C(0x00e2, 0x2030, 0x00a5) + "4.9:1)").text)
        .toBe("margin (" + C(0x2265) + "4.9:1)");
      expect(repairString("approx " + C(0x00e2, 0x2030, 0x02c6) + " close").text)
        .toBe("approx " + C(0x2248) + " close");
    });

    // ADDED 26 Sep 2026 — both sequences were confirmed against real
    // surrounding usage (a `// ── section ──` divider and the "★" primary-
    // symptom marker) before being added to the map, rather than decoded
    // blind. Pinned here so neither can be silently changed or dropped.
    it("repairs a double-encoded box-drawing divider back to U+2500", () => {
      const bad = "// " + C(0x00e2, 0x201d, 0x20ac, 0x00e2, 0x201d, 0x20ac) + " Add/Edit sheet";
      const r = repairString(bad);
      expect(r.text).toBe("// " + C(0x2500, 0x2500) + " Add/Edit sheet");
      expect(r.changed).toBe(true);
    });

    it("repairs a double-encoded star back to U+2605", () => {
      // Real shape: {isPrimary ? " ★" : ""} in JSX.
      const r = repairString('{isPrimary ? " ' + C(0x00e2, 0x02dc, 0x2026) + '" : ""}');
      expect(r.text).toBe('{isPrimary ? " ' + C(0x2605) + '" : ""}');
      expect(r.changed).toBe(true);
    });

    it("distinguishes the two arrow shapes", () => {
      expect(repairString("a " + C(0x00e2, 0x2020, 0x2019) + " b").text).toBe("a " + C(0x2192) + " b");      expect(repairString("a " + C(0x00e2, 0x2020, 0x201d) + " b").text).toBe("a " + C(0x2194) + " b");
    });

    it("repairs every sequence in the map, including repeated ones", () => {
      for (const [find, repl] of MOJIBAKE_MAP) {
        const r = repairString(find + find);
        expect(r.text).toBe(repl + repl);
        expect(r.changed).toBe(true);
      }
    });
  });

  describe("repairString - the characters the owner wants KEPT are untouchable", () => {
    it("leaves every must-preserve character completely unchanged", () => {
      for (const ch of MUST_PRESERVE) {
        const input = `value ${ch} value`;
        const r = repairString(input);
        expect(r.changed).toBe(false);
        expect(r.text).toBe(input);
      }
    });

    it("leaves a realistic string of mixed wanted characters alone", () => {
      const input = `48${C(0x00d7)}48 at ${C(0x2248)}4.9:1, ${C(0x2265)}4.9:1 ${C(0x2014)} 3${C(0x00d7)}2 ${C(0x00b7)} ${C(0x00b0)} ${C(0x00b1)} ${C(0x2026)} ${C(0x2019)} ${C(0x1f600)} ${C(0x2192)} ${C(0x2194)}`;
      const r = repairString(input);
      expect(r.changed).toBe(false);
      expect(r.text).toBe(input);
    });

    it("cannot produce a character outside the map's outputs", () => {
      const allowed = new Set(MOJIBAKE_MAP.map(([, to]) => to));
      // Feed every mojibake lead followed by every non-ASCII char; nothing
      // may come out as anything other than a mapped character.
      for (const lead of [C(0x00e2), C(0x00c2), C(0x00c3), C(0x00e3)]) {
        for (let cp = 0x80; cp < 0x300; cp++) {
          const r = repairString(lead + String.fromCodePoint(cp));
          if (r.changed) {
            for (const ch of r.text) expect(allowed.has(ch)).toBe(true);
          }
        }
      }
    });
  });

  describe("repairString - unknown corruption is reported, never guessed", () => {
    it("flags a lead character it has no mapping for instead of altering it", () => {
      const weird = C(0x00e2) + C(0x00f1, 0x00f2); // not a real known sequence
      const r = repairString(weird);
      expect(r.changed).toBe(false);
      expect(r.text).toBe(weird);
      expect(r.unknown.length).toBeGreaterThan(0);
    });

    it("is idempotent - repairing twice changes nothing the second time", () => {
      const first = repairString("a " + C(0x00e2, 0x20ac, 0x201d) + " b");
      const second = repairString(first.text);
      expect(second.changed).toBe(false);
      expect(second.text).toBe(first.text);
    });

    it("is a no-op on plain ASCII and normal text", () => {
      for (const s of ["", "Grace J.", "56 Dean Street, London", "Treatment - Gonorrhoea"]) {
        const r = repairString(s);
        expect(r.changed).toBe(false);
        expect(r.text).toBe(s);
      }
    });
  });

  describe("repairDeep - real record shapes", () => {
    it("repairs nested strings and reports their paths", () => {
      const record = {
        id: "contact_001",
        name: "Sam " + C(0x00e2, 0x20ac, 0x201d) + " R",
        notes: "Met at the sauna " + C(0x00e2, 0x20ac, 0x00a2) + " friendly",
        linkedContactIds: ["contact_002"],
        dose: { provider: "56 Dean Street", site: C(0x00e2, 0x20ac, 0x00a6) + " left arm" },
      };
      const r = repairDeep(record);
      expect(r.changed).toBe(true);
      expect(r.value.name).toBe("Sam " + C(0x2014) + " R");
      expect(r.value.notes).toContain(C(0x2022));
      expect(r.value.dose.site).toBe(C(0x2026) + " left arm");
      expect(r.value.linkedContactIds).toEqual(["contact_002"]); // untouched
      expect(r.value.id).toBe("contact_001"); // untouched
      const paths = r.changes.map((c) => c.path);
      expect(paths).toContain("name");
      expect(paths).toContain("notes");
      expect(paths).toContain("dose.site");
    });

    it("returns a value deep-equal to the input when nothing is corrupted", () => {
      const record = { a: "plain", b: ["x", "y"], c: { d: 1, e: null, f: true } };
      const r = repairDeep(record);
      expect(r.changed).toBe(false);
      expect(r.value).toEqual(record);
    });

    it("preserves non-string types exactly", () => {
      const record = { n: 42, z: 0, nil: null, t: true, f: false, arr: [], obj: {} };
      const r = repairDeep(record);
      expect(r.value).toEqual(record);
    });
  });
});

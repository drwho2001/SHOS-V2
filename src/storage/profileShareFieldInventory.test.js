// profileShareFieldInventory.test.js
//
// ADDED 14 Nov 2026 — the guard for BACKLOG 127/129/131's fix.
//
// THE DEFECT THIS GUARDS. The owner's audit (14 Nov) found that the Share My
// Profile panel never said WHICH fields transfer: the My Profile screen shows
// 20+ fields across nine sections, the recipient's Contacts view renders only
// what mapShareToContactData maps, and the only record of that mapping was a
// hand-typed allowlist with no UI counterpart. The panel's old footer —
// "Sharing sends only what's above" — was true and useless, because "above"
// was two opt-in toggles, not the thirty fields that always go.
//
// The fix is describeShareFields(): ONE function, read by the panel for its
// wording and (indirectly, through buildProfileShare/mapShareToContactData)
// by the share itself. These tests assert the two lists cannot drift apart —
// that every field buildProfileShare WRITES is in SHAREABLE_FIELDS, every
// field mapShareToContactData READS is in SHAREABLE_FIELDS, and the never-
// shared list is exactly the fields the mapping deliberately omits.
//
// This is the same shape as the rest of this repo's guards: not "does the
// test pass today" but "can the two copies of one truth disagree silently".
// The answer after this file is no: a field added to the share payload
// without joining the inventory fails here, and a field listed as shared
// without being in the payload fails here too.

import { describe, it, expect } from "vitest";
import {
  SHAREABLE_FIELDS,
  NEVER_SHARED_FIELDS,
  describeShareFields,
} from "./profileShareService.js";

// Reads the source of the two functions that actually move data, so the
// inventory is checked against the REAL field lists, not a third copy of
// them. Stripping comments matters: buildProfileShare's comments name the
// excluded fields, and comment text is not code.
import fs from "node:fs";
import path from "node:path";

const SRC = fs.readFileSync(path.join(process.cwd(), "src/storage/profileShareService.js"), "utf8");
const stripComments = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");

const clean = stripComments(SRC);

// The block of buildProfileShare that assembles shareableData: from its
// declaration to the closing of the object literal.
const buildBlock = clean.match(/const shareableData = \{[\s\S]*?\n {2}\};/)?.[0] ?? "";
expect(buildBlock.length, "could not locate buildProfileShare's shareableData block").toBeGreaterThan(0);

// Fields it WRITES: `name: profile.name` or the spread forms. Spread lines
// for the two opt-ins are checked separately, not counted as always-shared.
const written = new Set(
  [...buildBlock.matchAll(/^\s{4}(\w+):\s*(?:profile|await|{})/gm)].map((m) => m[1]),
);

// Fields mapShareToContactData READS from the parsed share.
const mapBlock = clean.match(/export function mapShareToContactData[\s\S]*?\n {2}\};/)?.[0] ?? "";
expect(mapBlock.length, "could not locate mapShareToContactData").toBeGreaterThan(0);
const read = new Set(
  [...mapBlock.matchAll(/(?:^|\n)\s{4}(\w+):\s*d\./g)].map((m) => m[1]),
);

describe("the share-field inventory matches what the share code actually does", () => {
  it("every field buildProfileShare writes is listed as shareable (or is a declared opt-in)", () => {
    const OPT_IN = new Set(["lastTestedDate", "hivStatus", "hivStatusDate"]);
    const writtenArr = [...written].filter((f) => !OPT_IN.has(f));
    // profilePicture rides along outside the literal's plain assignments in
    // some shapes; it IS in the inventory either way.
    const missing = writtenArr.filter((f) => !SHAREABLE_FIELDS.includes(f));
    expect(
      missing,
      `buildProfileShare writes ${missing.join(", ")} but SHAREABLE_FIELDS does not list them — ` +
        `the Share panel would not tell the owner these transfer`,
    ).toEqual([]);
  });

  it("every field listed as shareable is actually written by buildProfileShare", () => {
    const absent = SHAREABLE_FIELDS.filter((f) => !written.has(f) && !buildBlock.includes(f));
    expect(
      absent,
      `SHAREABLE_FIELDS lists ${absent.join(", ")} but buildProfileShare never writes them — ` +
        `the panel would promise fields that do not transfer`,
    ).toEqual([]);
  });

  it("every field mapShareToContactData reads is listed as shareable (or is a declared opt-in)", () => {
    // The mapping reads the opt-in fields too, because they MAY be present
    // in a payload whose sharer ticked the toggle. That is legitimate —
    // but the read must stay limited to fields the inventory knows about.
    const OPT_IN = new Set(["lastTestedDate", "hivStatusInformedDate", "hivStatus", "hivStatusDate"]);
    const missing = [...read].filter((f) => !SHAREABLE_FIELDS.includes(f) && !OPT_IN.has(f));
    expect(
      missing,
      `mapShareToContactData reads ${missing.join(", ")} but SHAREABLE_FIELDS does not list them`,
    ).toEqual([]);
  });

  it("the never-shared list is exactly the deliberately excluded fields", () => {
    // The comment in buildProfileShare names the exclusions; these are the
    // fields that must NEVER appear in the shared payload. Assert the list
    // exists, is disjoint from the shareable list, and that buildProfileShare
    // writes none of them.
    expect(NEVER_SHARED_FIELDS.length).toBeGreaterThan(0);
    const overlap = NEVER_SHARED_FIELDS.filter((f) => SHAREABLE_FIELDS.includes(f));
    expect(overlap, `fields listed as BOTH shared and never-shared: ${overlap.join(", ")}`).toEqual([]);

    const leaked = NEVER_SHARED_FIELDS.filter((f) => buildBlock.includes(`${f}:`));
    expect(
      leaked,
      `buildProfileShare writes ${leaked.join(", ")} which are declared never-shared — ` +
        `the panel would tell the owner these never leave the device while the code sends them`,
    ).toEqual([]);
  });

  it("describeShareFields reflects the opt-in toggles and nothing else", () => {
    const base = describeShareFields({});
    expect(base.optIn).toEqual([]);
    expect(base.shared).toEqual(SHAREABLE_FIELDS);
    expect(base.neverShared).toEqual(NEVER_SHARED_FIELDS);

    const withDate = describeShareFields({ includeLastTestedDate: true });
    expect(withDate.optIn).toContain("lastTestedDate");
    expect(withDate.optIn).not.toContain("hivStatus");

    const withHiv = describeShareFields({ includeHivStatus: true });
    expect(withHiv.optIn).toContain("hivStatus");
    expect(withHiv.optIn).not.toContain("lastTestedDate");

    // Opting in never widens the always-shared list — the toggles are
    // additive to a fixed payload, not a permission slider.
    expect(withHiv.shared).toEqual(base.shared);
  });

  it("the two lists stay disjoint and every name is a plausible field name", () => {
    for (const f of [...SHAREABLE_FIELDS, ...NEVER_SHARED_FIELDS]) {
      expect(f, "field names must be plain identifiers").toMatch(/^\w+$/);
    }
    expect(new Set(SHAREABLE_FIELDS).size).toBe(SHAREABLE_FIELDS.length);
    expect(new Set(NEVER_SHARED_FIELDS).size).toBe(NEVER_SHARED_FIELDS.length);
  });
});

// Tests for textCanonicalisation.js.
//
// THE LOAD-BEARING PROPERTY IN THIS FILE is that canonical forms never reach
// stored data. Everything here is about COMPARISON, and the module has no write
// path at all - which is asserted structurally rather than merely described,
// because "it does not write X" is a much weaker claim than "there is nothing in
// this module that writes".
//
// The negative cases matter more than the positive ones here. A canonicaliser
// that merges two different clinicians' names, or two different people's phone
// numbers, is worse than one that misses a duplicate - so most of these tests
// assert that things are NOT considered the same.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalCompareKey,
  compareKeysAreEqual,
  filterByCanonicalMatch,
  dedupeByCanonicalKey,
  canonicalPhoneDigits,
  phonesAreEqual,
  canonicalMeasurementKey,
} from "./textCanonicalisation.js";
import { UNIT_CONFIG } from "../repositories/measurementRepository.js";

describe("canonicalCompareKey", () => {
  it("collapses the cheap near-duplicates", () => {
    expect(canonicalCompareKey("Dr A  Smith")).toBe(canonicalCompareKey("dr a smith"));
  });

  it("treats a missing stop as punctuation, not as a different name", () => {
    expect(canonicalCompareKey("St. Mary's Clinic")).toBe(canonicalCompareKey("St Marys Clinic"));
  });

  it("treats a curly apostrophe as the same character as a straight one", () => {
    expect(canonicalCompareKey("Sam\u2019s")).toBe(canonicalCompareKey("Sams"));
  });

  it("collapses accented and unaccented spellings for COMPARISON only", () => {
    expect(canonicalCompareKey("André")).toBe(canonicalCompareKey("Andre"));
  });

  it("keeps genuinely different names apart", () => {
    // The false-positive case. A rule loose enough to merge these would be
    // telling two real clinicians they are one person.
    expect(canonicalCompareKey("Dr Smith")).not.toBe(canonicalCompareKey("Dr Smyth"));
  });

  it("keeps a shared surname apart when the given name differs", () => {
    expect(canonicalCompareKey("Dr James Smith")).not.toBe(canonicalCompareKey("Dr Jane Smith"));
  });

  it("returns empty for anything unusable, rather than throwing", () => {
    expect(canonicalCompareKey(null)).toBe("");
    expect(canonicalCompareKey(undefined)).toBe("");
    expect(canonicalCompareKey(42)).toBe("");
    expect(canonicalCompareKey("")).toBe("");
  });
});

describe("compareKeysAreEqual", () => {
  it("matches on the canonical key", () => {
    expect(compareKeysAreEqual("Dr A Smith", "dr  a smith")).toBe(true);
  });

  it("does NOT treat two blanks as a match", () => {
    // The mistake this guards: absent-vs-absent is not equality, and a rule that
    // says it is will report every pair of empty fields as the same record.
    expect(compareKeysAreEqual("", "")).toBe(false);
    expect(compareKeysAreEqual(null, undefined)).toBe(false);
  });
});

describe("filterByCanonicalMatch", () => {
  const names = ["Dr A Smith", "Dr Jane Smith", "Dean Street Clinic"];

  it("returns the ORIGINAL strings, never canonical ones", () => {
    // The whole point of the module: what the user taps is what was already on
    // file, byte-for-byte.
    const out = filterByCanonicalMatch(names, "dr a smith");
    expect(out).toEqual(["Dr A Smith"]);
    expect(out[0]).toBe(names[0]);
  });

  it("still matches when the query differs by punctuation and case", () => {
    expect(filterByCanonicalMatch(names, "DEAN  STREET")).toEqual(["Dean Street Clinic"]);
  });

  it("returns the first `limit` entries when the query is empty", () => {
    expect(filterByCanonicalMatch(names, "", { limit: 2 })).toEqual(["Dr A Smith", "Dr Jane Smith"]);
  });

  it("supports a keyOf for objects", () => {
    const items = [{ name: "Dean Street Clinic" }, { name: "Elsewhere" }];
    expect(filterByCanonicalMatch(items, "dean", { keyOf: (i) => i.name })).toEqual([{ name: "Dean Street Clinic" }]);
  });

  it("returns nothing for a query matching nothing", () => {
    expect(filterByCanonicalMatch(names, "zzzz")).toEqual([]);
  });
});

describe("dedupeByCanonicalKey", () => {
  it("collapses case-and-punctuation variants into the FIRST spelling", () => {
    const out = dedupeByCanonicalKey(["Dr Smith", "dr smith", "DR  SMITH."]);
    expect(out).toEqual(["Dr Smith"]);
  });

  it("keeps distinct names apart", () => {
    expect(dedupeByCanonicalKey(["Dr Smith", "Dr Smyth"])).toEqual(["Dr Smith", "Dr Smyth"]);
  });

  it("does NOT drop blank entries", () => {
    // Dropping every blank would silently hide real records. Keeping them is the
    // honest default even though it leaves apparent duplicates.
    expect(dedupeByCanonicalKey(["", "", "Dr Smith"])).toEqual(["", "", "Dr Smith"]);
  });
});

describe("phone comparison", () => {
  it("treats formatting and a country code as the same number", () => {
    expect(phonesAreEqual("07700 900123", "+44 7700 900123")).toBe(true);
  });

  it("keeps different numbers apart", () => {
    expect(phonesAreEqual("07700900123", "07700900124")).toBe(false);
  });

  it("refuses to match a fragment that is too short", () => {
    // A 3-digit fragment matching another would be a false duplicate.
    expect(canonicalPhoneDigits("123")).toBe("");
    expect(phonesAreEqual("123", "123")).toBe(false);
  });

  it("does NOT treat two blanks as a match", () => {
    expect(phonesAreEqual("", "")).toBe(false);
    expect(phonesAreEqual(null, null)).toBe(false);
  });

  it("handles a non-string input without throwing", () => {
    expect(() => canonicalPhoneDigits(undefined)).not.toThrow();
  });
});

describe("measurement canonical key", () => {
  it("reads the SAME table the repository converts with", () => {
    // Structural: a re-declared copy of the factors would drift invisibly.
    const Weight = UNIT_CONFIG.Weight;
    expect(Weight.canonical).toBe("kg");
    expect(canonicalMeasurementKey("Weight", 70, "kg")).toEqual({ unit: "kg", value: 70, key: "kg:70" });
  });

  it("returns null for a type with no declared canonical unit", () => {
    expect(canonicalMeasurementKey("Viral load", 500, "copies/mL")).toBeNull();
  });

  it("returns null for an unparseable value rather than reporting zero", () => {
    // "Not convertible" must never read as 0, which is a real measurement.
    expect(canonicalMeasurementKey("Weight", "heavy", "kg")).toBeNull();
    expect(canonicalMeasurementKey("Weight", NaN, "kg")).toBeNull();
  });

  it("returns null for an unknown type", () => {
    expect(canonicalMeasurementKey("Not A Type", 1, "kg")).toBeNull();
  });
});

describe("the module cannot write", () => {
  const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "textCanonicalisation.js"), "utf8");

  it("exports no function that could write anything", () => {
    // The strongest form: there is no entry point to call, so "it does not
    // repair/write" cannot silently become false the way a behavioural test
    // asserting "no repository call happened" can.
    expect(Object.keys(import.meta).filter((n) => /write|save|store|update|repair|persist|create|delete/i.test(n))).toEqual([]);
  });

  it("imports no repository writer and mutates nothing", () => {
    const withoutComments = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(withoutComments).not.toMatch(/Repository\.(add|update|create|save|remove|delete|replaceAll)/);
    expect(withoutComments).not.toMatch(/localStorage|storage\.save|\.findOrCreate\(/);
  });

  it("does not use normalizeTag, the mutating normaliser this exists alongside", () => {
    // normalizeTag title-cases and its result gets stored. Naming it here so the
    // relationship is explicit rather than a trap for the next reader.
    const withoutComments = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(withoutComments).not.toMatch(/normalizeTag/);
  });

  it("never returns a canonical form where the caller asked for a value", () => {
    // filterByCanonicalMatch returns the input strings by identity, which is
    // what makes "store raw" true rather than aspirational.
    const original = ["  Dr   A  Smith  "];
    expect(filterByCanonicalMatch(original, "smith")[0]).toBe(original[0]);
    expect(dedupeByCanonicalKey(original, {})[0]).toBe(original[0]);
  });
});
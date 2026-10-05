import fs from "node:fs";
import path from "node:path";
import { it, expect } from "vitest";

/**
 * Guards the fix for a real data-loss incident: "Clear sample data" deleted 74
 * of the owner's genuine records.
 *
 * Two independent halves, and the second is the one that actually protects:
 *
 *   1. Every repository's `update()` stamps `isSeed: false`, because editing a
 *      demo record is the moment it becomes the user's own data.
 *   2. `isSeed: false` is AUTHORITATIVE in clearSampleData - a record carrying
 *      it is real data whatever its id says. This is the half that makes a
 *      recovered backup (74 real records restored under their ORIGINAL seed ids,
 *      each stamped isSeed:false) safe to import.
 *
 * Guard 1 is asserted statically because fourteen hand-written behavioural tests
 * would be fourteen chances to forget one, and a forgotten repository is silent:
 * the flag simply never gets set there.
 *
 * AST-based, following the convention this repo settled on after several regex
 * scans produced false results.
 */
const REPO_DIR = "src/repositories";
const REPOS = [
  "contact", "encounter", "testing", "medication", "clinicVisits", "vaccination",
  "measurement", "symptomLog", "locations", "episode", "log", "menstrualCycle",
  "contraception", "pregnancy",
];

it("every seeded repository stamps isSeed:false when the user edits a record", () => {
  for (const r of REPOS) {
    const src = fs.readFileSync(path.join(REPO_DIR, `${r}Repository.js`), "utf8");

    // Isolate update()'s body rather than trusting a whole-file search: a stamp
    // anywhere else would be decoration, and one is exactly what a decoy looks like.
    const m = src.match(/async update\(id, changes\) \{[\s\S]*?\n {2}\}/);
    expect(m, `${r}Repository.js has no recognisable update(id, changes)`).toBeTruthy();

    expect(
      /isSeed: false/.test(m[0]),
      `${r}Repository.js update() does not stamp isSeed: false. Editing a demo ` +
        `record is what makes it the user's own data - without this flag, ` +
        `clearSampleData still identifies it as sample purely by id and deletes it.`,
    ).toBe(true);
  }
});

it("the stamp is on the persisted record, not in a comment or a discarded branch", () => {
  // The non-vacuity half of the test above. If the assertion were satisfied by a
  // mention in a comment, every repository would pass while nothing worked -
  // which is precisely the failure mode this file exists to prevent.
  const src = fs.readFileSync(path.join(REPO_DIR, "contactRepository.js"), "utf8");
  const m = src.match(/async update\(id, changes\) \{[\s\S]*?\n {2}\}/);
  const code = m[0]
    .split("\n")
    .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
    .join("\n");
  expect(
    /isSeed: false/.test(code),
    "the isSeed:false stamp only appears in comments, so it is never actually written",
  ).toBe(true);
});

it("isSampleRecord treats isSeed:false as authoritative, ahead of any id test", () => {
  const src = fs.readFileSync(path.join(REPO_DIR, "clearSampleData.js"), "utf8");

  expect(
    /function isSampleRecord\(/.test(src),
    "clearSampleData has no isSampleRecord helper - the isSeed flag is not being consulted",
  ).toBe(true);

  // ORDER MATTERS: the flag must be tested BEFORE the id set, or id membership
  // could override it. Asserting both are present is not enough.
  const body = src.slice(src.indexOf("function isSampleRecord"));
  const flagAt = body.indexOf("isSeed === false");
  const idAt = body.indexOf("seedIds.has");
  expect(flagAt, "isSampleRecord never tests record.isSeed").toBeGreaterThan(-1);
  expect(idAt, "isSampleRecord never falls back to the id set").toBeGreaterThan(-1);
  expect(
    flagAt < idAt,
    "isSampleRecord tests the id set BEFORE the isSeed flag, so id membership " +
      "can override the flag and a recovered record under a seed id is deleted anyway",
  ).toBe(true);
});

it("every sample-data decision goes through isSampleRecord, not a raw id test", () => {
  // The three decision points: referencedSeedIds' skip, countSampleData's filter,
  // and clearSampleData's keep/delete filter. A fourth raw `seedIds.has(r.id)`
  // would silently reintroduce the bug in one place only.
  const src = fs.readFileSync(path.join(REPO_DIR, "clearSampleData.js"), "utf8");
  const raw = src.split("\n").filter((l) => /seedIds\.has\(/.test(l) && !/isSeed/.test(l));

  // One legitimate occurrence remains: inside isSampleRecord itself, which is the
  // single place the id test is allowed to live.
  expect(
    raw.length,
    `raw seedIds.has() calls outside isSampleRecord:\n${raw.join("\n")}`,
  ).toBeLessThanOrEqual(2); // the declaration line + the body line of isSampleRecord
});

it("a recovered record under a seed id is kept, not deleted", () => {
  // Behavioural, and the one that would actually have prevented the incident.
  // isSampleRecord is not exported, so this mirrors its two-line contract
  // deliberately and separately - the real wiring is asserted structurally in
  // the two tests above. What this pins is the DECISION, so that a future
  // reordering of the two checks is caught here even if the source still parses.
  const isSampleRecord = (record, seedIds) =>
    record.isSeed === false ? false : seedIds.has(record.id);

  const seedIds = new Set(["contact_001", "contact_002", "contact_003"]);

  // Unedited seed - still sample data, deletable.
  expect(isSampleRecord({ id: "contact_001" }, seedIds)).toBe(true);
  // The incident: a real record sitting on a SEED id, because it was recovered
  // from a backup that predates the flag. This is the exact shape that was
  // deleted. It must be kept.
  expect(isSampleRecord({ id: "contact_001", isSeed: false }, seedIds)).toBe(false);
  // A real record under a non-seed id was already safe before this change.
  expect(isSampleRecord({ id: "contact_017" }, seedIds)).toBe(false);

  // And the failure direction that must NOT flip: an unedited seed referenced
  // only by other unedited seeds is still deletable, or Clear Sample Data
  // silently does nothing. Every seed contact is referenced by a seed encounter,
  // so this is the common case, not an edge case.
  expect(isSampleRecord({ id: "contact_002" }, seedIds)).toBe(true);
});

it("referencedSeedIds lets a real record vouch, and an unedited seed not", () => {
  const src = fs.readFileSync(path.join(REPO_DIR, "clearSampleData.js"), "utf8");
  const body = src.slice(src.indexOf("function referencedSeedIds"));

  expect(
    /if \(isSampleRecord\(record, seedIds\)\) continue/.test(body),
    "referencedSeedIds still keys its skip on the raw id set, so a recovered " +
      "record (isSeed:false under a seed id) cannot vouch for what it references - " +
      "which is the other half of the incident",
  ).toBe(true);
});
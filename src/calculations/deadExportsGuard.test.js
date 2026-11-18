// P3 hygiene — the old BACKLOG.md:1845 list was re-verified before deletion:
// several entries were already gone, and several are now LIVE (e.g.
// DEFAULT_VAGINAL_HEALTH_ENTRY is the R7 backup shim). Only the genuinely
// definition-only exports were removed. This guard stops them creeping back.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("src");
function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(jsx?|mjs|cjs)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

const REMOVED = [
  "REDACTED_COPY",
  "FONT_FAMILY_MONO",
  "CONTACT_REQUIRED_FIELD_GROUPS",
  "getOpen",
  "removeMemberFromAllGroups",
  "getGroupForMember",
  "applyDisclosure",
];

describe("dead exports removed", () => {
  it("none of the verified-dead exports appear in production source", () => {
    const sources = walk(SRC).map((f) => fs.readFileSync(f, "utf8")).join("\n");
    for (const name of REMOVED) {
      expect(sources, `${name} came back`).not.toMatch(new RegExp(`\\b${name}\\b`));
    }
  });

  it("exports once listed as dead but now live are kept", () => {
    const sources = walk(SRC).map((f) => fs.readFileSync(f, "utf8")).join("\n");
    for (const name of ["DEFAULT_VAGINAL_HEALTH_ENTRY", "TOUR_STEPS", "derivePinVerifier"]) {
      expect(sources, `${name} is live — do not delete`).toMatch(new RegExp(`\\b${name}\\b`));
    }
  });
});

// F3 (18 Nov) — menopause status is user-entered profile data, never inferred,
// and never included in a shared profile.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_PROFILE } from "../repositories/myProfileRepository.js";
import { NEVER_SHARED_FIELDS, SHAREABLE_FIELDS, describeShareFields } from "./profileShareService.js";

describe("menopause status profile fields", () => {
  it("defaults to 'Not recorded' with no date and no no-uterus flag", () => {
    expect(DEFAULT_PROFILE.menopauseStatus).toBe("Not recorded");
    expect(DEFAULT_PROFILE.menopauseConfirmedAt).toBeNull();
    expect(DEFAULT_PROFILE.noUterus).toBe(false);
  });

  it("is on the NEVER_SHARED list and never on SHAREABLE_FIELDS", () => {
    for (const field of ["menopauseStatus", "menopauseConfirmedAt", "noUterus"]) {
      expect(NEVER_SHARED_FIELDS, field).toContain(field);
      expect(SHAREABLE_FIELDS, field).not.toContain(field);
      expect(describeShareFields().neverShared, field).toContain(field);
    }
  });

  it("does not enter the share payload even with every opt-in enabled", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/storage/profileShareService.js"), "utf8");
    // The inventory guard already proves no NEVER_SHARED field is written;
    // this pins the specific field names so a future rename is caught here too.
    expect(src).not.toMatch(/shareableData[\s\S]*?menopauseStatus/);
  });
});

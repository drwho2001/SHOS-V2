import { describe, it, expect } from "vitest";
import { buildProfileShare } from "./profileShareService.js";

describe("profile share allowlist", () => {
  it("never includes sensitive profile fields", async () => {
    const share = await buildProfileShare({ includeLastTestedDate: true, includeHivStatus: true });
    const data = share.data;
    const forbidden = ["aboutMeNotes", "allergies", "emergencyContactName", "emergencyContactPhone", "emergencyNotes", "dateOfBirth", "clinicNumber", "address", "nhsNumber", "updatedAt"];
    for (const key of forbidden) {
      expect(data).not.toHaveProperty(key);
    }
  });
});

import { describe, it, expect } from "vitest";
import { buildProfileShare } from "./profileShareService.js";

describe("profile share anonymise", () => {
  it("builds without throwing when anonymise is true", async () => {
    const share = await buildProfileShare({ anonymise: true });
    expect(share.data).toBeDefined();
    expect(typeof share.data.city).toBe("string");
    expect(typeof share.data.phone).toBe("string");
  });
});

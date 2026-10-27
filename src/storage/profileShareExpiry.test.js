import { describe, it, expect } from "vitest";
import { parseProfileShare } from "./profileShareService.js";

describe("profile share expiry", () => {
  it("rejects expired shares", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const json = JSON.stringify({ type: "shos_profile_share", schemaVersion: 1, expiresAt: past, data: {} });
    expect(() => parseProfileShare(json)).toThrow(/expired/i);
  });
  it("accepts unexpired shares", () => {
    const future = new Date(Date.now() + 60000).toISOString();
    const json = JSON.stringify({ type: "shos_profile_share", schemaVersion: 1, expiresAt: future, data: {} });
    expect(() => parseProfileShare(json)).not.toThrow();
  });
});

import { describe, it, expect } from "vitest";
import { parseProfileShare } from "./profileShareService.js";

describe("parseProfileShare", () => {
  it("rejects invalid JSON", () => {
    expect(() => parseProfileShare("{")).toThrow();
  });
  it("rejects backup-shaped data", () => {
    const json = JSON.stringify({ type: "x", data: { contacts: [] } });
    expect(() => parseProfileShare(json)).toThrow(/backup/i);
  });
  it("rejects newer schema versions", () => {
    const json = JSON.stringify({ type: "shos_profile_share", schemaVersion: 99, data: {} });
    expect(() => parseProfileShare(json)).toThrow(/newer/i);
  });
});

import { describe, it, expect } from "vitest";
import { mapShareToContactData } from "./profileShareService.js";

describe("mapShareToContactData", () => {
  it("drops non-string garbage fields", () => {
    const parsed = { data: { displayName: 123, city: 456, phone: true, nickname: "Nick" } };
    const result = mapShareToContactData(parsed);
    expect(result.name).toBe("Nick");
    expect(result.city).toBe("");
    expect(result.phone).toBe("");
    expect(result.nickname).toBe("Nick");
  });
  it("filters non-string array entries", () => {
    const parsed = { data: { statedKinks: ["a", 2, null], contactableVia: ["x", 9] } };
    const result = mapShareToContactData(parsed);
    expect(result.statedKinks).toEqual(["a"]);
    expect(result.contactableVia).toEqual(["x"]);
  });
});

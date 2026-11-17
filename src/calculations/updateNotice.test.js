import { describe, it, expect } from "vitest";
import { isUpdateNoticeDismissed, updateDismissValue, UPDATE_DISMISS_MS } from "./updateNotice.js";

describe("isUpdateNoticeDismissed", () => {
  const now = 1_700_000_000_000;
  it("is false with no stored value", () => {
    expect(isUpdateNoticeDismissed(now, null)).toBe(false);
    expect(isUpdateNoticeDismissed(now, "")).toBe(false);
  });
  it("is true inside the cooldown", () => {
    expect(isUpdateNoticeDismissed(now, updateDismissValue(now - 1000))).toBe(true);
  });
  it("is false once the cooldown has elapsed", () => {
    expect(isUpdateNoticeDismissed(now, updateDismissValue(now - UPDATE_DISMISS_MS - 1))).toBe(false);
  });
  it("rejects the old sessionStorage '1' flag — the exact bug", () => {
    expect(isUpdateNoticeDismissed(now, "1")).toBe(false);
  });
  it("rejects non-numeric junk", () => {
    expect(isUpdateNoticeDismissed(now, "not-a-timestamp")).toBe(false);
  });
});

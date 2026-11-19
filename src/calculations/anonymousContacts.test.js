import { describe, it, expect } from "vitest";
import { buildAnonymousContacts, clampAnonymousCount, ANONYMOUS_BASE_NAME } from "./anonymousContacts.js";
import { DEFAULT_CONTACT } from "../repositories/contactRepository.js";

describe("anonymous quick-add", () => {
  it("clamps a requested count to 1..20 and defaults to 1", () => {
    expect(clampAnonymousCount(0)).toBe(1);
    expect(clampAnonymousCount(-3)).toBe(1);
    expect(clampAnonymousCount(99)).toBe(20);
    expect(clampAnonymousCount("not a number")).toBe(1);
    expect(clampAnonymousCount(3)).toBe(3);
  });

  it("builds the requested number with stable, unique names", () => {
    const three = buildAnonymousContacts(3);
    expect(three.map((c) => c.name)).toEqual([ANONYMOUS_BASE_NAME, `${ANONYMOUS_BASE_NAME} 2`, `${ANONYMOUS_BASE_NAME} 3`]);
    expect(new Set(three.map((c) => c.name)).size).toBe(3);
  });

  it("flags each as intentionally complete and excluded from inactive tracking", () => {
    for (const c of buildAnonymousContacts(2)) {
      expect(c.markedComplete).toBe(true);
      expect(c.excludeFromActiveTracking).toBe(true);
    }
  });

  it("keeps the full contact shape so it merges cleanly on create", () => {
    const [c] = buildAnonymousContacts();
    for (const key of Object.keys(DEFAULT_CONTACT)) {
      expect(c).toHaveProperty(key);
    }
    expect(c.isDemo).toBe(false);
  });
});

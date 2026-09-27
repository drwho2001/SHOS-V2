// Regression coverage for the gate-inversion bug the persona audit found.
//
// The app decides whether to show contraception, whether to show
// anatomy-specific fields, and whether to default the Pregnancy tab on, by
// matching the stored gender string against exact literals in eight places
// across three modules. "Female" and "Trans-male" are therefore load-bearing
// values, not free-text labels.
//
// "Blood pressure" was already protected for exactly this reason and gender
// was not, so renaming it in Settings > Manage lists silently inverted every
// one of those gates for every already-saved record.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CustomOptionListsRepository } from "./customOptionListsRepository";

// Mock the storage adapter with an in-memory map, same approach as
// contactRepository.test.js. Without this the real adapter runs, the encryption
// vault is not unlocked in a test context, and every save logs "Vault is not
// unlocked" - the assertions would still pass against the in-memory list, but
// the test would be verifying almost nothing and printing alarming noise.
const mockStore = new Map();
vi.mock("../storage/storageAdapter", () => ({
  localStorageAdapter: {
    load: vi.fn((key, fallback) => (mockStore.has(key) ? mockStore.get(key) : fallback)),
    save: vi.fn((key, value) => { mockStore.set(key, JSON.parse(JSON.stringify(value))); return true; }),
  },
}));

describe("gender values the app's gates depend on", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("protects the two values real code matches exactly", () => {
    expect(CustomOptionListsRepository.isProtected("gender", "Female")).toBe(true);
    expect(CustomOptionListsRepository.isProtected("gender", "Trans-male")).toBe(true);
  });

  it("leaves the other gender values editable, so the user can describe themselves", () => {
    // Not protected on purpose: no code branches on these specific strings. An
    // unmatched gender takes the documented "don't presume, offer the reveal
    // link" branch, which is the intended behaviour - so protecting these
    // would remove real self-description for no correctness gain.
    expect(CustomOptionListsRepository.isProtected("gender", "Male")).toBe(false);
    expect(CustomOptionListsRepository.isProtected("gender", "Trans-female")).toBe(false);
    expect(CustomOptionListsRepository.isProtected("gender", "Non-binary")).toBe(false);
  });

  it("refuses to rename a protected value, so the gate cannot invert", async () => {
    const before = await CustomOptionListsRepository.get("gender");
    expect(before).toContain("Female");
    // Both rename() and remove() short-circuit on PROTECTED_VALUES before
    // touching the stored list.
    await CustomOptionListsRepository.rename("gender", "Female", "Woman");
    const after = await CustomOptionListsRepository.get("gender");
    expect(after).toContain("Female");
    expect(after).not.toContain("Woman");
  });

  it("refuses to remove a protected value", async () => {
    const before = await CustomOptionListsRepository.get("gender");
    await CustomOptionListsRepository.remove("gender", "Trans-male");
    const after = await CustomOptionListsRepository.get("gender");
    expect(after).toContain("Trans-male");
    expect(after.length).toBe(before.length);
  });

  it("still allows adding a genuinely new gender value", async () => {
    // Protection is per-VALUE, not per-list. Blocking adds would take away
    // the app's own documented ability to describe yourself in your own words.
    await CustomOptionListsRepository.add("gender", "Agender");
    const after = await CustomOptionListsRepository.get("gender");
    expect(after).toContain("Agender");
    expect(after).toContain("Female");
  });

  it("keeps the pre-existing 'Blood pressure' protection intact", async () => {
    // Regression guard on the protection mechanism itself, not just the new
    // entry - a change that widened or narrowed the check would show here.
    expect(CustomOptionListsRepository.isProtected("measurementType", "Blood pressure")).toBe(true);
    expect(CustomOptionListsRepository.isProtected("measurementType", "Weight")).toBe(false);
  });
});

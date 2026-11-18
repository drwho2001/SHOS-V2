// safetyShareFields.test.js — decision tests for the two optional Safety
// Share extras. The source-level guard in components/safetyShareGuard.test.js
// proves the sheet actually calls these; here we prove the decisions are right.
import { describe, it, expect } from "vitest";
import { isMapsLiveLink, parseDeadline, formatDeadline, buildSafetyShareMessage } from "./safetyShareFields";

const NOW = new Date(2026, 10, 16, 17, 0, 0); // 16 Nov 2026, 17:00 LOCAL
const CONTACT = { name: "Alex", phone: "07123456789", address: "1 Test Street", vehicle: "Blue bike", profilePicture: null };
const ALL_FIELDS = { name: true, phone: true, address: true, vehicle: true, photo: true };

describe("isMapsLiveLink", () => {
  it("accepts Google Maps web and short links only", () => {
    expect(isMapsLiveLink("https://www.google.com/maps/d/u/0/viewpoint?mid=abc")).toBe(true);
    expect(isMapsLiveLink("https://maps.google.com/maps?q=1,2")).toBe(true);
    expect(isMapsLiveLink("  https://maps.app.goo.gl/AbCdEf  ")).toBe(true);
    expect(isMapsLiveLink("https://goo.gl/maps/xyz")).toBe(true);
  });

  it("rejects links that are not Google Maps, malformed, or active-content", () => {
    for (const bad of [
      "", null, 42, "www.google.com/maps/foo", "javascript:alert(1)",
      "http://maps.app.goo.gl/abc", "https://evil.example/maps",
      "https://www.google.com.evil.test/maps/x", "https://www.google.com/notmaps",
      "https://user:pass@www.google.com/maps/x", "https://www.google.com:8080/maps/x",
    ]) {
      expect(isMapsLiveLink(bad), String(bad)).toBe(false);
    }
  });
});

describe("parseDeadline", () => {
  it("reads a datetime-local string as LOCAL wall-clock time", () => {
    const parsed = parseDeadline("2026-11-16T20:30", NOW);
    expect(parsed).not.toBeNull();
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(10);
    expect(parsed.getDate()).toBe(16);
    expect(parsed.getHours()).toBe(20);
    expect(parsed.getMinutes()).toBe(30);
    expect(formatDeadline(parsed)).toContain("2026");
  });

  it("rejects empty, malformed, rolled-over and past deadlines", () => {
    for (const bad of [null, undefined, "", "16/11/2026 20:30", "2026-02-31T20:30", "2026-11-16T25:00", "2026-11-16T20:30Z", "2026-11-16T16:00"]) {
      expect(parseDeadline(bad, NOW), String(bad)).toBeNull();
    }
  });
});

describe("buildSafetyShareMessage", () => {
  const base = { contact: CONTACT, fields: ALL_FIELDS, includeCurrentLocation: false, locationPin: null, mapsLiveLink: "", checkInDeadline: "", now: NOW };

  it("keeps the original message when neither extra is used", () => {
    const msg = buildSafetyShareMessage(base);
    expect(msg).toContain("If you don't hear from me within a few hours, here's their info:");
    expect(msg).toContain("Name: Alex");
    expect(msg).toContain("Sharing is not a safety guarantee.");
  });

  it("adds a timestamped pin when current location is included", () => {
    const msg = buildSafetyShareMessage({ ...base, includeCurrentLocation: true, locationPin: { url: "https://maps.google.com/?q=1,2", asOf: "17:05" } });
    expect(msg).toContain("My location (as of 17:05): https://maps.google.com/?q=1,2");
  });

  it("embeds the pasted live link and tells the recipient it is the sender's own sharing", () => {
    const link = "https://maps.app.goo.gl/AbCdEf";
    const msg = buildSafetyShareMessage({ ...base, mapsLiveLink: link });
    expect(msg).toContain(`My live location on Google Maps (I started the sharing; the link may stop working when I turn it off): ${link}`);
    expect(buildSafetyShareMessage({ ...base, mapsLiveLink: "https://evil.example/maps" })).not.toContain("live location on Google Maps");
  });

  it("states the deadline and asks the recipient to call and check the live link", () => {
    const msg = buildSafetyShareMessage({ ...base, checkInDeadline: "2026-11-16T20:30", mapsLiveLink: "https://maps.app.goo.gl/AbCdEf" });
    expect(msg).toMatch(/If you don't hear from me by .*2026.*, please call me and check my shared live location/);
    expect(msg).toMatch(/Check-in deadline: .*2026.*if you don't hear from me by then, please call me and check my shared live location/);

    const withoutLink = buildSafetyShareMessage({ ...base, checkInDeadline: "2026-11-16T20:30" });
    expect(withoutLink).not.toContain("check my shared live location");
    expect(withoutLink).toContain("Check-in deadline:");
  });

  it("never adds a deadline line for an invalid or past time", () => {
    for (const bad of ["", "2026-02-31T20:30", "2026-11-16T16:00"]) {
      expect(buildSafetyShareMessage({ ...base, checkInDeadline: bad })).not.toContain("Check-in deadline:");
    }
  });

  it("still honours unticked fields", () => {
    const msg = buildSafetyShareMessage({ ...base, fields: { name: true, phone: false, address: false, vehicle: false, photo: false } });
    expect(msg).toContain("Name: Alex");
    expect(msg).not.toContain("Phone:");
    expect(msg).not.toContain("Address:");
  });

  it("R11: omits ticked fields that have no value instead of 'not provided'", () => {
    const msg = buildSafetyShareMessage({
      ...base,
      contact: { name: "Alex" },
      fields: { name: true, phone: true, address: true, vehicle: true, photo: false },
    });
    expect(msg).toContain("Name: Alex");
    expect(msg).not.toContain("Phone:");
    expect(msg).not.toContain("Address:");
    expect(msg).not.toContain("Vehicle:");
    expect(msg).not.toContain("not provided");
  });

  it("R11: still includes ticked fields that DO have a value", () => {
    const msg = buildSafetyShareMessage({
      ...base,
      contact: { name: "Alex", phone: "07700 900123", address: "London", vehicle: "Blue car" },
      fields: { name: true, phone: true, address: true, vehicle: true, photo: false },
    });
    expect(msg).toContain("Phone: 07700 900123");
    expect(msg).toContain("Address: London");
    expect(msg).toContain("Vehicle: Blue car");
  });
});

// webNotificationLoopGuard.test.js — the 17 Nov 2026 web-only "notification
// every few seconds" loop. A local web notification dispatches a synthetic
// delivery event; App used that event to re-run checkDueMeds(), which
// re-scheduled a due-now reminder, which fired again — forever. The decision
// is pure; these tests also prove both sides of the wire are connected.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { shouldRecheckOnDelivery, WEB_LOCAL_NOTIFICATION_ORIGIN } from "./notificationService";

const read = (f) => readFileSync(path.join(process.cwd(), f), "utf8");

describe("shouldRecheckOnDelivery", () => {
  it("ignores only OUR synthetic web-local deliveries", () => {
    expect(WEB_LOCAL_NOTIFICATION_ORIGIN).toBe("web-local");
    expect(shouldRecheckOnDelivery({ id: 1, origin: "web-local" })).toBe(false);
  });

  it("still re-checks on genuine native deliveries and unknown shapes", () => {
    for (const n of [undefined, {}, { id: 1 }, { id: 1, origin: "native" }, null]) {
      expect(shouldRecheckOnDelivery(n), JSON.stringify(n)).toBe(true);
    }
  });
});

describe("both sides of the loop break are wired", () => {
  const service = read("src/storage/notificationService.js");
  const app = read("src/App.jsx");

  it("the synthetic event carries the origin marker", () => {
    expect(service).toMatch(/origin: WEB_LOCAL_NOTIFICATION_ORIGIN/);
    expect(service).toMatch(/shos-notification-delivered/);
  });

  it("App gates the due-check on that marker but still records history", () => {
    expect(app).toMatch(/shouldRecheckOnDelivery\(notification\)/);
    const gate = app.indexOf("if (shouldRecheckOnDelivery(notification)) checkDueMeds()");
    expect(gate).toBeGreaterThan(-1);
    expect(app.indexOf("NotificationHistoryRepository.record", gate)).toBeGreaterThan(gate);
  });

  it("native delivery path remains unbounded (no marker to filter)", () => {
    expect(service).toMatch(/plugin\.addListener\("localNotificationReceived", handler\)/);
  });
});

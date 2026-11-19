// notificationTakeAllColdStartGuard.test.js — 19 Nov 2026 owner finding:
// tapping "Take all" in the OS medication notification did not log doses,
// and a cold start did not auto-log either. Root cause confirmed from the
// installed plugin source: @capacitor/local-notifications v8.3.1 has NO
// `url` field on a local notification (definitions.d.ts — `url` is only on
// Attachment; LocalNotificationManager.buildIntent() never sets intent
// data), so the old JS `getLaunchUrl()` fallback could never fire on its own.
// The real fix hands the cold-start "Take all" action intent a custom-scheme
// data URI in MainActivity BEFORE the Bridge snapshots it, which the existing
// App.jsx handler then routes. These assertions cover both sides of the wire.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (f) => readFileSync(path.join(process.cwd(), f), "utf8");

describe("native cold-start handoff", () => {
  const main = read("android/app/src/main/java/com/shos/app/MainActivity.java");

  it("recognises the plugin's TAKE_ALL action extra on the launch intent", () => {
    expect(main).toMatch(/getStringExtra\("LocalNotificationUserAction"\)/);
    expect(main).toMatch(/"TAKE_ALL"\.equals\(/);
  });

  it("tags the launch intent with the custom-scheme take-all URI", () => {
    expect(main).toMatch(/setData\(Uri\.parse\("com\.shos\.app:\/\/medication\/take-all"\)\)/);
  });

  it("sets the data BEFORE super.onCreate (when the Bridge snapshots it)", () => {
    const setData = main.indexOf("launchIntent.setData");
    const superOnCreate = main.indexOf("super.onCreate(savedInstanceState)");
    expect(setData).toBeGreaterThan(-1);
    expect(superOnCreate).toBeGreaterThan(-1);
    expect(setData).toBeLessThan(superOnCreate);
  });
});

describe("JS routing", () => {
  const app = read("src/App.jsx");
  const sync = read("src/calculations/medicationReminderSync.js");

  it("App accepts both the original /take and the explicit /take-all", () => {
    expect(app).toMatch(/com\.shos\.app:\/\/medication\/take-all/);
    expect(app).toMatch(/com\.shos\.app:\/\/medication\/take"\)/);
    expect(app).toMatch(/const isTakeAll =/);
  });

  it("one dedup ref guards BOTH the URL route and the native action path", () => {
    const uses = app.match(/medicationTakeHandledAtRef/g) || [];
    expect(uses.length).toBeGreaterThanOrEqual(5);
    // The URL handler and the native action listener must each check + stamp
    // the same ref, or a cold start logs the due meds twice.
    expect(app).toMatch(/if \(Date\.now\(\) - medicationTakeHandledAtRef\.current < 5000\) return;/);
    expect(app).toMatch(/if \(action\.actionId === MEDICATION_ACTIONS\.takeAll\) \{[\s\S]{0,400}medicationTakeHandledAtRef\.current = Date\.now\(\);/);
  });

  it("the medication notification carries the take-all URI", () => {
    expect(sync).toMatch(/url: "com\.shos\.app:\/\/medication\/take-all"/);
  });
});

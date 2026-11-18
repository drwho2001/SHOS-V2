// R10 (18 Nov) — onboarding: dots need breathing room on short viewports, and
// the DoxyPEP slide must say how "real notifications" get enabled.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const src = fs.readFileSync(path.join(process.cwd(), "src/App.jsx"), "utf8");

describe("onboarding polish", () => {
  it("is reading the real App shell", () => {
    expect(src.length).toBeGreaterThan(100_000);
    expect(src).toContain("ONBOARDING_SLIDES");
  });

  it("gives the progress dots their own space and an accessible label", () => {
    expect(src).toMatch(/role="group" aria-label="Onboarding progress"[^>]*flexShrink: 0[^>]*gap: 8[^>]*marginTop: 12/);
    expect(src).toMatch(/aria-current=\{i === step \? "step" : undefined\}/);
  });

  it("tells the user how to enable the notifications it promises", () => {
    const slide = src.slice(src.indexOf('title: "DoxyPEP & reminders"'), src.indexOf('title: "DoxyPEP & reminders"') + 500);
    expect(slide).toMatch(/asked to allow notifications/);
    expect(slide).toMatch(/Settings → Notifications/);
  });

  it("does not build the already-shipped replay-tour item", () => {
    // Guide already owns it — the onboarding slides must not duplicate it.
    expect(src).not.toMatch(/title: "Replay tour"/);
  });
});

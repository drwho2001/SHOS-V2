// mobileViewportGuard.test.js — 17 Nov 2026 mobile-web report: the bottom
// nav was partly hidden behind the browser toolbar and module tabs could not
// be tapped. 100vh includes that strip; 100dvh is the visible viewport. The
// app shell therefore reads a CSS variable with a plain vh fallback.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (f) => readFileSync(path.join(process.cwd(), f), "utf8");
const HTML = read("index.html");
const APP = read("src/App.jsx");

describe("dynamic viewport height for the app shell", () => {
  it("defines a vh fallback and upgrades to dvh where supported", () => {
    expect(HTML).toMatch(/--shos-app-height:\s*100vh/);
    expect(HTML).toMatch(/@supports \(height: 100dvh\)/);
    expect(HTML).toMatch(/--shos-app-height:\s*100dvh/);
  });

  it("the app root uses the variable, not a hardcoded 100vh", () => {
    expect(APP).toMatch(/height: "var\(--shos-app-height, 100vh\)"/);
    expect(APP).not.toMatch(/height: "100vh", overflow: "hidden"/);
  });

  it("the nav stays a flex child with its own safe-area inset", () => {
    // If someone reintroduces position:fixed here the whole dvh fix is
    // bypassed and the original overlap returns.
    const nav = APP.slice(APP.indexOf('<div role="navigation" aria-label="Main navigation"'));
    expect(nav.slice(0, 700)).not.toMatch(/position:\s*"fixed"/);
    expect(nav.slice(0, 700)).toMatch(/env\(safe-area-inset-bottom\)/);
  });
});

// vaultBootFailureGuard.test.js — P0 A2 (wrong-key / locked-vault cold start).
// The code path already exists (bootUnlock failure -> setVaultError -> a real
// "Your data didn't open" screen with retry), but had no regression guard.
// This locks the whole chain: the boot effect must refuse to continue on a
// failed unlock, record the durable error, and show the honest failure screen
// rather than falling back to sample data.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const APP = fs.readFileSync(path.join(process.cwd(), "src/App.jsx"), "utf8");
const CRYPTO = fs.readFileSync(path.join(process.cwd(), "src/storage/cryptoService.js"), "utf8");

describe("vault boot failure is surfaced, never silently sampled", () => {
  it("the boot effect records a durable vault error and stops booting on failure", () => {
    expect(APP).toMatch(/setVaultError\(err\)/);
    expect(APP).toMatch(/setBootFailure\(err\)/);
    expect(APP).toMatch(/refusing to boot on sample data/);
    // The failure state must be checked BEFORE every other render gate.
    const gate = APP.indexOf("if (!bootReady) {");
    expect(gate).toBeGreaterThan(-1);
    expect(APP.indexOf("<AppBootScreen error={bootFailure}", gate)).toBeGreaterThan(gate);
    expect(APP.indexOf("if (decoyActive)", gate)).toBeGreaterThan(APP.indexOf("AppBootScreen error={bootFailure}", gate));
  });

  it("the failure screen says nothing was changed and offers a real retry", () => {
    expect(APP).toMatch(/Your data didn't open/);
    expect(APP).toMatch(/Nothing has been deleted or changed/);
    expect(APP).toMatch(/onRetry && \(/);
    expect(APP).toMatch(/onRetry=\{\(\) => window\.location\.reload\(\)\}/);
  });

  it("cryptoService exposes the durable error setter used by that path", () => {
    expect(CRYPTO).toMatch(/export function setVaultError\(err\)/);
    expect(CRYPTO).toMatch(/pin-needed/);
  });
});

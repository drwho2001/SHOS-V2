import { describe, expect, it } from "vitest";
import { resolveQuickExitPlan } from "./quickExit.js";

describe("resolveQuickExitPlan", () => {
  it("always leaves, never no-ops", () => {
    const plan = resolveQuickExitPlan({ appLockEnabled: false, nativeApp: false });
    expect(plan.leave).toBeTruthy();
  });

  it("locks the vault only when App Lock is enabled", () => {
    expect(resolveQuickExitPlan({ appLockEnabled: true, nativeApp: false }).lockVault).toBe(true);
    expect(resolveQuickExitPlan({ appLockEnabled: false, nativeApp: false }).lockVault).toBe(false);
  });

  it("exits the app on native, goes blank on web", () => {
    expect(resolveQuickExitPlan({ appLockEnabled: false, nativeApp: true }).leave).toBe("exit-app");
    expect(resolveQuickExitPlan({ appLockEnabled: false, nativeApp: false }).leave).toBe("blank-page");
  });

  it("locks and exits together when both apply", () => {
    expect(resolveQuickExitPlan({ appLockEnabled: true, nativeApp: true })).toEqual({
      lockVault: true,
      leave: "exit-app",
    });
  });

  it("defaults to a safe, non-inert plan", () => {
    expect(resolveQuickExitPlan()).toEqual({ lockVault: false, leave: "blank-page" });
  });
});

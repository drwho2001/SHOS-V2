// quickExit.js
// The decision behind the "quick exit" / panic control on Home's header
// (and the module screens that render it). Kept as a pure function so
// the control can never silently do nothing again: the defect that prompted
// this file was App.jsx passing `onQuickExit={() => {}}`, which rendered a
// control that announced "Quick exit", focused, and did nothing.
//
// Semantics:
//   - "leave" is always true: the whole point of the control is to get the
//     user off the sensitive screen immediately. It never resolves to a no-op.
//   - "lockVault" is true only when App Lock is enabled, so returning to the
//     app afterwards asks for the PIN. With no PIN there is nothing to lock.
//   - "exit-app" is the native path (Capacitor's App.exitApp, the same
//     primitive the hardware back button uses); "blank-page" is the web/PWA
//     fallback (about:blank — no third-party request, reversible with Back).

export function resolveQuickExitPlan({ appLockEnabled = false, nativeApp = false } = {}) {
  return {
    lockVault: Boolean(appLockEnabled),
    leave: nativeApp ? "exit-app" : "blank-page",
  };
}

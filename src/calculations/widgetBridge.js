// widgetBridge.js — the ONE way this app resolves its native widget plugin.
//
// WHY THIS FILE EXISTS
// --------------------
// `getWidgetBridge()` was byte-identical in SIX files: medicationReminderSync,
// testingReminderSync, refillReminderSync, clinicVisitReminderSync, doxyPepSync
// and cycleWidgetSync. `cycleWidgetSync.js` carried a comment admitting it:
// "Copied from the other four sync files rather than shared. Each one has its
// own copy, which is not ideal - it is why the thenable-proxy bug below had to
// be fixed in six places and then had to be fixed twice more."
//
// That is the whole argument. This function has been the site of a subtle,
// device-only, silently-swallowed bug more than once, and six copies means six
// chances to fix it in five and miss one. It is now here, once.
//
// THE THENABLE TRAP - do not "simplify" the return value
// -------------------------------------------------------
// A Capacitor plugin proxy is a catch-all Proxy: ANY property access returns a
// function, so `proxy.then` is a function and the proxy looks *thenable*.
// Returning one bare from an async function makes the engine unwrap it by
// invoking `.then()`, which Capacitor rejects as
// "WidgetBridge.then() is not implemented on android". That threw before the
// plugin method was ever reached, so no widget ever updated - verified live on a
// real device, and it is the same shape as the earlier ScreenSecurity fix.
//
// So the plugin is returned WRAPPED as `{ plugin }`, never bare. A caller then
// reads `bridge.plugin.updateX`. capacitorPluginProxyGuard.test.js checks every
// `sendWidgetUpdate` call site's wrapper shape, which is what keeps the
// contract honest now that the resolution lives in one place.
import { registerPlugin } from "@capacitor/core";

let cached = null;

export async function getWidgetBridge() {
  if (cached) return { plugin: cached };
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) {
      cached = false;
      return null;
    }
    cached = registerPlugin("WidgetBridge");
  } catch (e) {
    cached = false; // mark as unavailable, so this is attempted once and no more
  }
  return cached ? { plugin: cached } : null;
}

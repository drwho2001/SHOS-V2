// screenSecurityService.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// The real bridge for Settings > Privacy's "Allow screenshots" toggle.
// Android's own FLAG_SECURE (set unconditionally at app launch, see
// MainActivity.java's own comment) blocks screenshots, screen
// recording, and the recent-apps thumbnail — a real, always-on
// protection by default. This toggle is a deliberate, explicit opt-OUT
// of that default, via the one custom Capacitor plugin this app has
// ever needed (ScreenSecurityPlugin.java) — every other native
// integration here is a third-party npm package with its own generated
// JS wrapper; this one has none, so it's bound by hand via Capacitor's
// own registerPlugin(name), the officially supported way to bind a
// plugin that isn't published as its own package.
//
// Native (Android) only, deliberately: there's no equivalent
// screenshot-blocking mechanism on the web/PWA build in the first
// place (no FLAG_SECURE equivalent exists for a browser tab), so
// there's nothing for this toggle to turn on or off there — the
// Settings UI itself checks isScreenSecurityAvailable() before even
// offering the toggle, same "don't offer a control that can't do
// anything" pattern already used for the custom auto-export-folder
// picker elsewhere in this app.
let ScreenSecurity = null;
let loadAttempted = false;

// Same "never let the raw Capacitor plugin proxy be a promise's
// resolved value" wrapping as every other native-plugin loader in this
// project (see notificationService.js's own getPlugin()) — returning
// the bare proxy directly from an async function makes Promise
// resolution probe its `.then` property, which the proxy treats as a
// real (unimplemented) native call and rejects on.
async function getPlugin() {
  if (loadAttempted) return ScreenSecurity;
  loadAttempted = true;
  try {
    const { Capacitor, registerPlugin } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      ScreenSecurity = registerPlugin("ScreenSecurity");
    }
  } catch {
    console.warn("[screenSecurityService] ScreenSecurity plugin not available in this environment.");
  }
  return ScreenSecurity;
}

export async function isScreenSecurityAvailable() {
  return !!(await getPlugin());
}

// `allowed: true` clears FLAG_SECURE (screenshots/recording permitted);
// `allowed: false` restores it (the app's own default). Returns whether
// the native call actually succeeded — the caller decides whether to
// persist the preference change on a failure (see PrivacyScreen).
export async function setScreenshotsAllowed(allowed) {
  const plugin = await getPlugin();
  if (!plugin) return false;
  try {
    await plugin.setSecure({ secure: !allowed });
    return true;
  } catch (err) {
    console.warn("[screenSecurityService] setSecure failed:", err);
    return false;
  }
}

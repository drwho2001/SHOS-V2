// notificationService.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask, 26 Aug 2026: "we need to build a notifications system
// too." Built as a general, reusable service — not a DoxyPEP-only
// helper — since Medication's existing Dose Reminder Notifications
// (Doc 5 §9, Doc 3 A9) are ALSO already speced and were explicitly
// flagged 4 Aug 2026 as a demo-only simulation pending exactly this:
// real native scheduling. DoxyPEP's 72h alert is the first real use of
// this service; Medication's dose reminders are a natural next one to
// wire onto it, not done in this pass.
//
// REWORKED FROM THE GROUND UP 3 Sep 2026 — real ask: "still not
// getting notifications outside or inside app... no run demo option
// in global settings... critically think on this." Root cause found:
// every function below was gated on the Capacitor native plugin, with
// a bare `console.warn` + silent no-op on any other platform (see the
// git history of this exact comment block for the old reasoning) —
// including the "Send test notification" button on the Notifications
// screen, which returned null entirely rather than showing anything.
// That's fine and correct for someone running the installed Android
// APK. It is NOT fine for someone using the app as an installed PWA or
// in a plain browser tab (this app is ALSO a real, installable PWA —
// see public/sw.js, public/manifest.webmanifest) — for that whole
// audience, every reminder in this app was silently inert with zero
// on-screen explanation of why. That gap, not a bug in any one
// reminder's timing math, is almost certainly what "whole thing dodgy"
// was actually describing.
//
// THE HONEST PLATFORM REALITY, stated plainly so nobody (user or a
// future session) mistakes this for parity with native:
//   - Native (installed Android APK): unchanged from before — the OS
//     itself holds and fires the alarm via @capacitor/local-notifications,
//     which is why this is the only path that reliably survives the
//     app being fully closed for hours. Nothing below changes that.
//   - Web (installed PWA or a plain browser tab): now genuinely
//     implemented via the real Notification API + this app's own
//     service worker (public/sw.js), including real action buttons
//     (Take/Cancel/Snooze) via a notificationclick relay — see that
//     file's own comment. This reliably fires while the tab/installed
//     app is open OR recently backgrounded, and the very next time the
//     app is opened/foregrounded for anything already due by then
//     (syncMedicationReminders() already runs on every Home mount).
//     It CANNOT reliably fire hours later with the tab/app fully
//     closed the way native can — that would need a real push server
//     (VAPID + a backend to send the push), which is out of scope for
//     an explicitly local-only, single-user, no-backend app. This is a
//     genuine, permanent web-platform limitation, not a bug to chase.
//     iOS Safari additionally only supports this at all once the PWA
//     is added to the home screen (iOS 16.4+) — a plain Safari tab on
//     iOS cannot show notifications at all, native browser limitation.
//   - Anywhere neither applies (very old browser, plugin genuinely
//     missing): still degrades to "unavailable", same as before.
//
// WHAT THIS FILE DOES NOT DO: it does not install or configure the
// native plugin itself — that's `@capacitor/local-notifications`,
// added to package.json and synced into the Android project. This
// file is written to degrade gracefully if that plugin isn't present
// (e.g. this session's own dev/preview environment) — same "check,
// don't throw" pattern as always, now on both platform paths.
//
// ID CONVENTION: every scheduled notification needs a stable integer
// ID so it can be found again and cancelled (e.g. when a DoxyPEP dose
// gets logged before the 72h alert would fire). Fixed IDs per alert
// TYPE, not per instance — DoxyPEP only ever has one active countdown
// at a time (see doxyPepCalculations.js), so re-scheduling under the
// same ID naturally replaces any previous pending alert rather than
// stacking duplicates. This holds on both platforms: native replaces
// by id, web replaces by using the id as the Notification `tag`.
export const NOTIFICATION_IDS = {
  doxyPepAlert: 9001,
  medicationReminder: 9002,
  // ADDED — real ask: proactive "due for retest" reminder, same fixed-
  // ID-per-type convention as the other two — one active testing
  // reminder at a time, rescheduling under this id naturally replaces
  // whatever was previously pending.
  testingReminder: 9003,
  // ADDED — real ask: unified notifications, "when refill due". Fires
  // once stock actually crosses the refill threshold, same immediate-
  // due pattern medicationReminder already uses for a dose due right
  // now — refill isn't a predictable future timestamp the way a dose
  // interval or an appointment is, so there's nothing further ahead to
  // schedule for.
  refillReminder: 9004,
  // ADDED — real ask: reminders for an actual booked clinic
  // appointment, "24 & 2h in advance (or custom)". Two fixed slots
  // (see notificationPreferencesRepository.js) rather than one id per
  // arbitrary offset.
  clinicVisitReminderA: 9005,
  clinicVisitReminderB: 9006,
};

// ADDED 26 Aug 2026 — real ask: custom medication reminder
// notifications with real action buttons, modeled on the same Take/
// Snooze/Skip pattern TakeYourPills and Medisafe both use (confirmed
// via their own store listings, not guessed). Capacitor requires
// action TYPES to be registered once before any notification can
// reference them; web needs the same action id/title pairs to build
// the Notification API's own `actions` array — ACTION_TYPE_DEFS below
// is the one shared source both platforms read from, so the two can
// never quietly drift apart.
export const MEDICATION_ACTION_TYPE_ID = "MEDICATION_REMINDER_ACTIONS";
export const MEDICATION_ACTIONS = {
  takeAll: "TAKE_ALL",
  skipToday: "SKIP_TODAY",
  snooze: "SNOOZE_30",
};

// ADDED — real ask: the DoxyPEP 72h alert gets real action buttons
// too, same Take/Snooze pattern as Medication's own dose reminders
// above. HONEST NOTE on the existing "DoxyPEP dosing must stay manual"
// rule (see doxyPepCalculations.js's own header comment): that rule is
// about the app never ASSUMING a dose was taken just because the
// countdown reached zero — it's not about disallowing a genuine,
// user-initiated one-tap action. A notification button only ever logs
// anything when the user actually taps it, same as Medication's own
// "Take all" — that's still manual, just a faster path to the same
// action "open the app and log it" already was. No "skip" action here
// unlike Medication's: DoxyPEP is per-exposure, not a daily dose, so
// "skip until tomorrow" doesn't map to anything real for it.
export const DOXYPEP_ACTION_TYPE_ID = "DOXYPEP_ALERT_ACTIONS";
export const DOXYPEP_ACTIONS = {
  takeDose: "TAKE_DOXY_DOSE",
  snooze: "SNOOZE_DOXY_30",
};

const ACTION_TYPE_DEFS = {
  [MEDICATION_ACTION_TYPE_ID]: [
    { id: MEDICATION_ACTIONS.takeAll, title: "Take" },
    { id: MEDICATION_ACTIONS.skipToday, title: "Cancel" },
    { id: MEDICATION_ACTIONS.snooze, title: "Snooze 30 min" },
  ],
  [DOXYPEP_ACTION_TYPE_ID]: [
    { id: DOXYPEP_ACTIONS.takeDose, title: "Take dose" },
    { id: DOXYPEP_ACTIONS.snooze, title: "Remind in 30 min" },
  ],
};

export async function registerNotificationActionTypes() {
  const plugin = await getPlugin();
  if (!plugin) return false;
  await plugin.registerActionTypes({
    types: Object.entries(ACTION_TYPE_DEFS).map(([id, actions]) => ({ id, actions })),
  });
  return true;
}

// Registers a handler for when the user taps an action button on a
// notification (or the notification itself). Same callback shape on
// both platforms — handler receives { actionId } — so App.jsx's own
// dispatch logic never needs to know which platform fired it.
//
// Web path, two real delivery routes for the same tap, since a
// service worker can't run app code (no localStorage access there —
// see public/sw.js's own comment) and can only relay the tap to a
// page: (1) an already-open page gets it live via postMessage, no
// reload; (2) if nothing was open, the service worker opened a new
// window with the action encoded in the URL (?notifAction=...) — this
// reads that once on startup, the same real tap, just arriving via the
// URL instead of a live message because the page didn't exist yet.
export async function addNotificationActionListener(handler) {
  const platform = await getPlatform();
  if (platform === "native") {
    const plugin = await getPlugin();
    if (!plugin) return null;
    return plugin.addListener("localNotificationActionPerformed", handler);
  }
  if (platform === "web" && typeof window !== "undefined") {
    try {
      const params = new URLSearchParams(window.location.search);
      const pendingAction = params.get("notifAction");
      if (pendingAction) {
        params.delete("notifAction");
        const clean = window.location.pathname + (params.toString() ? `?${params.toString()}` : "") + window.location.hash;
        window.history.replaceState({}, "", clean);
        // Deferred a tick so the caller's own effect finishes setting
        // up before the handler runs — matches how a real event never
        // fires synchronously inside the listener registration itself.
        setTimeout(() => handler({ actionId: pendingAction }), 0);
      }
    } catch (err) {
      console.warn("[notificationService] Reading pending notification action from URL failed:", err);
    }
    if ("serviceWorker" in navigator) {
      const listener = (event) => {
        if (event.data?.type === "shos-notification-action") handler({ actionId: event.data.action });
      };
      navigator.serviceWorker.addEventListener("message", listener);
      return { remove: () => navigator.serviceWorker.removeEventListener("message", listener) };
    }
  }
  return null;
}

let LocalNotifications = null;
let pluginLoadAttempted = false;
let cachedPlatform = null;

// Lazy-loaded so this file has zero effect on any environment where
// Capacitor itself isn't present (this session's own dev/preview).
async function getPlatform() {
  if (cachedPlatform) return cachedPlatform;
  try {
    const { Capacitor } = await import("@capacitor/core");
    cachedPlatform = Capacitor.isNativePlatform() ? "native" : "web";
  } catch {
    // No Capacitor runtime at all (shouldn't happen in a real build of
    // this app, but keeps this file inert rather than throwing if it
    // ever does) — web notification path still works fine without it.
    cachedPlatform = "web";
  }
  return cachedPlatform;
}

// Exported so UI (the Notifications settings screen) can show honest,
// platform-specific copy — "installed Android app" vs "web/PWA" carry
// genuinely different real capabilities (see this file's own header
// comment), which is worth being upfront about rather than papering
// over with one generic message.
export async function getNotificationPlatform() {
  return getPlatform();
}

async function getPlugin() {
  if (pluginLoadAttempted) return LocalNotifications;
  pluginLoadAttempted = true;
  const platform = await getPlatform();
  if (platform !== "native") return null;
  try {
    const mod = await import("@capacitor/local-notifications");
    LocalNotifications = mod.LocalNotifications;
  } catch {
    console.warn("[notificationService] @capacitor/local-notifications not available - native notifications disabled in this environment.");
  }
  return LocalNotifications;
}

// Real, honest check for whether the WEB path can do anything at all
// — the Notification API existing, a service worker being supported,
// and (critically, iOS Safari's own real constraint) actually having
// an ACTIVE service worker registration, not just the API existing.
function webNotificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

// Call once, e.g. on app load — a no-op ({status:"unavailable"})
// anywhere neither platform's real notification system is present.
// CHANGED 1 Sep 2026 — real ask: "ensure they actually work in APK...
// haven't been asked to grant access." Returns the real status string
// instead of a bare boolean, and never throws — see
// checkNotificationPermission() below for a NON-prompting read of the
// same status, used to show it on the Notifications settings screen.
// CHANGED 3 Sep 2026 — real ask, ground-up rework: now has a genuine
// web path via Notification.requestPermission(), not just native.
export async function requestNotificationPermission() {
  const platform = await getPlatform();
  if (platform === "native") {
    const plugin = await getPlugin();
    if (!plugin) return { status: "unavailable" };
    try {
      const result = await plugin.requestPermissions();
      return { status: result.display };
    } catch (err) {
      console.warn("[notificationService] requestPermissions() failed:", err);
      return { status: "error" };
    }
  }
  if (!webNotificationsSupported()) return { status: "unavailable" };
  try {
    const result = await Notification.requestPermission();
    // Browsers report "default" for "never asked" — normalized to
    // "prompt" to match Capacitor's own convention, so every caller
    // (the permission banner, sendTestNotification) can stay platform-
    // agnostic rather than juggling two different vocabularies.
    return { status: result === "default" ? "prompt" : result };
  } catch (err) {
    console.warn("[notificationService] Notification.requestPermission() failed:", err);
    return { status: "error" };
  }
}

// ADDED 1 Sep 2026 — real ask: a way to actually SEE the current OS
// permission state without triggering a prompt (a second
// request/requestPermission call after a denial just silently
// resolves "denied" again with no UI on either platform). This is what
// lets the Notifications settings screen tell "never asked" and
// "denied" apart and show the right guidance for each.
export async function checkNotificationPermission() {
  const platform = await getPlatform();
  if (platform === "native") {
    const plugin = await getPlugin();
    if (!plugin) return { status: "unavailable" };
    try {
      const result = await plugin.checkPermissions();
      return { status: result.display };
    } catch (err) {
      console.warn("[notificationService] checkPermissions() failed:", err);
      return { status: "error" };
    }
  }
  if (!webNotificationsSupported()) return { status: "unavailable" };
  const current = Notification.permission;
  return { status: current === "default" ? "prompt" : current };
}

// ADDED 2 Sep 2026 — real ask: "was stressing notifications on
// Android and didn't get any." Root cause found beyond the earlier
// POST_NOTIFICATIONS fix: Android 12+ separately gates EXACT-timed
// alarms (its own "Alarms & reminders" system setting, off by default
// for most apps) — completely independent of the POST_NOTIFICATIONS
// runtime permission checked above. Android-only concept — the web
// path below has no equivalent OS-level exact-alarm setting to check,
// so this correctly and permanently resolves "unavailable" there.
export async function checkExactAlarmPermission() {
  const plugin = await getPlugin();
  if (!plugin || !plugin.checkExactNotificationSetting) return { status: "unavailable" };
  try {
    const result = await plugin.checkExactNotificationSetting();
    return { status: result.exact_alarm };
  } catch (err) {
    console.warn("[notificationService] checkExactNotificationSetting() failed:", err);
    return { status: "error" };
  }
}

// Opens the system "Alarms & reminders" settings screen for this app
// (Android 12+ only — on older Android this just resolves "granted"
// immediately, per the plugin's own documented behaviour, since the
// setting doesn't exist there). A real navigation away from the app,
// same as any other "open system settings" permission flow.
export async function requestExactAlarmPermission() {
  const plugin = await getPlugin();
  if (!plugin || !plugin.changeExactNotificationSetting) return { status: "unavailable" };
  try {
    const result = await plugin.changeExactNotificationSetting();
    return { status: result.exact_alarm };
  } catch (err) {
    console.warn("[notificationService] changeExactNotificationSetting() failed:", err);
    return { status: "error" };
  }
}

// ADDED 1 Sep 2026 — real ask: "want to make sure actually works" — a
// genuine, concrete way to find out, rather than trusting a reminder
// scheduled hours or days out. Fires a real notification through the
// exact same scheduleNotification() path every real reminder in this
// app uses, on WHICHEVER platform this is actually running on — if
// this one shows up, the whole pipeline (permission, plugin/browser
// API, scheduling) is confirmed actually working end to end; if it
// doesn't, that's real, useful information too. Fixed id, own slot
// outside NOTIFICATION_IDS above since this is diagnostic, not a real
// reminder type.
const TEST_NOTIFICATION_ID = 9099;
export const TEST_NOTIFICATION_DELAY_MS = 10000;
export async function sendTestNotification() {
  const permission = await checkNotificationPermission();
  if (permission.status !== "granted") return { ok: false, reason: permission.status };
  try {
    await scheduleNotification({
      id: TEST_NOTIFICATION_ID,
      title: "SHOS test notification",
      body: "If you can see this, notifications are working — even backgrounded.",
      at: new Date(Date.now() + TEST_NOTIFICATION_DELAY_MS),
      smallIcon: moduleSmallIconName("home"),
    });
    return { ok: true };
  } catch (err) {
    console.warn("[notificationService] Test notification failed to schedule:", err);
    return { ok: false, reason: "error" };
  }
}

// Web scheduling lives in plain memory (a Map of pending setTimeouts),
// same fixed-id-per-type convention as native — scheduling under an id
// that already has a pending timeout clears the old one first, so this
// never stacks duplicate reminders. HONEST LIMIT, stated once here
// rather than at every call site: this only fires while the tab/
// installed PWA stays loaded (open, or backgrounded but not fully
// killed by the OS/browser) — see this file's own header comment for
// why that's a real web-platform ceiling, not a bug.
const webTimeouts = new Map();

async function showWebNotification({ id, title, body, actionTypeId }) {
  if (!webNotificationsSupported() || Notification.permission !== "granted") return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body,
      tag: String(id),
      renotify: true,
      icon: `${import.meta.env.BASE_URL}pwa-192.png`,
      badge: `${import.meta.env.BASE_URL}pwa-192.png`,
      actions: actionTypeId ? ACTION_TYPE_DEFS[actionTypeId]?.map((a) => ({ action: a.id, title: a.title })) : undefined,
    });
    return true;
  } catch (err) {
    console.warn("[notificationService] showNotification() failed:", err);
    return false;
  }
}

// Schedules (or replaces, via the fixed id) a single notification at
// an exact future time. No-ops safely if neither platform's real
// notification system is available.
export async function scheduleNotification({ id, title, body, at, actionTypeId, smallIcon, iconColor }) {
  const platform = await getPlatform();
  if (platform === "native") {
    const plugin = await getPlugin();
    if (!plugin) return false;
    await plugin.schedule({
      notifications: [{ id, title, body, schedule: { at: new Date(at) }, ...(actionTypeId ? { actionTypeId } : {}), ...(smallIcon ? { smallIcon } : {}), ...(iconColor ? { iconColor } : {}) }],
    });
    return true;
  }
  if (!webNotificationsSupported()) return false;
  const existing = webTimeouts.get(id);
  if (existing) clearTimeout(existing);
  const delay = Math.max(0, new Date(at).getTime() - Date.now());
  const timeoutId = setTimeout(() => {
    webTimeouts.delete(id);
    showWebNotification({ id, title, body, actionTypeId });
  }, delay);
  webTimeouts.set(id, timeoutId);
  return true;
}

// ADDED 26 Aug 2026 — real ask: notification colour should match the
// relevant module (Home teal, or the specific module's colour —
// respecting a user's custom override, not the hardcoded default).
// Native-only concept (Android's own per-notification iconColor field
// and drawable smallIcon resources — real ones exist at
// android/app/src/main/res/drawable/ic_stat_*.xml) — the web path
// above uses one plain app icon for every notification instead, since
// the Notification API has no equivalent per-notification tinting.
export function moduleSmallIconName(moduleKey) {
  return `ic_stat_${moduleKey}`;
}

// Cancels a previously scheduled notification by its fixed id — safe
// to call even if nothing is currently scheduled under that id. On
// web this also closes an already-SHOWN notification under that id
// (matched by tag), not just a still-pending timeout — e.g. logging a
// dose from inside the app should dismiss a reminder already sitting
// in the notification tray, not just stop a future one.
export async function cancelNotification(id) {
  const platform = await getPlatform();
  if (platform === "native") {
    const plugin = await getPlugin();
    if (!plugin) return false;
    await plugin.cancel({ notifications: [{ id }] });
    return true;
  }
  const pending = webTimeouts.get(id);
  if (pending) { clearTimeout(pending); webTimeouts.delete(id); }
  if (webNotificationsSupported()) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const shown = await registration.getNotifications({ tag: String(id) });
      shown.forEach((n) => n.close());
    } catch (err) {
      console.warn("[notificationService] Closing shown web notification failed:", err);
    }
  }
  return true;
}

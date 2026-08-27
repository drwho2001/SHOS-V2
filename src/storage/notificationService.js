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
// WHY THIS NEEDS A NATIVE PLUGIN, stated plainly: a notification that
// fires even when the app is fully closed needs the OS itself to hold
// and fire it — nothing running only inside the app's own JavaScript
// (a setTimeout, a service worker) survives the app being closed on
// Android reliably. @capacitor/local-notifications schedules through
// Android's real OS-level alarm/notification system, which is why
// this genuinely needed the Capacitor/APK work finished 26 Aug 2026
// first — the earlier 4 Aug 2026 platform-constraint flag ("PWA has a
// known-unreliable history here") no longer applies now that this is
// a real Capacitor Android app, not a PWA.
//
// WHAT THIS FILE DOES NOT DO: it does not install or configure the
// native plugin itself — that's `@capacitor/local-notifications`,
// added to package.json and synced into the Android project, which
// needs to happen against the real repo (see the Claude Code task
// drafted alongside this file). This file is written to degrade
// gracefully if that plugin isn't present yet (e.g. running in a
// browser/StackBlitz preview) — it checks for the plugin and no-ops
// with a console warning rather than throwing, so nothing else in the
// app breaks while the native piece is still being set up.
//
// ID CONVENTION: every scheduled notification needs a stable integer
// ID so it can be found again and cancelled (e.g. when a DoxyPEP dose
// gets logged before the 72h alert would fire). Fixed IDs per alert
// TYPE, not per instance — DoxyPEP only ever has one active countdown
// at a time (see doxyPepCalculations.js), so re-scheduling under the
// same ID naturally replaces any previous pending alert rather than
// stacking duplicates.
export const NOTIFICATION_IDS = {
  doxyPepAlert: 9001,
  medicationReminder: 9002,
};

// ADDED 26 Aug 2026 — real ask: custom medication reminder
// notifications with real action buttons, modeled on the same Take/
// Snooze/Skip pattern TakeYourPills and Medisafe both use (confirmed
// via their own store listings, not guessed). Capacitor requires
// action TYPES to be registered once before any notification can
// reference them — this is that registration, called once on app
// start alongside requestNotificationPermission().
export const MEDICATION_ACTION_TYPE_ID = "MEDICATION_REMINDER_ACTIONS";
export const MEDICATION_ACTIONS = {
  takeAll: "TAKE_ALL",
  skipToday: "SKIP_TODAY",
  snooze: "SNOOZE_30",
};

export async function registerNotificationActionTypes() {
  const plugin = await getPlugin();
  if (!plugin) return false;
  await plugin.registerActionTypes({
    types: [{
      id: MEDICATION_ACTION_TYPE_ID,
      actions: [
        { id: MEDICATION_ACTIONS.takeAll, title: "Take all" },
        { id: MEDICATION_ACTIONS.snooze, title: "Remind in 30 min" },
        { id: MEDICATION_ACTIONS.skipToday, title: "Skip until tomorrow" },
      ],
    }],
  });
  return true;
}

// Registers a handler for when the user taps an action button on a
// notification (or the notification itself). No-ops gracefully if the
// plugin isn't available, same pattern as everything else here.
export async function addNotificationActionListener(handler) {
  const plugin = await getPlugin();
  if (!plugin) return null;
  return plugin.addListener("localNotificationActionPerformed", handler);
}

let LocalNotifications = null;
let pluginLoadAttempted = false;

// Lazy-loaded so this file has zero effect on any environment where
// the plugin isn't installed yet (Claude's own preview, a plain
// browser tab, StackBlitz before the native piece lands).
async function getPlugin() {
  if (pluginLoadAttempted) return LocalNotifications;
  pluginLoadAttempted = true;
  try {
    const mod = await import("@capacitor/local-notifications");
    LocalNotifications = mod.LocalNotifications;
  } catch {
    console.warn("[notificationService] @capacitor/local-notifications not available — notifications will not fire natively in this environment.");
  }
  return LocalNotifications;
}

// Call once, e.g. on app load — a no-op (resolves false) anywhere the
// plugin isn't present.
export async function requestNotificationPermission() {
  const plugin = await getPlugin();
  if (!plugin) return false;
  const result = await plugin.requestPermissions();
  return result.display === "granted";
}

// Schedules (or replaces, via the fixed id) a single local
// notification at an exact future time. No-ops safely if the plugin
// isn't available.
export async function scheduleNotification({ id, title, body, at, actionTypeId, smallIcon }) {
  const plugin = await getPlugin();
  if (!plugin) return false;
  await plugin.schedule({
    notifications: [{ id, title, body, schedule: { at: new Date(at) }, ...(actionTypeId ? { actionTypeId } : {}), ...(smallIcon ? { smallIcon } : {}) }],
  });
  return true;
}

// ADDED 26 Aug 2026 — real ask: notification colour should match the
// relevant module (Home teal, or the specific module's colour —
// respecting a user's custom override, not the hardcoded default).
// HONEST LIMIT, verified via Capacitor's real docs, not assumed:
// iconColor is a single GLOBAL Android setting in
// capacitor.config.json, set once at build time — there is no
// per-notification colour parameter in the schedule() API. The only
// way to get genuinely different colours per notification TYPE is
// separate pre-made drawable icon assets (real image files in the
// Android project, one per colour), referenced via each
// notification's own smallIcon field, which — unlike iconColor — IS
// settable per-notification. This function is wired to accept and
// pass through a smallIcon name for exactly that reason, so it's
// ready the moment those assets exist. Not yet built: the actual
// colored drawable files themselves (native asset creation, needs
// Claude Code against the real Android project) and confirmation of
// which module each notification type maps to.
export function moduleSmallIconName(moduleKey) {
  // "ic_stat_" + module key is the intended real Android drawable
  // resource naming convention, matching Capacitor's own
  // smallIcon example ("ic_stat_icon_config_sample") — the actual
  // files don't exist in the Android project yet.
  return `ic_stat_${moduleKey}`;
}

// Cancels a previously scheduled notification by its fixed id — safe
// to call even if nothing is currently scheduled under that id.
export async function cancelNotification(id) {
  const plugin = await getPlugin();
  if (!plugin) return false;
  await plugin.cancel({ notifications: [{ id }] });
  return true;
}

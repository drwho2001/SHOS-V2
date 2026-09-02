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
// reference them — this is that registration, called once on app
// start alongside requestNotificationPermission().
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

export async function registerNotificationActionTypes() {
  const plugin = await getPlugin();
  if (!plugin) return false;
  await plugin.registerActionTypes({
    types: [
      {
        id: MEDICATION_ACTION_TYPE_ID,
        actions: [
          { id: MEDICATION_ACTIONS.takeAll, title: "Take all" },
          { id: MEDICATION_ACTIONS.snooze, title: "Remind in 30 min" },
          { id: MEDICATION_ACTIONS.skipToday, title: "Skip until tomorrow" },
        ],
      },
      {
        id: DOXYPEP_ACTION_TYPE_ID,
        actions: [
          { id: DOXYPEP_ACTIONS.takeDose, title: "Take dose" },
          { id: DOXYPEP_ACTIONS.snooze, title: "Remind in 30 min" },
        ],
      },
    ],
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
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) {
      console.warn("[notificationService] Web environment detected - native local notifications disabled.");
      return null;
    }
    const mod = await import("@capacitor/local-notifications");
    LocalNotifications = mod.LocalNotifications;
  } catch {
    console.warn("[notificationService] @capacitor/local-notifications not available - notifications will not fire natively in this environment.");
  }
  return LocalNotifications;
}

// Call once, e.g. on app load — a no-op (resolves false) anywhere the
// plugin isn't present.
// CHANGED 1 Sep 2026 — real ask: "ensure they actually work in APK...
// haven't been asked to grant access." This call already existed and
// was already wired into Home's mount effect, but nothing ever
// surfaced whether it actually succeeded — a silently swallowed
// exception here (no try/catch existed) would look identical to "the
// user was never shown a system prompt" from the outside, with zero
// way to tell the difference. Now returns the real status string
// (Capacitor's own "granted"/"denied"/"prompt"/"prompt-with-rationale")
// instead of a bare boolean, and never throws — see
// checkNotificationPermission() below for a NON-prompting read of the
// same status, used to show it on the Notifications settings screen.
export async function requestNotificationPermission() {
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

// ADDED 1 Sep 2026 — real ask: a way to actually SEE the current OS
// permission state without triggering a prompt (Android only shows
// the system dialog once per app install for a given permission — a
// second requestPermissions() call after a denial just silently
// resolves "denied" again with no UI, which looks identical to "never
// asked" from inside the app). This is what lets the Notifications
// settings screen tell those two states apart and show the right
// guidance for each.
export async function checkNotificationPermission() {
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

// ADDED 2 Sep 2026 — real ask: "was stressing notifications on
// Android and didn't get any." Root cause found beyond the earlier
// POST_NOTIFICATIONS fix: Android 12+ separately gates EXACT-timed
// alarms (its own "Alarms & reminders" system setting, off by default
// for most apps) — completely independent of the POST_NOTIFICATIONS
// runtime permission checked above. Every real scheduleNotification()
// call in this app (medication due-now/due-soon, DoxyPEP's 72h alert,
// testing/refill/clinic-visit reminders) defaults to
// isExactNotification: true, per @capacitor/local-notifications 8.x's
// own default — without this OS setting granted, the plugin silently
// falls back to an INEXACT alarm instead of failing loudly, which
// Android can defer by minutes to hours depending on battery state.
// That's a real, previously-unhandled way for "the app scheduled it
// successfully" and "nothing arrived when expected" to both be true
// at once. checkExactNotificationSetting()/changeExactNotificationSetting()
// are real, Android-only methods this plugin version already exposes
// (confirmed directly against its own type definitions, not guessed)
// — this just wires them in. No-ops safely everywhere else (web,
// iOS, plugin unavailable).
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
// scheduled hours or days out. Fires a real local notification through
// the exact same scheduleNotification() path every real reminder in
// this app uses — if this one shows up, the whole pipeline
// (permission, plugin, OS scheduling) is confirmed actually working
// end to end; if it doesn't, that's real, useful information too.
// Fixed id, own slot outside NOTIFICATION_IDS above since this is
// diagnostic, not a real reminder type.
// CHANGED 2 Sep 2026 — real ask: "run in 10 seconds/close and run" —
// the actual point of this test is confirming a notification survives
// the app being fully closed (a setTimeout inside a running app would
// never prove that, only the OS-level alarm does), which means the
// delay needs enough real time to tap the button, background or
// fully close the app, and wait — 5s often wasn't enough to do that
// before it fired. 10s now.
const TEST_NOTIFICATION_ID = 9099;
export const TEST_NOTIFICATION_DELAY_MS = 10000;
export async function sendTestNotification() {
  const plugin = await getPlugin();
  if (!plugin) return { ok: false, reason: "unavailable" };
  const permission = await checkNotificationPermission();
  if (permission.status !== "granted") return { ok: false, reason: permission.status };
  try {
    await scheduleNotification({
      id: TEST_NOTIFICATION_ID,
      title: "SHOS test notification",
      body: "If you can see this, notifications are working on this device — even closed.",
      at: new Date(Date.now() + TEST_NOTIFICATION_DELAY_MS),
      smallIcon: moduleSmallIconName("home"),
    });
    return { ok: true };
  } catch (err) {
    console.warn("[notificationService] Test notification failed to schedule:", err);
    return { ok: false, reason: "error" };
  }
}

// Schedules (or replaces, via the fixed id) a single local
// notification at an exact future time. No-ops safely if the plugin
// isn't available.
export async function scheduleNotification({ id, title, body, at, actionTypeId, smallIcon, iconColor }) {
  const plugin = await getPlugin();
  if (!plugin) return false;
  await plugin.schedule({
    notifications: [{ id, title, body, schedule: { at: new Date(at) }, ...(actionTypeId ? { actionTypeId } : {}), ...(smallIcon ? { smallIcon } : {}), ...(iconColor ? { iconColor } : {}) }],
  });
  return true;
}

// ADDED 26 Aug 2026 — real ask: notification colour should match the
// relevant module (Home teal, or the specific module's colour —
// respecting a user's custom override, not the hardcoded default).
// CORRECTED — the original note here claimed iconColor was a single
// GLOBAL Android setting with no per-notification equivalent. Re-
// checked directly against @capacitor/local-notifications 8.x's own
// type definitions while building real per-module notification icons:
// LocalNotificationSchema DOES carry its own per-notification
// `iconColor` field (distinct from the global capacitor.config.json
// default) — that was simply missed before. scheduleNotification()
// now accepts and passes it through; every sync file (doxyPepSync.js,
// medicationReminderSync.js, testingReminderSync.js,
// refillReminderSync.js, clinicVisitReminderSync.js) passes its own
// module's real ACCENTS colour.
//
// smallIcon is now ALSO real, not just wired-and-waiting: real vector
// drawables exist at android/app/src/main/res/drawable/ic_stat_home.xml,
// ic_stat_medication.xml, and ic_stat_healthcare.xml — the three
// module keys actually referenced below. This matters beyond looks:
// passing a smallIcon resource NAME that doesn't correspond to a real
// drawable is a genuine Android crash risk (a missing icon resource
// can throw "Invalid notification: no valid small icon" once that
// notification actually fires) — previously true of every module key
// this function had ever been called with, simply never yet hit
// because none of the scheduled notifications had fired on a real
// device during testing.
export function moduleSmallIconName(moduleKey) {
  // "ic_stat_" + module key — matches the real drawable filenames
  // above exactly (Capacitor's own smallIcon convention: the drawable
  // resource ID, filename without extension).
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

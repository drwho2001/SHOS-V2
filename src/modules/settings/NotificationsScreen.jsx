// NotificationsScreen — extracted verbatim from src/modules/SHOS_Settings_Prototype.jsx
// (24 Sep 2026 settings split). Behavior unchanged; only the file moved.
import React, { useState, useEffect } from "react";
import { NEUTRAL_DARK as DARK } from "../../calculations/designTokens";
import { CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight, DownloadSimpleIcon as Download } from "@phosphor-icons/react";
import { ACCENTS, ACTION, NEUTRAL, RADIUS, TYPE } from "../../calculations/designTokens";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useLoadedMemo } from "../../calculations/loadedRepositoryState";
import { useIsDesktopWidth } from "../../calculations/responsive";
import { NotificationPreferencesRepository, DEFAULT_NOTIFICATION_PREFERENCES, isPaused } from "../../repositories/notificationPreferencesRepository";
import { getDeferredInstallPrompt, onInstallPromptAvailable, triggerInstallPrompt } from "../../storage/installPromptService";
import { MedicationPreferencesRepository, DEFAULT_MEDICATION_PREFERENCES } from "../../repositories/medicationPreferencesRepository";
import { syncDoxyPepAlert } from "../../calculations/doxyPepSync";
import { checkNotificationPermission, requestNotificationPermission, sendTestNotification, TEST_NOTIFICATION_DELAY_MS, checkExactAlarmPermission, requestExactAlarmPermission, getNotificationPlatform, isIOS, isStandalone, checkNativeBridgeHealth } from "../../storage/notificationService";
import { syncMedicationReminders } from "../../calculations/medicationReminderSync";
import { syncTestingReminder } from "../../calculations/testingReminderSync";
import { syncRefillReminder } from "../../calculations/refillReminderSync";
import { syncClinicVisitReminders } from "../../calculations/clinicVisitReminderSync";
import { syncVaccinationReminders } from "../../calculations/vaccinationReminderSync";
import NotificationHistoryScreen from "./NotificationHistoryScreen";

function NotificationToggleRow({ label, description, enabled, onToggle, darkMode, children, bare }) {
  return (
    <div style={bare ? {} : { background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, padding: 16, marginBottom: 12 }}>
      <div role="switch" aria-checked={enabled} aria-label={label} tabIndex={0}
        onClick={onToggle} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
        <div style={{ flex: 1, paddingRight: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>{label}</div>
          <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginTop: 2 }}>{description}</div>
        </div>
        <div style={{ width: 40, height: 24, borderRadius: 999, background: enabled ? ACCENTS.home : (darkMode ? DARK.border : NEUTRAL.border), position: "relative", flexShrink: 0 }}>
          <div style={{ position: "absolute", top: 2, left: enabled ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: "#FFFFFF" }} />
        </div>
      </div>
      {enabled && children}
    </div>
  );
}

// ADDED 1 Sep 2026 — real ask: "ensure they actually work in APK...
// haven't been asked to grant access." Every toggle below silently
// assumed Android had actually granted notification permission — there
// was no way from inside the app to tell "permission granted, just no
// reminder due yet" apart from "permission was never granted at all,
// so nothing will ever fire no matter what's toggled on". This banner
// makes that real OS-level state visible and actionable: shows the
// current status, offers the one-time system prompt while it's still
// available (Android only shows it once per install), and — once
// permission genuinely IS granted — a real test notification a few
// seconds out, so "does this actually work on my phone" has a
// concrete, immediate answer instead of waiting hours for a real
// reminder to (maybe) show up.
// REWORKED 3 Sep 2026 — real ask: "still not getting notifications...
// no run demo option in global settings... critically think on this."
// This banner used to hard-return null for `status === "unavailable"`
// — which is exactly what every non-native environment resolved to
// BEFORE notificationService.js's own ground-up rework (see its header
// comment), including the web/PWA build. That's the real reason the
// test button and every bit of guidance below was invisible: not a
// bug in the banner itself, a real capability gap one layer down that
// this banner had no way to know wasn't there yet. Now that the web
// path is real, this renders on both platforms, with honestly
// different copy for each — Android's exact-alarm section stays
// native-only (see checkExactAlarmPermission's own comment — there is
// no web equivalent), and a platform note explains web's real,
// permanent ceiling (works while the tab/installed app stays open or
// recently backgrounded; can't survive being fully closed for hours
// the way the native Android app can) rather than implying parity.
function NotificationPermissionBanner({ darkMode }) {
  const [status, setStatus] = useState(null);
  const [platform, setPlatform] = useState(null);
  const [testState, setTestState] = useState(null);
  // ADDED 2 Sep 2026 — real ask: "didn't get any [notifications]" —
  // a real, separate gap beyond the POST_NOTIFICATIONS permission
  // above: Android 12+'s own "Alarms & reminders" setting, which
  // every reminder this app schedules relies on for exact timing (see
  // notificationService.js's own comment on checkExactAlarmPermission
  // for the full reasoning). "unavailable" covers "not on Android",
  // "Android < 12" (the setting doesn't exist there), AND the web
  // platform (no equivalent OS concept at all) — same as basic
  // permission status, this only ever shows real detected state.
  const [exactAlarmStatus, setExactAlarmStatus] = useState(null);
  // ADDED — real ask: "notifications allowed, install SHOS for
  // reliable reminders — neither appear on app... pure android." A
  // status of "error" alone didn't say WHICH native call actually
  // failed — not useful for a real report from a user with no adb/USB
  // debugging access. notificationService.js's own checks now return
  // this raw detail string (e.g. "checkPermissions() timed out after
  // 8000ms") straight from the failure; shown on-screen below so it
  // can be read and relayed without any dev tools at all.
  const [statusDetail, setStatusDetail] = useState(null);
  const [exactAlarmDetail, setExactAlarmDetail] = useState(null);
  // ADDED — real ask: isolate whether a stuck native check is bridge-
  // wide (every plugin affected) or specific to LocalNotifications —
  // see checkNativeBridgeHealth()'s own comment. Only run this extra
  // native round-trip once the permission check has actually failed —
  // no reason to spend it on the normal working path.
  const [bridgeHealth, setBridgeHealth] = useState(null);

  useEffect(() => {
    checkNotificationPermission().then((r) => { setStatus(r.status); setStatusDetail(r.detail || null); });
    checkExactAlarmPermission().then((r) => { setExactAlarmStatus(r.status); setExactAlarmDetail(r.detail || null); });
    getNotificationPlatform().then(setPlatform);
  }, []);

  useEffect(() => {
    if (status === "error") checkNativeBridgeHealth().then(setBridgeHealth);
  }, [status]);

  const request = async () => {
    const r = await requestNotificationPermission();
    setStatus(r.status);
    setStatusDetail(r.detail || null);
  };
  const requestExactAlarm = async () => {
    const r = await requestExactAlarmPermission();
    setExactAlarmStatus(r.status);
    setExactAlarmDetail(r.detail || null);
  };
  const runTest = async () => {
    setTestState("sending");
    const r = await sendTestNotification();
    setTestState(r.ok ? "sent" : `failed:${r.reason}`);
  };

  if (status === null || platform === null) return null; // still checking, avoid a flash of the wrong state
  const isNative = platform === "native";

  // ADDED 3 Sep 2026 — real ask: "any missing or unconsidered
  // notification... UI" — a real gap found in that audit. This used to
  // show identical generic web copy to an iPhone user as to desktop/
  // Android Chrome. iOS Safari has a materially different real
  // requirement (confirmed via isIOS()/isStandalone()'s own comments
  // in notificationService.js): notifications cannot work AT ALL in a
  // plain browser tab there, even on 16.4+, until the page is added to
  // the Home Screen and opened from that icon — no permission prompt,
  // no toggle, nothing below would do anything until that's done
  // first. Takes priority over the normal granted/denied/prompt states
  // (whatever `status` naturally resolves to on a non-standalone iOS
  // tab is unreliable/misleading — often reads "denied" immediately,
  // which would wrongly imply the user blocked something).
  if (!isNative && isIOS() && !isStandalone()) {
    return (
      <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: `1px solid ${ACTION.red}`, borderRadius: RADIUS.md, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: ACTION.red, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Notifications need SHOS added to your Home Screen</span>
        </div>
        <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>
          iOS Safari can't show notifications from a page opened in a regular browser tab, no matter what's allowed here. Tap the Share icon, choose <strong>Add to Home Screen</strong>, then open SHOS from that new icon instead of Safari — this banner will offer the real permission prompt once you do.
        </div>
      </div>
    );
  }

  if (status === "unavailable") {
    // Genuinely neither platform's real notification system exists
    // here (very old browser, or Capacitor itself missing) — rare, and
    // there is truly nothing actionable to offer.
    return (
      <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: `1px solid ${darkMode ? DARK.border : NEUTRAL.border}`, borderRadius: RADIUS.md, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>
          Notifications aren't available in this environment (no notification support detected on this browser/device).
        </div>
      </div>
    );
  }

  const isGranted = status === "granted";
  const isDenied = status === "denied";
  // ADDED — real ask: distinguish a genuine native-call failure (a
  // hung/rejected bridge call — see notificationService.js's own
  // withTimeout comment) from "never asked yet". Previously both fell
  // into the same generic "hasn't asked yet, tap below" copy, which
  // would be actively misleading here — tapping "Allow notifications"
  // again just re-triggers the same failing call.
  const isError = status === "error";
  return (
    <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: `1px solid ${isGranted ? ACTION.green : ACTION.red}`, borderRadius: RADIUS.md, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: isGranted ? ACTION.green : ACTION.red, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>
          {isGranted ? "Notifications are allowed" : isDenied ? "Notifications are blocked" : isError ? "Couldn't check notification status" : "Notifications not yet allowed"}
        </span>
      </div>
      {isError && (
        <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 8 }}>
          The check itself failed rather than returning a real answer — this is worth reporting as a bug.
          {statusDetail && (
            <div style={{ marginTop: 6, padding: "6px 8px", borderRadius: 8, background: darkMode ? DARK.surfaceVariant : NEUTRAL.bg, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, wordBreak: "break-word", whiteSpace: "pre-line" }}>
              {statusDetail}
            </div>
          )}
          {/* ADDED — real ask: isolate bridge-wide vs notifications-
              specific. A non-notification native call (App.getInfo())
              times out too -> the whole bridge is affected, not this
              plugin. It resolves fine -> the problem is specific to
              LocalNotifications. */}
          {bridgeHealth && (
            <div style={{ marginTop: 6, fontSize: 11, color: bridgeHealth.ok ? ACTION.green : ACTION.red }}>
              {bridgeHealth.ok ? "Bridge check: other native calls work fine — this looks specific to notifications." : "Bridge check: a totally unrelated native call also failed — this looks like a broader native bridge issue, not just notifications."}
              <div style={{ marginTop: 4, padding: "6px 8px", borderRadius: 8, background: darkMode ? DARK.surfaceVariant : NEUTRAL.bg, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, wordBreak: "break-word", whiteSpace: "pre-line", color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>
                {bridgeHealth.detail}
              </div>
            </div>
          )}
          <button onClick={request} style={{ marginTop: 8, padding: "8px 14px", borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      )}
      {isGranted && (
        <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 8 }}>
          {isNative
            ? "Android has granted this permission. The toggles below control which reminders actually get scheduled."
            : "Permission granted. The toggles below control which reminders actually get scheduled."}
        </div>
      )}
      {/* ADDED — real, honest platform ceiling for the web/PWA path —
          see this component's own header comment. Native-only banner
          above (exact alarms) stays exactly as it was. */}
      {isGranted && !isNative && (
        <div style={{ marginBottom: 8, padding: "8px 10px", borderRadius: 10, background: darkMode ? DARK.surfaceVariant : NEUTRAL.bg }}>
          <span style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>
            Running as a web app: reminders fire while SHOS is open or recently backgrounded, and for anything already due the moment you next open it — but can't reliably wake you up hours later if it's been fully closed. For that, install the Android app instead.
          </span>
        </div>
      )}
      {/* ADDED 2 Sep 2026 — real ask: "didn't get any" — a real,
          separate Android 12+ setting every reminder here relies on
          for exact timing, distinct from the basic permission above.
          Without it, a reminder still "schedules successfully" from
          the app's own perspective but Android can silently defer it
          by minutes to hours as an inexact alarm instead — the exact
          gap that would make testing feel like nothing ever fires. */}
      {isGranted && exactAlarmStatus && exactAlarmStatus !== "unavailable" && (
        <div style={{ marginBottom: 8, padding: "8px 10px", borderRadius: 10, background: exactAlarmStatus === "granted" ? `${ACTION.green}15` : `${ACTION.red}15` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: exactAlarmStatus === "granted" ? ACTION.green : ACTION.red, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, flex: 1 }}>
              {exactAlarmStatus === "granted"
                ? "Exact alarms allowed — reminders fire on time."
                : exactAlarmStatus === "error"
                ? "Couldn't check exact-alarm status — the check itself failed."
                : "Exact alarms not allowed — reminders may arrive late (minutes to hours), or not at all during testing."}
            </span>
            {exactAlarmStatus !== "granted" && (
              <span role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={requestExactAlarm} style={{ fontSize: 12, fontWeight: 700, color: ACCENTS.healthcare, cursor: "pointer", flexShrink: 0 }}>
                {exactAlarmStatus === "error" ? "Try again" : "Fix this"}
              </span>
            )}
          </div>
          {exactAlarmStatus === "error" && exactAlarmDetail && (
            <div style={{ marginTop: 6, padding: "6px 8px", borderRadius: 8, background: darkMode ? DARK.surfaceVariant : NEUTRAL.bg, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, wordBreak: "break-word" }}>
              {exactAlarmDetail}
            </div>
          )}
        </div>
      )}
      {isDenied && (
        <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>
          {isNative
            ? <>Android is blocking notifications for SHOS — none of the toggles below will actually fire until this changes. Android only shows the one-time in-app prompt once per install, so this has to be turned on manually: open your phone's <strong>Settings → Apps → SHOS → Notifications</strong> and allow them.</>
            : <>Your browser is blocking notifications for SHOS — none of the toggles below will actually fire until this changes. This has to be turned on manually in your browser's own site settings for SHOS (usually the padlock/site-info icon next to the address bar → Notifications → Allow).</>}
        </div>
      )}
      {!isGranted && !isDenied && !isError && (
        <>
          <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 8 }}>
            {isNative ? "SHOS hasn't asked yet, or Android hasn't recorded an answer." : "SHOS hasn't asked yet, or your browser hasn't recorded an answer."} Tap below for the real system prompt.
          </div>
          <button onClick={request} style={{ padding: "8px 14px", borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Allow notifications
          </button>
        </>
      )}
      {isGranted && (
        <div style={{ marginTop: 8 }}>
          {/* CHANGED 2 Sep 2026 — real ask: the actual point of this
              test is confirming a notification survives the app being
              fully CLOSED, not just backgrounded — a real device
              distinction a plain "sent" toast can't prove on its own.
              Spelled out here instead of assumed. Web-specific wording
              below since that's a real capability difference, not just
              phrasing — see this component's own header comment. */}
          <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 8 }}>
            {isNative
              ? <>Tap Send, then close the app (not just switch away — swipe it away or force-close it) before the {Math.round(TEST_NOTIFICATION_DELAY_MS / 1000)}s is up. If it still shows up, real reminders will too.</>
              : <>Tap Send, then switch to another tab or app (or lock your screen) before the {Math.round(TEST_NOTIFICATION_DELAY_MS / 1000)}s is up — it should still appear. Fully closing the tab/app will stop it, which is the real web limitation noted above.</>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={runTest} disabled={testState === "sending"} style={{ padding: "8px 14px", borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: testState === "sending" ? "default" : "pointer", opacity: testState === "sending" ? 0.6 : 1 }}>
              {testState === "sending" ? "Sending…" : "Send test notification"}
            </button>
            {testState === "sent" && <span style={{ fontSize: 11, color: ACTION.green, fontWeight: 600 }}>Sent — should appear in ~{Math.round(TEST_NOTIFICATION_DELAY_MS / 1000)} seconds.</span>}
            {testState && testState.startsWith("failed") && <span style={{ fontSize: 11, color: ACTION.red, fontWeight: 600 }}>Failed to schedule ({testState.split(":")[1]}).</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ADDED 3 Sep 2026 — real ask: install-to-home-screen nudge tied to
// notification reliability — see installPromptService.js's own header
// for the full reasoning (why this needs a module-level listener
// registered from main.jsx rather than one set up lazily in here).
// Android/desktop Chrome/Edge only: iOS has no equivalent API at all
// (Apple platform limitation) and gets its own dedicated guidance
// inside NotificationPermissionBanner above instead — showing a second,
// generic nudge on top of that specific one would just be noise.
function InstallPwaNudge({ darkMode }) {
  const [promptEvent, setPromptEvent] = useState(() => getDeferredInstallPrompt());
  const [platform, setPlatform] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => onInstallPromptAvailable(setPromptEvent), []);
  useEffect(() => { getNotificationPlatform().then(setPlatform); }, []);

  if (platform !== "web" || isStandalone() || isIOS() || !promptEvent || dismissed) return null;

  const install = async () => {
    const choice = await triggerInstallPrompt();
    if (choice) setDismissed(true); // real gesture used, whichever way they answered
  };

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16, padding: "12px 16px", borderRadius: RADIUS.md, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), background: darkMode ? DARK.surface : NEUTRAL.surface }}>
      <Download size={16} color={ACCENTS.healthcare} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Install SHOS for more reliable reminders</div>
        <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginTop: 2, marginBottom: 10 }}>
          Installed as its own app (not just a browser tab), SHOS keeps its background notification handling registered more reliably.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={install} style={{ padding: "7px 14px", borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Install</button>
          <span role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => setDismissed(true)} style={{ fontSize: 12, fontWeight: 600, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, cursor: "pointer" }}>Not now</span>
        </div>
      </div>
    </div>
  );
}

export function NotificationsScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  // ADDED — real audit finding (desktop full-width sweep): grid the
  // master toggle/pause card/quiet hours/7 per-type toggles/history
  // link on desktop, matching MyProfile's own SectionCard-grid fix.
  const isDesktopWidth = useIsDesktopWidth();
  const [refreshKey, forceRefresh] = useState(0);
  const refresh = () => forceRefresh((n) => n + 1);
  const [showHistory, setShowHistory] = useState(false);
  // CHANGED — Phase 2 encryption groundwork: NotificationPreferencesRepository
  // is now async too — same useLoadedMemo/refreshKey pattern as medPrefs.
  const notifPrefs = useLoadedMemo(() => NotificationPreferencesRepository.getPreferences(), [refreshKey], DEFAULT_NOTIFICATION_PREFERENCES);
  const medPrefs = useLoadedMemo(() => MedicationPreferencesRepository.getPreferences(), [refreshKey], DEFAULT_MEDICATION_PREFERENCES);

  // Re-syncs immediately on toggle rather than waiting for the next
  // Home mount or relevant save — turning a reminder off should cancel
  // whatever's already pending right away, not leave a stale native
  // notification scheduled until the app happens to reopen.
  const toggleNotif = async (key) => {
    await NotificationPreferencesRepository.update({ [key]: !notifPrefs[key] });
    if (key === "doxyPepAlertEnabled") syncDoxyPepAlert();
    else if (key === "testingReminderEnabled") syncTestingReminder();
    else if (key === "refillReminderEnabled") syncRefillReminder();
    else if (key === "vaccinationReminderEnabled") syncVaccinationReminders();
    else syncClinicVisitReminders();
    refresh();
  };
  const toggleMed = async () => { await MedicationPreferencesRepository.updatePreferences({ doseRemindersEnabled: !medPrefs.doseRemindersEnabled }); syncMedicationReminders(); refresh(); };

  // Re-syncs every real reminder type at once — used by the master
  // switch, quiet hours, and vacation pause below, all of which affect
  // every type simultaneously rather than just one.
  const resyncAll = () => {
    syncMedicationReminders();
    syncDoxyPepAlert();
    syncTestingReminder();
    syncRefillReminder();
    syncClinicVisitReminders();
    syncVaccinationReminders();
  };

  const toggleMaster = async () => { await NotificationPreferencesRepository.update({ masterEnabled: !notifPrefs.masterEnabled }); resyncAll(); refresh(); };

  // ADDED 3 Sep 2026 — real ask: quiet hours + vacation pause.
  const setQuietHours = async (changes) => { await NotificationPreferencesRepository.update(changes); resyncAll(); refresh(); };
  const pausedActive = isPaused(notifPrefs);
  const startPause = async (days) => {
    const until = new Date();
    until.setDate(until.getDate() + days);
    await NotificationPreferencesRepository.update({ pausedUntil: until.toISOString() });
    resyncAll();
    refresh();
  };
  const resumeNow = async () => { await NotificationPreferencesRepository.update({ pausedUntil: null }); resyncAll(); refresh(); };

  const hoursInput = (value, onChange) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
      <span style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>Hours before:</span>
      <input type="number" min={1} max={168} value={value} aria-label="Hours before"
        onChange={(e) => onChange(Math.max(1, Math.min(168, Number(e.target.value) || 1)))}
        style={{ width: 56, padding: "6px 8px", borderRadius: 8, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), background: darkMode ? DARK.surfaceVariant : NEUTRAL.bg, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontSize: 13, textAlign: "center" }} />
    </div>
  );

  return (
    <div tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: darkMode ? DARK.bg : NEUTRAL.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : NEUTRAL.bg, borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label="Back" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Notifications</h1>
      </div>

      <div style={{ padding: 16 }}>
        <NotificationPermissionBanner darkMode={darkMode} />
        <InstallPwaNudge darkMode={darkMode} />

        <div style={isDesktopWidth ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 8, alignItems: "start" } : undefined}>
        {/* ADDED 3 Sep 2026 — real ask: a single master switch, distinct
            from the 5 independent per-type toggles below. Checked in
            notificationService.js's own scheduleNotification() before
            any real reminder fires, regardless of type. */}
        <NotificationToggleRow darkMode={darkMode} label="All notifications" enabled={notifPrefs.masterEnabled} onToggle={toggleMaster}
          description="Turns every reminder type below on or off at once. Each toggle keeps its own setting for when this is back on." />

        {/* ADDED 3 Sep 2026 — real ask: "pause all reminders" vacation
            mode — a dated, self-expiring pause, distinct from the
            master switch above (permanent preference) and from a
            single medication's own "skip until tomorrow" (only covers
            one medication, one day). */}
        <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Pause everything</div>
          {pausedActive ? (
            <>
              <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginTop: 2, marginBottom: 10 }}>
                Paused until {new Date(notifPrefs.pausedUntil).toLocaleDateString([], { day: "numeric", month: "short" })}, {new Date(notifPrefs.pausedUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.
              </div>
              <button onClick={resumeNow} style={{ padding: "8px 14px", borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Resume now</button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginTop: 2, marginBottom: 10 }}>
                Temporarily stop every reminder — travelling, a break, whatever the reason. Resumes on its own, no need to remember to turn it back on.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[{ label: "1 day", days: 1 }, { label: "3 days", days: 3 }, { label: "1 week", days: 7 }, { label: "2 weeks", days: 14 }].map((opt) => (
                  <button key={opt.days} onClick={() => startPause(opt.days)} style={{ padding: "6px 12px", borderRadius: 999, border: `1px solid ${darkMode ? DARK.border : NEUTRAL.border}`, background: "transparent", color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{opt.label}</button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ADDED 3 Sep 2026 — real ask: quiet hours. Deferred, not
            dropped — a reminder due inside the window is rescheduled
            for the window's end, see quietHoursEndAfter() in
            notificationPreferencesRepository.js. */}
        <NotificationToggleRow darkMode={darkMode} label="Quiet hours" enabled={notifPrefs.quietHoursEnabled} onToggle={() => setQuietHours({ quietHoursEnabled: !notifPrefs.quietHoursEnabled })}
          description="Reminders due inside this window wait until it ends, rather than firing overnight.">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 4 }}>From</div>
              <input type="time" value={notifPrefs.quietHoursStart} onChange={(e) => setQuietHours({ quietHoursStart: e.target.value })}
                style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), background: darkMode ? DARK.surfaceVariant : NEUTRAL.bg, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontSize: 13 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 4 }}>To</div>
              <input type="time" value={notifPrefs.quietHoursEnd} onChange={(e) => setQuietHours({ quietHoursEnd: e.target.value })}
                style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), background: darkMode ? DARK.surfaceVariant : NEUTRAL.bg, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontSize: 13 }} />
            </div>
          </div>
        </NotificationToggleRow>

        <NotificationToggleRow darkMode={darkMode} label="Medication dose reminders" enabled={medPrefs.doseRemindersEnabled} onToggle={toggleMed}
          description="Alerts when a daily medication is due, or due soon." />
        <NotificationToggleRow darkMode={darkMode} label="Refill reminders" enabled={notifPrefs.refillReminderEnabled} onToggle={() => toggleNotif("refillReminderEnabled")}
          description="Alerts when a tracked medication's stock drops to its refill threshold." />
        <NotificationToggleRow darkMode={darkMode} label="DoxyPEP dose alert" enabled={notifPrefs.doxyPepAlertEnabled} onToggle={() => toggleNotif("doxyPepAlertEnabled")}
          description="Alert as the 72-hour DoxyPEP window approaches after a qualifying activity." />
        <NotificationToggleRow darkMode={darkMode} label="Testing due reminder" enabled={notifPrefs.testingReminderEnabled} onToggle={() => toggleNotif("testingReminderEnabled")}
          description="Reminder around your suggested routine retest date (3 months after a negative test)." />
        <NotificationToggleRow darkMode={darkMode} label="Vaccination due reminder" enabled={notifPrefs.vaccinationReminderEnabled} onToggle={() => toggleNotif("vaccinationReminderEnabled")}
          description="Reminder on a vaccination record's own 'Next due' date (e.g. the second dose of a multi-dose course)." />
        {/* CHANGED 17 Sep 2026 — real ask: put the two clinic-appointment
            reminders on one shared card instead of two separate ones —
            they're the same real feature (a booked appointment), just
            two independently-timed alerts about it. */}
        <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, marginBottom: 10 }}>Clinic appointment reminders</div>
          <NotificationToggleRow bare darkMode={darkMode} label="First reminder" enabled={notifPrefs.clinicVisitReminderAEnabled} onToggle={() => toggleNotif("clinicVisitReminderAEnabled")}
            description="Defaults to 24 hours before the appointment.">
            {hoursInput(notifPrefs.clinicVisitReminderAHours, async (v) => { await NotificationPreferencesRepository.update({ clinicVisitReminderAHours: v }); syncClinicVisitReminders(); refresh(); })}
          </NotificationToggleRow>
          <div style={{ height: 1, background: darkMode ? DARK.border : NEUTRAL.border, margin: "12px 0" }} />
          <NotificationToggleRow bare darkMode={darkMode} label="Second reminder" enabled={notifPrefs.clinicVisitReminderBEnabled} onToggle={() => toggleNotif("clinicVisitReminderBEnabled")}
            description="A closer, second reminder. Defaults to 2 hours before.">
            {hoursInput(notifPrefs.clinicVisitReminderBHours, async (v) => { await NotificationPreferencesRepository.update({ clinicVisitReminderBHours: v }); syncClinicVisitReminders(); refresh(); })}
          </NotificationToggleRow>
        </div>

        {/* ADDED 3 Sep 2026 — real ask: a notification history log —
            nothing anywhere previously recorded that a real
            notification had delivered. */}
        <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => setShowHistory(true)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: RADIUS.md, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), background: darkMode ? DARK.surface : NEUTRAL.surface, cursor: "pointer" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Notification history</span>
          <ChevronRight size={16} color={darkMode ? DARK.textSecondary : NEUTRAL.textSecondary} />
        </div>
        </div>
      </div>

      {showHistory && <NotificationHistoryScreen darkMode={darkMode} onClose={() => setShowHistory(false)} />}
    </div>
  );
}

// ADDED 3 Sep 2026 — real ask: a real log of past notification
// deliveries — see notificationHistoryRepository.js's own header for
// the full reasoning. Read-only besides a Clear action; this is a
// diagnostic/awareness view, not something with its own settings.

export default NotificationsScreen;

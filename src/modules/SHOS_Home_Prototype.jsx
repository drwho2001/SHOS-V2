import { useDarkModePreference } from "../calculations/darkModePreference";
import { NEUTRAL_DARK as DARK } from "../calculations/designTokens";
// SHOS_Home_Prototype.jsx
//
// ADDED — real architecture extraction, same reasoning as the
// Settings and Healthcare extractions: this was the Home tab's actual
// screen content, living directly inside App.jsx. Pure code motion —
// every line of actual behavior below is unchanged from what was
// working in App.jsx; only the file it lives in has changed.
import React, { useState, useEffect } from "react";
import { ACCENTS, ACTION } from "../calculations/designTokens";
// ADDED — real ask: Medication's own accent (#003B6F) is a very dark,
// near-black navy — legible as a solid FILL with white text/icon on
// top (the nav bar tab, filled buttons), which is where Medication's
// own module uses it. Used bare as a small icon glyph on a plain card
// here, it read as flat/too dark rather than distinctly "medication
// blue". This brighter variant is Home-local only — Medication's own
// module and the nav bar keep the original navy unchanged.
const MEDS_ICON_BLUE = "#2F5CA6";
import { formatRelativeDate } from "../calculations/encounterCalculations";
import { getLastBackupInfo, runAutoExportIfDue } from "../storage/backupService";
import { checkForUpdate, RELEASE_APK_URL } from "../storage/updateCheckService";
import {
  HouseIcon as Home, UsersIcon as Users, PulseIcon as Activity, PillIcon as Pill,
  HeartbeatIcon as HeartPulse, CaretRightIcon as ChevronRight, GearIcon as SettingsIcon,
  UserIcon as User, MagnifyingGlassIcon as Search, DatabaseIcon as Database,
  TestTubeIcon as TestTube, FireIcon as Flame, StethoscopeIcon as Stethoscope,
  SyringeIcon as Syringe, ThermometerIcon as Thermometer, CalendarIcon as Calendar, CalendarCheckIcon as CalendarCheck, StackIcon as Stack, DropIcon as Drop,
  IdentificationBadgeIcon as CreditCard, DownloadSimpleIcon as Download, LockIcon as Lock,
} from "@phosphor-icons/react";
import { PrivacySettingsRepository } from "../repositories/privacySettingsRepository";
import { ContactRepository } from "../repositories/contactRepository";
import { EncounterRepository } from "../repositories/encounterRepository";
import { MedicationRepository } from "../repositories/medicationRepository";
import { LogRepository } from "../repositories/logRepository";
import { TestingRepository } from "../repositories/testingRepository";
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository";
import { MyProfileRepository } from "../repositories/myProfileRepository";
// ADDED — real ask: Home shortcuts for Menstrual/Contraception, only
// when the feature is actually enabled (see appPreferencesRepository.js's
// own menstrualTrackingEnabled) — same "don't show it if it's off"
// treatment as everything else gated by a Settings toggle.
import { AppPreferencesRepository } from "../repositories/appPreferencesRepository";
import { MenstrualCycleRepository } from "../repositories/menstrualCycleRepository";
import { ContraceptionRepository } from "../repositories/contraceptionRepository";
import { PregnancyRepository } from "../repositories/pregnancyRepository";
import { formatDoxyPepCountdown } from "../calculations/doxyPepCalculations";
import { syncDoxyPepAlert } from "../calculations/doxyPepSync";
import { requestNotificationPermission } from "../storage/notificationService";
import { syncMedicationReminders } from "../calculations/medicationReminderSync";
import { syncTestingReminder } from "../calculations/testingReminderSync";
import { syncRefillReminder } from "../calculations/refillReminderSync";
import { syncClinicVisitReminders } from "../calculations/clinicVisitReminderSync";
import { syncClinicVisitsToCalendar } from "../storage/calendarSyncService";
import MyProfileModule from "./SHOS_MyProfile_Prototype";
import ClinicCardScreen from "./SHOS_ClinicCard_Prototype";
import TimelineModule from "./SHOS_Timeline_Prototype";

function HomeScreen({ onQuickAdd, onOpenSettings, onOpenSearch, onNavigateToRecord, onQuickAddWithPrefill, onOpenCalendar, registerModuleBackHandler, onLockNow }) {
  const [darkMode] = useDarkModePreference();

  // ADDED — real ask: title reads "[Name]'s dashboard" instead of a
  // bare "Home". My Profile only has `nickname`, no separate name
  // field — falls back to a generic label if it's never been filled
  // in, rather than showing "'s dashboard" with a blank in front.
  const [profileName] = useState(() => MyProfileRepository.getProfile().nickname);
  // CHANGED 1 Sep 2026 — real fix, found during a smoothness/efficiency
  // review: unlike every other repository read on this screen (all
  // read once via a lazy useState initializer or a mount-only
  // useEffect), this was calling PrivacySettingsRepository.getSettings()
  // directly in the render body — a real localStorage read + JSON.parse
  // on every single re-render of Home, not just once. Same lazy-
  // useState pattern as profileName just above.
  const [appLockEnabled] = useState(() => PrivacySettingsRepository.getSettings().appLockEnabled);
  const [lastContact, setLastContact] = useState(null);
  const [lastEncounter, setLastEncounter] = useState(null);
  const [lastDose, setLastDose] = useState(null);
  const [lastTest, setLastTest] = useState(null);
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [showClinicCard, setShowClinicCard] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  // ADDED 19 Aug 2026 — next scheduled clinic visit, real data.
  const [nextVisit, setNextVisit] = useState(null);
  // ADDED — real ask: Menstrual/Contraception shortcuts + real results
  // on the dashboard, gated behind the same toggle the Healthcare
  // sub-tab itself is gated behind.
  const [menstrualTrackingEnabled] = useState(() => AppPreferencesRepository.getPreferences().menstrualTrackingEnabled);
  const [lastPeriod, setLastPeriod] = useState(null);
  const [contraceptionDue, setContraceptionDue] = useState(null);
  // ADDED 19 Aug 2026 — real ask: a backup reminder. Read once on
  // mount, same pattern as everything else on Home — see
  // backupService.js's getLastBackupInfo() for how "due" is computed.
  const [backupInfo] = useState(() => getLastBackupInfo());
  // ADDED — real ask: "scheduled auto-export" — self-gated inside
  // runAutoExportIfDue() on whether the preference is actually turned
  // on (Settings -> Preferences), safe to call unconditionally here,
  // same catch-up-on-mount reasoning as every other sync above. `ran`
  // only flips true on the one app-open where a real file was actually
  // written — the confirmation banner below is a one-off, not a
  // persistent nag, since the interval won't be due again for a while.
  const [autoExportRan, setAutoExportRan] = useState(false);
  useEffect(() => {
    runAutoExportIfDue().then((result) => { if (result.ran) setAutoExportRan(true); });
  }, []);
  // ADDED — real ask: "add a check for available updates / notify /
  // auto download?" Self-gated inside checkForUpdate() on being a real
  // native build with a real build identifier to compare (see that
  // file's own comment for the honest limit on "auto download" — a
  // genuinely silent install isn't something Android allows a
  // sideloaded app to do to itself; this gets you to the real download
  // in one tap instead, same catch-up-on-mount reasoning as every
  // other sync on this screen).
  const [updateInfo, setUpdateInfo] = useState({ updateAvailable: false });
  useEffect(() => {
    checkForUpdate().then(setUpdateInfo);
  }, []);
  // ADDED 26 Aug 2026 — real ask: DoxyPEP 72h alert. Calls
  // syncDoxyPepAlert() (not just a local computation) so this single
  // effect covers both the in-app banner below AND the real native
  // notification scheduling (see doxyPepSync.js) — deliberately kept
  // out of App.jsx: Home already mounts fresh on every app open
  // (`active` defaults to "home", nothing persists a different last-
  // open tab), so putting this here instead of the shell covers
  // exactly the same "app opened, resync" case without adding a new
  // concern to App.jsx, which was deliberately decluttered down to
  // routing/tab-config/App-Lock-gate only. Also re-synced right after
  // a qualifying Activity is saved (Encounters) or a DoxyPEP dose is
  // logged (Medication) — see those files' own comments.
  const [doxyStatus, setDoxyStatus] = useState({ active: false });
  useEffect(() => {
    const recompute = () => { syncDoxyPepAlert().then(setDoxyStatus); };
    recompute();
    const interval = setInterval(recompute, 60000);
    return () => clearInterval(interval);
  }, []);

  // ADDED 26 Aug 2026 by Claude Code, mirrored back here to keep this
  // copy in sync — real gap: a scheduled notification silently does
  // nothing without permission granted first, and this was written but
  // never actually called anywhere. Kept as its own one-time effect,
  // separate from the 60s-repeating DoxyPEP effect above (this only
  // ever needs to run once per app launch, not on every recompute).
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // ADDED 26 Aug 2026 — real ask: custom medication reminder
  // notifications. Same reasoning as DoxyPEP's own effect above for
  // why this lives in Home, not App.jsx — Home mounts fresh on every
  // app open, so this is where "catch up on current state" belongs.
  useEffect(() => {
    syncMedicationReminders();
  }, []);

  // ADDED — real ask: proactive "due for retest" notification. Same
  // "Home mounts fresh on every app open, so this is where catch-up
  // belongs" reasoning as DoxyPEP/medication reminders above — this
  // recomputes the due date from real Test records and (re)schedules
  // the native reminder if one's needed. Also re-synced right after a
  // test is saved — see SHOS_Testing_Prototype.jsx's own comment.
  useEffect(() => {
    syncTestingReminder();
  }, []);

  // ADDED — real ask: unified notifications, "when refill due" and
  // "reminder for clinic visit... 24 & 2h in advance". Same catch-up-
  // on-mount reasoning as every sync above. Also re-synced right after
  // the relevant save — see Medication's own logDose/logQuantity and
  // Clinic Visits' own save handler.
  useEffect(() => {
    syncRefillReminder();
    syncClinicVisitReminders();
  }, []);

  // ADDED — real ask: calendar sync, "kept separate/private". Self-
  // gated inside syncClinicVisitsToCalendar() on whether the feature
  // is actually turned on (Settings -> Privacy) — safe to call
  // unconditionally here, same catch-up-on-mount reasoning as every
  // other sync above. Also re-synced right after Clinic Visits' own
  // save.
  useEffect(() => {
    syncClinicVisitsToCalendar(ClinicVisitsRepository.getAll());
  }, []);

  useEffect(() => {
    const contacts = ContactRepository.getAll().filter((c) => !c.isArchived);
    const sortedContacts = [...contacts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setLastContact(sortedContacts[0] || null);

    const encounters = EncounterRepository.getAll();
    const sortedEncounters = [...encounters].sort((a, b) => new Date(b.date) - new Date(a.date));
    setLastEncounter(sortedEncounters[0] || null);

    const meds = MedicationRepository.getAll();
    const doseLogs = LogRepository.getAll().filter((l) => l.type === "dose" && !l.voided);
    const sortedLogs = [...doseLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
    const lastLog = sortedLogs[0];
    if (lastLog) {
      // CHANGED 26 Aug 2026 — real ask: was only ever showing the
      // single last log entry, so logging several meds together (e.g.
      // "Log all daily meds", or PrEP + something else close together)
      // only ever displayed one of them. Now groups every dose logged
      // within 10 minutes of the most recent one and shows all the
      // names together, same underlying data, no schema change.
      const TEN_MIN_MS = 10 * 60000;
      const lastLogTime = new Date(lastLog.date).getTime();
      const grouped = sortedLogs.filter((l) => lastLogTime - new Date(l.date).getTime() <= TEN_MIN_MS);
      const names = [...new Set(grouped.map((l) => meds.find((m) => m.id === l.medicationId)?.name).filter(Boolean))];
      setLastDose(names.length > 0 ? { name: names.join(", "), date: lastLog.date } : null);
    }

    // ADDED 19 Aug 2026 — Testing and Home are both fully built now, so
    // this is a real, appropriate interconnection (same "recent
    // activity" pattern already used for the other three modules) —
    // unlike Clinic Visits/Related symptoms, which stay stubbed in
    // testingRepository.js because those modules don't exist yet and
    // there's nothing real to connect to.
    // CHANGED 26 Aug 2026 — real bug fix: "Last test" had no date
    // filter at all, so a future-dated scheduled test could sort
    // ahead of the actual most recent completed one. Excludes
    // anything dated after today, same principle as nextVisit's own
    // upcoming-only filter just below (mirrored, not duplicated logic
    // — one excludes future, the other excludes past).
    const tests = TestingRepository.getAll().filter((t) => !t.isArchived && t.date && t.date.slice(0, 10) <= new Date().toISOString().slice(0, 10));
    const sortedTests = [...tests].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    setLastTest(sortedTests[0] || null);

    // CHANGED — real bug from the user's own testing ("Next clinic visit
    // is displaying incorrect or incomplete data"): this used to filter
    // on `isFutureAppointment`, a manually-set toggle from when the
    // visit was created — nothing ever flips it back off once that
    // date actually passes, so a stale-flagged past visit could keep
    // showing as "next", while a genuinely future visit left un-toggled
    // wouldn't show at all. Derived from the real date instead — same
    // "store facts, derive state" principle already used for Contacts'
    // own inactive-flag logic, just not consistently applied here
    // before now.
    const today = new Date().toISOString().slice(0, 10);
    const visits = ClinicVisitsRepository.getAll().filter((v) => !v.isArchived && v.date && v.date.slice(0, 10) >= today);
    const sortedUpcoming = [...visits].sort((a, b) => new Date(a.date) - new Date(b.date));
    setNextVisit(sortedUpcoming[0] || null);

    // ADDED — real ask: Menstrual/Contraception real results on the
    // dashboard. Skipped entirely when the feature is off — no reason
    // to read either repository for a screen that won't show them.
    if (menstrualTrackingEnabled) {
      const cycles = MenstrualCycleRepository.getAll().filter((c) => !c.isArchived);
      const sortedCycles = [...cycles].sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0));
      setLastPeriod(sortedCycles[0] || null);

      // "Contraception due" mirrors "Next clinic visit" exactly — the
      // soonest upcoming date across currently-active methods, not
      // just the most recently started one.
      const active = ContraceptionRepository.getActive().filter((e) => e.nextDueDate);
      const sortedDue = [...active].sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate));
      setContraceptionDue(sortedDue[0] || null);
    }
  }, []);

  // ADDED 19 Aug 2026 — real fix, the user's ask: explicit time, not just
  // a vague relative string. Within the last 24h: relative time-since
  // PLUS a 12-hour AM/PM clock time, no date needed. Older than 24h:
  // the actual date plus a 24-hour clock time — matches how the rest
  // of the app already distinguishes "recent" from "historical" data.
  // CHANGED 19 Aug 2026 — date formatting made explicit rather than
  // locale-dependent. `toLocaleDateString(undefined, ...)` defers to
  // whatever the device's locale happens to be set to — US devices
  // format month-first ("Aug 16"), UK devices day-first ("16 Aug").
  // Since this needs to read consistently regardless of device
  // settings, spelling it out explicitly rather than trusting that.
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // CHANGED 26 Aug 2026 — Clinic Visits now has a real time field
  // (see DateTimeField in SHOS_ClinicVisits_Prototype.jsx), so this
  // can show the actual time instead of the date-only placeholder from
  // earlier today. Existing visits saved before this change stored
  // midnight — those will show 12:00 AM until re-saved with a real
  // time, which is expected, not a bug.
  function formatExactDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  }
  // A date-only variant of the above — contraception's own nextDueDate
  // (and similar plain "YYYY-MM-DD" facts) has no real time component,
  // so reusing formatExactDate would show a misleading "12:00 AM".
  function formatDueDate(dateOnly) {
    if (!dateOnly) return "—";
    const d = new Date(dateOnly);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  function formatDoseTime(iso) {
    if (!iso) return "—";
    const then = new Date(iso);
    const now = new Date();
    const diffMs = now - then;
    const diffHours = diffMs / 3600000;
    if (diffHours >= 0 && diffHours < 24) {
      let h12 = then.getHours() % 12;
      if (h12 === 0) h12 = 12;
      const mm12 = String(then.getMinutes()).padStart(2, "0");
      const ampm = then.getHours() < 12 ? "AM" : "PM";
      const clock = `${h12}:${mm12} ${ampm}`;
      const wholeHours = Math.floor(diffHours);
      const mins = Math.floor((diffMs % 3600000) / 60000);
      const relative = wholeHours > 0 ? `${wholeHours}h ago` : mins > 0 ? `${mins}m ago` : "just now";
      return `${relative} (${clock})`;
    }
    const dateStr = `${then.getDate()} ${MONTHS[then.getMonth()]}`;
    const hh = String(then.getHours()).padStart(2, "0");
    const mm = String(then.getMinutes()).padStart(2, "0");
    return `${dateStr}, ${hh}:${mm}`;
  }

  // CHANGED 26 Aug 2026 — real ask: tapping a read-only Recent Activity
  // row should open that actual record, not just sit there. Optional
  // onClick — rows with nothing real to link to (e.g. "None yet") stay
  // exactly as before.
  // CHANGED 26 Aug 2026 — real ask: value should always be black
  // (was teal on clickable rows), label should be its own module's
  // colour (was flat gray for every row regardless of what it's about).
  const SummaryRow = ({ label, value, onClick, moduleColor }) => (
    <div onClick={onClick} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", cursor: onClick ? "pointer" : "default" }}>
      <span style={{ fontSize: 13, color: moduleColor || "#5B5B62", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
  );

  // CHANGED — real ask: "bigger... button colour change to module
  // theme" — same treatment just applied to Clinic Card/Timeline.
  // CHANGED 26 Aug 2026 — real ask: white background, module-colour
  // outline, module-colour icon — was a tinted colour background
  // before.
  const QuickAddButton = ({ icon: Icon, label, color, onClick }) => (
    <div onClick={onClick}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderRadius: 16, border: `1px solid ${color}`, background: darkMode ? DARK.surface : "#FFFFFF", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Icon size={22} color={color} />
        <span style={{ fontSize: 15, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>{label}</span>
      </div>
      <ChevronRight size={18} color={darkMode ? DARK.textDisabled : "#656568"} />
    </div>
  );

  return (
    <div style={{ padding: "20px 16px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {profileName ? `${profileName}'s dashboard` : "Your dashboard"}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* ADDED 1 Sep 2026 — real ask: "no way to leave duress mode,
              which points to no manual relock button... also for real
              workspace not fake pin." Only shown when App Lock is
              actually on — locking with no PIN set would trap someone
              with no way back in. Tapping it just returns to the PIN
              screen (App.jsx's setLocked(true)) — not a backdoor into
              anything, the same neutral gate either PIN already goes
              through. DecoyHome gets its own copy of this, wired to
              the same handler, so it works from inside a duress
              session too. */}
          {onLockNow && appLockEnabled && (
            <Lock size={19} weight="bold" color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onLockNow} title="Lock now" />
          )}
          {/* ADDED 19 Aug 2026 — Global Search, canonical Home placement
              per Doc 1, same treatment as the Settings gear icon right
              next to it. */}
          <Search size={19} weight="bold" color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onOpenSearch} title="Search" />
          {/* ADDED 19 Aug 2026 — My Profile access on Home too, per
              the user's ask, alongside the existing Contacts shortcut. */}
          <User size={19} weight="bold" color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={() => setShowMyProfile(true)} title="My Profile" />
          {/* ADDED 19 Aug 2026 — canonical Settings location per Doc 1:
              "gear icon in the Top App Bar, canonically on Home." */}
          {/* CHANGED 26 Aug 2026 — real ask: chrome-level icons
              (search/settings/import/export) should be thick black
              lines, not too weighty — weight="bold" keeps this an
              outline icon (not a filled/solid one), just a heavier
              stroke, color darkened from grey to near-black. */}
          <SettingsIcon size={20} weight="bold" color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onOpenSettings} title="Settings" />
        </div>
      </div>
      {/* ADDED — real ask: "dashboard needs teal header bar under
          title" — every other module's own title sits on a filled
          colour banner; Home deliberately doesn't (a filled banner
          would fight with the greeting/summary content directly below
          it), so this is the same accent, as a bar rather than a full
          fill, giving Home a real colour identity of its own
          (ACCENTS.home) instead of reading as unstyled next to
          Healthcare/Medication/Contacts. */}
      <div style={{ height: 4, borderRadius: 999, background: ACCENTS.home, marginBottom: 16 }} />

      {/* ADDED 19 Aug 2026 — welcome text, the user's own wording as the
          basis: open, non-judgemental, genuinely useful tone. */}
      <div style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62", lineHeight: 1.5, marginBottom: 20 }}>
        Welcome to your personal sexual health operating system. Log hookups, testing, clinic visits, medications, and more — all in one place, with clear summaries when you need them. No judgement here, just a useful record that's actually yours.
      </div>

      {/* ADDED 26 Aug 2026 — real ask: DoxyPEP 72h alert. Informational
          flagging only, same "this app doesn't make clinical decisions"
          boundary as exposureWindows.js — never blocks anything, just
          surfaces the window. Overdue uses the app's real Action-State
          red; still-counting-down uses a neutral informational tint,
          matching the C5 convention that red means "needs action now". */}
      {doxyStatus.active && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 14, marginBottom: 16,
          background: doxyStatus.overdue ? "#E5484D18" : `${MEDS_ICON_BLUE}12`,
          border: `1px solid ${doxyStatus.overdue ? "#E5484D" : MEDS_ICON_BLUE}`,
        }}>
          <Syringe size={18} color={doxyStatus.overdue ? "#E5484D" : MEDS_ICON_BLUE} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: doxyStatus.overdue ? "#E5484D" : "#1B1B1F" }}>
              {doxyStatus.overdue ? "DoxyPEP dose overdue" : "DoxyPEP dose due soon"}
            </div>
            <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 1 }}>
              {doxyStatus.overdue
                ? `${formatDoxyPepCountdown(doxyStatus.msOverdue)} past the 72h window`
                : `${formatDoxyPepCountdown(doxyStatus.msRemaining)} remaining in the 72h window`}
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: darkMode ? DARK.textSecondary : "#5B5B62", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Recent activity</div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, padding: "0 14px", marginBottom: 24 }}>
        <SummaryRow label="Last encounter" moduleColor={ACCENTS.encounters} value={lastEncounter ? `${lastEncounter.title || lastEncounter.encounterType || "Encounter"} · ${formatRelativeDate(lastEncounter.date)}` : "None yet"} onClick={lastEncounter ? () => onNavigateToRecord("activity", lastEncounter.id) : undefined} />
        <SummaryRow label="Last medication dose" moduleColor={MEDS_ICON_BLUE} value={lastDose ? `${lastDose.name} · ${formatDoseTime(lastDose.date)}` : "None yet"} />
        <SummaryRow label="Last test" moduleColor={ACCENTS.healthcare} value={lastTest ? `${lastTest.title || lastTest.testingFor.join("/") || "Test"} · ${formatRelativeDate(lastTest.date)}` : "None yet"} onClick={lastTest ? () => onNavigateToRecord("healthcare", lastTest.id, "testing") : undefined} />
        <SummaryRow label="Next clinic visit" moduleColor={ACCENTS.healthcare} value={nextVisit ? `${(nextVisit.reasonForVisit || []).join("/") || nextVisit.title || "Visit"} · ${formatExactDate(nextVisit.date)}` : "None scheduled"} onClick={nextVisit ? () => onNavigateToRecord("healthcare", nextVisit.id, "clinicVisits") : undefined} />
        {/* ADDED — real ask: Menstrual/Contraception real results on
            the dashboard, same "click opens the actual record" pattern
            as every row above — not a separate stats section, this
            list already IS the dashboard's "quick key stats." */}
        {menstrualTrackingEnabled && (
          <>
            <SummaryRow label="Last period" moduleColor={ACCENTS.healthcare} value={lastPeriod ? `${formatRelativeDate(lastPeriod.startDate)}${lastPeriod.endDate ? "" : " (ongoing)"}` : "None logged"} onClick={lastPeriod ? () => onNavigateToRecord("healthcare", lastPeriod.id, "menstrualHealth") : undefined} />
            <SummaryRow label="Contraception due" moduleColor={ACCENTS.healthcare} value={contraceptionDue ? `${contraceptionDue.method} · ${formatDueDate(contraceptionDue.nextDueDate)}` : "None due"} onClick={contraceptionDue ? () => onNavigateToRecord("healthcare", contraceptionDue.id, "menstrualHealth") : undefined} />
          </>
        )}
      </div>

      {/* CHANGED — real ask: Clinic Card + Timeline moved above Quick
          Add, was below it before. */}
      {/* CHANGED — real ask: bigger, black text, background colored to
          the module's own accent instead of plain white with colored
          text/icon. */}
      {/* CHANGED 26 Aug 2026 — real ask: these two shortcuts live on
          Home, not inside Healthcare, so they should carry Home's own
          teal accent rather than borrowing Healthcare's green. */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <div onClick={() => setShowClinicCard(true)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "16px 12px", borderRadius: 16, border: `1px solid ${ACCENTS.home}`, background: `${ACCENTS.home}22`, cursor: "pointer" }}>
          <CreditCard size={20} color={ACCENTS.home} />
          <span style={{ fontSize: 15, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Clinic Card</span>
        </div>
        <div onClick={() => setShowTimeline(true)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "16px 12px", borderRadius: 16, border: `1px solid ${ACCENTS.home}`, background: `${ACCENTS.home}22`, cursor: "pointer" }}>
          <Stack size={20} color={ACCENTS.home} />
          <span style={{ fontSize: 15, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Episodes</span>
        </div>
      </div>
      {/* ADDED 26 Aug 2026 — real ask: Calendar as a third button, its
          own centered line below Clinic Card/Episodes — not a top-bar
          icon (moved from there), not squeezed into the same row
          (would make three unevenly-sized buttons). */}
      {onOpenCalendar && (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div onClick={onOpenCalendar} style={{ width: "50%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "16px 12px", borderRadius: 16, border: `1px solid ${ACCENTS.home}`, background: `${ACCENTS.home}22`, cursor: "pointer" }}>
            <Calendar size={20} color={ACCENTS.home} />
            <span style={{ fontSize: 15, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Calendar</span>
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: darkMode ? DARK.textSecondary : "#5B5B62", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Quick add</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#656568", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Personal</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        <QuickAddButton icon={Users} label="New contact" color={ACCENTS.contacts} onClick={() => onQuickAdd("contacts")} />
        {/* CHANGED — real ask: a distinct icon for Encounter rather
            than the generic Activity glyph. Lucide doesn't have a
            literal "lips" icon (checked before picking a substitute,
            not guessed at) — Flame is the closest thematically-honest
            match already established in this app (Kink Registry uses
            it the same way), kept in Encounters' own existing pink. */}
        <QuickAddButton icon={Flame} label="New encounter" color={ACCENTS.encounters} onClick={() => onQuickAdd("activity")} />
        {/* CHANGED 20 Aug 2026 — real bug found in the design-
            unification pass: this was #3B82F6, a different, lighter
            blue than Medication Dashboard's own accent (medsBlue,
            ACCENTS.medication). Now reads from the same shared token
            the module itself uses. */}
        {/* CHANGED 26 Aug 2026 — real bug fix: this used to call
            onQuickAdd("medication"), which opens the Add New Medicine
            form — wrong action entirely. Now navigates to Medication's
            default Registry tab, where the real "Log all daily meds"
            button already lives (with its own "Includes: X, Y" line,
            built 18 Aug 2026) — reuses onNavigateToRecord with no
            record id, the same plain-navigation path Global Search
            uses, rather than the quick-add mechanism. Deliberately
            NOT auto-firing the bulk log on mount: logging a real dose
            is an immediate write with no intermediate editable form
            (unlike every other quick-add, which only opens a blank
            draft), so it keeps the same explicit, visible tap every
            other write in this app requires. */}
        <QuickAddButton icon={Pill} label="Log medication" color={MEDS_ICON_BLUE} onClick={() => onNavigateToRecord("medication", null)} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#656568", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Healthcare</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <QuickAddButton icon={TestTube} label="Log test" color={ACCENTS.healthcare} onClick={() => onQuickAdd("healthcare", "testing")} />
        {/* CHANGED — real ask: Clinic Visit gets Stethoscope, Symptom
            gets Thermometer ("Bandage" isn't an icon this lucide-react
            version exports — build-verified before picking a
            substitute, not guessed at), and Vaccination gets Syringe —
            was all four sharing the same generic HeartPulse before.
            CHANGED again — these were hardcoded "#4A80F0" instead of
            reading ACCENTS.healthcare like every sibling button on
            this same screen — a real gap, not deliberate, caught while
            doing the Healthcare recolor. */}
        <QuickAddButton icon={Stethoscope} label="New clinic visit" color={ACCENTS.healthcare} onClick={() => onQuickAdd("healthcare", "clinicVisits")} />
        <QuickAddButton icon={Thermometer} label="Log symptom" color={ACCENTS.healthcare} onClick={() => onQuickAdd("healthcare", "symptomLog")} />
        <QuickAddButton icon={Syringe} label="Log vaccination" color={ACCENTS.healthcare} onClick={() => onQuickAdd("healthcare", "vaccinations")} />
        {/* ADDED — real ask: shortcuts to Menstrual/Contraception,
            only when the feature is enabled — same gating as the
            SummaryRows above and the Healthcare sub-tab itself. */}
        {/* CHANGED — real ask: "menstrual icon is blood/single
            raindrop, in a red. Contraceptive is either condom, baby,
            upsidedown anchor or round pill." One combined button
            couldn't carry two distinct icons — split into its own
            period (red Drop) and contraception (round Pill, matching
            the user's own suggested option) shortcut, each landing on
            the right inner tab of the same module — see
            SHOS_MenstrualHealth_Prototype.jsx's own quickAddTarget
            handling for how "menstrualContraception" is distinguished
            from plain "menstrualHealth". */}
        {menstrualTrackingEnabled && (
          <>
            <QuickAddButton icon={Drop} label="Log period" color={ACTION.red} onClick={() => onQuickAdd("healthcare", "menstrualHealth")} />
            <QuickAddButton icon={Pill} label="Log contraception" color={ACCENTS.healthcare} onClick={() => onQuickAdd("healthcare", "menstrualContraception")} />
          </>
        )}
      </div>

      {/* ADDED 19 Aug 2026 — real ask: a backup reminder. No cloud
          sync by design (everything stays on-device) means a real
          backup is the only actual safety net — this makes it visible
          rather than silently relying on the user remembering. Tapping it
          opens Settings, same screen Export already lives in, rather
          than trying to export directly from Home. Kept as its own
          full-width row, deliberately NOT folded into the shortcuts
          row above — this is an alert, a different kind of thing from
          a navigation shortcut, and shouldn't visually blend in with
          them. */}
      {backupInfo.dueForReminder && (
        <div onClick={onOpenSettings} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8, padding: "12px 16px", borderRadius: 16, border: "1px solid #F59E0B40", background: "#FFF7ED", cursor: "pointer" }}>
          <Database size={15} color="#B45309" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#B45309" }}>
            {backupInfo.lastAt ? `No backup in ${backupInfo.daysSince} days — export one` : "You've never exported a backup — do it now"}
          </span>
        </div>
      )}

      {/* ADDED — real ask: "scheduled auto-export" — a real, one-off
          confirmation that a backup was just written unattended,
          rather than a file silently appearing in Documents with no
          acknowledgement at all. Green/positive, distinct from the
          amber reminder banner above (which means the opposite: you
          need to act) — the two are mutually exclusive in practice
          anyway, since a successful auto-export just reset the same
          clock the reminder banner reads. */}
      {autoExportRan && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8, padding: "12px 16px", borderRadius: 16, border: `1px solid ${ACTION.green}40`, background: darkMode ? DARK.surface : "#F0FDF9" }}>
          <Database size={15} color={ACTION.green} />
          <span style={{ fontSize: 13, fontWeight: 600, color: ACTION.green }}>Backed up automatically — saved to Documents</span>
        </div>
      )}

      {/* ADDED — real ask: "add a check for available updates / notify
          / auto download?" See updateCheckService.js's own comment for
          why this links straight to the real download rather than
          claiming a silent auto-install Android doesn't actually allow
          a sideloaded app to do to itself. Opens in the system browser
          (real <a> tag, target=_blank) so the OS's own download-then-
          tap-to-install flow takes over exactly like tapping the link
          manually would. */}
      {updateInfo.updateAvailable && (
        <a href={RELEASE_APK_URL} target="_blank" rel="noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8, padding: "12px 16px", borderRadius: 16, border: `1px solid ${ACCENTS.home}40`, background: darkMode ? DARK.surface : `${ACCENTS.home}10`, textDecoration: "none" }}>
          <Download size={15} color={ACCENTS.home} />
          <span style={{ fontSize: 13, fontWeight: 600, color: ACCENTS.home }}>Update available ({updateInfo.latestSha}) — tap to download</span>
        </a>
      )}

      {showMyProfile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
          <MyProfileModule onClose={() => setShowMyProfile(false)} registerModuleBackHandler={registerModuleBackHandler} />
        </div>
      )}
      {showClinicCard && <ClinicCardScreen onClose={() => setShowClinicCard(false)} onNavigateToRecord={onNavigateToRecord} onQuickAddWithPrefill={onQuickAddWithPrefill} registerModuleBackHandler={registerModuleBackHandler} />}
      {showTimeline && (
        // FIXED — real bug: this wrapper had no overflowY, and
        // TimelineModule's own screens don't establish their own
        // scroll container either — a populated Episode (several
        // SectionCards, possibly the "Mark resolved" buttons near the
        // bottom) taller than the viewport was simply unreachable, no
        // way to scroll to it at all. Matches every other module's
        // overlay wrapper elsewhere in this file.
        <div style={{ position: "fixed", inset: 0, zIndex: 200, overflowY: "auto" }}>
          <TimelineModule onClose={() => setShowTimeline(false)} registerModuleBackHandler={registerModuleBackHandler} />
        </div>
      )}
    </div>
  );
}

export default HomeScreen;

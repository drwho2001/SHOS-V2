// CalendarScreen — extracted verbatim from src/modules/SHOS_Settings_Prototype.jsx
// (24 Sep 2026 settings split). Behavior unchanged; only the file moved.
import React, { useState, useMemo, useRef, useEffect } from "react";
import { NEUTRAL_DARK as DARK } from "../../calculations/designTokens";
import { WarningIcon as AlertTriangle, CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight, CalendarIcon as Calendar, CloudArrowUpIcon as CloudArrowUp, CloudCheckIcon as CloudCheck, XIcon as X, FunnelIcon as Filter } from "@phosphor-icons/react";
import { ACCENTS, ACTION, NEUTRAL, RADIUS, TYPE } from "../../calculations/designTokens";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useLoadedMemo, useLoadedState } from "../../calculations/loadedRepositoryState";
import { useIsDesktopWidth } from "../../calculations/responsive";
import { EncounterRepository } from "../../repositories/encounterRepository";
import { MedicationRepository } from "../../repositories/medicationRepository";
import { TestingRepository } from "../../repositories/testingRepository";
import { ClinicVisitsRepository } from "../../repositories/clinicVisitsRepository";
import { SymptomLogRepository } from "../../repositories/symptomLogRepository";
import { VaccinationRepository } from "../../repositories/vaccinationRepository";
import { MODULE_LABELS as TRASH_MODULE_LABELS } from "../../repositories/trashRepository";
import { getCalendarEvents, groupEventsByDay } from "../../calculations/calendarCalculations";
import { checkCalendarAvailable, syncClinicVisitsToCalendar, removeAllSyncedEvents, removeSyncedEventsFrom, listAvailableCalendars, SHOS_CALENDAR_NAME } from "../../storage/calendarSyncService";
import { AppPreferencesRepository, DEFAULT_APP_PREFERENCES } from "../../repositories/appPreferencesRepository";

const CALENDAR_MODULE_TARGETS = {
  encounters: { tab: "activity", subTab: null },
  testing: { tab: "healthcare", subTab: "testing" },
  clinicVisits: { tab: "healthcare", subTab: "clinicVisits" },
  vaccinations: { tab: "healthcare", subTab: "vaccinations" },
  symptomLog: { tab: "healthcare", subTab: "symptomLog" },
  medications: { tab: "medication", subTab: null },
};

// FIXED 16 Sep 2026 — real bug: every dot/chip/list-row colour below
// used `ACCENTS[moduleKey]` directly, but `moduleKey` values here are
// "testing"/"clinicVisits"/"vaccinations"/"symptomLog"/"medications" —
// none of which are real ACCENTS keys (only the 5 top-level module
// colours are: contacts/encounters/medication/healthcare/home). Every
// Healthcare sub-type and every medication event was silently falling
// back to the generic grey default, indistinguishable from each other
// — only Encounters ever showed its real colour. Maps each real
// moduleKey to the same accent that module's own screens already use
// elsewhere in the app (the 4 Healthcare sub-tabs all already render
// under ACCENTS.healthcare everywhere else; "medications" plural here
// was simply missing the singular `medication` key). A plain FUNCTION,
// not a baked-in-at-module-load object — ACCENTS' own values can be
// overridden by the user (Colour scheme screen) and this file's
// module-load timing can't assume that override has already applied,
// the exact bug class already found and fixed twice this session for
// Measurements/MenstrualHealth's own LIGHT/DARK constants.
function calendarModuleAccent(moduleKey) {
  return {
    encounters: ACCENTS.encounters,
    testing: ACCENTS.healthcare,
    clinicVisits: ACCENTS.healthcare,
    vaccinations: ACCENTS.healthcare,
    symptomLog: ACCENTS.healthcare,
    medications: ACCENTS.medication,
  }[moduleKey] || "#656568";
}

// ADDED 1 Sep 2026 — real ask, item 2 of the follow-up feature list: a
// lightweight glossary for the clinical shorthand used throughout this
// app (DoxyPEP, TOC, C&S, PEP...) without assuming everyone already
// knows it. Every entry here is a term this app's own UI, calculations,
// or option lists genuinely use elsewhere (TESTING_FOR_OPTIONS,
// doxyPepCalculations.js's own BASHH citations, the seed Timeline
// episode's TOC/C&S usage) — not a generic glossary padded out with
// terms the app doesn't actually surface. Same search pattern as
// Resources (name/definition match, plain function, no fuzzy search
// needed for a list this short).

function CalendarSyncSheet({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const [appPrefs, setAppPrefs] = useLoadedState(() => AppPreferencesRepository.getPreferences(), [], DEFAULT_APP_PREFERENCES);
  const [calendarSyncError, setCalendarSyncError] = useState("");
  const [calendarSyncing, setCalendarSyncing] = useState(false);
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [availableCalendars, setAvailableCalendars] = useState(null);
  const dialogRef = useRef(null);
  useEffect(() => { dialogRef.current?.focus(); }, []);

  // Turning ON does the real device/permission check first (never
  // just flips the flag and hopes), then syncs every currently-booked
  // Clinic Visit right away rather than waiting for the next save.
  // Turning OFF actually removes whatever calendar was in use (and
  // every event this app put there) — see calendarSyncService.js's
  // own comment on why that matters for "never accidentally shared
  // unless deliberately selected".
  const toggleCalendarSync = async () => {
    setCalendarSyncError("");
    if (appPrefs.calendarSyncEnabled) {
      setCalendarSyncing(true);
      await removeAllSyncedEvents();
      await AppPreferencesRepository.update({ calendarSyncEnabled: false, calendarSyncTargetName: null });
      setAppPrefs(await AppPreferencesRepository.getPreferences());
      setShowCalendarPicker(false);
      setCalendarSyncing(false);
      return;
    }
    setCalendarSyncing(true);
    const result = await checkCalendarAvailable();
    if (!result.available) {
      setCalendarSyncError(result.reason || "Calendar access isn't available on this device.");
      setCalendarSyncing(false);
      return;
    }
    await AppPreferencesRepository.update({ calendarSyncEnabled: true });
    setAppPrefs(await AppPreferencesRepository.getPreferences());
    await syncClinicVisitsToCalendar(await ClinicVisitsRepository.getAll());
    setCalendarSyncing(false);
  };

  // Real follow-up ask: "I still want to have the option to share with
  // a calendar... allow sync with warning." Loads whatever real
  // calendars are already on the device (could be empty — no other
  // accounts added here) the first time the picker opens.
  const openCalendarPicker = async () => {
    setShowCalendarPicker(true);
    if (availableCalendars === null) setAvailableCalendars(await listAvailableCalendars());
  };
  // Switching target: clean up whichever calendar was in use before
  // (private or a previously-picked external one), then re-sync into
  // the new one — never leaves a stale copy behind in the old one.
  const selectCalendarTarget = async (name) => {
    setCalendarSyncing(true);
    const previousName = appPrefs.calendarSyncTargetName || SHOS_CALENDAR_NAME;
    await removeSyncedEventsFrom(previousName);
    await AppPreferencesRepository.update({ calendarSyncTargetName: name });
    setAppPrefs(await AppPreferencesRepository.getPreferences());
    await syncClinicVisitsToCalendar(await ClinicVisitsRepository.getAll());
    setShowCalendarPicker(false);
    setCalendarSyncing(false);
  };

  // ADDED — real ask from a security audit finding: an opt-in generic
  // title for synced events, since the real title is free text that
  // can surface on a lock-screen notification independent of the
  // target calendar's own sharing settings (the warning below only
  // covers that second risk). Re-syncs immediately so existing events
  // pick up the new title right away — modifyEvent() (called via
  // syncClinicVisitsToCalendar -> syncOneVisit) matches by the hidden
  // marker in `notes`, not title, so this correctly updates every
  // already-synced event in place rather than needing a remove+recreate
  // the way switching calendars does.
  const toggleGenericTitle = async () => {
    setCalendarSyncing(true);
    await AppPreferencesRepository.update({ calendarSyncGenericTitle: !appPrefs.calendarSyncGenericTitle });
    setAppPrefs(await AppPreferencesRepository.getPreferences());
    await syncClinicVisitsToCalendar(await ClinicVisitsRepository.getAll());
    setCalendarSyncing(false);
  };

  return (
    <div ref={dialogRef} role="dialog" aria-label="Phone calendar sync" style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 300 }} onClick={() => !calendarSyncing && onClose()}>
      <div tabIndex={0} style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, width: "100%", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Phone calendar sync</h1>
          <X size={18} color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} aria-label="Close calendar sync settings" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        </div>

        <div onClick={calendarSyncing ? undefined : toggleCalendarSync} role="switch" tabIndex={0} aria-checked={appPrefs.calendarSyncEnabled} aria-label="Sync clinic appointments to phone calendar"
          onKeyDown={calendarSyncing ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCalendarSync(); } }}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: calendarSyncing ? "default" : "pointer" }}>
          <div style={{ flex: 1, paddingRight: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Sync clinic appointments to phone calendar</div>
            <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginTop: 2 }}>
              Booked appointments appear in your phone's real calendar app. Defaults to its own private "SHOS (private)" calendar — never a synced/shared one, never sent anywhere. Turning this off removes everything this app put there.
            </div>
            {calendarSyncError && <div style={{ fontSize: 11, color: ACTION.red, marginTop: 4 }}>{calendarSyncError}</div>}
          </div>
          <div style={{ width: 40, height: 24, borderRadius: 999, background: appPrefs.calendarSyncEnabled ? ACCENTS.home : (darkMode ? DARK.border : NEUTRAL.border), position: "relative", flexShrink: 0, opacity: calendarSyncing ? 0.6 : 1 }}>
            <div style={{ position: "absolute", top: 2, left: appPrefs.calendarSyncEnabled ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: "#FFFFFF" }} />
          </div>
        </div>

        {appPrefs.calendarSyncEnabled && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
            <div onClick={calendarSyncing ? undefined : openCalendarPicker} role="button" tabIndex={0}
              onKeyDown={calendarSyncing ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCalendarPicker(); } }}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: calendarSyncing ? "default" : "pointer" }}>
              <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>Syncing to:</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: ACCENTS.healthcare }}>{appPrefs.calendarSyncTargetName || SHOS_CALENDAR_NAME} · Change</div>
            </div>
            {/* ADDED — real ask from a security audit finding: the
                real title can surface on a lock-screen notification or
                a synced calendar's own smart features regardless of
                who the calendar is shared with, which the "Not private
                by default" warning below doesn't cover — this is a
                separate, always-relevant risk, so shown regardless of
                which calendar is targeted (private included: a local
                calendar's own reminders still notify on-device). */}
            <div onClick={calendarSyncing ? undefined : toggleGenericTitle} role="switch" tabIndex={0} aria-checked={appPrefs.calendarSyncGenericTitle} aria-label="Use a generic event title"
              onKeyDown={calendarSyncing ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleGenericTitle(); } }}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: calendarSyncing ? "default" : "pointer", marginTop: 14 }}>
              <div style={{ flex: 1, paddingRight: 12 }}>
                <div style={{ fontSize: 12, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Use a generic event title</div>
                <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginTop: 2 }}>
                  "Clinic appointment" instead of this visit's own title — safer if reminders show on your lock screen.
                </div>
              </div>
              <div style={{ width: 40, height: 24, borderRadius: 999, background: appPrefs.calendarSyncGenericTitle ? ACCENTS.home : (darkMode ? DARK.border : NEUTRAL.border), position: "relative", flexShrink: 0, opacity: calendarSyncing ? 0.6 : 1 }}>
                <div style={{ position: "absolute", top: 2, left: appPrefs.calendarSyncGenericTitle ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: "#FFFFFF" }} />
              </div>
            </div>
            {/* Real ask: "not sure if this is something you can force,
                if not allow sync with warning, maybe a link for how to
                keep private for common calendars" — it can't be forced
                (this app has no control over an external calendar's
                own sharing settings), so a real warning plus provider-
                specific guidance shows whenever a non-private target
                is actually in use. */}
            {appPrefs.calendarSyncTargetName && (
              <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: darkMode ? "#3A2A1080" : "#FFF7ED", border: `1px solid ${darkMode ? "#5A3E1080" : "#F59E0B40"}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <AlertTriangle size={14} color={ACTION.gold} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: ACTION.gold }}>Not private by default</span>
                </div>
                <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, lineHeight: 1.5 }}>
                  This app can't control whether "{appPrefs.calendarSyncTargetName}" is shared with anyone else — that's entirely up to how that calendar's own account is set up. If it's a Google Calendar, check it isn't set to "Make available to public" and isn't shared under its own sharing settings. If it's Outlook, check Calendar settings → Shared calendars. If it's Apple/iCloud, check Calendar → Edit → Shared With. When in doubt, switch back to the private "SHOS (private)" calendar above.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Calendar target picker — real device calendars only, loaded
            on first open. Always offers the private default first. */}
        {showCalendarPicker && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, marginBottom: 4 }}>Sync appointments to</div>
            <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 12 }}>Only calendars already on this device — nothing new is ever created except the private option below.</div>
            <div onClick={() => !calendarSyncing && selectCalendarTarget(null)} role="radio" tabIndex={0} aria-checked={!appPrefs.calendarSyncTargetName}
              onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !calendarSyncing) { e.preventDefault(); selectCalendarTarget(null); } }}
              style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${!appPrefs.calendarSyncTargetName ? ACCENTS.healthcare : (darkMode ? DARK.border : NEUTRAL.border)}`, background: !appPrefs.calendarSyncTargetName ? `${ACCENTS.healthcare}10` : "transparent", cursor: "pointer", marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>SHOS (private) — recommended</div>
              <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginTop: 2 }}>On-device only, structurally can't sync or be shared.</div>
            </div>
            {availableCalendars === null && <div style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, textAlign: "center", padding: 10 }}>Loading calendars…</div>}
            {availableCalendars?.length === 0 && (
              <div style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, textAlign: "center", padding: 10 }}>No other calendars found on this device.</div>
            )}
            {availableCalendars?.map((cal) => (
              <div key={cal.id} onClick={() => !calendarSyncing && selectCalendarTarget(cal.name)} role="radio" tabIndex={0} aria-checked={appPrefs.calendarSyncTargetName === cal.name}
                onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !calendarSyncing) { e.preventDefault(); selectCalendarTarget(cal.name); } }}
                style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${appPrefs.calendarSyncTargetName === cal.name ? ACCENTS.healthcare : (darkMode ? DARK.border : NEUTRAL.border)}`, background: appPrefs.calendarSyncTargetName === cal.name ? `${ACCENTS.healthcare}10` : "transparent", cursor: "pointer", marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>{cal.displayName || cal.name}</div>
                <div style={{ fontSize: 11, color: ACTION.gold, marginTop: 2 }}>Not private by default — its own sharing settings apply.</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CalendarScreen({ onClose, onNavigateToRecord }) {
  const [darkMode] = useDarkModePreference();
  const isDesktopWidth = useIsDesktopWidth();
  const dialogRef = useRef(null);
  useEffect(() => { dialogRef.current?.focus(); }, []);

  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDay, setSelectedDay] = useState(null);
  // ADDED — real ask: phone-calendar sync now lives on this screen
  // directly (see CalendarSyncSheet's own comment for why it moved
  // out of Settings -> Privacy) — a header icon, not a settings-menu
  // entry. Re-read fresh each render (not memoized) so the icon's own
  // on/off look stays honest immediately after the sheet changes it.
  const [showSyncSheet, setShowSyncSheet] = useState(false);
  // CHANGED — Phase 2 encryption groundwork: AppPreferencesRepository
  // went async, so the old plain "re-read fresh every render" call
  // (safe only while getPreferences() was synchronous) needed a real
  // dependency instead — showSyncSheet is what actually changes when
  // this value could have, since CalendarSyncSheet is the only place
  // that writes calendarSyncEnabled.
  const syncEnabled = useLoadedMemo(() => AppPreferencesRepository.getPreferences().then((p) => p.calendarSyncEnabled), [showSyncSheet], false);
  // ADDED 26 Aug 2026 — real ask: filters, standard on every other
  // module's list this session — shouldn't have been skipped here.
  const ALL_MODULE_KEYS = ["encounters", "testing", "clinicVisits", "vaccinations", "symptomLog", "medications"];
  const [showFilters, setShowFilters] = useState(false);
  const [activeModules, setActiveModules] = useState(ALL_MODULE_KEYS);
  const toggleModule = (key) => setActiveModules((cur) => cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]);

  const allEvents = useLoadedMemo(async () => getCalendarEvents({
    encounters: await EncounterRepository.getAll(),
    tests: await TestingRepository.getAll(),
    clinicVisits: await ClinicVisitsRepository.getAll(),
    symptomEntries: await SymptomLogRepository.getAll(),
    medications: await MedicationRepository.getAll(),
    vaccinations: await VaccinationRepository.getAll(),
  }), [], []);
  const events = useMemo(() => allEvents.filter((e) => activeModules.includes(e.moduleKey)), [allEvents, activeModules]);
  const grouped = useMemo(() => groupEventsByDay(events), [events]);

  // ADDED — real ask: first day of week preference (Sunday/Monday,
  // default Monday). getDay() is always 0=Sun..6=Sat regardless of
  // preference — when the week starts Monday, shift it so Monday
  // lands in column 0 instead.
  // MOVED 16 Sep 2026 — real ask: this is a Calendar-display setting,
  // not a Measurements unit preference, so it belongs on the screen it
  // actually affects rather than the global Units screen (now removed
  // — see MeasurementPreferencesSheet's own comment for where the
  // remaining unit prefs went instead). Now a real setter, not a
  // read-only useLoadedMemo, since this screen is the one place that
  // changes it.
  const [appPrefsForWeek, setAppPrefsForWeek] = useLoadedState(() => AppPreferencesRepository.getPreferences(), [], DEFAULT_APP_PREFERENCES);
  const weekStartsOn = appPrefsForWeek.weekStartsOn;
  const setWeekStartsOn = async (value) => setAppPrefsForWeek(await AppPreferencesRepository.update({ weekStartsOn: value }));
  const weekStartsMonday = weekStartsOn !== "sunday";
  const WEEKDAY_LABELS = weekStartsMonday
    ? ["M", "T", "W", "T", "F", "S", "S"]
    : ["S", "M", "T", "W", "T", "F", "S"];

  const year = cursor.getFullYear(), month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const rawDay = firstOfMonth.getDay(); // 0=Sun..6=Sat
  const startOffset = weekStartsMonday ? (rawDay + 6) % 7 : rawDay;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  const dayKey = (day) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const selectedEvents = selectedDay ? (grouped[dayKey(selectedDay)] || []) : [];

  const goToEvent = (ev) => {
    const target = CALENDAR_MODULE_TARGETS[ev.moduleKey];
    if (!target) return;
    onNavigateToRecord?.(target.tab, ev.id, target.subTab);
    onClose();
  };

  return (
    <div ref={dialogRef} role="dialog" aria-label="Calendar" tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: darkMode ? DARK.bg : NEUTRAL.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : NEUTRAL.bg, borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label="Back" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
          <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Calendar</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* ADDED — real ask: phone-calendar sync now lives here, an
              icon rather than a settings-menu entry — filled/green
              when on, outline/grey when off, so the icon's own look
              says what state it's in at a glance, not just what it
              does. */}
          <div onClick={() => setShowSyncSheet(true)} style={{ display: "flex", alignItems: "center", cursor: "pointer" }} title="Phone calendar sync">
            {syncEnabled
              ? <CloudCheck size={20} weight="fill" color={ACCENTS.healthcare} />
              : <CloudArrowUp size={20} color={darkMode ? DARK.textSecondary : NEUTRAL.textSecondary} />}
          </div>
          <span role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => setShowFilters((s) => !s)} style={{ fontSize: 12, fontWeight: 600, color: activeModules.length < ALL_MODULE_KEYS.length ? ACCENTS.medication : (darkMode ? DARK.textDisabled : "#5B5B62"), cursor: "pointer" }}>
            Filter{activeModules.length < ALL_MODULE_KEYS.length ? ` (${activeModules.length})` : ""}
          </span>
        </div>
      </div>
      <div style={{ padding: "10px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>Week starts on</span>
        <div role="radiogroup" aria-label="Week starts on" style={{ display: "flex", gap: 6 }}>
          {[{ value: "monday", label: "Mon" }, { value: "sunday", label: "Sun" }].map((opt) => (
            <div key={opt.value} onClick={() => setWeekStartsOn(opt.value)} role="radio" tabIndex={0} aria-checked={weekStartsOn === opt.value}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setWeekStartsOn(opt.value); } }}
              style={{ padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: weekStartsOn === opt.value ? 700 : 400, cursor: "pointer",
                border: `1px solid ${weekStartsOn === opt.value ? ACCENTS.healthcare : (darkMode ? DARK.border : NEUTRAL.border)}`,
                color: weekStartsOn === opt.value ? "#FFFFFF" : (darkMode ? DARK.textSecondary : NEUTRAL.textSecondary),
                background: weekStartsOn === opt.value ? ACCENTS.healthcare : "transparent" }}>
              {opt.label}
            </div>
          ))}
        </div>
      </div>
      {showFilters && (
        <div style={{ padding: "10px 16px 0", display: "flex", flexWrap: "wrap", gap: 6, background: darkMode ? DARK.bg : NEUTRAL.bg, borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), paddingBottom: 10 }}>
          {ALL_MODULE_KEYS.map((key) => {
            const active = activeModules.includes(key);
            return (
              // FIXED 1 Sep 2026 — real bug found during the same
              // light/dark sweep as the day-number fix above: the
              // inactive-chip border/dot/text were hardcoded to
              // light-mode colors (#DCDCE1/#656568) regardless of
              // theme — nearly invisible against DARK.bg, unlike the
              // active chip (module accent, already theme-agnostic).
              <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} key={key} onClick={() => toggleModule(key)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? calendarModuleAccent(key) : (darkMode ? DARK.border : NEUTRAL.border)}`, color: active ? calendarModuleAccent(key) : (darkMode ? DARK.textDisabled : NEUTRAL.textDisabled), background: active ? `${calendarModuleAccent(key)}15` : "transparent" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: active ? calendarModuleAccent(key) : (darkMode ? DARK.textDisabled : NEUTRAL.textDisabled) }} />
                {TRASH_MODULE_LABELS[key]}
              </div>
            );
          })}
        </div>
      )}
      {/* ADDED — real audit finding (desktop full-width sweep): the
          month grid itself has no width cap, so at 1600px each day
          cell becomes a huge, sparse square. Caps and centers the
          whole calendar body on desktop — it's already a real grid,
          just an unconstrained one — mobile untouched. */}
      <div style={isDesktopWidth ? { padding: 16, maxWidth: 760, margin: "0 auto" } : { padding: 16 }}>
        {/* CHANGED — real ask: "doesn't have to exist in a settings
            menu, can exist as icon" — this used to be a dismissible
            hint banner pointing at Settings -> Privacy; now the header
            icon above IS the entry point (and its own filled/outline
            look already says whether sync is on), so a second, more
            intrusive banner here would just be redundant. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <ChevronLeft size={20} color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} style={{ cursor: "pointer" }} onClick={() => { setCursor(new Date(year, month - 1, 1)); setSelectedDay(null); }} role="button" tabIndex={0} aria-label="Previous month" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>{cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
          <ChevronRight size={20} color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} style={{ cursor: "pointer" }} onClick={() => { setCursor(new Date(year, month + 1, 1)); setSelectedDay(null); }} role="button" tabIndex={0} aria-label="Next month" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
          {WEEKDAY_LABELS.map((d, i) => (
            <div key={i} style={{ textAlign: "center", fontSize: 11, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, fontWeight: 700, padding: "4px 0" }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const key = dayKey(day);
            const dayEvents = grouped[key] || [];
            const isToday = key === todayKey;
            const isSelected = selectedDay === day;
            // CHANGED 16 Sep 2026 — real ask: keep different-module dots
            // side by side (still capped at 3 columns, same as before,
            // so a busy day can't take over the cell), but when a
            // SINGLE module has multiple events that day (e.g. several
            // Encounters), stack that module's own dots vertically
            // instead of collapsing them into one dot — capped at 3
            // per column, same reasoning.
            const moduleEventGroups = Object.entries(
              dayEvents.reduce((acc, e) => {
                (acc[e.moduleKey] ||= []).push(e);
                return acc;
              }, {})
            ).slice(0, 3);
            return (
              <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} key={i} onClick={() => setSelectedDay(isSelected ? null : day)}
                style={{ aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 8, cursor: "pointer", background: isSelected ? "#1B1B1F" : isToday ? (darkMode ? DARK.surfaceVariant : NEUTRAL.surfaceVariant) : "transparent", gap: 2 }}>
                {/* FIXED 1 Sep 2026 — real bug found during a light/dark
                    sweep: every day number was hardcoded to #1B1B1F
                    (near-black) regardless of theme — nearly invisible
                    against DARK.bg, with only today's cell readable by
                    accident (its own light highlight background gave
                    the dark text something to contrast against). */}
                <span style={{ fontSize: 12, color: isSelected ? "#FFFFFF" : (darkMode ? DARK.textPrimary : NEUTRAL.textPrimary), fontWeight: isToday ? 700 : 400 }}>{day}</span>
                {moduleEventGroups.length > 0 && (
                  <div style={{ display: "flex", gap: 3, alignItems: "flex-end" }}>
                    {moduleEventGroups.map(([moduleKey, events]) => {
                      const color = calendarModuleAccent(moduleKey);
                      return (
                        <div key={moduleKey} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          {Array.from({ length: Math.min(events.length, 3) }).map((_, j) => (
                            <div key={j} style={{ width: 4, height: 4, borderRadius: "50%", background: color }} />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selectedDay && (
          <div style={{ marginTop: 20 }}>
            <div style={{ ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, marginBottom: 8 }}>
              {new Date(year, month, selectedDay).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            </div>
            {selectedEvents.length === 0 ? (
              <div style={{ fontSize: 13, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, fontStyle: "italic" }}>Nothing logged this day.</div>
            ) : (
              <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, overflow: "hidden" }}>
                {selectedEvents.map((ev, i) => (
                  <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} key={i} onClick={() => goToEvent(ev)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: i < selectedEvents.length - 1 ? `1px solid ${darkMode ? DARK.border : NEUTRAL.border}` : "none", cursor: "pointer" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: calendarModuleAccent(ev.moduleKey), flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
                      <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled }}>{TRASH_MODULE_LABELS[ev.moduleKey] || ev.moduleKey}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {showSyncSheet && <CalendarSyncSheet onClose={() => setShowSyncSheet(false)} />}
    </div>
  );
}


export default CalendarScreen;

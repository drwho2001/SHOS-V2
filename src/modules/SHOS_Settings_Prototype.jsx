import { NEUTRAL_DARK as DARK } from "../calculations/designTokens";
// SHOS_Settings_Prototype.jsx
//
// ADDED — real architecture extraction, per GPT's own "app shell"
// review (accepted with its explicit caveat: audit first, preserve
// functionality, no wholesale rewrite for its own sake). The real
// audit finding: App.jsx contained 6 full feature screens that don't
// belong in what's supposed to be routing/global-state shell code —
// this file is the entire Settings sub-tree (Export, Developer Tools,
// Registries, Privacy, Preferences, and the top-level Settings screen
// itself) moved out as ONE unit, since they're only ever reached from
// one place and share real context with each other. Pure code motion
// — every line of actual behavior below is unchanged from what was
// working in App.jsx; only the file it lives in has changed.
import React, { useState, useMemo, useEffect, useRef } from "react";
import packageJson from "../../package.json";
const APP_VERSION = packageJson.version;
import {
  WarningIcon as AlertTriangle, CheckIcon as Check, CaretLeftIcon as ChevronLeft,
  CaretRightIcon as ChevronRight, EyeIcon as Eye, EyeSlashIcon as EyeOff,
  ListChecksIcon as ClipboardCheck, DatabaseIcon as Database, DownloadSimpleIcon as Download,
  FireIcon as Flame, TreeStructureIcon as ListTree, MicroscopeIcon as Microscope,
  PillIcon as Pill, GearIcon as SettingsIcon, ShieldIcon as Shield,
  StethoscopeIcon as Stethoscope, TrashIcon as Trash2, UploadSimpleIcon as Upload, UserIcon as User,
  TagIcon as Palette, ArrowUUpLeftIcon as ResetIcon, CalendarIcon as Calendar,
  FileCsvIcon as FileCsv, LockIcon as Lock, BellIcon as Bell,
  CloudArrowUpIcon as CloudArrowUp, CloudCheckIcon as CloudCheck,
  LifebuoyIcon as LifeBuoy, BookOpenTextIcon as BookOpen,
  SlidersHorizontalIcon as SlidersHorizontal, MapPinIcon as MapPin, XIcon as X,
  RulerIcon as Ruler, WifiHighIcon as WifiHigh, LinkBreakIcon as LinkBreak,
} from "@phosphor-icons/react";
// FIXED 1 Sep 2026 — real ask: "Managed lists crashes app on
// attempting to open" / "Same for resources [crashes], in light [mode]
// but not dark". Root cause: NEUTRAL was used throughout this file
// (ManageListsScreen, ResourceEntryRow, ResourceCategory, and the
// clinical-justifications screen below) as the light-mode token
// object, but only NEUTRAL_DARK was ever imported — a real
// ReferenceError, only thrown once the `darkMode ? DARK : NEUTRAL`
// ternary actually evaluated the NEUTRAL branch, i.e. in light mode.
import { ACCENTS, ACTION, NEUTRAL, RADIUS, TYPE, resolveDarkAccent } from "../calculations/designTokens";
import { ModuleColorRepository, CUSTOMIZABLE_MODULE_KEYS, CUSTOMIZABLE_ACTION_KEYS } from "../repositories/moduleColorRepository";
import { computeAdherence } from "../calculations/medicationCalculations";
import { isQualifyingEncounter, DOXYPEP_WINDOW_HOURS, findDoxyPepMedication } from "../calculations/doxyPepCalculations";
import {
  getActivitiesPerMonth, getTopKinks, getTestingFrequencyStats, BASHH_TESTING_INTERVAL_DAYS, BASHH_TESTING_SOURCE_URL,
  getOverallAdherence, getDoxyPepComplianceRate, getContactsAddedPerMonth, getTestingIntervalTrend,
  getAdherenceTrend, getTopSymptoms, getClinicVisitStats, getClinicVisitsPerMonth,
} from "../calculations/statsCalculations";
import { useDarkModePreference } from "../calculations/darkModePreference";
import { useLoadedMemo, useLoadedState } from "../calculations/loadedRepositoryState";
import { exportBackup, exportEncryptedBackup, exportBackupToChosenFolder, exportEncryptedBackupToChosenFolder, EXPORT_GROUPS, getLastBackupInfo, hasUnbackedChanges } from "../storage/backupService";
import { isChooseFolderExportAvailable } from "../storage/fileExportHelper";
import { exportRecordsAsCSV } from "../storage/csvExportService";
import { localStorageAdapter } from "../storage/storageAdapter";
import { computeKinkUsage, computeChemsUsage, computeProtectionUsage, computeSymptomsUsage, computeOrganismUsage, computeResultsUsage, computeLocationsUsage } from "../calculations/registryUsage";
import { findOrphanReferences } from "../calculations/orphanReferenceCheck";
import { LOCATION_TYPE_OPTIONS } from "../repositories/locationsRepository";
import { ContactRepository } from "../repositories/contactRepository";
import { EncounterRepository } from "../repositories/encounterRepository";
import { MedicationRepository } from "../repositories/medicationRepository";
import { LogRepository } from "../repositories/logRepository";
import { TestingRepository } from "../repositories/testingRepository";
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository";
import { SymptomLogRepository } from "../repositories/symptomLogRepository";
import { VaccinationRepository } from "../repositories/vaccinationRepository";
import { MeasurementRepository, getAvailableUnits, getDefaultUnit } from "../repositories/measurementRepository";
import { MeasurementPreferencesRepository, DEFAULT_MEASUREMENT_PREFERENCES } from "../repositories/measurementPreferencesRepository";
import { TrashRepository, MODULE_LABELS as TRASH_MODULE_LABELS } from "../repositories/trashRepository";
import { getCalendarEvents, groupEventsByDay } from "../calculations/calendarCalculations";
import { LocationsRepository } from "../repositories/locationsRepository";
import { PrivacySettingsRepository, DEFAULT_PRIVACY_SETTINGS } from "../repositories/privacySettingsRepository";
import { NotificationPreferencesRepository, isPaused } from "../repositories/notificationPreferencesRepository";
import { NotificationHistoryRepository } from "../repositories/notificationHistoryRepository";
import { getDeferredInstallPrompt, onInstallPromptAvailable, triggerInstallPrompt } from "../storage/installPromptService";
import { MedicationPreferencesRepository } from "../repositories/medicationPreferencesRepository";
import { syncDoxyPepAlert } from "../calculations/doxyPepSync";
import { checkNotificationPermission, requestNotificationPermission, sendTestNotification, TEST_NOTIFICATION_DELAY_MS, checkExactAlarmPermission, requestExactAlarmPermission, getNotificationPlatform, isIOS, isStandalone, checkNativeBridgeHealth } from "../storage/notificationService";
import { syncMedicationReminders } from "../calculations/medicationReminderSync";
import { syncTestingReminder } from "../calculations/testingReminderSync";
import { syncRefillReminder } from "../calculations/refillReminderSync";
import { syncClinicVisitReminders } from "../calculations/clinicVisitReminderSync";
import { checkBiometryAvailable } from "../storage/biometricAuthService";
import { checkCalendarAvailable, syncClinicVisitsToCalendar, removeAllSyncedEvents, removeSyncedEventsFrom, listAvailableCalendars, SHOS_CALENDAR_NAME } from "../storage/calendarSyncService";
import { AppPreferencesRepository, DEFAULT_APP_PREFERENCES } from "../repositories/appPreferencesRepository";
import { EpisodeRepository } from "../repositories/episodeRepository";
import { KinkRegistry } from "../registries/kinkRegistry";
import { ChemsRegistry } from "../registries/chemsRegistry";
import { ProtectionRegistry } from "../registries/protectionRegistry";
import { SymptomsRegistry } from "../registries/symptomsRegistry";
import { OrganismRegistry } from "../registries/organismRegistry";
import { ResultsRegistry } from "../registries/resultsRegistry";
import MyProfileModule from "./SHOS_MyProfile_Prototype";
import RegistryManagementScreen from "./SHOS_RegistryManagement_Prototype";
import { OptionListDetail, ICON_COMPONENTS as OPTION_LIST_ICON_COMPONENTS } from "./SHOS_OptionListEditor_Prototype";
import { CustomOptionListsRepository, OPTION_LIST_LABELS, OPTION_LIST_ICONS } from "../repositories/customOptionListsRepository";
import { ResourcesRepository, CATEGORY_LABELS as RESOURCE_CATEGORY_LABELS } from "../repositories/resourcesRepository";

function SelectiveExportSheet({ onClose, onExported }) {
  const [darkMode] = useDarkModePreference();

  // All items checked by default — "everything, but deselectable",
  // exactly as asked, rather than starting from nothing and making
  // The user build the full set back up by hand every time.
  const allKeys = EXPORT_GROUPS.flatMap((g) => g.items.map((i) => i.dataKey));
  const [checked, setChecked] = useState(() => new Set(allKeys));
  // ADDED 1 Sep 2026 — real ask, item 3 of the follow-up feature list:
  // a date-range filter, distinct from the data-type checkboxes above.
  // Both optional and independent — either one alone still narrows the
  // export. Only applies to dated event records (see backupService.js's
  // own DATE_FIELD_BY_KEY comment for exactly which dataKeys that is
  // and why registries/config are deliberately excluded from it).
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  // ADDED — real ask: an explicit "choose exactly where this goes"
  // option, alongside the default Share-sheet export above. Checked
  // once on mount rather than assumed available — see
  // fileExportHelper.js's isChooseFolderExportAvailable for why this
  // can be false (older Android, or a browser with no native save-
  // dialog support).
  const [chooseFolderAvailable, setChooseFolderAvailable] = useState(false);
  const [folderExportStatus, setFolderExportStatus] = useState(null);
  useEffect(() => { isChooseFolderExportAvailable().then(setChooseFolderAvailable); }, []);

  const isGroupFullyChecked = (group) => group.items.every((i) => checked.has(i.dataKey));
  const isGroupPartiallyChecked = (group) => group.items.some((i) => checked.has(i.dataKey)) && !isGroupFullyChecked(group);

  const toggleItem = (dataKey) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) next.delete(dataKey);
      else next.add(dataKey);
      return next;
    });
  };
  const toggleGroup = (group) => {
    const shouldCheck = !isGroupFullyChecked(group);
    setChecked((prev) => {
      const next = new Set(prev);
      group.items.forEach((i) => (shouldCheck ? next.add(i.dataKey) : next.delete(i.dataKey)));
      return next;
    });
  };

  const doExport = async () => {
    const dateRange = (dateFrom || dateTo) ? { from: dateFrom || null, to: dateTo || null } : null;
    // CHANGED — real gap found in the same pass as adding round-trip
    // verification (backupService.js's own verifyBackupJson()):
    // exportBackup() can now genuinely throw, and this used to call it
    // fire-and-forget then close immediately regardless — an
    // unhandled rejection, and a failure the user would never see.
    // Now awaited, and the sheet only closes on real success.
    try {
      await exportBackup(checked.size === allKeys.length ? null : Array.from(checked), dateRange);
      onExported?.();
      onClose();
    } catch (err) {
      setFolderExportStatus({ msg: err.message, ok: false });
    }
  };
  const doExportToFolder = async () => {
    setFolderExportStatus({ msg: "Choose a folder…", ok: null });
    const dateRange = (dateFrom || dateTo) ? { from: dateFrom || null, to: dateTo || null } : null;
    const result = await exportBackupToChosenFolder(checked.size === allKeys.length ? null : Array.from(checked), dateRange);
    if (result.ok) {
      setFolderExportStatus({ msg: `Saved to ${result.path}`, ok: true });
      onExported?.();
    } else if (result.reason === "cancelled") {
      setFolderExportStatus(null);
    } else {
      setFolderExportStatus({ msg: "Couldn't save there — try Export instead.", ok: false });
    }
  };

  // FIXED 1 Sep 2026 — real bug found during a light/dark sweep: the
  // unchecked ("empty") state's background was hardcoded #FFFFFF
  // regardless of theme — a stark white square in an otherwise dark
  // sheet. Same fix mirrored below in EncryptedExportSheet's own
  // copy of this component.
  const Box = ({ state }) => (
    <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${state === "empty" ? (darkMode ? DARK.border : "#656568") : ACCENTS.healthcare}`, background: state === "full" ? ACCENTS.healthcare : state === "partial" ? "#C7D5F7" : (darkMode ? DARK.surfaceVariant : "#FFFFFF"), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {state === "full" && <Check size={12} color="#FFFFFF" weight="bold" />}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 220 }} onClick={onClose}>
      <div style={{ background: darkMode ? DARK.bg : "#F0F0F3", width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", borderTopLeftRadius: 24, borderTopRightRadius: 24, fontFamily: "'Inter', sans-serif" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 20px 4px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 16, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Export — choose what to include</span>
              <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 4 }}>Everything is included by default. Untick anything you'd rather leave out of this particular file.</div>
            </div>
            {/* ADDED 1 Sep 2026 — real ask: "option to select all... rather
                than manual 1 by 1" — before this, reselecting everything
                after deselecting some meant tapping every group's own
                checkbox one at a time. One tap for the whole list now. */}
            <span onClick={() => setChecked(checked.size === allKeys.length ? new Set() : new Set(allKeys))}
              style={{ fontSize: 12, fontWeight: 600, color: ACCENTS.healthcare, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, marginTop: 2 }}>
              {checked.size === allKeys.length ? "Deselect all" : "Select all"}
            </span>
          </div>
        </div>
        <div style={{ overflowY: "auto", padding: "8px 20px", flex: 1 }}>
          {EXPORT_GROUPS.map((group) => (
            <div key={group.key} style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, marginBottom: 10, overflow: "hidden" }}>
              <div onClick={() => toggleGroup(group)} role="checkbox" tabIndex={0}
                aria-checked={isGroupFullyChecked(group) ? true : isGroupPartiallyChecked(group) ? "mixed" : false} aria-label={group.label}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleGroup(group); } }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer", borderBottom: group.items.length > 1 ? "1px solid #DCDCE1" : "none" }}>
                <Box state={isGroupFullyChecked(group) ? "full" : isGroupPartiallyChecked(group) ? "partial" : "empty"} />
                <span style={{ fontSize: 14, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>{group.label}</span>
              </div>
              {group.items.length > 1 && group.items.map((item) => (
                <div key={item.dataKey} onClick={() => toggleItem(item.dataKey)} role="checkbox" tabIndex={0} aria-checked={checked.has(item.dataKey)} aria-label={item.label}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleItem(item.dataKey); } }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px 9px 34px", cursor: "pointer" }}>
                  <Box state={checked.has(item.dataKey) ? "full" : "empty"} />
                  <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>{item.label}</span>
                </div>
              ))}
            </div>
          ))}
          {/* ADDED 1 Sep 2026 — real ask: date-range filter. */}
          <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, marginBottom: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F", marginBottom: 4 }}>Date range (optional)</div>
            <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : "#656568", marginBottom: 10 }}>
              Only narrows dated records (Contacts, Encounters, Medications, Testing, Clinic Visits, Symptom Log, Vaccinations, Timeline). Registries and app settings are always included in full.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 4 }}>From</div>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 13, boxSizing: "border-box", background: darkMode ? DARK.surfaceVariant : "#F0F0F3", color: darkMode ? DARK.textPrimary : "#1B1B1F" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 4 }}>To</div>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 13, boxSizing: "border-box", background: darkMode ? DARK.surfaceVariant : "#F0F0F3", color: darkMode ? DARK.textPrimary : "#1B1B1F" }} />
              </div>
            </div>
            {(dateFrom || dateTo) && (
              <div onClick={() => { setDateFrom(""); setDateTo(""); }} style={{ fontSize: 11, color: ACCENTS.healthcare, marginTop: 8, cursor: "pointer" }}>Clear date range</div>
            )}
          </div>
        </div>
        <div style={{ padding: "14px 20px", borderTop: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", flexShrink: 0 }}>
          {folderExportStatus && (
            <div style={{ fontSize: 12, color: folderExportStatus.ok === false ? ACTION.red : (darkMode ? DARK.textSecondary : "#5B5B62"), marginBottom: 8, textAlign: "center" }}>{folderExportStatus.msg}</div>
          )}
          <button onClick={doExport} disabled={checked.size === 0}
            style={{ width: "100%", padding: 16, borderRadius: 999, border: "none", background: checked.size === 0 ? "#656568" : ACCENTS.healthcare, color: "#FFFFFF", fontSize: 16, fontWeight: 700, cursor: checked.size === 0 ? "default" : "pointer" }}>
            {checked.size === allKeys.length && !dateFrom && !dateTo ? "Export everything" : `Export selected (${checked.size} of ${allKeys.length})`}
          </button>
          {/* ADDED — real ask: an explicit choose-a-folder alternative
              to the Share-sheet button above. */}
          {chooseFolderAvailable && (
            <div onClick={doExportToFolder} style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: ACCENTS.healthcare, cursor: "pointer", padding: "10px 0 0" }}>
              Choose a folder instead…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ADDED — real ask: "CSV next". Reuses EXPORT_GROUPS' own grouping
// (same source of truth as Selective export above) but excludes the
// two groups that aren't lists of records — My Profile (a singleton)
// and App settings (custom option lists / privacy settings, which are
// simple key-value config, not spreadsheet-shaped data). Deliberately
// one tap = one CSV file, not a multi-select like Selective export:
// each record type has a genuinely different column shape, so there's
// no single sensible "combined" CSV to build toward.
const CSV_EXPORT_GROUPS = EXPORT_GROUPS.filter((g) => g.key !== "profile" && g.key !== "appSettings");

function CSVExportSheet({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const [status, setStatus] = useState(null);
  // ADDED 1 Sep 2026 — real ask, item 3 of the follow-up feature list
  // completed: same optional date-range filter Selective/Encrypted
  // export already have, applied to whichever record type gets tapped.
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const doExport = async (item) => {
    setStatus({ dataKey: item.dataKey, msg: "Exporting…", ok: null });
    try {
      const dateRange = (dateFrom || dateTo) ? { from: dateFrom || null, to: dateTo || null } : null;
      await exportRecordsAsCSV(item.dataKey, item.label, dateRange);
      setStatus({ dataKey: item.dataKey, msg: `${item.label} exported.`, ok: true });
    } catch (err) {
      setStatus({ dataKey: item.dataKey, msg: err.message, ok: false });
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 220 }} onClick={onClose}>
      <div style={{ background: darkMode ? DARK.bg : "#F0F0F3", width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", borderTopLeftRadius: 24, borderTopRightRadius: 24, fontFamily: "'Inter', sans-serif" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 20px 4px", flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 16, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Export as CSV</span>
          <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 4 }}>Pick one record type — spreadsheet-readable (Excel, Sheets), for reading elsewhere, not for restoring into SHOS itself (use a backup for that).</div>
        </div>
        <div style={{ overflowY: "auto", padding: "8px 20px 20px", flex: 1 }}>
          <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, marginBottom: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F", marginBottom: 4 }}>Date range (optional)</div>
            <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : "#656568", marginBottom: 10 }}>
              Only narrows dated records — applies whichever record type you tap below.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 4 }}>From</div>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 13, boxSizing: "border-box", background: darkMode ? DARK.surfaceVariant : "#F0F0F3", color: darkMode ? DARK.textPrimary : "#1B1B1F" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 4 }}>To</div>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 13, boxSizing: "border-box", background: darkMode ? DARK.surfaceVariant : "#F0F0F3", color: darkMode ? DARK.textPrimary : "#1B1B1F" }} />
              </div>
            </div>
            {(dateFrom || dateTo) && (
              <div onClick={() => { setDateFrom(""); setDateTo(""); }} style={{ fontSize: 11, color: ACCENTS.healthcare, marginTop: 8, cursor: "pointer" }}>Clear date range</div>
            )}
          </div>
          {CSV_EXPORT_GROUPS.map((group) => (
            <div key={group.key} style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, marginBottom: 10, overflow: "hidden" }}>
              <div style={{ padding: "12px 14px 6px", ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : "#656568" }}>{group.label}</div>
              {group.items.map((item) => (
                <div key={item.dataKey} onClick={() => doExport(item)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", cursor: "pointer", borderTop: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
                  <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>{item.label}</span>
                  {status?.dataKey === item.dataKey ? (
                    <span style={{ fontSize: 11, color: status.ok === false ? ACTION.red : status.ok ? ACTION.green : (darkMode ? DARK.textDisabled : "#656568") }}>{status.msg}</span>
                  ) : (
                    <FileCsv size={16} color={darkMode ? DARK.textDisabled : "#656568"} />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ADDED — real ask: password-protected backup export, for anyone who
// wants to store or send a backup somewhere less trusted than their
// own device without the plain, fully-readable JSON. Real AES-256-GCM
// encryption via the Web Crypto API (see backupService.js's own
// comment on buildEncryptedBackup for the full reasoning) — this
// sheet is only the password entry + confirm UI on top of it. Same
// "everything included by default, choose what to leave out" scope as
// the plain Selective export sheet, reusing EXPORT_GROUPS/checked-set
// logic rather than a second copy of it.
function EncryptedExportSheet({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const allKeys = EXPORT_GROUPS.flatMap((g) => g.items.map((i) => i.dataKey));
  const [checked, setChecked] = useState(() => new Set(allKeys));
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  // ADDED 1 Sep 2026 — real ask, item 3 of the follow-up feature list —
  // same date-range filter as the plain Selective export sheet.
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  // ADDED — real ask: same explicit choose-a-folder option the plain
  // Selective export sheet has — see that sheet's own comment.
  const [chooseFolderAvailable, setChooseFolderAvailable] = useState(false);
  const [folderExportStatus, setFolderExportStatus] = useState(null);
  useEffect(() => { isChooseFolderExportAvailable().then(setChooseFolderAvailable); }, []);

  const isGroupFullyChecked = (group) => group.items.every((i) => checked.has(i.dataKey));
  const isGroupPartiallyChecked = (group) => group.items.some((i) => checked.has(i.dataKey)) && !isGroupFullyChecked(group);
  const toggleItem = (dataKey) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) next.delete(dataKey); else next.add(dataKey);
      return next;
    });
  };
  const toggleGroup = (group) => {
    const shouldCheck = !isGroupFullyChecked(group);
    setChecked((prev) => {
      const next = new Set(prev);
      group.items.forEach((i) => (shouldCheck ? next.add(i.dataKey) : next.delete(i.dataKey)));
      return next;
    });
  };

  const doExport = async () => {
    setError("");
    if (password.length < 6) { setError("Use at least 6 characters — this is the only thing protecting the file."); return; }
    if (password !== confirmPassword) { setError("Passwords don't match — check both and try again."); return; }
    setExporting(true);
    try {
      const dateRange = (dateFrom || dateTo) ? { from: dateFrom || null, to: dateTo || null } : null;
      await exportEncryptedBackup(password, checked.size === allKeys.length ? null : Array.from(checked), dateRange);
      setPassword(""); setConfirmPassword("");
      onClose();
    } catch (err) {
      setError(err.message || "Encryption failed.");
    } finally {
      setExporting(false);
    }
  };
  const doExportToFolder = async () => {
    setError("");
    if (password.length < 6) { setError("Use at least 6 characters — this is the only thing protecting the file."); return; }
    if (password !== confirmPassword) { setError("Passwords don't match — check both and try again."); return; }
    setExporting(true);
    setFolderExportStatus({ msg: "Choose a folder…", ok: null });
    try {
      const dateRange = (dateFrom || dateTo) ? { from: dateFrom || null, to: dateTo || null } : null;
      const result = await exportEncryptedBackupToChosenFolder(password, checked.size === allKeys.length ? null : Array.from(checked), dateRange);
      if (result.ok) {
        setFolderExportStatus({ msg: `Saved to ${result.path}`, ok: true });
        setPassword(""); setConfirmPassword("");
      } else if (result.reason === "cancelled") {
        setFolderExportStatus(null);
      } else {
        setFolderExportStatus({ msg: "Couldn't save there — try Export encrypted backup instead.", ok: false });
      }
    } catch (err) {
      setFolderExportStatus({ msg: err.message || "Encryption failed.", ok: false });
    } finally {
      setExporting(false);
    }
  };

  const Box = ({ state }) => (
    <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${state === "empty" ? (darkMode ? DARK.border : "#656568") : ACCENTS.healthcare}`, background: state === "full" ? ACCENTS.healthcare : state === "partial" ? "#C7D5F7" : (darkMode ? DARK.surfaceVariant : "#FFFFFF"), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {state === "full" && <Check size={12} color="#FFFFFF" weight="bold" />}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 220 }} onClick={onClose}>
      <div style={{ background: darkMode ? DARK.bg : "#F0F0F3", width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", borderTopLeftRadius: 24, borderTopRightRadius: 24, fontFamily: "'Inter', sans-serif" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 20px 4px", flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 16, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Export encrypted backup</span>
          <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 4 }}>Password-protected — safe to store or send somewhere less trusted than this device. There's no password recovery: forgetting it makes this specific file permanently unreadable.</div>
        </div>
        <div style={{ overflowY: "auto", padding: "8px 20px", flex: 1 }}>
          <div style={{ position: "relative", marginBottom: 8 }}>
            <input value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} type={showPasswords ? "text" : "password"} placeholder="Password (6+ characters)"
              style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 14, boxSizing: "border-box", background: darkMode ? DARK.surface : "#FFFFFF", color: darkMode ? DARK.textPrimary : "#1B1B1F" }} />
            {showPasswords ? <EyeOff size={17} color={darkMode ? DARK.textDisabled : "#656568"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPasswords(false)} />
              : <Eye size={17} color={darkMode ? DARK.textDisabled : "#656568"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPasswords(true)} />}
          </div>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <input value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }} type={showPasswords ? "text" : "password"} placeholder="Confirm password"
              onKeyDown={(e) => { if (e.key === "Enter") doExport(); }}
              style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 14, boxSizing: "border-box", background: darkMode ? DARK.surface : "#FFFFFF", color: darkMode ? DARK.textPrimary : "#1B1B1F" }} />
          </div>
          {error && <div style={{ fontSize: 12, color: ACTION.red, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0 6px" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#656568", textTransform: "uppercase", letterSpacing: 0.5 }}>What to include</span>
            <span onClick={() => setChecked(checked.size === allKeys.length ? new Set() : new Set(allKeys))}
              style={{ fontSize: 12, fontWeight: 600, color: ACCENTS.healthcare, cursor: "pointer" }}>
              {checked.size === allKeys.length ? "Deselect all" : "Select all"}
            </span>
          </div>
          {EXPORT_GROUPS.map((group) => (
            <div key={group.key} style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, marginBottom: 10, overflow: "hidden" }}>
              <div onClick={() => toggleGroup(group)} role="checkbox" tabIndex={0}
                aria-checked={isGroupFullyChecked(group) ? true : isGroupPartiallyChecked(group) ? "mixed" : false} aria-label={group.label}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleGroup(group); } }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer", borderBottom: group.items.length > 1 ? "1px solid #DCDCE1" : "none" }}>
                <Box state={isGroupFullyChecked(group) ? "full" : isGroupPartiallyChecked(group) ? "partial" : "empty"} />
                <span style={{ fontSize: 14, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>{group.label}</span>
              </div>
              {group.items.length > 1 && group.items.map((item) => (
                <div key={item.dataKey} onClick={() => toggleItem(item.dataKey)} role="checkbox" tabIndex={0} aria-checked={checked.has(item.dataKey)} aria-label={item.label}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleItem(item.dataKey); } }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px 9px 34px", cursor: "pointer" }}>
                  <Box state={checked.has(item.dataKey) ? "full" : "empty"} />
                  <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>{item.label}</span>
                </div>
              ))}
            </div>
          ))}
          {/* ADDED 1 Sep 2026 — real ask: date-range filter. */}
          <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, marginBottom: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F", marginBottom: 4 }}>Date range (optional)</div>
            <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : "#656568", marginBottom: 10 }}>
              Only narrows dated records. Registries and app settings are always included in full.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 4 }}>From</div>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 13, boxSizing: "border-box", background: darkMode ? DARK.surfaceVariant : "#F0F0F3", color: darkMode ? DARK.textPrimary : "#1B1B1F" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 4 }}>To</div>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 13, boxSizing: "border-box", background: darkMode ? DARK.surfaceVariant : "#F0F0F3", color: darkMode ? DARK.textPrimary : "#1B1B1F" }} />
              </div>
            </div>
            {(dateFrom || dateTo) && (
              <div onClick={() => { setDateFrom(""); setDateTo(""); }} style={{ fontSize: 11, color: ACCENTS.healthcare, marginTop: 8, cursor: "pointer" }}>Clear date range</div>
            )}
          </div>
        </div>
        <div style={{ padding: "14px 20px", borderTop: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", flexShrink: 0 }}>
          {folderExportStatus && (
            <div style={{ fontSize: 12, color: folderExportStatus.ok === false ? ACTION.red : (darkMode ? DARK.textSecondary : "#5B5B62"), marginBottom: 8, textAlign: "center" }}>{folderExportStatus.msg}</div>
          )}
          <button onClick={doExport} disabled={checked.size === 0 || exporting}
            style={{ width: "100%", padding: 16, borderRadius: 999, border: "none", background: (checked.size === 0 || exporting) ? "#656568" : ACCENTS.healthcare, color: "#FFFFFF", fontSize: 16, fontWeight: 700, cursor: (checked.size === 0 || exporting) ? "default" : "pointer" }}>
            {exporting ? "Encrypting…" : "Export encrypted backup"}
          </button>
          {/* ADDED — real ask: an explicit choose-a-folder alternative
              to the Share-sheet button above. */}
          {chooseFolderAvailable && (
            <div onClick={exporting ? undefined : doExportToFolder} style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: exporting ? (darkMode ? DARK.textDisabled : "#656568") : ACCENTS.healthcare, cursor: exporting ? "default" : "pointer", padding: "10px 0 0" }}>
              Choose a folder instead…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ADDED 19 Aug 2026 — Developer tools, real content instead of the
// honest-but-empty "Not built yet" stub. Deliberately modest scope for
// a single-user prototype: a storage overview (so the user can see at a
// glance whether the app is actually holding what he thinks it's
// holding) and a full reset, which is the one genuinely useful
// "developer tool" this app needs right now. Preferences/Privacy/
// Appearance stay stubbed — those involve real, unresolved design
// forks (what counts as identifiable for the anonymise-mode idea;
// the font/theme system's own cross-cutting refactor already flagged
// as needing its own dedicated session) that shouldn't be guessed at
// just to fill in a Settings row.
// ADDED — real ask: a human-readable size for the storage-usage
// indicator below. Kept local — the only place this app currently
// needs to print a byte count.
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function DeveloperToolsScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();

  const [resetStage, setResetStage] = useState("idle"); // idle -> confirming -> done
  // ADDED — real ask: a storage-usage indicator, cheap given this
  // app's actual mechanics (one device, no server to overflow into,
  // Attachments the one thing that could push toward the browser's
  // localStorage quota over time). See storageAdapter.js's own
  // getStorageUsage() comment for the byte-counting approach.
  const storageUsage = useLoadedMemo(() => localStorageAdapter.getStorageUsage(), [], { totalBytes: 0, byKey: [] });
  const [showStorageBreakdown, setShowStorageBreakdown] = useState(false);
  // ADDED — real ask: a data-integrity sweep for dangling relation-by-
  // ID references (e.g. a hard-deleted Contact an old Encounter's
  // attendeeIds still points at) — see orphanReferenceCheck.js's own
  // header for exactly what this does and doesn't cover. Same "compute
  // once per screen-open, the data's small enough" judgment already
  // applied to Global Search's own index and the Registry duplicate
  // checker.
  const orphans = useLoadedMemo(() => findOrphanReferences(), [], []);
  const [showOrphans, setShowOrphans] = useState(false);
  // ADDED — real groundwork for encryption at rest: hasUnbackedChanges()
  // is now async (see backupService.js's own comment), so this can no
  // longer be called straight in the render body below — a Promise is
  // always truthy, so `{hasUnbackedChanges() && (...)}` would render
  // the warning permanently, regardless of the real answer.
  const unbackedChanges = useLoadedMemo(() => hasUnbackedChanges(), [], false);
  const counts = [
    { label: "Contacts", value: ContactRepository.getAll().length },
    { label: "Encounters", value: EncounterRepository.getAll().length },
    { label: "Medications", value: MedicationRepository.getAll().length },
    { label: "Medication log entries", value: LogRepository.getAll().length },
    { label: "Tests", value: TestingRepository.getAll().length },
    { label: "Clinic visits", value: ClinicVisitsRepository.getAll().length },
    { label: "Symptom Log entries", value: SymptomLogRepository.getAll().length },
    { label: "Vaccinations", value: VaccinationRepository.getAll().length },
    { label: "Timeline episodes", value: EpisodeRepository.getAll().length },
    { label: "Kink Registry entries", value: KinkRegistry.getAll().length },
    { label: "Chems Registry entries", value: ChemsRegistry.getAll().length },
    { label: "Protection Registry entries", value: ProtectionRegistry.getAll().length },
    { label: "Symptoms Registry entries", value: SymptomsRegistry.getAll().length },
    { label: "Locations", value: LocationsRepository.getAll().length },
    { label: "Organism Registry entries", value: OrganismRegistry.getAll().length },
    { label: "Results Registry entries", value: ResultsRegistry.getAll().length },
  ];

  const handleReset = () => {
    localStorageAdapter.clearAllAppData();
    setResetStage("done");
  };

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Developer tools</span>
      </div>

      {/* ADDED — real ask: this never explained what it was actually
          counting. It's a real storage overview (every repository's
          live record count) plus a full reset below — not a
          timeframe-based count, that's a separate, still-outstanding
          Activity filter request. */}
      <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", padding: "10px 16px 0" }}>
        Live record counts across every part of the app's local storage, mainly useful for confirming a backup/restore or migration went as expected.
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#656568", textTransform: "uppercase", letterSpacing: 0.5, padding: "16px 16px 6px" }}>Storage overview</div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, margin: "0 16px 20px", padding: "4px 14px" }}>
        <div onClick={() => setShowStorageBreakdown((s) => !s)} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", cursor: "pointer" }}>
          <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>Local storage used{storageUsage.byKey.length > 0 ? (showStorageBreakdown ? " ▲" : " ▼") : ""}</span>
          <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>{formatBytes(storageUsage.totalBytes)}</span>
        </div>
        {showStorageBreakdown && (
          <div style={{ padding: "6px 0 9px" }}>
            {/* ADDED — real ask: which part is actually big, not just
                the total — Attachments (base64 file data) is the one
                thing in this app that could realistically grow large
                over time, worth being able to see that directly rather
                than guessing. Top 5 keys by size is plenty for "what's
                using the space" without turning this into its own
                screen. */}
            {storageUsage.byKey.slice(0, 5).map((k) => (
              <div key={k.key} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12 }}>
                <span style={{ color: darkMode ? DARK.textDisabled : "#656568", fontFamily: "'JetBrains Mono', monospace" }}>{k.key.replace(/^shos_/, "")}</span>
                <span style={{ color: darkMode ? DARK.textSecondary : "#5B5B62" }}>{formatBytes(k.bytes)}</span>
              </div>
            ))}
          </div>
        )}
        {counts.map((c) => (
          <div key={c.label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
            <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>{c.label}</span>
            <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>{c.value}</span>
          </div>
        ))}
      </div>

      {/* ADDED — real ask: surface dangling relation-by-ID references
          (e.g. an Encounter whose attendeeIds still names a Contact
          that's since been hard-deleted) — nothing else in the app
          currently notices these. Read-only: flags them for a human to
          fix by hand, same "never silently merge/fix" restraint the
          Registry duplicate checker already applies. */}
      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#656568", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 16px 6px" }}>Data integrity</div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, margin: "0 16px 20px", padding: "4px 14px" }}>
        <div onClick={() => orphans.length > 0 && setShowOrphans((s) => !s)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", cursor: orphans.length > 0 ? "pointer" : "default" }}>
          <LinkBreak size={15} color={orphans.length > 0 ? ACTION.red : (darkMode ? DARK.textDisabled : "#656568")} />
          <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62", flex: 1 }}>Broken references</span>
          <span style={{ fontSize: 13, color: orphans.length > 0 ? ACTION.red : (darkMode ? DARK.textPrimary : "#1B1B1F"), fontWeight: 700 }}>
            {orphans.length === 0 ? "None found" : `${orphans.length}${showOrphans ? " ▲" : " ▼"}`}
          </span>
        </div>
        {showOrphans && orphans.length > 0 && (
          <div style={{ padding: "0 0 9px" }}>
            {orphans.map((o, i) => (
              <div key={i} style={{ padding: "8px 0", borderTop: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
                <div style={{ fontSize: 12, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 600 }}>{o.recordType}: {o.recordLabel}</div>
                <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : "#656568", marginTop: 2 }}>
                  its <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{o.field}</span> points at a {o.targetType} that no longer exists (id: {o.danglingId})
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#656568", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 16px 6px" }}>Danger zone</div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: `1px solid ${ACTION.red}`, borderRadius: RADIUS.md, margin: "0 16px 20px", padding: 16 }}>
        {resetStage === "done" ? (
          <div style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>All app data cleared. Reload the app to see the fresh-start state.</div>
        ) : resetStage === "confirming" ? (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 12 }}>
              <AlertTriangle size={16} color={ACTION.red} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>This permanently deletes every contact, encounter, medication, log, test, clinic visit, and registry entry on this device. There's no undo — export a backup first if you're not sure.</div>
            </div>
            {/* ADDED 26 Aug 2026 — real ask: warn explicitly if there
                are genuinely unbacked-up changes, not just a generic
                "back up first" reminder every time regardless of
                whether anything's actually at risk. */}
            {unbackedChanges && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 12, padding: "10px 12px", borderRadius: 10, background: `${ACTION.red}15`, border: `1px solid ${ACTION.red}` }}>
                <AlertTriangle size={14} color={ACTION.red} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 12, color: ACTION.red, fontWeight: 600 }}>You have changes since your last backup that would be lost. Export a backup before continuing.</div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setResetStage("idle")} style={{ flex: 1, padding: 12, borderRadius: 12, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", background: darkMode ? DARK.surface : "#FFFFFF", color: darkMode ? DARK.textSecondary : "#5B5B62", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleReset} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: ACTION.red, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Yes, delete everything</button>
            </div>
          </>
        ) : (
          <div onClick={() => setResetStage("confirming")} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <Trash2 size={17} color={ACTION.red} />
            <span style={{ fontSize: 14, color: ACTION.red, fontWeight: 600 }}>Reset all app data</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ADDED 19 Aug 2026 — Registries picker: the entry point to the 6
// shared Registry Management screens. Colors match Doc 2's real domain
// assignments exactly (Kink=red, Protection=Encounters pink, Chems=
// neutral grey, Symptoms/Organism/Results=Healthcare blue), re-checked
// directly against the doc rather than guessed at.
// ADDED 19 Aug 2026 — real ask: "like in Notion, all options should
// have an emoji and colour theme... clean to infer from" — an icon +
// color per REGISTRY/CATEGORY (matching Notion's own per-database icon
// convention), not per individual entry within a registry (a bigger,
// separate ask — per-value icons for every single Kink/Chem/etc. entry
// would need real UI work letting the user pick one per entry, not done
// here, flagged rather than silently attempted). Organism → Microscope
// is the user's own named example, applied literally.
// ADDED — real gap found in a full-app audit: Locations
// (type/address/notes/relatedContactId, see locationsRepository.js's
// own header for why it isn't one of the 6 above) had no management
// screen at all — Settings only ever showed a static count. Reuses
// this exact screen via the renderExtra escape hatch (see
// SHOS_RegistryManagement_Prototype.jsx) rather than building a whole
// separate screen for one more registry-shaped repository.
function LocationExtraFields({ entry, refresh, T, color }) {
  const [address, setAddress] = useState(entry.address || "");
  const [notes, setNotes] = useState(entry.notes || "");
  const contacts = useLoadedMemo(() => ContactRepository.getAll().filter((c) => !c.isArchived), [], []);
  const setType = (type) => { LocationsRepository.update(entry.id, { type: entry.type === type ? "" : type }); refresh(); };
  const commitAddress = () => { LocationsRepository.update(entry.id, { address: address.trim() }); refresh(); };
  const commitNotes = () => { LocationsRepository.update(entry.id, { notes: notes.trim() }); refresh(); };
  const setRelatedContact = (id) => { LocationsRepository.update(entry.id, { relatedContactId: id }); refresh(); };
  const inputStyle = { width: "100%", padding: "6px 8px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontSize: 13, fontFamily: "'Inter', sans-serif", boxSizing: "border-box", marginBottom: 8 };
  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 4 }}>Type</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
        {LOCATION_TYPE_OPTIONS.map((t) => (
          <div key={t} onClick={() => setType(t)}
            style={{ padding: "4px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${color}`, color: entry.type === t ? "#FFFFFF" : color, background: entry.type === t ? color : "transparent" }}>
            {t}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 4 }}>Address</div>
      <input value={address} onChange={(e) => setAddress(e.target.value)} onBlur={commitAddress} placeholder="Optional" style={inputStyle} />
      <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 4 }}>Related contact</div>
      <select value={entry.relatedContactId || ""} onChange={(e) => setRelatedContact(e.target.value)} style={inputStyle}>
        <option value="">None</option>
        {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 4 }}>Notes</div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={commitNotes} rows={2} placeholder="Optional" style={{ ...inputStyle, marginBottom: 0, resize: "vertical" }} />
    </div>
  );
}

const REGISTRIES = [
  { key: "kink", label: "Kink Registry", registry: KinkRegistry, color: "#E5484D", icon: Flame, computeUsage: computeKinkUsage },
  { key: "protection", label: "Protection Registry", registry: ProtectionRegistry, color: "#E24E9C", icon: Shield, computeUsage: computeProtectionUsage },
  { key: "chems", label: "Chems Registry", registry: ChemsRegistry, color: "#5B5B62", icon: Pill, computeUsage: computeChemsUsage },
  { key: "symptoms", label: "Symptoms Registry", registry: SymptomsRegistry, color: ACCENTS.healthcare, icon: Stethoscope, computeUsage: computeSymptomsUsage },
  { key: "organism", label: "Organism Registry", registry: OrganismRegistry, color: ACCENTS.healthcare, icon: Microscope, computeUsage: computeOrganismUsage },
  { key: "results", label: "Results Registry", registry: ResultsRegistry, color: ACCENTS.healthcare, icon: ClipboardCheck, computeUsage: computeResultsUsage },
  { key: "locations", label: "Locations", registry: LocationsRepository, color: "#E24E9C", icon: MapPin, computeUsage: computeLocationsUsage, renderExtra: LocationExtraFields },
];

// CHANGED 1 Sep 2026 — real ask: "check settings not unnecessarily over
// engineered - combine into similar things if better." Registries and
// Option lists were two separate top-level Settings rows that do the
// exact same conceptual job to anyone using the app — "edit the picker
// choices used across the app" — differing only in an internal
// implementation detail (ID-based registry with a usage count vs a
// flat editable string list) nobody outside this codebase needs to
// see. Combined into one screen with a tab switcher; each tab's own
// row-list body is unchanged, RegistryManagementScreen/OptionListDetail
// still do all the real add/rename/archive work exactly as before —
// this only touches how the two lists are ENTERED, not how they work.
function ManageListsScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : NEUTRAL;
  const [tab, setTab] = useState("registries");
  const [openRegistry, setOpenRegistry] = useState(null);
  const [openOptionList, setOpenOptionList] = useState(null);
  const optionListNames = CustomOptionListsRepository.getAllListNames();

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Manage lists</span>
      </div>
      <div style={{ display: "flex", gap: 8, padding: "12px 16px 0" }}>
        {[["registries", "Registries"], ["options", "Option lists"]].map(([key, label]) => (
          <div key={key} onClick={() => setTab(key)}
            style={{ flex: 1, textAlign: "center", padding: "8px 0", borderRadius: 999, cursor: "pointer", fontSize: 13, fontWeight: 700, background: tab === key ? ACCENTS.healthcare : (darkMode ? DARK.surfaceVariant : "#E8E8EC"), color: tab === key ? "#FFFFFF" : (darkMode ? DARK.textSecondary : "#5B5B62") }}>
            {label}
          </div>
        ))}
      </div>
      {tab === "registries" ? (
        <>
          <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", padding: "10px 16px 0" }}>
            Shared vocabularies used across Contacts, Encounters, Testing, and Clinic Visits — rename or archive an entry directly, rather than only through whichever picker happens to reference it.
          </div>
          <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, margin: "16px 16px 20px", overflow: "hidden" }}>
            {REGISTRIES.map((r) => (
              <div key={r.key} onClick={() => setOpenRegistry(r)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 999, background: `${r.color}1A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <r.icon size={14} color={r.color} />
                  </div>
                  <span style={{ fontSize: 14, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 500 }}>{r.label}</span>
                </div>
                <ChevronRight size={16} color={darkMode ? DARK.textDisabled : "#656568"} />
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", padding: "10px 16px 0" }}>
            Add, rename, or reorder the simple option lists used across the app — no code, no waiting on a rebuild. Changes here are permanent on this device and survive future app updates.
          </div>
          <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, margin: "16px 16px 20px", overflow: "hidden" }}>
            {optionListNames.map((name) => {
              const iconConfig = OPTION_LIST_ICONS[name];
              const IconComponent = iconConfig ? OPTION_LIST_ICON_COMPONENTS[iconConfig.icon] : null;
              return (
                <div key={name} onClick={() => setOpenOptionList(name)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {IconComponent && (
                      <div style={{ width: 28, height: 28, borderRadius: 999, background: `${iconConfig.color}1A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <IconComponent size={14} color={iconConfig.color} />
                      </div>
                    )}
                    <span style={{ fontSize: 14, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 500 }}>{OPTION_LIST_LABELS[name] || name}</span>
                  </div>
                  <span style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : "#656568" }}>{CustomOptionListsRepository.get(name).length} options ›</span>
                </div>
              );
            })}
          </div>
        </>
      )}
      {openRegistry && (
        <RegistryManagementScreen registry={openRegistry.registry} label={openRegistry.label} color={openRegistry.color} computeUsage={openRegistry.computeUsage} renderExtra={openRegistry.renderExtra} onClose={() => setOpenRegistry(null)} />
      )}
      {openOptionList && <OptionListDetail listName={openOptionList} onClose={() => setOpenOptionList(null)} />}
    </div>
  );
}

// ADDED 1 Sep 2026 — real ask: a genuine "no results" state for the
// Resources search, distinct from each individual category quietly
// not rendering. Mirrors ResourceCategory's own per-entry filter
// logic just to answer "did ANY category match" — kept a plain
// function, not a hook, since it only ever runs against the query
// string already in scope, nothing stateful.
function hasAnyResourceMatch(query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return ResourcesRepository.getAllCategoryKeys().some((key) =>
    ResourcesRepository.getEntries(key).some((e) => [e.name, e.link, e.notes].filter(Boolean).some((v) => v.toLowerCase().includes(q)))
  );
}

// ADDED 1 Sep 2026 — real ask: "want resources section in settings
// maybe - domestic violence, contraceptive advice, hrt and trans
// support, charities, clinical justifications used, finding a local
// clinic or ordering... sexual health test postal." See
// resourcesRepository.js's own header for why every entry seeds with a
// real org name but a deliberately blank link/notes field — this
// screen is where the user fills those in themselves.
function ResourceEntryRow({ entry, categoryKey, onChanged, darkMode }) {
  const T = darkMode ? DARK : NEUTRAL;
  const [expanded, setExpanded] = useState(false);
  const [link, setLink] = useState(entry.link);
  const [notes, setNotes] = useState(entry.notes);

  const save = () => {
    ResourcesRepository.updateEntry(categoryKey, entry.id, { link, notes });
    onChanged();
  };
  const remove = () => {
    ResourcesRepository.removeEntry(categoryKey, entry.id);
    onChanged();
  };

  return (
    <div style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
      <div onClick={() => setExpanded((e) => !e)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{entry.name}</div>
          {!expanded && entry.link && <div style={{ fontSize: 11, color: ACCENTS.healthcare, marginTop: 2 }}>{entry.link}</div>}
          {!expanded && !entry.link && <div style={{ fontSize: 11, color: T.textDisabled, fontStyle: "italic", marginTop: 2 }}>No link saved yet — tap to add one</div>}
        </div>
        <ChevronRight size={14} color={T.textDisabled} style={{ transform: expanded ? "rotate(90deg)" : "none" }} />
      </div>
      {expanded && (
        <div style={{ marginTop: 10 }}>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link or phone number"
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box", marginBottom: 8 }} />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box", resize: "vertical", marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={remove} style={{ padding: "8px 14px", borderRadius: 999, border: `1px solid ${ACTION.red}`, background: "transparent", color: ACTION.red, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Remove</button>
            <button onClick={save} style={{ flex: 1, padding: "8px 14px", borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save</button>
          </div>
        </div>
      )}
    </div>
  );
}

// CHANGED 1 Sep 2026 — real ask: a search box, now that a real URL
// population pass took this from 5 near-empty categories to 11 with
// ~30 entries — too long a scroll to find one number by eye anymore.
// Filtering happens here per-category (matches name, link, or notes)
// rather than in ResourcesScreen, so each category keeps owning its
// own entries/refresh state exactly as before; a category with zero
// matches during an active search just doesn't render at all, rather
// than showing an empty card.
function ResourceCategory({ categoryKey, darkMode, query }) {
  const T = darkMode ? DARK : NEUTRAL;
  const [refreshKey, setRefreshKey] = useState(0);
  const [addingName, setAddingName] = useState("");
  // CHANGED 4 Sep 2026 — real groundwork for encryption at rest (see
  // CLAUDE.md's Known Issues / the Notion Development log for the
  // full plan): useLoadedMemo instead of a plain useMemo — same
  // shape/ergonomics, but loads via an effect instead of
  // synchronously, since storage.load() behind getEntries() is
  // slated to become async once real encryption lands. Second real
  // proof point for the shared hook (loadedRepositoryState.js),
  // exercising the deps-driven recompute path specifically —
  // clinicCardVisibilityPreference.js already proved the mount-once
  // path.
  const entries = useLoadedMemo(() => ResourcesRepository.getEntries(categoryKey), [categoryKey, refreshKey], []);
  const refresh = () => setRefreshKey((k) => k + 1);
  const q = query.trim().toLowerCase();
  const filtered = q ? entries.filter((e) => [e.name, e.link, e.notes].filter(Boolean).some((v) => v.toLowerCase().includes(q))) : entries;

  const addEntry = () => {
    if (!addingName.trim()) return;
    ResourcesRepository.addEntry(categoryKey, { name: addingName });
    setAddingName("");
    refresh();
  };

  if (q && filtered.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#656568", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 0 6px" }}>{RESOURCE_CATEGORY_LABELS[categoryKey]}</div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 16, fontSize: 13, color: T.textDisabled }}>Nothing added yet.</div>
        ) : filtered.map((entry) => (
          <ResourceEntryRow key={entry.id} entry={entry} categoryKey={categoryKey} onChanged={refresh} darkMode={darkMode} />
        ))}
        {!q && (
          <div style={{ display: "flex", gap: 8, padding: 12 }}>
            <input value={addingName} onChange={(e) => setAddingName(e.target.value)} placeholder="+ Add your own"
              onKeyDown={(e) => { if (e.key === "Enter") addEntry(); }}
              style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
            <button onClick={addEntry} style={{ padding: "8px 14px", borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Add</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ADDED 1 Sep 2026 — the "clinical justifications used" part of the
// ask. NOT from ResourcesRepository — this is a fixed, read-only
// summary of the real guidance this app's own calculations are
// already built on (exposure windows, DoxyPEP timing, the 90-day
// testing-interval stat), pulled from those files' own citations
// rather than restated from memory. Only ONE clickable link — the
// exact BASHH source URL already stored and used elsewhere in this app
// (Stats screen) — no other link here is invented; guidance without an
// existing verified URL in this codebase is named, not linked.
function ClinicalJustificationsCategory({ darkMode }) {
  const T = darkMode ? DARK : NEUTRAL;
  const items = [
    { title: "STI retesting interval (90 days)", body: "BASHH's 2023 \"Summary Guidance on Testing for STIs\" recommends 3-monthly asymptomatic screening for higher-risk groups; matches CDC's own 3–6 month guidance for PrEP users.", link: BASHH_TESTING_SOURCE_URL },
    { title: "DoxyPEP dosing window", body: "BASHH's 2025 UK national guideline and CDC's 2024 clinical guidance — doxycycline taken within 72 hours after condomless oral, vaginal, or anal sex.", link: null },
    { title: "STI exposure windows", body: "Gathered from current UK sexual-health guidance (BASHH/BHIVA position statements) and NHS-affiliated sexual health services — used to flag when a test is too early to be reliable, not as a diagnosis.", link: null },
  ];
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#656568", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 0 6px" }}>Clinical justifications used</div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, overflow: "hidden" }}>
        <div style={{ fontSize: 11, color: T.textSecondary, padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
          What this app's own calculations (exposure windows, DoxyPEP timing, testing-interval stats) are actually based on — informational, not personalised medical advice.
        </div>
        {items.map((item) => (
          <div key={item.title} style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, marginBottom: 3 }}>{item.title}</div>
            <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.4 }}>{item.body}</div>
            {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: ACCENTS.healthcare, marginTop: 4, display: "inline-block" }}>{item.link}</a>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ResourcesScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : NEUTRAL;
  const [query, setQuery] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Resources</span>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 16, lineHeight: 1.4 }}>
          Real organisations, most with a real link already filled in. Anything still blank is worth adding yourself with a current, verified one rather than trusting a guess for something this important — and any link here is worth double-checking still works before relying on it.
        </div>
        {/* ADDED 1 Sep 2026 — real ask: search, now that this list runs
            to 11 categories and ~30 entries after the real URL
            population pass. Matches name, link, or notes. */}
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search resources"
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box", marginBottom: 16 }} />
        {ResourcesRepository.getAllCategoryKeys().map((key) => (
          <ResourceCategory key={key} categoryKey={key} darkMode={darkMode} query={query} />
        ))}
        {!query.trim() && <ClinicalJustificationsCategory darkMode={darkMode} />}
        {query.trim() && !hasAnyResourceMatch(query) && (
          <div style={{ textAlign: "center", padding: "24px 16px", color: T.textDisabled, fontSize: 13 }}>No resources match your search.</div>
        )}
      </div>
    </div>
  );
}

// ADDED 19 Aug 2026 — Privacy screen: Anonymise mode. Real, scoped ask
// from the user, not the earlier vague "what counts as identifiable"
// unknown — see privacySettingsRepository.js for the full reasoning
// and exact field-tier list.
function PrivacyScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();

  const [settings, setSettings] = useLoadedState(() => PrivacySettingsRepository.getSettings(), [], DEFAULT_PRIVACY_SETTINGS);
  const [pinEntry, setPinEntry] = useState("");
  const [pinError, setPinError] = useState("");
  const [settingPin, setSettingPin] = useState(false);
  const [newPin, setNewPin] = useState("");
  // ADDED — real ask: force reconfirmation before accepting a new PIN,
  // to catch typos (a wrong PIN saved silently would lock the user out of
  // his own Anonymise-revert/App-Lock later, with no way back in).
  const [confirmPin, setConfirmPin] = useState("");
  // ADDED — real ask: eye-icon show/hide toggle on PIN entry, matching
  // the pattern used elsewhere on the web. Shared across every PIN
  // field on this screen.
  const [showPins, setShowPins] = useState(false);

  const refresh = () => setSettings(PrivacySettingsRepository.getSettings());

  const activate = () => { PrivacySettingsRepository.activate(); refresh(); };
  const attemptDeactivate = () => {
    const result = PrivacySettingsRepository.deactivate(pinEntry);
    if (result.ok) { setPinEntry(""); setPinError(""); refresh(); }
    else setPinError(result.error);
  };
  const savePin = () => {
    const trimmed = newPin.trim();
    if (trimmed.length < 4) { setPinError("PIN should be at least 4 digits."); return; }
    // CHANGED — real ask: force reconfirmation before accepting.
    if (trimmed !== confirmPin.trim()) { setPinError("PINs don't match — check both and try again."); return; }
    PrivacySettingsRepository.update({ anonymisePin: trimmed });
    setNewPin(""); setConfirmPin(""); setSettingPin(false); setPinError("");
    refresh();
  };

  // ADDED 1 Sep 2026 — real ask: "dummy pin good idea." Same
  // confirm-before-accept pattern as the real PIN above, plus the one
  // extra real validation this PIN specifically needs — see
  // setDuressPin's own comment on why it must differ from the real PIN.
  const [settingDuressPin, setSettingDuressPin] = useState(false);
  const [newDuressPin, setNewDuressPin] = useState("");
  const [confirmDuressPin, setConfirmDuressPin] = useState("");
  const [duressPinError, setDuressPinError] = useState("");
  const saveDuressPin = () => {
    const trimmed = newDuressPin.trim();
    if (trimmed.length < 4) { setDuressPinError("PIN should be at least 4 digits."); return; }
    if (trimmed !== confirmDuressPin.trim()) { setDuressPinError("PINs don't match — check both and try again."); return; }
    const result = PrivacySettingsRepository.setDuressPin(trimmed);
    if (!result.ok) { setDuressPinError(result.error); return; }
    setNewDuressPin(""); setConfirmDuressPin(""); setSettingDuressPin(false); setDuressPinError("");
    refresh();
  };
  const clearDuressPin = () => { PrivacySettingsRepository.clearDuressPin(); refresh(); };

  // ADDED 19 Aug 2026 — App Lock toggle, real ask. Guarded: can't turn
  // on without a PIN already set, since App Lock with no PIN would
  // show a lock screen that anything (even leaving the field blank)
  // trivially bypasses — confusing, not actually locked. Turning OFF
  // never needs the PIN re-entered here; you're already inside
  // Settings, which the lock screen itself already gated.
  const toggleAppLock = () => {
    if (!settings.appLockEnabled && !settings.anonymisePin) {
      setPinError("Set a PIN below first, then App Lock can use it.");
      return;
    }
    // CHANGED — real ask: turning App Lock back OFF should also turn
    // off biometric unlock with it — biometric is only ever meaningful
    // as an add-on to App Lock, leaving it silently "on" underneath
    // would just be stale, unreachable state.
    PrivacySettingsRepository.update({ appLockEnabled: !settings.appLockEnabled, ...(settings.appLockEnabled ? { biometricUnlockEnabled: false } : {}) });
    refresh();
  };

  // ADDED — real ask: biometric unlock, layered on top of App Lock's
  // own PIN. Real device/enrollment check happens here at toggle-on
  // time — never just flips the flag and hopes, since the device
  // might have no biometric hardware or nothing enrolled.
  const [biometricError, setBiometricError] = useState("");
  const toggleBiometric = async () => {
    setBiometricError("");
    if (settings.biometricUnlockEnabled) {
      PrivacySettingsRepository.update({ biometricUnlockEnabled: false });
      refresh();
      return;
    }
    const result = await checkBiometryAvailable();
    if (!result.available) {
      setBiometricError(result.reason || "Biometrics aren't available on this device.");
      return;
    }
    PrivacySettingsRepository.update({ biometricUnlockEnabled: true });
    refresh();
  };

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Privacy & Security</span>
      </div>

      <div style={{ padding: "16px" }}>
        {/* ADDED — real ask, from a competitive-research finding: SHOS's
            "no cloud, no account" architecture was never actually
            stated anywhere in-app as a deliberate choice with real
            consequences — just implied by the absence of a sign-up
            screen. Many popular health-tracking apps DO send usage
            data to third-party analytics/advertising SDKs, sometimes
            without making that obvious; SHOS structurally can't, since
            there's no server for data to go to in the first place.
            Stated plainly rather than naming any specific competitor
            or citing a specific incident, since that's not something
            this app's own UI copy can responsibly verify or keep
            current. */}
        <div style={{ display: "flex", gap: 10, padding: 14, borderRadius: RADIUS.md, background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", marginBottom: 16 }}>
          <Lock size={18} color={darkMode ? DARK.textSecondary : "#5B5B62"} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", lineHeight: 1.5 }}>
            SHOS has no account, no server, and no cloud sync — everything below only ever exists on this device. That's not just a preference you could turn off: there's genuinely nowhere else for it to go. Many comparable apps route usage data through third-party analytics or advertising services; this one structurally can't.
          </div>
        </div>

        {/* Big, clearly separated toggle button — never on by default,
            per the user's explicit instruction, and always one tap to turn
            ON regardless of any PIN. */}
        <div onClick={settings.anonymiseModeActive ? undefined : activate}
          style={{ padding: 18, borderRadius: RADIUS.md, background: settings.anonymiseModeActive ? "#1B1B1F" : (darkMode ? DARK.surface : "#FFFFFF"), border: `1px solid ${settings.anonymiseModeActive ? "#1B1B1F" : (darkMode ? DARK.border : "#DCDCE1")}`, cursor: settings.anonymiseModeActive ? "default" : "pointer", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {settings.anonymiseModeActive ? <EyeOff size={20} color="#FFFFFF" /> : <Eye size={20} color={darkMode ? DARK.textPrimary : "#1B1B1F"} />}
            <span style={{ fontSize: 15, fontWeight: 700, color: settings.anonymiseModeActive ? "#FFFFFF" : (darkMode ? DARK.textPrimary : "#1B1B1F") }}>
              {settings.anonymiseModeActive ? "Anonymise mode is ON" : "Turn on Anonymise mode"}
            </span>
          </div>
          <div style={{ fontSize: 12, color: settings.anonymiseModeActive ? "#DCDCE1" : (darkMode ? DARK.textSecondary : "#5B5B62"), marginTop: 6 }}>
            {settings.anonymiseModeActive
              ? "Names, photos, addresses, and car details are hidden across Contacts."
              : "Tap right before handing your phone over — hides names, photos, addresses, and car registration in Contacts. Never turns on by itself."}
          </div>
        </div>

        {settings.anonymiseModeActive && (
          <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F", marginBottom: 8 }}>
              {settings.anonymisePin ? "Enter your PIN to turn it back off" : "Turn it back off"}
            </div>
            {settings.anonymisePin && (
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input value={pinEntry} onChange={(e) => { setPinEntry(e.target.value); setPinError(""); }} type={showPins ? "text" : "password"} inputMode="numeric" placeholder="PIN"
                  style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 14, boxSizing: "border-box" }} />
                {showPins ? <EyeOff size={17} color={darkMode ? DARK.textDisabled : "#656568"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(false)} />
                  : <Eye size={17} color={darkMode ? DARK.textDisabled : "#656568"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(true)} />}
              </div>
            )}
            {pinError && <div style={{ fontSize: 12, color: ACTION.red, marginBottom: 8 }}>{pinError}</div>}
            <button onClick={attemptDeactivate} style={{ width: "100%", padding: 12, borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>
              Turn off Anonymise mode
            </button>
          </div>
        )}

        {/* CHANGED — real ask: moved to sit immediately below the base
            Anonymise toggle (was further down, after App Lock) — also
            now genuinely disabled, not just visually de-emphasized,
            unless Anonymise mode is actually on. Toggling "further"
            hiding when the base tier isn't even active never made
            sense — there'd be nothing for it to add on top of. */}
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, padding: 16, marginBottom: 16, opacity: settings.anonymiseModeActive ? 1 : 0.5 }}>
          <div onClick={settings.anonymiseModeActive ? () => { PrivacySettingsRepository.update({ hideFurtherEnabled: !settings.hideFurtherEnabled }); refresh(); } : undefined}
            role="switch" tabIndex={settings.anonymiseModeActive ? 0 : -1} aria-checked={settings.hideFurtherEnabled} aria-label="Also hide kinks & physical attributes"
            onKeyDown={settings.anonymiseModeActive ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); PrivacySettingsRepository.update({ hideFurtherEnabled: !settings.hideFurtherEnabled }); refresh(); } } : undefined}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: settings.anonymiseModeActive ? "pointer" : "default" }}>
            <div style={{ flex: 1, paddingRight: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Also hide kinks & physical attributes</div>
              <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 2 }}>
                {settings.anonymiseModeActive
                  ? "Stated kinks, limits, length/girth, and Cummer stats — hidden in addition to the base fields above, only while Anonymise mode is on."
                  : "Turn on Anonymise mode above first — this only ever applies on top of it."}
              </div>
            </div>
            <div style={{ width: 40, height: 24, borderRadius: 999, background: settings.hideFurtherEnabled ? ACCENTS.healthcare : "#DCDCE1", position: "relative", flexShrink: 0 }}>
              {/* CHANGED — same knob-invisible-in-dark-mode bug class
                  as the Colour scheme screen's dark mode toggle: a
                  near-black knob in dark mode could blend into a
                  near-black "off" track. Solid white in both states,
                  matching the App Lock/Biometric toggles right below
                  and every other toggle in the app. */}
              <div style={{ position: "absolute", top: 2, left: settings.hideFurtherEnabled ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: "#FFFFFF" }} />
            </div>
          </div>
        </div>

        {/* ADDED 19 Aug 2026 — App Lock, real ask, separate from
            Anonymise mode: gates opening the app at all, not just
            masking fields once it's open. */}
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, padding: 16, marginBottom: 16 }}>
          <div onClick={toggleAppLock} role="switch" tabIndex={0} aria-checked={settings.appLockEnabled} aria-label="App Lock"
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleAppLock(); } }}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
            <div style={{ flex: 1, paddingRight: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>App Lock</div>
              <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 2 }}>Require your PIN just to open the app at all. Uses the same PIN as the Revert PIN below.</div>
            </div>
            <div style={{ width: 40, height: 24, borderRadius: 999, background: settings.appLockEnabled ? ACCENTS.healthcare : "#DCDCE1", position: "relative", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 2, left: settings.appLockEnabled ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: "#FFFFFF" }} />
            </div>
          </div>
          {/* ADDED 19 Aug 2026 — real fix while building this: without
              this, the "set a PIN first" guard message had nowhere to
              actually render when neither the deactivate flow nor the
              set-PIN flow was open — the user would tap the toggle, nothing
              would visibly happen, and the guard would silently do
              nothing from his side. */}
          {pinError && !settings.anonymiseModeActive && !settingPin && (
            <div style={{ fontSize: 12, color: ACTION.red, marginTop: 8 }}>{pinError}</div>
          )}
          {/* ADDED — real ask: biometric unlock, via
              @aparajita/capacitor-biometric-auth. Only offered once App
              Lock (and therefore a PIN) is already on — biometric is a
              convenience layered on top of the PIN, not a standalone
              gate, and the PIN field on the lock screen always still
              works even with this on. Not shown at all in a browser
              preview's own build check (see toggleBiometric's real
              checkBiometryAvailable() call) — that's expected, not a
              bug, the native plugin only exists in the installed app. */}
          {settings.appLockEnabled && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 14, borderTop: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", cursor: "pointer" }} onClick={toggleBiometric}
              role="switch" tabIndex={0} aria-checked={settings.biometricUnlockEnabled} aria-label="Unlock with biometrics"
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleBiometric(); } }}>
              <div style={{ flex: 1, paddingRight: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Unlock with biometrics</div>
                <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 2 }}>Fingerprint or face unlock as a shortcut for the PIN above — the PIN still works any time this is on, off, or unavailable.</div>
                {biometricError && <div style={{ fontSize: 11, color: ACTION.red, marginTop: 4 }}>{biometricError}</div>}
              </div>
              <div style={{ width: 40, height: 24, borderRadius: 999, background: settings.biometricUnlockEnabled ? ACCENTS.healthcare : "#DCDCE1", position: "relative", flexShrink: 0 }}>
                <div style={{ position: "absolute", top: 2, left: settings.biometricUnlockEnabled ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: "#FFFFFF" }} />
              </div>
            </div>
          )}
          {/* ADDED — real ask: "lock again after close/screen timeout by
              default, but allow toggle to increase timer — if
              unlocked/opened again within X minutes, don't need to
              re-verify." Off (0 minutes) is the default, matching the
              existing always-relock behaviour exactly — this is purely
              opt-in convenience layered on top. */}
          {settings.appLockEnabled && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
              <div onClick={() => { PrivacySettingsRepository.update({ appLockGraceMinutes: settings.appLockGraceMinutes > 0 ? 0 : 10 }); refresh(); }}
                role="switch" tabIndex={0} aria-checked={settings.appLockGraceMinutes > 0} aria-label="Skip re-verification briefly"
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); PrivacySettingsRepository.update({ appLockGraceMinutes: settings.appLockGraceMinutes > 0 ? 0 : 10 }); refresh(); } }}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                <div style={{ flex: 1, paddingRight: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Skip re-verification briefly</div>
                  <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 2 }}>Reopening the app within a few minutes of last unlocking it won't ask again.</div>
                </div>
                <div style={{ width: 40, height: 24, borderRadius: 999, background: settings.appLockGraceMinutes > 0 ? ACCENTS.healthcare : "#DCDCE1", position: "relative", flexShrink: 0 }}>
                  <div style={{ position: "absolute", top: 2, left: settings.appLockGraceMinutes > 0 ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: "#FFFFFF" }} />
                </div>
              </div>
              {settings.appLockGraceMinutes > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                  <span style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>Grace period:</span>
                  <input type="number" min={1} max={120} value={settings.appLockGraceMinutes}
                    onChange={(e) => { const v = Math.max(1, Math.min(120, Number(e.target.value) || 1)); PrivacySettingsRepository.update({ appLockGraceMinutes: v }); refresh(); }}
                    style={{ width: 56, padding: "6px 8px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", background: darkMode ? DARK.surfaceVariant : "#F0F0F3", color: darkMode ? DARK.textPrimary : "#1B1B1F", fontSize: 13, textAlign: "center" }} />
                  <span style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>minutes</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CHANGED — real ask: "App Lock and Revert PIN should be
            neighbours" — moved to sit directly below App Lock now,
            since they share the exact same PIN. */}
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F", marginBottom: 4 }}>Revert PIN</div>
          <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 10 }}>
            {settings.anonymisePin ? "A PIN is set — used for both Anonymise mode's revert and App Lock above." : "No PIN set yet — anyone can turn Anonymise mode back off right now, and App Lock can't be turned on. Set one so both actually protect you."}
          </div>
          {settingPin ? (
            <>
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input value={newPin} onChange={(e) => setNewPin(e.target.value)} type={showPins ? "text" : "password"} inputMode="numeric" placeholder="New PIN (4+ digits)"
                  style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 14, boxSizing: "border-box" }} />
                {showPins ? <EyeOff size={17} color={darkMode ? DARK.textDisabled : "#656568"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(false)} />
                  : <Eye size={17} color={darkMode ? DARK.textDisabled : "#656568"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(true)} />}
              </div>
              {/* ADDED — real ask: force reconfirmation before accepting,
                  to catch typos before they lock the user out later. */}
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} type={showPins ? "text" : "password"} inputMode="numeric" placeholder="Confirm new PIN"
                  style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 14, boxSizing: "border-box" }} />
                {showPins ? <EyeOff size={17} color={darkMode ? DARK.textDisabled : "#656568"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(false)} />
                  : <Eye size={17} color={darkMode ? DARK.textDisabled : "#656568"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(true)} />}
              </div>
              {pinError && <div style={{ fontSize: 12, color: ACTION.red, marginBottom: 8 }}>{pinError}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setSettingPin(false); setNewPin(""); setConfirmPin(""); setPinError(""); }} style={{ flex: 1, padding: 10, borderRadius: 999, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", background: "transparent", color: darkMode ? DARK.textSecondary : "#5B5B62", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button onClick={savePin} style={{ flex: 1, padding: 10, borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Save PIN</button>
              </div>
            </>
          ) : (
            <button onClick={() => setSettingPin(true)} style={{ width: "100%", padding: 10, borderRadius: 999, border: `1px solid ${ACCENTS.healthcare}`, background: "transparent", color: ACCENTS.healthcare, fontWeight: 700, cursor: "pointer" }}>
              {settings.anonymisePin ? "Change PIN" : "Set a PIN"}
            </button>
          )}
        </div>

        {/* ADDED 1 Sep 2026 — real ask: duress/decoy PIN. Only offered
            once App Lock is actually on — a duress PIN only means
            anything if there's a real lock screen for it to be entered
            on in the first place. */}
        {settings.appLockEnabled && (
          <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, padding: 16, marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F", marginBottom: 4 }}>Duress PIN (optional)</div>
            <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 10 }}>
              {settings.duressPin
                ? "Set. Entering this PIN on the App Lock screen — instead of your real one — opens a convincing but empty, fake version of the app. Your real data stays completely untouched, just not shown. There's no way back to real data from inside a decoy session — close and reopen the app, then enter your REAL PIN."
                : "A second PIN, different from your real one, for a \"someone is making me unlock my phone\" situation. Entering it opens a fake, empty-looking app instead of your real data — nothing is deleted or changed, it just isn't shown."}
            </div>
            {settingDuressPin ? (
              <>
                <div style={{ position: "relative", marginBottom: 8 }}>
                  <input value={newDuressPin} onChange={(e) => setNewDuressPin(e.target.value)} type={showPins ? "text" : "password"} inputMode="numeric" placeholder="New duress PIN (4+ digits)"
                    style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 14, boxSizing: "border-box" }} />
                  {showPins ? <EyeOff size={17} color={darkMode ? DARK.textDisabled : "#656568"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(false)} />
                    : <Eye size={17} color={darkMode ? DARK.textDisabled : "#656568"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(true)} />}
                </div>
                <div style={{ position: "relative", marginBottom: 8 }}>
                  <input value={confirmDuressPin} onChange={(e) => setConfirmDuressPin(e.target.value)} type={showPins ? "text" : "password"} inputMode="numeric" placeholder="Confirm duress PIN"
                    style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 14, boxSizing: "border-box" }} />
                  {showPins ? <EyeOff size={17} color={darkMode ? DARK.textDisabled : "#656568"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(false)} />
                    : <Eye size={17} color={darkMode ? DARK.textDisabled : "#656568"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(true)} />}
                </div>
                {duressPinError && <div style={{ fontSize: 12, color: ACTION.red, marginBottom: 8 }}>{duressPinError}</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setSettingDuressPin(false); setNewDuressPin(""); setConfirmDuressPin(""); setDuressPinError(""); }} style={{ flex: 1, padding: 10, borderRadius: 999, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", background: "transparent", color: darkMode ? DARK.textSecondary : "#5B5B62", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                  <button onClick={saveDuressPin} style={{ flex: 1, padding: 10, borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Save PIN</button>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setSettingDuressPin(true)} style={{ flex: 1, padding: 10, borderRadius: 999, border: `1px solid ${ACCENTS.healthcare}`, background: "transparent", color: ACCENTS.healthcare, fontWeight: 700, cursor: "pointer" }}>
                  {settings.duressPin ? "Change duress PIN" : "Set a duress PIN"}
                </button>
                {settings.duressPin && (
                  <button onClick={clearDuressPin} style={{ padding: "10px 16px", borderRadius: 999, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", background: "transparent", color: ACTION.red, fontWeight: 600, cursor: "pointer" }}>
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ADDED — real ask: "unified notifications management in settings" —
// one place to turn each real reminder type on/off, rather than each
// one being buried invisibly in its own module. Deliberately just a
// switchboard: every actual data read + native scheduling decision
// still lives in each reminder's own sync file (doxyPepSync.js,
// testingReminderSync.js, refillReminderSync.js,
// clinicVisitReminderSync.js) — this screen only flips the settings
// those already check, same "one source of truth, no duplicated
// logic" principle as everywhere else in this app. Medication dose
// reminders are the one toggle NOT duplicated here — it already lived
// in medicationPreferencesRepository.js before this screen existed,
// so this just reads/writes that repository directly alongside the
// new ones, rather than migrating it (and risking losing anyone's
// already-set snooze/skip state) for no real gain.
function NotificationToggleRow({ label, description, enabled, onToggle, darkMode, children }) {
  return (
    <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, padding: 16, marginBottom: 12 }}>
      <div role="switch" aria-checked={enabled} aria-label={label} tabIndex={0}
        onClick={onToggle} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
        <div style={{ flex: 1, paddingRight: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>{label}</div>
          <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 2 }}>{description}</div>
        </div>
        <div style={{ width: 40, height: 24, borderRadius: 999, background: enabled ? ACCENTS.healthcare : "#DCDCE1", position: "relative", flexShrink: 0 }}>
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
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: `1px solid ${ACTION.red}`, borderRadius: RADIUS.md, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: ACTION.red, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Notifications need SHOS added to your Home Screen</span>
        </div>
        <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>
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
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: `1px solid ${darkMode ? DARK.border : "#DCDCE1"}`, borderRadius: RADIUS.md, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>
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
    <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: `1px solid ${isGranted ? ACTION.green : ACTION.red}`, borderRadius: RADIUS.md, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: isGranted ? ACTION.green : ACTION.red, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>
          {isGranted ? "Notifications are allowed" : isDenied ? "Notifications are blocked" : isError ? "Couldn't check notification status" : "Notifications not yet allowed"}
        </span>
      </div>
      {isError && (
        <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 8 }}>
          The check itself failed rather than returning a real answer — this is worth reporting as a bug.
          {statusDetail && (
            <div style={{ marginTop: 6, padding: "6px 8px", borderRadius: 8, background: darkMode ? DARK.surfaceVariant : "#F0F0F3", fontFamily: "monospace", fontSize: 11, wordBreak: "break-word", whiteSpace: "pre-line" }}>
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
              <div style={{ marginTop: 4, padding: "6px 8px", borderRadius: 8, background: darkMode ? DARK.surfaceVariant : "#F0F0F3", fontFamily: "monospace", fontSize: 11, wordBreak: "break-word", whiteSpace: "pre-line", color: darkMode ? DARK.textSecondary : "#5B5B62" }}>
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
        <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 8 }}>
          {isNative
            ? "Android has granted this permission. The toggles below control which reminders actually get scheduled."
            : "Permission granted. The toggles below control which reminders actually get scheduled."}
        </div>
      )}
      {/* ADDED — real, honest platform ceiling for the web/PWA path —
          see this component's own header comment. Native-only banner
          above (exact alarms) stays exactly as it was. */}
      {isGranted && !isNative && (
        <div style={{ marginBottom: 8, padding: "8px 10px", borderRadius: 10, background: darkMode ? DARK.surfaceVariant : "#F0F0F3" }}>
          <span style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>
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
            <span style={{ fontSize: 12, color: darkMode ? DARK.textPrimary : "#1B1B1F", flex: 1 }}>
              {exactAlarmStatus === "granted"
                ? "Exact alarms allowed — reminders fire on time."
                : exactAlarmStatus === "error"
                ? "Couldn't check exact-alarm status — the check itself failed."
                : "Exact alarms not allowed — reminders may arrive late (minutes to hours), or not at all during testing."}
            </span>
            {exactAlarmStatus !== "granted" && (
              <span onClick={requestExactAlarm} style={{ fontSize: 12, fontWeight: 700, color: ACCENTS.healthcare, cursor: "pointer", flexShrink: 0 }}>
                {exactAlarmStatus === "error" ? "Try again" : "Fix this"}
              </span>
            )}
          </div>
          {exactAlarmStatus === "error" && exactAlarmDetail && (
            <div style={{ marginTop: 6, padding: "6px 8px", borderRadius: 8, background: darkMode ? DARK.surfaceVariant : "#F0F0F3", fontFamily: "monospace", fontSize: 11, wordBreak: "break-word" }}>
              {exactAlarmDetail}
            </div>
          )}
        </div>
      )}
      {isDenied && (
        <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>
          {isNative
            ? <>Android is blocking notifications for SHOS — none of the toggles below will actually fire until this changes. Android only shows the one-time in-app prompt once per install, so this has to be turned on manually: open your phone's <strong>Settings → Apps → SHOS → Notifications</strong> and allow them.</>
            : <>Your browser is blocking notifications for SHOS — none of the toggles below will actually fire until this changes. This has to be turned on manually in your browser's own site settings for SHOS (usually the padlock/site-info icon next to the address bar → Notifications → Allow).</>}
        </div>
      )}
      {!isGranted && !isDenied && !isError && (
        <>
          <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 8 }}>
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
          <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 8 }}>
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
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16, padding: "12px 16px", borderRadius: RADIUS.md, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", background: darkMode ? DARK.surface : "#FFFFFF" }}>
      <Download size={16} color={ACCENTS.healthcare} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Install SHOS for more reliable reminders</div>
        <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 2, marginBottom: 10 }}>
          Installed as its own app (not just a browser tab), SHOS keeps its background notification handling registered more reliably.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={install} style={{ padding: "7px 14px", borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Install</button>
          <span onClick={() => setDismissed(true)} style={{ fontSize: 12, fontWeight: 600, color: darkMode ? DARK.textSecondary : "#5B5B62", cursor: "pointer" }}>Not now</span>
        </div>
      </div>
    </div>
  );
}

function NotificationsScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const [, forceRefresh] = useState(0);
  const refresh = () => forceRefresh((n) => n + 1);
  const [showHistory, setShowHistory] = useState(false);
  const notifPrefs = NotificationPreferencesRepository.getPreferences();
  const medPrefs = MedicationPreferencesRepository.getPreferences();

  // Re-syncs immediately on toggle rather than waiting for the next
  // Home mount or relevant save — turning a reminder off should cancel
  // whatever's already pending right away, not leave a stale native
  // notification scheduled until the app happens to reopen.
  const toggleNotif = (key) => {
    NotificationPreferencesRepository.update({ [key]: !notifPrefs[key] });
    if (key === "doxyPepAlertEnabled") syncDoxyPepAlert();
    else if (key === "testingReminderEnabled") syncTestingReminder();
    else if (key === "refillReminderEnabled") syncRefillReminder();
    else syncClinicVisitReminders();
    refresh();
  };
  const toggleMed = () => { MedicationPreferencesRepository.updatePreferences({ doseRemindersEnabled: !medPrefs.doseRemindersEnabled }); syncMedicationReminders(); refresh(); };

  // Re-syncs every real reminder type at once — used by the master
  // switch, quiet hours, and vacation pause below, all of which affect
  // every type simultaneously rather than just one.
  const resyncAll = () => {
    syncMedicationReminders();
    syncDoxyPepAlert();
    syncTestingReminder();
    syncRefillReminder();
    syncClinicVisitReminders();
  };

  const toggleMaster = () => { NotificationPreferencesRepository.update({ masterEnabled: !notifPrefs.masterEnabled }); resyncAll(); refresh(); };

  // ADDED 3 Sep 2026 — real ask: quiet hours + vacation pause.
  const setQuietHours = (changes) => { NotificationPreferencesRepository.update(changes); resyncAll(); refresh(); };
  const pausedActive = isPaused(notifPrefs);
  const startPause = (days) => {
    const until = new Date();
    until.setDate(until.getDate() + days);
    NotificationPreferencesRepository.update({ pausedUntil: until.toISOString() });
    resyncAll();
    refresh();
  };
  const resumeNow = () => { NotificationPreferencesRepository.update({ pausedUntil: null }); resyncAll(); refresh(); };

  const hoursInput = (value, onChange) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
      <span style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>Hours before:</span>
      <input type="number" min={1} max={168} value={value}
        onChange={(e) => onChange(Math.max(1, Math.min(168, Number(e.target.value) || 1)))}
        style={{ width: 56, padding: "6px 8px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", background: darkMode ? DARK.surfaceVariant : "#F0F0F3", color: darkMode ? DARK.textPrimary : "#1B1B1F", fontSize: 13, textAlign: "center" }} />
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Notifications</span>
      </div>

      <div style={{ padding: 16 }}>
        <NotificationPermissionBanner darkMode={darkMode} />
        <InstallPwaNudge darkMode={darkMode} />

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
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Pause everything</div>
          {pausedActive ? (
            <>
              <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 2, marginBottom: 10 }}>
                Paused until {new Date(notifPrefs.pausedUntil).toLocaleDateString([], { day: "numeric", month: "short" })}, {new Date(notifPrefs.pausedUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.
              </div>
              <button onClick={resumeNow} style={{ padding: "8px 14px", borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Resume now</button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 2, marginBottom: 10 }}>
                Temporarily stop every reminder — travelling, a break, whatever the reason. Resumes on its own, no need to remember to turn it back on.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[{ label: "1 day", days: 1 }, { label: "3 days", days: 3 }, { label: "1 week", days: 7 }, { label: "2 weeks", days: 14 }].map((opt) => (
                  <button key={opt.days} onClick={() => startPause(opt.days)} style={{ padding: "6px 12px", borderRadius: 999, border: `1px solid ${darkMode ? DARK.border : "#DCDCE1"}`, background: "transparent", color: darkMode ? DARK.textPrimary : "#1B1B1F", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{opt.label}</button>
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
              <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 4 }}>From</div>
              <input type="time" value={notifPrefs.quietHoursStart} onChange={(e) => setQuietHours({ quietHoursStart: e.target.value })}
                style={{ padding: "6px 8px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", background: darkMode ? DARK.surfaceVariant : "#F0F0F3", color: darkMode ? DARK.textPrimary : "#1B1B1F", fontSize: 13 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 4 }}>To</div>
              <input type="time" value={notifPrefs.quietHoursEnd} onChange={(e) => setQuietHours({ quietHoursEnd: e.target.value })}
                style={{ padding: "6px 8px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", background: darkMode ? DARK.surfaceVariant : "#F0F0F3", color: darkMode ? DARK.textPrimary : "#1B1B1F", fontSize: 13 }} />
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
        <NotificationToggleRow darkMode={darkMode} label="Clinic appointment reminder A" enabled={notifPrefs.clinicVisitReminderAEnabled} onToggle={() => toggleNotif("clinicVisitReminderAEnabled")}
          description="First reminder before a booked clinic appointment. Defaults to 24 hours.">
          {hoursInput(notifPrefs.clinicVisitReminderAHours, (v) => { NotificationPreferencesRepository.update({ clinicVisitReminderAHours: v }); syncClinicVisitReminders(); refresh(); })}
        </NotificationToggleRow>
        <NotificationToggleRow darkMode={darkMode} label="Clinic appointment reminder B" enabled={notifPrefs.clinicVisitReminderBEnabled} onToggle={() => toggleNotif("clinicVisitReminderBEnabled")}
          description="Second, closer reminder before a booked clinic appointment. Defaults to 2 hours.">
          {hoursInput(notifPrefs.clinicVisitReminderBHours, (v) => { NotificationPreferencesRepository.update({ clinicVisitReminderBHours: v }); syncClinicVisitReminders(); refresh(); })}
        </NotificationToggleRow>

        {/* ADDED 3 Sep 2026 — real ask: a notification history log —
            nothing anywhere previously recorded that a real
            notification had delivered. */}
        <div onClick={() => setShowHistory(true)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: RADIUS.md, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", background: darkMode ? DARK.surface : "#FFFFFF", cursor: "pointer" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Notification history</span>
          <ChevronRight size={16} color={darkMode ? DARK.textSecondary : "#5B5B62"} />
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
function NotificationHistoryScreen({ darkMode, onClose }) {
  const [entries, setEntries] = useLoadedState(() => NotificationHistoryRepository.getAll(), [], []);
  const clear = () => { NotificationHistoryRepository.clear(); setEntries([]); };

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 225, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
          <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Notification history</span>
        </div>
        {entries.length > 0 && (
          <span onClick={clear} style={{ fontSize: 12, fontWeight: 600, color: ACTION.red, cursor: "pointer" }}>Clear</span>
        )}
      </div>
      <div style={{ padding: 16 }}>
        {entries.length === 0 ? (
          <div style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62", textAlign: "center", padding: "40px 16px" }}>
            Nothing's fired yet. Real reminders (and the test notification) show up here the moment they actually deliver.
          </div>
        ) : entries.map((e, i) => (
          <div key={i} style={{ padding: "10px 0", borderBottom: i < entries.length - 1 ? (darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1") : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>{e.title}</span>
              <span style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", flexShrink: 0 }}>
                {new Date(e.firedAt).toLocaleDateString([], { day: "numeric", month: "short" })}, {new Date(e.firedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
            {e.body && <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 2 }}>{e.body}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ADDED 3 Sep 2026 — real ask: "can we add a global default units
// settings? ie temp, height, weight... international standards.
// convert automatically if user puts a value in with units on a
// different scale." The real per-type conversion machinery already
// existed (measurementRepository.js's UNIT_CONFIG) with a preferred-
// unit preference (measurementPreferencesRepository.js) — but it was
// only ever reachable from Measurements' own gear icon, not from
// Settings, and Height/Temperature weren't even offered there yet
// (Temperature had no measurement type at all — added alongside this).
// This screen is the same underlying preference, made genuinely
// global and discoverable, plus a one-tap Metric/Imperial switch that
// sets Weight/Height/Temperature together — the individual per-type
// chips underneath still let anyone mix, e.g. metric weight with an
// imperial temperature.
// EXPLICITLY DOES NOT touch time or timezone — the user's own repeated,
// explicit instruction ("never change time zones/recorded times as
// described in last and this message"). A recorded date/time isn't a
// "unit" in the sense this screen means, and a timezone control here
// risks reintroducing exactly the BST/GMT display bug fixed elsewhere
// in this app (see dateInputHelpers.js).
const UNIT_SYSTEM_TYPES = ["Weight", "Height", "Temperature"];
const METRIC_UNITS = { Weight: "kg", Height: "cm", Temperature: "°C" };
const IMPERIAL_UNITS = { Weight: "lb", Height: "in", Temperature: "°F" };

function detectUnitSystem(prefs) {
  const isImperial = UNIT_SYSTEM_TYPES.every((t) => (prefs.preferredUnitByType[t] || getDefaultUnit(t, prefs)) === IMPERIAL_UNITS[t]);
  return isImperial ? "imperial" : "metric";
}

function UnitsScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const [prefs, setPrefs] = useLoadedState(() => MeasurementPreferencesRepository.getPreferences(), [], DEFAULT_MEASUREMENT_PREFERENCES);
  const system = detectUnitSystem(prefs);

  const setPreferred = async (type, unit) => setPrefs(await MeasurementPreferencesRepository.setPreferredUnit(type, unit));
  const setSystem = async (target) => {
    const units = target === "imperial" ? IMPERIAL_UNITS : METRIC_UNITS;
    let updated = prefs;
    for (const type of UNIT_SYSTEM_TYPES) updated = await MeasurementPreferencesRepository.setPreferredUnit(type, units[type]);
    setPrefs(updated);
  };

  // ADDED — real ask: first day of week preference (Sunday/Monday,
  // default Monday). A different repository (AppPreferencesRepository,
  // not measurement units) but this screen is the closest existing
  // "how things display" home rather than a new near-empty screen —
  // same reasoning as InactiveThresholdCard folding into DesignScreen.
  const [appPrefs, setAppPrefs] = useLoadedState(() => AppPreferencesRepository.getPreferences(), [], DEFAULT_APP_PREFERENCES);
  const setWeekStartsOn = (value) => setAppPrefs(AppPreferencesRepository.update({ weekStartsOn: value }));

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Units</span>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 10 }}>
          Sets the default unit new entries start on, and how existing readings are displayed. Nothing already saved is rewritten — the value you originally entered is always kept too, alongside the converted one.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {["metric", "imperial"].map((opt) => (
            <div key={opt} onClick={() => setSystem(opt)}
              style={{ flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer",
                border: `1px solid ${system === opt ? ACCENTS.healthcare : (darkMode ? DARK.border : "#DCDCE1")}`,
                color: system === opt ? "#FFFFFF" : (darkMode ? DARK.textPrimary : "#1B1B1F"),
                background: system === opt ? ACCENTS.healthcare : "transparent" }}>
              {opt === "metric" ? "Metric" : "Imperial"}
            </div>
          ))}
        </div>

        {UNIT_SYSTEM_TYPES.map((type) => {
          const units = getAvailableUnits(type, prefs.typeKinds[type]);
          const current = prefs.preferredUnitByType[type] || units[0];
          return (
            <div key={type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
              <span style={{ fontSize: 14, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>{type}</span>
              <div style={{ display: "flex", gap: 6 }}>
                {units.map((u) => (
                  <div key={u} onClick={() => setPreferred(type, u)}
                    style={{ padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: current === u ? 700 : 400, cursor: "pointer",
                      border: `1px solid ${current === u ? ACCENTS.healthcare : (darkMode ? DARK.border : "#DCDCE1")}`,
                      color: current === u ? "#FFFFFF" : (darkMode ? DARK.textSecondary : "#5B5B62"),
                      background: current === u ? ACCENTS.healthcare : "transparent" }}>
                    {u}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div style={{ ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : "#656568", marginTop: 24, marginBottom: 8 }}>Calendar</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
          <span style={{ fontSize: 14, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Week starts on</span>
          <div role="radiogroup" aria-label="Week starts on" style={{ display: "flex", gap: 6 }}>
            {[{ value: "monday", label: "Monday" }, { value: "sunday", label: "Sunday" }].map((opt) => (
              <div key={opt.value} onClick={() => setWeekStartsOn(opt.value)} role="radio" tabIndex={0} aria-checked={appPrefs.weekStartsOn === opt.value}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setWeekStartsOn(opt.value); } }}
                style={{ padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: appPrefs.weekStartsOn === opt.value ? 700 : 400, cursor: "pointer",
                  border: `1px solid ${appPrefs.weekStartsOn === opt.value ? ACCENTS.healthcare : (darkMode ? DARK.border : "#DCDCE1")}`,
                  color: appPrefs.weekStartsOn === opt.value ? "#FFFFFF" : (darkMode ? DARK.textSecondary : "#5B5B62"),
                  background: appPrefs.weekStartsOn === opt.value ? ACCENTS.healthcare : "transparent" }}>
                {opt.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ADDED 19 Aug 2026 — Preferences, real now. Deliberately small — one
// real, concrete setting (the user's own ask), not speculative toggles
// filling out a section just because it existed. More real
// Preferences items land here as they come up, same pattern as
// Privacy/Registries/Option lists getting built incrementally rather
// than all at once up front.
// ADDED — real ask: "scheduled auto-export" preset interval choices,
// same reasoning as everywhere else in this app that offers presets
// over free-form entry for a days-based setting — a fixed, sane set of
// options is faster to pick from and harder to get wrong than typing a
// number, and these four cover the realistic range (weekly for someone
// logging a lot, quarterly for someone who barely uses the app).
const AUTO_EXPORT_INTERVAL_OPTIONS = [
  { days: 7, label: "Weekly" },
  { days: 14, label: "Fortnightly" },
  { days: 30, label: "Monthly" },
  { days: 90, label: "Quarterly" },
];

// REMOVED 1 Sep 2026 — real ask: "move inactive contact threshold to
// somewhere else / merge." This screen used to hold Automatic backups
// too (moved out to the Data section — see that past comment, still
// preserved below on AutomaticBackupsScreen), leaving Inactive contact
// threshold as the sole remaining field in an otherwise-empty screen.
// That one field is now InactiveThresholdCard, folded directly into
// DesignScreen above (a Contacts-display setting fits "how each module
// looks/behaves" better than its own near-empty screen) — see that
// screen's own comment for the reasoning.

// MOVED 1 Sep 2026 out of PreferencesScreen — see that function's own
// comment. Same content/behavior as before, now with its own header
// and reachable directly from the Data section next to Export/Restore.
function AutomaticBackupsScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const [prefs, setPrefs] = useLoadedState(() => AppPreferencesRepository.getPreferences(), [], DEFAULT_APP_PREFERENCES);

  const toggleAutoExport = () => {
    setPrefs(AppPreferencesRepository.update({ autoExportEnabled: !prefs.autoExportEnabled }));
  };
  const setAutoExportInterval = (days) => {
    setPrefs(AppPreferencesRepository.update({ autoExportIntervalDays: days }));
  };

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Automatic backups</span>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Automatic backups</span>
            <div onClick={toggleAutoExport} role="switch" tabIndex={0} aria-checked={prefs.autoExportEnabled} aria-label="Automatic backups"
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleAutoExport(); } }}
              style={{ width: 44, height: 26, borderRadius: 999, background: prefs.autoExportEnabled ? "#1B1B1F" : "#DCDCE1", position: "relative", cursor: "pointer", transition: "background 0.15s", flexShrink: 0 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,.4)", position: "absolute", top: 3, left: prefs.autoExportEnabled ? 21 : 3, transition: "left 0.15s" }} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: prefs.autoExportEnabled ? 12 : 0 }}>
            Writes a full backup straight to your phone's Documents folder on its own, on
            whatever schedule you pick below — no need to remember to tap Export. Only
            runs when there's something new since the last backup. Nothing leaves this
            device; it's the same local file the manual Export button produces.
          </div>
          {prefs.autoExportEnabled && (
            <div role="radiogroup" aria-label="Backup interval" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {AUTO_EXPORT_INTERVAL_OPTIONS.map((opt) => (
                <span key={opt.days} onClick={() => setAutoExportInterval(opt.days)} role="radio" tabIndex={0} aria-checked={prefs.autoExportIntervalDays === opt.days}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAutoExportInterval(opt.days); } }}
                  style={{
                    padding: "8px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    background: prefs.autoExportIntervalDays === opt.days ? ACCENTS.healthcare : (darkMode ? DARK.surfaceVariant : "#F0F0F3"),
                    color: prefs.autoExportIntervalDays === opt.days ? "#FFFFFF" : (darkMode ? DARK.textSecondary : "#5B5B62"),
                  }}>
                  {opt.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ADDED — real ask, from a build audit: two real network calls in this
// app (Nominatim address lookup, GitHub update checks) were previously
// undisclosed anywhere in the UI and had no way to turn off — worth
// being upfront about for an app whose whole framing is on-device-only,
// privacy-paramount. Both default ON (see AppPreferencesRepository's
// own comment on why) — this is disclosure and control, not a warning
// to be scared of. Same standalone-screen pattern as AutomaticBackupsScreen.
function DataNetworkScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const [prefs, setPrefs] = useLoadedState(() => AppPreferencesRepository.getPreferences(), [], DEFAULT_APP_PREFERENCES);

  const toggleAddressLookup = () => {
    setPrefs(AppPreferencesRepository.update({ addressLookupEnabled: !prefs.addressLookupEnabled }));
  };
  const toggleUpdateCheck = () => {
    setPrefs(AppPreferencesRepository.update({ updateCheckEnabled: !prefs.updateCheckEnabled }));
  };

  const row = (label, enabled, onToggle, description) => (
    <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>{label}</span>
        <div onClick={onToggle} role="switch" tabIndex={0} aria-checked={enabled} aria-label={label}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
          style={{ width: 44, height: 26, borderRadius: 999, background: enabled ? "#1B1B1F" : "#DCDCE1", position: "relative", cursor: "pointer", transition: "background 0.15s", flexShrink: 0 }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,.4)", position: "absolute", top: 3, left: enabled ? 21 : 3, transition: "left 0.15s" }} />
        </div>
      </div>
      <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>{description}</div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Data & network</span>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 16 }}>
          SHOS is on-device only — nothing is ever sent to a server SHOS runs. Two features do call a third party directly from your device to do their job. Both are listed here exactly, and can be turned off.
        </div>
        {row(
          "Address lookup",
          prefs.addressLookupEnabled,
          toggleAddressLookup,
          "“Use current location” and address autocomplete (Contacts, My Profile, Clinic Visits, Encounters) send a typed address or your GPS coordinates to OpenStreetMap's free Nominatim service to look up a real address or place name. Off: you can still type an address by hand, just without suggestions or auto-lookup."
        )}
        {row(
          "Check for app updates",
          prefs.updateCheckEnabled,
          toggleUpdateCheck,
          "On the installed Android app only, checks GitHub's public API on launch for a newer build. Reveals your IP address to GitHub, nothing else. Off: you can still check manually from the About screen."
        )}
      </div>
    </div>
  );
}

// ADDED 26 Aug 2026 — real ask: design/preferences section for colour
// scheme, ability to customize a module's base colour. See
// moduleColorRepository.js for the actual mechanism (merged into
// ACCENTS at load time) and its honest note on why a change here
// takes effect on next reload, not instantly.
const MODULE_LABELS = { contacts: "Contacts", encounters: "Encounter", medication: "Medication", healthcare: "Healthcare", home: "Home", menstrual: "Menstrual" };
// ADDED — real ask: the semantic pass/fail pair, editable alongside
// the 5 module colours above — see CUSTOMIZABLE_ACTION_KEYS in
// moduleColorRepository.js and ACTION in designTokens.js.
const ACTION_COLOR_LABELS = { actionRed: "Negative / alert (red)", actionGreen: "Positive / success (green)" };

// ADDED 26 Aug 2026 — real ask: clickable info explaining the
// calculation behind a stat, citing real guidance (BASHH/CDC) where
// relevant. A styled "i" rather than a new icon import — this session
// already found two confirmed-broken icon imports elsewhere, so a
// zero-risk approach felt safer than a third guess.
function InfoIcon({ onClick }) {
  const [darkMode] = useDarkModePreference();

  return (
    <div onClick={onClick} style={{ width: 16, height: 16, borderRadius: 999, border: "1px solid #656568", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#656568", cursor: "pointer", flexShrink: 0 }}>i</div>
  );
}

function StatRow({ label, value, explanation, sourceUrl }) {
  const [darkMode] = useDarkModePreference();

  const [showInfo, setShowInfo] = useState(false);
  return (
    <div style={{ padding: "12px 16px", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>{label}</span>
          <InfoIcon onClick={() => setShowInfo((s) => !s)} />
        </div>
        <span style={{ fontSize: 15, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 700 }}>{value}</span>
      </div>
      {showInfo && (
        <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: darkMode ? DARK.bg : "#F0F0F3", fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", lineHeight: 1.5 }}>
          {explanation}
          {sourceUrl && (
            <div style={{ marginTop: 4 }}>
              <a href={sourceUrl} target="_blank" rel="noreferrer" style={{ color: "#3D63C9", fontSize: 11 }}>View source guidance →</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ADDED — real ask: "Stats is descriptive, not predictive" — a real
// nudge, distinct from StatRow's plain label/value shape since this is
// meant to be noticed and acted on, not just looked up. "alert" tone
// (the direction that means testing less often than your own pattern)
// reads the same red as every other real alert in this app; "neutral"
// (interval getting shorter, or informational) stays the Healthcare
// section's own teal rather than green — a shorter gap isn't
// necessarily "good" either, just not the concerning direction.
function TrendInsight({ text, tone, T }) {
  const [darkMode] = useDarkModePreference();
  const color = tone === "alert" ? (darkMode ? resolveDarkAccent("actionRed", ACTION.red, "#FF7A7E") : ACTION.red) : ACCENTS.healthcare;
  return (
    <div style={{ margin: "10px 16px 12px", padding: "10px 12px", borderRadius: 10, border: `1px solid ${color}`, background: `${color}14`, fontSize: 12, color: T.textPrimary, lineHeight: 1.5 }}>
      {text}
    </div>
  );
}

// ADDED 26 Aug 2026 — real ask: Stats page, grouped by context
// (Activity/Healthcare/Medication/Contacts), each stat with a
// clickable info explaining the calculation and citing real clinical
// guidance where relevant (BASHH), not just internal app logic.
function StatsScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();

  const encounters = useLoadedMemo(() => EncounterRepository.getAll(), [], []);
  const contacts = useLoadedMemo(() => ContactRepository.getAll(), [], []);
  const tests = useLoadedMemo(() => TestingRepository.getAll(), [], []);
  // computeAdherence() reads med.logs directly — not part of the raw
  // repository record, so it has to be stitched on here too (same as
  // SHOS_Medication_Dashboard_Prototype.jsx's loadMedications()).
  const medications = useLoadedMemo(() => MedicationRepository.getAll().map((med) => ({ ...med, logs: LogRepository.getForMedication(med.id) })), [], []);
  // ADDED — real ask: "expand stats".
  const symptomEntries = useLoadedMemo(() => SymptomLogRepository.getAll(), [], []);
  const clinicVisits = useLoadedMemo(() => ClinicVisitsRepository.getAll(), [], []);

  const activityMonths = useMemo(() => getActivitiesPerMonth(encounters, 6), [encounters]);
  const topKinks = useMemo(() => getTopKinks(encounters, contacts, (id) => KinkRegistry.getById(id)?.name, 5), [encounters, contacts]);
  const testingStats = useMemo(() => getTestingFrequencyStats(tests), [tests]);
  // ADDED — real ask: "Stats is descriptive, not predictive" — a real
  // nudge against the person's OWN pattern (not just the fixed BASHH
  // benchmark above), see getTestingIntervalTrend's own comment for
  // the two distinct comparisons this covers.
  const testingTrend = useMemo(() => getTestingIntervalTrend(tests), [tests]);
  const adherence = useMemo(() => getOverallAdherence(medications, computeAdherence), [medications]);
  const doxyCompliance = useMemo(() => {
    const doxyMed = findDoxyPepMedication(medications);
    if (!doxyMed) return null;
    return getDoxyPepComplianceRate(encounters, LogRepository.getForMedication(doxyMed.id), isQualifyingEncounter, DOXYPEP_WINDOW_HOURS);
  }, [encounters, medications]);
  const contactMonths = useMemo(() => getContactsAddedPerMonth(contacts, 6), [contacts]);
  // ADDED — real ask: "expand stats". See getAdherenceTrend's own
  // comment for why this is deliberately a simpler, self-contained
  // measure rather than reusing computeAdherence() (hardcoded to
  // "today", not safely reusable for a past month).
  const adherenceTrend = useMemo(() => getAdherenceTrend(medications, 6), [medications]);
  const topSymptoms = useMemo(() => getTopSymptoms(symptomEntries, (id) => SymptomsRegistry.getById(id)?.name, 5), [symptomEntries]);
  const clinicVisitStats = useMemo(() => getClinicVisitStats(clinicVisits), [clinicVisits]);
  const clinicVisitMonths = useMemo(() => getClinicVisitsPerMonth(clinicVisits, 6), [clinicVisits]);

  const maxActivity = Math.max(1, ...activityMonths.map((b) => b.count));
  const maxContacts = Math.max(1, ...contactMonths.map((b) => b.count));
  const maxClinicVisits = Math.max(1, ...clinicVisitMonths.map((b) => b.count));

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Stats</span>
      </div>
      <div style={{ padding: 16 }}>

        {/* Activity */}
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENTS.encounters, textTransform: "uppercase", letterSpacing: 0.5, padding: "0 0 6px" }}>Encounter</div>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "12px 16px", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>Encounters per month</span>
            </div>
            {/* ADDED — real ask: bars had no visible value, unreadable
                on mobile touch (no hover). Raw count printed above each
                bar, same pattern applied consistently across all 4 bar
                charts in this screen (see the other 3 below). */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 78 }}>
              {activityMonths.map((b) => (
                <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>{b.count}</span>
                  <div style={{ width: "100%", height: `${Math.max(4, (b.count / maxActivity) * 44)}px`, background: ACCENTS.encounters, borderRadius: 3 }} />
                  <span style={{ fontSize: 9, color: darkMode ? DARK.textDisabled : "#656568" }}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: "12px 16px" }}>
            <div style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 8 }}>Top kinks/roles logged</div>
            {topKinks.length === 0 ? (
              <div style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : "#656568", fontStyle: "italic" }}>Nothing logged yet.</div>
            ) : topKinks.map((k) => (
              <div key={k.name} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>{k.name}</span>
                <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62", fontWeight: 600 }}>{k.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Healthcare */}
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENTS.healthcare, textTransform: "uppercase", letterSpacing: 0.5, padding: "0 0 6px" }}>Healthcare</div>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, overflow: "hidden", marginBottom: 20 }}>
          <StatRow label="Tests logged" value={testingStats.testCount}
            explanation="Total non-archived tests with a real (not future-scheduled) date." />
          <StatRow label="Average interval between tests"
            value={testingStats.averageIntervalDays != null ? `${testingStats.averageIntervalDays} days` : "Not enough data"}
            explanation="Average days between consecutive tests. Needs at least 2 real tests to calculate." />
          <StatRow label="Within BASHH-recommended interval?"
            value={testingStats.withinBashhInterval == null ? "—" : testingStats.withinBashhInterval ? "Yes" : "No"}
            explanation={`BASHH's 2023 summary guidance recommends 3-monthly (90-day) asymptomatic STI screening for higher-risk groups, matching CDC's own 3–6 month guidance for PrEP users. This compares days since your last test against that 90-day reference point — not a personalised recommendation, just the cited benchmark.`}
            sourceUrl={BASHH_TESTING_SOURCE_URL} />
          {testingTrend.currentGapVsAverage && (
            <TrendInsight T={darkMode ? DARK : NEUTRAL}
              tone={testingTrend.currentGapVsAverage.direction === "longer" ? "alert" : "neutral"}
              text={`It's been ${testingTrend.currentGapVsAverage.daysSinceLast} days since your last test — ${testingTrend.currentGapVsAverage.percent}% ${testingTrend.currentGapVsAverage.direction} than your own average gap of ${testingTrend.currentGapVsAverage.averageIntervalDays} days.`} />
          )}
          {testingTrend.recentTrend && (
            <TrendInsight T={darkMode ? DARK : NEUTRAL}
              tone={testingTrend.recentTrend.direction === "up" ? "alert" : "neutral"}
              text={`Your testing interval has been trending ${testingTrend.recentTrend.direction === "up" ? "longer" : "shorter"} lately — recently averaging ${testingTrend.recentTrend.recentAvgDays} days between tests, vs. ${testingTrend.recentTrend.earlierAvgDays} days earlier on (${testingTrend.recentTrend.percent}% ${testingTrend.recentTrend.direction === "up" ? "slower" : "faster"}).`} />
          )}
        </div>

        {/* ADDED — real ask: "expand stats". Symptoms had no stats
            section at all before this — same "Top X" list pattern
            already established for kinks above. */}
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENTS.healthcare, textTransform: "uppercase", letterSpacing: 0.5, padding: "0 0 6px" }}>Symptoms</div>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "12px 16px" }}>
            <div style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 8 }}>Most logged symptoms</div>
            {topSymptoms.length === 0 ? (
              <div style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : "#656568", fontStyle: "italic" }}>Nothing logged yet.</div>
            ) : topSymptoms.map((s) => (
              <div key={s.name} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>{s.name}</span>
                <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62", fontWeight: 600 }}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ADDED — real ask: "expand stats". Clinic Visits had no stats
            section at all before this — same monthly-bar-chart pattern
            already established for Activity/Contacts below. */}
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENTS.healthcare, textTransform: "uppercase", letterSpacing: 0.5, padding: "0 0 6px" }}>Clinic visits</div>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "12px 16px", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>Visits per month</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 78 }}>
              {clinicVisitMonths.map((b) => (
                <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>{b.count}</span>
                  <div style={{ width: "100%", height: `${Math.max(4, (b.count / maxClinicVisits) * 44)}px`, background: ACCENTS.healthcare, borderRadius: 3 }} />
                  <span style={{ fontSize: 9, color: darkMode ? DARK.textDisabled : "#656568" }}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>
          <StatRow label="Days since last visit" value={clinicVisitStats.daysSinceLast != null ? `${clinicVisitStats.daysSinceLast} days` : "No past visits logged"}
            explanation="Days since your most recent real (already happened, not a future booking) clinic visit." />
        </div>

        {/* Medication */}
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENTS.medication, textTransform: "uppercase", letterSpacing: 0.5, padding: "0 0 6px" }}>Medication</div>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, overflow: "hidden", marginBottom: 20 }}>
          <StatRow label="Overall adherence (7-day)" value={adherence != null ? `${adherence}%` : "Not enough data"}
            explanation="Average of each daily/scheduled medication's own 7-day adherence rate (doses actually logged vs. doses expected). PRN medications aren't included — there's no fixed expected schedule to measure against." />
          <StatRow label="DoxyPEP compliance" value={doxyCompliance != null ? `${doxyCompliance}%` : "No DoxyPEP medication set up"}
            explanation="Of each qualifying-activity window (see the DoxyPEP alert's own logic — mucous-membrane contact, BASHH/CDC-sourced), the percentage where a dose was actually logged within the real 72-hour window. Sequential activity in the same window counts once, matching the real alert's own anchoring rule." />
          {/* ADDED — real ask: "expand stats" — the adherence figure
              above was a single current snapshot with no sense of
              whether things are improving or slipping over time. A
              deliberately SIMPLER measure than the precise figure
              above (see getAdherenceTrend's own comment) — labelled
              honestly as such, not presented as the same number. */}
          <div style={{ padding: "12px 16px" }}>
            <div style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 4 }}>Adherence trend (days with a dose logged, per month)</div>
            <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : "#656568", marginBottom: 10 }}>A simpler month-by-month measure than the precise 7-day figure above — useful for spotting a trend, not a like-for-like comparison.</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 78 }}>
              {adherenceTrend.map((b) => (
                <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: b.pct != null ? (darkMode ? DARK.textSecondary : "#5B5B62") : (darkMode ? DARK.textDisabled : "#656568") }}>{b.pct != null ? `${b.pct}%` : "–"}</span>
                  <div style={{ width: "100%", height: b.pct != null ? `${Math.max(4, (b.pct / 100) * 44)}px` : "4px", background: b.pct != null ? ACCENTS.medication : (darkMode ? DARK.border : "#DCDCE1"), borderRadius: 3 }} />
                  <span style={{ fontSize: 9, color: darkMode ? DARK.textDisabled : "#656568" }}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Contacts */}
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENTS.contacts, textTransform: "uppercase", letterSpacing: 0.5, padding: "0 0 6px" }}>Contacts</div>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>Contacts added per month</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 78 }}>
              {contactMonths.map((b) => (
                <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>{b.count}</span>
                  <div style={{ width: "100%", height: `${Math.max(4, (b.count / maxContacts) * 44)}px`, background: ACCENTS.contacts, borderRadius: 3 }} />
                  <span style={{ fontSize: 9, color: darkMode ? DARK.textDisabled : "#656568" }}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ADDED 26 Aug 2026 — real ask: hex/RGB entry alongside the native
// colour picker, since that alone "feels v dated". CMYK deliberately
// NOT implemented — it's a print colour model, not a screen one;
// converting a CMYK value to the RGB this app actually renders in is
// inherently lossy/approximate, and offering it would imply an
// accuracy that doesn't really exist for on-screen colour.
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
function rgbToHex(r, g, b) {
  const clamp = (n) => Math.max(0, Math.min(255, Number(n) || 0));
  return "#" + [clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, "0")).join("");
}

// ADDED — real ask: "on sliders page for colour selection, can we
// maybe have optional user switch to colour wheel as well... then no
// previous hex needed to know." The native input[type=color] below is
// whatever picker the device/WebView happens to ship (varies by
// Android version — sometimes a wheel, sometimes a plain RGB slider
// grid), and typing hex/RGB both assume you already know a value to
// start from. h: 0-360, s/v: 0-100 — standard HSV, not HSL, since a
// wheel (hue x saturation) with a separate brightness axis is the
// familiar "colour wheel" shape people expect, not what HSL would draw.
function hsvToHex(h, s, v) {
  s /= 100; v /= 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}
function hexToHsv(hex) {
  const rgb = hexToRgb(hex) || { r: 0, g: 0, b: 0 };
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
}
// Renders the wheel itself into a canvas at a fixed brightness (V) —
// hue as angle, saturation as distance from centre, the standard "HSV
// wheel" shape. Recomputed only when V changes (the brightness slider
// moves), not on every hue/saturation pick — picking a point on an
// already-drawn wheel is just reading its angle/distance, no redraw
// needed.
function drawColorWheel(canvas, v) {
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const radius = size / 2;
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - radius, dy = y - radius;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * size + x) * 4;
      if (dist > radius) continue; // leave transparent outside the circle
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      angle = (angle + 360) % 360;
      const s = Math.min(100, (dist / radius) * 100);
      const rgb = hexToRgb(hsvToHex(angle, s, v));
      data[idx] = rgb.r; data[idx + 1] = rgb.g; data[idx + 2] = rgb.b; data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}
// The picker component itself — a canvas wheel (drag/tap to set hue +
// saturation) plus one brightness slider underneath, so no dimension
// this app's colours need (full HSV space) is left unreachable. Reads
// its current hue/saturation/brightness straight from currentValue
// every render rather than its own separate copy — the same value the
// parent already owns via ModuleColorRepository, avoiding a second
// source of truth that could drift from what Hex/RGB or the native
// picker show for the same colour.
function ColorWheelPicker({ currentValue, onPick, darkMode }) {
  const canvasRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const size = 200;
  const { h, s, v } = hexToHsv(currentValue);

  useEffect(() => {
    if (canvasRef.current) drawColorWheel(canvasRef.current, v);
  }, [v]);

  const pickFromEvent = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    const x = point.clientX - rect.left, y = point.clientY - rect.top;
    const radius = rect.width / 2;
    const dx = x - radius, dy = y - radius;
    const dist = Math.min(radius, Math.sqrt(dx * dx + dy * dy));
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    angle = (angle + 360) % 360;
    const sat = Math.min(100, (dist / radius) * 100);
    onPick(hsvToHex(angle, sat, v));
  };

  const markerAngleRad = (h * Math.PI) / 180;
  const markerRadius = (s / 100) * (size / 2);
  const markerX = size / 2 + markerRadius * Math.cos(markerAngleRad);
  const markerY = size / 2 + markerRadius * Math.sin(markerAngleRad);

  return (
    <div>
      <div
        style={{ position: "relative", width: size, height: size, margin: "0 auto", touchAction: "none" }}
        onPointerDown={(e) => { setDragging(true); pickFromEvent(e); }}
        onPointerMove={(e) => { if (dragging) pickFromEvent(e); }}
        onPointerUp={() => setDragging(false)}
        onPointerLeave={() => setDragging(false)}
      >
        <canvas ref={canvasRef} width={size} height={size} style={{ width: size, height: size, borderRadius: "50%", display: "block", cursor: "pointer" }} />
        <div style={{
          position: "absolute", left: markerX - 8, top: markerY - 8, width: 16, height: 16, borderRadius: "50%",
          background: currentValue, border: "2px solid #FFFFFF", boxShadow: "0 0 0 1px rgba(0,0,0,.5)", pointerEvents: "none",
        }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
        <span style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", flexShrink: 0 }}>Brightness</span>
        <input type="range" min="0" max="100" value={Math.round(v)}
          onChange={(e) => onPick(hsvToHex(h, s, Number(e.target.value)))}
          style={{ flex: 1 }} />
      </div>
    </div>
  );
}

function ColorInputRow({ colorKey, currentValue, isOverridden, onSetColor, onReset, label }) {
  const [darkMode] = useDarkModePreference();

  const [expanded, setExpanded] = useState(false);
  // ADDED — real ask: optional colour wheel alongside the existing
  // Hex/RGB fields, so picking a colour never requires already knowing
  // a value. Wheel is the default tab on expand — the whole point of
  // the ask was "no previous hex needed to know" — Hex/RGB stays one
  // tap away for anyone who does have a specific value in mind.
  const [panelMode, setPanelMode] = useState("wheel");
  const [hexDraft, setHexDraft] = useState(currentValue);
  const rgb = hexToRgb(currentValue) || { r: 0, g: 0, b: 0 };

  const commitHex = (v) => {
    setHexDraft(v);
    if (/^#?[a-f\d]{6}$/i.test(v)) onSetColor(colorKey, v.startsWith("#") ? v : `#${v}`);
  };
  const commitRgbChannel = (channel, value) => {
    const next = { ...rgb, [channel]: value };
    onSetColor(colorKey, rgbToHex(next.r, next.g, next.b));
  };

  return (
    <div style={{ borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div onClick={() => setExpanded((e) => !e)} style={{ width: 16, height: 16, borderRadius: "50%", background: currentValue, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", cursor: "pointer" }} />
          <span style={{ fontSize: 14, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 500 }}>{label}</span>
          {isOverridden && <span style={{ fontSize: 10, color: darkMode ? DARK.textDisabled : "#656568", fontStyle: "italic" }}>(customised)</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isOverridden && (
            <ResetIcon size={16} color={darkMode ? DARK.textDisabled : "#656568"} style={{ cursor: "pointer" }} onClick={onReset} title="Reset to default" />
          )}
          {/* REMOVED 1 Sep 2026 — real ask: "colour buttons sit on a
              white background... looks visually out of place." That
              was this native input[type=color] swatch button — its box
              is drawn by the OS/WebView itself, not this app, so it
              can't be reliably restyled to match either theme (dark
              mode especially showed it as a stray white box next to an
              otherwise dark row). Not a loss of function: the circular
              preview dot to the left already opens the exact same row
              (onClick={() => setExpanded}), and the real picker for
              actually choosing a colour is the wheel/Hex/RGB panel
              below, built specifically because native pickers alone
              "feel v dated" (see ColorWheelPicker's own comment) — this
              button was a second, redundant entry point to that same
              native picker the app already moved away from. */}
          <span onClick={() => setExpanded((e) => !e)} style={{ fontSize: 11, color: "#3D63C9", fontWeight: 600, cursor: "pointer" }}>{expanded ? "Hide" : "Customise"}</span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: "0 16px 14px" }}>
          <div style={{ display: "flex", gap: 18, marginBottom: 14 }}>
            {[["wheel", "Colour wheel"], ["hexrgb", "Hex/RGB"]].map(([mode, tabLabel]) => (
              <span key={mode} onClick={() => setPanelMode(mode)}
                style={{
                  fontSize: 12, fontWeight: 700, cursor: "pointer", paddingBottom: 4,
                  color: panelMode === mode ? "#3D63C9" : (darkMode ? DARK.textDisabled : "#656568"),
                  borderBottom: panelMode === mode ? "2px solid #3D63C9" : "2px solid transparent",
                }}>
                {tabLabel}
              </span>
            ))}
          </div>
          {panelMode === "wheel" ? (
            <ColorWheelPicker currentValue={currentValue} darkMode={darkMode}
              onPick={(hex) => { onSetColor(colorKey, hex); setHexDraft(hex); }} />
          ) : (
            <>
              <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 4 }}>Hex</div>
              <input value={hexDraft} onChange={(e) => commitHex(e.target.value)} placeholder="#RRGGBB"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontFamily: "monospace", fontSize: 13, marginBottom: 10, boxSizing: "border-box" }} />
              <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 4 }}>RGB</div>
              <div style={{ display: "flex", gap: 8 }}>
                {["r", "g", "b"].map((channel) => (
                  <input key={channel} type="number" min="0" max="255" value={rgb[channel]}
                    onChange={(e) => commitRgbChannel(channel, e.target.value)}
                    style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 13, boxSizing: "border-box" }} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ADDED 26 Aug 2026 — real ask: Trash / recently deleted, a genuine
// persistent holding area distinct from the 8s undo toast built
// earlier this session — that toast only covers the immediate moment
// of deletion, this is for "I deleted this three days ago and want it
// back." 30-day retention, matching common conventions (Photos apps,
// most email clients).
const TRASH_REPOSITORIES = {
  contacts: ContactRepository,
  encounters: EncounterRepository,
  testing: TestingRepository,
  clinicVisits: ClinicVisitsRepository,
  symptomLog: SymptomLogRepository,
  vaccinations: VaccinationRepository,
  medications: MedicationRepository,
  measurements: MeasurementRepository,
};

// ADDED 26 Aug 2026 — real ask: calendar view, Google-Calendar-style,
// pulling real events from every module. Lives in Settings per the user's
// own placement call — Healthcare (where Timeline currently sits) is
// domain-specific, wrong home for something cross-module; Home
// already has its own Timeline shortcut, so a full duplicate there
// would be redundant. A compact icon-based entry point on Home
// supplements this (see SHOS_Home_Prototype.jsx), not a second full
// shortcut. See calendarCalculations.js for the real scope decision
// on what counts as an "event" (daily medication doses deliberately
// excluded — see that file's own comment for why).
const CALENDAR_MODULE_TARGETS = {
  encounters: { tab: "activity", subTab: null },
  testing: { tab: "healthcare", subTab: "testing" },
  clinicVisits: { tab: "healthcare", subTab: "clinicVisits" },
  vaccinations: { tab: "healthcare", subTab: "vaccinations" },
  symptomLog: { tab: "healthcare", subTab: "symptomLog" },
  medications: { tab: "medication", subTab: null },
};

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
const GLOSSARY_TERMS = [
  { term: "PrEP", body: "Pre-exposure prophylaxis — medication taken regularly (daily, or event-based around sex) before an exposure, to reduce the chance of getting HIV." },
  { term: "PEP", body: "Post-exposure prophylaxis — a course of HIV medication started within 72 hours after a potential HIV exposure, to reduce the chance of infection taking hold." },
  { term: "DoxyPEP", body: "Doxycycline post-exposure prophylaxis — a single dose of the antibiotic doxycycline, taken within 72 hours after condomless oral, vaginal, or anal sex, shown to reduce the chance of some bacterial STIs (see Resources → Sexual health for the full guidance)." },
  { term: "Doxy", body: "Shorthand for doxycycline, the antibiotic used in DoxyPEP." },
  { term: "TOC (Test of cure)", body: "A follow-up test done after treatment for an infection, to confirm it's actually cleared rather than assuming the treatment worked." },
  { term: "C&S (Culture & sensitivity)", body: "A lab test that grows a sample to identify exactly which bacteria are present and which antibiotics will treat it — used when a standard test isn't specific enough, e.g. for an antibiotic-resistant infection." },
  { term: "Window period", body: "The time after a possible exposure during which a test may not yet reliably detect an infection, even if present — testing too early can give a false negative." },
  { term: "Most recent", body: "This app's own label for the newest test covering a given infection, so an older, superseded result doesn't get confused with your current status." },
  { term: "BASHH", body: "British Association for Sexual Health and HIV — the UK's professional body for sexual health clinical guidance. Several of this app's own defaults (like the 90-day retesting interval) are based on its published guidance." },
  { term: "MGen (Mycoplasma genitalium)", body: "A bacterial STI, less well known than chlamydia or gonorrhoea, that can cause similar symptoms and sometimes needs specific antibiotic-resistance testing." },
  { term: "HSV (Herpes simplex virus)", body: "The virus that causes genital and oral herpes. HSV-1 and HSV-2 are the two types — either can occur at either site." },
  { term: "HPV (Human papillomavirus)", body: "A very common virus. Some strains are linked to genital warts, others to certain cancers — a vaccine exists and is recommended for some groups." },
  { term: "Chemsex", body: "Using drugs (commonly crystal meth, GHB/GBL, or mephedrone) before or during sex, typically to enhance or prolong the experience — see Resources → Drugs & chemsex for safety-specific guidance." },
  { term: "Cruising / PSE (Public sex environment)", body: "Meeting sexual partners in public or semi-public spaces (e.g. parks, saunas) — see Resources → Public sex & cruising for safety-specific guidance." },
];

function GlossaryScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : NEUTRAL;
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q ? GLOSSARY_TERMS.filter((t) => t.term.toLowerCase().includes(q) || t.body.toLowerCase().includes(q)) : GLOSSARY_TERMS;

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Glossary</span>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 16, lineHeight: 1.4 }}>
          Plain-language explanations of the clinical shorthand used elsewhere in this app — informational, not personalised medical advice.
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search terms"
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box", marginBottom: 16 }} />
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 16px", color: T.textDisabled, fontSize: 13 }}>No terms match your search.</div>
        ) : (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, overflow: "hidden" }}>
            {filtered.map((t) => (
              <div key={t.term} style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, marginBottom: 3 }}>{t.term}</div>
                <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.4 }}>{t.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ADDED 26 Aug 2026 — real ask: About/version screen, a genuine
// missing basic flagged in the final audit. version/buildDate come
// from package.json and the actual build timestamp — real values,
// not decorative. GitHub link points at the actual repo so a real
// build issue can be traced back to source.
function AboutScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>About</span>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{ ...TYPE.recordTitle, color: darkMode ? DARK.textPrimary : "#1B1B1F", marginBottom: 4 }}>SHOS</div>
          <div style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : "#656568" }}>Sexual Health Operating System</div>
        </div>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
            <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>Version</span>
            {/* CHANGED — real ask: was hardcoded placeholder, now reads
                the actual version from package.json rather than a
                second, easy-to-forget copy of the same number. */}
            <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 600 }}>{APP_VERSION}</span>
          </div>
          {/* ADDED — real ask: "getting version back to fixes already
              done" — package.json's version had genuinely never been
              bumped since the first commit, so this row alone couldn't
              tell you which of many real builds was installed. Build
              (the actual short commit SHA, baked in automatically at
              build time via vite.config.js — see its own comment)
              never goes stale the way a manually-remembered version
              bump would. */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
            <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>Build</span>
            <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 600, fontFamily: "monospace" }}>{typeof __BUILD_SHA__ !== "undefined" ? __BUILD_SHA__ : "dev"}</span>
          </div>
          {/* CHANGED — real fix: pointed at the old private repo this
              project moved off of — the public repo everyone's actual
              builds/releases now come from is SHOS-V2. */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
            <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>Repository</span>
            <a href="https://github.com/drwho2001/SHOS-V2" target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#3D63C9", fontWeight: 600 }}>
              GitHub →
            </a>
          </div>
          {/* ADDED — real ask: link the no-install web version alongside
              the native app's own version/repo info, for anyone on iOS
              or a computer who can't install the APK. */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px" }}>
            <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>Web app (iPhone / computer)</span>
            <a href="https://drwho2001.github.io/SHOS-V2/" target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#3D63C9", fontWeight: 600 }}>
              Open →
            </a>
          </div>
        </div>
        <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : "#656568", textAlign: "center", marginTop: 16 }}>
          Local-first — nothing here leaves this device unless you choose to export or share it.
        </div>
      </div>
    </div>
  );
}

// ADDED — real ask: "maybe better to move/copy calendar share options
// to calendar page settings... doesn't have to exist in a settings
// menu, can exist as icon." Moved out of Settings -> Privacy entirely
// (not duplicated — one place to own this state, so the toggle can
// never drift out of sync between two copies) into its own sheet,
// opened directly from the Calendar screen's own header icon — the
// screen someone would actually think to check for "can this sync to
// my phone's calendar," not a generic Settings menu several taps away.
function CalendarSyncSheet({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const [appPrefs, setAppPrefs] = useLoadedState(() => AppPreferencesRepository.getPreferences(), [], DEFAULT_APP_PREFERENCES);
  const [calendarSyncError, setCalendarSyncError] = useState("");
  const [calendarSyncing, setCalendarSyncing] = useState(false);
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [availableCalendars, setAvailableCalendars] = useState(null);

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
      AppPreferencesRepository.update({ calendarSyncEnabled: false, calendarSyncTargetName: null });
      setAppPrefs(AppPreferencesRepository.getPreferences());
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
    AppPreferencesRepository.update({ calendarSyncEnabled: true });
    setAppPrefs(AppPreferencesRepository.getPreferences());
    await syncClinicVisitsToCalendar(ClinicVisitsRepository.getAll());
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
    AppPreferencesRepository.update({ calendarSyncTargetName: name });
    setAppPrefs(AppPreferencesRepository.getPreferences());
    await syncClinicVisitsToCalendar(ClinicVisitsRepository.getAll());
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
    AppPreferencesRepository.update({ calendarSyncGenericTitle: !appPrefs.calendarSyncGenericTitle });
    setAppPrefs(AppPreferencesRepository.getPreferences());
    await syncClinicVisitsToCalendar(ClinicVisitsRepository.getAll());
    setCalendarSyncing(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 300 }} onClick={() => !calendarSyncing && onClose()}>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", width: "100%", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Phone calendar sync</span>
          <X size={18} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} aria-label="Close calendar sync settings" />
        </div>

        <div onClick={calendarSyncing ? undefined : toggleCalendarSync} role="switch" tabIndex={0} aria-checked={appPrefs.calendarSyncEnabled} aria-label="Sync clinic appointments to phone calendar"
          onKeyDown={calendarSyncing ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCalendarSync(); } }}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: calendarSyncing ? "default" : "pointer" }}>
          <div style={{ flex: 1, paddingRight: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Sync clinic appointments to phone calendar</div>
            <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 2 }}>
              Booked appointments appear in your phone's real calendar app. Defaults to its own private "SHOS (private)" calendar — never a synced/shared one, never sent anywhere. Turning this off removes everything this app put there.
            </div>
            {calendarSyncError && <div style={{ fontSize: 11, color: ACTION.red, marginTop: 4 }}>{calendarSyncError}</div>}
          </div>
          <div style={{ width: 40, height: 24, borderRadius: 999, background: appPrefs.calendarSyncEnabled ? ACCENTS.healthcare : "#DCDCE1", position: "relative", flexShrink: 0, opacity: calendarSyncing ? 0.6 : 1 }}>
            <div style={{ position: "absolute", top: 2, left: appPrefs.calendarSyncEnabled ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: "#FFFFFF" }} />
          </div>
        </div>

        {appPrefs.calendarSyncEnabled && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
            <div onClick={calendarSyncing ? undefined : openCalendarPicker} role="button" tabIndex={0}
              onKeyDown={calendarSyncing ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCalendarPicker(); } }}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: calendarSyncing ? "default" : "pointer" }}>
              <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>Syncing to:</div>
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
                <div style={{ fontSize: 12, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Use a generic event title</div>
                <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 2 }}>
                  "Clinic appointment" instead of this visit's own title — safer if reminders show on your lock screen.
                </div>
              </div>
              <div style={{ width: 40, height: 24, borderRadius: 999, background: appPrefs.calendarSyncGenericTitle ? ACCENTS.healthcare : "#DCDCE1", position: "relative", flexShrink: 0, opacity: calendarSyncing ? 0.6 : 1 }}>
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
                  <AlertTriangle size={14} color="#B45309" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#B45309" }}>Not private by default</span>
                </div>
                <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", lineHeight: 1.5 }}>
                  This app can't control whether "{appPrefs.calendarSyncTargetName}" is shared with anyone else — that's entirely up to how that calendar's own account is set up. If it's a Google Calendar, check it isn't set to "Make available to public" and isn't shared under its own sharing settings. If it's Outlook, check Calendar settings → Shared calendars. If it's Apple/iCloud, check Calendar → Edit → Shared With. When in doubt, switch back to the private "SHOS (private)" calendar above.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Calendar target picker — real device calendars only, loaded
            on first open. Always offers the private default first. */}
        {showCalendarPicker && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F", marginBottom: 4 }}>Sync appointments to</div>
            <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 12 }}>Only calendars already on this device — nothing new is ever created except the private option below.</div>
            <div onClick={() => !calendarSyncing && selectCalendarTarget(null)} role="radio" tabIndex={0} aria-checked={!appPrefs.calendarSyncTargetName}
              onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !calendarSyncing) { e.preventDefault(); selectCalendarTarget(null); } }}
              style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${!appPrefs.calendarSyncTargetName ? ACCENTS.healthcare : (darkMode ? DARK.border : "#DCDCE1")}`, background: !appPrefs.calendarSyncTargetName ? `${ACCENTS.healthcare}10` : "transparent", cursor: "pointer", marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>SHOS (private) — recommended</div>
              <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 2 }}>On-device only, structurally can't sync or be shared.</div>
            </div>
            {availableCalendars === null && <div style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : "#656568", textAlign: "center", padding: 10 }}>Loading calendars…</div>}
            {availableCalendars?.length === 0 && (
              <div style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : "#656568", textAlign: "center", padding: 10 }}>No other calendars found on this device.</div>
            )}
            {availableCalendars?.map((cal) => (
              <div key={cal.id} onClick={() => !calendarSyncing && selectCalendarTarget(cal.name)} role="radio" tabIndex={0} aria-checked={appPrefs.calendarSyncTargetName === cal.name}
                onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !calendarSyncing) { e.preventDefault(); selectCalendarTarget(cal.name); } }}
                style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${appPrefs.calendarSyncTargetName === cal.name ? ACCENTS.healthcare : (darkMode ? DARK.border : "#DCDCE1")}`, background: appPrefs.calendarSyncTargetName === cal.name ? `${ACCENTS.healthcare}10` : "transparent", cursor: "pointer", marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>{cal.displayName || cal.name}</div>
                <div style={{ fontSize: 11, color: "#B45309", marginTop: 2 }}>Not private by default — its own sharing settings apply.</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarScreen({ onClose, onNavigateToRecord }) {
  const [darkMode] = useDarkModePreference();

  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDay, setSelectedDay] = useState(null);
  // ADDED — real ask: phone-calendar sync now lives on this screen
  // directly (see CalendarSyncSheet's own comment for why it moved
  // out of Settings -> Privacy) — a header icon, not a settings-menu
  // entry. Re-read fresh each render (not memoized) so the icon's own
  // on/off look stays honest immediately after the sheet changes it.
  const [showSyncSheet, setShowSyncSheet] = useState(false);
  const syncEnabled = AppPreferencesRepository.getPreferences().calendarSyncEnabled;
  // ADDED 26 Aug 2026 — real ask: filters, standard on every other
  // module's list this session — shouldn't have been skipped here.
  const ALL_MODULE_KEYS = ["encounters", "testing", "clinicVisits", "vaccinations", "symptomLog", "medications"];
  const [showFilters, setShowFilters] = useState(false);
  const [activeModules, setActiveModules] = useState(ALL_MODULE_KEYS);
  const toggleModule = (key) => setActiveModules((cur) => cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]);

  const allEvents = useLoadedMemo(() => getCalendarEvents({
    encounters: EncounterRepository.getAll(),
    tests: TestingRepository.getAll(),
    clinicVisits: ClinicVisitsRepository.getAll(),
    vaccinations: VaccinationRepository.getAll(),
    symptomEntries: SymptomLogRepository.getAll(),
    medications: MedicationRepository.getAll(),
  }), [], []);
  const events = useMemo(() => allEvents.filter((e) => activeModules.includes(e.moduleKey)), [allEvents, activeModules]);
  const grouped = useMemo(() => groupEventsByDay(events), [events]);

  // ADDED — real ask: first day of week preference (Sunday/Monday,
  // default Monday). getDay() is always 0=Sun..6=Sat regardless of
  // preference — when the week starts Monday, shift it so Monday
  // lands in column 0 instead.
  const weekStartsOn = AppPreferencesRepository.getPreferences().weekStartsOn;
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
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
          <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Calendar</span>
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
              : <CloudArrowUp size={20} color={darkMode ? DARK.textSecondary : "#5B5B62"} />}
          </div>
          <span onClick={() => setShowFilters((s) => !s)} style={{ fontSize: 12, fontWeight: 600, color: activeModules.length < ALL_MODULE_KEYS.length ? "#3D63C9" : (darkMode ? DARK.textDisabled : "#5B5B62"), cursor: "pointer" }}>
            Filter{activeModules.length < ALL_MODULE_KEYS.length ? ` (${activeModules.length})` : ""}
          </span>
        </div>
      </div>
      {showFilters && (
        <div style={{ padding: "10px 16px 0", display: "flex", flexWrap: "wrap", gap: 6, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", paddingBottom: 10 }}>
          {ALL_MODULE_KEYS.map((key) => {
            const active = activeModules.includes(key);
            return (
              // FIXED 1 Sep 2026 — real bug found during the same
              // light/dark sweep as the day-number fix above: the
              // inactive-chip border/dot/text were hardcoded to
              // light-mode colors (#DCDCE1/#656568) regardless of
              // theme — nearly invisible against DARK.bg, unlike the
              // active chip (module accent, already theme-agnostic).
              <div key={key} onClick={() => toggleModule(key)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? ACCENTS[key] : (darkMode ? DARK.border : "#DCDCE1")}`, color: active ? ACCENTS[key] : (darkMode ? DARK.textDisabled : "#656568"), background: active ? `${ACCENTS[key]}15` : "transparent" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: active ? ACCENTS[key] : (darkMode ? DARK.textDisabled : "#656568") }} />
                {TRASH_MODULE_LABELS[key]}
              </div>
            );
          })}
        </div>
      )}
      <div style={{ padding: 16 }}>
        {/* CHANGED — real ask: "doesn't have to exist in a settings
            menu, can exist as icon" — this used to be a dismissible
            hint banner pointing at Settings -> Privacy; now the header
            icon above IS the entry point (and its own filled/outline
            look already says whether sync is on), so a second, more
            intrusive banner here would just be redundant. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <ChevronLeft size={20} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={() => { setCursor(new Date(year, month - 1, 1)); setSelectedDay(null); }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>{cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
          <ChevronRight size={20} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={() => { setCursor(new Date(year, month + 1, 1)); setSelectedDay(null); }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
          {WEEKDAY_LABELS.map((d, i) => (
            <div key={i} style={{ textAlign: "center", fontSize: 11, color: darkMode ? DARK.textDisabled : "#656568", fontWeight: 700, padding: "4px 0" }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const key = dayKey(day);
            const dayEvents = grouped[key] || [];
            const isToday = key === todayKey;
            const isSelected = selectedDay === day;
            const moduleColorsPresent = [...new Set(dayEvents.map((e) => e.moduleKey))].map((k) => ACCENTS[k] || "#656568");
            return (
              <div key={i} onClick={() => setSelectedDay(isSelected ? null : day)}
                style={{ aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 8, cursor: "pointer", background: isSelected ? "#1B1B1F" : isToday ? (darkMode ? DARK.surfaceVariant : "#E7E7EB") : "transparent", gap: 2 }}>
                {/* FIXED 1 Sep 2026 — real bug found during a light/dark
                    sweep: every day number was hardcoded to #1B1B1F
                    (near-black) regardless of theme — nearly invisible
                    against DARK.bg, with only today's cell readable by
                    accident (its own light highlight background gave
                    the dark text something to contrast against). */}
                <span style={{ fontSize: 12, color: isSelected ? "#FFFFFF" : (darkMode ? DARK.textPrimary : "#1B1B1F"), fontWeight: isToday ? 700 : 400 }}>{day}</span>
                {moduleColorsPresent.length > 0 && (
                  <div style={{ display: "flex", gap: 2 }}>
                    {moduleColorsPresent.slice(0, 3).map((c, j) => <div key={j} style={{ width: 4, height: 4, borderRadius: "50%", background: c }} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selectedDay && (
          <div style={{ marginTop: 20 }}>
            <div style={{ ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : "#656568", marginBottom: 8 }}>
              {new Date(year, month, selectedDay).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            </div>
            {selectedEvents.length === 0 ? (
              <div style={{ fontSize: 13, color: darkMode ? DARK.textDisabled : "#656568", fontStyle: "italic" }}>Nothing logged this day.</div>
            ) : (
              <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, overflow: "hidden" }}>
                {selectedEvents.map((ev, i) => (
                  <div key={i} onClick={() => goToEvent(ev)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: i < selectedEvents.length - 1 ? `1px solid ${darkMode ? DARK.border : "#DCDCE1"}` : "none", cursor: "pointer" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: ACCENTS[ev.moduleKey] || "#656568", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
                      <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : "#656568" }}>{TRASH_MODULE_LABELS[ev.moduleKey] || ev.moduleKey}</div>
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

function TrashScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();

  const [items, setItems] = useLoadedState(() => TrashRepository.getAll(), [], []);
  const refresh = async () => setItems(await TrashRepository.getAll());
  // ADDED 26 Aug 2026 — real ask: 4 real actions (restore all/
  // selected, delete all/selected), with real multi-select on this
  // screen — reuses the exact same Select-toggle + toolbar pattern
  // already proven across every other module this session, rather
  // than inventing a new one just for Trash.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const toggleSelected = (id) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds([]); };

  const restoreEntries = async (entries) => {
    for (const entry of entries) {
      const repo = TRASH_REPOSITORIES[entry.moduleKey];
      if (repo) repo.restore(entry.record);
      await TrashRepository.removeEntry(entry.trashId);
    }
    refresh();
  };

  const restoreItem = (entry) => restoreEntries([entry]);
  const restoreAll = () => restoreEntries(items);
  const restoreSelected = async () => { await restoreEntries(items.filter((e) => selectedIds.includes(e.trashId))); exitSelectMode(); };

  const deletePermanently = async (entry) => {
    if (window.confirm("Delete this permanently? It won't be recoverable after this.")) {
      await TrashRepository.removeEntry(entry.trashId);
      refresh();
    }
  };
  const deleteAll = async () => {
    if (window.confirm(`Permanently delete all ${items.length} item${items.length > 1 ? "s" : ""} in the trash? This can't be undone.`)) {
      await TrashRepository.emptyAll();
      refresh();
    }
  };
  const deleteSelected = async () => {
    if (window.confirm(`Permanently delete ${selectedIds.length} item${selectedIds.length > 1 ? "s" : ""}? This can't be undone.`)) {
      for (const id of selectedIds) await TrashRepository.removeEntry(id);
      exitSelectMode();
      refresh();
    }
  };

  const recordLabel = (entry) => entry.record.title || entry.record.name || entry.record.displayName || "Untitled";

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
          <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Trash</span>
        </div>
        {items.length > 0 && (
          <span onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)} style={{ fontSize: 13, fontWeight: 600, color: "#3D63C9", cursor: "pointer" }}>
            {selectMode ? "Done" : "Select"}
          </span>
        )}
      </div>
      {selectMode && (
        <div style={{ background: "#1B1B1F", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600 }}>{selectedIds.length} selected</span>
          <div style={{ display: "flex", gap: 16 }}>
            <span onClick={() => selectedIds.length > 0 && restoreSelected()} style={{ fontSize: 13, color: selectedIds.length > 0 ? "#FFFFFF" : "#89898C", fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>Restore</span>
            <span onClick={() => selectedIds.length > 0 && deleteSelected()} style={{ fontSize: 13, color: selectedIds.length > 0 ? resolveDarkAccent("actionRed", ACTION.red, "#FF7A7E") : "#89898C", fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>Delete</span>
            <span onClick={exitSelectMode} style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600, cursor: "pointer" }}>Cancel</span>
          </div>
        </div>
      )}
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : "#656568", marginBottom: 14 }}>
          Deleted items stay here for 30 days before they're no longer shown. This is separate from the "tap to undo" that appears right after deleting something.
        </div>
        {items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: darkMode ? DARK.textDisabled : "#656568", fontSize: 13 }}>Nothing in the trash.</div>
        ) : (
          <>
            {/* ADDED 26 Aug 2026 — real ask: "restore all" and "delete
                all", not just per-item and not just selected — always
                visible when there's anything to act on, independent of
                select mode. */}
            {!selectMode && (
              <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                <span onClick={restoreAll} style={{ fontSize: 13, fontWeight: 600, color: "#3D63C9", cursor: "pointer" }}>Restore all</span>
                <span onClick={deleteAll} style={{ fontSize: 13, fontWeight: 600, color: ACTION.red, cursor: "pointer" }}>Delete all</span>
              </div>
            )}
            <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, overflow: "hidden" }}>
              {items.map((entry, i) => (
                <div key={entry.trashId} onClick={() => selectMode && toggleSelected(entry.trashId)}
                  {...(selectMode ? {
                    role: "checkbox", "aria-checked": selectedIds.includes(entry.trashId), "aria-label": recordLabel(entry), tabIndex: 0,
                    onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSelected(entry.trashId); } },
                  } : {})}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: i < items.length - 1 ? "1px solid #DCDCE1" : "none", cursor: selectMode ? "pointer" : "default" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                    {selectMode && (
                      <div style={{ width: 20, height: 20, borderRadius: 999, border: `2px solid ${selectedIds.includes(entry.trashId) ? "#3D63C9" : "#DCDCE1"}`, background: selectedIds.includes(entry.trashId) ? "#3D63C9" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {selectedIds.includes(entry.trashId) && <Check size={12} color="#FFFFFF" />}
                      </div>
                    )}
                    <div style={{ minWidth: 0, flex: 1, paddingRight: 10 }}>
                      <div style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{recordLabel(entry)}</div>
                      <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : "#656568", marginTop: 2 }}>{TRASH_MODULE_LABELS[entry.moduleKey] || entry.moduleKey} · deleted {new Date(entry.deletedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</div>
                    </div>
                  </div>
                  {!selectMode && (
                    <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                      <span onClick={() => restoreItem(entry)} style={{ fontSize: 12, fontWeight: 700, color: "#3D63C9", cursor: "pointer" }}>Restore</span>
                      <span onClick={() => deletePermanently(entry)} style={{ fontSize: 12, fontWeight: 700, color: ACTION.red, cursor: "pointer" }}>Delete</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DesignScreen({ onClose }) {
  const [overrides, setOverrides] = useLoadedState(() => ModuleColorRepository.getOverrides(), [], {});
  const [changed, setChanged] = useState(false);
  // ADDED 26 Aug 2026 — real ask: single global dark mode toggle here,
  // replacing Medication's own per-module icon. Same shared
  // useDarkModePreference() hook/storage key as before — only the
  // location of the control changed, not the preference itself.
  const [darkMode, setDarkMode] = useDarkModePreference();

  const setColor = (key, hex) => {
    ModuleColorRepository.setOverride(key, hex);
    setOverrides(ModuleColorRepository.getOverrides());
    setChanged(true);
  };
  const reset = (key) => {
    ModuleColorRepository.resetOverride(key);
    setOverrides(ModuleColorRepository.getOverrides());
    setChanged(true);
  };
  const resetAll = () => {
    ModuleColorRepository.resetAll();
    setOverrides({});
    setChanged(true);
  };
  // ADDED — real ask, 28 Aug 2026: a single toggle applying/removing
  // all 7 CVD_SAFE_PALETTE colours at once, via the same
  // setOverride()/resetOverride() mechanism as a manual pick — see
  // that constant's own comment in moduleColorRepository.js for the
  // research behind the exact hues. "On" is derived from the actual
  // stored overrides each render, not a separate flag.
  const cvdActive = ModuleColorRepository.isCvdPaletteActive();
  const toggleCvdPalette = () => {
    if (cvdActive) ModuleColorRepository.removeCvdPalette();
    else ModuleColorRepository.applyCvdPalette();
    setOverrides(ModuleColorRepository.getOverrides());
    setChanged(true);
  };

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Colour scheme</span>
      </div>
      <div style={{ padding: 16 }}>
        {changed && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", borderRadius: 12, background: "#1B1B1F", color: "#FFFFFF", fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={15} /> Colour changes need a reload to apply everywhere.
            </div>
            {/* ADDED 26 Aug 2026 — real ask: auto-reload on design edit.
                Not a true instant auto-reload — native colour inputs
                fire continuously while dragging in most browsers, so
                reloading on every event would interrupt you mid-pick.
                A one-tap reload right here, the moment you're done
                choosing, is the safe version of the same ask. */}
            <button onClick={() => window.location.reload()}
              style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid #FFFFFF", background: "transparent", color: "#FFFFFF", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
              Reload now
            </button>
          </div>
        )}
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
            <span style={{ fontSize: 14, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 500 }}>Dark mode</span>
            {/* CHANGED — real bug: the knob used to switch to
                DARK.surface (#1C1C1F) when on, nearly identical to the
                track's own #1B1B1F — the one control to turn dark mode
                OFF was invisible while IN dark mode. Every other toggle
                in this app keeps its knob solid white regardless of
                state (only the track colour changes) — matching that
                established pattern here too, plus the same subtle
                shadow those use for depth against a light track. */}
            <div onClick={() => setDarkMode((d) => !d)} role="switch" tabIndex={0} aria-checked={darkMode} aria-label="Dark mode"
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDarkMode((d) => !d); } }}
              style={{ width: 44, height: 26, borderRadius: 999, background: darkMode ? "#1B1B1F" : "#DCDCE1", position: "relative", cursor: "pointer", transition: "background 0.15s" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,.4)", position: "absolute", top: 3, left: darkMode ? 21 : 3, transition: "left 0.15s" }} />
            </div>
          </div>
        </div>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 500 }}>Colour-blind friendly palette</span>
              <div onClick={toggleCvdPalette} role="switch" tabIndex={0} aria-checked={cvdActive} aria-label="Colour-blind friendly palette"
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCvdPalette(); } }}
                style={{ width: 44, height: 26, borderRadius: 999, background: cvdActive ? "#1B1B1F" : "#DCDCE1", position: "relative", cursor: "pointer", transition: "background 0.15s", flexShrink: 0 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,.4)", position: "absolute", top: 3, left: cvdActive ? 21 : 3, transition: "left 0.15s" }} />
              </div>
            </div>
            {/* ADDED — real ask: brief, honest explanation of what this
                actually does, right where the toggle lives, since it's
                a research-backed preset rather than a self-explanatory
                control. */}
            <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 6, lineHeight: 1.4 }}>
              Swaps all module and status colours below for one shared set, checked
              (via real colour-blindness simulation, not just standard vision) to stay
              distinguishable and legible under protanopia, deuteranopia, AND
              tritanopia at once — one balanced set covering all three, not tuned to
              any single type. Turning it off resets those 7 colours back to their
              regular defaults, and every colour stays yours to fine-tune by hand
              below either way.
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#656568", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 0 6px" }}>Module colours</div>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, overflow: "hidden" }}>
          {CUSTOMIZABLE_MODULE_KEYS.map((key) => {
            const isOverridden = key in overrides;
            const currentValue = overrides[key] || ACCENTS[key];
            return (
              <ColorInputRow key={key} colorKey={key} currentValue={currentValue} isOverridden={isOverridden}
                label={MODULE_LABELS[key]} onSetColor={setColor} onReset={() => reset(key)} />
            );
          })}
        </div>
        {/* ADDED — real ask: the semantic pass/fail pair, editable
            alongside the 5 module colours — the single most relevant
            pair for colourblind usability specifically, since red/
            green confusion is the most common form. Wired app-wide,
            dark mode included — see designTokens.js's ACTION export
            and resolveDarkAccent(). */}
        <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#656568", textTransform: "uppercase", letterSpacing: 0.5, padding: "20px 0 6px" }}>Status colours</div>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, overflow: "hidden" }}>
          {CUSTOMIZABLE_ACTION_KEYS.map((key) => {
            const isOverridden = key in overrides;
            const currentValue = overrides[key] || ACTION[key === "actionRed" ? "red" : "green"];
            return (
              <ColorInputRow key={key} colorKey={key} currentValue={currentValue} isOverridden={isOverridden}
                label={ACTION_COLOR_LABELS[key]} onSetColor={setColor} onReset={() => reset(key)} />
            );
          })}
        </div>
        {Object.keys(overrides).length > 0 && (
          <div onClick={resetAll} style={{ marginTop: 14, fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62", textDecoration: "underline", cursor: "pointer", textAlign: "center" }}>
            Reset all to defaults
          </div>
        )}
      </div>
    </div>
  );
}

function InactiveThresholdCard({ T }) {
  const [prefs, setPrefs] = useLoadedState(() => AppPreferencesRepository.getPreferences(), [], DEFAULT_APP_PREFERENCES);
  const [draftValue, setDraftValue] = useState(() => String(prefs.inactiveThresholdDays));
  // ADDED 4 Sep 2026 — encryption groundwork: prefs now loads via an
  // effect instead of synchronously, so draftValue's own initializer
  // (which reads prefs.inactiveThresholdDays at mount) would otherwise
  // freeze on DEFAULT_APP_PREFERENCES' value forever once the real
  // prefs loads a tick later — same regression class as MyProfile's
  // form earlier in this audit. Resyncing on every prefs change is
  // safe here: the only thing that ever changes prefs while this card
  // is mounted is the user's own save() below, and resyncing to the
  // value they just saved is a no-op, not a clobber.
  useEffect(() => { setDraftValue(String(prefs.inactiveThresholdDays)); }, [prefs]);

  const save = () => {
    const parsed = parseInt(draftValue, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    setPrefs(AppPreferencesRepository.update({ inactiveThresholdDays: parsed }));
  };

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>Inactive contact threshold</div>
      <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 12 }}>
        Days since a Contact's last Encounter before it shows the red "inactive" flag. A specific contact can also be excluded from this entirely (edit that contact → "One-off / never expect to recur").
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={draftValue} onChange={(e) => setDraftValue(e.target.value)} type="number" min="1"
          style={{ width: 90, padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 14, boxSizing: "border-box", background: T.surfaceVariant, color: T.textPrimary }} />
        <span style={{ fontSize: 13, color: T.textSecondary }}>days</span>
        <button onClick={save} style={{ marginLeft: "auto", padding: "10px 18px", borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>
          Save
        </button>
      </div>
      <div style={{ fontSize: 11, color: T.textDisabled, marginTop: 10 }}>Currently: {prefs.inactiveThresholdDays} days.</div>
    </div>
  );
}

// ADDED — real ask: Menstrual/Contraception/Pregnancy tracking, gated
// behind this toggle rather than gender (menopause HRT/TRT tracking
// already established gender-based assumptions don't hold for who
// needs this). Off by default, same "opt-in feature area" toggle
// pattern as calendar sync above.
function MenstrualTrackingToggleCard({ T }) {
  const [prefs, setPrefs] = useLoadedState(() => AppPreferencesRepository.getPreferences(), [], DEFAULT_APP_PREFERENCES);
  const toggle = () => setPrefs(AppPreferencesRepository.update({ menstrualTrackingEnabled: !prefs.menstrualTrackingEnabled }));
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: 16 }}>
      <div onClick={toggle} role="switch" tabIndex={0} aria-checked={prefs.menstrualTrackingEnabled} aria-label="Menstrual & contraception tracking"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
        <div style={{ flex: 1, paddingRight: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Menstrual & contraception tracking</div>
          <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>Adds a Cycle/Contraception/Pregnancy tab under Healthcare. Off by default — turning it on doesn't depend on any other setting.</div>
        </div>
        <div style={{ width: 40, height: 24, borderRadius: 999, background: prefs.menstrualTrackingEnabled ? ACCENTS.healthcare : "#DCDCE1", position: "relative", flexShrink: 0 }}>
          <div style={{ position: "absolute", top: 2, left: prefs.menstrualTrackingEnabled ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: "#FFFFFF" }} />
        </div>
      </div>
      {/* ADDED — real ask: "option/button to hide pregnancy tab if
          toggled on, in same placeish" — persisted opt-out for the
          Pregnancy tab specifically, distinct from this whole
          Cycle/Contraception/Pregnancy toggle above. Only meaningful
          while the toggle above is on, so disabled (not hidden — same
          "why can't I tap this" clarity as PIN-gated App Lock controls
          in Privacy) until it is.
      */}
      {prefs.menstrualTrackingEnabled && (
        <div onClick={() => setPrefs(AppPreferencesRepository.update({ pregnancyTrackingHidden: !prefs.pregnancyTrackingHidden }))}
          role="switch" tabIndex={0} aria-checked={prefs.pregnancyTrackingHidden} aria-label="Hide Pregnancy tab"
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPrefs(AppPreferencesRepository.update({ pregnancyTrackingHidden: !prefs.pregnancyTrackingHidden })); } }}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
          <div style={{ flex: 1, paddingRight: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Hide Pregnancy tab</div>
            <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>Keeps Cycle and Contraception, removes Pregnancy specifically — regardless of profile gender. A record you already have stays reachable by tapping it directly.</div>
          </div>
          <div style={{ width: 40, height: 24, borderRadius: 999, background: prefs.pregnancyTrackingHidden ? ACCENTS.healthcare : "#DCDCE1", position: "relative", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 2, left: prefs.pregnancyTrackingHidden ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: "#FFFFFF" }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ADDED — real ask: "review/audit all settings contents and regroup if
// needed for clarity" — the Menstrual/contraception toggle (and the
// Contacts inactive-threshold before it) had drifted into the Design
// screen ("Colour scheme"), which should only ever hold appearance
// settings. This is their real, correctly-scoped home — cross-cutting
// behavioural preferences that don't belong under Data, Advanced, or
// Appearance. Same singleton-repository backing as before
// (appPreferencesRepository.js), only the screen that surfaces it changed.
function PreferencesScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : NEUTRAL;
  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: T.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Preferences</span>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textDisabled, textTransform: "uppercase", letterSpacing: 0.5, padding: "0 0 6px" }}>Contacts</div>
        <div style={{ marginBottom: 20 }}><InactiveThresholdCard T={T} /></div>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textDisabled, textTransform: "uppercase", letterSpacing: 0.5, padding: "0 0 6px" }}>Healthcare</div>
        <MenstrualTrackingToggleCard T={T} />
      </div>
    </div>
  );
}

// ADDED 19 Aug 2026 — real Settings screen, per Doc 1's spec exactly:
// "gear icon in the Top App Bar, canonically on Home. Contents: Profile
// · Preferences · Data export/import/backup · Privacy · Appearance ·
// Developer tools." My Profile and Backup/Restore are real, working
// sections here now — moved out of the old black top bar (which is
// gone entirely, replaced by this).
// UPDATED 26 Aug 2026 — the comment below this used to say
// Preferences/Privacy/Appearance/Developer tools were "honestly
// labeled as not built yet." That was true on 19 Aug — it's stale
// now. All four are real, working sections as of this session
// (Preferences: inactiveThresholdDays; Privacy: real settings backed
// by PrivacySettingsRepository; Appearance: Design screen with real
// module colour customization; Developer tools: real reset-all-data
// with a two-step confirm). Left the old comment's honesty principle
// intact — genuinely-unbuilt things (Stats/Calendar/Trash/About were
// all real by the time they were added, so nothing here is currently
// faked) — just correcting a factual claim that time overtook.
function SettingsScreen({ onClose, onExport, onImportClick, status, onNavigateToRecord, initialScreen, registerModuleBackHandler }) {
  const [darkMode] = useDarkModePreference();

  const [showMyProfile, setShowMyProfile] = useState(false);
  const [showSelectiveExport, setShowSelectiveExport] = useState(false);
  const [showCSVExport, setShowCSVExport] = useState(false);
  const [showEncryptedExport, setShowEncryptedExport] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  // CHANGED 1 Sep 2026 — Registries and Option lists merged into one
  // "Manage lists" entry (see ManageListsScreen's own comment).
  const [showManageLists, setShowManageLists] = useState(false);
  // ADDED 1 Sep 2026 — Automatic backups moved out of Preferences into
  // its own row here in the Data section (see AutomaticBackupsScreen's
  // own comment on why).
  const [showAutoBackupSettings, setShowAutoBackupSettings] = useState(false);
  // ADDED — real ask, from a build audit: a real, previously-undisclosed
  // place two network calls (Nominatim, GitHub) leave this device from.
  const [showDataNetwork, setShowDataNetwork] = useState(false);
  // ADDED 1 Sep 2026 — real ask: a Resources section.
  const [showResources, setShowResources] = useState(false);
  // ADDED 1 Sep 2026 — real ask, item 2 of the follow-up feature list: a glossary.
  const [showGlossary, setShowGlossary] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  // ADDED — real ask: audited settings grouping — a real home for
  // cross-cutting behavioural preferences (Contacts inactive threshold,
  // Healthcare tracking toggles), pulled out of Colour scheme where
  // they'd drifted. See PreferencesScreen's own comment.
  const [showPreferences, setShowPreferences] = useState(false);
  // ADDED — real ask: unified notifications management, one place to
  // turn each real reminder type on/off rather than each one being
  // invisible/buried in its own module.
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUnits, setShowUnits] = useState(false);
  // ADDED — real ask: an explicit "choose exactly where this goes"
  // export, alongside the one-tap Share-sheet "Export backup" row
  // below — see backupService.js's exportBackupToChosenFolder for the
  // full reasoning and fileExportHelper.js for its honest limits.
  const [chooseFolderAvailable, setChooseFolderAvailable] = useState(false);
  const [plainFolderExportStatus, setPlainFolderExportStatus] = useState(null);
  useEffect(() => { isChooseFolderExportAvailable().then(setChooseFolderAvailable); }, []);
  // ADDED — real ask: round-trip verification (backupService.js's own
  // verifyBackupJson()) means the plain "Export backup" button can now
  // genuinely fail — same real-status pattern as doPlainExportToFolder
  // right below, which this button never had before.
  const [plainExportStatus, setPlainExportStatus] = useState(null);
  const doPlainExport = async () => {
    setPlainExportStatus(null);
    try {
      const result = await onExport();
      setPlainExportStatus({ msg: `Backup complete — ${result.totalRecords} records verified`, ok: true });
    } catch (err) {
      setPlainExportStatus({ msg: err.message, ok: false });
    }
  };
  const doPlainExportToFolder = async () => {
    setPlainFolderExportStatus({ msg: "Choose a folder…", ok: null });
    try {
      const result = await exportBackupToChosenFolder();
      if (result.ok) setPlainFolderExportStatus({ msg: `Saved to ${result.path} — ${result.totalRecords} records verified`, ok: true });
      else if (result.reason === "cancelled") setPlainFolderExportStatus(null);
      else setPlainFolderExportStatus({ msg: "Couldn't save there — try Export backup instead.", ok: false });
    } catch (err) {
      // ADDED — real ask: verifyBackupJson() (backupService.js) can now
      // throw here if the export round-trip actually failed — same
      // "don't silently claim success" reasoning as every other branch
      // in this function.
      setPlainFolderExportStatus({ msg: err.message, ok: false });
    }
  };
  // ADDED 26 Aug 2026 — real ask: design/preferences section for
  // colour scheme, ability to customize a module's base colour.
  const [showDesign, setShowDesign] = useState(false);
  // ADDED 26 Aug 2026 — real ask: Stats page.
  const [showStats, setShowStats] = useState(false);
  // ADDED 26 Aug 2026 — real ask: Trash / recently deleted.
  const [showTrash, setShowTrash] = useState(false);
  // ADDED 26 Aug 2026 — real ask: calendar view.
  const [showCalendar, setShowCalendar] = useState(initialScreen === "calendar");
  // ADDED 26 Aug 2026 — real ask: About/version screen, a genuine
  // missing basic flagged in the final audit — with multiple APK
  // builds now flowing through GitHub Actions, there was no way to
  // confirm which build is actually installed.
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    if (!registerModuleBackHandler) return;
    registerModuleBackHandler(() => {
      if (showCalendar) { setShowCalendar(false); return true; }
      if (showAbout) { setShowAbout(false); return true; }
      if (showTrash) { setShowTrash(false); return true; }
      if (showStats) { setShowStats(false); return true; }
      if (showDesign) { setShowDesign(false); return true; }
      if (showPreferences) { setShowPreferences(false); return true; }
      if (showPrivacy) { setShowPrivacy(false); return true; }
      if (showNotifications) { setShowNotifications(false); return true; }
      if (showUnits) { setShowUnits(false); return true; }
      if (showResources) { setShowResources(false); return true; }
      if (showGlossary) { setShowGlossary(false); return true; }
      if (showAutoBackupSettings) { setShowAutoBackupSettings(false); return true; }
      if (showManageLists) { setShowManageLists(false); return true; }
      if (showDevTools) { setShowDevTools(false); return true; }
      if (showSelectiveExport) { setShowSelectiveExport(false); return true; }
      if (showCSVExport) { setShowCSVExport(false); return true; }
      if (showEncryptedExport) { setShowEncryptedExport(false); return true; }
      if (showMyProfile) { setShowMyProfile(false); return true; }
      return false; // nothing open on top — let App.jsx's own fallback close all of Settings
    });
    return () => registerModuleBackHandler(null);
  }, [showCalendar, showAbout, showTrash, showStats, showDesign, showPreferences, showPrivacy, showNotifications, showUnits, showManageLists, showAutoBackupSettings, showResources, showGlossary, showDevTools, showSelectiveExport, showCSVExport, showEncryptedExport, showMyProfile, registerModuleBackHandler]);

  // CHANGED 26 Aug 2026 — real ask: chrome-level icons (export/import/
  // settings/search) should be thick black lines, not too weighty.
  // Added an optional iconColor override (default unchanged, gray) so
  // this only affects the specific rows asked for, not every Registry/
  // Settings row that shares this component.
  // FIXED — real ask: "icons in settings for dark mode aren't all
  // white". Two real bugs here: the default colour (#5B5B62, a
  // medium-dark grey) never adapted for dark mode, and the "thick
  // black line" rows below hardcoded true black (#1B1B1F) — both read
  // as near-invisible against a dark background. Bold-vs-regular used
  // to be inferred by string-comparing the colour against the light-
  // mode default, which would have silently broken once that default
  // became theme-aware — replaced with its own explicit `emphasized`
  // flag, decoupled from colour entirely.
  const SettingsRow = ({ icon: Icon, label, onClick, disabled, iconColor, emphasized = false }) => {
    const resolvedIconColor = iconColor || (darkMode ? DARK.textDisabled : "#5B5B62");
    return (
    <div onClick={disabled ? undefined : onClick}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Icon size={17} weight={emphasized ? "bold" : "regular"} color={resolvedIconColor} />
        <span style={{ fontSize: 14, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 500 }}>{label}</span>
      </div>
      {!disabled && <ChevronRight size={16} color={darkMode ? DARK.textDisabled : "#656568"} />}
      {disabled && <span style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : "#656568", fontStyle: "italic" }}>Not built yet</span>}
    </div>
    );
  };

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 200, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px", position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Settings</span>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#656568", textTransform: "uppercase", letterSpacing: 0.5, padding: "16px 16px 6px" }}>Profile</div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, margin: "0 16px 20px", overflow: "hidden" }}>
        <SettingsRow icon={User} label="My Profile" onClick={() => setShowMyProfile(true)} />
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#656568", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 16px 6px" }}>Data</div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, margin: "0 16px 8px", overflow: "hidden" }}>
        {/* CHANGED — real bug found in the user's own testing: passing
            `exportBackup` directly meant the DOM click's SyntheticEvent
            got passed as `includeKeys`, which buildBackup() then tried
            to iterate as a selective-key Set and threw. Selective
            export never hit this because its own button already
            wrapped the call in an arrow function that discards the
            event. Wrapping this one the same way. */}
        <SettingsRow icon={Upload} label="Export backup" onClick={doPlainExport} iconColor={darkMode ? DARK.textPrimary : "#1B1B1F"} emphasized />
        {/* ADDED — real ask: real confirmation for this button — it
            fires the OS share sheet with no feedback of its own, and
            round-trip verification (backupService.js's own
            verifyBackupJson()) now genuinely can fail here, which
            deserves to be visible, not swallowed. Same status-row
            pattern already used for Export backup to a folder/
            Encrypted export below — this exact row just never had one. */}
        {plainExportStatus && (
          <div style={{ fontSize: 12, color: plainExportStatus.ok === false ? ACTION.red : (darkMode ? DARK.textSecondary : "#5B5B62"), padding: "0 16px 10px", textAlign: "center" }}>{plainExportStatus.msg}</div>
        )}
        {/* ADDED — real ask: an explicit "choose exactly where this
            goes" alternative to the row above, which opens the Share
            sheet (send it somewhere) rather than a real folder picker.
            Only shown once actually available — see
            fileExportHelper.js's isChooseFolderExportAvailable. */}
        {chooseFolderAvailable && (
          <SettingsRow icon={Upload} label="Export backup to a folder…" onClick={doPlainExportToFolder} iconColor={darkMode ? DARK.textPrimary : "#1B1B1F"} />
        )}
        {/* FIXED — real bug found in the same pass as the round-trip
            verification above: this status was tracked (set on every
            export attempt) but never actually rendered anywhere —
            silently dead state, the failure branches included. */}
        {plainFolderExportStatus && (
          <div style={{ fontSize: 12, color: plainFolderExportStatus.ok === false ? ACTION.red : (darkMode ? DARK.textSecondary : "#5B5B62"), padding: "0 16px 10px", textAlign: "center" }}>{plainFolderExportStatus.msg}</div>
        )}
        {/* ADDED 19 Aug 2026 — real ask: default export stays one tap
            (the row above, unchanged), this is the opt-in "choose what
            to include" path. */}
        {/* CHANGED 26 Aug 2026 — real fix: these icons were backwards,
            same Download/Upload direction confusion the user corrected for
            Contacts' Import earlier this session, mirrored here —
            Export (data leaving) reads as Upload, Restore (data coming
            back in) reads as Download. */}
        <SettingsRow icon={Upload} label="Selective export…" onClick={() => setShowSelectiveExport(true)} iconColor={darkMode ? DARK.textPrimary : "#1B1B1F"} emphasized />
        {/* ADDED — real ask: CSV export, for reading data elsewhere
            (Excel/Sheets), separate from the JSON backup above (which
            is for restoring into SHOS, not for opening as a
            spreadsheet). */}
        <SettingsRow icon={FileCsv} label="Export as CSV…" onClick={() => setShowCSVExport(true)} iconColor={darkMode ? DARK.textPrimary : "#1B1B1F"} emphasized />
        {/* ADDED — real ask: password-protected backup, for storing or
            sending a backup somewhere less trusted than this device. */}
        <SettingsRow icon={Lock} label="Export encrypted backup…" onClick={() => setShowEncryptedExport(true)} iconColor={darkMode ? DARK.textPrimary : "#1B1B1F"} emphasized />
        <SettingsRow icon={Download} label="Restore from backup" onClick={onImportClick} iconColor={darkMode ? DARK.textPrimary : "#1B1B1F"} emphasized />
        {/* MOVED 1 Sep 2026 from Preferences — a backup-scheduling
            setting belongs next to the other backup controls, not
            bundled with an unrelated Contacts-display setting under a
            generic "Preferences" label. */}
        <SettingsRow icon={Upload} label="Automatic backups" onClick={() => setShowAutoBackupSettings(true)} />
        <SettingsRow icon={WifiHigh} label="Data & network" onClick={() => setShowDataNetwork(true)} />
      </div>
      {status && (
        <div style={{ margin: "0 16px 20px", padding: "10px 14px", borderRadius: 12, background: "#FFF4CE", color: darkMode ? DARK.textPrimary : "#1B1B1F", fontSize: 12 }}>{status}</div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#656568", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 16px 6px" }}>Advanced</div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, margin: "0 16px 8px", overflow: "hidden" }}>
        {/* CHANGED 19 Aug 2026 — Developer tools is now real (storage
            overview + reset), moved out of the "Not built yet" group
            below. */}
        <SettingsRow icon={Database} label="Developer tools" onClick={() => setShowDevTools(true)} />
        {/* CHANGED 1 Sep 2026 — real ask: Registries and Option lists
            were two separate rows for what's the same job from a
            user's point of view ("edit the picker choices used across
            the app") — combined into one, with a tab switcher inside
            (see ManageListsScreen's own comment). */}
        <SettingsRow icon={ListTree} label="Manage lists" onClick={() => setShowManageLists(true)} />
        {/* CHANGED 19 Aug 2026 — real fix: Privacy was already real
            (onClick worked), but had been left sitting visually under
            "Not built yet" below since that entry was first added —
            moved up to where it actually belongs. */}
        <SettingsRow icon={SettingsIcon} label="Privacy" onClick={() => setShowPrivacy(true)} />
        {/* ADDED — real ask: audited grouping — cross-cutting behavioural
            preferences (Contacts inactive threshold, Healthcare tracking
            toggles) get a real, findable home instead of living under
            Colour scheme. */}
        <SettingsRow icon={SlidersHorizontal} label="Preferences" onClick={() => setShowPreferences(true)} />
        {/* ADDED — real ask: unified notifications management, one
            place to turn each real reminder type on/off. */}
        <SettingsRow icon={Bell} label="Notifications" onClick={() => setShowNotifications(true)} />
        {/* ADDED 3 Sep 2026 — real ask: a discoverable, global default-
            units setting (Weight/Height/Temperature), not buried inside
            Measurements' own gear icon. */}
        <SettingsRow icon={Ruler} label="Units" onClick={() => setShowUnits(true)} />
        {/* REMOVED 1 Sep 2026 — Preferences row removed; its one real
            setting (inactive-contact threshold) now lives inside
            Design, see InactiveThresholdCard's own comment. */}
        {/* ADDED 1 Sep 2026 — real ask: a Resources section. */}
        <SettingsRow icon={LifeBuoy} label="Resources" onClick={() => setShowResources(true)} />
        {/* ADDED 1 Sep 2026 — real ask, item 2 of the follow-up feature list: a glossary. */}
        <SettingsRow icon={BookOpen} label="Glossary" onClick={() => setShowGlossary(true)} />
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#656568", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 16px 6px" }}>Design</div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, margin: "0 16px 20px", overflow: "hidden" }}>
        {/* CHANGED 26 Aug 2026 — real ask: was a disabled "Not built
            yet" stub, now a real, working section. */}
        <SettingsRow icon={Palette} label="Colour scheme" onClick={() => setShowDesign(true)} />
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#656568", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 16px 6px" }}>Insights</div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: RADIUS.md, margin: "0 16px 20px", overflow: "hidden" }}>
        {/* ADDED 26 Aug 2026 — real ask: Stats page. */}
        <SettingsRow icon={Database} label="Stats" onClick={() => setShowStats(true)} />
        {/* ADDED 26 Aug 2026 — real ask: calendar view. */}
        <SettingsRow icon={Calendar} label="Calendar" onClick={() => setShowCalendar(true)} />
        {/* ADDED 26 Aug 2026 — real ask: Trash / recently deleted. */}
        <SettingsRow icon={Trash2} label="Trash" onClick={() => setShowTrash(true)} />
        {/* ADDED 26 Aug 2026 — real ask: About/version screen. */}
        <SettingsRow icon={ClipboardCheck} label="About" onClick={() => setShowAbout(true)} />
      </div>

      {showMyProfile && (
        <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", zIndex: 210 }}>
          <MyProfileModule onClose={() => setShowMyProfile(false)} registerModuleBackHandler={registerModuleBackHandler} />
        </div>
      )}
      {showSelectiveExport && (
        <SelectiveExportSheet onClose={() => setShowSelectiveExport(false)} />
      )}
      {showCSVExport && (
        <CSVExportSheet onClose={() => setShowCSVExport(false)} />
      )}
      {showEncryptedExport && (
        <EncryptedExportSheet onClose={() => setShowEncryptedExport(false)} />
      )}
      {showDevTools && (
        <DeveloperToolsScreen onClose={() => setShowDevTools(false)} />
      )}
      {showManageLists && (
        <ManageListsScreen onClose={() => setShowManageLists(false)} />
      )}
      {showPrivacy && (
        <PrivacyScreen onClose={() => setShowPrivacy(false)} />
      )}
      {showPreferences && (
        <PreferencesScreen onClose={() => setShowPreferences(false)} />
      )}
      {showNotifications && (
        <NotificationsScreen onClose={() => setShowNotifications(false)} />
      )}
      {showUnits && (
        <UnitsScreen onClose={() => setShowUnits(false)} />
      )}
      {showAutoBackupSettings && (
        <AutomaticBackupsScreen onClose={() => setShowAutoBackupSettings(false)} />
      )}
      {showDataNetwork && (
        <DataNetworkScreen onClose={() => setShowDataNetwork(false)} />
      )}
      {showResources && (
        <ResourcesScreen onClose={() => setShowResources(false)} />
      )}
      {showGlossary && (
        <GlossaryScreen onClose={() => setShowGlossary(false)} />
      )}
      {showDesign && (
        <DesignScreen onClose={() => setShowDesign(false)} />
      )}
      {showStats && (
        <StatsScreen onClose={() => setShowStats(false)} />
      )}
      {showCalendar && (
        <CalendarScreen onClose={() => setShowCalendar(false)} onNavigateToRecord={onNavigateToRecord} />
      )}
      {showTrash && (
        <TrashScreen onClose={() => setShowTrash(false)} />
      )}
      {showAbout && (
        <AboutScreen onClose={() => setShowAbout(false)} />
      )}
    </div>
  );
}
export default SettingsScreen;

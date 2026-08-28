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
} from "@phosphor-icons/react";
import { ACCENTS, ACTION, resolveDarkAccent } from "../calculations/designTokens";
import { ModuleColorRepository, CUSTOMIZABLE_MODULE_KEYS, CUSTOMIZABLE_ACTION_KEYS } from "../repositories/moduleColorRepository";
import { computeAdherence } from "../calculations/medicationCalculations";
import { isQualifyingEncounter, DOXYPEP_WINDOW_HOURS, findDoxyPepMedication } from "../calculations/doxyPepCalculations";
import {
  getActivitiesPerMonth, getTopKinks, getTestingFrequencyStats, BASHH_TESTING_INTERVAL_DAYS, BASHH_TESTING_SOURCE_URL,
  getOverallAdherence, getDoxyPepComplianceRate, getContactsAddedPerMonth,
} from "../calculations/statsCalculations";
import { useDarkModePreference } from "../calculations/darkModePreference";
import { exportBackup, exportEncryptedBackup, EXPORT_GROUPS, getLastBackupInfo, hasUnbackedChanges } from "../storage/backupService";
import { exportRecordsAsCSV } from "../storage/csvExportService";
import { localStorageAdapter } from "../storage/storageAdapter";
import { computeKinkUsage, computeChemsUsage, computeProtectionUsage, computeSymptomsUsage, computeOrganismUsage, computeResultsUsage } from "../calculations/registryUsage";
import { ContactRepository } from "../repositories/contactRepository";
import { EncounterRepository } from "../repositories/encounterRepository";
import { MedicationRepository } from "../repositories/medicationRepository";
import { LogRepository } from "../repositories/logRepository";
import { TestingRepository } from "../repositories/testingRepository";
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository";
import { SymptomLogRepository } from "../repositories/symptomLogRepository";
import { VaccinationRepository } from "../repositories/vaccinationRepository";
import { TrashRepository, MODULE_LABELS as TRASH_MODULE_LABELS } from "../repositories/trashRepository";
import { getCalendarEvents, groupEventsByDay } from "../calculations/calendarCalculations";
import { LocationsRepository } from "../repositories/locationsRepository";
import { PrivacySettingsRepository } from "../repositories/privacySettingsRepository";
import { NotificationPreferencesRepository } from "../repositories/notificationPreferencesRepository";
import { MedicationPreferencesRepository } from "../repositories/medicationPreferencesRepository";
import { syncDoxyPepAlert } from "../calculations/doxyPepSync";
import { syncMedicationReminders } from "../calculations/medicationReminderSync";
import { syncTestingReminder } from "../calculations/testingReminderSync";
import { syncRefillReminder } from "../calculations/refillReminderSync";
import { syncClinicVisitReminders } from "../calculations/clinicVisitReminderSync";
import { checkBiometryAvailable } from "../storage/biometricAuthService";
import { checkCalendarAvailable, syncClinicVisitsToCalendar, removeAllSyncedEvents, removeSyncedEventsFrom, listAvailableCalendars, SHOS_CALENDAR_NAME } from "../storage/calendarSyncService";
import { AppPreferencesRepository } from "../repositories/appPreferencesRepository";
import { EpisodeRepository } from "../repositories/episodeRepository";
import { KinkRegistry } from "../registries/kinkRegistry";
import { ChemsRegistry } from "../registries/chemsRegistry";
import { ProtectionRegistry } from "../registries/protectionRegistry";
import { SymptomsRegistry } from "../registries/symptomsRegistry";
import { OrganismRegistry } from "../registries/organismRegistry";
import { ResultsRegistry } from "../registries/resultsRegistry";
import MyProfileModule from "./SHOS_MyProfile_Prototype";
import RegistryManagementScreen from "./SHOS_RegistryManagement_Prototype";
import OptionListsScreen from "./SHOS_OptionListEditor_Prototype";

function SelectiveExportSheet({ onClose, onExported }) {
  const [darkMode] = useDarkModePreference();

  // All items checked by default — "everything, but deselectable",
  // exactly as asked, rather than starting from nothing and making
  // The user build the full set back up by hand every time.
  const allKeys = EXPORT_GROUPS.flatMap((g) => g.items.map((i) => i.dataKey));
  const [checked, setChecked] = useState(() => new Set(allKeys));

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

  const doExport = () => {
    exportBackup(checked.size === allKeys.length ? null : Array.from(checked));
    onExported?.();
    onClose();
  };

  const Box = ({ state }) => (
    <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${state === "empty" ? "#9A9AA1" : ACCENTS.healthcare}`, background: state === "full" ? ACCENTS.healthcare : state === "partial" ? "#C7D5F7" : "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {state === "full" && <Check size={12} color="#FFFFFF" weight="bold" />}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 220 }} onClick={onClose}>
      <div style={{ background: darkMode ? DARK.bg : "#F0F0F3", width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", borderTopLeftRadius: 24, borderTopRightRadius: 24, fontFamily: "'Inter', sans-serif" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 20px 4px", flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 16, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Export — choose what to include</span>
          <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 4 }}>Everything is included by default. Untick anything you'd rather leave out of this particular file.</div>
        </div>
        <div style={{ overflowY: "auto", padding: "8px 20px", flex: 1 }}>
          {EXPORT_GROUPS.map((group) => (
            <div key={group.key} style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, marginBottom: 10, overflow: "hidden" }}>
              <div onClick={() => toggleGroup(group)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer", borderBottom: group.items.length > 1 ? "1px solid #DCDCE1" : "none" }}>
                <Box state={isGroupFullyChecked(group) ? "full" : isGroupPartiallyChecked(group) ? "partial" : "empty"} />
                <span style={{ fontSize: 14, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>{group.label}</span>
              </div>
              {group.items.length > 1 && group.items.map((item) => (
                <div key={item.dataKey} onClick={() => toggleItem(item.dataKey)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px 9px 34px", cursor: "pointer" }}>
                  <Box state={checked.has(item.dataKey) ? "full" : "empty"} />
                  <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>{item.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ padding: "14px 20px", borderTop: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", flexShrink: 0 }}>
          <button onClick={doExport} disabled={checked.size === 0}
            style={{ width: "100%", padding: 16, borderRadius: 999, border: "none", background: checked.size === 0 ? "#9A9AA1" : ACCENTS.healthcare, color: "#FFFFFF", fontSize: 16, fontWeight: 700, cursor: checked.size === 0 ? "default" : "pointer" }}>
            {checked.size === allKeys.length ? "Export everything" : `Export selected (${checked.size} of ${allKeys.length})`}
          </button>
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

  const doExport = async (item) => {
    setStatus({ dataKey: item.dataKey, msg: "Exporting…", ok: null });
    try {
      await exportRecordsAsCSV(item.dataKey, item.label);
      setStatus({ dataKey: item.dataKey, msg: `${item.label} exported.`, ok: true });
    } catch (err) {
      setStatus({ dataKey: item.dataKey, msg: err.message, ok: false });
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 220 }} onClick={onClose}>
      <div style={{ background: darkMode ? DARK.bg : "#F0F0F3", width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", borderTopLeftRadius: 24, borderTopRightRadius: 24, fontFamily: "'Inter', sans-serif" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 20px 4px", flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 16, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Export as CSV</span>
          <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 4 }}>Pick one record type — spreadsheet-readable (Excel, Sheets), for reading elsewhere, not for restoring into SHOS itself (use a backup for that).</div>
        </div>
        <div style={{ overflowY: "auto", padding: "8px 20px 20px", flex: 1 }}>
          {CSV_EXPORT_GROUPS.map((group) => (
            <div key={group.key} style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, marginBottom: 10, overflow: "hidden" }}>
              <div style={{ padding: "12px 14px 6px", fontSize: 12, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5 }}>{group.label}</div>
              {group.items.map((item) => (
                <div key={item.dataKey} onClick={() => doExport(item)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", cursor: "pointer", borderTop: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
                  <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>{item.label}</span>
                  {status?.dataKey === item.dataKey ? (
                    <span style={{ fontSize: 11, color: status.ok === false ? ACTION.red : status.ok ? ACTION.green : (darkMode ? DARK.textDisabled : "#9A9AA1") }}>{status.msg}</span>
                  ) : (
                    <FileCsv size={16} color={darkMode ? DARK.textDisabled : "#9A9AA1"} />
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
      await exportEncryptedBackup(password, checked.size === allKeys.length ? null : Array.from(checked));
      setPassword(""); setConfirmPassword("");
      onClose();
    } catch (err) {
      setError(err.message || "Encryption failed.");
    } finally {
      setExporting(false);
    }
  };

  const Box = ({ state }) => (
    <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${state === "empty" ? "#9A9AA1" : ACCENTS.healthcare}`, background: state === "full" ? ACCENTS.healthcare : state === "partial" ? "#C7D5F7" : "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {state === "full" && <Check size={12} color="#FFFFFF" weight="bold" />}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 220 }} onClick={onClose}>
      <div style={{ background: darkMode ? DARK.bg : "#F0F0F3", width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", borderTopLeftRadius: 24, borderTopRightRadius: 24, fontFamily: "'Inter', sans-serif" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 20px 4px", flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 16, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Export encrypted backup</span>
          <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 4 }}>Password-protected — safe to store or send somewhere less trusted than this device. There's no password recovery: forgetting it makes this specific file permanently unreadable.</div>
        </div>
        <div style={{ overflowY: "auto", padding: "8px 20px", flex: 1 }}>
          <div style={{ position: "relative", marginBottom: 8 }}>
            <input value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} type={showPasswords ? "text" : "password"} placeholder="Password (6+ characters)"
              style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 14, boxSizing: "border-box", background: darkMode ? DARK.surface : "#FFFFFF", color: darkMode ? DARK.textPrimary : "#1B1B1F" }} />
            {showPasswords ? <EyeOff size={17} color={darkMode ? DARK.textDisabled : "#9A9AA1"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPasswords(false)} />
              : <Eye size={17} color={darkMode ? DARK.textDisabled : "#9A9AA1"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPasswords(true)} />}
          </div>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <input value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }} type={showPasswords ? "text" : "password"} placeholder="Confirm password"
              onKeyDown={(e) => { if (e.key === "Enter") doExport(); }}
              style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 14, boxSizing: "border-box", background: darkMode ? DARK.surface : "#FFFFFF", color: darkMode ? DARK.textPrimary : "#1B1B1F" }} />
          </div>
          {error && <div style={{ fontSize: 12, color: ACTION.red, marginBottom: 10 }}>{error}</div>}
          <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "4px 0 6px" }}>What to include</div>
          {EXPORT_GROUPS.map((group) => (
            <div key={group.key} style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, marginBottom: 10, overflow: "hidden" }}>
              <div onClick={() => toggleGroup(group)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer", borderBottom: group.items.length > 1 ? "1px solid #DCDCE1" : "none" }}>
                <Box state={isGroupFullyChecked(group) ? "full" : isGroupPartiallyChecked(group) ? "partial" : "empty"} />
                <span style={{ fontSize: 14, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>{group.label}</span>
              </div>
              {group.items.length > 1 && group.items.map((item) => (
                <div key={item.dataKey} onClick={() => toggleItem(item.dataKey)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px 9px 34px", cursor: "pointer" }}>
                  <Box state={checked.has(item.dataKey) ? "full" : "empty"} />
                  <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>{item.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ padding: "14px 20px", borderTop: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", flexShrink: 0 }}>
          <button onClick={doExport} disabled={checked.size === 0 || exporting}
            style={{ width: "100%", padding: 16, borderRadius: 999, border: "none", background: (checked.size === 0 || exporting) ? "#9A9AA1" : ACCENTS.healthcare, color: "#FFFFFF", fontSize: 16, fontWeight: 700, cursor: (checked.size === 0 || exporting) ? "default" : "pointer" }}>
            {exporting ? "Encrypting…" : "Export encrypted backup"}
          </button>
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
function DeveloperToolsScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();

  const [resetStage, setResetStage] = useState("idle"); // idle -> confirming -> done
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
    <div style={{ position: "fixed", inset: 0, background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
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

      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "16px 16px 6px" }}>Storage overview</div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, margin: "0 16px 20px", padding: "4px 14px" }}>
        {counts.map((c) => (
          <div key={c.label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
            <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>{c.label}</span>
            <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>{c.value}</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 16px 6px" }}>Danger zone</div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: `1px solid ${ACTION.red}`, borderRadius: 16, margin: "0 16px 20px", padding: 16 }}>
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
            {hasUnbackedChanges() && (
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
const REGISTRIES = [
  { key: "kink", label: "Kink Registry", registry: KinkRegistry, color: "#E5484D", icon: Flame, computeUsage: computeKinkUsage },
  { key: "protection", label: "Protection Registry", registry: ProtectionRegistry, color: "#E24E9C", icon: Shield, computeUsage: computeProtectionUsage },
  { key: "chems", label: "Chems Registry", registry: ChemsRegistry, color: "#5B5B62", icon: Pill, computeUsage: computeChemsUsage },
  { key: "symptoms", label: "Symptoms Registry", registry: SymptomsRegistry, color: ACCENTS.healthcare, icon: Stethoscope, computeUsage: computeSymptomsUsage },
  { key: "organism", label: "Organism Registry", registry: OrganismRegistry, color: ACCENTS.healthcare, icon: Microscope, computeUsage: computeOrganismUsage },
  { key: "results", label: "Results Registry", registry: ResultsRegistry, color: ACCENTS.healthcare, icon: ClipboardCheck, computeUsage: computeResultsUsage },
];

function RegistriesScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();

  const [openRegistry, setOpenRegistry] = useState(null);
  return (
    <div style={{ position: "fixed", inset: 0, background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Registries</span>
      </div>
      <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", padding: "10px 16px 0" }}>
        Manage the shared vocabularies used across Contacts, Encounters, Testing, and Clinic Visits — rename or archive an entry directly, rather than only through whichever picker happens to reference it.
      </div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, margin: "16px 16px 20px", overflow: "hidden" }}>
        {REGISTRIES.map((r) => (
          <div key={r.key} onClick={() => setOpenRegistry(r)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* CHANGED 19 Aug 2026 — plain color dot replaced with a
                  real icon+color badge, matching every entry's own
                  logical icon rather than an undifferentiated dot. */}
              <div style={{ width: 28, height: 28, borderRadius: 999, background: `${r.color}1A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <r.icon size={14} color={r.color} />
              </div>
              <span style={{ fontSize: 14, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 500 }}>{r.label}</span>
            </div>
            <ChevronRight size={16} color={darkMode ? DARK.textDisabled : "#9A9AA1"} />
          </div>
        ))}
      </div>
      {openRegistry && (
        <RegistryManagementScreen registry={openRegistry.registry} label={openRegistry.label} color={openRegistry.color} computeUsage={openRegistry.computeUsage} onClose={() => setOpenRegistry(null)} />
      )}
    </div>
  );
}

// ADDED 19 Aug 2026 — Privacy screen: Anonymise mode. Real, scoped ask
// from the user, not the earlier vague "what counts as identifiable"
// unknown — see privacySettingsRepository.js for the full reasoning
// and exact field-tier list.
function PrivacyScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();

  const [settings, setSettings] = useState(() => PrivacySettingsRepository.getSettings());
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
    <div style={{ position: "fixed", inset: 0, background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Privacy & Security</span>
      </div>

      <div style={{ padding: "16px" }}>
        {/* Big, clearly separated toggle button — never on by default,
            per the user's explicit instruction, and always one tap to turn
            ON regardless of any PIN. */}
        <div onClick={settings.anonymiseModeActive ? undefined : activate}
          style={{ padding: 18, borderRadius: 16, background: settings.anonymiseModeActive ? "#1B1B1F" : (darkMode ? DARK.surface : "#FFFFFF"), border: `1px solid ${settings.anonymiseModeActive ? "#1B1B1F" : (darkMode ? DARK.border : "#DCDCE1")}`, cursor: settings.anonymiseModeActive ? "default" : "pointer", marginBottom: 16 }}>
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
          <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F", marginBottom: 8 }}>
              {settings.anonymisePin ? "Enter your PIN to turn it back off" : "Turn it back off"}
            </div>
            {settings.anonymisePin && (
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input value={pinEntry} onChange={(e) => { setPinEntry(e.target.value); setPinError(""); }} type={showPins ? "text" : "password"} inputMode="numeric" placeholder="PIN"
                  style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 14, boxSizing: "border-box" }} />
                {showPins ? <EyeOff size={17} color={darkMode ? DARK.textDisabled : "#9A9AA1"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(false)} />
                  : <Eye size={17} color={darkMode ? DARK.textDisabled : "#9A9AA1"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(true)} />}
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
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, padding: 16, marginBottom: 16, opacity: settings.anonymiseModeActive ? 1 : 0.5 }}>
          <div onClick={settings.anonymiseModeActive ? () => { PrivacySettingsRepository.update({ hideFurtherEnabled: !settings.hideFurtherEnabled }); refresh(); } : undefined}
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
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div onClick={toggleAppLock} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 14, borderTop: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", cursor: "pointer" }} onClick={toggleBiometric}>
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
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F", marginBottom: 4 }}>Revert PIN</div>
          <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 10 }}>
            {settings.anonymisePin ? "A PIN is set — used for both Anonymise mode's revert and App Lock above." : "No PIN set yet — anyone can turn Anonymise mode back off right now, and App Lock can't be turned on. Set one so both actually protect you."}
          </div>
          {settingPin ? (
            <>
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input value={newPin} onChange={(e) => setNewPin(e.target.value)} type={showPins ? "text" : "password"} inputMode="numeric" placeholder="New PIN (4+ digits)"
                  style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 14, boxSizing: "border-box" }} />
                {showPins ? <EyeOff size={17} color={darkMode ? DARK.textDisabled : "#9A9AA1"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(false)} />
                  : <Eye size={17} color={darkMode ? DARK.textDisabled : "#9A9AA1"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(true)} />}
              </div>
              {/* ADDED — real ask: force reconfirmation before accepting,
                  to catch typos before they lock the user out later. */}
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} type={showPins ? "text" : "password"} inputMode="numeric" placeholder="Confirm new PIN"
                  style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 14, boxSizing: "border-box" }} />
                {showPins ? <EyeOff size={17} color={darkMode ? DARK.textDisabled : "#9A9AA1"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(false)} />
                  : <Eye size={17} color={darkMode ? DARK.textDisabled : "#9A9AA1"} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(true)} />}
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
    <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, padding: 16, marginBottom: 12 }}>
      <div onClick={onToggle} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
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

function NotificationsScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const [, forceRefresh] = useState(0);
  const refresh = () => forceRefresh((n) => n + 1);
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

  const hoursInput = (value, onChange) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
      <span style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>Hours before:</span>
      <input type="number" min={1} max={168} value={value}
        onChange={(e) => onChange(Math.max(1, Math.min(168, Number(e.target.value) || 1)))}
        style={{ width: 56, padding: "6px 8px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", background: darkMode ? DARK.surfaceVariant : "#F0F0F3", color: darkMode ? DARK.textPrimary : "#1B1B1F", fontSize: 13, textAlign: "center" }} />
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Notifications</span>
      </div>

      <div style={{ padding: 16 }}>
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

function PreferencesScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();

  const [prefs, setPrefs] = useState(() => AppPreferencesRepository.getPreferences());
  const [draftValue, setDraftValue] = useState(() => String(prefs.inactiveThresholdDays));

  const save = () => {
    const parsed = parseInt(draftValue, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    const updated = AppPreferencesRepository.update({ inactiveThresholdDays: parsed });
    setPrefs(updated);
  };

  // ADDED — real ask: "scheduled auto-export" — genuinely runs
  // unattended on app open (see backupService.js's runAutoExportIfDue),
  // not just a reminder to do it by hand. Off by default; toggling on
  // takes effect from the next app open, same "no live re-check mid-
  // session" honesty already established for every other preference
  // toggle in this screen (Dark mode, module colours).
  const toggleAutoExport = () => {
    setPrefs(AppPreferencesRepository.update({ autoExportEnabled: !prefs.autoExportEnabled }));
  };
  const setAutoExportInterval = (days) => {
    setPrefs(AppPreferencesRepository.update({ autoExportIntervalDays: days }));
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Preferences</span>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F", marginBottom: 4 }}>Inactive contact threshold</div>
          <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 12 }}>
            Days since a Contact's last Encounter before it shows the red "inactive" flag. Was fixed at 90 — now yours to set. A specific contact can also be excluded from this entirely (edit that contact → "One-off / never expect to recur").
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={draftValue} onChange={(e) => setDraftValue(e.target.value)} type="number" min="1"
              style={{ width: 90, padding: "10px 12px", borderRadius: 8, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", fontSize: 14, boxSizing: "border-box" }} />
            <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>days</span>
            <button onClick={save} style={{ marginLeft: "auto", padding: "10px 18px", borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>
              Save
            </button>
          </div>
          <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : "#9A9AA1", marginTop: 10 }}>Currently: {prefs.inactiveThresholdDays} days.</div>
        </div>

        {/* ADDED — real ask: "scheduled auto-export" as its own card,
            distinct from the inactive-threshold one above. */}
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, padding: 16, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Automatic backups</span>
            <div onClick={toggleAutoExport}
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
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {AUTO_EXPORT_INTERVAL_OPTIONS.map((opt) => (
                <span key={opt.days} onClick={() => setAutoExportInterval(opt.days)}
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

// ADDED 26 Aug 2026 — real ask: design/preferences section for colour
// scheme, ability to customize a module's base colour. See
// moduleColorRepository.js for the actual mechanism (merged into
// ACCENTS at load time) and its honest note on why a change here
// takes effect on next reload, not instantly.
const MODULE_LABELS = { contacts: "Contacts", encounters: "Encounter", medication: "Medication", healthcare: "Healthcare", home: "Home" };
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
    <div onClick={onClick} style={{ width: 16, height: 16, borderRadius: 999, border: "1px solid #9A9AA1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#9A9AA1", cursor: "pointer", flexShrink: 0 }}>i</div>
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

// ADDED 26 Aug 2026 — real ask: Stats page, grouped by context
// (Activity/Healthcare/Medication/Contacts), each stat with a
// clickable info explaining the calculation and citing real clinical
// guidance where relevant (BASHH), not just internal app logic.
function StatsScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();

  const encounters = useMemo(() => EncounterRepository.getAll(), []);
  const contacts = useMemo(() => ContactRepository.getAll(), []);
  const tests = useMemo(() => TestingRepository.getAll(), []);
  // computeAdherence() reads med.logs directly — not part of the raw
  // repository record, so it has to be stitched on here too (same as
  // SHOS_Medication_Dashboard_Prototype.jsx's loadMedications()).
  const medications = useMemo(() => MedicationRepository.getAll().map((med) => ({ ...med, logs: LogRepository.getForMedication(med.id) })), []);

  const activityMonths = useMemo(() => getActivitiesPerMonth(encounters, 6), [encounters]);
  const topKinks = useMemo(() => getTopKinks(encounters, contacts, (id) => KinkRegistry.getById(id)?.name, 5), [encounters, contacts]);
  const testingStats = useMemo(() => getTestingFrequencyStats(tests), [tests]);
  const adherence = useMemo(() => getOverallAdherence(medications, computeAdherence), [medications]);
  const doxyCompliance = useMemo(() => {
    const doxyMed = findDoxyPepMedication(medications);
    if (!doxyMed) return null;
    return getDoxyPepComplianceRate(encounters, LogRepository.getForMedication(doxyMed.id), isQualifyingEncounter, DOXYPEP_WINDOW_HOURS);
  }, [encounters, medications]);
  const contactMonths = useMemo(() => getContactsAddedPerMonth(contacts, 6), [contacts]);

  const maxActivity = Math.max(1, ...activityMonths.map((b) => b.count));
  const maxContacts = Math.max(1, ...contactMonths.map((b) => b.count));

  return (
    <div style={{ position: "fixed", inset: 0, background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Stats</span>
      </div>
      <div style={{ padding: 16 }}>

        {/* Activity */}
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENTS.encounters, textTransform: "uppercase", letterSpacing: 0.5, padding: "0 0 6px" }}>Encounter</div>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "12px 16px", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>Encounters per month</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60 }}>
              {activityMonths.map((b) => (
                <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", height: `${Math.max(4, (b.count / maxActivity) * 44)}px`, background: ACCENTS.encounters, borderRadius: 3 }} />
                  <span style={{ fontSize: 9, color: darkMode ? DARK.textDisabled : "#9A9AA1" }}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: "12px 16px" }}>
            <div style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 8 }}>Top kinks/roles logged</div>
            {topKinks.length === 0 ? (
              <div style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : "#9A9AA1", fontStyle: "italic" }}>Nothing logged yet.</div>
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
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
          <StatRow label="Tests logged" value={testingStats.testCount}
            explanation="Total non-archived tests with a real (not future-scheduled) date." />
          <StatRow label="Average interval between tests"
            value={testingStats.averageIntervalDays != null ? `${testingStats.averageIntervalDays} days` : "Not enough data"}
            explanation="Average days between consecutive tests. Needs at least 2 real tests to calculate." />
          <StatRow label="Within BASHH-recommended interval?"
            value={testingStats.withinBashhInterval == null ? "—" : testingStats.withinBashhInterval ? "Yes" : "No"}
            explanation={`BASHH's 2023 summary guidance recommends 3-monthly (90-day) asymptomatic STI screening for higher-risk groups, matching CDC's own 3–6 month guidance for PrEP users. This compares days since your last test against that 90-day reference point — not a personalised recommendation, just the cited benchmark.`}
            sourceUrl={BASHH_TESTING_SOURCE_URL} />
        </div>

        {/* Medication */}
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENTS.medication, textTransform: "uppercase", letterSpacing: 0.5, padding: "0 0 6px" }}>Medication</div>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
          <StatRow label="Overall adherence (7-day)" value={adherence != null ? `${adherence}%` : "Not enough data"}
            explanation="Average of each daily/scheduled medication's own 7-day adherence rate (doses actually logged vs. doses expected). PRN medications aren't included — there's no fixed expected schedule to measure against." />
          <StatRow label="DoxyPEP compliance" value={doxyCompliance != null ? `${doxyCompliance}%` : "No DoxyPEP medication set up"}
            explanation="Of each qualifying-activity window (see the DoxyPEP alert's own logic — mucous-membrane contact, BASHH/CDC-sourced), the percentage where a dose was actually logged within the real 72-hour window. Sequential activity in the same window counts once, matching the real alert's own anchoring rule." />
        </div>

        {/* Contacts */}
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENTS.contacts, textTransform: "uppercase", letterSpacing: 0.5, padding: "0 0 6px" }}>Contacts</div>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>Contacts added per month</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60 }}>
              {contactMonths.map((b) => (
                <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", height: `${Math.max(4, (b.count / maxContacts) * 44)}px`, background: ACCENTS.contacts, borderRadius: 3 }} />
                  <span style={{ fontSize: 9, color: darkMode ? DARK.textDisabled : "#9A9AA1" }}>{b.label}</span>
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
          {isOverridden && <span style={{ fontSize: 10, color: darkMode ? DARK.textDisabled : "#9A9AA1", fontStyle: "italic" }}>(customised)</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isOverridden && (
            <ResetIcon size={16} color={darkMode ? DARK.textDisabled : "#9A9AA1"} style={{ cursor: "pointer" }} onClick={onReset} title="Reset to default" />
          )}
          {/* CHANGED — real ask: the native colour picker (its own
              R/G/B or H/S/L sliders, not anything this app renders)
              wasn't opening preset to the module's actual current
              colour, defaulting to 0/black instead. The HTML spec for
              input[type=color]'s value requires a strict lowercase
              #rrggbb string — ACCENTS/ModuleColorRepository store hex
              in uppercase (e.g. "#D97706"), which some WebView colour
              pickers silently reject as invalid rather than
              normalizing, falling back to their own default. */}
          <input type="color" value={currentValue.toLowerCase()} onChange={(e) => onSetColor(colorKey, e.target.value)}
            style={{ width: 36, height: 28, padding: 0, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 6, cursor: "pointer" }} />
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
                  color: panelMode === mode ? "#3D63C9" : (darkMode ? DARK.textDisabled : "#9A9AA1"),
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

// ADDED 26 Aug 2026 — real ask: About/version screen, a genuine
// missing basic flagged in the final audit. version/buildDate come
// from package.json and the actual build timestamp — real values,
// not decorative. GitHub link points at the actual repo so a real
// build issue can be traced back to source.
function AboutScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();

  return (
    <div style={{ position: "fixed", inset: 0, background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>About</span>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F", marginBottom: 4 }}>SHOS</div>
          <div style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : "#9A9AA1" }}>Sexual Health Operating System</div>
        </div>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
            <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>Version</span>
            {/* CHANGED — real ask: was hardcoded placeholder, now reads
                the actual version from package.json rather than a
                second, easy-to-forget copy of the same number. */}
            <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 600 }}>{APP_VERSION}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px" }}>
            <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>Repository</span>
            <a href="https://github.com/drwho2001/Claude-shos-v1" target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#3D63C9", fontWeight: 600 }}>
              GitHub →
            </a>
          </div>
        </div>
        <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : "#9A9AA1", textAlign: "center", marginTop: 16 }}>
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
  const [appPrefs, setAppPrefs] = useState(() => AppPreferencesRepository.getPreferences());
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

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 300 }} onClick={() => !calendarSyncing && onClose()}>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", width: "100%", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Phone calendar sync</span>
          <X size={18} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        </div>

        <div onClick={calendarSyncing ? undefined : toggleCalendarSync} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: calendarSyncing ? "default" : "pointer" }}>
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
            <div onClick={calendarSyncing ? undefined : openCalendarPicker} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: calendarSyncing ? "default" : "pointer" }}>
              <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62" }}>Syncing to:</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: ACCENTS.healthcare }}>{appPrefs.calendarSyncTargetName || SHOS_CALENDAR_NAME} · Change</div>
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
            <div onClick={() => !calendarSyncing && selectCalendarTarget(null)}
              style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${!appPrefs.calendarSyncTargetName ? ACCENTS.healthcare : (darkMode ? DARK.border : "#DCDCE1")}`, background: !appPrefs.calendarSyncTargetName ? `${ACCENTS.healthcare}10` : "transparent", cursor: "pointer", marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>SHOS (private) — recommended</div>
              <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : "#5B5B62", marginTop: 2 }}>On-device only, structurally can't sync or be shared.</div>
            </div>
            {availableCalendars === null && <div style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : "#9A9AA1", textAlign: "center", padding: 10 }}>Loading calendars…</div>}
            {availableCalendars?.length === 0 && (
              <div style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : "#9A9AA1", textAlign: "center", padding: 10 }}>No other calendars found on this device.</div>
            )}
            {availableCalendars?.map((cal) => (
              <div key={cal.id} onClick={() => !calendarSyncing && selectCalendarTarget(cal.name)}
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

  const allEvents = useMemo(() => getCalendarEvents({
    encounters: EncounterRepository.getAll(),
    tests: TestingRepository.getAll(),
    clinicVisits: ClinicVisitsRepository.getAll(),
    vaccinations: VaccinationRepository.getAll(),
    symptomEntries: SymptomLogRepository.getAll(),
    medications: MedicationRepository.getAll(),
  }), []);
  const events = useMemo(() => allEvents.filter((e) => activeModules.includes(e.moduleKey)), [allEvents, activeModules]);
  const grouped = useMemo(() => groupEventsByDay(events), [events]);

  const year = cursor.getFullYear(), month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay(); // 0=Sun
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
    <div style={{ position: "fixed", inset: 0, background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
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
          <span onClick={() => setShowFilters((s) => !s)} style={{ fontSize: 12, fontWeight: 600, color: activeModules.length < ALL_MODULE_KEYS.length ? "#3D63C9" : "#5B5B62", cursor: "pointer" }}>
            Filter{activeModules.length < ALL_MODULE_KEYS.length ? ` (${activeModules.length})` : ""}
          </span>
        </div>
      </div>
      {showFilters && (
        <div style={{ padding: "10px 16px 0", display: "flex", flexWrap: "wrap", gap: 6, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", paddingBottom: 10 }}>
          {ALL_MODULE_KEYS.map((key) => {
            const active = activeModules.includes(key);
            return (
              <div key={key} onClick={() => toggleModule(key)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? ACCENTS[key] : "#DCDCE1"}`, color: active ? ACCENTS[key] : "#9A9AA1", background: active ? `${ACCENTS[key]}15` : "transparent" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: active ? ACCENTS[key] : "#9A9AA1" }} />
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
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} style={{ textAlign: "center", fontSize: 11, color: darkMode ? DARK.textDisabled : "#9A9AA1", fontWeight: 700, padding: "4px 0" }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const key = dayKey(day);
            const dayEvents = grouped[key] || [];
            const isToday = key === todayKey;
            const isSelected = selectedDay === day;
            const moduleColorsPresent = [...new Set(dayEvents.map((e) => e.moduleKey))].map((k) => ACCENTS[k] || "#9A9AA1");
            return (
              <div key={i} onClick={() => setSelectedDay(isSelected ? null : day)}
                style={{ aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 8, cursor: "pointer", background: isSelected ? "#1B1B1F" : isToday ? "#E7E7EB" : "transparent", gap: 2 }}>
                <span style={{ fontSize: 12, color: isSelected ? "#FFFFFF" : "#1B1B1F", fontWeight: isToday ? 700 : 400 }}>{day}</span>
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
            <div style={{ fontSize: 12, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
              {new Date(year, month, selectedDay).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            </div>
            {selectedEvents.length === 0 ? (
              <div style={{ fontSize: 13, color: darkMode ? DARK.textDisabled : "#9A9AA1", fontStyle: "italic" }}>Nothing logged this day.</div>
            ) : (
              <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, overflow: "hidden" }}>
                {selectedEvents.map((ev, i) => (
                  <div key={i} onClick={() => goToEvent(ev)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: i < selectedEvents.length - 1 ? "1px solid #DCDCE1" : "none", cursor: "pointer" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: ACCENTS[ev.moduleKey] || "#9A9AA1", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
                      <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : "#9A9AA1" }}>{TRASH_MODULE_LABELS[ev.moduleKey] || ev.moduleKey}</div>
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

  const [items, setItems] = useState(() => TrashRepository.getAll());
  const refresh = () => setItems(TrashRepository.getAll());
  // ADDED 26 Aug 2026 — real ask: 4 real actions (restore all/
  // selected, delete all/selected), with real multi-select on this
  // screen — reuses the exact same Select-toggle + toolbar pattern
  // already proven across every other module this session, rather
  // than inventing a new one just for Trash.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const toggleSelected = (id) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds([]); };

  const restoreEntries = (entries) => {
    entries.forEach((entry) => {
      const repo = TRASH_REPOSITORIES[entry.moduleKey];
      if (repo) repo.restore(entry.record);
      TrashRepository.removeEntry(entry.trashId);
    });
    refresh();
  };

  const restoreItem = (entry) => restoreEntries([entry]);
  const restoreAll = () => restoreEntries(items);
  const restoreSelected = () => { restoreEntries(items.filter((e) => selectedIds.includes(e.trashId))); exitSelectMode(); };

  const deletePermanently = (entry) => {
    if (window.confirm("Delete this permanently? It won't be recoverable after this.")) {
      TrashRepository.removeEntry(entry.trashId);
      refresh();
    }
  };
  const deleteAll = () => {
    if (window.confirm(`Permanently delete all ${items.length} item${items.length > 1 ? "s" : ""} in the trash? This can't be undone.`)) {
      TrashRepository.emptyAll();
      refresh();
    }
  };
  const deleteSelected = () => {
    if (window.confirm(`Permanently delete ${selectedIds.length} item${selectedIds.length > 1 ? "s" : ""}? This can't be undone.`)) {
      selectedIds.forEach((id) => TrashRepository.removeEntry(id));
      exitSelectMode();
      refresh();
    }
  };

  const recordLabel = (entry) => entry.record.title || entry.record.name || entry.record.displayName || "Untitled";

  return (
    <div style={{ position: "fixed", inset: 0, background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
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
            <span onClick={() => selectedIds.length > 0 && restoreSelected()} style={{ fontSize: 13, color: selectedIds.length > 0 ? "#FFFFFF" : "#6E6E74", fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>Restore</span>
            <span onClick={() => selectedIds.length > 0 && deleteSelected()} style={{ fontSize: 13, color: selectedIds.length > 0 ? resolveDarkAccent("actionRed", ACTION.red, "#FF7A7E") : "#6E6E74", fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>Delete</span>
            <span onClick={exitSelectMode} style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600, cursor: "pointer" }}>Cancel</span>
          </div>
        </div>
      )}
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : "#9A9AA1", marginBottom: 14 }}>
          Deleted items stay here for 30 days before they're no longer shown. This is separate from the "tap to undo" that appears right after deleting something.
        </div>
        {items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: darkMode ? DARK.textDisabled : "#9A9AA1", fontSize: 13 }}>Nothing in the trash.</div>
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
            <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, overflow: "hidden" }}>
              {items.map((entry, i) => (
                <div key={entry.trashId} onClick={() => selectMode && toggleSelected(entry.trashId)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: i < items.length - 1 ? "1px solid #DCDCE1" : "none", cursor: selectMode ? "pointer" : "default" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                    {selectMode && (
                      <div style={{ width: 20, height: 20, borderRadius: 999, border: `2px solid ${selectedIds.includes(entry.trashId) ? "#3D63C9" : "#DCDCE1"}`, background: selectedIds.includes(entry.trashId) ? "#3D63C9" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {selectedIds.includes(entry.trashId) && <Check size={12} color="#FFFFFF" />}
                      </div>
                    )}
                    <div style={{ minWidth: 0, flex: 1, paddingRight: 10 }}>
                      <div style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{recordLabel(entry)}</div>
                      <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : "#9A9AA1", marginTop: 2 }}>{TRASH_MODULE_LABELS[entry.moduleKey] || entry.moduleKey} · deleted {new Date(entry.deletedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</div>
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
  const [overrides, setOverrides] = useState(() => ModuleColorRepository.getOverrides());
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
    <div style={{ position: "fixed", inset: 0, background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
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
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
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
            <div onClick={() => setDarkMode((d) => !d)}
              style={{ width: 44, height: 26, borderRadius: 999, background: darkMode ? "#1B1B1F" : "#DCDCE1", position: "relative", cursor: "pointer", transition: "background 0.15s" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,.4)", position: "absolute", top: 3, left: darkMode ? 21 : 3, transition: "left 0.15s" }} />
            </div>
          </div>
        </div>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 500 }}>Colour-blind friendly palette</span>
              <div onClick={toggleCvdPalette}
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
        <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 0 6px" }}>Module colours</div>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, overflow: "hidden" }}>
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
        <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "20px 0 6px" }}>Status colours</div>
        <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, overflow: "hidden" }}>
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
  const [showRegistries, setShowRegistries] = useState(false);
  const [showOptionLists, setShowOptionLists] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  // ADDED — real ask: unified notifications management, one place to
  // turn each real reminder type on/off rather than each one being
  // invisible/buried in its own module.
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
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
      if (showOptionLists) { setShowOptionLists(false); return true; }
      if (showRegistries) { setShowRegistries(false); return true; }
      if (showDevTools) { setShowDevTools(false); return true; }
      if (showSelectiveExport) { setShowSelectiveExport(false); return true; }
      if (showCSVExport) { setShowCSVExport(false); return true; }
      if (showEncryptedExport) { setShowEncryptedExport(false); return true; }
      if (showMyProfile) { setShowMyProfile(false); return true; }
      return false; // nothing open on top — let App.jsx's own fallback close all of Settings
    });
    return () => registerModuleBackHandler(null);
  }, [showCalendar, showAbout, showTrash, showStats, showDesign, showPreferences, showPrivacy, showNotifications, showOptionLists, showRegistries, showDevTools, showSelectiveExport, showCSVExport, showEncryptedExport, showMyProfile, registerModuleBackHandler]);

  // CHANGED 26 Aug 2026 — real ask: chrome-level icons (export/import/
  // settings/search) should be thick black lines, not too weighty.
  // Added an optional iconColor override (default unchanged, gray) so
  // this only affects the specific rows asked for, not every Registry/
  // Settings row that shares this component.
  const SettingsRow = ({ icon: Icon, label, onClick, disabled, iconColor = "#5B5B62" }) => (
    <div onClick={disabled ? undefined : onClick}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Icon size={17} weight={iconColor !== "#5B5B62" ? "bold" : "regular"} color={iconColor} />
        <span style={{ fontSize: 14, color: darkMode ? DARK.textPrimary : "#1B1B1F", fontWeight: 500 }}>{label}</span>
      </div>
      {!disabled && <ChevronRight size={16} color={darkMode ? DARK.textDisabled : "#9A9AA1"} />}
      {disabled && <span style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : "#9A9AA1", fontStyle: "italic" }}>Not built yet</span>}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: darkMode ? DARK.bg : "#F0F0F3", zIndex: 200, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px", position: "sticky", top: 0, background: darkMode ? DARK.bg : "#F0F0F3", borderBottom: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : "#1B1B1F"} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Settings</span>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "16px 16px 6px" }}>Profile</div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, margin: "0 16px 20px", overflow: "hidden" }}>
        <SettingsRow icon={User} label="My Profile" onClick={() => setShowMyProfile(true)} />
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 16px 6px" }}>Data</div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, margin: "0 16px 8px", overflow: "hidden" }}>
        {/* CHANGED — real bug found in the user's own testing: passing
            `exportBackup` directly meant the DOM click's SyntheticEvent
            got passed as `includeKeys`, which buildBackup() then tried
            to iterate as a selective-key Set and threw. Selective
            export never hit this because its own button already
            wrapped the call in an arrow function that discards the
            event. Wrapping this one the same way. */}
        <SettingsRow icon={Upload} label="Export backup" onClick={() => onExport()} iconColor="#1B1B1F" />
        {/* ADDED 19 Aug 2026 — real ask: default export stays one tap
            (the row above, unchanged), this is the opt-in "choose what
            to include" path. */}
        {/* CHANGED 26 Aug 2026 — real fix: these icons were backwards,
            same Download/Upload direction confusion the user corrected for
            Contacts' Import earlier this session, mirrored here —
            Export (data leaving) reads as Upload, Restore (data coming
            back in) reads as Download. */}
        <SettingsRow icon={Upload} label="Selective export…" onClick={() => setShowSelectiveExport(true)} iconColor="#1B1B1F" />
        {/* ADDED — real ask: CSV export, for reading data elsewhere
            (Excel/Sheets), separate from the JSON backup above (which
            is for restoring into SHOS, not for opening as a
            spreadsheet). */}
        <SettingsRow icon={FileCsv} label="Export as CSV…" onClick={() => setShowCSVExport(true)} iconColor="#1B1B1F" />
        {/* ADDED — real ask: password-protected backup, for storing or
            sending a backup somewhere less trusted than this device. */}
        <SettingsRow icon={Lock} label="Export encrypted backup…" onClick={() => setShowEncryptedExport(true)} iconColor="#1B1B1F" />
        <SettingsRow icon={Download} label="Restore from backup" onClick={onImportClick} iconColor="#1B1B1F" />
      </div>
      {status && (
        <div style={{ margin: "0 16px 20px", padding: "10px 14px", borderRadius: 12, background: "#FFF4CE", color: darkMode ? DARK.textPrimary : "#1B1B1F", fontSize: 12 }}>{status}</div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 16px 6px" }}>Advanced</div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, margin: "0 16px 8px", overflow: "hidden" }}>
        {/* CHANGED 19 Aug 2026 — Developer tools is now real (storage
            overview + reset), moved out of the "Not built yet" group
            below. */}
        <SettingsRow icon={Database} label="Developer tools" onClick={() => setShowDevTools(true)} />
        {/* ADDED 19 Aug 2026 — Registries, real per the user's priority
            order. */}
        <SettingsRow icon={ListTree} label="Registries" onClick={() => setShowRegistries(true)} />
        {/* ADDED 19 Aug 2026 — Option lists, the "idiot-proof editor"
            the user asked for, for the simpler flat-string option lists. */}
        <SettingsRow icon={ListTree} label="Option lists" onClick={() => setShowOptionLists(true)} />
        {/* CHANGED 19 Aug 2026 — real fix: Privacy was already real
            (onClick worked), but had been left sitting visually under
            "Not built yet" below since that entry was first added —
            moved up to where it actually belongs. */}
        <SettingsRow icon={SettingsIcon} label="Privacy" onClick={() => setShowPrivacy(true)} />
        {/* ADDED — real ask: unified notifications management, one
            place to turn each real reminder type on/off. */}
        <SettingsRow icon={Bell} label="Notifications" onClick={() => setShowNotifications(true)} />
        {/* ADDED 19 Aug 2026 — Preferences, real now: the configurable
            inactive-contact threshold, the user's own first concrete ask
            for this previously fully-stubbed section. */}
        <SettingsRow icon={SettingsIcon} label="Preferences" onClick={() => setShowPreferences(true)} />
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 16px 6px" }}>Design</div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, margin: "0 16px 20px", overflow: "hidden" }}>
        {/* CHANGED 26 Aug 2026 — real ask: was a disabled "Not built
            yet" stub, now a real, working section. */}
        <SettingsRow icon={Palette} label="Colour scheme" onClick={() => setShowDesign(true)} />
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? DARK.textDisabled : "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 16px 6px" }}>Insights</div>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", borderRadius: 16, margin: "0 16px 20px", overflow: "hidden" }}>
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
        <div style={{ position: "fixed", inset: 0, zIndex: 210 }}>
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
      {showRegistries && (
        <RegistriesScreen onClose={() => setShowRegistries(false)} />
      )}
      {showOptionLists && (
        <OptionListsScreen onClose={() => setShowOptionLists(false)} />
      )}
      {showPrivacy && (
        <PrivacyScreen onClose={() => setShowPrivacy(false)} />
      )}
      {showNotifications && (
        <NotificationsScreen onClose={() => setShowNotifications(false)} />
      )}
      {showPreferences && (
        <PreferencesScreen onClose={() => setShowPreferences(false)} />
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

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
// SPLIT 24 Sep 2026 — the 19 sub-screens below now live in
// src/modules/settings/*.jsx (one file per screen, React.lazy-loaded
// on first open). This file keeps the top-level SettingsScreen menu,
// the three export sheets, and the lazy wiring. Behavior unchanged.
import React, { useState, useEffect, Suspense, lazy } from "react";
import { NEUTRAL_DARK as DARK } from "../calculations/designTokens";
import { WarningIcon as AlertTriangle, CheckIcon as Check, CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight, EyeIcon as Eye, EyeSlashIcon as EyeOff, ListChecksIcon as ClipboardCheck, DatabaseIcon as Database, DownloadSimpleIcon as Download, FireIcon as Flame, TreeStructureIcon as ListTree, MicroscopeIcon as Microscope, PillIcon as Pill, ShieldIcon as Shield, StethoscopeIcon as Stethoscope, TrashIcon as Trash2, UploadSimpleIcon as Upload, UserIcon as User, PaletteIcon as Palette, ArrowUUpLeftIcon as ResetIcon, CalendarIcon as Calendar, FileCsvIcon as FileCsv, LockIcon as Lock, BellIcon as Bell, CloudArrowUpIcon as CloudArrowUp, CloudCheckIcon as CloudCheck, LifebuoyIcon as LifeBuoy, BookOpenTextIcon as BookOpen, SlidersHorizontalIcon as SlidersHorizontal, MapPinIcon as MapPin, XIcon as X, WifiHighIcon as WifiHigh, LinkBreakIcon as LinkBreak, FolderIcon as Folder, FunnelIcon as Filter, ClockIcon as Clock, ChartBarIcon as ChartBar, InfoIcon as Info, CompassIcon as Compass, BugIcon as Bug, PencilSimpleIcon as PencilSimple, MonitorIcon as Monitor } from "@phosphor-icons/react";
import { ACCENTS, ACTION, NEUTRAL, RADIUS, TYPE } from "../calculations/designTokens";
import { getActivitiesPerMonth, getTopKinks, getTestingFrequencyStats, BASHH_TESTING_INTERVAL_DAYS, BASHH_TESTING_SOURCE_URL, getOverallAdherence, getDoxyPepComplianceRate, getContactsAddedPerMonth, getTestingIntervalTrend, getAdherenceTrend, getTopSymptoms, getClinicVisitStats, getClinicVisitsPerMonth, getPositiveTestsByOrganism, getTestsBySite } from "../calculations/statsCalculations";
import { useDarkModePreference } from "../calculations/darkModePreference";
import { exportBackup, exportEncryptedBackup, exportBackupToChosenFolder, exportEncryptedBackupToChosenFolder, EXPORT_GROUPS } from "../storage/backupService";
import { isChooseFolderExportAvailable } from "../storage/fileExportHelper";
import { exportRecordsAsCSV } from "../storage/csvExportService";
import MyProfileModule from "./SHOS_MyProfile_Prototype";

// Settings sub-screens (lazy — one chunk per screen, loaded on first open)
const DeveloperToolsScreen = lazy(() => import("./settings/DeveloperToolsScreen"));
const ManageListsScreen = lazy(() => import("./settings/ManageListsScreen"));
const ResourcesScreen = lazy(() => import("./settings/ResourcesScreen"));
const PrivacyScreen = lazy(() => import("./settings/PrivacyScreen"));
const PreferencesScreen = lazy(() => import("./settings/PreferencesScreen"));
const NotificationsScreen = lazy(() => import("./settings/NotificationsScreen"));
const AutomaticBackupsScreen = lazy(() => import("./settings/AutomaticBackupsScreen"));
const BackupExportScreen = lazy(() => import("./settings/BackupExportScreen"));
const DataNetworkScreen = lazy(() => import("./settings/DataNetworkScreen"));
const WidgetsScreen = lazy(() => import("./settings/WidgetsScreen"));
const GlossaryScreen = lazy(() => import("./settings/GlossaryScreen"));
const GuideScreen = lazy(() => import("./settings/GuideScreen"));
const DesignScreen = lazy(() => import("./settings/DesignScreen"));
const StatsScreen = lazy(() => import("./settings/StatsScreen"));
const CalendarScreen = lazy(() => import("./settings/CalendarScreen"));
const TrashScreen = lazy(() => import("./settings/TrashScreen"));
const AboutScreen = lazy(() => import("./settings/AboutScreen"));

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
      <div style={{ background: darkMode ? DARK.bg : NEUTRAL.bg, width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", borderTopLeftRadius: 24, borderTopRightRadius: 24, fontFamily: "'Inter', sans-serif" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 20px 4px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 16, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Export — choose what to include</span>
              <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginTop: 4 }}>Everything is included by default. Untick anything you'd rather leave out of this particular file.</div>
            </div>
            {/* ADDED 1 Sep 2026 — real ask: "option to select all... rather
                than manual 1 by 1" — before this, reselecting everything
                after deselecting some meant tapping every group's own
                checkbox one at a time. One tap for the whole list now. */}
            <span role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => setChecked(checked.size === allKeys.length ? new Set() : new Set(allKeys))}
              style={{ fontSize: 12, fontWeight: 600, color: ACCENTS.healthcare, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, marginTop: 2 }}>
              {checked.size === allKeys.length ? "Deselect all" : "Select all"}
            </span>
          </div>
        </div>
        <div tabIndex={0} style={{ overflowY: "auto", padding: "8px 20px", flex: 1 }}>
          {EXPORT_GROUPS.map((group) => (
            <div key={group.key} style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, marginBottom: 10, overflow: "hidden" }}>
              <div onClick={() => toggleGroup(group)} role="checkbox" tabIndex={0}
                aria-checked={isGroupFullyChecked(group) ? true : isGroupPartiallyChecked(group) ? "mixed" : false} aria-label={group.label}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleGroup(group); } }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer", borderBottom: group.items.length > 1 ? "1px solid #DCDCE1" : "none" }}>
                <Box state={isGroupFullyChecked(group) ? "full" : isGroupPartiallyChecked(group) ? "partial" : "empty"} />
                <span style={{ fontSize: 14, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>{group.label}</span>
              </div>
              {group.items.length > 1 && group.items.map((item) => (
                <div key={item.dataKey} onClick={() => toggleItem(item.dataKey)} role="checkbox" tabIndex={0} aria-checked={checked.has(item.dataKey)} aria-label={item.label}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleItem(item.dataKey); } }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px 9px 34px", cursor: "pointer" }}>
                  <Box state={checked.has(item.dataKey) ? "full" : "empty"} />
                  <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>{item.label}</span>
                </div>
              ))}
            </div>
          ))}
          {/* ADDED 1 Sep 2026 — real ask: date-range filter. */}
          <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, marginBottom: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, marginBottom: 4 }}>Date range (optional)</div>
            <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, marginBottom: 10 }}>
              Only narrows dated records (Contacts, Encounters, Medications, Testing, Clinic Visits, Symptom Log, Vaccinations, Timeline). Registries and app settings are always included in full.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 4 }}>From</div>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="From date"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), fontSize: 13, boxSizing: "border-box", background: darkMode ? DARK.surfaceVariant : NEUTRAL.bg, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 4 }}>To</div>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="To date"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), fontSize: 13, boxSizing: "border-box", background: darkMode ? DARK.surfaceVariant : NEUTRAL.bg, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }} />
              </div>
            </div>
            {(dateFrom || dateTo) && (
              <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => { setDateFrom(""); setDateTo(""); }} style={{ fontSize: 11, color: ACCENTS.healthcare, marginTop: 8, cursor: "pointer" }}>Clear date range</div>
            )}
          </div>
        </div>
        <div style={{ padding: "14px 20px", borderTop: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), flexShrink: 0 }}>
          {folderExportStatus && (
            <div style={{ fontSize: 12, color: folderExportStatus.ok === false ? ACTION.red : (darkMode ? DARK.textSecondary : NEUTRAL.textSecondary), marginBottom: 8, textAlign: "center" }}>{folderExportStatus.msg}</div>
          )}
          <button onClick={doExport} disabled={checked.size === 0}
            style={{ width: "100%", padding: 16, borderRadius: 999, border: "none", background: checked.size === 0 ? "#656568" : ACCENTS.healthcare, color: "#FFFFFF", fontSize: 16, fontWeight: 700, cursor: checked.size === 0 ? "default" : "pointer" }}>
            {checked.size === allKeys.length && !dateFrom && !dateTo ? "Export everything" : `Export selected (${checked.size} of ${allKeys.length})`}
          </button>
          {/* ADDED — real ask: an explicit choose-a-folder alternative
              to the Share-sheet button above. */}
          {chooseFolderAvailable && (
            <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={doExportToFolder} style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: ACCENTS.healthcare, cursor: "pointer", padding: "10px 0 0" }}>
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
      <div style={{ background: darkMode ? DARK.bg : NEUTRAL.bg, width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", borderTopLeftRadius: 24, borderTopRightRadius: 24, fontFamily: "'Inter', sans-serif" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 20px 4px", flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 16, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Export as CSV</span>
          <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginTop: 4 }}>Pick one record type — spreadsheet-readable (Excel, Sheets), for reading elsewhere, not for restoring into SHOS itself (use a backup for that).</div>
        </div>
        <div tabIndex={0} style={{ overflowY: "auto", padding: "8px 20px 20px", flex: 1 }}>
          <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, marginBottom: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, marginBottom: 4 }}>Date range (optional)</div>
            <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, marginBottom: 10 }}>
              Only narrows dated records — applies whichever record type you tap below.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 4 }}>From</div>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="From date"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), fontSize: 13, boxSizing: "border-box", background: darkMode ? DARK.surfaceVariant : NEUTRAL.bg, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 4 }}>To</div>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="To date"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), fontSize: 13, boxSizing: "border-box", background: darkMode ? DARK.surfaceVariant : NEUTRAL.bg, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }} />
              </div>
            </div>
            {(dateFrom || dateTo) && (
              <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => { setDateFrom(""); setDateTo(""); }} style={{ fontSize: 11, color: ACCENTS.healthcare, marginTop: 8, cursor: "pointer" }}>Clear date range</div>
            )}
          </div>
          {CSV_EXPORT_GROUPS.map((group) => (
            <div key={group.key} style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, marginBottom: 10, overflow: "hidden" }}>
              <div style={{ padding: "12px 14px 6px", ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled }}>{group.label}</div>
              {group.items.map((item) => (
                <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} key={item.dataKey} onClick={() => doExport(item)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", cursor: "pointer", borderTop: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
                  <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>{item.label}</span>
                  {status?.dataKey === item.dataKey ? (
                    <span style={{ fontSize: 11, color: status.ok === false ? ACTION.red : status.ok ? ACTION.green : (darkMode ? DARK.textDisabled : NEUTRAL.textDisabled) }}>{status.msg}</span>
                  ) : (
                    <FileCsv size={16} color={darkMode ? DARK.textDisabled : NEUTRAL.textDisabled} />
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
      <div style={{ background: darkMode ? DARK.bg : NEUTRAL.bg, width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", borderTopLeftRadius: 24, borderTopRightRadius: 24, fontFamily: "'Inter', sans-serif" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 20px 4px", flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 16, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Export encrypted backup</span>
          <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginTop: 4 }}>Password-protected — safe to store or send somewhere less trusted than this device. There's no password recovery: forgetting it makes this specific file permanently unreadable.</div>
        </div>
        <div tabIndex={0} style={{ overflowY: "auto", padding: "8px 20px", flex: 1 }}>
          <div style={{ position: "relative", marginBottom: 8 }}>
            <input value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} type={showPasswords ? "text" : "password"} placeholder="Password (6+ characters)"
              style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), fontSize: 14, boxSizing: "border-box", background: darkMode ? DARK.surface : NEUTRAL.surface, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }} />
            {showPasswords ? <EyeOff size={17} color={darkMode ? DARK.textDisabled : NEUTRAL.textDisabled} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPasswords(false)} role="button" tabIndex={0} aria-label="Hide password" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
              : <Eye size={17} color={darkMode ? DARK.textDisabled : NEUTRAL.textDisabled} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPasswords(true)} role="button" tabIndex={0} aria-label="Show password" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />}
          </div>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <input value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }} type={showPasswords ? "text" : "password"} placeholder="Confirm password"
              onKeyDown={(e) => { if (e.key === "Enter") doExport(); }}
              style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), fontSize: 14, boxSizing: "border-box", background: darkMode ? DARK.surface : NEUTRAL.surface, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }} />
          </div>
          {error && <div style={{ fontSize: 12, color: ACTION.red, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0 6px" }}>
            <span style={{ ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled }}>What to include</span>
            <span role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => setChecked(checked.size === allKeys.length ? new Set() : new Set(allKeys))}
              style={{ fontSize: 12, fontWeight: 600, color: ACCENTS.healthcare, cursor: "pointer" }}>
              {checked.size === allKeys.length ? "Deselect all" : "Select all"}
            </span>
          </div>
          {EXPORT_GROUPS.map((group) => (
            <div key={group.key} style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, marginBottom: 10, overflow: "hidden" }}>
              <div onClick={() => toggleGroup(group)} role="checkbox" tabIndex={0}
                aria-checked={isGroupFullyChecked(group) ? true : isGroupPartiallyChecked(group) ? "mixed" : false} aria-label={group.label}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleGroup(group); } }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer", borderBottom: group.items.length > 1 ? "1px solid #DCDCE1" : "none" }}>
                <Box state={isGroupFullyChecked(group) ? "full" : isGroupPartiallyChecked(group) ? "partial" : "empty"} />
                <span style={{ fontSize: 14, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>{group.label}</span>
              </div>
              {group.items.length > 1 && group.items.map((item) => (
                <div key={item.dataKey} onClick={() => toggleItem(item.dataKey)} role="checkbox" tabIndex={0} aria-checked={checked.has(item.dataKey)} aria-label={item.label}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleItem(item.dataKey); } }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px 9px 34px", cursor: "pointer" }}>
                  <Box state={checked.has(item.dataKey) ? "full" : "empty"} />
                  <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>{item.label}</span>
                </div>
              ))}
            </div>
          ))}
          {/* ADDED 1 Sep 2026 — real ask: date-range filter. */}
          <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, marginBottom: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, marginBottom: 4 }}>Date range (optional)</div>
            <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, marginBottom: 10 }}>
              Only narrows dated records. Registries and app settings are always included in full.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 4 }}>From</div>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="From date"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), fontSize: 13, boxSizing: "border-box", background: darkMode ? DARK.surfaceVariant : NEUTRAL.bg, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 4 }}>To</div>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="To date"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), fontSize: 13, boxSizing: "border-box", background: darkMode ? DARK.surfaceVariant : NEUTRAL.bg, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }} />
              </div>
            </div>
            {(dateFrom || dateTo) && (
              <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => { setDateFrom(""); setDateTo(""); }} style={{ fontSize: 11, color: ACCENTS.healthcare, marginTop: 8, cursor: "pointer" }}>Clear date range</div>
            )}
          </div>
        </div>
        <div style={{ padding: "14px 20px", borderTop: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), flexShrink: 0 }}>
          {folderExportStatus && (
            <div style={{ fontSize: 12, color: folderExportStatus.ok === false ? ACTION.red : (darkMode ? DARK.textSecondary : NEUTRAL.textSecondary), marginBottom: 8, textAlign: "center" }}>{folderExportStatus.msg}</div>
          )}
          <button onClick={doExport} disabled={checked.size === 0 || exporting}
            style={{ width: "100%", padding: 16, borderRadius: 999, border: "none", background: (checked.size === 0 || exporting) ? "#656568" : ACCENTS.healthcare, color: "#FFFFFF", fontSize: 16, fontWeight: 700, cursor: (checked.size === 0 || exporting) ? "default" : "pointer" }}>
            {exporting ? "Encrypting…" : "Export encrypted backup"}
          </button>
          {/* ADDED — real ask: an explicit choose-a-folder alternative
              to the Share-sheet button above. */}
          {chooseFolderAvailable && (
            <div onClick={exporting ? undefined : doExportToFolder} style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: exporting ? (darkMode ? DARK.textDisabled : NEUTRAL.textDisabled) : ACCENTS.healthcare, cursor: exporting ? "default" : "pointer", padding: "10px 0 0" }}>
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
function SettingsScreen({ onClose, onExport, onImportClick, status, onNavigateToRecord, initialScreen, registerModuleBackHandler, onStartTour }) {
  const [darkMode] = useDarkModePreference();

  // Preload every sub-screen chunk the moment the Settings menu mounts, so
  // tapping a row renders instantly instead of flashing the Suspense
  // fallback on first open (24 Sep 2026: the smoke suite's fixed post-tap
  // waits couldn't survive the first-open chunk fetch — and neither can a
  // real user's patience). Fire-and-forget: a failed preload just means
  // that row falls back to loading on tap, exactly as without this.
  useEffect(() => {
    const warm = (name) => import(`./settings/${name}Screen.jsx`).catch(() => {});
    ["DeveloperTools", "ManageLists", "Resources", "Privacy", "Preferences", "Notifications", "NotificationHistory", "ErrorLog", "AutomaticBackups", "BackupExport", "DataNetwork", "Widgets", "Glossary", "Guide", "Design", "Stats", "Calendar", "Trash", "About"].forEach(warm);
  }, []);

  const [showMyProfile, setShowMyProfile] = useState(false);
  // ADDED 16 Sep 2026 — real ask: Backup & Data had 7 separate rows
  // (Export backup/to a folder/Selective/CSV/Encrypted/Restore/
  // Automatic backups) directly on the main Settings list — "other
  // apps don't have export options this separated." Consolidated
  // behind one row into its own sub-screen, same pattern already used
  // for every other multi-control settings area (Privacy, Preferences,
  // Notifications, etc.) — no functionality removed, just one entry
  // point instead of seven.
  const [showBackupExport, setShowBackupExport] = useState(false);
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
  const [showGuide, setShowGuide] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(initialScreen === "privacy");
  // ADDED — real ask: audited settings grouping — a real home for
  // cross-cutting behavioural preferences (Contacts inactive threshold,
  // Healthcare tracking toggles), pulled out of Colour scheme where
  // they'd drifted. See PreferencesScreen's own comment.
  const [showPreferences, setShowPreferences] = useState(false);
  // ADDED — real ask: unified notifications management, one place to
  // turn each real reminder type on/off rather than each one being
  // invisible/buried in its own module.
  const [showNotifications, setShowNotifications] = useState(false);
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
  // ADDED 22 Sep 2026 — Home-screen widgets privacy settings
  const [showWidgets, setShowWidgets] = useState(false);

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
      if (showDataNetwork) { setShowDataNetwork(false); return true; }
      if (showResources) { setShowResources(false); return true; }
      if (showGlossary) { setShowGlossary(false); return true; }
      if (showGuide) { setShowGuide(false); return true; }
      if (showAutoBackupSettings) { setShowAutoBackupSettings(false); return true; }
      if (showManageLists) { setShowManageLists(false); return true; }
      if (showDevTools) { setShowDevTools(false); return true; }
      if (showSelectiveExport) { setShowSelectiveExport(false); return true; }
      if (showCSVExport) { setShowCSVExport(false); return true; }
      if (showEncryptedExport) { setShowEncryptedExport(false); return true; }
      if (showWidgets) { setShowWidgets(false); return true; }
      // CHECKED AFTER the three export sheets/Automatic backups above —
      // they can be open "on top of" this screen (its own rows open
      // them), so a back press has to close the topmost one first.
      if (showBackupExport) { setShowBackupExport(false); return true; }
      if (showMyProfile) { setShowMyProfile(false); return true; }
      return false; // nothing open on top — let App.jsx's own fallback close all of Settings
    });
    return () => registerModuleBackHandler(null);
  }, [showCalendar, showAbout, showTrash, showStats, showDesign, showPreferences, showPrivacy, showNotifications, showDataNetwork, showManageLists, showAutoBackupSettings, showBackupExport, showResources, showGlossary, showGuide, showDevTools, showSelectiveExport, showCSVExport, showEncryptedExport, showMyProfile, showWidgets, registerModuleBackHandler]);

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
  // FIXED — real inconsistency found in a live audit: 6 of this
  // screen's 22 rows had accumulated an `emphasized`/`iconColor`
  // override (bold + full-strength colour) added piecemeal as each
  // feature shipped, with no actual rule behind which rows got it —
  // even 2 rows in the SAME Backup & Data section disagreed with their
  // 5 siblings. No section is actually more "important" than any
  // other, so every row now renders identically instead of some
  // looking bold/dark and others muted at random.
  const SettingsRow = ({ icon: Icon, label, onClick, disabled }) => {
    const resolvedIconColor = darkMode ? DARK.textDisabled : "#5B5B62";
    return (
    <div onClick={disabled ? undefined : onClick}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Icon size={17} weight="regular" color={resolvedIconColor} />
        <span style={{ fontSize: 14, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontWeight: 500 }}>{label}</span>
      </div>
      {!disabled && <ChevronRight size={16} color={darkMode ? DARK.textDisabled : NEUTRAL.textDisabled} />}
      {disabled && <span style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, fontStyle: "italic" }}>Not built yet</span>}
    </div>
    );
  };

  return (
    // ADDED — real accessibility gap found via a region-landmark audit:
    // SettingsScreen renders as a direct sibling of App.jsx's own
    // <main> (not nested inside it), so nothing here — the main menu's
    // own content, and all ~20 sub-screens below, which are DOM
    // descendants of THIS root regardless of their own position:fixed
    // styling — was ever inside any landmark at all. One role="region"
    // here covers the whole tree; confirmed live via axe-core before
    // and after, not assumed from the DOM shape alone.
    <div tabIndex={0} role="region" aria-label="Settings" style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(120px + env(safe-area-inset-bottom))", background: darkMode ? DARK.bg : NEUTRAL.bg, zIndex: 200, overflowY: "auto", fontFamily: "'Inter', sans-serif", display: "flex", justifyContent: "center" }}>
      {/* ADDED — real report: same thin-border desktop-width-cap
          treatment already applied to Contacts/My Profile/Medication
          Dashboard, rolled out here for consistency. */}
      <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px", position: "sticky", top: 0, background: darkMode ? DARK.bg : NEUTRAL.bg, borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label="Back" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Settings</h1>
      </div>

      <div style={{ ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, padding: "16px 16px 6px" }}>Profile</div>
      <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, margin: "0 16px 20px", overflow: "hidden" }}>
        <SettingsRow icon={User} label="My Profile" onClick={() => setShowMyProfile(true)} />
      </div>

      {/* REGROUPED 9 Sep 2026 — real ask: the 5 original sections
          ("Data"/"Advanced"/"Design"/"Insights") had grown into a
          jumbled, unintuitive list — "Advanced" in particular had
          become a catch-all for 8 unrelated rows (dev tools, security,
          notifications, reference content) with no real theme. Split
          into groups an actual user would search by. Also fixed 3
          duplicate/wrong icons found along the way: Upload was reused
          on 4 different Data rows (now Folder/Filter/Clock for the
          non-primary 3), Database was reused for both Developer tools
          and Stats (Stats now ChartBar), and Colour scheme's icon was
          never a real palette glyph at all — aliased from TagIcon,
          not PaletteIcon, so it rendered as a tag/label icon. Privacy's
          gear icon (confusing one screen inside Settings, which is
          itself reached via a gear) is now Shield; About's checklist
          icon is now Info. No rows added, removed, or rewired — same
          22 rows, same onClick handlers, just regrouped and re-iconed. */}
      <div style={{ ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, padding: "0 16px 6px" }}>Backup &amp; Data</div>
      <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, margin: "0 16px 8px", overflow: "hidden" }}>
        {/* CHANGED 16 Sep 2026 — real ask: the 7 export/restore/backup
            rows that used to sit directly here are consolidated behind
            this one row now — see BackupExportScreen below. */}
        <SettingsRow icon={Upload} label="Backup &amp; Export" onClick={() => setShowBackupExport(true)} />
      </div>
      {status && (
        <div style={{ margin: "0 16px 20px", padding: "10px 14px", borderRadius: 12, background: "#FFF4CE", color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontSize: 12 }}>{status}</div>
      )}

      <div style={{ ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, padding: "0 16px 6px" }}>Security &amp; Privacy</div>
      <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, margin: "0 16px 8px", overflow: "hidden" }}>
        {/* CHANGED 19 Aug 2026 — real fix: Privacy was already real
            (onClick worked), but had been left sitting visually under
            "Not built yet" below since that entry was first added —
            moved up to where it actually belongs. */}
        <SettingsRow icon={Shield} label="Privacy" onClick={() => setShowPrivacy(true)} />
        {/* MOVED 9 Sep 2026 from Data — real ask: what leaves the
            device (third-party network calls) is a privacy question,
            not a backup one; sat oddly at the bottom of the export
            list before. */}
        <SettingsRow icon={WifiHigh} label="Data & network" onClick={() => setShowDataNetwork(true)} />
        {/* ADDED 22 Sep 2026 — Home-screen widgets with per-widget privacy */}
        <SettingsRow icon={Monitor} label="Widgets" onClick={() => setShowWidgets(true)} />
      </div>

      <div style={{ ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, padding: "0 16px 6px" }}>General</div>
      <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, margin: "0 16px 8px", overflow: "hidden" }}>
        {/* ADDED — real ask: audited grouping — cross-cutting behavioural
            preferences (Contacts inactive threshold, Healthcare tracking
            toggles) get a real, findable home instead of living under
            Colour scheme. */}
        <SettingsRow icon={SlidersHorizontal} label="Preferences" onClick={() => setShowPreferences(true)} />
        {/* ADDED — real ask: unified notifications management, one
            place to turn each real reminder type on/off. */}
        <SettingsRow icon={Bell} label="Notifications" onClick={() => setShowNotifications(true)} />
        {/* REMOVED 16 Sep 2026 — real ask: audit whether global-Settings
            items would do better in each module's own settings. Units
            moved into Measurements' own gear-icon settings sheet — see
            MeasurementPreferencesSheet's own comment. */}
      </div>

      <div style={{ ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, padding: "0 16px 6px" }}>Appearance</div>
      <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, margin: "0 16px 8px", overflow: "hidden" }}>
        {/* CHANGED 26 Aug 2026 — real ask: was a disabled "Not built
            yet" stub, now a real, working section. */}
        <SettingsRow icon={Palette} label="Colour scheme" onClick={() => setShowDesign(true)} />
      </div>

      <div style={{ ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, padding: "0 16px 6px" }}>Content &amp; Lists</div>
      <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, margin: "0 16px 8px", overflow: "hidden" }}>
        {/* CHANGED 1 Sep 2026 — real ask: Registries and Option lists
            were two separate rows for what's the same job from a
            user's point of view ("edit the picker choices used across
            the app") — combined into one, with a tab switcher inside
            (see ManageListsScreen's own comment). */}
        <SettingsRow icon={ListTree} label="Manage lists" onClick={() => setShowManageLists(true)} />
        {/* ADDED 1 Sep 2026 — real ask: a Resources section. */}
        <SettingsRow icon={LifeBuoy} label="Resources" onClick={() => setShowResources(true)} />
        {/* ADDED 1 Sep 2026 — real ask, item 2 of the follow-up feature list: a glossary. */}
        <SettingsRow icon={BookOpen} label="Glossary" onClick={() => setShowGlossary(true)} />
        {/* ADDED 9 Sep 2026 — real ask: nothing in the app explained
            what the Settings sections do or where less-obvious
            features (Menstrual tracking, My Profile, Clinic Card) live
            — see GuideScreen's own comment for the full scope. */}
        <SettingsRow icon={Compass} label="Guide" onClick={() => setShowGuide(true)} />
      </div>

      <div style={{ ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, padding: "0 16px 6px" }}>Insights</div>
      <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, margin: "0 16px 8px", overflow: "hidden" }}>
        {/* ADDED 26 Aug 2026 — real ask: Stats page. */}
        <SettingsRow icon={ChartBar} label="Stats" onClick={() => setShowStats(true)} />
        {/* ADDED 26 Aug 2026 — real ask: calendar view. */}
        <SettingsRow icon={Calendar} label="Calendar" onClick={() => setShowCalendar(true)} />
        {/* ADDED 26 Aug 2026 — real ask: Trash / recently deleted. */}
        <SettingsRow icon={Trash2} label="Trash" onClick={() => setShowTrash(true)} />
      </div>

      <div style={{ ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, padding: "0 16px 6px" }}>Support</div>
      <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, margin: "0 16px 20px", overflow: "hidden" }}>
        {/* CHANGED 19 Aug 2026 — Developer tools is now real (storage
            overview + reset), moved out of the "Not built yet" group
            below. */}
        <SettingsRow icon={Database} label="Developer tools" onClick={() => setShowDevTools(true)} />
        {/* ADDED 26 Aug 2026 — real ask: About/version screen. */}
        <SettingsRow icon={Info} label="About" onClick={() => setShowAbout(true)} />
      </div>

      {showMyProfile && (
        <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", zIndex: 210 }}>
          <MyProfileModule onClose={() => setShowMyProfile(false)} registerModuleBackHandler={registerModuleBackHandler} />
        </div>
      )}
      {showBackupExport && (
        <BackupExportScreen
          onClose={() => setShowBackupExport(false)}
          doPlainExport={doPlainExport}
          doPlainExportToFolder={doPlainExportToFolder}
          chooseFolderAvailable={chooseFolderAvailable}
          plainExportStatus={plainExportStatus}
          plainFolderExportStatus={plainFolderExportStatus}
          onImportClick={onImportClick}
          onSelectiveExport={() => setShowSelectiveExport(true)}
          onCSVExport={() => setShowCSVExport(true)}
          onEncryptedExport={() => setShowEncryptedExport(true)}
          onAutoBackupSettings={() => setShowAutoBackupSettings(true)}
        />
      )}
      <Suspense fallback={<div style={{ position: "fixed", inset: 0, zIndex: 220, display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F0F3", color: "#666", fontFamily: "'Inter', sans-serif", fontSize: 13 }}>Loading...</div>}>
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
      {showAutoBackupSettings && (
        <AutomaticBackupsScreen onClose={() => setShowAutoBackupSettings(false)} />
      )}
      {showDataNetwork && (
        <DataNetworkScreen onClose={() => setShowDataNetwork(false)} />
      )}
      {showWidgets && (
        <WidgetsScreen onClose={() => setShowWidgets(false)} />
      )}
      {showResources && (
        <ResourcesScreen onClose={() => setShowResources(false)} />
      )}
      {showGlossary && (
        <GlossaryScreen onClose={() => setShowGlossary(false)} />
      )}
      {showGuide && (
        <GuideScreen onClose={() => setShowGuide(false)} onStartTour={onStartTour} />
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
      </Suspense>
      </div>
    </div>
  );
}
export default SettingsScreen;

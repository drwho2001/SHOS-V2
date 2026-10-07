// DeveloperToolsScreen — extracted verbatim from src/modules/SHOS_Settings_Prototype.jsx
// (24 Sep 2026 settings split). Behavior unchanged; only the file moved.
import React, { useState, useRef, useEffect } from "react";
import { NEUTRAL_DARK as DARK, STICKY_SCREEN_HEADER_TOP } from "../../calculations/designTokens";
import { WarningIcon as AlertTriangle, CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight, TrashIcon as Trash2, LinkBreakIcon as LinkBreak, BugIcon as Bug, WarningDiamondIcon as WarningDiamond } from "@phosphor-icons/react";
import { ACCENTS, ACTION, ACTION_TEXT_SAFE, NEUTRAL, RADIUS, TYPE, resolveDarkAccent } from "../../calculations/designTokens";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useLoadedMemo } from "../../calculations/loadedRepositoryState";
import { useIsDesktopWidth } from "../../calculations/responsive";
import { hasUnbackedChanges } from "../../storage/backupService";
import { ErrorLogRepository } from "../../repositories/errorLogRepository";
import { localStorageAdapter } from "../../storage/storageAdapter";
import { resetAllData } from "../../repositories/resetAllData";
import { countSampleData, clearSampleData, onSampleDataChanged } from "../../repositories/clearSampleData";
import { findOrphanReferences } from "../../calculations/orphanReferenceCheck";
import { findDataAnomalies, ANOMALY_KIND_LABELS } from "../../calculations/dataAnomalyScan";

// Display order for the anomaly groups. An array rather than Object.keys so the
// order is stated rather than depending on the order the scan happened to push
// findings - a report whose sections reshuffle between runs is one nobody
// learns to read.
const ANOMALY_ORDER = ["doubleLogged", "ordering", "futureDate"];

// The scanner writes "tomorrow" / "8 hours" / "25 days" and never a sentence
// with a full stop, so joining reasons needs the capital rather than producing
// "its date is 25 days in the future, and it records... .".
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
import { describeRepair, clearDanglingReference, repointDanglingReference, repairOptions, undoRepair } from "../../calculations/referenceRepair";
import { ContactRepository } from "../../repositories/contactRepository";
import { EncounterRepository } from "../../repositories/encounterRepository";
import { MedicationRepository } from "../../repositories/medicationRepository";
import { LogRepository } from "../../repositories/logRepository";
import { TestingRepository } from "../../repositories/testingRepository";
import { ClinicVisitsRepository } from "../../repositories/clinicVisitsRepository";
import { SymptomLogRepository } from "../../repositories/symptomLogRepository";
import { VaccinationRepository } from "../../repositories/vaccinationRepository";
import { LocationsRepository } from "../../repositories/locationsRepository";
import { EpisodeRepository } from "../../repositories/episodeRepository";
import { KinkRegistry } from "../../registries/kinkRegistry";
import { ChemsRegistry } from "../../registries/chemsRegistry";
import { ProtectionRegistry } from "../../registries/protectionRegistry";
import { SymptomsRegistry } from "../../registries/symptomsRegistry";
import { OrganismRegistry } from "../../registries/organismRegistry";
import { ResultsRegistry } from "../../registries/resultsRegistry";
import ErrorLogScreen from "./ErrorLogScreen";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ADDED 6 Oct 2026 (session B) - one broken relation-by-id, and what can be
// done about it.
//
// Kept as its own component because this row carries real state: a target
// picker, a two-step confirm, and an undo that has to survive the re-scan
// re-running underneath it. Inlining all of that into the map callback
// above would mean four pieces of shared state across N rows, which is how
// one row's pending repair ends up applied to another's record.
//
// THE THREE THINGS THIS ROW DELIBERATELY DOES NOT DO:
//
// - No auto-repair. Nothing happens without a tap on this specific row.
// - No bulk repair. "Fix all 40" is one mistap away from 40 wrong writes,
//   and the user is staring at a list of ids they have no context for.
// - No merge of the record's own field values with anything. It removes or
//   re-points ONE id. A record pointing at three contacts where one was
//   deleted still has two good ones, and emptying the field to "tidy it up"
//   would discard real data to fix a problem one entry caused.
//
// The undo keeps the EXACT prior field value rather than re-deriving it, so
// it cannot itself be the second thing that is subtly wrong.
// Exported for its own render test, which is the only way this component can be
// proven to mount: it renders only when the scan actually found a dangling
// reference, and this app's data never has one, so the browser smoke suite
// reaches Developer Tools and sees the section around it without ever mounting
// this. A render-time crash here would ship invisible.
export function OrphanRow({ orphan, onRepaired, darkMode }) {
  const [shape, setShape] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [picking, setPicking] = useState(false);
  const [options, setOptions] = useState([]);
  const [undo, setUndo] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    describeRepair(orphan).then((s) => { if (live) setShape(s); });
    return () => { live = false; };
  }, [orphan]);

  const rerun = () => { setShape(null); setConfirming(false); setPicking(false); setUndo(null); setError(null); onRepaired(); };

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      const { previous } = await fn();
      setUndo(previous);
      setConfirming(false);
      setPicking(false);
      // Re-scan so the row disappears for the right reason (the write
      // landed) rather than being hidden by hand.
      setTimeout(rerun, 1200);
    } catch (e) {
      setError(e?.message || "That did not work.");
    } finally {
      setBusy(false);
    }
  };

  const openPicker = async () => {
    setBusy(true);
    try { setOptions(await repairOptions(orphan)); setPicking(true); }
    catch (e) { setError(e?.message || "Could not read the list to choose from."); }
    finally { setBusy(false); }
  };

  const btn = { fontSize: 11, fontWeight: 700, cursor: busy ? "default" : "pointer", padding: "3px 6px", borderRadius: 6, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) };
  const muted = darkMode ? DARK.textDisabled : NEUTRAL.textDisabled;

  return (
    <div style={{ padding: "8px 0", borderTop: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
      <div style={{ fontSize: 12, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontWeight: 600 }}>{orphan.recordType}: {orphan.recordLabel}</div>
      <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>
        its <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{orphan.field}</span> points at a {orphan.targetType} that no longer exists (id: {orphan.danglingId})
      </div>

      {undo !== null && (
        <div style={{ fontSize: 11, color: ACCENTS.home, marginTop: 5 }}>
          Cleared it.{" "}
          <span role="button" tabIndex={0} aria-label={`Undo the repair to ${orphan.field}`} onClick={() => run(() => undoRepair(orphan, undo))}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); run(() => undoRepair(orphan, undo)); } }}
            style={{ textDecoration: "underline", cursor: "pointer" }}>
            Undo
          </span>
        </div>
      )}

      {!undo && shape && (
        <>
          {shape.canRepair ? (
            confirming ? (
              <div style={{ marginTop: 6, fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>
                Remove this broken link from <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{orphan.field}</span>? Any other ids in that field are left alone.
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <span role="button" tabIndex={0} aria-label="Yes, clear the broken reference"
                    onClick={() => run(() => clearDanglingReference(orphan))}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); run(() => clearDanglingReference(orphan)); } }}
                    style={{ ...btn, color: ACTION.red, borderColor: ACTION.red, opacity: busy ? 0.5 : 1 }}>
                    {busy ? "Working…" : "Yes, clear it"}
                  </span>
                  <span role="button" tabIndex={0} aria-label="Cancel" onClick={() => setConfirming(false)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setConfirming(false); } }}
                    style={{ ...btn, color: muted }}>Cancel</span>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                <span role="button" tabIndex={0} aria-label={`Clear the broken reference on ${orphan.field}`} onClick={() => setConfirming(true)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setConfirming(true); } }}
                  style={{ ...btn, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, opacity: busy ? 0.5 : 1 }}>
                  Clear this reference
                </span>
                {shape.canRepoint && (
                  <span role="button" tabIndex={0} aria-label={`Point ${orphan.field} at a different ${orphan.targetType}`} onClick={openPicker}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPicker(); } }}
                    style={{ ...btn, color: ACCENTS.home, opacity: busy ? 0.5 : 1 }}>
                    {busy ? "Loading…" : "Point it at…"}
                  </span>
                )}
              </div>
            )
          ) : (
            <div style={{ fontSize: 11, color: muted, marginTop: 5 }}>{shape.reason} Open the record and clear it there.</div>
          )}

          {picking && (
            <div style={{ marginTop: 6, fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>
              Point it at which {orphan.targetType}?
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
                {options.length === 0 && <span style={{ color: muted }}>There are none left to point at, so clearing it is the only option.</span>}
                {options.slice(0, 40).map((opt) => (
                  <span key={opt.id} role="button" tabIndex={0} aria-label={`Point ${orphan.field} at ${opt.label}`}
                    onClick={() => run(() => repointDanglingReference(orphan, opt.id))}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); run(() => repointDanglingReference(orphan, opt.id)); } }}
                    style={{ ...btn, color: ACCENTS.home }}>
                    {opt.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {error && <div style={{ fontSize: 11, color: ACTION.red, marginTop: 5 }}>{error}</div>}
    </div>
  );
}

export function DeveloperToolsScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const dialogRef = useRef(null);
  useEffect(() => { dialogRef.current?.focus(); }, []);
  // ADDED — real audit finding (desktop full-width sweep): grid the
  // Storage overview/Data integrity/Diagnostics/Danger zone section
  // blocks on desktop, same multi-column treatment as this file's
  // other log/list-heavy screens.
  const isDesktopWidth = useIsDesktopWidth();

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
  // ADDED — real ask: a manual "check now" trigger, since a real fix
  // (deleting a record another one still references) can happen in the
  // very same session this screen is open, and there was previously no
  // way to see that reflected without leaving and reopening Developer
  // Tools. Same refreshKey/useLoadedMemo re-run pattern already used
  // elsewhere in this file (see notifPrefs/medPrefs above).
  // Data anomaly scan. Separate state from the orphan check above so
  // refreshing one does not silently re-run the other: they read different
  // repositories and a shared counter would make it impossible to tell which
  // one a "Check again" tap had actually re-read. The empty array is the not-
  // yet-loaded sentinel and is safe here precisely because this scan only ever
  // ADDS findings - unlike Global Search, where an empty array is
  // indistinguishable from a genuine "no matches" and had to become null.
  const [anomalyKey, setAnomalyKey] = useState(0);
  const [anomalyChecking, setAnomalyChecking] = useState(false);
  const anomaly = useLoadedMemo(
    async () => {
      const r = await findDataAnomalies();
      return { total: r.total, findings: r.findings, byKind: r.byKind };
    },
    [anomalyKey],
    { total: 0, findings: [], byKind: {} }
  );
  const [showAnomalies, setShowAnomalies] = useState(false);
  const recheckAnomalies = async (e) => {
    e.stopPropagation();
    setAnomalyChecking(true);
    setAnomalyKey((k) => k + 1);
    setTimeout(() => setAnomalyChecking(false), 400);
  };
  const [orphanCheckKey, setOrphanCheckKey] = useState(0);
  const [orphanChecking, setOrphanChecking] = useState(false);
  const orphans = useLoadedMemo(() => findOrphanReferences(), [orphanCheckKey], []);
  const [showOrphans, setShowOrphans] = useState(false);
  const recheckOrphans = async (e) => {
    e.stopPropagation();
    setOrphanChecking(true);
    setOrphanCheckKey((k) => k + 1);
    // findOrphanReferences() runs synchronously fast even at this app's
    // largest realistic data volumes (see this session's own data-
    // volume stress-testing entry in CLAUDE.md) — this is purely a
    // "did tapping it do something" affordance, not a real progress
    // indicator for a slow operation.
    setTimeout(() => setOrphanChecking(false), 400);
  };
  // ADDED — real ask: "allow error reporting" — see ErrorLogScreen's
  // own header for the full reasoning (a local, on-device log, not a
  // real third-party crash reporter).
  const errorCount = useLoadedMemo(() => ErrorLogRepository.getAll().then((l) => l.length), [], 0);
  const [showErrorLog, setShowErrorLog] = useState(false);
  // ADDED — real groundwork for encryption at rest: hasUnbackedChanges()
  // is now async (see backupService.js's own comment), so this can no
  // longer be called straight in the render body below — a Promise is
  // always truthy, so `{hasUnbackedChanges() && (...)}` would render
  // the warning permanently, regardless of the real answer.
  const unbackedChanges = useLoadedMemo(() => hasUnbackedChanges(), [], false);
  // ADDED — real groundwork for encryption at rest: LocationsRepository
  // is now async (see its own comment), so its count can no longer be
  // read straight inline in the `counts` array below like every other
  // (still-synchronous) repository here — loaded separately via
  // useLoadedMemo and substituted in.
  const locationsCount = useLoadedMemo(() => LocationsRepository.getAll().then((l) => l.length), [], 0);
  // CHANGED — Phase 2 encryption groundwork: ContactRepository went
  // async too — same treatment as locationsCount above.
  const contactsCount = useLoadedMemo(() => ContactRepository.getAll().then((l) => l.length), [], 0);
  // CHANGED — Phase 2 encryption groundwork: LogRepository/
  // EpisodeRepository went async too — same treatment as
  // locationsCount/contactsCount above.
  const logsCount = useLoadedMemo(() => LogRepository.getAll().then((l) => l.length), [], 0);
  const episodesCount = useLoadedMemo(() => EpisodeRepository.getAll().then((l) => l.length), [], 0);
  const symptomLogCount = useLoadedMemo(() => SymptomLogRepository.getAll().then((l) => l.length), [], 0);
  const vaccinationsCount = useLoadedMemo(() => VaccinationRepository.getAll().then((l) => l.length), [], 0);
  const encountersCount = useLoadedMemo(() => EncounterRepository.getAll().then((l) => l.length), [], 0);
  const testsCount = useLoadedMemo(() => TestingRepository.getAll().then((l) => l.length), [], 0);
  const medicationsCount = useLoadedMemo(() => MedicationRepository.getAll().then((l) => l.length), [], 0);
  const clinicVisitsCount = useLoadedMemo(() => ClinicVisitsRepository.getAll().then((l) => l.length), [], 0);
  // CHANGED — Phase 2 encryption groundwork: the six simpleRegistry.js-
  // based registries are now async — same useLoadedMemo treatment as
  // every other repository count above (previously read inline in the
  // counts array below, direct render-body calls that broke once these
  // registries went async).
  const kinkCount = useLoadedMemo(() => KinkRegistry.getAll().then((l) => l.length), [], 0);
  const chemsCount = useLoadedMemo(() => ChemsRegistry.getAll().then((l) => l.length), [], 0);
  const protectionCount = useLoadedMemo(() => ProtectionRegistry.getAll().then((l) => l.length), [], 0);
  const symptomsRegistryCount = useLoadedMemo(() => SymptomsRegistry.getAll().then((l) => l.length), [], 0);
  const organismCount = useLoadedMemo(() => OrganismRegistry.getAll().then((l) => l.length), [], 0);
  const resultsCount = useLoadedMemo(() => ResultsRegistry.getAll().then((l) => l.length), [], 0);
  const counts = [
    { label: "Contacts", value: contactsCount },
    { label: "Encounters", value: encountersCount },
    { label: "Medications", value: medicationsCount },
    { label: "Medication log entries", value: logsCount },
    { label: "Tests", value: testsCount },
    { label: "Clinic visits", value: clinicVisitsCount },
    { label: "Symptom Log entries", value: symptomLogCount },
    { label: "Vaccinations", value: vaccinationsCount },
    { label: "Timeline episodes", value: episodesCount },
    { label: "Kink Registry entries", value: kinkCount },
    { label: "Chems Registry entries", value: chemsCount },
    { label: "Protection Registry entries", value: protectionCount },
    { label: "Symptoms Registry entries", value: symptomsRegistryCount },
    { label: "Locations", value: locationsCount },
    { label: "Organism Registry entries", value: organismCount },
    { label: "Results Registry entries", value: resultsCount },
  ];

  // FIXED 27 Sep 2026 - this genuinely did not reset anything.
  // clearAllAppData() only removes the localStorage keys, but every
  // repository keeps an in-memory cache that survives that, AND each
  // repository loads with `storage.load(KEY, seedX)` so a MISSING key brings
  // the seed data straight back on the next read. Measured: 16 contacts
  // before, 0 storage keys after, still 16 contacts in memory - and back to
  // 16 after a reload. The button's own confirmation text promises a
  // permanent delete, so it now goes through the repositories, which own
  // both the cache and the seed-vs-empty distinction.
  const [resetResult, setResetResult] = useState(null);
  const handleReset = async () => {
    const result = await resetAllData();
    setResetResult(result);
    setResetStage("done");
  };

  // ADDED 27 Sep 2026 - the non-destructive counterpart to handleReset above.
  // Kept as genuinely separate state and a genuinely separate action rather than
  // a mode of the reset, because the difference matters: reset empties every
  // collection including the user's own records, this removes only the ids that
  // came from the seed arrays. Both report what they did, because a partial
  // clear that silently left sample data behind would be worse than useless.
  const [sampleCount, setSampleCount] = useState(0);
  const [clearingSample, setClearingSample] = useState(false);
  const [sampleResult, setSampleResult] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const refresh = () => { countSampleData().then((r) => { if (!cancelled) setSampleCount(r.total); }).catch(() => {}); };
    refresh();
    // Re-read whenever the sample data is cleared ANYWHERE, not just here. The
    // first-run banner on Home is the other place that can clear it, and
    // without this the panel sat there claiming 96 records were still present
    // with a button that would then report there was nothing to remove. Found
    // by the smoke flow, not by reading the code.
    return onSampleDataChanged(refresh);
  }, []);
  const sampleDataCount = sampleCount;
  const handleClearSample = async () => {
    setClearingSample(true);
    try {
      const result = await clearSampleData();
      setSampleResult(result);
    } finally {
      setClearingSample(false);
    }
  };

  return (
    <div ref={dialogRef} role="dialog" aria-label="Developer tools" tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: darkMode ? DARK.bg : NEUTRAL.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: STICKY_SCREEN_HEADER_TOP, background: darkMode ? DARK.bg : NEUTRAL.bg, borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label="Back" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Developer tools</h1>
      </div>

      {/* ADDED — real ask: this never explained what it was actually
          counting. It's a real storage overview (every repository's
          live record count) plus a full reset below — not a
          timeframe-based count, that's a separate, still-outstanding
          Activity filter request. */}
      <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, padding: "10px 16px 0" }}>
        Live record counts across every part of the app's local storage, mainly useful for confirming a backup/restore or migration went as expected.
      </div>

      <div style={isDesktopWidth ? { columnCount: 2, columnGap: 0 } : undefined}>
      <div style={isDesktopWidth ? { breakInside: "avoid" } : undefined}>
      <div style={{ ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, padding: "16px 16px 6px" }}>Storage overview</div>
      <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, margin: "0 16px 20px", padding: "4px 14px" }}>
        <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => setShowStorageBreakdown((s) => !s)} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), cursor: "pointer" }}>
          <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>Local storage used{storageUsage.byKey.length > 0 ? (showStorageBreakdown ? " ▲" : " ▼") : ""}</span>
          <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>{formatBytes(storageUsage.totalBytes)}</span>
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
                <span style={{ color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, fontFamily: "'JetBrains Mono', monospace" }}>{k.key.replace(/^shos_/, "")}</span>
                <span style={{ color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>{formatBytes(k.bytes)}</span>
              </div>
            ))}
          </div>
        )}
        {counts.map((c) => (
          <div key={c.label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
            <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>{c.label}</span>
            <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>{c.value}</span>
          </div>
        ))}
      </div>
      </div>

      <div style={isDesktopWidth ? { breakInside: "avoid" } : undefined}>
      {/* ADDED — real ask: surface dangling relation-by-ID references
          (e.g. an Encounter whose attendeeIds still names a Contact
          that's since been hard-deleted) — nothing else in the app
          currently notices these.
          CHANGED 6 Oct 2026: this section used to say "Read-only: flags
          them for a human to fix by hand, same never-silently-fix
          restraint the Registry duplicate checker applies." That was half
          true and is now false in a way worth recording: the RESTRAINT is
          still exactly right, but "by hand" meant a multi-step errand for
          one stale id, and a report you cannot act on is a report that
          gets ignored. Each row now offers Clear / Point-at, both
          explicitly per-row per-field, with the prior value kept for undo.
          See referenceRepair.js's own header for what is deliberately not
          offered — no auto-repair, no bulk repair, no field merging. */}
      <div style={{ ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, padding: "0 16px 6px" }}>Data integrity</div>
      <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, margin: "0 16px 20px", padding: "4px 14px" }}>
        <div onClick={() => orphans.length > 0 && setShowOrphans((s) => !s)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", cursor: orphans.length > 0 ? "pointer" : "default" }}>
          <LinkBreak size={15} color={orphans.length > 0 ? ACTION.red : (darkMode ? DARK.textDisabled : NEUTRAL.textDisabled)} />
          <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, flex: 1 }}>Broken references</span>
          <span onClick={recheckOrphans} role="button" tabIndex={0} aria-label="Check again"
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); recheckOrphans(e); } }}
            style={{ fontSize: 11, fontWeight: 700, color: ACCENTS.home, cursor: "pointer", padding: "2px 4px" }}>
            {orphanChecking ? "Checking…" : "Check again"}
          </span>
          <span style={{ fontSize: 13, color: orphans.length > 0 ? ACTION.red : (darkMode ? DARK.textPrimary : NEUTRAL.textPrimary), fontWeight: 700 }}>
            {orphans.length === 0 ? "None found" : `${orphans.length}${showOrphans ? " ▲" : " ▼"}`}
          </span>
        </div>
        {showOrphans && orphans.length > 0 && (
          <div style={{ padding: "0 0 9px" }}>
            {orphans.map((o, i) => (
              <OrphanRow key={`${o.recordId}|${o.field}|${o.danglingId}`} orphan={o} onRepaired={() => setOrphanCheckKey((k) => k + 1)} darkMode={darkMode} />
            ))}
          </div>
        )}
      </div>

      {/* NEW — dataAnomalyScan.js. Deliberately a SEPARATE row from the broken
          references above rather than a section merged into it, because the two
          answer different questions: that one asks "does a record point at
          something that is not there" (a definite fault, with a repair), and
          this one asks "do these records tell a coherent story" (a question,
          with NO repair offered). Merging them would imply a fix this one
          deliberately does not have, which is the difference that matters most
          on a screen whose whole purpose is being trusted about data.

          No write actions anywhere in this row, by design rather than by
          omission: a wrong auto-correction on health data is silent and the
          owner finds out at a clinic. Every finding explains itself in words so
          the judgement stays with the person, and the double-log finding is
          worded as "worth a look" because a same-venue pair is EVIDENCE, not
          proof — two separate meetings in one evening are a real thing. */}
      <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, margin: "0 16px 20px", padding: "4px 14px" }}>
        <div onClick={() => anomaly.total > 0 && setShowAnomalies((s) => !s)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", cursor: anomaly.total > 0 ? "pointer" : "default" }}>
          <WarningDiamond size={15} color={anomaly.total > 0 ? ACTION.gold : (darkMode ? DARK.textDisabled : NEUTRAL.textDisabled)} />
          <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, flex: 1 }}>Records worth a look</span>
          <span onClick={recheckAnomalies} role="button" tabIndex={0} aria-label="Check records again"
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); recheckAnomalies(e); } }}
            style={{ fontSize: 11, fontWeight: 700, color: ACCENTS.home, cursor: "pointer", padding: "2px 4px" }}>
            {anomalyChecking ? "Checking…" : "Check again"}
          </span>
          <span style={{ fontSize: 13, color: anomaly.total > 0 ? ACTION.gold : (darkMode ? DARK.textPrimary : NEUTRAL.textPrimary), fontWeight: 700 }}>
            {anomaly.total === 0 ? "None found" : `${anomaly.total}${showAnomalies ? " ▲" : " ▼"}`}
          </span>
        </div>
        {showAnomalies && anomaly.total > 0 && (
          <div style={{ padding: "0 0 9px" }}>
            <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, paddingBottom: "7px", lineHeight: 1.45 }}>
              These are questions about your own records, not problems to fix automatically. Each one explains why it was flagged, and nothing here changes anything by itself.
            </div>
            {ANOMALY_ORDER.map((kind) => {
              const group = anomaly.findings.filter((f) => f.kind === kind);
              if (group.length === 0) return null;
              return (
                <div key={kind} style={{ paddingBottom: "8px" }}>
                  <div style={{ ...TYPE.sectionLabel, fontSize: 10, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, paddingBottom: "4px" }}>{ANOMALY_KIND_LABELS[kind]} · {group.length}</div>
                  {group.map((f, i) => (
                    <div key={`${f.kind}|${f.recordId}|${i}`} style={{ padding: "7px 0", borderTop: i === 0 ? "none" : "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>
                        {f.recordType}: {f.recordLabel}
                      </div>
                      <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, paddingTop: "2px", lineHeight: 1.45 }}>
                        {cap(f.why)}
                      </div>
                      {f.pairedWithId && (
                        <div style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, paddingTop: "3px", lineHeight: 1.45 }}>
                          Paired with <span style={{ fontWeight: 600 }}>{f.pairedWithLabel}</span>. Two records can be a real second meeting rather than a duplicate — this one is only pointing at the possibility.
                        </div>
                      )}
                      {f.fixableByEditingTheRecord && (
                        <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, paddingTop: "3px" }}>
                          Correct this by editing the record's own dates.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>

      <div style={isDesktopWidth ? { breakInside: "avoid" } : undefined}>
      {/* ADDED — real ask: "allow error reporting." See
          ErrorLogScreen's own header for the full reasoning (a local,
          on-device log, not a real third-party crash-reporting
          service — this app's whole "nothing leaves the device
          without you choosing to" design applies here too). */}
      <div style={{ ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, padding: "0 16px 6px" }}>Diagnostics</div>
      <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, margin: "0 16px 20px", padding: "4px 14px" }}>
        <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => setShowErrorLog(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", cursor: "pointer" }}>
          <Bug size={15} color={errorCount > 0 ? ACTION.red : (darkMode ? DARK.textDisabled : NEUTRAL.textDisabled)} />
          <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, flex: 1 }}>Error log</span>
          <span style={{ fontSize: 13, color: errorCount > 0 ? ACTION.red : (darkMode ? DARK.textPrimary : NEUTRAL.textPrimary), fontWeight: 700 }}>
            {errorCount === 0 ? "None" : errorCount}
          </span>
          <ChevronRight size={16} color={darkMode ? DARK.textSecondary : NEUTRAL.textSecondary} />
        </div>
      </div>
      {showErrorLog && <ErrorLogScreen darkMode={darkMode} onClose={() => setShowErrorLog(false)} />}
      </div>

      <div style={isDesktopWidth ? { breakInside: "avoid" } : undefined}>
      <div style={{ ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, padding: "0 16px 6px" }}>Danger zone</div>
      <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: `1px solid ${ACTION.red}`, borderRadius: RADIUS.md, margin: "0 16px 20px", padding: 16 }}>
        {resetStage === "done" ? (
          // Reports what actually happened rather than a blanket "cleared",
          // because a partial reset that silently claims success is the exact
          // failure this button already had.
          <div>
            <div style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>
              {resetResult?.failed?.length
                ? `Cleared ${resetResult.ok.length} of ${resetResult.ok.length + resetResult.failed.length} stores. Some could not be cleared.`
                : `All app data cleared (${resetResult?.ok.length ?? 0} stores). Reload the app to see the fresh-start state.`}
            </div>
            {resetResult?.failed?.length > 0 && (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12, color: ACTION.red }}>
                {resetResult.failed.map((f) => <li key={f.name}>{f.name}: {f.error}</li>)}
              </ul>
            )}
          </div>
        ) : resetStage === "confirming" ? (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 12 }}>
              <AlertTriangle size={16} color={ACTION.red} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>This permanently deletes EVERYTHING on this device — your contacts, encounters, medications, logs, tests, clinic visits, the sample data, and every preference, including your App Lock PIN. There's no undo — export a backup first if you're not sure. To remove only the made-up example data, cancel and use “Clear sample data” instead.</div>
            </div>
            {/* ADDED 26 Aug 2026 — real ask: warn explicitly if there
                are genuinely unbacked-up changes, not just a generic
                "back up first" reminder every time regardless of
                whether anything's actually at risk. */}
            {unbackedChanges && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 12, padding: "10px 12px", borderRadius: 10, background: `${ACTION.red}15`, border: `1px solid ${ACTION.red}` }}>
                <AlertTriangle size={14} color={ACTION.red} style={{ flexShrink: 0, marginTop: 2 }} />
                {/* ADDED 10 Sep 2026 — real accessibility fix: ACTION.red
                    as text on its own `${ACTION.red}15` tint (2 lines up)
                    fails 4.5:1 — see designTokens.js's own comment on
                    ACTION_TEXT_SAFE. Dark mode's resolved red already
                    has headroom, so only light mode swaps to the darker
                    stand-in. */}
                <div style={{ fontSize: 12, color: darkMode ? resolveDarkAccent("actionRed", ACTION.red, "#FF7A7E") : ACTION_TEXT_SAFE.red, fontWeight: 600 }}>You have changes since your last backup that would be lost. Export a backup before continuing.</div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setResetStage("idle")} style={{ flex: 1, padding: 12, borderRadius: 12, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), background: darkMode ? DARK.surface : NEUTRAL.surface, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleReset} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: ACTION.red, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Yes, delete everything</button>
            </div>
          </>
        ) : (
          <>
            {/* ADDED 27 Sep 2026 - "Clear sample data" as a genuinely separate
                action, sitting directly above "Reset all app data".

                Why this is not just a rename of the reset button: repositories
                load their seed array as the fallback for an absent storage key,
                so the moment a user creates a record the sample data is
                persisted into the same array as their own. "Reset all app data"
                would then destroy THEIR data too. This removes only the ids
                that came from the seed arrays, so it is safe at any time and
                always keeps real records - see clearSampleData.js.

                Placed above rather than below so the non-destructive option is
                read first. Someone who came here to get rid of the demo
                content was previously offered one button, worded as total data
                loss, with no way to tell the two situations apart. */}
            {sampleDataCount > 0 && (
              <div style={{ marginBottom: 12, padding: "12px", borderRadius: 12, background: darkMode ? DARK.surfaceVariant : NEUTRAL.surfaceVariant, border: `1px solid ${darkMode ? DARK.border : NEUTRAL.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, marginBottom: 4 }}>
                  {sampleDataCount} sample records are still here
                </div>
                <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, lineHeight: 1.45, marginBottom: 10 }}>
                  SHOS starts with made-up example data so you can look around before adding
                  anything. Removing it keeps every record you have added yourself.
                </div>
                <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClearSample(); } }} onClick={handleClearSample}
                  aria-label="Clear the sample data"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, border: `1px solid ${darkMode ? DARK.border : NEUTRAL.border}`, background: darkMode ? DARK.surface : NEUTRAL.surface, fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, cursor: clearingSample ? "default" : "pointer", opacity: clearingSample ? 0.6 : 1 }}>
                  {clearingSample ? "Clearing…" : "Clear sample data"}
                </div>
              </div>
            )}
            <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => setResetStage("confirming")} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <Trash2 size={17} color={ACTION.red} />
              <span style={{ fontSize: 14, color: ACTION.red, fontWeight: 600 }}>Reset all app data</span>
            </div>
            {/* ADDED 27 Sep 2026 - the one-line distinction. The two buttons
                above look similar and mean very different things, and a user
                has no way to tell them apart from the labels alone. */}
            <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, marginTop: 6, lineHeight: 1.45 }}>
              This one deletes everything, including your own records. If you only want to remove
              the example data, use “Clear sample data” above.
            </div>
            {sampleResult && (
              // FIXED 27 Sep 2026 — this used to sit INSIDE the
              // `sampleDataCount > 0` block above, which meant it disappeared
              // at the exact moment it became relevant: clearing drives the
              // count to zero, so the panel unmounted and the user got no
              // confirmation the action had worked at all. Caught by the smoke
              // flow asserting on the reported count. A confirmation that only
              // exists while there is still a problem to confirm is not a
              // confirmation.
              <div style={{ marginTop: 8, fontSize: 12, color: sampleResult.failed.length ? ACTION_TEXT_SAFE.red : (darkMode ? DARK.textSecondary : NEUTRAL.textSecondary), lineHeight: 1.45 }}>
                {sampleResult.removed > 0
                  ? `Removed ${sampleResult.removed} sample record${sampleResult.removed === 1 ? "" : "s"}. Anything you added yourself was kept.`
                  : "There was no sample data left to remove."}
                {sampleResult.failed.length > 0 && ` Could not clear: ${sampleResult.failed.map((f) => f.name).join(", ")}.`}
              </div>
            )}
          </>
        )}
      </div>
      </div>
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

export default DeveloperToolsScreen;

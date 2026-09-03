import React, { useMemo, useState, useEffect } from "react";
import { CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight, CaretDownIcon as CaretDown, PillIcon as Pill, HeartbeatIcon as HeartPulse, UsersIcon as Users, WarningIcon as AlertTriangle, PlusIcon as Plus, GearIcon as Settings, XIcon as X, CheckIcon as Check, FilePdfIcon as FilePdf } from "@phosphor-icons/react";
import { exportClinicCardPdf } from "../storage/clinicCardPdfService";
import MyProfileModule from "./SHOS_MyProfile_Prototype";
import { MedicationRepository } from "../repositories/medicationRepository";
import { LogRepository } from "../repositories/logRepository";
import { TestingRepository } from "../repositories/testingRepository";
import { OrganismRegistry } from "../registries/organismRegistry";
import { ResultsRegistry } from "../registries/resultsRegistry";
import { EncounterRepository } from "../repositories/encounterRepository";
import { SymptomsRegistry } from "../registries/symptomsRegistry";
import { computeStock } from "../calculations/medicationCalculations";
import { formatRelativeDate, sortByDateDesc } from "../calculations/encounterCalculations";
import { nowAsStoredDate, inDaysAsStoredDate } from "../calculations/dateInputHelpers";
import { useClinicCardVisibility, CLINIC_CARD_SECTIONS } from "../calculations/clinicCardVisibilityPreference";
import { MyProfileRepository } from "../repositories/myProfileRepository";
import { SymptomLogRepository } from "../repositories/symptomLogRepository";
import { VaccinationRepository } from "../repositories/vaccinationRepository";
import { AppPreferencesRepository } from "../repositories/appPreferencesRepository";
import { MenstrualCycleRepository } from "../repositories/menstrualCycleRepository";
import { ContraceptionRepository } from "../repositories/contraceptionRepository";
import { PregnancyRepository } from "../repositories/pregnancyRepository";
// CHANGED 20 Aug 2026 — real design-unification pass: values read
// from the shared designTokens.js source of truth instead of being
// retyped here. See designTokens.js.
import { NEUTRAL, NEUTRAL_DARK, ACCENTS, ACTION, RADIUS, resolveDarkAccent } from "../calculations/designTokens";
import { useDarkModePreference } from "../calculations/darkModePreference";

const LIGHT = {
  ...NEUTRAL,
  healthcareBlue: ACCENTS.healthcare, actionRed: ACTION.red,
};
// CHANGED — real architecture fix, same as Contacts' own comment:
// resolveDarkAccent() keeps today's exact behaviour by default, only
// brightening once a real colour override exists.
const DARK = {
  ...NEUTRAL_DARK,
  healthcareBlue: resolveDarkAccent("healthcare", ACCENTS.healthcare, "#0E8144"), actionRed: resolveDarkAccent("actionRed", ACTION.red, "#FF7A7E"),
};

// ADDED 19 Aug 2026 — Clinic Card. Real feature set built out over
// several sessions since: all 9 sections (Identity, Medications,
// Allergies, Vaccinations, Recent STI testing, Current treatment,
// Active symptoms, Recent encounters, Emergency information) now read
// real data — Allergies/Emergency come from MyProfileRepository,
// Vaccinations from its own real repository, none are stubs anymore.
//
// Real, shipped since: tap-through with a confirmation step for
// individual records (title taps navigate immediately), collapsible
// sections (Medications/Vaccinations/Recent Encounters default
// collapsed), a shared filterable timeframe, per-section visibility
// settings, and quick-add shortcuts with real prefilled starting
// values (TOC 2 week, Book appointment, Treatment given). See
// clinicCardVisibilityPreference.js for the visibility-settings piece.
//
// "Recent encounters" showing descriptive Encounter titles + date is
// a deliberate exception to a stricter minimalism default elsewhere
// in the app — not an oversight.
//
// Mostly read-only by design — everything here is DERIVED from real
// repositories. Identity is the one deliberate exception, editable
// directly on this screen (DOB, clinic number, address, NHS number)
// since there's genuinely nowhere else these fields belong.
function loadMedicationsWithLogs() {
  return MedicationRepository.getAll()
    .filter((m) => !m.isArchived)
    .map((m) => ({ ...m, logs: LogRepository.getForMedication(m.id) }));
}

// CHANGED — real ask: "Ensure clicking title takes you to that module,
// and maybe clicking the record takes you to that records root (at
// least having a confirmation screen)." Title taps navigate
// immediately (no confirmation — you're not leaving a specific record
// behind, just choosing where to go). Record taps go through a real
// confirmation step first, via the shared pendingNav state below.
function SectionHeader({ children, onTap, T }) {
  return (
    <div onClick={onTap} style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, padding: "16px 16px 6px", cursor: onTap ? "pointer" : "default", display: "flex", alignItems: "center", gap: 4 }}>
      {children}
      {onTap && <ChevronRight size={12} color={T.textSecondary} />}
    </div>
  );
}

// ADDED — real ask: "Medications, vaccinations, recent partners can be
// drop-down menus as default — too cluttered for info not routinely
// used." A genuinely separate control from the navigate-tap above —
// the title text still opens the module when tapped, this chevron is
// its own click zone that only toggles this section's visibility, so
// the two real interactions (navigate vs collapse) don't fight over
// the same tap target.
function CollapsibleSectionHeader({ children, onTap, count, collapsed, onToggleCollapse, T }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 6px" }}>
      <div onClick={onTap} style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, cursor: onTap ? "pointer" : "default", display: "flex", alignItems: "center", gap: 4 }}>
        {children}
        {onTap && <ChevronRight size={12} color={T.textSecondary} />}
      </div>
      <div onClick={onToggleCollapse} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", padding: "2px 4px" }}>
        {count != null && <span style={{ fontSize: 11, color: T.textDisabled }}>{count}</span>}
        <CaretDown size={13} color={T.textSecondary} style={{ transform: collapsed ? "none" : "rotate(180deg)", transition: "transform 150ms ease" }} />
      </div>
    </div>
  );
}

function SectionCard({ children, T }) {
  return <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, margin: "0 16px", overflow: "hidden" }}>{children}</div>;
}

function Row({ dot, title, subtitle, alert, color, onTap, T }) {
  return (
    <div onClick={onTap} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${T.border}`, cursor: onTap ? "pointer" : "default" }}>
      <span style={{ width: 9, height: 9, borderRadius: 999, background: alert ? T.actionRed : (color || T.healthcareBlue), flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: alert ? T.actionRed : T.textPrimary }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 1 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function EmptyRow({ children, T }) {
  return <div style={{ padding: "14px", fontSize: 13, color: T.textDisabled }}>{children}</div>;
}

function StubRow({ children, T }) {
  return (
    <div style={{ display: "flex", gap: 8, padding: "14px", alignItems: "flex-start" }}>
      <AlertTriangle size={14} color={T.textDisabled} style={{ flexShrink: 0, marginTop: 2 }} />
      <span style={{ fontSize: 12, color: T.textDisabled, lineHeight: 1.4 }}>{children}</span>
    </div>
  );
}

export default function ClinicCardScreen({ onClose, onNavigateToRecord, onQuickAddWithPrefill, registerModuleBackHandler }) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : LIGHT;
  const meds = useMemo(() => loadMedicationsWithLogs(), []);
  const tests = useMemo(() => sortByDateDesc(TestingRepository.getAll().filter((t) => !t.isArchived)), []);
  const encounters = useMemo(() => sortByDateDesc(EncounterRepository.getAll()), []);
  const [profile, setProfile] = useState(() => MyProfileRepository.getProfile());

  // ADDED — real ask: "Recent partners should have filterable
  // timeframe... maybe generic for whole clinic card — so can say all
  // since X date, or all since last test (which system can pull that
  // date through)." One shared control, applied to Recent Encounters
  // and Vaccinations. Deliberately NOT applied to Recent STI Testing
  // itself — "since last test" filtering the Testing section against
  // the most recent test's own date is circular (a test can't happen
  // "since itself") — nor to Current Treatment/Active Symptoms/
  // Medications, which represent current state, not history to narrow.
  const lastTestDate = tests[0]?.date || null;
  const [timeframe, setTimeframe] = useState("all");
  const [customDate, setCustomDate] = useState("");
  const cutoffDate = useMemo(() => {
    if (timeframe === "sinceLastTest") return lastTestDate;
    if (timeframe === "30days") return new Date(Date.now() - 30 * 86400000).toISOString();
    if (timeframe === "90days") return new Date(Date.now() - 90 * 86400000).toISOString();
    if (timeframe === "custom" && customDate) return new Date(customDate).toISOString();
    return null;
  }, [timeframe, customDate, lastTestDate]);
  const withinTimeframe = (dateStr) => !cutoffDate || !dateStr || dateStr >= cutoffDate;

  const nameFrom = (registry, id) => registry.getById(id)?.name || "—";

  const [editingIdentity, setEditingIdentity] = useState(false);
  // ADDED — real ask: tap-through with a confirmation step for
  // individual records (title taps navigate immediately, no
  // confirmation needed there — see SectionHeader's own reasoning).
  const [pendingNav, setPendingNav] = useState(null);
  const goTo = (tab, subTab, recordId) => { onNavigateToRecord?.(tab, recordId, subTab); onClose(); };
  const quickAdd = (tab, subTab, prefill) => { onQuickAddWithPrefill?.(tab, subTab, prefill); onClose(); };
  // ADDED — real ask: "settings to filter which things are shown. We'll
  // give the most details permitted, and filters restrict from this."
  // Every section defaults to visible; this only ever narrows.
  const [visibility, , toggleSection] = useClinicCardVisibility();
  const [showVisibilitySettings, setShowVisibilitySettings] = useState(false);
  // ADDED — real ask: "clinician-facing export" — a real PDF, not just
  // the on-screen summary, honouring the same section visibility below
  // so it can never show more than the screen does. exportingPdf guards
  // against a second tap firing a second generation while the native
  // Share sheet is still opening.
  const [exportingPdf, setExportingPdf] = useState(false);
  const exportPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      await exportClinicCardPdf(visibility);
    } catch (err) {
      console.error("[ClinicCard] PDF export failed:", err);
    } finally {
      setExportingPdf(false);
    }
  };
  // ADDED — real ask: Allergies/Emergency info's own empty-state used to
  // just describe where to go add this data instead of taking you
  // there — tapping it now opens My Profile directly, straight into
  // its edit form.
  const [showMyProfile, setShowMyProfile] = useState(false);
  // ADDED — real ask: collapsed by default for the 3 flagged sections
  // specifically (Medications, Vaccinations, Recent encounters) — the
  // rest stay always-visible, since they're either already compact
  // (Identity, Allergies) or genuinely time-sensitive/likely-to-be-
  // acted-on (Testing, Treatment, Symptoms), not "routinely unused."
  const [collapsed, setCollapsed] = useState({ medications: true, vaccinations: true, encounters: true });
  const toggleCollapsed = (key) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  // ADDED — real ask: back should close whichever overlay is actually on
  // top (the nav confirmation, then editing/settings panels) before
  // closing Clinic Card itself, matching the pattern every other module
  // uses. `collapsed` is deliberately excluded — collapsing a section is
  // a display preference, not a navigation state back should undo.
  useEffect(() => {
    if (!registerModuleBackHandler) return;
    registerModuleBackHandler(() => {
      if (showMyProfile) { setShowMyProfile(false); return true; }
      if (pendingNav) { setPendingNav(null); return true; }
      if (editingIdentity) { setEditingIdentity(false); return true; }
      if (showVisibilitySettings) { setShowVisibilitySettings(false); return true; }
      onClose?.();
      return true;
    });
    return () => registerModuleBackHandler(null);
  }, [showMyProfile, pendingNav, editingIdentity, showVisibilitySettings, registerModuleBackHandler, onClose]);
  const [identityDraft, setIdentityDraft] = useState(null);

  const openIdentityEdit = () => {
    setIdentityDraft({ dateOfBirth: profile.dateOfBirth, clinicNumber: profile.clinicNumber, address: profile.address, nhsNumber: profile.nhsNumber });
    setEditingIdentity(true);
  };
  const saveIdentity = () => {
    setProfile(MyProfileRepository.update(identityDraft));
    setEditingIdentity(false);
  };

  const recentTests = tests.slice(0, 5).map((t) => {
    const resultNames = (t.resultIds || []).map((id) => nameFrom(ResultsRegistry, id));
    const isPositive = resultNames.some((r) => r.toLowerCase() === "positive");
    const testingFor = (t.testingFor || []).join(", ") || t.title || "Test";
    return { id: t.id, title: testingFor, subtitle: `${formatRelativeDate(t.date)} · ${resultNames.join(", ") || "No result logged"}`, alert: isPositive };
  });

  // Current treatment: a positive result with no follow-up action date
  // logged yet — the same "open" signal Testing's own module already
  // uses (Follow-up Actioned Date empty), not a new concept invented
  // for this screen.
  const currentTreatment = tests.filter((t) => {
    const resultNames = (t.resultIds || []).map((id) => nameFrom(ResultsRegistry, id));
    const isPositive = resultNames.some((r) => r.toLowerCase() === "positive");
    return isPositive && !t.followUpActionedDate;
  }).map((t) => ({
    id: t.id,
    title: (t.testingFor || []).join(", ") || t.title || "Positive result",
    subtitle: `${formatRelativeDate(t.date)} · awaiting follow-up`,
  }));

  // CHANGED 19 Aug 2026 — replaced the 30-day-Encounters-tag proxy with
  // the real thing, now that Symptom Log exists: "active" is Symptom
  // Log's own real Date Resolved field being empty, not a guessed time
  // window. Severe entries flagged red, same Action State pattern as
  // the rest of this screen.
  const activeSymptoms = SymptomLogRepository.getActive();

  // ADDED 2 Sep 2026 — real ask: "clinic cards may want some
  // information about contraception and/or pregnancy and/or
  // menstruation" — genuinely relevant clinical context (contraception
  // interacts with treatment choices, an active pregnancy changes what
  // testing/treatment is safe) that this screen had zero coverage of.
  // Same "skip entirely when off" gating Home's own dashboard already
  // uses — nothing real to show, and no reason to read three
  // repositories, when the user doesn't use this feature at all.
  const menstrualTrackingEnabled = AppPreferencesRepository.getPreferences().menstrualTrackingEnabled;
  // Respects the same sensitive/masked flag the Menstrual & Contraception
  // module itself already offers per-entry — a pregnancy the user has
  // deliberately masked there doesn't surface on a screen built to be
  // shown to someone else.
  const activePregnancyRaw = menstrualTrackingEnabled ? PregnancyRepository.getActive() : null;
  const activePregnancy = activePregnancyRaw && !activePregnancyRaw.sensitive ? activePregnancyRaw : null;
  const lastPeriod = menstrualTrackingEnabled
    ? [...MenstrualCycleRepository.getAll().filter((c) => !c.isArchived)].sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0))[0] || null
    : null;
  const activeContraception = menstrualTrackingEnabled ? ContraceptionRepository.getActive() : [];

  // CHANGED 19 Aug 2026 — real data, Vaccination Record now exists.
  // Shows recent vaccinations plus any overdue boosters/next-dues in
  // red — same Action State convention as the rest of this screen.
  const vaccinations = sortByDateDesc(VaccinationRepository.getAll().filter((v) => !v.isArchived && withinTimeframe(v.date)));
  const overdueVaccinations = VaccinationRepository.getOverdue();

  const recentPartners = encounters.filter((e) => withinTimeframe(e.date)).slice(0, 8).map((e) => ({
    id: e.id,
    title: e.title || e.encounterType || "Encounter",
    subtitle: e.date ? formatRelativeDate(e.date) : "",
  }));

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: T.bg, zIndex: 200, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, flex: 1 }}>{profile.nickname ? `${profile.nickname}'s clinic card` : "Clinic Card"}</span>
        {/* ADDED — real ask: a real PDF export, for handing this to (or
            printing for) a clinician rather than only reading it on
            screen. Disabled mid-export rather than hidden, so a slow
            device doesn't look like the tap did nothing. */}
        <FilePdf size={20} color={exportingPdf ? T.textDisabled : T.textSecondary} style={{ cursor: exportingPdf ? "default" : "pointer" }} onClick={exportPdf} />
        {/* ADDED — real ask: settings to filter which sections show. */}
        <Settings size={20} color={T.textSecondary} style={{ cursor: "pointer" }} onClick={() => setShowVisibilitySettings(true)} />
      </div>
      <div style={{ padding: "10px 16px 0", fontSize: 12, color: T.textSecondary }}>
        A read-only summary — nothing here is editable from this screen, except the identity details directly below. Tap the relevant module to make other changes.
      </div>

      {/* ADDED — real ask: one shared timeframe filter, applies to
          Recent Encounters and Vaccinations. "Since last test" pulls
          the real most-recent test date through automatically, no
          manual date entry needed for that specific case. */}
      <div style={{ padding: "12px 16px 0" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            ["all", "All time"],
            ["sinceLastTest", "Since last test"],
            ["30days", "Last 30 days"],
            ["90days", "Last 90 days"],
            ["custom", "Custom date"],
          ].map(([key, label]) => (
            <div key={key} onClick={() => setTimeframe(key)}
              style={{ padding: "5px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${timeframe === key ? T.healthcareBlue : T.border}`, color: timeframe === key ? T.healthcareBlue : T.textSecondary, background: timeframe === key ? `${T.healthcareBlue}15` : "transparent" }}>
              {label}
            </div>
          ))}
        </div>
        {timeframe === "custom" && (
          <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)}
            style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13 }} />
        )}
        {timeframe === "sinceLastTest" && !lastTestDate && (
          <div style={{ fontSize: 11, color: T.textDisabled, marginTop: 6, fontStyle: "italic" }}>No tests logged yet — showing all time instead.</div>
        )}
      </div>

      {/* ADDED — real ask: "fast add buttons like TOC 2 week, book, or
          treatment given." Real starting values, not blank forms —
          reuses the same quick-add-with-prefill mechanism the
          calendar/next-appointment flow will also build on. */}
      <div style={{ display: "flex", gap: 6, padding: "12px 16px 0", flexWrap: "wrap" }}>
        <div onClick={() => quickAdd("healthcare", "testing", { date: inDaysAsStoredDate(14), title: "Scheduled TOC 2 weeks", testingFor: ["C&S (symptomatic/treatment)"] })}
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${T.healthcareBlue}`, color: T.healthcareBlue }}>
          <Plus size={12} /> TOC 2 week
        </div>
        <div onClick={() => quickAdd("healthcare", "clinicVisits", { isFutureAppointment: true })}
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${T.healthcareBlue}`, color: T.healthcareBlue }}>
          <Plus size={12} /> Book appointment
        </div>
        <div onClick={() => quickAdd("healthcare", "clinicVisits", { date: nowAsStoredDate(), reasonForVisit: ["Treatment"] })}
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${T.healthcareBlue}`, color: T.healthcareBlue }}>
          <Plus size={12} /> Treatment given
        </div>
      </div>

      {/* ADDED — real, explicitly scoped ask: DOB/clinic number/
          address/NHS number, editable ONLY here on Clinic Card — never
          on My Profile's own edit screen, and never included in a
          shared-profile export (see profileShareService.js's own
          explicit exclusion list). The one deliberate exception to
          this screen's "read-only" rule, since there's genuinely
          nowhere else these belong. */}
      {visibility.identity && (
        <>
      <SectionHeader T={T}>Identity</SectionHeader>
      <SectionCard T={T}>
        {editingIdentity ? (
          <div style={{ padding: 14 }}>
            {[
              ["dateOfBirth", "Date of birth", "e.g. 15/03/1990"],
              ["clinicNumber", "Clinic number", "e.g. CN123456"],
              ["address", "Address", "e.g. Flat 2, 15 High Street, London, SW1A 1AA"],
              ["nhsNumber", "NHS number", "e.g. 123 456 7890"],
            ].map(([key, label, placeholder]) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
                <input value={identityDraft[key] ?? ""} onChange={(e) => setIdentityDraft({ ...identityDraft, [key]: e.target.value })}
                  placeholder={placeholder}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setEditingIdentity(false)} style={{ flex: 1, padding: 10, borderRadius: 999, border: `1px solid ${T.border}`, background: "transparent", color: T.textSecondary, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={saveIdentity} style={{ flex: 1, padding: 10, borderRadius: 999, border: "none", background: T.healthcareBlue, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Save</button>
            </div>
          </div>
        ) : (
          <div onClick={openIdentityEdit} style={{ cursor: "pointer" }}>
            {profile.dateOfBirth || profile.clinicNumber || profile.address || profile.nhsNumber ? (
              <>
                {profile.dateOfBirth && <Row T={T} title="Date of birth" subtitle={profile.dateOfBirth} />}
                {profile.clinicNumber && <Row T={T} title="Clinic number" subtitle={profile.clinicNumber} />}
                {profile.address && <Row T={T} title="Address" subtitle={profile.address} />}
                {profile.nhsNumber && <Row T={T} title="NHS number" subtitle={profile.nhsNumber} />}
              </>
            ) : (
              <EmptyRow T={T}>Tap to add date of birth, clinic number, address, or NHS number.</EmptyRow>
            )}
          </div>
        )}
      </SectionCard>

        </>
      )}

      {visibility.medications && (
        <>
      <CollapsibleSectionHeader T={T} onTap={() => goTo("medication")} count={meds.length} collapsed={collapsed.medications} onToggleCollapse={() => toggleCollapsed("medications")}>Current medications</CollapsibleSectionHeader>
      {!collapsed.medications && (
        <SectionCard T={T}>
          {meds.length === 0 ? <EmptyRow T={T}>No active medications logged.</EmptyRow> : meds.map((m) => {
            const stock = computeStock(m);
            // ADDED — real ask: "customising of fields, IE default
            // dosage amount shown (IE sertraline 100mg)... medications
            // with dose amount and last log date/time." Was just name
            // + type/route — real dose and last real dose event now
            // shown by default, matching the exact example given.
            // FIXED — real bug: this showed the PER-UNIT strength
            // (e.g. DoxyPEP's 100mg per pill) even for a medication
            // taken as more than one unit per dose, reading as "100mg"
            // for something whose real dose is 200mg (2 × 100mg
            // pills). Now shows the actual total dose — cleaner than
            // a "100mg × 2" expression, per the user's own preference.
            const totalDoseValue = m.doseStrengthValue ? m.doseStrengthValue * (m.unitsPerDose || 1) : null;
            const doseLabel = totalDoseValue && m.doseStrengthUnit ? `${m.name} ${totalDoseValue}${m.doseStrengthUnit}` : m.name;
            const lastDose = m.logs.filter((l) => l.type === "dose" && !l.voided).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            const subtitleParts = [m.medicationType, m.route].filter(Boolean);
            if (lastDose) subtitleParts.push(`last taken ${formatRelativeDate(lastDose.date)}`);
            return <Row T={T} key={m.id} title={doseLabel} subtitle={subtitleParts.join(" · ")} alert={stock.tracked && stock.needsAction} color={ACCENTS.medication} onTap={() => setPendingNav({ tab: "medication", recordId: m.id, label: m.name, moduleLabel: "Medication" })} />;
          })}
        </SectionCard>
      )}
        </>
      )}

      {visibility.allergies && (
        <>
      <SectionHeader T={T}>Allergies</SectionHeader>
      <SectionCard T={T}>
        {profile.allergies.length === 0 ? (
          <EmptyRow T={T}>None recorded. <span onClick={() => setShowMyProfile(true)} style={{ color: T.healthcareBlue, fontWeight: 600, cursor: "pointer" }}>Add these under My Profile → Clinical & emergency info.</span></EmptyRow>
        ) : (
          <div style={{ padding: "12px 14px", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {profile.allergies.map((a) => (
              <span key={a} style={{ fontSize: 12, fontWeight: 700, color: T.actionRed, background: `${T.actionRed}1A`, padding: "4px 10px", borderRadius: 999 }}>{a}</span>
            ))}
          </div>
        )}
      </SectionCard>

        </>
      )}

      {visibility.vaccinations && (
        <>
      <CollapsibleSectionHeader T={T} onTap={() => goTo("healthcare", "vaccinations")} count={vaccinations.length} collapsed={collapsed.vaccinations} onToggleCollapse={() => toggleCollapsed("vaccinations")}>Vaccinations</CollapsibleSectionHeader>
      {!collapsed.vaccinations && (
        <SectionCard T={T}>
          {vaccinations.length === 0 ? (
            <EmptyRow T={T}>None recorded yet.</EmptyRow>
          ) : vaccinations.slice(0, 6).map((v) => {
            const overdue = overdueVaccinations.some((o) => o.id === v.id);
            return <Row T={T} key={v.id} title={v.title || v.vaccine} subtitle={`${v.vaccine || ""}${v.nextDue ? ` · ${overdue ? "overdue since" : "next due"} ${formatRelativeDate(v.nextDue)}` : ""}`} alert={overdue} onTap={() => setPendingNav({ tab: "healthcare", subTab: "vaccinations", recordId: v.id, label: v.title || v.vaccine, moduleLabel: "Vaccinations" })} />;
          })}
        </SectionCard>
      )}
        </>
      )}

      {visibility.testing && (
        <>
      <SectionHeader T={T} onTap={() => goTo("healthcare", "testing")}>Recent STI testing</SectionHeader>
      <SectionCard T={T}>
        {recentTests.length === 0 ? <EmptyRow T={T}>No tests logged yet.</EmptyRow> : recentTests.map((t) => (
          <Row T={T} key={t.id} title={t.title} subtitle={t.subtitle} alert={t.alert} onTap={() => setPendingNav({ tab: "healthcare", subTab: "testing", recordId: t.id, label: t.title, moduleLabel: "Testing" })} />
        ))}
      </SectionCard>

        </>
      )}

      {visibility.treatment && (
        <>
      <SectionHeader T={T} onTap={() => goTo("healthcare", "testing")}>Current treatment</SectionHeader>
      <SectionCard T={T}>
        {currentTreatment.length === 0 ? <EmptyRow T={T}>Nothing currently awaiting follow-up.</EmptyRow> : currentTreatment.map((t) => (
          <Row T={T} key={t.id} title={t.title} subtitle={t.subtitle} alert onTap={() => setPendingNav({ tab: "healthcare", subTab: "testing", recordId: t.id, label: t.title, moduleLabel: "Testing" })} />
        ))}
      </SectionCard>

        </>
      )}

      {visibility.menstrualContraception && menstrualTrackingEnabled && (
        <>
      <SectionHeader T={T} onTap={() => goTo("healthcare", "menstrualHealth")}>Menstrual & contraception</SectionHeader>
      <SectionCard T={T}>
        {activePregnancy && (
          <Row T={T} title="Currently pregnant" subtitle={activePregnancy.estimatedDueDate ? `Due ${formatRelativeDate(activePregnancy.estimatedDueDate)}` : "Ongoing"} alert onTap={() => setPendingNav({ tab: "healthcare", subTab: "menstrualHealth", recordId: activePregnancy.id, label: "Pregnancy", moduleLabel: "Menstrual & contraception" })} />
        )}
        {activeContraception.length === 0 && !lastPeriod && !activePregnancy && <EmptyRow T={T}>Nothing logged yet.</EmptyRow>}
        {activeContraception.map((c) => {
          const overdue = c.nextDueDate && new Date(c.nextDueDate) < new Date();
          return (
            <Row T={T} key={c.id} title={c.method} subtitle={c.nextDueDate ? `${overdue ? "Overdue since" : "Next due"} ${formatRelativeDate(c.nextDueDate)}` : "Ongoing"} alert={overdue} onTap={() => setPendingNav({ tab: "healthcare", subTab: "menstrualHealth", recordId: c.id, label: c.method, moduleLabel: "Menstrual & contraception" })} />
          );
        })}
        {lastPeriod && !activePregnancy && (
          <Row T={T} title="Last period" subtitle={`${formatRelativeDate(lastPeriod.startDate)}${lastPeriod.endDate ? "" : " (ongoing)"}`} onTap={() => setPendingNav({ tab: "healthcare", subTab: "menstrualHealth", recordId: lastPeriod.id, label: "Last period", moduleLabel: "Menstrual & contraception" })} />
        )}
      </SectionCard>

        </>
      )}

      {visibility.symptoms && (
        <>
      <SectionHeader T={T} onTap={() => goTo("healthcare", "symptomLog")}>Active symptoms</SectionHeader>
      <SectionCard T={T}>
        {activeSymptoms.length === 0 ? (
          <EmptyRow T={T}>Nothing active right now.</EmptyRow>
        ) : activeSymptoms.map((s) => (
          <Row T={T} key={s.id} title={s.title} subtitle={[nameFrom(SymptomsRegistry, s.symptomId), s.severity, formatRelativeDate(s.dateStarted), s.dateResolved ? `resolved ${formatRelativeDate(s.dateResolved)}` : null].filter(Boolean).join(" · ")} alert={s.severity === "Severe"} onTap={() => setPendingNav({ tab: "healthcare", subTab: "symptomLog", recordId: s.id, label: s.title, moduleLabel: "Symptom Log" })} />
        ))}
      </SectionCard>

        </>
      )}

      {visibility.encounters && (
        <>
      <CollapsibleSectionHeader T={T} onTap={() => goTo("activity")} count={recentPartners.length} collapsed={collapsed.encounters} onToggleCollapse={() => toggleCollapsed("encounters")}>Recent encounters</CollapsibleSectionHeader>
      {!collapsed.encounters && (
        <SectionCard T={T}>
          {recentPartners.length === 0 ? <EmptyRow T={T}>No encounters logged yet.</EmptyRow> : recentPartners.map((p) => (
            <Row T={T} key={p.id} title={p.title} subtitle={p.subtitle} color={ACCENTS.encounters} onTap={() => setPendingNav({ tab: "activity", recordId: p.id, label: p.title, moduleLabel: "Encounter" })} />
          ))}
        </SectionCard>
      )}
        </>
      )}

      {visibility.emergency && (
        <>
      <SectionHeader T={T}>Emergency information</SectionHeader>
      <SectionCard T={T}>
        {!profile.emergencyContactName && !profile.emergencyContactPhone && !profile.emergencyNotes ? (
          <EmptyRow T={T}>None recorded. <span onClick={() => setShowMyProfile(true)} style={{ color: T.healthcareBlue, fontWeight: 600, cursor: "pointer" }}>Add these under My Profile → Clinical & emergency info.</span></EmptyRow>
        ) : (
          <>
            {(profile.emergencyContactName || profile.emergencyContactPhone) && (
              <Row T={T} title={profile.emergencyContactName || "Emergency contact"} subtitle={profile.emergencyContactPhone} />
            )}
            {profile.emergencyNotes && <Row T={T} title={profile.emergencyNotes} />}
          </>
        )}
      </SectionCard>

        </>
      )}

      <div style={{ height: 24 }} />

      {/* ADDED — real ask: confirmation step for record-level taps
          (title taps navigate immediately, above). */}
      {pendingNav && (
        <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 300 }} onClick={() => setPendingNav(null)}>
          <div style={{ background: T.surface, width: "100%", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>Open in {pendingNav.moduleLabel}?</div>
            <div style={{ fontSize: 13, color: T.textSecondary, marginBottom: 16 }}>{pendingNav.label}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setPendingNav(null)} style={{ flex: 1, padding: 12, borderRadius: 999, border: `1px solid ${T.border}`, background: "transparent", color: T.textSecondary, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => { goTo(pendingNav.tab, pendingNav.subTab, pendingNav.recordId); setPendingNav(null); }} style={{ flex: 1, padding: 12, borderRadius: 999, border: "none", background: T.healthcareBlue, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Open</button>
            </div>
          </div>
        </div>
      )}

      {/* ADDED — real ask: a real settings screen to toggle which
          sections show, full-screen overlay matching the same pattern
          used elsewhere in this app for a focused settings list. */}
      {showVisibilitySettings && (
        <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: T.bg, zIndex: 300, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}` }}>
            <X size={20} color={T.textSecondary} style={{ cursor: "pointer" }} onClick={() => setShowVisibilitySettings(false)} aria-label="Close visibility settings" />
            <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Which sections to show</span>
          </div>
          <div style={{ padding: "8px 16px", fontSize: 12, color: T.textSecondary }}>
            Every section shows the most detail permitted by default — these only ever narrow what's shown, never add anything.
          </div>
          <SectionCard T={T}>
            {CLINIC_CARD_SECTIONS.map((s) => (
              <div key={s.key} onClick={() => toggleSection(s.key)} role="switch" tabIndex={0} aria-checked={visibility[s.key]} aria-label={s.label}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSection(s.key); } }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
                <span style={{ fontSize: 14, color: T.textPrimary }}>{s.label}</span>
                <div style={{ width: 40, height: 24, borderRadius: 999, background: visibility[s.key] ? T.healthcareBlue : T.border, position: "relative", flexShrink: 0 }}>
                  <div style={{ position: "absolute", top: 2, left: visibility[s.key] ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: "#FFFFFF" }} />
                </div>
              </div>
            ))}
          </SectionCard>
          <div style={{ height: 24 }} />
        </div>
      )}
      {showMyProfile && (
        <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", zIndex: 310 }}>
          <MyProfileModule onClose={() => setShowMyProfile(false)} openEditingOnMount registerModuleBackHandler={registerModuleBackHandler} />
        </div>
      )}
    </div>
  );
}

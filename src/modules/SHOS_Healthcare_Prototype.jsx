// SHOS_Healthcare_Prototype.jsx
//
// ADDED — real architecture extraction, same reasoning as
// SHOS_Settings_Prototype.jsx: this was the Healthcare tab's actual
// screen content, living directly inside App.jsx (which is supposed
// to be routing/global-state shell, not feature screens). Pure code
// motion — every line of actual behavior below is unchanged from what
// was working in App.jsx; only the file it lives in has changed.
import React, { useState, useEffect } from "react";
import { NEUTRAL, NEUTRAL_DARK, ACCENTS, ACTION, FONT_FAMILY, RADIUS } from "../calculations/designTokens";
import { useDarkModePreference } from "../calculations/darkModePreference";
import { PaperclipIcon as Paperclip, IdentificationBadgeIcon as CreditCard, StackIcon as Stack } from "@phosphor-icons/react";
import { TestingRepository } from "../repositories/testingRepository";
import { SymptomLogRepository } from "../repositories/symptomLogRepository";
import { VaccinationRepository } from "../repositories/vaccinationRepository";
import TestingModule from "./SHOS_Testing_Prototype";
import ClinicVisitsModule from "./SHOS_ClinicVisits_Prototype";
import SymptomLogModule from "./SHOS_SymptomLog_Prototype";
import VaccinationsModule from "./SHOS_Vaccinations_Prototype";
import ClinicCardScreen from "./SHOS_ClinicCard_Prototype";
import AttachmentsScreen from "./SHOS_Attachments_Prototype";
import TimelineModule from "./SHOS_Timeline_Prototype";

function HealthcareScreen({ openAddOnMount, onConsumedQuickAdd, quickAddTarget, openRecordId, onConsumedRecordOpen, onNavigateToRecord, prefillData, onConsumedPrefill, onQuickAddWithPrefill, registerModuleBackHandler }) {
  const [subTab, setSubTab] = useState(
    quickAddTarget === "clinicVisits" ? "clinicVisits" :
    quickAddTarget === "symptomLog" ? "symptomLog" :
    quickAddTarget === "vaccinations" ? "vaccinations" : "testing"
  );
  // ADDED 26 Aug 2026 — real gap found and fixed: tapping a linked
  // test from a Clinic Visit's own detail view used to only switch to
  // the Testing sub-tab, discarding the specific test id VisitDetail
  // was already passing (onOpenTest?.(t.id)) — genuinely landed on
  // the Testing LIST, not the actual linked test's detail screen. The
  // deep-link mechanism (openRecordId/onConsumedRecordOpen) already
  // existed and was already wired to TestingModule for the app-wide
  // Global Search flow — this is Healthcare's own LOCAL version of the
  // same thing, merged with the global one below, since openRecordId
  // is a single shared prop across all 4 sub-modules and this
  // shouldn't hijack that existing flow.
  const [pendingTestId, setPendingTestId] = useState(null);
  const [showClinicCard, setShowClinicCard] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  // CHANGED — real bugs found in the user's own device testing: (1) this
  // whole screen had no fontFamily set anywhere at all, unlike every
  // other screen in the app, which wraps itself in Public Sans
  // explicitly — meaning it rendered in the browser's own default
  // font this whole time. (2) 4 sub-tab pills AND 3 icon-shortcuts
  // were fighting for space in ONE flex row with the icon group
  // pinned `flexShrink: 0`, forcing the pills to wrap awkwardly on a
  // real phone-width screen — "crammed... top left" was a real,
  // literal layout collision, not just visual taste. Both fixed here;
  // this is also the first real module migrated onto the shared
  // design tokens (designTokens.js) rather than its own hand-typed
  // hex values — the actual start of "standardise UI/appearance",
  // not a promise of it.
  const [darkMode] = useDarkModePreference();
  const N = darkMode ? NEUTRAL_DARK : NEUTRAL;
  const T = { healthcareBlue: ACCENTS.healthcare, border: N.border, textSecondary: N.textSecondary, surface: N.surface, bg: N.bg };

  // ADDED — real ask: Healthcare was "bland vs Home/Medication" —
  // checked and found the actual reason wasn't styling, it was that
  // this screen had literally no landing content of its own, just a
  // sub-tab switcher. Deliberately complementary to what Home already
  // shows (Last test / Next clinic visit) rather than repeating it —
  // active symptoms, overdue vaccinations, and this year's real test
  // count are all real Healthcare-specific facts Home doesn't cover.
  const [summary, setSummary] = useState({ activeSymptoms: 0, overdueVaccinations: 0, testsThisYear: 0 });
  // CHANGED 26 Aug 2026 — real bug fix: this only ever ran once on
  // mount, so e.g. resolving a symptom (adding an end date) didn't
  // update "Active symptoms" until you left and re-entered Healthcare.
  // dataVersion is bumped by SymptomLogModule via onDataChanged
  // whenever it actually writes to the repository (create, edit,
  // undo, or redo), so this recomputes immediately instead.
  // NOTE: overdueVaccinations/testsThisYear have the same latent
  // staleness risk from Vaccinations/Testing edits — not wired yet,
  // flagged here rather than silently left implicit.
  const [dataVersion, setDataVersion] = useState(0);
  useEffect(() => {
    const symptoms = SymptomLogRepository.getAll().filter((s) => !s.dateResolved).length;
    const today = new Date().toISOString().slice(0, 10);
    const overdue = VaccinationRepository.getAll().filter((v) => v.nextDue && v.nextDue < today).length;
    const thisYear = new Date().getFullYear();
    const tests = TestingRepository.getAll().filter((t) => !t.isArchived && t.date && new Date(t.date).getFullYear() === thisYear).length;
    setSummary({ activeSymptoms: symptoms, overdueVaccinations: overdue, testsThisYear: tests });
  }, [dataVersion]);

  const SummaryStat = ({ label, value, alert }) => (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: alert && value > 0 ? ACTION.red : T.healthcareBlue }}>{value}</div>
      <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ fontFamily: FONT_FAMILY }}>
      {/* ADDED 26 Aug 2026 — real ask: page title on a banner filled
          with the module's own colour, same pattern applied across
          every module this pass. Healthcare didn't have a title
          heading at all before this — starting straight with the
          stats card was the actual root of the "bland" complaint
          flagged earlier, not just styling. */}
      <div style={{ position: "sticky", top: 0, zIndex: 6, background: T.healthcareBlue, borderBottom: "2px solid rgba(0,0,0,0.15)", padding: "16px 16px 14px" }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: "#FFFFFF" }}>Healthcare</span>
      </div>
      <div style={{ padding: "14px 16px 0", background: T.bg }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {[{ key: "testing", label: "Testing" }, { key: "clinicVisits", label: "Clinic Visits" }, { key: "symptomLog", label: "Symptom Log" }, { key: "vaccinations", label: "Vaccinations" }].map((t) => (
            <div key={t.key} onClick={() => setSubTab(t.key)}
              style={{ padding: "6px 14px", borderRadius: RADIUS.full, fontSize: 12, fontWeight: 700, cursor: "pointer", background: subTab === t.key ? T.healthcareBlue : T.surface, color: subTab === t.key ? "#FFFFFF" : T.textSecondary, border: `1px solid ${subTab === t.key ? T.healthcareBlue : T.border}` }}>
              {t.label}
            </div>
          ))}
        </div>
        {/* CHANGED — real fix: moved to its own row below the sub-tab
            pills, instead of squeezed alongside them in one row —
            same entry points (Timeline/Attachments/Clinic Card),
            genuinely room to breathe now. */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
          <div onClick={() => setShowTimeline(true)} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <Stack size={15} color={T.healthcareBlue} />
            <span style={{ fontSize: 12, fontWeight: 700, color: T.healthcareBlue }}>Episodes</span>
          </div>
          <div onClick={() => setShowAttachments(true)} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <Paperclip size={15} color={T.healthcareBlue} />
            <span style={{ fontSize: 12, fontWeight: 700, color: T.healthcareBlue }}>Attachments</span>
          </div>
          <div onClick={() => setShowClinicCard(true)} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <CreditCard size={16} color={T.healthcareBlue} />
            <span style={{ fontSize: 12, fontWeight: 700, color: T.healthcareBlue }}>Clinic Card</span>
          </div>
        </div>
        {/* CHANGED 26 Aug 2026 — real ask: moved below the Timeline/
            Attachments/Clinic Card shortcuts, was above them before. */}
        <div style={{ display: "flex", background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: "14px 8px", margin: "14px 0" }}>
          <SummaryStat label="Active symptoms" value={summary.activeSymptoms} alert />
          <SummaryStat label="Overdue vaccinations" value={summary.overdueVaccinations} alert />
          <SummaryStat label="Tests this year" value={summary.testsThisYear} />
        </div>
      </div>
      {subTab === "testing" ? (
        <TestingModule openAddOnMount={openAddOnMount && quickAddTarget === "testing"} onConsumedQuickAdd={onConsumedQuickAdd} openRecordId={openRecordId || pendingTestId} onConsumedRecordOpen={() => { onConsumedRecordOpen?.(); setPendingTestId(null); }} prefillData={prefillData} onConsumedPrefill={onConsumedPrefill} onNavigateToRecord={onNavigateToRecord} registerModuleBackHandler={registerModuleBackHandler} />
      ) : subTab === "clinicVisits" ? (
        <ClinicVisitsModule openAddOnMount={openAddOnMount && quickAddTarget === "clinicVisits"} onConsumedQuickAdd={onConsumedQuickAdd} onOpenTest={(testId) => { setSubTab("testing"); setPendingTestId(testId); }} openRecordId={openRecordId} onConsumedRecordOpen={onConsumedRecordOpen} prefillData={prefillData} onConsumedPrefill={onConsumedPrefill} registerModuleBackHandler={registerModuleBackHandler} />
      ) : subTab === "symptomLog" ? (
        <SymptomLogModule openAddOnMount={openAddOnMount && quickAddTarget === "symptomLog"} onConsumedQuickAdd={onConsumedQuickAdd} openRecordId={openRecordId} onConsumedRecordOpen={onConsumedRecordOpen} onDataChanged={() => setDataVersion((v) => v + 1)} registerModuleBackHandler={registerModuleBackHandler} />
      ) : (
        <VaccinationsModule openAddOnMount={openAddOnMount && quickAddTarget === "vaccinations"} onConsumedQuickAdd={onConsumedQuickAdd} openRecordId={openRecordId} onConsumedRecordOpen={onConsumedRecordOpen} registerModuleBackHandler={registerModuleBackHandler} />
      )}
      {showClinicCard && <ClinicCardScreen onClose={() => setShowClinicCard(false)} onNavigateToRecord={onNavigateToRecord} onQuickAddWithPrefill={onQuickAddWithPrefill} />}
      {showAttachments && (
        <AttachmentsScreen onClose={() => setShowAttachments(false)}
          onNavigateToSource={(sourceType, sourceId) => {
            setSubTab(sourceType === "clinicVisit" ? "clinicVisits" : "testing");
            setShowAttachments(false);
          }} />
      )}
      {showTimeline && (
        <div style={{ position: "fixed", inset: 0, zIndex: 210 }}>
          <TimelineModule onClose={() => setShowTimeline(false)} />
        </div>
      )}
    </div>
  );
}

export default HealthcareScreen;

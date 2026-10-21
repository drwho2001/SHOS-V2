// StatsScreen — extracted verbatim from src/modules/SHOS_Settings_Prototype.jsx
// (24 Sep 2026 settings split). Behavior unchanged; only the file moved.
import React, { useState, useMemo, useRef, useEffect } from "react";
import { NEUTRAL_DARK as DARK } from "../../calculations/designTokens";
import { CaretLeftIcon as ChevronLeft } from "@phosphor-icons/react";
import { ACCENTS, ACTION, NEUTRAL, RADIUS, TYPE, resolveDarkAccent } from "../../calculations/designTokens";
import { computeAdherence } from "../../calculations/medicationCalculations";
import { isQualifyingEncounter, DOXYPEP_WINDOW_HOURS, findDoxyPepMedication } from "../../calculations/doxyPepCalculations";
import { getActivitiesPerMonth, getTopKinks, getTestingFrequencyStats, BASHH_TESTING_SOURCE_URL, getOverallAdherence, getDoxyPepComplianceRate, getContactsAddedPerMonth, getTestingIntervalTrend, getAdherenceTrend, getTopSymptoms, getClinicVisitStats, getClinicVisitsPerMonth, getPositiveTestsByOrganism, getTestsBySite } from "../../calculations/statsCalculations";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useLoadedMemo } from "../../calculations/loadedRepositoryState";
import { useIsDesktopWidth } from "../../calculations/responsive";
import { ContactRepository } from "../../repositories/contactRepository";
import { EncounterRepository } from "../../repositories/encounterRepository";
import { MedicationRepository } from "../../repositories/medicationRepository";
import { LogRepository } from "../../repositories/logRepository";
import { TestingRepository } from "../../repositories/testingRepository";
import { ClinicVisitsRepository } from "../../repositories/clinicVisitsRepository";
import { SymptomLogRepository } from "../../repositories/symptomLogRepository";
import { KinkRegistry } from "../../registries/kinkRegistry";
import { SymptomsRegistry } from "../../registries/symptomsRegistry";
import { OrganismRegistry } from "../../registries/organismRegistry";
import { ResultsRegistry } from "../../registries/resultsRegistry";

function InfoIcon({ onClick }) {
  const [darkMode] = useDarkModePreference();

  return (
    <div onClick={onClick} role="button" tabIndex={0} aria-label="More information" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }} style={{ width: 16, height: 16, borderRadius: 999, border: "1px solid #656568", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, cursor: "pointer", flexShrink: 0 }}>i</div>
  );
}

function StatRow({ label, value, explanation, sourceUrl }) {
  const [darkMode] = useDarkModePreference();

  const [showInfo, setShowInfo] = useState(false);
  return (
    <div style={{ padding: "12px 16px", borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>{label}</span>
          <InfoIcon onClick={() => setShowInfo((s) => !s)} />
        </div>
        <span style={{ fontSize: 15, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontWeight: 700 }}>{value}</span>
      </div>
      {showInfo && (
        <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: darkMode ? DARK.bg : NEUTRAL.bg, fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, lineHeight: 1.5 }}>
          {explanation}
          {sourceUrl && (
            <div style={{ marginTop: 4 }}>
              <a href={sourceUrl} target="_blank" rel="noreferrer" style={{ color: ACCENTS.medication, fontSize: 11 }}>View source guidance →</a>
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
export function StatsScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const dialogRef = useRef(null);
  useEffect(() => { dialogRef.current?.focus(); }, []);
  // ADDED — real audit finding (desktop full-width sweep): grid the
  // Encounter/Healthcare/Medication/Contacts section blocks on
  // desktop, same multi-column treatment as Developer Tools.
  const isDesktopWidth = useIsDesktopWidth();
  // ADDED 16 Sep 2026 — real ask (#78): tap-to-reveal explanation for
  // the organism-breakdown's own same-day dedup rule, same InfoIcon
  // pattern already used everywhere else this app explains a
  // calculation basis (see the "Icon-only UI needs an explanatory
  // affordance" standing convention).
  const [showOrganismInfo, setShowOrganismInfo] = useState(false);

  const encounters = useLoadedMemo(() => EncounterRepository.getAll(), [], []);
  const contacts = useLoadedMemo(() => ContactRepository.getAll(), [], []);
  const tests = useLoadedMemo(() => TestingRepository.getAll(), [], []);
  // computeAdherence() reads med.logs directly — not part of the raw
  // repository record, so it has to be stitched on here too (same as
  // SHOS_Medication_Dashboard_Prototype.jsx's loadMedications()).
  const medications = useLoadedMemo(async () => Promise.all((await MedicationRepository.getAll()).map(async (med) => ({ ...med, logs: await LogRepository.getForMedication(med.id) }))), [], []);
  // ADDED — real ask: "expand stats".
  const symptomEntries = useLoadedMemo(() => SymptomLogRepository.getAll(), [], []);
  const clinicVisits = useLoadedMemo(() => ClinicVisitsRepository.getAll(), [], []);
  // CHANGED — Phase 2 encryption groundwork: KinkRegistry/SymptomsRegistry
  // are now async — resolved into lookup Maps here, passed as the
  // resolver getTopKinks()/getTopSymptoms() expect (both stay plain,
  // synchronous, I/O-free calculation functions — see statsCalculations.js).
  const kinkNameById = useLoadedMemo(async () => new Map((await KinkRegistry.getAll()).map((k) => [k.id, k.name])), [], new Map());
  const symptomNameById = useLoadedMemo(async () => new Map((await SymptomsRegistry.getAll()).map((s) => [s.id, s.name])), [], new Map());
  // ADDED 16 Sep 2026 — real ask (#78): positive-test-by-organism
  // breakdown, same resolver-callback pattern as kinkNameById/
  // symptomNameById above.
  const organismNameById = useLoadedMemo(async () => new Map((await OrganismRegistry.getAll()).map((o) => [o.id, o.name])), [], new Map());
  const resultNameById = useLoadedMemo(async () => new Map((await ResultsRegistry.getAll()).map((r) => [r.id, r.name])), [], new Map());

  const activityMonths = useMemo(() => getActivitiesPerMonth(encounters, 6), [encounters]);
  const topKinks = useMemo(() => getTopKinks(encounters, contacts, (id) => kinkNameById.get(id), 5), [encounters, contacts, kinkNameById]);
  const testingStats = useMemo(() => getTestingFrequencyStats(tests), [tests]);
  // ADDED — real ask: "Stats is descriptive, not predictive" — a real
  // nudge against the person's OWN pattern (not just the fixed BASHH
  // benchmark above), see getTestingIntervalTrend's own comment for
  // the two distinct comparisons this covers.
  const testingTrend = useMemo(() => getTestingIntervalTrend(tests), [tests]);
  // ADDED 16 Sep 2026 — real ask (#78): "positive-test counts by
  // organism/site" — see statsCalculations.js's own comment on the
  // real same-day-multi-site double-counting risk this dedupes.
  const positiveByOrganism = useMemo(() => getPositiveTestsByOrganism(tests, (id) => organismNameById.get(id), (id) => resultNameById.get(id), 8), [tests, organismNameById, resultNameById]);
  const testsBySite = useMemo(() => getTestsBySite(tests, 8), [tests]);
  const adherence = useMemo(() => getOverallAdherence(medications, computeAdherence), [medications]);
  // CHANGED — Phase 2 encryption groundwork: LogRepository went async
  // — this used to be a plain useMemo directly calling
  // LogRepository.getForMedication(), now needs useLoadedMemo since it
  // awaits.
  const doxyCompliance = useLoadedMemo(async () => {
    const doxyMed = findDoxyPepMedication(medications);
    if (!doxyMed) return null;
    return getDoxyPepComplianceRate(encounters, await LogRepository.getForMedication(doxyMed.id), isQualifyingEncounter, DOXYPEP_WINDOW_HOURS);
  }, [encounters, medications], null);
  const contactMonths = useMemo(() => getContactsAddedPerMonth(contacts, 6), [contacts]);
  // ADDED — real ask: "expand stats". See getAdherenceTrend's own
  // comment for why this is deliberately a simpler, self-contained
  // measure rather than reusing computeAdherence() (hardcoded to
  // "today", not safely reusable for a past month).
  const adherenceTrend = useMemo(() => getAdherenceTrend(medications, 6), [medications]);
  const topSymptoms = useMemo(() => getTopSymptoms(symptomEntries, (id) => symptomNameById.get(id), 5), [symptomEntries, symptomNameById]);
  const clinicVisitStats = useMemo(() => getClinicVisitStats(clinicVisits), [clinicVisits]);
  const clinicVisitMonths = useMemo(() => getClinicVisitsPerMonth(clinicVisits, 6), [clinicVisits]);

  const maxActivity = Math.max(1, ...activityMonths.map((b) => b.count));
  const maxContacts = Math.max(1, ...contactMonths.map((b) => b.count));
  const maxClinicVisits = Math.max(1, ...clinicVisitMonths.map((b) => b.count));

  return (
    <div ref={dialogRef} role="dialog" aria-label="Stats" tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: darkMode ? DARK.bg : NEUTRAL.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : NEUTRAL.bg, borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label="Back" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Stats</h1>
      </div>
      <div style={{ padding: 16 }}>
      <div style={isDesktopWidth ? { columnCount: 2, columnGap: 16 } : undefined}>

        {/* Activity */}
        <div style={isDesktopWidth ? { breakInside: "avoid" } : undefined}>
        <div style={{ ...TYPE.sectionLabel, color: ACCENTS.encounters, padding: "0 0 6px" }}>Encounter</div>
        <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>Encounters per month</span>
            </div>
            {/* ADDED — real ask: bars had no visible value, unreadable
                on mobile touch (no hover). Raw count printed above each
                bar, same pattern applied consistently across all 4 bar
                charts in this screen (see the other 3 below). */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 78 }}>
              {activityMonths.map((b) => (
                <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>{b.count}</span>
                  <div style={{ width: "100%", height: `${Math.max(4, (b.count / maxActivity) * 44)}px`, background: ACCENTS.encounters, borderRadius: 3 }} />
                  <span style={{ fontSize: 9, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled }}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: "12px 16px" }}>
            <div style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 8 }}>Top kinks/roles logged</div>
            {topKinks.length === 0 ? (
              <div style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, fontStyle: "italic" }}>Nothing logged yet.</div>
            ) : topKinks.map((k) => (
              <div key={k.name} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>{k.name}</span>
                <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, fontWeight: 600 }}>{k.count}</span>
              </div>
            ))}
          </div>
        </div>
        </div>

        <div style={isDesktopWidth ? { breakInside: "avoid" } : undefined}>
        {/* Healthcare */}
        <div style={{ ...TYPE.sectionLabel, color: ACCENTS.healthcare, padding: "0 0 6px" }}>Healthcare</div>
        <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, overflow: "hidden", marginBottom: 20 }}>
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
          {/* ADDED 16 Sep 2026 — real ask (#78): positive-test-by-
              organism and by-sample-site breakdowns. */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>Positive results by organism</span>
              <InfoIcon onClick={() => setShowOrganismInfo((s) => !s)} />
            </div>
            {showOrganismInfo && (
              <div style={{ marginBottom: 8, padding: "8px 10px", borderRadius: 8, background: darkMode ? DARK.bg : NEUTRAL.bg, fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, lineHeight: 1.5 }}>
                Counts a real, positive test result per organism, once per day — two same-day tests for different sample sites (e.g. urine + rectal swab at one visit) count as one real event, not two.
              </div>
            )}
            {positiveByOrganism.length === 0 ? (
              <div style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, fontStyle: "italic" }}>None logged yet.</div>
            ) : positiveByOrganism.map((o) => (
              <div key={o.name} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>{o.name}</span>
                <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, fontWeight: 600 }}>{o.count}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "12px 16px", borderTop: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
            <div style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 8 }}>Tests by sample site</div>
            {testsBySite.length === 0 ? (
              <div style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, fontStyle: "italic" }}>None logged yet.</div>
            ) : testsBySite.map((s) => (
              <div key={s.name} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>{s.name}</span>
                <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, fontWeight: 600 }}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ADDED — real ask: "expand stats". Symptoms had no stats
            section at all before this — same "Top X" list pattern
            already established for kinks above. */}
        <div style={{ ...TYPE.sectionLabel, color: ACCENTS.healthcare, padding: "0 0 6px" }}>Symptoms</div>
        <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "12px 16px" }}>
            <div style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 8 }}>Most logged symptoms</div>
            {topSymptoms.length === 0 ? (
              <div style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, fontStyle: "italic" }}>Nothing logged yet.</div>
            ) : topSymptoms.map((s) => (
              <div key={s.name} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ fontSize: 13, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>{s.name}</span>
                <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, fontWeight: 600 }}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ADDED — real ask: "expand stats". Clinic Visits had no stats
            section at all before this — same monthly-bar-chart pattern
            already established for Activity/Contacts below. */}
        <div style={{ ...TYPE.sectionLabel, color: ACCENTS.healthcare, padding: "0 0 6px" }}>Clinic visits</div>
        <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>Visits per month</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 78 }}>
              {clinicVisitMonths.map((b) => (
                <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>{b.count}</span>
                  <div style={{ width: "100%", height: `${Math.max(4, (b.count / maxClinicVisits) * 44)}px`, background: ACCENTS.healthcare, borderRadius: 3 }} />
                  <span style={{ fontSize: 9, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled }}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>
          <StatRow label="Days since last visit" value={clinicVisitStats.daysSinceLast != null ? `${clinicVisitStats.daysSinceLast} days` : "No past visits logged"}
            explanation="Days since your most recent real (already happened, not a future booking) clinic visit." />
        </div>
        </div>

        <div style={isDesktopWidth ? { breakInside: "avoid" } : undefined}>
        {/* Medication */}
        <div style={{ ...TYPE.sectionLabel, color: ACCENTS.medication, padding: "0 0 6px" }}>Medication</div>
        <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, overflow: "hidden", marginBottom: 20 }}>
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
            <div style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 4 }}>Adherence trend (days with a dose logged, per month)</div>
            <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, marginBottom: 10 }}>A simpler month-by-month measure than the precise 7-day figure above — useful for spotting a trend, not a like-for-like comparison.</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 78 }}>
              {adherenceTrend.map((b) => (
                <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: b.pct != null ? (darkMode ? DARK.textSecondary : NEUTRAL.textSecondary) : (darkMode ? DARK.textDisabled : NEUTRAL.textDisabled) }}>{b.pct != null ? `${b.pct}%` : "–"}</span>
                  <div style={{ width: "100%", height: b.pct != null ? `${Math.max(4, (b.pct / 100) * 44)}px` : "4px", background: b.pct != null ? ACCENTS.medication : (darkMode ? DARK.border : NEUTRAL.border), borderRadius: 3 }} />
                  <span style={{ fontSize: 9, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled }}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>

        <div style={isDesktopWidth ? { breakInside: "avoid" } : undefined}>
        {/* Contacts */}
        <div style={{ ...TYPE.sectionLabel, color: ACCENTS.contacts, padding: "0 0 6px" }}>Contacts</div>
        <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>Contacts added per month</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 78 }}>
              {contactMonths.map((b) => (
                <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>{b.count}</span>
                  <div style={{ width: "100%", height: `${Math.max(4, (b.count / maxContacts) * 44)}px`, background: ACCENTS.contacts, borderRadius: 3 }} />
                  <span style={{ fontSize: 9, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled }}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>
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

export default StatsScreen;

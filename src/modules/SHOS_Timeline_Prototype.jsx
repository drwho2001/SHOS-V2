import React, { useState, useMemo } from "react";
import { PlusIcon as Plus, CaretLeftIcon as ChevronLeft, CheckIcon as Check, WarningIcon as AlertTriangle } from "@phosphor-icons/react";
import { EpisodeRepository, RESOLUTION_OPTIONS } from "../repositories/episodeRepository";
// ADDED 19 Aug 2026 — TRIGGER_REASON_OPTIONS now lives here, real
// in-app editable option list.
import { CustomOptionListsRepository } from "../repositories/customOptionListsRepository";
import { EncounterRepository } from "../repositories/encounterRepository";
import { TestingRepository } from "../repositories/testingRepository";
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository";
import { SymptomLogRepository } from "../repositories/symptomLogRepository";
import { ResultsRegistry } from "../registries/resultsRegistry";
import { getEncounterCoverage } from "../calculations/exposureWindows";
// CHANGED 20 Aug 2026 — real design-unification pass: values read
// from the shared designTokens.js source of truth instead of being
// retyped here, so this screen can't silently drift from every other
// module's "same" color/radius. See designTokens.js.
import { NEUTRAL, NEUTRAL_DARK, ACCENTS, ACTION, RADIUS } from "../calculations/designTokens";
import { useDarkModePreference } from "../calculations/darkModePreference";

// ADDED 19 Aug 2026 — Timeline (the nav-facing name; "Episode" is the
// underlying data unit — see episodeRepository.js for the full
// reasoning and the real lifecycle this implements). Same self-
// contained-module pattern, Healthcare blue, single Inter typeface
// throughout (JetBrains Mono retired 26 Aug 2026).
const LIGHT = {
  ...NEUTRAL,
  healthcareBlue: ACCENTS.healthcare, actionRed: ACTION.red, actionGreen: ACTION.green,
};
// Dark mode, on Medication's DARK basis — see Contacts' own comment
// for the full reasoning.
const DARK = {
  ...NEUTRAL_DARK,
  healthcareBlue: ACCENTS.healthcare, actionRed: "#FF7A7E", actionGreen: "#5FD9A4",
};
const radius = RADIUS;

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function encounterLabel(e) {
  return e ? `${e.title || e.encounterType || "Encounter"} · ${formatDate(e.date)}` : "?";
}
function testLabel(t) {
  return t ? `${t.title || (t.testingFor || []).join("/") || "Test"} · ${formatDate(t.date)}` : "?";
}
function visitLabel(v) {
  return v ? `${v.title || (v.reasonForVisit || []).join("/") || "Clinic visit"} · ${formatDate(v.date)}` : "?";
}
function symptomLogLabel(s) {
  return s ? `${s.title || "Symptom entry"} · ${formatDate(s.dateStarted)}` : "?";
}
function testIsPositive(t) {
  const names = (t.resultIds || []).map((id) => ResultsRegistry.getById(id)?.name).filter(Boolean);
  return names.some((n) => n.toLowerCase() === "positive");
}

function SectionCard({ title, T, children }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: radius.md, background: T.surface, padding: "4px 14px 14px", marginTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.healthcareBlue, textTransform: "uppercase", letterSpacing: 0.5, paddingTop: 12, marginBottom: 2 }}>{title}</div>
      {children}
    </div>
  );
}

function TextField({ label, value, onChange, T, placeholder }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
    </div>
  );
}

function SelectField({ label, value, onChange, options, T }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }}>
        <option value="">—</option>
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}

// Single-select — used for picking the anchor Encounter. Deliberately
// its own (simpler) component rather than reusing the multi-select
// LinkedItemsSection pattern below: this is a one-time retroactive
// choice, not an accumulating list.
function SingleEncounterSelect({ value, onChange, T, items }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Start — the exposure Encounter</div>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }}>
        <option value="">Select an Encounter…</option>
        {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
    </div>
  );
}

// Shared "linked + suggested" section — used for At-risk Encounters,
// Tests, Clinic Visits, and Symptom Log entries alike. `candidates` is
// pre-filtered by the caller (e.g. "after the start date, not already
// linked") — suggestions are ALWAYS tappable chips, NEVER auto-added,
// per the user's explicit instruction on how linking should work here.
function LinkedItemsSection({ label, linkedIds, onChange, candidates, nameFor, T, alertIds = [] }) {
  return (
    <div style={{ padding: "8px 0" }}>
      {label && <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>}
      {linkedIds.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {linkedIds.map((id) => (
            <div key={id} onClick={() => onChange(linkedIds.filter((v) => v !== id))}
              style={{ padding: "4px 8px", borderRadius: radius.full, fontSize: 12, background: alertIds.includes(id) ? `${T.actionRed}18` : T.surfaceVariant, color: alertIds.includes(id) ? T.actionRed : T.textPrimary, fontWeight: alertIds.includes(id) ? 700 : 400, cursor: "pointer" }}>
              {nameFor(id)} ✕
            </div>
          ))}
        </div>
      )}
      {candidates.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {candidates.slice(0, 6).map((c) => (
            <div key={c.id} onClick={() => onChange([...linkedIds, c.id])}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.healthcareBlue}`, color: T.healthcareBlue, cursor: "pointer" }}>
              + {c.name}
            </div>
          ))}
        </div>
      ) : linkedIds.length === 0 ? (
        <div style={{ fontSize: 11, color: T.textDisabled, fontStyle: "italic" }}>Nothing to suggest yet.</div>
      ) : null}
    </div>
  );
}

function ReadRow({ label, value, T, alert }) {
  if (value === "" || value == null || (Array.isArray(value) && value.length === 0)) return null;
  const display = Array.isArray(value) ? value.join(", ") : String(value);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 12, color: T.textSecondary, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: alert ? T.actionRed : T.textPrimary, fontWeight: 500, textAlign: "right" }}>{display}</span>
    </div>
  );
}

function StartSheet({ onSave, onClose, T }) {
  const [title, setTitle] = useState("");
  const [triggerReason, setTriggerReason] = useState("");
  const [startEncounterId, setStartEncounterId] = useState("");
  const triggerReasonOptions = useMemo(() => CustomOptionListsRepository.get("episodeTriggerReason"), []);
  const encounters = useMemo(() => EncounterRepository.getAll().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).map((e) => ({ id: e.id, name: encounterLabel(e) })), []);
  const canSave = title.trim().length > 0 && startEncounterId;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 210 }} onClick={onClose}>
      <div style={{ background: T.bg, width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 20px 4px", flexShrink: 0 }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 16, color: T.textPrimary }}>Start an episode</span>
        </div>
        <div style={{ overflowY: "auto", padding: "0 20px", flex: 1 }}>
          <TextField label="Title" value={title} onChange={setTitle} T={T} placeholder="e.g. Chlamydia exposure, Aug 2026" />
          <SelectField label="Why this started" value={triggerReason} onChange={setTriggerReason} options={triggerReasonOptions} T={T} />
          <SingleEncounterSelect value={startEncounterId} onChange={setStartEncounterId} T={T} items={encounters} />
        </div>
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
          <button onClick={() => canSave && onSave({ title, triggerReason, startEncounterId })}
            style={{ width: "100%", padding: 16, borderRadius: radius.full, border: "none", background: canSave ? T.healthcareBlue : T.textDisabled, color: "#FFFFFF", fontSize: 16, fontWeight: 700, cursor: canSave ? "pointer" : "default" }}>
            Start episode
          </button>
        </div>
      </div>
    </div>
  );
}

function EpisodeDetail({ episodeId, onBack, T }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const episode = useMemo(() => EpisodeRepository.getById(episodeId), [episodeId, refreshKey]);
  if (!episode) return null;

  const startEncounter = EncounterRepository.getById(episode.startEncounterId);
  const startDate = startEncounter?.date;
  const isOpen = !episode.resolvedDate;

  const linkedTests = episode.testIds.map((id) => TestingRepository.getById(id)).filter(Boolean);
  const hasPositive = linkedTests.some(testIsPositive);

  const update = (changes) => { EpisodeRepository.update(episodeId, changes); setRefreshKey((k) => k + 1); };

  const encounterCandidates = startDate
    ? EncounterRepository.getAll().filter((e) => e.id !== episode.startEncounterId && e.date >= startDate && !episode.atRiskEncounterIds.includes(e.id))
      .sort((a, b) => new Date(a.date) - new Date(b.date)).map((e) => ({ id: e.id, name: encounterLabel(e) }))
    : [];
  const testCandidates = startDate
    ? TestingRepository.getAll().filter((t) => !t.isArchived && t.date >= startDate && !episode.testIds.includes(t.id))
      .sort((a, b) => new Date(a.date) - new Date(b.date)).map((t) => ({ id: t.id, name: testLabel(t) }))
    : [];
  const visitCandidates = startDate
    ? ClinicVisitsRepository.getAll().filter((v) => !v.isArchived && v.date >= startDate && !episode.clinicVisitIds.includes(v.id))
      .sort((a, b) => new Date(a.date) - new Date(b.date)).map((v) => ({ id: v.id, name: visitLabel(v) }))
    : [];
  const symptomCandidates = startDate
    ? SymptomLogRepository.getAll().filter((s) => !s.isArchived && s.dateStarted >= startDate && !episode.symptomLogIds.includes(s.id))
      .sort((a, b) => new Date(a.dateStarted) - new Date(b.dateStarted)).map((s) => ({ id: s.id, name: symptomLogLabel(s) }))
    : [];

  const toggleNotified = (encounterId) => {
    const already = episode.notifiedEncounterIds.includes(encounterId);
    update({ notifiedEncounterIds: already ? episode.notifiedEncounterIds.filter((id) => id !== encounterId) : [...episode.notifiedEncounterIds, encounterId] });
  };

  const resolve = (resolution) => {
    update({ resolvedDate: new Date().toISOString().slice(0, 10), resolution });
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "16px" }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onBack} />
      </div>
      <div style={{ padding: "0 16px 100px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: radius.full, background: isOpen && hasPositive ? T.actionRed : isOpen ? T.healthcareBlue : T.actionGreen, display: "inline-block" }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary }}>{episode.title}</span>
        </div>
        <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 20, fontFamily: "'Inter', sans-serif" }}>
          {isOpen ? (hasPositive ? "Open · positive result found" : "Open") : `Resolved ${formatDate(episode.resolvedDate)} — ${episode.resolution}`}
        </div>

        <SectionCard title="Start" T={T}>
          <ReadRow label="Exposure Encounter" value={encounterLabel(startEncounter)} T={T} />
          <ReadRow label="Why this started" value={episode.triggerReason} T={T} />
        </SectionCard>

        <SectionCard title="At-risk encounters" T={T}>
          <div style={{ fontSize: 11, color: T.textDisabled, marginBottom: 6 }}>
            Anyone logged after the start date, while this stayed open. {hasPositive && "Tap a name once you've notified them — it'll show marked below."}
          </div>
          <LinkedItemsSection linkedIds={episode.atRiskEncounterIds} onChange={(v) => update({ atRiskEncounterIds: v })} candidates={encounterCandidates} nameFor={(id) => encounterLabel(EncounterRepository.getById(id))} T={T} />
          {/* ADDED 19 Aug 2026 — real exposure-window flagging, per
              the user's ask (BASHH/UK-guidance window periods — see
              exposureWindows.js for full sourcing/caveats). Each
              at-risk encounter shows whether a linked test has
              actually had time to reliably detect an infection from
              THAT specific encounter — a negative result taken too
              soon doesn't confidently clear anyone, and this makes
              that visible rather than silently treating every at-risk
              encounter as equally "covered" the moment any test comes
              back negative. */}
          {episode.atRiskEncounterIds.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {episode.atRiskEncounterIds.map((id) => {
                const enc = EncounterRepository.getById(id);
                const coverage = getEncounterCoverage(enc?.date, linkedTests);
                return (
                  <div key={id} style={{ fontSize: 11, display: "flex", alignItems: "flex-start", gap: 6 }}>
                    {coverage.status === "covered" && <Check size={12} color={T.actionGreen} style={{ flexShrink: 0, marginTop: 1 }} />}
                    {coverage.status !== "covered" && <AlertTriangle size={12} color={coverage.status === "uncovered" ? "#F59E0B" : T.textDisabled} style={{ flexShrink: 0, marginTop: 1 }} />}
                    <span style={{ color: coverage.status === "covered" ? T.actionGreen : coverage.status === "uncovered" ? "#B45309" : T.textDisabled }}>
                      {encounterLabel(enc)} —{" "}
                      {coverage.status === "covered" && "cleared by a test taken after the relevant window"}
                      {coverage.status === "no_test" && "no test logged since this encounter yet"}
                      {coverage.status === "uncovered" && `too soon to confirm — ${coverage.uncoveredInfections.join(", ")} window${coverage.uncoveredInfections.length > 1 ? "s" : ""} not yet elapsed as of the linked test`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {hasPositive && episode.atRiskEncounterIds.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 4 }}>Notified?</div>
              {episode.atRiskEncounterIds.map((id) => {
                const notified = episode.notifiedEncounterIds.includes(id);
                return (
                  <div key={id} onClick={() => toggleNotified(id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer" }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${notified ? T.actionGreen : T.textDisabled}`, background: notified ? T.actionGreen : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {notified && <Check size={12} color="#FFFFFF" weight="bold" />}
                    </div>
                    <span style={{ fontSize: 13, color: T.textPrimary }}>{encounterLabel(EncounterRepository.getById(id))}</span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Testing" T={T}>
          <LinkedItemsSection label="Linked tests — initial, cultures, TOC (order tells the story)" linkedIds={episode.testIds} onChange={(v) => update({ testIds: v })} candidates={testCandidates} nameFor={(id) => testLabel(TestingRepository.getById(id))} T={T} alertIds={linkedTests.filter(testIsPositive).map((t) => t.id)} />
        </SectionCard>

        <SectionCard title="Treatment" T={T}>
          <LinkedItemsSection label="Clinic visits" linkedIds={episode.clinicVisitIds} onChange={(v) => update({ clinicVisitIds: v })} candidates={visitCandidates} nameFor={(id) => visitLabel(ClinicVisitsRepository.getById(id))} T={T} />
        </SectionCard>

        <SectionCard title="Symptoms" T={T}>
          <LinkedItemsSection label="Symptom Log entries" linkedIds={episode.symptomLogIds} onChange={(v) => update({ symptomLogIds: v })} candidates={symptomCandidates} nameFor={(id) => symptomLogLabel(SymptomLogRepository.getById(id))} T={T} />
        </SectionCard>

        <SectionCard title="Notes" T={T}>
          <textarea value={episode.notes} onChange={(e) => update({ notes: e.target.value })} rows={3}
            style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
        </SectionCard>

        {isOpen && (
          <SectionCard title="Resolve" T={T}>
            {(() => {
              const startCoverage = getEncounterCoverage(startDate, linkedTests);
              return startCoverage.status === "uncovered" ? (
                <div style={{ display: "flex", gap: 8, padding: "6px 0 10px", alignItems: "flex-start" }}>
                  <AlertTriangle size={14} color="#F59E0B" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 12, color: "#B45309", lineHeight: 1.4 }}>
                    It's not yet been long enough since the start Encounter for a test to reliably rule out {startCoverage.uncoveredInfections.join(", ")} — a negative result now may not be conclusive. You can still resolve manually if you're confident (e.g. on clinical advice).
                  </span>
                </div>
              ) : null;
            })()}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
              {RESOLUTION_OPTIONS.map((opt) => (
                <button key={opt} onClick={() => resolve(opt)}
                  style={{ padding: 12, borderRadius: radius.sm, border: `1px solid ${T.healthcareBlue}`, background: "transparent", color: T.healthcareBlue, fontWeight: 600, cursor: "pointer" }}>
                  Mark resolved — {opt}
                </button>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

function TimelineLanding({ onOpen, onAdd, onClose, T }) {
  const [episodes] = useState(() => EpisodeRepository.getAll().filter((e) => !e.isArchived));
  const sorted = useMemo(() => {
    const withDate = episodes.map((e) => ({ ...e, _date: EncounterRepository.getById(e.startEncounterId)?.date || e.createdAt }));
    return withDate.sort((a, b) => (a.resolvedDate ? 1 : 0) - (b.resolvedDate ? 1 : 0) || new Date(b._date) - new Date(a._date));
  }, [episodes]);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}`, zIndex: 1 }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, flex: 1 }}>Episodes</span>
      </div>
      {/* CHANGED — real gap found: every other Healthcare-domain
          module already got the floating, module-colored add button
          this session — Timeline was the one left behind with the
          original bare inline icon (the exact "nearly hidden, make it
          clearer" pattern this whole standardization was fixing). */}
      <div onClick={onAdd} style={{ position: "fixed", bottom: 90, right: 20, width: 56, height: 56, borderRadius: 999, background: T.healthcareBlue, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,.2)", zIndex: 20 }}>
        <Plus size={24} />
      </div>
      <div style={{ padding: "12px 16px 100px", display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: T.textDisabled, fontSize: 13 }}>
            No episodes yet. Tap + to start one from an existing Encounter.
          </div>
        )}
        {sorted.map((e) => {
          const linkedTests = e.testIds.map((id) => TestingRepository.getById(id)).filter(Boolean);
          const hasPositive = linkedTests.some(testIsPositive);
          const isOpen = !e.resolvedDate;
          return (
            <div key={e.id} onClick={() => onOpen(e.id)}
              style={{ background: T.surface, border: `1px solid ${isOpen && hasPositive ? T.actionRed : T.border}`, borderRadius: radius.md, padding: 14, cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: radius.full, background: isOpen && hasPositive ? T.actionRed : isOpen ? T.healthcareBlue : T.actionGreen, display: "inline-block" }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>{e.title}</span>
              </div>
              <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 16, marginTop: 2, fontFamily: "'Inter', sans-serif" }}>
                {e.triggerReason || "—"} · {isOpen ? "Open" : `Resolved ${formatDate(e.resolvedDate)}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TimelineModule({ onClose } = {}) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : LIGHT;
  const [screen, setScreen] = useState({ name: "list" });
  const backToList = () => setScreen({ name: "list" });
  const startEpisode = (data) => { EpisodeRepository.create(data); backToList(); };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: T.bg, minHeight: "100vh" }}>
      {screen.name === "list" && <TimelineLanding T={T} onOpen={(id) => setScreen({ name: "detail", id })} onAdd={() => setScreen({ name: "add" })} onClose={onClose} />}
      {screen.name === "detail" && <EpisodeDetail T={T} episodeId={screen.id} onBack={backToList} />}
      {screen.name === "add" && <StartSheet T={T} onSave={startEpisode} onClose={backToList} />}
    </div>
  );
}

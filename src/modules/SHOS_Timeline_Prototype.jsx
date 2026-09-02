import React, { useState, useMemo, useEffect, useRef } from "react";
import { PlusIcon as Plus, CaretLeftIcon as ChevronLeft, CheckIcon as Check, WarningIcon as AlertTriangle, TrashIcon as Trash2, ArchiveIcon as Archive, ArrowsClockwiseIcon as RefreshCcw, ChatCircleTextIcon as MessageSquare, CopyIcon as Copy } from "@phosphor-icons/react";
import { EpisodeRepository, RESOLUTION_OPTIONS } from "../repositories/episodeRepository";
// ADDED 19 Aug 2026 — TRIGGER_REASON_OPTIONS now lives here, real
// in-app editable option list.
import { CustomOptionListsRepository } from "../repositories/customOptionListsRepository";
import { EncounterRepository } from "../repositories/encounterRepository";
import { TestingRepository } from "../repositories/testingRepository";
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository";
import { SymptomLogRepository } from "../repositories/symptomLogRepository";
import { ResultsRegistry } from "../registries/resultsRegistry";
import { OrganismRegistry } from "../registries/organismRegistry";
import { getEncounterCoverage } from "../calculations/exposureWindows";
// CHANGED 20 Aug 2026 — real design-unification pass: values read
// from the shared designTokens.js source of truth instead of being
// retyped here, so this screen can't silently drift from every other
// module's "same" color/radius. See designTokens.js.
import { NEUTRAL, NEUTRAL_DARK, ACCENTS, ACTION, RADIUS, resolveDarkAccent } from "../calculations/designTokens";
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
// CHANGED — real architecture fix, same as Contacts' own comment:
// resolveDarkAccent() keeps today's exact behaviour by default, only
// brightening once a real colour override exists.
const DARK = {
  ...NEUTRAL_DARK,
  healthcareBlue: resolveDarkAccent("healthcare", ACCENTS.healthcare), actionRed: resolveDarkAccent("actionRed", ACTION.red, "#FF7A7E"), actionGreen: resolveDarkAccent("actionGreen", ACTION.green, "#5FD9A4"),
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

// ADDED 2 Sep 2026 — real ask: "partner notification message helper",
// previously declined ("hold off on #2") and now built, last in this
// batch. A draft message the user can copy and send themselves — this
// app never sends anything on its own behalf (matches its whole "your
// data never leaves your device unless you export/share it" stance).
// Pure text-building only, no repository access — the caller resolves
// infectionNames (or passes none) so this stays testable/predictable.
// Generic by default: real partner-notification guidance (and this
// episode feature's own existing privacy design — see
// episodeRepository.js's own comment on why the trigger is a category,
// not a live Contact relation) treats naming the exact result as the
// discloser's choice to make explicitly, not an app default. Never
// names WHO is being notified or WHO told the user — the message is
// first-person, sent by the user themselves, so it needs neither.
function buildPartnerMessage(includeInfection, infectionNames) {
  const what = includeInfection && infectionNames.length > 0
    ? infectionNames.join(", ")
    : "an STI";
  return `Hi — wanted to give you a heads up: I recently tested positive for ${what}, and based on when we last met up, you may have been exposed. It's worth getting tested soon, even without symptoms. No need to say who let you know — just wanted you to have the chance to take care of yourself.`;
}

// Small, self-contained draft-and-copy sheet — same
// generate/edit/copy shape as My Profile's own share-text flow
// (navigator.clipboard.writeText, try/catch, a plain status line), so
// this reads as the same kind of tool rather than a new pattern.
function PartnerMessageHelper({ infectionNames, T }) {
  const [open, setOpen] = useState(false);
  const [includeInfection, setIncludeInfection] = useState(false);
  const [draft, setDraft] = useState(() => buildPartnerMessage(false, infectionNames));
  const [status, setStatus] = useState(null);

  const regenerate = (nextIncludeInfection) => {
    setIncludeInfection(nextIncludeInfection);
    setDraft(buildPartnerMessage(nextIncludeInfection, infectionNames));
    setStatus(null);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setStatus({ ok: true, msg: "Copied — paste it into a message to send." });
    } catch {
      setStatus({ ok: false, msg: "Couldn't copy automatically — select and copy the text manually." });
    }
  };

  if (!open) {
    return (
      <div onClick={() => setOpen(true)} style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: T.healthcareBlue, cursor: "pointer" }}>
        <MessageSquare size={14} /> Draft a heads-up message
      </div>
    );
  }
  return (
    <div style={{ marginTop: 10, padding: 12, borderRadius: radius.md, border: `1px solid ${T.border}`, background: T.surfaceVariant }}>
      <div style={{ fontSize: 11, color: T.textDisabled, marginBottom: 8 }}>
        A draft only — nothing sends automatically, and it never names who's being notified or who told you. Edit it however you like before sending it yourself.
      </div>
      {infectionNames.length > 0 && (
        <div onClick={() => regenerate(!includeInfection)} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}>
          <div style={{ width: 34, height: 20, borderRadius: radius.full, background: includeInfection ? T.healthcareBlue : T.border, position: "relative", flexShrink: 0 }}>
            <div style={{ width: 16, height: 16, borderRadius: radius.full, background: "#FFFFFF", position: "absolute", top: 2, left: includeInfection ? 16 : 2, transition: "left 120ms ease" }} />
          </div>
          <span style={{ fontSize: 12, color: T.textPrimary }}>Name the specific result ({infectionNames.join(", ")})</span>
        </div>
      )}
      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={5}
        style={{ width: "100%", padding: 10, borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surface, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
        <button onClick={copy} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, border: "none", background: T.healthcareBlue, color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <Copy size={13} /> Copy
        </button>
        <span onClick={() => setOpen(false)} style={{ fontSize: 12, color: T.textSecondary, cursor: "pointer" }}>Close</span>
        {status && <span style={{ fontSize: 11, color: status.ok ? T.actionGreen : T.actionRed }}>{status.msg}</span>}
      </div>
    </div>
  );
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

function EpisodeDetail({ episodeId, onBack, onDeleted, onDelete, T }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const episode = useMemo(() => EpisodeRepository.getById(episodeId), [episodeId, refreshKey]);
  if (!episode) return null;

  const startEncounter = EncounterRepository.getById(episode.startEncounterId);
  const startDate = startEncounter?.date;
  const isOpen = !episode.resolvedDate;

  const linkedTests = episode.testIds.map((id) => TestingRepository.getById(id)).filter(Boolean);
  const hasPositive = linkedTests.some(testIsPositive);
  // ADDED 2 Sep 2026 — real ask: partner-notification message helper.
  // Pulled from the positive test(s)' own linked organism(s), same
  // real data the app already tracks — never invented or guessed.
  const infectionNames = [...new Set(
    linkedTests.filter(testIsPositive).flatMap((t) => t.organismIds || []).map((id) => OrganismRegistry.getById(id)?.name).filter(Boolean)
  )];

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

  // CHANGED 2 Sep 2026 — real ask: "episodes end date?" — resolvedDate
  // used to be hardcoded to whatever day you happened to tap the
  // button, with no way to set or correct it to when the episode
  // actually resolved (e.g. logging a TOC result a few days after it
  // came back). resolveDateDraft is a real, editable date — defaults
  // to today, but overridable before confirming, and resets to
  // episode.resolvedDate (or today) whenever a different episode is
  // opened. Also added: reopen(), since a resolved episode previously
  // had no undo at all — same "how do I undo this" standard every
  // other action in this app already meets.
  // NOTE: existing resolvedDate values (including seed data) are full
  // ISO timestamps, not date-only strings — <input type="date"> only
  // accepts "YYYY-MM-DD", same .slice(0,10) convention used everywhere
  // else in this app for exactly that reason.
  const [resolveDateDraft, setResolveDateDraft] = useState(() => (episode.resolvedDate || new Date().toISOString()).slice(0, 10));
  useEffect(() => { setResolveDateDraft((episode.resolvedDate || new Date().toISOString()).slice(0, 10)); }, [episodeId]);

  const resolve = (resolution) => {
    update({ resolvedDate: resolveDateDraft, resolution });
  };
  const saveResolvedDate = () => {
    update({ resolvedDate: resolveDateDraft });
  };
  const reopen = () => {
    update({ resolvedDate: null, resolution: "" });
  };

  // CHANGED 2 Sep 2026 — real ask: "episode's delete button still soft-
  // archives rather than truly deleting... do now." This used to
  // silently call archive() no matter what the "Remove" label/trash
  // icon implied — the repository's real delete()/restore() pair
  // (added in an earlier undo/edit/delete/archive audit) had no UI
  // entry point at all. Now split into two real, separate actions,
  // same as every other module's own header: Archive/Unarchive (a
  // direct, reversible toggle — no confirm needed, matches the pattern
  // everywhere else) and a genuine permanent delete behind its own
  // confirm sheet (same Cancel/"Delete permanently" shape as
  // Encounters'), wired to a real undo toast below rather than a bare
  // window.confirm.
  const toggleArchive = () => update({ isArchived: !episode.isArchived });
  const confirmDeletePermanently = () => {
    onDelete(episode);
    onDeleted();
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onBack} />
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Archive size={19} color={T.textSecondary} style={{ cursor: "pointer" }} onClick={toggleArchive} title={episode.isArchived ? "Unarchive" : "Archive"} />
          <Trash2 size={20} color={T.actionRed} style={{ cursor: "pointer" }} onClick={() => setConfirmDelete(true)} title="Delete permanently" />
        </div>
      </div>
      {episode.isArchived && (
        <div style={{ margin: "0 16px 4px", background: `${T.actionRed}15`, border: `1px solid ${T.actionRed}`, borderRadius: radius.sm, padding: 10, fontSize: 12, color: T.actionRed }}>
          This episode is archived.
        </div>
      )}
      {confirmDelete && (
        <div style={{ margin: "0 16px 12px", background: T.surface, border: `1px solid ${T.actionRed}`, borderRadius: radius.md, padding: 14 }}>
          <div style={{ fontSize: 13, color: T.textPrimary, marginBottom: 10 }}>
            Delete "{episode.title}" permanently? This only removes the episode itself — nothing it links to (Encounters, Tests, Clinic Visits) is touched. You'll have a few seconds to undo.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: 10, borderRadius: 999, border: `1px solid ${T.border}`, background: "transparent", color: T.textSecondary, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={confirmDeletePermanently} style={{ flex: 1, padding: 10, borderRadius: 999, border: "none", background: T.actionRed, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Delete permanently</button>
          </div>
        </div>
      )}
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
              <PartnerMessageHelper infectionNames={infectionNames} T={T} />
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

        {isOpen ? (
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
            {/* ADDED 2 Sep 2026 — real ask: "episodes end date?" — this
                used to always be silently "today", the day you happened
                to open the app, with no way to backdate it to when the
                episode actually resolved (e.g. a TOC result logged a
                few days after it came back). */}
            <div style={{ padding: "4px 0 8px" }}>
              <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>End date</div>
              <input type="date" value={resolveDateDraft} onChange={(e) => setResolveDateDraft(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13 }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
              {RESOLUTION_OPTIONS.map((opt) => (
                <button key={opt} onClick={() => resolve(opt)}
                  style={{ padding: 12, borderRadius: radius.sm, border: `1px solid ${T.healthcareBlue}`, background: "transparent", color: T.healthcareBlue, fontWeight: 600, cursor: "pointer" }}>
                  Mark resolved — {opt}
                </button>
              ))}
            </div>
          </SectionCard>
        ) : (
          <SectionCard title="Resolved" T={T}>
            <div style={{ fontSize: 13, color: T.textPrimary, marginBottom: 10 }}>{episode.resolution}</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>End date</div>
                <input type="date" value={resolveDateDraft} onChange={(e) => setResolveDateDraft(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              {resolveDateDraft !== (episode.resolvedDate || "").slice(0, 10) && (
                <button onClick={saveResolvedDate} style={{ padding: "8px 14px", borderRadius: radius.sm, border: "none", background: T.healthcareBlue, color: "#FFFFFF", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Save</button>
              )}
            </div>
            <div onClick={reopen} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: T.textSecondary, cursor: "pointer" }}>
              <RefreshCcw size={13} /> Reopen this episode
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

// Same undo/redo toast shape as Encounters' own EditUndoToast (this
// session's reference implementation for delete-undo) — kept
// consistent rather than inventing a new look for the same idea.
function DeleteUndoToast({ toast, onUndo, onRedo, T }) {
  if (!toast) return null;
  const isUndo = toast.mode === "undo";
  return (
    <div onClick={isUndo ? onUndo : onRedo}
      style={{ position: "fixed", top: 64, left: "50%", transform: "translateX(-50%)", width: 340, background: isUndo ? "#1B1B1F" : T.healthcareBlue, color: "#FFFFFF", borderRadius: 999, padding: "10px 16px", fontSize: 13, fontWeight: 600, textAlign: "center", cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,.25)", zIndex: 230, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
      {isUndo ? <Check size={14} /> : <RefreshCcw size={14} />}
      {isUndo ? "Episode deleted — tap to undo" : "Undone — tap to redo"}
    </div>
  );
}

export default function TimelineModule({ onClose, registerModuleBackHandler } = {}) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : LIGHT;
  const [screen, setScreen] = useState({ name: "list" });
  const [refreshKey, setRefreshKey] = useState(0);
  const backToList = () => setScreen({ name: "list" });
  const startEpisode = (data) => { EpisodeRepository.create(data); backToList(); };

  // ADDED 2 Sep 2026 — real undo/redo for Episode's new genuine
  // permanent delete, same {mode, record} shape/timing as Encounters'
  // own deleteToast (8s window, tap to undo, tap again to redo).
  const [deleteToast, setDeleteToast] = useState(null);
  const undoTimerRef = useRef(null);
  const handleDelete = (record) => {
    EpisodeRepository.delete(record.id);
    clearTimeout(undoTimerRef.current);
    setDeleteToast({ mode: "undo", record });
    undoTimerRef.current = setTimeout(() => setDeleteToast(null), 8000);
    setRefreshKey((k) => k + 1);
  };
  const undoDelete = () => {
    if (!deleteToast) return;
    EpisodeRepository.restore(deleteToast.record);
    clearTimeout(undoTimerRef.current);
    setDeleteToast({ mode: "redo", record: deleteToast.record });
    undoTimerRef.current = setTimeout(() => setDeleteToast(null), 8000);
    setRefreshKey((k) => k + 1);
  };
  const redoDelete = () => {
    if (!deleteToast) return;
    EpisodeRepository.delete(deleteToast.record.id);
    clearTimeout(undoTimerRef.current);
    setDeleteToast(null);
    setRefreshKey((k) => k + 1);
  };

  // ADDED — real ask: back should step within Timeline (add/detail back
  // to list) before closing the whole overlay, matching the pattern
  // every other module already uses. With nothing left to step back
  // within, this closes Timeline itself rather than falling through to
  // the shell — Timeline is an overlay on top of whatever tab opened
  // it, not a tab of its own.
  useEffect(() => {
    if (!registerModuleBackHandler) return;
    registerModuleBackHandler(() => {
      if (screen.name === "add" || screen.name === "detail") { backToList(); return true; }
      onClose?.();
      return true;
    });
    return () => registerModuleBackHandler(null);
  }, [screen, registerModuleBackHandler, onClose]);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: T.bg, minHeight: "100vh" }}>
      <DeleteUndoToast toast={deleteToast} onUndo={undoDelete} onRedo={redoDelete} T={T} />
      {screen.name === "list" && <TimelineLanding key={refreshKey} T={T} onOpen={(id) => setScreen({ name: "detail", id })} onAdd={() => setScreen({ name: "add" })} onClose={onClose} />}
      {screen.name === "detail" && <EpisodeDetail T={T} episodeId={screen.id} onBack={backToList} onDeleted={backToList} onDelete={handleDelete} />}
      {screen.name === "add" && <StartSheet T={T} onSave={startEpisode} onClose={backToList} />}
    </div>
  );
}

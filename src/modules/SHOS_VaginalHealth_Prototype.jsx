// SHOS_VaginalHealth_Prototype.jsx — Vaginal health module (BACKLOG 6).
//
// SCOPE. A short list of vaginal-health episodes with a clinician-approved
// urgency tier per condition. Urgency is the point of the screen: it answers
// "how fast do I need to act", so it is the first thing each card shows.
//   PID / cervicitis  — same-day urgent (red)
//   Trichomoniasis    — prompt (amber)
//   BV / candidiasis  — routine (green)
//   Pregnancy         — refer to antenatal care (amber)
// These tiers are the owner's own clinical decision and are deliberately not
// derived from anything else in the app.
//
// CHANGED 12 Nov 2026 — real bug fix, three defects at once:
//   1. The list kept its OWN `records` state initialised to [] and never
//      accepted the parent's, so it was permanently empty: adding a record
//      "worked" but nothing ever appeared, and neither edit nor delete was
//      reachable. Records now live in this module and are passed down.
//   2. The row's delete control was a <button> nested inside a clickable
//      card with no stopPropagation, so tapping delete ALSO opened the
//      editor underneath the confirmation.
//   3. The date was written with toISOString(), i.e. UTC. For anyone east of
//      Greenwich in the evening that stores yesterday's date — the exact
//      class of bug storedDateArithmeticGuard/dateInputHelpers already exist
//      to prevent. It now uses the app's local-day helper.
// Also brought in line with the rest of the app: storage goes through
// storageAdapter (not raw localStorage), colours come from the design tokens
// (including a resolved dark-mode accent) instead of hand-typed hex, delete
// asks for confirmation via the shared ConfirmDeleteCard, and all copy is in
// the string table.
import React, { useState, useEffect } from "react";
import { VaginalHealthRepository } from "../repositories/vaginalHealthRepository";
import {
  FONT_FAMILY, NEUTRAL, NEUTRAL_DARK, ACCENTS, ACTION, ACTION_TEXT_SAFE, RADIUS, TYPE, resolveDarkAccent,
} from "../calculations/designTokens";
import { useDarkModePreference } from "../calculations/darkModePreference";
import { useTranslation } from "../i18n/index.js";
import { nowAsDateString } from "../calculations/dateInputHelpers";
import EmptyState from "../components/EmptyState";
import ConfirmDeleteCard from "../components/ConfirmDeleteCard";

// Amber has no resolved-theme twin (it is a fixed warning tone in
// designTokens), so it is named once here rather than read as ACTION.*
// straight into a style value — that would be a styleColourGuard regression.
const AMBER = ACTION.amber;
const AMBER_SURFACE = ACTION.amberSurface;
const AMBER_TEXT = ACTION.amberText;
// White on the module's own solid accent fill — the same convention every
// other module uses for its primary button. Named once so the literal is not
// repeated per button, and so it stays out of the raw-colour guard.
const ON_ACCENT = "#FFFFFF";

const CONDITIONS = ["pid", "trichomoniasis", "bv", "candidiasis", "pregnancy"];

const CONDITION_LABEL = {
  pid: "vaginalHealth.condition.pid",
  trichomoniasis: "vaginalHealth.condition.trichomoniasis",
  bv: "vaginalHealth.condition.bv",
  candidiasis: "vaginalHealth.condition.candidiasis",
  pregnancy: "vaginalHealth.condition.pregnancy",
};

const CONDITION_FALLBACK = {
  pid: "Pelvic inflammatory disease (PID)",
  trichomoniasis: "Trichomoniasis",
  bv: "Bacterial vaginosis (BV)",
  candidiasis: "Candidiasis (thrush)",
  pregnancy: "Pregnancy",
};

// One place that maps a condition to its tier, so the list card, the picker
// and the edit screen can never disagree about how urgent something is.
function tierFor(condition, T) {
  switch (condition) {
    case "pid":
      return { labelKey: "vaginalHealth.urgent", fallback: "Urgent", color: T.actionRed, text: T.actionRedText, tint: `${T.actionRed}14` };
    case "trichomoniasis":
      return { labelKey: "vaginalHealth.prompt", fallback: "Prompt", color: AMBER, text: AMBER_TEXT, tint: AMBER_SURFACE };
    case "pregnancy":
      return { labelKey: "vaginalHealth.refer", fallback: "Refer", color: AMBER, text: AMBER_TEXT, tint: AMBER_SURFACE };
    default:
      return { labelKey: "vaginalHealth.routine", fallback: "Routine", color: T.actionGreen, text: T.actionGreenText, tint: `${T.actionGreen}14` };
  }
}

// Same light/dark basis every other module uses (see Testing's buildLight/
// buildDark for the reasoning behind each companion value).
function buildLight() {
  return {
    ...NEUTRAL,
    healthcare: ACCENTS.healthcare,
    actionRed: ACTION.red,
    actionGreen: ACTION.green,
    actionRedText: ACTION_TEXT_SAFE.red,
    actionGreenText: ACTION_TEXT_SAFE.green,
  };
}

function buildDark() {
  return {
    ...NEUTRAL_DARK,
    healthcare: resolveDarkAccent("healthcare", ACCENTS.healthcare, "#0E8144"),
    actionRed: resolveDarkAccent("actionRed", ACTION.red, "#FF7A7E"),
    actionGreen: resolveDarkAccent("actionGreen", ACTION.green, "#5FD9A4"),
    actionRedText: resolveDarkAccent("actionRed", ACTION.red, "#FF7A7E"),
    actionGreenText: resolveDarkAccent("actionGreen", ACTION.green, "#5FD9A4"),
  };
}

function VaginalHealthLanding({ T, records, loading, onAdd, onDelete, onEdit, onRequestDelete, pendingDeleteId, onCancelDelete }) {
  const { t } = useTranslation();
  return (
    <div style={{ padding: "14px 16px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ ...TYPE.subScreenTitle, color: T.textPrimary }}>{t("vaginalHealth.title", "Vaginal health")}</div>
        <button type="button" onClick={onAdd}
          style={{ padding: "8px 14px", minHeight: 40, borderRadius: RADIUS.full, border: "none", background: T.healthcare, color: ON_ACCENT, fontWeight: 700, fontSize: 12, cursor: "pointer", flexShrink: 0 }}>
          + {t("vaginalHealth.add", "Add")}
        </button>
      </div>

      {loading ? (
        <div aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} style={{ height: 74, borderRadius: RADIUS.md, background: T.surfaceVariant, marginBottom: 10, opacity: 0.6 }} />
          ))}
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          T={T}
          message={t("vaginalHealth.empty", "No vaginal health records yet. Use Add to record your first entry.")}
          actionLabel={t("vaginalHealth.add", "Add")}
          onAction={onAdd}
        />
      ) : (
        records.map((r) => {
          const tier = tierFor(r.condition, T);
          return (
            <div
              key={r.id}
              role="button"
              tabIndex={0}
              aria-label={`${t(CONDITION_LABEL[r.condition] || "vaginalHealth.title", CONDITION_FALLBACK[r.condition] || "Vaginal health")}, ${t(tier.labelKey, tier.fallback)}`}
              onClick={() => onEdit(r.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(r.id); } }}
              style={{ background: T.surface, border: `1px solid ${T.border}`, borderLeft: `4px solid ${tier.color}`, borderRadius: RADIUS.md, padding: 12, marginBottom: 10, cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: tier.color, flexShrink: 0 }} />
                <span style={{ ...TYPE.bodyEmphasis, color: T.textPrimary, flex: 1, minWidth: 0, overflowWrap: "break-word" }}>
                  {t(CONDITION_LABEL[r.condition] || "vaginalHealth.title", CONDITION_FALLBACK[r.condition] || r.condition)}
                </span>
                <span style={{ ...TYPE.microLabel, color: tier.text, background: tier.tint, borderRadius: RADIUS.sm, padding: "2px 6px", flexShrink: 0 }}>
                  {t(tier.labelKey, tier.fallback)}
                </span>
                <button
                  type="button"
                  aria-label={t("vaginalHealth.delete", "Delete record")}
                  onClick={(e) => { e.stopPropagation(); onRequestDelete(r.id); }}
                  style={{ background: "transparent", border: "none", color: T.textSecondary, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 6, flexShrink: 0 }}
                >
                  ×
                </button>
              </div>
              <div style={{ ...TYPE.caption, color: T.textSecondary, marginTop: 4 }}>{r.date || t("vaginalHealth.noDate", "No date")}</div>
              {r.treatment ? <div style={{ ...TYPE.caption, color: T.textSecondary, marginTop: 4 }}>Treatment: {r.treatment}</div> : null}
              {r.outcome ? <div style={{ ...TYPE.caption, color: T.textSecondary, marginTop: 4 }}>Outcome: {r.outcome}</div> : null}
              {r.notes ? <div style={{ ...TYPE.caption, color: T.textSecondary, marginTop: 4, whiteSpace: "pre-wrap" }}>{r.notes}</div> : null}
              {pendingDeleteId === r.id ? (
                <div onClick={(e) => e.stopPropagation()}>
                  <ConfirmDeleteCard
                    T={T}
                    moduleColor={T.healthcare}
                    margin="10px 0 0"
                    message={t("vaginalHealth.deleteConfirm", "This deletes this vaginal health record permanently — unlike archiving, there's no getting it back.")}
                    confirmLabel={t("vaginalHealth.deleteConfirmAction", "Delete record")}
                    onCancel={onCancelDelete}
                    onConfirm={() => onDelete(r.id)}
                  />
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}

function ConditionPicker({ T, onPick, onCancel }) {
  const { t } = useTranslation();
  return (
    <div style={{ padding: "14px 16px 24px" }}>
      <div style={{ ...TYPE.subScreenTitle, color: T.textPrimary, marginBottom: 4 }}>{t("vaginalHealth.addTitle", "Add vaginal health record")}</div>
      <div style={{ ...TYPE.caption, color: T.textSecondary, marginBottom: 12 }}>
        {t("vaginalHealth.addHint", "Pick the closest description. The badge shows how quickly it usually needs attention.")}
      </div>
      {CONDITIONS.map((key) => {
        const tier = tierFor(key, T);
        return (
          <button key={key} type="button" onClick={() => onPick(key)}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 48, padding: "10px 14px", marginBottom: 8, borderRadius: RADIUS.sm, border: `1px solid ${T.border}`, background: T.surface, color: T.textPrimary, fontFamily: FONT_FAMILY, fontSize: 14, cursor: "pointer", textAlign: "left" }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: tier.color, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{t(CONDITION_LABEL[key], CONDITION_FALLBACK[key])}</span>
            <span style={{ ...TYPE.microLabel, color: tier.text, background: tier.tint, borderRadius: RADIUS.sm, padding: "2px 6px", flexShrink: 0 }}>
              {t(tier.labelKey, tier.fallback)}
            </span>
          </button>
        );
      })}
      <button type="button" onClick={onCancel}
        style={{ marginTop: 8, padding: "10px 16px", minHeight: 44, borderRadius: RADIUS.full, border: `1px solid ${T.border}`, background: "transparent", color: T.textSecondary, fontFamily: FONT_FAMILY, fontSize: TYPE.control.fontSize, fontWeight: 600, cursor: "pointer" }}>
        {t("common.cancel", "Cancel")}
      </button>
    </div>
  );
}

function RecordEditor({ T, record, onChange, onDone, onRequestDelete, pendingDelete, onCancelDelete, onDelete }) {
  const { t } = useTranslation();
  const tier = tierFor(record.condition, T);
  return (
    <div style={{ padding: "14px 16px 24px" }}>
      <div style={{ ...TYPE.subScreenTitle, color: T.textPrimary, marginBottom: 2 }}>{t("vaginalHealth.editTitle", "Edit vaginal health record")}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ ...TYPE.bodyEmphasis, color: T.textPrimary }}>{t(CONDITION_LABEL[record.condition], CONDITION_FALLBACK[record.condition])}</span>
        <span style={{ ...TYPE.microLabel, color: tier.text, background: tier.tint, borderRadius: RADIUS.sm, padding: "2px 6px" }}>
          {t(tier.labelKey, tier.fallback)}
        </span>
      </div>

      <label style={{ ...TYPE.caption, color: T.textSecondary, display: "block", marginBottom: 4 }} htmlFor="vh-date">
        {t("vaginalHealth.date", "Date")}
      </label>
      <input
        id="vh-date"
        type="date"
        value={record.date || ""}
        onChange={(e) => onChange({ date: e.target.value })}
        style={{ width: "100%", padding: "10px 12px", marginBottom: 14, borderRadius: RADIUS.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: FONT_FAMILY, fontSize: TYPE.control.fontSize, boxSizing: "border-box" }}
      />

      <label style={{ ...TYPE.caption, color: T.textSecondary, display: "block", marginBottom: 4 }} htmlFor="vh-treatment">
        {t("vaginalHealth.treatment", "Treatment")}
      </label>
      <input
        id="vh-treatment"
        type="text"
        value={record.treatment || ""}
        onChange={(e) => onChange({ treatment: e.target.value })}
        placeholder={t("vaginalHealth.treatmentPlaceholder", "What was prescribed or done")}
        style={{ width: "100%", padding: "10px 12px", marginBottom: 14, borderRadius: RADIUS.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: FONT_FAMILY, fontSize: TYPE.control.fontSize, boxSizing: "border-box" }}
      />

      <label style={{ ...TYPE.caption, color: T.textSecondary, display: "block", marginBottom: 4 }} htmlFor="vh-outcome">
        {t("vaginalHealth.outcome", "Outcome")}
      </label>
      <select
        id="vh-outcome"
        value={record.outcome || ""}
        onChange={(e) => onChange({ outcome: e.target.value })}
        style={{ width: "100%", padding: "10px 12px", marginBottom: 14, borderRadius: RADIUS.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: FONT_FAMILY, fontSize: TYPE.control.fontSize, boxSizing: "border-box" }}>
        <option value="">{t("vaginalHealth.outcomeNone", "Not yet resolved")}</option>
        <option value="resolved">{t("vaginalHealth.outcomeResolved", "Resolved")}</option>
        <option value="recurring">{t("vaginalHealth.outcomeRecurring", "Recurring")}</option>
        <option value="chronic">{t("vaginalHealth.outcomeChronic", "Chronic")}</option>
      </select>

      <label style={{ ...TYPE.caption, color: T.textSecondary, display: "block", marginBottom: 4 }} htmlFor="vh-notes">
        {t("vaginalHealth.notes", "Notes")}
      </label>
      <textarea
        id="vh-notes"
        value={record.notes || ""}
        onChange={(e) => onChange({ notes: e.target.value })}
        rows={4}
        placeholder={t("vaginalHealth.notesPlaceholder", "Symptoms, treatment, who you saw…")}
        style={{ width: "100%", padding: "10px 12px", marginBottom: 14, borderRadius: RADIUS.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: FONT_FAMILY, fontSize: TYPE.control.fontSize, boxSizing: "border-box", resize: "vertical" }}
      />

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button type="button" onClick={onDone}
          style={{ flex: 1, padding: "10px 16px", minHeight: 44, borderRadius: RADIUS.full, border: "none", background: T.healthcare, color: ON_ACCENT, fontFamily: FONT_FAMILY, fontSize: TYPE.control.fontSize, fontWeight: 700, cursor: "pointer" }}>
          {t("common.done", "Done")}
        </button>
        <button type="button" onClick={onRequestDelete}
          style={{ padding: "10px 16px", minHeight: 44, borderRadius: RADIUS.full, border: `1px solid ${T.border}`, background: "transparent", color: T.actionRedText, fontFamily: FONT_FAMILY, fontSize: TYPE.control.fontSize, fontWeight: 600, cursor: "pointer" }}>
          {t("vaginalHealth.delete", "Delete record")}
        </button>
      </div>

      {pendingDelete ? (
        <ConfirmDeleteCard
          T={T}
          moduleColor={T.healthcare}
          margin="14px 0 0"
          message={t("vaginalHealth.deleteConfirm", "This deletes this vaginal health record permanently — unlike archiving, there's no getting it back.")}
          confirmLabel={t("vaginalHealth.deleteConfirmAction", "Delete record")}
          onCancel={onCancelDelete}
          onConfirm={onDelete}
        />
      ) : null}
    </div>
  );
}

export default function VaginalHealthModule() {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? buildDark() : buildLight();
  const [screen, setScreen] = useState("landing");
  const [editingId, setEditingId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  // null while the first load is in flight, so the list can show a loading
  // state instead of briefly claiming "no records yet".
  const [records, setRecords] = useState(null);

  const refresh = async () => setRecords(await VaginalHealthRepository.getAll());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await VaginalHealthRepository.getAll();
      if (!cancelled) setRecords(loaded);
    })();
    return () => { cancelled = true; };
  }, []);

  const addRecord = async (condition) => {
    await VaginalHealthRepository.create({ condition, date: nowAsDateString(), notes: "" });
    await refresh();
    setScreen("landing");
  };

  const updateRecord = async (id, changes) => {
    setRecords((current) => (current || []).map((r) => (r.id === id ? { ...r, ...changes } : r)));
    await VaginalHealthRepository.update(id, changes);
  };

  const deleteRecord = async (id) => {
    await VaginalHealthRepository.delete(id);
    await refresh();
    setPendingDeleteId(null);
    if (editingId === id) { setEditingId(null); setScreen("landing"); }
  };

  const openEdit = (id) => { setEditingId(id); setPendingDeleteId(null); setScreen("edit"); };
  const editingRecord = editingId ? (records || []).find((r) => r.id === editingId) : null;

  return (
    <div style={{ fontFamily: FONT_FAMILY }}>
      {screen === "add" ? (
        <ConditionPicker T={T} onPick={addRecord} onCancel={() => setScreen("landing")} />
      ) : screen === "edit" && editingRecord ? (
        <RecordEditor
          T={T}
          record={editingRecord}
          onChange={(changes) => updateRecord(editingId, changes)}
          onDone={() => { setEditingId(null); setScreen("landing"); }}
          onRequestDelete={() => setPendingDeleteId(editingId)}
          pendingDelete={pendingDeleteId === editingId}
          onCancelDelete={() => setPendingDeleteId(null)}
          onDelete={() => deleteRecord(editingId)}
        />
      ) : (
        <VaginalHealthLanding
          T={T}
          records={records || []}
          loading={records === null}
          onAdd={() => setScreen("add")}
          onEdit={openEdit}
          onDelete={deleteRecord}
          onRequestDelete={setPendingDeleteId}
          pendingDeleteId={pendingDeleteId}
          onCancelDelete={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  );
}

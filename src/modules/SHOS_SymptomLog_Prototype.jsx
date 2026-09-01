import React, { useState, useMemo, useEffect, useRef } from "react";
import { PlusIcon as Plus, CaretLeftIcon as ChevronLeft, CheckIcon as Check, ArchiveIcon as Archive, ArrowUUpLeftIcon as ArchiveRestore, ArrowsClockwiseIcon as RefreshCcw, TrashIcon as Trash2, XIcon as X } from "@phosphor-icons/react";
import { SymptomLogRepository, DEFAULT_SYMPTOM_ENTRY, SEVERITY_OPTIONS } from "../repositories/symptomLogRepository";
import { TrashRepository } from "../repositories/trashRepository";
import { exportRecordAsFile } from "../storage/recordExportService";
import { SymptomsRegistry } from "../registries/symptomsRegistry";
import { EncounterRepository } from "../repositories/encounterRepository";
import { TestingRepository } from "../repositories/testingRepository";
import { ContactRepository } from "../repositories/contactRepository";
import { saveDraft, loadDraft, clearDraft } from "../storage/draftStorage";
import { useEditUndo } from "../calculations/editUndoHelpers";
import { nowAsDateString } from "../calculations/dateInputHelpers";
import { fuzzyIncludes, findClosestMatch } from "../calculations/fuzzyMatch";
// CHANGED 20 Aug 2026 — real design-unification pass: values read
// from the shared designTokens.js source of truth instead of being
// retyped here, so this screen can't silently drift from every other
// module's "same" color/radius. See designTokens.js.
import { NEUTRAL, NEUTRAL_DARK, ACCENTS, ACTION, RADIUS, resolveDarkAccent } from "../calculations/designTokens";
import { useDarkModePreference } from "../calculations/darkModePreference";

// ADDED 19 Aug 2026 — Symptom Log (Symptoms Tracker in Notion — see
// symptomLogRepository.js's header for the deliberate naming decision
// avoiding confusion with the Symptoms Registry vocabulary). Same
// self-contained-module pattern, Healthcare blue, single Inter
// typeface throughout (JetBrains Mono retired 26 Aug 2026 — real ask
// for full font consistency, no more separate monospace stat font).
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

function severityColor(severity, T) {
  if (severity === "Severe") return T.actionRed;
  if (severity === "Moderate") return "#F59E0B";
  return T.textSecondary;
}

function SectionCard({ title, T, children }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: radius.md, background: T.surface, padding: "4px 14px 14px", marginTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.healthcareBlue, textTransform: "uppercase", letterSpacing: 0.5, paddingTop: 12, marginBottom: 2 }}>{title}</div>
      {children}
    </div>
  );
}

function TextField({ label, value, onChange, T, placeholder, type = "text" }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 12, color: T.textSecondary }}>{label}</div>
        {/* ADDED — real ask: "Now" quick-fill, device's real local date. */}
        {type === "date" && (
          <span onClick={() => onChange(nowAsDateString())} style={{ fontSize: 11, fontWeight: 700, color: T.healthcareBlue, cursor: "pointer" }}>Now</span>
        )}
      </div>
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
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

// Single-value picker over SymptomsRegistry — deliberately single, not
// a tag list: this entry already has its own free-text Title (what
// happened), Symptom here is "which vocabulary entry does this map
// to" — one real occurrence maps to one registry concept in every case
// The user's actual data suggests, same judgment already applied to
// Encounters' locationId.
// CHANGED — real bug from the user's own testing: this was a plain closed
// <select>, with no way to type a new entry — unlike every OTHER
// registry-backed picker in this app (Testing's Result picker,
// Contacts' Stated Kinks, etc.), all of which support typing +
// tap-suggestion + findOrCreate. Combined with SymptomsRegistry having
// zero seed entries, the dropdown had nothing to show AND no way to
// add anything — "shows no options, can't type" exactly. Rebuilt to
// match the same typing+suggestion+findOrCreate mechanics as Testing's
// RegistrySingleResultPicker, still single-value (one occurrence maps
// to one registry concept — that reasoning was correct, only the
// input mechanism was broken).
// CHANGED 26 Aug 2026 — real ask, decided (was backlogged, now
// built): support more than one symptom per entry. `value` is now an
// array (symptomIds), not a single id — same chip-removal and
// suggestion pattern as before, just multiple selections instead of
// one replacing the last.
// CHANGED — real ask: "auto recognise as typing begins and narrow down
// drop down searches... speed up searching through symptoms less
// commonly used". Two real bugs: `draft` was never actually used to
// filter suggestions at all (typing did nothing to the list — it just
// showed the same static first-8 the whole time), and matching was
// plain substring, so a common symptom's exact name would crowd out a
// less-common one a typo away from matching. Reuses fuzzyIncludes()
// (fuzzyMatch.js, already built for Global Search's own typo
// tolerance) rather than a second matching implementation, and adds a
// real "did you mean X?" check (findClosestMatch, same file) before
// creating a genuinely new entry — catches a likely typo before it
// becomes a near-duplicate registry entry instead of matching the one
// that already exists.
function SymptomSelect({ value, onChange, T }) {
  const [draft, setDraft] = useState("");
  const [didYouMean, setDidYouMean] = useState(null);
  const allEntries = SymptomsRegistry.getAll().filter((e) => !e.isArchived);
  const selectedNames = value.map((id) => ({ id, name: SymptomsRegistry.getById(id)?.name || "?" }));
  const draftTrimmed = draft.trim();
  const visibleSuggestions = (
    draftTrimmed
      ? allEntries.filter((e) => fuzzyIncludes(e.name, draftTrimmed))
      : allEntries
  ).filter((e) => !value.includes(e.id)).slice(0, 8);

  const remove = (id) => onChange(value.filter((v) => v !== id));
  const add = (id) => { if (!value.includes(id)) onChange([...value, id]); };

  const commit = () => {
    const raw = draft.trim();
    if (!raw || didYouMean) return;
    // A likely-typo match against an EXISTING entry (not already
    // selected) gets offered as a choice instead of silently creating
    // a near-duplicate — same reasoning KinkRegistry's own synonym
    // system already applies, just via edit-distance instead of a
    // fixed synonym list.
    const closest = findClosestMatch(allEntries.filter((e) => !value.includes(e.id)).map((e) => e.name), raw);
    if (closest) { setDidYouMean({ raw, closest }); return; }
    const entry = SymptomsRegistry.findOrCreate(raw);
    if (entry) add(entry.id);
    setDraft("");
  };
  const acceptDidYouMean = () => {
    const entry = SymptomsRegistry.findOrCreate(didYouMean.closest);
    if (entry) add(entry.id);
    setDraft("");
    setDidYouMean(null);
  };
  const dismissDidYouMean = () => {
    const entry = SymptomsRegistry.findOrCreate(didYouMean.raw);
    if (entry) add(entry.id);
    setDraft("");
    setDidYouMean(null);
  };

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Symptoms (registry) — e.g. dysuria + urethral discharge together</div>
      {selectedNames.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {selectedNames.map((s) => (
            <div key={s.id} onClick={() => remove(s.id)}
              style={{ padding: "4px 8px", borderRadius: radius.full, fontSize: 12, background: T.surfaceVariant, color: T.textPrimary, cursor: "pointer" }}>
              {s.name} ✕
            </div>
          ))}
        </div>
      )}
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {visibleSuggestions.map((e) => (
            <div key={e.id} onClick={() => add(e.id)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.healthcareBlue}`, color: T.healthcareBlue, cursor: "pointer" }}>
              {e.name}
            </div>
          ))}
        </div>
      )}
      <input value={draft} onChange={(ev) => setDraft(ev.target.value)}
        onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); commit(); } }}
        onBlur={commit}
        placeholder="Type to add or search"
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
      {didYouMean && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, padding: "8px 10px", borderRadius: radius.sm, background: T.surfaceVariant, fontSize: 12 }}>
          <span style={{ color: T.textSecondary, flex: 1 }}>Did you mean "<span style={{ fontWeight: 700, color: T.textPrimary }}>{didYouMean.closest}</span>", already in the registry?</span>
          <span onClick={acceptDidYouMean} style={{ color: T.healthcareBlue, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Use it</span>
          <span onClick={dismissDidYouMean} style={{ color: T.textDisabled, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>No, add "{didYouMean.raw}"</span>
        </div>
      )}
    </div>
  );
}

// Real relations, both ends now exist — the user's standing instruction.
// Multi-select tag pickers over Encounters/Tests, same visual pattern
// as Clinic Visits' own RelationPicker.
// CHANGED — real ask: "no search/text box option to find and link any
// not shown" — the chip list was hard-capped at 8 with no way to reach
// anything beyond that. Real search box now: empty shows the same
// top-8-most-recent chips as before (nothing lost for the common
// case), typing filters the FULL list by name match so anything not
// in that initial 8 is still reachable.
// CHANGED 1 Sep 2026 — real ask: "at most last 3 most recent should be
// suggested, else search (by name or attendees)." Default suggestion
// count tightened from 8 to 3; search now also matches an item's
// optional `searchText` (Related encounters passes attendee names
// through it — the encounters/tests memos below build it).
function RelationPicker({ label, value, onChange, T, items, placeholder }) {
  const [query, setQuery] = useState("");
  const queryLower = query.trim().toLowerCase();
  const available = items.filter((i) => !value.includes(i.id));
  const visibleSuggestions = queryLower
    ? available.filter((i) => i.name.toLowerCase().includes(queryLower) || (i.searchText || "").includes(queryLower)).slice(0, 8)
    : available.slice(0, 3);
  const nameFor = (id) => items.find((i) => i.id === id)?.name || "?";
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {value.map((id) => (
            <div key={id} onClick={() => onChange(value.filter((v) => v !== id))}
              style={{ padding: "4px 8px", borderRadius: radius.full, fontSize: 12, background: T.surfaceVariant, color: T.textPrimary, cursor: "pointer" }}>
              {nameFor(id)} ✕
            </div>
          ))}
        </div>
      )}
      {available.length > 0 && (
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search to find one not shown below…"
          style={{ width: "100%", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 12, boxSizing: "border-box", marginBottom: 6 }} />
      )}
      {visibleSuggestions.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {visibleSuggestions.map((i) => (
            <div key={i.id} onClick={() => { onChange([...value, i.id]); setQuery(""); }}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.healthcareBlue}`, color: T.healthcareBlue, cursor: "pointer" }}>
              + {i.name}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: T.textDisabled, fontStyle: "italic" }}>{placeholder}</div>
      )}
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

function EntrySheet({ entry, onSave, onClose, T }) {
  const isNew = !entry;
  const draftKey = `symptomLog_${entry?.id || "new"}`;
  const [form, setForm] = useState(() => {
    const draft = loadDraft(draftKey);
    if (draft) return draft.data;
    return entry ? { ...entry } : { ...DEFAULT_SYMPTOM_ENTRY, dateStarted: new Date().toISOString().slice(0, 10) };
  });
  // CHANGED — real bug fix, same as Encounters: fired on the very
  // first render too, immediately autosaving the pristine, untouched
  // default form the instant this sheet opened — so just opening and
  // closing it with zero real edits left a draft behind, later shown
  // as a false "Restored unsaved changes" prompt. Skips the initial
  // mount with a ref, only saves once the form has genuinely changed.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    saveDraft(draftKey, form);
  }, [form]);
  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  const canSave = form.title.trim().length > 0;
  // CHANGED — real ask: "suggestions shown oldest to newest, wrong way
  // round" — getAll() returns records in storage order (oldest first),
  // never sorted for display before. Newest first now, same "most
  // recent is most relevant" reasoning as every other suggestion list
  // in this app.
  // CHANGED 1 Sep 2026 — real ask: "search (by name or attendees)" for
  // Related encounters specifically — an encounter's own name is often
  // just a date/type, not memorable; who was there usually is. Each
  // encounter's attendee names now ride along as searchText, so typing
  // a contact's name finds it even though it isn't in the visible label.
  const contacts = useMemo(() => ContactRepository.getAll(), []);
  const encounters = useMemo(() => [...EncounterRepository.getAll()].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).map((e) => {
    const attendeeNames = (e.attendeeIds || []).map((id) => contacts.find((c) => c.id === id)?.nickname || contacts.find((c) => c.id === id)?.name).filter(Boolean);
    return { id: e.id, name: `${e.title || e.encounterType || "Encounter"} · ${formatDate(e.date)}`, searchText: attendeeNames.join(" ").toLowerCase() };
  }), [contacts]);
  const tests = useMemo(() => [...TestingRepository.getAll()].filter((t) => !t.isArchived).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).map((t) => ({ id: t.id, name: `${t.title || (t.testingFor || []).join("/") || "Test"} · ${formatDate(t.date)}` })), []);

  const doSave = () => {
    clearDraft(draftKey);
    onSave(form);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 210 }} onClick={onClose}>
      <div style={{ background: T.bg, width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }} onClick={(e) => e.stopPropagation()}>
        {/* CHANGED 26 Aug 2026 — real ask: forms should also have the
            module banner title. */}
        <div style={{ background: T.healthcareBlue, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 14px", flexShrink: 0, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 18, color: "#FFFFFF" }}>{isNew ? "Log symptom" : "Edit symptom entry"}</span>
          {/* ADDED 26 Aug 2026 — real gap found while adding the
              banner: this sheet had no visible close control at all,
              only closing via a backdrop tap. */}
          <X size={20} color="#FFFFFF" style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        <div style={{ overflowY: "auto", padding: "0 20px", flex: 1 }}>
          <TextField label="Title" value={form.title} onChange={set("title")} T={T} placeholder="e.g. Rash after chem session" />
          <SymptomSelect value={form.symptomIds} onChange={set("symptomIds")} T={T} />
          <SelectField label="Severity" value={form.severity} onChange={set("severity")} options={SEVERITY_OPTIONS} T={T} />
          <TextField label="Date started" value={form.dateStarted} onChange={set("dateStarted")} T={T} type="date" />
          <TextField label="Date resolved (leave blank if still active)" value={form.dateResolved} onChange={set("dateResolved")} T={T} type="date" />
          <RelationPicker label="Related encounters" value={form.relatedEncounterIds} onChange={set("relatedEncounterIds")} T={T} items={encounters} placeholder="No encounters logged yet" />
          <RelationPicker label="Related tests" value={form.relatedTestIds} onChange={set("relatedTestIds")} T={T} items={tests} placeholder="No tests logged yet" />
          <div style={{ padding: "8px 0 20px" }}>
            <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Notes</div>
            <textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} rows={3}
              style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
          </div>
        </div>
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
          <button onClick={() => canSave && doSave()} style={{ width: "100%", padding: 16, borderRadius: radius.full, border: "none", background: canSave ? T.healthcareBlue : T.textDisabled, color: "#FFFFFF", fontSize: 16, fontWeight: 700, cursor: canSave ? "pointer" : "default" }}>
            {isNew ? "Add entry" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EntryDetail({ entryId, onBack, onEdit, T, triggerDelete, refresh }) {
  const [entry, setEntry] = useState(() => SymptomLogRepository.getById(entryId));
  // ADDED — real ask: real delete, with a confirmation step, same
  // pattern already proven for Testing/Vaccinations.
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!entry) return null;
  const symptomNames = entry.symptomIds.map((id) => SymptomsRegistry.getById(id)?.name).filter(Boolean).join(", ");
  const encounterNames = entry.relatedEncounterIds.map((id) => {
    const e = EncounterRepository.getById(id);
    return e ? `${e.title || e.encounterType || "Encounter"} · ${formatDate(e.date)}` : null;
  }).filter(Boolean);
  const testNames = entry.relatedTestIds.map((id) => {
    const t = TestingRepository.getById(id);
    return t ? `${t.title || (t.testingFor || []).join("/") || "Test"} · ${formatDate(t.date)}` : null;
  }).filter(Boolean);
  const isActive = !entry.dateResolved;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onBack} />
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.healthcareBlue, cursor: "pointer" }} onClick={() => onEdit(entryId)}>Edit</span>
          <Trash2 size={17} color={T.actionRed} style={{ cursor: "pointer" }} onClick={() => setConfirmDelete(true)} />
        </div>
      </div>
      {confirmDelete && (
        <div style={{ margin: "0 16px 12px", padding: 12, borderRadius: radius.sm, border: `1px solid ${T.actionRed}`, background: `${T.actionRed}11` }}>
          <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 8 }}>
            This permanently deletes the record — unlike archiving, there's no getting it back. Only use this for a genuinely wrong entry.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: 10, borderRadius: 999, border: `1px solid ${T.border}`, background: "transparent", color: T.textSecondary, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => { triggerDelete([entry]); refresh(); onBack(); }} style={{ flex: 1, padding: 10, borderRadius: 999, border: "none", background: T.actionRed, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Delete permanently</button>
          </div>
        </div>
      )}
      <div style={{ padding: "0 16px 100px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: radius.full, background: isActive ? severityColor(entry.severity, T) : T.actionGreen, display: "inline-block" }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary }}>{entry.title}</span>
        </div>
        <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 20, fontFamily: "'Inter', sans-serif" }}>
          {isActive ? "Active" : `Resolved ${formatDate(entry.dateResolved)}`}
        </div>

        <SectionCard title="Overview" T={T}>
          <ReadRow label="Symptoms" value={symptomNames} T={T} />
          <ReadRow label="Severity" value={entry.severity} T={T} alert={entry.severity === "Severe"} />
          <ReadRow label="Started" value={formatDate(entry.dateStarted)} T={T} />
          <ReadRow label="Resolved" value={entry.dateResolved ? formatDate(entry.dateResolved) : ""} T={T} />
        </SectionCard>

        {(encounterNames.length > 0 || testNames.length > 0) && (
          <SectionCard title="Related records" T={T}>
            <ReadRow label="Encounters" value={encounterNames} T={T} />
            <ReadRow label="Tests" value={testNames} T={T} />
          </SectionCard>
        )}

        <SectionCard title="Notes" T={T}>
          <ReadRow label="Notes" value={entry.notes} T={T} />
        </SectionCard>
        {/* ADDED 26 Aug 2026 — real ask: last-updated indicator. */}
        {entry.updatedAt && (
          <div style={{ textAlign: "center", fontSize: 11, color: T.textDisabled, marginTop: 16 }}>
            Last updated {formatDate(entry.updatedAt)}
          </div>
        )}
      </div>
    </div>
  );
}

function SymptomLogLanding({ onOpen, onAdd, T, entries, refresh, deleteToast, undoDelete, redoDelete, triggerDelete }) {
  // ADDED 26 Aug 2026 — real ask: search within module, rolled out to
  // every module that didn't already have it. Applied before the
  // active/resolved split, so both sections respect it.
  const [query, setQuery] = useState("");
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => {
      const symptomNames = e.symptomIds.map((id) => SymptomsRegistry.getById(id)?.name).filter(Boolean);
      return [e.title, e.severity, ...symptomNames].filter(Boolean).some((v) => v.toLowerCase().includes(q));
    });
  }, [entries, query]);
  const active = useMemo(() => searched.filter((e) => !e.dateResolved).sort((a, b) => new Date(b.dateStarted || 0) - new Date(a.dateStarted || 0)), [searched]);
  const resolved = useMemo(() => searched.filter((e) => e.dateResolved).sort((a, b) => new Date(b.dateResolved) - new Date(a.dateResolved)), [searched]);
  // CHANGED 26 Aug 2026 — real bug fix: the section header counts
  // ("Active (X)", "Resolved (Y)") were computed from the
  // search-filtered list, so they'd misleadingly change while typing
  // a search instead of showing the true totals. Search should only
  // affect which entries are visible, never any actual count or
  // calculation — computed here from the real unfiltered entries
  // instead, kept separate from what actually renders.
  const activeCount = useMemo(() => entries.filter((e) => !e.dateResolved).length, [entries]);
  const resolvedCount = useMemo(() => entries.filter((e) => e.dateResolved).length, [entries]);
  // ADDED 26 Aug 2026 — real ask: long-press multi-select, rolled out
  // to every module.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const toggleSelected = (id) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds([]); };
  const pressTimer = useRef(null);
  // CHANGED — real ask: long-press for select/multiselect fired too
  // easily. 750ms (1.5x the original 500ms), same across every module
  // using this pattern.
  // ADDED — real bug the user flagged: resting a finger on a card
  // while scrolling (or scrolling slowly) still fired long-press — see
  // Contacts' own ContactCard for the full reasoning, same fix.
  const pressStartPos = useRef(null);
  const startPress = (id, evt) => {
    if (evt?.touches?.[0]) pressStartPos.current = { x: evt.touches[0].clientX, y: evt.touches[0].clientY };
    pressTimer.current = setTimeout(() => { setSelectMode(true); toggleSelected(id); }, 750);
  };
  const cancelPress = () => { clearTimeout(pressTimer.current); pressStartPos.current = null; };
  const handleTouchMove = (evt) => {
    if (!pressStartPos.current || !evt.touches?.[0]) return;
    const dx = evt.touches[0].clientX - pressStartPos.current.x;
    const dy = evt.touches[0].clientY - pressStartPos.current.y;
    if (Math.hypot(dx, dy) > 10) cancelPress();
  };
  // CHANGED 26 Aug 2026 — real gap found and fixed: entries/
  // deletedRecent/undoDelete/triggerDelete lifted to SymptomLogModule,
  // shared with EntryDetail.

  const Row = (e) => {
    const symptomName = e.symptomIds.map((id) => SymptomsRegistry.getById(id)?.name).filter(Boolean).join(", ");
    const isActive = !e.dateResolved;
    const isSelected = selectedIds.includes(e.id);
    return (
      <div key={e.id} onClick={() => selectMode ? toggleSelected(e.id) : onOpen(e.id)}
        onMouseDown={() => startPress(e.id)} onMouseUp={cancelPress} onMouseLeave={cancelPress} onTouchStart={(evt) => startPress(e.id, evt)} onTouchMove={handleTouchMove} onTouchEnd={cancelPress}
        style={{ background: isSelected ? `${T.healthcareBlue}10` : T.surface, border: `1px solid ${isSelected ? T.healthcareBlue : isActive && e.severity === "Severe" ? T.actionRed : T.border}`, borderRadius: radius.md, padding: 14, cursor: "pointer", marginBottom: 10, display: "flex", gap: 10 }}>
        {selectMode && (
          <div style={{ width: 22, height: 22, borderRadius: radius.full, border: `2px solid ${isSelected ? T.healthcareBlue : T.border}`, background: isSelected ? T.healthcareBlue : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, alignSelf: "center" }}>
            {isSelected && <Check size={13} color="#FFFFFF" />}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: radius.full, background: isActive ? severityColor(e.severity, T) : T.actionGreen, display: "inline-block" }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>{e.title}</span>
        </div>
        <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 16, marginTop: 2, fontFamily: "'Inter', sans-serif" }}>
          {symptomName ? `${symptomName} · ` : ""}{formatDate(e.dateStarted)}{e.severity ? ` · ${e.severity}` : ""}
        </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* CHANGED 26 Aug 2026 — real ask: this had the same full
          prominence as Healthcare's own title banner right above it —
          redundant, since this is always a sub-tab within Healthcare
          (the sub-tab pills already show which section is active),
          never a standalone top-level screen. Shrunk to a small
          subordinate label instead of a duplicate full banner, same
          fix already applied to Testing. */}
      {/* CHANGED — real bug fix, same as Testing's own: this stuck at
          top:0, colliding with Healthcare's own banner (also top:0)
          in the same shared scroll container, instead of stacking
          beneath it. top:62 matches Contacts' own established offset
          for a second sticky bar under an identical banner shape. */}
      <div style={{ position: "sticky", top: 62, zIndex: 6, background: T.bg, padding: "10px 16px 4px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.healthcareBlue, textTransform: "uppercase", letterSpacing: 0.5 }}>Symptom Log</span>
        {/* ADDED 26 Aug 2026 — real ask: explicit Select toggle. */}
        <span onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)} style={{ fontSize: 11, fontWeight: 700, color: T.healthcareBlue, cursor: "pointer" }}>
          {selectMode ? "Done" : "Select"}
        </span>
      </div>
      {/* ADDED 26 Aug 2026 — real ask: bulk action toolbar. */}
      {selectMode && (
        <div style={{ background: "#1B1B1F", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600 }}>{selectedIds.length} selected</span>
          <div style={{ display: "flex", gap: 16 }}>
            {/* ADDED 1 Sep 2026 — real ask: "option to select all...
                rather than manual 1 by 1", scoped to whatever's
                currently visible under the active search filter. */}
            <span onClick={() => { const visible = [...active, ...resolved].map((e) => e.id); setSelectedIds(selectedIds.length === visible.length ? [] : visible); }}
              style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600, cursor: "pointer" }}>
              {selectedIds.length === active.length + resolved.length ? "Deselect all" : "Select all"}
            </span>
            {/* ADDED 26 Aug 2026 — real ask: export/print a single
                record, enabled only when exactly one is selected. */}
            <span onClick={() => { if (selectedIds.length === 1) exportRecordAsFile("symptomLog", SymptomLogRepository.getById(selectedIds[0])); }}
              style={{ fontSize: 13, color: selectedIds.length === 1 ? "#FFFFFF" : "#6E6E74", fontWeight: 600, cursor: selectedIds.length === 1 ? "pointer" : "default" }}>Export</span>
            <span onClick={() => { if (selectedIds.length > 0) { SymptomLogRepository.bulkArchive(selectedIds); refresh(); exitSelectMode(); } }}
              style={{ fontSize: 13, color: selectedIds.length > 0 ? "#FFFFFF" : "#6E6E74", fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>Archive</span>
            <span onClick={() => {
              if (selectedIds.length === 0) return;
              if (window.confirm(`Delete ${selectedIds.length} entr${selectedIds.length > 1 ? "ies" : "y"}? You'll have a few seconds to undo.`)) {
                const toRestore = SymptomLogRepository.getAll().filter((e) => selectedIds.includes(e.id));
                triggerDelete(toRestore);
                refresh();
                exitSelectMode();
              }
            }} style={{ fontSize: 13, color: selectedIds.length > 0 ? DARK.actionRed : "#6E6E74", fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>Delete</span>
            <span onClick={exitSelectMode} style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600, cursor: "pointer" }}>Cancel</span>
          </div>
        </div>
      )}
      {/* CHANGED — same real fix as Vaccinations: floating bottom-right,
          module-colored, matching every other module's pattern. */}
      {/* ADDED 26 Aug 2026 — real ask: search within module. */}
      <div style={{ padding: "8px 16px 0" }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search symptom entries"
          style={{ width: "100%", padding: "8px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
      </div>
      {/* CHANGED 26 Aug 2026 — real audit finding: wrapped for
          wide-viewport centering, matching Medication's own pattern. */}
      <div style={{ position: "fixed", bottom: 90, left: 0, right: 0, maxWidth: 600, margin: "0 auto", display: "flex", justifyContent: "flex-end", padding: "0 20px", pointerEvents: "none" }}>
        <div onClick={onAdd} style={{ width: 56, height: 56, borderRadius: 999, background: T.healthcareBlue, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,.2)", pointerEvents: "auto" }}>
          <Plus size={24} />
        </div>
      </div>
      <div style={{ padding: "12px 16px 100px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Active ({activeCount})</div>
        {active.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 20px", color: T.textDisabled, fontSize: 13 }}>Nothing active. Tap + to log a symptom.</div>
        ) : active.map(Row)}

        {resolved.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, margin: "16px 0 6px" }}>Resolved ({resolvedCount})</div>
            {resolved.map(Row)}
          </>
        )}
      </div>
      {/* ADDED 26 Aug 2026 — real ask: undo for delete. */}
      {deleteToast && (
        <div onClick={deleteToast.mode === "undo" ? undoDelete : redoDelete}
          style={{ position: "fixed", bottom: 90, left: 20, right: 20, maxWidth: 560, margin: "0 auto", background: "#1B1B1F", color: "#FFFFFF", padding: "12px 16px", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", zIndex: 40, boxShadow: "0 4px 16px rgba(0,0,0,.3)" }}>
          <span style={{ fontSize: 13 }}>
            {deleteToast.mode === "undo"
              ? `${deleteToast.records.length} entr${deleteToast.records.length > 1 ? "ies" : "y"} deleted`
              : `${deleteToast.records.length} entr${deleteToast.records.length > 1 ? "ies" : "y"} restored`}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.healthcareBlue }}>
            {deleteToast.mode === "undo" ? "Tap to undo" : "Tap to redo"}
          </span>
        </div>
      )}
    </div>
  );
}

export default function SymptomLogModule({ openAddOnMount = false, onConsumedQuickAdd, openRecordId, onConsumedRecordOpen, onDataChanged, registerModuleBackHandler } = {}) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : LIGHT;
  const [screen, setScreen] = useState({ name: "list" });
  // CHANGED 26 Aug 2026 — real gap found and fixed: lifted from
  // SymptomLogLanding — entries/deletedRecent/undoDelete/triggerDelete
  // now live at the real module level, shared with EntryDetail.
  const [entries, setEntries] = useState(() => SymptomLogRepository.getAll().filter((e) => !e.isArchived));
  const refresh = () => setEntries(SymptomLogRepository.getAll().filter((e) => !e.isArchived));
  // CHANGED 26 Aug 2026 — real ask, previously flagged low-priority and
  // now built: redo for delete, matching Contacts' reference
  // implementation.
  const [deleteToast, setDeleteToast] = useState(null); // { mode: "undo" | "redo", records }
  const undoTimerRef = useRef(null);
  const undoDelete = () => {
    if (!deleteToast) return;
    deleteToast.records.forEach((record) => SymptomLogRepository.restore(record));
    refresh();
    clearTimeout(undoTimerRef.current);
    setDeleteToast({ mode: "redo", records: deleteToast.records });
    undoTimerRef.current = setTimeout(() => setDeleteToast(null), 8000);
  };
  const redoDelete = () => {
    if (!deleteToast) return;
    TrashRepository.add("symptomLog", deleteToast.records);
    deleteToast.records.forEach((r) => SymptomLogRepository.delete(r.id));
    refresh();
    setDeleteToast(null);
    clearTimeout(undoTimerRef.current);
  };
  const triggerDelete = (records) => {
    TrashRepository.add("symptomLog", records);
    records.forEach((r) => SymptomLogRepository.delete(r.id));
    setDeleteToast({ mode: "undo", records });
    clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setDeleteToast(null), 8000);
  };
  // ADDED 19 Aug 2026 — real undo/redo extension.
  const editUndo = useEditUndo(SymptomLogRepository, onDataChanged);

  useEffect(() => {
    if (openAddOnMount) {
      setScreen({ name: "add" });
      onConsumedQuickAdd?.();
    }
    // ADDED — real ask: Global Search deep-link, same pattern as Testing.
    if (openRecordId) {
      setScreen({ name: "detail", id: openRecordId });
      onConsumedRecordOpen?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backToList = () => setScreen({ name: "list" });

  // ADDED 26 Aug 2026 — real ask: back should go one step within this
  // module. Symptom Log's screen shape differs from Testing/Clinic
  // Visits (list/detail/edit/add, with "add" as its own distinct
  // screen rather than "edit" with a null id) — matched to its own
  // real onClose behavior, not copy-pasted blindly.
  useEffect(() => {
    if (!registerModuleBackHandler) return;
    registerModuleBackHandler(() => {
      if (screen.name === "add") { setScreen({ name: "list" }); return true; }
      if (screen.name === "edit") { setScreen({ name: "detail", id: screen.id }); return true; }
      if (screen.name === "detail") { setScreen({ name: "list" }); return true; }
      return false;
    });
    return () => registerModuleBackHandler(null);
  }, [screen, registerModuleBackHandler]);

  // CHANGED 26 Aug 2026 — real bug fix: Healthcare's "Active symptoms"
  // stat only ever computed once on mount, so resolving a symptom (or
  // adding a new one) here didn't update it until you left and
  // re-entered Healthcare. onDataChanged notifies the parent to
  // recompute immediately instead.
  const createEntry = (data) => { SymptomLogRepository.create(data); onDataChanged?.(); backToList(); };
  const saveEntry = (data) => {
    editUndo.captureBeforeEdit(screen.id);
    SymptomLogRepository.update(screen.id, data);
    editUndo.notifyEdited(screen.id);
    onDataChanged?.();
    setScreen({ name: "detail", id: screen.id });
  };

  let content;
  if (screen.name === "list") content = <SymptomLogLanding T={T} onOpen={(id) => setScreen({ name: "detail", id })} onAdd={() => setScreen({ name: "add" })} entries={entries} refresh={refresh} deleteToast={deleteToast} undoDelete={undoDelete} redoDelete={redoDelete} triggerDelete={triggerDelete} />;
  else if (screen.name === "detail") content = <EntryDetail T={T} entryId={screen.id} onBack={backToList} onEdit={(id) => setScreen({ name: "edit", id })} triggerDelete={triggerDelete} refresh={refresh} />;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: T.bg, minHeight: "100vh" }}>
      {/* ADDED 19 Aug 2026 — real undo/redo toast, same pattern as
          every other module. */}
      {/* CHANGED — real ask: this sat at top:12, directly on top of
          the screen's own back button — the instinctive "do the edit,
          then tap back" motion hit the toast instead. top:64 clears
          every header shape in this app. */}
      {editUndo.toast && (
        <div onClick={editUndo.toast.mode === "undo" ? editUndo.undo : editUndo.redo}
          style={{ position: "fixed", top: 64, left: "50%", transform: "translateX(-50%)", width: 340, background: editUndo.toast.mode === "undo" ? "#1B1B1F" : LIGHT.healthcareBlue, color: "#FFFFFF", borderRadius: 999, padding: "10px 16px", fontSize: 13, fontWeight: 600, textAlign: "center", cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,.25)", zIndex: 230, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {editUndo.toast.mode === "undo" ? <Check size={14} /> : <RefreshCcw size={14} />}
          {editUndo.toast.mode === "undo" ? "Entry updated — tap to undo" : "Undone — tap to redo"}
        </div>
      )}
      {content}
      {screen.name === "add" && <EntrySheet T={T} entry={null} onSave={createEntry} onClose={backToList} />}
      {screen.name === "edit" && <EntrySheet T={T} entry={SymptomLogRepository.getById(screen.id)} onSave={saveEntry} onClose={() => setScreen({ name: "detail", id: screen.id })} />}
    </div>
  );
}

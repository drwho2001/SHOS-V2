import React, { useState, useMemo, useEffect, useRef } from "react";
import { PlusIcon as Plus, CaretLeftIcon as ChevronLeft, CheckIcon as Check, PaperclipIcon as Paperclip, UploadSimpleIcon as Upload, TrashIcon as Trash2, CalendarIcon as Calendar, ArrowsClockwiseIcon as RefreshCcw, XIcon as X, CrosshairIcon as Crosshair } from "@phosphor-icons/react";
// ADDED — real ask: "use current location" on Clinic Visits, the last
// of the three modules with a location-ish field (Contacts/Encounters
// already have it) — same Nominatim reverse-geocode service, no second
// provider introduced.
import { getCurrentLocationPlace, summarizePlaceName } from "../storage/locationService";
import { useEditUndo } from "../calculations/editUndoHelpers";
import { nowAsDateString, nowAsDateTimeLocalString } from "../calculations/dateInputHelpers";
import {
  ClinicVisitsRepository, DEFAULT_CLINIC_VISIT, generateAdHocMedId,
  CLINICIAN_OPTIONS,
} from "../repositories/clinicVisitsRepository";
import { TrashRepository } from "../repositories/trashRepository";
import { exportRecordAsFile } from "../storage/recordExportService";
// ADDED 19 Aug 2026 — REASON_FOR_VISIT_OPTIONS/FOLLOW_UP_TYPE_OPTIONS
// now live here, real in-app editable option lists.
import { CustomOptionListsRepository } from "../repositories/customOptionListsRepository";
import { fuzzyIncludes, findClosestMatch } from "../calculations/fuzzyMatch";
import { TestingRepository } from "../repositories/testingRepository";
import { MedicationRepository } from "../repositories/medicationRepository";
import { SymptomsRegistry } from "../registries/symptomsRegistry";
import { SymptomLogRepository } from "../repositories/symptomLogRepository";
import { VaccinationRepository } from "../repositories/vaccinationRepository";
import { ResultsRegistry } from "../registries/resultsRegistry";
// ADDED — Measurements inline entry point: "add measurement to clinic
// forms" per the design's "one room, three doors" — a Clinic Visit can
// create a real linked Measurement without duplicating any of its own
// fields for it. See measurementRepository.js's own comment.
import { MeasurementRepository } from "../repositories/measurementRepository";
import { InlineMeasurementSheet } from "./SHOS_Measurements_Prototype";
// ADDED 19 Aug 2026 — draft autosave, same pattern as every other
// edit sheet this round.
import { saveDraft, loadDraft, clearDraft } from "../storage/draftStorage";
// ADDED — real ask: reminders for a booked appointment, re-synced
// right after this module's own save (see syncTestingReminder's
// analogous comment in Testing for the same pattern).
import { syncClinicVisitReminders } from "../calculations/clinicVisitReminderSync";
import { syncClinicVisitsToCalendar } from "../storage/calendarSyncService";
// CHANGED 20 Aug 2026 — real design-unification pass: values read
// from the shared designTokens.js source of truth instead of being
// retyped here, so this screen can't silently drift from every other
// module's "same" color/radius. See designTokens.js.
import { NEUTRAL, NEUTRAL_DARK, ACCENTS, ACTION, RADIUS, TYPE, resolveDarkAccent } from "../calculations/designTokens";
import { useDarkModePreference } from "../calculations/darkModePreference";

// Same Healthcare blue + font conventions as Testing — applied from
// creation, not retrofitted, per the user's standing instruction.
const LIGHT = {
  ...NEUTRAL,
  healthcareBlue: ACCENTS.healthcare, actionRed: ACTION.red, actionGreen: ACTION.green,
};
// Dark mode, on Medication's DARK basis — see Contacts' own comment
// for the full reasoning (same pattern, reused everywhere). CHANGED —
// real architecture fix: resolveDarkAccent() keeps today's exact
// behaviour by default, only brightening once a real colour override
// exists.
const DARK = {
  ...NEUTRAL_DARK,
  healthcareBlue: resolveDarkAccent("healthcare", ACCENTS.healthcare, "#0E8144"), actionRed: resolveDarkAccent("actionRed", ACTION.red, "#FF7A7E"), actionGreen: resolveDarkAccent("actionGreen", ACTION.green, "#5FD9A4"),
};
const radius = RADIUS;

function formatDate(iso) {
  if (!iso) return "—";
  // timeZone: "UTC" reads the stored digits back literally rather than
  // applying a real timezone shift — this app's stored dates are a
  // deliberate "Z"-suffixed lie (see dateInputHelpers.js), not real
  // UTC, so a plain toLocaleDateString() would shift the displayed
  // time by the device's UTC offset (0 in GMT, 1h in BST).
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

// ADDED 26 Aug 2026 — the main visit date now genuinely carries a
// time (see DateTimeField), so its own read-only display should show
// it — every other date on this record (nextReviewDate etc.) stays
// date-only via formatDate above, unchanged.
function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  // timeZone: "UTC" on both calls — see formatDate's comment above.
  // Fixed 3 Sep 2026: this was previously missing here, causing a
  // booked appointment's displayed time to read up to an hour later
  // than what was actually entered (the same bug already fixed for
  // Medication's dose times).
  return `${d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: "UTC" })}`;
}

function SectionCard({ title, T, children }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: radius.md, background: T.surface, padding: "4px 14px 14px", marginTop: 14 }}>
      <div style={{ ...TYPE.sectionLabel, color: T.healthcareBlue, paddingTop: 12, marginBottom: 2 }}>{title}</div>
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
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
    </div>
  );
}

// ADDED 26 Aug 2026 — real gap found while building Home's "Next
// clinic visit" exact-time display: Clinic Visits never had a time
// field at all, only date. Same safe pattern as Encounters'
// DateTimeField — pure string manipulation, no Date object parsing
// anywhere, per the user's standing rule that a typed time must never
// shift for BST/UTC/DST after the fact.
function DateTimeField({ label, value, onChange, T }) {
  const inputVal = value ? value.slice(0, 16) : "";
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 12, color: T.textSecondary }}>{label}</div>
        <span onClick={() => onChange(`${nowAsDateTimeLocalString()}:00.000Z`)} style={{ fontSize: 11, fontWeight: 700, color: T.healthcareBlue, cursor: "pointer" }}>Now</span>
      </div>
      <input type="datetime-local" value={inputVal}
        onChange={(e) => onChange(e.target.value ? `${e.target.value}:00.000Z` : "")}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
    </div>
  );
}

function SelectField({ label, value, onChange, options, T }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} aria-label={label}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }}>
        <option value="">—</option>
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}

function MultiSelectChips({ label, value, onChange, options, T }) {
  const toggle = (opt) => { const has = value.includes(opt); onChange(has ? value.filter((v) => v !== opt) : [...value, opt]); };
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map((opt) => {
          const active = value.includes(opt);
          return (
            <div key={opt} onClick={() => toggle(opt)} role="button" tabIndex={0} aria-pressed={active}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(opt); } }}
              style={{ padding: "5px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? T.healthcareBlue : T.border}`, color: active ? T.healthcareBlue : T.textSecondary, background: active ? `${T.healthcareBlue}15` : "transparent" }}>
              {opt}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ToggleSwitch({ value, onChange, T }) {
  return (
    <div onClick={() => onChange(!value)} style={{ width: 40, height: 24, borderRadius: radius.full, background: value ? T.healthcareBlue : T.surfaceVariant, position: "relative", cursor: "pointer", transition: "background 150ms ease" }}>
      <div style={{ position: "absolute", top: 2, left: value ? 18 : 2, width: 20, height: 20, borderRadius: radius.full, background: "#FFFFFF", transition: "left 150ms ease", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
    </div>
  );
}

function ReadRow({ label, value, T }) {
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) return null;
  const display = Array.isArray(value) ? value.join(", ") : String(value);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 12, color: T.textSecondary, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: T.textPrimary, fontWeight: 500, textAlign: "right" }}>{display}</span>
    </div>
  );
}

// Real relations, all resolved through actual repositories/registries
// — Testing, Medication, Symptoms Registry, Results Registry all exist.
// CHANGED — real ask (found the identical pattern/bug already fixed in
// Symptom Log's own copy of this component): "no search/text box
// option to find and link any not shown" — the chip list was hard-
// capped at 8 with no way to reach anything beyond that. Real search
// box now: empty shows the same top-8 chips as before (nothing lost
// for the common case), typing filters the FULL list by name match.
// CHANGED 1 Sep 2026 — real ask: "at most last 3 most recent should be
// suggested, else search." Default suggestion count tightened from 8
// to 3 — search (unchanged, matches by name) is how anything past
// that gets found, same spec applied to every suggestion picker like
// this one this session.
function RelationPicker({ label, value, onChange, T, items, placeholder }) {
  const [query, setQuery] = useState("");
  const queryLower = query.trim().toLowerCase();
  const available = items.filter((i) => !value.includes(i.id));
  const visibleSuggestions = queryLower
    ? available.filter((i) => i.name.toLowerCase().includes(queryLower)).slice(0, 8)
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

// CHANGED — real ask: "allow for more than one." Was single free-text,
// now a real multi-select tag picker — same underlying suggestion-chip
// mechanism, just adds to an array instead of replacing one value.
function getKnownClinicians() {
  const typed = ClinicVisitsRepository.getAll().flatMap((v) => v.clinician || []).filter(Boolean);
  return Array.from(new Set([...CLINICIAN_OPTIONS, ...typed]));
}
function ClinicianField({ value, onChange, T }) {
  const known = useMemo(() => getKnownClinicians(), []);
  const [draft, setDraft] = useState("");
  // CHANGED — same static-suggestions-never-narrow bug fixed elsewhere
  // this session: typing used to do nothing to the chip list at all.
  const visibleSuggestions = (draft.trim() ? known.filter((c) => fuzzyIncludes(c, draft)) : known)
    .filter((c) => !value.includes(c)).slice(0, 8);
  // ADDED — "did you mean X?" before adding a genuinely new clinician
  // name, so a typo doesn't quietly split one real clinician into two
  // near-identical suggestion entries going forward.
  const [pendingSuggestion, setPendingSuggestion] = useState(null);
  const addClinician = (name) => {
    const trimmed = name.trim();
    // CHANGED — was a case-SENSITIVE `value.includes(trimmed)` check, so
    // re-typing a clinician's name in different casing (e.g. "dr smith"
    // when "Dr Smith" is already on this visit) slipped past it, then
    // also past findClosestMatch below (which returns null on an exact
    // case-insensitive match — see fuzzyMatch.js), landing as a silent
    // duplicate clinician entry on the same visit.
    if (!trimmed || value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) { setDraft(""); return; }
    const match = findClosestMatch([...known, ...value], trimmed);
    if (match) {
      setPendingSuggestion({ typedAs: trimmed, suggestion: match });
      setDraft("");
      return;
    }
    onChange([...value, trimmed]);
    setDraft("");
  };
  const removeClinician = (name) => onChange(value.filter((c) => c !== name));
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Clinician(s) (optional)</div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {value.map((c) => (
            <div key={c} onClick={() => removeClinician(c)}
              style={{ padding: "4px 8px", borderRadius: radius.full, fontSize: 12, background: T.surfaceVariant, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              {c} <X size={11} />
            </div>
          ))}
        </div>
      )}
      {pendingSuggestion && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 10px", borderRadius: radius.sm, background: `${T.healthcareBlue}15`, border: `1px solid ${T.healthcareBlue}`, marginBottom: 6, fontSize: 12 }}>
          <span style={{ color: T.textPrimary }}>Did you mean "{pendingSuggestion.suggestion}"? You typed "{pendingSuggestion.typedAs}".</span>
          <div onMouseDown={(ev) => ev.preventDefault()} onClick={() => { if (!value.includes(pendingSuggestion.suggestion)) onChange([...value, pendingSuggestion.suggestion]); setPendingSuggestion(null); }}
            style={{ fontWeight: 700, color: T.healthcareBlue, cursor: "pointer" }}>Yes, use it</div>
          <div onMouseDown={(ev) => ev.preventDefault()} onClick={() => { onChange([...value, pendingSuggestion.typedAs]); setPendingSuggestion(null); }}
            style={{ fontWeight: 700, color: T.textSecondary, cursor: "pointer" }}>No, add as new</div>
        </div>
      )}
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {visibleSuggestions.map((c) => (
            <div key={c} onMouseDown={(ev) => ev.preventDefault()} onClick={() => addClinician(c)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.healthcareBlue}`, color: T.healthcareBlue, cursor: "pointer" }}>
              {c}
            </div>
          ))}
        </div>
      )}
      <input value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addClinician(draft); } }}
        onBlur={() => addClinician(draft)}
        placeholder="e.g. Lucy — leave blank if unknown"
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
    </div>
  );
}

// ADDED — real ask: "Include location on card if known" — same real
// free-text-plus-suggestions pattern as Clinician above, not a full
// Locations Repository relation (Encounters' own, heavier system) —
// this is just naming which clinic, not a place with its own address/
// notes/related-contact concept.
function getKnownClinicVisitLocations() {
  const typed = ClinicVisitsRepository.getAll().map((v) => v.location).filter(Boolean);
  return Array.from(new Set(typed));
}
function ClinicVisitLocationField({ value, onChange, T }) {
  const known = useMemo(() => getKnownClinicVisitLocations(), []);
  // CHANGED — same real ask as Encounters' Location field this session:
  // narrow to real matches once typing begins, instead of showing the
  // same static list of every known location regardless of input.
  const typed = (value || "").trim();
  const visibleSuggestions = (typed ? known.filter((l) => fuzzyIncludes(l, typed)) : known)
    .filter((l) => l !== value).slice(0, 8);
  // ADDED — real ask: "use current location", same pattern as
  // Encounters' own RegistrySinglePicker locate button — this field is
  // just a plain string (see the comment above getKnownClinicVisitLocations
  // for why it's not a full Locations Repository relation), so a
  // located place just calls onChange(name) directly, no registry
  // findOrCreate() needed.
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");
  const useCurrentLocation = async () => {
    setLocating(true);
    setLocateError("");
    try {
      const place = await getCurrentLocationPlace();
      onChange(summarizePlaceName(place));
    } catch (err) {
      setLocateError(err.message);
    } finally {
      setLocating(false);
    }
  };
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 12, color: T.textSecondary }}>Location (optional)</div>
        <span onClick={locating ? undefined : useCurrentLocation}
          style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: T.healthcareBlue, cursor: locating ? "default" : "pointer", opacity: locating ? 0.6 : 1 }}>
          <Crosshair size={12} weight="bold" /> {locating ? "Locating…" : "Use current location"}
        </span>
      </div>
      {locateError && <div style={{ fontSize: 11, color: T.actionRed, marginBottom: 4 }}>{locateError}</div>}
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {visibleSuggestions.map((l) => (
            <div key={l} onClick={() => onChange(l)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.healthcareBlue}`, color: T.healthcareBlue, cursor: "pointer" }}>
              {l}
            </div>
          ))}
        </div>
      )}
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="e.g. Conifer Sexual Health Clinic — leave blank if unknown"
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
    </div>
  );
}

// ADDED 19 Aug 2026 — real feedback batch: "'Future appointment'
// should read as an explicit yes/no question", not a bare toggle with
// a one-word label that leaves what "on" means to context. Same
// underlying boolean, just an unambiguous either/or.
function YesNoQuestion({ question, value, onChange, T }) {
  return (
    <div style={{ padding: "10px 0" }}>
      <div style={{ fontSize: 13, color: T.textPrimary, marginBottom: 6 }}>{question}</div>
      <div style={{ display: "flex", gap: 8 }}>
        {[{ label: "Yes", val: true }, { label: "No", val: false }].map((opt) => (
          <div key={opt.label} onClick={() => onChange(opt.val)}
            style={{ flex: 1, textAlign: "center", padding: "8px 0", borderRadius: radius.sm, cursor: "pointer", fontSize: 13, fontWeight: 700, border: `1px solid ${value === opt.val ? T.healthcareBlue : T.border}`, background: value === opt.val ? `${T.healthcareBlue}15` : "transparent", color: value === opt.val ? T.healthcareBlue : T.textSecondary }}>
            {opt.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ADDED 19 Aug 2026 — real feedback batch: medications given in-clinic
// that aren't in the user's personal Medication tracker — a simple
// add/remove list of free-text {name, notes} entries, distinct from
// the registry-linked RelationPicker used for medicationsGivenIds.
function AdHocMedicationsManager({ value, onChange, T }) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onChange([...value, { id: generateAdHocMedId(), name: trimmed, notes: notes.trim() }]);
    setName(""); setNotes("");
  };
  const remove = (id) => onChange(value.filter((m) => m.id !== id));
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Other medications given (not in your Medication tracker)</div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          {value.map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: radius.sm, background: T.surfaceVariant }}>
              <div style={{ minWidth: 0, overflowWrap: "break-word" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>{m.name}</div>
                {m.notes && <div style={{ fontSize: 11, color: T.textSecondary }}>{m.notes}</div>}
              </div>
              <X size={14} color={T.actionRed} style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => remove(m.id)} aria-label="Remove medication" title="Remove medication" />
            </div>
          ))}
        </div>
      )}
      {/* FIXED — real device bug: "other medications given runs off
          screen". Two side-by-side text inputs plus an Add button, in
          one flex row with no min-width override, exceeded a real
          phone's screen width — native inputs default to an intrinsic
          minimum width that flex's own default (`min-width: auto`)
          never overrides on its own. Name/Notes now stack full-width
          (matching every other text field in this app), Add sits
          below rather than fighting them for horizontal space. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ceftriaxone 1g IM"
          style={{ width: "100%", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontSize: 13, boxSizing: "border-box" }} />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)"
          style={{ width: "100%", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontSize: 13, boxSizing: "border-box" }} />
        <div onClick={add} style={{ padding: "8px 12px", borderRadius: radius.sm, background: T.healthcareBlue, color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "center" }}>Add</div>
      </div>
    </div>
  );
}

// ADDED 19 Aug 2026 — real feedback batch: "linked tests should be
// either pickable from existing Tests, or startable here with just a
// name and continued properly in Testing later." Creates a real,
// minimal Test record (title + this visit's date) via the actual
// TestingRepository, links it immediately, same honest "switches to
// the right module, not a deep-link to the exact record" scope limit
// already used everywhere else cross-module linking happens in this
// app — there's no plumbing anywhere yet for opening one specific
// record from outside its own module.
function StartTestInline({ visitDate, onCreated, T }) {
  const [name, setName] = useState("");
  const [showInput, setShowInput] = useState(false);
  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const test = TestingRepository.create({ title: trimmed, date: visitDate || new Date().toISOString() });
    onCreated(test.id);
    setName(""); setShowInput(false);
  };
  if (!showInput) {
    return (
      <div onClick={() => setShowInput(true)} style={{ fontSize: 11, color: T.healthcareBlue, fontWeight: 600, cursor: "pointer", marginTop: 4 }}>
        + Start a new test here
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Test name — continue details in Testing"
        onKeyDown={(e) => { if (e.key === "Enter") create(); }}
        style={{ flex: 1, padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontSize: 13 }} />
      <div onClick={create} style={{ padding: "8px 12px", borderRadius: radius.sm, background: T.healthcareBlue, color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Start</div>
    </div>
  );
}

function AttachmentManager({ visitId, attachments, onChanged, T }) {
  const inputRef = useRef(null);
  const [pendingType, setPendingType] = useState("Other");
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      ClinicVisitsRepository.addAttachment(visitId, { title: file.name, type: pendingType, fileDataUrl: reader.result });
      onChanged();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  const remove = (id) => { ClinicVisitsRepository.removeAttachment(visitId, id); onChanged(); };
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>Attachments</div>
      {attachments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {attachments.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: radius.sm, background: T.surfaceVariant }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <Paperclip size={13} color={T.textSecondary} />
                <div style={{ fontSize: 12, color: T.textPrimary, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.title}</div>
              </div>
              <Trash2 size={14} color={T.actionRed} style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => remove(a.id)} aria-label="Remove attachment" title="Remove attachment" />
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <select value={pendingType} onChange={(e) => setPendingType(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, fontSize: 12 }}>
          {["Test result", "Prescription", "ID", "Photo", "Other"].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, color: T.textPrimary, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          <Upload size={13} /> Add file
          <input ref={inputRef} type="file" onChange={handleFile} style={{ display: "none" }} />
        </label>
      </div>
    </div>
  );
}

// ── Add/Edit sheet ──
function VisitEditSheet({ visitId, prefillData, onClose, onSaved, onBeforeEdit, onAfterEdit, T }) {
  const isNew = !visitId;
  const existing = visitId ? ClinicVisitsRepository.getById(visitId) : null;
  // ADDED 19 Aug 2026 — real in-app editable option lists.
  // getRanked, not get: suggestion chips surface newly-added and
  // most-frequently-picked options first (real ask, 3 Sep 2026) — see
  // customOptionListsRepository.js's own comment on the two methods.
  const reasonForVisitOptions = useMemo(() => CustomOptionListsRepository.getRanked("reasonForVisit"), []);
  const followUpTypeOptions = useMemo(() => CustomOptionListsRepository.getRanked("followUpType"), []);
  // ADDED 19 Aug 2026 — draft autosave.
  const draftKey = `visitEdit_${visitId || "new"}`;
  const [form, setForm] = useState(() => {
    const draft = loadDraft(draftKey);
    if (draft) return draft.data;
    // ADDED — real ask: Clinic Card's "Book appointment"/"Treatment
    // given" shortcuts — a real new record starting with real values.
    return existing || { ...DEFAULT_CLINIC_VISIT, ...prefillData };
  });
  const [draftRestored] = useState(() => !!loadDraft(draftKey));
  const [refreshKey, setRefreshKey] = useState(0);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);
  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  const canSave = form.title.trim().length > 0;

  // CHANGED — real ask: "suggestions shown oldest to newest, wrong way
  // round... same with latest tests" — getAll() returns storage order
  // (oldest first), never sorted for display before.
  const allTests = useMemo(() => [...TestingRepository.getAll()].filter((t) => !t.isArchived).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).map((t) => ({ id: t.id, name: t.title || "Untitled test" })), [refreshKey]);
  const allMeds = useMemo(() => MedicationRepository.getAll().filter((m) => !m.isArchived).map((m) => ({ id: m.id, name: m.name })), []);
  const allSymptoms = useMemo(() => SymptomsRegistry.getAll().filter((s) => !s.isArchived), []);
  // ADDED 19 Aug 2026 — real feedback batch: "pulling from recent"
  // symptoms means suggesting real Symptom Log occurrences, not just
  // the vocabulary. Recent-first ordering.
  const allSymptomLogEntries = useMemo(
    () => SymptomLogRepository.getAll().filter((s) => !s.isArchived).sort((a, b) => new Date(b.dateStarted || 0) - new Date(a.dateStarted || 0))
      .map((s) => ({ id: s.id, name: `${s.title || "Symptom entry"} · ${formatDate(s.dateStarted)}` })),
    []
  );
  const allVaccinations = useMemo(
    () => VaccinationRepository.getAll().filter((v) => !v.isArchived).map((v) => ({ id: v.id, name: `${v.title || v.vaccine || "Vaccination"} · ${formatDate(v.date)}` })),
    []
  );

  const save = () => {
    clearDraft(draftKey);
    if (isNew) {
      const created = ClinicVisitsRepository.create(form);
      // ADDED — real ask: reminders for an actual booked appointment.
      // A brand-new visit could itself be the soonest one now, or
      // could displace/cancel-out a stale prior schedule — either way
      // this needs re-syncing on every save, not just once on Home
      // mount.
      syncClinicVisitReminders();
      // ADDED — real ask: calendar sync, self-gated inside on whether
      // the feature is actually turned on.
      syncClinicVisitsToCalendar(ClinicVisitsRepository.getAll());
      onSaved(created.id);
    } else {
      // ADDED 19 Aug 2026 — real undo/redo extension, same shared
      // mechanism as every other module.
      onBeforeEdit?.(visitId);
      ClinicVisitsRepository.update(visitId, form);
      onAfterEdit?.(visitId);
      syncClinicVisitReminders();
      syncClinicVisitsToCalendar(ClinicVisitsRepository.getAll());
      onSaved(visitId);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: T.bg, zIndex: 200, overflowY: "auto" }}>
      {/* CHANGED 26 Aug 2026 — real ask: forms should also have the
          module banner title. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", position: "sticky", top: 0, background: T.healthcareBlue, zIndex: 1 }}>
        <ChevronLeft size={22} color="#FFFFFF" style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF" }}>{isNew ? "New visit" : "Edit visit"}</span>
        <div onClick={() => canSave && save()}
          style={{ padding: "6px 14px", borderRadius: radius.full, background: canSave ? "#FFFFFF" : "rgba(255,255,255,0.3)", color: canSave ? T.healthcareBlue : "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700, cursor: canSave ? "pointer" : "default" }}>
          Save
        </div>
      </div>

      {draftRestored && (
        <div style={{ margin: "10px 16px 0", fontSize: 11, color: T.actionGreen, background: `${T.actionGreen}15`, borderRadius: radius.sm, padding: "6px 10px" }}>
          Restored unsaved changes from earlier.
        </div>
      )}

      <div style={{ padding: "0 16px 100px" }}>
        <SectionCard title="Overview" T={T}>
          <TextField label="Title" value={form.title} onChange={set("title")} T={T} placeholder="e.g. Routine screening" />
          <DateTimeField label="Date & time" value={form.date} onChange={set("date")} T={T} />
          {/* CHANGED 19 Aug 2026 — real feedback batch: free text, not
              a fixed list, and not mandatory (no validation ever
              required it — this was already true, just now also
              genuinely free-text). */}
          <ClinicianField value={form.clinician} onChange={set("clinician")} T={T} />
          <ClinicVisitLocationField value={form.location} onChange={set("location")} T={T} />
          <MultiSelectChips label="Reason for visit" value={form.reasonForVisit} onChange={set("reasonForVisit")} options={reasonForVisitOptions} T={T} />
          {/* CHANGED 19 Aug 2026 — explicit yes/no question, not a
              bare toggle. */}
          <YesNoQuestion question="Is this a future appointment?" value={form.isFutureAppointment} onChange={set("isFutureAppointment")} T={T} />
          {/* ADDED 19 Aug 2026 — real feedback batch: "arrange
              follow-up" — what kind, paired with the existing date
              field for when. */}
          <SelectField label="Arrange follow-up" value={form.followUpType} onChange={set("followUpType")} options={followUpTypeOptions} T={T} />
          {/* ADDED 19 Aug 2026 — real ask: a small descriptor for
              anything ambiguous/unlabelled. "TOC" is a genuine medical
              abbreviation, not obvious without sexual-health context. */}
          {form.followUpType === "TOC" && (
            <div style={{ fontSize: 11, color: T.textDisabled, marginTop: -6, marginBottom: 6 }}>TOC = Test of Cure, a follow-up test confirming treatment actually worked.</div>
          )}
          {/* ADDED — real ask: expand the meaning of the other two
              options too, not just TOC. */}
          {form.followUpType === "Routine" && (
            <div style={{ fontSize: 11, color: T.textDisabled, marginTop: -6, marginBottom: 6 }}>e.g. medication review, annual check-up.</div>
          )}
          {form.followUpType === "Other" && (
            <div style={{ fontSize: 11, color: T.textDisabled, marginTop: -6, marginBottom: 6 }}>e.g. contraception, vaccination.</div>
          )}
          <TextField label="Follow-up / next review date" value={form.nextReviewDate ? form.nextReviewDate.slice(0, 10) : ""} onChange={(v) => set("nextReviewDate")(v ? new Date(v).toISOString() : null)} T={T} type="date" />
        </SectionCard>

        <SectionCard title="Linked records" T={T}>
          <RelationPicker label="Linked tests" value={form.linkedTestIds} onChange={set("linkedTestIds")} items={allTests} T={T} placeholder="No tests logged yet" />
          {/* ADDED 19 Aug 2026 — real feedback batch: start a test
              here with just a name, continue the rest in Testing. */}
          <StartTestInline visitDate={form.date} onCreated={(testId) => { set("linkedTestIds")([...form.linkedTestIds, testId]); setRefreshKey((k) => k + 1); }} T={T} />
          {/* CHANGED 19 Aug 2026 — real feedback batch: each linked
              test's own real result now shows inline, read-only —
              this REPLACES the old standalone Results field (see
              clinicVisitsRepository.js's header for the full
              reasoning: results belong in Testing only, this embeds
              rather than duplicates). */}
          {form.linkedTestIds.length > 0 && (
            <div style={{ marginTop: 4, marginBottom: 8 }}>
              {form.linkedTestIds.map((id) => {
                const t = TestingRepository.getById(id);
                if (!t) return null;
                const resultNames = (t.resultIds || []).map((rid) => ResultsRegistry.getById(rid)?.name).filter(Boolean);
                if (resultNames.length === 0) return null;
                const isPositive = resultNames.some((n) => n.toLowerCase() === "positive");
                return (
                  <div key={id} style={{ fontSize: 11, color: isPositive ? T.actionRed : T.textSecondary, marginBottom: 2 }}>
                    {t.title || "Test"}: <strong>{resultNames.join(", ")}</strong>
                  </div>
                );
              })}
            </div>
          )}

          <RelationPicker label="Medications given (from your Medication tracker)" value={form.medicationsGivenIds} onChange={set("medicationsGivenIds")} items={allMeds} T={T} placeholder="No medications in registry" />
          <AdHocMedicationsManager value={form.adHocMedicationsGiven} onChange={set("adHocMedicationsGiven")} T={T} />

          <RelationPicker label="Vaccinations given" value={form.vaccinationsGivenIds} onChange={set("vaccinationsGivenIds")} items={allVaccinations} T={T} placeholder="No vaccinations logged yet" />

          <RelationPicker label="Symptom types discussed" value={form.symptomTypeIds} onChange={set("symptomTypeIds")} items={allSymptoms} T={T} placeholder="No symptoms in registry" />
          {/* ADDED 19 Aug 2026 — real feedback batch: pull from recent
              real Symptom Log entries, richer than the flat vocabulary
              picker above. */}
          <RelationPicker label="Specific symptom entries discussed" value={form.symptomsDiscussedIds} onChange={(v) => {
            set("symptomsDiscussedIds")(v);
            if (form.primaryReasonSymptomLogId && !v.includes(form.primaryReasonSymptomLogId)) set("primaryReasonSymptomLogId")("");
          }} items={allSymptomLogEntries} T={T} placeholder="No symptom entries logged yet" />
          {form.symptomsDiscussedIds.length > 0 && (
            <div style={{ padding: "6px 0" }}>
              <div style={{ fontSize: 11, color: T.textDisabled, marginBottom: 4 }}>Which one is why you're here? (optional)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {form.symptomsDiscussedIds.map((id) => {
                  const s = SymptomLogRepository.getById(id);
                  const isPrimary = form.primaryReasonSymptomLogId === id;
                  return (
                    <div key={id} onClick={() => set("primaryReasonSymptomLogId")(isPrimary ? "" : id)}
                      style={{ padding: "4px 9px", borderRadius: radius.full, fontSize: 11, fontWeight: isPrimary ? 700 : 400, cursor: "pointer", border: `1px solid ${isPrimary ? T.actionRed : T.border}`, color: isPrimary ? T.actionRed : T.textSecondary, background: isPrimary ? `${T.actionRed}12` : "transparent" }}>
                      {s?.title || "Entry"}{isPrimary ? " ★" : ""}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Notes" T={T}>
          <div style={{ padding: "8px 0" }}>
            <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Clinical notes</div>
            <textarea value={form.clinicalNotes} onChange={(e) => set("clinicalNotes")(e.target.value)} rows={3}
              placeholder="e.g. Discussed PrEP adherence, no concerns raised. Advised to continue current regimen."
              style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
          </div>
        </SectionCard>

        {!isNew && (
          <SectionCard title="Attachments" T={T}>
            <AttachmentManager visitId={visitId} attachments={ClinicVisitsRepository.getById(visitId)?.attachments || []} onChanged={() => setForm(ClinicVisitsRepository.getById(visitId))} T={T} />
          </SectionCard>
        )}
        {isNew && (
          <div style={{ fontSize: 11, color: T.textDisabled, textAlign: "center", padding: "12px 0", fontStyle: "italic" }}>
            Save this visit first, then attachments can be added.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Detail view ──
function VisitDetail({ visitId, onBack, onEdit, onOpenTest, T, triggerDelete, refresh }) {
  const [visit, setVisit] = useState(() => ClinicVisitsRepository.getById(visitId));
  // ADDED — real ask: real delete, with a confirmation step, same
  // pattern already proven for Testing/Vaccinations/Symptom Log.
  const [confirmDelete, setConfirmDelete] = useState(false);
  // ADDED — Measurements inline entry point (see import comment above).
  const [showAddMeasurement, setShowAddMeasurement] = useState(false);
  const [measurements, setMeasurements] = useState(() => MeasurementRepository.getAll().filter((m) => !m.isArchived && m.linkedClinicVisitId === visitId));
  const refreshMeasurements = () => setMeasurements(MeasurementRepository.getAll().filter((m) => !m.isArchived && m.linkedClinicVisitId === visitId));
  if (!visit) return null;

  const testEntries = visit.linkedTestIds.map((id) => TestingRepository.getById(id)).filter(Boolean);
  const medNames = visit.medicationsGivenIds.map((id) => MedicationRepository.getById(id)?.name).filter(Boolean);
  const symptomNames = visit.symptomTypeIds.map((id) => SymptomsRegistry.getById(id)?.name).filter(Boolean);
  const symptomLogEntries = visit.symptomsDiscussedIds.map((id) => SymptomLogRepository.getById(id)).filter(Boolean);
  const vaccinationEntries = visit.vaccinationsGivenIds.map((id) => VaccinationRepository.getById(id)).filter(Boolean);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onBack} />
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.healthcareBlue, cursor: "pointer" }} onClick={() => onEdit(visitId)}>Edit</span>
          <Trash2 size={17} color={T.actionRed} style={{ cursor: "pointer" }} onClick={() => setConfirmDelete(true)} aria-label="Delete permanently" title="Delete permanently" />
        </div>
      </div>
      {confirmDelete && (
        <div style={{ margin: "0 16px 12px", padding: 12, borderRadius: radius.sm, border: `1px solid ${T.actionRed}`, background: `${T.actionRed}11` }}>
          <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 8 }}>
            This permanently deletes the record — unlike archiving, there's no getting it back. Only use this for a genuinely wrong entry.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: 10, borderRadius: 999, border: `1px solid ${T.border}`, background: "transparent", color: T.textSecondary, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => { triggerDelete([visit]); refresh(); onBack(); }} style={{ flex: 1, padding: 10, borderRadius: 999, border: "none", background: T.actionRed, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Delete permanently</button>
          </div>
        </div>
      )}

      <div style={{ padding: "0 16px 100px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: radius.full, background: T.healthcareBlue, display: "inline-block" }} />
          <span style={{ ...TYPE.recordTitle, color: T.textPrimary }}>{visit.title || "Untitled visit"}</span>
        </div>
        <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 20, fontFamily: "'Inter', sans-serif" }}>{formatDateTime(visit.date)}</div>

        <SectionCard title="Overview" T={T}>
          <ReadRow label="Clinician" value={visit.clinician} T={T} />
          <ReadRow label="Location" value={visit.location} T={T} />
          <ReadRow label="Reason for visit" value={visit.reasonForVisit} T={T} />
          <ReadRow label="Future appointment" value={visit.isFutureAppointment ? "Yes" : ""} T={T} />
          <ReadRow label="Follow-up arranged" value={visit.followUpType && visit.followUpType !== "None" ? visit.followUpType : ""} T={T} />
          <ReadRow label="Follow-up / next review" value={formatDate(visit.nextReviewDate) !== "—" ? formatDate(visit.nextReviewDate) : ""} T={T} />
        </SectionCard>

        <SectionCard title="Linked records" T={T}>
          {testEntries.length > 0 && (
            <div style={{ padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Linked tests</div>
              {testEntries.map((t) => {
                const resultNames = (t.resultIds || []).map((rid) => ResultsRegistry.getById(rid)?.name).filter(Boolean);
                const isPositive = resultNames.some((n) => n.toLowerCase() === "positive");
                return (
                  <div key={t.id} onClick={() => onOpenTest?.(t.id)} style={{ cursor: onOpenTest ? "pointer" : "default", marginBottom: 4 }}>
                    <div style={{ fontSize: 13, color: T.healthcareBlue, fontWeight: 600 }}>{t.title || "Test"}</div>
                    {/* CHANGED 19 Aug 2026 — embeds the linked test's OWN
                        real result live, replacing the old standalone
                        (and duplicative) resultIds field. */}
                    {resultNames.length > 0 && (
                      <div style={{ fontSize: 11, color: isPositive ? T.actionRed : T.textSecondary, fontWeight: isPositive ? 700 : 400 }}>{resultNames.join(", ")}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <ReadRow label="Medications given (tracker)" value={medNames} T={T} />
          {visit.adHocMedicationsGiven.length > 0 && (
            <div style={{ padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Other medications given</div>
              {visit.adHocMedicationsGiven.map((m) => (
                <div key={m.id} style={{ fontSize: 13, color: T.textPrimary, marginBottom: 2 }}>{m.name}{m.notes ? ` — ${m.notes}` : ""}</div>
              ))}
            </div>
          )}
          <ReadRow label="Vaccinations given" value={vaccinationEntries.map((v) => v.title || v.vaccine)} T={T} />
          <ReadRow label="Symptom types discussed" value={symptomNames} T={T} />
          {symptomLogEntries.length > 0 && (
            <div style={{ padding: "7px 0" }}>
              <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Specific symptom entries</div>
              {symptomLogEntries.map((s) => (
                <div key={s.id} style={{ fontSize: 13, color: visit.primaryReasonSymptomLogId === s.id ? T.actionRed : T.textPrimary, fontWeight: visit.primaryReasonSymptomLogId === s.id ? 700 : 400, marginBottom: 2 }}>
                  {s.title}{visit.primaryReasonSymptomLogId === s.id ? " — why I'm here" : ""}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* ADDED — Measurements inline entry point: "one room, three
            doors" — this never duplicates a value field of its own,
            it only ever creates/shows real, linked Measurement records
            (see measurementRepository.js). */}
        <SectionCard title="Measurements" T={T}>
          {measurements.map((m) => (
            <ReadRow key={m.id} label={m.type} value={m.type === "Blood pressure" ? `${m.systolic}/${m.diastolic} mmHg` : `${m.value} ${m.unit}`} T={T} />
          ))}
          <div onClick={() => setShowAddMeasurement(true)} style={{ fontSize: 12, fontWeight: 700, color: T.healthcareBlue, cursor: "pointer", padding: "7px 0" }}>
            + Add measurement
          </div>
        </SectionCard>

        <SectionCard title="Notes" T={T}>
          <ReadRow label="Clinical notes" value={visit.clinicalNotes} T={T} />
        </SectionCard>

        {visit.attachments.length > 0 && (
          <SectionCard title="Attachments" T={T}>
            {visit.attachments.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
                <Paperclip size={13} color={T.textSecondary} />
                <span style={{ fontSize: 13, color: T.textPrimary }}>{a.title}</span>
                <span style={{ fontSize: 11, color: T.textDisabled }}>({a.type})</span>
              </div>
            ))}
          </SectionCard>
        )}
        {/* ADDED 26 Aug 2026 — real ask: last-updated indicator. */}
        {visit.updatedAt && (
          <div style={{ textAlign: "center", fontSize: 11, color: T.textDisabled, marginTop: 16 }}>
            Last updated {formatDate(visit.updatedAt)}
          </div>
        )}
      </div>
      {showAddMeasurement && (
        <InlineMeasurementSheet T={T} presetLink={{ linkedClinicVisitId: visitId }} onSaved={refreshMeasurements} onClose={() => setShowAddMeasurement(false)} />
      )}
    </div>
  );
}

// ── List / landing view ──
function VisitsLanding({ onOpen, onAdd, T, visits, refresh, deleteToast, undoDelete, redoDelete, triggerDelete }) {
  // ADDED 26 Aug 2026 — real ask: search within module, rolled out to
  // every module that didn't already have it.
  const [query, setQuery] = useState("");
  const sorted = useMemo(() => {
    const base = [...visits].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((v) => [v.title, v.location, ...(v.reasonForVisit || []), ...(v.clinician || [])].filter(Boolean).some((val) => val.toLowerCase().includes(q)));
  }, [visits, query]);
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
  // CHANGED 26 Aug 2026 — real gap found and fixed: visits/
  // deletedRecent/undoDelete/triggerDelete lifted to
  // ClinicVisitsModule, shared with VisitDetail.

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
        <span style={{ ...TYPE.sectionLabel, color: T.healthcareBlue }}>Clinic Visits</span>
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
                currently visible under the active search/filters. */}
            <span onClick={() => setSelectedIds(selectedIds.length === sorted.length ? [] : sorted.map((v) => v.id))}
              style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600, cursor: "pointer" }}>
              {selectedIds.length === sorted.length ? "Deselect all" : "Select all"}
            </span>
            {/* ADDED 26 Aug 2026 — real ask: export/print a single
                record, enabled only when exactly one is selected. */}
            <span onClick={() => { if (selectedIds.length === 1) exportRecordAsFile("clinicVisits", ClinicVisitsRepository.getById(selectedIds[0])); }}
              style={{ fontSize: 13, color: selectedIds.length === 1 ? "#FFFFFF" : "#89898C", fontWeight: 600, cursor: selectedIds.length === 1 ? "pointer" : "default" }}>Export</span>
            <span onClick={() => { if (selectedIds.length > 0) { ClinicVisitsRepository.bulkArchive(selectedIds); syncClinicVisitsToCalendar(ClinicVisitsRepository.getAll()); refresh(); exitSelectMode(); } }}
              style={{ fontSize: 13, color: selectedIds.length > 0 ? "#FFFFFF" : "#89898C", fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>Archive</span>
            <span onClick={() => {
              if (selectedIds.length === 0) return;
              if (window.confirm(`Delete ${selectedIds.length} visit${selectedIds.length > 1 ? "s" : ""}? You'll have a few seconds to undo.`)) {
                const toRestore = ClinicVisitsRepository.getAll().filter((v) => selectedIds.includes(v.id));
                triggerDelete(toRestore);
                refresh();
                exitSelectMode();
              }
            }} style={{ fontSize: 13, color: selectedIds.length > 0 ? DARK.actionRed : "#89898C", fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>Delete</span>
            <span onClick={exitSelectMode} style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600, cursor: "pointer" }}>Cancel</span>
          </div>
        </div>
      )}
      {/* CHANGED — same real fix, consistent with the standardized
          floating-add-button ask applied across every other module. */}
      {/* ADDED 26 Aug 2026 — real ask: search within module. */}
      <div style={{ padding: "8px 16px 0" }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clinic visits"
          style={{ width: "100%", padding: "8px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
      </div>
      {/* CHANGED 26 Aug 2026 — real audit finding: wrapped for
          wide-viewport centering, matching Medication's own pattern. */}
      <div style={{ position: "fixed", bottom: "calc(90px + env(safe-area-inset-bottom))", left: 0, right: 0, maxWidth: 600, margin: "0 auto", display: "flex", justifyContent: "flex-end", padding: "0 20px", pointerEvents: "none" }}>
        <div onClick={onAdd} style={{ width: 56, height: 56, borderRadius: 999, background: T.healthcareBlue, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,.2)", pointerEvents: "auto" }}>
          <Plus size={24} />
        </div>
      </div>

      <div style={{ padding: "12px 16px 100px", display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: T.textDisabled, fontSize: 13 }}>
            No clinic visits logged yet. Tap + to add one.
          </div>
        )}
        {sorted.map((v) => (
          <div key={v.id} onClick={() => selectMode ? toggleSelected(v.id) : onOpen(v.id)}
            onMouseDown={() => startPress(v.id)} onMouseUp={cancelPress} onMouseLeave={cancelPress} onTouchStart={(evt) => startPress(v.id, evt)} onTouchMove={handleTouchMove} onTouchEnd={cancelPress}
            role={selectMode ? "checkbox" : "button"} aria-checked={selectMode ? selectedIds.includes(v.id) : undefined} aria-label={v.title || "Untitled visit"} tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectMode ? toggleSelected(v.id) : onOpen(v.id); } }}
            style={{ background: selectedIds.includes(v.id) ? `${T.healthcareBlue}10` : T.surface, border: `1px solid ${selectedIds.includes(v.id) ? T.healthcareBlue : T.border}`, borderRadius: radius.md, padding: 14, cursor: "pointer", display: "flex", gap: 10 }}>
            {selectMode && (
              <div style={{ width: 22, height: 22, borderRadius: radius.full, border: `2px solid ${selectedIds.includes(v.id) ? T.healthcareBlue : T.border}`, background: selectedIds.includes(v.id) ? T.healthcareBlue : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, alignSelf: "center" }}>
                {selectedIds.includes(v.id) && <Check size={13} color="#FFFFFF" />}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
            {/* REMOVED — real ask: this dot was flat/always the same
                color, no real meaning ("looks pointless") — unlike
                Testing's, there's no active/warning/archived-type
                state for a clinic visit to actually convey (the
                Calendar icon already covers "upcoming"). */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>{v.title || "Untitled visit"}</span>
              {v.isFutureAppointment && <Calendar size={13} color={T.healthcareBlue} />}
            </div>
            <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 16, marginTop: 2, fontFamily: "'Inter', sans-serif" }}>{formatDate(v.date)}</div>
            {/* CHANGED — real bug caught before shipping: clinician is
                now an array (multiple clinicians support), rendering
                it directly would either show nothing (empty array is
                truthy but has no content) or concatenate names with
                no separator. */}
            {v.clinician.length > 0 && <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 16, marginTop: 2 }}>{v.clinician.join(", ")}</div>}
            {v.location && <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 16, marginTop: 2 }}>{v.location}</div>}
            </div>
          </div>
        ))}
      </div>
      {/* ADDED 26 Aug 2026 — real ask: undo for delete. */}
      {deleteToast && (
        <div onClick={deleteToast.mode === "undo" ? undoDelete : redoDelete}
          style={{ position: "fixed", bottom: "calc(90px + env(safe-area-inset-bottom))", left: 20, right: 20, maxWidth: 560, margin: "0 auto", background: "#1B1B1F", color: "#FFFFFF", padding: "12px 16px", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", zIndex: 40, boxShadow: "0 4px 16px rgba(0,0,0,.3)" }}>
          <span style={{ fontSize: 13 }}>
            {deleteToast.mode === "undo"
              ? `${deleteToast.records.length} visit${deleteToast.records.length > 1 ? "s" : ""} deleted`
              : `${deleteToast.records.length} visit${deleteToast.records.length > 1 ? "s" : ""} restored`}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.healthcareBlue }}>
            {deleteToast.mode === "undo" ? "Tap to undo" : "Tap to redo"}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Top-level module ──
export default function ClinicVisitsModule({ openAddOnMount = false, onConsumedQuickAdd, onOpenTest, openRecordId, onConsumedRecordOpen, prefillData, onConsumedPrefill, registerModuleBackHandler } = {}) {
  const [screen, setScreen] = useState({ name: "landing" });
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : LIGHT;
  // CHANGED 26 Aug 2026 — real gap found and fixed: lifted from
  // VisitsLanding — visits/deletedRecent/undoDelete/triggerDelete now
  // live at the real module level, shared with VisitDetail.
  const [visits, setVisits] = useState(() => ClinicVisitsRepository.getAll().filter((v) => !v.isArchived));
  const refresh = () => setVisits(ClinicVisitsRepository.getAll().filter((v) => !v.isArchived));
  // CHANGED 26 Aug 2026 — real ask, previously flagged low-priority and
  // now built: redo for delete, matching Contacts' reference
  // implementation.
  const [deleteToast, setDeleteToast] = useState(null); // { mode: "undo" | "redo", records }
  const undoTimerRef = useRef(null);
  // ADDED — real ask: calendar sync needs re-syncing (self-gated
  // inside on whether the feature's on) any time which visits count
  // as "still booked" changes — archived/deleted/restored, not just
  // saved. syncClinicVisitsToCalendar() re-derives the whole list
  // every time, so any of these naturally clean up or restore the
  // matching calendar event.
  const syncCalendar = () => syncClinicVisitsToCalendar(ClinicVisitsRepository.getAll());
  const undoDelete = () => {
    if (!deleteToast) return;
    deleteToast.records.forEach((record) => ClinicVisitsRepository.restore(record));
    refresh();
    syncCalendar();
    clearTimeout(undoTimerRef.current);
    setDeleteToast({ mode: "redo", records: deleteToast.records });
    undoTimerRef.current = setTimeout(() => setDeleteToast(null), 8000);
  };
  const redoDelete = () => {
    if (!deleteToast) return;
    TrashRepository.add("clinicVisits", deleteToast.records);
    deleteToast.records.forEach((r) => ClinicVisitsRepository.delete(r.id));
    refresh();
    syncCalendar();
    setDeleteToast(null);
    clearTimeout(undoTimerRef.current);
  };
  const triggerDelete = (records) => {
    TrashRepository.add("clinicVisits", records);
    records.forEach((r) => ClinicVisitsRepository.delete(r.id));
    syncCalendar();
    setDeleteToast({ mode: "undo", records });
    clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setDeleteToast(null), 8000);
  };
  // ADDED 19 Aug 2026 — real undo/redo extension.
  const editUndo = useEditUndo(ClinicVisitsRepository);
  // ADDED — real ask: Clinic Card's quick-add shortcuts need the new
  // record to open with real starting values, not blank.
  const [addPrefill, setAddPrefill] = useState(null);

  useEffect(() => {
    if (openAddOnMount) {
      setAddPrefill(prefillData || null);
      setScreen({ name: "edit", id: null });
      onConsumedQuickAdd?.();
      onConsumedPrefill?.();
    }
    // ADDED — real ask: Global Search deep-link, same pattern as Testing.
    if (openRecordId) {
      setScreen({ name: "detail", id: openRecordId });
      onConsumedRecordOpen?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backToList = () => setScreen({ name: "landing" });

  // ADDED 26 Aug 2026 — real ask: back should go one step within this
  // module. Same pattern as Testing's reference implementation.
  useEffect(() => {
    if (!registerModuleBackHandler) return;
    registerModuleBackHandler(() => {
      if (screen.name === "edit") {
        setScreen(screen.id ? { name: "detail", id: screen.id } : { name: "landing" });
        return true;
      }
      if (screen.name === "detail") {
        setScreen({ name: "landing" });
        return true;
      }
      return false;
    });
    return () => registerModuleBackHandler(null);
  }, [screen, registerModuleBackHandler]);

  let screenContent = null;
  if (screen.name === "landing") {
    screenContent = <VisitsLanding T={T} onOpen={(id) => setScreen({ name: "detail", id })} onAdd={() => setScreen({ name: "edit", id: null })} visits={visits} refresh={refresh} deleteToast={deleteToast} undoDelete={undoDelete} redoDelete={redoDelete} triggerDelete={triggerDelete} />;
  } else if (screen.name === "detail") {
    screenContent = <VisitDetail T={T} visitId={screen.id} onBack={backToList} onEdit={(id) => setScreen({ name: "edit", id })} onOpenTest={onOpenTest} triggerDelete={triggerDelete} refresh={refresh} />;
  } else if (screen.name === "edit") {
    screenContent = (
      <VisitEditSheet T={T} visitId={screen.id} prefillData={!screen.id ? addPrefill : null}
        onClose={() => setScreen(screen.id ? { name: "detail", id: screen.id } : { name: "landing" })}
        onSaved={(id) => setScreen({ name: "detail", id })}
        onBeforeEdit={editUndo.captureBeforeEdit}
        onAfterEdit={editUndo.notifyEdited} />
    );
  }

  return (
    <div style={{ background: T.bg, minHeight: "100vh" }}>
      {/* ADDED 19 Aug 2026 — real undo/redo toast, same pattern as
          every other module. */}
      {/* CHANGED — real ask: this sat at top:12, directly on top of
          the screen's own back button — the instinctive "do the edit,
          then tap back" motion hit the toast instead. top:64 clears
          every header shape in this app. */}
      {editUndo.toast && (
        <div onClick={editUndo.toast.mode === "undo" ? editUndo.undo : editUndo.redo}
          style={{ position: "fixed", top: 64, left: "50%", transform: "translateX(-50%)", width: 340, background: editUndo.toast.mode === "undo" ? "#1B1B1F" : T.healthcareBlue, color: "#FFFFFF", borderRadius: 999, padding: "10px 16px", fontSize: 13, fontWeight: 600, textAlign: "center", cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,.25)", zIndex: 230, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {editUndo.toast.mode === "undo" ? <Check size={14} /> : <RefreshCcw size={14} />}
          {editUndo.toast.mode === "undo" ? "Clinic visit updated — tap to undo" : "Undone — tap to redo"}
        </div>
      )}
      {screenContent}
    </div>
  );
}

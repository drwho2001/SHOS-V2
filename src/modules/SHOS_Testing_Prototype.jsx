import React, { useState, useMemo, useEffect, useRef } from "react";
import { PlusIcon as Plus, CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight, DotsThreeVerticalIcon as MoreVertical, XIcon as X, ArchiveIcon as Archive, CheckIcon as Check, PaperclipIcon as Paperclip, UploadSimpleIcon as Upload, TrashIcon as Trash2, ArrowsClockwiseIcon as RefreshCcw } from "@phosphor-icons/react";
import { useEditUndo } from "../calculations/editUndoHelpers";
import { fuzzyIncludes } from "../calculations/fuzzyMatch";
import PartnerNotificationSheet from "./SHOS_PartnerNotification_Prototype";
import { PartnerNotificationRepository } from "../repositories/partnerNotificationRepository";
import { nowAsDateString } from "../calculations/dateInputHelpers";
import {
  TestingRepository, DEFAULT_TEST,
  SETTING_OPTIONS, TESTING_FOR_OPTIONS,
} from "../repositories/testingRepository";
import { TrashRepository } from "../repositories/trashRepository";
import { exportRecordAsFile } from "../storage/recordExportService";
// ADDED 19 Aug 2026 — SAMPLE_TYPE_OPTIONS now lives here, real in-app
// editable list.
import { CustomOptionListsRepository } from "../repositories/customOptionListsRepository";
import { OrganismRegistry } from "../registries/organismRegistry";
import { ResultsRegistry } from "../registries/resultsRegistry";
// ADDED 19 Aug 2026 — real gap found in an orphaned-code audit:
// ClinicVisitsRepository.getByLinkedTest() was built specifically as
// "the read side" of the two-way Testing↔Clinic Visits link, but this
// module never actually called it — Clinic Visits' own detail view
// shows its linked tests, Testing's never showed its linked visits.
// One real direction of a two-way link with no UI at all.
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository";
import { suggestedRoutineRetestDate } from "../calculations/testingCalculations";
// ADDED — real ask: proactive "due for retest" notification, built on
// top of suggestedRoutineRetestDate's already-real calculation above.
import { syncTestingReminder } from "../calculations/testingReminderSync";
// ADDED 19 Aug 2026 — draft autosave, same pattern as every other
// edit sheet this round. See draftStorage.js for the full reasoning.
import { saveDraft, loadDraft, clearDraft } from "../storage/draftStorage";
// CHANGED 20 Aug 2026 — real design-unification pass: values read
// from the shared designTokens.js source of truth instead of being
// retyped here, so this screen can't silently drift from every other
// module's "same" color/radius. See designTokens.js.
import { NEUTRAL, NEUTRAL_DARK, ACCENTS, ACTION, RADIUS, resolveDarkAccent } from "../calculations/designTokens";
import { useDarkModePreference } from "../calculations/darkModePreference";

// ADDED 19 Aug 2026 — Healthcare blue (#4A80F0), per Doc 2's design
// system exactly: "Healthcare & Clinical (blue — unified) ... Testing,
// Results Registry, Organism Registry ...". Single Inter typeface
// throughout (JetBrains Mono retired 26 Aug 2026), same radius scale
// applied from the start per the user's explicit instruction this session
// — not something to retrofit later the way earlier modules had to be.
const LIGHT = {
  ...NEUTRAL,
  healthcareBlue: ACCENTS.healthcare, actionRed: ACTION.red, actionGreen: ACTION.green,
  navActive: ACCENTS.healthcare,
};
// Dark mode, on Medication's DARK basis — see Contacts' own comment
// for the full reasoning (same pattern, reused everywhere).
// CHANGED — real architecture fix, same as Contacts' own comment:
// resolveDarkAccent() keeps today's exact behaviour by default, only
// brightening once a real colour override exists.
const DARK = {
  ...NEUTRAL_DARK,
  healthcareBlue: resolveDarkAccent("healthcare", ACCENTS.healthcare), actionRed: resolveDarkAccent("actionRed", ACTION.red, "#FF7A7E"), actionGreen: resolveDarkAccent("actionGreen", ACTION.green, "#5FD9A4"),
  navActive: resolveDarkAccent("healthcare", ACCENTS.healthcare),
};
const radius = RADIUS;

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// ADDED — real ask: the status dot ("looks pointless") needed real
// recency awareness, not just result colour — an old test's dot
// shouldn't read with the same weight as a fresh one. "Recent" is
// either of the two most recent tests on file BY DATE (so someone who
// only tests every few months still gets a current-looking dot for
// their latest result) OR anything within the last 4 weeks (so a
// cluster of recent tests all read as current, not just the single
// newest one). `allTests` should be the FULL unfiltered set (not a
// search-filtered list) so rank is computed correctly.
const RECENT_TEST_WINDOW_MS = 28 * 24 * 60 * 60 * 1000;
function isRecentTest(test, allTests) {
  if (!test.date) return false;
  const withinWindow = Date.now() - new Date(test.date).getTime() <= RECENT_TEST_WINDOW_MS;
  if (withinWindow) return true;
  const rank = [...allTests].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).findIndex((t) => t.id === test.id);
  return rank !== -1 && rank < 2;
}

// Single source of truth for the dot colour, used by both the list
// row and the detail screen's title dot (previously only the list row
// had real logic — the detail dot was still a flat red-if-positive/
// else-blue leftover). Pending stays amber regardless of recency (a
// missing result is its own urgent state). An OLD test (not recent)
// reads as ACTION.gold — the "archive" tone this app's own design
// tokens already set aside for exactly this, previously unused —
// rather than a full-strength red/green that implies current status.
function computeTestDotColor(test, allTests, T, revealEarly = false) {
  const resultNames = test.resultIds.map((id) => ResultsRegistry.getById(id)?.name).filter(Boolean);
  const resultPending = test.resultDate && new Date(test.resultDate) > new Date() && !revealEarly;
  if (resultPending) return ACTION.amber;
  if (!isRecentTest(test, allTests)) return ACTION.gold;
  const isPositive = resultNames.some((r) => r.toLowerCase() === "positive");
  if (isPositive) return T.actionRed;
  const isNegative = resultNames.some((r) => r.toLowerCase() === "negative");
  if (isNegative) return T.actionGreen;
  return T.healthcareBlue;
}

// ── Shared form primitives — same self-contained pattern as every
// other module this session (each module owns its own copies, no
// shared UI-library file yet). ──
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
        {/* ADDED — real ask: "quick add buttons/shortcut on any forms
            where date/time input, to say Now — input current date and
            time as per device state." Fills the device's real local
            date, same safe helper used everywhere this was added —
            not a fresh new().toISOString() call that could reintroduce
            the exact shift bug just found and fixed in Encounters. */}
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

function MultiSelectChips({ label, value, onChange, options, T }) {
  const toggle = (opt) => { const has = value.includes(opt); onChange(has ? value.filter((v) => v !== opt) : [...value, opt]); };
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map((opt) => {
          const active = value.includes(opt);
          return (
            <div key={opt} onClick={() => toggle(opt)}
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

// Registry-backed picker (Organism/Result) — same pattern already
// proven this session in Contacts/Encounters/My Profile, no role
// tracking needed here (that's a kink-specific concept).
// CHANGED 1 Sep 2026 — real omission found in a broader audit: unlike
// Symptom Log's SymptomSelect (fixed earlier this session, same
// underlying gap), this picker's suggestion list never narrowed
// against typed text at all, and findOrCreate() ran on raw typed text
// with no "did you mean an existing one?" check first — a typo'd
// Organism could silently create a near-duplicate registry entry.
// Fixed the same way: fuzzyIncludes narrowing while typing, and
// findClosestMatch before creating a genuinely new single entry.
function RegistryTagPicker({ label, value, onChange, T, registry, placeholder }) {
  const [draft, setDraft] = useState("");
  const [pendingSuggestion, setPendingSuggestion] = useState(null);
  const allEntries = registry.getAll().filter((e) => !e.isArchived);
  const nameFor = (id) => allEntries.find((e) => e.id === id)?.name || registry.getById(id)?.name || "?";
  const draftTrimmedForFilter = draft.trim();
  const visibleSuggestions = (
    draftTrimmedForFilter
      ? allEntries.filter((e) => fuzzyIncludes(e.name, draftTrimmedForFilter))
      : allEntries
  ).filter((e) => !value.includes(e.id)).slice(0, 10);

  const commit = () => {
    const raw = draft.trim();
    if (!raw) return;
    const parts = raw.split(",").map((t) => t.trim()).filter(Boolean);
    if (parts.length === 1 && !value.some((id) => nameFor(id).toLowerCase() === parts[0].toLowerCase())) {
      const closest = findClosestMatch(allEntries.filter((e) => !value.includes(e.id)).map((e) => e.name), parts[0]);
      if (closest) { setPendingSuggestion({ typedAs: parts[0], suggestion: closest }); setDraft(""); return; }
    }
    const newIds = [];
    parts.forEach((part) => {
      const entry = registry.findOrCreate(part);
      if (entry && !value.includes(entry.id) && !newIds.includes(entry.id)) newIds.push(entry.id);
    });
    if (newIds.length > 0) onChange([...value, ...newIds]);
    setDraft("");
  };
  const tapSuggestion = (entry) => { if (!value.includes(entry.id)) onChange([...value, entry.id]); };
  const acceptPendingSuggestion = () => {
    const entry = registry.findOrCreate(pendingSuggestion.suggestion);
    if (entry) tapSuggestion(entry);
    setPendingSuggestion(null);
  };
  const dismissPendingSuggestion = () => {
    const entry = registry.findOrCreate(pendingSuggestion.typedAs);
    if (entry) tapSuggestion(entry);
    setPendingSuggestion(null);
  };

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {value.map((id) => (
            <div key={id} onClick={() => onChange(value.filter((v) => v !== id))}
              style={{ padding: "4px 8px", borderRadius: radius.full, fontSize: 12, background: T.surfaceVariant, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              {nameFor(id)} <X size={11} />
            </div>
          ))}
        </div>
      )}
      {pendingSuggestion && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 10px", borderRadius: radius.sm, background: `${T.healthcareBlue}15`, border: `1px solid ${T.healthcareBlue}`, marginBottom: 6, fontSize: 12 }}>
          <span style={{ color: T.textPrimary }}>Did you mean "{pendingSuggestion.suggestion}"? You typed "{pendingSuggestion.typedAs}".</span>
          <div onClick={acceptPendingSuggestion} style={{ fontWeight: 700, color: T.healthcareBlue, cursor: "pointer" }}>Yes, use it</div>
          <div onClick={dismissPendingSuggestion} style={{ fontWeight: 700, color: T.textSecondary, cursor: "pointer" }}>No, add as new</div>
        </div>
      )}
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {visibleSuggestions.map((e) => (
            <div key={e.id} onClick={() => tapSuggestion(e)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.healthcareBlue}`, color: T.healthcareBlue, cursor: "pointer" }}>
              + {e.name}
            </div>
          ))}
        </div>
      )}
      {/* CHANGED — real ask: the `list`/`<datalist>` native browser
          dropdown (removed below) could render on top of the on-screen
          keyboard on Android WebView — genuinely unpredictable, not a
          real affordance on a phone. The visible suggestion chips
          above already cover the same "pick existing" job without
          that risk. */}
      <input value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        onBlur={commit}
        placeholder={placeholder || "Pick existing or type new ones, comma-separated"}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
    </div>
  );
}

// ADDED 19 Aug 2026 — real feedback batch: "only one Result should be
// allowed at a time (currently multi-select) — retroactive updates
// (Pending → Positive/Negative) should REPLACE, not add to, the
// existing result." A real single-select variant of RegistryTagPicker
// above — tapping a suggestion or committing typed text REPLACES the
// selection rather than appending to it. Still writes/reads a
// single-element array (`resultIds`) rather than a bare string, since
// every other module that reads a test's result (Clinic Card,
// Timeline, exposureWindows.js) already expects `resultIds` as an
// array — this only changes what the UI lets you put IN it, not the
// underlying data shape, so nothing downstream needed touching.
// CHANGED — real ask: "Result should allow multiple options, if
// positive (is positive throat and rectal)." Confirmed first that
// every real consumer of `resultIds` app-wide (Clinic Card, Clinic
// Visits, Timeline) already uses `.map()`, genuinely prepared for more
// than one — the picker itself was the ONLY thing artificially
// restricting this to a single value, so converting it is a safe,
// well-isolated change, not a ripple into other logic.
function RegistryMultiResultPicker({ label, value, onChange, T, registry, placeholder }) {
  const [draft, setDraft] = useState("");
  const allEntries = registry.getAll().filter((e) => !e.isArchived);
  const currentNames = value.map((id) => allEntries.find((e) => e.id === id)?.name || registry.getById(id)?.name).filter(Boolean);
  // CHANGED 1 Sep 2026 — same real omission as the Organism picker
  // above: never narrowed against typed text. Fixed the same way.
  const draftTrimmedForFilter = draft.trim();
  const visibleSuggestions = (
    draftTrimmedForFilter
      ? allEntries.filter((e) => fuzzyIncludes(e.name, draftTrimmedForFilter))
      : allEntries
  ).filter((e) => !value.includes(e.id)).slice(0, 10);

  const addResult = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const entry = registry.findOrCreate(trimmed);
    if (entry && !value.includes(entry.id)) onChange([...value, entry.id]);
    setDraft("");
  };
  const removeResult = (id) => onChange(value.filter((v) => v !== id));

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {value.map((id, i) => (
            <div key={id} onClick={() => removeResult(id)}
              style={{ padding: "4px 8px", borderRadius: radius.full, fontSize: 12, background: T.surfaceVariant, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              {currentNames[i] || "?"} <X size={11} />
            </div>
          ))}
        </div>
      )}
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {visibleSuggestions.map((e) => (
            <div key={e.id} onClick={() => onChange([...value, e.id])}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.healthcareBlue}`, color: T.healthcareBlue, cursor: "pointer" }}>
              {e.name}
            </div>
          ))}
        </div>
      )}
      {/* CHANGED — real ask: same native-datalist-can-cover-the-
          keyboard fix as RegistryMultiPicker above — visible chips
          already cover "pick existing". */}
      <input value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addResult(draft); } }}
        onBlur={() => addResult(draft)}
        placeholder={placeholder || "Pick or type a result — add more than one if positive at multiple sites"}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
    </div>
  );
}

// ADDED 19 Aug 2026 — Attachments, real and working, per the user's ask
// ("add attachment option for testing/clinic, but again not actually
// used to date" — built as a genuine capability, kept intentionally
// lean since it's not expected to see real use yet). Same data-URL
// approach as Contacts' Profile Picture; same honest size caveat
// applies (see testingRepository.js's comment).
function AttachmentManager({ testId, attachments, onChanged, T }) {
  const inputRef = useRef(null);
  const [pendingType, setPendingType] = useState("Other");

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      TestingRepository.addAttachment(testId, { title: file.name, type: pendingType, fileDataUrl: reader.result });
      onChanged();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const remove = (attachmentId) => {
    TestingRepository.removeAttachment(testId, attachmentId);
    onChanged();
  };

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>Attachments</div>
      {attachments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {attachments.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: radius.sm, background: T.surfaceVariant }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <Paperclip size={13} color={T.textSecondary} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: T.textPrimary, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.title}</div>
                  <div style={{ fontSize: 10, color: T.textDisabled }}>{a.type} · {formatDate(a.date)}</div>
                </div>
              </div>
              <Trash2 size={14} color={T.actionRed} style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => remove(a.id)} />
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <select value={pendingType} onChange={(e) => setPendingType(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 12 }}>
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

// ADDED 1 Sep 2026 — real ask: same suggestion-picker shape as
// RelationPicker (SymptomLog/ClinicVisits), replacing the bare native
// <select> below — at most the 3 most recent shown by default, search
// beyond that (matches name or clinician).
function ClinicVisitLinkPicker({ items, onPick, T }) {
  const [query, setQuery] = useState("");
  const queryLower = query.trim().toLowerCase();
  const visible = queryLower
    ? items.filter((v) => v.name.toLowerCase().includes(queryLower) || v.searchText.includes(queryLower)).slice(0, 8)
    : items.slice(0, 3);
  return (
    <div>
      {items.length > 3 && (
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or clinician…"
          style={{ width: "100%", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 12, boxSizing: "border-box", marginBottom: 6 }} />
      )}
      {visible.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {visible.map((v) => (
            <div key={v.id} onClick={() => onPick(v.id)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.healthcareBlue}`, color: T.healthcareBlue, cursor: "pointer" }}>
              + {v.name}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: T.textDisabled, fontStyle: "italic" }}>No match — try a different search.</div>
      )}
    </div>
  );
}

// ── Add/Edit sheet ──
function TestEditSheet({ testId, prefillData, onClose, onSaved, onBeforeEdit, onAfterEdit, onNavigateToRecord, T }) {
  const isNew = !testId;
  const existing = testId ? TestingRepository.getById(testId) : null;
  // ADDED 26 Aug 2026 — real ask: "Date of treatment should have a
  // clinic visit link... open the linked clinic visit when physically
  // there, and fill in remaining details." IMPORTANT: this deliberately
  // does NOT use test.clinicVisitIds — that field exists in
  // DEFAULT_TEST but was found to be genuinely dead (never written to
  // or read by any UI, a leftover from before the relation direction
  // was settled). The real, actively-maintained relation is
  // ClinicVisitsRepository's own linkedTestIds (Clinic Visits' own
  // form already has a working picker for it — see RelationPicker
  // "Linked tests" there). Linking from this side updates THAT array
  // directly, keeping one single source of truth instead of adding a
  // second, unsynced way to represent the same relationship.
  const [linkVersion, setLinkVersion] = useState(0);
  const linkedVisits = useMemo(() => (testId ? ClinicVisitsRepository.getByLinkedTest(testId) : []), [testId, linkVersion]);
  // CHANGED 1 Sep 2026 — real ask: "old options listed first and not
  // searchable" — this list had no .sort() at all (storage order =
  // oldest first) and rendered into a bare native <select>, the exact
  // bug already fixed for RelationPicker elsewhere but missed here
  // since this picker is Testing's own hand-rolled one, not a
  // RelationPicker instance. Sorted newest-first now; searchText adds
  // clinician name(s) as a second match field, same "search by name or
  // [this module's nearest equivalent field]" spec used elsewhere.
  const unlinkedVisits = useMemo(() => {
    if (!testId) return [];
    return ClinicVisitsRepository.getAll()
      .filter((v) => !v.isArchived && !(v.linkedTestIds || []).includes(testId))
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .map((v) => ({
        id: v.id,
        name: `${v.title || (v.reasonForVisit || []).join("/") || "Clinic visit"} · ${formatDate(v.date)}`,
        searchText: (v.clinician || []).join(" ").toLowerCase(),
      }));
  }, [testId, linkVersion]);
  const linkVisit = (visitId) => {
    const visit = ClinicVisitsRepository.getById(visitId);
    if (!visit) return;
    ClinicVisitsRepository.update(visitId, { linkedTestIds: [...(visit.linkedTestIds || []), testId] });
    setLinkVersion((v) => v + 1);
  };
  // ADDED — real ask: there was no way to remove a linked clinic visit,
  // only add one — tapping a linked row navigated to it instead. A
  // small dedicated unlink control alongside each row, rather than a
  // long-press gesture (no touch-timing logic needed, and it's
  // actually more discoverable).
  const unlinkVisit = (visitId) => {
    const visit = ClinicVisitsRepository.getById(visitId);
    if (!visit) return;
    ClinicVisitsRepository.update(visitId, { linkedTestIds: (visit.linkedTestIds || []).filter((id) => id !== testId) });
    setLinkVersion((v) => v + 1);
  };
  // ADDED 19 Aug 2026 — real in-app editable option list.
  const sampleTypeOptions = useMemo(() => CustomOptionListsRepository.get("sampleType"), []);
  // ADDED 19 Aug 2026 — draft autosave.
  const draftKey = `testEdit_${testId || "new"}`;
  const [form, setForm] = useState(() => {
    const draft = loadDraft(draftKey);
    if (draft) return draft.data;
    // ADDED — real ask: Clinic Card's "TOC 2 week" shortcut — a real
    // new record starting with real values (a 2-weeks-out date,
    // testing for C&S), not always a totally blank form.
    return existing || { ...DEFAULT_TEST, ...prefillData };
  });
  const [draftRestored] = useState(() => !!loadDraft(draftKey));
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
  const canSave = form.title.trim().length > 0 || form.testingFor.length > 0;

  const save = () => {
    clearDraft(draftKey);
    if (isNew) {
      const created = TestingRepository.create(form);
      onSaved(created.id);
    } else {
      // ADDED 19 Aug 2026 — real undo/redo extension.
      onBeforeEdit?.(testId);
      TestingRepository.update(testId, form);
      onAfterEdit?.(testId);
      onSaved(testId);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 200, overflowY: "auto" }}>
      {/* CHANGED 26 Aug 2026 — real ask: forms should also have the
          module banner title, matching every other module screen. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", position: "sticky", top: 0, background: T.healthcareBlue, zIndex: 1 }}>
        <ChevronLeft size={22} color="#FFFFFF" style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF" }}>{isNew ? "New test" : "Edit test"}</span>
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
          <TextField label="Title" value={form.title} onChange={set("title")} T={T} placeholder="e.g. Routine 3-month screen" />
          <TextField label="Date" value={form.date ? form.date.slice(0, 10) : ""} onChange={(v) => set("date")(v ? new Date(v).toISOString() : null)} T={T} type="date" />
          {/* ADDED 19 Aug 2026 — real feedback batch: Result Date,
              separate from the specimen date above — can lag behind
              it depending on sample/lab turnaround. */}
          <TextField label="Result date" value={form.resultDate ? form.resultDate.slice(0, 10) : ""} onChange={(v) => set("resultDate")(v ? new Date(v).toISOString() : null)} T={T} type="date" />
          <SelectField label="Setting" value={form.setting} onChange={set("setting")} options={SETTING_OPTIONS} T={T} />
          <MultiSelectChips label="Sample type" value={form.sampleType} onChange={set("sampleType")} options={sampleTypeOptions} T={T} />
          <MultiSelectChips label="Testing for?" value={form.testingFor} onChange={set("testingFor")} options={TESTING_FOR_OPTIONS} T={T} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
            <span style={{ fontSize: 13, color: T.textPrimary }}>Most recent</span>
            <ToggleSwitch T={T} value={form.mostRecent} onChange={set("mostRecent")} />
          </div>
        </SectionCard>

        <SectionCard title="Result" T={T}>
          {/* REORDERED — real ask: Result should come before Organism
              ("positive blood, then HIV" — the result is the headline,
              which organism (if any) is the detail underneath it). */}
          {/* CHANGED 19 Aug 2026 — real feedback batch: only one Result
              should ever apply at a time — picking a new one now
              REPLACES rather than adds to the existing selection, so
              a retroactive Pending → Positive update genuinely
              updates the result instead of leaving both. */}
          <RegistryMultiResultPicker label="Result" value={form.resultIds} onChange={set("resultIds")} registry={ResultsRegistry} T={T} placeholder="e.g. Positive, Negative" />
          <RegistryTagPicker label="Organism (if positive)" value={form.organismIds} onChange={set("organismIds")} registry={OrganismRegistry} T={T} placeholder="e.g. Chlamydia" />
          {/* CHANGED 19 Aug 2026 — relabeled per real feedback: this
              date specifically means "when treatment happened, if
              positive" — not a generic catch-all follow-up date. */}
          <TextField label="Date of treatment (if positive)" value={form.followUpActionedDate ? form.followUpActionedDate.slice(0, 10) : ""} onChange={(v) => set("followUpActionedDate")(v ? new Date(v).toISOString() : null)} T={T} type="date" />
          {/* ADDED 26 Aug 2026 — real ask: date alone doesn't say WHERE
              treatment happened/will happen — link the actual Clinic
              Visit alongside it, and let it be opened directly to fill
              in the rest (clinician, what was given, etc.) rather than
              duplicating those details here. Only available once the
              test itself has been saved (isNew has no id to link yet). */}
          {!isNew && (
            <div style={{ padding: "8px 0" }}>
              <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Linked clinic visit</div>
              {linkedVisits.length > 0 ? (
                linkedVisits.map((v) => (
                  <div key={v.id} onClick={() => { onNavigateToRecord?.("healthcare", v.id, "clinicVisits"); onClose(); }}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.healthcareBlue}`, background: `${T.healthcareBlue}11`, cursor: "pointer", marginBottom: 6, gap: 8 }}>
                    <span style={{ fontSize: 13, color: T.healthcareBlue, fontWeight: 600 }}>{v.title || (v.reasonForVisit || []).join("/") || "Clinic visit"} · {formatDate(v.date)}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <X size={14} color={T.healthcareBlue} onClick={(e) => { e.stopPropagation(); unlinkVisit(v.id); }} title="Remove link" />
                      <ChevronRight size={14} color={T.healthcareBlue} />
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 12, color: T.textDisabled, marginBottom: 6 }}>Not linked to a clinic visit yet.</div>
              )}
              {unlinkedVisits.length > 0 && <ClinicVisitLinkPicker items={unlinkedVisits} onPick={linkVisit} T={T} />}
            </div>
          )}
          {/* ADDED 19 Aug 2026 — real feedback batch: a free-text
              written plan, distinct from the structured date above —
              answers "what's the plan" rather than "when was it done". */}
          <TextField label="Written plan" value={form.writtenPlan} onChange={set("writtenPlan")} T={T} placeholder="e.g. f/u in 2 weeks for treatment" />
          {/* ADDED 19 Aug 2026 — real feedback batch: "if negative,
              follow-up defaults to nil or routine 3-month retest".
              Purely informational — computed fresh from the real
              result/date, never stored, same spirit as the exposure-
              window flagging elsewhere in this app. Only shows once a
              Negative result and a date are both present.
              CHANGED — real correction: HIV no longer gets a separate
              6-month interval — standard PrEP monitoring tests HIV
              every 3 months, same as everything else, so one uniform
              interval applies regardless of testingFor. */}
          {(() => {
            const suggested = suggestedRoutineRetestDate(form);
            return suggested ? (
              <div style={{ fontSize: 12, color: T.healthcareBlue, background: `${T.healthcareBlue}12`, borderRadius: radius.sm, padding: "8px 10px", marginTop: 6 }}>
                Routine retest suggested around {formatDate(suggested)} (3 months after this test).
              </div>
            ) : null;
          })()}
        </SectionCard>

        <SectionCard title="Notes" T={T}>
          {/* CHANGED 19 Aug 2026 — real feedback batch: clarified this
              is specifically for home test kits, and only shown when
              Setting is actually Home — was previously always visible
              with no context for what it was for. */}
          {form.setting === "🏠 Home" && (
            <>
              {/* ADDED 1 Sep 2026 — real ask: a postal/home kit's own
                  code is usually two separate parts (PK/SK) plus a
                  distinct access key for the results portal — three
                  real identifiers, not one. trackingInfo below stays
                  as a genuine catch-all for anything else. */}
              <TextField label="Kit code (PK)" value={form.kitCodePk} onChange={set("kitCodePk")} T={T} placeholder="e.g. PK12345678" />
              <TextField label="Kit code (SK)" value={form.kitCodeSk} onChange={set("kitCodeSk")} T={T} placeholder="e.g. SK98765432" />
              <TextField label="Access key" value={form.kitAccessKey} onChange={set("kitAccessKey")} T={T} placeholder="For logging into the results portal" />
              <TextField label="Other tracking info" value={form.trackingInfo} onChange={set("trackingInfo")} T={T} placeholder="e.g. barcode, courier reference number" />
            </>
          )}
          {/* ADDED 26 Aug 2026 — real bug: this card had no actual
              general notes field, unlike every other module. Same
              textarea pattern as Vaccinations/Symptom Log. */}
          <div style={{ padding: "8px 0" }}>
            <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>General notes</div>
            <textarea value={form.notes ?? ""} onChange={(e) => set("notes")(e.target.value)} rows={3}
              style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
          </div>
        </SectionCard>

        {!isNew && (
          <SectionCard title="Attachments" T={T}>
            <AttachmentManager testId={testId} attachments={TestingRepository.getById(testId)?.attachments || []} onChanged={() => setForm(TestingRepository.getById(testId))} T={T} />
          </SectionCard>
        )}
        {isNew && (
          <div style={{ fontSize: 11, color: T.textDisabled, textAlign: "center", padding: "12px 0", fontStyle: "italic" }}>
            Save this test first, then attachments can be added.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Detail view ──
function TestDetail({ testId, onBack, onEdit, onNavigateToRecord, T, triggerDelete, refresh, allTests }) {
  const [test, setTest] = useState(() => TestingRepository.getById(testId));
  // ADDED — real ask: "hide result until result date... similar to
  // Dom/sub half-toggle." Soft-masked by default rather than fully
  // hidden with no way to see it — a real result is real data, not
  // something to permanently block, just not show by default before
  // it's genuinely expected back.
  const [revealEarly, setRevealEarly] = useState(false);
  // ADDED — real ask: real delete, with a confirmation step so a stray
  // tap can't silently destroy a record.
  const [confirmDelete, setConfirmDelete] = useState(false);
  // ADDED 1 Sep 2026 — real ask: partner notification checklist. See
  // partnerNotificationRepository.js's own header for the full scope.
  const [showPartnerNotify, setShowPartnerNotify] = useState(false);
  // Bumped on close so the "Generate" vs "View list" state below
  // re-reads from the repository — PartnerNotificationRepository isn't
  // itself reactive state, so nothing else here would trigger a
  // re-render after the sheet creates/edits/deletes a list.
  const [, setPartnerNotifyVersion] = useState(0);
  if (!test) return null;

  const organismNames = test.organismIds.map((id) => OrganismRegistry.getById(id)?.name).filter(Boolean);
  const resultNames = test.resultIds.map((id) => ResultsRegistry.getById(id)?.name).filter(Boolean);
  const isPositive = resultNames.some((r) => r.toLowerCase() === "positive");
  const partnerNotifyList = isPositive ? PartnerNotificationRepository.getByTestId(testId) : null;
  const resultPending = test.resultDate && new Date(test.resultDate) > new Date() && !revealEarly;
  // ADDED 19 Aug 2026 — real data, previously built but never
  // displayed. See the import comment above for the full reasoning.
  const linkedVisits = ClinicVisitsRepository.getByLinkedTest(testId);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onBack} />
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.healthcareBlue, cursor: "pointer" }} onClick={() => onEdit(testId)}>Edit</span>
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
            <button onClick={() => { triggerDelete([test]); refresh(); onBack(); }} style={{ flex: 1, padding: 10, borderRadius: 999, border: "none", background: T.actionRed, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Delete permanently</button>
          </div>
        </div>
      )}

      <div style={{ padding: "0 16px 100px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          {/* CHANGED — real ask: this was still the old flat
              red-if-positive/else-blue leftover, "pointless" the same
              way the list row's dot used to be before that got fixed
              — the fix here just hadn't reached this screen too.
              Shares the same recency-aware logic as the list row now
              (see computeTestDotColor's own comment). */}
          <span style={{ width: 10, height: 10, borderRadius: radius.full, background: computeTestDotColor(test, allTests || [test], T, revealEarly), display: "inline-block" }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary }}>{test.title || "Untitled test"}</span>
        </div>
        <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 20, fontFamily: "'Inter', sans-serif" }}>{formatDate(test.date)}</div>

        <SectionCard title="Overview" T={T}>
          <ReadRow label="Setting" value={test.setting} T={T} />
          <ReadRow label="Sample type" value={test.sampleType} T={T} />
          <ReadRow label="Testing for?" value={test.testingFor} T={T} />
          <ReadRow label="Most recent" value={test.mostRecent ? "Yes" : ""} T={T} />
          <ReadRow label="Result date" value={test.resultDate ? formatDate(test.resultDate) : ""} T={T} />
        </SectionCard>

        <SectionCard title="Result" T={T}>
          {/* REORDERED — real ask: Result should come before Organism. */}
          {resultPending ? (
            <div onClick={() => setRevealEarly(true)} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13, cursor: "pointer" }}>
              <span style={{ color: T.textSecondary }}>Result</span>
              <span style={{ color: T.textDisabled, fontStyle: "italic" }}>Pending — expected {formatDate(test.resultDate)}. Tap to reveal anyway.</span>
            </div>
          ) : (
            <ReadRow label="Result" value={resultNames} T={T} />
          )}
          <ReadRow label="Organism" value={organismNames} T={T} />
          <ReadRow label="Date of treatment" value={formatDate(test.followUpActionedDate) !== "—" ? formatDate(test.followUpActionedDate) : ""} T={T} />
          {/* CHANGED 26 Aug 2026 — this was computed above but never
              actually rendered (see the comment on linkedVisits).
              Fixed as part of the real ask to link a clinic visit
              alongside the treatment date and open it directly. */}
          {linkedVisits.length > 0 && (
            <div style={{ padding: "6px 0" }}>
              <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Linked clinic visit</div>
              {linkedVisits.map((v) => (
                <div key={v.id} onClick={() => onNavigateToRecord?.("healthcare", v.id, "clinicVisits")}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.healthcareBlue}`, background: `${T.healthcareBlue}11`, cursor: "pointer", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: T.healthcareBlue, fontWeight: 600 }}>{v.title || (v.reasonForVisit || []).join("/") || "Clinic visit"} · {formatDate(v.date)}</span>
                  <ChevronRight size={14} color={T.healthcareBlue} />
                </div>
              ))}
            </div>
          )}
          <ReadRow label="Written plan" value={test.writtenPlan} T={T} />
          {/* ADDED 1 Sep 2026 — real ask: partner notification. Only
              offered when a Result is actually recorded as Positive —
              this isn't relevant otherwise. */}
          {isPositive && (
            <div onClick={() => setShowPartnerNotify(true)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.healthcareBlue}`, background: `${T.healthcareBlue}11`, cursor: "pointer", marginTop: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.healthcareBlue }}>
                {partnerNotifyList ? `Contact list · ${partnerNotifyList.items.filter((i) => i.notified).length}/${partnerNotifyList.items.length} notified` : "Generate contact list"}
              </span>
              <ChevronRight size={14} color={T.healthcareBlue} />
            </div>
          )}
          {(() => {
            const suggested = suggestedRoutineRetestDate(test);
            return suggested ? (
              <div style={{ fontSize: 12, color: T.healthcareBlue, background: `${T.healthcareBlue}12`, borderRadius: radius.sm, padding: "8px 10px", marginTop: 8 }}>
                Routine retest suggested around {formatDate(suggested)}.
              </div>
            ) : null;
          })()}
        </SectionCard>

        <SectionCard title="Notes" T={T}>
          {test.setting === "🏠 Home" && (
            <>
              <ReadRow label="Kit code (PK)" value={test.kitCodePk} T={T} />
              <ReadRow label="Kit code (SK)" value={test.kitCodeSk} T={T} />
              <ReadRow label="Access key" value={test.kitAccessKey} T={T} />
              <ReadRow label="Other tracking info" value={test.trackingInfo} T={T} />
            </>
          )}
          {/* ADDED 26 Aug 2026 — matches the new general notes field
              added to the edit form. */}
          <ReadRow label="General notes" value={test.notes} T={T} />
        </SectionCard>

        {test.attachments.length > 0 && (
          <SectionCard title="Attachments" T={T}>
            {test.attachments.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
                <Paperclip size={13} color={T.textSecondary} />
                <span style={{ fontSize: 13, color: T.textPrimary }}>{a.title}</span>
                <span style={{ fontSize: 11, color: T.textDisabled }}>({a.type})</span>
              </div>
            ))}
          </SectionCard>
        )}

        {/* ADDED 19 Aug 2026 — same known, honest scope limit already
            stated elsewhere in the app (Clinic Visits' own linked-test
            row): this switches to the Clinic Visits sub-tab's list, not
            a true deep-link to that one visit's detail screen — full
            cross-module "open this specific record" plumbing doesn't
            exist yet anywhere in the app. Real and useful stop short of
            that, not a silent downgrade. */}
        {linkedVisits.length > 0 && (
          <SectionCard title="Linked clinic visits" T={T}>
            {linkedVisits.map((v) => (
              <div key={v.id} style={{ padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 13, color: T.textPrimary, fontWeight: 600 }}>{v.title || (v.reasonForVisit || []).join("/") || "Clinic visit"}</div>
                <div style={{ fontSize: 11, color: T.textSecondary }}>{formatDate(v.date)}</div>
              </div>
            ))}
          </SectionCard>
        )}
        {/* ADDED 26 Aug 2026 — real ask: last-updated indicator. */}
        {test.updatedAt && (
          <div style={{ textAlign: "center", fontSize: 11, color: T.textDisabled, marginTop: 16 }}>
            Last updated {formatDate(test.updatedAt)}
          </div>
        )}
      </div>
      {showPartnerNotify && (
        <PartnerNotificationSheet testId={testId} onClose={() => { setShowPartnerNotify(false); setPartnerNotifyVersion((v) => v + 1); }} />
      )}
    </div>
  );
}

// ── List / landing view ──
function TestingLanding({ onOpen, onAdd, T, tests, refresh, deleteToast, undoDelete, redoDelete, triggerDelete }) {
  // ADDED 26 Aug 2026 — real ask: search within module, rolled out to
  // every module that didn't already have it (Contacts/Activity did).
  const [query, setQuery] = useState("");
  const sorted = useMemo(() => {
    const base = [...tests].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((t) => [t.title, t.setting, ...(t.testingFor || []), ...(t.resultIds || []).map((id) => ResultsRegistry.getById(id)?.name)].filter(Boolean).some((v) => v.toLowerCase().includes(q)));
  }, [tests, query]);
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
  // CHANGED 26 Aug 2026 — real gap found and fixed: tests/deletedRecent/
  // undoDelete/triggerDelete used to live only here, so a single-record
  // delete from TestDetail wrote to Trash but showed no undo toast —
  // lifted to TestingModule (the real parent of both this and
  // TestDetail) so both screens share one source of truth.

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* CHANGED 26 Aug 2026 — real ask: this had the same full
          prominence as Healthcare's own title banner right above it —
          redundant, since this is always a sub-tab within Healthcare
          (the sub-tab pills already show which section is active),
          never a standalone top-level screen. Shrunk to a small
          subordinate label instead of a duplicate full banner. */}
      {/* CHANGED — real bug: this stuck at top:0, the SAME position as
          Healthcare's own colored banner above it (also top:0, zIndex
          6) — since both are sticky within Healthcare's one shared
          scroll container, they overlapped exactly instead of stacking,
          so this floated ON TOP of Healthcare's banner once scrolled
          past it, with the rest of the page (including the multiselect
          toolbar below) still scrolling underneath as if this were at
          y:0. top:62 sticks it directly beneath Healthcare's banner
          instead — same measured height Contacts already uses for its
          own second sticky bar under an identical banner shape. */}
      <div style={{ position: "sticky", top: 62, zIndex: 6, background: T.bg, padding: "10px 16px 4px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.healthcareBlue, textTransform: "uppercase", letterSpacing: 0.5 }}>Testing</span>
        {/* ADDED 26 Aug 2026 — real ask: explicit Select toggle,
            matching Medication's pattern — long-press stays as an
            additional quick entry. */}
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
            <span onClick={() => setSelectedIds(selectedIds.length === sorted.length ? [] : sorted.map((t) => t.id))}
              style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600, cursor: "pointer" }}>
              {selectedIds.length === sorted.length ? "Deselect all" : "Select all"}
            </span>
            {/* ADDED 26 Aug 2026 — real ask: export/print a single
                record, enabled only when exactly one is selected. */}
            <span onClick={() => { if (selectedIds.length === 1) exportRecordAsFile("testing", TestingRepository.getById(selectedIds[0])); }}
              style={{ fontSize: 13, color: selectedIds.length === 1 ? "#FFFFFF" : "#6E6E74", fontWeight: 600, cursor: selectedIds.length === 1 ? "pointer" : "default" }}>Export</span>
            <span onClick={() => { if (selectedIds.length > 0) { TestingRepository.bulkArchive(selectedIds); refresh(); exitSelectMode(); } }}
              style={{ fontSize: 13, color: selectedIds.length > 0 ? "#FFFFFF" : "#6E6E74", fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>Archive</span>
            <span onClick={() => {
              if (selectedIds.length === 0) return;
              if (window.confirm(`Delete ${selectedIds.length} test${selectedIds.length > 1 ? "s" : ""}? You'll have a few seconds to undo.`)) {
                const toRestore = TestingRepository.getAll().filter((t) => selectedIds.includes(t.id));
                triggerDelete(toRestore);
                refresh();
                exitSelectMode();
              }
            }} style={{ fontSize: 13, color: selectedIds.length > 0 ? DARK.actionRed : "#6E6E74", fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>Delete</span>
            <span onClick={exitSelectMode} style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600, cursor: "pointer" }}>Cancel</span>
          </div>
        </div>
      )}
      {/* ADDED 26 Aug 2026 — real ask: search within module. */}
      <div style={{ padding: "8px 16px 0" }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tests"
          style={{ width: "100%", padding: "8px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
      </div>
      {/* CHANGED — real ask: "Add test button doesn't hover and lock
          position like every other module" — same fix already applied
          to Vaccinations/Symptom Log, same real pattern.
          CHANGED 26 Aug 2026 — real audit finding: wrapped for
          wide-viewport centering, matching Medication's own pattern. */}
      <div style={{ position: "fixed", bottom: 90, left: 0, right: 0, maxWidth: 600, margin: "0 auto", display: "flex", justifyContent: "flex-end", padding: "0 20px", pointerEvents: "none" }}>
        <div onClick={onAdd} style={{ width: 56, height: 56, borderRadius: 999, background: T.healthcareBlue, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,.2)", pointerEvents: "auto" }}>
          <Plus size={24} />
        </div>
      </div>

      <div style={{ padding: "12px 16px 100px", display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: T.textDisabled, fontSize: 13 }}>
            No tests logged yet. Tap + to add one.
          </div>
        )}
        {sorted.map((t) => {
          const resultNames = t.resultIds.map((id) => ResultsRegistry.getById(id)?.name).filter(Boolean);
          const resultPending = t.resultDate && new Date(t.resultDate) > new Date();
          const isPositive = !resultPending && resultNames.some((r) => r.toLowerCase() === "positive");
          const isNegative = !resultPending && resultNames.some((r) => r.toLowerCase() === "negative");
          // CHANGED — real ask: red/green/amber alone still read as
          // "pointless" once a test was old — an old negative kept
          // glowing green as if still current. computeTestDotColor
          // adds real recency: only a recent result gets the full red/
          // green treatment, an old one reads as the archive tone
          // instead. `tests` (not the search-filtered `sorted`) is
          // passed so rank-based recency isn't skewed by an active
          // search query.
          const dotColor = computeTestDotColor(t, tests, T);
          return (
            <div key={t.id} onClick={() => selectMode ? toggleSelected(t.id) : onOpen(t.id)}
              onMouseDown={() => startPress(t.id)} onMouseUp={cancelPress} onMouseLeave={cancelPress} onTouchStart={(evt) => startPress(t.id, evt)} onTouchMove={handleTouchMove} onTouchEnd={cancelPress}
              style={{ background: selectedIds.includes(t.id) ? `${T.healthcareBlue}10` : T.surface, border: `1px solid ${selectedIds.includes(t.id) ? T.healthcareBlue : isPositive ? T.actionRed : T.border}`, borderRadius: radius.md, padding: 14, cursor: "pointer", display: "flex", gap: 10 }}>
              {selectMode && (
                <div style={{ width: 22, height: 22, borderRadius: radius.full, border: `2px solid ${selectedIds.includes(t.id) ? T.healthcareBlue : T.border}`, background: selectedIds.includes(t.id) ? T.healthcareBlue : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, alignSelf: "center" }}>
                  {selectedIds.includes(t.id) && <Check size={13} color="#FFFFFF" />}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: radius.full, background: dotColor, display: "inline-block" }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>{t.title || "Untitled test"}</span>
                {t.mostRecent && <Check size={13} color={T.healthcareBlue} />}
              </div>
              <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 16, marginTop: 2, fontFamily: "'Inter', sans-serif" }}>{formatDate(t.date)}</div>
              {/* ADDED — real ask: "state on card location of test
                  (home/clinic)" — was only ever shown on the detail
                  screen before, never the list card itself. */}
              {t.setting && (
                <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 16, marginTop: 2 }}>{t.setting}</div>
              )}
              {/* CHANGED — real ask: "hide result until result date" —
                  the list card was leaking the real result before the
                  detail screen's own masking even applied. */}
              {resultPending ? (
                <div style={{ fontSize: 12, color: T.textDisabled, marginLeft: 16, marginTop: 2, fontStyle: "italic" }}>Pending — expected {formatDate(t.resultDate)}</div>
              ) : resultNames.length > 0 && (
                <div style={{ fontSize: 12, color: isPositive ? T.actionRed : T.textSecondary, marginLeft: 16, marginTop: 2, fontWeight: isPositive ? 700 : 400 }}>{resultNames.join(", ")}</div>
              )}
              </div>
            </div>
          );
        })}
      </div>
      {/* ADDED 26 Aug 2026 — real ask: undo for delete. */}
      {deleteToast && (
        <div onClick={deleteToast.mode === "undo" ? undoDelete : redoDelete}
          style={{ position: "fixed", bottom: 90, left: 20, right: 20, maxWidth: 560, margin: "0 auto", background: "#1B1B1F", color: "#FFFFFF", padding: "12px 16px", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", zIndex: 40, boxShadow: "0 4px 16px rgba(0,0,0,.3)" }}>
          <span style={{ fontSize: 13 }}>
            {deleteToast.mode === "undo"
              ? `${deleteToast.records.length} test${deleteToast.records.length > 1 ? "s" : ""} deleted`
              : `${deleteToast.records.length} test${deleteToast.records.length > 1 ? "s" : ""} restored`}
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
export default function TestingModule({ openAddOnMount = false, onConsumedQuickAdd, openRecordId, onConsumedRecordOpen, prefillData, onConsumedPrefill, onNavigateToRecord, onDataChanged, registerModuleBackHandler } = {}) {
  const [screen, setScreen] = useState({ name: "landing" });
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : LIGHT;
  // CHANGED 26 Aug 2026 — real gap found and fixed: lifted from
  // TestingLanding (see that component's own comment) — tests/
  // deletedRecent/undoDelete/triggerDelete now live at the real module
  // level, shared by both TestingLanding and TestDetail.
  const [tests, setTests] = useState(() => TestingRepository.getAll().filter((t) => !t.isArchived));
  const refresh = () => setTests(TestingRepository.getAll().filter((t) => !t.isArchived));
  // CHANGED 26 Aug 2026 — real ask, previously flagged low-priority and
  // now built: redo for delete, matching Contacts' reference
  // implementation.
  const [deleteToast, setDeleteToast] = useState(null); // { mode: "undo" | "redo", records }
  const undoTimerRef = useRef(null);
  const undoDelete = () => {
    if (!deleteToast) return;
    deleteToast.records.forEach((record) => TestingRepository.restore(record));
    refresh();
    clearTimeout(undoTimerRef.current);
    setDeleteToast({ mode: "redo", records: deleteToast.records });
    undoTimerRef.current = setTimeout(() => setDeleteToast(null), 8000);
  };
  const redoDelete = () => {
    if (!deleteToast) return;
    TrashRepository.add("testing", deleteToast.records);
    deleteToast.records.forEach((r) => TestingRepository.delete(r.id));
    refresh();
    setDeleteToast(null);
    clearTimeout(undoTimerRef.current);
  };
  const triggerDelete = (records) => {
    TrashRepository.add("testing", records);
    records.forEach((r) => TestingRepository.delete(r.id));
    setDeleteToast({ mode: "undo", records });
    clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setDeleteToast(null), 8000);
  };
  // ADDED 19 Aug 2026 — real undo/redo extension, same shared
  // mechanism as Encounters/Contacts/Medication.
  const editUndo = useEditUndo(TestingRepository);
  // ADDED — real ask: Clinic Card's quick-add shortcuts ("TOC 2 week")
  // need the new record to open with real starting values, not blank.
  const [addPrefill, setAddPrefill] = useState(null);

  // Same Dashboard quick-add pattern as every other module this
  // session — see SHOS_Contacts_Prototype.jsx for the fuller reasoning.
  useEffect(() => {
    if (openAddOnMount) {
      setAddPrefill(prefillData || null);
      setScreen({ name: "edit", id: null });
      onConsumedQuickAdd?.();
      onConsumedPrefill?.();
    }
    // ADDED — real ask: Global Search results should open the actual
    // test, not just land on the Testing tab. Same real deep-link
    // pattern already proven for Contacts/Encounters.
    if (openRecordId) {
      setScreen({ name: "detail", id: openRecordId });
      onConsumedRecordOpen?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backToList = () => setScreen({ name: "landing" });

  // ADDED 26 Aug 2026 — real ask: back should go one step within this
  // module (edit→detail, detail→landing), not jump straight to Home.
  // Reference implementation — see App.jsx's own comment on
  // moduleBackHandlerRef for the full architecture and rollout state
  // across other modules. Registers fresh whenever `screen` changes,
  // so the handler always reflects the CURRENT screen, not a stale
  // one from an earlier render. Unregisters on unmount (cleanup
  // return) — critical: without this, switching away from Testing
  // could leave a stale handler that wrongly fires on a different
  // module's back press.
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
      return false; // already at landing — nothing to go back to within this module
    });
    return () => registerModuleBackHandler(null);
  }, [screen, registerModuleBackHandler]);

  let screenContent = null;
  if (screen.name === "landing") {
    screenContent = <TestingLanding T={T} onOpen={(id) => setScreen({ name: "detail", id })} onAdd={() => setScreen({ name: "edit", id: null })} tests={tests} refresh={refresh} deleteToast={deleteToast} undoDelete={undoDelete} redoDelete={redoDelete} triggerDelete={triggerDelete} />;
  } else if (screen.name === "detail") {
    screenContent = <TestDetail T={T} testId={screen.id} onBack={backToList} onEdit={(id) => setScreen({ name: "edit", id })} onNavigateToRecord={onNavigateToRecord} triggerDelete={triggerDelete} refresh={refresh} allTests={tests} />;
  } else if (screen.name === "edit") {
    screenContent = (
      <TestEditSheet T={T} testId={screen.id} prefillData={!screen.id ? addPrefill : null}
        onClose={() => setScreen(screen.id ? { name: "detail", id: screen.id } : { name: "landing" })}
        onSaved={(id) => { onDataChanged?.(); syncTestingReminder(); setScreen({ name: "detail", id }); }}
        onBeforeEdit={editUndo.captureBeforeEdit}
        onAfterEdit={editUndo.notifyEdited}
        onNavigateToRecord={onNavigateToRecord} />
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
          {editUndo.toast.mode === "undo" ? "Test updated — tap to undo" : "Undone — tap to redo"}
        </div>
      )}
      {screenContent}
    </div>
  );
}

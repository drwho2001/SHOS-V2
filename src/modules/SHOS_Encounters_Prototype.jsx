// SHOS_Encounters_Prototype.jsx — "Activity" screens (Doc 1 nav label) for
// the Encounter domain object (Doc 3 B2, Doc 4 §3). Self-contained, same
// pattern as the Contacts and Medication prototype files — its own theme
// constants and form primitives, no shared UI-library file yet (per the
// project's "discover abstractions after multiple modules exist" rule).
//
// Reads/writes ONLY through EncounterRepository + encounterCalculations.js.
// Attendee picking reads ContactRepository (read-only here — Encounters
// never writes to a Contact record; the link is one-directional storage,
// as documented in encounterRepository.js).

import React, { useState, useMemo, useEffect, useRef } from "react";
// ADDED 19 Aug 2026 — draft autosave, real fix for in-progress edits
// being lost on refresh. See draftStorage.js for the full reasoning.
import { saveDraft, loadDraft, clearDraft } from "../storage/draftStorage";
import { PlusIcon as Plus, CaretLeftIcon as ChevronLeft, DotsThreeVerticalIcon as MoreVertical, XIcon as X, ArchiveIcon as Archive, UsersIcon as Users, MapPinIcon as MapPin, HeartIcon as Heart, CheckIcon as Check, ArrowsClockwiseIcon as RefreshCcw, TrashIcon as Trash2, CrosshairIcon as Crosshair } from "@phosphor-icons/react";
import { getCurrentLocationPlace, summarizePlaceName } from "../storage/locationService";
import { useEditUndo } from "../calculations/editUndoHelpers";
import { syncDoxyPepAlert } from "../calculations/doxyPepSync";
import { nowAsDateTimeLocalString } from "../calculations/dateInputHelpers";
import { fuzzyIncludes } from "../calculations/fuzzyMatch";
import {
  EncounterRepository, DEFAULT_ENCOUNTER,
  ENCOUNTER_TYPE_OPTIONS, MY_POSITION_OPTIONS, CUM_LOCATION_OPTIONS, MY_ROLE_OPTIONS,
  PREP_COVERAGE_OPTIONS, DOXYPEP_STATUS_OPTIONS, WOULD_MEET_AGAIN_OPTIONS,
} from "../repositories/encounterRepository";
import { TrashRepository } from "../repositories/trashRepository";
import { exportRecordAsFile } from "../storage/recordExportService";
import { timeOfDay, sortByDateDesc, formatRelativeDate } from "../calculations/encounterCalculations";
import { ContactRepository } from "../repositories/contactRepository";
import { TestingRepository } from "../repositories/testingRepository";
// New 18 Aug 2026: real registries now exist for these fields — replaces
// the free-text TagField stubs used until this session.
import { KinkRegistry, KINK_ROLE_OPTIONS, resolveKinkSynonym, analyzeKinkEntry, getKinkRoleOptions } from "../registries/kinkRegistry";
// ADDED — real fix: same normalizeTag Contacts already uses, imported
// here rather than duplicated — it's a pure, generic text utility, not
// Contacts-specific, matching how other pure calculation helpers
// (formatRelativeDate etc.) are already shared cross-module in this
// codebase.
import { normalizeTag } from "../calculations/contactCalculations";
import { ChemsRegistry, resolveChemSynonym } from "../registries/chemsRegistry";
import { ProtectionRegistry } from "../registries/protectionRegistry";
import { SymptomsRegistry } from "../registries/symptomsRegistry";
import { LocationsRepository } from "../repositories/locationsRepository";
// CHANGED 20 Aug 2026 — real design-unification pass: values read
// from the shared designTokens.js source of truth instead of being
// retyped here, so this screen can't silently drift from every other
// module's "same" color/radius. See designTokens.js.
import { NEUTRAL, NEUTRAL_DARK, ACCENTS, ACTION, RADIUS, TYPE, resolveDarkAccent } from "../calculations/designTokens";
import { useDarkModePreference } from "../calculations/darkModePreference";

const LIGHT = {
  ...NEUTRAL,
  encountersPink: ACCENTS.encounters, actionRed: ACTION.red, actionGreen: ACTION.green,
  navActive: ACCENTS.encounters, fabBg: ACCENTS.encounters, fabIcon: "#FFFFFF",
};
// Dark mode, on Medication's DARK basis — see Contacts' own comment
// for the full reasoning. encountersPink (#8D3B7A) is a dark, fairly
// desaturated purple — good on white, too low-contrast as text/fills
// against a near-black dark surface, so brightened here specifically
// (same reason Medication's own accent needed a dark-mode variant).
// CHANGED — real ask: the previous brightened value (#C77BB5) read as
// too lilac/muted; user tried several neon-plum candidates and picked
// "#D370C7" as the new default.
// CHANGED AGAIN — real architecture fix: that was a fixed literal,
// completely ignoring a customised colour (ACCENTS.encounters/
// ACTION.red/ACTION.green) the moment dark mode was on.
// resolveDarkAccent() keeps this exact "#D370C7" default (and
// actionRed/actionGreen's own existing defaults) unless the user
// actually customises that colour — only then does dark mode switch
// to a live-derived brightened variant of their real choice. See
// designTokens.js's own comment for the full reasoning.
const DARK = {
  ...NEUTRAL_DARK,
  encountersPink: resolveDarkAccent("encounters", ACCENTS.encounters, "#D370C7"),
  actionRed: resolveDarkAccent("actionRed", ACTION.red, "#FF7A7E"), actionGreen: resolveDarkAccent("actionGreen", ACTION.green, "#5FD9A4"),
  navActive: resolveDarkAccent("encounters", ACCENTS.encounters, "#D370C7"), fabBg: resolveDarkAccent("encounters", ACCENTS.encounters, "#D370C7"), fabIcon: "#FFFFFF",
};
const radius = RADIUS;

function loadEncounters() {
  return EncounterRepository.getAll();
}
function loadContacts() {
  return ContactRepository.getAll();
}
function contactName(contacts, id) {
  const c = contacts.find((c) => c.id === id);
  return c ? (c.nickname || c.name) : "Unknown";
}

// ── Shared primitives (same shapes as Contacts/Medication files) ──

function SectionCard({ title, T, children }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: radius.md, background: T.surface, padding: "4px 14px 14px", marginTop: 14 }}>
      <div style={{ ...TYPE.sectionLabel, color: T.encountersPink, paddingTop: 12, marginBottom: 2 }}>{title}</div>
      {children}
    </div>
  );
}

function TextField({ label, value, onChange, T, placeholder, type = "text" }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      <input type={type} value={value ?? ""} aria-label={label}
        onChange={(e) => onChange(type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
    </div>
  );
}

function DateTimeField({ label, value, onChange, T }) {
  // CHANGED — real bug found and fixed: this used to round-trip
  // through `new Date(...)`, which is safe for a well-formed ISO
  // string with a "Z" suffix (display side) but genuinely wrong for
  // the RAW datetime-local value on input — a string like
  // "2026-08-01T02:30" has no timezone marker, so `new Date()`
  // interprets it as LOCAL time and `.toISOString()` then converts to
  // UTC, silently shifting the typed hour by the DST offset (tested:
  // typing 02:30 in BST was being stored as 01:30). The user's own
  // explicit, repeated principle: whatever time is typed is correct
  // for his geography at that moment and must never be adjusted for
  // BST/UTC/DST after the fact. Fixed by treating both directions as
  // plain string manipulation — no Date object, no local-timezone
  // interpretation anywhere in this component.
  const inputVal = value ? value.slice(0, 16) : "";
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 12, color: T.textSecondary }}>{label}</div>
        {/* ADDED — real ask: "Now" quick-fill, device's real local
            date AND time — uses the datetime variant of the same
            shared helper, same safe reasoning as the fix just above. */}
        <span onClick={() => onChange(`${nowAsDateTimeLocalString()}:00.000Z`)} style={{ fontSize: 11, fontWeight: 700, color: T.encountersPink, cursor: "pointer" }}>Now</span>
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
  const toggle = (opt) => {
    const has = value.includes(opt);
    onChange(has ? value.filter((v) => v !== opt) : [...value, opt]);
  };
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map((opt) => {
          const active = value.includes(opt);
          return (
            <div key={opt} onClick={() => toggle(opt)} role="button" tabIndex={0} aria-pressed={active}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(opt); } }}
              style={{ padding: "5px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? T.encountersPink : T.border}`, color: active ? T.encountersPink : T.textSecondary, background: active ? `${T.encountersPink}15` : "transparent" }}>
              {opt}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ADDED 18 Aug 2026 — real feedback from the user, clarified over several
// rounds: "My position" options mix genuine giving/receiving pairs
// (Fingering, Oral, Rimming, Anal) with acts that have no natural
// directional role (Kissing, Cuddling, Groping, Mutual masturbation,
// Kink, Toys). A flat chip list made every pair repeat the word
// "giving"/"receiving" as text; the user's ask was two columns headed
// Giving/Receiving with just the act name in each, plus a third
// unsplit group below for the acts that don't have that split.
// Deliberately does NOT change the stored shape — MY_POSITION_OPTIONS
// is still one flat array of strings (e.g. "Rimming - giving"), this
// component just reads the " - giving"/" - receiving" suffix to decide
// which column an option belongs in, and treats anything without that
// suffix as the third group. No new data model needed for this.
function GivingReceivingChips({ label, value, onChange, options, T }) {
  const giving = [];
  const receiving = [];
  const neutral = [];
  options.forEach((opt) => {
    if (opt.endsWith(" - giving")) giving.push(opt.slice(0, -" - giving".length));
    else if (opt.endsWith(" - receiving")) receiving.push(opt.slice(0, -" - receiving".length));
    else neutral.push(opt);
  });

  const toggle = (fullValue) => {
    const has = value.includes(fullValue);
    onChange(has ? value.filter((v) => v !== fullValue) : [...value, fullValue]);
  };

  const Chip = ({ act, fullValue }) => {
    const active = value.includes(fullValue);
    return (
      <div onClick={() => toggle(fullValue)} role="button" tabIndex={0} aria-pressed={active}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(fullValue); } }}
        style={{ padding: "5px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? T.encountersPink : T.border}`, color: active ? T.encountersPink : T.textSecondary, background: active ? `${T.encountersPink}15` : "transparent", textAlign: "center" }}>
        {act}
      </div>
    );
  };

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", gap: 14 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.textDisabled, textTransform: "uppercase", letterSpacing: 0.5 }}>Giving/Top</div>
          {giving.map((act) => <Chip key={act} act={act} fullValue={`${act} - giving`} />)}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.textDisabled, textTransform: "uppercase", letterSpacing: 0.5 }}>Receiving/Bottom</div>
          {receiving.map((act) => <Chip key={act} act={act} fullValue={`${act} - receiving`} />)}
        </div>
      </div>
      {neutral.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
          {neutral.map((opt) => <Chip key={opt} act={opt} fullValue={opt} />)}
        </div>
      )}
    </div>
  );
}

// Multi-select picker backed by a real registry (Kink/Chems/Protection/
// Symptoms) instead of freeform text. `value` is an array of registry
// IDs. Typing a name that already exists in the registry links to it
// (case-insensitively); typing a genuinely new name creates a new
// registry entry via findOrCreate — same "pick existing or type new"
// ergonomics the old TagField had, but now backed by a real linked
// entity instead of a bare string, closing the "Fist vs Fisting never
// matched" gap flagged back on 18 Aug.
function RegistryTagPicker({ label, value, onChange, T, registry, placeholder, excludeIds = [], trackRole = false, roleOptions = [], resolveSynonym = (x) => x, analyzeEntry = null, getRoleOptionsForKink = null }) {
  const [draft, setDraft] = useState("");
  // ADDED — real ask: "did you mean...?" for a recognized typo or an
  // umbrella term, same mechanism now built and proven in Contacts.
  const [pendingSuggestion, setPendingSuggestion] = useState(null);
  const allEntries = registry.getAll().filter((e) => !e.isArchived);
  const nameFor = (id) => allEntries.find((e) => e.id === id)?.name || registry.getById(id)?.name || "?";

  // ADDED 18 Aug 2026 — trackRole mode: `value` becomes an array of
  // {kinkId, role} selections instead of plain registry IDs — the user's
  // real per-session ask: "fisting happened" is enough on its own, with
  // an OPTIONAL role if he wants to note "I was fisting top" for that
  // specific encounter. Same mechanism as Contacts' Stated Kinks.
  const selectedIds = trackRole ? value.map((v) => v.kinkId) : value;
  const hasSelection = (id) => selectedIds.includes(id);

  // ADDED 18 Aug 2026 — visible tappable suggestions, matching the
  // pattern already used in Contacts/My Profile. This picker never had
  // them, relying only on the native <datalist> dropdown, which is easy
  // to type straight past without noticing — same gap already flagged
  // and fixed elsewhere.
  // CHANGED — real ask: "auto recognise as typing begins and narrow
  // down drop down searches... do this with any field appropriate,
  // like kinks". `draft` was never actually used to filter this list —
  // typing did nothing, it just showed the same static first-10 the
  // whole time. Reuses fuzzyIncludes() (fuzzyMatch.js, already built
  // for Global Search's typo tolerance) rather than a second matching
  // implementation — the existing analyzeEntry/synonym "did you mean"
  // flow on commit is untouched, this only fixes the live suggestion
  // list shown while still typing.
  const draftTrimmedForFilter = draft.trim();
  const visibleSuggestions = (
    draftTrimmedForFilter
      ? allEntries.filter((e) => fuzzyIncludes(e.name, draftTrimmedForFilter))
      : allEntries
  ).filter((e) => !hasSelection(e.id) && !excludeIds.includes(e.id)).slice(0, 10);

  const addEntries = (ids) => {
    if (ids.length === 0) return;
    if (trackRole) onChange([...value, ...ids.map((id) => ({ kinkId: id, role: null }))]);
    else onChange([...value, ...ids]);
  };
  const removeEntry = (id) => {
    if (trackRole) onChange(value.filter((v) => v.kinkId !== id));
    else onChange(value.filter((v) => v !== id));
  };
  // CHANGED — real ask: role options now depend on WHICH kink is being
  // cycled, not one fixed set for everything — same fix as Contacts,
  // restoring what the user's original Notion data (Dom/sub vs Top/bottom)
  // actually knew before this session's earlier deduplication flattened
  // it. See KINK_ROLE_STYLE in kinkRegistry.js for the full reasoning.
  const resolveRoleOptions = (id) => {
    if (getRoleOptionsForKink) return getRoleOptionsForKink(nameFor(id));
    return roleOptions;
  };
  const cycleRole = (id) => {
    if (!trackRole) return;
    const optionsForThisKink = resolveRoleOptions(id);
    if (!optionsForThisKink) return; // mutual kink — nothing to cycle
    onChange(value.map((v) => {
      if (v.kinkId !== id) return v;
      const currentIndex = v.role ? optionsForThisKink.indexOf(v.role) : -1;
      const nextRole = currentIndex + 1 < optionsForThisKink.length ? optionsForThisKink[currentIndex + 1] : null;
      return { ...v, role: nextRole };
    }));
  };

  // CHANGED — real bug found in the user's own testing: a kink typed here
  // wasn't showing up as an option when the SAME kink was typed in
  // Contacts, and vice versa. Root cause traced directly: Contacts
  // runs every typed kink through `resolveSynonym(normalizeTag(text))`
  // before findOrCreate — canonicalizing wording AND casing so
  // "ass play"/"Ass Play"/a known synonym all resolve to the one real
  // registry entry. This picker called `findOrCreate(part)` on raw,
  // untouched text — no case-normalization, no synonym resolution —
  // so the exact same kink typed slightly differently in each place
  // was silently creating separate, near-duplicate registry entries.
  // The underlying registry was always genuinely shared (confirmed
  // directly); this picker just wasn't feeding it consistently.
  const finalizeEntry = (resolvedName) => {
    const entry = registry.findOrCreate(resolvedName);
    if (entry && !hasSelection(entry.id)) addEntries([entry.id]);
  };

  const commit = () => {
    const raw = draft.trim();
    if (!raw) { setDraft(""); return; }
    const parts = raw.split(",").map((t) => t.trim()).filter(Boolean);

    // ADDED — real ask: before committing a single typed entry, check
    // whether it's a recognized umbrella term or a likely typo close
    // to an existing entry, and ask instead of silently deciding.
    if (analyzeEntry && parts.length === 1) {
      const normalized = normalizeTag(parts[0]);
      const analysis = analyzeEntry(normalized);
      if (analysis.type === "umbrella" || analysis.type === "fuzzy-suggestion") {
        setPendingSuggestion(analysis);
        setDraft("");
        return;
      }
    }

    const newIds = [];
    parts.forEach((part) => {
      const resolved = resolveSynonym(normalizeTag(part));
      if (!resolved) return;
      const entry = registry.findOrCreate(resolved);
      if (entry && !hasSelection(entry.id) && !newIds.includes(entry.id)) newIds.push(entry.id);
    });
    addEntries(newIds);
    setDraft("");
  };

  const tapSuggestion = (entry) => {
    if (!hasSelection(entry.id)) addEntries([entry.id]);
  };

  // ADDED 2 Sep 2026 — real ask: "set all for others too" — same
  // one-tap "set every selection's role at once" feature My Profile's
  // (and now Contacts') copy of this component already has. See My
  // Profile's copy for the full reasoning.
  const ROLE_POLES = [
    { label: "Top / Dom", anatomical: "Top", dynamic: "Dom" },
    { label: "Vers / Switch", anatomical: "Vers", dynamic: "Switch" },
    { label: "sub / bottom", anatomical: "bottom", dynamic: "sub" },
  ];
  const setAllRoles = (pole) => {
    onChange(value.map((v) => {
      const optionsForThisKink = resolveRoleOptions(v.kinkId);
      if (!optionsForThisKink) return v;
      const role = optionsForThisKink.includes("Dom") ? pole.dynamic : pole.anatomical;
      return { ...v, role };
    }));
  };

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>{label}</div>
      {trackRole && value.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: T.textDisabled }}>Set all:</span>
          {ROLE_POLES.map((pole) => (
            <div key={pole.label} onClick={() => setAllRoles(pole)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, fontWeight: 600, border: `1px solid ${T.encountersPink}`, color: T.encountersPink, cursor: "pointer" }}>
              {pole.label}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
        {(trackRole ? value : value.map((id) => ({ kinkId: id, role: null }))).map((sel) => {
          // CHANGED — a "mutual" kink shows no role badge at all now.
          const roleOptionsForThisKink = trackRole ? resolveRoleOptions(sel.kinkId) : null;
          return (
            <div key={sel.kinkId} style={{ display: "flex", alignItems: "center", borderRadius: radius.full, border: `1px solid ${T.border}`, overflow: "hidden" }}>
              <div style={{ padding: "4px 8px", fontSize: 12, color: T.textSecondary, display: "flex", alignItems: "center", gap: 4 }}>
                {nameFor(sel.kinkId)}
                <X size={11} style={{ cursor: "pointer" }} onClick={() => removeEntry(sel.kinkId)} aria-label="Remove kink" title="Remove kink" />
              </div>
              {trackRole && roleOptionsForThisKink && (
                <div onClick={() => cycleRole(sel.kinkId)}
                  style={{ padding: "4px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer", borderLeft: `1px solid ${T.border}`, color: sel.role ? T.encountersPink : T.textDisabled }}>
                  {sel.role || "+ role"}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* ADDED 18 Aug 2026 — rendered above the input on purpose, same
          reasoning as Contacts/My Profile: the on-screen keyboard covers
          whatever's below the input the moment you tap in. */}
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {visibleSuggestions.map((e) => (
            <div key={e.id} onMouseDown={(ev) => ev.preventDefault()} onClick={() => tapSuggestion(e)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.encountersPink}`, color: T.encountersPink, cursor: "pointer" }}>
              + {e.name}
            </div>
          ))}
        </div>
      )}
      {/* CHANGED — real ask: the `list`/`<datalist>` native browser
          dropdown (removed here) could render on top of the on-screen
          keyboard on Android WebView. The visible suggestion chips
          above already cover "pick existing" without that risk. */}
      <input value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        placeholder={placeholder || "Pick existing or type new ones, comma-separated"}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
      {/* ADDED — real ask: "did you mean...?" prompt, same behavior as
          Contacts — accepting a suggestion or keeping exactly what was
          typed are both one tap, neither forced. */}
      {pendingSuggestion && (
        <div style={{ marginTop: 6, padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.encountersPink}`, background: `${T.encountersPink}10` }}>
          {pendingSuggestion.type === "umbrella" ? (
            <>
              <div style={{ fontSize: 12, color: T.textPrimary, marginBottom: 6 }}>
                "{pendingSuggestion.typedAs}" is a broader term — did you mean {pendingSuggestion.specific.length > 1 ? "one of these more specific ones" : "the more specific"}?
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {pendingSuggestion.specific.map((entry) => (
                  <div key={entry.id} onMouseDown={(ev) => ev.preventDefault()} onClick={() => { finalizeEntry(entry.name); setPendingSuggestion(null); }}
                    style={{ padding: "4px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, background: T.encountersPink, color: "#FFFFFF", cursor: "pointer" }}>
                    Use "{entry.name}"
                  </div>
                ))}
                <div onMouseDown={(ev) => ev.preventDefault()} onClick={() => { finalizeEntry(pendingSuggestion.typedAs); setPendingSuggestion(null); }}
                  style={{ padding: "4px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, border: `1px solid ${T.border}`, color: T.textSecondary, cursor: "pointer" }}>
                  Keep "{pendingSuggestion.typedAs}"
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: T.textPrimary, marginBottom: 6 }}>
                Did you mean "{pendingSuggestion.suggestion}"? You typed "{pendingSuggestion.typedAs}".
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <div onMouseDown={(ev) => ev.preventDefault()} onClick={() => { finalizeEntry(pendingSuggestion.suggestion); setPendingSuggestion(null); }}
                  style={{ padding: "4px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, background: T.encountersPink, color: "#FFFFFF", cursor: "pointer" }}>
                  Yes, use "{pendingSuggestion.suggestion}"
                </div>
                <div onMouseDown={(ev) => ev.preventDefault()} onClick={() => { finalizeEntry(pendingSuggestion.typedAs); setPendingSuggestion(null); }}
                  style={{ padding: "4px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, border: `1px solid ${T.border}`, color: T.textSecondary, cursor: "pointer" }}>
                  No, add "{pendingSuggestion.typedAs}" as new
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Single-select version, for Location — one registry ID, not an array.
function RegistrySinglePicker({ label, value, onChange, T, registry, placeholder, showLocateButton = false }) {
  const allEntries = registry.getAll().filter((e) => !e.isArchived);
  const current = value ? (allEntries.find((e) => e.id === value)?.name || registry.getById(value)?.name || "") : "";
  const [draft, setDraft] = useState(current);
  // ADDED — real ask: "use current location... tag current place for
  // example" (the user's own cruising-context example). Reuses the
  // same findOrCreate() commit() already uses below, so a located place
  // becomes a real registry entry exactly like typing one in would.
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");
  const useCurrentLocation = async () => {
    setLocating(true);
    setLocateError("");
    try {
      const place = await getCurrentLocationPlace();
      const name = summarizePlaceName(place);
      const entry = registry.findOrCreate(name);
      if (entry) { onChange(entry.id); setDraft(entry.name); }
    } catch (err) {
      setLocateError(err.message);
    } finally {
      setLocating(false);
    }
  };

  // ADDED 18 Aug 2026 — real feedback: relying only on the native
  // <datalist> dropdown "doesn't feel right" — no visible tap target,
  // easy to miss the dropdown affordance entirely on a phone. Same fix
  // already shipped for RegistryTagPicker earlier this session: visible
  // tappable suggestion chips for existing entries, not just a native
  // browser dropdown as the only way in.
  // CHANGED — real ask: "don't show list like attendees, just suggest
  // after typing begins. Suggestions show most-recent to oldest." Two
  // real fixes: this used to show every registry entry unconditionally
  // (and never actually matched against what was typed at all) — now
  // gated on draft being non-empty AND actually filtered against it.
  // "Most recent" means most recently USED in a real Encounter, not
  // just when the registry entry itself was created — a location
  // logged yesterday should surface before one only ever used once,
  // months ago, even if that one's the older registry entry. Reads
  // EncounterRepository directly (this component only has one real
  // caller, Location, so the coupling is honest rather than forcing a
  // generic prop-callback for a single consumer).
  const locationLastUsed = useMemo(() => {
    const map = new Map();
    for (const enc of EncounterRepository.getAll()) {
      if (!enc.locationId || !enc.date) continue;
      const existing = map.get(enc.locationId);
      if (!existing || enc.date > existing) map.set(enc.locationId, enc.date);
    }
    return map;
  }, []);
  const draftLower = draft.trim().toLowerCase();
  const visibleSuggestions = draftLower
    ? allEntries
        .filter((e) => e.id !== value && e.name.toLowerCase().includes(draftLower))
        .sort((a, b) => {
          const aDate = locationLastUsed.get(a.id) || a.createdAt || "";
          const bDate = locationLastUsed.get(b.id) || b.createdAt || "";
          return bDate.localeCompare(aDate);
        })
        .slice(0, 8)
    : [];

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) { onChange(""); return; }
    const entry = registry.findOrCreate(trimmed);
    // CHANGED 18 Aug 2026 — real bug: draft never synced back to the
    // entry's canonical stored name after commit, so typing "sauna"
    // when "Sauna" already existed would match the existing entry
    // (findOrCreate is case-insensitive) but leave the field showing
    // lowercase "sauna" — visually inconsistent with what's actually
    // saved. This is very likely what "doesn't feel right after
    // clicking out" was describing.
    if (entry) { onChange(entry.id); setDraft(entry.name); }
  };

  const tapSuggestion = (entry) => {
    onChange(entry.id);
    setDraft(entry.name);
  };

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 12, color: T.textSecondary }}>{label}</div>
        {showLocateButton && (
          <span onClick={locating ? undefined : useCurrentLocation}
            style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: T.encountersPink, cursor: locating ? "default" : "pointer", opacity: locating ? 0.6 : 1 }}>
            <Crosshair size={12} weight="bold" /> {locating ? "Locating…" : "Use current location"}
          </span>
        )}
      </div>
      {locateError && <div style={{ fontSize: 11, color: T.actionRed, marginBottom: 4 }}>{locateError}</div>}
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {visibleSuggestions.map((e) => (
            <div key={e.id} onMouseDown={(ev) => ev.preventDefault()} onClick={() => tapSuggestion(e)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.encountersPink}`, color: T.encountersPink, cursor: "pointer" }}>
              {e.name}
            </div>
          ))}
        </div>
      )}
      {/* CHANGED — real ask: Location's native `list`/`<datalist>`
          dropdown (removed here) was rendering on top of the on-screen
          keyboard on Android, making both unusable at once. The
          visible suggestion chips above already cover "pick existing"
          — same fix applied to every other picker in the app using
          this pattern, not just this one. */}
      <input value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        placeholder={placeholder || "Pick existing or type a new one"}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
    </div>
  );
}

// CHANGED — real ask: "attendees currently had big list of all
// contacts. Instead should be searchable/suggestible for one or two at
// a time." Was every non-archived contact rendered as a chip
// simultaneously — with 34 real contacts, a genuinely unusable wall of
// chips. Now a real search-as-you-type picker; selected attendees show
// as removable chips above the search box, matching results only show
// while actively searching.
function AttendeePicker({ value, onChange, T, contacts, onCreatePlaceholder }) {
  const [query, setQuery] = useState("");
  const toggle = (id) => {
    const has = value.includes(id);
    onChange(has ? value.filter((v) => v !== id) : [...value, id]);
  };
  const selected = value.map((id) => contacts.find((c) => c.id === id)).filter(Boolean);
  const q = query.trim().toLowerCase();
  const matches = q
    ? contacts.filter((c) => !c.isArchived && !value.includes(c.id) && (c.name.toLowerCase().includes(q) || (c.nickname || "").toLowerCase().includes(q))).slice(0, 8)
    : [];
  // ADDED 26 Aug 2026 — real ask, decided: allow adding someone not
  // yet in Contacts, right from here, instead of blocking the whole
  // Activity on a separate trip to Contacts first.
  const handleCreate = () => {
    const created = onCreatePlaceholder(query.trim());
    onChange([...value, created.id]);
    setQuery("");
  };
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>Attendees</div>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {selected.map((c) => (
            <div key={c.id} onClick={() => toggle(c.id)}
              style={{ padding: "6px 10px", borderRadius: radius.full, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, border: `1px solid ${T.encountersPink}`, color: T.encountersPink, background: `${T.encountersPink}15` }}>
              {c.nickname || c.name} <X size={12} />
            </div>
          ))}
        </div>
      )}
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search contacts to add…"
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
      {matches.length > 0 && (
        <div style={{ marginTop: 6, border: `1px solid ${T.border}`, borderRadius: radius.sm, overflow: "hidden" }}>
          {matches.map((c) => (
            <div key={c.id} onClick={() => { toggle(c.id); setQuery(""); }}
              style={{ padding: "10px 12px", fontSize: 14, color: T.textPrimary, cursor: "pointer", borderBottom: `1px solid ${T.border}` }}>
              {c.nickname || c.name}
            </div>
          ))}
        </div>
      )}
      {q && matches.length === 0 && (
        <div onClick={handleCreate}
          style={{ marginTop: 6, padding: "10px 12px", fontSize: 13, fontWeight: 600, color: T.encountersPink, border: `1px dashed ${T.encountersPink}`, borderRadius: radius.sm, cursor: "pointer" }}>
          + Add "{query.trim()}" as a new contact
        </div>
      )}
      {contacts.length === 0 && <div style={{ fontSize: 12, color: T.textDisabled, fontStyle: "italic" }}>No contacts yet — start typing a name above to add one.</div>}
    </div>
  );
}

function ReadRow({ label, value, T }) {
  const display = Array.isArray(value) ? value.join(", ") : value;
  if (!display && display !== 0) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
      <span style={{ color: T.textSecondary }}>{label}</span>
      <span style={{ color: T.textPrimary, fontWeight: 600, textAlign: "right", maxWidth: "60%" }}>{display}</span>
    </div>
  );
}

// ── Encounter Card (Doc 3 B2) — used in the Activity Landing timeline ──
function EncounterCard({ encounter, contacts, T, onClick, selectMode = false, selected = false, onToggleSelected, onLongPress }) {
  const attendeeNames = encounter.attendeeIds.map((id) => contactName(contacts, id));
  const shown = attendeeNames.slice(0, 3);
  const extra = attendeeNames.length - shown.length;
  const locationName = encounter.locationId ? (LocationsRepository.getById(encounter.locationId)?.name || "") : "";
  // Local copy — ActivityDetails has its own further down; this card
  // renders in a different component/scope (the encounter list), so it
  // needs its own rather than reaching across function boundaries.
  const kinkNames = encounter.kinksInvolved.map((sel) => {
    const name = KinkRegistry.getById(sel.kinkId)?.name;
    return name ? (sel.role ? `${name} (${sel.role})` : name) : null;
  }).filter(Boolean);
  // ADDED 26 Aug 2026 — real ask: long-press multi-select, rolled out
  // to every module — same pattern as Contacts' own ContactCard.
  const pressTimer = useRef(null);
  // CHANGED — real ask: long-press for select/multiselect fired too
  // easily. 750ms (1.5x the original 500ms), same across every module
  // using this pattern.
  // ADDED — real bug the user flagged: resting a finger on a card
  // while scrolling (or scrolling slowly) still fired long-press —
  // see Contacts' own ContactCard for the full reasoning, same fix.
  const pressStartPos = useRef(null);
  const startPress = (e) => {
    if (e?.touches?.[0]) pressStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    pressTimer.current = setTimeout(() => onLongPress?.(encounter.id), 750);
  };
  const cancelPress = () => { clearTimeout(pressTimer.current); pressStartPos.current = null; };
  const handleTouchMove = (e) => {
    if (!pressStartPos.current || !e.touches?.[0]) return;
    const dx = e.touches[0].clientX - pressStartPos.current.x;
    const dy = e.touches[0].clientY - pressStartPos.current.y;
    if (Math.hypot(dx, dy) > 10) cancelPress();
  };
  const handleClick = () => {
    if (selectMode) onToggleSelected?.(encounter.id);
    else onClick();
  };
  return (
    <div onClick={handleClick} onMouseDown={startPress} onMouseUp={cancelPress} onMouseLeave={cancelPress} onTouchStart={startPress} onTouchMove={handleTouchMove} onTouchEnd={cancelPress}
      role={selectMode ? "checkbox" : "button"} aria-checked={selectMode ? selected : undefined} aria-label={encounter.title || "Untitled encounter"} tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); } }}
      style={{ border: `1px solid ${selected ? T.encountersPink : T.border}`, borderRadius: radius.md, background: selected ? `${T.encountersPink}10` : T.surface, padding: 14, marginBottom: 10, cursor: "pointer", display: "flex", gap: 10 }}>
      {selectMode && (
        <div style={{ width: 22, height: 22, borderRadius: radius.full, border: `2px solid ${selected ? T.encountersPink : T.border}`, background: selected ? T.encountersPink : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, alignSelf: "center" }}>
          {selected && <Check size={13} color="#FFFFFF" />}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <div style={{ width: 8, height: 8, borderRadius: radius.full, background: T.encountersPink }} />
            <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 15, color: T.textPrimary }}>{encounter.title || "Untitled encounter"}</span>
          </div>
          <div style={{ fontSize: 12, color: T.textSecondary }}>
            {encounter.date ? `${new Date(encounter.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · ${formatRelativeDate(encounter.date)}` : "No date"}
            {encounter.encounterType ? ` · ${encounter.encounterType}` : ""}
          </div>
        </div>
        {encounter.enjoymentRating != null && (
          <div style={{ fontSize: 12, fontFamily: "'Inter', sans-serif", color: T.textSecondary, display: "flex", alignItems: "center", gap: 3 }}>
            <Heart size={12} color={T.encountersPink} /> {encounter.enjoymentRating}
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        {shown.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: T.textSecondary }}>
            <Users size={13} />
            {shown.join(", ")}{extra > 0 ? ` +${extra}` : ""}
          </div>
        )}
        {locationName && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: T.textSecondary }}>
            <MapPin size={13} /> {locationName}
          </div>
        )}
        {kinkNames.slice(0, 3).map((name) => (
          <span key={name} style={{ fontSize: 11, padding: "2px 7px", borderRadius: radius.full, border: `1px solid ${ACTION.red}`, color: ACTION.red }}>{name}</span>
        ))}
      </div>
      </div>
    </div>
  );
}

// ── 3a. Activity Landing ──
function ActivityLanding({ T, onOpenEncounter, onAdd, encounters, refresh, deleteToast, undoDelete, redoDelete, triggerDelete }) {
  const [contacts] = useState(loadContacts);
  const [showArchived, setShowArchived] = useState(false);
  // ADDED 26 Aug 2026 — real ask: long-press multi-select, rolled out
  // to every module.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const toggleSelected = (id) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds([]); };
  // CHANGED 26 Aug 2026 — real gap found and fixed: encounters/
  // deletedRecent/undoDelete/triggerDelete used to live only here, so
  // a single-record delete from ActivityDetails wrote to Trash but
  // showed no undo toast, and couldn't refresh this list's data either
  // — lifted to EncountersModule (the real parent of both this and
  // ActivityDetails) so both screens share one source of truth.
  // ADDED 26 Aug 2026 — real ask: filters like Contacts has — last
  // week/month, or since last test. "Since last test" reuses the same
  // most-recent-test lookup Home's own dashboard already does, not a
  // separate calculation.
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState(null); // null | "week" | "month" | "sinceLastTest"
  // ADDED 1 Sep 2026 — real ask: "add encounters search" — every
  // sibling module (Contacts, Medication, Testing, Symptom Log,
  // Resources, Glossary) already has a search box; this was the one
  // module missing it. Matches title or an attendee's name, same
  // fields the card itself already shows.
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const base = encounters.filter((e) => (showArchived ? true : !e.isArchived));
    let filtered = base;
    if (dateFilter) {
      const dated = base.filter((e) => e.date);
      if (dateFilter === "week") {
        const cutoff = Date.now() - 7 * 86400000;
        filtered = dated.filter((e) => new Date(e.date).getTime() >= cutoff);
      } else if (dateFilter === "month") {
        const cutoff = Date.now() - 30 * 86400000;
        filtered = dated.filter((e) => new Date(e.date).getTime() >= cutoff);
      } else if (dateFilter === "sinceLastTest") {
        const tests = TestingRepository.getAll().filter((t) => !t.isArchived && t.date && new Date(t.date) <= new Date());
        const lastTest = [...tests].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        filtered = lastTest ? dated.filter((e) => new Date(e.date).getTime() >= new Date(lastTest.date).getTime()) : dated;
      }
    }
    const q = query.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((e) => {
        const attendeeNames = e.attendeeIds.map((id) => contactName(contacts, id));
        return [e.title, ...attendeeNames].filter(Boolean).some((v) => v.toLowerCase().includes(q));
      });
    }
    return sortByDateDesc(filtered);
  }, [encounters, showArchived, dateFilter, query, contacts]);

  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 90 }}>
      <div style={{ position: "sticky", top: 0, background: T.bg, zIndex: 5 }}>
        {/* ADDED 26 Aug 2026 — real ask: page title on a banner filled
            with the module's own colour, same pattern applied across
            every module this pass. */}
        <div style={{ background: T.encountersPink, borderBottom: "2px solid rgba(0,0,0,0.15)", padding: "16px 16px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 22, color: "#FFFFFF" }}>Encounter</span>
          {/* ADDED 26 Aug 2026 — real ask: explicit Select toggle,
              matching Medication's pattern — long-press stays as an
              additional quick entry. */}
          <span onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)} style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF", cursor: "pointer" }}>
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
              <span onClick={() => setSelectedIds(selectedIds.length === visible.length ? [] : visible.map((e) => e.id))}
                style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600, cursor: "pointer" }}>
                {selectedIds.length === visible.length ? "Deselect all" : "Select all"}
              </span>
              {/* ADDED 26 Aug 2026 — real ask: export/print a single
                  record, enabled only when exactly one is selected. */}
              <span onClick={() => { if (selectedIds.length === 1) exportRecordAsFile("encounters", EncounterRepository.getById(selectedIds[0])); }}
                style={{ fontSize: 13, color: selectedIds.length === 1 ? "#FFFFFF" : "#89898C", fontWeight: 600, cursor: selectedIds.length === 1 ? "pointer" : "default" }}>Export</span>
              <span onClick={() => { if (selectedIds.length > 0) { EncounterRepository.bulkArchive(selectedIds); refresh(); exitSelectMode(); } }}
                style={{ fontSize: 13, color: selectedIds.length > 0 ? "#FFFFFF" : "#89898C", fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>Archive</span>
              <span onClick={() => {
                if (selectedIds.length === 0) return;
                if (window.confirm(`Delete ${selectedIds.length} activit${selectedIds.length > 1 ? "ies" : "y"}? You'll have a few seconds to undo.`)) {
                  const toRestore = EncounterRepository.getAll().filter((e) => selectedIds.includes(e.id));
                  triggerDelete(toRestore);
                  refresh();
                  exitSelectMode();
                }
              }} style={{ fontSize: 13, color: selectedIds.length > 0 ? DARK.actionRed : "#89898C", fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>Delete</span>
              <span onClick={exitSelectMode} style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600, cursor: "pointer" }}>Cancel</span>
            </div>
          </div>
        )}
        {/* ADDED 1 Sep 2026 — real ask: search within module, same
            placement/pattern as every sibling module's own search box. */}
        <div style={{ padding: "8px 16px 0" }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search encounters"
            style={{ width: "100%", padding: "8px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
        </div>
        <div style={{ padding: "8px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div onClick={() => setShowArchived((s) => !s)} style={{ fontSize: 12, color: T.textSecondary, cursor: "pointer" }}>
            {showArchived ? "Hide archived" : "Show archived"}
          </div>
          {/* ADDED 26 Aug 2026 — real ask: filters like Contacts has. */}
          <div onClick={() => setShowFilters((s) => !s)} style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 8px", borderRadius: radius.full, cursor: "pointer", border: `1px solid ${dateFilter ? T.encountersPink : T.border}`, color: dateFilter ? T.encountersPink : T.textSecondary, fontSize: 11, fontWeight: 600 }}>
            Filter{dateFilter ? " (1)" : ""}
          </div>
        </div>
        {showFilters && (
          <div style={{ padding: "8px 16px 0", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[
              { key: "week", label: "Last week" },
              { key: "month", label: "Last month" },
              { key: "sinceLastTest", label: "Since last test" },
            ].map((f) => {
              const active = dateFilter === f.key;
              return (
                <div key={f.key} onClick={() => setDateFilter(active ? null : f.key)}
                  style={{ padding: "5px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? T.encountersPink : T.border}`, color: active ? T.encountersPink : T.textSecondary, background: active ? `${T.encountersPink}15` : "transparent" }}>
                  {f.label}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div style={{ padding: "8px 16px" }}>
        {visible.length === 0 && (
          <div style={{ textAlign: "center", color: T.textDisabled, fontStyle: "italic", padding: "40px 0" }}>
            {query.trim() ? "No encounters match your search." : "No encounters logged yet."}
          </div>
        )}
        {visible.map((e) => (
          <EncounterCard key={e.id} encounter={e} contacts={contacts} T={T} onClick={() => onOpenEncounter(e.id)}
            selectMode={selectMode} selected={selectedIds.includes(e.id)} onToggleSelected={toggleSelected} onLongPress={(id) => { setSelectMode(true); toggleSelected(id); }} />
        ))}
      </div>
      {/* ADDED 26 Aug 2026 — real ask: undo for delete. */}
      {deleteToast && (
        <div onClick={deleteToast.mode === "undo" ? undoDelete : redoDelete}
          style={{ position: "fixed", bottom: 90, left: 20, right: 20, maxWidth: 560, margin: "0 auto", background: "#1B1B1F", color: "#FFFFFF", padding: "12px 16px", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", zIndex: 40, boxShadow: "0 4px 16px rgba(0,0,0,.3)" }}>
          <span style={{ fontSize: 13 }}>
            {deleteToast.mode === "undo"
              ? `${deleteToast.records.length} activit${deleteToast.records.length > 1 ? "ies" : "y"} deleted`
              : `${deleteToast.records.length} activit${deleteToast.records.length > 1 ? "ies" : "y"} restored`}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.encountersPink }}>
            {deleteToast.mode === "undo" ? "Tap to undo" : "Tap to redo"}
          </span>
        </div>
      )}
      {/* CHANGED 19 Aug 2026 — same fix as Contacts' Add button: now
          clears the nav bar (was sitting within its height) and
          matches Contacts' exact position so both align vertically. */}
      {/* CHANGED — real ask: icon size normalized to 24, matching
          Contacts/Medication's identical FAB pattern exactly — was 26,
          a small but genuine inconsistency within an identically-sized
          56x56 circle across all three screens using this pattern.
          CHANGED 26 Aug 2026 — real audit finding: same fix as
          Contacts, wrapped for wide-viewport centering. */}
      <div style={{ position: "fixed", bottom: 90, left: 0, right: 0, maxWidth: 600, margin: "0 auto", display: "flex", justifyContent: "flex-end", padding: "0 20px", pointerEvents: "none" }}>
        <div onClick={onAdd} style={{ width: 56, height: 56, borderRadius: radius.full, background: T.fabBg, color: T.fabIcon, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,.2)", pointerEvents: "auto" }}>
          <Plus size={24} />
        </div>
      </div>
    </div>
  );
}

// ── 3b. Activity Details ──
function ActivityDetails({ T, encounterId, onBack, onEdit, onNavigateToRecord, triggerDelete, refresh }) {
  const [encounter, setEncounter] = useState(() => EncounterRepository.getById(encounterId));
  const [contacts] = useState(loadContacts);
  const [menuOpen, setMenuOpen] = useState(false);
  // ADDED — real ask: real delete, with a confirmation step, same
  // pattern already proven across every other module this session.
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!encounter) return null;

  // Resolves an array of registry IDs to their display names — used
  // below for Kinks/Chems/Protection/Symptoms, since those are now real
  // registry links, not plain strings.
  const resolveNames = (registry, ids) => ids.map((id) => registry.getById(id)?.name).filter(Boolean);
  // ADDED 18 Aug 2026 — kinksInvolved is now {kinkId, role} selections,
  // not plain IDs (see encounterRepository.js) — this resolves each to
  // its display name, appending the role in parentheses when set.
  const resolveKinkSelections = (selections) => selections.map((sel) => {
    const name = KinkRegistry.getById(sel.kinkId)?.name;
    return name ? (sel.role ? `${name} (${sel.role})` : name) : null;
  }).filter(Boolean);
  const locationName = encounter.locationId ? (LocationsRepository.getById(encounter.locationId)?.name || "") : "";

  const archive = () => {
    EncounterRepository.archive(encounter.id);
    setEncounter(EncounterRepository.getById(encounter.id));
    setMenuOpen(false);
  };

  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 40 }}>
      {/* CHANGED — real ask: "Next to back button shows date, instead
          should show back, and centred on screen at top should be the
          encounter title." Real title (not date) now centered; date
          moved into the byline below instead. */}
      {/* FIXED — real ask: "cuts off top of screen by title". This was
          the only detail screen in the app using position:sticky for
          its header (Testing's TestDetail, the reference detail
          screen, uses a plain in-flow header) — sticky positioning has
          known top-edge clipping/repaint issues on some Android
          WebView versions. Matches the established, already-working
          pattern instead of a remote guess at the exact sticky bug. */}
      <div style={{ background: T.bg, padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* FIXED 1 Sep 2026 — real ask: "three dots to edit not obvious"
            in dark mode, "look through app for any other similar
            instances". Neither icon here had a `color` at all, so both
            fell back to the browser's default black — invisible
            against T.bg's near-black in dark mode. Matches the
            established pattern used everywhere else in the app
            (Testing's TestDetail, the reference "good" screen the user
            named): T.textPrimary for plain nav, the module's own
            accent for the thing that opens edit/actions. */}
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer", flexShrink: 0 }} onClick={onBack} />
        <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 17, color: T.textPrimary, flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 8px" }}>
          {encounter.title || (encounter.date ? new Date(encounter.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Encounter")}
        </span>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <MoreVertical size={20} color={T.encountersPink} style={{ cursor: "pointer" }} onClick={() => setMenuOpen((o) => !o)} />
          {menuOpen && (
            <div style={{ position: "absolute", right: 0, top: 26, background: T.surface, border: `1px solid ${T.border}`, borderRadius: radius.sm, boxShadow: "0 4px 16px rgba(0,0,0,.15)", zIndex: 10, minWidth: 140 }}>
              <div onClick={() => { setMenuOpen(false); onEdit(encounter.id); }} style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer", color: T.textPrimary }}>Edit</div>
              <div onClick={archive} style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer", color: T.actionRed, display: "flex", alignItems: "center", gap: 6 }}>
                <Archive size={14} /> {encounter.isArchived ? "Unarchive" : "Archive"}
              </div>
              <div onClick={() => { setMenuOpen(false); setConfirmDelete(true); }} style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer", color: T.actionRed, display: "flex", alignItems: "center", gap: 6, borderTop: `1px solid ${T.border}` }}>
                <Trash2 size={14} /> Delete permanently
              </div>
            </div>
          )}
        </div>
      </div>
      {encounter.title && encounter.date && (
        <div style={{ padding: "0 16px", marginTop: -8, marginBottom: 8, fontSize: 12, color: T.textSecondary, textAlign: "center" }}>
          {new Date(encounter.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
        </div>
      )}

      {confirmDelete && (
        <div style={{ margin: "0 16px 12px", padding: 12, borderRadius: radius.sm, border: `1px solid ${T.actionRed}`, background: `${T.actionRed}11` }}>
          <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 8 }}>
            This permanently deletes the record — unlike archiving, there's no getting it back. Only use this for a genuinely wrong entry.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: 10, borderRadius: 999, border: `1px solid ${T.border}`, background: "transparent", color: T.textSecondary, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => { triggerDelete([encounter]); refresh(); onBack(); }} style={{ flex: 1, padding: 10, borderRadius: 999, border: "none", background: T.actionRed, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Delete permanently</button>
          </div>
        </div>
      )}

      <div style={{ padding: "0 16px" }}>
        {encounter.isArchived && (
          <div style={{ background: `${T.actionRed}15`, border: `1px solid ${T.actionRed}`, borderRadius: radius.sm, padding: 10, fontSize: 12, color: T.actionRed, marginBottom: 4 }}>
            This encounter is archived.
          </div>
        )}

        <SectionCard title="Overview" T={T}>
          <ReadRow label="Title" value={encounter.title} T={T} />
          <ReadRow label="Encounter type" value={encounter.encounterType} T={T} />
          <ReadRow label="Time of day" value={timeOfDay(encounter.date)} T={T} />
          {/* ADDED — real ask: optional end date/time, for multi-day or
              particularly long encounters — see the Edit form's own
              comment for why this data already existed with no UI. */}
          <ReadRow label="Ends" value={encounter.dateEnd ? new Date(encounter.dateEnd).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : null} T={T} />
          <ReadRow label="Would meet again" value={encounter.wouldMeetAgain} T={T} />
          <ReadRow label="Enjoyment rating" value={encounter.enjoymentRating} T={T} />
        </SectionCard>

        <SectionCard title="Attendees" T={T}>
          {encounter.attendeeIds.length === 0
            ? <div style={{ fontSize: 13, color: T.textDisabled, fontStyle: "italic", padding: "8px 0" }}>None recorded.</div>
            : encounter.attendeeIds.map((id) => (
              // CHANGED — real ask: "attendees should link through to
              // contact card and open if clicked." Real cross-module
              // navigation now exists (see App.jsx's navigateToRecord).
              <div key={id} onClick={() => onNavigateToRecord?.("contacts", id)}
                style={{ padding: "8px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13, color: T.encountersPink, fontWeight: 600, cursor: onNavigateToRecord ? "pointer" : "default" }}>
                {contactName(contacts, id)}
              </div>
            ))}
        </SectionCard>

        <SectionCard title="Practices" T={T}>
          <ReadRow label="My role" value={encounter.myRole} T={T} />
          <ReadRow label="My position" value={encounter.myPosition} T={T} />
          <ReadRow label="Where did I cum?" value={encounter.whereICame} T={T} />
          <ReadRow label="Where did my partner cum?" value={encounter.whereHeCame} T={T} />
        </SectionCard>

        <SectionCard title="Kink & chems" T={T}>
          <ReadRow label="Kinks involved" value={resolveKinkSelections(encounter.kinksInvolved)} T={T} />
          <ReadRow label="Chems/alcohol used" value={resolveNames(ChemsRegistry, encounter.chemsAlcoholUsed)} T={T} />
        </SectionCard>

        <SectionCard title="Protection & medication context" T={T}>
          <ReadRow label="Protection used" value={resolveNames(ProtectionRegistry, encounter.protectionUsed)} T={T} />
          <ReadRow label="My PrEP coverage" value={encounter.myPrepCoverage} T={T} />
          <ReadRow label="My DoxyPEP status" value={encounter.myDoxyPepStatus} T={T} />
        </SectionCard>

        <SectionCard title="Health" T={T}>
          <ReadRow label="Symptoms noted" value={resolveNames(SymptomsRegistry, encounter.symptomsNoted)} T={T} />
        </SectionCard>

        <SectionCard title="Location" T={T}>
          <ReadRow label="Location" value={locationName} T={T} />
        </SectionCard>

        <SectionCard title="Notes" T={T}>
          <div style={{ fontSize: 14, color: encounter.notes ? T.textPrimary : T.textDisabled, fontStyle: encounter.notes ? "normal" : "italic" }}>
            {encounter.notes || "No notes yet."}
          </div>
        </SectionCard>
        {/* ADDED 26 Aug 2026 — real ask: last-updated indicator. */}
        {encounter.updatedAt && (
          <div style={{ textAlign: "center", fontSize: 11, color: T.textSecondary, marginTop: 16 }}>
            Last updated {new Date(encounter.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add/Edit sheet ──
function EncounterEditSheet({ T, encounterId, onClose, onSaved, onBeforeEdit, onAfterEdit, onNavigateToRecord }) {
  const isNew = !encounterId;
  const [contacts, setContacts] = useState(loadContacts);
  // ADDED 26 Aug 2026 — real ask, decided: can't add an Activity for
  // someone not yet in Contacts, since AttendeePicker only searches
  // existing contacts. Rather than blocking with a warning, allow a
  // minimal placeholder contact (name only) created inline, then push
  // The user straight to finishing that contact's real profile right
  // after the Activity saves — the user's own suggested flow. Tracks IDs
  // created THIS session only (not a stored flag on the contact
  // itself — a contact with just a name is already self-evidently
  // incomplete, no schema change needed to detect that later).
  const [placeholderContactIds, setPlaceholderContactIds] = useState([]);
  const createPlaceholderContact = (name) => {
    const created = ContactRepository.create({ name });
    setContacts(loadContacts());
    setPlaceholderContactIds((ids) => [...ids, created.id]);
    return created;
  };
  // ADDED 19 Aug 2026 — draft autosave, same pattern/reasoning as
  // Contacts — see draftStorage.js.
  const draftKey = `encounterEdit_${encounterId || "new"}`;
  const [form, setForm] = useState(() => {
    const draft = loadDraft(draftKey);
    if (draft) return draft.data;
    return isNew ? { ...DEFAULT_ENCOUNTER } : EncounterRepository.getById(encounterId);
  });
  const [draftRestored] = useState(() => !!loadDraft(draftKey));
  // CHANGED — real bug from the user's own testing: this fired on the
  // very first render too, immediately autosaving the pristine,
  // untouched default form the instant "Add Encounter" opened — so
  // just opening and closing it with zero real edits left a "draft"
  // behind, which then showed as a false "Restored unsaved changes"
  // next time. Skips the initial mount with a ref, only saves once the
  // form has genuinely changed from what it started as.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    saveDraft(draftKey, form);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);
  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const save = () => {
    clearDraft(draftKey);
    if (isNew) {
      EncounterRepository.create(form);
    } else {
      // ADDED 19 Aug 2026 — real undo/redo: snapshot taken right
      // before the update actually happens, so undo has the genuine
      // pre-edit state to restore, not a guess.
      onBeforeEdit?.(encounterId);
      EncounterRepository.update(encounterId, form);
      onAfterEdit?.(encounterId);
    }
    // ADDED 26 Aug 2026 — real ask: DoxyPEP 72h notification. A new or
    // edited Activity is exactly what can start (or, if myPosition was
    // edited to no longer qualify, clear) a countdown — re-sync
    // immediately rather than waiting for the next app open.
    syncDoxyPepAlert();
    // ADDED 26 Aug 2026 — real ask: push straight to finishing the
    // placeholder contact's profile right after the Activity saves,
    // if one was created this session. Only the most recent one if
    // several — finishing one at a time is enough, the rest are still
    // easy to find in Contacts afterward.
    onSaved(placeholderContactIds[placeholderContactIds.length - 1] || null);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 200, overflowY: "auto" }} data-encounter-sheet>
      {/* CHANGED 26 Aug 2026 — real ask: forms (Add/Edit Activity)
          should also have the module banner title, matching every
          other module screen. */}
      <div style={{ position: "sticky", top: 0, background: T.encountersPink, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <X size={22} color="#FFFFFF" style={{ cursor: "pointer" }} onClick={onClose} aria-label="Close" />
        <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 16, color: "#FFFFFF" }}>{isNew ? "Add Encounter" : "Edit Encounter"}</span>
        <div onClick={save}
          style={{ padding: "6px 14px", borderRadius: radius.full, background: "#FFFFFF", color: T.encountersPink, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          Save
        </div>
      </div>

      {draftRestored && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, margin: "10px 16px 0", fontSize: 11, color: T.actionGreen, background: `${T.actionGreen}15`, borderRadius: radius.sm, padding: "6px 10px" }}>
          <span>Restored unsaved changes from earlier.</span>
          {/* ADDED 19 Aug 2026 — same "discard and start clean" option
              Contacts got, same reasoning. */}
          <span onClick={() => { clearDraft(draftKey); setForm(isNew ? { ...DEFAULT_ENCOUNTER } : EncounterRepository.getById(encounterId)); }}
            style={{ fontWeight: 700, cursor: "pointer", textDecoration: "underline", flexShrink: 0 }}>
            Clear & start fresh
          </span>
        </div>
      )}

      <div style={{ padding: "0 16px 60px" }}>
        <SectionCard title="Overview" T={T}>
          <TextField label="Title" value={form.title} onChange={set("title")} T={T} placeholder="e.g. Alex — coffee then back to theirs" />
          <DateTimeField label="Date & time" value={form.date} onChange={set("date")} T={T} />
          {/* ADDED — real ask: "optional end time for encounter (ie if
              multiday or particularly long)". `dateEnd` already existed
              on the data model (DEFAULT_ENCOUNTER) but had no UI
              anywhere — genuinely wired up now. Left blank by default
              and no separate toggle needed: it's just an optional
              field, same pattern as Clinic Visits' own "(optional)"
              Location field. */}
          {form.dateEnd ? (
            <>
              <DateTimeField label="End date & time" value={form.dateEnd} onChange={set("dateEnd")} T={T} />
              <div style={{ padding: "0 0 8px" }}>
                <span onClick={() => set("dateEnd")("")} style={{ fontSize: 11, color: T.textSecondary, cursor: "pointer", textDecoration: "underline" }}>Remove end time</span>
              </div>
            </>
          ) : (
            <div style={{ padding: "8px 0" }}>
              <span onClick={() => set("dateEnd")(form.date || `${nowAsDateTimeLocalString()}:00.000Z`)}
                style={{ fontSize: 12, fontWeight: 700, color: T.encountersPink, cursor: "pointer" }}>
                + Add end date & time (multi-day or long encounter)
              </span>
            </div>
          )}
          <SelectField label="Encounter type" value={form.encounterType} onChange={set("encounterType")} options={ENCOUNTER_TYPE_OPTIONS} T={T} />
          <SelectField label="Would meet again" value={form.wouldMeetAgain} onChange={set("wouldMeetAgain")} options={WOULD_MEET_AGAIN_OPTIONS} T={T} />
          <TextField label="Enjoyment rating (0–100)" value={form.enjoymentRating} onChange={set("enjoymentRating")} T={T} type="number" />
        </SectionCard>

        {/* CHANGED 26 Aug 2026 — real ask: "who and where" together —
            Location moved up here from near the bottom of the form,
            merged into the same section as Attendees. */}
        <SectionCard title="Attendees & Location" T={T}>
          <AttendeePicker value={form.attendeeIds} onChange={set("attendeeIds")} T={T} contacts={contacts} onCreatePlaceholder={createPlaceholderContact} />
          <RegistrySinglePicker label="Location" value={form.locationId} onChange={set("locationId")} T={T} registry={LocationsRepository} placeholder="e.g. His place, Sauna" showLocateButton />
        </SectionCard>

        <SectionCard title="Practices" T={T}>
          <SelectField label="My role" value={form.myRole} onChange={set("myRole")} options={MY_ROLE_OPTIONS} T={T} />
          <GivingReceivingChips label="My position" value={form.myPosition} onChange={set("myPosition")} options={MY_POSITION_OPTIONS} T={T} />
          <MultiSelectChips label="Where did I cum?" value={form.whereICame} onChange={set("whereICame")} options={CUM_LOCATION_OPTIONS} T={T} />
          <MultiSelectChips label="Where did my partner cum?" value={form.whereHeCame} onChange={set("whereHeCame")} options={CUM_LOCATION_OPTIONS} T={T} />
        </SectionCard>

        <SectionCard title="Kink & chems" T={T}>
          <RegistryTagPicker label="Kinks involved" value={form.kinksInvolved} onChange={set("kinksInvolved")} T={T} registry={KinkRegistry} trackRole roleOptions={KINK_ROLE_OPTIONS} resolveSynonym={resolveKinkSynonym} analyzeEntry={analyzeKinkEntry} getRoleOptionsForKink={getKinkRoleOptions} />
          <RegistryTagPicker label="Chems/alcohol used" value={form.chemsAlcoholUsed} onChange={set("chemsAlcoholUsed")} T={T} registry={ChemsRegistry} resolveSynonym={resolveChemSynonym} />
        </SectionCard>

        <SectionCard title="Protection & medication context" T={T}>
          <RegistryTagPicker label="Protection used" value={form.protectionUsed} onChange={set("protectionUsed")} T={T} registry={ProtectionRegistry} />
          <SelectField label="My PrEP coverage" value={form.myPrepCoverage} onChange={set("myPrepCoverage")} options={PREP_COVERAGE_OPTIONS} T={T} />
          <SelectField label="My DoxyPEP status" value={form.myDoxyPepStatus} onChange={set("myDoxyPepStatus")} options={DOXYPEP_STATUS_OPTIONS} T={T} />
        </SectionCard>

        <SectionCard title="Health" T={T}>
          <RegistryTagPicker label="Symptoms noted" value={form.symptomsNoted} onChange={set("symptomsNoted")} T={T} registry={SymptomsRegistry} />
        </SectionCard>

        <SectionCard title="Notes" T={T}>
          <textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} rows={4}
            style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box", marginTop: 8 }} />
        </SectionCard>
      </div>
    </div>
  );
}

// ── Top-level module component — same shape as the Contacts/Medication
// top-level components, so App.jsx's switcher can drop this in directly. ──
// ADDED 19 Aug 2026 — real ask, the user's own example (edit an Encounter,
// realise it was wrong, want undo/redo): shared toast, same visual
// pattern as Medication's own undo/redo toast, kept consistent rather
// than inventing a new look for the same idea.
function EditUndoToast({ toast, onUndo, onRedo, T }) {
  if (!toast) return null;
  const isUndo = toast.mode === "undo";
  // CHANGED — real ask: this sat at top:12, directly on top of the
  // screen's own back button — the instinctive "do the edit, then tap
  // back" motion hit the toast instead. top:64 clears every header
  // shape in this app.
  return (
    <div onClick={isUndo ? onUndo : onRedo}
      style={{ position: "fixed", top: 64, left: "50%", transform: "translateX(-50%)", width: 340, background: isUndo ? "#1B1B1F" : T.encountersPink, color: "#FFFFFF", borderRadius: 999, padding: "10px 16px", fontSize: 13, fontWeight: 600, textAlign: "center", cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,.25)", zIndex: 230, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
      {isUndo ? <Check size={14} /> : <RefreshCcw size={14} />}
      {isUndo ? "Encounter updated — tap to undo" : "Undone — tap to redo"}
    </div>
  );
}

export default function EncountersModule({ openAddOnMount = false, onConsumedQuickAdd, openRecordId, onConsumedRecordOpen, onNavigateToRecord, registerModuleBackHandler } = {}) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : LIGHT;
  const [screen, setScreen] = useState({ name: "landing" });
  // CHANGED 26 Aug 2026 — real gap found and fixed: lifted from
  // ActivityLanding (see that component's own comment for the full
  // reasoning) — encounters/deletedRecent/undoDelete/triggerDelete now
  // live at the real module level, shared by both ActivityLanding and
  // ActivityDetails.
  const [encounters, setEncounters] = useState(loadEncounters);
  const refresh = () => setEncounters(loadEncounters());
  // CHANGED 26 Aug 2026 — real ask, previously flagged low-priority and
  // now built: redo for delete, not just undo — same {mode, records}
  // shape already proven in Contacts (this session's reference
  // implementation) and editUndoHelpers.js's own undo/redo for edits.
  const [deleteToast, setDeleteToast] = useState(null); // { mode: "undo" | "redo", records }
  const undoTimerRef = useRef(null);
  const undoDelete = () => {
    if (!deleteToast) return;
    deleteToast.records.forEach((record) => EncounterRepository.restore(record));
    refresh();
    clearTimeout(undoTimerRef.current);
    setDeleteToast({ mode: "redo", records: deleteToast.records });
    undoTimerRef.current = setTimeout(() => setDeleteToast(null), 8000);
  };
  const redoDelete = () => {
    if (!deleteToast) return;
    TrashRepository.add("encounters", deleteToast.records);
    deleteToast.records.forEach((r) => EncounterRepository.delete(r.id));
    refresh();
    setDeleteToast(null);
    clearTimeout(undoTimerRef.current);
  };
  const triggerDelete = (records) => {
    TrashRepository.add("encounters", records);
    records.forEach((r) => EncounterRepository.delete(r.id));
    setDeleteToast({ mode: "undo", records });
    clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setDeleteToast(null), 8000);
  };
  // ADDED 26 Aug 2026 — real ask: back should go one step within this
  // module. Same real screen shape as Testing (landing/detail/edit).
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

  // ADDED 19 Aug 2026 — see editUndoHelpers.js for the full reasoning.
  // One hook instance per module, per the user's explicit scoping rule.
  const editUndo = useEditUndo(EncounterRepository);

  // ADDED 19 Aug 2026 — same Dashboard quick-add pattern as Contacts;
  // see that file for the fuller reasoning on why mount-only is enough.
  useEffect(() => {
    if (openAddOnMount) {
      setScreen({ name: "edit", id: null });
      onConsumedQuickAdd?.();
    }
    // ADDED — real ask: real cross-module navigation, same mount-time
    // pattern as Contacts' own version — deep-links straight to a
    // specific encounter when arriving here via a tapped record from
    // Contacts' Timeline, instead of always landing on the plain list.
    if (openRecordId) {
      setScreen({ name: "detail", id: openRecordId });
      onConsumedRecordOpen?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FIXED 19 Aug 2026 — real bug the user spotted ("looked like Times New
  // Roman"): every other module wraps its content in a div that sets
  // fontFamily: 'Public Sans' AND loads the actual Google Font via a
  // <style>@import</style> tag. This module never did either — it just
  // returned each screen's content directly. Individual elements that
  // explicitly set fontFamily: "'Inter', sans-serif" would still
  // fall through to the browser's default serif font, because Public
  // Sans itself was never actually loaded here, and anything that
  // *didn't* set its own fontFamily had nothing to inherit from either.
  // Same fix as every other module: one wrapper, one font import,
  // applied once regardless of which screen is showing.
  let screenContent = null;
  if (screen.name === "landing") {
    screenContent = (
      <ActivityLanding T={T}
        onOpenEncounter={(id) => setScreen({ name: "detail", id })}
        onAdd={() => setScreen({ name: "edit", id: null })}
        encounters={encounters} refresh={refresh} deleteToast={deleteToast} undoDelete={undoDelete} redoDelete={redoDelete} triggerDelete={triggerDelete} />
    );
  } else if (screen.name === "detail") {
    screenContent = (
      <ActivityDetails T={T} encounterId={screen.id}
        onBack={() => setScreen({ name: "landing" })}
        onEdit={(id) => setScreen({ name: "edit", id })}
        onNavigateToRecord={onNavigateToRecord} triggerDelete={triggerDelete} refresh={refresh} />
    );
  } else if (screen.name === "edit") {
    screenContent = (
      <EncounterEditSheet T={T} encounterId={screen.id}
        onClose={() => setScreen(screen.id ? { name: "detail", id: screen.id } : { name: "landing" })}
        onSaved={(placeholderContactId) => {
          if (placeholderContactId) {
            onNavigateToRecord?.("contacts", placeholderContactId);
          } else {
            setScreen(screen.id ? { name: "detail", id: screen.id } : { name: "landing" });
          }
        }}
        onBeforeEdit={editUndo.captureBeforeEdit}
        onAfterEdit={editUndo.notifyEdited}
        onNavigateToRecord={onNavigateToRecord} />
    );
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <EditUndoToast toast={editUndo.toast} onUndo={editUndo.undo} onRedo={editUndo.redo} T={T} />
      {screenContent}
    </div>
  );
}

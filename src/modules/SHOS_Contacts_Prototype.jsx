import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  PlusIcon as Plus, MagnifyingGlassIcon as Search, CaretLeftIcon as ChevronLeft, DotsThreeVerticalIcon as MoreVertical, XIcon as X, ArchiveIcon as Archive, GearSixIcon as Settings2, UsersIcon as Users,
  PhoneIcon as Phone, GhostIcon as Ghost, GlobeIcon as Globe, ChatCircleIcon as MessageCircle, CarIcon as Car, WarningIcon as AlertTriangle, TrashIcon as Trash2, LinkIcon as Link2,
  UploadSimpleIcon as Upload, DownloadSimpleIcon as Download, CheckIcon as Check, UserIcon as User, HouseIcon as Home, MapPinIcon as MapPin, EyeSlashIcon as EyeOff, EyeIcon as Eye, ArrowsClockwiseIcon as RefreshCcw, StarIcon as Star,
} from "@phosphor-icons/react";
import { useEditUndo } from "../calculations/editUndoHelpers";
import { nowAsDateString } from "../calculations/dateInputHelpers";
import {
  ContactRepository, DEFAULT_CONTACT,
  HOSTS_OPTIONS, TRAVELS_OPTIONS, TRAVEL_MODE_OPTIONS,
  AVAILABILITY_OPTIONS, READILY_AVAILABLE_OPTIONS, MEET_AGAIN_OPTIONS, RATING_OPTIONS,
  LENGTH_OPTIONS, GIRTH_OPTIONS, FORESKIN_OPTIONS, FORESKIN_DETAIL_OPTIONS, CHASTITY_OPTIONS,
  CUMMER_FREQUENCY_OPTIONS, CUMMER_VOLUME_OPTIONS, CUMMER_STYLE_OPTIONS,
  PREP_DOXY_OPTIONS, DAYS_OF_WEEK, TIME_CONSTRAINT_TYPES, AVAILABILITY_RULE_TYPES,
  BDSM_ROLE_OPTIONS, SEXUAL_POSITION_OPTIONS,
} from "../repositories/contactRepository";
import { TrashRepository } from "../repositories/trashRepository";
import { exportRecordAsFile } from "../storage/recordExportService";
// ADDED 26 Aug 2026 — real ask: Relationship type should be user-
// editable, not a fixed list — moved from a hardcoded array in
// contactRepository.js into the real in-app editable option list
// system already used elsewhere (Vaccine, Reason for visit, etc.).
import { CustomOptionListsRepository } from "../repositories/customOptionListsRepository";
import { getKnownCities, getKnownValues, getCompletenessScore, isContactIncomplete, getContactableVia, normalizeTag, extractKinkRoleFromText } from "../calculations/contactCalculations";
// ADDED 19 Aug 2026 — Anonymise mode. See privacySettingsRepository.js
// for the full reasoning. Read-only from Contacts' side, same
// one-directional pattern as every other cross-module read in this app.
import { PrivacySettingsRepository } from "../repositories/privacySettingsRepository";
// ADDED 19 Aug 2026 — real ask: configurable inactive-contact threshold.
import { AppPreferencesRepository } from "../repositories/appPreferencesRepository";
// New 18 Aug 2026: Encounters module now exists, so the Timeline
// section below can read real data instead of showing the "not built
// yet" stub. Read-only from Contacts' side — Contacts never writes to
// EncounterRepository, matching the one-directional storage documented
// in encounterRepository.js (Encounter holds attendeeIds, Contact-side
// numbers are calculated, never duplicated back onto the Contact record).
import { EncounterRepository } from "../repositories/encounterRepository";
import { contactEncounterSummary, sortByDateDesc, formatRelativeDate } from "../calculations/encounterCalculations";
// New 18 Aug 2026: Kink Registry and Chems Registry now exist as real
// modules — Stated kinks/Limits/Known chems below switch from freeform
// TagInput to real registry-linked pickers.
import { KinkRegistry, KINK_ROLE_OPTIONS, resolveKinkSynonym, analyzeKinkEntry, getKinkRoleOptions } from "../registries/kinkRegistry";
import { ChemsRegistry, resolveChemSynonym } from "../registries/chemsRegistry";
// ADDED 18 Aug 2026 — Import Shared Profile moved here from My Profile:
// importing creates a new Contact, so it belongs where Contacts are
// managed. Deliberately only imports the pure parse/create functions,
// not any UI — the sheet below is Contacts' own, self-contained, same
// pattern as every other module this session.
import { importProfileShareFromFile, importProfileShareFromText } from "../storage/profileShareService";
// ADDED 19 Aug 2026 — draft autosave, real fix for in-progress edits
// being lost on refresh. See draftStorage.js for the full reasoning.
import { saveDraft, loadDraft, clearDraft } from "../storage/draftStorage";
// ADDED 18 Aug 2026 — My Profile opens from here as a full-screen
// overlay (Doc 1: it's not a primary-nav tab, it's a Settings sub-item;
// Contacts is the temporary home until Settings exists). This imports
// the already self-contained top-level screen component, not any of
// its internals — same relationship as App.jsx has with every module.
import MyProfileModule from "./SHOS_MyProfile_Prototype";
// CHANGED 20 Aug 2026 — real design-unification pass: values read
// from the shared designTokens.js source of truth instead of being
// retyped here, so this screen can't silently drift from every other
// module's "same" color/radius. See designTokens.js.
import { NEUTRAL, NEUTRAL_DARK, ACCENTS, ACTION, RADIUS } from "../calculations/designTokens";
import { useDarkModePreference } from "../calculations/darkModePreference";

const LIGHT = {
  ...NEUTRAL,
  contactsTeal: ACCENTS.contacts, actionRed: ACTION.red, actionGreen: ACTION.green,
  navActive: ACCENTS.contacts, fabBg: ACCENTS.contacts, fabIcon: "#FFFFFF",
};
// Dark mode, built on Medication's own DARK object (the reference
// implementation) — neutral chrome inverts via NEUTRAL_DARK,
// actionRed/actionGreen reuse Medication's exact brightened values
// (its own comment: richer, still readable against a dark surface).
// contactsTeal is already vivid enough to read fine unchanged.
const DARK = {
  ...NEUTRAL_DARK,
  contactsTeal: ACCENTS.contacts, actionRed: "#FF7A7E", actionGreen: "#5FD9A4",
  navActive: ACCENTS.contacts, fabBg: ACCENTS.contacts, fabIcon: "#FFFFFF",
};
const radius = RADIUS;

function loadContacts() {
  return ContactRepository.getAll();
}

function btnStyle(color, variant) {
  return { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 10px", borderRadius: radius.full, fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer", border: variant === "outline" ? `1px solid ${color}` : "none", background: variant === "filled" ? color : "transparent", color: variant === "filled" ? "#FFFFFF" : color };
}

function idFromLabel(label) {
  return "combo-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function focusNextField(el) {
  const container = el.closest("[data-contact-sheet]");
  if (!container) return;
  const focusables = Array.from(container.querySelectorAll("input, textarea, select")).filter((f) => !f.disabled);
  const idx = focusables.indexOf(el);
  if (idx > -1 && idx < focusables.length - 1) focusables[idx + 1].focus();
}

// ADDED 19 Aug 2026 — Anonymise mode masking. ONE consistent
// placeholder, deliberately not a partial mask like "J*** D**" —
// partial masking can still leak enough to identify someone, a plain
// generic placeholder can't. `MASKED` covers the base tier (name,
// city, car registration); profile pictures are hidden entirely
// rather than shown blurred, for the same reason.
const MASKED = "•••• hidden";

function displayName(contact) {
  return contact.nickname || contact.name;
}

const METHOD_ICON_MAP = {
  "Phone/WhatsApp": Phone,
  "Snapchat": Ghost,
  "Fabguys": Globe,
  "Fabswingers": Globe,
};
function MethodIcons({ methods, T, size = 14 }) {
  if (!methods || methods.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {methods.map((m) => {
        const Icon = METHOD_ICON_MAP[m] || MessageCircle;
        return <Icon key={m} size={size} color={T.textSecondary} />;
      })}
    </div>
  );
}

// ── New this round: wraps a section's heading + fields in a visibly
// outlined card, per the user's ask ("sections feel like they should all be
// on a separate card/button, like outlined background area"). Used by
// both the edit sheet and the read-only Profile, so the two look
// consistent with each other. ──
function SectionCard({ title, T, children }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: radius.md, background: T.surface, padding: "4px 14px 14px", marginTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.contactsTeal, textTransform: "uppercase", letterSpacing: 0.5, paddingTop: 12, marginBottom: 2 }}>{title}</div>
      {children}
    </div>
  );
}

// ADDED 18 Aug 2026 — moved here from My Profile: importing a shared
// profile creates a new Contact, so it belongs where Contacts are
// managed, not on the "about me" screen. Self-contained, same as every
// other module's own UI this session — doesn't import UI from
// SHOS_MyProfile_Prototype.jsx, just the pure functions it needs.
function ImportSharedProfileSheet({ T, onClose, onImported }) {
  const [pasteText, setPasteText] = useState("");
  const [status, setStatus] = useState(null);

  const doImportPaste = () => {
    importProfileShareFromText(
      pasteText,
      (newContact) => { setStatus({ ok: true, msg: `Added "${newContact.name}" to your Contacts.` }); setPasteText(""); onImported?.(); },
      (err) => setStatus({ ok: false, msg: err.message })
    );
  };

  const doImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importProfileShareFromFile(
      file,
      (newContact) => { setStatus({ ok: true, msg: `Added "${newContact.name}" to your Contacts.` }); onImported?.(); },
      (err) => setStatus({ ok: false, msg: err.message })
    );
    e.target.value = "";
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 200, overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px", position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 16, color: T.textPrimary }}>Import shared profile</span>
      </div>
      <div style={{ padding: 16 }}>
        <SectionCard title="Import a shared profile" T={T}>
          <div style={{ fontSize: 12, color: T.textSecondary, padding: "8px 0" }}>
            Creates a brand-new Contact from someone else's shared profile. Doesn't touch or merge with any existing contact.
          </div>
          <div style={{ padding: "8px 0" }}>
            <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Paste a shared profile</div>
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={4}
              placeholder="Paste the JSON text someone sent you"
              style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box", resize: "vertical" }} />
          </div>
          <div onClick={doImportPaste} style={{ textAlign: "center", padding: "10px", borderRadius: radius.full, fontSize: 13, fontWeight: 600, cursor: "pointer", background: pasteText.trim() ? T.contactsTeal : T.surfaceVariant, color: pasteText.trim() ? "#FFFFFF" : T.textDisabled, marginBottom: 10 }}>
            Import from pasted text
          </div>
          <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: radius.full, border: `1px solid ${T.border}`, color: T.textPrimary, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <Upload size={15} /> Import from file
            <input type="file" accept="application/json" onChange={doImportFile} style={{ display: "none" }} />
          </label>
        </SectionCard>
        {status && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: radius.sm, marginTop: 14, background: status.ok ? `${T.actionGreen}15` : `${T.actionRed}15`, color: status.ok ? T.actionGreen : T.actionRed, fontSize: 13 }}>
            {status.ok ? <Check size={16} /> : <X size={16} />}
            {status.msg}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared form primitives ──

function TextField({ label, value, onChange, T, placeholder, type = "text", helper }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 12, color: T.textSecondary }}>{label}</div>
        {/* ADDED — real ask: "Now" quick-fill, device's real local date. */}
        {type === "date" && (
          <span onClick={() => onChange(nowAsDateString())} style={{ fontSize: 11, fontWeight: 700, color: T.contactsTeal, cursor: "pointer" }}>Now</span>
        )}
      </div>
      <input type={type} value={value ?? ""}
        onChange={(e) => onChange(type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNextField(e.target); } }}
        placeholder={placeholder}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
      {helper && <div style={{ fontSize: 11, color: T.textDisabled, marginTop: 3 }}>{helper}</div>}
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

function ComboField({ label, value, onChange, T, options, placeholder }) {
  const listId = idFromLabel(label);
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      <input list={listId} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNextField(e.target); } }}
        placeholder={placeholder || "Choose or type a new one"}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
      <datalist id={listId}>
        {options.map((opt) => <option key={opt} value={opt} />)}
      </datalist>
    </div>
  );
}

// ── New 18 Aug 2026: real address search, free, no API key — via
// OpenStreetMap's Nominatim service. This is what makes Address behave
// a bit like Notion's own Address field, per the user's ask.
//
// ⚠️ REAL, LIVE LIMITS — genuinely worth reading, not boilerplate:
// - Nominatim's public server is free but rate-limited to 1 request per
//   second and explicitly asks not to be hit with rapid/bulk queries —
//   full policy: https://operations.osmfoundation.org/policies/nominatim/
//   The 600ms debounce below exists specifically to respect this, not
//   just for UI smoothness.
// - It's a shared, donated, volunteer-run server, not a commercial SLA
//   — occasional slowness or a failed request is expected sometimes,
//   not necessarily a bug in this code.
// - Attribution ("© OpenStreetMap contributors") is required whenever
//   results are shown — kept visible under the dropdown; don't remove it.
// - This makes a real request to an external domain. It can't be tested
//   in Node (no network there) or reliably inside Claude's own preview
//   (cross-origin fetch is unreliable in that sandbox) — only confirmed
//   working once tried in a real browser. Reviewed for correctness, not
//   live-tested — flagging that plainly rather than claiming otherwise.
// - This is why it only exists in this real, modular file — the Claude
//   PREVIEW bundle keeps the simpler "suggest from what's already been
//   typed" ComboField instead, since it can't make this network call.
function AddressAutocomplete({ label, value, onChange, T, placeholder, onCityDetected }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);

  const handleChange = (text) => {
    onChange(text);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 3) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&addressdetails=1&limit=5`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch (err) {
        // A failed lookup should never block manual typing — the field
        // stays a normal text input regardless of network/API state.
        console.error("Address lookup failed:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 600);
  };

  const pick = (place) => {
    onChange(place.display_name);
    // ADDED 18 Aug 2026 — real gap the user flagged: city was never
    // auto-pulled from the selected address, even though Nominatim's
    // response (requested with addressdetails=1 above) already includes
    // it. Nominatim uses different keys depending on how the place is
    // classified (a city proper vs. a town vs. a village), so check the
    // common ones in order rather than assuming just `city` exists.
    if (onCityDetected) {
      const detectedCity = place.address?.city || place.address?.town || place.address?.village || place.address?.suburb;
      if (detectedCity) onCityDetected(detectedCity);
    }
    setResults([]);
    setOpen(false);
  };

  return (
    <div style={{ padding: "8px 0", position: "relative" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      <input value={value ?? ""} onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder || "Start typing an address..."}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
      {open && (loading || results.length > 0) && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: radius.sm, marginTop: 2, zIndex: 10, maxHeight: 220, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,.15)" }}>
          {loading && <div style={{ padding: 10, fontSize: 12, color: T.textDisabled }}>Searching…</div>}
          {results.map((r) => (
            <div key={r.place_id} onMouseDown={() => pick(r)}
              style={{ padding: "8px 10px", fontSize: 12, color: T.textPrimary, cursor: "pointer", borderBottom: `1px solid ${T.border}` }}>
              {r.display_name}
            </div>
          ))}
          {results.length > 0 && (
            <div style={{ padding: "6px 10px", fontSize: 10, color: T.textDisabled, textAlign: "right" }}>© OpenStreetMap contributors</div>
          )}
        </div>
      )}
    </div>
  );
}

function MultiSelectChips({ label, value, onChange, options, T, onAddNew }) {
  const [newValue, setNewValue] = useState("");
  const toggle = (opt) => {
    const has = value.includes(opt);
    onChange(has ? value.filter((v) => v !== opt) : [...value, opt]);
  };
  // ADDED 26 Aug 2026 — real ask: Relationship type should be able to
  // add more options, not just pick from a fixed list. Deliberately
  // optional (onAddNew prop) so every other existing caller of this
  // component is completely unaffected.
  const commitNew = () => {
    const v = newValue.trim();
    if (!v) return;
    onAddNew(v);
    if (!value.includes(v)) onChange([...value, v]);
    setNewValue("");
  };
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map((opt) => {
          const active = value.includes(opt);
          return (
            <div key={opt} onClick={() => toggle(opt)}
              style={{ padding: "5px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? T.contactsTeal : T.border}`, color: active ? T.contactsTeal : T.textSecondary, background: active ? `${T.contactsTeal}15` : "transparent" }}>
              {opt}
            </div>
          );
        })}
      </div>
      {onAddNew && (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input value={newValue} onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitNew(); } }}
            placeholder="+ Add new option"
            style={{ flex: 1, padding: "6px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 12, boxSizing: "border-box" }} />
        </div>
      )}
    </div>
  );
}

// Tag list with combobox suggestions.
// FIXED — likely root cause of "Kink hasn't populated at all": if you
// typed something but clicked Save without pressing Enter first, the
// typed text lived only in this component's own local `draft` state
// and was silently thrown away — it never made it into the saved
// contact. Now, leaving the field (onBlur — including by clicking the
// Save button) commits whatever's still typed, the same way pressing
// Enter does. Typing is never silently lost now.
//
// FIXED 18 Aug 2026 — "tried same kinks on two contacts, doesn't
// suggest, now have fist and fisting": the browser's native <datalist>
// dropdown only shows up while typing and only matches by substring —
// typing "Fisting" fresh never surfaces an existing "Fist" tag, since
// they're different strings and the dropdown is easy to type straight
// past without noticing. Added a VISIBLE, tappable list of what's
// already been used, shown even before typing anything, so it's
// something to browse and pick from rather than something you have to
// already know exists and type your way into. This doesn't fix true
// synonyms ("Fist" vs "Fisting" are still two different words to the
// computer) — only a real Kink Registry with one canonical name per
// concept actually solves that. This just makes existing entries hard
// to miss, which should catch most real-world near-misses like this one.
function TagInput({ label, value, onChange, T, placeholder, suggestions = [] }) {
  const [draft, setDraft] = useState("");
  const listId = idFromLabel(label);
  const visibleSuggestions = suggestions.filter((s) => !value.includes(s)).slice(0, 10);

  const commitDraft = (el) => {
    const raw = draft.trim();
    if (!raw) {
      if (el) focusNextField(el);
      return;
    }
    const newTags = raw.split(",").map((t) => normalizeTag(t)).filter((t) => t && !value.includes(t));
    if (newTags.length > 0) onChange([...value, ...newTags]);
    setDraft("");
  };

  const tapSuggestion = (s) => {
    if (!value.includes(s)) onChange([...value, s]);
  };

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {value.map((tag) => (
            <div key={tag} onClick={() => onChange(value.filter((t) => t !== tag))}
              style={{ padding: "4px 8px", borderRadius: radius.full, fontSize: 12, background: T.surfaceVariant, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              {tag} <X size={11} />
            </div>
          ))}
        </div>
      )}
      <input list={listId} value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitDraft(e.target); } }}
        onBlur={() => commitDraft(null)}
        placeholder={placeholder || "Type one or more, comma-separated, then press Enter"}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
      <datalist id={listId}>
        {suggestions.map((opt) => <option key={opt} value={opt} />)}
      </datalist>
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
          {visibleSuggestions.map((s) => (
            <div key={s} onClick={() => tapSuggestion(s)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.contactsTeal}`, color: T.contactsTeal, cursor: "pointer" }}>
              + {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Same visual shape as TagInput above, but backed by a real registry
// (Kink Registry, Chems Registry) instead of freeform strings pulled
// from other contacts' entries. `value` holds registry IDs. This is
// what actually closes the "Fist vs Fisting" gap TagInput's own comment
// flagged as unsolved — one canonical registry entry per concept,
// found case-insensitively or created new via findOrCreate.
function RegistryTagPicker({ label, value, onChange, T, registry, placeholder, excludeIds = [], trackRole = false, roleOptions = [], resolveSynonym = (x) => x, analyzeEntry = null, getRoleOptionsForKink = null }) {
  const [draft, setDraft] = useState("");
  // ADDED — real ask: "did you mean...?" for a recognized typo or an
  // umbrella term with a more specific real option. Only used when
  // `analyzeEntry` is actually passed in (Kink-backed pickers) —
  // Chems/Protection/Symptoms pickers don't have this analysis
  // available and are completely unaffected.
  const [pendingSuggestion, setPendingSuggestion] = useState(null);
  const listId = idFromLabel(label) + "-registry";
  const allEntries = registry.getAll().filter((e) => !e.isArchived);
  const nameFor = (id) => allEntries.find((e) => e.id === id)?.name || registry.getById(id)?.name || "?";

  // ADDED 18 Aug 2026 — trackRole mode: `value` becomes an array of
  // {kinkId, role} selections instead of plain registry IDs, so an
  // optional role (e.g. Top/Bottom/Vers) can attach to a specific
  // selection — the user's real ask: whether someone's a fisting top or
  // bottom changes his own future-meet intentions, worth tracking, but
  // optional even where it applies. Everything below branches on
  // trackRole once, here, so the rest of the logic doesn't repeat it.
  const selectedIds = trackRole ? value.map((v) => v.kinkId) : value;
  const hasSelection = (id) => selectedIds.includes(id);

  // CHANGED 18 Aug 2026 — also excludes excludeIds now: passed by the
  // edit sheet as "whatever's already in the sibling field" (Stated
  // Kinks excludes Limits' picks and vice versa). The user's real feedback:
  // something already marked as a kink shouldn't turn up as a suggested
  // limit. Only affects what's SUGGESTED — typing the exact same name
  // manually into both fields still works, since forcing that apart is
  // a much rarer edge case not worth hard-blocking.
  const visibleSuggestions = allEntries.filter((e) => !hasSelection(e.id) && !excludeIds.includes(e.id)).slice(0, 10);

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
  // cycled, not one fixed set for everything. The user's own original
  // Notion data already knew CBT/Chastity/Choking etc. needed Dom/sub,
  // not Top/bottom — restoring that real distinction (see
  // KINK_ROLE_STYLE in kinkRegistry.js for the full reasoning).
  // `getRoleOptionsForKink`, when passed, resolves the right set per
  // selection; falls back to the old fixed `roleOptions` prop when it
  // isn't (Chems/Protection/Symptoms pickers, which have no such
  // concept). A "mutual" kink resolves to `null` — no role at all for
  // that specific selection, cycling does nothing for it.
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

  // CHANGED 18 Aug 2026 — real bug fix: typing "fisting, gooning, piss"
  // used to become ONE registry entry literally named that whole
  // string, because this function never split on commas the way the
  // free-text TagInput elsewhere in the app already does. Now splits
  // and resolves each piece through the registry independently.
  // ALSO CHANGED — resolveSynonym runs on each piece before findOrCreate,
  // so a known slang term (e.g. "watersports") resolves to the existing
  // canonical entry ("Piss") instead of creating a near-duplicate.
  // Identity function by default — only Kink-backed pickers pass a real
  // one, Chems/Protection/Symptoms are unaffected.
  // CHANGED 19 Aug 2026 — real gap from the ~90-item feedback batch:
  // trackRole pickers now extract a role word (Top/Bottom/Vers) from
  // each comma-separated piece BEFORE resolving it against the registry,
  // so "fisting top, piss bottom" becomes two selections with their
  // roles already set, instead of one literal "Fisting Top" kink and a
  // role that still had to be set afterwards via the tap-to-cycle badge.
  // Non-trackRole pickers (Chems/Protection/Symptoms) are unaffected —
  // extractKinkRoleFromText only runs when trackRole/roleOptions apply.
  // CHANGED — real ask: before committing, check whether what's typed
  // is a recognized umbrella term (e.g. "Breath play" when "Choking"
  // is the real, more specific option) or a likely typo close to an
  // existing entry — and if so, ask instead of silently deciding for
  // The user. Only applies to a SINGLE typed entry (not a comma-separated
  // multi-paste) — that's the real, common case this was actually
  // asked for, and juggling several pending prompts from one paste
  // would be real added complexity for a rare case.
  const finalizeEntry = (resolvedName, role) => {
    const entry = registry.findOrCreate(resolvedName);
    if (entry && !hasSelection(entry.id)) {
      if (trackRole) onChange([...value, { kinkId: entry.id, role }]);
      else onChange([...value, entry.id]);
    }
  };

  // CHANGED — real gap: extraction needs to recognize BOTH role
  // vocabularies now (Top/bottom/Vers AND Dom/sub/Switch), not just
  // one fixed set — otherwise typing "CBT sub" wouldn't recognize
  // "sub" as a role word at all (it's not in the anatomical set) and
  // "sub" would incorrectly get treated as part of the kink's NAME.
  // Combines both vocabularies for parsing purposes only — which axis
  // is actually "correct" for a given kink is decided by
  // getKinkRoleOptions once the kink itself is resolved, this just
  // needs to recognize the WORD at parse time, before that's known.
  const extractionRoleOptions = getRoleOptionsForKink ? ["Top", "bottom", "Vers", "Dom", "sub", "Switch"] : roleOptions;

  const commitDraft = (el) => {
    const raw = draft.trim();
    if (!raw) {
      if (el) focusNextField(el);
      return;
    }
    const rawParts = raw.split(",").map((t) => t.trim()).filter(Boolean);

    if (analyzeEntry && rawParts.length === 1) {
      const { text, role } = trackRole ? extractKinkRoleFromText(rawParts[0], extractionRoleOptions) : { text: rawParts[0], role: null };
      const normalized = normalizeTag(text);
      const analysis = analyzeEntry(normalized);
      if (analysis.type === "umbrella" || analysis.type === "fuzzy-suggestion") {
        setPendingSuggestion({ ...analysis, role });
        setDraft("");
        return;
      }
    }

    const newSelections = [];
    rawParts.forEach((rawPart) => {
      const { text, role } = trackRole ? extractKinkRoleFromText(rawPart, extractionRoleOptions) : { text: rawPart, role: null };
      const resolved = resolveSynonym(normalizeTag(text));
      if (!resolved) return;
      const entry = registry.findOrCreate(resolved);
      if (entry && !hasSelection(entry.id) && !newSelections.some((s) => s.id === entry.id)) {
        newSelections.push({ id: entry.id, role });
      }
    });
    if (newSelections.length > 0) {
      if (trackRole) onChange([...value, ...newSelections.map((s) => ({ kinkId: s.id, role: s.role }))]);
      else onChange([...value, ...newSelections.map((s) => s.id)]);
    }
    setDraft("");
  };

  const tapSuggestion = (entry) => {
    if (!hasSelection(entry.id)) addEntries([entry.id]);
  };

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {(trackRole ? value : value.map((id) => ({ kinkId: id, role: null }))).map((sel) => {
            // CHANGED — a "mutual" kink (e.g. Frotting, Snowballing)
            // shows no role badge at all now, rather than offering a
            // Top/bottom cycle that doesn't actually describe anything
            // real about that kink.
            const roleOptionsForThisKink = trackRole ? resolveRoleOptions(sel.kinkId) : null;
            return (
              <div key={sel.kinkId}
                style={{ display: "flex", alignItems: "center", borderRadius: radius.full, background: T.surfaceVariant, overflow: "hidden" }}>
                <div onClick={() => removeEntry(sel.kinkId)}
                  style={{ padding: "4px 8px", fontSize: 12, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  {nameFor(sel.kinkId)} <X size={11} />
                </div>
                {trackRole && roleOptionsForThisKink && (
                  <div onClick={() => cycleRole(sel.kinkId)}
                    style={{ padding: "4px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer", borderLeft: `1px solid ${T.border}`, color: sel.role ? T.contactsTeal : T.textDisabled }}>
                    {sel.role || "+ role"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* CHANGED 18 Aug 2026 — suggestions now render ABOVE the input,
          not below. The user's real feedback: on a phone, the on-screen
          keyboard covers whatever's below the input the moment you tap
          in to type, so these chips were invisible exactly when they'd
          be useful. */}
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {visibleSuggestions.map((e) => (
            <div key={e.id} onClick={() => tapSuggestion(e)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.contactsTeal}`, color: T.contactsTeal, cursor: "pointer" }}>
              + {e.name}
            </div>
          ))}
        </div>
      )}
      <input list={listId} value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitDraft(e.target); } }}
        onBlur={() => commitDraft(null)}
        placeholder={placeholder || "Pick existing or type new ones, comma-separated"}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
      <datalist id={listId}>
        {allEntries.map((e) => <option key={e.id} value={e.name} />)}
      </datalist>
      {/* ADDED — real ask: "did you mean...?" prompt. Shown instead of
          silently deciding for the user — accepting a suggestion or
          keeping the typed word exactly as-is are both one tap away,
          neither is forced. */}
      {pendingSuggestion && (
        <div style={{ marginTop: 6, padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${ACCENTS.healthcare}`, background: `${ACCENTS.healthcare}10` }}>
          {pendingSuggestion.type === "umbrella" ? (
            <>
              <div style={{ fontSize: 12, color: T.textPrimary, marginBottom: 6 }}>
                "{pendingSuggestion.typedAs}" is a broader term — did you mean {pendingSuggestion.specific.length > 1 ? "one of these more specific ones" : "the more specific"}?
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {pendingSuggestion.specific.map((entry) => (
                  <div key={entry.id} onClick={() => { finalizeEntry(entry.name, pendingSuggestion.role); setPendingSuggestion(null); }}
                    style={{ padding: "4px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, background: ACCENTS.healthcare, color: "#FFFFFF", cursor: "pointer" }}>
                    Use "{entry.name}"
                  </div>
                ))}
                <div onClick={() => { finalizeEntry(pendingSuggestion.typedAs, pendingSuggestion.role); setPendingSuggestion(null); }}
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
                <div onClick={() => { finalizeEntry(pendingSuggestion.suggestion, pendingSuggestion.role); setPendingSuggestion(null); }}
                  style={{ padding: "4px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, background: ACCENTS.healthcare, color: "#FFFFFF", cursor: "pointer" }}>
                  Yes, use "{pendingSuggestion.suggestion}"
                </div>
                <div onClick={() => { finalizeEntry(pendingSuggestion.typedAs, pendingSuggestion.role); setPendingSuggestion(null); }}
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

function ToggleSwitch({ value, onChange, T }) {
  return (
    <div onClick={() => onChange(!value)} style={{ width: 40, height: 24, borderRadius: radius.full, background: value ? T.contactsTeal : T.surfaceVariant, position: "relative", cursor: "pointer", transition: "background 150ms ease" }}>
      <div style={{ position: "absolute", top: 2, left: value ? 18 : 2, width: 20, height: 20, borderRadius: radius.full, background: "#FFFFFF", transition: "left 150ms ease", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
    </div>
  );
}

function AgeField({ age, ageIsApprox, onChangeAge, onChangeApprox, T }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Age</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input type="number" value={age ?? ""} onChange={(e) => onChangeAge(e.target.value === "" ? null : Number(e.target.value))}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNextField(e.target); } }}
          style={{ width: 90, padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
        <div onClick={() => onChangeApprox(!ageIsApprox)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <ToggleSwitch T={T} value={ageIsApprox} onChange={onChangeApprox} />
          <span style={{ fontSize: 12, color: T.textSecondary }}>Approximate</span>
        </div>
      </div>
    </div>
  );
}

// ADDED 19 Aug 2026 — real gap from the Notion-vs-app audit. Reads the
// picked file as a data URL via FileReader — no upload endpoint exists
// or is needed, everything stays local. See contactRepository.js's
// DEFAULT_CONTACT comment for the honest localStorage-size caveat.
function PhotoPicker({ value, onChange, T }) {
  const inputRef = useRef(null);
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 0" }}>
      <div onClick={() => inputRef.current?.click()}
        style={{ width: 64, height: 64, borderRadius: radius.full, background: T.surfaceVariant, border: `1px solid ${T.border}`, cursor: "pointer", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {value ? (
          <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <User size={24} color={T.textDisabled} />
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div onClick={() => inputRef.current?.click()}
          style={{ fontSize: 12, fontWeight: 600, color: T.contactsTeal, cursor: "pointer" }}>
          {value ? "Change photo" : "Add photo"}
        </div>
        {value && (
          <div onClick={() => onChange("")} style={{ fontSize: 12, color: T.actionRed, cursor: "pointer" }}>Remove</div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
    </div>
  );
}

// ── Auto-detected contact methods, shown as a read-only preview above
// the manual "add extra platforms" input — this is the "visibly
// autofill" part of the user's ask: you can SEE what's already covered by
// Phone/Snapchat/Fabguys/Fabswingers before deciding what else to add. ──
function AutoDetectedMethods({ contact, T }) {
  const detected = [];
  if (contact.phone) detected.push("Phone/WhatsApp");
  if (contact.snapchat) detected.push("Snapchat");
  if (contact.fabguys) detected.push("Fabguys");
  if (contact.fabswingers) detected.push("Fabswingers");
  if (contact.recon) detected.push("Recon");
  if (detected.length === 0) return null;
  return (
    <div style={{ padding: "8px 0 0" }}>
      <div style={{ fontSize: 11, color: T.textDisabled, marginBottom: 6 }}>Already covered, from the fields above:</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {detected.map((m) => (
          <span key={m} style={{ padding: "4px 8px", borderRadius: radius.full, fontSize: 12, background: `${T.contactsTeal}15`, color: T.contactsTeal, fontWeight: 600 }}>{m}</span>
        ))}
      </div>
    </div>
  );
}

function AvailabilityRuleBuilder({ rules, onChange, T }) {
  const [draft, setDraft] = useState({ type: "Unavailable", days: [], timeConstraint: "All day", time: "18:00", note: "" });

  const toggleDay = (day) => {
    setDraft((d) => ({ ...d, days: d.days.includes(day) ? d.days.filter((x) => x !== day) : [...d.days, day] }));
  };

  const addRule = () => {
    if (draft.days.length === 0) return;
    const newRule = { id: `rule_${Date.now()}`, ...draft };
    onChange([...rules, newRule]);
    setDraft({ type: "Unavailable", days: [], timeConstraint: "All day", time: "18:00", note: "" });
  };

  const removeRule = (id) => onChange(rules.filter((r) => r.id !== id));

  const describeRule = (r) => {
    const timePart = r.timeConstraint === "All day" ? "all day" : `${r.timeConstraint.toLowerCase()} ${r.time}`;
    return `${r.type} · ${r.days.join(", ")} · ${timePart}${r.note ? ` · ${r.note}` : ""}`;
  };

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>Availability exceptions</div>

      {rules.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {rules.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: radius.sm, background: T.surfaceVariant, fontSize: 12, color: T.textPrimary }}>
              <span>{describeRule(r)}</span>
              <Trash2 size={13} color={T.textSecondary} style={{ cursor: "pointer", flexShrink: 0, marginLeft: 8 }} onClick={() => removeRule(r.id)} />
            </div>
          ))}
        </div>
      )}

      <div style={{ border: `1px dashed ${T.border}`, borderRadius: radius.sm, padding: 10 }}>
        <div style={{ display: "flex", background: T.surfaceVariant, borderRadius: radius.full, padding: 3, marginBottom: 8 }}>
          {AVAILABILITY_RULE_TYPES.map((t) => (
            <div key={t} onClick={() => setDraft((d) => ({ ...d, type: t }))}
              style={{ flex: 1, textAlign: "center", padding: "5px 0", borderRadius: radius.full, cursor: "pointer", fontSize: 12, fontWeight: 600, background: draft.type === t ? T.contactsTeal : "transparent", color: draft.type === t ? "#FFFFFF" : T.textSecondary }}>
              {t}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
          {DAYS_OF_WEEK.map((day) => (
            <div key={day} onClick={() => toggleDay(day)}
              style={{ width: 34, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: radius.sm, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${draft.days.includes(day) ? T.contactsTeal : T.border}`, color: draft.days.includes(day) ? T.contactsTeal : T.textSecondary, background: draft.days.includes(day) ? `${T.contactsTeal}15` : T.surface }}>
              {day}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <select value={draft.timeConstraint} onChange={(e) => setDraft((d) => ({ ...d, timeConstraint: e.target.value }))}
            style={{ flex: 1, padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surface, color: T.textPrimary, fontSize: 12 }}>
            {TIME_CONSTRAINT_TYPES.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          {draft.timeConstraint !== "All day" && (
            <input type="time" value={draft.time} onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
              style={{ padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surface, color: T.textPrimary, fontSize: 12 }} />
          )}
        </div>

        <input value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} placeholder="Note (optional, e.g. 'Work')"
          style={{ width: "100%", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surface, color: T.textPrimary, fontSize: 12, boxSizing: "border-box", marginBottom: 8 }} />

        <button onClick={addRule} disabled={draft.days.length === 0}
          style={{ ...btnStyle(draft.days.length === 0 ? T.textDisabled : T.contactsTeal, "outline"), width: "100%", padding: 8, cursor: draft.days.length === 0 ? "default" : "pointer" }}>
          Add rule
        </button>
      </div>
    </div>
  );
}

// ── New this round: link two contacts together (couples, etc.), per
// The user's ask. Linking is immediate — it calls the repository directly
// and refreshes, rather than waiting for the Save button — because a
// link is a two-party fact touching BOTH contacts' records at once,
// which doesn't fit the "stage changes, Save applies them" pattern the
// rest of this form uses for a single contact's own fields. Only shown
// for contacts that already exist — a brand-new, unsaved contact has no
// real id yet to link against.
//
// Tracks its OWN linkedIds/labels state rather than reading from the
// edit sheet's `form` object — form is seeded once when the sheet opens
// and never told about changes made via direct repository calls, so
// reading from it would show stale data until the sheet was reopened.
//
// Relationship label (new, 18 Aug 2026): picking a contact reveals a
// small optional text field for describing the relationship — "Dom/Sub",
// "bf/gf", etc — with suggestions grown from every label used across all
// contacts, same "type or pick" pattern as kinks. See contactRepository.js
// for why this is one shared label, not a separate role per side.
function LinkedContactsField({ contactId, allContacts, T, refresh }) {
  const [pickerValue, setPickerValue] = useState("");
  const [pendingLabel, setPendingLabel] = useState("");
  const [linkedIds, setLinkedIds] = useState(() => ContactRepository.getById(contactId)?.linkedContactIds || []);
  const [labels, setLabels] = useState(() => ContactRepository.getById(contactId)?.linkedContactLabels || {});
  const linked = allContacts.filter((c) => linkedIds.includes(c.id));
  const linkable = allContacts.filter((c) => c.id !== contactId && !linkedIds.includes(c.id));

  const labelSuggestions = useMemo(() => {
    const all = allContacts.flatMap((c) => Object.values(c.linkedContactLabels || {}));
    return Array.from(new Set(all)).sort((a, b) => a.localeCompare(b));
  }, [allContacts]);

  const confirmLink = () => {
    if (!pickerValue) return;
    const label = pendingLabel.trim();
    ContactRepository.linkContacts(contactId, pickerValue, label);
    setLinkedIds((prev) => [...prev, pickerValue]);
    if (label) setLabels((prev) => ({ ...prev, [pickerValue]: label }));
    refresh();
    setPickerValue("");
    setPendingLabel("");
  };
  const removeLink = (id) => {
    ContactRepository.unlinkContacts(contactId, id);
    setLinkedIds((prev) => prev.filter((x) => x !== id));
    setLabels((prev) => { const { [id]: _removed, ...rest } = prev; return rest; });
    refresh();
  };

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>Linked contacts (e.g. couples)</div>
      {linked.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          {linked.map((c) => (
            <div key={c.id} onClick={() => removeLink(c.id)}
              style={{ padding: "6px 10px", borderRadius: radius.sm, fontSize: 12, background: T.surfaceVariant, color: T.textPrimary, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{displayName(c)}{labels[c.id] ? ` — ${labels[c.id]}` : ""}</span>
              <X size={11} />
            </div>
          ))}
        </div>
      )}
      {linkable.length > 0 && (
        <>
          <select value={pickerValue} onChange={(e) => setPickerValue(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontSize: 13, marginBottom: pickerValue ? 6 : 0 }}>
            <option value="">+ Link another contact</option>
            {linkable.map((c) => <option key={c.id} value={c.id}>{displayName(c)}</option>)}
          </select>
          {pickerValue && (
            <div style={{ display: "flex", gap: 6 }}>
              <input list="link-label-suggestions" value={pendingLabel} onChange={(e) => setPendingLabel(e.target.value)}
                placeholder="Relationship (optional) — e.g. Dom/Sub, bf/gf"
                style={{ flex: 1, padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontSize: 12, boxSizing: "border-box" }} />
              <datalist id="link-label-suggestions">
                {labelSuggestions.map((s) => <option key={s} value={s} />)}
              </datalist>
              <button onClick={confirmLink} style={{ ...btnStyle(T.contactsTeal, "filled"), flex: "0 0 auto", padding: "8px 14px" }}>Link</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}


function ContactCard({ contact, onOpen, T, encounters = [], anonymise = false, inactiveThresholdDays = 90, activeFilters = null, selectMode = false, selected = false, onToggleSelected, onLongPress, onToggleFavourite }) {
  // ADDED 26 Aug 2026 — real ask: "show on card which field is being
  // filtered/why result is coming up... especially needed for if
  // someone uses multiple filters at once." Computes only the parts
  // of activeFilters that THIS contact actually satisfies — if two
  // filters are active but this card only matched one of them, only
  // that one shows.
  const matchedTags = activeFilters ? [
    ...(contact.bdsmRole || []).filter((r) => activeFilters.roles.includes(r)),
    ...(contact.sexualPosition || []).filter((p) => activeFilters.positions.includes(p)),
    ...(activeFilters.hosts.includes(contact.hosts) ? [`Hosts: ${contact.hosts}`] : []),
    ...(activeFilters.drives && contact.drives ? ["Drives"] : []),
  ] : [];
  const flaggedDontMeetAgain = contact.meetAgain === "No";
  // CHANGED 18 Aug 2026 — real feedback: the card was showing an icon
  // per detected contact method, and Fabguys/Fabswingers both mapped to
  // the same unlabeled Globe icon, so a contact with both filled showed
  // two identical icons with no way to tell what they meant. The user's
  // call: the card is a quick-glance summary, not the full profile —
  // just show Phone/Snapchat there, everything else (Fabguys,
  // Fabswingers, other platforms) is still fully visible on the actual
  // Contact Profile screen, one tap away.
  const methods = getContactableVia(contact).filter((m) => m === "Phone/WhatsApp" || m === "Snapchat");
  // ADDED 18 Aug 2026 — real "active" status, replacing the leading dot
  // that used to just be a fixed decorative teal bullet. DEFINITION,
  // a judgment call flagged explicitly since the user's ask didn't specify
  // one: an encounter within the last 90 days counts as active. A
  // contact with NO encounter history at all (brand new, nothing
  // logged yet) is NOT marked inactive — there's no evidence of
  // inactivity, just no history yet, so it stays the normal color.
  // Only a contact with a REAL gap since their last actual encounter
  // shows red. Reuses contactEncounterSummary — the same calculation
  // Contact Profile's Timeline already uses, not a separate one.
  const summary = contactEncounterSummary(encounters, contact.id);
  const daysSinceLastInteraction = summary.lastInteraction
    ? Math.floor((Date.now() - new Date(summary.lastInteraction).getTime()) / 86400000)
    : null;
  // CHANGED 19 Aug 2026 — real ask: threshold is now configurable
  // (Settings → Preferences), was hardcoded at 90. Also real ask: a
  // manual override for a genuine one-off/anonymous contact that will
  // never recur — excludeFromActiveTracking skips the flag entirely
  // regardless of how long it's actually been.
  const isInactive = !contact.excludeFromActiveTracking && daysSinceLastInteraction !== null && daysSinceLastInteraction > inactiveThresholdDays;
  // Rating is stored with its emoji embedded ("😍 Love") — just the
  // emoji character shows on the card, full label on the profile.
  const ratingEmoji = contact.rating ? contact.rating.split(" ")[0] : null;
  // ADDED 26 Aug 2026 — real ask: long-press to enter multi-select.
  // 500ms hold, works for both touch (phone) and mouse (desktop/
  // preview) — a real held-press, not just a tap, so it doesn't fire
  // on an ordinary quick tap that's meant to open the profile.
  const pressTimer = useRef(null);
  const startPress = () => { pressTimer.current = setTimeout(() => onLongPress?.(contact.id), 500); };
  const cancelPress = () => { clearTimeout(pressTimer.current); };
  const handleClick = () => {
    if (selectMode) onToggleSelected?.(contact.id);
    else onOpen(contact.id);
  };
  return (
    <div onClick={handleClick} onMouseDown={startPress} onMouseUp={cancelPress} onMouseLeave={cancelPress} onTouchStart={startPress} onTouchEnd={cancelPress}
      style={{ position: "relative", background: selected ? `${T.contactsTeal}10` : T.surface, border: `1px solid ${selected ? T.contactsTeal : flaggedDontMeetAgain ? T.actionRed : T.border}`, borderRadius: radius.md, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,.06)", cursor: "pointer", display: "flex", gap: 12 }}>
      {/* ADDED 26 Aug 2026 — real ask: favourite contacts, star icon
          per the user's preference over a pin. Own click handler with
          stopPropagation so tapping the star toggles the favourite
          without also opening the profile (the card's own onClick). */}
      {!selectMode && onToggleFavourite && (
        <div onClick={(e) => { e.stopPropagation(); onToggleFavourite(contact.id); }}
          style={{ position: "absolute", top: 10, right: 10, cursor: "pointer", zIndex: 2 }}>
          <Star size={17} weight={contact.favourited ? "fill" : "regular"} color={contact.favourited ? "#E8A33D" : T.textDisabled} />
        </div>
      )}
      {selectMode && (
        <div style={{ width: 22, height: 22, borderRadius: radius.full, border: `2px solid ${selected ? T.contactsTeal : T.border}`, background: selected ? T.contactsTeal : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, alignSelf: "center" }}>
          {selected && <Check size={13} color="#FFFFFF" />}
        </div>
      )}
      {/* ADDED 19 Aug 2026 — small thumbnail, only takes up card space
          when a photo actually exists, so contacts without one look
          exactly as before (no empty placeholder circle cluttering
          every card).
          CHANGED 19 Aug 2026 — hidden entirely under Anonymise mode,
          rather than shown blurred, per the base-tier field list. */}
      {contact.profilePicture && !anonymise && (
        <img src={contact.profilePicture} alt="" style={{ width: 44, height: 44, borderRadius: radius.full, objectFit: "cover", flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span title={isInactive ? `No encounter in over ${inactiveThresholdDays} days` : undefined}
          style={{ width: 8, height: 8, borderRadius: radius.full, background: isInactive ? T.actionRed : T.contactsTeal, display: "inline-block" }} />
        <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: T.textPrimary }}>{anonymise ? MASKED : displayName(contact)}</span>
        {ratingEmoji && <span style={{ fontSize: 14 }}>{ratingEmoji}</span>}
        {/* Age — tuned this round to sit close in size to the name (was
            too small a jump, 12px vs 15px reading as a much bigger drop
            than intended). Now 14px, one step down, not two. */}
        {contact.age != null && <span style={{ fontSize: 14, color: T.textSecondary }}>· {contact.ageIsApprox ? "≈" : ""}{contact.age}</span>}
        <MethodIcons methods={methods} T={T} />
        {contact.city && !anonymise && <span style={{ fontSize: 12, color: T.textSecondary }}>· {contact.city}</span>}
        {contact.drives && <Car size={13} color={T.textSecondary} />}
        {/* ADDED 18 Aug 2026 — hosts/travels indicator, the user's ask:
            "house or car icon" — House if they host, MapPin if they
            travel to you instead. Mutually exclusive (hosts takes
            priority if both apply) to keep the card from getting
            cluttered with two icons meaning something similar. This is
            deliberately separate from the Car icon above, which shows
            `drives` (owns a car) — a different fact from `travels`. */}
        {contact.hosts === "Yes" ? (
          <Home size={13} color={T.textSecondary} />
        ) : contact.travels === "Yes" ? (
          <MapPin size={13} color={T.textSecondary} />
        ) : null}
        {contact.linkedContactIds.length > 0 && <Link2 size={13} color={T.contactsTeal} />}
        {flaggedDontMeetAgain && <AlertTriangle size={13} color={T.actionRed} />}
      </div>
      {contact.relationshipType.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginLeft: 16, marginTop: 4, flexWrap: "wrap" }}>
          {contact.relationshipType.map((rt) => (
            <span key={rt} style={{ fontSize: 10, fontWeight: 600, color: T.contactsTeal, background: `${T.contactsTeal}15`, borderRadius: radius.full, padding: "2px 8px" }}>{rt}</span>
          ))}
        </div>
      )}
      {matchedTags.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginLeft: 16, marginTop: 4, flexWrap: "wrap" }}>
          {matchedTags.map((tag) => (
            <span key={tag} style={{ fontSize: 10, fontWeight: 700, color: "#FFFFFF", background: T.contactsTeal, borderRadius: radius.full, padding: "2px 8px" }}>{tag}</span>
          ))}
        </div>
      )}
      {/* ADDED 26 Aug 2026 — real ask, decided jointly: required-field
          "Incomplete" tag. isContactIncomplete() already respects
          markedComplete (the per-contact override), so this only ever
          shows for contacts that are genuinely missing something and
          haven't been explicitly marked done. */}
      {isContactIncomplete(contact) && (
        <div style={{ marginLeft: 16, marginTop: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#9A6700", background: "#FFF3C4", borderRadius: radius.full, padding: "2px 8px" }}>Incomplete</span>
        </div>
      )}
      {flaggedDontMeetAgain ? (
        <div style={{ fontSize: 12, color: T.actionRed, fontWeight: 600, marginLeft: 16, marginTop: 4 }}>Don't meet again</div>
      ) : (
        // CHANGED 18 Aug 2026 — was a permanent stub ("not tracked
        // yet") regardless of real data. Now shows the real last
        // encounter date via the same calculation/formatting Contact
        // Profile's Timeline already uses.
        <div style={{ fontSize: 12, color: T.textDisabled, fontStyle: summary.lastInteraction ? "normal" : "italic", marginLeft: 16, marginTop: 4 }}>
          {summary.lastInteraction ? `Last interaction ${formatRelativeDate(summary.lastInteraction)}` : "No encounters logged yet"}
        </div>
      )}
      </div>
    </div>
  );
}

// ── Add/Edit sheet — every section now lives inside its own SectionCard
// (outlined box), per the user's ask. Location & logistics reordered to:
// Hosts, Travels, Address, City, Drives (+ car details), Availability,
// availability exceptions, Readily available. ──
function ContactEditSheet({ contact, contacts, onSave, onClose, refresh, T }) {
  const isNew = !contact;
  // ADDED 19 Aug 2026 — draft autosave, real fix for a real gap the user
  // flagged: in-progress edits used to live only in this component's
  // memory, gone on any refresh. draftKey is scoped per-contact (or
  // "new" for a fresh add) so editing one contact never clobbers a
  // leftover draft for a different one.
  const draftKey = `contactEdit_${contact?.id || "new"}`;
  // ADDED 26 Aug 2026 — real ask: Relationship type now editable,
  // same pattern as Vaccinations' vaccineOptions.
  const [relationshipTypeOptions, setRelationshipTypeOptions] = useState(() => CustomOptionListsRepository.get("relationshipType"));
  const [form, setForm] = useState(() => {
    const draft = loadDraft(draftKey);
    if (draft) return draft.data;
    return contact ? { ...contact } : { ...DEFAULT_CONTACT };
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
  const canSave = form.name.trim().length > 0;
  // ADDED 26 Aug 2026 — real ask: duplicate detection. Warns, doesn't
  // block — two genuinely different people can share a first name —
  // but flags it so an actual accidental double-entry gets caught
  // before it happens instead of discovered later as two separate
  // records for the same person.
  const possibleDuplicate = useMemo(() => {
    const nameLower = form.name.trim().toLowerCase();
    const nicknameLower = (form.nickname || "").trim().toLowerCase();
    if (!nameLower) return null;
    return contacts.find((c) => {
      if (c.id === contact?.id) return false; // editing this same contact isn't a duplicate of itself
      if (c.isArchived) return false;
      const cName = (c.name || "").trim().toLowerCase();
      const cNickname = (c.nickname || "").trim().toLowerCase();
      return (cName && cName === nameLower) || (nicknameLower && cNickname && cNickname === nicknameLower);
    }) || null;
  }, [form.name, form.nickname, contacts, contact?.id]);
  const doSave = () => {
    clearDraft(draftKey);
    onSave(form);
  };

  const cityOptions = useMemo(() => getKnownCities(contacts), [contacts]);
  // CHANGED 18 Aug 2026 — real duplication the user flagged: Phone/Snapchat
  // (and Fabguys/Fabswingers) have their own dedicated fields above this
  // one, but historically-typed values from before those fields existed
  // were still being suggested here via getKnownValues. Filtered out
  // explicitly rather than relying on historical data staying clean —
  // these four are always redundant with the dedicated fields, so there's
  // no case where suggesting them here is correct.
  const REDUNDANT_PLATFORM_SUGGESTIONS = ["phone", "snapchat", "fabguys", "fabswingers", "recon"];
  const contactableViaOptions = useMemo(
    () => getKnownValues(contacts, "contactableVia").filter((v) => !REDUNDANT_PLATFORM_SUGGESTIONS.includes(v.toLowerCase().trim())),
    [contacts]
  );
  // kinkOptions/limitOptions/chemOptions removed 18 Aug 2026 — Stated
  // kinks/Limits/Known chems below now pull suggestions directly from
  // KinkRegistry/ChemsRegistry (real registries) instead of scanning
  // other contacts' freeform tags.
  const howMetOptions = useMemo(() => getKnownValues(contacts, "howDidWeMeet"), [contacts]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 200 }} onClick={onClose}>
      {/* CHANGED 19 Aug 2026 — real fix, the user's ask: Save was buried at
          the end of the scrollable content, so on a real device you had
          to scroll all the way down to find it — hence "can't see save
          function". Restructured into header / scrollable middle /
          sticky bottom action bar, so Save (and the new Clear button)
          are always visible regardless of scroll position. Save is now
          full-width, accent-colored, and large, per the user's explicit ask. */}
      <div data-contact-sheet style={{ background: T.bg, width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }} onClick={(e) => e.stopPropagation()}>
        {/* CHANGED 26 Aug 2026 — real ask: forms (Add/Edit Contact)
            should also have the module banner title, matching every
            other module screen. This is a bottom-sheet modal (closes
            via X, not a back chevron), so the banner carries the
            close button instead of a back arrow — same principle,
            right control for this screen's actual navigation model. */}
        <div style={{ background: T.contactsTeal, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 14px", flexShrink: 0, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 18, color: "#FFFFFF" }}>{isNew ? "Add contact" : "Edit contact"}</span>
          <X size={20} color="#FFFFFF" style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        {draftRestored && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, margin: "0 20px 8px", fontSize: 11, color: T.actionGreen, background: `${T.actionGreen}15`, borderRadius: radius.sm, padding: "6px 10px", flexShrink: 0 }}>
            <span>Restored unsaved changes from earlier.</span>
            {/* ADDED 19 Aug 2026 — the user's ask: a way to discard a
                restored draft and start clean instead of continuing it. */}
            <span onClick={() => { clearDraft(draftKey); setForm(contact ? { ...contact } : { ...DEFAULT_CONTACT }); }}
              style={{ fontWeight: 700, cursor: "pointer", textDecoration: "underline", flexShrink: 0 }}>
              Clear & start fresh
            </span>
          </div>
        )}

        <div style={{ overflowY: "auto", padding: "0 20px", flex: 1 }}>
        <SectionCard T={T} title="Identity">
          <PhotoPicker T={T} value={form.profilePicture} onChange={set("profilePicture")} />
          <TextField T={T} label="Full name" value={form.name} onChange={set("name")} placeholder="Full name" />
          {possibleDuplicate && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: radius.sm, background: "#FFF3C4", marginTop: -4, marginBottom: 8 }}>
              <AlertTriangle size={13} color="#9A6700" />
              <span style={{ fontSize: 12, color: "#9A6700" }}>Possible duplicate of "{possibleDuplicate.nickname || possibleDuplicate.name}" — check before saving a second entry.</span>
            </div>
          )}
          <TextField T={T} label="Nickname (shown instead of name, if set)" value={form.nickname} onChange={set("nickname")} placeholder="Optional" />
          {/* ADDED — real ask: trans-inclusive, non-judgemental — free
              text, not a fixed dropdown of "approved" options. */}
          <TextField T={T} label="Pronouns" value={form.pronouns} onChange={set("pronouns")} placeholder="e.g. he/him, she/her, they/them" />
          <AgeField T={T} age={form.age} ageIsApprox={form.ageIsApprox} onChangeAge={set("age")} onChangeApprox={set("ageIsApprox")} />
          {/* ADDED 26 Aug 2026 — real ask: moved to the top of the form
              rather than buried in Location & logistics — the override
              for the new required-field "Incomplete" tag deserves to
              be found easily, not stumbled on. */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
            <div style={{ flex: 1, paddingRight: 12 }}>
              <div style={{ fontSize: 13, color: T.textPrimary }}>Mark as complete</div>
              <div style={{ fontSize: 11, color: T.textDisabled, marginTop: 2 }}>Stops the "Incomplete" tag showing, even if some fields are genuinely blank — for contacts you consider as filled-in as they'll ever be.</div>
            </div>
            <ToggleSwitch T={T} value={form.markedComplete} onChange={set("markedComplete")} />
          </div>
        </SectionCard>

        {/* REORDERED 19 Aug 2026 — moved up from near the bottom of the
            sheet (it used to sit after Physical & health and Notes).
            the user's ask for logical/intuitive ordering: how to actually
            reach someone is one of the first things worth capturing
            when adding a new contact, not one of the last. */}
        <SectionCard T={T} title="Contact methods">
          <TextField T={T} label="Phone/WhatsApp" value={form.phone} onChange={set("phone")} placeholder="e.g. +44 7700 900123" />
          <TextField T={T} label="Snapchat" value={form.snapchat} onChange={set("snapchat")} placeholder="Username" />
          <TextField T={T} label="Fabguys" value={form.fabguys} onChange={set("fabguys")} placeholder="Username" />
          <TextField T={T} label="Fabswingers" value={form.fabswingers} onChange={set("fabswingers")} placeholder="Username" />
          {/* ADDED — real ask: Recon as its own real field, same as
              Snapchat/Fabguys/Fabswingers, not the free-text "other
              platforms" list — this is specifically for a Recon
              username. Grey placeholder is native input behavior,
              genuinely disappears the instant real text is typed. */}
          <TextField T={T} label="Recon" value={form.recon} onChange={set("recon")} placeholder="Username" />
          <AutoDetectedMethods T={T} contact={form} />
          <TagInput T={T} label="Other platforms" value={form.contactableVia} onChange={set("contactableVia")} suggestions={contactableViaOptions} placeholder="e.g. Tinder, Bumble, Grindr" />
        </SectionCard>

        <SectionCard T={T} title="Relationship">
          <SelectField T={T} label="Rating" value={form.rating} onChange={set("rating")} options={RATING_OPTIONS} />
          <MultiSelectChips T={T} label="Relationship type" value={form.relationshipType} onChange={set("relationshipType")} options={relationshipTypeOptions}
            onAddNew={(v) => setRelationshipTypeOptions(CustomOptionListsRepository.add("relationshipType", v))} />
          <TagInput T={T} label="How did we meet?" value={form.howDidWeMeet} onChange={set("howDidWeMeet")} suggestions={howMetOptions} />
          <SelectField T={T} label="Meet again?" value={form.meetAgain} onChange={set("meetAgain")} options={MEET_AGAIN_OPTIONS} />
          {form.meetAgain === "No" && (
            <TextField T={T} label="Reason" value={form.dontMeetAgainReason} onChange={set("dontMeetAgainReason")} placeholder="Optional, but helps future-you remember why" />
          )}
          {/* ADDED 19 Aug 2026 — real ask: manual override for the
              active/inactive flag, for a genuine one-off/anonymous
              contact that will never recur — the red "inactive" flag
              exists to prompt "has it really been this long?", which
              is the wrong question for something deliberately
              one-time. */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
            <div style={{ flex: 1, paddingRight: 12 }}>
              <div style={{ fontSize: 13, color: T.textPrimary }}>One-off / never expect to recur</div>
              <div style={{ fontSize: 11, color: T.textDisabled, marginTop: 2 }}>Excludes this contact from the inactive flag entirely — for a genuine one-time encounter, not a gap you'd want flagged.</div>
            </div>
            <ToggleSwitch T={T} value={form.excludeFromActiveTracking} onChange={set("excludeFromActiveTracking")} />
          </div>
        </SectionCard>

        <SectionCard T={T} title="Location & logistics">
          <SelectField T={T} label="Hosts" value={form.hosts} onChange={set("hosts")} options={HOSTS_OPTIONS} />
          <SelectField T={T} label="Travels" value={form.travels} onChange={set("travels")} options={TRAVELS_OPTIONS} />
          {(form.travels === "Yes" || form.travels === "Sometimes") && (
            <MultiSelectChips T={T} label="Travel mode" value={form.travelMode} onChange={set("travelMode")} options={TRAVEL_MODE_OPTIONS} />
          )}
          <AddressAutocomplete T={T} label="Address" value={form.address} onChange={set("address")}
            placeholder="Start typing an address..." onCityDetected={set("city")} />
          <ComboField T={T} label="City" value={form.city} onChange={set("city")} options={cityOptions} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
            <span style={{ fontSize: 13, color: T.textPrimary }}>Drives</span>
            <ToggleSwitch T={T} value={form.drives} onChange={set("drives")} />
          </div>
          {form.drives && (
            <>
              <TextField T={T} label="Car details" value={form.carDetails} onChange={set("carDetails")} placeholder="e.g. Blue Ford Focus" />
              {/* ADDED 18 Aug 2026 — split out from Car details: a
                  registration plate identifies a specific vehicle (and
                  by extension, often a specific person) — meaningfully
                  more sensitive than "blue, Ford, hatchback", so it's
                  kept as its own field rather than bundled into one
                  freeform description. */}
              <TextField T={T} label="Car registration" value={form.carRegistration} onChange={set("carRegistration")} placeholder="e.g. AB12 CDE" />
            </>
          )}
          <MultiSelectChips T={T} label="Availability" value={form.availability} onChange={set("availability")} options={AVAILABILITY_OPTIONS} />
          <AvailabilityRuleBuilder T={T} rules={form.nonAvailabilityRules} onChange={set("nonAvailabilityRules")} />
          <SelectField T={T} label="Readily available?" value={form.readilyAvailable} onChange={set("readilyAvailable")} options={READILY_AVAILABLE_OPTIONS} />
        </SectionCard>

        <SectionCard T={T} title="Kink">
          {/* REVERTED — the user clarified the cross-exclusion (a kink
              already in Limits hidden from Stated Kinks' suggestions,
              and vice versa) was actually wanted, kept as-is. The
              "unify?" question was about something else entirely (see
              below) — this exclusion was never the cause. Overlap
              warning kept as a defensive backstop for the rare case a
              kink still ends up in both anyway (e.g. via a backup
              restore or direct data edit, which bypass the picker's
              own exclusion) — not contradicting "keep the exclusion",
              just covering what the exclusion itself can't catch. */}
          <RegistryTagPicker T={T} label="Stated kinks" value={form.statedKinks} onChange={set("statedKinks")} registry={KinkRegistry} excludeIds={form.limits.map((l) => l.kinkId)} trackRole roleOptions={KINK_ROLE_OPTIONS} resolveSynonym={resolveKinkSynonym} analyzeEntry={analyzeKinkEntry} getRoleOptionsForKink={getKinkRoleOptions} />
          <RegistryTagPicker T={T} label="Limits" value={form.limits} onChange={set("limits")} registry={KinkRegistry} excludeIds={form.statedKinks.map((s) => s.kinkId)} trackRole roleOptions={KINK_ROLE_OPTIONS} resolveSynonym={resolveKinkSynonym} analyzeEntry={analyzeKinkEntry} getRoleOptionsForKink={getKinkRoleOptions} />
          {(() => {
            const statedIds = new Set(form.statedKinks.map((s) => s.kinkId));
            const overlapping = form.limits.filter((l) => statedIds.has(l.kinkId)).map((l) => KinkRegistry.getById(l.kinkId)?.name).filter(Boolean);
            return overlapping.length > 0 ? (
              <div style={{ display: "flex", gap: 6, padding: "8px 0", alignItems: "flex-start" }}>
                <AlertTriangle size={13} color={T.actionRed} style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 11, color: T.actionRed, lineHeight: 1.4 }}>
                  Listed as both a stated kink and a limit: {overlapping.join(", ")}. Left as-is — worth a second look, not necessarily wrong.
                </span>
              </div>
            ) : null;
          })()}
          <MultiSelectChips T={T} label="Role" value={form.bdsmRole} onChange={set("bdsmRole")} options={BDSM_ROLE_OPTIONS} />
          <MultiSelectChips T={T} label="Position" value={form.sexualPosition} onChange={set("sexualPosition")} options={SEXUAL_POSITION_OPTIONS} />
        </SectionCard>

        {/* Own section, not folded into Kink — Notion keeps the Chems
            Registry architecturally separate (neutral grey domain, not
            kink-red, per Doc 2), so the app mirrors that distinction. */}
        <SectionCard T={T} title="Chems">
          <RegistryTagPicker T={T} label="Known chems" value={form.knownChems} onChange={set("knownChems")} registry={ChemsRegistry} placeholder="e.g. Alcohol, Weed, Poppers, Coke, LSD" resolveSynonym={resolveChemSynonym} />
        </SectionCard>

        <SectionCard T={T} title="Physical & health">
          <SelectField T={T} label="Length (penis)" value={form.length} onChange={set("length")} options={LENGTH_OPTIONS} />
          <SelectField T={T} label="Girth (penis)" value={form.thickness} onChange={set("thickness")} options={GIRTH_OPTIONS} />
          <SelectField T={T} label="Foreskin" value={form.foreskin} onChange={set("foreskin")} options={FORESKIN_OPTIONS} />
          {/* ADDED 18 Aug 2026 — sub-branch, only shown/meaningful when
              Uncircumcised — the user's ask: the old flat list mixed
              circumcision status with fit as if they were one choice.
              Not shown at all for Circumcised/Unknown since fit doesn't
              apply there. */}
          {form.foreskin === "Uncircumcised" && (
            <SelectField T={T} label="Foreskin fit" value={form.foreskinDetail} onChange={set("foreskinDetail")} options={FORESKIN_DETAIL_OPTIONS} />
          )}
          <SelectField T={T} label="Chastity status" value={form.chastityStatus} onChange={set("chastityStatus")} options={CHASTITY_OPTIONS} />
          {/* ADDED — real ask: a short descriptor, since "N/A" alone
              doesn't explain the choice being made. */}
          <div style={{ fontSize: 11, color: T.textDisabled, marginTop: -6, marginBottom: 6 }}>Only relevant if chastity is something they're genuinely into — leave as N/A otherwise.</div>
          <MultiSelectChips T={T} label="Cummer — frequency" value={form.cummer} onChange={set("cummer")} options={CUMMER_FREQUENCY_OPTIONS} />
          <MultiSelectChips T={T} label="Cummer — volume" value={form.cummer} onChange={set("cummer")} options={CUMMER_VOLUME_OPTIONS} />
          <MultiSelectChips T={T} label="Cummer — style" value={form.cummer} onChange={set("cummer")} options={CUMMER_STYLE_OPTIONS} />
          <MultiSelectChips T={T} label="Known to be on" value={form.knownPrepDoxy} onChange={set("knownPrepDoxy")} options={PREP_DOXY_OPTIONS} />
          <TextField T={T} label="Last tested date (if known)" value={form.lastTestedDate} onChange={set("lastTestedDate")} type="date" helper="Often unknown — leave blank, no pressure." />
        </SectionCard>

        <SectionCard T={T} title="Notes">
          <textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} rows={3} placeholder="e.g. how you met, preferences, things to remember before meeting again"
            style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
        </SectionCard>

        {!isNew && (
          <SectionCard T={T} title="Linked contacts">
            <LinkedContactsField T={T} contactId={form.id} allContacts={contacts} refresh={refresh} />
          </SectionCard>
        )}
        </div>

        <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
          <button onClick={() => canSave && doSave()} style={{ ...btnStyle(canSave ? T.contactsTeal : T.textDisabled, "filled"), width: "100%", padding: 16, fontSize: 16, fontWeight: 700, cursor: canSave ? "pointer" : "default" }}>
            {isNew ? "Add contact" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ADDED — real ask: "have option to toggle blank fields — to see
// what's missing, on contact card." Implemented as Context rather than
// a prop threaded through all 32 real ReadRow call sites in this file
// — same real behavior, far smaller real diff.
const ShowBlankFieldsContext = React.createContext(false);

function ReadRow({ label, value, T }) {
  const showBlank = React.useContext(ShowBlankFieldsContext);
  const isEmpty = value === "" || value == null || (Array.isArray(value) && value.length === 0) || value === false;
  if (isEmpty && !showBlank) return null;
  const display = isEmpty ? "— not set" : (Array.isArray(value) ? value.join(", ") : value === true ? "Yes" : value);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
      <span style={{ color: T.textSecondary }}>{label}</span>
      <span style={{ color: isEmpty ? T.textDisabled : T.textPrimary, fontWeight: isEmpty ? 400 : 500, fontStyle: isEmpty ? "italic" : "normal", textAlign: "right" }}>{display}</span>
    </div>
  );
}

function describeAvailabilityRule(r) {
  const timePart = r.timeConstraint === "All day" ? "all day" : `${r.timeConstraint.toLowerCase()} ${r.time}`;
  return `${r.type} · ${r.days.join(", ")} · ${timePart}${r.note ? ` · ${r.note}` : ""}`;
}

// ── Contact Profile — same SectionCard treatment and reordered
// Location & logistics as the edit sheet, plus the don't-meet-again
// warning banner. ──
function ContactProfile({ contactId, onBack, onEdit, onOpenContact, T, refresh, onNavigateToRecord, triggerDelete }) {
  const contact = ContactRepository.getById(contactId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  // ADDED — real ask: "not just edit or archive contact but also
  // option to delete permanently."
  const [confirmDelete, setConfirmDelete] = useState(false);
  // ADDED 19 Aug 2026 — Anonymise mode, same read pattern as ContactsList.
  const [privacy] = useState(() => PrivacySettingsRepository.getSettings());
  const anonymise = privacy.anonymiseModeActive;
  const hideFurther = anonymise && privacy.hideFurtherEnabled;
  // ADDED — real ask: toggle to reveal blank fields, so it's obvious
  // what's actually missing rather than silently absent.
  const [showBlankFields, setShowBlankFields] = useState(false);
  if (!contact) return null;

  const archive = () => { ContactRepository.archive(contact.id); refresh(); onBack(); };
  const flaggedDontMeetAgain = contact.meetAgain === "No";
  const methods = getContactableVia(contact);

  return (
    <ShowBlankFieldsContext.Provider value={showBlankFields}>
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 16px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onBack} />
          {/* CHANGED 19 Aug 2026 — real ask: font-size consistency
              audit found this at 18/700 while every other module's
              equivalent detail-view record title (Testing/Clinic
              Visits/Vaccinations/Symptom Log/Timeline) uses 20/700 —
              a real, isolated slip, not a deliberate choice. */}
          <span style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary }}>{displayName(contact)}</span>
          {/* ADDED — real ask: pronouns shown right next to the name,
              the natural place people actually look for them. */}
          {contact.pronouns && <span style={{ fontSize: 13, color: T.textSecondary, marginLeft: 6 }}>({contact.pronouns})</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* ADDED — real ask: show-blank-fields toggle. */}
          <div onClick={() => setShowBlankFields((v) => !v)} title={showBlankFields ? "Hide blank fields" : "Show blank fields"} style={{ cursor: "pointer" }}>
            {showBlankFields ? <Eye size={19} color={T.contactsTeal} /> : <EyeOff size={19} color={T.textSecondary} />}
          </div>
          <div style={{ position: "relative" }}>
          <MoreVertical size={20} color={T.textSecondary} style={{ cursor: "pointer" }} onClick={() => setMenuOpen((o) => !o)} />
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }} />
              <div style={{ position: "absolute", top: 28, right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: radius.sm, boxShadow: "0 4px 16px rgba(0,0,0,.15)", zIndex: 40, minWidth: 170, overflow: "hidden" }}>
                <div onClick={() => { onEdit(contact.id); setMenuOpen(false); }} style={{ padding: "10px 14px", fontSize: 13, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                  <Settings2 size={14} color={T.textSecondary} /> Edit contact
                </div>
                <div onClick={() => { setConfirmArchive(true); setMenuOpen(false); }} style={{ padding: "10px 14px", fontSize: 13, color: T.actionRed, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${T.border}` }}>
                  <Archive size={14} /> Archive contact
                </div>
                <div onClick={() => { setConfirmDelete(true); setMenuOpen(false); }} style={{ padding: "10px 14px", fontSize: 13, color: T.actionRed, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${T.border}` }}>
                  <Trash2 size={14} /> Delete permanently
                </div>
              </div>
            </>
          )}
          </div>
        </div>
      </div>

      {flaggedDontMeetAgain && (
        <div style={{ margin: "0 16px 12px", padding: 12, borderRadius: radius.sm, border: `1px solid ${T.actionRed}`, background: `${T.actionRed}15`, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <AlertTriangle size={16} color={T.actionRed} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.actionRed }}>Marked: don't meet again</div>
            {contact.dontMeetAgainReason && <div style={{ fontSize: 12, color: T.textPrimary, marginTop: 2 }}>{contact.dontMeetAgainReason}</div>}
          </div>
        </div>
      )}

      {confirmArchive && (
        <div style={{ margin: "0 16px 12px", padding: 12, borderRadius: radius.sm, border: `1px solid ${T.actionRed}`, background: `${T.actionRed}11` }}>
          <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 8 }}>
            Archiving hides this contact from the list — it stays intact and can be restored later.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={archive} style={{ ...btnStyle(T.actionRed, "filled"), padding: "8px 10px" }}>Confirm archive</button>
            <button onClick={() => setConfirmArchive(false)} style={{ ...btnStyle(T.textSecondary, "outline"), padding: "8px 10px" }}>Cancel</button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={{ margin: "0 16px 12px", padding: 12, borderRadius: radius.sm, border: `1px solid ${T.actionRed}`, background: `${T.actionRed}11` }}>
          <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 8 }}>
            This permanently deletes the contact — unlike archiving, there's no getting it back. Only use this for a genuinely erroneous or unwelcome entry.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { triggerDelete([contact]); refresh(); onBack(); }} style={{ ...btnStyle(T.actionRed, "filled"), padding: "8px 10px" }}>Delete permanently</button>
            <button onClick={() => setConfirmDelete(false)} style={{ ...btnStyle(T.textSecondary, "outline"), padding: "8px 10px" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ padding: "0 16px 100px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
          <span style={{ width: 14, height: 14, borderRadius: radius.full, background: T.contactsTeal, display: "inline-block" }} />
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 20, color: T.textPrimary }}>{anonymise ? MASKED : displayName(contact)}</span>
          {contact.age != null && <span style={{ fontSize: 15, color: T.textSecondary }}>{contact.ageIsApprox ? "≈" : ""}{contact.age}</span>}
          <MethodIcons methods={methods} T={T} size={16} />
        </div>
        {contact.nickname && !anonymise && <div style={{ fontSize: 12, color: T.textDisabled, marginLeft: 24 }}>Full name: {contact.name}</div>}

        {/* REORDERED — real ask: Timeline (encounter history/stats with
            this contact) is the most clinically relevant summary, so
            it now leads right under the header instead of trailing at
            the very bottom. Contact methods moved down to just before
            Notes — see that section's own comment. */}
        <SectionCard T={T} title="Timeline">
          {(() => {
            // All four numbers below are CALCULATED here, every render,
            // from EncounterRepository — never stored on the Contact
            // record. Same "store facts, derive state" principle as
            // Medication stock. Mirrors the four Notion rollups
            // (Encounter Count, Average/Highest Enjoyment, Last
            // Interaction) that motivated this section in the first
            // place.
            const allEncounters = EncounterRepository.getAll();
            const summary = contactEncounterSummary(allEncounters, contact.id);
            const history = sortByDateDesc(
              allEncounters.filter((e) => e.attendeeIds.includes(contact.id) && !e.isArchived)
            );
            if (summary.count === 0) {
              return (
                <div style={{ fontSize: 13, color: T.textDisabled, fontStyle: "italic", textAlign: "center", padding: "16px 4px" }}>
                  No encounters logged with this contact yet.
                </div>
              );
            }
            return (
              <>
                <div style={{ display: "flex", gap: 16, padding: "8px 0 14px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, fontFamily: "'Inter', sans-serif" }}>{summary.count}</div>
                    <div style={{ fontSize: 11, color: T.textSecondary }}>Encounters</div>
                  </div>
                  {summary.averageEnjoyment != null && (
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, fontFamily: "'Inter', sans-serif" }}>{Math.round(summary.averageEnjoyment)}</div>
                      <div style={{ fontSize: 11, color: T.textSecondary }}>Avg enjoyment</div>
                    </div>
                  )}
                  {summary.highestEnjoyment != null && (
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, fontFamily: "'Inter', sans-serif" }}>{summary.highestEnjoyment}</div>
                      <div style={{ fontSize: 11, color: T.textSecondary }}>Highest</div>
                    </div>
                  )}
                  {summary.lastInteraction && (
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, fontFamily: "'Inter', sans-serif" }}>{formatRelativeDate(summary.lastInteraction)}</div>
                      <div style={{ fontSize: 11, color: T.textSecondary }}>Last seen</div>
                    </div>
                  )}
                </div>
                {history.map((e) => (
                  // CHANGED — real ask: "linked encounter should be
                  // actually linked — click and it takes you to it."
                  // Real cross-module navigation now exists (see
                  // App.jsx's navigateToRecord) — no longer read-only.
                  <div key={e.id} onClick={() => onNavigateToRecord?.("activity", e.id)}
                    style={{ padding: "8px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13, cursor: onNavigateToRecord ? "pointer" : "default" }}>
                    <div style={{ color: T.textPrimary, fontWeight: 600 }}>{e.title || "Untitled encounter"}</div>
                    <div style={{ color: T.textSecondary, fontSize: 12 }}>{e.date ? new Date(e.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "No date"}</div>
                  </div>
                ))}
              </>
            );
          })()}
        </SectionCard>

        <SectionCard T={T} title="Relationship">
          <ReadRow T={T} label="Rating" value={contact.rating} />
          <ReadRow T={T} label="Relationship type" value={contact.relationshipType} />
          <ReadRow T={T} label="How did we meet?" value={contact.howDidWeMeet} />
          <ReadRow T={T} label="Meet again?" value={contact.meetAgain} />
        </SectionCard>

        <SectionCard T={T} title="Location & logistics">
          <ReadRow T={T} label="Hosts" value={contact.hosts} />
          <ReadRow T={T} label="Travels" value={contact.travels} />
          <ReadRow T={T} label="Travel mode" value={contact.travelMode} />
          <ReadRow T={T} label="Address" value={anonymise ? MASKED : contact.address} />
          <ReadRow T={T} label="City" value={anonymise ? MASKED : contact.city} />
          <ReadRow T={T} label="Drives" value={contact.drives} />
          <ReadRow T={T} label="Car details" value={contact.carDetails} />
          <ReadRow T={T} label="Car registration" value={anonymise ? MASKED : contact.carRegistration} />
          <ReadRow T={T} label="Availability" value={contact.availability} />
          {contact.nonAvailabilityRules?.length > 0 && (
            <div style={{ padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
              <div style={{ color: T.textSecondary, marginBottom: 4 }}>Availability exceptions</div>
              {contact.nonAvailabilityRules.map((r) => (
                <div key={r.id} style={{ color: T.textPrimary, fontSize: 12, marginBottom: 2 }}>{describeAvailabilityRule(r)}</div>
              ))}
            </div>
          )}
          <ReadRow T={T} label="Readily available?" value={contact.readilyAvailable} />
        </SectionCard>

        <SectionCard T={T} title="Kink">
          {hideFurther ? (
            <div style={{ fontSize: 13, color: T.textDisabled, fontStyle: "italic", padding: "6px 0" }}>{MASKED}</div>
          ) : (
            <>
              <ReadRow T={T} label="Stated kinks" value={contact.statedKinks.map((sel) => {
                const name = KinkRegistry.getById(sel.kinkId)?.name;
                return name ? (sel.role ? `${name} (${sel.role})` : name) : null;
              }).filter(Boolean)} />
              <ReadRow T={T} label="Limits" value={contact.limits.map((sel) => {
                const name = KinkRegistry.getById(sel.kinkId)?.name;
                return name ? (sel.role ? `${name} (${sel.role})` : name) : null;
              }).filter(Boolean)} />
              <ReadRow T={T} label="Role" value={contact.bdsmRole} />
              <ReadRow T={T} label="Position" value={contact.sexualPosition} />
            </>
          )}
        </SectionCard>

        <SectionCard T={T} title="Chems">
          {/* CHANGED — real ask: empty Chems should explicitly say
              "None known" rather than the row just disappearing —
              ReadRow's default behavior everywhere else (hide empty
              fields entirely) still applies to every other field. */}
          <ReadRow T={T} label="Known chems" value={contact.knownChems.length > 0 ? contact.knownChems.map((id) => ChemsRegistry.getById(id)?.name).filter(Boolean) : "None known"} />
        </SectionCard>

        <SectionCard T={T} title="Physical & health">
          {/* CHANGED 19 Aug 2026 — Anonymise mode's "hide further" tier:
              physical attributes (length/girth/cummer), per the user's
              exact wording ("kinks, physical attributes (cum, dick
              stats)"). Foreskin/chastity/PrEP-DoxyPEP/last-tested left
              visible — not named in the ask, and arguably closer to
              health-relevant than identity-revealing. */}
          <ReadRow T={T} label="Length (penis)" value={hideFurther ? MASKED : contact.length} />
          <ReadRow T={T} label="Girth (penis)" value={hideFurther ? MASKED : contact.thickness} />
          <ReadRow T={T} label="Foreskin" value={contact.foreskin} />
          <ReadRow T={T} label="Foreskin fit" value={contact.foreskinDetail} />
          <ReadRow T={T} label="Chastity status" value={contact.chastityStatus} />
          <ReadRow T={T} label="Cummer" value={hideFurther ? MASKED : contact.cummer} />
          <ReadRow T={T} label="Known to be on" value={contact.knownPrepDoxy} />
          <ReadRow T={T} label="Last tested" value={contact.lastTestedDate} />
        </SectionCard>

        <SectionCard T={T} title="Contact methods">
          <ReadRow T={T} label="Contactable via" value={methods} />
          <ReadRow T={T} label="Phone/WhatsApp" value={contact.phone} />
          <ReadRow T={T} label="Snapchat" value={contact.snapchat} />
          <ReadRow T={T} label="Fabguys" value={contact.fabguys} />
          <ReadRow T={T} label="Fabswingers" value={contact.fabswingers} />
          <ReadRow T={T} label="Recon" value={contact.recon} />
        </SectionCard>

        <SectionCard T={T} title="Notes">
          <div style={{ fontSize: 14, color: contact.notes ? T.textPrimary : T.textDisabled, fontStyle: contact.notes ? "normal" : "italic" }}>
            {contact.notes || "No notes yet."}
          </div>
        </SectionCard>

        {contact.linkedContactIds.length > 0 && (
          <SectionCard T={T} title="Linked contacts">
            {ContactRepository.getAll()
              .filter((c) => contact.linkedContactIds.includes(c.id))
              .map((c) => (
                <div key={c.id} onClick={() => onOpenContact(c.id)}
                  style={{ padding: "8px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13, color: T.contactsTeal, fontWeight: 600, cursor: "pointer" }}>
                  {displayName(c)}
                </div>
              ))}
          </SectionCard>
        )}
        {/* ADDED 26 Aug 2026 — real ask: last-updated indicator. Shown
            here purely for your own reference — deliberately NOT
            counted as "activity" for the backup-check warning (see
            contactRepository.js and backupService.js's own comments
            on why an edit here shouldn't trigger that). */}
        {contact.updatedAt && (
          <div style={{ textAlign: "center", fontSize: 11, color: T.textDisabled, marginTop: 16 }}>
            Last updated {new Date(contact.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
          </div>
        )}
      </div>
    </div>
    </ShowBlankFieldsContext.Provider>
  );
}

// ── Contacts List ──
function ContactsList({ contacts, onOpen, onAdd, T, sortBy, setSortBy, query, setQuery, onOpenMyProfile, onOpenImportProfile, refresh, deleteToast, undoDelete, redoDelete, triggerDelete }) {
  // ADDED 19 Aug 2026 — Anonymise mode. Read once per mount, same
  // pattern as every other cross-module settings read in this app —
  // toggling it in Settings and switching back to Contacts (a fresh
  // remount) picks up the new value naturally.
  const [privacy] = useState(() => PrivacySettingsRepository.getSettings());
  const anonymise = privacy.anonymiseModeActive;
  // ADDED 19 Aug 2026 — real ask: configurable inactive threshold.
  const [inactiveThresholdDays] = useState(() => AppPreferencesRepository.getPreferences().inactiveThresholdDays);
  const activeContacts = useMemo(() => contacts.filter((c) => !c.isArchived), [contacts]);
  // ADDED 18 Aug 2026 — loaded once here rather than per-card, needed
  // for the card's active-status dot (see ContactCard below).
  const encounters = useMemo(() => EncounterRepository.getAll(), [contacts]);
  const [showFilters, setShowFilters] = useState(false);
  // ADDED 26 Aug 2026 — real ask: long-press a card to enter multi-
  // select mode, then bulk delete/archive/edit. "Edit" deliberately
  // not included in bulk actions — editing several different
  // contacts' individual fields at once doesn't have an obvious
  // single meaning the way delete/archive do; flagged rather than
  // guessed at a shape for it.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const toggleSelected = (id) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds([]); };
  // ADDED 26 Aug 2026 — real ask: filter Contacts by role/position
  // (top/bottom/dom/sub etc.), in addition to being able to search for
  // it. Uses the real bdsmRole/sexualPosition fields already on
  // Contact. Kink-specific filtering deliberately not added here —
  // search already covers kinks by name (see below), and a real
  // filter UI for it is a better fit once the flagged Kink Registry
  // management screen exists, rather than a second, narrower mechanism
  // built just for this list.
  const [filterRoles, setFilterRoles] = useState([]);
  const [filterPositions, setFilterPositions] = useState([]);
  // ADDED 26 Aug 2026 — real ask: filter by drives/accommodation too.
  const [filterHosts, setFilterHosts] = useState([]);
  const [filterDrives, setFilterDrives] = useState(false);
  const activeFilterCount = filterRoles.length + filterPositions.length + filterHosts.length + (filterDrives ? 1 : 0);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const searched = q
      ? activeContacts.filter((c) =>
          [c.name, c.nickname, c.phone, c.snapchat, c.fabguys, c.fabswingers, c.recon, c.notes]
            .some((field) => (field || "").toLowerCase().includes(q))
          || [...c.statedKinks.map((s) => s.kinkId), ...c.limits.map((l) => l.kinkId)]
              .map((id) => KinkRegistry.getById(id)?.name || "")
              .some((name) => name.toLowerCase().includes(q))
        )
      : activeContacts;
    // ADDED 26 Aug 2026 — role/position filters narrow further, ANDed
    // with search. Within each filter type, matching ANY selected
    // value counts (a contact tagged Dom OR Switch matches a filter
    // for either) — but a contact must satisfy BOTH filter types if
    // both have selections.
    const roleFiltered = filterRoles.length > 0
      ? searched.filter((c) => (c.bdsmRole || []).some((r) => filterRoles.includes(r)))
      : searched;
    const filteredByFilters = filterPositions.length > 0
      ? roleFiltered.filter((c) => (c.sexualPosition || []).some((p) => filterPositions.includes(p)))
      : roleFiltered;
    // ADDED 26 Aug 2026 — real ask: filter by Accommodation (hosts,
    // single-value field so an exact match) and Drives (boolean, so a
    // single on/off filter rather than a multi-select).
    const hostsFiltered = filterHosts.length > 0
      ? filteredByFilters.filter((c) => filterHosts.includes(c.hosts))
      : filteredByFilters;
    const drivesFiltered = filterDrives
      ? hostsFiltered.filter((c) => c.drives === true)
      : hostsFiltered;
    const sorted = [...drivesFiltered].sort((a, b) => {
      // ADDED 26 Aug 2026 — real ask: favourited contacts always sort
      // first, on top of whatever sort mode is active — checked before
      // any of the normal sort logic below, not a replacement for it.
      if (a.favourited !== b.favourited) return a.favourited ? -1 : 1;
      if (sortBy === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === "incomplete") return getCompletenessScore(a) - getCompletenessScore(b);
      // ADDED — real ask: "orderable also by last encounter." Reuses
      // the same contactEncounterSummary already computed per-card for
      // the inactive-status dot — no new calculation invented, just a
      // new way to sort by a fact the app already derives. Contacts
      // with no encounters at all sort to the very end regardless of
      // direction, since "no last encounter" isn't really "oldest".
      if (sortBy === "lastEncounter") {
        const aLast = contactEncounterSummary(encounters, a.id).lastInteraction;
        const bLast = contactEncounterSummary(encounters, b.id).lastInteraction;
        if (!aLast && !bLast) return 0;
        if (!aLast) return 1;
        if (!bLast) return -1;
        return new Date(bLast) - new Date(aLast);
      }
      return displayName(a).localeCompare(displayName(b));
    });
    return sorted;
  }, [activeContacts, query, sortBy, encounters, filterRoles, filterPositions, filterHosts, filterDrives]);

  return (
    <div>
      {/* CHANGED 26 Aug 2026 — real ask: banners "feel a little boring" —
          added a real outline (darker bottom border for definition
          against the page background) and moved Search/Settings/
          Profile-type icons INTO the banner itself, white against the
          colour, instead of a separate plain row below it. */}
      <div style={{ position: "sticky", top: 0, zIndex: 6, background: T.contactsTeal, borderBottom: "2px solid rgba(0,0,0,0.15)", padding: "16px 16px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: "#FFFFFF" }}>Contacts</span>
        {/* ADDED 18 Aug 2026 — My Profile and Import Shared Profile both
            live here now (Doc 1: My Profile isn't a primary-nav tab;
            Import creates a Contact, so it belongs where Contacts are
            managed). Temporary home until a real Settings screen exists
            for My Profile and a proper Add-Contact menu exists for
            Import — flagged in Doc 1 notes, not the final placement. */}
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {/* ADDED 26 Aug 2026 — real ask: explicit Select toggle,
              matching Medication's pattern — long-press stays as an
              additional quick entry, this is the reliable click-based
              one (long-press alone can be unreliable via mouse, e.g.
              in a desktop preview). */}
          <span onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)} style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF", cursor: "pointer" }}>
            {selectMode ? "Done" : "Select"}
          </span>
          {/* CHANGED 19 Aug 2026 — real icon confusion the user flagged:
              Upload reads as "sending data out", which is backwards for
              an action that brings someone else's shared profile IN.
              Download's arrow-into-tray matches the actual direction.
              CHANGED 26 Aug 2026 — moved into the banner, white. */}
          {onOpenImportProfile && <Download size={19} color="#FFFFFF" style={{ cursor: "pointer" }} onClick={onOpenImportProfile} />}
          {onOpenMyProfile && <User size={19} color="#FFFFFF" style={{ cursor: "pointer" }} onClick={onOpenMyProfile} />}
        </div>
      </div>
      {/* ADDED 26 Aug 2026 — real ask: bulk action toolbar, shown while
          in multi-select mode (entered via long-press on a card). */}
      {selectMode && (
        <div style={{ position: "sticky", top: 62, zIndex: 6, background: "#1B1B1F", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600 }}>{selectedIds.length} selected</span>
          <div style={{ display: "flex", gap: 16 }}>
            {/* ADDED 26 Aug 2026 — real ask: export/print a single
                record, enabled only when exactly one is selected —
                exporting several at once as one file doesn't map to
                "a single record to hand to a provider". */}
            <span onClick={() => { if (selectedIds.length === 1) exportRecordAsFile("contacts", ContactRepository.getById(selectedIds[0])); }}
              style={{ fontSize: 13, color: selectedIds.length === 1 ? "#FFFFFF" : "#6E6E74", fontWeight: 600, cursor: selectedIds.length === 1 ? "pointer" : "default" }}>Export</span>
            <span onClick={() => { if (selectedIds.length > 0) { ContactRepository.bulkArchive(selectedIds); refresh(); exitSelectMode(); } }}
              style={{ fontSize: 13, color: selectedIds.length > 0 ? "#FFFFFF" : "#6E6E74", fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>Archive</span>
            <span onClick={() => {
              if (selectedIds.length === 0) return;
              if (window.confirm(`Delete ${selectedIds.length} contact${selectedIds.length > 1 ? "s" : ""}? You'll have a few seconds to undo.`)) {
                // CHANGED 26 Aug 2026 — now uses the shared
                // triggerDelete helper (lifted to module level) so
                // single-record delete gets identical Trash+undo
                // behavior, not just bulk. Still captures full records
                // BEFORE deleting via getAll(), not the possibly-stale
                // `contacts` prop.
                const toRestore = ContactRepository.getAll().filter((c) => selectedIds.includes(c.id));
                triggerDelete(toRestore);
                refresh();
                exitSelectMode();
              }
            }} style={{ fontSize: 13, color: selectedIds.length > 0 ? "#FF7A7E" : "#6E6E74", fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default" }}>Delete</span>
            <span onClick={exitSelectMode} style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600, cursor: "pointer" }}>Cancel</span>
          </div>
        </div>
      )}
      {/* ADDED 19 Aug 2026 — visible confirmation that data is
          deliberately masked, not missing/broken. */}
      {anonymise && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "8px 16px 0", padding: "8px 12px", borderRadius: radius.sm, background: "#1B1B1F", color: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>
          <EyeOff size={13} /> Anonymise mode is on — names, photos, cities, and car details are hidden.
        </div>
      )}
      <div style={{ padding: "0 16px 12px", fontSize: 12, color: T.textSecondary }}>
        {activeContacts.length} active
      </div>

      <div style={{ padding: "0 16px 10px", display: "flex", alignItems: "center", gap: 8 }}>
        <Search size={16} color={T.textSecondary} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search contacts"
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "'Inter', sans-serif", fontSize: 14, color: T.textPrimary }} />
        {/* ADDED 26 Aug 2026 — real ask: filter by role/position, not
            just search. */}
        <div onClick={() => setShowFilters((s) => !s)} style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 8px", borderRadius: radius.full, cursor: "pointer", border: `1px solid ${activeFilterCount > 0 ? T.contactsTeal : T.border}`, color: activeFilterCount > 0 ? T.contactsTeal : T.textSecondary, fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
          Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </div>
      </div>

      {showFilters && (
        <div style={{ padding: "0 16px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Role</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {BDSM_ROLE_OPTIONS.map((r) => {
              const active = filterRoles.includes(r);
              return (
                <div key={r} onClick={() => setFilterRoles((f) => active ? f.filter((x) => x !== r) : [...f, r])}
                  style={{ padding: "5px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? T.contactsTeal : T.border}`, color: active ? T.contactsTeal : T.textSecondary, background: active ? `${T.contactsTeal}15` : "transparent" }}>
                  {r}
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Position</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {SEXUAL_POSITION_OPTIONS.map((p) => {
              const active = filterPositions.includes(p);
              return (
                <div key={p} onClick={() => setFilterPositions((f) => active ? f.filter((x) => x !== p) : [...f, p])}
                  style={{ padding: "5px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? T.contactsTeal : T.border}`, color: active ? T.contactsTeal : T.textSecondary, background: active ? `${T.contactsTeal}15` : "transparent" }}>
                  {p}
                </div>
              );
            })}
          </div>
          {/* ADDED 26 Aug 2026 — real ask: filter by Accommodation and
              Drives, alongside Role/Position. */}
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Accommodation</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {HOSTS_OPTIONS.map((h) => {
              const active = filterHosts.includes(h);
              return (
                <div key={h} onClick={() => setFilterHosts((f) => active ? f.filter((x) => x !== h) : [...f, h])}
                  style={{ padding: "5px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? T.contactsTeal : T.border}`, color: active ? T.contactsTeal : T.textSecondary, background: active ? `${T.contactsTeal}15` : "transparent" }}>
                  {h}
                </div>
              );
            })}
          </div>
          <div onClick={() => setFilterDrives((d) => !d)}
            style={{ display: "inline-flex", padding: "5px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 6, border: `1px solid ${filterDrives ? T.contactsTeal : T.border}`, color: filterDrives ? T.contactsTeal : T.textSecondary, background: filterDrives ? `${T.contactsTeal}15` : "transparent" }}>
            Drives
          </div>
          {activeFilterCount > 0 && (
            <div onClick={() => { setFilterRoles([]); setFilterPositions([]); setFilterHosts([]); setFilterDrives(false); }} style={{ fontSize: 12, color: T.textSecondary, textDecoration: "underline", cursor: "pointer", display: "block", marginTop: 6 }}>
              Clear filters
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, padding: "0 16px 14px", overflowX: "auto" }}>
        {[
          { key: "name", label: "A–Z" },
          { key: "newest", label: "Newest" },
          { key: "oldest", label: "Oldest" },
          { key: "lastEncounter", label: "Last encounter" },
          { key: "incomplete", label: "Incomplete" },
        ].map((opt) => (
          <div key={opt.key} onClick={() => setSortBy(opt.key)}
            style={{ padding: "6px 12px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", border: `1px solid ${sortBy === opt.key ? T.contactsTeal : T.border}`, color: sortBy === opt.key ? T.contactsTeal : T.textSecondary }}>
            {opt.label}
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: T.textDisabled, fontSize: 13 }}>
          {activeContacts.length === 0 ? "No contacts yet." : "No contacts match your search."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 16px 100px" }}>
          {filtered.map((c) => <ContactCard key={c.id} contact={c} onOpen={onOpen} T={T} encounters={encounters} anonymise={anonymise} inactiveThresholdDays={inactiveThresholdDays}
            activeFilters={activeFilterCount > 0 ? { roles: filterRoles, positions: filterPositions, hosts: filterHosts, drives: filterDrives } : null}
            selectMode={selectMode} selected={selectedIds.includes(c.id)} onToggleSelected={toggleSelected} onLongPress={(id) => { setSelectMode(true); toggleSelected(id); }}
            onToggleFavourite={(id) => { ContactRepository.update(id, { favourited: !c.favourited }); refresh(); }} />)}
        </div>
      )}

      {/* ADDED 26 Aug 2026 — real ask: undo for delete. CHANGED to also
          support redo, matching editUndoHelpers.js's own undo/redo
          toast pattern for consistency. */}
      {deleteToast && (
        <div onClick={deleteToast.mode === "undo" ? undoDelete : redoDelete}
          style={{ position: "fixed", bottom: 90, left: 20, right: 20, maxWidth: 560, margin: "0 auto", background: "#1B1B1F", color: "#FFFFFF", padding: "12px 16px", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", zIndex: 40, boxShadow: "0 4px 16px rgba(0,0,0,.3)" }}>
          <span style={{ fontSize: 13 }}>
            {deleteToast.mode === "undo"
              ? `${deleteToast.records.length} contact${deleteToast.records.length > 1 ? "s" : ""} deleted`
              : `${deleteToast.records.length} contact${deleteToast.records.length > 1 ? "s" : ""} restored`}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.contactsTeal }}>
            {deleteToast.mode === "undo" ? "Tap to undo" : "Tap to redo"}
          </span>
        </div>
      )}


      {/* CHANGED 19 Aug 2026 — real bugs the user flagged: this used to
          assume a fixed 390px-wide container (breaks on any other
          screen width) and sat at a different vertical offset than
          Encounters' own Add button. CHANGED 26 Aug 2026 — real audit
          finding: anchoring straight to `right: 20` (no wrapper) only
          looks correct on a narrow mobile viewport — on a wide
          desktop/preview window it sits near the actual browser edge,
          not the centered content column's edge. Medication's own FAB
          already solved this correctly with an adaptive wrapper
          (`maxWidth: 600` centering, not the old broken fixed-390px
          one this comment used to warn against) — applying the same
          fix here. */}
      {/* FIXED — real bug: the favourite star on each ContactCard is
          position:absolute with zIndex:2, nested in a card whose own
          parent doesn't establish a stacking context — so that z-index
          competed directly with this FAB's (previously unset, so
          effectively 0) rather than staying scoped to its own card.
          A star on a scrolled-past card could paint over the fixed Add
          button. Explicit zIndex here, well above any in-card value. */}
      <div style={{ position: "fixed", bottom: 90, left: 0, right: 0, maxWidth: 600, margin: "0 auto", display: "flex", justifyContent: "flex-end", padding: "0 20px", pointerEvents: "none", zIndex: 20 }}>
        <div onClick={onAdd} style={{ width: 56, height: 56, borderRadius: radius.full, background: T.fabBg, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,.25)", cursor: "pointer", pointerEvents: "auto" }}>
          <Plus size={24} color={T.fabIcon} />
        </div>
      </div>
    </div>
  );
}

export default function ContactsModule({ openAddOnMount = false, onConsumedQuickAdd, openRecordId, onConsumedRecordOpen, onNavigateToRecord, registerModuleBackHandler } = {}) {
  const [contacts, setContacts] = useState(() => loadContacts());
  const refresh = () => setContacts(loadContacts());
  // ADDED 19 Aug 2026 — real undo/redo, same shared mechanism as
  // Encounters — see editUndoHelpers.js.
  const editUndo = useEditUndo(ContactRepository);

  const [screen, setScreen] = useState("list");
  const [activeContactId, setActiveContactId] = useState(null);
  const [editingContact, setEditingContact] = useState(null);
  // CHANGED 26 Aug 2026 — real ask: default sort is now Last Encounter
  // (most-recently-active contacts first) instead of alphabetical Name.
  // The sort option itself already existed — this only changes the
  // default the list opens on.
  const [sortBy, setSortBy] = useState("lastEncounter");
  const [query, setQuery] = useState("");
  // ADDED 18 Aug 2026 — My Profile and Import Shared Profile both open
  // from here now (see the header icons in ContactsList above).
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [showImportProfile, setShowImportProfile] = useState(false);
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : LIGHT;
  // CHANGED 26 Aug 2026 — real gap found and fixed: this used to live
  // only inside ContactsList (bulk delete), so a single-record delete
  // from ContactProfile wrote to Trash but showed no undo toast at
  // all — the toast needs to be visible on whichever screen the user
  // actually lands on after deleting, which for a single delete is
  // this module's List (Profile itself unmounts via onBack right
  // after), so the state has to live above both, not inside either.
  // CHANGED again, 26 Aug 2026 — real ask, previously flagged as
  // low-priority and now built: redo for delete, not just undo — same
  // mode-based {mode, records} shape already proven in
  // editUndoHelpers.js's undo/redo for edits, applied here to keep the
  // two mechanisms consistent rather than inventing a second pattern.
  const [deleteToast, setDeleteToast] = useState(null); // { mode: "undo" | "redo", records }
  const undoTimerRef = useRef(null);
  const undoDelete = () => {
    if (!deleteToast) return;
    deleteToast.records.forEach((record) => ContactRepository.restore(record));
    refresh();
    clearTimeout(undoTimerRef.current);
    // Records are back — offer a brief "redo" (re-delete) in case the
    // undo itself was the mistake, same as edit undo/redo already does.
    setDeleteToast({ mode: "redo", records: deleteToast.records });
    undoTimerRef.current = setTimeout(() => setDeleteToast(null), 8000);
  };
  const redoDelete = () => {
    if (!deleteToast) return;
    TrashRepository.add("contacts", deleteToast.records);
    deleteToast.records.forEach((r) => ContactRepository.delete(r.id));
    refresh();
    setDeleteToast(null);
    clearTimeout(undoTimerRef.current);
  };
  // Single source of truth for "delete this record safely" — Trash
  // write + toast, used identically whether triggered from the List's
  // bulk-select toolbar or a single record's own Profile screen.
  const triggerDelete = (records) => {
    TrashRepository.add("contacts", records);
    records.forEach((r) => ContactRepository.delete(r.id));
    setDeleteToast({ mode: "undo", records });
    clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setDeleteToast(null), 8000);
  };

  // ADDED 19 Aug 2026 — Dashboard quick-add: App.jsx remounts this
  // module fresh whenever the bottom nav switches to it (each module is
  // a completely different component instance per tab, so switching
  // tabs already unmounts/remounts today, independent of this feature).
  // A mount-only effect is enough to catch "the user tapped Home's New
  // Contact button", since that always causes a fresh mount here.
  // onConsumedQuickAdd resets App.jsx's flag so navigating here again
  // manually (via the bottom nav) doesn't re-trigger the add sheet.
  useEffect(() => {
    if (openAddOnMount) {
      setEditingContact({});
      onConsumedQuickAdd?.();
    }
    // ADDED — real ask: real cross-module navigation, same mount-time
    // pattern as the Quick Add effect right above — deep-links straight
    // to a specific contact when arriving here via a tapped attendee
    // from Encounters, instead of always landing on the plain list.
    if (openRecordId) {
      openProfile(openRecordId);
      onConsumedRecordOpen?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openProfile = (id) => { setActiveContactId(id); setScreen("profile"); };
  const backToList = () => { setScreen("list"); refresh(); };

  // ADDED 26 Aug 2026 — real ask: back should go one step within this
  // module. Contacts has independent overlay states (editingContact,
  // showMyProfile, showImportProfile) rather than a single screen
  // value like Testing/Symptom Log — checked in priority order,
  // matching App.jsx's own overlay-before-navigation pattern: whatever
  // is currently visible ON TOP closes first, then the underlying
  // screen navigates.
  useEffect(() => {
    if (!registerModuleBackHandler) return;
    registerModuleBackHandler(() => {
      if (editingContact !== null) { setEditingContact(null); return true; }
      if (showMyProfile) { setShowMyProfile(false); return true; }
      if (showImportProfile) { setShowImportProfile(false); return true; }
      if (screen === "profile") { backToList(); return true; }
      return false;
    });
    return () => registerModuleBackHandler(null);
  }, [editingContact, showMyProfile, showImportProfile, screen, registerModuleBackHandler]);

  const saveEdit = (form) => {
    if (editingContact && editingContact.id) {
      // ADDED 19 Aug 2026 — real undo/redo: snapshot right before the
      // real update happens, so undo restores the genuine pre-edit
      // state.
      editUndo.captureBeforeEdit(editingContact.id);
      ContactRepository.update(editingContact.id, form);
      editUndo.notifyEdited(editingContact.id);
    } else {
      ContactRepository.create(form);
    }
    refresh();
    setEditingContact(null);
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: T.bg, minHeight: "100vh", display: "flex", justifyContent: "center" }}>
      {/* ADDED 19 Aug 2026 — real undo/redo toast, same visual pattern
          as Medication's own, kept consistent. */}
      {editUndo.toast && (
        <div onClick={editUndo.toast.mode === "undo" ? editUndo.undo : editUndo.redo}
          style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", width: 340, background: editUndo.toast.mode === "undo" ? "#1B1B1F" : T.contactsTeal, color: "#FFFFFF", borderRadius: 999, padding: "10px 16px", fontSize: 13, fontWeight: 600, textAlign: "center", cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,.25)", zIndex: 230, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {editUndo.toast.mode === "undo" ? <Check size={14} /> : <RefreshCcw size={14} />}
          {editUndo.toast.mode === "undo" ? "Contact updated — tap to undo" : "Undone — tap to redo"}
        </div>
      )}
      {/* CHANGED 26 Aug 2026 — same fix already shipped in Medication:
          was a fixed 390px regardless of viewport; now fills the screen
          on mobile and caps at a real desktop-appropriate width on
          larger screens, rather than stretching single-column cards
          absurdly wide. Outer wrapper already centers via
          justifyContent: "center", so this is a like-for-like swap. */}
      <div style={{ width: "100%", maxWidth: 600, background: T.bg, minHeight: "100vh", borderLeft: `1px solid ${T.border}`, borderRight: `1px solid ${T.border}` }}>
        {screen === "list" ? (
          <ContactsList contacts={contacts} T={T} onOpen={openProfile} onAdd={() => setEditingContact({})} sortBy={sortBy} setSortBy={setSortBy} query={query} setQuery={setQuery}
            onOpenMyProfile={() => setShowMyProfile(true)} onOpenImportProfile={() => setShowImportProfile(true)} refresh={refresh}
            deleteToast={deleteToast} undoDelete={undoDelete} redoDelete={redoDelete} triggerDelete={triggerDelete} />
        ) : (
          <ContactProfile contactId={activeContactId} T={T} onBack={backToList} onEdit={(id) => setEditingContact(ContactRepository.getById(id))} onOpenContact={openProfile} refresh={refresh} onNavigateToRecord={onNavigateToRecord} triggerDelete={triggerDelete} />
        )}

        {editingContact !== null && (
          <ContactEditSheet contact={editingContact.id ? editingContact : null} contacts={contacts} onSave={saveEdit} onClose={() => setEditingContact(null)} refresh={refresh} T={T} />
        )}

        {/* CHANGED 18 Aug 2026 — removed this module's own static, non-
            functional bottom bar (it only ever showed "Contacts",
            regardless of which screen was actually active — the exact
            inconsistency the user flagged). The real persistent nav now
            lives once, in App.jsx, shared across every module. */}
        {showMyProfile && (
          <div style={{ position: "fixed", inset: 0, zIndex: 210 }}>
            <MyProfileModule onClose={() => setShowMyProfile(false)} registerModuleBackHandler={registerModuleBackHandler} />
          </div>
        )}
        {showImportProfile && (
          <ImportSharedProfileSheet T={T} onClose={() => setShowImportProfile(false)} onImported={refresh} />
        )}
      </div>
    </div>
  );
}

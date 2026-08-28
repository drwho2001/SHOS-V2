// SHOS_MyProfile_Prototype.jsx
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// The "My Profile / Shareable Contact Card" screen. Two things live
// here, and only two: (1) editing YOUR OWN shareable profile data
// (backed by myProfileRepository.js), and (2) sharing it out / pulling
// someone else's shared profile in as a new Contact (backed by
// profileShareService.js). This module never touches ContactRepository
// directly except via importProfileAsContact() — importing a shared
// profile is what CREATES a Contact, this module doesn't manage
// Contacts itself.
//
// Same self-contained pattern as Encounters: own theme constants, own
// form primitives, no shared UI-library file yet (that's a possible
// future abstraction once several modules exist to compare, not
// something to impose now). Colored teal — this lives under Identity
// alongside Contacts in Notion, and the profile IS "what a Contact
// entry would look like for you", so sharing Contacts' color makes
// that relationship visible rather than picking an arbitrary new hue.

import React, { useState, useRef, useEffect } from "react";
import { UserIcon as User, DownloadSimpleIcon as Download, CopyIcon as Copy, CheckIcon as Check, XIcon as X, CaretLeftIcon as ChevronLeft, ShareNetworkIcon as Share } from "@phosphor-icons/react";
import { MyProfileRepository, DEFAULT_PROFILE } from "../repositories/myProfileRepository";
import { TestingRepository } from "../repositories/testingRepository";
import {
  buildProfileShare, exportProfileShare,
} from "../storage/profileShareService";
// Reusing Contacts' own option constants for fields that must line up
// with Contact's real values (Hosts/Travels/Availability/etc.) — same
// values, not retyped, so a shared profile always maps onto a valid
// Contact field value on the receiving end.
import {
  HOSTS_OPTIONS, TRAVELS_OPTIONS, TRAVEL_MODE_OPTIONS, AVAILABILITY_OPTIONS, READILY_AVAILABLE_OPTIONS,
  LENGTH_OPTIONS, GIRTH_OPTIONS, FORESKIN_OPTIONS, FORESKIN_DETAIL_OPTIONS, CHASTITY_OPTIONS,
  CUMMER_FREQUENCY_OPTIONS, CUMMER_VOLUME_OPTIONS, CUMMER_STYLE_OPTIONS,
  PREP_DOXY_OPTIONS, DAYS_OF_WEEK, TIME_CONSTRAINT_TYPES, AVAILABILITY_RULE_TYPES,
  BDSM_ROLE_OPTIONS, SEXUAL_POSITION_OPTIONS,
} from "../repositories/contactRepository";
import { KinkRegistry, KINK_ROLE_OPTIONS, resolveKinkSynonym, analyzeKinkEntry, getKinkRoleOptions } from "../registries/kinkRegistry";
// ADDED — real fix: same normalizeTag Contacts/Encounters use.
import { normalizeTag } from "../calculations/contactCalculations";
import { ChemsRegistry, resolveChemSynonym } from "../registries/chemsRegistry";
import { CustomOptionListsRepository } from "../repositories/customOptionListsRepository";
// CHANGED 20 Aug 2026 — real design-unification pass: values read
// from the shared designTokens.js source of truth instead of being
// retyped here, so this screen can't silently drift from every other
// module's "same" color/radius. See designTokens.js.
import { NEUTRAL, NEUTRAL_DARK, ACCENTS, ACTION, RADIUS } from "../calculations/designTokens";
import { useDarkModePreference } from "../calculations/darkModePreference";

const LIGHT = {
  ...NEUTRAL,
  contactsTeal: ACCENTS.contacts, actionRed: ACTION.red, actionGreen: ACTION.green,
  navActive: ACCENTS.contacts, fabBg: NEUTRAL.textPrimary, fabIcon: NEUTRAL.surface,
};
// Dark mode, on Medication's DARK basis — see Contacts' own comment
// for the full reasoning. fabBg/fabIcon stay derived from the neutral
// pair (not hardcoded) so the FAB keeps its inverted-contrast look in
// both modes automatically — dark FAB on light bg, light FAB on dark bg.
const DARK = {
  ...NEUTRAL_DARK,
  contactsTeal: ACCENTS.contacts, actionRed: "#FF7A7E", actionGreen: "#5FD9A4",
  navActive: ACCENTS.contacts, fabBg: NEUTRAL_DARK.textPrimary, fabIcon: NEUTRAL_DARK.surface,
};
const radius = RADIUS;

function idFromLabel(label) {
  return "combo-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ── Shared form primitives — same visual shape as Contacts', kept
// local per the self-contained-module pattern rather than importing
// from a file that isn't a shared UI library. ──

function SectionCard({ title, T, children }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: radius.md, background: T.surface, padding: "4px 14px 14px", marginTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.contactsTeal, textTransform: "uppercase", letterSpacing: 0.5, paddingTop: 12, marginBottom: 2 }}>{title}</div>
      {children}
    </div>
  );
}

// ADDED 26 Aug 2026 — real ask: profile photo, previously missing
// entirely. Matches Contacts' own PhotoPicker implementation exactly
// (same data-URL storage approach) — duplicated, not imported, per
// this app's established self-contained-module convention.
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
        style={{ width: 64, height: 64, borderRadius: 999, background: T.surfaceVariant, border: `1px solid ${T.border}`, cursor: "pointer", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {value ? (
          <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <User size={24} color={T.textDisabled} />
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div onClick={() => inputRef.current?.click()} style={{ fontSize: 12, fontWeight: 600, color: T.contactsTeal, cursor: "pointer" }}>
          {value ? "Change photo" : "Add photo"}
        </div>
        <div style={{ fontSize: 11, color: T.textDisabled }}>Only shared if you export this profile to someone else — not needed for your own device.</div>
        {value && (
          <div onClick={() => onChange("")} style={{ fontSize: 12, color: T.actionRed, cursor: "pointer" }}>Remove</div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
    </div>
  );
}

// ADDED 26 Aug 2026 — real ask: was a manually-typed field, separate
// from and easy to fall out of sync with the actual Testing module.
// Now genuinely auto-calculated from real Test records — same
// future-date exclusion Home dashboard's own "Last test" already
// uses (a scheduled-but-not-yet-happened test shouldn't count).
// "Store facts, derive state" — this was a fact stored in the wrong
// place; the real fact already lives in Testing's own records.
function getAutoLastTestedDate() {
  const tests = TestingRepository.getAll().filter((t) => !t.isArchived && t.date && t.date.slice(0, 10) <= new Date().toISOString().slice(0, 10));
  const sorted = [...tests].sort((a, b) => new Date(b.date) - new Date(a.date));
  return sorted[0]?.date || null;
}

function TextField({ label, value, onChange, T, placeholder, type = "text" }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      <input type={type} value={value ?? ""}
        onChange={(e) => onChange(type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
    </div>
  );
}

// ADDED — real ask: trans/hetero inclusivity. Free text with real
// suggestion chips from an in-app-editable option list, same pattern
// already proven in Vaccinations' VaccineField — typing anything not
// suggested just works and gets remembered for next time.
function SuggestField({ label, value, onChange, options, onAddNew, T, placeholder }) {
  const visibleSuggestions = options.filter((o) => o !== value);
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {visibleSuggestions.map((o) => (
            <div key={o} onClick={() => onChange(o)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.contactsTeal}`, color: T.contactsTeal, cursor: "pointer" }}>
              {o}
            </div>
          ))}
        </div>
      )}
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        onBlur={() => { if (value && value.trim()) onAddNew(value.trim()); }}
        onKeyDown={(e) => { if (e.key === "Enter" && value && value.trim()) { e.preventDefault(); onAddNew(value.trim()); e.target.blur(); } }}
        placeholder={placeholder}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
    </div>
  );
}

function TextAreaField({ label, value, onChange, T, placeholder }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box", resize: "vertical" }} />
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
            <div key={opt} onClick={() => toggle(opt)}
              style={{ padding: "5px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? T.contactsTeal : T.border}`, color: active ? T.contactsTeal : T.textSecondary, background: active ? `${T.contactsTeal}15` : "transparent" }}>
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
    <div onClick={() => onChange(!value)} style={{ width: 40, height: 24, borderRadius: radius.full, background: value ? T.contactsTeal : T.surfaceVariant, position: "relative", cursor: "pointer", transition: "background 150ms ease" }}>
      <div style={{ position: "absolute", top: 2, left: value ? 18 : 2, width: 20, height: 20, borderRadius: radius.full, background: "#FFFFFF", transition: "left 150ms ease", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
    </div>
  );
}

// CHANGED 18 Aug 2026 — Approximate-age toggle removed for My Profile
// specifically (the user's ask: not meaningful for your own age — you know
// it exactly). Contacts keeps its own separate AgeField with the
// toggle, since someone else's stated age genuinely can be approximate.
// ageIsApprox stays in DEFAULT_PROFILE's shape (harmless, just never
// set true from here) rather than removing the field outright — same
// "don't silently drop from the data model" pattern used elsewhere.
function AgeField({ age, onChangeAge, T }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Age</div>
      <input type="number" value={age ?? ""} onChange={(e) => onChangeAge(e.target.value === "" ? null : Number(e.target.value))}
        style={{ width: 90, padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
    </div>
  );
}

// Same TagInput shape as Contacts' — free-text tags, used only for
// contactableVia here (extra platforms beyond the named fields below).
function TagInput({ label, value, onChange, T, placeholder }) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const raw = draft.trim();
    if (!raw) return;
    const parts = raw.split(",").map((t) => t.trim()).filter((t) => t && !value.includes(t));
    if (parts.length > 0) onChange([...value, ...parts]);
    setDraft("");
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
      <input value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        onBlur={commit}
        placeholder={placeholder || "Type, comma-separated, then Enter"}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
    </div>
  );
}

// Registry-backed picker, same shape/behavior as Contacts' own
// RegistryTagPicker — resolves stored IDs to display names, creates a
// new registry entry (case-insensitively deduped) on a fresh typed tag.
function RegistryTagPicker({ label, value, onChange, T, registry, placeholder, excludeIds = [], trackRole = false, roleOptions = [], resolveSynonym = (x) => x, analyzeEntry = null, getRoleOptionsForKink = null }) {
  const [draft, setDraft] = useState("");
  // ADDED — real ask: "did you mean...?" for a recognized typo or an
  // umbrella term, same mechanism now built and proven in Contacts/
  // Encounters.
  const [pendingSuggestion, setPendingSuggestion] = useState(null);
  const listId = idFromLabel(label) + "-registry";
  const allEntries = registry.getAll().filter((e) => !e.isArchived);
  const nameFor = (id) => allEntries.find((e) => e.id === id)?.name || registry.getById(id)?.name || "?";

  // ADDED 18 Aug 2026 — trackRole mode: `value` becomes an array of
  // {kinkId, role} selections — matches Contacts' Stated Kinks/
  // Encounters' Kinks Involved, so a shared profile always maps onto
  // the same field shape a Contact expects on import.
  const selectedIds = trackRole ? value.map((v) => v.kinkId) : value;
  const hasSelection = (id) => selectedIds.includes(id);

  // CHANGED 18 Aug 2026 — excludes excludeIds too now, so a kink already
  // marked "into" doesn't get suggested as a limit and vice versa.
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
  // cycled — same fix as Contacts/Encounters, restoring what the user's
  // original Notion data (Dom/sub vs Top/bottom) actually knew. See
  // KINK_ROLE_STYLE in kinkRegistry.js for the full reasoning.
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

  // CHANGED — real bug found in the user's own testing: same root cause as
  // Encounters' identical gap — this called findOrCreate on raw,
  // untouched text, no case-normalization, no synonym resolution,
  // unlike Contacts' own version of this picker. A kink typed here
  // slightly differently from how it was typed in Contacts silently
  // created a separate, near-duplicate registry entry instead of
  // resolving to the one real one.
  const finalizeEntry = (resolvedName) => {
    const entry = registry.findOrCreate(resolvedName);
    if (entry && !hasSelection(entry.id)) addEntries([entry.id]);
  };

  const commitDraft = () => {
    const raw = draft.trim();
    if (!raw) return;
    const parts = raw.split(",").map((t) => t.trim()).filter(Boolean);

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

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {(trackRole ? value : value.map((id) => ({ kinkId: id, role: null }))).map((sel) => {
            const roleOptionsForThisKink = trackRole ? resolveRoleOptions(sel.kinkId) : null;
            return (
              <div key={sel.kinkId} style={{ display: "flex", alignItems: "center", borderRadius: radius.full, background: T.surfaceVariant, overflow: "hidden" }}>
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
      {/* CHANGED 18 Aug 2026 — moved above the input so the on-screen
          keyboard doesn't cover the suggestions the moment you tap in. */}
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
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitDraft(); } }}
        onBlur={commitDraft}
        placeholder={placeholder || "Pick existing or type new ones, comma-separated"}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
      <datalist id={listId}>
        {allEntries.map((e) => <option key={e.id} value={e.name} />)}
      </datalist>
      {/* ADDED — real ask: "did you mean...?" prompt, same behavior as
          Contacts/Encounters. */}
      {pendingSuggestion && (
        <div style={{ marginTop: 6, padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.contactsTeal}`, background: `${T.contactsTeal}10` }}>
          {pendingSuggestion.type === "umbrella" ? (
            <>
              <div style={{ fontSize: 12, color: T.textPrimary, marginBottom: 6 }}>
                "{pendingSuggestion.typedAs}" is a broader term — did you mean {pendingSuggestion.specific.length > 1 ? "one of these more specific ones" : "the more specific"}?
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {pendingSuggestion.specific.map((entry) => (
                  <div key={entry.id} onClick={() => { finalizeEntry(entry.name); setPendingSuggestion(null); }}
                    style={{ padding: "4px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, background: T.contactsTeal, color: "#FFFFFF", cursor: "pointer" }}>
                    Use "{entry.name}"
                  </div>
                ))}
                <div onClick={() => { finalizeEntry(pendingSuggestion.typedAs); setPendingSuggestion(null); }}
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
                <div onClick={() => { finalizeEntry(pendingSuggestion.suggestion); setPendingSuggestion(null); }}
                  style={{ padding: "4px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, background: T.contactsTeal, color: "#FFFFFF", cursor: "pointer" }}>
                  Yes, use "{pendingSuggestion.suggestion}"
                </div>
                <div onClick={() => { finalizeEntry(pendingSuggestion.typedAs); setPendingSuggestion(null); }}
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

// Same repeatable day/time rule builder as Contacts' non-availability
// rules — same shape kept deliberately, since these end up on a
// Contact record shaped identically once imported on the other end.
function AvailabilityRuleBuilder({ rules, onChange, T }) {
  const [draft, setDraft] = useState({ type: "Unavailable", days: [], timeConstraint: "All day", time: "18:00", note: "" });

  const toggleDay = (day) => {
    setDraft((d) => ({ ...d, days: d.days.includes(day) ? d.days.filter((x) => x !== day) : [...d.days, day] }));
  };
  const addRule = () => {
    if (draft.days.length === 0) return;
    onChange([...rules, { id: `rule_${Date.now()}`, ...draft }]);
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
              <X size={14} style={{ cursor: "pointer", flexShrink: 0, marginLeft: 8 }} onClick={() => removeRule(r.id)} />
            </div>
          ))}
        </div>
      )}
      <div style={{ padding: 10, borderRadius: radius.sm, border: `1px dashed ${T.border}` }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {AVAILABILITY_RULE_TYPES.map((t) => (
            <div key={t} onClick={() => setDraft((d) => ({ ...d, type: t }))}
              style={{ padding: "4px 10px", borderRadius: radius.full, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${draft.type === t ? T.contactsTeal : T.border}`, color: draft.type === t ? T.contactsTeal : T.textSecondary }}>
              {t}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
          {DAYS_OF_WEEK.map((d) => (
            <div key={d} onClick={() => toggleDay(d)}
              style={{ width: 32, height: 32, borderRadius: radius.full, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${draft.days.includes(d) ? T.contactsTeal : T.border}`, color: draft.days.includes(d) ? T.contactsTeal : T.textSecondary, background: draft.days.includes(d) ? `${T.contactsTeal}15` : "transparent" }}>
              {d}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {TIME_CONSTRAINT_TYPES.map((tc) => (
            <div key={tc} onClick={() => setDraft((d) => ({ ...d, timeConstraint: tc }))}
              style={{ padding: "4px 10px", borderRadius: radius.full, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${draft.timeConstraint === tc ? T.contactsTeal : T.border}`, color: draft.timeConstraint === tc ? T.contactsTeal : T.textSecondary }}>
              {tc}
            </div>
          ))}
          {draft.timeConstraint !== "All day" && (
            <input type="time" value={draft.time} onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
              style={{ padding: "4px 8px", borderRadius: radius.sm, border: `1px solid ${T.border}`, fontSize: 12 }} />
          )}
        </div>
        <input value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
          placeholder="Optional note"
          style={{ width: "100%", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surface, fontSize: 12, boxSizing: "border-box", marginBottom: 8 }} />
        <div onClick={addRule}
          style={{ textAlign: "center", padding: "8px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, cursor: "pointer", background: draft.days.length ? T.contactsTeal : T.surfaceVariant, color: draft.days.length ? "#FFFFFF" : T.textDisabled }}>
          Add exception
        </div>
      </div>
    </div>
  );
}

// ── Edit screen ──
function MyProfileEditScreen({ profile, onSave, onCancel, T }) {
  const [form, setForm] = useState(profile);
  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));
  const [genderOptions, setGenderOptions] = useState(() => CustomOptionListsRepository.get("gender"));

  return (
    <div data-myprofile-sheet style={{ position: "fixed", inset: 0, background: T.bg, overflowY: "auto", zIndex: 200 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}`, zIndex: 1 }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onCancel} />
        <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Edit My Profile</span>
        <div onClick={() => onSave(form)} style={{ padding: "6px 14px", borderRadius: radius.full, background: T.contactsTeal, color: "#FFFFFF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</div>
      </div>

      <div style={{ padding: "0 16px 100px" }}>
        <SectionCard title="Identity" T={T}>
          <PhotoPicker value={form.profilePicture} onChange={set("profilePicture")} T={T} />
          <TextField label="Full name" value={form.displayName} onChange={set("displayName")} T={T} placeholder="Your full name" />
          <TextField label="Nickname" value={form.nickname} onChange={set("nickname")} T={T} placeholder="e.g. Alex" />
          <TextField label="Pronouns" value={form.pronouns} onChange={set("pronouns")} T={T} placeholder="e.g. he/him, she/her, they/them" />
          <SuggestField label="Gender" value={form.gender} onChange={set("gender")} options={genderOptions}
            onAddNew={(v) => setGenderOptions(CustomOptionListsRepository.add("gender", v))} T={T} placeholder="e.g. Male, Female, Non-binary" />
          <AgeField age={form.age} onChangeAge={set("age")} T={T} />
          <TextField label="City" value={form.city} onChange={set("city")} T={T} placeholder="Deliberately city, not full address — see privacy note" />
        </SectionCard>

        <SectionCard title="Find me on" T={T}>
          <TextField label="Phone/WhatsApp" value={form.phone} onChange={set("phone")} T={T} placeholder="e.g. +44 7700 900123" />
          <TextField label="Snapchat" value={form.snapchat} onChange={set("snapchat")} T={T} placeholder="Username" />
          <TextField label="Fabguys" value={form.fabguys} onChange={set("fabguys")} T={T} placeholder="Username" />
          <TextField label="Fabswingers" value={form.fabswingers} onChange={set("fabswingers")} T={T} placeholder="Username" />
          <TextField label="Recon" value={form.recon} onChange={set("recon")} placeholder="Username" T={T} />
          <TagInput label="Other platforms" value={form.contactableVia} onChange={set("contactableVia")} T={T} placeholder="Grindr, Tinder, etc." />
        </SectionCard>

        <SectionCard title="Hosting / Travel" T={T}>
          <SelectField label="Hosts" value={form.hosts} onChange={set("hosts")} options={HOSTS_OPTIONS} T={T} />
          <SelectField label="Travels" value={form.travels} onChange={set("travels")} options={TRAVELS_OPTIONS} T={T} />
          {(form.travels === "Yes" || form.travels === "Sometimes") && (
            <MultiSelectChips label="Travel mode" value={form.travelMode} onChange={set("travelMode")} options={TRAVEL_MODE_OPTIONS} T={T} />
          )}
        </SectionCard>

        <SectionCard title="Availability" T={T}>
          <MultiSelectChips label="General availability" value={form.availability} onChange={set("availability")} options={AVAILABILITY_OPTIONS} T={T} />
          <SelectField label="Readily available?" value={form.readilyAvailable} onChange={set("readilyAvailable")} options={READILY_AVAILABLE_OPTIONS} T={T} />
          <AvailabilityRuleBuilder rules={form.nonAvailabilityRules} onChange={set("nonAvailabilityRules")} T={T} />
        </SectionCard>

        <SectionCard title="Into / Limits" T={T}>
          <RegistryTagPicker label="Into" value={form.statedKinks} onChange={set("statedKinks")} registry={KinkRegistry} T={T} excludeIds={form.limits.map((l) => l.kinkId)} trackRole roleOptions={KINK_ROLE_OPTIONS} resolveSynonym={resolveKinkSynonym} analyzeEntry={analyzeKinkEntry} getRoleOptionsForKink={getKinkRoleOptions} />
          <RegistryTagPicker label="Limits" value={form.limits} onChange={set("limits")} registry={KinkRegistry} T={T} excludeIds={form.statedKinks.map((s) => s.kinkId)} trackRole roleOptions={KINK_ROLE_OPTIONS} resolveSynonym={resolveKinkSynonym} analyzeEntry={analyzeKinkEntry} getRoleOptionsForKink={getKinkRoleOptions} />
          <MultiSelectChips label="Role" value={form.bdsmRole} onChange={set("bdsmRole")} options={BDSM_ROLE_OPTIONS} T={T} />
          <MultiSelectChips label="Position" value={form.sexualPosition} onChange={set("sexualPosition")} options={SEXUAL_POSITION_OPTIONS} T={T} />
        </SectionCard>

        <SectionCard title="Chems" T={T}>
          <RegistryTagPicker label="Known chems" value={form.knownChems} onChange={set("knownChems")} registry={ChemsRegistry} T={T} resolveSynonym={resolveChemSynonym} />
        </SectionCard>

        <SectionCard title="Physical" T={T}>
          <SelectField label="Length (penis)" value={form.length} onChange={set("length")} options={LENGTH_OPTIONS} T={T} />
          <SelectField label="Girth (penis)" value={form.thickness} onChange={set("thickness")} options={GIRTH_OPTIONS} T={T} />
          <SelectField label="Foreskin" value={form.foreskin} onChange={set("foreskin")} options={FORESKIN_OPTIONS} T={T} />
          {form.foreskin === "Uncircumcised" && (
            <SelectField label="Foreskin fit" value={form.foreskinDetail} onChange={set("foreskinDetail")} options={FORESKIN_DETAIL_OPTIONS} T={T} />
          )}
          <SelectField label="Chastity status" value={form.chastityStatus} onChange={set("chastityStatus")} options={CHASTITY_OPTIONS} T={T} />
          {/* ADDED — parity with the same descriptor already added to
              Contacts' Chastity field. */}
          <div style={{ fontSize: 11, color: T.textDisabled, marginTop: -6, marginBottom: 6 }}>Only relevant if chastity is something you're genuinely into — leave as N/A otherwise.</div>
          <MultiSelectChips label="Cummer — frequency" value={form.cummer} onChange={set("cummer")} options={CUMMER_FREQUENCY_OPTIONS} T={T} />
          <MultiSelectChips label="Cummer — volume" value={form.cummer} onChange={set("cummer")} options={CUMMER_VOLUME_OPTIONS} T={T} />
          <MultiSelectChips label="Cummer — style" value={form.cummer} onChange={set("cummer")} options={CUMMER_STYLE_OPTIONS} T={T} />
        </SectionCard>

        <SectionCard title="Sexual health status" T={T}>
          <MultiSelectChips label="Known PrEP/DoxyPEP" value={form.knownPrepDoxy} onChange={set("knownPrepDoxy")} options={PREP_DOXY_OPTIONS} T={T} />
          {/* ADDED 18 Aug 2026 — the user's ask: nothing selected here should
              read as an explicit, deliberate "not on it" — not as an
              unanswered question — since this is your OWN status, which
              you know for certain (unlike the equivalent field on a
              Contact, where empty genuinely can mean "I don't know").
              Deliberately not colored red: red is this app's existing
              "needs action" signal (see the design system's Action State
              colors), and "not on PrEP" isn't something needing action —
              using red here would misapply that meaning. Neutral/muted
              instead, same visual language as an unselected state
              elsewhere, just with explicit wording. */}
          {form.knownPrepDoxy.length === 0 && (
            <div style={{ fontSize: 12, color: T.textDisabled, fontStyle: "italic", padding: "2px 0 8px" }}>
              Not currently on PrEP or DoxyPEP
            </div>
          )}
          {/* CHANGED 26 Aug 2026 — real ask: auto-calculated from
              actual Test records, not typed in manually — no longer
              editable here. */}
          <div style={{ padding: "8px 0" }}>
            <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Last tested date</div>
            <div style={{ fontSize: 14, color: T.textPrimary }}>
              {getAutoLastTestedDate() ? new Date(getAutoLastTestedDate()).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "No tests logged yet"}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="About me" T={T}>
          <TextAreaField label="A short note about yourself" value={form.aboutMeNotes} onChange={set("aboutMeNotes")} T={T} placeholder="Not shown to anyone unless you share your profile." />
        </SectionCard>

        {/* ADDED 19 Aug 2026 — Clinic Card's two real, previously-flagged
            gaps (Allergies, Emergency information), the user's explicit call
            on where they should live. Deliberately its own section,
            visually and functionally separate from everything above it:
            NONE of these three fields are included when you share your
            profile — see profileShareService.js's mapShareToContactData()
            for the enforcement, this banner is just making that visible
            here too so it's never a surprise. */}
        <SectionCard title="Clinical & emergency info (never shared)" T={T}>
          <div style={{ fontSize: 11, color: T.textDisabled, marginBottom: 8, fontStyle: "italic" }}>
            For your own Clinic Card only — excluded from Share/Export, even if you share your full profile with someone.
          </div>
          <TagInput label="Allergies" value={form.allergies} onChange={set("allergies")} T={T} placeholder="e.g. Penicillin, Latex" />
          <TextField label="Emergency contact name" value={form.emergencyContactName} onChange={set("emergencyContactName")} T={T} placeholder="e.g. Mum" />
          <TextField label="Emergency contact phone" value={form.emergencyContactPhone} onChange={set("emergencyContactPhone")} T={T} placeholder="e.g. +44 7700 900123" />
          <TextAreaField label="Other emergency notes" value={form.emergencyNotes} onChange={set("emergencyNotes")} T={T} placeholder="e.g. blood type, relevant conditions" />
        </SectionCard>
      </div>
    </div>
  );
}

// ── Read-only summary of the current profile. CHANGED 18 Aug 2026 —
// used to show only a "3 of 27 fields filled" count with nothing else;
// The user's ask: show the actual filled data once it exists, not just a
// number. Only renders fields that actually have a value — empty ones
// are simply omitted rather than shown blank, keeping this readable
// once a profile has real content. Kink/Chems selections resolve
// through their registries the same way Contacts' own read-only view
// does, including the optional role on statedKinks. ──
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

function ProfileDataView({ profile, T }) {
  const kinkNames = profile.statedKinks.map((sel) => {
    const name = KinkRegistry.getById(sel.kinkId)?.name;
    return name ? (sel.role ? `${name} (${sel.role})` : name) : null;
  }).filter(Boolean);
  const limitNames = profile.limits.map((sel) => {
    const name = KinkRegistry.getById(sel.kinkId)?.name;
    return name ? (sel.role ? `${name} (${sel.role})` : name) : null;
  }).filter(Boolean);
  const chemNames = profile.knownChems.map((id) => ChemsRegistry.getById(id)?.name).filter(Boolean);

  // CHANGED 18 Aug 2026 — real bug caught while verifying: ageIsApprox
  // is a boolean, and `false !== "" && false !== null && false !==
  // undefined` is TRUE — so its default value was silently counting as
  // "filled" every time, meaning anyFilled was always true and the
  // empty-state message could never actually show. Excluded explicitly,
  // same as updatedAt.
  const anyFilled = Object.keys(DEFAULT_PROFILE).some((k) => {
    if (k === "updatedAt" || k === "ageIsApprox") return false;
    const v = profile[k];
    return Array.isArray(v) ? v.length > 0 : v !== "" && v !== null && v !== undefined;
  });

  if (!anyFilled) {
    return (
      <div style={{ padding: "0 16px 8px", fontSize: 12, color: T.textDisabled, fontStyle: "italic" }}>
        Nothing filled in yet — tap Edit to get started.
      </div>
    );
  }

  return (
    <div style={{ padding: "0 16px 8px" }}>
      <SectionCard title="Identity" T={T}>
        <ReadRow label="Nickname" value={profile.nickname} T={T} />
        <ReadRow label="Pronouns" value={profile.pronouns} T={T} />
        <ReadRow label="Gender" value={profile.gender} T={T} />
        <ReadRow label="Age" value={profile.age} T={T} />
        <ReadRow label="City" value={profile.city} T={T} />
      </SectionCard>
      <SectionCard title="Find me on" T={T}>
        <ReadRow label="Phone/WhatsApp" value={profile.phone} T={T} />
        <ReadRow label="Snapchat" value={profile.snapchat} T={T} />
        <ReadRow label="Fabguys" value={profile.fabguys} T={T} />
        <ReadRow label="Fabswingers" value={profile.fabswingers} T={T} />
        <ReadRow label="Recon" value={profile.recon} T={T} />
        <ReadRow label="Other platforms" value={profile.contactableVia} T={T} />
      </SectionCard>
      <SectionCard title="Hosting / Travel" T={T}>
        <ReadRow label="Hosts" value={profile.hosts} T={T} />
        <ReadRow label="Travels" value={profile.travels} T={T} />
        <ReadRow label="Travel mode" value={profile.travelMode} T={T} />
      </SectionCard>
      <SectionCard title="Availability" T={T}>
        <ReadRow label="General availability" value={profile.availability} T={T} />
        <ReadRow label="Readily available?" value={profile.readilyAvailable} T={T} />
      </SectionCard>
      <SectionCard title="Into / Limits" T={T}>
        <ReadRow label="Into" value={kinkNames} T={T} />
        <ReadRow label="Limits" value={limitNames} T={T} />
        <ReadRow label="Role" value={profile.bdsmRole} T={T} />
        <ReadRow label="Position" value={profile.sexualPosition} T={T} />
      </SectionCard>
      <SectionCard title="Chems" T={T}>
        <ReadRow label="Known chems" value={chemNames.length > 0 ? chemNames : "None known"} T={T} />
      </SectionCard>
      <SectionCard title="Physical" T={T}>
        <ReadRow label="Length (penis)" value={profile.length} T={T} />
        <ReadRow label="Girth (penis)" value={profile.thickness} T={T} />
        <ReadRow label="Foreskin" value={profile.foreskin} T={T} />
        <ReadRow label="Foreskin fit" value={profile.foreskinDetail} T={T} />
        <ReadRow label="Chastity status" value={profile.chastityStatus} T={T} />
        <ReadRow label="Cummer" value={profile.cummer} T={T} />
      </SectionCard>
      <SectionCard title="Sexual health status" T={T}>
        <ReadRow label="Known PrEP/DoxyPEP" value={profile.knownPrepDoxy} T={T} />
        {/* ADDED 18 Aug 2026 — same explicit-"not on it" treatment as the
            edit sheet, needed here too: this is the screen you'd actually
            glance at to check your own status, so the empty state needs
            to read as deliberate here just as much as while editing. */}
        {profile.knownPrepDoxy.length === 0 && (
          <div style={{ fontSize: 12, color: T.textDisabled, fontStyle: "italic", padding: "2px 0 6px" }}>
            Not currently on PrEP or DoxyPEP
          </div>
        )}
        <ReadRow label="Last tested date" value={getAutoLastTestedDate() ? new Date(getAutoLastTestedDate()).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : ""} T={T} />
      </SectionCard>
      <SectionCard title="About me" T={T}>
        <ReadRow label="Note" value={profile.aboutMeNotes} T={T} />
      </SectionCard>
      <SectionCard title="Clinical & emergency info (never shared)" T={T}>
        <ReadRow label="Allergies" value={profile.allergies} T={T} />
        <ReadRow label="Emergency contact name" value={profile.emergencyContactName} T={T} />
        <ReadRow label="Emergency contact phone" value={profile.emergencyContactPhone} T={T} />
        <ReadRow label="Other emergency notes" value={profile.emergencyNotes} T={T} />
        {profile.allergies.length === 0 && !profile.emergencyContactName && !profile.emergencyContactPhone && !profile.emergencyNotes && (
          <div style={{ fontSize: 12, color: T.textDisabled, fontStyle: "italic", padding: "2px 0 6px" }}>Nothing recorded yet — shown on your Clinic Card only, never shared.</div>
        )}
      </SectionCard>
    </div>
  );
}

// ── Share screen ── (Import moved to Contacts as of 18 Aug 2026 —
// see ImportSharedProfileSheet in SHOS_Contacts_Prototype.jsx. Importing
// a shared profile creates a Contact, so it belongs where Contacts are
// managed, not here — matches Doc 1's own placement too: My Profile
// isn't even a primary-nav screen, it's a Settings sub-item, so Contacts
// is the natural home for anything that results in a new Contact.)
// CHANGED 18 Aug 2026 — the user's ask: Export shouldn't be a prominent
// section competing with the actual profile data for attention — either
// a small button near the bottom, or folded into Settings once that
// exists. Settings didn't exist yet at the time, so: small button near
// the bottom, same spirit either way.
// CHANGED 19 Aug 2026 — real ask: "don't want to accidentally click
// it." Both actions now require a confirm tap rather than firing
// immediately — same principle as Developer Tools' reset-all-data
// two-step confirm, just lighter-weight since exporting isn't
// destructive, only sensitive. Placement left as-is (small buttons
// near the bottom) — the user deferred the placement call to be reassessed
// after a real click-through, this pass only fixes the accidental-tap
// STILL OPEN as of 26 Aug 2026 — Settings now genuinely exists and has
// grown substantially (Stats/Calendar/Trash/Design/About all real), so
// "fold into Settings" is now actually buildable if that's still
// wanted — but this remains the user's own placement call to make after
// a real click-through, not something to move unilaterally.
// risk, not where the buttons live.
function ShareProfilePanel({ T }) {
  const [status, setStatus] = useState(null);
  const [confirming, setConfirming] = useState(null); // "file" | "text" | null
  // ADDED 26 Aug 2026 — real ask: last tested date should be
  // optionally shared, off by default, not automatic.
  const [includeLastTestedDate, setIncludeLastTestedDate] = useState(false);

  const doExportFile = () => {
    exportProfileShare({ includeLastTestedDate });
    setStatus({ ok: true, msg: "Profile file downloaded." });
    setConfirming(null);
  };

  const doCopyText = async () => {
    const json = JSON.stringify(buildProfileShare({ includeLastTestedDate }), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setStatus({ ok: true, msg: "Copied — paste it into a message to share." });
    } catch {
      setStatus({ ok: false, msg: "Couldn't copy automatically — select and copy the text manually." });
    }
    setConfirming(null);
  };

  if (confirming) {
    return (
      <div style={{ padding: "8px 16px 100px" }}>
        <div style={{ border: `1px solid ${T.border}`, borderRadius: radius.md, padding: 14, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: T.textPrimary, marginBottom: 10 }}>
            {confirming === "file" ? "Download your profile as a file?" : "Copy your profile as text?"}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <div onClick={() => setConfirming(null)} style={{ padding: "7px 16px", borderRadius: radius.full, border: `1px solid ${T.border}`, color: T.textSecondary, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</div>
            <div onClick={confirming === "file" ? doExportFile : doCopyText} style={{ padding: "7px 16px", borderRadius: radius.full, background: T.textPrimary, color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {confirming === "file" ? "Download" : "Copy"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "8px 16px 100px" }}>
      {/* ADDED 26 Aug 2026 — real ask: opt-in toggle, off by default. */}
      <div onClick={() => setIncludeLastTestedDate((v) => !v)}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, cursor: "pointer", marginBottom: 10 }}>
        <div style={{ width: 20, height: 20, borderRadius: radius.sm, border: `2px solid ${includeLastTestedDate ? T.contactsTeal : T.border}`, background: includeLastTestedDate ? T.contactsTeal : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {includeLastTestedDate && <Check size={12} color="#FFFFFF" />}
        </div>
        <div>
          <div style={{ fontSize: 13, color: T.textPrimary, fontWeight: 600 }}>Include last tested date</div>
          <div style={{ fontSize: 11, color: T.textDisabled, marginTop: 1 }}>Just the date itself (±time) — never linked to the actual test record.</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: T.textDisabled, textAlign: "center", marginBottom: 8 }}>
        Sharing sends only what's above — never relationship notes or how-we-met info, since those don't exist on this record.
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <div onClick={() => setConfirming("file")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: radius.full, border: `1px solid ${T.border}`, color: T.textSecondary, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          <Download size={13} /> Save as file
        </div>
        <div onClick={() => setConfirming("text")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: radius.full, border: `1px solid ${T.border}`, color: T.textSecondary, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          <Copy size={13} /> Copy as text
        </div>
      </div>
      {status && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 14px", borderRadius: radius.sm, marginTop: 10, background: status.ok ? `${T.actionGreen}15` : `${T.actionRed}15`, color: status.ok ? T.actionGreen : T.actionRed, fontSize: 12 }}>
          {status.ok ? <Check size={14} /> : <X size={14} />}
          {status.msg}
        </div>
      )}
    </div>
  );
}

// ── Read-only summary of the current profile, shown above the
// share/import tools so it's obvious what's about to go out. ──
// CHANGED 18 Aug 2026 — used to show "X of Y fields filled" as the only
// content; now just the name + Edit button, since the actual data
// renders below via ProfileDataView.
function ProfileSummary({ profile, T, onEdit }) {
  return (
    <div style={{ padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.textPrimary }}>{profile.nickname || profile.displayName || "My Profile"}</div>
        <div onClick={onEdit} style={{ padding: "8px 16px", borderRadius: radius.full, border: `1px solid ${T.contactsTeal}`, color: T.contactsTeal, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Edit
        </div>
      </div>
    </div>
  );
}

// ADDED — real ask: sections elsewhere in the app (Clinic Card's
// Allergies/Emergency info) used to just describe where to go add
// this data ("under My Profile → Clinical & emergency info") rather
// than actually taking you there. openEditingOnMount lets a caller
// open straight into the edit form instead of the summary view —
// optional, every existing call site keeps its current behavior by
// simply not passing it.
export default function MyProfileModule({ onClose, registerModuleBackHandler, openEditingOnMount = false }) {
  const [profile, setProfile] = useState(() => MyProfileRepository.getProfile());
  const [editing, setEditing] = useState(openEditingOnMount);
  // CHANGED 26 Aug 2026 — real ask: Share/Export placement, deferred
  // earlier this session pending a real click-through, now decided —
  // top icon, matching the established convention (Contacts' Import,
  // Medication's Search/Settings all live as icons in the top banner,
  // not permanently-visible page content). Also resolves the
  // original 18 Aug ask for free: hidden until tapped means it
  // genuinely doesn't compete with the profile data for attention
  // anymore, not just visually de-emphasized while still always
  // present.
  const [showShare, setShowShare] = useState(false);
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : LIGHT;

  // ADDED — real ask: back should close the Share panel or exit editing
  // before closing My Profile itself, matching the pattern every other
  // module uses.
  useEffect(() => {
    if (!registerModuleBackHandler) return;
    registerModuleBackHandler(() => {
      if (showShare) { setShowShare(false); return true; }
      if (editing) { setEditing(false); return true; }
      onClose?.();
      return true;
    });
    return () => registerModuleBackHandler(null);
  }, [showShare, editing, registerModuleBackHandler, onClose]);

  const refresh = () => setProfile(MyProfileRepository.getProfile());

  const saveEdit = (form) => {
    MyProfileRepository.update(form);
    refresh();
    setEditing(false);
  };

  return (
    // CHANGED — real bug from the user's own testing: this screen had
    // neither its own scroll region nor relied on one that existed —
    // `minHeight: 100vh` lets content grow taller than the viewport,
    // but nothing here or in App.jsx's wrapping overlay ever set
    // `overflowY`, so anything past one screenful was simply
    // inaccessible. The Edit sheet right below this already gets this
    // correct (`position: fixed, inset: 0, overflowY: auto`, entirely
    // self-contained) — applying the exact same pattern here instead
    // of depending on App.jsx's wrapper to provide it.
    <div style={{ position: "fixed", inset: 0, overflowY: "auto", fontFamily: "'Inter', sans-serif", background: T.bg, display: "flex", justifyContent: "center" }}>
      {/* CHANGED 26 Aug 2026 — same fix already shipped in Medication:
          was a fixed 390px regardless of viewport; now fills the screen
          on mobile and caps at a real desktop-appropriate width on
          larger screens. Outer wrapper already centers via
          justifyContent: "center", so this is a like-for-like swap. */}
      <div style={{ width: "100%", maxWidth: 600, background: T.bg, minHeight: "100vh", borderLeft: `1px solid ${T.border}`, borderRight: `1px solid ${T.border}` }}>
        {/* CHANGED — real ask: "My Profile and back button should
            remain at top even when scrolling" — was not sticky at all
            before, unlike the Edit sheet's own header just below,
            which already had this correctly. */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "18px 16px", position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}`, zIndex: 1 }}>
          {/* ADDED 18 Aug 2026 — My Profile no longer has its own bottom-nav
              tab (see Doc 1 — it's a Settings sub-item, reached from
              Contacts for now until Settings exists). Shown as a
              full-screen overlay with a real way back when opened that
              way. */}
          {onClose && <ChevronLeft size={20} color={T.textSecondary} style={{ cursor: "pointer" }} onClick={onClose} />}
          <User size={18} color={T.contactsTeal} />
          <span style={{ fontSize: 12, fontWeight: 700, color: T.contactsTeal, textTransform: "uppercase", letterSpacing: 0.5, flex: 1 }}>My Profile</span>
          <Share size={18} color={T.contactsTeal} style={{ cursor: "pointer" }} onClick={() => setShowShare((s) => !s)} title="Share profile" />
        </div>

        <ProfileSummary profile={profile} T={T} onEdit={() => setEditing(true)} />
        <ProfileDataView profile={profile} T={T} />
        {showShare && <ShareProfilePanel T={T} />}

        {editing && (
          <MyProfileEditScreen profile={profile} onSave={saveEdit} onCancel={() => setEditing(false)} T={T} />
        )}
      </div>
    </div>
  );
}

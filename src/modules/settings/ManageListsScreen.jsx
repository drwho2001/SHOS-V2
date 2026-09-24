// ManageListsScreen — extracted verbatim from src/modules/SHOS_Settings_Prototype.jsx
// (24 Sep 2026 settings split). Behavior unchanged; only the file moved.
import React, { useState } from "react";
import { NEUTRAL_DARK as DARK } from "../../calculations/designTokens";
import { CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight, ListChecksIcon as ClipboardCheck, FireIcon as Flame, MicroscopeIcon as Microscope, PillIcon as Pill, ShieldIcon as Shield, StethoscopeIcon as Stethoscope, MapPinIcon as MapPin } from "@phosphor-icons/react";
import { ACCENTS, NEUTRAL, RADIUS, TYPE } from "../../calculations/designTokens";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useLoadedMemo } from "../../calculations/loadedRepositoryState";
import { computeKinkUsage, computeChemsUsage, computeProtectionUsage, computeSymptomsUsage, computeOrganismUsage, computeResultsUsage, computeLocationsUsage } from "../../calculations/registryUsage";
import { LOCATION_TYPE_OPTIONS } from "../../repositories/locationsRepository";
import { ContactRepository } from "../../repositories/contactRepository";
import { LocationsRepository } from "../../repositories/locationsRepository";
import { KinkRegistry } from "../../registries/kinkRegistry";
import { ChemsRegistry } from "../../registries/chemsRegistry";
import { ProtectionRegistry } from "../../registries/protectionRegistry";
import { SymptomsRegistry } from "../../registries/symptomsRegistry";
import { OrganismRegistry } from "../../registries/organismRegistry";
import { ResultsRegistry } from "../../registries/resultsRegistry";
import RegistryManagementScreen from "../SHOS_RegistryManagement_Prototype";
import { OptionListDetail, ICON_COMPONENTS as OPTION_LIST_ICON_COMPONENTS } from "../SHOS_OptionListEditor_Prototype";
import { CustomOptionListsRepository, OPTION_LIST_LABELS, OPTION_LIST_ICONS } from "../../repositories/customOptionListsRepository";
import { ResourcesRepository } from "../../repositories/resourcesRepository";

function LocationExtraFields({ entry, refresh, T, color }) {
  const [address, setAddress] = useState(entry.address || "");
  const [notes, setNotes] = useState(entry.notes || "");
  const contacts = useLoadedMemo(() => ContactRepository.getAll().then((all) => all.filter((c) => !c.isArchived)), [], []);
  const setType = async (type) => { await LocationsRepository.update(entry.id, { type: entry.type === type ? "" : type }); refresh(); };
  const commitAddress = async () => { await LocationsRepository.update(entry.id, { address: address.trim() }); refresh(); };
  const commitNotes = async () => { await LocationsRepository.update(entry.id, { notes: notes.trim() }); refresh(); };
  const setRelatedContact = async (id) => { await LocationsRepository.update(entry.id, { relatedContactId: id }); refresh(); };
  const inputStyle = { width: "100%", padding: "6px 8px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontSize: 13, fontFamily: "'Inter', sans-serif", boxSizing: "border-box", marginBottom: 8 };
  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 4 }}>Type</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
        {LOCATION_TYPE_OPTIONS.map((t) => (
          <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} key={t} onClick={() => setType(t)}
            style={{ padding: "4px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${color}`, color: entry.type === t ? "#FFFFFF" : color, background: entry.type === t ? color : "transparent" }}>
            {t}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 4 }}>Address</div>
      <input value={address} onChange={(e) => setAddress(e.target.value)} onBlur={commitAddress} placeholder="Optional" style={inputStyle} />
      <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 4 }}>Related contact</div>
      <select value={entry.relatedContactId || ""} onChange={(e) => setRelatedContact(e.target.value)} style={inputStyle}>
        <option value="">None</option>
        {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 4 }}>Notes</div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={commitNotes} rows={2} placeholder="Optional" aria-label="Location notes" style={{ ...inputStyle, marginBottom: 0, resize: "vertical" }} />
    </div>
  );
}

const REGISTRIES = [
  { key: "kink", label: "Kink Registry", registry: KinkRegistry, color: "#E5484D", icon: Flame, computeUsage: computeKinkUsage },
  { key: "protection", label: "Protection Registry", registry: ProtectionRegistry, color: "#E24E9C", icon: Shield, computeUsage: computeProtectionUsage },
  { key: "chems", label: "Chems Registry", registry: ChemsRegistry, color: "#5B5B62", icon: Pill, computeUsage: computeChemsUsage },
  { key: "symptoms", label: "Symptoms Registry", registry: SymptomsRegistry, color: ACCENTS.healthcare, icon: Stethoscope, computeUsage: computeSymptomsUsage },
  { key: "organism", label: "Organism Registry", registry: OrganismRegistry, color: ACCENTS.healthcare, icon: Microscope, computeUsage: computeOrganismUsage },
  { key: "results", label: "Results Registry", registry: ResultsRegistry, color: ACCENTS.healthcare, icon: ClipboardCheck, computeUsage: computeResultsUsage },
  { key: "locations", label: "Locations", registry: LocationsRepository, color: "#E24E9C", icon: MapPin, computeUsage: computeLocationsUsage, renderExtra: LocationExtraFields },
];

// CHANGED 1 Sep 2026 — real ask: "check settings not unnecessarily over
// engineered - combine into similar things if better." Registries and
// Option lists were two separate top-level Settings rows that do the
// exact same conceptual job to anyone using the app — "edit the picker
// choices used across the app" — differing only in an internal
// implementation detail (ID-based registry with a usage count vs a
// flat editable string list) nobody outside this codebase needs to
// see. Combined into one screen with a tab switcher; each tab's own
// row-list body is unchanged, RegistryManagementScreen/OptionListDetail
// still do all the real add/rename/archive work exactly as before —
// this only touches how the two lists are ENTERED, not how they work.
export function ManageListsScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : NEUTRAL;
  const [tab, setTab] = useState("registries");
  const [openRegistry, setOpenRegistry] = useState(null);
  const [openOptionList, setOpenOptionList] = useState(null);
  const optionListNames = CustomOptionListsRepository.getAllListNames();
  // CHANGED — Phase 2 encryption groundwork: CustomOptionListsRepository
  // went async — `.get(name).length` used to be a synchronous per-row
  // render call inside the JSX .map() below, which can't itself await;
  // resolved into a lookup object ahead of time instead.
  const listCounts = useLoadedMemo(async () => {
    const entries = await Promise.all(optionListNames.map(async (name) => [name, (await CustomOptionListsRepository.get(name)).length]));
    return Object.fromEntries(entries);
  }, [], {});

  return (
    <div tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: darkMode ? DARK.bg : NEUTRAL.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : NEUTRAL.bg, borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label="Back" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Manage lists</h1>
      </div>
      <div style={{ display: "flex", gap: 8, padding: "12px 16px 0" }}>
        {[["registries", "Registries"], ["options", "Option lists"]].map(([key, label]) => (
          <div key={key} onClick={() => setTab(key)}
            style={{ flex: 1, textAlign: "center", padding: "8px 0", borderRadius: 999, cursor: "pointer", fontSize: 13, fontWeight: 700, background: tab === key ? ACCENTS.healthcare : (darkMode ? DARK.surfaceVariant : "#E8E8EC"), color: tab === key ? "#FFFFFF" : (darkMode ? DARK.textSecondary : NEUTRAL.textSecondary) }}>
            {label}
          </div>
        ))}
      </div>
      {tab === "registries" ? (
        <>
          <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, padding: "10px 16px 0" }}>
            Shared vocabularies used across Contacts, Encounters, Testing, and Clinic Visits — rename or archive an entry directly, rather than only through whichever picker happens to reference it.
          </div>
          <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, margin: "16px 16px 20px", overflow: "hidden" }}>
            {REGISTRIES.map((r) => (
              <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} key={r.key} onClick={() => setOpenRegistry(r)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 999, background: `${r.color}1A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <r.icon size={14} color={r.color} />
                  </div>
                  <span style={{ fontSize: 14, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontWeight: 500 }}>{r.label}</span>
                </div>
                <ChevronRight size={16} color={darkMode ? DARK.textDisabled : NEUTRAL.textDisabled} />
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, padding: "10px 16px 0" }}>
            Add, rename, or reorder the simple option lists used across the app — no code, no waiting on a rebuild. Changes here are permanent on this device and survive future app updates.
          </div>
          <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, margin: "16px 16px 20px", overflow: "hidden" }}>
            {optionListNames.map((name) => {
              const iconConfig = OPTION_LIST_ICONS[name];
              const IconComponent = iconConfig ? OPTION_LIST_ICON_COMPONENTS[iconConfig.icon] : null;
              return (
                <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} key={name} onClick={() => setOpenOptionList(name)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {IconComponent && (
                      <div style={{ width: 28, height: 28, borderRadius: 999, background: `${iconConfig.color}1A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <IconComponent size={14} color={iconConfig.color} />
                      </div>
                    )}
                    <span style={{ fontSize: 14, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontWeight: 500 }}>{OPTION_LIST_LABELS[name] || name}</span>
                  </div>
                  <span style={{ fontSize: 12, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled }}>{listCounts[name] ?? 0} options ›</span>
                </div>
              );
            })}
          </div>
        </>
      )}
      {openRegistry && (
        <RegistryManagementScreen registry={openRegistry.registry} label={openRegistry.label} color={openRegistry.color} computeUsage={openRegistry.computeUsage} renderExtra={openRegistry.renderExtra} onClose={() => setOpenRegistry(null)} />
      )}
      {openOptionList && <OptionListDetail listName={openOptionList} onClose={() => setOpenOptionList(null)} />}
    </div>
  );
}
// ADDED 1 Sep 2026 — real ask: "want resources section in settings
// maybe - domestic violence, contraceptive advice, hrt and trans
// support, charities, clinical justifications used, finding a local
// clinic or ordering... sexual health test postal." See
// resourcesRepository.js's own header for why every entry seeds with a
// real org name but a deliberately blank link/notes field — this
// screen is where the user fills those in themselves.
// ADDED — real ask: resource links (and phone numbers, same field —
// see the input's own "Link or phone number" placeholder below) used
// to render as plain text, not clickable. Builds a real tappable href
// for whichever shape the saved value actually is, rather than
// assuming it's always a URL.

export default ManageListsScreen;

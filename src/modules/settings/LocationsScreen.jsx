// LocationsScreen — read-only directory of saved addresses. Fixes the owner's
// "have to go to repositories > locations" complaint: a discoverable Settings
// entry listing every named location with its tags/names and address, with
// Copy address + Open in Maps actions. Editing stays in Manage Lists.
// A Workspace over LocationsRepository — owns no data.
import React, { useState, useRef, useEffect } from "react";
import { FONT_FAMILY, NEUTRAL_DARK as DARK } from "../../calculations/designTokens";
import { CaretLeftIcon as ChevronLeft, MapPinIcon as MapPin, CopyIcon as Copy, ArrowSquareOutIcon as OpenExternal, WarningIcon as AlertTriangle } from "@phosphor-icons/react";
import { ACCENTS, NEUTRAL, RADIUS, TYPE } from "../../calculations/designTokens";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useTranslation } from "../../i18n/index.js";
import { useEscapeToClose } from "../../components/useEscapeToClose";
import { useLoadedMemo } from "../../calculations/loadedRepositoryState";
import { LocationsRepository } from "../../repositories/locationsRepository";
import { ContactRepository } from "../../repositories/contactRepository";
import { EncounterRepository } from "../../repositories/encounterRepository";
import { ClinicVisitsRepository } from "../../repositories/clinicVisitsRepository";
import { formatAddress, hasAddress, buildMapsSearchUrl, groupLocationsByType, needsAddressNudge } from "../../calculations/locationDirectory";

function LocationCard({ location, contactName, usedByCount, T, darkMode, onCopied, onError }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const nudge = needsAddressNudge(location, { usedByCount });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatAddress(location));
      setCopied(true);
      onCopied?.();
    } catch {
      onError?.(t("locations.copyFailed", "Couldn't copy — select the address manually."));
    }
  };
  const mapsUrl = hasAddress(location) ? buildMapsSearchUrl(location) : null;
  const chipBg = darkMode ? DARK.surfaceVariant : NEUTRAL.surfaceVariant;
  return (
    <div style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>{location.name}</span>
        {location.type && <span style={{ fontSize: 10, fontWeight: 700, color: T.textSecondary, background: chipBg, borderRadius: 999, padding: "2px 8px" }}>{location.type}</span>}
      </div>
      {hasAddress(location) ? (
        <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>{formatAddress(location)}</div>
      ) : (
        <div style={{ fontSize: 12, color: nudge ? T.actionRed : T.textDisabled, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
          {nudge && <AlertTriangle size={12} />}{t("locations.noAddress", "No address saved")}
        </div>
      )}
      {contactName && <div style={{ fontSize: 11, color: T.textDisabled, marginTop: 2 }}>{t("locations.linkedContact", "Linked to")}: {contactName}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={copy} disabled={!hasAddress(location)} aria-label={t("locations.copyAddress", "Copy address")}
          style={{ padding: "7px 12px", borderRadius: 999, border: `1px solid ${T.border}`, background: "transparent", color: hasAddress(location) ? T.textPrimary : T.textDisabled, fontSize: 12, fontWeight: 600, cursor: hasAddress(location) ? "pointer" : "default" }}>
          <Copy size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />{copied ? t("locations.copied", "Copied") : t("locations.copyAddress", "Copy address")}
        </button>
        {mapsUrl && (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" aria-label={t("locations.openMaps", "Open in Maps")}
            style={{ padding: "7px 12px", borderRadius: 999, border: `1px solid ${ACCENTS.healthcare}`, color: darkMode ? ACCENTS.healthcare : ACCENTS.healthcare, background: "transparent", fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "none" }}>
            <OpenExternal size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />{t("locations.openMaps", "Open in Maps")}
          </a>
        )}
      </div>
    </div>
  );
}

export function LocationsScreen({ onClose }) {
  const { t } = useTranslation();
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : NEUTRAL;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const dialogRef = useRef(null);
  useEffect(() => { dialogRef.current?.focus(); }, []);
  // AX2 (25 Nov): Escape closes this settings dialog.
  useEscapeToClose(onClose);

  const locations = useLoadedMemo(() => LocationsRepository.getAll(), [], []);
  const contacts = useLoadedMemo(() => ContactRepository.getAll(), [], []);
  const encounters = useLoadedMemo(() => EncounterRepository.getAll(), [], []);
  const visits = useLoadedMemo(() => ClinicVisitsRepository.getAll(), [], []);

  const usedCount = (id) => encounters.filter((e) => e.locationId === id).length + visits.filter((v) => v.locationId === id).length;
  const contactName = (id) => (contacts.find((c) => c.id === id)?.nickname || contacts.find((c) => c.id === id)?.name || "");
  const groups = groupLocationsByType(locations);
  const q = query.trim().toLowerCase();
  const filtered = groups.map((g) => ({
    ...g,
    locations: q ? g.locations.filter((l) => [l.name, l.type, l.address, l.postcode].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))) : g.locations,
  })).filter((g) => g.locations.length > 0);

  return (
    <div ref={dialogRef} role="dialog" aria-label={t("locations.title", "Locations")} tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: T.bg, zIndex: 220, overflowY: "auto", fontFamily: FONT_FAMILY }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <div aria-hidden="true" data-notch-band="1" style={{ position: "absolute", left: 0, right: 0, bottom: "100%", height: "env(safe-area-inset-top)", background: T.bg, pointerEvents: "none" }} />
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label={t("common.back", "Back")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClose(); } }} />
        <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: T.textPrimary }}>{t("locations.title", "Locations")}</h1>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 12, lineHeight: 1.45 }}>
          {t("locations.intro", "Saved places with their addresses. Copy an address or open it in Maps for directions. Edit them in Manage lists.")}
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("locations.search", "Search locations")} aria-label={t("locations.search", "Search locations")}
          style={{ width: "100%", padding: "10px 12px", borderRadius: RADIUS.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: FONT_FAMILY, fontSize: TYPE.control.fontSize, boxSizing: "border-box", marginBottom: 12 }} />
        <div aria-live="polite" role="status" style={{ fontSize: 12, color: T.textSecondary, minHeight: 18, marginBottom: 8 }}>{status}</div>
        {filtered.length === 0 && <div style={{ fontSize: 12, color: T.textDisabled }}>{t("locations.empty", "No locations saved yet.")}</div>}
        {filtered.map((g) => (
          <div key={g.type} style={{ marginBottom: 18 }}>
            <div style={{ ...TYPE.sectionLabel, color: T.textDisabled, padding: "0 0 6px" }}>{g.label}</div>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, overflow: "hidden" }}>
              {g.locations.map((loc) => (
                <LocationCard key={loc.id} location={loc} contactName={contactName(loc.relatedContactId)} usedByCount={usedCount(loc.id)} T={T} darkMode={darkMode}
                  onCopied={() => { setStatus(t("locations.copiedStatus", "Address copied.")); setTimeout(() => setStatus(""), 2500); }}
                  onError={(msg) => { setStatus(msg); setTimeout(() => setStatus(""), 2500); }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LocationsScreen;

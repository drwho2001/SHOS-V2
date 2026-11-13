import React, { useState, useMemo, useRef, useEffect } from "react";
import ConfirmDeleteCard from "../components/ConfirmDeleteCard";
import EmptyState from "../components/EmptyState";
import UndoToast from "../components/UndoToast";
import { FormTabs } from "../components/FormTabs";
import { HivStatusNote } from "../components/HivStatusNote";
// ADDED 9 Oct 2026 (t052) — role-vs-position note, same shared copy as
// Encounters and My Profile.
import { JargonNote } from "../components/JargonNote";
import {
  PlusIcon as Plus, MagnifyingGlassIcon as Search, CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight, DotsThreeVerticalIcon as MoreVertical, XIcon as X, ArchiveIcon as Archive, GearSixIcon as Settings2, GearIcon as SettingsIcon,
  ChatCircleIcon as MessageCircle, CarIcon as Car, WarningIcon as AlertTriangle, TrashIcon as Trash2, LinkIcon as Link2, ShieldIcon as Shield,
  UploadSimpleIcon as Upload, DownloadSimpleIcon as Download, CheckIcon as Check, UserIcon as User, HouseIcon as Home, MapPinIcon as MapPin, EyeSlashIcon as EyeOff, EyeIcon as Eye, ArrowsClockwiseIcon as RefreshCcw, StarIcon as Star,
  CrosshairIcon as Crosshair, SignOutIcon as SignOut, EnvelopeSimpleIcon as Envelope, TreeEvergreenIcon as TreeEvergreen,
  // ADDED 10 Sep 2026 — real ask: a single "how we'd meet" icon ranked
  // Car (Drives) > Cycle > Public transport > Walk, plus a distinct
  // icon for "will travel to you" now that MapPin is used for the
  // city pin below — see getTransportIcon()'s own comment.
  BicycleIcon as Bicycle, BusIcon as Bus, PersonSimpleWalkIcon as Walk, NavigationArrowIcon as NavigationArrow,
  TwitterLogoIcon as TwitterLogo, XLogoIcon as XLogo,
  ClockCounterClockwiseIcon as ClockCounterClockwise, ClockIcon as Clock,
} from "@phosphor-icons/react";

const CONTACT_ICON_BASE = "/contact-platform-icons/";
// Android/PWA launcher assets are bundled locally. Generic/unknown method
// names still use the neutral chat fallback rather than a guessed brand mark.
const GmailLogo = ({ size = 20 }) => (
  <svg viewBox="0 0 24 24" fill="#EA4335" width={size} height={size} role="img" aria-label="Gmail">
    <title>Gmail</title>
    <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
  </svg>
);

const PLATFORM_ICONS = [
  { test: /^(messenger|fb ?messenger|facebook ?messenger)$/i, file: "messenger-android-icon.png", edge: true },
  { test: /^telegram$/i, file: "telegram-android-icon.png", edge: true },
  { test: /^(instagram|insta|ig)$/i, file: "instagram-android-icon.png" },
  { test: /^(whatsapp|wa|phone\/whatsapp)$/i, file: "whatsapp-android-icon.png" },
  { test: /^snap(chat)?$/i, file: "snapchat-android-icon.png" },
  { test: /^email$/i, icon: GmailLogo },
  { test: /^fab ?guys$/i, file: "fabguys-android-icon.png", edge: true },
  { test: /^fab ?swingers$/i, file: "fabswingers-android-icon.png", edge: true },
  { test: /^recon$/i, file: "recon-pwa-icon.png" },
  { test: /^scruff$/i, file: "scruff-android-icon.png" },
  { test: /^sniffies$/i, file: "sniffies-pwa-icon.png" },
  { test: /^tinder$/i, file: "tinder-android-icon.png" },
  { test: /^(the )?blowers$/i, file: "blowers-pwa-icon.png" },
  { test: /^bluesky$/i, file: "bluesky-android-icon.png" },
  { test: /^grindr$/i, file: "grindr-android-icon.png" },
  { test: /^bumble$/i, file: "bumble-android-icon.png" },
  { test: /^hinge$/i, file: "hinge-android-icon.png" },
  { test: /^feeld$/i, file: "feeld-android-icon.png" },
  { test: /^growlr$/i, file: "growlr-android-icon.png" },
  { test: /^jack['’]?d$/i, file: "jackd-android-icon.png" },
  { test: /^hornet$/i, file: "hornet-android-icon.png" },
  { test: /^signal$/i, file: "signal-android-icon.png" },
  { test: /^discord$/i, file: "discord-android-icon.png" },
  { test: /^tik ?tok$/i, file: "tiktok-android-icon.png" },
];
const SUPPORTED_TIME_ZONES = (() => {
  try { return [...new Set(["UTC", ...Intl.supportedValuesOf("timeZone")])]; }
  catch { return ["UTC"]; }
})();
function platformIconFor(tag) {
  const match = PLATFORM_ICONS.find((p) => p.test.test(tag.trim()));
  return match || null;
}
import { getCurrentLocationPlace, forwardGeocode } from "../storage/locationService";
import { useEditUndo } from "../calculations/editUndoHelpers";
import { nowAsDateString, formatStoredDate, daysSinceStoredDay } from "../calculations/dateInputHelpers";
import { fuzzyIncludes, findClosestMatch } from "../calculations/fuzzyMatch";
import { duplicateCandidatePanel } from "../calculations/contactMerge";
import {
  ContactRepository, DEFAULT_CONTACT,
  HOSTS_OPTIONS, TRAVELS_OPTIONS, TRAVEL_MODE_OPTIONS,
  MEET_AGAIN_OPTIONS, RATING_OPTIONS,
  LENGTH_OPTIONS, GIRTH_OPTIONS, FORESKIN_OPTIONS, FORESKIN_DETAIL_OPTIONS, CHASTITY_OPTIONS,
  CUMMER_FREQUENCY_OPTIONS, CUMMER_VOLUME_OPTIONS, CUMMER_STYLE_OPTIONS,
  PREP_DOXY_OPTIONS, DAYS_OF_WEEK,
  CONTACT_BDSM_ROLE_OPTIONS, CONTACT_SEXUAL_POSITION_OPTIONS, UNKNOWN_CONTACT_OPTION,
} from "../repositories/contactRepository";
import { useAnonymiseMode, ANONYMISED } from "../calculations/anonymiseDisplay";
import { isValidHivStatus, describeHivStatus, HIV_STATUS_OPTIONS } from "../calculations/hivStatusCalculations";
import { TrashRepository } from "../repositories/trashRepository";
import { exportRecordAsFile } from "../storage/recordExportService";
// ADDED 26 Aug 2026 — real ask: Relationship type should be user-
// editable, not a fixed list — moved from a hardcoded array in
// contactRepository.js into the real in-app editable option list
// system already used elsewhere (Vaccine, Reason for visit, etc.).
import { CustomOptionListsRepository } from "../repositories/customOptionListsRepository";
import { getKnownCities, getKnownValues, getCompletenessScore, isContactIncomplete, getMissingRequiredContactFields, getContactableVia, normalizeTag, extractKinkRoleFromText, hasPhysicalDetail, mergeCummerRow, travelsByCar, displayableAge, dedupeContactMethods, extractUkPostcode, toggleMultiSelectValue } from "../calculations/contactCalculations";
import { formatAvailabilitySummary, getContactTimeZone, getDeviceTimeZone, hasWeeklyAvailability, isContactAvailableAt, isContactAvailableSoon, isValidAvailabilityWindow, isValidTimeZone, localDateTimeInputValue } from "../calculations/contactAvailability";
import { useEscapeToClose } from "../components/useEscapeToClose";
import { useOverlayBackHandler } from "../components/useOverlayBackHandler";
// ADDED 19 Aug 2026 — Anonymise mode. See privacySettingsRepository.js
// for the full reasoning. Read-only from Contacts' side, same
// one-directional pattern as every other cross-module read in this app.
import { PrivacySettingsRepository, DEFAULT_PRIVACY_SETTINGS } from "../repositories/privacySettingsRepository";
// ADDED — real ask: link/unlink this contact as who My Profile's own
// relationshipStatus is with, settable from either screen (see
// myProfileRepository.js's own comment — single array lives there,
// this just toggles membership in it, never a second copy here).
import { MyProfileRepository } from "../repositories/myProfileRepository";
// ADDED 19 Aug 2026 — real ask: configurable inactive-contact threshold.
import { AppPreferencesRepository, DEFAULT_APP_PREFERENCES } from "../repositories/appPreferencesRepository";
// New 18 Aug 2026: Encounters module now exists, so the Timeline
// section below can read real data instead of showing the "not built
// yet" stub. Read-only from Contacts' side — Contacts never writes to
// EncounterRepository, matching the one-directional storage documented
// in encounterRepository.js (Encounter holds attendeeIds, Contact-side
// numbers are calculated, never duplicated back onto the Contact record).
import { EncounterRepository } from "../repositories/encounterRepository";
import { contactEncounterSummary, contactEncounterSummaries, EMPTY_ENCOUNTER_SUMMARY, sortByDateDesc, formatRelativeDate } from "../calculations/encounterCalculations";
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
import { FONT_FAMILY, NEUTRAL, NEUTRAL_DARK, ACCENTS, ACTION, ACCENT_TEXT_SAFE, ACTION_TEXT_SAFE, RADIUS, TYPE, resolveDarkAccent, deriveDarkAccent, STICKY_SUBHEADING_TOP } from "../calculations/designTokens";
import { useDarkModePreference } from "../calculations/darkModePreference";
import { useReducedMotion } from "../calculations/useReducedMotion";
import { useTranslation } from "../i18n/index.js";
import { useLoadedState, useLoadedMemo } from "../calculations/loadedRepositoryState";
import { useIsDesktopWidth } from "../calculations/responsive";

// CHANGED 15 Sep 2026 — real bug found: these were plain module-level
// `const`s, baking in ACCENTS.contacts/ACTION.red/ACTION.green at
// IMPORT time — before App.jsx's own bootReady gate ever resolves the
// real ModuleColorRepository overrides (the colour-blind-safe palette
// toggle included). Same bug already found and fixed for Measurements/
// MenstrualHealth (and now several other module files) — converted to
// functions, called fresh per-render, same fix.
function buildLight() {
  return {
    ...NEUTRAL,
    contactsTeal: ACCENTS.contacts, actionRed: ACTION.red, actionGreen: ACTION.green, actionAmberText: ACTION.amberText, actionAmberSurface: ACTION.amberSurface,
    // ADDED 10 Sep 2026 — real accessibility fix: darker stand-ins used
    // ONLY where the accent is literal text colour sitting on its own
    // light self-tint background (e.g. active filter chips, status
    // badges) — see designTokens.js's own comment on ACCENT_TEXT_SAFE/
    // ACTION_TEXT_SAFE for why this isn't just contactsTeal/actionRed/
    // actionGreen redefined outright.
    contactsTealText: ACCENT_TEXT_SAFE.contacts, actionRedText: ACTION_TEXT_SAFE.red, actionGreenText: ACTION_TEXT_SAFE.green,
    // ADDED 5 Nov 2026 — real report: "contacts module colour seems to have
    // changed - especially the title. its gone paler ... i prefer the + FAB,
    // and the navbar module colour". The FAB and the nav icon use the raw
    // accent; the title bar and the two sheet headers use contactsTeal, which
    // dark mode resolves to a brightened amber. On a *filled* surface with
    // white text that brightening is wrong: it is a fix for thin strokes on a
    // dark background, and it drops the white title to roughly 2.5:1. Big
    // filled surfaces with white text therefore take the raw accent in both
    // themes, same value as the FAB and the nav icon.
    contactsBanner: ACCENTS.contacts,
    navActive: ACCENTS.contacts, fabBg: ACCENTS.contacts, fabIcon: "#FFFFFF",
  };
}
// Dark mode, built on Medication's own DARK object (the reference
// implementation) — neutral chrome inverts via NEUTRAL_DARK,
// actionRed/actionGreen reuse Medication's exact brightened values
// (its own comment: richer, still readable against a dark surface).
// contactsTeal is already vivid enough to read fine unchanged.
function buildDark() {
  return {
    ...NEUTRAL_DARK,
    // CHANGED — real architecture fix: a customised colour used to
    // reach dark mode unbrightened (harmless while contactsTeal's own
    // default was already light enough, but silently broken for anyone
    // customising it TO something dark) and actionRed/actionGreen were
    // fixed literals ignoring ACTION.red/green entirely. resolveDarkAccent()
    // keeps today's exact behaviour by default, only brightening once a
    // real override exists — see designTokens.js's own comment.
    contactsTeal: resolveDarkAccent("contacts", ACCENTS.contacts, deriveDarkAccent(ACCENTS.contacts)), actionRed: resolveDarkAccent("actionRed", ACTION.red, "#FF7A7E"), actionGreen: resolveDarkAccent("actionGreen", ACTION.green, "#5FD9A4"), actionAmberText: resolveDarkAccent("actionAmberText", ACTION.amberText, "#D08A2E"), actionAmberSurface: "#2A2520",
    // Dark mode's own resolved accents already read fine against a
    // near-black background (real headroom, not just barely-passing) —
    // no separate darker text variant needed there, so these just reuse
    // the same values as above.
    contactsTealText: resolveDarkAccent("contacts", ACCENTS.contacts, deriveDarkAccent(ACCENTS.contacts)), actionRedText: resolveDarkAccent("actionRed", ACTION.red, "#FF7A7E"), actionGreenText: resolveDarkAccent("actionGreen", ACTION.green, "#5FD9A4"),
    // Filled surfaces with white text keep the raw accent in dark mode too -
    // see buildLight's comment. Matches the FAB and the nav icon exactly.
    contactsBanner: ACCENTS.contacts,
    navActive: ACCENTS.contacts, fabBg: ACCENTS.contacts, fabIcon: "#FFFFFF",
  };
}
const radius = RADIUS;
const CONTACT_EDIT_TABS = [
  { key: "about", label: "About" },
  { key: "meeting", label: "Meeting & profile" },
  { key: "interests", label: "Interests & contact" },
];

function loadContacts() {
  return ContactRepository.getAll();
}

function btnStyle(color, variant) {
  return { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 10px", borderRadius: radius.full, fontFamily: FONT_FAMILY, fontSize: TYPE.control.fontSize, fontWeight: 600, cursor: "pointer", minHeight: 44, border: variant === "outline" ? `1px solid ${color}` : "none", background: variant === "filled" ? color : "transparent", color: variant === "filled" ? "#FFFFFF" : color };
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
//
// CHANGED 28 Sep 2026 — the placeholder is now the shared one from
// `anonymiseDisplay`, so this file and Encounters can no longer drift
// apart, and `displayName` itself takes the flag rather than each
// call site remembering to check. The 28 Sep security review found
// three call sites in this file that used `displayName` without ever
// consulting Anonymise mode — the link-a-contact picker, the profile
// picker, and the duplicate panel.
const MASKED = ANONYMISED;

function displayName(contact, anonymise = false) {
  if (anonymise) return MASKED;
  return contact.nickname || contact.name || "Anonymous contact";
}

const REQUIRED_DETAIL_COPY = {
  identity: ["contacts.requiredIdentity", "Name or nickname"],
  age: ["contacts.requiredAge", "Age"],
  city: ["contacts.requiredCity", "City"],
  role: ["contacts.requiredRole", "Role"],
  position: ["contacts.requiredPosition", "Position"],
};
function requiredLabelsForKeys(keys, tr) {
  return keys.map((key) => {
    const [translationKey, fallback] = REQUIRED_DETAIL_COPY[key] || ["contacts.requiredDetails", "Required detail"];
    return tr(translationKey, fallback);
  });
}
function missingRequiredLabelsFor(contact, tr) {
  return requiredLabelsForKeys(getMissingRequiredContactFields(contact), tr);
}


// Platform icons are the reviewed Android/PWA assets bundled under public/;
// only services without a reviewed asset use the neutral generic fallback.
function MethodBadge({ method, T, size }) {
  // CHANGED 15 Sep 2026 — real bug found alongside the LIGHT/DARK
  // module-scope fix above: `T === DARK` relied on DARK being a fixed
  // object reference — broke the moment DARK became a function called
  // fresh per-render (a new object every time, never `===` anything).
  // T.bg is one of the few fields NEUTRAL/NEUTRAL_DARK contribute
  // unmodified in both buildLight()/buildDark(), so comparing against
  // NEUTRAL_DARK's own value is a reliable, self-contained way to tell
  // which theme T actually came from without threading a new darkMode
  // prop through MethodIcons/MethodBadge.
  const isDark = T.bg === NEUTRAL_DARK.bg;
  const box = { width: size, height: size, borderRadius: Math.round(size * 0.27), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
  if (/^(twitter(?:\s*\/\s*x)?|x)$/i.test(method.trim())) {
    return (
      <div title="Twitter/X" aria-label="Twitter/X" style={{ ...box, position: "relative", overflow: "hidden", background: "#111111" }}>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "#1DA1F2", clipPath: "polygon(0 0,100% 0,0 100%)" }}>
          <TwitterLogo size={size * 0.55} color="#FFFFFF" />
        </div>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "#111111", clipPath: "polygon(100% 0,100% 100%,0 100%)" }}>
          <XLogo size={size * 0.42} color="#FFFFFF" />
        </div>
      </div>
    );
  }
  if (/^email$/i.test(method.trim())) {
    return <div title="Email" aria-label="Email" style={{ ...box, background: T.surfaceVariant }}><GmailLogo size={size * 0.6} color="#EA4335" /></div>;
  }
  const platform = platformIconFor(method);
  if (platform) {
    const style = {
      ...box,
      objectFit: "cover",
      background: /^fab ?(guys|swingers)$/i.test(method.trim()) ? "#FFFFFF" : "transparent",
      filter: platform.edge && !isDark ? "drop-shadow(0 1px 2px rgba(0,0,0,.28))" : "none",
      border: platform.edge && !isDark && /^(fab ?guys|fab ?swingers)$/i.test(method.trim()) ? `1px solid ${T.border}` : "none",
    };
    return <img src={`${CONTACT_ICON_BASE}${platform.file}`} alt="" aria-hidden="true" title={method} style={style} />;
  }
  return (
    <div style={{ ...box, background: T.surfaceVariant }} title={method}>
      <MessageCircle size={size * 0.6} color={T.textSecondary} />
    </div>
  );
}
// The badges can be image-only at card size, so preserve the touch/keyboard
// caption that names the services instead of relying on hover-only tooltips.
function MethodIcons({ methods, T, size = 22, style = null }) {
  const [showLegend, setShowLegend] = useState(false);
  // FIXED 6 Oct 2026 (t079) - was `if (!methods || methods.length === 0)`. The
  // array is now deduplicated FIRST, so the emptiness check and the render are
  // driven by the same list. Previously the two disagreed: a contact whose only
  // entry was a duplicate still rendered, because the raw array was non-empty.
  const unique = dedupeContactMethods(methods);
  if (unique.length === 0) return null;
  return (
    <div style={style}>
      <div role="button" tabIndex={0} aria-label="Contact methods — tap for details"
        onClick={(e) => { e.stopPropagation(); setShowLegend((v) => !v); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); setShowLegend((v) => !v); } }}
        style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", cursor: "pointer", minHeight: 22, maxWidth: "100%" }}>
        {unique.map((m) => <MethodBadge key={m} method={m} T={T} size={size} />)}
      </div>
      {showLegend && (
        <div onClick={(e) => e.stopPropagation()} style={{ fontSize: 11, color: T.textSecondary, fontWeight: 500, marginTop: 2 }}>
          {unique.join(", ")}
        </div>
      )}
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
      <div style={{ ...TYPE.sectionLabel, color: T.contactsTeal, paddingTop: 12, marginBottom: 2 }}>{title}</div>
      {children}
    </div>
  );
}

// ADDED 18 Aug 2026 — moved here from My Profile: importing a shared
// profile creates a new Contact, so it belongs where Contacts are
// managed, not on the "about me" screen. Self-contained, same as every
// other module's own UI this session — doesn't import UI from
// SHOS_MyProfile_Prototype.jsx, just the pure functions it needs.
function SafetyShareSheet({ contact, T, tr, onClose }) {
  const { t: trFn } = useTranslation();
  const t = tr || trFn;
  useEscapeToClose(onClose);
  const [fields, setFields] = useState({ name: true, address: true, vehicle: true, photo: false, phone: false });
  const [includeLiveLocation, setIncludeLiveLocation] = useState(false);
  const [status, setStatus] = useState(null);
  const sheetRef = useRef(null);
  useEffect(() => { sheetRef.current?.focus(); }, []);

  const toggle = (k) => setFields((f) => ({ ...f, [k]: !f[k] }));

  const buildMessage = () => {
    const lines = [];
    const name = contact?.name || contact?.nickname || "Contact";
    if (fields.name) lines.push(`Name: ${name}`);
    if (fields.phone && contact?.phone) lines.push(`Phone: ${contact.phone}`);
    if (fields.address && contact?.address) lines.push(`Address: ${contact.address}`);
    if (fields.vehicle && contact?.vehicle) lines.push(`Vehicle: ${contact.vehicle}`);
    const msg = `I'm meeting ${name} around ${new Date().toLocaleString()}. If you don't hear from me within a few hours, here's their info:\n${lines.join("\n")}\n\nSharing is not a safety guarantee.`;
    return msg;
  };

  const doShare = async () => {
    const msg = buildMessage();
    try {
      if (navigator.share) {
        await navigator.share({ title: "Safety share", text: msg });
        setStatus({ ok: true, msg: "Shared." });
      } else {
        await navigator.clipboard.writeText(msg);
        setStatus({ ok: true, msg: "Copied to clipboard (share sheet unavailable)." });
      }
    } catch (e) {
      setStatus({ ok: false, msg: "Share cancelled or failed." });
    }
    if (includeLiveLocation) {
      try { window.open("https://www.google.com/maps", "_blank"); } catch {}
    }
  };

  return (
    <div role="dialog" aria-label="Share for safety" ref={sheetRef} tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: T.bg, zIndex: 200, overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px", position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer", padding: 11, boxSizing: "content-box", marginTop: -11, marginRight: -11, marginBottom: -11, marginLeft: -11}} onClick={onClose} role="button" tabIndex={0} aria-label={t("common.back", "Back")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        <span style={{ fontFamily: FONT_FAMILY, fontWeight: 700, fontSize: 16, color: T.textPrimary }}>Share for safety</span>
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <SectionCard T={T}>
          <div style={{ fontSize: TYPE.control.fontSize, color: T.textSecondary, marginBottom: 8 }}>Choose which fields to include:</div>
          {[
            { key: "name", label: "Name / nickname" },
            { key: "phone", label: "Phone number" },
            { key: "address", label: "Address" },
            { key: "vehicle", label: "Vehicle details" },
            { key: "photo", label: "Profile photo note" },
          ].map((opt) => (
            <div key={opt.key} onClick={() => toggle(opt.key)} role="button" tabIndex={0} aria-pressed={fields[opt.key]} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(opt.key); } }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", cursor: "pointer", minHeight: 44 }}>
              <input type="checkbox" checked={fields[opt.key]} onChange={() => toggle(opt.key)} style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: TYPE.control.fontSize, color: T.textPrimary }}>{opt.label}</span>
            </div>
          ))}
        </SectionCard>
        <SectionCard T={T}>
          <div onClick={() => setIncludeLiveLocation((v) => !v)} role="button" tabIndex={0} aria-pressed={includeLiveLocation} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setIncludeLiveLocation((v) => !v); } }} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", minHeight: 44 }}>
            <input type="checkbox" checked={includeLiveLocation} onChange={() => setIncludeLiveLocation((v) => !v)} style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: TYPE.control.fontSize, color: T.textPrimary }}>Include live location (opens Google Maps)</span>
          </div>
        </SectionCard>
        <div style={{ fontSize: 11, color: T.textSecondary, fontStyle: "italic" }}>Sharing is not a safety guarantee. Shared data leaves this device via your chosen app.</div>
        <button onClick={doShare} style={{ width: "100%", padding: 14, borderRadius: 999, border: "none", background: T.contactsTeal, color: "#FFFFFF", fontWeight: 700, cursor: "pointer", minHeight: 44 }}>Share</button>
        {status && <div style={{ fontSize: 12, color: status.ok ? T.actionGreenText : T.actionRedText }}>{status.msg}</div>}
        <div style={{ fontSize: 11, color: T.textDisabled, whiteSpace: "pre-wrap", background: T.surface, padding: 8, borderRadius: 6 }}>{buildMessage()}</div>
      </div>
    </div>
  );
}

function ImportSharedProfileSheet({ T, onClose, onImported }) {
  const { t: tr } = useTranslation();
  useEscapeToClose(onClose);
  const [pasteText, setPasteText] = useState("");
  const [status, setStatus] = useState(null);
  const importSheetRef = useRef(null);
  useEffect(() => { importSheetRef.current?.focus(); }, []);

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
    <div role="dialog" aria-label="Import shared profile" ref={importSheetRef} tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: T.bg, zIndex: 200, overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px", position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}` }}><div aria-hidden="true" data-notch-band="1" style={{ position: "absolute", left: 0, right: 0, bottom: "100%", height: "env(safe-area-inset-top)", background: T.bg, pointerEvents: "none" }} />
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer", padding: 11, boxSizing: "content-box", marginTop: -11, marginRight: -11, marginBottom: -11, marginLeft: -11}} onClick={onClose} role="button" tabIndex={0} aria-label={tr("common.back", "Back")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        <span style={{ fontFamily: FONT_FAMILY, fontWeight: 700, fontSize: 16, color: T.textPrimary }}>{tr("contacts.importSharedProfile", "Import shared profile")}</span>
      </div>
      <div style={{ padding: 16 }}>
        <SectionCard title="Import a shared profile" T={T}>
          <div style={{ fontSize: 12, color: T.textSecondary, padding: "8px 0" }}>
            Creates a brand-new Contact from someone else's shared profile. Doesn't touch or merge with any existing contact.
          </div>
          <div style={{ padding: "8px 0" }}>
            <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{tr("contacts.pasteSharedProfile", "Paste a shared profile")}</div>
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={4} aria-label="Paste a shared profile"
              placeholder="Paste the JSON text someone sent you"
              style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: FONT_FAMILY, fontSize: 14, boxSizing: "border-box", resize: "vertical" }} />
          </div>
          <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={doImportPaste} style={{ textAlign: "center", padding: "10px", borderRadius: radius.full, fontSize: TYPE.control.fontSize, fontWeight: 600, cursor: "pointer", background: pasteText.trim() ? T.contactsTeal : T.surfaceVariant, color: pasteText.trim() ? "#FFFFFF" : T.textDisabled, marginBottom: 10}}>
            Import from pasted text
          </div>
          <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: radius.full, border: `1px solid ${T.border}`, color: T.textPrimary, fontSize: TYPE.control.fontSize, fontWeight: 600, cursor: "pointer"}}>
            <Upload size={15} /> Import from file
            <input type="file" accept="application/json" onChange={doImportFile} style={{ display: "none" }} />
          </label>
        </SectionCard>
        {status && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: radius.sm, marginTop: 14, background: status.ok ? `${T.actionGreen}15` : `${T.actionRed}15`, color: status.ok ? T.actionGreenText : T.actionRedText, fontSize: TYPE.control.fontSize }}>
            {status.ok ? <Check size={16} /> : <X size={16} />}
            {status.msg}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared form primitives ──

function TextField({ label, value, onChange, T, placeholder, type = "text", helper, requiredMissing = false }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 12, color: requiredMissing ? T.actionRed : T.textSecondary }}>{requiredMissing && <span aria-hidden="true" style={{ color: T.actionRed, fontWeight: 800 }}>* </span>}{label}</div>
        {/* ADDED — real ask: "Now" quick-fill, device's real local date. */}
        {type === "date" && (
          <span role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => onChange(nowAsDateString())} style={{ fontSize: 12, fontWeight: 700, color: T.contactsTeal, cursor: "pointer"}}>Now</span>
        )}
      </div>
      <input type={type} value={value ?? ""} aria-label={requiredMissing ? `${label}, required` : label} aria-invalid={requiredMissing || undefined}
        onChange={(e) => onChange(type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNextField(e.target); } }}
        placeholder={placeholder}
         style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${requiredMissing ? T.actionRed : T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: FONT_FAMILY, fontSize: 14, boxSizing: "border-box" }} />
      {helper && <div style={{ fontSize: 11, color: T.textDisabled, marginTop: 3 }}>{helper}</div>}
    </div>
  );
}

// ADDED — real ask: trans/hetero inclusivity. Free text with real
// suggestion chips from an in-app-editable option list, same pattern
// already proven in Vaccinations' VaccineField and My Profile's own
// gender field — typing anything not suggested just works and gets
// remembered for next time.
function SuggestField({ label, value, onChange, options, onAddNew, T, placeholder }) {
  const { t: tr } = useTranslation();
  const visibleSuggestions = options.filter((o) => o !== value);
  const [feedback, setFeedback] = useState("");
  const remembered = useRef(new Set());
  const rememberValue = (raw, announceExisting = false) => {
    const text = (raw || "").trim();
    if (!text || !onAddNew) return;
    const existing = options.find((option) => option.toLowerCase() === text.toLowerCase());
    if (existing) {
      if (announceExisting) setFeedback(`“${existing}” ${tr("contacts.alreadyInSuggestions", "is already in the suggestions.")}`);
      return;
    }
    const key = text.toLowerCase();
    if (remembered.current.has(key)) return;
    remembered.current.add(key);
    try {
      Promise.resolve(onAddNew(text)).then(() => {
        setFeedback(`“${text}” ${tr("contacts.addedToSuggestions", "was added to the suggestions.")}`);
      }).catch(() => {
        remembered.current.delete(key);
        setFeedback(tr("contacts.suggestionSaveFailed", "Couldn't save that suggestion. The value is still in this contact."));
      });
    } catch {
      remembered.current.delete(key);
      setFeedback(tr("contacts.suggestionSaveFailed", "Couldn't save that suggestion. The value is still in this contact."));
    }
  };
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {visibleSuggestions.map((o) => (
            <div key={o} onMouseDown={(ev) => ev.preventDefault()} onClick={() => { onChange(o); setFeedback(""); }} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(o); setFeedback(""); } }}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 12, border: `1px solid ${T.contactsTeal}`, color: T.contactsTeal, cursor: "pointer"}}>
              {o}
            </div>
          ))}
        </div>
      )}
      <input value={value ?? ""} onChange={(e) => { onChange(e.target.value); setFeedback(""); }}
        onBlur={() => rememberValue(value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (value && value.trim()) rememberValue(value, true); focusNextField(e.target); } }}
        placeholder={placeholder} aria-label={label}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: FONT_FAMILY, fontSize: 14, boxSizing: "border-box" }} />
      {feedback && <div role="status" aria-live="polite" style={{ color: T.actionGreenText, fontSize: 11, marginTop: 4 }}>{feedback}</div>}
    </div>
  );
}

function SelectField({ label, value, onChange, options, T, helper }) {
  return (
    <div style={{ padding: "8px 0" }}>
        <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
        {helper && <div style={{ fontSize: 11, color: T.textDisabled, marginBottom: 4, fontStyle: "italic" }}>{helper}</div>}
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} aria-label={label}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: FONT_FAMILY, fontSize: 14, boxSizing: "border-box" }}>
        <option value="">—</option>
        {/* FIXED 1 Oct 2026 - identical to the My Profile copy of this component,
            which had been throwing React error #31. Accepts both plain strings
            and `{value, label}` objects so a caller can pass real labels; every
            other caller here passes strings and is unaffected. */}
        {options.map((opt) => (
          <option
            key={typeof opt === "string" ? opt : opt.value}
            value={typeof opt === "string" ? opt : opt.value}
          >
            {typeof opt === "string" ? opt : opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// CHANGED — real ask: the native `list`/`<datalist>` dropdown this
// used to rely on could render on top of the on-screen keyboard on
// Android WebView. Switched to the same visible-suggestion-chips
// pattern every other picker in this app already uses instead of a
// native dropdown.
function ComboField({ label, value, onChange, T, options, placeholder, requiredMissing = false }) {
  const visibleSuggestions = options.filter((o) => o !== value).slice(0, 8);
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: requiredMissing ? T.actionRed : T.textSecondary, marginBottom: 4 }}>{requiredMissing && <span aria-hidden="true" style={{ color: T.actionRed, fontWeight: 800 }}>* </span>}{label}</div>
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {visibleSuggestions.map((opt) => (
            <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} key={opt} onClick={() => onChange(opt)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 12, border: `1px solid ${T.contactsTeal}`, color: T.contactsTeal, cursor: "pointer"}}>
              {opt}
            </div>
          ))}
        </div>
      )}
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} aria-label={requiredMissing ? `${label}, required` : label} aria-invalid={requiredMissing || undefined}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNextField(e.target); } }}
        placeholder={placeholder || "Choose or type a new one"}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${requiredMissing ? T.actionRed : T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: FONT_FAMILY, fontSize: 14, boxSizing: "border-box" }} />
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
  // ADDED — real ask: "use current location... pulls location from
  // Google maps (or other free service like already using)" — reuses
  // this same field's own pick() below, so a location found via GPS
  // fills in and detects the city exactly like picking a search result
  // does.
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");
  const handleUseCurrentLocation = async () => {
    setLocating(true);
    setLocateError("");
    try {
      const place = await getCurrentLocationPlace();
      pick(place);
    } catch (err) {
      setLocateError(err.message);
    } finally {
      setLocating(false);
    }
  };

  const handleChange = (text) => {
    onChange(text);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 3) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await forwardGeocode(text);
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 12, color: T.textSecondary }}>{label}</div>
        <span onClick={locating ? undefined : handleUseCurrentLocation} role="button" tabIndex={locating ? -1 : 0} aria-label={locating ? "Locating current location" : "Use current location"} aria-disabled={locating} onKeyDown={(e) => { if (!locating && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); handleUseCurrentLocation(); } }}
          style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: T.contactsTeal, cursor: locating ? "default" : "pointer", opacity: locating ? 0.6 : 1 }}>
          <Crosshair size={12} weight="bold" /> {locating ? "Locating…" : "Use current location"}
        </span>
      </div>
      {locateError && <div style={{ fontSize: 11, color: T.actionRed, marginBottom: 4 }}>{locateError}</div>}
      <input value={value ?? ""} onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder || "Start typing an address..."} aria-label={label}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: FONT_FAMILY, fontSize: 14, boxSizing: "border-box" }} />
      {open && (loading || results.length > 0) && (
        <div tabIndex={0} style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: radius.sm, marginTop: 2, zIndex: 10, maxHeight: 220, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,.15)" }}>
          {loading && <div style={{ padding: 10, fontSize: 12, color: T.textDisabled }}>Searching…</div>}
          {results.map((r) => (
            <div key={r.place_id} onMouseDown={() => pick(r)}
              style={{ padding: "8px 10px", fontSize: TYPE.control.fontSize, color: T.textPrimary, cursor: "pointer", borderBottom: `1px solid ${T.border}`}}>
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

// FIXED 27 Sep 2026 — true when a record already has a value in any of the
// "Physical & health" fields that the gender gate hides. Defined once in
// contactCalculations.js's hasPhysicalDetail() so this file and My Profile
// cannot drift apart again — they each hid the identical bug, and the rule it
// encodes ("never hide an already-entered answer") is a product rule, not a
// per-screen detail. See that function's own comment.

// One row of the three-part "Ejaculation" group.
//
// FIXED 27 Sep 2026 — real data loss, found by auditing this as a first-time
// user. All three rows used to read AND write the whole `cummer` array, via
// MultiSelectChips' toggle handler, which replaces the entire array:
//   onChange(has ? value.filter(v => v !== opt) : [...value, opt])
// Since `value` was the full array, picking "Big load" in the volume row and
// then "Squirter" in the style row silently discarded "Big load". Worse, each
// row renders `value` as its own selected set, so after that the VOLUME row
// also showed nothing selected — giving no clue the value had been dropped
// rather than never applied. Real data loss, on first entry, in the most
// intimate section of the most-used module.
//
// The merge logic lives in contactCalculations.js's mergeCummerRow() rather
// than here, so it is defined once (this file and My Profile each had their
// own copy of the bug) and is unit-testable at all — the bug survived build,
// lint, vitest and the whole smoke suite precisely because it lived in render
// code. See that function's own comment for the full reasoning.
function CummerRow({ T, label, form, set, options }) {
  const mine = (form.cummer || []).filter((v) => options.includes(v));
  const onChange = (next) => set("cummer")(mergeCummerRow(form.cummer, next, options));
  return <MultiSelectChips T={T} label={label} value={mine} onChange={onChange} options={options} />;
}

function MultiSelectChips({ label, value, onChange, options, T, onAddNew, listName, requiredMissing = false, exclusiveOption = null }) {
  const [newValue, setNewValue] = useState("");
  const toggle = (opt) => {
    const has = value.includes(opt);
    onChange(toggleMultiSelectValue(value, opt, exclusiveOption));
    // ADDED — real ask: frequency-weighted suggestion ranking (3 Sep
    // 2026) — a real pick counts as a use, same reasoning as
    // Measurements/Medication's own suggestion fields; the "Add new"
    // input below already credits usage via CustomOptionListsRepository.add()
    // itself, but only for values typed there, not existing chips.
    if (!has && listName) CustomOptionListsRepository.recordUsage(listName, opt);
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
      <div style={{ fontSize: 12, color: requiredMissing ? T.actionRed : T.textSecondary, marginBottom: 6 }}>{requiredMissing && <span aria-hidden="true" style={{ color: T.actionRed, fontWeight: 800 }}>* </span>}{label}</div>
      <div role="group" aria-label={requiredMissing ? `${label}, required` : label} aria-invalid={requiredMissing || undefined}
        style={{ display: "flex", flexWrap: "wrap", gap: 6, border: `1px solid ${requiredMissing ? T.actionRed : "transparent"}`, borderRadius: radius.sm, padding: requiredMissing ? 5 : 0 }}>
        {options.map((opt) => {
          const active = value.includes(opt);
          return (
            <div key={opt} onClick={() => toggle(opt)} role="button" tabIndex={0} aria-pressed={active}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(opt); } }}
              style={{ padding: "5px 10px", borderRadius: radius.full, fontSize: TYPE.control.fontSize, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? T.contactsTeal : T.border}`, color: active ? T.contactsTealText : T.textSecondary, background: active ? `${T.contactsTeal}15` : "transparent"}}>
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
            style={{ flex: 1, padding: "6px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: FONT_FAMILY, fontSize: 12, boxSizing: "border-box" }} />
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
  const { t: tr } = useTranslation();
  const [draft, setDraft] = useState("");
  // CHANGED — real ask: "any other fuzzy matching/auto suggestions... to
  // avoid dupes." Same bug the Kink/Symptom pickers had this session:
  // the chip list never actually narrowed against what's typed, it just
  // showed the same static first-10 the whole time. Now empty-draft
  // shows the usual top-10; typing filters to real (fuzzy) matches.
  const visibleSuggestions = (draft.trim()
    ? suggestions.filter((s) => fuzzyIncludes(s, draft))
    : suggestions
  ).filter((s) => !value.includes(s)).slice(0, 10);
  // ADDED — "did you mean X?" before committing a genuinely new tag,
  // same mechanism as RegistryTagPicker below, scoped to the simple
  // single-new-tag case (a comma-separated bulk add skips this check —
  // there's no clean single-item confirmation for several at once).
  const [pendingSuggestion, setPendingSuggestion] = useState(null);

  const commitDraft = (el) => {
    const raw = draft.trim();
    if (!raw) {
      if (el) focusNextField(el);
      return;
    }
    const newTags = raw.split(",").map((t) => normalizeTag(t)).filter((t) => t && !value.includes(t));
    if (newTags.length === 1) {
      const match = findClosestMatch([...suggestions, ...value], newTags[0]);
      if (match) {
        setPendingSuggestion({ typedAs: newTags[0], suggestion: match });
        setDraft("");
        return;
      }
    }
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
          {value.map((tag) => {
            const platform = platformIconFor(tag);
            const isEmail = /^email$/i.test(tag);
            const isTwitterX = /^(twitter(?:\s*\/\s*x)?|x)$/i.test(tag.trim());
            return (
              <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} key={tag} onClick={() => onChange(value.filter((t) => t !== tag))}
                style={{ padding: "4px 8px", borderRadius: radius.full, fontSize: TYPE.control.fontSize, background: T.surfaceVariant, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 4}}>
                {platform && <img src={`${CONTACT_ICON_BASE}${platform.file}`} alt="" aria-hidden="true" style={{ width: 14, height: 14, objectFit: "cover", borderRadius: 3, background: /^fab ?(guys|swingers)$/i.test(tag) ? "#FFFFFF" : "transparent", filter: platform.edge && T.bg !== NEUTRAL_DARK.bg ? "drop-shadow(0 1px 1px rgba(0,0,0,.28))" : "none" }} />}
                {isEmail && <Envelope size={12} />}{isTwitterX && <TwitterLogo size={12} />} {tag} <X size={11} />
              </div>
            );
          })}
        </div>
      )}
      {pendingSuggestion && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 10px", borderRadius: radius.sm, background: `${T.contactsTeal}15`, border: `1px solid ${T.contactsTeal}`, marginBottom: 6, fontSize: 12 }}>
          <span style={{ color: T.textPrimary }}>Did you mean "{pendingSuggestion.suggestion}"? You typed "{pendingSuggestion.typedAs}".</span>
          <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onMouseDown={(ev) => ev.preventDefault()} onClick={() => { tapSuggestion(pendingSuggestion.suggestion); setPendingSuggestion(null); }}
            style={{ fontWeight: 700, color: T.contactsTealText, cursor: "pointer"}}>{tr("contacts.yesUseIt", "Yes, use it")}</div>
          <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onMouseDown={(ev) => ev.preventDefault()} onClick={() => { if (!value.includes(pendingSuggestion.typedAs)) onChange([...value, pendingSuggestion.typedAs]); setPendingSuggestion(null); }}
            style={{ fontWeight: 700, color: T.textSecondary, cursor: "pointer"}}>{tr("contacts.noAddAsNew", "No, add as new")}</div>
        </div>
      )}
      {/* CHANGED — real ask: the `list`/`<datalist>` native browser
          dropdown (removed here) could render on top of the on-screen
          keyboard on Android WebView. The visible suggestion chips
          below already cover "pick existing" without that risk. */}
      <input value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitDraft(e.target); } }}
        onBlur={() => commitDraft(null)}
        placeholder={placeholder || "Type one or more, comma-separated, then press Enter"}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: FONT_FAMILY, fontSize: TYPE.control.fontSize, boxSizing: "border-box" }} />
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
          {visibleSuggestions.map((s) => (
            <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} key={s} onMouseDown={(ev) => ev.preventDefault()} onClick={() => tapSuggestion(s)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 12, border: `1px solid ${T.contactsTeal}`, color: T.contactsTeal, cursor: "pointer"}}>
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
// CHANGED — Phase 2 encryption groundwork: KinkRegistry/ChemsRegistry/
// ProtectionRegistry/SymptomsRegistry (whichever `registry` is passed
// here) are now async — allEntries loaded via useLoadedMemo instead of
// a plain render-body call; nameFor's archived-entry fallback resolved
// via a missingNames lookup instead of a synchronous getById() call;
// finalizeEntry/commitDraft now await registry.findOrCreate(), and
// commitDraft awaits analyzeEntry (analyzeKinkEntry, also now async).
function RegistryTagPicker({ label, value, onChange, T, registry, placeholder, excludeIds = [], trackRole = false, roleOptions = [], resolveSynonym = (x) => x, analyzeEntry = null, getRoleOptionsForKink = null }) {
  const { t: tr } = useTranslation();
  const [draft, setDraft] = useState("");
  // ADDED — real ask: "did you mean...?" for a recognized typo or an
  // umbrella term with a more specific real option. Only used when
  // `analyzeEntry` is actually passed in (Kink-backed pickers) —
  // Chems/Protection/Symptoms pickers don't have this analysis
  // available and are completely unaffected.
  const [pendingSuggestion, setPendingSuggestion] = useState(null);
  const allEntries = useLoadedMemo(() => registry.getAll().then((all) => all.filter((e) => !e.isArchived)), [], []);
  const missingNames = useLoadedMemo(async () => {
    const selectedIdsForLookup = trackRole ? value.map((v) => v.kinkId) : value;
    const missingIds = selectedIdsForLookup.filter((id) => !allEntries.some((e) => e.id === id));
    const map = new Map();
    await Promise.all(missingIds.map(async (id) => { const e = await registry.getById(id); if (e) map.set(id, e.name); }));
    return map;
  }, [value, allEntries], new Map());
  const nameFor = (id) => allEntries.find((e) => e.id === id)?.name || missingNames.get(id) || "?";

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
  // CHANGED — real ask: "auto recognise as typing begins and narrow
  // down drop down searches... do this with any field appropriate,
  // like kinks". `draft` was never actually used to filter this list —
  // typing did nothing, it just showed the same static first-10 the
  // whole time. This one component covers Kinks/Limits/Chems/
  // Protection/Symptoms in this module, so the fix applies to all of
  // them at once. Reuses fuzzyIncludes() (fuzzyMatch.js, already built
  // for Global Search's typo tolerance) — the existing analyzeEntry/
  // synonym "did you mean" flow on commit is untouched, this only
  // fixes the live suggestion list shown while still typing.
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
  // CHANGED 15 Sep 2026, then corrected same day — real report was
  // "new-kink Dom/sub + Top/bottom shouldn't default", which an
  // earlier pass over-corrected into 3 always-visible chips per kink.
  // Owner's own follow-up clarified the actual ask: not a request to
  // show every option at once, just that a brand-new/unclassified kink
  // shouldn't be locked to only ONE axis (Top/bottom OR Dom/sub) —
  // "allow cycling through both, learning from what the user settles
  // on." Back to a single cycling badge, one tap = one step forward
  // through resolveRoleOptions(id)'s own list (now the combined
  // Top/bottom/Vers + Dom/sub/Switch pool for any kink
  // getKinkRoleOptions() doesn't recognize — see kinkRegistry.js) —
  // cycling past the last option lands back on "no role" rather than
  // wrapping straight to the first again, so leaving a kink unset is
  // always one more tap away, not lost once you've started cycling.
  const cycleRole = (id) => {
    if (!trackRole) return;
    onChange(value.map((v) => {
      if (v.kinkId !== id) return v;
      const options = resolveRoleOptions(id);
      if (!options) return v;
      const nextIdx = options.indexOf(v.role) + 1;
      return { ...v, role: nextIdx >= options.length ? null : options[nextIdx] };
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
  const finalizeEntry = async (resolvedName, role) => {
    const entry = await registry.findOrCreate(resolvedName);
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

  const commitDraft = async (el) => {
    const raw = draft.trim();
    if (!raw) {
      if (el) focusNextField(el);
      return;
    }
    const rawParts = raw.split(",").map((t) => t.trim()).filter(Boolean);

    if (analyzeEntry && rawParts.length === 1) {
      const { text, role } = trackRole ? extractKinkRoleFromText(rawParts[0], extractionRoleOptions) : { text: rawParts[0], role: null };
      const normalized = normalizeTag(text);
      const analysis = await analyzeEntry(normalized);
      if (analysis.type === "umbrella" || analysis.type === "fuzzy-suggestion") {
        setPendingSuggestion({ ...analysis, role });
        setDraft("");
        return;
      }
    }

    const newSelections = [];
    for (const rawPart of rawParts) {
      const { text, role } = trackRole ? extractKinkRoleFromText(rawPart, extractionRoleOptions) : { text: rawPart, role: null };
      const resolved = resolveSynonym(normalizeTag(text));
      if (!resolved) continue;
      const entry = await registry.findOrCreate(resolved);
      if (entry && !hasSelection(entry.id) && !newSelections.some((s) => s.id === entry.id)) {
        newSelections.push({ id: entry.id, role });
      }
    }
    if (newSelections.length > 0) {
      if (trackRole) onChange([...value, ...newSelections.map((s) => ({ kinkId: s.id, role: s.role }))]);
      else onChange([...value, ...newSelections.map((s) => s.id)]);
    }
    setDraft("");
  };

  // CHANGED 15 Sep 2026 — real report (this exact picker's Encounters
  // copy): picking a suggestion chip left the search box showing
  // whatever was typed instead of clearing, unlike commit()'s own
  // setDraft(""). Same copy-pasted gap, fixed the same way here.
  const tapSuggestion = (entry) => {
    if (!hasSelection(entry.id)) addEntries([entry.id]);
    setDraft("");
  };

  // ADDED 2 Sep 2026 — real ask: "set all for others too" — same
  // one-tap "set every selection's role at once" feature My Profile's
  // own copy of this component got earlier this session, now here too
  // (Contacts' Stated Kinks/Limits). Identical ROLE_POLES/setAllRoles
  // shape — see My Profile's copy for the full reasoning on why each
  // pole maps to whichever axis (anatomical Top/bottom/Vers vs dynamic
  // Dom/sub/Switch) a given kink actually uses.
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
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      {trackRole && value.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: T.textDisabled }}>{tr("contacts.setAll", "Set all:")}</span>
          {ROLE_POLES.map((pole) => (
            <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} key={pole.label} onClick={() => setAllRoles(pole)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, border: `1px solid ${T.contactsTeal}`, color: T.contactsTeal, cursor: "pointer"}}>
              {pole.label}
            </div>
          ))}
        </div>
      )}
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
                <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => removeEntry(sel.kinkId)}
                  style={{ padding: "4px 8px", fontSize: 12, color: T.textPrimary, cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center", gap: 4 }}>
                  {nameFor(sel.kinkId)} <X size={11} />
                </div>
                {trackRole && roleOptionsForThisKink && (
                  <div onClick={() => cycleRole(sel.kinkId)} role="button" tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cycleRole(sel.kinkId); } }}
                    aria-label={`Cycle role for ${nameFor(sel.kinkId)}`}
                    style={{ padding: "4px 8px", fontSize: 12, fontWeight: 600, cursor: "pointer", borderLeft: `1px solid ${T.border}`, color: sel.role ? T.contactsTeal : T.textDisabled}}>
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
            <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} key={e.id} onMouseDown={(ev) => ev.preventDefault()} onClick={() => tapSuggestion(e)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 12, border: `1px solid ${T.contactsTeal}`, color: T.contactsTeal, cursor: "pointer"}}>
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
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitDraft(e.target); } }}
        onBlur={() => commitDraft(null)}
        placeholder={placeholder || "Pick existing or type new ones, comma-separated"}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: FONT_FAMILY, fontSize: TYPE.control.fontSize, boxSizing: "border-box" }} />
      {/* ADDED — real ask: "did you mean...?" prompt. Shown instead of
          silently deciding for the user — accepting a suggestion or
          keeping the typed word exactly as-is are both one tap away,
          neither is forced. */}
      {pendingSuggestion && (
        <div style={{ marginTop: 6, padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${ACCENTS.contacts}`, background: `${ACCENTS.contacts}10` }}>
          {pendingSuggestion.type === "umbrella" ? (
            <>
              <div style={{ fontSize: 12, color: T.textPrimary, marginBottom: 6 }}>
                "{pendingSuggestion.typedAs}" is a broader term — did you mean {pendingSuggestion.specific.length > 1 ? "one of these more specific ones" : "the more specific"}?
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {pendingSuggestion.specific.map((entry) => (
                  <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} key={entry.id} onMouseDown={(ev) => ev.preventDefault()} onClick={() => { finalizeEntry(entry.name, pendingSuggestion.role); setPendingSuggestion(null); }}
                    style={{ padding: "4px 10px", borderRadius: radius.full, fontSize: TYPE.control.fontSize, fontWeight: 600, background: ACCENTS.contacts, color: "#FFFFFF", cursor: "pointer"}}>
                    Use "{entry.name}"
                  </div>
                ))}
                <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onMouseDown={(ev) => ev.preventDefault()} onClick={() => { finalizeEntry(pendingSuggestion.typedAs, pendingSuggestion.role); setPendingSuggestion(null); }}
                  style={{ padding: "4px 10px", borderRadius: radius.full, fontSize: TYPE.control.fontSize, fontWeight: 600, border: `1px solid ${T.border}`, color: T.textSecondary, cursor: "pointer"}}>
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
                <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onMouseDown={(ev) => ev.preventDefault()} onClick={() => { finalizeEntry(pendingSuggestion.suggestion, pendingSuggestion.role); setPendingSuggestion(null); }}
                  style={{ padding: "4px 10px", borderRadius: radius.full, fontSize: TYPE.control.fontSize, fontWeight: 600, background: ACCENTS.contacts, color: "#FFFFFF", cursor: "pointer"}}>
                  Yes, use "{pendingSuggestion.suggestion}"
                </div>
                <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onMouseDown={(ev) => ev.preventDefault()} onClick={() => { finalizeEntry(pendingSuggestion.typedAs, pendingSuggestion.role); setPendingSuggestion(null); }}
                  style={{ padding: "4px 10px", borderRadius: radius.full, fontSize: TYPE.control.fontSize, fontWeight: 600, border: `1px solid ${T.border}`, color: T.textSecondary, cursor: "pointer"}}>
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
  // CHANGED 28 Oct 2026 (Lily, t209) — the 40x24 pill is the right size to look
  // at and too small to hit, and it must stay 40x24 after the shape restore. It
  // is now wrapped in a 44px hit area; the negative margin means callers see the
  // old footprint, and the pill takes no pointer events so the tap lands once.
  const reducedMotion = useReducedMotion();
  const toggle = () => onChange(!value);
  return (
    <div
      onClick={toggle}
      role="switch"
      tabIndex={0}
      aria-checked={value}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 44, minWidth: 44, margin: "-10px 0", cursor: "pointer", flexShrink: 0 }}
    >
      <div style={{ width: 40, height: 24, borderRadius: radius.full, background: value ? T.contactsTeal : T.surfaceVariant, position: "relative", pointerEvents: "none", transition: reducedMotion ? "none" : "background 150ms ease" }}>
        <div style={{ position: "absolute", top: 2, left: value ? 18 : 2, width: 20, height: 20, borderRadius: radius.full, background: "#FFFFFF", transition: reducedMotion ? "none" : "left 150ms ease", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
      </div>
    </div>
  );
}

function AgeField({ age, ageIsApprox, onChangeAge, onChangeApprox, T, requiredMissing = false }) {
  const { t: tr } = useTranslation();
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: requiredMissing ? T.actionRed : T.textSecondary, marginBottom: 4 }}>{requiredMissing && <span aria-hidden="true" style={{ color: T.actionRed, fontWeight: 800 }}>* </span>}Age</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input type="number" value={age ?? ""} onChange={(e) => onChangeAge(e.target.value === "" ? null : Number(e.target.value))} aria-label={requiredMissing ? "Age, required" : "Age"} aria-invalid={requiredMissing || undefined}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNextField(e.target); } }}
          style={{ width: 90, padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${requiredMissing ? T.actionRed : T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: FONT_FAMILY, fontSize: 14, boxSizing: "border-box" }} />
        <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => onChangeApprox(!ageIsApprox)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", minHeight: 44 }}>
          <ToggleSwitch T={T} value={ageIsApprox} onChange={onChangeApprox} />
          <span style={{ fontSize: 12, color: T.textSecondary }}>{tr("contacts.approximate", "Approximate")}</span>
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
  const { t: tr } = useTranslation();
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
      <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => inputRef.current?.click()}
        style={{ width: 64, height: 64, borderRadius: radius.full, background: T.surfaceVariant, border: `1px solid ${T.border}`, cursor: "pointer", minHeight: 44, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {value ? (
          <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <User size={24} color={T.textDisabled} />
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => inputRef.current?.click()}
          style={{ fontSize: TYPE.control.fontSize, fontWeight: 600, color: T.contactsTeal, cursor: "pointer"}}>
          {value ? "Change photo" : "Add photo"}
        </div>
        {value && (
          <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => onChange("")} style={{ fontSize: TYPE.control.fontSize, color: T.actionRed, cursor: "pointer"}}>{tr("contacts.remove", "Remove")}</div>
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
  const { t: tr } = useTranslation();
  const detected = [];
  if (contact.phone) detected.push("Phone/WhatsApp");
  if (contact.email) detected.push("Email");
  if (contact.snapchat) detected.push("Snapchat");
  if (contact.fabguys) detected.push("Fabguys");
  if (contact.fabswingers) detected.push("Fabswingers");
  if (contact.recon) detected.push("Recon");
  if (detected.length === 0) return null;
  return (
    <div style={{ padding: "8px 0 0" }}>
      <div style={{ fontSize: 11, color: T.textDisabled, marginBottom: 6 }}>{tr("contacts.alreadyCovered", "Already covered, from the fields above:")}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {detected.map((m) => (
          <span key={m} style={{ padding: "4px 8px", borderRadius: radius.full, fontSize: 12, background: `${T.contactsTeal}15`, color: T.contactsTealText, fontWeight: 600 }}>{m}</span>
        ))}
      </div>
    </div>
  );
}

function WeeklyAvailabilityEditor({ weeklyRules, onWeeklyRulesChange, exceptions, onExceptionsChange, timeZone, onTimeZoneChange, legacy, onClearLegacy, T }) {
  const { t: tr } = useTranslation();
  const [exceptionDraft, setExceptionDraft] = useState({ date: nowAsDateString(), type: "Unavailable", allDay: true, start: "18:00", end: "22:00" });
  const [showExceptionForm, setShowExceptionForm] = useState(false);
  const localZone = getDeviceTimeZone();
  const zoneValid = !timeZone || isValidTimeZone(timeZone);
  const hasLegacy = (legacy.availability?.length || 0) > 0 || (legacy.nonAvailabilityRules?.length || 0) > 0 || !!legacy.readilyAvailable;
  const inputStyle = { minWidth: 0, padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontSize: 12 };
  const updateRule = (id, changes) => onWeeklyRulesChange(weeklyRules.map((rule) => rule.id === id ? { ...rule, ...changes } : rule));
  const toggleRuleDay = (rule, day) => updateRule(rule.id, {
    days: rule.days.includes(day) ? rule.days.filter((d) => d !== day) : [...rule.days, day].sort((a, b) => a - b),
  });
  const addWeeklyRule = () => onWeeklyRulesChange([...weeklyRules, {
    id: `weekly_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    days: [], start: "18:00", end: "22:00",
  }]);
  const addException = () => {
    if (!exceptionDraft.date || (!exceptionDraft.allDay && (!exceptionDraft.start || !exceptionDraft.end || exceptionDraft.start === exceptionDraft.end))) return;
    const next = {
      id: `exception_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      date: exceptionDraft.date,
      type: exceptionDraft.type,
      ...(exceptionDraft.allDay ? {} : { start: exceptionDraft.start, end: exceptionDraft.end }),
    };
    onExceptionsChange([...exceptions, next]);
    setShowExceptionForm(false);
    setExceptionDraft((d) => ({ ...d, date: nowAsDateString() }));
  };
  const exceptionDescription = (exception) => `${exception.date} · ${exception.type}${exception.start && exception.end ? ` · ${exception.start}–${exception.end}` : " · all day"}`;

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <div style={{ fontSize: 12, color: T.textSecondary, fontWeight: 600 }}>{tr("contacts.weeklyAvailability", "Weekly availability")}</div>
        <div style={{ fontSize: 10, color: T.textDisabled, textAlign: "right" }}>{timeZone || localZone}</div>
      </div>
      <div style={{ fontSize: 10, color: T.textDisabled, marginBottom: 8 }}>{tr("contacts.availabilityTimezoneHelp", "Times are interpreted in this timezone. Leave blank to use this device's local timezone.")}</div>
      <input type="text" list="contact-availability-timezones" value={timeZone || ""} onChange={(e) => onTimeZoneChange(e.target.value)} placeholder={localZone}
        aria-label={tr("contacts.availabilityTimezone", "Contact's local timezone")} style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginBottom: 8 }} />
      <datalist id="contact-availability-timezones">
        {SUPPORTED_TIME_ZONES.map((zone) => <option key={zone} value={zone} />)}
      </datalist>
      {!zoneValid && <div role="alert" style={{ color: T.actionRed, fontSize: 11, marginBottom: 8 }}>Enter a valid IANA timezone, e.g. Europe/London.</div>}

      {weeklyRules.map((rule) => (
        <div key={rule.id} style={{ padding: 10, border: `1px solid ${T.border}`, borderRadius: radius.sm, background: T.surfaceVariant, marginBottom: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
            {DAYS_OF_WEEK.map((day, dayIndex) => {
              const selected = (rule.days || []).some((value) => Number(value) === dayIndex || String(value).slice(0, 3).toLowerCase() === day.toLowerCase());
              return <button key={day} type="button" aria-pressed={selected} onClick={() => toggleRuleDay({ ...rule, days: (rule.days || []).map((value) => Number.isInteger(value) ? value : DAYS_OF_WEEK.findIndex((d) => d.toLowerCase() === String(value).slice(0, 3).toLowerCase())).filter((n) => n >= 0) }, dayIndex)}
                style={{ minWidth: 34, minHeight: 40, borderRadius: radius.sm, border: `1px solid ${selected ? T.contactsTeal : T.border}`, background: selected ? `${T.contactsTeal}15` : T.surface, color: selected ? T.contactsTealText : T.textSecondary, fontSize: 11, fontWeight: 600 }}>{day}</button>;
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ flex: 1, fontSize: 11, color: T.textSecondary }}>From<input type="time" aria-label="Availability start time" value={rule.start || ""} onChange={(e) => updateRule(rule.id, { start: e.target.value })} style={{ ...inputStyle, display: "block", width: "100%", marginTop: 3 }} /></label>
            <label style={{ flex: 1, fontSize: 11, color: T.textSecondary }}>To<input type="time" aria-label="Availability end time" value={rule.end || ""} onChange={(e) => updateRule(rule.id, { end: e.target.value })} style={{ ...inputStyle, display: "block", width: "100%", marginTop: 3 }} /></label>
            <button type="button" onClick={() => onWeeklyRulesChange(weeklyRules.filter((r) => r.id !== rule.id))} aria-label="Remove weekly availability window" style={{ ...inputStyle, minHeight: 44, padding: 8, color: T.actionRed }}><Trash2 size={17} /></button>
          </div>
          {!rule.days?.length && <div style={{ color: T.actionAmberText, fontSize: 10, marginTop: 6 }}>Choose at least one day for this window.</div>}
          {!!rule.days?.length && !isValidAvailabilityWindow(rule) && <div role="alert" style={{ color: T.actionRed, fontSize: 10, marginTop: 6 }}>Choose a valid start and end time; the times must differ.</div>}
        </div>
      ))}
      <button type="button" onClick={addWeeklyRule} style={{ ...btnStyle(T.contactsTeal, "outline"), width: "100%", padding: 9, marginBottom: 10 }}>
        {tr("contacts.addAvailabilityWindow", "Add weekly time window")}
      </button>

      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
        <div style={{ fontSize: 12, color: T.textSecondary, fontWeight: 600, marginBottom: 6 }}>{tr("contacts.availabilityExceptionsOneOff", "Date-specific exceptions")}</div>
        {exceptions.map((exception) => (
          <div key={exception.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${T.border}`, fontSize: 11, color: T.textPrimary }}>
            <span>{exceptionDescription(exception)}</span>
            <button type="button" onClick={() => onExceptionsChange(exceptions.filter((x) => x.id !== exception.id))} aria-label="Remove date-specific availability exception" style={{ ...inputStyle, minHeight: 40, padding: 6, color: T.actionRed }}><Trash2 size={15} /></button>
          </div>
        ))}
        {showExceptionForm ? (
          <div style={{ marginTop: 8, padding: 10, border: `1px dashed ${T.border}`, borderRadius: radius.sm }}>
            <label style={{ display: "block", fontSize: 11, color: T.textSecondary, marginBottom: 8 }}>Date<input type="date" value={exceptionDraft.date} onChange={(e) => setExceptionDraft((d) => ({ ...d, date: e.target.value }))} style={{ ...inputStyle, display: "block", width: "100%", marginTop: 3 }} /></label>
            <select aria-label="Exception availability" value={exceptionDraft.type} onChange={(e) => setExceptionDraft((d) => ({ ...d, type: e.target.value }))} style={{ ...inputStyle, width: "100%", marginBottom: 8 }}>
              <option value="Unavailable">{tr("contacts.unavailable", "Unavailable")}</option>
              <option value="Available">{tr("contacts.available", "Available")}</option>
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40, fontSize: 12, color: T.textSecondary }}>
              <input type="checkbox" checked={exceptionDraft.allDay} onChange={(e) => setExceptionDraft((d) => ({ ...d, allDay: e.target.checked }))} />
              {tr("contacts.availabilityAllDay", "All day")}
            </label>
            {!exceptionDraft.allDay && <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input type="time" aria-label="Exception start time" value={exceptionDraft.start} onChange={(e) => setExceptionDraft((d) => ({ ...d, start: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
              <input type="time" aria-label="Exception end time" value={exceptionDraft.end} onChange={(e) => setExceptionDraft((d) => ({ ...d, end: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
            </div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={addException} disabled={!exceptionDraft.date || (!exceptionDraft.allDay && (!exceptionDraft.start || !exceptionDraft.end || exceptionDraft.start === exceptionDraft.end))} style={{ ...btnStyle(T.contactsTeal, "filled"), flex: 1, padding: 8 }}>Add exception</button>
              <button type="button" onClick={() => setShowExceptionForm(false)} style={{ ...btnStyle(T.textSecondary, "outline"), padding: 8 }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setShowExceptionForm(true)} style={{ ...btnStyle(T.textSecondary, "outline"), width: "100%", padding: 8, marginTop: 8 }}>{tr("contacts.addAvailabilityException", "Add one-off exception")}</button>
        )}
      </div>

      {hasLegacy && (
        <details style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
          <summary style={{ color: T.textSecondary, fontSize: 11, cursor: "pointer", minHeight: 36, display: "flex", alignItems: "center" }}>{tr("contacts.legacyAvailability", "Previous availability details")}</summary>
          <div style={{ fontSize: 11, color: T.textDisabled, marginBottom: 8 }}>{tr("contacts.legacyAvailabilityHelp", "These saved details are preserved for reference but are not used by the new schedule filters.")}</div>
          {!!legacy.availability?.length && <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 4 }}>Tags: {legacy.availability.join(", ")}</div>}
          {!!legacy.nonAvailabilityRules?.length && <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 4 }}>Old recurring rules: {legacy.nonAvailabilityRules.map((r) => `${r.type || "Rule"} · ${(r.days || []).join(", ")}`).join("; ")}</div>}
          {!!legacy.readilyAvailable && <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 8 }}>Readily available: {legacy.readilyAvailable}</div>}
          <button type="button" onClick={onClearLegacy} style={{ ...btnStyle(T.actionRed, "outline"), width: "100%", padding: 8 }}>Clear previous availability details</button>
        </details>
      )}
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
  const { t: tr } = useTranslation();
  const [pickerValue, setPickerValue] = useState("");
  const [pendingLabel, setPendingLabel] = useState("");
  // CHANGED — Phase 2 encryption groundwork: ContactRepository went
  // async — these used to chain a property access straight onto the
  // (now-Promise) getById() call, same class of bug as Home's own
  // permission-nudge loader found earlier this session.
  const [linkedIds, setLinkedIds] = useLoadedState(async () => (await ContactRepository.getById(contactId))?.linkedContactIds || [], [contactId], []);
  const [labels, setLabels] = useLoadedState(async () => (await ContactRepository.getById(contactId))?.linkedContactLabels || {}, [contactId], {});
  const linked = allContacts.filter((c) => linkedIds.includes(c.id));
  // FIXED 28 Sep 2026 - Anonymise mode. This is the "link a contact"
  // picker; both the current chips and the <option> list rendered real
  // names with no flag check at all (the 28 Sep security review).
  const anonymise = useAnonymiseMode();
  const linkable = allContacts.filter((c) => c.id !== contactId && !linkedIds.includes(c.id));

  const labelSuggestions = useMemo(() => {
    const all = allContacts.flatMap((c) => Object.values(c.linkedContactLabels || {}));
    return Array.from(new Set(all)).sort((a, b) => a.localeCompare(b));
  }, [allContacts]);

  const confirmLink = async () => {
    if (!pickerValue) return;
    const label = pendingLabel.trim();
    await ContactRepository.linkContacts(contactId, pickerValue, label);
    setLinkedIds((prev) => [...prev, pickerValue]);
    if (label) setLabels((prev) => ({ ...prev, [pickerValue]: label }));
    refresh();
    setPickerValue("");
    setPendingLabel("");
  };
  const removeLink = async (id) => {
    await ContactRepository.unlinkContacts(contactId, id);
    setLinkedIds((prev) => prev.filter((x) => x !== id));
    setLabels((prev) => { const { [id]: _removed, ...rest } = prev; return rest; });
    refresh();
  };

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>{tr("contacts.linkedContacts", "Linked contacts (e.g. couples)")}</div>
      {linked.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          {linked.map((c) => (
            <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} key={c.id} onClick={() => removeLink(c.id)}
              style={{ padding: "6px 10px", borderRadius: radius.sm, fontSize: 12, background: T.surfaceVariant, color: T.textPrimary, cursor: "pointer", minHeight: 44, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{displayName(c, anonymise)}{labels[c.id] ? ` — ${labels[c.id]}` : ""}</span>
              <X size={11} />
            </div>
          ))}
        </div>
      )}
      {linkable.length > 0 && (
        <>
          <select value={pickerValue} onChange={(e) => setPickerValue(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontSize: TYPE.control.fontSize, marginBottom: pickerValue ? 6 : 0 }}>
            <option value="">+ Link another contact</option>
            {linkable.map((c) => <option key={c.id} value={c.id}>{displayName(c, anonymise)}</option>)}
          </select>
          {pickerValue && (
            <div>
              {/* CHANGED — real ask: the native `list`/`<datalist>`
                  dropdown (removed here) could render on top of the
                  on-screen keyboard on Android WebView. Visible chips
                  from previously-used labels instead. */}
              {labelSuggestions.filter((s) => s !== pendingLabel).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
                  {labelSuggestions.filter((s) => s !== pendingLabel).slice(0, 8).map((s) => (
                    <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} key={s} onClick={() => setPendingLabel(s)}
                      style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 12, border: `1px solid ${T.contactsTeal}`, color: T.contactsTeal, cursor: "pointer"}}>
                      {s}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 6 }}>
              <input value={pendingLabel} onChange={(e) => setPendingLabel(e.target.value)}
                placeholder="Relationship (optional) — e.g. Dom/Sub, bf/gf"
                style={{ flex: 1, padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontSize: 12, boxSizing: "border-box" }} />
              <button onClick={confirmLink} style={{ ...btnStyle(T.contactsTeal, "filled"), flex: "0 0 auto", padding: "8px 14px" }}>{tr("contacts.link", "Link")}</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}


// ADDED 10 Sep 2026 — real ask: show ONE icon for "how we'd meet up"
// instead of stacking every mode a contact has — ranked Car (Drives)
// > Cycle > Public transport > Walk, highest tier only. `drives` (the
// older, plain boolean field, predates `travelMode`) is folded in as
// an alias for travelMode's own "Car" tier so a contact set up before
// `travelMode` existed still shows correctly — not deprecated, just no
// longer the only source. Taxi (a real travelMode option) isn't part
// of this ranking — it wasn't named in the ask and doesn't obviously
// rank against the other four — still visible in the profile detail's
// own full Travel mode list, just not promoted to a card icon.
const TRANSPORT_TIERS = [
  { test: (c) => travelsByCar(c), Icon: Car, label: "Drives" },
  { test: (c) => (c.travelMode || []).includes("Cycle"), Icon: Bicycle, label: "Cycles" },
  { test: (c) => (c.travelMode || []).includes("Public transport"), Icon: Bus, label: "Uses public transport" },
  { test: (c) => (c.travelMode || []).includes("Walk"), Icon: Walk, label: "Walks" },
];
function getTransportIcon(contact) {
  const tier = TRANSPORT_TIERS.find((t) => t.test(contact));
  return tier ? tier.Icon : null;
}
// ADDED — real audit finding (icon-only-UI affordance sweep): this
// card's own transport/hosts/linked/flagged icon row had no title,
// aria-label, or tap affordance at all, unlike the active-status dot
// right next to it — the same "icon-only UI needs an explanatory
// affordance" rule already applied to that dot, just never rolled out
// to its immediate siblings. Reuses that dot's own showStatusInfo
// toggle/caption rather than adding a separate toggle per icon.
function getTransportLabel(contact) {
  const tier = TRANSPORT_TIERS.find((t) => t.test(contact));
  return tier ? tier.label : null;
}

// ADDED 30 Sep 2026 (t053) - the contact status dot's EXPLANATION existed in two
// places: a `title` tooltip and the tap-to-reveal caption below the card. The
// active wording was already duplicated verbatim; the inactive wording differed
// ("No encounter in over N days" vs "Inactive - no encounter in over N days").
// Two spellings of one explanation, which is how the tap-to-reveal caption and
// the hover tooltip drift apart - and this app has no hover on a touchscreen, so
// the visible one is the one users actually read.
//
// `title` and `detail` are returned separately rather than one string, because
// the two surfaces genuinely want different lengths: a tooltip should be a
// fragment, the caption a full sentence.
function contactStatusCopy(isInactive, inactiveThresholdDays) {
  return isInactive
    ? {
        title: `No encounter in over ${inactiveThresholdDays} days`,
        detail: `Inactive - no encounter in over ${inactiveThresholdDays} days`,
      }
    : { title: "Active - a recent encounter is logged", detail: "Active - a recent encounter is logged" };
}

function ContactCard({ contact, onOpen, T, summary = EMPTY_ENCOUNTER_SUMMARY, anonymise = false, inactiveThresholdDays = 90, showRoleOnCards = false, showAvailabilityOnCards = false, activeFilters = null, selectMode = false, selected = false, onToggleSelected, onLongPress, onToggleFavourite }) {
  const { t: tr } = useTranslation();
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
    ...(activeFilters.drives && travelsByCar(contact) ? ["Drives"] : []),
    ...(activeFilters.availability ? [activeFilters.availability] : []),
  ] : [];
  const flaggedDontMeetAgain = contact.meetAgain === "No";
  // CHANGED 18 Aug 2026 — real feedback: the card was showing an icon
  // per detected contact method, and Fabguys/Fabswingers both mapped to
  // the same unlabeled Globe icon, so a contact with both filled showed
  // two identical icons with no way to tell what they meant. Worked
  // around at the time by only ever showing Phone/Snapchat on the card
  // — everything else stayed reachable one tap away on the full
  // profile, but wasn't visible at a glance here.
  // The card now shows the full deduplicated list using the reviewed
  // Android/PWA marks below; keep this aligned with the profile header.
  const methods = getContactableVia(contact);
  const methodsWithIcons = methods.filter((m) => platformIconFor(m));
  const availabilitySummary = showAvailabilityOnCards && !anonymise ? formatAvailabilitySummary(contact) : "";
  const missingRequiredLabels = anonymise ? [] : missingRequiredLabelsFor(contact, tr);
  const locationPostcode = anonymise ? "" : extractUkPostcode(contact.address);
  const statusTags = [
    ...matchedTags,
    ...(isContactIncomplete(contact) ? [tr("contacts.incomplete", "Incomplete")] : []),
  ];
  const relationshipTags = [
    ...(contact.relationshipType || []),
    ...((showRoleOnCards && !anonymise) ? (contact.bdsmRole || []) : []),
    ...((showRoleOnCards && !anonymise) ? (contact.sexualPosition || []) : []),
  ];
  // Resolve the optional component in this scope, rather than declaring a
  // JSX component inside an inline IIFE. This also makes the no-icon case
  // explicit in React's render tree.
  const transportIconComponent = getTransportIcon(contact);
  const transportLabel = getTransportLabel(contact);
  // ADDED 18 Aug 2026 — real "active" status, replacing the leading dot
  // that used to just be a fixed decorative teal bullet. DEFINITION,
  // a judgment call flagged explicitly since the user's ask didn't specify
  // one: an encounter within the last 90 days counts as active. A
  // contact with NO encounter history at all (brand new, nothing
  // logged yet) is NOT marked inactive — there's no evidence of
  // inactivity, just no history yet, so it stays the normal color.
  // Only a contact with a REAL gap since their last actual encounter
  // shows red. `summary` is precomputed once per list-render by the
  // caller (see contactEncounterSummaries in encounterCalculations.js —
  // a real perf fix, this used to call contactEncounterSummary(encounters,
  // contact.id) right here, a full encounters rescan per card, every
  // render) rather than a separate calculation.
  // FIXED 29 Sep 2026 (t020) - `lastInteraction` is an encounter date, i.e. a
  // STORED fake-UTC value, and it was being subtracted from the real clock as if
  // it were an instant. Off by up to a day in either direction, which matters
  // here more than most places: this figure decides the red "inactive" badge
  // against a user-configurable threshold, so being a day out is a contact
  // wrongly marked inactive at 89 days, or wrongly active at 91.
  const daysSinceLastInteraction = daysSinceStoredDay(summary.lastInteraction);
  // CHANGED 19 Aug 2026 — real ask: threshold is now configurable
  // (Settings → Preferences), was hardcoded at 90. Also real ask: a
  // manual override for a genuine one-off/anonymous contact that will
  // never recur — excludeFromActiveTracking skips the flag entirely
  // regardless of how long it's actually been.
  const isInactive = !contact.excludeFromActiveTracking && daysSinceLastInteraction !== null && daysSinceLastInteraction > inactiveThresholdDays;
  const statusCopy = contactStatusCopy(isInactive, inactiveThresholdDays);
  // ADDED 10 Sep 2026 — real audit finding: the dot's own explanation
  // only ever showed via a `title` hover tooltip, invisible on a real
  // touchscreen (no hover state) — so the colour meant nothing to
  // anyone but a desktop mouse user. Tapping the dot now shows the same
  // explanation inline instead, with stopPropagation so it doesn't also
  // open the contact's profile (the card's own onClick).
  const [showStatusInfo, setShowStatusInfo] = useState(false);
  // Rating is stored with its emoji embedded ("😍 Love") — just the
  // emoji character shows on the card, full label on the profile.
  const ratingEmoji = contact.rating ? contact.rating.split(" ")[0] : null;
  // ADDED 26 Aug 2026 — real ask: long-press to enter multi-select.
  // 500ms hold, works for both touch (phone) and mouse (desktop/
  // preview) — a real held-press, not just a tap, so it doesn't fire
  // on an ordinary quick tap that's meant to open the profile.
  const pressTimer = useRef(null);
  // CHANGED — real ask: long-press for select/multiselect fired too
  // easily. 750ms (1.5x the original 500ms), same across every module
  // using this pattern.
  // ADDED — real bug the user flagged: resting a finger on a card
  // while scrolling (or just scrolling slowly) still fired long-press,
  // since nothing was cancelling the pending timer on real finger
  // movement — only on lifting the finger or leaving the element
  // entirely. Now tracks where the touch actually started and cancels
  // the timer the moment it moves more than a few px, same threshold a
  // native scroll gesture would recognize — a genuinely stationary
  // hold still works exactly as before.
  const pressStartPos = useRef(null);
  const startPress = (e) => {
    if (e?.touches?.[0]) pressStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    pressTimer.current = setTimeout(() => onLongPress?.(contact.id), 750);
  };
  const cancelPress = () => { clearTimeout(pressTimer.current); pressStartPos.current = null; };
  const handleTouchMove = (e) => {
    if (!pressStartPos.current || !e.touches?.[0]) return;
    const dx = e.touches[0].clientX - pressStartPos.current.x;
    const dy = e.touches[0].clientY - pressStartPos.current.y;
    if (Math.hypot(dx, dy) > 10) cancelPress();
  };
  const handleClick = () => {
    if (selectMode) onToggleSelected?.(contact.id);
    else onOpen(contact.id);
  };
  const cardLabel = anonymise ? MASKED : displayName(contact);
  // ADDED 6 Oct 2026 (t080) - a subtle gold accent on a favourited card.
  //
  // ONE CONSTANT, because the star above already hardcodes the same gold and the
  // two drifting apart would be the arrival of two different "this is a favourite"
  // colours on one card.
  //
  // Deliberately weak. A favourite is already marked three ways that need no
  // colour at all: it sorts to the top of every sort mode, the star is filled
  // rather than outlined, and the star's accessible label states the state. So
  // this is a findable-at-a-glance cue, not the signal - it is a 10%-alpha tint
  // and a hairline border, and nothing about the record's meaning depends on it.
  //
  // SELECTION STILL WINS, because a checkbox the user is looking at must not be
  // overridden by a stored preference; and flagged never reaches here at all,
  // since the red border is already a stronger "do not meet again" signal.
  const GOLD = "#E8A33D";
  return (
    <div onClick={handleClick} onMouseDown={startPress} onMouseUp={cancelPress} onMouseLeave={cancelPress} onTouchStart={startPress} onTouchMove={handleTouchMove} onTouchEnd={cancelPress}
      style={{ position: "relative", width: "100%", boxSizing: "border-box", background: selected ? `${T.contactsTeal}10` : contact.favourited && !selected ? `${GOLD}0A` : T.surface, border: `1px solid ${selected ? T.contactsTeal : flaggedDontMeetAgain ? T.actionRed : contact.favourited ? GOLD : T.border}`, borderRadius: radius.md, padding: 16, cursor: "pointer", display: "flex", flexDirection: "column", gap: 4, alignItems: "stretch"}}>
      {/* ADDED 17 Sep 2026 — real fix for a genuine axe `nested-interactive`
          violation: this card used to be role="button" itself, with the
          status dot below ALSO role="button" — an interactive widget
          nested inside another interactive widget, invalid per WAI-ARIA
          and unreliable for keyboard/screen-reader users. A real click
          anywhere on the card still works via ordinary event bubbling to
          this div's own onClick above (unaffected by this change) — this
          invisible button exists purely to give keyboard/screen-reader
          users the equivalent single-tab-stop "open profile" action,
          without making the whole card itself an interactive ancestor of
          the dot's own, separately-focusable toggle. Negative z-index so
          real content (name, dot, icons) always paints above it and keeps
          capturing its own clicks/taps first. */}
      <button type="button" onClick={handleClick} aria-label={cardLabel}
        {...(selectMode ? { role: "checkbox", "aria-checked": selected } : {})}
        style={{ position: "absolute", inset: 0, zIndex: -1, opacity: 0, border: "none", background: "transparent", padding: 0, margin: 0, cursor: "pointer", borderRadius: radius.md, display: "flex", alignItems: "center", justifyContent: "center"}} />
      {/* ADDED 26 Aug 2026 — real ask: favourite contacts, star icon
          per the user's preference over a pin. Own click handler with
          stopPropagation so tapping the star toggles the favourite
          without also opening the profile (the card's own onClick).

          FIXED 29 Sep 2026 (t019, icon-only-UI audit): this was a bare <div>
          with an onClick and no semantics at all — no role, no tabIndex, no
          aria-label, no key handler. A keyboard user could not reach it and a
          screen reader announced nothing at all. It survived the 17 Sep
          nested-interactive fix on this same card, which is the lesson: that
          fix moved the CARD's semantics and nobody looked at the controls
          sitting inside it.

          Now a real <button>. That is safe here specifically BECAUSE of that
          earlier fix — the card's own button is a SIBLING at zIndex -1, not an
          ancestor, so a button here is not a button inside a button. Before
          that change a <button> here would have been exactly the
          nested-interactive violation, so this is the two fixes being
          complementary rather than either being wrong.

          The label states the ACTION and the resulting STATE ("Add … to
          favourites" / "Remove … from favourites") rather than just "favourite",
          because a screen-reader user otherwise cannot tell which way pressing
          it will go. No tap-to-reveal caption is added: fill-vs-outline and
          gold-vs-grey are two independent channels already, so the state is
          not conveyed by colour alone, and a star-as-favourite is about as
          universal as the gear and person the rule already carves out. */}
      {!selectMode && onToggleFavourite && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleFavourite(contact.id); }}
          aria-label={contact.favourited
            ? `Remove ${contact.name} from favourites`
            : `Add ${contact.name} to favourites`}
          style={{ position: "absolute", top: 10, right: 10, zIndex: 2, cursor: "pointer", background: "transparent", border: "none", padding: 2, lineHeight: 0, color: "inherit", display: "flex", alignItems: "center", justifyContent: "center"}}>
          <Star size={17} weight={contact.favourited ? "fill" : "regular"} color={contact.favourited ? "#E8A33D" : T.textDisabled} />
        </button>
      )}
      {/* CHANGED 5 Nov 2026 — real report: "spacing still erroneous and
          inconsistent". The card was a column, so the select checkbox and the
          photo each took a full row ABOVE the name, and every sub-line below
          carried its own ad-hoc marginTop (2, 0, 4, 4, 4, 4). One identity row
          — checkbox, photo and the text block side by side — plus a single
          gap on the text column is what makes the rhythm uniform. */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, width: "100%", minWidth: 0 }}>
      {selectMode && (
        <div style={{ width: 22, height: 22, borderRadius: radius.full, border: `2px solid ${selected ? T.contactsTeal : T.border}`, background: selected ? T.contactsTeal : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
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
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
      {/* FIXED 6 Oct 2026 (t076) - two real layout defects on this row, both
          caused by the same thing: it is a flex row of inline items with no
          reserved space and no wrapping.

          The favourite star is position:absolute top:10 right:10, so anything
          wide enough ran UNDER it rather than around it. paddingRight reserves
          the star's footprint, and it is conditional so a card with no star (or
          in select mode, where a checkbox occupies the left instead) does not
          carry dead space.

          flexWrap lets a long name drop to a second line instead of being
          squeezed to nothing, which is what "two-line long-name layout" means
          here: the NAME wraps, the small icons after it stay on one line. */}
      {/* The name, its facts and the byline are one unit: the line and the
          byline share a column, so the 44 px method-icon row can centre the
          whole unit without opening a gap between the name and the byline. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingRight: (!selectMode && onToggleFavourite) ? 24 : 0 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
        <span role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={(e) => { e.stopPropagation(); setShowStatusInfo((v) => !v); }}
          title={statusCopy.title}
          aria-label={isInactive ? "Inactive contact, tap for details" : "Active contact, tap for details"}
          style={{ width: 8, height: 8, borderRadius: radius.full, background: isInactive ? T.actionRed : T.actionGreen, cursor: "pointer", boxShadow: showStatusInfo ? `0 0 0 4px ${isInactive ? T.actionRed : T.actionGreen}33` : "none", alignItems: "center", justifyContent: "center"}} />
        <span style={{ fontFamily: FONT_FAMILY, fontWeight: 600, fontSize: 15, color: T.textPrimary }}>{anonymise ? MASKED : displayName(contact)}</span>{contact.isDemo && <span style={{ fontSize: 9, fontWeight: 700, color: "#FFFFFF", background: T.textDisabled, borderRadius: 4, padding: "1px 4px", marginLeft: 6, verticalAlign: "middle" }}>{tr("common.demo", "DEMO")}</span>}
        {/* Age — tuned this round to sit close in size to the name (was
            too small a jump, 12px vs 15px reading as a much bigger drop
            than intended). Now 14px, one step down, not two.
            FIXED 6 Oct 2026 (t077) - the guard was `contact.age != null`,
            which renders a bare separator dot with no number beside it whenever
            age is "", a non-numeric string or NaN. The editor normalises ""
            to null on change, so this never appeared while typing - but a
            record from a backup import, a shared profile, or an older build can
            carry one, and then the card shows a dot and nothing after it. */}
        {displayableAge(contact) != null && <span style={{ fontSize: 14, color: T.textSecondary }}>· {contact.ageIsApprox ? "≈" : ""}{displayableAge(contact)}</span>}
        {/* ADDED 10 Sep 2026 — real ask: "use pin next to city" — a
            literal location pin, always shown alongside the city name
            (distinct from the "will travel to you" NavigationArrow
            below, a different fact about a different thing). */}
        {(contact.city || locationPostcode) && !anonymise && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 12, color: T.textSecondary }}>
            <MapPin size={12} /> {[contact.city, locationPostcode].filter(Boolean).join(" · ")}
          </span>
        )}
        {/* Rating emoji at the END of the name line, after age + city — the
            name is followed directly by the age, per the owner's ask. */}
        {ratingEmoji && <span style={{ fontSize: 14, flex: "0 0 auto" }}>{ratingEmoji}</span>}
      </div>
        {/* ADDED 5 Nov 2026 — real ask: "pronouns missing on contacts -
            small byline undername extracted from profile details". The
            profile sheet has always shown pronouns (gender + pronouns,
            now in its own section); the list card did not, so the two
            views disagreed. Anonymise mode hides it with the other
            identity fields. It now sits as the second line of the name
            block, flush-left with the name row — no extra indent. */}
        {!anonymise && contact.pronouns && (
          <div style={{ fontSize: 10, fontWeight: 500, color: T.textSecondary, lineHeight: 1.3, marginTop: -1 }}>{contact.pronouns}</div>
        )}
      </div>
      {/* Transport & accommodation icons intentionally NOT rendered inline on
          the left-hand side — they'd widen the name block and squeeze the
          name/pronouns line. Hosts/travels/outdoors/linked/dont-meet-again are
          still reachable by tapping the active dot (opens showStatusInfo).
          Social badges stay on the right-hand column via MethodIcons below. */}
      </div>
      {showStatusInfo && (() => {
        const transportLabel = getTransportLabel(contact);
        const lines = [statusCopy.detail];
        if (transportLabel) lines.push(transportLabel);
        if (contact.hosts === "Yes") lines.push("Hosts meetups");
        else if (contact.travels === "Yes") lines.push("Will travel to you");
        if (contact.linkedContactIds.length > 0) lines.push("Linked to another contact");
        if (flaggedDontMeetAgain) lines.push("Flagged: do not meet again");
        return (
          <div onClick={(e) => e.stopPropagation()} style={{ fontSize: 11, color: isInactive ? T.actionRed : T.actionGreen, fontWeight: 600, marginLeft: 16 }}>
            {lines.map((l, i) => (
              <div key={i} style={{ color: (l === "Flagged: do not meet again") ? T.actionRed : T.textSecondary, fontWeight: i === 0 ? 600 : 500 }}>{l}</div>
            ))}
          </div>
        );
      })()}
      {/* Status & social chips — inline row(s), flush-left with the name.
          When 1-2 social icons they sit inline with the status chips;
          when 3+ they wrap into a second line (2x2 grid feel). */}
      {/* Status & social chips — social icons stay on the right-hand column,
          status/relationship tags flush-left. Minimal vertical gaps. */}
      {(statusTags.length > 0 || relationshipTags.length > 0 || methodsWithIcons.length > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 4, minWidth: 0 }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
              {matchedTags.map((tag) => <span key={`match-${tag}`} style={{ fontSize: 10, fontWeight: 700, color: "#FFFFFF", background: T.contactsBanner, borderRadius: radius.full, padding: "2px 8px" }}>{tag}</span>)}
              {isContactIncomplete(contact) && <span style={{ fontSize: 10, fontWeight: 700, color: T.actionRed, border: `1px solid ${T.actionRed}`, borderRadius: radius.full, padding: "2px 8px" }}>{tr("contacts.incomplete", "Incomplete")}</span>}
              {missingRequiredLabels.length > 0 && <span aria-label={`${tr("contacts.missingRequiredDetails", "Missing mandatory details")}: ${missingRequiredLabels.join(", ")}`} style={{ fontSize: 9, fontWeight: 700, color: T.actionRed, lineHeight: 1.35 }}>{tr("contacts.missingRequiredDetails", "Missing mandatory details")}: {missingRequiredLabels.map((label) => `* ${label}`).join(", ")}</span>}
            </div>
            {relationshipTags.length > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
                {contact.relationshipType.map((value) => <span key={`rel-${value}`} style={{ fontSize: 10, fontWeight: 600, color: T.textSecondary, background: T.surfaceVariant, borderRadius: radius.full, padding: "2px 8px" }}>{value}</span>)}
                {showRoleOnCards && !anonymise && (contact.bdsmRole || []).map((value) => <span key={`role-${value}`} style={{ fontSize: 10, fontWeight: 600, color: T.textSecondary, background: T.surfaceVariant, borderRadius: radius.full, padding: "2px 8px" }}>{value}</span>)}
                {showRoleOnCards && !anonymise && (contact.sexualPosition || []).map((value) => <span key={`position-${value}`} style={{ fontSize: 10, fontWeight: 600, color: T.textSecondary, background: T.surfaceVariant, borderRadius: radius.full, padding: "2px 8px" }}>{value}</span>)}
              </div>
            )}
          </div>
          {methodsWithIcons.length > 0 && <MethodIcons methods={methods} T={T} style={{ flexShrink: 0, alignSelf: "flex-start" }} />}
        </div>
      )}
      {availabilitySummary && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, color: T.textSecondary, fontSize: 11, lineHeight: 1.35 }}>
          <Clock size={13} color={T.contactsTeal} aria-hidden="true" />
          <span>{availabilitySummary}</span>
        </div>
      )}
      {flaggedDontMeetAgain ? (
        <div style={{ fontSize: 12, color: T.actionRed, fontWeight: 600 }}>{tr("contacts.dontMeetAgain", "Don't meet again")}</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5, fontSize: 11, color: T.textDisabled, fontStyle: summary.lastInteraction ? "normal" : "italic" }}>
          {anonymise ? <span>Activity hidden</span> : summary.count > 0 && <strong style={{ color: T.textSecondary, fontWeight: 600 }}>{summary.count} {summary.count === 1 ? "encounter" : "encounters"}</strong>}
          {!anonymise && summary.averageEnjoyment != null && <span><span style={{ color: "#D978AD" }}>♥</span> {Math.round(summary.averageEnjoyment)}/100 avg.</span>}
          {!anonymise && summary.lastInteraction && <span>Last met {formatRelativeDate(summary.lastInteraction)}</span>}
          {!anonymise && !summary.lastInteraction && summary.count === 0 && <span>No encounters logged yet</span>}
        </div>
      )}
      </div>
      </div>
    </div>
  );
}

// ── Add/Edit sheet — every section now lives inside its own SectionCard
// (outlined box), per the user's ask. Location & logistics reordered to:
// Hosts, Travels, Address, City, Drives (+ car details), Availability,
// availability exceptions, Readily available. ──
// FIXED 10 Sep 2026 — real ESLint finding: was defined inside
// ContactEditSheet's own body, so the useMemo below that filters
// against it was getting a fresh array identity every render — its
// memoization was a no-op. Hoisted to module scope (a pure literal, no
// dependency on props/state).
const REDUNDANT_PLATFORM_SUGGESTIONS = ["phone", "email", "snapchat", "fabguys", "fabswingers", "recon"];
function contactNotesPlaceholder(form) {
  const ideas = [];
  if (!Array.isArray(form.howDidWeMeet) || form.howDidWeMeet.length === 0) ideas.push("Context around how you met (beyond a short tag)");
  ideas.push("A preference, boundary or conversation detail not captured in the fields above");
  ideas.push("A follow-up or reminder for next time");
  return `Optional notes — only add what is useful:\n${ideas.map((idea) => `• ${idea}`).join("\n")}`;
}

function ContactEditSheet({ contact, contacts, onSave, onClose, refresh, T, onOpenGlossary }) {
  const { t: tr } = useTranslation();
  useEscapeToClose(onClose);
  // FIXED 28 Sep 2026 — Anonymise mode. The duplicate warning below named the
  // OTHER contact, so opening any contact's edit sheet while masking would have
  // printed a second real name on a surface the review found was unmasked.
  const anonymise = useAnonymiseMode();
  // ADDED 29 Sep 2026 (t025) — the only way a contact's HIV status gets set.
  // On the read view it is shown masked under Anonymise mode; the EDIT sheet
  // is deliberately not additionally gated, because entering it is already an
  // explicit act by the owner on their own record, exactly the same reasoning
  // the sheet's own comment above records for a contact's real name.
  const isNew = !contact;
  const editSheetRef = useRef(null);
  useEffect(() => { editSheetRef.current?.focus(); }, []);
  const [activeFormTab, setActiveFormTab] = useState(CONTACT_EDIT_TABS[0].key);
  // ADDED 19 Aug 2026 — draft autosave, real fix for a real gap the user
  // flagged: in-progress edits used to live only in this component's
  // memory, gone on any refresh. draftKey is scoped per-contact (or
  // "new" for a fresh add) so editing one contact never clobbers a
  // leftover draft for a different one.
  const draftKey = `contactEdit_${contact?.id || "new"}`;
  // ADDED 26 Aug 2026 — real ask: Relationship type now editable,
  // same pattern as Vaccinations' vaccineOptions.
  // getRanked, not get: suggestion chips surface newly-added and
  // most-frequently-picked options first (real ask, 3 Sep 2026).
  const [relationshipTypeOptions, setRelationshipTypeOptions] = useLoadedState(() => CustomOptionListsRepository.getRanked("relationshipType"), [], []);
  const [genderOptions, setGenderOptions] = useLoadedState(() => CustomOptionListsRepository.getRanked("gender"), [], []);
  const [pronounsOptions, setPronounsOptions] = useLoadedState(() => CustomOptionListsRepository.getRanked("pronouns"), [], []);
  const [contraceptionOptions, setContraceptionOptions] = useLoadedState(() => CustomOptionListsRepository.getRanked("contraception"), [], []);
  // ADDED 11 Sep 2026 — real gap found (a demographics audit): the
  // Contraception field's own gender gate below is an exact match
  // against "female"/"trans-male" only, by deliberate design (see that
  // gate's own comment — this app shouldn't presume either way for a
  // non-binary gender) — but that left NO way at all for anyone typing
  // a different gender to ever reveal the field, a real functional
  // exclusion, not just wording, since Gender is free text. Same
  // "never presume, but never structurally block" fix already used for
  // the Pregnancy tab's own gender-based default (its own "Show
  // pregnancy tracking anyway" link) — ephemeral, local-only state,
  // not a new persisted field; defaults open if there's already real
  // data to show.
  const [revealContraceptionAnyway, setRevealContraceptionAnyway] = useState(false);
  // FIXED 27 Sep 2026 — the "Physical & health" fields were hidden entirely
  // for gender "female" with no way back, while the Contraception gate
  // directly below this sheet has had a "+ Track anyway" link since 11 Sep.
  // Same principle, applied to one gate and not the other in the same file:
  // don't presume, but never structurally block. A user whose Gender is
  // "female" — including a cis woman with a penis, or anyone who set Gender
  // early and later decided to record these — otherwise had NO path in the
  // entire UI to length/girth/foreskin/chastity/ejaculation. This state is
  // ephemeral component state, not a persisted field, matching that gate.
  const [revealPhysicalAnyway, setRevealPhysicalAnyway] = useState(false);
  // CHANGED — Phase 2 encryption groundwork: KinkRegistry is now async
  // — resolved once here for the Stated kinks/Limits overlap-warning
  // check below.
  const kinkNameById = useLoadedMemo(async () => new Map((await KinkRegistry.getAll()).map((k) => [k.id, k.name])), [], new Map());
  const [form, setForm] = useState(() => contact ? { ...contact } : { ...DEFAULT_CONTACT });
  const [draftRestored, setDraftRestored] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadDraft(draftKey).then((draft) => {
      if (cancelled) return;
      if (draft) {
        setForm({ ...DEFAULT_CONTACT, ...draft.data });
        setDraftRestored(true);
      }
    });
    return () => { cancelled = true; };
  }, [draftKey]);
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
  const missingRequiredFields = getMissingRequiredContactFields(form);
  const missingRequiredLabels = missingRequiredLabelsFor(form, tr);
  const emailValid = !form.email?.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const timeZoneValid = !form.availabilityTimeZone || isValidTimeZone(form.availabilityTimeZone);
  const weeklyRulesValid = (form.weeklyAvailability || []).every((rule) => !(rule.days || []).length || isValidAvailabilityWindow(rule));
  const canSave = missingRequiredFields.length === 0 && emailValid && timeZoneValid && weeklyRulesValid;
  // ADDED 26 Aug 2026 — real ask: duplicate detection. Warns, doesn't
  // block — two genuinely different people can share a first name —
  // but flags it so an actual accidental double-entry gets caught
  // before it happens instead of discovered later as two separate
  // records for the same person.
  const possibleDuplicate = useMemo(() => {
    const nameLower = form.name.trim().toLowerCase();
    const nicknameLower = (form.nickname || "").trim().toLowerCase();
    if (!nameLower && !nicknameLower) return null;
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
    onSave({
      ...form,
      availabilityTimeZone: hasWeeklyAvailability(form) ? (form.availabilityTimeZone || getDeviceTimeZone()) : form.availabilityTimeZone,
    });
  };

  const cityOptions = useMemo(() => getKnownCities(contacts), [contacts]);
  // CHANGED 18 Aug 2026 — real duplication the user flagged: Phone/Snapchat
  // (and Fabguys/Fabswingers) have their own dedicated fields above this
  // one, but historically-typed values from before those fields existed
  // were still being suggested here via getKnownValues. Filtered out
  // explicitly rather than relying on historical data staying clean —
  // these four are always redundant with the dedicated fields, so there's
  // no case where suggesting them here is correct.
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
    <div role="dialog" aria-label={isNew ? "Add contact" : "Edit contact"} ref={editSheetRef} tabIndex={0} style={{ position: "fixed", inset: 0, paddingBottom: "env(safe-area-inset-bottom)", paddingTop: "env(safe-area-inset-top)", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 200 }} onClick={onClose}>
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
        <div style={{ background: T.contactsBanner, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 14px", flexShrink: 0, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
          <span style={{ fontFamily: FONT_FAMILY, ...TYPE.sheetTitle, color: "#FFFFFF" }}>{isNew ? tr("contacts.addContact", "Add contact") : tr("contacts.editContact", "Edit contact")}</span>
          <X size={20} color="#FFFFFF" role="button" tabIndex={0} style={{ cursor: "pointer", padding: 12, boxSizing: "content-box", marginTop: -12, marginRight: -12, marginBottom: -12, marginLeft: -12}} onClick={onClose} aria-label="Close"
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClose(); } }} />
        </div>
        {draftRestored && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, margin: "0 20px 8px", fontSize: 11, color: T.actionGreenText, background: `${T.actionGreen}15`, borderRadius: radius.sm, padding: "6px 10px", flexShrink: 0 }}>
            <span>{tr("contacts.draftRestored", "Restored unsaved changes from earlier.")}</span>
            {/* ADDED 19 Aug 2026 — the user's ask: a way to discard a
                restored draft and start clean instead of continuing it. */}
            <span onClick={() => { clearDraft(draftKey); setForm(contact ? { ...contact } : { ...DEFAULT_CONTACT }); }} role="button" tabIndex={0} aria-label="Clear restored draft and start fresh" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); clearDraft(draftKey); setForm(contact ? { ...contact } : { ...DEFAULT_CONTACT }); } }}
              style={{ fontWeight: 700, cursor: "pointer", textDecoration: "underline", flexShrink: 0}}>
              Clear & start fresh
            </span>
          </div>
        )}

        <div tabIndex={0} style={{ overflowY: "auto", padding: "0 20px", flex: 1 }}>
        <FormTabs tabs={CONTACT_EDIT_TABS} activeKey={activeFormTab} onChange={setActiveFormTab}
          ariaLabel="Contact form sections" accent={T.contactsTeal} accentText={T.contactsTealText}
          textColor={T.textSecondary} border={T.border} surface={T.bg}>
        <div>
        <SectionCard T={T} title="Identity">
          <PhotoPicker T={T} value={form.profilePicture} onChange={set("profilePicture")} />
          {missingRequiredLabels.length > 0 && (
            <div role="alert" style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "8px 10px", margin: "2px 0 8px", borderRadius: radius.sm, border: `1px solid ${T.actionRed}`, background: `${T.actionRed}12`, color: T.actionRed, fontSize: 11, lineHeight: 1.4 }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{tr("contacts.missingRequiredDetails", "Missing mandatory details")}: {missingRequiredLabels.join(", ")}. Add these, or acknowledge an intentionally incomplete/anonymous record below.</span>
            </div>
          )}
          <TextField T={T} label="Full name" value={form.name} onChange={set("name")} placeholder="Full name" requiredMissing={missingRequiredFields.includes("identity")} />
          {possibleDuplicate && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: radius.sm, background: T.actionAmberSurface, marginTop: -4, marginBottom: 8 }}>
              <AlertTriangle size={13} color={T.actionAmberText} />
              {/* FIXED 28 Sep 2026 — Anonymise mode. The warning itself is
                  still shown, because "you may already have this person" is
                  useful to know, but the OTHER person's name is not: this
                  renders inside the edit sheet, which the review flagged as a
                  surface that a masked contact could be opened into. */}
              <span style={{ fontSize: 12, color: T.actionAmberText }}>
                Possible duplicate{anonymise ? "" : ` of "${possibleDuplicate.nickname || possibleDuplicate.name}"`} — check before saving a second entry.
              </span>
            </div>
          )}
          <TextField T={T} label="Nickname (shown instead of name, if set)" value={form.nickname} onChange={set("nickname")} placeholder="Optional" requiredMissing={missingRequiredFields.includes("identity")}
            helper={missingRequiredFields.includes("identity") ? "Either a full name or a nickname satisfies this requirement." : undefined} />
          {/* ADDED — real ask: trans-inclusive, non-judgemental — free
              text, not a fixed dropdown of "approved" options. */}
          <SuggestField T={T} label="Gender" value={form.gender} onChange={set("gender")} options={genderOptions}
            onAddNew={(v) => CustomOptionListsRepository.add("gender", v).then(setGenderOptions)} placeholder="e.g. Male, Female, Non-binary" />
          {/* CHANGED — real ask, from a competitive-research finding:
              plain free text with no suggestions at all, the one field
              on this form that hadn't gotten the same SuggestField
              treatment Gender already has just above. Same "type
              anything, it just works" flexibility — this only adds
              suggestion chips, nothing is locked down. */}
          <SuggestField T={T} label="Pronouns" value={form.pronouns} onChange={set("pronouns")} options={pronounsOptions}
            onAddNew={(v) => CustomOptionListsRepository.add("pronouns", v).then(setPronounsOptions)} placeholder="e.g. he/him, she/her, they/them" />
          <AgeField T={T} age={form.age} ageIsApprox={form.ageIsApprox} onChangeAge={set("age")} onChangeApprox={set("ageIsApprox")} requiredMissing={missingRequiredFields.includes("age")} />
          {/* ADDED 26 Aug 2026 — real ask: moved to the top of the form
              rather than buried in Location & logistics — the override
              for the new required-field "Incomplete" tag deserves to
              be found easily, not stumbled on. */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
            <div style={{ flex: 1, paddingRight: 12 }}>
              <div style={{ fontSize: TYPE.control.fontSize, color: T.textPrimary }}>{tr("contacts.acknowledgeIncomplete", "Acknowledge incomplete / anonymous record")}</div>
              <div style={{ fontSize: 11, color: T.textDisabled, marginTop: 2 }}>{tr("contacts.acknowledgeIncompleteDesc", "I understand these mandatory details are missing. Hide the warnings and allow this intentionally incomplete or anonymous record to be saved.")}</div>
            </div>
            <ToggleSwitch T={T} value={form.markedComplete} onChange={set("markedComplete")} />
          </div>
        </SectionCard>

        <SectionCard T={T} title="Relationship">
          <SelectField T={T} label={tr("contacts.rating", "How do I feel about this person?")} value={form.rating} onChange={set("rating")} options={RATING_OPTIONS} />
          <MultiSelectChips T={T} label="Relationship type" value={form.relationshipType} onChange={set("relationshipType")} options={relationshipTypeOptions} listName="relationshipType"
            onAddNew={(v) => { CustomOptionListsRepository.add("relationshipType", v).then(setRelationshipTypeOptions); }} />
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
            <div style={{ flex: 1, paddingRight: 12, display: "flex", alignItems: "flex-start", gap: 8 }}>
              {/* ADDED 2 Sep 2026 — real ask: an icon for this "legacy"
                  concept — clock-counter-clockwise reads as "history/
                  looking back", matching what this toggle actually
                  means (a contact you're not tracking forward). */}
              <ClockCounterClockwise size={16} color={T.textSecondary} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: TYPE.control.fontSize, color: T.textPrimary }}>{tr("contacts.oneOff", "One-off / never expect to recur")}</div>
                <div style={{ fontSize: 11, color: T.textDisabled, marginTop: 2 }}>{tr("contacts.oneOffDesc", "Excludes this contact from the inactive flag entirely — for a genuine one-time encounter, not a gap you'd want flagged.")}</div>
              </div>
            </div>
            <ToggleSwitch T={T} value={form.excludeFromActiveTracking} onChange={set("excludeFromActiveTracking")} />
          </div>
        </SectionCard>
        </div>

        <div>
        <SectionCard T={T} title="Location & logistics">
          <SelectField T={T} label="Hosts" value={form.hosts} onChange={set("hosts")} options={HOSTS_OPTIONS} />
          <SelectField T={T} label="Travels" value={form.travels} onChange={set("travels")} options={TRAVELS_OPTIONS} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
            <span style={{ fontSize: TYPE.control.fontSize, color: T.textPrimary }}>Outdoor/public meetups</span>
            <ToggleSwitch T={T} value={!!form.outdoorMeetup} onChange={set("outdoorMeetup")} />
          </div>
          {(form.travels === "Yes" || form.travels === "Sometimes") && (
            <MultiSelectChips T={T} label="Travel mode" value={form.travelMode} onChange={(v) => { set("travelMode")(v); if (Array.isArray(v) && v.includes("Car")) set("drives")(true); }} options={TRAVEL_MODE_OPTIONS} />
          )}
          <AddressAutocomplete T={T} label="Address" value={form.address} onChange={set("address")}
            placeholder="Start typing an address..." onCityDetected={set("city")} />
          <ComboField T={T} label="City" value={form.city} onChange={set("city")} options={cityOptions} requiredMissing={missingRequiredFields.includes("city")} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
            <span style={{ fontSize: TYPE.control.fontSize, color: T.textPrimary }}>{tr("contacts.drives", "Drives")}</span>
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
          <WeeklyAvailabilityEditor
            T={T}
            weeklyRules={form.weeklyAvailability || []}
            onWeeklyRulesChange={set("weeklyAvailability")}
            exceptions={form.availabilityExceptions || []}
            onExceptionsChange={set("availabilityExceptions")}
            timeZone={form.availabilityTimeZone || ""}
            onTimeZoneChange={set("availabilityTimeZone")}
            legacy={form}
            onClearLegacy={() => setForm((f) => ({ ...f, availability: [], nonAvailabilityRules: [], readilyAvailable: "" }))}
          />
        </SectionCard>

        {/* REORDERED 17 Sep 2026 — real ask: "physical & health before
            kinks" — moved up ahead of Kink/Chems. */}
        <SectionCard T={T} title="Physical & health">
          {/* ADDED — real ask: these specific fields (not the whole
              section — Known to be on/Last tested below stay relevant
              regardless) are penis-specific, genuinely unnecessary
              when Gender is Female. Exact match only, NOT a substring
              match against "female" — deliberately does NOT hide for
              Trans-female, since anatomy varies enough there that
              presuming it away could hide something genuinely
              relevant. Nothing here is deleted, just not shown. */}
          {(form.gender?.trim().toLowerCase() !== "female" || revealPhysicalAnyway || hasPhysicalDetail(form)) && (
          <>
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
          <div style={{ fontSize: 11, color: T.textDisabled, marginTop: -6, marginBottom: 6 }}>{tr("contacts.chastityNote", "Only relevant if chastity is something they're genuinely into — leave as N/A otherwise.")}</div>
          <CummerRow T={T} label="Ejaculation — frequency" form={form} set={set} options={CUMMER_FREQUENCY_OPTIONS} />
          <CummerRow T={T} label="Ejaculation — volume" form={form} set={set} options={CUMMER_VOLUME_OPTIONS} />
          <CummerRow T={T} label="Ejaculation — style" form={form} set={set} options={CUMMER_STYLE_OPTIONS} />
          {/* ADDED 2 Nov 2026 — piercings and tattoos */}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <TextField T={T} label="Piercings" value={form.piercings} onChange={set("piercings")} placeholder="e.g. Prince Albert, nipple" />
            <TextField T={T} label="Tattoos" value={form.tattoos} onChange={set("tattoos")} placeholder="e.g. sleeve, tribal" />
          </div>
          </>
          )}
          {/* FIXED 27 Sep 2026 — the escape hatch this gate never had. Same
              shape and wording as the Contraception gate below, so the two
              gates in one sheet now behave identically. */}
          {form.gender?.trim().toLowerCase() === "female" && !revealPhysicalAnyway && !hasPhysicalDetail(form) && (
            <div role="button" tabIndex={0} onClick={() => setRevealPhysicalAnyway(true)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setRevealPhysicalAnyway(true); } }}
              style={{ fontSize: TYPE.control.fontSize, color: T.contactsTealText, cursor: "pointer", padding: "4px 0"}}>+ Record these details anyway</div>
          )}
          {/* ADDED — real ask: contraception, shown when Gender is
              Female or Trans-male (see the same gating condition used
              above and in My Profile). Testosterone is a suggestion
              option for tracking purposes only — it is NOT reliable
              contraception on its own.
              CHANGED 1 Sep 2026 — real ask: "allow for multiple, ie
              Testosterone + Implant." Was SuggestField (single value,
              picking a chip replaced whatever was there) — switched to
              MultiSelectChips, same toggle-multiple-on/off mechanism
              already proven for Cummer/PrEP-Doxy below, with its own
              onAddNew for a value not in the option list yet. */}
          {(["female", "trans-male"].includes((form.gender || "").trim().toLowerCase()) || (form.contraception && form.contraception.length > 0) || revealContraceptionAnyway) ? (
            <MultiSelectChips T={T} label="Contraception" value={form.contraception} onChange={set("contraception")} options={contraceptionOptions} listName="contraception"
              onAddNew={(v) => { CustomOptionListsRepository.add("contraception", v).then(setContraceptionOptions); }} />
          ) : (
            <div role="button" tabIndex={0} onClick={() => setRevealContraceptionAnyway(true)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setRevealContraceptionAnyway(true); } }}
              style={{ fontSize: TYPE.control.fontSize, color: T.contactsTealText, cursor: "pointer", padding: "4px 0"}}>+ Track contraception anyway</div>
          )}
          <MultiSelectChips T={T} label="Known to be on" value={form.knownPrepDoxy} onChange={set("knownPrepDoxy")} options={PREP_DOXY_OPTIONS} />
          <TextField T={T} label="Last tested date (if known)" value={form.lastTestedDate} onChange={set("lastTestedDate")} type="date" helper="Often unknown — leave blank, no pressure." />
          {/* ADDED 29 Sep 2026 (t025) — stated, never derived: see
              ContactProfile's own comment for why deriving a contact's status
              from the owner's own test records would be meaningless. The
              helper text says plainly that blank is a real answer here,
              because the alternative default puts an unverified claim on
              someone else's record.

              String options, matching this file's own SelectField (which
              renders `options.map(opt => <option value={opt}>)`) — the
              {value,label} shape used on My Profile is that file's own
              separate component, not a shared contract.

              CORRECTED 1 Oct 2026. That reasoning is what let the two
              implementations drift into two different bugs. My Profile's copy
              renders `{opt}` bare, so the one caller that passed {value,label}
              objects threw React error #31 on every open of My Profile -> Edit
              for three days. This file avoided that only by accident: it passed
              raw `o.value` CODES as strings, which render fine but showed the
              user `positive-suppressed` instead of "Positive - undetectable".
              Both copies now accept either shape, so this passes real labels —
              what is STORED is still the code, because onChange at the call
              site below matches on `o.value`, so no record changes shape. */}
          <SelectField
            T={T}
            label="HIV status (if known)"
            value={form.hivStatus || ""}
            onChange={(v) => set("hivStatus")(HIV_STATUS_OPTIONS.find((o) => o.value === v) ? v : null)}
            options={[...HIV_STATUS_OPTIONS, "Not known / not recorded"]}
            helper="Only what you actually know."
          />
          {/* ADDED 1 Oct 2026 - unconditional, same reason as the read view: a
              note that appeared only for positive-undetectable contacts would
              identify them. */}
          <HivStatusNote T={T} label="HIV status" onOpen={onOpenGlossary} />
          {/* ADDED 1 Oct 2026 - a contact's status is STATED, not derived, so
              there is no test record here to date it from. Rather than force a
              test date the user does not have, or record a status that reads as
              if it were verified, the two are kept apart: this is when the user
              was TOLD, and the standing disclaimer says plainly that it is not
              the date of a test and may be out of date. An alternative review
              argued a status without a date is worse than no status at all -
              true for what is EXPORTED to someone else, which never sends a bare
              undated claim - but refusing to record it here would lose the fact
              entirely, and a fact that was never written down cannot be
              qualified by any disclaimer. */}
          <TextField
            T={T}
            label="Date informed"
            type="date"
            value={form.hivStatusInformedDate || ""}
            onChange={set("hivStatusInformedDate")}
            helper="When they told you - not when they were tested. This information may be out of date."
          />
        </SectionCard>
        </div>

        <div>
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
            const overlapping = form.limits.filter((l) => statedIds.has(l.kinkId)).map((l) => kinkNameById.get(l.kinkId)).filter(Boolean);
            return overlapping.length > 0 ? (
              <div style={{ display: "flex", gap: 6, padding: "8px 0", alignItems: "flex-start" }}>
                <AlertTriangle size={13} color={T.actionRed} style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 11, color: T.actionRed, lineHeight: 1.4 }}>
                  Listed as both a stated kink and a limit: {overlapping.join(", ")}. Left as-is — worth a second look, not necessarily wrong.
                </span>
              </div>
            ) : null;
          })()}
          <MultiSelectChips T={T} label="Role" value={form.bdsmRole} onChange={set("bdsmRole")} options={CONTACT_BDSM_ROLE_OPTIONS} requiredMissing={missingRequiredFields.includes("role")} exclusiveOption={UNKNOWN_CONTACT_OPTION} />
          <div style={{ color: missingRequiredFields.includes("role") ? T.actionRed : T.textDisabled, fontSize: 10, marginTop: -3 }}>Choose one or more roles, or mark this field “Unknown / not discussed”.</div>
          {/* ADDED 9 Oct 2026 (t052) — these chips read "Dom / Switch / sub"
              with a label of "Role", and the Position chips directly below use a
              different vocabulary for a different question. A reader cannot tell
              that from the labels alone. Same note as Encounters' kink roles,
              and the same shared copy. */}
          <JargonNote theme={T} noteKey="role-axes" label="Role" onOpen={onOpenGlossary} />
          <MultiSelectChips T={T} label="Position" value={form.sexualPosition} onChange={set("sexualPosition")} options={CONTACT_SEXUAL_POSITION_OPTIONS} requiredMissing={missingRequiredFields.includes("position")} exclusiveOption={UNKNOWN_CONTACT_OPTION} />
          <div style={{ color: missingRequiredFields.includes("position") ? T.actionRed : T.textDisabled, fontSize: 10, marginTop: -3 }}>Choose one or more positions, or mark this field “Unknown / not discussed”.</div>
        </SectionCard>

        {/* Own section, not folded into Kink — Notion keeps the Chems
            Registry architecturally separate (neutral grey domain, not
            kink-red, per Doc 2), so the app mirrors that distinction. */}
        <SectionCard T={T} title="Chems">
          <RegistryTagPicker T={T} label="Known chems" value={form.knownChems} onChange={set("knownChems")} registry={ChemsRegistry} placeholder="e.g. Alcohol, Weed, Poppers, Coke, LSD" resolveSynonym={resolveChemSynonym} />
        </SectionCard>

        {/* REORDERED 17 Sep 2026 — real ask: "contact methods second to
            last, before notes" — moved down from its earlier position
            right after Basics (see the 19 Aug 2026 reasoning that used
            to live here) to sit right before Notes instead. */}
        <SectionCard T={T} title="Contact methods">
          <TextField T={T} label="Phone/WhatsApp" value={form.phone} onChange={set("phone")} placeholder="e.g. +44 7700 900123" />
          <TextField T={T} label={tr("contacts.email", "Email")} value={form.email} onChange={set("email")} placeholder="name@example.com" type="email" helper={emailValid ? "Optional contact method." : tr("contacts.emailInvalid", "Enter a valid email address or leave it blank.")} />
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

        <SectionCard T={T} title="Notes">
          <textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} rows={4} aria-label="Notes" placeholder={contactNotesPlaceholder(form)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: FONT_FAMILY, fontSize: TYPE.control.fontSize, boxSizing: "border-box", resize: "vertical" }} />
        </SectionCard>

        <SectionCard T={T} title="Linked contacts">
          {form.id ? (
            <LinkedContactsField T={T} contactId={form.id} allContacts={contacts} refresh={refresh} />
          ) : (
            <div style={{ fontSize: 12, color: T.textSecondary, fontStyle: "italic" }}>Save this contact first, then you can link other contacts to it.</div>
          )}
        </SectionCard>
        </div>
        </FormTabs>
        </div>

        <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
          <button onClick={() => canSave && doSave()} disabled={!canSave} aria-disabled={!canSave} style={{ ...btnStyle(canSave ? T.contactsTeal : T.textDisabled, "filled"), width: "100%", padding: 16, fontSize: 16, fontWeight: 700, cursor: canSave ? "pointer" : "default" }}>
            {isNew ? tr("contacts.addContact", "Add contact") : tr("contacts.saveChanges", "Save changes")}
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

// True for null/undefined/''/false/empty-array — matches ReadRow's emptiness
// semantics, including the empty-array case where `!v` would be false.
function emptyish(v) {
  return v == null || v === '' || v === false || (Array.isArray(v) && v.length === 0);
}

function ReadRow({ label, value, T, requiredMissing = false }) {
  const showBlank = React.useContext(ShowBlankFieldsContext);
  const isEmpty = value === "" || value == null || (Array.isArray(value) && value.length === 0) || value === false;
  if (isEmpty && !showBlank && !requiredMissing) return null;
  const display = requiredMissing && isEmpty ? "— missing mandatory detail" : isEmpty ? "— not set" : (Array.isArray(value) ? value.join(", ") : value === true ? "Yes" : value);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: TYPE.control.fontSize }}>
      <span style={{ color: requiredMissing ? T.actionRed : T.textSecondary }}>{requiredMissing && <span aria-hidden="true" style={{ fontWeight: 800 }}>* </span>}{label}</span>
      <span style={{ color: requiredMissing ? T.actionRed : isEmpty ? T.textDisabled : T.textPrimary, fontWeight: requiredMissing ? 600 : isEmpty ? 400 : 500, fontStyle: isEmpty ? "italic" : "normal", textAlign: "right" }}>{display}</span>
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
function ContactProfile({ contactId, onBack, onEdit, onOpenContact, T, refresh, onNavigateToRecord, triggerDelete, onOpenGlossary }) {
  const { t: tr } = useTranslation();
  // CHANGED — Phase 2 encryption groundwork: ContactRepository went
  // async — this used to be a plain render-body const, previously
  // flagged safe to leave alone "since it re-runs every render", the
  // same reasoning that broke for RegistrySinglePicker/PregnancyTab
  // once THEIR one real repository went async. Converted to a proper
  // hook, kept at the very top (no hooks-before-guard issue — it
  // already was above the `!contact` guard below).
  const contact = useLoadedMemo(() => ContactRepository.getById(contactId), [contactId], null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  // ADDED — real ask: "not just edit or archive contact but also
  // option to delete permanently."
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Safety sharing (0): pre-compose discreet identification message.
  const [showSafetyShare, setShowSafetyShare] = useState(false);
  // ADDED 19 Aug 2026 — Anonymise mode, same read pattern as ContactsList.
  const [privacy] = useLoadedState(() => PrivacySettingsRepository.getSettings(), [], DEFAULT_PRIVACY_SETTINGS);
  const anonymise = privacy.anonymiseModeActive;
  const hideFurther = anonymise && privacy.hideFurtherEnabled;
  // ADDED 29 Sep 2026 (t025) — a contact's HIV status is STATED ONLY, and
  // deliberately not derived the way My Profile's is.
  //
  // The derivation on My Profile reads the user's OWN Testing records. Applied
  // to a contact it would read the user's tests and report them as someone
  // else's status — so the "derive it" half is simply absent here, and the
  // absence is the honest answer rather than a gap waiting to be filled. A
  // contact is either recorded as having a status or is not recorded.
  //
  // Null means "not recorded", which is shown as such and never as "untested":
  // those are different claims, and quietly substituting the second for the
  // first would put a word in someone's mouth on their own record.
  const contactHivStatus = useMemo(() => {
    if (!isValidHivStatus(contact?.hivStatus)) return null;
    return { status: contact.hivStatus, since: null, source: "stated" };
  }, [contact?.hivStatus]);
  // ADDED — real ask: toggle to reveal blank fields, so it's obvious
  // what's actually missing rather than silently absent.
  const [showBlankFields, setShowBlankFields] = useState(false);
  const [relinkVersion, forceRelink] = useState(0);
  // CHANGED — Phase 2 encryption groundwork: ContactRepository went
  // async — the "Linked contacts" section below used to filter/map
  // ContactRepository.getAll() straight in the render body. Hoisted
  // above this guard (hooks-before-guard), optional-chained since
  // `contact` can still be null on the one render before it loads.
  const linkedContactProfiles = useLoadedMemo(
    () => ContactRepository.getAll().then((all) => all.filter((c) => (contact?.linkedContactIds || []).includes(c.id))),
    [contact], []
  );
  // CHANGED — Phase 2 encryption groundwork: EncounterRepository went
  // async — the Timeline section below used to call
  // EncounterRepository.getAll() straight in the render body (inside
  // an IIFE). Hoisted above this guard for the same reason as
  // linkedContactProfiles above.
  const allEncounters = useLoadedMemo(() => EncounterRepository.getAll(), [], []);
  // CHANGED — Phase 2 encryption groundwork: MyProfileRepository went
  // async — hoisted above the guard (hooks-before-guard rule), same
  // reasoning as linkedContactProfiles/allEncounters above.
  const myProfile = useLoadedMemo(() => MyProfileRepository.getProfile(), [relinkVersion], { relationshipContactIds: [] });
  // CHANGED — Phase 2 encryption groundwork: KinkRegistry/ChemsRegistry
  // are now async — resolved into lookup Maps here (hoisted above the
  // guard), used by the Kink/Chems sections below.
  const kinkNameById = useLoadedMemo(async () => new Map((await KinkRegistry.getAll()).map((k) => [k.id, k.name])), [], new Map());
  const chemNameById = useLoadedMemo(async () => new Map((await ChemsRegistry.getAll()).map((c) => [c.id, c.name])), [], new Map());
  if (!contact) return null;
  // ADDED — live audit Finding 8c: the Kink card's empty-state guard used to
  // test `contact.statedKinks.length === 0`, but a record can hold a kinkId
  // whose registry entry no longer exists (renamed/removed item), giving a
  // non-empty array while every row below filters itself out — so the card
  // still rendered as a bare title. Resolve the names once and test those.
  // Deliberately BELOW the `!contact` guard: contact is null while the
  // repository loads, and reading statedKinks above it crashed the profile.
  const resolvedStatedKinks = contact.statedKinks
    .map((sel) => {
      const name = kinkNameById.get(sel.kinkId);
      return name ? (sel.role ? `${name} (${sel.role})` : name) : null;
    })
    .filter(Boolean);
  const resolvedLimits = contact.limits
    .map((sel) => {
      const name = kinkNameById.get(sel.kinkId);
      return name ? (sel.role ? `${name} (${sel.role})` : name) : null;
    })
    .filter(Boolean);
  const missingRequiredFields = (anonymise || hideFurther) ? [] : getMissingRequiredContactFields(contact);
  const missingRequiredLabels = requiredLabelsForKeys(missingRequiredFields, tr);
  const isLinkedToMe = myProfile.relationshipContactIds.includes(contact.id);
  const toggleLinkedToMe = async () => {
    if (isLinkedToMe) await MyProfileRepository.unlinkRelationshipContact(contact.id);
    else await MyProfileRepository.linkRelationshipContact(contact.id);
    forceRelink((v) => v + 1);
  };

  const archive = async () => { await ContactRepository.archive(contact.id); refresh(); onBack(); };
  const flaggedDontMeetAgain = contact.meetAgain === "No";
  const methods = getContactableVia(contact);

  return (
    <ShowBlankFieldsContext.Provider value={showBlankFields}>
    <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 16px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer", padding: 11, boxSizing: "content-box", marginTop: -11, marginRight: -11, marginBottom: -11, marginLeft: -11}} onClick={onBack} role="button" tabIndex={0} aria-label={tr("common.back", "Back")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* ADDED — real ask: show-blank-fields toggle. */}
          <div onClick={() => setShowBlankFields((v) => !v)} role="button" tabIndex={0} aria-pressed={showBlankFields} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowBlankFields((v) => !v); } }} title={showBlankFields ? "Hide blank fields" : "Show blank fields"} aria-label={showBlankFields ? "Hide blank fields" : "Show blank fields"} style={{ cursor: "pointer"}}>
            {showBlankFields ? <Eye size={19} color={T.contactsTeal} /> : <EyeOff size={19} color={T.textSecondary} />}
          </div>
          <div style={{ position: "relative" }}>
          <MoreVertical size={20} color={T.textSecondary} style={{ cursor: "pointer", padding: 12, boxSizing: "content-box", marginTop: -12, marginRight: -12, marginBottom: -12, marginLeft: -12}} onClick={() => setMenuOpen((o) => !o)} role="button" tabIndex={0} aria-haspopup="true" aria-expanded={menuOpen} aria-label="More options" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMenuOpen((o) => !o); } }} />
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", zIndex: 39 }} />
              <div role="menu" style={{ position: "absolute", top: 28, right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: radius.sm, boxShadow: "0 4px 16px rgba(0,0,0,.15)", zIndex: 40, minWidth: 170, overflow: "hidden" }}>
                <div onClick={() => { setShowSafetyShare(true); setMenuOpen(false); }} role="menuitem" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowSafetyShare(true); setMenuOpen(false); } }} style={{ padding: "10px 14px", fontSize: TYPE.control.fontSize, color: T.textPrimary, cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center", gap: 8 }}>
                  <Shield size={14} color={T.textSecondary} /> Share for safety
                </div>
                <div onClick={() => { if (!contact.isDemo) { onEdit(contact.id); setMenuOpen(false); } }} role="menuitem" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(contact.id); setMenuOpen(false); } }} style={{ padding: "10px 14px", fontSize: TYPE.control.fontSize, color: T.textPrimary, cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center", gap: 8 }}>
                  <Settings2 size={14} color={T.textSecondary} /> Edit contact
                </div>
                <div onClick={() => { setConfirmArchive(true); setMenuOpen(false); }} role="menuitem" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setConfirmArchive(true); setMenuOpen(false); } }} style={{ padding: "10px 14px", fontSize: TYPE.control.fontSize, color: T.actionRed, cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${T.border}` }}>
                  <Archive size={14} /> Archive contact
                </div>
                <div onClick={() => { if (!contact.isDemo) { setConfirmDelete(true); setMenuOpen(false); } }} role="menuitem" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setConfirmDelete(true); setMenuOpen(false); } }} style={{ padding: "10px 14px", fontSize: TYPE.control.fontSize, color: T.actionRed, cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${T.border}` }}>
                  <Trash2 size={14} /> Delete permanently
                </div>
              </div>
            </>
          )}
          </div>
        </div>
      </div>

      {showSafetyShare && (
        <SafetyShareSheet contact={contact} T={T} tr={tr} onClose={() => setShowSafetyShare(false)} />
      )}

      {flaggedDontMeetAgain && (
        <div style={{ margin: "0 16px 12px", padding: 12, borderRadius: radius.sm, border: `1px solid ${T.actionRed}`, background: `${T.actionRed}15`, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <AlertTriangle size={16} color={T.actionRed} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: TYPE.control.fontSize, fontWeight: 700, color: T.actionRedText }}>{tr("contacts.markedDontMeetAgain", "Marked: don't meet again")}</div>
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
            <button onClick={archive} style={{ ...btnStyle(T.actionRed, "filled"), padding: "8px 10px" }}>{tr("contacts.confirmArchive", "Confirm archive")}</button>
            <button onClick={() => setConfirmArchive(false)} style={{ ...btnStyle(T.textSecondary, "outline"), padding: "8px 10px" }}>{tr("common.cancel", "Cancel")}</button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDeleteCard
          T={T}
          moduleColor={T.contactsTeal}
          message="This permanently deletes the contact — unlike archiving, there's no getting it back. Only use this for a genuinely erroneous or unwelcome entry."
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => { await triggerDelete([contact]); refresh(); onBack(); }}
        />
      )}

      <div style={{ padding: "0 16px 100px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
          <span style={{ width: 14, height: 14, borderRadius: radius.full, background: T.contactsTeal, display: "inline-block" }} />
          {/* CHANGED — real accessibility gap found via a full axe scan
              (page-has-heading-one): the profile detail view is its
              own distinct screen (reached via the Contacts list) but
              had no heading at all — the contact's own name is the
              natural, real title here. Same <h1>/margin:0 treatment as
              every other screen title this app already uses. */}
          <h1 style={{ fontFamily: FONT_FAMILY, fontWeight: 700, fontSize: 20, color: T.textPrimary, margin: 0 }}>{anonymise ? MASKED : displayName(contact)}</h1>
          {/* FIXED 6 Oct 2026 (t077) - same weak guard as the card had, fixed at
              the same time from the same shared predicate. The profile header has
              no leading dot, so the symptom here was a bare number-ish span
              rendering empty or NaN rather than a dangling separator - quieter,
              and the reason this one would have been left behind if the card had
              been patched at its own call site instead of in the shared owner. */}
          {displayableAge(contact) != null && <span style={{ fontSize: 15, color: T.textSecondary }}>{contact.ageIsApprox ? "≈" : ""}{displayableAge(contact)}</span>}
          <MethodIcons methods={methods} T={T} />
        </div>
        {contact.nickname && !anonymise && <div style={{ fontSize: 12, color: T.textDisabled, marginLeft: 24 }}>Full name: {contact.name}</div>}
        {/* MOVED — real ask: the name used to repeat verbatim in the
            header bar right above this (visually redundant — every
            other module's own detail screen only shows its record
            title once, in the content area, not also next to the back
            button — see Testing's own equivalent screen). Removed the
            header-bar duplicate entirely and moved gender/pronouns
            down here instead of just discarding it, still right next
            to the name, not buried in a separate section. */}
        {!anonymise && (contact.pronouns || contact.gender) && (
          <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 24, marginBottom: 4 }}>
            {[contact.gender, contact.pronouns].filter(Boolean).join(" · ")}
          </div>
        )}

        {missingRequiredFields.length > 0 && (
          <SectionCard T={T} title={tr("contacts.requiredDetails", "Required details")}>
            {missingRequiredFields.map((field, index) => (
              <ReadRow key={field} T={T} label={missingRequiredLabels[index]} value="" requiredMissing />
            ))}
          </SectionCard>
        )}

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
            const summary = contactEncounterSummary(allEncounters, contact.id);
            const history = sortByDateDesc(
              allEncounters.filter((e) => e.attendeeIds.includes(contact.id) && !e.isArchived)
            );
            if (summary.count === 0) {
              return (
                <div style={{ fontSize: TYPE.control.fontSize, color: T.textDisabled, fontStyle: "italic", textAlign: "center", padding: "16px 4px" }}>
                  No encounters logged with this contact yet.
                </div>
              );
            }
            return (
              <>
                <div style={{ display: "flex", gap: 16, padding: "8px 0 14px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, fontFamily: FONT_FAMILY }}>{summary.count}</div>
                    <div style={{ fontSize: 11, color: T.textSecondary }}>{tr("contacts.encounters", "Encounters")}</div>
                  </div>
                  {summary.averageEnjoyment != null && (
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, fontFamily: FONT_FAMILY }}>{Math.round(summary.averageEnjoyment)}</div>
                      <div style={{ fontSize: 11, color: T.textSecondary }}>{tr("contacts.avgEnjoyment", "Avg enjoyment")}</div>
                    </div>
                  )}
                  {summary.highestEnjoyment != null && (
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, fontFamily: FONT_FAMILY }}>{summary.highestEnjoyment}</div>
                      <div style={{ fontSize: 11, color: T.textSecondary }}>{tr("contacts.highest", "Highest")}</div>
                    </div>
                  )}
                  {summary.lastInteraction && (
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, fontFamily: FONT_FAMILY }}>{formatRelativeDate(summary.lastInteraction)}</div>
                      <div style={{ fontSize: 11, color: T.textSecondary }}>{tr("contacts.lastSeen", "Last seen")}</div>
                    </div>
                  )}
                </div>
                {history.map((e) => (
                  // CHANGED — real ask: "linked encounter should be
                  // actually linked — click and it takes you to it."
                  // Real cross-module navigation now exists (see
                  // App.jsx's navigateToRecord) — no longer read-only.
                  <div key={e.id} onClick={() => onNavigateToRecord?.("activity", e.id)} role={onNavigateToRecord ? "button" : undefined} tabIndex={onNavigateToRecord ? 0 : undefined} aria-label="Open linked encounter" onKeyDown={onNavigateToRecord ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavigateToRecord("activity", e.id); } } : undefined}
                    style={{ padding: "8px 0", borderBottom: `1px solid ${T.border}`, fontSize: TYPE.control.fontSize, cursor: onNavigateToRecord ? "pointer" : "default" }}>
                    <div style={{ color: T.textPrimary, fontWeight: 600 }}>{e.title || "Untitled encounter"}</div>
                    <div style={{ color: T.textSecondary, fontSize: 12 }}>{e.date ? formatStoredDate(e.date) : "No date"}</div>
                  </div>
                ))}
              </>
            );
          })()}
        </SectionCard>

        <SectionCard T={T} title="Relationship">
          <ReadRow T={T} label={tr("contacts.rating", "How do I feel about this person?")} value={contact.rating} />
          <ReadRow T={T} label="Relationship type" value={contact.relationshipType} />
          <ReadRow T={T} label="How did we meet?" value={contact.howDidWeMeet} />
          <ReadRow T={T} label="Meet again?" value={contact.meetAgain} />
          {/* Deliberately distinct label from "Relationship type" above
              — different axis (My Profile's own overall status), not a
              second copy of it. See myProfileRepository.js.
              CHANGED 17 Sep 2026 — real report: this read as "is this
              contact single?" when the profile's own status genuinely
              IS "Single" — "linking" a contact to a single status never
              makes sense, so the toggle is hidden for exactly that one
              value (relationshipStatus is free text, so this can't be
              a full enum check, but "single" is the one value the
              report was actually about). Every other status (Married,
              Partnered, Poly, etc.) keeps the real toggle — it's a
              genuine action (who counts toward that status), not just
              a status display, so it stays interactive rather than
              becoming static text. */}
          {myProfile.relationshipStatus && myProfile.relationshipStatus.trim().toLowerCase() !== "single" && (
            <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={toggleLinkedToMe} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0 2px", cursor: "pointer", minHeight: 44 }}>
              <span style={{ fontSize: 12, color: T.textSecondary }}>Linked to My Profile's relationship status ({myProfile.relationshipStatus})</span>
              <div style={{ width: 36, height: 21, borderRadius: 999, background: isLinkedToMe ? T.contactsTeal : "#DCDCE1", position: "relative", flexShrink: 0 }}>
                <div style={{ position: "absolute", top: 2, left: isLinkedToMe ? 17 : 2, width: 17, height: 17, borderRadius: 999, background: "#FFFFFF" }} />
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard T={T} title="Location & logistics">
          <ReadRow T={T} label="Hosts" value={contact.hosts} />
          <ReadRow T={T} label="Travels" value={contact.travels} />
          <ReadRow T={T} label="Travel mode" value={contact.travelMode} />
          <ReadRow T={T} label="Outdoor/public meetups" value={contact.outdoorMeetup ? "Yes" : "No"} />
          <ReadRow T={T} label="Address" value={anonymise ? MASKED : contact.address} />
          <ReadRow T={T} label="City" value={anonymise ? MASKED : contact.city} />
<ReadRow T={T} label="Drives" value={travelsByCar(contact) ? "Yes" : "No"} />
            {/* Car details stay VISIBLE even when Drives is off. That is the
                module's own deliberate policy, recorded in contactRepository's
                header: "Still stored even if drives later gets toggled off, so
                nothing typed in gets silently lost" - and a car registration
                stays true even if they no longer drive. Flagged to the owner
                because the clinic-visit form now takes the OPPOSITE policy
                (clear with confirmation), so the app holds two answers to the
                same question until they pick one. */}
            <ReadRow T={T} label="Car details" value={contact.carDetails} />
          <ReadRow T={T} label="Car registration" value={anonymise ? MASKED : contact.carRegistration} />
          {!anonymise && formatAvailabilitySummary(contact) && <ReadRow T={T} label={tr("contacts.weeklyAvailability", "Weekly availability")} value={formatAvailabilitySummary(contact)} />}
          {!anonymise && contact.weeklyAvailability?.length > 0 && <ReadRow T={T} label={tr("contacts.availabilityTimezone", "Contact's local timezone")} value={getContactTimeZone(contact)} />}
          {!anonymise && contact.availabilityExceptions?.length > 0 && (
            <div style={{ padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: TYPE.control.fontSize }}>
              <div style={{ color: T.textSecondary, marginBottom: 4 }}>{tr("contacts.availabilityExceptionsOneOff", "Date-specific exceptions")}</div>
              {contact.availabilityExceptions.map((exception) => (
                <div key={exception.id} style={{ color: T.textPrimary, fontSize: 12, marginBottom: 2 }}>
                  {`${exception.date} · ${exception.type}${exception.start && exception.end ? ` · ${exception.start}–${exception.end}` : " · all day"}`}
                </div>
              ))}
            </div>
          )}
          {!anonymise && ((contact.availability?.length || 0) > 0 || (contact.nonAvailabilityRules?.length || 0) > 0 || contact.readilyAvailable) && (
            <div style={{ padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12, color: T.textSecondary }}>
              <div style={{ marginBottom: 4 }}>{tr("contacts.legacyAvailability", "Previous availability details")} · not used by filters</div>
              {contact.availability?.length > 0 && <div>Tags: {contact.availability.join(", ")}</div>}
              {contact.nonAvailabilityRules?.map((rule) => <div key={rule.id}>{describeAvailabilityRule(rule)}</div>)}
              {contact.readilyAvailable && <div>Readily available: {contact.readilyAvailable}</div>}
            </div>
          )}
        </SectionCard>

        {/* REORDERED 17 Sep 2026 — real ask: "physical & health before
            kinks" — moved up ahead of Kink/Chems, matching the same
            reorder made in the Add/Edit sheet above. */}
        <SectionCard T={T} title="Physical & health">
          {/* CHANGED 19 Aug 2026 — Anonymise mode's "hide further" tier:
              physical attributes (length/girth/cummer), per the user's
              exact wording ("kinks, physical attributes (cum, dick
              stats)"). Foreskin/chastity/PrEP-DoxyPEP/last-tested left
              visible — not named in the ask, and arguably closer to
              health-relevant than identity-revealing. */}
          {/* ADDED — real ask: hide these penis-specific rows (not
              Known to be on/Last tested below) when Gender is exactly
              "Female" — see the edit sheet's own comment on why
              Trans-female is deliberately excluded from this match. */}
          {contact.gender?.trim().toLowerCase() !== "female" || hasPhysicalDetail(contact) ? (
          <>
          <ReadRow T={T} label="Length (penis)" value={hideFurther ? MASKED : contact.length} />
          <ReadRow T={T} label="Girth (penis)" value={hideFurther ? MASKED : contact.thickness} />
<ReadRow T={T} label="Foreskin" value={contact.foreskin} />
            {/* FIXED 1 Oct 2026 (t053) - real bug. The EDIT form only offers
                "Foreskin fit" when foreskin is "Uncircumcised", but nothing
                cleared it when the condition flipped - and this detail row
                rendered it UNCONDITIONALLY. So a contact set to "Tight" and then
                changed to "Circumcised" kept showing "Foreskin fit: Tight" on
                the read view, which is a claim about a branch that no longer
                applies.

                Gated rather than cleared, matching this module's documented
                policy for carDetails: the value is kept so nothing typed in is
                silently lost, and switching back to Uncircumcised restores it.
                Clearing would also need a confirmation, which is what the owner
                chose for the clinic-visit form - see the policy note above. */}
            {contact.foreskin === "Uncircumcised" && (
              <ReadRow T={T} label="Foreskin fit" value={contact.foreskinDetail} />
            )}
          <ReadRow T={T} label="Chastity status" value={contact.chastityStatus} />
          <ReadRow T={T} label="Ejaculation" value={hideFurther ? MASKED : contact.cummer} />
          </>
          ) : null}
          {/* CHANGED 11 Sep 2026 — real gap found (a demographics audit):
              the exact "female"/"trans-male" gate below never shows for
              a non-binary/custom-typed gender, with no way to override
              it — a real functional exclusion, not just wording, since
              Gender is free text. Widened to also show whenever real
              data is already there (never hide an already-entered
              answer), on top of the original gender check — the edit
              sheet below is where a "show it anyway" option for anyone
              else actually lives, matching this app's own "never
              presume, but never structurally block" rule already used
              for the Pregnancy tab's own gender-based default. */}
          {(["female", "trans-male"].includes((contact.gender || "").trim().toLowerCase()) || (contact.contraception && contact.contraception.length > 0)) && (
            <ReadRow T={T} label="Contraception" value={contact.contraception} />
          )}
          <ReadRow T={T} label="Known to be on" value={contact.knownPrepDoxy} />
          <ReadRow T={T} label="Last tested" value={contact.lastTestedDate} />
          {/* ADDED 29 Sep 2026 (t025) — HIV status. MASKED under Anonymise
              mode, unlike the rows above it, and that asymmetry is
              deliberate: "known to be on PrEP" and a last-tested date are
              useful in a conversation with this person, whereas someone's
              HIV status is the single most sensitive fact this app can hold
              about them, and disclosing it to a third party is a decision
              with real consequences that the person themselves may not have
              made. Resolved (stated-over-derived) for the same reason as My
              Profile, and a null sentinel rather than a default so a contact
              with no test records yet never reads as "untested" mid-load. */}
          <ReadRow
            T={T}
            label="HIV status"
            value={
              hideFurther || anonymise
                ? MASKED
                : contactHivStatus
                  ? describeHivStatus(contactHivStatus)
                  : "Not recorded"
            }
          />
          {/* ADDED 1 Oct 2026 - U=U, and deliberately UNCONDITIONAL. Showing it
              only on contacts whose status is positive-undetectable would itself
              disclose: the note's presence would tell anyone glancing at the
              screen which of your contacts are HIV-positive. Uniformity is the
              privacy mechanism. See HivStatusNote.jsx. */}
          {!(hideFurther || anonymise) && <HivStatusNote T={T} label="HIV status" onOpen={onOpenGlossary} />}
          {/* ADDED 1 Oct 2026 - a STATED status has no test record behind it, so
              its date is "when you were told", not "when they were tested". Kept
              as its own row rather than folded into the status line above,
              because describeHivStatus renders a date as "as of <date>", which
              would turn a recollection into an apparent test result. The
              disclaimer is not decoration: without it the date reads as a
              freshness claim, which is the false assurance this whole change
              exists to remove. */}
          {contact.hivStatusInformedDate && !(hideFurther || anonymise) && (
            <>
              <ReadRow
                T={T}
                label="Date informed"
                value={formatStoredDate(contact.hivStatusInformedDate)}
              />
              <div
                style={{
                  fontSize: 11,
                  color: T.textDisabled,
                  fontStyle: "italic",
                  padding: "0 0 8px",
                }}
              >
                Not a record of when the test was done. This information may be out of date.
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard T={T} title="Kink">
          {hideFurther ? (
            <div style={{ fontSize: TYPE.control.fontSize, color: T.textDisabled, fontStyle: "italic", padding: "6px 0" }}>{MASKED}</div>
          ) : (
            <>
              {/* FIXED — live audit Finding 8c: with every Kink field empty this
                  card rendered as a bare title with nothing under it, which
                  reads as a rendering failure rather than "nothing recorded".
                  Matches the Chems "None known" and Notes "No notes yet."
                  fallbacks elsewhere in this profile.

                  The check is against RESOLVED names, not the raw selected IDs:
                  a record can still hold a kinkId whose registry entry no
                  longer exists (a renamed/removed registry item), giving
                  statedKinks.length > 0 while every row below filters itself
                  out — which is exactly how the first version of this guard
                  still showed a blank card. */}
              {resolvedStatedKinks.length === 0 && resolvedLimits.length === 0 && emptyish(contact.bdsmRole) && emptyish(contact.sexualPosition) ? (
                // §49b — colour-indent/backfill empty state (tinted bg +
                // coloured left border, matching encounters-card-mockup.html).
                <div style={{ fontSize: TYPE.control.fontSize, color: T.textDisabled, fontStyle: "italic", padding: "7px 9px", borderLeft: `3px solid ${ACCENTS.kink}`, borderRadius: radius.sm, background: `${ACCENTS.kink}15` }}>Nothing recorded yet.</div>
              ) : (
                <>
                  <ReadRow T={T} label="Stated kinks" value={resolvedStatedKinks} />
                  <ReadRow T={T} label="Limits" value={resolvedLimits} />
                  <ReadRow T={T} label="Role" value={contact.bdsmRole} />
                  <ReadRow T={T} label="Position" value={contact.sexualPosition} />
                </>
              )}
            </>
          )}
        </SectionCard>

        <SectionCard T={T} title="Chems">
          {/* CHANGED — real ask: empty Chems should explicitly say
              "None known" rather than the row just disappearing —
              ReadRow's default behavior everywhere else (hide empty
              fields entirely) still applies to every other field. */}
          {/* §49b — colour-indent/backfill empty state. */}
          {contact.knownChems.length === 0 ? (
            <div style={{ fontSize: TYPE.control.fontSize, color: T.textDisabled, fontStyle: "italic", padding: "7px 9px", borderLeft: `3px solid ${ACTION.amber}`, borderRadius: radius.sm, background: `${ACTION.amber}15` }}>None known</div>
          ) : (
            <ReadRow T={T} label="Known chems" value={contact.knownChems.map((id) => chemNameById.get(id)).filter(Boolean)} />
          )}
        </SectionCard>

        <SectionCard T={T} title="Contact methods">
          {/* FIXED — live audit Finding 8c: Contact methods rendered as a bare
              title whenever every field was empty (ReadRow hides empty values
              by default). Same "say so explicitly" treatment as Chems and
              Notes above. `methods` is the already-derived list of contactable
              channels, so checking it covers the whole set cheaply. */}
          {methods.length === 0 && !contact.phone && !contact.email && !contact.snapchat && !contact.fabguys && !contact.fabswingers && !contact.recon ? (
            // §49b — colour-indent/backfill empty state.
            <div style={{ fontSize: TYPE.control.fontSize, color: T.textDisabled, fontStyle: "italic", padding: "7px 9px", borderLeft: `3px solid ${ACCENTS.contacts}`, borderRadius: radius.sm, background: `${ACCENTS.contacts}15` }}>No contact methods recorded.</div>
          ) : (
            <>
              <ReadRow T={T} label="Contactable via" value={methods} />
              <ReadRow T={T} label="Phone/WhatsApp" value={contact.phone} />
              {contact.email && <ReadRow T={T} label={tr("contacts.email", "Email")} value={anonymise ? MASKED : contact.email} />}
              <ReadRow T={T} label="Snapchat" value={contact.snapchat} />
              <ReadRow T={T} label="Fabguys" value={contact.fabguys} />
              <ReadRow T={T} label="Fabswingers" value={contact.fabswingers} />
              <ReadRow T={T} label="Recon" value={contact.recon} />
            </>
          )}
        </SectionCard>

        <SectionCard T={T} title="Notes">
          {/* §49b — colour-indent/backfill empty state. */}
          <div style={{ fontSize: 14, color: contact.notes ? T.textPrimary : T.textDisabled, fontStyle: contact.notes ? "normal" : "italic", padding: contact.notes ? 0 : "7px 9px", borderLeft: contact.notes ? "none" : `3px solid ${ACCENTS.home}`, borderRadius: contact.notes ? 0 : radius.sm, background: contact.notes ? "transparent" : `${ACCENTS.home}15` }}>
            {contact.notes || "No notes yet."}
          </div>
        </SectionCard>

        {contact.linkedContactIds.length > 0 && (
          <SectionCard T={T} title="Linked contacts">
            {linkedContactProfiles
              .map((c) => (
                <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} key={c.id} onClick={() => onOpenContact(c.id)}
                  style={{ padding: "8px 0", borderBottom: `1px solid ${T.border}`, fontSize: TYPE.control.fontSize, color: T.contactsTeal, fontWeight: 600, cursor: "pointer"}}>
                  {displayName(c, anonymise)}
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
function ContactsList({ contacts, onOpen, onAdd, T, sortBy, setSortBy, query, setQuery, onOpenMyProfile, onOpenImportProfile, onOpenContactsSettings, onQuickExit, refresh, deleteToast, undoDelete, redoDelete, triggerDelete, preferencesVersion = 0 }) {
  // ADDED 19 Aug 2026 — Anonymise mode. Read once per mount, same
  // pattern as every other cross-module settings read in this app —
  // toggling it in Settings and switching back to Contacts (a fresh
  // remount) picks up the new value naturally.
  const [privacy] = useLoadedState(() => PrivacySettingsRepository.getSettings(), [], DEFAULT_PRIVACY_SETTINGS);
  const anonymise = privacy.anonymiseModeActive;
  const { t: tr } = useTranslation();
  // ADDED 19 Aug 2026 — real ask: configurable inactive threshold.
  // FIXED 9 Sep 2026 — real bug found live: getPreferences() is async,
  // so chaining .inactiveThresholdDays directly onto its return value
  // read a property off a Promise — always undefined, silently falling
  // back to the 90-day default below regardless of what the owner
  // actually configured in Settings > General > Preferences. Same bug
  // class as Home's/Healthcare's own menstrualTrackingEnabled sites.
  const [inactiveThresholdDays] = useLoadedState(() => AppPreferencesRepository.getPreferences().then((p) => p.inactiveThresholdDays), [preferencesVersion], 90);
  // ADDED 10 Sep 2026 — real ask: Dom/sub + Top/bottom on the list card,
  // gated behind an opt-in preference — see AppPreferencesRepository's
  // own showRoleOnContactCards comment for why this defaults off.
  const [showRoleOnCards] = useLoadedState(() => AppPreferencesRepository.getPreferences().then((p) => p.showRoleOnContactCards), [preferencesVersion], false);
  const [showAvailabilityOnCards] = useLoadedState(() => AppPreferencesRepository.getPreferences().then((p) => p.showAvailabilityOnContactCards), [preferencesVersion], false);
  // ADDED 16 Sep 2026 — real report: "module contents still mobile
  // width" — the list below rendered as one full-width stacked column
  // regardless of viewport, so each card's own left-aligned content
  // (name/badges/location, ~300-350px wide) sat inside a much wider
  // row with a huge blank strip on the right, reading exactly like
  // mobile content just stretched into a wide box. See the list
  // container's own comment below for the fix.
  const isDesktopWidth = useIsDesktopWidth();
  const activeContacts = useMemo(() => contacts.filter((c) => !c.isArchived), [contacts]);
  // ADDED 18 Aug 2026 — loaded once here rather than per-card, needed
  // for the card's active-status dot (see ContactCard below).
  const encounters = useLoadedMemo(() => EncounterRepository.getAll(), [contacts], []);
  // ADDED — real perf fix: was calling contactEncounterSummary(encounters,
  // id) per card AND per pair compared while sorting by "Last encounter"
  // — each call independently rescans the full encounters array. This
  // builds every contact's summary in one O(M) pass, once per encounters
  // change, so both the card render and the sort comparator below become
  // O(1) lookups instead of rescans.
  const encounterSummaries = useMemo(() => contactEncounterSummaries(encounters), [encounters]);
  const [showFilters, setShowFilters] = useState(false);
  const [runningCountEnabled, setRunningCountEnabled] = useState(() => {
    try { return localStorage.getItem("shos-contacts-running-count") !== "off"; } catch { return true; }
  });
  const [firstVisible, setFirstVisible] = useState(0);
  const gridRef = useRef(null);
  // ADDED — real ask: a duplicate checker for Contacts specifically,
  // scored across multiple fields (not just name) — see
  // contactMerge.js (capped, reversible-by-design: re-point only, no
  // field combining, full preview, source goes to Trash) and
  // findContactDuplicateCandidates' own comment in fuzzyMatch.js for
  // the confidence-tier reasoning. Same "compute once, the data's
  // small enough" judgment as the shared-registry duplicate checker
  // this is modeled on.
  const allDuplicateCandidates = useMemo(() => duplicateCandidatePanel("contact", activeContacts)?.candidates ?? [], [activeContacts]);
  // ADDED — real ask: a per-pair dismiss, so a pair that's genuinely
  // two different people (a shared name, a coincidental phone-number
  // typo, whatever the real signal was) stops reappearing every time
  // this panel is opened — see AppPreferencesRepository's own comment
  // on the stored key shape.
  const [dupPrefs, setDupPrefs] = useLoadedState(() => AppPreferencesRepository.getPreferences(), [], DEFAULT_APP_PREFERENCES);
  const dismissedPairKey = (idA, idB) => [idA, idB].sort().join("_");
  const dismissedPairSet = useMemo(() => new Set(dupPrefs.dismissedContactDuplicatePairs || []), [dupPrefs.dismissedContactDuplicatePairs]);
  const duplicateCandidates = useMemo(
    () => allDuplicateCandidates.filter(({ a, b }) => !dismissedPairSet.has(dismissedPairKey(a.id, b.id))),
    [allDuplicateCandidates, dismissedPairSet]
  );
  const dismissDuplicatePair = async (idA, idB) => {
    const key = dismissedPairKey(idA, idB);
    setDupPrefs(await AppPreferencesRepository.update({ dismissedContactDuplicatePairs: [...(dupPrefs.dismissedContactDuplicatePairs || []), key] }));
  };
  const [showDuplicates, setShowDuplicates] = useState(false);
  // ADDED 21 Oct 2026 (t129) - the hardware back button and Escape now close
  // the "Possible duplicates" panel. It had neither, and it is rendered
  // inside the Contacts list, whose own back handler knew nothing about it -
  // so a back press went to the list underneath (or, with nothing else to
  // pop, to Home) and left the panel on screen.
  useEscapeToClose(() => setShowDuplicates(false), showDuplicates);
  useOverlayBackHandler(() => { setShowDuplicates(false); return true; }, showDuplicates);
  // ADDED 26 Aug 2026 — real ask: long-press a card to enter multi-
  // select mode, then bulk delete/archive/edit. "Edit" deliberately
  // not included in bulk actions — editing several different
  // contacts' individual fields at once doesn't have an obvious
  // single meaning the way delete/archive do; flagged rather than
  // guessed at a shape for it.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const toggleSelected = (id) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds([]); setConfirmingBulkDelete(false); };
  // ADDED 26 Aug 2026 — real ask: filter Contacts by role/position
  // (top/bottom/dom/sub etc.), in addition to being able to search for
  // it. Uses the real bdsmRole/sexualPosition fields already on
  // Contact. Kink-specific filtering deliberately not added here —
  // search already covers kinks by name (see below), and a real
  // filter UI for it is a better fit once the flagged Kink Registry
  // management screen exists, rather than a second, narrower mechanism
  // built just for this list.
  const [filterRoles, setFilterRoles] = useState(() => { try { return JSON.parse(localStorage.getItem("shos_contact_filter_roles") || "[]"); } catch { return []; } });
  const [filterPositions, setFilterPositions] = useState(() => { try { return JSON.parse(localStorage.getItem("shos_contact_filter_positions") || "[]"); } catch { return []; } });
  // ADDED 26 Aug 2026 — real ask: filter by drives/accommodation too.
  const [filterHosts, setFilterHosts] = useState(() => { try { return JSON.parse(localStorage.getItem("shos_contact_filter_hosts") || "[]"); } catch { return []; } });
  const [filterDrives, setFilterDrives] = useState(() => { try { return JSON.parse(localStorage.getItem("shos_contact_filter_drives") || "false"); } catch { return false; } });
  const [filterAvailability, setFilterAvailability] = useState(() => { try { return localStorage.getItem("shos_contact_filter_availability") || ""; } catch { return ""; } });
  const [filterAvailabilityAt, setFilterAvailabilityAt] = useState(() => { try { return localStorage.getItem("shos_contact_filter_availability_at") || localDateTimeInputValue(new Date(Date.now() + 60 * 60 * 1000)); } catch { return localDateTimeInputValue(new Date(Date.now() + 60 * 60 * 1000)); } });
  const [availabilityNow, setAvailabilityNow] = useState(() => new Date());
  // Persist filters so they survive navigation
  useEffect(() => { localStorage.setItem("shos_contact_filter_roles", JSON.stringify(filterRoles)); }, [filterRoles]);
  useEffect(() => { localStorage.setItem("shos_contact_filter_positions", JSON.stringify(filterPositions)); }, [filterPositions]);
  useEffect(() => { localStorage.setItem("shos_contact_filter_hosts", JSON.stringify(filterHosts)); }, [filterHosts]);
  useEffect(() => { localStorage.setItem("shos_contact_filter_drives", JSON.stringify(filterDrives)); }, [filterDrives]);
  useEffect(() => { try { localStorage.setItem("shos_contact_filter_availability", filterAvailability); } catch { /* Browser storage may be unavailable. */ } }, [filterAvailability]);
  useEffect(() => { try { localStorage.setItem("shos_contact_filter_availability_at", filterAvailabilityAt); } catch { /* Browser storage may be unavailable. */ } }, [filterAvailabilityAt]);
  useEffect(() => { if (anonymise) setFilterAvailability(""); }, [anonymise]);
  useEffect(() => {
    if (!filterAvailability || anonymise) return undefined;
    const timer = setInterval(() => setAvailabilityNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, [filterAvailability, anonymise]);
  const activeFilterCount = filterRoles.length + filterPositions.length + filterHosts.length + (filterDrives ? 1 : 0) + (filterAvailability && !anonymise ? 1 : 0);
  // CHANGED — Phase 2 encryption groundwork: KinkRegistry is now async
  // — resolved once here (loaded, not per keystroke), read synchronously
  // via .get() inside the `filtered` useMemo below, same "split slow-
  // loading data from fast pure computation" split used elsewhere this
  // session for a live search box.
  const kinkNameById = useLoadedMemo(async () => new Map((await KinkRegistry.getAll()).map((k) => [k.id, k.name])), [], new Map());
  const effectiveAvailabilityFilter = anonymise ? "" : filterAvailability;
  const availabilityFilterLabel = effectiveAvailabilityFilter === "now"
    ? tr("contacts.availableNow", "Available now")
    : effectiveAvailabilityFilter === "soon"
      ? tr("contacts.availableSoon", "Soon · next 24 hours")
      : effectiveAvailabilityFilter === "at" ? tr("contacts.availableAtTime", "At a set time") : "";
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const searched = q
      ? activeContacts.filter((c) =>
          [c.name, c.nickname, c.phone, ...(!anonymise ? [c.email] : []), c.snapchat, c.fabguys, c.fabswingers, c.recon, c.notes]
            .some((field) => (field || "").toLowerCase().includes(q))
          || [...c.statedKinks.map((s) => s.kinkId), ...c.limits.map((l) => l.kinkId)]
              .map((id) => kinkNameById.get(id) || "")
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
      ? hostsFiltered.filter((c) => travelsByCar(c))
      : hostsFiltered;
    let availabilityFiltered = drivesFiltered;
    if (effectiveAvailabilityFilter === "now") {
      availabilityFiltered = drivesFiltered.filter((c) => isContactAvailableAt(c, availabilityNow));
    } else if (effectiveAvailabilityFilter === "soon") {
      availabilityFiltered = drivesFiltered.filter((c) => isContactAvailableSoon(c, availabilityNow));
    } else if (effectiveAvailabilityFilter === "at") {
      const selectedInstant = filterAvailabilityAt ? new Date(filterAvailabilityAt) : null;
      availabilityFiltered = selectedInstant && Number.isFinite(selectedInstant.getTime()) && selectedInstant > availabilityNow
        ? drivesFiltered.filter((c) => isContactAvailableAt(c, selectedInstant))
        : [];
    }
    const sorted = [...availabilityFiltered].sort((a, b) => {
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
        const aLast = (encounterSummaries.get(a.id) || EMPTY_ENCOUNTER_SUMMARY).lastInteraction;
        const bLast = (encounterSummaries.get(b.id) || EMPTY_ENCOUNTER_SUMMARY).lastInteraction;
        if (!aLast && !bLast) return 0;
        if (!aLast) return 1;
        if (!bLast) return -1;
        return new Date(bLast) - new Date(aLast);
      }
      return displayName(a).localeCompare(displayName(b));
    });
    return sorted;
  }, [activeContacts, query, sortBy, encounterSummaries, filterRoles, filterPositions, filterHosts, filterDrives, effectiveAvailabilityFilter, filterAvailabilityAt, availabilityNow, anonymise, kinkNameById]);
  useEffect(() => {
    if (!runningCountEnabled || !gridRef.current) return;
    const cards = Array.from(gridRef.current.querySelectorAll("[data-contact-idx]"));
    if (cards.length === 0) return;
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).map((e) => parseInt(e.target.getAttribute("data-contact-idx"), 10)).filter((n) => !isNaN(n));
      if (visible.length) setFirstVisible(Math.min(...visible));
    }, { root: null, threshold: 0.5 });
    cards.forEach((c) => obs.observe(c));
    return () => obs.disconnect();
  }, [runningCountEnabled, filtered.length]);


  return (
    <div>
      {/* CHANGED 26 Aug 2026 — real ask: banners "feel a little boring" —
          added a real outline (darker bottom border for definition
          against the page background) and moved Search/Settings/
          Profile-type icons INTO the banner itself, white against the
          colour, instead of a separate plain row below it. */}
      {/* CHANGED 15 Sep 2026 — real report: "too blocky / harsh/clashy" —
          softened the sharp corners/stark border into a gentler shape
          (bottom corners only — the top edge is flush with the
          screen's own top edge, so rounding there is never visible). */}
      {/* CHANGED 16 Sep 2026 — real report: a plain `top: 0` respected
          the device status bar only before the first scroll (the
          safe-area padding lives on App.jsx's own <main>, which is
          normal document flow — it scrolls away with everything else,
          so a stuck `top: 0` banner then sits at the true viewport
          top, over the status bar). `top` on the sticky element itself
          now carries its own safe-area offset, so it re-parks below
          the status bar every time it locks, not just on first paint —
          plus a real ~8px white gap above the colour border (half this
          banner's own 16px top padding), which the old edge-to-edge
          `top: 0` never had at all. */}
      {/* CHANGED — real edge-to-edge redesign (researched how other
          apps handle colour under the notch/status bar): the banner's
          own background now runs to the true screen edge with no
          visible seam, instead of being offset down by env()+8px
          (which left a permanent neutral gap behind the status bar).
          The safe-area inset moved from `top` into the banner's own
          top padding, so only the title/icons — not the colour — sit
          below the notch. */}
      <div style={{ position: "sticky", top: "var(--shos-top-banner-h, 0px)", zIndex: 6, background: T.contactsBanner, borderBottom: "1px solid rgba(0,0,0,0.08)", borderRadius: "0 0 16px 16px", padding: "calc(16px + env(safe-area-inset-top)) 16px 14px", marginTop: "calc(-1 * env(safe-area-inset-top))", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ ...TYPE.screenTitle, margin: 0, color: "#FFFFFF" }}>{tr("contacts.title", "Contacts")}</h1>
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
          {/* ADDED — real ask: a duplicate checker for Contacts, same
              badge-opens-a-panel pattern as the shared registries' own
              duplicate checker (SHOS_RegistryManagement_Prototype.jsx),
              styled to match this file's own existing amber duplicate-
              warning (the live "possible duplicate" nudge shown while
              adding a new contact, further down this file) rather than
              that screen's red — this is a softer, scored signal, not
              a same-name exact flag. */}
          {duplicateCandidates.length > 0 && (
            <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => setShowDuplicates(true)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 999, background: T.actionAmberSurface, color: T.actionAmberText, fontSize: TYPE.control.fontSize, fontWeight: 700, cursor: "pointer"}}>
              <AlertTriangle size={12} color={T.actionAmberText} /> {duplicateCandidates.length}
            </div>
          )}
          <span role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)} style={{ fontSize: TYPE.control.fontSize, fontWeight: 600, color: "#FFFFFF", cursor: "pointer"}}>
            {selectMode ? "Done" : "Select"}
          </span>
          {/* CHANGED 19 Aug 2026 — real icon confusion the user flagged:
              Upload reads as "sending data out", which is backwards for
              an action that brings someone else's shared profile IN.
              Download's arrow-into-tray matches the actual direction.
              CHANGED 26 Aug 2026 — moved into the banner, white. */}
          {onOpenImportProfile && <Download role="button" tabIndex={0} aria-label="Import profile from file" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} size={24} color="#FFFFFF" style={{ cursor: "pointer", padding: 10, boxSizing: "content-box", marginTop: -10, marginRight: -10, marginBottom: -10, marginLeft: -10}} onClick={onOpenImportProfile} />}
          {onOpenMyProfile && <User role="button" tabIndex={0} aria-label="Open My Profile" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} size={24} color="#FFFFFF" style={{ cursor: "pointer", padding: 10, margin: "-10px 0" }} onClick={onOpenMyProfile} />}
          {/* ADDED 15 Sep 2026 — real ask: a real in-module settings
              screen (see ContactsSettingsScreen's own comment above),
              matching Medication Dashboard's own gear-icon placement. */}
          {onOpenContactsSettings && <SettingsIcon size={24} color="#FFFFFF" style={{ cursor: "pointer", padding: 10, margin: "-10px 0" }} onClick={onOpenContactsSettings} role="button" tabIndex={0} aria-label="Contacts settings" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenContactsSettings(); } }} title="Contacts settings" />}
          {onQuickExit && <SignOut size={24} color="#FFFFFF" role="button" tabIndex={0} style={{ cursor: "pointer", padding: 10, margin: "-10px 0" }} onClick={onQuickExit} aria-label="Quick exit" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onQuickExit(); } }} title="Quick exit" />}
        </div>
      </div>

      {showDuplicates && (
        <div onClick={() => setShowDuplicates(false)} style={{ position: "fixed", inset: 0, paddingBottom: "env(safe-area-inset-bottom)", paddingTop: "env(safe-area-inset-top)", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 39 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg, width: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column", borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 14px", background: T.contactsBanner, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
              <span style={{ ...TYPE.sheetTitle, color: "#FFFFFF" }}>{tr("contacts.possibleDuplicates", "Possible duplicates")}</span>
              <X size={20} color="#FFFFFF" style={{ cursor: "pointer", padding: 12, boxSizing: "content-box", marginTop: -12, marginRight: -12, marginBottom: -12, marginLeft: -12}} onClick={() => setShowDuplicates(false)} aria-label="Close duplicates panel" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
            </div>
            <div style={{ padding: "6px 20px 0", fontSize: 12, color: T.textSecondary }}>
              Flagged by name, phone, email, and social-handle matches — plus lighter signals (city, address, approximate age, shared notes wording) that only count once something else already put a pair in question. Higher confidence just means more of these line up — nothing is merged automatically; check each pair yourself.
            </div>
            <div tabIndex={0} style={{ overflowY: "auto", padding: "10px 20px 24px", flex: 1 }}>
              {duplicateCandidates.map(({ a, b, confidence, matched }, i) => (
                <div key={`${a.id}-${b.id}`} style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                      color: confidence === "High" ? T.actionRedText : confidence === "Medium" ? T.actionAmberText : T.textSecondary,
                      background: confidence === "High" ? `${T.actionRed}15` : confidence === "Medium" ? T.actionAmberSurface : T.surfaceVariant,
                    }}>{confidence} confidence</span>
                    <span style={{ fontSize: 11, color: T.textDisabled }}>matched: {matched.join(", ")}</span>
                  </div>
                  {/* FIXED 28 Sep 2026 — Anonymise mode. This panel was the
                      single worst leak the 28 Sep security review found, and
                      the review's own re-ranking put it above the search
                      index for a concrete reason: it printed a contact's
                      PHONE NUMBER, not just their name. A name is something
                      you might be willing to have read out; a phone number is
                      a direct route to reaching that person, and this panel
                      also offers one-tap Archive on the row beside it.

                      The "matched: …" list above is deliberately left as-is: it
                      names the FIELDS that matched, not their values, so it
                      discloses no contact detail on its own. */}
                  {[a, b].map((entry) => (
                    <div key={entry.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: entry.isArchived ? T.textDisabled : T.textPrimary }}>
                        {anonymise ? MASKED : (entry.nickname || entry.name)}{entry.isArchived ? " (archived)" : ""}
                        {!anonymise && (entry.city || entry.phone) && <span style={{ fontSize: 11, fontWeight: 400, color: T.textDisabled }}> · {[entry.city, entry.phone].filter(Boolean).join(" · ")}</span>}
                      </span>
                      {!entry.isArchived && (
                        <span role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={async () => { await ContactRepository.archive(entry.id); refresh(); }} style={{ fontSize: 12, fontWeight: 700, color: T.actionRed, cursor: "pointer"}}>Archive this one</span>
                      )}
                    </div>
                  ))}
                  {/* ADDED — real ask: a per-pair dismiss, for a pair
                      that's genuinely two different people rather than
                      a real duplicate. Doesn't merge or change either
                      record — just stops flagging this specific pair
                      again. */}
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                    <span onClick={() => dismissDuplicatePair(a.id, b.id)} role="button" tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); dismissDuplicatePair(a.id, b.id); } }}
                      style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, cursor: "pointer"}}>
                      Not a duplicate — dismiss
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ADDED 26 Aug 2026 — real ask: bulk action toolbar, shown while
          in multi-select mode (entered via long-press on a card). */}
      {selectMode && (
        // FIXED 16 Sep 2026 — real bug: same class as Healthcare's own
        // sub-tab sticky headers — the sticky-header status-bar fix
        // moved Contacts' own banner from top:0 to
        // calc(env(safe-area-inset-top) + 8px), leaving this bar's own
        // bare top:62 stuck at the OLD position, overlapping the
        // banner's new, lower bottom edge.
        // CHANGED — real edge-to-edge redesign: Contacts' own banner
        // moved its safe-area inset from `top` into its own top
        // padding, shrinking its net height by 8px, so 70 became 62.
        <div style={{ position: "sticky", top: `calc(var(--shos-top-banner-h, 0px) + ${STICKY_SUBHEADING_TOP})`, zIndex: 6, background: T.surfaceVariant, border: `1px solid ${T.border}`, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", rowGap: 8, boxSizing: "border-box", width: "100%", maxWidth: 760, margin: "0 auto" }}>
          <span style={{ fontSize: TYPE.control.fontSize, color: T.textPrimary, fontWeight: 600 }}>{selectedIds.length} selected</span>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {/* ADDED 1 Sep 2026 — real ask: "option to select all... rather
                than manual 1 by 1", scoped to whatever's currently
                visible (respects an active search/filter, same as
                everything else this screen shows). */}
            <span role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map((c) => c.id))}
              style={{ fontSize: TYPE.control.fontSize, color: T.textPrimary, fontWeight: 600, cursor: "pointer", padding: "12px 8px", minHeight: 44, display: "inline-flex", alignItems: "center" }}>
              {selectedIds.length === filtered.length ? "Deselect all" : "Select all"}
            </span>
            {/* ADDED 26 Aug 2026 — real ask: export/print a single
                record, enabled only when exactly one is selected —
                exporting several at once as one file doesn't map to
                "a single record to hand to a provider". */}
            <span role="button" tabIndex={0} aria-label={tr("contacts.exportAria", "Export contact")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={async () => { if (selectedIds.length === 1) exportRecordAsFile("contacts", await ContactRepository.getById(selectedIds[0])); }}
              style={{ fontSize: TYPE.control.fontSize, color: selectedIds.length === 1 ? T.textPrimary : T.textDisabled, fontWeight: 600, cursor: selectedIds.length === 1 ? "pointer" : "default", padding: "12px 8px", minHeight: 44, display: "inline-flex", alignItems: "center" }}>{tr("contacts.export", "Export")}</span>
            <span role="button" tabIndex={0} aria-label={tr("contacts.archiveAria", "Archive contacts")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={async () => { if (selectedIds.length > 0) { await ContactRepository.bulkArchive(selectedIds); refresh(); exitSelectMode(); } }}
              style={{ fontSize: TYPE.control.fontSize, color: selectedIds.length > 0 ? T.textPrimary : T.textDisabled, fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default", padding: "12px 8px", minHeight: 44, display: "inline-flex", alignItems: "center" }}>{tr("contacts.archive", "Archive")}</span>
            {/* CHANGED 10 Sep 2026 — standardised delete confirmation:
                was a native window.confirm() dialog, now the same shared
                inline card every module uses. */}
            <span role="button" tabIndex={0} aria-label={tr("contacts.deleteAria", "Delete contacts")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => { if (selectedIds.length > 0) setConfirmingBulkDelete(true); }}
              style={{ fontSize: TYPE.control.fontSize, color: selectedIds.length > 0 ? buildDark().actionRed : T.textDisabled, fontWeight: 600, cursor: selectedIds.length > 0 ? "pointer" : "default", padding: "12px 8px", minHeight: 44, display: "inline-flex", alignItems: "center" }}>{tr("contacts.delete", "Delete")}</span>
            <span role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={exitSelectMode} style={{ fontSize: TYPE.control.fontSize, color: T.textPrimary, fontWeight: 600, cursor: "pointer", padding: "12px 8px", minHeight: 44, display: "inline-flex", alignItems: "center" }}>{tr("common.cancel", "Cancel")}</span>
          </div>
        </div>
      )}
      {confirmingBulkDelete && (
        <ConfirmDeleteCard
          T={T}
          moduleColor={T.contactsTeal}
          message={`Delete ${selectedIds.length} contact${selectedIds.length > 1 ? "s" : ""} permanently? You'll have a few seconds to undo.`}
          confirmLabel="Delete"
          onCancel={() => setConfirmingBulkDelete(false)}
          onConfirm={async () => {
            // Still captures full records BEFORE deleting via getAll(),
            // not the possibly-stale `contacts` prop.
            const toRestore = (await ContactRepository.getAll()).filter((c) => selectedIds.includes(c.id));
            await triggerDelete(toRestore);
            refresh();
            exitSelectMode();
          }}
        />
      )}
      {/* ADDED 19 Aug 2026 — visible confirmation that data is
          deliberately masked, not missing/broken. */}
      {anonymise && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "8px 16px 0", padding: "8px 12px", borderRadius: radius.sm, background: "#1B1B1F", color: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>
          <EyeOff size={13} /> Anonymise mode is on — names, photos, cities, and car details are hidden.
        </div>
      )}
      {/* FIXED — real report: "the 14 active on contacts is a little too
          close to the header bar" — this had zero top padding, sitting
          right against the header banner's own bottom edge. Added top
          padding to roughly double the visual gap. */}
      <div style={{ padding: "12px 16px 12px", fontSize: 12, color: T.textSecondary }}>
        {activeContacts.length} active
      </div>

      <div style={{ padding: "0 16px 10px", display: "flex", alignItems: "center", gap: 8 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search contacts" aria-label="Search contacts"
          style={{ flex: 1, padding: "8px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: FONT_FAMILY, fontSize: TYPE.control.fontSize, boxSizing: "border-box", minHeight: 44 }} />
        {/* ADDED 26 Aug 2026 — real ask: filter by role/position, not
            just search. */}
        <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => setShowFilters((s) => !s)} style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 8px", borderRadius: radius.full, cursor: "pointer", border: `1px solid ${activeFilterCount > 0 ? T.contactsTeal : T.border}`, color: activeFilterCount > 0 ? T.contactsTeal : T.textSecondary, fontSize: 12, fontWeight: 600, flexShrink: 0}}>
          Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </div>
      </div>

      {showFilters && (
        <div style={{ padding: "0 16px 12px" }}>
          <div style={{ ...TYPE.sectionLabel, color: T.textSecondary, marginBottom: 4 }}>Role</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {CONTACT_BDSM_ROLE_OPTIONS.map((r) => {
              const active = filterRoles.includes(r);
              return (
                <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} key={r} onClick={() => setFilterRoles((f) => active ? f.filter((x) => x !== r) : [...f, r])}
                  style={{ padding: "5px 10px", borderRadius: radius.full, fontSize: TYPE.control.fontSize, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? T.contactsTeal : T.border}`, color: active ? T.contactsTealText : T.textSecondary, background: active ? `${T.contactsTeal}15` : "transparent"}}>
                  {r}
                </div>
              );
            })}
          </div>
          <div style={{ ...TYPE.sectionLabel, color: T.textSecondary, marginBottom: 4 }}>{tr("contacts.position", "Position")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {CONTACT_SEXUAL_POSITION_OPTIONS.map((p) => {
              const active = filterPositions.includes(p);
              return (
                <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} key={p} onClick={() => setFilterPositions((f) => active ? f.filter((x) => x !== p) : [...f, p])}
                  style={{ padding: "5px 10px", borderRadius: radius.full, fontSize: TYPE.control.fontSize, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? T.contactsTeal : T.border}`, color: active ? T.contactsTealText : T.textSecondary, background: active ? `${T.contactsTeal}15` : "transparent"}}>
                  {p}
                </div>
              );
            })}
          </div>
          {/* ADDED 26 Aug 2026 — real ask: filter by Accommodation and
              Drives, alongside Role/Position. */}
          <div style={{ ...TYPE.sectionLabel, color: T.textSecondary, marginBottom: 4 }}>{tr("contacts.accommodation", "Accommodation")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {HOSTS_OPTIONS.map((h) => {
              const active = filterHosts.includes(h);
              return (
                <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} key={h} onClick={() => setFilterHosts((f) => active ? f.filter((x) => x !== h) : [...f, h])}
                  style={{ padding: "5px 10px", borderRadius: radius.full, fontSize: TYPE.control.fontSize, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? T.contactsTeal : T.border}`, color: active ? T.contactsTealText : T.textSecondary, background: active ? `${T.contactsTeal}15` : "transparent"}}>
                  {h}
                </div>
              );
            })}
          </div>
          <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => setFilterDrives((d) => !d)}
            style={{ display: "inline-flex", padding: "5px 10px", borderRadius: radius.full, fontSize: TYPE.control.fontSize, fontWeight: 600, cursor: "pointer", marginBottom: 6, border: `1px solid ${filterDrives ? T.contactsTeal : T.border}`, color: filterDrives ? T.contactsTealText : T.textSecondary, background: filterDrives ? `${T.contactsTeal}15` : "transparent"}}>
            Drives
          </div>
          {!anonymise && (
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10, marginTop: 8 }}>
              <div style={{ ...TYPE.sectionLabel, color: T.textSecondary, marginBottom: 4 }}>Availability</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[
                  { key: "now", label: tr("contacts.availableNow", "Available now") },
                  { key: "soon", label: tr("contacts.availableSoon", "Soon · next 24 hours") },
                  { key: "at", label: tr("contacts.availableAtTime", "At a set time") },
                ].map(({ key, label }) => {
                  const active = filterAvailability === key;
                  return <button key={key} type="button" aria-pressed={active} onClick={() => setFilterAvailability((current) => current === key ? "" : key)}
                    style={{ padding: "6px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? T.contactsTeal : T.border}`, color: active ? T.contactsTealText : T.textSecondary, background: active ? `${T.contactsTeal}15` : "transparent" }}>{label}</button>;
                })}
              </div>
              {filterAvailability === "at" && (
                <label style={{ display: "block", marginTop: 8, color: T.textSecondary, fontSize: 11 }}>
                  Your local date and time
                  <input type="datetime-local" aria-label="Check availability at your local date and time" value={filterAvailabilityAt} min={localDateTimeInputValue(availabilityNow)} onChange={(e) => setFilterAvailabilityAt(e.target.value)}
                    style={{ display: "block", width: "100%", minHeight: 44, boxSizing: "border-box", marginTop: 4, padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: FONT_FAMILY, fontSize: TYPE.control.fontSize }} />
                </label>
              )}
              <div style={{ fontSize: 10, color: T.textDisabled, marginTop: 5 }}>Weekly windows use each contact's local timezone. Filters only include contacts with a saved weekly schedule.</div>
            </div>
          )}
          {activeFilterCount > 0 && (
            <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => { setFilterRoles([]); setFilterPositions([]); setFilterHosts([]); setFilterDrives(false); setFilterAvailability(""); }} style={{ fontSize: TYPE.control.fontSize, color: T.textSecondary, textDecoration: "underline", cursor: "pointer", display: "block", marginTop: 6}}>
              Clear filters
            </div>
          )}

          <div aria-live="polite" aria-atomic="true" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" }}>
            {filtered.length > 0 ? `${filtered.length} contacts${activeFilterCount > 0 ? ` (${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""} active)` : ""}` : activeContacts.length === 0 ? "No contacts" : "No contacts match"}
          </div>
        </div>
      )}

      {/* FIXED — real accessibility finding (10 Sep 2026, automated
          axe-core scan): a horizontally-scrolling region with no way
          for a keyboard user to reach or operate it at all — no
          tabIndex, so Tab skips straight over it. tabIndex={0} makes
          the region itself focusable (arrow keys then scroll it),
          matching axe's own "scrollable-region-focusable" fix. The
          chips inside are still plain onClick divs, not real buttons —
          a real, bigger gap (this exact pattern repeats across many
          chip/pill UI elements app-wide), deliberately out of scope
          for this narrower fix; see CLAUDE.md's Known Issues for the
          honest, not-yet-done accessibility work this surfaced. */}
      <div role="group" aria-label="Sort contacts" tabIndex={0} style={{ display: "flex", gap: 8, padding: "0 16px 14px", overflowX: "auto" }}>
        {[
          { key: "name", label: "A–Z" },
          { key: "lastEncounter", label: "Last encounter" },
          { key: "incomplete", label: "Incomplete" },
        ].map((opt) => (
          <div key={opt.key} onClick={() => setSortBy(opt.key)} role="button" tabIndex={0} aria-pressed={sortBy === opt.key} aria-label={opt.label || opt.key} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSortBy(opt.key); } }}
            style={{ padding: "6px 12px", borderRadius: radius.full, fontSize: TYPE.control.fontSize, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", border: `1px solid ${sortBy === opt.key ? T.contactsTeal : T.border}`, color: sortBy === opt.key ? T.contactsTealText : T.textSecondary}}>
            {opt.label}
          </div>
        ))}
        {/* 3-state date sort toggle: off → newest → oldest → off */}
        <div onClick={() => {
          if (sortBy === "newest") setSortBy("oldest");
          else if (sortBy === "oldest") setSortBy("name");
          else setSortBy("newest");
        }} role="button" tabIndex={0} aria-pressed={sortBy === "newest" || sortBy === "oldest"} aria-label={sortBy === "newest" ? "Sort by date newest first" : sortBy === "oldest" ? "Sort by date oldest first" : "Sort by date"}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (sortBy === "newest") setSortBy("oldest"); else if (sortBy === "oldest") setSortBy("name"); else setSortBy("newest"); } }}
          style={{ padding: "6px 12px", borderRadius: radius.full, fontSize: TYPE.control.fontSize, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", border: `1px solid ${sortBy === "newest" || sortBy === "oldest" ? T.contactsTeal : T.border}`, color: sortBy === "newest" || sortBy === "oldest" ? T.contactsTealText : T.textSecondary, display: "flex", alignItems: "center", gap: 4 }}>
          {sortBy === "newest" ? "↓ Newest" : sortBy === "oldest" ? "↑ Oldest" : "Date"}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          T={T}
          padding="60px 20px"
          message={activeContacts.length === 0 ? "No contacts yet." : "No contacts match your search."}
        />
      ) : (
        /* FIXED 16 Sep 2026 — real report: cards read as mobile-width
           content stretched into a wide row, all the empty width
           wasted. A real CSS grid on desktop (each card keeping its
           own natural ~340px+ width, 2-4 per row depending on
           viewport) instead of one full-width stacked column —
           ContactCard's own internal JSX is completely untouched,
           only how many sit per row changes. Mobile keeps the exact
           prior single-column flex list. */
        <div ref={gridRef} style={isDesktopWidth ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 10, padding: "0 16px 100px" } : { display: "flex", flexDirection: "column", gap: 10, padding: "0 16px 100px" }}>
          {filtered.map((c, idx) => (
            <div key={c.id} data-contact-idx={idx} style={{ position: "relative" }}>
              <ContactCard contact={c} onOpen={onOpen} T={T} summary={encounterSummaries.get(c.id) || EMPTY_ENCOUNTER_SUMMARY} anonymise={anonymise} inactiveThresholdDays={inactiveThresholdDays} showRoleOnCards={showRoleOnCards} showAvailabilityOnCards={showAvailabilityOnCards}
                activeFilters={activeFilterCount > 0 ? { roles: filterRoles, positions: filterPositions, hosts: filterHosts, drives: filterDrives, availability: availabilityFilterLabel } : null}
                selectMode={selectMode} selected={selectedIds.includes(c.id)} onToggleSelected={toggleSelected} onLongPress={(id) => { setSelectMode(true); toggleSelected(id); }}
                onToggleFavourite={async (id) => { await ContactRepository.update(id, { favourited: !c.favourited }); refresh(); }} />
            </div>
          ))}
        </div>
      )}
      {runningCountEnabled && filtered.length > 0 && (
        <div style={{ position: "fixed", bottom: "calc(80px + env(safe-area-inset-bottom))", right: 16, background: "#1B1B1F", color: "#FFFFFF", padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, zIndex: 50, boxShadow: "0 2px 8px rgba(0,0,0,.2)" }}>
          {Math.min(firstVisible + 1, filtered.length)} / {filtered.length}
        </div>
      )}

        <button onClick={() => { const next = !runningCountEnabled; setRunningCountEnabled(next); try { localStorage.setItem("shos-contacts-running-count", next ? "on" : "off"); } catch {} }} style={{ position: "fixed", bottom: "calc(80px + env(safe-area-inset-bottom))", right: runningCountEnabled && filtered.length > 0 ? 120 : 16, background: T.surface, color: T.textSecondary, border: `1px solid ${T.border}`, padding: "6px 10px", borderRadius: 999, fontSize: 11, cursor: "pointer", zIndex: 50 }}>
          {runningCountEnabled ? "Count on" : "Count off"}
        </button>

      {/* ADDED 26 Aug 2026 — real ask: undo for delete. CHANGED to also
          support redo, matching editUndoHelpers.js's own undo/redo
          toast pattern for consistency. */}
      {deleteToast && (
        <UndoToast
          mode={deleteToast.mode}
          message={deleteToast.mode === "undo"
            ? `${deleteToast.records.length} contact${deleteToast.records.length > 1 ? "s" : ""} deleted`
            : `${deleteToast.records.length} contact${deleteToast.records.length > 1 ? "s" : ""} restored`}
          accentColor={T.contactsTeal}
          onAction={deleteToast.mode === "undo" ? undoDelete : redoDelete}
        />
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
      <div style={{ position: "fixed", bottom: "calc(90px + env(safe-area-inset-bottom))", left: 0, right: 0, display: "flex", justifyContent: "flex-end", padding: "0 20px", pointerEvents: "none", zIndex: 20 }}>
        <div onClick={onAdd} role="button" tabIndex={0} aria-label="Add contact" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAdd(); } }} style={{ width: 56, height: 56, borderRadius: radius.full, background: T.fabBg, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,.25)", cursor: "pointer", minHeight: 44, pointerEvents: "auto" }}>
          <Plus size={24} color={T.fabIcon} />
        </div>
      </div>
    </div>
  );
}

// ADDED 15 Sep 2026 — real ask: audit whether global-Settings items
// would fit better living in each module's own settings, creating one
// where a module doesn't have one yet (but not for a single lone
// setting — keep it in global Settings then), with a consistent
// placement/appearance, following the exact pattern
// MedicationSettingsScreen already established (26 Aug 2026): a gear
// icon in the module's own banner, opening a screen with the same
// sticky-header/back-chevron shape, ending in a "Go to general app
// settings" link. Contacts had 2 real settings sitting in global
// Settings > Preferences with no in-module home of their own —
// exactly the "2+ settings, no existing screen" case worth a new one.
function InactiveThresholdCard({ T, tr, onUpdated }) {
  const [prefs, setPrefs] = useLoadedState(() => AppPreferencesRepository.getPreferences(), [], DEFAULT_APP_PREFERENCES);
  const [draftValue, setDraftValue] = useState(() => String(prefs.inactiveThresholdDays));
  useEffect(() => { setDraftValue(String(prefs.inactiveThresholdDays)); }, [prefs]);

  const save = async () => {
    const parsed = parseInt(draftValue, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    setPrefs(await AppPreferencesRepository.update({ inactiveThresholdDays: parsed }));
    onUpdated?.();
  };

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: 16 }}>
      <div style={{ fontSize: TYPE.control.fontSize, fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>{tr("contacts.inactiveContactThreshold", "Inactive contact threshold")}</div>
      <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 12 }}>
        Days since a Contact's last Encounter before it shows the red "inactive" flag. A specific contact can also be excluded from this entirely (edit that contact → "One-off / never expect to recur").
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={draftValue} onChange={(e) => setDraftValue(e.target.value)} type="number" min="1"
          style={{ width: 90, padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 14, boxSizing: "border-box", background: T.surfaceVariant, color: T.textPrimary }} />
        <span style={{ fontSize: TYPE.control.fontSize, color: T.textSecondary }}>days</span>
        <button onClick={save} style={{ marginLeft: "auto", padding: "10px 18px", borderRadius: 999, border: "none", background: T.contactsBanner, color: "#FFFFFF", fontWeight: 700, cursor: "pointer"}}>
          Save
        </button>
      </div>
      <div style={{ fontSize: 11, color: T.textDisabled, marginTop: 10 }}>Currently: {prefs.inactiveThresholdDays} days.</div>
    </div>
  );
}

function ShowRoleOnCardsToggleCard({ T, onUpdated }) {
  const [prefs, setPrefs] = useLoadedState(() => AppPreferencesRepository.getPreferences(), [], DEFAULT_APP_PREFERENCES);
  const toggle = async () => {
    setPrefs(await AppPreferencesRepository.update({ showRoleOnContactCards: !prefs.showRoleOnContactCards }));
    onUpdated?.();
  };
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: 16 }}>
      <div onClick={toggle} role="switch" tabIndex={0} aria-checked={prefs.showRoleOnContactCards} aria-label="Show Dom/sub and Top/bottom on contact cards"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", minHeight: 44 }}>
        <div style={{ flex: 1, paddingRight: 12 }}>
          <div style={{ fontSize: TYPE.control.fontSize, fontWeight: 600, color: T.textPrimary }}>Show Dom/sub & Top/bottom on cards</div>
          <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>Already shown on a contact's own profile — this adds it to the list view too, visible at a glance. Off by default.</div>
        </div>
        <div style={{ width: 40, height: 24, borderRadius: 999, background: prefs.showRoleOnContactCards ? T.contactsTeal : T.border, position: "relative", flexShrink: 0 }}>
          <div style={{ position: "absolute", top: 2, left: prefs.showRoleOnContactCards ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: "#FFFFFF" }} />
        </div>
      </div>
    </div>
  );
}

function ShowAvailabilityOnCardsToggleCard({ T, onUpdated }) {
  const { t: tr } = useTranslation();
  const [prefs, setPrefs] = useLoadedState(() => AppPreferencesRepository.getPreferences(), [], DEFAULT_APP_PREFERENCES);
  const enabled = prefs.showAvailabilityOnContactCards === true;
  const toggle = async () => {
    setPrefs(await AppPreferencesRepository.update({ showAvailabilityOnContactCards: !enabled }));
    onUpdated?.();
  };
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: 16 }}>
      <div onClick={toggle} role="switch" tabIndex={0} aria-checked={enabled} aria-label={tr("contacts.showAvailabilityOnCards", "Show weekly availability on contact cards")}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", minHeight: 44 }}>
        <div style={{ flex: 1, paddingRight: 12 }}>
          <div style={{ fontSize: TYPE.control.fontSize, fontWeight: 600, color: T.textPrimary }}>{tr("contacts.showAvailabilityOnCards", "Show weekly availability on contact cards")}</div>
          <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>{tr("contacts.availabilityCardSummary", "Adds a compact schedule summary to list cards. Off by default.")}</div>
        </div>
        <div style={{ width: 40, height: 24, borderRadius: 999, background: enabled ? T.contactsTeal : T.border, position: "relative", flexShrink: 0 }}>
          <div style={{ position: "absolute", top: 2, left: enabled ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: "#FFFFFF" }} />
        </div>
      </div>
    </div>
  );
}

function ContactsSettingsScreen({ onClose, onOpenGeneralSettings, onOpenPrivacySettings, onPreferencesUpdated, T }) {
  const { t: tr } = useTranslation();
  useEscapeToClose(onClose);
  const settingsRef = useRef(null);
  useEffect(() => { settingsRef.current?.focus(); }, []);

  return (
    <div role="dialog" aria-label="Contacts settings" ref={settingsRef} tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: T.bg, zIndex: 220, overflowY: "auto", fontFamily: FONT_FAMILY }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer", padding: 11, boxSizing: "content-box", marginTop: -11, marginRight: -11, marginBottom: -11, marginLeft: -11}} onClick={onClose} role="button" tabIndex={0} aria-label={tr("common.back", "Back")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: T.textPrimary }}>{tr("contacts.settings", "Contacts settings")}</h1>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 12 }}><InactiveThresholdCard T={T} tr={tr} onUpdated={onPreferencesUpdated} /></div>
        <div style={{ marginBottom: 12 }}><ShowRoleOnCardsToggleCard T={T} onUpdated={onPreferencesUpdated} /></div>
        <div style={{ marginBottom: 20 }}><ShowAvailabilityOnCardsToggleCard T={T} onUpdated={onPreferencesUpdated} /></div>
        {/* ADDED — real ask: link to Privacy settings for Anonymise mode */}
        {onOpenPrivacySettings && (
          <div onClick={onOpenPrivacySettings} role="button" tabIndex={0} aria-label="Open privacy settings" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenPrivacySettings(); } }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 12, background: T.surface, border: `1px solid ${T.border}`, marginBottom: 12, cursor: "pointer", minHeight: 44 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14, color: T.textPrimary }}>{tr("contacts.anonymiseMode", "Anonymise mode")}</span>
            </div>
            <ChevronRight size={16} color={T.textDisabled} />
          </div>
        )}
        <div onClick={onOpenGeneralSettings} role="button" tabIndex={0} aria-label="Go to general app settings" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenGeneralSettings(); } }} style={{ textAlign: "center", fontSize: TYPE.control.fontSize, color: T.textSecondary, textDecoration: "underline", cursor: "pointer", padding: "12px 0"}}>
          Go to general app settings
        </div>
      </div>
    </div>
  );
}

export default function ContactsModule({ openAddOnMount = false, onConsumedQuickAdd, openRecordId, onConsumedRecordOpen, onNavigateToRecord, onOpenSettings, onOpenPrivacySettings, onOpenGlossary, registerModuleBackHandler, onQuickExit } = {}) {
  const reducedMotion = useReducedMotion();
  const [contacts, setContacts] = useLoadedState(() => loadContacts(), [], []);
  // FIXED — real crash found via a live bulk-delete/bulk-archive audit:
  // loadContacts() returns ContactRepository.getAll(), async since this
  // repository's own Phase 2 conversion — setContacts(loadContacts())
  // was setting state to a raw, unresolved Promise, crashing the very
  // next render's `contacts.filter(...)` in ContactsList. Same pattern
  // already fixed for Encounters' own loadContacts/loadEncounters.
  const refresh = () => { loadContacts().then(setContacts); };
  // ADDED 19 Aug 2026 — real undo/redo, same shared mechanism as
  // Encounters — see editUndoHelpers.js.
// FIXED 27 Sep 2026 - onChanged is the callback useEditUndo fires after
  // an undo or redo, to tell the host module its list is now stale. Without it
  // the repository write succeeds and the toast says "undone", but the list
  // still shows the edited value - the app claims an undo worked while
  // displaying the opposite. 7 of 11 call sites omitted it; MenstrualHealth and
  // SymptomLog were the only two already passing it.
  const editUndo = useEditUndo(ContactRepository, refresh);

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
  const [showContactsSettings, setShowContactsSettings] = useState(false);
  const [preferencesVersion, setPreferencesVersion] = useState(0);
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? buildDark() : buildLight();
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
  const undoDelete = async () => {
    if (!deleteToast) return;
    for (const record of deleteToast.records) await ContactRepository.restore(record);
    refresh();
    clearTimeout(undoTimerRef.current);
    // Records are back — offer a brief "redo" (re-delete) in case the
    // undo itself was the mistake, same as edit undo/redo already does.
    setDeleteToast({ mode: "redo", records: deleteToast.records });
    undoTimerRef.current = setTimeout(() => setDeleteToast(null), 8000);
  };
  const redoDelete = async () => {
    if (!deleteToast) return;
    await TrashRepository.add("contacts", deleteToast.records);
    for (const r of deleteToast.records) await ContactRepository.delete(r.id);
    refresh();
    setDeleteToast(null);
    clearTimeout(undoTimerRef.current);
  };
  // Single source of truth for "delete this record safely" — Trash
  // write + toast, used identically whether triggered from the List's
  // bulk-select toolbar or a single record's own Profile screen.
  const triggerDelete = async (records) => {
    await TrashRepository.add("contacts", records);
    for (const r of records) await ContactRepository.delete(r.id);
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
      if (showContactsSettings) { setShowContactsSettings(false); return true; }
      if (showMyProfile) { setShowMyProfile(false); return true; }
      if (showImportProfile) { setShowImportProfile(false); return true; }
      if (screen === "profile") { backToList(); return true; }
      return false;
    });
    return () => registerModuleBackHandler(null);
    // backToList deliberately omitted — it's a stateless dispatcher
    // (setScreen("list"); refresh();), identical behaviour regardless
    // of which render's closure gets called; every real dependency its
    // own condition (screen === "profile") reads is already listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingContact, showContactsSettings, showMyProfile, showImportProfile, screen, registerModuleBackHandler]);

  const saveEdit = async (form) => {
    if (editingContact && editingContact.id) {
      // ADDED 19 Aug 2026 — real undo/redo: snapshot right before the
      // real update happens, so undo restores the genuine pre-edit
      // state.
      await editUndo.captureBeforeEdit(editingContact.id);
      await ContactRepository.update(editingContact.id, form);
      await editUndo.notifyEdited(editingContact.id);
    } else {
      await ContactRepository.create(form);
    }
    refresh();
    setEditingContact(null);
  };

  return (
    <div style={{ fontFamily: FONT_FAMILY, background: T.bg, minHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))", display: "flex", justifyContent: "center" }}>
      {/* ADDED 19 Aug 2026 — real undo/redo toast, same visual pattern
          as Medication's own, kept consistent. */}
      {/* CHANGED — real ask: this sat at top:12, directly on top of
          the screen's own back button — the instinctive "do the edit,
          then tap back" motion hit the toast instead. top:64 clears
          every header shape in this app. */}
      {editUndo.toast && (
        <div onClick={editUndo.toast.mode === "undo" ? editUndo.undo : editUndo.redo}
          role="button" tabIndex={0} aria-live="polite"
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (editUndo.toast.mode === "undo" ? editUndo.undo : editUndo.redo)(); } }}
          style={{ position: "fixed", top: 64, left: "50%", transform: "translateX(-50%)", width: 340, background: editUndo.toast.mode === "undo" ? "#1B1B1F" : T.contactsTeal, color: "#FFFFFF", borderRadius: 999, padding: "10px 16px", fontSize: TYPE.control.fontSize, fontWeight: 600, textAlign: "center", cursor: "pointer", minHeight: 44, boxShadow: "0 8px 24px rgba(0,0,0,.25)", zIndex: 230, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
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
      <div style={{ width: "100%", background: T.bg, minHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))" }}>
        {screen === "list" ? (
          <ContactsList contacts={contacts} T={T} onOpen={openProfile} onAdd={() => setEditingContact({})} sortBy={sortBy} setSortBy={setSortBy} query={query} setQuery={setQuery}
            onOpenMyProfile={() => setShowMyProfile(true)} onOpenImportProfile={() => setShowImportProfile(true)} onOpenContactsSettings={() => setShowContactsSettings(true)} onQuickExit={onQuickExit} refresh={refresh}
            deleteToast={deleteToast} undoDelete={undoDelete} redoDelete={redoDelete} triggerDelete={triggerDelete} onOpenGlossary={onOpenGlossary} preferencesVersion={preferencesVersion} />
        ) : (
          <ContactProfile contactId={activeContactId} T={T} onBack={backToList} onEdit={async (id) => setEditingContact(await ContactRepository.getById(id))} onOpenContact={openProfile} refresh={refresh} onNavigateToRecord={onNavigateToRecord} triggerDelete={triggerDelete} onOpenGlossary={onOpenGlossary} />
        )}

        {editingContact !== null && (
          <ContactEditSheet contact={editingContact.id ? editingContact : null} contacts={contacts} onSave={saveEdit} onClose={() => setEditingContact(null)} refresh={refresh} T={T} onOpenGlossary={onOpenGlossary} />
        )}

        {/* CHANGED 18 Aug 2026 — removed this module's own static, non-
            functional bottom bar (it only ever showed "Contacts",
            regardless of which screen was actually active — the exact
            inconsistency the user flagged). The real persistent nav now
            lives once, in App.jsx, shared across every module. */}
        {showMyProfile && (
          <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", zIndex: 210 }}>
            <MyProfileModule onClose={() => setShowMyProfile(false)} registerModuleBackHandler={registerModuleBackHandler} onOpenGlossary={onOpenGlossary} />
          </div>
        )}
        {showImportProfile && (
          <ImportSharedProfileSheet T={T} onClose={() => setShowImportProfile(false)} onImported={refresh} />
        )}
        {showContactsSettings && (
          <ContactsSettingsScreen T={T} onClose={() => setShowContactsSettings(false)} onOpenGeneralSettings={() => { setShowContactsSettings(false); onOpenSettings?.(); }} onOpenPrivacySettings={onOpenPrivacySettings} onPreferencesUpdated={() => setPreferencesVersion((v) => v + 1)} />
        )}
      </div>
    </div>
  );
}

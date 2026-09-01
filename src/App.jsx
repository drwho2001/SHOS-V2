import React, { useState, useRef, useEffect } from "react";
import ContactsModule from "./modules/SHOS_Contacts_Prototype";
import { useDarkModePreference } from "./calculations/darkModePreference";
import { NEUTRAL_DARK as DARK } from "./calculations/designTokens";
// ADDED — real architecture extraction, see each file's own header.
import HomeScreen from "./modules/SHOS_Home_Prototype";
import HealthcareScreen from "./modules/SHOS_Healthcare_Prototype";
import MedicationDashboard from "./modules/SHOS_Medication_Dashboard_Prototype";
import EncountersModule from "./modules/SHOS_Encounters_Prototype";
import { exportBackup, inspectBackupFile, decryptBackupEnvelope, restoreFromParsedBackup, EXPORT_GROUPS } from "./storage/backupService";
import { localStorageAdapter } from "./storage/storageAdapter";
// ADDED — real architecture extraction, see that file's own header.
import SettingsScreen from "./modules/SHOS_Settings_Prototype";
import GlobalSearchScreen from "./modules/SHOS_GlobalSearch_Prototype";
import RegistryManagementScreen from "./modules/SHOS_RegistryManagement_Prototype";
import OptionListsScreen from "./modules/SHOS_OptionListEditor_Prototype";
import { PrivacySettingsRepository } from "./repositories/privacySettingsRepository";
import { checkBiometryAvailable, authenticateWithBiometrics } from "./storage/biometricAuthService";
import { AppPreferencesRepository } from "./repositories/appPreferencesRepository";
// ADDED — real ask: "standardise UI/appearance." Shared design tokens,
// the actual foundation — see designTokens.js for full reasoning and
// honest scope (this is a start, not a finished migration).
import { NEUTRAL, ACCENTS, ACTION, FONT_FAMILY, RADIUS } from "./calculations/designTokens";
// ADDED — real ask: Home's title should read "[Name]'s dashboard".
import { HouseIcon as Home, UsersIcon as Users, PulseIcon as Activity, PillIcon as Pill, HeartbeatIcon as HeartPulse, HospitalIcon as Hospital, DownloadSimpleIcon as Download, UploadSimpleIcon as Upload, CaretRightIcon as ChevronRight, GearIcon as SettingsIcon, CaretLeftIcon as ChevronLeft, UserIcon as User, MagnifyingGlassIcon as Search, DatabaseIcon as Database, TrashIcon as Trash2, WarningIcon as AlertTriangle, CheckIcon as Check, ClipboardTextIcon as ClipboardList, TreeStructureIcon as ListTree, PaperclipIcon as Paperclip, ClockCounterClockwiseIcon as History, EyeSlashIcon as EyeOff, EyeIcon as Eye, TestTubeIcon as TestTube, FireIcon as Flame, ShieldIcon as Shield, StethoscopeIcon as Stethoscope, MicroscopeIcon as Microscope, ListChecksIcon as ClipboardCheck, SyringeIcon as Syringe, ThermometerIcon as Thermometer, CalendarIcon as Calendar, CreditCardIcon as CreditCard, FingerprintIcon as Fingerprint, LockIcon as Lock } from "@phosphor-icons/react";
// CHANGED — real Tier 1 decision: Phosphor, replacing lucide-react.
// Every icon aliased directly in ONE import statement, back to its
// original lucide name — deliberately one consistent pattern (not
// mixed with a separate const-reassignment block, which got messy on
// a first attempt and was corrected before shipping) so every actual
// icon *usage* below is completely unchanged, only the import source
// changed. Real, flagged uncertainty: ClipboardCheck/ClipboardList
// needed different real Phosphor names to avoid a genuine naming
// collision (both used in this same file) — used the closest real
// equivalents, worth a visual spot-check once installed for real.

// CHANGED 18 Aug 2026 — real persistent bottom nav, replacing the old
// top switcher. Per Doc 1 (Master Navigation Map v1.0): five tabs —
// Home · Contacts · Activity · Medication · Healthcare. Healthcare
// doesn't exist as a real screen yet (needs Testing/Vaccination/Clinic
// Visits, none built), shown but disabled rather than omitted or
// faked. Home is now real (see HomeScreen below, added 19 Aug 2026) —
// a genuine summary + quick-add screen, not a placeholder.
//
// My Profile is deliberately NOT a tab here — Doc 1 places it under
// Settings, not primary nav. Reached from Contacts for now (see the
// header icon in SHOS_Contacts_Prototype.jsx) until a real Settings
// screen exists to give it a permanent home.
// CHANGED 19 Aug 2026 — Healthcare is now real, starting with Testing.
// Doc 1 groups Testing/Clinic Visits/Vaccinations/Symptoms Tracker
// under one Healthcare tab; only Testing exists so far (Clinic Visits/
// Vaccinations/Symptoms Tracker deliberately not started this session
// — see testingRepository.js's header for the scope-cut reasoning).
// Healthcare's own component is Testing directly for now; if/when the
// others exist, this tab gets its own internal sub-nav rather than
// staying single-purpose.
// ADDED 19 Aug 2026 — Healthcare now has two real modules (Testing,
// Clinic Visits), so it needs its own internal sub-nav rather than
// pointing straight at one module. A simple segmented control, not a
// second bottom nav — Doc 1 only specifies one bottom nav bar.
// Quick-add always lands on Testing's sub-tab specifically, matching
// Home's existing "Log test" button; Clinic Visits' own quick-add
// (added this round) switches to that sub-tab instead.
// FIXED 26 Aug 2026 — this used to be a known scope limit: tapping a
// linked test from a Clinic Visit's detail view only switched to the
// Testing sub-tab's list, not a true deep-link to that specific
// test's detail screen. Turned out not to need the bigger
// "every module accepts an open-this-record prop" infrastructure
// this comment originally called for — that mechanism (openRecordId/
// onConsumedRecordOpen) already existed for the app-wide Global
// Search flow, and VisitDetail was ALREADY passing the specific test
// id (onOpenTest?.(t.id)) — Healthcare's own wiring was just
// discarding it. Real fix in SHOS_Healthcare_Prototype.jsx: a local
// pendingTestId state, merged with the global openRecordId when
// rendering TestingModule.

// CHANGED 19 Aug 2026 — reordered per the user's ask: Contacts, Activity,
// Home (centred), Medication, Healthcare. Each tab now carries its own
// accent color, matching that module's own established theme (Contacts
// teal, Activity pink, Medication blue, Healthcare blue) — the nav
// icons themselves stayed one flat color before, inconsistent with
// every module's own color identity. Home gets its own distinctive
// treatment (dark, circular, raised) rather than a flat accent, since
// it isn't tied to one domain color the way the other four are — see
// the nav bar's own render logic below for the raised-circle styling.
// CHANGED 20 Aug 2026 — real bug found in the design-unification pass:
// Medication's nav accent (#3B82F6) didn't actually match Medication
// Dashboard's own accent (medsBlue, #3D63C9/ACCENTS.medication) despite
// this comment block's own stated intent above — the nav tab and home
// quick-add button were a visibly different, lighter blue than the
// screen they represent. Now reads from ACCENTS directly (same as the
// other three domain tabs, already imported in this file) so this
// can't silently drift from the module's own color again.
// ADDED — real ask: "opening back to last page" — the grace window for
// resuming on the last tab instead of Home, in minutes. A guide value
// per the user's own framing, not exposed as a configurable setting —
// mirrors App Lock's own appLockGraceMinutes in spirit, just a fixed
// constant rather than a second user-facing dial for a low-stakes
// navigation convenience.
const RESUME_GRACE_MINUTES = 10;

const TABS = [
  { key: "contacts", label: "Contacts", icon: Users, component: ContactsModule, accent: ACCENTS.contacts },
  { key: "activity", label: "Encounter", icon: Activity, component: EncountersModule, accent: ACCENTS.encounters },
  { key: "home", label: "Home", icon: Home, component: null, accent: ACCENTS.home },
  { key: "medication", label: "Medication", icon: Pill, component: MedicationDashboard, accent: ACCENTS.medication },
  { key: "healthcare", label: "Healthcare", icon: Hospital, component: HealthcareScreen, accent: ACCENTS.healthcare },
];

// ADDED 19 Aug 2026 — real Home screen: a genuine summary of recent
// activity across the three built modules, plus quick-add buttons that
// actually jump straight into each module's real add flow (not just
// switch tabs and leave you to find the button yourself — see
// onQuickAdd below and the matching openAddOnMount prop each module
// now accepts). Reads directly from each repository on mount; this is
// a summary screen, not something that needs to stay live-reactive to
// changes happening on OTHER tabs while you're looking at Home.

// (Settings screen and its whole sub-tree — Export, Developer Tools,
// Registries, Privacy, Preferences — now live in
// modules/SHOS_Settings_Prototype.jsx. Real extraction, not deleted;
// see that file's own header for the reasoning.)

// ADDED 19 Aug 2026 — App Lock's own lock screen, real ask. Shown
// instead of the normal app whenever appLockEnabled is on — gates
// opening the app itself, distinct from Anonymise mode (which stays
// active independently once you're past this). Never on by default;
// reuses the same PIN as Anonymise mode's revert, per
// privacySettingsRepository.js's own reasoning.
// CHANGED — real ask: biometric unlock, layered on top of the PIN
// that already gates this screen — never a replacement. The PIN
// field below is always usable regardless of biometric state; a
// cancelled/failed/unavailable biometric attempt just leaves you here
// with the PIN field, same as before this existed.
function AppLockScreen({ onUnlock, onUnlockDecoy }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricAttempting, setBiometricAttempting] = useState(false);

  // CHANGED 1 Sep 2026 — real ask: a duress/decoy PIN. Routes to
  // whichever of the two real PINs was entered — see
  // classifyAppLockPin's own comment for why they have to be different
  // codes for this to work at all.
  const attempt = () => {
    const result = PrivacySettingsRepository.classifyAppLockPin(pin);
    if (result === "real") {
      onUnlock();
    } else if (result === "duress") {
      onUnlockDecoy();
    } else {
      setError("Incorrect PIN.");
      setPin("");
    }
  };

  const tryBiometric = async () => {
    setBiometricAttempting(true);
    const ok = await authenticateWithBiometrics("Unlock SHOS");
    setBiometricAttempting(false);
    if (ok) onUnlock();
  };

  // Checked fresh on every mount (device biometry can change while the
  // app is backgrounded — enrollment added/removed, etc.), not just
  // trusted from the stored preference. Auto-prompts once, the moment
  // the lock screen appears, same convenience as most apps with
  // biometric unlock — cancelling it is completely harmless, the PIN
  // field is right there.
  // FIXED 1 Sep 2026 — real ask: "Biometrics not correctly working.
  // Sometimes does." This screen mounts synchronously the instant
  // App.jsx's own appStateChange listener sees isActive:true — i.e.
  // right as Android's Activity.onResume() begins, not once the window
  // has actually regained focus. Firing the native BiometricPrompt
  // that early races the OS's own resume sequence: it only shows
  // reliably once the window is genuinely focused, so whether it
  // worked came down to how much incidental delay checkBiometryAvailable's
  // own promise chain happened to add — "sometimes" by pure timing
  // luck. A short, deliberate delay before the prompt (a documented
  // workaround for this exact class of bug in Capacitor biometric
  // plugins) gives the window time to settle first.
  useEffect(() => {
    if (!PrivacySettingsRepository.getSettings().biometricUnlockEnabled) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      checkBiometryAvailable().then((result) => {
        if (cancelled) return;
        setBiometricAvailable(result.available);
        if (result.available) tryBiometric();
      });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#1B1B1F", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 999, fontFamily: "'Inter', sans-serif" }}>
      <Eye size={32} color="#FFFFFF" style={{ marginBottom: 16, opacity: 0.6 }} />
      <div style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF", marginBottom: 16 }}>Enter PIN to unlock</div>
      {biometricAvailable && (
        <button onClick={tryBiometric} disabled={biometricAttempting}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.4)", background: "transparent", color: "#FFFFFF", fontWeight: 600, fontSize: 13, cursor: biometricAttempting ? "default" : "pointer", marginBottom: 16, opacity: biometricAttempting ? 0.6 : 1 }}>
          <Fingerprint size={16} /> {biometricAttempting ? "Checking…" : "Unlock with biometrics"}
        </button>
      )}
      <input value={pin} onChange={(e) => { setPin(e.target.value); setError(""); }} type="password" inputMode="numeric" autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") attempt(); }}
        style={{ width: 200, padding: "12px 16px", borderRadius: 8, border: "none", fontSize: 16, textAlign: "center", marginBottom: 12, boxSizing: "border-box" }} />
      {error && <div style={{ fontSize: 12, color: ACTION.red, marginBottom: 12 }}>{error}</div>}
      <button onClick={attempt} style={{ padding: "10px 24px", borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>
        Unlock
      </button>
    </div>
  );
}

// ADDED 1 Sep 2026 — real ask: "dummy pin good idea." Entering the
// duress PIN on App Lock lands here instead of the real app —
// deliberately a self-contained fake, not a real screen fed real data:
// no repository is imported or called anywhere in this component, so
// there is zero risk of a real record ever leaking through a decoy
// session by accident. Mimics the real app's basic chrome (same tab
// bar, icons, labels, colours) closely enough to read as genuine at a
// glance.
// CHANGED 1 Sep 2026 — real ask: a hard-empty decoy is itself
// suspicious, since a genuinely fresh real install already ships with
// its own default demo data (see the seed data across
// contactRepository.js etc.) — an abuser who's seen the real app
// before, or simply expects a personal app to have SOME history in
// it, would read "PIN needed but nothing's here" as a tell that this
// isn't the real thing. Every tab below now shows plausible-looking
// static fake entries instead — hand-written strings baked directly
// into this component, NOT read from the real seed data or any
// repository (same zero-import invariant as before), so there is
// still no path for a real record to leak through here by accident.
// ADDED — manual relock (see HomeScreen's own onLockNow comment for
// the full reasoning): works the same way from inside a decoy session
// as it does in the real app — just returns to the PIN screen, never
// a path to real data.
const DECOY_CONTACTS = [
  { name: "Jamie", sub: "London · Last interaction 3 days ago" },
  { name: "Chris", sub: "Manchester · Last interaction 2 weeks ago" },
  { name: "Sam", sub: "London · Last interaction 1 month ago" },
];
const DECOY_ENCOUNTERS = [
  { title: "Drinks, then his place", sub: "6 days ago" },
  { title: "Coffee date", sub: "3 weeks ago" },
];
const DECOY_MEDS = [
  { name: "Vitamin D3", sub: "Daily · Last dose today" },
  { name: "Antihistamine (PRN)", sub: "As needed" },
];
const DECOY_HEALTH = [
  { title: "Routine screen", sub: "6 weeks ago · All clear" },
  { title: "Clinic visit — routine", sub: "6 weeks ago" },
];

function DecoyHome({ onLockNow }) {
  const [tab, setTab] = useState("home");

  const Row = ({ title, sub }) => (
    <div style={{ padding: "12px 14px", background: "#FFFFFF", border: "1px solid #DCDCE1", borderRadius: 12, marginBottom: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#1B1B1F" }}>{title}</div>
      <div style={{ fontSize: 12, color: "#656568", marginTop: 2 }}>{sub}</div>
    </div>
  );

  const tabContent = {
    home: (
      <>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#656568", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Recent activity</div>
        <Row title="Coffee date" sub="3 weeks ago" />
        <Row title="Vitamin D3 logged" sub="Today" />
      </>
    ),
    contacts: DECOY_CONTACTS.map((c) => <Row key={c.name} title={c.name} sub={c.sub} />),
    activity: DECOY_ENCOUNTERS.map((e) => <Row key={e.title} title={e.title} sub={e.sub} />),
    medication: DECOY_MEDS.map((m) => <Row key={m.name} title={m.name} sub={m.sub} />),
    healthcare: DECOY_HEALTH.map((h) => <Row key={h.title} title={h.title} sub={h.sub} />),
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#F0F0F3", display: "flex", flexDirection: "column", fontFamily: "'Inter', sans-serif", zIndex: 999 }}>
      <div style={{ padding: "20px 20px 12px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1B1B1F" }}>SHOS</div>
        {onLockNow && <Lock size={19} weight="bold" color="#1B1B1F" style={{ cursor: "pointer" }} onClick={onLockNow} title="Lock now" />}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 20px" }}>
        {tabContent[tab]}
      </div>
      <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", padding: "10px 0", borderTop: "1px solid #DCDCE1", background: "#FFFFFF", flexShrink: 0 }}>
        {TABS.map((t) => (
          <div key={t.key} onClick={() => setTab(t.key)}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", color: tab === t.key ? t.accent : "#656568" }}>
            <t.icon size={22} weight={tab === t.key ? "fill" : "regular"} />
            <span style={{ fontSize: 10, fontWeight: 600 }}>{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ADDED 19 Aug 2026 — real ask: a setup prompt offering App Lock when
// it isn't already on, shown on launch and kept reappearing on future
// launches until "Don't ask again" is explicitly tapped — NOT the
// same as just closing it once (X/"Not now" only dismisses THIS
// instance, deliberately, so it can genuinely nudge again later
// rather than vanish for good the first time someone's in a hurry).
//
// CRITICAL, per the user's own explicit worry: this must NEVER block
// access to the rest of the app. Every dismissal path (X, "Not now",
// "Don't ask again") gets you straight into the real app immediately
// — there's no path through this component that traps you. Tapping
// "Set up App Lock" takes you to Settings to actually configure it,
// rather than trying to build a PIN-setup flow inline here too.
function AppLockPrompt({ onDismiss, onDismissForever, onOpenSettings }) {
  const [darkMode] = useDarkModePreference();

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", zIndex: 998 }} onClick={onDismiss}>
      <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", width: "100%", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, fontFamily: "'Inter', sans-serif" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Eye size={20} color={ACCENTS.home} />
          <span style={{ fontSize: 15, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F" }}>Want to lock the app with a PIN?</span>
        </div>
        <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 16, lineHeight: 1.5 }}>
          Optional, and off by default — this just means nobody can open the app on this device without your PIN. You can turn it on any time from Settings → Privacy instead, if you'd rather decide later.
        </div>
        {/* CHANGED 26 Aug 2026 — real ask: App Lock is a Home/global
            concern, not a Healthcare one — was wrongly using
            ACCENTS.healthcare (green), now correctly Home's teal. */}
        <button onClick={onOpenSettings} style={{ width: "100%", padding: 14, borderRadius: 999, border: "none", background: ACCENTS.home, color: "#FFFFFF", fontWeight: 700, cursor: "pointer", marginBottom: 8 }}>
          Set up App Lock
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onDismiss} style={{ flex: 1, padding: 12, borderRadius: 999, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", background: "transparent", color: darkMode ? DARK.textSecondary : "#5B5B62", fontWeight: 600, cursor: "pointer" }}>
            Not now
          </button>
          <button onClick={onDismissForever} style={{ flex: 1, padding: 12, borderRadius: 999, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", background: "transparent", color: darkMode ? DARK.textDisabled : "#656568", fontWeight: 600, cursor: "pointer" }}>
            Don't ask again
          </button>
        </div>
      </div>
    </div>
  );
}

// ADDED 26 Aug 2026 — real ask: onboarding, deliberately built last —
// per the user's own ordering, a walkthrough is only worth building once
// there's something real to walk through, not before. Shown once,
// only when hasCompletedOnboarding is false (real single-user
// personal app — there's no concept of "a new user" beyond first
// launch on this device). Deliberately light — a handful of slides
// pointing at real features, not an interactive tutorial — matching
// this app's own "quick add" philosophy rather than forcing a long
// guided setup before letting the person actually use anything.
const ONBOARDING_SLIDES = [
  { title: "Welcome to SHOS", body: "Your own sexual health record — contacts, activity, testing, medication, and clinic visits, all in one private place on this device. Nothing leaves your phone unless you choose to export or share it." },
  { title: "Start with My Profile", body: "Settings → My Profile lets you record your own details, testing status, and preferences — it's also what gets shared if you ever export a profile to someone else." },
  { title: "DoxyPEP & reminders", body: "If it's relevant to you, SHOS can track the 72-hour DoxyPEP window after a qualifying activity, and remind you about daily medication doses — both real notifications, not just in-app banners." },
  { title: "Make it yours", body: "Settings → Design lets you customize each module's colour and switch to dark mode. Long-press (or tap Select) on any list to archive, delete, or export several records at once." },
];

function OnboardingScreen({ onFinish }) {
  const [step, setStep] = useState(0);
  const isLast = step === ONBOARDING_SLIDES.length - 1;
  const slide = ONBOARDING_SLIDES[step];

  return (
    <div style={{ position: "fixed", inset: 0, background: ACCENTS.home, display: "flex", flexDirection: "column", zIndex: 999, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#FFFFFF", marginBottom: 14 }}>{slide.title}</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>{slide.body}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 6, paddingBottom: 20 }}>
        {ONBOARDING_SLIDES.map((_, i) => (
          <div key={i} style={{ width: 6, height: 6, borderRadius: 999, background: i === step ? "#FFFFFF" : "rgba(255,255,255,0.35)" }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, padding: "0 24px 32px" }}>
        {!isLast && (
          <button onClick={onFinish} style={{ flex: 1, padding: "14px 0", borderRadius: 999, border: "1px solid rgba(255,255,255,0.5)", background: "transparent", color: "#FFFFFF", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
            Skip
          </button>
        )}
        <button onClick={() => isLast ? onFinish() : setStep((s) => s + 1)}
          style={{ flex: 1, padding: "14px 0", borderRadius: 999, border: "none", background: "#FFFFFF", color: ACCENTS.home, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          {isLast ? "Get started" : "Next"}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [darkMode] = useDarkModePreference();

  // ADDED — real bug found in real device testing: the actual HTML
  // <body> behind the app never had its own background set (no CSS
  // file sets one), so it defaulted to plain white. Any gap in a dark
  // screen's own coverage — a safe-area inset, overscroll bounce, a
  // rounding gap at an edge — showed that white straight through,
  // reading as "a white outline/panel behind dark screens". Synced
  // here so the actual document background always matches the live
  // theme, not just whatever each screen's own container happens to
  // cover.
  useEffect(() => {
    document.body.style.background = darkMode ? DARK.bg : "#F0F0F3";
  }, [darkMode]);

  // ADDED 19 Aug 2026 — App Lock: checked once on load, held in state
  // for the session — matches how a lock screen actually behaves (you
  // don't want it demanding the PIN again every single re-render, only
  // on genuinely opening/reloading the app). Real ask, always optional
  // per the user's instruction — `locked` starts false immediately if
  // appLockEnabled is off, so nothing changes for anyone not using it.
  // CHANGED — real ask: "lock again after close/screen timeout by
  // default, but allow toggle to increase timer" — the initial check
  // now goes through shouldRelock() (which folds in the optional
  // grace window) instead of the raw appLockEnabled flag, so someone
  // who set a grace period and reopened within it isn't made to
  // re-verify on this very first mount either.
  const [locked, setLocked] = useState(() => PrivacySettingsRepository.shouldRelock());
  // ADDED 1 Sep 2026 — real ask: duress PIN. Session-only (not
  // persisted anywhere) — a decoy session never survives a real app
  // restart, by design; see DecoyHome's own comment on why there's
  // deliberately no way back to the real app from inside it.
  const [decoyActive, setDecoyActive] = useState(false);
  // ADDED 26 Aug 2026 — real ask: onboarding, real single-user
  // personal app — checked once on load, same pattern as `locked`
  // above.
  const [showOnboarding, setShowOnboarding] = useState(() => !AppPreferencesRepository.getPreferences().hasCompletedOnboarding);
  // ADDED 19 Aug 2026 — real ask: the setup prompt itself. Read once
  // on load, same pattern as `locked` above — shows whenever App Lock
  // isn't on AND the prompt hasn't been permanently dismissed.
  const [showAppLockPrompt, setShowAppLockPrompt] = useState(() => {
    const settings = PrivacySettingsRepository.getSettings();
    return !settings.appLockEnabled && !settings.appLockPromptDismissed;
  });
  // ADDED — real ask: "opening back to last page" — reopening within a
  // short grace window resumes on whatever tab was open when you left,
  // same shouldRelock()-style grace-window pattern App Lock's own
  // grace period already uses (see RESUME_GRACE_MINUTES below), rather
  // than a new mechanism. Past the window (or on a genuinely fresh
  // install/first launch, where lastActiveTab is still null), falls
  // back to Home — the 19 Aug default this replaces, not removes.
  const [active, setActive] = useState(() => {
    const prefs = AppPreferencesRepository.getPreferences();
    // CHANGED — critical fix: validate lastActiveTab is still a real
    // TABS key before trusting it — a stale/corrupt stored value here
    // was the likely trigger for a real device crash (see the
    // activeTab/.find() fix below for the full explanation).
    if (prefs.lastActiveTab && prefs.lastActiveAt && TABS.some((t) => t.key === prefs.lastActiveTab)) {
      const elapsedMs = Date.now() - new Date(prefs.lastActiveAt).getTime();
      if (elapsedMs <= RESUME_GRACE_MINUTES * 60000) return prefs.lastActiveTab;
    }
    return "home";
  });
  const [status, setStatus] = useState(null);
  // ADDED 19 Aug 2026 — Dashboard quick-add: set alongside switching
  // `active`, consumed (reset to false) by whichever module actually
  // mounts and uses it — see each module's own openAddOnMount effect.
  const [quickAdd, setQuickAdd] = useState(false);
  // ADDED 19 Aug 2026 — distinguishes which Healthcare sub-tab a
  // quick-add should land on (Testing vs. Clinic Visits) — undefined/
  // "testing" for every other tab's quick-add, which ignores this prop
  // entirely.
  const [quickAddTarget, setQuickAddTarget] = useState(null);
  // ADDED — real ask: Clinic Card's quick-add shortcuts ("TOC 2 week",
  // "Book appointment", "Treatment given") — same handleQuickAdd
  // mechanism Home's own buttons already use, extended to also carry
  // real starting values for the new record (a 2-weeks-out date, a
  // real reason, etc.) rather than always landing on a totally blank
  // add sheet.
  const [pendingPrefillData, setPendingPrefillData] = useState(null);
  // ADDED 19 Aug 2026 — real fix for "tapping a nav icon should return
  // to that module's default screen": switching `active` to a value
  // it's ALREADY at doesn't remount anything on its own (React sees no
  // state change), so re-tapping the tab you're already on used to do
  // nothing — you'd stay wherever you'd navigated to inside it.
  // Incrementing this on every single nav tap (even to the same tab)
  // and folding it into the module's `key` below forces a genuine
  // fresh mount every time, which is what actually resets each
  // module's own internal screen state back to its default.
  const [navResetCount, setNavResetCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  // ADDED 26 Aug 2026 — real ask: compact calendar entry point on
  // Home, landing directly on Settings' Calendar screen rather than
  // just the main Settings menu.
  const [settingsInitialScreen, setSettingsInitialScreen] = useState(null);
  const openSettingsToCalendar = () => { setSettingsInitialScreen("calendar"); setShowSettings(true); };
  const [showSearch, setShowSearch] = useState(false);
  // ADDED 26 Aug 2026 — dedicated visible toast for the back-button
  // exit warning below. The existing `status` state only renders
  // inside SettingsScreen, so it would've been invisible here.
  const [backExitToast, setBackExitToast] = useState(false);

  // ADDED 26 Aug 2026 — real ask: the Android hardware back button was
  // closing the app instantly instead of behaving like in-app back
  // navigation. Handles what App.jsx can actually see: closes an open
  // overlay (Settings/Search) first, then returns to Home, then needs
  // a second press within 2s to actually exit — never closes silently
  // on the first press once already on Home.
  // HONEST LIMIT: this can't reach into a module's own internal screen
  // state (e.g. being on Testing's Edit form) — each module manages
  // that independently, and wiring a real per-module back stack up
  // through here is a bigger follow-up, not done in this pass. Right
  // now, pressing back while deep in a module's own flow jumps to
  // Home, not one step back within that module.
  // Gracefully no-ops if @capacitor/app isn't installed (browser
  // preview, or before Claude Code adds it) — same pattern as
  // notificationService.js.
  // ADDED 26 Aug 2026 — shared by the hardware back button below AND
  // the new swipe gesture — same "what does going back actually mean
  // here" logic, not duplicated.
  // UPDATED 26 Aug 2026, later same session — the comment here used
  // to say this had "the same honest limit as the back button: can't
  // reach into a module's own internal screen state." That limit was
  // real when this was written, but got fixed later in this same
  // session (see moduleBackHandlerRef below) — both the hardware back
  // button and this swipe gesture call the same goBackOneLevel(), so
  // both now correctly go back one step within whatever module is
  // active, not just at the App.jsx shell level. Leaving this note so
  // it's clear the fix applies here too, not just to the button.
  // ADDED 26 Aug 2026 — real ask: back should go one step within
  // whatever module is active (e.g. Testing's Edit screen back to its
  // Detail screen), not always jump straight to Home. App.jsx has no
  // visibility into a module's own internal screen state (list/
  // detail/edit are all managed locally inside each module) — this
  // ref is how the currently-mounted module can register its own
  // "can I go back one step, and if so do it" function, checked
  // FIRST, before any of the shell-level fallbacks below.
  // HONEST ROLLOUT STATE: only Testing has actually registered a
  // real handler so far (built as the reference implementation) — the
  // other modules still fall through to the old jump-to-Home
  // behaviour until the same registration is added to each. Not a
  // silent gap: modules that haven't registered simply never call
  // this ref, so goBackOneLevel's existing fallback logic runs
  // exactly as it did before, unchanged.
  const moduleBackHandlerRef = useRef(null);
  const registerModuleBackHandler = (fn) => { moduleBackHandlerRef.current = fn; };

  const goBackOneLevel = () => {
    if (moduleBackHandlerRef.current && moduleBackHandlerRef.current()) return true;
    if (showSettings) { setShowSettings(false); return true; }
    if (showSearch) { setShowSearch(false); return true; }
    if (active !== "home") { setActive("home"); setNavResetCount((c) => c + 1); return true; }
    return false;
  };

  useEffect(() => {
    let lastBackPress = 0;
    let listenerHandle = null;
    (async () => {
      try {
        const { App: CapacitorApp } = await import("@capacitor/app");
        listenerHandle = await CapacitorApp.addListener("backButton", () => {
          if (goBackOneLevel()) return;
          const now = Date.now();
          if (now - lastBackPress < 2000) {
            CapacitorApp.exitApp();
          } else {
            lastBackPress = now;
            setBackExitToast(true);
            setTimeout(() => setBackExitToast(false), 2000);
          }
        });
      } catch {
        console.warn("[App] @capacitor/app not available — hardware back button uses default OS behaviour in this environment.");
      }
    })();
    return () => { listenerHandle?.remove(); };
  }, [showSettings, showSearch, active]);

  // ADDED — real ask: actually re-lock when the app comes back from
  // the background (screen timeout, switching away and back), not
  // just on a cold start — App Lock previously only ever checked once
  // on mount, so backgrounding briefly and returning left the app
  // sitting open with no PIN prompt at all. Uses @capacitor/app's own
  // appStateChange event (isActive: false→true is the real "resumed"
  // transition) — same lazy-import/graceful-degrade pattern as the
  // hardware back button above. Falls back to the plain web
  // visibilitychange event where the native plugin isn't available
  // (browser preview), since that's a reasonable proxy for the same
  // thing there. shouldRelock() itself is what makes the optional
  // grace-period toggle actually work — reopening within the window
  // just doesn't trip `locked` back to true.
  useEffect(() => {
    const checkRelock = () => {
      if (PrivacySettingsRepository.shouldRelock()) setLocked(true);
    };
    // ADDED — real ask: "opening back to last page" — refreshes
    // lastActiveAt at the actual moment of backgrounding, not just
    // whenever `active` last happened to change (which could've been
    // much earlier in a long single-tab session) — same isActive:false
    // transition this listener already watches, just the other branch
    // of the same event. lastActiveTab itself is kept current by the
    // effect just below, on every `active` change.
    const recordBackgrounded = () => {
      AppPreferencesRepository.update({ lastActiveAt: new Date().toISOString() });
    };
    let listenerHandle = null;
    (async () => {
      try {
        const { App: CapacitorApp } = await import("@capacitor/app");
        listenerHandle = await CapacitorApp.addListener("appStateChange", ({ isActive }) => {
          if (isActive) checkRelock(); else recordBackgrounded();
        });
      } catch {
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") checkRelock();
          else recordBackgrounded();
        });
      }
    })();
    return () => { listenerHandle?.remove(); };
  }, []);

  // ADDED — real ask: "opening back to last page" — keeps lastActiveTab
  // in sync with every real tab change, regardless of which of the
  // many setActive() call sites in this file triggered it (nav taps,
  // quick-add routing, shortcuts, back-handlers) — one effect on the
  // single source of truth (`active`) instead of touching every call
  // site individually.
  useEffect(() => {
    AppPreferencesRepository.update({ lastActiveTab: active, lastActiveAt: new Date().toISOString() });
  }, [active]);

  // ADDED 26 Aug 2026 — real ask: custom medication reminder
  // notifications with real action buttons (Take all / Skip until
  // tomorrow / Remind in 30). Registered here, not in Medication or
  // Home, for the same reason as the hardware back button above: a
  // notification action can be tapped regardless of which screen is
  // currently open, so this genuinely is a shell-level concern, not a
  // module one — unlike DoxyPEP's sync logic earlier this session,
  // which WAS a mistake to put here and got moved to Home instead.
  // CHANGED — real ask: the DoxyPEP 72h alert now ALSO has real action
  // buttons (Take dose / Remind in 30) — same single listener, one
  // more pair of actionIds to dispatch, since both action groups fire
  // through this exact same native event regardless of which
  // notification they came from.
  useEffect(() => {
    let listenerHandle = null;
    (async () => {
      const { addNotificationActionListener, MEDICATION_ACTIONS, DOXYPEP_ACTIONS } = await import("./storage/notificationService");
      const { handleTakeAll, handleSkipToday, handleSnooze } = await import("./calculations/medicationReminderSync");
      const { handleTakeDoxyDose, handleSnoozeDoxy } = await import("./calculations/doxyPepSync");
      listenerHandle = await addNotificationActionListener((action) => {
        if (action.actionId === MEDICATION_ACTIONS.takeAll) handleTakeAll();
        else if (action.actionId === MEDICATION_ACTIONS.skipToday) handleSkipToday();
        else if (action.actionId === MEDICATION_ACTIONS.snooze) handleSnooze();
        else if (action.actionId === DOXYPEP_ACTIONS.takeDose) handleTakeDoxyDose();
        else if (action.actionId === DOXYPEP_ACTIONS.snooze) handleSnoozeDoxy();
      });
    })();
    return () => { listenerHandle?.remove(); };
  }, []);

  // ADDED 26 Aug 2026 — real ask: swipe gesture navigation, explicitly
  // "nice to have, not essential like the back button" — so swipe only
  // ever goes back one level (reusing the exact same logic above),
  // never exits the app, unlike a second hardware back press. Plain
  // touch events, no native plugin needed (unlike the back button,
  // which needs @capacitor/app) — works in a browser preview too.
  // "Swipe forward" has no real equivalent in this app: navigation
  // here is tab-based, not a linear history stack, so there's nothing
  // meaningful to go "forward" to — only swipe-right-to-go-back is
  // implemented, deliberately, not a gap.
  useEffect(() => {
    let touchStartX = 0, touchStartY = 0;
    const onTouchStart = (e) => { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; };
    const onTouchEnd = (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      // Real right-swipe: mostly horizontal, past a real threshold —
      // guards against catching an ordinary vertical scroll.
      if (dx > 80 && Math.abs(dy) < 60) goBackOneLevel();
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [showSettings, showSearch, active]);
  const fileInputRef = useRef(null);
  // CHANGED — critical fix: a real device crash (white/dark screen, no
  // recovery) traced to this exact line — if `active` ever holds a
  // value that isn't one of TABS' 5 real keys, .find() returns
  // undefined and `activeTab.component` throws synchronously during
  // render, which (with no error boundary above this existed until
  // this same fix) blanked the entire app with no way back in. The
  // most likely real trigger: "opening back to last page" trusting a
  // persisted lastActiveTab value without validating it's still one of
  // TABS' real keys first — now guarded here directly, at the one
  // place that actually matters, rather than only at the point it's
  // set.
  const activeTab = TABS.find((t) => t.key === active) || TABS.find((t) => t.key === "home");
  const ActiveModule = activeTab.component;

  // CHANGED 26 Aug 2026 — real bug fix: Clinic Card is reachable from
  // BOTH Home and from inside Healthcare itself. Using its quick-add
  // shortcuts a second time while already on the Healthcare tab made
  // setActive("healthcare") a no-op (already that value), so the
  // module never remounted — meaning Healthcare's own subTab state and
  // the target module's mount-only openAddOnMount effect both silently
  // ignored the new prefill data. Bottom nav taps and Global Search's
  // navigateTo() already increment navResetCount for exactly this
  // reason; quick-add just never did. Now it always forces a genuine
  // fresh mount, so prefilled quick-adds work every time, not just
  // when they happen to change tabs.
  const handleQuickAdd = (tabKey, target) => {
    setActive(tabKey);
    setQuickAddTarget(target || null);
    setQuickAdd(true);
    setNavResetCount((c) => c + 1);
  };
  const handleQuickAddWithPrefill = (tabKey, target, prefillData) => {
    handleQuickAdd(tabKey, target);
    setPendingPrefillData(prefillData);
  };

  // ADDED — real ask: Android App Shortcuts (long-press the app icon
  // for "Log dose"/"Add encounter"). Each shortcut launches this same
  // Activity with a custom-scheme URL (see shortcuts.xml/
  // AndroidManifest.xml's own comments) — getLaunchUrl() catches a
  // COLD start via a shortcut, appUrlOpen catches one while the app's
  // already running (Android reuses the existing Activity instead of
  // starting a new one, since MainActivity is launchMode="singleTask").
  // Routes through the exact same handleQuickAdd() Home's own quick-
  // add buttons already use — no separate navigation path to keep in
  // sync. Silently no-ops in any environment without @capacitor/app
  // (browser preview) — shortcuts are an Android-only concept anyway.
  useEffect(() => {
    const routeShortcutUrl = (urlString) => {
      if (!urlString) return;
      let url;
      try { url = new URL(urlString); } catch { return; }
      if (url.hostname === "medication") handleQuickAdd("medication");
      else if (url.hostname === "encounter") handleQuickAdd("activity");
    };
    let listenerHandle = null;
    (async () => {
      try {
        const { App: CapacitorApp } = await import("@capacitor/app");
        const launch = await CapacitorApp.getLaunchUrl();
        if (launch?.url) routeShortcutUrl(launch.url);
        listenerHandle = await CapacitorApp.addListener("appUrlOpen", (event) => routeShortcutUrl(event.url));
      } catch {
        // Not available in this environment — App Shortcuts only exist
        // on a real installed Android app anyway.
      }
    })();
    return () => { listenerHandle?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ADDED 19 Aug 2026 — Global Search's navigation handler. Deliberately
  // reuses the same active/quickAddTarget/navResetCount plumbing the nav
  // bar and quick-add already use, but with quickAdd left false — lands
  // on the right module (and right Healthcare sub-tab), doesn't open an
  // add flow. See GlobalSearchScreen's own comment for why this stops at
  // "right module" rather than a true deep-link to one record.
  const navigateTo = (tabKey, subTab) => {
    setActive(tabKey);
    setQuickAddTarget(subTab || null);
    setQuickAdd(false);
    setNavResetCount((c) => c + 1);
  };

  // ADDED — real ask: "linked encounter should be actually linked",
  // "attendees should link through to contact card", both directions.
  // Same prop-threading pattern already used for openAddOnMount/
  // quickAddTarget above — ActiveModule already receives props
  // uniformly regardless of which module is currently active, so this
  // reuses that same plumbing rather than building new per-module
  // wiring.
  const [pendingOpenRecordId, setPendingOpenRecordId] = useState(null);
  // CHANGED — real ask: Global Search results should open the actual
  // record, not just switch to its tab. Extended with an optional
  // subTab, reusing the exact same quickAddTarget mechanism already
  // built for quick-add — Healthcare already reads this correctly to
  // pick its initial sub-tab (Testing/Clinic Visits/Symptom Log/
  // Vaccinations), so a search result for e.g. a Vaccination just
  // needs to say so, not require new plumbing.
  const navigateToRecord = (tabKey, recordId, subTab) => {
    navigateTo(tabKey, subTab);
    setPendingOpenRecordId(recordId);
  };

  // ADDED — real ask: import used to run with zero confirmation or
  // choice at all — picking a file immediately wiped every current
  // record with what was in it. Now asks Replace All vs. Merge first;
  // the actual file picker only opens once one's chosen. Real trade-off
  // stated plainly in backupService.js's own comment: Merge is a
  // straightforward "add both sets together" (each imported record
  // keeps its original id, so cross-references stay intact), not
  // conflict resolution — it won't notice the same real contact exists
  // in both places.
  const [showImportModeDialog, setShowImportModeDialog] = useState(false);
  const [importMode, setImportMode] = useState("replace");
  const handleImportClick = () => setShowImportModeDialog(true);
  const startImport = (mode) => {
    setImportMode(mode);
    setShowImportModeDialog(false);
    fileInputRef.current?.click();
  };
  const finishImport = (parsed) => {
    restoreFromParsedBackup(parsed, importMode);
    setStatus(importMode === "merge" ? "Backup merged in — reload the page to see it everywhere." : "Backup restored — reload the page to see it everywhere.");
    window.location.reload();
  };
  // ADDED — real ask: encrypted backup import. A picked file is
  // inspected first (read + parsed, nothing restored yet) so an
  // encrypted backup can be told apart from a plain one before
  // committing to either path — a plain backup restores immediately,
  // same as before; an encrypted one needs a password first, via this
  // small prompt.
  const [pendingEncryptedEnvelope, setPendingEncryptedEnvelope] = useState(null);
  const [decryptPassword, setDecryptPassword] = useState("");
  const [decryptError, setDecryptError] = useState("");
  const handleFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const result = await inspectBackupFile(file);
      if (result.encrypted) {
        setPendingEncryptedEnvelope(result.envelope);
      } else {
        finishImport(result.parsed);
      }
    } catch (err) {
      setStatus(`Import failed: ${err.message}`);
    }
  };
  const attemptDecryptImport = async () => {
    try {
      const parsed = await decryptBackupEnvelope(pendingEncryptedEnvelope, decryptPassword);
      setPendingEncryptedEnvelope(null);
      setDecryptPassword("");
      setDecryptError("");
      finishImport(parsed);
    } catch (err) {
      setDecryptError(err.message);
    }
  };

  // ADDED 1 Sep 2026 — decoy session gate: checked before the App Lock
  // gate below (once decoyActive, there's no lock screen to show or
  // bypass — this is the entire rest of the session).
  if (decoyActive) {
    return <DecoyHome onLockNow={() => { setDecoyActive(false); setLocked(true); }} />;
  }

  // ADDED 19 Aug 2026 — App Lock gate: shown INSTEAD of everything
  // else while locked, real ask.
  if (locked) {
    return <AppLockScreen
      onUnlock={() => { PrivacySettingsRepository.recordUnlock(); setLocked(false); }}
      onUnlockDecoy={() => setDecoyActive(true)}
    />;
  }

  // ADDED 26 Aug 2026 — real ask: onboarding gate, same pattern as App
  // Lock above — checked after it (a lock screen should gate before
  // onboarding content, not after), shown instead of everything else
  // until finished or skipped.
  if (showOnboarding) {
    return <OnboardingScreen onFinish={() => {
      AppPreferencesRepository.update({ hasCompletedOnboarding: true });
      setShowOnboarding(false);
    }} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: darkMode ? DARK.bg : "#F0F0F3", display: "flex", flexDirection: "column" }}>
      <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChosen} style={{ display: "none" }} />

      <div style={{ flex: 1, paddingBottom: 76 }}>
        {active === "home" ? (
          <HomeScreen onQuickAdd={handleQuickAdd} onOpenSettings={() => setShowSettings(true)} onOpenSearch={() => setShowSearch(true)} onNavigateToRecord={navigateToRecord} onQuickAddWithPrefill={handleQuickAddWithPrefill} onOpenCalendar={openSettingsToCalendar} registerModuleBackHandler={registerModuleBackHandler} onLockNow={() => setLocked(true)} />
        ) : ActiveModule ? (
          <ActiveModule key={`${active}-${navResetCount}`} openAddOnMount={quickAdd} onConsumedQuickAdd={() => { setQuickAdd(false); setQuickAddTarget(null); }} quickAddTarget={quickAddTarget}
            openRecordId={pendingOpenRecordId} onConsumedRecordOpen={() => setPendingOpenRecordId(null)} onNavigateToRecord={navigateToRecord}
            prefillData={pendingPrefillData} onConsumedPrefill={() => setPendingPrefillData(null)} onQuickAddWithPrefill={handleQuickAddWithPrefill}
            onOpenSettings={() => setShowSettings(true)} registerModuleBackHandler={registerModuleBackHandler} />
        ) : (
          <div style={{ padding: 40, textAlign: "center", color: darkMode ? DARK.textSecondary : "#5B5B62", fontFamily: "sans-serif" }}>
            <activeTab.icon size={32} color={darkMode ? DARK.textDisabled : "#656568"} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{activeTab.label} isn't built yet</div>
            <div style={{ fontSize: 13 }}>Needs Testing, Vaccination, and Clinic Visits to exist first.</div>
          </div>
        )}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: darkMode ? DARK.surface : "#FFFFFF", borderTop: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", display: "flex", justifyContent: "space-around", alignItems: "flex-end", padding: "10px 0 14px", zIndex: 10, fontFamily: "'Inter', sans-serif" }}>
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          const isBuilt = tab.component !== null || tab.key === "home";
          const Icon = tab.icon;
          // ADDED 19 Aug 2026 — Home gets a raised, circular, always-
          // filled treatment (the user's ask: "circle/bump as centred"),
          // distinct from the other four flat tabs.
          if (tab.key === "home") {
            return (
              <div key={tab.key} onClick={() => { setActive(tab.key); setNavResetCount((c) => c + 1); }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", marginTop: -18 }}>
                <div style={{ width: 48, height: 48, borderRadius: 999, background: tab.accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 10px rgba(0,0,0,.25)", border: `3px solid ${darkMode ? DARK.surface : "#FFFFFF"}` }}>
                  <Icon size={22} color="#FFFFFF" weight="bold" />
                </div>
              </div>
            );
          }
          {/* CHANGED 26 Aug 2026 — real ask: the whole tab block fills
              with the module's colour when active (icon+label together,
              white on top), not a circle/tint behind just the icon.
              Home is explicitly excluded — stays the raised circle
              treatment above, unchanged. */}
          return (
            <div key={tab.key} onClick={() => { setActive(tab.key); setNavResetCount((c) => c + 1); }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", opacity: isBuilt ? 1 : 0.45 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 14px", borderRadius: 14, background: isActive ? tab.accent : "transparent" }}>
                <Icon size={22} color={isActive ? "#FFFFFF" : (darkMode ? DARK.textDisabled : "#656568")} weight={isActive ? "fill" : "regular"} />
                <span style={{ fontSize: 10, color: isActive ? "#FFFFFF" : (darkMode ? DARK.textDisabled : "#656568"), fontWeight: isActive ? 600 : 400 }}>{tab.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {backExitToast && (
        <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: "#1B1B1F", color: "#FFFFFF", padding: "10px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,.25)", zIndex: 300 }}>
          Press back again to exit
        </div>
      )}

      {showSettings && (
        <SettingsScreen onClose={() => { setShowSettings(false); setSettingsInitialScreen(null); }} onExport={exportBackup} onImportClick={handleImportClick} status={status} onNavigateToRecord={navigateToRecord} initialScreen={settingsInitialScreen} registerModuleBackHandler={registerModuleBackHandler} />
      )}
      {showSearch && (
        <GlobalSearchScreen onClose={() => setShowSearch(false)} onNavigate={navigateToRecord} />
      )}
      {/* ADDED 19 Aug 2026 — real ask: App Lock setup prompt. Renders
          as an overlay ON TOP of the real, already-interactive app
          underneath — never a full-screen replacement the way the
          actual lock gate above is. Every dismissal path leads
          straight back into the real app, immediately. */}
      {showAppLockPrompt && (
        <AppLockPrompt
          onDismiss={() => setShowAppLockPrompt(false)}
          onDismissForever={() => { PrivacySettingsRepository.update({ appLockPromptDismissed: true }); setShowAppLockPrompt(false); }}
          onOpenSettings={() => { setShowAppLockPrompt(false); setShowSettings(true); }}
        />
      )}
      {showImportModeDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", zIndex: 998 }} onClick={() => setShowImportModeDialog(false)}>
          <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", width: "100%", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, fontFamily: "'Inter', sans-serif" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F", marginBottom: 8 }}>
              Import backup
            </div>
            <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 16, lineHeight: 1.5 }}>
              Replace All wipes every current record and loads only what's in the file — the way to clear out placeholder or old data with a real backup. Merge adds the file's records alongside what's already here, without removing anything.
            </div>
            <button onClick={() => startImport("replace")} style={{ width: "100%", padding: 14, borderRadius: 999, border: "none", background: ACTION.red, color: "#FFFFFF", fontWeight: 700, cursor: "pointer", marginBottom: 8 }}>
              Replace all data
            </button>
            <button onClick={() => startImport("merge")} style={{ width: "100%", padding: 14, borderRadius: 999, border: "none", background: ACCENTS.home, color: "#FFFFFF", fontWeight: 700, cursor: "pointer", marginBottom: 8 }}>
              Merge into existing data
            </button>
            <button onClick={() => setShowImportModeDialog(false)} style={{ width: "100%", padding: 12, borderRadius: 999, border: "1px solid " + (darkMode ? DARK.border : "#DCDCE1"), background: "transparent", color: darkMode ? DARK.textSecondary : "#5B5B62", fontWeight: 600, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {/* ADDED — real ask: encrypted backup import. Only appears once
          inspectBackupFile() (see handleFileChosen above) has already
          determined the picked file is genuinely encrypted — a plain
          backup never reaches this, it restores immediately instead. */}
      {pendingEncryptedEnvelope && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", zIndex: 998 }} onClick={() => { setPendingEncryptedEnvelope(null); setDecryptPassword(""); setDecryptError(""); }}>
          <div style={{ background: darkMode ? DARK.surface : "#FFFFFF", width: "100%", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, fontFamily: "'Inter', sans-serif" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: darkMode ? DARK.textPrimary : "#1B1B1F", marginBottom: 8 }}>
              This backup is encrypted
            </div>
            <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : "#5B5B62", marginBottom: 16, lineHeight: 1.5 }}>
              Enter the password it was encrypted with — {importMode === "merge" ? "its records will be merged into what's already here" : "it will replace all current data"}.
            </div>
            <input value={decryptPassword} onChange={(e) => { setDecryptPassword(e.target.value); setDecryptError(""); }} type="password" autoFocus placeholder="Password"
              onKeyDown={(e) => { if (e.key === "Enter") attemptDecryptImport(); }}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1px solid ${darkMode ? DARK.border : "#DCDCE1"}`, fontSize: 14, marginBottom: 8, boxSizing: "border-box" }} />
            {decryptError && <div style={{ fontSize: 12, color: ACTION.red, marginBottom: 12 }}>{decryptError}</div>}
            <button onClick={attemptDecryptImport} disabled={!decryptPassword} style={{ width: "100%", padding: 14, borderRadius: 999, border: "none", background: decryptPassword ? ACCENTS.home : "#656568", color: "#FFFFFF", fontWeight: 700, cursor: decryptPassword ? "pointer" : "default", marginBottom: 8 }}>
              Decrypt and import
            </button>
            <button onClick={() => { setPendingEncryptedEnvelope(null); setDecryptPassword(""); setDecryptError(""); }} style={{ width: "100%", padding: 12, borderRadius: 999, border: "1px solid " + (darkMode ? DARK.border : "#DCDCE1"), background: "transparent", color: darkMode ? DARK.textSecondary : "#5B5B62", fontWeight: 600, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

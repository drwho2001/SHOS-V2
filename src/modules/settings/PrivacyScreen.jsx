// PrivacyScreen — extracted verbatim from src/modules/SHOS_Settings_Prototype.jsx
// (24 Sep 2026 settings split). Behavior unchanged; only the file moved.
import React, { useState, useEffect, useRef } from "react";
import { NEUTRAL_DARK as DARK } from "../../calculations/designTokens";
import { CaretLeftIcon as ChevronLeft, EyeIcon as Eye, EyeSlashIcon as EyeOff, LockIcon as Lock } from "@phosphor-icons/react";
import { ACCENTS, ACTION, NEUTRAL, RADIUS, TYPE } from "../../calculations/designTokens";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useLoadedState } from "../../calculations/loadedRepositoryState";
import { useIsDesktopWidth } from "../../calculations/responsive";
import { PrivacySettingsRepository, DEFAULT_PRIVACY_SETTINGS } from "../../repositories/privacySettingsRepository";
import { enablePinProtection, disablePinProtectionWithPin, changePin, enableBiometricSlot, disableBiometricSlot, setRecoveryString as setRecoveryStringVault, hasRecoveryString, clearRecoveryString as clearRecoveryStringVault } from "../../storage/cryptoService";
import { checkBiometryAvailable } from "../../storage/biometricAuthService";
import { isScreenSecurityAvailable, setScreenshotsAllowed } from "../../storage/screenSecurityService";

export function PrivacyScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  // ADDED — real audit finding (desktop full-width sweep): a real
  // multi-column grid was considered (the audit's own suggestion —
  // grid top-level cards only, leaving nested sub-controls like
  // biometric-inside-App-Lock alone) but deliberately NOT built this
  // round — this screen's own App Lock/PIN/duress/recovery logic is
  // security-sensitive and this app's own history has real regressions
  // from structural changes here (see cryptoService.js's own
  // Phase 4 entries). A maxWidth cap + center is the safer fix that
  // still avoids the stretched-edge-to-edge complaint, with zero risk
  // to the nested toggle/reveal logic below.
  const isDesktopWidth = useIsDesktopWidth();

  const [settings, setSettings] = useLoadedState(() => PrivacySettingsRepository.getSettings(), [], DEFAULT_PRIVACY_SETTINGS);
  const [pinEntry, setPinEntry] = useState("");
  const [pinError, setPinError] = useState("");
  const [settingPin, setSettingPin] = useState(false);
  const [newPin, setNewPin] = useState("");
  // ADDED — real ask: force reconfirmation before accepting a new PIN,
  // to catch typos (a wrong PIN saved silently would lock the user out of
  // his own Anonymise-revert/App-Lock later, with no way back in).
  const [confirmPin, setConfirmPin] = useState("");
  // ADDED — real ask: eye-icon show/hide toggle on PIN entry, matching
  // the pattern used elsewhere on the web. Shared across every PIN
  // field on this screen.
  const [showPins, setShowPins] = useState(false);
  // ADDED — real ask: an "allow screenshots" toggle, native-only (see
  // screenSecurityService.js's own header) — checked once on mount, not
  // every render, same pattern as the existing folder-picker/notification-
  // availability checks elsewhere in this file.
  const [screenshotsToggleAvailable, setScreenshotsToggleAvailable] = useState(false);
  const [screenshotsToggleError, setScreenshotsToggleError] = useState("");
  const dialogRef = useRef(null);
  useEffect(() => { dialogRef.current?.focus(); }, []);
  useEffect(() => {
    let cancelled = false;
    isScreenSecurityAvailable().then((available) => { if (!cancelled) setScreenshotsToggleAvailable(available); });
    return () => { cancelled = true; };
  }, []);

  const refresh = async () => setSettings(await PrivacySettingsRepository.getSettings());

  const activate = async () => { await PrivacySettingsRepository.activate(); refresh(); };
  const toggleScreenshots = async () => {
    setScreenshotsToggleError("");
    const nextAllowed = !settings.allowScreenshots;
    const ok = await setScreenshotsAllowed(nextAllowed);
    if (!ok) { setScreenshotsToggleError("Couldn't change this — please try again."); return; }
    setSettings(await PrivacySettingsRepository.update({ allowScreenshots: nextAllowed }));
  };
  const attemptDeactivate = async () => {
    const result = await PrivacySettingsRepository.deactivate(pinEntry);
    if (result.ok) { setPinEntry(""); setPinError(""); refresh(); }
    else setPinError(result.error);
  };
  // CHANGED — Phase 4 (Sep 2026): if App Lock is already on, this PIN
  // isn't just a stored string anymore — it's the real key material
  // wrapping the vault's Data Key. Real re-wrap via cryptoService's own
  // verify-before-commit changePin() (see that file's header) using
  // `settings.anonymisePin` as the OLD PIN — already known here without
  // asking the user to retype it, same "already inside Settings, which
  // the lock screen itself already gated" trust model as turning App
  // Lock off below. If App Lock is OFF, there's no vault PIN slot to
  // re-wrap yet (first-ever PIN, or a PIN changed while unused) — just
  // the stored string, exactly as before this change.
  const savePin = async () => {
    const trimmed = newPin.trim();
    if (trimmed.length < 4) { setPinError("PIN should be at least 4 digits."); return; }
    // CHANGED — real ask: force reconfirmation before accepting.
    if (trimmed !== confirmPin.trim()) { setPinError("PINs don't match — check both and try again."); return; }
    try {
      if (settings.appLockEnabled) {
        await changePin(settings.anonymisePin, trimmed, settings.appLockGraceMinutes);
      }
      await PrivacySettingsRepository.update({ anonymisePin: trimmed });
      setNewPin(""); setConfirmPin(""); setSettingPin(false); setPinError("");
      refresh();
    } catch (err) {
      setPinError(err.message || "Couldn't change the PIN — nothing was changed.");
    }
  };

  // ADDED 1 Sep 2026 — real ask: "dummy pin good idea." Same
  // confirm-before-accept pattern as the real PIN above, plus the one
  // extra real validation this PIN specifically needs — see
  // setDuressPin's own comment on why it must differ from the real PIN.
  const [settingDuressPin, setSettingDuressPin] = useState(false);
  const [newDuressPin, setNewDuressPin] = useState("");
  const [confirmDuressPin, setConfirmDuressPin] = useState("");
  const [duressPinError, setDuressPinError] = useState("");
  const saveDuressPin = async () => {
    const trimmed = newDuressPin.trim();
    if (trimmed.length < 4) { setDuressPinError("PIN should be at least 4 digits."); return; }
    if (trimmed !== confirmDuressPin.trim()) { setDuressPinError("PINs don't match — check both and try again."); return; }
    const result = await PrivacySettingsRepository.setDuressPin(trimmed);
    if (!result.ok) { setDuressPinError(result.error); return; }
    setNewDuressPin(""); setConfirmDuressPin(""); setSettingDuressPin(false); setDuressPinError("");
    refresh();
  };
  const clearDuressPin = async () => { await PrivacySettingsRepository.clearDuressPin(); refresh(); };

  // ADDED 9 Sep 2026 — real ask: PIN-recovery/alternate-access, per
  // CLAUDE.md's own scoped design. Gated behind the CURRENT PIN
  // (`settings.anonymisePin`, already known here — same trust model as
  // changePin()/disablePinProtectionWithPin() above, not re-asked from
  // scratch), only offered once App Lock is on. A free-text field, not
  // the numeric-only PIN pad — meant to be a real, memorable passphrase
  // the owner picks himself, not a random code to write down.
  const [settingRecovery, setSettingRecovery] = useState(false);
  const [recoveryStringInput, setRecoveryStringInput] = useState("");
  const [recoveryStringConfirm, setRecoveryStringConfirm] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const saveRecoveryString = async () => {
    const trimmed = recoveryStringInput.trim();
    if (trimmed.length < 6) { setRecoveryError("Recovery string should be at least 6 characters."); return; }
    if (trimmed !== recoveryStringConfirm.trim()) { setRecoveryError("Recovery strings don't match — check both and try again."); return; }
    try {
      await setRecoveryStringVault(settings.anonymisePin, trimmed);
      setRecoveryStringInput(""); setRecoveryStringConfirm(""); setSettingRecovery(false); setRecoveryError("");
      // hasRecoveryString() reads the vault's own metadata directly, not
      // `settings` — nothing here would otherwise trigger a re-render to
      // pick up the change. refresh() re-fetches settings (a no-op on
      // the actual data) purely to force one, same real-but-indirect
      // trick already used elsewhere in this app for a sync vault change
      // that isn't itself part of PrivacySettingsRepository's own state.
      refresh();
    } catch (err) {
      setRecoveryError(err.message || "Couldn't set the recovery string — nothing was changed.");
    }
  };
  const clearRecovery = () => { clearRecoveryStringVault(); refresh(); };

  // ADDED 19 Aug 2026 — App Lock toggle, real ask. Guarded: can't turn
  // on without a PIN already set, since App Lock with no PIN would
  // show a lock screen that anything (even leaving the field blank)
  // trivially bypasses — confusing, not actually locked. Turning OFF
  // never needs the PIN re-entered here; you're already inside
  // Settings, which the lock screen itself already gated.
  // CHANGED — Phase 4 (Sep 2026): this used to just flip a stored flag.
  // Turning App Lock ON now really does establish the vault's `pin`
  // slot (cryptoService.enablePinProtection) — the real thing that
  // makes "pulled-from-device data always needs the PIN" true. Turning
  // it OFF really does re-wrap the vault back onto the always-works
  // device slot (disablePinProtectionWithPin) — both use `settings.
  // anonymisePin` as the real PIN, already known here (see savePin's
  // own comment on why re-asking for it isn't needed). Either call can
  // throw on a genuine verification failure (see cryptoService.js's
  // own "verify before commit" design) — caught here so a failure
  // leaves both the vault AND the stored flag exactly as they were,
  // never a mismatched pair.
  const toggleAppLock = async () => {
    if (!settings.appLockEnabled && !settings.anonymisePin) {
      setPinError("Set a PIN below first, then App Lock can use it.");
      return;
    }
    try {
      if (settings.appLockEnabled) {
        await disablePinProtectionWithPin(settings.anonymisePin);
        // CHANGED — real ask: turning App Lock back OFF should also
        // turn off biometric unlock with it — biometric is only ever
        // meaningful as an add-on to App Lock, leaving it silently "on"
        // underneath would just be stale, unreachable state.
        await PrivacySettingsRepository.update({ appLockEnabled: false, biometricUnlockEnabled: false });
      } else {
        await enablePinProtection(settings.anonymisePin, settings.appLockGraceMinutes);
        await PrivacySettingsRepository.update({ appLockEnabled: true });
      }
      refresh();
    } catch (err) {
      setPinError(err.message || "Couldn't change App Lock — nothing was changed.");
    }
  };

  // ADDED — real ask: biometric unlock, layered on top of App Lock's
  // own PIN. Real device/enrollment check happens here at toggle-on
  // time — never just flips the flag and hopes, since the device
  // might have no biometric hardware or nothing enrolled.
  // CHANGED — Phase 4 (Sep 2026): turning this on now really does
  // establish the vault's own `biometric` slot (a device-protected copy
  // of the Data Key — see cryptoService.js's own section on it for the
  // honest trade-off this accepts) via cryptoService.enableBiometricSlot(),
  // using the already-known real PIN to unwrap the DEK first. Without
  // this, App.jsx's own AppLockScreen would gate on a real biometric
  // prompt that succeeds but then has no way to actually recover the
  // Data Key — exactly the bug found and fixed live while wiring the
  // boot gate. Turning it off just removes the slot — no PIN needed,
  // same "no re-entry once already in Settings" pattern as everywhere
  // else on this screen.
  const [biometricError, setBiometricError] = useState("");
  const toggleBiometric = async () => {
    setBiometricError("");
    if (settings.biometricUnlockEnabled) {
      disableBiometricSlot();
      await PrivacySettingsRepository.update({ biometricUnlockEnabled: false });
      refresh();
      return;
    }
    const result = await checkBiometryAvailable();
    if (!result.available) {
      setBiometricError(result.reason || "Biometrics aren't available on this device.");
      return;
    }
    try {
      await enableBiometricSlot(settings.anonymisePin);
    } catch (err) {
      setBiometricError(err.message || "Couldn't enable biometric unlock — nothing was changed.");
      return;
    }
    await PrivacySettingsRepository.update({ biometricUnlockEnabled: true });
    refresh();
  };

  return (
    <div ref={dialogRef} role="dialog" aria-label="Privacy & Security" tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: darkMode ? DARK.bg : NEUTRAL.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : NEUTRAL.bg, borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label="Back" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Privacy & Security</h1>
      </div>

      <div style={isDesktopWidth ? { padding: "16px", maxWidth: 640, margin: "0 auto" } : { padding: "16px" }}>
        {/* ADDED — real ask, from a competitive-research finding: SHOS's
            "no cloud, no account" architecture was never actually
            stated anywhere in-app as a deliberate choice with real
            consequences — just implied by the absence of a sign-up
            screen. Many popular health-tracking apps DO send usage
            data to third-party analytics/advertising SDKs, sometimes
            without making that obvious; SHOS structurally can't, since
            there's no server for data to go to in the first place.
            Stated plainly rather than naming any specific competitor
            or citing a specific incident, since that's not something
            this app's own UI copy can responsibly verify or keep
            current. */}
        <div style={{ display: "flex", gap: 10, padding: 14, borderRadius: RADIUS.md, background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), marginBottom: 16 }}>
          <Lock size={18} color={darkMode ? DARK.textSecondary : NEUTRAL.textSecondary} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, lineHeight: 1.5 }}>
            SHOS has no account, no server, and no cloud sync — everything below only ever exists on this device. That's not just a preference you could turn off: there's genuinely nowhere else for it to go. Many comparable apps route usage data through third-party analytics or advertising services; this one structurally can't.
          </div>
        </div>

        {/* Big, clearly separated toggle button — never on by default,
            per the user's explicit instruction, and always one tap to turn
            ON regardless of any PIN. */}
        <div onClick={settings.anonymiseModeActive ? undefined : activate}
          style={{ padding: 18, borderRadius: RADIUS.md, background: settings.anonymiseModeActive ? "#1B1B1F" : (darkMode ? DARK.surface : NEUTRAL.surface), border: `1px solid ${settings.anonymiseModeActive ? "#1B1B1F" : (darkMode ? DARK.border : NEUTRAL.border)}`, cursor: settings.anonymiseModeActive ? "default" : "pointer", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {settings.anonymiseModeActive ? <EyeOff size={20} color="#FFFFFF" /> : <Eye size={20} color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} />}
            <span style={{ fontSize: 15, fontWeight: 700, color: settings.anonymiseModeActive ? "#FFFFFF" : (darkMode ? DARK.textPrimary : NEUTRAL.textPrimary) }}>
              {settings.anonymiseModeActive ? "Anonymise mode is ON" : "Turn on Anonymise mode"}
            </span>
          </div>
          <div style={{ fontSize: 12, color: settings.anonymiseModeActive ? "#DCDCE1" : (darkMode ? DARK.textSecondary : NEUTRAL.textSecondary), marginTop: 6 }}>
            {settings.anonymiseModeActive
              ? "Names, photos, addresses, and car details are hidden across Contacts."
              : "Tap right before handing your phone over — hides names, photos, addresses, and car registration in Contacts. Never turns on by itself."}
          </div>
        </div>

        {settings.anonymiseModeActive && (
          <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, marginBottom: 8 }}>
              {settings.anonymisePin ? "Enter your PIN to turn it back off" : "Turn it back off"}
            </div>
            {settings.anonymisePin && (
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input value={pinEntry} onChange={(e) => { setPinEntry(e.target.value); setPinError(""); }} type={showPins ? "text" : "password"} inputMode="numeric" placeholder="PIN"
                  style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), fontSize: 14, boxSizing: "border-box" }} />
                {showPins ? <EyeOff role="button" tabIndex={0} aria-label="Hide PIN" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} size={17} color={darkMode ? DARK.textDisabled : NEUTRAL.textDisabled} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(false)} />
                  : <Eye role="button" tabIndex={0} aria-label="Show PIN" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} size={17} color={darkMode ? DARK.textDisabled : NEUTRAL.textDisabled} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(true)} />}
              </div>
            )}
            {pinError && <div style={{ fontSize: 12, color: ACTION.red, marginBottom: 8 }}>{pinError}</div>}
            <button onClick={attemptDeactivate} style={{ width: "100%", padding: 12, borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>
              Turn off Anonymise mode
            </button>
          </div>
        )}

        {/* CHANGED — real ask: moved to sit immediately below the base
            Anonymise toggle (was further down, after App Lock) — also
            now genuinely disabled, not just visually de-emphasized,
            unless Anonymise mode is actually on. Toggling "further"
            hiding when the base tier isn't even active never made
            sense — there'd be nothing for it to add on top of. */}
        <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, padding: 16, marginBottom: 16, opacity: settings.anonymiseModeActive ? 1 : 0.5 }}>
          <div onClick={settings.anonymiseModeActive ? async () => { await PrivacySettingsRepository.update({ hideFurtherEnabled: !settings.hideFurtherEnabled }); refresh(); } : undefined}
            role="switch" tabIndex={settings.anonymiseModeActive ? 0 : -1} aria-checked={settings.hideFurtherEnabled} aria-label="Also hide kinks & physical attributes"
            onKeyDown={settings.anonymiseModeActive ? async (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); await PrivacySettingsRepository.update({ hideFurtherEnabled: !settings.hideFurtherEnabled }); refresh(); } } : undefined}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: settings.anonymiseModeActive ? "pointer" : "default" }}>
            <div style={{ flex: 1, paddingRight: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Also hide kinks & physical attributes</div>
              <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginTop: 2 }}>
                {settings.anonymiseModeActive
                  ? "Stated kinks, limits, length/girth, and ejaculation stats — hidden in addition to the base fields above, only while Anonymise mode is on."
                  : "Turn on Anonymise mode above first — this only ever applies on top of it."}
              </div>
            </div>
            <div style={{ width: 40, height: 24, borderRadius: 999, background: settings.hideFurtherEnabled ? ACCENTS.home : (darkMode ? DARK.border : NEUTRAL.border), position: "relative", flexShrink: 0 }}>
              {/* CHANGED — same knob-invisible-in-dark-mode bug class
                  as the Colour scheme screen's dark mode toggle: a
                  near-black knob in dark mode could blend into a
                  near-black "off" track. Solid white in both states,
                  matching the App Lock/Biometric toggles right below
                  and every other toggle in the app. */}
              <div style={{ position: "absolute", top: 2, left: settings.hideFurtherEnabled ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: "#FFFFFF" }} />
            </div>
          </div>
        </div>

        {/* ADDED 19 Aug 2026 — App Lock, real ask, separate from
            Anonymise mode: gates opening the app at all, not just
            masking fields once it's open. */}
        <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, padding: 16, marginBottom: 16 }}>
          <div onClick={toggleAppLock} role="switch" tabIndex={0} aria-checked={settings.appLockEnabled} aria-label="App Lock"
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleAppLock(); } }}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
            <div style={{ flex: 1, paddingRight: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>App Lock</div>
              <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginTop: 2 }}>Require your PIN just to open the app at all. Uses the same PIN as the Revert PIN below.</div>
            </div>
            <div style={{ width: 40, height: 24, borderRadius: 999, background: settings.appLockEnabled ? ACCENTS.home : (darkMode ? DARK.border : NEUTRAL.border), position: "relative", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 2, left: settings.appLockEnabled ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: "#FFFFFF" }} />
            </div>
          </div>
          {/* ADDED 19 Aug 2026 — real fix while building this: without
              this, the "set a PIN first" guard message had nowhere to
              actually render when neither the deactivate flow nor the
              set-PIN flow was open — the user would tap the toggle, nothing
              would visibly happen, and the guard would silently do
              nothing from his side. */}
          {pinError && !settings.anonymiseModeActive && !settingPin && (
            <div style={{ fontSize: 12, color: ACTION.red, marginTop: 8 }}>{pinError}</div>
          )}
          {/* ADDED — real ask: biometric unlock, via
              @aparajita/capacitor-biometric-auth. Only offered once App
              Lock (and therefore a PIN) is already on — biometric is a
              convenience layered on top of the PIN, not a standalone
              gate, and the PIN field on the lock screen always still
              works even with this on. Not shown at all in a browser
              preview's own build check (see toggleBiometric's real
              checkBiometryAvailable() call) — that's expected, not a
              bug, the native plugin only exists in the installed app. */}
          {settings.appLockEnabled && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 14, borderTop: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), cursor: "pointer" }} onClick={toggleBiometric}
              role="switch" tabIndex={0} aria-checked={settings.biometricUnlockEnabled} aria-label="Unlock with biometrics"
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleBiometric(); } }}>
              <div style={{ flex: 1, paddingRight: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Unlock with biometrics</div>
                <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginTop: 2 }}>Fingerprint or face unlock as a shortcut for the PIN above — the PIN still works any time this is on, off, or unavailable.</div>
                {biometricError && <div style={{ fontSize: 11, color: ACTION.red, marginTop: 4 }}>{biometricError}</div>}
              </div>
              <div style={{ width: 40, height: 24, borderRadius: 999, background: settings.biometricUnlockEnabled ? ACCENTS.home : (darkMode ? DARK.border : NEUTRAL.border), position: "relative", flexShrink: 0 }}>
                <div style={{ position: "absolute", top: 2, left: settings.biometricUnlockEnabled ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: "#FFFFFF" }} />
              </div>
            </div>
          )}
          {/* ADDED — real ask: "lock again after close/screen timeout by
              default, but allow toggle to increase timer — if
              unlocked/opened again within X minutes, don't need to
              re-verify." Off (0 minutes) is the default, matching the
              existing always-relock behaviour exactly — this is purely
              opt-in convenience layered on top. */}
          {settings.appLockEnabled && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
              <div onClick={async () => { await PrivacySettingsRepository.update({ appLockGraceMinutes: settings.appLockGraceMinutes > 0 ? 0 : 10 }); refresh(); }}
                role="switch" tabIndex={0} aria-checked={settings.appLockGraceMinutes > 0} aria-label="Skip re-verification briefly"
                onKeyDown={async (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); await PrivacySettingsRepository.update({ appLockGraceMinutes: settings.appLockGraceMinutes > 0 ? 0 : 10 }); refresh(); } }}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                <div style={{ flex: 1, paddingRight: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Skip re-verification briefly</div>
                  <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginTop: 2 }}>Reopening the app within a few minutes of last unlocking it won't ask again.</div>
                </div>
                <div style={{ width: 40, height: 24, borderRadius: 999, background: settings.appLockGraceMinutes > 0 ? ACCENTS.home : (darkMode ? DARK.border : NEUTRAL.border), position: "relative", flexShrink: 0 }}>
                  <div style={{ position: "absolute", top: 2, left: settings.appLockGraceMinutes > 0 ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: "#FFFFFF" }} />
                </div>
              </div>
              {settings.appLockGraceMinutes > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                  <span style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>Grace period:</span>
                  <input type="number" min={1} max={120} value={settings.appLockGraceMinutes}
                    onChange={async (e) => { const v = Math.max(1, Math.min(120, Number(e.target.value) || 1)); await PrivacySettingsRepository.update({ appLockGraceMinutes: v }); refresh(); }}
                    aria-label="Grace period (minutes)"
                    style={{ width: 56, padding: "6px 8px", borderRadius: 8, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), background: darkMode ? DARK.surfaceVariant : NEUTRAL.bg, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontSize: 13, textAlign: "center" }} />
                  <span style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>minutes</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CHANGED — real ask: "App Lock and Revert PIN should be
            neighbours" — moved to sit directly below App Lock now,
            since they share the exact same PIN. */}
        <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, marginBottom: 4 }}>Revert PIN</div>
          <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 10 }}>
            {settings.anonymisePin ? "A PIN is set — used for both Anonymise mode's revert and App Lock above." : "No PIN set yet — anyone can turn Anonymise mode back off right now, and App Lock can't be turned on. Set one so both actually protect you."}
          </div>
          {settingPin ? (
            <>
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input value={newPin} onChange={(e) => setNewPin(e.target.value)} type={showPins ? "text" : "password"} inputMode="numeric" placeholder="New PIN (4+ digits)"
                  style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), fontSize: 14, boxSizing: "border-box" }} />
                {showPins ? <EyeOff role="button" tabIndex={0} aria-label="Hide PIN" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} size={17} color={darkMode ? DARK.textDisabled : NEUTRAL.textDisabled} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(false)} />
                  : <Eye role="button" tabIndex={0} aria-label="Show PIN" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} size={17} color={darkMode ? DARK.textDisabled : NEUTRAL.textDisabled} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(true)} />}
              </div>
              {/* ADDED — real ask: force reconfirmation before accepting,
                  to catch typos before they lock the user out later. */}
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} type={showPins ? "text" : "password"} inputMode="numeric" placeholder="Confirm new PIN"
                  style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), fontSize: 14, boxSizing: "border-box" }} />
                {showPins ? <EyeOff role="button" tabIndex={0} aria-label="Hide PIN" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} size={17} color={darkMode ? DARK.textDisabled : NEUTRAL.textDisabled} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(false)} />
                  : <Eye role="button" tabIndex={0} aria-label="Show PIN" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} size={17} color={darkMode ? DARK.textDisabled : NEUTRAL.textDisabled} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(true)} />}
              </div>
              {pinError && <div style={{ fontSize: 12, color: ACTION.red, marginBottom: 8 }}>{pinError}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setSettingPin(false); setNewPin(""); setConfirmPin(""); setPinError(""); }} style={{ flex: 1, padding: 10, borderRadius: 999, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), background: "transparent", color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button onClick={savePin} style={{ flex: 1, padding: 10, borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Save PIN</button>
              </div>
            </>
          ) : (
            <button onClick={() => setSettingPin(true)} style={{ width: "100%", padding: 10, borderRadius: 999, border: `1px solid ${ACCENTS.healthcare}`, background: "transparent", color: ACCENTS.healthcare, fontWeight: 700, cursor: "pointer" }}>
              {settings.anonymisePin ? "Change PIN" : "Set a PIN"}
            </button>
          )}
        </div>

        {/* ADDED 1 Sep 2026 — real ask: duress/decoy PIN. Only offered
            once App Lock is actually on — a duress PIN only means
            anything if there's a real lock screen for it to be entered
            on in the first place. */}
        {settings.appLockEnabled && (
          <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, padding: 16, marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, marginBottom: 4 }}>Duress PIN (optional)</div>
            <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 10 }}>
              {settings.duressPin
                ? "Set. Entering this PIN on the App Lock screen — instead of your real one — opens a convincing but empty, fake version of the app. Your real data stays completely untouched, just not shown. There's no way back to real data from inside a decoy session — close and reopen the app, then enter your REAL PIN."
                : "A second PIN, different from your real one, for a \"someone is making me unlock my phone\" situation. Entering it opens a fake, empty-looking app instead of your real data — nothing is deleted or changed, it just isn't shown."}
            </div>
            {settingDuressPin ? (
              <>
                <div style={{ position: "relative", marginBottom: 8 }}>
                  <input value={newDuressPin} onChange={(e) => setNewDuressPin(e.target.value)} type={showPins ? "text" : "password"} inputMode="numeric" placeholder="New duress PIN (4+ digits)"
                    style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), fontSize: 14, boxSizing: "border-box" }} />
                  {showPins ? <EyeOff role="button" tabIndex={0} aria-label="Hide PIN" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} size={17} color={darkMode ? DARK.textDisabled : NEUTRAL.textDisabled} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(false)} />
                    : <Eye role="button" tabIndex={0} aria-label="Show PIN" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} size={17} color={darkMode ? DARK.textDisabled : NEUTRAL.textDisabled} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(true)} />}
                </div>
                <div style={{ position: "relative", marginBottom: 8 }}>
                  <input value={confirmDuressPin} onChange={(e) => setConfirmDuressPin(e.target.value)} type={showPins ? "text" : "password"} inputMode="numeric" placeholder="Confirm duress PIN"
                    style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), fontSize: 14, boxSizing: "border-box" }} />
                  {showPins ? <EyeOff role="button" tabIndex={0} aria-label="Hide PIN" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} size={17} color={darkMode ? DARK.textDisabled : NEUTRAL.textDisabled} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(false)} />
                    : <Eye role="button" tabIndex={0} aria-label="Show PIN" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} size={17} color={darkMode ? DARK.textDisabled : NEUTRAL.textDisabled} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(true)} />}
                </div>
                {duressPinError && <div style={{ fontSize: 12, color: ACTION.red, marginBottom: 8 }}>{duressPinError}</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setSettingDuressPin(false); setNewDuressPin(""); setConfirmDuressPin(""); setDuressPinError(""); }} style={{ flex: 1, padding: 10, borderRadius: 999, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), background: "transparent", color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                  <button onClick={saveDuressPin} style={{ flex: 1, padding: 10, borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Save PIN</button>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setSettingDuressPin(true)} style={{ flex: 1, padding: 10, borderRadius: 999, border: `1px solid ${ACCENTS.healthcare}`, background: "transparent", color: ACCENTS.healthcare, fontWeight: 700, cursor: "pointer" }}>
                  {settings.duressPin ? "Change duress PIN" : "Set a duress PIN"}
                </button>
                {settings.duressPin && (
                  <button onClick={clearDuressPin} style={{ padding: "10px 16px", borderRadius: 999, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), background: "transparent", color: ACTION.red, fontWeight: 600, cursor: "pointer" }}>
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ADDED 9 Sep 2026 — real ask: PIN-recovery/alternate-access.
            Same "only offered once App Lock is actually on" gate as the
            Duress PIN section above — there's no PIN to recover FROM
            otherwise. */}
        {settings.appLockEnabled && (
          <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, padding: 16, marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, marginBottom: 4 }}>Recovery string (optional)</div>
            <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 10 }}>
              {hasRecoveryString()
                ? "Set. If you ever forget your PIN, \"Forgot PIN?\" on the lock screen lets you unlock with this instead and set a new PIN in the same step — your real data stays exactly as it is."
                : "A real passphrase you pick yourself — not a code to write down — for if you ever forget your PIN. Without one, forgetting your PIN means there's no way back into your real data."}
            </div>
            {settingRecovery ? (
              <>
                <div style={{ position: "relative", marginBottom: 8 }}>
                  <input value={recoveryStringInput} onChange={(e) => setRecoveryStringInput(e.target.value)} type={showPins ? "text" : "password"} placeholder="New recovery string (6+ characters)"
                    style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), fontSize: 14, boxSizing: "border-box" }} />
                  {showPins ? <EyeOff role="button" tabIndex={0} aria-label="Hide PIN" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} size={17} color={darkMode ? DARK.textDisabled : NEUTRAL.textDisabled} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(false)} />
                    : <Eye role="button" tabIndex={0} aria-label="Show PIN" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} size={17} color={darkMode ? DARK.textDisabled : NEUTRAL.textDisabled} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(true)} />}
                </div>
                <div style={{ position: "relative", marginBottom: 8 }}>
                  <input value={recoveryStringConfirm} onChange={(e) => setRecoveryStringConfirm(e.target.value)} type={showPins ? "text" : "password"} placeholder="Confirm recovery string"
                    style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), fontSize: 14, boxSizing: "border-box" }} />
                  {showPins ? <EyeOff role="button" tabIndex={0} aria-label="Hide PIN" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} size={17} color={darkMode ? DARK.textDisabled : NEUTRAL.textDisabled} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(false)} />
                    : <Eye role="button" tabIndex={0} aria-label="Show PIN" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} size={17} color={darkMode ? DARK.textDisabled : NEUTRAL.textDisabled} style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(true)} />}
                </div>
                {recoveryError && <div style={{ fontSize: 12, color: ACTION.red, marginBottom: 8 }}>{recoveryError}</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setSettingRecovery(false); setRecoveryStringInput(""); setRecoveryStringConfirm(""); setRecoveryError(""); }} style={{ flex: 1, padding: 10, borderRadius: 999, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), background: "transparent", color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                  <button onClick={saveRecoveryString} style={{ flex: 1, padding: 10, borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Save</button>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setSettingRecovery(true)} style={{ flex: 1, padding: 10, borderRadius: 999, border: `1px solid ${ACCENTS.healthcare}`, background: "transparent", color: ACCENTS.healthcare, fontWeight: 700, cursor: "pointer" }}>
                  {hasRecoveryString() ? "Change recovery string" : "Set a recovery string"}
                </button>
                {hasRecoveryString() && (
                  <button onClick={clearRecovery} style={{ padding: "10px 16px", borderRadius: 999, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), background: "transparent", color: ACTION.red, fontWeight: 600, cursor: "pointer" }}>
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ADDED — real ask: an "allow screenshots" toggle, native-only —
            see screenSecurityService.js's own header for why there's
            nothing for it to control on the web/PWA build. */}
        {screenshotsToggleAvailable && (
          <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, padding: 16, marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Allow screenshots</span>
              <div onClick={toggleScreenshots} role="switch" tabIndex={0} aria-checked={settings.allowScreenshots} aria-label="Allow screenshots"
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleScreenshots(); } }}
                style={{ width: 44, height: 26, borderRadius: 999, background: settings.allowScreenshots ? ACCENTS.home : (darkMode ? DARK.border : NEUTRAL.border), position: "relative", cursor: "pointer", transition: "background 0.15s", flexShrink: 0 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,.4)", position: "absolute", top: 3, left: settings.allowScreenshots ? 21 : 3, transition: "left 0.15s" }} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary }}>
              Off by default — SHOS blocks screenshots, screen recording, and casting on every screen, and hides its own content from the recent-apps switcher. Turning this on is a real, deliberate trade for convenience (e.g. capturing a result to show a clinician) — it takes effect immediately, everywhere in the app, until you turn it back off.
            </div>
            {screenshotsToggleError && <div style={{ fontSize: 11, color: ACTION.red, marginTop: 8 }}>{screenshotsToggleError}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ADDED — real ask: "unified notifications management in settings" —
// one place to turn each real reminder type on/off, rather than each
// one being buried invisibly in its own module. Deliberately just a
// switchboard: every actual data read + native scheduling decision
// still lives in each reminder's own sync file (doxyPepSync.js,
// testingReminderSync.js, refillReminderSync.js,
// clinicVisitReminderSync.js) — this screen only flips the settings
// those already check, same "one source of truth, no duplicated
// logic" principle as everywhere else in this app. Medication dose
// reminders are the one toggle NOT duplicated here — it already lived
// in medicationPreferencesRepository.js before this screen existed,
// so this just reads/writes that repository directly alongside the
// new ones, rather than migrating it (and risking losing anyone's
// already-set snooze/skip state) for no real gain.
// ADDED 17 Sep 2026 — real ask: "Clinic A and B reminder on the same
// card." `bare` drops this row's own outer card chrome (background/
// border/margin) so 2+ of these can be nested inside ONE shared card
// instead of each rendering as its own separate card — used by the
// Clinic appointment reminders card below, every other call site
// unchanged.

export default PrivacyScreen;

// WidgetsScreen — extracted verbatim from src/modules/SHOS_Settings_Prototype.jsx
// (24 Sep 2026 settings split). Behavior unchanged; only the file moved.
import React, { useRef, useEffect } from "react";
import { NEUTRAL_DARK as DARK, STICKY_SCREEN_HEADER_TOP } from "../../calculations/designTokens";
import { CaretLeftIcon as ChevronLeft } from "@phosphor-icons/react";
import { NEUTRAL, RADIUS, TYPE } from "../../calculations/designTokens";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useLoadedState } from "../../calculations/loadedRepositoryState";
// CHANGED - the default tier used to be a `defaultTier` literal on every row,
// so DEFAULT_TIERS and this list were two owners of one fact that happened to
// agree. Reading it from the owner also means the settings screen shows the same
// answer the widgets will act on.
import { tierFor, isDataWidget } from "../../calculations/widgetPrivacy";
import { syncAllWidgets } from "../../calculations/syncAllWidgets";

export function WidgetsScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : NEUTRAL;
  const dialogRef = useRef(null);
  useEffect(() => { dialogRef.current?.focus(); }, []);
  const [widgetPrefs, setWidgetPrefs] = useLoadedState(() => 
    import("../../repositories/appPreferencesRepository").then(m => m.AppPreferencesRepository.getPreferences()), 
    [], 
    { widgetPrivacy: {} }
  );

  const widgetConfigs = [
    {
      key: "nextDose",
      label: "Next Medication Dose",
      description: "Shows medication name + next dose time",

    },
    {
      key: "refillDue",
      label: "Refills Due",
      description: "Shows count + next medication needing refill",

    },
    {
      key: "nextAppointment",
      label: "Next Appointment",
      description: "Shows appointment count + next clinic visit",

    },
    {
      key: "doxyPepWindow",
      label: "DoxyPEP Window",
      description: "Shows 72h post-exposure countdown",

    },
    // ADDED 1 Oct 2026 - these three were MISSING ENTIRELY, and they are the
    // three that disclose the most. A user could set a tier on seven rows and
    // still not have configured Last Test, Cycle or Clinic Card, because no row
    // existed for them. The setting was therefore not only inert (nothing read
    // it) but aimed at the wrong widgets - it had rows for the three QuickAdd
    // widgets, which render a launch icon and no data at all.
    {
      key: "lastTest",
      label: "Last Test",
      description: "Shows last STI test date + when a retest is due",

    },
    {
      key: "cycle",
      label: "Menstrual Cycle",
      description: "Shows cycle day, phase and next period",

    },
    {
      key: "clinicCard",
      label: "Clinic Card",
      description: "Shows the next appointment, its location and test count",

    },
    {
      key: "quickAddEncounter",
      label: "Quick Add: Encounter",
      description: "Tap to open Add Encounter form",

    },
    {
      key: "quickAddContact",
      label: "Quick Add: Contact",
      description: "Tap to open Add Contact form",

    },
    {
      key: "quickAddMedication",
      label: "Quick Add: Medication",
      description: "Tap to open Log Medication form",

    },
  ];

  const privacyOptions = [
    { value: "full", label: "Full — names & times" },
    { value: "redacted", label: "Redacted — counts only" },
    { value: "off", label: "Off — disabled" },
  ];

  const handlePrivacyChange = async (widgetKey, tier) => {
    const newPrefs = { ...widgetPrefs, widgetPrivacy: { ...widgetPrefs.widgetPrivacy, [widgetKey]: tier } };
    setWidgetPrefs(newPrefs);
    try {
      const { AppPreferencesRepository } = await import("../../repositories/appPreferencesRepository");
      await AppPreferencesRepository.update({ widgetPrivacy: newPrefs.widgetPrivacy });
      await syncAllWidgets();
    } catch (e) {
      console.debug("Widget privacy save failed:", e);
    }
  };

  return (
    <div ref={dialogRef} role="dialog" aria-label="Widgets" tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: T.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: STICKY_SCREEN_HEADER_TOP, background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label="Back" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: T.textPrimary }}>Widgets</h1>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: T.textDisabled, marginBottom: 16, lineHeight: 1.5 }}>
          Widgets appear on your home screen and lock screen. <strong>Redacted</strong> shows only that there is something there — the category and a count, e.g. "Refills · 2 due" — never a name, date, time or location. <strong>Full</strong> shows the details. <strong>Off</strong> shows nothing at all.
        </div>
        {widgetConfigs.map((w) => {
          const currentTier = tierFor(w.key, widgetPrefs.widgetPrivacy);
          return (
            <div key={w.key} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, marginBottom: 12, overflow: "hidden" }}>
              <div style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 14, color: T.textPrimary, fontWeight: 600 }}>{w.label}</div>
                    <div style={{ fontSize: 12, color: T.textDisabled, marginTop: 2 }}>{w.description}</div>
                  </div>
                  {/* CHANGED - the three QuickAdd widgets render a launch icon and
                      no data, so they get no tier picker. Every row here used to
                      draw one, which offered a meaningful-looking choice
                      (Full / Redacted / Off) for a widget that displays nothing
                      and ignores all three. */}
                  {isDataWidget(w.key) ? (
                    <select
                      value={currentTier}
                      onChange={(e) => handlePrivacyChange(w.key, e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${T.border}`,
                      background: T.bg,
                      color: T.textPrimary,
                      fontSize: 13,
                      fontFamily: "'Inter', sans-serif",
                      cursor: "pointer",
                      minWidth: 160,
                    }}
                  >
                    {privacyOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                    </select>
                  ) : (
                    <span style={{ fontSize: 12, color: T.textDisabled, textAlign: "right", maxWidth: 160, lineHeight: 1.5 }}>
                      Shortcut only — no data to hide
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: 20, padding: 16, background: T.surfaceVariant, borderRadius: RADIUS.md, fontSize: 12, color: T.textSecondary, lineHeight: 1.5 }}>
          <strong>Privacy note:</strong> Widgets are visible on the lock screen without authentication. Use <strong>Redacted</strong> for sensitive data (refills, appointments). <strong>Full</strong> is OK for Next Dose (you're the one taking it). Quick-add widgets don't show data — they're just shortcuts.
        </div>
      </div>
    </div>
  );
}

// ADDED — real ask: "maybe better to move/copy calendar share options
// to calendar page settings... doesn't have to exist in a settings
// menu, can exist as icon." Moved out of Settings -> Privacy entirely
// (not duplicated — one place to own this state, so the toggle can
// never drift out of sync between two copies) into its own sheet,
// opened directly from the Calendar screen's own header icon — the
// screen someone would actually think to check for "can this sync to
// my phone's calendar," not a generic Settings menu several taps away.

export default WidgetsScreen;

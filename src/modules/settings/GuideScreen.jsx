// GuideScreen — extracted verbatim from src/modules/SHOS_Settings_Prototype.jsx
// (24 Sep 2026 settings split). Behavior unchanged; only the file moved.
import React from "react";
import { NEUTRAL_DARK as DARK } from "../../calculations/designTokens";
import { CaretLeftIcon as ChevronLeft, CalendarIcon as Calendar, LockIcon as Lock, XIcon as X, CompassIcon as Compass } from "@phosphor-icons/react";
import { ACCENT_TEXT_SAFE, NEUTRAL, RADIUS, TYPE } from "../../calculations/designTokens";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useIsDesktopWidth } from "../../calculations/responsive";

const GUIDE_SECTIONS = [
  {
    heading: "Getting around",
    intro: "5 tabs along the bottom: Contacts, Encounter, Home (centre), Medication, Healthcare.",
    bullets: [
      "Home is your dashboard — recent activity, quick-add buttons, and 3 extra shortcuts: Clinic Card, Episodes, Calendar.",
      "Clinic Card is a read-only summary you can show a clinician.",
      "Episodes groups related encounters and tests together (e.g. \"this test relates to these encounters\").",
      "My Profile isn't a tab — reach it via the profile icon next to the gear on Home, or from inside Settings.",
    ],
  },
  {
    heading: "Where the Settings sections are",
    intro: "Tap the gear icon on Home to get here.",
    bullets: [
      "Backup & Data — every way to export or restore your data.",
      "Security & Privacy — App Lock, your PIN, Anonymise mode, and any network calls this app makes.",
      "General — Preferences and Notifications.",
      "Appearance — per-module colours.",
      "Content & Lists — Manage lists, Resources, and this Guide.",
      "Insights — Stats, Calendar, and Trash.",
      "Support — Developer tools and About.",
    ],
  },
  {
    heading: "Menstrual, Contraception & Pregnancy tracking",
    intro: "Off by default, and not its own tab — it lives inside Healthcare's own sub-nav, next to Testing/Clinic Visits/Vaccinations/Symptoms.",
    bullets: [
      "Turn it on: Settings → General → Preferences → \"Menstrual & contraception tracking.\"",
      "It's opt-in regardless of gender — nothing here assumes who does or doesn't want it.",
    ],
  },
  {
    heading: "Privacy & security features, plainly",
    intro: "A few layers, each doing a different job:",
    bullets: [
      "App Lock (Security & Privacy → Privacy) — a PIN/biometric gate on top of your device's own encryption. Off by default, since most people already lock their phone.",
      "Duress PIN — if you set one, it opens a decoy version of the app with fake data instead of your real records. A real safety feature, not a demo.",
      "Anonymise mode — masks attendee names on Contacts and Encounters, useful if someone might glance at your screen.",
      "None of this replaces your phone's own lock screen — think of it as an extra layer.",
    ],
  },
  {
    heading: "A few things worth knowing",
    bullets: [
      "Nothing leaves your device on its own — no account, no cloud, no server.",
      "Deleting something usually archives it first — recoverable in Trash (under Insights). A real \"delete permanently\" option exists too, for when you mean it.",
      "Most numbers you see (adherence %, active/inactive, most recent test) are calculated live from what you've logged — not something you type in.",
    ],
  },
];

export function GuideScreen({ onClose, onStartTour }) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : NEUTRAL;
  // ADDED 16 Sep 2026 — real ask (#93, desktop empty-space): at a wide
  // desktop viewport this screen's flowing body copy used to stretch
  // edge-to-edge (no maxWidth at all), both a poor reading measure and
  // the literal "empty space around sparse content" complaint. A
  // desktop-only measure cap, not a font-size bump — mobile's own
  // markup is untouched. See CLAUDE.md's #93 entry for the full design.
  const isDesktopWidth = useIsDesktopWidth();

  return (
    <div tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: darkMode ? DARK.bg : NEUTRAL.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      {/* CHANGED 16 Sep 2026, later still — real report: "shouldn't be
          narrow, should be full width page." The earlier 640px
          centered-column cap (this same day's own prior fix, see
          CLAUDE.md's #93 entry) was a real overcorrection — it solved
          the reading-measure complaint by making the whole PAGE read
          as a narrow floating box in a sea of blank margin, which is
          the same complaint in a different shape. Reverted to a plain
          full-width header, matching the body below (also reverted to
          full-width). */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : NEUTRAL.bg, borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label="Back" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        {/* ADDED — real ask: this screen's own title had no icon, even
            though its Settings-menu row already has one (Compass) —
            carried through for a consistent identity between the row
            and the screen it opens. */}
        <Compass size={19} weight="bold" color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} />
        <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Guide</h1>
      </div>
      <div style={{ padding: 16 }}>
        {/* CHANGED — real report: capped-width elements (this intro,
            the tour button) sitting above an unconstrained full-width
            grid read as "janky/uneven," not balanced. On desktop, the
            intro and button now sit side by side in one row instead
            of two separately-capped full-width blocks — the intro
            takes the flexible remaining space (still capped at a
            readable measure) and the button sits to its right, both
            genuinely using the row's width the way the grid below
            does. Mobile keeps the exact prior stacked markup. */}
        <div style={isDesktopWidth ? { display: "flex", alignItems: "center", gap: 16, marginBottom: 16 } : {}}>
          <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, lineHeight: 1.4, maxWidth: isDesktopWidth ? 520 : undefined, marginBottom: isDesktopWidth ? 0 : 16, flex: isDesktopWidth ? "1 1 auto" : undefined }}>
            Where things live and what the less-obvious features do — not a feature-by-feature walkthrough, just answers to "where do I find X."
          </div>
          {/* ADDED 9 Sep 2026 — real ask: a genuine spotlight-overlay
              tour, not just this written reference. Replayable here
              anytime, regardless of whether the one-time post-onboarding
              offer was already taken or skipped. */}
          {onStartTour && (
            <button onClick={onStartTour} style={{ width: isDesktopWidth ? "auto" : "100%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px 20px", borderRadius: RADIUS.md, border: "none", background: ACCENT_TEXT_SAFE.home, color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: isDesktopWidth ? 0 : 16, whiteSpace: "nowrap" }} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }}>
              Take the interactive tour
            </button>
          )}
        </div>
        {/* CHANGED 16 Sep 2026, later still — real ask: "module contents
            still mobile width" — a single-column card list at a wide
            desktop viewport is exactly that same complaint, just
            applied to this list instead of the whole page. A real CSS
            grid on desktop, flowing 2-3 columns depending on available
            width (each card keeping its own readable ~340px+ minimum,
            never stretching absurdly wide) — genuinely using the space
            rather than just letting one column stretch or capping the
            whole page narrow. Mobile keeps the exact prior single-
            column flex list, untouched. */}
        <div style={isDesktopWidth ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 } : { display: "flex", flexDirection: "column", gap: 12 }}>
          {GUIDE_SECTIONS.map((s) => (
            <div key={s.heading} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, marginBottom: 6 }}>{s.heading}</div>
              {s.intro && <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.5, marginBottom: s.bullets ? 6 : 0 }}>{s.intro}</div>}
              {s.bullets && (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {s.bullets.map((b, i) => (
                    <li key={i} style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.5, marginBottom: i < s.bullets.length - 1 ? 4 : 0 }}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


export default GuideScreen;

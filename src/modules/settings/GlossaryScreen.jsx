// GlossaryScreen — extracted verbatim from src/modules/SHOS_Settings_Prototype.jsx
// (24 Sep 2026 settings split). Behavior unchanged; only the file moved.
import React, { useState } from "react";
import { NEUTRAL_DARK as DARK } from "../../calculations/designTokens";
import { CaretLeftIcon as ChevronLeft, BookOpenTextIcon as BookOpen } from "@phosphor-icons/react";
import { NEUTRAL, RADIUS, TYPE } from "../../calculations/designTokens";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useIsDesktopWidth } from "../../calculations/responsive";

const GLOSSARY_TERMS = [
  { term: "PrEP", body: "Pre-exposure prophylaxis — medication taken regularly (daily, or event-based around sex) before an exposure, to reduce the chance of getting HIV." },
  { term: "PEP", body: "Post-exposure prophylaxis — a course of HIV medication started within 72 hours after a potential HIV exposure, to reduce the chance of infection taking hold." },
  { term: "DoxyPEP", body: "Doxycycline post-exposure prophylaxis. A single dose of the antibiotic doxycycline, taken within 72 hours after condomless oral, vaginal, or anal sex. Shown to reduce the chance of some bacterial STIs (see Resources → Sexual health for the full guidance)." },
  { term: "Doxy", body: "Shorthand for doxycycline, the antibiotic used in DoxyPEP." },
  { term: "TOC (Test of cure)", body: "A follow-up test done after treatment for an infection, to confirm it's actually cleared rather than assuming the treatment worked." },
  { term: "C&S (Culture & sensitivity)", body: "A lab test that grows a sample to identify exactly which bacteria are present and which antibiotics will treat it — used when a standard test isn't specific enough, e.g. for an antibiotic-resistant infection." },
  { term: "Window period", body: "The time after a possible exposure during which a test may not yet reliably detect an infection, even if present — testing too early can give a false negative." },
  { term: "Most recent", body: "This app's own label for the newest test covering a given infection, so an older, superseded result doesn't get confused with your current status." },
  { term: "BASHH", body: "British Association for Sexual Health and HIV — the UK's professional body for sexual health clinical guidance. Several of this app's own defaults (like the 90-day retesting interval) are based on its published guidance." },
  { term: "MGen (Mycoplasma genitalium)", body: "A bacterial STI, less well known than chlamydia or gonorrhoea, that can cause similar symptoms and sometimes needs specific antibiotic-resistance testing." },
  { term: "HSV (Herpes simplex virus)", body: "The virus that causes genital and oral herpes. HSV-1 and HSV-2 are the two types — either can occur at either site." },
  { term: "HPV (Human papillomavirus)", body: "A very common virus. Some strains are linked to genital warts, others to certain cancers — a vaccine exists and is recommended for some groups." },
  { term: "Chemsex", body: "Using drugs (commonly crystal meth, GHB/GBL, or mephedrone) before or during sex, typically to enhance or prolong the experience — see Resources → Drugs & chemsex for safety-specific guidance." },
  { term: "Cruising / PSE (Public sex environment)", body: "Meeting sexual partners in public or semi-public spaces (e.g. parks, saunas) — see Resources → Public sex & cruising for safety-specific guidance." },
];

// ADDED 9 Sep 2026 — real ask: "nothing explains settings for example,
// or switching/location of certain modules etc." A genuine gap this
// app never had an answer for — Resources/Glossary both explain
// clinical content, nothing explains the APP ITSELF. Same pattern as
// Glossary (a static reference screen, no search needed at this
// length) rather than an interactive spotlight/tour — this app has no
// existing tour-style interaction to match, and a tour library would
// be new dependency weight for something a plain reference screen
// answers just as well. Content below is deliberately about WHERE
// things live and WHAT the less-obvious toggles do, not a feature-by-
// feature walkthrough — the real, repeated confusion this was built
// for is "where do I find X," not "how do I use X once I'm there."
// CHANGED 16 Sep 2026 — real ask: this whole screen used to be 5 dense,
// single-paragraph blocks — casual and scannable was the actual ask,
// not academic prose. Each section is now a short intro line plus a
// few bullets; also fixed a real, stale inaccuracy that had crept in
// from an earlier reorg: "General" no longer includes Units (moved to
// Measurements' own settings — see that reorg's own commit), and this
// screen still said it did.

export function GlossaryScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : NEUTRAL;
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q ? GLOSSARY_TERMS.filter((t) => t.term.toLowerCase().includes(q) || t.body.toLowerCase().includes(q)) : GLOSSARY_TERMS;
  // Same #93 desktop measure-cap treatment as GuideScreen above — see
  // that function's own comment for the full reasoning.
  const isDesktopWidth = useIsDesktopWidth();

  return (
    <div tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: darkMode ? DARK.bg : NEUTRAL.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      {/* CHANGED 16 Sep 2026, later still — same "full width page, not a
          narrow centered column" reversal as GuideScreen above; see
          that screen's own comment for the full reasoning. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : NEUTRAL.bg, borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label="Back" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        {/* ADDED — real ask: same as GuideScreen above, carrying this
            screen's own Settings-menu row icon (BookOpen) through into
            its title bar. */}
        <BookOpen size={19} weight="bold" color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} />
        <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Glossary</h1>
      </div>
      <div style={{ padding: 16 }}>
        {/* CHANGED — real report: same "capped elements read janky
            above an unconstrained grid" fix as GuideScreen — the
            intro and search box now sit side by side on desktop
            instead of two separately-capped stacked blocks. */}
        <div style={isDesktopWidth ? { display: "flex", alignItems: "center", gap: 16, marginBottom: 16 } : {}}>
          <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, lineHeight: 1.4, maxWidth: isDesktopWidth ? 520 : undefined, marginBottom: isDesktopWidth ? 0 : 16, flex: isDesktopWidth ? "1 1 auto" : undefined }}>
            Plain-language explanations of the clinical shorthand used elsewhere in this app — informational, not personalised medical advice.
          </div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search terms"
            style={{ width: isDesktopWidth ? 300 : "100%", flexShrink: 0, padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box", marginBottom: isDesktopWidth ? 0 : 16 }} />
        </div>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 16px", color: T.textDisabled, fontSize: 13 }}>No terms match your search.</div>
        ) : (
          // CHANGED 16 Sep 2026, later still — real ask: "module
          // contents still mobile width" — a single scrolling column
          // of term/definition rows at a wide desktop viewport reads
          // exactly like that. A real CSS multi-column flow on
          // desktop (newspaper-style, not a grid — these are uneven-
          // height text rows, not uniform cards) genuinely fills the
          // width; `breakInside: "avoid"` on each row keeps a single
          // term/definition pair from ever splitting across the
          // column break. Mobile keeps the exact prior single-column
          // list, untouched.
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, overflow: "hidden", columnCount: isDesktopWidth ? 2 : undefined, columnGap: 0 }}>
            {filtered.map((t) => (
              <div key={t.term} style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}`, breakInside: "avoid" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, marginBottom: 3 }}>{t.term}</div>
                <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.4 }}>{t.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ADDED 26 Aug 2026 — real ask: About/version screen, a genuine
// missing basic flagged in the final audit. version/buildDate come
// from package.json and the actual build timestamp — real values,
// not decorative. GitHub link points at the actual repo so a real
// build issue can be traced back to source.

export default GlossaryScreen;

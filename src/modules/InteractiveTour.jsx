// InteractiveTour.jsx
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask: the existing static Guide screen (Settings > Guide) explains
// things in writing, but "nothing explains settings for example, or
// switching/location of certain modules" pointed at wanting something
// more direct — "click here, this is X for y, with a slightly opaque
// overlay." This is that: a real spotlight-overlay product tour, not
// just more text.
//
// Deliberately scoped to elements that are always present on Home with
// no navigation required (bottom nav tabs, the search/settings icons) —
// driving the tour through a real screen-to-screen navigation (open
// Settings, switch tabs, etc. mid-tour) would need this component to
// own or puppet App.jsx's own tab/screen state, a much bigger surface
// for a first version. Deeper detail already exists one tap away — the
// tour's own closing step points at the static Guide screen for that.
//
// Steps target real DOM elements via a `data-tour="<id>"` attribute
// (added at each real anchor point in App.jsx/SHOS_Home_Prototype.jsx),
// not fixed coordinates — the same reasoning as this app's own
// smoke-test suite moving away from hardcoded pixel clicks where
// possible. A step whose target isn't in the DOM (e.g. a future
// conditional element) is skipped automatically in both directions
// rather than showing a spotlight around nothing.
import React, { useState, useEffect, useCallback } from "react";
import { CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight, XIcon as X } from "@phosphor-icons/react";
import { NEUTRAL_DARK as DARK, RADIUS } from "../calculations/designTokens";

export const TOUR_STEPS = [
  { id: "welcome", target: null, title: "Quick tour", body: "A minute on where things live — each tab, search, and Settings. Skip anytime." },
  { id: "tab-contacts", target: "tab-contacts", title: "Contacts", body: "Everyone you track — profile, stated kinks/limits, testing history, and encounter history, all in one place." },
  { id: "tab-activity", target: "tab-activity", title: "Encounters", body: "Log a hookup, date, sauna trip, or group scene — who was there, what happened, protection used." },
  { id: "tab-medication", target: "tab-medication", title: "Medication", body: "PrEP, DoxyPEP, hormones, contraception — doses, stock, adherence, and refill reminders." },
  { id: "tab-healthcare", target: "tab-healthcare", title: "Healthcare", body: "Testing, clinic visits, symptoms, vaccinations — plus Menstrual, Contraception & Pregnancy tracking, once turned on in Settings." },
  { id: "tab-home", target: "tab-home", title: "Home", body: "Your dashboard — what's due, recent activity, quick-add shortcuts. Always the centre tab." },
  { id: "search-icon", target: "search-icon", title: "Search everything", body: "One search box across contacts, encounters, tests, symptoms — everything, in one place." },
  { id: "settings-icon", target: "settings-icon", title: "Settings", body: "Backups, App Lock & privacy, preferences, and colour customisation all live here — including a full written Guide to every section, if you want more detail than this tour." },
  { id: "closing", target: null, title: "That's it!", body: "Replay this tour anytime from Settings → Guide → \"Take the interactive tour\"." },
];

function isStepAvailable(step) {
  return !step.target || !!document.querySelector(`[data-tour="${step.target}"]`);
}

function findValidIndex(steps, fromIndex, direction) {
  let i = fromIndex + direction;
  while (i >= 0 && i < steps.length) {
    if (isStepAvailable(steps[i])) return i;
    i += direction;
  }
  return direction > 0 ? steps.length : -1;
}

export default function TourOverlay({ steps = TOUR_STEPS, onDone, darkMode }) {
  const [index, setIndex] = useState(() => {
    const first = isStepAvailable(steps[0]) ? 0 : findValidIndex(steps, 0, 1);
    return first < 0 ? -1 : first;
  });
  const [rect, setRect] = useState(null);
  const [, forceRecalc] = useState(0);

  const step = index >= 0 && index < steps.length ? steps[index] : null;

  const recalc = useCallback(() => {
    if (!step || !step.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  useEffect(() => {
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [recalc]);

  // Real anchors (bottom nav tabs in particular) can shift slightly as
  // other transient UI (a due-reminder banner, an update-available
  // banner) appears/disappears — a cheap poll while the tour is open
  // keeps the spotlight aligned without needing a bespoke observer for
  // every possible layout-shifting element.
  useEffect(() => {
    const id = setInterval(() => forceRecalc((n) => n + 1), 400);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    recalc();
  }, [recalc]);

  if (!step) return null;

  const goNext = () => {
    const next = findValidIndex(steps, index, 1);
    if (index === steps.length - 1 || next >= steps.length) {
      onDone("finished");
      return;
    }
    setIndex(next);
  };
  const goBack = () => {
    const prev = findValidIndex(steps, index, -1);
    if (prev >= 0) setIndex(prev);
  };

  const bg = darkMode ? DARK.surface : "#FFFFFF";
  const textPrimary = darkMode ? DARK.textPrimary : "#1B1B1F";
  const textSecondary = darkMode ? DARK.textSecondary : "#5B5B62";
  const isFirst = findValidIndex(steps, index, -1) < 0;
  const isLast = index === steps.length - 1 || findValidIndex(steps, index, 1) >= steps.length;

  const cardStyle = {
    background: bg,
    color: textPrimary,
    borderRadius: RADIUS.lg,
    padding: 20,
    width: "min(320px, calc(100vw - 32px))",
    boxShadow: "0 12px 36px rgba(0,0,0,.35)",
    pointerEvents: "auto",
  };

  const card = (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: textPrimary }}>{step.title}</div>
        <X size={18} weight="bold" color={textSecondary} role="button" aria-label="Skip tour" style={{ cursor: "pointer", flexShrink: 0, marginTop: 2 }} onClick={() => onDone("skipped")} />
      </div>
      <div style={{ fontSize: 13.5, color: textSecondary, lineHeight: 1.5, marginTop: 8 }}>{step.body}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
        <div style={{ fontSize: 12, color: textSecondary }}>{index + 1} / {steps.length}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!isFirst && (
            <button onClick={goBack} style={{ display: "flex", alignItems: "center", gap: 2, padding: "8px 12px", borderRadius: 999, border: darkMode ? "1px solid " + DARK.border : "1px solid #DCDCE1", background: "transparent", color: textPrimary, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <ChevronLeft size={14} weight="bold" /> Back
            </button>
          )}
          <button onClick={goNext} style={{ display: "flex", alignItems: "center", gap: 2, padding: "8px 14px", borderRadius: 999, border: "none", background: "#008585", color: "#FFFFFF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {isLast ? "Done" : "Next"} {!isLast && <ChevronRight size={14} weight="bold" />}
          </button>
        </div>
      </div>
    </div>
  );

  // Real, deliberate design choice: this is a Next/Back-driven tour, not
  // a "click the real, live element to advance" one — the spotlight
  // itself is a plain CSS box-shadow cutout, not an actual hole in the
  // DOM, so nothing beneath it is genuinely clickable through the
  // overlay. Simpler and more robust than puppeting real navigation
  // mid-tour (see this file's own header comment).
  if (!rect) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        {card}
      </div>
    );
  }

  const pad = 6;
  const spotTop = rect.top - pad;
  const spotLeft = rect.left - pad;
  const spotWidth = rect.width + pad * 2;
  const spotHeight = rect.height + pad * 2;

  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const cardWidthPx = Math.min(320, viewportW - 32);
  const preferBelow = rect.bottom + 16 + 140 < viewportH; // rough card-height allowance
  const cardLeft = Math.max(12, Math.min(rect.left + rect.width / 2 - cardWidthPx / 2, viewportW - cardWidthPx - 12));

  const cardPositionStyle = preferBelow
    ? { position: "fixed", top: rect.bottom + 16, left: cardLeft }
    : { position: "fixed", bottom: viewportH - rect.top + 16, left: cardLeft };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, pointerEvents: "auto" }}>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)" }} />
      <div style={{ position: "absolute", top: spotTop, left: spotLeft, width: spotWidth, height: spotHeight, borderRadius: 16, boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)", background: "transparent", pointerEvents: "none", transition: "top 150ms, left 150ms, width 150ms, height 150ms" }} />
      <div style={{ position: "absolute", top: spotTop, left: spotLeft, width: spotWidth, height: spotHeight, borderRadius: 16, border: "2px solid #008585", pointerEvents: "none" }} />
      <div style={cardPositionStyle}>{card}</div>
    </div>
  );
}

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
import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight, XIcon as X } from "@phosphor-icons/react";
import { NEUTRAL, NEUTRAL_DARK as DARK, ACCENTS, ACCENT_TEXT_SAFE, RADIUS, TYPE } from "../calculations/designTokens";

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
  // ADDED — real bug found: the card's vertical position was computed
  // from a fixed "140" rough allowance, with no real clamp against the
  // viewport at all (unlike cardLeft's own Math.max/Math.min clamp
  // below) — a step whose target sits very close to the top or bottom
  // edge could push the card partially or fully off-screen. Measuring
  // the card's own real rendered height (it's a fixed-width bubble
  // with variable body-text length, so this can't be guessed
  // accurately) makes the same real clamp possible vertically too.
  const cardRef = useRef(null);
  const [cardHeight, setCardHeight] = useState(160);

  const step = index >= 0 && index < steps.length ? steps[index] : null;

  useLayoutEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.getBoundingClientRect().height);
  }, [step]);

  const recalc = useCallback(() => {
    if (!step || !step.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    // ADDED — real bug: every current step's target lives in the
    // always-visible bottom nav or Home's own fixed header, so this
    // was never actually exercised, but a target inside real scrolling
    // content (a future step) could sit off-screen with no way for the
    // spotlight to ever reach it. `scrollIntoView` is a no-op when the
    // element's already fully visible, so this costs nothing today.
    if (r.top < 0 || r.bottom > window.innerHeight) {
      el.scrollIntoView({ block: "center", behavior: "auto" });
      setRect(el.getBoundingClientRect());
      return;
    }
    setRect(r);
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

  const bg = darkMode ? DARK.surface : NEUTRAL.surface;
  const textPrimary = darkMode ? DARK.textPrimary : NEUTRAL.textPrimary;
  const textSecondary = darkMode ? DARK.textSecondary : NEUTRAL.textSecondary;
  const isFirst = findValidIndex(steps, index, -1) < 0;
  const isLast = index === steps.length - 1 || findValidIndex(steps, index, 1) >= steps.length;

  const cardStyle = {
    background: bg,
    color: textPrimary,
    borderRadius: RADIUS.lg,
    padding: 20,
    // FIXED — real bug: default `box-sizing: content-box` meant this
    // 320px `width` was the CONTENT box only, with the 20px+20px
    // padding added on top — the card actually rendered 40px wider
    // (360px) than `cardWidthPx` below assumed, so the horizontal
    // clamp undershot by 40px and the card could hang off the right
    // edge of the screen (confirmed live: a real 28px overflow on the
    // settings-icon step, on a 390px-wide viewport). `border-box` makes
    // this 320px figure the TRUE rendered width, matching `cardWidthPx`
    // exactly.
    boxSizing: "border-box",
    width: "min(320px, calc(100vw - 32px))",
    boxShadow: "0 12px 36px rgba(0,0,0,.35)",
    pointerEvents: "auto",
    // FIXED — real bug: this file had zero fontFamily declarations
    // anywhere, so the whole card rendered in the browser's own default
    // serif font instead of the app's real Inter — every other screen
    // in this app sets this explicitly per-element since there's no
    // global CSS default (see the architecture rules on self-hosted
    // fonts). Set once here and inherited by every plain child below —
    // EXCEPT the two <button>s, which need their own explicit copy:
    // form controls don't inherit font-family from an ancestor div the
    // way a <span>/<div> does (a real, confirmed browser default,
    // verified live — both buttons still rendered in Arial after this
    // fix alone, only the surrounding text switched to Inter).
    fontFamily: "'Inter', sans-serif",
  };

  const card = (
    <div ref={cardRef} style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ ...TYPE.subScreenTitle, color: textPrimary }}>{step.title}</div>
        <X size={18} weight="bold" color={textSecondary} role="button" aria-label="Skip tour" style={{ cursor: "pointer", flexShrink: 0, marginTop: 2 }} onClick={() => onDone("skipped")} />
      </div>
      <div style={{ fontSize: 13.5, color: textSecondary, lineHeight: 1.5, marginTop: 8 }}>{step.body}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
        <div style={{ fontSize: 12, color: textSecondary }}>{index + 1} / {steps.length}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!isFirst && (
            <button onClick={goBack} style={{ display: "flex", alignItems: "center", gap: 2, padding: "8px 12px", borderRadius: 999, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), background: "transparent", color: textPrimary, fontSize: 13, fontWeight: 600, fontFamily: "'Inter', sans-serif", cursor: "pointer" }}>
              <ChevronLeft size={14} weight="bold" /> Back
            </button>
          )}
          <button onClick={goNext} style={{ display: "flex", alignItems: "center", gap: 2, padding: "8px 14px", borderRadius: 999, border: "none", background: ACCENT_TEXT_SAFE.home, color: "#FFFFFF", fontSize: 13, fontWeight: 600, fontFamily: "'Inter', sans-serif", cursor: "pointer" }}>
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
  // FIXED — real bug: the spotlight always used a fixed 16px corner
  // radius, which reads fine against the other 4 (rectangular) nav
  // tabs but visibly mismatches Home's own real shape — a true 48x48
  // circle (see App.jsx's own "raised, circular" comment on that tab).
  // Round the spotlight to a real circle whenever the target itself is
  // roughly circular (near-square, generously rounded already), rather
  // than hardcoding "tab-home" specifically — the same test would also
  // correctly cover any future circular anchor.
  const targetIsCircular = Math.abs(rect.width - rect.height) < 8 && rect.width < 64;
  const spotRadius = targetIsCircular ? "50%" : 16;

  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const cardWidthPx = Math.min(320, viewportW - 32);
  const margin = 12;
  // FIXED — real bug: this used to pick "below" from a rough, hardcoded
  // 140px card-height guess, then position with no vertical clamp at
  // all (unlike cardLeft's own real clamp a few lines below) — a step
  // near the top or bottom edge, or with a longer body than the guess
  // assumed, could push the card partially off-screen. Now uses the
  // card's own REAL measured height (cardHeight, from the
  // useLayoutEffect above) for both the below/above decision and a
  // real vertical clamp, the same rigor cardLeft already had.
  const preferBelow = rect.bottom + 16 + cardHeight + margin < viewportH;
  const cardLeft = Math.max(margin, Math.min(rect.left + rect.width / 2 - cardWidthPx / 2, viewportW - cardWidthPx - margin));
  const cardTop = preferBelow
    ? Math.min(rect.bottom + 16, viewportH - cardHeight - margin)
    : Math.max(rect.top - 16 - cardHeight, margin);

  const cardPositionStyle = { position: "fixed", top: cardTop, left: cardLeft };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, pointerEvents: "auto" }}>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)" }} />
      <div style={{ position: "absolute", top: spotTop, left: spotLeft, width: spotWidth, height: spotHeight, borderRadius: spotRadius, boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)", background: "transparent", pointerEvents: "none", transition: "top 150ms, left 150ms, width 150ms, height 150ms" }} />
      {/* FIXED — real bug: this ring shares the exact same top/left/
          width/height as the cutout div above it, but without
          boxSizing: "border-box" its 2px border renders OUTSIDE that
          box (the default content-box model) while the cutout div next
          to it has no border at all — the ring's own box ends up 4px
          bigger in both dimensions with the same top-left origin,
          shifting its effective center 2px down-right relative to the
          cutout it's supposed to trace exactly. Most visible on the
          small icon-circle steps (search/settings), where a 2px shift
          is a bigger fraction of the ring's own ~31px diameter. */}
      <div style={{ position: "absolute", top: spotTop, left: spotLeft, width: spotWidth, height: spotHeight, boxSizing: "border-box", borderRadius: spotRadius, border: `2px solid ${ACCENTS.home}`, pointerEvents: "none" }} />
      <div style={cardPositionStyle}>{card}</div>
    </div>
  );
}

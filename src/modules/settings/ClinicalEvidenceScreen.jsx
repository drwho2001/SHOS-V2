// ClinicalEvidenceScreen.jsx
//
// ADDED 2 Oct 2026 - the home of the sourced citations behind the U=U note.
//
// WHY THIS IS ITS OWN SCREEN. The owner asked for these references to move out
// of the Glossary, and that was right: a general clinical-shorthand lookup is the
// wrong home for citations, and hanging four PDF links off one term made the
// glossary read as a citation list. But the obvious destination - Resources - was
// also wrong, because that list is user-editable and repository-backed, so the
// evidence for a public-health claim would be deletable by accident. The
// citations live in code instead, in clinicalEvidence.js, exactly like the note
// they support.
//
// The explanation stays in the Glossary, where it reads as reference material.
// This screen holds the immutable evidence and is reached from there. Own screen
// rather than a Glossary section, because it gives future evidence - a
// correction, a redaction, a broken link, a replacement document - an obvious
// home without disturbing a glossary that is browsed alphabetically.
//
// IT IS UI, NOT DATA. Nothing here is stored, editable, or user-owned. That is
// the entire point: a claim this app makes cannot lose its evidence behind an
// edit.
import React, { useRef, useEffect } from "react";
import { NEUTRAL_DARK as DARK, STICKY_SCREEN_HEADER_TOP } from "../../calculations/designTokens";
import { CaretLeftIcon as ChevronLeft, FlaskIcon as Flask } from "@phosphor-icons/react";
import { NEUTRAL, RADIUS, TYPE } from "../../calculations/designTokens";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { U_U_SOURCES, EVIDENCE_GROUPS } from "./clinicalEvidence";

// The one-sentence takeaway, leading the entry - the owner's own wording, and
// deliberately NOT phrased about the reader. It states what the science is, not
// what it means for you, so it stays true whatever someone's status happens to
// be. A second-person version ("you cannot pass it on") would read as a claim
// about whoever is looking at the screen.
const LEAD =
  "If the level of virus in your blood is so low that a blood test cannot detect it, then it cannot be passed on.";

// The longer explanation. Person-neutral, and unchanged in substance from the copy
// that has been on the note since 1 Oct 2026 - moved here, not rewritten, because
// that copy already passed the person-neutral review and there is no reason to
// churn wording nobody complained about.
const DETAIL =
  "Undetectable = Untransmittable, usually shortened to U=U. When someone is on HIV treatment and their viral load stays undetectable - below 50 copies per millilitre of blood, confirmed on repeated tests - they cannot pass HIV on sexually. The word that matters is 'stays': one undetectable result is a single measurement, whereas U=U rests on a viral load that has remained undetectable over time. Different laboratories can detect down to different levels, so 'undetectable' always describes a test result rather than a fixed state of someone's health.";

// ALWAYS SHOWN, NOT A DROP-DOWN - reversed 2 Oct 2026 at the owner's explicit
// ask, after the first version collapsed this behind a single toggle. The first
// argument for collapsing was decluttering, and Gemini made the opposite case:
// the whole purpose of this screen is that the evidence is CHECKABLE by someone
// the phone is handed to, so hiding it behind a tap re-introduces the exact
// doubt the screen exists to answer. The decluttering worry is answered by
// grouping instead of hiding - four links under three headings reads shorter
// than one collapsed row the reader has to open to learn there are four.
function EvidenceGroup({ title, sources, T }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ ...TYPE.sectionLabel, color: T.textDisabled, padding: "0 0 6px" }}>{title}</div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: "12px 14px" }}>
        {/* fontSize is set on THIS <ul> deliberately, and so is one on each
            <li> further down. The original version set neither, so both
            inherited the browser's 16px ROOT default instead of the 12px the
            surrounding card text uses - same font family, so it read as a
            different typeface rather than an obvious size bug. Measured on the
            device before fixing, not guessed at. */}
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
          {sources.map((s) => (
            <li key={s.url} style={{ marginBottom: 8, fontSize: 12, lineHeight: 1.45 }}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: T.textSecondary, textDecoration: "underline", textUnderlineOffset: 2 }}
              >
                {s.label}
              </a>{" "}
              <span style={{ color: T.textDisabled }}>
                ({s.publisher} &middot; checked {s.checkedOn})
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function ClinicalEvidenceScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  // The inline ternary every sibling Settings sub-screen uses. There is no shared
  // dark-theme resolver in this codebase and inventing one here would be a new
  // pattern for no reason.
  const T = darkMode ? DARK : NEUTRAL;

  // Grouped by context, in EVIDENCE_GROUPS' declared order rather than in
  // whatever order the sources happen to sit in the array - so adding a source
  // cannot reorder the screen, and a group whose sources all move elsewhere
  // simply stops rendering instead of leaving an empty heading.
  const groups = EVIDENCE_GROUPS.map((g) => ({
    ...g,
    sources: U_U_SOURCES.filter((s) => s.group === g.key),
  }));

  const dialogRef = useRef(null);
  useEffect(() => { dialogRef.current?.focus(); }, []);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label="Clinical evidence"
      tabIndex={0}
      style={{
        position: "fixed",
        inset: 0,
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "calc(80px + env(safe-area-inset-bottom))",
        background: darkMode ? DARK.bg : NEUTRAL.bg,
        zIndex: 225,
        overflowY: "auto",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 16,
          position: "sticky",
          top: STICKY_SCREEN_HEADER_TOP,
          background: darkMode ? DARK.bg : NEUTRAL.bg,
          borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border),
        }}
      >
        <ChevronLeft
          size={22}
          color={T.textPrimary}
          style={{ cursor: "pointer" }}
          onClick={onClose}
          role="button"
          tabIndex={0}
          aria-label="Back"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
            }
          }}
        />
        <Flask size={19} weight="bold" color={T.textPrimary} />
        <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: T.textPrimary }}>Clinical evidence</h1>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.45, marginBottom: 16 }}>
          Sources behind statements this app makes. These ship with the app and cannot be edited or
          removed — if a claim here matters to you, this is where to check it rather than take the
          app&apos;s word for it.
        </div>

        {/* The lead takeaway is its own BLOCK, not an inline bold phrase inside a
            paragraph. Gemini's review pushed back on inline bolding specifically:
            one bold clause in dense body copy reads clunky and fights the text
            around it. As a lead line it gives the reader the actual claim
            immediately, with the technical detail demoted beneath it. */}
        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderLeft: `3px solid ${T.healthcareBlue}`,
            borderRadius: RADIUS.md,
            padding: 14,
            marginBottom: 14,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, lineHeight: 1.45, marginBottom: 8 }}>
            {LEAD}
          </div>
          <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.45 }}>{DETAIL}</div>
        </div>

        {groups.map((g) => (
          <EvidenceGroup key={g.key} title={g.label} sources={g.sources} T={T} />
        ))}

        <div style={{ fontSize: 11, color: T.textDisabled, lineHeight: 1.5 }}>
          These are third-party documents and are not maintained by this app. Each one was opened and
          read on the date shown against it, so a reference that has since been revised, moved or
          withdrawn will not say so here &mdash; this is a snapshot taken on that date, not a live
          feed. If a claim here matters to you, open the source and check it rather than take this
          screen&apos;s word for it either way.
        </div>
      </div>
    </div>
  );
}
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
import React, { useRef, useEffect, useState } from "react";
import { NEUTRAL_DARK as DARK } from "../../calculations/designTokens";
import { CaretLeftIcon as ChevronLeft, FlaskIcon as Flask, CaretDownIcon } from "@phosphor-icons/react";
import { NEUTRAL, RADIUS, TYPE } from "../../calculations/designTokens";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { U_U_SOURCES } from "./clinicalEvidence";

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

function EvidenceGroup({ title, intro, sources, collapsed, onToggle, T }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, marginBottom: 14, overflow: "hidden" }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
          }
        }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", cursor: "pointer" }}
      >
        <div style={{ ...TYPE.sectionLabel, color: T.textSecondary }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: T.textDisabled }}>{sources.length}</span>
          <CaretDownIcon
            size={13}
            color={T.textSecondary}
            style={{ transform: collapsed ? "none" : "rotate(180deg)", transition: "transform 150ms ease" }}
          />
        </div>
      </div>

      {!collapsed && (
        <div style={{ padding: "0 14px 14px" }}>
          {intro && (
            <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.45, marginBottom: 10 }}>{intro}</div>
          )}
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
      )}
    </div>
  );
}

export default function ClinicalEvidenceScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  // The inline ternary every sibling Settings sub-screen uses. There is no shared
  // dark-theme resolver in this codebase and inventing one here would be a new
  // pattern for no reason.
  const T = darkMode ? DARK : NEUTRAL;

  // Collapsed by default: the owner's ask was decluttering, and an open list of
  // four PDF links competes with the explanation it is evidence FOR. Component
  // state, deliberately NOT persisted - it is a reading convenience rather than a
  // preference, and the governing privacy rule is that the note's presence cannot
  // disclose anything, so "I opened the U=U evidence" must not become a stored
  // signal either.
  const [uuOpen, setUuOpen] = useState(false);

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
          top: 0,
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

        <EvidenceGroup
          title="U=U sources"
          intro="Published guidance and evidence for the statement above."
          sources={U_U_SOURCES}
          collapsed={!uuOpen}
          onToggle={() => setUuOpen((v) => !v)}
          T={T}
        />

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
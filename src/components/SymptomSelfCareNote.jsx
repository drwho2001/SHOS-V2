// SymptomSelfCareNote.jsx
//
// A tap-to-reveal explanation for a menstrual symptom, shown at the point of
// use (Symptom Log rows, the cycle form). Same disclosure pattern as
// JargonNote and HivStatusNote — a quiet info dot that opens on tap, never a
// hover-only `title` tooltip, because this app targets touchscreens.
//
// WHY NOT JargonNote. That component is deliberately one sentence, keyed to
// JARGON_NOTES, and links to the Glossary. A self-care note is a short
// PARAGRAPH plus a list plus an approved neutral line — more than the one-
// sentence bound — and the words live in symptomSelfCare.js (the single owner),
// not the Glossary. So this is a sibling component with the same affordance,
// taking a symptom name as its key so no screen can pass its own wording.
//
// UNKNOWN KEYS render nothing. The registry also holds non-menstrual symptoms
// (e.g. "Urethral discharge") and user-created ones; there is no bank copy for
// those, and inventing a note at the call site is exactly what the keyed design
// forbids. Returning null is the honest outcome.
//
// Colours come only from T.* tokens so styleColourGuard needs no new baseline.
import { useState } from "react";
import { InfoIcon } from "@phosphor-icons/react";
import { symptomSelfCare, SOONER_LINE, symptomSource } from "../calculations/symptomSelfCare";

export function SymptomSelfCareNote({ T, symptom, compact = false }) {
  const [open, setOpen] = useState(false);
  const entry = symptomSelfCare(symptom);
  if (!entry) return null;
  const source = symptomSource(symptom);

  return (
    <div style={{ padding: "2px 0 6px" }}>
      <span
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`About ${entry.label}: what to know and what may help.`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          cursor: "pointer",
          color: open ? T.textSecondary : T.textDisabled,
          fontSize: 11,
          lineHeight: 1.2,
          padding: 4,
          margin: "-4px 0 0 -4px",
        }}
      >
        <InfoIcon size={12} color={open ? T.textSecondary : T.textDisabled} />
        {compact && <span>Would it help to know more?</span>}
      </span>

      {open && (
        <div style={{ marginTop: 6, padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.surfaceVariant }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>{entry.label}</div>
          <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.45 }}>{entry.explanation}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, margin: "10px 0 4px" }}>Things that may help</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: T.textSecondary, fontSize: 12, lineHeight: 1.5 }}>
            {entry.selfCare.map((item) => <li key={item}>{item}</li>)}
          </ul>
          {entry.sooner && (
            <div style={{ fontSize: 12, color: T.textPrimary, marginTop: 10, lineHeight: 1.45 }}>
              If this is new for you or keeps happening, {SOONER_LINE} — bring what you've logged here.
            </div>
          )}
          {source && (
            <a href={source.url} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", marginTop: 10, fontSize: 11, color: T.textSecondary, textDecoration: "underline" }}>
              {source.label} (checked {source.checkedOn})
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default SymptomSelfCareNote;

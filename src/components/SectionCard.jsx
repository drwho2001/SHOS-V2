// SectionCard.jsx
//
// A titled card used to group a form or a record's fields.
//
// WHY THIS IS SHARED. It was defined locally, byte-identically, in FIVE modules:
// SHOS_Vaccinations, SHOS_Timeline, SHOS_Testing, SHOS_SymptomLog and
// SHOS_MyProfile. Four were exact copies; MyProfile differed in exactly one
// character - its label colour - so it is the reason `accent` is a prop rather
// than a hardcoded value. Consolidating it means a change to the card's spacing,
// border or label style is one edit instead of five, and four of them could not
// drift out of step.
//
// `accent` DEFAULTS to the healthcare blue because that is what four of the five
// used. MyProfile passes its own module teal, which is a deliberate per-module
// colour decision - module colour is what makes a screen recognisable at a
// glance - and not a mistake this component is "fixing".
//
// It reads T (the active theme) as a prop rather than importing a theme hook,
// matching how every caller already worked. Nothing here is stateful or
// effectful: it is a presentational box, which is why extracting it is safe.

import { RADIUS, TYPE } from "../calculations/designTokens.js";

export default function SectionCard({ title, T, children, accent }) {
  const labelColor = accent || T.healthcareBlue;
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: RADIUS.md, background: T.surface, padding: "4px 14px 14px", marginTop: 14 }}>
      <div style={{ ...TYPE.sectionLabel, color: labelColor, paddingTop: 12, marginBottom: 2 }}>{title}</div>
      {children}
    </div>
  );
}

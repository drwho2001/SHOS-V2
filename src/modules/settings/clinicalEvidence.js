// clinicalEvidence.js
//
// ADDED 2 Oct 2026 - the ONE owner of the clinical citations behind the U=U note.
//
// WHY A SEPARATE FILE, AND WHY NOT IN Resources. The owner asked for these to
// move out of the Glossary. The first answer was "put them in Resources", and
// that was wrong in a way worth recording rather than quietly fixing: the
// Resources list is user-editable and repository-backed, so the evidence for a
// public-health claim would be deletable by accident. Delete the BHIVA entry and
// the app is asserting U=U with nothing left to check it against. Trading a
// styling problem (citations looked out of place in a shorthand glossary) for an
// integrity problem is not a trade. Gemini's independent review reached the same
// conclusion more bluntly: user data and reference evidence must never share a
// mutable namespace.
//
// So this lives in code, like the note it supports, and is rendered by
// ClinicalEvidenceScreen. A future correction, redaction, or broken link has an
// obvious home.
//
// SOURCED, NOT GUESSED. Every URL below was fetched and read on the date given,
// and each is a document that actually states the claim - not a search result
// about it. The repo has been bitten repeatedly by unsourced constants shipped
// with confident wording, so "I think they have a document" is not good enough.
//
// FRSH was specifically considered and is deliberately ABSENT. The owner guessed
// it would have an appropriate citation; a search did not surface a U=U-specific
// FRSH document, so citing one would be asserting a source nobody has read. Add
// it here when the exact document is known - the shape below is the contract.
//
// BHIVA leads because this is a UK app and BHIVA is the UK specialist body. Its
// HIV-2 non-technical summary is included specifically because it states U=U in
// plain English for a non-clinical reader - the "hand it to someone who doubts
// you" case rather than the "evidence for a clinician" case.

export const U_U_SOURCES = [
  {
    label: "BHIVA: routine investigation and monitoring of HIV-positive adults",
    publisher: "British HIV Association",
    url: "https://bhiva.org/wp-content/uploads/2024/10/Monitoring-Guidelines.pdf.pdf",
    checkedOn: "2026-10-02",
  },
  {
    label: "BHIVA non-technical summary (plain-English, states U=U directly)",
    publisher: "British HIV Association",
    url: "https://bhiva.org/wp-content/uploads/2024/12/HIV-2-non-tech-summary.pdf",
    checkedOn: "2026-10-02",
  },
  {
    label: "U=U for clinical practice",
    publisher: "HIV Guidelines (NIH/WHS/HIVMA)",
    url: "https://www.hivguidelines.org/guideline/u-equals-u",
    checkedOn: "2026-10-02",
  },
  {
    label: "Undetectable = Untransmittable",
    publisher: "UNAIDS",
    url: "https://www.unaids.org/sites/default/files/media_asset/undetectable-untransmittable_en.pdf",
    checkedOn: "2026-10-02",
  },
];
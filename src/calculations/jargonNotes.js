// jargonNotes.js
//
// The one-sentence explanations for jargon the app uses on its own screens.
// ONE OWNER, exported, so the same term cannot be explained two different ways
// on two different forms - the same reason hivStatusCalculations.js owns U_U_SHORT
// rather than each screen phrasing its own.
//
// WHY THIS FILE EXISTS. The Glossary defined BASHH, PrEP and DoxyPEP properly,
// and the forms still used them bare: a PrEP dropdown whose options read
// "Adequate - Event-based (2-1-1)", a role chip set offering "Vers" and
// "Switch" with no definition anywhere near the tap, a testing ring captioned
// "(BASHH guidance)". A definition in a screen the reader has to go and find is
// not a definition at the point of use. This is the short form that can sit
// beside the term without becoming a wall of text; the Glossary keeps the full
// entry and its sources.
//
// THE LENGTH RULE, AND WHY IT IS A RULE. Each note is ONE sentence, under about
// 150 characters. An earlier version of the U=U note rendered its full paragraph
// on every record and was reverted: text that is permanently visible beside a
// field the reader did not ask about stops being read at all, and on a form with
// five such fields it turns the form into prose. The affordance is therefore a
// tap-to-reveal bubble, never an always-on paragraph - see JargonNote.jsx.
//
// WHAT IS DELIBERATELY ABSENT. No note here claims anything about the user or
// about a particular encounter. They define vocabulary, not state. A note that
// read "because your last dose was 40 hours ago" would be a different component
// with different disclosure consequences, and conditioning the presence of
// explanatory text on a value is precisely the pattern HivStatusNote.jsx
// documents as disqualifying - its presence would flag the record it sat on.
//
// SOURCING - WHY THE ATTRIBUTION IS IN THE NOTE AND NOT ONLY IN THE GLOSSARY.
// An unattributed clinical claim at the point of use reads as developer folk
// wisdom rather than guidance, which is the thing that makes someone decline a
// dose. So each note that states a CLINICAL claim carries its source inline:
// body and year, no hyperlink, no URL. That was decided after consulting the free
// model on 9 Oct (tasks/t104/90-gemini-consult.md records the exchange), whose
// argument for inline attribution was accepted and whose stronger argument - that
// a doubting reader will leave the app and search, exposing themselves - was
// rejected, because sending the user of a no-backend tracker to a web search is a
// worse privacy outcome than anything the note itself could cause, and it argues
// against the premise the whole app is built on.
//
// THE URL STAYS IN THE GLOSSARY. Body-and-year is enough to establish
// provenance at a glance; the linkable document is what a reader wants when they
// want to check, and duplicating a URL into four notes is four places for it to
// go stale. The citations here are the SAME ones docs/MODELS.md and
// doxyPepCalculations.js already use - BASHH 2025 and CDC 2024 - so this file
// introduces no new clinical claim, only a shorter form of an existing one.
//
// VOCABULARY IS NOT GUIDANCE. A note that defines this app's own vocabulary -
// which role axis a chip belongs to - carries no source, because there is nothing
// external to cite. The gate enforces that distinction: clinical notes must name
// a source, and the app's own terms must not pretend to one.
export const JARGON_NOTES = {
  // The PrEP coverage dropdown. "2-1-1" is the event-based regimen's name, and
  // the name is the thing a reader cannot infer - two pills before, one after,
  // and only for a specific kind of sex. Guidance, so it is attributed.
  "prep-2-1-1":
    "2-1-1 is the event-based PrEP schedule: two pills 2 hours before sex, one pill the day after (BASHH 2025).",

  // The kink role chips. "Top / bottom / Vers" is the position axis;
  // "Dom / sub / Switch" is the power-dynamic axis. They are deliberately
  // different vocabularies for different questions, and a reader who does not
  // know that will read "Vers" as a third position option rather than "either".
  // This is THIS APP'S OWN vocabulary, not external guidance, so there is
  // nothing to cite and citing something would misrepresent it as clinical.
  "role-axes":
    "Two separate questions: position (Top / bottom / Vers) and dynamic (Dom / sub / Switch), recorded apart.",

  // The testing ring's "(BASHH guidance)" caption on Home. The 90-day interval is
  // a recommendation this app applies on the reader's behalf, so it is the case
  // where provenance matters most: it is a number the app is holding them to.
  "bashh":
    "BASHH is the UK's professional body for sexual health guidance; the 90-day retest interval is theirs (BASHH 2023).",

  // The DoxyPEP notification body's "qualifying activity" and the DoxyPEP card's
  // reason line. This is the one note that most needs to exist: the term decides
  // whether a 72-hour clock starts at all, and reading it as "any sex" or "any
  // encounter" gives a materially different answer. The window is the sourced
  // part; the definition of the term is this app's, so the citation attaches to
  // the window rather than implying the whole sentence is quoted guidance.
  "qualifying-activity":
    "Qualifying activity is condomless anal, vaginal or oral sex - what starts the 72-hour DoxyPEP clock (BASHH 2025).",
};

export default JARGON_NOTES;

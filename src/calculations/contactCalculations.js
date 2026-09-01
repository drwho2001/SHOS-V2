// contactCalculations.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// These functions never store anything. They look at every contact that
// already exists and build a "here's what's been typed before" list —
// which is exactly what powers the combobox fields (pick from what's
// been used, or type something new). The first time anyone types "Impact
// play" into Stated Kinks, it isn't in the list yet — but as soon as
// it's saved on that one contact, this function will surface it as a
// suggestion for every contact after that. Nothing needs to be manually
// added to a master list anywhere.

// A small starting point so City isn't empty on day one — everything
// typed afterwards (new or existing) joins this automatically.
const STARTER_CITIES = ["Hull", "Sheffield", "Leeds", "Manchester", "Doncaster", "Driffield", "Beverley", "Brighton", "Bolton", "London"];

export function getKnownCities(contacts) {
  const used = contacts.map((c) => c.city).filter(Boolean);
  return Array.from(new Set([...STARTER_CITIES, ...used])).sort((a, b) => a.localeCompare(b));
}

// General-purpose version for any tag-list field (Stated Kinks, Limits,
// Contactable via) — no starter list, since there's nothing to seed
// these with yet. Purely "what's already been typed, across everyone".
export function getKnownValues(contacts, fieldName) {
  const all = contacts.flatMap((c) => c[fieldName] || []);
  return Array.from(new Set(all)).sort((a, b) => a.localeCompare(b));
}

// Address autocomplete — SAME pattern as getKnownCities: suggests
// addresses already typed for other contacts. This is NOT real
// geocoding/Places autocomplete (still needs a live API key this
// sandbox and this prototype don't have) — it's "have I typed this
// before", which at least stops re-typing the same address for a
// contact met at the same place as someone else.
export function getKnownAddresses(contacts) {
  const used = contacts.map((c) => c.address).filter(Boolean);
  return Array.from(new Set(used)).sort((a, b) => a.localeCompare(b));
}

// Quick, low-risk standardization for kink/limit-style tags, per the user's
// "standardise kinks" ask. This does NOT solve true synonyms ("Impact
// play" vs "Percussion play" still won't match) — that needs a real
// Kink Registry (Notion already has one: kink_id, Kink Name, and
// relations both ways — see the 17 Aug 2026 working log entry). This
// only collapses the cheap, common near-duplicates: inconsistent
// spacing and casing ("impact  play", "IMPACT PLAY", "Impact play" all
// become "Impact Play"), so the suggestion list doesn't visibly fill up
// with near-identical entries while a real registry is still pending.
export function normalizeTag(raw) {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word.length > 0 ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word)
    .join(" ");
}

// ADDED 19 Aug 2026 — real gap from the ~90-item StackBlitz batch: typing
// "fisting top, piss bottom" into Stated Kinks/Limits should extract the
// role (Top/Bottom/Vers) AND still split on the comma into two separate
// kink entries — previously the role had to be set afterwards via the
// tap-to-cycle badge, and the whole phrase (including the role word)
// would get resolved as one literal kink name.
//
// Deliberately conservative: only checks the FIRST and LAST word of each
// comma-separated phrase against the known role vocabulary (case-
// insensitive exact word match), trailing word checked first since
// "fisting top" reads more naturally than "top fisting". A role word
// appearing in the middle of a kink name (unlikely, but possible) is left
// alone rather than guessed at. Returns the role untouched (matching
// roleOptions' own casing, e.g. "Top") and the remaining text with the
// role word removed, ready for normalizeTag/resolveSynonym as before.
export function extractKinkRoleFromText(raw, roleOptions = []) {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed || roleOptions.length === 0) return { text: trimmed, role: null };
  const words = trimmed.split(" ");
  if (words.length < 2) return { text: trimmed, role: null };

  const matchRole = (word) => roleOptions.find((r) => r.toLowerCase() === word.toLowerCase()) || null;

  const lastRole = matchRole(words[words.length - 1]);
  if (lastRole) return { text: words.slice(0, -1).join(" "), role: lastRole };

  const firstRole = matchRole(words[0]);
  if (firstRole) return { text: words.slice(1).join(" "), role: firstRole };

  return { text: trimmed, role: null };
}

// REINTRODUCED 17 Aug 2026 (the user): the stored `contactableVia` array on a
// contact now holds only the EXTRA platforms that don't have their own
// dedicated field (Tinder, Bumble, Grindr, etc.) — typed in manually.
// This function is what actually gets DISPLAYED anywhere "contactable
// via" shows up (Card icons, Profile row): it's the stored extras PLUS
// whichever of Phone/WhatsApp, Snapchat, Fabguys, Fabswingers already
// have a value, auto-detected so nothing has to be typed twice. Order:
// auto-detected first (fixed, predictable order), then manual extras.
export function getContactableVia(contact) {
  const autoDetected = [];
  if (contact.phone) autoDetected.push("Phone/WhatsApp");
  if (contact.snapchat) autoDetected.push("Snapchat");
  if (contact.fabguys) autoDetected.push("Fabguys");
  if (contact.fabswingers) autoDetected.push("Fabswingers");
  // FIXED 1 Sep 2026 — real gap found while fixing the icon map: Recon
  // was added as its own real field later than the other three (see
  // its own comment in the edit form) but this function was never
  // updated to match — a Recon username never actually showed up as a
  // detected contact method anywhere, silently.
  if (contact.recon) autoDetected.push("Recon");

  const combined = [...autoDetected];
  (contact.contactableVia || []).forEach((extra) => {
    if (!combined.includes(extra)) combined.push(extra);
  });
  return combined;
}

// "Incomplete" sort support — a simple 0–1 completeness score, purely
// derived, never stored. Counts how many of a contact's own fields
// actually have something in them (a non-empty string, a populated
// array, a real number, or a meaningful true/false where the field is
// specifically about a yes/no fact like Drives). Identity/system fields
// (id, createdAt, isArchived) don't count either way — completeness is
// about how much is actually known about the person, not bookkeeping.
const FIELDS_COUNTED_FOR_COMPLETENESS = [
  "name", "nickname", "age", "phone", "snapchat", "fabguys", "fabswingers",
  "contactableVia", "city", "address", "hosts", "travels",
  "availability", "readilyAvailable", "relationshipType", "howDidWeMeet",
  "meetAgain", "statedKinks", "limits", "bdsmRole", "sexualPosition", "length", "thickness", "foreskin",
  "chastityStatus", "cummer", "knownPrepDoxy", "lastTestedDate", "notes",
];

function isFilled(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return true;
  return !!value;
}

export function getCompletenessScore(contact) {
  const filled = FIELDS_COUNTED_FOR_COMPLETENESS.filter((key) => isFilled(contact[key])).length;
  return filled / FIELDS_COUNTED_FOR_COMPLETENESS.length;
}

// ADDED 26 Aug 2026 — real ask: an "Incomplete" tag shown directly on
// cards, decided jointly with the user rather than guessed. Deliberately
// a SMALL, specific required set — not the ~27-field weighted score
// above (that stays as-is, used only for the "sort by incomplete"
// option) — framed around "what do I need to decide whether to meet
// this person again": some identifier, approximate age, location
// (meeting again is logistical), and role/position (this app's own
// core compatibility signal). Rating and "meet again" itself were
// explicitly excluded — those are the OUTPUT of that decision, not
// information you'd have going in, so requiring them would flag every
// brand-new contact as incomplete before you've even met. A photo was
// also explicitly declined.
// markedComplete is a real per-contact override (same pattern as
// excludeFromActiveTracking) — for legacy/placeholder contacts that
// will genuinely never have this info and shouldn't be nagged about
// forever.
export function isContactIncomplete(contact) {
  if (contact.markedComplete) return false;
  const hasIdentifier = isFilled(contact.name) || isFilled(contact.nickname);
  const hasAge = isFilled(contact.age);
  const hasCity = isFilled(contact.city);
  const hasRolePosition = isFilled(contact.bdsmRole) || isFilled(contact.sexualPosition);
  return !(hasIdentifier && hasAge && hasCity && hasRolePosition);
}

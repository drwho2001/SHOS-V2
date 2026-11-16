// safetyShareFields.js — pure rules for the two optional Safety Share extras:
// a Google Maps LIVE location link (created in the Maps app, pasted here) and
// a check-in deadline the recipient should act on if we don't report back.
//
// WHY PURE: both decide what actually leaves the device in a shared message
// and what gets scheduled as a notification. The repo has been bitten before
// by "the UI ticked a box but the text didn't change" (BACKLOG 59/60) and by
// rules computed in several places drifting apart, so the parsing, validation
// and message text live here and are asserted directly by tests. No React,
// no native plugins, no clock except the one passed in.
//
// A WebView CANNOT create a real Google Maps live-location link — those links
// are minted by the Maps app when the user starts Live location sharing. The
// sheet therefore opens Maps, the user copies the link there, and pastes it
// back. We validate the shape (only Google's own hosts) so a mistyped or
// malicious link never rides along in someone's safety message.

const MAPS_HOSTS = new Set(["www.google.com", "google.com", "maps.google.com"]);
const MAPS_SHORT_HOSTS = new Set(["maps.app.goo.gl", "goo.gl"]);

export function isMapsLiveLink(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  if (MAPS_SHORT_HOSTS.has(host)) return url.pathname.length > 1;
  if (!MAPS_HOSTS.has(host)) return false;
  return /^\/maps(\/|$|\?)/.test(url.pathname);
}

// `datetime-local` inputs give us a LOCAL wall-clock string, never an ISO UTC
// timestamp — `new Date("2026-11-16T20:30")` would parse it as LOCAL in some
// engines and UTC in others. Build it from the individual fields instead, so
// the deadline means the same thing on every device and in every timezone.
// Returns a Date, or null when empty/malformed/in the past.
export function parseDeadline(value, now = new Date()) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, ys, mos, ds, hs, mins] = match;
  const year = Number(ys);
  const month = Number(mos);
  const day = Number(ds);
  const hour = Number(hs);
  const minute = Number(mins);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  // Reject a silently rolled-over date (31 Feb becomes 3 Mar) as well as a
  // deadline that has already passed — scheduling one would be a lie.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date.getTime() > now.getTime() ? date : null;
}

export function formatDeadline(date) {
  return date.toLocaleString();
}

export function buildSafetyShareMessage({
  contact,
  fields,
  includeCurrentLocation,
  locationPin,
  mapsLiveLink,
  checkInDeadline,
  now = new Date(),
}) {
  const name = contact?.name || contact?.nickname || "Contact";
  const deadline = parseDeadline(checkInDeadline, now);
  const liveLink = isMapsLiveLink(mapsLiveLink) ? mapsLiveLink.trim() : null;
  const deadlineText = deadline ? formatDeadline(deadline) : null;
  const intro = deadlineText
    ? `I'm meeting ${name} around ${now.toLocaleString()}. If you don't hear from me by ${deadlineText}, please call me${liveLink ? " and check my shared live location" : ""}. Here's their info:`
    : `I'm meeting ${name} around ${now.toLocaleString()}. If you don't hear from me within a few hours, here's their info:`;

  const lines = [];
  if (fields?.name) lines.push(`Name: ${name}`);
  if (fields?.phone) lines.push(`Phone: ${contact?.phone || "not provided"}`);
  if (fields?.address) lines.push(`Address: ${contact?.address || "not provided"}`);
  if (fields?.vehicle) lines.push(`Vehicle: ${contact?.vehicle || "not provided"}`);
  if (fields?.photo) lines.push(`Photo: ${contact?.profilePicture ? "they have a profile photo on their SHOS record" : "no photo on file"}`);
  if (includeCurrentLocation) {
    lines.push(locationPin && !locationPin.unavailable
      ? `My location (as of ${locationPin.asOf}): ${locationPin.url}`
      : `My location: unavailable (${locationPin?.reason || "no fix yet"}).`);
  }
  if (liveLink) {
    lines.push(`My live location on Google Maps (I started the sharing; the link may stop working when I turn it off): ${liveLink}`);
  }
  if (deadlineText) {
    lines.push(`Check-in deadline: ${deadlineText} — if you don't hear from me by then, please call me${liveLink ? " and check my shared live location" : ""}.`);
  }
  return `${intro}\n${lines.join("\n")}\n\nSharing is not a safety guarantee.`;
}

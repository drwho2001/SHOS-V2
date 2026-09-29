// disclosureLevel.js - the single owner of "how much may this app show outside
// itself".
//
// WHY THIS IS SEPARATE FROM anonymiseDisplay.js. That module answers a
// different question. Anonymise mode is TEMPORARY - the user is handing their
// phone to someone - and it masks fields INSIDE the app, on screen, where the
// user can see and act. This module governs content the app HANDS TO THE OS:
// lock-screen notifications and home-screen widgets, which the user is not
// looking at and may not be the only one who can. Same broad area of concern,
// genuinely different axis, and conflating them would produce a setting that
// turns itself on when you are merely using your phone.
//
// WHY ONE RESOLVER RATHER THAN A CHECK AT EACH CALL SITE. The bug this whole
// repo keeps cataloguing is the same string computed in two places drifting
// silently: the Testing due-reminder banner shipped broken for its entire life
// because one file computed a fingerprint the scheduler had no copy of. If
// every notification and every widget read the level and decided for itself,
// "masked" would eventually mean six slightly different things. The level is
// read here and only here.
//
// WHAT "MASKED" ACTUALLY MEANS. It means the OS surface says the app wants your
// attention and nothing about why. Not an empty notification - a user who has
// genuinely asked for a medication reminder needs to be able to see that one
// arrived - but no medication name, no test type, no appointment title, no
// cycle phase. Those all live one tap away in the app itself, which is behind
// the app lock the user chose to set.
import { PrivacySettingsRepository } from "../repositories/privacySettingsRepository.js";

export const DISCLOSURE_LEVELS = [
  {
    id: "masked",
    label: "Masked",
    blurb: "Notifications and widgets say the app needs attention, but not what. Nothing about your health appears unless you open the app.",
  },
  {
    id: "glanceable",
    label: "Glanceable",
    blurb: "Notifications and widgets name the KIND of thing and when - a medication reminder, a test due - but never a medication name, test result or appointment detail.",
  },
  {
    id: "detailed",
    label: "Detailed",
    blurb: "Full detail on the lock screen and home screen, including medication names and test types. Anyone looking at your phone can read it.",
  },
];

export const DEFAULT_DISCLOSURE_LEVEL = "masked";

export function isValidDisclosureLevel(value) {
  return DISCLOSURE_LEVELS.some((l) => l.id === value);
}

/**
 * Coerces anything at all into a usable level.
 *
 * Defensive because this value can arrive from a restored backup written by an
 * older build, where the field did not exist, and because an unknown value must
 * never fail open - "I do not recognise this setting, so I will show
 * everything" is the wrong direction for a privacy control.
 */
export function normaliseDisclosureLevel(value) {
  return isValidDisclosureLevel(value) ? value : DEFAULT_DISCLOSURE_LEVEL;
}

export async function getDisclosureLevel() {
  try {
    const settings = await PrivacySettingsRepository.getSettings();
    return normaliseDisclosureLevel(settings?.disclosureLevel);
  } catch {
    // A preference read must never take a notification down with it. Failing
    // to the most restrictive level is the only safe direction.
    return DEFAULT_DISCLOSURE_LEVEL;
  }
}

/**
 * Resolves the text a surface outside the app should display.
 *
 * `detailed` is the identity function, so the common path costs one property
 * read. `masked` returns the generic copy, which is why it needs no knowledge
 * of the thing being described - a caller cannot leak a medication name by
 * forgetting to redact it, because the masked branch never receives it.
 *
 * `glanceable` is passed `kind` and nothing else clinical. That is enforced by
 * shape rather than by convention: there is no field on the object for a
 * medication name to arrive in.
 */
export function resolveDisclosure(level, { title, body, kind, maskedTitle, maskedBody } = {}) {
  const resolved = normaliseDisclosureLevel(level);
  if (resolved === "detailed") {
    return { title: title ?? "", body: body ?? "" };
  }
  if (resolved === "glanceable") {
    return {
      title: title ?? "",
      // A kind with no fallback is safer than a fallback that leaks: better a
      // blank line than a name on a lock screen.
      body: kind ?? "",
    };
  }
  return {
    title: maskedTitle ?? "SHOS",
    body: maskedBody ?? "Open the app to see what's due.",
  };
}

/**
 * Convenience wrapper for the common case: read the stored level and resolve
 * against it. Callers that already hold the settings object should call
 * resolveDisclosure directly rather than paying for a second read.
 */
export async function applyDisclosure(text) {
  return resolveDisclosure(await getDisclosureLevel(), text);
}

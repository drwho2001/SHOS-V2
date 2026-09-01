// updateCheckService.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask: "add a check for available updates / notify / auto
// download?" Native-only — on the web build there's nothing to check;
// the page you're looking at IS the latest deploy the moment it loads,
// there's no separate "installed version" that can go stale the way a
// sideloaded APK can.
//
// HONEST LIMIT on "auto download", stated plainly rather than oversold:
// a genuinely silent, zero-interaction install is not something Android
// allows a normal sideloaded app to do to itself — even Play Store apps
// get a real system UI moment, and forcing one here would need the
// REQUEST_INSTALL_PACKAGES permission plus native PackageInstaller
// code, a real security-sensitive addition not worth it for what this
// actually needs to do. What this DOES do, genuinely: detects a real
// update is available and gets you to the download in one tap — the
// OS's own download-then-tap-to-install flow takes it from there,
// exactly like a manual check would, just without you having to
// remember to go looking.
//
// HOW "is there an update" IS DECIDED: every real release build (both
// the CI workflow and this repo's own convention) stamps the exact
// commit it was built from into the GitHub Release's own body text
// ("Automated debug build from commit <sha>..."). That's compared
// against __BUILD_SHA__ — the same real build identifier baked into
// this exact build by vite.config.js (see its own comment) and shown
// on the About screen. No separate version-number scheme to keep in
// sync by hand; whatever commit actually built the release is the
// single source of truth.
const RELEASE_API_URL = "https://api.github.com/repos/drwho2001/SHOS-V2/releases/tags/latest";
export const RELEASE_PAGE_URL = "https://github.com/drwho2001/SHOS-V2/releases/tag/latest";
export const RELEASE_APK_URL = "https://github.com/drwho2001/SHOS-V2/releases/download/latest/SHOS-debug.apk";

async function isNativePlatform() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// Resolves to { updateAvailable, latestSha } — or { updateAvailable:
// false } on any failure (no network, GitHub API hiccup, unexpected
// response shape) — a failed check should never be mistaken for "no
// update available" being shown as an error, it should just stay
// quiet and try again next time this runs.
export async function checkForUpdate() {
  if (!(await isNativePlatform())) return { updateAvailable: false };
  if (typeof __BUILD_SHA__ === "undefined" || __BUILD_SHA__ === "dev") {
    // A local/dev build has nothing real to compare against — checking
    // would either always claim "update available" (comparing against
    // nothing) or require guessing, neither of which is honest.
    return { updateAvailable: false };
  }
  try {
    const res = await fetch(RELEASE_API_URL, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) return { updateAvailable: false };
    const release = await res.json();
    const match = /Automated debug build from commit ([0-9a-f]{7,40})/.exec(release.body || "");
    if (!match) return { updateAvailable: false };
    const latestSha = match[1];
    // The release always stamps the FULL sha; __BUILD_SHA__ is the
    // short (7-char) form — a real match is the full one starting with
    // the short one, not an exact string match.
    const updateAvailable = !latestSha.startsWith(__BUILD_SHA__);
    return { updateAvailable, latestSha: latestSha.slice(0, 7) };
  } catch {
    return { updateAvailable: false };
  }
}

// draftStorage.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Protects IN-PROGRESS form edits from being lost if the page refreshes,
// reloads, or the app gets backgrounded mid-edit — a real gap the user
// flagged: saved/submitted data was already proven safe this session
// (survives a genuine separate-process reload test), but data you're
// still TYPING, before tapping Save, lived only in React's in-memory
// state until now. This is the fix: every keystroke gets mirrored to a
// small, separate "draft" slot in the same local storage, and an edit
// sheet checks for a leftover draft on mount and silently recovers it
// instead of starting blank.
//
// CHANGED — real, more precise ask: this recovery should be scoped to
// the CURRENT app session only. If the app is genuinely closed (not
// just backgrounded, navigated away from, or reloaded mid-session) and
// relaunched fresh, that memory should be gone — a stale draft
// resurfacing days later on a completely fresh open is surprising, not
// helpful. `sessionStorage` is the exact right browser-native primitive
// for this rather than something to build by hand: it persists across
// reloads/navigation within one continuous session, the same way
// `localStorage` did, but is cleared automatically the moment the
// browser tab (or, once Capacitor-wrapped, the app's own session) ends
// — no custom "session marker" invalidation logic needed, the platform
// already draws exactly the line the user described.
//
// Deliberately its own small file (shared infrastructure, like
// storageAdapter.js) rather than duplicated per module — unlike UI
// components, this is pure logic with no visual identity to keep
// module-specific, so there's no real cost to sharing it and a real
// cost to six slightly-different copies drifting apart over time.
//
// Drafts are NOT the same thing as a real saved record — they're
// cleared the moment a real Save succeeds, and are scoped per
// module+record so editing Contact A doesn't clobber a leftover draft
// for Contact B.

const DRAFT_PREFIX = "shos_draft_";

// Wrapped in try/catch throughout — a draft failing to save should
// never be the reason someone can't use the app; worst case, autosave
// silently doesn't happen for that one keystroke, same failure mode as
// if this feature didn't exist at all.

export function saveDraft(draftKey, data) {
  try {
    sessionStorage.setItem(DRAFT_PREFIX + draftKey, JSON.stringify({ data, savedAt: new Date().toISOString() }));
  } catch {
    // Silently no-op — see file header.
  }
}

export function loadDraft(draftKey) {
  try {
    const raw = sessionStorage.getItem(DRAFT_PREFIX + draftKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && "data" in parsed ? parsed : null;
  } catch {
    return null;
  }
}

export function clearDraft(draftKey) {
  try {
    sessionStorage.removeItem(DRAFT_PREFIX + draftKey);
  } catch {
    // Silently no-op.
  }
}

// ADDED 28 Sep 2026 — after the security review. Every draft is a FULL form's
// worth of real data, including the fields that are most identifying: a new
// contact's phone number, a new encounter's free-text notes, a test's
// organism. `sessionStorage` is per-tab and not reachable by another app, so
// the exposure is narrow — but it is NOT cleared when the vault locks, and
// that is a real, concrete disclosure rather than a theoretical one:
//
//   - enter a duress PIN (or be made to unlock with it) and the decoy session
//     is the SAME WebView, so any draft left over from the previous,
//     legitimately-unlocked session is still sitting in storage;
//   - unlock again and a half-typed Contact form silently repopulates.
//
// So drafts are wiped the moment the app locks, from a single call site in
// App.jsx rather than from each of the four `setLocked(true)` paths, which
// means a future lock path cannot forget.
//
// NOT DONE, deliberately, and recorded rather than quietly skipped: these
// values are still stored as PLAINTEXT JSON, not encrypted. Encrypting them
// needs `loadDraft` to become async (WebCrypto has no synchronous mode), and
// `loadDraft` is called inside a `useState` initializer in all 8 module forms
// to seed the form. Making it async means converting every one of those to the
// async-load-then-resync pattern, touching the exact code that holds a user's
// unsaved edits — a materially larger and riskier change than it looks, and
// not something to do inside a privacy fix without its own pass. The gap that
// actually mattered is the lock-time clear, which is what this does.
export function clearAllDrafts() {
  try {
    // Collected first, then removed: removing while iterating a live
    // Storage key list can skip entries as the list shifts underneath it.
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(DRAFT_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Silently no-op — see file header.
  }
}

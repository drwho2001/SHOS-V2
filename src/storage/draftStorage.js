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

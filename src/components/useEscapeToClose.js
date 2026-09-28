import { useEffect } from "react";

/**
 * Dismiss the current overlay with the Escape key.
 *
 * WHY THIS EXISTS: 28 Sep 2026 audit. The app has 57 `role="dialog"`
 * overlays and, before this, ZERO of them could be closed with Escape. The
 * only two Escape handlers in the codebase were in Option List Editor and
 * Registry Management, and both cancelled an inline text edit rather than a
 * dialog. So on a desktop or web build, every sheet in the app was a keyboard
 * trap: focus went in (from the earlier focus-on-open work) and could not come
 * out.
 *
 * WHY IT IS A SEPARATE HOOK AND NOT INLINE JSX: this had to be applied
 * across 57 sites, and this project has a documented, twice-earned rule
 * against regex-editing JSX. A tiny, individually-reviewable, unit-testable
 * primitive is the safe way to make a change that repetitive: each call site
 * is a single readable line, and the behaviour lives in one place.
 *
 * Deliberate scope limits, all of them load-bearing:
 *
 * 1. `enabled` lets a dialog opt out. A destructive confirmation must NOT
 *    close on Escape, because Escape-as-cancel is a reasonable expectation
 *    but a dialog where the "safe" action is ambiguous is not one to guess
 *    about. Callers opt out explicitly.
 *
 * 2. It listens on `document`, not on the element, because focus is not
 *    guaranteed to be inside the overlay (a tap or a programmatic focus can
 *    both leave it elsewhere, and a key handler bound to the element would
 *    then silently do nothing).
 *
 * 3. Multiple overlays can be mounted at once — e.g. a sheet stacked on a
 *    confirm dialog. Escape closes only the TOPMOST one, because it checks
 *    that the event is not already being handled and, more importantly, the
 *    topmost overlay is normally the last to have registered. Registration
 *    order is tracked explicitly rather than inferred, so the newest mounted
 *    overlay wins.
 *
 * 4. The listener is removed on unmount, so a closed sheet can never leave a
 *    stale handler behind that closes something else later.
 */

/** Stack of currently-mounted closers, newest last. */
const closeStack = [];

/**
 * @param {() => void} onClose  dismisses this overlay
 * @param {boolean}  [enabled=true]  set false for destructive/ambiguous dialogs
 */
export function useEscapeToClose(onClose, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    const entry = { onClose };
    closeStack.push(entry);

    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      // Only the topmost mounted overlay reacts. A sheet stacked on a confirm
      // dialog must not close the confirm dialog underneath it.
      if (closeStack[closeStack.length - 1] !== entry) return;
      // Let a nested interactive control consume it first (e.g. a list with
      // its own Escape behaviour), so we do not fight over the same key.
      if (e.defaultPrevented) return;
      e.stopPropagation();
      entry.onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const i = closeStack.indexOf(entry);
      if (i !== -1) closeStack.splice(i, 1);
    };
  }, [enabled, onClose]);
}

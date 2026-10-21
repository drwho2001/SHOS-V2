/**
 * THE STACK FOR NESTED OVERLAAYS (t129).
 *
 * WHY IT EXISTS, and why the app needed a new mechanism rather than a fix in
 * twelve places. The module back-handler slot in App.jsx is ONE slot: the
 * last module to register wins, and on unmount it registers null. So a
 * screen that opens a screen - a dialog inside a dialog - has nowhere to
 * say "back should close ME, not the one underneath". The repo had twelve
 * such places, and they failed in three different ways:
 *
 *   - the back button closed the screen UNDER the dialog, leaving the
 *     dialog on screen with nothing under it (Testing's "Scheduled retest
 *     already done" prompt; the smoke suite hit this for real);
 *   - the back button did nothing at all, because the overlay was not in
 *     the chain (the Interactive Tour was a trap - only its X worked);
 *   - or the overlay was not in the chain and the back button fell through
 *     to HOME, abandoning the tab (Measurements' "Manage groups").
 *
 * A STACK fixes the general case rather than the twelve instances: the
 * topmost registered overlay is asked first, and if it says it cannot
 * handle it, the one below is asked. Any screen can push onto it without
 * the app having to know it exists.
 *
 * WHY IT IS A MODULE-LEVEL STORE rather than App state or a prop. The
 * overlays that need it are nested TWO OR THREE LEVELS DOWN - the Error log
 * is inside Developer Tools, which is inside Settings - so threading a
 * prop down to each of them would mean changing every screen in between.
 * The repo already has this pattern (darkModePreference, the advisory
 * dismissals): a module-level store, with the app asking it.
 *
 * The Escape side of the same problem is already solved, by
 * useEscapeToClose, which is a LIFO stack of its own. A screen missing
 * Escape needed that hook; a screen missing back needed this one.
 */

const handlers = [];

/**
 * Registers a handler for the hardware back button (and the app's own
 * back gesture) while an overlay is open.
 *
 * @param {() => boolean} handler called on a back press; return true if it
 *   handled the press, false to let the one below it try.
 * @returns {() => void} unregisters it.
 */
export function pushOverlayBackHandler(handler) {
  handlers.push(handler);
  return () => {
    const index = handlers.indexOf(handler);
    if (index >= 0) handlers.splice(index, 1);
  };
}

/**
 * Asks the topmost registered overlay to handle a back press.
 *
 * A handler that THROWS must not take the app's back behaviour down with it:
 * the press falls through to the next handler rather than to nothing at all.
 * That is the same rule the rest of the app follows for a broken listener
 * (see clearSampleData.js's own notify()).
 *
 * @returns {boolean} true if an overlay handled it.
 */
export function handleOverlayBack() {
  for (let i = handlers.length - 1; i >= 0; i--) {
    try {
      if (handlers[i]()) return true;
    } catch (err) {
      console.warn("[overlayBackStack] an overlay's back handler threw:", err);
    }
  }
  return false;
}

/** How many overlays are registered. For tests and for diagnostics. */
export function overlayBackDepth() {
  return handlers.length;
}

/** Empties the stack. For tests. */
export function resetOverlayBackHandlers() {
  handlers.length = 0;
}

import { useEffect, useRef } from "react";
import { pushOverlayBackHandler } from "../calculations/overlayBackStack";

/**
 * Registers a nested overlay's BACK handler while it is open (t129).
 *
 * WHY A HOOK AND NOT A PROP. The overlays that need this are nested two or
 * three levels down - the Error log is inside Developer Tools, which is
 * inside Settings - and the app's module back-handler is a SINGLE slot, so a
 * nested overlay cannot take it without taking the screen underneath's with
 * it. This stack is the missing piece: the topmost overlay is asked first.
 *
 * The handler is held in a ref, so a caller can pass an inline arrow
 * function without the effect re-running on every render - which would
 * otherwise unregister and re-register the handler on every render of the
 * screen underneath it.
 *
 * The Escape side of the same problem is a different hook,
 * useEscapeToClose, which is already a LIFO stack of its own. A screen that
 * is missing BOTH needs both.
 *
 * @param {() => boolean} handler return true if it handled the press.
 * @param {boolean} active whether the overlay is open right now.
 */
export function useOverlayBackHandler(handler, active = true) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!active) return undefined;
    return pushOverlayBackHandler(() => (handlerRef.current ? handlerRef.current() : false));
  }, [active]);
}

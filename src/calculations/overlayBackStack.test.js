import { describe, it, expect, beforeEach } from "vitest";
import {
  pushOverlayBackHandler,
  handleOverlayBack,
  overlayBackDepth,
  resetOverlayBackHandlers,
} from "./overlayBackStack";

/**
 * t129: the stack for nested overlays.
 *
 * The problem it solves: the app's module back-handler is ONE slot, so a
 * screen that opens a screen has nowhere to say "back should close ME, not
 * the one underneath". The repo had twelve such places and they failed in
 * three different ways - the wrong screen closed, nothing closed, or the whole
 * tab was abandoned.
 *
 * A stack fixes the general case, and the rules it has to obey are what
 * these tests pin.
 */
beforeEach(() => {
  resetOverlayBackHandlers();
});

describe("the nested-overlay back stack", () => {
  it("the TOPMOST overlay is asked first", () => {
    const asked = [];
    pushOverlayBackHandler(() => { asked.push("under"); return false; });
    pushOverlayBackHandler(() => { asked.push("top"); return true; });
    expect(handleOverlayBack()).toBe(true);
    expect(asked).toEqual(["top"]);
  });

  it("an overlay that declines lets the one below it try", () => {
    const asked = [];
    pushOverlayBackHandler(() => { asked.push("under"); return true; });
    pushOverlayBackHandler(() => { asked.push("top"); return false; });
    expect(handleOverlayBack()).toBe(true);
    expect(asked).toEqual(["top", "under"]);
  });

  it("unregistering removes that handler, and only that one", () => {
    const asked = [];
    const removeFirst = pushOverlayBackHandler(() => { asked.push("first"); return true; });
    pushOverlayBackHandler(() => { asked.push("second"); return true; });
    expect(overlayBackDepth()).toBe(2);
    removeFirst();
    expect(overlayBackDepth()).toBe(1);
    handleOverlayBack();
    expect(asked).toEqual(["second"]);
  });

  it("an empty stack declines, so the app's own fallbacks still run", () => {
    expect(overlayBackDepth()).toBe(0);
    expect(handleOverlayBack()).toBe(false);
  });

  it("a handler that throws does not stop the one below it", () => {
    // A screen whose close handler throws must not take the app's back
    // behaviour down with it - the press falls through to the next handler
    // rather than to nothing at all. This is the same rule the rest of the
    // app follows for a broken listener (see clearSampleData.js's notify()).
    let reached = false;
    pushOverlayBackHandler(() => { throw new Error("boom"); });
    pushOverlayBackHandler(() => { reached = true; return true; });
    expect(handleOverlayBack()).toBe(true);
    expect(reached, "the overlay below the broken one must still get its turn").toBe(true);
    // And the stack is still intact for the next press.
    expect(overlayBackDepth()).toBe(2);
  });
});

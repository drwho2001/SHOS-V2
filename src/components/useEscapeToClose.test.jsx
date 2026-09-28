// Tests for the Escape-to-dismiss hook.
//
// This is the only overlay behaviour in the app that was previously entirely
// absent, and the whole point of extracting it into a hook is that it can be
// tested in isolation rather than by clicking through 57 sheets. These tests
// cover the three behaviours that are easy to get subtly wrong and that a
// user would experience as "Escape closes the wrong thing".
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render } from "@testing-library/react";
import React from "react";
import { useEscapeToClose } from "./useEscapeToClose";

function Harness({ onClose, enabled, label = "sheet" }) {
  useEscapeToClose(onClose, enabled);
  return <div role="dialog" aria-label={label} />;
}

function Stack({ bottom, top, showTop = true }) {
  return (
    <>
      <Harness onClose={bottom} label="bottom" />
      {showTop && <Harness onClose={top} label="top" />}
    </>
  );
}

const pressEscape = () =>
  act(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });

describe("useEscapeToClose", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("closes the overlay on Escape", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores every other key", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does nothing when disabled — a destructive confirm must not vanish on Escape", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} enabled={false} />);
    pressEscape();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("only the TOPMOST of two stacked overlays closes", () => {
    // Real shape: a confirm dialog stacked on a sheet. Closing the one
    // underneath would silently discard the user's work.
    const bottom = vi.fn();
    const top = vi.fn();
    render(<Stack bottom={bottom} top={top} />);
    pressEscape();
    expect(top, "top overlay should close").toHaveBeenCalledTimes(1);
    expect(bottom, "underlying overlay must NOT close").not.toHaveBeenCalled();
  });

  it("hands control to the next overlay once the top one unmounts", () => {
    // The failure mode of a naive implementation: unmounting the top sheet
    // either leaves a dead handler registered (nothing responds to Escape
    // ever again) or leaves the wrong one on top. `showTop` is a real prop
    // rather than a literal, so this exercises unmount-on-render rather than
    // React's diffing of a changed child list.
    const bottom = vi.fn();
    const top = vi.fn();
    const { rerender } = render(<Stack bottom={bottom} top={top} />);

    // Sanity: Escape reaches the top one.
    pressEscape();
    expect(top).toHaveBeenCalledTimes(1);
    expect(bottom).not.toHaveBeenCalled();

    // Now the top overlay goes away, as it does when the user saves.
    rerender(<Stack bottom={bottom} top={top} showTop={false} />);
    pressEscape();
    expect(bottom, "the next overlay down should now be reachable").toHaveBeenCalledTimes(1);
  });

  it("leaves no listener behind after unmount", () => {
    const onClose = vi.fn();
    const { unmount } = render(<Harness onClose={onClose} />);
    unmount();
    pressEscape();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("defers to a handler that already consumed the event", () => {
    // e.g. a nested list with its own Escape behaviour. We must not also
    // close the sheet on the same keypress.
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    act(() => {
      const e = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      e.preventDefault();
      document.dispatchEvent(e);
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("the real stacked shape: a confirmation card on top of an edit sheet", () => {
  // This is the exact composition that ships: Contacts -> profile -> delete
  // renders ConfirmDeleteCard ON TOP of ContactEditSheet. The bug this file's
  // hook originally had nothing to do with was that the card was not
  // registered at all, so the SHEET underneath was the topmost registered
  // overlay - and Escape closed the sheet, discarding the confirmation AND
  // the form, in one keypress.
  function Sheet({ onClose }) {
    useEscapeToClose(onClose);
    return <div role="dialog" aria-label="Edit contact" />;
  }
  function ConfirmCard({ onCancel }) {
    useEscapeToClose(onCancel);
    return <div role="alertdialog" aria-label="Confirm delete" />;
  }

  it("Escape cancels the confirmation and leaves the sheet alone", () => {
    const closeSheet = vi.fn();
    const cancelConfirm = vi.fn();
    render(
      <div>
        <Sheet onClose={closeSheet} />
        <ConfirmCard onCancel={cancelConfirm} />
      </div>
    );
    pressEscape();
    expect(cancelConfirm, "the confirmation is the topmost overlay, so it is what closes").toHaveBeenCalledTimes(1);
    expect(closeSheet, "the sheet underneath must be left intact").not.toHaveBeenCalled();
  });
});

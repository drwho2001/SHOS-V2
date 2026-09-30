// Tests for the day-rollover refresh hook.
//
// WHAT IS ACTUALLY BEING CLAIMED
// ------------------------------
// 1. When the local calendar day changes, the calling component re-renders and
//    the returned day key updates. Without this, "Today" on a medication card
//    keeps meaning yesterday and the cycle ring stays a day behind.
// 2. When the day has NOT changed, it does NOT re-render. This half is the
//    reason the hook is affordable: a naive implementation that sets state on a
//    60-second timer re-renders the whole app once a minute forever, to redraw
//    identical pixels.
// 3. It wakes up on resume, because Android suspends timers in a backgrounded
//    WebView so the midnight timer can be hours stale by the time it matters.
// 4. It cleans up its listener and its timer.
//
// A note on why 2 is asserted by counting renders rather than by inspecting
// state: the failure being guarded against is invisible from the outside. The
// hook would return exactly the right value while re-rendering the app 1,440
// times a day, and every other assertion here would still pass.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render } from "@testing-library/react";
import React from "react";
import { readFileSync } from "node:fs";
import { useLocalDayChange } from "./useLocalDayChange";

let renders = 0;
let lastDay = null;

function Harness() {
  const day = useLocalDayChange();
  renders++;
  lastDay = day;
  return <div data-testid="day">{day}</div>;
}

const setClock = (iso) => vi.setSystemTime(new Date(iso));
const fireVisible = () =>
  act(() => {
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });

beforeEach(() => {
  vi.useFakeTimers();
  renders = 0;
  lastDay = null;
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useLocalDayChange", () => {
  it("returns the current local day key on first render", () => {
    setClock("2026-09-30T14:00:00");
    const { getByTestId } = render(<Harness />);
    expect(getByTestId("day").textContent).toBe("2026-09-30");
    expect(renders).toBe(1);
  });

  it("re-renders and updates the day when local midnight passes", () => {
    setClock("2026-09-30T23:59:30");
    const { getByTestId } = render(<Harness />);
    expect(getByTestId("day").textContent).toBe("2026-09-30");
    const before = renders;

    // Half a minute later it is the 30th no longer.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    setClock("2026-10-01T00:00:05");
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(getByTestId("day").textContent).toBe("2026-10-01");
    expect(renders).toBeGreaterThan(before);
  });

  it("does NOT re-render while the day is unchanged", () => {
    setClock("2026-09-30T09:00:00");
    render(<Harness />);
    const afterMount = renders;

    // A whole hour in small steps. Any re-render here is the wasteful
    // re-render this test exists to prevent.
    act(() => {
      for (let i = 0; i < 60; i++) vi.advanceTimersByTime(60_000);
    });

    expect(renders).toBe(afterMount);
    expect(lastDay).toBe("2026-09-30");
  });

  it("survives many days in a row, one update per day and not one more", () => {
    setClock("2026-09-30T12:00:00");
    render(<Harness />);
    const afterMount = renders;

    // Ten day boundaries. If the timer rescheduled wrongly this either stalls
    // (too few renders) or fires repeatedly (too many).
    //
    // Two versions of this test were wrong before this one, both mine.
    // Advancing 2s per day never reached the pending timer (it sits 24h away
    // after a reschedule) and reported 1 render. Advancing 24h AND calling
    // vi.setSystemTime double-counted - the clock jumps once and the timers
    // carry it forward again - so each iteration crossed two midnights and it
    // overshot to the 11th. The clock already follows the timers, so this only
    // advances time and lets the rollovers happen on their own.
    for (let d = 0; d < 10; d++) {
      act(() => {
        vi.advanceTimersByTime(86_400_000 + 5_000);
      });
    }

    expect(renders).toBe(afterMount + 10);
    expect(lastDay).toBe("2026-10-10");
  });

  it("catches up on resume, which is the case a midnight timer alone misses", () => {
    // The device sleeps for eight hours. No timer fires while it sleeps, which
    // is exactly the real situation: Android suspends background WebView
    // timers. Only the resume event can notice.
    setClock("2026-09-30T22:00:00");
    render(<Harness />);
    expect(lastDay).toBe("2026-09-30");

    setClock("2026-10-01T06:00:00");
    fireVisible();

    expect(lastDay).toBe("2026-10-01");
  });

  it("ignores the event when the app is going to the background", () => {
    setClock("2026-09-30T22:00:00");
    render(<Harness />);
    const before = renders;

    setClock("2026-10-01T06:00:00");
    act(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(renders).toBe(before);
    expect(lastDay).toBe("2026-09-30");
  });

  it("follows the device's local date rather than UTC", () => {
    // 23:30 local on the 30th is already the 1st in UTC. A hook that used a
    // UTC day key would roll over eight hours early, and this app's whole
    // date convention is that stored values are local wall-clock.
    setClock(new Date(2026, 8, 30, 23, 30, 0, 0).toISOString());
    render(<Harness />);
    expect(lastDay).toBe("2026-09-30");
  });

  it("removes its listener and timer on unmount", () => {
    setClock("2026-09-30T22:00:00");
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");

    const { unmount } = render(<Harness />);
    const afterMount = renders;

    unmount();
    expect(removeSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    expect(clearSpy).toHaveBeenCalled();

    // And a late timer firing after unmount must not throw or re-render.
    setClock("2026-10-01T00:00:05");
    expect(() =>
      act(() => {
        vi.advanceTimersByTime(5000);
      })
    ).not.toThrow();
    expect(renders).toBe(afterMount);
  });

  it("does not blow up if the device clock is moved backwards", () => {
    setClock("2026-09-30T00:00:30");
    render(<Harness />);
    const before = renders;

    // Midnight-tomorrow computed from this clock is now ~24h away, and a naive
    // implementation that forgets the negative-delay guard passes a negative
    // value to setTimeout. A negative delay fires IMMEDIATELY, so the timer
    // would fire at once, re-check against the rewound clock, and report
    // yesterday as the new day - a visible wrong value, not a crash. Asserting
    // "does not throw" could never have caught that; the re-render count can.
    setClock("2026-09-29T23:00:00");
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(renders).toBe(before);
    expect(lastDay).toBe("2026-09-30");
  });
});

describe("useLocalDayChange - the properties React does not give you for free", () => {
  it("keeps exactly ONE timer alive, however many days pass", () => {
    // Mutation testing found that removing the clearTimeout in schedule()
    // changed nothing observable across day rollovers. That is correct: by the
    // time a timer fires it has already left the queue, so there is nothing to
    // clear. The leak is real but happens on a DIFFERENT path - see the
    // resume-twice test below, which is where schedule() runs while the
    // previous timer is still pending.
    setClock("2026-09-30T12:00:00");
    render(<Harness />);
    expect(vi.getTimerCount()).toBe(1);

    for (let d = 0; d < 5; d++) {
      act(() => {
        vi.advanceTimersByTime(86_400_000 + 5_000);
      });
      expect(vi.getTimerCount(), `after day ${d + 1}`).toBe(1);
    }
  });

  it("keeps one timer when resume re-schedules while a timer is still pending", () => {
    // This is the path the clearTimeout actually protects. onVisible calls
    // schedule(), and the timer scheduled at mount has not fired yet, so
    // without the clear there would be two - and each would fire and schedule
    // another, so the count would climb by one per resume. A phone that is
    // locked and unlocked repeatedly is exactly this.
    setClock("2026-09-30T12:00:00");
    render(<Harness />);
    expect(vi.getTimerCount()).toBe(1);

    for (let i = 0; i < 4; i++) {
      fireVisible();
      expect(vi.getTimerCount(), `after resume ${i + 1}`).toBe(1);
    }
  });

  it("always schedules a positive delay, so no clamp is needed", () => {
    // Replaces a test I wrote and then deleted. It asserted the hook did not
    // spin when the clock was rewound past the next midnight, on the theory
    // that a negative delay would fire instantly and reschedule forever. It
    // passed - and mutation testing then showed it passed with the guard
    // deleted too, because the case it described is IMPOSSIBLE: "midnight
    // tomorrow" is derived from the current clock by adding a day, so the delay
    // is always between 1s and 24h. The clamp was dead code and is gone.
    //
    // What replaces it asserts the actual invariant, across a spread of
    // awkward clock times, so a future refactor that reintroduces a negative
    // delay fails here rather than shipping a timer that spins.
    const spy = vi.spyOn(globalThis, "setTimeout");

    for (const iso of [
      "2026-09-30T00:00:30", // a minute after midnight: the longest wait
      "2026-09-30T23:59:30", // a minute before: the shortest
      "2026-02-28T23:59:59", // day before a leap day
      "2026-12-31T23:00:00", // year end
      "2026-03-29T01:30:00", // the UK clocks-go-forward morning
    ]) {
      setClock(iso);
      const { unmount } = render(<Harness />);
      fireVisible();
      unmount();
    }

    expect(spy.mock.calls.length).toBeGreaterThan(0);
    const all = spy.mock.calls.map((c) => c[1]).filter((d) => typeof d === "number");
    expect(all.length).toBeGreaterThan(0);
    for (const d of all) {
      expect(d, `a scheduled delay of ${d}ms is not positive`).toBeGreaterThan(0);
    }
  });
});

// A unit test can prove the hook works; it cannot prove App.jsx ever CALLS it.
// That gap has bitten this repo twice before - a full Escape feature whose hook
// passed every test while a sweep failed to attach it, and a disclosure
// resolver wired to nothing. So the wiring is asserted at the source level.
describe("the day hook is actually wired in", () => {
  it("App.jsx imports and calls it, so the re-render reaches the modules", () => {
    const src = readFileSync("src/App.jsx", "utf8");
    expect(src, "App must import the hook").toMatch(
      /import \{ useLocalDayChange \} from "\.\/calculations\/useLocalDayChange";/
    );
    // Called, not merely imported - the failure mode this guards is an import
    // that sits unused while the day quietly stops rolling over.
    expect(src, "App must CALL the hook, not just import it").toMatch(
      /^\s*useLocalDayChange\(\);/m
    );
  });

  it("the comment explaining the single-hook decision is still there", () => {
    // Guards the reasoning, not the code. If someone later memoises the
    // modules, this decision silently stops working and the comment is the only
    // thing that says the whole design rested on it being false.
    const src = readFileSync("src/App.jsx", "utf8");
    expect(src).toMatch(/nothing here is wrapped in React\.memo/);
  });
});

// useLocalDayChange.js
//
// THE PROBLEM, IN PLAIN TERMS
// ---------------------------
// A lot of this app's display is derived from "now" while a screen renders:
// "Today" / "Yesterday" on a medication card, "4d" on the cycle ring, "inactive
// for 12 days" on a contact, the 90-day faded state on an old test. Those
// values are correct at the moment they are computed. None of them is stored.
//
// The bug is that nothing GUARANTEES a re-render when the calendar day changes.
// Two ordinary situations both break it:
//
//   1. The app is left open past midnight. The screen still says "Today" about
//      a dose logged yesterday, and the cycle ring is a day behind, until
//      something unrelated happens to cause a render.
//   2. The device sleeps. Android suspends timers in a backgrounded WebView, so
//      the app can resume hours later. On resume, `visibilitychange` fires and
//      App.jsx's own poll runs - but that poll only sets banner state, and if
//      the banner state is unchanged React bails out of the re-render, so the
//      mounted module never re-renders and yesterday's numbers stay on screen.
//
// WHY IT IS ONE HOOK AND NOT A PER-MODULE FIX
// -------------------------------------------
// The tempting version is to add a timer to every module. That is the mistake
// this repo makes repeatedly with cross-cutting behaviour: several modules
// quietly grow their own version, they drift, and the sixth one is missed.
//
// Verified before designing it: **nothing in the app is wrapped in React.memo**
// (checked, not assumed). A module is rendered as
// `<ActiveModule key={...} />` from App.jsx, so a single re-render of App
// re-renders whichever module is mounted, and every `new Date()`-derived value
// in its body is recomputed. One hook at the top of App therefore refreshes the
// whole app, and no module needs to know this exists.
//
// WHY IT COSTS NOTHING
// --------------------
// The property that matters is that this does not re-render the app all the
// time, only when the day genuinely changes. Note that this is React's own
// behaviour and NOT something this hook has to implement: `useState` skips a
// re-render whenever the new value is equal to the old one, so even
// `setDay(localDayKey(new Date()))` would settle back to doing nothing after the
// first call on a given day. An earlier draft of this file claimed the
// functional-update form below was what avoided a re-render per minute, and
// mutation testing showed that claim was simply false - deleting the form
// changed no observable behaviour at all. It is kept because it reads the
// previous value instead of closing over anything, which is the safer shape
// here, and the header has been corrected rather than the claim kept.
//
// What WOULD have been expensive is a 60-second poll. The timer is not one: it
// is a single setTimeout aimed at the next local midnight (plus one second, so
// the rollover has actually happened), which reschedules itself. One timer, not
// one wake-up per minute, and it is precise - a poll at 00:00:30 would still
// show yesterday for another 30 seconds.
import { useEffect, useState } from "react";
import { localDayKey } from "./dateInputHelpers";

/**
 * Re-renders the calling component when the local calendar day changes.
 *
 * Call it for its side effect - the return value is the current local day key
 * ("YYYY-MM-DD") and is only useful if the caller also wants to use it as a
 * dependency:
 *
 *   useLocalDayChange();                  // in App: refresh everything
 *   const today = useLocalDayChange();    // in a module: use as a dep
 */
export function useLocalDayChange() {
  const [day, setDay] = useState(() => localDayKey(new Date()));

  useEffect(() => {
    let timer = null;

    // React skips the re-render when the value is unchanged, so this settles
    // to a no-op within a day. See the header on why that is React's doing and
    // not this hook's, and why the comment claiming otherwise was wrong.
    const check = () => {
      const now = localDayKey(new Date());
      setDay((prev) => (prev === now ? prev : now));
    };

    const msUntilNextLocalMidnight = () => {
      const now = new Date();
      // Local midnight tomorrow, plus 1s. Built from local components on
      // purpose: this is a real wall-clock moment, not a stored fake-UTC value,
      // so it must NOT go through the stored-date helpers.
      //
      // This is ALWAYS positive and needs no clamp. `next` is derived from the
      // same `now` by adding a whole day and zeroing the time, so it is
      // necessarily in the future - between 1s and 24h away. An earlier version
      // wrapped this in Math.max(1000, ...) "in case the clock was moved
      // backwards", on the reasoning that a negative delay would make setTimeout
      // fire immediately and then spin. Mutation testing showed that guard was
      // unreachable: deleting it changed nothing, because the case it defended
      // against cannot occur. It has been removed rather than kept, because a
      // clamp guarding an impossible state is a comment that will eventually
      // be believed by someone who then cannot work out which case it was for.
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
      return next.getTime() - now.getTime();
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        check();
        schedule();
      }, msUntilNextLocalMidnight());
    };

    // Resume after sleep, and the same event fires if the user changes
    // timezone, which can move the local day without ever reaching local
    // midnight on the device's original clock.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      check();
      schedule(); // the timer we were waiting on may be far in the past
    };

    document.addEventListener("visibilitychange", onVisible);
    schedule();

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return day;
}

// t088 - the Appointments widget shows the appointment's TIME and LOCATION.
//
// The widget rendered only a date, so a user with two appointments on the same
// day could not tell which one the card referred to without opening the app.
// The payload now carries nextApptTime and nextApptLocation beside the date.
//
// Three properties are load-bearing, so they are pinned here rather than
// assumed:
//
//   1. BOTH fields are dropped at the Redacted tier. An appointment's time and
//      place are identifying, and nextAppointment's allowlist is
//      ["category", "count"] - so fieldAllowed drops them by default-deny
//      without any explicit hide on the JS side. Asserted directly, because "I
//      didn't add it to the list" is not evidence: a later edit that adds these
//      to the allowlist would leak a clinic's address onto a home screen that
//      the user set to Redacted.
//
//   2. They survive Full. Otherwise the feature is invisible and the test
//      passes for the wrong reason.
//
//   3. They are sent as their OWN fields, never appended to nextAppt. The
//      provider renders them on separate lines, and appending would force it to
//      parse a combined string - the pattern the Clinic Card explicitly moved
//      away from on 6 Oct.
//
// The Java side cannot be compiled here (L-045, L-053), so the provider
// assertions are source-level, the way widgetRedactedRender and
// widgetTapAndFallbackGuard already do for every other widget.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The stored shape is { [widgetKey]: tier }, and nextAppointment DEFAULTS to
// "redacted". So the cross-the-bridge test has to set it to "full" explicitly -
// otherwise the filter drops the new fields for the RIGHT reason and the test
// fails while the code is correct.
//
// Mocking the repository the way widgetBridgeUpdate.test.js does, rather than
// closing over a const: vi.mock's factory is hoisted above module-level consts,
// so a captured variable is still undefined when the factory first runs and the
// mock silently returns the default tier. Same L-062 shape - a fake that does
// not match production proves nothing.
vi.mock("../repositories/appPreferencesRepository.js", () => ({
  AppPreferencesRepository: { getPreferences: vi.fn() },
}));

import { AppPreferencesRepository } from "../repositories/appPreferencesRepository.js";

const ROOT = process.cwd();
const LAYOUT = readFileSync(
  join(ROOT, "android/app/src/main/res/layout/appointment_widget.xml"),
  "utf8"
);
const PROVIDER = readFileSync(
  join(ROOT, "android/app/src/main/java/com/shos/app/widget/AppointmentWidgetProvider.java"),
  "utf8"
);
const BRIDGE = readFileSync(
  join(ROOT, "android/app/src/main/java/com/shos/app/WidgetBridgePlugin.java"),
  "utf8"
);

describe("Appointments widget privacy (t088)", () => {
  let fieldAllowed, sendWidgetUpdate;

  beforeEach(async () => {
    vi.resetModules();
    AppPreferencesRepository.getPreferences.mockResolvedValue({ widgetPrivacy: {} });
    ({ fieldAllowed } = await import("../calculations/widgetPrivacy.js"));
    ({ sendWidgetUpdate } = await import("../calculations/widgetBridgeUpdate.js"));
  });

  it("drops BOTH new fields at the Redacted tier - time and place are identifying", () => {
    expect(fieldAllowed("nextAppointment", "nextApptTime", "redacted")).toBe(false);
    expect(fieldAllowed("nextAppointment", "nextApptLocation", "redacted")).toBe(false);
  });

  it("keeps both at Full, or the feature is invisible", () => {
    expect(fieldAllowed("nextAppointment", "nextApptTime", "full")).toBe(true);
    expect(fieldAllowed("nextAppointment", "nextApptLocation", "full")).toBe(true);
  });

  it("crosses the bridge with both fields at Full", async () => {
    // Set HERE, after the module reset, because sendWidgetUpdate reads the stored
    // tier at call time - not at import time.
    AppPreferencesRepository.getPreferences.mockResolvedValue({
      widgetPrivacy: { nextAppointment: "full" },
    });
    const plugin = { updateAppointment: vi.fn(async () => {}) };
    await sendWidgetUpdate({ plugin }, "nextAppointment", "updateAppointment", {
      count: 2,
      nextAppt: "Clinic — Tue, 14 Apr",
      nextApptTime: "09:30",
      nextApptLocation: "Brighton Sexual Health",
      category: "Appointments",
    }, "");
    const payload = plugin.updateAppointment.mock.calls[0][0];
    expect(payload.nextApptTime).toBe("09:30");
    expect(payload.nextApptLocation).toBe("Brighton Sexual Health");
  });
});

describe("Appointments widget layout (t088)", () => {
  it("declares both new views", () => {
    expect(LAYOUT).toMatch(/@\+id\/widget_appt_time/);
    expect(LAYOUT).toMatch(/@\+id\/widget_appt_location/);
  });

  it("stays FLAT - one container, because nested ViewGroups do not inflate (L-076)", () => {
    // This is the defect that made the Clinic Card render as "Can't load
    // widget", twice, on the owner's device. A new row here is a new TextView,
    // never a new layout.
    const containers = LAYOUT.match(
      /<(LinearLayout|FrameLayout|RelativeLayout|GridLayout|ScrollView|ViewFlipper)\b/g
    );
    expect(containers.length, "container count in appointment_widget.xml").toBe(1);
  });

  it("the location view is not clickable in XML - the provider attaches the tap", () => {
    // A TextView only consumes touches when something makes it clickable, so
    // declaring it here would be harmless, but declaring clickable="true" and
    // then attaching nothing would make the maps tap dead. Assert the view is
    // present; the intent is asserted on the provider below.
    expect(LAYOUT).toMatch(/@\+id\/widget_appt_location/);
  });
});

describe("Appointments widget provider (t088)", () => {
  it("attaches a maps intent to the location view, following the Clinic Card pattern", () => {
    expect(PROVIDER).toMatch(/setOnClickPendingIntent\(R\.id\.widget_appt_location/);
    expect(PROVIDER).toMatch(/geo:0,0\?q=/);
    // Uri.encode is what keeps an apostrophe or comma in a clinic name from
    // producing a malformed URI.
    expect(PROVIDER).toMatch(/Uri\.encode\(apptLocation\)/);
  });

  it("uses a request code offset from the root intent's", () => {
    // Both intents are FLAG_UPDATE_CURRENT on the same widget. Without the
    // offset, the second getActivity reuses the first's PendingIntent and the
    // maps tap opens the app instead - silently, on a device that renders fine.
    expect(PROVIDER).toMatch(/appWidgetId \* 10 \+ 1/);
  });

  it("hides both new views at the Redacted tier", () => {
    expect(PROVIDER).toMatch(
      /setViewVisibility\(R\.id\.widget_appt_time, android\.view\.View\.GONE\)/
    );
    expect(PROVIDER).toMatch(
      /setViewVisibility\(R\.id\.widget_appt_location, android\.view\.View\.GONE\)/
    );
  });

  it("hides them on the no-appointments branch too, so a deleted visit cannot linger", () => {
    // Exactly THREE GONE call sites each, not "at least two". A count of >=2
    // passed while one of the three was deleted, which is the hand-maintained
    // -inventory failure this repo keeps paying for: the assertion looked
    // plausible and measured nothing.
    //
    // The three are: the Redacted early-return, and the full-tier path's
    // "this visit has no time" and "no location" branches. The fourth site -
    // the count==0 branch - is asserted separately below, because it is a
    // different block and deserves its own name.
    const timeGone = PROVIDER.match(
      /setViewVisibility\(R\.id\.widget_appt_time, android\.view\.View\.GONE\)/g
    );
    const locGone = PROVIDER.match(
      /setViewVisibility\(R\.id\.widget_appt_location, android\.view\.View\.GONE\)/g
    );
    expect(timeGone.length, "widget_appt_time GONE call sites").toBe(3);
    expect(locGone.length, "widget_appt_location GONE call sites").toBe(3);
  });

  it("hides both when there are NO appointments at all", () => {
    // The distinct case the count cannot see: a user who deletes their last
    // appointment must not keep seeing its time and location. The "None booked"
    // branch is the only place both GONE calls appear together outside the
    // Redacted return.
    const noneBooked = PROVIDER.slice(
      PROVIDER.indexOf('"None booked"')
    );
    expect(noneBooked).toMatch(
      /setViewVisibility\(R\.id\.widget_appt_time, android\.view\.View\.GONE\)/
    );
    expect(noneBooked).toMatch(
      /setViewVisibility\(R\.id\.widget_appt_location, android\.view\.View\.GONE\)/
    );
  });

  it("persists both fields and defaults them to empty rather than absent", () => {
    expect(PROVIDER).toMatch(/putString\(KEY_APPT_TIME, apptTime == null \? "" : apptTime\)/);
    expect(PROVIDER).toMatch(
      /putString\(KEY_APPT_LOCATION, apptLocation == null \? "" : apptLocation\)/
    );
  });
});

describe("bridge forwards both fields, in the order the guard requires (t088)", () => {
  it("forwards nextApptTime and nextApptLocation", () => {
    expect(BRIDGE).toMatch(/opt\(call, "nextApptTime"\)/);
    expect(BRIDGE).toMatch(/opt\(call, "nextApptLocation"\)/);
  });

  it("redactedText remains the LAST argument of the updateAppointment call", () => {
    // L-083, hit twice in one session: appending a field after redactedText
    // breaks widgetRedactedRender, and the failure names a different provider
    // than the one actually broken. Assert the order, not just the presence.
    const callAt = BRIDGE.indexOf("AppointmentWidgetProvider.updateAppointment(");
    expect(callAt).toBeGreaterThan(-1);
    let depth = 0;
    let close = -1;
    for (let i = callAt + "AppointmentWidgetProvider.updateAppointment".length; i < BRIDGE.length; i++) {
      const ch = BRIDGE[i];
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) {
          close = i;
          break;
        }
      }
    }
    expect(close, "the call has no closing paren").toBeGreaterThan(-1);
    const args = BRIDGE.slice(callAt, close);
    expect(args.lastIndexOf('opt(call, "redactedText")')).toBeGreaterThan(
      args.lastIndexOf('opt(call, "nextApptLocation")')
    );
    expect(args.lastIndexOf('opt(call, "redactedText")')).toBeGreaterThan(
      args.lastIndexOf('opt(call, "nextApptTime")')
    );
  });
});
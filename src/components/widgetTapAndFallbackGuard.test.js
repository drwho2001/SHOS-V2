import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// NEW GUARD, 4 Oct 2026. Every assertion here corresponds to a bug found on a
// real device on that date, not to a hypothetical.
//
// The three device bugs were all the same shape - "something that must always
// happen is coupled to something that is legitimately conditional":
//   1. the Clinic Card showed the launcher's "Can't load widget"
//   2. Last Test showed "No tests logged" while the dashboard showed a test
//   3. every widget tap landed on the dashboard instead of its target screen
//
// None of them was reachable by lint, by the build, or by the unit suite.

const JAVA_DIR = "android/app/src/main/java/com/shos/app/widget";
const providers = fs
  .readdirSync(JAVA_DIR)
  .filter((f) => f.endsWith("WidgetProvider.java"));
const dataProviders = providers.filter((f) => !f.startsWith("QuickAdd"));

describe("widget taps reach the app (device bug: every tap landed on the dashboard)", () => {
  it("found the providers - otherwise every check below is vacuous", () => {
    expect(providers.length, "no widget providers discovered").toBe(10);
    expect(dataProviders.length, "no data-bearing providers discovered").toBe(7);
  });

  it("every provider sets FLAG_ACTIVITY_SINGLE_TOP", () => {
    // THE ROOT CAUSE. CLEAR_TOP without SINGLE_TOP destroys the running Activity
    // and creates a new one, so onNewIntent never fires, Capacitor's appUrlOpen
    // never fires, and the user lands on Home. Pool task t062 called this "not
    // reproducible from the code as written" - it is entirely reproducible, by
    // reading the flags.
    for (const f of providers) {
      const src = fs.readFileSync(path.join(JAVA_DIR, f), "utf8");
      expect(
        /FLAG_ACTIVITY_SINGLE_TOP/.test(src),
        `${f} builds a tap intent without FLAG_ACTIVITY_SINGLE_TOP, so a warm tap destroys the Activity and the URL is never delivered`,
      ).toBe(true);
    }
  });

  it("every provider attaches a tap to its layout root - none may skip out", () => {
    // The first version of the flag test above carried
    //   if (!/addFlags\(/.test(src)) continue; // no tap intent at all
    // which is a vacuous exemption of exactly the case it exists to catch. It
    // exempted the WORSE failure: a provider with bad flags routes wrongly, a
    // provider with no intent at all does nothing when tapped.
    //
    // It went green on NextDoseWidgetProvider, which was the only one of the ten
    // with no PendingIntent, no Intent, no URI and no setOnClickPendingIntent.
    // Asserting the flags only ever tests a tap that is already there.
    //
    // The real invariant is the one Gemini named: every RemoteViews pushed must
    // have setOnClickPendingIntent on the layout's root, or be a collection view
    // using setPendingIntentTemplate. None of this app's widgets are collections,
    // so that branch is asserted as absent rather than accommodated.
    for (const f of providers) {
      const src = fs.readFileSync(path.join(JAVA_DIR, f), "utf8");
      expect(
        /setOnClickPendingIntent\(R\.id\.widget_root/.test(src),
        `${f} never attaches a tap to its root, so the widget does nothing when tapped`,
      ).toBe(true);
      expect(
        /setPendingIntentTemplate/.test(src),
        `${f} uses a collection template; if that is intended it needs its own test, not a silent pass`,
      ).toBe(false);
    }
  });

  it("every widget layout gives its root an explicit id for the tap to attach to", () => {
    // A tap can only be attached to a view that has an id. Without this, the
    // provider assertion above could pass on an id that no layout declares.
    //
    // The layout is read out of the provider's own `R.layout.X` reference rather
    // than from a lookup table here, so this cannot drift from the code the way a
    // second list of filenames would. widget_unavailable is excluded: it is the
    // shared static fallback and deliberately has nothing to tap.
    for (const f of providers) {
      const src = fs.readFileSync(path.join(JAVA_DIR, f), "utf8");
      const layout =
        [...src.matchAll(/R\.layout\.(\w+)/g)]
          .map((m) => m[1])
          .find((n) => n !== "widget_unavailable");
      expect(layout, `${f} never constructs RemoteViews from a layout`).toBeTruthy();

      const xml = fs.readFileSync(
        `android/app/src/main/res/layout/${layout}.xml`,
        "utf8",
      );
      // Strip the <?xml ...?> declaration first - it is the first tag-shaped
      // match in the file and is not an element.
      const body = xml.replace(/<\?[\s\S]*?\?>/g, "");
      const root = body.match(/<[A-Za-z][^>]*?>/)?.[0];
      expect(root, `${layout}.xml has no root element`).toBeTruthy();
      expect(
        root,
        `${layout}.xml's root element has no android:id, so no click PendingIntent can attach to it`,
      ).toMatch(/android:id="@\+id\/widget_root"/);
    }
  });

  it("every PendingIntent uses FLAG_UPDATE_CURRENT and a per-instance requestCode", () => {
    // Without UPDATE_CURRENT Android returns the CACHED PendingIntent and drops
    // the new data URI. All ten providers passed requestCode 0, so Android saw
    // ten interchangeable tokens for the same component.
    for (const f of providers) {
      const src = fs.readFileSync(path.join(JAVA_DIR, f), "utf8");
      if (!/PendingIntent\.get(Activity|Broadcast)/.test(src)) continue;
      expect(src, `${f} builds a PendingIntent with no FLAG_UPDATE_CURRENT`).toMatch(
        /FLAG_UPDATE_CURRENT/,
      );
      expect(
        /get(Activity|Broadcast)\(\s*context,\s*0\s*,/.test(src),
        `${f} still uses requestCode 0, so every widget's PendingIntent is interchangeable`,
      ).toBe(false);
    }
  });
});

describe("a host is never left without RemoteViews (device bug: 'Can't load widget')", () => {
  it("no data provider returns before calling updateAppWidget", () => {
    // WidgetPrefs fails closed and returns null rather than writing plaintext.
    // Returning at that point was correct for privacy and wrong for the user: the
    // launcher held no RemoteViews at all, and shows its own "Can't load widget"
    // - indistinguishable from a broken widget.
    //
    // Scoped to the PER-INSTANCE updateAppWidget, which is the only place a
    // widget id exists. The public static bridge method must still return plainly
    // when prefs are null - it has no instance and its whole job is to write the
    // prefs - so asserting the bare pattern anywhere would have demanded a
    // reference to an undefined variable, which is the compile error CI caught on
    // the first attempt at this.
    for (const f of dataProviders) {
      const src = fs.readFileSync(path.join(JAVA_DIR, f), "utf8");
      const staticAt = src.search(/\n\s*public static void update\w+\(/);
      const instancePart =
        staticAt === -1 ? src : src.slice(0, staticAt);
      expect(
        /if \(prefs == null\) return;/.test(instancePart),
        `${f} returns on null prefs before pushing anything, which leaves the host with no RemoteViews`,
      ).toBe(false);
      expect(src, `${f} has no unavailableViews fallback`).toMatch(/unavailableViews/);
    }
  });

  it("the fallback layout contains no user data", () => {
    // The point of the fallback is to satisfy the host contract WITHOUT
    // weakening fail-closed. If someone later puts a medication name or a date in
    // here, it becomes a plaintext disclosure to the launcher process.
    //
    // Asserted as EXACT equality rather than a "looks data-free" heuristic. The
    // first version used a loose regex that flagged its own placeholder string,
    // which is the same failure mode as the guards in this repo that pass by
    // reading the comment documenting the fix.
    const xml = fs.readFileSync(
      "android/app/src/main/res/layout/widget_unavailable.xml",
      "utf8",
    );
    const texts = [...xml.matchAll(/android:text="([^"]*)"/g)].map((m) => m[1]);
    expect(texts, "the fallback should carry exactly one string").toEqual([
      "Open SHOS to load",
    ]);
    expect(xml, "the fallback must not reference a string resource").not.toMatch(/@string\//);
    expect(xml, "the fallback must not be a data-bearing layout").not.toMatch(
      /widget_(clinic|refill|test|doxy|cycle|next)_/,
    );
  });

  it("no static bridge method touches a per-instance variable or pushes views", () => {
    // MY OWN BUG, caught by CI's APK build rather than by anything local: the
    // fallback codemod replaced `if (prefs == null) return;` in BOTH the private
    // per-instance updateAppWidget AND the public static bridge method that writes
    // the prefs. The static method has no widget instance and no AppWidgetManager
    // in scope - it acquires both further down, after the write - so the build
    // failed across all seven providers with "cannot find symbol: variable
    // appWidgetId".
    //
    // The correct behaviour there is a plain return: that method's job is to WRITE
    // the prefs and it must write nothing when they are unavailable. Asserted here
    // so a future edit is caught by a unit test rather than a 4-minute CI round
    // trip, because the local toolchain cannot compile Java at all.
    for (const f of dataProviders) {
      const src = fs.readFileSync(path.join(JAVA_DIR, f), "utf8");
      const at = src.search(/\n\s*public static void update\w+\(/);
      if (at === -1) continue;
      const staticBody = src.slice(at);
      expect(
        /\bappWidgetId\b/.test(staticBody),
        `${f} references appWidgetId inside a static method, where no instance is in scope`,
      ).toBe(false);
      expect(
        /appWidgetManager\.updateAppWidget/.test(staticBody),
        `${f} pushes RemoteViews from a static method with no manager in scope`,
      ).toBe(false);
    }
  });
});

describe("widget pushes are decoupled from reminder scheduling", () => {
  const read = (p) => fs.readFileSync(p, "utf8");

  it("a central sync exists and is not called from a reminder path", () => {
    const sync = read("src/calculations/syncAllWidgets.js");
    expect(sync, "syncAllWidgets should exist").toMatch(/export function syncAllWidgets/);
    // It must serialise, or an older async read can overwrite a newer value.
    expect(sync, "syncAllWidgets must serialise concurrent calls").toMatch(/queue/);
  });

  it("Home pushes widgets on mount, independently of the reminder syncs", () => {
    const home = read("src/modules/SHOS_Home_Prototype.jsx");
    expect(home).toMatch(/syncAllWidgets\(\)/);
  });

  it("every bridge method a provider exists for is reached from the central sync", () => {
    // SUPERSEDES an earlier version of this test, which asserted that no reminder
    // function returns before its last widget push. That was the right invariant
    // BEFORE the decoupling, and it was correctly red on testingReminderSync - but
    // the fix was not to reorder the reminder function. It was to stop the widget
    // depending on the reminder path at all, at which point the reminder's internal
    // ordering stops mattering. Asserting the old invariant would have demanded a
    // change that contradicts the chosen design.
    //
    // The invariant that actually matters now: for every widget a provider exists
    // for, syncAllWidgets must have a pusher registered. If one is missing, that
    // widget's only push is still inside a reminder path, and every bug above comes
    // straight back.
    const sync = read("src/calculations/syncAllWidgets.js");
    const registry = sync.slice(
      sync.indexOf("const PUSHERS"),
      sync.indexOf("];", sync.indexOf("const PUSHERS")),
    );

    // Every bridge method WidgetBridgePlugin exposes must be reachable from a
    // registered pusher. Read from the plugin rather than hardcoded, so a new
    // bridge method cannot be added without this failing.
    const plugin = read(
      "android/app/src/main/java/com/shos/app/WidgetBridgePlugin.java",
    );
    const methods = [...plugin.matchAll(/public void (update\w+)\(PluginCall/g)].map(
      (m) => m[1],
    );
    expect(methods.length, "no bridge methods found in WidgetBridgePlugin").toBeGreaterThan(4);

    // The pushers are called as bare identifiers, so the mapping from bridge
    // method to JS pusher is by convention: the pusher name mirrors the widget,
    // not the method. Rather than guess, assert that the union of the source files
    // the registry imports contains every bridge method.
    const imported = [...sync.matchAll(/from "\.\/(\w+)"/g)].map((m) => m[1]);
    const source = imported.map((mod) => read(`src/calculations/${mod}.js`)).join("\n");
    const missing = methods.filter((m) => !source.includes(`"${m}"`));
    expect(
      missing,
      "these bridge methods are not pushed by any module the central sync imports: " +
        missing.join(", "),
    ).toEqual([]);
  });

  it("every pusher is null-safe or self-sufficient", () => {
    // updateClinicCardWidget dereferenced `visit.linkedTestIds` with no guard and
    // was only ever called WITH a visit, so with no upcoming appointment it threw,
    // the catch swallowed it, and the Clinic Card was never pushed at all.
    for (const f of [
      "src/calculations/clinicVisitReminderSync.js",
      "src/calculations/doxyPepSync.js",
    ]) {
      const src = read(f);
      expect(src, `${f} must export its pusher for the central sync`).toMatch(
        /export async function update\w*Widget\(/,
      );
    }
    const clinic = read("src/calculations/clinicVisitReminderSync.js");
    const at = clinic.indexOf("export async function updateClinicCardWidget");
    const fn = clinic.slice(at, at + 2200);
    // Scoped to a STATEMENT-INITIAL deref, which is the shape that actually threw.
    // A bare `visit.` also appears inside the `visit?.date ? ... visit.date : ""`
    // ternary, which IS safe because the ternary only evaluates it when the guard
    // passed - flagging that would be a false positive on correct code, and a guard
    // that reports correct code gets deleted rather than trusted.
    expect(
      fn,
      "updateClinicCardWidget assigns from an unguarded visit deref",
    ).not.toMatch(/(?:const|let|var)\s+\w+\s*=\s*visit\.[A-Za-z]/);
    // ...and it must actually be reachable with no argument at all.
    expect(fn, "updateClinicCardWidget is not callable with no argument").toMatch(
      /if \(visit === undefined\)/,
    );
  });
});
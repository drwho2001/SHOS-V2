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

  it("every widget layout does not contain a nested container or a bare divider view", () => {
    // ADDED 6 Oct 2026, after the Clinic Card widget was found rendering as
    // "Can't load widget" on a black background in BOTH the widget picker and on
    // the home screen, while the other nine rendered correctly.
    //
    // The picker is what made this a layout fault rather than a provider or
    // push-path fault: the picker inflates previewLayout in the launcher process
    // without ever invoking the provider, so no Java could be responsible.
    //
    // Every cause that could be checked statically was checked and eliminated
    // first - all ten layouts and all ten widget_info.xml files resolve every
    // resource reference, all ten root elements are identical, both preview
    // vectors are structurally identical, and there are no drawable-night
    // variants at all. What remained was the one structural difference between
    // this widget and the nine working ones: clinic_card_widget.xml was the only
    // layout containing a nested ViewGroup, and the only one containing a bare
    // View divider. Flattening it fixed the widget.
    //
    // Scoped over ALL ten layouts rather than the one that was broken. That is
    // the whole point: the previous checks here listed a handful of filenames by
    // hand, and a layout added later was never inspected by any of them.
    const layouts = new Set(["widget_unavailable"]);
    for (const f of providers) {
      const src = fs.readFileSync(path.join(JAVA_DIR, f), "utf8");
      for (const m of src.matchAll(/R\.layout\.(\w+)/g)) layouts.add(m[1]);
    }
    // Non-vacuity: if discovery broke, an empty set would make every assertion
    // below pass. A guard that reports success having found nothing is the
    // failure mode this repo keeps paying for.
    expect(layouts.size, "discovered too few widget layouts to be a real survey").toBeGreaterThan(9);

    const GROUPS = /<(LinearLayout|RelativeLayout|FrameLayout|GridLayout)\b/g;
    for (const name of layouts) {
      const xml = fs.readFileSync(
        `android/app/src/main/res/layout/${name}.xml`,
        "utf8",
      );
      const code = xml.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");
      const groups = [...code.matchAll(GROUPS)].length;
      expect(
        groups,
        `${name}.xml contains ${groups} ViewGroups. Nested containers in a widget ` +
          `RemoteViews layout do not inflate here - clinic_card_widget.xml shipped ` +
          `with one and rendered as "Can't load widget" in BOTH the picker and on ` +
          `the home screen. Flattening fixed it. Re-adding one for swipeable ` +
          `ViewFlipper pages broke it a second time, from a build that passed every ` +
          `test in this repo. The mechanism is established; this is the guard for it.`,
      ).toBe(1);
    }
  });

  it("the Clinic Card widget is flat, and the reveal button does not come back", () => {
    // REWRITTEN after swipeable ViewFlipper pages were tried and abandoned. The
    // story is the point, because the wrong turn is the obvious one:
    //
    //   1. clinic_card_widget.xml shipped with a nested container and was the only
    //      one of ten that would not inflate. Flattening fixed it - verified.
    //   2. The flattening had WORKED, but nothing had identified the mechanism, so
    //      this guard's "no more than one ViewGroup" assertion rested on an
    //      unproven theory. Swipeable pages were then added - the natural way to
    //      show more data without a tap - and they required nested pages, because
    //      a ViewFlipper's pages ARE nested layouts and there is no other
    //      RemoteViews-supported way to page a widget.
    //   3. So the assertion was WEAKENED to survive that change. That was wrong.
    //      Re-adding the nested containers broke the widget a second time, on the
    //      owner's device, from a build that passed every test in this repo.
    //
    // The mechanism is therefore established, not assumed: nested containers in a
    // widget RemoteViews layout do not inflate here. The count assertion above is
    // back, and it is now backed by two device observations rather than one guess.
    //
    // What survives from the paging attempt is the appointment TIME, which is on
    // the flat card instead of behind a swipe.
    const layout = fs.readFileSync(
      "android/app/src/main/res/layout/clinic_card_widget.xml",
      "utf8",
    );
    const code = layout.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");
    expect(
      code,
      "a ViewFlipper is back. It needs nested page containers, and that is exactly " +
        "what stopped this widget rendering - twice.",
    ).not.toMatch(/<ViewFlipper\b/);

    // The time is the point of the paging attempt, so its being present is what
    // stops this being read as "we just lost the feature".
    expect(code, "the appointment time field is gone from the card").toContain(
      "@+id/widget_clinic_visit_time",
    );

    const java = fs.readFileSync(
      path.join(JAVA_DIR, "ClinicCardWidgetProvider.java"),
      "utf8",
    );
    // Comments are stripped before these negative checks, which is not optional.
    // The comments recording WHY the reveal button and the paging were removed
    // necessarily name them, so a raw substring test matches the explanation
    // rather than the code - and a guard that does that gets deleted rather than
    // trusted. This is the same trap as the XML comment one below, Java side.
    const javaCode = java
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(
      javaCode,
      "the reveal button is back. It fired a deep link resolving to an action " +
        "nothing performs, so tapping it only opened the app.",
    ).not.toMatch(/widget_clinic_reveal|reveal-clinic/);
    expect(
      javaCode,
      "setDisplayedChild is back, so the provider still believes in paging.",
    ).not.toMatch(/setDisplayedChild/);
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
      //
      // XML COMMENTS ARE STRIPPED TOO, and that is not a nicety. A comment is not
      // an element, and this guard takes the FIRST tag-shaped match as the root -
      // so any comment that happens to mention a tag hijacks it. This repo has a
      // long list of guards that passed or failed on their own explanatory prose
      // rather than on the code; the first version of this assertion read the
      // literal "<View>" out of a comment in clinic_card_widget.xml and reported
      // that the Clinic Card's root element was a <View>, which is not a view in
      // that file at all. Matching code by reading comments is the same defect
      // every time it appears.
      const body = xml
        .replace(/<\?[\s\S]*?\?>/g, "")
        .replace(/<!--[\s\S]*?-->/g, "");
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
  it("every tap intent sets ACTION_VIEW, or Capacitor silently discards it", () => {
    // THE ROOT CAUSE of "every widget tap lands on the dashboard from a warm app",
    // found on a real device and verified against Capacitor's own source rather
    // than inferred:
    //
    //   node_modules/@capacitor/app/.../AppPlugin.java:148
    //     if (!Intent.ACTION_VIEW.equals(action) || url == null) { return; }
    //
    // Every provider built its tap intent as `new Intent(context, MainActivity.class)`
    // + `setData(uri)` with NO action. On a COLD app the launch-intent path does
    // not apply that check, so it worked. On a WARM app the intent arrives via
    // onNewIntent, the action is null, Capacitor returns early, appUrlOpen is
    // never emitted, and the tap just resumes the app where it already was.
    //
    // Two independent signals converged on it and both are worth keeping:
    //   - the observed failure was total and warm-only, not per-widget;
    //   - `adb shell am start -a android.intent.action.VIEW` DID route correctly
    //     warm, and the only difference was that am start supplies the action.
    //
    // Asserted per VARIABLE, not as a count. The first version compared "at
    // least as many setAction calls as constructors" and passed a build that did
    // not compile: ClinicCard names its intents mainIntent/revealIntent, the
    // codemod emitted a bare `intent.setAction(...)`, and the totals still
    // matched. Counting is not pairing - the property is that the intent which is
    // constructed with the data URI is the same one given the action.
    for (const f of providers) {
      const src = fs.readFileSync(path.join(JAVA_DIR, f), "utf8");
      const ctors = [
        ...src.matchAll(/Intent (\w+) = new Intent\(context, com\.shos\.app\.MainActivity\.class\)/g),
      ].map((m) => m[1]);

      expect(ctors.length, `${f} builds no tap intent at all`).toBeGreaterThan(0);

      for (const name of ctors) {
        expect(
          new RegExp(`\\b${name}\\.setAction\\(Intent\\.ACTION_VIEW\\)`).test(src),
          `${f} constructs "${name}" but never calls ${name}.setAction(Intent.ACTION_VIEW). ` +
            `Capacitor's AppPlugin discards any onNewIntent that is not an ACTION_VIEW, ` +
            `so this tap does nothing from a warm app.`,
        ).toBe(true);
      }
    }
  });

  it("no provider reintroduces FLAG_ACTIVITY_CLEAR_TOP", () => {
    // CLEAR_TOP is implied under launchMode=singleTask, so it buys nothing, and
    // without SINGLE_TOP alongside it the running Activity is destroyed instead
    // of receiving onNewIntent - which is the failure mode this file already
    // guards against for SINGLE_TOP. Asserted absent so the pair cannot drift
    // back to the broken combination.
    for (const f of providers) {
      const src = fs.readFileSync(path.join(JAVA_DIR, f), "utf8");
      expect(
        /FLAG_ACTIVITY_CLEAR_TOP/.test(src),
        `${f} reintroduced FLAG_ACTIVITY_CLEAR_TOP, which is redundant under singleTask and only risks destroying the Activity`,
      ).toBe(false);
    }
  });

  it("every tap targets a route the app actually resolves", () => {
    // `com.shos.app://medication` (bare) resolves to
    // { type: "quickAdd", tab: "medication" } - the Add Medication SHEET - not the
    // dashboard. Only /log and /dashboard resolve to a navigate. I picked the
    // bare host for the Next Dose widget after reading a comment that described
    // /dashboard, without checking the fallback, and it opened Add Medication on
    // a cold launch. The route table is the single source of truth for what each
    // URI means, so it is consulted here rather than duplicated as a second list.
    const routes = fs.readFileSync("src/calculations/deepLinkRoutes.js", "utf8");

    for (const f of providers) {
      const src = fs.readFileSync(path.join(JAVA_DIR, f), "utf8");
      for (const m of src.matchAll(/Uri\.parse\("(com\.shos\.app:\/\/[^"]+)"\)/g)) {
        const uri = m[1];
        const host = uri.replace("com.shos.app://", "").split("/")[0].split("?")[0];
        const path = "/" + (uri.replace("com.shos.app://", "").split("/")[1] || "").split("?")[0];

        // The route table must know this host at all.
        expect(
          routes.includes(`"${host}"`),
          `${f} points at ${uri}, and deepLinkRoutes.js has no branch for host "${host}" - the tap would resolve to null and do nothing`,
        ).toBe(true);

        // The bare medication host is the one genuinely ambiguous case: it is a
        // quickAdd (opens Add Medication), not a dashboard navigation. Any widget
        // whose purpose is "show me my medication status" must say so explicitly.
        if (host === "medication" && path === "/") {
          expect(
            f,
            `${f} uses bare com.shos.app://medication, which opens the Add Medication form. ` +
              `Use /dashboard to reach the medication dashboard.`,
          ).not.toBe("NextDoseWidgetProvider.java");
        }
      }
    }
  });

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

  it("changing a widget's privacy tier re-pushes the widgets", () => {
    // The stale-widget bug: the tier is persisted, the screen re-renders, and the
    // home screen widget keeps showing the OLD disclosure until something else
    // triggers a push - so the user changes a privacy setting and sees no effect
    // on the thing they were trying to hide.
    //
    // The assertion is anchored on the handler body rather than on the file, so a
    // `syncAllWidgets()` call elsewhere in WidgetsScreen.jsx cannot satisfy it.
    // That is the same mistake this repo has already made twice with comment-
    // matching and title-matching: a substring present somewhere in the file
    // standing in for the behaviour being protected.
    const src = read("src/modules/settings/WidgetsScreen.jsx");
    const start = src.indexOf("const handlePrivacyChange");
    expect(start, "handlePrivacyChange declaration not found").toBeGreaterThan(-1);
    // Bound the slice by the closing of THAT function's arrow body, not by the
    // next occurrence of its own name. The first version used a fallback that
    // silently widened to the rest of the file when the anchor was missing, and
    // the guard stayed green with the sync call deleted - a window that made the
    // test look like coverage while measuring nothing.
    const end = src.indexOf("\n  };", start);
    expect(end, "could not bound handlePrivacyChange's body").toBeGreaterThan(start);
    const body = src.slice(start, end);

    expect(body, "changing a privacy tier must re-push the widgets").toMatch(/syncAllWidgets\(\)/);
    // And it has to be AWAITED. A bare call would be swallowed by the catch below
    // on failure and, worse, would let the handler return before the push lands -
    // so the test below also asserts the awaited form, because "the call exists"
    // and "the push completes before the handler resolves" are different claims.
    expect(body, "the sync must be awaited, not fire-and-forget").toMatch(/await\s+syncAllWidgets\(\)/);

    // Imported as a NAMED export. A default import would be undefined at runtime
    // - the module has no default-importable identity through this path - and the
    // call site would throw inside the try block, where the catch logs at debug
    // and the widgets stay stale. That is the exact failure this whole commit is
    // about, wearing a different hat: a correct call that never runs.
    expect(
      src,
      "syncAllWidgets is exported both named and default, but the default " +
        "binding here is the one that silently fails at runtime",
    ).not.toMatch(/import\s+syncAllWidgets\s+from/);
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

  it("the root tap target survives the Redacted branch, not just exists", () => {
    // ADDED 6 Oct 2026. Found on the owner's phone with every widget set to
    // Redacted: the widgets rendered and tapping them did nothing.
    //
    // Every one of the seven data providers attached its root PendingIntent AFTER
    // the Redacted early-return, so at a Redacted tier - which is what the owner
    // had configured - the widget had no tap target at all.
    //
    // WHY THE EXISTING ASSERTIONS ALL MISSED IT, which is the part worth keeping:
    // the guard above proves every provider LAYOUT declares `widget_root`, and
    // this file's other test proves `setOnClickPendingIntent` is CALLED
    // somewhere. Both are true of a provider whose only tap target is unreachable,
    // because both are statements about existence rather than about ORDER.
    // "Is it called" and "is it called before the thing that returns" are different
    // questions, and only the second one is the bug.
    //
    // Read from the Java rather than a hardcoded file list, so a new provider is
    // covered by construction - the same reasoning as the bridge-method test above,
    // which reads the plugin instead of listing widgets.
    const DATA_PROVIDERS = [
      "Appointment",
      "ClinicCard",
      "Cycle",
      "DoxyPEP",
      "NextDose",
      "Refill",
      "Test",
    ];

    for (const name of DATA_PROVIDERS) {
      const path = `android/app/src/main/java/com/shos/app/widget/${name}WidgetProvider.java`;
      const src = read(path);
      const methodStart = src.indexOf("private static void updateAppWidget");
      expect(methodStart, `${name}: updateAppWidget not found`).toBeGreaterThan(-1);
      const body = src.slice(methodStart);

      // Comments are stripped because this repo's Java is heavily commented and
      // those comments quote the very expressions being searched for - an earlier
      // guard in this same file fell foul of exactly that.
      const code = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

      const clickAt = code.indexOf("setOnClickPendingIntent(R.id.widget_root");
      const branchAt = code.indexOf("String redactedText = prefs.getString(KEY_REDACTED_TEXT");
      expect(clickAt, `${name}: has no root tap target at all`).toBeGreaterThan(-1);
      expect(
        branchAt,
        `${name}: has no Redacted branch - update this guard rather than letting it pass`,
      ).toBeGreaterThan(-1);
      expect(
        clickAt,
        branchAt,
        `${name}WidgetProvider attaches its root tap target AFTER the Redacted ` +
          `early-return, so this widget is un-tappable at a Redacted tier`,
      ).toBeLessThan(branchAt);
    }
  });
});
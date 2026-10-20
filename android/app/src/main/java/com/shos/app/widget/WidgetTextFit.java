package com.shos.app.widget;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.graphics.Paint;
import android.util.TypedValue;
import android.widget.RemoteViews;

/**
 * Picks the largest text size at which a widget's own value fits its real width.
 *
 * WHY THIS EXISTS AT ALL
 * ---------------------
 * `autoSizeTextType` does NOT work in a widget. RemoteViews supports a fixed set
 * of views and cannot inflate a custom TextView subclass, so the usual auto-fit
 * answer is unavailable (verified against the RemoteViews reference: only
 * FrameLayout/LinearLayout/RelativeLayout/GridLayout and a handful of widgets,
 * and "Descendants of these classes are not supported").
 *
 * What IS available is `setTextViewTextSize(viewId, units, size)`, remoted since
 * API 16. So the fitting is done here instead: measure the actual string with
 * Paint against the widget's actual width, and step down a ladder until it fits.
 *
 * WHY A LADDER AND NOT A BINARY SEARCH
 * -----------------------------------
 * A fitted size is jarring - the same field would sit at 17sp on one day and 12sp
 * the next, purely because a medication got a longer name. Snapping to whole sp
 * means a widget usually holds its size and only steps down when it genuinely
 * would otherwise truncate, which is the behaviour a glanceable home-screen
 * widget wants.
 *
 * THE FLOOR IS 12sp ON PURPOSE. Below roughly 12sp on a high-density phone at
 * arm's length, text stops being legible, and a widget that is legible but
 * truncated is more useful than one that is complete and unreadable. Where even
 * 12sp does not fit, this returns the floor and lets the layout's own
 * `ellipsize` take over - an ellipsis on a genuinely-too-long value is a better
 * failure than shrinking the user out of reading their own data.
 */
final class WidgetTextFit {

    private WidgetTextFit() {}

    /** Smallest size this will ever return. See the class comment. */
    static final float MIN_SP = 12f;

    private static final String TAG = "WidgetTextFit";

    /**
     * ADDED 18 Oct 2026 - gates the log lines that carry USER DATA.
     *
     * THE LEAK THIS CLOSES. fit()'s decision line logged the full rendered
     * string: "width=109dp density=2.75 available=212px maxLines=2
     * text=\"Sertraline\"". On a sexual-health app that is the medication name, the
     * last-test date, "Retest due: ...", a clinic location and a refill count, at
     * Log.d, on every fit. Log.d is not stripped from a debug build, and this
     * repo's own APK is debug-signed and distributed as "latest", so anyone with
     * adb and USB debugging enabled could read it with a single logcat. The
     * measurement fields (width, chosen size, textPx, availablePx, WRAPS,
     * HITS_FLOOR) stay unconditional - they are what this repo diagnoses
     * truncation with, and they disclose nothing about the user.
     *
     * WHY A LOCAL CONSTANT AND NOT BuildConfig.DEBUG, which is the obvious
     * spelling. AGP 8.0 changed android.defaults.buildfeatures.buildconfig from
     * true to false, so BuildConfig is not generated unless a module opts back
     * in. This project uses AGP 8.13.0 (android/build.gradle:10), sets no
     * buildFeatures block, and references BuildConfig nowhere - so `if
     * (BuildConfig.DEBUG)` would not compile. Enabling the feature for one log
     * line is a broader change than the leak it fixes.
     *
     * So this is a plain constant, which also makes the intent explicit rather
     * than inherited: text is NEVER logged. Flip it to true only while debugging
     * a specific field, and never on a build you intend to hand anyone.
     */
    private static final boolean LOG_WIDGET_TEXT = false;

    /** Horizontal padding on the widget root, per side, in dp. See the layouts. */
    private static final float ROOT_PADDING_DP = 16f;

    /**
     * The widget's current width in dp. NEVER -1.
     *
     * Every failure path falls back to FALLBACK_DP rather than reporting an
     * unknown width, because fit() used to skip on a negative value and the whole
     * mechanism was therefore a silent no-op on the device that reported the
     * problem. A caller must not have to distinguish "I could not tell" from "it
     * is this wide", because it cannot do the right thing with the difference.
     */
    static int widthDp(Context context, AppWidgetManager manager, int appWidgetId) {
        // FALLBACK_DP is what a 1x2 cell is on a typical phone. It is a last
        // resort, not the expected path - see the comment below.
        final int FALLBACK_DP = 110;

        if (manager == null) return FALLBACK_DP;
        try {
            android.os.Bundle options = manager.getAppWidgetOptions(appWidgetId);
            if (options == null) return FALLBACK_DP;

            int minW = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
            int maxW = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0);

            // WHY THE SMALLER OF THE TWO, NOT MAX
            // ------------------------------------
            // This is why the fit appeared to do nothing. The first version read
            // MAX_WIDTH only and returned -1 when the launcher did not report
            // it, and `fit()` skips on a negative width - so on any launcher that
            // leaves the option unset, the entire mechanism was a silent no-op
            // and every widget kept truncating exactly as it had before.
            //
            // Gemini's read is that MAX_WIDTH is the LANDSCAPE allowance while a
            // portrait widget renders at roughly MIN_WIDTH; Anthropic's is that
            // MAX_WIDTH is orientation-aware but may simply be absent. Taking
            // the SMALLER of the two reported values is correct under either
            // reading and in both orientations: it can only ever pick a size
            // that fits the narrowest case the launcher says is possible,
            // never one sized for a width the widget is not currently at.
            //
            // When only one is reported, that one is used. When neither is, the
            // declared minimum for this provider is a better guess than a
            // constant, because it is the size the widget was actually
            // published at.
            // WHICH OF THE TWO IS CURRENT DEPENDS ON ORIENTATION, and taking the
            // smaller unconditionally is correct only in portrait.
            //
            // MEASURED on 23124RA7EO, 17 Oct 2026 (t120): appwidget 320 reported
            // minW=109 maxW=208 minH=81 maxH=166 with
            // OPTION_APPWIDGET_SIZES = [109.09x166.55, 208.73x81.45]. Those two
            // sizes are not a resize range - the width and the height swap
            // together - they are the PORTRAIT and LANDSCAPE renderings of one
            // widget. So minW/maxW is an orientation pair, and the smaller value
            // is the portrait width.
            //
            // That made the old min(minW, maxW) accidentally right in portrait
            // and WRONG in landscape: a widget laid out 208dp wide would have
            // its text measured against 109dp, shrinking roughly twice as hard as
            // it needs to. Portrait-only testing could never have caught it -
            // every instance on this device sits at its portrait width, which is
            // why six of six agreed with the old code.
            //
            // Android's own layouts guide warns that these four options are a
            // RANGE you must estimate from, and that the estimate "doesn't work
            // in all situations". This is that situation.
            boolean landscape = context.getResources().getConfiguration().orientation
                    == android.content.res.Configuration.ORIENTATION_LANDSCAPE;
            int usable = 0;
            if (landscape) {
                if (maxW > 0) usable = maxW;
                else if (minW > 0) usable = minW;
            } else {
                if (minW > 0) usable = minW;
                else if (maxW > 0) usable = maxW;
            }

            // WHAT THE LAUNCHER ACTUALLY REPORTED (t116, 16 Oct 2026).
            //
            // The four int options are BOUNDS of a range, not the current size.
            // Google's layouts guide says you get the range and then have to
            // estimate, and that the estimate "doesn't work in all situations" -
            // which is why the min-of-two below is a deliberate guess and not a
            // reading. This line is how the next session tells a bad guess from
            // a genuinely narrow widget, instead of re-deriving it from a
            // screenshot.
            //
            // sizes= is OPTION_APPWIDGET_SIZES (API 31), the list of sizes this
            // instance can actually take - the one option this class has never
            // read, and the only direct answer available. Whether this launcher
            // populates it is a five-minute question on a real device, and until
            // it is answered this line is the only evidence there is. Sizes
            // only: no user data is logged here, unlike the fit() decision line.
            android.util.Log.d(TAG, "appwidget " + appWidgetId
                    + " minW=" + minW + " maxW=" + maxW
                    + " minH=" + options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)
                    + " maxH=" + options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0)
                    + " sizes=[" + sizesOf(options) + "]"
                    + (landscape ? " [LANDSCAPE]" : " [PORTRAIT]")
                    + " -> using " + usable);

            if (usable > 0) return usable;

            try {
                android.appwidget.AppWidgetProviderInfo info = manager.getAppWidgetInfo(appWidgetId);
                if (info != null && info.minWidth > 0) return info.minWidth;
            } catch (Exception ignored) {
                // Falls through to the constant below.
            }
            return FALLBACK_DP;
        } catch (Exception e) {
            // Never let a measurement problem stop the widget rendering - and
            // never let it silently disable the fit either, which is what
            // returning -1 used to do.
            return FALLBACK_DP;
        }
    }

    /**
     * The launcher's declared size list, OPTION_APPWIDGET_SIZES (API 31), as
     * readable text - or "-" when the launcher did not populate it.
     *
     * Added 16 Oct 2026 (t116) purely as a measurement. This app had never read
     * it, so the one option that states the widget's real sizes went unexamined
     * while four range bounds were interpreted. If it comes back populated, the
     * min-of-two guess below can be replaced with a real lookup; if it comes back
     * "-", that is worth knowing too, and it is invisible without this log.
     *
     * Defensive throughout: an absent key, an empty list and an unparseable
     * parcel are all distinguished, because a helper that cannot report its own
     * failure is the exact shape that made the original widthDp a silent no-op.
     */
    private static String sizesOf(android.os.Bundle options) {
        try {
            java.util.ArrayList<android.util.SizeF> sizes =
                    options.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES);
            if (sizes == null || sizes.isEmpty()) return "-";
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < sizes.size(); i++) {
                if (i > 0) sb.append(",");
                android.util.SizeF s = sizes.get(i);
                if (s == null) continue;
                sb.append(s.getWidth()).append("x").append(s.getHeight());
            }
            return sb.length() == 0 ? "-" : sb.toString();
        } catch (Exception e) {
            return "unreadable";
        }
    }

    /**
     * Shrink `viewId`'s text to fit, if it does not fit at `maxSp`.
     *
     * No-op when the text is empty, or when the computed content width leaves no
     * room. A non-positive widthDp does NOT skip - it falls back to 110dp, for
     * the reason widthDp never returns a sentinel.
     *
     * @param text the string actually being rendered - must be the SAME string
     *             passed to setTextViewText, or the measurement is of the wrong
     *             thing and the fit is meaningless.
     */
    static void fit(RemoteViews views, Context context, int viewId, CharSequence text,
                    int widthDp, float maxSp) {
        fit(views, context, viewId, text, widthDp, maxSp, 1);
    }

    /**
     * Shrink `viewId`'s text to fit, if it does not fit at `maxSp`.
     *
     * @param maxLines how many lines the layout allows this field. Above 1, a
     *                 string too long for one line is not a failure - it wraps.
     */
    static void fit(RemoteViews views, Context context, int viewId, CharSequence text,
                    int widthDp, float maxSp, int maxLines) {
        if (views == null || text == null || text.length() == 0) return;

        android.util.DisplayMetrics metrics = context.getResources().getDisplayMetrics();
        int width = widthDp > 0 ? widthDp : 110;
        int availablePx = Math.round(width * metrics.density)
                - Math.round(ROOT_PADDING_DP * 2 * metrics.density);
        if (availablePx <= 0) return;

        // ONCE per process, not once per field. The width is the single value
        // every fit decision depends on and it is the thing that was silently
        // wrong before, so it is worth being able to read it off a device
        // without adding a log line to seven providers.
        //
        // The TEXT is the only part that can disclose anything and it is behind
        // LOG_WIDGET_TEXT - see that constant's comment. The rest is measurement
        // and stays on, because this repo diagnoses truncation by reading it.
        if (LOG_WIDGET_TEXT) {
            android.util.Log.d(TAG, "width=" + width + "dp density=" + metrics.density
                    + " available=" + availablePx + "px maxLines=" + maxLines
                    + " text=\"" + text + "\"");
        } else {
            android.util.Log.d(TAG, "width=" + width + "dp density=" + metrics.density
                    + " available=" + availablePx + "px maxLines=" + maxLines);
        }

        Paint paint = new Paint();
        paint.setAntiAlias(true);
        String s = text.toString();

        float chosen = MIN_SP;
        boolean hitFloor = true;
        boolean wraps = false;
        for (float sp = maxSp; sp >= MIN_SP; sp -= 1f) {
            paint.setTextSize(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, sp, metrics));
            if (paint.measureText(s) <= availablePx) {
                chosen = sp;
                hitFloor = false;
                break;
            }
            // WILL IT WRAP CLEANLY? A second line is only a fix if every word in
            // the string is itself narrower than the field, because that is what
            // a line break can divide on. The long-word case is exactly the one
            // that produced "Sertralin e" on device: breakStrategy="simple"
            // splits a word that does not fit rather than ellipsizing it.
            //
            // MEASURED, NOT ASSUMED. On 15 Oct 2026 this field showed
            // "Retest due: Wed 23 Dec" truncated at 351px into 212px, which
            // needs 7.2sp - so no single-line size could ever have saved it and
            // the floor fallback was correct. Checking the longest WORD rather
            // than the whole string is what tells the two situations apart.
            if (maxLines > 1 && paint.measureText(longestWord(s)) <= availablePx) {
                chosen = sp;
                hitFloor = false;
                wraps = true;
                break;
            }
        }

        // WHAT THE LADDER DECIDED, AND WHY IT STILL TRUNCATES WHEN IT DOESN'T.
        // On 14 Oct 2026 this is the difference between the two failure modes a
        // fitting mechanism can have, which look identical on the home screen:
        //
        //   hitFloor=false - the text fits at the chosen size, on one line or by
        //                    wrapping; any ellipsis is the layout's doing and
        //                    the fit is working.
        //   hitFloor=true  - the string is too long for ANY legible size, even
        //                    wrapped, so the floor was returned and the layout's
        //                    own ellipsize took over. That is the documented,
        //                    intended fallback - but it is a CONTENT problem (the
        //                    string is too long for this width), not a measuring
        //                    bug, and no amount of adjusting the ladder fixes it.
        //
        // Both were indistinguishable from a screenshot, which is why the
        // decision is recorded here rather than being re-derived by eye.
        paint.setTextSize(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, chosen, metrics));
        android.util.Log.d(TAG, "  -> chose " + chosen + "sp (max " + maxSp + "sp)"
                + " textPx=" + Math.round(paint.measureText(s))
                + " availablePx=" + availablePx
                + (wraps ? " WRAPS" : "")
                + (hitFloor ? " HITS_FLOOR" : " fits"));

        // ALWAYS write the size, not only when it is smaller than the ceiling.
        //
        // CHANGED 18 Oct 2026. This used to be `if (chosen < maxSp)`, on the
        // reasoning that leaving the XML in charge when nothing needs shrinking
        // was tidier. It is wrong, and the reason is the same recycling property
        // that makes the visibility bug real: RemoteViews reuses the view when the
        // layout id matches, so a size written on a NARROW update survives every
        // later WIDE one. The ladder picks 14sp for a value that now fits at 14sp,
        // `chosen < maxSp` is false, nothing is written, and the widget keeps
        // rendering at the 12sp it was shrunk to when it was smaller.
        //
        // The user-visible shape: shrink a widget to two cells, widen it back, and
        // the text stays small until the app next pushes data. That is the
        // "resizing from user hiding information" symptom.
        //
        // Writing maxSp explicitly is a no-op for the common case - it is the value
        // the layout already declares, so the rendered result is identical - and it
        // is what makes the fit idempotent instead of merely monotonic.
        views.setTextViewTextSize(viewId, TypedValue.COMPLEX_UNIT_SP, chosen);
    }

    /**
     * The widest single space-delimited token in {@code s}, or the whole string
     * when it has no spaces at all.
     *
     * A line break can only fall on a space, so this - not the full width - is
     * what decides whether wrapping produces a clean result or a broken word.
     */
    private static String longestWord(String s) {
        String longest = "";
        for (String word : s.split(" ")) {
            if (word.length() > longest.length()) longest = word;
        }
        return longest;
    }
}
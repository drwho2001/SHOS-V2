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

    /** Horizontal padding on the widget root, per side, in dp. See the layouts. */
    private static final float ROOT_PADDING_DP = 16f;

    /**
     * The widget's current width in dp, or -1 when the launcher has not said.
     *
     * OPTION_APPWIDGET_MAX_WIDTH is the width the widget is currently laid out
     * at, which is the one that matters for fitting - not the minimum it was
     * declared with.
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
            int usable = 0;
            if (minW > 0 && maxW > 0) usable = Math.min(minW, maxW);
            else if (minW > 0) usable = minW;
            else if (maxW > 0) usable = maxW;

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
     * Shrink `viewId`'s text to fit, if it does not fit at `maxSp`.
     *
     * No-op when the text is empty or the width is unknown, so a caller can pass
     * every field through unconditionally rather than repeating guards.
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
        android.util.Log.d(TAG, "width=" + width + "dp density=" + metrics.density
                + " available=" + availablePx + "px maxLines=" + maxLines
                + " text=\"" + text + "\"");

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

        // Only write when it actually differs from the layout's declared size, so
        // the common case leaves the XML in charge and there is nothing to undo
        // when a value happens to fit.
        if (chosen < maxSp) {
            views.setTextViewTextSize(viewId, TypedValue.COMPLEX_UNIT_SP, chosen);
        }
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
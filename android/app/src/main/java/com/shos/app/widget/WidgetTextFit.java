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
        if (manager == null) return -1;
        try {
            android.os.Bundle options = manager.getAppWidgetOptions(appWidgetId);
            if (options == null) return -1;
            int w = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0);
            return w > 0 ? w : -1;
        } catch (Exception e) {
            // Never let a measurement problem stop the widget rendering. An
            // unknown width simply means we keep the layout's declared size,
            // which is exactly what happened before this class existed.
            return -1;
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
        if (views == null || text == null || text.length() == 0 || widthDp <= 0) return;

        android.util.DisplayMetrics metrics = context.getResources().getDisplayMetrics();
        int availablePx = Math.round(widthDp * metrics.density)
                - Math.round(ROOT_PADDING_DP * 2 * metrics.density);
        if (availablePx <= 0) return;

        Paint paint = new Paint();
        paint.setAntiAlias(true);
        String s = text.toString();

        float chosen = MIN_SP;
        for (float sp = maxSp; sp >= MIN_SP; sp -= 1f) {
            paint.setTextSize(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, sp, metrics));
            if (paint.measureText(s) <= availablePx) {
                chosen = sp;
                break;
            }
        }

        // Only write when it actually differs from the layout's declared size, so
        // the common case leaves the XML in charge and there is nothing to undo
        // when a value happens to fit.
        if (chosen < maxSp) {
            views.setTextViewTextSize(viewId, TypedValue.COMPLEX_UNIT_SP, chosen);
        }
    }
}
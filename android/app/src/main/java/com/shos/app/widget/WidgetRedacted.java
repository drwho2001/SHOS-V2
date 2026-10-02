package com.shos.app.widget;

import android.view.View;
import android.widget.RemoteViews;

/**
 * Applies a widget's Redacted rendering, if it has one.
 *
 * WHY THIS EXISTS RATHER THAN SEVEN COPIES OF THE BRANCH
 * -------------------------------------------------------
 * The first version of the Redacted tier filtered the payload in JS and stopped
 * there. That was SAFE but WRONG: the filtered fields were never forwarded to the
 * providers, so each one fell back to its own placeholder and DoxyPEP could read
 * "No active window" while a window was active - a false statement about the
 * user's own health, produced by the feature whose job is to be careful.
 *
 * A guard then found that no provider read the tier at all. The fix needs a
 * branch in each provider, and Gemini's review was explicit that seven
 * near-duplicate branches is where typos hide: seven places for one mistake, and
 * CI is the only compiler. So the branch lives here once.
 *
 * THE PROVIDER STILL KNOWS NOTHING ABOUT TIERS. It passes its own view ids and
 * the line it was given; this class decides how to render it. The wording is
 * built in JS by the caller, because only the caller knows what its widget means.
 *
 * WHY IT CAN HIDE VIEWS WITHOUT ENUMERATING A TREE
 * -------------------------------------------------
 * RemoteViews is an IPC serialization stub, not a live view tree, so it cannot
 * iterate children - there is no API for it, and my first plan (restructuring
 * every layout as root > [compact, detail_container] so one call could hide the
 * detail block) was solving a problem that does not exist.
 *
 * The saving grace is that each provider ALREADY hardcodes the two or three ids
 * it sets text on, because it has to. So the ids are supplied explicitly, and
 * there is no traversal and no reflection.
 *
 * @return true if the redacted line was applied, in which case the caller must
 *         return without running its normal render - otherwise the full
 *         rendering immediately overwrites what this just set.
 */
public final class WidgetRedacted {

    private WidgetRedacted() {
    }

    /**
     * @param titleId    the view that carries the widget's headline
     * @param redactedText the pre-formatted line, or ""/null when not redacted
     * @param hideIds    every other view to hide, named explicitly
     */
    public static boolean apply(RemoteViews views, int titleId, String redactedText, int... hideIds) {
        if (views == null || redactedText == null || redactedText.isEmpty()) {
            return false;
        }
        views.setTextViewText(titleId, redactedText);
        for (int id : hideIds) {
            views.setViewVisibility(id, View.GONE);
        }
        return true;
    }
}

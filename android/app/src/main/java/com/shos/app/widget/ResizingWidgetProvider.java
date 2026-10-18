package com.shos.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

/**
 * Re-renders a widget when the launcher resizes it.
 *
 * ADDED 18 Oct 2026 - the fix for a defect no existing guard could see, reported
 * after the 2-cell rebuild and confirmed against the platform source.
 *
 * THE DEFECT. {@code AppWidgetProvider} dispatches
 * {@code ACTION_APPWIDGET_OPTIONS_CHANGED} to
 * {@link #onAppWidgetOptionsChanged(Context, AppWidgetManager, int, android.os.Bundle)},
 * and its default implementation is an EMPTY method
 * ({@code AppWidgetProvider.java}: the base implementation does nothing). So a
 * resize produced no update at all: the width-dependent decisions - which fields
 * a narrow widget drops, and what size {@code fit()} chose - stayed frozen at
 * whatever they were when the app last pushed data. Widening the widget left a
 * detail field hidden, and narrowing it left a value shrunk to 12sp from a
 * previous layout.
 *
 * It is worth being precise about the second half, because it is not this class's
 * doing. {@code fit()} writes a text size ONLY when the chosen size is below the
 * layout's declared ceiling ({@code WidgetTextFit.java}: {@code if (chosen <
 * maxSp)}), so a later update that measures a size it considers "fits" writes
 * nothing - and the previous smaller size survives on the recycled view. Callers
 * that use the fitter must therefore either reset the size explicitly or accept
 * that widening needs a fresh inflate. Next Dose does not use the fitter at all
 * (it is on autoSizeTextType), which is why it is unaffected.
 *
 * WHY A BASE CLASS RATHER THAN SEVEN OVERRIDES. The ten providers are separate
 * classes by design - they share no base so a fault in one cannot cascade, which
 * is the reason nothing here already had a common supertype. Introducing one is
 * therefore a real change to the shape of this package, and it is the smallest
 * one that fixes this once for every widget instead of copying the same six lines
 * into seven files and hoping the seventh is not missed.
 *
 * The base holds ONLY this behaviour and no widget data, so it cannot couple the
 * providers to each other: a subclass that never resizes still works, and a
 * subclass that crashes still cannot affect a sibling.
 */
public abstract class ResizingWidgetProvider extends AppWidgetProvider {

    /**
     * Subclasses implement the actual render. This is deliberately abstract so a
     * provider cannot inherit a no-op resize handler by accident and look like it
     * was fixed.
     */
    protected abstract void render(Context context, AppWidgetManager manager, int appWidgetId);

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            render(context, appWidgetManager, appWidgetId);
        }
    }

    /**
     * The resize path.
     *
     * Ignores the Bundle and re-renders unconditionally rather than diffing the
     * sizes. Two reasons: the providers' existing update paths take no options at
     * all, so threading one through seven render methods is a much larger change
     * than the defect warrants; and the render is cheap - it reads a small
     * encrypted preference file and builds one RemoteViews. A resize is a rare,
     * user-initiated event, not something that fires on a timer.
     *
     * Wrapped in a try/catch because a receiver that throws here takes down the
     * broadcast for everything else listening, and the failure is not worth a
     * blank widget. A later normal update restores it.
     */
    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager,
                                          int appWidgetId, android.os.Bundle newOptions) {
        try {
            render(context, appWidgetManager, appWidgetId);
        } catch (Exception e) {
            android.util.Log.w("WidgetResize", "resize re-render failed", e);
        }
    }
}
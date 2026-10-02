package com.shos.app.widget;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

/**
 * Single owner of the home-screen widgets' shared storage.
 *
 * WHY THIS EXISTS. Every provider used to call
 * {@code context.getSharedPreferences(PREFS_NAME, MODE_PRIVATE)} directly, which
 * is a PLAINTEXT XML file on disk. That is the one place this app's "your
 * records are encrypted at rest, on your own device" promise would break: a
 * medication name, a next-dose time, a cycle phase, an appointment title and
 * (before it was removed) an NHS number, all readable in the clear.
 *
 * WHY NOT THIS APP'S OWN VAULT KEY. Widget updates are delivered by
 * {@code AppWidgetProvider.onUpdate()}, a BroadcastReceiver that routinely runs
 * with the app process dead. {@code cryptoService}'s Data Key is deliberately
 * non-extractable and only ever held in memory while the app is running, so a
 * cold-started widget process has no way to reach it - and re-implementing the
 * vault here would mean a second key on disk, which is worse, not better.
 * EncryptedSharedPreferences uses an Android Keystore-backed key instead, which
 * is readable by this app's own process from a cold start and by nothing else.
 *
 * THE UPGRADE PATH IS A REAL EDGE CASE, not a theoretical one. Any device that
 * already has a plaintext {@code shos_widget_prefs} file would make
 * {@code create()} throw, because it cannot read a file that is not in its own
 * format. The previous build wrote nothing at all - no bridge ever called these
 * providers - so in practice the file is absent or empty, but an install that
 * did somehow have one would crash every widget on first update instead of
 * quietly recovering. So the plaintext file is deleted once and the create is
 * retried. Nothing is lost: the file could only have held widget data, and the
 * bridge re-populates it on the next change.
 */
final class WidgetPrefs {

    static final String PREFS_NAME = "shos_widget_prefs";

    private WidgetPrefs() {
    }

    /**
     * The encrypted store, or {@code null} if it cannot be opened.
     *
     * CHANGED 1 Oct 2026 (t046). The last resort used to be
     * {@code context.getSharedPreferences(PREFS_NAME, MODE_PRIVATE)} - a plaintext
     * XML file - justified by "a widget that crashes on every update is worse
     * than one that shows stale text". That reasoning is wrong for this app, and
     * the comment made it worse by asserting the content was masked by default
     * regardless. It was not: the next-dose widget renders the medication name,
     * and {@code RemoteViews} cross a process boundary to the Launcher, so
     * anything in a plaintext store here is readable by the launcher itself, by
     * anything with storage access, and by any backup agent.
     *
     * A blank widget is a cosmetic defect that the user can see and fix. A
     * plaintext file of sexual-health data is a silent one that they cannot. So
     * this now FAILS CLOSED: null, and every caller renders an empty widget.
     * Nothing is written in plaintext, ever, under any failure.
     *
     * @return the encrypted store, or null when encryption is unavailable.
     */
    static SharedPreferences get(Context context) {
        try {
            return create(context);
        } catch (Exception first) {
            // A leftover plaintext file from a build that predates encryption
            // makes create() throw, because it cannot parse a file that is not
            // in its own format. Delete it once and retry. Nothing is lost: the
            // file could only ever have held widget data, and the bridge
            // re-populates it on the next change.
            try {
                context.deleteSharedPreferences(PREFS_NAME);
                return create(context);
            } catch (Exception second) {
                android.util.Log.w("WidgetPrefs", "encrypted store unavailable; widgets will render empty", second);
                return null;
            }
        }
    }

    private static SharedPreferences create(Context context) throws Exception {
        MasterKey masterKey = new MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build();
        return EncryptedSharedPreferences.create(
                context,
                PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        );
    }
}

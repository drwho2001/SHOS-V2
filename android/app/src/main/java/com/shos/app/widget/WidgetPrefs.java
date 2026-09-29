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

    static SharedPreferences get(Context context) {
        try {
            return create(context);
        } catch (Exception first) {
            // Almost certainly a leftover plaintext file from a build that
            // wrote to this name before encryption existed. Delete and retry
            // once; if it still fails, fall back to a private (unencrypted)
            // store rather than taking the widget down entirely, because a
            // widget that crashes on every update is worse than one that shows
            // stale text - and the content is masked by default regardless.
            try {
                context.deleteSharedPreferences(PREFS_NAME);
                return create(context);
            } catch (Exception second) {
                android.util.Log.w("WidgetPrefs", "encrypted store unavailable", second);
                return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
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

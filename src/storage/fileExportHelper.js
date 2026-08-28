// fileExportHelper.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real bug found in real device testing: every export (full backup,
// single-record export) used a plain <a download> + blob click. That
// works in a browser tab, but does nothing visible on Android's
// WebView — there's no built-in handler that catches a blob: download
// the way a real browser does, so tapping Export silently did
// nothing, no error, no file.
//
// Same fix as notificationService.js's own native/web split: write the
// file for real via Capacitor's Filesystem plugin, then hand it to the
// native Share sheet — the same "save to Files, send via email/Drive/
// etc" flow Android users already know from every other app. Falls
// back to the original browser download wherever the native plugins
// aren't present (browser preview, before Claude Code adds native
// support) — same resilience pattern as every other native-plugin
// integration in this project.
let Filesystem = null, Directory = null, Encoding = null, Share = null;
let pluginLoadAttempted = false;

async function getPlugins() {
  if (pluginLoadAttempted) return { Filesystem, Directory, Encoding, Share };
  pluginLoadAttempted = true;
  try {
    const fsMod = await import("@capacitor/filesystem");
    const shareMod = await import("@capacitor/share");
    Filesystem = fsMod.Filesystem;
    Directory = fsMod.Directory;
    Encoding = fsMod.Encoding;
    Share = shareMod.Share;
  } catch {
    console.warn("[fileExportHelper] @capacitor/filesystem or @capacitor/share not available — falling back to browser download in this environment.");
  }
  return { Filesystem, Directory, Encoding, Share };
}

function downloadInBrowser(filename, contents, mimeType) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Writes `contents` (plain text — JSON or HTML) to a real file and
// opens the native Share sheet so it can actually be saved or sent
// somewhere. Falls back to a normal browser download wherever the
// native plugins aren't available.
export async function exportTextFile(filename, contents, mimeType = "text/plain") {
  const { Filesystem, Directory, Encoding, Share } = await getPlugins();
  if (!Filesystem || !Share) {
    downloadInBrowser(filename, contents, mimeType);
    return;
  }
  try {
    const written = await Filesystem.writeFile({
      path: filename,
      data: contents,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    // ADDED — real device bug: on some phones (reported on a Redmi/MIUI
    // device) the Share sheet's own app list has no "Save to Files" /
    // download-style target at all, only send-to-app options — so a
    // real copy never reliably ends up saved anywhere. Belt-and-braces
    // fix: ALSO write a second copy straight into the public Documents
    // folder (Directory.Documents — Android's own docs confirm this is
    // visible/accessible from other apps, e.g. a file manager, and an
    // app can always create its own files there even on Android 11+
    // scoped storage, no special permission needed for that case).
    // There's no distinct "Downloads" directory in this Capacitor
    // plugin version, so Documents is the closest public equivalent.
    // Best-effort only: older Android versions (10 without the legacy-
    // storage manifest flag this app doesn't set) may reject the write
    // — that's fine, it just silently skips the extra copy and the
    // Share sheet above remains the one guaranteed path.
    try {
      await Filesystem.writeFile({
        path: filename,
        data: contents,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      });
    } catch (docErr) {
      console.warn("[fileExportHelper] Could not save an extra copy to the public Documents folder (Share sheet copy above is unaffected):", docErr);
    }
    await Share.share({ url: written.uri, dialogTitle: filename });
  } catch (err) {
    console.error("[fileExportHelper] Native export failed, falling back to browser download:", err);
    downloadInBrowser(filename, contents, mimeType);
  }
}

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

// ADDED — real ask: a genuine PDF export (Clinic Card), the first
// binary file this app has ever needed to write — every export before
// this was plain text (JSON/CSV/HTML). Same native-Filesystem-then-
// Share-sheet path as exportTextFile() above, just without the
// `encoding: UTF8` option — Capacitor's Filesystem plugin treats a
// write with no `encoding` set as raw base64, which is exactly what a
// PDF (or any binary format) needs, text encoding would corrupt it.
// `base64Data` is expected WITHOUT a `data:...;base64,` prefix — strip
// that at the call site if it came from a data URI.
function downloadBinaryInBrowser(filename, base64Data, mimeType) {
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportBinaryFile(filename, base64Data, mimeType = "application/octet-stream") {
  const { Filesystem, Directory, Share } = await getPlugins();
  if (!Filesystem || !Share) {
    downloadBinaryInBrowser(filename, base64Data, mimeType);
    return;
  }
  try {
    const written = await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true,
    });
    try {
      await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      });
    } catch (docErr) {
      console.warn("[fileExportHelper] Could not save an extra copy to the public Documents folder (Share sheet copy above is unaffected):", docErr);
    }
    await Share.share({ url: written.uri, dialogTitle: filename });
  } catch (err) {
    console.error("[fileExportHelper] Native binary export failed, falling back to browser download:", err);
    downloadBinaryInBrowser(filename, base64Data, mimeType);
  }
}

// ADDED — real ask: scheduled auto-export (backupService.js's
// runAutoExportIfDue()) needs to write a real file with NO user
// interaction — exportTextFile() above always opens the native Share
// sheet, a real dialog popping up unprompted the moment the app
// happens to open would be a startling, unexplained interruption, not
// "automatic". This writes straight to the public Documents folder
// only (the same second write exportTextFile() already does above,
// silent by nature) and skips the Share sheet entirely. Returns
// whether it actually succeeded — deliberately false, not a browser-
// download fallback, when native plugins aren't present: popping an
// unexpected browser download on app load would be the same startling-
// interruption problem this function exists to avoid, and there's no
// real Documents folder to write into in that environment anyway.
export async function writeTextFileSilently(filename, contents, mimeType = "text/plain") {
  const { Filesystem, Directory, Encoding } = await getPlugins();
  if (!Filesystem) return false;
  try {
    await Filesystem.writeFile({
      path: filename,
      data: contents,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    return true;
  } catch (err) {
    console.warn("[fileExportHelper] Silent auto-export write failed:", err);
    return false;
  }
}

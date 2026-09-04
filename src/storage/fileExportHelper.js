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

// ADDED — real ask: an explicit "choose exactly where this goes" save
// flow. Export already had two paths (the native Share sheet above,
// and a silent second copy always written to the public Documents
// folder) but neither lets the user actually PICK a folder — this is
// that missing piece, via Android's real Storage Access Framework
// folder picker.
//
// SWAPPED 4 Sep 2026 — real bug found and root-caused (see this
// file's own git history / CLAUDE.md Known Issues): the plugin used
// here before this, @capawesome/capacitor-file-picker, exposes
// pickDirectory() (a SAF tree picker) but no way to actually create a
// new writable document inside that tree — confirmed by reading its
// own Android source directly. Its copyFile() only opens a
// ContentResolver stream to a URI it's handed; it never calls
// DocumentsContract.createDocument() (or the AndroidX DocumentFile
// wrapper around it) first, so a URI built by string-concatenating a
// filename onto the tree URI was never a real document and every
// write silently failed. @daniele-rolli/capacitor-scoped-storage was
// chosen as the replacement after reading ITS Android source directly
// too (not just its README) — its writeFile() genuinely does the
// missing step: DocumentFile.fromTreeUri(...).createFile(mime, name)
// before opening the output stream, the correct, standard AndroidX
// primitive for minting a new SAF document. It's a young, small
// package (v0.1.0 at the time of this swap, single maintainer) — a
// real, disclosed maturity risk this project's own "verify a write
// actually landed" standard doesn't let slide on trust alone, but the
// actual write path was read and verified line-by-line, not assumed
// from its docs, and its 3 open issues at the time (readFileInChunks
// request, an absolute-URI edge case in resolveFile, a readdir/stat
// shape mismatch) don't touch the pickFolder+writeFile path this
// feature uses. Still genuinely needs confirming end-to-end on a real
// device — this environment can't do that — same honest limit as
// before the swap.
let ScopedStorage = null;
let scopedStorageLoadAttempted = false;
// Same "never let the raw Capacitor plugin proxy be a promise's
// resolved value" wrapping as every other native-plugin loader in
// this project (see notificationService.js's own getPlugin()) —
// returning the bare proxy directly from an async function makes
// Promise resolution probe its `.then` property, which the proxy
// treats as a real (unimplemented) native call and rejects on.
async function getScopedStoragePlugin() {
  if (scopedStorageLoadAttempted) return { plugin: ScopedStorage };
  scopedStorageLoadAttempted = true;
  try {
    const mod = await import("@daniele-rolli/capacitor-scoped-storage");
    ScopedStorage = mod.ScopedStorage;
  } catch {
    console.warn("[fileExportHelper] @daniele-rolli/capacitor-scoped-storage not available — 'choose a folder' export won't be offered in this environment.");
  }
  return { plugin: ScopedStorage };
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

// ADDED — real ask: writes to a folder the user explicitly picks,
// rather than the Share sheet's indirect "send it somewhere" flow or
// the silent always-on Documents copy above. Neither of those is
// removed — this is a genuinely additional option, reachable from its
// own Settings row.
//
// On web: uses the real browser File System Access API
// (showSaveFilePicker) when available — a real OS save dialog, no
// native plugin needed. Falls back to a plain download (no folder
// choice) on a browser without it.
//
// On native Android: opens Android's real Storage Access Framework
// folder picker via @daniele-rolli/capacitor-scoped-storage's
// pickFolder(), then writes the file directly into that folder with
// writeFile() — no staging copy through Cache needed, since this
// plugin writes straight from string data into the picked SAF tree
// (see this function's own history — the previous plugin needed a
// Cache-then-copy dance because it never actually created a writable
// document inside the picked tree at all).
//
// Returns { ok: true, path } on success, { ok: false, reason } where
// reason is "cancelled" (user backed out of the picker — not an
// error), "unavailable" (plugin missing, e.g. web without
// showSaveFilePicker), or "error" (something else went wrong, `error`
// carries the original exception for the caller to log/display).
export async function exportTextFileToChosenFolder(filename, contents, mimeType = "text/plain") {
  // Same isNativePlatform() check already used by
  // notificationService.js and updateCheckService.js for the same
  // native-vs-web-shim distinction — every Capacitor plugin ships a
  // web JS fallback that always *imports* successfully even in a
  // plain browser tab, so "did the plugin import OK" alone can't tell
  // native Android apart from the GitHub Pages web build.
  const { Capacitor } = await import("@capacitor/core");
  const isNative = Capacitor.isNativePlatform();
  const ScopedStoragePlugin = isNative ? (await getScopedStoragePlugin()).plugin : null;
  if (!isNative || !ScopedStoragePlugin) {
    // Web fallback: a real save dialog if the browser supports it,
    // otherwise this whole feature just isn't offered (the caller
    // checks availability before showing the button — see
    // isChooseFolderExportAvailable below).
    if (typeof window !== "undefined" && window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({ suggestedName: filename, types: [{ description: mimeType, accept: { [mimeType]: [`.${filename.split(".").pop()}`] } }] });
        const writable = await handle.createWritable();
        await writable.write(contents);
        await writable.close();
        return { ok: true, path: handle.name };
      } catch (err) {
        if (err && err.name === "AbortError") return { ok: false, reason: "cancelled" };
        return { ok: false, reason: "error", error: err };
      }
    }
    return { ok: false, reason: "unavailable" };
  }
  let folder;
  try {
    ({ folder } = await ScopedStoragePlugin.pickFolder());
  } catch (err) {
    // A cancelled system picker throws on some Android versions rather
    // than resolving with nothing — treated as a cancel, since backing
    // out of the dialog is the single most common non-success outcome
    // and shouldn't read as a scary error.
    console.warn("[fileExportHelper] Folder picker did not complete:", err);
    return { ok: false, reason: "cancelled" };
  }
  if (!folder) return { ok: false, reason: "cancelled" };
  try {
    await ScopedStoragePlugin.writeFile({ folder, path: filename, data: contents, encoding: "utf8", mimeType });
    return { ok: true, path: `${folder.name || "chosen folder"}/${filename}` };
  } catch (err) {
    console.error("[fileExportHelper] Writing into the chosen folder failed:", err);
    return { ok: false, reason: "error", error: err };
  }
}

// Lets the UI decide whether to even show a "Choose a folder…" button
// — checked once, cheaply, rather than every render.
export async function isChooseFolderExportAvailable() {
  const { Capacitor } = await import("@capacitor/core");
  if (Capacitor.isNativePlatform()) {
    const { plugin: ScopedStoragePlugin } = await getScopedStoragePlugin();
    if (ScopedStoragePlugin) return true;
  }
  return typeof window !== "undefined" && !!window.showSaveFilePicker;
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

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
let FilePicker = null;
let filePickerLoadAttempted = false;
// FIXED — real bug found live-debugging notifications on a real device
// (chrome://inspect showed "FilePicker.then() is not implemented on
// android" as an uncaught rejection): this used to `return FilePicker;`
// — the bare Capacitor plugin proxy — as an async function's own
// return value. Returning ANY value from an async function runs it
// through Promise resolution, which checks `typeof value.then ===
// "function"` to decide if it's "thenable" — and a Capacitor plugin
// proxy intercepts EVERY property access as a potential native call,
// so probing `.then` gets treated as a real call to a method literally
// named "then", which isn't implemented, and the whole promise this
// function returns rejects, uncaught, before any caller's own error
// handling ever runs. Same root cause, same fix, as
// notificationService.js's getPlugin() — never let the raw proxy be a
// promise's resolved value; wrap it.
async function getFilePickerPlugin() {
  if (filePickerLoadAttempted) return { plugin: FilePicker };
  filePickerLoadAttempted = true;
  try {
    const mod = await import("@capawesome/capacitor-file-picker");
    FilePicker = mod.FilePicker;
  } catch {
    console.warn("[fileExportHelper] @capawesome/capacitor-file-picker not available — 'choose a folder' export won't be offered in this environment.");
  }
  return { plugin: FilePicker };
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
// On native Android: writes to Cache first (same as exportTextFile
// above), then opens Android's real Storage Access Framework folder
// picker via @capawesome/capacitor-file-picker's pickDirectory(), and
// copies the cached file into whatever folder was chosen.
//
// HONEST LIMIT, checked rather than assumed but not fully provable
// without a real device: pickDirectory() is documented by its own
// plugin as an IMPORT-flow tool ("select a directory to retrieve all
// files it contains"), and copyFile()'s own example copies INTO the
// app's data directory, not out to an arbitrary SAF-picked one. Using
// the two together to WRITE a new file into a user-picked folder is a
// combination the plugin's docs don't explicitly walk through or
// guarantee — it's expected to work (the plugin exposes exactly the
// pieces this needs, and Android does allow apps to write into a
// folder tree they were just granted access to), but this is the one
// part of this feature that genuinely needs confirming on a real
// device, not just a clean build.
//
// Returns { ok: true, path } on success, { ok: false, reason } where
// reason is "cancelled" (user backed out of the picker — not an
// error), "unavailable" (plugin missing, e.g. web without
// showSaveFilePicker), or "error" (something else went wrong, `error`
// carries the original exception for the caller to log/display).
export async function exportTextFileToChosenFolder(filename, contents, mimeType = "text/plain") {
  // FIXED — real bug found in Playwright testing: @capawesome/capacitor-
  // file-picker (like every Capacitor plugin) ships a web JS fallback
  // that always *imports* successfully even in a plain browser tab, so
  // checking "did the plugin import OK" can't tell native Android apart
  // from the GitHub Pages web build — both looked "available". On web
  // its pickDirectory()/copyFile() aren't implemented and throw, which
  // this function's own catch block was mistakenly treating as a
  // harmless user-cancel — silently doing nothing instead of using the
  // real browser Save-As dialog below. Same isNativePlatform() check
  // already used by notificationService.js and updateCheckService.js
  // for this exact native-vs-web-shim distinction.
  const { Capacitor } = await import("@capacitor/core");
  const isNative = Capacitor.isNativePlatform();
  const { Filesystem, Directory, Encoding } = isNative ? await getPlugins() : {};
  const FilePickerPlugin = isNative ? (await getFilePickerPlugin()).plugin : null;
  if (!isNative || !Filesystem || !FilePickerPlugin) {
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
  const written = await Filesystem.writeFile({ path: filename, data: contents, directory: Directory.Cache, encoding: Encoding.UTF8 });
  let folderPath;
  try {
    ({ path: folderPath } = await FilePickerPlugin.pickDirectory());
  } catch (err) {
    // A cancelled system picker throws on some Android versions rather
    // than resolving with an empty path — treated as a cancel, since
    // backing out of the dialog is the single most common non-success
    // outcome and shouldn't read as a scary error. Scoped to ONLY this
    // call, not the copyFile() below — see that catch's own comment
    // for why conflating the two used to hide a real, confirmed bug.
    console.warn("[fileExportHelper] Folder picker did not complete:", err);
    return { ok: false, reason: "cancelled" };
  }
  if (!folderPath) return { ok: false, reason: "cancelled" };
  // FIXED — real bug found live: pickDirectory() returns the picked
  // folder's own Storage Access Framework TREE uri (e.g.
  // "content://.../tree/primary%3ADownload"), not a real filesystem
  // path — naively string-concatenating "/filename" onto it (the
  // previous code here) does NOT identify a real, writable document
  // within that tree; Android requires minting one via
  // DocumentsContract.createDocument() first, which this plugin's own
  // copyFile() (confirmed by reading its Android source directly —
  // io.capawesome.capacitorjs.plugins.filepicker.FilePicker.java) does
  // NOT do — it only opens a ContentResolver output stream to
  // whatever URI it's given, which fails for a URI that was never
  // actually created as a document. This previous code's own catch
  // block then treated THAT failure the same as a cancelled picker,
  // silently reporting nothing wrong. Confirmed broken on a real
  // device — surfaced here as a real, honest error instead of a
  // silent no-op until this plugin (or a different one) actually
  // supports creating a new document inside a picked SAF tree.
  try {
    const destination = `${folderPath}/${filename}`;
    await FilePickerPlugin.copyFile({ from: written.uri, to: destination });
    return { ok: true, path: destination };
  } catch (err) {
    console.error("[fileExportHelper] Writing into the chosen folder failed (see this function's own comment — a known plugin limitation, not a transient error):", err);
    return { ok: false, reason: "error", error: err };
  }
}

// Lets the UI decide whether to even show a "Choose a folder…" button
// — checked once, cheaply, rather than every render.
export async function isChooseFolderExportAvailable() {
  const { Capacitor } = await import("@capacitor/core");
  if (Capacitor.isNativePlatform()) {
    const { plugin: FilePickerPlugin } = await getFilePickerPlugin();
    if (FilePickerPlugin) return true;
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

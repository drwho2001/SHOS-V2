// locationService.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask: "use current location for contacts/encounters... pulls
// location from Google maps (or other free service like already
// using)." The app already makes a live network call to OpenStreetMap's
// free Nominatim service for the existing address-search field
// (SHOS_Contacts_Prototype.jsx's AddressAutocomplete) — this reuses
// that exact same, already-vetted, no-API-key service for the reverse
// direction (device coordinates -> a real address/place name), rather
// than introducing a second geocoding provider.
//
// HONEST PRIVACY NOTE, stated plainly since this app is otherwise
// local-only: getting an address from raw coordinates means sending
// those coordinates to Nominatim's public server over the network —
// the same trust boundary the address-search field already crosses
// (typed text there vs. real GPS coordinates here is a real step up in
// sensitivity, worth being honest about, not hidden). Nothing is
// stored anywhere but this device either way — same as every other
// use of Nominatim in this app.
//
// Same lazy-import/graceful-degrade native-plugin pattern as
// notificationService.js/fileExportHelper.js/biometricAuthService.js:
// falls back to the browser's own navigator.geolocation wherever the
// native Capacitor plugin isn't present (browser preview) — unlike
// those other plugins, geolocation is a real, standard Web API too, so
// this fallback is a genuine working path, not just a no-op.
let Geolocation = null;
let pluginLoadAttempted = false;

// FIXED — real bug found live-debugging notifications on a real device
// (chrome://inspect showed "X.then() is not implemented on android" as
// an uncaught rejection for other plugins with this exact pattern —
// see notificationService.js's own getPlugin() comment for the full
// mechanism). This used to `return Geolocation;` — the bare Capacitor
// plugin proxy — as an async function's own return value, which is
// exactly the shape that triggers it. Wrapped instead.
async function getPlugin() {
  if (pluginLoadAttempted) return { plugin: Geolocation };
  pluginLoadAttempted = true;
  try {
    const mod = await import("@capacitor/geolocation");
    Geolocation = mod.Geolocation;
  } catch {
    console.warn("[locationService] @capacitor/geolocation not available — falling back to the browser's own navigator.geolocation in this environment.");
  }
  return { plugin: Geolocation };
}

// Resolves to { latitude, longitude }, or throws a plain-language
// Error the UI can show directly (permission denied, unavailable,
// timed out) — never a raw platform exception.
async function getCurrentCoords() {
  const { plugin } = await getPlugin();
  if (plugin) {
    const status = await plugin.checkPermissions();
    if (status.location !== "granted" && status.coarseLocation !== "granted") {
      const requested = await plugin.requestPermissions();
      if (requested.location !== "granted" && requested.coarseLocation !== "granted") {
        throw new Error("Location permission was denied. You can still type an address manually.");
      }
    }
    const position = await plugin.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  }
  // Browser fallback (Claude's own preview, a plain browser tab) — a
  // real Web API, not a stub, so "use current location" genuinely
  // works there too, not just in the installed app.
  if (!navigator.geolocation) {
    throw new Error("This device/browser doesn't support location.");
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? "Location permission was denied. You can still type an address manually." : "Couldn't get your current location.")),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// Reverse-geocodes real coordinates into a place via Nominatim — same
// service, same response shape (display_name + address.{city,town,...})
// as AddressAutocomplete's own forward search, so callers already
// handling that shape (e.g. onCityDetected) work unchanged here too.
async function reverseGeocode(latitude, longitude) {
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`);
  if (!res.ok) throw new Error("Couldn't look up an address for your current location.");
  const place = await res.json();
  if (!place || place.error || !place.display_name) {
    throw new Error("Couldn't find an address for your current location.");
  }
  return place;
}

// The one function the UI actually calls: current device location, as
// a real place (Nominatim's own result shape). Throws a plain-language
// Error on any failure along the way (permission denied, no signal,
// lookup failed) — callers show it directly, never crash silently.
export async function getCurrentLocationPlace() {
  const { latitude, longitude } = await getCurrentCoords();
  return reverseGeocode(latitude, longitude);
}

// ADDED — real ask: Encounters' own Location field stores a short
// VENUE-style name ("His place", "Sauna" — see LocationsRepository's
// own placeholder text), not a full postal address the way Contacts'
// Address field does. Nominatim's raw display_name is the whole
// address string, so this picks the shortest sensible label instead:
// a real named place if the coordinates landed on one (amenity/
// leisure/shop/tourism — Nominatim's own POI category keys), falling
// back to just the road/suburb if not, and only the full display_name
// as a last resort.
export function summarizePlaceName(place) {
  const addr = place.address || {};
  const namedPlace = place.name || addr.amenity || addr.leisure || addr.shop || addr.tourism || addr.building;
  if (namedPlace) return namedPlace;
  const road = addr.road || addr.pedestrian;
  const area = addr.suburb || addr.neighbourhood || addr.city || addr.town;
  if (road && area) return `${road}, ${area}`;
  return road || area || place.display_name;
}

// locationDirectory.js — pure rules for the read-only Locations directory and
// its Maps action. One owner so the directory screen and its guards can't
// drift, and so the Maps URL is assembled in exactly one place.
//
// The Maps base URL was checked live on 19 Nov 2026 (HTTP 200). Per the repo
// rule the full path is NOT pinned in a test — reachability is re-checked by
// hand with curl, while here we only assert the base constant is the one owner.

export const MAPS_SEARCH_BASE = "https://www.google.com/maps/search/?api=1&query=";

/** Full address text to copy — "address, postcode" as the user would paste it. */
export function formatAddress(location) {
  const address = (location?.address || "").trim();
  const postcode = (location?.postcode || "").trim();
  return [address, postcode].filter(Boolean).join(", ");
}

/** True when there is something meaningful to copy / navigate to. */
export function hasAddress(location) {
  return formatAddress(location).length > 0;
}

/**
 * The Maps search query: name + address + postcode, the same order the native
 * Clinic Card widget's mapQuery() uses (documented parity). Returns null when
 * there is nothing to search for.
 */
export function buildMapsQuery(location) {
  const parts = [location?.name, location?.address, location?.postcode]
    .map((p) => String(p || "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export function buildMapsSearchUrl(location) {
  const query = buildMapsQuery(location);
  return query ? MAPS_SEARCH_BASE + encodeURIComponent(query) : null;
}

/**
 * Group non-archived, named locations by type tag, then sort names within a
 * group. Untyped locations go last under a stable "" key. Returns
 * [{ type, label, locations: [...] }] in a stable order.
 */
export function groupLocationsByType(locations) {
  const usable = (Array.isArray(locations) ? locations : []).filter((l) => l && !l.isArchived && (l.name || "").trim());
  const buckets = new Map();
  for (const loc of usable) {
    const key = (loc.type || "").trim();
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(loc);
  }
  const keys = [...buckets.keys()].sort((a, b) => {
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b);
  });
  return keys.map((key) => ({
    type: key,
    label: key || "Untyped",
    locations: buckets.get(key).slice().sort((a, b) => String(a.name).localeCompare(String(b.name))),
  }));
}

/**
 * Does a named location need an address flagged as missing? Usage-based (a
 * location actually referenced by an encounter/clinic visit needs one) with
 * a type override for places that always need an address. Pure inputs so the
 * screen can compute it and tests can assert it without repositories.
 */
export function needsAddressNudge(location, { usedByCount = 0, addressAlwaysTypes = ["🏥 Clinic"] } = {}) {
  if (!location || !(location.name || "").trim()) return false;
  if (hasAddress(location)) return false;
  if (addressAlwaysTypes.some((t) => location.type === t)) return true;
  return usedByCount > 0;
}

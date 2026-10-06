/**
 * Whether a record date belongs in a Clinic Card timeframe.
 *
 * Stored date strings are fake-UTC wall-clock values in a sortable ISO shape;
 * comparing them lexically keeps the cutoff in that same frame. Undated records
 * remain visible, matching the Clinic Card's existing encounter/vaccination
 * behavior because the timeframe cannot establish when they occurred.
 */
export function isWithinClinicCardTimeframe(date, cutoffDate) {
  return !cutoffDate || !date || date >= cutoffDate;
}

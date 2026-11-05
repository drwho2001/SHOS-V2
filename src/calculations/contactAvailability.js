const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MINUTES_PER_DAY = 24 * 60;
const MINUTE_MS = 60 * 1000;
const formatterCache = new Map();
const zonedMinuteCache = new Map();
const timeZoneValidationCache = new Map([["UTC", true]]);

export function getDeviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== "string" || !timeZone.trim()) return false;
  const zone = timeZone.trim();
  if (timeZoneValidationCache.has(zone)) return timeZoneValidationCache.get(zone);
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone }).format(0);
    timeZoneValidationCache.set(zone, true);
    return true;
  } catch {
    timeZoneValidationCache.set(zone, false);
    return false;
  }
}

export function getContactTimeZone(contact) {
  const saved = typeof contact?.availabilityTimeZone === "string"
    ? contact.availabilityTimeZone.trim()
    : "";
  return isValidTimeZone(saved) ? saved : getDeviceTimeZone();
}

function getFormatter(timeZone) {
  const zone = isValidTimeZone(timeZone) ? timeZone : getDeviceTimeZone();
  if (!formatterCache.has(zone)) {
    formatterCache.set(zone, new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }));
  }
  return formatterCache.get(zone);
}

function zonedPartsAt(date, timeZone) {
  const minuteStamp = Math.floor(date.getTime() / MINUTE_MS);
  const key = `${timeZone}:${minuteStamp}`;
  const cached = zonedMinuteCache.get(key);
  if (cached) return cached;

  const parts = Object.fromEntries(getFormatter(timeZone).formatToParts(date).map((p) => [p.type, p.value]));
  const day = DAY_NAMES.indexOf(parts.weekday);
  const result = {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    day,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
  if (zonedMinuteCache.size > 50_000) zonedMinuteCache.clear();
  zonedMinuteCache.set(key, result);
  return result;
}

function dayNumber(value) {
  if (Number.isInteger(value) && value >= 0 && value <= 6) return value;
  if (typeof value !== "string") return null;
  const idx = DAY_NAMES.findIndex((day) => day.toLowerCase() === value.slice(0, 3).toLowerCase());
  return idx < 0 ? null : idx;
}

function selectedDays(rule) {
  return new Set((Array.isArray(rule?.days) ? rule.days : []).map(dayNumber).filter((d) => d != null));
}

export function parseAvailabilityTime(value) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function isValidAvailabilityWindow(rule) {
  const days = selectedDays(rule);
  const start = parseAvailabilityTime(rule?.start);
  const end = parseAvailabilityTime(rule?.end);
  return days.size > 0 && start != null && end != null && start !== end;
}

function dateOffset(dateString, offsetDays) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString || "")) return null;
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function matchesWeeklyWindow(rule, { day, minute }) {
  if (!isValidAvailabilityWindow(rule)) return false;
  const days = selectedDays(rule);
  const start = parseAvailabilityTime(rule.start);
  const end = parseAvailabilityTime(rule.end);
  if (start < end) return days.has(day) && minute >= start && minute < end;
  const previousDay = (day + 6) % 7;
  return (days.has(day) && minute >= start) || (days.has(previousDay) && minute < end);
}

function matchesException(exception, parts) {
  if (!exception || !/^\d{4}-\d{2}-\d{2}$/.test(exception.date || "")) return false;
  const hasStart = typeof exception.start === "string" && exception.start !== "";
  const hasEnd = typeof exception.end === "string" && exception.end !== "";
  if (!hasStart && !hasEnd) return exception.date === parts.date;
  if (!hasStart || !hasEnd) return false;
  const start = parseAvailabilityTime(exception.start);
  const end = parseAvailabilityTime(exception.end);
  if (start == null || end == null || start === end) return false;
  if (start < end) return exception.date === parts.date && parts.minute >= start && parts.minute < end;
  return (exception.date === parts.date && parts.minute >= start)
    || (dateOffset(exception.date, 1) === parts.date && parts.minute < end);
}

function isAvailableFromParts(contact, parts) {
  const exceptions = Array.isArray(contact?.availabilityExceptions) ? contact.availabilityExceptions : [];
  // If manually-added exceptions overlap, the most recently added one wins.
  for (let i = exceptions.length - 1; i >= 0; i--) {
    const exception = exceptions[i];
    if (!matchesException(exception, parts)) continue;
    return String(exception.type || "").toLowerCase() === "available";
  }
  const rules = Array.isArray(contact?.weeklyAvailability) ? contact.weeklyAvailability : [];
  return rules.some((rule) => matchesWeeklyWindow(rule, parts));
}

export function hasWeeklyAvailability(contact) {
  return Array.isArray(contact?.weeklyAvailability) && contact.weeklyAvailability.some(isValidAvailabilityWindow);
}

export function isContactAvailableAt(contact, instant = new Date()) {
  if (!hasWeeklyAvailability(contact) || !(instant instanceof Date) || !Number.isFinite(instant.getTime())) return false;
  const zone = getContactTimeZone(contact);
  return isAvailableFromParts(contact, zonedPartsAt(instant, zone));
}

/**
 * True if an explicitly scheduled contact is available at any minute in the
 * upcoming window. Minute resolution matches the precision of HTML time inputs
 * and the shared timezone-part cache means the same minute is formatted once
 * per timezone even when many contacts use it.
 */
export function isContactAvailableSoon(contact, now = new Date(), horizonMinutes = 24 * 60) {
  if (!hasWeeklyAvailability(contact) || !(now instanceof Date) || !Number.isFinite(now.getTime())) return false;
  if (isContactAvailableAt(contact, now)) return true;
  const start = Math.ceil(now.getTime() / MINUTE_MS) * MINUTE_MS;
  const zone = getContactTimeZone(contact);
  for (let minuteStamp = start; minuteStamp <= now.getTime() + horizonMinutes * MINUTE_MS; minuteStamp += MINUTE_MS) {
    if (isAvailableFromParts(contact, zonedPartsAt(new Date(minuteStamp), zone))) return true;
  }
  return false;
}

export function formatAvailabilitySummary(contact) {
  const rules = Array.isArray(contact?.weeklyAvailability) ? contact.weeklyAvailability.filter(isValidAvailabilityWindow) : [];
  if (rules.length === 0) return "";

  const byWindow = new Map();
  for (const rule of rules) {
    const key = `${rule.start}-${rule.end}`;
    if (!byWindow.has(key)) byWindow.set(key, { start: rule.start, end: rule.end, days: new Set() });
    selectedDays(rule).forEach((day) => byWindow.get(key).days.add(day));
  }

  const describeDays = (days) => {
    const sorted = [...days].sort((a, b) => a - b);
    if (sorted.length === 7) return "daily";
    if (sorted.join(",") === "1,2,3,4,5") return "Mon–Fri";
    if (sorted.join(",") === "0,6") return "weekends";
    return sorted.map((day) => DAY_NAMES[day]).join(", ");
  };
  const describeTime = (startText, endText) => {
    const start = parseAvailabilityTime(startText);
    const end = parseAvailabilityTime(endText);
    if (start >= 17 * 60 && (end <= 2 * 60 || end >= start)) return "evenings";
    if (start >= 12 * 60 && start < 17 * 60 && end <= 18 * 60) return "afternoons";
    if (start < 12 * 60 && end <= 12 * 60) return "mornings";
    return `${startText}–${endText}`;
  };
  const descriptions = [...byWindow.values()].map(({ start, end, days }) => `${describeDays(days)} ${describeTime(start, end)}`);
  const visible = descriptions.slice(0, 2).join(" · ");
  return `Usually ${visible}${descriptions.length > 2 ? ` · +${descriptions.length - 2} more` : ""}`;
}

export function localDateTimeInputValue(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

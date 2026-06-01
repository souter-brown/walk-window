export function formatTime(date: Date | null, timezone?: string): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date);
}

export function formatHourLabel(hour: number): string {
  const normalized = hour === 24 ? 0 : hour;
  if (normalized === 0) return "12 AM";
  if (normalized === 12) return "12 PM";
  if (normalized < 12) return `${normalized} AM`;
  return `${normalized - 12} PM`;
}

/** Local clock hour (0–23) for a timestamp in the given timezone. */
export function getLocalHour(time: Date, timezone: string): number {
  const raw = parseInt(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    }).format(time),
    10
  );
  return raw === 24 ? 0 : raw;
}

export function getLocalMinute(time: Date, timezone: string): number {
  return parseInt(
    new Intl.DateTimeFormat("en-US", {
      minute: "numeric",
      timeZone: timezone,
    }).format(time),
    10
  );
}

export function isLocalMidnight(time: Date, timezone: string): boolean {
  return getLocalHour(time, timezone) === 0 && getLocalMinute(time, timezone) === 0;
}

export const DAY_START_LABEL = "Start of day";
export const DAY_END_LABEL = "End of day";

/** Like formatTime, but uses plain day-boundary labels at local midnight. */
export function formatWindowTime(
  date: Date | null,
  timezone?: string,
  role: "start" | "end" = "end"
): string {
  if (!date) return "—";
  if (timezone && isLocalMidnight(date, timezone)) {
    return role === "start" ? DAY_START_LABEL : DAY_END_LABEL;
  }
  return formatTime(date, timezone);
}

/** Fractional local hour for chart x-axis positioning (e.g. 6:30 → 6.5). */
export function getChartHour(time: Date, timezone: string): number {
  const hour = getLocalHour(time, timezone);
  const minute = parseInt(
    new Intl.DateTimeFormat("en-US", {
      minute: "numeric",
      timeZone: timezone,
    }).format(time),
    10
  );
  return hour + minute / 60;
}

export function formatDateShort(date: Date, timezone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: timezone,
  }).format(date);
}

function formatLocalDateTime(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");

  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/**
 * Open-Meteo timestamps are wall-clock times in the requested timezone without
 * an offset suffix. Parse them in that timezone instead of the browser default.
 */
export function parseForecastLocalTime(isoLocal: string, timezone: string): Date {
  const match = isoLocal.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return new Date(isoLocal);

  const [, year, month, day, hour, minute] = match;
  const target = `${year}-${month}-${day}T${hour}:${minute}`;
  const utcGuess = Date.UTC(+year, +month - 1, +day, +hour, +minute);

  let low = utcGuess - 16 * 3_600_000;
  let high = utcGuess + 16 * 3_600_000;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = new Date(mid);
    const formatted = formatLocalDateTime(candidate, timezone);

    if (formatted === target) return candidate;
    if (formatted < target) low = mid + 60_000;
    else high = mid - 60_000;
  }

  return new Date(isoLocal);
}

export function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getLocalDayKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isSameLocalDay(a: Date, b: Date, timezone: string): boolean {
  return getLocalDayKey(a, timezone) === getLocalDayKey(b, timezone);
}

function getTomorrowLocalDayKey(now: Date, timezone: string): string {
  const todayKey = getLocalDayKey(now, timezone);
  let cursor = now.getTime() + 3_600_000;
  const limit = now.getTime() + 48 * 3_600_000;

  while (cursor <= limit) {
    const key = getLocalDayKey(new Date(cursor), timezone);
    if (key !== todayKey) return key;
    cursor += 3_600_000;
  }

  return getLocalDayKey(new Date(now.getTime() + 86_400_000), timezone);
}

/** True when the first forecast day is not the current local calendar day. */
export function isForecastStale(
  firstDayDate: Date | undefined,
  now: Date,
  timezone: string
): boolean {
  if (!firstDayDate) return false;
  return !isSameLocalDay(firstDayDate, now, timezone);
}

/** Forecast day labels follow the location's local calendar, not array index. */
export function getDayLabel(
  index: number,
  date: Date,
  timezone: string,
  now: Date = new Date()
): string {
  void index;
  const dateKey = getLocalDayKey(date, timezone);
  const todayKey = getLocalDayKey(now, timezone);
  if (dateKey === todayKey) return "Today";
  if (dateKey === getTomorrowLocalDayKey(now, timezone)) return "Tomorrow";
  return formatDateShort(date, timezone);
}

export function formatTimezoneShort(timezone: string, date: Date = new Date()): string {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "short",
  })
    .formatToParts(date)
    .find((segment) => segment.type === "timeZoneName");

  return part?.value ?? timezone;
}

export function minutesBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}

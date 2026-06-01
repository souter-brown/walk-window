import type {
  DogWalkPreferences,
  ExercisePreferences,
} from "@/types/preferences";
import type {
  ActivityWindowResult,
  DayAnalysis,
  DayForecast,
  HourlySafety,
  HourlyWeather,
  MobileSafeWindowLine,
  SafetyStatus,
  TimeWindow,
} from "@/types/weather";
import { addMinutes, getDayLabel, DAY_END_LABEL, DAY_START_LABEL, formatWindowTime, isSameLocalDay } from "@/lib/time-utils";

/** Degrees above max (or below min) before status escalates past caution. */
export const EXERCISE_CAUTION_BAND = 5;

export function getMaxPavementLimit(prefs: DogWalkPreferences): number {
  return prefs.maxPavement;
}

/** Evaluate exercise hour status with a caution band above max real feel. */
export function isExerciseHourSafe(
  hour: HourlyWeather,
  prefs: ExercisePreferences
): HourlySafety {
  const feel = hour.apparentTemp;
  const maxRealFeel = Number(prefs.maxRealFeel);

  if (feel > maxRealFeel + EXERCISE_CAUTION_BAND) {
    return { time: hour.time, safe: false, status: "too_hot" };
  }
  if (feel > maxRealFeel) {
    return { time: hour.time, safe: false, status: "caution" };
  }

  return { time: hour.time, safe: true, status: "good" };
}

/**
 * First time a value crosses above max (linear between hourly readings).
 * Only counts transitions from at-or-below max to above max — not hours that stay hot.
 */
function findFirstMaxCrossing(
  hours: HourlyWeather[],
  getValue: (hour: HourlyWeather) => number,
  maxLimit: number,
  after?: Date,
  before?: Date
): Date | null {
  for (let i = 0; i < hours.length; i++) {
    const value = getValue(hours[i]);
    if (value <= maxLimit) continue;

    const prev = i > 0 ? hours[i - 1] : null;

    // Need a prior reading at or below max — not a carry-over from before this day.
    if (!prev || getValue(prev) > maxLimit) continue;

    let crossing: Date;
    const prevVal = getValue(prev);
    if (prevVal <= maxLimit && value > prevVal) {
      const fraction = (maxLimit - prevVal) / (value - prevVal);
      crossing = addMinutes(prev.time, Math.round(fraction * 60));
    } else {
      crossing = hours[i].time;
    }

    if (after && crossing < after) continue;
    if (before && crossing >= before) continue;
    return crossing;
  }

  return null;
}

export function findFirstRealFeelMaxCrossing(
  hours: HourlyWeather[],
  maxRealFeel: number,
  after?: Date,
  before?: Date
): Date | null {
  return findFirstMaxCrossing(
    hours,
    (hour) => hour.apparentTemp,
    maxRealFeel,
    after,
    before
  );
}

/** Evaluate dog-walk hour status with a caution band above max pavement. */
export function isDogWalkHourSafe(
  hour: HourlyWeather,
  prefs: DogWalkPreferences
): HourlySafety {
  const pavement = hour.pavementTemp;
  const max = getMaxPavementLimit(prefs);

  if (pavement > max + EXERCISE_CAUTION_BAND) {
    return { time: hour.time, safe: false, status: "too_hot" };
  }
  if (pavement > max) {
    return { time: hour.time, safe: false, status: "caution" };
  }

  return { time: hour.time, safe: true, status: "good" };
}

/**
 * A start time is valid only if every hour overlapping the activity
 * duration remains safe. Hourly data is treated as constant for each hour.
 */
function isStartTimeSafe(
  hours: HourlyWeather[],
  startIndex: number,
  durationMinutes: number,
  evaluate: (hour: HourlyWeather) => HourlySafety
): boolean {
  const start = hours[startIndex];
  if (!start) return false;

  const endTime = addMinutes(start.time, durationMinutes);

  for (let i = startIndex; i < hours.length; i++) {
    const hourStart = hours[i].time;
    const hourEnd = addMinutes(hourStart, 60);
    if (hourStart >= endTime) break;
    if (hourEnd <= start.time) continue;

    const result = evaluate(hours[i]);
    if (!result.safe) return false;
  }

  return true;
}

function findSafeWindows(
  hours: HourlyWeather[],
  durationMinutes: number,
  evaluate: (hour: HourlyWeather) => HourlySafety
): TimeWindow[] {
  const windows: TimeWindow[] = [];
  let windowStart: Date | null = null;

  for (let i = 0; i < hours.length; i++) {
    const safe = isStartTimeSafe(hours, i, durationMinutes, evaluate);

    if (safe && !windowStart) {
      windowStart = hours[i].time;
    } else if (!safe && windowStart) {
      windows.push({
        start: windowStart,
        end: hours[i].time,
      });
      windowStart = null;
    }
  }

  if (windowStart) {
    const lastHour = hours[hours.length - 1];
    windows.push({
      start: windowStart,
      end: addMinutes(lastHour.time, 60),
    });
  }

  return windows;
}

function pickBestWindow(
  windows: TimeWindow[],
  now: Date,
  isToday: boolean
): TimeWindow | null {
  if (windows.length === 0) return null;

  if (isToday) {
    const active = windows.find(
      (window) => now >= window.start && now < window.end
    );
    if (active) return active;

    const upcoming = windows.find((window) => window.start > now);
    if (upcoming) return upcoming;
  }

  return windows.reduce((best, current) => {
    const bestLen = best.end.getTime() - best.start.getTime();
    const curLen = current.end.getTime() - current.start.getTime();
    return curLen > bestLen ? current : best;
  });
}

function windowsMatch(a: TimeWindow, b: TimeWindow): boolean {
  return a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime();
}

function computeWindowStopPoint(
  hours: HourlyWeather[],
  window: TimeWindow,
  durationMinutes: number,
  getValue: (hour: HourlyWeather) => number,
  maxLimit: number,
  mustStartBy: Date | null = null
): Date {
  if (mustStartBy && mustStartBy >= window.start && mustStartBy < window.end) {
    return mustStartBy;
  }

  const crossing = findFirstMaxCrossing(
    hours,
    getValue,
    maxLimit,
    window.start,
    window.end
  );

  if (crossing) {
    const mustStart = addMinutes(crossing, -durationMinutes);
    if (mustStart >= window.start) return mustStart;
  }

  return window.end;
}

function formatMobileWindowRange(
  window: TimeWindow,
  stopPoint: Date,
  now: Date,
  isToday: boolean,
  timezone: string
): string | null {
  let start = window.start;

  if (isToday) {
    if (now >= window.start && now < stopPoint) {
      start = now;
    } else if (now >= stopPoint || now >= window.end) {
      return null;
    }
  }

  if (start.getTime() >= stopPoint.getTime()) return null;

  const usingNow =
    isToday && Math.abs(start.getTime() - now.getTime()) < 60_000;

  const startText = usingNow ? "Now" : formatWindowTime(start, timezone, "start");
  const stopText = formatWindowTime(stopPoint, timezone, "end");

  if (stopText === DAY_END_LABEL && (usingNow || startText === DAY_START_LABEL)) {
    return "All Day";
  }

  return `${startText} – ${stopText}`;
}

/** All actionable safe windows for mobile — primary window is marked. */
export function getMobileSafeWindowLines(
  result: ActivityWindowResult,
  hours: HourlyWeather[],
  durationMinutes: number,
  getValue: (hour: HourlyWeather) => number,
  maxLimit: number,
  now: Date,
  timezone: string,
  isToday: boolean
): MobileSafeWindowLine[] {
  const lines: MobileSafeWindowLine[] = [];

  for (const window of result.safeWindows) {
    if (isToday && now >= window.end) continue;

    const isPrimary = result.bestWindow ? windowsMatch(window, result.bestWindow) : false;
    const stopPoint = computeWindowStopPoint(
      hours,
      window,
      durationMinutes,
      getValue,
      maxLimit,
      isPrimary ? result.mustStartBy : null
    );
    const text = formatMobileWindowRange(window, stopPoint, now, isToday, timezone);
    if (!text) continue;

    lines.push({ text, isPrimary });
  }

  return lines;
}

/** Must start by applies only to the active or first upcoming primary window. */
export function shouldShowMobileMustStartBy(
  result: ActivityWindowResult,
  now: Date,
  isToday: boolean
): boolean {
  if (!result.mustStartBy || !result.bestWindow) return false;

  if (isToday) {
    if (now >= result.bestWindow.end || now >= result.mustStartBy) return false;

    const active = result.safeWindows.find(
      (window) => now >= window.start && now < window.end
    );
    const upcoming = result.safeWindows.find((window) => window.start > now);
    const primary = active ?? upcoming;

    return primary ? windowsMatch(primary, result.bestWindow) : false;
  }

  return true;
}

/** Header timing line: Start by while still actionable, otherwise Wait until. */
export function getActivityHeaderTiming(
  result: ActivityWindowResult,
  now: Date,
  durationMinutes: number
): { kind: "startBy" | "waitUntil"; time: Date } | null {
  if (
    result.mustStartBy &&
    now < result.mustStartBy &&
    shouldShowMobileMustStartBy(result, now, true)
  ) {
    return { kind: "startBy", time: result.mustStartBy };
  }

  const activeWindow = result.safeWindows.find(
    (window) => now >= window.start && now < window.end
  );
  const canStartNow =
    activeWindow != null &&
    now < addMinutes(activeWindow.end, -durationMinutes) &&
    (!result.mustStartBy || now < result.mustStartBy);

  if (canStartNow) {
    return null;
  }

  if (result.waitUntilAfter && now < result.waitUntilAfter) {
    return { kind: "waitUntil", time: result.waitUntilAfter };
  }

  const upcomingStart = result.safeWindows.find((window) => window.start > now)?.start;
  if (upcomingStart && now < upcomingStart) {
    return { kind: "waitUntil", time: upcomingStart };
  }

  return null;
}

/**
 * First time conditions return to good after a non-good period.
 * Used for "Wait until" — e.g. evening cool-down after a hot afternoon.
 */
function findFirstGoodTransitionAfter(
  hours: HourlyWeather[],
  evaluate: (hour: HourlyWeather) => HourlySafety,
  getValue: (hour: HourlyWeather) => number,
  maxLimit: number,
  after: Date
): Date | null {
  for (let i = 1; i < hours.length; i++) {
    const prevStatus = evaluate(hours[i - 1]).status;
    const currStatus = evaluate(hours[i]).status;
    if (currStatus !== "good" || prevStatus === "good") continue;

    const prevVal = getValue(hours[i - 1]);
    const currVal = getValue(hours[i]);
    let crossing = hours[i].time;
    if (prevVal > maxLimit && currVal <= maxLimit && prevVal > currVal) {
      const fraction = (prevVal - maxLimit) / (prevVal - currVal);
      crossing = addMinutes(hours[i - 1].time, Math.round(fraction * 60));
    }

    if (crossing >= after) return crossing;
  }

  return null;
}

/** When conditions become good again after a caution period (e.g. evening cool-down). */
function computeWaitUntilAfter(
  hours: HourlyWeather[],
  now: Date,
  isToday: boolean,
  evaluate: (hour: HourlyWeather) => HourlySafety,
  getValue: (hour: HourlyWeather) => number,
  maxLimit: number,
  mustStartBy: Date | null = null
): Date | null {
  if (isToday) {
    const currentHour = hours.find(
      (h) => h.time <= now && addMinutes(h.time, 60) > now
    );
    const currentlyGood =
      currentHour != null && evaluate(currentHour).status === "good";
    const missedStartBy = mustStartBy != null && now >= mustStartBy;

    if (currentlyGood && !missedStartBy) {
      return null;
    }

    return findFirstGoodTransitionAfter(
      hours,
      evaluate,
      getValue,
      maxLimit,
      now
    );
  }

  const dayStart = hours[0]?.time;
  if (!dayStart) return null;

  return findFirstGoodTransitionAfter(
    hours,
    evaluate,
    getValue,
    maxLimit,
    dayStart
  );
}

function summarizeStatus(
  hours: HourlyWeather[],
  evaluate: (hour: HourlyWeather) => HourlySafety,
  now?: Date,
  isToday?: boolean
): SafetyStatus {
  if (isToday && now) {
    const currentHour = hours.find(
      (h) => h.time <= now && addMinutes(h.time, 60) > now
    );
    if (currentHour) {
      return evaluate(currentHour).status;
    }
  }

  const counts: Partial<Record<SafetyStatus, number>> = {};
  for (const hour of hours) {
    const result = evaluate(hour);
    counts[result.status] = (counts[result.status] ?? 0) + 1;
  }

  if ((counts.good ?? 0) >= hours.length * 0.6) return "good";
  if ((counts.too_hot ?? 0) > 0) return "too_hot";
  if ((counts.caution ?? 0) > 0) return "caution";
  return "unsafe";
}

function computeMustStartByFromHeatingCrossing(
  hours: HourlyWeather[],
  durationMinutes: number,
  maxLimit: number,
  getValue: (hour: HourlyWeather) => number,
  now: Date,
  isToday: boolean,
  bestWindow: TimeWindow | null
): Date | null {
  if (!bestWindow || hours.length === 0) return null;

  const crossing = findFirstMaxCrossing(
    hours,
    getValue,
    maxLimit,
    bestWindow.start,
    bestWindow.end
  );

  if (crossing) {
    const mustStart = addMinutes(crossing, -durationMinutes);
    if (mustStart >= bestWindow.start) {
      return mustStart;
    }
  }

  return null;
}

function computeExerciseMustStartBy(
  hours: HourlyWeather[],
  durationMinutes: number,
  prefs: ExercisePreferences,
  bestWindow: TimeWindow | null,
  now: Date,
  isToday: boolean
): Date | null {
  const maxLimit = Number(prefs.maxRealFeel);

  return computeMustStartByFromHeatingCrossing(
    hours,
    durationMinutes,
    maxLimit,
    (hour) => hour.apparentTemp,
    now,
    isToday,
    bestWindow
  );
}

function computeExerciseActivityWindows(
  hours: HourlyWeather[],
  durationMinutes: number,
  now: Date,
  isToday: boolean,
  prefs: ExercisePreferences
): ActivityWindowResult {
  const evaluate = (hour: HourlyWeather) => isExerciseHourSafe(hour, prefs);
  const windows = findSafeWindows(hours, durationMinutes, evaluate);
  const bestWindow = pickBestWindow(windows, now, isToday);
  const mustStartBy = computeExerciseMustStartBy(
    hours,
    durationMinutes,
    prefs,
    bestWindow,
    now,
    isToday
  );

  const waitUntilAfter = computeWaitUntilAfter(
    hours,
    now,
    isToday,
    evaluate,
    (hour) => hour.apparentTemp,
    Number(prefs.maxRealFeel),
    mustStartBy
  );

  return {
    bestWindow,
    safeWindows: windows,
    mustStartBy,
    waitUntilAfter,
    status: summarizeStatus(hours, evaluate, now, isToday),
  };
}

function computeActivityWindows(
  hours: HourlyWeather[],
  durationMinutes: number,
  now: Date,
  isToday: boolean,
  evaluate: (hour: HourlyWeather) => HourlySafety,
  getValue: (hour: HourlyWeather) => number,
  maxLimit: number
): ActivityWindowResult {
  const windows = findSafeWindows(hours, durationMinutes, evaluate);
  const bestWindow = pickBestWindow(windows, now, isToday);
  const mustStartBy = computeMustStartByFromHeatingCrossing(
    hours,
    durationMinutes,
    maxLimit,
    getValue,
    now,
    isToday,
    bestWindow
  );

  const waitUntilAfter = computeWaitUntilAfter(
    hours,
    now,
    isToday,
    evaluate,
    getValue,
    maxLimit,
    mustStartBy
  );

  return {
    bestWindow,
    safeWindows: windows,
    mustStartBy,
    waitUntilAfter,
    status: summarizeStatus(hours, evaluate, now, isToday),
  };
}

export function analyzeDay(
  day: DayForecast,
  exercisePrefs: ExercisePreferences,
  dogPrefs: DogWalkPreferences,
  now: Date,
  dayIndex: number,
  timezone: string
): DayAnalysis {
  const isToday = isSameLocalDay(day.date, now, timezone);
  const label = getDayLabel(dayIndex, day.date, timezone, now);

  const exercise = computeExerciseActivityWindows(
    day.hours,
    exercisePrefs.durationMinutes,
    now,
    isToday,
    exercisePrefs
  );

  const dogLimits = getMaxPavementLimit(dogPrefs);
  const dogWalk = computeActivityWindows(
    day.hours,
    dogPrefs.durationMinutes,
    now,
    isToday,
    (h) => isDogWalkHourSafe(h, dogPrefs),
    (h) => h.pavementTemp,
    dogLimits
  );

  const pawSafety = summarizeStatus(
    day.hours,
    (h) => isDogWalkHourSafe(h, dogPrefs),
    now,
    isToday
  );

  return {
    date: day.date,
    label,
    exercise,
    dogWalk,
    pawSafety,
  };
}

export function analyzeForecast(
  days: DayForecast[],
  exercisePrefs: ExercisePreferences,
  dogPrefs: DogWalkPreferences,
  timezone: string,
  now: Date = new Date()
): DayAnalysis[] {
  return days.map((day, index) =>
    analyzeDay(day, exercisePrefs, dogPrefs, now, index, timezone)
  );
}

/** Per-hour safety for chart shading. */
export function getHourlySafetyMap(
  hours: HourlyWeather[],
  type: "exercise" | "dogWalk",
  exercisePrefs: ExercisePreferences,
  dogPrefs: DogWalkPreferences
): HourlySafety[] {
  return hours.map((hour) =>
    type === "exercise"
      ? isExerciseHourSafe(hour, exercisePrefs)
      : isDogWalkHourSafe(hour, dogPrefs)
  );
}

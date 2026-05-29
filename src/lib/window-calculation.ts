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
  SafetyStatus,
  TimeWindow,
} from "@/types/weather";
import { addMinutes, getDayLabel } from "@/lib/time-utils";

/** Degrees above max (or below min) before status escalates past caution. */
export const EXERCISE_CAUTION_BAND = 5;

export function getPavementLimits(prefs: DogWalkPreferences): {
  min: number;
  max: number;
} {
  const adjustments: Record<DogWalkPreferences["sensitivity"], number> = {
    low: 10,
    normal: 0,
    high: -15,
  };
  const adj = adjustments[prefs.sensitivity];
  return {
    min: prefs.minPavement,
    max: prefs.maxPavement + adj,
  };
}

/** Evaluate exercise hour status with a caution band above/below real-feel limits. */
export function isExerciseHourSafe(
  hour: HourlyWeather,
  prefs: ExercisePreferences
): HourlySafety {
  const feel = hour.apparentTemp;
  const minRealFeel = Number(prefs.minRealFeel);
  const maxRealFeel = Number(prefs.maxRealFeel);

  if (feel < minRealFeel - EXERCISE_CAUTION_BAND) {
    return { time: hour.time, safe: false, status: "too_cold" };
  }
  if (feel < minRealFeel) {
    return { time: hour.time, safe: false, status: "caution" };
  }
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

/** Evaluate dog-walk hour status with a caution band above max pavement (and below min). */
export function isDogWalkHourSafe(
  hour: HourlyWeather,
  prefs: DogWalkPreferences
): HourlySafety {
  const pavement = hour.pavementTemp;
  const { min, max } = getPavementLimits(prefs);

  if (pavement < min) {
    return { time: hour.time, safe: false, status: "too_cold" };
  }
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

/**
 * Must-start-by: latest start time in the best window that still
 * allows completing the full duration before conditions turn unsafe.
 */
function computeMustStartBy(
  hours: HourlyWeather[],
  bestWindow: TimeWindow | null,
  durationMinutes: number,
  evaluate: (hour: HourlyWeather) => HourlySafety
): Date | null {
  if (!bestWindow) return null;

  const candidates: Date[] = [];

  for (let i = 0; i < hours.length; i++) {
    const start = hours[i].time;
    if (start < bestWindow.start || start >= bestWindow.end) continue;
    if (isStartTimeSafe(hours, i, durationMinutes, evaluate)) {
      candidates.push(start);
    }
  }

  if (candidates.length === 0) return null;
  return candidates[candidates.length - 1];
}

/**
 * Latest time conditions cross from caution back to good (at or below max limit).
 * Used for "Wait until" — e.g. evening cool-down after a hot afternoon.
 */
function findLastCautionToGoodTransition(
  hours: HourlyWeather[],
  evaluate: (hour: HourlyWeather) => HourlySafety,
  getValue: (hour: HourlyWeather) => number,
  maxLimit: number,
  after?: Date
): Date | null {
  let last: Date | null = null;

  for (let i = 1; i < hours.length; i++) {
    const prevStatus = evaluate(hours[i - 1]).status;
    const currStatus = evaluate(hours[i]).status;
    if (prevStatus !== "caution" || currStatus !== "good") continue;

    const prevVal = getValue(hours[i - 1]);
    const currVal = getValue(hours[i]);
    let crossing = hours[i].time;
    if (prevVal > maxLimit && currVal <= maxLimit && prevVal > currVal) {
      const fraction = (prevVal - maxLimit) / (prevVal - currVal);
      crossing = addMinutes(hours[i - 1].time, Math.round(fraction * 60));
    }

    if (after && crossing < after) continue;
    last = crossing;
  }

  return last;
}

/** When conditions become good again after a caution period (e.g. evening cool-down). */
function computeWaitUntilAfter(
  hours: HourlyWeather[],
  now: Date,
  isToday: boolean,
  evaluate: (hour: HourlyWeather) => HourlySafety,
  getValue: (hour: HourlyWeather) => number,
  maxLimit: number
): Date | null {
  if (isToday) {
    const currentHour = hours.find(
      (h) => h.time <= now && addMinutes(h.time, 60) > now
    );
    if (currentHour && evaluate(currentHour).status === "good") {
      return null;
    }
    return findLastCautionToGoodTransition(
      hours,
      evaluate,
      getValue,
      maxLimit,
      now
    );
  }

  const dayStart = hours[0]?.time;
  if (!dayStart) return null;

  return findLastCautionToGoodTransition(
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
  if ((counts.too_hot ?? 0) > (counts.too_cold ?? 0)) return "too_hot";
  if ((counts.too_cold ?? 0) > 0) return "too_cold";
  if ((counts.rain_risk ?? 0) > 0) return "rain_risk";
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

  const dayStart = hours[0].time;
  const dayEnd = addMinutes(hours[hours.length - 1].time, 60);

  const crossing = findFirstMaxCrossing(
    hours,
    getValue,
    maxLimit,
    dayStart,
    dayEnd
  );

  if (crossing) {
    const mustStart = addMinutes(crossing, -durationMinutes);
    if (mustStart >= dayStart && (!isToday || mustStart >= now)) {
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
  const evaluate = (hour: HourlyWeather) => isExerciseHourSafe(hour, prefs);
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
    Number(prefs.maxRealFeel)
  );

  return {
    bestWindow,
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
    maxLimit
  );

  return {
    bestWindow,
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
  const isToday = dayIndex === 0;
  const label = getDayLabel(dayIndex, day.date, timezone);

  const exercise = computeExerciseActivityWindows(
    day.hours,
    exercisePrefs.durationMinutes,
    now,
    isToday,
    exercisePrefs
  );

  const dogLimits = getPavementLimits(dogPrefs);
  const dogWalk = computeActivityWindows(
    day.hours,
    dogPrefs.durationMinutes,
    now,
    isToday,
    (h) => isDogWalkHourSafe(h, dogPrefs),
    (h) => h.pavementTemp,
    dogLimits.max
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

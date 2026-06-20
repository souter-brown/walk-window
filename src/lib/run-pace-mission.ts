import { celsiusToFahrenheit } from "@/lib/temperature";
import type { TemperatureUnit } from "@/types/preferences";
import type { HourlyWeather } from "@/types/weather";

export interface RealFeelOffsetResult {
  seconds: number;
  runWalkRecommended: boolean;
}

export interface DewPointAdjustmentResult {
  seconds: number;
  highHumidityWarning: boolean;
  runWalkStronglyRecommended: boolean;
}

export interface RunPaceRecommendationInput {
  baselinePace: string;
  missionDistanceMiles: number;
  startTime: Date;
  durationMinutes: number;
  endHour: HourlyWeather | null;
  currentHour: HourlyWeather | null;
  units: TemperatureUnit;
}

export interface RunPaceRecommendation {
  baselinePaceSeconds: number;
  baselinePaceLabel: string;
  realFeelOffsetSeconds: number;
  dewPointAdjustmentSeconds: number;
  missionPaceSeconds: number | null;
  missionPaceLabel: string;
  estimatedMissionTimeSeconds: number | null;
  estimatedMissionTimeLabel: string;
  endTime: Date;
  endHour: HourlyWeather | null;
  currentHour: HourlyWeather | null;
  endRealFeelF: number | null;
  endDewPointF: number | null;
  currentRealFeelF: number | null;
  currentDewPointF: number | null;
  runWalkRecommended: boolean;
  warnings: string[];
}

const PACE_PATTERN = /^(\d+):([0-5]\d)$/;

export function parsePaceToSeconds(pace: string): number | null {
  const trimmed = pace.trim();
  const match = trimmed.match(PACE_PATTERN);
  if (!match) return null;

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;

  return minutes * 60 + seconds;
}

export function formatSecondsToPace(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatSecondsToDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function toFahrenheitForPace(temp: number, units: TemperatureUnit): number {
  return units === "fahrenheit" ? temp : celsiusToFahrenheit(temp);
}

export function getRealFeelOffset(realFeelF: number): RealFeelOffsetResult {
  if (realFeelF >= 105) {
    return { seconds: 0, runWalkRecommended: true };
  }
  if (realFeelF >= 100) return { seconds: 195, runWalkRecommended: false };
  if (realFeelF >= 95) return { seconds: 135, runWalkRecommended: false };
  if (realFeelF >= 90) return { seconds: 90, runWalkRecommended: false };
  if (realFeelF >= 85) return { seconds: 60, runWalkRecommended: false };
  if (realFeelF >= 80) return { seconds: 45, runWalkRecommended: false };
  if (realFeelF >= 70) return { seconds: 30, runWalkRecommended: false };
  if (realFeelF >= 60) return { seconds: 15, runWalkRecommended: false };
  return { seconds: 0, runWalkRecommended: false };
}

export function getDewPointAdjustment(dewPointF: number): DewPointAdjustmentResult {
  if (dewPointF >= 77) {
    return { seconds: 60, highHumidityWarning: true, runWalkStronglyRecommended: true };
  }
  if (dewPointF >= 75) {
    return { seconds: 45, highHumidityWarning: false, runWalkStronglyRecommended: false };
  }
  if (dewPointF >= 73) {
    return { seconds: 30, highHumidityWarning: false, runWalkStronglyRecommended: false };
  }
  if (dewPointF >= 70) {
    return { seconds: 20, highHumidityWarning: true, runWalkStronglyRecommended: false };
  }
  if (dewPointF >= 65) {
    return { seconds: 10, highHumidityWarning: false, runWalkStronglyRecommended: false };
  }
  if (dewPointF >= 60) {
    return { seconds: 5, highHumidityWarning: false, runWalkStronglyRecommended: false };
  }
  return { seconds: 0, highHumidityWarning: false, runWalkStronglyRecommended: false };
}

export function findClosestHour(
  hours: HourlyWeather[],
  target: Date
): HourlyWeather | null {
  if (hours.length === 0) return null;

  let closest = hours[0];
  let closestDelta = Math.abs(closest.time.getTime() - target.getTime());

  for (const hour of hours.slice(1)) {
    const delta = Math.abs(hour.time.getTime() - target.getTime());
    if (delta < closestDelta) {
      closest = hour;
      closestDelta = delta;
    }
  }

  return closest;
}

export function flattenForecastHours(days: { hours: HourlyWeather[] }[]): HourlyWeather[] {
  return days.flatMap((day) => day.hours);
}

export function addMinutesToDate(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function buildWarnings(
  realFeelF: number | null,
  dewPointF: number | null,
  realFeelOffset: RealFeelOffsetResult,
  dewPointAdjustment: DewPointAdjustmentResult
): string[] {
  const warnings: string[] = [];

  if (realFeelF !== null && realFeelF >= 95) {
    warnings.push("High heat: expect major slowdown.");
  }
  if (dewPointF !== null && dewPointF >= 70) {
    warnings.push("Humidity will reduce cooling efficiency.");
  }
  if (realFeelOffset.runWalkRecommended) {
    warnings.push("Run/Walk recommended. Do not chase pace.");
  }
  if (dewPointAdjustment.runWalkStronglyRecommended) {
    warnings.push("Very high dew point. Cooling is limited. Run/walk is strongly recommended.");
  }

  return warnings;
}

export function formatPaceBreakdown(recommendation: RunPaceRecommendation): string | null {
  if (recommendation.missionPaceSeconds === null) return null;

  const parts = [`${recommendation.baselinePaceLabel} baseline`];
  if (recommendation.realFeelOffsetSeconds > 0) {
    parts.push(`${formatSecondsToPace(recommendation.realFeelOffsetSeconds)} heat`);
  }
  if (recommendation.dewPointAdjustmentSeconds > 0) {
    parts.push(`${formatSecondsToPace(recommendation.dewPointAdjustmentSeconds)} humidity`);
  }

  return `${parts.join(" + ")} → ${formatSecondsToPace(recommendation.missionPaceSeconds)}`;
}

export function getRunPaceRecommendation(
  input: RunPaceRecommendationInput
): RunPaceRecommendation | null {
  const baselinePaceSeconds = parsePaceToSeconds(input.baselinePace);
  if (baselinePaceSeconds === null || input.missionDistanceMiles <= 0) return null;

  const endTime = addMinutesToDate(input.startTime, input.durationMinutes);
  const endHour = input.endHour;
  const currentHour = input.currentHour;

  const endRealFeelF = endHour
    ? toFahrenheitForPace(endHour.apparentTemp, input.units)
    : null;
  const endDewPointF = endHour
    ? toFahrenheitForPace(endHour.dewPoint, input.units)
    : null;
  const currentRealFeelF = currentHour
    ? toFahrenheitForPace(currentHour.apparentTemp, input.units)
    : null;
  const currentDewPointF = currentHour
    ? toFahrenheitForPace(currentHour.dewPoint, input.units)
    : null;

  if (endRealFeelF === null || endDewPointF === null) {
    return {
      baselinePaceSeconds,
      baselinePaceLabel: formatSecondsToPace(baselinePaceSeconds),
      realFeelOffsetSeconds: 0,
      dewPointAdjustmentSeconds: 0,
      missionPaceSeconds: null,
      missionPaceLabel: "Forecast unavailable",
      estimatedMissionTimeSeconds: null,
      estimatedMissionTimeLabel: "—",
      endTime,
      endHour,
      currentHour,
      endRealFeelF,
      endDewPointF,
      currentRealFeelF,
      currentDewPointF,
      runWalkRecommended: false,
      warnings: ["End-of-run forecast is outside the available hourly window."],
    };
  }

  const realFeelOffset = getRealFeelOffset(endRealFeelF);
  const dewPointAdjustment = getDewPointAdjustment(endDewPointF);
  const warnings = buildWarnings(
    endRealFeelF,
    endDewPointF,
    realFeelOffset,
    dewPointAdjustment
  );

  if (realFeelOffset.runWalkRecommended) {
    return {
      baselinePaceSeconds,
      baselinePaceLabel: formatSecondsToPace(baselinePaceSeconds),
      realFeelOffsetSeconds: realFeelOffset.seconds,
      dewPointAdjustmentSeconds: dewPointAdjustment.seconds,
      missionPaceSeconds: null,
      missionPaceLabel: "Run/Walk recommended",
      estimatedMissionTimeSeconds: null,
      estimatedMissionTimeLabel: "—",
      endTime,
      endHour,
      currentHour,
      endRealFeelF,
      endDewPointF,
      currentRealFeelF,
      currentDewPointF,
      runWalkRecommended: true,
      warnings,
    };
  }

  const missionPaceSeconds =
    baselinePaceSeconds + realFeelOffset.seconds + dewPointAdjustment.seconds;
  const estimatedMissionTimeSeconds = Math.round(
    missionPaceSeconds * input.missionDistanceMiles
  );

  return {
    baselinePaceSeconds,
    baselinePaceLabel: formatSecondsToPace(baselinePaceSeconds),
    realFeelOffsetSeconds: realFeelOffset.seconds,
    dewPointAdjustmentSeconds: dewPointAdjustment.seconds,
    missionPaceSeconds,
    missionPaceLabel: `${formatSecondsToPace(missionPaceSeconds)} / mile`,
    estimatedMissionTimeSeconds,
    estimatedMissionTimeLabel: formatSecondsToDuration(estimatedMissionTimeSeconds),
    endTime,
    endHour,
    currentHour,
    endRealFeelF,
    endDewPointF,
    currentRealFeelF,
    currentDewPointF,
    runWalkRecommended: dewPointAdjustment.runWalkStronglyRecommended,
    warnings,
  };
}

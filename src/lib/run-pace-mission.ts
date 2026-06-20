import { celsiusToFahrenheit, fahrenheitToCelsius, formatTemp } from "@/lib/temperature";
import { getChartHour, isSameLocalDay } from "@/lib/time-utils";
import type { TemperatureUnit } from "@/types/preferences";
import type { HourlyWeather } from "@/types/weather";

/** Real Feel below this (°F) uses baseline pace with no heat adjustment. */
export const COOL_REAL_FEEL_THRESHOLD_F = 60;

export function getCoolPaceThresholdLabel(units: TemperatureUnit): string {
  const threshold =
    units === "fahrenheit"
      ? COOL_REAL_FEEL_THRESHOLD_F
      : fahrenheitToCelsius(COOL_REAL_FEEL_THRESHOLD_F);
  return `<${formatTemp(threshold, units)}`;
}

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
  if (realFeelF >= COOL_REAL_FEEL_THRESHOLD_F) return { seconds: 15, runWalkRecommended: false };
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

export interface PaceCalculationSegment {
  id: "baseline" | "heat" | "humidity";
  label: string;
  paceLabel: string;
  share: number;
}

export interface PaceCalculationStep {
  id?: "cool" | "heat" | "humidity" | "mission";
  title: string;
  detail: string;
  offsetLabel: string;
}

export interface PaceAdjustmentBandRow {
  bandLabel: string;
  adjustmentLabel: string;
  isActive: boolean;
}

interface TempBandDefinition {
  minF: number;
  maxExclusiveF: number | null;
}

const REAL_FEEL_BANDS: TempBandDefinition[] = [
  { minF: 105, maxExclusiveF: null },
  { minF: 100, maxExclusiveF: 105 },
  { minF: 95, maxExclusiveF: 100 },
  { minF: 90, maxExclusiveF: 95 },
  { minF: 85, maxExclusiveF: 90 },
  { minF: 80, maxExclusiveF: 85 },
  { minF: 70, maxExclusiveF: 80 },
  { minF: COOL_REAL_FEEL_THRESHOLD_F, maxExclusiveF: 70 },
  { minF: 0, maxExclusiveF: COOL_REAL_FEEL_THRESHOLD_F },
];

const DEW_POINT_BANDS: TempBandDefinition[] = [
  { minF: 77, maxExclusiveF: null },
  { minF: 75, maxExclusiveF: 77 },
  { minF: 73, maxExclusiveF: 75 },
  { minF: 70, maxExclusiveF: 73 },
  { minF: 65, maxExclusiveF: 70 },
  { minF: 60, maxExclusiveF: 65 },
  { minF: 0, maxExclusiveF: 60 },
];

function sampleTempForBand(band: TempBandDefinition): number {
  if (band.minF === 0) return COOL_REAL_FEEL_THRESHOLD_F - 1;
  if (band.maxExclusiveF === null) return band.minF;
  return band.minF + 1;
}

function isTempInBand(valueF: number, band: TempBandDefinition): boolean {
  if (band.maxExclusiveF === null) return valueF >= band.minF;
  if (band.minF === 0) return valueF < band.maxExclusiveF;
  return valueF >= band.minF && valueF < band.maxExclusiveF;
}

function formatTempBandRange(
  band: TempBandDefinition,
  units: TemperatureUnit
): string {
  if (band.maxExclusiveF === null) {
    const display = units === "fahrenheit" ? band.minF : fahrenheitToCelsius(band.minF);
    return `≥${formatTemp(display, units)}`;
  }
  if (band.minF === 0) {
    const display =
      units === "fahrenheit"
        ? band.maxExclusiveF
        : fahrenheitToCelsius(band.maxExclusiveF);
    return `<${formatTemp(display, units)}`;
  }
  const low = units === "fahrenheit" ? band.minF : fahrenheitToCelsius(band.minF);
  const high =
    units === "fahrenheit"
      ? band.maxExclusiveF - 1
      : fahrenheitToCelsius(band.maxExclusiveF - 1);
  return `${formatTemp(low, units)}–${formatTemp(high, units)}`;
}

function formatRealFeelAdjustmentLabel(result: RealFeelOffsetResult): string {
  if (result.runWalkRecommended) return "Run/walk";
  if (result.seconds === 0) return "+0:00/mi";
  return `+${formatSecondsToPace(result.seconds)}/mi`;
}

function formatDewPointAdjustmentLabel(result: DewPointAdjustmentResult): string {
  if (result.runWalkStronglyRecommended) return "+1:00/mi · run/walk";
  if (result.seconds === 0) return "+0:00/mi";
  return `+${formatSecondsToPace(result.seconds)}/mi`;
}

export function getRealFeelAdjustmentBandRows(
  units: TemperatureUnit,
  activeRealFeelF: number | null
): PaceAdjustmentBandRow[] {
  return REAL_FEEL_BANDS.map((band) => {
    const result = getRealFeelOffset(sampleTempForBand(band));
    return {
      bandLabel: formatTempBandRange(band, units),
      adjustmentLabel: formatRealFeelAdjustmentLabel(result),
      isActive: activeRealFeelF !== null && isTempInBand(activeRealFeelF, band),
    };
  });
}

export function getDewPointAdjustmentBandRows(
  units: TemperatureUnit,
  activeDewPointF: number | null
): PaceAdjustmentBandRow[] {
  return DEW_POINT_BANDS.map((band) => {
    const result = getDewPointAdjustment(sampleTempForBand(band));
    return {
      bandLabel: formatTempBandRange(band, units),
      adjustmentLabel: formatDewPointAdjustmentLabel(result),
      isActive: activeDewPointF !== null && isTempInBand(activeDewPointF, band),
    };
  });
}

export interface PaceCalculationExplanation {
  weatherCheckTime: Date;
  runWalkRecommended: boolean;
  unavailable: boolean;
  steps: PaceCalculationStep[];
  segments: PaceCalculationSegment[];
  totalPaceLabel: string;
  summary: string;
}

export function describeRealFeelBand(realFeelF: number): string {
  if (realFeelF >= 105) return "≥105°F";
  if (realFeelF >= 100) return "100–104°F";
  if (realFeelF >= 95) return "95–99°F";
  if (realFeelF >= 90) return "90–94°F";
  if (realFeelF >= 85) return "85–89°F";
  if (realFeelF >= 80) return "80–84°F";
  if (realFeelF >= 70) return "70–79°F";
  if (realFeelF >= 60) return "60–69°F";
  return "below 60°F";
}

export function describeDewPointBand(dewPointF: number): string {
  if (dewPointF >= 77) return "≥77°F";
  if (dewPointF >= 75) return "75–76°F";
  if (dewPointF >= 73) return "73–74°F";
  if (dewPointF >= 70) return "70–72°F";
  if (dewPointF >= 65) return "65–69°F";
  if (dewPointF >= 60) return "60–64°F";
  return "below 60°F";
}

export function getPaceCalculationExplanation(
  recommendation: RunPaceRecommendation,
  units: TemperatureUnit
): PaceCalculationExplanation {
  const formatDisplayTemp = (tempF: number | null) => {
    if (tempF === null) return "—";
    const displayValue = units === "fahrenheit" ? tempF : fahrenheitToCelsius(tempF);
    return formatTemp(displayValue, units);
  };

  if (recommendation.endRealFeelF === null || recommendation.endDewPointF === null) {
    return {
      weatherCheckTime: recommendation.endTime,
      runWalkRecommended: false,
      unavailable: true,
      steps: [],
      segments: [],
      totalPaceLabel: recommendation.missionPaceLabel,
      summary: "End-of-run forecast is outside the loaded hourly window.",
    };
  }

  const realFeelStep: PaceCalculationStep = {
    id: "heat",
    title: "Heat adjustment",
    detail: `Real Feel ${formatDisplayTemp(recommendation.endRealFeelF)} at weather-check (${describeRealFeelBand(recommendation.endRealFeelF)} band)`,
    offsetLabel:
      recommendation.runWalkRecommended && recommendation.realFeelOffsetSeconds === 0
        ? "Run/walk"
        : `+${formatSecondsToPace(recommendation.realFeelOffsetSeconds)}/mi`,
  };

  const dewPointStep: PaceCalculationStep = {
    id: "humidity",
    title: "Humidity adjustment",
    detail: `Dew point ${formatDisplayTemp(recommendation.endDewPointF)} at weather-check (${describeDewPointBand(recommendation.endDewPointF)} band)`,
    offsetLabel: `+${formatSecondsToPace(recommendation.dewPointAdjustmentSeconds)}/mi`,
  };

  if (recommendation.runWalkRecommended) {
    return {
      weatherCheckTime: recommendation.endTime,
      runWalkRecommended: true,
      unavailable: false,
      steps: [realFeelStep, dewPointStep],
      segments: [],
      totalPaceLabel: recommendation.missionPaceLabel,
      summary:
        "Real Feel at weather-check is ≥105°F, so pace targets are replaced with run/walk guidance.",
    };
  }

  const missionPaceSeconds = recommendation.missionPaceSeconds ?? recommendation.baselinePaceSeconds;
  const segments: PaceCalculationSegment[] = [
    {
      id: "baseline",
      label: "Baseline",
      paceLabel: recommendation.baselinePaceLabel,
      share: recommendation.baselinePaceSeconds / missionPaceSeconds,
    },
  ];

  if (recommendation.realFeelOffsetSeconds > 0) {
    segments.push({
      id: "heat",
      label: "Heat",
      paceLabel: formatSecondsToPace(recommendation.realFeelOffsetSeconds),
      share: recommendation.realFeelOffsetSeconds / missionPaceSeconds,
    });
  }

  if (recommendation.dewPointAdjustmentSeconds > 0) {
    segments.push({
      id: "humidity",
      label: "Humidity",
      paceLabel: formatSecondsToPace(recommendation.dewPointAdjustmentSeconds),
      share: recommendation.dewPointAdjustmentSeconds / missionPaceSeconds,
    });
  }

  const steps: PaceCalculationStep[] = [
    {
      id: "cool",
      title: "Cool pace",
      detail: `Pace when Real Feel is below ${getCoolPaceThresholdLabel(units)} (${recommendation.baselinePaceLabel}/mi)`,
      offsetLabel: recommendation.baselinePaceLabel,
    },
    realFeelStep,
    dewPointStep,
    {
      id: "mission",
      title: "Mission pace",
      detail: "Add the adjustments per mile",
      offsetLabel: formatSecondsToPace(missionPaceSeconds),
    },
  ];

  return {
    weatherCheckTime: recommendation.endTime,
    runWalkRecommended: false,
    unavailable: false,
    steps,
    segments,
    totalPaceLabel: formatSecondsToPace(missionPaceSeconds),
    summary: `${recommendation.baselinePaceLabel} + ${formatSecondsToPace(recommendation.realFeelOffsetSeconds)} heat + ${formatSecondsToPace(recommendation.dewPointAdjustmentSeconds)} humidity = ${formatSecondsToPace(missionPaceSeconds)}/mi`,
  };
}

export interface StartTimePaceChartPoint {
  timeKey: number;
  chartHour: number;
  timeLabel: string;
  paceMinutes: number | null;
  paceLabel: string;
  isSelectedStart: boolean;
  runWalkRecommended: boolean;
}

export function buildStartTimePaceChartPoints(input: {
  hours: HourlyWeather[];
  selectedStartTime: Date;
  durationMinutes: number;
  baselinePace: string;
  missionDistanceMiles: number;
  timezone: string;
  units: TemperatureUnit;
}): StartTimePaceChartPoint[] {
  const baselinePaceSeconds = parsePaceToSeconds(input.baselinePace);
  if (baselinePaceSeconds === null || input.missionDistanceMiles <= 0) return [];

  const selectedStartMs = input.selectedStartTime.getTime();
  const dayHours = input.hours.filter((hour) =>
    isSameLocalDay(hour.time, input.selectedStartTime, input.timezone)
  );

  return dayHours.map((hour) => {
    const startTime = hour.time;
    const endTime = addMinutesToDate(startTime, input.durationMinutes);
    const endHour = findClosestHour(input.hours, endTime);
    const recommendation = getRunPaceRecommendation({
      baselinePace: input.baselinePace,
      missionDistanceMiles: input.missionDistanceMiles,
      startTime,
      durationMinutes: input.durationMinutes,
      endHour,
      currentHour: null,
      units: input.units,
    });

    const paceSeconds = recommendation?.missionPaceSeconds ?? null;
    const isSelectedStart =
      Math.abs(startTime.getTime() - selectedStartMs) < 30 * 60_000;

    return {
      timeKey: startTime.getTime(),
      chartHour: getChartHour(startTime, input.timezone),
      timeLabel: formatChartTimeLabel(startTime, input.timezone),
      paceMinutes: paceSeconds === null ? null : paceSeconds / 60,
      paceLabel: recommendation?.missionPaceLabel ?? "—",
      isSelectedStart,
      runWalkRecommended: recommendation?.runWalkRecommended ?? false,
    };
  });
}

function formatChartTimeLabel(time: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(time);
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

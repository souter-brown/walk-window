import type {
  DogWalkPreferences,
  ExercisePreferences,
  TemperatureUnit,
} from "@/types/preferences";
import { getPavementLimits } from "@/lib/window-calculation";
import { formatTemp } from "@/lib/temperature";
import type { ChartActivityMode } from "@/components/ChartActivitySelector";

export interface ThresholdLine {
  value: number;
  type: "min" | "max";
  label: string;
}

interface TempReading {
  apparentTemp: number;
  pavementTemp: number;
}

/**
 * Pick the min or max preference line that is closest to today's range.
 * Hot days surface the max limit; cold days surface the min limit.
 */
export function getRelevantThresholdLine(
  readings: TempReading[],
  activityMode: ChartActivityMode,
  exercisePrefs: ExercisePreferences,
  dogPrefs: DogWalkPreferences,
  units: TemperatureUnit = "fahrenheit"
): ThresholdLine | null {
  if (readings.length === 0) return null;

  if (activityMode === "exercise") {
    const temps = readings.map((r) => r.apparentTemp);
    const dayLow = Math.min(...temps);
    const dayHigh = Math.max(...temps);
    const minLimit = exercisePrefs.minRealFeel;
    const maxLimit = exercisePrefs.maxRealFeel;

    const lowDistance = Math.abs(dayLow - minLimit);
    const highDistance = Math.abs(dayHigh - maxLimit);

    if (highDistance <= lowDistance) {
      return {
        value: maxLimit,
        type: "max",
        label: `Max real feel ${formatTemp(maxLimit, units)}`,
      };
    }

    return {
      value: minLimit,
      type: "min",
      label: `Min real feel ${formatTemp(minLimit, units)}`,
    };
  }

  const temps = readings.map((r) => r.pavementTemp);
  const dayLow = Math.min(...temps);
  const dayHigh = Math.max(...temps);
  const limits = getPavementLimits(dogPrefs);

  const lowDistance = Math.abs(dayLow - limits.min);
  const highDistance = Math.abs(dayHigh - limits.max);

  if (highDistance <= lowDistance) {
    return {
      value: limits.max,
      type: "max",
      label: `Max pavement est. ${formatTemp(limits.max, units)}`,
    };
  }

  return {
    value: limits.min,
    type: "min",
    label: `Min pavement est. ${formatTemp(limits.min, units)}`,
  };
}

export function getTempAxisDomain(
  chartTemps: number[],
  thresholdLine: ThresholdLine | null
): { min: number; max: number } {
  const values = [...chartTemps];
  if (thresholdLine) values.push(thresholdLine.value);

  if (values.length === 0) return { min: 0, max: 100 };

  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max(4, Math.round((max - min) * 0.1));

  return {
    min: Math.floor(min - padding),
    max: Math.ceil(max + padding),
  };
}

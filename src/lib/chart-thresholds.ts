import type {
  DogWalkPreferences,
  ExercisePreferences,
} from "@/types/preferences";
import { getMaxPavementLimit } from "@/lib/window-calculation";
import type { ChartActivityMode } from "@/components/ChartActivitySelector";

export interface ThresholdLine {
  value: number;
  type: "max";
  label: string;
}

interface TempReading {
  apparentTemp: number;
  pavementTemp: number;
}

export function getRelevantThresholdLine(
  readings: TempReading[],
  activityMode: ChartActivityMode,
  exercisePrefs: ExercisePreferences,
  dogPrefs: DogWalkPreferences
): ThresholdLine | null {
  if (readings.length === 0) return null;

  if (activityMode === "exercise") {
    const maxLimit = exercisePrefs.maxRealFeel;
    return {
      value: maxLimit,
      type: "max",
      label: "Max real feel",
    };
  }

  const maxLimit = getMaxPavementLimit(dogPrefs);
  return {
    value: maxLimit,
    type: "max",
    label: "Max pavement est.",
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

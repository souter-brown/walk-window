"use client";

import { CompactNumberInput } from "@/components/InlinePreferenceControls";
import type { DogWalkPreferences, ExercisePreferences } from "@/types/preferences";

export type ChartActivityMode = "exercise" | "dogWalk";

interface ChartActivitySelectorProps {
  value: ChartActivityMode;
  onChange: (value: ChartActivityMode) => void;
  exercise: ExercisePreferences;
  dogWalk: DogWalkPreferences;
  onExerciseChange: (partial: Partial<ExercisePreferences>) => void;
  onDogWalkChange: (partial: Partial<DogWalkPreferences>) => void;
}

const options: { value: ChartActivityMode; label: string }[] = [
  { value: "exercise", label: "Exercise" },
  { value: "dogWalk", label: "Dog walk" },
];

export function ChartActivitySelector({
  value,
  onChange,
  exercise,
  dogWalk,
  onExerciseChange,
  onDogWalkChange,
}: ChartActivitySelectorProps) {
  return (
    <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <legend className="sr-only">Chart activity and duration</legend>
      {options.map((option) => {
        const id = `chart-activity-${option.value}`;
        const isExercise = option.value === "exercise";

        return (
          <div key={option.value} className="flex flex-wrap items-center gap-2">
            <label
              htmlFor={id}
              className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
            >
              <input
                id={id}
                type="radio"
                name="chart-activity"
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                className="h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              {option.label}
            </label>
            <CompactNumberInput
              value={isExercise ? exercise.durationMinutes : dogWalk.durationMinutes}
              onChange={(v) =>
                isExercise
                  ? onExerciseChange({ durationMinutes: v })
                  : onDogWalkChange({ durationMinutes: v })
              }
              min={5}
              max={isExercise ? 180 : 120}
              suffix="min"
              aria-label={
                isExercise ? "Exercise duration in minutes" : "Dog walk duration in minutes"
              }
            />
          </div>
        );
      })}
    </fieldset>
  );
}

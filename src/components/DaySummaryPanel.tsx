"use client";

import { formatTime } from "@/lib/time-utils";
import {
  getMobileSafeWindowLines,
  shouldShowMobileMustStartBy,
} from "@/lib/window-calculation";
import { StepperNumberInput } from "@/components/InlinePreferenceControls";
import { StatusBadge } from "@/components/StatusBadge";
import type { DogWalkPreferences, ExercisePreferences } from "@/types/preferences";
import type { ActivityWindowResult, HourlyWeather } from "@/types/weather";

interface DaySummaryPanelProps {
  timezone: string;
  now: Date;
  isToday: boolean;
  hours: HourlyWeather[];
  exerciseDurationMinutes: number;
  dogWalkDurationMinutes: number;
  exercisePrefs: ExercisePreferences;
  dogWalkPrefs: DogWalkPreferences;
  onExerciseDurationChange: (minutes: number) => void;
  onDogWalkDurationChange: (minutes: number) => void;
  exercise: ActivityWindowResult;
  dogWalk: ActivityWindowResult;
}

function ActivitySummary({
  title,
  result,
  hours,
  durationMinutes,
  durationMax,
  onDurationChange,
  durationLabel,
  getValue,
  maxLimit,
  timezone,
  now,
  isToday,
}: {
  title: string;
  result: ActivityWindowResult;
  hours: HourlyWeather[];
  durationMinutes: number;
  durationMax: number;
  onDurationChange: (minutes: number) => void;
  durationLabel: string;
  getValue: (hour: HourlyWeather) => number;
  maxLimit: number;
  timezone: string;
  now: Date;
  isToday: boolean;
}) {
  const windowLines = getMobileSafeWindowLines(
    result,
    hours,
    durationMinutes,
    getValue,
    maxLimit,
    now,
    timezone,
    isToday
  );
  const showMustStartBy = shouldShowMobileMustStartBy(result, now, isToday);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <StatusBadge status={result.status} size="sm" />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-600">Duration</span>
        <StepperNumberInput
          value={durationMinutes}
          onChange={onDurationChange}
          min={5}
          max={durationMax}
          suffix="min"
          aria-label={durationLabel}
        />
      </div>
      <dl className="mt-2 space-y-1 text-xs text-slate-600">
        <div className="flex justify-between gap-3">
          <dt className="shrink-0">Safe windows</dt>
          <dd className="min-w-0 text-right font-medium text-slate-800">
            {windowLines.length === 0 ? (
              "None today"
            ) : (
              <ul className="space-y-0.5">
                {windowLines.map((line) => (
                  <li
                    key={line.text}
                    className={line.isPrimary ? "font-semibold text-slate-900" : undefined}
                  >
                    {line.text}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
        {showMustStartBy && result.mustStartBy && (
          <div className="flex justify-between gap-3">
            <dt>Must start by</dt>
            <dd className="text-right font-medium text-slate-800">
              {formatTime(result.mustStartBy, timezone)}
            </dd>
          </div>
        )}
        {result.waitUntilAfter && (
          <div className="flex justify-between gap-3">
            <dt>Wait until</dt>
            <dd className="text-right font-medium text-slate-800">
              {formatTime(result.waitUntilAfter, timezone)}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export function DaySummaryPanel({
  timezone,
  now,
  isToday,
  hours,
  exerciseDurationMinutes,
  dogWalkDurationMinutes,
  exercisePrefs,
  dogWalkPrefs,
  onExerciseDurationChange,
  onDogWalkDurationChange,
  exercise,
  dogWalk,
}: DaySummaryPanelProps) {
  return (
    <div className="md:hidden">
      <div className="space-y-2">
        <ActivitySummary
          title="Exercise"
          result={exercise}
          hours={hours}
          durationMinutes={exerciseDurationMinutes}
          durationMax={180}
          onDurationChange={onExerciseDurationChange}
          durationLabel="Exercise duration in minutes"
          getValue={(hour) => hour.apparentTemp}
          maxLimit={Number(exercisePrefs.maxRealFeel)}
          timezone={timezone}
          now={now}
          isToday={isToday}
        />
        <ActivitySummary
          title="Dog walk"
          result={dogWalk}
          hours={hours}
          durationMinutes={dogWalkDurationMinutes}
          durationMax={120}
          onDurationChange={onDogWalkDurationChange}
          durationLabel="Dog walk duration in minutes"
          getValue={(hour) => hour.pavementTemp}
          maxLimit={Number(dogWalkPrefs.maxPavement)}
          timezone={timezone}
          now={now}
          isToday={isToday}
        />
      </div>
    </div>
  );
}

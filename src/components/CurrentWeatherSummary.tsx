"use client";

import { formatTime } from "@/lib/time-utils";
import { formatTemp } from "@/lib/temperature";
import { CompactMaxInput } from "@/components/InlinePreferenceControls";
import { useHydrated } from "@/hooks/useHydrated";
import { StatusBadge } from "@/components/StatusBadge";
import type { HourlyWeather, SafetyStatus, ActivityWindowResult } from "@/types/weather";
import { getActivityHeaderTiming } from "@/lib/window-calculation";
import type {
  DogWalkPreferences,
  ExercisePreferences,
  TemperatureUnit,
} from "@/types/preferences";

interface CurrentWeatherSummaryProps {
  current: HourlyWeather | null;
  timezone?: string;
  now: Date;
  units: TemperatureUnit;
  loading?: boolean;
  exerciseStatus?: SafetyStatus | null;
  dogWalkStatus?: SafetyStatus | null;
  exerciseResult?: ActivityWindowResult | null;
  dogWalkResult?: ActivityWindowResult | null;
  exercise: ExercisePreferences;
  dogWalk: DogWalkPreferences;
  onExerciseChange: (partial: Partial<ExercisePreferences>) => void;
  onDogWalkChange: (partial: Partial<DogWalkPreferences>) => void;
}

function ActivityStatBlock({
  label,
  badge,
  timing,
  timezone,
  hydrated,
}: {
  label: string;
  badge: React.ReactNode;
  timing: ReturnType<typeof getActivityHeaderTiming>;
  timezone?: string;
  hydrated: boolean;
}) {
  const timingLabel = timing?.kind === "waitUntil" ? "Wait until" : "Start by";

  return (
    <div className="flex h-full min-w-0 flex-col items-center justify-between text-center">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="flex flex-col items-center">{badge}</div>
      <div className="mt-1.5 flex flex-col items-center gap-0.5 text-[10px] text-slate-600 sm:mt-2 sm:text-xs">
        <span>{timingLabel}:</span>
        <span className="font-medium text-slate-800" suppressHydrationWarning>
          {hydrated && timing ? formatTime(timing.time, timezone) : "Anytime"}
        </span>
      </div>
    </div>
  );
}

function StatBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-0.5 flex flex-col items-center">{children}</div>
    </div>
  );
}

export function CurrentWeatherSummary({
  current,
  timezone,
  now,
  units,
  loading = false,
  exerciseStatus,
  dogWalkStatus,
  exerciseResult,
  dogWalkResult,
  exercise,
  dogWalk,
  onExerciseChange,
  onDogWalkChange,
}: CurrentWeatherSummaryProps) {
  const hydrated = useHydrated();
  const timeLabel =
    timezone && timezone !== Intl.DateTimeFormat().resolvedOptions().timeZone
      ? "Local time"
      : "Time";
  const tempLimit = units === "celsius" ? 55 : 130;
  const exerciseTiming = exerciseResult
    ? getActivityHeaderTiming(exerciseResult, now, exercise.durationMinutes)
    : null;
  const dogWalkTiming = dogWalkResult
    ? getActivityHeaderTiming(dogWalkResult, now, dogWalk.durationMinutes)
    : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-sky-50 to-white px-4 py-3 shadow-sm sm:px-5">
      {loading ? (
        <p className="text-sm text-slate-500">Loading weather…</p>
      ) : !current ? (
        <p className="text-sm text-slate-500">Enter a city or ZIP code to see conditions.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6 lg:items-stretch">
          <StatBlock label="Air">
            <p className="text-2xl font-bold text-slate-900 sm:text-3xl">
              {formatTemp(current.airTemp, units)}
            </p>
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">
              Humidity {Math.round(current.humidity)}%
            </p>
          </StatBlock>
          <StatBlock label={timeLabel}>
            <p className="text-xl font-semibold text-slate-800 sm:text-2xl" suppressHydrationWarning>
              {hydrated ? formatTime(now, timezone) : "—"}
            </p>
          </StatBlock>
          {exerciseStatus && (
            <ActivityStatBlock
              label="Exercise"
              badge={<StatusBadge status={exerciseStatus} size="sm" />}
              timing={exerciseTiming}
              timezone={timezone}
              hydrated={hydrated}
            />
          )}
          {dogWalkStatus && (
            <ActivityStatBlock
              label="Dog walk"
              badge={<StatusBadge status={dogWalkStatus} size="sm" />}
              timing={dogWalkTiming}
              timezone={timezone}
              hydrated={hydrated}
            />
          )}
          <StatBlock label="Real feel">
            <p className="text-xl font-semibold text-slate-800 sm:text-2xl">
              {formatTemp(current.apparentTemp, units)}
            </p>
            <CompactMaxInput
              value={exercise.maxRealFeel}
              onChange={(v) => onExerciseChange({ maxRealFeel: v })}
              units={units}
              maxLimit={tempLimit}
              aria-label="Maximum real feel"
            />
          </StatBlock>
          <StatBlock label="Pavement Estimate">
            <p className="text-xl font-semibold text-slate-800 sm:text-2xl">
              {formatTemp(current.pavementTemp, units)}
            </p>
            <CompactMaxInput
              value={dogWalk.maxPavement}
              onChange={(v) => onDogWalkChange({ maxPavement: v })}
              units={units}
              maxLimit={tempLimit}
              aria-label="Maximum pavement estimate"
            />
          </StatBlock>
        </div>
      )}
    </div>
  );
}

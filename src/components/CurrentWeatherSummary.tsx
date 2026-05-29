"use client";

import { formatTime } from "@/lib/time-utils";
import { formatTemp } from "@/lib/temperature";
import { useHydrated } from "@/hooks/useHydrated";
import { StatusBadge } from "@/components/StatusBadge";
import type { HourlyWeather, SafetyStatus } from "@/types/weather";
import type { TemperatureUnit } from "@/types/preferences";

interface CurrentWeatherSummaryProps {
  current: HourlyWeather | null;
  timezone?: string;
  now: Date;
  units: TemperatureUnit;
  loading?: boolean;
  exerciseStatus?: SafetyStatus | null;
  dogWalkStatus?: SafetyStatus | null;
}

function StatBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-0.5">{children}</div>
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
}: CurrentWeatherSummaryProps) {
  const hydrated = useHydrated();
  const timeLabel =
    timezone && timezone !== Intl.DateTimeFormat().resolvedOptions().timeZone
      ? "Local time"
      : "Time";

  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-sky-50 to-white px-4 py-3 shadow-sm sm:px-5">
      {loading ? (
        <p className="text-sm text-slate-500">Loading weather…</p>
      ) : !current ? (
        <p className="text-sm text-slate-500">Enter a city or ZIP code to see conditions.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 lg:grid-cols-8 lg:items-end">
          <StatBlock label="Air">
            <p className="text-2xl font-bold text-slate-900 sm:text-3xl">
              {formatTemp(current.airTemp, units)}
            </p>
          </StatBlock>
          <StatBlock label="Real feel">
            <p className="text-xl font-semibold text-slate-800 sm:text-2xl">
              {formatTemp(current.apparentTemp, units)}
            </p>
          </StatBlock>
          <StatBlock label="Humidity">
            <p className="text-lg font-semibold text-slate-800">{Math.round(current.humidity)}%</p>
          </StatBlock>
          <StatBlock label="Pavement est.">
            <p className="text-lg font-semibold text-slate-800">
              {formatTemp(current.pavementTemp, units)}
            </p>
          </StatBlock>
          <StatBlock label="Rain chance">
            <p className="text-lg font-semibold text-slate-800">
              {Math.round(current.precipitationProbability)}%
            </p>
          </StatBlock>
          <StatBlock label={timeLabel}>
            <p className="text-lg font-semibold text-slate-900" suppressHydrationWarning>
              {hydrated ? formatTime(now, timezone) : "—"}
            </p>
          </StatBlock>
          {exerciseStatus && (
            <StatBlock label="Exercise">
              <StatusBadge status={exerciseStatus} size="sm" />
            </StatBlock>
          )}
          {dogWalkStatus && (
            <StatBlock label="Dog walk">
              <StatusBadge status={dogWalkStatus} size="sm" />
            </StatBlock>
          )}
        </div>
      )}
    </div>
  );
}

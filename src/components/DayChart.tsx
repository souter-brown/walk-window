"use client";

import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Cell,
} from "recharts";
import { useHydrated } from "@/hooks/useHydrated";
import { useMemo } from "react";
import { formatHourLabel, formatTime, getChartHour, isSameLocalDay } from "@/lib/time-utils";
import {
  isExerciseHourSafe,
  isDogWalkHourSafe,
} from "@/lib/window-calculation";
import {
  getRelevantThresholdLine,
  getTempAxisDomain,
} from "@/lib/chart-thresholds";
import { formatTemp } from "@/lib/temperature";
import type { DayForecast, ActivityWindowResult, HourlyWeather } from "@/types/weather";
import type {
  ExercisePreferences,
  DogWalkPreferences,
  TemperatureUnit,
} from "@/types/preferences";
import type { ChartActivityMode } from "@/components/ChartActivitySelector";

interface ChartPoint {
  hour: number;
  hourLabel: string;
  airTemp: number;
  apparentTemp: number;
  pavementTemp: number;
  humidity: number;
  precipProb: number;
  exerciseSafe: boolean;
  dogSafe: boolean;
  exerciseStatus: string;
  dogStatus: string;
}

interface DayChartProps {
  day: DayForecast;
  label: string;
  timezone: string;
  hideTitle?: boolean;
  fillViewport?: boolean;
  showCurrentTime?: boolean;
  now: Date;
  activityMode: ChartActivityMode;
  exerciseResult: ActivityWindowResult;
  dogWalkResult: ActivityWindowResult;
  exercisePrefs: ExercisePreferences;
  dogPrefs: DogWalkPreferences;
  units: TemperatureUnit;
}

const axisProps = {
  tick: { fontSize: 12, fill: "#64748b" },
  axisLine: { stroke: "#cbd5e1" },
};

const HOUR_AXIS_TICKS = [0, 6, 12, 18, 24];

function formatChartHourTick(hour: number): string {
  return hour === 24 ? "Midnight" : formatHourLabel(hour);
}

const hourXAxisProps = {
  dataKey: "hour" as const,
  type: "number" as const,
  domain: [0, 24] as [number, number],
  allowDataOverflow: true,
  ticks: HOUR_AXIS_TICKS,
  tickFormatter: formatChartHourTick,
  tick: axisProps.tick,
  axisLine: axisProps.axisLine,
};

function getCurrentHour(now: Date, timezone: string): number {
  return getChartHour(now, timezone);
}

function normalizeHour(hour: number): number {
  return hour === 24 ? 0 : hour;
}

function buildChartData(
  hours: HourlyWeather[],
  exercisePrefs: ExercisePreferences,
  dogPrefs: DogWalkPreferences
): ChartPoint[] {
  const points = [...hours]
    .sort((a, b) => normalizeHour(a.hour) - normalizeHour(b.hour))
    .map((hour) => {
      const exercise = isExerciseHourSafe(hour, exercisePrefs);
      const dog = isDogWalkHourSafe(hour, dogPrefs);
      const clockHour = normalizeHour(hour.hour);
      return {
        hour: clockHour,
        hourLabel: formatHourLabel(clockHour),
        airTemp: Math.round(hour.airTemp),
        apparentTemp: Math.round(hour.apparentTemp),
        pavementTemp: Math.round(hour.pavementTemp),
        humidity: Math.round(hour.humidity),
        precipProb: Math.round(hour.precipitationProbability),
        exerciseSafe: exercise.safe,
        dogSafe: dog.safe,
        exerciseStatus: exercise.status,
        dogStatus: dog.status,
      };
    });

  return points;
}

function withMidnightAnchor(points: ChartPoint[]): ChartPoint[] {
  const last = points[points.length - 1];
  if (last?.hour !== 23) return points;
  return [
    ...points,
    {
      ...last,
      hour: 24,
      hourLabel: "Midnight",
    },
  ];
}

const statusColors: Record<string, string> = {
  good: "#d1fae5",
  caution: "#fde047",
  too_hot: "#f97316",
  too_cold: "#e0f2fe",
  rain_risk: "#dbeafe",
  unsafe: "#ffe4e6",
};

function TempTooltip({
  active,
  payload,
  units,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
  units: TemperatureUnit;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg">
      <p className="font-semibold text-slate-900">{d.hourLabel}</p>
      <p>Air: {formatTemp(d.airTemp, units)}</p>
      <p>Real feel: {formatTemp(d.apparentTemp, units)}</p>
      <p>Pavement est.: {formatTemp(d.pavementTemp, units)}</p>
    </div>
  );
}

function MoistureTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg">
      <p className="font-semibold text-slate-900">{d.hourLabel}</p>
      <p>Humidity: {d.humidity}%</p>
      <p>Rain chance: {d.precipProb}%</p>
    </div>
  );
}

function ChartPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-slate-400">
      Loading chart…
    </div>
  );
}

const MARKER_COLLISION_HOURS = 2;
const MARKER_LABEL_LINE_HEIGHT = 14;

interface ChartTimeMarker {
  id: string;
  hour: number;
  text: string;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  fill: string;
  fontSize: number;
}

function buildChartTimeMarkers({
  sunrise,
  sunset,
  timezone,
  showNow,
  now,
}: {
  sunrise: Date | null;
  sunset: Date | null;
  timezone: string;
  showNow: boolean;
  now: Date;
}): ChartTimeMarker[] {
  const markers: ChartTimeMarker[] = [];

  if (sunrise) {
    markers.push({
      id: "sunrise",
      hour: getChartHour(sunrise, timezone),
      text: "Sunrise",
      stroke: "#ca8a04",
      strokeWidth: 1.5,
      strokeDasharray: "2 4",
      fill: "#a16207",
      fontSize: 11,
    });
  }

  if (sunset) {
    markers.push({
      id: "sunset",
      hour: getChartHour(sunset, timezone),
      text: "Sunset",
      stroke: "#ca8a04",
      strokeWidth: 1.5,
      strokeDasharray: "2 4",
      fill: "#a16207",
      fontSize: 11,
    });
  }

  if (showNow) {
    markers.push({
      id: "now",
      hour: getChartHour(now, timezone),
      text: "Now",
      stroke: "#1e293b",
      strokeWidth: 2,
      strokeDasharray: "3 3",
      fill: "#1e293b",
      fontSize: 12,
    });
  }

  return markers.sort((a, b) => a.hour - b.hour);
}

function assignChartMarkerLabelOffsets(
  markers: ChartTimeMarker[]
): Map<string, number> {
  const offsets = new Map<string, number>();
  let tier = 0;
  let previousHour = Number.NEGATIVE_INFINITY;

  for (const marker of markers) {
    if (marker.hour - previousHour < MARKER_COLLISION_HOURS) {
      tier += 1;
    } else {
      tier = 0;
    }
    offsets.set(marker.id, tier * MARKER_LABEL_LINE_HEIGHT);
    previousHour = marker.hour;
  }

  return offsets;
}

function getChartMarkerTopMargin(offsets: Map<string, number>): number {
  const maxOffset = Math.max(0, ...offsets.values());
  return 24 + maxOffset;
}

function ChartTimeReferenceLines({
  markers,
  offsets,
  yAxisId,
}: {
  markers: ChartTimeMarker[];
  offsets: Map<string, number>;
  yAxisId: string;
}) {
  return (
    <>
      {markers.map((marker) => (
        <ReferenceLine
          key={marker.id}
          yAxisId={yAxisId}
          x={marker.hour}
          stroke={marker.stroke}
          strokeWidth={marker.strokeWidth}
          strokeDasharray={marker.strokeDasharray}
          label={{
            value: marker.text,
            position: "top",
            offset: offsets.get(marker.id) ?? 0,
            fill: marker.fill,
            fontSize: marker.fontSize,
          }}
        />
      ))}
    </>
  );
}

function ActivityWindowReferenceLines({
  mustStartBy,
  waitUntilAfter,
  dayDate,
  timezone,
  yAxisId,
}: {
  mustStartBy: Date | null;
  waitUntilAfter: Date | null;
  dayDate: Date;
  timezone: string;
  yAxisId: string;
}) {
  const lines = [
    {
      time: mustStartBy,
      prefix: "Must start",
      stroke: "#7c3aed",
      position: "insideTopRight" as const,
    },
    {
      time: waitUntilAfter,
      prefix: "Wait until",
      stroke: "#db2777",
      position: "insideTopLeft" as const,
    },
  ].filter(
    (line): line is typeof line & { time: Date } =>
      line.time !== null && isSameLocalDay(line.time, dayDate, timezone)
  );

  return (
    <>
      {lines.map(({ time, prefix, stroke, position }) => (
        <ReferenceLine
          key={prefix}
          yAxisId={yAxisId}
          x={getChartHour(time, timezone)}
          stroke={stroke}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          label={{
            value: `${prefix}: ${formatTime(time, timezone)}`,
            position,
            fill: stroke,
            fontSize: 11,
          }}
        />
      ))}
    </>
  );
}

export function DayChart({
  day,
  label,
  timezone,
  hideTitle = false,
  fillViewport = false,
  showCurrentTime,
  now,
  activityMode,
  exerciseResult,
  dogWalkResult,
  exercisePrefs,
  dogPrefs,
  units,
}: DayChartProps) {
  const hydrated = useHydrated();
  const hourlyPoints = buildChartData(day.hours, exercisePrefs, dogPrefs);
  const lineData = withMidnightAnchor(hourlyPoints);
  const windowResult =
    activityMode === "exercise" ? exerciseResult : dogWalkResult;
  const thresholdLine = getRelevantThresholdLine(
    hourlyPoints,
    activityMode,
    exercisePrefs,
    dogPrefs,
    units
  );
  const chartTemps = lineData.flatMap((d) => [d.airTemp, d.apparentTemp, d.pavementTemp]);
  const { min: minTemp, max: maxTemp } = getTempAxisDomain(
    chartTemps,
    thresholdLine
  );
  const statusKey = activityMode === "exercise" ? "exerciseStatus" : "dogStatus";
  const activityLabel = activityMode === "exercise" ? "Exercise" : "Dog walk";
  const thresholdStroke =
    thresholdLine?.type === "max" ? "#ea580c" : "#0284c7";
  const currentHour = getCurrentHour(now, timezone);
  const tempTimeMarkers = useMemo(
    () =>
      buildChartTimeMarkers({
        sunrise: day.sunrise,
        sunset: day.sunset,
        timezone,
        showNow: !!showCurrentTime,
        now,
      }),
    [day.sunrise, day.sunset, timezone, showCurrentTime, now]
  );
  const sunTimeMarkers = useMemo(
    () =>
      buildChartTimeMarkers({
        sunrise: day.sunrise,
        sunset: day.sunset,
        timezone,
        showNow: false,
        now,
      }),
    [day.sunrise, day.sunset, timezone, now]
  );
  const tempMarkerOffsets = useMemo(
    () => assignChartMarkerLabelOffsets(tempTimeMarkers),
    [tempTimeMarkers]
  );
  const sunMarkerOffsets = useMemo(
    () => assignChartMarkerLabelOffsets(sunTimeMarkers),
    [sunTimeMarkers]
  );
  const tempChartTopMargin = getChartMarkerTopMargin(tempMarkerOffsets);
  const sunChartTopMargin = getChartMarkerTopMargin(sunMarkerOffsets);

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 ${
        fillViewport ? "flex h-full min-h-0 flex-1 flex-col" : ""
      }`}
    >
      {!hideTitle && (
        <h3 className="mb-1 text-base font-bold text-slate-900">{label}</h3>
      )}

      <div className={`mb-1 text-sm font-medium text-slate-500 ${hideTitle ? "" : "mt-4"}`}>
        Temperature
      </div>
      {!fillViewport && (
        <p className="mb-3 text-sm text-slate-500">
          Shading = {activityLabel.toLowerCase()} safety · Dashed line = nearest limit · Lines = air,
          real feel, pavement est.
        </p>
      )}

      <div
        className={
          fillViewport
            ? "h-0 min-h-[10rem] w-full min-w-0 flex-[3] sm:min-h-[12rem]"
            : "h-60 w-full min-w-0 sm:h-72"
        }
      >
        {hydrated ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ComposedChart
              key={`${label}-temp-${activityMode}-${exercisePrefs.maxRealFeel}-${dogPrefs.maxPavement}-${dogPrefs.sensitivity}-${minTemp}-${maxTemp}-${thresholdLine?.value ?? "none"}`}
              data={lineData}
              margin={{ top: tempChartTopMargin, right: 8, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis {...hourXAxisProps} />
              <YAxis
                yAxisId="temp"
                type="number"
                domain={[minTemp, maxTemp]}
                allowDataOverflow
                tick={axisProps.tick}
                axisLine={axisProps.axisLine}
                tickFormatter={(v) => formatTemp(v, units)}
                width={48}
              />
              <Tooltip content={<TempTooltip units={units} />} />

              {hourlyPoints.map((point) => (
                <ReferenceArea
                  key={`shade-${point.hour}-${point[statusKey]}`}
                  yAxisId="temp"
                  x1={point.hour}
                  x2={point.hour + 1}
                  fill={statusColors[point[statusKey]] ?? "#ffe4e6"}
                  fillOpacity={point[statusKey] === "too_hot" ? 0.28 : 0.38}
                  strokeOpacity={0}
                />
              ))}

              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="airTemp"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={false}
                name="Air"
                isAnimationActive={false}
              />
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="apparentTemp"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
                strokeDasharray="4 4"
                name="Real feel"
                isAnimationActive={false}
              />
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="pavementTemp"
                stroke="#dc2626"
                strokeWidth={2}
                dot={false}
                name="Pavement est."
                isAnimationActive={false}
              />

              {thresholdLine && (
                <ReferenceLine
                  yAxisId="temp"
                  y={thresholdLine.value}
                  stroke={thresholdStroke}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                />
              )}

              <ChartTimeReferenceLines
                markers={tempTimeMarkers}
                offsets={tempMarkerOffsets}
                yAxisId="temp"
              />

              <ActivityWindowReferenceLines
                mustStartBy={windowResult.mustStartBy}
                waitUntilAfter={windowResult.waitUntilAfter}
                dayDate={day.date}
                timezone={timezone}
                yAxisId="temp"
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <ChartPlaceholder />
        )}
      </div>

      <div className={`flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 ${fillViewport ? "mb-2 mt-2" : "mb-3 mt-5"}`}>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-sky-500" /> Air
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-orange-500" />{" "}
          Real feel
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-red-600" /> Pavement est.
        </span>
        {thresholdLine && (
          <span className="flex items-center gap-1">
            <span
              className={`inline-block h-0.5 w-4 border-t-2 border-dashed ${
                thresholdLine.type === "max" ? "border-orange-600" : "border-sky-600"
              }`}
            />{" "}
            {thresholdLine.label}
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-sm bg-emerald-200" /> Good
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-sm bg-yellow-300" /> Caution
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-sm bg-orange-500" /> Too hot / unsafe
        </span>
      </div>

      <div className={`flex min-h-0 flex-col border-t border-slate-100 pt-3 ${fillViewport ? "flex-[2]" : ""}`}>
        <div className="mb-1 text-sm font-medium text-slate-500">Humidity & rain chance</div>

        <div
          className={
            fillViewport
              ? "h-0 min-h-[6rem] w-full min-w-0 flex-1 sm:min-h-[7rem]"
              : "h-32 w-full min-w-0 sm:h-36"
          }
        >
          {hydrated ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <ComposedChart
                key={`${label}-moisture-${activityMode}`}
                data={lineData}
                margin={{ top: sunChartTopMargin, right: 8, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis {...hourXAxisProps} />
                <YAxis
                  yAxisId="moisture"
                  type="number"
                  domain={[0, 100]}
                  tick={axisProps.tick}
                  axisLine={axisProps.axisLine}
                  tickFormatter={(v) => `${v}%`}
                  width={48}
                />
                <Tooltip content={<MoistureTooltip />} />

                <Bar
                  yAxisId="moisture"
                  dataKey="precipProb"
                  fill="#6366f1"
                  fillOpacity={0.3}
                  barSize={8}
                  radius={[2, 2, 0, 0]}
                  isAnimationActive={false}
                >
                  {lineData.map((entry, index) => (
                    <Cell
                      key={`precip-${index}`}
                      fill={entry.precipProb > 40 ? "#6366f1" : "#a5b4fc"}
                    />
                  ))}
                </Bar>

                <Line
                  yAxisId="moisture"
                  type="monotone"
                  dataKey="humidity"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={false}
                  name="Humidity"
                  isAnimationActive={false}
                />

                <ChartTimeReferenceLines
                  markers={sunTimeMarkers}
                  offsets={sunMarkerOffsets}
                  yAxisId="moisture"
                />

                <ActivityWindowReferenceLines
                  mustStartBy={windowResult.mustStartBy}
                  waitUntilAfter={windowResult.waitUntilAfter}
                  dayDate={day.date}
                  timezone={timezone}
                  yAxisId="moisture"
                />

                {showCurrentTime && (
                  <ReferenceLine
                    yAxisId="moisture"
                    x={currentHour}
                    stroke="#1e293b"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <ChartPlaceholder />
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-sky-500" /> Humidity
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-indigo-400/60" /> Rain chance
          </span>
        </div>
      </div>
    </div>
  );
}

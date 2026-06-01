"use client";

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { useHydrated } from "@/hooks/useHydrated";
import { useMemo, useState, type ReactNode } from "react";
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
  return hour === 24 ? "End of day" : formatHourLabel(hour);
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
      hourLabel: "End of day",
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

function ChartPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-slate-400">
      Loading chart…
    </div>
  );
}

interface ChartLegendVisibility {
  air: boolean;
  realFeel: boolean;
  pavement: boolean;
  threshold: boolean;
  good: boolean;
  caution: boolean;
  unsafe: boolean;
}

const DEFAULT_LEGEND_VISIBILITY: ChartLegendVisibility = {
  air: true,
  realFeel: true,
  pavement: true,
  threshold: true,
  good: true,
  caution: true,
  unsafe: true,
};

function isShadingStatusVisible(
  status: string,
  visibility: ChartLegendVisibility
): boolean {
  if (status === "good") return visibility.good;
  if (status === "caution") return visibility.caution;
  return visibility.unsafe;
}

function ChartLegendItem({
  label,
  swatch,
  checked,
  onChange,
}: {
  label: string;
  swatch: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col items-center gap-1.5 px-1 text-center">
      <span className="flex items-center justify-center gap-1.5 whitespace-nowrap">
        {swatch}
        <span>{label}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
        aria-label={`Show ${label}`}
      />
    </label>
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
  labelPosition: "top" | "insideBottom";
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
      labelPosition: "insideBottom",
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
      labelPosition: "insideBottom",
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
      labelPosition: "top",
    });
  }

  return markers.sort((a, b) => a.hour - b.hour);
}

function assignChartMarkerLabelOffsets(
  markers: ChartTimeMarker[],
  labelPosition: ChartTimeMarker["labelPosition"]
): Map<string, number> {
  const offsets = new Map<string, number>();
  let tier = 0;
  let previousHour = Number.NEGATIVE_INFINITY;

  for (const marker of markers) {
    if (marker.labelPosition !== labelPosition) continue;
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

function getChartMarkerBottomMargin(offsets: Map<string, number>): number {
  const maxOffset = Math.max(0, ...offsets.values());
  return 20 + maxOffset;
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
            position: marker.labelPosition,
            offset:
              marker.labelPosition === "insideBottom"
                ? -(offsets.get(marker.id) ?? 0)
                : (offsets.get(marker.id) ?? 0),
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
  now,
  labelOffset = 0,
}: {
  mustStartBy: Date | null;
  waitUntilAfter: Date | null;
  dayDate: Date;
  timezone: string;
  yAxisId: string;
  now: Date;
  labelOffset?: number;
}) {
  const lines = [
    {
      time: mustStartBy && mustStartBy > now ? mustStartBy : null,
      prefix: "Must start",
      stroke: "#7c3aed",
      position: "insideTopRight" as const,
      offset: labelOffset,
      multiline: false,
    },
    {
      time: waitUntilAfter && waitUntilAfter > now ? waitUntilAfter : null,
      prefix: "Wait until",
      stroke: "#db2777",
      position: "insideTopLeft" as const,
      offset: labelOffset + MARKER_LABEL_LINE_HEIGHT,
      multiline: true,
    },
  ].filter(
    (line): line is typeof line & { time: Date } =>
      line.time !== null && isSameLocalDay(line.time, dayDate, timezone)
  );

  return (
    <>
      {lines.map(({ time, prefix, stroke, position, offset, multiline }) => (
        <ReferenceLine
          key={prefix}
          yAxisId={yAxisId}
          x={getChartHour(time, timezone)}
          stroke={stroke}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          label={{
            value: multiline
              ? `${prefix}:\n${formatTime(time, timezone)}`
              : `${prefix}: ${formatTime(time, timezone)}`,
            position,
            offset,
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
  const [legendVisibility, setLegendVisibility] = useState(DEFAULT_LEGEND_VISIBILITY);
  const hourlyPoints = buildChartData(day.hours, exercisePrefs, dogPrefs);
  const lineData = withMidnightAnchor(hourlyPoints);
  const windowResult =
    activityMode === "exercise" ? exerciseResult : dogWalkResult;
  const thresholdLine = getRelevantThresholdLine(
    hourlyPoints,
    activityMode,
    exercisePrefs,
    dogPrefs
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
  const topMarkerOffsets = useMemo(
    () => assignChartMarkerLabelOffsets(tempTimeMarkers, "top"),
    [tempTimeMarkers]
  );
  const bottomMarkerOffsets = useMemo(
    () => assignChartMarkerLabelOffsets(tempTimeMarkers, "insideBottom"),
    [tempTimeMarkers]
  );
  const tempMarkerOffsets = useMemo(() => {
    const combined = new Map<string, number>();
    for (const [id, offset] of topMarkerOffsets) combined.set(id, offset);
    for (const [id, offset] of bottomMarkerOffsets) combined.set(id, offset);
    return combined;
  }, [topMarkerOffsets, bottomMarkerOffsets]);
  const tempChartTopMargin = getChartMarkerTopMargin(topMarkerOffsets);
  const tempChartBottomMargin = getChartMarkerBottomMargin(bottomMarkerOffsets);

  function setLegendItem<K extends keyof ChartLegendVisibility>(
    key: K,
    value: ChartLegendVisibility[K]
  ) {
    setLegendVisibility((current) => ({ ...current, [key]: value }));
  }

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
            ? "h-0 min-h-[12rem] w-full min-w-0 flex-1 sm:min-h-[16rem]"
            : "h-60 w-full min-w-0 sm:h-72"
        }
      >
        {hydrated ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ComposedChart
              key={`${label}-temp-${activityMode}-${exercisePrefs.maxRealFeel}-${dogPrefs.maxPavement}-${minTemp}-${maxTemp}-${thresholdLine?.value ?? "none"}`}
              data={lineData}
              margin={{ top: tempChartTopMargin, right: 8, left: 0, bottom: tempChartBottomMargin }}
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

              {hourlyPoints.map((point) => {
                if (!isShadingStatusVisible(point[statusKey], legendVisibility)) return null;
                return (
                  <ReferenceArea
                    key={`shade-${point.hour}-${point[statusKey]}`}
                    yAxisId="temp"
                    x1={point.hour}
                    x2={point.hour + 1}
                    fill={statusColors[point[statusKey]] ?? "#ffe4e6"}
                    fillOpacity={point[statusKey] === "too_hot" ? 0.28 : 0.38}
                    strokeOpacity={0}
                  />
                );
              })}

              {legendVisibility.air && (
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
              )}
              {legendVisibility.realFeel && (
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
              )}
              {legendVisibility.pavement && (
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
              )}

              {thresholdLine && legendVisibility.threshold && (
                <ReferenceLine
                  yAxisId="temp"
                  y={thresholdLine.value}
                  stroke={thresholdStroke}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  label={{
                    value: thresholdLine.label,
                    position: "insideTopLeft",
                    fill: thresholdStroke,
                    fontSize: 11,
                  }}
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
                now={now}
                labelOffset={Math.max(0, ...topMarkerOffsets.values(), 0)}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <ChartPlaceholder />
        )}
      </div>

      <div
        className={`flex w-full flex-wrap items-start justify-center gap-x-8 gap-y-3 text-sm text-slate-600 ${
          fillViewport ? "mb-2 mt-2" : "mb-3 mt-5"
        }`}
      >
        <ChartLegendItem
          label="Air"
          checked={legendVisibility.air}
          onChange={(checked) => setLegendItem("air", checked)}
          swatch={<span className="inline-block h-0.5 w-4 bg-sky-500" />}
        />
        <ChartLegendItem
          label="Real feel"
          checked={legendVisibility.realFeel}
          onChange={(checked) => setLegendItem("realFeel", checked)}
          swatch={
            <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-orange-500" />
          }
        />
        <ChartLegendItem
          label="Pavement est."
          checked={legendVisibility.pavement}
          onChange={(checked) => setLegendItem("pavement", checked)}
          swatch={<span className="inline-block h-0.5 w-4 bg-red-600" />}
        />
        {thresholdLine && (
          <ChartLegendItem
            label={thresholdLine.label}
            checked={legendVisibility.threshold}
            onChange={(checked) => setLegendItem("threshold", checked)}
            swatch={
              <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-orange-600" />
            }
          />
        )}
        <ChartLegendItem
          label="Good"
          checked={legendVisibility.good}
          onChange={(checked) => setLegendItem("good", checked)}
          swatch={<span className="inline-block h-2 w-4 rounded-sm bg-emerald-200" />}
        />
        <ChartLegendItem
          label="Caution"
          checked={legendVisibility.caution}
          onChange={(checked) => setLegendItem("caution", checked)}
          swatch={<span className="inline-block h-2 w-4 rounded-sm bg-yellow-300" />}
        />
        <ChartLegendItem
          label="Too hot / unsafe"
          checked={legendVisibility.unsafe}
          onChange={(checked) => setLegendItem("unsafe", checked)}
          swatch={<span className="inline-block h-2 w-4 rounded-sm bg-orange-500" />}
        />
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  ReferenceLine,
} from "recharts";
import { useHydrated } from "@/hooks/useHydrated";
import {
  buildStartTimePaceChartPoints,
  flattenForecastHours,
  formatSecondsToPace,
  getDewPointAdjustmentBandRows,
  getPaceCalculationExplanation,
  getRealFeelAdjustmentBandRows,
  type PaceAdjustmentBandRow,
  type PaceCalculationSegment,
  type PaceCalculationStep,
  type RunPaceRecommendation,
} from "@/lib/run-pace-mission";
import {
  buildDateFromLocalTime,
  formatTime,
  getChartHour,
  isSameLocalDay,
} from "@/lib/time-utils";
import type { TemperatureUnit } from "@/types/preferences";
import type { WeatherForecast } from "@/types/weather";

interface StartTimePaceChartProps {
  forecast: WeatherForecast;
  startTime: Date;
  endTime: Date | null;
  now: Date;
  durationMinutes: number;
  baselinePace: string;
  missionDistanceMiles: number;
  timezone: string;
  units: TemperatureUnit;
  selectedPaceLabel?: string;
  selectedPaceMinutes?: number | null;
}

interface MissionTimeMarker {
  id: string;
  hour: number;
  text: string;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  fill: string;
  labelPosition: "top" | "insideBottom";
  labelOffset: number;
}

const MARKER_LABEL_LINE_HEIGHT = 14;

function formatPaceChartHourTick(chartHour: number, timezone: string, dayAnchor: Date): string {
  const hour = Math.floor(chartHour);
  const minute = Math.round((chartHour - hour) * 60);
  const timeValue = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return formatTime(buildDateFromLocalTime(dayAnchor, timeValue, timezone), timezone);
}

function buildMissionTimeMarkers({
  now,
  startTime,
  endTime,
  timezone,
}: {
  now: Date;
  startTime: Date;
  endTime: Date | null;
  timezone: string;
}): MissionTimeMarker[] {
  const markers: MissionTimeMarker[] = [];

  if (isSameLocalDay(now, startTime, timezone)) {
    markers.push({
      id: "now",
      hour: getChartHour(now, timezone),
      text: "Now",
      stroke: "#1e293b",
      strokeWidth: 2,
      strokeDasharray: "3 3",
      fill: "#1e293b",
      labelPosition: "top",
      labelOffset: 0,
    });
  }

  markers.push({
    id: "start",
    hour: getChartHour(startTime, timezone),
    text: "Start",
    stroke: "#0284c7",
    strokeWidth: 2,
    fill: "#0284c7",
    labelPosition: "insideBottom",
    labelOffset: 0,
  });

  if (endTime && isSameLocalDay(endTime, startTime, timezone)) {
    markers.push({
      id: "end",
      hour: getChartHour(endTime, timezone),
      text: "End",
      stroke: "#7c3aed",
      strokeWidth: 1.5,
      strokeDasharray: "4 3",
      fill: "#7c3aed",
      labelPosition: "insideBottom",
      labelOffset: MARKER_LABEL_LINE_HEIGHT,
    });
  }

  return markers.sort((a, b) => a.hour - b.hour);
}

interface PaceCalculationDetailsProps {
  recommendation: RunPaceRecommendation;
  timezone: string;
  units: TemperatureUnit;
}

const axisProps = {
  tick: { fontSize: 11, fill: "#64748b" },
  axisLine: { stroke: "#cbd5e1" },
};

const segmentColors: Record<PaceCalculationSegment["id"], string> = {
  baseline: "bg-slate-400",
  heat: "bg-orange-400",
  humidity: "bg-teal-500",
};

const activeBandColors: Record<"heat" | "humidity", string> = {
  heat: "bg-orange-50 text-orange-950",
  humidity: "bg-teal-50 text-teal-950",
};

export function DisclosureChevron({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={`size-3.5 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-90 ${className}`}
      fill="currentColor"
    >
      <path d="M5.5 3.5 11 8 5.5 12.5Z" />
    </svg>
  );
}

function AdjustmentBandTable({
  rows,
  metricLabel,
  kind,
}: {
  rows: PaceAdjustmentBandRow[];
  metricLabel: string;
  kind: "heat" | "humidity";
}) {
  return (
    <div className="border-t border-slate-200 bg-white px-3 py-2">
      <table className="w-full text-xs">
        <caption className="sr-only">{metricLabel} adjustment bands</caption>
        <thead>
          <tr className="text-left text-slate-500">
            <th className="pb-1 font-medium">{metricLabel}</th>
            <th className="pb-1 text-right font-medium">Pace adj.</th>
          </tr>
        </thead>
        <tbody className="text-slate-700">
          {rows.map((row) => (
            <tr
              key={row.bandLabel}
              className={row.isActive ? activeBandColors[kind] : undefined}
            >
              <td className="py-1 pr-3">{row.bandLabel}</td>
              <td className="py-1 text-right font-medium tabular-nums text-slate-900">
                {row.adjustmentLabel}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaceCalculationStepItem({
  step,
  bandRows,
  bandMetricLabel,
}: {
  step: PaceCalculationStep;
  bandRows?: PaceAdjustmentBandRow[];
  bandMetricLabel?: string;
}) {
  const isExpandable =
    (step.id === "heat" || step.id === "humidity") && bandRows && bandMetricLabel;

  if (!isExpandable) {
    return (
      <li className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{step.title}</p>
          <p className="mt-0.5 text-xs text-slate-600">{step.detail}</p>
        </div>
        <span className="shrink-0 font-semibold tabular-nums text-slate-900">
          {step.offsetLabel}
        </span>
      </li>
    );
  }

  return (
    <li className="overflow-hidden rounded-lg bg-slate-50">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-2 marker:content-none [&::-webkit-details-marker]:hidden">
          <DisclosureChevron className="mt-1" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-900">{step.title}</p>
            <p className="mt-0.5 text-xs text-slate-600">{step.detail}</p>
          </div>
          <span className="shrink-0 font-semibold tabular-nums text-slate-900">
            {step.offsetLabel}
          </span>
        </summary>
        <AdjustmentBandTable
          rows={bandRows}
          metricLabel={bandMetricLabel}
          kind={step.id === "heat" ? "heat" : "humidity"}
        />
      </details>
    </li>
  );
}

export function StartTimePaceChart({
  forecast,
  startTime,
  endTime,
  now,
  durationMinutes,
  baselinePace,
  missionDistanceMiles,
  timezone,
  units,
  selectedPaceLabel,
  selectedPaceMinutes,
}: StartTimePaceChartProps) {
  const hydrated = useHydrated();
  const hours = useMemo(() => flattenForecastHours(forecast.days), [forecast.days]);

  const startTimePacePoints = useMemo(
    () =>
      buildStartTimePaceChartPoints({
        hours,
        selectedStartTime: startTime,
        durationMinutes,
        baselinePace,
        missionDistanceMiles,
        timezone,
        units,
      }).filter((point) => point.paceMinutes !== null || point.runWalkRecommended),
    [hours, startTime, durationMinutes, baselinePace, missionDistanceMiles, timezone, units]
  );

  const timeMarkers = useMemo(
    () => buildMissionTimeMarkers({ now, startTime, endTime, timezone }),
    [now, startTime, endTime, timezone]
  );

  const xDomain = useMemo(() => {
    const hoursOnChart = [
      ...startTimePacePoints.map((point) => point.chartHour),
      ...timeMarkers.map((marker) => marker.hour),
    ];
    if (hoursOnChart.length === 0) return [0, 24] as [number, number];
    const minHour = Math.min(...hoursOnChart);
    const maxHour = Math.max(...hoursOnChart);
    return [Math.max(0, minHour - 0.5), Math.min(24, maxHour + 0.5)] as [number, number];
  }, [startTimePacePoints, timeMarkers]);

  const formatTick = (chartHour: number) =>
    formatPaceChartHourTick(chartHour, timezone, startTime);

  const startHour = getChartHour(startTime, timezone);
  const showSelectedPaceDot =
    selectedPaceMinutes !== null &&
    selectedPaceMinutes !== undefined &&
    Number.isFinite(selectedPaceMinutes);

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900">Pace by start time today</h2>
      <p className="mt-0.5 text-xs text-slate-600">Same time on feet, different start hours.</p>
      <div className="mt-3 h-44 min-w-0 sm:h-48">
        {!hydrated ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Loading chart…
          </div>
        ) : startTimePacePoints.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Enter a valid cool pace to compare start times.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ComposedChart
              data={startTimePacePoints}
              margin={{ top: 28, right: 8, left: 0, bottom: 24 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="chartHour"
                type="number"
                domain={xDomain}
                allowDataOverflow
                tickFormatter={formatTick}
                interval="preserveStartEnd"
                minTickGap={24}
                {...axisProps}
              />
              <YAxis
                {...axisProps}
                width={40}
                domain={["auto", "auto"]}
                tickFormatter={(value: number) => formatSecondsToPace(Math.round(value * 60))}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "0.5rem",
                  borderColor: "#cbd5e1",
                  fontSize: "0.75rem",
                }}
                formatter={(_value, _name, item) => [item.payload.paceLabel, "Mission pace"]}
                labelFormatter={(_label, payload) => {
                  const chartHour = payload?.[0]?.payload?.chartHour;
                  if (typeof chartHour !== "number") return "Start time";
                  return `Start: ${formatTick(chartHour)}`;
                }}
              />
              <Line
                type="monotone"
                dataKey="paceMinutes"
                name="paceMinutes"
                stroke="#334155"
                strokeWidth={2}
                connectNulls={false}
                dot={{ r: 3 }}
                activeDot={{ r: 4 }}
              />
              {timeMarkers.map((marker) => (
                <ReferenceLine
                  key={marker.id}
                  x={marker.hour}
                  stroke={marker.stroke}
                  strokeWidth={marker.strokeWidth}
                  strokeDasharray={marker.strokeDasharray}
                  label={{
                    value: marker.text,
                    position: marker.labelPosition,
                    offset:
                      marker.labelPosition === "insideBottom" ? -marker.labelOffset : marker.labelOffset,
                    fill: marker.fill,
                    fontSize: 11,
                  }}
                />
              ))}
              {showSelectedPaceDot && (
                <ReferenceDot
                  x={startHour}
                  y={selectedPaceMinutes}
                  r={5}
                  fill="#0284c7"
                  stroke="#fff"
                  strokeWidth={2}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      {hydrated && startTimePacePoints.length > 0 && (
        <div className="mt-2 flex flex-col gap-1 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1">
            {isSameLocalDay(now, startTime, timezone) && (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="inline-block h-2.5 w-0.5 border-l-2 border-dashed border-slate-800" />
                Now:{" "}
                <span className="font-medium text-slate-900">{formatTime(now, timezone)}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span className="inline-block h-2.5 w-0.5 bg-sky-600" />
              Start:{" "}
              <span className="font-medium text-slate-900">{formatTime(startTime, timezone)}</span>
            </span>
            {endTime && isSameLocalDay(endTime, startTime, timezone) && (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="inline-block h-2.5 w-0.5 border-l-2 border-dashed border-violet-600" />
                End:{" "}
                <span className="font-medium text-slate-900">{formatTime(endTime, timezone)}</span>
              </span>
            )}
          </div>
          {selectedPaceLabel && (
            <p className="shrink-0 sm:whitespace-nowrap sm:text-right">
              Your start →{" "}
              <span className="font-medium text-slate-900">{selectedPaceLabel}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function PaceCalculationDetails({
  recommendation,
  timezone,
  units,
}: PaceCalculationDetailsProps) {
  const explanation = useMemo(
    () => getPaceCalculationExplanation(recommendation, units),
    [recommendation, units]
  );

  const heatBandRows = useMemo(
    () => getRealFeelAdjustmentBandRows(units, recommendation.endRealFeelF),
    [units, recommendation.endRealFeelF]
  );

  const humidityBandRows = useMemo(
    () => getDewPointAdjustmentBandRows(units, recommendation.endDewPointF),
    [units, recommendation.endDewPointF]
  );

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900">How this pace is calculated</h3>
      <p className="mt-0.5 text-xs text-slate-600">
        Forecast at {formatTime(explanation.weatherCheckTime, timezone)} (start + time on feet)
        drives the adjustments.
      </p>

      {explanation.unavailable ? (
        <p className="mt-3 text-sm text-amber-800">{explanation.summary}</p>
      ) : (
        <div className="mt-3 space-y-4">
          {explanation.runWalkRecommended ? (
            <p className="text-sm text-slate-700">{explanation.summary}</p>
          ) : (
            <>
              <div>
                <div className="flex h-9 overflow-hidden rounded-lg border border-slate-200">
                  {explanation.segments.map((segment) => (
                    <div
                      key={segment.id}
                      className={`${segmentColors[segment.id]} flex min-w-[2.5rem] items-center justify-center px-1 text-[10px] font-semibold text-white sm:text-xs`}
                      style={{ width: `${Math.max(segment.share * 100, 8)}%` }}
                      title={`${segment.label}: ${segment.paceLabel}`}
                    >
                      {segment.share >= 0.12 ? segment.paceLabel : ""}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                  {explanation.segments.map((segment) => (
                    <span key={segment.id} className="inline-flex items-center gap-1.5">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-sm ${segmentColors[segment.id]}`}
                      />
                      {segment.label}: {segment.paceLabel}
                    </span>
                  ))}
                  <span className="font-medium text-slate-900">
                    = {explanation.totalPaceLabel}/mi
                  </span>
                </div>
              </div>
              <p className="text-sm font-medium text-slate-900">{explanation.summary}</p>
            </>
          )}

          <ol className="space-y-2 text-sm text-slate-700">
            {explanation.steps.map((step) => (
              <PaceCalculationStepItem
                key={step.title}
                step={step}
                bandRows={
                  step.id === "heat"
                    ? heatBandRows
                    : step.id === "humidity"
                      ? humidityBandRows
                      : undefined
                }
                bandMetricLabel={
                  step.id === "heat"
                    ? "Real Feel"
                    : step.id === "humidity"
                      ? "Dew point"
                      : undefined
                }
              />
            ))}
          </ol>

          <p className="text-xs text-slate-500">
            Heat and humidity bands use °F thresholds internally, even when you view °C.
          </p>
        </div>
      )}
    </div>
  );
}

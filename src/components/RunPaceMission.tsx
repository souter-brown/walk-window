"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { LocationSelector } from "@/components/LocationSelector";
import { LocationPickerModal } from "@/components/LocationPickerModal";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { StepperNumberInput, UnitToggle } from "@/components/InlinePreferenceControls";
import { PaceCalculationDetails, StartTimePaceChart, DisclosureChevron } from "@/components/RunPaceMissionCharts";
import { useWeatherForecast } from "@/hooks/useWeatherForecast";
import {
  flattenForecastHours,
  findClosestHour,
  formatPaceBreakdown,
  getCoolPaceThresholdLabel,
  getRunPaceRecommendation,
  parsePaceToSeconds,
} from "@/lib/run-pace-mission";
import { convertPreferencesUnits, formatTemp } from "@/lib/temperature";
import {
  buildDateFromLocalTime,
  formatTime,
  getLocalTimeInputValue,
  isSameLocalDay,
} from "@/lib/time-utils";
import {
  fetchWeatherForLocation,
  fetchWeatherForecast,
  searchLocations,
  shouldConfirmLocationPick,
} from "@/services/weather-api";
import {
  loadPreferences,
  savePreferences,
  updatePreferences,
  usePreferences,
} from "@/services/preferences";
import type { GeocodingResult } from "@/types/weather";
import type { TemperatureUnit } from "@/types/preferences";

interface LocationPickerState {
  query: string;
  candidates: GeocodingResult[];
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`.trim()}>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

const cardClassName =
  "rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4";

const nowButtonClassName =
  "shrink-0 rounded-lg border border-slate-400 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50";

function SectionTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={`text-sm font-semibold text-slate-900 ${className}`.trim()}>{children}</h2>
  );
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-slate-600">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function DetailCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`${cardClassName} flex h-full min-h-0 flex-col sm:min-h-32 ${className}`}>
      <SectionTitle>{title}</SectionTitle>
      {subtitle && <p className="mt-0.5 text-xs text-slate-600">{subtitle}</p>}
      <dl className="mt-auto flex flex-col justify-center space-y-2 pt-3 text-sm">{children}</dl>
    </div>
  );
}

const inputClassName =
  "rounded-lg border border-slate-400 bg-white px-2 py-2 text-base tabular-nums text-slate-900 shadow-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200";

function roundDurationMinutes(totalSeconds: number): number {
  const minutes = Math.round(totalSeconds / 60);
  return Math.max(15, Math.min(240, Math.round(minutes / 5) * 5));
}

export function RunPaceMission() {
  const preferences = usePreferences();
  const {
    forecast,
    setForecast,
    loading,
    setLoading,
    error,
    setError,
    staleRefreshError,
    now,
    handleRetryStaleRefresh,
  } = useWeatherForecast();

  const [zipDraft, setZipDraft] = useState<string | null>(null);
  const [locationPicker, setLocationPicker] = useState<LocationPickerState | null>(null);
  const [startTimeValue, setStartTimeValue] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(
    preferences.runPace.defaultDurationMinutes
  );
  const [baselinePace, setBaselinePace] = useState(preferences.runPace.baselinePace);
  const [missionDistanceMiles, setMissionDistanceMiles] = useState(
    preferences.runPace.missionDistanceMiles
  );
  const [initializedTimezone, setInitializedTimezone] = useState<string | null>(null);

  const zipInput = zipDraft ?? preferences.location?.zip ?? "";
  const timezone = forecast?.location.timezone ?? preferences.location?.timezone ?? "UTC";
  const showWelcome = !preferences.location;

  if (timezone && initializedTimezone !== timezone) {
    setInitializedTimezone(timezone);
    setStartTimeValue(getLocalTimeInputValue(now, timezone));
  }

  const applyLocation = useCallback(
    async (location: GeocodingResult, query: string, units?: TemperatureUnit) => {
      const resolvedUnits = units ?? loadPreferences().units;
      setLoading(true);
      setError(null);
      setLocationPicker(null);

      try {
        const data = await fetchWeatherForLocation(location, resolvedUnits);
        setForecast(data);
        savePreferences({
          ...loadPreferences(),
          location: {
            zip: query,
            name: data.location.name,
            latitude: data.location.latitude,
            longitude: data.location.longitude,
            timezone: data.location.timezone,
          },
        });
        setZipDraft(null);
        setInitializedTimezone(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setForecast(null);
      } finally {
        setLoading(false);
      }
    },
    [setError, setForecast, setLoading]
  );

  const loadWeather = useCallback(
    async (query: string, units?: TemperatureUnit) => {
      setLoading(true);
      setError(null);
      setLocationPicker(null);

      try {
        const candidates = await searchLocations(query);
        if (candidates.length === 0) {
          throw new Error("No location found. Try a city name or ZIP code.");
        }
        if (shouldConfirmLocationPick(query, candidates)) {
          setLocationPicker({ query, candidates });
          return;
        }
        await applyLocation(candidates[0], query, units);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setForecast(null);
      } finally {
        setLoading(false);
      }
    },
    [applyLocation, setError, setForecast, setLoading]
  );

  const loadWeatherByCoords = useCallback(
    async (latitude: number, longitude: number) => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchWeatherForecast(
          latitude,
          longitude,
          loadPreferences().units
        );
        setForecast(data);
        savePreferences({
          ...loadPreferences(),
          location: {
            zip: "",
            name: data.location.name,
            latitude,
            longitude,
            timezone: data.location.timezone,
          },
        });
        setZipDraft(null);
        setInitializedTimezone(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setForecast(null);
      } finally {
        setLoading(false);
      }
    },
    [setError, setForecast, setLoading]
  );

  const persistRunPacePrefs = useCallback(
    (partial: {
      baselinePace?: string;
      missionDistanceMiles?: number;
      defaultDurationMinutes?: number;
    }) => {
      updatePreferences({ runPace: partial });
    },
    []
  );

  const startTime = useMemo(
    () => buildDateFromLocalTime(now, startTimeValue, timezone),
    [now, startTimeValue, timezone]
  );

  const recommendation = useMemo(() => {
    if (!forecast || !startTime) return null;

    const hours = flattenForecastHours(forecast.days);
    const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);
    const endHour = findClosestHour(hours, endTime);
    const currentHour =
      hours.find(
        (hour) =>
          isSameLocalDay(hour.time, now, timezone) &&
          hour.time <= now &&
          new Date(hour.time.getTime() + 3_600_000) > now
      ) ?? findClosestHour(hours, now);

    return getRunPaceRecommendation({
      baselinePace,
      missionDistanceMiles,
      startTime,
      durationMinutes,
      endHour,
      currentHour,
      units: preferences.units,
    });
  }, [
    forecast,
    startTime,
    now,
    timezone,
    durationMinutes,
    baselinePace,
    missionDistanceMiles,
    preferences.units,
  ]);

  const estimatedFinishTime = useMemo(() => {
    if (!startTime || recommendation?.estimatedMissionTimeSeconds == null) return null;
    return new Date(startTime.getTime() + recommendation.estimatedMissionTimeSeconds * 1000);
  }, [startTime, recommendation]);

  const suggestedDurationMinutes =
    recommendation?.estimatedMissionTimeSeconds != null
      ? roundDurationMinutes(recommendation.estimatedMissionTimeSeconds)
      : null;

  const resetStartTimeToNow = useCallback(() => {
    setStartTimeValue(getLocalTimeInputValue(now, timezone));
  }, [now, timezone]);

  const showMatchWeatherButton =
    suggestedDurationMinutes !== null &&
    durationMinutes === preferences.runPace.defaultDurationMinutes &&
    Math.abs(durationMinutes - suggestedDurationMinutes) > 5;

  const paceBreakdown = recommendation ? formatPaceBreakdown(recommendation) : null;
  const baselinePaceValid = parsePaceToSeconds(baselinePace) !== null;
  const coolPaceThresholdLabel = getCoolPaceThresholdLabel(preferences.units);
  const forecastUnavailable = recommendation?.missionPaceLabel === "Forecast unavailable";
  const showPaceFinishLine =
    !!recommendation &&
    (forecastUnavailable ||
      recommendation.estimatedMissionTimeLabel !== "—" ||
      showMatchWeatherButton);

  const paceDetailsTeaser =
    paceBreakdown ??
    (recommendation?.runWalkRecommended ? "Run/walk recommended" : null) ??
    (forecastUnavailable ? "Forecast unavailable" : null);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-3 py-2 sm:px-5 sm:py-3">
      <header className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-sm font-medium text-sky-900">
            <Link href="/" className="hover:underline">
              Walk Window
            </Link>
            <span className="text-slate-500"> / Run Pace Mission</span>
          </p>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Run Pace Mission
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Weather-adjusted mission pace for a planned run.
          </p>
        </div>
        {!showWelcome && (
          <div className="sm:ms-auto">
            <LocationSelector
              compact
              zip={zipInput}
              onZipChange={setZipDraft}
              onSearch={(query) => void loadWeather(query)}
              onUseLocation={() => {
                if (!navigator.geolocation) {
                  setError("Geolocation is not supported in this browser.");
                  return;
                }
                setLoading(true);
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    void loadWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
                  },
                  () => {
                    setLoading(false);
                    setError("Unable to access your location. Try entering a city or ZIP code.");
                  }
                );
              }}
              loading={loading}
              locationName={forecast?.location.name}
              timezone={timezone}
              now={now}
              trailing={
                <UnitToggle
                  value={preferences.units}
                  onChange={(units) =>
                    updatePreferences(convertPreferencesUnits(loadPreferences(), units))
                  }
                />
              }
            />
          </div>
        )}
      </header>

      {locationPicker && (
        <LocationPickerModal
          query={locationPicker.query}
          candidates={locationPicker.candidates}
          onSelect={(location) => {
            if (!locationPicker) return;
            void applyLocation(location, locationPicker.query);
          }}
          onClose={() => setLocationPicker(null)}
        />
      )}

      {showWelcome ? (
        <WelcomeScreen
          zip={zipInput}
          onZipChange={setZipDraft}
          onSearch={(query) => void loadWeather(query)}
          onUseLocation={() => {
            if (!navigator.geolocation) {
              setError("Geolocation is not supported in this browser.");
              return;
            }
            setLoading(true);
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                void loadWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
              },
              () => {
                setLoading(false);
                setError("Unable to access your location. Try entering a city or ZIP code.");
              }
            );
          }}
          loading={loading}
          error={error}
        />
      ) : loading && !forecast ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-600 shadow-sm">
          Loading forecast…
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          )}

          {staleRefreshError && (
            <div className="mb-4 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
              <p>{staleRefreshError}</p>
              <button
                type="button"
                onClick={handleRetryStaleRefresh}
                className="shrink-0 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-semibold text-amber-950 transition hover:bg-amber-100"
              >
                Retry
              </button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className={`${cardClassName} sm:col-span-2 lg:col-span-3`}>
              <SectionTitle>Mission inputs</SectionTitle>
              <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-3 sm:gap-x-6">
                <Field label="Start time" className="w-auto">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={startTimeValue}
                      onChange={(event) => setStartTimeValue(event.target.value)}
                      className={`${inputClassName} w-[8.25rem]`}
                    />
                    <button
                      type="button"
                      onClick={resetStartTimeToNow}
                      className={nowButtonClassName}
                      aria-label="Set start time to now"
                    >
                      [Now]
                    </button>
                  </div>
                </Field>
                <Field label="Time on feet (min)" className="w-auto">
                  <StepperNumberInput
                    value={durationMinutes}
                    min={15}
                    max={240}
                    step={5}
                    aria-label="Time on feet"
                    onChange={(value) => {
                      setDurationMinutes(value);
                      persistRunPacePrefs({ defaultDurationMinutes: value });
                    }}
                  />
                </Field>
                <Field label={`Cool pace (${coolPaceThresholdLabel})`} className="w-auto">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="10:15"
                    title={`Pace at Real Feel below ${coolPaceThresholdLabel} (mm:ss per mile)`}
                    value={baselinePace}
                    onChange={(event) => setBaselinePace(event.target.value)}
                    onBlur={() => {
                      if (parsePaceToSeconds(baselinePace) !== null) {
                        persistRunPacePrefs({ baselinePace });
                      }
                    }}
                    className={`${inputClassName} w-[4.75rem] text-center`}
                  />
                </Field>
                <Field label="Distance (mi)" className="w-auto">
                  <input
                    type="number"
                    min={0.1}
                    max={26.2}
                    step={0.1}
                    value={missionDistanceMiles}
                    onChange={(event) => {
                      const parsed = Number(event.target.value);
                      if (!Number.isNaN(parsed)) {
                        setMissionDistanceMiles(parsed);
                      }
                    }}
                    onBlur={() =>
                      persistRunPacePrefs({ missionDistanceMiles: missionDistanceMiles })
                    }
                    className={`${inputClassName} w-[3.75rem] text-center`}
                  />
                </Field>
              </div>
            </div>

            {recommendation && baselinePaceValid && (
              <>
                <div className="grid items-stretch gap-3 sm:col-span-2 sm:grid-cols-2 lg:col-span-3">
                  <div className={`${cardClassName} flex min-h-0 flex-col sm:min-h-32`}>
                    <SectionTitle>Mission pace</SectionTitle>
                    <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                      {recommendation.missionPaceLabel}
                    </p>
                    {showPaceFinishLine && (
                      <div className="mt-auto space-y-1.5 pt-3 text-sm">
                        {forecastUnavailable && (
                          <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-amber-800">
                            End time is outside the loaded forecast window.
                          </p>
                        )}
                        {!forecastUnavailable && recommendation.estimatedMissionTimeLabel !== "—" && (
                          <p className="text-slate-700">
                            Estimated {missionDistanceMiles.toFixed(1)} mi finish:{" "}
                            <span className="font-medium text-slate-900">
                              ~{recommendation.estimatedMissionTimeLabel}
                            </span>
                            {estimatedFinishTime && (
                              <>
                                {" "}
                                at{" "}
                                <span className="font-medium text-slate-900">
                                  {formatTime(estimatedFinishTime, timezone)}
                                </span>
                              </>
                            )}
                          </p>
                        )}
                        {showMatchWeatherButton && suggestedDurationMinutes !== null && (
                          <button
                            type="button"
                            onClick={() => {
                              setDurationMinutes(suggestedDurationMinutes);
                              persistRunPacePrefs({
                                defaultDurationMinutes: suggestedDurationMinutes,
                              });
                            }}
                            className="font-medium text-sky-800 underline decoration-sky-800/30 underline-offset-2 hover:text-sky-950"
                          >
                            Match weather to finish time? ({suggestedDurationMinutes} min)
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <DetailCard
                    title="End-of-run forecast"
                    subtitle={`At ${formatTime(recommendation.endTime, timezone)} weather check`}
                  >
                    <StatRow
                      label="Real Feel"
                      value={
                        recommendation.endHour
                          ? formatTemp(recommendation.endHour.apparentTemp, preferences.units)
                          : "—"
                      }
                    />
                    <StatRow
                      label="Dew point"
                      value={
                        recommendation.endHour
                          ? formatTemp(recommendation.endHour.dewPoint, preferences.units)
                          : "—"
                      }
                    />
                  </DetailCard>
                </div>

                {recommendation.warnings.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:col-span-2 lg:col-span-3">
                    <SectionTitle className="text-amber-950">Mission warnings</SectionTitle>
                    <ul className="mt-3 space-y-1 text-sm text-amber-900">
                      {recommendation.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid items-stretch gap-3 sm:col-span-2 sm:grid-cols-2 lg:col-span-3">
                  <DetailCard title="Timing">
                    <StatRow
                      label="Weather checked at"
                      value={formatTime(recommendation.endTime, timezone)}
                    />
                    {estimatedFinishTime && (
                      <StatRow
                        label="Estimated finish"
                        value={formatTime(estimatedFinishTime, timezone)}
                      />
                    )}
                  </DetailCard>

                  {recommendation.currentHour && (
                    <DetailCard title="Current conditions">
                      <StatRow
                        label="Real Feel"
                        value={formatTemp(
                          recommendation.currentHour.apparentTemp,
                          preferences.units
                        )}
                      />
                      <StatRow
                        label="Dew point"
                        value={formatTemp(
                          recommendation.currentHour.dewPoint,
                          preferences.units
                        )}
                      />
                    </DetailCard>
                  )}
                </div>

                {forecast && startTime && (
                  <details className={`${cardClassName} group sm:col-span-2 lg:col-span-3`}>
                    <summary className="flex cursor-pointer list-none items-start gap-2 text-sm hover:text-slate-950 [&::-webkit-details-marker]:hidden">
                      <DisclosureChevron className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-slate-900">Pace details</span>
                        {paceDetailsTeaser && (
                          <span className="mt-1 block font-normal text-slate-500 sm:mt-0 sm:ml-2 sm:inline">
                            {paceDetailsTeaser}
                          </span>
                        )}
                      </div>
                    </summary>
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <PaceCalculationDetails
                        recommendation={recommendation}
                        timezone={timezone}
                        units={preferences.units}
                      />
                    </div>
                  </details>
                )}
              </>
            )}

            {!baselinePaceValid && (
              <p className="text-sm text-rose-700 sm:col-span-2 lg:col-span-3">
                Enter a valid cool-weather pace like 10:15.
              </p>
            )}

            {forecast && startTime && (
              <div className={`${cardClassName} sm:col-span-2 lg:col-span-3`}>
                <StartTimePaceChart
                  forecast={forecast}
                  startTime={startTime}
                  endTime={recommendation?.endTime ?? null}
                  now={now}
                  durationMinutes={durationMinutes}
                  baselinePace={baselinePace}
                  missionDistanceMiles={missionDistanceMiles}
                  timezone={timezone}
                  units={preferences.units}
                  selectedPaceLabel={
                    baselinePaceValid ? recommendation?.missionPaceLabel : undefined
                  }
                  selectedPaceMinutes={
                    baselinePaceValid && recommendation?.missionPaceSeconds != null
                      ? recommendation.missionPaceSeconds / 60
                      : null
                  }
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

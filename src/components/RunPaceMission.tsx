"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { LocationSelector } from "@/components/LocationSelector";
import { LocationPickerModal } from "@/components/LocationPickerModal";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { StepperNumberInput, UnitToggle } from "@/components/InlinePreferenceControls";
import { useWeatherForecast } from "@/hooks/useWeatherForecast";
import {
  flattenForecastHours,
  findClosestHour,
  formatPaceBreakdown,
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
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {helper && <span className="mt-1 block text-xs text-slate-500">{helper}</span>}
    </label>
  );
}

const inputClassName =
  "w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200";

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

  const showMatchWeatherButton =
    suggestedDurationMinutes !== null &&
    durationMinutes === preferences.runPace.defaultDurationMinutes &&
    Math.abs(durationMinutes - suggestedDurationMinutes) > 5;

  const paceBreakdown = recommendation ? formatPaceBreakdown(recommendation) : null;
  const baselinePaceValid = parsePaceToSeconds(baselinePace) !== null;
  const forecastUnavailable = recommendation?.missionPaceLabel === "Forecast unavailable";

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-3 py-3 sm:px-5 sm:py-4">
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
          <div className="flex shrink-0 flex-wrap items-start justify-end gap-2">
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
            />
            <UnitToggle
              value={preferences.units}
              onChange={(units) =>
                updatePreferences(convertPreferencesUnits(loadPreferences(), units))
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2">
              <h2 className="text-base font-semibold text-slate-900">Mission inputs</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Start time">
                  <input
                    type="time"
                    value={startTimeValue}
                    onChange={(event) => setStartTimeValue(event.target.value)}
                    className={inputClassName}
                  />
                </Field>
                <Field
                  label="Time on feet (minutes)"
                  helper="Weather is checked at start + this time."
                >
                  <StepperNumberInput
                    value={durationMinutes}
                    min={15}
                    max={240}
                    step={5}
                    suffix="min"
                    aria-label="Time on feet"
                    onChange={(value) => {
                      setDurationMinutes(value);
                      persistRunPacePrefs({ defaultDurationMinutes: value });
                    }}
                  />
                </Field>
                <Field label="Cool-weather baseline pace (mm:ss / mile)">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="10:15"
                    value={baselinePace}
                    onChange={(event) => setBaselinePace(event.target.value)}
                    onBlur={() => {
                      if (parsePaceToSeconds(baselinePace) !== null) {
                        persistRunPacePrefs({ baselinePace });
                      }
                    }}
                    className={inputClassName}
                  />
                </Field>
                <Field label="Mission distance (miles)">
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
                    className={inputClassName}
                  />
                </Field>
              </div>
            </div>

            {recommendation && baselinePaceValid && (
              <>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2">
                  <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
                    Weather-adjusted mission pace
                  </p>
                  <p className="mt-2 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                    {recommendation.missionPaceLabel}
                  </p>
                  {forecastUnavailable && (
                    <p className="mt-2 text-sm text-amber-800">
                      End time is outside the loaded forecast window.
                    </p>
                  )}
                  {!forecastUnavailable && recommendation.estimatedMissionTimeLabel !== "—" && (
                    <p className="mt-2 text-sm text-slate-600">
                      Estimated {missionDistanceMiles.toFixed(1)} mi finish: ~
                      {recommendation.estimatedMissionTimeLabel}
                      {estimatedFinishTime && (
                        <>
                          {" "}
                          at{" "}
                          <span className="font-semibold text-slate-900">
                            {formatTime(estimatedFinishTime, timezone)}
                          </span>
                        </>
                      )}
                    </p>
                  )}
                  {paceBreakdown && (
                    <p className="mt-1 text-sm text-slate-500">{paceBreakdown}</p>
                  )}
                  {showMatchWeatherButton && suggestedDurationMinutes !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setDurationMinutes(suggestedDurationMinutes);
                        persistRunPacePrefs({ defaultDurationMinutes: suggestedDurationMinutes });
                      }}
                      className="mt-3 text-sm font-medium text-sky-800 underline decoration-sky-800/30 underline-offset-2 hover:text-sky-950"
                    >
                      Match weather to finish time? ({suggestedDurationMinutes} min)
                    </button>
                  )}
                </div>

                {recommendation.warnings.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:col-span-2">
                    <h3 className="text-sm font-semibold text-amber-950">Mission warnings</h3>
                    <ul className="mt-2 space-y-1 text-sm text-amber-900">
                      {recommendation.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-900">Timing</h3>
                  <dl className="mt-3 space-y-2 text-sm text-slate-700">
                    <div className="flex justify-between gap-3">
                      <dt>Start time</dt>
                      <dd className="font-medium text-slate-900">
                        {startTime ? formatTime(startTime, timezone) : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Time on feet</dt>
                      <dd className="font-medium text-slate-900">{durationMinutes} min</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Weather checked at</dt>
                      <dd className="font-medium text-slate-900">
                        {formatTime(recommendation.endTime, timezone)}
                      </dd>
                    </div>
                    {estimatedFinishTime && (
                      <div className="flex justify-between gap-3">
                        <dt>Estimated finish</dt>
                        <dd className="font-medium text-slate-900">
                          {formatTime(estimatedFinishTime, timezone)}
                        </dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-3">
                      <dt>Baseline pace used</dt>
                      <dd className="font-medium text-slate-900">
                        {recommendation.baselinePaceLabel} / mile
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-900">End-of-run forecast</h3>
                  <dl className="mt-3 space-y-2 text-sm text-slate-700">
                    <div className="flex justify-between gap-3">
                      <dt>Real Feel at end</dt>
                      <dd className="font-medium text-slate-900">
                        {recommendation.endHour
                          ? formatTemp(recommendation.endHour.apparentTemp, preferences.units)
                          : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Dew point at end</dt>
                      <dd className="font-medium text-slate-900">
                        {recommendation.endHour
                          ? formatTemp(recommendation.endHour.dewPoint, preferences.units)
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                </div>

                {recommendation.currentHour && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2">
                    <h3 className="text-sm font-semibold text-slate-900">Current conditions</h3>
                    <dl className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                      <div className="flex justify-between gap-3 sm:block">
                        <dt>Real Feel now</dt>
                        <dd className="font-medium text-slate-900">
                          {formatTemp(
                            recommendation.currentHour.apparentTemp,
                            preferences.units
                          )}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 sm:block">
                        <dt>Dew point now</dt>
                        <dd className="font-medium text-slate-900">
                          {formatTemp(recommendation.currentHour.dewPoint, preferences.units)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                )}
              </>
            )}

            {!baselinePaceValid && (
              <p className="text-sm text-rose-700 sm:col-span-2">
                Enter a valid baseline pace like 10:15.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

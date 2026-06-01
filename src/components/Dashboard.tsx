"use client";

import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { LocationSelector } from "@/components/LocationSelector";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { LocationPickerModal } from "@/components/LocationPickerModal";
import { CurrentWeatherSummary } from "@/components/CurrentWeatherSummary";
import { DayChart } from "@/components/DayChart";
import { ChartActivitySelector, type ChartActivityMode } from "@/components/ChartActivitySelector";
import { DaySummaryPanel } from "@/components/DaySummaryPanel";
import { UnitToggle } from "@/components/InlinePreferenceControls";
import { ForecastDayNavigator } from "@/components/ForecastDayNavigator";
import { analyzeForecast, isDogWalkHourSafe, isExerciseHourSafe } from "@/lib/window-calculation";
import { convertPreferencesUnits } from "@/lib/temperature";
import { getLocalDayKey, isForecastStale, isSameLocalDay } from "@/lib/time-utils";
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
import type {
  DogWalkPreferences,
  ExercisePreferences,
  TemperatureUnit,
} from "@/types/preferences";
import type { GeocodingResult, WeatherForecast, HourlyWeather } from "@/types/weather";

interface LocationPickerState {
  query: string;
  candidates: GeocodingResult[];
}

export function Dashboard() {
  const preferences = usePreferences();
  const locationKey = preferences.location
    ? `${preferences.location.latitude},${preferences.location.longitude}`
    : null;
  const [chartActivity, setChartActivity] = useState<ChartActivityMode>("exercise");
  const [zipDraft, setZipDraft] = useState<string | null>(null);
  const zipInput = zipDraft ?? preferences.location?.zip ?? "";
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staleRefreshError, setStaleRefreshError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [dayIndex, setDayIndex] = useState(0);
  const [trackedLocationKey, setTrackedLocationKey] = useState(locationKey);
  const [locationPicker, setLocationPicker] = useState<LocationPickerState | null>(
    null
  );
  const staleRefreshRef = useRef<{ inFlight: boolean; attemptedForDay: string | null }>({
    inFlight: false,
    attemptedForDay: null,
  });

  if (locationKey !== trackedLocationKey) {
    setTrackedLocationKey(locationKey);
    setDayIndex(0);
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      setNow(new Date());
      staleRefreshRef.current.attemptedForDay = null;
      setStaleRefreshError(null);
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const handleExerciseChange = useCallback((partial: Partial<ExercisePreferences>) => {
    updatePreferences({ exercise: partial });
  }, []);

  const handleDogWalkChange = useCallback((partial: Partial<DogWalkPreferences>) => {
    updatePreferences({ dogWalk: partial });
  }, []);

  const handleUnitsChange = useCallback((units: TemperatureUnit) => {
    updatePreferences(convertPreferencesUnits(loadPreferences(), units));
  }, []);

  const applyLocation = useCallback(
    async (
      location: GeocodingResult,
      query: string,
      units?: "fahrenheit" | "celsius"
    ) => {
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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setForecast(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadWeather = useCallback(
    async (query: string, units?: "fahrenheit" | "celsius") => {
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
    [applyLocation]
  );

  const loadWeatherByCoords = useCallback(
    async (latitude: number, longitude: number, units?: "fahrenheit" | "celsius") => {
      const resolvedUnits = units ?? loadPreferences().units;
      setLoading(true);
      setError(null);
      setLocationPicker(null);

      try {
        const data = await fetchWeatherForecast(latitude, longitude, resolvedUnits);
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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setForecast(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const refreshForecast = useCallback(
    async ({ background = false }: { background?: boolean } = {}) => {
      const savedLocation = loadPreferences().location;
      if (!savedLocation?.latitude || !savedLocation.longitude) return false;

      const { latitude, longitude } = savedLocation;
      const units = loadPreferences().units;

      if (!background) {
        setLoading(true);
        setError(null);
        setStaleRefreshError(null);
      }

      try {
        const data = await fetchWeatherForecast(latitude, longitude, units);
        setForecast(data);
        setDayIndex(0);
        setStaleRefreshError(null);
        return true;
      } catch (err) {
        if (background) {
          setStaleRefreshError(
            "Couldn’t refresh today’s forecast. Showing the last saved data."
          );
        } else {
          setError(err instanceof Error ? err.message : "Something went wrong.");
          setForecast(null);
        }
        return false;
      } finally {
        if (!background) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!locationKey) return;
    startTransition(() => {
      void refreshForecast();
    });
  }, [locationKey, preferences.units, refreshForecast]);

  useEffect(() => {
    if (!forecast?.days[0] || !locationKey) return;

    const timezone = forecast.location.timezone;
    if (!isForecastStale(forecast.days[0].date, now, timezone)) {
      staleRefreshRef.current.attemptedForDay = null;
      return;
    }

    const todayKey = getLocalDayKey(now, timezone);
    const state = staleRefreshRef.current;
    if (state.inFlight || state.attemptedForDay === todayKey) return;

    state.inFlight = true;
    state.attemptedForDay = todayKey;

    void refreshForecast({ background: true }).finally(() => {
      state.inFlight = false;
    });
  }, [now, forecast, locationKey, refreshForecast]);

  const handleRetryStaleRefresh = useCallback(() => {
    staleRefreshRef.current.attemptedForDay = null;
    setStaleRefreshError(null);
    void refreshForecast({ background: true });
  }, [refreshForecast]);

  function handleSearch(query: string) {
    void loadWeather(query);
  }

  function handleUseLocation() {
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
  }

  function handleLocationPick(location: GeocodingResult) {
    if (!locationPicker) return;
    void applyLocation(location, locationPicker.query);
  }

  const analysis = useMemo(() => {
    if (!forecast) return [];
    return analyzeForecast(
      forecast.days,
      preferences.exercise,
      preferences.dogWalk,
      forecast.location.timezone,
      now
    );
  }, [forecast, preferences.exercise, preferences.dogWalk, now]);

  const currentHour: HourlyWeather | null = useMemo(() => {
    if (!forecast) return null;
    const timezone = forecast.location.timezone;
    const todayDay =
      forecast.days.find((day) => isSameLocalDay(day.date, now, timezone)) ??
      forecast.days[0];
    if (!todayDay) return null;

    const todayHours = todayDay.hours;
    return (
      todayHours.find(
        (h) => h.time <= now && new Date(h.time.getTime() + 3_600_000) > now
      ) ??
      todayHours[0] ??
      null
    );
  }, [forecast, now]);

  const currentStatuses = useMemo(() => {
    if (!currentHour) return { exercise: null, dogWalk: null };
    return {
      exercise: isExerciseHourSafe(currentHour, preferences.exercise).status,
      dogWalk: isDogWalkHourSafe(currentHour, preferences.dogWalk).status,
    };
  }, [currentHour, preferences.exercise, preferences.dogWalk]);

  const activeDayIndex =
    forecast && dayIndex >= forecast.days.length ? 0 : dayIndex;
  const activeDay = forecast?.days[activeDayIndex];
  const activeAnalysis = analysis[activeDayIndex];
  const todayAnalysis = forecast
    ? analysis.find((entry) =>
        isSameLocalDay(entry.date, now, forecast.location.timezone)
      ) ?? analysis[0]
    : undefined;
  const activeDayIsToday =
    !!forecast &&
    !!activeDay &&
    isSameLocalDay(activeDay.date, now, forecast.location.timezone);
  const showWelcome = !forecast;

  useEffect(() => {
    if (!showWelcome || loading || locationPicker) return;

    const query = zipInput.trim();
    if (query.length < 3) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const candidates = await searchLocations(query);
          if (cancelled || !shouldConfirmLocationPick(query, candidates)) return;
          setLocationPicker({ query, candidates });
        } catch {
          // Ignore preview lookup failures while typing.
        }
      })();
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [zipInput, showWelcome, loading, locationPicker]);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[100rem] flex-1 flex-col px-3 py-3 sm:px-5 sm:py-4">
      <header className="mb-2 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div
          className={
            showWelcome
              ? "min-w-0 text-center sm:text-left"
              : "grid min-w-0 grid-cols-[auto_1fr] gap-x-3 gap-y-0.5"
          }
        >
          {!showWelcome && (
            <div className="relative row-span-2 aspect-square w-12 overflow-hidden rounded-full shadow-sm sm:w-14">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand-mark.png"
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          )}
          <h1 className="min-w-0 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Walk Window
          </h1>
          <p className="min-w-0 text-sm text-slate-600">
            Find the best times to exercise or walk your dog — today and the next two days.
          </p>
        </div>
        {!showWelcome && (
          <div className="flex shrink-0 flex-wrap items-start justify-end gap-2">
            <LocationSelector
              compact
              zip={zipInput}
              onZipChange={setZipDraft}
              onSearch={handleSearch}
              onUseLocation={handleUseLocation}
              loading={loading}
              locationName={forecast?.location.name}
              timezone={forecast?.location.timezone}
              now={now}
            />
            <UnitToggle value={preferences.units} onChange={handleUnitsChange} />
          </div>
        )}
      </header>

      {locationPicker && (
        <LocationPickerModal
          query={locationPicker.query}
          candidates={locationPicker.candidates}
          onSelect={handleLocationPick}
          onClose={() => setLocationPicker(null)}
        />
      )}

      {showWelcome ? (
        <WelcomeScreen
          zip={zipInput}
          onZipChange={setZipDraft}
          onSearch={handleSearch}
          onUseLocation={handleUseLocation}
          loading={loading}
          error={error}
        />
      ) : (
        <>
          <CurrentWeatherSummary
            current={currentHour}
            timezone={forecast?.location.timezone}
            now={now}
            units={preferences.units}
            exerciseStatus={currentStatuses.exercise}
            dogWalkStatus={currentStatuses.dogWalk}
            exerciseResult={todayAnalysis?.exercise}
            dogWalkResult={todayAnalysis?.dogWalk}
            exercise={preferences.exercise}
            dogWalk={preferences.dogWalk}
            onExerciseChange={handleExerciseChange}
            onDogWalkChange={handleDogWalkChange}
          />

          {error && (
            <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          )}

          {staleRefreshError && (
            <div className="mt-2 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
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
        </>
      )}

      {forecast && activeDay && activeAnalysis && (
        <div className="mt-2 flex min-h-0 flex-1 flex-col">
          <ForecastDayNavigator
            dayIndex={activeDayIndex}
            dayCount={forecast.days.length}
            dayLabel={activeAnalysis.label}
            onDayIndexChange={setDayIndex}
            keyboardEnabled={!locationPicker}
            centerHeader={
              <p className="hidden w-max max-w-full rounded-full border border-amber-200/80 bg-amber-50/95 px-4 py-1.5 text-center text-xs leading-snug text-amber-950 md:inline-block md:whitespace-nowrap md:text-sm">
                Pavement temperature is an estimate — always test with your hand before walking a dog.
              </p>
            }
            header={
              <ChartActivitySelector
                value={chartActivity}
                onChange={setChartActivity}
                exercise={preferences.exercise}
                dogWalk={preferences.dogWalk}
                onExerciseChange={handleExerciseChange}
                onDogWalkChange={handleDogWalkChange}
              />
            }
          >
            <DaySummaryPanel
              timezone={forecast.location.timezone}
              now={now}
              isToday={activeDayIsToday}
              hours={activeDay.hours}
              exerciseDurationMinutes={preferences.exercise.durationMinutes}
              dogWalkDurationMinutes={preferences.dogWalk.durationMinutes}
              exercisePrefs={preferences.exercise}
              dogWalkPrefs={preferences.dogWalk}
              onExerciseDurationChange={(minutes) =>
                handleExerciseChange({ durationMinutes: minutes })
              }
              onDogWalkDurationChange={(minutes) =>
                handleDogWalkChange({ durationMinutes: minutes })
              }
              exercise={activeAnalysis.exercise}
              dogWalk={activeAnalysis.dogWalk}
            />
            <p className="mt-3 text-center text-xs text-slate-500 md:hidden">
              Use a larger screen to view the hourly chart.
            </p>
            <div className="hidden min-h-0 flex-1 md:block">
              <DayChart
                key={activeDay.date.toISOString()}
                day={activeDay}
                label={activeAnalysis.label}
                timezone={forecast.location.timezone}
                hideTitle
                fillViewport
                showCurrentTime={activeDayIsToday}
                now={now}
                activityMode={chartActivity}
                exerciseResult={activeAnalysis.exercise}
                dogWalkResult={activeAnalysis.dogWalk}
                exercisePrefs={preferences.exercise}
                dogPrefs={preferences.dogWalk}
                units={preferences.units}
              />
            </div>
          </ForecastDayNavigator>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LocationSelector } from "@/components/LocationSelector";
import { LocationPickerModal } from "@/components/LocationPickerModal";
import { CurrentWeatherSummary } from "@/components/CurrentWeatherSummary";
import { DayChart } from "@/components/DayChart";
import { ChartActivitySelector, type ChartActivityMode } from "@/components/ChartActivitySelector";
import { SettingsPanel, PreferencesButton } from "@/components/SettingsPanel";
import { ForecastDayNavigator } from "@/components/ForecastDayNavigator";
import { analyzeForecast, isDogWalkHourSafe, isExerciseHourSafe } from "@/lib/window-calculation";
import {
  fetchWeatherForLocation,
  fetchWeatherForecast,
  searchLocations,
} from "@/services/weather-api";
import {
  loadPreferences,
  savePreferences,
  usePreferences,
} from "@/services/preferences";
import type { UserPreferences } from "@/types/preferences";
import type { GeocodingResult, WeatherForecast, HourlyWeather } from "@/types/weather";

interface LocationPickerState {
  query: string;
  candidates: GeocodingResult[];
}

export function Dashboard() {
  const preferences = usePreferences();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chartActivity, setChartActivity] = useState<ChartActivityMode>("exercise");
  const [zipDraft, setZipDraft] = useState<string | null>(null);
  const zipInput = zipDraft ?? preferences.location?.zip ?? "";
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [dayIndex, setDayIndex] = useState(0);
  const [locationPicker, setLocationPicker] = useState<LocationPickerState | null>(
    null
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
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
        if (candidates.length === 1) {
          await applyLocation(candidates[0], query, units);
          return;
        }
        setLocationPicker({ query, candidates });
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

  const locationKey = preferences.location
    ? `${preferences.location.latitude},${preferences.location.longitude}`
    : null;

  useEffect(() => {
    setDayIndex(0);
  }, [locationKey]);

  useEffect(() => {
    if (!locationKey) return;

    const savedLocation = loadPreferences().location;
    if (!savedLocation?.latitude || !savedLocation.longitude) return;

    const { latitude, longitude } = savedLocation;
    const units = loadPreferences().units;
    let cancelled = false;

    async function refreshSavedLocation() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchWeatherForecast(latitude, longitude, units);
        if (cancelled) return;
        setForecast(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Something went wrong.");
          setForecast(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void refreshSavedLocation();
    return () => {
      cancelled = true;
    };
  }, [locationKey, preferences.units]);

  function handlePreferencesChange(updated: UserPreferences) {
    savePreferences(updated);
  }

  function handleSearch(query: string) {
    setZipDraft(null);
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
    if (!forecast?.days[0]) return null;
    const todayHours = forecast.days[0].hours;
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

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[100rem] flex-1 flex-col px-3 py-3 sm:px-5 sm:py-4">
      <header className="mb-2 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid min-w-0 grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <div className="relative row-span-2 aspect-square overflow-hidden rounded-full shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand-mark.png"
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
          <h1 className="min-w-0 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Walk Window
          </h1>
          <p className="min-w-0 text-sm text-slate-600">
            Find the best times to exercise or walk your dog — today and the next two days.
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
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
          <PreferencesButton onClick={() => setSettingsOpen(true)} />
        </div>
      </header>

      <SettingsPanel
        preferences={preferences}
        onChange={handlePreferencesChange}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {locationPicker && (
        <LocationPickerModal
          query={locationPicker.query}
          candidates={locationPicker.candidates}
          onSelect={handleLocationPick}
          onClose={() => setLocationPicker(null)}
        />
      )}

      <CurrentWeatherSummary
        current={currentHour}
        timezone={forecast?.location.timezone}
        now={now}
        units={preferences.units}
        loading={loading && !forecast}
        exerciseStatus={currentStatuses.exercise}
        dogWalkStatus={currentStatuses.dogWalk}
      />

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {loading && !forecast && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Loading weather data…
        </div>
      )}

      {!loading && !forecast && !error && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="font-medium text-slate-700">Get started</p>
          <p className="mt-1 text-sm text-slate-500">
            Enter a city, ZIP code, or use your current location to see walk and exercise windows.
          </p>
        </div>
      )}

      {forecast && (
        <div className="mt-2 flex min-h-0 flex-1 flex-col">
          <ForecastDayNavigator
            dayIndex={activeDayIndex}
            dayCount={forecast.days.length}
            dayLabel={activeAnalysis?.label ?? `Day ${activeDayIndex + 1}`}
            onDayIndexChange={setDayIndex}
            keyboardEnabled={!settingsOpen && !locationPicker}
            centerHeader={
              <p className="w-max max-w-full rounded-full border border-amber-200/80 bg-amber-50/95 px-4 py-1.5 text-center text-xs leading-snug text-amber-950 sm:whitespace-nowrap sm:text-sm">
                Pavement temperature is an estimate — always test with your hand before walking a dog.
              </p>
            }
            header={
              <ChartActivitySelector
                value={chartActivity}
                onChange={setChartActivity}
              />
            }
          >
            {activeDay && activeAnalysis && (
              <DayChart
                key={activeDay.date.toISOString()}
                day={activeDay}
                label={activeAnalysis.label}
                timezone={forecast.location.timezone}
                hideTitle
                fillViewport
                showCurrentTime={activeDayIndex === 0}
                now={now}
                activityMode={chartActivity}
                exerciseResult={activeAnalysis.exercise}
                dogWalkResult={activeAnalysis.dogWalk}
                exercisePrefs={preferences.exercise}
                dogPrefs={preferences.dogWalk}
                units={preferences.units}
              />
            )}
          </ForecastDayNavigator>
        </div>
      )}
    </div>
  );
}

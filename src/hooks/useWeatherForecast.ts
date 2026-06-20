"use client";

import { useCallback, useEffect, useRef, useState, startTransition } from "react";
import { getLocalDayKey, isForecastStale } from "@/lib/time-utils";
import { fetchWeatherForecast } from "@/services/weather-api";
import { loadPreferences, usePreferences } from "@/services/preferences";
import type { WeatherForecast } from "@/types/weather";

interface UseWeatherForecastOptions {
  onRefreshSuccess?: () => void;
}

export function useWeatherForecast(options: UseWeatherForecastOptions = {}) {
  const preferences = usePreferences();
  const onRefreshSuccessRef = useRef(options.onRefreshSuccess);

  useEffect(() => {
    onRefreshSuccessRef.current = options.onRefreshSuccess;
  }, [options.onRefreshSuccess]);
  const locationKey = preferences.location
    ? `${preferences.location.latitude},${preferences.location.longitude}`
    : null;

  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staleRefreshError, setStaleRefreshError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const staleRefreshRef = useRef<{ inFlight: boolean; attemptedForDay: string | null }>({
    inFlight: false,
    attemptedForDay: null,
  });

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
        setStaleRefreshError(null);
        onRefreshSuccessRef.current?.();
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

  return {
    forecast,
    setForecast,
    loading,
    setLoading,
    error,
    setError,
    staleRefreshError,
    now,
    locationKey,
    refreshForecast,
    handleRetryStaleRefresh,
  };
}

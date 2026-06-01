"use client";

import { useSyncExternalStore } from "react";
import { STORAGE_KEY } from "@/lib/constants";
import { DEFAULT_PREFERENCES } from "@/types/preferences";
import type { UserPreferences, ExercisePreferences, DogWalkPreferences } from "@/types/preferences";

const PREFERENCES_EVENT = "walk-window-preferences";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

let cachedRaw: string | null | undefined;
let cachedPrefs: UserPreferences = DEFAULT_PREFERENCES;
let cachedHasSaved = false;

function parsePreferences(raw: string | null): UserPreferences {
  if (!raw) return DEFAULT_PREFERENCES;

  try {
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      location: parsed.location ?? DEFAULT_PREFERENCES.location,
      units: parsed.units ?? DEFAULT_PREFERENCES.units,
      exercise: {
        durationMinutes:
          parsed.exercise?.durationMinutes ?? DEFAULT_PREFERENCES.exercise.durationMinutes,
        maxRealFeel: parsed.exercise?.maxRealFeel ?? DEFAULT_PREFERENCES.exercise.maxRealFeel,
      },
      dogWalk: {
        durationMinutes:
          parsed.dogWalk?.durationMinutes ?? DEFAULT_PREFERENCES.dogWalk.durationMinutes,
        maxPavement: parsed.dogWalk?.maxPavement ?? DEFAULT_PREFERENCES.dogWalk.maxPavement,
      },
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function getPreferencesSnapshot(): UserPreferences {
  if (!isBrowser()) return DEFAULT_PREFERENCES;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedPrefs;

  cachedRaw = raw;
  cachedPrefs = parsePreferences(raw);
  cachedHasSaved = raw !== null;
  return cachedPrefs;
}

function getHasSavedSnapshot(): boolean {
  if (!isBrowser()) return false;
  getPreferencesSnapshot();
  return cachedHasSaved;
}

export function loadPreferences(): UserPreferences {
  return getPreferencesSnapshot();
}

export function savePreferences(prefs: UserPreferences): void {
  if (!isBrowser()) return;

  const raw = JSON.stringify(prefs);
  if (raw === cachedRaw) return;

  localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedPrefs = prefs;
  cachedHasSaved = true;
  window.dispatchEvent(new Event(PREFERENCES_EVENT));
}

export function subscribePreferences(onStoreChange: () => void): () => void {
  const handler = () => onStoreChange();
  window.addEventListener(PREFERENCES_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(PREFERENCES_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function usePreferences(): UserPreferences {
  return useSyncExternalStore(
    subscribePreferences,
    getPreferencesSnapshot,
    () => DEFAULT_PREFERENCES
  );
}

export function useHasSavedPreferences(): boolean {
  return useSyncExternalStore(
    subscribePreferences,
    getHasSavedSnapshot,
    () => false
  );
}

export function updatePreferences(
  partial: Partial<Omit<UserPreferences, "exercise" | "dogWalk">> & {
    exercise?: Partial<ExercisePreferences>;
    dogWalk?: Partial<DogWalkPreferences>;
  }
): UserPreferences {
  const current = loadPreferences();
  const updated: UserPreferences = {
    ...current,
    ...partial,
    exercise: { ...current.exercise, ...partial.exercise },
    dogWalk: { ...current.dogWalk, ...partial.dogWalk },
  };
  savePreferences(updated);
  return updated;
}

export function hasSavedPreferences(): boolean {
  return getHasSavedSnapshot();
}

import type { TemperatureUnit, UserPreferences } from "@/types/preferences";

export function tempUnitSymbol(units: TemperatureUnit): string {
  return units === "celsius" ? "°C" : "°F";
}

export function formatTemp(value: number, units: TemperatureUnit): string {
  return `${Math.round(value)}${tempUnitSymbol(units)}`;
}

export function fahrenheitToCelsius(value: number): number {
  return Math.round(((value - 32) * 5) / 9);
}

export function celsiusToFahrenheit(value: number): number {
  return Math.round((value * 9) / 5 + 32);
}

export function convertPreferencesUnits(
  preferences: UserPreferences,
  units: TemperatureUnit
): UserPreferences {
  if (preferences.units === units) return preferences;

  const convert =
    units === "celsius" ? fahrenheitToCelsius : celsiusToFahrenheit;

  return {
    ...preferences,
    units,
    exercise: {
      ...preferences.exercise,
      maxRealFeel: convert(preferences.exercise.maxRealFeel),
    },
    dogWalk: {
      ...preferences.dogWalk,
      maxPavement: convert(preferences.dogWalk.maxPavement),
    },
  };
}

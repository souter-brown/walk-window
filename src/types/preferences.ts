export type RainTolerance = "none" | "light" | "any";
export type DogSensitivity = "low" | "normal" | "high";
export type TemperatureUnit = "fahrenheit" | "celsius";

export interface ExercisePreferences {
  durationMinutes: number;
  minRealFeel: number;
  maxRealFeel: number;
  maxHumidity: number;
  rainTolerance: RainTolerance;
}

export interface DogWalkPreferences {
  durationMinutes: number;
  minPavement: number;
  maxPavement: number;
  maxRealFeel: number;
  rainTolerance: RainTolerance;
  sensitivity: DogSensitivity;
}

export interface SavedLocation {
  zip: string;
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface UserPreferences {
  location: SavedLocation | null;
  exercise: ExercisePreferences;
  dogWalk: DogWalkPreferences;
  units: TemperatureUnit;
}

export const DEFAULT_EXERCISE: ExercisePreferences = {
  durationMinutes: 45,
  minRealFeel: 45,
  maxRealFeel: 85,
  maxHumidity: 80,
  rainTolerance: "light",
};

export const DEFAULT_DOG_WALK: DogWalkPreferences = {
  durationMinutes: 25,
  minPavement: 35,
  maxPavement: 125,
  maxRealFeel: 85,
  rainTolerance: "light",
  sensitivity: "normal",
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  location: null,
  exercise: DEFAULT_EXERCISE,
  dogWalk: DEFAULT_DOG_WALK,
  units: "fahrenheit",
};

export type TemperatureUnit = "fahrenheit" | "celsius";

export interface ExercisePreferences {
  durationMinutes: number;
  maxRealFeel: number;
}

export interface DogWalkPreferences {
  durationMinutes: number;
  maxPavement: number;
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
  maxRealFeel: 80,
};

export const DEFAULT_DOG_WALK: DogWalkPreferences = {
  durationMinutes: 25,
  maxPavement: 110,
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  location: null,
  exercise: DEFAULT_EXERCISE,
  dogWalk: DEFAULT_DOG_WALK,
  units: "fahrenheit",
};

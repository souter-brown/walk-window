export type TemperatureUnit = "fahrenheit" | "celsius";

export interface ExercisePreferences {
  durationMinutes: number;
  maxRealFeel: number;
}

export interface DogWalkPreferences {
  durationMinutes: number;
  maxPavement: number;
}

export interface RunPacePreferences {
  baselinePace: string;
  missionDistanceMiles: number;
  defaultDurationMinutes: number;
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
  runPace: RunPacePreferences;
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

export const DEFAULT_RUN_PACE: RunPacePreferences = {
  baselinePace: "10:15",
  missionDistanceMiles: 5,
  defaultDurationMinutes: 60,
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  location: null,
  exercise: DEFAULT_EXERCISE,
  dogWalk: DEFAULT_DOG_WALK,
  runPace: DEFAULT_RUN_PACE,
  units: "fahrenheit",
};

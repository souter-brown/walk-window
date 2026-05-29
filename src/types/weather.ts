export type SafetyStatus =
  | "good"
  | "caution"
  | "too_hot"
  | "too_cold"
  | "rain_risk"
  | "unsafe";

export interface HourlyWeather {
  time: Date;
  hour: number;
  airTemp: number;
  apparentTemp: number;
  humidity: number;
  precipitationProbability: number;
  cloudCover: number;
  uvIndex: number;
  isDay: boolean;
  pavementTemp: number;
}

export interface DayForecast {
  date: Date;
  label: string;
  hours: HourlyWeather[];
  sunrise: Date | null;
  sunset: Date | null;
}

export interface TimeWindow {
  start: Date;
  end: Date;
}

export interface ActivityWindowResult {
  bestWindow: TimeWindow | null;
  mustStartBy: Date | null;
  waitUntilAfter: Date | null;
  status: SafetyStatus;
}

export interface DayAnalysis {
  date: Date;
  label: string;
  exercise: ActivityWindowResult;
  dogWalk: ActivityWindowResult;
  pawSafety: SafetyStatus;
}

export interface GeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  country?: string;
}

export interface WeatherForecast {
  location: GeocodingResult;
  days: DayForecast[];
  fetchedAt: Date;
}

export interface HourlySafety {
  time: Date;
  safe: boolean;
  status: SafetyStatus;
}

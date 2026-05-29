import { estimatePavementTemp } from "@/lib/pavement";
import { getLocalHour, parseForecastLocalTime } from "@/lib/time-utils";
import type { GeocodingResult, DayForecast, HourlyWeather, WeatherForecast } from "@/types/weather";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

interface GeocodingResultItem {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  country_code?: string;
  admin1?: string;
  postcodes?: string[];
}

interface OpenMeteoGeocodingResponse {
  results?: GeocodingResultItem[];
}

interface OpenMeteoForecastResponse {
  timezone: string;
  daily?: {
    time: string[];
    sunrise: string[];
    sunset: string[];
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    apparent_temperature: number[];
    relative_humidity_2m: number[];
    precipitation_probability: number[];
    cloud_cover: number[];
    uv_index: number[];
    is_day: number[];
  };
}

function formatLocationName(result: GeocodingResultItem): string {
  const parts = [result.name];
  if (result.admin1) parts.push(result.admin1);
  return parts.join(", ");
}

function isUsZipCode(zip: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(zip.trim());
}

interface ZippopotamResponse {
  "post code": string;
  places: Array<{
    "place name": string;
    latitude: string;
    longitude: string;
    state: string;
  }>;
}

/** Authoritative lookup for US ZIP codes. */
async function geocodeUsZip(zip: string): Promise<GeocodingResult | null> {
  const normalized = zip.trim().slice(0, 5);
  const response = await fetch(`https://api.zippopotam.us/us/${normalized}`);
  if (!response.ok) return null;

  const data = (await response.json()) as ZippopotamResponse;
  const place = data.places[0];
  if (!place) return null;

  return {
    name: `${place["place name"]}, ${place.state}`,
    latitude: Number(place.latitude),
    longitude: Number(place.longitude),
    timezone: "America/New_York",
    country: "US",
  };
}

function pickOpenMeteoZipMatch(
  results: GeocodingResultItem[],
  zip: string
): GeocodingResultItem {
  const normalized = zip.trim().slice(0, 5);
  return (
    results.find((result) => result.postcodes?.includes(normalized)) ??
    results.find((result) => result.country_code === "US") ??
    results[0]
  );
}

function mapOpenMeteoResult(result: GeocodingResultItem): GeocodingResult {
  return {
    name: formatLocationName(result),
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone,
    country: result.country_code,
  };
}

export async function searchLocations(query: string): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Enter a city or ZIP code.");
  }

  if (isUsZipCode(trimmed)) {
    const zipResult = await geocodeUsZip(trimmed);
    return zipResult ? [zipResult] : [];
  }

  const params = new URLSearchParams({
    name: trimmed,
    count: "10",
    language: "en",
    format: "json",
  });

  const response = await fetch(`${GEOCODING_URL}?${params}`);
  if (!response.ok) {
    throw new Error("Unable to look up that location. Please try again.");
  }

  const data = (await response.json()) as OpenMeteoGeocodingResponse;
  if (!data.results?.length) return [];

  if (isUsZipCode(trimmed)) {
    return [mapOpenMeteoResult(pickOpenMeteoZipMatch(data.results, trimmed))];
  }

  return data.results.map(mapOpenMeteoResult);
}

export async function geocodeLocation(query: string): Promise<GeocodingResult> {
  const results = await searchLocations(query);
  if (results.length === 0) {
    throw new Error("No location found. Try a city name or ZIP code.");
  }
  return results[0];
}

/** @deprecated Use geocodeLocation */
export const geocodeZip = geocodeLocation;

interface BigDataCloudReverseResponse {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
}

function formatReverseGeocodeName(data: BigDataCloudReverseResponse): string | null {
  // Prefer locality over city — metro "city" names (e.g. Raleigh) are often wrong for suburbs.
  const place = data.locality || data.city;
  const parts = [place, data.principalSubdivision].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<GeocodingResult> {
  let name = `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`;

  try {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      localityLanguage: "en",
    });
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`
    );
    if (response.ok) {
      const data = (await response.json()) as BigDataCloudReverseResponse;
      const formatted = formatReverseGeocodeName(data);
      if (formatted) name = formatted;
    }
  } catch {
    // Keep coordinate fallback when reverse geocoding is unavailable.
  }

  return {
    name,
    latitude,
    longitude,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

function groupHourlyByDay(
  times: string[],
  timezone: string
): Map<string, number[]> {
  const dayMap = new Map<string, number[]>();

  times.forEach((time, index) => {
    const date = parseForecastLocalTime(time, timezone);
    const dayKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);

    const existing = dayMap.get(dayKey) ?? [];
    existing.push(index);
    dayMap.set(dayKey, existing);
  });

  return dayMap;
}

function getDayKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function buildDailySunMap(
  data: OpenMeteoForecastResponse
): Map<string, { sunrise: Date; sunset: Date }> {
  const sunByDay = new Map<string, { sunrise: Date; sunset: Date }>();
  if (!data.daily) return sunByDay;

  data.daily.time.forEach((dayTime, index) => {
    const sunrise = data.daily?.sunrise[index];
    const sunset = data.daily?.sunset[index];
    if (!sunrise || !sunset) return;

    sunByDay.set(getDayKey(parseForecastLocalTime(dayTime, data.timezone), data.timezone), {
      sunrise: parseForecastLocalTime(sunrise, data.timezone),
      sunset: parseForecastLocalTime(sunset, data.timezone),
    });
  });

  return sunByDay;
}

function getSunEventsFromHours(
  hours: HourlyWeather[]
): { sunrise: Date | null; sunset: Date | null } {
  const sorted = [...hours].sort((a, b) => a.time.getTime() - b.time.getTime());
  let sunrise: Date | null = null;
  let sunset: Date | null = null;

  for (let i = 1; i < sorted.length; i++) {
    if (!sorted[i - 1].isDay && sorted[i].isDay) {
      sunrise = sorted[i].time;
    }
    if (sorted[i - 1].isDay && !sorted[i].isDay) {
      sunset = sorted[i].time;
    }
  }

  return { sunrise, sunset };
}

function buildHourlyWeather(
  data: OpenMeteoForecastResponse,
  index: number
): HourlyWeather {
  const time = parseForecastLocalTime(data.hourly.time[index], data.timezone);
  const hour = getLocalHour(time, data.timezone);

  const airTemp = data.hourly.temperature_2m[index];
  const apparentTemp = data.hourly.apparent_temperature[index];
  const cloudCover = data.hourly.cloud_cover[index] ?? 0;
  const uvIndex = data.hourly.uv_index[index] ?? 0;
  const precipitationProbability =
    data.hourly.precipitation_probability[index] ?? 0;
  const isDay = data.hourly.is_day[index] === 1;

  return {
    time,
    hour,
    airTemp,
    apparentTemp,
    humidity: data.hourly.relative_humidity_2m[index],
    precipitationProbability,
    cloudCover,
    uvIndex,
    isDay,
    pavementTemp: estimatePavementTemp({
      airTemp,
      apparentTemp,
      cloudCover,
      uvIndex,
      precipitationProbability,
      hour,
      isDay,
    }),
  };
}

export async function fetchWeatherForecast(
  latitude: number,
  longitude: number,
  units: "fahrenheit" | "celsius" = "fahrenheit"
): Promise<WeatherForecast> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    hourly: [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "precipitation_probability",
      "cloud_cover",
      "uv_index",
      "is_day",
    ].join(","),
    daily: "sunrise,sunset",
    temperature_unit: units === "fahrenheit" ? "fahrenheit" : "celsius",
    timezone: "auto",
    forecast_days: "3",
  });

  const response = await fetch(`${FORECAST_URL}?${params}`);
  if (!response.ok) {
    throw new Error("Unable to fetch weather forecast. Please try again.");
  }

  const data = (await response.json()) as OpenMeteoForecastResponse;
  const location = await reverseGeocode(latitude, longitude);
  location.timezone = data.timezone;

  const dayGroups = groupHourlyByDay(data.hourly.time, data.timezone);
  const sunByDay = buildDailySunMap(data);
  const days: DayForecast[] = [];

  for (const [, indices] of dayGroups) {
    if (days.length >= 3) break;
    const hours = indices.map((i) => buildHourlyWeather(data, i));
    if (hours.length === 0) continue;

    const dayKey = getDayKey(hours[0].time, data.timezone);
    const dailySun = sunByDay.get(dayKey);
    const fallbackSun = getSunEventsFromHours(hours);

    days.push({
      date: hours[0].time,
      label: "",
      hours,
      sunrise: dailySun?.sunrise ?? fallbackSun.sunrise,
      sunset: dailySun?.sunset ?? fallbackSun.sunset,
    });
  }

  return {
    location,
    days,
    fetchedAt: new Date(),
  };
}

export async function fetchWeatherForLocation(
  location: GeocodingResult,
  units: "fahrenheit" | "celsius" = "fahrenheit"
): Promise<WeatherForecast> {
  const forecast = await fetchWeatherForecast(
    location.latitude,
    location.longitude,
    units
  );
  forecast.location.name = location.name;
  return forecast;
}

export async function fetchWeatherByLocation(
  query: string,
  units: "fahrenheit" | "celsius" = "fahrenheit"
): Promise<WeatherForecast> {
  const location = await geocodeLocation(query);
  return fetchWeatherForLocation(location, units);
}

/** @deprecated Use fetchWeatherByLocation */
export const fetchWeatherByZip = fetchWeatherByLocation;

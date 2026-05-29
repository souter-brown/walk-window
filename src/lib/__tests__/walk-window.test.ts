import { describe, expect, it } from "vitest";
import { getDayLabel, parseForecastLocalTime } from "@/lib/time-utils";
import { convertPreferencesUnits } from "@/lib/temperature";
import { isExerciseHourSafe } from "@/lib/window-calculation";
import { DEFAULT_PREFERENCES } from "@/types/preferences";
import type { HourlyWeather } from "@/types/weather";

describe("parseForecastLocalTime", () => {
  it("groups a full day into one local calendar day across viewer timezones", () => {
    const timezone = "America/Chicago";
    const dayMap = new Map<string, number>();

    for (let hour = 0; hour < 24; hour++) {
      const isoLocal = `2026-05-28T${String(hour).padStart(2, "0")}:00`;
      const date = parseForecastLocalTime(isoLocal, timezone);
      const dayKey = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);
      dayMap.set(dayKey, (dayMap.get(dayKey) ?? 0) + 1);
    }

    expect(dayMap.get("2026-05-28")).toBe(24);
    expect(dayMap.size).toBe(1);
  });
});

describe("getDayLabel", () => {
  it("labels the first three forecast days consistently in local time", () => {
    const timezone = "America/New_York";
    const day = parseForecastLocalTime("2026-05-28T12:00", timezone);

    expect(getDayLabel(0, day, timezone)).toBe("Today");
    expect(getDayLabel(1, day, timezone)).toBe("Tomorrow");
    expect(getDayLabel(2, day, timezone)).toMatch(/May/);
  });
});

describe("convertPreferencesUnits", () => {
  it("converts exercise and dog thresholds when switching to celsius", () => {
    const converted = convertPreferencesUnits(DEFAULT_PREFERENCES, "celsius");

    expect(converted.units).toBe("celsius");
    expect(converted.exercise.maxRealFeel).toBe(29);
    expect(converted.dogWalk.maxPavement).toBe(52);
  });
});

describe("isExerciseHourSafe", () => {
  const prefs = DEFAULT_PREFERENCES.exercise;

  function hour(apparentTemp: number): HourlyWeather {
    return {
      time: new Date("2026-05-28T12:00:00Z"),
      hour: 12,
      airTemp: apparentTemp,
      apparentTemp,
      humidity: 50,
      precipitationProbability: 0,
      cloudCover: 0,
      uvIndex: 5,
      isDay: true,
      pavementTemp: apparentTemp,
    };
  }

  it("marks real feel within limits as good", () => {
    expect(isExerciseHourSafe(hour(75), prefs).status).toBe("good");
  });

  it("marks real feel above max plus caution band as too hot", () => {
    expect(isExerciseHourSafe(hour(91), prefs).status).toBe("too_hot");
  });
});

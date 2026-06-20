import { describe, expect, it } from "vitest";
import { getDayLabel, getLocalDayKey, isForecastStale, parseForecastLocalTime } from "@/lib/time-utils";
import { convertPreferencesUnits } from "@/lib/temperature";
import {
  isExerciseHourSafe,
  getMobileSafeWindowLines,
  getActivityHeaderTiming,
  shouldShowMobileMustStartBy,
} from "@/lib/window-calculation";
import { DEFAULT_PREFERENCES } from "@/types/preferences";
import type { ActivityWindowResult, HourlyWeather, TimeWindow } from "@/types/weather";

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
    const now = parseForecastLocalTime("2026-05-28T08:00", timezone);
    const today = parseForecastLocalTime("2026-05-28T12:00", timezone);
    const tomorrow = parseForecastLocalTime("2026-05-29T12:00", timezone);
    const dayAfter = parseForecastLocalTime("2026-05-30T12:00", timezone);

    expect(getDayLabel(0, today, timezone, now)).toBe("Today");
    expect(getDayLabel(1, tomorrow, timezone, now)).toBe("Tomorrow");
    expect(getDayLabel(2, dayAfter, timezone, now)).toMatch(/May/);
  });

  it("does not label a stale first day as Today after midnight", () => {
    const timezone = "America/New_York";
    const now = parseForecastLocalTime("2026-05-28T08:00", timezone);
    const yesterday = parseForecastLocalTime("2026-05-27T12:00", timezone);

    expect(getDayLabel(0, yesterday, timezone, now)).toMatch(/May 27/);
  });
});

describe("convertPreferencesUnits", () => {
  it("converts exercise and dog thresholds when switching to celsius", () => {
    const converted = convertPreferencesUnits(DEFAULT_PREFERENCES, "celsius");

    expect(converted.units).toBe("celsius");
    expect(converted.exercise.maxRealFeel).toBe(27);
    expect(converted.dogWalk.maxPavement).toBe(43);
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
      dewPoint: 50,
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

describe("getMobileSafeWindowLines", () => {
  const timezone = "America/New_York";
  const prefs = DEFAULT_PREFERENCES.exercise;
  const getValue = (hour: HourlyWeather) => hour.apparentTemp;

  function makeResult(
    safeWindows: TimeWindow[],
    bestWindow: TimeWindow | null,
    mustStartBy: Date | null = null
  ): ActivityWindowResult {
    return {
      safeWindows,
      bestWindow,
      mustStartBy,
      waitUntilAfter: null,
      status: "good",
    };
  }

  function makeHourlyBlock(startIso: string, count: number, apparentTemp = 75): HourlyWeather[] {
    const start = new Date(startIso);
    return Array.from({ length: count }, (_, index) => {
      const time = new Date(start.getTime() + index * 60 * 60_000);
      return {
        time,
        hour: time.getHours(),
        airTemp: apparentTemp,
        apparentTemp,
        humidity: 50,
        dewPoint: 50,
        precipitationProbability: 0,
        cloudCover: 0,
        uvIndex: 5,
        isDay: true,
        pavementTemp: apparentTemp,
      };
    });
  }

  it("shows Now through latest start for an active primary window today", () => {
    const now = new Date("2026-05-28T08:30:00-04:00");
    const morning: TimeWindow = {
      start: new Date("2026-05-28T06:00:00-04:00"),
      end: new Date("2026-05-28T10:00:00-04:00"),
    };
    const lines = getMobileSafeWindowLines(
      makeResult([morning], morning, new Date("2026-05-28T09:15:00-04:00")),
      makeHourlyBlock("2026-05-28T06:00:00-04:00", 4),
      prefs.durationMinutes,
      getValue,
      prefs.maxRealFeel,
      now,
      timezone,
      true
    );

    expect(lines).toHaveLength(1);
    expect(lines[0].text).toMatch(/^Now – /);
    expect(lines[0].text).toContain("9:15");
    expect(lines[0].isPrimary).toBe(true);
  });

  it('shows "All Day" when the window runs from now through midnight', () => {
    const now = new Date("2026-05-28T08:30:00-04:00");
    const allDay: TimeWindow = {
      start: new Date("2026-05-28T06:00:00-04:00"),
      end: new Date("2026-05-29T00:00:00-04:00"),
    };
    const lines = getMobileSafeWindowLines(
      makeResult([allDay], allDay),
      makeHourlyBlock("2026-05-28T06:00:00-04:00", 18),
      prefs.durationMinutes,
      getValue,
      prefs.maxRealFeel,
      now,
      timezone,
      true
    );

    expect(lines).toEqual([{ text: "All Day", isPrimary: true }]);
  });

  it("lists multiple windows on the same day", () => {
    const morning: TimeWindow = {
      start: new Date("2026-05-28T06:00:00-04:00"),
      end: new Date("2026-05-28T10:00:00-04:00"),
    };
    const evening: TimeWindow = {
      start: new Date("2026-05-28T18:00:00-04:00"),
      end: new Date("2026-05-29T00:00:00-04:00"),
    };
    const lines = getMobileSafeWindowLines(
      makeResult([morning, evening], morning),
      makeHourlyBlock("2026-05-28T06:00:00-04:00", 18),
      prefs.durationMinutes,
      getValue,
      prefs.maxRealFeel,
      new Date("2026-05-28T08:30:00-04:00"),
      timezone,
      true
    );

    expect(lines).toHaveLength(2);
    expect(lines[0].isPrimary).toBe(true);
    expect(lines[1].isPrimary).toBe(false);
    expect(lines[1].text).toMatch(/6:00 PM – End of day/);
  });

  it('shows "All Day" when the window is midnight through midnight', () => {
    const allDay: TimeWindow = {
      start: new Date("2026-05-29T00:00:00-04:00"),
      end: new Date("2026-05-30T00:00:00-04:00"),
    };
    const lines = getMobileSafeWindowLines(
      makeResult([allDay], allDay),
      makeHourlyBlock("2026-05-29T00:00:00-04:00", 24),
      prefs.durationMinutes,
      getValue,
      prefs.maxRealFeel,
      new Date("2026-05-28T08:30:00-04:00"),
      timezone,
      false
    );

    expect(lines).toEqual([{ text: "All Day", isPrimary: true }]);
  });

  it("hides windows that have already ended today", () => {
    const morning: TimeWindow = {
      start: new Date("2026-05-28T06:00:00-04:00"),
      end: new Date("2026-05-28T10:00:00-04:00"),
    };
    const evening: TimeWindow = {
      start: new Date("2026-05-28T18:00:00-04:00"),
      end: new Date("2026-05-29T00:00:00-04:00"),
    };
    const lines = getMobileSafeWindowLines(
      makeResult([morning, evening], evening),
      makeHourlyBlock("2026-05-28T06:00:00-04:00", 18),
      prefs.durationMinutes,
      getValue,
      prefs.maxRealFeel,
      new Date("2026-05-28T11:00:00-04:00"),
      timezone,
      true
    );

    expect(lines).toHaveLength(1);
    expect(lines[0].text).toMatch(/6:00 PM – End of day/);
  });
});

describe("shouldShowMobileMustStartBy", () => {
  const morning: TimeWindow = {
    start: new Date("2026-05-28T06:00:00-04:00"),
    end: new Date("2026-05-28T10:00:00-04:00"),
  };
  const evening: TimeWindow = {
    start: new Date("2026-05-28T18:00:00-04:00"),
    end: new Date("2026-05-29T00:00:00-04:00"),
  };
  const mustStartBy = new Date("2026-05-28T09:15:00-04:00");

  it("shows must start by for the active primary window", () => {
    expect(
      shouldShowMobileMustStartBy(
        {
          safeWindows: [morning, evening],
          bestWindow: morning,
          mustStartBy,
          waitUntilAfter: null,
          status: "good",
        },
        new Date("2026-05-28T08:30:00-04:00"),
        true
      )
    ).toBe(true);
  });

  it("shows must start by when the first upcoming window is primary", () => {
    expect(
      shouldShowMobileMustStartBy(
        {
          safeWindows: [morning, evening],
          bestWindow: evening,
          mustStartBy: new Date("2026-05-28T21:00:00-04:00"),
          waitUntilAfter: null,
          status: "good",
        },
        new Date("2026-05-28T11:00:00-04:00"),
        true
      )
    ).toBe(true);
  });

  it("hides must start by after the primary deadline has passed", () => {
    expect(
      shouldShowMobileMustStartBy(
        {
          safeWindows: [morning, evening],
          bestWindow: morning,
          mustStartBy,
          waitUntilAfter: null,
          status: "good",
        },
        new Date("2026-05-28T09:30:00-04:00"),
        true
      )
    ).toBe(false);
  });
});

describe("getActivityHeaderTiming", () => {
  const durationMinutes = DEFAULT_PREFERENCES.exercise.durationMinutes;
  const morning: TimeWindow = {
    start: new Date("2026-05-28T06:00:00-04:00"),
    end: new Date("2026-05-28T10:00:00-04:00"),
  };
  const mustStartBy = new Date("2026-05-28T09:15:00-04:00");
  const waitUntilAfter = new Date("2026-05-28T18:30:00-04:00");

  it("shows Start by while the deadline is still ahead", () => {
    expect(
      getActivityHeaderTiming(
        {
          safeWindows: [morning],
          bestWindow: morning,
          mustStartBy,
          waitUntilAfter,
          status: "caution",
        },
        new Date("2026-05-28T08:30:00-04:00"),
        durationMinutes
      )
    ).toEqual({ kind: "startBy", time: mustStartBy });
  });

  it("shows Wait until after Start by has passed", () => {
    expect(
      getActivityHeaderTiming(
        {
          safeWindows: [morning],
          bestWindow: morning,
          mustStartBy,
          waitUntilAfter,
          status: "caution",
        },
        new Date("2026-05-28T09:30:00-04:00"),
        durationMinutes
      )
    ).toEqual({ kind: "waitUntil", time: waitUntilAfter });
  });

  it("shows Wait until at the next safe window after Start by has passed", () => {
    const evening: TimeWindow = {
      start: new Date("2026-05-28T18:00:00-04:00"),
      end: new Date("2026-05-29T00:00:00-04:00"),
    };

    expect(
      getActivityHeaderTiming(
        {
          safeWindows: [morning, evening],
          bestWindow: morning,
          mustStartBy,
          waitUntilAfter: null,
          status: "good",
        },
        new Date("2026-05-28T11:05:00-04:00"),
        60
      )
    ).toEqual({ kind: "waitUntil", time: evening.start });
  });

  it("shows Wait until when now is in caution between safe windows", () => {
    const evening: TimeWindow = {
      start: new Date("2026-05-28T18:00:00-04:00"),
      end: new Date("2026-05-29T00:00:00-04:00"),
    };

    expect(
      getActivityHeaderTiming(
        {
          safeWindows: [morning, evening],
          bestWindow: evening,
          mustStartBy: null,
          waitUntilAfter: null,
          status: "caution",
        },
        new Date("2026-05-28T11:12:00-04:00"),
        60
      )
    ).toEqual({ kind: "waitUntil", time: evening.start });
  });

  it("returns null when there is nothing actionable left today", () => {
    expect(
      getActivityHeaderTiming(
        {
          safeWindows: [morning],
          bestWindow: morning,
          mustStartBy,
          waitUntilAfter: new Date("2026-05-28T09:00:00-04:00"),
          status: "too_hot",
        },
        new Date("2026-05-28T11:00:00-04:00"),
        durationMinutes
      )
    ).toBeNull();
  });
});

describe("isForecastStale", () => {
  it("detects when the first forecast day is not the current local day", () => {
    const timezone = "America/New_York";
    const now = parseForecastLocalTime("2026-05-28T08:00", timezone);
    const yesterday = parseForecastLocalTime("2026-05-27T12:00", timezone);
    const today = parseForecastLocalTime("2026-05-28T12:00", timezone);

    expect(isForecastStale(yesterday, now, timezone)).toBe(true);
    expect(isForecastStale(today, now, timezone)).toBe(false);
    expect(getLocalDayKey(now, timezone)).toBe("2026-05-28");
  });
});

describe("shouldConfirmLocationPick", () => {
  it("asks for confirmation when a partial city name resolves to one place", async () => {
    const { shouldConfirmLocationPick } = await import("@/services/weather-api");
    const candidates = [{ name: "Fuquay-Varina, North Carolina", latitude: 35.58, longitude: -78.8, timezone: "America/New_York" }];

    expect(shouldConfirmLocationPick("Fuquay", candidates)).toBe(true);
    expect(shouldConfirmLocationPick("Fuquay-Varina", candidates)).toBe(false);
  });

  it("asks for confirmation when several places match", async () => {
    const { shouldConfirmLocationPick } = await import("@/services/weather-api");
    const candidates = [
      { name: "Springfield, Illinois", latitude: 39.8, longitude: -89.65, timezone: "America/Chicago" },
      { name: "Springfield, Massachusetts", latitude: 42.1, longitude: -72.59, timezone: "America/New_York" },
    ];

    expect(shouldConfirmLocationPick("Springfield", candidates)).toBe(true);
  });
});

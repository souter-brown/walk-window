import { describe, expect, it } from "vitest";
import {
  buildStartTimePaceChartPoints,
  formatPaceBreakdown,
  formatSecondsToPace,
  getCoolPaceThresholdLabel,
  getDewPointAdjustment,
  getDewPointAdjustmentBandRows,
  getPaceCalculationExplanation,
  getRealFeelAdjustmentBandRows,
  getRealFeelOffset,
  getRunPaceRecommendation,
  parsePaceToSeconds,
} from "@/lib/run-pace-mission";
import type { HourlyWeather } from "@/types/weather";

function hour(apparentTemp: number, dewPoint: number, time: Date): HourlyWeather {
  return {
    time,
    hour: time.getHours(),
    airTemp: apparentTemp,
    apparentTemp,
    humidity: 50,
    dewPoint,
    precipitationProbability: 0,
    cloudCover: 0,
    uvIndex: 0,
    isDay: true,
    pavementTemp: apparentTemp,
  };
}

describe("parsePaceToSeconds", () => {
  it("parses mm:ss pace strings", () => {
    expect(parsePaceToSeconds("10:15")).toBe(615);
    expect(parsePaceToSeconds("12:50")).toBe(770);
  });

  it("rejects invalid pace strings", () => {
    expect(parsePaceToSeconds("10:5")).toBeNull();
    expect(parsePaceToSeconds("abc")).toBeNull();
  });
});

describe("formatSecondsToPace", () => {
  it("formats seconds as mm:ss", () => {
    expect(formatSecondsToPace(770)).toBe("12:50");
  });
});

describe("formatPaceBreakdown", () => {
  it("summarizes baseline, heat, humidity, and mission pace", () => {
    const endTime = new Date("2026-05-28T08:00:00-04:00");
    const endHour = hour(82, 71, endTime);

    const result = getRunPaceRecommendation({
      baselinePace: "10:15",
      missionDistanceMiles: 5,
      startTime: new Date("2026-05-28T07:00:00-04:00"),
      durationMinutes: 60,
      endHour,
      currentHour: null,
      units: "fahrenheit",
    });

    expect(formatPaceBreakdown(result!)).toBe("10:15 baseline + 0:45 heat + 0:20 humidity → 11:20");
  });
});

describe("getRealFeelOffset", () => {
  it("maps real feel bands to pace offsets", () => {
    expect(getRealFeelOffset(58).seconds).toBe(0);
    expect(getRealFeelOffset(65).seconds).toBe(15);
    expect(getRealFeelOffset(82).seconds).toBe(45);
    expect(getRealFeelOffset(106).runWalkRecommended).toBe(true);
  });
});

describe("getDewPointAdjustment", () => {
  it("maps dew point bands to pace adjustments", () => {
    expect(getDewPointAdjustment(58).seconds).toBe(0);
    expect(getDewPointAdjustment(71).seconds).toBe(20);
    expect(getDewPointAdjustment(78).highHumidityWarning).toBe(true);
    expect(getDewPointAdjustment(78).runWalkStronglyRecommended).toBe(true);
  });
});

describe("getRealFeelAdjustmentBandRows", () => {
  it("lists all heat bands and marks the active band", () => {
    const rows = getRealFeelAdjustmentBandRows("fahrenheit", 82);

    expect(rows).toHaveLength(9);
    expect(rows.filter((row) => row.isActive)).toHaveLength(1);
    expect(rows.find((row) => row.isActive)?.bandLabel).toBe("80°F–84°F");
    expect(rows.find((row) => row.isActive)?.adjustmentLabel).toBe("+0:45/mi");
    expect(rows[0]?.adjustmentLabel).toBe("Run/walk");
  });
});

describe("getDewPointAdjustmentBandRows", () => {
  it("lists all humidity bands and marks the active band", () => {
    const rows = getDewPointAdjustmentBandRows("fahrenheit", 71);

    expect(rows).toHaveLength(7);
    expect(rows.find((row) => row.isActive)?.bandLabel).toBe("70°F–72°F");
    expect(rows.find((row) => row.isActive)?.adjustmentLabel).toBe("+0:20/mi");
  });
});

describe("getPaceCalculationExplanation", () => {
  it("explains baseline, heat, and humidity steps", () => {
    const endTime = new Date("2026-05-28T08:00:00-04:00");
    const endHour = hour(82, 71, endTime);

    const recommendation = getRunPaceRecommendation({
      baselinePace: "10:15",
      missionDistanceMiles: 5,
      startTime: new Date("2026-05-28T07:00:00-04:00"),
      durationMinutes: 60,
      endHour,
      currentHour: null,
      units: "fahrenheit",
    });

    const explanation = getPaceCalculationExplanation(recommendation!, "fahrenheit");

    expect(explanation.summary).toBe("10:15 + 0:45 heat + 0:20 humidity = 11:20/mi");
    expect(explanation.steps).toHaveLength(4);
    expect(explanation.segments).toHaveLength(3);
  });
});

describe("getCoolPaceThresholdLabel", () => {
  it("returns the Real Feel threshold in the user's units", () => {
    expect(getCoolPaceThresholdLabel("fahrenheit")).toBe("<60°F");
    expect(getCoolPaceThresholdLabel("celsius")).toBe("<16°C");
  });
});

describe("buildStartTimePaceChartPoints", () => {
  it("builds a pace point for each start hour on the selected day", () => {
    const hours = [
      hour(70, 55, new Date("2026-05-28T07:00:00-04:00")),
      hour(82, 71, new Date("2026-05-28T08:00:00-04:00")),
      hour(106, 72, new Date("2026-05-28T14:00:00-04:00")),
    ];

    const points = buildStartTimePaceChartPoints({
      hours,
      selectedStartTime: new Date("2026-05-28T08:00:00-04:00"),
      durationMinutes: 60,
      baselinePace: "10:15",
      missionDistanceMiles: 5,
      timezone: "America/New_York",
      units: "fahrenheit",
    });

    expect(points).toHaveLength(3);
    expect(points.find((point) => point.isSelectedStart)?.paceLabel).toBe("11:20 / mile");
    expect(points.some((point) => point.runWalkRecommended)).toBe(true);
  });
});

describe("getRunPaceRecommendation", () => {
  it("combines baseline, real feel, and dew point into mission pace", () => {
    const endTime = new Date("2026-05-28T08:00:00-04:00");
    const endHour = hour(82, 71, endTime);

    const result = getRunPaceRecommendation({
      baselinePace: "10:15",
      missionDistanceMiles: 5,
      startTime: new Date("2026-05-28T07:00:00-04:00"),
      durationMinutes: 60,
      endHour,
      currentHour: null,
      units: "fahrenheit",
    });

    expect(result?.missionPaceLabel).toBe("11:20 / mile");
    expect(result?.estimatedMissionTimeLabel).toBe("56:40");
    expect(result?.warnings).toContain("Humidity will reduce cooling efficiency.");
  });

  it("returns run/walk recommendation for extreme heat", () => {
    const endTime = new Date("2026-05-28T14:00:00-04:00");
    const endHour = hour(106, 72, endTime);

    const result = getRunPaceRecommendation({
      baselinePace: "10:15",
      missionDistanceMiles: 5,
      startTime: new Date("2026-05-28T13:00:00-04:00"),
      durationMinutes: 60,
      endHour,
      currentHour: null,
      units: "fahrenheit",
    });

    expect(result?.missionPaceLabel).toBe("Run/Walk recommended");
    expect(result?.warnings).toContain("Run/Walk recommended. Do not chase pace.");
  });
});

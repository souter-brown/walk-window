/**
 * Estimates blacktop/pavement surface temperature from atmospheric data.
 *
 * This is a simplified heuristic — not a measured surface reading.
 * Sunny, low-cloud hours add heat; rain, clouds, and night reduce it.
 */
export interface PavementInput {
  airTemp: number;
  apparentTemp: number;
  cloudCover: number;
  uvIndex: number;
  precipitationProbability: number;
  hour: number;
  isDay: boolean;
}

export function estimatePavementTemp(input: PavementInput): number {
  const {
    airTemp,
    apparentTemp,
    cloudCover,
    uvIndex,
    precipitationProbability,
    hour,
    isDay,
  } = input;

  let estimate = airTemp;

  if (isDay) {
    // Clear sky + high UV can raise pavement well above air temp.
    const sunExposure = ((100 - cloudCover) / 100) * Math.min(uvIndex, 11) / 11;
    const solarBoost = sunExposure * 28;
    estimate += solarBoost;

    // Afternoon peak: pavement lags air but peaks mid-afternoon.
    const afternoonFactor = Math.sin(((hour - 6) / 12) * Math.PI);
    if (afternoonFactor > 0) {
      estimate += afternoonFactor * 6;
    }
  } else {
    // Overnight pavement cools faster than air.
    estimate -= 8;
  }

  // Real-feel pulls estimate toward perceived heat/cold.
  const feelDelta = (apparentTemp - airTemp) * 0.35;
  estimate += feelDelta;

  // Rain wets and cools the surface.
  const rainCooling = (precipitationProbability / 100) * 18;
  estimate -= rainCooling;

  // Heavy cloud cover blocks direct solar heating even during the day.
  if (isDay && cloudCover > 70) {
    estimate -= (cloudCover - 70) * 0.15;
  }

  return Math.round(estimate);
}

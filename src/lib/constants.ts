export const STORAGE_KEY = "walk-window-preferences";

export const DAY_LABELS = ["Today", "Tomorrow", "Day After"] as const;

export const STATUS_LABELS: Record<string, string> = {
  good: "Good",
  caution: "Caution",
  too_hot: "Too Hot",
  too_cold: "Too Cold",
  rain_risk: "Rain Risk",
  unsafe: "Unsafe",
};

export const STATUS_COLORS: Record<string, string> = {
  good: "bg-emerald-100 text-emerald-800 border-emerald-200",
  caution: "bg-amber-100 text-amber-800 border-amber-200",
  too_hot: "bg-orange-100 text-orange-800 border-orange-200",
  too_cold: "bg-sky-100 text-sky-800 border-sky-200",
  rain_risk: "bg-blue-100 text-blue-800 border-blue-200",
  unsafe: "bg-rose-100 text-rose-800 border-rose-200",
};

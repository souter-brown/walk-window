"use client";

import { useEffect } from "react";
import { convertPreferencesUnits, tempUnitSymbol } from "@/lib/temperature";
import type {
  DogWalkPreferences,
  ExercisePreferences,
  RainTolerance,
  DogSensitivity,
  TemperatureUnit,
  UserPreferences,
} from "@/types/preferences";

interface SettingsPanelProps {
  preferences: UserPreferences;
  onChange: (prefs: UserPreferences) => void;
  open: boolean;
  onClose: () => void;
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
        />
        {suffix && <span className="text-xs text-slate-500">{suffix}</span>}
      </div>
    </label>
  );
}

function SelectInput<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PreferencesButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-400 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
      aria-haspopup="dialog"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-4 w-4 text-slate-500"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.113a7.047 7.047 0 0 1 0-2.228L2.054 4.786a1 1 0 0 1 .205-1.251l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.993 6.993 0 0 1 7.84 1.804ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
          clipRule="evenodd"
        />
      </svg>
      Preferences
    </button>
  );
}

export function SettingsPanel({
  preferences,
  onChange,
  open,
  onClose,
}: SettingsPanelProps) {
  const tempUnit = tempUnitSymbol(preferences.units);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  function updateExercise(partial: Partial<ExercisePreferences>) {
    onChange({
      ...preferences,
      exercise: { ...preferences.exercise, ...partial },
    });
  }

  function updateDogWalk(partial: Partial<DogWalkPreferences>) {
    onChange({
      ...preferences,
      dogWalk: { ...preferences.dogWalk, ...partial },
    });
  }

  const rainOptions: { value: RainTolerance; label: string }[] = [
    { value: "none", label: "No rain" },
    { value: "light", label: "Light rain OK" },
    { value: "any", label: "Any rain OK" },
  ];

  const sensitivityOptions: { value: DogSensitivity; label: string }[] = [
    { value: "low", label: "Low (heat tolerant)" },
    { value: "normal", label: "Normal" },
    { value: "high", label: "High (heat sensitive)" },
  ];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
        aria-label="Close preferences"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="preferences-title"
        className="relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="preferences-title" className="text-lg font-bold text-slate-900">
            Preferences
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto px-5 py-5">
          <SelectInput<TemperatureUnit>
            label="Temperature units"
            value={preferences.units}
            onChange={(units) => onChange(convertPreferencesUnits(preferences, units))}
            options={[
              { value: "fahrenheit", label: "Fahrenheit (°F)" },
              { value: "celsius", label: "Celsius (°C)" },
            ]}
          />

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Exercise</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <NumberInput
                label="Duration"
                value={preferences.exercise.durationMinutes}
                onChange={(v) => updateExercise({ durationMinutes: v })}
                min={10}
                max={180}
                suffix="min"
              />
              <NumberInput
                label="Min real feel"
                value={preferences.exercise.minRealFeel}
                onChange={(v) => updateExercise({ minRealFeel: v })}
                suffix={tempUnit}
              />
              <NumberInput
                label="Max real feel"
                value={preferences.exercise.maxRealFeel}
                onChange={(v) => updateExercise({ maxRealFeel: v })}
                suffix={tempUnit}
              />
              <NumberInput
                label="Max humidity"
                value={preferences.exercise.maxHumidity}
                onChange={(v) => updateExercise({ maxHumidity: v })}
                min={0}
                max={100}
                suffix="%"
              />
              <SelectInput
                label="Rain tolerance"
                value={preferences.exercise.rainTolerance}
                onChange={(v) => updateExercise({ rainTolerance: v })}
                options={rainOptions}
              />
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Dog walk</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <NumberInput
                label="Duration"
                value={preferences.dogWalk.durationMinutes}
                onChange={(v) => updateDogWalk({ durationMinutes: v })}
                min={5}
                max={120}
                suffix="min"
              />
              <NumberInput
                label="Min pavement est."
                value={preferences.dogWalk.minPavement}
                onChange={(v) => updateDogWalk({ minPavement: v })}
                suffix={tempUnit}
              />
              <NumberInput
                label="Max pavement est."
                value={preferences.dogWalk.maxPavement}
                onChange={(v) => updateDogWalk({ maxPavement: v })}
                suffix={tempUnit}
              />
              <SelectInput
                label="Rain tolerance"
                value={preferences.dogWalk.rainTolerance}
                onChange={(v) => updateDogWalk({ rainTolerance: v })}
                options={rainOptions}
              />
              <SelectInput
                label="Dog sensitivity"
                value={preferences.dogWalk.sensitivity}
                onChange={(v) => updateDogWalk({ sensitivity: v })}
                options={sensitivityOptions}
              />
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Settings are saved automatically locally in your browser.
          </p>
        </div>
      </div>
    </div>
  );
}

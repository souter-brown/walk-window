"use client";

import { tempUnitSymbol } from "@/lib/temperature";
import type { TemperatureUnit } from "@/types/preferences";

const inputClassName =
  "min-w-0 rounded border border-slate-400 bg-white px-1.5 py-0.5 text-center text-xs text-slate-900 shadow-sm focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-200";

const stepperFieldClassName =
  "h-9 min-w-0 rounded border border-slate-400 bg-white text-center text-xs text-slate-900 shadow-sm focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-200 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none sm:h-8";

const stepperButtonClassName =
  "flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded border border-slate-400 bg-white text-base font-semibold leading-none text-slate-700 shadow-sm active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:w-8 sm:text-sm";

function clampValue(value: number, min?: number, max?: number): number {
  let next = value;
  if (min !== undefined) next = Math.max(min, next);
  if (max !== undefined) next = Math.min(max, next);
  return next;
}

export function StepperNumberInput({
  id,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  suffix,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  "aria-label"?: string;
}) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        type="button"
        aria-label={`Decrease ${ariaLabel ?? "value"}`}
        disabled={value <= min}
        onClick={() => onChange(clampValue(value - step, min, max))}
        className={stepperButtonClassName}
      >
        −
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-label={ariaLabel}
        onChange={(e) => {
          const parsed = Number(e.target.value);
          if (!Number.isNaN(parsed)) onChange(clampValue(parsed, min, max));
        }}
        className={`${stepperFieldClassName} w-12 sm:w-14`}
      />
      <button
        type="button"
        aria-label={`Increase ${ariaLabel ?? "value"}`}
        disabled={max !== undefined && value >= max}
        onClick={() => onChange(clampValue(value + step, min, max))}
        className={stepperButtonClassName}
      >
        +
      </button>
      {suffix && <span className="text-[10px] text-slate-500">{suffix}</span>}
    </span>
  );
}

const formStepperButtonClassName =
  "flex h-[42px] w-10 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-slate-400 bg-white text-lg font-semibold leading-none text-slate-700 shadow-sm active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40";

const formStepperFieldClassName =
  "h-[42px] min-w-0 flex-1 rounded-lg border border-slate-400 bg-white px-3 text-center text-base text-slate-900 shadow-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

/** Full-width −/+ stepper sized to match mission form inputs. */
export function FormStepperInput({
  id,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  "aria-label"?: string;
}) {
  return (
    <span className="flex w-full items-center gap-1">
      <button
        type="button"
        aria-label={`Decrease ${ariaLabel ?? "value"}`}
        disabled={value <= min}
        onClick={() => onChange(clampValue(value - step, min, max))}
        className={formStepperButtonClassName}
      >
        −
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-label={ariaLabel}
        onChange={(e) => {
          const parsed = Number(e.target.value);
          if (!Number.isNaN(parsed)) onChange(clampValue(parsed, min, max));
        }}
        className={formStepperFieldClassName}
      />
      <button
        type="button"
        aria-label={`Increase ${ariaLabel ?? "value"}`}
        disabled={max !== undefined && value >= max}
        onClick={() => onChange(clampValue(value + step, min, max))}
        className={formStepperButtonClassName}
      >
        +
      </button>
    </span>
  );
}

export function CompactNumberInput({
  id,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  "aria-label"?: string;
}) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-label={ariaLabel}
        onChange={(e) => {
          const parsed = Number(e.target.value);
          if (!Number.isNaN(parsed)) onChange(clampValue(parsed, min, max));
        }}
        className={`${inputClassName} w-12 sm:w-14`}
      />
      {suffix && <span className="text-[10px] text-slate-500">{suffix}</span>}
    </span>
  );
}

export function ResponsiveStepperInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  "aria-label": ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  "aria-label"?: string;
}) {
  const inputProps = {
    value,
    onChange,
    min,
    max,
    step,
    suffix,
    "aria-label": ariaLabel,
  };

  return (
    <>
      <span className="inline-flex md:hidden">
        <StepperNumberInput {...inputProps} />
      </span>
      <span className="hidden md:inline-flex">
        <CompactNumberInput {...inputProps} />
      </span>
    </>
  );
}

export function CompactMaxInput({
  value,
  onChange,
  units,
  maxLimit = 150,
  step = 1,
  "aria-label": ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  units: TemperatureUnit;
  maxLimit?: number;
  step?: number;
  "aria-label"?: string;
}) {
  const unit = tempUnitSymbol(units);
  const label = ariaLabel ?? `Maximum ${unit}`;

  return (
    <label className="mt-1 inline-flex items-center justify-center gap-0.5 text-[10px] text-slate-500 sm:text-xs">
      Max
      <ResponsiveStepperInput
        value={value}
        onChange={onChange}
        min={0}
        max={maxLimit}
        step={step}
        suffix={unit}
        aria-label={label}
      />
    </label>
  );
}

export function UnitToggle({
  value,
  onChange,
}: {
  value: TemperatureUnit;
  onChange: (units: TemperatureUnit) => void;
}) {
  return (
    <fieldset className="inline-flex shrink-0 rounded-md border border-slate-400 bg-white p-0.5 shadow-sm">
      <legend className="sr-only">Temperature units</legend>
      {(["fahrenheit", "celsius"] as const).map((unit) => (
        <button
          key={unit}
          type="button"
          onClick={() => onChange(unit)}
          className={`rounded px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 sm:text-sm ${
            value === unit
              ? "bg-sky-600 text-white"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {unit === "fahrenheit" ? "°F" : "°C"}
        </button>
      ))}
    </fieldset>
  );
}

"use client";

export type ChartActivityMode = "exercise" | "dogWalk";

interface ChartActivitySelectorProps {
  value: ChartActivityMode;
  onChange: (value: ChartActivityMode) => void;
}

const options: { value: ChartActivityMode; label: string }[] = [
  { value: "exercise", label: "Exercise" },
  { value: "dogWalk", label: "Dog walk" },
];

export function ChartActivitySelector({
  value,
  onChange,
}: ChartActivitySelectorProps) {
  return (
    <fieldset className="flex shrink-0 items-center gap-3">
      <legend className="sr-only">Compare charts to</legend>
      {options.map((option) => {
        const id = `chart-activity-${option.value}`;
        return (
          <label
            key={option.value}
            htmlFor={id}
            className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
          >
            <input
              id={id}
              type="radio"
              name="chart-activity"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            {option.label}
          </label>
        );
      })}
    </fieldset>
  );
}

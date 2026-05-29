"use client";

import { useEffect } from "react";

interface ForecastDayNavigatorProps {
  dayIndex: number;
  dayCount: number;
  dayLabel: string;
  onDayIndexChange: (index: number) => void;
  keyboardEnabled?: boolean;
  centerHeader?: React.ReactNode;
  header?: React.ReactNode;
  children: React.ReactNode;
}

function NavArrow({
  direction,
  disabled,
  onClick,
  label,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:text-slate-300 sm:h-11 sm:w-11"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-6 w-6 sm:h-7 sm:w-7"
        aria-hidden="true"
      >
        {direction === "prev" ? (
          <path
            fillRule="evenodd"
            d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
            clipRule="evenodd"
          />
        ) : (
          <path
            fillRule="evenodd"
            d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        )}
      </svg>
    </button>
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function ForecastDayNavigator({
  dayIndex,
  dayCount,
  dayLabel,
  onDayIndexChange,
  keyboardEnabled = true,
  centerHeader,
  header,
  children,
}: ForecastDayNavigatorProps) {
  const canGoPrev = dayIndex > 0;
  const canGoNext = dayIndex < dayCount - 1;

  useEffect(() => {
    if (!keyboardEnabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;

      if (event.key === "ArrowLeft" && canGoPrev) {
        event.preventDefault();
        onDayIndexChange(dayIndex - 1);
      } else if (event.key === "ArrowRight" && canGoNext) {
        event.preventDefault();
        onDayIndexChange(dayIndex + 1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [keyboardEnabled, dayIndex, canGoPrev, canGoNext, onDayIndexChange]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
        <div className="col-start-1 row-start-1 min-w-0 sm:justify-self-start">
          <h2 className="text-lg font-bold text-slate-900">{dayLabel}</h2>
          <p className="text-sm text-slate-700">
            Day {dayIndex + 1} of {dayCount} · Use ← → keys
          </p>
        </div>

        {header && (
          <div className="col-start-2 row-start-1 min-w-0 justify-self-end sm:col-start-3">
            {header}
          </div>
        )}

        {centerHeader && (
          <div className="col-span-2 col-start-1 row-start-2 w-full justify-self-center sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:w-auto sm:px-2">
            {centerHeader}
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 items-stretch gap-2 sm:gap-3">
        <div className="flex shrink-0 items-center">
          <NavArrow
            direction="prev"
            disabled={!canGoPrev}
            onClick={() => onDayIndexChange(dayIndex - 1)}
            label={`Previous day${canGoPrev ? "" : " (unavailable)"}`}
          />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>

        <div className="flex shrink-0 items-center">
          <NavArrow
            direction="next"
            disabled={!canGoNext}
            onClick={() => onDayIndexChange(dayIndex + 1)}
            label={`Next day${canGoNext ? "" : " (unavailable)"}`}
          />
        </div>
      </div>
    </div>
  );
}

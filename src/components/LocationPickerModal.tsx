"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { GeocodingResult } from "@/types/weather";

interface LocationPickerModalProps {
  query: string;
  candidates: GeocodingResult[];
  onSelect: (location: GeocodingResult) => void;
  onClose: () => void;
}

export function LocationPickerModal({
  query,
  candidates,
  onSelect,
  onClose,
}: LocationPickerModalProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
        aria-label="Close location picker"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-picker-title"
        className="relative z-10 flex max-h-[min(80vh,520px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 id="location-picker-title" className="text-lg font-bold text-slate-900">
            Choose a location
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {candidates.length > 1 ? (
              <>
                Multiple places match &ldquo;{query}&rdquo;. Pick the one you want.
              </>
            ) : (
              <>Did you mean this place for &ldquo;{query}&rdquo;?</>
            )}
          </p>
        </div>

        <ul className="overflow-y-auto px-3 py-3">
          {candidates.map((candidate) => (
            <li key={`${candidate.latitude},${candidate.longitude},${candidate.name}`}>
              <button
                type="button"
                onClick={() => onSelect(candidate)}
                className="mb-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-left transition hover:border-sky-300 hover:bg-sky-50"
              >
                <span className="block font-medium text-slate-900">{candidate.name}</span>
                {candidate.country && (
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {candidate.country}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body
  );
}

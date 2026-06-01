"use client";

import { LocationSelector } from "@/components/LocationSelector";

interface WelcomeScreenProps {
  zip: string;
  onZipChange: (zip: string) => void;
  onSearch: (zip: string) => void;
  onUseLocation: () => void;
  loading: boolean;
  error: string | null;
}

export function WelcomeScreen({
  zip,
  onZipChange,
  onSearch,
  onUseLocation,
  loading,
  error,
}: WelcomeScreenProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 shadow-sm sm:px-10 sm:py-12">
      <div className="mx-auto max-w-md text-center">
        <h2 className="text-lg font-semibold text-slate-800 sm:text-xl">Get started</h2>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Enter a city or ZIP code, or use your location, to see walk and exercise windows for
          today and the next two days.
        </p>
      </div>

      {error && (
        <div className="mx-auto mt-6 max-w-md rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm text-rose-800">
          {error}
        </div>
      )}

      <div className="mx-auto mt-8 max-w-sm">
        <LocationSelector
          welcome
          zip={zip}
          onZipChange={onZipChange}
          onSearch={onSearch}
          onUseLocation={onUseLocation}
          loading={loading}
        />
      </div>

      <div className="mx-auto mt-8 flex justify-center sm:mt-10">
        <div className="relative h-40 w-40 overflow-hidden rounded-full shadow-lg sm:h-48 sm:w-48">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand-mark.png"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { formatTimezoneShort } from "@/lib/time-utils";

interface LocationSelectorProps {
  zip: string;
  onZipChange: (zip: string) => void;
  onSearch: (zip: string) => void;
  onUseLocation: () => void;
  loading: boolean;
  locationName?: string;
  timezone?: string;
  now?: Date;
  compact?: boolean;
  /** Renders inline after the location buttons (e.g. unit toggle). */
  trailing?: ReactNode;
  /** Centered search for the welcome / start screen */
  welcome?: boolean;
}

function LocationCaption({
  locationName,
  timezone,
  now,
  compact,
}: {
  locationName: string;
  timezone?: string;
  now?: Date;
  compact?: boolean;
}) {
  const timezoneLabel =
    timezone && now ? formatTimezoneShort(timezone, now) : null;
  const caption = timezoneLabel ? `${locationName} · ${timezoneLabel}` : locationName;

  if (compact) {
    return (
      <p
        className="truncate text-xs text-slate-700 sm:max-w-[16rem] sm:text-right"
        title={caption}
      >
        {caption}
      </p>
    );
  }

  return (
    <p className="mt-3 text-sm text-slate-600">
      Showing weather for{" "}
      <span className="font-medium text-slate-900">{caption}</span>
    </p>
  );
}

function MyLocationButton({
  onClick,
  disabled,
  size,
}: {
  onClick: () => void;
  disabled?: boolean;
  size: "compact" | "welcome";
}) {
  const className =
    size === "compact"
      ? "rounded-md border border-slate-400 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      : "flex-1 rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      My Location
    </button>
  );
}

export function LocationSelector({
  zip,
  onZipChange,
  onSearch,
  onUseLocation,
  loading,
  locationName,
  timezone,
  now,
  compact = false,
  trailing,
  welcome = false,
}: LocationSelectorProps) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSearch(zip.trim());
  }

  if (welcome) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-3">
        <input
          id="location-welcome"
          type="text"
          maxLength={80}
          placeholder="City or ZIP code"
          aria-label="City or ZIP code"
          value={zip}
          onChange={(e) => onZipChange(e.target.value)}
          className="w-full rounded-lg border border-slate-400 bg-white px-4 py-2.5 text-center text-base text-slate-900 shadow-sm placeholder:text-slate-500 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200"
        />
        <div className="flex w-full items-center justify-center gap-2">
          <button
            type="submit"
            disabled={loading || !zip.trim()}
            className="min-w-[5.5rem] flex-1 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "…" : "Go"}
          </button>
          <MyLocationButton
            onClick={onUseLocation}
            disabled={loading}
            size="welcome"
          />
        </div>
      </form>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-col items-stretch gap-1 sm:items-end">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-1.5">
          <input
            id="location"
            type="text"
            maxLength={80}
            placeholder="City or ZIP"
            aria-label="City or ZIP code"
            value={zip}
            onChange={(e) => onZipChange(e.target.value)}
            className="w-20 rounded-md border border-slate-400 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-500 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200 sm:w-36"
          />
          <button
            type="submit"
            disabled={loading || !zip.trim()}
            className="rounded-md bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "…" : "Go"}
          </button>
          <MyLocationButton
            onClick={onUseLocation}
            disabled={loading}
            size="compact"
          />
          {trailing}
        </form>
        {locationName && (
          <LocationCaption
            locationName={locationName}
            timezone={timezone}
            now={now}
            compact
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="location" className="mb-1 block text-sm font-medium text-slate-700">
            City or ZIP code
          </label>
          <input
            id="location"
            type="text"
            maxLength={80}
            placeholder="e.g. Denver or 80202"
            value={zip}
            onChange={(e) => onZipChange(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
        </div>
        <div className="flex gap-2 sm:items-end">
          <button
            type="submit"
            disabled={loading || !zip.trim()}
            className="flex-1 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
          >
            {loading ? "Loading…" : "Search"}
          </button>
          <button
            type="button"
            onClick={onUseLocation}
            disabled={loading}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
          >
            My Location
          </button>
        </div>
      </form>
      {locationName && (
        <LocationCaption
          locationName={locationName}
          timezone={timezone}
          now={now}
        />
      )}
    </div>
  );
}

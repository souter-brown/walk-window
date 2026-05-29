"use client";

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
        className="max-w-[16rem] truncate text-right text-xs text-slate-700"
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
}: LocationSelectorProps) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSearch(zip.trim());
  }

  if (compact) {
    return (
      <div className="flex flex-col items-end gap-1">
        <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
          <input
            id="location"
            type="text"
            maxLength={80}
            placeholder="City or ZIP"
            aria-label="City or ZIP code"
            value={zip}
            onChange={(e) => onZipChange(e.target.value)}
            className="w-28 rounded-md border border-slate-400 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-500 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200 sm:w-36"
          />
          <button
            type="submit"
            disabled={loading || !zip.trim()}
            className="rounded-md bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "…" : "Go"}
          </button>
          <button
            type="button"
            onClick={onUseLocation}
            disabled={loading}
            title="Use my location"
            aria-label="Use my location"
            className="rounded-md border border-slate-400 bg-white p-1.5 text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .81-.531c.263-.232.513-.483.738-.752.226-.27.435-.562.618-.87a7.097 7.097 0 0 0 .533-1.033 6.982 6.982 0 0 0 .462-2.282c0-.936-.166-1.832-.462-2.282a7.098 7.098 0 0 0-.533-1.033 7.045 7.045 0 0 0-.618-.87 5.716 5.716 0 0 0-.738-.752 5.74 5.74 0 0 0-.81-.53l-.018-.009-.006-.003ZM10 8.25a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
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
            Use my location
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

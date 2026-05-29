export function AppFooter() {
  return (
    <footer className="mt-auto shrink-0 px-3 py-4 sm:px-5">
      <details className="mx-auto max-w-2xl rounded-lg border border-slate-400/40 bg-white/60 px-4 py-3 text-slate-800 shadow-sm backdrop-blur-sm">
        <summary className="cursor-pointer text-center text-sm font-medium text-slate-800 hover:text-slate-950">
          Privacy & data
        </summary>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
          <p>
            Walk Window runs in your browser. When you search a city, ZIP code, or use
            your location, your device sends that request to third-party weather and
            geocoding services (Open-Meteo, Zippopotam.us, and BigDataCloud for reverse
            geocoding). We do not operate a backend or store your location on our
            servers.
          </p>
          <p>
            Your exercise and dog-walk preferences, plus your last chosen location, are
            saved in this browser&apos;s local storage only. Clearing site data removes
            them.
          </p>
          <p>
            Pavement temperature and walk windows are estimates for planning — not
            veterinary or medical advice.
          </p>
        </div>
      </details>
      <p className="mt-3 text-center text-xs text-slate-700">
        Walk Window · Built for safer walks and workouts
      </p>
    </footer>
  );
}

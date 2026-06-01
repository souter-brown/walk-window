const CREATOR_NAME = "Josh Souter-Brown";
const CREATOR_URL = "https://www.souter-brown.com";

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-sky-800 underline decoration-sky-800/30 underline-offset-2 hover:text-sky-950 hover:decoration-sky-950/50"
    >
      {children}
    </a>
  );
}

function FooterPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-lg border border-slate-400/40 bg-white/60 px-4 py-3 text-slate-800 shadow-sm backdrop-blur-sm">
      <summary className="cursor-pointer text-center text-sm font-medium text-slate-800 hover:text-slate-950">
        {title}
      </summary>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">{children}</div>
    </details>
  );
}

export function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto shrink-0 px-3 py-4 sm:px-5">
      <div className="mx-auto flex max-w-2xl flex-col gap-2">
        <FooterPanel title="About & credits">
          <p>
            <strong>Walk Window</strong> was created by{" "}
            <ExternalLink href={CREATOR_URL}>{CREATOR_NAME}</ExternalLink>. The app
            design, safety logic, pavement estimates, and walk/exercise planning are
            original work — built as a personal, non-commercial project.
          </p>
          <p>
            <strong>Weather data</strong> ©{" "}
            <ExternalLink href="https://open-meteo.com/">Open-Meteo</ExternalLink> (
            <ExternalLink href="https://creativecommons.org/licenses/by/4.0/">
              CC BY 4.0
            </ExternalLink>
            ). City search uses Open-Meteo geocoding; US ZIP codes via{" "}
            <ExternalLink href="https://zippopotam.us/">Zippopotam.us</ExternalLink>;
            &ldquo;Use my location&rdquo; place names via{" "}
            <ExternalLink href="https://www.bigdatacloud.com/">BigDataCloud</ExternalLink>.
          </p>
          <p>
            Built with{" "}
            <ExternalLink href="https://nextjs.org/">Next.js</ExternalLink>,{" "}
            <ExternalLink href="https://react.dev/">React</ExternalLink>, and{" "}
            <ExternalLink href="https://recharts.org/">Recharts</ExternalLink>.
          </p>
        </FooterPanel>

        <FooterPanel title="Privacy & data">
          <p>
            Walk Window runs in your browser. When you search a city, ZIP code, or use
            your location, your device sends that request directly to the weather and
            geocoding providers listed above. There is no Walk Window backend and your
            location is not stored on our servers.
          </p>
          <p>
            Your exercise and dog-walk preferences, plus your last chosen location, are
            saved in this browser&apos;s local storage only. Clearing site data removes
            them.
          </p>
          <p>
            Pavement temperature and walk windows are estimates for planning — not
            veterinary or medical advice. Always test pavement with your hand before
            walking a dog.
          </p>
        </FooterPanel>
      </div>

      <p className="mx-auto mt-4 max-w-2xl text-center text-xs leading-relaxed text-slate-700">
        © {year} {CREATOR_NAME} · Walk Window · Personal, non-commercial use only
      </p>
      <p className="mt-1 text-center text-xs text-slate-600">
        Built for safer walks and workouts
      </p>
    </footer>
  );
}

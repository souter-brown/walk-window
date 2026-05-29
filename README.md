# Walk Window

Find the best times to exercise or walk your dog using a 3-day hourly forecast, safety bands, and walk/exercise windows.

## Features

- Search by **US ZIP code** or **city name** (with disambiguation when multiple places match)
- **Use my location** via browser geolocation
- **Exercise** and **dog walk** modes with configurable thresholds
- Hourly charts with safety shading, sunrise/sunset, must-start and wait-until lines
- Navigate **Today / Tomorrow / Day 3** with side arrows or ← → keys
- Preferences saved in your browser (localStorage)
- Fahrenheit or Celsius
- **Installable** — add to your phone home screen (PWA manifest)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run test` | Run unit tests |
| `npm run lint` | ESLint |

## Data sources

- [Open-Meteo](https://open-meteo.com/) — weather forecast and city geocoding
- [Zippopotam.us](https://zippopotam.us/) — US ZIP code lookup
- [BigDataCloud](https://www.bigdatacloud.com/) — reverse geocoding for “Use my location”

No API keys required. Weather and geocoding requests run from the browser.

## Privacy

See the **Privacy & data** section at the bottom of the app. In short:

- Location searches are sent to third-party weather/geocoding APIs from your browser
- Preferences and last location are stored in **localStorage** on your device only
- There is no Walk Window backend or user account

## Install on your phone

After deploying (or on localhost in some browsers):

- **iPhone (Safari):** Share → Add to Home Screen
- **Android (Chrome):** Menu → Install app / Add to Home screen

The app uses a web manifest and dog icon for a standalone home-screen experience.

## Deploy to Vercel

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. Sign in at [vercel.com](https://vercel.com) and **Import Project**.
3. Select the repo — Vercel auto-detects Next.js.
4. Click **Deploy** (no environment variables required).

Or with the [Vercel CLI](https://vercel.com/docs/cli):

```bash
npm i -g vercel
vercel
```

Production build locally:

```bash
npm run build
npm run start
```

## Notes

- Pavement temperature is an **estimate** — always test with your hand before walking a dog.
- Window logic uses hourly buckets and ±5° caution bands; it is a planning aid, not medical or veterinary advice.

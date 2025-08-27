# Omeka Map Explorer (SvelteKit)

Interactive SvelteKit app to visualize newspaper article locations from an Omeka S collection. It features a Leaflet map (with optional choropleth), a D3 timeline with playback, and filters for country and year range.

## Tech stack

- SvelteKit (Svelte 5, TypeScript)
- Tailwind CSS v4
- Leaflet for maps
- D3 (selection/scale/axis/shape/time) for the timeline
- Vitest and Playwright for tests

## App structure

Key folders under `src/`:

- `lib/api/geoJsonService.ts` – load world/country GeoJSON and compute counts
- `lib/components/` – UI
	- `maps/Map.svelte`, `maps/ChoroplethLayer.svelte`
	- `filters/CountryFilter.svelte`, `filters/YearRangeFilter.svelte`
	- `timeline/Timeline.svelte`, `timeline/AnimationController.ts`
	- `ui/*` – small UI kit (sidebar, card, inputs, etc.)
- `lib/state/` – Svelte 5 runes stores (`$state`) for app, map, filters, time
- `lib/types/` – TS models and ambient declarations for D3/Leaflet
- `lib/utils/staticDataLoader.ts` – loads `static/data/*.json`
- `routes/+page.svelte` – main page; `routes/+page.ts` sets `export const ssr = false`
- `static/data/` – inputs: `articles.json`, `index.json`, `maps/*.geojson`

## Scripts

Run from this folder:

```powershell
npm install            # install deps
npm run dev            # start dev server
npm run build          # production build
npm run preview        # preview build

npm run check          # svelte-check (types)
npm run format         # prettier --write
npm run lint           # prettier --check

npm test               # e2e + unit
npm run test:unit      # unit tests only
npm run test:e2e       # Playwright tests
```

## Data inputs

Place these files under `static/data/`:

- `articles.json` – article metadata (id, title, newspaper, country, date, etc.)
- `index.json` – places index with coordinates and optional `Country`
- `maps/world_countries.geojson` – world polygons
- Optional country/regional GeoJSON files (e.g., `benin_regions.geojson`)

You can generate `articles.json` and `index.json` using the Python scripts at the repo root (`scripts/prepare_json.py` and `scripts/add_countries.py`). By default they write to `static/data/` here.

## SSR and browser-only libs

The main route disables SSR via `export const ssr = false` to avoid Leaflet/D3 SSR issues. Components also guard on `browser` before using window-bound APIs.

## Testing

- Unit tests: Vitest under `src/**.test.ts`
- E2E tests: Playwright under `e2e/`

## License

MIT

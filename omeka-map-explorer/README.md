# Omeka Map Explorer (SvelteKit)

Developer documentation for the IWAC Spatial Overview app. For the dashboard’s purpose and audience, see the root `README.md`.

This SvelteKit application renders an exploratory dashboard over the Islam West Africa Collection (IWAC) newspapers: interactive maps (Leaflet), time exploration (D3 timeline), filters, and entity views. It ships as a static site (SPA) and loads JSON/GeoJSON from `static/data/`.

## Requirements

- Node.js 18+ (CI uses Node 20)
- npm (repo uses npm scripts)
- Local data files under `static/data/` (see Data section)

SSR is disabled for the main route to avoid Leaflet/D3 SSR issues (`export const ssr = false`).

## Quick start

Run from this folder:

```powershell
npm install            # install dependencies
npm run dev            # start dev server (SPA)
npm run build          # static production build
npm run preview        # preview built site

npm run check          # type and Svelte checks
npm run format         # prettier --write
npm run lint           # prettier --check

npm test               # unit + e2e (where configured)
npm run test:unit      # Vitest only
npm run test:e2e       # Playwright only
```

## Data inputs (static)

Place these under `static/data/`:

- `articles.json` — article metadata (id, title, newspaper, country, date, etc.)
- `index.json` — places index with coordinates and (optionally) `Country`
- `entities/` — entity JSON files (persons, organizations, events, subjects)
- `maps/world_countries.geojson` — world polygons; optional regional files (e.g., `benin_regions.geojson`)
- Optional: `networks/global.json` — experimental network dataset

Data can be prepared via Python scripts at the repo root (see `scripts/`):

- `scripts/prepare_json.py` — export `articles.json`, `index.json`
- `scripts/preprocess_entities.py` — generate `entities/*.json`
- `scripts/add_countries.py` — add Country to places using polygons
- `scripts/build_networks.py` — tiny network placeholder

The app reads these files at runtime using `lib/utils/staticDataLoader.ts`.

## Project structure

Key areas under `src/`:

- `lib/api/geoJsonService.ts` — load world/country GeoJSON and compute counts
- `lib/components/` — UI components
  - `maps/Map.svelte`, `maps/ChoroplethLayer.svelte`
  - `filters/*` — country/year range and related filters
  - `timeline/Timeline.svelte`, `timeline/AnimationController.ts`
  - `entities/*` — generic + entity-specific views (persons, orgs, events, subjects)
  - `ui/*` — shadcn-svelte styled primitives (sidebar, card, inputs)
- `lib/state/` — Svelte 5 runes stores (`$state`) for app, filters, map, time
- `lib/types/` — TS models and ambient declarations for D3/Leaflet
- `lib/utils/` — static data loader, entity loader, URL manager
- `routes/+page.svelte` — entry page; `routes/+page.ts` sets `export const ssr = false`
- `static/data/` — JSON/GeoJSON inputs

## State and architecture

- Svelte 5 runes are used throughout (`$state`, `$derived`, `$props`, `$effect`).
- Global app state lives in `lib/state/` (active view, selected entity, filters, timeline, map).
- Heavy libraries (Leaflet, D3) are used client-side only; components gate on `browser` where needed.
- Entity visualizations are modular: generic building blocks + entity-specific wrappers.

## Testing

- Unit tests: Vitest in `src/**/*.test.ts`
  - Setup files: `vitest-setup-client.ts` (jsdom) and `vitest-setup-server.ts`
  - Mock SvelteKit runtime and browser APIs as needed
- E2E: Playwright under `e2e/`

Useful commands (from this folder):

```powershell
npm run test:unit
npm run test:e2e
```

## Styling

- Tailwind CSS v4 with shadcn-svelte components
- Prefer Tailwind utility classes; keep custom CSS minimal

## Deployment

- Static build via `npm run build` produces `build/`
- Deployed with GitHub Pages through the repo workflow
- Base path is configured for `/IWAC-spatial-overview` in `svelte.config.js`

## Troubleshooting

- Blank map or missing data: confirm JSON/GeoJSON files exist under `static/data/` and paths match
- SSR errors: ensure `export const ssr = false` remains set in `routes/+page.ts`
- Type or module issues: run `npm run check` and review `vitest-setup-*.ts`

## License

MIT

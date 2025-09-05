# IWAC Spatial Overview (SvelteKit App)

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

- `scripts/preprocess_all.py` — unified script to export, enrich, and build all data files.
- `scripts/build_country_focus_counts.py` — generates regional/prefecture counts for specific countries.
- `scripts/build_networks.py` — creates a network graph from entity relationships.
- `scripts/build_world_map_cache.py` — pre-computes data for the world map visualization.

The app reads these files at runtime using `lib/utils/staticDataLoader.ts`.

## Project structure

Key areas under `src/`:

- `lib/api/` — services for loading external data (GeoJSON, country focus counts, world map cache).
- `lib/components/` — UI components organized by feature:
  - `world-map/WorldMapVisualization.svelte` — main world map view.
  - `country-focus/CountryFocus.svelte` — detailed view for a selected country.
  - `entities/*` — generic and specific views for exploring entities (persons, organizations, etc.).
  - `network/*` — components for network graph visualization.
  - `overview/*` — dashboard overview components.
  - `filters/*` — filtering UI components.
  - `ui/*` — shadcn-svelte styled primitives (sidebar, card, inputs).
- `lib/state/` — Svelte 5 runes stores (`$state`) for managing global app state.
- `lib/types/` — TypeScript models and ambient declarations.
- `lib/utils/` — data loaders, URL manager, and other utilities.
- `routes/+page.svelte` — the main entry page for the application.
- `static/data/` — static JSON/GeoJSON data files.

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

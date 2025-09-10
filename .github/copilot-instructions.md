# IWAC Spatial Overview

Interactive web application for exploring newspaper article locations from an Omeka S collection (Islam West Africa Collection) with interactive maps,network graphs, and filtering capabilities.

## Tech Stack
- **Frontend**: SvelteKit with Svelte 5 (runes syntax), TypeScript
- **Styling**: Tailwind CSS v4 + shadcn-svelte  
- **Visualizations**: Leaflet (maps), Sigma.js/Graphology (networks), D3 (timeline)
- **Data**: Static JSON/GeoJSON files in `static/data/`
- **Testing**: Vitest for unit tests, Playwright for E2E tests
- **Build Tool**: Vite

> Use MCP Context7 to verify latest Sigma.js, Svelte 5, and Graphology documentation when needed.

## Project Structure
```
scripts/              # Python data preprocessing
├── preprocess_*.py   # Generate static data files
└── requirements.txt

omeka-map-explorer/   # SvelteKit application  
├── src/lib/
│   ├── api/         # Data services
│   ├── components/  # UI components (maps, network, filters, timeline)
│   ├── state/       # Svelte 5 runes stores (.svelte.ts)
│   └── utils/       # Helpers
├── routes/          # SPA pages
└── static/data/     # Generated JSON/GeoJSON
```

## Key Patterns
- Use Svelte 5 runes: `$state()`, `$derived()`, `$effect()`, `$props()`
- All state management in `.svelte.ts` files
- Client-side only (SPA mode, `ssr = false`)
- Load data from static files, no API calls
- TypeScript required for all components

## Build & Run
```bash
## Component Architecture (modular & maintainable)
- Prefer small, composable components with single responsibility.
- Co-locate components by feature: `src/lib/components/<feature>/...` with an optional `index.ts` barrel for exports when helpful.
- Keep state, selectors, and business logic in runes stores (`.svelte.ts`) under `src/lib/state/` or next to the component when feature-scoped.
- Pass data via typed props; avoid implicit globals. Derive view-only state with `$derived()` to keep templates simple.
- Keep effects side-effect free and always return a cleanup function in `$effect()` for event listeners, timers, and subscriptions.
- For complex views (map, network, filters), compose multiple focused children rather than one monolith. Extract pure helpers into `src/lib/utils/`.
- Avoid deep prop drilling: prefer small context providers at feature boundaries or well-scoped stores.
- Name components and stores clearly: `<Feature><Part>.svelte` and `<feature>.svelte.ts` for the store.

## Testing
Use Vitest for unit/component tests and Playwright for end-to-end flows.

### Commands
- Type/Kit checks: `npm run check` (or `npm run check:watch`)
- Unit tests: `npm run test` (watch) or `npm run test:ci` (run once)
- E2E tests: `npm run test:e2e`

### Unit & Component tests (Vitest + Testing Library)
- Place tests next to source or route files using `*.test.ts` / `*.test.tsx` (e.g., `page.svelte.test.ts`).
- Import `@testing-library/jest-dom/vitest` at the top of tests for matchers.
- SvelteKit runtime in tests: mock `$app/environment`, `$app/paths`, and `$app/stores` when rendering route components.
- WebGL-heavy libs (Sigma.js, canvas):
	- jsdom lacks WebGL; mock `sigma` and Graphology in tests.
	- Use the provided setup shims:
		- `vitest-setup-client.ts` includes `matchMedia`, `ResizeObserver`, and canvas/WebGL context stubs.
		- `vitest-setup-server.ts` shims minimal SvelteKit payload.
	- Either import the setup at test top or configure as Vitest `setupFiles` (recommended).
- Prefer testing behavior and accessibility over implementation details:
	- Query by role/label text, assert ARIA states, and simulate user events.
	- Stub data loaders to avoid network/FS access in unit tests.

Suggested Vitest config (if/when adding `vitest.config.ts`):
- test.environment: `jsdom`
- test.setupFiles: `['./vitest-setup-client.ts']`
- test.globals: `true`

### End-to-End tests (Playwright)
- Keep tests in `omeka-map-explorer/e2e/`.
- Prefer user-visible selectors; add `data-testid` only when necessary.
- For map/network interactions, assert visible UI outcomes, not pixel-perfect canvases.
- Ensure the dev or preview server is available; configure `webServer` in `playwright.config.ts` or start it manually.

### What to test
- Critical flows: loading data, filtering, map pan/zoom controls, network graph render toggles, timeline brushing.
- Edge cases: empty datasets, large datasets, slow loads (use timeouts/mocks), missing fields in JSON.
- Accessibility: headings present, controls labeled, keyboard focus order.

## Data workflow
- Data is static and shipped in `static/data/` (also mirrored under `build/data/` in production outputs).
- Generate/update derived files using Python scripts in `scripts/`.
- A convenience script exists for networks: `npm run build:data:networks` (requires Python 3 on PATH).

## Best practices for this app
- Types & schemas:
	- Define domain types in `src/lib/types/` and keep JSON shapes in sync.
	- Validate inputs at edges; for critical ingestion, consider lightweight runtime checks during preprocessing.
- Performance:
	- Lazy-load heavy visualizations when possible; avoid blocking the main thread.
	- Use `$derived()` to minimize recomputation; avoid expensive work inside templates.
	- Debounce map/graph interactions; clean up listeners in `$effect()` cleanups.
- Accessibility & UX:
	- Ensure keyboard operability; provide visible focus and ARIA labels.
	- Prefer semantic HTML and test with Testing Library queries by role/name.
- Styling:
	- Use Tailwind utilities consistently; prefer `tailwind-merge` for conditional classes.
	- Keep design tokens/utilities centralized where appropriate.
- Code quality:
	- Run `npm run check` and unit tests before committing; keep PRs small and focused.
	- Keep components modular, avoid tight coupling between map/network/timeline pieces.
- Environment:
	- The app runs client-only; guard browser-only code with `if (browser)` when needed.
	- Avoid direct `fetch` from tests; stub loaders instead.

# Prepare data (once)
cd scripts && pip install -r requirements.txt
python preprocess_locations.py && python preprocess_entities.py && python preprocess_network.py

# Development
cd omeka-map-explorer && npm install && npm run dev
```
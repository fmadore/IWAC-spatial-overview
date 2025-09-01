# IWAC Spatial Overview — Dashboard & Entity Visualizations Roadmap

This document summarizes the new dashboard scaffold and outlines the plan to add entity-based visualizations (Persons, Organizations, Events, Subjects) alongside the existing country map.

## current status (done)
- Sidebar-driven dashboard shell (shadcn-svelte blocks style) added.
  - Layout wraps content with `Sidebar.Provider` and `Sidebar.Inset`.
  - New components:
    - `AppSidebar` (navigation: Overview, By Country (Map), Persons, Organizations, Events, Subjects)
    - `SiteHeader` (sticky header displaying current visualization name)
    - `SectionCards` (KPI cards: articles, countries, time span)
    - `ChartAreaInteractive` (placeholder for interactive chart)
    - `DataTable` (sample records)
- App state extended:
  - `activeView`: 'dashboard' | 'map' | 'list' | 'stats' (default 'dashboard')
  - `activeVisualization`: 'overview' | 'byCountry' | 'persons' | 'organizations' | 'events' | 'subjects'
- `+page.svelte` renders dashboard blocks when `activeView = 'dashboard'`, and falls back to the existing Map + Timeline when `activeView = 'map'`.

## goals
- Enable users to select an entity type (Person/Organization/Event/Subject) and explore associated locations and articles.
- Provide clear navigation to switch between dashboard visualizations and the existing country map.
- Keep the app responsive and accessible, leveraging shadcn-svelte and Tailwind v4.

## data model & contracts
- Source files: `static/data/articles.json` and `static/data/index.json`.
- Entity types (from `index.json` Type): Lieux (Places), Personnes, Événements, Organisations, Sujets.
- Extend loader (`staticDataLoader.ts`) to return:
  - `entitiesByType: Record<string, Array<{ label: string; count: number; coords?: [number, number][]; relatedArticleIds: string[] }>>`
  - `articleEntities: Record<string, { persons: string[]; organizations: string[]; events: string[]; subjects: string[]; places: string[] }>`
  - Aggregations by entity for quick map/timeline summaries.

## ui & navigation
- Sidebar items map to `appState.activeVisualization`:
  - Overview → Dashboard cards, timeline, sample data
  - By Country (Map) → Existing map view (choropleth/bubbles)
  - Persons/Organizations/Events/Subjects → Entity explorer view
- Entity explorer view (new):
  - Searchable/paginated list of entities with counts
  - Selecting an entity updates the map, timeline, and table to the related articles/locations
  - Clear selection resets the dashboard view

## implementation phases
1) Loader & types
- Extend `staticDataLoader.ts` to compute entities and mappings described above.
- Update types under `$lib/types` if needed for entity shapes.

2) State & wiring
- Add optional `selectedEntity: { type: 'persons'|'organizations'|'events'|'subjects'; label: string } | null` to app state.
- Update derived selectors to produce `visibleItems` for the current entity selection when applicable.

3) Entity Explorer
- Create `EntityExplorer.svelte` with list + search + select.
- Add a detail header with context and “clear selection” action.

4) Map & timeline integration
- When an entity is selected, update `mapData.visibleItems` and recompute counts for choropleth/bubbles.
- Add a small timeline chart variation filtered to the selection.

5) Polish & accessibility
- Ensure keyboard navigation in sidebar and lists.
- Headings and ARIA roles for tables and charts.

6) Testing
- Unit tests for loader aggregation, state transitions, and derived filtering.
- E2E tests for sidebar navigation, entity selection, and view updates.

## risks & assumptions
- Coordinates for some entities (esp. non-places) may be missing; we’ll derive locations via related articles’ places.
- Aggregation can be computed client-side on load; cache the results to avoid recomputation.

## quick references (files)
- Layout: `src/routes/+layout.svelte`
- Dashboard shell: `AppSidebar`, `SiteHeader`, `SectionCards`, `ChartAreaInteractive`, `DataTable`
- State: `src/lib/state/appState.svelte.ts`, `mapData`, `filters`, `timeData`
- Loader: `src/lib/utils/staticDataLoader.ts`
- Map & Timeline: `src/lib/components/maps/*`, `src/lib/components/timeline/*`

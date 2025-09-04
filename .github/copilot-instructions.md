# IWAC Spatial Overview - GitHub Copilot Instructions

## Project Overview

This repository contains the IWAC Spatial Overview, a SvelteKit application for exploring newspaper article locations from an Omeka S collection. The app features interactive maps with choropleth visualization, timeline controls with playback functionality, and filtering capabilities for countries and date ranges.

## Technology Stack & Framework Versions

- **Frontend Framework**: SvelteKit with Svelte 5 (using new runes syntax)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 with shadcn-svelte components
- **Maps**: Leaflet for interactive maps with choropleth layers
- **Data Visualization**: D3 modules (selection, scale, axis, shape, time) for timeline
- **Testing**: Vitest for unit tests, Playwright for E2E tests
- **Build Tool**: Vite
- **Node Version**: 18+ (CI uses Node 20)

## Repository Structure

### Main Application (`omeka-map-explorer/`)
```
omeka-map-explorer/
├── src/
│   ├── lib/
│   │   ├── api/geoJsonService.ts        # GeoJSON loading & geographic calculations
│   │   ├── components/
│   │   │   ├── entities/                # Entity visualization components
│   │   │   ├── maps/                    # Leaflet map & choropleth components
│   │   │   ├── filters/                 # Country & year range filters
│   │   │   ├── timeline/                # D3 timeline with animation controller
│   │   │   └── ui/                      # shadcn-svelte UI components
│   │   ├── hooks/                       # Svelte hooks (mobile detection)
│   │   ├── state/                       # Svelte 5 runes stores ($state)
│   │   ├── types/                       # TypeScript type definitions
│   │   └── utils/                       # Static data loader, entity loader, URL manager
│   ├── routes/
│   │   ├── +layout.svelte               # App layout with sidebar provider
│   │   ├── +page.svelte                 # Main application page
│   │   └── +page.ts                     # Sets ssr = false (SPA mode)
│   ├── app.css                          # Tailwind CSS with custom properties
│   └── app.html                         # HTML shell
├── static/data/                         # Static JSON & GeoJSON data files
│   └── entities/                        # Entity JSON files (persons, organizations, etc.)
├── e2e/                                 # Playwright E2E tests
└── src/**/*.test.ts                     # Vitest unit tests
```

### Data Preparation Scripts (`scripts/`)
- Python scripts for preparing JSON data from Omeka S API
- `preprocess_entities.py` for generating entity JSON files from index.json
- `requirements.txt` for Python dependencies

## Build & Development Commands

### Prerequisites
- Node.js 18+ (recommended: use Node 20 for compatibility with CI)
- Navigate to `omeka-map-explorer/` directory for all commands

### Development Workflow
```bash
cd omeka-map-explorer
npm install                    # Install dependencies (always run first)
npm run dev                    # Start development server
npm run check                  # TypeScript type checking
npm run format                 # Format code with Prettier
npm run lint                   # Check code formatting
```

### Testing
```bash
npm run test:unit              # Run Vitest unit tests (interactive watch mode)
npm run test:ci                # Run Vitest unit tests (single run for CI)
npm run test:e2e              # Run Playwright E2E tests
npm run test                  # Run unit tests in single-run mode
```

### Production Build
```bash
npm run build                 # Build for production (static site)
npm run preview               # Preview production build locally
```

## Coding Standards & Architecture

### Svelte 5 Patterns
- **Use runes syntax**: `$state`, `$derived`, `$props`, `$effect`
- **State management**: Centralized in `src/lib/state/` using runes
- **Component props**: Use `let { prop } = $props<Type>()` pattern
- **Derived state**: Use `$derived.by(() => ...)` for complex calculations

### Component Architecture
- **UI Components**: Located in `src/lib/components/ui/` (shadcn-svelte based)
- **Feature Components**: Organized by domain (maps, filters, timeline)
- **Entity Components**: Organized in `src/lib/components/entities/` for entity exploration
  - Generic reusable components: `entity-selector.svelte`, `entity-stats-cards.svelte`, `entity-locations-list.svelte`, `entity-articles-table.svelte`, `entity-visualization.svelte`
  - Entity-specific views: `persons-visualization.svelte`, `organizations-visualization.svelte`, `events-visualization.svelte`, `subjects-visualization.svelte`
  - Barrel exports via `index.ts` for clean imports
- **State**: Global reactive stores using Svelte 5 runes in `src/lib/state/`

### TypeScript Guidelines
- All components use TypeScript
- Type definitions in `src/lib/types/`
- Ambient declarations for external libraries (D3, Leaflet)

### Styling Guidelines
- **Tailwind CSS v4**: Use latest syntax and features
- **CSS Custom Properties**: Defined in `app.css` for theming
- **Component Styling**: Use Tailwind classes, avoid custom CSS
- **shadcn-svelte**: Use existing UI components from `src/lib/components/ui/`

## Key Files & Their Purposes

### Core Application Files
- `src/routes/+page.svelte`: Main application entry point with data loading and routing
- `src/lib/state/`: Reactive state management (appState, mapData, filters, timeData)
- `src/lib/utils/staticDataLoader.ts`: Loads and processes static JSON data
- `src/lib/utils/entityLoader.ts`: Lazy loading for entity data
- `src/lib/utils/urlManager.svelte.ts`: URL routing and state synchronization

### Entity Visualization System
- `src/lib/components/entities/entity-visualization.svelte`: Generic, reusable visualization component
- `src/lib/components/entities/persons-visualization.svelte`: Person-specific view using generic component
- `src/lib/components/entities/organizations-visualization.svelte`: Organization-specific view
- `src/lib/components/entities/events-visualization.svelte`: Event-specific view
- `src/lib/components/entities/subjects-visualization.svelte`: Subject-specific view

### Configuration Files
- `svelte.config.js`: SvelteKit config with GitHub Pages deployment setup
- `tailwind.config.cjs`: Tailwind v4 config with shadcn-svelte theme
- `vite.config.ts`: Vite configuration
- `tsconfig.json`: TypeScript configuration
- `playwright.config.ts`: E2E testing configuration

## Data Flow & State Management

1. **Data Loading**: `staticDataLoader.ts` loads articles.json and index.json
2. **Entity Loading**: `entityLoader.ts` lazy loads entity data (persons, organizations, events, subjects)
3. **State Stores**: Data flows through reactive stores in `src/lib/state/`
4. **Filtering**: `filters.svelte.ts` manages country, date, and entity filters
5. **Map Visualization**: `mapData.svelte.ts` handles geographic data and view modes
6. **Timeline**: `timeData.svelte.ts` manages temporal data and playback
7. **URL Management**: `urlManager.svelte.ts` handles routing and deep-linking

## Testing Strategy

### Unit Tests (Vitest)
- **Framework**: Vitest with @testing-library/svelte for component testing
- **Environment**: Dual workspace setup (client/server) with jsdom for browser simulation
- **Patterns**:
  - **Component Tests**: Use `render()` from @testing-library/svelte, test accessibility and user interactions
  - **State Tests**: Test Svelte 5 runes stores and derived state calculations
  - **Utility Tests**: Test pure functions like URL management, data loaders, and calculations
- **Mocking Strategy**:
  - Mock SvelteKit runtime (`$app/environment`, `$app/stores`, `$app/navigation`, `$app/paths`)
  - Mock data loaders to avoid network/file operations in tests
  - Use `vi.hoisted()` for mocks that need to be available before module imports
- **Setup Files**:
  - `vitest-setup-client.ts`: Browser environment setup with matchMedia, ResizeObserver stubs
  - `vitest-setup-server.ts`: Node environment setup
- **File Patterns**:
  - Component tests: `*.svelte.test.ts` (run in jsdom)
  - Utility tests: `*.test.ts` (run in Node.js)
- **Commands**:
  - `npm run test:unit` - Interactive watch mode
  - `npm run test:ci` - Single run for CI
  - `npm run test` - Alias for single run

### E2E Tests (Playwright)
- **Framework**: Playwright for full browser automation
- **Scope**: End-to-end user workflows across the full application
- **Test Areas**:
  - Navigation and routing between dashboard/map views
  - Map interactions (zoom, pan, choropleth visualization)
  - Filter functionality (countries, date ranges, entity selection)
  - Timeline controls and playback functionality
  - Entity exploration workflows
- **Commands**:
  - `npm run test:e2e` - Run Playwright tests
- **Configuration**: `playwright.config.ts` with browser matrix testing

### Testing Guidelines
- **Mock External Dependencies**: Always mock data loaders, SvelteKit runtime, and browser APIs in unit tests
- **Test User Interactions**: Focus on testing what users can see and interact with, not internal implementation
- **State Testing**: Test reactive state changes using Svelte 5 runes patterns
- **Accessibility**: Include accessibility assertions in component tests
- **CI Integration**: All tests run automatically in GitHub Actions before deployment

## Deployment

- **Target**: GitHub Pages (static site)
- **Base Path**: `/IWAC-spatial-overview` (configured in svelte.config.js)
- **Build Output**: Static files in `build/` directory
- **CI/CD**: GitHub Actions workflow in `.github/workflows/deploy.yml`

## Development Guidelines

### When Making Changes
1. Always run `npm install` after pulling changes
2. Use `npm run check` to verify TypeScript compliance
3. Run `npm run format` before committing
4. Test changes with `npm run test` before pushing
5. Verify build success with `npm run build`

### Common Patterns
- **Adding new filters**: Extend `filters.svelte.ts` and create components in `src/lib/components/filters/`
- **Map features**: Add to `src/lib/components/maps/` and integrate with `mapData.svelte.ts`
- **Entity visualizations**: Use the generic components in `src/lib/components/entities/`
- **UI components**: Use existing shadcn-svelte components from `src/lib/components/ui/`
- **State management**: Use Svelte 5 runes pattern, avoid legacy stores

### External Libraries
- **Leaflet**: For map functionality, types available
- **D3**: Modular imports for specific functionality
- **shadcn-svelte**: Pre-built UI components with Tailwind styling

## Important Notes

- This is a **client-side only** application (`ssr = false`)
- Static data files must be in `static/data/` directory
- All geographic calculations happen client-side
- Map and timeline components dynamically import heavy libraries
- Responsive design uses Tailwind breakpoints and mobile hooks

## Dashboard & Visualizations

We now have a shadcn-svelte "dashboard with sidebar" scaffold to host multiple visualizations:

- Layout: `src/routes/+layout.svelte` wraps the app with `Sidebar.Provider`/`Sidebar.Inset` and includes `AppSidebar`.
- Entry page: `src/routes/+page.svelte` conditionally renders:
	- Dashboard (new blocks) when `appState.activeView === 'dashboard'`
	- Existing Map + Timeline when `appState.activeView === 'map'`
- State additions in `src/lib/state/appState.svelte.ts`:
	- `activeView`: 'dashboard' | 'map' | 'list' | 'stats' (defaults to 'dashboard')
	- `activeVisualization`: 'overview' | 'byCountry' | 'persons' | 'organizations' | 'events' | 'subjects'
- New components:
	- `src/lib/components/app-sidebar.svelte`: Sidebar navigation to switch visualizations
	- `src/lib/components/site-header.svelte`: Sticky header for the dashboard inset
	- `src/lib/components/overview/Overview.svelte`: Composes overview blocks
	- `src/lib/components/overview/KpiCards.svelte`: KPI cards (articles, countries, time span; locale-formatted numbers)
	- `src/lib/components/chart-area-interactive.svelte`: Placeholder card for future charts
	- `src/lib/components/data-table.svelte`: Simple data table of sample records

### Entity Visualization Architecture

Entity types from `index.json` (Type): Lieux (Places), Personnes (Persons), Événements (Events), Organisations (Organizations), Sujets (Subjects).

**Modular Component System:**
1. **Generic Components** (reusable across all entity types):
   - `entity-selector.svelte`: Entity selection with search functionality
   - `entity-stats-cards.svelte`: Statistics cards (articles, countries, newspapers, time period)
   - `entity-locations-list.svelte`: Location tags display
   - `entity-articles-table.svelte`: Related articles table
   - `entity-visualization.svelte`: Main visualization component that combines all above

2. **Entity-Specific Components** (using the generic system):
   - `persons-visualization.svelte`: Person exploration
   - `organizations-visualization.svelte`: Organization exploration  
   - `events-visualization.svelte`: Event exploration
   - `subjects-visualization.svelte`: Subject exploration

**Implementation Features:**
- Lazy loading of entity data via `entityLoader.ts`
- State management with `selectedEntity` in `appState.svelte.ts`
- Automatic filtering of map data and articles based on selected entity
- URL routing support for deep-linking to entity views
- Responsive design with consistent UI patterns

**Usage Pattern:**
All entity visualizations follow the same pattern - they import the generic `EntityVisualization` component and pass entity-specific props. This eliminates code duplication while maintaining type safety and customization options.
- Map and timeline components dynamically import heavy libraries
- Responsive design uses Tailwind breakpoints and mobile hooks

## Dashboard & Visualizations (New)

We now have a shadcn-svelte “dashboard with sidebar” scaffold to host multiple visualizations:

- Layout: `src/routes/+layout.svelte` wraps the app with `Sidebar.Provider`/`Sidebar.Inset` and includes `AppSidebar`.
- Entry page: `src/routes/+page.svelte` conditionally renders:
	- Dashboard (new blocks) when `appState.activeView === 'dashboard'`
	- Existing Map + Timeline when `appState.activeView === 'map'`
- State additions in `src/lib/state/appState.svelte.ts`:
	- `activeView`: 'dashboard' | 'map' | 'list' | 'stats' (defaults to 'dashboard')
	- `activeVisualization`: 'overview' | 'byCountry' | 'persons' | 'organizations' | 'events' | 'subjects'
- New components:
	- `src/lib/components/app-sidebar.svelte`: Sidebar navigation to switch visualizations
	- `src/lib/components/site-header.svelte`: Sticky header for the dashboard inset
	- `src/lib/components/overview/Overview.svelte`: Composes overview blocks
	- `src/lib/components/overview/KpiCards.svelte`: KPI cards (articles, countries, time span; locale-formatted numbers)
	- `src/lib/components/chart-area-interactive.svelte`: Placeholder card for future charts
	- `src/lib/components/data-table.svelte`: Simple data table of sample records

### Extending with Entity Views

Entity types from `index.json` (Type): Lieux (Places), Personnes (Persons), Événements (Events), Organisations (Organizations), Sujets (Subjects).

Implementation guide:
1. Extend `src/lib/utils/staticDataLoader.ts` to compute:
	 - `entitiesByType` with counts and related article IDs
	 - `articleEntities` mapping for quick filtering
2. Add `selectedEntity` to app state (type + label) to drive drilldown.
3. Create `EntityExplorer.svelte` to list/search entities by type and set `selectedEntity`.
4. On selection, recompute `mapData.visibleItems` and update the timeline/table accordingly.
5. Keep components typed and use runes: `$state`, `$derived`, `$props`, `$effect`.

## Recent Updates

### Component Organization (Latest)
- **Reorganized entity components** into `src/lib/components/entities/` folder for better maintainability
- **Created barrel exports** via `index.ts` for cleaner imports
- **Updated all import paths** throughout the codebase to reflect new structure
- **Maintained full functionality** while improving code organization and reducing visual clutter in main components directory

The entities folder now contains:
- 5 reusable generic components (`entity-*`)  
- 4 entity-specific visualization components (`*-visualization`)
- 1 barrel export file (`index.ts`) for clean imports

This organization makes it easier to:
- Find and maintain entity-related components
- Add new entity types following the established pattern
- Import multiple entity components cleanly
- Keep the main components directory focused on core functionality

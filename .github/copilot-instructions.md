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
│   │   │   ├── maps/                    # Leaflet map & choropleth components
│   │   │   ├── filters/                 # Country & year range filters
│   │   │   ├── timeline/                # D3 timeline with animation controller
│   │   │   └── ui/                      # shadcn-svelte UI components
│   │   ├── hooks/                       # Svelte hooks (mobile detection)
│   │   ├── state/                       # Svelte 5 runes stores ($state)
│   │   ├── types/                       # TypeScript type definitions
│   │   └── utils/staticDataLoader.ts    # Static data loading utilities
│   ├── routes/
│   │   ├── +layout.svelte               # App layout with sidebar provider
│   │   ├── +page.svelte                 # Main application page
│   │   └── +page.ts                     # Sets ssr = false (SPA mode)
│   ├── app.css                          # Tailwind CSS with custom properties
│   └── app.html                         # HTML shell
├── static/data/                         # Static JSON & GeoJSON data files
├── e2e/                                 # Playwright E2E tests
└── src/**/*.test.ts                     # Vitest unit tests
```

### Data Preparation Scripts (`scripts/`)
- Python scripts for preparing JSON data from Omeka S API
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
npm run test:unit              # Run Vitest unit tests
npm run test:e2e              # Run Playwright E2E tests
npm run test                  # Run both unit and E2E tests
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
- `src/routes/+page.svelte`: Main application entry point with data loading
- `src/lib/state/`: Reactive state management (appState, mapData, filters, timeData)
- `src/lib/utils/staticDataLoader.ts`: Loads and processes static JSON data

### Configuration Files
- `svelte.config.js`: SvelteKit config with GitHub Pages deployment setup
- `tailwind.config.cjs`: Tailwind v4 config with shadcn-svelte theme
- `vite.config.ts`: Vite configuration
- `tsconfig.json`: TypeScript configuration
- `playwright.config.ts`: E2E testing configuration

## Data Flow & State Management

1. **Data Loading**: `staticDataLoader.ts` loads articles.json and index.json
2. **State Stores**: Data flows through reactive stores in `src/lib/state/`
3. **Filtering**: `filters.svelte.ts` manages country, date, and other filters
4. **Map Visualization**: `mapData.svelte.ts` handles geographic data and view modes
5. **Timeline**: `timeData.svelte.ts` manages temporal data and playback

## Testing Strategy

### Unit Tests (Vitest)
- Component testing with @testing-library/svelte
- State management testing
- Utility function testing

### E2E Tests (Playwright)
- Full application workflow testing
- Map interaction testing
- Filter and timeline functionality

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

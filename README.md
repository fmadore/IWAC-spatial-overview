# IWAC Spatial Overview

SvelteKit application to explore newspaper article locations from an Omeka S collection with filters, a timeline, and choropleth mapping. The runnable app lives in `omeka-map-explorer/`, and helper data-prep scripts live in `scripts/`.

## Repository layout

```
IWAC-spatial-overview
├─ omeka-map-explorer/           # SvelteKit app (Svelte 5, TS, Tailwind v4)
│  ├─ src/
│  │  ├─ lib/
│  │  │  ├─ api/                # GeoJSON utilities (loading, counts)
│  │  │  ├─ components/
│  │  │  │  ├─ maps/            # Leaflet map + choropleth layer
│  │  │  │  ├─ filters/         # Country + year range filters
│  │  │  │  └─ timeline/        # D3-based timeline and controller
│  │  │  ├─ hooks/              # e.g., mobile media query
│  │  │  ├─ state/              # Svelte 5 runes stores ($state)
│  │  │  ├─ types/              # TS types and ambient decls
│  │  │  └─ utils/              # static data loader
│  │  ├─ routes/                # +page.svelte (client-only)
│  │  └─ app.css/html           # Tailwind + app shell
│  ├─ static/
│  │  └─ data/                  # Articles, index, and maps/*.geojson
│  ├─ e2e/ and src/**.test.ts   # Playwright + Vitest tests
│  └─ package.json              # dev/build/test scripts
├─ scripts/                     # Python data-prep helpers
│  ├─ prepare_json.py           # Export articles.json, index.json
│  ├─ add_countries.py          # Add Country to index.json via polygons
│  └─ requirements.txt          # Python deps
└─ README.md (this file)
```

See the app-level docs in `omeka-map-explorer/README.md` for usage details.

## Quick start

Node 18+ recommended.

1) Install and run the app

```powershell
cd omeka-map-explorer
npm install
npm run dev
```

2) Optional: prepare static data for the app (outputs to `omeka-map-explorer/static/data` by default)

```powershell
# Create and activate a venv (optional)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install Python requirements
pip install -r scripts/requirements.txt

# Generate articles.json and index.json
python scripts/prepare_json.py

# Add Country to each place in index.json using world_countries.geojson
python scripts/add_countries.py
```

Data files expected by the app:
- `omeka-map-explorer/static/data/articles.json`
- `omeka-map-explorer/static/data/index.json`
- `omeka-map-explorer/static/data/maps/world_countries.geojson` and regional files (e.g., Benin, Togo)

## What’s inside the app

- Map (Leaflet) with optional choropleth by country
- Timeline (D3) with play/pause animation controller
- Filters: country selection and year range
- State via Svelte 5 runes (`$state`) in `src/lib/state`
- Tailwind CSS v4 and a small UI kit for layout
- Client-only main route (`src/routes/+page.ts` sets `ssr = false`)

## Testing and tooling

Run from `omeka-map-explorer/`:

```powershell
npm test           # e2e (Playwright) + unit (Vitest)
npm run test:unit  # unit tests only
npm run check      # svelte-check
npm run format     # prettier write
npm run lint       # prettier check
```

## License

MIT

## Deploy to GitHub Pages

This repo is configured to publish the Svelte static build to GitHub Pages:

1) Ensure the repository is public (or Private Pages enabled).
2) In GitHub > Settings > Pages, set Source to GitHub Actions.
3) Push to `main`. The workflow `.github/workflows/deploy.yml` will:
  - build the app in `omeka-map-explorer/`
  - publish the `build/` output to Pages

Site URL: https://fmadore.github.io/IWAC-spatial-overview
  range: {
    start: new Date('1900-01-01'),
    end: new Date('2023-12-31')
  },
  currentDate: new Date('1900-01-01'),
  playing: false,
  playbackSpeed: 1
});

// mapDataStore.js
import { writable } from 'svelte/store';

export const mapDataStore = writable({
  geoData: {}, // GeoJSON data for countries/regions
  visibleItems: [], // Currently visible items based on filters
  highlightedRegions: {}, // Regions to highlight based on count
  selectedCountry: null,
  selectedRegion: null,
  zoom: 5,
  center: [10.0, 0.0] // Default center (West Africa)
});

// filterStore.js
import { writable } from 'svelte/store';

export const filterStore = writable({
  available: {
    countries: [],
    regions: {},
    newspapers: [],
    dateRange: {
      min: new Date('1900-01-01'),
      max: new Date('2023-12-31')
    }
  },
  selected: {
    countries: [],
    regions: [],
    newspapers: [],
    dateRange: null,
    keywords: []
  }
});

// appStateStore.js
import { writable } from 'svelte/store';

export const appStateStore = writable({
  loading: true,
  error: null,
  dataLoaded: false,
  activeView: 'map', // 'map', 'list', 'stats'
  sidebarOpen: true,
  selectedItem: null
});
```

### 3.2 Create Derived Stores

```javascript
// derivedStores.js
import { derived } from 'svelte/store';
import { timeDataStore, filterStore, mapDataStore } from './stores';

// Filter visible data based on current date and filters
export const visibleDataStore = derived(
  [timeDataStore, filterStore, mapDataStore],
  ([$timeData, $filters, $mapData]) => {
    // Implementation would filter data based on current settings
    return [];
  }
);

// Get statistics about the currently visible data
export const statsStore = derived(
  visibleDataStore,
  ($visibleData) => {
    // Calculate statistics from visible data
    return {
      totalCount: $visibleData.length,
      countryBreakdown: {},
      newspaperBreakdown: {},
      timeline: []
    };
  }
);
```

## 4. Map Visualization Components (Week 3)

### 4.1 Base Map Component

Create `/lib/components/maps/Map.svelte`:

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { mapDataStore, timeDataStore, filterStore } from '$lib/stores';
  import { loadGeoJson } from '$lib/api/geoJsonService';
  import L from 'leaflet';
  
  // Props
  export let height = '600px';
  
  // Local state
  let mapElement;
  let map;
  let layers = {};
  
  // Initialize map on mount
  onMount(async () => {
    // Initialize the map
    map = L.map(mapElement).setView($mapDataStore.center, $mapDataStore.zoom);
    
    // Add base tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Load initial data
    await loadMapData();
    
    // Setup event handlers
    map.on('moveend', handleMapMove);
    
    return () => {
      if (map) {
        map.remove();
      }
    };
  });
  
  // Load map data based on current state
  async function loadMapData() {
    // Implementation would load and display GeoJSON data
  }
  
  // Handle map movement
  function handleMapMove() {
    if (!map) return;
    
    const center = map.getCenter();
    const zoom = map.getZoom();
    
    mapDataStore.update(state => ({
      ...state,
      center: [center.lat, center.lng],
      zoom
    }));
  }
  
  // Update map when stores change
  $: if (map && $timeDataStore.currentDate) {
    updateMapForDate($timeDataStore.currentDate);
  }
  
  $: if (map && $filterStore.selected) {
    updateMapForFilters($filterStore.selected);
  }
  
  // Update map for specific date
  function updateMapForDate(date) {
    // Implementation would update displayed data
  }
  
  // Update map for applied filters
  function updateMapForFilters(filters) {
    // Implementation would update displayed data
  }
</script>

<div class="map-container" bind:this={mapElement} style="height: {height};"></div>

<style>
  .map-container {
    width: 100%;
    background-color: #f5f5f5;
    border-radius: 4px;
    overflow: hidden;
  }
  
  :global(.leaflet-container) {
    font-family: inherit;
  }
</style>
```

### 4.2 Choropleth Layer Component

Create `/lib/components/maps/ChoroplethLayer.svelte`:

```svelte
<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { scaleQuantize } from 'd3-scale';
  import { schemeBlues } from 'd3-scale-chromatic';
  import L from 'leaflet';
  
  // Props
  export let map; // Leaflet map instance
  export let geoJson; // GeoJSON data
  export let data = {}; // Count data per region
  export let colorRange = schemeBlues[7]; // Color scheme
  
  // Local state
  let layer;
  let info;
  let legend;
  
  // Create event dispatcher
  const dispatch = createEventDispatcher();
  
  onMount(() => {
    if (!map || !geoJson) return;
    
    // Create layer
    createLayer();
    
    // Add info control
    createInfoControl();
    
    // Add legend
    createLegendControl();
    
    return () => {
      if (layer && map) {
        map.removeLayer(layer);
      }
      
      if (info && map) {
        info.remove();
      }
      
      if (legend && map) {
        legend.remove();
      }
    };
  });
  
  // Create choropleth layer
  function createLayer() {
    // Implementation would create and style the layer
  }
  
  // Create info control
  function createInfoControl() {
    // Implementation would create hoverable info panel
  }
  
  // Create legend control
  function createLegendControl() {
    // Implementation would create color legend
  }
  
  // Style function for regions
  function style(feature) {
    // Implementation would determine color based on count
  }
  
  // Handle feature hover
  function highlightFeature(e) {
    // Implementation would highlight hovered region
  }
  
  // Reset highlight on mouseout
  function resetHighlight(e) {
    // Implementation would reset highlighting
  }
  
  // Handle feature click
  function zoomToFeature(e) {
    // Implementation would zoom to clicked region
  }
  
  // Update when data changes
  $: if (layer && data) {
    updateLayer();
  }
  
  // Update layer with new data
  function updateLayer() {
    // Implementation would update styles based on new data
  }
</script>
```

### 4.3 Heat Map Component

Create `/lib/components/maps/HeatMapLayer.svelte`:

```svelte
<script>
  import { onMount } from 'svelte';
  import L from 'leaflet';
  import 'leaflet.heat';
  
  // Props
  export let map;
  export let points = []; // Array of [lat, lng, intensity] arrays
  export let radius = 25;
  export let blur = 15;
  export let maxZoom = 18;
  
  // Local state
  let heatLayer;
  
  onMount(() => {
    if (!map || !points.length) return;
    
    // Create heat layer
    heatLayer = L.heatLayer(points, {
      radius,
      blur,
      maxZoom,
      gradient: {
        0.4: 'blue',
        0.6: 'cyan',
        0.8: 'lime',
        0.9: 'yellow',
        1.0: 'red'
      }
    }).addTo(map);
    
    return () => {
      if (heatLayer && map) {
        map.removeLayer(heatLayer);
      }
    };
  });
  
  // Update when points change
  $: if (heatLayer && points) {
    heatLayer.setLatLngs(points);
  }
</script>
```

## 5. Time-Based Visualization (Week 4)

### 5.1 Timeline Component

Create `/lib/components/timeline/Timeline.svelte`:

```svelte
<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { select } from 'd3-selection';
  import { scaleTime, scaleLinear } from 'd3-scale';
  import { axisBottom } from 'd3-axis';
  import { area, curveBasis } from 'd3-shape';
  import { timeMonth, timeYear } from 'd3-time';
  import { timeFormat } from 'd3-time-format';
  import { timeDataStore } from '$lib/stores';
  
  // Props
  export let data = []; // Array of {date, count} objects
  export let height = 120;
  
  // Local state
  let svgElement;
  let chart;
  let width;
  let margin = { top: 10, right: 30, bottom: 30, left: 40 };
  let x, y, areaPath, xAxis, currentDateLine;
  
  // Event dispatcher
  const dispatch = createEventDispatcher();
  
  onMount(() => {
    initChart();
    
    const resizeObserver = new ResizeObserver(entries => {
      if (entries.length > 0) {
        updateChartDimensions();
      }
    });
    
    resizeObserver.observe(svgElement.parentNode);
    
    return () => {
      resizeObserver.disconnect();
    };
  });
  
  // Initialize the chart
  function initChart() {
    // Implementation would set up the SVG and scales
  }
  
  // Update chart dimensions on resize
  function updateChartDimensions() {
    // Implementation would handle responsive sizing
  }
  
  // Update chart with new data
  function updateChart() {
    // Implementation would update the visualization
  }
  
  // Play/pause timeline animation
  function togglePlayback() {
    timeDataStore.update(state => ({
      ...state,
      playing: !state.playing
    }));
  }
  
  // Handle user clicking on timeline
  function handleTimelineClick(event) {
    // Implementation would update current date
  }
  
  // Watch for changes to data or current date
  $: if (chart && data) {
    updateChart();
  }
  
  $: if (chart && $timeDataStore.currentDate) {
    updateCurrentDateIndicator($timeDataStore.currentDate);
  }
  
  // Update the current date indicator
  function updateCurrentDateIndicator(date) {
    // Implementation would move the date indicator
  }
</script>

<div class="timeline-container">
  <div class="controls">
    <button class="play-button" on:click={togglePlayback}>
      {$timeDataStore.playing ? 'Pause' : 'Play'}
    </button>
    
    <span class="current-date">
      {$timeDataStore.currentDate.toLocaleDateString()}
    </span>
    
    <div class="speed-control">
      <label for="speed">Speed:</label>
      <input 
        id="speed" 
        type="range" 
        min="0.1" 
        max="5" 
        step="0.1" 
        bind:value={$timeDataStore.playbackSpeed}
      />
      <span>{$timeDataStore.playbackSpeed}x</span>
    </div>
  </div>
  
  <div class="chart" bind:this={svgElement}>
    <!-- D3 will append SVG here -->
  </div>
</div>

<style>
  .timeline-container {
    width: 100%;
    background-color: white;
    border-radius: 4px;
    padding: 10px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  
  .controls {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
    gap: 15px;
  }
  
  .play-button {
    padding: 5px 10px;
    background-color: #4a86e8;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .current-date {
    font-weight: bold;
    min-width: 120px;
  }
  
  .speed-control {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .chart {
    width: 100%;
    height: 100px;
    overflow: hidden;
  }
</style>
```

### 5.2 Animation Controller

Create `/lib/components/timeline/AnimationController.js`:

```javascript
import { get } from 'svelte/store';
import { timeDataStore } from '$lib/stores';

let animationFrame;
let lastTimestamp;

// Start animation loop
export function startAnimation() {
  if (animationFrame) return;
  
  lastTimestamp = performance.now();
  animationFrame = requestAnimationFrame(animationLoop);
}

// Stop animation loop
export function stopAnimation() {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }
}

// Animation loop
function animationLoop(timestamp) {
  const state = get(timeDataStore);
  
  if (!state.playing) {
    animationFrame = null;
    return;
  }
  
  const elapsed = timestamp - lastTimestamp;
  lastTimestamp = timestamp;
  
  // Calculate time progression
  const msPerDay = 1000 / state.playbackSpeed;
  const daysToAdvance = elapsed / msPerDay;
  
  // Create new date
  const newDate = new Date(state.currentDate);
  newDate.setDate(newDate.getDate() + daysToAdvance);
  
  // Check if we've reached the end
  if (newDate > state.range.end) {
    timeDataStore.update(s => ({
      ...s,
      currentDate: s.range.start,
      playing: false
    }));
    animationFrame = null;
    return;
  }
  
  // Update current date
  timeDataStore.update(s => ({
    ...s,
    currentDate: newDate
  }));
  
  // Continue animation loop
  animationFrame = requestAnimationFrame(animationLoop);
}

// Initialize animation listeners
export function initialize() {
  timeDataStore.subscribe(state => {
    if (state.playing && !animationFrame) {
      startAnimation();
    } else if (!state.playing && animationFrame) {
      stopAnimation();
    }
  });
}
```

## 6. Filtering & Faceting (Week 5)

### 6.1 Filter Panel Component

Create `/lib/components/filters/FilterPanel.svelte`:

```svelte
<script>
  import { filterStore, appStateStore } from '$lib/stores';
  import CountryFilter from './CountryFilter.svelte';
  import NewspaperFilter from './NewspaperFilter.svelte';
  import DateRangeFilter from './DateRangeFilter.svelte';
  import KeywordFilter from './KeywordFilter.svelte';
  
  // Local state
  let expanded = true;
  
  // Toggle expanded state
  function toggleExpanded() {
    expanded = !expanded;
  }
  
  // Reset all filters
  function resetFilters() {
    filterStore.update(state => ({
      ...state,
      selected: {
        countries: [],
        regions: [],
        newspapers: [],
        dateRange: null,
        keywords: []
      }
    }));
  }
</script>

<div class="filter-panel">
  <div class="header">
    <h2>Filters</h2>
    <button class="toggle-button" on:click={toggleExpanded}>
      {expanded ? '−' : '+'}
    </button>
  </div>
  
  {#if expanded}
    <div class="filters">
      <CountryFilter 
        countries={$filterStore.available.countries}
        selected={$filterStore.selected.countries}
      />
      
      <NewspaperFilter 
        newspapers={$filterStore.available.newspapers}
        selected={$filterStore.selected.newspapers}
      />
      
      <DateRangeFilter 
        range={$filterStore.available.dateRange}
        selected={$filterStore.selected.dateRange}
      />
      
      <KeywordFilter 
        selected={$filterStore.selected.keywords}
      />
      
      <div class="filter-actions">
        <button class="reset-button" on:click={resetFilters}>
          Reset All Filters
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .filter-panel {
    background-color: white;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    overflow: hidden;
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 15px;
    background-color: #f5f5f5;
    border-bottom: 1px solid #ddd;
  }
  
  .header h2 {
    margin: 0;
    font-size: 1.2rem;
  }
  
  .toggle-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0 5px;
  }
  
  .filters {
    padding: 15px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  
  .filter-actions {
    display: flex;
    justify-content: center;
    margin-top: 10px;
  }
  
  .reset-button {
    background-color: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 5px 10px;
    cursor: pointer;
  }
  
  .reset-button:hover {
    background-color: #e5e5e5;
  }
</style>
```

### 6.2 Individual Filter Components

Create specific filter components:

#### Country Filter

```svelte
<script>
  import { createEventDispatcher } from 'svelte';
  import { filterStore } from '$lib/stores';
  
  // Props
  export let countries = [];
  export let selected = [];
  
  // Event dispatcher
  const dispatch = createEventDispatcher();
  
  // Toggle country selection
  function toggleCountry(country) {
    const index = selected.indexOf(country);
    
    if (index === -1) {
      selected = [...selected, country];
    } else {
      selected = selected.filter(c => c !== country);
    }
    
    updateStore();
  }
  
  // Update the filter store
  function updateStore() {
    filterStore.update(state => ({
      ...state,
      selected: {
        ...state.selected,
        countries: selected
      }
    }));
    
    dispatch('change', { countries: selected });
  }
</script>

<div class="country-filter">
  <h3>Countries</h3>
  
  <div class="country-list">
    {#each countries as country}
      <label class="country-item">
        <input 
          type="checkbox" 
          checked={selected.includes(country)} 
          on:change={() => toggleCountry(country)} 
        />
        {country}
      </label>
    {/each}
  </div>
</div>

<style>
  .country-filter h3 {
    margin-top: 0;
    margin-bottom: 10px;
    font-size: 1rem;
  }
  
  .country-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
    max-height: 150px;
    overflow-y: auto;
  }
  
  .country-item {
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
  }
</style>
```

Similar components would be created for `NewspaperFilter.svelte`, `DateRangeFilter.svelte`, and `KeywordFilter.svelte`.

## 7. Main Application UI (Week 6)

### 7.1 Main App Component

Create `/routes/+page.svelte`:

```svelte
<script>
  import { onMount } from 'svelte';
  import { appStateStore, timeDataStore, filterStore, mapDataStore } from '$lib/stores';
  import { initialize as initAnimationController } from '$lib/components/timeline/AnimationController';
  import { fetchItemSets, fetchItemsFromSet } from '$lib/api/omekaService';
  import { processItems, groupItemsByTime } from '$lib/utils/dataProcessor';
  
  // Components
  import Map from '$lib/components/maps/Map.svelte';
  import Timeline from '$lib/components/timeline/Timeline.svelte';
  import FilterPanel from '$lib/components/filters/FilterPanel.svelte';
  import LoadingIndicator from '$lib/components/layout/LoadingIndicator.svelte';
  import ErrorDisplay from '$lib/components/layout/ErrorDisplay.svelte';
  import ArticleDetails from '$lib/components/details/ArticleDetails.svelte';
  
  // Configuration
  const countryItemSets = {
    'Benin': [2185, 5502, 2186, 2188, 2187, 2191, 2190, 2189, 4922, 5501, 5500],
    'Burkina Faso': [2199, 2200, 23448, 23273, 23449, 5503, 2215, 2214, 2207, 2209, 2210, 2213, 2201],
    'Togo': [9458, 25304, 5498, 5499],
    'Côte d\'Ivoire': [43051, 31882, 15845, 45390]
  };
  
  onMount(async () => {
    try {
      // Initialize animation controller
      initAnimationController();
      
      // Start loading data
      await loadAllData();
      
      // Initialize available filters
      initializeFilters();
      
      // Mark loading complete
      appStateStore.update(state => ({
        ...state,
        loading: false,
        dataLoaded: true
      }));
    } catch (error) {
      console.error('Error initializing application:', error);
      
      appStateStore.update(state => ({
        ...state,
        loading: false,
        error: error.message || 'Failed to initialize application'
      }));
    }
  });
  
  // Load all country data
  async function loadAllData() {
    const allItems = [];
    const countriesData = {};
    
    for (const [country, itemSets] of Object.entries(countryItemSets)) {
      const countryItems = [];
      
      for (const itemSetId of itemSets) {
        const items = await fetchItemsFromSet(itemSetId);
        countryItems.push(...items);
      }
      
      const processedItems = await processItems(countryItems, country);
      countriesData[country] = processedItems;
      allItems.push(...processedItems);
    }
    
    // Store processed data
    const timelineData = groupItemsByTime(allItems, 'month');
    
    // Update stores
    timeDataStore.update(state => ({
      ...state,
      data: timelineData,
      range: {
        start: timelineData[0]?.date || new Date('1900-01-01'),
        end: timelineData[timelineData.length - 1]?.date || new Date('2023-12-31')
      },
      currentDate: timelineData[0]?.date || new Date('1900-01-01')
    }));
    
    mapDataStore.update(state => ({
      ...state,
      allItems: allItems,
      countriesData: countriesData,
      visibleItems: allItems
    }));
  }
  
  // Initialize available filters
  function initializeFilters() {
    const countries = Object.keys(countryItemSets);
    const newspapers = new Set();
    const dates = [];
    
    const allItems = get(mapDataStore).allItems || [];
    
    allItems.forEach(item => {
      if (item.newspaperSource) {
        newspapers.add(item.newspaperSource);
      }
      
      if (item.publishDate) {
        dates.push(item.publishDate);
      }
    });
    
    const dateRange = dates.length > 0 ? 
      { min: new Date(Math.min(...dates)), max: new Date(Math.max(...dates)) } : 
      { min: new Date('1900-01-01'), max: new Date('2023-12-31') };
    
    filterStore.update(state => ({
      ...state,
      available: {
        countries,
        newspapers: Array.from(newspapers),
        dateRange
      }
    }));
  }
</script>

<svelte:head>
  <title>Omeka S Map Explorer</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
</svelte:head>

<div class="app-container">
  {#if $appStateStore.loading}
    <LoadingIndicator />
  {:else if $appStateStore.error}
    <ErrorDisplay message={$appStateStore.error} />
  {:else}
    <header>
      <h1>Newspaper Article Locations</h1>
      <div class="view-controls">
        <!-- View switching controls -->
      </div>
    </header>
    
    <main>
      <aside class="sidebar" class:collapsed={!$appStateStore.sidebarOpen}>
        <button class="sidebar-toggle" on:click={() => {
          appStateStore.update(s => ({ ...s, sidebarOpen: !s.sidebarOpen }))
        }}>
          {$appStateStore.sidebarOpen ? '◀' : '▶'}
        </button>
        
        {#if $appStateStore.sidebarOpen}
          <FilterPanel />
          
          {#if $appStateStore.selectedItem}
            <ArticleDetails item={$appStateStore.selectedItem} />
          {/if}
        {/if}
      </aside>
      
      <div class="content">
        <Map />
        
        <div class="timeline-wrapper">
          <Timeline 
            data={$timeDataStore.data}
            height="120px"
          />
        </div>
      </div>
    </main>
  {/if}
</div>

<style>
  .app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
  }
  
  header {
    padding: 10px 20px;
    background-color: #4a86e8;
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  
  header h1 {
    margin: 0;
    font-size: 1.5rem;
  }
  
  main {
    display: flex;
    flex: 1;
    overflow: hidden;
  }
  
  .sidebar {
    width: 300px;
    background-color: #f5f5f5;
    overflow-y: auto;
    transition: width 0.3s ease;
    position: relative;
  }
  
  .sidebar.collapsed {
    width: 30px;
  }
  
  .sidebar-toggle {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 10;
    background: white;
    border: 1px solid #ddd;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  
  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .timeline-wrapper {
    padding: 10px;
    background-color: #f5f5f5;
    border-top: 1px solid #ddd;
  }
  
  @media (max-width: 768px) {
    main {
      flex-direction: column;
    }
    
    .sidebar {
      width: 100%;
      max-height: 50vh;
    }
    
    .sidebar.collapsed {
      max-height: 30px;
    }
  }
</style>
```

## 8. Advanced Features (Week 7)

### 8.1 Data Export

Create `/lib/utils/exportUtils.js`:

```javascript
import { saveAs } from 'file-saver';
import Papa from 'papaparse';

/**
 * Export data as CSV
 * @param {Array} data - Data to export
 * @param {string} filename - Filename for the download
 */
export function exportToCsv(data, filename = 'export.csv') {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, filename);
}

/**
 * Export the current map view as PNG
 * @param {Object} map - Leaflet map instance
 * @param {string} filename - Filename for the download
 */
export function exportMapAsPng(map, filename = 'map.png') {
  // This would use leaflet-image in a real implementation
  // Simplified for roadmap
}

/**
 * Export data as GeoJSON
 * @param {Array} data - Data points with coordinates
 * @param {string} filename - Filename for the download
 */
export function exportToGeoJson(data, filename = 'export.geojson') {
  const features = data.map(item => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [item.coordinates[0][1], item.coordinates[0][0]] // [lon, lat]
    },
    properties: {
      id: item.id,
      title: item.title,
      date: item.publishDate?.toISOString(),
      country: item.country,
      region: item.region,
      newspaper: item.newspaperSource
    }
  }));
  
  const geoJson = {
    type: 'FeatureCollection',
    features
  };
  
  const blob = new Blob([JSON.stringify(geoJson, null, 2)], { type: 'application/json' });
  saveAs(blob, filename);
}
```

### 8.2 Shareable Views

Create `/lib/utils/shareUtils.js`:

```javascript
import { get } from 'svelte/store';
import { timeDataStore, filterStore, mapDataStore } from '$lib/stores';

/**
 * Generate a shareable URL for the current view
 * @returns {string} - URL with encoded state
 */
export function generateShareableUrl() {
  const state = {
    t: get(timeDataStore).currentDate.toISOString(),
    f: get(filterStore).selected,
    m: {
      c: get(mapDataStore).center,
      z: get(mapDataStore).zoom
    }
  };
  
  const stateParam = encodeURIComponent(JSON.stringify(state));
  return `${window.location.origin}${window.location.pathname}?state=${stateParam}`;
}

/**
 * Parse a shared state from URL parameters
 * @returns {Object|null} - Parsed state or null if invalid
 */
export function parseSharedState() {
  const params = new URLSearchParams(window.location.search);
  const stateParam = params.get('state');
  
  if (!stateParam) return null;
  
  try {
    return JSON.parse(decodeURIComponent(stateParam));
  } catch (error) {
    console.error('Failed to parse shared state:', error);
    return null;
  }
}

/**
 * Apply a shared state to the application
 * @param {Object} state - Parsed state object
 */
export function applySharedState(state) {
  if (!state) return;
  
  // Apply time state
  if (state.t) {
    timeDataStore.update(s => ({
      ...s,
      currentDate: new Date(state.t)
    }));
  }
  
  // Apply filter state
  if (state.f) {
    filterStore.update(s => ({
      ...s,
      selected: state.f
    }));
  }
  
  // Apply map state
  if (state.m) {
    mapDataStore.update(s => ({
      ...s,
      center: state.m.c || s.center,
      zoom: state.m.z || s.zoom
    }));
  }
}
```

## 9. Backend Requirements (Week 8)

### 9.1 API Proxy Service

Create a serverless function to proxy API requests:

```javascript
// api/proxy.js (Netlify/Vercel serverless function)
const axios = require('axios');

exports.handler = async function(event, context) {
  // Get API credentials from environment variables
  const API_URL = process.env.OMEKA_BASE_URL;
  const KEY_IDENTITY = process.env.OMEKA_KEY_IDENTITY;
  const KEY_CREDENTIAL = process.env.OMEKA_KEY_CREDENTIAL;
  
  // Extract path and query parameters
  const path = event.path.replace(/^\/api\/proxy\//, '');
  const queryParams = event.queryStringParameters || {};
  
  // Add authentication to query params
  const authenticatedParams = {
    ...queryParams,
    key_identity: KEY_IDENTITY,
    key_credential: KEY_CREDENTIAL
  };
  
  try {
    // Make the request to Omeka S API
    const response = await axios({
      method: event.httpMethod,
      url: `${API_URL}/${path}`,
      params: authenticatedParams,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Return the response
    return {
      statusCode: response.status,
      body: JSON.stringify(response.data),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=3600'
      }
    };
  } catch (error) {
    console.error('Proxy error:', error);
    
    return {
      statusCode: error.response?.status || 500,
      body: JSON.stringify({
        error: error.message,
        details: error.response?.data
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }
};
```

### 9.2 Data Pre-processing Script

Create a script to pre-process data:

```javascript
// scripts/preprocess-data.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const Papa = require('papaparse');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const API_URL = process.env.OMEKA_BASE_URL;
const KEY_IDENTITY = process.env.OMEKA_KEY_IDENTITY;
const KEY_CREDENTIAL = process.env.OMEKA_KEY_CREDENTIAL;

// Configuration
const countries = {
  'Benin': [2185, 5502, 2186, 2188, 2187, 2191, 2190, 2189, 4922, 5501, 5500],
  'Burkina Faso': [2199, 2200, 23448, 23273, 23449, 5503, 2215, 2214, 2207, 2209, 2210, 2213, 2201],
  'Togo': [9458, 25304, 5498, 5499],
  'Côte d\'Ivoire': [43051, 31882, 15845, 45390]
};

const outputDir = path.join(__dirname, '../static/data/preprocessed');

// Make sure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Main function
async function main() {
  for (const [country, itemSets] of Object.entries(countries)) {
    console.log(`Processing ${country}...`);
    
    try {
      // Fetch and process data
      const data = await processCountry(country, itemSets);
      
      // Save to files
      saveData(country, data);
      
      console.log(`✅ Completed processing ${country}`);
    } catch (error) {
      console.error(`❌ Error processing ${country}:`, error);
    }
  }
}

// Process a country's data
async function processCountry(country, itemSetIds) {
  // Implementation details here
}

// Save processed data to files
function saveData(country, data) {
  const countrySlug = country.toLowerCase().replace(/\s+/g, '_');
  
  // Save full data as JSON
  fs.writeFileSync(
    path.join(outputDir, `${countrySlug}.json`),
    JSON.stringify(data, null, 2)
  );
  
  // Save timeline data
  const timelineData = generateTimelineData(data);
  fs.writeFileSync(
    path.join(outputDir, `${countrySlug}_timeline.json`),
    JSON.stringify(timelineData, null, 2)
  );
  
  // Save as CSV for easy import
  const csv = Papa.unparse(data.map(item => ({
    id: item.id,
    title: item.title,
    publishDate: item.publishDate,
    country: item.country,
    region: item.region,
    prefecture: item.prefecture,
    newspaperSource: item.newspaperSource,
    latitude: item.coordinates?.[0]?.[0] || '',
    longitude: item.coordinates?.[0]?.[1] || ''
  })));
  
  fs.writeFileSync(
    path.join(outputDir, `${countrySlug}.csv`),
    csv
  );
}

// Generate timeline data from items
function generateTimelineData(items) {
  // Implementation details here
}

// Run the script
main()
  .then(() => console.log('✅ All preprocessing complete'))
  .catch(err => console.error('❌ Error in preprocessing:', err))
  .finally(() => process.exit());
```

## 10. Testing & QA (Week 9)

### 10.1 Unit Testing

Create tests for key functionality:

```javascript
// tests/dataProcessor.test.js
import { describe, it, expect } from 'vitest';
import { processItems, groupItemsByTime } from '$lib/utils/dataProcessor';

describe('Data Processor', () => {
  describe('processItems', () => {
    it('should extract coordinates from items', async () => {
      // Test implementation
    });
    
    it('should extract publication dates', async () => {
      // Test implementation
    });
    
    it('should handle items with missing data', async () => {
      // Test implementation
    });
  });
  
  describe('groupItemsByTime', () => {
    it('should group items by month', () => {
      // Test implementation
    });
    
    it('should handle empty input', () => {
      // Test implementation
    });
    
    it('should sort results by date', () => {
      // Test implementation
    });
  });
});
```

### 10.2 Component Testing

Create tests for key components:

```javascript
// tests/Map.test.js
import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import Map from '$lib/components/maps/Map.svelte';

// Mock Leaflet
vi.mock('leaflet', () => {
  return {
    default: {
      map: vi.fn(() => ({
        setView: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        remove: vi.fn()
      })),
      tileLayer: vi.fn(() => ({
        addTo: vi.fn().mockReturnThis()
      }))
    }
  };
});

describe('Map Component', () => {
  it('should render the map container', () => {
    render(Map);
    expect(screen.getByTestId('map-container')).toBeTruthy();
  });
  
  // More tests
});
```

### 10.3 End-to-End Testing

Create a Cypress test for a basic user flow:

```javascript
// cypress/e2e/basic-flow.cy.js
describe('Basic User Flow', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.get('.loading-indicator').should('not.exist', { timeout: 10000 });
  });
  
  it('should load the map', () => {
    cy.get('.map-container').should('be.visible');
    cy.get('.leaflet-container').should('be.visible');
  });
  
  it('should toggle sidebar', () => {
    cy.get('.sidebar').should('have.css', 'width', '300px');
    cy.get('.sidebar-toggle').click();
    cy.get('.sidebar').should('have.css', 'width', '30px');
    cy.get('.sidebar-toggle').click();
    cy.get('.sidebar').should('have.css', 'width', '300px');
  });
  
  it('should play timeline animation', () => {
    const initialDate = cy.get('.current-date').invoke('text');
    cy.get('.play-button').click();
    cy.wait(2000);
    cy.get('.current-date').invoke('text').should('not.eq', initialDate);
  });
  
  // More test cases
});
```

## 11. Deployment & Documentation (Week 10)

### 11.1 Deployment Configuration

Create a Netlify configuration file (`netlify.toml`):

```toml
[build]
  command = "npm run build"
  publish = "build"
  functions = "netlify/functions"

[dev]
  command = "npm run dev"
  port = 5173
  targetPort = 5173

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  NODE_VERSION = "18"

```

### 11.2 User Documentation

Create a README.md for the project:

```markdown
# Omeka S Map Explorer

An interactive Svelte application for visualizing newspaper article locations from an Omeka S collection.

## Features

- Interactive maps showing article locations
- Time-based visualization with animation
- Filtering by country, newspaper source, and date
- Chloropleth maps showing article density by region
- Data export in various formats
- Shareable views

## Getting Started

### Prerequisites

- Node.js 16 or higher
- An Omeka S instance with API access

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/omeka-map-explorer.git
   cd omeka-map-explorer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the project root with your Omeka S API credentials:
   ```
   VITE_OMEKA_BASE_URL=https://your-omeka-instance.org/api
   VITE_OMEKA_KEY_IDENTITY=your_key_identity
   VITE_OMEKA_KEY_CREDENTIAL=your_key_credential
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:5173`

## Usage Guide

[Include screenshots and usage instructions here]

## Deployment

The application can be deployed to Netlify, Vercel, or any static site hosting:

```bash
npm run build
```

The built files will be in the `build` directory.

## Configuration

### Environment Variables

- `VITE_OMEKA_BASE_URL`: URL of your Omeka S API
- `VITE_OMEKA_KEY_IDENTITY`: Your Omeka S API key identity
- `VITE_OMEKA_KEY_CREDENTIAL`: Your Omeka S API key credential
- `VITE_MAP_DEFAULT_CENTER_LAT`: Default map center latitude (default: 10.0)
- `VITE_MAP_DEFAULT_CENTER_LNG`: Default map center longitude (default: 0.0)
- `VITE_MAP_DEFAULT_ZOOM`: Default map zoom level (default: 5)

### Item Set Configuration

Item sets for each country are configured in `src/lib/config/itemSets.js`:

```javascript
export const countryItemSets = {
  'Benin': [2185, 5502, 2186, 2188, 2187, 2191, 2190, 2189, 4922, 5501, 5500],
  'Burkina Faso': [2199, 2200, 23448, 23273, 23449, 5503, 2215, 2214, 2207, 2209, 2210, 2213, 2201],
  'Togo': [9458, 25304, 5498, 5499],
  'Côte d\'Ivoire': [43051, 31882, 15845, 45390]
};
```

## Development

### Project Structure

[Describe key files and directories]

### Adding New Features

[Instructions for extending the application]

## License

This project is licensed under the MIT License - see the LICENSE file for details.
```

## 12. Project Timeline Overview

| Week | Focus | Key Deliverables |
|------|-------|------------------|
| 1 | Project Setup | Project scaffolding, dependency installation, architecture design |
| 2 | Core Data Integration | API services, data processing utilities, GeoJSON integration |
| 3 | Map Components | Base map, chloropleth layer, heat map, marker cluster |
| 4 | Time Visualization | Timeline, animation controller, time-based filtering |
| 5 | Filtering & Faceting | Filter components, faceting service, search functionality |
| 6 | Main UI | Dashboard layout, detail views, responsive design |
| 7 | Advanced Features | Data export, saved views, comparative visualization |
| 8 | Backend Requirements | API proxy, data pre-processing, GeoJSON API |
| 9 | Testing & QA | Unit tests, component tests, end-to-end tests |
| 10 | Deployment | Build process, deployment, documentation, analytics |

## 13. Next Steps and Future Enhancements

- **Machine Learning Integration**: Add text analysis to automatically extract locations from article content
- **Mobile Application**: Develop a companion mobile app for field research
- **Real-time Updates**: Add WebSocket support for real-time updates when new articles are added
- **Advanced Analytics**: Add statistical analysis tools for research insights
- **Multi-language Support**: Add internationalization for UI elements
- **Offline Support**: Implement progressive web app features for offline usage
- **Integration with Other Digital Humanities Tools**: Create plugins for other research platforms

## 14. Resources

- [SvelteKit Documentation](https://kit.svelte.dev/docs)
- [Leaflet Documentation](https://leafletjs.com/reference.html)
- [D3.js Documentation](https://d3js.org/getting-started)
- [Omeka S API Documentation](https://omeka.org/s/docs/developer/api/)
- [GeoJSON Specification](https://geojson.org/)

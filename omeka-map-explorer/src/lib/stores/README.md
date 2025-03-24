# Omeka Map Explorer - Stores Architecture

This document describes the store architecture used in the Omeka Map Explorer application.

## Store Overview

The application uses Svelte stores to manage state. There are several interconnected stores:

- `appStateStore`: Manages UI and application state
- `mapDataStore`: Manages map-related data and state
- `timeDataStore`: Manages time-related data and playback
- `filterStore`: Manages available and selected filters
- `derivedStores`: Contains stores derived from the primary stores

## Store Details

### appStateStore
Manages the application's UI state, including:
- Loading and error states
- Current view (map, list, stats)
- Sidebar visibility
- Selected item

### mapDataStore
Contains all geographic and item data:
- GeoJSON data for countries/regions
- All items and visible items
- Highlighted regions based on item counts
- Currently selected country/region
- Map zoom and center coordinates

### timeDataStore
Manages the temporal aspect of the data:
- Temporal data points
- Date range for the application
- Current date being displayed
- Playback state and speed

### filterStore
Controls filtering functionality:
- Available filter options (countries, regions, newspapers, date ranges)
- Currently selected filters
- Keyword filters

### Derived Stores
Computed stores based on the primary stores:
- `visibleDataStore`: Filters items based on current date and applied filters
- `statsStore`: Calculates statistics from the currently visible data

## Usage
Stores can be imported and used in components with Svelte's store syntax:

```typescript
import { appStateStore } from '$lib/stores/appStateStore';

// Read store value
$: ({ activeView, sidebarOpen } = $appStateStore);

// Update store value
appStateStore.update(state => ({ ...state, sidebarOpen: false }));
``` 
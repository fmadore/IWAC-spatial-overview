import { writable } from 'svelte/store';
import type { GeoJsonData, ProcessedItem } from '$lib/types';

interface MapDataState {
  geoData: Record<string, GeoJsonData>;
  allItems: ProcessedItem[];
  visibleItems: ProcessedItem[];
  highlightedRegions: Record<string, number>;
  selectedCountry: string | null;
  selectedRegion: string | null;
  zoom: number;
  center: [number, number];
  countriesData: Record<string, ProcessedItem[]>;
}

export const mapDataStore = writable<MapDataState>({
  geoData: {}, // GeoJSON data for countries/regions
  allItems: [],
  visibleItems: [], // Currently visible items based on filters
  highlightedRegions: {}, // Regions to highlight based on count
  selectedCountry: null,
  selectedRegion: null,
  zoom: 5,
  center: [10.0, 0.0], // Default center (West Africa)
  countriesData: {}
}); 
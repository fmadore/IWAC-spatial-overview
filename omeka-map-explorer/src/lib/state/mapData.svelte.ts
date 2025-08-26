import type { GeoJsonData, ProcessedItem } from '$lib/types';

interface MapDataState {
  geoData: Record<string, GeoJsonData>;
  allItems: ProcessedItem[];
  visibleItems: ProcessedItem[];
  highlightedRegions: Record<string, number>;
  selectedCountry: string | null;
  selectedRegion: string | null;
  viewMode: 'bubbles' | 'choropleth';
  zoom: number;
  center: [number, number];
  countriesData: Record<string, ProcessedItem[]>;
}

export const mapData = $state<MapDataState>({
  geoData: {},
  allItems: [],
  visibleItems: [],
  highlightedRegions: {},
  selectedCountry: null,
  selectedRegion: null,
  viewMode: 'bubbles',
  zoom: 5,
  center: [10.0, 0.0],
  countriesData: {}
});

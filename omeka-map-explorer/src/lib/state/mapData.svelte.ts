import type { GeoJsonData, ProcessedItem } from '$lib/types';

interface MapDataState {
  geoData: Record<string, GeoJsonData>;
  allItems: ProcessedItem[];
  visibleItems: ProcessedItem[];
  places: any[]; // Raw places data from index.json
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
  places: [], // Raw places data from index.json
  highlightedRegions: {},
  selectedCountry: null,
  selectedRegion: null,
  viewMode: 'bubbles',
  zoom: 5,
  center: [10.0, 0.0],
  countriesData: {}
});

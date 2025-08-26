import type { GeoJsonData } from '$lib/types';

// Cache for GeoJSON files
const geoJsonCache = new Map<string, GeoJsonData>();

/**
 * Load GeoJSON file for a country
 * @param {string} country - Country name
 * @param {string} level - 'regions' or 'prefectures'
 * @returns {Promise<GeoJsonData>} - GeoJSON data
 */
export async function loadGeoJson(country: string, level = 'regions'): Promise<GeoJsonData> {
  const cacheKey = `${country}_${level}`;
  
  // Check cache first
  if (geoJsonCache.has(cacheKey)) {
    return geoJsonCache.get(cacheKey) as GeoJsonData;
  }
  
  // Create filename
  const fileName = `${country.toLowerCase().replace(/\s+/g, '_')}_${level}.geojson`;
  const url = `/data/geojson/${fileName}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load GeoJSON: ${response.statusText}`);
    }
    
    const geoJson = await response.json();
    
    // Ensure 'name' property exists in each feature
    normalizeGeoJson(geoJson);
    
    // Cache the result
    geoJsonCache.set(cacheKey, geoJson);
    
    return geoJson;
  } catch (error) {
    console.error(`Error loading GeoJSON for ${country} (${level}):`, error);
    throw error;
  }
}

/**
 * Load a raw GeoJSON file by filename from /data/geojson
 */
export async function loadGeoJsonFile(fileName: string): Promise<GeoJsonData> {
  const url = `/data/geojson/${fileName}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load GeoJSON file ${fileName}: ${response.statusText}`);
  }
  const geoJson = await response.json();
  normalizeGeoJson(geoJson);
  return geoJson as GeoJsonData;
}

/**
 * Normalize GeoJSON to ensure it has a 'name' property
 * @param {GeoJsonData} geoJson - GeoJSON object
 */
function normalizeGeoJson(geoJson: GeoJsonData): void {
  if (!geoJson.features || !Array.isArray(geoJson.features)) {
    return;
  }
  
  geoJson.features.forEach(feature => {
    if (!feature.properties) {
      feature.properties = { name: 'Unknown' };
    }
    
    if (!feature.properties.name) {
      // Try to find name in other properties
      if (feature.properties.NAME) {
        feature.properties.name = feature.properties.NAME;
      } else if (feature.properties.shape2) {
        feature.properties.name = feature.properties.shape2;
      } else if (feature.properties.id) {
        feature.properties.name = feature.properties.id;
      } else {
        feature.properties.name = 'Unknown';
      }
    }
  });
}

/**
 * Count items per region in GeoJSON
 * @param {Array<[number, number]>} coordinates - Array of [lat, lng] coordinates
 * @param {GeoJsonData} geoJson - GeoJSON object
 * @returns {Record<string, number>} - Map of region names to counts
 */
export function countItemsPerRegion(coordinates: [number, number][], geoJson: GeoJsonData): Record<string, number> {
  // This would use turf.js in a real implementation
  // Simplified version for roadmap
  const counts: Record<string, number> = {};
  
  coordinates.forEach(coord => {
    const region = findRegionForCoordinate(coord, geoJson);
    if (region) {
      counts[region] = (counts[region] || 0) + 1;
    }
  });
  
  return counts;
}

/**
 * Find the region that contains a coordinate
 * @param {[number, number]} coord - [lat, lng] coordinate
 * @param {GeoJsonData} geoJson - GeoJSON object
 * @returns {string|null} - Region name or null if not found
 */
function findRegionForCoordinate(coord: [number, number], geoJson: GeoJsonData): string | null {
  // This is a placeholder for the actual point-in-polygon check
  // Would use turf.js pointInPolygon in actual implementation
  return null;
} 
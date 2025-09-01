import type { GeoJsonData, GeoJsonFeature, ProcessedItem, LocationEntity } from '$lib/types';

// Cache for GeoJSON files
const geoJsonCache = new Map<string, GeoJsonData>();

// Cache for choropleth calculations
let choroplethCache: {
	data: Record<string, number>;
	hash: string;
} | null = null;

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
	const url = `data/geojson/${fileName}`;

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
	const url = `data/geojson/${fileName}`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to load GeoJSON file ${fileName}: ${response.statusText}`);
	}
	const geoJson = await response.json();
	normalizeGeoJson(geoJson);
	return geoJson as GeoJsonData;
}

/**
 * Load world countries GeoJSON from /data/maps/world_countries.geojson
 */
export async function loadWorldCountries(): Promise<GeoJsonData> {
	const cacheKey = 'world_countries';
	if (geoJsonCache.has(cacheKey)) {
		return geoJsonCache.get(cacheKey) as GeoJsonData;
	}

	const url = `data/maps/world_countries.geojson`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to load world countries GeoJSON: ${response.statusText}`);
	}
	const geoJson = await response.json();
	normalizeGeoJson(geoJson);
	geoJsonCache.set(cacheKey, geoJson);
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

	geoJson.features.forEach((feature) => {
		if (!feature.properties) {
			feature.properties = { name: 'Unknown' };
		}

		if (!feature.properties.name) {
			// Try to find name in other properties
			if (feature.properties.NAME) {
				feature.properties.name = feature.properties.NAME;
			} else if (feature.properties.ADMIN) {
				feature.properties.name = feature.properties.ADMIN;
			} else if (feature.properties.NAME_EN) {
				feature.properties.name = feature.properties.NAME_EN;
			} else if (feature.properties.NAME_LONG) {
				feature.properties.name = feature.properties.NAME_LONG;
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
export function countItemsPerRegion(
	coordinates: [number, number][],
	geoJson: GeoJsonData
): Record<string, number> {
	// This would use turf.js in a real implementation
	// Simplified version for roadmap
	const counts: Record<string, number> = {};

	coordinates.forEach((coord) => {
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

/**
 * Count items per country polygon using item GPS coordinates.
 * Falls back to 0 when no coordinate is present.
 */
export async function countItemsByCountryPolygons(
	items: ProcessedItem[],
	worldGeo: GeoJsonData
): Promise<Record<string, number>> {
	const counts: Record<string, number> = {};

	// Pre-extract features and geometries with bounding boxes for efficiency
	const features = (worldGeo.features || []).filter((f) => !!f?.geometry && !!f?.properties?.name);
	const featuresWithBbox = features.map((f) => ({
		f,
		bbox: computeFeatureBbox(f),
		name: f.properties.name as string
	}));

	// Limit processing to avoid freezing - process in batches
	const maxItems = Math.min(items.length, 5000); // Limit to 5000 items max
	const itemsToProcess = items.slice(0, maxItems);

	let processed = 0;
	for (const item of itemsToProcess) {
		const coords = item.coordinates?.[0];
		if (!coords) continue;
		const lat = coords[0];
		const lng = coords[1];
		if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) continue;

		// Basic coordinate validation
		if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

		const pt: [number, number] = [lng, lat]; // GeoJSON uses [lng, lat]

		// Find first containing feature using bounding box optimization
		let found = false;
		for (const { f, bbox, name } of featuresWithBbox) {
			// Quick bounding box check first
			if (!bboxContains(bbox, pt)) continue;

			// More expensive polygon intersection test
			try {
				if (pointInFeature(pt, f)) {
					counts[name] = (counts[name] || 0) + 1;
					found = true;
					break;
				}
			} catch (error) {
				// Ignore polygon errors and continue
				continue;
			}
		}

		processed++;
		// Yield control periodically to prevent freezing
		if (processed % 100 === 0) {
			// This allows the browser to remain responsive
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	}

	return counts;
}

/**
 * Create hash for choropleth data caching
 */
function createChoroplethHash(items: ProcessedItem[]): string {
	if (items.length === 0) return 'empty';
	
	// Create a hash based on the items (simplified)
	const itemIds = items.map(i => i.id).sort();
	const sample = itemIds.slice(0, 10).join(',') + itemIds.slice(-10).join(',');
	return `${items.length}-${sample}`;
}

/**
 * Count items by country using pre-computed country names from the data.
 * This uses the Country field that was added by the Python preprocessing script.
 *
 * IMPORTANT: This counts each unique article only once per country.
 * If an article mentions multiple places within the same country, it only counts once for that country.
 */
export function countItemsByCountryHybrid(
	items: ProcessedItem[],
	worldGeo: GeoJsonData
): Record<string, number> {
	// Check cache first
	const currentHash = createChoroplethHash(items);
	if (choroplethCache && choroplethCache.hash === currentHash) {
		return choroplethCache.data;
	}

	const counts: Record<string, number> = {};

	// Group items by article ID and country to avoid double-counting
	const articleCountryPairs = new Set<string>();

	for (const item of items) {
		// Use the LOCATION country for the bucket label (map coloring),
		// but de-duplicate by the ORIGINAL ARTICLE id and country.
		const countryName = item.country?.trim();
		// Base article id (strip -index we added per coordinate)
		const baseId = (item.id ?? '').toString().split('-')[0].trim();
		const articleId = baseId || item.id?.toString()?.trim();

		if (countryName && articleId) {
			// Create a unique key for this article-country combination
			const pairKey = `${articleId}:${countryName}`;

			// Only count if we haven't seen this article-country pair before
			if (!articleCountryPairs.has(pairKey)) {
				articleCountryPairs.add(pairKey);
				counts[countryName] = (counts[countryName] || 0) + 1;
			}
		}
	}

	// Cache the result
	choroplethCache = { data: counts, hash: currentHash };

	return counts;
}

/**
 * Clear choropleth cache (useful for testing or when data changes)
 */
export function clearChoroplethCache() {
	choroplethCache = null;
	console.log('Choropleth cache cleared');
}

/**
 * Count locations by country using the locations entities.
 * This can be used for choropleth view to show all places with their entity data.
 */
export function countLocationsByCountry(locations: LocationEntity[]): Record<string, number> {
	const counts: Record<string, number> = {};

	for (const location of locations) {
		if (location.country?.trim()) {
			const countryName = location.country.trim();
			counts[countryName] = (counts[countryName] || 0) + 1;
		}
	}

	return counts;
}

/**
 * Synchronous version for better performance - simplified polygon checking
 */
function countItemsByCountryPolygonsSync(
	items: ProcessedItem[],
	worldGeo: GeoJsonData
): Record<string, number> {
	const counts: Record<string, number> = {};

	// Pre-extract features with bounding boxes for efficiency
	const features = (worldGeo.features || []).filter((f) => !!f?.geometry && !!f?.properties?.name);
	const featuresWithBbox = features.map((f) => ({
		f,
		bbox: computeFeatureBbox(f),
		name: f.properties.name as string
	}));

	for (const item of items) {
		const coords = item.coordinates?.[0];
		if (!coords) continue;
		const lat = coords[0];
		const lng = coords[1];
		if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) continue;

		// Basic coordinate validation
		if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

		const pt: [number, number] = [lng, lat]; // GeoJSON uses [lng, lat]

		// Find first containing feature using only bounding box for speed
		let found = false;
		for (const { f, bbox, name } of featuresWithBbox) {
			// Quick bounding box check first
			if (!bboxContains(bbox, pt)) continue;

			// For performance, only do simple polygon check for small polygons
			try {
				if (pointInFeature(pt, f)) {
					counts[name] = (counts[name] || 0) + 1;
					found = true;
					break;
				}
			} catch (error) {
				// If polygon check fails, just use bounding box match
				counts[name] = (counts[name] || 0) + 1;
				found = true;
				break;
			}
		}
	}

	return counts;
}

type BBox = [number, number, number, number]; // [minx, miny, maxx, maxy]

function computeFeatureBbox(feature: GeoJsonFeature): BBox {
	const coords = feature.geometry.coordinates as any[];
	let minx = Infinity,
		miny = Infinity,
		maxx = -Infinity,
		maxy = -Infinity;
	const walk = (arr: any[]) => {
		if (typeof arr[0] === 'number' && typeof arr[1] === 'number') {
			const x = arr[0],
				y = arr[1];
			if (x < minx) minx = x;
			if (y < miny) miny = y;
			if (x > maxx) maxx = x;
			if (y > maxy) maxy = y;
		} else if (Array.isArray(arr)) {
			for (const a of arr) walk(a);
		}
	};
	walk(coords);
	return [minx, miny, maxx, maxy];
}

function bboxContains(b: BBox, pt: [number, number]) {
	return pt[0] >= b[0] && pt[0] <= b[2] && pt[1] >= b[1] && pt[1] <= b[3];
}

/**
 * Fastest: count by matching normalized country names only.
 */
export function countItemsByCountryName(
	items: ProcessedItem[],
	worldGeo: GeoJsonData
): Record<string, number> {
	const counts: Record<string, number> = {};
	const normalize = (s: string) =>
		s
			.normalize('NFD')
			.replace(/\p{Diacritic}/gu, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, ' ')
			.trim();
	const nameIndex = new Map<string, string>();
	for (const f of worldGeo.features || []) {
		const props = f?.properties as Record<string, any>;
		const primary = props?.name as string | undefined;
		if (primary) nameIndex.set(normalize(primary), primary);
		for (const [k, v] of Object.entries(props || {})) {
			if (!v || typeof v !== 'string') continue;
			const key = k.toLowerCase();
			if (key === 'admin' || key.startsWith('name')) {
				const norm = normalize(v);
				if (!nameIndex.has(norm)) nameIndex.set(norm, primary ?? v);
			}
		}
	}
	for (const item of items) {
		const nm = item.country?.trim();
		if (!nm) continue;
		const mapped = nameIndex.get(normalize(nm));
		if (mapped) counts[mapped] = (counts[mapped] || 0) + 1;
	}
	return counts;
}

// Geometry helpers (ray casting)
function pointInFeature(pt: [number, number], feature: GeoJsonFeature): boolean {
	const geom = feature.geometry;
	if (!geom) return false;
	if (geom.type === 'Polygon') {
		return pointInPolygonRings(pt, geom.coordinates as [number, number][][]);
	} else if (geom.type === 'MultiPolygon') {
		const polys = geom.coordinates as [number, number][][][];
		for (const poly of polys) {
			if (pointInPolygonRings(pt, poly as unknown as [number, number][][])) return true;
		}
		return false;
	}
	return false;
}

function pointInPolygonRings(pt: [number, number], rings: [number, number][][]): boolean {
	if (!rings || rings.length === 0) return false;
	// Only test outer ring (rings[0]) to keep it simple
	const ring = rings[0];
	return rayCasting(pt, ring);
}

function rayCasting(pt: [number, number], ring: [number, number][]): boolean {
	const x = pt[0],
		y = pt[1];
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const xi = ring[i][0],
			yi = ring[i][1];
		const xj = ring[j][0],
			yj = ring[j][1];
		const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi;
		if (intersect) inside = !inside;
	}
	return inside;
}

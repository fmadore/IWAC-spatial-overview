import type { ProcessedItem } from '$lib/types';
import { base } from '$app/paths';

// Cache for precomputed data
const worldMapCache = new Map<string, any>();

// Cache metadata
let cacheMetadata: any = null;

/**
 * Load cache metadata
 */
async function loadCacheMetadata() {
	if (cacheMetadata) return cacheMetadata;
	
	try {
		const url = `${base}/data/world_cache/metadata.json`;
		console.log(`Checking cache metadata at: ${url}`);
		const response = await fetch(url);
		if (response.ok) {
			cacheMetadata = await response.json();
			console.log('Cache metadata loaded successfully:', cacheMetadata);
			return cacheMetadata;
		} else {
			console.warn(`Cache metadata not available - Status: ${response.status}`);
		}
	} catch (e) {
		console.warn('World map cache metadata not available:', e);
	}
	return null;
}

/**
 * Load precomputed choropleth data for fast country coloring
 * @param options - Filter options to determine which cache file to load
 */
export async function loadChoroplethCache(options: {
	year?: number;
	entityType?: string;
} = {}): Promise<Record<string, number> | null> {
	try {
		// Determine cache file based on options
		let cacheFile: string;
		
		if (options.year) {
			cacheFile = `choropleth/by_year/${options.year}.json`;
		} else if (options.entityType) {
			cacheFile = `choropleth/by_entity/${options.entityType}.json`;
		} else {
			cacheFile = 'choropleth/all_countries.json';
		}
		
		console.log(`Loading choropleth cache: ${cacheFile}`, options);
		
		// Check cache first
		const cacheKey = `choropleth_${cacheFile}`;
		if (worldMapCache.has(cacheKey)) {
			console.log(`Using in-memory cache for: ${cacheFile}`);
			return worldMapCache.get(cacheKey).counts;
		}
		
		// Load from file
		const url = `${base}/data/world_cache/${cacheFile}`;
		console.log(`Fetching cache from: ${url}`);
		const response = await fetch(url);
		if (!response.ok) {
			console.warn(`Failed to fetch cache file: ${url} - Status: ${response.status}`);
			return null;
		}
		
		const data = await response.json();
		worldMapCache.set(cacheKey, data);
		
		console.log(`Successfully loaded cache: ${cacheFile}`, {
			countries: Object.keys(data.counts || {}).length,
			totalArticles: data.total_articles
		});
		
		return data.counts || {};
		
	} catch (e) {
		console.error('Failed to load choropleth cache:', e);
		return null;
	}
}

/**
 * Load precomputed coordinate clusters for fast map marker rendering with advanced filtering
 * @param options - Filter options for efficient cache-based filtering
 */
export async function loadCoordinateCache(options: {
	country?: string;
	countries?: string[];
	dateRange?: { start: Date; end: Date };
	year?: number;
	entityType?: string;
} = {}): Promise<CoordinateCluster[] | null> {
	try {
		// Determine cache file based on most specific filter
		let cacheFile: string;
		
		if (options.year) {
			cacheFile = `coordinates/by_year/${options.year}.json`;
		} else if (options.entityType) {
			// Entity-specific cache files don't exist yet, return null to trigger fallback
			console.log(`Entity-specific coordinate cache not available for: ${options.entityType}`);
			return null;
		} else if (options.country) {
			cacheFile = `coordinates/by_country/${normalizeCountryFilename(options.country)}.json`;
		} else {
			cacheFile = 'coordinates/all_locations.json';
		}
		
		// Create cache key including all filter options
		const cacheKey = `coordinates_${JSON.stringify(options)}`;
		if (worldMapCache.has(cacheKey)) {
			console.log(`Using memory cached coordinate data for: ${cacheKey}`);
			return worldMapCache.get(cacheKey);
		}
		
		console.log(`Loading coordinate cache from: ${cacheFile}`);
		
		// Load base data from file
		const response = await fetch(`${base}/data/world_cache/${cacheFile}`);
		if (!response.ok) {
			console.warn(`Coordinate cache file not found: ${cacheFile}`);
			return null;
		}
		
		const data = await response.json();
		let clusters = data.clusters || [];
		console.log(`Loaded ${clusters.length} coordinate clusters from cache file`);
		
		// Apply additional filters efficiently on cached data
		if (options.countries && options.countries.length > 0) {
			const countrySet = new Set(options.countries);
			clusters = clusters.filter((cluster: CoordinateCluster) => 
				countrySet.has(cluster.country)
			);
			console.log(`Filtered to ${clusters.length} clusters by countries: [${options.countries.join(', ')}]`);
		}
		
		// Cache the filtered result
		worldMapCache.set(cacheKey, clusters);
		
		return clusters;
		
	} catch (e) {
		console.warn('Failed to load coordinate cache:', e);
		return null;
	}
}

/**
 * Load coordinate clusters grouped by ARTICLE country (articleCountry union semantics).
 * When multiple article countries are requested, merges clusters by rounded coordinate key.
 * This matches the semantic: selecting a country includes ALL locations mentioned by articles whose
 * articleCountry equals that selection (locations can be in other physical countries).
 */
export async function loadArticleCountryCoordinateClusters(articleCountries: string[]): Promise<CoordinateCluster[] | null> {
	try {
		if (!articleCountries || articleCountries.length === 0) return null;
		const sorted = [...articleCountries].sort();
		const cacheKey = `article_country_coordinates_${sorted.join('__')}`;
		if (worldMapCache.has(cacheKey)) {
			return worldMapCache.get(cacheKey);
		}

		// Fetch each article-country union file
		const fetches = sorted.map(async (c) => {
			const file = `coordinates/by_article_country/${normalizeCountryFilename(c)}.json`;
			const url = `${base}/data/world_cache/${file}`;
			try {
				const resp = await fetch(url);
				if (!resp.ok) {
					console.warn(`Article-country coordinate cache missing for ${c}: ${resp.status}`);
					return null;
				}
				const data = await resp.json();
				return (data.clusters || []) as CoordinateCluster[];
			} catch (e) {
				console.warn(`Failed loading article-country cache for ${c}:`, e);
				return null;
			}
		});

		const results = await Promise.all(fetches);
		const allClusters = results.filter(Boolean).flat() as CoordinateCluster[];
		if (allClusters.length === 0) {
			return null; // nothing loaded -> let caller fallback
		}

		if (sorted.length === 1) {
			worldMapCache.set(cacheKey, allClusters);
			return allClusters;
		}

		// Merge duplicates across countries by coordinate key (rounded for stability)
		const merged = new Map<string, CoordinateCluster & { relatedArticleIds: string[] }>();
		for (const cl of allClusters) {
			if (!cl || !cl.coordinates) continue;
			const [lat, lng] = cl.coordinates;
			const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
			const existing = merged.get(key);
			if (existing) {
				existing.articleCount += cl.articleCount;
				// Union relatedArticleIds
				if (cl.relatedArticleIds && cl.relatedArticleIds.length) {
					const set = new Set(existing.relatedArticleIds);
					for (const id of cl.relatedArticleIds) set.add(id);
					existing.relatedArticleIds = Array.from(set);
				}
			} else {
				merged.set(key, { ...cl, relatedArticleIds: cl.relatedArticleIds ? [...cl.relatedArticleIds] : [] });
			}
		}
		const mergedArr = Array.from(merged.values());
		worldMapCache.set(cacheKey, mergedArr);
		return mergedArr;
	} catch (e) {
		console.warn('Failed to load article-country coordinate clusters:', e);
		return null;
	}
}

/**
 * Convert cached coordinate clusters to ProcessedItem format for compatibility
 */
export function coordinateClustersToProcessedItems(clusters: CoordinateCluster[]): ProcessedItem[] {
	return clusters.map((cluster, index) => ({
		id: cluster.id || `cluster-${index}`,
		title: cluster.label,
		country: cluster.country,
		region: cluster.region,
		prefecture: cluster.prefecture,
		coordinates: [cluster.coordinates], // Wrap in array as expected by ProcessedItem
		placeLabel: cluster.label,
		articleCount: cluster.articleCount,
		// Add dummy fields required by ProcessedItem interface
		publishDate: new Date(),
		newspaperSource: '',
		spatial: [],
		articleCountry: cluster.country, // Same as location country for clusters
		keywords: [] // Empty for clusters
	}));
}

/**
 * Check if world map cache is available
 */
export async function isWorldMapCacheAvailable(): Promise<boolean> {
	const metadata = await loadCacheMetadata();
	return metadata !== null;
}

/**
 * Get cache statistics for debugging
 */
export async function getCacheStats(): Promise<{
	available: boolean;
	version?: string;
	generatedAt?: string;
	filesCount?: number;
} | null> {
	const metadata = await loadCacheMetadata();
	if (!metadata) {
		return { available: false };
	}
	
	return {
		available: true,
		version: metadata.cache_version,
		generatedAt: metadata.generated_at,
		filesCount: Object.keys(metadata.structure.choropleth).length + Object.keys(metadata.structure.coordinates).length
	};
}

/**
 * Normalize country name for filename matching
 */
function normalizeCountryFilename(country: string): string {
	return country
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '') // Remove diacritics
		.replace(/['`'']/g, '') // Remove quotes/apostrophes
		.replace(/\s+/g, '_') // Replace spaces with underscores
		.toLowerCase();
}

/**
 * Clear world map cache (useful for development/testing)
 */
export function clearWorldMapCache(): void {
	worldMapCache.clear();
	cacheMetadata = null;
}

// Type definitions for cached data
export interface CoordinateCluster {
	id: string;
	label: string;
	coordinates: [number, number]; // [lat, lng]
	country: string;
	region: string;
	prefecture: string;
	articleCount: number;
	relatedArticleIds: string[];
}

export interface ChoroplethCacheData {
	type: string;
	counts: Record<string, number>;
	total_articles: number;
	total_countries: number;
	updatedAt: string;
	year?: number;
	entity_type?: string;
}

export interface CoordinateCacheData {
	type: string;
	clusters: CoordinateCluster[];
	total_clusters: number;
	total_articles: number;
	updatedAt: string;
	country?: string;
}

import type { ProcessedItem, TemporalData } from '$lib/types';
import { loadLocations } from './entityLoader';

// Global cache for places map to avoid rebuilding on every data load
let placesMapCache: Map<string, { coords: [number, number]; country: string; name: string }> | null = null;

type ArticleRow = {
	'o:id': string;
	title: string;
	newspaper: string;
	country: string;
	pub_date: string; // YYYY-MM-DD
	subject: string; // pipe-separated
	spatial: string; // pipe-separated of place labels
};

type LoadedData = {
	items: ProcessedItem[];
	timeline: TemporalData[];
	countries: string[];
	newspapers: string[];
	dateMin: Date | null;
	dateMax: Date | null;
};

function parsePipeList(s: string | null | undefined): string[] {
	if (!s) return [];
	return s
		.split('|')
		.map((t) => t.trim())
		.filter(Boolean);
}

function isValidDate(d: Date): boolean {
	return !isNaN(d.getTime());
}

async function buildPlacesMapFromLocations(
	basePath = 'data'
): Promise<Map<string, { coords: [number, number]; country: string; name: string }>> {
	// Return cached map if available
	if (placesMapCache) {
		console.log('Using cached places map with', placesMapCache.size, 'entries');
		return placesMapCache;
	}
	
	console.log('Building places map from locations.json...');
	const map = new Map<string, { coords: [number, number]; country: string; name: string }>();
	
	try {
		const locations = await loadLocations(basePath);
		console.log('Loaded', locations.length, 'locations for places map');
		
		for (const location of locations) {
			if (location.coordinates) {
				const key = location.name.trim().toLowerCase();
				const country = location.country || '';
				if (!map.has(key)) {
					map.set(key, { 
						coords: location.coordinates, 
						country,
						name: location.name
					});
				}
			}
		}
		
		// Cache the map for future use
		placesMapCache = map;
		console.log('Cached places map with', map.size, 'entries');
	} catch (error) {
		console.error('Failed to load locations for places map:', error);
	}
	
	return map;
}

function groupByMonth(items: ProcessedItem[]): TemporalData[] {
	const groups: Record<string, { date: Date; count: number; items: ProcessedItem[] }> = {};
	for (const it of items) {
		if (!it.publishDate) continue;
		const d = new Date(it.publishDate);
		if (!isValidDate(d)) continue;
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		if (!groups[key]) {
			const monthDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
			groups[key] = { date: monthDate, count: 0, items: [] };
		}
		groups[key].count += 1;
		groups[key].items.push(it);
	}
	return Object.values(groups).sort((a, b) => a.date.getTime() - b.date.getTime());
}

export async function loadStaticData(basePath = 'data'): Promise<LoadedData> {
	const [articlesRes] = await Promise.all([
		fetch(`${basePath}/articles.json`)
	]);
	if (!articlesRes.ok) throw new Error(`Failed to load articles.json: ${articlesRes.status}`);

	const articles: ArticleRow[] = await articlesRes.json();

	// Build places map from locations.json instead of index.json
	const places = await buildPlacesMapFromLocations(basePath);

	const items: ProcessedItem[] = [];
	const countriesSet = new Set<string>();
	const newspapersSet = new Set<string>();
	let dateMin: Date | null = null;
	let dateMax: Date | null = null;

	for (const a of articles) {
		const id = a['o:id']?.toString() || '';
		const title = a.title || 'Untitled';
		const country = a.country || '';
		const newspaperSource = a.newspaper || '';
		const keywords = parsePipeList(a.subject);
		const spatialLabels = parsePipeList(a.spatial);

		let publishDate: Date = new Date('');
		if (a.pub_date) {
			const d = new Date(a.pub_date);
			if (isValidDate(d)) publishDate = d;
		}

		const coordinates: [number, number][] = [];
		const coordinateCountries: string[] = []; // Track country for each coordinate
		const coordinateLabels: string[] = []; // Track canonical label for each coordinate
		let derivedCountry = country; // Start with country from articles data

	for (const label of spatialLabels) {
			const key = label.trim().toLowerCase();
			const placeInfo = places.get(key);
			if (placeInfo) {
				coordinates.push(placeInfo.coords);
				coordinateCountries.push(placeInfo.country || '');
		coordinateLabels.push(placeInfo.name || label);
				// If no country in articles data but we have it from places, use it
				if (!derivedCountry && placeInfo.country) {
					derivedCountry = placeInfo.country;
				}
			}
		}

		// Create one ProcessedItem per coordinate to handle multi-location articles correctly
		if (coordinates.length > 0) {
			for (let i = 0; i < coordinates.length; i++) {
				const coord = coordinates[i];
				const coordCountry = coordinateCountries[i] || derivedCountry;
				const coordLabel = coordinateLabels[i];

				const processed: ProcessedItem = {
					id: `${id}-${i}`, // Unique ID per coordinate
					title,
					publishDate,
					coordinates: [coord], // Single coordinate per item
					country: coordCountry,
					articleCountry: country,
					region: null,
					prefecture: null,
					newspaperSource,
					keywords,
					spatial: spatialLabels,
					placeLabel: coordLabel
				};

				if (coordCountry) countriesSet.add(coordCountry);
				if (newspaperSource) newspapersSet.add(newspaperSource);
				if (isValidDate(publishDate)) {
					if (!dateMin || publishDate < dateMin) dateMin = publishDate;
					if (!dateMax || publishDate > dateMax) dateMax = publishDate;
				}

				items.push(processed);
			}
		} else {
			// No coordinates found, create item without coordinates
			const processed: ProcessedItem = {
				id,
				title,
				publishDate,
				coordinates: null,
				country: derivedCountry,
				articleCountry: country,
				region: null,
				prefecture: null,
				newspaperSource,
				keywords,
				spatial: spatialLabels
			};

			if (derivedCountry) countriesSet.add(derivedCountry);
			if (newspaperSource) newspapersSet.add(newspaperSource);
			if (isValidDate(publishDate)) {
				if (!dateMin || publishDate < dateMin) dateMin = publishDate;
				if (!dateMax || publishDate > dateMax) dateMax = publishDate;
			}

			items.push(processed);
		}
	}

	const timeline = groupByMonth(items);

	return {
		items,
		timeline,
		countries: Array.from(countriesSet).sort(),
		newspapers: Array.from(newspapersSet).sort(),
		dateMin,
		dateMax
	};
}

/**
 * Clear the places map cache (useful for testing or data updates)
 */
export function clearPlacesMapCache() {
	placesMapCache = null;
	console.log('Places map cache cleared');
}

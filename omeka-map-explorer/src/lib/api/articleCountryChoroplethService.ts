/**
 * Service for loading pre-computed article-country choropleth data.
 * 
 * These cache files contain choropleth counts for articles FROM a specific country,
 * showing WHERE those articles mention locations (with proper deduplication).
 * 
 * Example: For articleCountry="Benin", shows how many Benin articles mention
 * each world country, with each article counted only once per destination country.
 */

import { base } from '$app/paths';

export interface ArticleCountryChoroplethData {
	type: 'article_country_choropleth';
	articleCountry: string;
	counts: Record<string, number>; // locationCountry -> unique article count
	total_location_countries: number;
	total_unique_articles: number;
	updatedAt: string;
}

/**
 * Load choropleth data for a specific article country.
 * Returns counts showing where that country's articles mention locations.
 */
export async function loadArticleCountryChoroplethData(
	articleCountry: string
): Promise<ArticleCountryChoroplethData | null> {
	try {
		const filename = normalizeCountryFilename(articleCountry);
		const url = `${base}/data/world_cache/choropleth/by_article_country/${filename}.json`;
		console.log(`🔍 Loading article-country choropleth cache from: ${url}`);
		const response = await fetch(url);
		
		if (!response.ok) {
			if (response.status === 404) {
				console.warn(`No choropleth cache found for article country: ${articleCountry} (${url})`);
				return null;
			}
			throw new Error(`Failed to load choropleth data: ${response.status} from ${url}`);
		}
		
		const data = await response.json();
		console.log(`✅ Loaded choropleth cache for ${articleCountry}:`, {
			countries: Object.keys(data.counts).length,
			totalArticles: data.total_unique_articles
		});
		return data;
	} catch (error) {
		console.error(`Error loading article-country choropleth for ${articleCountry}:`, error);
		return null;
	}
}

/**
 * Load and merge choropleth data for multiple article countries.
 * Performs proper union: each destination country gets the sum of unique articles
 * from all selected article countries that mention that destination.
 */
export async function loadMultipleArticleCountryChoroplethData(
	articleCountries: string[]
): Promise<Record<string, number>> {
	if (articleCountries.length === 0) {
		return {};
	}
	
	// Load all cache files in parallel
	const promises = articleCountries.map(country => 
		loadArticleCountryChoroplethData(country)
	);
	
	const results = await Promise.all(promises);
	
	// Merge counts (simple addition since each cache already has proper deduplication)
	const merged: Record<string, number> = {};
	
	for (const data of results) {
		if (!data) continue;
		
			for (const [locationCountry, count] of Object.entries(data.counts)) {
			merged[locationCountry] = (merged[locationCountry] || 0) + count;
		}
	}
	
	return merged;
}

/**
 * Normalize country name to filename format (lowercase, no spaces, etc.)
 * Should match the normalization used in the Python cache builder.
 */
function normalizeCountryFilename(country: string): string {
	// Match Python's unicodedata.normalize('NFD', country) and remove diacritics
	let normalized = country.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
	
	// Match Python's apostrophe removal: .replace("'", '').replace("'", '').replace('`', '')
	normalized = normalized.replace(/['`'']/g, '');
	
	// Replace spaces with underscores and convert to lowercase
	normalized = normalized.replace(/\s+/g, '_').toLowerCase();
	
	return normalized;
}

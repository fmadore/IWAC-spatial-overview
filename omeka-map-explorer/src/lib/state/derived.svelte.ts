import type { ProcessedItem } from '$lib/types';
import { timeData } from './timeData.svelte';
import { filters } from './filters.svelte';
import { mapData } from './mapData.svelte';
import { appState } from './appState.svelte';

// Memoization cache for getVisibleData
let visibleDataCache: {
	data: ProcessedItem[];
	hash: string;
} | null = null;

// Pre-computed article IDs for faster entity filtering
let articleIdCache: Map<string, string> = new Map();

function getFilterHash(): string {
	const sel = filters.selected;
	const entity = appState.selectedEntity;
	return JSON.stringify({
		countries: sel.countries.slice().sort(),
		regions: sel.regions.slice().sort(), 
		newspapers: sel.newspapers.slice().sort(),
		dateRange: sel.dateRange ? { 
			start: sel.dateRange.start.getTime(), 
			end: sel.dateRange.end.getTime() 
		} : null,
		keywords: sel.keywords.slice().sort(),
	// Include entity identity AND a lightweight signature of its related articles
	// so the cache invalidates once hydration fills relatedArticleIds.
	entityId: entity ? `${entity.type}:${entity.id}` : null,
	entityArticlesSig: entity
	    ? {
		    len: entity.relatedArticleIds?.length ?? 0,
		    // first/last few IDs help detect changes beyond length with minimal payload
		    head: (entity.relatedArticleIds ?? []).slice(0, 2),
		    tail: (entity.relatedArticleIds ?? []).slice(-2)
	      }
	    : null,
		dataVersion: mapData.allItems.length // Simple way to detect data changes
	});
}

function extractArticleId(itemId: string): string {
	// Cache the result to avoid repeated string operations
	if (articleIdCache.has(itemId)) {
		return articleIdCache.get(itemId)!;
	}
	
	const articleId = itemId.split('-')[0];
	articleIdCache.set(itemId, articleId);
	return articleId;
}

export function getVisibleData(): ProcessedItem[] {
	// Check cache first
	const currentHash = getFilterHash();
	if (visibleDataCache && visibleDataCache.hash === currentHash) {
		return visibleDataCache.data;
	}

	const items = mapData.allItems;
	if (!items.length) {
		const emptyResult: ProcessedItem[] = [];
		visibleDataCache = { data: emptyResult, hash: currentHash };
		return emptyResult;
	}

	const sel = filters.selected;
	let filtered = items;

	// Filter by selected entity (persons, organizations, etc.)
	// Only apply once the entity is hydrated with at least one related article.
	if (appState.selectedEntity && appState.selectedEntity.relatedArticleIds?.length) {
		// Get articles that mention this entity
		const entityArticleIds = new Set(appState.selectedEntity.relatedArticleIds);
		filtered = filtered.filter((item) => {
			// Use cached article ID extraction
			const articleId = extractArticleId(item.id);
			return entityArticleIds.has(articleId);
		});
	}

	// Filter by countries
	if (sel.countries.length) {
		filtered = filtered.filter((i) =>
			sel.countries.includes((i as any).articleCountry || i.country)
		);
	}

	// Filter by regions
	if (sel.regions.length) {
		filtered = filtered.filter((i) => i.region && sel.regions.includes(i.region));
	}

	// Filter by newspapers
	if (sel.newspapers.length) {
		filtered = filtered.filter((i) => sel.newspapers.includes(i.newspaperSource));
	}

	// Filter by date range (year range filter)
	if (sel.dateRange) {
		const { start, end } = sel.dateRange;
		filtered = filtered.filter(
			(i) => i.publishDate && i.publishDate >= start && i.publishDate <= end
		);
	}
	// Note: If no date range is selected, show ALL articles (don't filter by timeline date)
	// Timeline filtering is only applied when the timeline is actively being used for animation

	// Filter by keywords
	if (sel.keywords.length) {
		filtered = filtered.filter(
			(i) => i.keywords.length && sel.keywords.some((k) => i.keywords.includes(k))
		);
	}

	// Cache the result
	visibleDataCache = { data: filtered, hash: currentHash };
	
	return filtered;
}

export function getStats() {
	const list = getVisibleData();
	const countryBreakdown: Record<string, number> = {};
	const newspaperBreakdown: Record<string, number> = {};
	const timeline: { date: string; count: number }[] = [];

	for (const item of list) {
		countryBreakdown[item.country] = (countryBreakdown[item.country] || 0) + 1;
		newspaperBreakdown[item.newspaperSource] = (newspaperBreakdown[item.newspaperSource] || 0) + 1;
		if (item.publishDate) {
			const key = item.publishDate.toISOString().slice(0, 7);
			const slot = timeline.find((t) => t.date === key);
			slot ? slot.count++ : timeline.push({ date: key, count: 1 });
		}
	}
	timeline.sort((a, b) => a.date.localeCompare(b.date));
	return { totalCount: list.length, countryBreakdown, newspaperBreakdown, timeline };
}

/**
 * Clear the visible data cache (useful when data structure changes)
 */
export function clearVisibleDataCache() {
	visibleDataCache = null;
	articleIdCache.clear();
	console.log('Visible data cache cleared');
}

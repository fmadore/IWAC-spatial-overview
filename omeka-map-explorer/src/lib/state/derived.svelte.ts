import type { ProcessedItem } from '$lib/types';
import { timeData } from './timeData.svelte';
import { filters } from './filters.svelte';
import { mapData } from './mapData.svelte';
import { appState } from './appState.svelte';

export function getVisibleData(): ProcessedItem[] {
  const items = mapData.allItems;
  if (!items.length) return [];

  const sel = filters.selected;
  let filtered = items;

  // Filter by selected entity (persons, organizations, etc.)
  if (appState.selectedEntity) {
    // Get articles that mention this entity
    const entityArticleIds = new Set(appState.selectedEntity.relatedArticleIds);
    filtered = filtered.filter(item => {
      // Extract article ID from processed item ID (format: "articleId-coordinateIndex")
      const articleId = item.id.split('-')[0];
      return entityArticleIds.has(articleId);
    });
  }

  // Filter by countries
  if (sel.countries.length) {
    filtered = filtered.filter(i => sel.countries.includes((i as any).articleCountry || i.country));
  }

  // Filter by regions
  if (sel.regions.length) {
    filtered = filtered.filter(i => i.region && sel.regions.includes(i.region));
  }

  // Filter by newspapers
  if (sel.newspapers.length) {
    filtered = filtered.filter(i => sel.newspapers.includes(i.newspaperSource));
  }

  // Filter by date range (year range filter)
  if (sel.dateRange) {
    const { start, end } = sel.dateRange;
    filtered = filtered.filter(i => i.publishDate && i.publishDate >= start && i.publishDate <= end);
  }
  // Note: If no date range is selected, show ALL articles (don't filter by timeline date)
  // Timeline filtering is only applied when the timeline is actively being used for animation

  // Filter by keywords
  if (sel.keywords.length) {
    filtered = filtered.filter(i => i.keywords.length && sel.keywords.some(k => i.keywords.includes(k)));
  }

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
      const key = item.publishDate.toISOString().slice(0,7);
      const slot = timeline.find(t => t.date === key);
      slot ? slot.count++ : timeline.push({ date: key, count: 1 });
    }
  }
  timeline.sort((a,b) => a.date.localeCompare(b.date));
  return { totalCount: list.length, countryBreakdown, newspaperBreakdown, timeline };
}

import type { ProcessedItem } from '$lib/types';
import { timeData } from './timeData.svelte';
import { filters } from './filters.svelte';
import { mapData } from './mapData.svelte';

export const visibleData = $derived.by<ProcessedItem[]>(() => {
  const items = mapData.allItems;
  if (!items.length) return [];
  const currentDate = timeData.currentDate;
  const monthBefore = new Date(currentDate); monthBefore.setMonth(monthBefore.getMonth() - 1);
  const monthAfter = new Date(currentDate); monthAfter.setMonth(monthAfter.getMonth() + 1);

  const sel = filters.selected;
  let filtered = items.filter(i => i.publishDate && i.publishDate >= monthBefore && i.publishDate <= monthAfter);
  if (sel.countries.length) filtered = filtered.filter(i => sel.countries.includes((i as any).articleCountry || i.country));
  if (sel.regions.length)   filtered = filtered.filter(i => i.region && sel.regions.includes(i.region));
  if (sel.newspapers.length) filtered = filtered.filter(i => sel.newspapers.includes(i.newspaperSource));
  if (sel.dateRange) {
    const { start, end } = sel.dateRange;
    filtered = filtered.filter(i => i.publishDate && i.publishDate >= start && i.publishDate <= end);
  }
  if (sel.keywords.length) {
    filtered = filtered.filter(i => i.keywords.length && sel.keywords.some(k => i.keywords.includes(k)));
  }
  return filtered;
});

export const stats = $derived.by(() => {
  const list = visibleData;
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
});

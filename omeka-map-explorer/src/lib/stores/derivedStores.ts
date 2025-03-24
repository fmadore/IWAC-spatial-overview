import { derived } from 'svelte/store';
import { timeDataStore } from './timeDataStore';
import { filterStore } from './filterStore';
import { mapDataStore } from './mapDataStore';
import type { ProcessedItem } from '$lib/types';

// Filter visible data based on current date and filters
export const visibleDataStore = derived(
  [timeDataStore, filterStore, mapDataStore],
  ([$timeData, $filters, $mapData]) => {
    const items: ProcessedItem[] = [];
    
    // Exit early if no data
    if (!$mapData.allItems.length) {
      return items;
    }
    
    // 1. Get items based on the current date
    // In a real app, we would find items within a timeframe around the current date
    // For the roadmap, we'll use a simple approach
    
    // Find items within a month of the current date
    const currentDate = $timeData.currentDate;
    const monthBefore = new Date(currentDate);
    monthBefore.setMonth(monthBefore.getMonth() - 1);
    
    const monthAfter = new Date(currentDate);
    monthAfter.setMonth(monthAfter.getMonth() + 1);
    
    // 2. Filter by date range
    const dateFiltered = $mapData.allItems.filter(item => {
      if (!item.publishDate) return false;
      
      // Return items in a range of ±1 month from current date
      return item.publishDate >= monthBefore && item.publishDate <= monthAfter;
    });
    
    // 3. Apply other filters
    let filtered = dateFiltered;
    
    // Filter by countries
    if ($filters.selected.countries.length > 0) {
      filtered = filtered.filter(item => 
        $filters.selected.countries.includes(item.country)
      );
    }
    
    // Filter by regions
    if ($filters.selected.regions.length > 0) {
      filtered = filtered.filter(item => 
        item.region && $filters.selected.regions.includes(item.region)
      );
    }
    
    // Filter by newspapers
    if ($filters.selected.newspapers.length > 0) {
      filtered = filtered.filter(item => 
        $filters.selected.newspapers.includes(item.newspaperSource)
      );
    }
    
    // Filter by date range (more precise than the current date filter)
    if ($filters.selected.dateRange) {
      const { start, end } = $filters.selected.dateRange;
      filtered = filtered.filter(item => 
        item.publishDate && item.publishDate >= start && item.publishDate <= end
      );
    }
    
    // Filter by keywords
    if ($filters.selected.keywords.length > 0) {
      filtered = filtered.filter(item => {
        if (!item.keywords.length) return false;
        
        return $filters.selected.keywords.some(keyword => 
          item.keywords.includes(keyword)
        );
      });
    }
    
    return filtered;
  }
);

// Get statistics about the currently visible data
export const statsStore = derived(
  visibleDataStore,
  ($visibleData) => {
    // Calculate statistics from visible data
    const countryBreakdown: Record<string, number> = {};
    const newspaperBreakdown: Record<string, number> = {};
    const timeline: { date: string; count: number }[] = [];
    
    // Build statistics
    $visibleData.forEach(item => {
      // Country breakdown
      countryBreakdown[item.country] = (countryBreakdown[item.country] || 0) + 1;
      
      // Newspaper breakdown
      newspaperBreakdown[item.newspaperSource] = (newspaperBreakdown[item.newspaperSource] || 0) + 1;
      
      // Timeline data - group by month
      if (item.publishDate) {
        const dateKey = item.publishDate.toISOString().substring(0, 7); // YYYY-MM
        const existingEntry = timeline.find(t => t.date === dateKey);
        
        if (existingEntry) {
          existingEntry.count++;
        } else {
          timeline.push({
            date: dateKey,
            count: 1
          });
        }
      }
    });
    
    // Sort timeline by date
    timeline.sort((a, b) => a.date.localeCompare(b.date));
    
    return {
      totalCount: $visibleData.length,
      countryBreakdown,
      newspaperBreakdown,
      timeline
    };
  }
); 
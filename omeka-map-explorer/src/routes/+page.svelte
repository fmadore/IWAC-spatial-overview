<script lang="ts">
  import { onMount } from 'svelte';
  // Rune state modules (Svelte 5)
  import { appState } from '$lib/state/appState.svelte';
  import { timeData } from '$lib/state/timeData.svelte';
  import { filters } from '$lib/state/filters.svelte';
  import { mapData } from '$lib/state/mapData.svelte';
  import { initialize as initAnimationController } from '$lib/components/timeline/AnimationController';
  import { fetchItemSets, fetchItemsFromSet } from '$lib/api/omekaService';
  import { processItems, groupItemsByTime } from '$lib/utils/dataProcessor';
  import { get } from 'svelte/store';
  import type { ProcessedItem } from '$lib/types';
  import { browser } from '$app/environment';
  
  import Map from '$lib/components/maps/Map.svelte';
  import Timeline from '$lib/components/timeline/Timeline.svelte';
  import FilterPanel from '$lib/components/filters/FilterPanel.svelte';
  import * as Sidebar from '$lib/components/ui/sidebar';
  
  // Configuration
  const countryItemSets: Record<string, number[]> = {
    'Benin': [2185, 5502, 2186, 2188, 2187, 2191, 2190, 2189, 4922, 5501, 5500],
    'Burkina Faso': [2199, 2200, 23448, 23273, 23449, 5503, 2215, 2214, 2207, 2209, 2210, 2213, 2201],
    'Togo': [9458, 25304, 5498, 5499],
    'Côte d\'Ivoire': [43051, 31882, 15845, 45390]
  };
  
  onMount(async () => {
    if (!browser) return;
    
    try {
      // Initialize animation controller
      initAnimationController();
      
      // Start loading data
      await loadAllData();
      
      // Initialize available filters
      initializeFilters();
      
      // Mark loading complete
  appState.loading = false;
  appState.dataLoaded = true;
    } catch (error) {
      console.error('Error initializing application:', error);
      
  appState.loading = false;
  appState.error = error instanceof Error ? error.message : 'Failed to initialize application';
    }
  });
  
  // Load all country data
  async function loadAllData() {
    const allItems: ProcessedItem[] = [];
    const countriesData: Record<string, ProcessedItem[]> = {};
    
    // For demo purposes, just create some mock data
    // In a real app, this would fetch data from the API
    for (const [country, itemSets] of Object.entries(countryItemSets)) {
      const mockItems = createMockItems(country, 50);
      countriesData[country] = mockItems;
      allItems.push(...mockItems);
    }
    
    // Store processed data
    const timelineData = groupItemsByTime(allItems, 'month');
    
    // Update stores
  timeData.data = timelineData;
  timeData.range.start = timelineData[0]?.date || new Date('1900-01-01');
  timeData.range.end = timelineData[timelineData.length - 1]?.date || new Date('2023-12-31');
  timeData.currentDate = timelineData[0]?.date || new Date('1900-01-01');

  mapData.allItems = allItems;
  mapData.countriesData = countriesData;
  mapData.visibleItems = allItems;
  }
  
  // Create mock items for demo
  function createMockItems(country: string, count: number): ProcessedItem[] {
    const items: ProcessedItem[] = [];
    const startDate = new Date('2020-01-01');
    const endDate = new Date('2023-12-31');
    const dateRange = endDate.getTime() - startDate.getTime();
    
    for (let i = 0; i < count; i++) {
      const randomDate = new Date(startDate.getTime() + Math.random() * dateRange);
      const randomLat = getRandomLatForCountry(country);
      const randomLng = getRandomLngForCountry(country);
      
      items.push({
        id: `${country}-${i}`,
        title: `Article ${i} from ${country}`,
        publishDate: randomDate,
        coordinates: [[randomLat, randomLng]],
        country: country,
        region: null,
        prefecture: null,
        newspaperSource: `${country} Times`,
        keywords: []
      });
    }
    
    return items;
  }
  
  // Get random latitude for a country (simplified)
  function getRandomLatForCountry(country: string): number {
    const countryCoords: Record<string, [number, number]> = {
      'Benin': [9.30769, 2.315834],
      'Burkina Faso': [12.238333, -1.561593],
      'Togo': [8.619543, 0.824782],
      'Côte d\'Ivoire': [7.539989, -5.54708]
    };
    
    // Return random coordinate near the country center
    const [baseLat] = countryCoords[country] || [10.0, 0.0];
    return baseLat + (Math.random() - 0.5) * 2; // +/- 1 degree
  }
  
  // Get random longitude for a country (simplified)
  function getRandomLngForCountry(country: string): number {
    const countryCoords: Record<string, [number, number]> = {
      'Benin': [9.30769, 2.315834],
      'Burkina Faso': [12.238333, -1.561593],
      'Togo': [8.619543, 0.824782],
      'Côte d\'Ivoire': [7.539989, -5.54708]
    };
    
    // Return random coordinate near the country center
    const [, baseLng] = countryCoords[country] || [10.0, 0.0];
    return baseLng + (Math.random() - 0.5) * 2; // +/- 1 degree
  }
  
  // Initialize available filters
  function initializeFilters() {
    const countries = Object.keys(countryItemSets);
    const newspapers = new Set<string>();
    const dates: Date[] = [];
    
  const allItems = mapData.allItems || [];
    
    allItems.forEach(item => {
      if (item.newspaperSource) {
        newspapers.add(item.newspaperSource);
      }
      
      if (item.publishDate) {
        dates.push(item.publishDate);
      }
    });
    
    const dateRange = dates.length > 0 ? 
      { min: new Date(Math.min(...dates.map(d => d.getTime()))), 
        max: new Date(Math.max(...dates.map(d => d.getTime()))) 
      } : 
      { min: new Date('1900-01-01'), max: new Date('2023-12-31') };
    
  filters.available.countries = countries;
  filters.available.newspapers = Array.from(newspapers);
  filters.available.dateRange = dateRange;
  }
</script>

<svelte:head>
  <title>Omeka S Map Explorer</title>
</svelte:head>

{#if !browser}
  <div class="ssr-message">
    <p>Map visualization loading...</p>
  </div>
{:else if appState.loading}
  <div class="loading-indicator">
    <p>Loading data...</p>
  </div>
{:else if appState.error}
  <div class="error-display">
    <h2>Error</h2>
    <p>{appState.error}</p>
  </div>
{:else}
  <div class="flex h-screen w-screen overflow-hidden">
    <FilterPanel />
    
    <main class="flex flex-col flex-1 overflow-hidden">
      <header class="flex h-16 items-center justify-between px-4 border-b">
        <h1 class="text-xl font-bold">Newspaper Article Locations</h1>
        <div class="flex items-center gap-2">
          <Sidebar.Trigger />
        </div>
      </header>
      
      <div class="flex flex-col flex-1 overflow-hidden">
        <div class="flex-1">
          <Map />
        </div>
        
        <div class="border-t bg-muted/30 p-4">
          <Timeline 
            data={timeData.data}
            height="120px"
          />
        </div>
        
        {#if appState.selectedItem}
          <div class="border-t p-4 bg-background">
            <div class="bg-card rounded-lg p-4 shadow-sm">
              <h3 class="font-semibold text-lg mb-2">{appState.selectedItem.title}</h3>
              <div class="space-y-1 text-sm text-muted-foreground">
                <p>Date: {appState.selectedItem.publishDate?.toLocaleDateString()}</p>
                <p>Country: {appState.selectedItem.country}</p>
                <p>Source: {appState.selectedItem.newspaperSource}</p>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </main>
  </div>
{/if}

<style>
  .loading-indicator, .error-display, .ssr-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    width: 100vw;
  }
  
  .error-display {
    color: #d32f2f;
  }
  
  .ssr-message {
    background-color: #f5f5f5;
    color: #333;
  }
</style>

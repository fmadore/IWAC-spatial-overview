<script lang="ts">
  import { onMount } from 'svelte';
  // Rune state modules (Svelte 5)
  import { appState } from '$lib/state/appState.svelte';
  import { timeData } from '$lib/state/timeData.svelte';
  import { filters } from '$lib/state/filters.svelte';
  import { mapData } from '$lib/state/mapData.svelte';
  import { initialize as initAnimationController } from '$lib/components/timeline/AnimationController';
  import { loadStaticData } from '$lib/utils/staticDataLoader';
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
      appState.loading = true;
  const loaded = await loadStaticData('data');

      // Populate stores from static data
      mapData.allItems = loaded.items;
      mapData.visibleItems = loaded.items;
      mapData.places = loaded.places; // Raw places data for choropleth

      filters.available.countries = loaded.countries;
      filters.available.newspapers = loaded.newspapers;
      if (loaded.dateMin && loaded.dateMax) {
        filters.available.dateRange = { min: loaded.dateMin, max: loaded.dateMax };
        timeData.range.start = loaded.dateMin;
        timeData.range.end = loaded.dateMax;
        timeData.currentDate = loaded.dateMin;
      }

      timeData.data = loaded.timeline;
      
      // Mark loading complete
      appState.loading = false;
      appState.dataLoaded = true;
    } catch (error) {
      console.error('Error initializing application:', error);
      
      appState.loading = false;
      appState.error = error instanceof Error ? error.message : 'Failed to initialize application';
    }
  });
  
  // (Removed mock data generation and filter initialization; now using static JSON loader)
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
      <header class="flex h-16 items-center justify-between px-4 border-b bg-background relative z-40">
        <div class="flex items-center gap-3">
          <Sidebar.Trigger />
          <h1 class="text-xl font-bold">Newspaper Article Locations</h1>
        </div>
      </header>
      
      <div class="flex flex-col flex-1 overflow-hidden relative z-0">
        <div class="flex-1 relative z-0">
          <Map />
        </div>
        
        <div class="border-t bg-muted/30 p-4 relative z-10">
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

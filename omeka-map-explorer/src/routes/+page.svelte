<script lang="ts">
  import { onMount } from 'svelte';
  import { appStateStore } from '$lib/stores/appStateStore';
  import { timeDataStore } from '$lib/stores/timeDataStore';
  import { filterStore } from '$lib/stores/filterStore';
  import { mapDataStore } from '$lib/stores/mapDataStore';
  import { initialize as initAnimationController } from '$lib/components/timeline/AnimationController';
  import { fetchItemSets, fetchItemsFromSet } from '$lib/api/omekaService';
  import { processItems, groupItemsByTime } from '$lib/utils/dataProcessor';
  import { get } from 'svelte/store';
  import type { ProcessedItem } from '$lib/types';
  import { browser } from '$app/environment';
  
  // Components
  import Map from '$lib/components/maps/Map.svelte';
  import Timeline from '$lib/components/timeline/Timeline.svelte';
  import FilterPanel from '$lib/components/filters/FilterPanel.svelte';
  
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
      appStateStore.update(state => ({
        ...state,
        loading: false,
        dataLoaded: true
      }));
    } catch (error) {
      console.error('Error initializing application:', error);
      
      appStateStore.update(state => ({
        ...state,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize application'
      }));
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
    timeDataStore.update(state => ({
      ...state,
      data: timelineData,
      range: {
        start: timelineData[0]?.date || new Date('1900-01-01'),
        end: timelineData[timelineData.length - 1]?.date || new Date('2023-12-31')
      },
      currentDate: timelineData[0]?.date || new Date('1900-01-01')
    }));
    
    mapDataStore.update(state => ({
      ...state,
      allItems: allItems,
      countriesData: countriesData,
      visibleItems: allItems
    }));
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
    
    const allItems = get(mapDataStore).allItems || [];
    
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
    
    filterStore.update(state => ({
      ...state,
      available: {
        ...state.available,
        countries,
        newspapers: Array.from(newspapers),
        dateRange
      }
    }));
  }
</script>

<svelte:head>
  <title>Omeka S Map Explorer</title>
</svelte:head>

<div class="app-container">
  {#if !browser}
    <div class="ssr-message">
      <p>Map visualization loading...</p>
    </div>
  {:else if $appStateStore.loading}
    <div class="loading-indicator">
      <p>Loading data...</p>
    </div>
  {:else if $appStateStore.error}
    <div class="error-display">
      <h2>Error</h2>
      <p>{$appStateStore.error}</p>
    </div>
  {:else}
    <header>
      <h1>Newspaper Article Locations</h1>
      <div class="view-controls">
        <!-- View switching controls -->
      </div>
    </header>
    
    <main>
      <aside class="sidebar" class:collapsed={!$appStateStore.sidebarOpen}>
        <button class="sidebar-toggle" on:click={() => {
          appStateStore.update(s => ({ ...s, sidebarOpen: !s.sidebarOpen }))
        }}>
          {$appStateStore.sidebarOpen ? '◀' : '▶'}
        </button>
        
        {#if $appStateStore.sidebarOpen}
          <FilterPanel />
          
          {#if $appStateStore.selectedItem}
            <div class="article-details">
              <h3>{$appStateStore.selectedItem.title}</h3>
              <p>Date: {$appStateStore.selectedItem.publishDate?.toLocaleDateString()}</p>
              <p>Country: {$appStateStore.selectedItem.country}</p>
              <p>Source: {$appStateStore.selectedItem.newspaperSource}</p>
            </div>
          {/if}
        {/if}
      </aside>
      
      <div class="content">
        <Map />
        
        <div class="timeline-wrapper">
          <Timeline 
            data={$timeDataStore.data}
            height="120px"
          />
        </div>
      </div>
    </main>
  {/if}
</div>

<style>
  .app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
  }
  
  header {
    padding: 10px 20px;
    background-color: #4a86e8;
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  
  header h1 {
    margin: 0;
    font-size: 1.5rem;
  }
  
  main {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;
  }
  
  .sidebar {
    width: 300px;
    background-color: #f5f5f5;
    overflow-y: auto;
    transition: width 0.3s ease;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 15px;
    padding: 15px;
  }
  
  .sidebar.collapsed {
    width: 30px;
    padding: 0;
  }
  
  .sidebar-toggle {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 10;
    background: white;
    border: 1px solid #ddd;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  
  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .timeline-wrapper {
    padding: 10px;
    background-color: #f5f5f5;
    border-top: 1px solid #ddd;
  }
  
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
  
  .article-details {
    background-color: white;
    border-radius: 4px;
    padding: 15px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  
  .article-details h3 {
    margin-top: 0;
    font-size: 1.1rem;
  }
  
  @media (max-width: 768px) {
    main {
      flex-direction: column;
    }
    
    .sidebar {
      width: 100%;
      max-height: 50vh;
    }
    
    .sidebar.collapsed {
      max-height: 30px;
    }
  }
</style>

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { mapDataStore } from '$lib/stores/mapDataStore';
  import { timeDataStore } from '$lib/stores/timeDataStore';
  import { filterStore } from '$lib/stores/filterStore';
  import { loadGeoJson } from '$lib/api/geoJsonService';
  import { browser } from '$app/environment';
  
  // Import type only for TypeScript - fixed type imports
  import type { Map as LeafletMap, LayerGroup } from 'leaflet';
  
  // Props
  export let height = '600px';
  
  // Local state
  let mapElement: HTMLDivElement;
  let map: LeafletMap | null = null;
  let layers: Record<string, any> = {}; // Using any for mixed layer types
  let L: any; // Will hold the Leaflet library when loaded
  
  // Initialize map on mount
  onMount(async () => {
    if (!browser) return undefined;
    
    // Dynamically import Leaflet only on the client side
    L = await import('leaflet');
    await import('leaflet/dist/leaflet.css');
    
    // Initialize the map
    map = L.map(mapElement).setView($mapDataStore.center, $mapDataStore.zoom);
    
    // Add base tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Load initial data
    await loadMapData();
    
    // Setup event handlers
    map.on('moveend', handleMapMove);
    
    return () => {
      if (map) {
        map.remove();
      }
    };
  });
  
  // Load map data based on current state
  async function loadMapData() {
    if (!map || !L) return;
    
    // Clear existing layers
    Object.values(layers).forEach(layer => {
      if (map) map.removeLayer(layer);
    });
    layers = {};
    
    // Load GeoJSON data for selected country
    if ($mapDataStore.selectedCountry) {
      try {
        const geoJson = await loadGeoJson($mapDataStore.selectedCountry, 'regions');
        
        // Cache the GeoJSON data
        mapDataStore.update(state => ({
          ...state,
          geoData: {
            ...state.geoData,
            [$mapDataStore.selectedCountry as string]: geoJson
          }
        }));
        
        // Add GeoJSON layer
        const geoJsonLayer = L.geoJSON(geoJson, {
          style: () => ({
            color: '#3388ff',
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.1
          }),
          onEachFeature: (feature: any, layer: any) => {
            // Bind popup
            if (feature.properties && feature.properties.name) {
              layer.bindPopup(feature.properties.name);
            }
            
            // Add event handlers
            layer.on({
              mouseover: (e: any) => highlightFeature(e),
              mouseout: (e: any) => resetHighlight(e),
              click: (e: any) => selectRegion(e)
            });
          }
        }).addTo(map);
        
        layers['geoJson'] = geoJsonLayer;
      } catch (error) {
        console.error(`Error loading GeoJSON for ${$mapDataStore.selectedCountry}:`, error);
      }
    }
    
    // Add markers for visible items
    if ($mapDataStore.visibleItems.length > 0) {
      const markers = L.layerGroup();
      
      $mapDataStore.visibleItems.forEach(item => {
        if (item.coordinates && item.coordinates.length > 0) {
          const [lat, lng] = item.coordinates[0];
          const marker = L.marker([lat, lng])
            .bindPopup(`<strong>${item.title}</strong><br>${item.publishDate?.toLocaleDateString() || 'Unknown date'}`);
          
          marker.on('click', () => selectItem(item));
          
          markers.addLayer(marker);
        }
      });
      
      markers.addTo(map);
      layers['markers'] = markers;
    }
  }
  
  // Handle map movement
  function handleMapMove() {
    if (!map) return;
    
    const center = map.getCenter();
    const zoom = map.getZoom();
    
    mapDataStore.update(state => ({
      ...state,
      center: [center.lat, center.lng] as [number, number],
      zoom
    }));
  }
  
  // Highlight a region on hover
  function highlightFeature(e: any) {
    const layer = e.target;
    
    layer.setStyle({
      weight: 3,
      color: '#666',
      fillOpacity: 0.3
    });
    
    if (L && L.Browser && !L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
      layer.bringToFront();
    }
  }
  
  // Reset highlight on mouseout
  function resetHighlight(e: any) {
    const layer = e.target;
    
    layer.setStyle({
      weight: 2,
      color: '#3388ff',
      fillOpacity: 0.1
    });
  }
  
  // Select a region
  function selectRegion(e: any) {
    const layer = e.target;
    const properties = layer.feature.properties;
    
    if (properties && properties.name) {
      mapDataStore.update(state => ({
        ...state,
        selectedRegion: properties.name
      }));
    }
  }
  
  // Select an item
  function selectItem(item: any) {
    import('$lib/stores/appStateStore').then(({ appStateStore }) => {
      appStateStore.update(state => ({
        ...state,
        selectedItem: item
      }));
    });
  }
  
  // Update map when stores change
  $: if (browser && map && $timeDataStore.currentDate) {
    updateMapForDate($timeDataStore.currentDate);
  }
  
  $: if (browser && map && $filterStore.selected) {
    updateMapForFilters($filterStore.selected);
  }
  
  $: if (browser && map && $mapDataStore.visibleItems) {
    loadMapData();
  }
  
  // Update map for specific date
  function updateMapForDate(date: Date) {
    // Implementation would update displayed data
    // This is called when the current date changes
    console.log('Updating map for date:', date);
  }
  
  // Update map for applied filters
  function updateMapForFilters(filters: any) {
    // Implementation would update displayed data
    // This is called when filters change
    console.log('Updating map for filters:', filters);
  }
</script>

<div class="map-container" bind:this={mapElement} style="height: {height};" data-testid="map-container"></div>

<style>
  .map-container {
    width: 100%;
    background-color: #f5f5f5;
    border-radius: 4px;
    overflow: hidden;
  }
  
  :global(.leaflet-container) {
    font-family: inherit;
  }
</style> 
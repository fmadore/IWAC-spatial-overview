<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { mapData } from '$lib/state/mapData.svelte';
  import { timeData } from '$lib/state/timeData.svelte';
  import { filters } from '$lib/state/filters.svelte';
  import { loadGeoJson } from '$lib/api/geoJsonService';
  import { browser } from '$app/environment';
  
  // Using any types here to avoid TypeScript errors with Leaflet
  let mapElement: HTMLDivElement;
  let map: any = null;
  let layers: Record<string, any> = {};
  let L: any; // Will hold the Leaflet library when loaded
  
  // Props
  let { height = '600px' } = $props();
  
  // Initialize map on mount
  onMount(() => {
    if (!browser) return undefined;
    
    const initMap = async () => {
      // Dynamically import Leaflet only on the client side
      L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      
      // Initialize the map
  map = L.map(mapElement).setView(mapData.center, mapData.zoom);
      
      // Add base tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);
      
      // Load initial data
      await loadMapData();
      
      // Setup event handlers
      map.on('moveend', handleMapMove);
    };
    
    initMap();
    
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
  if (mapData.selectedCountry) {
      try {
    const geoJson = await loadGeoJson(mapData.selectedCountry, 'regions');
        
        // Cache the GeoJSON data
    mapData.geoData[mapData.selectedCountry as string] = geoJson;
        
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
  console.error(`Error loading GeoJSON for ${mapData.selectedCountry}:`, error);
      }
    }
    
    // Aggregate items by coordinate and add circle markers sized by count (much fewer markers)
    if (mapData.visibleItems.length > 0) {
      const groups = new Map<string, { lat: number; lng: number; count: number; sample: any }>();
      for (const item of mapData.visibleItems) {
        if (!item.coordinates || item.coordinates.length === 0) continue;
        const [lat, lng] = item.coordinates[0];
        if (lat == null || lng == null) continue;
        const key = `${lat.toFixed(4)},${lng.toFixed(4)}`; // merge nearby points
        const existing = groups.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          groups.set(key, { lat, lng, count: 1, sample: item });
        }
      }

      const maxCount = Array.from(groups.values()).reduce((m, g) => Math.max(m, g.count), 1);
      const canvas = L.canvas({ padding: 0.5 });
      const layerGroup = L.layerGroup();

      for (const g of groups.values()) {
        // Radius: base + scaled by sqrt(count) to reduce disparity
        const radius = 4 + 6 * Math.sqrt(g.count / maxCount);
        const circle = L.circleMarker([g.lat, g.lng], {
          radius,
          color: '#1f78b4',
          weight: 1,
          opacity: 0.9,
          fillOpacity: 0.5,
          fillColor: '#1f78b4',
          renderer: canvas
        });
        circle.bindPopup(`<div style="min-width:160px">
          <div><strong>Occurrences:</strong> ${g.count}</div>
          <div><strong>Sample:</strong> ${(g.sample?.title ?? 'Untitled')}</div>
        </div>`);
        circle.addTo(layerGroup);
      }

      layerGroup.addTo(map);
      layers['markers'] = layerGroup;
    }
  }
  
  // Handle map movement
  function handleMapMove() {
    if (!map) return;
    
    const center = map.getCenter();
    const zoom = map.getZoom();
    
  mapData.center = [center.lat, center.lng];
  mapData.zoom = zoom;
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
  mapData.selectedRegion = properties.name;
    }
  }
  
  // Select an item
  function selectItem(item: any) {
    import('$lib/state/appState.svelte').then(({ appState }) => {
      appState.selectedItem = item;
    });
  }
  
  // Update map when stores change
  $effect(() => {
    if (browser && map && timeData.currentDate) {
      updateMapForDate(timeData.currentDate);
    }
  });

  $effect(() => {
    if (browser && map && filters.selected) {
      updateMapForFilters(filters.selected);
    }
  });

  $effect(() => {
    if (browser && map && mapData.visibleItems) {
      loadMapData();
    }
  });
  
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
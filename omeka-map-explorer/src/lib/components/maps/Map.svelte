<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { mapData } from '$lib/state/mapData.svelte';
  import { timeData } from '$lib/state/timeData.svelte';
  import { filters } from '$lib/state/filters.svelte';
  import { loadGeoJson, loadWorldCountries, countItemsByCountryHybrid } from '$lib/api/geoJsonService';
  import { browser } from '$app/environment';
  import ChoroplethLayer from './ChoroplethLayer.svelte';
  
  // Using any types here to avoid TypeScript errors with Leaflet
  let mapElement: HTMLDivElement;
  let map: any = $state(null);
  let layers: Record<string, any> = {};
  let L: any; // Will hold the Leaflet library when loaded
  let worldGeo: any = $state(null); // world countries geojson cache
  let choroplethData: Record<string, number> = $state({});
  
  // Props
  let { height = '600px' } = $props();
  
  // Initialize map on mount
  onMount(() => {
    if (!browser) return undefined;
    let disposed = false;

    const actuallyInit = async () => {
      if (disposed) return;
      if (!mapElement || !mapElement.isConnected) {
        // wait for next frame if container not yet connected
        requestAnimationFrame(actuallyInit);
        return;
      }
      if (map) return; // already initialized

      // Dynamically import Leaflet only on the client side
      L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');

      // Initialize the map
      map = L.map(mapElement).setView(mapData.center, mapData.zoom);

      // Add base tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      // Try to preload world countries for choropleth
      try {
        worldGeo = await loadWorldCountries();
      } catch (e) {
        console.warn('World countries GeoJSON not available:', e);
      }

      // Load initial data
      await loadMapData();

      // Setup event handlers
      map.on('moveend', handleMapMove);
    };

    requestAnimationFrame(actuallyInit);

    return () => {
      disposed = true;
      if (map) {
        map.remove();
        map = null;
      }
    };
  });
  
  // Load map data based on current state
  async function loadMapData() {
    if (!map || !L) return;
    
    // Clear existing layers
    Object.entries(layers).forEach(([key, layer]) => {
      if (layer && typeof (layer as any).$destroy === 'function') {
        // Svelte component wrapper (e.g., ChoroplethLayer)
        try { (layer as any).$destroy(); } catch {}
      } else if (layer && typeof (layer as any).remove === 'function') {
        // Leaflet layer
        try { (layer as any).remove(); } catch {}
      } else if (map && typeof (layer as any) === 'object') {
        try { map.removeLayer(layer); } catch {}
      }
      delete (layers as any)[key];
    });
    layers = {};
    
    // Load GeoJSON data for selected country (outline) when not in choropleth mode
  if (mapData.selectedCountry && mapData.viewMode !== 'choropleth') {
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
    
    // Choropleth is rendered by child component; skip adding Leaflet layers here
    if (mapData.viewMode === 'choropleth' && worldGeo) {
      // no-op
    } else if (mapData.visibleItems.length > 0) {
      // Aggregate items by coordinate and add circle markers sized by count (much fewer markers)
      const groups = new Map<string, { lat: number; lng: number; count: number; sample: any }>();
      for (const item of mapData.visibleItems) {
        if (!item.coordinates || item.coordinates.length === 0) continue;
        const [lat, lng] = item.coordinates[0]; // Each item now has exactly one coordinate
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
      const sel = filters.selected;
      // Derive visible items from all items using country filter only (others can be added later)
      const all = mapData.allItems || [];
      let next = all;
      if (sel.countries && sel.countries.length) {
        next = next.filter((i) => sel.countries.includes(i.articleCountry || i.country));
      }
      mapData.visibleItems = next;
      updateMapForFilters(filters.selected);
    }
  });

  $effect(() => {
    if (browser && map && mapData.visibleItems) {
      loadMapData();
    }
  });
  // Refresh when view mode changes
  $effect(() => {
    if (browser && map) {
      mapData.viewMode;
      loadMapData();
    }
  });

  // Compute choropleth data reactively for the child component
  $effect(() => {
    if (!browser || !worldGeo) return;
    if (mapData.viewMode !== 'choropleth') {
      choroplethData = {};
      return;
    }
    
    // Use the same ProcessedItems data as bubbles view for consistency
    choroplethData = countItemsByCountryHybrid(mapData.visibleItems, worldGeo);
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
{#if browser && map && worldGeo && mapData.viewMode === 'choropleth'}
  <ChoroplethLayer {map} geoJson={worldGeo} data={choroplethData} scaleMode="log" />
{/if}

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
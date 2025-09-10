<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { mount } from 'svelte';
  import { mapData } from '$lib/state/mapData.svelte';
  import { timeData } from '$lib/state/timeData.svelte';
  import { filters } from '$lib/state/filters.svelte';
  import { getVisibleData } from '$lib/state/derived.svelte';
  import { loadGeoJson, loadWorldCountries, countItemsByCountryHybrid } from '$lib/api/geoJsonService';
  import {
    loadChoroplethCache,
    loadCoordinateCache,
    coordinateClustersToProcessedItems,
    isWorldMapCacheAvailable,
    loadArticleCountryCoordinateClusters
  } from '$lib/api/worldMapCacheService';
  import { loadMultipleArticleCountryChoroplethData } from '$lib/api/articleCountryChoroplethService';
  import { browser } from '$app/environment';
  import ChoroplethLayer from './ChoroplethLayer.svelte';
  import MapPopup from '$lib/components/maps/MapPopup.svelte';
  import { appState } from '$lib/state/appState.svelte';
  import { urlManager } from '$lib/utils/urlManager.svelte';

  // Using any types here to avoid TypeScript errors with Leaflet
  let mapElement: HTMLDivElement;
  let map: any = $state(null);
  let layers: Record<string, any> = {};
  let L: any; // Will hold the Leaflet library when loaded
  let worldGeo: any = $state(null); // world countries geojson cache
  let choroplethData: Record<string, number> = $state({});
  let currentTileLayer: any = null; // Track current tile layer for switching
  
  // Cache optimization tracking
  let cacheAvailable = $state(false);
  let usingCachedData = $state(false);

  // Modern tile layer options
  const tileLayerOptions = {
    cartodb: {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      attribution: '© OpenStreetMap contributors © CARTO',
      subdomains: 'abcd',
      name: 'CartoDB Positron'
    },
    cartodbDark: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '© OpenStreetMap contributors © CARTO',
      subdomains: 'abcd',
      name: 'CartoDB Dark'
    },
    osm: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap contributors',
      name: 'OpenStreetMap'
    }
  } as const;

  // Create optimized derived state for visible data
  // Skip expensive getVisibleData() when we can use cache
  const visibleData = $derived.by(() => {
    // If ANY entity is selected we always need real filtered items (never cache shortcut)
    if (appState.selectedEntity) {
      return getVisibleData();
    }
    // Complex textual filters also require full computation
    const hasComplexFilters = 
      filters.selected.keywords.length > 0 || 
      filters.selected.newspapers.length > 0 || 
      filters.selected.countries.length > 0; // country filter MUST recompute article-based filtering
    if (hasComplexFilters) {
      return getVisibleData();
    }
    // Otherwise we can skip and rely on coordinate cache (fast path)
    return [];
  });

  // Loading state for better UX
  let mapLoading = $state(true);
  let dataLoading = $state(true);
  // Incrementing token to cancel stale async loadMapData runs
  let loadRunId = 0;

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
      dashArray: '',
      fillOpacity: 0.4
    });
    layer.bringToFront();
  }

  // Reset highlighting
  function resetHighlight(e: any) {
    const layer = e.target;
    layer.setStyle({
      weight: 2,
      color: '#3388ff',
      dashArray: '',
      fillOpacity: 0.1
    });
  }

  // Select a region
  function selectRegion(e: any) {
    const layer = e.target;
    const feature = layer.feature;
    if (feature && feature.properties) {
      console.log('Selected region:', feature.properties.name);
    }
  }

  function updateMapForDate(_date: Date) {}
  function updateMapForFilters(_filters: any) {}

  // Props
  let { height = '600px' } = $props();

  // Initialize map on mount
  onMount(() => {
    if (!browser) return undefined;
    let disposed = false;
    const actuallyInit = async () => {
      if (disposed) return;
      if (!mapElement || !mapElement.isConnected) {
        requestAnimationFrame(actuallyInit);
        return;
      }
      if (map) return;
      L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      map = L.map(mapElement, {
        maxBounds: [
          [-85, -180],
          [85, 180]
        ],
        maxBoundsViscosity: 1.0,
        worldCopyJump: false
      }).setView(mapData.center, mapData.zoom);
      const tileOptions = tileLayerOptions.cartodb;
      const layerConfig: any = {
        attribution: tileOptions.attribution,
        maxZoom: 20,
        noWrap: true
      };
      if ('subdomains' in tileOptions) {
        layerConfig.subdomains = tileOptions.subdomains;
      }
      currentTileLayer = L.tileLayer(tileOptions.url, layerConfig).addTo(map);
      const baseMaps: Record<string, any> = {};
      Object.entries(tileLayerOptions).forEach(([key, options]) => {
        if (key === 'cartodb') {
          baseMaps[options.name] = currentTileLayer;
        } else {
          const layerOptions: any = {
            attribution: options.attribution,
            maxZoom: 20,
            noWrap: true
          };
            if ('subdomains' in options) {
              layerOptions.subdomains = options.subdomains;
            }
          baseMaps[options.name] = L.tileLayer(options.url, layerOptions);
        }
      });
      L.control.layers(baseMaps).addTo(map);
      map.on('moveend', handleMapMove);
      mapLoading = false;
      setTimeout(async () => {
        if (disposed) return;
        dataLoading = true;
        try {
          cacheAvailable = await isWorldMapCacheAvailable();
          console.log('🔍 CACHE DEBUG: Cache availability check result:', cacheAvailable);
          if (cacheAvailable && !appState.selectedEntity) {
            console.log('✅ World map cache is available - using optimized data loading');
          } else {
            console.log('⚠️ Cache not used:', { cacheAvailable, hasSelectedEntity: !!appState.selectedEntity });
          }
        } catch (e) {
          console.error('❌ CACHE DEBUG: Failed to check cache availability:', e);
          cacheAvailable = false;
        }
        try {
          worldGeo = await loadWorldCountries();
        } catch (e) {
          console.warn('World countries GeoJSON not available:', e);
        }
        await loadMapData();
        dataLoading = false;
      }, 100);
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

  async function loadMapData() {
    if (!map || !L) return;
    dataLoading = true;
    const runId = ++loadRunId;
    Object.entries(layers).forEach(([key, layer]) => {
      if (layer && typeof (layer as any).$destroy === 'function') {
        try { (layer as any).$destroy(); } catch {}
      } else if (layer && typeof (layer as any).remove === 'function') {
        try { (layer as any).remove(); } catch {}
      } else if (layer && typeof (layer as any).eachLayer === 'function') {
        try {
          (layer as any).eachLayer((childLayer: any) => {
            if (childLayer._popupComponent && typeof childLayer._popupComponent.unmount === 'function') {
              childLayer._popupComponent.unmount();
            }
          });
          (layer as any).remove();
        } catch {}
      } else if (map && typeof (layer as any) === 'object') {
        try { map.removeLayer(layer); } catch {}
      }
      delete (layers as any)[key];
    });
    layers = {};

    if (mapData.selectedCountry && mapData.viewMode !== 'choropleth') {
      try {
        const geoJson = await loadGeoJson(mapData.selectedCountry, 'regions');
        mapData.geoData[mapData.selectedCountry as string] = geoJson;
        const geoJsonLayer = L.geoJSON(geoJson, {
          style: () => ({
            color: '#3388ff',
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.1
          }),
          onEachFeature: (feature: any, layer: any) => {
            if (feature.properties && feature.properties.name) {
              layer.bindPopup(feature.properties.name);
            }
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

    if (mapData.viewMode === 'choropleth') {
      dataLoading = false;
      return;
    }

    if (mapData.viewMode === 'bubbles' && (visibleData.length > 0 || cacheAvailable)) {
      let coordinateGroups: Map<string, { lat: number; lng: number; count: number; sample: any; items: any[]; name?: string }> | null = null;
      
      // Since we now have single country selection (or all), cache logic is much simpler
      const singleCountrySelected = filters.selected.countries.length === 1;
      const noCountryFilter = filters.selected.countries.length === 0;
      const shouldUseCache = cacheAvailable && !appState.selectedEntity;
      
      console.log('🔍 CACHE DEBUG: Bubble map cache decision', {
        cacheAvailable,
        singleCountrySelected,
        noCountryFilter,
        shouldUseCache,
        selectedCountry: singleCountrySelected ? filters.selected.countries[0] : null
      });

      // Try cache for single country selection
      if (singleCountrySelected && shouldUseCache) {
        try {
          const selectedCountry = filters.selected.countries[0];
          console.log('🔍 CACHE DEBUG: Loading cache for single country:', selectedCountry);
          const clusters = await loadArticleCountryCoordinateClusters([selectedCountry]);
          if (clusters && clusters.length > 0) {
            console.log('✅ CACHE DEBUG: Successfully loaded cached data for', selectedCountry, 'clusters:', clusters.length);
            coordinateGroups = new Map();
            for (const cl of clusters) {
              if (!cl.coordinates) continue;
              const [lat, lng] = cl.coordinates;
              const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
              const existing = coordinateGroups.get(key);
              if (existing) {
                existing.count += cl.articleCount;
              } else {
                coordinateGroups.set(key, {
                  lat,
                    lng,
                    count: cl.articleCount,
                    sample: {
                      id: cl.id,
                      title: cl.label,
                      country: cl.country,
                      placeLabel: cl.label
                    },
                    items: [],
                    name: cl.label
                  });
                }
              }
              console.log('✅ CACHE DEBUG: Successfully using country-specific cache', { 
                selectedCountry, 
                clusters: coordinateGroups.size 
              });
            } else {
              console.log('⚠️ CACHE DEBUG: No cached data found for country:', selectedCountry);
            }
          } catch (e) {
            console.warn('⚠️ CACHE DEBUG: Country-specific cache failed, will fallback:', e);
          }
        }

        // Try cache for "all countries" view (global cache)
        else if (noCountryFilter && shouldUseCache) {
          try {
            console.log('🔍 CACHE DEBUG: Loading global cache for all countries');
            const cacheOptions: { dateRange?: { start: Date; end: Date }; year?: number } = {};
            if (filters.selected.dateRange) {
              cacheOptions.dateRange = filters.selected.dateRange;
            }
            const cachedClusters = await loadCoordinateCache(cacheOptions);
            if (cachedClusters && cachedClusters.length > 0) {
              console.log('✅ CACHE DEBUG: Successfully using global cache', {
                clusters: cachedClusters.length,
                dateRange: cacheOptions.dateRange ? 'yes' : 'no'
              });
              coordinateGroups = new Map();
              for (const cluster of cachedClusters) {
                const [lat, lng] = cluster.coordinates;
                const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
                coordinateGroups.set(key, {
                  lat,
                  lng,
                  count: cluster.articleCount,
                  sample: {
                    id: cluster.id,
                    title: cluster.label,
                    country: cluster.country,
                    placeLabel: cluster.label
                },
                items: [],
                name: cluster.label
              });
            }
            console.log(`Applied filters to cached clusters: ${coordinateGroups.size} remaining`);
          }
        } catch (e) {
          console.warn('Failed to load cached coordinates, falling back to real-time aggregation:', e);
        }
      }
      if (coordinateGroups === null && visibleData.length > 0) {
        if (appState.selectedEntity) {
          console.log('🔍 Using real-time coordinate aggregation for entity view:', appState.selectedEntity.type, appState.selectedEntity.name);
        } else {
          console.log('⚠️ Falling back to real-time coordinate aggregation');
        }
        coordinateGroups = new Map<string, { lat: number; lng: number; count: number; sample: any; items: any[]; name?: string }>();
        for (const item of visibleData) {
          if (!item.coordinates || item.coordinates.length === 0) continue;
          const [lat, lng] = item.coordinates[0];
          if (lat == null || lng == null) continue;
          const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
          const existing = coordinateGroups.get(key);
          if (existing) {
            existing.count += 1;
            existing.items.push(item);
            if (!existing.name && item.placeLabel) existing.name = item.placeLabel;
          } else {
            coordinateGroups.set(key, { lat, lng, count: 1, sample: item, items: [item], name: item.placeLabel });
          }
        }
        console.log('Map: Aggregated coordinates in real-time:', coordinateGroups.size, 'groups from', visibleData.length, 'items');
      }
      if (coordinateGroups !== null && coordinateGroups.size > 0) {
        if (mapData.viewMode !== 'bubbles' || runId !== loadRunId) {
          coordinateGroups.clear();
        } else {
          const maxCount = Array.from(coordinateGroups.values()).reduce((m, g) => Math.max(m, g.count), 1);
          const canvas = L.canvas({ padding: 0.5 });
          const layerGroup = L.layerGroup();
          for (const g of coordinateGroups.values()) {
            const radius = 6 + 8 * Math.sqrt(g.count / maxCount);
            const intensity = Math.sqrt(g.count / maxCount);
            const hue = 220 - (intensity * 60);
            const saturation = 70 + (intensity * 20);
            const lightness = 55 - (intensity * 10);
            const circle = L.circleMarker([g.lat, g.lng], {
              radius,
              color: `hsl(${hue}, ${saturation}%, ${lightness - 15}%)`,
              weight: 2,
              opacity: 0.9,
              fillOpacity: 0.7,
              fillColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
              renderer: canvas,
              className: 'modern-marker',
              interactive: true,
              pane: 'markerPane'
            });
            const popupDiv = document.createElement('div');
            const popup = mount(MapPopup, {
              target: popupDiv,
              props: { group: g }
            });
            circle.bindPopup(popupDiv, {
              maxWidth: 400,
              minWidth: 300,
              closeButton: true,
              className: 'map-popup-wrapper'
            });
            circle._popupComponent = popup;
            circle.addTo(layerGroup);
          }
          layerGroup.addTo(map);
          layers['markers'] = layerGroup;
        }
      }
    }
    dataLoading = false;
  }

  function selectItem(item: any) {
    import('$lib/state/appState.svelte').then(({ appState }) => {
      appState.selectedItem = item;
    });
  }

  $effect(() => {
    if (browser && map && timeData.currentDate) {
      updateMapForDate(timeData.currentDate);
    }
  });
  
  // Watch for specific filter changes to trigger map data reload
  $effect(() => {
    if (browser && map) {
      // Explicitly track all filter properties to ensure reactivity
      const _countries = filters.selected.countries;
      const _regions = filters.selected.regions;
      const _newspapers = filters.selected.newspapers;
      const _dateRange = filters.selected.dateRange;
      const _keywords = filters.selected.keywords;
      
      console.log('🔍 Map: Filter change detected', {
        countries: _countries.length,
        regions: _regions.length,
        newspapers: _newspapers.length,
        dateRange: _dateRange ? `${_dateRange.start.getFullYear()}-${_dateRange.end.getFullYear()}` : 'none',
        keywords: _keywords.length
      });
      
      loadMapData();
    }
  });
  
  $effect(() => {
    if (browser && map && visibleData) {
      loadMapData();
    }
  });
  $effect(() => {
    if (browser && map) {
      if (appState.selectedEntity && mapData.viewMode === 'choropleth') {
        mapData.viewMode = 'bubbles';
      }
      mapData.viewMode;
      loadMapData();
    }
  });
  $effect(() => {
    if (!browser || !map) return;
    if (mapData.viewMode === 'choropleth') {
      loadRunId++;
      const markerLayer = layers['markers'];
      if (markerLayer) {
        try {
          if (typeof markerLayer.eachLayer === 'function') {
            markerLayer.eachLayer((child: any) => {
              if (child._popupComponent && typeof child._popupComponent.unmount === 'function') {
                child._popupComponent.unmount();
              }
            });
          }
          if (typeof markerLayer.remove === 'function') markerLayer.remove();
        } catch {}
        delete (layers as any)['markers'];
      }
      try {
        map.eachLayer((lyr: any) => {
          if (lyr && lyr.options && lyr.options.pane === 'markerPane') {
            try { map.removeLayer(lyr); } catch {}
          }
        });
      } catch {}
      try {
        const el = map.getPanes()?.markerPane;
        if (el) {
          el.querySelectorAll('.modern-marker').forEach((n: Element) => n.remove());
        }
      } catch {}
    }
  });

  let choroplethUpdateTimeout: number | null = null;
  const CHOROPLETH_DEBOUNCE_MS = 100;
  $effect(() => {
    if (!browser || !worldGeo) return;
    if (mapData.viewMode !== 'choropleth') {
      choroplethData = {};
      return;
    }
    
    // Explicitly track all relevant filter changes for choropleth updates
    const _selectedCountries = filters.selected.countries;
    const _dateRange = filters.selected.dateRange;
    const _keywords = filters.selected.keywords;
    const _newspapers = filters.selected.newspapers;
    const _selectedEntity = appState.selectedEntity;
    
    console.log('🔍 Choropleth: Filter change detected', {
      countries: _selectedCountries.length,
      dateRange: _dateRange ? `${_dateRange.start.getFullYear()}-${_dateRange.end.getFullYear()}` : 'none',
      keywords: _keywords.length,
      newspapers: _newspapers.length,
      entity: _selectedEntity ? `${_selectedEntity.type}:${_selectedEntity.id}` : 'none'
    });
    
    if (choroplethUpdateTimeout) { clearTimeout(choroplethUpdateTimeout); }
    choroplethUpdateTimeout = setTimeout(async () => {
      console.log('🔍 Starting choropleth update for:', {
        viewMode: mapData.viewMode,
        selectedCountries: filters.selected.countries.length,
        cacheAvailable: cacheAvailable
      });
      
      let newData: Record<string, number> = {};
      usingCachedData = false;
      const singleCountrySelected = filters.selected.countries.length === 1;
      const noCountryFilter = filters.selected.countries.length === 0;
      
      console.log('🔍 Cache decision:', {
        singleCountrySelected,
        noCountryFilter,
        cacheAvailable,
        selectedCountry: singleCountrySelected ? filters.selected.countries[0] : null
      });
      
      // Try article-country choropleth cache when single country is selected
      // This shows WHERE articles FROM that country mention locations (same logic as bubble map)
      if (singleCountrySelected && cacheAvailable) {
        const selectedCountry = filters.selected.countries[0];
        console.log('🚀 Loading choropleth cache for:', selectedCountry);
        try {
          const cachedData = await loadMultipleArticleCountryChoroplethData([selectedCountry]);
          if (cachedData && Object.keys(cachedData).length > 0) {
            console.log('✅ Using cached article-country choropleth data for', selectedCountry);
            newData = cachedData;
            usingCachedData = true;
          } else {
            console.warn('❌ Cache returned empty data for', selectedCountry);
          }
        } catch (e) { 
          console.error('❌ Article-country cache failed for', selectedCountry, ':', e); 
        }
      }
      // Try global choropleth cache when no countries selected (all countries view)
      else if (noCountryFilter && cacheAvailable && !appState.selectedEntity) {
        console.log('🔍 Using global cache (all countries)');
        try {
          const cacheOptions: { year?: number; entityType?: string; dateRange?: { start: Date; end: Date } } = {};
          if ((appState.selectedEntity as any)?.type) {
            const entityTypeMap: Record<string, string> = {
              'Personnes': 'persons',
              'Organisations': 'organizations',
              '\u00c9v\u00e9nements': 'events',
              'Sujets': 'subjects'
            };
            cacheOptions.entityType = entityTypeMap[(appState.selectedEntity as any).type];
          }
          if (filters.selected.dateRange) { cacheOptions.dateRange = filters.selected.dateRange; }
          const cachedData = await loadChoroplethCache(cacheOptions);
          if (cachedData && Object.keys(cachedData).length > 0) {
            console.log('✅ Using cached global choropleth data (all countries)');
            newData = cachedData;
            usingCachedData = true;
          }
        } catch (e) { console.warn('Failed to load global choropleth cache:', e); }
      }
      
      // Fallback to real-time calculation if cache unavailable
      if (!usingCachedData || Object.keys(newData).length === 0) {
        console.log('⚠️ Using real-time calculation - cache unavailable');
        
        // Use visibleData which already handles country filtering correctly
        // This will show articles FROM the selected country, same as bubble map
        newData = countItemsByCountryHybrid(visibleData, worldGeo);
        console.log('Map: Choropleth data (filtered) countries:', Object.keys(newData).length);
      }
      
      console.log('🔍 Final choropleth result:', {
        usingCachedData,
        dataKeys: Object.keys(newData).length
      });
      
      choroplethData = newData;
      choroplethUpdateTimeout = null;
    }, CHOROPLETH_DEBOUNCE_MS);
  });
</script>

<div class="map-wrapper relative">
  <div class="map-container relative z-0" bind:this={mapElement} style="height: {height};" data-testid="map-container"></div>
  {#if mapLoading}
    <div class="absolute inset-0 bg-gray-50 flex items-center justify-center z-10">
      <div class="flex flex-col items-center gap-3">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p class="text-sm text-gray-600">Loading map...</p>
      </div>
    </div>
  {/if}
  {#if dataLoading && !mapLoading}
    <div class="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg z-20">
      <div class="flex items-center gap-2">
        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <p class="text-xs text-gray-700">Loading data...</p>
      </div>
    </div>
  {/if}
</div>

{#if browser && map && worldGeo && mapData.viewMode === 'choropleth'}
  <ChoroplethLayer
    {map}
    geoJson={worldGeo}
    data={choroplethData}
    scaleMode="log"
    on:selectRegion={(e) => {
      // Clicking choropleth countries should not update URL or filters
      // Only the filter panel should control filtering
      console.log('Choropleth country clicked:', e.detail?.region);
    }}
  />
{/if}

<style>
  .map-wrapper { width: 100%; }
  .map-container { width: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.12); border: 1px solid rgba(255,255,255,0.1); }
  :global(.leaflet-container) { font-family: inherit; border-radius: 12px; }
  :global(.leaflet-control-layers) { border-radius: 8px !important; box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important; border: 1px solid rgba(255,255,255,0.2) !important; }
  :global(.leaflet-control-zoom) { border: none !important; border-radius: 8px !important; box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important; }
  :global(.leaflet-control-zoom a) { border-radius: 6px !important; border: 1px solid rgba(255,255,255,0.2) !important; background: rgba(255,255,255,0.9) !important; backdrop-filter: blur(8px) !important; color: #374151 !important; font-weight: 600 !important; transition: all 0.2s ease !important; }
  :global(.leaflet-control-zoom a:hover) { background: rgba(255,255,255,1) !important; transform: scale(1.05) !important; }
  :global(.map-popup-wrapper .leaflet-popup-content-wrapper) { padding: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(8px); }
  :global(.map-popup-wrapper .leaflet-popup-content) { margin:0; padding:0; width:auto !important; }
  :global(.map-popup-wrapper .leaflet-popup-tip) { background:white; border:1px solid rgba(255,255,255,0.2); box-shadow:0 2px 8px rgba(0,0,0,0.1); }
  :global(.modern-marker.leaflet-interactive) { filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1)); transition: all 0.2s ease; }
  :global(.modern-marker.leaflet-interactive:hover) { filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2)); transform: scale(1.1); z-index: 1000 !important; }
  :global(.leaflet-marker-pane) { z-index: 600 !important; }
  :global(.leaflet-popup-pane) { z-index: 700 !important; }
  :global(.leaflet-tooltip-pane) { z-index: 650 !important; }
</style>
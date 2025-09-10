<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import MapPopup from '$lib/components/maps/MapPopup.svelte';
  import { mount } from 'svelte';
  import type { ProcessedItem } from '$lib/types';
  import { mapData } from '$lib/state/mapData.svelte';
  import { 
    createBubbleColorScale,
    createD3BubbleStyle, 
    ENTITY_MAP_BUBBLE_CONFIG 
  } from '$lib/utils/bubbleScaling';

  /** Lightweight bubble-only map for entity views.
   *  Props: items (already filtered ProcessedItem[]), height.
   *  - No choropleth, geojson overlays, or cache logic.
   *  - Groups points by ~11m grid (4 decimal places) to reduce marker count.
   */
  interface Props { items: ProcessedItem[]; height?: string }
  let { items, height = '500px' }: Props = $props();

  let mapEl: HTMLDivElement;
  let map: any = $state(null);
  let L: any;
  let markerLayer: any = null;
  let currentRun = 0; // simple invalidation token

  function handleMove() {
    if (!map) return;
    const c = map.getCenter();
    mapData.center = [c.lat, c.lng];
    mapData.zoom = map.getZoom();
  }

  async function init() {
    if (!browser || map) return;
    L = await import('leaflet');
    await import('leaflet/dist/leaflet.css');

    map = L.map(mapEl, {
      maxBounds: [[-85, -180],[85,180]],
      maxBoundsViscosity: 1.0,
      worldCopyJump: false
    }).setView(mapData.center, mapData.zoom);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      subdomains: 'abcd',
      maxZoom: 20,
      noWrap: true
    }).addTo(map);

    map.on('moveend', handleMove);
    renderMarkers();
  }

  function clearMarkers() {
    if (markerLayer && map) {
      try {
        if (typeof markerLayer.eachLayer === 'function') {
          markerLayer.eachLayer((child: any) => {
            if (child._popupComponent && typeof child._popupComponent.unmount === 'function') {
              child._popupComponent.unmount();
            }
          });
        }
        markerLayer.remove();
      } catch {}
    }
    markerLayer = null;
  }

  function groupItems(src: ProcessedItem[]) {
    const groups = new Map<string, {lat:number; lng:number; count:number; sample:ProcessedItem; items:ProcessedItem[]; name?:string }>();
    for (const item of src) {
      if (!item.coordinates || item.coordinates.length === 0) continue;
      const [lat,lng] = item.coordinates[0];
      if (lat == null || lng == null) continue;
      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
        existing.items.push(item);
        if (!existing.name && item.placeLabel) existing.name = item.placeLabel;
      } else {
        groups.set(key, { lat, lng, count:1, sample:item, items:[item], name:item.placeLabel });
      }
    }
    return groups;
  }

  function calculateBounds(groups: Map<string, {lat:number; lng:number; count:number; sample:ProcessedItem; items:ProcessedItem[]; name?:string }>): L.LatLngBounds | null {
    if (!L || groups.size === 0) return null;
    
    const coordinates = Array.from(groups.values()).map(g => [g.lat, g.lng] as [number, number]);
    
    if (coordinates.length === 0) return null;
    if (coordinates.length === 1) {
      // Single point: create a small bounds around it
      const [lat, lng] = coordinates[0];
      const offset = 0.01; // ~1km offset
      return L.latLngBounds(
        [lat - offset, lng - offset],
        [lat + offset, lng + offset]
      );
    }
    
    // Multiple points: calculate actual bounds
    let minLat = coordinates[0][0], maxLat = coordinates[0][0];
    let minLng = coordinates[0][1], maxLng = coordinates[0][1];
    
    for (const [lat, lng] of coordinates) {
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    }
    
    return L.latLngBounds([minLat, minLng], [maxLat, maxLng]);
  }

  function renderMarkers() {
    if (!browser || !map) return;
    const runId = ++currentRun;
    clearMarkers();
    const groups = groupItems(items);
    if (groups.size === 0) return;
    const Llocal = L; // local ref
    const maxCount = Array.from(groups.values()).reduce((m,g)=>Math.max(m,g.count),1);
    
    // Create D3 color scale for better visual consistency with world map
    const colorScale = createBubbleColorScale(maxCount);
    
    const canvas = Llocal.canvas({ padding: 0.5 });
    const layerGroup = Llocal.layerGroup();
    for (const g of groups.values()) {
      if (runId !== currentRun) break; // aborted
      
      // Use reusable D3-based bubble styling utility for better contrast
      const bubbleStyle = createD3BubbleStyle(g.count, maxCount, colorScale, ENTITY_MAP_BUBBLE_CONFIG);
      
      const circle = Llocal.circleMarker([g.lat, g.lng], {
        radius: bubbleStyle.radius,
        color: bubbleStyle.borderColor,
        weight: bubbleStyle.weight,
        opacity: bubbleStyle.opacity,
        fillOpacity: bubbleStyle.fillOpacity,
        fillColor: bubbleStyle.fillColor,
        renderer: canvas,
        className: 'modern-marker',
        interactive: true,
        pane: 'markerPane'
      });
      const popupDiv = document.createElement('div');
      const popup = mount(MapPopup, { target: popupDiv, props: { group: g } });
      circle.bindPopup(popupDiv, { maxWidth: 400, minWidth: 300, closeButton: true, className: 'map-popup-wrapper' });
      circle._popupComponent = popup;
      circle.addTo(layerGroup);
    }
    if (runId === currentRun) {
      layerGroup.addTo(map);
      markerLayer = layerGroup;
      
      // Auto-center map to fit all markers with some padding
      const bounds = calculateBounds(groups);
      if (bounds) {
        try {
          map.fitBounds(bounds, { 
            padding: [20, 20],
            maxZoom: 10 // Prevent over-zooming on single points
          });
        } catch (error) {
          console.warn('Failed to fit bounds:', error);
        }
      }
    } else {
      try { layerGroup.remove(); } catch {}
    }
  }

  // Reactive: update markers when items change
  $effect(() => {
    items; // dependency
    if (map) renderMarkers();
  });

  onMount(() => {
    if (!browser) return;
    init();
    return () => {
      clearMarkers();
      if (map) {
        try { map.remove(); } catch {}
        map = null;
      }
    };
  });
</script>

<div class="entity-map-wrapper relative">
  <div class="entity-map-container" bind:this={mapEl} style="height:{height};"></div>
</div>

<style>
  .entity-map-container { width:100%; border-radius:12px; overflow:hidden; background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); }
  :global(.leaflet-container) { font-family:inherit; border-radius:12px; }
  :global(.modern-marker.leaflet-interactive) { filter:drop-shadow(0 2px 4px rgba(0,0,0,0.1)); transition:all .2s ease; }
  :global(.modern-marker.leaflet-interactive:hover) { filter:drop-shadow(0 4px 8px rgba(0,0,0,0.2)); transform:scale(1.1); z-index:1000 !important; }
  :global(.leaflet-popup-pane) { z-index:700 !important; }
  :global(.leaflet-marker-pane) { z-index:600 !important; }
  :global(.map-popup-wrapper .leaflet-popup-content-wrapper) { padding:0; border-radius:12px; overflow:hidden; box-shadow:0 8px 32px rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); backdrop-filter:blur(8px); }
  :global(.map-popup-wrapper .leaflet-popup-content) { margin:0; padding:0; width:auto !important; }
  :global(.map-popup-wrapper .leaflet-popup-tip) { background:white; border:1px solid rgba(255,255,255,0.2); box-shadow:0 2px 8px rgba(0,0,0,0.1); }
</style>

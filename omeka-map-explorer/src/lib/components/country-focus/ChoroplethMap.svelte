<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { scaleQuantize } from 'd3-scale';
  import { schemeBlues } from 'd3-scale-chromatic';

  // Props
  let {
    geoJson,
    data = {},
    height = 520
  } = $props<{
    geoJson: any;
    data?: Record<string, number>;
    height?: number;
  }>();

  // Local state
  let mapEl: HTMLDivElement;
  let map: any = null;
  let layer: any = null;
  let legend: any = null;
  let L: any;

  // Color scale
  const colorScale = $derived.by(() => {
    const values = Object.values(data).filter((v): v is number => typeof v === 'number' && v > 0);
    if (values.length === 0) return (v: number) => '#f0f0f0';
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    if (min === max) return (v: number) => v > 0 ? schemeBlues[4] : '#f0f0f0';
    
    const scale = scaleQuantize()
      .domain([min, max])
      .range(schemeBlues[7]);
    
    return (v: number) => v > 0 ? scale(v) : '#f0f0f0';
  });

  function getColor(value: number): string {
    return colorScale(value);
  }

  function style(feature: any) {
    const name = feature.properties?.name || '';
    const value = data[name] || 0;
    
    return {
      fillColor: getColor(value),
      weight: 1,
      opacity: 0.8,
      color: 'white',
      fillOpacity: 0.8
    };
  }

  function onEachFeature(feature: any, layer: any) {
    const name = feature.properties?.name || 'Unknown';
    const count = data[name] || 0;
    
    // Tooltip
    layer.bindTooltip(`<strong>${name}</strong><br/>${count} articles`, {
      sticky: true
    });
    
    // Popup
    layer.bindPopup(`
      <div style="text-align: center;">
        <h4 style="margin: 0 0 8px 0;">${name}</h4>
        <p style="margin: 0;"><strong>${count}</strong> articles</p>
      </div>
    `);
    
    // Hover effects
    layer.on({
      mouseover: (e: any) => {
        const layer = e.target;
        layer.setStyle({
          weight: 2,
          color: '#333',
          fillOpacity: 0.9
        });
      },
      mouseout: (e: any) => {
        if (layer) {
          layer.resetStyle(e.target);
        }
      }
    });
  }

  function createLegend() {
    if (!L || !map) return;
    
    const values = Object.values(data).filter((v): v is number => typeof v === 'number' && v > 0).sort((a, b) => a - b);
    if (values.length === 0) return;
    
    legend = new L.Control({ position: 'bottomright' });
    
    legend.onAdd = function() {
      const div = L.DomUtil.create('div', 'info legend');
      div.style.background = 'rgba(255,255,255,0.9)';
      div.style.padding = '6px 8px';
      div.style.borderRadius = '4px';
      div.style.border = '1px solid #ccc';
      
      const min = Math.min(...values);
      const max = Math.max(...values);
      const steps = 5;
      
      let labels = ['<strong>Articles</strong>'];
      
      for (let i = 0; i < steps; i++) {
        const from = Math.round(min + (max - min) * i / steps);
        const to = Math.round(min + (max - min) * (i + 1) / steps);
        const color = getColor(from + (to - from) / 2);
        
        labels.push(
          `<i style="background:${color}; width: 18px; height: 18px; display: inline-block; margin-right: 8px;"></i> ${from}${i < steps - 1 ? `–${to}` : '+'}`
        );
      }
      
      div.innerHTML = labels.join('<br>');
      return div;
    };
    
    legend.addTo(map);
  }

  function updateMap() {
    if (!map || !L || !geoJson) return;
    
    // Remove existing layer
    if (layer) {
      map.removeLayer(layer);
    }
    
    // Remove existing legend
    if (legend) {
      legend.remove();
      legend = null;
    }
    
    // Create new layer
    layer = L.geoJSON(geoJson, {
      style: style,
      onEachFeature: onEachFeature
    }).addTo(map);
    
    // Fit to bounds
    try {
      map.fitBounds(layer.getBounds(), { padding: [20, 20] });
    } catch {}
    
    // Create legend
    createLegend();
  }

  onMount(async () => {
    if (!browser) return;
    
    // Import Leaflet
    L = await import('leaflet');
    await import('leaflet/dist/leaflet.css');
    
    // Create map
    map = L.map(mapEl, { 
      zoomControl: true,
      attributionControl: true
    }).setView([9.5, 2.3], 6);
    
    // Add tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Initial update
    updateMap();
  });

  // Update when geoJson or data changes
  $effect(() => {
    if (geoJson && data) {
      updateMap();
    }
  });
</script>

<div bind:this={mapEl} style="height: {height}px; width: 100%; border-radius: 6px; overflow: hidden; border: 1px solid hsl(var(--border));"></div>

<style>
  :global(.leaflet-container) { 
    font: inherit; 
  }
  :global(.info.legend) { 
    background: rgba(255,255,255,0.9) !important; 
    color: #333 !important; 
    padding: 6px 8px !important; 
    border-radius: 4px !important; 
    border: 1px solid #ccc !important; 
  }
</style>

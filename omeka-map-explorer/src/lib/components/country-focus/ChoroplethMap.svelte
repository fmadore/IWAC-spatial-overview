<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { scaleQuantize, scaleThreshold, scaleSqrt } from 'd3-scale';
  import { schemeBlues } from 'd3-scale-chromatic';
  import { quantile } from 'd3-array';

  // Props
  let {
    geoJson,
    data = {},
    height = 520,
    scaleType = 'quantile'
  } = $props<{
    geoJson: any;
    data?: Record<string, number>;
    height?: number;
    scaleType?: 'quantile' | 'linear' | 'sqrt';
  }>();

  // Local state
  let mapEl: HTMLDivElement;
  let map: any = null;
  let layer: any = null;
  let legend: any = null;
  let L: any;

  // Color scale with better distribution handling
  const colorScale = $derived.by(() => {
    const values = Object.values(data).filter((v): v is number => typeof v === 'number' && v > 0);
    if (values.length === 0) return (v: number) => '#f0f0f0';
    
    if (values.length === 1) return (v: number) => v > 0 ? schemeBlues[4] : '#f0f0f0';
    
    // Sort values for statistical analysis
    const sortedValues = [...values].sort((a, b) => a - b);
    const min = sortedValues[0];
    const max = sortedValues[sortedValues.length - 1];
    
    // If all values are the same
    if (min === max) return (v: number) => v > 0 ? schemeBlues[4] : '#f0f0f0';
    
    const colors = schemeBlues[7];
    
    switch (scaleType) {
      case 'sqrt': {
        // Square root scale - good for data with a few very large outliers
        const scale = scaleSqrt()
          .domain([min, max])
          .range([0, colors.length - 1]);
        
        return (v: number) => {
          if (v <= 0) return '#f0f0f0';
          const index = Math.min(Math.floor(scale(v)), colors.length - 1);
          return colors[index];
        };
      }
      
      case 'linear': {
        // Linear quantize scale - equal intervals
        const scale = scaleQuantize()
          .domain([min, max])
          .range(colors);
        return (v: number) => v > 0 ? scale(v) : '#f0f0f0';
      }
      
      case 'quantile':
      default: {
        // Quantile-based thresholds - equal number of regions per color
        const thresholds = [];
        for (let i = 1; i < colors.length; i++) {
          const q = i / colors.length;
          const threshold = quantile(sortedValues, q);
          if (threshold !== undefined) {
            thresholds.push(threshold);
          }
        }
        
        // Remove duplicates and ensure proper ordering
        const uniqueThresholds = [...new Set(thresholds)].sort((a, b) => a - b);
        
        // If we don't have enough unique thresholds, fall back to linear scale
        if (uniqueThresholds.length < 2) {
          const scale = scaleQuantize()
            .domain([min, max])
            .range(colors);
          return (v: number) => v > 0 ? scale(v) : '#f0f0f0';
        }
        
        // Create threshold scale
        const scale = scaleThreshold()
          .domain(uniqueThresholds)
          .range(colors);
        
        return (v: number) => v > 0 ? scale(v) : '#f0f0f0';
      }
    }
  });

  // Helper function to get thresholds for legend (depends on scale type)
  const legendThresholds = $derived.by(() => {
    const values = Object.values(data).filter((v): v is number => typeof v === 'number' && v > 0);
    if (values.length === 0) return [];
    
    const sortedValues = [...values].sort((a, b) => a - b);
    const min = sortedValues[0];
    const max = sortedValues[sortedValues.length - 1];
    const colors = schemeBlues[7];
    
    switch (scaleType) {
      case 'sqrt': {
        // For square root scale, create equal intervals in sqrt space
        const sqrtScale = scaleSqrt().domain([min, max]).range([0, colors.length - 1]);
        const thresholds = [];
        for (let i = 1; i < colors.length; i++) {
          // Find the value that maps to this color index
          const targetIndex = i - 0.5;
          const threshold = sqrtScale.invert(targetIndex);
          thresholds.push(Math.round(threshold));
        }
        return [...new Set(thresholds)].sort((a, b) => a - b);
      }
      
      case 'linear': {
        // Linear intervals
        const thresholds = [];
        for (let i = 1; i < colors.length; i++) {
          const threshold = min + (max - min) * i / colors.length;
          thresholds.push(Math.round(threshold));
        }
        return thresholds;
      }
      
      case 'quantile':
      default: {
        // Quantile thresholds
        const thresholds = [];
        for (let i = 1; i < colors.length; i++) {
          const q = i / colors.length;
          const threshold = quantile(sortedValues, q);
          if (threshold !== undefined) {
            thresholds.push(Math.round(threshold));
          }
        }
        return [...new Set(thresholds)].sort((a, b) => a - b);
      }
    }
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

  function onEachFeature(feature: any, featureLayer: any) {
    const name = feature.properties?.name || 'Unknown';
    const count = data[name] || 0;
    
    // Tooltip
    featureLayer.bindTooltip(`<strong>${name}</strong><br/>${count} articles`, {
      sticky: true
    });
    
    // Popup
    featureLayer.bindPopup(`
      <div style="text-align: center;">
        <h4 style="margin: 0 0 8px 0;">${name}</h4>
        <p style="margin: 0;"><strong>${count}</strong> articles</p>
      </div>
    `);
    
    // Hover effects
    featureLayer.on({
      mouseover: (e: any) => {
        const targetLayer = e.target;
        targetLayer.setStyle({
          weight: 2,
          color: '#333',
          fillOpacity: 0.9
        });
      },
      mouseout: (e: any) => {
        // Reset to original style using the parent layer's resetStyle method
        if (layer && layer.resetStyle) {
          layer.resetStyle(e.target);
        }
      }
    });
  }

  function createLegend() {
    if (!L || !map) return;
    
    const values = Object.values(data).filter((v): v is number => typeof v === 'number' && v > 0);
    if (values.length === 0) return;
    
    legend = new L.Control({ position: 'bottomright' });
    
    legend.onAdd = function() {
      const div = L.DomUtil.create('div', 'info legend');
      div.style.background = 'rgba(255,255,255,0.9)';
      div.style.padding = '6px 8px';
      div.style.borderRadius = '4px';
      div.style.border = '1px solid #ccc';
      
      const colors = schemeBlues[7];
      const thresholds = legendThresholds;
      
      const scaleLabels: Record<string, string> = {
        quantile: 'Articles (Quantile)',
        linear: 'Articles (Linear)', 
        sqrt: 'Articles (√ Scale)'
      };
      
      let labels = [`<strong>${scaleLabels[scaleType] || 'Articles'}</strong>`];
      
      if (thresholds.length === 0) {
        // Single color for all values
        const color = getColor(Math.max(...values));
        labels.push(
          `<i style="background:${color}; width: 18px; height: 18px; display: inline-block; margin-right: 8px;"></i> All regions`
        );
      } else {
        // Create ranges based on quantile thresholds
        const sortedValues = [...values].sort((a, b) => a - b);
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        // First range: min to first threshold
        if (thresholds.length > 0) {
          const color = getColor(min);
          labels.push(
            `<i style="background:${color}; width: 18px; height: 18px; display: inline-block; margin-right: 8px;"></i> ${min}–${thresholds[0]}`
          );
        }
        
        // Middle ranges: between thresholds
        for (let i = 0; i < thresholds.length - 1; i++) {
          const color = getColor(thresholds[i] + 1);
          labels.push(
            `<i style="background:${color}; width: 18px; height: 18px; display: inline-block; margin-right: 8px;"></i> ${thresholds[i] + 1}–${thresholds[i + 1]}`
          );
        }
        
        // Last range: last threshold to max
        if (thresholds.length > 0) {
          const color = getColor(max);
          labels.push(
            `<i style="background:${color}; width: 18px; height: 18px; display: inline-block; margin-right: 8px;"></i> ${thresholds[thresholds.length - 1] + 1}–${max}`
          );
        }
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

  // Update when geoJson, data, or scaleType changes
  $effect(() => {
    if (geoJson && data) {
      updateMap();
    }
    // Include scaleType in dependencies to trigger updates
    void scaleType;
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

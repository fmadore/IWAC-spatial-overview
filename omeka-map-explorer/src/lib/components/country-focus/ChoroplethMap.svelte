<script lang="ts">
  import { onMount, mount } from 'svelte';
  import { browser } from '$app/environment';
  import { scaleQuantize, scaleThreshold, scaleSqrt } from 'd3-scale';
  import { schemeBlues } from 'd3-scale-chromatic';
  import { quantile } from 'd3-array';
  import ChoroplethPopup from './ChoroplethPopup.svelte';

  // Props
  let {
    geoJson,
    data = {},
    height = 520,
    scaleType = 'quantile',
    country = 'Unknown',
    adminLevel = 'regions'
  } = $props<{
    geoJson: any;
    data?: Record<string, number>;
    height?: number;
    scaleType?: 'quantile' | 'linear' | 'sqrt';
    country?: string;
    adminLevel?: 'regions' | 'prefectures';
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
    
    // Enhanced tooltip
    featureLayer.bindTooltip(`<strong>${name}</strong><br/>${count} articles`, {
      sticky: true,
      className: 'choropleth-tooltip'
    });
    
    // Create popup with Svelte component
    const popupContainer = document.createElement('div');
    
    const regionData = {
      name,
      count,
      country,
      adminLevel
    };
    
    // Mount Svelte component for popup using Svelte 5 syntax
    mount(ChoroplethPopup, {
      target: popupContainer,
      props: { regionData }
    });
    
    featureLayer.bindPopup(popupContainer, {
      maxWidth: 400,
      className: 'choropleth-leaflet-popup'
    });
    
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
    
    // Fit to bounds & then lock panning so users can't drag far into empty oceans
    try {
      const bounds = layer.getBounds();
      map.fitBounds(bounds, { padding: [20, 20] });
      // Slightly pad bounds so edge features aren't glued to viewport; then set as max bounds
      const padded = bounds.pad(0.08);
      map.setMaxBounds(padded);
      // Make the map "stick" to bounds (configured via maxBoundsViscosity at init)
    } catch {}
    
    // Create legend
    createLegend();
  }

  onMount(async () => {
    if (!browser) return;
    
    // Import Leaflet
    L = await import('leaflet');
    await import('leaflet/dist/leaflet.css');
    
    // Create map with constrained world wrapping; we'll set dynamic maxBounds after data loads
    map = L.map(mapEl, { 
      zoomControl: true,
      attributionControl: true,
      worldCopyJump: false,
      maxBoundsViscosity: 1.0 // stickiness at edges once maxBounds applied
    }).setView([9.5, 2.3], 6);
    
    // Add Carto tiles (noWrap prevents horizontal repetition of the world)
    const cartoAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attribution">CARTO</a>';
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
      attribution: cartoAttribution,
      noWrap: true
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
  :global(.choropleth-tooltip) {
    background: rgba(0, 0, 0, 0.8) !important;
    color: white !important;
    border: none !important;
    border-radius: 4px !important;
    padding: 4px 8px !important;
    font-size: 12px !important;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2) !important;
  }
  :global(.choropleth-leaflet-popup .leaflet-popup-content-wrapper) {
    background: transparent !important;
    border-radius: 8px !important;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15) !important;
    padding: 0 !important;
  }
  :global(.choropleth-leaflet-popup .leaflet-popup-content) {
    margin: 0 !important;
    font: inherit !important;
  }
  :global(.choropleth-leaflet-popup .leaflet-popup-tip) {
    background: white !important;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
  }
</style>

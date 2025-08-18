<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { scaleQuantize } from 'd3-scale';
  import { schemeBlues } from 'd3-scale-chromatic';
  import type { GeoJsonData, GeoJsonFeature } from '$lib/types';
  import { browser } from '$app/environment';
  
  // Props
  export let map: any;
  export let geoJson: GeoJsonData;
  export let data: Record<string, number> = {}; // Count data per region
  export let colorRange = schemeBlues[7]; // Color scheme
  
  // Local state - using any to avoid TypeScript errors with Leaflet
  let layer: any = null;
  let info: any = null;
  let legend: any = null;
  let L: any; // Will hold the Leaflet library when loaded
  
  // Create event dispatcher
  const dispatch = createEventDispatcher();
  
  // Generate color scale based on data
  $: colorScale = generateColorScale(data, colorRange);
  
  onMount(() => {
    if (!browser || !map || !geoJson) return undefined;
    
    const initMap = async () => {
      // Dynamically import Leaflet
      L = (await import('leaflet')).default;
      
      // Create layer
      createLayer();
      
      // Add info control
      createInfoControl();
      
      // Add legend
      createLegendControl();
    };
    
    initMap();
    
    return () => {
      if (layer && map) {
        map.removeLayer(layer);
      }
      
      if (info && map) {
        info.remove();
      }
      
      if (legend && map) {
        legend.remove();
      }
    };
  });
  
  // Create choropleth layer
  function createLayer() {
    if (!L || !map || !geoJson) return;
    
    layer = L.geoJSON(geoJson, {
      style: (feature: any) => style(feature),
      onEachFeature: (feature: any, layer: any) => {
        layer.on({
          mouseover: highlightFeature,
          mouseout: resetHighlight,
          click: zoomToFeature
        });
      }
    }).addTo(map);
  }
  
  // Create info control
  function createInfoControl() {
    if (!L || !map) return;
    
    info = new L.Control({ position: 'topright' });
    
    info.onAdd = function () {
      this._div = L.DomUtil.create('div', 'info');
      this.update();
      return this._div;
    };
    
    info.update = function (props?: any) {
      this._div.innerHTML = '<h4>Region Data</h4>' + 
        (props 
          ? '<b>' + props.name + '</b><br />' + (data[props.name] || 0) + ' articles'
          : 'Hover over a region');
    };
    
    info.addTo(map);
  }
  
  // Create legend control
  function createLegendControl() {
    if (!L || !map) return;
    
    const scale = colorScale;
    const domain = scale.domain();
    const range = scale.range();
    
    legend = new L.Control({ position: 'bottomright' });
    
    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'info legend');
      let labels = [];
      let from, to;
      
      // Generate labels and colors for legend
      for (let i = 0; i < range.length; i++) {
        from = Math.round(domain[i]);
        to = Math.round(domain[i + 1]);
        
        labels.push(
          '<i style="background:' + range[i] + '"></i> ' +
          from + (to ? '&ndash;' + to : '+'));
      }
      
      div.innerHTML = labels.join('<br>');
      return div;
    };
    
    legend.addTo(map);
  }
  
  // Style function for regions
  function style(feature: GeoJsonFeature | any) {
    if (!feature.properties || !feature.properties.name) return {};
    
    const regionName = feature.properties.name;
    const value = data[regionName] || 0;
    
    return {
      fillColor: colorScale(value),
      weight: 2,
      opacity: 1,
      color: 'white',
      dashArray: '3',
      fillOpacity: 0.7
    };
  }
  
  // Handle feature hover
  function highlightFeature(e: any) {
    if (!L) return;
    
    const layer = e.target;
    
    layer.setStyle({
      weight: 5,
      color: '#666',
      dashArray: '',
      fillOpacity: 0.7
    });
    
    if (L.Browser && !L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
      layer.bringToFront();
    }
    
    if (info) {
      info.update(layer.feature.properties);
    }
    
    dispatch('highlightRegion', {
      region: layer.feature.properties.name
    });
  }
  
  // Reset highlight on mouseout
  function resetHighlight(e: any) {
    if (layer) {
      layer.resetStyle(e.target);
    }
    
    if (info) {
      info.update();
    }
    
    dispatch('resetHighlight', {
      region: e.target.feature.properties.name
    });
  }
  
  // Handle feature click
  function zoomToFeature(e: any) {
    map.fitBounds(e.target.getBounds());
    
    dispatch('selectRegion', {
      region: e.target.feature.properties.name
    });
  }
  
  // Generate color scale based on data
  function generateColorScale(data: Record<string, number>, range: string[]) {
    const values = Object.values(data);
    
    if (values.length === 0) {
      return scaleQuantize()
        .domain([0, 10])
        .range(range);
    }
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return scaleQuantize()
      .domain([min, max])
      .range(range);
  }
  
  // Update when data changes
  $: if (browser && layer && data) {
    updateLayer();
  }
  
  // Update layer with new data
  function updateLayer() {
    if (!layer) return;
    
    layer.setStyle(style);
    
    if (legend && map && L) {
      legend.remove();
      createLegendControl();
    }
  }
</script>

<style>
  :global(.info) {
    padding: 6px 8px;
    font: 14px/16px Arial, Helvetica, sans-serif;
    background: white;
    background: rgba(255, 255, 255, 0.8);
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.2);
    border-radius: 5px;
  }
  
  :global(.info h4) {
    margin: 0 0 5px;
    color: #777;
  }
  
  :global(.legend) {
    text-align: left;
    line-height: 18px;
    color: #555;
  }
  
  :global(.legend i) {
    width: 18px;
    height: 18px;
    float: left;
    margin-right: 8px;
    opacity: 0.7;
  }
</style> 
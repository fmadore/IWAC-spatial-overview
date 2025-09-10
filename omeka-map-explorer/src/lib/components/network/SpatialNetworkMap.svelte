<!--
  SpatialNetworkMap.svelte - Leaflet map with Sigma.js network overlay using @sigma/layer-leaflet
  
  Properly integrated using TypeScript renderer module following official documentation:
  - Uses getNodeLatLng function pattern from Sigma.js docs
  - Proper tile synchronization between Leaflet and Sigma
  - Clean separation of concerns with dedicated renderer
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { SpatialNetworkData, SpatialNetworkNode } from '$lib/types';
  import { spatialNetworkState } from '$lib/state/spatialNetworkData.svelte';
  import { createSpatialNetworkRenderer, type SpatialNetworkRenderer } from '$lib/utils/spatialNetworkRenderer';

  // Props
  let { 
    data = null,
    height = '600px',
    onNodeSelect,
    onNodeHover
  } = $props<{
    data?: SpatialNetworkData | null;
    height?: string;
    onNodeSelect?: (node: SpatialNetworkNode | null) => void;
    onNodeHover?: (node: SpatialNetworkNode | null) => void;
  }>();

  // DOM element reference; declare with $state so effects react to bind:this updates
  let mapContainer = $state<HTMLDivElement | null>(null);

  // Renderer instance
  let renderer: SpatialNetworkRenderer | null = null;

  // State
  let isInitialized = $state(false);
  let error = $state<string | null>(null);

  // Reactive data
  const currentData = $derived(data ?? spatialNetworkState.filtered);

  // Initialize when we have both data and container; also ensure Leaflet CSS is loaded
  onMount(async () => {
    try {
      await import('leaflet/dist/leaflet.css');
      console.debug('[SpatialNetworkMap] Leaflet CSS loaded');
    } catch (e) {
      console.warn('[SpatialNetworkMap] Failed to load Leaflet CSS:', e);
    }
    // actual initialization handled by effect once container + data are ready
  });

  /**
   * Create and initialize the renderer
   */
  async function initializeRenderer() {
    if (!currentData || !mapContainer || renderer) return;

    try {
      console.log('🔄 Initializing spatial network renderer...', {
        hasContainer: !!mapContainer,
        nodes: currentData.nodes.length,
        edges: currentData.edges.length
      });
      // Ensure clean container (prevents ghost Sigma canvas when rebinding)
      mapContainer.innerHTML = '';
      
      renderer = await createSpatialNetworkRenderer({
        container: mapContainer,
        data: currentData,
        onNodeSelect,
        onNodeHover
      });

      await renderer.initialize();
      isInitialized = true;
      
      console.log('✅ Spatial network renderer initialized');
    } catch (err) {
  console.error('Failed to initialize spatial network renderer:', err);
  error = (err as any)?.message || 'Failed to initialize network visualization';
    }
  }

  /**
   * Update data when it changes
   */
  $effect(() => {
    // Initialize once when container & data are ready
    if (!isInitialized && currentData && mapContainer && !renderer) {
      initializeRenderer();
      return;
    }
    // Update data if already initialized
    if (currentData && renderer && isInitialized) {
      renderer.updateData(currentData);
    }
  });

  /**
   * Update highlighting when state changes
   */
  $effect(() => {
    if (renderer && isInitialized) {
      renderer.updateHighlighting(
  spatialNetworkState.selectedNodeId,
  Array.from(spatialNetworkState.highlightedNodeIds)
      );
    }
  });

  /**
   * Cleanup on component destroy
   */
  onDestroy(() => {
    if (renderer) {
      renderer.destroy();
      renderer = null;
    }
    // Final cleanup of container to ensure no ghost canvases remain
    if (mapContainer) mapContainer.innerHTML = '';
  });
</script>

<!-- Map container -->
<div class="relative w-full overflow-hidden rounded-lg border border-border bg-card" data-testid="spatial-network-container" style="height: {height};">
  {#if error}
    <div class="flex h-full items-center justify-center">
      <div class="rounded-lg bg-destructive/10 p-4 text-destructive">
  <p class="font-medium">Error loading spatial network</p>
  <p class="text-sm text-muted-foreground">{error}</p>
      </div>
    </div>
  {:else}
    <!-- Map container - renderer creates everything here -->
    <div 
      bind:this={mapContainer}
      class="w-full h-full"
      data-testid="spatial-network-map"
    ></div>

    <!-- Loading overlay -->
    {#if !isInitialized}
      <div class="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div class="flex items-center space-x-2 text-muted-foreground">
          <div class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-b-transparent"></div>
          <span class="text-sm">Loading spatial network...</span>
        </div>
      </div>
    {/if}

    <!-- Network stats overlay -->
    {#if isInitialized && currentData}
      <div class="absolute bottom-4 left-4 rounded-lg bg-background/90 p-3 text-xs text-muted-foreground backdrop-blur-sm">
        <div class="space-y-1">
          <div>{currentData.nodes.length.toLocaleString()} locations</div>
          <div>{currentData.edges.length.toLocaleString()} connections</div>
          {#if spatialNetworkState.selectedNodeId}
            <div class="text-primary">1 selected</div>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  /* Ensure proper styling for the Leaflet map created by bindLeafletLayer */
  :global(.leaflet-container) {
    background: transparent !important;
    outline: none;
  }
  
  :global(.leaflet-control-attribution) {
    background: rgba(255, 255, 255, 0.8) !important;
    font-size: 10px !important;
  }

  /* Ensure Sigma canvas is properly positioned over Leaflet */
  :global(.sigma-scene) {
    z-index: 1000 !important;
  }
</style>

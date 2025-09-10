<!--
  SpatialNetworkMap.svelte - Leaflet map with Sigma.js network overlay using @sigma/layer-leaflet
  
  Properly integrated using TypeScript renderer module following official documentation:
  - Uses getNodeLatLng function pattern from Sigma.js docs
  - Proper tile synchronization between Leaflet and Sigma
  - Clean separation of concerns with dedicated renderer
  - Optimized for Svelte 5 to prevent flashing during initialization
-->
<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
  import type { SpatialNetworkData, SpatialNetworkNode } from '$lib/types';
  import { spatialNetworkState, getHighlightedNodeIds } from '$lib/state/spatialNetworkData.svelte';
  import { createSpatialNetworkRenderer, type SpatialNetworkRenderer } from '$lib/utils/spatialNetworkRenderer';
  import { appState } from '$lib/state/appState.svelte';

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
  let initializationInProgress = $state(false);

  // Reactive data - use $derived for cleaner reactivity
  const currentData = $derived(data ?? spatialNetworkState.filtered);
  
  // Track data changes to prevent unnecessary updates
  const dataSignature = $derived(currentData ? `${currentData.nodes.length}-${currentData.edges.length}` : null);
  let lastDataSignature = $state<string | null>(null);

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
    if (!currentData || !mapContainer || renderer || initializationInProgress) return;

    // Prevent multiple simultaneous initializations
    initializationInProgress = true;

    try {
      console.log('🔄 Initializing spatial network renderer...', {
        hasContainer: !!mapContainer,
        nodes: currentData.nodes.length,
        edges: currentData.edges.length
      });
      
      // Ensure clean container (prevents ghost Sigma canvas when rebinding)
      mapContainer.innerHTML = '';
      
      // Use untrack to prevent the creation process from triggering reactivity
      renderer = await untrack(() => createSpatialNetworkRenderer({
        container: mapContainer!, // Non-null assertion since we checked above
        data: currentData,
        onNodeSelect,
        onNodeHover
      }));

      await renderer.initialize();
      
      // Expose control functions globally for the App Sidebar
      appState.spatialNetworkControlFunctions = {
        fitToView: () => renderer?.fitToView(),
        resetView: () => renderer?.resetView(),
        zoomIn: () => renderer?.zoomIn(),
        zoomOut: () => renderer?.zoomOut()
      };
      
      isInitialized = true;
      error = null;
      
      console.log('✅ Spatial network renderer initialized');
    } catch (err) {
      console.error('Failed to initialize spatial network renderer:', err);
      error = (err as any)?.message || 'Failed to initialize network visualization';
    } finally {
      initializationInProgress = false;
    }
  }

  /**
   * Main effect - handles initialization and all updates in a single reactive block
   * This prevents multiple re-initializations that cause flashing
   */
  $effect(() => {
    // Only initialize once when container & data are ready
    if (!isInitialized && !initializationInProgress && currentData && mapContainer && !renderer) {
      initializeRenderer();
      lastDataSignature = dataSignature;
      return; // Exit early on initialization to prevent subsequent updates
    }
    
    // If already initialized, handle updates only when necessary
    if (renderer && isInitialized && currentData && !initializationInProgress) {
      // Only update data if it actually changed
      const dataChanged = dataSignature !== lastDataSignature;
      
      if (dataChanged) {
        console.log('📊 Data changed, updating renderer...', dataSignature);
        // Use untrack for the update to prevent triggering more reactivity
        untrack(() => {
          renderer!.updateData(currentData);
        });
        lastDataSignature = dataSignature;
      }
      
      // Always update highlighting (lightweight operation)
      // But untrack to prevent highlighting changes from triggering data updates
      untrack(() => {
        renderer!.updateHighlighting(
          spatialNetworkState.selectedNodeId,
          Array.from(getHighlightedNodeIds())
        );
      });
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
    // Clear exported controls when unmounting
    appState.spatialNetworkControlFunctions = null;
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

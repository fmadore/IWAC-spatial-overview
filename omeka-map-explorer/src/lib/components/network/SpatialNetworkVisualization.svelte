<!--
  SpatialNetworkVisualization.svelte - Complete spatial network visualization
  
  Main component that combines:
  - SpatialNetworkMap (Leaflet + Sigma.js)
  - SpatialNetworkSidebar (Controls and statistics)
  - Data loading and state management
  - Responsive layout
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import SpatialNetworkMap from './SpatialNetworkMap.svelte';
  import SpatialNetworkSidebar from './SpatialNetworkSidebar.svelte';
  import { 
    spatialNetworkState, 
    loadSpatialNetworkData,
    selectSpatialNode,
    getSpatialNodeById
  } from '$lib/state/spatialNetworkData.svelte';
  import type { SpatialNetworkNode } from '$lib/types';

  // Props
  let { 
    title = "Spatial Network: Location Connections",
    description = "Geographic network showing co-occurring locations in articles"
  } = $props<{
    title?: string;
    description?: string;
  }>();

  // Component state
  let mapComponent = $state<any>(null);
  let selectedNodeId = $state<string | null>(null);
  let hoveredNode = $state<SpatialNetworkNode | null>(null);
  let isDataLoaded = $state(false);

  // Reactive computed values
  const hasData = $derived(spatialNetworkState.data !== null);
  const isLoading = $derived(spatialNetworkState.isLoading);
  const error = $derived(spatialNetworkState.error);
  const networkStats = $derived(() => {
    if (!spatialNetworkState.filtered) return null;
    return {
      nodes: spatialNetworkState.filtered.nodes.length,
      edges: spatialNetworkState.filtered.edges.length,
      geocodingRate: spatialNetworkState.data?.meta.geocodingSuccessRate || 0
    };
  });

  /**
   * Load spatial network data on mount
   */
  async function initializeData() {
    if (!spatialNetworkState.isInitialized) {
      console.log('🌍 Loading spatial network data...');
      const success = await loadSpatialNetworkData();
      if (success) {
        isDataLoaded = true;
        console.log('✅ Spatial network data loaded successfully');
      } else {
        console.error('❌ Failed to load spatial network data');
      }
    } else {
      isDataLoaded = true;
    }
  }

  /**
   * Handle node selection from map
   */
  function handleNodeSelect(node: SpatialNetworkNode | null) {
    selectedNodeId = node?.id || null;
    selectSpatialNode(selectedNodeId);
    
    // Clear hover when selecting
    hoveredNode = null;
  }

  /**
   * Handle node hover from map
   */
  function handleNodeHover(node: SpatialNetworkNode | null) {
    hoveredNode = node;
  }

  /**
   * Map control functions
   */
  function handleFitToView() {
    // This would trigger the map to fit to all visible nodes
    console.log('Fitting to view...');
  }

  function handleResetView() {
    // Reset to initial bounds
    console.log('Resetting view...');
  }

  function handleZoomIn() {
    // Zoom in
    console.log('Zooming in...');
  }

  function handleZoomOut() {
    // Zoom out
    console.log('Zooming out...');
  }

  /**
   * Retry loading data
   */
  function retryLoad() {
    spatialNetworkState.error = null;
    initializeData();
  }

  // Lifecycle
  onMount(() => {
    initializeData();
  });
</script>

<div class="flex flex-col h-full max-h-screen">
  <!-- Header -->
  <div class="flex-none">
    <Card class="border-b rounded-b-none">
      <CardHeader class="pb-4">
        <div class="flex items-start justify-between">
          <div>
            <CardTitle class="text-xl">{title}</CardTitle>
            <CardDescription class="mt-1">{description}</CardDescription>
          </div>
          
          {#if networkStats() && hasData}
            <div class="flex gap-2">
              <Badge variant="secondary">
                {new Intl.NumberFormat().format(networkStats()!.nodes)} locations
              </Badge>
              <Badge variant="secondary">
                {new Intl.NumberFormat().format(networkStats()!.edges)} connections
              </Badge>
              {#if networkStats()!.geocodingRate > 0}
                <Badge variant="outline">
                  {networkStats()!.geocodingRate.toFixed(1)}% geocoded
                </Badge>
              {/if}
            </div>
          {/if}
        </div>

        {#if hoveredNode}
          <div class="mt-2 p-2 bg-accent/20 rounded-md border text-sm">
            <strong>{hoveredNode.label}</strong>
            {#if hoveredNode.country}
              <span class="text-muted-foreground">• {hoveredNode.country}</span>
            {/if}
            <span class="text-muted-foreground">• {hoveredNode.count} articles</span>
          </div>
        {/if}
      </CardHeader>
    </Card>
  </div>

  <!-- Main Content -->
  <div class="flex-1 min-h-0">
    <div class="flex h-full gap-4">
      <!-- Main Visualization Area - Give map 75% of space -->
      <div class="flex-[3] min-w-0 overflow-hidden h-full">
          {#if isLoading}
            <!-- Loading State -->
            <Card class="h-full">
              <CardContent class="h-full flex items-center justify-center">
                <div class="flex flex-col items-center gap-4">
                  <div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  <div class="text-center">
                    <p class="font-medium">Loading spatial network...</p>
                    <p class="text-sm text-muted-foreground mt-1">
                      This may take a moment while we process location coordinates
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          {:else if error}
            <!-- Error State -->
            <Card class="h-full">
              <CardContent class="h-full flex items-center justify-center">
                <div class="flex flex-col items-center gap-4 text-center max-w-md">
                  <div class="text-destructive">
                    <svg class="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p class="font-medium text-lg">Failed to load spatial network</p>
                    <p class="text-sm text-muted-foreground mt-2">{error}</p>
                    <p class="text-xs text-muted-foreground mt-2">
                      Make sure to run the spatial network generation script first:
                      <code class="bg-muted px-1 py-0.5 rounded">python scripts/build_spatial_networks.py</code>
                    </p>
                  </div>
                  <Button onclick={retryLoad} variant="outline">
                    Try Again
                  </Button>
                </div>
              </CardContent>
            </Card>
          {:else if hasData}
            <!-- Network Visualization -->
            <div class="h-full">
              <SpatialNetworkMap
                bind:this={mapComponent}
                data={spatialNetworkState.filtered}
                height="600px"
                onNodeSelect={handleNodeSelect}
                onNodeHover={handleNodeHover}
              />
            </div>
          {:else}
            <!-- No Data State -->
            <Card class="h-full">
              <CardContent class="h-full flex items-center justify-center">
                <div class="flex flex-col items-center gap-4 text-center max-w-md">
                  <div class="text-muted-foreground">
                    <svg class="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m-6 3l6-3" />
                    </svg>
                  </div>
                  <div>
                    <p class="font-medium text-lg">No spatial network data available</p>
                    <p class="text-sm text-muted-foreground mt-2">
                      Generate spatial network data with geographic coordinates to see location connections on the map.
                    </p>
                  </div>
                  <Button onclick={retryLoad} variant="outline">
                    Check Again
                  </Button>
                </div>
              </CardContent>
            </Card>
          {/if}
        </div>

        <!-- Sidebar - Regular flex layout instead of Sidebar component -->
        {#if hasData && !isLoading}
          <div class="flex-[1] w-80 max-w-sm h-full bg-sidebar border-l border-border overflow-y-auto">
            <div class="p-4">
              <SpatialNetworkSidebar
                {selectedNodeId}
                onFitToView={handleFitToView}
                onResetView={handleResetView}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
              />
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>

<style>
  :global(.spatial-network-container) {
    height: 100%;
    min-height: 600px;
  }
</style>

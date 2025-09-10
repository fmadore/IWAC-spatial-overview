<!--
  SpatialNetworkIsolationControl.svelte - Isolation mode control for spatial network
  
  Provides a toggle for isolation mode that shows only a selected node and its direct connections.
  Uses Svelte 5 runes for reactive state management and follows Sigma.js best practices.
-->
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { 
    spatialNetworkState, 
    toggleSpatialIsolationMode,
    disableSpatialIsolationMode,
    getSpatialNodeNeighbors,
    getSpatialSelectedNode
  } from '$lib/state/spatialNetworkData.svelte';

  // Props
  let {
    variant = 'outline',
    size = 'sm',
    showNeighborCount = true
  } = $props<{
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    showNeighborCount?: boolean;
  }>();

  // Reactive computed values using $derived for optimized reactivity
  const selectedNode = $derived(getSpatialSelectedNode());
  const isIsolationMode = $derived(spatialNetworkState.isolationMode);
  const isolatedNodeId = $derived(spatialNetworkState.isolatedNodeId);
  const canEnableIsolation = $derived(!!spatialNetworkState.selectedNodeId);
  
  // Get neighbor count for the selected node - simpler approach
  const neighborCount = $derived(() => {
    if (!spatialNetworkState.selectedNodeId) return 0;
    return getSpatialNodeNeighbors(spatialNetworkState.selectedNodeId).length;
  });

  // Debug reactive state changes
  $effect(() => {
    console.log('🔄 Isolation control reactive state change:', {
      selectedNodeId: spatialNetworkState.selectedNodeId,
      isIsolationMode,
      isolatedNodeId,
      canEnableIsolation,
      neighborCount: neighborCount()
    });
  });

  /**
   * Handle isolation mode toggle
   */
  function handleToggleIsolation() {
    console.log('🔄 Toggling isolation mode:', {
      isIsolationMode,
      selectedNodeId: spatialNetworkState.selectedNodeId,
      isolatedNodeId: spatialNetworkState.isolatedNodeId
    });
    
    if (isIsolationMode) {
      console.log('🚫 Disabling isolation mode');
      disableSpatialIsolationMode();
    } else if (spatialNetworkState.selectedNodeId) {
      console.log('✅ Enabling isolation mode for node:', spatialNetworkState.selectedNodeId);
      toggleSpatialIsolationMode(spatialNetworkState.selectedNodeId);
    } else {
      console.warn('⚠️ No node selected for isolation mode');
    }
    
    // Log state after toggle
    setTimeout(() => {
      console.log('📊 State after toggle:', {
        isolationMode: spatialNetworkState.isolationMode,
        isolatedNodeId: spatialNetworkState.isolatedNodeId,
        selectedNodeId: spatialNetworkState.selectedNodeId
      });
    }, 100);
  }

  /**
   * Handle clearing isolation when no node is selected
   */
  $effect(() => {
    // Auto-disable isolation mode if no node is selected
    if (isIsolationMode && !spatialNetworkState.selectedNodeId) {
      disableSpatialIsolationMode();
    }
  });
</script>

<!-- Isolation Control -->
<div class="flex items-center gap-2">
  <Button 
    {variant}
    {size}
    onclick={handleToggleIsolation}
    disabled={!canEnableIsolation && !isIsolationMode}
    class="transition-all duration-200 ease-in-out"
  >
    {#if isIsolationMode}
      <!-- Exit isolation mode icon -->
      <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
      Exit Focus
    {:else}
      <!-- Focus/isolation mode icon -->
      <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      Focus Location
    {/if}
  </Button>

  <!-- Show neighbor count when in isolation mode or when hovering -->
  {#if showNeighborCount && selectedNode && (isIsolationMode || neighborCount() > 0)}
    <Badge variant="secondary" class="text-xs">
      {#if isIsolationMode}
        Showing {neighborCount() + 1} locations
      {:else}
        {neighborCount()} connections
      {/if}
    </Badge>
  {/if}
</div>

<!-- Helper text -->
{#if selectedNode && !isIsolationMode}
  <p class="text-xs text-muted-foreground mt-1">
    Click any location on the map to automatically focus on it, or use the "Focus Location" button for <strong>{selectedNode.label}</strong> and its {neighborCount()} connected locations.
  </p>
{:else if isIsolationMode && selectedNode}
  <p class="text-xs text-muted-foreground mt-1">
    Focusing on <strong>{selectedNode.label}</strong> and its {neighborCount()} connections. Click "Exit Focus" or click the map background to return to full network view.
  </p>
{:else if !selectedNode}
  <p class="text-xs text-muted-foreground mt-1">
    Click any location on the map to automatically focus on it and see only its direct connections.
  </p>
{/if}



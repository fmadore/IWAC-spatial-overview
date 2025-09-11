<!--
  SpatialNetworkIsolationControl.svelte - Simple isolation mode toggle control
  
  Provides a compact toggle for isolation mode. For more advanced controls,
  use SpatialNetworkFocusCard instead.
  Uses Svelte 5 runes for reactive state management.
-->
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { Eye, EyeOff } from 'lucide-svelte';
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
    showNeighborCount = true,
    showHelpText = false
  } = $props<{
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    showNeighborCount?: boolean;
    showHelpText?: boolean;
  }>();

  // Reactive computed values using $derived for optimized reactivity
  const selectedNode = $derived(getSpatialSelectedNode());
  const isIsolationMode = $derived(spatialNetworkState.isolationMode);
  const canEnableIsolation = $derived(!!spatialNetworkState.selectedNodeId);
  
  // Get neighbor count for the selected node
  const neighborCount = $derived(() => {
    if (!spatialNetworkState.selectedNodeId) return 0;
    return getSpatialNodeNeighbors(spatialNetworkState.selectedNodeId).length;
  });

  /**
   * Handle isolation mode toggle
   */
  function handleToggleIsolation() {
    if (isIsolationMode) {
      disableSpatialIsolationMode();
    } else if (spatialNetworkState.selectedNodeId) {
      toggleSpatialIsolationMode(spatialNetworkState.selectedNodeId);
    } else {
      console.warn('⚠️ No node selected for isolation mode');
    }
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

<!-- Simple Focus Toggle -->
<div class="flex items-center gap-2">
  <Button 
    {variant}
    {size}
    onclick={handleToggleIsolation}
    disabled={!canEnableIsolation && !isIsolationMode}
    class="transition-all duration-200 ease-in-out"
  >
    {#if isIsolationMode}
      <EyeOff class="h-4 w-4 mr-2" />
      Exit Focus
    {:else}
      <Eye class="h-4 w-4 mr-2" />
      Focus Location
    {/if}
  </Button>

  <!-- Show neighbor count badge -->
  {#if showNeighborCount && selectedNode && (isIsolationMode || neighborCount() > 0)}
    <Badge variant="secondary" class="text-xs">
      {#if isIsolationMode}
        {neighborCount() + 1} locations
      {:else}
        {neighborCount()} connections
      {/if}
    </Badge>
  {/if}
</div>

<!-- Optional helper text -->
{#if showHelpText}
  <div class="mt-2 text-xs text-muted-foreground">
    {#if selectedNode && !isIsolationMode}
      <p>Focus on <strong>{selectedNode.label}</strong> and its {neighborCount()} connections</p>
    {:else if isIsolationMode && selectedNode}
      <p>Focusing on <strong>{selectedNode.label}</strong> • {neighborCount()} connections visible</p>
    {:else if !selectedNode}
      <p>Select a location to enter focus mode</p>
    {/if}
  </div>
{/if}



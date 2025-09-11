<!--
  SpatialNetworkFocusCard.svelte - Enhanced focus control card with location selector
  
  Provides an improved focus control interface with:
  - Location search and selection via combobox
  - Focus mode toggle with visual feedback
  - Quick actions for common operations
  - Detailed information about selected location
  - Accessible keyboard navigation
-->
<script lang="ts">
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { Separator } from '$lib/components/ui/separator';
  import { Focus, Eye, EyeOff, RotateCcw, MapPin, Network } from 'lucide-svelte';
  import SpatialNetworkLocationSelector from './SpatialNetworkLocationSelector.svelte';
  import { 
    spatialNetworkState, 
    toggleSpatialIsolationMode,
    disableSpatialIsolationMode,
    getSpatialSelectedNode,
    getSpatialNodeNeighbors,
    selectSpatialNode
  } from '$lib/state/spatialNetworkData.svelte';
  import type { SpatialNetworkNode } from '$lib/types';

  // Props
  let {
    variant = 'default',
    showQuickActions = true,
    showLocationDetails = true,
    compact = false
  } = $props<{
    variant?: 'default' | 'outline' | 'elevated';
    showQuickActions?: boolean;
    showLocationDetails?: boolean;
    compact?: boolean;
  }>();

  // Reactive state
  const selectedNode = $derived(getSpatialSelectedNode());
  const isIsolationMode = $derived(spatialNetworkState.isolationMode);
  const canEnableIsolation = $derived(!!spatialNetworkState.selectedNodeId);
  
  // Get neighbor information
  const neighborInfo = $derived(() => {
    if (!spatialNetworkState.selectedNodeId) return { count: 0, total: 0 };
    const neighbors = getSpatialNodeNeighbors(spatialNetworkState.selectedNodeId);
    return {
      count: neighbors.length,
      total: neighbors.length + 1 // Include the selected node itself
    };
  });

  // Focus mode status
  const focusStatus = $derived(() => {
    if (!selectedNode) return { active: false, text: 'No location selected', description: 'Select a location to enter focus mode' };
    if (isIsolationMode) return { 
      active: true, 
      text: `Focusing on ${selectedNode.label}`, 
      description: `Showing ${neighborInfo().total} locations (${neighborInfo().count} connections)`
    };
    return { 
      active: false, 
      text: `${selectedNode.label} selected`, 
      description: `Ready to focus on ${neighborInfo().count} connections`
    };
  });

  /**
   * Handle location selection from selector
   */
  function handleLocationSelect(location: SpatialNetworkNode | null) {
    // Location selector already handles focus mode activation
    // This is mainly for any additional UI updates needed
  }

  /**
   * Toggle focus mode for current selection
   */
  function handleToggleFocus() {
    if (isIsolationMode) {
      disableSpatialIsolationMode();
    } else if (spatialNetworkState.selectedNodeId) {
      toggleSpatialIsolationMode(spatialNetworkState.selectedNodeId);
    }
  }

  /**
   * Clear selection and exit focus mode
   */
  function handleClearSelection() {
    disableSpatialIsolationMode();
    selectSpatialNode(null);
  }

  /**
   * Quick select most connected location
   */
  function handleSelectMostConnected() {
    if (!spatialNetworkState.filtered) return;
    
    // Find location with highest degree (most connections)
    const mostConnected = spatialNetworkState.filtered.nodes
      .filter(node => (node.degree || 0) > 0)
      .sort((a, b) => (b.degree || 0) - (a.degree || 0))[0];
    
    if (mostConnected) {
      selectSpatialNode(mostConnected.id);
      toggleSpatialIsolationMode(mostConnected.id);
    }
  }

  /**
   * Quick select location with most articles
   */
  function handleSelectMostArticles() {
    if (!spatialNetworkState.filtered) return;
    
    // Find location with highest article count
    const mostArticles = spatialNetworkState.filtered.nodes
      .sort((a, b) => b.count - a.count)[0];
    
    if (mostArticles) {
      selectSpatialNode(mostArticles.id);
      toggleSpatialIsolationMode(mostArticles.id);
    }
  }

  /**
   * Format number with appropriate units
   */
  function formatCount(count: number): string {
    if (count === 1) return '1 article';
    if (count < 1000) return `${count} articles`;
    return `${(count / 1000).toFixed(1)}k articles`;
  }

  /**
   * Format coordinates for display
   */
  function formatCoordinates(coords: [number, number]): string {
    return `${coords[0].toFixed(4)}°, ${coords[1].toFixed(4)}°`;
  }
</script>

<Card class={variant === 'elevated' ? 'shadow-lg' : variant === 'outline' ? 'border-2' : ''}>
  <CardHeader class={compact ? 'pb-3' : 'pb-4'}>
    <div class="flex items-start justify-between">
      <div class="space-y-1">
        <CardTitle class="flex items-center gap-2 text-lg">
          <Focus class="h-5 w-5" />
          Location Focus
        </CardTitle>
        {#if !compact}
          <CardDescription>
            Search and focus on specific locations in the network
          </CardDescription>
        {/if}
      </div>
      
      <!-- Status indicator -->
      <div class="flex items-center gap-2">
        {#if focusStatus().active}
          <Badge variant="default" class="bg-primary/10 text-primary border-primary/20">
            <Eye class="h-3 w-3 mr-1" />
            Active
          </Badge>
        {:else if selectedNode}
          <Badge variant="secondary">
            <MapPin class="h-3 w-3 mr-1" />
            Selected
          </Badge>
        {:else}
          <Badge variant="outline">
            <EyeOff class="h-3 w-3 mr-1" />
            Inactive
          </Badge>
        {/if}
      </div>
    </div>
  </CardHeader>

  <CardContent class="space-y-4">
    <!-- Location Selector -->
    <div class="space-y-2">
      <label class="text-sm font-medium" for="location-selector">
        Select Location
      </label>
      <SpatialNetworkLocationSelector
        placeholder="Search for a location..."
        variant="outline"
        autoFocus={false}
        showSelectedInfo={false}
        onLocationSelect={handleLocationSelect}
      />
    </div>

    <!-- Focus Controls -->
    {#if selectedNode}
      <div class="space-y-3">
        <Separator />
        
        <!-- Focus Status -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">Focus Mode</span>
            <div class="flex items-center gap-2">
              <Button
                variant={isIsolationMode ? "default" : "outline"}
                size="sm"
                onclick={handleToggleFocus}
                disabled={!canEnableIsolation && !isIsolationMode}
              >
                {#if isIsolationMode}
                  <EyeOff class="h-4 w-4 mr-2" />
                  Exit Focus
                {:else}
                  <Eye class="h-4 w-4 mr-2" />
                  Enter Focus
                {/if}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onclick={handleClearSelection}
                title="Clear selection"
              >
                <RotateCcw class="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div class="text-sm text-muted-foreground">
            <div class="font-medium">{focusStatus().text}</div>
            <div>{focusStatus().description}</div>
          </div>
        </div>

        <!-- Location Details -->
        {#if showLocationDetails}
          <div class="space-y-2">
            <Separator />
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div class="text-muted-foreground">Articles</div>
                <div class="font-medium">{formatCount(selectedNode.count)}</div>
              </div>
              <div>
                <div class="text-muted-foreground">Connections</div>
                <div class="font-medium">{neighborInfo().count}</div>
              </div>
              <div>
                <div class="text-muted-foreground">Country</div>
                <div class="font-medium">{selectedNode.country}</div>
              </div>
              <div>
                <div class="text-muted-foreground">Coordinates</div>
                <div class="font-mono text-xs">{formatCoordinates(selectedNode.coordinates)}</div>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Quick Actions -->
    {#if showQuickActions && !selectedNode}
      <div class="space-y-2">
        <Separator />
        <div class="space-y-2">
          <span class="text-sm font-medium">Quick Select</span>
          <div class="grid grid-cols-1 gap-2">
            <Button
              variant="outline"
              size="sm"
              onclick={handleSelectMostConnected}
              class="justify-start"
            >
              <Network class="h-4 w-4 mr-2" />
              Most Connected Location
            </Button>
            <Button
              variant="outline"
              size="sm"
              onclick={handleSelectMostArticles}
              class="justify-start"
            >
              <MapPin class="h-4 w-4 mr-2" />
              Location with Most Articles
            </Button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Help Text -->
    {#if !selectedNode && !compact}
      <div class="space-y-2">
        <Separator />
        <div class="text-xs text-muted-foreground space-y-1">
          <p><strong>Focus Mode:</strong> Show only a location and its direct connections</p>
          <p><strong>Search:</strong> Type to find locations by name or country</p>
          <p><strong>Navigation:</strong> Click any location on the map to select it</p>
        </div>
      </div>
    {/if}
  </CardContent>
</Card>

<style>
  /* Ensure proper spacing and alignment */
  :global(.location-focus-card .grid) {
    align-items: start;
  }
  
  /* Improve focus indicators */
  :global(.location-focus-card button:focus-visible) {
    outline: 2px solid hsl(var(--primary));
    outline-offset: 2px;
  }
</style>

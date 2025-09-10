<!--
  SpatialNetworkSidebar.svelte - Controls and information for spatial network visualization
  
  Provides:
  - Country filtering controls
  - Edge weight filtering
  - Network statistics
  - Selected node information
  - Map controls
-->
<script lang="ts">
  import * as Sidebar from '$lib/components/ui/sidebar';
  import { Button } from '$lib/components/ui/button';
  import { Label } from '$lib/components/ui/label';
  import { Badge } from '$lib/components/ui/badge';
  import { Switch } from '$lib/components/ui/switch';
  import SpatialNetworkIsolationControl from './SpatialNetworkIsolationControl.svelte';
  import { 
    spatialNetworkState, 
    setSpatialWeightMin,
    toggleSpatialCountry,
    toggleSpatialIsolatedNodes,
    resetSpatialFilters,
    getSpatialAvailableCountries,
    getSpatialNetworkStats,
    getSpatialSelectedNode,
    getVisibleCountries
  } from '$lib/state/spatialNetworkData.svelte';

  // Props for map interaction
  let {
    onFitToView,
    onResetView,
    onZoomIn,
    onZoomOut,
    selectedNodeId = null
  } = $props<{
    onFitToView?: () => void;
    onResetView?: () => void;
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    selectedNodeId?: string | null;
  }>();

  // Reactive data - use derived state for optimized performance
  const availableCountries = $derived(getSpatialAvailableCountries());
  const networkStats = $derived(getSpatialNetworkStats());
  const selectedNode = $derived(selectedNodeId ? getSpatialSelectedNode() : null);

  // Country colors for consistency with map
  const countryColors: Record<string, string> = {
    'Burkina Faso': '#e74c3c',
    'Côte d\'Ivoire': '#3498db', 
    'Benin': '#2ecc71',
    'Togo': '#f39c12',
    'Mali': '#9b59b6',
    'Ghana': '#1abc9c',
    'Niger': '#34495e',
    'Nigeria': '#e67e22',
  };

  // Event handlers
  function onWeightChange(e: Event) {
    const value = Number((e.target as HTMLInputElement).value);
    if (Number.isFinite(value) && value >= 1) {
      setSpatialWeightMin(value);
    }
  }

  function onCountryToggle(country: string) {
    toggleSpatialCountry(country);
  }

  function onIsolatedNodesToggle() {
    toggleSpatialIsolatedNodes();
  }

  function onResetFilters() {
    resetSpatialFilters();
  }

  function getCountryColor(country: string): string {
    return countryColors[country] || '#95a5a6';
  }

  function formatNumber(num: number): string {
    return new Intl.NumberFormat().format(num);
  }
</script>

<!-- Map Controls -->
<Sidebar.Group>
  <Sidebar.GroupLabel>Map Controls</Sidebar.GroupLabel>
  <Sidebar.GroupContent class="space-y-2">
    <div class="grid grid-cols-2 gap-2">
      <Button variant="outline" size="sm" onclick={onZoomIn} disabled={!onZoomIn}>
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Zoom In
      </Button>
      <Button variant="outline" size="sm" onclick={onZoomOut} disabled={!onZoomOut}>
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
        </svg>
        Zoom Out
      </Button>
    </div>
    <div class="grid grid-cols-1 gap-2">
      <Button variant="outline" size="sm" onclick={onFitToView} disabled={!onFitToView}>
        <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
        Fit to Network
      </Button>
      <Button variant="outline" size="sm" onclick={onResetView} disabled={!onResetView}>
        <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
        Reset View
      </Button>
    </div>
  </Sidebar.GroupContent>
</Sidebar.Group>

<Sidebar.Separator />

<!-- Isolation/Focus Mode -->
<Sidebar.Group>
  <Sidebar.GroupLabel>Focus Mode</Sidebar.GroupLabel>
  <Sidebar.GroupContent class="space-y-3">
    <SpatialNetworkIsolationControl />
    
    <p class="text-xs text-muted-foreground">
      Focus mode shows only the selected location and its direct connections, hiding all other nodes and edges for clearer analysis.
    </p>
  </Sidebar.GroupContent>
</Sidebar.Group>

<Sidebar.Separator />

<!-- Network Filters -->
<Sidebar.Group>
  <Sidebar.GroupLabel>Network Filters</Sidebar.GroupLabel>
  <Sidebar.GroupContent class="space-y-4">
    <div class="space-y-2">
      <Label for="spatialWeightMin" class="text-sm font-medium">
        Minimum connection strength: {spatialNetworkState.weightMin}
      </Label>
      <input
        id="spatialWeightMin"
        type="range"
        min="1"
        max="10"
        step="1"
        value={spatialNetworkState.weightMin}
        oninput={onWeightChange}
        class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
      />
      <p class="text-xs text-muted-foreground">
        Hide weak location connections
      </p>
    </div>

    <div class="flex items-center justify-between">
      <Label for="showIsolated" class="text-sm font-medium">Show isolated locations</Label>
      <Switch 
        id="showIsolated"
        checked={spatialNetworkState.showIsolatedNodes}
        onCheckedChange={onIsolatedNodesToggle}
        aria-label="Toggle showing isolated locations"
      />
    </div>

    <Button variant="outline" size="sm" onclick={onResetFilters} class="w-full">
      Reset Filters
    </Button>
  </Sidebar.GroupContent>
</Sidebar.Group>

<Sidebar.Separator />

<!-- Country Filters -->
<Sidebar.Group>
  <Sidebar.GroupLabel>Countries</Sidebar.GroupLabel>
  <Sidebar.GroupContent class="space-y-2">
    {#each availableCountries as country}
      {@const isVisible = getVisibleCountries().has(country)}
      {@const color = getCountryColor(country)}
      {@const countryStats = networkStats?.countries[country] || 0}
      
      <button
        class="flex items-center justify-between w-full px-3 py-2 text-sm rounded-md border transition-colors {isVisible ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'}"
        onclick={() => onCountryToggle(country)}
      >
        <div class="flex items-center gap-2">
          <div 
            class="w-3 h-3 rounded-full border border-background"
            style="background-color: {color};"
          ></div>
          <span class="font-medium">{country}</span>
        </div>
        <Badge variant="secondary" class="text-xs">
          {countryStats}
        </Badge>
      </button>
    {/each}
  </Sidebar.GroupContent>
</Sidebar.Group>

<!-- Selected Location -->
{#if selectedNode}
  <Sidebar.Separator />

  <Sidebar.Group>
    <Sidebar.GroupLabel>Selected Location</Sidebar.GroupLabel>
    <Sidebar.GroupContent>
      <div class="space-y-3 p-3 bg-accent/20 rounded-md border">
        <div class="flex items-start justify-between">
          <div>
            <h4 class="font-medium text-sm">{selectedNode.label}</h4>
            <p class="text-xs text-muted-foreground mt-1">
              {selectedNode.country || 'Unknown country'}
            </p>
          </div>
          <div 
            class="w-4 h-4 rounded-full border border-background"
            style="background-color: {getCountryColor(selectedNode.country)};"
          ></div>
        </div>
        
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span class="text-muted-foreground">Articles:</span>
            <div class="font-medium">{formatNumber(selectedNode.count)}</div>
          </div>
          <div>
            <span class="text-muted-foreground">Connections:</span>
            <div class="font-medium">{selectedNode.degree || 0}</div>
          </div>
        </div>
        
        <div class="text-xs">
          <span class="text-muted-foreground">Coordinates:</span>
          <div class="font-mono text-xs">
            {selectedNode.coordinates[0].toFixed(4)}°, {selectedNode.coordinates[1].toFixed(4)}°
          </div>
        </div>
      </div>
    </Sidebar.GroupContent>
  </Sidebar.Group>
{/if}

<Sidebar.Separator />

<!-- Statistics -->
<Sidebar.Group>
  <Sidebar.GroupLabel>Network Statistics</Sidebar.GroupLabel>
  <Sidebar.GroupContent>
    {#if networkStats}
      <div class="space-y-2 text-xs text-muted-foreground">
        <div class="grid grid-cols-2 gap-2">
          <div>Locations: <span class="font-medium text-foreground">{formatNumber(networkStats.totalNodes)}</span></div>
          <div>Connections: <span class="font-medium text-foreground">{formatNumber(networkStats.totalEdges)}</span></div>
          <div>Articles: <span class="font-medium text-foreground">{formatNumber(networkStats.totalArticles)}</span></div>
          <div>Countries: <span class="font-medium text-foreground">{networkStats.countryCount}</span></div>
        </div>
        
        {#if networkStats.edgeWeights}
          <div class="pt-2 border-t">
            <div class="text-xs font-medium mb-1">Connection Weights:</div>
            <div class="grid grid-cols-3 gap-1 text-xs">
              <div>Min: <span class="font-medium">{networkStats.edgeWeights.min}</span></div>
              <div>Avg: <span class="font-medium">{networkStats.edgeWeights.avg.toFixed(1)}</span></div>
              <div>Max: <span class="font-medium">{networkStats.edgeWeights.max}</span></div>
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <div class="text-xs text-muted-foreground">
        No network data available
      </div>
    {/if}
  </Sidebar.GroupContent>
</Sidebar.Group>

{#if spatialNetworkState.isLoading}
  <Sidebar.Separator />
  
  <Sidebar.Group>
    <Sidebar.GroupContent>
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        <div class="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
        Loading spatial network...
      </div>
    </Sidebar.GroupContent>
  </Sidebar.Group>
{/if}

{#if spatialNetworkState.error}
  <Sidebar.Separator />
  
  <Sidebar.Group>
    <Sidebar.GroupContent>
      <div class="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
        <div class="text-sm font-medium text-destructive mb-1">Error</div>
        <div class="text-xs text-destructive/80">{spatialNetworkState.error}</div>
      </div>
    </Sidebar.GroupContent>
  </Sidebar.Group>
{/if}

<script lang="ts">
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Label } from '$lib/components/ui/label';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { networkState, applyFilters } from '$lib/state/networkData.svelte';
  import { appState } from '$lib/state/appState.svelte';
  import { NetworkInteractionHandler } from './modules/NetworkInteractionHandler';
  import NetworkSearchBar from './NetworkSearchBar.svelte';

  // Props for network highlighting functions
  let {
    highlightNodes,
    clearHighlight,
    focusOnNode
  } = $props<{
    highlightNodes?: (nodeIds: string[]) => void;
    clearHighlight?: () => void;
    focusOnNode?: (nodeId: string) => void;
  }>();

  // Reactive stats
  const stats = $derived.by(() => {
    if (!networkState.filtered) {
      return { nodes: 0, edges: 0, types: {} as Record<string, number>, totalArticles: 0, avgArticles: 0 };
    }
    const nodeStats = NetworkInteractionHandler.getNodeStatistics(networkState.filtered.nodes);
    return {
      nodes: networkState.filtered.nodes.length,
      edges: networkState.filtered.edges.length,
      types: nodeStats.typeDistribution,
      totalArticles: nodeStats.totalCount,
      avgArticles: Math.round(nodeStats.averageCount)
    };
  });

  const availableTypes = $derived.by(() => {
    if (!networkState.data) return [] as string[];
    return NetworkInteractionHandler.getAvailableTypes(networkState.data.nodes);
  });

  // Event handlers
  function onWeightChange(e: Event) {
    const value = Number((e.target as HTMLInputElement).value);
    if (Number.isFinite(value) && value >= 1) {
      networkState.weightMin = value;
      applyFilters();
    }
  }

  function onDegreeCapChange(e: Event) {
    const value = Number((e.target as HTMLInputElement).value);
    networkState.degreeCap = Number.isFinite(value) && value > 0 ? value : undefined;
    applyFilters();
  }

  function toggleType(type: string) {
    if (!(type in networkState.typesEnabled)) {
      networkState.typesEnabled[type] = true;
    }
    networkState.typesEnabled[type] = !networkState.typesEnabled[type];
    applyFilters();
  }

  function resetFilters() {
    networkState.weightMin = 2;
    networkState.degreeCap = undefined;
    Object.keys(networkState.typesEnabled).forEach((t) => {
      networkState.typesEnabled[t] = true;
    });
    applyFilters();
  }

  function clearSelection() {
    NetworkInteractionHandler.handleNodeSelection(null);
  }

  function toggleRenderer() {
    appState.networkRenderer = appState.networkRenderer === 'sigma' ? 'modular' : 'sigma';
  }

  // Node type colors
  const typeColors: Record<string, string> = {
    person: '#2563eb',
    organization: '#7c3aed',
    event: '#059669',
    subject: '#d97706',
    location: '#ef4444',
  };

  const typeLabels: Record<string, string> = {
    person: 'Persons',
    organization: 'Organizations',
    event: 'Events',
    subject: 'Subjects',
    location: 'Locations',
  };
</script>

<Card class="w-full h-full">
  <CardHeader>
    <CardTitle class="flex items-center justify-between">
      <span>Network Controls</span>
      <div class="flex items-center gap-2">
        {#if appState.networkLoaded}
          <Badge variant="secondary" class="text-xs">
            {stats.nodes} nodes
          </Badge>
        {/if}
        <!-- Renderer Toggle -->
        <button 
          onclick={toggleRenderer}
          title="Switch renderer: {appState.networkRenderer === 'sigma' ? 'Sigma.js (WebGL)' : 'Custom (Canvas2D)'}"
          class="h-6 px-2 text-xs rounded-md border bg-background hover:bg-accent transition-colors"
        >
          {appState.networkRenderer === 'sigma' ? '🚀' : '🎨'}
        </button>
      </div>
    </CardTitle>
  </CardHeader>
  <CardContent class="space-y-6">
    
    <!-- Renderer Info -->
    <div class="text-xs text-muted-foreground bg-accent/20 rounded-md p-3 border">
      <div class="font-medium text-foreground mb-1">
        Active Renderer: {appState.networkRenderer === 'sigma' ? 'Sigma.js (WebGL)' : 'Custom (Canvas2D)'}
      </div>
      <div>
        {appState.networkRenderer === 'sigma' 
          ? 'Hardware-accelerated with ForceAtlas2 layout'
          : 'Custom Canvas2D with D3 force simulation'
        }
      </div>
    </div>
    
    <!-- Node Search -->
    <div class="space-y-2">
      <Label class="text-sm font-medium">Search Nodes</Label>
      <NetworkSearchBar
        placeholder="Search by name or ID..."
        onHighlight={highlightNodes}
        onClearHighlight={clearHighlight}
        onNodeSelect={(node: import('$lib/types').NetworkNode) => {
          if (focusOnNode) {
            focusOnNode(node.id);
          }
        }}
      />
    </div>
    
    <!-- Filter Controls -->
    <div class="space-y-4">
      <div class="space-y-2">
        <Label for="weightMin" class="text-sm font-medium">
          Minimum edge weight
        </Label>
        <input
          id="weightMin"
          type="number"
          min="1"
          step="1"
          value={networkState.weightMin}
          onchange={onWeightChange}
          class="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <p class="text-xs text-muted-foreground">
          Hide edges with weight below this threshold
        </p>
      </div>

      <div class="space-y-2">
        <Label for="degreeCap" class="text-sm font-medium">
          Node degree limit (optional)
        </Label>
        <input
          id="degreeCap"
          type="number"
          min="1"
          step="1"
          value={networkState.degreeCap ?? ''}
          onchange={onDegreeCapChange}
          placeholder="No limit"
          class="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <p class="text-xs text-muted-foreground">
          Hide nodes with more connections than this
        </p>
      </div>
    </div>

    <!-- Node Types -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <Label class="text-sm font-medium">Entity types</Label>
        <button
          type="button"
          onclick={resetFilters}
          class="h-6 px-2 text-xs rounded-md border bg-background hover:bg-accent transition-colors"
        >
          Reset
        </button>
      </div>
      
      <div class="grid grid-cols-1 gap-2">
        {#each availableTypes as type}
          {@const isEnabled = networkState.typesEnabled[type] ?? true}
          {@const count = (stats.types as Record<string, number>)[type] ?? 0}
          {@const color = typeColors[type] ?? '#6b7280'}
          {@const label = typeLabels[type] ?? type}
          
          <label class="flex items-center justify-between gap-3 cursor-pointer hover:bg-accent/50 rounded px-2 py-1 transition-colors">
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isEnabled}
                onchange={() => toggleType(type)}
                class="rounded border-border"
              />
              <div class="flex items-center gap-2">
                <div
                  class="w-3 h-3 rounded-full flex-shrink-0"
                  style="background-color: {color}"
                ></div>
                <span class="text-sm capitalize">{label}</span>
              </div>
            </div>
            <Badge variant="outline" class="text-xs">
              {count}
            </Badge>
          </label>
        {/each}
      </div>
    </div>

    <!-- Current Selection -->
    {#if appState.networkNodeSelected}
      <div class="space-y-2 p-3 bg-accent/20 rounded-md border">
        <div class="flex items-center justify-between">
          <Label class="text-sm font-medium">Selected Node</Label>
          <button
            type="button"
            onclick={clearSelection}
            class="h-6 px-2 text-xs rounded-md border bg-background hover:bg-accent transition-colors"
          >
            Clear
          </button>
        </div>
        <div class="text-sm text-muted-foreground">
          <div class="font-mono text-xs break-all">
            {appState.networkNodeSelected.id}
          </div>
          {#if appState.selectedEntity}
            <div class="mt-1">
              <Badge variant="secondary" class="text-xs">
                {appState.selectedEntity.type}
              </Badge>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Network Statistics -->
    <div class="space-y-2 text-xs text-muted-foreground border-t pt-4">
      <div class="font-medium text-foreground">Network Statistics</div>
      <div class="grid grid-cols-2 gap-2">
        <div>Visible nodes: <span class="font-medium">{stats.nodes}</span></div>
        <div>Visible edges: <span class="font-medium">{stats.edges}</span></div>
        <div>Total articles: <span class="font-medium">{stats.totalArticles}</span></div>
        <div>Avg per node: <span class="font-medium">{stats.avgArticles}</span></div>
      </div>
      
      {#if appState.networkNodeSelected}
        <div class="mt-2 pt-2 border-t">
          <div class="text-xs">
            <span class="font-medium">Focus mode:</span> Selected node + neighbors
          </div>
        </div>
      {/if}
    </div>

    <!-- Instructions -->
    <div class="space-y-2 text-xs text-muted-foreground border-t pt-4">
      <div class="font-medium text-foreground">Keyboard Shortcuts</div>
      <div class="space-y-1">
        <div><kbd class="px-1 py-0.5 bg-muted rounded text-xs">F</kbd> Fit to view</div>
        <div><kbd class="px-1 py-0.5 bg-muted rounded text-xs">R</kbd> Run layout</div>
        <div><kbd class="px-1 py-0.5 bg-muted rounded text-xs">C</kbd> Center on selection</div>
        <div><kbd class="px-1 py-0.5 bg-muted rounded text-xs">Esc</kbd> Clear selection</div>
      </div>
    </div>
  </CardContent>
</Card>

<style>
  kbd {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
  }
</style>

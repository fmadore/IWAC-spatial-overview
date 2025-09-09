<!--
  SpatialNetworkMap.svelte - Leaflet map with Sigma.js network overlay using @sigma/layer-leaflet
  
  Combines geographic visualization with network relationships:
  - Leaflet map for geographic context
  - Sigma.js overlay using proper Leaflet layer integration
  - Interactive node selection and highlighting
  - Responsive design with proper layer management
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { SpatialNetworkData, SpatialNetworkNode, SpatialNetworkEdge } from '$lib/types';
  import { spatialNetworkState } from '$lib/state/spatialNetworkData.svelte';

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

  // DOM elements
  let mapContainer: HTMLDivElement = $state() as HTMLDivElement;

  // Library instances (lazy loaded)
  let L: any = null;
  let Sigma: any = null;
  let Graph: any = null;
  let LeafletLayer: any = null;

  // Component instances
  let leafletMap: any = null;
  let sigmaLayer: any = null;
  let sigmaInstance: any = null;
  let graph: any = null;

  // State
  let isInitialized = $state(false);
  let error = $state<string | null>(null);
  let isMapReady = $state(false);

  // Reactive data
  const currentData = $derived(data ?? spatialNetworkState.filtered);

  /**
   * Initialize libraries and map
   */
  onMount(async () => {
    try {
      // Load required libraries
      const [leafletModule, sigmaModule, graphModule, layerModule] = await Promise.all([
        import('leaflet'),
        import('sigma'),
        import('graphology'),
        import('@sigma/layer-leaflet')
      ]);

      L = leafletModule.default || leafletModule;
      Sigma = sigmaModule.Sigma;
      Graph = graphModule.Graph;
      LeafletLayer = layerModule.default || layerModule.bindLeafletLayer || layerModule;

      // Initialize map
      await initializeMap();
      
    } catch (err) {
      console.error('Failed to initialize spatial network map:', err);
      error = 'Failed to load mapping libraries';
    }
  });

  /**
   * Initialize Leaflet map
   */
  async function initializeMap() {
    if (!L || !mapContainer) return;

    try {
      // Create Leaflet map
      leafletMap = L.map(mapContainer, {
        center: [8.0, -1.0], // Center on West Africa
        zoom: 6,
        zoomControl: true,
        attributionControl: true
      });

      // Add base tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
      }).addTo(leafletMap);

      isMapReady = true;

      // Initialize Sigma layer after map is ready
      if (currentData) {
        await initializeSigmaLayer();
      }

    } catch (err) {
      console.error('Error initializing Leaflet map:', err);
      error = 'Failed to initialize map';
    }
  }

  /**
   * Initialize Sigma.js layer using @sigma/layer-leaflet
   */
  async function initializeSigmaLayer() {
    if (!L || !Sigma || !Graph || !LeafletLayer || !leafletMap || !currentData) return;

    try {
      // Create graph
      graph = new Graph();

      // Add nodes to graph with lat/lng coordinates
      currentData.nodes.forEach((node: SpatialNetworkNode) => {
        graph.addNode(node.id, {
          label: node.label,
          size: Math.max(4, Math.min(20, node.count || 8)),
          color: node.type === 'location' ? '#e74c3c' : '#3498db',
          x: 0, // Will be updated by layer
          y: 0, // Will be updated by layer
          lat: node.coordinates[0], // latitude
          lng: node.coordinates[1], // longitude
          originalData: node
        });
      });

      // Add edges to graph
      currentData.edges.forEach((edge: SpatialNetworkEdge) => {
        if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
          graph.addEdge(edge.source, edge.target, {
            weight: edge.weight || 1,
            color: '#34495e',
            size: Math.max(0.5, Math.min(4, (edge.weight || 1) * 0.5))
          });
        }
      });

      // Create a container for Sigma
      const sigmaContainer = document.createElement('div');
      sigmaContainer.style.position = 'absolute';
      sigmaContainer.style.top = '0';
      sigmaContainer.style.left = '0';
      sigmaContainer.style.width = '100%';
      sigmaContainer.style.height = '100%';
      sigmaContainer.style.pointerEvents = 'none';
      mapContainer.appendChild(sigmaContainer);

      // Create Sigma instance
      sigmaInstance = new Sigma(graph, sigmaContainer, {
        // Sigma renderer settings
        backgroundColor: 'transparent',
        enableCameraControls: false, // Let Leaflet handle panning/zooming
        
        // Node rendering
        defaultNodeColor: '#e74c3c',
        defaultNodeSize: 8,
        minNodeSize: 4,
        maxNodeSize: 20,
        
        // Edge rendering  
        defaultEdgeColor: '#34495e',
        defaultEdgeWidth: 1,
        minEdgeWidth: 0.5,
        maxEdgeWidth: 4,
        
        // Labels
        labelFont: 'Inter, sans-serif',
        labelSize: 12,
        labelWeight: 500,
        labelColor: { color: '#2c3e50' },
        labelDensity: 0.1,
        
        // Performance
        hideEdgesOnMove: true,
        hideLabelsOnMove: true,
      });

      // Bind Leaflet layer to Sigma using the correct API
      sigmaLayer = LeafletLayer(sigmaInstance);

      // Set up event listeners
      setupEventListeners(sigmaInstance);

      isInitialized = true;
      console.log('✅ Spatial network initialized with', currentData.nodes.length, 'nodes and', currentData.edges.length, 'edges');

    } catch (err) {
      console.error('Error initializing Sigma layer:', err);
      error = 'Failed to initialize network visualization';
    }
  }
  /**
   * Set up event listeners for interactions
   */
  function setupEventListeners(sigmaInstance: any) {
    if (!sigmaInstance) return;

    // Node click events
    sigmaInstance.on('clickNode', (event: any) => {
      const nodeId = event.node;
      const nodeData = graph?.getNodeAttributes(nodeId)?.originalData;
      
      if (nodeData && onNodeSelect) {
        onNodeSelect(nodeData);
      }
    });

    // Node hover events
    sigmaInstance.on('enterNode', (event: any) => {
      const nodeId = event.node;
      const nodeData = graph?.getNodeAttributes(nodeId)?.originalData;
      
      if (nodeData && onNodeHover) {
        onNodeHover(nodeData);
      }
    });

    sigmaInstance.on('leaveNode', () => {
      if (onNodeHover) {
        onNodeHover(null);
      }
    });

    // Background click to deselect
    sigmaInstance.on('clickStage', () => {
      if (onNodeSelect) {
        onNodeSelect(null);
      }
    });
  }

  /**
   * Update network data when props change
   */
  $effect(() => {
    if (currentData && isMapReady && !isInitialized) {
      initializeSigmaLayer();
    }
  });

  /**
   * Update node highlighting
   */
  $effect(() => {
    if (!graph || !sigmaInstance) return;

    // Reset all nodes to default appearance
    graph.forEachNode((nodeId: string) => {
      graph.setNodeAttribute(nodeId, 'highlighted', false);
    });

    // Highlight selected node
    if (spatialNetworkState.selectedNodeId && graph.hasNode(spatialNetworkState.selectedNodeId)) {
      graph.setNodeAttribute(spatialNetworkState.selectedNodeId, 'highlighted', true);
      graph.setNodeAttribute(spatialNetworkState.selectedNodeId, 'color', '#f39c12');
    }

    // Highlight hovered nodes
    spatialNetworkState.highlightedNodeIds.forEach((nodeId: string) => {
      if (graph.hasNode(nodeId)) {
        graph.setNodeAttribute(nodeId, 'highlighted', true);
        graph.setNodeAttribute(nodeId, 'color', '#e67e22');
      }
    });

    // Refresh Sigma to apply changes
    sigmaInstance.refresh();
  });

  /**
   * Cleanup on component destroy
   */
  onDestroy(() => {
    if (sigmaLayer) {
      try {
        sigmaLayer(); // Call cleanup function returned by bindLeafletLayer
      } catch (err) {
        console.warn('Error removing Sigma layer:', err);
      }
    }
    
    if (sigmaInstance) {
      try {
        sigmaInstance.kill();
      } catch (err) {
        console.warn('Error destroying Sigma instance:', err);
      }
    }
    
    if (leafletMap) {
      try {
        leafletMap.remove();
      } catch (err) {
        console.warn('Error removing Leaflet map:', err);
      }
    }
  });
</script>

<!-- Map container -->
<div class="relative w-full overflow-hidden rounded-lg border border-border bg-card">
  {#if error}
    <div class="flex h-96 items-center justify-center">
      <div class="rounded-lg bg-destructive/10 p-4 text-destructive">
        <p class="font-medium">Error loading spatial network</p>
        <p class="text-sm text-muted-foreground">{error}</p>
      </div>
    </div>
  {:else}
    <!-- Map container -->
    <div 
      bind:this={mapContainer}
      class="w-full"
      style="height: {height};"
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
  /* Ensure proper map container styling */
  :global(.leaflet-container) {
    background: transparent;
    outline: none;
  }
  
  :global(.leaflet-control-attribution) {
    background: rgba(255, 255, 255, 0.8) !important;
    font-size: 10px !important;
  }
</style>

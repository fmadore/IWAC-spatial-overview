<script lang="ts">
  import { onMount } from 'svelte';
  import type { NetworkData } from '$lib/types';
  import { networkState } from '$lib/state/networkData.svelte';
  import { appState } from '$lib/state/appState.svelte';
  import { NetworkInteractionHandler } from './modules/NetworkInteractionHandler';

  // Props - same interface as ModularNetworkGraph
  let { data = null } = $props<{ data?: NetworkData | null }>();

  // DOM elements
  let container: HTMLDivElement;

  // Sigma instances (lazy loaded)
  let Sigma: any = null;
  let Graph: any = null;
  let ForceAtlas2: any = null;
  let NodeBorderProgram: any = null;
  let NodeSquareProgram: any = null;

  // Component instances
  let sigmaInstance: any = null;
  let graph: any = null;

  // Component state
  let isLayoutRunning = $state(false);
  let layoutProgress = $state(0);
  let error = $state<string | null>(null);
  let isInitialized = $state(false);

  // Reactive data
  const currentData = $derived(data ?? networkState.filtered ?? networkState.data);

  // Enhanced color palette with better contrast and visual hierarchy
  const nodeColors = {
    person: '#3b82f6',        // Blue - individuals
    organization: '#8b5cf6',  // Purple - institutions  
    event: '#10b981',         // Green - events/actions
    subject: '#f59e0b',       // Amber - topics/themes
    location: '#ef4444',      // Red - places
  };

  // Node type configurations for different visual styles
  const nodeTypeConfig = {
    person: { shape: 'circle', border: true, borderColor: '#1e40af' },
    organization: { shape: 'square', border: true, borderColor: '#6d28d9' },
    event: { shape: 'circle', border: true, borderColor: '#047857' },
    subject: { shape: 'circle', border: false, borderColor: '#d97706' },
    location: { shape: 'circle', border: true, borderColor: '#dc2626' },
  };

  // Lazy load sigma.js modules
  async function loadSigmaModules() {
    try {
      const [sigmaModule, graphModule, fa2Module, borderModule, squareModule] = await Promise.all([
        import('sigma'),
        import('graphology'),
        import('graphology-layout-forceatlas2'),
        import('@sigma/node-border'),
        import('@sigma/node-square')
      ]);
      
      Sigma = sigmaModule.default;
      Graph = graphModule.default;
      ForceAtlas2 = fa2Module.default;
      NodeBorderProgram = borderModule.NodeBorderProgram;
      NodeSquareProgram = squareModule.NodeSquareProgram;
      
      return true;
    } catch (err) {
      console.error('Failed to load sigma.js modules:', err);
      error = `Failed to load sigma.js: ${err instanceof Error ? err.message : 'Unknown error'}`;
      return false;
    }
  }

  // Convert NetworkData to graphology format
  function buildGraphologyGraph(networkData: NetworkData) {
    if (!Graph) return null;

    const newGraph = new Graph();

    // Calculate node size range for normalization
    const counts = networkData.nodes.map(n => n.count);
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);
    const countRange = maxCount - minCount || 1;

      // Add nodes with enhanced styling and radial seeding (no square)
      const TWO_PI = Math.PI * 2;
      const SEED_RADIUS = 500;
      networkData.nodes.forEach(node => {
        const nodeType = node.id.split(':')[0] || 'unknown';
        const typeConfig = nodeTypeConfig[nodeType as keyof typeof nodeTypeConfig] || nodeTypeConfig.subject;
        const baseColor = nodeColors[nodeType as keyof typeof nodeColors] || '#6b7280';
        
        // Enhanced size calculation with better scaling
        const normalizedCount = (node.count - minCount) / countRange;
        const baseSize = 8 + (30 - 8) * normalizedCount; // 8-30 size range for better visibility

        // Radial initial position (uniform in disc)
        const theta = Math.random() * TWO_PI;
        const r = Math.sqrt(Math.random()) * SEED_RADIUS;
        const seedX = r * Math.cos(theta);
        const seedY = r * Math.sin(theta);
        
        // Determine node type for rendering
        let renderType = undefined; // Use default for circles
        if (typeConfig.shape === 'square') {
          renderType = 'square';
        } else if (typeConfig.border) {
          renderType = 'border';
        }

        newGraph.addNode(node.id, {
          label: node.label,
          x: seedX,
          y: seedY,
          size: baseSize,
          color: baseColor,
          ...(renderType && { type: renderType }), // Only set type if we have a custom one
          entityType: nodeType,
          count: node.count,
          degree: node.degree || 0,
          // Border properties for bordered nodes
          borderColor: typeConfig.borderColor,
          borderSize: typeConfig.border ? 2 : 0,
          // Visual hierarchy
          zIndex: nodeType === 'location' ? 2 : 1, // Locations on top
        });
      });    // Add edges with enhanced styling
    networkData.edges.forEach(edge => {
      if (newGraph.hasNode(edge.source) && newGraph.hasNode(edge.target)) {
        // Enhanced edge thickness calculation
        const thickness = Math.max(1, Math.min(8, edge.weight * 0.8));
        
        newGraph.addEdge(edge.source, edge.target, {
          weight: edge.weight,
          size: thickness,
          color: '#94a3b8', // Neutral gray-blue
          alpha: 0.6, // Semi-transparent
          type: 'line'
        });
      }
    });

    return newGraph;
  }

  // Initialize sigma.js instance
  async function initializeSigma() {
    if (!container || !currentData || !Sigma || !Graph) return;

    try {
      // Create graph
      graph = buildGraphologyGraph(currentData);
      if (!graph) {
        error = 'Failed to create graph from data';
        return;
      }

    // Create sigma instance with enhanced settings (minimal overlay footprint)
      sigmaInstance = new Sigma(graph, container, {
        // Node programs for different shapes
        nodeProgramClasses: {
      // Use default program for circles
      square: NodeSquareProgram,
      border: NodeBorderProgram,
        },
        
        // Enhanced rendering settings
        renderLabels: true,
        renderEdges: true,
        enableEdgeHoverEvents: 'debounce',
        
        // Improved label settings
        labelFont: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        labelSize: 12,
        labelWeight: '500',
        labelColor: { color: '#1f2937' },
  labelDensity: 0.06, // Show more labels
  labelGridCellSize: 90,
  labelRenderedSizeThreshold: 8, // Avoid too many small labels
        
        // Enhanced size settings with better scaling
  minNodeSize: 5,
  maxNodeSize: 30,
        minEdgeSize: 1,
        maxEdgeSize: 8,
        
        // Edge appearance
        defaultEdgeType: 'line',
        defaultEdgeColor: '#e2e8f0',
        edgeColor: 'default',
        
        // Performance optimizations for large graphs
  batchEdgesDrawing: currentData.edges.length > 500,
  hideEdgesOnMove: currentData.edges.length > 1200,
  hideLabelsOnMove: currentData.nodes.length > 400,
        
        // Enhanced hover effects
        enableHovering: true,
        nodeHoverColor: 'node',
        defaultNodeHoverColor: '#000000',
        labelHoverShadow: 'node',
        labelHoverShadowColor: '#ffffff',
        labelHoverBGColor: 'node',
        defaultHoverLabelBGColor: 'rgba(255, 255, 255, 0.8)',
        labelHoverColor: 'default',
        defaultLabelHoverColor: '#000000',
        
        // Camera and interaction
        allowInvalidContainer: false,
        autoRescale: true,
        enableCamera: true,
        
        // WebGL optimizations
        webglOversamplingRatio: window.devicePixelRatio || 1,
      });

  // Set up event listeners
      setupSigmaEvents();

      isInitialized = true;
      error = null;

  // Warm-up layout once to avoid initial square cloud
  runLayout();

    } catch (err) {
      error = `Failed to initialize sigma.js: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error('❌ Sigma initialization error:', err);
    }
  }

  // Set up sigma.js event listeners
  function setupSigmaEvents() {
    if (!sigmaInstance) return;

    // Node click
    sigmaInstance.on('clickNode', ({ node }: { node: string }) => {
      const nodeData = currentData?.nodes.find((n: any) => n.id === node);
      if (nodeData) {
        NetworkInteractionHandler.handleNodeSelection(nodeData);
      }
    });

    // Click on stage (background) to clear selection
    sigmaInstance.on('clickStage', () => {
      NetworkInteractionHandler.handleNodeSelection(null);
    });

    // Node hover
    sigmaInstance.on('enterNode', ({ node }: { node: string }) => {
      const nodeData = currentData?.nodes.find((n: any) => n.id === node);
      if (nodeData) {
        NetworkInteractionHandler.handleNodeHover(nodeData);
      }
    });

    sigmaInstance.on('leaveNode', () => {
      NetworkInteractionHandler.handleNodeHover(null);
    });

  // (Edge hover disabled to reduce noise)
  }

  // Run ForceAtlas2 layout
  async function runLayout() {
    if (!graph || !ForceAtlas2 || isLayoutRunning) return;

    isLayoutRunning = true;
    layoutProgress = 0;

    try {
      // Enhanced ForceAtlas2 layout with better parameters
  const totalIterations = graph.order > 1000 ? 600 : graph.order > 500 ? 450 : 300;
      let currentIteration = 0;

      // Prepare settings once per run; adapt to graph size
      const settings = {
        barnesHutOptimize: graph.order > 400,
        strongGravityMode: false,
        gravity: graph.order > 1000 ? 0.02 : 0.04,
        scalingRatio: graph.order > 1000 ? 18 : 12,
        slowDown: 1.1,
        linLogMode: false,
        outboundAttractionDistribution: graph.order > 200,
        adjustSizes: true, // Account for node sizes
        edgeWeightInfluence: 1.0,
        barnesHutTheta: 0.5
      } as any;

      const runStep = () => {
        if (currentIteration < totalIterations && isLayoutRunning) {
          // Adaptive batch size based on graph size
          const batchSize = graph.order > 2000 ? 4 : graph.order > 1000 ? 6 : graph.order > 500 ? 10 : 14;
          
          for (let i = 0; i < batchSize && currentIteration < totalIterations; i++) {
            // Each assign call performs the requested number of iterations (1 here)
            ForceAtlas2.assign(graph, { iterations: 1, settings });
            currentIteration++;
          }

          layoutProgress = Math.round((currentIteration / totalIterations) * 100);
          
          // Refresh sigma with throttling for performance
          if (sigmaInstance && currentIteration % 4 === 0) {
            sigmaInstance.refresh();
          }

          // Continue if not finished
          if (currentIteration < totalIterations) {
            requestAnimationFrame(runStep);
          } else {
            finishLayout();
          }
        } else {
          finishLayout();
        }
      };

      const finishLayout = () => {
        isLayoutRunning = false;
        layoutProgress = 0;
        if (sigmaInstance) {
          sigmaInstance.refresh();
          fitToView();
        }
      };

      // Start the layout
      runStep();

    } catch (err) {
      error = `Layout failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error('Layout error:', err);
      isLayoutRunning = false;
      layoutProgress = 0;
    }
  }

  // Stop layout
  function stopLayout() {
    isLayoutRunning = false;
  }

  // Enhanced fit graph to view with padding and smooth animation
  function fitToView() {
    if (!sigmaInstance) return;
    
    try {
      const camera = sigmaInstance.getCamera();
      const nodes = graph.nodes();
      if (nodes.length === 0) return;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      // Include node size in bounds calculation for better fitting
      nodes.forEach((nodeId: string) => {
        const attrs = graph.getNodeAttributes(nodeId);
        const nodeSize = attrs.size || 10;
        minX = Math.min(minX, attrs.x - nodeSize);
        minY = Math.min(minY, attrs.y - nodeSize);
        maxX = Math.max(maxX, attrs.x + nodeSize);
        maxY = Math.max(maxY, attrs.y + nodeSize);
      });

      if (isFinite(minX) && isFinite(minY) && isFinite(maxX) && isFinite(maxY)) {
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const spanX = maxX - minX;
        const spanY = maxY - minY;
    const span = Math.max(spanX, spanY) || 100;
        
        // Add padding based on graph size
    const padding = span * 0.2; // 20% padding
        
        camera.animate(
          { 
            x: centerX, 
            y: centerY, 
      ratio: (span + padding) / Math.min(container.clientWidth, container.clientHeight) 
          },
          { duration: 600, easing: 'quadInOut' }
        );
      }
    } catch (err) {
      console.warn('Fit to view failed:', err);
    }
  }

  // Center on selected node
  function centerOnSelectedNode() {
    if (!sigmaInstance || !appState.networkNodeSelected?.id) return;
    
    try {
      const nodeId = appState.networkNodeSelected.id;
      if (graph.hasNode(nodeId)) {
        const nodeAttrs = graph.getNodeAttributes(nodeId);
        const camera = sigmaInstance.getCamera();
        
        camera.animate(
          { x: nodeAttrs.x, y: nodeAttrs.y, ratio: 0.5 },
          { duration: 500 }
        );
      }
    } catch (err) {
      console.warn('Center on node failed:', err);
    }
  }

  // Keyboard shortcuts
  function handleKeyDown(event: KeyboardEvent) {
    if (!sigmaInstance || !currentData) return;

    switch (event.key.toLowerCase()) {
      case 'f':
        event.preventDefault();
        fitToView();
        break;
      case 'r':
        event.preventDefault();
        runLayout();
        break;
      case 'escape':
        event.preventDefault();
        NetworkInteractionHandler.handleNodeSelection(null);
        break;
      case 'c':
        if (appState.networkNodeSelected?.id) {
          event.preventDefault();
          centerOnSelectedNode();
        }
        break;
    }
  }

  // Lifecycle
  onMount(() => {
    // Load sigma.js modules and initialize
    const initializeComponent = async () => {
      const loaded = await loadSigmaModules();
      if (!loaded) return;

      // Initialize when data is available
      if (currentData) {
        await initializeSigma();
      }
    };
    
    initializeComponent();

    return () => {
      if (sigmaInstance) {
        sigmaInstance.kill();
        sigmaInstance = null;
      }
    };
  });

  // Reactive effects
  $effect(() => {
    // Reinitialize when data changes
    const reinitialize = async () => {
      if (currentData && Sigma && Graph && container) {
        if (sigmaInstance) {
          sigmaInstance.kill();
        }
        await initializeSigma();
      }
    };
    reinitialize();
  });

  $effect(() => {
    // Enhanced selection styling with smooth transitions
    if (sigmaInstance && graph) {
      const selectedId = appState.networkNodeSelected?.id;
      
      // Enhanced node reducer with better visual feedback
      sigmaInstance.setSetting('nodeReducer', (nodeKey: string, data: any) => {
        const isSelected = nodeKey === selectedId;
        const hasSelection = selectedId !== null;
        
        // Calculate opacity based on state
        let opacity = 1;
        if (hasSelection && !isSelected) opacity = 0.3;
        
        // Calculate size multiplier
        let sizeMultiplier = 1;
        if (isSelected) sizeMultiplier = 1.8;
        
        // Enhanced color handling
        let nodeColor = data.color;
        if (isSelected) {
          // Brighten selected nodes
          nodeColor = data.entityType === 'person' ? '#1d4ed8' :
                     data.entityType === 'organization' ? '#7c3aed' :
                     data.entityType === 'event' ? '#059669' :
                     data.entityType === 'subject' ? '#d97706' :
                     data.entityType === 'location' ? '#dc2626' : data.color;
        } else if (opacity < 1) {
          // Add transparency for non-highlighted nodes
          nodeColor = data.color + Math.round(opacity * 255).toString(16).padStart(2, '0');
        }
        
        return {
          ...data,
          size: data.size * sizeMultiplier,
          color: nodeColor,
          borderColor: isSelected ? data.borderColor : data.borderColor + '80',
          borderSize: isSelected ? (data.borderSize || 0) + 1 : data.borderSize,
          zIndex: isSelected ? 10 : data.zIndex || 1,
        };
      });
      
      // Enhanced edge reducer for better visual hierarchy
      sigmaInstance.setSetting('edgeReducer', (edgeKey: string, data: any) => {
        const isConnectedToSelected = selectedId && (graph.source(edgeKey) === selectedId || graph.target(edgeKey) === selectedId);
        
        let opacity = 0.6;
        let size = data.size;
        
        if (isConnectedToSelected) {
          opacity = 0.9;
          size = data.size * 1.5;
        } else if (selectedId) {
          opacity = 0.2;
        }
        
        return {
          ...data,
          size: size,
          color: data.color + Math.round(opacity * 255).toString(16).padStart(2, '0'),
          zIndex: isConnectedToSelected ? 5 : 1,
        };
      });
      
      sigmaInstance.refresh();
    }
  });
</script>

<svelte:window on:keydown={handleKeyDown} />

<div
  bind:this={container}
  class="relative w-full h-full rounded-md border bg-background overflow-hidden"
  style="min-height: 500px; width: 100%; height: 100%; display: block;"
>
  <!-- Error display -->
  {#if error}
    <div class="absolute inset-0 flex items-center justify-center p-4 text-center bg-background/80 backdrop-blur">
      <div class="text-destructive">
        <h3 class="font-semibold mb-2">Network Visualization Error</h3>
        <p class="text-sm">{error}</p>
        <button 
          onclick={() => window.location.reload()} 
          class="mt-3 px-3 py-1 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
        >
          Reload Page
        </button>
      </div>
    </div>
  {:else if !isInitialized && !error}
    <!-- Loading indicator -->
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="text-center">
        <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <p class="text-sm text-muted-foreground">Loading network visualization...</p>
      </div>
    </div>
  {:else}
    <!-- Minimal UI: no overlays, the canvas gets full space. Keyboard: F (fit), R (layout), C (center), Esc (clear) -->
    {#if isLayoutRunning}
      <div class="sr-only">Running layout… {layoutProgress}%</div>
    {/if}
  {/if}
</div>

<style>
  /* Ensure the container can properly size sigma.js */
  div {
    position: relative;
  }
</style>

<!--
  SigmaNetworkGraph - Modular network visualization component
  
  Refactored into smaller, focused modules for better maintainability:
  - NetworkGraphBuilder: Pure functions for graph construction
  - SigmaConfigBuilder: Configuration management
  - NetworkEventHandlers: Event handling logic
  - NetworkCamera: Camera controls and animations
  - NetworkLayoutManager: Layout algorithm management
  - NetworkInteractionHandler: Node interaction logic
-->
<script lang="ts">
  import type { NetworkData } from '$lib/types';
  import { networkState } from '$lib/state/networkData.svelte';
  import { appState } from '$lib/state/appState.svelte';
  
  // Import our modular components and utilities
  import { buildGraphologyGraph, validateGraph, getGraphStatistics } from './modules/NetworkGraphBuilder';
  import { buildSigmaConfig } from './modules/SigmaConfigBuilder';
  import { NetworkEventHandlers } from './modules/NetworkEventHandlers';
  import { NetworkCamera } from './modules/NetworkCamera';
  import { NetworkLayoutManager } from './modules/NetworkLayoutManager';

  // Props - same interface as before for compatibility
  let { 
    data = null,
    onHighlightNodes,
    onClearHighlight,
    onFocusNode
  } = $props<{ 
    data?: NetworkData | null;
    onHighlightNodes?: (highlightFn: (nodeIds: string[]) => void) => void;
    onClearHighlight?: (clearFn: () => void) => void;
    onFocusNode?: (focusFn: (nodeId: string) => void) => void;
  }>();

  // DOM elements
  let container: HTMLDivElement;

  // Sigma instances (lazy loaded)
  let Sigma: any = null;
  let Graph: any = null;
  let ForceAtlas2: any = null;
  let Noverlap: any = null;
  let NodeBorderProgram: any = null;
  let NodeSquareProgram: any = null;
  let SigmaUtils: any = null;

  // Component instances
  let sigmaInstance: any = null;
  let graph: any = null;
  let eventHandlers: NetworkEventHandlers | null = null;
  let cameraManager: NetworkCamera | null = null;
  let layoutManager: NetworkLayoutManager | null = null;

  // Component state - using Svelte 5 runes
  let isLayoutRunning = $state(false);
  let layoutProgress = $state(0);
  let error = $state<string | null>(null);
  let isInitialized = $state(false);
  let isInitializing = $state(false);
  let cameraRatio = $state(1);
  let highlightedNodeIds = $state<string[]>([]);
  let highlightedNodeSet = $state.raw(new Set<string>());
  let importantNodeIds = $state.raw(new Set<string>());
  
  // Throttle sigma refresh calls
  let refreshTimeout: number | undefined;

  // Reactive data
  const currentData = $derived(data ?? networkState.filtered ?? networkState.data);

  /**
   * Lazy load all sigma.js modules
   */
  async function loadSigmaModules(): Promise<boolean> {
    try {
      const [sigmaModule, graphModule, fa2Module, noverlapModule, borderModule, squareModule, utilsModule] = await Promise.all([
        import('sigma'),
        import('graphology'),
        import('graphology-layout-forceatlas2'),
        import('graphology-layout-noverlap'),
        import('@sigma/node-border'),
        import('@sigma/node-square'),
        import('@sigma/utils')
      ]);
      
      Sigma = sigmaModule.default;
      Graph = graphModule.default;
      ForceAtlas2 = fa2Module.default;
      Noverlap = noverlapModule.default;
      const borderCandidate: any = borderModule;
      const squareCandidate: any = squareModule;
      NodeBorderProgram = borderCandidate?.NodeBorderProgram ?? borderCandidate?.default ?? borderModule;
      NodeSquareProgram = squareCandidate?.NodeSquareProgram ?? squareCandidate?.default ?? squareModule;
      SigmaUtils = utilsModule;
      if (!NodeBorderProgram || !NodeSquareProgram) {
        console.warn('Sigma custom node programs missing', {
          hasBorder: !!NodeBorderProgram,
          hasSquare: !!NodeSquareProgram,
          borderKeys: Object.keys(borderModule ?? {}),
          squareKeys: Object.keys(squareModule ?? {})
        });
      }
      
      return true;
    } catch (err) {
      console.error('Failed to load sigma.js modules:', err);
      error = `Failed to load sigma.js: ${err instanceof Error ? err.message : 'Unknown error'}`;
      return false;
    }
  }

  /**
   * Initialize sigma.js instance with modular configuration
   */
  async function initializeSigma(): Promise<void> {
    if (!container || !currentData || !Sigma || !Graph || isInitializing) return;

    try {
      isInitializing = true;
      
      // Build graph using our modular graph builder
      graph = buildGraphologyGraph(Graph, currentData);
      if (!graph) {
        error = 'Failed to create graph from data';
        return;
      }

      // If custom node programs are missing, downgrade node types to avoid render crashes
      if (!NodeBorderProgram || !NodeSquareProgram) {
        try {
          graph.forEachNode((nodeId: string, attrs: any) => {
            if (!NodeBorderProgram && attrs.type === 'border') {
              graph.removeNodeAttribute(nodeId, 'type');
            }
            if (!NodeSquareProgram && attrs.type === 'square') {
              graph.removeNodeAttribute(nodeId, 'type');
            }
          });
        } catch (downgradeErr) {
          console.warn('Failed to downgrade node types without custom programs:', downgradeErr);
        }
      }

      // Validate graph structure
      const validation = validateGraph(graph);
      if (!validation.isValid) {
        console.warn('Graph validation warnings:', validation.errors);
      }

      // Log graph statistics
      const stats = getGraphStatistics(graph);
      console.log('📊 Graph statistics:', stats);

      // Build sigma configuration (use appState.networkViz for density/thresholds)
      const config = buildSigmaConfig(currentData, NodeBorderProgram, NodeSquareProgram, highlightedNodeSet, appState);

      // Create sigma instance
      sigmaInstance = new Sigma(graph, container, config);

      // Ensure custom node programs remain registered (guard against downstream overrides)
      try {
        const existingClasses = sigmaInstance.getSetting('nodeProgramClasses') ?? {};
        sigmaInstance.setSetting('nodeProgramClasses', {
          ...existingClasses,
          border: NodeBorderProgram,
          square: NodeSquareProgram
        });
      } catch (setErr) {
        console.warn('Unable to register custom node programs:', setErr);
      }

      // Initialize modular managers (defined below)
      initializeManagers();

      // Precompute a small set of important nodes for label LOD
      importantNodeIds = computeImportantNodes(graph);

      // Set up event handling (defined below)
      setupEventHandlers();

      isInitialized = true;
      error = null;

      // Expose API functions (defined below)
      exposeAPIFunctions();

      // Start initial layout (defined below)
      await startInitialLayout();

      // Track camera state (defined below)
      trackCameraState();

    } catch (err) {
      error = `Failed to initialize sigma.js: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error('❌ Sigma initialization error:', err);
    } finally {
      isInitializing = false;
    }
  }

  /**
   * Initialize all modular managers
   */
  function initializeManagers(): void {
    // Update or create camera manager
    if (cameraManager) {
      cameraManager.updateReferences(sigmaInstance, graph);
    } else {
      cameraManager = new NetworkCamera(sigmaInstance, graph, container, SigmaUtils);
    }

    // Update or create layout manager  
    if (layoutManager) {
      layoutManager.updateReferences(graph, sigmaInstance);
    } else {
      layoutManager = new NetworkLayoutManager(
        ForceAtlas2,
        Noverlap,
        graph,
        sigmaInstance,
        {
          onProgressUpdate: (progress) => {
            isLayoutRunning = progress.isRunning;
            layoutProgress = progress.progress;
          },
          onLayoutComplete: (algorithm) => {
            console.log(`✅ ${algorithm} layout completed`);
            isLayoutRunning = false;
            layoutProgress = 0;
          },
          onLayoutError: (errorMsg) => {
            console.error('❌ Layout error:', errorMsg);
            isLayoutRunning = false;
            layoutProgress = 0;
          },
          onSigmaRefresh: () => {
            if (sigmaInstance) sigmaInstance.refresh();
          }
        }
      );
    }

    // Update or create event handlers
    if (eventHandlers) {
      eventHandlers.updateData(currentData);
    } else {
      eventHandlers = new NetworkEventHandlers({
        onFitView: () => cameraManager?.resetToFullView(),
        onRunLayout: () => layoutManager?.runForceAtlas2(),
        onCenterOnSelected: () => {
          const selectedId = appState.networkNodeSelected?.id;
          if (selectedId) cameraManager?.centerOnNode(selectedId);
        },
        onClearSelection: () => {
          appState.networkNodeSelected = null;
          appState.selectedEntity = null;
        },
        onShowHelp: () => {
          const shortcuts = NetworkEventHandlers.getShortcutsHelp();
          const helpText = [
            '🔧 Network Graph Controls:',
            ...Object.values(shortcuts).map(desc => `• ${desc}`),
            '• Drag nodes with mouse to reposition them',
            '• Click nodes to select, click background to deselect'
          ].join('\n');
          console.log(helpText);
        }
      });
    }
  }

  /**
   * Set up event handling through our modular event handler
   */
  function setupEventHandlers(): void {
    if (!eventHandlers || !sigmaInstance) return;

    eventHandlers.updateData(currentData);
    eventHandlers.setupSigmaEvents(sigmaInstance);
  }

  /**
   * Expose API functions to app state and props
   */
  function exposeAPIFunctions(): void {
    // Expose to app state for sidebar access
    appState.networkHighlightingFunctions = {
      highlightNodes,
      clearHighlight,
      focusOnNode
    };

    // Call props callbacks for backwards compatibility
    if (onHighlightNodes) onHighlightNodes(highlightNodes);
    if (onClearHighlight) onClearHighlight(clearHighlight);
    if (onFocusNode) onFocusNode(focusOnNode);
  }

  /**
   * Start initial layout to avoid square clustering
   */
  async function startInitialLayout(): Promise<void> {
    if (layoutManager && currentData && !isLayoutRunning && !layoutManager.isRunning()) {
      // Run a full sequence by default (FA2 + Noverlap) for readability
      try {
        await layoutManager.runFullLayout();
      } catch (err) {
        console.warn('Initial layout failed:', err);
      }
    }
  }

  /**
   * Track camera state for zoom-aware features
   */
  function trackCameraState(): void {
    try {
      if (!sigmaInstance || !('getCamera' in sigmaInstance)) return;
      const cam = sigmaInstance.getCamera();
      cameraRatio = cam.getState().ratio;
      cam.on('updated', () => {
        cameraRatio = cam.getState().ratio;
      });
    } catch (err) {
      console.warn('Failed to track camera state:', err);
    }
  }

  /**
   * Highlight nodes for search results
   */
  function highlightNodes(nodeIds: string[]): void {
    highlightedNodeIds = [...nodeIds];
    highlightedNodeSet = new Set(nodeIds);
    throttledRefresh();
  }

  /**
   * Clear highlighting and return to full view
   */
  function clearHighlight(): void {
    highlightedNodeIds = [];
    highlightedNodeSet = new Set<string>();
    throttledRefresh();
    
    // Return to full view
    setTimeout(() => cameraManager?.resetToFullView(), 100);
  }

  /**
   * Focus camera on specific node
   */
  function focusOnNode(nodeId: string): void {
    cameraManager?.focusOnNode(nodeId);
  }

  /**
   * Throttled refresh to improve performance
   */
  function throttledRefresh(): void {
    if (refreshTimeout) clearTimeout(refreshTimeout);
    refreshTimeout = setTimeout(() => {
      if (sigmaInstance) sigmaInstance.refresh();
    }, 50);
  }

  /**
   * Compute a small set of important nodes (top degree/count)
   * used to keep a few labels visible at low zoom.
   */
  function computeImportantNodes(g: any): Set<string> {
    try {
      const ids: string[] = g.nodes();
      if (!ids?.length) return new Set();

      const scored = ids.map((id: string) => {
        const a = g.getNodeAttributes(id) || {};
        const d = typeof g.degree === 'function' ? g.degree(id) : (a.degree || 0);
        const c = a.count || 0;
        // Degree is more informative for visibility; count still matters
        const score = d * 2 + c * 0.5 + (a.size || 0) * 0.25;
        return { id, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const k = Math.max(10, Math.min(50, Math.floor(ids.length * 0.05)));
      return new Set(scored.slice(0, k).map(s => s.id));
    } catch (e) {
      return new Set();
    }
  }

  /**
   * Handle keyboard shortcuts via event handler
   */
  function handleKeyDown(event: KeyboardEvent): void {
    eventHandlers?.handleKeyDown(event);
  }

  /**
   * Cleanup function
   */
  function cleanup(): void {
    if (sigmaInstance) {
      sigmaInstance.kill();
      sigmaInstance = null;
    }
    if (layoutManager) {
      layoutManager.stop();
      layoutManager = null;
    }
    if (eventHandlers) {
      eventHandlers.cleanup();
      eventHandlers = null;
    }
    if (appState.networkHighlightingFunctions) {
      appState.networkHighlightingFunctions = null;
    }
    cameraManager = null;
  }

  // Main initialization effect - runs once when component mounts
  $effect(() => {
    let destroyed = false;
    
    const initializeComponent = async () => {
      // Load sigma modules if not already loaded
      if (!Sigma || !Graph) {
        const loaded = await loadSigmaModules();
        if (!loaded || destroyed) return;
      }

      // Initialize sigma if we have data and container
      if (currentData && container && !destroyed) {
        await initializeSigma();
      }
    };
    
    initializeComponent();
    
    return () => {
      destroyed = true;
      cleanup();
    };
  });

  // Separate effect for data changes - only runs when currentData changes
  $effect(() => {
    // Only reinitialize if we already have a sigma instance and the data actually changed
    if (currentData && sigmaInstance && Sigma && Graph && container && isInitialized) {
      // Use a timeout to prevent immediate re-initialization during the same tick
      const timeoutId = setTimeout(async () => {
        // Clean up previous instance quietly
        if (sigmaInstance) {
          sigmaInstance.kill();
          sigmaInstance = null;
        }
        if (layoutManager) {
          layoutManager.stop();
        }
        
        // Re-initialize with new data
        await initializeSigma();
      }, 10);
      
      return () => clearTimeout(timeoutId);
    }
  });

  // Reactive effect for selection styling - use untrack to prevent infinite loops
  $effect(() => {
    if (sigmaInstance && graph) {
      const selectedId = appState.networkNodeSelected?.id;
      
      // Snapshot supported node programs to avoid program-missing crashes
      const nodePrograms = (sigmaInstance.getSetting && sigmaInstance.getSetting('nodeProgramClasses')) || {};
      const supportsBorder = !!nodePrograms.border;
      const supportsSquare = !!nodePrograms.square;

      // Update node reducer for selection styling and label LOD
      sigmaInstance.setSetting('nodeReducer', (nodeKey: string, data: any) => {
        const isSelected = nodeKey === selectedId;
        const hasSelection = selectedId !== null;
        const isHighlighted = highlightedNodeSet.has(nodeKey);
        
        let opacity = 1;
        if (hasSelection && !isSelected) opacity = 0.3;
        
        let sizeMultiplier = 1;
        if (isSelected) sizeMultiplier = 1.8;
        const computedSize = data.size * sizeMultiplier;

        let nodeColor = data.color;
        if (isSelected) {
          nodeColor = '#ff6b35'; // Orange for selected
        } else if (opacity < 1) {
          nodeColor = data.color + '4D'; // Add transparency
        }
        // Label level-of-detail: show only for selected/highlighted/important
        // or when sufficiently zoomed in relative to node size.
        let showLabel = false;
        if (isSelected || isHighlighted || importantNodeIds.has(nodeKey)) {
          showLabel = true;
        } else {
          const r = cameraRatio; // Higher = further out
          let threshold = 999; // default hide when zoomed far out
          if (r <= 0.4) threshold = 8;
          else if (r <= 0.6) threshold = 10;
          else if (r <= 0.9) threshold = 12;
          else if (r <= 1.2) threshold = 14;
          else threshold = 18; // very zoomed out
          const mul = appState.networkViz?.labelThresholdMul ?? 1.0;
          showLabel = computedSize >= threshold * mul;
        }

        // Fallback node type if program is not registered (prevents crashes)
        let type: string | undefined = data.type;
        if (type === 'border' && !supportsBorder) type = undefined;
        if (type === 'square' && !supportsSquare) type = undefined;

        return {
          ...data,
          size: computedSize,
          color: nodeColor,
          zIndex: isSelected ? 10 : data.zIndex || 1,
          label: showLabel ? data.label : '',
          ...(type ? { type } : {})
        };
      });
      
      // Update edge reducer for better visual hierarchy
      sigmaInstance.setSetting('edgeReducer', (edgeKey: string, data: any) => {
        const isConnectedToSelected = selectedId && (
          graph.source(edgeKey) === selectedId || 
          graph.target(edgeKey) === selectedId
        );
        const isConnectedToHighlight = highlightedNodeSet.size > 0 && (
          highlightedNodeSet.has(graph.source(edgeKey)) ||
          highlightedNodeSet.has(graph.target(edgeKey))
        );
        
        // Hide most edges when zoomed out; keep for selected/highlighted/important pairs
        const hideEdgesWhenRatioAbove = appState.networkViz?.edgeHideRatio ?? 1.0;
        const keepImportant =
          importantNodeIds.has(graph.source(edgeKey)) && importantNodeIds.has(graph.target(edgeKey));
        if (!isConnectedToSelected && !isConnectedToHighlight && !keepImportant && cameraRatio > hideEdgesWhenRatioAbove) {
          return { ...data, hidden: true };
        }
        
        let opacity = 0.6;
        let size = data.size;
        
        if (isConnectedToSelected) {
          opacity = 1.0;
          size = data.size * 1.5;
        } else if (selectedId || isConnectedToHighlight) {
          opacity = 0.2;
        }
        
        return {
          ...data,
          size,
          color: data.color + Math.round(opacity * 255).toString(16).padStart(2, '0')
        };
      });
      
      // Use throttledRefresh instead of direct refresh to prevent cascading updates
      throttledRefresh();
    }
  });

  // Effect: react to labelDensity changes at runtime
  $effect(() => {
    if (sigmaInstance) {
      const density = appState.networkViz?.labelDensity ?? 0.02;
      sigmaInstance.setSetting('labelDensity', density);
      throttledRefresh();
    }
  });

  // Effect: react to label threshold multiplier changes at runtime
  $effect(() => {
    if (sigmaInstance) {
      const mul = appState.networkViz?.labelThresholdMul ?? 1.0;
      const base = 12; // keep in sync with config default
      sigmaInstance.setSetting('labelRenderedSizeThreshold', Math.max(8, Math.round(base * mul)));
      throttledRefresh();
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
          class="mt-3 px-3 py-1 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
          onclick={() => window.location.reload()}
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
    <!-- Layout progress indicator -->
    {#if isLayoutRunning}
      <div class="absolute top-4 right-4 bg-background/90 backdrop-blur px-3 py-2 rounded-md border shadow-sm">
        <div class="flex items-center gap-2 text-sm">
          <div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span>Running layout… {layoutProgress}%</span>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  /* Ensure proper container sizing for sigma.js */
  div {
    position: relative;
  }
</style>

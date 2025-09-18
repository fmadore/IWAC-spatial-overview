/**
 * spatialNetworkRenderer.ts - Proper Sigma.js + Leaflet integration
 * 
 * Based on official @sigma/layer-leaflet documentation and examples
 * Handles the creation and management of geographic network visualization
 */

import type { SpatialNetworkData, SpatialNetworkNode, SpatialNetworkEdge } from '$lib/types';

export interface SpatialNetworkRendererOptions {
  container: HTMLElement;
  data: SpatialNetworkData;
  onNodeSelect?: (node: SpatialNetworkNode | null) => void;
  onNodeHover?: (node: SpatialNetworkNode | null) => void;
}

export interface SpatialNetworkRenderer {
  initialize(): Promise<void>;
  updateData(data: SpatialNetworkData): void;
  updateHighlighting(selectedNodeId?: string | null, highlightedNodeIds?: string[], isolationMode?: boolean, isolatedNodeId?: string | null): void;
  fitToView(): void;
  resetView(): void;
  zoomIn(): void;
  zoomOut(): void;
  destroy(): void;
}

export async function createSpatialNetworkRenderer(
  options: SpatialNetworkRendererOptions
): Promise<SpatialNetworkRenderer> {
  
  // Lazy load required libraries
  const [sigmaModule, graphModule, bindLeafletLayerModule, sigmaUtilsModule] = await Promise.all([
    import('sigma'),
    import('graphology'),
    import('@sigma/layer-leaflet'),
    import('@sigma/utils')
  ]);

  const Sigma = sigmaModule.Sigma;
  const Graph = graphModule.Graph;
  const bindLeafletLayer = bindLeafletLayerModule.default;
  const { fitViewportToNodes } = sigmaUtilsModule;

  let sigmaInstance: any = null;
  let graph: any = null;
  // Leaflet binding returned by @sigma/layer-leaflet
  let leafletBinding: { clean: () => void; map: any; updateGraphCoordinates: (g: any) => void } | null = null;
  let targetContainer: HTMLElement | null = null;
  let isFirstInitialization = true;

  // Wait until container has a non-zero size to avoid Sigma init errors
  async function waitForContainerSize(el: HTMLElement, maxAttempts = 10, delayMs = 80): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) return true;
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return false;
  }

  /**
   * Get node color based on importance/frequency - much cleaner scheme
   */
  function getNodeColor(node: SpatialNetworkNode): string {
    // Color nodes based on article count (importance) rather than arbitrary country colors
    const count = node.count || 1;
    
    if (count >= 50) {
      return '#1e40af'; // Dark blue for very important locations (50+ articles)
    } else if (count >= 20) {
      return '#3b82f6'; // Medium blue for important locations (20-49 articles)
    } else if (count >= 10) {
      return '#60a5fa'; // Light blue for moderate locations (10-19 articles)
    } else if (count >= 5) {
      return '#93c5fd'; // Very light blue for minor locations (5-9 articles)
    } else {
      return '#dbeafe'; // Pale blue for rare locations (1-4 articles)
    }
  }

  /**
   * Initialize the renderer
   */
  async function initialize(): Promise<void> {
    try {
      // Defensive: if already initialized, destroy before re-init
      if (sigmaInstance) {
        destroy();
      }
      targetContainer = options.container;
      // Create graph with proper structure
      graph = new Graph();

      // Add nodes to graph following the official pattern
      options.data.nodes.forEach((node: SpatialNetworkNode) => {
        graph.addNode(node.id, {
          // Required by Sigma
          x: 0,
          y: 0,
          label: node.label,
          size: Math.max(1.5, Math.min(6, Math.sqrt(node.count || 1) * 0.6)),
          color: getNodeColor(node),
          
          // Geographic coordinates for Leaflet layer
          latitude: node.coordinates[0],
          longitude: node.coordinates[1],
          
          // Store original data for events
          originalData: node
        });
      });

      // Add edges to graph with subtle monochromatic scheme
      options.data.edges.forEach((edge: SpatialNetworkEdge) => {
        if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
          // Subtle gray edges that don't compete with node colors
          let edgeColor = '#e2e8f0'; // Very light gray for weak connections
          if (edge.weight >= 5) {
            edgeColor = '#cbd5e1'; // Light gray for moderate connections  
          }
          if (edge.weight >= 10) {
            edgeColor = '#94a3b8'; // Medium gray for strong connections
          }
          
          graph.addEdge(edge.source, edge.target, {
            weight: edge.weight,
            color: edgeColor,
            size: Math.max(0.1, Math.min(0.4, edge.weight / 50))
          });
        }
      });

  // Create Sigma instance with proper settings
  // Ensure container has size; if not, allowInvalidContainer to bypass early errors
  const hasSize = await waitForContainerSize(targetContainer!, 12, 80);
  sigmaInstance = new Sigma(graph, targetContainer!, {
        // Rendering settings
        backgroundColor: 'transparent',
        allowInvalidContainer: !hasSize,
        
        // Node rendering - smaller sizes for geographic network
        defaultNodeColor: '#e74c3c',
        defaultNodeSize: 3,
        minNodeSize: 1.5,
        maxNodeSize: 6,
        
        // Edge rendering - much thinner edges for better readability
        defaultEdgeColor: '#94a3b8',
        defaultEdgeWidth: 0.2,
        minEdgeWidth: 0.1,
        maxEdgeWidth: 0.5,
        
        // Labels - adjusted for smaller nodes
        labelFont: 'Inter, sans-serif',
        labelSize: 10,
        labelWeight: 500,
        labelColor: { color: '#2c3e50' },
        labelDensity: 0.05,
        labelRenderedSizeThreshold: 4,
        
        // Performance optimizations
        hideEdgesOnMove: true,
        hideLabelsOnMove: true,
        renderEdgeLabels: false,
        
        // Disable camera controls since Leaflet handles map interaction
        enableCameraControls: false
      });

  // Bind Leaflet layer using the correct API pattern from documentation
  // Store full binding (clean/map/updateGraphCoordinates)
  leafletBinding = bindLeafletLayer(sigmaInstance, {
        // Function to extract lat/lng from node attributes
        getNodeLatLng: (attrs: any) => ({ 
          lat: attrs.latitude, 
          lng: attrs.longitude 
        })
      });

      // Force an initial coordinate projection and render with proper timing
      try {
        // Wait a frame to ensure DOM is ready
        requestAnimationFrame(() => {
          if (leafletBinding && graph && sigmaInstance) {
            leafletBinding.updateGraphCoordinates(graph);
            sigmaInstance.refresh();
          }
        });
      } catch (e) {
        console.warn('Initial updateGraphCoordinates failed:', e);
      }

      // Once the leaflet map is ready, fit to data bounds with proper timing
      // But only on first initialization to prevent flashing
      try {
        if (leafletBinding?.map && isFirstInitialization) {
          leafletBinding.map.whenReady(() => {
            // Schedule multiple attempts with increasing delays for initial fit only
            setTimeout(() => {
              ensureProperSizeAndReproject();
              fitToNetworkBoundsProper();
            }, 100);
            
            setTimeout(() => {
              ensureProperSizeAndReproject();
              fitToNetworkBoundsProper();
            }, 300);
            
            setTimeout(() => {
              ensureProperSizeAndReproject();
              fitToNetworkBoundsProper();
            }, 600);
          });
          
          // Also try to fit immediately after binding for first init
          setTimeout(() => fitToNetworkBoundsProper(), 50);
        }
      } catch (e) {
        console.warn('Error scheduling fit to bounds:', e);
      }

      // Set up event listeners
      setupEventListeners();
      
      // Mark first initialization as complete to prevent unnecessary re-fits
      isFirstInitialization = false;

    } catch (err) {
      console.error('Error initializing spatial network:', err);
      throw new Error('Failed to initialize network visualization');
    }
  }

  /**
   * Set up event listeners for node interactions
   */
  function setupEventListeners() {
    if (!sigmaInstance) return;

    // Node click events - automatically enter focus mode
    sigmaInstance.on('clickNode', (event: any) => {
      const nodeId = event.node;
      const nodeData = graph?.getNodeAttributes(nodeId)?.originalData;
      
      if (nodeData && options.onNodeSelect) {
        options.onNodeSelect(nodeData);
      }
      
      // Automatically enter focus mode for clicked node
      import('$lib/state/spatialNetworkData.svelte').then(({ enableSpatialIsolationMode }) => {
        enableSpatialIsolationMode(nodeId);
      });
    });

    // Node hover events
    sigmaInstance.on('enterNode', (event: any) => {
      const nodeId = event.node;
      const nodeData = graph?.getNodeAttributes(nodeId)?.originalData;
      
      if (nodeData && options.onNodeHover) {
        options.onNodeHover(nodeData);
      }
    });

    sigmaInstance.on('leaveNode', () => {
      if (options.onNodeHover) {
        options.onNodeHover(null);
      }
    });

    // Background click to deselect and exit focus mode
    sigmaInstance.on('clickStage', () => {
      if (options.onNodeSelect) {
        options.onNodeSelect(null);
      }
      
      // Exit focus mode when clicking background
      import('$lib/state/spatialNetworkData.svelte').then(({ disableSpatialIsolationMode }) => {
        disableSpatialIsolationMode();
      });
    });
  }

  /**
   * Update data in the graph
   */
  function updateData(data: SpatialNetworkData) {
    if (!graph) return;

    // Clear existing graph
    graph.clear();

    // Add new nodes and edges
    data.nodes.forEach((node: SpatialNetworkNode) => {
      graph.addNode(node.id, {
        x: 0,
        y: 0,
        label: node.label,
        size: Math.max(1.5, Math.min(6, Math.sqrt(node.count || 1) * 0.6)),
        color: getNodeColor(node),
        latitude: node.coordinates[0],
        longitude: node.coordinates[1],
        originalData: node
      });
    });

    data.edges.forEach((edge: SpatialNetworkEdge) => {
      if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
        // Subtle gray edges that don't compete with node colors
        let edgeColor = '#e2e8f0'; // Very light gray for weak connections
        if (edge.weight >= 5) {
          edgeColor = '#cbd5e1'; // Light gray for moderate connections  
        }
        if (edge.weight >= 10) {
          edgeColor = '#94a3b8'; // Medium gray for strong connections
        }
        
        graph.addEdge(edge.source, edge.target, {
          weight: edge.weight,
          color: edgeColor,
          size: Math.max(0.1, Math.min(0.4, edge.weight / 50))
        });
      }
    });

    // Recompute geo-projected coordinates via leaflet binding, then refresh
  try {
      if (leafletBinding) {
        leafletBinding.updateGraphCoordinates(graph);
      }
    } catch (e) {
      console.warn('Failed to update graph coordinates after data change:', e);
    }

  if (sigmaInstance) sigmaInstance.refresh();

  // After data updates, only fit if this is manual user action (not auto-update)
  // Skip auto-fit to prevent flashing during reactive updates
  if (isFirstInitialization) {
    fitToNetworkBoundsProper();
  }
  }

  /**
   * Update node highlighting with support for isolation mode
   */
  function updateHighlighting(selectedNodeId?: string | null, highlightedNodeIds: string[] = [], isolationMode?: boolean, isolatedNodeId?: string | null) {
    if (!graph || !sigmaInstance) {
      console.warn('updateHighlighting called but graph or sigma not ready');
      return;
    }

    // Get neighbors of isolated node if in isolation mode
    const isolatedNeighbors = new Set<string>();
    if (isolationMode && isolatedNodeId) {
      try {
        graph.forEachNeighbor(isolatedNodeId, (neighbor: string) => {
          isolatedNeighbors.add(neighbor);
        });
      } catch (e) {
        console.error('Error finding neighbors:', e);
      }
    }

    // Set up node reducer for dynamic styling based on Sigma.js best practices
    sigmaInstance.setSetting('nodeReducer', (nodeKey: string, data: any) => {
      const isSelected = nodeKey === selectedNodeId;
      const isHighlighted = highlightedNodeIds.includes(nodeKey);
      const isIsolated = nodeKey === isolatedNodeId;
      const isNeighborOfIsolated = isolatedNeighbors.has(nodeKey);
      
      // In isolation mode, hide all nodes except the isolated node and its neighbors
      if (isolationMode && isolatedNodeId) {
        if (!isIsolated && !isNeighborOfIsolated) {
          return {
            ...data,
            hidden: true
          };
        }
      }
      
      // Color and size adjustments with better highlighting
      let color = data.color;
      let size = data.size;
      let zIndex = 1;
      
      if (isSelected || isIsolated) {
        color = '#dc2626'; // Clean red for selected/isolated nodes
        size = Math.max(data.size * 1.4, 4);
        zIndex = 10;
      } else if (isHighlighted || isNeighborOfIsolated) {
        color = '#ea580c'; // Orange for highlighted/neighbor nodes
        size = Math.max(data.size * 1.2, 3);
        zIndex = 5;
      } else if ((isolationMode && isolatedNodeId) || (highlightedNodeIds.length > 0 && selectedNodeId)) {
        // Better transparency - keep color but reduce opacity
        color = data.color;
        size = data.size * 0.7;
        zIndex = 1;
        // Add transparency by modifying the alpha
        if (color.indexOf('#') === 0 && color.length === 7) {
          color = color + '40'; // Add 25% opacity
        }
      }
      // If nothing is selected/highlighted, return original data unchanged
      
      return {
        ...data,
        color,
        size,
        zIndex
      };
    });

    // Set up edge reducer for dynamic styling
    sigmaInstance.setSetting('edgeReducer', (edgeKey: string, data: any) => {
      const sourceNode = graph.source(edgeKey);
      const targetNode = graph.target(edgeKey);
      
      // In isolation mode, hide edges not connected to the isolated node
      if (isolationMode && isolatedNodeId) {
        const isConnectedToIsolated = sourceNode === isolatedNodeId || targetNode === isolatedNodeId;
        if (!isConnectedToIsolated) {
          return {
            ...data,
            hidden: true
          };
        }
        
        // Highlight edges connected to isolated node with clean styling
        return {
          ...data,
          color: '#dc2626', // Clean red for isolated edges
          size: Math.max(data.size * 1.5, 0.3),
          zIndex: 5
        };
      }
      
      // Regular highlighting mode
      const isConnectedToSelected = selectedNodeId && (sourceNode === selectedNodeId || targetNode === selectedNodeId);
      const isConnectedToHighlighted = highlightedNodeIds.some(nodeId => sourceNode === nodeId || targetNode === nodeId);
      
      if (isConnectedToSelected) {
        return {
          ...data,
          color: '#dc2626', // Clean red for selected edges
          size: Math.max(data.size * 1.3, 0.25),
          zIndex: 5
        };
      } else if (isConnectedToHighlighted) {
        return {
          ...data,
          color: '#ea580c', // Orange for highlighted edges
          size: Math.max(data.size * 1.1, 0.2),
          zIndex: 3
        };
      } else if ((isolationMode && isolatedNodeId) || (highlightedNodeIds.length > 0 && selectedNodeId)) {
        // Mute non-relevant edges with better transparency
        let color = data.color;
        if (color.indexOf('#') === 0 && color.length === 7) {
          color = color + '30'; // Add 19% opacity for subtle muting
        }
        return {
          ...data,
          color,
          size: data.size * 0.6,
          zIndex: 1
        };
      }
      
      // If nothing is selected/highlighted, return original data unchanged
      return data;
    });

    // Refresh Sigma to apply changes
    sigmaInstance.refresh();
  }

  /**
   * Public controls for external UI (sidebar)
   */
  function fitToView() {
    fitToNetworkBoundsProper();
  }

  function resetView() {
    fitToNetworkBoundsProper();
  }

  function zoomIn() {
    try {
      if (leafletBinding?.map) leafletBinding.map.zoomIn();
    } catch (e) {
      console.warn('zoomIn failed:', e);
    }
  }

  function zoomOut() {
    try {
      if (leafletBinding?.map) leafletBinding.map.zoomOut();
    } catch (e) {
      console.warn('zoomOut failed:', e);
    }
  }

  /**
   * Cleanup resources
   */
  function destroy() {
    // Clean up Leaflet layer first
    if (leafletBinding && leafletBinding.clean) {
      try {
        leafletBinding.clean();
      } catch (err) {
        console.warn('Error cleaning up Leaflet layer:', err);
      }
    }
    
    // Clean up Sigma instance
    if (sigmaInstance) {
      try {
        sigmaInstance.kill();
      } catch (err) {
        console.warn('Error destroying Sigma instance:', err);
      }
    }

    // Clear references
    sigmaInstance = null;
    graph = null;
  leafletBinding = null;
    // Remove any leftover DOM children in target container
    if (targetContainer) {
      try { targetContainer.innerHTML = ''; } catch {}
    }
  }

  /**
   * Fit Leaflet map to network bounds with proper camera handling
   */
  function fitToNetworkBoundsProper() {
    try {
      if (!leafletBinding?.map || !graph || !sigmaInstance) return;
      
      const nodeIds = graph.nodes();
      if (nodeIds.length === 0) return;
      
      // Use Sigma.js utilities for proper camera positioning
      
      // First, update graph coordinates to ensure they're current
      leafletBinding.updateGraphCoordinates(graph);
      
      // Use the official Sigma.js utility for fitting viewport
      fitViewportToNodes(sigmaInstance, nodeIds, {
        animate: false // No animation for initial positioning
      });
      
      // Refresh to apply the new camera position
      sigmaInstance.refresh();
      
      
    } catch (e) {
      console.warn('fitToNetworkBoundsProper failed, falling back to manual bounds:', e);
      // Fallback to the original method if Sigma utils fail
      fitToNetworkBounds();
    }
  }

  /**
   * Fit Leaflet map (and therefore Sigma via sync) to the network's geographic bounds (legacy fallback)
   */
  function fitToNetworkBounds() {
    try {
      if (!leafletBinding?.map || !graph) return;
      const lats: number[] = [];
      const lngs: number[] = [];
      graph.forEachNode((id: string, attrs: any) => {
        if (typeof attrs.latitude === 'number' && typeof attrs.longitude === 'number') {
          // guard invalid ranges
          const lat = Math.max(-85, Math.min(85, attrs.latitude));
          const lng = Math.max(-180, Math.min(180, attrs.longitude));
          lats.push(lat); lngs.push(lng);
        }
      });
      if (lats.length === 0) return;
      const south = Math.min(...lats);
      const north = Math.max(...lats);
      const west = Math.min(...lngs);
      const east = Math.max(...lngs);
      const bounds = [[south, west], [north, east]] as any;
      console.log('📐 Fitting map to bounds (legacy):', { south, west, north, east, count: lats.length });
      leafletBinding.map.fitBounds(bounds, { padding: [24, 24] });
    } catch (e) {
      console.warn('⚠️ fitToNetworkBounds failed:', e);
    }
  }

  /**
   * Some layouts load with a tiny container first (~256px). Retry until sized, then reproject and fit.
   */
  function ensureProperSizeAndReproject(attempt = 0) {
    try {
      if (!leafletBinding?.map || !targetContainer || !sigmaInstance) return;
      
      const el = leafletBinding.map.getContainer();
      const w = el.clientWidth;
      const h = el.clientHeight;
      
      console.log('📏 Map container size check', { w, h, attempt });
      
      // If container is too small and we haven't tried too many times, retry
      if ((w < 320 || h < 320) && attempt < 8) {
        setTimeout(() => ensureProperSizeAndReproject(attempt + 1), 150);
        return;
      }
      
      // Invalidate map size to ensure Leaflet knows the correct dimensions
      leafletBinding.map.invalidateSize({ 
        pan: false, 
        animate: false, 
        duration: 0 
      });
      
      // Update coordinates after size validation
      leafletBinding.updateGraphCoordinates(graph);
      
      // Refresh Sigma to apply new coordinates
      sigmaInstance.refresh();
      
      // Finally, fit to the proper bounds
      fitToNetworkBoundsProper();
      
      console.log('✅ Size validation and reproject complete');
      
    } catch (e) {
      console.warn('⚠️ ensureProperSizeAndReproject failed:', e);
    }
  }

  return {
    initialize,
    updateData,
    updateHighlighting,
  fitToView,
  resetView,
  zoomIn,
  zoomOut,
    destroy
  };
}

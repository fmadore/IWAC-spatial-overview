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

  /**
   * Get node color based on country
   */
  function getNodeColor(node: SpatialNetworkNode): string {
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
    
    return countryColors[node.country] || '#95a5a6';
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

      // Add edges to graph with better color scheme
      options.data.edges.forEach((edge: SpatialNetworkEdge) => {
        if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
          // Color edges based on weight - stronger connections get more visible colors
          let edgeColor = '#cbd5e1'; // Light blue-gray for weak connections
          if (edge.weight >= 5) {
            edgeColor = '#64748b'; // Medium gray-blue for moderate connections  
          }
          if (edge.weight >= 10) {
            edgeColor = '#475569'; // Darker blue-gray for strong connections
          }
          
          graph.addEdge(edge.source, edge.target, {
            weight: edge.weight,
            color: edgeColor,
            size: Math.max(0.1, Math.min(0.4, edge.weight / 50))
          });
        }
      });

  // Create Sigma instance with proper settings
  sigmaInstance = new Sigma(graph, targetContainer!, {
        // Rendering settings
        backgroundColor: 'transparent',
        
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

      console.log('✅ Sigma instance created');

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
        console.warn('⚠️ Initial updateGraphCoordinates failed:', e);
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
        console.warn('⚠️ Error scheduling fit to bounds:', e);
      }

      // Set up event listeners
      setupEventListeners();

      console.log('✅ Spatial network initialized');
      
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

    // Node double-click for quick isolation mode toggle
    sigmaInstance.on('doubleClickNode', (event: any) => {
      const nodeId = event.node;
      // Import the function dynamically to avoid circular dependencies
      import('$lib/state/spatialNetworkData.svelte').then(({ toggleSpatialIsolationMode }) => {
        toggleSpatialIsolationMode(nodeId);
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
        // Color edges based on weight - stronger connections get more visible colors
        let edgeColor = '#cbd5e1'; // Light blue-gray for weak connections
        if (edge.weight >= 5) {
          edgeColor = '#64748b'; // Medium gray-blue for moderate connections  
        }
        if (edge.weight >= 10) {
          edgeColor = '#475569'; // Darker blue-gray for strong connections
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
      console.warn('⚠️ Failed to update graph coordinates after data change:', e);
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
      console.warn('⚠️ updateHighlighting called but graph or sigma not ready');
      return;
    }

    console.log('🎨 updateHighlighting called:', {
      selectedNodeId,
      highlightedNodeIds,
      isolationMode,
      isolatedNodeId,
      graphNodes: graph.order,
      graphEdges: graph.size
    });

    // Get neighbors of isolated node if in isolation mode
    const isolatedNeighbors = new Set<string>();
    if (isolationMode && isolatedNodeId) {
      console.log('🔍 Finding neighbors of isolated node:', isolatedNodeId);
      try {
        graph.forEachNeighbor(isolatedNodeId, (neighbor: string) => {
          isolatedNeighbors.add(neighbor);
        });
        console.log('👥 Isolated neighbors found:', Array.from(isolatedNeighbors));
      } catch (e) {
        console.error('❌ Error finding neighbors:', e);
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
      
      // Color and size adjustments
      let color = data.color;
      let size = data.size;
      let zIndex = 1;
      
      if (isSelected || isIsolated) {
        color = '#f39c12'; // Orange for selected/isolated
        size = Math.max(data.size * 1.4, 4);
        zIndex = 10;
      } else if (isHighlighted || isNeighborOfIsolated) {
        color = '#e67e22'; // Darker orange for highlighted/neighbors
        size = Math.max(data.size * 1.2, 3);
        zIndex = 5;
      } else if (isolationMode || highlightedNodeIds.length > 0) {
        // Mute non-relevant nodes
        color = data.color + '40'; // Add transparency
        size = data.size * 0.8;
        zIndex = 1;
      }
      
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
        
        // Highlight edges connected to isolated node
        return {
          ...data,
          color: '#f39c12',
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
          color: '#f39c12',
          size: Math.max(data.size * 1.3, 0.25),
          zIndex: 5
        };
      } else if (isConnectedToHighlighted) {
        return {
          ...data,
          color: '#e67e22',
          size: Math.max(data.size * 1.1, 0.2),
          zIndex: 3
        };
      } else if (selectedNodeId || highlightedNodeIds.length > 0) {
        // Mute non-relevant edges
        return {
          ...data,
          color: data.color + '30', // Add transparency
          size: data.size * 0.7,
          zIndex: 1
        };
      }
      
      return data;
    });

    // Refresh Sigma to apply changes
    console.log('🔄 Refreshing Sigma with new highlighting settings');
    sigmaInstance.refresh();
    console.log('✅ updateHighlighting completed');
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
        console.log('✅ Leaflet layer cleaned up');
      } catch (err) {
        console.warn('Error cleaning up Leaflet layer:', err);
      }
    }
    
    // Clean up Sigma instance
    if (sigmaInstance) {
      try {
        sigmaInstance.kill();
        console.log('✅ Sigma instance destroyed');
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
      console.log('📐 Using Sigma.js fitViewportToNodes for', nodeIds.length, 'nodes');
      
      // First, update graph coordinates to ensure they're current
      leafletBinding.updateGraphCoordinates(graph);
      
      // Use the official Sigma.js utility for fitting viewport
      fitViewportToNodes(sigmaInstance, nodeIds, {
        animate: false // No animation for initial positioning
      });
      
      // Refresh to apply the new camera position
      sigmaInstance.refresh();
      
      console.log('✅ Camera fitted to network using Sigma.js utilities');
      
    } catch (e) {
      console.warn('⚠️ fitToNetworkBoundsProper failed, falling back to manual bounds:', e);
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

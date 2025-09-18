/**
 * SigmaConfigBuilder - Pure functions for building Sigma.js configuration objects
 * 
 * Centralizes all sigma.js configuration logic for consistent setup across the application.
 * Includes adaptive settings based on graph size and performance requirements.
 */

import type { NetworkData } from '$lib/types';

export interface SigmaConfig {
  // Node programs for different shapes
  nodeProgramClasses: Record<string, any>;
  
  // Rendering settings
  renderLabels: boolean;
  renderEdges: boolean;
  enableEdgeHoverEvents: string | boolean;
  
  // Label settings
  labelFont: string;
  labelSize: number;
  labelWeight: string;
  labelColor: { color: string };
  labelDensity: number;
  labelGridCellSize: number;
  labelRenderedSizeThreshold: number;
  
  // Size settings
  minNodeSize: number;
  maxNodeSize: number;
  minEdgeSize: number;
  maxEdgeSize: number;
  
  // Edge appearance
  defaultEdgeType: string;
  defaultEdgeColor: string;
  edgeColor: string;
  
  // Performance optimizations
  batchEdgesDrawing: boolean;
  hideEdgesOnMove: boolean;
  hideLabelsOnMove: boolean;
  
  // Hover effects
  enableHovering: boolean;
  nodeHoverColor: string;
  defaultNodeHoverColor: string;
  labelHoverShadow: string;
  labelHoverShadowColor: string;
  labelHoverBGColor: string;
  defaultHoverLabelBGColor: string;
  labelHoverColor: string;
  defaultLabelHoverColor: string;
  
  // Camera and interaction
  allowInvalidContainer: boolean;
  autoRescale: boolean;
  enableCamera: boolean;
  
  // WebGL optimizations
  webglOversamplingRatio: number;
  
  // Node reducer function
  nodeReducer: (node: string, data: any) => any;
}

/**
 * Build optimal sigma.js configuration based on graph data and available programs
 */
export function buildSigmaConfig(
  currentData: NetworkData,
  NodeBorderProgram: any,
  NodeSquareProgram: any,
  highlightedNodeSet: Set<string>,
  appState: any
): SigmaConfig {
  return {
    // Node programs for different shapes
    nodeProgramClasses: {
      square: NodeSquareProgram,
      border: NodeBorderProgram,
    },
    
    // Enhanced rendering settings
    renderLabels: true,
    renderEdges: true,
    enableEdgeHoverEvents: 'debounce',
    
    // Improved label settings
    labelFont: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    labelSize: 11,
    labelWeight: '500',
    labelColor: { color: '#1f2937' },
    // Show fewer labels at global zoom to reduce clutter
    labelDensity: (appState?.networkViz?.labelDensity ?? 0.02),
    labelGridCellSize: 120,
    labelRenderedSizeThreshold: Math.max(8, Math.round(12 * (appState?.networkViz?.labelThresholdMul ?? 1.0))),
    
    // Size settings aligned with tighter node sizes in graph
    minNodeSize: 2,
    maxNodeSize: 28,
    minEdgeSize: 0.15,
    maxEdgeSize: 1.5,
    
    // Edge appearance with subtle styling
    defaultEdgeType: 'line',
    defaultEdgeColor: '#e2e8f0',
    edgeColor: 'default',
    
    // Performance optimizations for large graphs with better spacing
    batchEdgesDrawing: currentData.edges.length > 300, // Earlier batching for better performance
    hideEdgesOnMove: currentData.edges.length > 800,   // Hide edges sooner to reduce clutter
    hideLabelsOnMove: currentData.nodes.length > 200,  // Hide labels sooner for cleaner movement
    
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
    
    // Node highlighting reducer (optimized for performance)
    nodeReducer: (node: string, data: any) => {
      const isHighlighted = highlightedNodeSet.has(node);
      const isSelected = appState.networkNodeSelected?.id === node;
      
      if (isSelected) {
        return {
          ...data,
          size: Math.max(data.size * 1.5, 12),
          color: '#ff6b35', // Orange for selected
          zIndex: 10
        };
      }
      
      if (isHighlighted) {
        return {
          ...data,
          size: Math.max(data.size * 1.2, 10),
          color: '#ffd60a', // Yellow for highlighted
          zIndex: 5
        };
      }
      
      // Dim non-highlighted nodes when there are highlighted nodes
      if (highlightedNodeSet.size > 0) {
        return {
          ...data,
          color: data.color + '60', // Add transparency
          zIndex: 1
        };
      }
      
      return data;
    },
  };
}

/**
 * Build ForceAtlas2 layout settings optimized for maximum spacing
 */
export function buildForceAtlas2Settings(nodeCount: number, ForceAtlas2: any): {
  settings: Record<string, any>;
  iterations: number;
  batchSize: number;
} {
  // Use ForceAtlas2 inferSettings for better defaults, then override specific settings
  const inferredSettings = (ForceAtlas2.inferSettings && typeof ForceAtlas2.inferSettings === 'function') 
    ? ForceAtlas2.inferSettings(nodeCount) 
    : {};
  
  // Optimized ForceAtlas2 settings for maximum spacing and minimal overlap
  const settings = {
    ...inferredSettings,
    // Optimization for large graphs
    barnesHutOptimize: nodeCount > 300, // Enable earlier for better performance
    barnesHutTheta: 0.7, // Slightly higher for more approximation, better spacing
    
    // Dramatically reduced gravity for much more spread
    strongGravityMode: false,
    gravity: nodeCount > 1000 ? 0.002 : nodeCount > 500 ? 0.003 : nodeCount > 200 ? 0.004 : 0.005,
    
    // Significantly increased scaling ratio for maximum spacing
    scalingRatio: nodeCount > 2000 ? 150 : nodeCount > 1000 ? 120 : nodeCount > 500 ? 100 : 80,
    
    // LinLog mode for better cluster separation and spacing
    linLogMode: true,
    outboundAttractionDistribution: true,
    adjustSizes: true, // Account for node sizes in layout
    
    // Fine-tuning for stability and maximum spread
    slowDown: 0.8, // Slightly more slowdown for stability with larger spacing
    edgeWeightInfluence: 0.4, // Further reduced edge influence for looser clustering
    
    // Enable overlap prevention for better spacing
    preventOverlap: true,
  };

  const iterations = nodeCount > 1000 ? 800 : nodeCount > 500 ? 600 : 400; // More iterations for better spacing
  const batchSize = nodeCount > 2000 ? 4 : nodeCount > 1000 ? 6 : nodeCount > 500 ? 10 : 14;

  return { settings, iterations, batchSize };
}

/**
 * Build adaptive performance settings based on graph characteristics
 */
export function buildPerformanceSettings(nodeCount: number, edgeCount: number): {
  hideEdgesThreshold: number;
  hideLabelsThreshold: number;
  batchEdgesThreshold: number;
  refreshThrottle: number;
} {
  return {
    hideEdgesThreshold: 800,   // Hide edges sooner to reduce clutter
    hideLabelsThreshold: 200,  // Hide labels sooner for cleaner movement
    batchEdgesThreshold: 300,  // Earlier batching for better performance
    refreshThrottle: 50,       // 50ms throttle for refresh calls
  };
}

/**
 * Build camera animation settings
 */
export function buildCameraSettings(): {
  fitAnimationDuration: number;
  centerAnimationDuration: number;
  focusAnimationDuration: number;
  easing: string;
  padding: number;
} {
  return {
    fitAnimationDuration: 600,
    centerAnimationDuration: 500,
    focusAnimationDuration: 500,
    easing: 'quadInOut',
    padding: 0.2, // 20% padding
  };
}

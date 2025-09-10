/**
 * NetworkGraphBuilder - Pure functions for converting NetworkData to graphology format
 * 
 * Handles the conversion of our application's NetworkData format into the graphology
 * graph structure that Sigma.js requires, with optimized positioning and styling.
 */

import type { NetworkData } from '$lib/types';

// Enhanced color palette with better contrast and visual hierarchy
export const NODE_COLORS = {
  person: '#3b82f6',        // Blue - individuals
  organization: '#8b5cf6',  // Purple - institutions  
  event: '#10b981',         // Green - events/actions
  subject: '#f59e0b',       // Amber - topics/themes
  location: '#ef4444',      // Red - places
} as const;

// Node type configurations for different visual styles
export const NODE_TYPE_CONFIG = {
  person: { shape: 'circle', border: true, borderColor: '#1e40af' },
  organization: { shape: 'square', border: true, borderColor: '#6d28d9' },
  event: { shape: 'circle', border: true, borderColor: '#047857' },
  subject: { shape: 'circle', border: false, borderColor: '#d97706' },
  location: { shape: 'circle', border: true, borderColor: '#dc2626' },
} as const;

/**
 * Generate random position using Box-Muller transform for gaussian distribution
 * This creates a more natural initial spread compared to uniform random
 */
function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Calculate optimal initial spread based on node count
 * Larger graphs need more initial spread to avoid clustering
 */
function calculateInitialSpread(nodeCount: number): number {
  if (nodeCount > 1000) return 800;
  if (nodeCount > 500) return 600;
  if (nodeCount > 200) return 500;
  return 400;
}

/**
 * Calculate node size based on count with better scaling for spacing
 */
function calculateNodeSize(count: number, minCount: number, maxCount: number): number {
  const countRange = maxCount - minCount || 1;
  const normalizedCount = (count - minCount) / countRange;
  // Significantly increased size range for better visibility and much more breathing room
  return 15 + (50 - 15) * normalizedCount; // 15-50 size range
}

/**
 * Calculate edge thickness with emphasis on minimal visual noise
 */
function calculateEdgeThickness(weight: number): number {
  // Even thinner edges to reduce visual clutter and emphasize spacing
  return Math.max(0.3, Math.min(2, weight * 0.25));
}

/**
 * Get node type from node ID
 */
function getNodeType(nodeId: string): string {
  return nodeId.split(':')[0] || 'unknown';
}

/**
 * Convert NetworkData to graphology format with optimized spacing
 */
export function buildGraphologyGraph(Graph: any, networkData: NetworkData): any {
  if (!Graph) return null;

  const graph = new Graph();
  const nodeCount = networkData.nodes.length;
  const initialSpread = calculateInitialSpread(nodeCount);

  // Calculate node size range for normalization
  const counts = networkData.nodes.map(n => n.count);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);

  // Add nodes with enhanced styling and optimal initial positioning
  networkData.nodes.forEach(node => {
    const nodeType = getNodeType(node.id);
    const typeConfig = NODE_TYPE_CONFIG[nodeType as keyof typeof NODE_TYPE_CONFIG] || NODE_TYPE_CONFIG.subject;
    const baseColor = NODE_COLORS[nodeType as keyof typeof NODE_COLORS] || '#6b7280';
    
    // Calculate optimized node size
    const baseSize = calculateNodeSize(node.count, minCount, maxCount);

    // Generate initial position with gaussian distribution for better spread
    const seedX = gaussianRandom() * initialSpread;
    const seedY = gaussianRandom() * initialSpread;
    
    // Determine render type for sigma.js
    let renderType = undefined; // Use default for circles
    if (typeConfig.shape === 'square') {
      renderType = 'square';
    } else if (typeConfig.border) {
      renderType = 'border';
    }

    graph.addNode(node.id, {
      label: node.label,
      x: seedX,
      y: seedY,
      size: baseSize,
      color: baseColor,
      ...(renderType && { type: renderType }),
      entityType: nodeType,
      count: node.count,
      degree: node.degree || 0,
      // Border properties for bordered nodes
      borderColor: typeConfig.borderColor,
      borderSize: typeConfig.border ? 2 : 0,
      // Visual hierarchy
      zIndex: nodeType === 'location' ? 2 : 1, // Locations on top
    });
  });
  
  // Add edges with minimal visual impact for better spacing perception
  networkData.edges.forEach(edge => {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      const thickness = calculateEdgeThickness(edge.weight);
      
      graph.addEdge(edge.source, edge.target, {
        weight: edge.weight,
        size: thickness,
        color: '#e2e8f0', // Very light gray for minimal visual impact
        alpha: 0.25, // Much more transparent for better spacing perception
        type: 'line'
      });
    }
  });

  return graph;
}

/**
 * Get node statistics for debugging and optimization
 */
export function getGraphStatistics(graph: any): {
  nodeCount: number;
  edgeCount: number;
  averageNodeSize: number;
  sizeRange: { min: number; max: number };
} {
  if (!graph) return { nodeCount: 0, edgeCount: 0, averageNodeSize: 0, sizeRange: { min: 0, max: 0 } };

  const nodes = graph.nodes();
  const edges = graph.edges();
  
  let totalSize = 0;
  let minSize = Infinity;
  let maxSize = -Infinity;

  nodes.forEach((nodeId: string) => {
    const attrs = graph.getNodeAttributes(nodeId);
    const size = attrs.size || 0;
    totalSize += size;
    minSize = Math.min(minSize, size);
    maxSize = Math.max(maxSize, size);
  });

  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    averageNodeSize: nodes.length > 0 ? totalSize / nodes.length : 0,
    sizeRange: {
      min: minSize === Infinity ? 0 : minSize,
      max: maxSize === -Infinity ? 0 : maxSize
    }
  };
}

/**
 * Validate graph structure
 */
export function validateGraph(graph: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!graph) {
    errors.push('Graph is null or undefined');
    return { isValid: false, errors };
  }

  const nodes = graph.nodes();
  const edges = graph.edges();

  if (nodes.length === 0) {
    errors.push('Graph has no nodes');
  }

  // Check for nodes with missing positions
  let nodesWithoutPositions = 0;
  nodes.forEach((nodeId: string) => {
    const attrs = graph.getNodeAttributes(nodeId);
    if (typeof attrs.x !== 'number' || typeof attrs.y !== 'number') {
      nodesWithoutPositions++;
    }
  });

  if (nodesWithoutPositions > 0) {
    errors.push(`${nodesWithoutPositions} nodes missing x,y positions`);
  }

  // Check for orphaned edges
  let orphanedEdges = 0;
  edges.forEach((edgeId: string) => {
    const source = graph.source(edgeId);
    const target = graph.target(edgeId);
    if (!graph.hasNode(source) || !graph.hasNode(target)) {
      orphanedEdges++;
    }
  });

  if (orphanedEdges > 0) {
    errors.push(`${orphanedEdges} orphaned edges found`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

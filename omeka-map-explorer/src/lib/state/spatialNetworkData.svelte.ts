/**
 * spatialNetworkData.svelte.ts - State management for spatial network visualization
 * 
 * Manages loading and filtering of spatial network data that combines:
 * - Location entities with GPS coordinates
 * - Co-occurrence relationships between locations
 * - Geographic bounds for map visualization
 */

import { base } from '$app/paths';
import type { SpatialNetworkData, SpatialNetworkNode, SpatialNetworkEdge } from '$lib/types';

// Raw state for better Set performance (must be declared separately)
let visibleCountries = $state.raw(new Set<string>());
let highlightedNodeIds = $state.raw(new Set<string>());

// Core spatial network state
const spatialNetworkState = $state({
  // Data states
  data: null as SpatialNetworkData | null,
  filtered: null as SpatialNetworkData | null,
  isLoading: false,
  error: null as string | null,
  
  // Filter states
  weightMin: 2,
  showIsolatedNodes: false,
  
  // Visualization modes
  isolationMode: false,
  isolatedNodeId: null as string | null,
  
  // Map integration
  mapBounds: null as { north: number; south: number; east: number; west: number } | null,
  selectedNodeId: null as string | null,
  
  // UI states
  isInitialized: false,
});

// Getter/setter functions for raw state
function getVisibleCountries(): Set<string> {
  return visibleCountries;
}

function setVisibleCountries(countries: Set<string>): void {
  visibleCountries = countries;
}

function getHighlightedNodeIds(): Set<string> {
  return highlightedNodeIds;
}

function setHighlightedNodeIds(nodeIds: Set<string>): void {
  highlightedNodeIds = nodeIds;
}

// Derived state for optimized computations - must be separate variable declarations
const availableCountries = $derived.by(() => {
  if (!spatialNetworkState.data) return [];
  
  const countries = new Set<string>();
  spatialNetworkState.data.nodes.forEach(node => {
    if (node.country) {
      countries.add(node.country);
    }
  });
  
  return Array.from(countries).sort();
});

const networkStats = $derived.by(() => {
  const data = spatialNetworkState.filtered || spatialNetworkState.data;
  if (!data) return null;
  
  const countries = new Map<string, number>();
  let totalArticles = 0;
  
  data.nodes.forEach(node => {
    totalArticles += node.count;
    if (node.country) {
      countries.set(node.country, (countries.get(node.country) || 0) + 1);
    }
  });
  
  const edgeWeights = data.edges.map(edge => edge.weight);
  const minWeight = edgeWeights.length > 0 ? Math.min(...edgeWeights) : 0;
  const maxWeight = edgeWeights.length > 0 ? Math.max(...edgeWeights) : 0;
  
  return {
    totalNodes: data.nodes.length,
    totalEdges: data.edges.length,
    totalArticles,
    countries: Object.fromEntries(countries),
    countryCount: countries.size,
    edgeWeights: {
      min: minWeight,
      max: maxWeight,
      avg: edgeWeights.length > 0 ? edgeWeights.reduce((a, b) => a + b, 0) / edgeWeights.length : 0
    }
  };
});

const selectedNode = $derived.by(() => {
  if (!spatialNetworkState.filtered || !spatialNetworkState.selectedNodeId) return null;
  return spatialNetworkState.filtered.nodes.find(node => node.id === spatialNetworkState.selectedNodeId) || null;
});

/**
 * Load spatial network data from the server
 */
export async function loadSpatialNetworkData(pathPrefix = 'data'): Promise<boolean> {
  if (spatialNetworkState.isLoading) return false;
  
  spatialNetworkState.isLoading = true;
  spatialNetworkState.error = null;
  
  try {
    const response = await fetch(`${base}/${pathPrefix}/networks/spatial.json`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Spatial network data not found. Run the spatial network generation script first.');
      }
      throw new Error(`Failed to load spatial network data: ${response.status}`);
    }
    
    const data: SpatialNetworkData = await response.json();
    
    // Validate data structure
    if (!data.nodes || !data.edges || !data.meta) {
      throw new Error('Invalid spatial network data structure');
    }
    
    // Validate that all nodes have coordinates
    const invalidNodes = data.nodes.filter(node => 
      !node.coordinates || node.coordinates.length !== 2 ||
      typeof node.coordinates[0] !== 'number' || typeof node.coordinates[1] !== 'number'
    );
    
    if (invalidNodes.length > 0) {
      console.warn(`Found ${invalidNodes.length} nodes without valid coordinates`);
    }
    
    spatialNetworkState.data = data;
    spatialNetworkState.mapBounds = data.bounds;
    
    // Initialize visible countries from data
    const countries = new Set<string>();
    data.nodes.forEach(node => {
      if (node.country) {
        countries.add(node.country);
      }
    });
    setVisibleCountries(countries);
    
    // Apply initial filters
    applySpatialFilters();
    spatialNetworkState.isInitialized = true;
    
    console.log(`✅ Loaded spatial network: ${data.nodes.length} nodes, ${data.edges.length} edges`);
    return true;
    
  } catch (error) {
    console.error('❌ Failed to load spatial network data:', error);
    spatialNetworkState.error = error instanceof Error ? error.message : 'Unknown error';
    return false;
  } finally {
    spatialNetworkState.isLoading = false;
  }
}

/**
 * Apply filters to the spatial network data
 */
export function applySpatialFilters() {
  if (!spatialNetworkState.data) {
    spatialNetworkState.filtered = null;
    return;
  }
  
  const { data } = spatialNetworkState;
  
  // Filter nodes by country
  let filteredNodes = data.nodes.filter(node => 
    !node.country || getVisibleCountries().has(node.country)
  );
  
  // Create set of visible node IDs for edge filtering
  const visibleNodeIds = new Set(filteredNodes.map(node => node.id));
  
  // Filter edges by weight and visible nodes
  let filteredEdges = data.edges.filter(edge => 
    edge.weight >= spatialNetworkState.weightMin &&
    visibleNodeIds.has(edge.source) &&
    visibleNodeIds.has(edge.target)
  );
  
  // Calculate which nodes have edges (connected nodes)
  const connectedNodeIds = new Set<string>();
  filteredEdges.forEach(edge => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });
  
  // Remove isolated nodes unless explicitly showing them
  if (!spatialNetworkState.showIsolatedNodes) {
    filteredNodes = filteredNodes.filter(node => connectedNodeIds.has(node.id));
  }
  
  // Update filtered data
  spatialNetworkState.filtered = {
    nodes: filteredNodes,
    edges: filteredEdges,
    bounds: data.bounds,
    meta: {
      ...data.meta,
      totalNodes: filteredNodes.length,
      totalEdges: filteredEdges.length,
    }
  };
}

/**
 * Set minimum edge weight filter
 */
export function setSpatialWeightMin(weight: number) {
  if (weight > 0 && weight !== spatialNetworkState.weightMin) {
    spatialNetworkState.weightMin = weight;
    applySpatialFilters();
  }
}

/**
 * Toggle country visibility
 */
export function toggleSpatialCountry(country: string) {
  // Create new Set for reactive updates since we're using $state.raw
  const newVisibleCountries = new Set(getVisibleCountries());
  if (newVisibleCountries.has(country)) {
    newVisibleCountries.delete(country);
  } else {
    newVisibleCountries.add(country);
  }
  setVisibleCountries(newVisibleCountries);
  applySpatialFilters();
}

/**
 * Set country visibility
 */
export function setSpatialCountryVisibility(country: string, visible: boolean) {
  // Create new Set for reactive updates since we're using $state.raw
  const newVisibleCountries = new Set(getVisibleCountries());
  if (visible) {
    newVisibleCountries.add(country);
  } else {
    newVisibleCountries.delete(country);
  }
  setVisibleCountries(newVisibleCountries);
  applySpatialFilters();
}

/**
 * Toggle isolated nodes visibility
 */
export function toggleSpatialIsolatedNodes() {
  spatialNetworkState.showIsolatedNodes = !spatialNetworkState.showIsolatedNodes;
  applySpatialFilters();
}

/**
 * Select a spatial network node
 */
export function selectSpatialNode(nodeId: string | null) {
  spatialNetworkState.selectedNodeId = nodeId;
}

/**
 * Highlight spatial network nodes
 */
export function highlightSpatialNodes(nodeIds: string[]) {
  // Create new Set for reactive updates since we're using $state.raw
  setHighlightedNodeIds(new Set(nodeIds));
}

/**
 * Clear spatial network highlighting
 */
export function clearSpatialHighlight() {
  // Create new empty Set for reactive updates since we're using $state.raw
  setHighlightedNodeIds(new Set<string>());
}

/**
 * Get node by ID from current filtered data
 */
export function getSpatialNodeById(nodeId: string): SpatialNetworkNode | null {
  if (!spatialNetworkState.filtered) return null;
  return spatialNetworkState.filtered.nodes.find(node => node.id === nodeId) || null;
}

/**
 * Get all available countries in the data
 */
export function getSpatialAvailableCountries(): string[] {
  return availableCountries;
}

/**
 * Get spatial network statistics
 */
export function getSpatialNetworkStats() {
  return networkStats;
}

/**
 * Get selected spatial node
 */
export function getSpatialSelectedNode(): SpatialNetworkNode | null {
  return selectedNode;
}

/**
 * Reset all spatial network filters
 */
export function resetSpatialFilters() {
  spatialNetworkState.weightMin = 2;
  spatialNetworkState.showIsolatedNodes = false;
  spatialNetworkState.isolationMode = false;
  spatialNetworkState.isolatedNodeId = null;
  spatialNetworkState.selectedNodeId = null;
  setHighlightedNodeIds(new Set<string>()); // Create new Set for reactive updates
  
  // Reset countries to all available
  if (spatialNetworkState.data) {
    const allCountries = new Set<string>();
    spatialNetworkState.data.nodes.forEach(node => {
      if (node.country) {
        allCountries.add(node.country);
      }
    });
    setVisibleCountries(allCountries); // Create new Set for reactive updates
  }
  
  applySpatialFilters();
}

/**
 * Enable isolation mode for a specific node
 * Shows only the selected node and its direct neighbors
 */
export function enableSpatialIsolationMode(nodeId: string) {
  console.log('🔧 enableSpatialIsolationMode called:', nodeId);
  spatialNetworkState.isolationMode = true;
  spatialNetworkState.isolatedNodeId = nodeId;
  spatialNetworkState.selectedNodeId = nodeId;
  
  // Get neighbors of the isolated node
  const neighbors = getSpatialNodeNeighbors(nodeId);
  console.log('👥 Found neighbors:', neighbors);
  setHighlightedNodeIds(new Set([nodeId, ...neighbors]));
  
  console.log('✅ Isolation mode enabled:', {
    isolationMode: spatialNetworkState.isolationMode,
    isolatedNodeId: spatialNetworkState.isolatedNodeId,
    highlightedNodes: Array.from(getHighlightedNodeIds())
  });
}

/**
 * Disable isolation mode and return to normal view
 */
export function disableSpatialIsolationMode() {
  console.log('🔧 disableSpatialIsolationMode called');
  spatialNetworkState.isolationMode = false;
  spatialNetworkState.isolatedNodeId = null;
  setHighlightedNodeIds(new Set<string>());
  
  console.log('✅ Isolation mode disabled:', {
    isolationMode: spatialNetworkState.isolationMode,
    isolatedNodeId: spatialNetworkState.isolatedNodeId
  });
}

/**
 * Toggle isolation mode for a node
 */
export function toggleSpatialIsolationMode(nodeId: string | null) {
  console.log('🔧 toggleSpatialIsolationMode called:', nodeId);
  
  if (!nodeId) {
    console.log('🚫 No nodeId provided, disabling isolation');
    disableSpatialIsolationMode();
    return;
  }
  
  if (spatialNetworkState.isolationMode && spatialNetworkState.isolatedNodeId === nodeId) {
    console.log('🔄 Toggling OFF isolation for same node');
    disableSpatialIsolationMode();
  } else {
    console.log('🔄 Toggling ON isolation for node:', nodeId);
    enableSpatialIsolationMode(nodeId);
  }
}

/**
 * Get neighbor node IDs for a given node
 */
export function getSpatialNodeNeighbors(nodeId: string): string[] {
  if (!spatialNetworkState.data) return [];
  
  const neighbors = new Set<string>();
  spatialNetworkState.data.edges.forEach(edge => {
    if (edge.source === nodeId) {
      neighbors.add(edge.target);
    } else if (edge.target === nodeId) {
      neighbors.add(edge.source);
    }
  });
  
  return Array.from(neighbors);
}

// Export the state for reactive access with separate sets
export { 
  spatialNetworkState,
  getVisibleCountries,
  setVisibleCountries,
  getHighlightedNodeIds,
  setHighlightedNodeIds
};

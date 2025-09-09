/**
 * spatialNetworkData.svelte.ts - State management for spatial network visualization
 * 
 * Manages loading and filtering of spatial network data that combines:
 * - Location entities with GPS coordinates
 * - Co-occurrence relationships between locations
 * - Geographic bounds for map visualization
 */

import type { SpatialNetworkData, SpatialNetworkNode, SpatialNetworkEdge } from '$lib/types';

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
  visibleCountries: new Set<string>(),
  
  // Map integration
  mapBounds: null as { north: number; south: number; east: number; west: number } | null,
  selectedNodeId: null as string | null,
  highlightedNodeIds: new Set<string>(),
  
  // UI states
  isInitialized: false,
});

/**
 * Load spatial network data from the server
 */
export async function loadSpatialNetworkData(): Promise<boolean> {
  if (spatialNetworkState.isLoading) return false;
  
  spatialNetworkState.isLoading = true;
  spatialNetworkState.error = null;
  
  try {
    const response = await fetch('/data/networks/spatial.json');
    
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
    spatialNetworkState.visibleCountries = countries;
    
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
    !node.country || spatialNetworkState.visibleCountries.has(node.country)
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
  
  console.log(`🔍 Spatial network filtered: ${filteredNodes.length} nodes, ${filteredEdges.length} edges`);
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
  if (spatialNetworkState.visibleCountries.has(country)) {
    spatialNetworkState.visibleCountries.delete(country);
  } else {
    spatialNetworkState.visibleCountries.add(country);
  }
  applySpatialFilters();
}

/**
 * Set country visibility
 */
export function setSpatialCountryVisibility(country: string, visible: boolean) {
  if (visible) {
    spatialNetworkState.visibleCountries.add(country);
  } else {
    spatialNetworkState.visibleCountries.delete(country);
  }
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
  spatialNetworkState.highlightedNodeIds = new Set(nodeIds);
}

/**
 * Clear spatial network highlighting
 */
export function clearSpatialHighlight() {
  spatialNetworkState.highlightedNodeIds.clear();
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
  if (!spatialNetworkState.data) return [];
  
  const countries = new Set<string>();
  spatialNetworkState.data.nodes.forEach(node => {
    if (node.country) {
      countries.add(node.country);
    }
  });
  
  return Array.from(countries).sort();
}

/**
 * Get spatial network statistics
 */
export function getSpatialNetworkStats() {
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
}

/**
 * Reset all spatial network filters
 */
export function resetSpatialFilters() {
  spatialNetworkState.weightMin = 2;
  spatialNetworkState.showIsolatedNodes = false;
  spatialNetworkState.selectedNodeId = null;
  spatialNetworkState.highlightedNodeIds.clear();
  
  // Reset countries to all available
  if (spatialNetworkState.data) {
    const allCountries = new Set<string>();
    spatialNetworkState.data.nodes.forEach(node => {
      if (node.country) {
        allCountries.add(node.country);
      }
    });
    spatialNetworkState.visibleCountries = allCountries;
  }
  
  applySpatialFilters();
}

// Export the state for reactive access
export { spatialNetworkState };

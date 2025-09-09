/**
 * Network Components - Sigma.js-based network visualization system
 * 
 * This module provides a sigma.js-based network visualization system with:
 * - High-performance WebGL rendering via sigma.js
 * - Force-directed layout algorithms (ForceAtlas2, Noverlap)
 * - Interactive node selection and entity integration
 * - Responsive search and filtering capabilities
 * - Spatial network visualization with Leaflet maps
 */

// Core modules
export { NetworkInteractionHandler } from './modules/NetworkInteractionHandler';
export { SigmaForceAtlasLayout } from './modules/SigmaForceAtlasLayout';
export { NoverlapLayoutManager } from './modules/NoverlapLayoutManager';

// Standard network components
export { default as SigmaNetworkGraph } from './SigmaNetworkGraph.svelte';
export { default as NetworkSearchBar } from './NetworkSearchBar.svelte';
export { default as NetworkSidebar } from './NetworkSidebar.svelte';

// Spatial network components (Leaflet + Sigma.js)
export { default as SpatialNetworkMap } from './SpatialNetworkMap.svelte';
export { default as SpatialNetworkSidebar } from './SpatialNetworkSidebar.svelte';
export { default as SpatialNetworkVisualization } from './SpatialNetworkVisualization.svelte';

// Type exports
export type { EntityMapping } from './modules/NetworkInteractionHandler';

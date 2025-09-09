/**
 * Network Components - Sigma.js-based network visualization system
 * 
 * This module provides a sigma.js-based network visualization system with:
 * - High-performance WebGL rendering via sigma.js
 * - Force-directed layout algorithms (ForceAtlas2, Noverlap)
 * - Interactive node selection and entity integration
 * - Responsive search and filtering capabilities
 */

// Core modules
export { NetworkInteractionHandler } from './modules/NetworkInteractionHandler';
export { SigmaForceAtlasLayout } from './modules/SigmaForceAtlasLayout';
export { NoverlapLayoutManager } from './modules/NoverlapLayoutManager';

// Components
export { default as SigmaNetworkGraph } from './SigmaNetworkGraph.svelte';
export { default as NetworkSearchBar } from './NetworkSearchBar.svelte';
export { default as NetworkSidebar } from './NetworkSidebar.svelte';

// Type exports
export type { EntityMapping } from './modules/NetworkInteractionHandler';

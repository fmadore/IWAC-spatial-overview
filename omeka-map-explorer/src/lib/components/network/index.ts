/**
 * Network Components - Modular network visualization system
 * 
 * This module provides a complete modular network visualization system with:
 * - Clean separation of concerns between rendering, layout, and interaction
 * - Proper edge visibility and node interaction
 * - Performance-optimized Canvas2D rendering
 * - Flexible configuration and extensibility
 */

// Core modules
export { NetworkRenderer } from './modules/NetworkRenderer';
export { NetworkLayout } from './modules/NetworkLayout';
export { NetworkController } from './modules/NetworkController';
export { NetworkInteractionHandler } from './modules/NetworkInteractionHandler';
export { SigmaForceAtlasLayout } from './modules/SigmaForceAtlasLayout';

// Components
export { default as ModularNetworkGraph } from './ModularNetworkGraph.svelte';
export { default as ModularNetworkPanel } from './ModularNetworkPanel.svelte';
export { default as SigmaNetworkGraph } from './SigmaNetworkGraph.svelte';

// Type exports
export type { RenderConfig, Transform, Position } from './modules/NetworkRenderer';
export type { LayoutConfig } from './modules/NetworkLayout';
export type { NetworkControllerConfig, ViewState } from './modules/NetworkController';
export type { EntityMapping } from './modules/NetworkInteractionHandler';

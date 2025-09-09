/**
 * NetworkInteractionHandler - Manages network node interactions and entity selection
 * Provides clean interface between network visualization and application state
 */

import type { NetworkNode } from '$lib/types';
import { appState } from '$lib/state/appState.svelte';
import { applyFilters } from '$lib/state/networkData.svelte';

export interface EntityMapping {
  type: string;
  entityType: string;
  id: string;
  name: string;
}

export class NetworkInteractionHandler {
  private static readonly TYPE_MAPPING: Record<string, string> = {
    person: 'Personnes',
    organization: 'Organisations', 
    event: 'Événements',
    subject: 'Sujets',
    location: 'Lieux'
  };

  /**
   * Handle node selection - updates app state and applies filters
   */
  static handleNodeSelection(node: NetworkNode | null) {
    if (!node) {
      appState.networkNodeSelected = null;
      appState.selectedEntity = null;
      applyFilters();
      return;
    }

    // Update network selection
    appState.networkNodeSelected = { id: node.id };

    // Parse entity information from node ID
    const entityMapping = this.parseNodeId(node.id, node.label);
    if (entityMapping) {
      appState.selectedEntity = {
        type: entityMapping.entityType,
        id: entityMapping.id,
        name: entityMapping.name,
        relatedArticleIds: [] // Will be populated by filters
      };
    }

    // Apply filters to update map and other visualizations
    applyFilters();
  }

  /**
   * Handle node hover - update UI feedback
   */
  static handleNodeHover(node: NetworkNode | null) {
    // Could be used for tooltip updates or preview functionality
    // For now, this is handled by the renderer itself
  }

  /**
   * Handle node double-click - center view on node
   */
  static handleNodeDoubleClick(node: NetworkNode) {
    // This could trigger centering animation
    // The NetworkController handles the actual centering
  }

  /**
   * Parse node ID to extract entity information
   */
  private static parseNodeId(nodeId: string, nodeName: string): EntityMapping | null {
    const parts = nodeId.split(':');
    if (parts.length !== 2) return null;

    const [type, id] = parts;
    const entityType = this.TYPE_MAPPING[type];
    
    if (!entityType) return null;

    return {
      type,
      entityType,
      id,
      name: nodeName
    };
  }

  /**
   * Get entity type display name
   */
  static getEntityTypeDisplayName(type: string): string {
    return this.TYPE_MAPPING[type] || type;
  }

  /**
   * Check if a node represents a specific entity type
   */
  static isNodeOfType(node: NetworkNode, type: string): boolean {
    return node.id.startsWith(`${type}:`);
  }

  /**
   * Filter nodes by type
   */
  static filterNodesByType(nodes: NetworkNode[], types: string[]): NetworkNode[] {
    return nodes.filter(node => 
      types.some(type => this.isNodeOfType(node, type))
    );
  }

  /**
   * Get node color based on type
   */
  static getNodeColor(type: string): string {
    const colors: Record<string, string> = {
      person: '#2563eb',      // blue-600
      organization: '#7c3aed', // violet-600
      event: '#059669',       // emerald-600
      subject: '#d97706',     // amber-600
      location: '#ef4444',    // red-500
    };
    return colors[type] || '#6b7280'; // gray-500 as fallback
  }

  /**
   * Get all available entity types from nodes
   */
  static getAvailableTypes(nodes: NetworkNode[]): string[] {
    const types = new Set<string>();
    nodes.forEach(node => {
      const parts = node.id.split(':');
      if (parts.length === 2) {
        types.add(parts[0]);
      }
    });
    return Array.from(types).sort();
  }

  /**
   * Create entity selector data from network nodes
   */
  static createEntitySelectorData(nodes: NetworkNode[]) {
    return nodes.map(node => ({
      id: node.id,
      name: node.label,
      relatedArticleIds: [], // These would be populated from the network data
      articleCount: node.count
    }));
  }

  /**
   * Search nodes by label
   */
  static searchNodes(nodes: NetworkNode[], query: string): NetworkNode[] {
    if (!query.trim()) return nodes;
    
    const lowercaseQuery = query.toLowerCase();
    return nodes.filter(node => 
      node.label.toLowerCase().includes(lowercaseQuery)
    );
  }

  /**
   * Get node statistics
   */
  static getNodeStatistics(nodes: NetworkNode[]) {
    const typeStats: Record<string, number> = {};
    let totalCount = 0;
    let minCount = Infinity;
    let maxCount = -Infinity;

    nodes.forEach(node => {
      const parts = node.id.split(':');
      const type = parts[0] || 'unknown';
      
      typeStats[type] = (typeStats[type] || 0) + 1;
      totalCount += node.count;
      minCount = Math.min(minCount, node.count);
      maxCount = Math.max(maxCount, node.count);
    });

    return {
      totalNodes: nodes.length,
      totalCount,
      minCount: minCount === Infinity ? 0 : minCount,
      maxCount: maxCount === -Infinity ? 0 : maxCount,
      averageCount: nodes.length > 0 ? totalCount / nodes.length : 0,
      typeDistribution: typeStats
    };
  }
}

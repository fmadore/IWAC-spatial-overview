/**
 * NetworkEventHandlers - Centralized event handling for network interactions
 * 
 * Provides clean separation of event handling logic from the main component,
 * making it easier to test and maintain network interaction behaviors.
 */

import type { NetworkData, NetworkNode } from '$lib/types';
import { NetworkInteractionHandler } from './NetworkInteractionHandler';

export type KeyboardShortcut = 
  | 'fit' 
  | 'layout' 
  | 'center' 
  | 'clear' 
  | 'help';

export interface NetworkEventCallbacks {
  onFitView: () => void;
  onRunLayout: () => void;
  onCenterOnSelected: () => void;
  onClearSelection: () => void;
  onShowHelp: () => void;
}

export class NetworkEventHandlers {
  private callbacks: NetworkEventCallbacks;
  private currentData: NetworkData | null;

  constructor(callbacks: NetworkEventCallbacks) {
    this.callbacks = callbacks;
    this.currentData = null;
  }

  /**
   * Update the current network data reference
   */
  updateData(data: NetworkData | null): void {
    this.currentData = data;
  }

  /**
   * Set up sigma.js event listeners
   */
  setupSigmaEvents(sigmaInstance: any): void {
    if (!sigmaInstance) return;

    // Node click - select node and update app state
    sigmaInstance.on('clickNode', ({ node }: { node: string }) => {
      const nodeData = this.findNodeById(node);
      if (nodeData) {
        NetworkInteractionHandler.handleNodeSelection(nodeData);
      }
    });

    // Click on stage (background) to clear selection
    sigmaInstance.on('clickStage', () => {
      NetworkInteractionHandler.handleNodeSelection(null);
    });

    // Node hover - show preview information
    sigmaInstance.on('enterNode', ({ node }: { node: string }) => {
      const nodeData = this.findNodeById(node);
      if (nodeData) {
        NetworkInteractionHandler.handleNodeHover(nodeData);
      }
    });

    // Mouse leave node
    sigmaInstance.on('leaveNode', () => {
      NetworkInteractionHandler.handleNodeHover(null);
    });

    // Edge hover disabled to reduce noise and improve performance
  }

  /**
   * Handle keyboard shortcuts for network navigation
   */
  handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.currentData) return;

    const shortcut = this.mapKeyToShortcut(event.key.toLowerCase());
    if (!shortcut) return;

    event.preventDefault();
    this.executeShortcut(shortcut);
  };

  /**
   * Map keyboard keys to shortcuts
   */
  private mapKeyToShortcut(key: string): KeyboardShortcut | null {
    switch (key) {
      case 'f':
        return 'fit';
      case 'r':
        return 'layout';
      case 'c':
        return 'center';
      case 'escape':
        return 'clear';
      case 'h':
      case '?':
        return 'help';
      default:
        return null;
    }
  }

  /**
   * Execute a keyboard shortcut
   */
  private executeShortcut(shortcut: KeyboardShortcut): void {
    switch (shortcut) {
      case 'fit':
        this.callbacks.onFitView();
        break;
      case 'layout':
        this.callbacks.onRunLayout();
        break;
      case 'center':
        this.callbacks.onCenterOnSelected();
        break;
      case 'clear':
        this.callbacks.onClearSelection();
        break;
      case 'help':
        this.callbacks.onShowHelp();
        break;
    }
  }

  /**
   * Find node data by ID in current network data
   */
  private findNodeById(nodeId: string): NetworkNode | null {
    if (!this.currentData?.nodes) return null;
    return this.currentData.nodes.find(n => n.id === nodeId) || null;
  }

  /**
   * Get available keyboard shortcuts info
   */
  static getShortcutsHelp(): Record<KeyboardShortcut, string> {
    return {
      fit: 'F: Fit graph to view',
      layout: 'R: Run layout algorithm',
      center: 'C: Center on selected node',
      clear: 'Esc: Clear selection',
      help: 'H/?: Show keyboard shortcuts',
    };
  }

  /**
   * Show help in console
   */
  private showKeyboardHelp(): void {
    const shortcuts = NetworkEventHandlers.getShortcutsHelp();
    const helpText = [
      '🔧 Network Graph Controls:',
      ...Object.values(shortcuts).map(desc => `• ${desc}`),
      '• Drag nodes with mouse to reposition them',
      '• Click nodes to select, click background to deselect'
    ].join('\n');
    
    console.log(helpText);
  }

  /**
   * Update callbacks (useful for dynamic binding)
   */
  updateCallbacks(callbacks: Partial<NetworkEventCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Clean up event listeners
   */
  cleanup(): void {
    // Remove any global event listeners if needed
    // Currently using svelte:window binding, so cleanup is automatic
  }
}

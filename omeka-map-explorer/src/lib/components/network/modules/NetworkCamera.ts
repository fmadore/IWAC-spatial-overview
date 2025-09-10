/**
 * NetworkCamera - Camera control utilities for Sigma.js network visualization
 * 
 * Provides centralized camera management including fit to view, centering on nodes,
 * and smooth animations. Handles both manual camera controls and automatic adjustments.
 */

import { buildCameraSettings } from './SigmaConfigBuilder';

export interface CameraState {
  x: number;
  y: number;
  ratio: number;
}

export interface CameraBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export class NetworkCamera {
  private sigmaInstance: any;
  private graph: any;
  private container: HTMLElement;
  private SigmaUtils: any;
  private cameraAnimating = false;
  private settings = buildCameraSettings();

  constructor(sigmaInstance: any, graph: any, container: HTMLElement, SigmaUtils?: any) {
    this.sigmaInstance = sigmaInstance;
    this.graph = graph;
    this.container = container;
    this.SigmaUtils = SigmaUtils;
  }

  /**
   * Update references when sigma instance or graph changes
   */
  updateReferences(sigmaInstance: any, graph: any): void {
    this.sigmaInstance = sigmaInstance;
    this.graph = graph;
  }

  /**
   * Reset view to show all nodes using Sigma.js utils when available
   */
  resetToFullView(): void {
    if (!this.sigmaInstance || !this.graph) return;
    
    try {
      const allNodes = this.graph.nodes();
      if (allNodes.length === 0) return;
      
      // Use Sigma.js utils for optimal fitting when available
      if (this.SigmaUtils && this.SigmaUtils.fitViewportToNodes) {
        this.SigmaUtils.fitViewportToNodes(this.sigmaInstance, allNodes);
      } else {
        // Fallback to manual fit calculation
        this.fitToView();
      }
    } catch (err) {
      console.warn('Reset to full view failed, using fallback:', err);
      this.fitToView();
    }
  }

  /**
   * Enhanced fit graph to view with padding and smooth animation
   */
  fitToView(): void {
    if (!this.sigmaInstance || !this.graph) return;
    
    try {
      if (this.cameraAnimating) return; // Prevent stacking animations
      
      const camera = this.sigmaInstance.getCamera();
      const bounds = this.calculateGraphBounds();
      
      if (!bounds) return;

      const { centerX, centerY, span } = this.calculateViewParameters(bounds);
      const padding = span * this.settings.padding;
      
      this.cameraAnimating = true;
      camera.animate(
        { 
          x: centerX, 
          y: centerY, 
          ratio: (span + padding) / Math.min(this.container.clientWidth, this.container.clientHeight) 
        },
        { 
          duration: this.settings.fitAnimationDuration, 
          easing: this.settings.easing 
        }
      );
      
      // Reset animation flag after completion
      setTimeout(() => { 
        this.cameraAnimating = false; 
      }, this.settings.fitAnimationDuration + 50);
      
    } catch (err) {
      console.warn('Fit to view failed:', err);
      this.cameraAnimating = false;
    }
  }

  /**
   * Center camera on a specific node
   */
  centerOnNode(nodeId: string, zoomRatio: number = 0.5): void {
    if (!this.sigmaInstance || !this.graph || !this.graph.hasNode(nodeId)) return;
    
    try {
      const nodeAttrs = this.graph.getNodeAttributes(nodeId);
      const camera = this.sigmaInstance.getCamera();
      
      camera.animate(
        { x: nodeAttrs.x, y: nodeAttrs.y, ratio: zoomRatio },
        { 
          duration: this.settings.centerAnimationDuration,
          easing: this.settings.easing 
        }
      );
    } catch (err) {
      console.warn('Center on node failed:', err);
    }
  }

  /**
   * Focus on a node with closer zoom
   */
  focusOnNode(nodeId: string): void {
    this.centerOnNode(nodeId, 0.3);
  }

  /**
   * Get current camera state
   */
  getCameraState(): CameraState | null {
    if (!this.sigmaInstance) return null;
    
    try {
      const camera = this.sigmaInstance.getCamera();
      return camera.getState();
    } catch (err) {
      console.warn('Failed to get camera state:', err);
      return null;
    }
  }

  /**
   * Set camera state
   */
  setCameraState(state: CameraState): void {
    if (!this.sigmaInstance) return;
    
    try {
      const camera = this.sigmaInstance.getCamera();
      camera.setState(state);
    } catch (err) {
      console.warn('Failed to set camera state:', err);
    }
  }

  /**
   * Animate camera to specific state
   */
  animateToState(state: CameraState, duration?: number): void {
    if (!this.sigmaInstance) return;
    
    try {
      const camera = this.sigmaInstance.getCamera();
      camera.animate(
        state,
        { 
          duration: duration || this.settings.centerAnimationDuration,
          easing: this.settings.easing 
        }
      );
    } catch (err) {
      console.warn('Failed to animate camera:', err);
    }
  }

  /**
   * Calculate bounds of all nodes including their sizes
   */
  private calculateGraphBounds(): CameraBounds | null {
    const nodes = this.graph.nodes();
    if (nodes.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    nodes.forEach((nodeId: string) => {
      const attrs = this.graph.getNodeAttributes(nodeId);
      const nodeSize = attrs.size || 10;
      minX = Math.min(minX, attrs.x - nodeSize);
      minY = Math.min(minY, attrs.y - nodeSize);
      maxX = Math.max(maxX, attrs.x + nodeSize);
      maxY = Math.max(maxY, attrs.y + nodeSize);
    });

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      return null;
    }

    return { minX, minY, maxX, maxY };
  }

  /**
   * Calculate view parameters from bounds
   */
  private calculateViewParameters(bounds: CameraBounds): {
    centerX: number;
    centerY: number;
    span: number;
  } {
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const spanX = bounds.maxX - bounds.minX;
    const spanY = bounds.maxY - bounds.minY;
    const span = Math.max(spanX, spanY) || 100;

    return { centerX, centerY, span };
  }

  /**
   * Check if camera is currently animating
   */
  isAnimating(): boolean {
    return this.cameraAnimating;
  }

  /**
   * Update settings
   */
  updateSettings(newSettings: Partial<typeof this.settings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * Get current zoom level
   */
  getZoomLevel(): number {
    const state = this.getCameraState();
    return state ? 1 / state.ratio : 1;
  }

  /**
   * Check if a specific node is in the current viewport
   */
  isNodeInViewport(nodeId: string): boolean {
    if (!this.graph.hasNode(nodeId)) return false;
    
    try {
      const nodeAttrs = this.graph.getNodeAttributes(nodeId);
      const state = this.getCameraState();
      if (!state) return false;

      // Simple viewport bounds calculation
      const viewportHalfWidth = (this.container.clientWidth / 2) * state.ratio;
      const viewportHalfHeight = (this.container.clientHeight / 2) * state.ratio;
      
      return (
        nodeAttrs.x >= state.x - viewportHalfWidth &&
        nodeAttrs.x <= state.x + viewportHalfWidth &&
        nodeAttrs.y >= state.y - viewportHalfHeight &&
        nodeAttrs.y <= state.y + viewportHalfHeight
      );
    } catch (err) {
      return false;
    }
  }
}

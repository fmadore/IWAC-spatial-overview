/**
 * NetworkController - Orchestrates network visualization components
 * Manages interaction between layout, rendering, and user input
 */

import type { NetworkData, NetworkNode } from '$lib/types';
import { NetworkRenderer, type RenderConfig, type Transform } from './NetworkRenderer';
import { NetworkLayout, type LayoutConfig } from './NetworkLayout';

export interface NetworkControllerConfig {
  canvas: HTMLCanvasElement;
  renderConfig: RenderConfig;
  layoutConfig: LayoutConfig;
  onNodeClick?: (node: NetworkNode) => void;
  onNodeHover?: (node: NetworkNode | null) => void;
  onSelectionChange?: (nodeId: string | null) => void;
}

export interface ViewState {
  transform: Transform;
  hoveredNodeId: string | null;
  selectedNodeId: string | null;
  isDragging: boolean;
  lastUpdateTime: number;
}

export class NetworkController {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private renderer: NetworkRenderer;
  private layout: NetworkLayout;
  
  private data: NetworkData | null = null;
  private viewState: ViewState;
  private animationFrame: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  
  // Interaction state
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private transformStart: Transform = { scale: 1, translateX: 0, translateY: 0 };
  
  // Event callbacks
  private onNodeClick?: (node: NetworkNode) => void;
  private onNodeHover?: (node: NetworkNode | null) => void;
  private onSelectionChange?: (nodeId: string | null) => void;

  constructor(config: NetworkControllerConfig) {
    this.canvas = config.canvas;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D rendering context');
    }
    this.ctx = ctx;

    this.renderer = new NetworkRenderer(ctx, config.renderConfig);
    this.layout = new NetworkLayout(config.layoutConfig);
    
    this.onNodeClick = config.onNodeClick;
    this.onNodeHover = config.onNodeHover;
    this.onSelectionChange = config.onSelectionChange;

    this.viewState = {
      transform: { scale: 1, translateX: 0, translateY: 0 },
      hoveredNodeId: null,
      selectedNodeId: null,
      isDragging: false,
      lastUpdateTime: 0
    };

    this.setupEventListeners();
    this.setupResizeObserver();
    this.updateCanvasSize();
  }

  // Public API
  setData(data: NetworkData | null) {
    this.data = data;
    if (data) {
      this.layout.initializePositions(data.nodes);
      this.renderer.setPositions(this.layout.getPositions());
      this.renderer.buildNeighborCache(data.edges);
      this.fitToView();
      this.render();
    }
  }

  async runLayout(onProgress?: (progress: number) => void) {
    if (!this.data) return;
    
    // Stop any existing layout first
    this.layout.stop();
    
    await this.layout.runD3Layout(this.data, onProgress);
    this.renderer.setPositions(this.layout.getPositions());
    this.render();
  }

  stopLayout() {
    this.layout.stop();
  }

  setSelectedNode(nodeId: string | null) {
    if (this.viewState.selectedNodeId !== nodeId) {
      this.viewState.selectedNodeId = nodeId;
      this.renderer.updateConfig({ selectedNodeId: nodeId });
      this.render();
      this.onSelectionChange?.(nodeId);
    }
  }

  centerOnNode(nodeId: string) {
    const center = this.layout.centerOnNode(nodeId, this.canvas.width, this.canvas.height);
    if (center) {
      this.viewState.transform.translateX = center.x;
      this.viewState.transform.translateY = center.y;
      this.render();
    }
  }

  fitToView() {
    const fit = this.layout.fitToView(this.canvas.width, this.canvas.height);
    if (fit) {
      this.viewState.transform = {
        scale: fit.scale,
        translateX: fit.x,
        translateY: fit.y
      };
      this.render();
    }
  }

  updateRenderConfig(config: Partial<RenderConfig>) {
    this.renderer.updateConfig(config);
    this.render();
  }

  updateLayoutConfig(config: Partial<LayoutConfig>) {
    this.layout.updateConfig(config);
  }

  destroy() {
    this.cleanup();
  }

  // Private methods
  private setupEventListeners() {
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    this.canvas.addEventListener('click', this.handleClick.bind(this));
    
    // Prevent context menu
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private setupResizeObserver() {
    this.resizeObserver = new ResizeObserver(() => {
      this.updateCanvasSize();
      this.render();
    });
    this.resizeObserver.observe(this.canvas.parentElement || this.canvas);
  }

  private updateCanvasSize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    this.renderer.updateConfig({
      width: rect.width,
      height: rect.height
    });
    
    this.layout.updateConfig({
      width: rect.width,
      height: rect.height
    });
  }

  private render() {
    if (!this.data) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    // Update renderer state
    this.renderer.updateConfig({
      hoveredNodeId: this.viewState.hoveredNodeId,
      selectedNodeId: this.viewState.selectedNodeId
    });

    this.renderer.render(this.data, this.viewState.transform);
    this.viewState.lastUpdateTime = performance.now();
  }

  private getMousePosition(event: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  private handleWheel(event: WheelEvent) {
    event.preventDefault();
    
    const mouse = this.getMousePosition(event);
    const { transform } = this.viewState;
    
    // Calculate zoom
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(3, transform.scale * zoomFactor));
    
    // Zoom towards mouse position
    const dx = mouse.x - transform.translateX;
    const dy = mouse.y - transform.translateY;
    
    transform.translateX = mouse.x - dx * (newScale / transform.scale);
    transform.translateY = mouse.y - dy * (newScale / transform.scale);
    transform.scale = newScale;
    
    this.render();
  }

  private handleMouseDown(event: MouseEvent) {
    if (event.button !== 0) return; // Only left mouse button
    
    this.isDragging = true;
    this.canvas.style.cursor = 'grabbing';
    
    const mouse = this.getMousePosition(event);
    this.dragStart = mouse;
    this.transformStart = { ...this.viewState.transform };
    
    event.preventDefault();
  }

  private handleMouseMove(event: MouseEvent) {
    const mouse = this.getMousePosition(event);
    
    if (this.isDragging) {
      // Pan the view
      const dx = mouse.x - this.dragStart.x;
      const dy = mouse.y - this.dragStart.y;
      
      this.viewState.transform.translateX = this.transformStart.translateX + dx;
      this.viewState.transform.translateY = this.transformStart.translateY + dy;
      
      this.render();
    } else {
      // Update hover state
      const hoveredNode = this.data ? 
        this.renderer.hitTest(mouse.x, mouse.y, this.data.nodes, this.viewState.transform) : 
        null;
      
      const newHoveredId = hoveredNode?.id || null;
      
      if (this.viewState.hoveredNodeId !== newHoveredId) {
        this.viewState.hoveredNodeId = newHoveredId;
        this.canvas.style.cursor = hoveredNode ? 'pointer' : 'default';
        this.onNodeHover?.(hoveredNode);
        this.render();
      }
    }
  }

  private handleMouseUp() {
    this.isDragging = false;
    this.canvas.style.cursor = this.viewState.hoveredNodeId ? 'pointer' : 'default';
  }

  private handleMouseLeave() {
    this.isDragging = false;
    this.viewState.hoveredNodeId = null;
    this.canvas.style.cursor = 'default';
    this.onNodeHover?.(null);
    this.render();
  }

  private handleClick(event: MouseEvent) {
    if (this.isDragging) return; // Don't trigger click if we were dragging
    
    const mouse = this.getMousePosition(event);
    const clickedNode = this.data ? 
      this.renderer.hitTest(mouse.x, mouse.y, this.data.nodes, this.viewState.transform) : 
      null;
    
    if (clickedNode) {
      this.setSelectedNode(clickedNode.id);
      this.onNodeClick?.(clickedNode);
    } else {
      this.setSelectedNode(null);
    }
  }

  private cleanup() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    this.layout.stop();
  }
}

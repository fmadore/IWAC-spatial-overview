/**
 * NetworkRenderer - Core rendering engine for network visualization
 * Handles Canvas2D rendering with proper edge visibility and node interactions
 */

import type { NetworkData, NetworkNode, NetworkEdge } from '$lib/types';

export interface RenderConfig {
  width: number;
  height: number;
  nodeMinSize: number;
  nodeMaxSize: number;
  edgeMinWidth: number;
  edgeMaxWidth: number;
  nodeColors: Record<string, string>;
  backgroundColor: string;
  selectedNodeId?: string | null;
  hoveredNodeId?: string | null;
}

export interface Position {
  x: number;
  y: number;
  r: number;
}

export interface Transform {
  scale: number;
  translateX: number;
  translateY: number;
}

export class NetworkRenderer {
  private ctx: CanvasRenderingContext2D;
  private config: RenderConfig;
  private positions: Map<string, Position> = new Map();
  private neighborCache: Map<string, Set<string>> = new Map();

  constructor(ctx: CanvasRenderingContext2D, config: RenderConfig) {
    this.ctx = ctx;
    this.config = config;
  }

  updateConfig(config: Partial<RenderConfig>) {
    this.config = { ...this.config, ...config };
  }

  setPositions(positions: Map<string, Position>) {
    this.positions = positions;
  }

  buildNeighborCache(edges: NetworkEdge[]) {
    this.neighborCache.clear();
    for (const edge of edges) {
      if (!this.neighborCache.has(edge.source)) {
        this.neighborCache.set(edge.source, new Set());
      }
      if (!this.neighborCache.has(edge.target)) {
        this.neighborCache.set(edge.target, new Set());
      }
      this.neighborCache.get(edge.source)!.add(edge.target);
      this.neighborCache.get(edge.target)!.add(edge.source);
    }
  }

  getNeighbors(nodeId: string): Set<string> {
    return this.neighborCache.get(nodeId) || new Set();
  }

  render(data: NetworkData, transform: Transform) {
    const { ctx, config } = this;
    const { scale, translateX, translateY } = transform;

    // Clear canvas
    ctx.clearRect(0, 0, config.width, config.height);
    ctx.fillStyle = config.backgroundColor;
    ctx.fillRect(0, 0, config.width, config.height);

    // Get highlight sets
    const selectedNeighbors = config.selectedNodeId 
      ? this.getNeighbors(config.selectedNodeId) 
      : new Set<string>();

    // Render edges first (so they appear behind nodes)
    this.renderEdges(data.edges, transform, selectedNeighbors);

    // Render nodes on top
    this.renderNodes(data.nodes, transform, selectedNeighbors);
  }

  private renderEdges(edges: NetworkEdge[], transform: Transform, selectedNeighbors: Set<string>) {
    const { ctx, config, positions } = this;
    const { scale, translateX, translateY } = transform;

    if (edges.length === 0) return;

    // Calculate edge weight range for normalization
    const weights = edges.map(e => e.weight);
    const minWeight = Math.min(...weights);
    const maxWeight = Math.max(...weights);
    const weightRange = maxWeight - minWeight || 1;

    ctx.save();

    for (const edge of edges) {
      const sourcePos = positions.get(edge.source);
      const targetPos = positions.get(edge.target);

      if (!sourcePos || !targetPos) continue;

      // Transform positions to screen space
      const x1 = sourcePos.x * scale + translateX;
      const y1 = sourcePos.y * scale + translateY;
      const x2 = targetPos.x * scale + translateX;
      const y2 = targetPos.y * scale + translateY;

      // Calculate edge properties
      const normalizedWeight = (edge.weight - minWeight) / weightRange;
      const baseWidth = config.edgeMinWidth + (config.edgeMaxWidth - config.edgeMinWidth) * normalizedWeight;
      
      // Determine visibility and style based on selection
      let opacity = 0.15; // Base opacity for visible edges
      let width = baseWidth;

      if (config.selectedNodeId) {
        const isConnectedToSelected = 
          edge.source === config.selectedNodeId || 
          edge.target === config.selectedNodeId;
        
        if (isConnectedToSelected) {
          opacity = 0.7; // Highlight connected edges
          width = baseWidth * 1.5;
        } else {
          opacity = 0.05; // Fade non-connected edges
          width = baseWidth * 0.7;
        }
      }

      // Set edge style
      ctx.strokeStyle = `rgba(100, 116, 139, ${opacity})`; // slate-500 with opacity
      ctx.lineWidth = width;
      ctx.lineCap = 'round';

      // Draw edge
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderNodes(nodes: NetworkNode[], transform: Transform, selectedNeighbors: Set<string>) {
    const { ctx, config, positions } = this;
    const { scale, translateX, translateY } = transform;

    // Calculate node size range for normalization
    const counts = nodes.map(n => n.count);
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);
    const countRange = maxCount - minCount || 1;

    ctx.save();

    for (const node of nodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;

      // Transform position to screen space
      const x = pos.x * scale + translateX;
      const y = pos.y * scale + translateY;

      // Calculate node properties
      const normalizedCount = (node.count - minCount) / countRange;
      let baseSize = config.nodeMinSize + (config.nodeMaxSize - config.nodeMinSize) * normalizedCount;
      
      // Determine highlighting
      const isSelected = node.id === config.selectedNodeId;
      const isNeighbor = selectedNeighbors.has(node.id);
      const isHovered = node.id === config.hoveredNodeId;

      // Adjust size and opacity based on state
      let size = baseSize;
      let opacity = 1;

      if (isSelected) {
        size *= 1.4;
      } else if (isNeighbor) {
        size *= 1.2;
      } else if (config.selectedNodeId) {
        opacity = 0.4; // Fade non-connected nodes
        size *= 0.9;
      }

      if (isHovered && !isSelected) {
        size *= 1.1;
      }

      // Get node color
      const color = config.nodeColors[node.type] || '#6b7280';

      // Draw node
      ctx.beginPath();
      ctx.arc(x, y, size * scale, 0, Math.PI * 2);
      ctx.fillStyle = this.adjustColorOpacity(color, opacity);
      ctx.fill();

      // Draw selection ring
      if (isSelected) {
        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (isHovered) {
        ctx.strokeStyle = '#6b7280';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw node labels for important nodes when zoomed in
      if (scale > 0.8 && (isSelected || isNeighbor || node.count > maxCount * 0.7)) {
        this.renderNodeLabel(node, x, y, size * scale);
      }
    }

    ctx.restore();
  }

  private renderNodeLabel(node: NetworkNode, x: number, y: number, size: number) {
    const { ctx } = this;
    
    ctx.save();
    ctx.fillStyle = '#1f2937';
    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw text background
    const textWidth = ctx.measureText(node.label).width;
    const padding = 4;
    const bgHeight = 16;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(
      x - textWidth / 2 - padding, 
      y + size + 4, 
      textWidth + padding * 2, 
      bgHeight
    );
    
    // Draw text
    ctx.fillStyle = '#1f2937';
    ctx.fillText(node.label, x, y + size + 12);
    
    ctx.restore();
  }

  private adjustColorOpacity(color: string, opacity: number): string {
    // Handle hex colors
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return color;
  }

  // Hit testing for mouse interactions
  hitTest(x: number, y: number, nodes: NetworkNode[], transform: Transform): NetworkNode | null {
    const { positions } = this;
    const { scale, translateX, translateY } = transform;

    // Convert screen coordinates to world coordinates
    const worldX = (x - translateX) / scale;
    const worldY = (y - translateY) / scale;

    // Test nodes in reverse order (last drawn = on top)
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const pos = positions.get(node.id);
      if (!pos) continue;

      const dx = worldX - pos.x;
      const dy = worldY - pos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= pos.r) {
        return node;
      }
    }

    return null;
  }
}

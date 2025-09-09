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

    // Sort edges by selection state (selected edges on top)
    const sortedEdges = [...edges].sort((a, b) => {
      const aIsConnected = config.selectedNodeId && 
        (a.source === config.selectedNodeId || a.target === config.selectedNodeId);
      const bIsConnected = config.selectedNodeId && 
        (b.source === config.selectedNodeId || b.target === config.selectedNodeId);
      
      if (aIsConnected && !bIsConnected) return 1;
      if (!aIsConnected && bIsConnected) return -1;
      return 0;
    });

    for (const edge of sortedEdges) {
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
      
      // Determine visibility and style based on selection and hover
      let opacity = 0.2; // Base opacity for visible edges
      let width = baseWidth;
      let color = '100, 116, 139'; // slate-500

      if (config.selectedNodeId) {
        const isConnectedToSelected = 
          edge.source === config.selectedNodeId || 
          edge.target === config.selectedNodeId;
        
        if (isConnectedToSelected) {
          opacity = 0.9; // Strong highlight for connected edges
          width = Math.max(baseWidth * 2.5, 3); // Ensure minimum width for visibility
          color = '59, 130, 246'; // blue-500 for highlighted edges
        } else {
          opacity = 0.08; // Very faint for unconnected edges
          width = baseWidth * 0.6;
        }
      } else if (config.hoveredNodeId) {
        // Hover state: more subtle highlighting
        const isConnectedToHovered = 
          edge.source === config.hoveredNodeId || 
          edge.target === config.hoveredNodeId;
        
        if (isConnectedToHovered) {
          opacity = 0.6;
          width = baseWidth * 1.8;
          color = '79, 70, 229'; // indigo-600 for hovered edges
        } else {
          opacity = 0.1;
        }
      }

      // Set edge style with gradient for selected edges
      if (config.selectedNodeId && 
          (edge.source === config.selectedNodeId || edge.target === config.selectedNodeId)) {
        // Create gradient for highlighted edges
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        gradient.addColorStop(0, `rgba(${color}, ${opacity})`);
        gradient.addColorStop(0.5, `rgba(${color}, ${opacity * 0.8})`);
        gradient.addColorStop(1, `rgba(${color}, ${opacity})`);
        ctx.strokeStyle = gradient;
      } else {
        ctx.strokeStyle = `rgba(${color}, ${opacity})`;
      }
      
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Add subtle shadow for highlighted edges
      if (config.selectedNodeId && 
          (edge.source === config.selectedNodeId || edge.target === config.selectedNodeId)) {
        ctx.shadowColor = `rgba(${color}, 0.3)`;
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

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

    // Sort nodes to render selected/important ones last (on top)
    const sortedNodes = [...nodes].sort((a, b) => {
      const aIsSelected = a.id === config.selectedNodeId;
      const bIsSelected = b.id === config.selectedNodeId;
      const aIsNeighbor = selectedNeighbors.has(a.id);
      const bIsNeighbor = selectedNeighbors.has(b.id);
      
      if (aIsSelected && !bIsSelected) return 1;
      if (!aIsSelected && bIsSelected) return -1;
      if (aIsNeighbor && !bIsNeighbor) return 1;
      if (!aIsNeighbor && bIsNeighbor) return -1;
      return 0;
    });

    for (const node of sortedNodes) {
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
      let glowIntensity = 0;

      if (isSelected) {
        size *= 1.5;
        glowIntensity = 0.6;
      } else if (isNeighbor) {
        size *= 1.3;
        opacity = 0.9;
        glowIntensity = 0.3;
      } else if (config.selectedNodeId) {
        opacity = 0.3; // Fade non-connected nodes more
        size *= 0.85;
      }

      if (isHovered && !isSelected) {
        size *= 1.15;
        glowIntensity = Math.max(glowIntensity, 0.2);
      }

      // Get node color
      const color = config.nodeColors[node.type] || '#6b7280';

      // Add glow effect for highlighted nodes
      if (glowIntensity > 0) {
        ctx.shadowColor = color;
        ctx.shadowBlur = glowIntensity * 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      // Draw node
      ctx.beginPath();
      ctx.arc(x, y, size * scale, 0, Math.PI * 2);
      ctx.fillStyle = this.adjustColorOpacity(color, opacity);
      ctx.fill();

      // Reset shadow for stroke
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Draw selection ring with enhanced styling
      if (isSelected) {
        // Double ring for selected node
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(x, y, size * scale + 2, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (isNeighbor) {
        ctx.strokeStyle = this.adjustColorOpacity(color, 0.8);
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (isHovered) {
        ctx.strokeStyle = '#6b7280';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Enhanced label rendering conditions
      const shouldShowLabel = 
        isSelected || 
        isHovered ||
        (isNeighbor && scale > 0.6) ||
        (scale > 1.2 && node.count > maxCount * 0.6) ||
        (scale > 2.0); // Show all labels when very zoomed in

      if (shouldShowLabel) {
        this.renderNodeLabel(node, x, y, size * scale, isSelected, isNeighbor);
      }
    }

    ctx.restore();
  }

  private renderNodeLabel(node: NetworkNode, x: number, y: number, size: number, isSelected: boolean = false, isNeighbor: boolean = false) {
    const { ctx } = this;
    
    ctx.save();
    
    // Determine label style based on node importance
    let fontSize = 11;
    let fontWeight = 'normal';
    let textColor = '#1f2937';
    let bgOpacity = 0.9;
    
    if (isSelected) {
      fontSize = 14;
      fontWeight = 'bold';
      textColor = '#1f2937';
      bgOpacity = 0.95;
    } else if (isNeighbor) {
      fontSize = 12;
      fontWeight = '500';
      textColor = '#374151';
      bgOpacity = 0.9;
    }
    
    ctx.font = `${fontWeight} ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Measure text for background
    const textMetrics = ctx.measureText(node.label);
    const textWidth = textMetrics.width;
    const textHeight = fontSize;
    const padding = isSelected ? 6 : 4;
    const bgHeight = textHeight + padding;
    
    // Position label below the node
    const labelY = y + size + textHeight/2 + 8;
    
    // Draw rounded background
    const bgX = x - textWidth / 2 - padding;
    const bgY = labelY - textHeight/2 - padding/2;
    const bgWidth = textWidth + padding * 2;
    const cornerRadius = 4;
    
    ctx.fillStyle = `rgba(255, 255, 255, ${bgOpacity})`;
    ctx.strokeStyle = `rgba(0, 0, 0, 0.1)`;
    ctx.lineWidth = 0.5;
    
    // Draw rounded rectangle background
    ctx.beginPath();
    ctx.roundRect(bgX, bgY, bgWidth, bgHeight, cornerRadius);
    ctx.fill();
    ctx.stroke();
    
    // Add subtle shadow for selected nodes
    if (isSelected) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
    }
    
    // Draw text
    ctx.fillStyle = textColor;
    ctx.fillText(node.label, x, labelY);
    
    // Add article count for selected nodes
    if (isSelected && node.count > 1) {
      ctx.font = `normal 10px Inter, system-ui, sans-serif`;
      ctx.fillStyle = '#6b7280';
      ctx.fillText(`(${node.count} articles)`, x, labelY + 14);
    }
    
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

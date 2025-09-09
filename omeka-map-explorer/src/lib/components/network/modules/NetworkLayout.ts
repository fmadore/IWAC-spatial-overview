/**
 * NetworkLayout - Handles force-directed layout calculation
 * Provides a clean interface for layout algorithms and position management
 */

import type { NetworkData, NetworkNode, NetworkEdge } from '$lib/types';
import type { Position } from './NetworkRenderer';

export interface LayoutConfig {
  width: number;
  height: number;
  iterations: number;
  nodeRepulsion: number;
  linkStrength: number;
  centerForce: number;
  minNodeSize: number;
  maxNodeSize: number;
}

export class NetworkLayout {
  private positions: Map<string, Position> = new Map();
  private velocities: Map<string, { vx: number; vy: number }> = new Map();
  private config: LayoutConfig;
  private simulation: any = null;

  constructor(config: LayoutConfig) {
    this.config = config;
  }

  updateConfig(config: Partial<LayoutConfig>) {
    this.config = { ...this.config, ...config };
  }

  getPositions(): Map<string, Position> {
    return this.positions;
  }

  setPositions(positions: Map<string, Position>) {
    this.positions = positions;
  }

  // Initialize positions in a circular arrangement
  initializePositions(nodes: NetworkNode[]) {
    const { width, height, minNodeSize, maxNodeSize } = this.config;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.3;

    // Calculate node size range
    const counts = nodes.map(n => n.count);
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);
    const countRange = maxCount - minCount || 1;

    nodes.forEach((node, index) => {
      // Skip if position already exists
      if (this.positions.has(node.id)) {
        // Update radius based on count
        const pos = this.positions.get(node.id)!;
        const normalizedCount = (node.count - minCount) / countRange;
        pos.r = minNodeSize + (maxNodeSize - minNodeSize) * normalizedCount;
        return;
      }

      // Calculate position
      const angle = (index / nodes.length) * Math.PI * 2;
      const jitter = (Math.random() - 0.5) * 0.1; // Small random offset
      const x = centerX + Math.cos(angle + jitter) * radius;
      const y = centerY + Math.sin(angle + jitter) * radius;

      // Calculate node size
      const normalizedCount = (node.count - minCount) / countRange;
      const r = minNodeSize + (maxNodeSize - minNodeSize) * normalizedCount;

      this.positions.set(node.id, { x, y, r });
      this.velocities.set(node.id, { vx: 0, vy: 0 });
    });
  }

  // Run force-directed layout using D3 force simulation
  async runD3Layout(data: NetworkData, onProgress?: (progress: number) => void): Promise<void> {
    try {
      // Lazy import D3 force
      const d3 = await import('d3-force');
      
      const { width, height, iterations, nodeRepulsion, linkStrength, centerForce } = this.config;

      // Convert positions to D3 format
      const simNodes = data.nodes.map(node => {
        const pos = this.positions.get(node.id);
        return {
          id: node.id,
          x: pos?.x || width / 2,
          y: pos?.y || height / 2,
          count: node.count
        };
      });

      const simLinks = data.edges.map(edge => ({
        source: edge.source,
        target: edge.target,
        weight: edge.weight
      }));

      // Create simulation
      this.simulation = d3.forceSimulation(simNodes)
        .force('link', d3.forceLink(simLinks)
          .id((d: any) => d.id)
          .strength(linkStrength)
          .distance(50)
        )
        .force('charge', d3.forceManyBody()
          .strength(-nodeRepulsion)
        )
        .force('center', d3.forceCenter(width / 2, height / 2)
          .strength(centerForce)
        )
        .force('collision', d3.forceCollide()
          .radius((d: any) => {
            const pos = this.positions.get(d.id);
            return (pos?.r || 5) + 2; // Add padding
          })
        )
        .alphaDecay(0.02)
        .velocityDecay(0.3);

      // Run simulation
      return new Promise((resolve) => {
        let tickCount = 0;
        let resolved = false;
        
        const finish = () => {
          if (resolved) return;
          resolved = true;
          if (this.simulation) {
            this.simulation.stop();
          }
          resolve();
        };
        
        this.simulation.on('tick', () => {
          // Update positions from simulation
          simNodes.forEach(d => {
            const pos = this.positions.get(d.id);
            if (pos) {
              pos.x = d.x!;
              pos.y = d.y!;
            }
          });

          tickCount++;
          if (onProgress) {
            onProgress(Math.min(1, tickCount / iterations));
          }
          
          // Stop after specified iterations
          if (tickCount >= iterations) {
            finish();
          }
        });

        this.simulation.on('end', finish);

        // Fallback timeout
        setTimeout(finish, Math.max(5000, iterations * 20)); // Max 5 seconds or iterations * 20ms
      });

    } catch (error) {
      console.warn('D3 force layout not available, using simple layout');
      return this.runSimpleLayout(data, onProgress);
    }
  }

  // Fallback simple force layout
  runSimpleLayout(data: NetworkData, onProgress?: (progress: number) => void): Promise<void> {
    return new Promise((resolve) => {
      const { width, height, iterations, nodeRepulsion, linkStrength } = this.config;

      for (let i = 0; i < iterations; i++) {
        // Reset forces
        this.velocities.forEach(vel => {
          vel.vx *= 0.9; // Damping
          vel.vy *= 0.9;
        });

        // Apply repulsive forces between nodes
        data.nodes.forEach(nodeA => {
          const posA = this.positions.get(nodeA.id);
          const velA = this.velocities.get(nodeA.id);
          if (!posA || !velA) return;

          data.nodes.forEach(nodeB => {
            if (nodeA.id === nodeB.id) return;
            
            const posB = this.positions.get(nodeB.id);
            if (!posB) return;

            const dx = posA.x - posB.x;
            const dy = posA.y - posB.y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            
            const force = nodeRepulsion / (distance * distance);
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;

            velA.vx += fx;
            velA.vy += fy;
          });
        });

        // Apply attractive forces for connected nodes
        data.edges.forEach(edge => {
          const posA = this.positions.get(edge.source);
          const posB = this.positions.get(edge.target);
          const velA = this.velocities.get(edge.source);
          const velB = this.velocities.get(edge.target);

          if (!posA || !posB || !velA || !velB) return;

          const dx = posB.x - posA.x;
          const dy = posB.y - posA.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const force = linkStrength * (distance - 50); // Target distance of 50
          const fx = (dx / distance) * force * 0.1;
          const fy = (dy / distance) * force * 0.1;

          velA.vx += fx;
          velA.vy += fy;
          velB.vx -= fx;
          velB.vy -= fy;
        });

        // Apply centering force
        const centerX = width / 2;
        const centerY = height / 2;
        
        data.nodes.forEach(node => {
          const pos = this.positions.get(node.id);
          const vel = this.velocities.get(node.id);
          if (!pos || !vel) return;

          const dx = centerX - pos.x;
          const dy = centerY - pos.y;
          
          vel.vx += dx * 0.001;
          vel.vy += dy * 0.001;
        });

        // Update positions
        this.positions.forEach((pos, id) => {
          const vel = this.velocities.get(id);
          if (!vel) return;

          pos.x += vel.vx;
          pos.y += vel.vy;

          // Keep nodes within bounds
          pos.x = Math.max(pos.r, Math.min(width - pos.r, pos.x));
          pos.y = Math.max(pos.r, Math.min(height - pos.r, pos.y));
        });

        if (onProgress && i % 10 === 0) {
          onProgress(i / iterations);
        }
      }

      if (onProgress) {
        onProgress(1);
      }
      
      resolve();
    });
  }

  // Center layout on a specific node
  centerOnNode(nodeId: string, viewWidth: number, viewHeight: number): { x: number; y: number } | null {
    const pos = this.positions.get(nodeId);
    if (!pos) return null;

    return {
      x: viewWidth / 2 - pos.x,
      y: viewHeight / 2 - pos.y
    };
  }

  // Get bounding box of all nodes
  getBounds(): { minX: number; minY: number; maxX: number; maxY: number } | null {
    if (this.positions.size === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    this.positions.forEach(pos => {
      minX = Math.min(minX, pos.x - pos.r);
      minY = Math.min(minY, pos.y - pos.r);
      maxX = Math.max(maxX, pos.x + pos.r);
      maxY = Math.max(maxY, pos.y + pos.r);
    });

    return { minX, minY, maxX, maxY };
  }

  // Fit layout to view
  fitToView(viewWidth: number, viewHeight: number, padding = 50): { scale: number; x: number; y: number } | null {
    const bounds = this.getBounds();
    if (!bounds) return null;

    const { minX, minY, maxX, maxY } = bounds;
    const layoutWidth = maxX - minX;
    const layoutHeight = maxY - minY;

    if (layoutWidth === 0 || layoutHeight === 0) return null;

    const scaleX = (viewWidth - padding * 2) / layoutWidth;
    const scaleY = (viewHeight - padding * 2) / layoutHeight;
    const scale = Math.min(scaleX, scaleY, 2); // Max scale of 2

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const x = viewWidth / 2 - centerX * scale;
    const y = viewHeight / 2 - centerY * scale;

    return { scale, x, y };
  }

  stop() {
    if (this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }
  }
}

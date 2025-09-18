/**
 * NoverlapLayoutManager - Dedicated module for managing Noverlap anti-collision layout
 * 
 * Based on graphology-layout-noverlap best practices from Context7 research.
 * Handles proper configuration, timing, and application of Noverlap to reduce density.
 */

export type NoverlapLib = {
  assign: (graph: any, options: { 
    maxIterations?: number; 
    settings?: Record<string, any>;
    inputReducer?: (key: string, attr: any) => any;
    outputReducer?: (key: string, pos: any) => any;
  }) => void;
};

export interface NoverlapSettings {
  gridSize?: number;   // Grid cells for optimization (default: 20)
  margin?: number;     // Margin between nodes (default: 5)
  expansion?: number;  // Space expansion factor (default: 1.1)
  ratio?: number;      // Node size scaling ratio (default: 1.0)  
  speed?: number;      // Movement dampening (default: 3)
}

export interface NoverlapOptions {
  maxIterations?: number;
  settings?: NoverlapSettings;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  debug?: boolean;
}

export class NoverlapLayoutManager {
  private noverlapLib: NoverlapLib;
  private graph: any;
  private sigma: any;
  private downgradedCustomPrograms = false;
  private options: Required<Omit<NoverlapOptions, 'onProgress' | 'onComplete' | 'settings'>> & {
    settings: Required<NoverlapSettings>;
    onProgress?: (progress: number) => void;
    onComplete?: () => void;
  };

  constructor(noverlapLib: NoverlapLib, graph: any, sigma: any, options: NoverlapOptions = {}) {
    this.noverlapLib = noverlapLib;
    this.graph = graph;
    this.sigma = sigma;
    
    // Set up options with intelligent defaults based on graph characteristics
    const nodeCount = graph.order;
    const avgNodeSize = this.calculateAverageNodeSize();
    
    this.options = {
      maxIterations: options.maxIterations ?? Math.min(nodeCount * 0.4, 200),
      debug: options.debug ?? false,
      settings: {
        // Adaptive grid size - smaller for very large graphs, larger for small graphs
        gridSize: options.settings?.gridSize ?? this.calculateOptimalGridSize(nodeCount),
        
        // Adaptive margin based on node sizes and graph density
        margin: options.settings?.margin ?? Math.max(avgNodeSize * 0.6, 6),
        
        // Moderate expansion to spread clusters without excessive stretching
        expansion: options.settings?.expansion ?? 1.15,
        
        // Ratio for collision detection - slightly larger than actual size
        ratio: options.settings?.ratio ?? 1.3,
        
        // Speed - slower for large graphs to prevent instability
        speed: options.settings?.speed ?? (nodeCount > 1000 ? 2 : nodeCount > 500 ? 2.5 : 3),
      },
      onProgress: options.onProgress,
      onComplete: options.onComplete,
    };

    if (this.options.debug) {
      console.log('🔧 NoverlapLayoutManager initialized:', {
        nodeCount,
        avgNodeSize: avgNodeSize.toFixed(1),
        settings: this.options.settings,
        maxIterations: this.options.maxIterations
      });
    }
  }

  /**
   * Apply Noverlap layout to spread out dense clusters
   */
  async apply(): Promise<boolean> {
    if (!this.graph || !this.noverlapLib || !this.sigma) {
      console.warn('NoverlapLayoutManager: Missing required dependencies');
      return false;
    }

    try {
      if (this.options.debug) {
        console.log('🚀 Starting Noverlap anti-collision layout...');
      }

      // Validate that nodes have positions from previous layout
      if (!this.validateNodePositions()) {
        console.warn('NoverlapLayoutManager: Nodes missing x,y positions');
        return false;
      }

      // Apply Noverlap with optimized settings
      this.noverlapLib.assign(this.graph, {
        maxIterations: this.options.maxIterations,
        settings: this.options.settings,
        // Input reducer to ensure proper data format
        inputReducer: (key: string, attr: any) => ({
          x: attr.x || 0,
          y: attr.y || 0,
          size: attr.size || 10
        })
      });

      // Refresh sigma display
      this.sigma.refresh();

      if (this.options.debug) {
        console.log('✅ Noverlap layout completed successfully');
      }

      // Call completion callback
      if (this.options.onComplete) {
        this.options.onComplete();
      }

      return true;

    } catch (error) {
      if (!this.downgradedCustomPrograms && this.handleMissingProgramError(error)) {
        this.downgradedCustomPrograms = true;
        return this.apply();
      }
      console.error('❌ NoverlapLayoutManager error:', error);
      return false;
    }
  }

  private handleMissingProgramError(error: unknown): boolean {
    const message = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase();
    if (!message.includes('could not find a suitable program')) {
      return false;
    }

    try {
      this.graph.forEachNode((nodeId: string, attrs: any) => {
        if (typeof attrs.type !== 'undefined') {
          this.graph.removeNodeAttribute(nodeId, 'type');
        }
      });

      try {
        const classes = this.sigma.getSetting('nodeProgramClasses') ?? {};
        const { border, square, ...rest } = classes as Record<string, any>;
        this.sigma.setSetting('nodeProgramClasses', rest);
      } catch {}

      console.warn('NoverlapLayoutManager: downgraded custom node programs after render error');
      return true;
    } catch (downgradeError) {
      console.warn('Failed to downgrade node programs after error:', downgradeError);
      return false;
    }
  }

  /**
   * Calculate optimal grid size based on node count
   * Smaller grids for larger graphs improve performance
   */
  private calculateOptimalGridSize(nodeCount: number): number {
    if (nodeCount > 2000) return 12;      // Very large graphs
    if (nodeCount > 1000) return 16;      // Large graphs  
    if (nodeCount > 500) return 20;       // Medium graphs
    if (nodeCount > 100) return 25;       // Small graphs
    return 30;                            // Very small graphs
  }

  /**
   * Calculate average node size for adaptive margin calculation
   */
  private calculateAverageNodeSize(): number {
    const nodes = this.graph.nodes();
    if (nodes.length === 0) return 10;

    const totalSize = nodes.reduce((sum: number, nodeId: string) => {
      const attrs = this.graph.getNodeAttributes(nodeId);
      return sum + (attrs.size || 10);
    }, 0);

    return totalSize / nodes.length;
  }

  /**
   * Validate that nodes have required x,y positions
   */
  private validateNodePositions(): boolean {
    const nodes = this.graph.nodes();
    if (nodes.length === 0) return false;

    // Check first few nodes for positions
    const sampleSize = Math.min(5, nodes.length);
    for (let i = 0; i < sampleSize; i++) {
      const attrs = this.graph.getNodeAttributes(nodes[i]);
      if (typeof attrs.x !== 'number' || typeof attrs.y !== 'number') {
        return false;
      }
    }
    return true;
  }

  /**
   * Update settings and reconfigure
   */
  updateSettings(newSettings: Partial<NoverlapSettings>): void {
    this.options.settings = {
      ...this.options.settings,
      ...newSettings
    };

    if (this.options.debug) {
      console.log('🔧 Noverlap settings updated:', newSettings);
    }
  }

  /**
   * Get current configuration info
   */
  getInfo(): object {
    return {
      nodeCount: this.graph?.order || 0,
      avgNodeSize: this.calculateAverageNodeSize(),
      settings: this.options.settings,
      maxIterations: this.options.maxIterations
    };
  }
}



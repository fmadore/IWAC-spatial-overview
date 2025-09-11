/**
 * NetworkLayoutManager - Centralized layout algorithm management
 * 
 * Handles ForceAtlas2 and Noverlap layout algorithms with optimized settings
 * for maximum node spacing and minimal visual overlap.
 */

import { SigmaForceAtlasLayout } from './SigmaForceAtlasLayout';
import { NoverlapLayoutManager } from './NoverlapLayoutManager';
import { buildForceAtlas2Settings } from './SigmaConfigBuilder';

export interface LayoutProgress {
  isRunning: boolean;
  progress: number;
  currentAlgorithm: 'forceAtlas2' | 'noverlap' | null;
}

export interface LayoutCallbacks {
  onProgressUpdate?: (progress: LayoutProgress) => void;
  onLayoutComplete?: (algorithm: string) => void;
  onLayoutError?: (error: string) => void;
  onSigmaRefresh?: () => void;
}

export class NetworkLayoutManager {
  private ForceAtlas2: any;
  private Noverlap: any;
  private graph: any;
  private sigmaInstance: any;
  
  private layoutController: SigmaForceAtlasLayout | null = null;
  private noverlapManager: NoverlapLayoutManager | null = null;
  
  private currentProgress: LayoutProgress = {
    isRunning: false,
    progress: 0,
    currentAlgorithm: null
  };
  
  private callbacks: LayoutCallbacks;

  constructor(
    ForceAtlas2: any,
    Noverlap: any,
    graph: any,
    sigmaInstance: any,
    callbacks: LayoutCallbacks = {}
  ) {
    this.ForceAtlas2 = ForceAtlas2;
    this.Noverlap = Noverlap;
    this.graph = graph;
    this.sigmaInstance = sigmaInstance;
    this.callbacks = callbacks;
  }

  /**
   * Update references when graph or sigma instance changes
   */
  updateReferences(graph: any, sigmaInstance: any): void {
    this.graph = graph;
    this.sigmaInstance = sigmaInstance;
    
    // Clean up existing controllers only if they exist, without excessive logging
    if (this.layoutController || this.noverlapManager) {
      this.stop();
    }
  }

  /**
   * Run ForceAtlas2 layout algorithm with optimized spacing settings
   */
  async runForceAtlas2(): Promise<boolean> {
    if (!this.graph || !this.ForceAtlas2 || this.currentProgress.isRunning) {
      return false;
    }

    // Only stop if something is actually running to avoid redundant console messages
    if (this.currentProgress.isRunning || this.layoutController) {
      this.stop();
    }

    try {
      const nodeCount = this.graph.order;
      const { settings, iterations, batchSize } = buildForceAtlas2Settings(nodeCount, this.ForceAtlas2);

      console.log('🚀 Starting ForceAtlas2 with maximum spacing settings:', { nodeCount, settings });

      this.currentProgress = {
        isRunning: true,
        progress: 0,
        currentAlgorithm: 'forceAtlas2'
      };

      this.layoutController = new SigmaForceAtlasLayout(this.ForceAtlas2, this.graph, {
        totalIterations: iterations,
        batchSize,
        settings,
        onProgress: (p: number) => {
          this.currentProgress.progress = Math.round(p * 100);
          this.notifyProgress();
          
          // Throttled sigma refresh
          if (this.currentProgress.progress % 4 === 0) {
            this.callbacks.onSigmaRefresh?.();
          }
        },
        onFinish: () => {
          this.currentProgress = {
            isRunning: false,
            progress: 0,
            currentAlgorithm: null
          };
          
          this.callbacks.onSigmaRefresh?.();
          this.callbacks.onLayoutComplete?.('ForceAtlas2');
          
          console.log('✅ ForceAtlas2 layout completed');
        }
      });

      this.layoutController.start();
      return true;

    } catch (err) {
      const errorMsg = `ForceAtlas2 layout failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error('❌ ForceAtlas2 error:', err);
      
      this.currentProgress = {
        isRunning: false,
        progress: 0,
        currentAlgorithm: null
      };
      
      this.callbacks.onLayoutError?.(errorMsg);
      return false;
    }
  }

  /**
   * Apply Noverlap layout to reduce node overlaps
   */
  async runNoverlap(): Promise<boolean> {
    if (!this.graph || !this.Noverlap || !this.sigmaInstance) {
      return false;
    }

    try {
      // Create or reuse Noverlap manager
      if (!this.noverlapManager) {
        this.noverlapManager = new NoverlapLayoutManager(this.Noverlap, this.graph, this.sigmaInstance, {
          debug: true,
          settings: {
            gridSize: 25, // Increased grid size for better spacing
            margin: 8,    // Add margin between nodes for breathing room
          },
          onComplete: () => {
            console.log('✅ Noverlap layout completed - nodes should now have better spacing');
            this.callbacks.onLayoutComplete?.('Noverlap');
          }
        });
      }

      this.currentProgress = {
        isRunning: true,
        progress: 50, // Noverlap doesn't provide granular progress
        currentAlgorithm: 'noverlap'
      };
      this.notifyProgress();

      // Apply the layout
      const success = await this.noverlapManager.apply();
      
      this.currentProgress = {
        isRunning: false,
        progress: 0,
        currentAlgorithm: null
      };

      if (!success) {
        console.warn('⚠️ Noverlap layout failed');
        this.callbacks.onLayoutError?.('Noverlap layout failed');
        return false;
      }

      return true;

    } catch (err) {
      console.error('❌ Noverlap layout error:', err);
      this.currentProgress = {
        isRunning: false,
        progress: 0,
        currentAlgorithm: null
      };
      this.callbacks.onLayoutError?.(`Noverlap error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Run full layout sequence: ForceAtlas2 followed by Noverlap
   */
  async runFullLayout(): Promise<boolean> {
    console.log('🚀 Starting full layout sequence (ForceAtlas2 + Noverlap)');
    
    // Step 1: Run ForceAtlas2 for initial positioning
    const fa2Success = await this.runForceAtlas2();
    if (!fa2Success) {
      return false;
    }

    // Wait for ForceAtlas2 to complete
    while (this.currentProgress.isRunning) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Step 2: Apply Noverlap for overlap prevention
    const noverlapSuccess = await this.runNoverlap();
    
    if (noverlapSuccess) {
      console.log('✅ Full layout sequence completed successfully');
    } else {
      console.warn('⚠️ Full layout sequence completed with warnings');
    }

    return noverlapSuccess;
  }

  /**
   * Stop any currently running layout
   */
  stop(): void {
    // Only show stop message if something was actually running
    const wasRunning = this.currentProgress.isRunning || this.layoutController || this.noverlapManager;
    
    if (this.layoutController) {
      this.layoutController.stop();
      this.layoutController = null;
    }
    
    // Clean up Noverlap manager
    this.noverlapManager = null;
    
    this.currentProgress = {
      isRunning: false,
      progress: 0,
      currentAlgorithm: null
    };
    
    if (wasRunning) {
      console.log('🛑 Layout algorithms stopped');
    }
  }

  /**
   * Get current layout progress
   */
  getProgress(): LayoutProgress {
    return { ...this.currentProgress };
  }

  /**
   * Check if any layout is currently running
   */
  isRunning(): boolean {
    return this.currentProgress.isRunning;
  }

  /**
   * Update callback functions
   */
  updateCallbacks(callbacks: Partial<LayoutCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Get layout recommendations based on graph characteristics
   */
  getLayoutRecommendations(): {
    algorithm: 'forceAtlas2' | 'noverlap' | 'full';
    reason: string;
  } {
    const nodeCount = this.graph?.order || 0;
    const edgeCount = this.graph?.size || 0;
    const density = nodeCount > 0 ? edgeCount / (nodeCount * (nodeCount - 1) / 2) : 0;

    if (nodeCount > 1000) {
      return {
        algorithm: 'forceAtlas2',
        reason: 'Large graph - ForceAtlas2 recommended for performance'
      };
    }

    if (density > 0.1) {
      return {
        algorithm: 'full',
        reason: 'Dense graph - Full layout sequence recommended for best spacing'
      };
    }

    if (nodeCount < 100) {
      return {
        algorithm: 'noverlap',
        reason: 'Small graph - Noverlap sufficient for overlap prevention'
      };
    }

    return {
      algorithm: 'forceAtlas2',
      reason: 'Medium graph - ForceAtlas2 recommended for good balance'
    };
  }

  /**
   * Notify callbacks about progress updates
   */
  private notifyProgress(): void {
    this.callbacks.onProgressUpdate?.(this.currentProgress);
  }

  /**
   * Get algorithm statistics and info
   */
  getAlgorithmInfo(): {
    forceAtlas2Available: boolean;
    noverlapAvailable: boolean;
    nodeCount: number;
    edgeCount: number;
    recommendedAlgorithm: string;
  } {
    const nodeCount = this.graph?.order || 0;
    const edgeCount = this.graph?.size || 0;
    const recommendation = this.getLayoutRecommendations();

    return {
      forceAtlas2Available: !!this.ForceAtlas2,
      noverlapAvailable: !!this.Noverlap,
      nodeCount,
      edgeCount,
      recommendedAlgorithm: recommendation.algorithm
    };
  }
}

/**
 * SigmaForceAtlasLayout - RAF-driven ForceAtlas2 controller for graphology
 *
 * Goals:
 * - Run FA2 in small iteration batches per animation frame
 * - Provide start/stop and single-run semantics
 * - Expose progress and a completion callback
 * - Cancel any pending RAFs on stop/finish to avoid repeated camera animations
 */

export type ForceAtlas2Lib = {
  assign: (graph: any, options: { iterations: number; settings?: Record<string, unknown> }) => void;
};

export interface SigmaForceAtlasOptions {
  totalIterations?: number; // total FA2 iterations for the run
  batchSize?: number;       // iterations per animation frame
  settings?: Record<string, unknown>; // FA2 settings
  onProgress?: (progress: number) => void;
  onFinish?: () => void;
}

export class SigmaForceAtlasLayout {
  private fa2: ForceAtlas2Lib;
  private graph: any;
  private rafId: number | null = null;
  private running = false;
  private iterationsDone = 0;
  private opts: Required<Omit<SigmaForceAtlasOptions, 'onProgress' | 'onFinish'>>;
  private onProgress?: (progress: number) => void;
  private onFinish?: () => void;

  constructor(fa2: ForceAtlas2Lib, graph: any, options?: SigmaForceAtlasOptions) {
    this.fa2 = fa2;
    this.graph = graph;
    this.opts = {
      totalIterations: options?.totalIterations ?? 300,
      batchSize: options?.batchSize ?? 12,
      settings: options?.settings ?? {},
    };
    this.onProgress = options?.onProgress;
    this.onFinish = options?.onFinish;
  }

  isRunning(): boolean {
    return this.running;
  }

  updateOptions(options: Partial<SigmaForceAtlasOptions>) {
    if (options.totalIterations !== undefined) this.opts.totalIterations = options.totalIterations;
    if (options.batchSize !== undefined) this.opts.batchSize = options.batchSize;
    if (options.settings !== undefined) this.opts.settings = options.settings;
    if (options.onProgress !== undefined) this.onProgress = options.onProgress;
    if (options.onFinish !== undefined) this.onFinish = options.onFinish;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.iterationsDone = 0;
    this.loop();
  }

  stop() {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private loop = () => {
    if (!this.running) return; // canceled

    const { totalIterations, batchSize, settings } = this.opts;

    // Apply a batch of iterations
    const remaining = totalIterations - this.iterationsDone;
    const toRun = Math.max(0, Math.min(batchSize, remaining));

    for (let i = 0; i < toRun; i++) {
      this.fa2.assign(this.graph, { iterations: 1, settings });
      this.iterationsDone++;
    }

    // Report progress
    if (this.onProgress) {
      this.onProgress(Math.min(1, this.iterationsDone / totalIterations));
    }

    if (this.iterationsDone >= totalIterations) {
      // Done: stop and ensure no stray RAFs remain
      this.stop();
      if (this.onFinish) this.onFinish();
      return;
    }

    this.rafId = requestAnimationFrame(this.loop);
  };
}

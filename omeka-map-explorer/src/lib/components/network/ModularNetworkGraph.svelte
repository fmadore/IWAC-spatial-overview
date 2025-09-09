<script lang="ts">
  import { onMount } from 'svelte';
  import type { NetworkData } from '$lib/types';
  import { networkState } from '$lib/state/networkData.svelte';
  import { appState } from '$lib/state/appState.svelte';
  import { NetworkController, type NetworkControllerConfig } from './modules/NetworkController';
  import { NetworkInteractionHandler } from './modules/NetworkInteractionHandler';

  // Props
  let { data = null } = $props<{ data?: NetworkData | null }>();

  // DOM elements
  let container: HTMLDivElement;
  let canvas = $state<HTMLCanvasElement>();

  // Controller instance
  let controller: NetworkController | null = null;

  // Component state
  let isLayoutRunning = $state(false);
  let layoutProgress = $state(0);
  let error = $state<string | null>(null);

  // Reactive data
  const currentData = $derived(data ?? networkState.filtered ?? networkState.data);

  // Configuration
  const nodeColors = {
    person: '#2563eb',
    organization: '#7c3aed',
    event: '#059669',
    subject: '#d97706',
    location: '#ef4444',
  };

  function initializeController() {
    if (!canvas || controller) return;

    try {
      const config: NetworkControllerConfig = {
        canvas,
        renderConfig: {
          width: canvas.clientWidth,
          height: canvas.clientHeight,
          nodeMinSize: 3,
          nodeMaxSize: 12,
          edgeMinWidth: 0.5,
          edgeMaxWidth: 3,
          nodeColors,
          backgroundColor: 'hsl(var(--muted))',
          selectedNodeId: appState.networkNodeSelected?.id || null,
        },
        layoutConfig: {
          width: canvas.clientWidth,
          height: canvas.clientHeight,
          iterations: 100, // Reduced from 300 for faster layout
          nodeRepulsion: 200,
          linkStrength: 0.1,
          centerForce: 0.05,
          minNodeSize: 3,
          maxNodeSize: 12,
        },
        onNodeClick: (node) => {
          NetworkInteractionHandler.handleNodeSelection(node);
        },
        onNodeHover: (node) => {
          NetworkInteractionHandler.handleNodeHover(node);
        },
        onSelectionChange: (nodeId) => {
          // Update canvas cursor or other UI feedback
        }
      };

      controller = new NetworkController(config);
      error = null;
    } catch (err) {
      error = `Failed to initialize network: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error('Network initialization error:', err);
    }
  }

  async function runLayout() {
    if (!controller || !currentData || isLayoutRunning) return;

    isLayoutRunning = true;
    layoutProgress = 0;

    try {
      // Add timeout to prevent infinite layout
      const layoutPromise = controller.runLayout((progress) => {
        layoutProgress = Math.round(progress * 100);
      });
      
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Layout timeout')), 10000); // 10 second timeout
      });
      
      await Promise.race([layoutPromise, timeoutPromise]);
    } catch (err) {
      error = `Layout failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error('Layout error:', err);
    } finally {
      isLayoutRunning = false;
      layoutProgress = 0;
    }
  }

  function centerOnSelectedNode() {
    if (!controller || !appState.networkNodeSelected?.id) return;
    controller.centerOnNode(appState.networkNodeSelected.id);
  }

  function fitToView() {
    if (!controller) return;
    controller.fitToView();
  }

  function clearSelection() {
    NetworkInteractionHandler.handleNodeSelection(null);
  }

  // Lifecycle
  onMount(() => {
    initializeController();

    return () => {
      controller?.destroy();
      controller = null;
    };
  });

  // Reactive effects
  $effect(() => {
    if (controller && currentData) {
      controller.setData(currentData);
      
      // Don't auto-run layout - let user decide when to run it
      // This prevents the infinite loop issue
    }
  });

  $effect(() => {
    // Update selection when app state changes
    const selectedId = appState.networkNodeSelected?.id || null;
    if (controller) {
      controller.setSelectedNode(selectedId);
    }
  });

  // Keyboard shortcuts
  function handleKeyDown(event: KeyboardEvent) {
    if (!controller || !currentData) return;

    switch (event.key.toLowerCase()) {
      case 'f':
        event.preventDefault();
        fitToView();
        break;
      case 'r':
        event.preventDefault();
        runLayout();
        break;
      case 'escape':
        event.preventDefault();
        clearSelection();
        break;
      case 'c':
        if (appState.networkNodeSelected?.id) {
          event.preventDefault();
          centerOnSelectedNode();
        }
        break;
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div
  bind:this={container}
  class="relative w-full h-full rounded-md border bg-muted/40 overflow-hidden"
  style="min-height: 600px; height: 100%;"
>
  <!-- Error display -->
  {#if error}
    <div class="absolute inset-0 flex items-center justify-center p-4 text-center bg-background/80 backdrop-blur">
      <div class="text-destructive">
        <h3 class="font-semibold mb-2">Network Error</h3>
        <p class="text-sm">{error}</p>
        <button 
          class="mt-3 px-3 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          onclick={() => {
            error = null;
            initializeController();
          }}
        >
          Retry
        </button>
      </div>
    </div>
  {:else}
    <!-- Loading indicator -->
    {#if isLayoutRunning}
      <div class="absolute top-4 left-4 z-10 bg-background/90 backdrop-blur rounded-md p-3 border shadow">
        <div class="flex items-center gap-3 text-sm">
          <div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span>Computing layout... {layoutProgress}%</span>
          <button
            class="px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors"
            onclick={() => {
              isLayoutRunning = false;
              layoutProgress = 0;
              controller?.destroy();
              controller = null;
              initializeController();
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    {/if}

    <!-- Controls -->
    <div class="absolute top-4 right-4 z-10 flex gap-2">
      <button
        class="px-3 py-1 text-xs bg-background/90 backdrop-blur rounded-md border hover:bg-accent transition-colors"
        onclick={fitToView}
        title="Fit to view (F)"
      >
        Fit
      </button>
      <button
        class="px-3 py-1 text-xs bg-background/90 backdrop-blur rounded-md border hover:bg-accent transition-colors disabled:opacity-50"
        onclick={runLayout}
        disabled={isLayoutRunning}
        title="Run layout (R)"
      >
        Layout
      </button>
      {#if appState.networkNodeSelected?.id}
        <button
          class="px-3 py-1 text-xs bg-background/90 backdrop-blur rounded-md border hover:bg-accent transition-colors"
          onclick={centerOnSelectedNode}
          title="Center on selection (C)"
        >
          Center
        </button>
        <button
          class="px-3 py-1 text-xs bg-background/90 backdrop-blur rounded-md border hover:bg-accent transition-colors"
          onclick={clearSelection}
          title="Clear selection (Esc)"
        >
          Clear
        </button>
      {/if}
    </div>

    <!-- Instructions -->
    {#if currentData && !isLayoutRunning}
      <div class="absolute bottom-4 left-4 z-10 bg-background/90 backdrop-blur rounded-md p-3 border shadow max-w-sm">
        <div class="text-xs text-muted-foreground space-y-1">
          <div class="font-medium">Getting Started:</div>
          <div>• Click "Layout" to arrange nodes</div>
          <div>• Click "Fit" to center the view</div>
          <div>• Then click nodes to explore</div>
          <div class="pt-1 border-t mt-2">
            <div class="font-medium">Controls:</div>
            <div>• Mouse wheel to zoom</div>
            <div>• Drag to pan view</div>
            <div>• Press F to fit, R to relayout</div>
          </div>
          {#if appState.networkNodeSelected?.id}
            <div class="mt-2 pt-2 border-t">
              <div class="font-medium">Selected: {appState.networkNodeSelected.id}</div>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Network statistics -->
    {#if currentData && !isLayoutRunning}
      <div class="absolute bottom-4 right-4 z-10 bg-background/90 backdrop-blur rounded-md p-3 border shadow">
        <div class="text-xs text-muted-foreground">
          <div class="font-medium mb-1">Network Stats:</div>
          <div>Nodes: {currentData.nodes.length}</div>
          <div>Edges: {currentData.edges.length}</div>
        </div>
      </div>
    {/if}

    <!-- Canvas -->
    <canvas
      bind:this={canvas}
      class="absolute inset-0 touch-none select-none"
      style="cursor: default;"
    ></canvas>
  {/if}
</div>

<style>
  canvas {
    image-rendering: pixelated;
    image-rendering: -moz-crisp-edges;
    image-rendering: crisp-edges;
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import type { NetworkData, NetworkNode, NetworkEdge } from '$lib/types';
  import { networkState, getNodeById, getNeighbors } from '$lib/state/networkData.svelte';
  import { appState } from '$lib/state/appState.svelte';

  let { data = null } = $props<{ data?: NetworkData | null }>();
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;

  // Very simple placeholder renderer: draw nodes as circles in a grid
  function draw() {
    if (!canvas) return;
    if (!ctx) ctx = canvas.getContext('2d');
    if (!ctx) return;
  const d = (data ?? networkState.filtered ?? networkState.data) as NetworkData | null;
    if (!d) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

  const nodes: NetworkNode[] = d.nodes.slice(0, 200); // cap for placeholder
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const size = Math.min(width / (cols + 1), 24);
  nodes.forEach((n: NetworkNode, i: number) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = (col + 1) * (width / (cols + 1));
      const y = (row + 1) * (size * 2);
      ctx!.beginPath();
      ctx!.arc(x, y, Math.max(3, Math.min(10, Math.log2(n.count + 2))), 0, Math.PI * 2);
      ctx!.fillStyle = colorFor(n.type);
      ctx!.fill();
    });
  }

  function colorFor(t: string) {
    switch (t) {
      case 'person':
        return '#2563eb';
      case 'organization':
        return '#7c3aed';
      case 'event':
        return '#059669';
      case 'subject':
        return '#d97706';
      case 'location':
      default:
        return '#ef4444';
    }
  }

  onMount(() => {
    const ro = new ResizeObserver(() => draw());
    if (canvas) ro.observe(canvas);
    draw();
    return () => ro.disconnect();
  });

  $effect(() => {
    draw();
  });

  function handleClick(e: MouseEvent) {
    // Placeholder: set selected node id if any mapping exists in future
    // For now, just no-op
  }
</script>

<canvas bind:this={canvas} class="w-full h-[500px] rounded-md border bg-muted/40" onclick={handleClick}></canvas>

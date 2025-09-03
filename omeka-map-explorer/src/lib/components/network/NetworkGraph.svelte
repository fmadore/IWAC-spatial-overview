<script lang="ts">
  import { onMount } from 'svelte';
  import type { NetworkData, NetworkNode, NetworkEdge } from '$lib/types';
  import { networkState, getNodeById, getNeighbors } from '$lib/state/networkData.svelte';
  import { appState } from '$lib/state/appState.svelte';
  
  // Lazy force layout
  let d3force: any = null;

  let { data = null } = $props<{ data?: NetworkData | null }>();
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;

  // Layout positions
  const positions = new Map<string, { x: number; y: number; r: number }>();

  // Draw edges then nodes
  function draw() {
    if (!canvas) return;
    if (!ctx) ctx = canvas.getContext('2d');
    if (!ctx) return;
    const d = (data ?? networkState.filtered ?? networkState.data) as NetworkData | null;
    if (!d) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Edges
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#8884';
    ctx.lineWidth = 1;
    for (const e of d.edges) {
      const a = positions.get(e.source);
      const b = positions.get(e.target);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();

    // Nodes
    for (const n of d.nodes) {
      const p = positions.get(n.id);
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = colorFor(n.type);
      ctx.fill();
    }
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
    // Lazy import force
    (async () => {
      const mod = await import('d3-force').catch(() => null);
      d3force = mod;
      initLayout();
    })();
    return () => ro.disconnect();
  });

  $effect(() => {
    initLayout();
  });

  function initLayout() {
    const d = (data ?? networkState.filtered ?? networkState.data) as NetworkData | null;
    if (!d || !canvas) return;
    const { width, height } = canvas;

    // Seed positions to a circle/grid if none
    d.nodes.forEach((n, i) => {
      if (!positions.has(n.id)) {
        const angle = (i / d.nodes.length) * Math.PI * 2;
        const x = width / 2 + Math.cos(angle) * (Math.min(width, height) * 0.35);
        const y = height / 2 + Math.sin(angle) * (Math.min(width, height) * 0.35);
        const r = Math.max(3, Math.min(10, Math.log2(n.count + 2)));
        positions.set(n.id, { x, y, r });
      } else {
        const p = positions.get(n.id)!;
        p.r = Math.max(3, Math.min(10, Math.log2(n.count + 2)));
      }
    });

    if (!d3force) {
      draw();
      return;
    }

    // Build simulation nodes/links referencing our map
    const simNodes = d.nodes.map((n) => ({ id: n.id, ...positions.get(n.id)! }));
    const simLinks = d.edges.map((e) => ({ source: e.source, target: e.target, weight: e.weight }));

    const simulation = d3force
      .forceSimulation(simNodes)
      .force('link', d3force.forceLink(simLinks).id((d: any) => d.id).distance(40).strength(0.05))
      .force('charge', d3force.forceManyBody().strength(-40))
      .force('center', d3force.forceCenter(width / 2, height / 2))
      .alpha(0.9)
      .alphaDecay(0.08)
      .on('tick', () => {
        for (const n of simNodes) {
          const p = positions.get(n.id);
          if (p) {
            p.x = n.x;
            p.y = n.y;
          }
        }
        draw();
      })
      .on('end', () => {
        draw();
      });
  }

  function handleClick(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const d = (data ?? networkState.filtered ?? networkState.data) as NetworkData | null;
    if (!d) return;
    // hit test
    for (const n of d.nodes) {
      const p = positions.get(n.id);
      if (!p) continue;
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy <= p.r * p.r) {
        // Set URL node param and selected entity type if applicable
        appState.networkNodeSelected = { id: n.id };
        // If node id has the form "type:id", map to entity selection
        const parts = n.id.split(':');
        if (parts.length === 2) {
          const [t, entityId] = parts as [string, string];
          const typeMap: Record<string, string> = {
            person: 'Personnes',
            organization: 'Organisations',
            event: 'Événements',
            subject: 'Sujets',
            location: 'Lieux'
          };
          const entityType = typeMap[t];
          if (entityType) {
            appState.selectedEntity = {
              type: entityType,
              id: entityId,
              name: '',
              relatedArticleIds: []
            };
          }
        }
        // URL update handled by urlManager polling effect
        break;
      }
    }
  }
</script>

<canvas bind:this={canvas} class="w-full h-[500px] rounded-md border bg-muted/40" onclick={handleClick}></canvas>

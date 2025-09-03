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
  let container: HTMLDivElement;

  // Layout positions
  const positions = new Map<string, { x: number; y: number; r: number }>();

  // View transform (pan/zoom in CSS pixel units)
  let k = 1; // scale
  let tx = 0; // translate x
  let ty = 0; // translate y
  const kMin = 0.25;
  const kMax = 4;
  const hovering = $state<{ id: string | null; x: number; y: number; label: string }>({ id: null, x: 0, y: 0, label: '' });
  let dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  let needsDraw = false;
  // Drag state
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartTx = 0;
  let dragStartTy = 0;
  // Hover tooltip state handled via `hovering`

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
    ctx.strokeStyle = '#8888';
    for (const e of d.edges) {
      const a = positions.get(e.source);
      const b = positions.get(e.target);
      if (!a || !b) continue;
      const ax = a.x * k + tx;
      const ay = a.y * k + ty;
      const bx = b.x * k + tx;
      const by = b.y * k + ty;
      const w = Math.max(0.5, Math.log2((e.weight || 1) + 1));
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
    ctx.restore();

    // Nodes
    for (const n of d.nodes) {
      const p = positions.get(n.id);
      if (!p) continue;
      const nx = p.x * k + tx;
      const ny = p.y * k + ty;
      const nr = Math.max(2, p.r * Math.sqrt(k));
      ctx.beginPath();
      ctx.arc(nx, ny, nr, 0, Math.PI * 2);
      ctx.fillStyle = colorFor(n.type);
      ctx.fill();
  if (hovering.id === n.id) {
        // simple highlight ring
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#111a';
        ctx.stroke();
      }
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
    const ro = new ResizeObserver(() => resizeCanvas());
    if (container) ro.observe(container);
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

  function resizeCanvas() {
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    if (!ctx) ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scheduleDraw();
  }

  function scheduleDraw() {
    if (needsDraw) return;
    needsDraw = true;
    requestAnimationFrame(() => {
      needsDraw = false;
      updateHoverPosition();
      draw();
    });
  }

  function updateHoverPosition() {
    if (!hovering.id) return;
    const p = positions.get(hovering.id);
    if (p) {
      hovering.x = p.x * k + tx + 8;
      hovering.y = p.y * k + ty + 8;
    }
  }

  function initLayout() {
    const d = (data ?? networkState.filtered ?? networkState.data) as NetworkData | null;
    if (!d || !canvas) return;
    if (!container) return;
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
      scheduleDraw();
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
        scheduleDraw();
      })
      .on('end', () => {
        scheduleDraw();
      });
  }

  function handleClick(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const wx = (x - tx) / k;
    const wy = (y - ty) / k;
    const d = (data ?? networkState.filtered ?? networkState.data) as NetworkData | null;
    if (!d) return;
    // hit test
    for (const n of d.nodes) {
      const p = positions.get(n.id);
      if (!p) continue;
      const dx = p.x - wx;
      const dy = p.y - wy;
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

  function onPointerDown(ev: PointerEvent) {
    (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
    isDragging = true;
    dragStartX = ev.clientX;
    dragStartY = ev.clientY;
    dragStartTx = tx;
    dragStartTy = ty;
  }

  function onPointerMove(ev: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    updateHover(mx, my);
    if (!isDragging) return;
    tx = dragStartTx + (ev.clientX - dragStartX);
    ty = dragStartTy + (ev.clientY - dragStartY);
    scheduleDraw();
  }

  function onPointerUp(ev: PointerEvent) {
    isDragging = false;
  }

  function onWheel(ev: WheelEvent) {
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const scaleFactor = Math.pow(0.98, ev.deltaY);
    const nk = clamp(k * scaleFactor, kMin, kMax);
    const f = nk / k;
    // zoom around cursor
    tx = x - (x - tx) * f;
    ty = y - (y - ty) * f;
    k = nk;
    scheduleDraw();
  }

  function clamp(v: number, a: number, b: number) {
    return Math.max(a, Math.min(b, v));
  }

  // Hover detection
  function updateHover(x: number, y: number) {
    const wx = (x - tx) / k;
    const wy = (y - ty) / k;
    const d = (data ?? networkState.filtered ?? networkState.data) as NetworkData | null;
    let found: string | null = null;
    if (d) {
      for (const n of d.nodes) {
        const p = positions.get(n.id);
        if (!p) continue;
        const dx = p.x - wx;
        const dy = p.y - wy;
        if (dx * dx + dy * dy <= (p.r * p.r)) {
      found = n.id;
      hovering.label = n.label;
          break;
        }
      }
    }
    if (hovering.id !== found) {
  hovering.id = found;
  if (canvas) canvas.style.cursor = found ? 'pointer' : 'default';
  updateHoverPosition();
      scheduleDraw();
    }
  }
</script>

<div bind:this={container} class="relative w-full h-[500px] rounded-md border bg-muted/40 overflow-hidden">
  <canvas
    bind:this={canvas}
    class="absolute inset-0"
    onclick={handleClick}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointerleave={onPointerUp}
    onwheel={onWheel}
  ></canvas>
  {#if hovering.id}
    <div
      class="pointer-events-none absolute px-2 py-1 text-xs rounded bg-background/90 border shadow"
      style={`left:${hovering.x}px; top:${hovering.y}px;`}
    >
      {hovering.label}
    </div>
  {/if}
</div>

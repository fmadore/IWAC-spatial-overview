<script lang="ts">
  import { onMount } from 'svelte';
  import type { NetworkData, NetworkNode, NetworkEdge } from '$lib/types';
  import { networkState, getNodeById, getNeighbors } from '$lib/state/networkData.svelte';
  import { appState } from '$lib/state/appState.svelte';
  import EntitySelector from '$lib/components/entities/entity-selector.svelte';
  
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
  // When true and a node is selected, only draw the selected node + its 1-hop neighbors and incident edges
  let focusOnSelection = $state(true);
  let dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  let needsDraw = false;
  let lastDrawTs = 0;
  const drawMinIntervalMs = 16; // ~60fps cap
  // Drag state
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartTx = 0;
  let dragStartTy = 0;
  let userPannedAt = 0; // timestamp of last user pan
  const panSuppressMs = 800; // time window to suppress auto-centering
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

    // Compute highlighting sets
    const selectedId = appState.networkNodeSelected?.id ?? null;
    const neighborSet = new Set<string>();
    if (selectedId && d) {
      for (const e of d.edges) {
        if (e.source === selectedId) neighborSet.add(e.target);
        if (e.target === selectedId) neighborSet.add(e.source);
      }
    }

    // Edges
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#8888';
    for (const e of d.edges) {
      // In focus mode, only draw edges that touch the selected node
      if (selectedId && focusOnSelection) {
        const incident = e.source === selectedId || e.target === selectedId;
        if (!incident) continue;
      }
      const a = positions.get(e.source);
      const b = positions.get(e.target);
      if (!a || !b) continue;
      const ax = a.x * k + tx;
      const ay = a.y * k + ty;
      const bx = b.x * k + tx;
      const by = b.y * k + ty;
      const w = Math.max(0.5, Math.log2((e.weight || 1) + 1));
      const isHighlighted = selectedId && (e.source === selectedId || e.target === selectedId);
      ctx.lineWidth = isHighlighted ? w + 1.25 : w;
      if (selectedId && !isHighlighted) ctx.globalAlpha = 0.08;
      if (isHighlighted) {
        ctx.strokeStyle = '#0ea5e9aa'; // cyan highlight for incident edges
      } else {
        ctx.strokeStyle = '#8888';
      }
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      if (selectedId && !isHighlighted) ctx.globalAlpha = 0.22;
    }
    ctx.restore();

    // Nodes
    for (const n of d.nodes) {
      // In focus mode, skip nodes that are neither selected nor neighbors
      if (selectedId && focusOnSelection) {
        if (n.id !== selectedId && !neighborSet.has(n.id)) continue;
      }
      const p = positions.get(n.id);
      if (!p) continue;
      const nx = p.x * k + tx;
      const ny = p.y * k + ty;
      const isSel = selectedId === n.id;
      const isNbr = neighborSet.has(n.id);
      const dim = selectedId && !isSel && !isNbr;
      const nr = Math.max(2, p.r * Math.sqrt(k)) * (isSel ? 1.4 : isNbr ? 1.1 : 1);
      ctx.beginPath();
      ctx.arc(nx, ny, nr, 0, Math.PI * 2);
      ctx.fillStyle = colorFor(n.type);
      if (dim) ctx.globalAlpha = 0.45;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (hovering.id === n.id && !isSel) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#111a';
        ctx.stroke();
      }
      if (isSel) {
        // Stronger selected-ring with glow
        ctx.save();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#0ea5e9';
        ctx.shadowColor = '#0ea5e9';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(nx, ny, nr + 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // White halo outline for contrast
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffffcc';
        ctx.beginPath();
        ctx.arc(nx, ny, nr + 5, 0, Math.PI * 2);
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
  // Initialize canvas size immediately so interactions work before ResizeObserver fires
  resizeCanvas();
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
    const now = performance.now();
    const dt = now - lastDrawTs;
    const delay = dt >= drawMinIntervalMs ? 0 : (drawMinIntervalMs - dt);
    needsDraw = true;
    setTimeout(() => {
      requestAnimationFrame(() => {
        // draw one frame and allow scheduling of the next one
        updateHoverPosition();
        draw();
        lastDrawTs = performance.now();
        needsDraw = false;
      });
    }, delay);
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
  // Use CSS pixel size for logical coordinates; canvas is scaled via DPR transform
  const rect = container.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

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

  function centerOnNode(id: string, zoom = 1.6) {
    if (!canvas || !container) return;
    const p = positions.get(id);
    if (!p) return;
    const rect = container.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    k = clamp(zoom, kMin, kMax);
    tx = cx - p.x * k;
    ty = cy - p.y * k;
    updateHoverPosition();
    scheduleDraw();
  }

  // Focus when a node is selected via URL/panel
  $effect(() => {
    const id = appState.networkNodeSelected?.id;
    if (!id) return;
    // If the layout hasn't positioned this node yet, wait briefly
    if (positions.has(id)) {
      // Don't auto-center if the user just panned
      if (performance.now() - userPannedAt > panSuppressMs && !isDragging) {
        centerOnNode(id);
      }
      return;
    }
    let tries = 0;
    const handle = setInterval(() => {
      tries += 1;
      if (positions.has(id)) {
        if (performance.now() - userPannedAt > panSuppressMs && !isDragging) {
          centerOnNode(id);
        }
        clearInterval(handle);
      } else if (tries > 60) {
        clearInterval(handle);
      }
    }, 50);
  });

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
  // Enable focus mode when user selects by clicking
  focusOnSelection = true;
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
  // only react to primary button
  if (ev.button !== 0) return;
  ev.preventDefault();
    (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
    isDragging = true;
  if (canvas) canvas.style.cursor = 'grabbing';
    dragStartX = ev.clientX;
    dragStartY = ev.clientY;
    dragStartTx = tx;
    dragStartTy = ty;
  userPannedAt = performance.now();
  }

  function onPointerMove(ev: PointerEvent) {
  // prevent page scroll while panning on some browsers
  if (isDragging) ev.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = ev.clientX - rect.left;
  const my = ev.clientY - rect.top;
  updateHover(mx, my);
  if (!isDragging) { scheduleDraw(); return; }
  tx = dragStartTx + (ev.clientX - dragStartX);
  ty = dragStartTy + (ev.clientY - dragStartY);
  userPannedAt = performance.now();
  scheduleDraw();
  }

  function onPointerUp(ev: PointerEvent) {
    isDragging = false;
  if (canvas) canvas.style.cursor = hovering.id ? 'pointer' : 'default';
  }

  let wheelAccum = 0;
  let wheelRAF = 0 as any;
  function onWheel(ev: WheelEvent) {
    ev.preventDefault();
    wheelAccum += ev.deltaY;
    if (wheelRAF) return;
    wheelRAF = requestAnimationFrame(() => {
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const scaleFactor = Math.pow(0.98, wheelAccum);
      const nk = clamp(k * scaleFactor, kMin, kMax);
      const f = nk / k;
      // zoom around cursor
      tx = x - (x - tx) * f;
      ty = y - (y - ty) * f;
      k = nk;
      wheelAccum = 0;
      wheelRAF = 0;
      scheduleDraw();
    });
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
      // If focusing on selection, skip non-neighbor nodes for hover to reduce clutter
      const selectedId = appState.networkNodeSelected?.id ?? null;
      const neighborSet = new Set<string>();
      if (selectedId && d && focusOnSelection) {
        for (const e of d.edges) {
          if (e.source === selectedId) neighborSet.add(e.target);
          if (e.target === selectedId) neighborSet.add(e.source);
        }
      }
      for (const n of d.nodes) {
        if (selectedId && focusOnSelection) {
          if (n.id !== selectedId && !neighborSet.has(n.id)) continue;
        }
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

<div
  bind:this={container}
  class="relative w-full rounded-md border bg-muted/40 overflow-hidden select-none"
  style="height: calc(100vh - var(--header-height) - 2rem)"
>
  {#if networkState.filtered}
    <div class="absolute left-3 top-3 z-10 w-[340px] max-w-[60vw]">
      <EntitySelector
        entities={networkState.filtered.nodes.map((n) => ({ id: n.id, name: n.label, relatedArticleIds: [], articleCount: n.count }))}
        selectedEntityId={appState.networkNodeSelected?.id ?? null}
        entityType="Network"
        entityTypeSingular="entity"
        placeholder="Search nodes..."
        hideSelectionHint={true}
        onSelect={(e) => {
          appState.networkNodeSelected = { id: e.id };
          const parts = e.id.split(':');
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
              appState.selectedEntity = { type: entityType, id: entityId, name: e.name, relatedArticleIds: [] };
            }
          }
          // When a new node is explicitly selected, default to focus mode
          focusOnSelection = true;
        }}
        onClear={() => {
          appState.networkNodeSelected = null;
          appState.selectedEntity = null;
          focusOnSelection = false;
        }}
      />
      <div class="mt-2 flex items-center gap-2 text-xs text-foreground/80">
        <input id="focusSel" type="checkbox" bind:checked={focusOnSelection} disabled={!appState.networkNodeSelected} />
        <label for="focusSel" class="select-none">Focus on selection (hide unrelated)</label>
      </div>
    </div>
  {/if}
  <canvas
    bind:this={canvas}
  class="absolute inset-0 touch-none select-none cursor-grab"
    onclick={handleClick}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
  onpointerleave={onPointerUp}
    onwheel={onWheel}
  oncontextmenu={(e) => e.preventDefault()}
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

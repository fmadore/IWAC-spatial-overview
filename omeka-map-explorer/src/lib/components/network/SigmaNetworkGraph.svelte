<script lang="ts">
  import { onMount } from 'svelte';
  import type { NetworkData } from '$lib/types';
  import { appState } from '$lib/state/appState.svelte';
  import { networkState, applyFilters } from '$lib/state/networkData.svelte';
  import Sigma from 'sigma';
  import Graph from 'graphology';
  // ForceAtlas2 for layout (computed incrementally client-side)
  import FA2 from 'graphology-layout-forceatlas2';

  // Props
  let { data = null } = $props<{ data?: NetworkData | null }>();

  // DOM / instances
  let container: HTMLDivElement;
  let renderer: any = null; // sigma instance
  let graph: any = null; // graphology instance

  // State
  let initTried = false;
  // Reactive error (was non-reactive causing warning)
  let webglError = $state<string | null>(null);
  let firstFitDone = false;
  let cameraRatio = 1;
  let labelsForced = false; // toggled by user (keyboard 'L')
  let edgesEmphasis = false; // toggle thicker/high-contrast edges (keyboard 'E')
  let topLabelIds = new Set<string>();
  let minWeight = 1;
  let maxWeight = 1;
  let maxStrength = 1;
  let minStrength = 0;
  let topLabelCount = 60;

  function colorFor(t: string) {
    switch (t) {
      case 'person': return '#2563eb';
      case 'organization': return '#7c3aed';
      case 'event': return '#059669';
      case 'subject': return '#d97706';
      case 'location': return '#ef4444';
      default: return '#6b7280';
    }
  }

  function sizeFor(strength: number | undefined, degree: number | undefined) {
    // Strength-based sizing (log transform), fallback to degree+count style
    if (strength !== undefined) {
      const s = Math.max(1, strength);
      return 2 + Math.log10(s + 9); // ~2..(depending on strength)
    }
    const base = Math.log2((degree || 1) + 1) + 2;
    return degree ? base : base;
  }

  function buildGraph(d: NetworkData) {
    if (!graph) graph = new (Graph as any)();
    else graph.clear();
    // Extract meta hints
    const meta: any = (d as any).meta || {};
    if (meta.topLabelCount) topLabelCount = meta.topLabelCount;
    const labelPriorityTop: string[] = meta.labelPriorityTop || [];
  const NODE_RENDER_TYPE = 'circle'; // Sigma built-in program key
    for (const n of d.nodes) {
      if (graph.hasNode(n.id)) continue;
      const strength = (n as any).strength as number | undefined;
      if (strength !== undefined) {
        if (strength > maxStrength) maxStrength = strength;
        if (minStrength === 0 || strength < minStrength) minStrength = strength;
      }
      graph.addNode(n.id, {
        label: n.label,
        ...discPosition(),
        size: sizeFor(strength, (n as any).degree),
        color: colorFor(n.type),
        type: NODE_RENDER_TYPE,
        entityType: n.type,
        degree: (n as any).degree,
        count: n.count,
        strength,
        labelPriority: (n as any).labelPriority
      });
    }
    minWeight = Infinity;
    maxWeight = -Infinity;
    for (const e of d.edges) {
      if (!graph.hasNode(e.source) || !graph.hasNode(e.target)) continue;
      const id = `${e.source}::${e.target}`;
      if (graph.hasEdge(id)) continue;
      if (e.weight < minWeight) minWeight = e.weight;
      if (e.weight > maxWeight) maxWeight = e.weight;
      // Normalize weight lazily later; store raw weight & preliminary size
      graph.addEdgeWithKey(id, e.source, e.target, {
        weight: e.weight,
        weightNorm: (e as any).weightNorm,
        size: 1 + Math.log2((e.weight || 1) + 1),
        color: '#94a3b8'
      });
    }
    if (!isFinite(minWeight)) { minWeight = 1; maxWeight = 1; }
    console.info('[buildGraph] Edge stats:', { 
      totalEdges: d.edges.length, 
      addedEdges: graph.size, 
      minWeight, 
      maxWeight,
      sampleEdge: d.edges[0] 
    });
    // Determine top labels using labelPriority if provided; fallback to score
    if (labelPriorityTop.length) {
      topLabelIds = new Set(labelPriorityTop.slice(0, topLabelCount));
    } else {
      const scored: { id: string; score: number }[] = [];
      graph.forEachNode((id: string, attrs: any) => {
        scored.push({ id, score: (attrs.degree || 0) * 3 + (attrs.count || 0) });
      });
      scored.sort((a, b) => b.score - a.score);
      topLabelIds = new Set(scored.slice(0, topLabelCount).map((s) => s.id));
    }
  }

  function discPosition() {
    const r = Math.sqrt(Math.random());
    const theta = Math.random() * Math.PI * 2;
    return { x: Math.cos(theta) * r, y: Math.sin(theta) * r };
  }

  function safeInit() {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    // Delay until container has real size to avoid WebGL null context
    if (rect.width < 10 || rect.height < 10) {
      requestAnimationFrame(safeInit);
      return;
    }
    refresh();
  }

  function fitCamera() {
    if (!renderer || !graph || firstFitDone) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    graph.forEachNode((id: string, attrs: any) => {
      if (attrs.x < minX) minX = attrs.x;
      if (attrs.y < minY) minY = attrs.y;
      if (attrs.x > maxX) maxX = attrs.x;
      if (attrs.y > maxY) maxY = attrs.y;
    });
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const span = Math.max(maxX - minX, maxY - minY) || 1;
    try {
      const cam = renderer.getCamera();
      cam.setState({ x: cx, y: cy, ratio: span * 1.4 });
      firstFitDone = true;
    } catch {}
  }

  function refresh() {
    const d = (data ?? networkState.filtered ?? networkState.data);
    if (!d || !container) return;
    buildGraph(d);
    if (!renderer) {
      try {
        renderer = new (Sigma as any)(graph, container, {
          renderLabels: true,
          renderEdges: true, // Explicitly enable edge rendering
          enableEdgeHoverEvents: 'debounce',
          // Lower density to avoid overcrowding
          labelDensity: 0.06,
          labelGridCellSize: 120,
          labelRenderedSizeThreshold: 10,
          // Size scaling (see sigma advanced sizes docs)
          minNodeSize: 2,
          maxNodeSize: 16,
          // Much more visible edge sizes but not overwhelming
          minEdgeSize: 0.5,
          maxEdgeSize: 4,
          defaultEdgeType: 'line'
        });
  console.info('[SigmaNetworkGraph] Initialized', graph.order, 'nodes', graph.size, 'edges');
        console.info('[SigmaNetworkGraph] Edge data sample:', 
          graph.size > 0 ? 'Has edges - see graph.edges()' : 'No edges');
        console.info('[SigmaNetworkGraph] Settings:', {
          renderEdges: renderer.getSetting('renderEdges'),
          minEdgeSize: renderer.getSetting('minEdgeSize'),
          maxEdgeSize: renderer.getSetting('maxEdgeSize')
        });
        // Dynamic reducers for clutter management
        renderer.setSetting('nodeReducer', (id: string, data: any) => {
          const r: any = { ...data };
          // Label logic: if forced OR node is in precomputed top set OR sufficiently zoomed OR large strength
          const show = labelsForced || topLabelIds.has(id) || cameraRatio < 0.9 || (r.strength && r.strength > (maxStrength * 0.6));
          if (!show) r.label = undefined;
          // Strength-based highlighting when edges emphasis toggled
          if (edgesEmphasis && r.strength) {
            const norm = (r.strength - minStrength) / ((maxStrength - minStrength) || 1);
            // Slight brightness increase
            if (norm > 0.7) r.color = withAlpha(r.color, 0.95);
          } else if (cameraRatio > 1.1) {
            r.color = withAlpha(r.color, 0.55);
          }
          // Adjust size dynamically each frame if strength present (ensures scaling with emphasis)
          if (r.strength) {
            const normS = (r.strength - minStrength) / ((maxStrength - minStrength) || 1);
            r.size = 2 + normS * 10; // matches minNodeSize/maxNodeSize domain approx
          }
          return r;
        });
        renderer.setSetting('edgeReducer', (id: string, data: any) => {
          const r: any = { ...data };
          // Normalize weight (prefer precomputed weightNorm)
          let t: number;
          if (typeof data.weightNorm === 'number') t = data.weightNorm; else {
            const range = (maxWeight - minWeight);
            t = range > 0 ? (data.weight - minWeight) / range : 0.5; // fallback mid if uniform weights
          }
          t = Math.max(0, Math.min(1, t));
          
          // Check if this edge is connected to selected node
          const selectedId = appState.networkNodeSelected?.id;
          const isSelectedEdge = selectedId ? (() => {
            try {
              const [s, tgt] = graph.extremities(id);
              return s === selectedId || tgt === selectedId;
            } catch { return false; }
          })() : false;
          
          // Size scaling: smaller base, emphasis mode for selected edges
          if (edgesEmphasis) r.size = 1.5 + t * 4; // 1.5 - 5.5
          else r.size = 0.8 + t * 2.5; // 0.8 - 3.3
          
          // Opacity: visible but not overwhelming baseline
          let opacity = 0.15 + t * 0.4; // 0.15 - 0.55 (more visible baseline)
          if (edgesEmphasis) opacity = Math.min(0.8, opacity + 0.2); // boost when emphasized
          if (selectedId && !isSelectedEdge) opacity *= 0.3; // fade for non-neighborhood
          else if (isSelectedEdge) opacity = Math.min(0.9, opacity * 1.8); // highlight selected edges
          
          r.color = `rgba(148,163,184,${opacity.toFixed(3)})`; // slate-400 base
          return r;
        });
        renderer.on('clickNode', (ev: any) => {
          const id = ev.node;
          const n = networkState.data?.nodes.find((x) => x.id === id);
          if (n) {
            appState.networkNodeSelected = n;
            applyFilters();
          }
        });
        renderer.on('doubleClickStage', () => {
          appState.networkNodeSelected = null as any;
          applyFilters();
        });
        // Track camera ratio for reducers
        renderer.getCamera().on('updated', (state: any) => {
          cameraRatio = state.ratio;
          // trigger internal refresh to re-run reducers
          renderer.refresh();
        });
        // Keyboard toggle for labels (L)
        const keyHandler = (e: KeyboardEvent) => {
          const k = e.key.toLowerCase();
          if (k === 'l') {
            labelsForced = !labelsForced;
            renderer.refresh();
          } else if (k === 'e') {
            edgesEmphasis = !edgesEmphasis;
            renderer.refresh();
          }
        };
        window.addEventListener('keydown', keyHandler, { passive: true });
        // Cleanup addition
        const originalKill = renderer.kill?.bind(renderer);
        renderer.kill = () => {
          window.removeEventListener('keydown', keyHandler);
          originalKill?.();
        };
  // Run initial ForceAtlas2 layout iterations (async to keep UI responsive)
  requestAnimationFrame(() => runLayoutWarmup(120));
  fitCamera();
      } catch (err: any) {
  webglError = 'WebGL/Sigma initialization failed: ' + (err?.message || 'Unknown error') + '\nHint: ensure node attribute "type" isn\'t overloaded.';
        console.error('[SigmaNetworkGraph] WebGL init error', err);
      }
    } else if (renderer && !webglError) {
      renderer.setGraph(graph);
      renderer.refresh?.();
  if (!firstFitDone) fitCamera();
    }
  }

  onMount(() => {
    // Resize observer to keep renderer in sync
    const ro = new ResizeObserver(() => {
      try { renderer?.refresh?.(); } catch {}
    });
    if (container) ro.observe(container);
    // Kick off delayed init
    if (!initTried) {
      initTried = true;
      safeInit();
    }
    return () => {
      ro.disconnect();
      try { renderer?.kill?.(); } catch {}
      graph?.clear?.();
    };
  });

  // Reactive refresh on filtered data / selection changes
  $effect(() => {
    // Dependencies: networkState.filtered, appState.networkNodeSelected
    void networkState.filtered; // touch
    void appState.networkNodeSelected; // touch
    if (renderer || initTried) refresh();
  });

  function withAlpha(hex: string, alpha: number) {
    // Accept #RRGGBB
    if (!hex || !hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) return hex;
    // Expand short form
    if (hex.length === 4) {
      const r = hex[1];
      const g = hex[2];
      const b = hex[3];
      hex = `#${r}${r}${g}${g}${b}${b}`;
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function edgeColorWithOpacity(opacity: number) {
    return `rgba(148,163,184,${opacity.toFixed(3)})`; // slate-400 base
  }

  // Incremental ForceAtlas2 layout: run N batches then stop (future: background worker)
  function runLayoutWarmup(iterations: number) {
    if (!graph) return;
    const batch = 20; // iterations per RAF
    const total = iterations;
    let done = 0;
    function step() {
      const remaining = Math.min(batch, total - done);
      if (remaining <= 0) {
        renderer?.refresh?.();
        if (!firstFitDone) fitCamera();
        return;
      }
  // Run ForceAtlas2 with simple numeric iterations (default settings inferred)
  FA2.assign(graph, remaining);
      done += remaining;
      renderer?.refresh?.();
      requestAnimationFrame(step);
    }
    step();
  }
</script>

<div class="w-full h-full relative" style="height: calc(100vh - var(--header-height) - 2rem);">
  <div bind:this={container} class="absolute inset-0"></div>
  {#if webglError}
    <div class="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-red-600 bg-background/80 backdrop-blur">
      {webglError}. Your browser / device may not support WebGL. Try another browser.
    </div>
  {/if}
</div>

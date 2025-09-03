# Network View Roadmap (Implementation-Ready)

This document is the single source of truth to deliver the new Network view that connects events, locations, organizations, persons, and subjects.

Progress snapshot — 2025-09-03
- M1: Placeholder data script added and sample dataset committed (partial done).
- M2: App state/URL updated, basic network state/loader/helpers added (done - initial).
- M3: Placeholder UI components wired into dashboard (done - placeholder).
- M4: Not started.

## Goals
- Add a Network visualization to the dashboard that shows entity co-occurrences from articles.
- Allow drilldown by clicking a node to filter articles, map, and tables.
- Keep performance smooth for up to ~2k nodes / ~10–20k edges.

## Scope (v1)
- Nodes: multi-type nodes (person, organization, event, subject, location).
- Edges: co-occurrence within the same article (typed optionally).
- Weights: number of shared articles; store articleIds for drilldown.
- Time awareness: filter by existing year range and country filters.
- Selection: click node updates appState.selectedEntity and URL deep-link.

## Data Contract
- network.nodes: [{ id: string, type: 'person'|'organization'|'event'|'subject'|'location', label: string, count: number, degree?: number, countryCounts?: Record<string, number> }]
- network.edges: [{ source: string, target: string, type?: 'cooccurrence'|'person-org'|'event-location'|string, weight: number, articleIds: string[] }]
- network.meta: { generatedAt: string, totalNodes: number, totalEdges: number, supportedTypes: string[] }

Edge construction (v1):
- Project each article’s entities to pairwise links across configured type pairs.
- Prune weak edges (weight < threshold) and optionally cap max degree.

## Milestones

### M1 — Data Preparation (Python, scripts/)
Owner: Data

Deliverables:
- scripts/build_networks.py
- static/data/networks/global.json (+ optional per-type subnetworks)
- NPM script: `npm run build:data:networks`

Checklist:
- [ ] Ensure each entity in static/data/entities/*.json has articleIds (extend preprocess_entities.py if needed)
- [x] Implement build_networks.py (placeholder):
  - [x] Load entities JSONs if present and emit tiny demo network
  - [x] Emit global.json with { nodes, edges, meta }
- [x] Add README section for data generation steps (notes added)
- [ ] Add scripts/requirements.txt entry if new libs are used (not needed for placeholder)

Acceptance:
- [ ] global.json validates against Data Contract
- [ ] Size remains reasonable for client load (< ~10MB for v1 target)

### M2 — State & Routing (Svelte 5 runes)
Owner: Frontend

Files:
- src/lib/state/appState.svelte.ts
- src/lib/utils/urlManager.svelte.ts
- src/lib/state/networkData.svelte.ts (new)

Checklist:
- [x] Extend appState.activeVisualization to include 'network'
- [x] Add URL support: ?view=dashboard&viz=network&node=type:id
- [x] Create networkData.svelte.ts:
  - [x] Load static/data/networks/global.json (lazy)
  - [x] Expose network state: { nodes, edges, meta } and filters
  - [x] Provide helpers: getNodeById, getNeighbors(id), applyFilters
- [ ] Selecting a node sets appState.selectedEntity = { type, id }

Acceptance:
- [ ] Deep-link opens Network view and focuses selected node if provided
- [ ] Changing timeline or country filter updates derived network slices

### M3 — UI Components (Network View)
Owner: Frontend

Files (new):
- src/lib/components/network/NetworkGraph.svelte
- src/lib/components/network/NetworkPanel.svelte

Checklist:
- [x] NetworkGraph.svelte
  - [ ] Lazy import d3-force and render to canvas for performance (placeholder grid renderer)
  - [ ] Node color by type; size by count or degree (color+size partial)
  - [ ] Edge thickness by weight (pending)
  - [ ] Hover tooltip and click selection (pending)
  - [ ] Debounce layout (pending)
- [x] NetworkPanel.svelte
  - [x] Controls: type toggles, weight threshold
  - [ ] Degree cap, search, legend/stats (pending)
- [x] Wire into dashboard: new nav entry "Network"

Acceptance:
- [ ] Graph renders smoothly with target dataset
- [ ] Node click updates map/table via selectedEntity
- [ ] Year range changes reduce graph accordingly

### M4 — Integration & Tests
Owner: Frontend + QA

Checklist:
- [ ] Integration: selecting node filters mapData and tables (reuse entity→articleIds)
- [ ] Unit tests
  - [ ] Network builder logic (pure TS helper or snapshot against global.json)
- [ ] Derived filtering by date range and type toggles
  - [ ] URL manager sync for node param
- [ ] E2E tests (Playwright)
  - [ ] Navigate to Network view and render
  - [ ] Search and select node updates URL and app state
  - [ ] Timeline change reduces edges
- [ ] Performance checks with performanceUtils.ts

Acceptance:
- [ ] Tests pass in CI and locally
- [ ] Smoke test on midrange laptop meets responsiveness expectations

## Configuration
- Type pairs (default): cross-type only to reduce density
  - [('person','organization'), ('event','location'), ('person','event'), ('organization','event'), ('subject','event')]
- WEIGHT_MIN (default): 2
- DEGREE_CAP (optional): 100
- TOP_NEIGHBORS (optional): 50

## Risks & Mitigations
- Large graphs cause slowdowns → switch to Graphology + Sigma.js (v1.5), pre-prune, lazy load
- Sparse articleIds on entities → fix in preprocess_entities.py
- URL sync edge cases → add unit tests for urlManager

## Nice-to-haves (v1.5+)
- Community detection (Louvain) precomputed in Python
- Ego-network focus/expand mode
- Edge bundling for readability
- Export PNG/CSV for current subgraph

## Implementation Notes
- Use Svelte 5 runes: $state, $derived, $props, $effect
- Keep typing in src/lib/types; add Network* types if needed
- Lazy-import heavy libs in onMount
- Follow Tailwind/shadcn patterns for UI

## Done Definition for v1
- New Network nav item routes to a working graph
- Deep-linking works and selecting a node filters the map and tables
- Timeline range filtering impacts the graph in real time or on apply
- Handles ~1–2k nodes and ~10–20k edges fluidly
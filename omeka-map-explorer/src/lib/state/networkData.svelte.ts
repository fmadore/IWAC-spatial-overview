import type { NetworkData, NetworkEdge, NetworkNode } from '$lib/types';
import { appState } from '$lib/state/appState.svelte';

interface NetworkState {
  data: NetworkData | null;
  filtered: NetworkData | null; // derived by filters (range, types)
  typesEnabled: Record<string, boolean>; // toggles per node type
  weightMin: number;
  degreeCap?: number;
}

export const networkState = $state<NetworkState>({
  data: null,
  filtered: null,
  typesEnabled: { person: true, organization: true, event: true, subject: true, location: true },
  weightMin: 2,
  degreeCap: undefined
});

export async function loadNetwork(pathPrefix = 'data') {
  if (networkState.data) return networkState.data;
  try {
    const res = await fetch(`${pathPrefix}/networks/global.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Failed to load network: ${res.status}`);
    const json = (await res.json()) as NetworkData;
    networkState.data = json;
    networkState.filtered = json; // initial
    appState.networkLoaded = true;
    return json;
  } catch (e) {
    console.error('loadNetwork error', e);
    appState.networkLoaded = false;
    throw e;
  }
}

export function getNodeById(id: string): NetworkNode | undefined {
  return networkState.data?.nodes.find((n) => n.id === id);
}

export function getNeighbors(id: string): { node: NetworkNode; edge: NetworkEdge }[] {
  const data = networkState.data;
  if (!data) return [];
  const neighbors: { node: NetworkNode; edge: NetworkEdge }[] = [];
  for (const e of data.edges) {
    if (e.source === id) {
      const n = data.nodes.find((n) => n.id === e.target);
      if (n) neighbors.push({ node: n, edge: e });
    } else if (e.target === id) {
      const n = data.nodes.find((n) => n.id === e.source);
      if (n) neighbors.push({ node: n, edge: e });
    }
  }
  return neighbors;
}

export function applyFilters() {
  const data = networkState.data;
  if (!data) return;
  const enabled = networkState.typesEnabled;
  const wmin = networkState.weightMin;
  let nodes = data.nodes.filter((n) => enabled[n.type]);
  let nodeSet = new Set(nodes.map((n) => n.id));
  let edges = data.edges.filter(
    (e) => e.weight >= wmin && nodeSet.has(e.source) && nodeSet.has(e.target)
  );

  // Degree cap (optional)
  if (networkState.degreeCap && networkState.degreeCap > 0) {
    const degree = new Map<string, number>();
    for (const e of edges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }
    const capped = new Set(
      [...degree.entries()].filter(([, d]) => d <= networkState.degreeCap!).map(([id]) => id)
    );
    nodes = nodes.filter((n) => capped.has(n.id));
    nodeSet = new Set(nodes.map((n) => n.id));
    edges = edges.filter((e) => nodeSet.has(e.source) && nodeSet.has(e.target));
  }

  networkState.filtered = { nodes, edges, meta: data.meta };
}

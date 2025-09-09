<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { networkState, getNodeById, applyFilters } from '$lib/state/networkData.svelte';
	import { appState } from '$lib/state/appState.svelte';
	import { NetworkInteractionHandler } from './modules/NetworkInteractionHandler';
	import NetworkSearchBar from './NetworkSearchBar.svelte';

	// Props for network highlighting functions
	let {
		highlightNodes,
		clearHighlight,
		focusOnNode,
		onResetFilters
	} = $props<{
		highlightNodes?: (nodeIds: string[]) => void;
		clearHighlight?: () => void;
		focusOnNode?: (nodeId: string) => void;
		onResetFilters?: () => void;
	}>();

	// Reactive stats
	const networkStats = $derived.by(() => {
		if (!networkState.filtered) {
			return { nodes: 0, edges: 0, types: {} as Record<string, number>, totalArticles: 0, avgArticles: 0 };
		}
		const nodeStats = NetworkInteractionHandler.getNodeStatistics(networkState.filtered.nodes);
		return {
			nodes: networkState.filtered.nodes.length,
			edges: networkState.filtered.edges.length,
			types: nodeStats.typeDistribution,
			totalArticles: nodeStats.totalCount,
			avgArticles: Math.round(nodeStats.averageCount)
		};
	});

	const availableTypes = $derived.by(() => {
		if (!networkState.data) return [] as string[];
		return NetworkInteractionHandler.getAvailableTypes(networkState.data.nodes);
	});

	// Event handlers
	function onWeightChange(e: Event) {
		const value = Number((e.target as HTMLInputElement).value);
		if (Number.isFinite(value) && value >= 1) {
			networkState.weightMin = value;
			applyFilters();
		}
	}

	function onDegreeCapChange(e: Event) {
		const value = Number((e.target as HTMLInputElement).value);
		networkState.degreeCap = Number.isFinite(value) && value > 0 ? value : undefined;
		applyFilters();
	}

	function toggleType(type: string) {
		if (!(type in networkState.typesEnabled)) {
			networkState.typesEnabled[type] = true;
		}
		networkState.typesEnabled[type] = !networkState.typesEnabled[type];
		applyFilters();
	}

	// Export the reset function for parent components to use
	export function resetNetworkFilters() {
		networkState.weightMin = 2;
		networkState.degreeCap = undefined;
		Object.keys(networkState.typesEnabled).forEach((t) => {
			networkState.typesEnabled[t] = true;
		});
		applyFilters();
		if (onResetFilters) {
			onResetFilters();
		}
	}

	function clearNetworkSelection() {
		NetworkInteractionHandler.handleNodeSelection(null);
	}

	// Node type colors and labels
	const typeColors: Record<string, string> = {
		person: '#2563eb',
		organization: '#7c3aed',
		event: '#059669',
		subject: '#d97706',
		location: '#ef4444',
	};

	const typeLabels: Record<string, string> = {
		person: 'Persons',
		organization: 'Organizations',
		event: 'Events',
		subject: 'Subjects',
		location: 'Locations',
	};
</script>

<!-- Search Nodes -->
<Sidebar.Group>
	<Sidebar.GroupLabel>Search Nodes</Sidebar.GroupLabel>
	<Sidebar.GroupContent>
		<NetworkSearchBar
			placeholder="Search nodes..."
			onHighlight={highlightNodes}
			onClearHighlight={clearHighlight}
			onNodeSelect={(node: import('$lib/types').NetworkNode) => {
				if (focusOnNode) {
					focusOnNode(node.id);
				}
			}}
		/>
	</Sidebar.GroupContent>
</Sidebar.Group>

<Sidebar.Separator />

<!-- Network Filters -->
<Sidebar.Group>
	<Sidebar.GroupLabel>Network Filters</Sidebar.GroupLabel>
	<Sidebar.GroupContent class="space-y-4">
		<div class="space-y-2">
			<Label for="weightMin" class="text-sm font-medium">
				Minimum edge weight: {networkState.weightMin}
			</Label>
			<input
				id="weightMin"
				type="range"
				min="1"
				max="10"
				step="1"
				value={networkState.weightMin}
				oninput={onWeightChange}
				class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
			/>
			<p class="text-xs text-muted-foreground">
				Filter out weak connections
			</p>
		</div>

		<div class="space-y-2">
			<Label for="degreeCap" class="text-sm font-medium">
				Max connections per node
			</Label>
			<input
				id="degreeCap"
				type="number"
				min="1"
				placeholder="No limit"
				value={networkState.degreeCap || ''}
				oninput={onDegreeCapChange}
				class="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
			/>
			<p class="text-xs text-muted-foreground">
				Limit highly connected nodes
			</p>
		</div>
	</Sidebar.GroupContent>
</Sidebar.Group>

<Sidebar.Separator />

<!-- Entity Types -->
<Sidebar.Group>
	<Sidebar.GroupLabel>Entity Types</Sidebar.GroupLabel>
	<Sidebar.GroupContent class="space-y-2">
		{#each availableTypes as type}
			<button
				class="flex items-center justify-between w-full px-3 py-2 text-sm rounded-md border transition-colors {networkState.typesEnabled[type] !== false ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'}"
				onclick={() => toggleType(type)}
			>
				<div class="flex items-center gap-2">
					<div 
						class="w-3 h-3 rounded-full" 
						style="background-color: {typeColors[type] || '#6b7280'}"
					></div>
					<span>{typeLabels[type] || type}</span>
				</div>
				<span class="text-xs opacity-70">
					{networkStats.types[type] || 0}
				</span>
			</button>
		{/each}
	</Sidebar.GroupContent>
</Sidebar.Group>

<!-- Selected Node -->
{#if appState.networkNodeSelected}
	<Sidebar.Separator />

	<Sidebar.Group>
		<Sidebar.GroupLabel>Selected Node</Sidebar.GroupLabel>
		<Sidebar.GroupContent>
			<div class="space-y-2 p-3 bg-accent/20 rounded-md border">
				<div class="flex items-center justify-between">
					<span class="font-medium text-sm">
						{getNodeById(appState.networkNodeSelected.id)?.label || 'Unknown'}
					</span>
					<button
						onclick={clearNetworkSelection}
						class="text-xs text-muted-foreground hover:text-foreground"
					>
						Clear
					</button>
				</div>
				<div class="text-sm text-muted-foreground">
					Articles: {getNodeById(appState.networkNodeSelected.id)?.count || 0}
				</div>
			</div>
		</Sidebar.GroupContent>
	</Sidebar.Group>
{/if}

<Sidebar.Separator />

<!-- Statistics -->
<Sidebar.Group>
	<Sidebar.GroupLabel>Statistics</Sidebar.GroupLabel>
	<Sidebar.GroupContent>
		<div class="space-y-2 text-xs text-muted-foreground">
			<div class="grid grid-cols-2 gap-2">
				<div>Visible nodes: <span class="font-medium">{networkStats.nodes}</span></div>
				<div>Visible edges: <span class="font-medium">{networkStats.edges}</span></div>
				<div>Total articles: <span class="font-medium">{networkStats.totalArticles}</span></div>
				<div>Avg per node: <span class="font-medium">{networkStats.avgArticles}</span></div>
			</div>
		</div>
	</Sidebar.GroupContent>
</Sidebar.Group>

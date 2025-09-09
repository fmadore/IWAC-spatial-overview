<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { Button } from '$lib/components/ui/button';
	import { appState } from '$lib/state/appState.svelte';
	import { filters, clearFilters } from '$lib/state/filters.svelte';
	import { mapData } from '$lib/state/mapData.svelte';
	import { urlManager } from '$lib/utils/urlManager.svelte';
	import { cn } from '$lib/utils';
	import { Home, Globe2, Users, Building2, CalendarRange, Tags, MapPin, Share2 } from '@lucide/svelte';
	import CountryFilter from '$lib/components/filters/CountryFilter.svelte';
	import YearRangeFilter from '$lib/components/filters/YearRangeFilter.svelte';
	import EntitySelector from '$lib/components/entities/entity-selector.svelte';
	import { networkState, getNodeById, applyFilters } from '$lib/state/networkData.svelte';
	import { NetworkInteractionHandler } from '$lib/components/network/modules/NetworkInteractionHandler';
	import NetworkSearchBar from '$lib/components/network/NetworkSearchBar.svelte';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';

	let { variant = 'inset' } = $props<{ variant?: 'floating' | 'inset' }>();

	type Viz = 'overview' | 'worldMap' | 'countryFocus' | 'persons' | 'organizations' | 'events' | 'subjects' | 'locations' | 'network';
	const nav: Array<{ id: Viz; label: string; icon: any; view?: 'dashboard' | 'map' }> = [
		{ id: 'overview', label: 'Overview', icon: Home, view: 'dashboard' },
		{ id: 'worldMap', label: 'World Map', icon: Globe2, view: 'dashboard' },
		{ id: 'countryFocus', label: 'Country Focus', icon: MapPin, view: 'dashboard' },
		{ id: 'persons', label: 'Persons', icon: Users, view: 'dashboard' },
		{ id: 'organizations', label: 'Organizations', icon: Building2, view: 'dashboard' },
		{ id: 'events', label: 'Events', icon: CalendarRange, view: 'dashboard' },
		{ id: 'subjects', label: 'Subjects', icon: Tags, view: 'dashboard' },
		{ id: 'locations', label: 'Locations', icon: MapPin, view: 'dashboard' },
		{ id: 'network', label: 'Network', icon: Share2, view: 'dashboard' }
	];

	function switchTo(item: { id: Viz; view?: 'dashboard' | 'map' }) {
		// Clear all filters and entity selections when switching visualizations
		clearFilters();
		appState.selectedEntity = null;
		appState.networkNodeSelected = null;
		// Immediately reflect cleared filters in the URL
		urlManager.updateUrl({ immediate: true });

		// Use centralized navigator to update state + URL immediately
		urlManager.navigateTo(item.view ?? 'dashboard', item.id);
	}

	// Network-specific computed values
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

	// Network event handlers
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

	function resetNetworkFilters() {
		networkState.weightMin = 2;
		networkState.degreeCap = undefined;
		Object.keys(networkState.typesEnabled).forEach((t) => {
			networkState.typesEnabled[t] = true;
		});
		applyFilters();
	}

	function clearNetworkSelection() {
		NetworkInteractionHandler.handleNodeSelection(null);
	}

	// Get network highlighting functions from app state
	const highlightNodes = $derived(appState.networkHighlightingFunctions?.highlightNodes);
	const clearHighlight = $derived(appState.networkHighlightingFunctions?.clearHighlight);
	const focusOnNode = $derived(appState.networkHighlightingFunctions?.focusOnNode);

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

<Sidebar.Root class={cn(variant === 'inset' && 'bg-sidebar')}>
	<Sidebar.Header>
		<Sidebar.Group>
			<Sidebar.GroupLabel>IWAC Spatial Overview</Sidebar.GroupLabel>
		</Sidebar.Group>
	</Sidebar.Header>
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Visualizations</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				{#each nav as item}
					<Button
						variant={appState.activeVisualization === item.id ? 'default' : 'ghost'}
						class="justify-start gap-2 w-full"
						onclick={() => switchTo(item)}
					>
						<item.icon class="h-4 w-4" />
						{item.label}
					</Button>
				{/each}
			</Sidebar.GroupContent>
		</Sidebar.Group>

		{#if appState.activeVisualization === 'worldMap'}
			<Sidebar.Separator />

			<Sidebar.Group>
				<Sidebar.GroupLabel>Filters</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<CountryFilter
						countries={filters.available.countries}
						selected={filters.selected.countries}
					/>
				</Sidebar.GroupContent>
			</Sidebar.Group>

			<Sidebar.Separator />

			<Sidebar.Group>
				<Sidebar.GroupContent>
					<YearRangeFilter range={filters.available.dateRange} />
				</Sidebar.GroupContent>
			</Sidebar.Group>
		{:else if appState.activeVisualization === 'network'}
			<Sidebar.Separator />

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
		{/if}
	</Sidebar.Content>
	<Sidebar.Footer>
		{#if appState.activeVisualization === 'worldMap'}
			<div class="p-4">
				<div class="mb-3 text-xs text-muted-foreground">Map view</div>
				<div class="flex items-center gap-2 mb-4">
					<Button
						type="button"
						variant={mapData.viewMode === 'bubbles' ? 'default' : 'outline'}
						size="sm"
						aria-pressed={mapData.viewMode === 'bubbles'}
						onclick={() => (mapData.viewMode = 'bubbles')}>Bubbles</Button
					>
					<Button
						type="button"
						variant={mapData.viewMode === 'choropleth' ? 'default' : 'outline'}
						size="sm"
						aria-pressed={mapData.viewMode === 'choropleth'}
						onclick={() => (mapData.viewMode = 'choropleth')}>Choropleth</Button
					>
				</div>
				<button
					class="w-full px-4 py-2 text-sm font-medium text-foreground bg-background border border-input rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
					onclick={() => { clearFilters(); urlManager.updateUrl({ immediate: true }); }}
				>
					Reset All Filters
				</button>
			</div>
		{:else if appState.activeVisualization === 'network'}
			<div class="p-4">
				<div class="mb-3 text-xs text-muted-foreground">Network view</div>
				<button
					class="w-full px-4 py-2 text-sm font-medium text-foreground bg-background border border-input rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
					onclick={resetNetworkFilters}
				>
					Reset Network Filters
				</button>
				<div class="mt-3 text-xs text-muted-foreground">
					<div class="space-y-1">
						<div><kbd class="px-1 py-0.5 text-xs bg-muted rounded">F</kbd> Fit to view</div>
						<div><kbd class="px-1 py-0.5 text-xs bg-muted rounded">R</kbd> Run layout</div>
						<div><kbd class="px-1 py-0.5 text-xs bg-muted rounded">Esc</kbd> Clear selection</div>
						<div><kbd class="px-1 py-0.5 text-xs bg-muted rounded">C</kbd> Center on selected</div>
					</div>
				</div>
			</div>
		{:else}
			<div class="p-4 text-xs text-muted-foreground">v1 • Dashboard</div>
		{/if}
	</Sidebar.Footer>
</Sidebar.Root>

<style>
	kbd {
		font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
	}
</style>

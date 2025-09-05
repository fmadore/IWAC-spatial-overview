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
	import NetworkPanel from '$lib/components/network/NetworkPanel.svelte';
	import EntitySelector from '$lib/components/entities/entity-selector.svelte';
	import { networkState, getNodeById } from '$lib/state/networkData.svelte';

	let { variant = 'inset' } = $props<{ variant?: 'floating' | 'inset' }>();

	type Viz = 'overview' | 'byCountry' | 'persons' | 'organizations' | 'events' | 'subjects' | 'locations' | 'network';
	const nav: Array<{ id: Viz; label: string; icon: any; view?: 'dashboard' | 'map' }> = [
		{ id: 'overview', label: 'Overview', icon: Home, view: 'dashboard' },
		{ id: 'byCountry', label: 'By Country (Map)', icon: Globe2, view: 'map' },
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

		{#if appState.activeView === 'map' && appState.activeVisualization === 'byCountry'}
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
				<Sidebar.GroupLabel>Network</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<NetworkPanel />
				</Sidebar.GroupContent>
			</Sidebar.Group>


		{/if}
	</Sidebar.Content>
	<Sidebar.Footer>
		{#if appState.activeView === 'map' && appState.activeVisualization === 'byCountry'}
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
		{:else}
			<div class="p-4 text-xs text-muted-foreground">v0 • Dashboard</div>
		{/if}
	</Sidebar.Footer>
</Sidebar.Root>

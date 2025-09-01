<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	// Rune state modules (Svelte 5)
	import { appState } from '$lib/state/appState.svelte';
	import { timeData } from '$lib/state/timeData.svelte';
	import { filters } from '$lib/state/filters.svelte';
	import { mapData } from '$lib/state/mapData.svelte';
	import { initialize as initAnimationController } from '$lib/components/timeline/AnimationController';
	import { loadStaticData } from '$lib/utils/staticDataLoader';
	import { loadEntities } from '$lib/utils/entityLoader';
	import { urlManager, initializeUrlManager } from '$lib/utils/urlManager.svelte';
	import type { ProcessedItem } from '$lib/types';
	import { browser } from '$app/environment';

	import Map from '$lib/components/maps/Map.svelte';
	import Timeline from '$lib/components/timeline/Timeline.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import SiteHeader from '$lib/components/site-header.svelte';
	import SectionCards from '$lib/components/section-cards.svelte';
	import ChartAreaInteractive from '$lib/components/chart-area-interactive.svelte';
	import DataTable from '$lib/components/data-table.svelte';
	import {
		PersonsVisualization,
		OrganizationsVisualization,
		EventsVisualization,
		SubjectsVisualization
	} from '$lib/components/entities';

	// Configuration
	const countryItemSets: Record<string, number[]> = {
		Benin: [2185, 5502, 2186, 2188, 2187, 2191, 2190, 2189, 4922, 5501, 5500],
		'Burkina Faso': [
			2199, 2200, 23448, 23273, 23449, 5503, 2215, 2214, 2207, 2209, 2210, 2213, 2201
		],
		Togo: [9458, 25304, 5498, 5499],
		"Côte d'Ivoire": [43051, 31882, 15845, 45390]
	};

	// Lazy load entities when navigating to entity views
	async function loadEntityData(entityType: 'persons' | 'organizations' | 'events' | 'subjects') {
		try {
			const entities = await loadEntities(entityType, 'data');
			switch (entityType) {
				case 'persons':
					mapData.persons = entities;
					break;
				case 'organizations':
					mapData.organizations = entities;
					break;
				case 'events':
					mapData.events = entities;
					break;
				case 'subjects':
					mapData.subjects = entities;
					break;
			}
		} catch (error) {
			console.error(`Failed to load ${entityType}:`, error);
		}
	}

	onMount(async () => {
		if (!browser) return;

		try {
			// Initialize URL manager
			initializeUrlManager();

			// Parse current URL search parameters and set initial state
			urlManager.parseUrlAndUpdateState($page.url.searchParams);

			// Initialize animation controller
			initAnimationController();

			// Start loading data
			appState.loading = true;
			const loaded = await loadStaticData('data');

			// Populate stores from static data
			mapData.allItems = loaded.items;
			mapData.visibleItems = loaded.items;
			mapData.places = loaded.places; // Raw places data for choropleth

			filters.available.countries = loaded.countries;
			filters.available.newspapers = loaded.newspapers;
			if (loaded.dateMin && loaded.dateMax) {
				filters.available.dateRange = { min: loaded.dateMin, max: loaded.dateMax };
				timeData.range.start = loaded.dateMin;
				timeData.range.end = loaded.dateMax;
				timeData.currentDate = loaded.dateMin;
			}

			timeData.data = loaded.timeline;

			// Mark loading complete
			appState.loading = false;
			appState.dataLoaded = true;
		} catch (error) {
			console.error('Error initializing application:', error);

			appState.loading = false;
			appState.error = error instanceof Error ? error.message : 'Failed to initialize application';
		}
	});

	// Watch for page changes and update state accordingly
	$effect(() => {
		if (browser && $page.url.searchParams) {
			urlManager.parseUrlAndUpdateState($page.url.searchParams);
		}
	});

	// Load entity data when visualization changes to persons/organizations/events/subjects
	$effect(() => {
		if (appState.dataLoaded && browser) {
			const viz = appState.activeVisualization;
			if (viz === 'persons' || viz === 'organizations' || viz === 'events' || viz === 'subjects') {
				loadEntityData(viz);
			}
		}
	});

	// (Removed mock data generation and filter initialization; now using static JSON loader)
</script>

<svelte:head>
	<title>Omeka S Map Explorer</title>
</svelte:head>

<!-- Ensure an accessible page heading is always present (helps tests too) -->
<h1 class="sr-only">IWAC Spatial Overview</h1>

{#if !browser}
	<div class="ssr-message">
		<h1 class="sr-only">IWAC Spatial Overview</h1>
		<p>Map visualization loading...</p>
	</div>
{:else if appState.loading}
	<div class="loading-indicator">
		<h1 class="sr-only">IWAC Spatial Overview</h1>
		<p>Loading data...</p>
	</div>
{:else if appState.error}
	<div class="error-display">
		<h1 class="sr-only">IWAC Spatial Overview</h1>
		<h2>Error</h2>
		<p>{appState.error}</p>
	</div>
{:else if appState.activeView === 'dashboard'}
	<!-- Dashboard view -->
	<SiteHeader />
	<div class="flex flex-1 flex-col">
		<div class="@container/main flex flex-1 flex-col gap-2">
			{#if appState.activeVisualization === 'overview'}
				<div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
					<SectionCards />
					<div class="px-4 lg:px-6">
						<ChartAreaInteractive />
					</div>
					<div class="px-4 lg:px-6">
						<DataTable />
					</div>
				</div>
			{:else if appState.activeVisualization === 'persons'}
				<PersonsVisualization />
			{:else if appState.activeVisualization === 'organizations'}
				<OrganizationsVisualization />
			{:else if appState.activeVisualization === 'events'}
				<EventsVisualization />
			{:else if appState.activeVisualization === 'subjects'}
				<SubjectsVisualization />
			{:else}
				<!-- Other visualizations placeholder -->
				<div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
					<div class="px-4 lg:px-6">
						<h2 class="text-2xl font-bold">
							{appState.activeVisualization.charAt(0).toUpperCase() +
								appState.activeVisualization.slice(1)}
						</h2>
						<p class="text-muted-foreground">This visualization is not yet implemented.</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
{:else if appState.activeView === 'map'}
	<!-- Map view -->
	<SiteHeader />
	<div class="flex flex-1 flex-col overflow-hidden">
		<div class="flex-1 relative z-0">
			<Map />
		</div>

		<div class="border-t bg-muted/30 p-4 relative z-10">
			<Timeline data={timeData.data} height="120px" />
		</div>

		{#if appState.selectedItem}
			<div class="border-t p-4 bg-background">
				<div class="bg-card rounded-lg p-4 shadow-sm">
					<h3 class="font-semibold text-lg mb-2">{appState.selectedItem.title}</h3>
					<div class="space-y-1 text-sm text-muted-foreground">
						<p>Date: {appState.selectedItem.publishDate?.toLocaleDateString()}</p>
						<p>Country: {appState.selectedItem.country}</p>
						<p>Source: {appState.selectedItem.newspaperSource}</p>
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.loading-indicator,
	.error-display,
	.ssr-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		width: 100vw;
	}

	.error-display {
		color: #d32f2f;
	}

	.ssr-message {
		background-color: #f5f5f5;
		color: #333;
	}
</style>

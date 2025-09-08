<script lang="ts">
	import type { ProcessedItem } from '$lib/types';
	import { ExternalLink, MapPin, Users, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';

	interface LocationGroup {
		lat: number;
		lng: number;
		count: number;
		sample: ProcessedItem;
		items: ProcessedItem[];
		name?: string; // Canonical place label for this coordinate
	}

	interface Props {
		group: LocationGroup;
		showAll?: boolean;
	}

	let { group, showAll = false }: Props = $props();

	function getArticleUrl(articleId: string): string {
		// Extract the original article ID (remove coordinate index suffix)
		const originalId = articleId.split('-')[0];
		return `https://islam.zmo.de/s/westafrica/item/${originalId}`;
	}

	function formatDate(date: Date | null): string {
		if (!date) return '';
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	// Get unique place names from the items
	const placeNames = $derived(() => {
		const places = new Set<string>();
		group.items?.forEach(item => {
			if (item.spatial) {
				item.spatial.forEach(place => places.add(place));
			}
		});
		return Array.from(places).sort();
	});

	// Determine display name: prefer canonical group.name, else first item's placeLabel, else fallback
	const displayPlaceName = $derived(() => group.name || group.sample.placeLabel || (placeNames().length > 0 ? placeNames()[0] : 'Unknown Location'));

	// Get unique countries and newspapers
	const countries = $derived(() => {
		const countrySet = new Set<string>();
		group.items?.forEach(item => {
			if (item.articleCountry) countrySet.add(item.articleCountry);
		});
		return Array.from(countrySet).sort();
	});

	const newspapers = $derived(() => {
		const newspaperSet = new Set<string>();
		group.items?.forEach(item => {
			if (item.newspaperSource) newspaperSet.add(item.newspaperSource);
		});
		return Array.from(newspaperSet).sort();
	});

		// Pagination state (always show a paginated list to avoid layout toggle flicker)
		let currentPage = $state(1);
		const itemsPerPage = 5; // show 5 articles at a time as requested

		// Sort items by most recent publish date (fallback to sample if missing)
		const sortedItems = $derived(() => {
			const items = (group.items && group.items.length ? group.items : [group.sample]).slice();
			items.sort((a, b) => (b.publishDate?.getTime() || 0) - (a.publishDate?.getTime() || 0));
			return items;
		});

		const totalPages = $derived(() => Math.max(1, Math.ceil(sortedItems().length / itemsPerPage)));

		const pagedItems = $derived(() => {
			const start = (currentPage - 1) * itemsPerPage;
			return sortedItems().slice(start, start + itemsPerPage);
		});
</script>

<div class="map-popup min-w-96 max-w-md p-4" role="dialog" aria-label="Location details">
	<!-- Main location title -->
	<div class="border-b pb-4 mb-4">
		<h3 class="font-bold text-xl text-foreground mb-1 flex items-center gap-2">
			<MapPin class="h-5 w-5 text-primary" />
			{displayPlaceName()}
		</h3>
		
		<!-- Article count -->
		<div class="flex items-center gap-2 mb-2">
			<Users class="h-4 w-4 text-muted-foreground" />
			<span class="font-semibold">
				{group.count} Article{group.count === 1 ? '' : 's'}
			</span>
		</div>

		<!-- Coordinates -->
		<div class="text-sm text-muted-foreground font-mono mb-2">
			{group.lat.toFixed(4)}, {group.lng.toFixed(4)}
		</div>
	</div>

	<!-- Additional places, countries, newspapers summary -->
	<div class="space-y-3 mb-4">
		<!-- Other places -->
		{#if placeNames().length > 1}
			<div>
				<span class="text-sm font-medium text-muted-foreground">Other places: </span>
				<span class="text-sm">
					{placeNames().slice(1, 4).join(', ')}
					{#if placeNames().length > 4}
						<span class="text-muted-foreground"> +{placeNames().length - 4} more</span>
					{/if}
				</span>
			</div>
		{/if}

		<!-- Countries -->
		{#if countries().length > 0}
			<div>
				<span class="text-sm font-medium text-muted-foreground">Countries: </span>
				<span class="text-sm">{countries().join(', ')}</span>
			</div>
		{/if}

		<!-- Newspapers -->
		{#if newspapers().length > 0}
			<div>
				<span class="text-sm font-medium text-muted-foreground">Newspapers: </span>
				<span class="text-sm">
					{newspapers().slice(0, 2).join(', ')}
					{#if newspapers().length > 2}
						<span class="text-muted-foreground"> +{newspapers().length - 2} more</span>
					{/if}
				</span>
			</div>
		{/if}
	</div>

	<!-- Articles list (always visible, paginated) -->
	<div class="border-t pt-3 space-y-3">
		<!-- Pagination info -->
		<div class="flex items-center justify-between text-xs text-muted-foreground">
			<span>Page {currentPage} of {totalPages()}</span>
			<span>{((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, group.count)} of {group.count}</span>
		</div>

		<!-- Articles list -->
		<div class="space-y-2 max-h-64 overflow-y-auto pr-1">
			{#each pagedItems() as item}
				<div class="border rounded p-2 text-sm hover:bg-accent/40 transition-colors">
					<a
						href={getArticleUrl(item.id)}
						target="_blank"
						rel="noopener noreferrer"
						class="font-medium text-blue-600 hover:text-blue-800 transition-colors block mb-1"
					>
						{item.title}
						<ExternalLink class="h-3 w-3 inline ml-1" />
					</a>
					<div class="text-xs text-muted-foreground flex flex-wrap gap-x-1">
						{formatDate(item.publishDate)} • {item.articleCountry} • {item.newspaperSource}
					</div>
				</div>
			{/each}
		</div>

		<!-- Pagination controls -->
		{#if totalPages() > 1}
			<div class="flex items-center justify-between">
				<Button
					variant="outline"
					size="sm"
					onclick={() => currentPage = Math.max(1, currentPage - 1)}
					disabled={currentPage === 1}
					class="text-xs"
				>
					<ChevronLeft class="h-3 w-3 mr-1" /> Previous
				</Button>
				<span class="text-xs text-muted-foreground">{currentPage} / {totalPages()}</span>
				<Button
					variant="outline"
					size="sm"
					onclick={() => currentPage = Math.min(totalPages(), currentPage + 1)}
					disabled={currentPage === totalPages()}
					class="text-xs"
				>
					Next <ChevronRight class="h-3 w-3 ml-1" />
				</Button>
			</div>
		{/if}
	</div>
</div>

<style>
	.map-popup {
		font-family: inherit;
		background: white;
		border-radius: 6px;
	}
</style>

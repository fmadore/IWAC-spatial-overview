<script lang="ts">
	import type { ProcessedItem } from '$lib/types';
	import { ExternalLink, MapPin, Users, ChevronLeft, ChevronRight, Globe, Newspaper } from 'lucide-svelte';
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
		const itemsPerPage = 3; // compact view: show 3 articles per page

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

<div class="map-popup min-w-96 max-w-md p-3" role="dialog" aria-label="Location details">
	<!-- Main location title -->
	<div class="border-b pb-2 mb-2">
		<h3 class="font-semibold text-lg text-foreground mb-1 flex items-center gap-2 leading-tight">
			<MapPin class="h-5 w-5 text-primary" />
			{displayPlaceName()}
		</h3>
		
		<!-- Article count -->
		<div class="flex items-center gap-2 mb-1 text-sm">
			<Users class="h-4 w-4 text-muted-foreground" />
			<span class="font-semibold">
				{group.count} Article{group.count === 1 ? '' : 's'}
			</span>
		</div>

		<!-- Coordinates -->
		<div class="text-xs text-muted-foreground font-mono mb-1">
			{group.lat.toFixed(4)}, {group.lng.toFixed(4)}
		</div>
	</div>

	<!-- Additional places, countries, newspapers summary -->
	<div class="space-y-1 mb-2 text-[11px] leading-snug">
		<!-- Associated places -->
		{#if placeNames().length > 1}
			<div class="flex items-start gap-1">
				<MapPin class="h-3 w-3 mt-[2px] text-muted-foreground" />
				<div class="flex-1">
					<span class="font-medium text-foreground">Places in these articles ({placeNames().length - 1} other{placeNames().length - 1 === 1 ? '' : 's'}): </span>
					<span>
						{placeNames().slice(1, 4).join(', ')}
						{#if placeNames().length > 4}
							<span class="text-muted-foreground"> +{placeNames().length - 4} more</span>
						{/if}
					</span>
				</div>
			</div>
		{/if}

		<!-- Article countries -->
		{#if countries().length > 0}
			<div class="flex items-start gap-1">
				<Globe class="h-3 w-3 mt-[2px] text-muted-foreground" />
				<div class="flex-1">
					<span class="font-medium text-foreground">Article countr{countries().length === 1 ? 'y' : 'ies'} ({countries().length}): </span>
					<span>{countries().join(', ')}</span>
				</div>
			</div>
		{/if}

		<!-- Source newspapers -->
		{#if newspapers().length > 0}
			<div class="flex items-start gap-1">
				<Newspaper class="h-3 w-3 mt-[2px] text-muted-foreground" />
				<div class="flex-1">
					<span class="font-medium text-foreground">Source newspaper{newspapers().length === 1 ? '' : 's'} ({newspapers().length}): </span>
					<span>
						{newspapers().slice(0, 2).join(', ')}
						{#if newspapers().length > 2}
							<span class="text-muted-foreground"> +{newspapers().length - 2} more</span>
						{/if}
					</span>
				</div>
			</div>
		{/if}
	</div>

	<!-- Articles list (always visible, paginated) -->
	<div class="border-t pt-2 space-y-2">
		<!-- Pagination info -->
		<div class="flex items-center justify-between text-[10px] text-muted-foreground tracking-tight">
			<span>Page {currentPage} of {totalPages()}</span>
			<span>{((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, group.count)} of {group.count}</span>
		</div>

		<!-- Articles list -->
		<div class="space-y-1 max-h-56 overflow-y-auto pr-1">
			{#each pagedItems() as item}
				<div class="border rounded p-2 text-[13px] hover:bg-accent/40 transition-colors">
					<a
						href={getArticleUrl(item.id)}
						target="_blank"
						rel="noopener noreferrer"
						class="font-medium text-blue-600 hover:text-blue-800 transition-colors block mb-0.5"
					>
						{item.title}
						<ExternalLink class="h-3 w-3 inline ml-1" />
					</a>
					<div class="text-[11px] text-muted-foreground flex flex-wrap gap-x-1">
						{formatDate(item.publishDate)} • {item.articleCountry} • {item.newspaperSource}
					</div>
				</div>
			{/each}
		</div>

		<!-- Pagination controls -->
		{#if totalPages() > 1}
			<div class="flex items-center justify-between pt-1">
				<Button
					variant="outline"
					size="sm"
					onclick={() => currentPage = Math.max(1, currentPage - 1)}
					disabled={currentPage === 1}
					class="text-[11px] h-7"
				>
					<ChevronLeft class="h-3 w-3 mr-1" /> Previous
				</Button>
				<div class="flex items-center gap-1 text-[11px] text-muted-foreground">
					<label for="page-input" class="sr-only">Current page</label>
					<input
						id="page-input"
						type="number"
						min="1"
						max={totalPages()}
						value={currentPage}
						class="w-10 h-7 px-1 border rounded text-center bg-background text-foreground focus:outline-none focus:ring focus:ring-primary/40"
						oninput={(e: any) => {
							const v = parseInt(e.currentTarget.value, 10);
							if (!isNaN(v)) {
								currentPage = Math.min(totalPages(), Math.max(1, v));
							}
						}}
						onkeydown={(e: KeyboardEvent) => {
							if (e.key === 'Enter') {
								(e.currentTarget as HTMLInputElement).blur();
							}
						}}
					/>
					<span class="select-none">/ {totalPages()}</span>
				</div>
				<Button
					variant="outline"
					size="sm"
					onclick={() => currentPage = Math.min(totalPages(), currentPage + 1)}
					disabled={currentPage === totalPages()}
					class="text-[11px] h-7"
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

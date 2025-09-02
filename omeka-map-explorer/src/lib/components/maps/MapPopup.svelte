<script lang="ts">
	import type { ProcessedItem } from '$lib/types';
	import { ExternalLink, Calendar, MapPin, Newspaper, Users, ChevronLeft, ChevronRight } from 'lucide-svelte';
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

	// Items to display (either just sample or all items)
	const displayItems = $derived(() => {
		if (!group.items || group.items.length === 0) return [group.sample];
		
		if (showAllItems) {
			// Show a page of items (10 per page)
			const startIndex = (currentPage - 1) * itemsPerPage;
			const endIndex = startIndex + itemsPerPage;
			return group.items.slice(startIndex, endIndex);
		}
		
		return [group.sample];
	});

	let showAllItems = $state(false);
	let currentPage = $state(1);
	const itemsPerPage = 10;
	const totalPages = $derived(() => Math.ceil((group.items?.length || 1) / itemsPerPage));
</script>

<div class="map-popup min-w-80 max-w-96 p-3">
	<!-- Main title with place name -->
	<div class="border-b pb-3 mb-3">
		<h3 class="font-semibold text-base text-foreground mb-2 flex items-center gap-2">
			<MapPin class="h-4 w-4 text-primary" />
			{displayPlaceName()}
		</h3>
		
		<div class="flex items-start justify-between gap-2 mb-2">
			<div class="flex items-center gap-2">
				<Users class="h-4 w-4 text-muted-foreground" />
				<span class="font-semibold text-sm">
					{group.count} {group.count === 1 ? 'Article' : 'Articles'}
				</span>
			</div>
			<div class="text-xs text-muted-foreground">
				{group.lat.toFixed(4)}, {group.lng.toFixed(4)}
			</div>
		</div>

		<!-- Additional place names -->
		{#if placeNames().length > 1}
			<div class="flex items-start gap-2 mb-2">
				<MapPin class="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
				<div class="text-xs text-muted-foreground">
					<span class="font-medium">Other places:</span>
					{placeNames().slice(1, 4).join(', ')}
					{#if placeNames().length > 4}
						<span class="opacity-70">+{placeNames().length - 4} more</span>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Countries and newspapers summary -->
		<div class="grid grid-cols-1 gap-1">
			{#if countries().length > 0}
				<div class="text-xs text-muted-foreground">
					<span class="font-medium">Countries:</span> {countries().join(', ')}
				</div>
			{/if}
			{#if newspapers().length > 0}
				<div class="text-xs text-muted-foreground">
					<span class="font-medium">Newspapers:</span> 
					{newspapers().slice(0, 2).join(', ')}
					{#if newspapers().length > 2}
						<span class="opacity-70">+{newspapers().length - 2} more</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Articles list -->
	<div class="space-y-2">
		{#each displayItems() as item}
			<div class="rounded border p-2 hover:bg-muted/30 transition-colors">
				<!-- Article title with external link -->
				<div class="mb-2">
					<a
						href={getArticleUrl(item.id)}
						target="_blank"
						rel="noopener noreferrer"
						class="text-sm font-medium hover:text-primary transition-colors flex items-start gap-1.5 leading-tight"
					>
						<span class="overflow-hidden text-ellipsis" 
							style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
							{item.title}
						</span>
						<ExternalLink class="h-3 w-3 mt-0.5 flex-shrink-0 opacity-60" />
					</a>
				</div>

				<!-- Article metadata -->
				<div class="flex flex-wrap gap-3 text-xs text-muted-foreground">
					{#if item.publishDate}
						<div class="flex items-center gap-1">
							<Calendar class="h-2.5 w-2.5" />
							<span>{formatDate(item.publishDate)}</span>
						</div>
					{/if}
					
					{#if item.articleCountry}
						<div class="flex items-center gap-1">
							<MapPin class="h-2.5 w-2.5" />
							<span>{item.articleCountry}</span>
						</div>
					{/if}
					
					{#if item.newspaperSource}
						<div class="flex items-center gap-1">
							<Newspaper class="h-2.5 w-2.5" />
							<span class="truncate">{item.newspaperSource}</span>
						</div>
					{/if}
				</div>
			</div>
		{/each}

		<!-- Show all/pagination for multiple items -->
		{#if group.count > 1 && group.items && group.items.length > 1}
			<div class="pt-3 border-t space-y-2">
				{#if !showAllItems}
					<Button
						variant="ghost"
						size="sm"
						onclick={() => { showAllItems = true; currentPage = 1; }}
						class="w-full text-xs"
					>
						Browse all {group.count} articles
					</Button>
				{:else}
					<!-- Pagination info -->
					<div class="flex items-center justify-between text-xs text-muted-foreground">
						<span>
							Page {currentPage} of {totalPages()}
						</span>
						<span>
							{((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, group.count)} of {group.count}
						</span>
					</div>
					
					<!-- Pagination controls -->
					<div class="flex items-center justify-between">
						<Button
							variant="outline"
							size="sm"
							onclick={() => currentPage = Math.max(1, currentPage - 1)}
							disabled={currentPage === 1}
							class="text-xs"
						>
							<ChevronLeft class="h-3 w-3 mr-1" />
							Previous
						</Button>
						
						<div class="flex items-center gap-1">
							{#if totalPages() <= 5}
								<!-- Show all pages if 5 or fewer -->
								{#each Array.from({ length: totalPages() }, (_, i) => i + 1) as page}
									<Button
										variant={currentPage === page ? "default" : "outline"}
										size="sm"
										onclick={() => currentPage = page}
										class="w-6 h-6 p-0 text-xs"
									>
										{page}
									</Button>
								{/each}
							{:else}
								<!-- Condensed pagination -->
								<Button
									variant={currentPage === 1 ? "default" : "outline"}
									size="sm"
									onclick={() => currentPage = 1}
									class="w-6 h-6 p-0 text-xs"
								>
									1
								</Button>
								
								{#if currentPage > 3}
									<span class="text-xs text-muted-foreground">…</span>
								{/if}
								
								{#if currentPage > 2 && currentPage < totalPages() - 1}
									<Button
										variant="default"
										size="sm"
										class="w-6 h-6 p-0 text-xs"
									>
										{currentPage}
									</Button>
								{/if}
								
								{#if currentPage < totalPages() - 2}
									<span class="text-xs text-muted-foreground">…</span>
								{/if}
								
								{#if totalPages() > 1}
									<Button
										variant={currentPage === totalPages() ? "default" : "outline"}
										size="sm"
										onclick={() => currentPage = totalPages()}
										class="w-6 h-6 p-0 text-xs"
									>
										{totalPages()}
									</Button>
								{/if}
							{/if}
						</div>
						
						<Button
							variant="outline"
							size="sm"
							onclick={() => currentPage = Math.min(totalPages(), currentPage + 1)}
							disabled={currentPage === totalPages()}
							class="text-xs"
						>
							Next
							<ChevronRight class="h-3 w-3 ml-1" />
						</Button>
					</div>
					
					<!-- Back to single view -->
					<Button
						variant="ghost"
						size="sm"
						onclick={() => { showAllItems = false; currentPage = 1; }}
						class="w-full text-xs"
					>
						Show single article
					</Button>
				{/if}
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

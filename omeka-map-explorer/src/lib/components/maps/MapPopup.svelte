<script lang="ts">
	import type { ProcessedItem } from '$lib/types';
	import { ExternalLink, Calendar, MapPin, Newspaper, Users } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';

	interface LocationGroup {
		lat: number;
		lng: number;
		count: number;
		sample: ProcessedItem;
		items: ProcessedItem[];
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
		return showAllItems ? group.items : [group.sample];
	});

	let showAllItems = $state(false);
</script>

<div class="map-popup min-w-80 max-w-96 p-3">
	<!-- Header with location info -->
	<div class="border-b pb-3 mb-3">
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

		<!-- Place names -->
		{#if placeNames().length > 0}
			<div class="flex items-start gap-2 mb-2">
				<MapPin class="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
				<div class="text-xs text-muted-foreground">
					<span class="font-medium">Places:</span>
					{placeNames().slice(0, 3).join(', ')}
					{#if placeNames().length > 3}
						<span class="opacity-70">+{placeNames().length - 3} more</span>
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

		<!-- Show all/less toggle for multiple items -->
		{#if group.count > 1 && group.items && group.items.length > 1}
			<div class="pt-2 border-t">
				{#if !showAllItems}
					<Button
						variant="ghost"
						size="sm"
						onclick={() => showAllItems = true}
						class="w-full text-xs"
					>
						Show all {group.count} articles
					</Button>
				{:else}
					<Button
						variant="ghost"
						size="sm"
						onclick={() => showAllItems = false}
						class="w-full text-xs"
					>
						Show less
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

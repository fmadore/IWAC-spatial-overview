<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { filters } from '$lib/state/filters.svelte';
	import { mapData } from '$lib/state/mapData.svelte';

	// Count unique articles by ID (since same article can have multiple coordinates)
	const totalUniqueArticles = $derived.by(() => {
		const uniqueArticleIds = new Set(
			mapData.allItems.map(item => {
				// Extract article ID from processed item ID (format: "articleId-coordinateIndex")
				return item.id.split('-')[0];
			})
		);
		return uniqueArticleIds.size;
	});
	const totalCountries = $derived.by(() => filters.available.countries.length);
	const dateRangeLabel = $derived.by(() => {
		const { min, max } = filters.available.dateRange;
		return `${min.getFullYear()} – ${max.getFullYear()}`;
	});
</script>

<div class="grid gap-4 px-4 lg:px-6 md:grid-cols-3">
	<Card>
		<CardHeader class="pb-2">
			<CardTitle class="text-sm">Articles</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="text-3xl font-bold">{totalUniqueArticles}</div>
			<p class="text-xs text-muted-foreground mt-1">Unique articles in dataset</p>
		</CardContent>
	</Card>

	<Card>
		<CardHeader class="pb-2">
			<CardTitle class="text-sm">Countries</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="text-3xl font-bold">{totalCountries}</div>
			<p class="text-xs text-muted-foreground mt-1">Available in dataset</p>
		</CardContent>
	</Card>

	<Card>
		<CardHeader class="pb-2">
			<CardTitle class="text-sm">Time span</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="text-3xl font-bold">{dateRangeLabel}</div>
			<p class="text-xs text-muted-foreground mt-1">Publication years</p>
		</CardContent>
	</Card>
</div>

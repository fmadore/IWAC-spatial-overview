<script lang="ts">
	import type { ProcessedItem } from '$lib/types';
	import { appState } from '$lib/state/appState.svelte';
	import { mapData } from '$lib/state/mapData.svelte';
	import { getVisibleData } from '$lib/state/derived.svelte';
	import EntitySelector from './entity-selector.svelte';
	import EntityStatsCards from './entity-stats-cards.svelte';
	import EntityLocationsWordcloud from './entity-locations-wordcloud.svelte';
	import EntityArticlesTable from './entity-articles-table.svelte';
	import EntityMap from './EntityMap.svelte';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';

	type Entity = {
		id: string;
		name: string;
		relatedArticleIds: string[];
		articleCount: number;
	};

	interface Props {
		entities: Entity[];
		entityType: string; // e.g., 'Personnes', 'Organisations'
		entityTypeSingular?: string; // e.g., 'person', 'organization'
		mapTitle?: string;
		noSelectionTitle?: string;
		noSelectionDescription?: string;
	}

	let {
		entities,
		entityType,
		entityTypeSingular,
		mapTitle,
		noSelectionTitle,
		noSelectionDescription
	}: Props = $props();

	const visibleData = $derived.by(() => getVisibleData());
	const selectedEntity = $derived.by(() => appState.selectedEntity);

	// Force bubble mode for entity visualizations (choropleth not semantically correct here)
	$effect(() => {
		if (appState.selectedEntity && mapData.viewMode === 'choropleth') {
			mapData.viewMode = 'bubbles';
		}
	});

	// Check if the selected entity matches our entity type
	const isSelectedEntityOfType = $derived.by(
		() => selectedEntity && selectedEntity.type === entityType
	);

	// Get unique articles (one per article ID, not per coordinate)
	const uniqueArticles = $derived.by(() => {
		if (!isSelectedEntityOfType) return [];

		const seen = new Set<string>();
		const unique: ProcessedItem[] = [];

		for (const item of visibleData) {
			const articleId = item.id.split('-')[0];
			if (!seen.has(articleId)) {
				seen.add(articleId);
				unique.push(item);
			}
		}

		return unique;
	});

	// Get locations from selected entity's articles
	const selectedEntityLocations = $derived.by(() => {
		if (!isSelectedEntityOfType || !selectedEntity) return [];

		// Get all spatial locations mentioned in the selected entity's related articles only
		const locations: string[] = [];
		const entityArticleIds = new Set(selectedEntity.relatedArticleIds);

		for (const item of visibleData) {
			// Only process articles that are related to this entity
			const articleId = item.id.split('-')[0];
			if (entityArticleIds.has(articleId)) {
				// Add all spatial locations from the article
				for (const location of item.spatial) {
					locations.push(location);
				}
				// Also add the article's country
				if (item.country) {
					locations.push(item.country);
				}
			}
		}

		return locations; // Return array with duplicates so word cloud can count them
	});

	// Statistics for the selected entity
	const entityStats = $derived.by(() => {
		if (!isSelectedEntityOfType) return null;

		// Use unique articles count
		const articleCount = uniqueArticles.length;

		const countries = new Set(visibleData.map((item) => item.country));
		const newspapers = new Set(visibleData.map((item) => item.newspaperSource));
		const dateRange = visibleData.reduce(
			(range, item) => {
				if (!item.publishDate) return range;
				if (!range.min || item.publishDate < range.min) range.min = item.publishDate;
				if (!range.max || item.publishDate > range.max) range.max = item.publishDate;
				return range;
			},
			{ min: null as Date | null, max: null as Date | null }
		);

		return {
			articleCount,
			countryCount: countries.size,
			newspaperCount: newspapers.size,
			dateRange
		};
	});

	// Default values for display text
	const displayMapTitle = $derived.by(
		() =>
			mapTitle ||
			(selectedEntity ? `Locations associated with ${selectedEntity.name}` : 'Entity Locations')
	);

	const displayNoSelectionTitle = $derived.by(
		() => noSelectionTitle || `Select ${entityTypeSingular || entityType}`
	);

	const displayNoSelectionDescription = $derived.by(
		() =>
			noSelectionDescription ||
			`Choose ${entityTypeSingular ? 'a ' + entityTypeSingular : 'an entity'} from the dropdown above to explore their associated locations and articles.`
	);
</script>

<div class="flex h-full flex-col gap-6 p-4 lg:p-6">
	<!-- Entity Selection -->
	<div class="w-full max-w-md">
		<EntitySelector
			{entities}
			{entityType}
			{entityTypeSingular}
			selectedEntityId={isSelectedEntityOfType ? selectedEntity?.id || null : null}
		/>
	</div>

	{#if isSelectedEntityOfType && selectedEntity}
		<!-- Statistics Cards -->
		<EntityStatsCards stats={entityStats} entityName={selectedEntity.name} {entityType} />

		<!-- Map showing locations -->
		<div class="flex-1">
			<Card class="h-full">
				<CardHeader>
					<CardTitle>{displayMapTitle}</CardTitle>
				</CardHeader>
				<CardContent class="h-full p-0">
					<EntityMap items={visibleData} height="500px" />
				</CardContent>
			</Card>
		</div>

		<!-- Locations Word Cloud -->
		<EntityLocationsWordcloud locations={selectedEntityLocations} entityName={selectedEntity.name} />

		<!-- Articles Table -->
		<EntityArticlesTable articles={uniqueArticles} entityName={selectedEntity.name} />
	{:else}
		<!-- No entity selected state -->
		<div class="flex flex-1 items-center justify-center">
			<div class="text-center text-muted-foreground">
				<h3 class="text-lg font-medium">{displayNoSelectionTitle}</h3>
				<p class="text-sm">{displayNoSelectionDescription}</p>
			</div>
		</div>
	{/if}
</div>

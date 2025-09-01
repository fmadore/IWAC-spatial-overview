<script lang="ts">
	import { mapData } from '$lib/state/mapData.svelte';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { appState } from '$lib/state/appState.svelte';
	import { urlManager } from '$lib/utils/urlManager.svelte';

	// Get top entities from each category with comprehensive safety checks
	const topPersons = $derived.by(() => {
		try {
			if (!mapData?.persons || !Array.isArray(mapData.persons) || mapData.persons.length === 0) {
				return [];
			}
			// Create a copy to avoid mutating the original array
			return [...mapData.persons]
				.sort((a, b) => {
					const aCount = a?.articleCount || 0;
					const bCount = b?.articleCount || 0;
					return bCount - aCount;
				})
				.slice(0, 5);
		} catch (error) {
			console.error('Error computing topPersons:', error);
			return [];
		}
	});

	const topOrganizations = $derived.by(() => {
		try {
			if (!mapData?.organizations || !Array.isArray(mapData.organizations) || mapData.organizations.length === 0) {
				return [];
			}
			// Create a copy to avoid mutating the original array
			return [...mapData.organizations]
				.sort((a, b) => {
					const aCount = a?.articleCount || 0;
					const bCount = b?.articleCount || 0;
					return bCount - aCount;
				})
				.slice(0, 5);
		} catch (error) {
			console.error('Error computing topOrganizations:', error);
			return [];
		}
	});

	const topEvents = $derived.by(() => {
		try {
			if (!mapData?.events || !Array.isArray(mapData.events) || mapData.events.length === 0) {
				return [];
			}
			// Create a copy to avoid mutating the original array
			return [...mapData.events]
				.sort((a, b) => {
					const aCount = a?.articleCount || 0;
					const bCount = b?.articleCount || 0;
					return bCount - aCount;
				})
				.slice(0, 5);
		} catch (error) {
			console.error('Error computing topEvents:', error);
			return [];
		}
	});

	const topSubjects = $derived.by(() => {
		try {
			if (!mapData?.subjects || !Array.isArray(mapData.subjects) || mapData.subjects.length === 0) {
				return [];
			}
			// Create a copy to avoid mutating the original array
			return [...mapData.subjects]
				.sort((a, b) => {
					const aCount = a?.articleCount || 0;
					const bCount = b?.articleCount || 0;
					return bCount - aCount;
				})
				.slice(0, 5);
		} catch (error) {
			console.error('Error computing topSubjects:', error);
			return [];
		}
	});

	function navigateToEntity(type: 'persons' | 'organizations' | 'events' | 'subjects', entity: any) {
		// Set the entity selection
		appState.selectedEntity = {
			type: type === 'persons' ? 'Personnes' : 
			      type === 'organizations' ? 'Organisations' :
			      type === 'events' ? 'Événements' : 'Sujets',
			id: entity.id,
			name: entity.name,
			relatedArticleIds: entity.relatedArticleIds
		};
		
		// Navigate to the corresponding visualization
		appState.activeView = 'dashboard';
		appState.activeVisualization = type;
		urlManager.updateUrl();
	}
</script>

<div class="grid gap-4 px-4 lg:px-6 md:grid-cols-2 lg:grid-cols-4">
	<!-- Persons -->
	<Card>
		<CardHeader class="pb-3">
			<CardTitle class="text-sm flex items-center justify-between">
				<span>Top Persons</span>
				<span class="text-xs text-muted-foreground">{mapData.persons.length} total</span>
			</CardTitle>
		</CardHeader>
		<CardContent class="space-y-2">
			{#each topPersons as person}
				<button
					class="w-full text-left p-2 rounded-md hover:bg-muted transition-colors"
					onclick={() => navigateToEntity('persons', person)}
				>
					<div class="text-sm font-medium truncate">{person.name}</div>
					<div class="text-xs text-muted-foreground">{person.articleCount} articles</div>
				</button>
			{/each}
			{#if topPersons.length === 0}
				<div class="text-xs text-muted-foreground p-2">No persons data available</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Organizations -->
	<Card>
		<CardHeader class="pb-3">
			<CardTitle class="text-sm flex items-center justify-between">
				<span>Top Organizations</span>
				<span class="text-xs text-muted-foreground">{mapData.organizations.length} total</span>
			</CardTitle>
		</CardHeader>
		<CardContent class="space-y-2">
			{#each topOrganizations as organization}
				<button
					class="w-full text-left p-2 rounded-md hover:bg-muted transition-colors"
					onclick={() => navigateToEntity('organizations', organization)}
				>
					<div class="text-sm font-medium truncate">{organization.name}</div>
					<div class="text-xs text-muted-foreground">{organization.articleCount} articles</div>
				</button>
			{/each}
			{#if topOrganizations.length === 0}
				<div class="text-xs text-muted-foreground p-2">No organizations data available</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Events -->
	<Card>
		<CardHeader class="pb-3">
			<CardTitle class="text-sm flex items-center justify-between">
				<span>Top Events</span>
				<span class="text-xs text-muted-foreground">{mapData.events.length} total</span>
			</CardTitle>
		</CardHeader>
		<CardContent class="space-y-2">
			{#each topEvents as event}
				<button
					class="w-full text-left p-2 rounded-md hover:bg-muted transition-colors"
					onclick={() => navigateToEntity('events', event)}
				>
					<div class="text-sm font-medium truncate">{event.name}</div>
					<div class="text-xs text-muted-foreground">{event.articleCount} articles</div>
				</button>
			{/each}
			{#if topEvents.length === 0}
				<div class="text-xs text-muted-foreground p-2">No events data available</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Subjects -->
	<Card>
		<CardHeader class="pb-3">
			<CardTitle class="text-sm flex items-center justify-between">
				<span>Top Subjects</span>
				<span class="text-xs text-muted-foreground">{mapData.subjects.length} total</span>
			</CardTitle>
		</CardHeader>
		<CardContent class="space-y-2">
			{#each topSubjects as subject}
				<button
					class="w-full text-left p-2 rounded-md hover:bg-muted transition-colors"
					onclick={() => navigateToEntity('subjects', subject)}
				>
					<div class="text-sm font-medium truncate">{subject.name}</div>
					<div class="text-xs text-muted-foreground">{subject.articleCount} articles</div>
				</button>
			{/each}
			{#if topSubjects.length === 0}
				<div class="text-xs text-muted-foreground p-2">No subjects data available</div>
			{/if}
		</CardContent>
	</Card>
</div>

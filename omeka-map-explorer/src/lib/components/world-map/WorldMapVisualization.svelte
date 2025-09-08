<script lang="ts">
	import Map from '$lib/components/world-map/Map.svelte';
	import { appState } from '$lib/state/appState.svelte';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';

	// World Map specific configuration and behavior can be added here
	// while keeping the underlying Map component generic and reusable
</script>

<div class="flex h-full flex-col overflow-hidden">
	<!-- Main Map Area -->
	<div class="flex-1 relative z-0">
		<Card class="h-full border-0 rounded-none">
			<CardHeader class="pb-2">
				<CardTitle>World Map - Article Locations</CardTitle>
				<p class="text-sm text-muted-foreground">
					Explore newspaper articles by geographic location. Switch between bubble and choropleth views using the sidebar controls.
				</p>
			</CardHeader>
			<CardContent class="h-full p-0">
				<Map />
			</CardContent>
		</Card>
	</div>

	<!-- Selected Item Details -->
	{#if appState.selectedItem}
		<div class="border-t p-4 bg-background">
			<div class="bg-card rounded-lg p-4 shadow-sm">
				<h3 class="font-semibold text-lg mb-2">{appState.selectedItem.title}</h3>
				<div class="space-y-1 text-sm text-muted-foreground">
					<p><strong>Date:</strong> {appState.selectedItem.publishDate?.toLocaleDateString()}</p>
					<p><strong>Country:</strong> {appState.selectedItem.country}</p>
					<p><strong>Source:</strong> {appState.selectedItem.newspaperSource}</p>
					{#if appState.selectedItem.spatial && appState.selectedItem.spatial.length > 0}
						<p><strong>Locations:</strong> {appState.selectedItem.spatial.join(', ')}</p>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

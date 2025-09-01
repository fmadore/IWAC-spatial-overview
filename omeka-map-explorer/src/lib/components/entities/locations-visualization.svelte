<script lang="ts">
	import { mapData } from '$lib/state/mapData.svelte';
	import EntityVisualization from './entity-visualization.svelte';

	// Get locations data
	const locations = $derived.by(() => mapData.locations);
</script>

<EntityVisualization
	entities={locations}
	entityType="Lieux"
	entityTypeSingular="location"
	noSelectionTitle="Select a Location"
	noSelectionDescription="Choose a location from the dropdown above to explore its associated articles and geographic details."
/>

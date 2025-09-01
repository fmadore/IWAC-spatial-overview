<script lang="ts">
	import { mapData } from '$lib/state/mapData.svelte';
	import EntityVisualization from './entity-visualization.svelte';

	// Get events data
	const events = $derived.by(() => mapData.events);
</script>

<EntityVisualization
	entities={events}
	entityType="Événements"
	entityTypeSingular="event"
	noSelectionTitle="Select an Event"
	noSelectionDescription="Choose an event from the dropdown above to explore their associated locations and articles."
/>

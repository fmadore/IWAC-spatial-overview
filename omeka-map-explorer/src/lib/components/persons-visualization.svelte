<script lang="ts">
	import { mapData } from '$lib/state/mapData.svelte';
	import EntityVisualization from '$lib/components/entity-visualization.svelte';

	// Get persons data
	const persons = $derived.by(() => mapData.persons);
</script>

<EntityVisualization
	entities={persons}
	entityType="Personnes"
	entityTypeSingular="person"
	noSelectionTitle="Select a Person"
	noSelectionDescription="Choose a person from the dropdown above to explore their associated locations and articles."
/>

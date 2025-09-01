<script lang="ts">
	import { mapData } from '$lib/state/mapData.svelte';
	import EntityVisualization from '$lib/components/entity-visualization.svelte';

	// Get subjects data
	const subjects = $derived.by(() => mapData.subjects);
</script>

<EntityVisualization
	entities={subjects}
	entityType="Sujets"
	entityTypeSingular="subject"
	noSelectionTitle="Select a Subject"
	noSelectionDescription="Choose a subject from the dropdown above to explore their associated locations and articles."
/>

<script lang="ts">
	import { mapData } from '$lib/state/mapData.svelte';
	import EntityVisualization from './entity-visualization.svelte';

	// Get organizations data
	const organizations = $derived.by(() => mapData.organizations);
</script>

<EntityVisualization
	entities={organizations}
	entityType="Organisations"
	entityTypeSingular="organization"
	noSelectionTitle="Select an Organization"
	noSelectionDescription="Choose an organization from the dropdown above to explore their associated locations and articles."
/>

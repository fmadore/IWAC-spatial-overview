<script lang="ts">
	import { onMount } from 'svelte';
	import { timeData } from '$lib/state/timeData.svelte';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';

	let container: HTMLDivElement;
	let d3: any = null;

	onMount(async () => {
		const [{ scaleLinear, scaleTime }, { select }, { axisBottom, axisLeft }, { line }, time] =
			await Promise.all([
				import('d3-scale'),
				import('d3-selection'),
				import('d3-axis'),
				import('d3-shape'),
				import('d3-time')
			]).catch(() => [null, null, null, null, null]);
		// Placeholder: this will be replaced with a real chart later
	});
</script>

<Card>
	<CardHeader>
		<CardTitle>Timeline (placeholder)</CardTitle>
	</CardHeader>
	<CardContent>
		<div bind:this={container} class="h-56 w-full rounded-md border bg-muted/40"></div>
	</CardContent>
</Card>

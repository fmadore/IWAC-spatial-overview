<script lang="ts">
	import type { ProcessedItem } from '$lib/types';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';

	interface Props {
		locations: string[];
		entityName: string;
	}

	let { locations, entityName }: Props = $props();
</script>

{#if locations.length > 0}
	<Card>
		<CardHeader>
			<CardTitle>Mentioned Locations ({locations.length})</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="flex flex-wrap gap-2">
				{#each locations as location}
					<span
						class="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
					>
						{location}
					</span>
				{/each}
			</div>
		</CardContent>
	</Card>
{/if}

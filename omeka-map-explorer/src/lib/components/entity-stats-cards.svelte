<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';

	interface EntityStats {
		articleCount: number;
		countryCount: number;
		newspaperCount: number;
		dateRange: { min: Date | null; max: Date | null } | null;
	}

	interface Props {
		stats: EntityStats | null;
		entityName: string;
		entityType: string; // 'person', 'organization', etc. for display
	}

	let { stats, entityName, entityType }: Props = $props();

	const formatEntityType = $derived.by(() => {
		const typeMap: Record<string, string> = {
			Personnes: 'person',
			Organisations: 'organization',
			Événements: 'event',
			Sujets: 'subject'
		};
		return typeMap[entityType] || entityType.toLowerCase();
	});
</script>

<div class="grid gap-4 md:grid-cols-4">
	<Card>
		<CardHeader class="pb-2">
			<CardTitle class="text-sm">Articles</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="text-2xl font-bold">{stats?.articleCount || 0}</div>
			<p class="text-xs text-muted-foreground">mentioning {entityName}</p>
		</CardContent>
	</Card>

	<Card>
		<CardHeader class="pb-2">
			<CardTitle class="text-sm">Countries</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="text-2xl font-bold">{stats?.countryCount || 0}</div>
			<p class="text-xs text-muted-foreground">locations mentioned</p>
		</CardContent>
	</Card>

	<Card>
		<CardHeader class="pb-2">
			<CardTitle class="text-sm">Newspapers</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="text-2xl font-bold">{stats?.newspaperCount || 0}</div>
			<p class="text-xs text-muted-foreground">different sources</p>
		</CardContent>
	</Card>

	<Card>
		<CardHeader class="pb-2">
			<CardTitle class="text-sm">Time Period</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="text-2xl font-bold">
				{#if stats?.dateRange?.min && stats?.dateRange?.max}
					{stats.dateRange.min.getFullYear()}–{stats.dateRange.max.getFullYear()}
				{:else}
					N/A
				{/if}
			</div>
			<p class="text-xs text-muted-foreground">publication range</p>
		</CardContent>
	</Card>
</div>

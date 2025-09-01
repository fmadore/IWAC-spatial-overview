<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Command from '$lib/components/ui/command';
	import * as Popover from '$lib/components/ui/popover';
	import { Check, ChevronsUpDown } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { appState } from '$lib/state/appState.svelte';
	import { urlManager } from '$lib/utils/urlManager.svelte';

	type Entity = {
		id: string;
		name: string;
		relatedArticleIds: string[];
		articleCount: number;
	};

	interface Props {
		entities?: Entity[];
		selectedEntityId?: string | null;
		entityType: string; // e.g., 'Personnes', 'Organisations'
		entityTypeSingular?: string; // e.g., 'person', 'organization' for display
		placeholder?: string;
	}

	let {
		entities = [],
		selectedEntityId = null,
		entityType,
		entityTypeSingular,
		placeholder
	}: Props = $props();

	let open = $state(false);
	let searchValue = $state('');

	const selectedEntity = $derived.by(() => entities.find((e) => e.id === selectedEntityId));

	const filteredEntities = $derived.by(() => {
		if (!searchValue) return entities;
		return entities.filter((entity) =>
			entity.name.toLowerCase().includes(searchValue.toLowerCase())
		);
	});

	const displayType = $derived.by(() => {
		if (entityTypeSingular) return entityTypeSingular;

		// Default fallbacks based on entityType
		const typeMap: Record<string, string> = {
			Personnes: 'person',
			Organisations: 'organization',
			Événements: 'event',
			Sujets: 'subject'
		};
		return typeMap[entityType] || 'entity';
	});

	const defaultPlaceholder = $derived.by(() => placeholder || `Select ${displayType}...`);

	function selectEntity(entity: Entity) {
		selectedEntityId = entity.id;
		open = false;
		searchValue = '';

		// Update app state with selected entity
		appState.selectedEntity = {
			type: entityType,
			id: entity.id,
			name: entity.name,
			relatedArticleIds: entity.relatedArticleIds
		};

		// Update URL to reflect the selection
		urlManager.updateUrl();
	}

	function clearSelection() {
		selectedEntityId = null;
		appState.selectedEntity = null;
		
		// Update URL to reflect the cleared selection
		urlManager.updateUrl();
	}
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center justify-between">
		<span class="text-sm font-medium"
			>Select {displayType.charAt(0).toUpperCase() + displayType.slice(1)}</span
		>
		{#if selectedEntityId}
			<Button
				variant="ghost"
				size="sm"
				onclick={clearSelection}
				class="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
			>
				Clear
			</Button>
		{/if}
	</div>

	<Popover.Root bind:open>
		<Popover.Trigger>
			<Button variant="outline" role="combobox" aria-expanded={open} class="w-full justify-between">
				{selectedEntity ? selectedEntity.name : defaultPlaceholder}
				<ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
			</Button>
		</Popover.Trigger>
		<Popover.Content class="w-[400px] p-0">
			<Command.Root>
				<Command.Input bind:value={searchValue} placeholder={`Search ${displayType}s...`} />
				<Command.Empty>No {displayType} found.</Command.Empty>
				<Command.Group>
					{#each filteredEntities as entity}
						<Command.Item value={entity.name} onSelect={() => selectEntity(entity)}>
							<Check
								class={cn(
									'mr-2 h-4 w-4',
									selectedEntityId === entity.id ? 'opacity-100' : 'opacity-0'
								)}
							/>
							{entity.name}
							<span class="ml-auto text-xs text-muted-foreground">
								{entity.relatedArticleIds.length} articles
							</span>
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.Root>
		</Popover.Content>
	</Popover.Root>

	{#if selectedEntity}
		<div class="text-sm text-muted-foreground">
			Showing locations from {selectedEntity.relatedArticleIds.length} related articles
		</div>
	{/if}
</div>

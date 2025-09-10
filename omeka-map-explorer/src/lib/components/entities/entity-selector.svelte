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
		onSelect?: (entity: Entity) => void;
		onClear?: () => void;
		hideSelectionHint?: boolean;
	}

	let {
		entities = [],
		selectedEntityId = null,
		entityType,
		entityTypeSingular,
		placeholder,
		onSelect,
		onClear,
		hideSelectionHint = false
	}: Props = $props();

	let open = $state(false);
	let searchValue = $state('');
	let debouncedSearchValue = $state('');
	let searchTimeoutId: number | undefined = undefined;

	// Derive selected entity from app state - this is the source of truth
	const selectedEntity = $derived.by(() => {
		const currentEntity = appState.selectedEntity;
		if (!currentEntity || currentEntity.type !== entityType) {
			return null;
		}
		return entities.find((e) => e.id === currentEntity.id) || null;
	});

	// Derive the selected ID for the check mark display
	const currentSelectedId = $derived.by(() => selectedEntity?.id || null);

	// Optimized filtering with debounced search and early returns
	const filteredEntities = $derived.by(() => {
		// Return early if no search term
		if (!debouncedSearchValue) return entities;
		
		const searchLower = debouncedSearchValue.toLowerCase();
		const results: Entity[] = [];
		
		// Optimized filtering: exact matches first, then includes matches
		for (const entity of entities) {
			const nameLower = entity.name.toLowerCase();
			if (nameLower === searchLower) {
				// Exact match - put at beginning
				results.unshift(entity);
			} else if (nameLower.includes(searchLower)) {
				// Partial match - add to end
				results.push(entity);
			}
		}
		
		return results;
	});

	// Cleanup timeout on component unmount
	$effect(() => {
		return () => {
			if (searchTimeoutId) {
				clearTimeout(searchTimeoutId);
			}
		};
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
		// Always update app state directly - don't rely on prop mutation
		appState.selectedEntity = {
			type: entityType,
			id: entity.id,
			name: entity.name,
			relatedArticleIds: entity.relatedArticleIds
		};
		urlManager.updateUrl();
		
		// Close dropdown and clear search
		open = false;
		searchValue = '';
		debouncedSearchValue = '';

		// Call optional callback if provided
		if (onSelect) {
			onSelect(entity);
		}
	}

	function clearSelection() {
		// Always update app state directly
		appState.selectedEntity = null;
		urlManager.updateUrl({ immediate: true });
		
		// Clear local state
		searchValue = '';
		debouncedSearchValue = '';
		open = false;
		
		// Call optional callback if provided
		if (onClear) {
			onClear();
		}
	}

	// Debounce search input for better performance
	function handleSearchInput(value: string) {
		searchValue = value;
		
		if (searchTimeoutId) {
			clearTimeout(searchTimeoutId);
		}
		
		searchTimeoutId = setTimeout(() => {
			debouncedSearchValue = value;
		}, 150);
	}
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center justify-between">
		<span class="text-sm font-medium"
			>Select {displayType.charAt(0).toUpperCase() + displayType.slice(1)}</span
		>
		{#if currentSelectedId}
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
				<Command.Input 
					oninput={(e) => handleSearchInput(e.currentTarget.value)}
					placeholder={`Search ${displayType}s...`} 
				/>
				<Command.List>
					{#if filteredEntities.length === 0}
						<div class="p-4 text-sm text-muted-foreground">No {displayType} found.</div>
					{:else}
						<Command.Group>
							{#each filteredEntities as entity (entity.id)}
								<Command.Item value={entity.name} onSelect={() => selectEntity(entity)}>
									<Check
										class={cn(
											'mr-2 h-4 w-4',
											currentSelectedId === entity.id ? 'opacity-100' : 'opacity-0'
										)}
									/>
									{entity.name}
									<span class="ml-auto text-xs text-muted-foreground">
										{entity.articleCount ?? entity.relatedArticleIds.length} articles
									</span>
								</Command.Item>
							{/each}
						</Command.Group>
					{/if}
				</Command.List>
			</Command.Root>
		</Popover.Content>
	</Popover.Root>

	{#if selectedEntity && !hideSelectionHint}
		<div class="text-sm text-muted-foreground">
			Showing locations from {selectedEntity.relatedArticleIds.length} related articles
		</div>
	{/if}
</div>

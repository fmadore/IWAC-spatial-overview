<script lang="ts">
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { mapData } from '$lib/state/mapData.svelte';
  import { appState } from '$lib/state/appState.svelte';
  import { urlManager } from '$lib/utils/urlManager.svelte';

  // Helper to get top N by articleCount safely
  function topN<T extends { articleCount?: number }>(arr: T[] | undefined, n = 5): T[] {
    if (!Array.isArray(arr) || arr.length === 0) return [];
    return [...arr].sort((a, b) => (b?.articleCount || 0) - (a?.articleCount || 0)).slice(0, n);
  }

  const topPersons = $derived.by(() => topN(mapData.persons, 5));
  const topOrganizations = $derived.by(() => topN(mapData.organizations, 5));
  const topEvents = $derived.by(() => topN(mapData.events, 5));
  const topSubjects = $derived.by(() => topN(mapData.subjects, 5));

  type Kind = 'persons' | 'organizations' | 'events' | 'subjects';
  const typeMap: Record<Kind, string> = {
    persons: 'Personnes',
    organizations: 'Organisations',
    events: 'Événements',
    subjects: 'Sujets'
  };

  function navigateToEntity(kind: Kind, entity: any) {
    const typeLabel = typeMap[kind];
    appState.selectedEntity = {
      type: typeLabel,
      id: entity.id,
      name: entity.name,
      relatedArticleIds: entity.relatedArticleIds
    };
    appState.activeView = 'dashboard';
    appState.activeVisualization = kind;
    urlManager.navigateTo('dashboard', kind, { type: typeLabel, id: entity.id });
  }
</script>

<div class="grid gap-4 px-4 lg:px-6 md:grid-cols-2 lg:grid-cols-4">
  <!-- Persons -->
  <Card>
    <CardHeader class="pb-3">
      <CardTitle class="text-sm flex items-center justify-between">
        <span>Top Persons</span>
        <span class="text-xs text-muted-foreground">{mapData.persons?.length ?? 0} total</span>
      </CardTitle>
    </CardHeader>
    <CardContent class="space-y-2">
      {#each topPersons as person}
        <button class="w-full text-left rounded-md hover:bg-muted px-2 py-1.5" on:click={() => navigateToEntity('persons', person)}>
          <div class="flex items-center justify-between gap-2">
            <span class="truncate">{person.name}</span>
            <span class="text-xs text-muted-foreground">{person.articleCount}</span>
          </div>
        </button>
      {/each}
      {#if topPersons.length === 0}
        <div class="text-xs text-muted-foreground p-2">No persons data available</div>
      {/if}
    </CardContent>
  </Card>

  <!-- Organizations -->
  <Card>
    <CardHeader class="pb-3">
      <CardTitle class="text-sm flex items-center justify-between">
        <span>Top Organizations</span>
        <span class="text-xs text-muted-foreground">{mapData.organizations?.length ?? 0} total</span>
      </CardTitle>
    </CardHeader>
    <CardContent class="space-y-2">
      {#each topOrganizations as organization}
        <button class="w-full text-left rounded-md hover:bg-muted px-2 py-1.5" on:click={() => navigateToEntity('organizations', organization)}>
          <div class="flex items-center justify-between gap-2">
            <span class="truncate">{organization.name}</span>
            <span class="text-xs text-muted-foreground">{organization.articleCount}</span>
          </div>
        </button>
      {/each}
      {#if topOrganizations.length === 0}
        <div class="text-xs text-muted-foreground p-2">No organizations data available</div>
      {/if}
    </CardContent>
  </Card>

  <!-- Events -->
  <Card>
    <CardHeader class="pb-3">
      <CardTitle class="text-sm flex items-center justify-between">
        <span>Top Events</span>
        <span class="text-xs text-muted-foreground">{mapData.events?.length ?? 0} total</span>
      </CardTitle>
    </CardHeader>
    <CardContent class="space-y-2">
      {#each topEvents as event}
        <button class="w-full text-left rounded-md hover:bg-muted px-2 py-1.5" on:click={() => navigateToEntity('events', event)}>
          <div class="flex items-center justify-between gap-2">
            <span class="truncate">{event.name}</span>
            <span class="text-xs text-muted-foreground">{event.articleCount}</span>
          </div>
        </button>
      {/each}
      {#if topEvents.length === 0}
        <div class="text-xs text-muted-foreground p-2">No events data available</div>
      {/if}
    </CardContent>
  </Card>

  <!-- Subjects -->
  <Card>
    <CardHeader class="pb-3">
      <CardTitle class="text-sm flex items-center justify-between">
        <span>Top Subjects</span>
        <span class="text-xs text-muted-foreground">{mapData.subjects?.length ?? 0} total</span>
      </CardTitle>
    </CardHeader>
    <CardContent class="space-y-2">
      {#each topSubjects as subject}
        <button class="w-full text-left rounded-md hover:bg-muted px-2 py-1.5" on:click={() => navigateToEntity('subjects', subject)}>
          <div class="flex items-center justify-between gap-2">
            <span class="truncate">{subject.name}</span>
            <span class="text-xs text-muted-foreground">{subject.articleCount}</span>
          </div>
        </button>
      {/each}
      {#if topSubjects.length === 0}
        <div class="text-xs text-muted-foreground p-2">No subjects data available</div>
      {/if}
    </CardContent>
  </Card>
</div>

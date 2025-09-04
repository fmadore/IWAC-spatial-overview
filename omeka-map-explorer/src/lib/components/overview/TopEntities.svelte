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

  // Locale-aware formatter for consistency with KpiCards
  const nf = new Intl.NumberFormat('fr-FR');

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

  function formatCount(count: number | undefined): string {
    return nf.format(count || 0);
  }

  function truncateName(name: string, maxLength = 22): string {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 3) + '...';
  }
</script>

<div class="grid gap-4 px-4 lg:px-6 md:grid-cols-2 lg:grid-cols-4">
  <!-- Persons -->
  <Card>
    <CardHeader class="pb-2">
      <CardTitle class="text-sm flex items-center justify-between">
        Top Persons
        <span class="text-xs text-muted-foreground font-normal">{formatCount(mapData.persons?.length || 0)} total</span>
      </CardTitle>
    </CardHeader>
    <CardContent class="space-y-1">
      {#each topPersons as person}
        <button
          class="flex items-center justify-between w-full px-2 py-1 text-xs rounded hover:bg-muted transition-colors text-left group"
          onclick={() => navigateToEntity('persons', person)}
          title={person.name}
        >
          <span class="truncate">{truncateName(person.name)}</span>
          <span class="text-muted-foreground ml-2 flex-shrink-0 text-xs">{formatCount(person.articleCount)}</span>
        </button>
      {/each}
      {#if topPersons.length === 0}
        <div class="text-xs text-muted-foreground p-2 text-center">No persons data</div>
      {/if}
    </CardContent>
  </Card>

  <!-- Organizations -->
  <Card>
    <CardHeader class="pb-2">
      <CardTitle class="text-sm flex items-center justify-between">
        Top Organizations
        <span class="text-xs text-muted-foreground font-normal">{formatCount(mapData.organizations?.length || 0)} total</span>
      </CardTitle>
    </CardHeader>
    <CardContent class="space-y-1">
      {#each topOrganizations as organization}
        <button
          class="flex items-center justify-between w-full px-2 py-1 text-xs rounded hover:bg-muted transition-colors text-left group"
          onclick={() => navigateToEntity('organizations', organization)}
          title={organization.name}
        >
          <span class="truncate">{truncateName(organization.name)}</span>
          <span class="text-muted-foreground ml-2 flex-shrink-0 text-xs">{formatCount(organization.articleCount)}</span>
        </button>
      {/each}
      {#if topOrganizations.length === 0}
        <div class="text-xs text-muted-foreground p-2 text-center">No organizations data</div>
      {/if}
    </CardContent>
  </Card>

  <!-- Events -->
  <Card>
    <CardHeader class="pb-2">
      <CardTitle class="text-sm flex items-center justify-between">
        Top Events
        <span class="text-xs text-muted-foreground font-normal">{formatCount(mapData.events?.length || 0)} total</span>
      </CardTitle>
    </CardHeader>
    <CardContent class="space-y-1">
      {#each topEvents as event}
        <button
          class="flex items-center justify-between w-full px-2 py-1 text-xs rounded hover:bg-muted transition-colors text-left group"
          onclick={() => navigateToEntity('events', event)}
          title={event.name}
        >
          <span class="truncate">{truncateName(event.name)}</span>
          <span class="text-muted-foreground ml-2 flex-shrink-0 text-xs">{formatCount(event.articleCount)}</span>
        </button>
      {/each}
      {#if topEvents.length === 0}
        <div class="text-xs text-muted-foreground p-2 text-center">No events data</div>
      {/if}
    </CardContent>
  </Card>

  <!-- Subjects -->
  <Card>
    <CardHeader class="pb-2">
      <CardTitle class="text-sm flex items-center justify-between">
        Top Subjects
        <span class="text-xs text-muted-foreground font-normal">{formatCount(mapData.subjects?.length || 0)} total</span>
      </CardTitle>
    </CardHeader>
    <CardContent class="space-y-1">
      {#each topSubjects as subject}
        <button
          class="flex items-center justify-between w-full px-2 py-1 text-xs rounded hover:bg-muted transition-colors text-left group"
          onclick={() => navigateToEntity('subjects', subject)}
          title={subject.name}
        >
          <span class="truncate">{truncateName(subject.name)}</span>
          <span class="text-muted-foreground ml-2 flex-shrink-0 text-xs">{formatCount(subject.articleCount)}</span>
        </button>
      {/each}
      {#if topSubjects.length === 0}
        <div class="text-xs text-muted-foreground p-2 text-center">No subjects data</div>
      {/if}
    </CardContent>
  </Card>
</div>

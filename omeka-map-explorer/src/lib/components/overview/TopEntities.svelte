<script lang="ts">
  import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { default as Button } from '$lib/components/ui/button/button.svelte';
  import { Input } from '$lib/components/ui/input';
  import { mapData } from '$lib/state/mapData.svelte';
  import { appState } from '$lib/state/appState.svelte';
  import { urlManager } from '$lib/utils/urlManager.svelte';

  // Sorted collections by articleCount desc
  const personsSorted = $derived.by(() => (mapData.persons ?? []).slice().sort((a, b) => (b?.articleCount || 0) - (a?.articleCount || 0)));
  const organizationsSorted = $derived.by(() => (mapData.organizations ?? []).slice().sort((a, b) => (b?.articleCount || 0) - (a?.articleCount || 0)));
  const eventsSorted = $derived.by(() => (mapData.events ?? []).slice().sort((a, b) => (b?.articleCount || 0) - (a?.articleCount || 0)));
  const subjectsSorted = $derived.by(() => (mapData.subjects ?? []).slice().sort((a, b) => (b?.articleCount || 0) - (a?.articleCount || 0)));

  // Pagination state per card
  const PAGE_SIZE = 6;
  let personsPage = $state(1);
  let organizationsPage = $state(1);
  let eventsPage = $state(1);
  let subjectsPage = $state(1);

  // Input mirrors for page fields
  let personsPageStr = $state('1');
  let organizationsPageStr = $state('1');
  let eventsPageStr = $state('1');
  let subjectsPageStr = $state('1');

  // Total pages and current slice per card
  const personsTotalPages = $derived.by(() => Math.max(1, Math.ceil(personsSorted.length / PAGE_SIZE)));
  const organizationsTotalPages = $derived.by(() => Math.max(1, Math.ceil(organizationsSorted.length / PAGE_SIZE)));
  const eventsTotalPages = $derived.by(() => Math.max(1, Math.ceil(eventsSorted.length / PAGE_SIZE)));
  const subjectsTotalPages = $derived.by(() => Math.max(1, Math.ceil(subjectsSorted.length / PAGE_SIZE)));

  const personsPageItems = $derived.by(() => personsSorted.slice((personsPage - 1) * PAGE_SIZE, personsPage * PAGE_SIZE));
  const organizationsPageItems = $derived.by(() => organizationsSorted.slice((organizationsPage - 1) * PAGE_SIZE, organizationsPage * PAGE_SIZE));
  const eventsPageItems = $derived.by(() => eventsSorted.slice((eventsPage - 1) * PAGE_SIZE, eventsPage * PAGE_SIZE));
  const subjectsPageItems = $derived.by(() => subjectsSorted.slice((subjectsPage - 1) * PAGE_SIZE, subjectsPage * PAGE_SIZE));

  // Clamp pages when data changes
  $effect(() => {
    if (personsPage > personsTotalPages) personsPage = 1;
    personsPageStr = String(personsPage);
  });
  $effect(() => {
    if (organizationsPage > organizationsTotalPages) organizationsPage = 1;
    organizationsPageStr = String(organizationsPage);
  });
  $effect(() => {
    if (eventsPage > eventsTotalPages) eventsPage = 1;
    eventsPageStr = String(eventsPage);
  });
  $effect(() => {
    if (subjectsPage > subjectsTotalPages) subjectsPage = 1;
    subjectsPageStr = String(subjectsPage);
  });

  function applyPageInput(raw: string, total: number): number | null {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || isNaN(n)) return null;
    return Math.min(Math.max(n, 1), total);
  }

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
      {#each personsPageItems as person}
        <button
          class="flex items-center justify-between w-full px-2 py-1 text-xs rounded hover:bg-muted transition-colors text-left group"
          onclick={() => navigateToEntity('persons', person)}
          title={person.name}
        >
          <span class="truncate">{truncateName(person.name)}</span>
          <span class="text-muted-foreground ml-2 flex-shrink-0 text-xs">{formatCount(person.articleCount)}</span>
        </button>
      {/each}
      {#if personsSorted.length === 0}
        <div class="text-xs text-muted-foreground p-2 text-center">No persons data</div>
      {/if}
    </CardContent>
        <CardFooter class="pt-0">
          <div class="w-full flex flex-col items-center gap-2">
            <div class="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={personsPage === 1} onclick={() => (personsPage = Math.max(1, personsPage - 1))}>Prev</Button>
              <Button variant="outline" size="sm" disabled={personsPage === personsTotalPages} onclick={() => (personsPage = Math.min(personsTotalPages, personsPage + 1))}>Next</Button>
            </div>
            <div class="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              Page
              <Input
                type="number"
                class="h-8 w-12 px-2 text-xs"
                min="1"
                max={personsTotalPages}
                aria-label="Go to page"
                title="Go to page"
                bind:value={personsPageStr}
                onchange={() => {
                  const next = applyPageInput(personsPageStr, personsTotalPages);
                  personsPage = next ?? personsPage;
                  personsPageStr = String(personsPage);
                }}
                onblur={() => {
                  const next = applyPageInput(personsPageStr, personsTotalPages);
                  personsPage = next ?? personsPage;
                  personsPageStr = String(personsPage);
                }}
              />
              / {personsTotalPages}
            </div>
          </div>
        </CardFooter>
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
      {#each organizationsPageItems as organization}
        <button
          class="flex items-center justify-between w-full px-2 py-1 text-xs rounded hover:bg-muted transition-colors text-left group"
          onclick={() => navigateToEntity('organizations', organization)}
          title={organization.name}
        >
          <span class="truncate">{truncateName(organization.name)}</span>
          <span class="text-muted-foreground ml-2 flex-shrink-0 text-xs">{formatCount(organization.articleCount)}</span>
        </button>
      {/each}
      {#if organizationsSorted.length === 0}
        <div class="text-xs text-muted-foreground p-2 text-center">No organizations data</div>
      {/if}
    </CardContent>
        <CardFooter class="pt-0">
          <div class="w-full flex flex-col items-center gap-2">
            <div class="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={organizationsPage === 1} onclick={() => (organizationsPage = Math.max(1, organizationsPage - 1))}>Prev</Button>
              <Button variant="outline" size="sm" disabled={organizationsPage === organizationsTotalPages} onclick={() => (organizationsPage = Math.min(organizationsTotalPages, organizationsPage + 1))}>Next</Button>
            </div>
            <div class="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              Page
              <Input
                type="number"
                class="h-8 w-12 px-2 text-xs"
                min="1"
                max={organizationsTotalPages}
                aria-label="Go to page"
                title="Go to page"
                bind:value={organizationsPageStr}
                onchange={() => {
                  const next = applyPageInput(organizationsPageStr, organizationsTotalPages);
                  organizationsPage = next ?? organizationsPage;
                  organizationsPageStr = String(organizationsPage);
                }}
                onblur={() => {
                  const next = applyPageInput(organizationsPageStr, organizationsTotalPages);
                  organizationsPage = next ?? organizationsPage;
                  organizationsPageStr = String(organizationsPage);
                }}
              />
              / {organizationsTotalPages}
            </div>
          </div>
        </CardFooter>
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
      {#each eventsPageItems as event}
        <button
          class="flex items-center justify-between w-full px-2 py-1 text-xs rounded hover:bg-muted transition-colors text-left group"
          onclick={() => navigateToEntity('events', event)}
          title={event.name}
        >
          <span class="truncate">{truncateName(event.name)}</span>
          <span class="text-muted-foreground ml-2 flex-shrink-0 text-xs">{formatCount(event.articleCount)}</span>
        </button>
      {/each}
      {#if eventsSorted.length === 0}
        <div class="text-xs text-muted-foreground p-2 text-center">No events data</div>
      {/if}
    </CardContent>
        <CardFooter class="pt-0">
          <div class="w-full flex flex-col items-center gap-2">
            <div class="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={eventsPage === 1} onclick={() => (eventsPage = Math.max(1, eventsPage - 1))}>Prev</Button>
              <Button variant="outline" size="sm" disabled={eventsPage === eventsTotalPages} onclick={() => (eventsPage = Math.min(eventsTotalPages, eventsPage + 1))}>Next</Button>
            </div>
            <div class="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              Page
              <Input
                type="number"
                class="h-8 w-12 px-2 text-xs"
                min="1"
                max={eventsTotalPages}
                aria-label="Go to page"
                title="Go to page"
                bind:value={eventsPageStr}
                onchange={() => {
                  const next = applyPageInput(eventsPageStr, eventsTotalPages);
                  eventsPage = next ?? eventsPage;
                  eventsPageStr = String(eventsPage);
                }}
                onblur={() => {
                  const next = applyPageInput(eventsPageStr, eventsTotalPages);
                  eventsPage = next ?? eventsPage;
                  eventsPageStr = String(eventsPage);
                }}
              />
              / {eventsTotalPages}
            </div>
          </div>
        </CardFooter>
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
      {#each subjectsPageItems as subject}
        <button
          class="flex items-center justify-between w-full px-2 py-1 text-xs rounded hover:bg-muted transition-colors text-left group"
          onclick={() => navigateToEntity('subjects', subject)}
          title={subject.name}
        >
          <span class="truncate">{truncateName(subject.name)}</span>
          <span class="text-muted-foreground ml-2 flex-shrink-0 text-xs">{formatCount(subject.articleCount)}</span>
        </button>
      {/each}
      {#if subjectsSorted.length === 0}
        <div class="text-xs text-muted-foreground p-2 text-center">No subjects data</div>
      {/if}
    </CardContent>
        <CardFooter class="pt-0">
          <div class="w-full flex flex-col items-center gap-2">
            <div class="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={subjectsPage === 1} onclick={() => (subjectsPage = Math.max(1, subjectsPage - 1))}>Prev</Button>
              <Button variant="outline" size="sm" disabled={subjectsPage === subjectsTotalPages} onclick={() => (subjectsPage = Math.min(subjectsTotalPages, subjectsPage + 1))}>Next</Button>
            </div>
            <div class="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              Page
              <Input
                type="number"
                class="h-8 w-12 px-2 text-xs"
                min="1"
                max={subjectsTotalPages}
                aria-label="Go to page"
                title="Go to page"
                bind:value={subjectsPageStr}
                onchange={() => {
                  const next = applyPageInput(subjectsPageStr, subjectsTotalPages);
                  subjectsPage = next ?? subjectsPage;
                  subjectsPageStr = String(subjectsPage);
                }}
                onblur={() => {
                  const next = applyPageInput(subjectsPageStr, subjectsTotalPages);
                  subjectsPage = next ?? subjectsPage;
                  subjectsPageStr = String(subjectsPage);
                }}
              />
              / {subjectsTotalPages}
            </div>
          </div>
        </CardFooter>
  </Card>
</div>

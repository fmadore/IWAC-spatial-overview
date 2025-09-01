<script lang="ts">
  import { mapData } from '$lib/state/mapData.svelte';
  import { appState } from '$lib/state/appState.svelte';
  import { getVisibleData } from '$lib/state/derived.svelte';
  import PersonSelector from '$lib/components/person-selector.svelte';
  import Map from '$lib/components/maps/Map.svelte';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';

  // Get persons data and visible articles
  const persons = $derived.by(() => mapData.persons);
  const visibleData = $derived.by(() => getVisibleData());
  const selectedEntity = $derived.by(() => appState.selectedEntity);

  // Get locations from selected person's articles
  const selectedPersonLocations = $derived.by(() => {
    if (!selectedEntity || selectedEntity.type !== 'Personnes') return [];
    
    // Get all spatial locations mentioned in the related articles
    const locations = new Set<string>();
    
    for (const item of visibleData) {
      // Add all spatial locations from the article
      for (const location of item.spatial) {
        locations.add(location);
      }
      // Also add the article's country
      if (item.country) {
        locations.add(item.country);
      }
    }
    
    return Array.from(locations).sort();
  });

  // Statistics for the selected person
  const personStats = $derived.by(() => {
    if (!selectedEntity) return null;
    
    const articleCount = visibleData.length;
    const countries = new Set(visibleData.map(item => item.country));
    const newspapers = new Set(visibleData.map(item => item.newspaperSource));
    const dateRange = visibleData.reduce((range, item) => {
      if (!item.publishDate) return range;
      if (!range.min || item.publishDate < range.min) range.min = item.publishDate;
      if (!range.max || item.publishDate > range.max) range.max = item.publishDate;
      return range;
    }, { min: null as Date | null, max: null as Date | null });

    return {
      articleCount,
      countryCount: countries.size,
      newspaperCount: newspapers.size,
      dateRange
    };
  });
</script>

<div class="flex h-full flex-col gap-6 p-4 lg:p-6">
  <!-- Person Selection -->
  <div class="w-full max-w-md">
    <PersonSelector 
      {persons} 
      selectedPersonId={selectedEntity?.id || null}
    />
  </div>

  {#if selectedEntity && selectedEntity.type === 'Personnes'}
    <!-- Statistics Cards -->
    <div class="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm">Articles</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{personStats?.articleCount || 0}</div>
          <p class="text-xs text-muted-foreground">mentioning {selectedEntity.name}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm">Countries</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{personStats?.countryCount || 0}</div>
          <p class="text-xs text-muted-foreground">locations mentioned</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm">Newspapers</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{personStats?.newspaperCount || 0}</div>
          <p class="text-xs text-muted-foreground">different sources</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm">Time Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">
            {#if personStats?.dateRange?.min && personStats?.dateRange?.max}
              {personStats.dateRange.min.getFullYear()}–{personStats.dateRange.max.getFullYear()}
            {:else}
              N/A
            {/if}
          </div>
          <p class="text-xs text-muted-foreground">publication range</p>
        </CardContent>
      </Card>
    </div>

    <!-- Map showing locations -->
    <div class="flex-1">
      <Card class="h-full">
        <CardHeader>
          <CardTitle>Locations Associated with {selectedEntity.name}</CardTitle>
        </CardHeader>
        <CardContent class="h-full p-0">
          <Map height="500px" />
        </CardContent>
      </Card>
    </div>

    <!-- Locations List -->
    {#if selectedPersonLocations.length > 0}
      <Card>
        <CardHeader>
          <CardTitle>Mentioned Locations ({selectedPersonLocations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="flex flex-wrap gap-2">
            {#each selectedPersonLocations as location}
              <span class="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                {location}
              </span>
            {/each}
          </div>
        </CardContent>
      </Card>
    {/if}

    <!-- Articles Table -->
    {#if visibleData.length > 0}
      <Card>
        <CardHeader>
          <CardTitle>Related Articles ({visibleData.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="text-muted-foreground">
                <tr>
                  <th class="px-2 py-1 text-left">Title</th>
                  <th class="px-2 py-1 text-left">Date</th>
                  <th class="px-2 py-1 text-left">Country</th>
                  <th class="px-2 py-1 text-left">Newspaper</th>
                </tr>
              </thead>
              <tbody>
                {#each visibleData.slice(0, 10) as article}
                  <tr class="border-t">
                    <td class="px-2 py-1 max-w-xs truncate">{article.title}</td>
                    <td class="px-2 py-1">{article.publishDate?.toISOString?.().slice(0,10) || ''}</td>
                    <td class="px-2 py-1">{article.country}</td>
                    <td class="px-2 py-1">{article.newspaperSource}</td>
                  </tr>
                {/each}
                {#if visibleData.length > 10}
                  <tr class="border-t">
                    <td colspan="4" class="px-2 py-1 text-center text-muted-foreground">
                      ... and {visibleData.length - 10} more articles
                    </td>
                  </tr>
                {/if}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    {/if}
  {:else}
    <!-- No person selected state -->
    <div class="flex flex-1 items-center justify-center">
      <div class="text-center text-muted-foreground">
        <h3 class="text-lg font-medium">Select a Person</h3>
        <p class="text-sm">Choose a person from the dropdown above to explore their associated locations and articles.</p>
      </div>
    </div>
  {/if}
</div>

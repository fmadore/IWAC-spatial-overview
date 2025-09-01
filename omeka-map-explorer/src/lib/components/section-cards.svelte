<script lang="ts">
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { filters } from '$lib/state/filters.svelte';
  import { mapData } from '$lib/state/mapData.svelte';

  const totalItems = $derived.by(() => mapData.allItems.length);
  const totalCountries = $derived.by(() => filters.available.countries.length);
  const dateRangeLabel = $derived.by(() => {
    const { min, max } = filters.available.dateRange;
    return `${min.getFullYear()} – ${max.getFullYear()}`;
  });
</script>

<div class="grid gap-4 px-4 lg:px-6 md:grid-cols-3">
  <Card>
    <CardHeader class="pb-2">
      <CardTitle class="text-sm">Articles</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="text-3xl font-bold">{totalItems}</div>
      <p class="text-xs text-muted-foreground mt-1">Total records loaded</p>
    </CardContent>
  </Card>

  <Card>
    <CardHeader class="pb-2">
      <CardTitle class="text-sm">Countries</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="text-3xl font-bold">{totalCountries}</div>
      <p class="text-xs text-muted-foreground mt-1">Available in dataset</p>
    </CardContent>
  </Card>

  <Card>
    <CardHeader class="pb-2">
      <CardTitle class="text-sm">Time span</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="text-3xl font-bold">{dateRangeLabel}</div>
      <p class="text-xs text-muted-foreground mt-1">Publication years</p>
    </CardContent>
  </Card>
</div>

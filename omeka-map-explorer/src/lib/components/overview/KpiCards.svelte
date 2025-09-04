<script lang="ts">
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { filters } from '$lib/state/filters.svelte';
  import { mapData } from '$lib/state/mapData.svelte';

  // Count unique articles by ID (same logic as section-cards, but with formatting)
  const totalUniqueArticles = $derived.by(() => {
    const items = mapData.allItems || [];
    const ids = new Set(items.map((item) => item.id.split('-')[0]));
    return ids.size;
  });

  const totalCountries = $derived.by(() => filters.available.countries.length);
  const totalNewspapers = $derived.by(() => filters.available.newspapers.length);

  const dateRangeLabel = $derived.by(() => {
    const r = filters.available?.dateRange;
    if (!r?.min || !r?.max) return '';
    return `${r.min.getFullYear()} – ${r.max.getFullYear()}`;
  });

  // Locale-aware formatter using French locale to insert narrow no-break spaces: 11 683
  const nf = new Intl.NumberFormat('fr-FR');

  function fmt(n: number) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '';
    return nf.format(n);
  }
</script>

<div class="grid gap-4 px-4 lg:px-6 md:grid-cols-4">
  <Card>
    <CardHeader class="pb-2">
      <CardTitle class="text-sm">Articles</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="text-3xl font-bold">{fmt(totalUniqueArticles)}</div>
      <p class="text-xs text-muted-foreground mt-1">Unique articles in dataset</p>
    </CardContent>
  </Card>

  <Card>
    <CardHeader class="pb-2">
      <CardTitle class="text-sm">Newspapers</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="text-3xl font-bold">{fmt(totalNewspapers)}</div>
      <p class="text-xs text-muted-foreground mt-1">Sources represented</p>
    </CardContent>
  </Card>

  <Card>
    <CardHeader class="pb-2">
      <CardTitle class="text-sm">Countries</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="text-3xl font-bold">{fmt(totalCountries)}</div>
      <p class="text-xs text-muted-foreground mt-1">Available in dataset</p>
    </CardContent>
  </Card>

  <Card>
    <CardHeader class="pb-2">
      <CardTitle class="text-sm">Time span</CardTitle>
    </CardHeader>
    <CardContent>
      {#if dateRangeLabel}
        <div class="text-3xl font-bold">{dateRangeLabel}</div>
        <p class="text-xs text-muted-foreground mt-1">From first to last article</p>
      {/if}
    </CardContent>
  </Card>
</div>

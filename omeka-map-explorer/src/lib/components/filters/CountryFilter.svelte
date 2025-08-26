<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { filters } from '$lib/state/filters.svelte';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Label } from '$lib/components/ui/label';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';

  // Props (read-only); selection relies on global filters state
  let { countries = [], selected = [] } = $props<{ countries?: string[]; selected?: string[] }>();

  // Event dispatcher (optional for parent listeners)
  const dispatch = createEventDispatcher();

  // Only allow these countries (fixed order)
  const allowedCountries = ['Benin', 'Burkina Faso', "Côte d'Ivoire", 'Togo'];
  // Intersect available countries with allowed list; if none provided, fall back to allowed
  const countryList = $derived.by<string[]>(() => (
    countries?.length ? allowedCountries.filter((c) => countries.includes(c)) : allowedCountries
  ));

  // Build a stable id for input/label association
  function idFor(country: string) {
    return `country-${country.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`;
  }

  function toggleCountry(country: string) {
    const list = filters.selected.countries;
    const idx = list.indexOf(country);
    filters.selected.countries = idx === -1 ? [...list, country] : list.filter((c) => c !== country);
    dispatch('change', { countries: filters.selected.countries });
  }
  function clearAll() {
    filters.selected.countries = [];
    dispatch('change', { countries: filters.selected.countries });
  }
  function selectAll() {
    filters.selected.countries = [...countryList];
    dispatch('change', { countries: filters.selected.countries });
  }
</script>

<Card class="w-full">
  <CardHeader class="pb-3">
    <div class="flex items-center justify-between">
      <CardTitle class="text-base font-medium">Countries</CardTitle>
      {#if countryList.length > 0}
        <div class="flex gap-2">
          <Button size="sm" variant="outline"
            aria-label="Select all"
            disabled={filters.selected.countries.length === countryList.length}
            onclick={selectAll}
          >Select all</Button>
          <Button size="sm" variant="ghost"
            aria-label="Clear"
            disabled={filters.selected.countries.length === 0}
            onclick={clearAll}
          >Clear</Button>
        </div>
      {/if}
    </div>
  </CardHeader>
  <CardContent class="pt-0">
    <div class="space-y-3 max-h-40 overflow-y-auto">
      {#if countryList.length === 0}
        <p class="text-sm text-muted-foreground italic">No countries available</p>
      {:else}
        {#each countryList as country (country)}
          <div class="flex items-center gap-2">
            <Checkbox
              id={idFor(country)}
              checked={filters.selected.countries.includes(country)}
              aria-checked={filters.selected.countries.includes(country)}
              onclick={() => toggleCountry(country)}
            />
            <Label for={idFor(country)} class="cursor-pointer">{country}</Label>
          </div>
        {/each}
      {/if}
    </div>
    {#if filters.selected.countries.length > 0}
      <div class="mt-3 pt-3 border-t border-border">
        <p class="text-xs text-muted-foreground">
          {filters.selected.countries.length} selected
        </p>
      </div>
    {/if}
  </CardContent>
</Card>
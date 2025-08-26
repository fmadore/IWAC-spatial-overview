<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { filters } from '$lib/state/filters.svelte';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Label } from '$lib/components/ui/label';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  
  // Props (read-only); selection relies on global filters state
  let { countries = [], selected = [] } = $props<{ countries?: string[]; selected?: string[] }>();
  
  // Event dispatcher
  const dispatch = createEventDispatcher();
  
  // Toggle country selection
  function toggleCountry(country: string) {
    console.log('toggleCountry called for:', country);
    const list = filters.selected.countries;
    const index = list.indexOf(country);
    console.log('Current selected countries:', list);
    console.log('Country index:', index);
    if (index === -1) {
      filters.selected.countries = [...list, country];
      console.log('Added country, new list:', filters.selected.countries);
    } else {
      filters.selected.countries = list.filter(c => c !== country);
      console.log('Removed country, new list:', filters.selected.countries);
    }
    dispatch('change', { countries: filters.selected.countries });
  }
  
  // Clear all selections
  function clearAll() {
    console.log('clearAll called, current countries:', filters.selected.countries);
    filters.selected.countries = [];
    console.log('clearAll after clear:', filters.selected.countries);
    dispatch('change', { countries: filters.selected.countries });
  }
  
  // Select all countries
  function selectAll() {
    filters.selected.countries = [...countries];
    dispatch('change', { countries: filters.selected.countries });
  }
  
  // Update the filter store
  // Deprecated legacy method retained for compatibility if invoked
  function updateStore() {
    dispatch('change', { countries: filters.selected.countries });
  }
</script>

<Card class="w-full">
  <CardHeader class="pb-3">
    <div class="flex items-center justify-between">
      <CardTitle class="text-base font-medium">Countries</CardTitle>
      {#if countries.length > 0}
        <div class="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            class="h-6 px-2 text-xs"
            onclick={selectAll}
            disabled={filters.selected.countries.length === countries.length}
          >
            All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-6 px-2 text-xs"
            onclick={() => {
              console.log('Clear button clicked');
              clearAll();
            }}
            disabled={filters.selected.countries.length === 0}
          >
            Clear
          </Button>
        </div>
      {/if}
    </div>
  </CardHeader>
  <CardContent class="pt-0">
    <div class="space-y-3 max-h-40 overflow-y-auto">
      {#if countries.length === 0}
        <p class="text-sm text-muted-foreground italic">No countries available</p>
      {:else}
        {#each countries as country (country)}
          {@const isChecked = filters.selected.countries.includes(country)}
          <div class="flex items-center space-x-2">
            <Checkbox
              id={`country-${country}`}
              checked={isChecked}
              onCheckedChange={(checked) => {
                console.log('Checkbox onCheckedChange event fired for:', country, 'checked:', checked);
                toggleCountry(country);
              }}
            />
            <Label
              for={`country-${country}`}
              class="text-sm font-normal cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              onclick={() => toggleCountry(country)}
            >
              {country}
            </Label>
          </div>
        {/each}
      {/if}
    </div>
    {#if filters.selected.countries.length > 0}
      <div class="mt-3 pt-3 border-t border-border">
        <p class="text-xs text-muted-foreground">
          {filters.selected.countries.length} countr{filters.selected.countries.length === 1 ? 'y' : 'ies'} selected
        </p>
      </div>
    {/if}
  </CardContent>
</Card> 
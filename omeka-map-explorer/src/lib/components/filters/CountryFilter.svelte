<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { filterStore } from '$lib/stores/filterStore';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Label } from '$lib/components/ui/label';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  
  // Props
  export let countries: string[] = [];
  export let selected: string[] = [];
  
  // Event dispatcher
  const dispatch = createEventDispatcher();
  
  // Toggle country selection
  function toggleCountry(country: string) {
    const index = selected.indexOf(country);
    
    if (index === -1) {
      selected = [...selected, country];
    } else {
      selected = selected.filter(c => c !== country);
    }
    
    updateStore();
  }
  
  // Clear all selections
  function clearAll() {
    selected = [];
    updateStore();
  }
  
  // Select all countries
  function selectAll() {
    selected = [...countries];
    updateStore();
  }
  
  // Update the filter store
  function updateStore() {
    filterStore.update((state: any) => ({
      ...state,
      selected: {
        ...state.selected,
        countries: selected
      }
    }));
    
    dispatch('change', { countries: selected });
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
            disabled={selected.length === countries.length}
          >
            All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-6 px-2 text-xs"
            onclick={clearAll}
            disabled={selected.length === 0}
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
          {@const isChecked = selected.includes(country)}
          <div class="flex items-center space-x-2">
            <Checkbox
              id="country-{country}"
              checked={isChecked}
              onclick={() => toggleCountry(country)}
            />
            <Label
              for="country-{country}"
              class="text-sm font-normal cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {country}
            </Label>
          </div>
        {/each}
      {/if}
    </div>
    
    {#if selected.length > 0}
      <div class="mt-3 pt-3 border-t border-border">
        <p class="text-xs text-muted-foreground">
          {selected.length} countr{selected.length === 1 ? 'y' : 'ies'} selected
        </p>
      </div>
    {/if}
  </CardContent>
</Card> 
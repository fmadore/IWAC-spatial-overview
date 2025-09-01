<script lang="ts">
  import { filters } from '$lib/state/filters.svelte';
  import { appState } from '$lib/state/appState.svelte';
  import { mapData } from '$lib/state/mapData.svelte';
  import { Button } from '$lib/components/ui/button';
  import CountryFilter from './CountryFilter.svelte';
  import YearRangeFilter from './YearRangeFilter.svelte';
  import * as Sidebar from '$lib/components/ui/sidebar';
  
  // Reset all filters
  function resetFilters() {
    filters.selected.countries = [];
    filters.selected.regions = [];
    filters.selected.newspapers = [];
    filters.selected.dateRange = null;
    filters.selected.keywords = [];
  }
</script>

<Sidebar.Root class="z-50">
  <Sidebar.Header>
    <Sidebar.Group>
      <Sidebar.GroupLabel>Filters</Sidebar.GroupLabel>
      <Sidebar.GroupAction>
        <Sidebar.Trigger />
      </Sidebar.GroupAction>
    </Sidebar.Group>
  </Sidebar.Header>
  
  <Sidebar.Content>
    <Sidebar.Group>
      <Sidebar.GroupContent>
        <CountryFilter 
          countries={filters.available.countries}
          selected={filters.selected.countries}
        />
      </Sidebar.GroupContent>
    </Sidebar.Group>
    
    <Sidebar.Separator />
    
    <Sidebar.Group>
      <Sidebar.GroupContent>
        <YearRangeFilter 
          range={filters.available.dateRange}
        />
      </Sidebar.GroupContent>
    </Sidebar.Group>
  </Sidebar.Content>
  
  <Sidebar.Footer>
    <div class="p-4">
      <div class="mb-3 text-xs text-muted-foreground">Map view</div>
      <div class="flex items-center gap-2 mb-4">
        <Button
          type="button"
          variant={mapData.viewMode === 'bubbles' ? 'default' : 'outline'}
          size="sm"
          aria-pressed={mapData.viewMode === 'bubbles'}
          onclick={() => (mapData.viewMode = 'bubbles')}
        >Bubbles</Button>
        <Button
          type="button"
          variant={mapData.viewMode === 'choropleth' ? 'default' : 'outline'}
          size="sm"
          aria-pressed={mapData.viewMode === 'choropleth'}
          onclick={() => (mapData.viewMode = 'choropleth')}
        >Choropleth</Button>
      </div>
      <button 
        class="w-full px-4 py-2 text-sm font-medium text-foreground bg-background border border-input rounded-md hover:bg-accent hover:text-accent-foreground transition-colors" 
        onclick={resetFilters}
      >
        Reset All Filters
      </button>
    </div>
  </Sidebar.Footer>
</Sidebar.Root>

 
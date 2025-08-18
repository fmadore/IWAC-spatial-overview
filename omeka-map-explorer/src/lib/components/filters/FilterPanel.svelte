<script lang="ts">
  import { filters } from '$lib/state/filters.svelte';
  import { appState } from '$lib/state/appState.svelte';
  import CountryFilter from './CountryFilter.svelte';
  import DateRangeFilter from './DateRangeFilter.svelte';
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

<Sidebar.Root>
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
        <DateRangeFilter 
          range={filters.available.dateRange}
          selected={filters.selected.dateRange}
        />
      </Sidebar.GroupContent>
    </Sidebar.Group>
  </Sidebar.Content>
  
  <Sidebar.Footer>
    <div class="p-4">
      <button 
        class="w-full px-4 py-2 text-sm font-medium text-foreground bg-background border border-input rounded-md hover:bg-accent hover:text-accent-foreground transition-colors" 
        onclick={resetFilters}
      >
        Reset All Filters
      </button>
    </div>
  </Sidebar.Footer>
</Sidebar.Root>

 
<script lang="ts">
  import { filters } from '$lib/state/filters.svelte';
  import { appState } from '$lib/state/appState.svelte';
  import CountryFilter from './CountryFilter.svelte';
  import DateRangeFilter from './DateRangeFilter.svelte';
  
  // Local state
  let expanded = $state(true);
  
  // Toggle expanded state
  function toggleExpanded() {
    expanded = !expanded;
  }
  
  // Reset all filters
  function resetFilters() {
    filters.selected.countries = [];
    filters.selected.regions = [];
    filters.selected.newspapers = [];
    filters.selected.dateRange = null;
    filters.selected.keywords = [];
  }
</script>

<div class="filter-panel">
  <div class="header">
    <h2>Filters</h2>
  <button class="toggle-button" onclick={toggleExpanded}>
      {expanded ? '−' : '+'}
    </button>
  </div>
  
  {#if expanded}
    <div class="filters">
      <CountryFilter 
        countries={filters.available.countries}
        selected={filters.selected.countries}
      />
      
      <DateRangeFilter 
        range={filters.available.dateRange}
        selected={filters.selected.dateRange}
      />
      
      <div class="filter-actions">
  <button class="reset-button" onclick={resetFilters}>
          Reset All Filters
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .filter-panel {
    background-color: white;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    overflow: hidden;
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 15px;
    background-color: #f5f5f5;
    border-bottom: 1px solid #ddd;
  }
  
  .header h2 {
    margin: 0;
    font-size: 1.2rem;
  }
  
  .toggle-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0 5px;
  }
  
  .filters {
    padding: 15px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  
  .filter-actions {
    display: flex;
    justify-content: center;
    margin-top: 10px;
  }
  
  .reset-button {
    background-color: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 5px 10px;
    cursor: pointer;
  }
  
  .reset-button:hover {
    background-color: #e5e5e5;
  }
</style> 
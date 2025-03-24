<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { filterStore } from '$lib/stores/filterStore';
  
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
  
  // Update the filter store
  function updateStore() {
    filterStore.update(state => ({
      ...state,
      selected: {
        ...state.selected,
        countries: selected
      }
    }));
    
    dispatch('change', { countries: selected });
  }
</script>

<div class="country-filter">
  <h3>Countries</h3>
  
  <div class="country-list">
    {#if countries.length === 0}
      <p class="empty-message">No countries available</p>
    {:else}
      {#each countries as country}
        <label class="country-item">
          <input 
            type="checkbox" 
            checked={selected.includes(country)} 
            on:change={() => toggleCountry(country)} 
          />
          {country}
        </label>
      {/each}
    {/if}
  </div>
</div>

<style>
  .country-filter h3 {
    margin-top: 0;
    margin-bottom: 10px;
    font-size: 1rem;
  }
  
  .country-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
    max-height: 150px;
    overflow-y: auto;
  }
  
  .country-item {
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
  }
  
  .empty-message {
    color: #888;
    font-style: italic;
    margin: 5px 0;
  }
</style> 
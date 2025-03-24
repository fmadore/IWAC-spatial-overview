<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { filterStore } from '$lib/stores/filterStore';
  
  // Props
  export let range: { min: Date; max: Date } = {
    min: new Date('1900-01-01'),
    max: new Date('2023-12-31')
  };
  export let selected: { start: Date; end: Date } | null = null;
  
  // Local state
  let startDate: string = selected?.start.toISOString().slice(0, 10) || range.min.toISOString().slice(0, 10);
  let endDate: string = selected?.end.toISOString().slice(0, 10) || range.max.toISOString().slice(0, 10);
  let isActive: boolean = !!selected;
  
  // Event dispatcher
  const dispatch = createEventDispatcher();
  
  // Handle date range change
  function handleDateChange() {
    if (!isActive) {
      updateStore(null);
      return;
    }
    
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return;
      }
      
      updateStore({ start, end });
    } catch (error) {
      console.error('Error parsing dates:', error);
    }
  }
  
  // Handle checkbox toggle
  function handleToggle() {
    isActive = !isActive;
    handleDateChange();
  }
  
  // Update the filter store
  function updateStore(dateRange: { start: Date; end: Date } | null) {
    filterStore.update(state => ({
      ...state,
      selected: {
        ...state.selected,
        dateRange
      }
    }));
    
    dispatch('change', { dateRange });
  }
  
  // Initialize from props on mount
  $: if (selected) {
    startDate = selected.start.toISOString().slice(0, 10);
    endDate = selected.end.toISOString().slice(0, 10);
    isActive = true;
  }
</script>

<div class="date-range-filter">
  <div class="header">
    <h3>Date Range</h3>
    <label class="toggle">
      <input 
        type="checkbox" 
        bind:checked={isActive}
        on:change={handleToggle}
      />
      <span>Active</span>
    </label>
  </div>
  
  <div class="date-inputs" class:disabled={!isActive}>
    <div class="date-group">
      <label for="start-date">From:</label>
      <input 
        id="start-date"
        type="date" 
        min={range.min.toISOString().slice(0, 10)}
        max={range.max.toISOString().slice(0, 10)}
        bind:value={startDate}
        on:change={handleDateChange}
        disabled={!isActive}
      />
    </div>
    
    <div class="date-group">
      <label for="end-date">To:</label>
      <input 
        id="end-date"
        type="date"
        min={range.min.toISOString().slice(0, 10)}
        max={range.max.toISOString().slice(0, 10)}
        bind:value={endDate}
        on:change={handleDateChange}
        disabled={!isActive}
      />
    </div>
  </div>
</div>

<style>
  .date-range-filter h3 {
    margin-top: 0;
    margin-bottom: 10px;
    font-size: 1rem;
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  
  .toggle {
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    font-size: 0.8rem;
  }
  
  .date-inputs {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .date-inputs.disabled {
    opacity: 0.5;
  }
  
  .date-group {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  
  .date-group label {
    font-size: 0.8rem;
    color: #666;
  }
  
  input[type="date"] {
    padding: 5px;
    border: 1px solid #ddd;
    border-radius: 4px;
    width: 100%;
  }
</style> 
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { filters } from '$lib/state/filters.svelte';
  
  // Props
  let { range = { min: new Date('1900-01-01'), max: new Date('2023-12-31') }, selected = null } = $props<{ range?: { min: Date; max: Date }; selected?: { start: Date; end: Date } | null }>();
  
  // Local state
  let startDate = $state(selected?.start.toISOString().slice(0, 10) || range.min.toISOString().slice(0, 10));
  let endDate = $state(selected?.end.toISOString().slice(0, 10) || range.max.toISOString().slice(0, 10));
  let isActive = $state(!!selected);
  
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
    filters.selected.dateRange = dateRange;
    dispatch('change', { dateRange });
  }
  
  // Initialize from props on mount
  $effect(() => {
    if (selected) {
      startDate = selected.start.toISOString().slice(0, 10);
      endDate = selected.end.toISOString().slice(0, 10);
      isActive = true;
    }
  });
</script>

<div class="date-range-filter">
  <div class="header">
    <h3>Date Range</h3>
    <label class="toggle">
      <input 
        type="checkbox" 
        bind:checked={isActive}
  onchange={handleToggle}
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
  onchange={handleDateChange}
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
  onchange={handleDateChange}
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
<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { filters } from '$lib/state/filters.svelte';
  import { Slider } from '$lib/components/ui/slider';

  let { range = { min: new Date('1900-01-01'), max: new Date('2023-12-31') } } = $props<{ 
    range?: { min: Date; max: Date }; 
  }>();

  const dispatch = createEventDispatcher();

  // Get year range from the date range
  const minYear = range.min.getFullYear();
  const maxYear = range.max.getFullYear();

  // Initialize with full range or current selection
  let yearRange = $state<number[]>(
    filters.selected.dateRange 
      ? [filters.selected.dateRange.start.getFullYear(), filters.selected.dateRange.end.getFullYear()]
      : [minYear, maxYear] // Show ALL data by default
  );

  // Track if we're updating internally to prevent loops
  let isInternalUpdate = false;
  
  // Debounce timer
  let debounceTimer: number | null = null;
  let isUpdating = $state(false);
  const DEBOUNCE_DELAY = 1500; // 1.5 seconds

  // Update filters when slider changes (only when user interacts)
  function handleYearChange() {
    if (isInternalUpdate) return;
    
    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    // Show updating indicator
    isUpdating = true;
    
    // Set new timer to delay the actual filter update
    debounceTimer = setTimeout(() => {
      if (yearRange[0] === minYear && yearRange[1] === maxYear) {
        // If full range is selected, clear the filter
        filters.selected.dateRange = null;
      } else {
        // Create date range from the start of first year to end of last year
        const startDate = new Date(yearRange[0], 0, 1); // January 1st of start year
        const endDate = new Date(yearRange[1], 11, 31); // December 31st of end year
        filters.selected.dateRange = { start: startDate, end: endDate };
      }
      dispatch('change', { dateRange: filters.selected.dateRange });
      debounceTimer = null;
      isUpdating = false;
    }, DEBOUNCE_DELAY);
  }

  // Watch for external changes to filters (e.g., reset all filters)
  $effect(() => {
    const selectedDateRange = filters.selected.dateRange;
    
    isInternalUpdate = true;
    if (selectedDateRange) {
      const startYear = selectedDateRange.start.getFullYear();
      const endYear = selectedDateRange.end.getFullYear();
      yearRange = [startYear, endYear];
    } else {
      yearRange = [minYear, maxYear];
    }
    isInternalUpdate = false;
  });

  // Clean up timer on component destruction
  onDestroy(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  });
</script>

<div class="flex flex-col gap-4">
  <div class="flex items-center justify-between">
    <h3 class="text-sm font-medium">Publication Years</h3>
    <div class="flex items-center gap-2">
      {#if isUpdating}
        <span class="text-xs text-blue-600 animate-pulse">Updating...</span>
      {/if}
      <span class="text-xs text-muted-foreground">
        {yearRange[0]} - {yearRange[1]}
      </span>
    </div>
  </div>

  <div class="space-y-3">
    <Slider
      bind:value={yearRange}
      min={minYear}
      max={maxYear}
      step={1}
      type="multiple"
      class="w-full"
      onValueChange={handleYearChange}
    />
    
    <div class="flex justify-between text-xs text-muted-foreground">
      <span>{minYear}</span>
      <span>{maxYear}</span>
    </div>
  </div>
</div>

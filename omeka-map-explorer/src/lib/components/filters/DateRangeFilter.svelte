<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { filters } from '$lib/state/filters.svelte';
  import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
  import { Input } from '$lib/components/ui/input';
  import { cn } from '$lib/utils.js';

  let { range = { min: new Date('1900-01-01'), max: new Date('2023-12-31') }, selected = null } = $props<{ range?: { min: Date; max: Date }; selected?: { start: Date; end: Date } | null }>();

  let startDate = $state(selected?.start.toISOString().slice(0, 10) || range.min.toISOString().slice(0, 10));
  let endDate = $state(selected?.end.toISOString().slice(0, 10) || range.max.toISOString().slice(0, 10));
  let isActive = $state(!!selected);

  const dispatch = createEventDispatcher();

  function handleDateChange() {
    if (!isActive) {
      updateStore(null);
      return;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
    updateStore({ start, end });
  }

  function updateStore(dateRange: { start: Date; end: Date } | null) {
    filters.selected.dateRange = dateRange;
    dispatch('change', { dateRange });
  }

  $effect(() => {
    if (selected) {
      startDate = selected.start.toISOString().slice(0, 10);
      endDate = selected.end.toISOString().slice(0, 10);
      isActive = true;
    }
  });

  // React to changes in dates or activation state
  $effect(() => {
    // dependencies
    startDate; endDate; isActive;
    handleDateChange();
  });
</script>

<div class="flex flex-col gap-3">
  <div class="flex items-center justify-between">
    <h3 class="text-sm font-medium">Date Range</h3>
    <label class="flex items-center gap-2 text-xs select-none cursor-pointer">
      <Checkbox bind:checked={isActive} aria-label="Toggle date range filter" />
      <span class="text-muted-foreground">Active</span>
    </label>
  </div>

  <div class={cn('grid gap-3 transition-opacity', !isActive && 'opacity-50 pointer-events-none')}>
    <div class="grid gap-1">
      <label for="start-date" class="text-xs font-medium text-muted-foreground">From</label>
  <Input
        id="start-date"
        type="date"
        min={range.min.toISOString().slice(0, 10)}
        max={range.max.toISOString().slice(0, 10)}
        bind:value={startDate}
        disabled={!isActive}
      />
    </div>
    <div class="grid gap-1">
      <label for="end-date" class="text-xs font-medium text-muted-foreground">To</label>
  <Input
        id="end-date"
        type="date"
        min={range.min.toISOString().slice(0, 10)}
        max={range.max.toISOString().slice(0, 10)}
        bind:value={endDate}
        disabled={!isActive}
      />
    </div>
  </div>
</div>
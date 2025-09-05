<script lang="ts">
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Timeline } from './timeline';
  import { timeData } from '$lib/state/timeData.svelte';

  // Allow height override for reuse
  let { height = '140px', title = 'Timeline' } = $props<{ height?: string; title?: string }>();

  const hasData = $derived.by(() => Array.isArray(timeData.data) && timeData.data.length > 0);
  const dateRangeLabel = $derived.by(() => {
    const s = timeData.range.start;
    const e = timeData.range.end;
    return s && e ? `${s.getFullYear()} – ${e.getFullYear()}` : '';
  });
</script>

<div class="px-4 lg:px-6">
  <Card class="overflow-hidden">
    <CardHeader class="pb-2">
      <CardTitle class="text-sm">{title}</CardTitle>
      {#if dateRangeLabel}
        <CardDescription>{dateRangeLabel}</CardDescription>
      {/if}
    </CardHeader>
    <CardContent class="pt-0">
      {#if hasData}
        <Timeline data={timeData.data} {height} />
      {:else}
        <div class="text-center text-muted-foreground py-8">Loading timeline…</div>
      {/if}
    </CardContent>
  </Card>
  
</div>

<style>
  /* Keep the card compact on the dashboard */
</style>

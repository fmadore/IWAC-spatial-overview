<script lang="ts">
  import KpiCards from './KpiCards.svelte';
  import ChartAreaInteractive from '$lib/components/chart-area-interactive.svelte';
  import TopEntities from './TopEntities.svelte';
  import { mapData } from '$lib/state/mapData.svelte';

  // Ready when all entity collections exist (preloaded in +page on mount)
  const hasEntityData = $derived.by(() => !!(mapData.persons && mapData.organizations && mapData.events && mapData.subjects));
</script>

<div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
  <KpiCards />
  <div class="px-4 lg:px-6">
    <ChartAreaInteractive />
  </div>

  {#if hasEntityData}
    <TopEntities />
  {:else}
    <div class="px-4 lg:px-6">
      <div class="text-center text-muted-foreground p-8">
        <p>Loading entity data...</p>
      </div>
    </div>
  {/if}
</div>

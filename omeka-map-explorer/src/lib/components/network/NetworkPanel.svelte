<script lang="ts">
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Label } from '$lib/components/ui/label';
  // Using native input to avoid strict event typing issues
  import { networkState, applyFilters } from '$lib/state/networkData.svelte';

  function onWeightChange(e: Event) {
    const v = Number((e.target as HTMLInputElement).value);
    networkState.weightMin = Number.isFinite(v) ? v : networkState.weightMin;
    applyFilters();
  }

  function toggleType(t: keyof typeof networkState.typesEnabled) {
    networkState.typesEnabled[t] = !networkState.typesEnabled[t];
    applyFilters();
  }
</script>

<Card>
  <CardHeader>
    <CardTitle>Network Controls</CardTitle>
  </CardHeader>
  <CardContent class="space-y-4">
    <div class="space-y-1">
      <Label for="weightMin">Min edge weight</Label>
  <input id="weightMin" type="number" min="1" step="1" value={networkState.weightMin} on:change={onWeightChange} class="w-full h-9 rounded-md border bg-background px-3 text-sm" />
    </div>

    <div class="space-y-2">
      <div class="text-sm font-medium">Node types</div>
      <div class="grid grid-cols-2 gap-2 text-sm">
        {#each Object.keys(networkState.typesEnabled) as t}
          <label class="flex items-center gap-2">
            <input type="checkbox" checked={networkState.typesEnabled[t]} on:change={() => toggleType(t as any)} />
            <span class="capitalize">{t}</span>
          </label>
        {/each}
      </div>
    </div>
  </CardContent>
  
</Card>

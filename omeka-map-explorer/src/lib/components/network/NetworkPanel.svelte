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

  function onDegreeCapChange(e: Event) {
    const v = Number((e.target as HTMLInputElement).value);
    networkState.degreeCap = Number.isFinite(v) && v > 0 ? v : undefined;
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

    <div class="space-y-1">
      <Label for="degreeCap">Degree cap (optional)</Label>
      <input id="degreeCap" type="number" min="1" step="1" value={networkState.degreeCap ?? ''} on:change={onDegreeCapChange} class="w-full h-9 rounded-md border bg-background px-3 text-sm" />
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

    <div class="space-y-2 text-xs text-muted-foreground">
      <div>
        Visible nodes: {networkState.filtered?.nodes.length ?? 0}
        • edges: {networkState.filtered?.edges.length ?? 0}
      </div>
      <div class="flex gap-3 items-center">
        <span class="inline-flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-full" style="background:#2563eb"></span>Person</span>
        <span class="inline-flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-full" style="background:#7c3aed"></span>Org</span>
        <span class="inline-flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-full" style="background:#059669"></span>Event</span>
        <span class="inline-flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-full" style="background:#d97706"></span>Subject</span>
        <span class="inline-flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-full" style="background:#ef4444"></span>Location</span>
      </div>
    </div>
  </CardContent>
  
</Card>

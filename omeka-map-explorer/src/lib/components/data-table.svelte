<script lang="ts">
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import type { ProcessedItem } from '$lib/types';
  import { mapData } from '$lib/state/mapData.svelte';

  let { data = [] } = $props<{ data?: ProcessedItem[] }>();
  const rows = $derived.by(() => (data.length ? data : mapData.allItems.slice(0, 10)));
</script>

<Card>
  <CardHeader>
    <CardTitle>Sample records</CardTitle>
  </CardHeader>
  <CardContent>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="text-muted-foreground">
          <tr>
            <th class="px-2 py-1 text-left">Title</th>
            <th class="px-2 py-1 text-left">Date</th>
            <th class="px-2 py-1 text-left">Country</th>
            <th class="px-2 py-1 text-left">Source</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as r}
            <tr class="border-t">
              <td class="px-2 py-1">{r.title}</td>
              <td class="px-2 py-1">{r.publishDate?.toISOString?.().slice(0,10) || ''}</td>
              <td class="px-2 py-1">{r.country}</td>
              <td class="px-2 py-1">{r.newspaperSource}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </CardContent>
</Card>

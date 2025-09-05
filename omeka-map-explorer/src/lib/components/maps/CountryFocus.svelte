<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import * as Sidebar from '$lib/components/ui/sidebar';
  import { mapData } from '$lib/state/mapData.svelte';
  import { filters } from '$lib/state/filters.svelte';
  import { getVisibleData } from '$lib/state/derived.svelte';
  import { appState } from '$lib/state/appState.svelte';
  import ChoroplethLayer from './ChoroplethLayer.svelte';
  import { loadCountryAdminGeoJson } from '$lib/api/geoJsonService';
  import { loadAdminCounts, type AdminLevel } from '$lib/api/countryFocusService';

  // Props: optional initial country
  let { initialCountry = 'Benin' } = $props<{ initialCountry?: 'Benin' | 'Burkina Faso' | "Côte d'Ivoire" | 'Togo' }>();

  // Local state
  let country = $state<'Benin' | 'Burkina Faso' | "Côte d'Ivoire" | 'Togo'>(initialCountry);
  let level = $state<AdminLevel>('regions');
  let geo: any = $state(null);
  let L: any;
  let mapEl: HTMLDivElement;
  let map: any = $state(null);

  const visible = $derived.by(() => getVisibleData());

  // Compute counts per admin unit name
  let preCounts: Record<string, number> | null = $state(null);
  const counts = $derived.by<Record<string, number>>(() => {
    if (preCounts) return preCounts;
    const res: Record<string, number> = {};
    if (!geo) return res;
    const names = new Set<string>((geo?.features ?? []).map((f: any) => f?.properties?.name).filter(Boolean));
    for (const it of visible) {
      if (!it.country || it.country !== country) continue;
      const key = (level === 'regions' ? it.region : it.prefecture) ?? null;
      if (!key) continue;
      if (names.has(key)) res[key] = (res[key] || 0) + 1;
    }
    return res;
  });

  let geoError = $state<string | null>(null);
  let loading = $state(false);

  async function ensureGeo() {
    loading = true;
    geoError = null;
    try {
      geo = await loadCountryAdminGeoJson(country, level);
    } catch (e) {
      geo = null;
      geoError = e instanceof Error ? e.message : 'Failed to load GeoJSON';
    } finally {
      loading = false;
    }
    // Fit map to geo bounds when available
    if (map && L && geo) {
      try {
        const tmp = L.geoJSON(geo);
        const b = tmp.getBounds();
        tmp.remove();
        if (b && b.isValid()) map.fitBounds(b, { padding: [20, 20] });
      } catch {}
    }
  }

  async function ensureCounts() {
    preCounts = null;
    const res = await loadAdminCounts(country, level);
    if (res && res.counts) {
      preCounts = res.counts;
    }
  }

  function resetView() {
    mapData.selectedCountry = country;
    mapData.selectedRegion = null;
  }

  onMount(async () => {
    if (!browser) return;
    const leaflet = await import('leaflet');
    await import('leaflet/dist/leaflet.css');
    L = leaflet;
    // Initialize map
    if (!map && mapEl) {
      map = L.map(mapEl, { zoomControl: true }).setView([9.5, 2.3], 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);
    }
  await ensureGeo();
  await ensureCounts();
  });

  // Reload geo when country/level changes
  // Debounce geo loads on quick toggles
  let geoTimer: any;
  $effect(() => {
    void country; void level;
    if (geoTimer) clearTimeout(geoTimer);
  geoTimer = setTimeout(() => { ensureGeo(); ensureCounts(); }, 50);
  });
</script>

<div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
  <Card>
    <CardHeader>
      <CardTitle>Country focus</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="flex flex-wrap items-center gap-2 mb-3">
        <Button variant={country==='Benin'?'default':'outline'} size="sm" onclick={() => country='Benin'}>Benin</Button>
        <Button variant={country==='Burkina Faso'?'default':'outline'} size="sm" onclick={() => country='Burkina Faso'}>Burkina Faso</Button>
        <Button variant={country==="Côte d'Ivoire"?'default':'outline'} size="sm" onclick={() => country="Côte d'Ivoire"}>Côte d'Ivoire</Button>
        <Button variant={country==='Togo'?'default':'outline'} size="sm" onclick={() => country='Togo'}>Togo</Button>
  <div class="w-px h-6 bg-border mx-1"></div>
        <Button variant={level==='regions'?'default':'outline'} size="sm" onclick={() => level='regions'}>Regions</Button>
        <Button variant={level==='prefectures'?'default':'outline'} size="sm" onclick={() => level='prefectures'}>Prefectures</Button>
        <div class="grow"></div>
        <Button size="sm" variant="ghost" onclick={resetView}>Reset</Button>
      </div>

      <div class="relative h-[520px] w-full rounded-md overflow-hidden border">
  <div bind:this={mapEl} class="absolute inset-0"></div>
        {#if map && geo}
          <ChoroplethLayer map={map} geoJson={geo} data={counts} scaleMode="log" />
        {:else if geoError}
          <div class="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
            {geoError}
          </div>
        {/if}
      </div>
    </CardContent>
  </Card>
</div>

<style>
  :global(.leaflet-container) { font: inherit; }
  :global(.info.legend) { background: var(--background); color: var(--foreground); padding: .5rem .75rem; border-radius: .375rem; border: 1px solid var(--border); }
  :global(.info) { background: var(--background); color: var(--foreground); padding: .25rem .5rem; border-radius: .375rem; border: 1px solid var(--border); }
</style>

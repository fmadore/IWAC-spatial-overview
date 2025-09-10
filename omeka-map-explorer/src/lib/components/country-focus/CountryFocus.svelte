<script lang="ts">
  import { onMount } from 'svelte';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { loadCountryAdminGeoJson } from '$lib/api/geoJsonService';
  import { loadAdminCounts } from '$lib/api/countryFocusService';
  import type { AdminLevel } from '$lib/api/countryFocusService';
  import { appState } from '$lib/state/appState.svelte';
  import { urlManager } from '$lib/utils/urlManager.svelte';
  import ChoroplethMap from './ChoroplethMap.svelte';

  type Country = 'Benin' | 'Burkina Faso' | 'Cote_dIvoire' | 'Togo';

  // Props
  let { initialCountry = 'Benin' } = $props<{ 
    initialCountry?: Country 
  }>();

  // Use app state for facets, with fallback to props for initial values
  const country = $derived(appState.countryFocus?.country || initialCountry);
  const level = $derived(appState.countryFocus?.level || 'regions');
  const scaleType = $derived(appState.countryFocus?.scaleType || 'quantile');

  // Local state for data loading
  let geoJson: any = $state(null);
  let counts: Record<string, number> = $state({});
  let loading = $state(false);
  let error = $state<string | null>(null);

  const countries: Array<{ key: Country; label: string }> = [
    { key: 'Benin', label: 'Benin' },
    { key: 'Burkina Faso', label: 'Burkina Faso' },
    { key: 'Cote_dIvoire', label: "Côte d'Ivoire" },
    { key: 'Togo', label: 'Togo' }
  ];

  // Côte d'Ivoire only has regions, no prefectures
  const hasPrefectures = $derived(country !== 'Cote_dIvoire');

  function setCountry(newCountry: Country) {
    if (!appState.countryFocus) {
      appState.countryFocus = { country: newCountry, level: 'regions', scaleType: 'quantile' };
    } else {
      appState.countryFocus.country = newCountry;
      // Reset to regions if switching to Côte d'Ivoire and currently on prefectures
      if (newCountry === 'Cote_dIvoire' && appState.countryFocus.level === 'prefectures') {
        appState.countryFocus.level = 'regions';
      }
    }
    urlManager.updateUrl();
  }

  function setLevel(newLevel: AdminLevel) {
    if (!appState.countryFocus) {
      appState.countryFocus = { country: 'Benin', level: newLevel, scaleType: 'quantile' };
    } else {
      appState.countryFocus.level = newLevel;
    }
    urlManager.updateUrl();
  }

  function setScaleType(newScaleType: 'quantile' | 'linear' | 'sqrt') {
    if (!appState.countryFocus) {
      appState.countryFocus = { country: 'Benin', level: 'regions', scaleType: newScaleType };
    } else {
      appState.countryFocus.scaleType = newScaleType;
    }
    urlManager.updateUrl();
  }

  async function loadData() {
    loading = true;
    error = null;
    
    try {
      // Load GeoJSON and counts in parallel
      const [geo, adminCounts] = await Promise.all([
        loadCountryAdminGeoJson(country === 'Cote_dIvoire' ? "Côte d'Ivoire" : country, level),
        loadAdminCounts(country === 'Cote_dIvoire' ? "Côte d'Ivoire" : country, level)
      ]);
      
      geoJson = geo;
      counts = adminCounts?.countsArticles || adminCounts?.countsMentions || {};
      
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load data';
      geoJson = null;
      counts = {};
    } finally {
      loading = false;
    }
  }

  // Load data when country or level changes
  $effect(() => {
    void country; void level;
    loadData();
  });

  onMount(() => {
    loadData();
  });
</script>

<div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
  <Card>
    <CardHeader>
      <CardTitle>Country Focus</CardTitle>
    </CardHeader>
    <CardContent>
      <!-- Controls -->
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <!-- Country buttons -->
        {#each countries as { key, label }}
          <Button 
            variant={country === key ? 'default' : 'outline'} 
            size="sm" 
            onclick={() => setCountry(key)}
            disabled={loading}
          >
            {label}
          </Button>
        {/each}
        
        <div class="w-px h-6 bg-border mx-1"></div>
        
        <!-- Level buttons -->
        <Button 
          variant={level === 'regions' ? 'default' : 'outline'} 
          size="sm" 
          onclick={() => setLevel('regions')}
          disabled={loading}
        >
          Regions
        </Button>
        {#if hasPrefectures}
          <Button 
            variant={level === 'prefectures' ? 'default' : 'outline'} 
            size="sm" 
            onclick={() => setLevel('prefectures')}
            disabled={loading}
          >
            Prefectures
          </Button>
        {/if}
        
        <div class="w-px h-6 bg-border mx-1"></div>
        
        <!-- Scale type buttons -->
        <Button 
          variant={scaleType === 'quantile' ? 'default' : 'outline'} 
          size="sm" 
          onclick={() => setScaleType('quantile')}
          disabled={loading}
          title="Quantile scale: Each color represents the same number of regions"
        >
          Quantile
        </Button>
        <Button 
          variant={scaleType === 'linear' ? 'default' : 'outline'} 
          size="sm" 
          onclick={() => setScaleType('linear')}
          disabled={loading}
          title="Linear scale: Colors represent equal intervals"
        >
          Linear
        </Button>
        <Button 
          variant={scaleType === 'sqrt' ? 'default' : 'outline'} 
          size="sm" 
          onclick={() => setScaleType('sqrt')}
          disabled={loading}
          title="Square root scale: Better for data with outliers"
        >
          √ Scale
        </Button>
      </div>

      <!-- Map or loading/error state -->
      {#if loading}
        <div class="h-[520px] w-full rounded-md border flex items-center justify-center">
          <div class="text-center">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p class="text-sm text-muted-foreground">Loading {country} {level}...</p>
          </div>
        </div>
      {:else if error}
        <div class="h-[520px] w-full rounded-md border flex items-center justify-center">
          <div class="text-center text-destructive">
            <p class="font-medium">Error loading data</p>
            <p class="text-sm">{error}</p>
            <Button size="sm" variant="outline" onclick={loadData} class="mt-2">
              Retry
            </Button>
          </div>
        </div>
      {:else if geoJson}
        <ChoroplethMap {geoJson} data={counts} {scaleType} {country} adminLevel={level} />
      {:else}
        <div class="h-[520px] w-full rounded-md border flex items-center justify-center">
          <p class="text-sm text-muted-foreground">No data available</p>
        </div>
      {/if}

      <!-- Summary -->
      {#if !loading && !error && Object.keys(counts).length > 0}
        <div class="mt-4 text-sm text-muted-foreground">
          Showing {Object.keys(counts).length} {level} with {Object.values(counts).reduce((a, b) => a + b, 0)} total articles
        </div>
      {/if}
    </CardContent>
  </Card>
</div>

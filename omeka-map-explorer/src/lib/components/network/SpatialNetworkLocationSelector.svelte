<!--
  SpatialNetworkLocationSelector.svelte - Location search and selection component
  
  Provides a combobox for searching and selecting locations from the spatial network.
  Uses shadcn-svelte Command and Popover components with Svelte 5 runes.
-->
<script lang="ts">
  import { Check, ChevronsUpDown, MapPin, Globe } from 'lucide-svelte';
  import { tick } from 'svelte';
  import * as Command from '$lib/components/ui/command';
  import * as Popover from '$lib/components/ui/popover';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { cn } from '$lib/utils';
  import { 
    spatialNetworkState, 
    selectSpatialNode,
    toggleSpatialIsolationMode,
    getSpatialSelectedNode
  } from '$lib/state/spatialNetworkData.svelte';
  import type { SpatialNetworkNode } from '$lib/types';

  // Props
  let {
    placeholder = 'Search locations...',
    variant = 'outline',
    size = 'default',
    showSelectedInfo = true,
    autoFocus = false,
    onLocationSelect
  } = $props<{
    placeholder?: string;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    showSelectedInfo?: boolean;
    autoFocus?: boolean;
    onLocationSelect?: (location: SpatialNetworkNode | null) => void;
  }>();

  // Component state
  let open = $state(false);
  let searchValue = $state('');
  let triggerRef = $state<HTMLButtonElement | null>(null);

  // Reactive computed values
  const filteredData = $derived(spatialNetworkState.filtered);
  const selectedNode = $derived(getSpatialSelectedNode());
  
  // Get all available locations sorted by count (most relevant first)
  const availableLocations = $derived(() => {
    if (!filteredData) return [];
    
    return [...filteredData.nodes]
      .sort((a, b) => {
        // Sort by count (descending), then by label (ascending)
        if (b.count !== a.count) return b.count - a.count;
        return a.label.localeCompare(b.label);
      });
  });

  // Filter locations based on search input
  const searchResults = $derived(() => {
    if (!searchValue.trim()) return availableLocations().slice(0, 50); // Limit initial results
    
    const query = searchValue.toLowerCase();
    return availableLocations().filter(location => 
      location.label.toLowerCase().includes(query) ||
      location.country.toLowerCase().includes(query)
    ).slice(0, 20); // Limit search results
  });

  // Group results by country for better organization
  const groupedResults = $derived(() => {
    const groups: Record<string, SpatialNetworkNode[]> = {};
    
    searchResults().forEach(location => {
      const country = location.country || 'Unknown';
      if (!groups[country]) groups[country] = [];
      groups[country].push(location);
    });
    
    // Sort countries by total article count
    return Object.entries(groups)
      .sort(([, a], [, b]) => {
        const countA = a.reduce((sum, loc) => sum + loc.count, 0);
        const countB = b.reduce((sum, loc) => sum + loc.count, 0);
        return countB - countA;
      });
  });

  // Display text for the trigger button
  const selectedDisplayText = $derived(() => {
    if (selectedNode) {
      const countText = selectedNode.count === 1 ? '1 article' : `${selectedNode.count} articles`;
      return `${selectedNode.label} (${countText})`;
    }
    return placeholder;
  });

  /**
   * Handle location selection
   */
  function handleLocationSelect(location: SpatialNetworkNode) {
    selectSpatialNode(location.id);
    
    // Auto-enter focus mode when selecting a location
    if (!spatialNetworkState.isolationMode) {
      toggleSpatialIsolationMode(location.id);
    }
    
    // Close popover and refocus trigger
    closeAndFocusTrigger();
    
    // Call optional callback
    onLocationSelect?.(location);
  }

  /**
   * Clear selection
   */
  function handleClearSelection() {
    selectSpatialNode(null);
    closeAndFocusTrigger();
    onLocationSelect?.(null);
  }

  /**
   * Close popover and refocus trigger
   */
  function closeAndFocusTrigger() {
    open = false;
    searchValue = '';
    tick().then(() => {
      triggerRef?.focus();
    });
  }

  /**
   * Get country flag emoji (simplified)
   */
  function getCountryFlag(country: string): string {
    const flags: Record<string, string> = {
      'Burkina Faso': '🇧🇫',
      'Côte d\'Ivoire': '🇨🇮',
      'Benin': '🇧🇯',
      'Togo': '🇹🇬',
      'Mali': '🇲🇱', 
      'Ghana': '🇬🇭',
      'Niger': '🇳🇪',
      'Nigeria': '🇳🇬',
      'France': '🇫🇷',
      'Morocco': '🇲🇦',
      'Algeria': '🇩🇿',
      'Senegal': '🇸🇳'
    };
    return flags[country] || '🌍';
  }

  /**
   * Format location display with country and article count
   */
  function formatLocationDisplay(location: SpatialNetworkNode): string {
    const countText = location.count === 1 ? '1 article' : `${location.count} articles`;
    return `${location.label} • ${countText}`;
  }

  // Auto-focus the search input when popover opens
  $effect(() => {
    if (open && autoFocus) {
      // Small delay to ensure DOM is ready
      tick().then(() => {
        const input = document.querySelector('[data-location-search-input]') as HTMLInputElement;
        input?.focus();
      });
    }
  });
</script>

<Popover.Root bind:open>
  <Popover.Trigger bind:ref={triggerRef}>
    {#snippet child({ props })}
      <Button
        variant={variant}
        size={size}
        class={cn(
          "justify-between text-left font-normal",
          selectedNode ? "text-foreground" : "text-muted-foreground",
          size === 'sm' ? "h-8 px-2" : size === 'lg' ? "h-12 px-4" : "h-10 px-3"
        )}
        {...props}
        role="combobox"
        aria-expanded={open}
        aria-label="Select location to focus on"
      >
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <MapPin class="h-4 w-4 flex-shrink-0" />
          <span class="truncate">
            {selectedDisplayText()}
          </span>
        </div>
        <ChevronsUpDown class="ml-2 h-4 w-4 flex-shrink-0 opacity-50" />
      </Button>
    {/snippet}
  </Popover.Trigger>
  
  <Popover.Content class="w-[400px] p-0" align="start">
    <Command.Root shouldFilter={false}>
      <Command.Input 
        placeholder="Search locations by name or country..."
        bind:value={searchValue}
        data-location-search-input
      />
      <Command.List>
        <Command.Empty>
          {#if !filteredData}
            Loading locations...
          {:else if availableLocations().length === 0}
            No locations available with current filters.
          {:else}
            No locations found matching "{searchValue}".
          {/if}
        </Command.Empty>
        
        {#if selectedNode}
          <Command.Group heading="Current Selection">
            <Command.Item 
              value={selectedNode.id}
              onSelect={handleClearSelection}
              class="text-primary"
            >
              <div class="flex items-center gap-2 flex-1">
                <Check class="h-4 w-4" />
                <span class="font-medium">{selectedNode.label}</span>
                <Badge variant="secondary" class="ml-auto">
                  {selectedNode.count} articles
                </Badge>
              </div>
            </Command.Item>
            <Command.Separator />
          </Command.Group>
        {/if}

        {#each groupedResults() as [country, locations]}
          <Command.Group heading={`${getCountryFlag(country)} ${country}`}>
            {#each locations as location}
              <Command.Item
                value={location.id}
                onSelect={() => handleLocationSelect(location)}
                class={cn(
                  "cursor-pointer",
                  selectedNode?.id === location.id && "bg-accent"
                )}
              >
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  {#if selectedNode?.id === location.id}
                    <Check class="h-4 w-4 text-primary" />
                  {:else}
                    <Globe class="h-4 w-4 text-muted-foreground" />
                  {/if}
                  
                  <div class="flex-1 min-w-0">
                    <div class="font-medium truncate">{location.label}</div>
                    <div class="text-xs text-muted-foreground">
                      {location.count} {location.count === 1 ? 'article' : 'articles'}
                      {#if location.degree && location.degree > 0}
                        • {location.degree} connections
                      {/if}
                    </div>
                  </div>
                  
                  <Badge variant="outline" class="ml-2">
                    {location.count}
                  </Badge>
                </div>
              </Command.Item>
            {/each}
          </Command.Group>
          
          {#if groupedResults().indexOf([country, locations]) < groupedResults().length - 1}
            <Command.Separator />
          {/if}
        {/each}
      </Command.List>
    </Command.Root>
  </Popover.Content>
</Popover.Root>

{#if showSelectedInfo && selectedNode}
  <div class="mt-2 text-xs text-muted-foreground">
    <div class="flex items-center gap-1">
      <MapPin class="h-3 w-3" />
      <span>
        <strong>{selectedNode.label}</strong> in {selectedNode.country}
      </span>
    </div>
    <div class="mt-1">
      {selectedNode.count} articles • 
      {selectedNode.degree || 0} connections •
      {selectedNode.coordinates[0].toFixed(4)}°, {selectedNode.coordinates[1].toFixed(4)}°
    </div>
  </div>
{/if}

<style>
  /* Ensure proper popover positioning */
  :global([data-location-search-input]) {
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
  }
  
  /* Improve touch targets on mobile */
  @media (max-width: 640px) {
    :global(.location-selector-item) {
      min-height: 44px;
      padding: 12px 16px;
    }
  }
</style>

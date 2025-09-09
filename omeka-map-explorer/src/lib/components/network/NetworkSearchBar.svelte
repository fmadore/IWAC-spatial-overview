<script lang="ts">
  import { Search, X } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { networkState } from '$lib/state/networkData.svelte';
  import { NetworkInteractionHandler } from './modules/NetworkInteractionHandler';
  import type { NetworkNode } from '$lib/types';

  // Props
  let { 
    placeholder = "Search nodes...",
    maxResults = 10,
    onNodeSelect,
    onHighlight,
    onClearHighlight
  } = $props<{
    placeholder?: string;
    maxResults?: number;
    onNodeSelect?: (node: NetworkNode) => void;
    onHighlight?: (nodeIds: string[]) => void;
    onClearHighlight?: () => void;
  }>();

  // State
  let searchQuery = $state('');
  let showResults = $state(false);
  let selectedIndex = $state(-1);
  let inputElement: HTMLInputElement;

  // Search results derived from current query (debounced)
  const searchResults = $derived.by(() => {
    if (!searchQuery.trim() || searchQuery.length < 2 || !networkState.filtered) return [];
    
    const query = searchQuery.toLowerCase().trim();
    const nodes = networkState.filtered.nodes;
    
    // Limit search for performance - only search first 500 nodes if there are many
    const searchNodes = nodes.length > 500 ? nodes.slice(0, 500) : nodes;
    
    // Search by node label (name) only for performance
    const matches = searchNodes.filter(node => {
      const label = node.label.toLowerCase();
      return label.includes(query);
    });

    // Simple sort - exact matches first, then alphabetical
    matches.sort((a, b) => {
      const aLabel = a.label.toLowerCase();
      const bLabel = b.label.toLowerCase();
      
      // Exact match priority
      if (aLabel === query && bLabel !== query) return -1;
      if (bLabel === query && aLabel !== query) return 1;
      
      // Alphabetical
      return aLabel.localeCompare(bLabel);
    });

    return matches.slice(0, Math.min(maxResults, 20)); // Cap at 20 for performance
  });

  // Highlight matches in search results (simplified)
  const highlightedResults = $derived.by(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    
    return searchResults.map(node => {
      const label = node.label;
      const lowerLabel = label.toLowerCase();
      const index = lowerLabel.indexOf(query);
      
      if (index === -1) {
        return { node, highlighted: label };
      }
      
      return {
        node,
        highlighted: {
          before: label.slice(0, index),
          match: label.slice(index, index + query.length),
          after: label.slice(index + query.length)
        }
      };
    });
  });

  // Throttled highlighting to reduce performance impact
  let highlightTimeout: number | undefined;
  $effect(() => {
    if (highlightTimeout) {
      clearTimeout(highlightTimeout);
    }
    
    highlightTimeout = setTimeout(() => {
      if (onHighlight && searchResults.length > 0) {
        onHighlight(searchResults.map(node => node.id));
      } else if (onClearHighlight && searchResults.length === 0 && searchQuery.trim()) {
        onClearHighlight();
      }
    }, 300); // 300ms debounce

    return () => {
      if (highlightTimeout) {
        clearTimeout(highlightTimeout);
      }
    };
  });

  // Handle input changes
  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    searchQuery = target.value;
    selectedIndex = -1;
    showResults = target.value.trim().length > 0;
  }

  // Handle keyboard navigation
  function handleKeyDown(event: KeyboardEvent) {
    if (!showResults || searchResults.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, searchResults.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        break;
      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
          selectNode(searchResults[selectedIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        clearSearch();
        break;
    }
  }

  // Select a node
  function selectNode(node: NetworkNode) {
    NetworkInteractionHandler.handleNodeSelection(node);
    if (onNodeSelect) {
      onNodeSelect(node);
    }
    searchQuery = node.label;
    showResults = false;
    selectedIndex = -1;
  }

  // Clear search
  function clearSearch() {
    searchQuery = '';
    showResults = false;
    selectedIndex = -1;
    if (onClearHighlight) {
      onClearHighlight();
    }
    inputElement?.focus();
  }

  // Handle click outside to close results
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as Element;
    if (!target.closest('[data-search-container]')) {
      showResults = false;
      selectedIndex = -1;
    }
  }

  // Focus management
  function handleFocus() {
    if (searchQuery.trim()) {
      showResults = true;
    }
  }

  // Node type colors for visual indicators
  const nodeTypeColors: Record<string, string> = {
    person: '#3b82f6',
    organization: '#8b5cf6',
    event: '#10b981',
    subject: '#f59e0b',
    location: '#ef4444',
  };

  const nodeTypeLabels: Record<string, string> = {
    person: 'Person',
    organization: 'Organization',
    event: 'Event',
    subject: 'Subject',
    location: 'Location',
  };
</script>

<svelte:window on:click={handleClickOutside} />

<div class="relative w-full max-w-md" data-search-container>
  <!-- Search Input -->
  <div class="relative">
    <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    <input
      bind:this={inputElement}
      type="text"
      {placeholder}
      value={searchQuery}
      oninput={handleInput}
      onkeydown={handleKeyDown}
      onfocus={handleFocus}
      class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-10 pr-10 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      autocomplete="off"
      spellcheck="false"
    />
    {#if searchQuery}
      <Button
        variant="ghost"
        size="icon"
        class="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
        onclick={clearSearch}
        title="Clear search"
      >
        <X class="h-4 w-4" />
      </Button>
    {/if}
  </div>

  <!-- Search Results Dropdown -->
  {#if showResults && highlightedResults.length > 0}
    <div class="absolute top-full z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
      <div class="max-h-60 overflow-y-auto p-1">
        {#each highlightedResults as { node, highlighted }, index}
          {@const isSelected = index === selectedIndex}
          {@const nodeColor = nodeTypeColors[node.type] || '#6b7280'}
          {@const nodeLabel = nodeTypeLabels[node.type] || node.type}
          
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent {isSelected ? 'bg-accent' : ''}"
            onclick={() => selectNode(node)}
          >
            <!-- Node type indicator -->
            <div
              class="h-3 w-3 flex-shrink-0 rounded-full"
              style="background-color: {nodeColor}"
              title="{nodeLabel}"
            ></div>
            
            <!-- Node information -->
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">
                {#if typeof highlighted === 'string'}
                  {highlighted}
                {:else}
                  {highlighted.before}<mark class="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">{highlighted.match}</mark>{highlighted.after}
                {/if}
              </div>
              <div class="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" class="text-xs capitalize">
                  {nodeLabel}
                </Badge>
                <span class="font-mono truncate">{node.id}</span>
              </div>
            </div>
            
            <!-- Node metrics -->
            <div class="flex-shrink-0 text-xs text-muted-foreground text-right">
              <div>{node.count} articles</div>
            </div>
          </button>
        {/each}
      </div>
      
      <!-- Search summary -->
      <div class="border-t px-3 py-2 text-xs text-muted-foreground">
        {highlightedResults.length} of {networkState.filtered?.nodes.length || 0} nodes
        {#if highlightedResults.length === maxResults}
          (showing first {maxResults})
        {/if}
      </div>
    </div>
  {:else if showResults && searchQuery.trim() && searchResults.length === 0}
    <!-- No results -->
    <div class="absolute top-full z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
      <div class="p-3 text-center text-sm text-muted-foreground">
        No nodes found for "{searchQuery}"
      </div>
    </div>
  {/if}
</div>

<style>
  mark {
    background-color: rgb(254 240 138); /* yellow-200 */
    color: rgb(113 63 18); /* yellow-900 */
  }
</style>

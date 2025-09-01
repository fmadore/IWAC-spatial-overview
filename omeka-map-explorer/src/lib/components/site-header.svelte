<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { appState } from '$lib/state/appState.svelte';

  const getTitle = $derived.by(() => {
    if (appState.activeView === 'map') {
      return 'By Country (Map)';
    }
    
    switch (appState.activeVisualization) {
      case 'overview': return 'Dashboard';
      case 'byCountry': return 'By Country (Map)';
      case 'persons': return 'Persons';
      case 'organizations': return 'Organizations';
      case 'events': return 'Events';
      case 'subjects': return 'Subjects';
      default: return 'Dashboard';
    }
  });
</script>

<header class="sticky top-0 z-10 h-[var(--header-height)] border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
  <div class="flex h-full items-center justify-between px-4 lg:px-6">
    <h1 class="text-lg font-semibold tracking-tight">{getTitle}</h1>
    <div class="flex items-center gap-2">
      <Button size="sm" variant="outline" onclick={() => (appState.sidebarOpen = !appState.sidebarOpen)}>
        Toggle Sidebar
      </Button>
    </div>
  </div>
</header>

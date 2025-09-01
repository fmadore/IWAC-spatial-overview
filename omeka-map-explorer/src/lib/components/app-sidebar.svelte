<script lang="ts">
  import * as Sidebar from '$lib/components/ui/sidebar';
  import { Button } from '$lib/components/ui/button';
  import { appState } from '$lib/state/appState.svelte';
  import { cn } from '$lib/utils';
  import { Home, Globe2, Users, Building2, CalendarRange, Tags } from '@lucide/svelte';

  let { variant = 'inset' } = $props<{ variant?: 'floating' | 'inset' }>();

  type Viz = 'overview' | 'byCountry' | 'persons' | 'organizations' | 'events' | 'subjects';
  const nav: Array<{ id: Viz; label: string; icon: any; view?: 'dashboard' | 'map' }>= [
    { id: 'overview', label: 'Overview', icon: Home, view: 'dashboard' },
    { id: 'byCountry', label: 'By Country (Map)', icon: Globe2, view: 'map' },
    { id: 'persons', label: 'Persons', icon: Users, view: 'dashboard' },
    { id: 'organizations', label: 'Organizations', icon: Building2, view: 'dashboard' },
    { id: 'events', label: 'Events', icon: CalendarRange, view: 'dashboard' },
    { id: 'subjects', label: 'Subjects', icon: Tags, view: 'dashboard' }
  ];

  function switchTo(item: { id: Viz; view?: 'dashboard' | 'map' }) {
    if (item.view) appState.activeView = item.view;
    appState.activeVisualization = item.id;
  }
</script>

<Sidebar.Root class={cn(variant === 'inset' && 'bg-sidebar')}>
  <Sidebar.Header>
    <Sidebar.Group>
      <Sidebar.GroupLabel>IWAC Spatial Overview</Sidebar.GroupLabel>
    </Sidebar.Group>
  </Sidebar.Header>
  <Sidebar.Content>
    <Sidebar.Group>
      <Sidebar.GroupLabel>Visualizations</Sidebar.GroupLabel>
      <Sidebar.GroupContent>
        {#each nav as item}
          <Button variant={appState.activeVisualization === item.id ? 'default' : 'ghost'}
                  class="justify-start gap-2 w-full"
                  onclick={() => switchTo(item)}>
            <item.icon class="h-4 w-4" />
            {item.label}
          </Button>
        {/each}
      </Sidebar.GroupContent>
    </Sidebar.Group>
  </Sidebar.Content>
  <Sidebar.Footer>
    <div class="p-4 text-xs text-muted-foreground">v0 • Dashboard</div>
  </Sidebar.Footer>
</Sidebar.Root>

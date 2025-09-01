<script>
  import '../app.css';
  import * as Sidebar from '$lib/components/ui/sidebar';
  import AppSidebar from '$lib/components/app-sidebar.svelte';

  let { children } = $props();
</script>

<Sidebar.Provider style="--sidebar-width: calc(var(--spacing) * 72); --header-height: calc(var(--spacing) * 12);">
  <AppSidebar variant="inset" />
  <Sidebar.Inset>
    {@render children()}
  </Sidebar.Inset>
  
</Sidebar.Provider>

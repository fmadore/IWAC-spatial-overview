<script>
  import '../app.css';
  import * as Sidebar from '$lib/components/ui/sidebar';
  
  let { children } = $props();
</script>

<Sidebar.Provider>
  {@render children()}
</Sidebar.Provider>

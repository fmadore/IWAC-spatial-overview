<script>
	import '../app.css';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
    import { appState } from '$lib/state/appState.svelte';

	let { children } = $props();
</script>

<Sidebar.Provider
	style="--sidebar-width: calc(var(--spacing) * 72); --header-height: calc(var(--spacing) * 12);"
	bind:open={appState.sidebarOpen}
	class="min-h-screen"
>
	<AppSidebar variant="inset" />
	<Sidebar.Inset class="flex flex-col min-h-screen">
		{@render children()}
	</Sidebar.Inset>
</Sidebar.Provider>

<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { appState } from '$lib/state/appState.svelte';

	const getTitle = $derived.by(() => {
		if (appState.activeView === 'map') {
			return 'By Country (Map)';
		}

		switch (appState.activeVisualization) {
			case 'overview':
				return 'Dashboard';
			case 'byCountry':
				return 'By Country (Map)';
			case 'persons':
				return 'Persons';
			case 'organizations':
				return 'Organizations';
			case 'events':
				return 'Events';
			case 'subjects':
				return 'Subjects';
			case 'network':
				return 'Network';
			default:
				return 'Dashboard';
		}
	});
</script>

<header
	class="sticky top-0 z-10 h-[var(--header-height)] border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
>
	<div class="flex h-full items-center justify-between px-4 lg:px-6">
		<div class="flex items-center gap-3">
			<!-- Mobile sidebar trigger on the left for best UX -->
			<Sidebar.Trigger class="md:hidden" />
			<h1 class="text-lg font-semibold tracking-tight">{getTitle}</h1>
		</div>
		<div class="flex items-center gap-2">
			<!-- Reserved for future header actions -->
		</div>
	</div>
</header>

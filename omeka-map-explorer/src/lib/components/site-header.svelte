<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar';
	import * as Button from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { appState, toggleFullScreen } from '$lib/state/appState.svelte';

	const getTitle = $derived.by(() => {
		if (appState.activeView === 'map') {
			return 'By Country (Map)';
		}

		switch (appState.activeVisualization) {
			case 'overview':
				return 'Dashboard';
			case 'worldMap':
				return 'World Map';
			case 'countryFocus':
				return 'Country Focus';
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
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger>
						<Button.Button
							variant="ghost"
							size="icon"
							onclick={toggleFullScreen}
							class="h-8 w-8"
							aria-label={appState.isFullScreen ? 'Exit full screen' : 'Enter full screen'}
						>
							{#if appState.isFullScreen}
								<!-- Minimize/Exit Full Screen Icon -->
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="lucide lucide-minimize-2"
								>
									<polyline points="4,14 10,14 10,20" />
									<polyline points="20,10 14,10 14,4" />
									<line x1="14" y1="10" x2="21" y2="3" />
									<line x1="3" y1="21" x2="10" y2="14" />
								</svg>
							{:else}
								<!-- Maximize/Full Screen Icon -->
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="lucide lucide-maximize-2"
								>
									<polyline points="15,3 21,3 21,9" />
									<polyline points="9,21 3,21 3,15" />
									<line x1="21" y1="3" x2="14" y2="10" />
									<line x1="3" y1="21" x2="10" y2="14" />
								</svg>
							{/if}
						</Button.Button>
					</Tooltip.Trigger>
					<Tooltip.Content side="bottom">
						<p>{appState.isFullScreen ? 'Exit full screen' : 'Enter full screen'}</p>
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		</div>
	</div>
</header>

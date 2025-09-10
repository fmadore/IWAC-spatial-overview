<script lang="ts">
	import { mapData } from '$lib/state/mapData.svelte';
	import { Globe, CircleDot } from 'lucide-svelte';

	// Reactive state for current view mode
	const currentViewMode = $derived(mapData.viewMode);

	// Toggle functions with proper Svelte 5 syntax
	function toggleToBubbles() {
		mapData.viewMode = 'bubbles';
	}

	function toggleToChoropleth() {
		mapData.viewMode = 'choropleth';
	}
</script>

<div class="view-mode-toggle">
	<div class="toggle-group">
		<button
			type="button"
			class="toggle-button"
			class:active={currentViewMode === 'bubbles'}
			onclick={toggleToBubbles}
			aria-pressed={currentViewMode === 'bubbles'}
			title="Switch to bubble view"
		>
			<CircleDot size={14} />
			<span>Bubbles</span>
		</button>
		<button
			type="button"
			class="toggle-button"
			class:active={currentViewMode === 'choropleth'}
			onclick={toggleToChoropleth}
			aria-pressed={currentViewMode === 'choropleth'}
			title="Switch to choropleth view"
		>
			<Globe size={14} />
			<span>Choropleth</span>
		</button>
	</div>
</div>

<style>
	.view-mode-toggle {
		/* Remove absolute positioning since it's now in the header layout */
		display: inline-block;
	}

	.toggle-group {
		display: flex;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(10px);
		border-radius: 0.75rem;
		padding: 0.25rem;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
		border: 1px solid rgba(229, 231, 235, 1);
	}

	.toggle-button {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.625rem;
		border: none;
		background: transparent;
		border-radius: 0.5rem;
		font-size: 0.8125rem;
		font-weight: 500;
		color: #6b7280;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.toggle-button:hover {
		background: rgba(59, 130, 246, 0.1);
		color: #3b82f6;
		transform: translateY(-1px);
	}

	.toggle-button.active {
		background: #3b82f6;
		color: white;
		box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
	}

	.toggle-button.active:hover {
		background: #2563eb;
		transform: translateY(0);
	}

	@media (max-width: 640px) {
		.toggle-button span {
			display: none;
		}

		.toggle-button {
			padding: 0.375rem;
		}
	}
</style>

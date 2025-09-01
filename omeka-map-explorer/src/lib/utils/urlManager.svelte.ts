import { browser } from '$app/environment';
import { appState } from '$lib/state/appState.svelte';
import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { get } from 'svelte/store';
import { base } from '$app/paths';

type ViewType = 'dashboard' | 'map' | 'list' | 'stats';
type VisualizationType =
	| 'overview'
	| 'byCountry'
	| 'persons'
	| 'organizations'
	| 'events'
	| 'subjects';

// URL management for navigation state using search parameters
export const urlManager = {
	// Update URL based on current state
	updateUrl() {
		if (!browser) return;

		const view = appState.activeView;
		const viz = appState.activeVisualization;
		const selectedEntity = appState.selectedEntity;

		// Create URL search parameters
		const params = new URLSearchParams();

		// Only add parameters if they're not the default values
		if (view !== 'dashboard' || viz !== 'overview') {
			if (view !== 'dashboard') {
				params.set('view', view);
			}
			if (viz !== 'overview') {
				params.set('viz', viz);
			}
		}

		// Add entity selection if present
		if (selectedEntity) {
			params.set('entityType', selectedEntity.type);
			params.set('entityId', selectedEntity.id);
		}

		// Build the URL with proper base path
		const paramString = params.toString();
		const url = paramString ? `${base}/?${paramString}` : `${base}/`;

		// Use goto to update URL without causing navigation
		goto(url, { replaceState: true, noScroll: true });
	},

	// Parse URL search parameters and update state
	parseUrlAndUpdateState(searchParams: URLSearchParams) {
		if (!browser) return;

		const view = searchParams.get('view') as ViewType;
		const viz = searchParams.get('viz') as VisualizationType;
		const entityType = searchParams.get('entityType');
		const entityId = searchParams.get('entityId');

		// Set view - default to dashboard
		if (view && ['dashboard', 'map', 'list', 'stats'].includes(view)) {
			appState.activeView = view;
		} else {
			appState.activeView = 'dashboard';
		}

		// Set visualization - default to overview
		if (
			viz &&
			['overview', 'byCountry', 'persons', 'organizations', 'events', 'subjects'].includes(viz)
		) {
			appState.activeVisualization = viz;

			// If byCountry is selected, ensure we're in map view
			if (viz === 'byCountry') {
				appState.activeView = 'map';
			}
		} else {
			appState.activeVisualization = 'overview';
		}

		// Handle entity selection from URL
		if (entityType && entityId) {
			// We'll need to load the entity data to get the full entity object
			// For now, store the basic info and let the entity loader fill in the details
			appState.selectedEntity = {
				type: entityType,
				id: entityId,
				name: '', // Will be filled when entity data loads
				relatedArticleIds: [] // Will be filled when entity data loads
			};
		} else {
			// Clear entity selection if not in URL
			appState.selectedEntity = null;
		}
	},

	// Navigate to a specific view/visualization
	navigateTo(view: ViewType, visualization?: VisualizationType, entitySelection?: { type: string; id: string }) {
		appState.activeView = view;
		if (visualization) {
			appState.activeVisualization = visualization;
		}
		if (entitySelection) {
			// We'll need to load the full entity details, but set basic info for now
			appState.selectedEntity = {
				type: entitySelection.type,
				id: entitySelection.id,
				name: '', // Will be filled when entity data loads
				relatedArticleIds: [] // Will be filled when entity data loads
			};
		}
		this.updateUrl();
	}
};

// Effect to watch state changes and update URL
export function initializeUrlManager() {
	if (!browser) return;

	// Watch for state changes and update URL
	let previousView = appState.activeView;
	let previousViz = appState.activeVisualization;

	function checkForChanges() {
		if (appState.activeView !== previousView || appState.activeVisualization !== previousViz) {
			urlManager.updateUrl();
			previousView = appState.activeView;
			previousViz = appState.activeVisualization;
		}
		requestAnimationFrame(checkForChanges);
	}

	requestAnimationFrame(checkForChanges);
}

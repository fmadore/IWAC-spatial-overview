import { browser } from '$app/environment';
import { appState } from '$lib/state/appState.svelte';
import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { mapData } from '$lib/state/mapData.svelte';

type ViewType = 'dashboard' | 'map' | 'list' | 'stats';
type VisualizationType =
	| 'overview'
	| 'byCountry'
	| 'persons'
	| 'organizations'
	| 'events'
	| 'subjects'
	| 'locations'
	| 'network';

// URL management for navigation state using search parameters
export const urlManager = {
	// Keep last and pending URL to avoid duplicate replaceState calls
	_lastUrl: '' as string,
	_pending: 0 as any,
	_pendingUrl: '' as string,
	_debounceMs: 150,

	_buildUrlFromState() {
		const view = appState.activeView;
		const viz = appState.activeVisualization;
		const selectedEntity = appState.selectedEntity;
		const networkNode = appState.networkNodeSelected;
		const entityVizSet = new Set(['persons', 'organizations', 'events', 'subjects']);

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

		// Add entity selection only for entity visualizations
		if (selectedEntity && entityVizSet.has(viz as any)) {
			params.set('entityType', selectedEntity.type);
			params.set('entityId', selectedEntity.id);
		}

		// Add network node selection if present (node=type:id)
		if (networkNode?.id) {
			params.set('node', networkNode.id);
		}

		// Build the URL with proper base path
		const paramString = params.toString();
		const url = paramString ? `${base}/?${paramString}` : `${base}/`;
		return url;
	},

	// Update URL based on current state
	updateUrl(options?: { immediate?: boolean }) {
		if (!browser) return;

		const url = this._buildUrlFromState();
		// Avoid redundant updates
		if (url === this._lastUrl && !this._pending) return;

		// For explicit navigations (switching tabs/views), update immediately to avoid UI lag
		if (options?.immediate) {
			if (this._pending) {
				clearTimeout(this._pending);
				this._pending = 0;
			}
			this._lastUrl = url;
			goto(this._lastUrl, { replaceState: true, noScroll: true });
			return;
		}

		// Otherwise use a small debounce to coalesce rapid state changes
		this._pendingUrl = url;
		if (this._pending) {
			clearTimeout(this._pending);
		}
		this._pending = setTimeout(() => {
			this._pending = 0;
			if (this._pendingUrl !== this._lastUrl) {
				this._lastUrl = this._pendingUrl;
				// Use goto to update URL without causing navigation
				goto(this._lastUrl, { replaceState: true, noScroll: true });
			}
		}, this._debounceMs);
	},

	// Parse URL search parameters and update state
	parseUrlAndUpdateState(searchParams: URLSearchParams) {
		if (!browser) return;

		const view = searchParams.get('view') as ViewType;
		const viz = searchParams.get('viz') as VisualizationType;
		const entityType = searchParams.get('entityType');
		const entityId = searchParams.get('entityId');
        const nodeParam = searchParams.get('node');
		const entityVizSet = new Set(['persons', 'organizations', 'events', 'subjects']);

		// Set view - default to dashboard
		if (view && ['dashboard', 'map', 'list', 'stats'].includes(view)) {
			appState.activeView = view;
		} else {
			appState.activeView = 'dashboard';
		}

		// Set visualization - default to overview
		if (
			viz &&
			['overview', 'byCountry', 'persons', 'organizations', 'events', 'subjects', 'locations', 'network'].includes(viz)
		) {
			appState.activeVisualization = viz;

			// If byCountry is selected, ensure we're in map view
			if (viz === 'byCountry') {
				appState.activeView = 'map';
			}
		} else {
			appState.activeVisualization = 'overview';
		}

		// Handle network node selection from URL (node=type:id or plain id)
		if (nodeParam) {
			if (!appState.networkNodeSelected || appState.networkNodeSelected.id !== nodeParam) {
				appState.networkNodeSelected = { id: nodeParam };
			}
		} else if (appState.networkNodeSelected) {
			appState.networkNodeSelected = null;
		}

		// Handle entity selection from URL (only when on an entity visualization)
		const isEntityViz = entityVizSet.has(appState.activeVisualization as any);
		if (isEntityViz && entityType && entityId) {
			// If we already have the same entity selected with details, don't clobber them
			const prev = appState.selectedEntity;
			const isSame = prev && prev.type === entityType && prev.id === entityId;
			if (!isSame) {
				// Try to hydrate from already-loaded entities
				const typeMap: Record<string, keyof typeof mapData> = {
					Personnes: 'persons',
					Organisations: 'organizations',
					'Événements': 'events',
					Sujets: 'subjects'
				} as const;
				const collKey = typeMap[entityType as keyof typeof typeMap];
				let hydrated: { id: string; name: string; relatedArticleIds: string[] } | undefined;
				if (collKey && Array.isArray((mapData as any)[collKey])) {
					hydrated = ((mapData as any)[collKey] as Array<any>).find((e) => e.id === entityId);
				}

				if (hydrated) {
					appState.selectedEntity = {
						type: entityType,
						id: entityId,
						name: hydrated.name,
						relatedArticleIds: hydrated.relatedArticleIds ?? []
					};
				} else {
					// Store the basic info; details may be filled by entity loader later
					appState.selectedEntity = {
						type: entityType,
						id: entityId,
						name: '',
						relatedArticleIds: []
					};
				}
			}
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
		this.updateUrl({ immediate: true });
	}
};

// Effect to watch state changes and update URL
export function initializeUrlManager() {
	if (!browser) return;

	// Watch for state changes and update URL
	let previousView = appState.activeView;
	let previousViz = appState.activeVisualization;
	let previousEntity = appState.selectedEntity;
	let previousNode = appState.networkNodeSelected;

	const intervalMs = 200; // lower frequency than rAF to avoid flooding
	const handle = setInterval(() => {
		if (
			appState.activeView !== previousView ||
			appState.activeVisualization !== previousViz ||
			appState.selectedEntity !== previousEntity ||
			appState.networkNodeSelected !== previousNode
		) {
			urlManager.updateUrl();
			previousView = appState.activeView;
			previousViz = appState.activeVisualization;
			previousEntity = appState.selectedEntity;
			previousNode = appState.networkNodeSelected;
		}
	}, intervalMs);

	// Ensure we clean up if the page reloads; harmless if left running
	if (typeof window !== 'undefined') {
		window.addEventListener('beforeunload', () => clearInterval(handle));
	}
}

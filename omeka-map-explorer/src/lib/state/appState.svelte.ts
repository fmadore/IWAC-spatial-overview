import type { ProcessedItem } from '$lib/types';

interface AppState {
	loading: boolean;
	error: string | null;
	dataLoaded: boolean;
	activeView: 'dashboard' | 'map' | 'list' | 'stats';
	sidebarOpen: boolean;
	selectedItem: ProcessedItem | null;
	// Which visualization inside dashboard is active
	activeVisualization:
		| 'overview'
		| 'worldMap'
		| 'countryFocus'
		| 'persons'
		| 'organizations'
		| 'events'
		| 'subjects'
		| 'locations'
		| 'network';
	// Selected entity for filtering
	selectedEntity: {
		type: string;
		id: string;
		name: string;
		relatedArticleIds: string[];
	} | null;

	// Network view state
	networkNodeSelected?: { id: string } | null;
	networkLoaded?: boolean;
	networkRenderer: 'modular' | 'sigma';

	// Country Focus facets
	countryFocus?: {
		country: 'Benin' | 'Burkina Faso' | 'Cote_dIvoire' | 'Togo';
		level: 'regions' | 'prefectures';
		scaleType: 'quantile' | 'linear' | 'sqrt';
	} | null;

	// Full screen state
	isFullScreen: boolean;
}

export const appState = $state<AppState>({
	loading: true,
	error: null,
	dataLoaded: false,
	activeView: 'dashboard',
	sidebarOpen: true,
	selectedItem: null,
	activeVisualization: 'overview',
	selectedEntity: null,
	networkNodeSelected: null,
	networkLoaded: false,
	networkRenderer: 'sigma', // Default to new sigma.js implementation
	countryFocus: {
		country: 'Benin',
		level: 'regions',
		scaleType: 'quantile'
	},
	isFullScreen: false
});

export function setError(message: string) {
	appState.error = message;
	appState.loading = false;
}

export function setSelectedItem(item: ProcessedItem | null) {
	appState.selectedItem = item;
}

export function toggleFullScreen() {
	if (!document.fullscreenElement) {
		document.documentElement.requestFullscreen().then(() => {
			appState.isFullScreen = true;
		}).catch((err) => {
			console.error(`Error attempting to enable full-screen: ${err.message}`);
		});
	} else {
		document.exitFullscreen().then(() => {
			appState.isFullScreen = false;
		}).catch((err) => {
			console.error(`Error attempting to exit full-screen: ${err.message}`);
		});
	}
}

export function initFullScreenListener() {
	if (typeof document !== 'undefined') {
		const handleFullScreenChange = () => {
			appState.isFullScreen = !!document.fullscreenElement;
		};
		
		document.addEventListener('fullscreenchange', handleFullScreenChange);
		
		// Return cleanup function
		return () => {
			document.removeEventListener('fullscreenchange', handleFullScreenChange);
		};
	}
	return () => {};
}

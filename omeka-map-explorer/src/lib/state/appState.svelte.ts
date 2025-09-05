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
		| 'byCountry'
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

	// Country Focus facets
	countryFocus?: {
		country: 'Benin' | 'Burkina Faso' | 'Cote_dIvoire' | 'Togo';
		level: 'regions' | 'prefectures';
	} | null;
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
	countryFocus: {
		country: 'Benin',
		level: 'regions'
	}
});

export function setError(message: string) {
	appState.error = message;
	appState.loading = false;
}

export function setSelectedItem(item: ProcessedItem | null) {
	appState.selectedItem = item;
}

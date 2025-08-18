import type { ProcessedItem } from '$lib/types';

interface AppState {
  loading: boolean;
  error: string | null;
  dataLoaded: boolean;
  activeView: 'map' | 'list' | 'stats';
  sidebarOpen: boolean;
  selectedItem: ProcessedItem | null;
}

export const appState = $state<AppState>({
  loading: true,
  error: null,
  dataLoaded: false,
  activeView: 'map',
  sidebarOpen: true,
  selectedItem: null
});

export function setError(message: string) {
  appState.error = message;
  appState.loading = false;
}

export function setSelectedItem(item: ProcessedItem | null) {
  appState.selectedItem = item;
}

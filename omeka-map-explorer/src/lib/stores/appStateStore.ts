import { writable } from 'svelte/store';
import type { ProcessedItem } from '$lib/types';

interface AppState {
  loading: boolean;
  error: string | null;
  dataLoaded: boolean;
  activeView: 'map' | 'list' | 'stats';
  sidebarOpen: boolean;
  selectedItem: ProcessedItem | null;
}

export const appStateStore = writable<AppState>({
  loading: true,
  error: null,
  dataLoaded: false,
  activeView: 'map',
  sidebarOpen: true,
  selectedItem: null
}); 
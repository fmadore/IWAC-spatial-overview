import { browser } from '$app/environment';
import { appState } from '$lib/state/appState.svelte';
import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { get } from 'svelte/store';

type ViewType = 'dashboard' | 'map' | 'list' | 'stats';
type VisualizationType = 'overview' | 'byCountry' | 'persons' | 'organizations' | 'events' | 'subjects';

// URL management for navigation state using search parameters
export const urlManager = {
  // Update URL based on current state
  updateUrl() {
    if (!browser) return;
    
    const view = appState.activeView;
    const viz = appState.activeVisualization;
    
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
    
    // Build the URL
    const paramString = params.toString();
    const url = paramString ? `/?${paramString}` : '/';
    
    // Use goto to update URL without causing navigation
    goto(url, { replaceState: true, noScroll: true });
  },

  // Parse URL search parameters and update state
  parseUrlAndUpdateState(searchParams: URLSearchParams) {
    if (!browser) return;
    
    const view = searchParams.get('view') as ViewType;
    const viz = searchParams.get('viz') as VisualizationType;
    
    // Set view - default to dashboard
    if (view && ['dashboard', 'map', 'list', 'stats'].includes(view)) {
      appState.activeView = view;
    } else {
      appState.activeView = 'dashboard';
    }
    
    // Set visualization - default to overview
    if (viz && ['overview', 'byCountry', 'persons', 'organizations', 'events', 'subjects'].includes(viz)) {
      appState.activeVisualization = viz;
      
      // If byCountry is selected, ensure we're in map view
      if (viz === 'byCountry') {
        appState.activeView = 'map';
      }
    } else {
      appState.activeVisualization = 'overview';
    }
  },

  // Navigate to a specific view/visualization
  navigateTo(view: ViewType, visualization?: VisualizationType) {
    appState.activeView = view;
    if (visualization) {
      appState.activeVisualization = visualization;
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

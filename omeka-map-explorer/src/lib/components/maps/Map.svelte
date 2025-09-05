<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { mount } from 'svelte';
	import { mapData } from '$lib/state/mapData.svelte';
	import { timeData } from '$lib/state/timeData.svelte';
	import { filters } from '$lib/state/filters.svelte';
	import { getVisibleData } from '$lib/state/derived.svelte';
	import {
		loadGeoJson,
		loadWorldCountries,
		countItemsByCountryHybrid
	} from '$lib/api/geoJsonService';
	import {
		loadChoroplethCache,
		loadCoordinateCache,
		coordinateClustersToProcessedItems,
		isWorldMapCacheAvailable
	} from '$lib/api/worldMapCacheService';
	import { browser } from '$app/environment';
	import ChoroplethLayer from './ChoroplethLayer.svelte';
	import MapPopup from './MapPopup.svelte';
	import { appState } from '$lib/state/appState.svelte';
	import { urlManager } from '$lib/utils/urlManager.svelte';

	// Using any types here to avoid TypeScript errors with Leaflet
	let mapElement: HTMLDivElement;
	let map: any = $state(null);
	let layers: Record<string, any> = {};
	let L: any; // Will hold the Leaflet library when loaded
	let worldGeo: any = $state(null); // world countries geojson cache
	let choroplethData: Record<string, number> = $state({});
	let currentTileLayer: any = null; // Track current tile layer for switching
	
	// Cache optimization tracking
	let cacheAvailable = $state(false);
	let usingCachedData = $state(false);

	// Modern tile layer options
	const tileLayerOptions = {
		cartodb: {
			url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
			attribution: '© OpenStreetMap contributors © CARTO',
			subdomains: 'abcd',
			name: 'CartoDB Positron'
		},
		cartodbDark: {
			url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
			attribution: '© OpenStreetMap contributors © CARTO',
			subdomains: 'abcd',
			name: 'CartoDB Dark'
		},
		stamen: {
			url: 'https://stamen-tiles-{s}.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}{r}.png',
			attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.',
			subdomains: 'abcd',
			name: 'Stamen Toner Lite'
		},
		osm: {
			url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
			attribution: '© OpenStreetMap contributors',
			name: 'OpenStreetMap'
		}
	} as const;

	// Create optimized derived state for visible data
	// Skip expensive getVisibleData() when we can use cache
	const visibleData = $derived.by(() => {
		// For world view with minimal filtering, we can skip expensive computation
		// and let the cache service handle the filtering more efficiently
		const hasEntityFilter = appState.selectedEntity && appState.selectedEntity.relatedArticleIds?.length;
		const hasComplexFilters = filters.selected.keywords.length > 0 || 
			filters.selected.newspapers.length > 0;
		
		// If we have entity or complex filters, we need full filtering
		if (hasEntityFilter || hasComplexFilters) {
			console.log('Map: Using full getVisibleData() due to complex filters');
			return getVisibleData();
		}
		
		// For simple geographic/temporal filters, let cache service handle it
		// Return empty array - cache service will provide the filtered data
		console.log('Map: Skipping getVisibleData(), using cache-optimized filtering');
		return [];
	});

	// Loading state for better UX
	let mapLoading = $state(true);
	let dataLoading = $state(true);

	// Function definitions (moved to top to fix hoisting issues)
	
	// Handle map movement
	function handleMapMove() {
		if (!map) return;

		const center = map.getCenter();
		const zoom = map.getZoom();

		mapData.center = [center.lat, center.lng];
		mapData.zoom = zoom;
	}

	// Highlight a region on hover
	function highlightFeature(e: any) {
		const layer = e.target;

		layer.setStyle({
			weight: 3,
			color: '#666',
			dashArray: '',
			fillOpacity: 0.4
		});

		layer.bringToFront();
	}

	// Reset highlighting
	function resetHighlight(e: any) {
		const layer = e.target;
		layer.setStyle({
			weight: 2,
			color: '#3388ff',
			dashArray: '',
			fillOpacity: 0.1
		});
	}

	// Select a region
	function selectRegion(e: any) {
		const layer = e.target;
		const feature = layer.feature;
		
		if (feature && feature.properties) {
			console.log('Selected region:', feature.properties.name);
			// Could trigger region-specific filtering here
		}
	}

	// Update map for specific date
	function updateMapForDate(date: Date) {
		// Hook for date-driven updates (no-op)
	}

	// Update map for applied filters
	function updateMapForFilters(filters: any) {
		// Hook for filter-driven updates (no-op)
	}

	// Props
	let { height = '600px' } = $props();

	// Initialize map on mount
	onMount(() => {
		if (!browser) return undefined;
		let disposed = false;

		const actuallyInit = async () => {
			if (disposed) return;
			if (!mapElement || !mapElement.isConnected) {
				// wait for next frame if container not yet connected
				requestAnimationFrame(actuallyInit);
				return;
			}
			if (map) return; // already initialized

			// Dynamically import Leaflet only on the client side
			L = await import('leaflet');
			await import('leaflet/dist/leaflet.css');

			// Initialize the map first (fast)
			map = L.map(mapElement).setView(mapData.center, mapData.zoom);

			// Add modern tile layer - using CartoDB Positron for clean, modern look
			const tileOptions = tileLayerOptions.cartodb;
			const layerConfig: any = {
				attribution: tileOptions.attribution,
				maxZoom: 20
			};
			// Only add subdomains if it exists
			if ('subdomains' in tileOptions) {
				layerConfig.subdomains = tileOptions.subdomains;
			}
			currentTileLayer = L.tileLayer(tileOptions.url, layerConfig).addTo(map);

			// Add layer control for switching between tile layers
			const baseMaps: Record<string, any> = {};
			Object.entries(tileLayerOptions).forEach(([key, options]) => {
				if (key === 'cartodb') {
					baseMaps[options.name] = currentTileLayer;
				} else {
					const layerOptions: any = {
						attribution: options.attribution,
						maxZoom: 20
					};
					// Only add subdomains if it exists
					if ('subdomains' in options) {
						layerOptions.subdomains = options.subdomains;
					}
					baseMaps[options.name] = L.tileLayer(options.url, layerOptions);
				}
			});

			L.control.layers(baseMaps).addTo(map);

			// Setup event handlers
			map.on('moveend', handleMapMove);
			
			// Map is ready
			mapLoading = false;

			// Load data asynchronously after map is visible
			setTimeout(async () => {
				if (disposed) return;
				
				dataLoading = true;
				
				// Check if world map cache is available for performance optimization
				try {
					cacheAvailable = await isWorldMapCacheAvailable();
					if (cacheAvailable) {
						console.log('World map cache is available - using optimized data loading');
					}
				} catch (e) {
					console.warn('Could not check world map cache availability:', e);
					cacheAvailable = false;
				}
				
				// Try to preload world countries for choropleth
				try {
					worldGeo = await loadWorldCountries();
				} catch (e) {
					console.warn('World countries GeoJSON not available:', e);
				}

				// Load initial data
				await loadMapData();
				
				dataLoading = false;
			}, 100); // Small delay to let map render first
		};

		requestAnimationFrame(actuallyInit);

		return () => {
			disposed = true;
			if (map) {
				map.remove();
				map = null;
			}
		};
	});

	// Load map data based on current state
	async function loadMapData() {
		if (!map || !L) return;
		
		dataLoading = true;

		// Clear existing layers
		Object.entries(layers).forEach(([key, layer]) => {
			if (layer && typeof (layer as any).$destroy === 'function') {
				// Svelte component wrapper (e.g., ChoroplethLayer)
				try {
					(layer as any).$destroy();
				} catch {}
			} else if (layer && typeof (layer as any).remove === 'function') {
				// Leaflet layer
				try {
					(layer as any).remove();
				} catch {}
			} else if (layer && typeof (layer as any).eachLayer === 'function') {
				// LayerGroup - cleanup popup components
				try {
					(layer as any).eachLayer((childLayer: any) => {
						if (childLayer._popupComponent && typeof childLayer._popupComponent.unmount === 'function') {
							childLayer._popupComponent.unmount();
						}
					});
					(layer as any).remove();
				} catch {}
			} else if (map && typeof (layer as any) === 'object') {
				try {
					map.removeLayer(layer);
				} catch {}
			}
			delete (layers as any)[key];
		});
		layers = {};

		// Load GeoJSON data for selected country (outline) when not in choropleth mode
		if (mapData.selectedCountry && mapData.viewMode !== 'choropleth') {
			try {
				const geoJson = await loadGeoJson(mapData.selectedCountry, 'regions');

				// Cache the GeoJSON data
				mapData.geoData[mapData.selectedCountry as string] = geoJson;

				// Add GeoJSON layer
				const geoJsonLayer = L.geoJSON(geoJson, {
					style: () => ({
						color: '#3388ff',
						weight: 2,
						opacity: 0.8,
						fillOpacity: 0.1
					}),
					onEachFeature: (feature: any, layer: any) => {
						// Bind popup
						if (feature.properties && feature.properties.name) {
							layer.bindPopup(feature.properties.name);
						}

						// Add event handlers
						layer.on({
							mouseover: (e: any) => highlightFeature(e),
							mouseout: (e: any) => resetHighlight(e),
							click: (e: any) => selectRegion(e)
						});
					}
				}).addTo(map);

				layers['geoJson'] = geoJsonLayer;
			} catch (error) {
				console.error(`Error loading GeoJSON for ${mapData.selectedCountry}:`, error);
			}
		}

		// Choropleth is rendered by child component; skip adding Leaflet layers here
		if (mapData.viewMode === 'choropleth' && worldGeo) {
			// no-op - choropleth is handled by ChoroplethLayer component
			// Don't render bubbles in choropleth mode - only show colored countries
		} 
		
		// Only render bubbles when NOT in choropleth mode
		else if (visibleData.length > 0 || cacheAvailable) {
			let coordinateGroups: Map<string, { lat: number; lng: number; count: number; sample: any; items: any[]; name?: string }> | null = null;
			
			// Try to use cached coordinate clusters for better performance
			if (cacheAvailable) {
				try {
					// Build comprehensive cache options based on current filters
					const cacheOptions: {
						country?: string;
						countries?: string[];
						dateRange?: { start: Date; end: Date };
						year?: number;
						entityType?: string;
					} = {};
					
					// Add country filters for efficient cache filtering
					if (filters.selected.countries.length > 0) {
						cacheOptions.countries = filters.selected.countries;
					}
					
					// Add date range filter if present
					if (filters.selected.dateRange) {
						cacheOptions.dateRange = filters.selected.dateRange;
					}
					
					// Add entity filter
					if (appState.selectedEntity?.type) {
						const entityTypeMap: Record<string, string> = {
							'Personnes': 'persons',
							'Organisations': 'organizations',
							'Événements': 'events',
							'Sujets': 'subjects'
						};
						cacheOptions.entityType = entityTypeMap[appState.selectedEntity.type];
					}
					
					// Load cached coordinates with comprehensive filters
					const cachedClusters = await loadCoordinateCache(cacheOptions);
					if (cachedClusters && cachedClusters.length > 0) {
						console.log('✅ Using cached coordinate clusters for map markers with filters:', {
							clusters: cachedClusters.length,
							countries: cacheOptions.countries?.length || 'all',
							entityType: cacheOptions.entityType || 'none',
							dateRange: cacheOptions.dateRange ? 'yes' : 'no'
						});
						
						// Convert cached clusters to the expected format
						coordinateGroups = new Map();
						for (const cluster of cachedClusters) {
							const [lat, lng] = cluster.coordinates;
							const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
							
							coordinateGroups.set(key, {
								lat,
								lng,
								count: cluster.articleCount,
								sample: {
									id: cluster.id,
									title: cluster.label,
									country: cluster.country,
									placeLabel: cluster.label
								},
								items: [], // We don't have individual items for cached clusters
								name: cluster.label
							});
						}
						console.log(`Applied filters to cached clusters: ${coordinateGroups.size} remaining`);
					}
				} catch (e) {
					console.warn('Failed to load cached coordinates, falling back to real-time aggregation:', e);
					// coordinateGroups remains null - will trigger fallback below
				}
			}

			// Fall back to real-time aggregation if cache is not available or failed
			if (coordinateGroups === null && visibleData.length > 0) {
				console.log('⚠️ Falling back to real-time coordinate aggregation');
				// Aggregate items by coordinate and add circle markers sized by count (much fewer markers)
				coordinateGroups = new Map<string, { lat: number; lng: number; count: number; sample: any; items: any[]; name?: string }>();
				for (const item of visibleData) {
					if (!item.coordinates || item.coordinates.length === 0) continue;
					const [lat, lng] = item.coordinates[0]; // Each item now has exactly one coordinate
					if (lat == null || lng == null) continue;
					const key = `${lat.toFixed(4)},${lng.toFixed(4)}`; // merge nearby points
					const existing = coordinateGroups.get(key);
					if (existing) {
						existing.count += 1;
						existing.items.push(item);
				    // Prefer keeping the first discovered name; if missing, backfill
				    if (!existing.name && item.placeLabel) existing.name = item.placeLabel;
					} else {
				    coordinateGroups.set(key, { lat, lng, count: 1, sample: item, items: [item], name: item.placeLabel });
					}
				}
				console.log('Map: Aggregated coordinates in real-time:', coordinateGroups.size, 'groups from', visibleData.length, 'items');
			}

			// Only render markers if we have coordinate groups
			if (coordinateGroups !== null && coordinateGroups.size > 0) {
				const maxCount = Array.from(coordinateGroups.values()).reduce((m, g) => Math.max(m, g.count), 1);
				const canvas = L.canvas({ padding: 0.5 });
				const layerGroup = L.layerGroup();

				for (const g of coordinateGroups.values()) {
					// Radius: base + scaled by sqrt(count) to reduce disparity
					const radius = 6 + 8 * Math.sqrt(g.count / maxCount);
					
					// Modern gradient color based on count
					const intensity = Math.sqrt(g.count / maxCount);
					const hue = 220 - (intensity * 60); // Blue to purple gradient
					const saturation = 70 + (intensity * 20); // More saturated for higher counts
					const lightness = 55 - (intensity * 10); // Darker for higher counts
					
					const circle = L.circleMarker([g.lat, g.lng], {
						radius,
						color: `hsl(${hue}, ${saturation}%, ${lightness - 15}%)`,
						weight: 2,
						opacity: 0.9,
						fillOpacity: mapData.viewMode === 'choropleth' ? 0.8 : 0.7, // Higher opacity in choropleth mode
						fillColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
						renderer: canvas,
						className: 'modern-marker',
						// Ensure bubbles are interactive and on top
						interactive: true,
						pane: 'markerPane' // Higher z-index than choropleth
					});

					// Create a popup container
					const popupDiv = document.createElement('div');
					
					// Create and mount the Svelte component
					const popup = mount(MapPopup, {
						target: popupDiv,
						props: {
							group: g
						}
					});

					circle.bindPopup(popupDiv, {
						maxWidth: 400,
						minWidth: 300,
						closeButton: true,
						className: 'map-popup-wrapper'
					});

					// Store the component instance for cleanup
					circle._popupComponent = popup;

					circle.addTo(layerGroup);
				}

				layerGroup.addTo(map);
				layers['markers'] = layerGroup;
			}
		}
		
		dataLoading = false;
	}

	// Select an item
	function selectItem(item: any) {
		import('$lib/state/appState.svelte').then(({ appState }) => {
			appState.selectedItem = item;
		});
	}

	// Update map when stores change
	$effect(() => {
		if (browser && map && timeData.currentDate) {
			updateMapForDate(timeData.currentDate);
		}
	});

	$effect(() => {
		if (browser && map && filters.selected) {
			// Trigger map reload when filters change
			loadMapData();
		}
	});

	$effect(() => {
		if (browser && map && visibleData) {
			loadMapData();
		}
	});
	// Refresh when view mode changes
	$effect(() => {
		if (browser && map) {
			mapData.viewMode;
			loadMapData();
		}
	});

	// Debounced choropleth calculation to avoid excessive updates
	let choroplethUpdateTimeout: number | null = null;
	const CHOROPLETH_DEBOUNCE_MS = 100;

	// Compute choropleth data reactively for the child component
	$effect(() => {
		if (!browser || !worldGeo) return;
		if (mapData.viewMode !== 'choropleth') {
			choroplethData = {};
			return;
		}

		// Clear any pending timeout
		if (choroplethUpdateTimeout) {
			clearTimeout(choroplethUpdateTimeout);
		}

		// Debounce the update to avoid excessive calculations
		choroplethUpdateTimeout = setTimeout(async () => {
			let newData: Record<string, number> = {};
			usingCachedData = false;

		// Try to use cached data first for better performance
		if (cacheAvailable) {
			try {
				// Determine cache options based on current filters
				const cacheOptions: { 
					year?: number; 
					entityType?: string;
					countries?: string[];
					dateRange?: { start: Date; end: Date };
				} = {};
				
				// Check for entity filter
				if (appState.selectedEntity?.type) {
					// Map entity types to cache file names
					const entityTypeMap: Record<string, string> = {
						'Personnes': 'persons',
						'Organisations': 'organizations',
						'Événements': 'events',
						'Sujets': 'subjects'
					};
					cacheOptions.entityType = entityTypeMap[appState.selectedEntity.type];
				}
				
				// Add country filters for efficient cache filtering
				if (filters.selected.countries.length > 0) {
					cacheOptions.countries = filters.selected.countries;
				}
				
				// Add date range filter if present
				if (filters.selected.dateRange) {
					cacheOptions.dateRange = filters.selected.dateRange;
				}

				// Load cached data with comprehensive filters
				const cachedData = await loadChoroplethCache(cacheOptions);
				if (cachedData && Object.keys(cachedData).length > 0) {
					console.log('✅ Using cached choropleth data for world map with filters:', {
						countries: cacheOptions.countries?.length || 'all',
						entityType: cacheOptions.entityType || 'none',
						dateRange: cacheOptions.dateRange ? 'yes' : 'no'
					});
					
					newData = cachedData;
					usingCachedData = true;
				}
			} catch (e) {
				console.warn('Failed to load cached choropleth data:', e);
			}
		}			// Fall back to real-time calculation if cache is not available or failed
			if (!usingCachedData || Object.keys(newData).length === 0) {
				console.log('⚠️ Falling back to real-time choropleth calculation');
				// Use the filtered data from derived state that includes all filters
				newData = countItemsByCountryHybrid(visibleData, worldGeo);
				console.log('Map: Choropleth data calculated in real-time:', Object.keys(newData).length, 'countries');
			}

			choroplethData = newData;
			choroplethUpdateTimeout = null;
		}, CHOROPLETH_DEBOUNCE_MS);
	});
</script>

<div class="map-wrapper relative">
	<div
		class="map-container relative z-0"
		bind:this={mapElement}
		style="height: {height};"
		data-testid="map-container"
	></div>
	
	<!-- Loading overlays -->
	{#if mapLoading}
		<div class="absolute inset-0 bg-gray-50 flex items-center justify-center z-10">
			<div class="flex flex-col items-center gap-3">
				<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
				<p class="text-sm text-gray-600">Loading map...</p>
			</div>
		</div>
	{/if}
	
	{#if dataLoading && !mapLoading}
		<div class="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg z-20">
			<div class="flex items-center gap-2">
				<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
				<p class="text-xs text-gray-700">Loading data...</p>
			</div>
		</div>
	{/if}
	
	<!-- Cache optimization indicator -->
	{#if cacheAvailable && usingCachedData}
		<div class="absolute top-4 left-4 bg-green-100/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg z-20">
			<div class="flex items-center gap-2">
				<div class="w-2 h-2 bg-green-500 rounded-full"></div>
				<p class="text-xs text-green-800">Using cached data</p>
			</div>
		</div>
	{/if}
</div>

{#if browser && map && worldGeo && mapData.viewMode === 'choropleth'}
	<ChoroplethLayer
		{map}
		geoJson={worldGeo}
		data={choroplethData}
		scaleMode="log"
		on:selectRegion={(e) => {
			const name = e.detail?.region;
			if (!name) return;
			// Toggle single-country selection: click same country again to clear
			const current = filters.selected.countries;
			filters.selected.countries = current.length === 1 && current[0] === name ? [] : [name];
			// Ensure map remains in choropleth/worldMap context and reflect in URL
			appState.activeView = 'dashboard';
			appState.activeVisualization = 'worldMap';
			urlManager.updateUrl();
		}}
	/>
{/if}

<style>
	.map-wrapper {
		width: 100%;
	}

	.map-container {
		width: 100%;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	:global(.leaflet-container) {
		font-family: inherit;
		border-radius: 12px;
	}

	/* Modern control styling */
	:global(.leaflet-control-layers) {
		border-radius: 8px !important;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
		border: 1px solid rgba(255, 255, 255, 0.2) !important;
	}

	:global(.leaflet-control-zoom) {
		border: none !important;
		border-radius: 8px !important;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
	}

	:global(.leaflet-control-zoom a) {
		border-radius: 6px !important;
		border: 1px solid rgba(255, 255, 255, 0.2) !important;
		background: rgba(255, 255, 255, 0.9) !important;
		backdrop-filter: blur(8px) !important;
		color: #374151 !important;
		font-weight: 600 !important;
		transition: all 0.2s ease !important;
	}

	:global(.leaflet-control-zoom a:hover) {
		background: rgba(255, 255, 255, 1) !important;
		transform: scale(1.05) !important;
	}

	/* Popup styling */
	:global(.map-popup-wrapper .leaflet-popup-content-wrapper) {
		padding: 0;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(8px);
	}

	:global(.map-popup-wrapper .leaflet-popup-content) {
		margin: 0;
		padding: 0;
		width: auto !important;
	}

	:global(.map-popup-wrapper .leaflet-popup-tip) {
		background: white;
		border: 1px solid rgba(255, 255, 255, 0.2);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	/* Circle marker styling improvements */
	/* Only apply hover effects to our point markers, not polygons */
	:global(.modern-marker.leaflet-interactive) {
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
		transition: all 0.2s ease;
	}

	:global(.modern-marker.leaflet-interactive:hover) {
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
		transform: scale(1.1);
		z-index: 1000 !important;
	}

	/* Ensure markers stay on top in choropleth mode */
	:global(.leaflet-marker-pane) {
		z-index: 600 !important;
	}

	:global(.leaflet-popup-pane) {
		z-index: 700 !important;
	}

	:global(.leaflet-tooltip-pane) {
		z-index: 650 !important;
	}
</style>

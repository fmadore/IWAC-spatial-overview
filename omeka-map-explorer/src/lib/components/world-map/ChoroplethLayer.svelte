<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { scaleQuantize, scaleQuantile } from 'd3-scale';
	import { schemeBlues } from 'd3-scale-chromatic';
	import type { GeoJsonData, GeoJsonFeature } from '$lib/types';
	import { browser } from '$app/environment';

	// Props (runes mode)
	let {
		map,
		geoJson,
		data = {},
		colorRange = schemeBlues[7],
		scaleMode = 'log'
	} = $props<{
		map: any;
		geoJson: GeoJsonData;
		data?: Record<string, number>;
		colorRange?: string[];
		// 'log' | 'linear' | 'quantile'
		scaleMode?: 'log' | 'linear' | 'quantile';
	}>();

	// Local state - using any to avoid TypeScript errors with Leaflet
	let layer: any = null;
	let info: any = null;
	let legend: any = null;
	let L: any; // Will hold the Leaflet library when loaded

	// Create event dispatcher
	const dispatch = createEventDispatcher();

	// Derived color mapping function
	const colorScale = $derived.by(() => generateColorScale(data, colorRange, scaleMode));

	onMount(() => {
		if (!browser || !map || !geoJson) return undefined;

		const initMap = async () => {
			// Dynamically import Leaflet (ESM namespace)
			L = await import('leaflet');

			// Create layer first
			createLayer();

			// Add info control
			createInfoControl();

			// Add legend
			createLegendControl();

			// Force immediate update if data is available with longer timeout for production
			setTimeout(() => {
				if (Object.keys(data).length > 0) {
					console.log('ChoroplethLayer: Forcing initial style update');
					updateLayerStyles();
				}
			}, 300);
			
			// Also try immediate update
			if (Object.keys(data).length > 0) {
				requestAnimationFrame(() => {
					updateLayerStyles();
				});
			}
		};

		initMap();

		return () => {
			if (layer && map) {
				map.removeLayer(layer);
			}

			if (info && map) {
				info.remove();
			}

			if (legend && map) {
				legend.remove();
			}
		};
	});

	// Create choropleth layer
	function createLayer() {
		if (!L || !map || !geoJson) return;

		layer = L.geoJSON(geoJson, {
			style: (feature: any) => style(feature),
			onEachFeature: (feature: any, layer: any) => {
				layer.on({
					mouseover: highlightFeature,
					mouseout: resetHighlight,
					click: (e: any) => {
						// Close tooltip before opening popup to prevent duplication
						try {
							if (e.target && e.target.closeTooltip) e.target.closeTooltip();
						} catch {}
						zoomToFeature(e);
					}
				});

				// Bind a lightweight tooltip for quick glance info
				try {
					const name = feature?.properties?.name ?? 'Unknown';
					const count = Number.isFinite(data[name]) ? data[name] : 0;
					layer.bindTooltip(
						`<strong>${name}</strong><br/>${count} ${count === 1 ? 'article' : 'articles'}`,
						{ sticky: true, direction: 'auto', opacity: 0.95, className: 'choropleth-tooltip' }
					);
					// Ensure tooltip doesn't clash with popups
					layer.on('popupopen', () => {
						try { layer.closeTooltip(); } catch {}
					});
					layer.on('popupclose', () => {
						/* no-op; tooltip will show again on next hover */
					});
				} catch {}

				// Bind a popup with a bit more detail on click
				try {
					layer.bindPopup(() => {
						const name = feature?.properties?.name ?? 'Unknown';
						const count = Number.isFinite(data[name]) ? data[name] : 0;
						return `
							<div class="choropleth-popup">
								<h4>${name}</h4>
								<p><strong>${count}</strong> ${count === 1 ? 'article' : 'articles'}</p>
							</div>
						`;
					}, { maxWidth: 280, className: 'choropleth-popup-wrapper' });
				} catch {}
			},
			// Keep choropleth interactive but in a stable pane
			interactive: true
		}).addTo(map);
		
		// Remove any z-index manipulation that might cause issues
		// Let Leaflet handle the layer ordering naturally
		
		// Immediately apply styles if data is available
		if (Object.keys(data).length > 0) {
			// Try multiple approaches to ensure styling works in production
			requestAnimationFrame(() => updateLayerStyles());
			setTimeout(() => updateLayerStyles(), 0);
			setTimeout(() => updateLayerStyles(), 100);
			setTimeout(() => updateLayerStyles(), 300);
		}
	}

	// Create info control
	function createInfoControl() {
		if (!L || !map) return;

		info = new L.Control({ position: 'topright' });

		info.onAdd = function () {
			this._div = L.DomUtil.create('div', 'info');
			this.update();
			return this._div;
		};

		info.update = function (props?: any) {
			this._div.innerHTML =
				'<h4>Country Data</h4>' +
				(props
					? '<b>' + props.name + '</b><br />' + (data[props.name] || 0) + ' articles (including cities)'
					: 'Hover over a country');
		};

		info.addTo(map);
	}

	// Create legend control
	function createLegendControl() {
		if (!L || !map) return;

		const range = colorRange;
		const bins = computeLegendBins(data, range.length, scaleMode);

		legend = new L.Control({ position: 'bottomright' });

		legend.onAdd = function () {
			const div = L.DomUtil.create('div', 'info legend');
			let labels = [];

			// Generate labels and colors for legend
			for (let i = 0; i < bins.length; i++) {
				const b = bins[i];
				const from = formatLegendValue(b.from);
				const to = b.to != null ? formatLegendValue(b.to) : null;
				labels.push(
					'<i style="background:' +
						range[i] +
						'"></i> ' +
						from +
						(to !== null ? '&ndash;' + to : '+')
				);
			}

			div.innerHTML = labels.join('<br>');
			return div;
		};

		legend.addTo(map);
	}

	// Style function for regions
	function style(feature: GeoJsonFeature | any) {
		if (!feature.properties || !feature.properties.name) {
			return {
				fillColor: '#f0f0f0',
				weight: 1,
				opacity: 0.8,
				color: 'white',
				fillOpacity: 0.8
			};
		}

		const regionName = feature.properties.name;
		const value = data[regionName] || 0;
		const scale = colorScale;

		// Ensure we have a valid color even if scale fails
		let fillColor = '#f0f0f0';
		try {
			fillColor = scale(value);
		} catch (e) {
			console.warn('ChoroplethLayer: Color scale failed for', regionName, value, e);
			fillColor = value > 0 ? '#3182bd' : '#f0f0f0';
		}

		return {
			fillColor: fillColor,
			weight: 1,
			opacity: 0.8,
			color: 'white',
			fillOpacity: 0.8
		};
	}

	// Handle feature hover
	function highlightFeature(e: any) {
		if (!L) return;

		const layer = e.target;

		// Keep stroke width constant to avoid visual "jump"
		layer.setStyle({
			weight: 1,
			color: '#333',
			fillOpacity: 0.9
		});

		// Don't bring to front to prevent layer jumping
		// layer.bringToFront();

		if (info) {
			info.update(layer.feature.properties);
		}

		dispatch('highlightRegion', {
			region: layer.feature.properties.name
		});
	}

	// Reset highlight on mouseout
	function resetHighlight(e: any) {
		if (layer) {
			layer.resetStyle(e.target);
		}

		if (info) {
			info.update();
		}

		dispatch('resetHighlight', {
			region: e.target.feature.properties.name
		});
	}

	// Handle feature click
	function zoomToFeature(e: any) {
		map.fitBounds(e.target.getBounds());
		// Also open popup to show details
		if (e?.target && typeof e.target.openPopup === 'function') {
			e.target.openPopup();
		}

		dispatch('selectRegion', {
			region: e.target.feature.properties.name
		});
	}

	// Generate color scale based on data
	function generateColorScale(
		data: Record<string, number>,
		range: string[],
		mode: 'log' | 'linear' | 'quantile'
	) {
		const raw = Object.values(data).filter((v) => Number.isFinite(v) && v > 0);
		
		// If no data, return a default scale
		if (raw.length === 0) {
			return (v: number) => range[0] || '#f0f0f0';
		}

		if (mode === 'quantile') {
			const scale = scaleQuantile()
				.domain(raw)
				.range(range as string[]);
			return (v: number) => {
				if (!v || v <= 0) return range[0];
				return scale(v) as string;
			};
		}

		const transform = (v: number) => (mode === 'log' ? Math.log1p(v) : v);
		const values = raw.map(transform);
		const min = Math.min(...values);
		const max = Math.max(...values);
		
		// Handle case where min === max
		if (min === max) {
			return (v: number) => v > 0 ? range[Math.floor(range.length / 2)] : range[0];
		}
		
		const scale = scaleQuantize()
			.domain([min, max])
			.range(range as string[]);
			
		return (v: number) => {
			if (!v || v <= 0) return range[0];
			return scale(transform(v)) as string;
		};
	}

	function computeLegendBins(
		data: Record<string, number>,
		steps: number,
		mode: 'log' | 'linear' | 'quantile'
	) {
		const raw = Object.values(data)
			.filter((v) => Number.isFinite(v) && v >= 0)
			.sort((a, b) => a - b);
		if (raw.length === 0) {
			return Array.from({ length: steps }, (_, i) => ({ from: i / steps, to: (i + 1) / steps }));
		}
		if (mode === 'quantile') {
			const q = scaleQuantile()
				.domain(raw)
				.range(Array.from({ length: steps }, (_, i) => i));
			const thresholds = (q.quantiles ? q.quantiles() : []) as number[];
			const bins: { from: number; to: number | null }[] = [];
			let prev = raw[0];
			for (let i = 0; i < steps; i++) {
				const to = i < steps - 1 ? (thresholds[i] ?? null) : raw[raw.length - 1];
				bins.push({ from: prev, to: to });
				prev = to ?? prev;
			}
			return bins;
		}
		const transform = (v: number) => (mode === 'log' ? Math.log1p(v) : v);
		const invert = (t: number) => (mode === 'log' ? Math.expm1(t) : t);
		const tmin = transform(raw[0]);
		const tmax = transform(raw[raw.length - 1]);
		const bins: { from: number; to: number | null }[] = [];
		for (let i = 0; i < steps; i++) {
			const ft = tmin + ((tmax - tmin) / steps) * i;
			const tt = i < steps - 1 ? tmin + ((tmax - tmin) / steps) * (i + 1) : tmax;
			bins.push({ from: invert(ft), to: i < steps - 1 ? invert(tt) : null });
		}
		return bins;
	}

	function formatLegendValue(v?: number | null) {
		if (v == null || !Number.isFinite(v)) return '';
		if (v >= 1000) return Math.round(v).toLocaleString();
		if (v >= 10) return String(Math.round(v));
		return String(Math.round(v * 10) / 10);
	}

	// Watch for changes to data prop and update immediately
	$effect(() => {
		// Explicitly access data to ensure reactivity is triggered
		const currentData = data;
		if (layer && currentData) {
			// Always update when data changes, even if empty
			console.log('ChoroplethLayer: Data changed, updating styles. Keys:', Object.keys(currentData).length);
			// Use multiple timing strategies to ensure it works in production
			updateLayerStyles();
			requestAnimationFrame(() => updateLayerStyles());
			setTimeout(() => updateLayerStyles(), 0);
			setTimeout(() => updateLayerStyles(), 50);
		}
	});

	// Separate effect for browser and layer readiness
	$effect(() => {
		// Explicitly access data to ensure reactivity is triggered
		const currentData = data;
		if (browser && layer && currentData) {
			// Additional update when browser environment is confirmed ready
			console.log('ChoroplethLayer: Browser + layer ready, data keys:', Object.keys(currentData).length);
			requestAnimationFrame(() => updateLayerStyles());
			setTimeout(() => updateLayerStyles(), 100);
			setTimeout(() => updateLayerStyles(), 200);
		}
	});

	// Update layer with new data
	function updateLayerStyles() {
		if (!layer) return;

		console.log('ChoroplethLayer: Updating styles with data keys:', Object.keys(data).length);

		// Force re-style all features
		layer.eachLayer((featureLayer: any) => {
			if (featureLayer.feature) {
				const newStyle = style(featureLayer.feature);
				
				// Force aggressive style update by resetting and reapplying
				featureLayer.setStyle({
					fillColor: '#ffffff',
					fillOpacity: 0
				});
				
				// Apply new style immediately after reset
				setTimeout(() => {
					featureLayer.setStyle(newStyle);
				}, 1);

				// Update tooltip/popups with latest data
				try {
					const name = featureLayer.feature?.properties?.name ?? 'Unknown';
					const count = Number.isFinite(data[name]) ? data[name] : 0;
					const tooltipHtml = `<strong>${name}</strong><br/>${count} ${count === 1 ? 'article' : 'articles'}`;
					if (typeof featureLayer.setTooltipContent === 'function') {
						featureLayer.setTooltipContent(tooltipHtml);
					} else if (featureLayer.getTooltip && featureLayer.getTooltip()) {
						featureLayer.getTooltip().setContent(tooltipHtml);
					}

					const popupHtml = `
						<div class="choropleth-popup">
							<h4>${name}</h4>
							<p><strong>${count}</strong> ${count === 1 ? 'article' : 'articles'}</p>
						</div>`;
					if (typeof featureLayer.setPopupContent === 'function') {
						featureLayer.setPopupContent(popupHtml);
					} else if (featureLayer.getPopup && featureLayer.getPopup()) {
						featureLayer.getPopup().setContent(popupHtml);
					}
				} catch {}
			}
		});

		// Update legend
		if (legend && map && L) {
			legend.remove();
			createLegendControl();
		}
		
		// Force map to redraw/update
		if (map && map.invalidateSize) {
			setTimeout(() => {
				map.invalidateSize({ animate: false });
			}, 10);
		}
	}

	// Legacy update function for backward compatibility
	function updateLayer() {
		updateLayerStyles();
	}
</script>

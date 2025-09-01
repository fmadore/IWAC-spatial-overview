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
			// Dynamically import Leaflet
			L = (await import('leaflet')).default;

			// Create layer
			createLayer();

			// Add info control
			createInfoControl();

			// Add legend
			createLegendControl();
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
					click: zoomToFeature
				});
			}
		}).addTo(map);
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
				'<h4>Region Data</h4>' +
				(props
					? '<b>' + props.name + '</b><br />' + (data[props.name] || 0) + ' articles'
					: 'Hover over a region');
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
		if (!feature.properties || !feature.properties.name) return {};

		const regionName = feature.properties.name;
		const value = data[regionName] || 0;

		return {
			fillColor: colorScale(value),
			weight: 2,
			opacity: 1,
			color: 'white',
			dashArray: '3',
			fillOpacity: 0.7
		};
	}

	// Handle feature hover
	function highlightFeature(e: any) {
		if (!L) return;

		const layer = e.target;

		layer.setStyle({
			weight: 5,
			color: '#666',
			dashArray: '',
			fillOpacity: 0.7
		});

		if (L.Browser && !L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
			layer.bringToFront();
		}

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
		const raw = Object.values(data).filter((v) => Number.isFinite(v) && v >= 0);
		if (raw.length === 0) {
			const scale = scaleQuantize()
				.domain([0, 1])
				.range(range as string[]);
			return (v: number) => scale(v || 0) as string;
		}

		if (mode === 'quantile') {
			const scale = scaleQuantile()
				.domain(raw)
				.range(range as string[]);
			return (v: number) => scale(v || 0) as string;
		}

		const transform = (v: number) => (mode === 'log' ? Math.log1p(v) : v);
		const values = raw.map(transform);
		const min = Math.min(...values);
		const max = Math.max(...values);
		const scale = scaleQuantize()
			.domain([min, max])
			.range(range as string[]);
		return (v: number) => scale(transform(v || 0)) as string;
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

	// Update when data changes
	$effect(() => {
		if (browser && layer && data) updateLayer();
	});

	// Update layer with new data
	function updateLayer() {
		if (!layer) return;

		layer.setStyle(style);

		if (legend && map && L) {
			legend.remove();
			createLegendControl();
		}
	}
</script>

<style>
	:global(.info) {
		padding: 6px 8px;
		font:
			14px/16px Arial,
			Helvetica,
			sans-serif;
		background: white;
		background: rgba(255, 255, 255, 0.8);
		box-shadow: 0 0 15px rgba(0, 0, 0, 0.2);
		border-radius: 5px;
	}

	:global(.info h4) {
		margin: 0 0 5px;
		color: #777;
	}

	:global(.legend) {
		text-align: left;
		line-height: 18px;
		color: #555;
	}

	:global(.legend i) {
		width: 18px;
		height: 18px;
		float: left;
		margin-right: 8px;
		opacity: 0.7;
	}
</style>

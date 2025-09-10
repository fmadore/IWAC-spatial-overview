<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import type * as d3Cloud from 'd3-cloud';

	interface LocationWithCount {
		name: string;
		count: number;
	}

	interface WordData {
		text: string;
		size: number;
		count: number;
		x?: number;
		y?: number;
		rotate?: number;
	}

	interface Props {
		locations: string[];
		entityName: string;
	}

	let { locations, entityName }: Props = $props();

	let wordCloudContainer = $state<HTMLDivElement>();
	let resizeTimeout: number;

	// Count occurrences of each location
	const locationCounts = $derived.by(() => {
		const counts = new Map<string, number>();
		
		for (const location of locations) {
			const trimmed = location.trim();
			if (trimmed) {
				const existing = counts.get(trimmed) || 0;
				counts.set(trimmed, existing + 1);
			}
		}

		// Convert to array and sort by count (descending), then by name
		return Array.from(counts.entries())
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => {
				if (b.count !== a.count) {
					return b.count - a.count;
				}
				return a.name.localeCompare(b.name);
			});
	});

	const maxCount = $derived(Math.max(...locationCounts.map(l => l.count), 1));
	const minCount = $derived(Math.min(...locationCounts.map(l => l.count), 1));

	// Simple fallback rendering function
	const renderSimpleFallback = () => {
		if (!wordCloudContainer) return;
		
		wordCloudContainer.innerHTML = `
			<div class="flex flex-wrap gap-3 items-center justify-center text-center leading-relaxed">
				${locationCounts.map(({ name, count }) => {
					const fontSize = 14 + ((count - minCount) / Math.max(maxCount - minCount, 1)) * 24; // 14px to 38px
					const hue = 210;
					const saturation = 40 + ((count - minCount) / Math.max(maxCount - minCount, 1)) * 40;
					const lightness = 70 - ((count - minCount) / Math.max(maxCount - minCount, 1)) * 30;
					const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
					
					return `<span 
						class="inline-block font-medium transition-all hover:scale-110 cursor-default relative group"
						style="font-size: ${fontSize}px; color: ${color};"
						title="${name}: ${count} ${count === 1 ? 'mention' : 'mentions'}"
					>
						${name}
						<span class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
							${count} ${count === 1 ? 'mention' : 'mentions'}
						</span>
					</span>`;
				}).join('')}
			</div>
		`;
	};

	// Render word cloud using d3-cloud
	const renderWordCloud = async () => {
		if (!browser || !wordCloudContainer || locationCounts.length === 0) return;

		// Clear existing content
		wordCloudContainer.innerHTML = '';

		try {
			// Dynamic imports for d3 - try different import patterns
			const [d3Selection, d3Scale, cloud] = await Promise.all([
				import('d3-selection'),
				import('d3-scale'),
				import('d3-cloud')
			]);

			const d3 = d3Selection;
			
			// Try to access the scale functions - handle both default and named exports
			let scaleLinear, scaleOrdinal, schemeCategory10;
			
			if (d3Scale.default) {
				// Handle default export
				scaleLinear = d3Scale.default.scaleLinear || d3Scale.scaleLinear;
				scaleOrdinal = d3Scale.default.scaleOrdinal || d3Scale.scaleOrdinal;
				schemeCategory10 = d3Scale.default.schemeCategory10 || d3Scale.schemeCategory10;
			} else {
				// Handle named exports
				scaleLinear = d3Scale.scaleLinear;
				scaleOrdinal = d3Scale.scaleOrdinal;
				schemeCategory10 = d3Scale.schemeCategory10;
			}
			
			// If we still don't have the functions, fall back to simple implementation
			if (!scaleLinear || !scaleOrdinal || !schemeCategory10) {
				console.log('D3 scale functions not available, using fallback');
				renderSimpleFallback();
				return;
			}

			// Container dimensions
			const containerRect = wordCloudContainer.getBoundingClientRect();
			const width = Math.max(containerRect.width, 400);
			const height = Math.max(400, width * 0.6);

			// Font size scale
			const fontScale = scaleLinear()
				.domain([minCount, maxCount])
				.range([14, 48]);

			// Color scale
			const colorScale = scaleOrdinal(schemeCategory10);

			// Prepare word data
			const words: WordData[] = locationCounts.map(({ name, count }) => ({
				text: name,
				size: fontScale(count),
				count: count
			}));

			// Create SVG
			const svg = d3.select(wordCloudContainer)
				.append('svg')
				.attr('width', width)
				.attr('height', height);

			const g = svg.append('g')
				.attr('transform', `translate(${width / 2},${height / 2})`);

			// Create word cloud layout
			const layout = cloud.default<WordData>()
				.size([width, height])
				.words(words)
				.padding(5)
				.rotate(() => ~~(Math.random() * 2) * 90)
				.font('Arial')
				.fontSize((d: WordData) => d.size)
				.on('end', (words: WordData[]) => {
					g.selectAll('text')
						.data(words)
						.enter().append('text')
						.style('font-size', (d: WordData) => `${d.size}px`)
						.style('font-family', 'Arial')
						.style('fill', (d: WordData, i: number) => colorScale(i.toString()))
						.style('cursor', 'default')
						.attr('text-anchor', 'middle')
						.attr('transform', (d: WordData) => `translate(${d.x},${d.y})rotate(${d.rotate})`)
						.text((d: WordData) => d.text)
						.append('title')
						.text((d: WordData) => `${d.text}: ${d.count} ${d.count === 1 ? 'mention' : 'mentions'}`);
				});

			// Start the layout
			layout.start();

		} catch (error) {
			console.error('Error rendering word cloud:', error);
			// Fallback to simple styled text
			renderSimpleFallback();
		}
	};

	// Handle window resize with debouncing
	const handleResize = () => {
		if (resizeTimeout) clearTimeout(resizeTimeout);
		resizeTimeout = setTimeout(renderWordCloud, 250);
	};

	// Re-render when location data changes
	$effect(() => {
		if (locationCounts.length > 0) {
			renderWordCloud();
		}
	});

	onMount(() => {
		if (browser) {
			window.addEventListener('resize', handleResize);
			return () => {
				window.removeEventListener('resize', handleResize);
				if (resizeTimeout) clearTimeout(resizeTimeout);
			};
		}
	});
</script>

{#if locationCounts.length > 0}
	<Card>
		<CardHeader>
			<CardTitle>Mentioned Locations ({locationCounts.length})</CardTitle>
		</CardHeader>
		<CardContent>
			<div bind:this={wordCloudContainer} class="w-full min-h-[400px] flex items-center justify-center">
				<!-- Word cloud will be rendered here -->
			</div>
			
			<!-- Legend -->
			<div class="mt-4 pt-4 border-t border-muted text-xs text-muted-foreground text-center">
				<div class="flex items-center justify-center gap-4">
					<span>Size = frequency</span>
					<span>•</span>
					<span>Color intensity = popularity</span>
					<span>•</span>
					<span>Hover for exact counts</span>
				</div>
			</div>
		</CardContent>
	</Card>
{/if}

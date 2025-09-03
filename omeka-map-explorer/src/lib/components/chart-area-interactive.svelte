<script lang="ts">
	import { onMount } from 'svelte';
	import { timeData } from '$lib/state/timeData.svelte';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';

	let container: HTMLDivElement;
	let svgEl: SVGSVGElement;
	let gAxisX: SVGGElement;
	let gAxisY: SVGGElement;
	let pathEl: SVGPathElement;
	let overlayEl: SVGRectElement;

	// Lazy D3 module fns (typed as any for simplicity)
	let scaleTime: any, scaleLinear: any, axisBottom: any, axisLeft: any, area: any, curveMonotoneX: any, extent: any, bisector: any, select: any;
	// timeFormat factory is assigned after lazy import and used in markup; make it reactive to avoid warnings
	let timeFormatFn = $state<any>(null);

	// Layout state
	const margin = { top: 8, right: 12, bottom: 24, left: 40 };
		const dims = $state({ width: 0, height: 0, cw: 0, ch: 0 });

	// Derived render data
		let areaPath = $state<string>('');
		let yMax = $state<number>(0);

	// Hover state
	const hover = $state<{ x: number; y: number; date: Date | null; count: number | null; ix: number }>(
		{ x: 0, y: 0, date: null, count: null, ix: -1 }
	);

		onMount(() => {
			// Lazy-load D3 modules
			(async () => {
				const [scaleMod, selMod, axisMod, shapeMod, arrayMod, fmtMod] = await Promise.all([
					import('d3-scale'),
					import('d3-selection'),
					import('d3-axis'),
					import('d3-shape'),
					import('d3-array'),
					import('d3-time-format')
				]).catch(() => [null, null, null, null, null, null]);

				if (!scaleMod || !selMod || !axisMod || !shapeMod || !arrayMod) return;
				scaleTime = scaleMod.scaleTime; scaleLinear = scaleMod.scaleLinear;
				select = selMod.select;
				axisBottom = axisMod.axisBottom; axisLeft = axisMod.axisLeft;
				area = shapeMod.area; curveMonotoneX = shapeMod.curveMonotoneX;
				extent = arrayMod.extent; bisector = arrayMod.bisector;
				timeFormatFn = fmtMod?.timeFormat ?? ((s: string) => () => s);
				updateSize();
			})();

			// Observe size
			const ro = new ResizeObserver(() => updateSize());
			if (container) ro.observe(container);
			return () => ro.disconnect();
		});

	function updateSize() {
		if (!container) return;
		const r = container.getBoundingClientRect();
		dims.width = Math.max(0, r.width);
		dims.height = Math.max(0, r.height);
		dims.cw = Math.max(0, dims.width - margin.left - margin.right);
		dims.ch = Math.max(0, dims.height - margin.top - margin.bottom);
		render();
	}

	function getDataSorted() {
		const arr = (timeData.data ?? []).slice();
		arr.sort((a, b) => a.date.getTime() - b.date.getTime());
		// Optional: filter by range
		const { start, end } = timeData.range;
		return arr.filter((d) => d.date >= start && d.date <= end);
	}

	function render() {
		if (!svgEl || !select || !scaleTime || dims.cw <= 0 || dims.ch <= 0) return;
		const data = getDataSorted();
		const x = scaleTime().range([0, dims.cw]);
		const y = scaleLinear().range([dims.ch, 0]).nice();
		const xDomain = data.length ? [data[0].date, data[data.length - 1].date] : [timeData.range.start, timeData.range.end];
		x.domain(xDomain);
		yMax = Math.max(1, data.reduce((m, d) => Math.max(m, d.count), 0));
		y.domain([0, yMax]);

		// Axes
		if (gAxisX) select(gAxisX).call(axisBottom(x));
		if (gAxisY) select(gAxisY).call(axisLeft(y).ticks(5));

		// Area path
		const gen = area()
			.curve(curveMonotoneX)
			.x((d: any) => x(d.date))
			.y0(dims.ch)
			.y1((d: any) => y(d.count));
		areaPath = data.length ? gen(data) : '';

		// Update hover (keep within bounds)
		if (hover.ix >= 0 && hover.ix < data.length) {
			const d = data[hover.ix];
			hover.x = margin.left + x(d.date);
			hover.y = margin.top + y(d.count);
		}
	}

	function onPointerMove(e: PointerEvent) {
		const data = getDataSorted();
		if (!data.length) return;
		const pt = svgEl.getBoundingClientRect();
		const sx = e.clientX - pt.left - margin.left; // chart space
		const clampedX = Math.max(0, Math.min(dims.cw, sx));
		const x = scaleTime().range([0, dims.cw]).domain([data[0].date, data[data.length - 1].date]);
		const xDate = x.invert(clampedX);
		const b = bisector((d: any) => d.date).center;
		const ix = b(data as any, xDate);
		const d = data[ix];
		hover.ix = ix;
		hover.date = d.date;
		hover.count = d.count;
		hover.x = margin.left + x(d.date);
		hover.y = margin.top + (scaleLinear().range([dims.ch, 0]).domain([0, yMax])(d.count));
	}

	function onPointerLeave() {
		hover.ix = -1;
		hover.date = null;
		hover.count = null;
	}

	// Re-render when timeline state changes
	$effect(() => {
		// react to range and data changes
		void timeData.range.start;
		void timeData.range.end;
		void timeData.data;
		render();
	});
</script>

<Card>
	<CardHeader>
		<CardTitle>Timeline</CardTitle>
	</CardHeader>
	<CardContent>
			<div bind:this={container} class="relative h-56 w-full rounded-md border bg-muted/40">
				<svg bind:this={svgEl} class="w-full h-full" width={dims.width} height={dims.height} onpointermove={onPointerMove} onpointerleave={onPointerLeave}>
				<defs>
					<linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
						<stop offset="0%" stop-color="hsl(var(--primary))" stop-opacity="0.35" />
						<stop offset="100%" stop-color="hsl(var(--primary))" stop-opacity="0.05" />
					</linearGradient>
				</defs>
				<g transform={`translate(${margin.left},${margin.top})`}>
					<g bind:this={gAxisX} transform={`translate(0,${dims.ch})`} class="text-xs text-muted-foreground"></g>
					<g bind:this={gAxisY} class="text-xs text-muted-foreground"></g>
					<path bind:this={pathEl} d={areaPath} fill="url(#areaGrad)" stroke="hsl(var(--primary))" stroke-width="1.5" />

					{#if hover.ix >= 0}
						<line x1={hover.x - margin.left} x2={hover.x - margin.left} y1={0} y2={dims.ch} class="stroke-foreground/30" />
						<circle cx={hover.x - margin.left} cy={hover.y - margin.top} r="3" class="fill-background stroke-foreground/80" />
					{/if}
				</g>
			</svg>
	    {#if hover.ix >= 0 && hover.date}
				<div class="pointer-events-none absolute px-2 py-1 text-xs rounded bg-background/90 border shadow" style={`transform: translate(${hover.x + 8}px, ${hover.y + 8}px);`}>
		    <div class="font-medium">{(timeFormatFn && hover.date) ? timeFormatFn('%Y-%m-%d')(hover.date) : String(hover.date)}</div>
					<div class="text-muted-foreground">{hover.count} articles</div>
				</div>
			{/if}
		</div>
	</CardContent>
</Card>

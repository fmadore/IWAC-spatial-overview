<script lang="ts">
	import { MapPin, FileText, Globe } from 'lucide-svelte';

	interface RegionData {
		name: string;
		count: number;
		country: string;
		adminLevel: string; // 'regions' or 'prefectures'
		bounds?: [number, number][];
	}

	let { regionData }: { regionData: RegionData } = $props();

	function formatAdminLevel(level: string): string {
		return level === 'prefectures' ? 'Prefecture' : 'Region';
	}

	function formatCountryName(countryName: string): string {
		if (countryName === 'Cote_dIvoire') return "Côte d'Ivoire";
		return countryName;
	}

	// Get simple, direct text - just show count, no redundant text
	const articleText = $derived(() => {
		if (regionData.count === 0) return 'No articles found';
		if (regionData.count === 1) return 'Found in 1 article';
		return `Found in ${regionData.count} articles`;
	});

	const intensityColor = $derived(() => {
		if (regionData.count === 0) return 'text-gray-400';
		if (regionData.count < 5) return 'text-blue-500';
		if (regionData.count < 20) return 'text-blue-600';
		if (regionData.count < 50) return 'text-blue-700';
		return 'text-blue-800';
	});
</script>

<div
	class="choropleth-popup min-w-80 max-w-sm p-4"
	role="dialog"
	aria-label="Region details"
	tabindex="0"
	onclick={(e) => e.stopPropagation()}
	onmousedown={(e) => e.stopPropagation()}
	onmouseup={(e) => e.stopPropagation()}
	onkeydown={(e) => { 
		if (['Enter', ' '].includes(e.key)) e.stopPropagation(); 
	}}
>
	<!-- Region title -->
	<div class="border-b pb-3 mb-3">
		<h3 class="font-semibold text-lg text-foreground mb-2 flex items-center gap-2 leading-tight">
			<MapPin class="h-5 w-5 text-primary" />
			{regionData.name}
		</h3>
		
		<!-- Admin level and country -->
		<div class="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
			<Globe class="h-4 w-4" />
			<span class="font-medium">
				{formatAdminLevel(regionData.adminLevel)} in {formatCountryName(regionData.country)}
			</span>
		</div>
	</div>

	<!-- Article count -->
	<div class="flex items-center gap-3">
		<FileText class="h-5 w-5 text-muted-foreground" />
		<div class="flex-1">
			<div class="font-semibold text-xl {intensityColor()}">
				{regionData.count}
			</div>
			<div class="text-sm text-muted-foreground">
				{articleText()}
			</div>
		</div>
	</div>
</div>

<style>
	.choropleth-popup {
		font-family: inherit;
		background: white;
		border-radius: 6px;
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
	}
</style>

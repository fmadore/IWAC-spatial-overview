<script lang="ts">
	import { filters } from '$lib/state/filters.svelte';
	import { Label } from '$lib/components/ui/label';
	import { RadioGroup, RadioGroupItem } from '$lib/components/ui/radio-group';
	import { urlManager } from '$lib/utils/urlManager.svelte';

	// Props using Svelte 5 runes - using callback props instead of events
	let { 
		countries = [], 
		selected = [],
		onChange
	} = $props<{ 
		countries?: string[]; 
		selected?: string[];
		onChange?: (countries: string[]) => void;
	}>();

	// Only allow these countries (fixed order)
	const allowedCountries = ['Benin', 'Burkina Faso', "Côte d'Ivoire", 'Togo'];
	
	// Intersect available countries with allowed list; if none provided, fall back to allowed
	const countryList = $derived.by(() =>
		countries?.length ? allowedCountries.filter((c) => countries.includes(c)) : allowedCountries
	);

	// Current selection: either empty (all), or single country
	const currentSelection = $derived(
		filters.selected.countries.length === 0 ? 'all' : filters.selected.countries[0]
	);

	// All options including "All countries"
	const allOptions = $derived([
		{ value: 'all', label: 'All countries' },
		...countryList.map(country => ({ value: country, label: country }))
	]);

	function selectCountry(value: string) {
		if (value === 'all') {
			filters.selected.countries = [];
		} else {
			filters.selected.countries = [value];
		}
		
		// Call callback prop if provided
		onChange?.(filters.selected.countries);
		
		// Update URL
		urlManager.updateUrl();
	}
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between">
		<Label class="text-sm font-medium">Country Focus</Label>
		<div class="text-xs text-muted-foreground">
			{currentSelection === 'all' ? 'All countries' : currentSelection}
		</div>
	</div>
	
	<RadioGroup value={currentSelection} onValueChange={selectCountry} class="space-y-2">
		{#each allOptions as option (option.value)}
			<div class="flex items-center space-x-2">
				<RadioGroupItem value={option.value} id={option.value} />
				<Label for={option.value} class="text-sm font-normal cursor-pointer">
					{option.label}
				</Label>
			</div>
		{/each}
	</RadioGroup>
	
	<div class="text-xs text-muted-foreground leading-relaxed">
		<p>Select a specific country to view articles from that country, or "All countries" to see global coverage.</p>
	</div>
</div>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { filters } from '$lib/state/filters.svelte';
	import { Label } from '$lib/components/ui/label';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { RadioGroup, RadioGroupItem } from '$lib/components/ui/radio-group';

	// Props (read-only); selection relies on global filters state
	let { countries = [], selected = [] } = $props<{ countries?: string[]; selected?: string[] }>();

	// Event dispatcher (optional for parent listeners)
	const dispatch = createEventDispatcher();

	// Only allow these countries (fixed order)
	const allowedCountries = ['Benin', 'Burkina Faso', "Côte d'Ivoire", 'Togo'];
	// Intersect available countries with allowed list; if none provided, fall back to allowed
	const countryList = $derived.by<string[]>(() =>
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
		dispatch('change', { countries: filters.selected.countries });
		import('$lib/utils/urlManager.svelte').then(({ urlManager }) => urlManager.updateUrl());
	}
</script>

<Card class="w-full">
	<CardHeader class="pb-3">
		<div class="flex items-center justify-between">
			<CardTitle class="text-base font-medium">Country Focus</CardTitle>
			<div class="text-xs text-muted-foreground">
				{currentSelection === 'all' ? 'All countries' : currentSelection}
			</div>
		</div>
	</CardHeader>
	<CardContent class="pt-0">
		<div class="space-y-3">
			<Label class="text-sm font-medium">Select Country</Label>
			
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
		</div>
		
		<div class="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
			<p>Select a specific country to view articles from that country, or "All countries" to see global coverage.</p>
		</div>
	</CardContent>
</Card>

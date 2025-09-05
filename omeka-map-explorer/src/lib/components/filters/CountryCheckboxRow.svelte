<script lang="ts">
	import { filters } from '$lib/state/filters.svelte';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';

	let { name } = $props<{ name: string }>();

	// Drive UI directly from global filters
	const isChecked = $derived.by<boolean>(() => filters.selected.countries.includes(name));

	function toggle() {
		const list = filters.selected.countries;
		filters.selected.countries = isChecked ? list.filter((c) => c !== name) : [...list, name];
		// Push to URL immediately for deep-linking
		import('$lib/utils/urlManager.svelte').then(({ urlManager }) => urlManager.updateUrl());
	}

	function idFor(country: string) {
		return `country-${country.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`;
	}
</script>

<button
	type="button"
	class="flex items-center gap-2 w-full text-left"
	role="checkbox"
	aria-checked={isChecked}
	onclick={toggle}
	onkeydown={(e) => {
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			toggle();
		}
	}}
>
	<Checkbox id={idFor(name)} checked={isChecked} aria-checked={isChecked} />
	<Label for={idFor(name)} class="cursor-pointer">{name}</Label>
</button>

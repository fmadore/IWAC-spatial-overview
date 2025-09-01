interface FilterAvailable {
	countries: string[];
	regions: Record<string, string[]>;
	newspapers: string[];
	dateRange: { min: Date; max: Date };
}
interface FilterSelected {
	countries: string[];
	regions: string[];
	newspapers: string[];
	dateRange: { start: Date; end: Date } | null;
	keywords: string[];
}

export const filters = $state<{ available: FilterAvailable; selected: FilterSelected }>({
	available: {
		countries: [],
		regions: {},
		newspapers: [],
		dateRange: {
			min: new Date('1900-01-01'),
			max: new Date('2023-12-31')
		}
	},
	selected: {
		countries: [],
		regions: [],
		newspapers: [],
		dateRange: null,
		keywords: []
	}
});

export function clearFilters() {
	filters.selected.countries = [];
	filters.selected.regions = [];
	filters.selected.newspapers = [];
	filters.selected.dateRange = null;
	filters.selected.keywords = [];
}

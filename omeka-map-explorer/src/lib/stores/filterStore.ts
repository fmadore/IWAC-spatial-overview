import { writable } from 'svelte/store';

interface FilterState {
  available: {
    countries: string[];
    regions: Record<string, string[]>;
    newspapers: string[];
    dateRange: {
      min: Date;
      max: Date;
    };
  };
  selected: {
    countries: string[];
    regions: string[];
    newspapers: string[];
    dateRange: { start: Date; end: Date } | null;
    keywords: string[];
  };
}

export const filterStore = writable<FilterState>({
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
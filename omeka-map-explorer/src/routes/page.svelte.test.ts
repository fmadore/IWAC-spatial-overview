import { describe, test, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/svelte';

// Mock SvelteKit runtime pieces used by the page so rendering works in Vitest
vi.mock('$app/environment', () => ({ browser: true, dev: true, building: false }));
vi.mock('$app/paths', () => ({ base: '', assets: '' }));
vi.mock('$app/stores', async () => {
	const { readable } = await import('svelte/store');
	const url = new URL('http://localhost/');
	return {
		page: readable({ url }),
		navigating: readable(null),
		updated: { subscribe: readable(false).subscribe }
	} as any;
});

// Avoid network/file fetches by stubbing data loaders used in +page.svelte
vi.mock('$lib/utils/staticDataLoader', () => ({
	loadStaticData: async () => ({
		items: [],
		timeline: [],
		countries: [],
		newspapers: [],
		dateMin: null,
		dateMax: null
	})
}));
vi.mock('$lib/utils/entityLoader', () => ({
	preloadAllEntities: async () => ({ persons: [], organizations: [], events: [], subjects: [], locations: [] }),
	loadEntities: async () => [],
	loadLocations: async () => []
}));

import Page from './+page.svelte';

describe('/+page.svelte', () => {
	test('should render h1', () => {
			render(Page);
			// There can be multiple H1 (sr-only page heading + loading state); assert at least one exists
			expect(screen.getAllByRole('heading', { level: 1 }).length).toBeGreaterThanOrEqual(1);
	});
});

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

// Mock Sigma.js library to prevent WebGL context issues in tests
vi.mock('sigma', () => ({
	default: vi.fn().mockImplementation(() => ({
		getGraph: vi.fn(() => ({
			addNode: vi.fn(),
			addEdge: vi.fn(),
			clear: vi.fn(),
			forEachNode: vi.fn(),
			forEachEdge: vi.fn(),
			order: 0,
			size: 0
		})),
		getCamera: vi.fn(() => ({
			getState: vi.fn(() => ({ x: 0, y: 0, ratio: 1 })),
			setState: vi.fn(),
			on: vi.fn(),
			animatedReset: vi.fn(),
			animatedZoom: vi.fn()
		})),
		on: vi.fn(),
		off: vi.fn(),
		kill: vi.fn(),
		refresh: vi.fn(),
		resize: vi.fn(),
		setSetting: vi.fn(),
		getSetting: vi.fn()
	}))
}));

// Mock Graphology
vi.mock('graphology', () => ({
	default: vi.fn().mockImplementation(() => ({
		addNode: vi.fn(),
		addEdge: vi.fn(),
		clear: vi.fn(),
		forEachNode: vi.fn(),
		forEachEdge: vi.fn(),
		order: 0,
		size: 0
	}))
}));

// Mock ForceAtlas2 layout
vi.mock('graphology-layout-forceatlas2', () => ({
	default: {
		assign: vi.fn()
	}
}));

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

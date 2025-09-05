import { describe, test, expect, beforeEach, vi } from 'vitest';

// Declare mocks first (hoisted) BEFORE importing the module under test
const hoisted = vi.hoisted(() => ({
	goto: vi.fn()
}));

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$app/navigation', () => ({ goto: hoisted.goto }));
vi.mock('$app/paths', () => ({ base: '/IWAC-spatial-overview' }));

import { urlManager } from './urlManager.svelte';
import { appState } from '$lib/state/appState.svelte';
import { mapData } from '$lib/state/mapData.svelte';
import { filters } from '$lib/state/filters.svelte';

describe('URL Manager', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		// Reset state
		appState.activeView = 'dashboard';
		appState.activeVisualization = 'overview';
		appState.selectedEntity = null;
		appState.networkNodeSelected = null;
		mapData.persons = [];
		mapData.organizations = [] as any;
		mapData.events = [] as any;
		mapData.subjects = [] as any;
		filters.selected.countries = [];
		filters.selected.dateRange = null as any;
		hoisted.goto.mockClear();
	});

	test('navigateTo excludes entity params when going to overview', () => {
		// Start from an entity-selected state
		appState.activeView = 'dashboard';
		appState.activeVisualization = 'persons';
		appState.selectedEntity = { type: 'Personnes', id: '123', name: 'Alice', relatedArticleIds: [] };

		// Navigate to overview using the helper (should update immediately)
		urlManager.navigateTo('dashboard', 'overview');

		const calls = hoisted.goto.mock.calls.map((c) => c[0] as string);
		const last = calls[calls.length - 1];
		expect(last).toMatch(/\/IWAC-spatial-overview\/?(\?|$)/);
		expect(last).not.toContain('entityType=');
		expect(last).not.toContain('entityId=');
		// And state should reflect overview
		expect(appState.activeVisualization).toBe('overview');
	});

	test('updateUrl includes countries only on worldMap viz', () => {
		// Not on worldMap -> should NOT include countries
		filters.selected.countries = ['Benin', "Côte d'Ivoire"]; // includes diacritics and apostrophe
		urlManager.updateUrl();
		vi.runAllTimers();
		let calls = hoisted.goto.mock.calls.map((c) => c[0] as string);
		let last = calls[calls.length - 1];
		let u = new URL('http://x' + last);
		expect(u.searchParams.get('countries')).toBeNull();

		// Switch to worldMap -> now include countries
		hoisted.goto.mockClear();
		appState.activeView = 'dashboard';
		appState.activeVisualization = 'worldMap';
		urlManager.updateUrl();
		vi.runAllTimers();
		calls = hoisted.goto.mock.calls.map((c) => c[0] as string);
		last = calls[calls.length - 1];
		u = new URL('http://x' + last);
		expect(u.searchParams.get('countries')).toBe("Benin,Côte d'Ivoire");
	});

	test('updateUrl includes years only on worldMap viz', () => {
		filters.selected.dateRange = { start: new Date(1905, 0, 1), end: new Date(1912, 11, 31) } as any;
		// Not on worldMap -> excluded
		urlManager.updateUrl();
		vi.runAllTimers();
		let calls = hoisted.goto.mock.calls.map((c) => c[0] as string);
		let last = calls[calls.length - 1];
		let u = new URL('http://x' + last);
		expect(u.searchParams.get('years')).toBeNull();

		// On worldMap -> included
		hoisted.goto.mockClear();
		appState.activeView = 'dashboard';
		appState.activeVisualization = 'worldMap';
		urlManager.updateUrl();
		vi.runAllTimers();
		calls = hoisted.goto.mock.calls.map((c) => c[0] as string);
		last = calls[calls.length - 1];
		u = new URL('http://x' + last);
		expect(u.searchParams.get('years')).toBe('1905-1912');
	});

	test('parse countries and years into filters only when viz=worldMap', () => {
		// Without viz=worldMap -> should not apply
		let params = new URLSearchParams(
			'countries=Benin%2CBurkina%20Faso%2CC%C3%B4te%20d%27Ivoire&years=1901-1910'
		);
		urlManager.parseUrlAndUpdateState(params);
		expect(filters.selected.countries).toEqual([]);
		expect(filters.selected.dateRange).toBeNull();

		// With viz=worldMap -> should apply and stay in dashboard view
		params = new URLSearchParams(
			'viz=worldMap&countries=Benin%2CBurkina%20Faso%2CC%C3%B4te%20d%27Ivoire&years=1901-1910'
		);
		urlManager.parseUrlAndUpdateState(params);
		expect(appState.activeView).toBe('dashboard');
		expect(appState.activeVisualization).toBe('worldMap');
		expect(filters.selected.countries).toEqual([
			'Benin',
			'Burkina Faso',
			"Côte d'Ivoire"
		]);
		expect(filters.selected.dateRange?.start.getFullYear()).toBe(1901);
		expect(filters.selected.dateRange?.end.getFullYear()).toBe(1910);
	});

	test('switching from worldMap with countries to persons clears facets and excludes them from URL', () => {
		// Start on worldMap with a country selected
		appState.activeView = 'dashboard';
		appState.activeVisualization = 'worldMap';
		filters.selected.countries = ['Burkina Faso'];
		urlManager.updateUrl();
		vi.runAllTimers();
		let calls = hoisted.goto.mock.calls.map((c) => c[0] as string);
		let last = calls[calls.length - 1];
		let u = new URL('http://x' + last);
		expect(u.searchParams.get('countries')).toBe('Burkina Faso');

		// Now simulate clicking Persons
		hoisted.goto.mockClear();
		urlManager.navigateTo('dashboard', 'persons');
		calls = hoisted.goto.mock.calls.map((c) => c[0] as string);
		last = calls[calls.length - 1];
		u = new URL('http://x' + last);
		expect(u.searchParams.get('viz')).toBe('persons');
		expect(u.searchParams.get('countries')).toBeNull();
		expect(u.searchParams.get('years')).toBeNull();
		expect(filters.selected.countries).toEqual([]);
	});

	test('parse empty params -> dashboard/overview', () => {
		urlManager.parseUrlAndUpdateState(new URLSearchParams());
		expect(appState.activeView).toBe('dashboard');
		expect(appState.activeVisualization).toBe('overview');
	});

	test('parse dashboard view + worldMap stays in dashboard', () => {
		urlManager.parseUrlAndUpdateState(new URLSearchParams('viz=worldMap'));
		expect(appState.activeView).toBe('dashboard');
		expect(appState.activeVisualization).toBe('worldMap');
	});

	test('parse organizations viz + entity hydrates selection', () => {
		mapData.organizations = [
			{ id: '789', name: 'Agence Bénin Presse', relatedArticleIds: ['1','2'], articleCount: 2 }
		] as any;
		urlManager.parseUrlAndUpdateState(
			new URLSearchParams('viz=organizations&entityType=Organisations&entityId=789')
		);
		expect(appState.activeVisualization).toBe('organizations');
		expect(appState.selectedEntity?.id).toBe('789');
		expect(appState.selectedEntity?.relatedArticleIds).toEqual(['1','2']);
	});

	test('entity params are ignored when not on an entity viz', () => {
		urlManager.parseUrlAndUpdateState(
			new URLSearchParams('viz=overview&entityType=Organisations&entityId=789')
		);
		expect(appState.activeVisualization).toBe('overview');
		expect(appState.selectedEntity).toBeNull();
	});

	test('updateUrl includes Country Focus facets only on countryFocus viz', () => {
		// Set Country Focus facets
		appState.countryFocus = { country: 'Burkina Faso', level: 'prefectures', scaleType: 'linear' };
		
		// Not on countryFocus -> should NOT include facets
		urlManager.updateUrl();
		vi.runAllTimers();
		let calls = hoisted.goto.mock.calls.map((c) => c[0] as string);
		let last = calls[calls.length - 1];
		let u = new URL('http://x' + last);
		expect(u.searchParams.get('focusCountry')).toBeNull();
		expect(u.searchParams.get('focusLevel')).toBeNull();

		// Switch to countryFocus -> now include facets
		hoisted.goto.mockClear();
		appState.activeView = 'dashboard';
		appState.activeVisualization = 'countryFocus';
		urlManager.updateUrl();
		vi.runAllTimers();
		calls = hoisted.goto.mock.calls.map((c) => c[0] as string);
		last = calls[calls.length - 1];
		u = new URL('http://x' + last);
		expect(u.searchParams.get('focusCountry')).toBe('Burkina Faso');
		expect(u.searchParams.get('focusLevel')).toBe('prefectures');
		expect(u.searchParams.get('focusScale')).toBe('linear');
	});

	test('updateUrl excludes default Country Focus facets', () => {
		// Set default values -> should not appear in URL
		appState.activeView = 'dashboard';
		appState.activeVisualization = 'countryFocus';
		appState.countryFocus = { country: 'Benin', level: 'regions', scaleType: 'quantile' };
		urlManager.updateUrl();
		vi.runAllTimers();
		const calls = hoisted.goto.mock.calls.map((c) => c[0] as string);
		const last = calls[calls.length - 1];
		const u = new URL('http://x' + last);
		expect(u.searchParams.get('focusCountry')).toBeNull();
		expect(u.searchParams.get('focusLevel')).toBeNull();
		expect(u.searchParams.get('focusScale')).toBeNull();
		expect(last).toContain('viz=countryFocus');
	});

	test('parse Country Focus facets into state only when viz=countryFocus', () => {
		// Without viz=countryFocus -> should not apply
		let params = new URLSearchParams('focusCountry=Togo&focusLevel=prefectures');
		urlManager.parseUrlAndUpdateState(params);
		expect(appState.countryFocus?.country).toBe('Benin'); // default
		expect(appState.countryFocus?.level).toBe('regions'); // default

		// With viz=countryFocus -> should apply
		params = new URLSearchParams('viz=countryFocus&focusCountry=Togo&focusLevel=prefectures');
		urlManager.parseUrlAndUpdateState(params);
		expect(appState.activeVisualization).toBe('countryFocus');
		expect(appState.countryFocus?.country).toBe('Togo');
		expect(appState.countryFocus?.level).toBe('prefectures');
	});

	test('switching from countryFocus with facets to overview clears facets and excludes them from URL', () => {
		// Start on countryFocus with non-default facets
		appState.activeView = 'dashboard';
		appState.activeVisualization = 'countryFocus';
		appState.countryFocus = { country: 'Togo', level: 'prefectures', scaleType: 'sqrt' };
		urlManager.updateUrl();
		vi.runAllTimers();
		let calls = hoisted.goto.mock.calls.map((c) => c[0] as string);
		let last = calls[calls.length - 1];
		let u = new URL('http://x' + last);
		expect(u.searchParams.get('focusCountry')).toBe('Togo');
		expect(u.searchParams.get('focusLevel')).toBe('prefectures');
		expect(u.searchParams.get('focusScale')).toBe('sqrt');

		// Now simulate clicking Overview
		hoisted.goto.mockClear();
		urlManager.navigateTo('dashboard', 'overview');
		calls = hoisted.goto.mock.calls.map((c) => c[0] as string);
		last = calls[calls.length - 1];
		u = new URL('http://x' + last);
		expect(u.searchParams.get('viz')).toBeNull(); // overview is default
		expect(u.searchParams.get('focusCountry')).toBeNull();
		expect(u.searchParams.get('focusLevel')).toBeNull();
		expect(appState.countryFocus?.country).toBe('Benin'); // reset to default
		expect(appState.countryFocus?.level).toBe('regions'); // reset to default
	});

	test('updateUrl excludes entity params when switching to worldMap', () => {
		appState.activeView = 'dashboard';
		appState.activeVisualization = 'organizations';
		appState.selectedEntity = { type: 'Organisations', id: '789', name: 'X', relatedArticleIds: [] };
		urlManager.updateUrl();
		vi.runAllTimers();

		// Switch to dashboard/worldMap
		appState.activeView = 'dashboard';
		appState.activeVisualization = 'worldMap';
		urlManager.updateUrl();
		vi.runAllTimers();

		const calls = hoisted.goto.mock.calls.map((c) => c[0] as string);
		const last = calls[calls.length - 1];
		expect(last).toContain('/IWAC-spatial-overview/?');
		expect(last).not.toContain('entityType=');
		expect(last).toContain('viz=worldMap');
	});
});

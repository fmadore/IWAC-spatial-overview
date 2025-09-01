import { describe, test, expect, beforeEach, vi } from 'vitest';
import { urlManager } from '$lib/utils/urlManager.svelte';
import { appState } from '$lib/state/appState.svelte';

// Mock browser environment
vi.mock('$app/environment', () => ({
	browser: true
}));

// Mock goto function
const mockGoto = vi.fn();
vi.mock('$app/navigation', () => ({
	goto: mockGoto
}));

describe('URL Manager', () => {
	beforeEach(() => {
		// Reset state before each test
		appState.activeView = 'dashboard';
		appState.activeVisualization = 'overview';
		mockGoto.mockClear();
	});

	test('should parse empty search params correctly', () => {
		const params = new URLSearchParams();
		urlManager.parseUrlAndUpdateState(params);
		expect(appState.activeView).toBe('dashboard');
		expect(appState.activeVisualization).toBe('overview');
	});

	test('should parse map view correctly', () => {
		const params = new URLSearchParams('?view=map&viz=byCountry');
		urlManager.parseUrlAndUpdateState(params);
		expect(appState.activeView).toBe('map');
		expect(appState.activeVisualization).toBe('byCountry');
	});

	test('should parse persons visualization correctly', () => {
		const params = new URLSearchParams('?viz=persons');
		urlManager.parseUrlAndUpdateState(params);
		expect(appState.activeView).toBe('dashboard');
		expect(appState.activeVisualization).toBe('persons');
	});

	test('should parse organizations visualization correctly', () => {
		const params = new URLSearchParams('?viz=organizations');
		urlManager.parseUrlAndUpdateState(params);
		expect(appState.activeView).toBe('dashboard');
		expect(appState.activeVisualization).toBe('organizations');
	});

	test('should parse events visualization correctly', () => {
		const params = new URLSearchParams('?viz=events');
		urlManager.parseUrlAndUpdateState(params);
		expect(appState.activeView).toBe('dashboard');
		expect(appState.activeVisualization).toBe('events');
	});

	test('should parse subjects visualization correctly', () => {
		const params = new URLSearchParams('?viz=subjects');
		urlManager.parseUrlAndUpdateState(params);
		expect(appState.activeView).toBe('dashboard');
		expect(appState.activeVisualization).toBe('subjects');
	});

	test('should handle byCountry viz by setting map view', () => {
		const params = new URLSearchParams('?viz=byCountry');
		urlManager.parseUrlAndUpdateState(params);
		expect(appState.activeView).toBe('map');
		expect(appState.activeVisualization).toBe('byCountry');
	});

	test('should handle invalid parameters by defaulting to dashboard overview', () => {
		const params = new URLSearchParams('?view=invalid&viz=invalid');
		urlManager.parseUrlAndUpdateState(params);
		expect(appState.activeView).toBe('dashboard');
		expect(appState.activeVisualization).toBe('overview');
	});

	test('should navigate to map view and update URL', () => {
		urlManager.navigateTo('map', 'byCountry');
		expect(appState.activeView).toBe('map');
		expect(appState.activeVisualization).toBe('byCountry');
		expect(mockGoto).toHaveBeenCalledWith('/?view=map&viz=byCountry', {
			replaceState: true,
			noScroll: true
		});
	});

	test('should navigate to dashboard visualization and update URL', () => {
		urlManager.navigateTo('dashboard', 'persons');
		expect(appState.activeView).toBe('dashboard');
		expect(appState.activeVisualization).toBe('persons');
		expect(mockGoto).toHaveBeenCalledWith('/?viz=persons', { replaceState: true, noScroll: true });
	});

	test('should navigate to default state with minimal URL', () => {
		urlManager.navigateTo('dashboard', 'overview');
		expect(appState.activeView).toBe('dashboard');
		expect(appState.activeVisualization).toBe('overview');
		expect(mockGoto).toHaveBeenCalledWith('/', { replaceState: true, noScroll: true });
	});
});

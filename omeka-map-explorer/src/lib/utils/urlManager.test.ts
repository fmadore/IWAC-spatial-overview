import { describe, test, expect, beforeEach, vi } from 'vitest';
import { urlManager } from './urlManager.svelte';
import { appState } from '$lib/state/appState.svelte';
import { mapData } from '$lib/state/mapData.svelte';

// Mocks
vi.mock('$app/environment', () => ({ browser: true }));
const mockGoto = vi.fn();
vi.mock('$app/navigation', () => ({ goto: mockGoto }));
vi.mock('$app/paths', () => ({ base: '/IWAC-spatial-overview' }));

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
		mockGoto.mockClear();
	});

	test('parse empty params -> dashboard/overview', () => {
		urlManager.parseUrlAndUpdateState(new URLSearchParams());
		expect(appState.activeView).toBe('dashboard');
		expect(appState.activeVisualization).toBe('overview');
	});

	test('parse map view + byCountry sets map', () => {
		urlManager.parseUrlAndUpdateState(new URLSearchParams('view=map&viz=byCountry'));
		expect(appState.activeView).toBe('map');
		expect(appState.activeVisualization).toBe('byCountry');
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

	test('updateUrl excludes entity params when switching to byCountry', () => {
		appState.activeView = 'dashboard';
		appState.activeVisualization = 'organizations';
		appState.selectedEntity = { type: 'Organisations', id: '789', name: 'X', relatedArticleIds: [] };
		urlManager.updateUrl();
		vi.runAllTimers();

		// Switch to map/byCountry
		appState.activeView = 'map';
		appState.activeVisualization = 'byCountry';
		urlManager.updateUrl();
		vi.runAllTimers();

		const calls = mockGoto.mock.calls.map((c) => c[0] as string);
		const last = calls[calls.length - 1];
		expect(last).toContain('/IWAC-spatial-overview/?');
		expect(last).not.toContain('entityType=');
		expect(last).toContain('viz=byCountry');
	});
});

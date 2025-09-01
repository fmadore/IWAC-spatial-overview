/**
 * Performance utilities for cache management and optimization
 */

import { clearPlacesMapCache } from './staticDataLoader';
import { clearVisibleDataCache } from '../state/derived.svelte';
import { clearChoroplethCache } from '../api/geoJsonService';
import { clearEntityCache } from './entityLoader';

/**
 * Clear all performance caches
 * Use this when data has been updated or for debugging performance issues
 */
export function clearAllCaches() {
	clearPlacesMapCache();
	clearVisibleDataCache(); 
	clearChoroplethCache();
	clearEntityCache();
	console.log('All performance caches cleared');
}

/**
 * Get cache status for debugging
 */
export function getCacheStatus() {
	return {
		timestamp: new Date().toISOString(),
		message: 'Performance caches are active - check console for cache hit/miss messages'
	};
}

/**
 * Performance monitoring wrapper
 */
export function withPerformanceLogging<T>(name: string, fn: () => T): T {
	const start = performance.now();
	const result = fn();
	const end = performance.now();
	console.log(`[PERF] ${name}: ${(end - start).toFixed(2)}ms`);
	return result;
}

/**
 * Performance monitoring wrapper for async functions
 */
export async function withAsyncPerformanceLogging<T>(name: string, fn: () => Promise<T>): Promise<T> {
	const start = performance.now();
	const result = await fn();
	const end = performance.now();
	console.log(`[PERF] ${name}: ${(end - start).toFixed(2)}ms`);
	return result;
}

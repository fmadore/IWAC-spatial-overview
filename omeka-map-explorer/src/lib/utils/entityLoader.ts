/**
 * Lazy entity loader - loads entity data only when requested
 * This provides better performance by not loading all entities upfront
 */

type EntityType = 'persons' | 'organizations' | 'events' | 'subjects';

interface Entity {
	id: string;
	name: string;
	relatedArticleIds: string[];
}

// Cache for loaded entities
const entityCache = new Map<EntityType, Entity[]>();

/**
 * Load entities of a specific type
 */
export async function loadEntities(type: EntityType, basePath = 'data'): Promise<Entity[]> {
	// Return cached data if available
	if (entityCache.has(type)) {
		return entityCache.get(type)!;
	}

	try {
		const response = await fetch(`${basePath}/entities/${type}.json`);
		if (!response.ok) {
			console.warn(`Failed to load ${type}: ${response.statusText}`);
			return [];
		}

		const entities: Entity[] = await response.json();
		entityCache.set(type, entities);
		return entities;
	} catch (error) {
		console.error(`Error loading ${type}:`, error);
		return [];
	}
}

/**
 * Preload all entity types (for dashboard overview)
 */
export async function preloadAllEntities(basePath = 'data'): Promise<{
	persons: Entity[];
	organizations: Entity[];
	events: Entity[];
	subjects: Entity[];
}> {
	const [persons, organizations, events, subjects] = await Promise.all([
		loadEntities('persons', basePath),
		loadEntities('organizations', basePath),
		loadEntities('events', basePath),
		loadEntities('subjects', basePath)
	]);

	return { persons, organizations, events, subjects };
}

/**
 * Get entity count without loading full data (for statistics)
 */
export async function getEntityCount(type: EntityType, basePath = 'data'): Promise<number> {
	const entities = await loadEntities(type, basePath);
	return entities.length;
}

/**
 * Search entities by name
 */
export async function searchEntities(
	type: EntityType,
	query: string,
	basePath = 'data'
): Promise<Entity[]> {
	const entities = await loadEntities(type, basePath);
	const lowercaseQuery = query.toLowerCase();

	return entities.filter((entity) => entity.name.toLowerCase().includes(lowercaseQuery));
}

/**
 * Clear entity cache (useful for testing or cache invalidation)
 */
export function clearEntityCache() {
	entityCache.clear();
}

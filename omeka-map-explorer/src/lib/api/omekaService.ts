import axios from 'axios';
import type { OmekaItem } from '$lib/types';

// Configuration
const API_CONFIG = {
  baseURL: import.meta.env.VITE_OMEKA_BASE_URL || '',
  keyIdentity: import.meta.env.VITE_OMEKA_KEY_IDENTITY || '',
  keyCredential: import.meta.env.VITE_OMEKA_KEY_CREDENTIAL || '',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
};

// Create axios instance
const api = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
});

// Cache implementation
const cache = {
  items: new Map<string, any>(),
  itemSets: new Map<string, any>(),
  coordinates: new Map<string, any>(),
  
  // Cache methods
  getItem(id: string) {
    return this.items.get(id);
  },
  setItem(id: string, data: any) {
    this.items.set(id, {
      data,
      timestamp: Date.now()
    });
  },
  getItemSet(id: string) {
    return this.itemSets.get(id);
  },
  setItemSet(id: string, data: any) {
    this.itemSets.set(id, {
      data,
      timestamp: Date.now()
    });
  },
  getCoordinates(url: string) {
    return this.coordinates.get(url);
  },
  setCoordinates(url: string, data: any) {
    this.coordinates.set(url, {
      data,
      timestamp: Date.now()
    });
  },
  clearCache() {
    this.items.clear();
    this.itemSets.clear();
    this.coordinates.clear();
  },
  clearExpired(expiryTime = 3600000) {
    const now = Date.now();
    
    this.items.forEach((value, key) => {
      if (now - value.timestamp > expiryTime) {
        this.items.delete(key);
      }
    });
    
    this.itemSets.forEach((value, key) => {
      if (now - value.timestamp > expiryTime) {
        this.itemSets.delete(key);
      }
    });
    
    this.coordinates.forEach((value, key) => {
      if (now - value.timestamp > expiryTime) {
        this.coordinates.delete(key);
      }
    });
  }
};

/**
 * Fetch all item sets
 * @returns Promise<Array> - Array of item sets
 */
export async function fetchItemSets() {
  try {
    const cachedData = cache.getItemSet('all');
    if (cachedData) {
      return cachedData.data;
    }
    
    const response = await api.get('/item_sets', {
      params: {
        key_identity: API_CONFIG.keyIdentity,
        key_credential: API_CONFIG.keyCredential
      }
    });
    
    cache.setItemSet('all', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching item sets:', error);
    throw error;
  }
}

/**
 * Fetch items from a specific item set
 * @param itemSetId - ID of the item set
 * @returns Promise<Array> - Array of items
 */
export async function fetchItemsFromSet(itemSetId: number | string) {
  try {
    const cachedData = cache.getItemSet(`set_${itemSetId}`);
    if (cachedData) {
      return cachedData.data;
    }
    
    const response = await api.get('/items', {
      params: {
        key_identity: API_CONFIG.keyIdentity,
        key_credential: API_CONFIG.keyCredential,
        item_set_id: itemSetId
      }
    });
    
    cache.setItemSet(`set_${itemSetId}`, response.data);
    return response.data;
  } catch (error) {
    console.error(`Error fetching items from set ${itemSetId}:`, error);
    throw error;
  }
}

/**
 * Extract coordinates from a spatial URL or value
 * @param spatialUrl - URL or value containing spatial data
 * @returns Promise<Array|null> - Array of [lat, lng] coordinates or null
 */
export async function fetchCoordinates(spatialUrl: string) {
  try {
    const cachedData = cache.getCoordinates(spatialUrl);
    if (cachedData) {
      return cachedData.data;
    }
    
    // This is a placeholder for actual implementation
    // In a real app, this would parse the response from the spatial URL
    // or use a geocoding service
    
    // Mock implementation for the roadmap
    const mockCoordinates = [10.0, 0.0];
    cache.setCoordinates(spatialUrl, mockCoordinates);
    return mockCoordinates;
  } catch (error) {
    console.error(`Error fetching coordinates from ${spatialUrl}:`, error);
    return null;
  }
}

/**
 * Extract coordinates from an Omeka item
 * @param item - Omeka item object
 * @returns Promise<Array|null> - Array of [lat, lng] coordinates or null
 */
export async function extractCoordinates(item: OmekaItem) {
  if (!item["dcterms:spatial"] || !item["dcterms:spatial"].length) {
    return null;
  }
  
  for (const spatial of item["dcterms:spatial"]) {
    if (spatial["@id"]) {
      const coordinates = await fetchCoordinates(spatial["@id"]);
      if (coordinates) {
        return [coordinates]; // Array of coordinates
      }
    } else if (spatial["@value"]) {
      // Try to parse coordinates from the value
      // This is a placeholder implementation
      return null;
    }
  }
  
  return null;
}

/**
 * Extract publication date from an Omeka item
 * @param item - Omeka item object
 * @returns Date|null - Publication date or null
 */
export function extractPublicationDate(item: OmekaItem) {
  if (!item["dcterms:date"] || !item["dcterms:date"].length) {
    return null;
  }
  
  for (const date of item["dcterms:date"]) {
    if (date["@value"]) {
      try {
        return new Date(date["@value"]);
      } catch (error) {
        console.error(`Error parsing date ${date["@value"]}:`, error);
      }
    }
  }
  
  return null;
}

/**
 * Extract newspaper title from an Omeka item
 * @param item - Omeka item object
 * @returns string - Newspaper title or empty string
 */
export function extractNewspaperTitle(item: OmekaItem) {
  // This is a placeholder implementation
  // In a real app, this would extract the newspaper title from a specific field
  
  if (item["dcterms:title"] && item["dcterms:title"].length) {
    return item["dcterms:title"][0]["@value"] || "";
  }
  
  return "";
} 
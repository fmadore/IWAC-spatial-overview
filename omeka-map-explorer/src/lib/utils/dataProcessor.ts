import type { OmekaItem, ProcessedItem, TemporalData } from '$lib/types';
import { extractCoordinates, extractPublicationDate, extractNewspaperTitle } from '$lib/api/omekaService';

/**
 * Process raw items from Omeka S API
 * @param {Array<OmekaItem>} items - Raw items from API
 * @param {string} country - Country name
 * @returns {Promise<Array<ProcessedItem>>} - Processed items
 */
export async function processItems(items: OmekaItem[], country: string): Promise<ProcessedItem[]> {
  const processed: ProcessedItem[] = [];
  
  for (const item of items) {
    try {
      // Extract basic metadata
      const title = extractTitle(item);
      const publishDate = extractPublicationDate(item);
      const coordinates = await extractCoordinates(item);
      const newspaperSource = extractNewspaperSource(item);
      const keywords = extractKeywords(item);
      
      if (publishDate && coordinates && coordinates.length > 0) {
        const processedItem: ProcessedItem = {
          id: item.id,
          title,
          publishDate,
          coordinates,
          country,
          region: null, // Will be populated later
          prefecture: null, // Will be populated later
          newspaperSource,
          keywords
        };
        
        processed.push(processedItem);
      }
    } catch (error) {
      console.error('Error processing item:', error);
    }
  }
  
  return processed;
}

/**
 * Group processed items by time period
 * @param {Array<ProcessedItem>} items - Processed items
 * @param {string} groupBy - 'day', 'month', or 'year'
 * @returns {Array<TemporalData>} - Items grouped by time period
 */
export function groupItemsByTime(items: ProcessedItem[], groupBy = 'month'): TemporalData[] {
  const grouped: Record<string, TemporalData> = {};
  
  items.forEach(item => {
    if (!item.publishDate) return;
    
    const date = new Date(item.publishDate);
    let key: string;
    
    if (groupBy === 'day') {
      key = date.toISOString().substring(0, 10); // YYYY-MM-DD
    } else if (groupBy === 'month') {
      key = date.toISOString().substring(0, 7); // YYYY-MM
    } else {
      key = date.getFullYear().toString(); // YYYY
    }
    
    if (!grouped[key]) {
      grouped[key] = {
        date: new Date(date),
        count: 0,
        items: []
      };
    }
    
    grouped[key].count++;
    grouped[key].items.push(item);
  });
  
  // Convert to array and sort by date
  return Object.values(grouped).sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Extract title from an Omeka item
 * @param {OmekaItem} item - Omeka item
 * @returns {string} - Title
 */
function extractTitle(item: OmekaItem): string {
  if (item["dcterms:title"] && item["dcterms:title"].length > 0) {
    return item["dcterms:title"][0]["@value"] || item.title || "Untitled";
  }
  return item.title || "Untitled";
}

/**
 * Extract newspaper source from an Omeka item
 * @param {OmekaItem} item - Omeka item
 * @returns {string} - Newspaper source
 */
function extractNewspaperSource(item: OmekaItem): string {
  // This is a placeholder implementation
  // In a real app, this would extract from a specific field
  return extractNewspaperTitle(item) || "Unknown";
}

/**
 * Extract keywords from an Omeka item
 * @param {OmekaItem} item - Omeka item
 * @returns {Array<string>} - Keywords
 */
function extractKeywords(item: OmekaItem): string[] {
  // This is a placeholder implementation
  // In a real app, this would extract from a specific field like dcterms:subject
  return [];
} 
import type { ProcessedItem, TemporalData } from '$lib/types';

type ArticleRow = {
  'o:id': string;
  title: string;
  newspaper: string;
  country: string;
  pub_date: string; // YYYY-MM-DD
  subject: string; // pipe-separated
  spatial: string; // pipe-separated of place labels
};

type IndexRow = {
  'o:id': number | null;
  Titre: string;
  Type: string; // e.g., 'Lieux'
  Coordonnées: string; // e.g., "lat, lon" or similar
  Country?: string; // Pre-computed country name from add_countries.py script
};

type LoadedData = {
  items: ProcessedItem[];
  timeline: TemporalData[];
  countries: string[];
  newspapers: string[];
  dateMin: Date | null;
  dateMax: Date | null;
  places: IndexRow[]; // Raw places data for choropleth counting
};

function parsePipeList(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .split('|')
    .map((t) => t.trim())
    .filter(Boolean);
}

function isValidDate(d: Date): boolean {
  return !isNaN(d.getTime());
}

function parseCoordPair(s: string): [number, number] | null {
  // Accept formats like "lat, lon", "lon, lat", "lat lon"
  const cleaned = s.replace(/[()\[\]]/g, ' ').replace(/;|\s+/g, ' ').replace(/\s+/g, ' ').trim();
  const commaSplit = s.split(',');
  let a: number | null = null;
  let b: number | null = null;
  if (commaSplit.length >= 2) {
    a = Number(commaSplit[0].trim());
    b = Number(commaSplit[1].trim());
  } else {
    const parts = cleaned.split(' ');
    if (parts.length >= 2) {
      a = Number(parts[0]);
      b = Number(parts[1]);
    }
  }
  if (a === null || b === null || isNaN(a) || isNaN(b)) return null;
  // Heuristic: figure out which is lat vs lon
  // Prefer (lat, lon) when plausible; otherwise swap
  const absA = Math.abs(a);
  const absB = Math.abs(b);
  if (absA <= 90 && absB <= 180) return [a, b];
  if (absB <= 90 && absA <= 180) return [b, a];
  // Fallback assume first is lat
  return [a, b];
}

function buildPlacesMap(indexRows: IndexRow[]): Map<string, {coords: [number, number], country: string}> {
  const map = new Map<string, {coords: [number, number], country: string}>();
  for (const row of indexRows) {
    if (!row || !row.Titre) continue;
    if (row.Type && row.Type.toLowerCase().includes('lieu')) {
      const coords = parseCoordPair(row.Coordonnées || '');
      if (coords) {
        const key = row.Titre.trim().toLowerCase();
        const country = row.Country || '';
        if (!map.has(key)) map.set(key, {coords, country});
      }
    }
  }
  return map;
}

function groupByMonth(items: ProcessedItem[]): TemporalData[] {
  const groups: Record<string, { date: Date; count: number; items: ProcessedItem[] }> = {};
  for (const it of items) {
    if (!it.publishDate) continue;
    const d = new Date(it.publishDate);
    if (!isValidDate(d)) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!groups[key]) {
      const monthDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
      groups[key] = { date: monthDate, count: 0, items: [] };
    }
    groups[key].count += 1;
    groups[key].items.push(it);
  }
  return Object.values(groups).sort((a, b) => a.date.getTime() - b.date.getTime());
}

export async function loadStaticData(basePath = 'data'):
  Promise<LoadedData> {
  const [articlesRes, indexRes] = await Promise.all([
  fetch(`${basePath}/articles.json`),
  fetch(`${basePath}/index.json`)
  ]);
  if (!articlesRes.ok) throw new Error(`Failed to load articles.json: ${articlesRes.status}`);
  if (!indexRes.ok) throw new Error(`Failed to load index.json: ${indexRes.status}`);

  const articles: ArticleRow[] = await articlesRes.json();
  const indexRows: IndexRow[] = await indexRes.json();

  const places = buildPlacesMap(indexRows);

  const items: ProcessedItem[] = [];
  const countriesSet = new Set<string>();
  const newspapersSet = new Set<string>();
  let dateMin: Date | null = null;
  let dateMax: Date | null = null;

  for (const a of articles) {
    const id = a['o:id']?.toString() || '';
    const title = a.title || 'Untitled';
  const country = a.country || '';
    const newspaperSource = a.newspaper || '';
    const keywords = parsePipeList(a.subject);
    const spatialLabels = parsePipeList(a.spatial);

    let publishDate: Date = new Date('');
    if (a.pub_date) {
      const d = new Date(a.pub_date);
      if (isValidDate(d)) publishDate = d;
    }

    const coordinates: [number, number][] = [];
    const coordinateCountries: string[] = []; // Track country for each coordinate
    let derivedCountry = country; // Start with country from articles data
    
    for (const label of spatialLabels) {
      const key = label.trim().toLowerCase();
      const placeInfo = places.get(key);
      if (placeInfo) {
        coordinates.push(placeInfo.coords);
        coordinateCountries.push(placeInfo.country || '');
        // If no country in articles data but we have it from places, use it
        if (!derivedCountry && placeInfo.country) {
          derivedCountry = placeInfo.country;
        }
      }
    }

    // Create one ProcessedItem per coordinate to handle multi-location articles correctly
    if (coordinates.length > 0) {
      for (let i = 0; i < coordinates.length; i++) {
        const coord = coordinates[i];
        const coordCountry = coordinateCountries[i] || derivedCountry;
        
        const processed: ProcessedItem = {
          id: `${id}-${i}`, // Unique ID per coordinate
          title,
          publishDate,
          coordinates: [coord], // Single coordinate per item
          country: coordCountry,
          articleCountry: country,
          region: null,
          prefecture: null,
          newspaperSource,
          keywords,
          spatial: spatialLabels
        };

        if (coordCountry) countriesSet.add(coordCountry);
        if (newspaperSource) newspapersSet.add(newspaperSource);
        if (isValidDate(publishDate)) {
          if (!dateMin || publishDate < dateMin) dateMin = publishDate;
          if (!dateMax || publishDate > dateMax) dateMax = publishDate;
        }

        items.push(processed);
      }
    } else {
      // No coordinates found, create item without coordinates
      const processed: ProcessedItem = {
        id,
        title,
        publishDate,
        coordinates: null,
        country: derivedCountry,
        articleCountry: country,
        region: null,
        prefecture: null,
        newspaperSource,
        keywords,
        spatial: spatialLabels
      };

      if (derivedCountry) countriesSet.add(derivedCountry);
      if (newspaperSource) newspapersSet.add(newspaperSource);
      if (isValidDate(publishDate)) {
        if (!dateMin || publishDate < dateMin) dateMin = publishDate;
        if (!dateMax || publishDate > dateMax) dateMax = publishDate;
      }

      items.push(processed);
    }
  }

  const timeline = groupByMonth(items);

  return {
    items,
    timeline,
    countries: Array.from(countriesSet).sort(),
    newspapers: Array.from(newspapersSet).sort(),
    dateMin,
    dateMax,
    places: indexRows // Include raw places data
  };
}

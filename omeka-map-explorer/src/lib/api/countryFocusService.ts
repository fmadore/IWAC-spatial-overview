import { base } from '$app/paths';

export type AdminLevel = 'regions' | 'prefectures';

export interface CountryAdminCounts {
  country: string;
  level: AdminLevel;
  countsMentions?: Record<string, number>;
  countsArticles?: Record<string, number>;
  updatedAt?: string;
}

function normalizeCountryForFile(country: string) {
  return country
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/['’`]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase();
}

export async function loadAdminCounts(country: string, level: AdminLevel): Promise<CountryAdminCounts | null> {
  const norm = normalizeCountryForFile(country);
  const file = `${base}/data/country_focus/${norm}_${level}_counts.json`;
  try {
    const res = await fetch(file, { cache: 'no-cache' });
    if (!res.ok) return null;
    const json = (await res.json()) as CountryAdminCounts;
  if (!json || (!json.countsMentions && !json.countsArticles)) return null;
    return json;
  } catch {
    return null;
  }
}

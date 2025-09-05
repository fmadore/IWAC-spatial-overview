#!/usr/bin/env python3
"""
Build precomputed per-admin counts for Country Focus.

Reads:
- omeka-map-explorer/static/data/articles.json
- omeka-map-explorer/static/data/index.json

Outputs (to omeka-map-explorer/static/data/country_focus/):
- benin_regions_counts.json
- benin_prefectures_counts.json
- burkina_faso_regions_counts.json
- burkina_faso_prefectures_counts.json
- cote_divoire_regions_counts.json
- cote_divoire_prefectures_counts.json
- togo_regions_counts.json
- togo_prefectures_counts.json

Counts are by mention: an article contributes +1 to a region/prefecture if any of its locations in index.json
have that region/prefecture, scoped to a target country to avoid cross-country collisions on names.
"""
from __future__ import annotations
import json
from pathlib import Path
from collections import defaultdict
from datetime import datetime
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / 'omeka-map-explorer' / 'static' / 'data'
OUT_DIR = DATA_DIR / 'country_focus'
OUT_DIR.mkdir(parents=True, exist_ok=True)

COUNTRIES = ['Benin', 'Burkina Faso', "Côte d'Ivoire", 'Togo']


def norm_country_for_file(name: str) -> str:
    s = unicodedata.normalize('NFD', name)
    s = ''.join(ch for ch in s if unicodedata.category(ch) != 'Mn')  # strip diacritics
    s = s.replace("'", '').replace('’', '').replace('`', '')
    s = '_'.join(s.split()).lower()
    return s


def load_json(path: Path):
    with path.open('r', encoding='utf-8') as f:
        return json.load(f)


def main():
    articles = load_json(DATA_DIR / 'articles.json')
    index = load_json(DATA_DIR / 'index.json')

    # Build quick lookup: article id -> list of locations with country/region/prefecture
    # The preprocess should have added these fields.
    # Expect entries with: { 'o:id': int|str, 'Country': str, 'Region': Optional[str], 'Prefecture': Optional[str] }
    locs_by_article = defaultdict(list)
    for row in index:
        try:
            aid = row.get('o:id')
            # Use numeric if present else string
            if isinstance(aid, str) and aid.isdigit():
                aid = int(aid)
            country = (row.get('Country') or row.get('country') or '').strip()
            region = (row.get('Region') or row.get('region') or None)
            if isinstance(region, str):
                region = region.strip() or None
            prefecture = (row.get('Prefecture') or row.get('prefecture') or None)
            if isinstance(prefecture, str):
                prefecture = prefecture.strip() or None
            if not country:
                continue
            locs_by_article[aid].append({
                'country': country,
                'region': region,
                'prefecture': prefecture
            })
        except Exception:
            continue

    # Deduplicate by article id within a name to avoid overcount when an article mentions same region multiple times
    now = datetime.utcnow().isoformat()
    for country in COUNTRIES:
        norm = norm_country_for_file(country)
        # Regions
        reg_counts = defaultdict(set)  # name -> set(article_id)
        # Prefectures
        pre_counts = defaultdict(set)

        for aid, places in locs_by_article.items():
            # Check if the article has at least one place in this country
            for p in places:
                if p['country'] != country:
                    continue
                if p['region']:
                    reg_counts[p['region']].add(aid)
                if p['prefecture']:
                    pre_counts[p['prefecture']].add(aid)

        reg_out = {
            'country': country,
            'level': 'regions',
            'counts': {k: len(v) for k, v in sorted(reg_counts.items())},
            'updatedAt': now,
        }
        pre_out = {
            'country': country,
            'level': 'prefectures',
            'counts': {k: len(v) for k, v in sorted(pre_counts.items())},
            'updatedAt': now,
        }

        with (OUT_DIR / f"{norm}_regions_counts.json").open('w', encoding='utf-8') as f:
            json.dump(reg_out, f, ensure_ascii=False, indent=2)
        with (OUT_DIR / f"{norm}_prefectures_counts.json").open('w', encoding='utf-8') as f:
            json.dump(pre_out, f, ensure_ascii=False, indent=2)

    print(f"Wrote precomputed counts to {OUT_DIR}")


if __name__ == '__main__':
    main()

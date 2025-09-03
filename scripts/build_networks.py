#!/usr/bin/env python3
"""
Build co-occurrence networks from static entity files for IWAC Spatial Overview.

Reads omeka-map-explorer/static/data/entities/*.json which each contain:
  [{ id, name, relatedArticleIds: string[], articleCount, ... }]

Emits omeka-map-explorer/static/data/networks/global.json following the Data Contract:
  - nodes: [{ id: 'type:entityId', type, label, count, degree? }]
  - edges: [{ source, target, type, weight, articleIds }]
  - meta: { generatedAt, totalNodes, totalEdges, supportedTypes }

Configuration is at the top of this file.
"""
from __future__ import annotations
import json
from pathlib import Path
from datetime import datetime
from itertools import product

# ------------------ Configuration ------------------
# Cross-type pairs only to reduce density (Roadmap default)
TYPE_PAIRS = [
    ("person", "organization"),
    ("event", "location"),
    ("person", "event"),
    ("organization", "event"),
    ("subject", "event"),
]

WEIGHT_MIN = 2  # prune weak edges

# ------------------ Paths ------------------
ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / 'omeka-map-explorer' / 'static' / 'data'
ENT_DIR = DATA_DIR / 'entities'
OUT_DIR = DATA_DIR / 'networks'
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ------------------ Helpers ------------------
def load_entities(file: str):
    p = ENT_DIR / file
    if not p.exists():
        return []
    return json.loads(p.read_text(encoding='utf-8'))

def build_article_index(entities: list[dict], type_key: str, 
                        article_to_entities: dict[str, dict[str, set[str]]],
                        node_info: dict[str, dict]):
    """
    Populate article_to_entities[articleId][type_key] with entity ids,
    and node_info with label/count for each node id.
    """
    for ent in entities:
        ent_id = str(ent.get('id'))
        node_id = f"{type_key}:{ent_id}"
        label = ent.get('name', '')
        count = int(ent.get('articleCount', len(ent.get('relatedArticleIds', []) or [])) or 0)
        node_info[node_id] = {
            'id': node_id,
            'type': type_key,
            'label': label,
            'count': count,
        }
        for aid in ent.get('relatedArticleIds', []) or []:
            aid = str(aid)
            bucket = article_to_entities.setdefault(aid, {})
            bucket.setdefault(type_key, set()).add(node_id)

# ------------------ Load ------------------
print("Loading entity files...")
persons = load_entities('persons.json')
organizations = load_entities('organizations.json')
events = load_entities('events.json')
subjects = load_entities('subjects.json')
locations = load_entities('locations.json')

print(
    f"Loaded persons={len(persons)}, orgs={len(organizations)}, events={len(events)}, subjects={len(subjects)}, locations={len(locations)}"
)

# ------------------ Index ------------------
article_to_entities: dict[str, dict[str, set[str]]] = {}
node_info: dict[str, dict] = {}

build_article_index(persons, 'person', article_to_entities, node_info)
build_article_index(organizations, 'organization', article_to_entities, node_info)
build_article_index(events, 'event', article_to_entities, node_info)
build_article_index(subjects, 'subject', article_to_entities, node_info)
build_article_index(locations, 'location', article_to_entities, node_info)

print(f"Indexed {len(article_to_entities)} articles with at least one entity.")

# ------------------ Build edges ------------------
edge_acc: dict[tuple[str, str], dict] = {}

for aid, by_type in article_to_entities.items():
    for t1, t2 in TYPE_PAIRS:
        a = by_type.get(t1)
        b = by_type.get(t2)
        if not a or not b:
            continue
        # accumulate all cross pairs for this article
        for n1 in a:
            for n2 in b:
                # consistent ordering per edge key
                s, t = (n1, n2) if n1 < n2 else (n2, n1)
                key = (s, t)
                rec = edge_acc.get(key)
                if not rec:
                    edge_acc[key] = {
                        'source': s,
                        'target': t,
                        'type': f"{t1}-{t2}",
                        'weight': 1,
                        'articleIds': [aid],
                    }
                else:
                    rec['weight'] += 1
                    # avoid duplicates if the same article could be seen twice
                    if not rec['articleIds'] or rec['articleIds'][-1] != aid:
                        rec['articleIds'].append(aid)

# Prune weak edges
edges = [e for e in edge_acc.values() if e['weight'] >= WEIGHT_MIN]

# ------------------ Build nodes subset ------------------
used_ids: set[str] = set()
for e in edges:
    used_ids.add(e['source'])
    used_ids.add(e['target'])

nodes = [node_info[nid] for nid in used_ids]

# Degree
degree = {nid: 0 for nid in used_ids}
for e in edges:
    degree[e['source']] += 1
    degree[e['target']] += 1
for n in nodes:
    n['degree'] = degree.get(n['id'], 0)

output = {
    'nodes': sorted(nodes, key=lambda x: x['degree'], reverse=True),
    'edges': edges,
    'meta': {
        'generatedAt': datetime.utcnow().isoformat() + 'Z',
        'totalNodes': len(nodes),
        'totalEdges': len(edges),
        'supportedTypes': ['person', 'organization', 'event', 'subject', 'location'],
        'weightMin': WEIGHT_MIN,
        'typePairs': TYPE_PAIRS,
    },
}

(OUT_DIR / 'global.json').write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"Wrote {OUT_DIR / 'global.json'} ({len(nodes)} nodes, {len(edges)} edges)")

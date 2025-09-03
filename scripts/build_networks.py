#!/usr/bin/env python3
"""
Build co-occurrence networks from static data files for IWAC Spatial Overview.
Emits omeka-map-explorer/static/data/networks/global.json following the Data Contract.

This is a minimal placeholder that composes a tiny network from existing entities
so the frontend can be developed. Replace with full logic per Roadmap M1.
"""
from __future__ import annotations
import json
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / 'omeka-map-explorer' / 'static' / 'data'
ENT_DIR = DATA_DIR / 'entities'
OUT_DIR = DATA_DIR / 'networks'
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Minimal placeholder: pick a few entries if files exist
nodes = []
edges = []

try:
    persons = json.loads((ENT_DIR / 'persons.json').read_text(encoding='utf-8'))
    orgs = json.loads((ENT_DIR / 'organizations.json').read_text(encoding='utf-8'))
    events = json.loads((ENT_DIR / 'events.json').read_text(encoding='utf-8'))
    subjects = json.loads((ENT_DIR / 'subjects.json').read_text(encoding='utf-8'))
    locations = json.loads((DATA_DIR / 'entities' / 'locations.json').read_text(encoding='utf-8'))
except Exception:
    persons = orgs = events = subjects = locations = []

# helper to make nodes

def take_first(arr, n=1):
    return arr[:n] if isinstance(arr, list) else []

for p in take_first(persons, 1):
    nodes.append({"id": f"person:{p.get('id')}", "type": "person", "label": p.get('name', ''), "count": int(p.get('articleCount', 1)) or 1})
for o in take_first(orgs, 1):
    nodes.append({"id": f"organization:{o.get('id')}", "type": "organization", "label": o.get('name', ''), "count": int(o.get('articleCount', 1)) or 1})
for e in take_first(events, 1):
    nodes.append({"id": f"event:{e.get('id')}", "type": "event", "label": e.get('name', ''), "count": int(e.get('articleCount', 1)) or 1})
for s in take_first(subjects, 1):
    nodes.append({"id": f"subject:{s.get('id')}", "type": "subject", "label": s.get('name', ''), "count": int(s.get('articleCount', 1)) or 1})
for l in take_first(locations, 1):
    nodes.append({"id": f"location:{l.get('id')}", "type": "location", "label": l.get('name', ''), "count": int(l.get('articleCount', 1)) or 1})

# Fake edges between whatever we have
if len(nodes) >= 2:
    a = nodes[0]['id']; b = nodes[1]['id']
    edges.append({"source": a, "target": b, "type": "cooccurrence", "weight": 2, "articleIds": ["demo-1", "demo-2"]})
if len(nodes) >= 3:
    edges.append({"source": nodes[1]['id'], "target": nodes[2]['id'], "type": "cooccurrence", "weight": 3, "articleIds": ["demo-2", "demo-3", "demo-4"]})

output = {
    "nodes": nodes,
    "edges": edges,
    "meta": {
        "generatedAt": datetime.utcnow().isoformat() + 'Z',
        "totalNodes": len(nodes),
        "totalEdges": len(edges),
        "supportedTypes": ["person","organization","event","subject","location"],
    }
}

(OUT_DIR / 'global.json').write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"Wrote {OUT_DIR / 'global.json'} ({len(nodes)} nodes, {len(edges)} edges)")

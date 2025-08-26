"""
Add country names to index.json locations based on coordinates and world_countries.geojson polygons.

This script reads the index.json file and world_countries.geojson, then uses shapely
to perform point-in-polygon tests to determine which country each location belongs to.
The results are saved back to index.json with a new "Country" field.

Usage:
    python scripts/add_countries.py
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    from shapely.geometry import Point, shape
    from shapely.prepared import prep
except ImportError:
    print("Error: shapely is required. Install with: pip install shapely")
    exit(1)


def parse_coordinates(coord_str: str) -> Optional[Tuple[float, float]]:
    """Parse coordinate string like '6.5808, 1.6696' to (lat, lng) tuple."""
    if not coord_str or not coord_str.strip():
        return None
    
    try:
        # Handle various formats
        cleaned = coord_str.replace('(', '').replace(')', '').replace('[', '').replace(']', '').strip()
        parts = [p.strip() for p in cleaned.split(',')]
        
        if len(parts) >= 2:
            lat = float(parts[0])
            lng = float(parts[1])
            
            # Basic validation
            if -90 <= lat <= 90 and -180 <= lng <= 180:
                return (lat, lng)
            
        return None
    except (ValueError, IndexError):
        return None


def load_world_countries(geojson_path: Path) -> List[Dict]:
    """Load world countries GeoJSON and prepare geometries for fast lookup."""
    with open(geojson_path, 'r', encoding='utf-8') as f:
        world_data = json.load(f)
    
    countries = []
    for feature in world_data.get('features', []):
        if not feature.get('geometry') or not feature.get('properties', {}).get('name'):
            continue
            
        try:
            # Create shapely geometry and prepare it for fast contains() checks
            geom = shape(feature['geometry'])
            prepared_geom = prep(geom)
            
            countries.append({
                'name': feature['properties']['name'],
                'geometry': prepared_geom,
                'properties': feature['properties']
            })
        except Exception as e:
            print(f"Warning: Failed to process country {feature.get('properties', {}).get('name', 'Unknown')}: {e}")
            continue
    
    print(f"Loaded {len(countries)} countries from GeoJSON")
    return countries


def find_country_for_coordinates(lat: float, lng: float, countries: List[Dict]) -> Optional[str]:
    """Find which country contains the given coordinates."""
    point = Point(lng, lat)  # Shapely uses (lng, lat) order
    
    for country in countries:
        try:
            if country['geometry'].contains(point):
                return country['name']
        except Exception:
            # If prepared geometry fails, try the original
            continue
    
    return None


def process_index_locations(index_path: Path, countries: List[Dict]) -> List[Dict]:
    """Process index.json and add country names to locations."""
    with open(index_path, 'r', encoding='utf-8') as f:
        locations = json.load(f)
    
    processed = 0
    matched = 0
    skipped = 0
    
    for location in locations:
        # Only process entries with Type: "Lieux"
        if location.get('Type') != 'Lieux':
            skipped += 1
            continue
            
        coord_str = location.get('Coordonnées', '')
        coords = parse_coordinates(coord_str)
        
        if coords:
            lat, lng = coords
            country = find_country_for_coordinates(lat, lng, countries)
            location['Country'] = country or ''
            
            if country:
                matched += 1
                print(f"✓ {location.get('Titre', 'Unknown')}: {country}")
            else:
                print(f"✗ {location.get('Titre', 'Unknown')}: No country found for {lat}, {lng}")
        else:
            location['Country'] = ''
            if coord_str:
                print(f"! {location.get('Titre', 'Unknown')}: Invalid coordinates '{coord_str}'")
        
        processed += 1
    
    print(f"\nProcessed {processed} locations (Type: 'Lieux'), matched {matched} to countries")
    print(f"Skipped {skipped} non-location entries")
    return locations


def main():
    # Paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    index_path = project_root / "omeka-map-explorer" / "static" / "data" / "index.json"
    geojson_path = project_root / "omeka-map-explorer" / "static" / "data" / "maps" / "world_countries.geojson"
    
    # Check files exist
    if not index_path.exists():
        print(f"Error: {index_path} not found")
        return
    
    if not geojson_path.exists():
        print(f"Error: {geojson_path} not found")
        return
    
    print("Loading world countries GeoJSON...")
    countries = load_world_countries(geojson_path)
    
    print("Processing index locations...")
    updated_locations = process_index_locations(index_path, countries)
    
    # Create backup
    backup_path = index_path.with_suffix('.json.backup')
    print(f"Creating backup: {backup_path}")
    with open(backup_path, 'w', encoding='utf-8') as f:
        with open(index_path, 'r', encoding='utf-8') as original:
            f.write(original.read())
    
    # Save updated file
    print(f"Saving updated index.json...")
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(updated_locations, f, ensure_ascii=False, indent=2)
    
    print("✅ Done! Country names added to index.json")


if __name__ == "__main__":
    main()

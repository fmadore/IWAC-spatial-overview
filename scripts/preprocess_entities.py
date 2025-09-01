#!/usr/bin/env python3
"""
Preprocess entities from index.json and articles.json to create separate entity files.
This dramatically improves runtime performance by pre-computing entity-article relationships.
"""

import json
import os
from collections import defaultdict
from typing import Dict, List, Set

def parse_pipe_list(s: str) -> List[str]:
    """Parse pipe-separated string into list of trimmed, non-empty strings."""
    if not s:
        return []
    return [item.strip() for item in s.split('|') if item.strip()]

def load_data(data_dir: str):
    """Load articles and index data."""
    articles_path = os.path.join(data_dir, 'articles.json')
    index_path = os.path.join(data_dir, 'index.json')
    
    print(f"Loading articles from {articles_path}...")
    with open(articles_path, 'r', encoding='utf-8') as f:
        articles = json.load(f)
    
    print(f"Loading index from {index_path}...")
    with open(index_path, 'r', encoding='utf-8') as f:
        index_data = json.load(f)
    
    print(f"Loaded {len(articles)} articles and {len(index_data)} index entries")
    return articles, index_data

def build_entity_article_map(articles: List[dict]) -> Dict[str, Set[str]]:
    """Build a map from entity names to article IDs that mention them."""
    entity_articles = defaultdict(set)
    
    print("Building entity-article mapping...")
    for article in articles:
        article_id = str(article.get('o:id', ''))
        subjects = parse_pipe_list(article.get('subject', ''))
        
        for subject in subjects:
            entity_articles[subject].add(article_id)
    
    print(f"Found {len(entity_articles)} unique entities mentioned across articles")
    return entity_articles

def extract_entities_by_type(index_data: List[dict], entity_articles: Dict[str, Set[str]]):
    """Extract entities by type with their related articles."""
    entity_types = {
        'Personnes': 'persons',
        'Organisations': 'organizations', 
        'Événements': 'events',
        'Sujets': 'subjects'
    }
    
    entities_by_type = {file_name: [] for file_name in entity_types.values()}
    
    print("Processing entities by type...")
    for entry in index_data:
        entity_type = entry.get('Type', '')
        if entity_type in entity_types:
            entity_name = entry.get('Titre', '')
            entity_id = str(entry.get('o:id', ''))
            
            # Get related article IDs
            related_articles = list(entity_articles.get(entity_name, set()))
            
            # Only include entities that are mentioned in articles
            if related_articles:
                file_name = entity_types[entity_type]
                entities_by_type[file_name].append({
                    'id': entity_id,
                    'name': entity_name,
                    'relatedArticleIds': related_articles,
                    'articleCount': len(related_articles)  # Pre-computed count for performance
                })
    
    # Sort entities by name for consistent output
    for entity_list in entities_by_type.values():
        entity_list.sort(key=lambda x: x['name'])
    
    return entities_by_type

def save_entity_files(entities_by_type: Dict[str, List[dict]], output_dir: str):
    """Save entity files to the output directory."""
    os.makedirs(output_dir, exist_ok=True)
    
    for file_name, entities in entities_by_type.items():
        output_path = os.path.join(output_dir, f'{file_name}.json')
        print(f"Saving {len(entities)} {file_name} to {output_path}")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(entities, f, ensure_ascii=False, indent=2)

def main():
    """Main preprocessing function."""
    # Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, '..', 'omeka-map-explorer', 'static', 'data')
    output_dir = os.path.join(data_dir, 'entities')
    
    print("=== Entity Preprocessing Script ===")
    print(f"Data directory: {data_dir}")
    print(f"Output directory: {output_dir}")
    
    # Load data
    articles, index_data = load_data(data_dir)
    
    # Build entity-article mapping
    entity_articles = build_entity_article_map(articles)
    
    # Extract entities by type
    entities_by_type = extract_entities_by_type(index_data, entity_articles)
    
    # Print statistics
    print("\n=== Statistics ===")
    for entity_type, entities in entities_by_type.items():
        print(f"{entity_type}: {len(entities)} entities")
    
    # Save files
    print("\n=== Saving Files ===")
    save_entity_files(entities_by_type, output_dir)
    
    print("\n=== Complete ===")
    print("Entity files have been generated successfully!")
    print(f"Files saved to: {output_dir}")

if __name__ == '__main__':
    main()

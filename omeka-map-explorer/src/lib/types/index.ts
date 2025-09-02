// Omeka S API types
export interface OmekaItem {
	id: string;
	title: string;
	'dcterms:spatial': Array<{
		'@id': string;
		'@value'?: string;
	}>;
	'dcterms:date': Array<{
		'@value': string;
	}>;
	'dcterms:title': Array<{
		'@value': string;
	}>;
	// Other Dublin Core fields
}

// Processed Item with coordinate data
export interface ProcessedItem {
	id: string;
	title: string;
	publishDate: Date;
	coordinates: [number, number][] | null; // [lat, lng]
	// country: the location's country (from the place coordinate)
	country: string;
	// articleCountry: the original article country from articles.json
	articleCountry: string;
	region: string | null;
	prefecture: string | null;
	newspaperSource: string;
	keywords: string[];
	spatial: string[]; // Spatial locations mentioned in the article
	// Canonical label of the place corresponding to this item's coordinate (from locations.json)
	// Present when coordinates are available; undefined otherwise
	placeLabel?: string;
}

// Temporal data for timeline visualization
export interface TemporalData {
	date: Date;
	count: number;
	items: ProcessedItem[];
}

// GeoJSON types
export interface GeoJsonFeature {
	type: string;
	properties: {
		name: string;
		[key: string]: any;
	};
	geometry: {
		type: string;
		coordinates: any[];
	};
}

export interface GeoJsonData {
	type: string;
	features: GeoJsonFeature[];
}

// Entity types
export interface Entity {
	id: string;
	name: string;
	relatedArticleIds: string[];
	articleCount: number;
}

export interface LocationEntity extends Entity {
	coordinates: [number, number] | null;
	country: string | null;
	coordinatesRaw: string;
}

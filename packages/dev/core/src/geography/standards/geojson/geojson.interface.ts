export enum GeoJsonObjectTypes {
    Feature = "Feature",
    FeatureCollection = "FeatureCollection",
    Point = "Point",
    MultiPoint = "MultiPoint",
    LineString = "LineString",
    MultiLineString = "MultiLineString",
    Polygon = "Polygon",
    MultiPolygon = "MultiPolygon",
    GeometryCollection = "GeometryCollection",
}

export interface IGeoJsonObject {
    type: GeoJsonObjectTypes;
    bbox?: number[];
    crs?: IGeoJsonCoordinateReferenceSystem;
}

export interface IGeoJsonGeometry extends IGeoJsonObject {
    coordinates: any;
}

export interface IGeoJsonFeature extends IGeoJsonObject {
    type: GeoJsonObjectTypes.Feature;
    geometry: IGeoJsonGeometry;
    properties: { [name: string]: any } | null;
    id?: string | number;
}

export interface IGeoJsonFeatureCollection extends IGeoJsonObject {
    type: GeoJsonObjectTypes.FeatureCollection;
    features: IGeoJsonFeature[];
}

export type GeoJsonCoordinate = [number, number] | [number, number, number];

export interface IGeoJsonPoint extends IGeoJsonGeometry {
    type: GeoJsonObjectTypes.Point;
    coordinates: [number, number] | [number, number, number];
}

export interface IGeoJsonMultiPoint extends IGeoJsonGeometry {
    type: GeoJsonObjectTypes.MultiPoint;
    coordinates: Array<[number, number] | [number, number, number]>;
}

export interface IGeoJsonLineString extends IGeoJsonGeometry {
    type: GeoJsonObjectTypes.LineString;
    coordinates: Array<[number, number] | [number, number, number]>;
}

export interface IGeoJsonMultiLineString extends IGeoJsonGeometry {
    type: GeoJsonObjectTypes.MultiLineString;
    coordinates: Array<Array<[number, number] | [number, number, number]>>;
}

export interface IGeoJsonPolygon extends IGeoJsonGeometry {
    type: GeoJsonObjectTypes.Polygon;
    coordinates: Array<Array<[number, number] | [number, number, number]>>;
}

export interface IGeoJsonMultiPolygon extends IGeoJsonGeometry {
    type: GeoJsonObjectTypes.MultiPolygon;
    coordinates: Array<Array<Array<[number, number] | [number, number, number]>>>;
}

export interface IGeoJsonGeometryCollection extends IGeoJsonGeometry {
    type: GeoJsonObjectTypes.GeometryCollection;
    geometries: IGeoJsonGeometry[];
}

export interface IGeoJsonCoordinateReferenceSystem {
    type: string;
    properties: any;
}

// Union type of all GeoJSON geometries
export type GeoJsonGeometryTypes =
    | IGeoJsonPoint
    | IGeoJsonMultiPoint
    | IGeoJsonLineString
    | IGeoJsonMultiLineString
    | IGeoJsonPolygon
    | IGeoJsonMultiPolygon
    | IGeoJsonGeometryCollection;

// Union type of all GeoJSON objects
export type GeoJsonTypes = IGeoJsonObject | IGeoJsonGeometry | IGeoJsonFeature | IGeoJsonFeatureCollection;

import {
    IGeoJsonFeature,
    IGeoJsonFeatureCollection,
    IGeoJsonGeometry,
    GeoJsonTypes,
    IGeoJsonGeometryCollection,
    IGeoJsonLineString,
    IGeoJsonMultiLineString,
    IGeoJsonMultiPoint,
    IGeoJsonMultiPolygon,
    IGeoJsonPoint,
    IGeoJsonPolygon,
} from "./geojson.interface";

export class GeoJsonParser {
    public static Shared = new GeoJsonParser();

    public parse(jsonString: string): GeoJsonTypes {
        const parsed = JSON.parse(jsonString);

        if (!parsed || typeof parsed !== "object") {
            throw new Error("Invalid GeoJSON object");
        }

        switch (parsed.type) {
            case "Feature":
                return this.validateFeature(parsed);
            case "FeatureCollection":
                return this.validateFeatureCollection(parsed);
            case "Point":
            case "MultiPoint":
            case "LineString":
            case "MultiLineString":
            case "Polygon":
            case "MultiPolygon":
            case "GeometryCollection":
                return this.validateGeometry(parsed);
            default:
                throw new Error(`Unknown GeoJSON type: ${parsed.type}`);
        }
    }

    protected validateFeature(feature: any): IGeoJsonFeature {
        if (feature.type !== "Feature") {
            throw new Error("Invalid Feature object");
        }
        if (!feature.geometry || !this.validateGeometry(feature.geometry)) {
            throw new Error("Invalid Feature geometry");
        }
        return feature as IGeoJsonFeature;
    }

    protected validateFeatureCollection(collection: any): IGeoJsonFeatureCollection {
        if (collection.type !== "FeatureCollection") {
            throw new Error("Invalid FeatureCollection object");
        }
        if (!Array.isArray(collection.features) || !collection.features.every(this.validateFeature)) {
            throw new Error("Invalid FeatureCollection features");
        }
        return collection as IGeoJsonFeatureCollection;
    }

    protected validateGeometry(geometry: any): IGeoJsonGeometry {
        switch (geometry.type) {
            case "Point":
                return geometry as IGeoJsonPoint;
            case "MultiPoint":
                return geometry as IGeoJsonMultiPoint;
            case "LineString":
                return geometry as IGeoJsonLineString;
            case "MultiLineString":
                return geometry as IGeoJsonMultiLineString;
            case "Polygon":
                return geometry as IGeoJsonPolygon;
            case "MultiPolygon":
                return geometry as IGeoJsonMultiPolygon;
            case "GeometryCollection":
                return geometry as IGeoJsonGeometryCollection;
            default:
                throw new Error(`Unknown Geometry type: ${geometry.type}`);
        }
    }
}

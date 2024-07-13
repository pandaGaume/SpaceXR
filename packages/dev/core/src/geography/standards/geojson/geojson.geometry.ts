import { GeoBoundedCollection } from "../../geography.envelope.collection";
import { Geo2 } from "../../geography.position";
import { GeoLine, GeoPolygon, GeoPolyline, IGeoShape } from "../../shapes";
import { GeoPoint } from "../../shapes/geography.point";
import { GeoJsonCoordinate, GeoJsonObjectTypes, IGeoJsonCoordinateReferenceSystem, IGeoJsonGeometry, IGeoJsonGeometryCollection } from "./geojson.interface";
import { GeoJsonObject } from "./geojson.object";

export abstract class GeoJsonGeometry extends GeoJsonObject implements IGeoJsonGeometry {
    public static ToShape(geom: IGeoJsonGeometry): IGeoShape | GeoBoundedCollection<IGeoShape> | undefined {
        switch (geom.type) {
            case GeoJsonObjectTypes.Point: {
                return new GeoPoint(Geo2.FromGeoJson(geom.coordinates));
            }
            case GeoJsonObjectTypes.MultiPoint: {
                return geom.coordinates.map((g: GeoJsonCoordinate) => new GeoPoint(Geo2.FromGeoJson(g)));
            }
            case GeoJsonObjectTypes.LineString: {
                if (geom.coordinates.length === 2) {
                    return new GeoLine(Geo2.FromGeoJson(geom.coordinates[0]), Geo2.FromGeoJson(geom.coordinates[1]));
                }
                return new GeoPolyline(geom.coordinates.map((g: GeoJsonCoordinate) => Geo2.FromGeoJson(g)));
            }
            case GeoJsonObjectTypes.MultiLineString: {
                return geom.coordinates.map((g: Array<GeoJsonCoordinate>) => {
                    if (g.length === 2) {
                        return new GeoLine(Geo2.FromGeoJson(geom.coordinates[0]), Geo2.FromGeoJson(geom.coordinates[1]));
                    }
                    return new GeoPolyline(geom.coordinates.map((g: GeoJsonCoordinate) => Geo2.FromGeoJson(g)));
                });
            }
            case GeoJsonObjectTypes.Polygon: {
                return new GeoPolygon(geom.coordinates.map((g: GeoJsonCoordinate) => Geo2.FromGeoJson(g)));
            }
            case GeoJsonObjectTypes.MultiPolygon: {
                return geom.coordinates.map((g: Array<GeoJsonCoordinate>) => new GeoPolygon(geom.coordinates.map((g: GeoJsonCoordinate) => Geo2.FromGeoJson(g))));
            }
            case GeoJsonObjectTypes.GeometryCollection: {
                const collection = geom as IGeoJsonGeometryCollection;
                const shapes = new GeoBoundedCollection<IGeoShape>();
                for (const g of collection.geometries) {
                    const shape = GeoJsonGeometry.ToShape(g);
                    if (shape) {
                        if (shape instanceof GeoBoundedCollection) {
                            shapes.push(...shape);
                            continue;
                        }
                        shapes.push(shape);
                    }
                }
            }
        }

        return undefined;
    }

    _coordinates: any;

    protected constructor(type: GeoJsonObjectTypes, coordinates: any, bbox?: number[], crs?: IGeoJsonCoordinateReferenceSystem) {
        super(type, bbox, crs);
        this._coordinates = coordinates;
    }

    public get coordinates(): any {
        return this._coordinates;
    }
}

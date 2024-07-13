import { GeoJsonObjectTypes, IGeoJsonCoordinateReferenceSystem, IGeoJsonObject } from "./geojson.interface";

export class GeoJsonObject implements IGeoJsonObject {
    constructor(public type: GeoJsonObjectTypes, public bbox?: number[], public crs?: IGeoJsonCoordinateReferenceSystem) {}
}

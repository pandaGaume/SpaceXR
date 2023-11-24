import { IDistanceProcessor } from "../geodesy/geodesy.interfaces";
import { GeoBounded } from "./geography.envelope";
import { IEnvelope, IGeo2, IGeoPath, IGeoPathItem, IGeoRoute, IGeoSegment, IGeoWaypoint } from "./geography.interfaces";
import { Geo2 } from "./geography.position";
export declare abstract class GeoPathItem extends GeoBounded implements IGeoPathItem {
    id?: string;
    constructor(id?: string, parent?: GeoPathItem);
}
export declare class GeoSegment<T extends IGeo2> extends GeoPathItem implements IGeoSegment<T> {
    static FromPolyline(polyline: number[][], id?: string, parent?: GeoPathItem): GeoSegment<Geo2>;
    static Length<T extends IGeo2>(segment: IGeoSegment<T>, proc?: IDistanceProcessor): number;
    points: T[];
    constructor(id?: string, points?: T[], parent?: GeoPathItem);
    protected _buildEnvelope(b: IEnvelope): IEnvelope | undefined;
}
export declare class GeoWaypoint<T extends IGeo2> extends GeoPathItem implements IGeoWaypoint<T> {
    position: T;
    constructor(id: string, position: T, parent?: GeoPathItem);
    protected _buildEnvelope(b: IEnvelope): IEnvelope | undefined;
}
export declare class GeoPath extends GeoPathItem implements IGeoPath<IGeo2, IGeoWaypoint<IGeo2>> {
    segments: GeoSegment<IGeo2>[];
    waypoints?: IGeoWaypoint<IGeo2>[];
    routes?: IGeoRoute<IGeo2>[];
    constructor(id?: string, segments?: GeoSegment<Geo2>[], parent?: GeoPathItem);
    protected _buildEnvelope(b: IEnvelope): IEnvelope | undefined;
}

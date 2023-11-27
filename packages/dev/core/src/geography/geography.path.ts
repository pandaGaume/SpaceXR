import { HaversineCalculator } from "../geodesy/geodesy.calculators";
import { IDistanceProcessor } from "../geodesy/geodesy.interfaces";
import { Envelope, GeoBounded } from "./geography.envelope";
import { IEnvelope, IGeo2, IGeoPath, IGeoPathItem, IGeoRoute, IGeoSegment, IGeoWaypoint } from "./geography.interfaces";
import { Geo2 } from "./geography.position";

export abstract class GeoPathItem extends GeoBounded implements IGeoPathItem {
    public id?: string;

    public constructor(id?: string, parent?: GeoPathItem) {
        super(undefined, parent);
        this.id = id;
    }
}

export class GeoSegment<T extends IGeo2> extends GeoPathItem implements IGeoSegment<T> {
    public static FromPolyline(polyline: number[][], id?: string, parent?: GeoPathItem): GeoSegment<Geo2> {
        const points = [];
        for (let i = 0; i < polyline.length; i++) {
            points.push(new Geo2(polyline[i][0], polyline[i][1]));
        }
        return new GeoSegment(id, points, parent);
    }

    public static Length<T extends IGeo2>(segment: IGeoSegment<T>, proc?: IDistanceProcessor): number {
        proc = proc ?? HaversineCalculator.Shared;
        let length = 0;
        for (let i = 0; i < segment.points.length - 1; i++) {
            const a = segment.points[i];
            const b = segment.points[i + 1];
            length += proc.getDistanceFromFloat(a.lat, a.lon, b.lat, b.lon);
        }
        return length;
    }

    public points: T[];

    public constructor(id?: string, points?: T[], parent?: GeoPathItem) {
        super(id, parent);
        this.id = id;
        this.points = points || [];
    }

    protected _buildEnvelope(): IEnvelope | undefined {
        return Envelope.FromPoints(...this.points);
    }
}

export class GeoWaypoint<T extends IGeo2> extends GeoPathItem implements IGeoWaypoint<T> {
    public constructor(id: string, public position: T, parent?: GeoPathItem) {
        super(id, parent);
    }

    protected _buildEnvelope(): IEnvelope | undefined {
        return Envelope.FromPoints(this.position);
    }
}

export class GeoPath extends GeoPathItem implements IGeoPath<IGeo2, IGeoWaypoint<IGeo2>> {
    public segments: GeoSegment<IGeo2>[];
    public waypoints?: IGeoWaypoint<IGeo2>[];
    public routes?: IGeoRoute<IGeo2>[];

    public constructor(id?: string, segments?: GeoSegment<Geo2>[], parent?: GeoPathItem) {
        super(id, parent);
        this.id = id;
        this.segments = segments || [];
    }

    protected _buildEnvelope(): IEnvelope | undefined {
        let baseEnvelope = Envelope.FromEnvelopes(...this.segments.map((s) => s.bounds));
        if (this.waypoints) {
            const points = this.waypoints.map((w) => w.position);
            const secondary = Envelope.FromPoints(...points);
            if (secondary) {
                return baseEnvelope ? baseEnvelope.unionInPlace(secondary) : secondary;
            }
        }
        return baseEnvelope;
    }
}

import { CalculatorBase, IGeoProcessor, SphericalCalculator } from "../../geodesy";
import { IGeo2 } from "../geography.interfaces";
import { Geo2 } from "../geography.position";

import { GeoPolyline } from "./geography.polyline";
import { IGeoPolygon, GeoShapeType } from "./geography.shapes.interfaces";

export class GeoPolygon extends GeoPolyline implements IGeoPolygon {
    public static FromCircle(center: IGeo2, radius: number, step: number, p?: IGeoProcessor): IGeoPolygon {
        const processor = p ?? CalculatorBase.Shared ?? SphericalCalculator.Shared;
        const points: Array<IGeo2> = [];
        const angle = 360 / step;
        const r = radius;
        const lat = center.lat;
        const lon = center.lon;
        for (let i = 0; i < 360; i += angle) {
            points.push(processor.getLocationAtDistanceAzimuth(lat, lon, r, i));
        }
        return new GeoPolygon(points);
    }

    public static FromRectangle(center: IGeo2, width: number, height: number, p?: IGeoProcessor): IGeoPolygon {
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        p = p ?? CalculatorBase.Shared ?? SphericalCalculator.Shared;
        const lat = center.lat;
        const lon = center.lon;
        const N = p.getLocationAtDistanceAzimuth(lat, lon, halfHeight, 0);
        const E = p.getLocationAtDistanceAzimuth(lat, lon, halfWidth, 90);
        const S = p.getLocationAtDistanceAzimuth(lat, lon, halfHeight, 180);
        const W = p.getLocationAtDistanceAzimuth(lat, lon, halfWidth, 270);

        return new GeoPolygon([new Geo2(N.lat, W.lon), new Geo2(N.lat, E.lon), new Geo2(S.lat, E.lon), new Geo2(S.lat, W.lon)]);
    }

    public constructor(p: Array<IGeo2>) {
        super(p, GeoShapeType.Polygon);
    }
}

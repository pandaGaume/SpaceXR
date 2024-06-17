import { CalculatorBase, GeodeticSystem, IGeoProcessor, SphericalCalculator } from "../../geodesy";
import { IGeo2 } from "../geography.interfaces";
import { Geo2 } from "../geography.position";
import { GeoPolyline } from "./geography.polyline";
import { IGeoPolygon, GeoShapeType } from "./geography.shapes.interfaces";

export class GeoPolygon extends GeoPolyline implements IGeoPolygon {
    public static Rectangle(center: IGeo2, width: number, height: number, s?: GeodeticSystem, proc?: IGeoProcessor): GeoPolygon {
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        proc = proc ?? CalculatorBase.Shared ?? SphericalCalculator.Shared;
        const lat = center.lat;
        const lon = center.lon;
        const N = proc.getLocationAtDistanceAzimuth(lat, lon, halfHeight, 0);
        const E = proc.getLocationAtDistanceAzimuth(lat, lon, halfWidth, 90);
        const S = proc.getLocationAtDistanceAzimuth(lat, lon, halfHeight, 180);
        const W = proc.getLocationAtDistanceAzimuth(lat, lon, halfWidth, 270);

        const points = new Array<IGeo2>(new Geo2(N.lat, W.lon), new Geo2(N.lat, E.lon), new Geo2(S.lat, E.lon), new Geo2(S.lat, W.lon));
        return new GeoPolygon(points, s, proc);
    }

    public constructor(p: Array<IGeo2>, s?: GeodeticSystem, proc?: IGeoProcessor) {
        super(p, s, proc, GeoShapeType.Polygon);
    }
}

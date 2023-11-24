import { HaversineCalculator } from "../geodesy/geodesy.calculators";
import { IDistanceProcessor } from "../geodesy/geodesy.interfaces";
import { IGeo3, IGeoSegment } from "./geography.interfaces";
import { GeoSegment } from "./geography.path";
import { Geo3 } from "./geography.position";

export enum PathwayPointGeneratorEndMode {
    BEGIN = 1,
    END = 2,
    BOTH = 3,
}

export class PathwayPointGeneratorOptions {
    public distanceProcessor?: IDistanceProcessor;
    public distance?: number;
    public count?: number;
    public endMode?: PathwayPointGeneratorEndMode;
}

export class PathwayPointGeneratorBuilder {
    _options?: PathwayPointGeneratorOptions;

    public constructor() {}

    public withOptions(options: PathwayPointGeneratorOptions): PathwayPointGeneratorBuilder {
        this._options = options;
        return this;
    }

    public withEndMode(mode: PathwayPointGeneratorEndMode): PathwayPointGeneratorBuilder {
        this._options = this._options || new PathwayPointGeneratorOptions();
        this._options.endMode = mode;
        return this;
    }

    public withDistanceProcessor(processor: IDistanceProcessor): PathwayPointGeneratorBuilder {
        this._options = this._options || new PathwayPointGeneratorOptions();
        this._options.distanceProcessor = processor;
        return this;
    }

    public withDistance(distance: number): PathwayPointGeneratorBuilder {
        this._options = this._options || new PathwayPointGeneratorOptions();
        this._options.distance = distance;
        return this;
    }

    public withCount(count: number): PathwayPointGeneratorBuilder {
        this._options = this._options || new PathwayPointGeneratorOptions();
        this._options.count = count;
        return this;
    }

    public build(): PathwayPointGenerator {
        return new PathwayPointGenerator(this._options);
    }
}

export class PathwayPointGenerator {
    _options?: PathwayPointGeneratorOptions;

    public constructor(options?: PathwayPointGeneratorOptions) {
        this._options = options;
    }

    public *generate(path: IGeoSegment<IGeo3>): IterableIterator<IGeo3> {
        if (path.points.length < 2) {
            return;
        }

        // first trivial if no options
        if (!this._options) {
            yield* path.points;
            return;
        }

        const dp = this._options?.distanceProcessor ?? HaversineCalculator.Shared;

        let distance = this._options.distance;
        if (!distance) {
            // next trivial if count < 2
            if (this._options.count) {
                if (this._options.count < 2) {
                    yield path.points[0];
                    yield path.points[1];
                    return;
                }

                const totalLength = GeoSegment.Length(path, dp);
                distance = totalLength / (this._options.count - 1);
            }
        }

        if (distance) {
            let cumulativLength = 0;

            let a = path.points[0];
            const endMode = this._options?.endMode ?? PathwayPointGeneratorEndMode.BOTH;
            if (endMode === PathwayPointGeneratorEndMode.BEGIN || endMode === PathwayPointGeneratorEndMode.BOTH) {
                yield a;
            }
            for (let i = 1; i < path.points.length; i++) {
                const b = path.points[i];
                let d = dp.getDistanceFromFloat(a.lat, a.lon, b.lat, b.lon);
                if (d + cumulativLength > distance) {
                    const az = dp.getAzimuthFromFloat(a.lat, a.lon, b.lat, b.lon);
                    do {
                        const remain = distance - cumulativLength;
                        const p2 = dp.getLocationAtDistanceAzimuth(a.lat, a.lon, remain, az);
                        const p3 = new Geo3(p2);
                        yield p3;
                        d -= remain;
                        cumulativLength = 0;
                        a = p3;
                    } while (d >= distance);
                }
                cumulativLength += d;
                a = b;
            }
            if (endMode === PathwayPointGeneratorEndMode.END || endMode === PathwayPointGeneratorEndMode.BOTH) {
                yield path.points[path.points.length - 1];
            }
        }
    }
}

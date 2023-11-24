import { IDistanceProcessor } from "../geodesy/geodesy.interfaces";
import { IGeo3, IGeoSegment } from "./geography.interfaces";
export declare enum PathwayPointGeneratorEndMode {
    BEGIN = 1,
    END = 2,
    BOTH = 3
}
export declare class PathwayPointGeneratorOptions {
    distanceProcessor?: IDistanceProcessor;
    distance?: number;
    count?: number;
    endMode?: PathwayPointGeneratorEndMode;
}
export declare class PathwayPointGeneratorBuilder {
    _options?: PathwayPointGeneratorOptions;
    constructor();
    withOptions(options: PathwayPointGeneratorOptions): PathwayPointGeneratorBuilder;
    withEndMode(mode: PathwayPointGeneratorEndMode): PathwayPointGeneratorBuilder;
    withDistanceProcessor(processor: IDistanceProcessor): PathwayPointGeneratorBuilder;
    withDistance(distance: number): PathwayPointGeneratorBuilder;
    withCount(count: number): PathwayPointGeneratorBuilder;
    build(): PathwayPointGenerator;
}
export declare class PathwayPointGenerator {
    _options?: PathwayPointGeneratorOptions;
    constructor(options?: PathwayPointGeneratorOptions);
    generate(path: IGeoSegment<IGeo3>): IterableIterator<IGeo3>;
}

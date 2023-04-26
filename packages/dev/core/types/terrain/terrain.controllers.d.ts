import { IGeo3 } from "core/geography/geography.interfaces";
import { PlanetSurface } from "./terrain.surface";
export declare class SurfaceObservationControllerOptions {
    static Shared: SurfaceObservationControllerOptions;
    static DefaultDistanceThresold: number;
    distanceThresold?: number;
}
export declare class SurfaceObservationController {
    private _surface;
    private _position?;
    private _o;
    constructor(surface: PlanetSurface, options?: SurfaceObservationControllerOptions);
    setObserverPosition(p: IGeo3): void;
    private computeDistance;
}

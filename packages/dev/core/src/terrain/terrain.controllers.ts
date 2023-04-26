import { ICartesian3, IGeo3 } from "core/geography/geography.interfaces";
import { PlanetSurface } from "./terrain.surface";

export class SurfaceObservationControllerOptions {
    public static Shared = new SurfaceObservationControllerOptions();

    public static DefaultDistanceThresold = 1000;

    distanceThresold?: number = SurfaceObservationControllerOptions.DefaultDistanceThresold;
}

export class SurfaceObservationController {
    private _surface: PlanetSurface;
    private _position?: IGeo3;
    private _o: SurfaceObservationControllerOptions;

    public constructor(surface: PlanetSurface, options?: SurfaceObservationControllerOptions) {
        this._surface = surface;
        this._o = { ...SurfaceObservationControllerOptions.Shared, ...options };
    }

    public setObserverPosition(p: IGeo3) {
        if (p && !p.equals(this._position)) {
            const system = this._surface._system;
            const enu = system.ENUReference;
            if (enu !== undefined) {
                const a = <ICartesian3>{ x: 0, y: 0, z: 0 };
                const b = <ICartesian3>{ x: 0, y: 0, z: 0 };
                system.geodeticToCartesianToRef(enu, a);
                system.geodeticToCartesianToRef(p, b);
                const d = this._o.distanceThresold || SurfaceObservationControllerOptions.DefaultDistanceThresold;
                if (this.computeDistance(a, b) > d) {
                    // we update the ENU reference
                    system.ENUReference = p;
                }
            }
            this._position = p;
        }
    }

    private computeDistance(a: ICartesian3, b: ICartesian3): number {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = a.z && b.z ? b.z - a.z : 0;

        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}

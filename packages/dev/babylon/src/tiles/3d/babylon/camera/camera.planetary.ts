import { ArcRotateCamera, Scene, Vector3 } from "@babylonjs/core";
import { Ellipsoid, GeodeticSystem } from "core/geodesy";
import { Geo3, IGeo3, IsLocation } from "core/geography";
import { Range } from "core/math";
import { EcefToBjsCartInPlace } from "../../interfaces/math/math";

export class PlanetoryCamera extends ArcRotateCamera {
    public static DefaultAltitudeRange = new Range(25.0, 5_000_000.0);

    private _system: GeodeticSystem;
    private _altitudeRange: Range;
    private _geo: IGeo3 = Geo3.Zero();
    private _ecefCache: Vector3 = Vector3.Zero();

    constructor(name: string, geoPosition: IGeo3, scene: Scene, ellipsoid?: Ellipsoid, altitudeRange?: Range) {
        super(name, 0, 0, 0, Vector3.Zero(), scene);

        const e = ellipsoid ?? Ellipsoid.WGS84;
        this._system = new GeodeticSystem(e);
        this._altitudeRange = altitudeRange ?? new Range(PlanetoryCamera.DefaultAltitudeRange.min, PlanetoryCamera.DefaultAltitudeRange.max);
        this.setPosition(geoPosition);

        // Feel & limits
        this.useBouncingBehavior = false;

        // Let ArcRotate cross poles; avoid exact singularities with tight beta limits
        this.allowUpsideDown = true;
        this.lowerBetaLimit = 0.001;
        this.upperBetaLimit = Math.PI - 0.001;

        // Per-frame maintenance
        scene.onBeforeRenderObservable.add(() => {
            // Clamp radius from altitude limits using ellipsoid surface radius along current geocentric ray.
            const dir = this.position.clone().normalize();
            const radius = this._system.ellipsoid.radiusAtPosition(dir.x, dir.y, dir.z);
            let altitude = this.position.length() - radius;
            let clamped = this._altitudeRange.clamp(altitude);
            if (altitude != clamped) {
                // enforce new position = direction * (surface + clamped altitude)
                this.position = dir.scale(radius + clamped);
            }

            // Recompute pan/orbit/wheel sensitivity from current altitude (called each frame).
            this.wheelPrecision = this._getWheelPrecision(clamped);
        });
    }

    public override setPosition(p: Vector3): void;
    public override setPosition(p: IGeo3): void;

    public setPosition(p: Vector3 | IGeo3): void {
        if (IsLocation(p)) {
            this._geo.lat = p.lat;
            this._geo.lon = p.lon;
            this._geo.alt = this._altitudeRange.clamp(p.alt ?? 0);
            this._system.geodeticFloatToCartesianToRef(this._geo.lat, this._geo.lon, this._geo.alt, this._ecefCache, true);
            EcefToBjsCartInPlace(this._ecefCache);
            super.setPosition(this._ecefCache);
        } else {
            super.setPosition(p);
        }
    }

    /**
     * Faster when high (≈0.001), barely changes until 20 km, then ramps to 10 at ground.
     * We may replace this with a way to afect meter to each wheel unit
     */
    private _getWheelPrecision(alt: number): number {
        if (!isFinite(alt) || alt < 0) alt = 0;

        // Targets
        const pMin = 1e-3; // ~0.001 in space
        const pMid = 1e-2; // ~0.010 at 20 km
        const pMax = 1; // near ground
        const a1 = 20_000; // 20 km breakpoint

        if (alt >= a1) {
            // Very slow rise: pMin -> pMid as alt drops from ∞ to 20 km
            const m = 1.5; // bigger => flatter (slower change)
            const ratio = a1 / alt; // (0,1]
            return pMin + (pMid - pMin) * Math.pow(ratio, m);
        } else {
            // Smooth ramp: pMid at 20 km -> pMax at ground
            const t = 1 - alt / a1; // 0 at 20 km, 1 at ground
            const s = t * t * (3 - 2 * t); // smoothstep(0..1)
            return pMid + (pMax - pMid) * s;
        }
    }
}

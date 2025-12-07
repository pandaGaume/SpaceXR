import { ICameraInput, Observer, PointerEventTypes, PointerInfo } from "@babylonjs/core";
import { Ellipsoid } from "core/geodesy";
import { PlanetoryCamera } from "./camera.planetary";
import { BjsToEcefCartInPlace, EcefToBjsCartInPlace } from "../../interfaces/math/math";

export class PlanetoryWheelMetersInput implements ICameraInput<PlanetoryCamera> {
    public camera!: PlanetoryCamera;

    constructor(
        private ellipsoid: Ellipsoid,
        private metersPerStep: (alt: number, rawDelta: number) => number,
        private clampAlt: (alt: number) => number,
        private invert = false
    ) {}

    private _obs?: Observer<PointerInfo>;

    getClassName() {
        return "PlanetoryWheelMetersInput";
    }

    getSimpleName() {
        return "wheelMeters";
    }

    attachControl(): void {
        const scene = this.camera.getScene();
        this._obs = scene.onPointerObservable.add((pi) => {
            if (pi.type !== PointerEventTypes.POINTERWHEEL) return;
            const ev = pi.event as WheelEvent;
            const raw = ev.deltaY ?? 0;
            if (!raw) return;

            // Geocentric direction (ECEF)
            const pos = this.camera.position; // world/ECEF coords
            BjsToEcefCartInPlace(pos);

            const rlen = pos.length();
            if (!isFinite(rlen) || rlen === 0) return;
            const dir = pos.scale(1 / rlen);

            // Surface radius along current ray + current altitude
            const R = this.ellipsoid.radiusAtPosition(dir.x, dir.y, dir.z);
            const alt = rlen - R;

            // Normalize wheel magnitude (~1 per notch; trackpads yield fractions)
            const mag = Math.min(1, Math.abs(raw) / 120);
            const stepMeters = this.metersPerStep(alt, raw) * mag;
            const sgn = (raw > 0 ? 1 : -1) * (this.invert ? -1 : 1);

            let newAlt = this.clampAlt(alt + sgn * stepMeters);
            const newRadiusFromCenter = R + newAlt;

            // If target is at the geocenter, we can set camera.radius directly
            const targetIsCenter = this.camera.target.lengthSquared() < 1e-10;

            if (targetIsCenter) {
                this.camera.radius = newRadiusFromCenter; // alpha/beta unchanged
            } else {
                // Keep geocentric direction, move position along that ray in meters,
                // then let ArcRotate recompute alpha/beta/radius against the same target.
                const newPos = dir.scale(newRadiusFromCenter);
                EcefToBjsCartInPlace(newPos);
                this.camera.setPosition(newPos);
            }

            ev.preventDefault();
        });
    }

    detachControl(): void {
        if (this._obs) this.camera.getScene().onPointerObservable.remove(this._obs);
        this._obs = undefined;
    }
}

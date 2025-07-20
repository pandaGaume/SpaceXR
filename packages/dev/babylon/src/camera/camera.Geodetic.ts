import * as BABYLON from "@babylonjs/core";
import { Ellipsoid, GeodeticSystem } from "core/geodesy";

export class GeodeticCamera extends BABYLON.ArcRotateCamera {
    private _system: GeodeticSystem;

    constructor(name: string, scene: BABYLON.Scene, ellipsoid: Ellipsoid) {
        const globeRadius = ellipsoid.semiMajorAxis; // in meter
        const alpha = 0; // heading (longitude)
        const beta = 0; // pitch (latitude)
        const radius = globeRadius * 2.5;
        const target = BABYLON.Vector3.Zero();

        super(name, alpha, beta, radius, target, scene);

        this._system = new GeodeticSystem(ellipsoid);
        this.lowerRadiusLimit = globeRadius * 0.5;
        this.upperRadiusLimit = globeRadius * 10;
        this.allowUpsideDown = false;
        this.wheelPrecision = 1000;
        this.panningSensibility = 0;
        this.inertia = 0.8;
    }

    public get system(): GeodeticSystem {
        return this._system;
    }
}

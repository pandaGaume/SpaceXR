import { Nullable, Scene, Vector3 } from "@babylonjs/core";
import { ClipIndex, ClipPlaneDefinition, HolographicBoundsType, IHolographicBox } from "./display.holographic.bounds";
import { VirtualDisplay } from "./display.virtual";
import { ISize3 } from "core/geometry";
import { Observable } from "core/events";

export class HolographicDisplay extends VirtualDisplay implements IHolographicBox {
    public static BuildLateralClipPlanes(display: VirtualDisplay): Array<ClipPlaneDefinition> {
        const clipPlanes = new Array<ClipPlaneDefinition>();
        const halfWidth: number = display.halfDimension.width;
        const halfHeight: number = display.halfDimension.height;

        const nNorth = new Vector3(0, 1, 0);
        const nSouth = new Vector3(0, -1, 0);
        const nEast = new Vector3(1, 0, 0);
        const nWest = new Vector3(-1, 0, 0);

        const position = display.node.position;

        clipPlanes.push(new ClipPlaneDefinition(ClipIndex.North, position.add(nNorth.scale(halfHeight)), nSouth));
        clipPlanes.push(new ClipPlaneDefinition(ClipIndex.South, position.add(nSouth.scale(halfHeight)), nNorth));
        clipPlanes.push(new ClipPlaneDefinition(ClipIndex.East, position.add(nEast.scale(halfWidth)), nWest));
        clipPlanes.push(new ClipPlaneDefinition(ClipIndex.West, position.add(nWest.scale(halfWidth)), nEast));

        return clipPlanes;
    }

    public static buildHorizontalClipPlanes(display: VirtualDisplay): Array<ClipPlaneDefinition> {
        const clipPlanes = new Array<ClipPlaneDefinition>();
        const halfThickness: number = display.halfDimension.depth;

        const nTop = new Vector3(0, 0, 1);
        const nBottom = new Vector3(0, 0, -1);
        const position = display.node.position;
        clipPlanes.push(new ClipPlaneDefinition(ClipIndex.Top, position.add(nTop.scale(halfThickness)), nBottom));
        clipPlanes.push(new ClipPlaneDefinition(ClipIndex.Bottom, position.add(nBottom.scale(halfThickness)), nTop));

        return clipPlanes;
    }

    private _clipPlanesAddedObservable?: Observable<Array<ClipPlaneDefinition>>;
    private _clipPlanesRemovedObservable?: Observable<Array<ClipPlaneDefinition>>;
    private _clipPlanes: Nullable<Array<ClipPlaneDefinition>> = null;

    public constructor(name: string, dimension: ISize3, resolution: ISize3, scene?: Scene) {
        super(name, dimension, resolution, scene);
        this._clipPlanes = HolographicDisplay.BuildLateralClipPlanes(this).concat(HolographicDisplay.buildHorizontalClipPlanes(this));
    }

    public get clipPlanesAddedObservable(): Observable<Array<ClipPlaneDefinition>> {
        if (!this._clipPlanesAddedObservable) {
            this._clipPlanesAddedObservable = new Observable<Array<ClipPlaneDefinition>>();
        }
        return this._clipPlanesAddedObservable;
    }

    public get clipPlanesRemovedObservable(): Observable<Array<ClipPlaneDefinition>> {
        if (!this._clipPlanesRemovedObservable) {
            this._clipPlanesRemovedObservable = new Observable<Array<ClipPlaneDefinition>>();
        }
        return this._clipPlanesRemovedObservable;
    }

    public get clipPlanes(): Nullable<Array<ClipPlaneDefinition>> {
        return this._clipPlanes;
    }

    public get clipPlanesWorld(): Nullable<Array<ClipPlaneDefinition>> {
        if (!this._clipPlanes || this._clipPlanes.length === 0) return null;
        const world = new Array<ClipPlaneDefinition>();
        const transform = this.node.getWorldMatrix();
        for (const plane of this._clipPlanes) {
            const p = Vector3.TransformCoordinates(plane.point, transform);
            const n = Vector3.TransformNormal(plane.normal, transform);
            world.push(new ClipPlaneDefinition(plane.index, p, n));
        }
        return world;
    }

    public get type(): HolographicBoundsType {
        return HolographicBoundsType.BOX;
    }
}

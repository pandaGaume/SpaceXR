import { Nullable, Scene } from "@babylonjs/core";
import { ClipPlaneDefinition, HolographicBoundsType, IHolographicBox } from "./display.holographic.bounds";
import { VirtualDisplay } from "./display.virtual";
import { ISize3 } from "core/geometry";
import { Observable } from "core/events";
export declare class HolographicDisplay extends VirtualDisplay implements IHolographicBox {
    static BuildLateralClipPlanes(display: VirtualDisplay): Array<ClipPlaneDefinition>;
    static buildHorizontalClipPlanes(display: VirtualDisplay): Array<ClipPlaneDefinition>;
    private _clipPlanesAddedObservable?;
    private _clipPlanesRemovedObservable?;
    private _clipPlanes;
    constructor(name: string, dimension: ISize3, resolution: ISize3, scene?: Scene);
    get clipPlanesAddedObservable(): Observable<Array<ClipPlaneDefinition>>;
    get clipPlanesRemovedObservable(): Observable<Array<ClipPlaneDefinition>>;
    get clipPlanes(): Nullable<Array<ClipPlaneDefinition>>;
    get clipPlanesWorld(): Nullable<Array<ClipPlaneDefinition>>;
    get type(): HolographicBoundsType;
}

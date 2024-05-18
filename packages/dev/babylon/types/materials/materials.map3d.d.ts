import { AbstractMesh, Effect, MaterialDefines, PushMaterial, Scene, SubMesh } from "@babylonjs/core";
import { ITile, ImageLayer } from "core/tiles";
import { Range } from "core/math";
import { ClipIndex, ClipPlaneDefinition } from "./materials.clipPlane";
import { ElevationLayer } from "../map";
import { IDemInfos } from "core/dem";
export declare class Map3dMaterialDefines extends MaterialDefines {
    constructor();
}
export declare class Map3dMaterial extends PushMaterial {
    static ElevationKind: string;
    static NormalKind: string;
    static LayerKind: string;
    private _elevationSampler;
    private _normalSampler;
    private _layerSampler;
    private _elevationOffset;
    private _elevationRange;
    private _clipPlanes;
    constructor(name: string, scene?: Scene);
    addClipPlane(...clipPlanes: ClipPlaneDefinition[]): void;
    removeClipPlane(...indices: ClipIndex[]): void;
    get elevationRange(): Range;
    get elevationOffset(): number;
    set elevationOffset(value: number);
    isReadyForSubMesh(mesh: AbstractMesh, subMesh: SubMesh, useInstances?: boolean): boolean;
    demAdded(src: ElevationLayer, eventData: ITile<IDemInfos>): void;
    demRemoved(src: ElevationLayer, eventData: ITile<IDemInfos>): void;
    demUpdated(src: ElevationLayer, eventData: ITile<IDemInfos>): void;
    imageAdded(src: ImageLayer, eventData: ITile<HTMLImageElement>): void;
    imageRemoved(src: ImageLayer, eventData: ITile<HTMLImageElement>): void;
    imageUpdated(src: ImageLayer, eventData: ITile<HTMLImageElement>): void;
    protected _buildSampler(kind: string, width: number, height: number, depth: number, generateMipMap: boolean, scene: Scene): void;
    protected _bindSamplers(effect: Effect): void;
}

import { AbstractMesh, Color4, Effect, Light, MaterialDefines, Nullable, PushMaterial, Scene, SubMesh } from "@babylonjs/core";
import { ITile, ITileAddress, ImageLayer } from "core/tiles";
import { Range } from "core/math";
import { ClipIndex, ClipPlaneDefinition } from "./materials.clipPlane";
import { ElevationLayer } from "../map";
import { ITexture3Layer } from "babylon_ext/Materials";
import { IDemInfos } from "core/dem";
export declare enum Map3dShadingMode {
    FLAT = 0,
    GOUREAUD = 1,
    PHONG = 2,
    BLINN_PHONG = 3
}
export declare class Map3dMaterialDefines extends MaterialDefines {
    constructor();
}
declare class TileBag {
    address: ITileAddress;
    elevationArea: Nullable<ITexture3Layer>;
    normalArea: Nullable<ITexture3Layer>;
    constructor(address: ITileAddress, elevationArea?: Nullable<ITexture3Layer>, normalArea?: Nullable<ITexture3Layer>);
}
export declare class Map3dMaterial extends PushMaterial {
    static DefaultTerrainColor: Color4;
    static ElevationKind: string;
    static NormalKind: string;
    static LayerKind: string;
    _terrainColor: Nullable<Color4>;
    _shadingMode: Map3dShadingMode;
    _bags: Map<string, TileBag>;
    private _elevationSampler;
    private _normalSampler;
    private _layerSampler;
    private _elevationOffset;
    private _elevationRange;
    private _clipPlanes;
    private _lightFilter;
    private _lightAddedObserver;
    private _lightRemovedObserver;
    constructor(name: string, scene?: Scene);
    getLights(): Light[];
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
    dispose(forceDisposeEffect?: boolean, forceDisposeTextures?: boolean, notBoundToMesh?: boolean): void;
    protected _buildSampler(kind: string, width: number, height: number, depth: number, generateMipMap: boolean, scene: Scene): void;
    protected _bindSamplers(effect: Effect): void;
    protected _acceptLight(light: Light): boolean;
    protected _lightAdded(light: Light): void;
    protected _lightRemoved(light: Light): void;
}
export {};

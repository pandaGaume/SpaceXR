import { AbstractMesh, Color4, Effect, Light, Matrix, Mesh, Nullable, Observer, PushMaterial, Scene, SubMesh } from "@babylonjs/core";
import { ITile, ImageLayer } from "core/tiles";
import { Range } from "core/math";
import { ClipIndex, ClipPlaneDefinition, IHasHolographicBounds, IHolographicBounds } from "../display/display.clipPlane";
import { ElevationLayer, ElevationTile, IHasMapScale, IMap3dElevationTarget, IMap3dImageTarget } from "../map";
import { ITexture3Layer, Texture3 } from "./textures";
import { Map3dTexture } from "./textures";
import { IDemInfos } from "core/dem";
import { ICartesian3 } from "core/geometry";
export declare enum Map3dShadingMode {
    FLAT = 0,
    GOUREAUD = 1,
    PHONG = 2,
    BLINN_PHONG = 3
}
declare class AreaInfos {
    layer: ITexture3Layer;
    adjacentIds: Array<number>;
    constructor(layer: ITexture3Layer);
}
declare class TileBag {
    tile: ElevationTile;
    elevationArea: Nullable<AreaInfos>;
    normalArea: Nullable<AreaInfos>;
    textureArea: Nullable<AreaInfos>;
    constructor(tile: ElevationTile, elevationArea?: Nullable<AreaInfos>, normalArea?: Nullable<AreaInfos>, textureArea?: Nullable<AreaInfos>);
}
export interface IMap3dMaterial extends IMap3dElevationTarget, IMap3dImageTarget, IHasHolographicBounds, IHasMapScale {
}
export declare enum Map3dLayerKind {
    Elevation = 0,
    Normal = 1,
    Texture = 2
}
export declare class Map3dMaterial extends PushMaterial implements IMap3dMaterial {
    static DefaultTerrainColor: Color4;
    static DemInfosAttName: string;
    static DemIdsAttName: string;
    static LayerIdsAttName: string;
    static WorldMatrixUniformName: string;
    static ViewProjectionMatrixUniformName: string;
    static TerrainColorUniformName: string;
    static ShininessUniformName: string;
    static HemiLightUniformName: string;
    static PointLightsUniformName: string;
    static SpotLightsUniformName: string;
    static NumPointLightsUniformName: string;
    static NumSpotLightsUniformName: string;
    static AmbientLightUniformName: string;
    static AltRangeUniformName: string;
    static MapScaleUniformName: string;
    static ElevationSamplerUniformName: string;
    static NormalSamplerUniformName: string;
    static SpecularMapSamplerUniformName: string;
    static TextureSamplerUniformName: string;
    static NorthClipPlaneUniformName: string;
    static SouthClipPlaneUniformName: string;
    static EastClipPlaneUniformName: string;
    static WestClipPlaneUniformName: string;
    protected _shaderName: Nullable<string>;
    protected _terrainColor: Nullable<Color4>;
    protected _shininess: number;
    protected _shadingMode: Map3dShadingMode;
    protected _maxSpotLights: number;
    protected _maxPointLights: number;
    protected _bags: Map<string, TileBag>;
    private _elevationSampler;
    private _normalSampler;
    private _textureSampler;
    private _elevationRange;
    private _mapScale;
    private _holoBounds;
    protected _lightFilter: Nullable<(light: Light) => boolean>;
    protected _lightAddedObserver: Nullable<Observer<Light>>;
    protected _lightRemovedObserver: Nullable<Observer<Light>>;
    constructor(name: string, shaderName: string, scene?: Scene);
    get holographicBounds(): Nullable<IHolographicBounds>;
    set holographicBounds(value: Nullable<IHolographicBounds>);
    getLights(): Light[];
    get mapScale(): ICartesian3;
    set mapScale(value: ICartesian3);
    isReadyForSubMesh(mesh: AbstractMesh, subMesh: SubMesh, useInstances?: boolean): boolean;
    protected _prepareUniforms(name: string, ...properties: string[]): string[];
    protected _prepareArrayOfUniforms(name: string, count: number, ...properties: string[]): string[];
    protected _isReady(mesh: AbstractMesh, subMesh: SubMesh, useInstances?: boolean): boolean;
    demAdded(src: ElevationLayer, eventData: ITile<IDemInfos>): void;
    protected _updateAdjacentIds(bag: TileBag): void;
    protected _getAdjacentIds(quadkey: Nullable<string>, index?: number): number;
    protected _setAdjacentIds(quadkey: Nullable<string>, index: number, id?: number): void;
    protected _setAdjacentIdsFromBag(bag: TileBag, index: number, id?: number): void;
    protected _createZeroBuffer(size: number): Uint8Array;
    demRemoved(src: ElevationLayer, eventData: ITile<IDemInfos>): void;
    demUpdated(src: ElevationLayer, eventData: ITile<IDemInfos>): void;
    imageAdded(src: ImageLayer, eventData: ITile<HTMLImageElement>): void;
    imageRemoved(src: ImageLayer, eventData: ITile<HTMLImageElement>): void;
    imageUpdated(src: ImageLayer, eventData: ITile<HTMLImageElement>): void;
    dispose(forceDisposeEffect?: boolean, forceDisposeTextures?: boolean, notBoundToMesh?: boolean): void;
    bindForSubMesh(world: Matrix, mesh: Mesh, subMesh: SubMesh): void;
    protected _bindLights(effect: Effect): void;
    protected _bindTerrainMatter(effect: Effect): void;
    protected _bindElevations(effect: Effect): void;
    protected _bindMatrix(effect: Effect, world: Matrix, scene: Scene): void;
    protected _bindClipPlanes(effect: Effect): void;
    protected _bindClipPlane(effect: Effect, planes: Array<ClipPlaneDefinition>, name: string, index: ClipIndex): void;
    protected _bindSamplers(effect: Effect): void;
    protected _acceptLight(light: Light): boolean;
    protected _lightAdded(light: Light): void;
    protected _lightRemoved(light: Light): void;
    protected _setupLights(): void;
    protected _registerInstanceBuffers(target: Mesh): void;
    protected _ensureElevationLayerReady(src: ElevationLayer, eventData: ITile<IDemInfos>): void;
    protected _buildSamplers(layer: ElevationLayer): void;
    protected _getElevationSamplerDepth(layer: ElevationLayer): number;
    protected _buildSampler(kind: Map3dLayerKind, width: number, height: number, depth: number, generateMipMap: boolean, scene: Scene): Nullable<Texture3> | Nullable<Map3dTexture>;
    protected _onEffectCompiled(effect: Effect): void;
    protected _onEffectError(effect: Effect, errors: string): void;
    protected _buildElevationRange(): Range;
    protected _updateElevationRange(elevationTile: ITile<IDemInfos>): void;
    protected _getElevationRange(): Range;
}
export {};

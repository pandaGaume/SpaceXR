import { AbstractMesh, Color4, Effect, Light, Matrix, Mesh, Nullable, Observer, PushMaterial, Scene, SubMesh } from "@babylonjs/core";
import { IPipelineMessageType, ITargetBlock, ITile } from "core/tiles";
import { Range } from "core/math";
import { ClipIndex, ClipPlaneDefinition, IHasHolographicBox, IHolographicBox } from "../display";
import { ElevationTile, IHasMapScale } from "../map";
import { ITexture3Layer, Texture3 } from "./textures";
import { ICartesian3, ISize2 } from "core/geometry";
import { EventState } from "..";
export declare enum Map3dShadingMode {
    FLAT = 0,
    GOUREAUD = 1,
    PHONG = 2,
    BLINN_PHONG = 3
}
declare class AreaInfos {
    layer: ITexture3Layer;
    adjacentIds: Array<number>;
    isReady: boolean;
    constructor(layer: ITexture3Layer);
}
export declare enum Map3dLayerKind {
    Elevation = 0,
    Normal = 1,
    Texture = 2
}
declare class TileBag {
    tile: ElevationTile;
    areas: Array<Nullable<AreaInfos>>;
    constructor(tile: ElevationTile, areas?: Array<Nullable<AreaInfos>>);
    getArea(kind: Map3dLayerKind): Nullable<AreaInfos>;
    setArea(kind: Map3dLayerKind, value: Nullable<AreaInfos>): void;
}
export interface IMap3dMaterial extends ITargetBlock<ElevationTile | ITile<ImageData>>, IHasHolographicBox, IHasMapScale {
}
export declare class Map3dMaterial extends PushMaterial implements IMap3dMaterial {
    static DefaultTerrainColor: Color4;
    static DemInfosAttName: string;
    static DemIdsAttName: string;
    static NormalIdsAttName: string;
    static TextureIdsAttName: string;
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
    static TextureSamplerUniformName: string;
    static SpecularMapSamplerUniformName: string;
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
    private _textureResolution?;
    protected _lightFilter: Nullable<(light: Light) => boolean>;
    protected _lightAddedObserver: Nullable<Observer<Light>>;
    protected _lightRemovedObserver: Nullable<Observer<Light>>;
    constructor(name: string, shaderName: string, scene?: Scene);
    get textureResolution(): ISize2 | undefined;
    set textureResolution(value: ISize2 | undefined);
    get holographicBox(): Nullable<IHolographicBox>;
    set holographicBox(value: Nullable<IHolographicBox>);
    getLights(): Light[];
    get mapScale(): ICartesian3;
    set mapScale(value: ICartesian3);
    get terrainColor(): Nullable<Color4>;
    set terrainColor(value: Nullable<Color4>);
    get shininess(): number;
    set shininess(value: number);
    added(eventData: IPipelineMessageType<ElevationTile | ITile<ImageData>>, eventState: EventState): void;
    removed(eventData: IPipelineMessageType<ElevationTile | ITile<ImageData>>, eventState: EventState): void;
    updated(eventData: IPipelineMessageType<ElevationTile | ITile<ImageData>>, eventState: EventState): void;
    isReadyForSubMesh(mesh: AbstractMesh, subMesh: SubMesh, useInstances?: boolean): boolean;
    protected _prepareUniforms(name: string, ...properties: string[]): string[];
    protected _prepareArrayOfUniforms(name: string, count: number, ...properties: string[]): string[];
    protected _isReady(mesh: AbstractMesh, subMesh: SubMesh, useInstances?: boolean): boolean;
    protected _demAdded(tile: ElevationTile, source: any): void;
    protected _updateAdjacentIds(bag: TileBag, kind: Map3dLayerKind): void;
    protected _getAdjacentIds(quadkey: Nullable<string>, kind: Map3dLayerKind, index?: number): number;
    protected _setAdjacentIds(quadkey: Nullable<string>, index: number, kind: Map3dLayerKind, id?: number): void;
    protected _setAdjacentIdsFromBag(bag: TileBag, index: number, kind: Map3dLayerKind, id?: number): void;
    protected _createZeroBuffer(n: number): ArrayBufferView;
    protected _demRemoved(eventData: ElevationTile): void;
    protected _demUpdated(eventData: ElevationTile): void;
    protected _imageAdded(tile: ITile<ImageData>): void;
    protected _imageRemoved(tile: ITile<ImageData>): void;
    protected _imageUpdated(tile: ITile<ImageData>): void;
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
    protected _ensureElevationLayerReady(tile: ElevationTile, src: any): void;
    protected _buildElevationSamplers(width: number, height?: number, depth?: number): void;
    protected _buildTextureSamplers(width: number, height?: number, depth?: number): void;
    protected _getTextureSamplerDepth(): number;
    protected _getElevationSamplerDepth(): number;
    protected _buildSampler(kind: Map3dLayerKind, width: number, height: number, depth: number, generateMipMap: boolean, scene: Scene): Nullable<Texture3>;
    protected _onEffectCompiled(effect: Effect): void;
    protected _onEffectError(effect: Effect, errors: string): void;
    protected _buildElevationRange(): Range;
    protected _updateElevationRange(elevationTile: ElevationTile): void;
    protected _getElevationRange(): Range;
    protected _growSamplersDepth(): void;
}
export {};

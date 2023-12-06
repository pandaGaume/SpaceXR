import { PushMaterial, Scene, Mesh, Matrix, AbstractMesh, Vector3, SubMesh, Color4 } from "@babylonjs/core";
import { SurfaceMapDisplay, SurfaceTileMap } from "../terrain";
import { IDemInfos } from "core/dem";
import { ITileClient } from "core/tiles";
import { Range } from "core/math";
export declare enum ClipIndex {
    North = 0,
    South = 1,
    East = 2,
    West = 3
}
declare class SurfaceDefinition {
    point: Vector3;
    normal: Vector3;
    constructor(point: Vector3, normal: Vector3);
}
export declare class TerrainHologramMaterialOptions {
    static DefaultBackgroundColor: Color4;
    static DefaultEdgeColor: Color4;
    static DefaultEdgeThickness: number;
    static DefaultExageration: number;
    layerClient?: ITileClient<HTMLImageElement>;
    exageration?: number;
    backgroundColor?: Color4;
    edgeColor?: Color4;
    edgeThickness?: number;
}
export declare class TerrainHologramMaterialAtt {
    static DemInfosKind: string;
    static DemIdsKind: string;
    static LayerIdsKind: string;
}
export declare class TerrainHologramMaterialSampler {
    static ElevationKind: string;
    static NormalKind: string;
    static LayerKind: string;
}
export declare class TerrainHologramMaterial<V extends IDemInfos, H extends SurfaceMapDisplay> extends PushMaterial {
    static ClassName: string;
    static ShaderName: string;
    private _map;
    private _layerClient?;
    private _tileBags;
    private _added;
    private _updated;
    private _removed;
    private _viewUpdated;
    private _elevationSampler;
    private _normalSampler;
    private _layerSampler;
    private _elevationRange;
    private _elevationExageration;
    private _mapScale;
    private _clipSurfaces;
    _backgroundColor: Color4;
    _edgeColor: Color4;
    _edgeThickness: number;
    constructor(name: string, map: SurfaceTileMap<V, H>, options: TerrainHologramMaterialOptions, scene: Scene);
    get LayerClient(): ITileClient<HTMLImageElement> | undefined;
    set LayerClient(v: ITileClient<HTMLImageElement> | undefined);
    getClassName(): string;
    get map(): SurfaceTileMap<V, H>;
    get elevationRange(): Range;
    get elevationExageration(): number;
    set elevationExageration(v: number);
    get mapScale(): number;
    private set mapScale(value);
    get clipSurfaces(): SurfaceDefinition[];
    get edgeColor(): Color4;
    set edgeColor(v: Color4);
    get edgeThickness(): number;
    set edgeThickness(v: number);
    isReadyForSubMesh(mesh: AbstractMesh, subMesh: SubMesh, useInstances?: boolean): boolean;
    bindForSubMesh(world: Matrix, mesh: Mesh, subMesh: SubMesh): void;
    dispose(forceDisposeEffect?: boolean): void;
    clone(name: string): TerrainHologramMaterial<V, H>;
    private _bindMatrix;
    private _bindClipPlane;
    private _bindSamplers;
    private _bindMisc;
    private _registerInstanceBuffer;
    private _onTileAdded;
    private _onTileUpdated;
    private _onTileRemoved;
    private _onViewUpdated;
    private _buildTextures;
    private _buildClipSurfaces;
    private _updateTileContent;
    private _loadLayer;
    private _updateLayer;
    private _loadLayerAreaAsync;
}
export {};

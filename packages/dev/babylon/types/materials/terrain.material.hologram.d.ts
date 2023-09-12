import { PushMaterial, Scene, Effect, Mesh, Matrix, AbstractMesh } from "@babylonjs/core";
import { SurfaceMapDisplay, SurfaceTileMap } from "../terrain";
import { IDemInfos } from "core/dem";
import { ITileClient } from "..";
export declare class TerrainHologramMaterialOptions {
    layerClient?: ITileClient<HTMLImageElement>;
}
export declare class TerrainHologramMaterial<V extends IDemInfos, H extends SurfaceMapDisplay> extends PushMaterial {
    static ClassName: string;
    static ElevationTextureName: string;
    static NormalTextureName: string;
    static LayerTextureName: string;
    private _map;
    private _layerClient?;
    private _tileBags;
    private _added;
    private _updated;
    private _removed;
    private _elevationSampler;
    private _normalSampler;
    private _layerSampler;
    constructor(name: string, map: SurfaceTileMap<V, H>, options: TerrainHologramMaterialOptions, scene: Scene);
    get LayerClient(): ITileClient<HTMLImageElement> | undefined;
    set LayerClient(v: ITileClient<HTMLImageElement> | undefined);
    getClassName(): string;
    isReady(mesh: AbstractMesh, useInstances: boolean): boolean;
    getEffect(): Effect;
    bind(world: Matrix, mesh: Mesh): void;
    unbind(): void;
    dispose(forceDisposeEffect?: boolean): void;
    clone(name: string): TerrainHologramMaterial<V, H>;
    private _onTileAdded;
    private _onTileUpdated;
    private _onTileRemoved;
    private _constructTextures;
}

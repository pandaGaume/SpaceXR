import { AbstractMesh, Mesh, TransformNode } from "@babylonjs/core";
import { IDemInfos } from "core/dem";
import { ICartesian3 } from "core/geometry";
import { IVerticesData, TerrainGridOptions, TerrainGridOptionsBuilder } from "core/meshes";
import { ImageLayerContentType, IsTile, IsTileMapLayer, ITile, ITileMap, ITileMapLayer, ITileMapLayerOptions, ITileMapLayerView } from "core/tiles";
import { IValidable, Nullable } from "core/types";
import { ElevationTexture } from "../materials/textures";
import { IHasHolographicBounds } from "../display";

export type ElevationMapContentType = IDemInfos | ImageLayerContentType;

export interface IElevationMap extends ITileMap<ElevationMapContentType>, IValidable {}

export interface IElevationHost extends ITileMapLayerView<IDemInfos> {
    tilesRoot: TransformNode;
    grid: Mesh;
}

export function IsElevationHost(b: unknown): b is IElevationHost {
    if (typeof b !== "object" || b === null) return false;
    return (<IElevationHost>b).tilesRoot && (<IElevationHost>b).tilesRoot instanceof TransformNode;
}

export interface IElevationGridFactory {
    buildTopology(options: number | TerrainGridOptions | TerrainGridOptionsBuilder): IVerticesData;
}

export interface IElevationLayerOptions extends ITileMapLayerOptions<IDemInfos> {
    exageration?: number;
    offsets?: ICartesian3;
}

export function IsElevationLayerOptions(b: unknown): b is IElevationLayerOptions {
    if (typeof b !== "object" || b === null) return false;
    return (<IElevationLayerOptions>b).exageration !== undefined || (<IElevationLayerOptions>b).offsets !== undefined;
}

export function IsElevationLayer(b: unknown): b is IElevationLayer {
    return IsTileMapLayer(b) && IsElevationLayerOptions(b);
}

export interface IElevationLayer extends ITileMapLayer<IDemInfos>, IElevationLayerOptions {}

export interface IElevationTile extends ITile<IDemInfos> {
    // the mesh used to display the elevation ()
    surface: Nullable<AbstractMesh>;
    // the texture used to display onto the elevation mesh
    textureSource: Nullable<ElevationTexture>;
}

export function IsElevationTile(b: unknown): b is IElevationTile {
    return IsTile<IDemInfos>(b) && (<IElevationTile>b).surface !== undefined;
}

// this is where we define the functional interface for the material, including the behaviors for the holographic bounds,
// the elevations and the texture mapping
export interface IMap3dMaterial extends IHasHolographicBounds {
    mapScale: ICartesian3;

    addTile(tiles: IElevationTile, source: IElevationHost): void;
    removeTile(tiles: IElevationTile, source: IElevationHost): void;
    updateTile(tiles: IElevationTile, source: IElevationHost): void;
}

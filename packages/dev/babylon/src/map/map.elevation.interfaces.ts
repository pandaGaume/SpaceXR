import { AbstractMesh, TransformNode } from "@babylonjs/core";
import { IDemInfos } from "core/dem";
import { ICartesian3 } from "core/geometry";
import { IVerticesData, TerrainGridOptions, TerrainGridOptionsBuilder } from "core/meshes";
import { ImageLayerContentType, IsTile, IsTileMapLayer, ITile, ITileMap, ITileMapLayer, ITileMapLayerOptions, ITileMapLayerView } from "core/tiles";
import { IValidable, Nullable } from "core/types";
import { ElevationTexture } from "../materials/textures";

export type ElevationMapContentType = IDemInfos | ImageLayerContentType;

export interface IElevationMap extends ITileMap<ElevationMapContentType>, IValidable {}

export interface IElevationHost extends ITileMapLayerView<IDemInfos> {
    tilesRoot: TransformNode;
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

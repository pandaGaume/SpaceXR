import { IDemInfos } from "core/dem";
import { ICartesian3, ISize3 } from "core/geometry";
import { IVerticesData, TerrainGridOptions, TerrainGridOptionsBuilder } from "core/meshes";
import { ImageLayerContentType, IsTileMapLayer, IsTileMapLayerProxy, ITile, ITileMap, ITileMapLayer, ITileMapLayerOptions, ITileMapLayerView } from "core/tiles";
import { IValidable, Nullable } from "core/types";
import { AbstractMesh, Mesh, TransformNode } from "@babylonjs/core";
import { IHasHolographicBounds } from "../display";

export type Map3DContentType = IDemInfos | ImageLayerContentType;

export interface IMap3D extends ITileMap<Map3DContentType>, IValidable {
    name: string;
}

export interface IElevationGridFactory {
    buildTopology(options: number | TerrainGridOptions | TerrainGridOptionsBuilder): IVerticesData;
}

export interface IElevationLayerOptions extends ITileMapLayerOptions<IDemInfos> {
    exageration?: number;
    offsets?: ICartesian3;
}

export interface IElevationLayer extends ITileMapLayer<IDemInfos>, IElevationLayerOptions {}

export function IsElevationLayerOptions(b: unknown): b is IElevationLayerOptions {
    if (typeof b !== "object" || b === null) return false;
    return (<IElevationLayerOptions>b).exageration !== undefined || (<IElevationLayerOptions>b).offsets !== undefined;
}

export function IsElevationLayer(b: unknown): b is IElevationLayer {
    return IsTileMapLayer(b) && IsElevationLayerOptions(b);
}

export interface IElevationHostOptions {
    gridOptions?: TerrainGridOptions;
}

export interface IElevationHost {
    // the grid model
    grid: Mesh;
    material: IMap3dMaterial;
}

export interface ITileWithElevation extends ITile<ImageLayerContentType> {
    surface: Nullable<AbstractMesh>;
}

export interface ITileMapLayerViewWithElevation extends ITileMapLayerView<ImageLayerContentType> {
    elevationHost: IElevationHost;
    tilesRoot: TransformNode;
}

export function IsTileWithElevation(b: unknown): b is ITileWithElevation {
    if (b === null || typeof b !== "object") return false;
    return (<ITileWithElevation>b).surface !== undefined;
}

export function IsTileMapLayerViewWithElevation(b: unknown): b is ITileMapLayerViewWithElevation {
    if (b === null || typeof b !== "object") return false;

    const obj = b as Partial<ITileMapLayerViewWithElevation>;
    return IsTileMapLayerProxy<ImageLayerContentType>(b) && obj.elevationHost !== undefined && obj.tilesRoot !== undefined;
}

// this is where we define the functional interface for the material, including the behaviors for the holographic bounds,
// the elevations and the texture mapping
export interface IMap3dMaterial extends IHasHolographicBounds {
    mapScale: ICartesian3;
    displayResolution: ISize3;

    addTile(tiles: ITileWithElevation, source: ITileMapLayerViewWithElevation): void;
    removeTile(tiles: ITileWithElevation, source: ITileMapLayerViewWithElevation): void;
    updateTile(tiles: ITileWithElevation, source: ITileMapLayerViewWithElevation): void;
}

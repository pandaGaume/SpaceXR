import { IDemInfos } from "core/dem";
import { ICartesian3, ISize3 } from "core/geometry";
import { IVerticesData, TerrainGridOptions, TerrainGridOptionsBuilder } from "core/meshes";
import { ImageLayerContentType, IsTile, ITargetBlock, ITile, ITileMap, ITileMapLayerView } from "core/tiles";
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

export interface IElevationHost<T extends ImageLayerContentType> extends ITileMapLayerView<T> {
    tilesRoot: TransformNode;
    // the grid model
    grid: Mesh;
    // the material model
    material: IMap3dMaterial<T>;
    // the elevation scale
    exageration?: number;
}

export interface ITileWithMesh<T> extends ITile<T> {
    surface: Nullable<AbstractMesh>;
}

export function IsTileWithMesh<T>(b: unknown): b is ITileWithMesh<T> {
    if (b === null || typeof b !== "object") return false;
    const obj = b as Partial<ITileWithMesh<T>>;
    return obj.surface !== undefined && IsTile(b);
}

export function IsElevationHost<T extends ImageLayerContentType>(b: unknown): b is IElevationHost<T> {
    if (b === null || typeof b !== "object") return false;

    const obj = b as Partial<IElevationHost<T>>;
    return obj.grid !== undefined && obj.material !== undefined && obj.tilesRoot !== undefined;
}

// this is where we define the functional interface for the material, including the behaviors for the holographic bounds,
// the elevations and the texture mapping
export interface IMap3dMaterial<T extends ImageLayerContentType> extends IHasHolographicBounds, ITargetBlock<ITileWithMesh<T> | IDemInfos> {
    mapScale: ICartesian3;
    displayResolution: ISize3;
}

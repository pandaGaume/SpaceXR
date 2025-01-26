import { IDemInfos } from "core/dem";
import { ICartesian3, ISize2, ISize3 } from "core/geometry";
import { IVerticesData, TerrainGridOptions, TerrainGridOptionsBuilder } from "core/meshes";
import { ImageLayerContentType, IsTile, ITargetBlock, ITile, ITileMap, ITileMetricsProvider } from "core/tiles";
import { IValidable, Nullable } from "core/types";
import { AbstractMesh, Mesh, TransformNode } from "@babylonjs/core";
import { IHasHolographicBounds } from "../display";

export type Map3DContentType = IDemInfos | ImageLayerContentType;

export interface IMap3D extends ITileMap<Map3DContentType>, IValidable {
    root: TransformNode;
    name: string;
}

export interface IElevationGridFactory {
    buildTopology(options: number | TerrainGridOptions | TerrainGridOptionsBuilder): IVerticesData;
}

export interface IElevationOptions {
    gridSize: number | ISize2;
    offset?: ICartesian3;
    exageration?: number;
}

export interface IElevationHost extends ITileMetricsProvider {
    tilesRoot: TransformNode;
    grid: Mesh;
    elevationOptions: IElevationOptions;
    elevationsTarget: ITargetBlock<ITile<IDemInfos>>;
}

export function IsElevationHost(b: unknown): b is IElevationHost {
    if (b === null || typeof b !== "object") return false;

    const obj = b as Partial<IElevationHost>;
    return obj.grid !== undefined && obj.tilesRoot !== undefined && obj.elevationOptions !== undefined;
}

export interface ITileWithMesh<T> extends ITile<T> {
    surface: Nullable<AbstractMesh>;
}

export function IsTileWithMesh<T>(b: unknown): b is ITileWithMesh<T> {
    if (b === null || typeof b !== "object") return false;
    const obj = b as Partial<ITileWithMesh<T>>;
    return obj.surface !== undefined && IsTile(b);
}

export interface IHasGridElevation {
    elevationInfos: Nullable<IDemInfos>;
    gridSize: Nullable<ISize2>;
}

export function IsHasElevation(b: unknown): b is IHasGridElevation {
    if (b === null || typeof b !== "object") return false;
    return (b as Partial<IHasGridElevation>).elevationInfos !== undefined;
}

export interface IMap3DMaterial<T extends ImageLayerContentType> extends IHasHolographicBounds {
    mapScale: ICartesian3;
    displayResolution: ISize3;

    imagesTarget: ITargetBlock<ITileWithMesh<T>>;
}

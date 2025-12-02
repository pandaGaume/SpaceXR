import { IDemInfos } from "core/dem";
import { ICartesian3, ISize2, ISize3 } from "core/geometry";
import { IVerticesData, TerrainGridOptions, TerrainGridOptionsBuilder } from "core/geometry";
import { ImageLayerContentType, IsTile, ITargetBlock, ITile, ITileMap } from "core/tiles";
import { IValidable, Nullable } from "core/types";
import { AbstractMesh, Mesh, TransformNode } from "@babylonjs/core";
import { IHasHolographicBounds } from "../display";

export type TextureType = ImageLayerContentType;
export type ElevationType = IDemInfos;
export type Object3dType = Array<AbstractMesh> | AbstractMesh;

export type Map3DContentType = ElevationType | TextureType | Object3dType;

export interface IMap3D extends ITileMap<Map3DContentType>, IValidable {
    root: TransformNode;
    name: string;
    grid: Mesh;
    elevationOptions: IElevationOptions;
}

export interface IElevationGridFactory {
    buildTopology(options: number | ISize2 | TerrainGridOptions | TerrainGridOptionsBuilder): IVerticesData;
}

export interface IElevationOptions {
    gridSize: number | ISize2;
    offset?: ICartesian3;
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

export interface ITileWithGridElevation<T> extends ITileWithMesh<T> {
    gridSize: Nullable<ISize2>;
}

export interface IMap3DMaterial extends IHasHolographicBounds {
    mapScale: ICartesian3;
    displayResolution: ISize3;

    imagesTarget: ITargetBlock<ITileWithGridElevation<TextureType>>;
    elevationsTarget: ITargetBlock<ITile<ElevationType>>;
}

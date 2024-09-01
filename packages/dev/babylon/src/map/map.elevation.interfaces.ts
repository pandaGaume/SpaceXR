import { TransformNode } from "@babylonjs/core";
import { IDemInfos } from "core/dem";
import { ICartesian3 } from "core/geometry";
import { IVerticesData, TerrainGridOptions, TerrainGridOptionsBuilder } from "core/meshes";
import { IsTileMapLayer, ITileMapLayer, ITileMapLayerOptions, ITileMapLayerView } from "core/tiles";

export type ElevationMapContentType = IDemInfos;

export interface IElevationHost extends ITileMapLayerView<IDemInfos> {
    root: TransformNode;
}

export interface IElevationGridFactory {
    buildTopology(options: number | TerrainGridOptions | TerrainGridOptionsBuilder): IVerticesData;
}

export interface IElevationLayerOptions extends ITileMapLayerOptions<IDemInfos> {
    exageration?: number;
    insets?: ICartesian3;
}

export function IsElevationLayerOptions(b: unknown): b is IElevationLayerOptions {
    if (typeof b !== "object" || b === null) return false;
    return (<IElevationLayerOptions>b).exageration !== undefined || (<IElevationLayerOptions>b).insets !== undefined;
}

export function IsElevationLayer(b: unknown): b is IElevationLayer {
    return IsTileMapLayer(b) && IsElevationLayerOptions(b);
}

export interface IElevationLayer extends ITileMapLayer<IDemInfos>, IElevationLayerOptions {}

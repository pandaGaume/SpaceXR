import { IDemInfos } from "core/dem";
import { IVerticesData, TerrainGridOptions, TerrainGridOptionsBuilder } from "core/meshes";
import { ITileMapLayerView } from "core/tiles";

export type ElevationMapContentType = IDemInfos;

export interface IElevationHost extends ITileMapLayerView<IDemInfos> {}

export interface IElevationGridFactory {
    buildTopology(options: number | TerrainGridOptions | TerrainGridOptionsBuilder): IVerticesData;
}

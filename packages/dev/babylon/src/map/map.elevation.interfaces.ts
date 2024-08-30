import { IDemInfos } from "core/dem";
import { ITileMapLayerView } from "core/tiles";

export type ElevationMapContentType = IDemInfos;

export interface IElevationHost extends ITileMapLayerView<IDemInfos> {}

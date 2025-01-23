import { IDemInfos } from "core/dem";
import { ICartesian3 } from "core/geometry";
import { IsTileMapLayer, ITileMapLayer, ITileMapLayerOptions } from "core/tiles";

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
import { IDemInfos } from "core/dem";
import { TileMapLayer } from "core/tiles";
import { IElevationLayer } from "./dem.interfaces";

export class ElevationLayer extends TileMapLayer<IDemInfos> implements IElevationLayer {
    public static ExagerationPropertyName: string = "exageration";
    public static OffsetsPropertyName: string = "offsets";
}

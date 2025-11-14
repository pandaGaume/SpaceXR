import { ITileAddress, ITileMapLayer, ITileMapLayerOptions } from "core/tiles";
import { Object3dType } from "../../map";

export interface IObjectLayerOptions extends ITileMapLayerOptions<Object3dType> {}

export interface IObjectLayer extends ITileMapLayer<Object3dType>, IObjectLayerOptions {}

export interface ITile3DAddress extends ITileAddress{
    tileId: string;
}
import { ITileMapLayer, ITileMapLayerOptions } from "core/tiles";
import { Object3dType } from "../../map";

export interface IObjectLayerOptions extends ITileMapLayerOptions<Object3dType> {}

export interface IObjectLayer extends ITileMapLayer<Object3dType>, IObjectLayerOptions {}

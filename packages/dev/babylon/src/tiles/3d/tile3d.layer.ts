import { ITileAddress3, ITileContentProvider, ITileDatasource, ITileMapLayer, ITileMapLayerOptions, TileMapLayer } from "core/tiles";
import { Object3dType } from "../../map";



export interface IObjectLayerOptions extends ITileMapLayerOptions<Object3dType> {}

export interface IObjectLayer extends ITileMapLayer<Object3dType>, IObjectLayerOptions {}

export class ObjectLayer extends TileMapLayer<Object3dType> implements IObjectLayer {
    public constructor(
        name: string,
        provider: ITileContentProvider<Object3dType> | ITileDatasource<Object3dType, ITileAddress3>,
        options?: IObjectLayerOptions,
        enabled?: boolean
    ) {
        super(name, provider, options, enabled);
    }
}

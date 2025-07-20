import { ITileAddress3, ITileContentProvider, ITileDatasource, TileMapLayer } from "core/tiles";
import { Object3dType } from "../../map";
import { IObjectLayer, IObjectLayerOptions } from "./tile3d.interfaces";

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

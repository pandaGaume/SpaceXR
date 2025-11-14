import { ITileContentProvider, ITileDatasource, TileMapLayer } from "core/tiles";
import { Object3dType } from "../../map";
import { IObjectLayer, IObjectLayerOptions, ITile3DAddress } from "./tile3d.interfaces";

export class ObjectLayer extends TileMapLayer<Object3dType> implements IObjectLayer {
    public constructor(
        name: string,
        provider: ITileContentProvider<Object3dType> | ITileDatasource<Object3dType, ITile3DAddress>,
        options?: IObjectLayerOptions,
        enabled?: boolean
    ) {
        super(name, provider, options, enabled);
    }
}

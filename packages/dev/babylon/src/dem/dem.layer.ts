import { IDemInfos } from "core/dem";
import { ITile2DAddress, ITileContentProvider, ITileDatasource, TileMapLayer } from "core/tiles";
import { IElevationLayer, IElevationLayerOptions } from "./dem.interfaces";
import { ICartesian3 } from "core/geometry";
import { PropertyChangedEventArgs } from "core/events";

export class ElevationLayer extends TileMapLayer<IDemInfos> implements IElevationLayer {
    public static ExagerationPropertyName: string = "exageration";
    public static OffsetsPropertyName: string = "offsets";

    _exageration?: number;
    _offsets?: ICartesian3;

    public constructor(name: string, provider: ITileContentProvider<IDemInfos> | ITileDatasource<IDemInfos, ITile2DAddress>, options?: IElevationLayerOptions, enabled?: boolean) {
        super(name, provider, options, enabled);
    }

    public get exageration(): number | undefined {
        return this._exageration;
    }

    public set exageration(value: number | undefined) {
        if (this._exageration !== value) {
            const old = this._exageration;
            this._exageration = value;
            this.propertyChangedObservable.notifyObservers(new PropertyChangedEventArgs(this, old, value, ElevationLayer.ExagerationPropertyName));
        }
    }

    public get offsets(): ICartesian3 | undefined {
        return this._offsets;
    }

    public set offsets(value: ICartesian3 | undefined) {
        if (this._offsets !== value) {
            const old = this._offsets;
            this._offsets = value;
            this.propertyChangedObservable.notifyObservers(new PropertyChangedEventArgs(this, old, value, ElevationLayer.OffsetsPropertyName));
        }
    }
}

import { IDemInfos } from "core/dem";
import { PropertyChangedEventArgs } from "core/events";
import { Cartesian3, ICartesian3 } from "core/geometry";
import { ITileAddress, ITileContentProvider, ITileDatasource, TileMapLayer } from "core/tiles";
import { IElevationLayer, IElevationLayerOptions } from "./map.elevation.interfaces";

export class ElevationLayer extends TileMapLayer<IDemInfos> implements IElevationLayer {
    public static readonly DefaultExageration: number = 1.0;
    public static readonly DefaultInsets: ICartesian3 = Cartesian3.Zero();

    public static readonly ExagerationPropertyName: string = "exageration";
    public static readonly OffsetsPropertyName: string = "offsets";

    private _exageration?: number;
    private _offsets?: ICartesian3;

    public constructor(name: string, provider: ITileContentProvider<IDemInfos> | ITileDatasource<IDemInfos, ITileAddress>, options?: IElevationLayerOptions, enabled?: boolean) {
        super(name, provider, options, enabled);
        this._offsets = options?.offsets ?? ElevationLayer.DefaultInsets;
        this._exageration = options?.exageration ?? ElevationLayer.DefaultExageration;
    }

    public get exageration(): number | undefined {
        return this._exageration;
    }

    public set exageration(value: number | undefined) {
        if (this._exageration === value) return;

        if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
            const oldValue = this._exageration;
            this._exageration = value;
            const args = new PropertyChangedEventArgs<ElevationLayer, number>(this, oldValue, this._exageration, ElevationLayer.ExagerationPropertyName);
            this._propertyChangedObservable.notifyObservers(args, -1, this, this);
            return;
        }

        this._exageration = value;
    }

    public get offsets(): ICartesian3 | undefined {
        return this._offsets;
    }

    public set offsets(value: ICartesian3 | undefined) {
        if (this._offsets === value) return;

        if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
            const oldValue = this._offsets;
            this._offsets = value;
            const args = new PropertyChangedEventArgs<ElevationLayer, ICartesian3>(this, oldValue, this._offsets, ElevationLayer.OffsetsPropertyName);
            this._propertyChangedObservable.notifyObservers(args, -1, this, this);
            return;
        }

        this._offsets = value;
    }
}

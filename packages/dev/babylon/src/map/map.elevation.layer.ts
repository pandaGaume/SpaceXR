import { IDemInfos } from "core/dem";
import { PropertyChangedEventArgs } from "core/events";
import { Cartesian3, ICartesian3 } from "core/geometry";
import { ITileAddress, ITileContentProvider, ITileDatasource, TileMapLayer } from "core/tiles";
import { IElevationLayer, IElevationLayerOptions } from "./map.elevation.interfaces";

export class ElevationLayer extends TileMapLayer<IDemInfos> implements IElevationLayer {
    public static readonly DefaultExageration: number = 1.0;
    public static readonly DefaultInsets: ICartesian3 = Cartesian3.Zero();

    public static readonly ExagerationPropertyName: string = "exageration";
    public static readonly InsetsPropertyName: string = "insets";

    private _exageration?: number;
    private _insets?: ICartesian3;

    public constructor(name: string, provider: ITileContentProvider<IDemInfos> | ITileDatasource<IDemInfos, ITileAddress>, options?: IElevationLayerOptions, enabled?: boolean) {
        super(name, provider, options, enabled);
        this._insets = options?.insets ?? ElevationLayer.DefaultInsets;
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

    public get insets(): ICartesian3 | undefined {
        return this._insets;
    }

    public set insets(value: ICartesian3 | undefined) {
        if (this._insets === value) return;

        if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
            const oldValue = this._insets;
            this._insets = value;
            const args = new PropertyChangedEventArgs<ElevationLayer, ICartesian3>(this, oldValue, this._insets, ElevationLayer.InsetsPropertyName);
            this._propertyChangedObservable.notifyObservers(args, -1, this, this);
            return;
        }

        this._insets = value;
    }
}
